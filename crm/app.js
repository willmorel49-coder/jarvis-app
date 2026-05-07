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
  state.imports    = (imports    || []).map(i => ({ id: i.id, pharmacyId: i.pharmacy_id, month: i.month, year: i.year, filename: i.filename, importedAt: i.imported_at, filePath: i.file_path || null }));
  state.sales      = (sales      || []).map(s => ({
    id: s.id, importId: s.import_id, pharmacyId: s.pharmacy_id,
    month: s.month, year: s.year,
    artDesignation: s.art_designation, artCode: s.art_code, artId: s.art_id,
    artFamille: s.art_famille || null,
    qte: parseFloat(s.qte)||0, puBrut: parseFloat(s.pu_brut)||0,
    puNet: parseFloat(s.pu_net)||0, mntNetHt: parseFloat(s.mnt_net_ht)||0,
  }));
}

// ── STORAGE ──────────────────────────────────
const STORAGE_BUCKET = 'excel-imports';

async function uploadImportFile(file, importId) {
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${state.user.id}/${importId}_${safeName}`;
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
    if (error) { console.warn('Storage upload failed:', error.message); return null; }
    await sb.from('imports').update({ file_path: path }).eq('id', importId);
    return path;
  } catch(e) { console.warn('Storage error:', e); return null; }
}

async function downloadImportFile(filePath) {
  if (!filePath) { showToast('Fichier non disponible', 'error'); return; }
  try {
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(filePath, 3600);
    if (error || !data?.signedUrl) { showToast('Fichier non disponible', 'error'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = filePath.split('_').slice(1).join('_');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } catch(e) { showToast('Erreur téléchargement', 'error'); }
}

async function deleteImportFile(filePath) {
  if (!filePath) return;
  try { await sb.storage.from(STORAGE_BUCKET).remove([filePath]); } catch(e) {}
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
  state.pharmacies = [];
  state.imports    = [];
  state.sales      = [];
  state.currentPage = 'dashboard';
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
    const filePath = await uploadImportFile(file, imp.id);
    state.imports.unshift({ id: imp.id, pharmacyId: imp.pharmacy_id, month: imp.month, year: imp.year, filename: imp.filename, importedAt: imp.imported_at, filePath });

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
  const filePath = await uploadImportFile(file, imp.id);
  state.imports.unshift({ id: imp.id, pharmacyId: imp.pharmacy_id, month: imp.month, year: imp.year, filename: imp.filename, importedAt: imp.imported_at, filePath });

  // 4. Bulk insert sales rows in batches of 500
  const salesRows = rows.map(normalizeRow).filter(r => r.artDesignation).map(r => {
    const famille = classifyFromWMLRow(r.subfamily, r.nature, r.afmCode, r.puNet);
    return {
      _famille: famille,
      import_id: imp.id, pharmacy_id: pharma.id, month, year,
      art_designation: r.artDesignation, art_code: r.artCode, art_id: r.artId,
      art_famille: famille,
      qte: r.qte, pu_brut: r.puBrut, pu_net: r.puNet, mnt_net_ht: r.mntNetHt,
    };
  });
  const BATCH = 500;
  for (let i = 0; i < salesRows.length; i += BATCH) {
    const { error: sErr } = await sb.from('sales').insert(
      salesRows.slice(i, i + BATCH).map(({ _famille, ...s }) => s)
    );
    if (sErr) return { ok: false, error: sErr.message || sErr.code || 'Erreur insertion ventes' };
    state.sales.push(...salesRows.slice(i, i + BATCH).map(s => ({
      id: crypto.randomUUID(), importId: s.import_id, pharmacyId: s.pharmacy_id,
      month: s.month, year: s.year,
      artDesignation: s.art_designation, artCode: s.art_code, artId: s.art_id,
      artFamille: s._famille,
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
function isGenerique(b) {
  if (b.artnature) return b.artnature === 'generique' || b.artnature === 'generique_partenaire';
  return /\bEG\b|\bZENTIVA\b|\bZYD\b|\bZYDUS\b|\bTEVA\b|\bBIOGARAN\b|\bMYLAN\b|\bSANDOZ\b|\bARROW\b|\bCRISTERS\b|\bVIATRIS\b|\bALMUS\b|\bACCORD\b|\bRATIOPHARM\b/.test(b.designation || '');
}
function isBiosim(b) {
  if (b.artnature) return b.artnature === 'biosimilaire';
  return b.atc2 === 'L04';
}
function isNonRembourse(b) {
  return !b.has_ameli;
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

  // ── Top pharmacies mois courant (bar chart) ───
  const topPh5 = topPharmacies(5, salesCur);
  const maxPhCA = Math.max(...topPh5.map(p => p.ca), 1);

  // ── Pipeline de conversion par palier ─────────
  const PALIERS = [0, 1500, 5000, 10000];
  const palierLabels = ['Départ', '1 500€', '5 000€', '10 000€+'];
  const pipelineCounts = PALIERS.map((p, i) => {
    const next = PALIERS[i + 1];
    return {
      label: palierLabels[i],
      count: state.pharmacies.filter(ph => {
        const ca = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
        return next ? ca >= p && ca < next : ca >= p;
      }).length,
      color: ['#64748B', '#0057FF', '#00E5A0', '#FFB020'][i],
    };
  });
  const pipelineTotal = pipelineCounts.reduce((s, p) => s + p.count, 0);

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

  // Comparaison per-pharmacy M vs M-1
  const compRows = state.pharmacies
    .map(ph => {
      const cur  = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
      const prev = sumCA(salesPrev.filter(s => s.pharmacyId === ph.id));
      return { ph, cur, prev };
    })
    .filter(r => r.cur > 0 || r.prev > 0)
    .sort((a, b) => b.cur - a.cur);

  const compRowsHtml = compRows.map(r =>
    `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px 16px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:${r.ph.color};flex-shrink:0"></span>
          <span style="font-size:13px;font-weight:600">${r.ph.name}</span>
        </div>
      </td>
      <td style="padding:10px 12px;text-align:right;font-size:12px;color:var(--text2)">${r.prev > 0 ? fmt(r.prev) : '—'}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700">${r.cur > 0 ? fmt(r.cur) : '—'}</td>
      <td style="padding:10px 12px;text-align:right">${deltaBadge(r.cur, r.prev)}</td>
    </tr>`
  ).join('');

  document.getElementById('dash-content').innerHTML = `

    <!-- Row 1 : Hero KPI + 3 secondaires -->
    <div class="kpi-grid fade-up" style="grid-template-columns:2fr 1fr 1fr 1fr;margin-bottom:24px">

      <!-- Hero -->
      <div class="kpi-card kpi-hero" style="background:linear-gradient(135deg,#1E3A8A 0%,#2563EB 60%,#3B82F6 100%);box-shadow:0 8px 32px rgba(37,99,235,.30),0 2px 8px rgba(37,99,235,.15)">
        <div class="kpi-icon">💰</div>
        <div class="kpi-value" style="font-size:38px;font-weight:900;letter-spacing:-2px;font-family:'Syne',sans-serif">${fmt(caCur)}</div>
        <div class="kpi-label" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.7)">CA Secteur — ${curLabel}</div>
        <div style="margin-top:12px;display:flex;align-items:center;gap:8px">
          ${deltaBadge(caCur, caPrev)}
          <span style="font-size:11px;color:rgba(255,255,255,0.55)">vs ${prevLabel}</span>
        </div>
      </div>

      <!-- Pharmacies actives -->
      <div class="kpi-card kc-g" style="box-shadow:0 2px 12px rgba(0,0,0,.06)">
        <div class="kpi-icon">🏥</div>
        <div class="kpi-value" style="color:var(--mint)">${nPhCur}</div>
        <div class="kpi-label">Pharmacies actives</div>
        <div style="margin-top:10px">${deltaBadge(nPhCur, nPhPrev)}</div>
      </div>

      <!-- Panier moyen -->
      <div class="kpi-card kc-a" style="box-shadow:0 2px 12px rgba(0,0,0,.06)">
        <div class="kpi-icon">🛒</div>
        <div class="kpi-value" style="color:var(--amber)">${fmt(panierCur)}</div>
        <div class="kpi-label">Panier moyen</div>
        <div style="margin-top:10px">${deltaBadge(panierCur, panierPrev)}</div>
      </div>

      <!-- Meilleure progression -->
      <div class="kpi-card kc-p" style="box-shadow:0 2px 12px rgba(0,0,0,.06)">
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

    <!-- Row 2b : Comparaison M vs M-1 -->
    ${compRows.length ? `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Comparaison M vs M-1 par pharmacie</div>
          <div class="card-subtitle">${prevLabel} → ${curLabel}</div>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid var(--border2)">
              <th style="padding:8px 16px;text-align:left;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">Pharmacie</th>
              <th style="padding:8px 12px;text-align:right;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">${prevLabel}</th>
              <th style="padding:8px 12px;text-align:right;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">${curLabel}</th>
              <th style="padding:8px 12px;text-align:right;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">Évolution</th>
            </tr>
          </thead>
          <tbody>${compRowsHtml}</tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- Row 3 : Pipeline conversion -->
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Pipeline de conversion</div>
          <div class="card-subtitle">Répartition des pharmacies actives par palier CA mensuel</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid var(--border)">
        ${pipelineCounts.map((p, i) => `
          <div style="padding:18px 20px;${i < 3 ? 'border-right:1px solid var(--border);' : ''}text-align:center">
            <div style="font-size:36px;font-weight:900;letter-spacing:-1px;color:${p.color}">${p.count}</div>
            <div style="font-size:12px;font-weight:600;color:var(--text2);margin-top:4px">${p.label}</div>
            <div style="margin-top:8px;height:4px;border-radius:2px;background:var(--bg3)">
              <div style="height:100%;border-radius:2px;background:${p.color};width:${pipelineTotal > 0 ? Math.round(p.count/pipelineTotal*100) : 0}%"></div>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:4px">${pipelineTotal > 0 ? Math.round(p.count/pipelineTotal*100) : 0}%</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Row 4 : Charts -->
    <div class="grid-2 fade-up">
      <div class="card" style="border-radius:var(--r)">
        <div class="card-header" style="padding:20px 24px 16px">
          <div>
            <div class="card-title">CA par pharmacie — ${curLabel}</div>
            <div class="card-subtitle">${topPh5.length} pharmacies</div>
          </div>
        </div>
        <div class="card-body">
          ${topPh5.length
            ? '<div class="chart-wrap" style="height:220px"><canvas id="chart-ph-bar"></canvas></div>'
            : emptyState('📊','Aucune donnée','Importez des fichiers Excel')}
        </div>
      </div>
      <div class="card" style="border-radius:var(--r)">
        <div class="card-header" style="padding:20px 24px 16px">
          <div>
            <div class="card-title">Répartition par famille</div>
            <div class="card-subtitle">${curLabel}</div>
          </div>
        </div>
        <div class="card-body">
          ${catRows.length
            ? '<div class="chart-wrap" style="height:220px"><canvas id="chart-cat-donut"></canvas></div>'
            : emptyState('📊','Aucune donnée','Importez des fichiers Excel')}
        </div>
      </div>
    </div>

    <!-- Row 4 : Évolution CA secteur -->
    <div class="card fade-up" style="margin-top:24px;border-radius:var(--r)">
      <div class="card-header" style="padding:20px 24px 16px">
        <div>
          <div class="card-title">Évolution CA secteur</div>
          <div class="card-subtitle">Historique complet importé</div>
        </div>
      </div>
      <div class="card-body">
        <div class="chart-wrap" style="height:230px"><canvas id="chart-evolution"></canvas></div>
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

    // Evolution CA secteur — line chart
    const monthlyData = caByMonth(allSalesRaw);
    if (monthlyData.length) {
      const ctxEvo = document.getElementById('chart-evolution');
      if (ctxEvo) {
        if (state.charts['evolution']) state.charts['evolution'].destroy();
        state.charts['evolution'] = new Chart(ctxEvo, {
          type: 'line',
          data: {
            labels: monthlyData.map(([k]) => {
              const [y, m] = k.split('-');
              return monthName(+m) + ' ' + y.slice(2);
            }),
            datasets: [{
              label: 'CA HT',
              data: monthlyData.map(([, v]) => +v.toFixed(2)),
              borderColor: '#0057FF',
              backgroundColor: 'rgba(0,87,255,0.08)',
              borderWidth: 2.5,
              pointRadius: 5,
              pointBackgroundColor: '#0057FF',
              tension: 0.3,
              fill: true,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.y) } },
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 11 } } },
              y: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { color: '#64748B', font: { size: 11 }, callback: v => fmt(v) } },
            }
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
          <div class="pharma-item" onclick="showPharmaDetail('${ph.id}')" style="box-shadow:0 2px 8px rgba(0,0,0,.06);transition:box-shadow .18s,transform .18s" onmouseenter="this.style.boxShadow='0 6px 24px rgba(0,0,0,.12)';this.style.transform='translateY(-1px)'" onmouseleave="this.style.boxShadow='0 2px 8px rgba(0,0,0,.06)';this.style.transform='translateY(0)'">
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

  const planningHtml = (() => {
    if (typeof CLIENTS === 'undefined' || !CLIENTS.length) return '';
    const today = new Date(); today.setHours(0,0,0,0);
    const pharmaNames = new Map(state.pharmacies.map(p => [p.name.toUpperCase().trim(), p]));
    const dateShortFR = d => {
      const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
      return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    };
    const parseDate = str => {
      if (!str || str === 'null' || str.trim() === '') return null;
      const s = str.trim();
      let m;
      m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return new Date(+m[3], +m[2]-1, +m[1]);
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(+m[1], +m[2]-1, +m[3]);
      return null;
    };
    const statusBadge = d => {
      const diff = Math.round((d - today) / 86400000);
      if (diff < 0) return `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(255,77,109,.12);color:var(--rose)">Passé</span>`;
      if (diff === 0) return `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(255,176,32,.15);color:var(--amber);font-weight:700">Aujourd'hui</span>`;
      if (diff <= 7) return `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(0,229,160,.12);color:var(--mint)">Cette semaine</span>`;
      return `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:var(--bg3);color:var(--text3)">Prochain</span>`;
    };
    const upcoming = CLIENTS
      .map(c => ({ c, date: parseDate(c.prochaineVisite) }))
      .filter(x => x.date !== null)
      .sort((a, b) => a.date - b.date)
      .slice(0, 10);
    if (!upcoming.length) return '';
    const rows = upcoming.map(({ c, date }) => {
      const ph = pharmaNames.get((c.nom || '').toUpperCase().trim());
      const dot = ph ? `<span style="width:8px;height:8px;border-radius:50%;background:${ph.color};flex-shrink:0;display:inline-block"></span>` : '';
      return `
        <div style="display:flex;align-items:center;gap:14px;padding:10px 20px;border-bottom:1px solid var(--border)">
          <div style="min-width:70px;font-size:12px;font-weight:600;color:var(--blue)">${dateShortFR(date)}</div>
          <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
            ${dot}
            <div style="min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nom || '—'}</div>
              <div style="font-size:11px;color:var(--text3)">${c.cp || ''} ${c.ville || ''}</div>
            </div>
          </div>
          <div>${statusBadge(date)}</div>
        </div>`;
    }).join('');
    return `
      <div class="card fade-in" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <div class="card-title">Planning visites</div>
            <div class="card-subtitle">Prochains rendez-vous planifiés</div>
          </div>
          <span class="badge badge-blue">${upcoming.length} visites</span>
        </div>
        ${rows}
      </div>`;
  })();

  document.getElementById('pharma-content').innerHTML = `
    ${planningHtml}
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
      return c.nom.toLowerCase().includes(q) || (c.ville || '').toLowerCase().includes(q) || (c.cp || '').includes(q);
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

  const allPhSales = getSales({ pharmacyId: pharma.id });
  const { year: curY, month: curM } = getCurrentPeriod(allPhSales.length ? allPhSales : getSales());
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);
  const salesCur  = curY  ? getSales({ pharmacyId: pharma.id, year: curY, month: curM  }) : [];
  const salesPrev = prevY ? getSales({ pharmacyId: pharma.id, year: prevY, month: prevM }) : [];

  const caCur    = sumCA(salesCur);
  const caPrev   = sumCA(salesPrev);
  const margeCur = sumMarge(salesCur);
  const mpctCur  = margePct(salesCur);
  const nRefCur  = new Set(salesCur.map(s => s.artCode)).size;
  const sectorCA = sumCA(curY ? getSales({ year: curY, month: curM }) : []);
  const pctOfSector = sectorCA > 0 ? caCur / sectorCA * 100 : 0;

  // ── Infos CLIENTS (potentiel secteur) ─────────
  const clientInfo = typeof CLIENTS !== 'undefined'
    ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === pharma.name.toUpperCase().trim())
    : null;
  const potentielGx = clientInfo?.potentielGx || 0;

  // ── Palier de progression ─────────────────────
  const PALIERS = [0, 1500, 5000, 10000];
  let palierActuel = 0, palierSuivant = null;
  for (const p of PALIERS) { if (caCur >= p) palierActuel = p; else if (!palierSuivant) palierSuivant = p; }
  const progressPct = palierSuivant
    ? Math.min(100, (caCur - palierActuel) / (palierSuivant - palierActuel) * 100) : 100;

  // ── Moteur de recommandation ──────────────────
  const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const baseSales = salesCur.length ? salesCur : allPhSales.slice(0, 300);
  const prodMap = {};
  for (const s of baseSales) {
    const k = nn(s.artDesignation);
    if (!prodMap[k]) prodMap[k] = { designation: s.artDesignation, puNet: s.puNet, qte: 0 };
    prodMap[k].qte += s.qte;
    if (s.puNet > 0) prodMap[k].puNet = s.puNet;
  }

  // SWITCH : produit acheté ailleurs, IP est moins cher
  const switchOpps = [];
  if (typeof BENCHMARK !== 'undefined') {
    for (const [k, prod] of Object.entries(prodMap)) {
      const match = BENCHMARK.find(b => nn(b.designation) === k);
      if (match && match.prix_ip > 0 && prod.puNet > 0 && match.prix_ip < prod.puNet * 0.99) {
        switchOpps.push({
          designation: prod.designation,
          prixActuel: prod.puNet, prixIP: match.prix_ip,
          gainUnit: prod.puNet - match.prix_ip,
          gainMois: (prod.puNet - match.prix_ip) * prod.qte,
          qte: prod.qte, cat: match.categorie,
        });
      }
    }
    switchOpps.sort((a, b) => b.gainMois - a.gainMois);
  }

  // AJOUT : top rotations absentes de leurs commandes IP
  const ourNorms = new Set(Object.keys(prodMap));
  const addOpps = typeof BENCHMARK !== 'undefined'
    ? BENCHMARK
        .filter(b => b.rot_pharma_jan26 > 2 && b.prix_ip > 0 && !ourNorms.has(nn(b.designation)))
        .map(b => ({ ...b, caEstime: b.rot_pharma_jan26 * b.prix_ip }))
        .sort((a, b) => b.caEstime - a.caEstime)
        .slice(0, 8)
    : [];

  const totalGainSwitch = switchOpps.reduce((s, o) => s + o.gainMois, 0);
  const totalGainAjout  = addOpps.reduce((s, o) => s + o.caEstime, 0);
  const totalPotentiel  = totalGainSwitch + totalGainAjout * 0.15;

  const curLabel  = curY  ? `${monthName(curM)} ${curY}`   : '—';
  const prevLabel = prevY ? `${monthName(prevM)} ${prevY}` : '—';
  const pharmaByMonth = caByMonth(allPhSales);
  const imports = state.imports.filter(i => i.pharmacyId === pharma.id).sort((a,b) => new Date(b.importedAt) - new Date(a.importedAt));

  // ── HTML recommandations switch ───────────────
  const switchHtml = switchOpps.slice(0, 6).map(o => {
    const cat = CATS[o.cat] || CATS.mi;
    return `<div style="display:flex;align-items:center;gap:14px;padding:13px 20px;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.designation}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">
          Grossiste actuel : <span style="color:var(--rose);font-weight:700;text-decoration:line-through">${fmt(o.prixActuel)}/u</span>
          → IP : <span style="color:var(--mint);font-weight:700">${fmt(o.prixIP)}/u</span>
          <span style="margin-left:8px;padding:1px 6px;border-radius:4px;background:${cat.color}22;color:${cat.color};font-size:10px">${cat.label}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:18px;font-weight:800;color:var(--mint)">+${fmt(o.gainMois)}</div>
        <div style="font-size:10px;color:var(--text3)">économie/mois</div>
      </div>
    </div>`;
  }).join('');

  // ── HTML recommandations ajout ────────────────
  const addHtml = addOpps.map(b => {
    const cat = CATS[b.categorie] || CATS.mi;
    return `<div style="display:flex;align-items:center;gap:14px;padding:13px 20px;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.designation}${b.is_froid?' ❄️':''}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">
          <span style="color:var(--amber);font-weight:600">${b.rot_pharma_jan26.toFixed(1)} boîtes/pharma/mois</span>
          · Prix IP <span style="font-weight:600">${fmt(b.prix_ip)}</span>
          <span style="margin-left:8px;padding:1px 6px;border-radius:4px;background:${cat.color}22;color:${cat.color};font-size:10px">${cat.label}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:18px;font-weight:800;color:var(--blue)">+${fmt(b.caEstime)}</div>
        <div style="font-size:10px;color:var(--text3)">CA potentiel/mois</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('pharma-content').innerHTML = `
    <div class="fade-up">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="renderPharmacies()">← Retour</button>
        <div style="width:12px;height:12px;border-radius:50%;background:${pharma.color}"></div>
        <span class="section-title" style="margin:0;flex:1">${pharma.name}</span>
        ${clientInfo?.ville ? `<span style="font-size:12px;color:var(--text3)">${clientInfo.cp} ${clientInfo.ville}</span>` : ''}
        <button class="btn btn-ghost" onclick="exportPharmacyCSV('${pharma.id}')" style="font-size:12px">⬇ CSV</button>
        <button class="btn btn-ghost" style="color:var(--rose);border-color:rgba(255,77,109,.3)" onclick="deletePharmacy('${pharma.id}')">🗑</button>
      </div>

      <!-- Row 1 : Hero + KPIs -->
      <div class="kpi-grid fade-up" style="grid-template-columns:2fr 1fr 1fr 1fr;margin-bottom:20px">
        <div class="kpi-card" style="background:linear-gradient(135deg,#1E3A8A 0%,#2563EB 60%,#3B82F6 100%);box-shadow:0 8px 32px rgba(37,99,235,.30),0 2px 8px rgba(37,99,235,.15);border:none">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.7);margin-bottom:6px">CA Intégral Pharma — ${curLabel}</div>
          <div style="font-size:38px;font-weight:900;letter-spacing:-2px;font-family:'Syne',sans-serif;color:#fff">${fmt(caCur)}</div>
          <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
            ${deltaBadge(caCur, caPrev)}
            <span style="font-size:11px;color:var(--text3)">vs ${prevLabel}</span>
          </div>
          ${totalPotentiel > 0 ? `
          <div style="margin-top:12px;padding:10px 12px;background:rgba(255,176,32,.08);border-radius:8px;border:1px solid rgba(255,176,32,.2)">
            <div style="font-size:10px;color:var(--amber);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Gain potentiel identifié</div>
            <div style="font-size:22px;font-weight:900;color:var(--amber)">+${fmt(totalPotentiel)}<span style="font-size:12px;font-weight:400">/mois</span></div>
          </div>` : ''}
        </div>
        <div class="kpi-card kc-b">
          <div class="kpi-icon">💊</div>
          <div class="kpi-value" style="color:var(--blue)">${nRefCur}</div>
          <div class="kpi-label">Références</div>
        </div>
        <div class="kpi-card kc-g">
          <div class="kpi-icon">📈</div>
          <div class="kpi-value" style="color:var(--mint)">${fmt(margeCur)}</div>
          <div class="kpi-label">Marge brute</div>
          <div style="margin-top:6px;font-size:11px;color:var(--text3)">${mpctCur.toFixed(1)}%</div>
        </div>
        <div class="kpi-card kc-a">
          <div class="kpi-icon">🏆</div>
          <div class="kpi-value" style="color:var(--amber)">${pctOfSector.toFixed(1)}%</div>
          <div class="kpi-label">Part secteur</div>
          ${potentielGx > 0 ? `<div style="margin-top:6px;font-size:11px;color:var(--text3)">Pot. Gx ${fmt(potentielGx)}</div>` : ''}
        </div>
      </div>

      <!-- Palier progression -->
      <div class="card fade-up" style="margin-bottom:20px">
        <div style="padding:16px 20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:13px;font-weight:700">Progression CA mensuel</div>
            <div style="font-size:12px;color:${palierSuivant ? 'var(--blue)' : 'var(--mint)'}">
              ${palierSuivant ? `Il manque <strong>${fmt(palierSuivant - caCur)}</strong> pour le palier suivant` : '🎯 Palier maximum atteint'}
            </div>
          </div>
          <div style="position:relative;height:10px;border-radius:5px;background:var(--bg3);margin-bottom:14px">
            <div style="position:absolute;inset:0;border-radius:5px;background:linear-gradient(90deg,var(--blue),var(--mint));width:${progressPct}%;transition:width .6s"></div>
          </div>
          <div style="display:flex;justify-content:space-between">
            ${PALIERS.map(p => `<div style="text-align:center">
              <div style="font-size:10px;font-weight:700;color:${caCur >= p ? 'var(--mint)' : 'var(--text3)'}">${p === 0 ? 'Départ' : fmt(p)}</div>
              <div style="width:8px;height:8px;border-radius:50%;background:${caCur >= p ? 'var(--mint)' : 'var(--border2)'};margin:4px auto 0"></div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Switch opportunities -->
      ${switchOpps.length ? `
      <div class="card fade-up" style="margin-bottom:20px;border-left:3px solid var(--mint)">
        <div class="card-header">
          <div>
            <div class="card-title">🔄 Opportunités Switch</div>
            <div class="card-subtitle">Ces produits sont commandés ailleurs — IP est moins cher</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:900;color:var(--mint)">+${fmt(totalGainSwitch)}</div>
            <div style="font-size:11px;color:var(--text3)">économie immédiate/mois</div>
          </div>
        </div>
        ${switchHtml}
        ${switchOpps.length > 6 ? `<div style="padding:10px 20px;font-size:12px;color:var(--text3)">+${switchOpps.length - 6} autres opportunités switch</div>` : ''}
      </div>` : ''}

      <!-- Ajout opportunities -->
      ${addOpps.length ? `
      <div class="card fade-up" style="margin-bottom:20px;border-left:3px solid var(--blue)">
        <div class="card-header">
          <div>
            <div class="card-title">➕ Opportunités Ajout</div>
            <div class="card-subtitle">Top rotations nationales absentes de vos commandes IP</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:900;color:var(--blue)">+${fmt(totalGainAjout)}</div>
            <div style="font-size:11px;color:var(--text3)">CA potentiel/mois</div>
          </div>
        </div>
        ${addHtml}
      </div>` : ''}

      <!-- Évolution mensuelle -->
      ${pharmaByMonth.length > 1 ? `
      <div class="card fade-up" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">Évolution CA mensuelle</div>
          <div class="card-subtitle">${pharmaByMonth.length} période(s) importées</div>
        </div>
        <div class="card-body"><div class="chart-wrap"><canvas id="chart-pharma-month"></canvas></div></div>
      </div>` : ''}

      <!-- Imports -->
      ${imports.length ? `
      <div class="card fade-up">
        <div class="card-header"><div class="card-title">Historique imports</div></div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Fichier</th><th>Période</th><th>Date</th><th></th></tr></thead>
            <tbody>${imports.map(imp => `<tr>
              <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${imp.filename}</td>
              <td class="td-num">${imp.month ? monthName(imp.month)+' '+imp.year : '—'}</td>
              <td style="color:var(--text3);font-size:12px">${new Date(imp.importedAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</td>
              <td style="display:flex;gap:6px;align-items:center">
                ${imp.filePath ? `<button class="btn btn-ghost" style="color:var(--blue);border-color:rgba(0,87,255,.3);padding:4px 10px;font-size:12px" onclick="downloadImportFile('${imp.filePath}')" title="Télécharger le fichier Excel original">⬇</button>` : ''}
                <button class="btn btn-ghost" style="color:var(--rose);border-color:rgba(255,77,109,.3);padding:4px 10px;font-size:12px" onclick="deleteImport('${imp.id}','${pharmacyId}')">🗑</button>
              </td>
            </tr>`).join('')}</tbody>
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
            datasets: [{ label: 'CA Net HT', data: pharmaByMonth.map(([,v]) => +v.toFixed(2)), backgroundColor: pharma.color+'33', borderColor: pharma.color, borderWidth: 2, borderRadius: 8 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 11 } } },
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
  const imp = state.imports.find(i => i.id === importId);
  const { error } = await sb.from('imports').delete().eq('id', importId);
  if (error) { showToast('Erreur suppression', 'error'); return; }
  await deleteImportFile(imp?.filePath);
  state.imports = state.imports.filter(i => i.id !== importId);
  state.sales   = state.sales.filter(s => s.importId !== importId);
  showToast('Import supprimé', 'success');
  updateNavBadge();
  showPharmaDetail(pharmacyId);
}

async function deleteImportFromHistory(importId, pharmacyId) {
  if (!confirm('Supprimer cet import et toutes ses ventes ?')) return;
  const imp = state.imports.find(i => i.id === importId);
  const { error } = await sb.from('imports').delete().eq('id', importId);
  if (error) { showToast('Erreur suppression', 'error'); return; }
  await deleteImportFile(imp?.filePath);
  state.imports = state.imports.filter(i => i.id !== importId);
  state.sales   = state.sales.filter(s => s.importId !== importId);
  showToast('Import supprimé', 'success');
  updateNavBadge();
  renderImport();
}

async function deletePharmacy(pharmacyId) {
  const pharma = state.pharmacies.find(p => p.id === pharmacyId);
  if (!confirm(`Supprimer "${pharma?.name}" et toutes ses données ?`)) return;
  // Supprimer les fichiers Storage associés aux imports de cette pharmacie
  const pharmaImports = state.imports.filter(i => i.pharmacyId === pharmacyId && i.filePath);
  for (const imp of pharmaImports) {
    await deleteImportFile(imp.filePath);
  }
  const { error } = await sb.from('pharmacies').delete().eq('id', pharmacyId);
  if (error) { showToast('Erreur suppression', 'error'); return; }
  state.pharmacies = state.pharmacies.filter(p => p.id !== pharmacyId);
  state.imports    = state.imports.filter(i => i.pharmacyId !== pharmacyId);
  state.sales      = state.sales.filter(s => s.pharmacyId !== pharmacyId);
  showToast(`${pharma?.name} supprimée`, 'success');
  updateNavBadge();
  renderPharmacies();
}

function exportPharmacyCSV(pharmacyId) {
  const pharma = state.pharmacies.find(p => p.id === pharmacyId);
  if (!pharma) return;
  const allPhSales = getSales({ pharmacyId: pharma.id });
  const { year: curY, month: curM } = getCurrentPeriod(allPhSales.length ? allPhSales : getSales());
  const salesData = getSales({ pharmacyId: pharma.id, year: curY, month: curM });

  const header = ['Produit','Code','Qté','PU Net HT','Mnt Net HT','Mois','Année'];
  const rows = salesData.map(s => [
    `"${(s.artDesignation||'').replace(/"/g,'""')}"`,
    s.artCode||'', s.qte.toFixed(2), s.puNet.toFixed(4),
    s.mntNetHt.toFixed(4), s.month, s.year,
  ]);
  const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pharma.name.replace(/\s+/g,'_')}_${monthName(curM)}_${curY}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Export CSV — ${salesData.length} lignes`, 'success');
}

// ── PRODUITS ──────────────────────────────────
let prodSearch  = '';
let prodFamille = 'tous';
let prodSortCol = 'ca';
let prodSortAsc = false;

function renderProduits() {
  const sales = getSales();

  // ── KPIs par famille ─────────────────────────
  const familyKpis = Object.keys(CATS).map(k => {
    const fSales = sales.filter(s => classifyProduct(s) === k);
    return {
      key: k, ...CATS[k],
      ca:    sumCA(fSales),
      marge: sumMarge(fSales),
      taux:  margePct(fSales),
      nb:    new Set(fSales.map(s => s.artDesignation)).size,
    };
  }).filter(f => f.ca > 0).sort((a, b) => b.ca - a.ca);

  // ── Top produits pour le graphique ───────────
  let chartProds = topProducts(sales, 500);
  if (prodFamille === 'froid') {
    chartProds = chartProds.filter(p => p.froid);
  } else if (prodFamille !== 'tous') {
    chartProds = chartProds.filter(p => p.cat === prodFamille);
  }
  chartProds = chartProds
    .map(p => ({ ...p, taux: (p.ca + p.marge) > 0 ? p.marge / (p.ca + p.marge) * 100 : 0 }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10);

  const selCat = prodFamille !== 'tous' && prodFamille !== 'froid' ? CATS[prodFamille] : null;
  const chartColor = selCat ? selCat.color : '#0057FF';
  const chartTitle = prodFamille === 'tous' ? 'Top 10 produits — Toutes familles'
    : prodFamille === 'froid' ? 'Top 10 produits ❄️ Froid'
    : `Top 10 produits — ${selCat.label}`;

  // ── Opportunités sous-exploitées ─────────────
  const ourNorms = new Set(topProducts(sales, 1000).map(p => p.name.trim().toUpperCase().replace(/\s+/g,' ')));
  const opps = sales.length && typeof BENCHMARK !== 'undefined'
    ? BENCHMARK
        .filter(b => b.rot_pharma_jan26 > 3 && !ourNorms.has(b.designation.trim().toUpperCase().replace(/\s+/g,' ')))
        .sort((a, b) => b.rot_pharma_jan26 - a.rot_pharma_jan26)
        .slice(0, 10)
    : [];

  // ── Chips famille ─────────────────────────────
  const familles = [
    { key: 'tous',      label: 'Vue globale', color: '#8899BB' },
    { key: 'pp',        label: 'PP',          color: CATS.pp.color },
    { key: 'mi',        label: 'MI',          color: CATS.mi.color },
    { key: 'ch',        label: 'CH',          color: CATS.ch.color },
    { key: 'biosim',    label: 'Biosim',      color: CATS.biosim.color },
    { key: 'generique', label: 'Générique',   color: CATS.generique.color },
    { key: 'nr',        label: 'NR',          color: CATS.nr.color },
    { key: 'froid',     label: '❄️ Froid',    color: '#00C6FF' },
  ];
  const chipsHtml = familles.map(f => {
    const active = prodFamille === f.key;
    return `<button onclick="prodFamille='${f.key}';renderProduits()" style="
      padding:5px 14px;border-radius:20px;border:1px solid ${active ? f.color : 'var(--border2)'};
      background:${active ? f.color + '22' : 'transparent'};color:${active ? f.color : 'var(--text2)'};
      cursor:pointer;font-size:12px;font-weight:${active ? '600' : '400'};white-space:nowrap;transition:all .15s
    ">${f.label}</button>`;
  }).join('');

  // ── Family KPI cards ──────────────────────────
  const familyKpiHtml = familyKpis.map(f => `
    <div class="kpi-card" style="cursor:pointer;border-top:3px solid ${f.color};${prodFamille === f.key ? 'box-shadow:0 0 0 2px '+f.color+'55' : ''}" onclick="prodFamille='${f.key}';renderProduits()">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:18px">${f.icon}</span>
        <span style="font-size:12px;font-weight:700;color:${f.color};text-transform:uppercase;letter-spacing:.5px">${f.label}</span>
      </div>
      <div style="font-size:20px;font-weight:800;color:var(--text1)">${fmt(f.ca)}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">CA HT</div>
      <div style="display:flex;gap:12px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border2)">
        <div><div style="font-size:13px;font-weight:700;color:var(--mint)">${fmt(f.marge)}</div><div style="font-size:10px;color:var(--text3)">Marge</div></div>
        <div><div style="font-size:13px;font-weight:700;color:${f.taux > 15 ? 'var(--mint)' : 'var(--amber)'}">${f.taux.toFixed(1)}%</div><div style="font-size:10px;color:var(--text3)">Taux</div></div>
        <div><div style="font-size:13px;font-weight:700;color:var(--text2)">${f.nb}</div><div style="font-size:10px;color:var(--text3)">Réfs</div></div>
      </div>
    </div>`).join('');

  // ── Opportunités HTML ─────────────────────────
  const oppsHtml = opps.map((b, i) => {
    const cat = CATS[b.categorie] || CATS.mi;
    const fd = b.is_froid ? ' <span style="font-size:11px">❄️</span>' : '';
    return `<tr>
      <td>${renderRank(i)}</td>
      <td class="td-name">${b.designation}${fd}</td>
      <td><span style="font-size:11px;padding:2px 7px;border-radius:4px;background:${cat.color}22;color:${cat.color}">${cat.label}</span></td>
      <td class="td-num" style="text-align:right">${b.rot_pharma_jan26.toFixed(1)}</td>
      <td class="td-num" style="text-align:right">${fmt(b.prix_ip)}</td>
      <td class="td-num" style="text-align:right">${b.yoy_jan !== null ? `<span style="color:${b.yoy_jan >= 0 ? 'var(--mint)' : 'var(--rose)'}">${b.yoy_jan >= 0 ? '▲' : '▼'} ${Math.abs(b.yoy_jan).toFixed(1)}%</span>` : '—'}</td>
    </tr>`;
  }).join('');

  document.getElementById('prod-content').innerHTML = `
    ${familyKpis.length ? `
    <div class="kpi-grid fade-up" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin-bottom:24px">
      ${familyKpiHtml}
    </div>` : ''}

    ${!sales.length ? emptyState('📊', 'Aucune donnée', 'Importez des fichiers Excel pour analyser votre portefeuille') : `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header" style="flex-wrap:wrap;gap:12px">
        <div>
          <div class="card-title">${chartTitle}</div>
          <div class="card-subtitle">CA HT vs Marge · cliquez une famille pour zoomer</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${chipsHtml}</div>
      </div>
      <div class="card-body">
        ${chartProds.length
          ? '<div class="chart-wrap" style="height:300px"><canvas id="chart-produits-bar"></canvas></div>'
          : emptyState('💊', 'Aucun produit', 'Aucune donnée pour cette famille')}
      </div>
    </div>`}

    ${opps.length ? `
    <div class="card fade-up">
      <div class="card-header">
        <div>
          <div class="card-title">Opportunités sous-exploitées</div>
          <div class="card-subtitle">Produits IP à forte rotation nationale absents de votre portefeuille</div>
        </div>
        <span class="badge badge-blue" style="background:rgba(0,87,255,.12);color:var(--blue)">${opps.length} produits</span>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Désignation</th><th>Famille</th>
            <th style="text-align:right">Rot./pharma/mois</th>
            <th style="text-align:right">Prix IP HT</th>
            <th style="text-align:right">YoY Jan</th>
          </tr></thead>
          <tbody>${oppsHtml}</tbody>
        </table>
      </div>
    </div>` : ''}
  `;

  if (chartProds.length && sales.length) {
    setTimeout(() => {
      const ctx = document.getElementById('chart-produits-bar');
      if (!ctx) return;
      if (state.charts['produits-bar']) state.charts['produits-bar'].destroy();
      const sorted = [...chartProds].sort((a, b) => a.ca - b.ca);
      state.charts['produits-bar'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sorted.map(p => p.name.length > 38 ? p.name.slice(0, 38) + '…' : p.name),
          datasets: [
            { label: 'CA HT', data: sorted.map(p => +p.ca.toFixed(2)), backgroundColor: chartColor + 'BB', borderColor: chartColor, borderWidth: 2, borderRadius: 5 },
            { label: 'Marge', data: sorted.map(p => +p.marge.toFixed(2)), backgroundColor: '#00E5A0BB', borderColor: '#00E5A0', borderWidth: 2, borderRadius: 5 },
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { color: '#64748B', font: { size: 11 }, boxWidth: 12 } },
            tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.x) } }
          },
          scales: {
            x: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { color: '#64748B', font: { size: 11 }, callback: v => fmt(v) } },
            y: { grid: { display: false }, ticks: { color: '#0F172A', font: { size: 11 } } },
          }
        }
      });
    }, 50);
  }
}

