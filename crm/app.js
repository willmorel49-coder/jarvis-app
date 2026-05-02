/* ═══════════════════════════════════════════════
   INTÉGRAL PHARMA CRM — app.js
   Vanilla JS + SheetJS + Chart.js
   Auth & data: localStorage (V1) → Supabase (V2)
═══════════════════════════════════════════════ */

// ── CONSTANTS ────────────────────────────────

// ── SUPABASE ──────────────────────────────────
const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const PHARMA_COLORS = ['#0057FF','#00E5A0','#9B5CFF','#FFB020','#FF4D6D','#00C6FF','#FF6B35','#A78BFA','#34D399','#F59E0B'];

// ── STATE ────────────────────────────────────
let state = {
  user: null,
  pharmacies: [],
  imports: [],
  sales: [],
  currentPage: 'dashboard',
  charts: {},
  sim: { pharmacyId: null, name: 'Simulation 1', items: [] },
};

// ── STORAGE ──────────────────────────────────
async function load() {
  const [{ data: pharmacies }, { data: imports }, { data: sales }] = await Promise.all([
    sb.from('pharmacies').select('*').order('name'),
    sb.from('imports').select('*').order('imported_at', { ascending: false }),
    sb.from('sales').select('*'),
  ]);
  state.pharmacies = (pharmacies || []).map(p => ({ id: p.id, name: p.name, code: p.code, color: p.color }));
  state.imports    = (imports    || []).map(i => ({ id: i.id, pharmacyId: i.pharmacy_id, month: i.month, year: i.year, filename: i.filename, importedAt: i.imported_at }));
  state.sales      = (sales      || []).map(s => ({
    id: s.id, importId: s.import_id, pharmacyId: s.pharmacy_id,
    month: s.month, year: s.year,
    artDesignation: s.art_designation, artCode: s.art_code, artId: s.art_id,
    artFamille: s.art_famille || null,
    qte: parseFloat(s.qte)||0, puBrut: parseFloat(s.pu_brut)||0,
    puNet: parseFloat(s.pu_net)||0, mntNetHt: parseFloat(s.mnt_net_ht)||0,
  }));
}

// ── AUTH ─────────────────────────────────────
async function loadUserProfile() {
  try {
    const { data: { user }, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) return false;
    const { data: profile, error: profileErr } = await sb.from('user_profiles').select('*').eq('id', user.id).single();
    if (profileErr || !profile) { await sb.auth.signOut(); return false; }
    state.user = {
      id:          user.id,
      email:       user.email,
      name:        profile.name,
      role:        profile.role,
      pharmacyIds: profile.pharmacy_ids,
    };
    return true;
  } catch {
    return false;
  }
}

async function tryLogin(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return false;
  return await loadUserProfile();
}

async function restoreSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return false;
  return await loadUserProfile();
}

async function logout() {
  await sb.auth.signOut();
  state.user = null;
  document.getElementById('app').classList.remove('visible');
  document.getElementById('login-screen').style.display = 'flex';
}

// ── PHARMACY UTILS ────────────────────────────
function pharmaMetaFromFilename(filename) {
  const base = filename.replace(/\.(xlsx|xls|csv)$/i, '').trim();

  // WML multi-pharmacy format: WML_01_2026.xlsx
  const wmlMatch = base.match(/WML_(\d{2})_(\d{4})/i);
  if (wmlMatch) {
    return { name: 'WML', code: 'WML', color: PHARMA_COLORS[0], month: parseInt(wmlMatch[1]), year: parseInt(wmlMatch[2]), isWML: true };
  }

  // Format "ventes [nom pharmacie]" sans date → mois courant
  const ventesMatch = base.match(/^ventes[\s_]+(.+)/i);
  if (ventesMatch) {
    const nomRaw = ventesMatch[1].trim();
    const nom    = nomRaw.replace(/\b\w/g, c => c.toUpperCase());
    const code   = nom.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5);
    const now    = new Date();
    const color  = PHARMA_COLORS[Math.abs([...nom].reduce((a,c) => a + c.charCodeAt(0), 0)) % PHARMA_COLORS.length];
    return { name: nom, code, color, month: now.getMonth() + 1, year: now.getFullYear() };
  }

  const monthYearMatch = base.match(/(\d{2})\s+(\d{2,4})$/);
  let month = null, year = null, namePart = base;
  if (monthYearMatch) {
    month = parseInt(monthYearMatch[1]);
    year  = parseInt(monthYearMatch[2]);
    if (year < 100) year += 2000;
    namePart = base.slice(0, base.length - monthYearMatch[0].length).trim();
  }
  const name = namePart
    .replace(/^Phie\s+/i, 'Pharmacie ')
    .replace(/^Ph\s+/i,   'Pharmacie ')
    .replace(/\b\w/g, c => c.toUpperCase());
  const code  = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
  const color = PHARMA_COLORS[state.pharmacies.length % PHARMA_COLORS.length];
  return { name, code, color, month, year };
}

// ── EXCEL PARSING ─────────────────────────────
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(rows);
      } catch(err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function normalizeRow(row) {
  // Map any column naming variation
  const get = (...keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]; return ''; };
  return {
    artDesignation: get('PLVDESIGNATION','ARTDESIGNATION','Art Designation','designation'),
    artCode:        String(get('ARTCODE','Art Code','code') || ''),
    artId:          get('ARTID','Art ID','id'),
    qte:            parseFloat(get('PLVQTE','Qte','qte')) || 0,
    puBrut:         parseFloat(get('PLVPUBRUT','PLVPUBRUT_MOY','PU Brut','pu_brut')) || 0,
    puNet:          parseFloat(get('PLVPUNET','PLVPUNET_MOY','PU Net','pu_net')) || 0,
    mntNetHt:       parseFloat(get('PLVMNTNETHT','PLVMNTNETHT_MOY','Mnt Net HT','mnt_net')) || 0,
    // WML-specific (null for old format)
    pharmacyName:   get('TIRSOCIETE') || null,
    pharmacyCode:   get('TIRCODE') || null,
    subfamily:      get('ARTSOUSFAMILLE') || null,
    nature:         get('ARTNATURE') || null,
    afmCode:        get('AFMCODE') || null,
  };
}

async function importMultiPharmaFile(file, month, year) {
  let rows;
  try { rows = await parseExcel(file); }
  catch(e) { return { ok: false, error: 'Erreur lecture fichier' }; }
  if (!rows.length) return { ok: false, error: 'Fichier vide' };

  // Group rows by pharmacy name
  const byPharma = {};
  for (const row of rows) {
    const norm = normalizeRow(row);
    if (!norm.pharmacyName || !norm.artDesignation) continue;
    const key = String(norm.pharmacyName).trim();
    if (!byPharma[key]) byPharma[key] = { name: key, code: String(norm.pharmacyCode || ''), rows: [] };
    byPharma[key].rows.push(norm);
  }

  const pharmacyGroups = Object.values(byPharma);
  if (!pharmacyGroups.length) return { ok: false, error: 'Aucune ligne valide' };

  let totalLines = 0;
  const importedPharmas = [];

  for (const group of pharmacyGroups) {
    // Find or create pharmacy
    let pharma = state.pharmacies.find(p => p.name.toLowerCase() === group.name.toLowerCase());
    if (!pharma) {
      // Generate display code from initials
      const code = group.name.replace(/^pharmacie\s+/i,'').split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,4) || group.code.slice(-4);
      const color = PHARMA_COLORS[state.pharmacies.length % PHARMA_COLORS.length];
      const { data: inserted, error: phErr } = await sb.from('pharmacies').insert({ name: group.name, code, color }).select().single();
      if (phErr) continue; // skip this pharmacy if error
      pharma = { id: inserted.id, name: inserted.name, code: inserted.code, color: inserted.color };
      state.pharmacies.push(pharma);
    }

    // Delete old import for same period (CASCADE removes its sales)
    if (month && year) {
      const oldImp = state.imports.find(i => i.pharmacyId === pharma.id && i.month === month && i.year === year);
      if (oldImp) {
        await sb.from('imports').delete().eq('id', oldImp.id);
        state.imports = state.imports.filter(i => i.id !== oldImp.id);
        state.sales   = state.sales.filter(s => s.importId !== oldImp.id);
      }
    }

    // Insert import record
    const { data: imp, error: impErr } = await sb.from('imports')
      .insert({ pharmacy_id: pharma.id, month, year, filename: file.name, imported_by: state.user.id })
      .select().single();
    if (impErr) continue;
    state.imports.unshift({ id: imp.id, pharmacyId: imp.pharmacy_id, month: imp.month, year: imp.year, filename: imp.filename, importedAt: imp.imported_at });

    // Build sales rows — WML stores sales as POSITIVE values (store as-is)
    const salesRows = group.rows.map(r => {
      const famille = classifyFromWMLRow(r.subfamily, r.nature, r.afmCode, r.puNet);
      return {
        _famille: famille,
        import_id: imp.id, pharmacy_id: pharma.id, month, year,
        art_designation: r.artDesignation,
        art_code: r.artCode,
        art_id: r.artId || null,
        qte:        r.qte,
        pu_brut:    r.puBrut,
        pu_net:     r.puNet,
        mnt_net_ht: r.mntNetHt,
      };
    });

    const BATCH = 500;
    let batchOk = true;
    for (let i = 0; i < salesRows.length; i += BATCH) {
      const { error: sErr } = await sb.from('sales').insert(
        salesRows.slice(i, i + BATCH).map(({ _famille, ...s }) => s)
      );
      if (sErr) { console.error('Sales insert error:', sErr); batchOk = false; break; }
      state.sales.push(...salesRows.slice(i, i + BATCH).map(s => ({
        id: crypto.randomUUID(), importId: s.import_id, pharmacyId: s.pharmacy_id,
        month: s.month, year: s.year,
        artDesignation: s.art_designation, artCode: s.art_code, artId: s.art_id,
        artFamille: s._famille,
        qte: s.qte, puBrut: s.pu_brut, puNet: s.pu_net, mntNetHt: s.mnt_net_ht,
      })));
    }
    if (batchOk) {
      totalLines += salesRows.length;
      importedPharmas.push(pharma);
    }
  }

  if (importedPharmas.length === 0) {
    return { ok: false, error: `Aucune pharmacie importée — vérifiez la structure du fichier` };
  }
  return { ok: true, isMulti: true, pharmacies: importedPharmas, month, year, totalLines };
}

async function importFile(file) {
  const meta = pharmaMetaFromFilename(file.name);
  if (meta.isWML) return importMultiPharmaFile(file, meta.month, meta.year);
  const { name, code, color, month, year } = meta;
  let rows;
  try { rows = await parseExcel(file); }
  catch(e) { return { ok: false, error: 'Erreur lecture fichier' }; }
  if (!rows.length) return { ok: false, error: 'Fichier vide' };

  // 1. Find or create pharmacy in Supabase
  let pharma = state.pharmacies.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!pharma) {
    const { data: inserted, error: phErr } = await sb.from('pharmacies').insert({ name, code, color }).select().single();
    if (phErr) return { ok: false, error: 'Erreur création pharmacie' };
    pharma = { id: inserted.id, name: inserted.name, code: inserted.code, color: inserted.color };
    state.pharmacies.push(pharma);
  }

  // 2. Delete old import for same pharma/period (CASCADE removes its sales)
  if (month && year) {
    const oldImp = state.imports.find(i => i.pharmacyId === pharma.id && i.month === month && i.year === year);
    if (oldImp) {
      await sb.from('imports').delete().eq('id', oldImp.id);
      state.imports = state.imports.filter(i => i.id !== oldImp.id);
      state.sales   = state.sales.filter(s => s.importId !== oldImp.id);
    }
  }

  // 3. Insert import record
  const { data: imp, error: impErr } = await sb.from('imports')
    .insert({ pharmacy_id: pharma.id, month, year, filename: file.name, imported_by: state.user.id })
    .select().single();
  if (impErr) return { ok: false, error: 'Erreur création import' };
  state.imports.unshift({ id: imp.id, pharmacyId: imp.pharmacy_id, month: imp.month, year: imp.year, filename: imp.filename, importedAt: imp.imported_at });

  // 4. Bulk insert sales rows in batches of 500
  const salesRows = rows.map(normalizeRow).filter(r => r.artDesignation).map(r => ({
    import_id: imp.id, pharmacy_id: pharma.id, month, year,
    art_designation: r.artDesignation, art_code: r.artCode, art_id: r.artId,
    qte: r.qte, pu_brut: r.puBrut, pu_net: r.puNet, mnt_net_ht: r.mntNetHt,
  }));
  const BATCH = 500;
  for (let i = 0; i < salesRows.length; i += BATCH) {
    const { error: sErr } = await sb.from('sales').insert(salesRows.slice(i, i + BATCH));
    if (sErr) return { ok: false, error: sErr.message || sErr.code || 'Erreur insertion ventes' };
    state.sales.push(...salesRows.slice(i, i + BATCH).map(s => ({
      id: crypto.randomUUID(), importId: s.import_id, pharmacyId: s.pharmacy_id,
      month: s.month, year: s.year,
      artDesignation: s.art_designation, artCode: s.art_code, artId: s.art_id,
      qte: s.qte, puBrut: s.pu_brut, puNet: s.pu_net, mntNetHt: s.mnt_net_ht,
    })));
  }

  return { ok: true, pharma, month, year, count: salesRows.length };
}

