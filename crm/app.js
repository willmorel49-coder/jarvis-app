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
  froid:     { label: 'Froid',          color: '#00C6FF', icon: '❄️' },
  biosim:    { label: 'Biosimilaires',  color: '#9B5CFF', icon: '🧬' },
  generique: { label: 'Génériques',     color: '#00E5A0', icon: '💊' },
  nr:        { label: 'Non remboursés', color: '#FF6B35', icon: '🔴' },
  ch:        { label: 'Cher',           color: '#FF4D6D', icon: '💎' },
  mi:        { label: 'Intermédiaire',  color: '#FFB020', icon: '📊' },
  pp:        { label: 'Petit prix',     color: '#34D399', icon: '✓'  },
};

function classifyProduct(sale) {
  if (sale.artFamille && CATS[sale.artFamille]) return sale.artFamille;
  const name = (sale.artDesignation || '').toUpperCase();
  if (/FROID|RÉFRIGÉR|REFRIGER|THERMOSENS/i.test(name)) return 'froid';
  if (/BIOSIM|BIOSIMILAIRE/i.test(name))                 return 'biosim';
  if (/\bGNR\b|GÉNÉR|GENERI/i.test(name))               return 'generique';
  if (/\bNR\b/.test(name))                               return 'nr';
  const p = sale.puNet || 0;
  return p > 468 ? 'ch' : p > 4.33 ? 'mi' : 'pp';
}

function classifyFromWMLRow(sf, nature, afm, puNet) {
  const s = (sf || '').toLowerCase();
  const n = (nature || '').toLowerCase();
  const a = (afm || '').toLowerCase();
  if (s === 'froid') return 'froid';
  if (n.includes('biosimilaire')) return 'biosim';
  if (n.includes('generique')) return 'generique';
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
    if (!map[k]) map[k] = { name: s.artDesignation, code: s.artCode, cat: classifyProduct(s), qte: 0, ca: 0, marge: 0 };
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
  `;
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

  // Filtre famille
  if (prodFamille !== 'tous') {
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

  // Chips famille
  const familles = [
    { key: 'tous',      label: 'Tous',         color: '#8899BB' },
    { key: 'pp',        label: 'PP',            color: CATS.pp.color },
    { key: 'mi',        label: 'MI',            color: CATS.mi.color },
    { key: 'ch',        label: 'CH',            color: CATS.ch.color },
    { key: 'biosim',    label: 'Biosim',        color: CATS.biosim.color },
    { key: 'generique', label: 'Générique',     color: CATS.generique.color },
    { key: 'nr',        label: 'NR',            color: CATS.nr.color },
    { key: 'froid',     label: 'Froid',         color: CATS.froid.color },
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
    return `<tr>
      <td>${renderRank(i)}</td>
      <td class="td-name">${p.name}</td>
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
    return `<tr>
      <td style="color:var(--text3);font-size:12px">${d.ip_rank_qty}</td>
      <td class="td-name" style="font-size:13px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.designation}</td>
      <td><span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${cc}22;color:${cc}">${d.categorie.toUpperCase()}</span></td>
      <td class="td-num" style="text-align:right">${fmtNum(d.ip_qty)}</td>
      <td class="td-num" style="text-align:right">${fmt(d.ip_ca)}</td>
      <td class="td-num" style="text-align:right;color:${rotColor}">${d.has_ameli ? d.rot_pharma_jan26.toFixed(1) : '—'}</td>
      <td style="text-align:right;font-size:11px;color:var(--text3)">${d.has_ameli ? fmtNum(d.ameli_jan26) : '—'}</td>
      <td style="font-size:11px;color:var(--text3)">${d.cip13 || '—'}</td>
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
              ${thB('rot_pharma_jan26','Rot./pharma/mois')}
              <th style="text-align:right">France Jan26</th>
              <th>CIP13</th>
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

  const titles = { dashboard: 'Dashboard', pharmacies: 'Pharmacies', produits: 'Produits', catalogue: 'Catalogue IP', import: 'Import', admin: 'Administration', benchmark: 'Benchmark Marché' };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  // FAB catalogue visible uniquement sur la page catalogue
  const fab = document.getElementById('cat-cart-fab');
  if (fab) fab.style.setProperty('display', page === 'catalogue' ? '' : 'none', 'important');

  const renders = { dashboard: renderDashboard, pharmacies: renderPharmacies, produits: renderProduits, catalogue: renderCatalogue, import: renderImport, admin: renderAdmin, benchmark: renderBenchmark };
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