// ── IMPORT ────────────────────────────────────
let pendingFiles = [];

function renderImport() {
  const recentImports = [...state.imports].sort((a,b) => new Date(b.importedAt) - new Date(a.importedAt)).slice(0, 20);

  const allSalesRaw = getSales();
  const periodRaw = getCurrentPeriod(allSalesRaw);
  const curY = periodRaw.year  || new Date().getFullYear();
  const curM = periodRaw.month || (new Date().getMonth() + 1);

  const totalPharmas = state.pharmacies.length;
  const coveredPharmaIds = new Set(
    state.imports.filter(i => i.year === curY && i.month === curM).map(i => i.pharmacyId)
  );
  const coveredCount = state.pharmacies.filter(p => coveredPharmaIds.has(p.id)).length;
  const coveragePct = totalPharmas > 0 ? Math.round(coveredCount / totalPharmas * 100) : 0;
  const coverageColor = coveragePct >= 80 ? 'var(--mint)' : coveragePct >= 50 ? 'var(--amber)' : 'var(--rose)';

  const lastImport = recentImports[0];
  const lastImportDate = lastImport
    ? new Date(lastImport.importedAt).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'})
    : '—';

  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    let m = curM - i; let y = curY;
    while (m <= 0) { m += 12; y--; }
    last6Months.push({ year: y, month: m });
  }
  const monthShort = m => ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][m-1];

  const matrixHtml = totalPharmas > 0 ? `
    <div style="overflow-x:auto">
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:var(--text3);font-weight:500;border-bottom:1px solid var(--border2)">Pharmacie</th>
            ${last6Months.map(p => `<th style="text-align:center;padding:8px 12px;font-size:12px;color:var(--text3);font-weight:500;border-bottom:1px solid var(--border2);white-space:nowrap">${monthShort(p.month)} ${String(p.year).slice(2)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${state.pharmacies.map(ph => `
            <tr>
              <td style="padding:8px 12px;font-size:13px;font-weight:500;color:var(--text);display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)">
                <span style="width:8px;height:8px;border-radius:50%;background:${ph.color};flex-shrink:0"></span>${ph.name}
              </td>
              ${last6Months.map(p => {
                const has = state.imports.some(i => i.pharmacyId === ph.id && i.year === p.year && i.month === p.month);
                return `<td style="text-align:center;padding:8px 12px;border-bottom:1px solid var(--border)">
                  ${has
                    ? `<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--mint);box-shadow:0 0 6px var(--mint)" title="Importé"></span>`
                    : `<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--bg3);border:1px solid var(--border2)" title="Manquant"></span>`}
                </td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  const missingPharmas = state.pharmacies.filter(p => !coveredPharmaIds.has(p.id));
  const alertesHtml = totalPharmas > 0 ? (
    missingPharmas.length === 0
      ? `<div style="padding:14px 20px;background:rgba(0,229,160,.08);border-radius:var(--rs);border:1px solid rgba(0,229,160,.2);font-size:13px;color:var(--mint)">✅ Toutes les pharmacies sont couvertes ce mois</div>`
      : `<div class="alert-feed">${missingPharmas.map(ph => `
          <div class="alert-item">
            <div class="alert-icon" style="background:rgba(255,77,109,.1);color:var(--rose)">⚠</div>
            <div class="alert-body">
              <div class="alert-title">${ph.name}</div>
              <div class="alert-sub">Aucun import pour ${monthName(curM)} ${curY}</div>
            </div>
          </div>`).join('')}
        </div>`
  ) : '';

  document.getElementById('import-content').innerHTML = `
    <div class="fade-up">
      <div class="section-title">Collecte de données</div>
      <div class="section-sub">Suivi de la couverture de collecte et import des fichiers Excel</div>

      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
        <div class="kpi-card kc-g">
          <div class="kpi-icon">🏥</div>
          <div class="kpi-value">${coveredCount} / ${totalPharmas}</div>
          <div class="kpi-label">Pharmacies couvertes ce mois</div>
        </div>
        <div class="kpi-card" style="background:var(--glass2)">
          <div class="kpi-icon" style="color:${coverageColor}">📊</div>
          <div class="kpi-value" style="color:${coverageColor}">${coveragePct}%</div>
          <div class="kpi-label">Couverture ${monthName(curM)} ${curY}</div>
          <div style="margin-top:10px;height:6px;border-radius:3px;background:var(--bg3);overflow:hidden">
            <div style="height:100%;width:${coveragePct}%;background:${coverageColor};transition:width .4s"></div>
          </div>
        </div>
        <div class="kpi-card kc-b">
          <div class="kpi-icon">📅</div>
          <div class="kpi-value" style="font-size:16px">${lastImportDate}</div>
          <div class="kpi-label">Dernière collecte</div>
        </div>
      </div>

      ${totalPharmas > 0 ? `
      <div class="card fade-up" style="margin-bottom:24px">
        <div class="card-header">
          <div>
            <div class="card-title">Matrice de couverture</div>
            <div class="card-subtitle">6 derniers mois — rond vert = import reçu, rond gris = manquant</div>
          </div>
        </div>
        ${matrixHtml}
      </div>` : emptyState('🏥','Aucune pharmacie','Importez un premier fichier pour démarrer')}

      ${totalPharmas > 0 ? `
      <div class="card fade-up" style="margin-bottom:24px">
        <div class="card-header">
          <div>
            <div class="card-title">Pharmacies manquantes ce mois</div>
            <div class="card-subtitle">${monthName(curM)} ${curY} — pharmacies sans import reçu</div>
          </div>
          ${missingPharmas.length > 0 ? `<span class="badge badge-rose">${missingPharmas.length} manquant${missingPharmas.length>1?'s':''}</span>` : ''}
        </div>
        <div style="padding:12px 20px">${alertesHtml}</div>
      </div>` : ''}

      <div class="card fade-up" style="margin-bottom:24px">
        <div class="card-header">
          <div class="card-title">Importer des fichiers</div>
          <div class="card-subtitle">Glissez vos fichiers Excel (.xlsx, .xls) — la pharmacie est détectée automatiquement</div>
        </div>
        <div style="padding:20px">
          <div class="import-zone" id="import-zone" onclick="document.getElementById('file-input').click()" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleDrop(event)">
            <input type="file" id="file-input" accept=".xlsx,.xls" multiple onchange="handleFiles(this.files)">
            <div class="import-zone-icon">📂</div>
            <div class="import-zone-title">Glissez vos fichiers ici</div>
            <div class="import-zone-sub">Formats acceptés : <code style="background:var(--bg3);padding:2px 6px;border-radius:4px">WML_MM_YYYY.xlsx</code> (multi-pharmacies) ou <code style="background:var(--bg3);padding:2px 6px;border-radius:4px">Phie de la republique 04 26.xlsx</code> (mono-pharmacie)</div>
          </div>
          <div id="pending-list" class="import-list" style="${pendingFiles.length ? '' : 'display:none'}"></div>
        </div>
      </div>

      ${recentImports.length ? `
      <div class="card fade-up">
        <div class="card-header">
          <div class="card-title">Historique des imports</div>
          <div class="card-subtitle">20 derniers imports</div>
        </div>
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
                <td style="display:flex;gap:5px;align-items:center">
                  ${imp.filePath ? `<button class="btn btn-ghost" style="color:var(--blue);border-color:rgba(0,87,255,.3);padding:3px 8px;font-size:11px" onclick="downloadImportFile('${imp.filePath}')" title="Télécharger Excel original">⬇</button>` : ''}
                  <button class="btn btn-ghost" style="color:var(--rose);border-color:rgba(220,38,38,.2);padding:3px 10px;font-size:11px" onclick="deleteImportFromHistory('${imp.id}','${imp.pharmacyId}')">🗑</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
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
        <div class="card-header"><div class="card-title">Créer une pharmacie manuellement</div></div>
        <div class="card-body">
          <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
            <div style="flex:1;min-width:160px">
              <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Nom de la pharmacie</label>
              <input id="admin-pharma-name" type="text" placeholder="Ex : Pharmacie du Centre"
                style="width:100%;padding:8px 10px;border:1px solid var(--border2);border-radius:8px;background:var(--bg2);font-size:13px;color:var(--text);box-sizing:border-box">
            </div>
            <div style="width:90px">
              <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:4px">Code (4 car.)</label>
              <input id="admin-pharma-code" type="text" maxlength="5" placeholder="PDC"
                style="width:100%;padding:8px 10px;border:1px solid var(--border2);border-radius:8px;background:var(--bg2);font-size:13px;color:var(--text);box-sizing:border-box;text-transform:uppercase">
            </div>
            <button class="btn btn-primary" onclick="addPharmacy()" style="white-space:nowrap">+ Créer</button>
          </div>
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

async function addPharmacy() {
  const nameEl = document.getElementById('admin-pharma-name');
  const codeEl = document.getElementById('admin-pharma-code');
  if (!nameEl || !codeEl) return;
  const name = nameEl.value.trim();
  if (!name) { showToast('Nom de pharmacie requis', 'error'); return; }
  const existing = state.pharmacies.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) { showToast('Cette pharmacie existe déjà', 'error'); return; }
  const code  = codeEl.value.trim().toUpperCase().slice(0, 5) ||
                name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 4);
  const color = PHARMA_COLORS[state.pharmacies.length % PHARMA_COLORS.length];
  const { data, error } = await sb.from('pharmacies').insert({ name, code, color }).select().single();
  if (error) { showToast('Erreur création pharmacie : ' + error.message, 'error'); return; }
  state.pharmacies.push({ id: data.id, name: data.name, code: data.code, color: data.color });
  showToast(`Pharmacie "${data.name}" créée`, 'success');
  updateNavBadge();
  renderAdmin();
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
  if (benchCat === 'froid')          data = data.filter(d => isFroidBench(d));
  else if (benchCat === 'generique') data = data.filter(d => isGenerique(d));
  else if (benchCat === 'biosim')    data = data.filter(d => isBiosim(d));
  else if (benchCat === 'nr')        data = data.filter(d => isNonRembourse(d));
  else if (benchCat !== 'tous')      data = data.filter(d => d.categorie === benchCat);
  if (benchSearch) {
    const q = benchSearch.toLowerCase();
    data = data.filter(d => d.designation.toLowerCase().includes(q) || (d.cip13||'').includes(q));
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
    { key: 'tous',      label: 'Tous' },
    { key: 'pp',        label: 'PP <4.8€' },
    { key: 'mi',        label: 'Médian' },
    { key: 'ch',        label: '>480€' },
    { key: 'froid',     label: '❄️ Froid' },
    { key: 'nr',        label: 'Med010' },
    { key: 'biosim',    label: 'Biosim' },
    { key: 'generique', label: 'Génériques' },
  ];

  const chipsHtml = cats.map(c => {
    const active = benchCat === c.key;
    return `<button onclick="benchCat='${c.key}';renderBenchmark()"
      onmouseover="if(!${active})this.style.background='var(--bg3)';this.style.borderColor='var(--blue)'"
      onmouseout="if(!${active}){this.style.background='transparent';this.style.borderColor='var(--border2)'}"
      style="padding:5px 14px;border-radius:20px;border:1px solid ${active ? 'var(--blue)' : 'var(--border2)'};
      background:${active ? 'var(--blue-bg)' : 'transparent'};color:${active ? 'var(--blue)' : 'var(--text2)'};
      cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;transition:all .15s
    ">${c.label}</button>`;
  }).join('');

  function thB(col, label, align='right') {
    const active = benchSortCol === col;
    const arrow = active ? `<span style="color:var(--blue);margin-left:3px">${benchSortAsc ? '↑' : '↓'}</span>` : '';
    return `<th style="text-align:${align};cursor:pointer;user-select:none;color:${active?'var(--blue)':'var(--text2)'};font-family:Syne,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;background:var(--bg);position:sticky;top:0;z-index:1" onclick="benchSortCol='${col}';benchSortAsc=${active?!benchSortAsc:false};renderBenchmark()">${label}${arrow}</th>`;
  }

  const rowsHtml = data.slice(0, 200).map((d, i) => {
    const rotColor = d.rot_pharma_jan26 > 10 ? 'var(--mint)' : d.rot_pharma_jan26 > 1 ? 'var(--amber)' : 'var(--text3)';
    const cc = (CATS[d.categorie] || CATS.mi).color;
    const froidTag = isFroidBench(d) ? ' <span title="Thermosensible" style="font-size:11px">❄️</span>' : '';
    const yoy = d.yoy_jan != null
      ? `<span style="font-size:11px;font-weight:600;color:${d.yoy_jan > 5 ? 'var(--mint)' : d.yoy_jan < -5 ? 'var(--rose)' : 'var(--text3)'}">${d.yoy_jan > 0 ? '▲' : '▼'} ${Math.abs(d.yoy_jan).toFixed(0)}%</span>`
      : '<span style="color:var(--text4);font-size:11px">—</span>';
    const prixDisplay = d.prix_ip > 0
      ? `<span style="font-size:11px;color:var(--blue)">${fmtP(d.prix_ip)}</span>`
      : '<span style="color:var(--text4);font-size:11px">—</span>';
    return `<tr style="transition:background .12s" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
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

  const rotMoy = (() => {
    const withA = BENCHMARK.filter(d => d.has_ameli && d.rot_pharma_jan26 != null);
    return withA.length ? withA.reduce((s, d) => s + d.rot_pharma_jan26, 0) / withA.length : 0;
  })();
  const croissantCount = BENCHMARK.filter(d => d.yoy_jan != null && d.yoy_jan > 0).length;

  const catKeys = ['pp','mi','ch','biosim','generique','nr'];
  const catCardsHtml = catKeys.map(key => {
    const cat = CATS[key] || CATS.mi;
    const prods = key === 'biosim'    ? BENCHMARK.filter(d => isBiosim(d))
      : key === 'generique' ? BENCHMARK.filter(d => isGenerique(d))
      : key === 'nr'        ? BENCHMARK.filter(d => isNonRembourse(d))
      : BENCHMARK.filter(d => d.categorie === key);
    const prodCount = prods.length;
    const caTotal = prods.reduce((s, d) => s + (d.ip_ca || 0), 0);
    const ameliProds = prods.filter(d => d.has_ameli && d.rot_pharma_jan26 != null);
    const rotAvg = ameliProds.length ? ameliProds.reduce((s, d) => s + d.rot_pharma_jan26, 0) / ameliProds.length : null;
    const yoyProds = prods.filter(d => d.yoy_jan != null);
    const yoyAvg = yoyProds.length ? yoyProds.reduce((s, d) => s + d.yoy_jan, 0) / yoyProds.length : null;
    const cc = cat.color;
    return `
      <div style="border-radius:var(--rs);overflow:hidden;background:var(--glass2);border:1px solid var(--border2)">
        <div style="padding:10px 14px;background:${cc}22;border-bottom:1px solid ${cc}44;display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">${cat.icon}</span>
          <span style="font-size:12px;font-weight:700;color:${cc};text-transform:uppercase;letter-spacing:.5px">${cat.label}</span>
        </div>
        <div style="padding:12px 14px;display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span style="color:var(--text3)">Produits IP</span>
            <span style="font-weight:600">${fmtNum(prodCount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span style="color:var(--text3)">CA IP</span>
            <span style="font-weight:600">${fmt(caTotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span style="color:var(--text3)">Rotation moy.</span>
            <span style="font-weight:600;color:var(--amber)">${rotAvg != null ? rotAvg.toFixed(1)+' boîtes' : '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span style="color:var(--text3)">YoY moy.</span>
            <span style="font-weight:600;color:${yoyAvg != null ? (yoyAvg > 0 ? 'var(--mint)' : 'var(--rose)') : 'var(--text3)'}">${yoyAvg != null ? (yoyAvg > 0 ? '+' : '') + yoyAvg.toFixed(1) + '%' : '—'}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  const ameliOnly = BENCHMARK.filter(d => d.has_ameli && d.rot_pharma_jan26 != null);
  const top3rot = [...ameliOnly].sort((a,b) => b.rot_pharma_jan26 - a.rot_pharma_jan26).slice(0,3);
  const yoyAll = BENCHMARK.filter(d => d.yoy_jan != null);
  const top3yoyUp = [...yoyAll].sort((a,b) => b.yoy_jan - a.yoy_jan).slice(0,3);
  const top3yoyDown = [...yoyAll].sort((a,b) => a.yoy_jan - b.yoy_jan).slice(0,3);

  const insightFeed = [
    ...top3rot.map(d => `<div class="alert-item"><div class="alert-icon" style="background:rgba(0,229,160,.1);color:var(--mint)">↑</div><div class="alert-body"><div class="alert-title">Top rotation : ${d.designation}</div><div class="alert-sub">${d.rot_pharma_jan26.toFixed(1)} boîtes/pharma/mois</div></div></div>`),
    ...top3yoyUp.map(d => `<div class="alert-item"><div class="alert-icon" style="background:rgba(0,229,160,.1);color:var(--mint)">▲</div><div class="alert-body"><div class="alert-title">Plus forte croissance : ${d.designation}</div><div class="alert-sub">+${d.yoy_jan.toFixed(1)}% YoY</div></div></div>`),
    ...top3yoyDown.map(d => `<div class="alert-item"><div class="alert-icon" style="background:rgba(255,77,109,.1);color:var(--rose)">▼</div><div class="alert-body"><div class="alert-title">Plus forte baisse : ${d.designation}</div><div class="alert-sub">${d.yoy_jan.toFixed(1)}% YoY</div></div></div>`),
  ].join('');

  document.getElementById('bench-content').innerHTML = `
    <div class="fade-up">
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:28px">
        <div class="kpi-card kc-b">
          <div class="kpi-icon">📦</div>
          <div class="kpi-value">${fmtNum(BENCHMARK.length)}</div>
          <div class="kpi-label">Produits référencés IP</div>
        </div>
        <div class="kpi-card kc-g">
          <div class="kpi-icon">💰</div>
          <div class="kpi-value">${fmt(totalIPCa)}</div>
          <div class="kpi-label">CA IP total</div>
        </div>
        <div class="kpi-card kc-p">
          <div class="kpi-icon">🔄</div>
          <div class="kpi-value">${rotMoy.toFixed(1)}</div>
          <div class="kpi-label">Rotation moy./pharma/mois</div>
        </div>
        <div class="kpi-card" style="background:var(--glass2);box-shadow:0 2px 12px rgba(0,0,0,.06)">
          <div class="kpi-icon" style="color:var(--mint)">📈</div>
          <div class="kpi-value" style="color:var(--mint)">${fmtNum(croissantCount)}</div>
          <div class="kpi-label">Produits marché croissant</div>
        </div>
      </div>

      <div class="card fade-up" style="margin-bottom:24px">
        <div class="card-header">
          <div>
            <div class="card-title">Répartition du portefeuille IP par famille</div>
            <div class="card-subtitle">Analyse par catégorie — CA, rotation Ameli et tendance YoY</div>
          </div>
        </div>
        <div style="padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
          ${catCardsHtml}
        </div>
      </div>

      <div class="card fade-up" style="margin-bottom:24px">
        <div class="card-header">
          <div>
            <div class="card-title">Signaux marché</div>
            <div class="card-subtitle">Top rotations, plus fortes croissances et baisses — Jan 2026</div>
          </div>
        </div>
        <div class="alert-feed" style="padding:8px 20px 16px">${insightFeed}</div>
      </div>

      <div class="card fade-up">
        <div class="card-header" style="flex-wrap:wrap;gap:12px">
          <div>
            <div class="card-title">Référentiel produits IP</div>
            <div class="card-subtitle">${fmtNum(BENCHMARK.length)} produits · rotation nationale Jan 2026 ÷ 19 000 pharmacies</div>
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
          ${data.length > 200 ? `<div style="padding:12px 20px;font-size:12px;color:var(--text3)">${fmtNum(data.length)} résultats · affichage limité à 200 — affinez la recherche.</div>` : `<div style="padding:8px 20px;font-size:12px;color:var(--text3)">${fmtNum(data.length)} résultat${data.length !== 1 ? 's' : ''}</div>`}
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
    import:     'Import',
    admin:      'Administration',
    catalogue:  'Catalogue Produits IP',
    benchmark:  'Benchmark Marché',
    simulateur: 'Simulateur de panier',
    offilog:    'Offilog — Parapharmacie',
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  const renders = {
    dashboard:  renderDashboard,
    pharmacies: renderPharmacies,
    produits:   renderProduits,
    import:     renderImport,
    admin:      renderAdmin,
    catalogue:  renderCatalogue,
    benchmark:  renderBenchmark,
    simulateur: renderSimulator,
    offilog:    renderOffilog,
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

// ── CATALOGUE ────────────────────────────────
let catQuery = '', catCatFilter = 'tous', catPageNum = 1;
const CAT_PER_PAGE = 30;
let catCurrentData = [];

function catGetList() {
  if (typeof BENCHMARK === 'undefined') return [];
  const q = catQuery.toLowerCase().trim();
  return BENCHMARK.filter(b => {
    if (q && !b.designation.toLowerCase().includes(q) && !(b.cip13 || '').includes(q)) return false;
    if (catCatFilter === 'froid')     return isFroidBench(b);
    if (catCatFilter === 'generique') return isGenerique(b);
    if (catCatFilter === 'biosim')    return isBiosim(b);
    if (catCatFilter === 'nr')        return isNonRembourse(b);
    if (catCatFilter === 'ameli')     return b.has_ameli;
    if (catCatFilter !== 'tous')      return b.categorie === catCatFilter;
    return true;
  });
}

function catAddToSim(i) {
  const b = catCurrentData[i];
  if (!b) return;
  const already = state.sim.items.find(it => it.designation === b.designation);
  if (already) { showToast('Déjà dans le simulateur', 'info'); return; }
  const puNet = b.prix_ip > 0 ? b.prix_ip : (b.ip_qty > 0 ? b.ip_ca / b.ip_qty : 0);
  state.sim.items.push({
    designation: b.designation,
    code:        b.cip13 || '',
    cat:         b.categorie === 'froid' ? 'mi' : (b.categorie || 'mi'),
    froid:       isFroidBench(b),
    puNet,
    puBrut:      puNet * 1.05,
    qty:         1,
  });
  showToast(`"${b.designation.slice(0, 28)}…" ajouté au simulateur ✓`, 'success');
  renderCatalogue();
}

function catGoPage(p) { catPageNum = p; renderCatalogue(); }

function renderCatalogue() {
  const container = document.getElementById('cat-content');
  if (!container) return;

  if (typeof BENCHMARK === 'undefined' || !BENCHMARK.length) {
    container.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;padding:40px;color:var(--text3)">Données benchmark non chargées.</div></div>`;
    return;
  }

  catCurrentData = catGetList();
  const totalPages = Math.max(1, Math.ceil(catCurrentData.length / CAT_PER_PAGE));
  if (catPageNum > totalPages) catPageNum = 1;
  const startIdx = (catPageNum - 1) * CAT_PER_PAGE;
  const page = catCurrentData.slice(startIdx, startIdx + CAT_PER_PAGE);

  // ── KPIs ─────────────────────────────────────
  const nPrix  = BENCHMARK.filter(b => b.prix_ip > 0).length;
  const nAmeli = BENCHMARK.filter(b => b.has_ameli).length;
  const nFroid = BENCHMARK.filter(b => isFroidBench(b)).length;

  // ── Category tabs ────────────────────────────
  const tabDefs = [
    { key: 'tous',      label: 'Tous' },
    { key: 'pp',        label: '✓ Petit prix' },
    { key: 'mi',        label: '📊 Intermédiaire' },
    { key: 'ch',        label: '💎 Cher' },
    { key: 'biosim',    label: '🧬 Biosimilaires' },
    { key: 'generique', label: '💊 Génériques' },
    { key: 'nr',        label: '🔴 Non remboursés' },
    { key: 'froid',     label: '❄️ Froid' },
    { key: 'ameli',     label: '🏥 Ameli' },
  ];
  const tabsHtml = tabDefs.map(t => {
    const active = catCatFilter === t.key;
    return `<button onclick="catCatFilter='${t.key}';catPageNum=1;renderCatalogue()"
      onmouseover="if(!${active}){this.style.background='var(--blue-bg)';this.style.color='var(--blue)';this.style.borderColor='var(--blue)'}"
      onmouseout="if(!${active}){this.style.background='transparent';this.style.color='var(--text2)';this.style.borderColor='var(--border2)'}"
      style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid ${active ? 'var(--blue)' : 'var(--border2)'};background:${active ? 'var(--blue)' : 'transparent'};color:${active ? '#fff' : 'var(--text2)'};cursor:pointer;white-space:nowrap;transition:all .15s;${active ? 'box-shadow:0 2px 8px rgba(37,99,235,.25)' : ''}">${t.label}</button>`;
  }).join('');

  // ── Products ─────────────────────────────────
  const prodsHtml = page.length ? page.map((b, i) => {
    const globalIdx = startIdx + i;
    const cat    = CATS[b.categorie === 'froid' ? 'mi' : (b.categorie || 'mi')] || CATS.mi;
    const froid  = isFroidBench(b) ? '❄️ ' : '';
    const ameliTag   = b.has_ameli ? `<span style="font-size:10px;padding:1px 5px;background:rgba(0,229,160,.12);color:var(--mint);border-radius:4px">🏥 SS</span>` : '';
    const genTag     = isGenerique(b) ? `<span style="font-size:10px;padding:1px 5px;background:rgba(0,229,160,.08);color:#059669;border-radius:4px;border:1px solid rgba(5,150,105,.2)">💊 GEN</span>` : '';
    const biosimTag  = isBiosim(b) ? `<span style="font-size:10px;padding:1px 5px;background:rgba(155,92,255,.1);color:#9B5CFF;border-radius:4px;border:1px solid rgba(155,92,255,.2)">🧬 BIOSIM</span>` : '';
    const nrTag      = (!b.has_ameli && !isGenerique(b) && !isBiosim(b)) ? `<span style="font-size:10px;padding:1px 5px;background:rgba(255,107,53,.08);color:#FF6B35;border-radius:4px;border:1px solid rgba(255,107,53,.2)">🔴 NR</span>` : '';
    const rotTag     = b.rot_pharma_jan26 > 0 ? `<span style="font-size:10px;color:var(--text3)">↻ ${b.rot_pharma_jan26.toFixed(1)}/mois</span>` : '';
    const cipTag     = b.cip13 ? `<span style="font-size:10px;color:var(--text3)">CIP ${b.cip13}</span>` : '';
    const offreTag   = b.offre_ip > 0 ? `<span style="font-size:10px;padding:1px 5px;background:rgba(255,176,32,.12);color:var(--amber);border-radius:4px">Offre ${fmtP(b.offre_ip)}</span>` : '';
    const prix = b.prix_ip > 0
      ? `<div style="text-align:right"><div style="font-size:14px;font-weight:700;color:var(--blue)">${fmtP(b.prix_ip)}</div>${b.remise_pct > 0 ? `<div style="font-size:10px;color:var(--text3)">−${b.remise_pct.toFixed(1)}%</div>` : ''}</div>`
      : b.prix_ht > 0
        ? `<div style="font-size:14px;color:var(--text2)">${fmtP(b.prix_ht)}</div>`
        : `<div style="font-size:12px;color:var(--text3)">N/D</div>`;
    const inSim = state.sim.items.some(it => it.designation === b.designation);
    const addBtn = `<button onclick="catAddToSim(${globalIdx})"
      style="padding:5px 12px;border-radius:8px;border:1px solid ${inSim ? 'var(--mint)' : 'var(--blue)'};background:${inSim ? 'rgba(5,150,105,.1)' : 'var(--blue)'};color:${inSim ? 'var(--mint)' : '#fff'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;min-width:72px;transition:opacity .15s" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
      ${inSim ? '✓ Ajouté' : '+ Sim'}
    </button>`;
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border1);transition:background .15s;cursor:pointer" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${froid}${b.designation}</div>
        <div style="display:flex;gap:6px;margin-top:3px;align-items:center;flex-wrap:wrap">
          <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${cat.color}22;color:${cat.color}">${cat.label}</span>
          ${genTag}${biosimTag}${nrTag}${ameliTag}${offreTag}${rotTag}${cipTag}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">${prix}${addBtn}</div>
    </div>`;
  }).join('')
  : `<div style="padding:40px;text-align:center;color:var(--text3)">Aucun produit trouvé</div>`;

  // ── Pagination ───────────────────────────────
  let pagHtml = '';
  if (totalPages > 1) {
    const btns = [];
    if (catPageNum > 1) { btns.push(`<button class="cat-pag-btn" onclick="catGoPage(1)">«</button>`); btns.push(`<button class="cat-pag-btn" onclick="catGoPage(${catPageNum - 1})">‹</button>`); }
    let ps = Math.max(1, catPageNum - 3), pe = Math.min(totalPages, ps + 6);
    if (pe - ps < 6) ps = Math.max(1, pe - 6);
    for (let p = ps; p <= pe; p++) btns.push(`<button class="cat-pag-btn${p === catPageNum ? ' active' : ''}" onclick="catGoPage(${p})">${p}</button>`);
    if (catPageNum < totalPages) { btns.push(`<button class="cat-pag-btn" onclick="catGoPage(${catPageNum + 1})">›</button>`); btns.push(`<button class="cat-pag-btn" onclick="catGoPage(${totalPages})">»</button>`); }
    pagHtml = `<div style="display:flex;justify-content:center;gap:4px;padding:16px;flex-wrap:wrap">${btns.join('')}</div>`;
  }

  // ── Simulateur shortcut ──────────────────────
  const simCount = state.sim.items.length;
  const simBar = simCount > 0
    ? `<div class="card fade-up" style="margin-bottom:16px;background:linear-gradient(90deg,var(--blue-bg),transparent);border:1px solid rgba(37,99,235,.2);border-left:3px solid var(--blue)">
        <div class="card-body" style="display:flex;align-items:center;gap:16px;padding:12px 16px">
          <span style="font-size:20px">🛒</span>
          <div style="flex:1;font-size:13px;font-weight:600">${simCount} produit${simCount > 1 ? 's' : ''} dans le simulateur</div>
          <button class="btn btn-primary" onclick="navigate('simulateur')" style="font-size:12px;padding:6px 16px">Voir le simulateur →</button>
        </div>
      </div>`
    : '';

  container.innerHTML = `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px">
      <div class="card kpi-card fade-up"><div class="kpi-label">Produits IP</div><div class="kpi-value">${fmtNum(BENCHMARK.length)}</div></div>
      <div class="card kpi-card fade-up"><div class="kpi-label">Avec prix IP</div><div class="kpi-value" style="color:var(--blue)">${fmtNum(nPrix)}</div></div>
      <div class="card kpi-card fade-up"><div class="kpi-label">Remboursés SS</div><div class="kpi-value" style="color:var(--mint)">${fmtNum(nAmeli)}</div></div>
      <div class="card kpi-card fade-up"><div class="kpi-label">Thermosensibles</div><div class="kpi-value" style="color:var(--amber)">${fmtNum(nFroid)}</div></div>
    </div>

    ${simBar}

    <!-- Search + Filters -->
    <div class="card fade-up" style="margin-bottom:16px">
      <div class="card-body" style="padding:12px 16px">
        <div class="search-wrap" style="margin-bottom:12px">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Rechercher par nom ou CIP13…" value="${catQuery}"
            oninput="catQuery=this.value;catPageNum=1;renderCatalogue()"
            style="border:none;background:transparent;outline:none;flex:1;font-size:13px;color:var(--text)" autocomplete="off">
          ${catQuery ? `<button onclick="catQuery='';catPageNum=1;renderCatalogue()" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px">✕</button>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${tabsHtml}</div>
      </div>
    </div>

    <!-- Product list -->
    <div class="card fade-up">
      <div class="card-header">
        <div class="card-title">
          ${catCurrentData.length < BENCHMARK.length ? `${fmtNum(catCurrentData.length)} résultats` : `${fmtNum(BENCHMARK.length)} produits`}
        </div>
        <div style="font-size:12px;color:var(--text3)">Page ${catPageNum} / ${totalPages}</div>
      </div>
      ${prodsHtml}
      ${pagHtml}
    </div>`;
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
      puNet:       b.prix_ip > 0 ? b.prix_ip : (b.ip_qty > 0 ? b.ip_ca / b.ip_qty : 0),
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

function buildSuggestHtml() {
  const suggestions = simSuggestions(simSearchQuery);
  if (!simSearchQuery || !suggestions.length) return '';
  return `<div class="sim-suggestions">
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
  </div>`;
}

function simRefreshSuggestions() {
  const wrap = document.getElementById('sim-suggestions-wrap');
  if (wrap) wrap.innerHTML = buildSuggestHtml();
  const clearBtn = document.getElementById('sim-clear-btn');
  if (clearBtn) clearBtn.style.display = simSearchQuery ? '' : 'none';
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

  // Suggestions built on-demand via buildSuggestHtml() / simRefreshSuggestions()

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
                oninput="simSearchQuery=this.value;simRefreshSuggestions()"
                onkeydown="if(event.key==='Escape'){simSearchQuery='';simRefreshSuggestions()}"
                style="border:none;background:transparent;outline:none;flex:1;font-size:13px;color:var(--text)"
                autocomplete="off">
              <button id="sim-clear-btn" onclick="simSearchQuery='';simRefreshSuggestions()" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;display:${simSearchQuery ? '' : 'none'}">✕</button>
            </div>
          </div>
          <div id="sim-suggestions-wrap">${buildSuggestHtml()}</div>
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

  // Render bars
  if (state.sim.items.length) updateSimBars();
}

// ── OFFILOG ──────────────────────────────────
const OFFILOG_ORANGE = '#FF6B35';
const OFFILOG_PER    = 30;

const UNIVERS_META = {
  'Dermo / Hydratation / Réparation': { color:'#E91E8C', bg:'#fce4f0', icon:'💧' },
  'Bébé &amp; Famille':               { color:'#4CAF50', bg:'#e8f5e9', icon:'🍼' },
  'Solaires':                          { color:'#FF9800', bg:'#fff3e0', icon:'☀️' },
  'Capillaire':                        { color:'#9C27B0', bg:'#f3e5f5', icon:'💆' },
  'Hygiène corporelle':                { color:'#2196F3', bg:'#e3f2fd', icon:'🚿' },
  'Hygiène bucco-dentaire':            { color:'#00BCD4', bg:'#e0f7fa', icon:'🦷' },
  'Huiles essentielles / Aromathérapie':{ color:'#8BC34A', bg:'#f1f8e9', icon:'🌿' },
  'Vitalité / Immunité / Vitamines':   { color:'#FF5722', bg:'#fbe9e7', icon:'⚡' },
  'Premiers secours / Pansements':     { color:'#F44336', bg:'#ffebee', icon:'🩹' },
  'Allergies / Nez / Respiration':     { color:'#03A9F4', bg:'#e1f5fe', icon:'🌸' },
  'Stress / Sommeil':                  { color:'#673AB7', bg:'#ede7f6', icon:'🌙' },
  'Maquillage / Beauté':               { color:'#E91E63', bg:'#fce4ec', icon:'💄' },
  'Digestion / Transit / Microbiote':  { color:'#795548', bg:'#efebe9', icon:'🌱' },
  'Vétérinaire':                       { color:'#607D8B', bg:'#eceff1', icon:'🐾' },
  'Articulations / Mobilité':          { color:'#FF6B35', bg:'#fff0eb', icon:'🦴' },
  'Jambes légères / Circulation':      { color:'#F06292', bg:'#fce4ec', icon:'🦵' },
  'Minceur / Silhouette':              { color:'#AB47BC', bg:'#f3e5f5', icon:'✨' },
  'Anti-moustiques &amp; Voyage':      { color:'#26C6DA', bg:'#e0f7fa', icon:'🌍' },
  'Non classé':                        { color:'#90A4AE', bg:'#f5f7f9', icon:'📦' },
};
function univMeta(u) {
  return UNIVERS_META[u] || { color:'#90A4AE', bg:'#f5f7f9', icon:'📦' };
}
let offiQuery = '', offiRole = 'tous', offiUnivers = 'tous', offiMarque = 'tous', offiPageNum = 1;
let offiCurrentData = [];

const ROLE_META = {
  'Héros':           { color: '#FFD700', bg: '#FFD70022', icon: '⭐' },
  'Héros / Soutien': { color: '#FFD700', bg: '#FFD70018', icon: '⭐' },
  'Soutien fort':    { color: '#00E5A0', bg: '#00E5A018', icon: '💪' },
  'Soutien':         { color: '#64748B', bg: '#64748B18', icon: '→' },
  'Image':           { color: '#9B5CFF', bg: '#9B5CFF18', icon: '🎨' },
  'Opportunité':     { color: '#FF6B35', bg: '#FF6B3518', icon: '🎯' },
};

function roleMeta(role) {
  return ROLE_META[role] || { color: '#64748B', bg: '#64748B18', icon: '·' };
}

function fmtP(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function roleBadge(role) {
  const m = roleMeta(role);
  return `<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:${m.bg};color:${m.color};font-weight:700;letter-spacing:.1px;white-space:nowrap">${m.icon} ${role}</span>`;
}

function offiGetList() {
  if (typeof OFFILOG === 'undefined') return [];
  const q = offiQuery.toLowerCase().trim();
  let list = OFFILOG.filter(p => {
    if (q && !p.produit.toLowerCase().includes(q) &&
        !(p.ean || '').includes(q) &&
        !(p.marque || '').toLowerCase().includes(q)) return false;
    if (offiRole === 'bestsellers') return p.rang_vente != null;
    if (offiRole !== 'tous' && offiRole === 'offilog' && !p.dans_offilog) return false;
    if (offiRole !== 'tous' && offiRole !== 'offilog' && p.role !== offiRole) return false;
    if (offiUnivers !== 'tous' && p.univers !== offiUnivers) return false;
    if (offiMarque !== 'tous' && p.marque !== offiMarque) return false;
    return true;
  });
  // Trier par rang_vente si filtre best-sellers actif
  if (offiRole === 'bestsellers') list.sort((a, b) => (a.rang_vente || 999) - (b.rang_vente || 999));
  return list;
}

function offiGoPage(p) { offiPageNum = p; renderOffilog(); }
function offiSetRole(r) { offiRole = r; offiPageNum = 1; renderOffilog(); }
function offiSetUnivers(u) { offiUnivers = u; offiPageNum = 1; renderOffilog(); }
function offiSetMarque(m) { offiMarque = m; offiPageNum = 1; renderOffilog(); }

function renderOffilog() {
  const container = document.getElementById('offilog-content');
  if (!container) return;

  if (typeof OFFILOG === 'undefined' || !OFFILOG.length) {
    container.innerHTML = `<div class="card"><div style="text-align:center;padding:60px;color:var(--text3)">Données Offilog non chargées.</div></div>`;
    return;
  }

  offiCurrentData = offiGetList();
  const totalPages = Math.max(1, Math.ceil(offiCurrentData.length / OFFILOG_PER));
  if (offiPageNum > totalPages) offiPageNum = 1;
  const startIdx = (offiPageNum - 1) * OFFILOG_PER;
  const page     = offiCurrentData.slice(startIdx, startIdx + OFFILOG_PER);

  // ── Stats ─────────────────────────────────────
  const nTotal    = OFFILOG.length;
  const nOff      = OFFILOG.filter(p => p.dans_offilog).length;
  const nHeros    = OFFILOG.filter(p => p.role === 'Héros' || p.role === 'Héros / Soutien').length;
  const nOpps     = OFFILOG.filter(p => p.role === 'Opportunité').length;
  const nDrakkars = OFFILOG.filter(p => p.prix_drakkars != null && p.prix_drakkars > 0).length;
  const nCap3000  = OFFILOG.filter(p => p.prix_cap3000  != null && p.prix_cap3000  > 0).length;
  const nLive     = OFFILOG.filter(p => p.prix_live     != null && p.prix_live     > 0).length;
  const nImg      = OFFILOG.filter(p => p.img && p.img.length > 0).length;
  const margeArr  = OFFILOG.filter(p => p.marge_pct).map(p => p.marge_pct);
  const margeMoy  = margeArr.length ? margeArr.reduce((a, b) => a + b, 0) / margeArr.length : 0;
  const tauxOff   = nTotal > 0 ? nOff / nTotal * 100 : 0;

  // ── Univers counts ────────────────────────────
  const universCount = {};
  OFFILOG.forEach(p => { const u = p.univers || 'Non classé'; universCount[u] = (universCount[u] || 0) + 1; });
  const universSet = Object.keys(universCount).filter(u => u && u !== 'Non classé').sort((a, b) => universCount[b] - universCount[a]);
  const marqueSet  = [...new Set(OFFILOG.map(p => p.marque).filter(Boolean))].sort();

  // ── Universe tiles ────────────────────────────
  const univTiles = [{ key: 'tous', label: 'Tout voir', count: nTotal, color: OFFILOG_ORANGE, bg: '#fff0eb', icon: '🛍️' }]
    .concat(universSet.map(u => { const m = univMeta(u); return { key: u, label: u, count: universCount[u], color: m.color, bg: m.bg, icon: m.icon }; }))
    .map(t => {
      const active = offiUnivers === t.key || (t.key === 'tous' && offiUnivers === 'tous');
      return `<button onclick="offiSetUnivers('${t.key === 'tous' ? 'tous' : t.key.replace(/'/g,"\\'")}')"
        style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;padding:10px 14px;border-radius:14px;border:2px solid ${active ? t.color : 'transparent'};background:${active ? t.bg : 'var(--bg2)'};cursor:pointer;white-space:nowrap;transition:all .18s;flex-shrink:0;min-width:90px">
        <span style="font-size:20px;line-height:1">${t.icon}</span>
        <span style="font-size:11px;font-weight:700;color:${active ? t.color : 'var(--text2)'};max-width:90px;overflow:hidden;text-overflow:ellipsis;text-align:center">${t.label.split(' / ')[0].split(' &')[0]}</span>
        <span style="font-size:10px;font-weight:500;color:${active ? t.color : 'var(--text3)'};opacity:.8">${fmtNum(t.count)}</span>
      </button>`;
    }).join('');

  // ── Role chips ────────────────────────────────
  const nBest     = OFFILOG.filter(p => p.rang_vente != null).length;
  const roleTabs = [
    { key: 'tous',            label: 'Tous',             icon: '✦', color: '#64748B' },
    { key: 'bestsellers',     label: `Top ventes (${nBest})`, icon: '🏆', color: '#F59E0B' },
    { key: 'offilog',         label: 'Dans Offilog',     icon: '✓', color: OFFILOG_ORANGE },
    { key: 'Héros',           label: 'Héros',            icon: '⭐', color: '#F59E0B' },
    { key: 'Héros / Soutien', label: 'Héros/Soutien',    icon: '⭐', color: '#FBBF24' },
    { key: 'Soutien fort',    label: 'Soutien fort',     icon: '💪', color: '#3B82F6' },
    { key: 'Image',           label: 'Image',            icon: '🎨', color: '#9B5CFF' },
    { key: 'Opportunité',     label: 'Opportunités',     icon: '🎯', color: '#10B981' },
  ];
  const roleChips = roleTabs.map(t => {
    const active = offiRole === t.key;
    return `<button onclick="offiSetRole('${t.key.replace(/'/g,"\\'")}')"
      style="padding:5px 13px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid ${active ? t.color : 'var(--border2)'};background:${active ? t.color + '18' : 'transparent'};color:${active ? t.color : 'var(--text2)'};cursor:pointer;transition:all .15s;white-space:nowrap">
      ${t.icon} ${t.label}
    </button>`;
  }).join('');

  // ── Product cards ─────────────────────────────
  const cardsHtml = page.length ? page.map(p => {
    const um  = univMeta(p.univers || 'Non classé');
    const rm  = roleMeta(p.role);
    const hasIP   = p.prix_offilog != null && p.prix_offilog > 0;
    const hasLive = p.prix_live    != null && p.prix_live    > 0;
    const hasMaxi = p.prix_maxi    != null && p.prix_maxi    > 0;
    const hasDrak = p.prix_drakkars != null && p.prix_drakkars > 0;
    const hasCap  = p.prix_cap3000  != null && p.prix_cap3000  > 0;
    const hasImg  = p.img && p.img.length > 0;
    const hasMarge = p.marge_pct != null;
    const margeColor = !hasMarge ? 'var(--text3)' : p.marge_pct >= 40 ? '#10B981' : p.marge_pct >= 20 ? '#F59E0B' : '#EF4444';
    const margePct  = hasMarge ? Math.min(100, p.marge_pct) : 0;

    // Prix affiché = live en priorité, sinon Excel
    const prixDisplay = hasLive ? p.prix_live : (hasIP ? p.prix_offilog : null);

    // Price delta vs competitors
    let deltaHtml = '';
    if (prixDisplay && (hasDrak || hasCap)) {
      const concPrix = [hasDrak ? p.prix_drakkars : null, hasCap ? p.prix_cap3000 : null].filter(Boolean);
      const minConc = Math.min(...concPrix);
      const delta = minConc - prixDisplay;
      if (delta > 0.01) deltaHtml = `<span style="font-size:10px;font-weight:700;color:#10B981;background:#d1fae5;padding:1px 6px;border-radius:8px">−${fmtP(delta)} vs conc.</span>`;
      else if (delta < -0.01) deltaHtml = `<span style="font-size:10px;font-weight:700;color:#EF4444;background:#fee2e2;padding:1px 6px;border-radius:8px">+${fmtP(Math.abs(delta))} vs conc.</span>`;
    }

    const saisonBadge = p.saison && p.saison !== 'Toute année'
      ? `<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:#fef9c3;color:#92400e;font-weight:600">${p.saison === 'Printemps/Été' ? '☀️ P/É' : '❄️ A/H'}</span>`
      : '';
    const ipBadge = p.dans_offilog
      ? `<span style="font-size:10px;padding:2px 7px;border-radius:6px;background:${OFFILOG_ORANGE}22;color:${OFFILOG_ORANGE};font-weight:700;border:1px solid ${OFFILOG_ORANGE}44">IP</span>`
      : '';
    const liveBadge = hasLive
      ? `<span style="font-size:10px;padding:2px 7px;border-radius:6px;background:#dcfce7;color:#15803d;font-weight:700">● Live</span>`
      : '';
    const bestBadge = p.rang_vente != null
      ? `<span style="font-size:10px;padding:2px 7px;border-radius:6px;background:#fef3c7;color:#92400e;font-weight:800">🏆 #${p.rang_vente}</span>`
      : '';

    const competHtml = (hasDrak || hasCap) ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border1)">
        ${hasDrak ? `<div style="font-size:10px;color:var(--text3)">🛒 <span style="color:var(--text2);font-weight:600">${fmtP(p.prix_drakkars)}</span> <span style="opacity:.6">Drakkars</span></div>` : ''}
        ${hasCap  ? `<div style="font-size:10px;color:var(--text3)">🏪 <span style="color:var(--text2);font-weight:600">${fmtP(p.prix_cap3000)}</span> <span style="opacity:.6">Cap3000</span></div>` : ''}
      </div>` : '';

    return `<div style="background:var(--bg);border-radius:16px;border:1px solid var(--border1);overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .2s,transform .18s;cursor:default"
      onmouseover="this.style.boxShadow='0 8px 32px rgba(0,0,0,.12)';this.style.transform='translateY(-2px)'"
      onmouseout="this.style.boxShadow='';this.style.transform=''">
      <!-- Image produit ou stripe univers -->
      ${hasImg
        ? `<div style="height:140px;background:${um.bg};display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">
            <img src="${p.img}" alt="${p.produit.replace(/"/g,'')}" loading="lazy"
              style="max-height:130px;max-width:100%;object-fit:contain;padding:8px;transition:transform .3s"
              onerror="this.closest('div').innerHTML='<div style=\\'height:140px;background:linear-gradient(135deg,${um.bg},${um.color}22);display:flex;align-items:center;justify-content:center;font-size:32px\\'>${um.icon}</div>'"
              onmouseover="this.style.transform='scale(1.07)'" onmouseout="this.style.transform=''">
            <div style="position:absolute;top:8px;left:8px;display:flex;gap:4px">${bestBadge}${ipBadge}${liveBadge}${saisonBadge}</div>
          </div>`
        : `<div style="height:4px;background:linear-gradient(90deg,${um.color},${um.color}88)"></div>`
      }
      <div style="padding:14px 14px 12px;flex:1;display:flex;flex-direction:column;gap:0">
        <!-- Brand + badges (seulement si pas d'image, sinon déjà dans l'image) -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:6px">
          <span style="font-size:10px;font-weight:700;color:${um.color};text-transform:uppercase;letter-spacing:.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.marque || '—'}</span>
          ${!hasImg ? `<div style="display:flex;gap:4px;flex-shrink:0">${bestBadge}${ipBadge}${liveBadge}${saisonBadge}</div>` : ''}
        </div>
        <!-- Nom produit -->
        <div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:36px;margin-bottom:8px">${p.produit}</div>
        <!-- Tags -->
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">
          <span style="font-size:10px;padding:2px 7px;border-radius:20px;background:${um.bg};color:${um.color};font-weight:600;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">${um.icon} ${(p.univers||'Non classé').split(' / ')[0].split(' &')[0]}</span>
          <span style="font-size:10px;padding:2px 7px;border-radius:20px;background:${rm.bg};color:${rm.color};font-weight:600;white-space:nowrap">${rm.icon} ${p.role||'—'}</span>
        </div>
        <!-- Prix -->
        <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:8px">
          <div>
            <div style="font-size:10px;color:var(--text3);font-weight:500;margin-bottom:1px">${hasLive ? 'Prix Offilog (live)' : 'Prix IP'}</div>
            <div style="font-size:20px;font-weight:900;color:${OFFILOG_ORANGE};letter-spacing:-.5px;line-height:1">${prixDisplay ? fmtP(prixDisplay) : '<span style="font-size:13px;color:var(--text3)">N/D</span>'}</div>
          </div>
          ${hasMaxi ? `<div style="text-align:right">
            <div style="font-size:10px;color:var(--text3);margin-bottom:1px">Prix public</div>
            <div style="font-size:13px;color:var(--text2);font-weight:600">${fmtP(p.prix_maxi)}</div>
          </div>` : ''}
        </div>
        <!-- Margin bar -->
        ${hasMarge ? `<div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-size:10px;color:var(--text3)">Marge</span>
            <span style="font-size:11px;font-weight:700;color:${margeColor}">${p.marge_pct.toFixed(1)}%</span>
          </div>
          <div style="height:4px;border-radius:2px;background:var(--border1);overflow:hidden">
            <div style="height:100%;width:${margePct}%;background:${margeColor};border-radius:2px;transition:width .4s"></div>
          </div>
        </div>` : ''}
        <!-- Delta concurrents -->
        ${deltaHtml ? `<div style="margin-bottom:4px">${deltaHtml}</div>` : ''}
        <!-- Competitor prices -->
        ${competHtml}
      </div>
    </div>`;
  }).join('')
  : `<div style="grid-column:1/-1;padding:60px;text-align:center;color:var(--text3)">Aucun produit trouvé pour ces filtres.</div>`;

  // ── Pagination ────────────────────────────────
  let pagHtml = '';
  if (totalPages > 1) {
    const btns = [];
    if (offiPageNum > 1) { btns.push(`<button class="cat-pag-btn" onclick="offiGoPage(1)">«</button><button class="cat-pag-btn" onclick="offiGoPage(${offiPageNum-1})">‹</button>`); }
    let ps = Math.max(1, offiPageNum - 3), pe = Math.min(totalPages, ps + 6);
    if (pe - ps < 6) ps = Math.max(1, pe - 6);
    for (let p = ps; p <= pe; p++) btns.push(`<button class="cat-pag-btn${p===offiPageNum?' active':''}" onclick="offiGoPage(${p})">${p}</button>`);
    if (offiPageNum < totalPages) { btns.push(`<button class="cat-pag-btn" onclick="offiGoPage(${offiPageNum+1})">›</button><button class="cat-pag-btn" onclick="offiGoPage(${totalPages})">»</button>`); }
    pagHtml = `<div style="display:flex;justify-content:center;gap:4px;padding:24px 0 8px;flex-wrap:wrap">${btns.join('')}</div>`;
  }

  container.innerHTML = `
  <style>
    .offi-search-input { border:none;background:transparent;outline:none;flex:1;font-size:13px;color:var(--text); }
  </style>

  <!-- Hero banner -->
  <div style="background:linear-gradient(135deg,#1a0a00 0%,#3d1500 40%,${OFFILOG_ORANGE} 100%);border-radius:20px;padding:24px 28px;margin-bottom:20px;position:relative;overflow:hidden">
    <div style="position:absolute;top:-30px;right:-20px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
    <div style="position:absolute;bottom:-40px;right:80px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;position:relative">
      <div>
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Intégral Pharma</div>
        <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-.5px;line-height:1.1">Catalogue<br><span style="color:${OFFILOG_ORANGE}">Parapharmacie</span></div>
        <div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:8px">${fmtNum(nTotal)} références · ${universSet.length} univers · ${fmtNum(nImg)} avec photo</div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="background:rgba(255,255,255,.1);border-radius:14px;padding:12px 18px;text-align:center;backdrop-filter:blur(8px)">
          <div style="font-size:22px;font-weight:900;color:#fff">${fmtNum(nOff)}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px">Offilog</div>
        </div>
        <div style="background:rgba(255,255,255,.1);border-radius:14px;padding:12px 18px;text-align:center;backdrop-filter:blur(8px)">
          <div style="font-size:22px;font-weight:900;color:#fff">${fmtNum(nLive)}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px">Prix live ●</div>
        </div>
        <div style="background:rgba(255,255,255,.1);border-radius:14px;padding:12px 18px;text-align:center;backdrop-filter:blur(8px)">
          <div style="font-size:22px;font-weight:900;color:#fff">${margeMoy.toFixed(0)}%</div>
          <div style="font-size:10px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.5px">Marge moy.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Universe navigator -->
  <div style="overflow-x:auto;padding-bottom:6px;margin-bottom:16px;scrollbar-width:none">
    <div style="display:flex;gap:8px;width:max-content;padding:2px 2px 4px">${univTiles}</div>
  </div>

  <!-- Search + role filters -->
  <div style="background:var(--bg);border:1px solid var(--border1);border-radius:16px;padding:14px 16px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.04)">
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:220px;border:1.5px solid var(--border2);border-radius:12px;padding:8px 12px;background:var(--bg2);transition:border-color .15s" onfocusin="this.style.borderColor='${OFFILOG_ORANGE}'" onfocusout="this.style.borderColor='var(--border2)'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="offi-search-input" type="text" placeholder="Rechercher un produit, une marque, un EAN…" value="${offiQuery}"
          oninput="offiQuery=this.value;offiPageNum=1;renderOffilog()" autocomplete="off">
        ${offiQuery ? `<button onclick="offiQuery='';offiPageNum=1;renderOffilog()" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:15px;padding:0;line-height:1">✕</button>` : ''}
      </div>
      <select onchange="offiSetMarque(this.value)"
        style="padding:8px 12px;border-radius:12px;border:1.5px solid var(--border2);background:var(--bg2);font-size:12px;color:var(--text);cursor:pointer">
        <option value="tous">Toutes les marques</option>
        ${marqueSet.map(m => `<option value="${m.replace(/"/g,'&quot;')}" ${offiMarque===m?'selected':''}>${m}</option>`).join('')}
      </select>
      ${offiQuery || offiRole !== 'tous' || offiUnivers !== 'tous' || offiMarque !== 'tous'
        ? `<button onclick="offiQuery='';offiRole='tous';offiUnivers='tous';offiMarque='tous';offiPageNum=1;renderOffilog()"
            style="padding:8px 14px;border-radius:12px;border:1.5px solid var(--rose);background:rgba(239,68,68,.06);color:#EF4444;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
            ✕ Réinitialiser
          </button>` : ''}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      ${roleChips}
      <span style="margin-left:auto;font-size:12px;color:var(--text3)">${fmtNum(offiCurrentData.length)} résultat${offiCurrentData.length>1?'s':''} · page ${offiPageNum}/${totalPages}</span>
    </div>
  </div>

  <!-- Cards grid -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
    ${cardsHtml}
  </div>

  ${pagHtml}`;
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
