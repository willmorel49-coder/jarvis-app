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
        art_famille: famille,
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

  // ── Top switch opportunités secteur ───────────
  const topSwitchSecteur = (() => {
    if (typeof BENCHMARK === 'undefined' || !salesCur.length) return [];
    const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const prodMap = {};
    for (const s of salesCur) {
      const k = nn(s.artDesignation);
      if (!k) continue;
      if (!prodMap[k]) prodMap[k] = { designation: s.artDesignation, ca: 0, qte: 0, puNet: s.puNet };
      prodMap[k].ca  += s.mntNetHt;
      prodMap[k].qte += s.qte;
      if (s.puNet > 0) prodMap[k].puNet = s.puNet;
    }
    const opps = [];
    for (const [k, prod] of Object.entries(prodMap)) {
      const match = BENCHMARK.find(b => nn(b.designation) === k);
      if (match && match.prix_ip > 0 && prod.puNet > 0 && match.prix_ip < prod.puNet * 0.99) {
        opps.push({
          designation: prod.designation,
          gainTotal: (prod.puNet - match.prix_ip) * prod.qte,
          gainUnit: prod.puNet - match.prix_ip,
          cat: match.categorie,
          qte: prod.qte,
        });
      }
    }
    return opps.sort((a, b) => b.gainTotal - a.gainTotal).slice(0, 5);
  })();

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

  // ── YTD (Year-to-date) ────────────────────────
  // Current year: Jan → curM of curY ; vs same period last year
  const caYTD = allSalesRaw
    .filter(s => s.year === curY && s.month <= curM)
    .reduce((a, s) => a + (s.mntNetHt || 0), 0);
  const caYTDprev = allSalesRaw
    .filter(s => s.year === curY - 1 && s.month <= curM)
    .reduce((a, s) => a + (s.mntNetHt || 0), 0);
  const hasYTDprev = caYTDprev > 0;

  // Objectifs courant mois
  const objData = loadObjectives ? loadObjectives() : {};
  const objRows = state.pharmacies.map(ph => {
    const k = `${ph.id}_${curY}_${curM}`;
    const target = objData[k] || 0;
    const actual = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
    return { ph, target, actual, pct: target > 0 ? actual / target * 100 : null };
  }).filter(r => r.target > 0 || r.actual > 0);

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
        <button onclick="printRapportMensuel()" style="margin-top:16px;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s" onmouseover="this.style.background='rgba(255,255,255,.2)'" onmouseout="this.style.background='rgba(255,255,255,.1)'">🖨 Rapport mensuel</button>
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

    <!-- Import coverage banner -->
    ${(() => {
      if (!state.pharmacies.length) return '';
      const imported = new Set(salesCur.map(s => s.pharmacyId));
      const missing = state.pharmacies.filter(ph => !imported.has(ph.id));
      const pct = Math.round((state.pharmacies.length - missing.length) / state.pharmacies.length * 100);
      const barColor = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
      return `<div style="background:var(--bg);border:1px solid var(--border1);border-radius:16px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:12px;font-weight:700;color:var(--text2)">Couverture import ${curLabel}</span>
            <span style="font-size:14px;font-weight:800;color:${barColor}">${pct}%</span>
          </div>
          <div style="height:6px;border-radius:3px;background:var(--border1);overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .5s"></div>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:5px">${state.pharmacies.length - missing.length}/${state.pharmacies.length} pharmacies importées</div>
        </div>
        ${missing.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${missing.map(ph => `<span onclick="showPharmaDetail('${ph.id}')" style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(239,68,68,.08);color:#EF4444;border:1px solid rgba(239,68,68,.2);cursor:pointer;white-space:nowrap" title="Cliquer pour voir la fiche">${ph.name}</span>`).join('')}
          <button onclick="navigate('import')" style="font-size:11px;padding:4px 12px;border-radius:20px;background:var(--bg2);border:1px solid var(--border2);cursor:pointer;color:var(--text2);font-weight:600;white-space:nowrap">↑ Importer</button>
        </div>` : `<span style="font-size:22px">✅</span>`}
      </div>`;
    })()}

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

    <!-- Row 2c-ytd : Cumul YTD -->
    ${caYTD > 0 ? `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Cumul Année en cours — Jan → ${monthName(curM)} ${curY}</div>
          <div class="card-subtitle">${hasYTDprev ? `Comparaison même période ${curY - 1}` : 'Pas de données année précédente'}</div>
        </div>
        ${hasYTDprev ? deltaBadge(caYTD, caYTDprev) : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr ${hasYTDprev ? '1fr' : ''};gap:0;border-top:1px solid var(--border)">
        <div style="padding:18px 24px;${hasYTDprev ? 'border-right:1px solid var(--border);' : ''}text-align:center">
          <div style="font-size:28px;font-weight:900;color:var(--blue);letter-spacing:-1px">${fmt(caYTD)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px;font-weight:600">CA Jan–${monthName(curM)} ${curY}</div>
        </div>
        ${hasYTDprev ? `<div style="padding:18px 24px;border-right:1px solid var(--border);text-align:center">
          <div style="font-size:28px;font-weight:900;color:var(--text2);letter-spacing:-1px">${fmt(caYTDprev)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px;font-weight:600">CA Jan–${monthName(curM)} ${curY - 1}</div>
        </div>
        <div style="padding:18px 24px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:${caYTD >= caYTDprev ? 'var(--mint)' : 'var(--rose)'};letter-spacing:-1px">
            ${caYTDprev > 0 ? `${caYTD >= caYTDprev ? '+' : ''}${((caYTD - caYTDprev) / caYTDprev * 100).toFixed(1)}%` : '—'}
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px;font-weight:600">Évolution YoY</div>
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- Row 2c : Objectifs du mois -->
    ${objRows.some(r => r.target > 0) ? `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Objectifs — ${curLabel}</div>
          <div class="card-subtitle">Progression CA réalisé vs objectif mensuel</div>
        </div>
        <button onclick="navigate('objectifs')" style="padding:6px 14px;border-radius:10px;border:1px solid var(--border2);background:transparent;font-size:12px;color:var(--text3);cursor:pointer;font-weight:600">Modifier →</button>
      </div>
      <div style="padding:16px 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        ${objRows.filter(r => r.target > 0).map(r => {
          const pct = r.pct ?? 0;
          const color = pct >= 100 ? 'var(--mint)' : pct >= 70 ? 'var(--amber)' : 'var(--rose)';
          return `<div style="background:var(--bg2);border-radius:12px;padding:14px 16px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
              <span style="width:8px;height:8px;border-radius:50%;background:${r.ph.color}"></span>
              <span style="font-size:12px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.ph.name}</span>
            </div>
            <div style="font-size:20px;font-weight:800;color:${color};margin-bottom:4px">${fmt(r.actual)}</div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:8px">/ objectif ${fmt(r.target)}</div>
            <div style="height:5px;border-radius:3px;background:var(--border1);overflow:hidden">
              <div style="height:100%;width:${Math.min(pct,100).toFixed(0)}%;background:${color};border-radius:3px"></div>
            </div>
            <div style="font-size:11px;color:${color};font-weight:700;margin-top:5px">${pct.toFixed(1)}%${pct >= 100 ? ' ✓' : ''}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Row 2d : Top switch opportunités secteur -->
    ${topSwitchSecteur.length ? `
    <div class="card fade-up" style="margin-bottom:24px;border-left:3px solid var(--mint)">
      <div class="card-header">
        <div>
          <div class="card-title">🔄 Top opportunités switch — secteur</div>
          <div class="card-subtitle">Produits commandés hors IP ce mois — gain immédiat si basculés vers Intégral Pharma</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:900;color:var(--mint)">+${fmt(topSwitchSecteur.reduce((s,o)=>s+o.gainTotal,0))}</div>
          <div style="font-size:11px;color:var(--text3)">gain total secteur/mois</div>
        </div>
      </div>
      ${topSwitchSecteur.map(o => {
        const cat = CATS[o.cat] || CATS.mi;
        return `<div style="display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid var(--border1)">
          <span style="font-size:10px;padding:2px 7px;border-radius:6px;background:${cat.color}18;color:${cat.color};font-weight:700;flex-shrink:0">${cat.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.designation}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${o.qte.toFixed(0)} unités · ${fmtP(o.gainUnit)}/u d'écart</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:18px;font-weight:800;color:var(--mint)">+${fmt(o.gainTotal)}</div>
            <div style="font-size:10px;color:var(--text3)">gain/mois</div>
          </div>
        </div>`;
      }).join('')}
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

    <!-- Row 3b : Top produits secteur -->
    ${(() => {
      const byProd = {};
      for (const s of salesCur) {
        const k = (s.artDesignation || '').trim().toUpperCase();
        if (!k) continue;
        if (!byProd[k]) byProd[k] = { label: s.artDesignation, ca: 0, qte: 0, cat: classifyProduct(s) };
        byProd[k].ca  += s.mntNetHt;
        byProd[k].qte += s.qte;
      }
      const top = Object.values(byProd).sort((a,b) => b.ca - a.ca).slice(0, 10);
      if (!top.length) return '';
      const maxCa = top[0].ca;
      return `<div class="card fade-up" style="margin-bottom:24px">
        <div class="card-header">
          <div>
            <div class="card-title">Top 10 produits secteur — ${curLabel}</div>
            <div class="card-subtitle">${Object.keys(byProd).length} références commandées</div>
          </div>
        </div>
        ${top.map((p, i) => {
          const cat = CATS[p.cat] || CATS.mi;
          const pct = caCur > 0 ? (p.ca / caCur * 100).toFixed(1) : '0';
          return `<div style="display:flex;align-items:center;gap:12px;padding:9px 20px;border-bottom:1px solid var(--border1)">
            <div style="font-size:12px;font-weight:800;color:var(--text3);width:20px;text-align:right;flex-shrink:0">${i+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.label}</div>
              <div style="margin-top:3px;height:3px;border-radius:2px;background:var(--border1)">
                <div style="height:100%;border-radius:2px;background:${cat.color};width:${(p.ca/maxCa*100).toFixed(0)}%"></div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:13px;font-weight:700">${fmt(p.ca)}</div>
              <div style="font-size:10px;color:var(--text3)">${pct}% · ${p.qte.toFixed(0)} u</div>
            </div>
            <span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${cat.color}18;color:${cat.color};font-weight:700;flex-shrink:0;min-width:32px;text-align:center">${cat.icon}</span>
          </div>`;
        }).join('')}
      </div>`;
    })()}

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

function printRapportMensuel() {
  const allSalesRaw = getSales();
  if (!allSalesRaw.length) { showToast('Aucune donnée à exporter', 'error'); return; }
  const { year: curY, month: curM } = getCurrentPeriod(allSalesRaw);
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);
  const salesCur  = getSales({ year: curY, month: curM });
  const salesPrev = prevY ? getSales({ year: prevY, month: prevM }) : [];
  const caCur  = sumCA(salesCur);
  const caPrev = sumCA(salesPrev);
  const delta  = caPrev > 0 ? ((caCur - caPrev) / caPrev * 100) : null;
  const curLabel  = `${monthName(curM)} ${curY}`;
  const prevLabel = prevY ? `${monthName(prevM)} ${prevY}` : '—';
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Per pharmacy
  const pharmaRows = state.pharmacies.map(ph => {
    const cur  = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
    const prev = sumCA(salesPrev.filter(s => s.pharmacyId === ph.id));
    const d    = prev > 0 ? ((cur - prev) / prev * 100) : null;
    return { ph, cur, prev, d };
  }).filter(r => r.cur > 0 || r.prev > 0).sort((a, b) => b.cur - a.cur);

  // Top products
  const prodMap = {};
  for (const s of salesCur) {
    const k = (s.artDesignation || '').trim();
    if (!k) continue;
    if (!prodMap[k]) prodMap[k] = { ca: 0, qte: 0 };
    prodMap[k].ca  += s.mntNetHt;
    prodMap[k].qte += s.qte;
  }
  const topProds = Object.entries(prodMap).sort((a, b) => b[1].ca - a[1].ca).slice(0, 10);

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Rapport mensuel — ${curLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;background:#fff;padding:40px;font-size:13px}
    h1{font-size:24px;font-weight:900;color:#1E3A8A;margin-bottom:4px}
    h2{font-size:14px;font-weight:800;color:#1E3A8A;text-transform:uppercase;letter-spacing:.8px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:24px 0 14px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #1E3A8A}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
    .kpi{background:#f0f4ff;border-radius:12px;padding:14px 16px;text-align:center}
    .kpi-val{font-size:20px;font-weight:900;color:#1E3A8A;margin-bottom:4px}
    .kpi-lab{font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:.5px}
    .delta-pos{color:#059669;font-weight:700} .delta-neg{color:#dc2626;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f8fafc;text-align:left;padding:8px 10px;border-bottom:2px solid #e2e8f0;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.4px}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9}
    tr:last-child td{border-bottom:none}
    .footer{margin-top:40px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px}
    @media print{body{padding:20px}.no-print{display:none}}
  </style></head><body>
  <div class="no-print" style="margin-bottom:20px">
    <button onclick="window.print()" style="padding:8px 20px;background:#1E3A8A;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🖨 Imprimer / Enregistrer en PDF</button>
  </div>
  <div class="header">
    <div>
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Intégral Pharma · Rapport mensuel</div>
      <h1>${curLabel}</h1>
      <div style="font-size:12px;color:#64748B;margin-top:4px">Généré le ${dateStr}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:28px;font-weight:900;color:#1E3A8A">${fmt(caCur)}</div>
      <div style="font-size:12px;color:#64748B">CA Total HT</div>
      ${delta !== null ? `<div class="${delta >= 0 ? 'delta-pos' : 'delta-neg'}" style="margin-top:4px">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs ${prevLabel}</div>` : ''}
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="kpi-val">${fmt(caCur)}</div><div class="kpi-lab">CA ${curLabel}</div></div>
    <div class="kpi"><div class="kpi-val">${fmt(caPrev)}</div><div class="kpi-lab">CA ${prevLabel}</div></div>
    <div class="kpi"><div class="kpi-val">${salesCur.length > 0 ? fmtNum(new Set(salesCur.map(s => s.pharmacyId)).size) : '0'}</div><div class="kpi-lab">Pharmacies actives</div></div>
    <div class="kpi"><div class="kpi-val">${salesCur.length > 0 ? fmtNum(new Set(salesCur.map(s => s.artDesignation)).size) : '0'}</div><div class="kpi-lab">Références vendues</div></div>
  </div>

  <h2>Performance par pharmacie</h2>
  <table>
    <thead><tr>
      <th>Pharmacie</th>
      <th style="text-align:right">${prevLabel}</th>
      <th style="text-align:right">${curLabel}</th>
      <th style="text-align:right">Évolution</th>
    </tr></thead>
    <tbody>
      ${pharmaRows.map(r => `<tr>
        <td style="font-weight:600">${r.ph.name}</td>
        <td style="text-align:right;color:#64748B">${r.prev > 0 ? fmt(r.prev) : '—'}</td>
        <td style="text-align:right;font-weight:700">${r.cur > 0 ? fmt(r.cur) : '—'}</td>
        <td style="text-align:right" class="${r.d !== null ? (r.d >= 0 ? 'delta-pos' : 'delta-neg') : ''}">${r.d !== null ? (r.d >= 0 ? '+' : '') + r.d.toFixed(1) + '%' : '—'}</td>
      </tr>`).join('')}
      <tr style="background:#f0f4ff;font-weight:700">
        <td>TOTAL SECTEUR</td>
        <td style="text-align:right">${fmt(caPrev)}</td>
        <td style="text-align:right">${fmt(caCur)}</td>
        <td style="text-align:right" class="${delta !== null ? (delta >= 0 ? 'delta-pos' : 'delta-neg') : ''}">${delta !== null ? (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%' : '—'}</td>
      </tr>
    </tbody>
  </table>

  <h2>Top 10 produits — ${curLabel}</h2>
  <table>
    <thead><tr><th>#</th><th>Désignation</th><th style="text-align:right">Qté</th><th style="text-align:right">CA HT</th><th style="text-align:right">Part</th></tr></thead>
    <tbody>
      ${topProds.map(([name, d], i) => `<tr>
        <td style="color:#94a3b8;font-weight:700">${i + 1}</td>
        <td>${name}</td>
        <td style="text-align:right">${fmtNum(Math.round(d.qte))}</td>
        <td style="text-align:right;font-weight:700">${fmt(d.ca)}</td>
        <td style="text-align:right;color:#64748B">${caCur > 0 ? (d.ca / caCur * 100).toFixed(1) + '%' : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer">Intégral Pharma · Rapport généré automatiquement par JARVIS CRM · ${dateStr}</div>
  </body></html>`);
  win.document.close();
}

// ── PHARMACIES ────────────────────────────────
let pharmaSearch  = '';
let pharmaFilter  = 'all'; // 'all' | 'up' | 'flat' | 'down'
let pharmaDetailOverridePeriod = null; // {year, month} or null → use auto-detected

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
        <div style="display:flex;align-items:center;gap:8px">
          <button onclick="exportPharmaciesCSV()" style="padding:5px 10px;border-radius:8px;border:1.5px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-size:11px;font-weight:600">⬇ CSV</button>
          <div class="search-wrap" style="width:220px">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Rechercher..." value="${pharmaSearch}"
              oninput="pharmaSearch=this.value;renderPharmacies()" />
          </div>
        </div>
      </div>
      <div style="padding:12px 24px 0">${filterBarHtml}</div>
      ${listHtml}
    </div>

    ${renderProspects(pharmaSearch)}
  `;
}

function exportPharmaciesCSV() {
  const allSalesRaw = getSales();
  const { year: curY, month: curM } = getCurrentPeriod(allSalesRaw);
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);
  const salesCur  = curY  ? getSales({ year: curY,  month: curM  }) : [];
  const salesPrev = prevY ? getSales({ year: prevY, month: prevM }) : [];
  const rows = state.pharmacies.map(ph => {
    const caCur  = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
    const caPrev = sumCA(salesPrev.filter(s => s.pharmacyId === ph.id));
    const nRef   = new Set(salesCur.filter(s => s.pharmacyId === ph.id).map(s => s.artCode)).size;
    const g      = caPrev > 0 ? ((caCur - caPrev) / caPrev * 100) : null;
    const client = typeof CLIENTS !== 'undefined' ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === ph.name.toUpperCase().trim()) : null;
    return [
      `"${ph.name.replace(/"/g,'""')}"`,
      client?.cp || '', client?.ville || '',
      client?.tel || '', client?.email || '',
      String(caCur.toFixed(2)).replace('.',','),
      String(caPrev.toFixed(2)).replace('.',','),
      g !== null ? String(g.toFixed(1)).replace('.',',') : '',
      nRef,
    ];
  }).filter(r => parseFloat(r[5].replace(',','.')) > 0 || parseFloat(r[6].replace(',','.')) > 0);
  rows.sort((a, b) => parseFloat(b[5].replace(',','.')) - parseFloat(a[5].replace(',','.')));
  const header = ['Pharmacie','CP','Ville','Tél','Email',`CA ${curY ? monthName(curM)+' '+curY : ''}`,`CA M-1`,`Évolution %`,'Nb Références'];
  const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `pharmacies_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Export CSV — ${rows.length} pharmacies`, 'success');
}

let prospectFilter = 'tous'; // 'tous' | 'pelgraz' | 'ca' | 'gx'

function renderProspects(search = '') {
  if (typeof CLIENTS === 'undefined' || !CLIENTS.length) return '';
  const activeNames = new Set(state.pharmacies.map(p => p.name.toUpperCase().trim()));

  // Prospect scoring: potentielGx * 0.5 + ca2023 * 0.3 + pelgraz * 500
  const score = c => (c.potentielGx || 0) * 0.5 + (c.ca2023 || 0) * 0.3 + parseInt(c.pelgraz || 0, 10) * 500;

  let prospects = CLIENTS.filter(c => {
    if (!c.nom) return false;
    if (activeNames.has(c.nom.toUpperCase().trim())) return false;
    if (prospectFilter === 'pelgraz') return c.pelgraz && c.pelgraz !== '0' && parseInt(c.pelgraz, 10) > 0;
    if (prospectFilter === 'ca')      return c.ca2023 > 5000;
    if (prospectFilter === 'gx')      return c.potentielGx > 1000;
    if (search) {
      const q = search.toLowerCase();
      return c.nom.toLowerCase().includes(q) || (c.ville || '').toLowerCase().includes(q) || (c.cp || '').includes(q);
    }
    return true;
  });

  if (search && prospectFilter === 'tous') {
    const q = search.toLowerCase();
    prospects = prospects.filter(c => c.nom.toLowerCase().includes(q) || (c.ville || '').toLowerCase().includes(q) || (c.cp || '').includes(q));
  }

  prospects = prospects.sort((a, b) => score(b) - score(a));

  if (!prospects.length) return '';

  const maxScore = Math.max(...prospects.slice(0, 50).map(score), 1);

  const filterTabs = [
    { key: 'tous',    label: `Tous (${CLIENTS.filter(c => c.nom && !activeNames.has(c.nom.toUpperCase().trim())).length})`, color: '#64748B' },
    { key: 'pelgraz', label: 'Pelgraz', color: '#9B5CFF' },
    { key: 'gx',      label: 'Gx potentiel', color: '#0057FF' },
    { key: 'ca',      label: 'CA > 5k', color: '#00E5A0' },
  ].map(t => {
    const active = prospectFilter === t.key;
    return `<button onclick="prospectFilter='${t.key}';renderPharmacies()"
      style="padding:4px 12px;border-radius:16px;font-size:11px;font-weight:600;border:1.5px solid ${active ? t.color : 'var(--border2)'};background:${active ? t.color + '18' : 'transparent'};color:${active ? t.color : 'var(--text2)'};cursor:pointer;transition:all .15s;white-space:nowrap">
      ${t.label}
    </button>`;
  }).join('');

  const rows = prospects.slice(0, 30).map(c => {
    const sc = score(c);
    const scPct = maxScore > 0 ? Math.round(sc / maxScore * 100) : 0;
    const scColor = scPct >= 70 ? '#10B981' : scPct >= 40 ? '#F59E0B' : '#64748B';

    const hasPelgraz  = c.pelgraz && c.pelgraz !== '0' && parseInt(c.pelgraz, 10) > 0;
    const hasPelmeg   = c.pelmeg  && c.pelmeg  !== '0' && parseInt(c.pelmeg, 10) > 0;
    const hasEcodage  = c.ecodage && c.ecodage !== '0' && parseInt(c.ecodage, 10) > 0;

    const badges = [
      c.ca2023 > 0 ? `<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(0,229,160,.1);color:var(--mint);font-weight:600">CA ${fmt(c.ca2023)}</span>` : '',
      c.potentielGx > 0 ? `<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(0,87,255,.1);color:var(--blue);font-weight:600">Gx ${fmt(c.potentielGx)}</span>` : '',
      hasPelgraz ? `<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(155,92,255,.1);color:#9B5CFF;font-weight:600">Pelgraz ×${c.pelgraz}</span>` : '',
      hasPelmeg  ? `<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(155,92,255,.08);color:#9B5CFF;font-weight:600">Pelmeg ×${c.pelmeg}</span>` : '',
      hasEcodage ? `<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(255,176,32,.1);color:var(--amber);font-weight:600">Ecodage ×${c.ecodage}</span>` : '',
    ].filter(Boolean).join('');

    const emailBtn = c.email ? `<a href="mailto:${c.email}" title="${c.email}"
      style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:11px;color:var(--text2);text-decoration:none;cursor:pointer">
      ✉ Mail
    </a>` : '';
    const telBtn = c.tel ? `<a href="tel:${c.tel}" title="${c.tel}"
      style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:11px;color:var(--text2);text-decoration:none;cursor:pointer">
      📞 Tel
    </a>` : '';
    const commentHtml = c.commentaire && c.commentaire.length > 2
      ? `<div style="font-size:11px;color:var(--text3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px" title="${c.commentaire}">${c.commentaire}</div>`
      : '';

    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border1)">
      <!-- Score indicator -->
      <div style="width:40px;height:40px;border-radius:12px;background:${scColor}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative">
        <span style="font-size:12px;font-weight:800;color:${scColor}">${scPct}</span>
        <svg style="position:absolute;inset:0;width:40px;height:40px;transform:rotate(-90deg)" viewBox="0 0 36 36">
          <path d="M18 2 a 16 16 0 0 1 0 32 a 16 16 0 0 1 0 -32" fill="none" stroke="${scColor}33" stroke-width="3"/>
          <path d="M18 2 a 16 16 0 0 1 0 32 a 16 16 0 0 1 0 -32" fill="none" stroke="${scColor}" stroke-width="3" stroke-dasharray="${scPct} 100" stroke-linecap="round"/>
        </svg>
      </div>
      <!-- Info -->
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${c.nom}</div>
        <div style="font-size:11px;color:var(--text3)">${[c.cp, c.ville].filter(Boolean).join(' ')}${c.gros1 ? ` · ${c.gros1}` : ''}</div>
        ${commentHtml}
      </div>
      <!-- Badges -->
      <div style="display:flex;gap:5px;flex-wrap:wrap;max-width:280px;justify-content:flex-end">${badges}</div>
      <!-- Actions -->
      <div style="display:flex;gap:5px;flex-shrink:0">${emailBtn}${telBtn}</div>
    </div>`;
  }).join('');

  return `
    <div class="card fade-in" style="margin-top:20px">
      <div class="card-header" style="flex-wrap:wrap;gap:8px">
        <div>
          <div class="card-title">Prospects secteur</div>
          <div class="card-subtitle">Pharmacies sans commande importée · score = potentiel Gx + CA + cibles</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${filterTabs}</div>
      </div>
      ${rows}
      ${prospects.length > 30 ? `<div style="padding:12px 20px;font-size:12px;color:var(--text3);text-align:center">${prospects.length - 30} autres prospects — affinez avec la recherche ou les filtres</div>` : ''}
    </div>`;
}

function showPharmaDetail(pharmacyId, overridePeriod) {
  if (overridePeriod !== undefined) pharmaDetailOverridePeriod = overridePeriod;
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) return;

  const allPhSales = getSales({ pharmacyId: pharma.id });
  const autoP = getCurrentPeriod(allPhSales.length ? allPhSales : getSales());
  const curY = pharmaDetailOverridePeriod?.year  ?? autoP.year;
  const curM = pharmaDetailOverridePeriod?.month ?? autoP.month;
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);
  const salesCur  = curY  ? getSales({ pharmacyId: pharma.id, year: curY, month: curM  }) : [];
  const salesPrev = prevY ? getSales({ pharmacyId: pharma.id, year: prevY, month: prevM }) : [];

  // Available periods for this pharmacy
  const availPeriods = [...new Set(allPhSales.map(s => `${s.year}-${String(s.month).padStart(2,'0')}`))].sort().reverse();

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
        <button class="btn btn-ghost" onclick="pharmaDetailOverridePeriod=null;renderPharmacies()">← Retour</button>
        <div style="width:12px;height:12px;border-radius:50%;background:${pharma.color}"></div>
        <span class="section-title" style="margin:0;flex:1">${pharma.name}</span>
        ${clientInfo?.ville ? `<span style="font-size:12px;color:var(--text3)">${clientInfo.cp} ${clientInfo.ville}</span>` : ''}
        ${availPeriods.length > 1 ? `<select onchange="showPharmaDetail('${pharma.id}',this.value==='auto'?null:{year:+this.value.split('-')[0],month:+this.value.split('-')[1]})"
          style="padding:5px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:12px;color:var(--text);cursor:pointer">
          ${availPeriods.map(p => {
            const [y, m] = p.split('-');
            const sel = +y === curY && +m === curM;
            return `<option value="${p}" ${sel ? 'selected' : ''}>${monthName(+m)} ${y}</option>`;
          }).join('')}
        </select>` : `<span style="font-size:12px;color:var(--text3)">${monthName(curM)} ${curY}</span>`}
        <button class="btn btn-ghost" onclick="prodPharmaFilter='${pharma.id}';navigate('produits')" style="font-size:12px">📊 Produits</button>
        <button class="btn btn-ghost" onclick="showFicheVisite('${pharma.id}')" style="font-size:12px">📋 Fiche visite</button>
        <button class="btn btn-ghost" onclick="generateEmailModal('${pharma.id}')" style="font-size:12px">✉ Email</button>
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

      <!-- Top produits du mois -->
      ${salesCur.length ? (() => {
        const byProd = {};
        for (const s of salesCur) {
          const k = (s.artDesignation || '').trim().toUpperCase();
          if (!k) continue;
          if (!byProd[k]) byProd[k] = { label: s.artDesignation, ca: 0, qte: 0, cat: classifyProduct(s) };
          byProd[k].ca  += s.mntNetHt;
          byProd[k].qte += s.qte;
        }
        const top = Object.values(byProd).sort((a,b) => b.ca - a.ca).slice(0, 10);
        const maxCa = top[0]?.ca || 1;
        const rows = top.map((p, i) => {
          const cat = CATS[p.cat] || CATS.mi;
          const pct = (p.ca / caCur * 100).toFixed(1);
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 20px;border-bottom:1px solid var(--border1)">
            <div style="font-size:11px;font-weight:800;color:var(--text3);width:18px;flex-shrink:0;text-align:right">${i+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.label}</div>
              <div style="margin-top:3px;height:3px;border-radius:2px;background:var(--border1)">
                <div style="height:100%;border-radius:2px;background:${cat.color};width:${(p.ca/maxCa*100).toFixed(0)}%;transition:width .4s"></div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:12px;font-weight:700;color:var(--text)">${fmt(p.ca)}</div>
              <div style="font-size:10px;color:var(--text3)">${pct}% · ${p.qte.toFixed(0)} u</div>
            </div>
            <span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${cat.color}18;color:${cat.color};font-weight:600;flex-shrink:0">${cat.icon}</span>
          </div>`;
        }).join('');
        return `<div class="card fade-up" style="margin-bottom:20px">
          <div class="card-header">
            <div>
              <div class="card-title">Top produits — ${curLabel}</div>
              <div class="card-subtitle">${Object.keys(byProd).length} références · classées par CA</div>
            </div>
            <span style="font-size:12px;color:var(--text3)">${top.length} / ${Object.keys(byProd).length}</span>
          </div>
          ${rows}
        </div>`;
      })() : ''}

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

      <!-- Notes de visite -->
      ${(() => {
        const notesKey = `visit_notes_${pharma.id}`;
        let notes;
        try { notes = JSON.parse(localStorage.getItem(notesKey) || '[]'); } catch { notes = []; }
        const notesHtml = notes.length
          ? notes.slice(0, 5).map(n => `
              <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 20px;border-bottom:1px solid var(--border1)">
                <div style="flex-shrink:0;font-size:11px;color:var(--text3);white-space:nowrap;margin-top:2px">${n.date}</div>
                <div style="flex:1;font-size:13px;color:var(--text);line-height:1.5">${n.text.replace(/</g,'&lt;')}</div>
                <button onclick="deleteVisitNote('${pharma.id}',${n.id})" style="background:none;border:none;cursor:pointer;color:var(--text4);font-size:14px;padding:0;flex-shrink:0">✕</button>
              </div>`).join('')
          : `<div style="padding:16px 20px;font-size:12px;color:var(--text3)">Aucune note de visite enregistrée.</div>`;
        return `<div class="card fade-up" style="margin-bottom:20px">
          <div class="card-header">
            <div class="card-title">Notes de visite</div>
            <span style="font-size:11px;color:var(--text3)">${notes.length} note${notes.length > 1 ? 's' : ''}</span>
          </div>
          ${notesHtml}
          <div style="padding:12px 20px;border-top:1px solid var(--border1);display:flex;gap:8px">
            <textarea id="visit-note-input-${pharma.id}" placeholder="Ajouter une note de visite…"
              style="flex:1;padding:8px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);font-size:12px;color:var(--text);resize:none;height:60px;font-family:inherit"
              onkeydown="if(event.ctrlKey&&event.key==='Enter')saveVisitNote('${pharma.id}')"></textarea>
            <button onclick="saveVisitNote('${pharma.id}')" class="btn btn-primary" style="font-size:12px;align-self:flex-end;padding:8px 14px">Ajouter</button>
          </div>
        </div>`;
      })()}

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