// ── DATA UTILS ────────────────────────────────
function getSales(filters = {}) {
  let data = state.sales;
  if (filters.pharmacyId) data = data.filter(s => s.pharmacyId === filters.pharmacyId);
  if (filters.month)      data = data.filter(s => s.month === filters.month);
  if (filters.year)       data = data.filter(s => s.year  === filters.year);
  // Role filter
  if (state.user?.role === 'commercial' && state.user.pharmacyIds?.length) {
    data = data.filter(s => state.user.pharmacyIds.includes(s.pharmacyId));
  }
  return data;
}

// ── CATEGORIES ────────────────────────────────
const CATS = {
  biosim:    { label: 'Biosimilaires',  color: '#9B5CFF', icon: '🧬' },
  generique: { label: 'Génériques',     color: '#00E5A0', icon: '💊' },
  nr:        { label: 'Non remboursés', color: '#FF6B35', icon: '🔴' },
  ch:        { label: 'Cher',           color: '#FF4D6D', icon: '💎' },
  mi:        { label: 'Intermédiaire',  color: '#FFB020', icon: '📊' },
  pp:        { label: 'Petit prix',     color: '#34D399', icon: '✓'  },
};
// froid est un indicateur transversal (❄️), pas une catégorie standalone
function isFroid(sale) {
  if (sale && sale.artFamille === 'froid') return true;
  return /FROID|RÉFRIGÉR|REFRIGER|THERMOSENS/i.test((sale && sale.artDesignation) || '');
}
function isFroidBench(b) {
  return b.categorie === 'froid' || /FROID|RÉFRIGÉR|REFRIGER|THERMOSENS/i.test(b.designation || '');
}

function classifyProduct(sale) {
  // froid n'est plus une catégorie standalone → indicateur ❄️ seulement
  if (sale.artFamille && CATS[sale.artFamille] && sale.artFamille !== 'froid') return sale.artFamille;
  const name = (sale.artDesignation || '').toUpperCase();
  if (/BIOSIM|BIOSIMILAIRE/i.test(name))   return 'biosim';
  if (/\bGNR\b|GÉNÉR|GENERI/i.test(name)) return 'generique';
  if (/\bNR\b/.test(name))                return 'nr';
  const p = sale.puNet || 0;
  return p > 468 ? 'ch' : p > 4.33 ? 'mi' : 'pp';
}

function classifyFromWMLRow(sf, nature, afm, puNet) {
  const n = (nature || '').toLowerCase();
  const a = (afm || '').toLowerCase();
  // froid = indicateur transversal → on classe sur la nature thérapeutique ou le prix
  if (n.includes('biosimilaire')) return 'biosim';
  if (n.includes('generique'))    return 'generique';
  if (a === 'para' || a === 'dm' || a === 'dm_20') return 'nr';
  if (puNet > 468) return 'ch';
  if (puNet > 4.33) return 'mi';
  return 'pp';
}

function sumCA(sales)    { return sales.reduce((a, s) => a + (s.mntNetHt || 0), 0); }
function sumQte(sales)   { return sales.reduce((a, s) => a + (s.qte || 0), 0); }
function sumMarge(sales) { return sales.reduce((a, s) => a + Math.max(0, (s.puBrut - s.puNet) * s.qte), 0); }
function sumCaBrut(sales){ return sales.reduce((a, s) => a + (s.puBrut * s.qte), 0); }
function margePct(sales) { const b = sumCaBrut(sales); return b > 0 ? sumMarge(sales) / b * 100 : 0; }

function byCategory(sales) {
  const map = {};
  for (const s of sales) {
    const cat = classifyProduct(s);
    if (!map[cat]) map[cat] = { ca: 0, marge: 0, qte: 0, nb: 0 };
    map[cat].ca    += s.mntNetHt;
    map[cat].marge += Math.max(0, (s.puBrut - s.puNet) * s.qte);
    map[cat].qte   += s.qte;
    map[cat].nb    += 1;
  }
  return map;
}

function fmt(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M€';
  if (n >= 1000)    return (n/1000).toFixed(1)    + 'k€';
  return n.toFixed(0) + '€';
}
function fmtNum(n) { return n.toLocaleString('fr-FR'); }

function monthName(m) {
  return ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][m - 1] || m;
}

function topProducts(sales, n = 10) {
  const map = {};
  for (const s of sales) {
    const k = s.artCode || s.artDesignation;
    if (!map[k]) map[k] = {
      name: s.artDesignation, code: s.artCode,
      cat: classifyProduct(s), froid: isFroid(s),
      qte: 0, ca: 0, marge: 0,
    };
    map[k].qte   += s.qte;
    map[k].ca    += s.mntNetHt;
    map[k].marge += Math.max(0, (s.puBrut - s.puNet) * s.qte);
  }
  return Object.values(map).sort((a,b) => b.ca - a.ca).slice(0, n);
}

function topPharmacies(n = 10, salesData) {
  const sales = salesData || getSales();
  const map = {};
  for (const s of sales) {
    if (!map[s.pharmacyId]) map[s.pharmacyId] = { id: s.pharmacyId, qte: 0, ca: 0 };
    map[s.pharmacyId].qte += s.qte;
    map[s.pharmacyId].ca  += s.mntNetHt;
  }
  return Object.values(map)
    .sort((a,b) => b.ca - a.ca)
    .slice(0, n)
    .map(p => ({ ...p, pharma: state.pharmacies.find(ph => ph.id === p.id) }))
    .filter(p => p.pharma);
}

function caByMonth(salesData) {
  const data = salesData || getSales();
  const map = {};
  for (const s of data) {
    const k = `${s.year}-${String(s.month).padStart(2,'0')}`;
    map[k] = (map[k] || 0) + s.mntNetHt;
  }
  return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0]));
}

// ── RENDER ────────────────────────────────────
function renderRank(i) {
  const cls = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';
  return `<div class="rank ${cls}">${i < 3 ? '🥇🥈🥉'[i] : i+1}</div>`;
}

function renderProgress(value, max, color) {
  const pct = max ? Math.round(value / max * 100) : 0;
  return `<div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:${color}"></div></div>`;
}

// ── DASHBOARD ────────────────────────────────
let pharmaPeriod = 'all'; // 'all' | 'YYYY-MM'

function deltaBadge(current, prev) {
  if (!prev || prev === 0) return '<span class="delta-badge delta-neu">—</span>';
  const pct = ((current - prev) / prev * 100);
  const cls = pct >= 0 ? 'delta-pos' : 'delta-neg';
  const arrow = pct >= 0 ? '▲' : '▼';
  return `<span class="delta-badge ${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

function statusChip(pct) {
  if (pct > 20)  return '<span class="status-chip status-up">● Forte croissance</span>';
  if (pct >= -5) return '<span class="status-chip status-flat">● Stable</span>';
  return '<span class="status-chip status-down">● En baisse</span>';
}

function getCurrentPeriod(sales) {
  let maxKey = 0, maxY = null, maxM = null;
  for (const s of sales) {
    const k = s.year * 12 + s.month;
    if (k > maxKey) { maxKey = k; maxY = s.year; maxM = s.month; }
  }
  return { year: maxY, month: maxM };
}

function getPrevPeriod(year, month) {
  if (!year) return { year: null, month: null };
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function renderDashboard() {
  const allSalesRaw = getSales();

  if (!allSalesRaw.length) {
    document.getElementById('dash-content').innerHTML = `
      <div style="margin-bottom:28px">
        ${emptyState('📊', 'Aucune donnée', 'Importez des fichiers Excel pour voir votre dashboard')}
      </div>`;
    return;
  }

  // ── Périodes clés ────────────────────────────
  const { year: curY, month: curM } = getCurrentPeriod(allSalesRaw);
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);

  const salesCur  = getSales({ year: curY, month: curM });
  const salesPrev = prevY ? getSales({ year: prevY, month: prevM }) : [];

  // ── KPIs mois courant ─────────────────────────
  const caCur   = sumCA(salesCur);
  const caPrev  = sumCA(salesPrev);

  const phActifsCur  = new Set(salesCur.map(s => s.pharmacyId));
  const phActifsPrev = new Set(salesPrev.map(s => s.pharmacyId));
  const nPhCur  = phActifsCur.size;
  const nPhPrev = phActifsPrev.size;

  const panierCur  = nPhCur  > 0 ? caCur  / nPhCur  : 0;
  const panierPrev = nPhPrev > 0 ? caPrev / nPhPrev  : 0;

  // Meilleure progression MoM
  let bestPharma = null, bestGrowth = -Infinity;
  for (const pid of phActifsCur) {
    const cur  = sumCA(salesCur.filter(s => s.pharmacyId === pid));
    const prev = sumCA(salesPrev.filter(s => s.pharmacyId === pid));
    if (prev > 0) {
      const g = (cur - prev) / prev * 100;
      if (g > bestGrowth) { bestGrowth = g; bestPharma = pid; }
    }
  }
  const bestPharmaObj = bestPharma ? state.pharmacies.find(p => p.id === bestPharma) : null;

  // ── Alertes commerciales ──────────────────────
  const alerts = [];
  for (const pid of phActifsPrev) {
    const ph   = state.pharmacies.find(p => p.id === pid);
    if (!ph) continue;
    const cur  = sumCA(salesCur.filter(s => s.pharmacyId === pid));
    const prev = sumCA(salesPrev.filter(s => s.pharmacyId === pid));

    if (!phActifsCur.has(pid)) {
      alerts.push({ type: 'absent', icon: '🟡', title: `${ph.name} — Pas de commande ce mois`, sub: `CA le mois dernier : ${fmt(prev)}` });
    } else if (prev > 0) {
      const g = (cur - prev) / prev * 100;
      if (g <= -15) alerts.push({ type: 'down', icon: '🔴', title: `${ph.name} — Baisse ${Math.abs(g).toFixed(0)}%`, sub: `${fmt(prev)} → ${fmt(cur)}` });
      else if (g >= 20) alerts.push({ type: 'up', icon: '🟢', title: `${ph.name} — Forte croissance +${g.toFixed(0)}%`, sub: `${fmt(prev)} → ${fmt(cur)}` });
    }
  }
  // Pharmacies nouvelles ce mois (pas de commande le mois dernier)
  for (const pid of phActifsCur) {
    if (!phActifsPrev.has(pid) && salesPrev.length > 0) {
      const ph  = state.pharmacies.find(p => p.id === pid);
      if (!ph) continue;
      const cur = sumCA(salesCur.filter(s => s.pharmacyId === pid));
      alerts.push({ type: 'new', icon: '🟢', title: `${ph.name} — Nouvelle commande`, sub: `CA : ${fmt(cur)}` });
    }
  }
  alerts.sort((a,b) => {
    const order = { down: 0, absent: 1, new: 2, up: 3 };
    return (order[a.type] ?? 9) - (order[b.type] ?? 9);
  });

  // ── Top pharmacies mois courant (bar chart + table) ──
  const topPh5 = topPharmacies(5, salesCur);
  const maxPhCA = Math.max(...topPh5.map(p => p.ca), 1);

  // ── Top produits mois courant ──────────────────
  const top5Prod = topProducts(salesCur, 5);

  // ── Catégories (donut) ────────────────────────
  const rawCats = byCategory(salesCur);
  const catRows = Object.keys(CATS)
    .map(k => { const d = rawCats[k] || { ca:0, qte:0, nb:0 }; return { key: k, ...CATS[k], ...d }; })
    .filter(c => c.nb > 0)
    .sort((a,b) => b.ca - a.ca);

  // ── HTML ─────────────────────────────────────
  const curLabel  = `${monthName(curM)} ${curY}`;
  const prevLabel = prevY ? `${monthName(prevM)} ${prevY}` : '—';

  const alertsHtml = alerts.length
    ? alerts.slice(0, 6).map(a => `
        <div class="alert-item">
          <span class="alert-icon">${a.icon}</span>
          <div class="alert-body">
            <div class="alert-title">${a.title}</div>
            <div class="alert-sub">${a.sub}</div>
          </div>
        </div>`).join('')
    : `<div class="alert-item"><span class="alert-icon">✅</span><div class="alert-body"><div class="alert-title">Aucune alerte</div><div class="alert-sub">Toutes les pharmacies sont actives ce mois</div></div></div>`;

  const top5PhHtml = topPh5.map((p, i) => {
    const prev = sumCA(salesPrev.filter(s => s.pharmacyId === p.id));
    const cur  = p.ca;
    const g    = prev > 0 ? (cur - prev) / prev * 100 : null;
    return `<tr style="cursor:pointer" onclick="showPharmaDetail('${p.id}')">
      <td>${renderRank(i)}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:7px">
          <span style="width:8px;height:8px;border-radius:50%;background:${p.pharma.color};flex-shrink:0"></span>
          <span class="td-name">${p.pharma.name}</span>
        </span>
      </td>
      <td class="td-num" style="text-align:right">${fmt(cur)}</td>
      <td style="text-align:right">${g !== null ? deltaBadge(cur, prev) : '<span class="delta-badge delta-neu">—</span>'}</td>
      <td style="text-align:right">${g !== null ? statusChip(g) : ''}</td>
    </tr>`;
  }).join('');

  const top5ProdHtml = top5Prod.map((p, i) => {
    const cat = CATS[p.cat] || CATS.mi;
    return `<tr>
      <td>${renderRank(i)}</td>
      <td class="td-name">${p.name}</td>
      <td class="td-num" style="text-align:right">${fmtNum(Math.round(p.qte))}</td>
      <td class="td-num" style="text-align:right">${fmt(p.ca)}</td>
      <td><span style="font-size:11px;padding:2px 7px;border-radius:4px;background:${cat.color}22;color:${cat.color}">${cat.label}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('dash-content').innerHTML = `

    <!-- Row 1 : Hero KPI + 3 secondaires -->
    <div class="kpi-grid fade-up" style="grid-template-columns:2fr 1fr 1fr 1fr;margin-bottom:24px">

      <!-- Hero -->
      <div class="kpi-card kpi-hero">
        <div class="kpi-icon">💰</div>
        <div class="kpi-value">${fmt(caCur)}</div>
        <div class="kpi-label">CA Secteur — ${curLabel}</div>
        <div style="margin-top:12px;display:flex;align-items:center;gap:8px">
          ${deltaBadge(caCur, caPrev)}
          <span style="font-size:11px;color:rgba(255,255,255,0.55)">vs ${prevLabel}</span>
        </div>
      </div>

      <!-- Pharmacies actives -->
      <div class="kpi-card kc-g">
        <div class="kpi-icon">🏥</div>
        <div class="kpi-value" style="color:var(--mint)">${nPhCur}</div>
        <div class="kpi-label">Pharmacies actives</div>
        <div style="margin-top:10px">${deltaBadge(nPhCur, nPhPrev)}</div>
      </div>

      <!-- Panier moyen -->
      <div class="kpi-card kc-a">
        <div class="kpi-icon">🛒</div>
        <div class="kpi-value" style="color:var(--amber)">${fmt(panierCur)}</div>
        <div class="kpi-label">Panier moyen</div>
        <div style="margin-top:10px">${deltaBadge(panierCur, panierPrev)}</div>
      </div>

      <!-- Meilleure progression -->
      <div class="kpi-card kc-p">
        <div class="kpi-icon">🚀</div>
        <div class="kpi-value" style="color:var(--purple);font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${bestPharmaObj ? bestPharmaObj.name.split(' ').slice(-1)[0] : '—'}
        </div>
        <div class="kpi-label">Meilleure progression</div>
        <div style="margin-top:10px">
          ${bestPharmaObj && bestGrowth > -Infinity
            ? `<span class="delta-badge ${bestGrowth >= 0 ? 'delta-pos' : 'delta-neg'}">${bestGrowth >= 0 ? '▲' : '▼'} ${Math.abs(bestGrowth).toFixed(1)}%</span>`
            : '<span class="delta-badge delta-neu">—</span>'}
        </div>
      </div>
    </div>

    <!-- Row 2 : Alertes commerciales -->
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Signaux commerciaux</div>
          <div class="card-subtitle">${curLabel} vs ${prevLabel}</div>
        </div>
        ${alerts.length ? `<span class="badge badge-rose" style="background:var(--rose-bg);color:var(--rose)">${alerts.length} signal${alerts.length > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="card-body">
        <div class="alert-feed">${alertsHtml}</div>
      </div>
    </div>

    <!-- Row 3 : Charts -->
    <div class="grid-2 fade-up">
      <div class="card">
        <div class="card-header">
          <div class="card-title">CA par pharmacie — ${curLabel}</div>
          <div class="card-subtitle">${topPh5.length} pharmacies</div>
        </div>
        <div class="card-body">
          ${topPh5.length
            ? '<div class="chart-wrap" style="height:220px"><canvas id="chart-ph-bar"></canvas></div>'
            : emptyState('📊','Aucune donnée','Importez des fichiers Excel')}
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Répartition par famille</div>
          <div class="card-subtitle">${curLabel}</div>
        </div>
        <div class="card-body">
          ${catRows.length
            ? '<div class="chart-wrap" style="height:220px"><canvas id="chart-cat-donut"></canvas></div>'
            : emptyState('📊','Aucune donnée','Importez des fichiers Excel')}
        </div>
      </div>
    </div>

    <!-- Row 4 : Top tables -->
    <div class="grid-2 fade-up">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Top 5 pharmacies</div>
          <div class="card-subtitle">${curLabel}</div>
        </div>
        ${top5PhHtml
          ? `<div style="overflow-x:auto"><table class="data-table">
              <thead><tr>
                <th>#</th><th>Pharmacie</th>
                <th style="text-align:right">CA</th>
                <th style="text-align:right">Delta MoM</th>
                <th style="text-align:right">Statut</th>
              </tr></thead>
              <tbody>${top5PhHtml}</tbody>
            </table></div>`
          : emptyState('🏥','Aucune pharmacie','Importez des fichiers')}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Top 5 produits</div>
          <div class="card-subtitle">${curLabel}</div>
        </div>
        ${top5ProdHtml
          ? `<div style="overflow-x:auto"><table class="data-table">
              <thead><tr>
                <th>#</th><th>Désignation</th>
                <th style="text-align:right">Qté</th>
                <th style="text-align:right">CA HT</th>
                <th>Famille</th>
              </tr></thead>
              <tbody>${top5ProdHtml}</tbody>
            </table></div>`
          : emptyState('💊','Aucun produit','Importez des fichiers')}
      </div>
    </div>
  `;

  setTimeout(() => {
    // Bar chart pharmacies — horizontal
    if (topPh5.length) {
      const ctx = document.getElementById('chart-ph-bar');
      if (ctx) {
        if (state.charts['ph-bar']) state.charts['ph-bar'].destroy();
        const sorted = [...topPh5].sort((a,b) => a.ca - b.ca);
        state.charts['ph-bar'] = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: sorted.map(p => p.pharma.name),
            datasets: [{
              data: sorted.map(p => +p.ca.toFixed(2)),
              backgroundColor: sorted.map(p => p.pharma.color + 'CC'),
              borderColor:     sorted.map(p => p.pharma.color),
              borderWidth: 2, borderRadius: 6,
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.x) } } },
            scales: {
              x: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { color: '#64748B', font: { size: 11 }, callback: v => fmt(v) } },
              y: { grid: { display: false }, ticks: { color: '#0F172A', font: { size: 12, weight: '600' } } },
            }
          }
        });
      }
    }

    // Donut catégories
    if (catRows.length) {
      const ctx2 = document.getElementById('chart-cat-donut');
      if (ctx2) {
        if (state.charts['cat-donut']) state.charts['cat-donut'].destroy();
        const totalCA = sumCA(salesCur);
        state.charts['cat-donut'] = new Chart(ctx2, {
          type: 'doughnut',
          data: {
            labels: catRows.map(c => c.label),
            datasets: [{
              data: catRows.map(c => +c.ca.toFixed(2)),
              backgroundColor: catRows.map(c => c.color + 'CC'),
              borderColor:     catRows.map(c => c.color),
              borderWidth: 2,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { color: '#64748B', font: { size: 11 }, boxWidth: 12, padding: 10 } },
              tooltip: { callbacks: { label: c => ` ${fmt(c.parsed)} (${totalCA > 0 ? (c.parsed / totalCA * 100).toFixed(1) : 0}%)` } },
            },
            cutout: '65%',
          }
        });
      }
    }
  }, 50);
}

// ── PHARMACIES ────────────────────────────────
let pharmaSearch  = '';
let pharmaFilter  = 'all'; // 'all' | 'up' | 'flat' | 'down'

function renderPharmacies() {
  const allSalesRaw = getSales();
  const { year: curY, month: curM } = getCurrentPeriod(allSalesRaw);
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);

  const salesCur  = curY  ? getSales({ year: curY,  month: curM  }) : [];
  const salesPrev = prevY ? getSales({ year: prevY, month: prevM }) : [];

  // Construire liste enrichie de toutes les pharmacies avec CA et delta
  let enriched = state.pharmacies.map(ph => {
    const caCur  = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
    const caPrev = sumCA(salesPrev.filter(s => s.pharmacyId === ph.id));
    const g      = caPrev > 0 ? (caCur - caPrev) / caPrev * 100 : null;
    const status = g === null ? 'new' : g > 20 ? 'up' : g >= -5 ? 'flat' : 'down';
    return { ph, caCur, caPrev, g, status };
  }).filter(e => e.caCur > 0 || e.caPrev > 0);

  // Filtre texte
  if (pharmaSearch) {
    const q = pharmaSearch.toLowerCase();
    enriched = enriched.filter(e => e.ph.name.toLowerCase().includes(q));
  }

  // Filtre statut
  if (pharmaFilter !== 'all') {
    enriched = enriched.filter(e => {
      if (pharmaFilter === 'up')   return e.g !== null && e.g > 20;
      if (pharmaFilter === 'flat') return e.g !== null && e.g >= -5 && e.g <= 20;
      if (pharmaFilter === 'down') return e.g !== null && e.g < -5;
      return true;
    });
  }

  // Tri CA courant décroissant
  enriched.sort((a, b) => b.caCur - a.caCur);

  const maxCA = Math.max(...enriched.map(e => e.caCur), 1);

  const filterDefs = [
    { key: 'all',  label: 'Toutes' },
    { key: 'up',   label: 'En croissance' },
    { key: 'flat', label: 'Stable' },
    { key: 'down', label: 'En baisse' },
  ];

  const filterBarHtml = `
    <div class="filter-bar">
      ${filterDefs.map(f => `
        <button class="filter-chip ${pharmaFilter === f.key ? 'active' : ''}"
          onclick="pharmaFilter='${f.key}';renderPharmacies()">${f.label}</button>`
      ).join('')}
    </div>`;

  const listHtml = enriched.length
    ? enriched.map((e, i) => {
        const { ph, caCur, caPrev, g, status } = e;
        const chipHtml = status === 'up'   ? '<span class="status-chip status-up">● Croissance</span>'
                       : status === 'flat' ? '<span class="status-chip status-flat">● Stable</span>'
                       : status === 'down' ? '<span class="status-chip status-down">● Baisse</span>'
                       :                    '<span class="status-chip status-flat">● Nouveau</span>';
        return `
          <div class="pharma-item" onclick="showPharmaDetail('${ph.id}')">
            <div class="rank ${i < 3 ? ['rank-1','rank-2','rank-3'][i] : 'rank-n'}">${i < 3 ? '🥇🥈🥉'[i] : i+1}</div>
            <div class="pharma-dot" style="background:${ph.color}"></div>
            <div class="pharma-info">
              <div class="pharma-name">${ph.name}</div>
              <div class="pharma-meta" style="display:flex;align-items:center;gap:8px;margin-top:4px">
                ${chipHtml}
                ${g !== null ? deltaBadge(caCur, caPrev) : ''}
              </div>
            </div>
            <div style="flex:1;max-width:120px;padding:0 12px">${renderProgress(caCur, maxCA, ph.color)}</div>
            <div class="pharma-stats">
              <div class="pharma-ca">${fmt(caCur)}</div>
              <div class="pharma-qte">CA net HT</div>
            </div>
            <div style="color:var(--text3);font-size:16px">›</div>
          </div>`;
      }).join('')
    : emptyState('🏥',
        pharmaSearch ? 'Aucun résultat' : 'Aucune pharmacie',
        pharmaSearch ? 'Essayez un autre terme' : 'Importez des fichiers Excel pour voir vos pharmacies');

  document.getElementById('pharma-content').innerHTML = `
    <div class="card fade-in">
      <div class="card-header">
        <div>
          <div class="card-title">Pharmacies (${enriched.length})</div>
          <div class="card-subtitle">${curY ? `Mois courant : ${monthName(curM)} ${curY}` : 'Aucune donnée'}</div>
        </div>
        <div class="search-wrap" style="width:240px">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Rechercher..." value="${pharmaSearch}"
            oninput="pharmaSearch=this.value;renderPharmacies()" />
        </div>
      </div>
      <div style="padding:12px 24px 0">${filterBarHtml}</div>
      ${listHtml}
    </div>

    ${renderProspects(pharmaSearch)}
  `;
}

function renderProspects(search = '') {
  if (typeof CLIENTS === 'undefined' || !CLIENTS.length) return '';
  const activeNames = new Set(state.pharmacies.map(p => p.name.toUpperCase().trim()));

  let prospects = CLIENTS.filter(c => {
    if (!c.nom) return false;
    if (activeNames.has(c.nom.toUpperCase().trim())) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.nom.toLowerCase().includes(q) || c.ville.toLowerCase().includes(q) || c.cp.includes(q);
    }
    return true;
  }).sort((a, b) => (b.potentielGx || 0) - (a.potentielGx || 0));

  if (!prospects.length) return '';

  const rows = prospects.slice(0, 20).map(c => {
    const gxBadge = c.potentielGx > 0
      ? `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:var(--blue-bg);color:var(--blue);font-weight:600">Gx ${fmt(c.potentielGx)}</span>`
      : '';
    const pelgrazBadge = c.pelgraz && c.pelgraz !== '0'
      ? `<span title="Cibles Pelgraz" style="font-size:10px;padding:2px 7px;border-radius:12px;background:var(--purple-bg);color:var(--purple)">Pelgraz ×${c.pelgraz}</span>`
      : '';
    const ca23 = c.ca2023 > 0 ? `<span style="font-size:11px;color:var(--text3)">CA 2023: ${fmt(c.ca2023)}</span>` : '';
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:10px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">🏥</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${c.nom}</div>
        <div style="font-size:11px;color:var(--text3)">${c.cp} ${c.ville}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        ${gxBadge}${pelgrazBadge}${ca23}
        <span style="font-size:10px;padding:2px 8px;border-radius:12px;background:var(--bg3);color:var(--text3);border:1px solid var(--border2)">Prospect</span>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="card fade-in" style="margin-top:20px">
      <div class="card-header">
        <div>
          <div class="card-title">Prospects secteur (${prospects.length})</div>
          <div class="card-subtitle">Pharmacies du secteur sans commande importée · triées par potentiel Gx</div>
        </div>
        <span class="badge" style="background:var(--blue-bg);color:var(--blue)">${prospects.length} prospects</span>
      </div>
      ${rows}
      ${prospects.length > 20 ? `<div style="padding:12px 20px;font-size:12px;color:var(--text3);text-align:center">${prospects.length - 20} autres prospects — utilisez la recherche pour filtrer</div>` : ''}
    </div>`;
}

function showPharmaDetail(pharmacyId) {
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) return;

  // ── Périodes clés ─────────────────────────────
  const allPhSales = getSales({ pharmacyId: pharma.id });
  const { year: curY, month: curM } = getCurrentPeriod(allPhSales.length ? allPhSales : getSales());
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);

  const salesCur  = curY  ? getSales({ pharmacyId: pharma.id, year: curY,  month: curM  }) : [];
  const salesPrev = prevY ? getSales({ pharmacyId: pharma.id, year: prevY, month: prevM }) : [];

  const caCur    = sumCA(salesCur);
  const caPrev   = sumCA(salesPrev);
  const margeCur = sumMarge(salesCur);
  const mpctCur  = margePct(salesCur);
  const qteCur   = sumQte(salesCur);

  // Nb produits commandés ce mois / panier moyen produit
  const nRefCur = new Set(salesCur.map(s => s.artCode)).size;
  const panierProdCur = nRefCur > 0 ? caCur / nRefCur : 0;

  // % du secteur
  const sectorSalesCur = curY ? getSales({ year: curY, month: curM }) : [];
  const sectorCA       = sumCA(sectorSalesCur);
  const pctOfSector    = sectorCA > 0 ? caCur / sectorCA * 100 : 0;

  // Opportunités : produits IP jamais commandés par cette pharmacie
  const allPhCodes = new Set(allPhSales.map(s => (s.artCode || '').toLowerCase().trim()));
  let oppsHtml = '';
  if (typeof BENCHMARK !== 'undefined') {
    const opps = BENCHMARK
      .filter(b => {
        const code = (b.cip13 || b.designation || '').toLowerCase().trim();
        return !allPhCodes.has(code);
      })
      .sort((a,b) => (b.rot_pharma_jan26 || 0) - (a.rot_pharma_jan26 || 0))
      .slice(0, 8);
    if (opps.length) {
      oppsHtml = `
        <div class="card fade-up">
          <div class="card-header">
            <div class="card-title">Opportunités produits</div>
            <div class="card-subtitle">Produits IP non encore commandés par cette pharmacie</div>
          </div>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead><tr>
                <th>#</th>
                <th>Désignation</th>
                <th style="text-align:right">Rot./pharma/mois</th>
                <th style="text-align:right">CA IP</th>
                <th>Cat.</th>
              </tr></thead>
              <tbody>
                ${opps.map((b, i) => {
                  const catColors = { pp:'#34D399', mi:'#FFB020', ch:'#FF4D6D', froid:'#00C6FF', nr:'#FF6B35', biosim:'#9B5CFF', generique:'#00E5A0' };
                  const cc = catColors[b.categorie] || '#8899BB';
                  const rotColor = b.rot_pharma_jan26 > 10 ? 'var(--mint)' : b.rot_pharma_jan26 > 1 ? 'var(--amber)' : 'var(--text3)';
                  return `<tr>
                    <td>${renderRank(i)}</td>
                    <td class="td-name">${b.designation}</td>
                    <td class="td-num" style="text-align:right;color:${rotColor}">${b.has_ameli ? b.rot_pharma_jan26.toFixed(1) : '—'}</td>
                    <td class="td-num" style="text-align:right">${fmt(b.ip_ca)}</td>
                    <td><span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${cc}22;color:${cc}">${(b.categorie||'').toUpperCase()}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    }
  }

  // ── Period chips ─────────────────────────────
  const pharmaPeriods = [...new Set(
    allPhSales.map(s => `${s.year}-${String(s.month).padStart(2,'0')}`)
  )].sort();

  const pharmaPeriodChips = pharmaPeriods.length > 1 ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
      ${pharmaPeriods.map(p => {
        const [ky,km] = p.split('-');
        const active = p === `${curY}-${String(curM).padStart(2,'0')}`;
        return `<button onclick="showPharmaDetail('${pharmacyId}')" style="
          padding:5px 14px;border-radius:20px;border:1px solid ${active ? 'var(--blue)' : 'var(--border2)'};
          background:${active ? 'var(--blue-bg)' : 'transparent'};color:${active ? 'var(--blue)' : 'var(--text2)'};
          cursor:pointer;font-size:12px;font-weight:${active ? '600' : '400'};white-space:nowrap;transition:all .15s
        ">${monthName(+km)+' '+ky}</button>`;
      }).join('')}
    </div>` : '';

  // ── Top produits mois courant ─────────────────
  const top = topProducts(salesCur.length ? salesCur : allPhSales, 15);
  const topHtml = top.map((p,i) => {
    const cat  = CATS[p.cat] || CATS.mi;
    const taux = (p.ca + p.marge) > 0 ? p.marge / (p.ca + p.marge) * 100 : 0;
    return `<tr>
      <td>${renderRank(i)}</td>
      <td class="td-name">${p.name}</td>
      <td><span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${cat.color}22;color:${cat.color}">${cat.label}</span></td>
      <td class="td-num" style="text-align:right">${fmtNum(Math.round(p.qte))}</td>
      <td class="td-num" style="text-align:right">${fmt(p.ca)}</td>
      <td class="td-num" style="text-align:right;color:var(--mint)">${fmt(p.marge)}</td>
      <td class="td-num" style="text-align:right;color:${taux>15?'var(--mint)':'var(--amber)'}">${taux.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  // ── Imports ───────────────────────────────────
  const imports    = state.imports.filter(i => i.pharmacyId === pharma.id).sort((a,b) => new Date(b.importedAt) - new Date(a.importedAt));
  const importsHtml = imports.map(imp => `
    <tr>
      <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${imp.filename}</td>
      <td class="td-num">${imp.month ? monthName(imp.month)+' '+imp.year : '—'}</td>
      <td style="color:var(--text3);font-size:12px">${new Date(imp.importedAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</td>
      <td><button class="btn btn-ghost" style="color:var(--rose);border-color:rgba(255,77,109,.3);padding:4px 10px;font-size:12px" onclick="deleteImport('${imp.id}','${pharmacyId}')">🗑 Supprimer</button></td>
    </tr>`).join('');

  // ── Monthly evolution ─────────────────────────
  const pharmaByMonth = caByMonth(allPhSales);

  const curLabel  = curY  ? `${monthName(curM)} ${curY}`   : '—';
  const prevLabel = prevY ? `${monthName(prevM)} ${prevY}` : '—';

  document.getElementById('pharma-content').innerHTML = `
    <div class="fade-up">

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="renderPharmacies()">← Retour</button>
        <div style="width:14px;height:14px;border-radius:50%;background:${pharma.color}"></div>
        <span class="section-title" style="margin:0;flex:1">${pharma.name}</span>
        <span class="badge badge-blue">${pharma.code}</span>
        <button class="btn btn-ghost" style="color:var(--rose);border-color:rgba(255,77,109,.3)" onclick="deletePharmacy('${pharma.id}')">🗑 Supprimer la pharmacie</button>
      </div>

      ${pharmaPeriodChips}

      <!-- Hero KPI -->
      <div class="kpi-grid fade-up" style="grid-template-columns:2fr 1fr 1fr 1fr;margin-bottom:24px">
        <div class="kpi-card kpi-hero">
          <div class="kpi-icon">💰</div>
          <div class="kpi-value">${fmt(caCur)}</div>
          <div class="kpi-label">CA Net HT — ${curLabel}</div>
          <div style="margin-top:12px;display:flex;align-items:center;gap:8px">
            ${deltaBadge(caCur, caPrev)}
            <span style="font-size:11px;color:rgba(255,255,255,0.55)">vs ${prevLabel}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:rgba(255,255,255,0.5)">${pctOfSector.toFixed(1)}% du secteur</div>
        </div>
        <div class="kpi-card kc-a">
          <div class="kpi-icon">🛒</div>
          <div class="kpi-value" style="color:var(--amber)">${fmt(panierProdCur)}</div>
          <div class="kpi-label">Panier moy / produit</div>
        </div>
        <div class="kpi-card kc-b">
          <div class="kpi-icon">💊</div>
          <div class="kpi-value" style="color:var(--blue)">${nRefCur}</div>
          <div class="kpi-label">Produits commandés</div>
        </div>
        <div class="kpi-card kc-g">
          <div class="kpi-icon">📈</div>
          <div class="kpi-value" style="color:var(--mint)">${fmt(margeCur)}</div>
          <div class="kpi-label">Marge brute</div>
          <div style="margin-top:8px;font-size:11px;color:var(--text3)">${mpctCur.toFixed(1)}% taux</div>
        </div>
      </div>

      ${pharmaByMonth.length > 1 ? `
      <div class="card fade-up">
        <div class="card-header">
          <div class="card-title">Évolution CA mensuelle</div>
          <div class="card-subtitle">${pharmaByMonth.length} période(s)</div>
        </div>
        <div class="card-body">
          <div class="chart-wrap"><canvas id="chart-pharma-month"></canvas></div>
        </div>
      </div>` : ''}

      <div class="card fade-up">
        <div class="card-header">
          <div class="card-title">Top Produits — ${curLabel}</div>
          <div class="badge badge-blue">${top.length} produits</div>
        </div>
        ${top.length ? `<div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr>
              <th>#</th><th>Désignation</th><th>Famille</th>
              <th style="text-align:right">Unités</th>
              <th style="text-align:right">CA HT</th>
              <th style="text-align:right">Marge</th>
              <th style="text-align:right">Taux</th>
            </tr></thead>
            <tbody>${topHtml}</tbody>
          </table>
        </div>` : emptyState('💊','Aucune donnée','Importez un fichier pour cette pharmacie')}
      </div>

      ${oppsHtml}

      ${imports.length ? `
      <div class="card fade-up">
        <div class="card-header"><div class="card-title">Historique des imports</div></div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Fichier</th><th>Période</th><th>Date</th><th></th></tr></thead>
            <tbody>${importsHtml}</tbody>
          </table>
        </div>
      </div>` : ''}

    </div>
  `;

  if (pharmaByMonth.length > 1) {
    setTimeout(() => {
      const ctx = document.getElementById('chart-pharma-month');
      if (ctx) {
        if (state.charts['pharma-month']) state.charts['pharma-month'].destroy();
        state.charts['pharma-month'] = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: pharmaByMonth.map(([k]) => { const [y,m] = k.split('-'); return `${monthName(+m)} ${y}`; }),
            datasets: [{
              label: 'CA Net HT (€)',
              data: pharmaByMonth.map(([,v]) => +v.toFixed(2)),
              backgroundColor: pharma.color + '33',
              borderColor: pharma.color,
              borderWidth: 2, borderRadius: 8,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { color: '#64748B', font: { size: 11 } } },
              y: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { color: '#64748B', font: { size: 11 }, callback: v => fmt(v) } },
            }
          }
        });
      }
    }, 50);
  }
}