function generateEmailModal(pharmacyId) {
  const pharma = state.pharmacies.find(p => p.id === pharmacyId);
  if (!pharma) return;
  const client = typeof CLIENTS !== 'undefined'
    ? CLIENTS.find(c => (c.nom || '').toUpperCase().trim() === pharma.name.toUpperCase().trim())
    : null;

  const allPhSales = getSales({ pharmacyId: pharma.id });
  const { year: curY, month: curM, prevYear: prevY, prevMonth: prevM } = getCurrentPeriod(allPhSales.length ? allPhSales : getSales());
  const salesCur  = getSales({ pharmacyId: pharma.id, year: curY, month: curM });
  const salesPrev = prevY ? getSales({ pharmacyId: pharma.id, year: prevY, month: prevM }) : [];
  const caCur  = salesCur.reduce((s, x) => s + x.mntNetHt, 0);
  const caPrev = salesPrev.reduce((s, x) => s + x.mntNetHt, 0);
  const delta  = caPrev > 0 ? ((caCur - caPrev) / caPrev * 100) : null;

  // Top 3 products
  const topProds = Object.entries(salesCur.reduce((m, s) => {
    const k = s.artDesignation || '—';
    m[k] = (m[k] || 0) + s.mntNetHt;
    return m;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const dest = client?.email ? `${client.nom} <${client.email}>` : pharma.name;
  const moisCur = `${monthName(curM)} ${curY}`;
  const moisPrev = prevY ? `${monthName(prevM)} ${prevY}` : '—';
  const deltaStr = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : '';

  const emailBody = `Bonjour,

Je me permets de vous contacter pour faire un point sur votre activité avec Intégral Pharma.

📊 Vos chiffres — ${moisCur} :
• CA IP : ${fmt(caCur)}${deltaStr ? ` (${deltaStr} vs ${moisPrev})` : ''}
• Références commandées : ${salesCur.length}

${topProds.length ? `🏆 Vos top produits ce mois :
${topProds.map(([name, ca], i) => `${i+1}. ${name} — ${fmt(ca)}`).join('\n')}

` : ''}N'hésitez pas à me contacter pour toute question ou pour planifier une visite.

Cordialement,
William Morel
Délégué commercial Intégral Pharma`;

  const existing = document.getElementById('email-gen-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'email-gen-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:20px;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;box-shadow:0 32px 100px rgba(0,0,0,.4)">
      <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border1);display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:15px;font-weight:700">Email généré — ${pharma.name}</div>
        <button onclick="document.getElementById('email-gen-modal').remove()" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);cursor:pointer;font-size:14px;color:var(--text2)">✕</button>
      </div>
      <div style="padding:20px 24px">
        <div style="margin-bottom:12px">
          <label style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Destinataire</label>
          <input id="email-dest" value="${dest.replace(/"/g,'&quot;')}" style="width:100%;padding:8px 12px;border:1px solid var(--border2);border-radius:10px;background:var(--bg2);font-size:13px;color:var(--text);box-sizing:border-box">
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Objet</label>
          <input id="email-subject" value="Bilan activité Intégral Pharma — ${moisCur}" style="width:100%;padding:8px 12px;border:1px solid var(--border2);border-radius:10px;background:var(--bg2);font-size:13px;color:var(--text);box-sizing:border-box">
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Corps du message</label>
          <textarea id="email-body" rows="12" style="width:100%;padding:10px 12px;border:1px solid var(--border2);border-radius:10px;background:var(--bg2);font-size:12px;color:var(--text);box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.6">${emailBody.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button onclick="copyEmail()" class="btn btn-ghost" style="flex:1;min-width:120px">📋 Copier</button>
          ${client?.email ? `<button onclick="openEmailClient('${client.email.replace(/'/g,"\\'")}',document.getElementById('email-subject').value,document.getElementById('email-body').value)" class="btn btn-primary" style="flex:1;min-width:120px">📧 Ouvrir dans Mail</button>` : ''}
          <button onclick="document.getElementById('email-gen-modal').remove()" class="btn btn-ghost" style="flex:1;min-width:120px">Fermer</button>
        </div>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function copyEmail() {
  const body = document.getElementById('email-body')?.value || '';
  navigator.clipboard.writeText(body).then(() => showToast('Email copié dans le presse-papier', 'success'), () => {
    document.getElementById('email-body')?.select();
    document.execCommand('copy');
    showToast('Email copié', 'success');
  });
}

function openEmailClient(email, subject, body) {
  const link = `mailto:${email}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
  window.location.href = link;
}

// ── PRODUITS ──────────────────────────────────
let prodSearch  = '';
let prodFamille = 'tous';
let prodSortCol = 'ca';
let prodSortAsc = false;
let prodPharmaFilter = 'tous'; // 'tous' or pharmacyId
let prodTableQuery = '', prodTableSort = 'ca', prodTableSortAsc = false, prodTablePage = 1;
const PROD_TABLE_PER_PAGE = 50;

function renderProduits() {
  const rawSales = getSales();
  const sales = prodPharmaFilter === 'tous' ? rawSales : rawSales.filter(s => s.pharmacyId === prodPharmaFilter);

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

  // ── Accélération MoM ─────────────────────────
  const allSalesForAccel = getSales();
  const { year: acY, month: acM } = getCurrentPeriod(allSalesForAccel);
  const { year: acPY, month: acPM } = getPrevPeriod(acY, acM);
  const acCur  = acY  ? getSales({ year: acY,  month: acM  }) : [];
  const acPrev = acPY ? getSales({ year: acPY, month: acPM }) : [];
  const accelRows = (() => {
    if (!acCur.length || !acPrev.length) return [];
    const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const curMap = {}, prevMap = {};
    for (const s of acCur)  { const k = nn(s.artDesignation); if (!curMap[k])  curMap[k]  = { label: s.artDesignation, cat: classifyProduct(s), ca: 0 }; curMap[k].ca  += s.mntNetHt; }
    for (const s of acPrev) { const k = nn(s.artDesignation); if (!prevMap[k]) prevMap[k] = { ca: 0 }; prevMap[k].ca += s.mntNetHt; }
    return Object.entries(curMap)
      .filter(([k, v]) => v.ca > 50 && prevMap[k]?.ca > 50)
      .map(([k, v]) => ({ ...v, prev: prevMap[k].ca, delta: v.ca - prevMap[k].ca, pct: (v.ca - prevMap[k].ca) / prevMap[k].ca * 100 }))
      .filter(r => r.pct > 10)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8);
  })();

  // ── Table complète produits ────────────────────
  const prodTableMap = {};
  for (const s of sales) {
    const k = (s.artDesignation || '').trim().toUpperCase();
    if (!k) continue;
    if (!prodTableMap[k]) prodTableMap[k] = {
      label: s.artDesignation, ca: 0, qte: 0, marge: 0,
      cat: classifyProduct(s), pharmas: new Set(),
    };
    prodTableMap[k].ca     += s.mntNetHt;
    prodTableMap[k].qte    += s.qte;
    prodTableMap[k].marge  += (s.mntNetHt - s.puNet * s.qte);
    prodTableMap[k].pharmas.add(s.pharmacyId);
  }
  let prodTableAll = Object.values(prodTableMap).map(p => ({ ...p, pharmaCount: p.pharmas.size }));
  if (prodTableQuery) {
    const q2 = prodTableQuery.toLowerCase();
    prodTableAll = prodTableAll.filter(p => p.label.toLowerCase().includes(q2));
  }
  prodTableAll.sort((a, b) => {
    const av = a[prodTableSort] ?? 0, bv = b[prodTableSort] ?? 0;
    return prodTableSortAsc ? av - bv : bv - av;
  });
  const prodTableTotalPages = Math.max(1, Math.ceil(prodTableAll.length / PROD_TABLE_PER_PAGE));
  if (prodTablePage > prodTableTotalPages) prodTablePage = prodTableTotalPages;
  const prodTableSlice = prodTableAll.slice((prodTablePage - 1) * PROD_TABLE_PER_PAGE, prodTablePage * PROD_TABLE_PER_PAGE);
  const sortIcon = col => prodTableSort === col ? (prodTableSortAsc ? ' ▲' : ' ▼') : '';

  // ── Tendance mensuelle ────────────────────────
  const allSales = getSales();
  const monthMap = {};
  for (const s of allSales) {
    const k = `${s.year}-${String(s.month).padStart(2,'0')}`;
    if (!monthMap[k]) monthMap[k] = { ca: 0, marge: 0 };
    monthMap[k].ca    += s.mntNetHt;
    monthMap[k].marge += (s.mntNetHt - s.puNet * s.qte);
  }
  const trendMonths = Object.keys(monthMap).sort();
  const showTrend = trendMonths.length >= 2;

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
          <div class="card-subtitle">CA HT vs Marge · cliquez une famille pour zoomer${prodPharmaFilter !== 'tous' ? ' · ' + (state.pharmacies.find(p=>p.id===prodPharmaFilter)?.name||'') : ''}</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          <select onchange="prodPharmaFilter=this.value;renderProduits()"
            style="padding:5px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:12px;color:var(--text);cursor:pointer">
            <option value="tous">Toutes les pharmacies</option>
            ${state.pharmacies.map(ph => `<option value="${ph.id}" ${prodPharmaFilter===ph.id?'selected':''}>${ph.name}</option>`).join('')}
          </select>
          ${chipsHtml}
        </div>
      </div>
      <div class="card-body">
        ${chartProds.length
          ? '<div class="chart-wrap" style="height:300px"><canvas id="chart-produits-bar"></canvas></div>'
          : emptyState('💊', 'Aucun produit', 'Aucune donnée pour cette famille')}
      </div>
    </div>`}

    ${showTrend ? `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Évolution mensuelle du CA</div>
          <div class="card-subtitle">${trendMonths.length} période${trendMonths.length > 1 ? 's' : ''} · ${prodPharmaFilter === 'tous' ? 'toutes pharmacies' : (state.pharmacies.find(p=>p.id===prodPharmaFilter)?.name||'')}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="chart-wrap" style="height:240px"><canvas id="chart-trend-line"></canvas></div>
      </div>
    </div>` : ''}

    ${accelRows.length ? `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Produits en accélération</div>
          <div class="card-subtitle">${monthName(acPM)} ${acPY} → ${monthName(acM)} ${acY} · CA ≥ 50 €</div>
        </div>
        <span style="font-size:10px;padding:3px 10px;border-radius:12px;background:rgba(0,229,160,.12);color:var(--mint);font-weight:700">${accelRows.length} produit${accelRows.length > 1 ? 's' : ''}</span>
      </div>
      ${accelRows.map((r, i) => {
        const cat = CATS[r.cat] || CATS.mi;
        return `<div style="display:flex;align-items:center;gap:14px;padding:10px 20px;border-bottom:1px solid var(--border1)">
          <div style="font-size:12px;font-weight:800;color:var(--text3);width:20px;text-align:right;flex-shrink:0">${i+1}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.label}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${fmt(r.prev)} → <span style="font-weight:700;color:var(--mint)">${fmt(r.ca)}</span></div>
          </div>
          <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${cat.color}18;color:${cat.color};font-weight:700;flex-shrink:0">${cat.icon} ${cat.label}</span>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:14px;font-weight:800;color:var(--mint)">+${fmt(r.delta)}</div>
            <div style="font-size:10px;color:var(--mint);font-weight:700">▲ ${r.pct.toFixed(0)}%</div>
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    ${opps.length ? `
    <div class="card fade-up" style="margin-bottom:24px">
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

    <!-- Table complète tous produits -->
    ${prodTableAll.length ? `
    <div class="card fade-up">
      <div class="card-header" style="flex-wrap:wrap;gap:10px">
        <div>
          <div class="card-title">Tous les produits — détail complet</div>
          <div class="card-subtitle">${prodTableAll.length} références · page ${prodTablePage}/${prodTableTotalPages}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" placeholder="Rechercher…" value="${prodTableQuery}"
            oninput="prodTableQuery=this.value;prodTablePage=1;renderProduits()"
            style="padding:5px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:12px;color:var(--text);width:160px">
          <button onclick="prodExportCSV()" style="padding:5px 10px;border-radius:8px;border:1.5px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-size:11px;font-weight:600">⬇ CSV</button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th style="cursor:pointer" onclick="prodTableSort='label';prodTableSortAsc=prodTableSort==='label'?!prodTableSortAsc:false;prodTablePage=1;renderProduits()">Désignation${sortIcon('label')}</th>
              <th>Famille</th>
              <th style="text-align:right;cursor:pointer" onclick="prodTableSort='ca';prodTableSortAsc=prodTableSort==='ca'?!prodTableSortAsc:false;prodTablePage=1;renderProduits()">CA HT${sortIcon('ca')}</th>
              <th style="text-align:right;cursor:pointer" onclick="prodTableSort='qte';prodTableSortAsc=prodTableSort==='qte'?!prodTableSortAsc:false;prodTablePage=1;renderProduits()">Qtés${sortIcon('qte')}</th>
              <th style="text-align:right;cursor:pointer" onclick="prodTableSort='pharmaCount';prodTableSortAsc=prodTableSort==='pharmaCount'?!prodTableSortAsc:false;prodTablePage=1;renderProduits()">Pharmas${sortIcon('pharmaCount')}</th>
              <th style="text-align:right">PU moyen</th>
            </tr>
          </thead>
          <tbody>
            ${prodTableSlice.map((p, i) => {
              const cat = CATS[p.cat] || CATS.mi;
              const rank = (prodTablePage - 1) * PROD_TABLE_PER_PAGE + i + 1;
              const puMoyen = p.qte > 0 ? p.ca / p.qte : 0;
              return `<tr>
                <td style="font-size:12px">
                  <span style="color:var(--text3);font-size:11px;margin-right:6px">${rank}</span>
                  ${p.label}
                </td>
                <td><span style="font-size:10px;padding:1px 5px;border-radius:4px;background:${cat.color}18;color:${cat.color};font-weight:700">${cat.icon}</span></td>
                <td class="td-num" style="text-align:right;font-weight:700">${fmt(p.ca)}</td>
                <td class="td-num" style="text-align:right">${fmtNum(Math.round(p.qte))}</td>
                <td class="td-num" style="text-align:right">${p.pharmaCount}</td>
                <td class="td-num" style="text-align:right;color:var(--text3)">${fmtP(puMoyen)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${prodTableTotalPages > 1 ? `
      <div style="display:flex;justify-content:center;align-items:center;gap:8px;padding:14px">
        ${prodTablePage > 1 ? `<button onclick="prodTablePage--;renderProduits()" style="padding:5px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer;font-size:12px">← Préc</button>` : ''}
        <span style="font-size:12px;color:var(--text3)">Page ${prodTablePage} / ${prodTableTotalPages}</span>
        ${prodTablePage < prodTableTotalPages ? `<button onclick="prodTablePage++;renderProduits()" style="padding:5px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer;font-size:12px">Suiv →</button>` : ''}
      </div>` : ''}
    </div>` : ''}
  `;

  if (showTrend) {
    setTimeout(() => {
      const tCtx = document.getElementById('chart-trend-line');
      if (!tCtx) return;
      if (state.charts['trend-line']) state.charts['trend-line'].destroy();
      const monthLabels = trendMonths.map(k => {
        const [y, m] = k.split('-');
        return monthName(parseInt(m)) + ' ' + y;
      });
      state.charts['trend-line'] = new Chart(tCtx, {
        type: 'line',
        data: {
          labels: monthLabels,
          datasets: [
            {
              label: 'CA HT',
              data: trendMonths.map(k => +monthMap[k].ca.toFixed(2)),
              borderColor: '#0057FF',
              backgroundColor: 'rgba(0,87,255,.08)',
              borderWidth: 2.5,
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              pointBackgroundColor: '#0057FF',
            },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.y) } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 11 } } },
            y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { color: '#64748B', font: { size: 11 }, callback: v => fmt(v) } },
          }
        }
      });
    }, 50);
  }

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
          },
          onClick(evt, elements) {
            if (!elements.length) return;
            const name = sorted[elements[0].index].name;
            showProductBreakdown(name);
          }
        }
      });
      ctx.style.cursor = 'pointer';
    }, 50);
  }
}

function prodExportCSV() {
  const rawSales = getSales();
  const sales = prodPharmaFilter === 'tous' ? rawSales : rawSales.filter(s => s.pharmacyId === prodPharmaFilter);
  const prodMap = {};
  for (const s of sales) {
    const k = (s.artDesignation || '').trim().toUpperCase();
    if (!k) continue;
    if (!prodMap[k]) prodMap[k] = { label: s.artDesignation, ca: 0, qte: 0, cat: classifyProduct(s), pharmas: new Set() };
    prodMap[k].ca  += s.mntNetHt;
    prodMap[k].qte += s.qte;
    prodMap[k].pharmas.add(s.pharmacyId);
  }
  let data = Object.values(prodMap);
  if (prodTableQuery) {
    const q2 = prodTableQuery.toLowerCase();
    data = data.filter(p => p.label.toLowerCase().includes(q2));
  }
  data.sort((a, b) => b.ca - a.ca);
  const pharmaLabel = prodPharmaFilter === 'tous' ? 'Toutes' : (state.pharmacies.find(p => p.id === prodPharmaFilter)?.name || '');
  const header = ['Désignation','Famille','CA HT','Qtés','Nb Pharmacies','PU Moyen HT'];
  const rows = data.map(p => {
    const cat = CATS[p.cat] || CATS.mi;
    const pu = p.qte > 0 ? p.ca / p.qte : 0;
    return [
      `"${p.label.replace(/"/g,'""')}"`,
      cat.label,
      String(p.ca.toFixed(2)).replace('.',','),
      String(Math.round(p.qte)),
      p.pharmas.size,
      String(pu.toFixed(4)).replace('.',','),
    ];
  });
  const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `produits_${pharmaLabel.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Export CSV — ${data.length} produits`, 'success');
}