async function deleteImport(importId, pharmacyId) {
  if (!confirm('Supprimer cet import et toutes ses lignes de vente ?')) return;
  const { error } = await sb.from('imports').delete().eq('id', importId);
  if (error) { showToast('Erreur suppression', 'error'); return; }
  state.imports = state.imports.filter(i => i.id !== importId);
  state.sales   = state.sales.filter(s => s.importId !== importId);
  showToast('Import supprimé', 'success');
  updateNavBadge();
  showPharmaDetail(pharmacyId);
}

async function deleteImportFromHistory(importId, pharmacyId) {
  if (!confirm('Supprimer cet import et toutes ses ventes ?')) return;
  const { error } = await sb.from('imports').delete().eq('id', importId);
  if (error) { showToast('Erreur suppression', 'error'); return; }
  state.imports = state.imports.filter(i => i.id !== importId);
  state.sales   = state.sales.filter(s => s.importId !== importId);
  showToast('Import supprimé', 'success');
  updateNavBadge();
  renderImport(); // re-render the page
}

async function deletePharmacy(pharmacyId) {
  const pharma = state.pharmacies.find(p => p.id === pharmacyId);
  if (!confirm(`Supprimer "${pharma?.name}" et toutes ses données ?`)) return;
  const { error } = await sb.from('pharmacies').delete().eq('id', pharmacyId);
  if (error) { showToast('Erreur suppression', 'error'); return; }
  state.pharmacies = state.pharmacies.filter(p => p.id !== pharmacyId);
  state.imports    = state.imports.filter(i => i.pharmacyId !== pharmacyId);
  state.sales      = state.sales.filter(s => s.pharmacyId !== pharmacyId);
  showToast(`${pharma?.name} supprimée`, 'success');
  updateNavBadge();
  renderPharmacies();
}

// ── PRODUITS ──────────────────────────────────
let prodSearch  = '';
let prodFamille = 'tous';
let prodSortCol = 'ca';
let prodSortAsc = false;

function renderProduits() {
  const sales = getSales();
  let all = topProducts(sales, 500);

  // Filtre texte
  if (prodSearch) {
    const q = prodSearch.toLowerCase();
    all = all.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }

  // Filtre famille (froid = filtre transversal par indicateur)
  if (prodFamille === 'froid') {
    all = all.filter(p => p.froid);
  } else if (prodFamille !== 'tous') {
    all = all.filter(p => p.cat === prodFamille);
  }

  // Enrichir avec taux pour le tri
  all = all.map(p => ({
    ...p,
    taux: (p.ca + p.marge) > 0 ? p.marge / (p.ca + p.marge) * 100 : 0,
  }));

  // Tri
  all.sort((a, b) => {
    let av = a[prodSortCol] ?? 0;
    let bv = b[prodSortCol] ?? 0;
    return prodSortAsc ? av - bv : bv - av;
  });

  const maxCA = Math.max(...all.map(p => p.ca), 1);

  // Chips famille (froid = indicateur ❄️ uniquement, pas de chip standalone)
  const familles = [
    { key: 'tous',      label: 'Tous',       color: '#8899BB' },
    { key: 'pp',        label: 'PP',         color: CATS.pp.color },
    { key: 'mi',        label: 'MI',         color: CATS.mi.color },
    { key: 'ch',        label: 'CH',         color: CATS.ch.color },
    { key: 'biosim',    label: 'Biosim',     color: CATS.biosim.color },
    { key: 'generique', label: 'Générique',  color: CATS.generique.color },
    { key: 'nr',        label: 'NR',         color: CATS.nr.color },
    { key: 'froid',     label: '❄️ Froid',   color: '#00C6FF' },
  ];

  const chipsHtml = familles.map(f => {
    const active = prodFamille === f.key;
    return `<button onclick="prodFamille='${f.key}';renderProduits()" style="
      padding:5px 14px;border-radius:20px;border:1px solid ${active ? f.color : 'var(--border2)'};
      background:${active ? f.color + '22' : 'transparent'};color:${active ? f.color : 'var(--text2)'};
      cursor:pointer;font-size:12px;font-weight:${active ? '600' : '400'};white-space:nowrap;transition:all .15s
    ">${f.label}</button>`;
  }).join('');

  // En-têtes triables
  function thSort(col, label, align = 'right') {
    const active = prodSortCol === col;
    const arrow  = active ? (prodSortAsc ? ' ↑' : ' ↓') : '';
    return `<th style="text-align:${align};cursor:pointer;user-select:none;color:${active ? 'var(--blue)' : ''}" onclick="prodSortCol='${col}';prodSortAsc=${active ? !prodSortAsc : false};renderProduits()">${label}${arrow}</th>`;
  }

  const rowsHtml = all.map((p, i) => {
    const cat  = CATS[p.cat] || CATS.mi;
    const taux = p.taux;
    const froidBadge = p.froid ? ' <span title="Produit thermosensible" style="font-size:11px;vertical-align:middle">❄️</span>' : '';
    return `<tr>
      <td>${renderRank(i)}</td>
      <td class="td-name">${p.name}${froidBadge}</td>
      <td><span class="badge badge-blue">${p.code || '—'}</span></td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${cat.color}22;color:${cat.color};white-space:nowrap">${cat.label}</span></td>
      <td class="td-num" style="text-align:right">${fmtNum(Math.round(p.qte))}</td>
      <td class="td-num" style="text-align:right;color:var(--mint)">${fmt(p.ca)}</td>
      <td class="td-num" style="text-align:right;color:var(--mint)">${fmt(p.marge)}</td>
      <td class="td-num" style="text-align:right;color:${taux > 15 ? 'var(--mint)' : 'var(--amber)'}">${taux.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  document.getElementById('prod-content').innerHTML = `
    <div class="card fade-in">
      <div class="card-header" style="flex-wrap:wrap;gap:12px">
        <div class="card-title">Catalogue produits (${all.length})</div>
        <div class="search-wrap" style="width:260px">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Nom ou code produit..." value="${prodSearch}" oninput="prodSearch=this.value;renderProduits()" />
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px 4px">
        ${chipsHtml}
      </div>
      ${all.length ? `<div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr>
            <th>#</th>
            <th>Désignation</th>
            <th>Code</th>
            <th>Famille</th>
            ${thSort('qte',   'Unités')}
            ${thSort('ca',    'CA HT')}
            ${thSort('marge', 'Marge')}
            ${thSort('taux',  'Taux marge')}
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>` : emptyState('💊', prodSearch || prodFamille !== 'tous' ? 'Aucun résultat' : 'Aucun produit', prodSearch || prodFamille !== 'tous' ? 'Essayez un autre terme ou famille' : 'Importez des fichiers Excel pour voir les produits')}
    </div>
  `;
}

// ── IMPORT ────────────────────────────────────
let pendingFiles = [];

function renderImport() {
  const recentImports = [...state.imports].sort((a,b) => new Date(b.importedAt) - new Date(a.importedAt)).slice(0, 20);

  document.getElementById('import-content').innerHTML = `
    <div class="fade-up" style="max-width:700px;margin:0 auto">
      <div class="section-title">Import de données</div>
      <div class="section-sub">Glissez vos fichiers Excel (.xlsx, .xls) — la pharmacie est détectée automatiquement depuis le nom du fichier</div>

      <div class="import-zone" id="import-zone" onclick="document.getElementById('file-input').click()" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleDrop(event)">
        <input type="file" id="file-input" accept=".xlsx,.xls" multiple onchange="handleFiles(this.files)">
        <div class="import-zone-icon">📂</div>
        <div class="import-zone-title">Glissez vos fichiers ici</div>
        <div class="import-zone-sub">Formats acceptés : <code style="background:var(--bg3);padding:2px 6px;border-radius:4px">WML_MM_YYYY.xlsx</code> (multi-pharmacies) ou <code style="background:var(--bg3);padding:2px 6px;border-radius:4px">Phie de la republique 04 26.xlsx</code> (mono-pharmacie)</div>
      </div>

      <div id="pending-list" class="import-list" style="${pendingFiles.length ? '' : 'display:none'}"></div>

      ${recentImports.length ? `
      <div style="margin-top:32px">
        <div class="card-title" style="margin-bottom:12px">Historique des imports</div>
        <div class="card">
          <table class="data-table">
            <thead><tr><th>Fichier</th><th>Pharmacie</th><th>Période</th><th>Date import</th><th></th></tr></thead>
            <tbody>
              ${recentImports.map(imp => {
                const ph = state.pharmacies.find(p => p.id === imp.pharmacyId);
                return `<tr>
                  <td class="td-name" style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${imp.filename}</td>
                  <td><span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${ph?.color||'#555'}"></span>${ph?.name||'?'}</span></td>
                  <td class="td-num">${imp.month ? monthName(imp.month)+' '+imp.year : '—'}</td>
                  <td style="color:var(--text3);font-size:12px">${new Date(imp.importedAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</td>
                  <td><button class="btn btn-ghost" style="color:var(--rose);border-color:rgba(220,38,38,.2);padding:3px 10px;font-size:11px" onclick="deleteImportFromHistory('${imp.id}','${imp.pharmacyId}')">🗑</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    </div>
  `;
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('import-zone').classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
}

async function handleFiles(files) {
  const list = document.getElementById('pending-list');
  if (!list) return;
  list.style.display = 'flex';

  for (const file of Array.from(files)) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { showToast('Format non supporté : ' + file.name, 'error'); continue; }
    const itemId = 'imp-' + Math.random().toString(36).slice(2);
    list.insertAdjacentHTML('beforeend', `
      <div class="import-item" id="${itemId}">
        <div class="import-item-icon">📄</div>
        <div class="import-item-info">
          <div class="import-item-name">${file.name}</div>
          <div class="import-item-meta">Traitement en cours...</div>
        </div>
        <div class="import-item-status status-pending">En attente</div>
      </div>
    `);

    const result = await importFile(file);
    const item = document.getElementById(itemId);
    if (!item) continue;

    if (result.ok) {
      if (result.isMulti) {
        // Multi-pharmacy WML result
        const periode = result.month ? monthName(result.month) + ' ' + result.year : 'Période inconnue';
        item.querySelector('.import-item-meta').textContent =
          `${result.pharmacies.length} pharmacies · ${periode} · ${result.totalLines} lignes`;
        item.querySelector('.import-item-status').className = 'import-item-status status-ok';
        item.querySelector('.import-item-status').textContent = '✓ Importé';
        // Add navigation shortcuts after the item
        item.insertAdjacentHTML('afterend', `
          <div style="text-align:center;margin:4px 0">
            <button class="btn btn-primary" onclick="navigate('dashboard')" style="font-size:12px;padding:6px 16px">→ Voir le dashboard</button>
            <button class="btn btn-ghost" onclick="navigate('pharmacies')" style="font-size:12px;padding:6px 16px;margin-left:8px">→ Voir les pharmacies</button>
          </div>
        `);
        showToast(`${result.pharmacies.length} pharmacies · ${result.totalLines} lignes importées`, 'success');
      } else {
        // Calcul CA / Marge / Taux sur les lignes fraîchement importées
        const impSales = state.sales.filter(s =>
          s.pharmacyId === result.pharma.id && s.month === result.month && s.year === result.year);
        const impCA    = sumCA(impSales);
        const impMarge = sumMarge(impSales);
        const impTaux  = margePct(impSales);
        const periode  = result.month ? monthName(result.month) + ' ' + result.year : 'Période inconnue';
        item.querySelector('.import-item-meta').textContent =
          `${result.pharma.name} · ${periode} · ${result.count} lignes · CA: ${fmt(impCA)} · Marge: ${fmt(impMarge)} · Taux: ${impTaux.toFixed(1)}%`;
        item.querySelector('.import-item-status').className = 'import-item-status status-ok';
        item.querySelector('.import-item-status').textContent = '✓ Importé';
        showToast(`${result.pharma.name} importée — ${result.count} lignes`, 'success');
      }
    } else {
      item.querySelector('.import-item-meta').textContent = result.error;
      item.querySelector('.import-item-status').className = 'import-item-status status-err';
      item.querySelector('.import-item-status').textContent = '✗ Erreur';
      showToast(result.error, 'error');
    }
  }
  // Refresh nav badge
  updateNavBadge();
}

// ── ADMIN ─────────────────────────────────────
function renderAdmin() {
  const hasLocalData = !!(localStorage.getItem('ip_crm_pharmacies'));
  document.getElementById('admin-content').innerHTML = `
    <div class="fade-up" style="max-width:700px">
      <div class="section-title">Administration</div>
      <div class="section-sub">Gestion des accès et des données</div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div class="card-title">Utilisateurs</div></div>
        <div class="card-body">
          <p style="color:var(--text2);font-size:14px;margin:0">
            Gérer les utilisateurs depuis le
            <a href="https://supabase.com/dashboard" target="_blank" style="color:var(--blue)">dashboard Supabase</a>
            → Authentication → Users
          </p>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div class="card-title">Données Supabase</div></div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
            <div style="background:var(--glass2);border-radius:var(--rs);padding:16px;text-align:center">
              <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800">${state.pharmacies.length}</div>
              <div style="font-size:12px;color:var(--text2);margin-top:4px">Pharmacies</div>
            </div>
            <div style="background:var(--glass2);border-radius:var(--rs);padding:16px;text-align:center">
              <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800">${state.imports.length}</div>
              <div style="font-size:12px;color:var(--text2);margin-top:4px">Imports</div>
            </div>
            <div style="background:var(--glass2);border-radius:var(--rs);padding:16px;text-align:center">
              <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800">${state.sales.length}</div>
              <div style="font-size:12px;color:var(--text2);margin-top:4px">Lignes de vente</div>
            </div>
          </div>
          <button class="btn btn-ghost" onclick="resetAllData()" style="color:var(--rose);border-color:rgba(255,77,109,.3)">
            🗑 Vider toutes les données Supabase
          </button>
        </div>
      </div>

      ${hasLocalData ? `
      <div class="card" style="border-color:rgba(255,176,32,.2)">
        <div class="card-header">
          <div>
            <div class="card-title">Migration V1 → V2</div>
            <div class="card-subtitle" style="color:var(--amber)">Données localStorage détectées</div>
          </div>
        </div>
        <div class="card-body">
          <p style="color:var(--text2);font-size:14px;margin:0 0 16px">
            Des données CRM V1 sont présentes dans le stockage local du navigateur.
            Cliquez pour les migrer vers Supabase, puis elles seront supprimées.
          </p>
          <button class="btn btn-primary" onclick="migrateFromLocalStorage()">⬆ Migrer vers Supabase</button>
        </div>
      </div>` : ''}
    </div>
  `;
}

async function resetAllData() {
  if (!confirm('Supprimer TOUTES les données Supabase ?\nPharmacies, imports et ventes seront effacés définitivement.')) return;
  await sb.from('pharmacies').delete().not('id', 'is', null);
  state.pharmacies = []; state.imports = []; state.sales = [];
  showToast('Toutes les données ont été supprimées', 'success');
  updateNavBadge();
  renderAdmin();
}

async function migrateFromLocalStorage() {
  const rawPharmas  = JSON.parse(localStorage.getItem('ip_crm_pharmacies') || '[]');
  const rawImports  = JSON.parse(localStorage.getItem('ip_crm_imports')    || '[]');
  const rawSales    = JSON.parse(localStorage.getItem('ip_crm_sales')      || '[]');
  if (!rawPharmas.length) { showToast('Aucune donnée locale à migrer', 'info'); return; }

  showToast('Migration en cours…', 'info');
  const idMap = {};

  // Insert pharmacies
  for (const p of rawPharmas) {
    const existing = state.pharmacies.find(ep => ep.name.toLowerCase() === p.name.toLowerCase());
    if (existing) { idMap[p.id] = existing.id; continue; }
    const color = PHARMA_COLORS[state.pharmacies.length % PHARMA_COLORS.length];
    const { data, error } = await sb.from('pharmacies').insert({ name: p.name, code: p.code || p.name.slice(0,4).toUpperCase(), color: p.color || color }).select().single();
    if (error) { showToast('Erreur migration pharmacies', 'error'); return; }
    idMap[p.id] = data.id;
    state.pharmacies.push({ id: data.id, name: data.name, code: data.code, color: data.color });
  }

  // Insert imports + sales
  for (const imp of rawImports) {
    const newPhId = idMap[imp.pharmacyId];
    if (!newPhId) continue;
    const { data: newImp, error: impErr } = await sb.from('imports')
      .insert({ pharmacy_id: newPhId, month: imp.month, year: imp.year, filename: imp.filename || 'migration-v1', imported_by: state.user.id })
      .select().single();
    if (impErr) continue;
    idMap[imp.id] = newImp.id;
    state.imports.unshift({ id: newImp.id, pharmacyId: newPhId, month: newImp.month, year: newImp.year, filename: newImp.filename, importedAt: newImp.imported_at });

    const impSales = rawSales.filter(s => String(s.importId) === String(imp.id)).map(s => ({
      import_id: newImp.id, pharmacy_id: newPhId, month: imp.month, year: imp.year,
      art_designation: s.artDesignation, art_code: s.artCode, art_id: s.artId,
      qte: s.qte||0, pu_brut: s.puBrut||0, pu_net: s.puNet||0, mnt_net_ht: s.mntNetHt||0,
    }));
    const BATCH = 500;
    for (let i = 0; i < impSales.length; i += BATCH) {
      const { data: batch, error: sErr } = await sb.from('sales').insert(impSales.slice(i, i + BATCH)).select();
      if (!sErr && batch) state.sales.push(...batch.map(s => ({
        id: s.id, importId: s.import_id, pharmacyId: s.pharmacy_id,
        month: s.month, year: s.year,
        artDesignation: s.art_designation, artCode: s.art_code, artId: s.art_id,
        qte: parseFloat(s.qte)||0, puBrut: parseFloat(s.pu_brut)||0,
        puNet: parseFloat(s.pu_net)||0, mntNetHt: parseFloat(s.mnt_net_ht)||0,
      })));
    }
  }

  localStorage.removeItem('ip_crm_pharmacies');
  localStorage.removeItem('ip_crm_imports');
  localStorage.removeItem('ip_crm_sales');
  showToast(`Migration terminée — ${rawPharmas.length} pharmacie(s), ${rawImports.length} import(s)`, 'success');
  updateNavBadge();
  renderAdmin();
}

// ── BENCHMARK ─────────────────────────────────
let benchCat = 'tous';
let benchSearch = '';
let benchSortCol = 'ip_qty';
let benchSortAsc = false;

function renderBenchmark() {
  if (typeof BENCHMARK === 'undefined') {
    document.getElementById('bench-content').innerHTML = emptyState('📊', 'Données non chargées', 'benchmark-data.js manquant');
    return;
  }

  // Filter
  let data = [...BENCHMARK];
  if (benchCat !== 'tous') data = data.filter(d => d.categorie === benchCat);
  if (benchSearch) {
    const q = benchSearch.toLowerCase();
    data = data.filter(d => d.designation.toLowerCase().includes(q));
  }

  // Sort
  data.sort((a, b) => {
    const av = a[benchSortCol] ?? 0, bv = b[benchSortCol] ?? 0;
    return benchSortAsc ? av - bv : bv - av;
  });

  // Stats globales
  const totalIPQty = BENCHMARK.reduce((s, d) => s + d.ip_qty, 0);
  const totalIPCa  = BENCHMARK.reduce((s, d) => s + d.ip_ca, 0);
  const withAmeli  = BENCHMARK.filter(d => d.has_ameli).length;
  const cats = [
    { key: 'tous', label: 'Tous' },
    { key: 'pp',   label: 'PP <4.8€' },
    { key: 'mi',   label: 'Médian' },
    { key: 'ch',   label: '>480€' },
    { key: 'froid',label: 'Froid' },
    { key: 'nr',   label: 'Med010' },
  ];

  const chipsHtml = cats.map(c => {
    const active = benchCat === c.key;
    return `<button onclick="benchCat='${c.key}';renderBenchmark()" style="
      padding:5px 14px;border-radius:20px;border:1px solid ${active ? 'var(--blue)' : 'var(--border2)'};
      background:${active ? 'var(--blue-bg)' : 'transparent'};color:${active ? 'var(--blue)' : 'var(--text2)'};
      cursor:pointer;font-size:12px;font-weight:${active ? '600' : '400'};white-space:nowrap;transition:all .15s
    ">${c.label}</button>`;
  }).join('');

  function thB(col, label, align='right') {
    const active = benchSortCol === col;
    const arrow = active ? (benchSortAsc ? ' ↑' : ' ↓') : '';
    return `<th style="text-align:${align};cursor:pointer;user-select:none;color:${active?'var(--blue)':''}" onclick="benchSortCol='${col}';benchSortAsc=${active?!benchSortAsc:false};renderBenchmark()">${label}${arrow}</th>`;
  }

  const rowsHtml = data.slice(0, 200).map((d, i) => {
    const rotColor = d.rot_pharma_jan26 > 10 ? 'var(--mint)' : d.rot_pharma_jan26 > 1 ? 'var(--amber)' : 'var(--text3)';
    const catColors = { pp:'#34D399', mi:'#FFB020', ch:'#FF4D6D', froid:'#00C6FF', nr:'#FF6B35', biosim:'#9B5CFF', generique:'#00E5A0' };
    const cc = catColors[d.categorie] || '#8899BB';
    const froidTag = isFroidBench(d) ? ' <span title="Thermosensible" style="font-size:11px">❄️</span>' : '';
    const yoy = d.yoy_jan != null
      ? `<span style="font-size:11px;font-weight:600;color:${d.yoy_jan > 5 ? 'var(--mint)' : d.yoy_jan < -5 ? 'var(--rose)' : 'var(--text3)'}">${d.yoy_jan > 0 ? '▲' : '▼'} ${Math.abs(d.yoy_jan).toFixed(0)}%</span>`
      : '<span style="color:var(--text4);font-size:11px">—</span>';
    const prixDisplay = d.prix_ip > 0
      ? `<span style="font-size:11px;color:var(--blue)">${fmt(d.prix_ip)}</span>`
      : '<span style="color:var(--text4);font-size:11px">—</span>';
    return `<tr>
      <td style="color:var(--text3);font-size:12px">${d.ip_rank_qty}</td>
      <td class="td-name" style="font-size:13px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.designation}${froidTag}</td>
      <td><span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${cc}22;color:${cc}">${d.categorie.toUpperCase()}</span></td>
      <td class="td-num" style="text-align:right">${fmtNum(d.ip_qty)}</td>
      <td class="td-num" style="text-align:right">${fmt(d.ip_ca)}</td>
      <td style="text-align:right">${prixDisplay}</td>
      <td class="td-num" style="text-align:right;color:${rotColor}">${d.has_ameli ? d.rot_pharma_jan26.toFixed(1) : '—'}</td>
      <td style="text-align:right">${yoy}</td>
      <td style="text-align:right;font-size:11px;color:var(--text3)">${d.has_ameli ? fmtNum(d.ameli_jan26) : '—'}</td>
    </tr>`;
  }).join('');

  document.getElementById('bench-content').innerHTML = `
    <div class="fade-up">
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:28px">
        <div class="kpi-card kc-b">
          <div class="kpi-icon">📦</div>
          <div class="kpi-value">${fmtNum(totalIPQty)}</div>
          <div class="kpi-label">Unités IP totales</div>
        </div>
        <div class="kpi-card kc-g">
          <div class="kpi-icon">💰</div>
          <div class="kpi-value">${fmt(totalIPCa)}</div>
          <div class="kpi-label">CA IP total</div>
        </div>
        <div class="kpi-card kc-p">
          <div class="kpi-icon">🔗</div>
          <div class="kpi-value">${withAmeli}/${BENCHMARK.length}</div>
          <div class="kpi-label">Produits matchés Ameli</div>
        </div>
      </div>

      <div class="card fade-up">
        <div class="card-header" style="flex-wrap:wrap;gap:12px">
          <div>
            <div class="card-title">TOP Rotations IP × Ameli France</div>
            <div class="card-subtitle">Rotation nationale = boîtes remboursées Jan 2026 ÷ 19 000 pharmacies</div>
          </div>
          <div class="search-wrap" style="width:260px">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Rechercher un produit..." value="${benchSearch}"
              oninput="benchSearch=this.value;renderBenchmark()" />
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px 4px">${chipsHtml}</div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr>
              ${thB('ip_rank_qty','Rang','left')}
              <th>Produit</th>
              <th>Cat.</th>
              ${thB('ip_qty','Qté IP')}
              ${thB('ip_ca','CA IP')}
              <th style="text-align:right">Prix IP</th>
              ${thB('rot_pharma_jan26','Rot./pharma/mois')}
              ${thB('yoy_jan','YoY Jan')}
              <th style="text-align:right">France Jan26</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${data.length > 200 ? `<div style="padding:12px 20px;font-size:12px;color:var(--text3)">Affichage limité à 200 résultats — utilisez la recherche ou les filtres.</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ── NAV ───────────────────────────────────────
function navigate(page) {
  state.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === `page-${page}`));

  const titles = {
    dashboard:  'Dashboard',
    pharmacies: 'Pharmacies',
    produits:   'Analyse Portefeuille',
    catalogue:  'Catalogue IP',
    import:     'Import',
    admin:      'Administration',
    benchmark:  'Benchmark Marché',
    simulateur: 'Simulateur de panier',
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  const fab = document.getElementById('cat-cart-fab');
  if (fab) fab.style.setProperty('display', page === 'catalogue' ? '' : 'none', 'important');

  const renders = {
    dashboard:  renderDashboard,
    pharmacies: renderPharmacies,
    produits:   renderProduits,
    catalogue:  renderCatalogue,
    import:     renderImport,
    admin:      renderAdmin,
    benchmark:  renderBenchmark,
    simulateur: renderSimulator,
  };
  if (renders[page]) renders[page]();
}

function updateNavBadge() {
  const badge = document.getElementById('import-badge');
  if (badge) badge.textContent = state.imports.length;
}

// ── TOAST ─────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  t.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ── SIMULATEUR ────────────────────────────────
let simSearchQuery = '';

function simProductList() {
  if (typeof BENCHMARK !== 'undefined' && BENCHMARK.length) {
    return BENCHMARK.map(b => ({
      designation: b.designation,
      code:        b.cip13 || '',
      cat:         b.categorie === 'froid' ? 'mi' : (b.categorie || 'mi'),
      froid:       isFroidBench(b),
      puNet:       b.ip_qty > 0 ? b.ip_ca / b.ip_qty : 0,
      rot:         b.rot_pharma_jan26 || 0,
      hasAmeli:    b.has_ameli,
    }));
  }
  // Fallback: produits des ventes en mémoire
  const map = {};
  for (const s of state.sales) {
    const k = s.artCode || s.artDesignation;
    if (!map[k]) map[k] = {
      designation: s.artDesignation, code: s.artCode,
      cat: classifyProduct(s), froid: isFroid(s), puNet: s.puNet, rot: 0, hasAmeli: false,
    };
  }
  return Object.values(map);
}

function simCalc() {
  const items = state.sim.items;
  const caTotal    = items.reduce((a, it) => a + it.puNet * it.qty, 0);
  const margeTotal = items.reduce((a, it) => a + Math.max(0, (it.puBrut - it.puNet) * it.qty), 0);
  const bycat = {};
  for (const it of items) {
    const k = it.cat;
    if (!bycat[k]) bycat[k] = { ca: 0, qty: 0 };
    bycat[k].ca  += it.puNet * it.qty;
    bycat[k].qty += it.qty;
  }
  return { caTotal, margeTotal, bycat };
}

function simSuggestions(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const already = new Set(state.sim.items.map(it => it.designation.toLowerCase()));
  return simProductList()
    .filter(p => p.designation.toLowerCase().includes(q) && !already.has(p.designation.toLowerCase()))
    .sort((a, b) => b.rot - a.rot)
    .slice(0, 8);
}

function simAddProduct(idx) {
  const list = simSuggestions(simSearchQuery);
  const p    = list[idx];
  if (!p) return;
  // Si pharmacie sélectionnée : enrichir avec son puNet historique
  let puNet = p.puNet, puBrut = p.puNet * 1.05; // estimate
  if (state.sim.pharmacyId) {
    const match = state.sales
      .filter(s => s.pharmacyId === state.sim.pharmacyId && (s.artCode === p.code || s.artDesignation === p.designation))
      .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month));
    if (match.length) { puNet = match[0].puNet; puBrut = match[0].puBrut; }
  }
  state.sim.items.push({
    designation: p.designation, code: p.code, cat: p.cat, froid: p.froid,
    puNet, puBrut, qty: 1,
  });
  simSearchQuery = '';
  renderSimulator();
}

function simRemove(i) {
  state.sim.items.splice(i, 1);
  renderSimulator();
}

function simUpdateQty(i, v) {
  const qty = Math.max(0, parseFloat(v) || 0);
  state.sim.items[i].qty = qty;
  // Mise à jour partielle des totaux sans full re-render
  const { caTotal, margeTotal } = simCalc();
  const el = document.getElementById('sim-total-ca');
  if (el) el.textContent = fmt(caTotal);
  const el2 = document.getElementById('sim-total-marge');
  if (el2) el2.textContent = fmt(margeTotal);
  const el3 = document.getElementById('sim-line-' + i);
  if (el3) el3.textContent = fmt(state.sim.items[i].puNet * qty);
  updateSimBars();
}

function updateSimBars() {
  const { bycat, caTotal } = simCalc();
  const barsEl = document.getElementById('sim-bars');
  if (!barsEl) return;
  barsEl.innerHTML = Object.entries(bycat)
    .sort((a,b) => b[1].ca - a[1].ca)
    .map(([k, v]) => {
      const cat  = CATS[k] || CATS.mi;
      const pct  = caTotal > 0 ? (v.ca / caTotal * 100).toFixed(0) : 0;
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:12px;font-weight:600;color:${cat.color}">${cat.icon} ${cat.label}</span>
          <span style="font-size:12px;color:var(--text2)">${fmt(v.ca)} · ${pct}%</span>
        </div>
        <div style="height:6px;background:var(--bg3);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cat.color};border-radius:4px;transition:width .3s"></div>
        </div>
      </div>`;
    }).join('');
}

function saveSimulation() {
  const sims  = JSON.parse(localStorage.getItem('ip_crm_sims') || '[]');
  const saved = { id: Date.now(), name: state.sim.name, pharmacyId: state.sim.pharmacyId, items: state.sim.items, savedAt: new Date().toISOString() };
  sims.unshift(saved);
  localStorage.setItem('ip_crm_sims', JSON.stringify(sims.slice(0, 20)));
  showToast(`Simulation "${state.sim.name}" sauvegardée`, 'success');
}

function loadSim(id) {
  const sims = JSON.parse(localStorage.getItem('ip_crm_sims') || '[]');
  const sim  = sims.find(s => s.id === id);
  if (!sim) return;
  state.sim = { pharmacyId: sim.pharmacyId, name: sim.name, items: sim.items };
  renderSimulator();
}

function deleteSavedSim(id) {
  const sims = JSON.parse(localStorage.getItem('ip_crm_sims') || '[]').filter(s => s.id !== id);
  localStorage.setItem('ip_crm_sims', JSON.stringify(sims));
  renderSimulator();
}

function printSimulation() {
  const { caTotal, margeTotal } = simCalc();
  const pharmaName = state.sim.pharmacyId
    ? (state.pharmacies.find(p => p.id === state.sim.pharmacyId)?.name || 'Pharmacie')
    : 'Aucune pharmacie';
  const rows = state.sim.items.map(it => {
    const froid = it.froid ? ' ❄️' : '';
    return `<tr><td>${it.designation}${froid}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">${fmt(it.puNet)}</td><td style="text-align:right;font-weight:600">${fmt(it.puNet * it.qty)}</td></tr>`;
  }).join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Simulation — ${state.sim.name}</title>
  <style>body{font-family:Arial,sans-serif;padding:30px;color:#111}h1{font-size:20px;margin-bottom:4px}p{color:#666;font-size:13px;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#f0f2f8;text-align:left;padding:8px 10px;font-size:12px}td{padding:7px 10px;border-bottom:1px solid #eee;font-size:13px}.total{background:#f7f8fc;font-weight:700}</style>
  </head><body>
  <h1>🎯 ${state.sim.name}</h1>
  <p>Pharmacie : ${pharmaName} · ${new Date().toLocaleDateString('fr-FR')}</p>
  <table><thead><tr><th>Désignation</th><th style="text-align:center">Qté</th><th style="text-align:right">PU net</th><th style="text-align:right">CA HT</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr class="total"><td colspan="3">TOTAL CA HT</td><td style="text-align:right">${fmt(caTotal)}</td></tr></tfoot>
  </table></body></html>`);
  win.document.close();
  win.print();
}

function renderSimulator() {
  const container = document.getElementById('simul-content');
  if (!container) return;

  const { caTotal, margeTotal } = simCalc();
  const savedSims = JSON.parse(localStorage.getItem('ip_crm_sims') || '[]');

  // Comparaison avec la dernière commande de la pharmacie sélectionnée
  let compHtml = '';
  if (state.sim.pharmacyId) {
    const allPhSales = getSales({ pharmacyId: state.sim.pharmacyId });
    const { year: curY, month: curM } = getCurrentPeriod(allPhSales.length ? allPhSales : getSales());
    const lastSales  = curY ? getSales({ pharmacyId: state.sim.pharmacyId, year: curY, month: curM }) : allPhSales;
    const lastCA     = sumCA(lastSales);
    const lastQte    = sumQte(lastSales);
    const lastNbRef  = new Set(lastSales.map(s => s.artCode)).size;
    const pharmaName = state.pharmacies.find(p => p.id === state.sim.pharmacyId)?.name || '';
    const delta      = lastCA > 0 ? deltaBadge(caTotal, lastCA) : '';
    compHtml = `
      <div class="card sim-card" style="margin-top:0">
        <div class="card-header">
          <div class="card-title">Vs dernière commande</div>
          <div class="card-subtitle">${pharmaName}</div>
        </div>
        <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div class="sim-mini-kpi">
            <div class="sim-mini-label">CA actuel</div>
            <div class="sim-mini-val">${fmt(lastCA)}</div>
          </div>
          <div class="sim-mini-kpi">
            <div class="sim-mini-label">CA simulé</div>
            <div class="sim-mini-val" style="color:var(--blue)">${fmt(caTotal)}</div>
          </div>
          <div class="sim-mini-kpi">
            <div class="sim-mini-label">Évolution</div>
            <div class="sim-mini-val">${lastCA > 0 ? delta : '—'}</div>
          </div>
          <div class="sim-mini-kpi">
            <div class="sim-mini-label">Refs actuelles</div>
            <div class="sim-mini-val">${lastNbRef}</div>
          </div>
          <div class="sim-mini-kpi">
            <div class="sim-mini-label">Refs simulées</div>
            <div class="sim-mini-val" style="color:var(--blue)">${state.sim.items.length}</div>
          </div>
          <div class="sim-mini-kpi">
            <div class="sim-mini-label">Qté actuelle</div>
            <div class="sim-mini-val">${fmtNum(Math.round(lastQte))}</div>
          </div>
        </div>
      </div>`;
  }

  // Liste items
  const itemsHtml = state.sim.items.length
    ? state.sim.items.map((it, i) => {
        const cat  = CATS[it.cat] || CATS.mi;
        const froid = it.froid ? '<span title="Thermosensible" style="font-size:12px">❄️</span> ' : '';
        return `<div class="sim-item">
          <div class="sim-item-left">
            <div class="sim-item-name">${froid}${it.designation}</div>
            <div style="display:flex;gap:6px;margin-top:4px;align-items:center">
              <span style="font-size:11px;padding:2px 7px;border-radius:4px;background:${cat.color}22;color:${cat.color}">${cat.label}</span>
              <span style="font-size:11px;color:var(--text3)">PU ${fmt(it.puNet)}</span>
            </div>
          </div>
          <div class="sim-item-right">
            <input type="number" min="0" step="1" value="${it.qty}"
              oninput="simUpdateQty(${i},this.value)"
              style="width:64px;text-align:center;border:1px solid var(--border2);border-radius:8px;padding:5px 6px;font-size:13px;font-weight:600;background:var(--bg2)">
            <div class="sim-line-ca" id="sim-line-${i}">${fmt(it.puNet * it.qty)}</div>
            <button onclick="simRemove(${i})" title="Retirer" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;padding:4px">✕</button>
          </div>
        </div>`;
      }).join('')
    : `<div style="padding:32px;text-align:center;color:var(--text3)">
        <div style="font-size:32px;margin-bottom:8px">🛒</div>
        <div style="font-weight:600;color:var(--text2)">Panier vide</div>
        <div style="font-size:12px;margin-top:4px">Recherchez des produits pour commencer votre simulation</div>
      </div>`;

  // Sauvegardes
  const savedHtml = savedSims.length
    ? savedSims.map(s => {
        const ph = s.pharmacyId ? state.pharmacies.find(p => p.id === s.pharmacyId)?.name : null;
        const d  = new Date(s.savedAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
        return `<div class="sim-saved-item">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
            <div style="font-size:11px;color:var(--text3)">${ph ? ph + ' · ' : ''}${s.items.length} réf. · ${d}</div>
          </div>
          <button onclick="loadSim(${s.id})" class="btn btn-ghost" style="padding:3px 10px;font-size:12px">Charger</button>
          <button onclick="deleteSavedSim(${s.id})" style="background:none;border:none;cursor:pointer;color:var(--rose);font-size:14px;padding:4px">✕</button>
        </div>`;
      }).join('')
    : '<div style="font-size:12px;color:var(--text3);padding:12px 0">Aucune simulation sauvegardée</div>';

  const pharmaOptions = state.pharmacies.map(p =>
    `<option value="${p.id}" ${state.sim.pharmacyId === p.id ? 'selected' : ''}>${p.name}</option>`
  ).join('');

  // Suggestions
  const suggestions = simSuggestions(simSearchQuery);
  const suggestHtml = simSearchQuery && suggestions.length
    ? `<div class="sim-suggestions">
        ${suggestions.map((p, i) => {
          const cat   = CATS[p.cat] || CATS.mi;
          const froid = p.froid ? '❄️ ' : '';
          const rot   = p.hasAmeli && p.rot ? `<span style="font-size:11px;color:var(--mint)">↻ ${p.rot.toFixed(1)}/mois</span>` : '';
          return `<div class="sim-suggest-item" onclick="simAddProduct(${i})">
            <div style="flex:1;min-width:0">
              <div class="sim-suggest-name">${froid}${p.designation}</div>
              <div style="display:flex;gap:6px;margin-top:2px;align-items:center">
                <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${cat.color}22;color:${cat.color}">${cat.label}</span>
                ${rot}
              </div>
            </div>
            <span style="font-size:12px;color:var(--text2);white-space:nowrap">${fmt(p.puNet)} / u</span>
            <span style="font-size:18px;color:var(--blue);font-weight:700">+</span>
          </div>`;
        }).join('')}
      </div>`
    : '';

  container.innerHTML = `
    <!-- Header controls -->
    <div class="card fade-up sim-header-card">
      <div class="card-body" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
        <select onchange="state.sim.pharmacyId=this.value||null;renderSimulator()"
          style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--border2);border-radius:10px;background:var(--bg2);font-size:13px;color:var(--text)">
          <option value="">Aucune pharmacie cible</option>
          ${pharmaOptions}
        </select>
        <input type="text" value="${state.sim.name}"
          oninput="state.sim.name=this.value"
          placeholder="Nom de la simulation"
          style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--border2);border-radius:10px;background:var(--bg2);font-size:13px">
        <button class="btn btn-primary" onclick="saveSimulation()">💾 Sauvegarder</button>
        <button class="btn btn-ghost" onclick="printSimulation()">🖨 Imprimer</button>
        <button class="btn btn-ghost" onclick="state.sim.items=[];renderSimulator()" style="color:var(--rose)">🗑 Vider</button>
      </div>
    </div>

    <div class="sim-layout fade-up">

      <!-- Colonne gauche : produits -->
      <div class="sim-col-left">

        <!-- Recherche produit -->
        <div class="card" style="position:relative">
          <div class="card-body" style="padding:12px 16px">
            <div class="search-wrap">
              <span class="search-icon">🔍</span>
              <input id="sim-search-input" type="text" placeholder="Ajouter un produit au panier..." value="${simSearchQuery}"
                oninput="simSearchQuery=this.value;renderSimulator()"
                style="border:none;background:transparent;outline:none;flex:1;font-size:13px;color:var(--text)"
                autocomplete="off">
              ${simSearchQuery ? `<button onclick="simSearchQuery='';renderSimulator()" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px">✕</button>` : ''}
            </div>
          </div>
          ${suggestHtml}
        </div>

        <!-- Liste des produits -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Panier (${state.sim.items.length} réf.)</div>
            ${state.sim.items.length ? `<span style="font-size:13px;font-weight:600;color:var(--blue)">${fmt(caTotal)}</span>` : ''}
          </div>
          <div>${itemsHtml}</div>
        </div>

        <!-- Simulations sauvegardées -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Simulations sauvegardées</div>
          </div>
          <div class="card-body">
            <div class="sim-saved-list">${savedHtml}</div>
          </div>
        </div>
      </div>

      <!-- Colonne droite : totaux + analyse -->
      <div class="sim-col-right">

        <!-- KPIs totaux -->
        <div class="card kpi-hero" style="margin-bottom:16px">
          <div class="card-body" style="padding:20px">
            <div style="font-size:12px;color:rgba(255,255,255,.65);font-weight:500;margin-bottom:6px">CA HT TOTAL SIMULÉ</div>
            <div id="sim-total-ca" style="font-size:32px;font-weight:800;color:#fff;letter-spacing:-1px">${fmt(caTotal)}</div>
            <div style="display:flex;gap:20px;margin-top:16px">
              <div>
                <div style="font-size:11px;color:rgba(255,255,255,.55)">Marge brute (est.)</div>
                <div id="sim-total-marge" style="font-size:16px;font-weight:700;color:rgba(255,255,255,.9)">${fmt(margeTotal)}</div>
              </div>
              <div>
                <div style="font-size:11px;color:rgba(255,255,255,.55)">Nb références</div>
                <div style="font-size:16px;font-weight:700;color:rgba(255,255,255,.9)">${state.sim.items.length}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Répartition catégories -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Répartition par famille</div>
          </div>
          <div class="card-body" id="sim-bars">
            ${state.sim.items.length === 0
              ? '<div style="font-size:12px;color:var(--text3);padding:8px 0">Ajoutez des produits pour voir la répartition</div>'
              : '<!-- sera rempli par updateSimBars -->'}
          </div>
        </div>

        ${compHtml}
      </div>
    </div>
  `;

  // Focus search input
  const inp = document.getElementById('sim-search-input');
  if (inp && simSearchQuery) inp.focus();

  // Render bars
  if (state.sim.items.length) updateSimBars();
}

// ── EMPTY STATE ───────────────────────────────
function emptyState(icon, title, sub) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-sub">${sub}</div></div>`;
}