// ── PRODUCT BREAKDOWN MODAL ───────────────────
function showProductBreakdown(productName) {
  const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const pn = nn(productName);
  const allS = getSales();
  const prodSales = allS.filter(s => nn(s.artDesignation) === pn);
  if (!prodSales.length) return;

  // By pharmacy
  const byPharma = {};
  for (const s of prodSales) {
    const ph = state.pharmacies.find(p => p.id === s.pharmacyId);
    const k = s.pharmacyId;
    if (!byPharma[k]) byPharma[k] = { name: ph?.name || 'Inconnu', color: ph?.color || '#555', ca: 0, qte: 0 };
    byPharma[k].ca  += s.mntNetHt;
    byPharma[k].qte += s.qte;
  }
  const pharmaRows = Object.values(byPharma).sort((a, b) => b.ca - a.ca);
  const totalCa = pharmaRows.reduce((s, r) => s + r.ca, 0);
  const maxCa   = pharmaRows[0]?.ca || 1;

  // By month
  const byMonth = {};
  for (const s of prodSales) {
    const k = `${s.year}-${String(s.month).padStart(2,'0')}`;
    if (!byMonth[k]) byMonth[k] = 0;
    byMonth[k] += s.mntNetHt;
  }
  const monthKeys = Object.keys(byMonth).sort();

  // Benchmark match
  const bench = typeof BENCHMARK !== 'undefined'
    ? BENCHMARK.find(b => nn(b.designation) === pn)
    : null;

  const existing = document.getElementById('prod-breakdown-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'prod-breakdown-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:20px;width:100%;max-width:700px;max-height:88vh;overflow-y:auto;box-shadow:0 32px 100px rgba(0,0,0,.4)">
      <!-- Header -->
      <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border1);display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text);line-height:1.3">${productName}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px">${pharmaRows.length} pharmacie${pharmaRows.length > 1 ? 's' : ''} · CA total ${fmt(totalCa)}</div>
        </div>
        <button onclick="document.getElementById('prod-breakdown-modal').remove()"
          style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);cursor:pointer;font-size:16px;color:var(--text2);display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
      </div>
      <!-- Body -->
      <div style="padding:20px 24px">
        <!-- CA par pharmacie -->
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px">CA par pharmacie</div>
        ${pharmaRows.map(r => `
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="width:8px;height:8px;border-radius:50%;background:${r.color};flex-shrink:0"></span>
                <span style="font-size:13px;font-weight:600;color:var(--text)">${r.name}</span>
              </div>
              <div style="text-align:right">
                <span style="font-size:13px;font-weight:700;color:var(--text)">${fmt(r.ca)}</span>
                <span style="font-size:11px;color:var(--text3);margin-left:6px">${fmtNum(Math.round(r.qte))} u</span>
              </div>
            </div>
            <div style="height:6px;border-radius:3px;background:var(--border1);overflow:hidden">
              <div style="height:100%;width:${(r.ca / maxCa * 100).toFixed(0)}%;background:${r.color};border-radius:3px"></div>
            </div>
          </div>`).join('')}

        <!-- Évolution mensuelle si dispo -->
        ${monthKeys.length > 1 ? `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border1)">
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px">Évolution mensuelle</div>
          ${monthKeys.map(k => {
            const [y, m] = k.split('-');
            const v = byMonth[k];
            const pct = (v / Math.max(...Object.values(byMonth)) * 100).toFixed(0);
            return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <span style="font-size:11px;color:var(--text3);min-width:70px">${monthName(+m)} ${y}</span>
              <div style="flex:1;height:5px;border-radius:3px;background:var(--border1);overflow:hidden">
                <div style="height:100%;width:${pct}%;background:var(--blue);border-radius:3px"></div>
              </div>
              <span style="font-size:12px;font-weight:600;min-width:60px;text-align:right">${fmt(v)}</span>
            </div>`;
          }).join('')}
        </div>` : ''}

        <!-- Benchmark data -->
        ${bench ? `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border1)">
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px">Données marché (Ameli/IP)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px">
            ${bench.ip_qty ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:var(--blue)">${fmtNum(bench.ip_qty)}</div><div style="font-size:10px;color:var(--text3)">Qté IP</div></div>` : ''}
            ${bench.ip_ca ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:var(--mint)">${fmt(bench.ip_ca)}</div><div style="font-size:10px;color:var(--text3)">CA IP</div></div>` : ''}
            ${bench.rot_pharma_jan26 ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:var(--amber)">${bench.rot_pharma_jan26.toFixed(1)}</div><div style="font-size:10px;color:var(--text3)">Rot./pharma</div></div>` : ''}
            ${bench.prix_ip ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:var(--blue)">${fmtP(bench.prix_ip)}</div><div style="font-size:10px;color:var(--text3)">Prix IP</div></div>` : ''}
          </div>
        </div>` : ''}
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function escB(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escB); }
  });
  document.body.appendChild(modal);
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

// ── OBJECTIFS ─────────────────────────────────
const OBJ_KEY = 'ip_crm_objectives_v2';

function loadObjectives() {
  try { return JSON.parse(localStorage.getItem(OBJ_KEY) || '{}'); } catch { return {}; }
}

function saveObjectives(obj) {
  localStorage.setItem(OBJ_KEY, JSON.stringify(obj));
}

function setObjectiveTarget(pharmacyId, year, month, value) {
  const obj = loadObjectives();
  const k = `${pharmacyId}_${year}_${month}`;
  obj[k] = value > 0 ? value : undefined;
  if (obj[k] === undefined) delete obj[k];
  saveObjectives(obj);
  renderObjectifs();
}

function renderObjectifs() {
  const allSales = getSales();
  const { year: curY, month: curM } = getCurrentPeriod(allSales.length ? allSales : getSales());
  const objectives = loadObjectives();

  // Build 6-month range
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let m = curM - i; let y = curY;
    while (m <= 0) { m += 12; y--; }
    months.push({ year: y, month: m });
  }

  // Per-pharmacy data
  const pharmaData = state.pharmacies.map(ph => {
    const rows = months.map(({ year, month }) => {
      const k = `${ph.id}_${year}_${month}`;
      const target = objectives[k] || 0;
      const actual = getSales({ pharmacyId: ph.id, year, month }).reduce((s, x) => s + x.mntNetHt, 0);
      return { year, month, target, actual, pct: target > 0 ? Math.min(actual / target * 100, 120) : null };
    });
    return { ph, rows };
  });

  // Global totals per month
  const globalRows = months.map(({ year, month }) => {
    const totalTarget = state.pharmacies.reduce((s, ph) => s + (objectives[`${ph.id}_${year}_${month}`] || 0), 0);
    const totalActual = getSales({ year, month }).reduce((s, x) => s + x.mntNetHt, 0);
    return { year, month, target: totalTarget, actual: totalActual, pct: totalTarget > 0 ? Math.min(totalActual / totalTarget * 100, 120) : null };
  });

  const monthShort = m => ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][m-1];

  const tableHtml = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:700px">
        <thead>
          <tr style="border-bottom:2px solid var(--border2)">
            <th style="padding:10px 16px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap">Pharmacie</th>
            ${months.map(({ year, month }) => `
              <th style="padding:10px 10px;text-align:center;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap">${monthShort(month)} ${String(year).slice(2)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${pharmaData.map(({ ph, rows }) => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:12px 16px;min-width:150px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="width:8px;height:8px;border-radius:50%;background:${ph.color};flex-shrink:0"></span>
                  <span style="font-size:13px;font-weight:600;color:var(--text)">${ph.name}</span>
                </div>
              </td>
              ${rows.map(r => {
                const isCur = r.year === curY && r.month === curM;
                const objKey = `${ph.id}_${r.year}_${r.month}`;
                const color = r.pct === null ? 'var(--text3)' : r.pct >= 100 ? 'var(--mint)' : r.pct >= 70 ? 'var(--amber)' : 'var(--rose)';
                return `<td style="padding:8px 10px;text-align:center;${isCur?'background:rgba(0,87,255,.04);':''}" title="${r.target > 0 ? fmt(r.actual)+' / obj. '+fmt(r.target) : 'Pas d\'objectif'}">
                  <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                    ${r.actual > 0 ? `<span style="font-size:12px;font-weight:700;color:${color}">${fmt(r.actual)}</span>` : `<span style="font-size:11px;color:var(--border2)">—</span>`}
                    ${r.pct !== null ? `
                      <div style="width:48px;height:4px;border-radius:2px;background:var(--border1);overflow:hidden">
                        <div style="height:100%;width:${Math.min(r.pct, 100).toFixed(0)}%;background:${color};border-radius:2px"></div>
                      </div>
                      <span style="font-size:10px;color:${color};font-weight:600">${r.pct.toFixed(0)}%</span>` : ''}
                    <input type="number" min="0" step="500" value="${r.target || ''}" placeholder="Objectif"
                      onblur="setObjectiveTarget('${ph.id}',${r.year},${r.month},+this.value)"
                      onkeydown="if(event.key==='Enter')this.blur()"
                      style="width:64px;padding:3px 4px;border-radius:6px;border:1px solid var(--border2);background:transparent;font-size:10px;color:var(--text3);text-align:center;font-family:inherit">
                  </div>
                </td>`;
              }).join('')}
            </tr>`).join('')}
          <!-- Total row -->
          <tr style="background:var(--glass2);font-weight:700">
            <td style="padding:12px 16px;font-size:13px;font-weight:700;color:var(--text)">Total secteur</td>
            ${globalRows.map(r => {
              const color = r.pct === null ? 'var(--blue)' : r.pct >= 100 ? 'var(--mint)' : r.pct >= 70 ? 'var(--amber)' : 'var(--rose)';
              return `<td style="padding:12px 10px;text-align:center">
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                  <span style="font-size:13px;font-weight:800;color:${color}">${r.actual > 0 ? fmt(r.actual) : '—'}</span>
                  ${r.target > 0 ? `<span style="font-size:10px;color:var(--text3)">/ ${fmt(r.target)}</span>` : ''}
                  ${r.pct !== null ? `<span style="font-size:10px;color:${color};font-weight:700">${r.pct.toFixed(0)}%</span>` : ''}
                </div>
              </td>`;
            }).join('')}
          </tr>
        </tbody>
      </table>
    </div>`;

  // Progress cards for current month
  const curMonthCards = pharmaData.map(({ ph, rows }) => {
    const r = rows[rows.length - 1];
    if (!r.target && !r.actual) return '';
    const pct = r.pct ?? 0;
    const color = r.pct === null ? 'var(--blue)' : pct >= 100 ? 'var(--mint)' : pct >= 70 ? 'var(--amber)' : 'var(--rose)';
    return `<div style="background:var(--glass2);border-radius:16px;padding:16px 20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="width:8px;height:8px;border-radius:50%;background:${ph.color}"></span>
        <span style="font-size:12px;font-weight:700;color:var(--text)">${ph.name}</span>
      </div>
      <div style="font-size:24px;font-weight:900;color:${color};margin-bottom:4px">${fmt(r.actual)}</div>
      ${r.target > 0 ? `
        <div style="font-size:11px;color:var(--text3);margin-bottom:10px">/ objectif ${fmt(r.target)}</div>
        <div style="height:6px;border-radius:3px;background:var(--border1);overflow:hidden">
          <div style="height:100%;width:${Math.min(pct,100).toFixed(0)}%;background:${color};border-radius:3px;transition:width .5s ease"></div>
        </div>
        <div style="font-size:11px;color:${color};font-weight:700;margin-top:6px">${pct.toFixed(1)}% atteint</div>
        ${r.actual < r.target ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${fmt(r.target - r.actual)} restant</div>` : `<div style="font-size:11px;color:var(--mint);margin-top:2px">Objectif dépassé ✓</div>`}
      ` : `<div style="font-size:11px;color:var(--text3)">Pas d'objectif défini</div>`}
    </div>`;
  }).filter(Boolean).join('');

  document.getElementById('objectifs-content').innerHTML = `
    <div class="fade-up">
      <div class="section-title">Objectifs commerciaux</div>
      <div class="section-sub">Définissez des objectifs mensuels par pharmacie — cliquez sur une cellule pour modifier</div>

      <!-- Current month cards -->
      ${curMonthCards ? `
      <div style="margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);margin-bottom:12px">${monthName(curM)} ${curY} — Mois en cours</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">${curMonthCards}</div>
      </div>` : ''}

      <!-- 6-month table -->
      <div class="card fade-up">
        <div class="card-header">
          <div class="card-title">Tableau des 6 derniers mois</div>
          <div class="card-subtitle">Cliquez sur un champ pour définir un objectif</div>
        </div>
        ${tableHtml}
      </div>

      <!-- Legend -->
      <div style="margin-top:16px;display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--text3)">
        <span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:var(--mint)"></span>≥ 100% — Objectif atteint</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:var(--amber)"></span>70–99% — En bonne voie</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:var(--rose)"></span>< 70% — Attention requise</span>
      </div>
    </div>`;
}

// ── ADMIN ─────────────────────────────────────
function renderAdmin() {
  const hasLocalData = !!(localStorage.getItem('ip_crm_pharmacies'));

  // Build import history sorted by date desc
  const sortedImports = [...state.imports].sort((a,b) => new Date(b.importedAt) - new Date(a.importedAt));
  const importHistoryHtml = sortedImports.length ? `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid var(--border2)">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Pharmacie</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Période</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;max-width:200px">Fichier</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Date import</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Lignes</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Action</th>
          </tr>
        </thead>
        <tbody>
          ${sortedImports.map(imp => {
            const ph = state.pharmacies.find(p => p.id === imp.pharmacyId);
            const lineCount = state.sales.filter(s => s.importId === imp.id).length;
            const d = imp.importedAt ? new Date(imp.importedAt).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'}) : '—';
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:10px 12px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="width:8px;height:8px;border-radius:50%;background:${ph?.color||'#555'};flex-shrink:0"></span>
                  <span style="font-size:13px;font-weight:600;color:var(--text)">${ph?.name||'—'}</span>
                </div>
              </td>
              <td style="padding:10px 12px;font-size:13px;color:var(--text2)">${monthName(imp.month)} ${imp.year}</td>
              <td style="padding:10px 12px;font-size:11px;color:var(--text3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${imp.filename||''}">${imp.filename||'—'}</td>
              <td style="padding:10px 12px;font-size:12px;color:var(--text3);white-space:nowrap">${d}</td>
              <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:var(--blue)">${fmtNum(lineCount)}</td>
              <td style="padding:10px 12px;text-align:center">
                <button onclick="deleteImport('${imp.id}')" style="padding:4px 10px;border-radius:6px;background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.2);color:var(--rose);font-size:11px;font-weight:600;cursor:pointer">Supprimer</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">Aucun import pour l'instant</div>`;

  // Pharmacy list with edit buttons
  const pharmaListHtml = state.pharmacies.length ? state.pharmacies.map(ph => {
    const phImports = state.imports.filter(i => i.pharmacyId === ph.id);
    const phSales   = state.sales.filter(s => s.pharmacyId === ph.id);
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
      <span style="width:10px;height:10px;border-radius:50%;background:${ph.color};flex-shrink:0"></span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${ph.name}</div>
        <div style="font-size:11px;color:var(--text3)">${phImports.length} import${phImports.length!==1?'s':''} · ${fmtNum(phSales.length)} lignes</div>
      </div>
      <button onclick="showEditPharmacyModal('${ph.id}')" style="padding:4px 10px;border-radius:6px;background:var(--bg2);border:1px solid var(--border2);color:var(--text2);font-size:11px;font-weight:600;cursor:pointer">Renommer</button>
      <button onclick="deletePharmacy('${ph.id}')" style="padding:4px 10px;border-radius:6px;background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.2);color:var(--rose);font-size:11px;font-weight:600;cursor:pointer">Supprimer</button>
    </div>`;
  }).join('') : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">Aucune pharmacie</div>`;

  document.getElementById('admin-content').innerHTML = `
    <div class="fade-up" style="max-width:860px">
      <div class="section-title">Administration</div>
      <div class="section-sub">Gestion des accès et des données</div>

      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
        <div style="background:var(--glass2);border-radius:16px;padding:20px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:var(--blue)">${state.pharmacies.length}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:4px">Pharmacies</div>
        </div>
        <div style="background:var(--glass2);border-radius:16px;padding:20px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:var(--mint)">${state.imports.length}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:4px">Imports</div>
        </div>
        <div style="background:var(--glass2);border-radius:16px;padding:20px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:var(--amber)">${fmtNum(state.sales.length)}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:4px">Lignes de vente</div>
        </div>
      </div>

      <!-- Pharmacies gestion -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">Pharmacies</div>
        </div>
        <div class="card-body" style="padding-bottom:0">
          ${pharmaListHtml}
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Ajouter une pharmacie</div>
            <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
              <div style="flex:1;min-width:160px">
                <input id="admin-pharma-name" type="text" placeholder="Nom de la pharmacie"
                  style="width:100%;padding:8px 10px;border:1px solid var(--border2);border-radius:8px;background:var(--bg2);font-size:13px;color:var(--text);box-sizing:border-box">
              </div>
              <div style="width:90px">
                <input id="admin-pharma-code" type="text" maxlength="5" placeholder="Code"
                  style="width:100%;padding:8px 10px;border:1px solid var(--border2);border-radius:8px;background:var(--bg2);font-size:13px;color:var(--text);box-sizing:border-box;text-transform:uppercase">
              </div>
              <button class="btn btn-primary" onclick="addPharmacy()" style="white-space:nowrap">+ Créer</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Import history -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">Historique des imports</div>
          <div class="card-subtitle">${sortedImports.length} import${sortedImports.length!==1?'s':''} au total</div>
        </div>
        ${importHistoryHtml}
      </div>

      <!-- Danger zone -->
      <div class="card" style="margin-bottom:20px;border-color:rgba(255,77,109,.2)">
        <div class="card-header"><div class="card-title" style="color:var(--rose)">Zone de danger</div></div>
        <div class="card-body">
          <p style="color:var(--text2);font-size:13px;margin:0 0 12px">Ces actions sont irréversibles.</p>
          <button class="btn btn-ghost" onclick="resetAllData()" style="color:var(--rose);border-color:rgba(255,77,109,.3)">
            🗑 Vider toutes les données Supabase
          </button>
        </div>
      </div>

      <!-- Supabase users -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div class="card-title">Utilisateurs Auth</div></div>
        <div class="card-body">
          <p style="color:var(--text2);font-size:14px;margin:0">
            Gérer depuis le
            <a href="https://supabase.com/dashboard/project/iyvavhnlhxksokkerkos/auth/users" target="_blank" style="color:var(--blue)">dashboard Supabase → Auth → Users</a>
          </p>
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

function showEditPharmacyModal(pharmacyId) {
  const ph = state.pharmacies.find(p => p.id === pharmacyId);
  if (!ph) return;
  const existing = document.getElementById('edit-pharma-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'edit-pharma-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:16px;width:100%;max-width:400px;box-shadow:0 32px 80px rgba(0,0,0,.4)">
      <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border1);display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:15px;font-weight:700">Modifier la pharmacie</div>
        <button onclick="document.getElementById('edit-pharma-modal').remove()" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);cursor:pointer;font-size:14px;color:var(--text2)">✕</button>
      </div>
      <div style="padding:20px 24px">
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Nom</label>
        <input id="edit-pharma-name" type="text" value="${ph.name.replace(/"/g,'&quot;')}"
          style="width:100%;padding:9px 12px;border:1px solid var(--border2);border-radius:10px;background:var(--bg2);font-size:13px;color:var(--text);box-sizing:border-box;margin-bottom:14px">
        <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:6px">Couleur</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
          ${['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16'].map(c =>
            `<button onclick="document.querySelectorAll('.color-pick').forEach(b=>b.style.outline='none');this.style.outline='2px solid white';document.getElementById('edit-pharma-color').value='${c}'"
              class="color-pick"
              style="width:28px;height:28px;border-radius:50%;background:${c};border:none;cursor:pointer;${ph.color===c?'outline:2px solid white;':''}"></button>`
          ).join('')}
          <input type="color" id="edit-pharma-color" value="${ph.color}" style="width:28px;height:28px;border-radius:50%;border:none;cursor:pointer;padding:0">
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('edit-pharma-modal').remove()" class="btn btn-ghost" style="flex:1">Annuler</button>
          <button onclick="saveEditPharmacy('${ph.id}')" class="btn btn-primary" style="flex:1">Enregistrer</button>
        </div>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function saveEditPharmacy(pharmacyId) {
  const nameEl  = document.getElementById('edit-pharma-name');
  const colorEl = document.getElementById('edit-pharma-color');
  if (!nameEl) return;
  const name  = nameEl.value.trim();
  const color = colorEl?.value || '#3B82F6';
  if (!name) { showToast('Nom requis', 'error'); return; }
  const { error } = await sb.from('pharmacies').update({ name, color }).eq('id', pharmacyId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  const ph = state.pharmacies.find(p => p.id === pharmacyId);
  if (ph) { ph.name = name; ph.color = color; }
  document.getElementById('edit-pharma-modal')?.remove();
  showToast(`Pharmacie "${name}" mise à jour`, 'success');
  renderAdmin();
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
let benchCurrentData = [];
let benchSortAsc = false;
let benchCrossFilter = 'tous'; // 'tous' | 'vendus' | 'non_vendus'

function benchExportCSV() {
  if (typeof BENCHMARK === 'undefined') return;
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
  data.sort((a, b) => { const av = a[benchSortCol]??0, bv = b[benchSortCol]??0; return benchSortAsc ? av-bv : bv-av; });
  const header = ['Rang Qtés','Produit','CIP13','Catégorie','Qtés IP','CA IP','Prix IP','Rotation Jan26','YoY Jan','Remb. Ameli','Ameli Jan26'];
  const rows = data.map(d => [
    d.ip_rank_qty,
    `"${(d.designation||'').replace(/"/g,'""')}"`,
    d.cip13||'',
    d.categorie||'',
    d.ip_qty,
    String(d.ip_ca.toFixed(2)).replace('.',','),
    d.prix_ip > 0 ? String(d.prix_ip.toFixed(4)).replace('.',',') : '',
    d.has_ameli && d.rot_pharma_jan26 != null ? String(d.rot_pharma_jan26.toFixed(2)).replace('.',',') : '',
    d.yoy_jan != null ? String(d.yoy_jan.toFixed(1)).replace('.',',') : '',
    d.has_ameli ? 'Oui' : 'Non',
    d.has_ameli && d.ameli_jan26 != null ? d.ameli_jan26 : '',
  ]);
  const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `benchmark_ip_${benchCat}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Export CSV — ${data.length} produits`, 'success');
}

function renderBenchmark() {
  if (typeof BENCHMARK === 'undefined') {
    document.getElementById('bench-content').innerHTML = emptyState('📊', 'Données non chargées', 'benchmark-data.js manquant');
    return;
  }

  // Build cross-reference map: designation (norm) → our CA+Qty
  const nnBench = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const salesAll = getSales();
  const salesMap = {};
  for (const s of salesAll) {
    const k = nnBench(s.artDesignation);
    if (!k) continue;
    if (!salesMap[k]) salesMap[k] = { ca: 0, qte: 0 };
    salesMap[k].ca  += s.mntNetHt;
    salesMap[k].qte += s.qte;
  }
  const nVendus    = BENCHMARK.filter(d => salesMap[nnBench(d.designation)]?.ca > 0).length;
  const nNonVendus = BENCHMARK.length - nVendus;

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
  if (benchCrossFilter === 'vendus')     data = data.filter(d => salesMap[nnBench(d.designation)]?.ca > 0);
  if (benchCrossFilter === 'non_vendus') data = data.filter(d => !salesMap[nnBench(d.designation)]?.ca);

  // Sort
  data.sort((a, b) => {
    const av = a[benchSortCol] ?? 0, bv = b[benchSortCol] ?? 0;
    return benchSortAsc ? av - bv : bv - av;
  });
  benchCurrentData = data.slice(0, 200);

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
    const sv = salesMap[nnBench(d.designation)];
    const partIP = (sv?.ca > 0 && d.ip_ca > 0) ? (sv.ca / d.ip_ca * 100) : null;
    const nosVentesHtml = sv?.ca > 0
      ? `<div style="text-align:right">
          <div style="font-size:11px;font-weight:700;color:var(--mint)">${fmt(sv.ca)}</div>
          <div style="font-size:10px;color:var(--text3)">${fmtNum(Math.round(sv.qte))} u.</div>
          ${partIP !== null ? `<div style="font-size:10px;color:var(--blue);font-weight:600">${partIP.toFixed(2)}% du CA IP</div>` : ''}
        </div>`
      : salesAll.length > 0
        ? `<span style="font-size:10px;color:var(--text3);background:rgba(239,68,68,.08);padding:2px 6px;border-radius:6px;font-weight:600">Non vendu</span>`
        : `<span style="color:var(--text4);font-size:11px">—</span>`;
    return `<tr style="transition:background .12s;cursor:pointer" onclick="showBenchDetail(${i})" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
      <td style="color:var(--text3);font-size:12px">${d.ip_rank_qty}</td>
      <td class="td-name" style="font-size:13px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.designation}${froidTag}</td>
      <td><span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${cc}22;color:${cc}">${d.categorie.toUpperCase()}</span></td>
      <td class="td-num" style="text-align:right">${fmtNum(d.ip_qty)}</td>
      <td class="td-num" style="text-align:right">${fmt(d.ip_ca)}</td>
      <td style="text-align:right">${prixDisplay}</td>
      <td class="td-num" style="text-align:right;color:${rotColor}">${d.has_ameli ? d.rot_pharma_jan26.toFixed(1) : '—'}</td>
      <td style="text-align:right">${yoy}</td>
      <td style="text-align:right;font-size:11px;color:var(--text3)">${d.has_ameli ? fmtNum(d.ameli_jan26) : '—'}</td>
      <td style="padding:6px 10px">${nosVentesHtml}</td>
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
          <button onclick="benchExportCSV()" style="padding:7px 12px;border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap">⬇ CSV</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px 4px;align-items:center">
          ${chipsHtml}
          ${salesAll.length > 0 ? `<span style="width:1px;height:20px;background:var(--border2);margin:0 4px"></span>
          ${[
            { key: 'tous', label: `Tous (${fmtNum(BENCHMARK.length)})`, color: '#64748B' },
            { key: 'vendus', label: `Nos ventes (${fmtNum(nVendus)})`, color: '#00E5A0' },
            { key: 'non_vendus', label: `Non vendus (${fmtNum(nNonVendus)})`, color: '#EF4444' },
          ].map(t => {
            const active = benchCrossFilter === t.key;
            return `<button onclick="benchCrossFilter='${t.key}';renderBenchmark()"
              style="padding:5px 13px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid ${active ? t.color : 'var(--border2)'};background:${active ? t.color + '18' : 'transparent'};color:${active ? t.color : 'var(--text2)'};cursor:pointer;transition:all .15s;white-space:nowrap">${t.label}</button>`;
          }).join('')}` : ''}
        </div>
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
              ${salesAll.length > 0 ? `<th style="text-align:right;color:var(--mint);font-family:Syne,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;background:var(--bg);position:sticky;top:0;z-index:1">Nos ventes</th>` : ''}
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${data.length > 200 ? `<div style="padding:12px 20px;font-size:12px;color:var(--text3)">${fmtNum(data.length)} résultats · affichage limité à 200 — affinez la recherche.</div>` : `<div style="padding:8px 20px;font-size:12px;color:var(--text3)">${fmtNum(data.length)} résultat${data.length !== 1 ? 's' : ''}</div>`}
        </div>
      </div>
    </div>
  `;
}

// ── BENCHMARK PRODUCT DETAIL MODAL ────────────
function showBenchDetail(idx) {
  const d = benchCurrentData[idx];
  if (!d) return;

  const nnB = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const sv  = (() => {
    const allS = getSales();
    const matching = allS.filter(s => nnB(s.artDesignation) === nnB(d.designation));
    return matching.reduce((acc, s) => ({ ca: acc.ca + s.mntNetHt, qte: acc.qte + s.qte }), { ca: 0, qte: 0 });
  })();

  const cat = CATS[d.categorie] || CATS.mi;
  const cc  = cat.color;

  // Ameli monthly chart labels (13 months ending Jan 2026)
  const ameliLabels = ['Jan25','Fév25','Mar25','Avr25','Mai25','Jun25','Jul25','Aoû25','Sep25','Oct25','Nov25','Déc25','Jan26'];

  const existing = document.getElementById('bench-detail-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'bench-detail-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:20px;width:100%;max-width:720px;max-height:88vh;overflow-y:auto;box-shadow:0 32px 100px rgba(0,0,0,.4)">
      <!-- Header -->
      <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border1);display:flex;align-items:flex-start;gap:12px;justify-content:space-between">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${cc}22;color:${cc};font-weight:700">${d.categorie.toUpperCase()}</span>
            ${d.is_froid ? `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:#dbeafe;color:#1d4ed8">❄️ Froid</span>` : ''}
            ${d.has_ameli ? `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:rgba(0,229,160,.1);color:var(--mint)">SS Remb.</span>` : ''}
            ${d.atc2 ? `<span style="font-size:10px;color:var(--text3)">${d.atc2}</span>` : ''}
          </div>
          <div style="font-size:16px;font-weight:800;line-height:1.3;color:var(--text)">${d.designation}</div>
          ${d.cip13 ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">CIP13 : ${d.cip13} · Rang IP #${d.ip_rank_qty}</div>` : ''}
        </div>
        <button onclick="document.getElementById('bench-detail-modal').remove()" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);cursor:pointer;font-size:16px;color:var(--text2);flex-shrink:0">✕</button>
      </div>

      <div style="padding:20px 24px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <!-- Left: Prix & volumes IP -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px">Données Intégral Pharma</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
            <div style="background:var(--bg2);padding:10px 12px;border-radius:10px;text-align:center">
              <div style="font-size:18px;font-weight:800;color:var(--blue)">${d.prix_ip > 0 ? fmtP(d.prix_ip) : '—'}</div>
              <div style="font-size:10px;color:var(--text3)">Prix IP</div>
            </div>
            <div style="background:var(--bg2);padding:10px 12px;border-radius:10px;text-align:center">
              <div style="font-size:18px;font-weight:800;color:var(--text)">${d.prix_ht > 0 ? fmtP(d.prix_ht) : '—'}</div>
              <div style="font-size:10px;color:var(--text3)">Prix HT catalogue</div>
            </div>
            ${d.offre_ip > 0 ? `<div style="background:rgba(255,176,32,.08);padding:10px 12px;border-radius:10px;text-align:center;border:1px solid rgba(255,176,32,.2)">
              <div style="font-size:18px;font-weight:800;color:var(--amber)">${fmtP(d.offre_ip)}</div>
              <div style="font-size:10px;color:var(--text3)">Offre promotionnelle</div>
            </div>` : ''}
            ${d.remise_pct > 0 ? `<div style="background:rgba(0,229,160,.06);padding:10px 12px;border-radius:10px;text-align:center">
              <div style="font-size:18px;font-weight:800;color:var(--mint)">−${d.remise_pct.toFixed(1)}%</div>
              <div style="font-size:10px;color:var(--text3)">Remise IP</div>
            </div>` : ''}
          </div>
          <div style="background:var(--bg2);padding:14px 16px;border-radius:12px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:12px;color:var(--text3)">Qté totale IP</span>
              <span style="font-size:13px;font-weight:700">${fmtNum(d.ip_qty)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:12px;color:var(--text3)">CA total IP</span>
              <span style="font-size:13px;font-weight:700;color:var(--blue)">${fmt(d.ip_ca)}</span>
            </div>
            ${d.has_ameli && d.rot_pharma_jan26 ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:12px;color:var(--text3)">Rotation/pharma/mois</span>
              <span style="font-size:13px;font-weight:700;color:var(--amber)">${d.rot_pharma_jan26.toFixed(1)}</span>
            </div>` : ''}
            ${d.yoy_jan != null ? `<div style="display:flex;justify-content:space-between">
              <span style="font-size:12px;color:var(--text3)">Tendance YoY</span>
              <span style="font-size:13px;font-weight:700;color:${d.yoy_jan >= 0 ? 'var(--mint)' : 'var(--rose)'}">${d.yoy_jan >= 0 ? '+' : ''}${d.yoy_jan.toFixed(1)}%</span>
            </div>` : ''}
          </div>
          <!-- Nos ventes -->
          ${sv.ca > 0 ? `<div style="background:rgba(0,229,160,.06);padding:14px 16px;border-radius:12px;border:1px solid rgba(0,229,160,.15)">
            <div style="font-size:11px;font-weight:700;color:var(--mint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Nos ventes</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:12px;color:var(--text3)">CA réalisé</span>
              <span style="font-size:14px;font-weight:800;color:var(--mint)">${fmt(sv.ca)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:12px;color:var(--text3)">Quantité vendue</span>
              <span style="font-size:13px;font-weight:700">${fmtNum(Math.round(sv.qte))} u.</span>
            </div>
            ${d.ip_ca > 0 ? `<div style="display:flex;justify-content:space-between">
              <span style="font-size:12px;color:var(--text3)">Part du CA IP</span>
              <span style="font-size:13px;font-weight:700;color:var(--blue)">${(sv.ca / d.ip_ca * 100).toFixed(2)}%</span>
            </div>` : ''}
          </div>` : `<div style="background:var(--bg2);padding:12px 16px;border-radius:12px;text-align:center;color:var(--text3);font-size:12px">Non vendu dans votre secteur</div>`}
        </div>

        <!-- Right: Ameli trend chart -->
        <div>
          ${d.has_ameli && d.ameli_months ? `
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px">Données Ameli nationales — 13 mois</div>
          <div style="height:180px;margin-bottom:16px"><canvas id="bench-ameli-chart" style="max-width:100%"></canvas></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="background:var(--bg2);padding:10px 12px;border-radius:10px;text-align:center">
              <div style="font-size:15px;font-weight:800;color:var(--blue)">${fmtNum(d.ameli_jan26)}</div>
              <div style="font-size:10px;color:var(--text3)">Dispensations Jan26</div>
            </div>
            <div style="background:var(--bg2);padding:10px 12px;border-radius:10px;text-align:center">
              <div style="font-size:15px;font-weight:800;color:var(--text)">${fmtNum(d.ameli_total)}</div>
              <div style="font-size:10px;color:var(--text3)">Total 13 mois</div>
            </div>
          </div>` : `<div style="background:var(--bg2);border-radius:12px;padding:20px;text-align:center;color:var(--text3);font-size:12px;height:200px;display:flex;align-items:center;justify-content:center">Pas de données Ameli pour ce produit</div>`}
        </div>
      </div>

      <!-- Footer actions -->
      <div style="padding:16px 24px;border-top:1px solid var(--border1);display:flex;gap:10px;flex-wrap:wrap">
        <button onclick="catAddBenchToSimIdx(${idx})" class="btn btn-primary" style="font-size:12px">+ Ajouter au simulateur</button>
        <button onclick="document.getElementById('bench-detail-modal').remove()" class="btn btn-ghost" style="font-size:12px">Fermer</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function escBD(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escBD); }
    if (e.key === 'ArrowRight') { document.getElementById('bench-detail-modal')?.remove(); document.removeEventListener('keydown', escBD); if (benchCurrentData[idx+1]) setTimeout(() => showBenchDetail(idx+1), 50); }
    if (e.key === 'ArrowLeft')  { document.getElementById('bench-detail-modal')?.remove(); document.removeEventListener('keydown', escBD); if (idx > 0) setTimeout(() => showBenchDetail(idx-1), 50); }
  });
  document.body.appendChild(modal);

  // Draw Ameli chart after DOM mount
  if (d.has_ameli && d.ameli_months) {
    setTimeout(() => {
      const ctx = document.getElementById('bench-ameli-chart');
      if (!ctx) return;
      const maxV = Math.max(...d.ameli_months);
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ameliLabels,
          datasets: [{
            data: d.ameli_months,
            backgroundColor: d.ameli_months.map((v, i) => i === 12 ? '#0057FF' : 'rgba(0,87,255,0.25)'),
            borderColor:     d.ameli_months.map((v, i) => i === 12 ? '#0057FF' : 'rgba(0,87,255,0.4)'),
            borderWidth: 1.5, borderRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => ' ' + fmtNum(c.parsed.y) + ' disp.' } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 9 } } },
            y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { color: '#64748B', font: { size: 9 }, callback: v => fmtNum(v) } },
          }
        }
      });
    }, 60);
  }
}

function catAddBenchToSimIdx(idx) {
  const b = benchCurrentData[idx];
  if (!b) return;
  const already = state.sim.items.find(it => it.designation.toUpperCase() === b.designation.toUpperCase());
  if (already) { already.qty += 1; showToast(`"${b.designation.slice(0,28)}" (qté +1)`, 'info'); return; }
  const puNet = b.prix_ip > 0 ? b.prix_ip : (b.ip_qty > 0 ? b.ip_ca / b.ip_qty : 0);
  state.sim.items.push({
    designation: b.designation, code: b.cip13 || '',
    cat: b.categorie || 'mi', froid: b.is_froid || false,
    puNet, puBrut: puNet * 1.05, qty: 1,
  });
  showToast(`"${b.designation.slice(0,28)}…" ajouté au simulateur ✓`, 'success');
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
    offilog:      'Offilog — Parapharmacie',
    groupements:  'Suivi Groupement',
    objectifs:    'Objectifs commerciaux',
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  const renders = {
    dashboard:   renderDashboard,
    pharmacies:  renderPharmacies,
    produits:    renderProduits,
    import:      renderImport,
    admin:       renderAdmin,
    catalogue:   renderCatalogue,
    benchmark:   renderBenchmark,
    simulateur:  renderSimulator,
    offilog:     renderOffilog,
    groupements: renderGroupements,
    objectifs:   renderObjectifs,
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
    if (catCatFilter === 'offres')    return b.offre_ip > 0;
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

function catExportCSV() {
  const data = catGetList();
  if (!data.length) { showToast('Aucun produit à exporter', 'error'); return; }
  const header = ['Produit','CIP13','Catégorie','Qtés IP','CA IP','Prix IP','Prix HT','Offre IP','Remb. Ameli','Biosimilaire','Générique','Froid'];
  const rows = data.map(b => [
    `"${(b.designation||'').replace(/"/g,'""')}"`,
    b.cip13||'',
    b.categorie||'',
    b.ip_qty,
    String((b.ip_ca||0).toFixed(2)).replace('.',','),
    b.prix_ip > 0 ? String(b.prix_ip.toFixed(4)).replace('.',',') : '',
    b.prix_ht > 0 ? String(b.prix_ht.toFixed(4)).replace('.',',') : '',
    b.offre_ip > 0 ? String(b.offre_ip.toFixed(4)).replace('.',',') : '',
    b.has_ameli ? 'Oui' : 'Non',
    isBiosim(b) ? 'Oui' : 'Non',
    isGenerique(b) ? 'Oui' : 'Non',
    isFroidBench(b) ? 'Oui' : 'Non',
  ]);
  const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  const tag = catCatFilter !== 'tous' ? `_${catCatFilter}` : '';
  a.download = `catalogue_ip${tag}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Export CSV — ${data.length} produits`, 'success');
}

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
    { key: 'offres',    label: '🎁 Offres en cours' },
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
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:12px;color:var(--text3)">Page ${catPageNum} / ${totalPages}</span>
          <button onclick="catExportCSV()" style="padding:5px 10px;border-radius:8px;border:1.5px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-size:11px;font-weight:600">⬇ CSV</button>
        </div>
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

function simAddOffilog(produit, puNet) {
  if (!puNet || puNet <= 0) { showToast('Prix non disponible pour ce produit', 'error'); return; }
  const already = state.sim.items.find(it => it.designation.toLowerCase() === produit.toLowerCase());
  if (already) { already.qty += 1; showToast(`${produit.slice(0,40)} (+1)`, 'info'); return; }
  state.sim.items.push({ designation: produit, code: '', cat: 'nr', froid: false, puNet, puBrut: puNet * 1.05, qty: 1 });
  showToast(`${produit.slice(0,40)} ajouté au simulateur`, 'success');
}

function simReconduire() {
  if (!state.sim.pharmacyId) return;
  const phSales = getSales({ pharmacyId: state.sim.pharmacyId });
  if (!phSales.length) { showToast('Aucune donnée pour cette pharmacie', 'error'); return; }
  const { year, month } = getCurrentPeriod(phSales);
  const lastSales = year ? getSales({ pharmacyId: state.sim.pharmacyId, year, month }) : phSales;

  const aggMap = {};
  for (const s of lastSales) {
    const k = (s.artDesignation || '').trim().toUpperCase();
    if (!k) continue;
    if (!aggMap[k]) aggMap[k] = { designation: s.artDesignation, artCode: s.artCode, puNet: s.puNet, qte: 0, cat: classifyProduct(s) };
    aggMap[k].qte += s.qte;
    if (s.puNet > 0) aggMap[k].puNet = s.puNet;
  }

  const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const items = Object.values(aggMap)
    .filter(r => r.qte > 0 && r.puNet > 0)
    .map(r => {
      const bench = typeof BENCHMARK !== 'undefined' ? BENCHMARK.find(b => nn(b.designation) === nn(r.designation)) : null;
      return {
        designation: r.designation,
        puNet: r.puNet,
        qty: Math.max(1, Math.round(r.qte)),
        cat: r.cat,
        froid: bench?.is_froid || false,
        hasAmeli: bench?.has_ameli || false,
        rot: bench?.rot_pharma_jan26 || null,
      };
    })
    .sort((a, b) => (b.qty * b.puNet) - (a.qty * a.puNet));

  state.sim.items = items;
  showToast(`${items.length} produits chargés depuis ${monthName(month)} ${year}`, 'success');
  renderSimulator();
}

function simExportCSV() {
  if (!state.sim.items.length) { showToast('Panier vide', 'error'); return; }
  const { caTotal } = simCalc();
  const pharmaName = state.sim.pharmacyId
    ? (state.pharmacies.find(p => p.id === state.sim.pharmacyId)?.name || 'Pharmacie')
    : 'Simulation';
  const header = ['Désignation','Famille','Qté','PU Net HT','Total HT'];
  const rows = state.sim.items.map(it => {
    const cat = CATS[it.cat] || CATS.mi;
    return [
      `"${(it.designation||'').replace(/"/g,'""')}"`,
      cat.label,
      it.qty,
      it.puNet.toFixed(4),
      (it.qty * it.puNet).toFixed(2),
    ].join(';');
  });
  rows.push(`"TOTAL";;;;;${caTotal.toFixed(2)}`);
  const csv = [header.join(';'), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.sim.name.replace(/\s+/g,'_')}_${pharmaName.replace(/\s+/g,'_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Export CSV — ${state.sim.items.length} lignes`, 'success');
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
        ${state.sim.pharmacyId ? `<button class="btn btn-ghost" onclick="simReconduire()" title="Recharger les produits de la dernière commande de cette pharmacie" style="color:var(--mint);border-color:rgba(0,229,160,.3)">♻️ Reconduire</button>` : ''}
        <button class="btn btn-primary" onclick="saveSimulation()">💾 Sauvegarder</button>
        <button class="btn btn-ghost" onclick="printSimulation()">🖨 Imprimer</button>
        <button class="btn btn-ghost" onclick="simExportCSV()" title="Exporter le panier en CSV">⬇ CSV</button>
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
let offiQuery = '', offiRole = 'tous', offiUnivers = 'tous', offiMarque = 'tous', offiSaison = 'tous', offiPageNum = 1, offiView = 'cards';

const OFFI_FAV_KEY = 'ip_crm_offi_favs';
function getOffiFavs() { try { return new Set(JSON.parse(localStorage.getItem(OFFI_FAV_KEY)||'[]')); } catch { return new Set(); } }
function toggleOffiFav(ean) {
  const favs = getOffiFavs();
  if (favs.has(ean)) favs.delete(ean); else favs.add(ean);
  localStorage.setItem(OFFI_FAV_KEY, JSON.stringify([...favs]));
  renderOffilog();
}
let offiCurrentData = [];
let offiDetailProduct = null; // currently shown in detail modal

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
    if (offiRole === 'pharmacie') return p.prix_pharmacie != null && p.prix_pharmacie > 0;
    if (offiRole === 'favoris') return p.ean && getOffiFavs().has(p.ean);
    if (offiRole !== 'tous' && offiRole === 'offilog' && !p.dans_offilog) return false;
    if (offiRole !== 'tous' && offiRole !== 'offilog' && offiRole !== 'pharmacie' && p.role !== offiRole) return false;
    if (offiUnivers !== 'tous' && p.univers !== offiUnivers) return false;
    if (offiMarque !== 'tous' && p.marque !== offiMarque) return false;
    if (offiSaison === 'pe' && p.saison !== 'Printemps/Été') return false;
    if (offiSaison === 'ah' && p.saison !== 'Automne/Hiver') return false;
    if (offiSaison === 'annee' && p.saison !== 'Toute année' && p.saison != null) return false;
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
function offiSetSaison(s) { offiSaison = s; offiPageNum = 1; renderOffilog(); }
function offiExportCSV() {
  const list = offiGetList();
  const header = ['Produit','Marque','EAN','Univers','Role','Dans Offilog','Prix IP','Prix Live','Ma Pharmacie','Drakkars','Cap3000','Prix Public','Marge %','Potentiel','Rang Vente'];
  const rows = list.map(p => [
    `"${(p.produit||'').replace(/"/g,'""')}"`,
    `"${(p.marque||'').replace(/"/g,'""')}"`,
    p.ean||'',
    `"${(p.univers||'').replace(/"/g,'""')}"`,
    `"${(p.role||'').replace(/"/g,'""')}"`,
    p.dans_offilog ? 'Oui' : 'Non',
    p.prix_offilog != null ? String(p.prix_offilog).replace('.',',') : '',
    p.prix_live    != null ? String(p.prix_live).replace('.',',') : '',
    p.prix_pharmacie != null ? String(p.prix_pharmacie).replace('.',',') : '',
    p.prix_drakkars  != null ? String(p.prix_drakkars).replace('.',',') : '',
    p.prix_cap3000   != null ? String(p.prix_cap3000).replace('.',',') : '',
    p.prix_maxi      != null ? String(p.prix_maxi).replace('.',',') : '',
    p.marge_pct      != null ? String(p.marge_pct.toFixed(1)).replace('.',',') : '',
    `"${(p.potentiel||'').replace(/"/g,'""')}"`,
    p.rang_vente != null ? p.rang_vente : '',
  ]);
  const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `offilog_${offiRole}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Export CSV — ${list.length} produits`, 'success');
}

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
  const nLive     = OFFILOG.filter(p => p.prix_live      != null && p.prix_live      > 0).length;
  const nImg      = OFFILOG.filter(p => p.img && p.img.length > 0).length;
  const nPharma   = OFFILOG.filter(p => p.prix_pharmacie != null && p.prix_pharmacie > 0).length;
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
  const offiFavs = getOffiFavs();
  const nFavs = OFFILOG.filter(p => p.ean && offiFavs.has(p.ean)).length;
  const roleTabs = [
    { key: 'tous',            label: 'Tous',             icon: '✦', color: '#64748B' },
    { key: 'bestsellers',     label: `Top ventes (${nBest})`, icon: '🏆', color: '#F59E0B' },
    { key: 'pharmacie',       label: `Ma Pharmacie (${nPharma})`, icon: '🏥', color: '#00E5A0' },
    { key: 'favoris',         label: `Favoris (${nFavs})`, icon: '★', color: '#EC4899' },
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
  const cardsHtml = page.length ? page.map((p, i) => {
    const um  = univMeta(p.univers || 'Non classé');
    const rm  = roleMeta(p.role);
    const hasIP    = p.prix_offilog   != null && p.prix_offilog   > 0;
    const hasLive  = p.prix_live      != null && p.prix_live      > 0;
    const hasMaxi  = p.prix_maxi      != null && p.prix_maxi      > 0;
    const hasDrak  = p.prix_drakkars  != null && p.prix_drakkars  > 0;
    const hasCap   = p.prix_cap3000   != null && p.prix_cap3000   > 0;
    const hasPharma= p.prix_pharmacie != null && p.prix_pharmacie > 0;
    const hasImg   = p.img && p.img.length > 0;
    const hasMarge = p.marge_pct != null;
    const margeColor = !hasMarge ? 'var(--text3)' : p.marge_pct >= 40 ? '#10B981' : p.marge_pct >= 20 ? '#F59E0B' : '#EF4444';
    const margePct  = hasMarge ? Math.min(100, p.marge_pct) : 0;

    // Prix affiché = live en priorité, sinon Excel
    const prixDisplay = hasLive ? p.prix_live : (hasIP ? p.prix_offilog : null);

    // Price delta vs all competitors incl. pharmacie
    let deltaHtml = '';
    if (prixDisplay && (hasDrak || hasCap || hasPharma)) {
      const concPrix = [
        hasDrak   ? p.prix_drakkars  : null,
        hasCap    ? p.prix_cap3000   : null,
        hasPharma ? p.prix_pharmacie : null,
      ].filter(Boolean);
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

    // Prix pharmacie delta vs prix IP (rouge = pharmacie plus chère que nous = mauvais signe, vert = moins chère = ok)
    const pharmaDeltaHtml = hasPharma && prixDisplay
      ? (() => {
          const d = p.prix_pharmacie - prixDisplay;
          if (d > 0.05) return `<span style="font-size:9px;font-weight:700;color:#10B981;background:#d1fae5;padding:1px 5px;border-radius:6px">+${fmtP(d)}</span>`;
          if (d < -0.05) return `<span style="font-size:9px;font-weight:700;color:#EF4444;background:#fee2e2;padding:1px 5px;border-radius:6px">${fmtP(d)}</span>`;
          return `<span style="font-size:9px;font-weight:700;color:#6B7280;background:#F3F4F6;padding:1px 5px;border-radius:6px">≈</span>`;
        })()
      : '';

    const competHtml = (hasDrak || hasCap || hasPharma) ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px dashed var(--border1)">
        ${hasPharma ? `<div style="font-size:10px;color:var(--text3)">🏥 <span style="color:var(--mint);font-weight:700">${fmtP(p.prix_pharmacie)}</span> <span style="opacity:.6">Ma Phcie</span> ${pharmaDeltaHtml}</div>` : ''}
        ${hasDrak   ? `<div style="font-size:10px;color:var(--text3)">🛒 <span style="color:var(--text2);font-weight:600">${fmtP(p.prix_drakkars)}</span> <span style="opacity:.6">Drakkars</span></div>` : ''}
        ${hasCap    ? `<div style="font-size:10px;color:var(--text3)">🏪 <span style="color:var(--text2);font-weight:600">${fmtP(p.prix_cap3000)}</span> <span style="opacity:.6">Cap3000</span></div>` : ''}
      </div>` : '';

    // Initial marque pour placeholder
    const brandInitial = (p.marque || p.produit || '?').charAt(0).toUpperCase();

    return `<div style="background:var(--bg);border-radius:16px;border:1px solid var(--border1);overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .2s,transform .18s;cursor:pointer"
      onclick="showOffiDetail(${startIdx + i})"
      onmouseover="this.style.boxShadow='0 8px 32px rgba(0,0,0,.12)';this.style.transform='translateY(-2px)'"
      onmouseout="this.style.boxShadow='';this.style.transform=''">
      <!-- Zone photo uniforme 140px — toujours présente -->
      <div style="height:140px;background:${um.bg};display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;flex-shrink:0">
        ${hasImg
          ? `<img src="${p.img}" alt="" loading="lazy"
              style="max-height:128px;max-width:90%;object-fit:contain;transition:transform .3s"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
              onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform=''">
             <div style="display:none;flex-direction:column;align-items:center;gap:6px;position:absolute;inset:0;justify-content:center">
               <span style="font-size:36px;line-height:1">${um.icon}</span>
               <span style="font-size:20px;font-weight:900;color:${um.color};opacity:.5">${brandInitial}</span>
             </div>`
          : `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
               <span style="font-size:38px;line-height:1;filter:drop-shadow(0 2px 6px ${um.color}44)">${um.icon}</span>
               <span style="font-size:22px;font-weight:900;color:${um.color};opacity:.35;letter-spacing:2px">${brandInitial}</span>
             </div>`
        }
        <!-- Badges en overlay -->
        <div style="position:absolute;top:7px;left:7px;display:flex;gap:3px;flex-wrap:wrap;max-width:calc(100% - 50px)">${bestBadge}${ipBadge}${liveBadge}</div>
        ${saisonBadge ? `<div style="position:absolute;top:7px;right:34px">${saisonBadge}</div>` : ''}
        <!-- Fav button -->
        ${p.ean ? `<button onclick="event.stopPropagation();toggleOffiFav('${p.ean}')" title="${offiFavs.has(p.ean)?'Retirer des favoris':'Ajouter aux favoris'}"
          style="position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:8px;border:none;background:rgba(0,0,0,.2);backdrop-filter:blur(4px);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;line-height:1;color:${offiFavs.has(p.ean)?'#EC4899':'rgba(255,255,255,.7)'}">
          ${offiFavs.has(p.ean) ? '★' : '☆'}
        </button>` : ''}
        <!-- Barre couleur univers en bas -->
        <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${um.color},${um.color}66)"></div>
      </div>
      <div style="padding:12px 13px 11px;flex:1;display:flex;flex-direction:column;gap:0">
        <!-- Brand -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:6px">
          <span style="font-size:10px;font-weight:700;color:${um.color};text-transform:uppercase;letter-spacing:.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.marque || '—'}</span>
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

  // ── Table view ────────────────────────────────
  const tableHtml = page.length ? `
  <div style="overflow-x:auto;border-radius:14px;border:1px solid var(--border1)">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:var(--bg2);border-bottom:2px solid var(--border2)">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;white-space:nowrap">Produit</th>
          <th style="padding:10px 10px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;white-space:nowrap">Marque</th>
          <th style="padding:10px 10px;text-align:right;font-size:11px;color:${OFFILOG_ORANGE};font-weight:700;white-space:nowrap">Prix IP</th>
          <th style="padding:10px 10px;text-align:right;font-size:11px;color:#15803d;font-weight:700;white-space:nowrap">Live</th>
          <th style="padding:10px 10px;text-align:right;font-size:11px;color:var(--mint);font-weight:700;white-space:nowrap">Ma Phcie</th>
          <th style="padding:10px 10px;text-align:right;font-size:11px;color:var(--text3);font-weight:700;white-space:nowrap">Drakkars</th>
          <th style="padding:10px 10px;text-align:right;font-size:11px;color:var(--text3);font-weight:700;white-space:nowrap">Cap3000</th>
          <th style="padding:10px 10px;text-align:right;font-size:11px;color:var(--text3);font-weight:700;white-space:nowrap">Marge</th>
        </tr>
      </thead>
      <tbody>
        ${page.map((p, i) => {
          const prixRef  = p.prix_live || p.prix_offilog;
          const minConc  = Math.min(...[p.prix_drakkars, p.prix_cap3000, p.prix_pharmacie].filter(x => x > 0).concat([Infinity]));
          const deltaRef = (prixRef && minConc < Infinity) ? minConc - prixRef : null;
          const deltaColor = deltaRef == null ? '' : deltaRef > 0.05 ? '#10B981' : deltaRef < -0.05 ? '#EF4444' : '#6B7280';
          const margeColor = p.marge_pct == null ? 'var(--text3)' : p.marge_pct >= 40 ? '#10B981' : p.marge_pct >= 20 ? '#F59E0B' : '#EF4444';
          const img = p.img ? `<img src="${p.img}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;margin-right:8px;vertical-align:middle" onerror="this.style.display='none'">` : '';
          return `<tr style="border-bottom:1px solid var(--border1);transition:background .12s;cursor:pointer" onclick="showOffiDetail(${startIdx + i})" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
            <td style="padding:8px 12px;max-width:260px">
              <div style="display:flex;align-items:center">
                ${img}
                <div>
                  <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px" title="${p.produit}">${p.produit}</div>
                  <div style="font-size:10px;color:var(--text3);margin-top:1px">${p.univers ? p.univers.split(' / ')[0] : '—'}${p.rang_vente ? ` · 🏆 #${p.rang_vente}` : ''}</div>
                </div>
              </div>
            </td>
            <td style="padding:8px 10px;color:var(--text2);font-size:11px;white-space:nowrap">${p.marque || '—'}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:${OFFILOG_ORANGE};white-space:nowrap">${p.prix_offilog ? fmtP(p.prix_offilog) : '—'}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#15803d;white-space:nowrap">${p.prix_live ? fmtP(p.prix_live) : '—'}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--mint);white-space:nowrap">${p.prix_pharmacie ? fmtP(p.prix_pharmacie) : '—'}</td>
            <td style="padding:8px 10px;text-align:right;color:var(--text2);white-space:nowrap">${p.prix_drakkars ? fmtP(p.prix_drakkars) : '—'}</td>
            <td style="padding:8px 10px;text-align:right;color:var(--text2);white-space:nowrap">${p.prix_cap3000 ? fmtP(p.prix_cap3000) : '—'}</td>
            <td style="padding:8px 10px;text-align:right;white-space:nowrap">
              ${p.marge_pct != null ? `<span style="font-weight:700;color:${margeColor}">${p.marge_pct.toFixed(1)}%</span>` : '—'}
              ${deltaRef != null ? `<div style="font-size:9px;font-weight:700;color:${deltaColor}">${deltaRef > 0 ? '−' : '+'}${fmtP(Math.abs(deltaRef))} conc.</div>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>` : `<div style="padding:60px;text-align:center;color:var(--text3)">Aucun produit trouvé.</div>`;

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
        <div style="background:rgba(0,229,160,.15);border-radius:14px;padding:12px 18px;text-align:center;backdrop-filter:blur(8px);border:1px solid rgba(0,229,160,.3)">
          <div style="font-size:22px;font-weight:900;color:#00E5A0">${fmtNum(nPharma)}</div>
          <div style="font-size:10px;color:rgba(0,229,160,.8);text-transform:uppercase;letter-spacing:.5px">Ma Pharmacie</div>
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
      <!-- Vue toggle cards / table -->
      <div style="display:flex;border:1.5px solid var(--border2);border-radius:10px;overflow:hidden;flex-shrink:0">
        <button onclick="offiView='cards';renderOffilog()" style="padding:7px 12px;border:none;background:${offiView==='cards'?OFFILOG_ORANGE:'transparent'};color:${offiView==='cards'?'#fff':'var(--text3)'};cursor:pointer;font-size:14px;line-height:1;transition:all .15s" title="Vue cartes">⊞</button>
        <button onclick="offiView='table';renderOffilog()" style="padding:7px 12px;border:none;background:${offiView==='table'?OFFILOG_ORANGE:'transparent'};color:${offiView==='table'?'#fff':'var(--text3)'};cursor:pointer;font-size:14px;line-height:1;transition:all .15s" title="Vue tableau">☰</button>
      </div>
      <!-- Export CSV -->
      <button onclick="offiExportCSV()" title="Exporter la liste filtrée en CSV"
        style="padding:7px 12px;border-radius:10px;border:1.5px solid var(--border2);background:transparent;color:var(--text3);cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;transition:all .15s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='transparent'">
        ⬇ CSV
      </button>
      <!-- Saison filter -->
      <div style="display:flex;border:1.5px solid var(--border2);border-radius:10px;overflow:hidden;flex-shrink:0">
        ${[{k:'tous',l:'Toute saison'},{k:'annee',l:'Année'},{k:'pe',l:'☀️ P/É'},{k:'ah',l:'❄️ A/H'}].map(t =>
          `<button onclick="offiSetSaison('${t.k}')" style="padding:6px 10px;border:none;background:${offiSaison===t.k?'rgba(255,107,53,.15)':'transparent'};color:${offiSaison===t.k?OFFILOG_ORANGE:'var(--text3)'};cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap;transition:all .15s">${t.l}</button>`
        ).join('')}
      </div>
      ${offiQuery || offiRole !== 'tous' || offiUnivers !== 'tous' || offiMarque !== 'tous' || offiSaison !== 'tous'
        ? `<button onclick="offiQuery='';offiRole='tous';offiUnivers='tous';offiMarque='tous';offiSaison='tous';offiPageNum=1;renderOffilog()"
            style="padding:8px 14px;border-radius:12px;border:1.5px solid var(--rose);background:rgba(239,68,68,.06);color:#EF4444;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
            ✕ Réinitialiser
          </button>` : ''}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      ${roleChips}
      <span style="margin-left:auto;font-size:12px;color:var(--text3)">${fmtNum(offiCurrentData.length)} résultat${offiCurrentData.length>1?'s':''} · page ${offiPageNum}/${totalPages}</span>
    </div>
  </div>

  <!-- Cards / Table view -->
  ${offiView === 'table'
    ? tableHtml
    : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">${cardsHtml}</div>`
  }

  ${pagHtml}`;
}

// ── OFFILOG DETAIL MODAL ─────────────────────
function showOffiDetail(idx) {
  const p = offiCurrentData[idx];
  if (!p) return;
  offiDetailProduct = p;

  const um = univMeta(p.univers || 'Non classé');
  const rm = roleMeta(p.role);
  const prixIP = p.prix_live || p.prix_offilog;

  // Benchmark match (Ameli data)
  let bm = null;
  if (typeof BENCHMARK !== 'undefined') {
    const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (p.ean) bm = BENCHMARK.find(b => b.cip13 === p.ean);
    if (!bm) bm = BENCHMARK.find(b => nn(b.designation) === nn(p.produit));
  }

  // Our sales for this product
  const nn2 = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const prodSales = getSales().filter(s => nn2(s.artDesignation) === nn2(p.produit));
  const salesTotCa  = prodSales.reduce((a, s) => a + s.mntNetHt, 0);
  const salesTotQte = prodSales.reduce((a, s) => a + s.qte, 0);

  // Price comparison
  const pricesRaw = [
    { label: 'Prix Offilog (Excel)', value: p.prix_offilog, color: OFFILOG_ORANGE },
    { label: 'Prix Live ●',          value: p.prix_live,      color: '#15803d' },
    { label: '🏥 Ma Pharmacie',      value: p.prix_pharmacie, color: '#00E5A0' },
    { label: 'Drakkars',             value: p.prix_drakkars,  color: 'var(--text2)' },
    { label: 'Cap3000',              value: p.prix_cap3000,   color: 'var(--text2)' },
    { label: 'Prix public maxi',     value: p.prix_maxi,      color: 'var(--text3)' },
  ].filter(r => r.value != null && r.value > 0);

  const compVals = [p.prix_drakkars, p.prix_cap3000, p.prix_pharmacie].filter(v => v > 0);
  const minComp  = compVals.length ? Math.min(...compVals) : null;
  const deltaComp = (prixIP && minComp) ? minComp - prixIP : null;

  const priceRowsHtml = pricesRaw.map(pr => {
    const dv = (prixIP && pr.value && Math.abs(pr.value - prixIP) > 0.005) ? pr.value - prixIP : null;
    const dvHtml = dv != null
      ? `<span style="font-size:10px;margin-left:8px;color:${dv > 0 ? '#10B981' : '#EF4444'};font-weight:700">${dv > 0 ? '+' : ''}${fmtP(dv)}</span>`
      : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border1)">
      <span style="font-size:12px;color:var(--text3)">${pr.label}</span>
      <div style="text-align:right"><span style="font-size:15px;font-weight:700;color:${pr.color}">${fmtP(pr.value)}</span>${dvHtml}</div>
    </div>`;
  }).join('');

  const imgHtml = p.img
    ? `<img src="${p.img}" alt="" style="max-width:100%;max-height:200px;object-fit:contain" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div style="display:none;font-size:56px;align-items:center;justify-content:center;width:100%;height:200px">${um.icon}</div>`
    : `<div style="font-size:56px;text-align:center;line-height:1">${um.icon}</div>`;

  const navPrev = idx > 0
    ? `<button onclick="document.getElementById('offi-dm').remove();showOffiDetail(${idx - 1})" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);cursor:pointer;font-size:12px;color:var(--text2)">← Préc.</button>`
    : `<button disabled style="padding:6px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:12px;color:var(--text3);opacity:.4">← Préc.</button>`;
  const navNext = idx < offiCurrentData.length - 1
    ? `<button onclick="document.getElementById('offi-dm').remove();showOffiDetail(${idx + 1})" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);cursor:pointer;font-size:12px;color:var(--text2)">Suiv. →</button>`
    : `<button disabled style="padding:6px 14px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:12px;color:var(--text3);opacity:.4">Suiv. →</button>`;

  const ventesHtml = prodSales.length ? `
    <div style="margin-top:16px;padding:12px;background:rgba(0,229,160,.06);border-radius:12px;border:1px solid rgba(0,229,160,.2)">
      <div style="font-size:11px;font-weight:700;color:var(--mint);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Nos ventes</div>
      <div style="display:flex;gap:16px">
        <div><div style="font-size:18px;font-weight:800;color:var(--mint)">${fmt(salesTotCa)}</div><div style="font-size:10px;color:var(--text3)">CA HT</div></div>
        <div><div style="font-size:18px;font-weight:800;color:var(--text2)">${fmtNum(Math.round(salesTotQte))}</div><div style="font-size:10px;color:var(--text3)">Unités</div></div>
      </div>
    </div>` : '';

  const ameliHtml = bm ? `
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border1)">
      <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Benchmark Ameli</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${bm.ip_qty ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--blue)">${fmtNum(bm.ip_qty)}</div><div style="font-size:10px;color:var(--text3)">Unités IP</div></div>` : ''}
        ${bm.ip_ca ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--mint)">${fmt(bm.ip_ca)}</div><div style="font-size:10px;color:var(--text3)">CA IP</div></div>` : ''}
        ${bm.rot_pharma_jan26 ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--amber)">${bm.rot_pharma_jan26.toFixed(1)}</div><div style="font-size:10px;color:var(--text3)">Rot. janv.</div></div>` : ''}
        ${bm.ip_rank_qty ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--text2)">#${bm.ip_rank_qty}</div><div style="font-size:10px;color:var(--text3)">Rang IP</div></div>` : ''}
      </div>
    </div>` : '';

  const existing = document.getElementById('offi-dm');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'offi-dm';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:24px;width:100%;max-width:800px;max-height:90vh;overflow:hidden;box-shadow:0 32px 100px rgba(0,0,0,.4);display:flex;flex-direction:column">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--border1);flex-shrink:0">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span style="font-size:11px;font-weight:700;color:${um.color};text-transform:uppercase;letter-spacing:1px">${p.univers || '—'}</span>
          ${p.dans_offilog ? `<span style="font-size:10px;padding:2px 7px;border-radius:6px;background:${OFFILOG_ORANGE}22;color:${OFFILOG_ORANGE};font-weight:700;border:1px solid ${OFFILOG_ORANGE}44">IP</span>` : ''}
          ${p.rang_vente != null ? `<span style="font-size:10px;padding:2px 7px;border-radius:6px;background:#fef3c7;color:#92400e;font-weight:800">🏆 #${p.rang_vente}</span>` : ''}
          ${p.saison && p.saison !== 'Toute année' ? `<span style="font-size:10px;padding:2px 7px;border-radius:6px;background:#fef9c3;color:#92400e;font-weight:600">${p.saison === 'Printemps/Été' ? '☀️ P/É' : '❄️ A/H'}</span>` : ''}
        </div>
        <button onclick="document.getElementById('offi-dm').remove()"
          style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);cursor:pointer;font-size:16px;color:var(--text2);display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
      </div>
      <!-- Body -->
      <div style="display:flex;flex:1;overflow:hidden;min-height:0">
        <!-- Left: photo + identity -->
        <div style="flex:0 0 260px;padding:20px;border-right:1px solid var(--border1);overflow-y:auto;display:flex;flex-direction:column;gap:0">
          <div style="border-radius:16px;background:${um.bg};min-height:180px;display:flex;align-items:center;justify-content:center;padding:16px;margin-bottom:14px">
            ${imgHtml}
          </div>
          <div style="font-size:10px;font-weight:700;color:${um.color};text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px">${p.marque || '—'}</div>
          <div style="font-size:16px;font-weight:800;color:var(--text);line-height:1.4;margin-bottom:10px">${p.produit}</div>
          ${p.ean ? `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">EAN : <span style="font-family:monospace;color:var(--text2);font-size:12px">${p.ean}</span></div>` : ''}
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
            <span style="font-size:10px;padding:3px 8px;border-radius:8px;background:${rm.bg};color:${rm.color};font-weight:700">${rm.icon} ${p.role || '—'}</span>
          </div>
          ${ventesHtml}
          ${ameliHtml}
          ${prixIP ? `<button onclick="simAddOffilog(offiDetailProduct.produit,${prixIP});this.textContent='✓ Ajouté!';this.style.background='rgba(0,229,160,.12)';this.style.color='var(--mint)';this.style.borderColor='rgba(0,229,160,.4)'"
            style="width:100%;padding:9px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);cursor:pointer;font-size:12px;font-weight:700;color:var(--text2);transition:all .15s;margin-bottom:10px">
            🛒 Ajouter au simulateur
          </button>` : ''}
          <div style="display:flex;gap:6px;margin-top:auto;padding-top:0">${navPrev}${navNext}</div>
        </div>
        <!-- Right: prices + benchmark -->
        <div style="flex:1;padding:20px 24px;overflow-y:auto">
          <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Comparaison des prix</div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:14px">${fmtNum(pricesRaw.length)} source${pricesRaw.length > 1 ? 's' : ''} disponible${pricesRaw.length > 1 ? 's' : ''}</div>
          ${priceRowsHtml || '<div style="color:var(--text3);font-size:13px;padding:20px 0">Aucun prix disponible</div>'}
          ${deltaComp != null ? `<div style="margin-top:14px;padding:12px 16px;border-radius:12px;background:${deltaComp > 0 ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)'};border:1px solid ${deltaComp > 0 ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}">
            <span style="font-size:12px;font-weight:700;color:${deltaComp > 0 ? '#065f46' : '#991b1b'}">
              ${deltaComp > 0 ? `✅ IP moins cher de ${fmtP(deltaComp)} vs concurrent le moins cher` : `⚠️ IP plus cher de ${fmtP(Math.abs(deltaComp))} vs concurrent le moins cher`}
            </span>
          </div>` : ''}
          ${p.marge_pct != null ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border1)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:12px;color:var(--text3)">Marge pharmacie estimée</span>
              <span style="font-size:18px;font-weight:800;color:${p.marge_pct >= 40 ? '#10B981' : p.marge_pct >= 20 ? '#F59E0B' : '#EF4444'}">${p.marge_pct.toFixed(1)}%</span>
            </div>
            <div style="height:8px;border-radius:4px;background:var(--border1);overflow:hidden">
              <div style="height:100%;width:${Math.min(100, p.marge_pct)}%;background:${p.marge_pct >= 40 ? '#10B981' : p.marge_pct >= 20 ? '#F59E0B' : '#EF4444'};border-radius:4px"></div>
            </div>
          </div>` : ''}
        </div>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function escH(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escH); }
    if (e.key === 'ArrowRight' && idx < offiCurrentData.length - 1) { modal.remove(); document.removeEventListener('keydown', escH); showOffiDetail(idx + 1); }
    if (e.key === 'ArrowLeft'  && idx > 0) { modal.remove(); document.removeEventListener('keydown', escH); showOffiDetail(idx - 1); }
  });
  document.body.appendChild(modal);
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


// ── GROUPEMENTS ────────────────────────────────────────────────────────────────

const GROUPEMENTS = [
  {
    id: 'opso',
    nom: 'Opso Santé',
    couleur: '#6366F1',
    bg: '#EEF2FF',
    icon: '🏥',
    description: 'Groupement de pharmacies indépendantes',
  },
];

let grpActif = 'opso';
let grpOnglet = 'tableau-de-bord';
let grpSearchModal = '';

// Membres du groupement : { grpId: [pharmacyId, ...] } — persisté localStorage
function grpLoadMembers() {
  try { return JSON.parse(localStorage.getItem('grp_members') || '{}'); } catch { return {}; }
}
function grpSaveMembers(members) {
  localStorage.setItem('grp_members', JSON.stringify(members));
}
function grpGetMembers(grpId) {
  return grpLoadMembers()[grpId] || [];
}
function grpAddMember(grpId, pharmacyId) {
  const all = grpLoadMembers();
  if (!all[grpId]) all[grpId] = [];
  if (!all[grpId].includes(pharmacyId)) all[grpId].push(pharmacyId);
  grpSaveMembers(all);
}
function grpRemoveMember(grpId, pharmacyId) {
  const all = grpLoadMembers();
  if (all[grpId]) all[grpId] = all[grpId].filter(id => id !== pharmacyId);
  grpSaveMembers(all);
  renderGroupements();
}
function grpToggleModal(grpId) {
  const el = document.getElementById('grp-modal');
  if (el) { el.remove(); return; }
  grpSearchModal = '';
  grpRenderModal(grpId);
}
function grpRenderModal(grpId) {
  const grp = GROUPEMENTS.find(g => g.id === grpId);
  const members = grpGetMembers(grpId);
  const q = grpSearchModal.toLowerCase();

  const candidates = state.pharmacies.filter(ph => {
    if (members.includes(ph.id)) return false;
    if (!q) return true;
    const clientInfo = typeof CLIENTS !== 'undefined'
      ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === ph.name.toUpperCase().trim())
      : null;
    const ville = clientInfo?.ville || '';
    return ph.name.toLowerCase().includes(q) || ville.toLowerCase().includes(q);
  });

  const existing = document.getElementById('grp-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'grp-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:20px;width:100%;max-width:520px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.3);overflow:hidden">
      <!-- Header modal -->
      <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border1);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text)">Ajouter une pharmacie</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${grp.nom} — ${members.length} membre(s) actuel(s)</div>
        </div>
        <button onclick="document.getElementById('grp-modal').remove()"
          style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;color:var(--text2)">✕</button>
      </div>
      <!-- Search -->
      <div style="padding:12px 24px;border-bottom:1px solid var(--border1);flex-shrink:0">
        <div style="display:flex;align-items:center;gap:8px;border:1.5px solid var(--border2);border-radius:10px;padding:8px 12px;background:var(--bg2)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Rechercher par nom ou ville…" value="${grpSearchModal}"
            oninput="grpSearchModal=this.value;grpRenderModal('${grpId}')"
            style="border:none;background:transparent;outline:none;flex:1;font-size:13px;color:var(--text)"
            autofocus>
        </div>
      </div>
      <!-- Liste -->
      <div style="overflow-y:auto;flex:1;padding:8px 12px">
        ${candidates.length === 0
          ? `<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">${q ? 'Aucun résultat' : 'Toutes les pharmacies sont déjà membres'}</div>`
          : candidates.map(ph => {
              const ci = typeof CLIENTS !== 'undefined'
                ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === ph.name.toUpperCase().trim())
                : null;
              const ville = ci?.ville || '';
              const ca = ci?.ca2023 ? `CA ${fmt(ci.ca2023)}` : '';
              return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .12s"
                onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''"
                onclick="grpAddMember('${grpId}',${ph.id});grpRenderModal('${grpId}')">
                <div style="width:36px;height:36px;border-radius:10px;background:${ph.color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0">
                  ${ph.name.charAt(0).toUpperCase()}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ph.name}</div>
                  <div style="font-size:11px;color:var(--text3)">${[ville, ca].filter(Boolean).join(' · ')}</div>
                </div>
                <div style="width:22px;height:22px;border-radius:6px;border:1.5px solid var(--border2);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--text3);font-size:12px">+</div>
              </div>`;
            }).join('')
        }
      </div>
      <!-- Footer -->
      <div style="padding:14px 24px;border-top:1px solid var(--border1);display:flex;justify-content:flex-end;flex-shrink:0">
        <button onclick="document.getElementById('grp-modal').remove();renderGroupements()"
          style="padding:9px 22px;border-radius:10px;background:${grp.couleur};color:#fff;border:none;font-size:13px;font-weight:700;cursor:pointer">
          Terminé
        </button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); renderGroupements(); } });
  document.body.appendChild(modal);
  modal.querySelector('input')?.focus();
}

function renderGroupements() {
  const container = document.getElementById('groupements-content');
  if (!container) return;

  const grp = GROUPEMENTS.find(g => g.id === grpActif) || GROUPEMENTS[0];

  const grpTabs = [
    { key: 'tableau-de-bord', label: 'Tableau de bord', icon: '📊' },
    { key: 'pharmacies',      label: 'Pharmacies',       icon: '🏪' },
    { key: 'commandes',       label: 'Commandes',        icon: '📦' },
    { key: 'objectifs',       label: 'Objectifs',        icon: '🎯' },
    { key: 'documents',       label: 'Documents',        icon: '📄' },
  ];

  const tabsHtml = grpTabs.map(t => {
    const active = grpOnglet === t.key;
    return `<button onclick="grpOnglet='${t.key}';renderGroupements()"
      style="padding:8px 16px;border-radius:10px;font-size:13px;font-weight:600;border:none;
             background:${active ? grp.couleur : 'transparent'};
             color:${active ? '#fff' : 'var(--text2)'};cursor:pointer;transition:all .15s;white-space:nowrap">
      ${t.icon} ${t.label}
    </button>`;
  }).join('');

  const bodyHtml = renderGroupementBody(grp, grpOnglet);

  container.innerHTML = `
  <!-- Header groupement -->
  <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,${grp.couleur} 100%);border-radius:20px;padding:24px 28px;margin-bottom:20px;position:relative;overflow:hidden">
    <div style="position:absolute;top:-30px;right:-20px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
    <div style="display:flex;align-items:center;gap:16px;position:relative">
      <div style="width:56px;height:56px;border-radius:16px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">${grp.icon}</div>
      <div>
        <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:2px;margin-bottom:3px">Groupement</div>
        <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:-.3px">${grp.nom}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:2px">${grp.description}</div>
      </div>
    </div>
  </div>

  <!-- Sélecteur groupements (si plusieurs) -->
  ${GROUPEMENTS.length > 1 ? `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
    ${GROUPEMENTS.map(g => `<button onclick="grpActif='${g.id}';grpOnglet='tableau-de-bord';renderGroupements()"
      style="padding:6px 14px;border-radius:10px;font-size:12px;font-weight:600;border:2px solid ${g.id===grpActif ? g.couleur : 'var(--border2)'};background:${g.id===grpActif ? g.couleur+'18' : 'var(--bg2)'};color:${g.id===grpActif ? g.couleur : 'var(--text2)'};cursor:pointer">
      ${g.icon} ${g.nom}
    </button>`).join('')}
  </div>` : ''}

  <!-- Tabs -->
  <div style="display:flex;gap:4px;background:var(--bg2);border-radius:14px;padding:4px;margin-bottom:20px;overflow-x:auto;scrollbar-width:none">
    ${tabsHtml}
  </div>

  <!-- Contenu -->
  ${bodyHtml}
  `;
}

function renderGroupementBody(grp, onglet) {
  if (onglet === 'tableau-de-bord') return renderGrpDashboard(grp);
  if (onglet === 'pharmacies')      return renderGrpPharmacies(grp);
  if (onglet === 'commandes')       return renderGrpCommandes(grp);
  if (onglet === 'objectifs')       return renderGrpObjectifs(grp);
  if (onglet === 'documents')       return renderGrpDocuments(grp);
  return '';
}

function renderGrpDashboard(grp) {
  const memberIds = grpGetMembers(grp.id);
  const members   = memberIds.map(id => state.pharmacies.find(p => p.id === id)).filter(Boolean);
  const totalCA   = members.reduce((s, ph) => {
    const ci = typeof CLIENTS !== 'undefined'
      ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === ph.name.toUpperCase().trim())
      : null;
    return s + (ci?.ca2023 || 0);
  }, 0);

  const kpis = [
    { label: 'Pharmacies',    value: members.length || '—', icon: '🏪', sub: 'membres actifs' },
    { label: 'CA cumulé',     value: totalCA > 0 ? fmt(totalCA) : '—', icon: '💰', sub: 'CA 2023 membres' },
    { label: 'Croissance',    value: '—',  icon: '📈', sub: 'vs période préc.' },
    { label: 'Taux adhésion', value: '—',  icon: '✅', sub: 'sur les offres IP' },
  ];

  const kpiHtml = kpis.map(k => `
    <div class="card" style="display:flex;flex-direction:column;gap:4px">
      <div style="font-size:22px;line-height:1;margin-bottom:4px">${k.icon}</div>
      <div style="font-size:26px;font-weight:900;color:${grp.couleur};letter-spacing:-.5px">${k.value}</div>
      <div style="font-size:12px;font-weight:700;color:var(--text)">${k.label}</div>
      <div style="font-size:11px;color:var(--text3)">${k.sub}</div>
    </div>`).join('');

  // Données de ventes des membres
  const allSales   = getSales();
  const { year: curY, month: curM } = getCurrentPeriod(allSales.length ? allSales : []);
  const { year: prevY, month: prevM } = curY ? getPrevPeriod(curY, curM) : { year: null, month: null };

  const memberSalesCur  = allSales.filter(s => memberIds.includes(s.pharmacyId) && s.year === curY  && s.month === curM);
  const memberSalesPrev = allSales.filter(s => memberIds.includes(s.pharmacyId) && s.year === prevY && s.month === prevM);
  const caCur  = sumCA(memberSalesCur);
  const caPrev = sumCA(memberSalesPrev);

  const curLabel  = curY  ? `${monthName(curM)} ${curY}`   : 'En cours';
  const prevLabel = prevY ? `${monthName(prevM)} ${prevY}` : '—';

  // Top produits groupement
  const byProd = {};
  for (const s of memberSalesCur) {
    const k = (s.artDesignation || '').trim().toUpperCase();
    if (!k) continue;
    if (!byProd[k]) byProd[k] = { label: s.artDesignation, ca: 0, qte: 0, cat: classifyProduct(s) };
    byProd[k].ca  += s.mntNetHt;
    byProd[k].qte += s.qte;
  }
  const topProds = Object.values(byProd).sort((a,b) => b.ca - a.ca).slice(0, 8);

  // KPIs enrichis
  const kpisEnriched = [
    { label: 'Pharmacies', value: members.length || '—', icon: '🏪', sub: 'membres' },
    { label: 'CA Groupement', value: caCur > 0 ? fmt(caCur) : (totalCA > 0 ? fmt(totalCA) : '—'), icon: '💰', sub: caCur > 0 ? curLabel : 'CA 2023 estimé' },
    { label: 'vs M-1', value: caPrev > 0 ? (() => { const d = (caCur-caPrev)/caPrev*100; return `${d>=0?'+':''}${d.toFixed(1)}%`; })() : '—', icon: '📈', sub: prevLabel },
    { label: 'Panier moyen', value: (members.length > 0 && caCur > 0) ? fmt(caCur / members.length) : '—', icon: '🛒', sub: 'par pharmacie' },
  ];

  const kpiHtmlEnriched = kpisEnriched.map(k => `
    <div class="card" style="display:flex;flex-direction:column;gap:4px">
      <div style="font-size:22px;line-height:1;margin-bottom:4px">${k.icon}</div>
      <div style="font-size:26px;font-weight:900;color:${grp.couleur};letter-spacing:-.5px">${k.value}</div>
      <div style="font-size:12px;font-weight:700;color:var(--text)">${k.label}</div>
      <div style="font-size:11px;color:var(--text3)">${k.sub}</div>
    </div>`).join('');

  // M vs M-1 par membre
  const membersCompHtml = members.length ? `
  <div class="card" style="margin-top:16px">
    <div class="card-header">
      <div>
        <div class="card-title">Performances membres — ${curLabel}</div>
        <div class="card-subtitle">${prevLabel} → ${curLabel}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid var(--border2)">
        <th style="padding:9px 16px;text-align:left;font-size:11px;color:var(--text3);font-weight:700">Pharmacie</th>
        <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--text3);font-weight:700">${prevLabel}</th>
        <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--text3);font-weight:700">${curLabel}</th>
        <th style="padding:9px 12px;text-align:right;font-size:11px;color:var(--text3);font-weight:700">Évol.</th>
      </tr></thead>
      <tbody>
        ${members.map(ph => {
          const c = sumCA(memberSalesCur.filter(s => s.pharmacyId === ph.id));
          const p = sumCA(memberSalesPrev.filter(s => s.pharmacyId === ph.id));
          return `<tr style="border-bottom:1px solid var(--border1)">
            <td style="padding:10px 16px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="width:8px;height:8px;border-radius:50%;background:${ph.color};flex-shrink:0"></span>
                <span style="font-size:13px;font-weight:600">${ph.name}</span>
              </div>
            </td>
            <td style="padding:10px 12px;text-align:right;font-size:12px;color:var(--text2)">${p > 0 ? fmt(p) : '—'}</td>
            <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700">${c > 0 ? fmt(c) : '—'}</td>
            <td style="padding:10px 12px;text-align:right">${deltaBadge(c, p)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>` : '';

  // Top produits groupement
  const topProdsHtml = topProds.length ? `
  <div class="card" style="margin-top:16px">
    <div class="card-header">
      <div class="card-title">Top produits groupement — ${curLabel}</div>
      <div class="card-subtitle">${Object.keys(byProd).length} références</div>
    </div>
    ${topProds.map((p, i) => {
      const cat = CATS[p.cat] || CATS.mi;
      const maxCa = topProds[0].ca;
      return `<div style="display:flex;align-items:center;gap:12px;padding:9px 20px;border-bottom:1px solid var(--border1)">
        <div style="font-size:11px;font-weight:800;color:var(--text3);width:20px;text-align:right;flex-shrink:0">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.label}</div>
          <div style="margin-top:3px;height:3px;border-radius:2px;background:var(--border1)">
            <div style="height:100%;border-radius:2px;background:${cat.color};width:${(p.ca/maxCa*100).toFixed(0)}%"></div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:12px;font-weight:700">${fmt(p.ca)}</div>
          <div style="font-size:10px;color:var(--text3)">${p.qte.toFixed(0)} u</div>
        </div>
        <span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${cat.color}18;color:${cat.color};font-weight:700;flex-shrink:0">${cat.icon}</span>
      </div>`;
    }).join('')}
  </div>` : '';

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:0">
    ${kpiHtmlEnriched}
  </div>
  ${membersCompHtml}
  ${topProdsHtml}
  ${!members.length ? `<div class="card" style="margin-top:16px;padding:48px;text-align:center;color:var(--text3)">
    <div style="font-size:40px;margin-bottom:12px">🏪</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:6px">Aucun membre</div>
    <div style="font-size:12px">Ajoutez des pharmacies via l'onglet <strong>Pharmacies</strong>.</div>
  </div>` : ''}`;
}

function renderGrpPharmacies(grp) {
  const memberIds = grpGetMembers(grp.id);
  const members = memberIds
    .map(id => state.pharmacies.find(p => p.id === id))
    .filter(Boolean);

  const rowsHtml = members.length === 0
    ? `<div style="padding:48px;text-align:center;color:var(--text3)">
        <div style="font-size:40px;margin-bottom:12px">🏪</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">Aucune pharmacie</div>
        <div style="font-size:12px">Cliquez sur <strong>+ Ajouter</strong> pour associer des pharmacies à ce groupement.</div>
       </div>`
    : `<table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid var(--border2)">
            <th style="padding:10px 16px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Pharmacie</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Ville</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">CA 2023</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Pot. Gx</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Action</th>
          </tr>
        </thead>
        <tbody>
          ${members.map(ph => {
            const ci = typeof CLIENTS !== 'undefined'
              ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === ph.name.toUpperCase().trim())
              : null;
            const ville = ci?.ville || '—';
            const ca = ci?.ca2023 ? fmt(ci.ca2023) : '—';
            const gx = ci?.potentielGx > 0 ? fmt(ci.potentielGx) : '—';
            return `<tr style="border-bottom:1px solid var(--border1);transition:background .12s"
              onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
              <td style="padding:12px 16px">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:32px;height:32px;border-radius:8px;background:${ph.color};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0">
                    ${ph.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-size:13px;font-weight:700;color:var(--text)">${ph.name}</div>
                    ${ci?.tel ? `<div style="font-size:11px;color:var(--text3)">${ci.tel}</div>` : ''}
                  </div>
                </div>
              </td>
              <td style="padding:12px;font-size:13px;color:var(--text2)">${ville}</td>
              <td style="padding:12px;text-align:right;font-size:13px;font-weight:600;color:var(--text)">${ca}</td>
              <td style="padding:12px;text-align:right;font-size:13px;color:${ci?.potentielGx > 0 ? 'var(--blue)' : 'var(--text3)'}">${gx}</td>
              <td style="padding:12px;text-align:center">
                <button onclick="if(confirm('Retirer ${ph.name.replace(/'/g,'\\'')} du groupement ?')){grpRemoveMember('${grp.id}',${ph.id})}"
                  style="padding:4px 10px;border-radius:6px;border:1px solid var(--rose);background:transparent;color:var(--rose);font-size:11px;font-weight:600;cursor:pointer">
                  Retirer
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

  return `<div class="card">
    <div class="card-header">
      <div>
        <div class="card-title">Pharmacies membres — ${grp.nom}</div>
        <div class="card-subtitle">${members.length} pharmacie${members.length > 1 ? 's' : ''} dans ce groupement</div>
      </div>
      <button class="btn btn-primary" style="font-size:12px" onclick="grpToggleModal('${grp.id}')">+ Ajouter</button>
    </div>
    <div style="overflow-x:auto">${rowsHtml}</div>
  </div>`;
}

function renderGrpCommandes(grp) {
  const memberIds = grpGetMembers(grp.id);
  const members   = memberIds.map(id => state.pharmacies.find(p => p.id === id)).filter(Boolean);

  // Regrouper les imports par période pour les membres
  const memberImports = state.imports
    .filter(i => memberIds.includes(i.pharmacyId))
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });

  if (!memberImports.length) {
    return `<div class="card">
      <div class="card-header">
        <div class="card-title">Commandes groupement — ${grp.nom}</div>
        <button class="btn btn-ghost" style="font-size:12px" onclick="navigate('import')">↑ Importer Excel</button>
      </div>
      <div style="padding:48px;text-align:center;color:var(--text3)">
        <div style="font-size:40px;margin-bottom:12px">📦</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">Aucune commande importée</div>
        <div style="font-size:12px">Importez des fichiers Excel dans l'onglet Import pour les membres de ce groupement.</div>
        ${!members.length ? `<div style="margin-top:8px;font-size:12px;color:var(--rose)">⚠ Aucune pharmacie membre — ajoutez-en dans l'onglet Pharmacies</div>` : ''}
      </div>
    </div>`;
  }

  // Grouper par période
  const byPeriod = {};
  for (const imp of memberImports) {
    const k = `${imp.year}-${String(imp.month).padStart(2,'0')}`;
    if (!byPeriod[k]) byPeriod[k] = { year: imp.year, month: imp.month, imports: [] };
    byPeriod[k].imports.push(imp);
  }

  const periodsHtml = Object.entries(byPeriod)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([key, period]) => {
      const periodSales = getSales({ year: period.year, month: period.month })
        .filter(s => memberIds.includes(s.pharmacyId));
      const ca = sumCA(periodSales);
      const label = `${monthName(period.month)} ${period.year}`;

      const importsRows = period.imports.map(imp => {
        const ph = state.pharmacies.find(p => p.id === imp.pharmacyId);
        const phCA = sumCA(getSales({ pharmacyId: imp.pharmacyId, year: imp.year, month: imp.month }));
        return `<div style="display:flex;align-items:center;gap:12px;padding:8px 20px;border-bottom:1px solid var(--border1)">
          <div style="width:8px;height:8px;border-radius:50%;background:${ph?.color || '#ccc'};flex-shrink:0"></div>
          <div style="flex:1;font-size:12px;font-weight:600;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ph?.name || '—'}</div>
          <div style="font-size:11px;color:var(--text3);white-space:nowrap">${imp.filename}</div>
          <div style="font-size:13px;font-weight:700;text-align:right;white-space:nowrap">${phCA > 0 ? fmt(phCA) : '—'}</div>
          ${imp.filePath ? `<button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;color:var(--blue)" onclick="downloadImportFile('${imp.filePath}')">⬇</button>` : '<div style="width:36px"></div>'}
        </div>`;
      }).join('');

      return `<div style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--bg2);border-radius:10px;margin-bottom:4px">
          <div style="font-size:13px;font-weight:700">${label}</div>
          <div style="font-size:15px;font-weight:900;color:${grp.couleur}">${ca > 0 ? fmt(ca) : '—'}</div>
        </div>
        <div style="border:1px solid var(--border1);border-radius:10px;overflow:hidden">${importsRows}</div>
      </div>`;
    }).join('');

  return `<div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700">${memberImports.length} import${memberImports.length > 1 ? 's' : ''} · ${Object.keys(byPeriod).length} période${Object.keys(byPeriod).length > 1 ? 's' : ''}</div>
      <button class="btn btn-ghost" style="font-size:12px" onclick="navigate('import')">↑ Importer Excel</button>
    </div>
    ${periodsHtml}
  </div>`;
}

function renderGrpObjectifs(grp) {
  const memberIds = grpGetMembers(grp.id);
  const allSales  = getSales();
  const { year: curY, month: curM } = getCurrentPeriod(allSales.length ? allSales : []);
  const caCur = sumCA(allSales.filter(s => memberIds.includes(s.pharmacyId) && s.year === curY && s.month === curM));

  // Objectifs stockés en localStorage
  const objKey = `grp_obj_${grp.id}`;
  let obj;
  try { obj = JSON.parse(localStorage.getItem(objKey) || '{}'); } catch { obj = {}; }
  const objCA = parseFloat(obj.ca) || 0;
  const pct = objCA > 0 ? Math.min(100, caCur / objCA * 100) : 0;
  const barColor = pct >= 100 ? '#10B981' : pct >= 75 ? '#F59E0B' : grp.couleur;

  return `<div class="card">
    <div class="card-header">
      <div class="card-title">Objectifs — ${grp.nom}</div>
    </div>
    <div style="padding:20px 24px">
      <div style="margin-bottom:20px">
        <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:6px">Objectif CA mensuel groupement (€)</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="grp-obj-ca-${grp.id}" type="number" placeholder="Ex : 15000" value="${objCA || ''}"
            style="flex:1;padding:10px 14px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);font-size:14px;color:var(--text);font-weight:600"
            oninput="this.dataset.changed='1'">
          <button class="btn btn-primary" style="font-size:12px;white-space:nowrap"
            onclick="(function(){
              const v = parseFloat(document.getElementById('grp-obj-ca-${grp.id}').value)||0;
              const o = (() => { try { return JSON.parse(localStorage.getItem('${objKey}')||'{}'); } catch { return {}; }})();
              o.ca = v;
              localStorage.setItem('${objKey}', JSON.stringify(o));
              renderGroupements();
            })()">
            Enregistrer
          </button>
        </div>
      </div>
      ${objCA > 0 ? `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:13px;font-weight:600">Avancement ${monthName(curM)} ${curY}</div>
          <div style="font-size:16px;font-weight:900;color:${barColor}">${pct.toFixed(1)}%</div>
        </div>
        <div style="position:relative;height:12px;border-radius:6px;background:var(--bg3)">
          <div style="position:absolute;inset:0;border-radius:6px;background:${barColor};width:${pct}%;transition:width .6s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--text3)">
          <span>Réalisé : <strong style="color:var(--text)">${fmt(caCur)}</strong></span>
          <span>Objectif : <strong style="color:var(--text)">${fmt(objCA)}</strong></span>
          ${caCur < objCA ? `<span style="color:var(--rose)">Reste : ${fmt(objCA - caCur)}</span>` : `<span style="color:#10B981">✓ Atteint !</span>`}
        </div>
      </div>` : ''}
    </div>
  </div>`;
}

function renderGrpDocuments(grp) {
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">Documents — ${grp.nom}</div>
      <button class="btn btn-ghost" style="font-size:12px" onclick="alert('Fonctionnalité à venir')">↑ Déposer</button>
    </div>
    <div style="padding:48px;text-align:center;color:var(--text3)">
      <div style="font-size:40px;margin-bottom:12px">📄</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">Aucun document</div>
      <div style="font-size:12px">Conditions tarifaires, accords de référencement, présentations — centralisez tout ici.</div>
    </div>
  </div>`;
}


// ── NOTES DE VISITE ───────────────────────────
function saveVisitNote(pharmacyId) {
  const input = document.getElementById(`visit-note-input-${pharmacyId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const key = `visit_notes_${pharmacyId}`;
  let notes;
  try { notes = JSON.parse(localStorage.getItem(key) || '[]'); } catch { notes = []; }
  notes.unshift({
    id: Date.now(),
    date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
    text,
  });
  localStorage.setItem(key, JSON.stringify(notes.slice(0, 50)));
  showPharmaDetail(pharmacyId);
}
function deleteVisitNote(pharmacyId, noteId) {
  const key = `visit_notes_${pharmacyId}`;
  let notes;
  try { notes = JSON.parse(localStorage.getItem(key) || '[]'); } catch { notes = []; }
  localStorage.setItem(key, JSON.stringify(notes.filter(n => n.id !== noteId)));
  showPharmaDetail(pharmacyId);
}

// ── FICHE VISITE ──────────────────────────────
function showFicheVisite(pharmacyId) {
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) return;

  const allPhSales = getSales({ pharmacyId: pharma.id });
  const { year: curY, month: curM } = getCurrentPeriod(allPhSales.length ? allPhSales : getSales());
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);
  const salesCur  = curY  ? getSales({ pharmacyId: pharma.id, year: curY, month: curM  }) : [];
  const salesPrev = prevY ? getSales({ pharmacyId: pharma.id, year: prevY, month: prevM }) : [];
  const caCur  = sumCA(salesCur);
  const caPrev = sumCA(salesPrev);
  const curLabel  = curY  ? `${monthName(curM)} ${curY}` : '—';
  const prevLabel = prevY ? `${monthName(prevM)} ${prevY}` : '—';

  const clientInfo = typeof CLIENTS !== 'undefined'
    ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === pharma.name.toUpperCase().trim())
    : null;

  // Top 5 produits
  const byProd = {};
  for (const s of salesCur) {
    const k = (s.artDesignation || '').trim().toUpperCase();
    if (!k) continue;
    if (!byProd[k]) byProd[k] = { label: s.artDesignation, ca: 0, qte: 0, cat: classifyProduct(s) };
    byProd[k].ca  += s.mntNetHt;
    byProd[k].qte += s.qte;
  }
  const top5 = Object.values(byProd).sort((a,b) => b.ca - a.ca).slice(0, 5);

  // Switch opps (top 3)
  const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const switchOpps = [];
  if (typeof BENCHMARK !== 'undefined') {
    for (const [k, prod] of Object.entries(byProd)) {
      const match = BENCHMARK.find(b => nn(b.designation) === k);
      if (match && match.prix_ip > 0 && prod.ca / prod.qte > 0 && match.prix_ip < (prod.ca / prod.qte) * 0.99) {
        switchOpps.push({
          designation: prod.label,
          gainMois: (prod.ca / prod.qte - match.prix_ip) * prod.qte,
        });
      }
    }
    switchOpps.sort((a, b) => b.gainMois - a.gainMois);
  }

  // Add opps (top 3)
  const ourNorms = new Set(Object.keys(byProd));
  const addOpps = typeof BENCHMARK !== 'undefined'
    ? BENCHMARK.filter(b => b.rot_pharma_jan26 > 2 && b.prix_ip > 0 && !ourNorms.has(nn(b.designation)))
        .sort((a, b) => b.rot_pharma_jan26 - a.rot_pharma_jan26).slice(0, 3)
    : [];

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const modal = document.createElement('div');
  modal.id = 'fiche-visite-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:2000;padding:20px';
  modal.innerHTML = `
    <div style="background:#fff;color:#1a1a2e;border-radius:20px;max-width:680px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.3)">
      <!-- Print header -->
      <div style="background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:24px 28px;border-radius:20px 20px 0 0;color:#fff">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:11px;font-weight:700;opacity:.6;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">Fiche de visite</div>
            <div style="font-size:22px;font-weight:900;letter-spacing:-.3px">${pharma.name}</div>
            ${clientInfo?.ville ? `<div style="font-size:12px;opacity:.7;margin-top:2px">${clientInfo.cp} ${clientInfo.ville} ${clientInfo.tel ? '· ' + clientInfo.tel : ''}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;opacity:.6">Intégral Pharma</div>
            <div style="font-size:12px;font-weight:600;margin-top:2px">${today}</div>
          </div>
        </div>
      </div>

      <div style="padding:24px 28px">
        <!-- KPIs -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
          <div style="padding:14px 16px;background:#f0f4ff;border-radius:12px;text-align:center">
            <div style="font-size:20px;font-weight:900;color:#1E3A8A">${fmt(caCur)}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px">CA ${curLabel}</div>
          </div>
          <div style="padding:14px 16px;background:${caCur >= caPrev ? '#f0fdf4' : '#fff5f5'};border-radius:12px;text-align:center">
            <div style="font-size:20px;font-weight:900;color:${caCur >= caPrev ? '#15803d' : '#dc2626'}">
              ${caPrev > 0 ? `${caCur >= caPrev ? '+' : ''}${((caCur - caPrev)/caPrev*100).toFixed(1)}%` : '—'}
            </div>
            <div style="font-size:11px;color:#475569;margin-top:2px">vs ${prevLabel}</div>
          </div>
          <div style="padding:14px 16px;background:#fefce8;border-radius:12px;text-align:center">
            <div style="font-size:20px;font-weight:900;color:#92400e">${Object.keys(byProd).length}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px">Références</div>
          </div>
        </div>

        <!-- Top 5 produits -->
        ${top5.length ? `
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Top produits — ${curLabel}</div>
          ${top5.map((p, i) => {
            const cat = CATS[p.cat] || CATS.mi;
            const pct = caCur > 0 ? (p.ca / caCur * 100).toFixed(1) : '0';
            return `<div style="display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid #f1f5f9">
              <div style="width:20px;font-size:12px;font-weight:800;color:#94a3b8;text-align:right;flex-shrink:0">${i+1}</div>
              <div style="flex:1;font-size:12px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.label}</div>
              <div style="font-size:11px;color:#64748b;flex-shrink:0">${p.qte.toFixed(0)} u</div>
              <div style="font-size:13px;font-weight:700;color:#1E3A8A;flex-shrink:0">${fmt(p.ca)}</div>
              <div style="font-size:10px;color:#94a3b8;flex-shrink:0">${pct}%</div>
              <span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${cat.color}18;color:${cat.color};font-weight:700">${cat.icon}</span>
            </div>`;
          }).join('')}
        </div>` : ''}

        <!-- Opportunités switch -->
        ${switchOpps.length ? `
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">🔄 Switches à proposer</div>
          ${switchOpps.slice(0,3).map(o => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9">
              <div style="font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.designation}</div>
              <div style="font-size:12px;font-weight:800;color:#16a34a;white-space:nowrap;margin-left:12px">+${fmt(o.gainMois)}/mois</div>
            </div>`).join('')}
        </div>` : ''}

        <!-- Opportunités ajout -->
        ${addOpps.length ? `
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">➕ Produits à référencer</div>
          ${addOpps.map(b => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9">
              <div style="font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.designation}</div>
              <div style="font-size:11px;color:#64748b;white-space:nowrap;margin-left:12px">${b.rot_pharma_jan26.toFixed(1)} boîtes/pharma · ${fmt(b.prix_ip)}</div>
            </div>`).join('')}
        </div>` : ''}

        <!-- Notes -->
        <div style="margin-bottom:8px">
          <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Notes de visite</div>
          <div style="border:1.5px dashed #cbd5e1;border-radius:8px;min-height:80px;padding:10px;font-size:12px;color:#94a3b8">_____________________</div>
        </div>
      </div>

      <!-- Actions -->
      <div style="padding:16px 28px;border-top:1px solid #e2e8f0;display:flex;gap:10px;justify-content:flex-end">
        <button onclick="window.print()" style="padding:9px 20px;border-radius:10px;border:1.5px solid #2563EB;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:700;cursor:pointer">🖨 Imprimer</button>
        <button onclick="document.getElementById('fiche-visite-modal').remove()" style="padding:9px 20px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:13px;font-weight:700;cursor:pointer">Fermer</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── BOOT ──────────────────────────────────────
// ── GLOBAL SEARCH (Cmd+K) ────────────────────
let globalSearchQuery = '';

function showGlobalSearch() {
  const existing = document.getElementById('global-search-modal');
  if (existing) { existing.remove(); return; }

  globalSearchQuery = '';
  const modal = document.createElement('div');
  modal.id = 'global-search-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding:80px 16px 16px;backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:20px;width:100%;max-width:620px;box-shadow:0 32px 100px rgba(0,0,0,.5);overflow:hidden;display:flex;flex-direction:column;max-height:75vh">
      <!-- Search input -->
      <div style="display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--border1);flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--text3);flex-shrink:0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="gs-input" type="text" placeholder="Rechercher produit, pharmacie, marque, EAN…"
          style="flex:1;border:none;background:transparent;outline:none;font-size:16px;color:var(--text);font-family:inherit"
          oninput="gsSearch(this.value)" autocomplete="off" spellcheck="false">
        <span style="font-size:10px;color:var(--text3);background:var(--bg2);padding:2px 7px;border-radius:5px;font-family:monospace;flex-shrink:0">ESC</span>
      </div>
      <!-- Results -->
      <div id="gs-results" style="overflow-y:auto;flex:1;padding:8px 8px 12px">
        <div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">Tapez au moins 2 caractères…</div>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function gsEsc(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', gsEsc); }
  });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('gs-input')?.focus(), 50);
}

function gsSearch(q) {
  globalSearchQuery = q.trim();
  const res = document.getElementById('gs-results');
  if (!res) return;
  if (globalSearchQuery.length < 2) {
    res.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">Tapez au moins 2 caractères…</div>`;
    return;
  }
  const ql = globalSearchQuery.toLowerCase();

  // Search OFFILOG
  const offiHits = typeof OFFILOG !== 'undefined'
    ? OFFILOG.filter(p => (p.produit||'').toLowerCase().includes(ql) || (p.marque||'').toLowerCase().includes(ql) || (p.ean||'').includes(ql) || (p.univers||'').toLowerCase().includes(ql)).slice(0, 5)
    : [];

  // Search BENCHMARK
  const benchHits = typeof BENCHMARK !== 'undefined'
    ? BENCHMARK.filter(b => (b.designation||'').toLowerCase().includes(ql) || (b.cip13||'').includes(ql) || (b.categorie||'').toLowerCase().includes(ql)).slice(0, 4)
    : [];

  // Search pharmacies
  const pharmaHits = (state.pharmacies || []).filter(p => p.name.toLowerCase().includes(ql)).slice(0, 4);

  // Search CLIENTS (static data)
  const clientHits = typeof CLIENTS !== 'undefined'
    ? CLIENTS.filter(c => (c.nom||'').toLowerCase().includes(ql) || (c.ville||'').toLowerCase().includes(ql) || (c.cip||'').includes(ql)).slice(0, 3)
    : [];

  const total = offiHits.length + benchHits.length + pharmaHits.length + clientHits.length;
  if (total === 0) {
    res.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text3);font-size:13px">Aucun résultat pour "${globalSearchQuery}"</div>`;
    return;
  }

  const highlight = str => {
    const re = new RegExp(`(${globalSearchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    return (str||'').replace(re, '<mark style="background:#fef08a;color:#713f12;border-radius:2px;padding:0 1px">$1</mark>');
  };

  let html = '';

  if (offiHits.length) {
    const um = u => univMeta(u || 'Non classé');
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:${OFFILOG_ORANGE};text-transform:uppercase;letter-spacing:1px">Catalogue Parapharmacie (${offiHits.length})</div>`;
    html += offiHits.map((p, i) => {
      const m = um(p.univers);
      const idxInData = typeof offiCurrentData !== 'undefined' ? offiCurrentData.indexOf(p) : -1;
      return `<div onclick="document.getElementById('global-search-modal').remove();offiQuery='${p.produit.replace(/'/g,"\\'").replace(/"/g,'&quot;').slice(0,30)}';navigate('offilog');setTimeout(()=>renderOffilog(),100)"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .1s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="width:36px;height:36px;border-radius:8px;background:${m.bg};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${m.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${highlight(p.produit)}</div>
          <div style="font-size:11px;color:var(--text3)">${highlight(p.marque || '—')} · ${p.univers || '—'}${p.prix_live || p.prix_offilog ? ' · ' + fmtP(p.prix_live || p.prix_offilog) : ''}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><path d="m9 18 6-6-6-6"/></svg>
      </div>`;
    }).join('');
  }

  if (benchHits.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Benchmark Ameli (${benchHits.length})</div>`;
    html += benchHits.map(b => `
      <div onclick="document.getElementById('global-search-modal').remove();benchSearch='${(b.designation||'').replace(/'/g,"\\'").slice(0,30)}';navigate('benchmark');setTimeout(()=>renderBenchmark(),100)"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .1s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(0,87,255,.08);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">💊</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${highlight(b.designation)}</div>
          <div style="font-size:11px;color:var(--text3)">${highlight(b.categorie||'—')}${b.cip13 ? ' · ' + highlight(b.cip13) : ''}${b.ip_ca ? ' · ' + fmt(b.ip_ca) : ''}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><path d="m9 18 6-6-6-6"/></svg>
      </div>`).join('');
  }

  if (pharmaHits.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--mint);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Pharmacies avec données (${pharmaHits.length})</div>`;
    html += pharmaHits.map(ph => `
      <div onclick="document.getElementById('global-search-modal').remove();showPharmaDetail('${ph.id}')"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .1s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="width:36px;height:36px;border-radius:8px;background:${ph.color};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0">${ph.name.charAt(0).toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${highlight(ph.name)}</div>
          <div style="font-size:11px;color:var(--text3)">Pharmacie · données importées</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><path d="m9 18 6-6-6-6"/></svg>
      </div>`).join('');
  }

  if (clientHits.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Clients (${clientHits.length})</div>`;
    html += clientHits.map(c => `
      <div onclick="document.getElementById('global-search-modal').remove();navigate('pharmacies')"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .1s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,176,32,.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🏪</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${highlight(c.nom || '—')}</div>
          <div style="font-size:11px;color:var(--text3)">${highlight(c.ville || '—')}${c.cip ? ' · CIP ' + highlight(c.cip) : ''}${c.ca2023 ? ' · ' + fmt(c.ca2023) : ''}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><path d="m9 18 6-6-6-6"/></svg>
      </div>`).join('');
  }

  res.innerHTML = html;
}

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

  // Global Cmd+K / Ctrl+K search shortcut
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      showGlobalSearch();
    }
  });

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