// ── INIT ──────────────────────────────────────
async function initApp() {
  if (!state.user) return;
  await load();

  document.getElementById('sidebar-user-name').textContent = state.user.name;
  document.getElementById('sidebar-user-role').textContent = state.user.role;
  document.getElementById('sidebar-avatar').textContent = state.user.name.charAt(0);
  document.getElementById('nav-admin').style.display = state.user.role === 'admin' ? 'flex' : 'none';

  updateNavBadge();
  navigate('dashboard');
}

// ── BOOT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const loginScreen = document.getElementById('login-screen');
  const appEl       = document.getElementById('app');

  // Réagit aux changements de session : déconnexion depuis un autre onglet, token révoqué, etc.
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      state.user = null;
      appEl.classList.remove('visible');
      loginScreen.style.display = 'flex';
    }
  });

  if (await restoreSession()) {
    loginScreen.style.display = 'none';
    appEl.classList.add('visible');
    await initApp();
  }

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const err      = document.getElementById('login-error');
    const btn      = e.target.querySelector('button[type=submit]');

    btn.disabled    = true;
    btn.textContent = 'Connexion…';

    if (await tryLogin(email, password)) {
      err.classList.remove('show');
      loginScreen.style.display = 'none';
      appEl.classList.add('visible');
      await initApp();
    } else {
      err.textContent = 'Email ou mot de passe incorrect';
      err.classList.add('show');
      btn.disabled    = false;
      btn.textContent = 'Se connecter →';
    }
  });
});
