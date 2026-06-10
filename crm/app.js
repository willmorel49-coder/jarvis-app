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
  currentPage: 'marketing',
  charts: {},
  sim: { pharmacyId: null, name: 'Simulation 1', items: [] },
  // Période active du dashboard ('current' | '3m' | 'ytd' | 'year' | {year, month} pour mois précis)
  dashboardPeriod: 'current',
};

// ── DASHBOARD: helpers période + styles desktop ─────────────────
function setDashboardPeriod(p) {
  state.dashboardPeriod = p;
  if (typeof renderDashboard === 'function') renderDashboard();
}

function __ensureDashboardStyles() {
  if (document.getElementById('dash-desktop-styles')) return;
  const css = `
    /* === Dashboard desktop grid (Wave 4 layout) === */
    .dash-grid-desktop {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--s-6, 24px);
      margin: var(--s-6, 24px) 0;
      align-items: start;
    }
    @media (min-width: 1280px) {
      .dash-grid-desktop {
        grid-template-columns: 1.5fr 1fr;
        align-items: start;
      }
    }
    @media (min-width: 1600px) {
      .dash-grid-desktop {
        grid-template-columns: 1.6fr 1fr;
      }
    }
    .dash-col-main, .dash-col-side {
      display: flex;
      flex-direction: column;
      gap: var(--s-5, 20px);
      min-width: 0;
    }
    .dash-col-main > .card,
    .dash-col-side > .card { margin-bottom: 0 !important; }
    .dash-section-fullwidth { margin-top: var(--s-6, 24px); }
    .dash-section-fullwidth > .card { margin-bottom: var(--s-6, 24px) !important; }

    /* 4 KPI cards égales sur grand écran */
    @media (min-width: 1440px) {
      .kpi-grid.kpi-grid-4 {
        grid-template-columns: repeat(4, 1fr) !important;
      }
    }

    /* Barre période + actions topbar dashboard */
    .dash-period-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      padding: 12px 16px;
      background: var(--bg-elevated, var(--bg, #fff));
      border: 1px solid var(--border1, rgba(0,0,0,.06));
      border-radius: 14px;
      box-shadow: var(--shadow-2, 0 1px 2px rgba(0,0,0,.04));
    }
    .dash-period-bar .dpb-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--label-secondary, var(--text3, #64748B));
      font-weight: 700;
    }
    .dash-period-bar .a-seg {
      display: inline-flex;
      background: var(--fill-1, var(--bg2, rgba(120,120,128,.16)));
      border-radius: 10px;
      padding: 3px;
      gap: 2px;
    }
    .dash-period-bar .a-seg button {
      border: none;
      background: transparent;
      color: var(--text2, #64748B);
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 7px;
      cursor: pointer;
      transition: background .15s, color .15s;
      white-space: nowrap;
    }
    .dash-period-bar .a-seg button:hover { color: var(--text, #111); }
    .dash-period-bar .a-seg button.is-active {
      background: var(--bg, #fff);
      color: var(--blue, #0057FF);
      box-shadow: 0 1px 2px rgba(0,0,0,.08);
    }
    .dash-period-bar .dpb-month {
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid var(--border2, rgba(0,0,0,.08));
      background: var(--bg, #fff);
      color: var(--text, #111);
      font-size: 12px;
      font-family: 'DM Sans', system-ui, sans-serif;
      font-weight: 600;
      cursor: pointer;
    }
    .dash-period-bar .dpb-refresh {
      margin-left: auto;
      font-size: 11px;
      color: var(--label-tertiary, var(--text3, #94A3B8));
      font-family: 'Geist Mono', ui-monospace, monospace;
    }
    .dash-period-bar .dpb-print {
      padding: 7px 14px;
      border-radius: 99px;
      border: 1px solid var(--border2, rgba(0,0,0,.08));
      background: var(--bg, #fff);
      color: var(--text, #111);
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background .15s, border-color .15s;
    }
    .dash-period-bar .dpb-print:hover {
      background: var(--bg2, #f5f5f7);
      border-color: var(--border1, rgba(0,0,0,.12));
    }

    /* Fade-in stagger desktop */
    @media (min-width: 1280px) {
      .dash-col-main > *, .dash-col-side > * {
        animation: dashFadeUp 280ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
      }
      .dash-col-main > *:nth-child(1) { animation-delay: 0ms; }
      .dash-col-main > *:nth-child(2) { animation-delay: 60ms; }
      .dash-col-main > *:nth-child(3) { animation-delay: 120ms; }
      .dash-col-main > *:nth-child(4) { animation-delay: 180ms; }
      .dash-col-side > *:nth-child(1) { animation-delay: 40ms; }
      .dash-col-side > *:nth-child(2) { animation-delay: 100ms; }
      .dash-col-side > *:nth-child(3) { animation-delay: 160ms; }
      .dash-col-side > *:nth-child(4) { animation-delay: 220ms; }
      .dash-col-side > *:nth-child(5) { animation-delay: 280ms; }
    }
    @keyframes dashFadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  const style = document.createElement('style');
  style.id = 'dash-desktop-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

// Filtre les ventes selon state.dashboardPeriod
// Renvoie { salesCur, salesPrev, curY, curM, prevY, prevM, periodLabel, isMulti }
function getDashboardPeriodSlice(allSalesRaw) {
  const detected = getCurrentPeriod(allSalesRaw);
  const curY0 = detected.year, curM0 = detected.month;
  const period = state.dashboardPeriod || 'current';

  // Mode mois précis (objet { year, month })
  if (period && typeof period === 'object' && period.year && period.month) {
    const { year: pY, month: pM } = period;
    const { year: prevY, month: prevM } = getPrevPeriod(pY, pM);
    return {
      curY: pY, curM: pM, prevY, prevM,
      salesCur: getSales({ year: pY, month: pM }),
      salesPrev: prevY ? getSales({ year: prevY, month: prevM }) : [],
      periodLabel: `${monthName(pM)} ${pY}`,
      isMulti: false,
      mode: 'month',
    };
  }

  if (period === 'current') {
    const { year: prevY, month: prevM } = getPrevPeriod(curY0, curM0);
    return {
      curY: curY0, curM: curM0, prevY, prevM,
      salesCur: getSales({ year: curY0, month: curM0 }),
      salesPrev: prevY ? getSales({ year: prevY, month: prevM }) : [],
      periodLabel: `${monthName(curM0)} ${curY0}`,
      isMulti: false,
      mode: 'current',
    };
  }

  // Modes multi-mois (3m / ytd / year)
  let monthsKeep = [];
  if (period === '3m') {
    // 3 derniers mois (incl. courant)
    let y = curY0, m = curM0;
    for (let i = 0; i < 3; i++) {
      monthsKeep.push({ y, m });
      m--; if (m === 0) { m = 12; y--; }
    }
  } else if (period === 'ytd') {
    for (let m = 1; m <= curM0; m++) monthsKeep.push({ y: curY0, m });
  } else if (period === 'year') {
    for (let m = 1; m <= 12; m++) monthsKeep.push({ y: curY0, m });
  }
  const keyset = new Set(monthsKeep.map(x => `${x.y}-${x.m}`));
  const salesCur = allSalesRaw.filter(s => keyset.has(`${s.year}-${s.month}`));
  // Comparaison : même fenêtre l'année précédente
  const salesPrev = allSalesRaw.filter(s => keyset.has(`${s.year + 1}-${s.month}`));
  let periodLabel;
  if (period === '3m') periodLabel = `3 derniers mois`;
  else if (period === 'ytd') periodLabel = `YTD ${curY0}`;
  else periodLabel = `Année ${curY0}`;
  return {
    curY: curY0, curM: curM0,
    prevY: curY0 - 1, prevM: curM0,
    salesCur, salesPrev,
    periodLabel,
    isMulti: true,
    mode: period,
  };
}

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
  state.currentPage = 'marketing';
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

// ════════════════════════════════════════════════════════════════════
// MARGE OFFICIELLE MDL — Marge Dégressive Lissée pharmacie France
// (validée Will 2026-06-09, barème officiel médicaments remboursables)
// 0 — 4,33 €   → 0,18 € fixe par boîte
// 4,33 — 468 € → 3,9 % du prix
// > 468 €      → 19,50 € fixe par boîte
// /!\ S'APPLIQUE UNIQUEMENT AUX PRODUITS REMBOURSÉS.
// Les NR (Non Remboursés) ont une marge libre (PLM) non calculable ici.
// ════════════════════════════════════════════════════════════════════
function calcMargeBoiteMDL(prixNet) {
  if (!(prixNet > 0)) return 0;
  if (prixNet <= 4.33) return 0.18;
  if (prixNet <= 468) return prixNet * 0.039;
  return 19.50;
}

// Caches d'index remboursable / NR (init lazy)
let __mdlRembIdx = null;
let __mdlNrIdx = null;
function _ensureMdlIndexes() {
  if (__mdlRembIdx && __mdlNrIdx) return;
  __mdlRembIdx = new Set();
  __mdlNrIdx = new Set();
  // NR depuis Sagitta SHORTLIST
  if (typeof SAGITTA_SHORTLIST !== 'undefined' && SAGITTA_SHORTLIST.length) {
    SAGITTA_SHORTLIST.forEach(p => {
      const c = String(p.cip13 || p.cip || '');
      if (c) __mdlNrIdx.add(c);
    });
  }
  // Remboursables depuis BENCHMARK
  if (typeof BENCHMARK !== 'undefined' && BENCHMARK.length) {
    BENCHMARK.forEach(b => {
      if (b.has_ameli === true || b.is_remb === true) {
        if (b.cip13)   __mdlRembIdx.add(String(b.cip13));
        if (b.artcode) __mdlRembIdx.add(String(b.artcode));
        if (b.ean)     __mdlRembIdx.add(String(b.ean));
      }
    });
  }
}
function isMdlRemboursable(cip) {
  const c = String(cip || '');
  if (!c) return false;
  _ensureMdlIndexes();
  if (__mdlNrIdx.has(c)) return false; // NR explicite → marge libre
  return __mdlRembIdx.has(c);
}

/**
 * Calcule la marge MDL sur les ventes — uniquement produits remboursables.
 * Retourne { margeTotale, caRembHT, caNrHT, margePct, lignesRemb, lignesNr }
 * margePct = margeTotale / caRembHT × 100 (HT pharmacien)
 */
function sumMargeMDL(sales) {
  let margeTotale = 0;
  let caRembHT = 0;
  let caNrHT = 0;
  let lignesRemb = 0;
  let lignesNr = 0;
  for (const s of sales) {
    const ca = s.mntNetHt || 0;
    if (isMdlRemboursable(s.artCode)) {
      margeTotale += calcMargeBoiteMDL(s.puNet || 0) * (s.qte || 0);
      caRembHT += ca;
      lignesRemb++;
    } else {
      caNrHT += ca;
      lignesNr++;
    }
  }
  return {
    margeTotale,
    caRembHT,
    caNrHT,
    margePct: caRembHT > 0 ? (margeTotale / caRembHT) * 100 : 0,
    lignesRemb,
    lignesNr,
  };
}

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
  __ensureDashboardStyles();
  const allSalesRaw = getSales();

  if (!allSalesRaw.length) {
    document.getElementById('dash-content').innerHTML = `
      <div class="fade-up" style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap">
        <div>
          <div class="section-sub" style="margin-bottom:0">Aucune donnée importée pour le moment</div>
        </div>
      </div>
      <div class="pin-card fade-up" style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:56px 24px;gap:18px">
        <div style="width:72px;height:72px;border-radius:20px;background:var(--blue-lt);display:flex;align-items:center;justify-content:center;color:var(--blue)" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>
        </div>
        <div>
          <div style="font-family:'DM Sans',sans-serif;font-size:20px;font-weight:800;color:var(--text);margin-bottom:6px;letter-spacing:-.4px">Bienvenue sur votre CRM</div>
          <div style="font-size:13px;color:var(--text2);max-width:380px;line-height:1.6">Importez vos fichiers Excel WML / ventes pour découvrir le pilotage de votre réseau de pharmaciens.</div>
        </div>
        <button class="btn btn-primary" onclick="navigate('import')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Importer mes données
        </button>
      </div>`;
    return;
  }

  // ── Périodes clés ────────────────────────────
  // Respecte state.dashboardPeriod ('current' | '3m' | 'ytd' | 'year' | {year,month})
  const __dp = getDashboardPeriodSlice(allSalesRaw);
  const curY = __dp.curY, curM = __dp.curM;
  const prevY = __dp.prevY, prevM = __dp.prevM;
  const salesCur  = __dp.salesCur;
  const salesPrev = __dp.salesPrev;
  const __isMultiPeriod = __dp.isMulti;
  const __periodLabel = __dp.periodLabel;

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
      // Palette progressive Intégral Pharma : gris → bleu clair → bleu → navy
      color: ['#94A3B8', '#3B7AFF', '#0057FF', '#0041CC'][i],
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

  // ── Produits perdus / nouvelles références ───
  const prodLostNew = (() => {
    if (!salesPrev.length || !salesCur.length) return { lost: [], gained: [] };
    const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const prevMap = {};
    for (const s of salesPrev) {
      const k = nn(s.artDesignation);
      if (!k) continue;
      if (!prevMap[k]) prevMap[k] = { label: s.artDesignation, ca: 0 };
      prevMap[k].ca += s.mntNetHt;
    }
    const curMap = {};
    for (const s of salesCur) {
      const k = nn(s.artDesignation);
      if (!k) continue;
      if (!curMap[k]) curMap[k] = { label: s.artDesignation, ca: 0 };
      curMap[k].ca += s.mntNetHt;
    }
    const lost   = Object.entries(prevMap).filter(([k]) => !curMap[k]).map(([, v]) => v).sort((a,b) => b.ca - a.ca).slice(0, 8);
    const gained = Object.entries(curMap).filter(([k]) => !prevMap[k]).map(([, v]) => v).sort((a,b) => b.ca - a.ca).slice(0, 8);
    return { lost, gained };
  })();

  // ── Couverture catalogue IP ──────────────────
  const ipCoverage = (() => {
    if (typeof BENCHMARK === 'undefined' || !salesCur.length) return null;
    const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const soldNorms = new Set(salesCur.map(s => nn(s.artDesignation)));
    const total = BENCHMARK.length;
    const sold  = BENCHMARK.filter(b => soldNorms.has(nn(b.designation))).length;
    const pct   = total > 0 ? sold / total * 100 : 0;
    const missed = BENCHMARK
      .filter(b => b.rot_pharma_jan26 > 0 && !soldNorms.has(nn(b.designation)))
      .sort((a, b) => b.rot_pharma_jan26 - a.rot_pharma_jan26)
      .slice(0, 5);
    const catCov = {};
    for (const b of BENCHMARK) {
      const c = b.categorie || 'mi';
      if (!catCov[c]) catCov[c] = { total: 0, sold: 0 };
      catCov[c].total++;
      if (soldNorms.has(nn(b.designation))) catCov[c].sold++;
    }
    return { total, sold, pct, missed, catCov };
  })();

  // ── Veille concurrentielle parapharmacie ─────
  const veilleConcurrence = (() => {
    if (typeof OFFILOG === 'undefined' || !OFFILOG.length) return null;
    let nDrak = 0, nCap = 0, nLecl = 0, nPharma = 0, nMaxi = 0, nWithData = 0;
    const topItems = [];
    for (const p of OFFILOG) {
      if (p.prix_drakkars  != null && p.prix_drakkars  > 0) nDrak++;
      if (p.prix_cap3000   != null && p.prix_cap3000   > 0) nCap++;
      if (p.prix_leclerc   != null && p.prix_leclerc   > 0) nLecl++;
      if (p.prix_pharmacie != null && p.prix_pharmacie > 0) nPharma++;
      if (p.prix_maxi      != null && p.prix_maxi      > 0) nMaxi++;
      const concMap = [
        p.prix_drakkars  > 0 ? [p.prix_drakkars,  'Drakkars',  '#6366f1'] : null,
        p.prix_cap3000   > 0 ? [p.prix_cap3000,   'Cap3000',   '#ea580c'] : null,
        p.prix_leclerc   > 0 ? [p.prix_leclerc,   'Leclerc',   '#0072e6'] : null,
        p.prix_pharmacie > 0 ? [p.prix_pharmacie, 'Apothical', '#00E5A0'] : null,
        p.prix_maxi      > 0 ? [p.prix_maxi,      'Maxipara',  '#FFB020'] : null,
      ].filter(Boolean);
      if (concMap.length) {
        nWithData++;
        const sorted = concMap.slice().sort((a, b) => a[0] - b[0]);
        topItems.push({ p, concMap: sorted, nSrc: concMap.length });
      }
    }
    const topVeille = topItems.sort((a, b) => b.nSrc - a.nSrc).slice(0, 5);
    // Alertes : concurrent moins cher que le prix achat IP
    const alertItems = [];
    for (const { p, concMap } of topItems) {
      const ip = p.prix_offilog || p.prix_live;
      if (!ip || ip <= 0) continue;
      const below = concMap.filter(([prix]) => prix < ip);
      if (!below.length) continue;
      const minBelow = below.sort((a, b) => a[0] - b[0]);
      alertItems.push({ p, concList: minBelow.map(([prix, src, col]) => [src, prix, col]), ip, gap: ip - minBelow[0][0] });
    }
    alertItems.sort((a, b) => b.gap - a.gap);
    return { nDrak, nCap, nLecl, nPharma, nMaxi, nWithData, topVeille, total: OFFILOG.length, nAlertes: alertItems.length, topAlertes: alertItems.slice(0, 5) };
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

  // ── WML summary for dashboard widget ─────────────────────────────────────
  const wmlDashData = (() => {
    const wmlVis = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
    if (!wmlVis.length) return null;
    const nnW = s => (s||'').trim().toUpperCase().replace(/\s+/g,' ');
    const wmlMap = new Map(wmlVis.map(d => [nnW(d.nom), d]));
    const totWmlCa = wmlVis.reduce((s,d) => s+d.ca, 0);
    const totWmlMg = wmlVis.reduce((s,d) => s+d.mg, 0);
    let totDirect = 0;
    const potRows = [];
    for (const ph of state.pharmacies) {
      const wE = wmlMap.get(nnW(ph.name));
      if (!wE || !wE.ca) continue;
      const wmlAvg = wE.ca / 4;
      const directCa = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
      totDirect += directCa;
      const pot = Math.max(0, wmlAvg - directCa);
      if (pot > 0) potRows.push({ ph, wmlAvg, directCa, pot });
    }
    potRows.sort((a,b) => b.pot - a.pot);
    const convRate = totWmlCa > 0 ? Math.round(totDirect / (totWmlCa/4) * 100) : null;
    return { totWmlCa, totWmlMg, convRate, potRows: potRows.slice(0,3), nPhWml: wmlVis.length };
  })();

  // ── Sections extraites pour réorganisation desktop grid ──
  const __sectionYTD = caYTD > 0 ? `
    <div class="card">
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
    </div>` : '';

  const __sectionSwitch = topSwitchSecteur.length ? `
    <div class="card" style="border-left:3px solid var(--mint)">
      <div class="card-header">
        <div>
          <div class="card-title">🔄 Top opportunités switch — secteur</div>
          <div class="card-subtitle">Produits commandés hors IP — gain immédiat si basculés vers Intégral Pharma</div>
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
    </div>` : '';

  const __sectionCompMM = compRows.length ? `
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
    </div>` : '';

  const __sectionPerdusNouveaux = (prodLostNew.lost.length || prodLostNew.gained.length) ? `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Références perdues &amp; nouvelles ce mois</div>
          <div class="card-subtitle">${prevLabel} → ${curLabel}</div>
        </div>
        <div style="display:flex;gap:8px">
          ${prodLostNew.lost.length ? `<span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(255,77,109,.1);color:var(--rose)">${prodLostNew.lost.length} perdus</span>` : ''}
          ${prodLostNew.gained.length ? `<span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(0,229,160,.1);color:var(--mint)">${prodLostNew.gained.length} nouveaux</span>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--border1)">
        <div style="border-right:1px solid var(--border1)">
          <div style="padding:10px 16px;font-size:11px;font-weight:700;color:var(--rose);text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid var(--border1)">Perdus depuis ${prevLabel}</div>
          ${prodLostNew.lost.length ? prodLostNew.lost.map(p => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border1);gap:8px;cursor:pointer" onclick="showProductBreakdown('${(p.label||'').replace(/'/g,"&#39;")}');">
              <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;cursor:pointer">${p.label}</div>
              <div style="font-size:12px;font-weight:700;color:var(--rose);flex-shrink:0">${fmt(p.ca)}</div>
            </div>`).join('') : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">Aucun produit perdu</div>`}
        </div>
        <div>
          <div style="padding:10px 16px;font-size:11px;font-weight:700;color:var(--mint);text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid var(--border1)">Nouveaux en ${curLabel}</div>
          ${prodLostNew.gained.length ? prodLostNew.gained.map(p => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border1);gap:8px">
              <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${p.label}</div>
              <div style="font-size:12px;font-weight:700;color:var(--mint);flex-shrink:0">${fmt(p.ca)}</div>
            </div>`).join('') : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">Aucune nouvelle référence</div>`}
        </div>
      </div>
    </div>` : '';

  // ── Couverture import (stockée pour insertion dans col side) ──
  const __importCoverageHtml = (() => {
    if (!state.pharmacies.length) return '';
    const imported = new Set(salesCur.map(s => s.pharmacyId));
    const missing = state.pharmacies.filter(ph => !imported.has(ph.id));
    const pct = Math.round((state.pharmacies.length - missing.length) / state.pharmacies.length * 100);
    const barColor = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
    return `<div class="card" style="padding:14px 20px;display:flex;flex-direction:column;gap:12px">
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12px;font-weight:700;color:var(--text2)">Couverture import ${__periodLabel}</span>
          <span style="font-size:14px;font-weight:800;color:${barColor}">${pct}%</span>
        </div>
        <div style="height:6px;border-radius:3px;background:var(--border1);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .5s"></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:5px">${state.pharmacies.length - missing.length}/${state.pharmacies.length} pharmacies importées</div>
      </div>
      ${missing.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${missing.slice(0, 6).map(ph => `<span onclick="showPharmaDetail('${ph.id}')" style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(239,68,68,.08);color:#EF4444;border:1px solid rgba(239,68,68,.2);cursor:pointer;white-space:nowrap" title="Cliquer pour voir la fiche">${ph.name}</span>`).join('')}
        ${missing.length > 6 ? `<span style="font-size:11px;color:var(--text3)">+${missing.length-6} autres</span>` : ''}
        <button onclick="navigate('import')" style="font-size:11px;padding:4px 12px;border-radius:20px;background:var(--bg2);border:1px solid var(--border2);cursor:pointer;color:var(--text2);font-weight:600;white-space:nowrap">↑ Importer</button>
      </div>` : `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mint);font-weight:600"><span style="font-size:16px">✅</span> Toutes importées</div>`}
    </div>`;
  })();

  // ── Barre période globale (segmented control + mois précis + imprimer) ──
  // Construit la liste des mois disponibles (12 derniers) pour le picker
  const __availableMonths = (() => {
    const seen = new Set();
    const out = [];
    for (const s of allSalesRaw) {
      const k = `${s.year}-${s.month}`;
      if (!seen.has(k)) { seen.add(k); out.push({ year: s.year, month: s.month }); }
    }
    out.sort((a, b) => b.year - a.year || b.month - a.month);
    return out.slice(0, 24);
  })();
  const __dpMode = (typeof state.dashboardPeriod === 'object' && state.dashboardPeriod)
    ? 'month'
    : (state.dashboardPeriod || 'current');
  const __dpSelectedMonth = __dpMode === 'month'
    ? `${state.dashboardPeriod.year}-${state.dashboardPeriod.month}`
    : '';
  const __periodBarHtml = `
    <div class="dash-period-bar fade-up">
      <div class="dpb-label">Période</div>
      <div class="a-seg" role="tablist">
        <button class="${__dpMode==='current'?'is-active':''}" onclick="setDashboardPeriod('current')">${monthName(curM)} ${curY}</button>
        <button class="${__dpMode==='3m'?'is-active':''}" onclick="setDashboardPeriod('3m')">3 derniers mois</button>
        <button class="${__dpMode==='ytd'?'is-active':''}" onclick="setDashboardPeriod('ytd')">YTD ${curY}</button>
        <button class="${__dpMode==='year'?'is-active':''}" onclick="setDashboardPeriod('year')">Année ${curY}</button>
      </div>
      ${__availableMonths.length ? `
        <select class="dpb-month" onchange="if(this.value){const [y,m]=this.value.split('-');setDashboardPeriod({year:+y,month:+m});}else{setDashboardPeriod('current');}">
          <option value="">Mois précis…</option>
          ${__availableMonths.map(m => `<option value="${m.year}-${m.month}" ${__dpSelectedMonth===`${m.year}-${m.month}`?'selected':''}>${monthName(m.month)} ${m.year}</option>`).join('')}
        </select>` : ''}
      <button class="dpb-print" onclick="printRapportMensuel()" title="Imprimer le rapport mensuel">
        <span aria-hidden="true" style="margin-right:6px">🖨</span>Imprimer rapport
      </button>
      <div class="dpb-refresh">Données : ${(() => { try { const d = new Date(); return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}); } catch(e) { return ''; } })()}</div>
    </div>`;

  document.getElementById('dash-content').innerHTML = `
    ${__periodBarHtml}

    <!-- Row 1 : 4 KPI cards égales (DA Intégral Pharma) -->
    <div class="kpi-grid kpi-grid-4 fade-up" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">

      <!-- CA réseau — KPI principal -->
      <div class="kpi-card kc-g">
        <div class="kpi-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div class="kpi-value">${fmt(caCur)}</div>
        <div class="kpi-label" style="margin-top:6px">CA réseau · ${__periodLabel}</div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${deltaBadge(caCur, caPrev)}
          <span style="font-size:11px;color:var(--text3)">vs ${__isMultiPeriod ? 'N-1' : prevLabel}</span>
        </div>
      </div>

      <!-- Officines actives -->
      <div class="kpi-card kc-g">
        <div class="kpi-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div class="kpi-value">${nPhCur}</div>
        <div class="kpi-label" style="margin-top:6px">Officines actives</div>
        <div style="margin-top:10px">${deltaBadge(nPhCur, nPhPrev)}</div>
      </div>

      <!-- Panier moyen comptoir -->
      <div class="kpi-card kc-a">
        <div class="kpi-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>
        <div class="kpi-value">${fmt(panierCur)}</div>
        <div class="kpi-label" style="margin-top:6px">Panier moyen / officine</div>
        <div style="margin-top:10px">${deltaBadge(panierCur, panierPrev)}</div>
      </div>

      <!-- Meilleure progression officine -->
      <div class="kpi-card kc-p">
        <div class="kpi-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <div class="kpi-value" style="font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${bestPharmaObj ? bestPharmaObj.name.split(' ').slice(-1)[0] : '—'}
        </div>
        <div class="kpi-label" style="margin-top:6px">Meilleure progression</div>
        <div style="margin-top:10px">
          ${bestPharmaObj && bestGrowth > -Infinity
            ? `<span class="delta-pill ${bestGrowth >= 0 ? 'up' : 'down'}">${bestGrowth >= 0 ? '▲' : '▼'} ${Math.abs(bestGrowth).toFixed(1)}%</span>`
            : '<span class="delta-pill neutral">—</span>'}
        </div>
      </div>
    </div>

    <!-- DÉBUT GRID 2 COLONNES DESKTOP -->
    <div class="dash-grid-desktop">
      <div class="dash-col-main">

        <!-- ▼ MAIN COL CONTENT (Plan du jour, Signaux, YTD, Switch, etc.) ▼ -->

    <!-- Plan du jour -->
    ${(() => {
      const todayPJ = new Date(); todayPJ.setHours(0,0,0,0);
      const parsePJ = str => {
        if (!str || str === 'null' || !str.trim()) return null;
        const s = str.trim();
        let m;
        m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return new Date(+m[3], +m[2]-1, +m[1]);
        m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return new Date(+m[1], +m[2]-1, +m[3]);
        return null;
      };
      const actions = [];
      for (const ph of state.pharmacies) {
        const visitOverride = localStorage.getItem('next_visit_' + ph.id);
        const clientInfo = typeof CLIENTS !== 'undefined' ? CLIENTS.find(c => (c.nom||'').toUpperCase().trim() === ph.name.toUpperCase().trim()) : null;
        const dateStr = visitOverride || clientInfo?.prochaineVisite || null;
        const d = parsePJ(dateStr);
        const caCurPH  = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
        const caPrevPH = sumCA(salesPrev.filter(s => s.pharmacyId === ph.id));
        const gPH = caPrevPH > 0 ? (caCurPH - caPrevPH) / caPrevPH * 100 : null;
        if (d) {
          const diff = Math.round((d - todayPJ) / 86400000);
          if (diff === 0) actions.push({ ph, type: 'today', label: "Visite aujourd'hui", color: 'var(--amber)', priority: 0 });
          else if (diff < 0) actions.push({ ph, type: 'overdue', label: diff === -1 ? 'Retard : hier' : 'Retard J-' + Math.abs(diff), color: 'var(--rose)', priority: 1 });
          else if (diff <= 2) actions.push({ ph, type: 'soon', label: 'Visite dans ' + diff + ' jour' + (diff>1?'s':''), color: 'var(--mint)', priority: 2 });
        }
        if (gPH !== null && gPH <= -20 && !actions.find(a => a.ph.id === ph.id)) {
          actions.push({ ph, type: 'drop', label: 'Baisse ' + gPH.toFixed(0) + '% ce mois', color: 'var(--rose)', priority: 3 });
        }
      }
      actions.sort((a, b) => a.priority - b.priority || b.ph.name.localeCompare(a.ph.name));
      if (!actions.length) return '';
      return '<div class="card fade-up" style="margin-bottom:24px;border-left:3px solid var(--amber)">' +
        '<div class="card-header">' +
          '<div>' +
            '<div class="card-title">\uD83D\uDCC5 Plan du jour</div>' +
            '<div class="card-subtitle">' + actions.length + ' action' + (actions.length>1?'s':'') + ' à mener</div>' +
          '</div>' +
        '</div>' +
        '<div>' +
        actions.slice(0, 8).map((a, i) => {
          const tel = typeof CLIENTS !== 'undefined' ? (CLIENTS.find(c => (c.nom||'').toUpperCase().trim() === a.ph.name.toUpperCase().trim())?.tel || '') : '';
          return '<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;' + (i < actions.slice(0,8).length-1 ? 'border-bottom:1px solid var(--border1);' : '') + '">' +
            '<div style="width:8px;height:8px;border-radius:50%;background:' + a.color + ';flex-shrink:0"></div>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + a.ph.name + '</div>' +
              '<div style="font-size:11px;color:' + a.color + ';font-weight:600">' + a.label + (tel ? ' · ' + tel : '') + '</div>' +
            '</div>' +
            '<button onclick="markVisitDone(\'' + a.ph.id + '\')" style="padding:4px 10px;border-radius:8px;border:none;background:rgba(0,229,160,.15);color:var(--mint);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;margin-right:4px">✅ Visité</button>' +
            '<button onclick="showPharmaDetail(\'' + a.ph.id + '\')" style="padding:4px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:11px;font-weight:600;color:var(--text2);cursor:pointer;white-space:nowrap">Ouvrir ›</button>' +
          '</div>';
        }).join('') +
        '</div></div>';
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

    <!-- (Comp M vs M-1 déplacé en full-width après la grid) -->

        <!-- YTD dans MAIN -->
        ${__sectionYTD}

        <!-- Switch dans MAIN -->
        ${__sectionSwitch}

      </div>
      <!-- ▲ FIN dash-col-main ▲ -->

      <div class="dash-col-side">

        <!-- Couverture import (priorité haute side col) -->
        ${__importCoverageHtml}

    <!-- Row 2b-wml : WML Summary -->
    ${wmlDashData ? `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">📦 Achats IP via WML — Jan–Avr 2026</div>
          <div class="card-subtitle">${wmlDashData.nPhWml} pharmacie${wmlDashData.nPhWml>1?'s':''} OPSO Santé · Taux de conversion direct</div>
        </div>
        <button onclick="pharmaSort='wml';navigate('pharmacies')" style="padding:6px 14px;border-radius:10px;border:1px solid var(--border2);background:transparent;font-size:12px;color:var(--text3);cursor:pointer;font-weight:600">Trier par potentiel →</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-top:1px solid var(--border)">
        <div style="padding:16px 20px;border-right:1px solid var(--border);text-align:center">
          <div style="font-size:22px;font-weight:900;color:#14B86A">${fmt(wmlDashData.totWmlCa)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">CA total acheté via WML</div>
        </div>
        <div style="padding:16px 20px;border-right:1px solid var(--border);text-align:center">
          <div style="font-size:22px;font-weight:900;color:var(--mint)">${fmt(wmlDashData.totWmlMg)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Remise obtenue</div>
        </div>
        <div style="padding:16px 20px;text-align:center">
          <div style="font-size:22px;font-weight:900;color:${wmlDashData.convRate !== null ? (wmlDashData.convRate >= 80 ? 'var(--mint)' : wmlDashData.convRate >= 50 ? 'var(--amber)' : 'var(--rose)') : 'var(--text3)'}">${wmlDashData.convRate !== null ? wmlDashData.convRate + '%' : '—'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Conversion CA direct / WML</div>
        </div>
      </div>
      ${wmlDashData.potRows.length ? `
      <div style="padding:0 0 8px">
        <div style="padding:10px 20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3)">Top opportunités de conversion</div>
        ${wmlDashData.potRows.map(r => {
          const pct = Math.min(100, Math.round(r.directCa / r.wmlAvg * 100));
          return `<div style="display:flex;align-items:center;gap:12px;padding:8px 20px;border-top:1px solid var(--border)">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
                <span style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.ph.name}</span>
                <span style="font-size:11px;color:var(--amber);font-weight:700;flex-shrink:0;margin-left:8px">+${fmt(r.pot)}</span>
              </div>
              <div style="height:4px;background:var(--bg3);border-radius:2px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:#14B86A;border-radius:2px"></div>
              </div>
              <div style="font-size:10px;color:var(--text3);margin-top:3px">Direct ${fmt(r.directCa)} · WML moy. ${fmt(r.wmlAvg)} · ${pct}%</div>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}
    </div>` : ''}

    <!-- (YTD déplacé dans dash-col-main) -->

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

    <!-- (Switch déplacé dans dash-col-main) -->

    <!-- (Perdus/Nouveaux déplacé en full-width après la grid) -->

    <!-- Row 2f : Couverture catalogue IP -->
    ${ipCoverage ? `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Couverture catalogue IP — ${curLabel}</div>
          <div class="card-subtitle">Produits du catalogue national vendus ce mois</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:24px;font-weight:900;color:var(--blue)">${ipCoverage.pct.toFixed(1)}%</div>
          <div style="font-size:11px;color:var(--text3)">${fmtNum(ipCoverage.sold)} / ${fmtNum(ipCoverage.total)} références</div>
        </div>
      </div>
      <div style="padding:0 20px 16px">
        <div style="height:8px;border-radius:4px;background:var(--border1);overflow:hidden;margin-bottom:16px">
          <div style="height:100%;width:${Math.min(ipCoverage.pct, 100).toFixed(1)}%;background:var(--blue);border-radius:4px"></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          ${Object.entries(ipCoverage.catCov).filter(([, v]) => v.total > 0).map(([cat, v]) => {
            const ci = CATS[cat] || CATS.mi;
            const p = (v.sold / v.total * 100).toFixed(0);
            return `<div style="flex:1;min-width:80px;background:var(--bg2);border-radius:10px;padding:8px 12px;text-align:center">
              <div style="font-size:11px;color:${ci.color};font-weight:700">${ci.icon} ${ci.label}</div>
              <div style="font-size:17px;font-weight:800;color:var(--text)">${p}%</div>
              <div style="font-size:10px;color:var(--text3)">${v.sold}/${v.total}</div>
            </div>`;
          }).join('')}
        </div>
        ${ipCoverage.missed.length ? `
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Top opportunités manquantes</div>
        ${ipCoverage.missed.map((b, i) => {
          const cat = CATS[b.categorie] || CATS.mi;
          return `<div style="display:flex;align-items:center;gap:12px;padding:6px 0;${i < ipCoverage.missed.length - 1 ? 'border-bottom:1px solid var(--border1)' : ''}">
            <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${cat.color}18;color:${cat.color};font-weight:700;flex-shrink:0">${cat.icon}</span>
            <div style="flex:1;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.designation}</div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:12px;font-weight:700;color:var(--amber)">${b.rot_pharma_jan26.toFixed(1)}<span style="font-size:10px;color:var(--text3)"> rot.</span></div>
              <div style="font-size:11px;color:var(--text3)">${fmt(b.prix_ip)}</div>
            </div>
          </div>`;
        }).join('')}` : ''}
      </div>
    </div>` : ''}

    <!-- Row 2g : Veille prix parapharmacie -->
    ${veilleConcurrence ? `
    <div class="card fade-up" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Veille prix · Parapharmacie</div>
          <div class="card-subtitle">Prix de vente concurrents · ${fmtNum(veilleConcurrence.nWithData)} références couvertes sur ${fmtNum(veilleConcurrence.total)}</div>
        </div>
        <button onclick="navigate('offilog')" style="font-size:12px;padding:6px 14px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-weight:600">Voir catalogue →</button>
      </div>
      <div style="padding:0 20px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <div style="flex:1;min-width:80px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:10px 14px;text-align:center">
            <div style="font-size:18px;font-weight:900;color:#6366f1">${fmtNum(veilleConcurrence.nDrak)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Drakkars</div>
          </div>
          <div style="flex:1;min-width:80px;background:rgba(234,88,12,.06);border:1px solid rgba(234,88,12,.2);border-radius:10px;padding:10px 14px;text-align:center">
            <div style="font-size:18px;font-weight:900;color:#ea580c">${fmtNum(veilleConcurrence.nCap)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Cap3000</div>
          </div>
          <div style="flex:1;min-width:80px;background:rgba(0,114,230,.06);border:1px solid rgba(0,114,230,.2);border-radius:10px;padding:10px 14px;text-align:center">
            <div style="font-size:18px;font-weight:900;color:#0072e6">${fmtNum(veilleConcurrence.nLecl)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">E.Leclerc</div>
          </div>
          <div style="flex:1;min-width:80px;background:rgba(0,229,160,.06);border:1px solid rgba(0,229,160,.2);border-radius:10px;padding:10px 14px;text-align:center">
            <div style="font-size:18px;font-weight:900;color:var(--mint)">${fmtNum(veilleConcurrence.nPharma)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Apothical</div>
          </div>
          <div style="flex:1;min-width:80px;background:rgba(255,176,32,.06);border:1px solid rgba(255,176,32,.2);border-radius:10px;padding:10px 14px;text-align:center">
            <div style="font-size:18px;font-weight:900;color:#FFB020">${fmtNum(veilleConcurrence.nMaxi)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Maxipara</div>
          </div>
        </div>
        ${veilleConcurrence.topVeille.length ? `
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:8px">Exemples de prix concurrents</div>
        ${veilleConcurrence.topVeille.map((item, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;${i < veilleConcurrence.topVeille.length-1?'border-bottom:1px solid var(--border1)':''}">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.p.produit}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">
              ${item.concMap.map(([prix, src, col]) => `<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${col}18;color:${col};font-weight:600">${src} ${fmtP(prix)}</span>`).join('')}
            </div>
          </div>
          ${item.p.prix_offilog ? `<div style="font-size:11px;color:var(--text3);white-space:nowrap">Achat IP ${fmtP(item.p.prix_offilog)}</div>` : ''}
        </div>`).join('')}` : ''}
      </div>
    </div>` : ''}

    <!-- Alertes prix concurrents -->
    ${veilleConcurrence && veilleConcurrence.nAlertes > 0 ? `
    <div class="card fade-up" style="margin-bottom:24px;border-left:3px solid #DC2626">
      <div class="card-header">
        <div>
          <div class="card-title">🚨 Alertes prix concurrents</div>
          <div class="card-subtitle">Produits Offilog vendus moins cher par des concurrents que votre prix d'achat — ${veilleConcurrence.nAlertes} référence${veilleConcurrence.nAlertes>1?'s':''}</div>
        </div>
        <button onclick="offiSetRole('alerte_conc');navigate('offilog')" style="font-size:11px;padding:5px 12px;border-radius:8px;border:1px solid rgba(220,38,38,.3);background:rgba(220,38,38,.08);color:#DC2626;cursor:pointer;font-weight:600;white-space:nowrap">Voir tous →</button>
      </div>
      <div>
        ${veilleConcurrence.topAlertes.map((a, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;${i < veilleConcurrence.topAlertes.length-1?'border-bottom:1px solid var(--border1)':''}">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.p.produit}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">
              ${a.concList.map(([src, prix, col]) => `<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${col}18;color:${col};font-weight:700">${src} ${fmtP(prix)}</span>`).join('')}
              <span style="font-size:10px;color:var(--text3);padding:1px 6px;border-radius:6px;background:var(--bg3)">Achat IP ${fmtP(a.ip)}</span>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:14px;font-weight:900;color:#DC2626">-${fmtP(a.gap)}</div>
            <div style="font-size:10px;color:var(--text3)">écart</div>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}

      </div>
      <!-- ▲ FIN dash-col-side ▲ -->
    </div>
    <!-- ▲ FIN dash-grid-desktop ▲ -->

    <!-- Comparaison M vs M-1 — full-width -->
    ${__sectionCompMM ? `<div class="dash-section-fullwidth">${__sectionCompMM}</div>` : ''}

    <!-- Perdus / Nouveaux — full-width -->
    ${__sectionPerdusNouveaux ? `<div class="dash-section-fullwidth">${__sectionPerdusNouveaux}</div>` : ''}

    <!-- Offres IP en cours -->
    ${(() => {
      if (typeof BENCHMARK === 'undefined') return '';
      const offres = BENCHMARK
        .filter(b => b.offre_ip > 0)
        .sort((a, b) => (b.ip_ca || 0) - (a.ip_ca || 0))
        .slice(0, 6);
      if (!offres.length) return '';
      const rows = offres.map((b, i) => {
        const remiseTxt = b.remise_pct > 0 ? '-' + b.remise_pct.toFixed(0) + '%' : '';
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;${i < offres.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(b.designation || '').length > 55 ? b.designation.slice(0, 55) + '…' : b.designation}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">
              <span style="font-size:10px;color:var(--text3);padding:1px 6px;border-radius:6px;background:var(--bg3)">${b.categorie || '—'}</span>
              ${b.prix_ip > 0 ? `<span style="font-size:10px;color:var(--text3);padding:1px 6px;border-radius:6px;background:var(--bg3);text-decoration:line-through">${fmtP(b.prix_ip)}</span>` : ''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:15px;font-weight:900;color:var(--amber)">${fmtP(b.offre_ip)}</div>
            ${remiseTxt ? `<div style="font-size:10px;background:rgba(255,176,32,.1);color:var(--amber);border-radius:6px;padding:1px 6px;font-weight:700">${remiseTxt}</div>` : ''}
          </div>
        </div>`;
      }).join('');
      return `<div class="card fade-up" style="margin-bottom:24px;border-left:3px solid var(--amber)">
        <div class="card-header">
          <div>
            <div class="card-title">🎁 Offres IP en cours</div>
            <div class="card-subtitle">${offres.length} produit${offres.length > 1 ? 's' : ''} avec remise Intégral Pharma — à mettre en avant</div>
          </div>
          <button onclick="catCatFilter='offres';catPageNum=1;navigate('catalogue')" style="font-size:11px;padding:5px 12px;border-radius:8px;border:1px solid rgba(255,176,32,.3);background:rgba(255,176,32,.08);color:var(--amber);cursor:pointer;font-weight:600;white-space:nowrap">Voir catalogue →</button>
        </div>
        ${rows}
      </div>`;
    })()}

    <!-- Row 2c : Journal des visites -->
    ${(() => {
      const allNotes = [];
      for (const ph of state.pharmacies) {
        let notes = [];
        try { notes = JSON.parse(localStorage.getItem('visit_notes_' + ph.id) || '[]'); } catch {}
        for (const n of notes) {
          if (n.id && n.text) allNotes.push({ ph, id: n.id, date: n.date, text: n.text });
        }
      }
      allNotes.sort((a, b) => b.id - a.id);
      const recent = allNotes.slice(0, 6);
      if (!recent.length) return '';
      const rows = recent.map(n => {
        const daysAgo = Math.round((Date.now() - n.id) / 86400000);
        const dayLabel = daysAgo === 0 ? "Auj." : daysAgo === 1 ? 'Hier' : 'J-' + daysAgo;
        const txt = n.text.length > 90 ? n.text.slice(0, 90) + '…' : n.text;
        return '<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 20px;border-bottom:1px solid var(--border)">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' + n.ph.color + ';flex-shrink:0;margin-top:5px"></div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">' +
              '<span style="font-size:12px;font-weight:700">' + n.ph.name + '</span>' +
              '<span style="font-size:10px;color:var(--text3);background:var(--bg3);padding:1px 7px;border-radius:6px">' + dayLabel + '</span>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + txt + '</div>' +
          '</div>' +
          '<button onclick="showPharmaDetail(\'' + n.ph.id + '\')" style="padding:3px 9px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:10px;font-weight:600;color:var(--text2);cursor:pointer;flex-shrink:0">Ouvrir ›</button>' +
        '</div>';
      }).join('');
      return '<div class="card fade-up" style="margin-bottom:24px">' +
        '<div class="card-header">' +
          '<div>' +
            '<div class="card-title">🗒️ Journal des visites</div>' +
            '<div class="card-subtitle">Dernières notes saisies — toutes pharmacies</div>' +
          '</div>' +
        '</div>' +
        rows +
      '</div>';
    })()}

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

    <!-- Row 5 : Stacked par pharmacie -->
    ${state.pharmacies.length > 1 ? `
    <div class="card fade-up" style="margin-top:24px;border-radius:var(--r)">
      <div class="card-header" style="padding:20px 24px 16px">
        <div>
          <div class="card-title">Contribution par pharmacie sur l'année</div>
          <div class="card-subtitle">CA mensuel empilé — toutes périodes importées</div>
        </div>
      </div>
      <div class="card-body">
        <div class="chart-wrap" style="height:260px"><canvas id="chart-stacked"></canvas></div>
      </div>
    </div>` : ''}

    <!-- Row 6 : Tableau familles de produits M vs M-1 -->
    ${catRows.length ? `
    <div class="card fade-up" style="margin-top:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Familles de produits — ${curLabel}</div>
          <div class="card-subtitle">CA et évolution M vs M-1 par catégorie</div>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid var(--border2)">
              <th style="padding:10px 16px;text-align:left;font-family:'Syne',sans-serif;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Famille</th>
              <th style="padding:10px 12px;text-align:right;font-family:'Syne',sans-serif;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">${prevLabel}</th>
              <th style="padding:10px 12px;text-align:right;font-family:'Syne',sans-serif;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">${curLabel}</th>
              <th style="padding:10px 12px;text-align:right;font-family:'Syne',sans-serif;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Évol.</th>
              <th style="padding:10px 12px;text-align:right;font-family:'Syne',sans-serif;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">% du CA</th>
              <th style="padding:10px 12px;text-align:right;font-family:'Syne',sans-serif;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Réf.</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const totalCur = sumCA(salesCur);
              const catPrev = byCategory(salesPrev);
              return catRows.map(c => {
                const prevData = catPrev[c.key] || { ca: 0, nb: 0 };
                const pct = totalCur > 0 ? c.ca / totalCur * 100 : 0;
                return `<tr style="border-bottom:1px solid var(--border1)">
                  <td style="padding:10px 16px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-size:15px">${c.icon}</span>
                      <span style="font-size:13px;font-weight:700;color:${c.color}">${c.label}</span>
                    </div>
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-size:12px;color:var(--text3)">${prevData.ca > 0 ? fmt(prevData.ca) : '—'}</td>
                  <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700">${fmt(c.ca)}</td>
                  <td style="padding:10px 12px;text-align:right">${prevData.ca > 0 ? deltaBadge(c.ca, prevData.ca) : '<span style="color:var(--text4);font-size:11px">—</span>'}</td>
                  <td style="padding:10px 12px;text-align:right">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
                      <div style="width:48px;height:5px;border-radius:3px;background:var(--border1);overflow:hidden"><div style="height:100%;width:${pct.toFixed(0)}%;background:${c.color};border-radius:3px"></div></div>
                      <span style="font-size:12px;font-weight:600;color:${c.color};min-width:36px;text-align:right">${pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-size:12px;color:var(--text2);font-weight:600">${c.nb}</td>
                </tr>`;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- Prochaines visites -->
    ${(() => {
      if (typeof CLIENTS === 'undefined' || !CLIENTS.length) return '';
      const todayV = new Date(); todayV.setHours(0,0,0,0);
      const parseV = str => {
        if (!str || str === 'null' || str.trim() === '') return null;
        const s = str.trim();
        let m;
        m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return new Date(+m[3], +m[2]-1, +m[1]);
        m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return new Date(+m[1], +m[2]-1, +m[3]);
        return null;
      };
      const moV = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
      const dateShortV = d => String(d.getDate()).padStart(2,'0') + ' ' + moV[d.getMonth()];
      const upcoming = CLIENTS
        .map(c => ({ c, date: parseV(c.prochaineVisite) }))
        .filter(x => x.date !== null && x.date >= todayV)
        .sort((a, b) => a.date - b.date)
        .slice(0, 5);
      if (!upcoming.length) return '';
      const pharmaMap = new Map(state.pharmacies.map(p => [p.name.toUpperCase().trim(), p]));
      const rows = upcoming.map(({ c, date }) => {
        const ph = pharmaMap.get((c.nom||'').toUpperCase().trim());
        const diff = Math.round((date - todayV) / 86400000);
        const urgBg = diff === 0 ? 'rgba(255,176,32,.15)' : diff <= 7 ? 'rgba(0,229,160,.08)' : 'var(--bg)';
        const urgCol = diff === 0 ? 'var(--amber)' : diff <= 7 ? 'var(--mint)' : 'var(--text3)';
        const urgLabel = diff === 0 ? "Aujourd'hui" : diff === 1 ? 'Demain' : diff <= 7 ? 'J+' + diff : dateShortV(date);
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border1);cursor:pointer" onclick="${ph ? `showPharmaDetail('${ph.id}')` : `navigate('pharmacies')`}">
          <div style="min-width:64px;padding:3px 8px;border-radius:8px;background:${urgBg};text-align:center;font-size:11px;font-weight:700;color:${urgCol}">${urgLabel}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nom||'—'}</div>
            <div style="font-size:11px;color:var(--text3)">${c.cp||''} ${c.ville||''}</div>
          </div>
          ${ph ? `<div style="width:8px;height:8px;border-radius:50%;background:${ph.color};flex-shrink:0"></div>` : ''}
        </div>`;
      }).join('');
      return `<div class="card fade-up" style="margin-top:24px">
        <div class="card-header">
          <div>
            <div class="card-title">Prochaines visites</div>
            <div class="card-subtitle">${upcoming.length} visite${upcoming.length>1?'s':''} planifiée${upcoming.length>1?'s':''}</div>
          </div>
          <button onclick="navigate('pharmacies')" style="font-size:12px;color:var(--blue);background:none;border:none;cursor:pointer;font-weight:700">Tout voir →</button>
        </div>
        ${rows}
      </div>`;
    })()}

    <!-- Visites en retard -->
    ${(() => {
      if (typeof CLIENTS === 'undefined' || !CLIENTS.length) return '';
      const todayOD = new Date(); todayOD.setHours(0,0,0,0);
      const parseOD = str => {
        if (!str || str === 'null' || str.trim() === '') return null;
        const s = str.trim(); let m;
        m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return new Date(+m[3], +m[2]-1, +m[1]);
        m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return new Date(+m[1], +m[2]-1, +m[3]);
        return null;
      };
      const moOD = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
      const dateShortOD = d => String(d.getDate()).padStart(2,'0') + ' ' + moOD[d.getMonth()];
      const overdue = CLIENTS
        .map(c => ({ c, date: parseOD(c.prochaineVisite) }))
        .filter(x => x.date !== null && x.date < todayOD)
        .sort((a, b) => a.date - b.date)
        .slice(0, 5);
      if (!overdue.length) return '';
      const pharmaMapOD = new Map(state.pharmacies.map(p => [p.name.toUpperCase().trim(), p]));
      const rowsOD = overdue.map(({ c, date }) => {
        const phOD = pharmaMapOD.get((c.nom||'').toUpperCase().trim());
        const daysLate = Math.round((todayOD - date) / 86400000);
        const label = daysLate === 1 ? 'Hier' : daysLate <= 7 ? 'J-' + daysLate : dateShortOD(date);
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border1);cursor:pointer" onclick="${phOD ? `showPharmaDetail('${phOD.id}')` : `navigate('pharmacies');setTimeout(()=>{pharmaFilter='visite_retard';renderPharmacies();},80)`}">
          <div style="min-width:64px;padding:3px 8px;border-radius:8px;background:rgba(255,77,109,.1);text-align:center;font-size:11px;font-weight:700;color:var(--rose)">${label}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nom||'—'}</div>
            <div style="font-size:11px;color:var(--text3)">${c.cp||''} ${c.ville||''}</div>
          </div>
          ${phOD ? `<div style="width:8px;height:8px;border-radius:50%;background:${phOD.color};flex-shrink:0"></div>` : ''}
        </div>`;
      }).join('');
      return `<div class="card fade-up" style="margin-top:24px;border:1px solid rgba(255,77,109,.2)">
        <div class="card-header">
          <div>
            <div class="card-title" style="color:var(--rose)">⚠ Visites en retard</div>
            <div class="card-subtitle">${overdue.length} pharmacie${overdue.length>1?'s':''} à rappeler</div>
          </div>
          <button onclick="navigate('pharmacies');setTimeout(()=>{pharmaFilter='visite_retard';renderPharmacies();},80)" style="font-size:12px;color:var(--rose);background:none;border:none;cursor:pointer;font-weight:700">Voir toutes →</button>
        </div>
        ${rowsOD}
      </div>`;
    })()}
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
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#fff',
                borderColor: '#14B86A',
                borderWidth: 1,
                titleColor: '#1f2937',
                bodyColor: '#1f2937',
                padding: 10,
                callbacks: { label: c => ' ' + fmt(c.parsed.x) }
              }
            },
            scales: {
              x: { grid: { color: 'rgba(20,184,106,.08)' }, ticks: { color: '#64748B', font: { size: 11 }, callback: v => fmt(v) } },
              y: { grid: { display: false }, ticks: { color: '#1f2937', font: { size: 12, weight: '600' } } },
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
              tooltip: {
                backgroundColor: '#fff',
                borderColor: '#14B86A',
                borderWidth: 1,
                titleColor: '#1f2937',
                bodyColor: '#1f2937',
                padding: 10,
                callbacks: { label: c => ` ${fmt(c.parsed)} (${totalCA > 0 ? (c.parsed / totalCA * 100).toFixed(1) : 0}%)` }
              },
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
              borderColor: '#14B86A',
              backgroundColor: 'rgba(20,184,106,0.12)',
              borderWidth: 2.5,
              pointRadius: 5,
              pointBackgroundColor: '#14B86A',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              tension: 0.3,
              fill: true,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#fff',
                borderColor: '#14B86A',
                borderWidth: 1,
                titleColor: '#1f2937',
                bodyColor: '#1f2937',
                padding: 10,
                callbacks: { label: c => ' ' + fmt(c.parsed.y) }
              },
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 11 } } },
              y: { grid: { color: 'rgba(20,184,106,.08)' }, ticks: { color: '#64748B', font: { size: 11 }, callback: v => fmt(v) } },
            }
          }
        });
      }
    }

    // Stacked bar chart — par pharmacie par mois
    if (state.pharmacies.length > 1) {
      const ctxSt = document.getElementById('chart-stacked');
      if (ctxSt) {
        if (state.charts['stacked']) state.charts['stacked'].destroy();
        // Collect all months
        const allMonths = [...new Set(allSalesRaw.map(s => `${s.year}-${String(s.month).padStart(2,'0')}`))]
          .sort().slice(-12);
        const labels = allMonths.map(k => {
          const [y, m] = k.split('-');
          return monthName(+m) + ' ' + y.slice(2);
        });
        const datasets = state.pharmacies.map(ph => ({
          label: ph.name,
          data: allMonths.map(k => {
            const [y, m] = k.split('-');
            const s = getSales({ pharmacyId: ph.id, year: +y, month: +m });
            return +sumCA(s).toFixed(2);
          }),
          backgroundColor: ph.color + 'CC',
          borderColor: ph.color,
          borderWidth: 1,
          borderRadius: 3,
        }));
        state.charts['stacked'] = new Chart(ctxSt, {
          type: 'bar',
          data: { labels, datasets },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: '#64748B', font: { size: 11 }, boxWidth: 12, padding: 10 } },
              tooltip: {
                mode: 'index',
                backgroundColor: '#fff',
                borderColor: '#14B86A',
                borderWidth: 1,
                titleColor: '#1f2937',
                bodyColor: '#1f2937',
                padding: 10,
                callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y)}` }
              },
            },
            scales: {
              x: { stacked: true, grid: { display: false }, ticks: { color: '#64748B', font: { size: 10 } } },
              y: { stacked: true, grid: { color: 'rgba(20,184,106,.08)' }, ticks: { color: '#64748B', font: { size: 11 }, callback: v => fmt(v) } },
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
let pharmaFilter  = 'all'; // 'all' | 'up' | 'flat' | 'down' | 'visite_retard' | 'visite_semaine' | 'visite_aucune'


function markVisitDone(pharmacyId) {
  document.getElementById('mark-visit-modal')?.remove();
  const ph = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!ph) return;
  const modal = document.createElement('div');
  modal.id = 'mark-visit-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:16px;padding:22px;width:100%;max-width:380px;box-shadow:0 24px 64px rgba(0,0,0,.4)">
      <div style="font-size:14px;font-weight:800;margin-bottom:3px">✅ Visite — ${ph.name}</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:14px">${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long'})}</div>
      <textarea id="mv-note" placeholder="Note de visite (optionnelle)…" rows="3"
        style="width:100%;padding:10px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);color:var(--text);font-size:13px;font-family:inherit;resize:vertical;box-sizing:border-box;margin-bottom:12px;outline:none"></textarea>
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Prochaine visite</div>
      <div id="mv-paliers" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">
        ${[['1 semaine',7],['2 semaines',14],['1 mois',30],['6 semaines',42]].map(([lbl,days]) => {
          const d = new Date(); d.setDate(d.getDate() + days);
          const iso = d.toISOString().slice(0,10);
          return '<button onclick="document.querySelectorAll(\'#mv-paliers button\').forEach(b=>b.style.background=\'var(--bg2)\');this.style.background=\'rgba(0,87,255,.15)\';document.getElementById(\'mv-nv-date\').value=\'' + iso + '\'" style="padding:7px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);color:var(--text2);font-size:12px;font-weight:600;cursor:pointer">' + lbl + '</button>';
        }).join('')}
      </div>
      <input id="mv-nv-date" type="date" placeholder="Ou date personnalisée"
        style="width:100%;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);color:var(--text);font-size:13px;font-family:inherit;box-sizing:border-box;margin-bottom:14px;outline:none">
      <div style="display:flex;gap:8px">
        <button onclick="
          const note = document.getElementById('mv-note').value.trim();
          const nv = document.getElementById('mv-nv-date').value;
          if (note) {
            const key = 'visit_notes_' + '${pharmacyId}';
            let notes; try { notes = JSON.parse(localStorage.getItem(key) || '[]'); } catch { notes = []; }
            notes.unshift({ id: Date.now(), date: new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}), text: note });
            localStorage.setItem(key, JSON.stringify(notes.slice(0,50)));
          }
          if (nv) setNextVisit('${pharmacyId}', nv);
          document.getElementById('mark-visit-modal').remove();
          renderDashboard();
          showToast('Visite enregistrée ✓', 'success');
        " style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--blue);color:#fff;font-size:13px;font-weight:700;cursor:pointer">Enregistrer</button>
        <button onclick="document.getElementById('mark-visit-modal').remove()" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:13px;cursor:pointer">✕</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function mvEsc(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', mvEsc); } });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('mv-note')?.focus(), 50);
}

function showNextVisitPicker(pharmacyId) {
  document.getElementById('next-visit-picker-modal')?.remove();
  const ph = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!ph) return;
  const existing = localStorage.getItem('next_visit_' + pharmacyId);
  let isoVal = '';
  if (existing) {
    const m = existing.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) isoVal = m[3] + '-' + m[2] + '-' + m[1];
    else if (/^\d{4}-\d{2}-\d{2}$/.test(existing)) isoVal = existing;
  }
  const modal = document.createElement('div');
  modal.id = 'next-visit-picker-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:16px;padding:24px;width:100%;max-width:340px;box-shadow:0 24px 64px rgba(0,0,0,.4)">
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">📅 Prochaine visite</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px">${ph.name}</div>
      <input id="nv-date-input" type="date" value="${isoVal}"
        style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);color:var(--text);font-size:14px;font-family:inherit;box-sizing:border-box;margin-bottom:14px;outline:none">
      <div style="display:flex;gap:8px">
        <button onclick="const v=document.getElementById('nv-date-input').value;if(v){setNextVisit('${pharmacyId}',v);document.getElementById('next-visit-picker-modal').remove();}" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--blue);color:#fff;font-size:13px;font-weight:700;cursor:pointer">Planifier</button>
        <button onclick="setNextVisit('${pharmacyId}','');document.getElementById('next-visit-picker-modal').remove();" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border2);background:transparent;color:var(--rose);font-size:13px;font-weight:600;cursor:pointer">Effacer</button>
        <button onclick="document.getElementById('next-visit-picker-modal').remove()" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:13px;cursor:pointer">✕</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function nvEsc(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', nvEsc); } });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('nv-date-input')?.focus(), 50);
}

function setNextVisit(pharmacyId, dateStr) {
  if (dateStr) localStorage.setItem(`next_visit_${pharmacyId}`, dateStr);
  else localStorage.removeItem(`next_visit_${pharmacyId}`);
  renderPharmacies();
  showToast(dateStr ? `Visite planifiée : ${dateStr}` : 'Date de visite effacée', 'success');
}

let pharmaSort    = 'ca';  // 'ca' | 'delta' | 'name' | 'wml'
let pharmaDetailOverridePeriod = null; // {year, month} or null → use auto-detected

function renderPharmacies() {
  const allSalesRaw = getSales();
  const { year: curY, month: curM } = getCurrentPeriod(allSalesRaw);
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);

  const salesCur  = curY  ? getSales({ year: curY,  month: curM  }) : [];
  const salesPrev = prevY ? getSales({ year: prevY, month: prevM }) : [];

  // WML map pour badge et tri
  const wmlVisCRM = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
  const wmlNnMapCRM = new Map(wmlVisCRM.map(d => [(d.nom||'').trim().toUpperCase().replace(/\s+/g,' '), d]));

  // Construire liste enrichie de toutes les pharmacies avec CA + marge MDL + opp
  const today = new Date(); today.setHours(0,0,0,0);
  let enriched = state.pharmacies.map(ph => {
    const salesCurPh = salesCur.filter(s => s.pharmacyId === ph.id);
    const allPhSales = getSales({ pharmacyId: ph.id });
    const caCur  = sumCA(salesCurPh);
    const caPrev = sumCA(salesPrev.filter(s => s.pharmacyId === ph.id));
    // Marge MDL : sur période courante (rapide)
    const mdl = sumMargeMDL(salesCurPh);
    // Nb produits commandés total (toutes périodes) + nb opportunités estimées
    const cipsOrdered = new Set(allPhSales.map(s => String(s.artCode || '')).filter(c => c.length >= 7));
    const nProdOrdered = cipsOrdered.size;
    const g      = caPrev > 0 ? (caCur - caPrev) / caPrev * 100 : null;
    const status = g === null ? 'new' : g > 20 ? 'up' : g >= -5 ? 'flat' : 'down';
    // Last import date
    const phImports = state.imports.filter(i => i.pharmacyId === ph.id);
    const lastImport = phImports.length
      ? phImports.reduce((a, b) => new Date(a.importedAt) > new Date(b.importedAt) ? a : b)
      : null;
    const lastImportDays = lastImport ? Math.round((today - new Date(lastImport.importedAt)) / 86400000) : null;
    const clientInfo = typeof CLIENTS !== 'undefined'
      ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === ph.name.toUpperCase().trim())
      : null;
    // Check localStorage override first, then fall back to CLIENTS data
    const visitOverride = localStorage.getItem(`next_visit_${ph.id}`);
    const prochaineVisite = visitOverride || clientInfo?.prochaineVisite || null;
    const parsePVC = str => {
      if (!str || str === 'null' || !str.trim()) return null;
      const sv = str.trim(); let mv;
      mv = sv.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (mv) return new Date(+mv[3], +mv[2]-1, +mv[1]);
      mv = sv.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mv) return new Date(+mv[1], +mv[2]-1, +mv[3]);
      return null;
    };
    const prochaineVisiteDate = parsePVC(prochaineVisite);
    const wmlEntry = wmlNnMapCRM.get(ph.name.trim().toUpperCase().replace(/\s+/g,' '));
    let lastNoteDays = null, noteCount = 0;
    try {
      const savedNotes = JSON.parse(localStorage.getItem(`visit_notes_${ph.id}`) || '[]');
      noteCount = savedNotes.length;
      if (noteCount > 0) {
        const maxTs = Math.max(...savedNotes.map(n => new Date(n.date).getTime()));
        lastNoteDays = Math.round((today - maxTs) / 86400000);
      }
    } catch {}
    return { ph, caCur, caPrev, g, status, lastImport, lastImportDays, prochaineVisite, prochaineVisiteDate, wmlEntry, lastNoteDays, noteCount, mdl, nProdOrdered };
  }).filter(e => e.caCur > 0 || e.caPrev > 0);

  // Filtre texte (nom + ville/CP depuis CLIENTS)
  if (pharmaSearch) {
    const q = pharmaSearch.toLowerCase().replace(/\s+/g,' ').trim();
    const clientsMap2 = typeof CLIENTS !== 'undefined'
      ? new Map(CLIENTS.map(c => [(c.nom||'').toUpperCase().trim(), c]))
      : new Map();
    enriched = enriched.filter(e => {
      if (e.ph.name.toLowerCase().includes(q)) return true;
      const cli2 = clientsMap2.get(e.ph.name.toUpperCase().trim());
      if (!cli2) return false;
      return (cli2.ville||'').toLowerCase().includes(q) || (cli2.cp||'').includes(q);
    });
  }

  // Filtre statut
  if (pharmaFilter !== 'all') {
    const todayFC = new Date(); todayFC.setHours(0,0,0,0);
    const in7C = new Date(todayFC); in7C.setDate(in7C.getDate() + 7);
    enriched = enriched.filter(e => {
      if (pharmaFilter === 'up')   return e.g !== null && e.g > 20;
      if (pharmaFilter === 'flat') return e.g !== null && e.g >= -5 && e.g <= 20;
      if (pharmaFilter === 'down') return e.g !== null && e.g < -5;
      if (pharmaFilter === 'visite_retard')  return e.prochaineVisiteDate !== null && e.prochaineVisiteDate < todayFC;
      if (pharmaFilter === 'visite_semaine') return e.prochaineVisiteDate !== null && e.prochaineVisiteDate >= todayFC && e.prochaineVisiteDate <= in7C;
      if (pharmaFilter === 'visite_aucune')  return !e.prochaineVisiteDate;
      if (pharmaFilter === 'sans_note') return e.noteCount === 0;
      return true;
    });
  }

  // Tri
  if (pharmaSort === 'name')  enriched.sort((a, b) => a.ph.name.localeCompare(b.ph.name));
  else if (pharmaSort === 'delta') enriched.sort((a, b) => (b.g ?? -Infinity) - (a.g ?? -Infinity));
  else if (pharmaSort === 'note') enriched.sort((a, b) => {
    if (a.noteCount === 0 && b.noteCount === 0) return b.caCur - a.caCur;
    if (a.noteCount === 0) return 1;
    if (b.noteCount === 0) return -1;
    return (b.lastNoteDays ?? 9999) - (a.lastNoteDays ?? 9999);
  });
  else if (pharmaSort === 'wml') enriched.sort((a, b) => {
    const potA = a.wmlEntry ? Math.max(0, a.wmlEntry.ca / 4 - a.caCur) : 0;
    const potB = b.wmlEntry ? Math.max(0, b.wmlEntry.ca / 4 - b.caCur) : 0;
    return potB - potA;
  });
  else enriched.sort((a, b) => b.caCur - a.caCur);

  const maxCA = Math.max(...enriched.map(e => e.caCur), 1);

  const nRetardC  = (() => { const t = new Date(); t.setHours(0,0,0,0); return enriched.filter(e => e.prochaineVisiteDate && e.prochaineVisiteDate < t).length; })();
  const nSemaineC = (() => { const t = new Date(); t.setHours(0,0,0,0); const i7 = new Date(t); i7.setDate(i7.getDate()+7); return enriched.filter(e => e.prochaineVisiteDate && e.prochaineVisiteDate >= t && e.prochaineVisiteDate <= i7).length; })();
  const filterDefs = [
    { key: 'all',             label: 'Toutes' },
    { key: 'up',              label: 'En croissance' },
    { key: 'flat',            label: 'Stable' },
    { key: 'down',            label: 'En baisse' },
    { key: 'visite_retard',   label: nRetardC  > 0 ? `⚠ Retard (${nRetardC})`        : '⚠ Retard' },
    { key: 'visite_semaine',  label: nSemaineC > 0 ? `📅 Cette semaine (${nSemaineC})` : '📅 Cette semaine' },
    { key: 'visite_aucune',   label: 'Sans visite' },
    { key: 'sans_note',       label: '📝 Sans note' },
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
        const { ph, caCur, caPrev, g, status, lastImport, lastImportDays, prochaineVisite, wmlEntry, noteCount, lastNoteDays, mdl, nProdOrdered } = e;
        const chipHtml = status === 'up'   ? '<span class="status-chip status-up">● Croissance</span>'
                       : status === 'flat' ? '<span class="status-chip status-flat">● Stable</span>'
                       : status === 'down' ? '<span class="status-chip status-down">● Baisse</span>'
                       :                    '<span class="status-chip status-flat">● Nouveau</span>';
        const importFreshness = lastImportDays !== null
          ? lastImportDays === 0
            ? `<span style="font-size:10px;color:var(--mint)">Import aujourd'hui</span>`
            : lastImportDays <= 7
              ? `<span style="font-size:10px;color:var(--mint)">Import il y a ${lastImportDays}j</span>`
              : lastImportDays <= 35
                ? `<span style="font-size:10px;color:var(--text3)">Import il y a ${lastImportDays}j</span>`
                : `<span style="font-size:10px;color:var(--rose)">Import il y a ${lastImportDays}j</span>`
          : '';
        const visiteBadge = (() => {
          if (!prochaineVisite || !prochaineVisite.trim() || prochaineVisite === 'null') return '';
          const scv = prochaineVisite.trim();
          let dcv = null; let mcv;
          mcv = scv.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (mcv) dcv = new Date(+mcv[3], +mcv[2]-1, +mcv[1]);
          mcv = !dcv && scv.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (mcv) dcv = new Date(+mcv[1], +mcv[2]-1, +mcv[3]);
          if (!dcv) return `<span style="font-size:10px;color:var(--amber);background:rgba(255,176,32,.1);padding:1px 6px;border-radius:8px">📅 ${scv}</span>`;
          const todayCv = new Date(); todayCv.setHours(0,0,0,0);
          const diffCv = Math.round((dcv - todayCv) / 86400000);
          if (diffCv < 0) return `<span style="font-size:10px;color:var(--rose);background:rgba(255,77,109,.12);padding:1px 6px;border-radius:8px;font-weight:700">⚠ Retard ${Math.abs(diffCv)}j</span>`;
          if (diffCv === 0) return `<span style="font-size:10px;color:var(--amber);background:rgba(255,176,32,.18);padding:1px 6px;border-radius:8px;font-weight:700">📅 Aujourd'hui</span>`;
          if (diffCv <= 7) return `<span style="font-size:10px;color:var(--mint);background:rgba(0,229,160,.1);padding:1px 6px;border-radius:8px;font-weight:700">📅 J+${diffCv}</span>`;
          return `<span style="font-size:10px;color:var(--text3);background:var(--bg3);padding:1px 6px;border-radius:8px">📅 ${scv}</span>`;
        })();
        // Refonte desktop : 2 lignes au lieu de 12 colonnes qui débordent
        const chiffres = `
          <div style="display:flex;gap:18px;align-items:baseline;flex-shrink:0">
            <div style="text-align:right">
              <div style="font-family:'Geist Mono',ui-monospace,monospace;font-size:16px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums">${fmt(caCur)}</div>
              <div style="font-size:9px;color:var(--text3);letter-spacing:0.06em;text-transform:uppercase;margin-top:1px">CA net HT</div>
            </div>
            <div style="text-align:right;padding-left:14px;border-left:0.5px solid var(--border1)">
              <div style="font-family:'Geist Mono',ui-monospace,monospace;font-size:14px;font-weight:700;color:var(--mint);font-variant-numeric:tabular-nums" title="Marge MDL pharma (barème officiel France, remboursables uniquement)">${fmt(mdl.margeTotale)}</div>
              <div style="font-size:9px;color:var(--text3);letter-spacing:0.06em;text-transform:uppercase;margin-top:1px">Marge MDL ${mdl.margePct > 0 ? mdl.margePct.toFixed(1) + '%' : ''}</div>
            </div>
            <div style="text-align:right;padding-left:14px;border-left:0.5px solid var(--border1)">
              <div style="font-family:'Geist Mono',ui-monospace,monospace;font-size:14px;font-weight:700;color:var(--blue);font-variant-numeric:tabular-nums" title="Nombre de références produit commandées">${nProdOrdered}</div>
              <div style="font-size:9px;color:var(--text3);letter-spacing:0.06em;text-transform:uppercase;margin-top:1px">Réfs</div>
            </div>
          </div>`;
        const actions = `
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;margin-left:12px">
            <button onclick="event.stopPropagation();window.exportPharmaPeerRecsPDF && window.exportPharmaPeerRecsPDF('${ph.id}')" style="width:32px;height:32px;border-radius:8px;border:none;background:var(--blue);color:#fff;cursor:pointer;font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center" title="Fiche RDV opportunités sur mesure (basée sur ce que les peers commandent)">🎯</button>
            <button onclick="event.stopPropagation();window.exportPharmaListingPDF && window.exportPharmaListingPDF('${ph.id}')" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center" title="Télécharger le listing PDF (Best + À travailler)">📄</button>
            <button onclick="event.stopPropagation();showFicheVisite('${ph.id}')" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center" title="Ouvrir la fiche de visite">📋</button>
            <div style="color:var(--text3);font-size:16px;margin-left:2px">›</div>
          </div>`;
        return `
          <div class="pharma-item pharma-item-v2" onclick="showPharmaDetail('${ph.id}')" style="display:flex;flex-direction:column;gap:8px;padding:14px 18px;cursor:pointer;border-bottom:0.5px solid var(--border1);transition:background var(--dur-quick,120ms) ease" onmouseenter="this.style.background='var(--fill-4, rgba(120,120,128,.06))'" onmouseleave="this.style.background='transparent'">
            <!-- Ligne 1 : rank + dot + name + chiffres + actions -->
            <div style="display:flex;align-items:center;gap:14px;width:100%">
              <div class="rank ${i < 3 ? ['rank-1','rank-2','rank-3'][i] : 'rank-n'}" style="flex-shrink:0">${i < 3 ? '🥇🥈🥉'[i] : i+1}</div>
              <div class="pharma-dot" style="background:${ph.color};flex-shrink:0;width:10px;height:10px;border-radius:50%"></div>
              <div style="flex:1;min-width:0">
                <div class="pharma-name" style="font-weight:600;font-size:15px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ph.name}</div>
              </div>
              ${chiffres}
              ${actions}
            </div>
            <!-- Ligne 2 : meta chips + progress -->
            <div style="display:flex;align-items:center;gap:10px;padding-left:34px">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;min-width:0">
                ${chipHtml}
                ${g !== null ? deltaBadge(caCur, caPrev) : ''}
                ${importFreshness}
                ${visiteBadge}
                ${noteCount > 0
                  ? `<span style="font-size:10px;color:var(--blue);background:rgba(0,87,255,.1);padding:1px 6px;border-radius:8px;font-weight:600" title="${noteCount} note${noteCount>1?'s':''} de visite">📝 ${lastNoteDays === 0 ? 'Auj.' : lastNoteDays !== null ? `J-${lastNoteDays}` : ''} ·${noteCount}</span>`
                  : ''}
                ${wmlEntry ? `<span style="font-size:10px;color:#14B86A;background:rgba(20,184,106,.12);padding:1px 6px;border-radius:8px;font-weight:600">📦 WML ${fmt(wmlEntry.ca)}</span>` : ''}
              </div>
              <div style="width:140px;flex-shrink:0">${renderProgress(caCur, maxCA, ph.color)}</div>
            </div>
          </div>`;
      }).join('')
    : (pharmaSearch
        ? emptyState('search', 'Aucune pharmacie ne correspond', `Aucun résultat pour « ${pharmaSearch} ». Essayez un autre terme ou réinitialisez les filtres.`, 'Réinitialiser', "document.getElementById('pharma-search')&&(document.getElementById('pharma-search').value='');pharmaSearch='';renderPharmacies&&renderPharmacies()")
        : emptyState('pharmacy', 'Aucune pharmacie', 'Importez vos premiers fichiers Excel pour voir vos pharmacies apparaître ici.'));

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
        <div style="display:flex;align-items:center;gap:14px">
          <div>
            <div class="card-title">Mes officines (${enriched.length})</div>
            <div class="card-subtitle">${curY ? `Mois courant · ${monthName(curM)} ${curY}` : 'Aucune donnée'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <button onclick="exportPharmaciesCSV()" class="btn btn-ghost" style="padding:6px 12px;font-size:11px">⬇ CSV</button>
          <div class="search-wrap" style="width:260px">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Rechercher par nom, CIP, ville…" value="${pharmaSearch}"
              oninput="pharmaSearch=this.value;renderPharmacies()" />
          </div>
        </div>
      </div>
      <div style="padding:12px 24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        ${filterBarHtml}
        <div style="display:flex;gap:4px;align-items:center">
          <span style="font-size:11px;color:var(--text3);margin-right:4px">Trier par</span>
          ${[['ca','CA'],['delta','Delta'],['wml','WML'],['note','Notes'],['name','Nom']].map(([k,l]) =>
            `<button onclick="pharmaSort='${k}';renderPharmacies()" style="padding:4px 10px;border-radius:8px;border:1px solid ${pharmaSort===k?'var(--blue)':'var(--border2)'};background:${pharmaSort===k?'rgba(0,87,255,.1)':'transparent'};color:${pharmaSort===k?'var(--blue)':'var(--text3)'};cursor:pointer;font-size:11px;font-weight:600">${l}</button>`
          ).join('')}
        </div>
      </div>
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
  // WML enrichment
  const wmlVis = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
  const nnEx = s => (s||'').trim().toUpperCase().replace(/\s+/g,' ');
  const wmlExMap = new Map(wmlVis.map(d => [nnEx(d.nom), d]));
  const fmtC2 = v => v != null ? String(v.toFixed(2)).replace('.',',') : '';
  const rows = state.pharmacies.map(ph => {
    const caCur  = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
    const caPrev = sumCA(salesPrev.filter(s => s.pharmacyId === ph.id));
    const nRef   = new Set(salesCur.filter(s => s.pharmacyId === ph.id).map(s => s.artCode)).size;
    const g      = caPrev > 0 ? ((caCur - caPrev) / caPrev * 100) : null;
    const client = typeof CLIENTS !== 'undefined' ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === ph.name.toUpperCase().trim()) : null;
    const wmlE   = wmlExMap.get(nnEx(ph.name));
    const wmlCa  = wmlE ? wmlE.ca : null;
    const wmlMg  = wmlE ? wmlE.mg : null;
    const wmlConv = (wmlCa && wmlCa > 0) ? (caCur / (wmlCa / 4) * 100) : null;
    return [
      `"${ph.name.replace(/"/g,'""')}"`,
      client?.cp || '', client?.ville || '',
      client?.tel || '', client?.email || '',
      String(caCur.toFixed(2)).replace('.',','),
      String(caPrev.toFixed(2)).replace('.',','),
      g !== null ? String(g.toFixed(1)).replace('.',',') : '',
      nRef,
      fmtC2(wmlCa),
      fmtC2(wmlMg),
      wmlConv !== null ? String(wmlConv.toFixed(1)).replace('.',',') : '',
    ];
  }).filter(r => parseFloat(r[5].replace(',','.')) > 0 || parseFloat(r[6].replace(',','.')) > 0);
  rows.sort((a, b) => parseFloat(b[5].replace(',','.')) - parseFloat(a[5].replace(',','.')));
  const header = ['Pharmacie','CP','Ville','Tél','Email',`CA ${curY ? monthName(curM)+' '+curY : ''}`,`CA M-1`,`Évolution %`,'Nb Références','CA WML Jan-Avr','Marge WML','Tx Conversion %'];
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
      <div style="display:flex;gap:5px;flex-shrink:0">
        ${emailBtn}${telBtn}
        <button onclick="addProspectAsPharmacy('${(c.nom||'').replace(/'/g,"&#39;")}')" title="Ajouter comme pharmacie cliente"
          style="padding:5px 10px;border-radius:8px;border:1.5px solid rgba(0,87,255,.3);background:rgba(0,87,255,.06);color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">+ Client</button>
      </div>
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

// ════════════════════════════════════════════════════════════════════
// PEER RECOMMENDATIONS — fiche RDV sur mesure validée Will 2026-06-09
// Trouve les pharmacies similaires (peers) → agrège leurs commandes →
// propose les produits que la pharma ne commande pas encore. Avec
// bouton "Créer fiche RDV" qui ouvre l'éditeur Marketing pré-rempli.
// ════════════════════════════════════════════════════════════════════

function findPeerPharmacies(pharma) {
  const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const wmlVis = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
  const myWml = wmlVis.find(d => nn(d.nom) === nn(pharma.name));

  // 1. Priorité : peers du même groupement WML
  if (myWml && myWml.groupement) {
    const peers = wmlVis
      .filter(d => d.groupement === myWml.groupement && nn(d.nom) !== nn(pharma.name))
      .map(d => state.pharmacies.find(p => nn(p.name) === nn(d.nom)))
      .filter(Boolean);
    if (peers.length >= 3) return peers.slice(0, 30);
  }

  // 2. Fallback : top 30 par CA proche (±50% à ±200% du mien)
  const myCa = sumCA(getSales({ pharmacyId: pharma.id }));
  if (myCa <= 0) {
    // Aucune vente IP pour le moment → fallback final : 20 plus grosses pharmas
    return state.pharmacies
      .filter(p => p.id !== pharma.id)
      .map(p => ({ p, ca: sumCA(getSales({ pharmacyId: p.id })) }))
      .filter(x => x.ca > 0)
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 20)
      .map(x => x.p);
  }
  return state.pharmacies
    .filter(p => p.id !== pharma.id)
    .map(p => ({ p, ca: sumCA(getSales({ pharmacyId: p.id })) }))
    .filter(x => x.ca > 0 && x.ca >= myCa * 0.4 && x.ca <= myCa * 2.5)
    .sort((a, b) => Math.abs(a.ca - myCa) - Math.abs(b.ca - myCa))
    .slice(0, 30)
    .map(x => x.p);
}

function buildPeerRecommendations(pharma, peers, allPhSales) {
  // CIPs commandés par CETTE pharmacie
  const myCipsSet = new Set(allPhSales.map(s => String(s.artCode || '')).filter(c => c.length >= 7));

  // Agréger ce que les peers commandent par CIP
  const peerStats = new Map();
  peers.forEach(peer => {
    const peerSales = getSales({ pharmacyId: peer.id });
    // Set unique CIPs ce peer commande pour ne pas compter en double
    const peerCipsByCode = new Map();
    peerSales.forEach(s => {
      const code = String(s.artCode || '');
      if (code.length < 7) return;
      const cur = peerCipsByCode.get(code) || { qte: 0, ca: 0, sample: null };
      cur.qte += (s.qte || 0);
      cur.ca += (s.mntNetHt || 0);
      if (!cur.sample) cur.sample = s;
      peerCipsByCode.set(code, cur);
    });
    peerCipsByCode.forEach((agg, code) => {
      let stat = peerStats.get(code);
      if (!stat) {
        stat = {
          cip: code,
          designation: agg.sample.artDesignation || '',
          puNet: agg.sample.puNet || 0,
          famille: agg.sample.artFamille || '',
          count_peers: 0,
          total_qte: 0,
          total_ca: 0,
        };
        peerStats.set(code, stat);
      }
      stat.count_peers++;
      stat.total_qte += agg.qte;
      stat.total_ca += agg.ca;
      // Update sample puNet if missing
      if (!stat.puNet && agg.sample.puNet) stat.puNet = agg.sample.puNet;
    });
  });

  // Filtrer : commandé par au moins 2 peers ET non commandé par moi
  const totalPeers = Math.max(1, peers.length);
  const recs = [];
  peerStats.forEach(stat => {
    if (stat.count_peers < 2) return;
    if (myCipsSet.has(stat.cip)) return;
    recs.push({
      cip: stat.cip,
      designation: stat.designation,
      famille: stat.famille,
      puNet: stat.puNet,
      count_peers: stat.count_peers,
      total_qte: stat.total_qte,
      total_ca: stat.total_ca,
      pct_peers: stat.count_peers / totalPeers,
      avg_qte: stat.total_qte / stat.count_peers,
    });
  });

  // Enrich with BENCHMARK info (catégorie, ip_qty, is_froid, has_ameli) if available
  if (typeof BENCHMARK !== 'undefined' && BENCHMARK.length) {
    const benchByCip = new Map();
    BENCHMARK.forEach(b => {
      if (b.cip13) benchByCip.set(String(b.cip13), b);
      if (b.artcode) benchByCip.set(String(b.artcode), b);
    });
    recs.forEach(r => {
      const b = benchByCip.get(r.cip);
      if (b) {
        r.categorie = b.categorie;
        r.is_froid = b.is_froid;
        r.has_ameli = b.has_ameli;
        r.ameli_total = b.ameli_total || 0;
        r.prix_ip = b.prix_ip;
      }
    });
  }

  // Tri : nb peers desc puis avg_qte desc
  recs.sort((a, b) => (b.count_peers - a.count_peers) || (b.avg_qte - a.avg_qte));
  return recs;
}

function segmentPeerRecommendations(recs) {
  // Détection familles élargies
  const GEN_RX  = /\b(MYLAN|BIOGARAN|SANDOZ|TEVA|RATIOPHARM|EG|ZENTIVA|ARROW|VIATRIS|ACCORD|KRKA|BAILLY|CRISTERS|RANBAXY)\b/;
  const BIO_RX  = /\b(BIOSIMILAIRE|TRUXIMA|BENEPALI|REMSIMA|RIXATHON|RUXIENCE|MVASI|ZIRABEV|HULIO|HEFIYA|KANJINTI|IMRALDI|ZESSLY|FLIXABI|INHIXA)\b/;
  const isFroid = r => r.is_froid === true || r.famille === 'froid' || /FROID|RÉFRIGÉR|REFRIGER|THERMOSENS/i.test(r.designation || '');
  const isGen   = r => GEN_RX.test((r.designation || '').toUpperCase()) || /générique/i.test(r.categorie || '');
  const isBio   = r => BIO_RX.test((r.designation || '').toUpperCase());

  const defs = [
    { id: 'peer-froid',  name: '❄️ Froids · peers commandent',       sub: 'chaîne du froid 2–8 °C',                       cap: 30,  accent: '#06B6D4', filter: isFroid },
    { id: 'peer-bio',    name: '🧬 Biosimilaires · peers commandent', sub: 'top biosimilaires omis par cette pharmacie',   cap: 15,  accent: '#EC4899', filter: r => !isFroid(r) && isBio(r) },
    { id: 'peer-gen',    name: '💊 Génériques · peers commandent',    sub: 'EG · Mylan · Biogaran · Sandoz · Teva…',      cap: 50,  accent: '#A78BFA', filter: r => !isFroid(r) && !isBio(r) && isGen(r) },
    { id: 'peer-cheap',  name: '🟢 Petits prix · peers commandent',   sub: '0 — 4,33 € ambiant',                          cap: 30,  accent: '#10B981', filter: r => !isFroid(r) && !isBio(r) && !isGen(r) && r.puNet > 0 && r.puNet <= 4.33 },
    { id: 'peer-mid',    name: '🔵 Intermédiaires · peers commandent', sub: '4,33 — 468 €',                                cap: 80,  accent: '#0057FF', filter: r => !isFroid(r) && !isBio(r) && !isGen(r) && r.puNet > 4.33 && r.puNet <= 468 },
    { id: 'peer-exp',    name: '🟠 Chers · peers commandent',         sub: '> 468 €',                                     cap: 20,  accent: '#FF6B35', filter: r => !isFroid(r) && !isBio(r) && !isGen(r) && r.puNet > 468 },
  ];
  defs.forEach(seg => {
    const filtered = recs.filter(seg.filter);
    seg.items = filtered.slice(0, seg.cap);
    seg.totalCount = filtered.length;
    seg.totalQte = filtered.reduce((s, r) => s + r.total_qte, 0);
    seg.avgPctPeers = filtered.length ? filtered.reduce((s, r) => s + r.pct_peers, 0) / filtered.length : 0;
  });
  return defs;
}

// ── Helpers locaux pour le rendu peer-recs ───────────────
// Icône catégorie à partir d'un rec (emoji 24×24 ish)
function _peerRecCatIcon(r) {
  if (r.is_froid) return '❄️';
  const cat = (r.categorie || '').toLowerCase();
  if (cat === 'biosim' || /BIOSIMIL/i.test(r.designation || '')) return '🧬';
  if (cat === 'gen' || /(MYLAN|BIOGARAN|SANDOZ|TEVA|EG|ZENTIVA|ARROW|VIATRIS|ACCORD|KRKA)/i.test(r.designation || '')) return '💊';
  if (cat === 'derm' || /CRÈME|CREME|POMMADE|GEL/i.test(r.designation || '')) return '🧴';
  if (cat === 'mi' || cat === 'ma') return '💉';
  if (r.has_ameli) return '🏥';
  return '📦';
}

// Badge HOT / WARM / COLD selon avg pct peers
function _peerRecTempLabel(pct) {
  if (pct > 0.60) return { cls: 'is-hot', label: 'HOT' };
  if (pct >= 0.30) return { cls: 'is-warm', label: 'WARM' };
  return { cls: 'is-cold', label: 'COLD' };
}

// Dots visuels Peers : n/total
function _peerRecDots(n, total) {
  // Max 7 dots affichés (sinon trop large)
  const max = Math.min(7, total || 7);
  const ratio = total > 0 ? n / total : 0;
  const on = Math.round(ratio * max);
  let html = '<span class="peer-rec-dots" aria-label="' + n + ' sur ' + total + ' peers">';
  for (let i = 0; i < max; i++) {
    html += '<span class="peer-rec-dot' + (i < on ? ' is-on' : '') + '"></span>';
  }
  html += '</span>';
  return html;
}

// Toggle local pour les cards (sans dépendre de mkToggleSegment Marketing)
if (!window.__peerRecToggle) {
  window.__peerRecToggle = function (segId) {
    const card = document.querySelector('.peer-rec-card[data-seg-id="' + segId + '"]');
    if (!card) return;
    card.classList.toggle('is-open');
  };
}

// QuickAdd amélioré : animation pill -> check + toast
if (!window.__peerRecQuickAdd) {
  window.__peerRecQuickAdd = function (cip, btn) {
    if (btn && !btn.classList.contains('is-added')) {
      btn.classList.add('is-added');
      const row = btn.closest('tr');
      if (row) {
        row.classList.add('is-pulse');
        setTimeout(() => row.classList.remove('is-pulse'), 220);
      }
      setTimeout(() => btn.classList.remove('is-added'), 700);
    }
    if (typeof window.appleToast === 'function') {
      try { window.appleToast('+ Produit ajouté', { variant: 'success' }); }
      catch (e) { /* noop */ }
    }
    if (typeof window.mkQuickAddProduct === 'function') {
      window.mkQuickAddProduct(cip);
    }
  };
}

// Création fiche RDV avec loading state + toast
if (!window.__peerRecCreateFiche) {
  window.__peerRecCreateFiche = function (recId, btn) {
    if (!btn) return;
    if (btn.classList.contains('is-loading')) return;
    btn.classList.add('is-loading');
    const lbl = btn.querySelector('.peer-rec-cta-label');
    const prev = lbl ? lbl.textContent : '';
    if (lbl) lbl.textContent = 'Génération de la fiche…';
    // Compter les produits pour le toast
    const store = window[recId];
    const nProd = store && Array.isArray(store.recs) ? Math.min(store.recs.length, 12) : 0;
    setTimeout(() => {
      try {
        if (typeof window.mkCreatePharmaOpportunityFiche === 'function') {
          window.mkCreatePharmaOpportunityFiche(recId);
        }
        if (typeof window.appleToast === 'function') {
          window.appleToast('✓ Fiche RDV prête · ' + nProd + ' produits chargés', { variant: 'success' });
        }
      } catch (e) { /* noop */ }
      // Reset (au cas où la nav reste sur la page)
      setTimeout(() => {
        btn.classList.remove('is-loading');
        if (lbl) lbl.textContent = prev || 'Créer la fiche RDV';
      }, 200);
    }, 600);
  };
}

// SVG sparkles inline réutilisable
const _PEER_REC_SPARKLES_SVG = '<svg class="peer-rec-cta-sparkle" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z"/><path d="M5 14l.75 2.25L8 17l-2.25.75L5 20l-.75-2.25L2 17l2.25-.75L5 14z"/></svg>';

function _peerRecEmptyShell(title, body, ctaLabel, ctaAction) {
  // 3 variants d'icônes line-art selon le contexte de l'empty state
  const ICONS = {
    groupements: '<svg class="peer-rec-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    import:      '<svg class="peer-rec-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    done:        '<svg class="peer-rec-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>',
  };
  const icon = ICONS[ctaAction] || ICONS.done;
  // Toute action ctaAction non-vide est traitée comme une page navigate cible
  const ctaHtml = (ctaLabel && ctaAction)
    ? '<button class="peer-rec-empty-cta" onclick="navigate(\'' + ctaAction + '\')">' + ctaLabel + '</button>'
    : '';
  return '<section class="peer-rec-section"><div class="peer-rec-empty">' +
    icon +
    '<div class="peer-rec-empty-title">' + title + '</div>' +
    '<div class="peer-rec-empty-body">' + body + '</div>' +
    ctaHtml +
    '</div></section>';
}

function renderPeerRecommendationsHTML(pharma, allPhSales) {
  // Si pas de données de ventes → afficher empty state explicite (au lieu de tout cacher)
  if (!state.sales || state.sales.length === 0) {
    return _peerRecEmptyShell(
      'Importe tes ventes pour activer les recommandations',
      "L'algorithme a besoin de l'historique des commandes (page Import) pour identifier les pharmacies similaires et te proposer leurs top produits.",
      'Importer mes ventes',
      'import'
    );
  }

  const peers = findPeerPharmacies(pharma);
  if (peers.length < 2) {
    return _peerRecEmptyShell(
      'Pas encore de peers identifiés',
      "Ajoute cette pharmacie à un groupement ou attends que d'autres officines de CA similaire soient importées.",
      'Voir groupements',
      'groupements'
    );
  }

  const recs = buildPeerRecommendations(pharma, peers, allPhSales);
  if (recs.length === 0) {
    return _peerRecEmptyShell(
      'Bravo · catalogue complet',
      'Cette pharmacie commande déjà tous les top produits de ses peers.',
      '',
      ''
    );
  }

  const segments = segmentPeerRecommendations(recs).filter(s => s.items.length > 0);
  if (segments.length === 0) {
    return _peerRecEmptyShell(
      'Bravo · catalogue complet',
      'Cette pharmacie commande déjà tous les top produits de ses peers.',
      '',
      ''
    );
  }

  // Source : groupement WML ou CA proche
  const sourceInfo = (() => {
    const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const wmlVis = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
    const mine = wmlVis.find(d => nn(d.nom) === nn(pharma.name));
    if (mine && mine.groupement) return { label: 'pharmacies du groupement ' + mine.groupement, chip: 'groupement ' + mine.groupement };
    return { label: 'pharmacies de CA proche', chip: 'CA proche ±50 %' };
  })();

  // Stocker pour mkCreatePharmaOpportunityFiche
  const recId = '__peer_recs_' + (pharma.id || '').toString().replace(/\W/g, '_');
  window[recId] = { pharma: pharma.name, recs: recs.slice(0, 60), segments: segments };

  const escAttr = s => String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const escHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // KPIs header
  const totalProds = recs.length;

  const cardsHtml = segments.map((seg, segIdx) => {
    const isOpen = segIdx === 0; // premier segment ouvert par défaut
    const initial = seg.items.slice(0, 12);
    const temp = _peerRecTempLabel(seg.avgPctPeers);
    const pct = Math.round(seg.avgPctPeers * 100);

    const rowsHtml = initial.map((r, i) => {
      const cipAttr = escAttr(r.cip || '');
      const desigShort = (r.designation || '').slice(0, 44) + ((r.designation || '').length > 44 ? '…' : '');
      return '<tr>' +
        '<td class="peer-rec-cat">' + _peerRecCatIcon(r) + '</td>' +
        '<td class="peer-rec-rk">' + (i + 1) + '</td>' +
        '<td class="peer-rec-name" title="' + escAttr(r.designation) + '">' + escHtml(desigShort) + '</td>' +
        '<td class="peer-rec-cip">' + escHtml(r.cip || '') + '</td>' +
        '<td class="peer-rec-num">' + (r.puNet > 0 ? r.puNet.toFixed(2) + ' €' : '—') + '</td>' +
        '<td class="peer-rec-num">' + _peerRecDots(r.count_peers, peers.length) + '</td>' +
        '<td class="peer-rec-num peer-rec-ratio">' + Math.round(r.pct_peers * 100) + '%</td>' +
        '<td class="peer-rec-num">' + Math.round(r.avg_qte).toLocaleString('fr-FR') + '</td>' +
        '<td class="peer-rec-action">' +
          '<button class="peer-rec-info" title="Voir produit" onclick="event.stopPropagation()" aria-label="Voir produit">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
          '</button>' +
          '<button class="peer-rec-add" onclick="event.stopPropagation();window.__peerRecQuickAdd(\'' + cipAttr + '\', this)" title="Ajouter à la fiche en cours">' +
            '<span class="peer-rec-add-plus">+</span>' +
          '</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    return '<div class="peer-rec-card is-visible ' + (isOpen ? 'is-open' : '') + '" data-seg-id="' + escAttr(seg.id) + '" style="--peer-pct:' + pct + '%; color:' + seg.accent + '">' +
      '<button class="peer-rec-card-head" type="button" onclick="window.__peerRecToggle(\'' + escAttr(seg.id) + '\')">' +
        '<span class="peer-rec-card-accent"></span>' +
        '<div class="peer-rec-card-titles">' +
          '<div class="peer-rec-card-name">' + seg.name + ' <span class="peer-rec-card-cap">' + seg.totalCount + ' reco</span></div>' +
          '<div class="peer-rec-card-meta">' + seg.sub + ' · ' + pct + '% des peers commandent en moyenne</div>' +
        '</div>' +
        '<div class="peer-rec-card-stats">' +
          '<div class="peer-rec-stat">' +
            '<span class="peer-rec-stat-v">' + seg.totalQte.toLocaleString('fr-FR') + '</span>' +
            '<span class="peer-rec-stat-k">u peers vendent</span>' +
          '</div>' +
          '<div class="peer-rec-stat">' +
            '<span class="peer-rec-stat-v">' + seg.totalCount + '</span>' +
            '<span class="peer-rec-stat-k">à proposer</span>' +
          '</div>' +
        '</div>' +
        '<span class="peer-rec-temp ' + temp.cls + '">' + temp.label + '</span>' +
        '<svg class="peer-rec-card-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</button>' +
      '<div class="peer-rec-progress" aria-hidden="true"><div class="peer-rec-progress-fill"></div></div>' +
      '<div class="peer-rec-card-body"><div class="peer-rec-card-body-inner">' +
        '<div class="peer-rec-table-wrap">' +
          '<table class="peer-rec-table">' +
            '<thead><tr>' +
              '<th></th><th>#</th><th>Produit</th><th>CIP13</th>' +
              '<th class="is-num">Prix net</th>' +
              '<th class="is-num">Peers</th>' +
              '<th class="is-num">% peers</th>' +
              '<th class="is-num">Qté moy.</th>' +
              '<th></th>' +
            '</tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div></div>' +
    '</div>';
  }).join('');

  return '<section class="peer-rec-section">' +
    '<div class="peer-rec-head">' +
      '<div class="peer-rec-head-left">' +
        '<div class="peer-rec-eyebrow">Sur mesure pour ce RDV</div>' +
        '<h2 class="peer-rec-title">Top des peers · ' + escHtml(pharma.name) + '</h2>' +
        '<div class="peer-rec-sub">' + peers.length + ' ' + sourceInfo.label + ' commandent des produits absents de cette pharmacie. Sélectionne, prépare la fiche RDV, repars avec un argumentaire chiffré.</div>' +
      '</div>' +
      '<div class="peer-rec-head-right">' +
        '<div class="peer-rec-kpis">' +
          '<div class="peer-rec-kpi">' +
            '<div class="peer-rec-kpi-top"><span class="peer-rec-kpi-icon">🎯</span><span class="peer-rec-kpi-val">' + peers.length + '</span></div>' +
            '<div class="peer-rec-kpi-lbl">peers</div>' +
            '<span class="peer-rec-kpi-chip">' + escHtml(sourceInfo.chip) + '</span>' +
          '</div>' +
          '<div class="peer-rec-kpi">' +
            '<div class="peer-rec-kpi-top"><span class="peer-rec-kpi-icon">📦</span><span class="peer-rec-kpi-val">' + totalProds + '</span></div>' +
            '<div class="peer-rec-kpi-lbl">produits</div>' +
          '</div>' +
          '<div class="peer-rec-kpi">' +
            '<div class="peer-rec-kpi-top"><span class="peer-rec-kpi-icon">🗂️</span><span class="peer-rec-kpi-val">' + segments.length + '</span></div>' +
            '<div class="peer-rec-kpi-lbl">catégories</div>' +
          '</div>' +
        '</div>' +
        '<button class="peer-rec-cta" type="button" onclick="window.__peerRecCreateFiche(\'' + recId + '\', this)">' +
          _PEER_REC_SPARKLES_SVG +
          '<span class="peer-rec-cta-spinner" aria-hidden="true"></span>' +
          '<span class="peer-rec-cta-label">Créer la fiche RDV</span>' +
        '</button>' +
      '</div>' +
    '</div>' +
    '<div class="peer-rec-body">' + cardsHtml + '</div>' +
  '</section>';
}

// ════════════════════════════════════════════════════════════════════
// BEST PRODUITS + À TRAVAILLER par catégorie + Export PDF
// Validé Will 2026-06-09 : 10-30 best par cat, 20-50 à travailler par cat
// ════════════════════════════════════════════════════════════════════
const _CAT_DEFS = [
  { id: 'froid',  emoji: '❄️', label: 'Chaîne du froid 2–8 °C',     accent: '#06B6D4' },
  { id: 'biosim', emoji: '🧬', label: 'Biosimilaires',               accent: '#EC4899' },
  { id: 'gen',    emoji: '💊', label: 'Génériques',                  accent: '#A78BFA' },
  { id: 'cheap',  emoji: '🟢', label: 'Petits prix · 0 — 4,33 €',    accent: '#10B981' },
  { id: 'mid',    emoji: '🔵', label: 'Intermédiaires · 4,33 — 468 €', accent: '#0057FF' },
  { id: 'exp',    emoji: '🟠', label: 'Chers · > 468 €',             accent: '#FF6B35' },
  { id: 'nr',     emoji: '🟡', label: 'Non remboursés (marge libre)', accent: '#F59E0B' },
];
const _GEN_RX = /\b(MYLAN|BIOGARAN|SANDOZ|TEVA|RATIOPHARM|EG|ZENTIVA|ARROW|VIATRIS|ACCORD|KRKA|BAILLY|CRISTERS|RANBAXY)\b/;
const _BIO_RX = /\b(BIOSIMILAIRE|TRUXIMA|BENEPALI|REMSIMA|RIXATHON|RUXIENCE|MVASI|ZIRABEV|HULIO|HEFIYA|KANJINTI|IMRALDI|ZESSLY|FLIXABI|INHIXA)\b/;
function _catOfProduct(r) {
  // r doit avoir : designation, puNet?, is_froid?, has_ameli?, categorie?, famille?
  const isFr = r.is_froid === true || r.famille === 'froid' || /FROID|RÉFRIGÉR|THERMOSENS/i.test(r.designation || '');
  if (isFr) return 'froid';
  const D = (r.designation || '').toUpperCase();
  if (_BIO_RX.test(D)) return 'biosim';
  if (_GEN_RX.test(D) || /générique/i.test(r.categorie || '')) return 'gen';
  if (r.has_ameli === false) return 'nr';
  const p = r.puNet || r.prix_ip || 0;
  if (p > 0 && p <= 4.33) return 'cheap';
  if (p > 4.33 && p <= 468) return 'mid';
  if (p > 468) return 'exp';
  return 'mid'; // fallback
}

function bestProductsByCategoryForPharma(allPhSales, capPerCat) {
  capPerCat = capPerCat || { froid: 30, biosim: 15, gen: 30, cheap: 20, mid: 30, exp: 15, nr: 30 };
  // Index BENCHMARK pour enrichir
  const benchByCip = new Map();
  if (typeof BENCHMARK !== 'undefined' && BENCHMARK.length) {
    BENCHMARK.forEach(b => {
      if (b.cip13)   benchByCip.set(String(b.cip13),   b);
      if (b.artcode) benchByCip.set(String(b.artcode), b);
    });
  }
  // Agrège par CIP
  const byCip = new Map();
  for (const s of allPhSales) {
    const cip = String(s.artCode || '');
    if (!cip) continue;
    let stat = byCip.get(cip);
    if (!stat) {
      stat = {
        cip, designation: s.artDesignation || '', famille: s.artFamille || '',
        puNet: s.puNet || 0, qte: 0, ca: 0, marge: 0, lignes: 0,
      };
      const b = benchByCip.get(cip);
      if (b) {
        stat.categorie = b.categorie;
        stat.is_froid = b.is_froid;
        stat.has_ameli = b.has_ameli;
        stat.prix_ip = b.prix_ip;
      }
      byCip.set(cip, stat);
    }
    stat.qte += s.qte || 0;
    stat.ca += s.mntNetHt || 0;
    stat.marge += Math.max(0, (s.puBrut - s.puNet) * s.qte);
    stat.lignes++;
    if (!stat.puNet && s.puNet) stat.puNet = s.puNet;
  }
  // Ajoute marge MDL pour les remboursables
  byCip.forEach(stat => {
    if (isMdlRemboursable(stat.cip)) {
      stat.margeMDL = calcMargeBoiteMDL(stat.puNet) * stat.qte;
    } else {
      stat.margeMDL = null;
    }
    stat.cat = _catOfProduct(stat);
  });
  const list = Array.from(byCip.values());
  // Regroupe par catégorie + cap
  return _CAT_DEFS.map(def => {
    const filtered = list.filter(r => r.cat === def.id).sort((a, b) => b.ca - a.ca);
    const cap = capPerCat[def.id] || 20;
    return Object.assign({}, def, {
      items: filtered.slice(0, cap),
      totalCount: filtered.length,
      totalCa: filtered.reduce((s, r) => s + r.ca, 0),
      totalQte: filtered.reduce((s, r) => s + r.qte, 0),
      totalMarge: filtered.reduce((s, r) => s + (r.marge || 0), 0),
      totalMargeMDL: filtered.reduce((s, r) => s + (r.margeMDL || 0), 0),
      cap,
    });
  });
}

/**
 * Build "à travailler" = opportunités produits que CETTE pharma ne commande
 * pas encore. Sources : (1) peer recs (autres pharmas similaires), (2) BENCHMARK
 * top ventes IP non commandées par cette pharma. Enrichi catégorie.
 */
function workProductsByCategoryForPharma(orderedCipsSet, capPerCat) {
  capPerCat = capPerCat || { froid: 50, biosim: 20, gen: 50, cheap: 30, mid: 50, exp: 20, nr: 50 };
  if (typeof BENCHMARK === 'undefined' || !BENCHMARK.length) return [];
  // Filtre BENCHMARK : produits IP avec ip_qty > 0 (IP vend déjà) et que cette pharma NE COMMANDE PAS
  const candidates = BENCHMARK
    .filter(b => (b.ip_qty || 0) > 0)
    .filter(b => {
      const c = String(b.cip13 || '');
      const a = String(b.artcode || '');
      return !orderedCipsSet.has(c) && !orderedCipsSet.has(a);
    })
    .map(b => ({
      cip: String(b.cip13 || b.artcode || ''),
      designation: b.designation || '',
      categorie: b.categorie || '',
      is_froid: b.is_froid,
      has_ameli: b.has_ameli,
      puNet: b.prix_ip || b.prix_ht || 0,
      prix_ip: b.prix_ip,
      ip_qty: b.ip_qty || 0,
      ip_ca: b.ip_ca || 0,
      ameli_total: b.ameli_total || 0,
    }));
  candidates.forEach(c => { c.cat = _catOfProduct(c); });
  return _CAT_DEFS.map(def => {
    const filtered = candidates.filter(r => r.cat === def.id).sort((a, b) => b.ip_qty - a.ip_qty);
    const cap = capPerCat[def.id] || 30;
    return Object.assign({}, def, {
      items: filtered.slice(0, cap),
      totalCount: filtered.length,
      totalIpQty: filtered.reduce((s, r) => s + r.ip_qty, 0),
      totalIpCa: filtered.reduce((s, r) => s + r.ip_ca, 0),
      totalAmeli: filtered.reduce((s, r) => s + r.ameli_total, 0),
      cap,
    });
  });
}

function _fmtEur(n) {
  if (!isFinite(n) || n === 0) return '0 €';
  return Math.round(n).toLocaleString('fr-FR') + ' €';
}
function _fmtNum(n) {
  if (!isFinite(n) || n === 0) return '0';
  return Math.round(n).toLocaleString('fr-FR');
}

// Set local pour replier/déplier les cards Best/À travailler (scope app.js)
window.__pharmaCatExpanded = window.__pharmaCatExpanded || new Set();
window.togglePharmaCatExpanded = function (segId) {
  if (window.__pharmaCatExpanded.has(segId)) window.__pharmaCatExpanded.delete(segId);
  else window.__pharmaCatExpanded.add(segId);
  // Re-render fiche pharma courante
  const url = location.hash;
  const m = document.querySelector('#pharma-content');
  if (m && window.__currentPharmaId) showPharmaDetail(window.__currentPharmaId);
};

function renderBestAndWorkSectionsHTML(pharma, allPhSales) {
  // Stocker l'ID pharma courante pour le toggle
  window.__currentPharmaId = pharma.id;

  // Empty state si pas de ventes du tout
  if (!allPhSales || allPhSales.length === 0) {
    return `
      <div class="mk-section mk-cat-section" style="margin-top:32px">
        <div class="mk-section-head" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
          <div>
            <div class="mk-section-title">🏆 Best produits + 🎯 À travailler par catégorie</div>
            <div class="mk-section-sub">Pas encore de ventes IP pour cette pharmacie. Importe ton fichier Excel via la page Import pour activer le listing personnalisé + PDF.</div>
          </div>
          <button class="a-btn a-btn-tinted" onclick="navigate('import')" style="white-space:nowrap;flex-shrink:0">→ Importer mes ventes</button>
        </div>
      </div>
    `;
  }

  const orderedCipsSet = new Set(
    allPhSales.map(s => String(s.artCode || '')).filter(c => c.length >= 7)
  );
  const bestCats = bestProductsByCategoryForPharma(allPhSales).filter(s => s.items.length > 0);
  const workCats = workProductsByCategoryForPharma(orderedCipsSet).filter(s => s.items.length > 0);

  const bestRowHtml = (r, i) => `
    <tr>
      <td class="mk-cat-rk">${i + 1}</td>
      <td class="mk-cat-name" title="${(r.designation || '').replace(/"/g, '&quot;')}">${(r.designation || '').slice(0, 44)}${(r.designation || '').length > 44 ? '…' : ''}</td>
      <td class="mk-cat-cip">${r.cip}</td>
      <td class="mk-cat-num">${r.puNet > 0 ? r.puNet.toFixed(2) + ' €' : '—'}</td>
      <td class="mk-cat-num">${_fmtNum(r.qte)}</td>
      <td class="mk-cat-num">${_fmtEur(r.ca)}</td>
      <td class="mk-cat-num ${r.margeMDL != null ? 'mk-cat-ratio' : 'mk-cat-empty'}">${r.margeMDL != null ? _fmtEur(r.margeMDL) : 'NR'}</td>
    </tr>
  `;
  const workRowHtml = (r, i) => `
    <tr>
      <td class="mk-cat-rk">${i + 1}</td>
      <td class="mk-cat-name" title="${(r.designation || '').replace(/"/g, '&quot;')}">${(r.designation || '').slice(0, 44)}${(r.designation || '').length > 44 ? '…' : ''}</td>
      <td class="mk-cat-cip">${r.cip}</td>
      <td class="mk-cat-num">${r.puNet > 0 ? r.puNet.toFixed(2) + ' €' : '—'}</td>
      <td class="mk-cat-num">${_fmtNum(r.ip_qty)}</td>
      <td class="mk-cat-num">${r.ameli_total > 0 ? _fmtNum(r.ameli_total) : '—'}</td>
      <td><button class="mk-cat-addbtn" onclick="event.stopPropagation();window.mkQuickAddProduct && window.mkQuickAddProduct('${r.cip}')" title="Ajouter à la fiche en cours">+</button></td>
    </tr>
  `;

  const bestCardHtml = seg => {
    const isOpen = window.__pharmaCatExpanded.has('best-' + seg.id);
    const initial = isOpen ? seg.items : seg.items.slice(0, 10);
    return `
      <div class="mk-cat-card ${isOpen ? 'is-open' : ''}" data-seg-id="best-${seg.id}">
        <button class="mk-cat-card-head" onclick="window.togglePharmaCatExpanded('best-${seg.id}')">
          <span class="mk-cat-card-accent" style="background:${seg.accent}"></span>
          <div class="mk-cat-card-titles">
            <div class="mk-cat-card-name">${seg.emoji} ${seg.label} <span class="mk-cat-card-cap">Top ${Math.min(seg.totalCount, seg.cap)}</span></div>
            <div class="mk-cat-card-meta">${seg.totalCount} produits commandés · ${_fmtEur(seg.totalCa)} CA cumulé</div>
          </div>
          <div class="mk-cat-card-stats">
            <div class="mk-cat-stat"><span class="mk-cat-stat-v">${_fmtNum(seg.totalQte)}</span><span class="mk-cat-stat-k">u vendues</span></div>
            ${seg.totalMargeMDL > 0 ? `<div class="mk-cat-stat mk-cat-stat-ratio-cell"><span class="mk-cat-stat-v">${_fmtEur(seg.totalMargeMDL)}</span><span class="mk-cat-stat-k">marge MDL pharma</span></div>` : ''}
          </div>
          <svg class="mk-cat-card-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="mk-cat-card-body">
          <table class="mk-cat-table">
            <thead><tr><th>#</th><th>Produit</th><th>CIP13</th><th class="mk-cat-num-h">Prix net</th><th class="mk-cat-num-h">Qté</th><th class="mk-cat-num-h">CA</th><th class="mk-cat-num-h">Marge pharma</th></tr></thead>
            <tbody>${initial.map(bestRowHtml).join('')}</tbody>
          </table>
        </div>
      </div>
    `;
  };

  const workCardHtml = seg => {
    const isOpen = window.__pharmaCatExpanded.has('work-' + seg.id);
    const initial = isOpen ? seg.items : seg.items.slice(0, 10);
    return `
      <div class="mk-cat-card ${isOpen ? 'is-open' : ''}" data-seg-id="work-${seg.id}">
        <button class="mk-cat-card-head" onclick="window.togglePharmaCatExpanded('work-${seg.id}')">
          <span class="mk-cat-card-accent" style="background:${seg.accent}"></span>
          <div class="mk-cat-card-titles">
            <div class="mk-cat-card-name">${seg.emoji} ${seg.label} <span class="mk-cat-card-cap">Top ${Math.min(seg.totalCount, seg.cap)}</span></div>
            <div class="mk-cat-card-meta">${seg.totalCount} produits IP non commandés · ${_fmtNum(seg.totalIpQty)} u marché à conquérir</div>
          </div>
          <div class="mk-cat-card-stats">
            <div class="mk-cat-stat"><span class="mk-cat-stat-v">${_fmtNum(seg.totalIpQty)}</span><span class="mk-cat-stat-k">vol marché IP</span></div>
            ${seg.totalAmeli > 0 ? `<div class="mk-cat-stat"><span class="mk-cat-stat-v">${_fmtNum(seg.totalAmeli)}</span><span class="mk-cat-stat-k">vol Ameli</span></div>` : ''}
          </div>
          <svg class="mk-cat-card-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="mk-cat-card-body">
          <table class="mk-cat-table">
            <thead><tr><th>#</th><th>Produit</th><th>CIP13</th><th class="mk-cat-num-h">Prix net</th><th class="mk-cat-num-h">Vol marché IP</th><th class="mk-cat-num-h">Vol Ameli</th><th></th></tr></thead>
            <tbody>${initial.map(workRowHtml).join('')}</tbody>
          </table>
        </div>
      </div>
    `;
  };

  return `
    ${bestCats.length ? `
    <div class="mk-section mk-cat-section" style="margin-top:32px">
      <div class="mk-section-head" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div>
          <div class="mk-section-title">🏆 Best produits · ce que cette pharmacie cartonne déjà</div>
          <div class="mk-section-sub">${bestCats.length} catégories actives · top ${bestCats.reduce((s, c) => s + c.cap, 0).toLocaleString('fr-FR')} produits triés par CA décroissant</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0">
          <button class="a-btn a-btn-filled" onclick="window.exportPharmaPeerRecsPDF('${pharma.id}')" style="white-space:nowrap;background:linear-gradient(135deg,#0057FF 0%,#003BB0 100%);color:#fff" title="Génère immédiatement un PDF de fiche RDV sur mesure basé sur ce que les peers commandent">
            🎯 Fiche RDV opportunités
          </button>
          <button class="a-btn a-btn-tinted" onclick="window.exportPharmaListingPDF('${pharma.id}')" style="white-space:nowrap" title="PDF listing complet (Best + À travailler)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Listing PDF
          </button>
        </div>
      </div>
      <div class="mk-cat-list">${bestCats.map(bestCardHtml).join('')}</div>
    </div>
    ` : ''}

    ${workCats.length ? `
    <div class="mk-section mk-cat-section" style="margin-top:32px">
      <div class="mk-section-head">
        <div>
          <div class="mk-section-title">🎯 À travailler · opportunités par catégorie</div>
          <div class="mk-section-sub">${workCats.length} catégories d'opportunités · top ${workCats.reduce((s, c) => s + c.cap, 0).toLocaleString('fr-FR')} produits IP non commandés par cette pharmacie · cliquer + pour ajouter à la fiche en cours</div>
        </div>
      </div>
      <div class="mk-cat-list">${workCats.map(workCardHtml).join('')}</div>
    </div>
    ` : ''}
  `;
}

/**
 * Génère le PDF du listing pharmacie (Best + À travailler + Marge MDL).
 * Lazy-load html2pdf.js si nécessaire.
 */
/**
 * Génère un PDF "Fiche RDV opportunités" basé sur les peer recommendations.
 * = ce que les pharmacies similaires commandent et que cette pharma ne commande pas.
 * Direct PDF, pas via éditeur Marketing : pour utilisation pendant le RDV.
 */
window.exportPharmaPeerRecsPDF = function (pharmacyId) {
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) { showToast && showToast('Pharmacie introuvable', 'error'); return; }
  const allPhSales = getSales({ pharmacyId: pharma.id });
  if (!allPhSales.length) {
    showToast && showToast('Pas encore de ventes pour cette pharmacie', 'warning');
    return;
  }
  const peers = findPeerPharmacies(pharma);
  if (peers.length < 2) {
    showToast && showToast('Pas assez de peers identifiés pour cette pharma', 'warning');
    return;
  }
  const recs = buildPeerRecommendations(pharma, peers, allPhSales);
  if (recs.length === 0) {
    showToast && showToast('Cette pharma commande déjà tous les top produits de ses peers', 'info');
    return;
  }
  const segments = segmentPeerRecommendations(recs).filter(s => s.items.length > 0);
  if (segments.length === 0) {
    showToast && showToast('Aucune opportunité par catégorie', 'info');
    return;
  }
  if (typeof window.ensureHtml2Pdf !== 'function') {
    alert('Module PDF non disponible. Recharge la page.');
    return;
  }
  showToast && showToast('Génération de la fiche RDV…', 'info');
  window.ensureHtml2Pdf().then(() => {
    const html = buildPharmaPeerRecsPdfHTML(pharma, peers, segments, recs, allPhSales);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:Inter,system-ui,sans-serif;color:#0E0E10';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    const filename = `OpportunitesRDV-${pharma.name.replace(/[^A-Za-z0-9-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    window.html2pdf().from(wrap).set({
      filename,
      margin: [10, 10, 12, 10],
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }).save().then(() => {
      document.body.removeChild(wrap);
      showToast && showToast('✓ Fiche RDV téléchargée', 'success');
    }).catch(err => {
      console.error(err);
      document.body.removeChild(wrap);
      showToast && showToast('Erreur génération PDF', 'error');
    });
  });
};

function buildPharmaPeerRecsPdfHTML(pharma, peers, segments, recs, allPhSales) {
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const clientInfo = typeof CLIENTS !== 'undefined'
    ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === pharma.name.toUpperCase().trim())
    : null;
  const adresseTxt = clientInfo && clientInfo.adresse
    ? `${clientInfo.adresse}, ${clientInfo.cp || ''} ${clientInfo.ville || ''}` : '';
  // Calcul d'un "potentiel CA" : pour chaque produit reco, qte moyenne peer × prix
  const potentielCa = recs.reduce((s, r) => s + (r.avg_qte || 0) * (r.puNet || 0), 0);
  // Estimation marge MDL si IP capture (sur remboursables seulement)
  const potentielMargeMDL = recs.reduce((s, r) => {
    if (isMdlRemboursable(r.cip) && r.puNet > 0) {
      return s + calcMargeBoiteMDL(r.puNet) * (r.avg_qte || 0);
    }
    return s;
  }, 0);
  // Identifie source des peers (groupement WML ou CA proche)
  const sourceLabel = (() => {
    const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const wmlVis = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
    const mine = wmlVis.find(d => nn(d.nom) === nn(pharma.name));
    if (mine && mine.groupement) return 'groupement ' + mine.groupement;
    return 'pharmacies de CA similaire';
  })();

  const segRow = (r, i) => `
    <tr>
      <td style="padding:6px 7px;text-align:center;color:#71717A;font-size:9px;font-family:'SF Mono',Menlo,monospace">${i + 1}</td>
      <td style="padding:6px 7px;font-size:10px;font-weight:600;color:#0A1F4E">${(r.designation || '').slice(0, 50).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>
      <td style="padding:6px 7px;font-family:'SF Mono',Menlo,monospace;font-size:9px;color:#5B6478">${r.cip}</td>
      <td style="padding:6px 7px;text-align:right;font-family:'SF Mono',Menlo,monospace;font-size:10px;color:#0E0E10">${r.puNet > 0 ? r.puNet.toFixed(2) + ' €' : '—'}</td>
      <td style="padding:6px 7px;text-align:center;font-family:'SF Mono',Menlo,monospace;font-size:10px;font-weight:700;color:${r.pct_peers >= 0.6 ? '#10B981' : r.pct_peers >= 0.3 ? '#FF9500' : '#71717A'}">${Math.round(r.pct_peers * 100)}%</td>
      <td style="padding:6px 7px;text-align:right;font-family:'SF Mono',Menlo,monospace;font-size:10px;color:#0E0E10">${Math.round(r.avg_qte).toLocaleString('fr-FR')}</td>
    </tr>
  `;
  const segHtml = segments.map(seg => `
    <div style="margin-bottom:16px;page-break-inside:avoid">
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:linear-gradient(90deg, ${seg.accent}22 0%, transparent 100%);border-left:4px solid ${seg.accent};border-radius:6px;margin-bottom:8px">
        <div style="font-size:13px;font-weight:700;color:#0A1F4E;letter-spacing:-0.01em">${seg.name}</div>
        <div style="font-size:9px;color:#71717A;margin-left:auto;font-family:'SF Mono',Menlo,monospace">${seg.totalCount} produits · ${Math.round(seg.avgPctPeers * 100)}% des peers en moyenne</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#F2F2F7;border-bottom:1px solid #E5E7EB">
            <th style="padding:6px 7px;font-size:8px;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;text-align:center;font-weight:700">#</th>
            <th style="padding:6px 7px;font-size:8px;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;text-align:left;font-weight:700">Produit</th>
            <th style="padding:6px 7px;font-size:8px;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;text-align:left;font-weight:700">CIP13</th>
            <th style="padding:6px 7px;font-size:8px;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;text-align:right;font-weight:700">Prix net</th>
            <th style="padding:6px 7px;font-size:8px;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;text-align:center;font-weight:700">% Peers</th>
            <th style="padding:6px 7px;font-size:8px;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;text-align:right;font-weight:700">Qté moy.</th>
          </tr>
        </thead>
        <tbody>${seg.items.slice(0, 10).map(segRow).join('')}</tbody>
      </table>
    </div>
  `).join('');

  return `
    <div style="padding:14px 18px;font-family:Inter,system-ui,sans-serif;color:#0E0E10">
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #0057FF;padding-bottom:10px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#0057FF 0%,#003BB0 100%);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;letter-spacing:0.02em">IP</div>
          <div>
            <div style="font-size:9px;color:#71717A;text-transform:uppercase;letter-spacing:0.08em;font-weight:700">Intégral Pharma · Fiche RDV sur mesure</div>
            <div style="font-size:18px;font-weight:800;color:#0A1F4E;letter-spacing:-0.01em">${(pharma.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
            ${adresseTxt ? `<div style="font-size:10px;color:#5B6478">${adresseTxt.replace(/</g, '&lt;')}</div>` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.04em;font-weight:700">Édité le</div>
          <div style="font-size:13px;font-weight:700;color:#0A1F4E;font-family:'SF Mono',Menlo,monospace">${today}</div>
        </div>
      </div>

      <!-- Intro pitch -->
      <div style="background:linear-gradient(135deg,#0057FF 0%,#0070FF 100%);color:#fff;padding:14px 18px;border-radius:10px;margin-bottom:14px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;opacity:0.85;margin-bottom:4px">🎁 Sélection sur mesure</div>
        <div style="font-size:14px;font-weight:600;line-height:1.4">${peers.length} pharmacies similaires (${sourceLabel}) commandent <strong>${recs.length} produits</strong> que vous ne commandez pas encore.</div>
        <div style="font-size:11px;line-height:1.45;margin-top:6px;opacity:0.92">Cette sélection est <strong>spécifiquement calibrée</strong> pour votre profil d'officine. Les % indiquent la fréquence avec laquelle vos peers commandent chaque référence.</div>
      </div>

      <!-- KPIs Potentiel -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
        <div style="border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px">
          <div style="font-size:8px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;font-weight:700">Potentiel CA estimé</div>
          <div style="font-size:18px;font-weight:800;color:#0057FF;font-family:'SF Mono',Menlo,monospace">${Math.round(potentielCa).toLocaleString('fr-FR')} €</div>
          <div style="font-size:9px;color:#5B6478;margin-top:2px">Si vous capturez ces opportunités</div>
        </div>
        <div style="border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px">
          <div style="font-size:8px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;font-weight:700">Marge MDL prévisionnelle</div>
          <div style="font-size:18px;font-weight:800;color:#10B981;font-family:'SF Mono',Menlo,monospace">${Math.round(potentielMargeMDL).toLocaleString('fr-FR')} €</div>
          <div style="font-size:9px;color:#5B6478;margin-top:2px">Barème officiel France 2026</div>
        </div>
        <div style="border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px">
          <div style="font-size:8px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;font-weight:700">Catégories</div>
          <div style="font-size:18px;font-weight:800;color:#FF9500;font-family:'SF Mono',Menlo,monospace">${segments.length}</div>
          <div style="font-size:9px;color:#5B6478;margin-top:2px">${recs.length} références à pousser</div>
        </div>
      </div>

      <!-- Liste segments -->
      ${segHtml}

      <!-- Footer -->
      <div style="margin-top:18px;padding-top:8px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;font-size:8px;color:#71717A;letter-spacing:0.04em;text-transform:uppercase">
        <div>Intégral Pharma · Normandie · Fiche confidentielle</div>
        <div>Barème MDL : 0,18€ &lt; 4,33€ · 3,9 % jusqu'à 468€ · 19,50€ au-delà</div>
      </div>
    </div>
  `;
}

window.exportPharmaListingPDF = function (pharmacyId) {
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) { showToast && showToast('Pharmacie introuvable', 'error'); return; }
  const allPhSales = getSales({ pharmacyId: pharma.id });
  if (!allPhSales.length) {
    showToast && showToast('Pas encore de ventes pour générer le listing', 'warning');
    return;
  }
  if (typeof window.ensureHtml2Pdf !== 'function') {
    alert('Module PDF non disponible. Recharge la page.');
    return;
  }
  showToast && showToast('Génération du PDF en cours…', 'info');
  window.ensureHtml2Pdf().then(() => {
    const html = buildPharmaListingPdfHTML(pharma, allPhSales);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:Inter,system-ui,sans-serif;color:#0E0E10';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    const filename = `Listing-${pharma.name.replace(/[^A-Za-z0-9-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    window.html2pdf().from(wrap).set({
      filename,
      margin: [10, 10, 12, 10],
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }).save().then(() => {
      document.body.removeChild(wrap);
      showToast && showToast('✓ PDF téléchargé', 'success');
    }).catch(err => {
      console.error(err);
      document.body.removeChild(wrap);
      showToast && showToast('Erreur génération PDF', 'error');
    });
  });
};

function buildPharmaListingPdfHTML(pharma, allPhSales) {
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const bestCats = bestProductsByCategoryForPharma(allPhSales).filter(s => s.items.length > 0);
  const orderedCipsSet = new Set(allPhSales.map(s => String(s.artCode || '')).filter(c => c.length >= 7));
  const workCats = workProductsByCategoryForPharma(orderedCipsSet).filter(s => s.items.length > 0);
  const mdl = sumMargeMDL(allPhSales);
  const clientInfo = typeof CLIENTS !== 'undefined'
    ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === pharma.name.toUpperCase().trim())
    : null;
  const adresseTxt = clientInfo && clientInfo.adresse
    ? `${clientInfo.adresse}, ${clientInfo.cp || ''} ${clientInfo.ville || ''}` : '';

  const bestRow = (r, i) => `
    <tr>
      <td style="padding:5px 6px;text-align:center;color:#71717A;font-size:9px">${i + 1}</td>
      <td style="padding:5px 6px;font-size:10px;font-weight:500">${(r.designation || '').slice(0, 50).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>
      <td style="padding:5px 6px;font-family:'SF Mono',Menlo,monospace;font-size:9px;color:#5B6478">${r.cip}</td>
      <td style="padding:5px 6px;text-align:right;font-family:'SF Mono',Menlo,monospace;font-size:10px">${r.puNet > 0 ? r.puNet.toFixed(2) + ' €' : '—'}</td>
      <td style="padding:5px 6px;text-align:right;font-family:'SF Mono',Menlo,monospace;font-size:10px">${_fmtNum(r.qte)}</td>
      <td style="padding:5px 6px;text-align:right;font-family:'SF Mono',Menlo,monospace;font-size:10px;font-weight:600">${_fmtEur(r.ca)}</td>
      <td style="padding:5px 6px;text-align:right;font-family:'SF Mono',Menlo,monospace;font-size:10px;color:${r.margeMDL != null ? '#10B981' : '#71717A'}">${r.margeMDL != null ? _fmtEur(r.margeMDL) : 'libre'}</td>
    </tr>
  `;
  const workRow = (r, i) => `
    <tr>
      <td style="padding:5px 6px;text-align:center;color:#71717A;font-size:9px">${i + 1}</td>
      <td style="padding:5px 6px;font-size:10px;font-weight:500">${(r.designation || '').slice(0, 50).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>
      <td style="padding:5px 6px;font-family:'SF Mono',Menlo,monospace;font-size:9px;color:#5B6478">${r.cip}</td>
      <td style="padding:5px 6px;text-align:right;font-family:'SF Mono',Menlo,monospace;font-size:10px">${r.puNet > 0 ? r.puNet.toFixed(2) + ' €' : '—'}</td>
      <td style="padding:5px 6px;text-align:right;font-family:'SF Mono',Menlo,monospace;font-size:10px;font-weight:600">${_fmtNum(r.ip_qty)}</td>
    </tr>
  `;
  const bestSection = bestCats.map(seg => `
    <div style="margin-bottom:14px;page-break-inside:avoid">
      <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:linear-gradient(90deg, ${seg.accent}22 0%, transparent 100%);border-left:3px solid ${seg.accent};border-radius:4px;margin-bottom:6px">
        <div style="font-size:12px;font-weight:700;color:#0A1F4E">${seg.emoji} ${seg.label}</div>
        <div style="font-size:9px;color:#71717A;margin-left:auto;font-family:'SF Mono',Menlo,monospace">${seg.totalCount} produits · ${_fmtEur(seg.totalCa)} CA · ${seg.totalMargeMDL > 0 ? _fmtEur(seg.totalMargeMDL) + ' marge' : 'marge libre'}</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#F2F2F7">
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:center;font-weight:600">#</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:left;font-weight:600">Produit</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:left;font-weight:600">CIP13</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:right;font-weight:600">Prix net</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:right;font-weight:600">Qté</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:right;font-weight:600">CA</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:right;font-weight:600">Marge</th>
          </tr>
        </thead>
        <tbody>${seg.items.map(bestRow).join('')}</tbody>
      </table>
    </div>
  `).join('');
  const workSection = workCats.map(seg => `
    <div style="margin-bottom:14px;page-break-inside:avoid">
      <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:linear-gradient(90deg, ${seg.accent}22 0%, transparent 100%);border-left:3px solid ${seg.accent};border-radius:4px;margin-bottom:6px">
        <div style="font-size:12px;font-weight:700;color:#0A1F4E">${seg.emoji} ${seg.label}</div>
        <div style="font-size:9px;color:#71717A;margin-left:auto;font-family:'SF Mono',Menlo,monospace">${seg.totalCount} opportunités · ${_fmtNum(seg.totalIpQty)} u marché IP</div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#F2F2F7">
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:center;font-weight:600">#</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:left;font-weight:600">Produit</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:left;font-weight:600">CIP13</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:right;font-weight:600">Prix net</th>
            <th style="padding:5px 6px;font-size:8px;letter-spacing:0.04em;text-transform:uppercase;color:#71717A;text-align:right;font-weight:600">Vol marché IP</th>
          </tr>
        </thead>
        <tbody>${seg.items.map(workRow).join('')}</tbody>
      </table>
    </div>
  `).join('');

  return `
    <div style="padding:14px 18px;font-family:Inter,system-ui,sans-serif;color:#0E0E10">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0057FF;padding-bottom:10px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#0057FF 0%,#003BB0 100%);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;letter-spacing:0.02em">IP</div>
          <div>
            <div style="font-size:9px;color:#71717A;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Intégral Pharma · Listing personnalisé</div>
            <div style="font-size:18px;font-weight:700;color:#0A1F4E;letter-spacing:-0.01em">${(pharma.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
            ${adresseTxt ? `<div style="font-size:10px;color:#5B6478">${adresseTxt.replace(/</g, '&lt;')}</div>` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#71717A;text-transform:uppercase;letter-spacing:0.04em;font-weight:600">Édité le</div>
          <div style="font-size:13px;font-weight:600;color:#0A1F4E;font-family:'SF Mono',Menlo,monospace">${today}</div>
        </div>
      </div>
      <!-- KPIs Marge MDL -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px">
        <div style="border:1px solid #E5E7EB;border-radius:8px;padding:8px 10px">
          <div style="font-size:8px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">CA total IP</div>
          <div style="font-size:18px;font-weight:700;color:#0057FF;font-family:'SF Mono',Menlo,monospace">${_fmtEur(mdl.caRembHT + mdl.caNrHT)}</div>
        </div>
        <div style="border:1px solid #E5E7EB;border-radius:8px;padding:8px 10px">
          <div style="font-size:8px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Marge MDL générée</div>
          <div style="font-size:18px;font-weight:700;color:#10B981;font-family:'SF Mono',Menlo,monospace">${_fmtEur(mdl.margeTotale)}</div>
          <div style="font-size:9px;color:#5B6478;margin-top:2px">${mdl.margePct.toFixed(2)}% du CA remb.</div>
        </div>
        <div style="border:1px solid #E5E7EB;border-radius:8px;padding:8px 10px">
          <div style="font-size:8px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">CA Non remboursés</div>
          <div style="font-size:18px;font-weight:700;color:#F59E0B;font-family:'SF Mono',Menlo,monospace">${_fmtEur(mdl.caNrHT)}</div>
          <div style="font-size:9px;color:#5B6478;margin-top:2px">Marge libre (PLM)</div>
        </div>
      </div>
      <!-- BEST PRODUITS -->
      <div style="margin-bottom:18px">
        <h2 style="font-size:14px;font-weight:700;color:#0A1F4E;margin:0 0 8px;letter-spacing:-0.01em;border-bottom:1px solid #E5E7EB;padding-bottom:4px">🏆 Best produits · top ${bestCats.reduce((s, c) => s + c.cap, 0)} commandes par catégorie</h2>
        ${bestSection}
      </div>
      <!-- À TRAVAILLER -->
      <div>
        <h2 style="font-size:14px;font-weight:700;color:#0A1F4E;margin:0 0 8px;letter-spacing:-0.01em;border-bottom:1px solid #E5E7EB;padding-bottom:4px">🎯 À travailler · top ${workCats.reduce((s, c) => s + c.cap, 0)} opportunités catalogue IP</h2>
        ${workSection}
      </div>
      <!-- Footer -->
      <div style="margin-top:18px;padding-top:8px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;font-size:8px;color:#71717A;letter-spacing:0.04em;text-transform:uppercase">
        <div>Intégral Pharma · Normandie · Listing confidentiel</div>
        <div>Barème MDL : 0,18€ &lt; 4,33€ · 3,9 % jusqu'à 468€ · 19,50€ au-delà</div>
      </div>
    </div>
  `;
}

// ── Tabs internes fiche pharmacie (refonte Apple HIG : 5 onglets sticky) ─────
let __pharmaTab = (() => {
  try {
    const v = localStorage.getItem('a-pharma-last-tab');
    return ['overview','best','opp','history','notes'].includes(v) ? v : 'overview';
  } catch { return 'overview'; }
})();
let __pharmaTabLastPharmaId = null;
window.__pharmaSwitchTab = function(tab) {
  if (!['overview','best','opp','history','notes'].includes(tab)) return;
  __pharmaTab = tab;
  try { localStorage.setItem('a-pharma-last-tab', tab); } catch {}
  if (window.__currentPharmaId) showPharmaDetail(window.__currentPharmaId);
};

// Injection styles tabs (une seule fois)
function __ensurePharmaTabsStyles() {
  if (document.getElementById('a-pharma-tabs-style')) return;
  const s = document.createElement('style');
  s.id = 'a-pharma-tabs-style';
  s.textContent = `
  .a-pharma-tabs { display:flex; gap:4px; padding:0 16px; border-bottom:0.5px solid var(--separator-non-opaque,rgba(60,60,67,.12));
    background:var(--material-bg-light,rgba(255,255,255,.72)); backdrop-filter:blur(20px) saturate(180%); -webkit-backdrop-filter:blur(20px) saturate(180%);
    position:sticky; top:96px; z-index:20; margin:0 -16px 24px; overflow-x:auto; scrollbar-width:none; }
  .a-pharma-tabs::-webkit-scrollbar { display:none; }
  .a-pharma-tab { height:40px; padding:0 14px; background:transparent; border:none;
    font:500 13px/18px var(--font-text,'Inter',system-ui,sans-serif); color:var(--label-secondary,#5B6478);
    cursor:pointer; position:relative; white-space:nowrap;
    transition:color var(--dur-quick,160ms) var(--ease-standard,cubic-bezier(.4,0,.2,1)); }
  .a-pharma-tab:hover { color:var(--label-primary,#0B1220); }
  .a-pharma-tab.is-active { color:var(--label-primary,#0B1220); font-weight:600; }
  .a-pharma-tab.is-active::after { content:''; position:absolute; left:14px; right:14px; bottom:-1px;
    height:2px; background:var(--accent,#0057FF); border-radius:2px;
    animation:aTabUnderline 240ms cubic-bezier(.22,1,.36,1); }
  @keyframes aTabUnderline { from { transform:scaleX(0); opacity:0; } to { transform:scaleX(1); opacity:1; } }
  .a-pharma-panel { animation:aTabFade 180ms ease-out; }
  @keyframes aTabFade { from { opacity:0; transform:translateY(2px); } to { opacity:1; transform:translateY(0); } }
  @media (max-width:1024px) { .a-pharma-tabs { top:64px; } }
  `;
  document.head.appendChild(s);
}

function showPharmaDetail(pharmacyId, overridePeriod) {
  if (overridePeriod !== undefined) pharmaDetailOverridePeriod = overridePeriod;
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) return;
  // Réinitialise sur 'overview' si on change de pharmacie
  if (__pharmaTabLastPharmaId && __pharmaTabLastPharmaId !== String(pharma.id)) {
    __pharmaTab = 'overview';
    try { localStorage.setItem('a-pharma-last-tab', 'overview'); } catch {}
  }
  __pharmaTabLastPharmaId = String(pharma.id);
  window.__currentPharmaId = pharma.id;
  __ensurePharmaTabsStyles();

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
  // ── Marge MDL France (officielle, médicaments remboursables uniquement) ──
  // Barème : 0-4,33€ → 0,18€/boîte | 4,33-468€ → 3,9% | >468€ → 19,50€/boîte
  const mdlCur  = sumMargeMDL(salesCur);
  const mdlPrev = sumMargeMDL(salesPrev);
  const mdlAll  = sumMargeMDL(allPhSales);
  const mdlDeltaPct = mdlPrev.margeTotale > 0 ? ((mdlCur.margeTotale - mdlPrev.margeTotale) / mdlPrev.margeTotale) * 100 : null;

  // ── WML groupement data for this pharmacy ────────
  const wmlVisDet = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
  const nnWmlDet = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const wmlEntDet = wmlVisDet.find(d => nnWmlDet(d.nom) === nnWmlDet(pharma.name)) || null;

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

  // ── YTD pharmacie ──────────────────────────────
  const pharmaYTD = curY ? allPhSales.filter(s => s.year === curY && s.month <= curM).reduce((a,s) => a + s.mntNetHt, 0) : 0;
  const pharmaYTDprev = curY ? allPhSales.filter(s => s.year === curY - 1 && s.month <= curM).reduce((a,s) => a + s.mntNetHt, 0) : 0;

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

  // ── Chips groupements NP (Pelgraz / Pelmeg / Ecodage / grossistes) ──
  const groupChipsHtml = clientInfo ? (() => {
    const chips = [];
    const pg = parseInt(clientInfo.pelgraz || 0, 10);
    const pm = parseInt(clientInfo.pelmeg  || 0, 10);
    const ec = parseInt(clientInfo.ecodage || 0, 10);
    if (pg > 0) chips.push(`<span class="np-hero-chip">💊 Pelgraz ×${pg}</span>`);
    if (pm > 0) chips.push(`<span class="np-hero-chip">💊 Pelmeg ×${pm}</span>`);
    if (ec > 0) chips.push(`<span class="np-hero-chip">🏷 Ecodage ×${ec}</span>`);
    if (clientInfo.gros1) chips.push(`<span class="np-hero-chip">📦 ${clientInfo.gros1}${clientInfo.gros2 ? ' · '+clientInfo.gros2 : ''}</span>`);
    if (clientInfo.cip) chips.push(`<span class="np-hero-chip">CIP ${clientInfo.cip}</span>`);
    return chips.join('');
  })() : '';

  // ── Période selector ─────────────────────────────
  const periodSelectHtml = availPeriods.length > 1
    ? `<select onchange="showPharmaDetail('${pharma.id}',this.value==='auto'?null:{year:+this.value.split('-')[0],month:+this.value.split('-')[1]})"
        style="padding:6px 12px;border-radius:14px;border:1.5px solid rgba(255,255,255,.35);background:rgba(255,255,255,.15);font-size:12px;color:#fff;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;backdrop-filter:blur(4px)">
        ${availPeriods.map(p => {
          const [y, m] = p.split('-');
          const sel = +y === curY && +m === curM;
          return `<option style="color:#1f2937" value="${p}" ${sel ? 'selected' : ''}>${monthName(+m)} ${y}</option>`;
        }).join('')}
      </select>`
    : `<span class="np-hero-chip">${monthName(curM)} ${curY}</span>`;

  // Opportunités : CIPs déjà commandés par cette pharmacie (toutes périodes confondues)
  const __orderedCipsSet = new Set(
    allPhSales.map(s => String(s.artCode || '')).filter(c => c.length >= 7)
  );
  // (A) Vraies opportunités : IP absent + OPS/HP/CPR vendent + pharma ne commande pas
  const __opsOpportunitiesHTML = typeof window.renderOpsOpportunitiesHTML === 'function'
    ? window.renderOpsOpportunitiesHTML(
        __orderedCipsSet,
        '🚀 Vraies opportunités · IP absent + cette pharmacie ne commande pas',
        'Produits vendus chez les concurrents grossistes (OPS+CPR+HP), absents du catalogue IP, et que cette pharmacie ne commande pas non plus. La double opportunité : élargir le catalogue IP ET pénétrer cette pharmacie.'
      )
    : '';
  // (B) Opportunités au catalogue IP : produits IP top ventes que cette pharmacie ne commande pas
  const __catalogueGapsHTML = typeof window.renderTopVentesSegmentsForPharmaHTML === 'function'
    ? window.renderTopVentesSegmentsForPharmaHTML(
        __orderedCipsSet,
        '🎯 Trous catalogue · top IP que cette pharmacie ne commande pas',
        'Produits IP top ventes (déjà au catalogue grossiste) que cette pharmacie ne commande pas encore. Action commerciale directe : pousser ces références.'
      )
    : '';
  // (C) Sur mesure : ce que ses peers commandent et qu'elle ne commande pas
  // Wrappers safe : si une fonction crash, on log et on continue avec ''
  function __safeRender(fn, label) {
    try { return fn() || ''; }
    catch (e) {
      console.error('[showPharmaDetail] ' + label + ' crashed:', e);
      return '<div class="card" style="padding:14px;margin-top:20px;border-left:3px solid #FF3B30;background:#FFF5F5"><div style="font-weight:700;color:#B7281E;font-size:13px">⚠️ Section "' + label + '" en erreur</div><div style="font-size:11px;color:#5B6478;margin-top:4px">' + (e && e.message ? e.message : 'Erreur inconnue') + ' — recharge la page (⌘+Shift+R)</div></div>';
    }
  }
  const __peerRecsHTML = __safeRender(() => renderPeerRecommendationsHTML(pharma, allPhSales), 'Sur mesure (peers)');
  // (D) Best produits + À travailler par catégorie (avec bouton PDF)
  const __bestWorkHTML = __safeRender(() => renderBestAndWorkSectionsHTML(pharma, allPhSales), 'Best produits + À travailler');
  const __opportunitiesHTML = __bestWorkHTML + __peerRecsHTML + __opsOpportunitiesHTML + __catalogueGapsHTML;
  // Bandeau version retiré (bug fixé). Console log reste pour debug optionnel.
  const __versionBadge = '';
  try { console.log('[showPharmaDetail] pharma=' + pharma.name + ' sales=' + allPhSales.length); } catch(e){}

  // ── HTML : header (back + hero + actions) — toujours visible ──────────
  const __headerHtml = `

      ${__versionBadge}

      <!-- Bouton retour officines (règle UX Will) -->
      <div style="margin-bottom:14px">
        <button class="np-back-btn" onclick="pharmaDetailOverridePeriod=null;renderPharmacies()">Toutes mes officines</button>
      </div>

      <!-- Hero header Intégral Pharma -->
      <div class="np-hero">
        <div class="np-hero-row">
          <div style="width:54px;height:54px;border-radius:14px;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.32);display:flex;align-items:center;justify-content:center;flex-shrink:0" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <h1 class="np-hero-title">${pharma.name}</h1>
            ${clientInfo?.adresse || clientInfo?.ville
              ? `<div class="np-hero-sub">${clientInfo.adresse || ''}${clientInfo.adresse && (clientInfo.cp || clientInfo.ville) ? ' · ' : ''}${clientInfo.cp || ''} ${clientInfo.ville || ''}</div>`
              : ''}
            <div class="np-hero-tagline">Fiche pharmacie</div>
          </div>
          ${periodSelectHtml}
        </div>
        ${groupChipsHtml ? `<div class="np-hero-chips">${groupChipsHtml}</div>` : ''}
      </div>

      <!-- Actions rapides -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="prodPharmaFilter='${pharma.id}';navigate('produits')" style="font-size:12px">📊 Produits</button>
        <button class="btn btn-ghost" onclick="showFicheVisite('${pharma.id}')" style="font-size:12px">📋 Fiche de visite</button>
        <button class="btn btn-ghost" onclick="generateEmailModal('${pharma.id}')" style="font-size:12px">✉ Email pharmacien</button>
        <button class="btn btn-ghost" onclick="proposerCommande('${pharma.id}')" style="font-size:12px">🛒 Commander</button>
        ${clientInfo?.adresse ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((clientInfo.adresse||'')+' '+(clientInfo.cp||'')+' '+(clientInfo.ville||''))}" target="_blank" rel="noopener" class="btn btn-ghost" style="font-size:12px;text-decoration:none">🧭 Itinéraire</a>` : ''}
        <button class="btn btn-ghost" onclick="exportPharmacyCSV('${pharma.id}')" style="font-size:12px">⬇ CSV</button>
        <button class="btn btn-ghost" onclick="showNextVisitPicker('${pharma.id}')" style="font-size:12px" title="Planifier prochaine visite">📅 Planifier</button>
        <button class="btn btn-ghost" style="color:var(--np-pink);border-color:rgba(230,33,118,.3)" onclick="deletePharmacy('${pharma.id}')">🗑</button>
      </div>
  `;

  // ── HTML : KPIs grid (overview) ──────────
  const __kpisHtml = `
      <!-- Row 1 : Hero + KPIs -->
      <div class="kpi-grid fade-up" style="grid-template-columns:2fr 1fr 1fr 1fr;margin-bottom:20px">
        <div class="kpi-card" style="background:linear-gradient(135deg,#0B1F4D 0%,#0041CC 55%,#0057FF 100%);box-shadow:0 14px 40px rgba(0,87,255,.30),0 4px 12px rgba(0,87,255,.16);border:none;color:#fff">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.78);margin-bottom:6px">CA Intégral Pharma — ${curLabel}</div>
          <div style="font-size:34px;font-weight:800;letter-spacing:-1px;font-family:'DM Sans',sans-serif;color:#fff">${fmt(caCur)}</div>
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
  `;

  // ── HTML : Marge MDL card (overview) ──────────
  const __mdlHtml = `
      <!-- Marge MDL pharmacie (officielle France, médicaments remboursables uniquement) -->
      <div class="card fade-up" style="margin-bottom:20px;border-left:3px solid var(--mint);padding:14px 18px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--mint);font-weight:700;text-transform:uppercase;letter-spacing:.06em">💰 Marge MDL pharmacie · ${curLabel}</div>
          <div style="font-size:10px;color:var(--text3)">Barème officiel France · 0,18€ &lt;4,33€ · 3,9% jusqu'à 468€ · 19,50€ au-delà</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px">
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:4px">Marge MDL générée</div>
            <div style="font-family:'Geist Mono',monospace;font-size:24px;font-weight:700;color:var(--mint);font-variant-numeric:tabular-nums">${fmt(mdlCur.margeTotale)}</div>
            ${mdlDeltaPct !== null ? `<div style="font-size:11px;font-weight:600;color:${mdlDeltaPct >= 0 ? 'var(--mint)' : 'var(--rose)'};margin-top:2px">${mdlDeltaPct >= 0 ? '↑' : '↓'} ${Math.abs(mdlDeltaPct).toFixed(1)}% vs ${prevLabel}</div>` : ''}
          </div>
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:4px">Taux marge / CA remb.</div>
            <div style="font-family:'Geist Mono',monospace;font-size:24px;font-weight:700;color:var(--blue);font-variant-numeric:tabular-nums">${mdlCur.margePct.toFixed(2)}<span style="font-size:14px">%</span></div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${fmt(mdlCur.caRembHT)} CA remb. ${curLabel}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:4px">CA NR · marge libre</div>
            <div style="font-family:'Geist Mono',monospace;font-size:24px;font-weight:700;color:var(--amber);font-variant-numeric:tabular-nums">${fmt(mdlCur.caNrHT)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">Non remboursés · politique pharma</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:4px">Marge MDL cumulée</div>
            <div style="font-family:'Geist Mono',monospace;font-size:24px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums">${fmt(mdlAll.margeTotale)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">Toutes périodes · ${mdlAll.margePct.toFixed(2)}%</div>
          </div>
        </div>
      </div>
  `;

  // ── HTML : Infos client (overview) ──────────
  const __clientInfoHtml = `
      <!-- Info client (CLIENTS data) -->
      ${clientInfo ? `
      <div class="card fade-up" style="margin-bottom:20px;border-left:3px solid ${pharma.color}">
        <div class="card-header" style="padding:12px 16px">
          <div class="card-title" style="font-size:13px">Informations client</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0;border-top:1px solid var(--border1)">
          ${clientInfo.adresse ? `<div style="padding:10px 16px;flex:1;min-width:160px;border-right:1px solid var(--border1)"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Adresse</div><div style="font-size:12px;font-weight:600">${clientInfo.adresse}</div><div style="font-size:11px;color:var(--text3)">${clientInfo.cp||''} ${clientInfo.ville||''}</div></div>` : ''}
          ${clientInfo.tel ? `<div style="padding:10px 16px;flex:1;min-width:120px;border-right:1px solid var(--border1)"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Téléphone</div><a href="tel:${clientInfo.tel}" style="font-size:12px;font-weight:600;color:var(--blue);text-decoration:none">${clientInfo.tel}</a></div>` : ''}
          ${clientInfo.email ? `<div style="padding:10px 16px;flex:1;min-width:120px;border-right:1px solid var(--border1)"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Email</div><a href="mailto:${clientInfo.email}" style="font-size:12px;font-weight:600;color:var(--blue);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;max-width:180px">${clientInfo.email}</a></div>` : ''}
          ${clientInfo.ca2023 > 0 ? `<div style="padding:10px 16px;flex:1;min-width:120px;border-right:1px solid var(--border1)"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">CA 2023 total</div><div style="font-size:12px;font-weight:600">${fmt(clientInfo.ca2023)}</div></div>` : ''}
          ${clientInfo.gros1 ? `<div style="padding:10px 16px;flex:1;min-width:120px"><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Grossiste</div><div style="font-size:12px;font-weight:600">${clientInfo.gros1}${clientInfo.gros2 ? ' · ' + clientInfo.gros2 : ''}</div></div>` : ''}
        </div>
        ${clientInfo.commentaire && clientInfo.commentaire.trim() ? `
        <div style="padding:10px 16px;border-top:1px solid var(--border1);background:rgba(255,176,32,.04)">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Commentaire</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5">${clientInfo.commentaire}</div>
        </div>` : ''}
      </div>` : ''}
  `;

  // ── HTML : Top produits du mois (history) ──────────
  const __topProdsHtml = `
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
          const escapedLabel = (p.label||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
          return `<div onclick="showProductBreakdown('${escapedLabel}')" style="display:flex;align-items:center;gap:10px;padding:8px 20px;border-bottom:1px solid var(--border1);cursor:pointer;transition:background .1s" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
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
  `;

  // ── HTML : Tendance produits M vs M-1 (history) ──────────
  const __trendHtml = `
      <!-- Tendance produits M vs M-1 -->
      ${salesCur.length && salesPrev.length ? (() => {
        const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g,' ');
        const mapProd = (sales) => {
          const m = {};
          for (const s of sales) {
            const k = nn(s.artDesignation);
            if (!k) continue;
            if (!m[k]) m[k] = { label: s.artDesignation, ca: 0, cat: classifyProduct(s) };
            m[k].ca += s.mntNetHt;
          }
          return m;
        };
        const mapCur  = mapProd(salesCur);
        const mapPrev = mapProd(salesPrev);
        const diffs = Object.keys({ ...mapCur, ...mapPrev }).map(k => ({
          label: mapCur[k]?.label || mapPrev[k]?.label,
          cat:   mapCur[k]?.cat  || mapPrev[k]?.cat || 'mi',
          cur:   mapCur[k]?.ca  || 0,
          prev:  mapPrev[k]?.ca || 0,
          delta: (mapCur[k]?.ca || 0) - (mapPrev[k]?.ca || 0),
        })).filter(d => d.cur > 0 || d.prev > 0);
        const gainers  = diffs.filter(d => d.delta > 0  && d.prev > 0).sort((a,b) => b.delta - a.delta).slice(0,4);
        const losers   = diffs.filter(d => d.delta < 0  && d.prev > 0).sort((a,b) => a.delta - b.delta).slice(0,4);
        const newProds = diffs.filter(d => d.prev === 0 && d.cur > 0).sort((a,b) => b.cur - a.cur).slice(0,3);
        if (!gainers.length && !losers.length) return '';
        const row = (d, color, arrow) => {
          const cat = CATS[d.cat] || CATS.mi;
          const pct = d.prev > 0 ? ((d.delta / d.prev) * 100).toFixed(0) : '';
          return `<div style="display:flex;align-items:center;gap:10px;padding:7px 20px;border-bottom:1px solid var(--border1)">
            <span style="font-size:14px">${arrow}</span>
            <div style="flex:1;min-width:0;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.label}</div>
            <span style="font-size:10px;padding:1px 5px;border-radius:4px;background:${cat.color}18;color:${cat.color};font-weight:600;flex-shrink:0">${cat.icon}</span>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:12px;font-weight:700;color:${color}">${d.delta > 0 ? '+' : ''}${fmt(d.delta)}</div>
              ${pct ? `<div style="font-size:10px;color:${color}">${d.delta > 0 ? '+' : ''}${pct}%</div>` : ''}
            </div>
          </div>`;
        };
        return `<div class="card fade-up" style="margin-bottom:20px">
          <div class="card-header">
            <div class="card-title">Tendance produits ${prevLabel} → ${curLabel}</div>
          </div>
          ${gainers.length ? `<div style="padding:6px 20px 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mint)">En hausse</div>${gainers.map(d => row(d,'var(--mint)','↑')).join('')}` : ''}
          ${losers.length  ? `<div style="padding:6px 20px 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--rose)">En baisse</div>${losers.map(d => row(d,'var(--rose)','↓')).join('')}` : ''}
          ${newProds.length ? `<div style="padding:6px 20px 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--amber)">Nouveaux ce mois</div>${newProds.map(d => row(d,'var(--amber)','★')).join('')}` : ''}
        </div>`;
      })() : ''}
  `;

  // ── HTML : Palier progression CA mensuel (overview) ──────────
  const __palierHtml = `
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
  `;

  // ── HTML : Switch opportunities (opp) ──────────
  const __switchSectionHtml = `
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
  `;

  // ── HTML : Ajout opportunities (opp) ──────────
  const __addSectionHtml = `
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
  `;

  // ── HTML : WML groupement OPSO (overview) ──────────
  const __wmlHtml = `
      <!-- WML groupement card -->
      ${wmlEntDet ? (() => {
        const nnWml2 = s => (s||'').trim().toUpperCase().replace(/\s+/g,' ');
        const directNames2 = new Set(allPhSales.map(s => nnWml2(s.artDesignation)));
        const missedWml = (wmlEntDet.pr||[]).filter(([nom]) => nom && !directNames2.has(nnWml2(nom)));
        const missedCaWml = missedWml.reduce((s,[,ca])=>s+(ca||0),0);
        const wmlAvgMo = wmlEntDet.ca / 4;
        const convPct = wmlAvgMo > 0 ? Math.min(999, Math.round(caCur / wmlAvgMo * 100)) : null;
        const months = ['Jan','Fév','Mar','Avr'];
        const caM = wmlEntDet.ca_m || [];
        return `<div class="card fade-up" style="margin-bottom:20px;border-left:3px solid #14B86A">
          <div class="card-header">
            <div>
              <div class="card-title">📦 Groupement OPSO — Jan–Avr 2026</div>
              <div class="card-subtitle">Achats totaux via WML · taux de conversion en commande directe IP</div>
            </div>
            ${convPct !== null ? `<div style="text-align:right">
              <div style="font-size:22px;font-weight:900;color:${convPct>=80?'var(--mint)':convPct>=40?'var(--amber)':'var(--rose)'}">${convPct}%</div>
              <div style="font-size:11px;color:var(--text3)">taux conversion direct</div>
            </div>` : ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--border1)">
            <div style="padding:14px 20px;text-align:center;border-right:1px solid var(--border1)">
              <div style="font-size:22px;font-weight:900;color:#14B86A">${fmt(wmlEntDet.ca)}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:4px">CA groupement 4 mois</div>
            </div>
            <div style="padding:14px 20px;text-align:center;border-right:1px solid var(--border1)">
              <div style="font-size:22px;font-weight:900;color:var(--text1)">${fmt(wmlAvgMo)}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:4px">CA moyen / mois</div>
            </div>
            <div style="padding:14px 20px;text-align:center">
              <div style="font-size:22px;font-weight:900;color:var(--amber)">${fmt(wmlEntDet.mg)}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:4px">Marge brute</div>
            </div>
          </div>
          ${caM.length ? `<div style="display:flex;gap:6px;padding:12px 20px;border-top:1px solid var(--border1)">
            ${months.map((mo,i) => {
              const v = caM[i] || 0;
              const maxV = Math.max(...caM, 1);
              const h = Math.round(v / maxV * 40);
              return `<div style="flex:1;text-align:center">
                <div style="font-size:10px;font-weight:700;color:${v>0?'#14B86A':'var(--text3)'};margin-bottom:3px">${v>0?fmt(v):'—'}</div>
                <div style="height:${Math.max(h,2)}px;border-radius:3px;background:${v>0?'#14B86A':'var(--bg3)'};margin:0 4px"></div>
                <div style="font-size:9px;color:var(--text3);margin-top:3px">${mo}</div>
              </div>`;
            }).join('')}
          </div>` : ''}
          ${(wmlEntDet.pr||[]).length > 0 ? `<div style="border-top:1px solid var(--border1)">
            <div style="padding:8px 20px 4px;font-size:10px;font-weight:700;color:#14B86A;text-transform:uppercase;letter-spacing:.4px">Top produits groupement</div>
            ${(wmlEntDet.pr||[]).slice(0,3).map(([nom,ca,,qt],i) => `
              <div style="display:flex;align-items:center;gap:10px;padding:7px 20px;border-bottom:1px solid var(--border1)">
                <div style="flex:1;min-width:0;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i+1}. ${nom}</div>
                <div style="font-size:12px;font-weight:700;color:#14B86A;flex-shrink:0">${fmt(ca)}</div>
                <div style="font-size:10px;color:var(--text3);flex-shrink:0">${Math.round(qt||0)} u</div>
              </div>`).join('')}
          </div>` : ''}
          ${missedWml.length > 0 ? `<div style="margin:0 16px 14px;padding:10px 12px;background:rgba(255,176,32,.07);border-radius:8px;border-left:3px solid var(--amber)">
            <div style="font-size:10px;font-weight:800;color:var(--amber);text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px">
              À proposer en direct — ${missedWml.length} produit${missedWml.length>1?'s':''} · ${fmt(missedCaWml)} CA groupement
            </div>
            ${missedWml.slice(0,4).map(([nom,ca,,qt]) => `
              <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,176,32,.2);font-size:11px">
                <span style="font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">→ ${nom}</span>
                <span style="font-weight:700;color:var(--amber);margin-left:8px;white-space:nowrap;flex-shrink:0">${fmt(ca)} · ${Math.round(qt||0)} u</span>
              </div>`).join('')}
            ${missedWml.length > 4 ? `<div style="font-size:10px;color:var(--amber);margin-top:4px">+${missedWml.length-4} autres</div>` : ''}
          </div>` : ''}
        </div>`;
      })() : ''}
  `;

  // ── HTML : YTD pharmacie cumul (overview) ──────────
  const __ytdHtml = `
      <!-- YTD pharmacie -->
      ${pharmaYTD > 0 ? `
      <div class="card fade-up" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <div class="card-title">Cumul Jan–${monthName(curM)} ${curY}</div>
            <div class="card-subtitle">${pharmaYTDprev > 0 ? `vs même période ${curY-1}` : 'Année en cours'}</div>
          </div>
          ${pharmaYTDprev > 0 ? deltaBadge(pharmaYTD, pharmaYTDprev) : ''}
        </div>
        <div style="display:grid;grid-template-columns:${pharmaYTDprev > 0 ? '1fr 1fr 1fr' : '1fr 1fr'};gap:0;border-top:1px solid var(--border1)">
          <div style="padding:16px 20px;text-align:center;${pharmaYTDprev > 0 ? 'border-right:1px solid var(--border1);' : ''}">
            <div style="font-size:24px;font-weight:900;color:var(--blue);letter-spacing:-1px">${fmt(pharmaYTD)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:4px">CA Jan–${monthName(curM)} ${curY}</div>
          </div>
          ${pharmaYTDprev > 0 ? `
          <div style="padding:16px 20px;text-align:center;border-right:1px solid var(--border1)">
            <div style="font-size:24px;font-weight:900;color:var(--text2);letter-spacing:-1px">${fmt(pharmaYTDprev)}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:4px">CA Jan–${monthName(curM)} ${curY-1}</div>
          </div>
          <div style="padding:16px 20px;text-align:center">
            <div style="font-size:24px;font-weight:900;color:${pharmaYTD>=pharmaYTDprev?'var(--mint)':'var(--rose)'};letter-spacing:-1px">
              ${((pharmaYTD-pharmaYTDprev)/pharmaYTDprev*100).toFixed(1)}%
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:4px">Évolution YoY</div>
          </div>` : `
          <div style="padding:16px 20px;text-align:center">
            <div style="font-size:24px;font-weight:900;color:var(--text2);letter-spacing:-1px">${curM > 1 ? fmt(pharmaYTD / curM) : '—'}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:4px">CA moyen / mois</div>
          </div>`}
        </div>
      </div>` : ''}
  `;

  // ── HTML : Veille prix parapharmacie concurrents (opp) ──────────
  const __veilleHtml = `
      <!-- Veille prix parapharmacie dans la fiche pharmacie -->
      ${(() => {
        if (typeof OFFILOG === 'undefined' || !salesCur.length) return '';
        const nnk = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
        const byProdOff = {};
        for (const s of salesCur) {
          const k = nnk(s.artDesignation);
          if (k) byProdOff[k] = s.artDesignation;
        }
        const veilleRows = [];
        for (const [k, label] of Object.entries(byProdOff)) {
          const op = OFFILOG.find(p => nnk(p.produit) === k);
          if (!op) continue;
          const concMap = [
            op.prix_drakkars  > 0 ? [op.prix_drakkars,  'Drakkars',  '#6366f1'] : null,
            op.prix_cap3000   > 0 ? [op.prix_cap3000,   'Cap3000',   '#ea580c'] : null,
            op.prix_leclerc   > 0 ? [op.prix_leclerc,   'Leclerc',   '#0072e6'] : null,
            op.prix_pharmacie > 0 ? [op.prix_pharmacie, 'Apothical', '#00E5A0'] : null,
            op.prix_maxi      > 0 ? [op.prix_maxi,      'Maxipara',  '#FFB020'] : null,
          ].filter(Boolean);
          if (!concMap.length) continue;
          const sorted = concMap.slice().sort((a, b) => a[0] - b[0]);
          veilleRows.push({ label, sorted, prixAchat: op.prix_offilog || op.prix_live });
        }
        const top = veilleRows.slice(0, 6);
        if (!top.length) return '';
        const rows = top.map(a => `
          <div style="padding:9px 20px;border-bottom:1px solid var(--border1)">
            <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:4px">${a.label}${a.prixAchat ? `<span style="font-size:10px;color:var(--text3);font-weight:400;margin-left:8px">achat IP ${fmtP(a.prixAchat)}</span>` : ''}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${a.sorted.map(([prix, src, col]) => `<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${col}18;color:${col};font-weight:600">${src} ${fmtP(prix)}</span>`).join('')}
            </div>
          </div>`).join('');
        return `<div class="card fade-up" style="margin-bottom:20px">
          <div class="card-header">
            <div>
              <div class="card-title">Prix parapharmacie concurrents</div>
              <div class="card-subtitle">Prix de vente constatés sur les produits achetés ce mois · ${veilleRows.length} référence${veilleRows.length > 1 ? 's' : ''} avec données</div>
            </div>
            <button onclick="navigate('offilog')" style="font-size:11px;padding:5px 12px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-weight:600">Catalogue →</button>
          </div>
          ${rows}
          ${veilleRows.length > 6 ? `<div style="padding:10px 20px;font-size:11px;color:var(--text3)">+${veilleRows.length - 6} autres — voir l'onglet Offilog</div>` : ''}
        </div>`;
      })()}
  `;

  // ── HTML : Évolution mensuelle chart (history) ──────────
  const __chartHtml = `
      <!-- Évolution mensuelle -->
      ${pharmaByMonth.length > 1 ? `
      <div class="card fade-up" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">Évolution CA mensuelle</div>
          <div class="card-subtitle">${pharmaByMonth.length} période(s) importées</div>
        </div>
        <div class="card-body"><div class="chart-wrap"><canvas id="chart-pharma-month"></canvas></div></div>
      </div>` : ''}
  `;

  // ── HTML : Historique complet produits (history) ──────────
  const __histProdsHtml = `
      <!-- Historique complet produits -->
      ${allPhSales.length > 0 ? (() => {
        const histMap = {};
        for (const s of allPhSales) {
          const k = (s.artDesignation || '').trim().toUpperCase();
          if (!k) continue;
          const period = `${s.year}-${String(s.month).padStart(2,'0')}`;
          if (!histMap[k]) histMap[k] = { label: s.artDesignation, ca: 0, qte: 0, cat: classifyProduct(s), periods: new Set() };
          histMap[k].ca  += s.mntNetHt;
          histMap[k].qte += s.qte;
          histMap[k].periods.add(period);
        }
        const histList = Object.values(histMap)
          .map(p => ({ ...p, periodCount: p.periods.size }))
          .sort((a, b) => b.ca - a.ca)
          .slice(0, 200);
        const histRows = histList.map((p, i) => {
          const cat = CATS[p.cat] || CATS.mi;
          return `<tr>
            <td style="font-size:11px;color:var(--text3);text-align:right;padding:7px 8px 7px 16px">${i+1}</td>
            <td style="font-size:12px;font-weight:600;padding:7px 8px">${p.label}</td>
            <td style="padding:7px 4px"><span style="font-size:10px;padding:1px 4px;border-radius:4px;background:${cat.color}18;color:${cat.color};font-weight:700">${cat.icon}</span></td>
            <td style="text-align:right;font-size:12px;font-weight:700;color:var(--blue);padding:7px 8px">${fmt(p.ca)}</td>
            <td style="text-align:right;font-size:11px;color:var(--text3);padding:7px 8px">${fmtNum(Math.round(p.qte))} u.</td>
            <td style="text-align:right;font-size:11px;color:var(--text3);padding:7px 16px 7px 8px">${p.periodCount} mois</td>
          </tr>`;
        }).join('');
        return `<div class="card fade-up" style="margin-bottom:20px">
          <div class="card-header">
            <div>
              <div class="card-title">Historique produits complet</div>
              <div class="card-subtitle">${histList.length} références · toutes périodes</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="text" placeholder="Rechercher…" id="pharma-hist-search"
                oninput="filterPharmaHistTable(this.value)"
                style="padding:5px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:12px;color:var(--text);width:140px">
            </div>
          </div>
          <div style="overflow-x:auto;max-height:320px;overflow-y:auto">
            <table style="width:100%;border-collapse:collapse" id="pharma-hist-table">
              <thead style="position:sticky;top:0;background:var(--bg2);z-index:1">
                <tr style="border-bottom:2px solid var(--border2)">
                  <th style="padding:8px 16px;font-size:10px;color:var(--text3);font-weight:700;text-align:right">#</th>
                  <th style="padding:8px 8px;font-size:10px;color:var(--text3);font-weight:700;text-align:left">Produit</th>
                  <th></th>
                  <th style="padding:8px 8px;font-size:10px;color:var(--text3);font-weight:700;text-align:right">CA Total</th>
                  <th style="padding:8px 8px;font-size:10px;color:var(--text3);font-weight:700;text-align:right">Qtés</th>
                  <th style="padding:8px 16px;font-size:10px;color:var(--text3);font-weight:700;text-align:right">Périodes</th>
                </tr>
              </thead>
              <tbody id="pharma-hist-tbody" style="font-size:12px">
                ${histRows}
              </tbody>
            </table>
          </div>
        </div>`;
      })() : ''}
  `;

  // ── HTML : Produits IP suggérés (opp) ──────────
  const __suggestionsHtml = `
      <!-- Produits IP suggérés -->
      ${typeof BENCHMARK !== 'undefined' && allPhSales.length ? (() => {
        const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
        const phNorms = new Set(allPhSales.map(s => nn(s.artDesignation)));
        const suggestions = BENCHMARK
          .filter(b => b.rot_pharma_jan26 > 1 && !phNorms.has(nn(b.designation)))
          .sort((a, b) => b.rot_pharma_jan26 - a.rot_pharma_jan26)
          .slice(0, 8);
        if (!suggestions.length) return '';
        return `<div class="card fade-up" style="margin-bottom:20px;border-left:3px solid var(--blue)">
          <div class="card-header">
            <div>
              <div class="card-title">Produits IP à proposer</div>
              <div class="card-subtitle">Meilleures rotations nationales non commandées par cette pharmacie</div>
            </div>
            <span style="font-size:10px;padding:3px 10px;border-radius:12px;background:rgba(0,87,255,.1);color:var(--blue);font-weight:700">${suggestions.length} opportunités</span>
          </div>
          ${suggestions.map((b, i) => {
            const cat = CATS[b.categorie] || CATS.mi;
            const fd = b.is_froid ? ' ❄️' : '';
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--border1)">
              <div style="font-size:13px;font-weight:700;color:var(--text3);width:18px;text-align:right;flex-shrink:0">${i+1}</div>
              <span style="font-size:10px;padding:1px 5px;border-radius:4px;background:${cat.color}18;color:${cat.color};font-weight:700;flex-shrink:0">${cat.icon}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.designation}${fd}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:1px">${b.rot_pharma_jan26.toFixed(1)} rot./pharma/mois · ${fmt(b.prix_ip)} IP HT</div>
              </div>
              ${b.offre_ip ? `<span style="flex-shrink:0;font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(0,229,160,.1);color:var(--mint);font-weight:600">${b.offre_ip}</span>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      })() : ''}
  `;

  // ── HTML : Notes de visite + prochaine visite (notes) ──────────
  const __nextVisitRaw = (() => { try { return localStorage.getItem('next_visit_' + pharma.id) || (clientInfo?.prochaineVisite || ''); } catch { return ''; } })();
  const __nextVisitCard = (() => {
    if (!__nextVisitRaw) return '';
    let iso = '';
    const m = __nextVisitRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) iso = m[3] + '-' + m[2] + '-' + m[1];
    else if (/^\d{4}-\d{2}-\d{2}$/.test(__nextVisitRaw)) iso = __nextVisitRaw;
    if (!iso) return '';
    const dNext = new Date(iso + 'T12:00:00');
    if (isNaN(dNext.getTime())) return '';
    const today = new Date(); today.setHours(0,0,0,0);
    const diffDays = Math.round((dNext - today) / 86400000);
    const labelDate = dNext.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    const jLabel = diffDays === 0 ? "aujourd'hui" : diffDays > 0 ? `J-${diffDays}` : `en retard de ${Math.abs(diffDays)}j`;
    const color = diffDays < 0 ? 'var(--rose)' : diffDays <= 7 ? 'var(--amber)' : 'var(--mint)';
    return `<div class="card fade-up" style="margin-bottom:20px;border-left:3px solid ${color};padding:14px 18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="font-size:22px">📅</div>
      <div style="flex:1;min-width:200px">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700">Prochaine visite</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-top:2px">${labelDate} <span style="color:${color};font-weight:600">(${jLabel})</span></div>
      </div>
      <button class="btn btn-ghost" onclick="showNextVisitPicker('${pharma.id}')" style="font-size:12px">Modifier</button>
    </div>`;
  })();
  const __notesHtmlSection = `
      ${__nextVisitCard}
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
          : `<div style="padding:32px 20px;text-align:center">
              <div style="width:48px;height:48px;border-radius:14px;background:var(--fill-quaternary,rgba(120,120,128,.08));display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--label-tertiary,#8E94A1)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
              <div style="font-size:15px;font-weight:600;color:var(--label-primary,#0B1220);margin-bottom:4px">Pas encore de notes</div>
              <div style="font-size:13px;color:var(--label-secondary,#5B6478);margin-bottom:14px">Ajoutez votre première note de visite ci-dessous</div>
              <button onclick="document.getElementById('visit-note-input-${pharma.id}')?.focus()" style="padding:8px 16px;border-radius:10px;border:none;background:var(--accent,#0057FF);color:#fff;font-size:13px;font-weight:600;cursor:pointer">+ Note rapide</button>
            </div>`;
        return `<div class="card fade-up" style="margin-bottom:20px">
          <div class="card-header">
            <div class="card-title">Notes de visite</div>
            <span style="font-size:11px;color:var(--text3)">${notes.length} note${notes.length > 1 ? 's' : ''}</span>
          </div>
          ${notesHtml}
          <div style="padding:10px 20px;border-top:1px solid var(--border1)">
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
              ${['✅ Commande passée','💬 Objection prix','📦 Produit manquant','🔄 Switch proposé','📅 RDV planifié'].map(t =>
                `<button onclick="document.getElementById('visit-note-input-${pharma.id}').value='${t} — ';document.getElementById('visit-note-input-${pharma.id}').focus()"
                  style="padding:3px 9px;border-radius:12px;border:1px solid var(--border2);background:var(--bg2);color:var(--text3);font-size:10px;cursor:pointer;white-space:nowrap">${t}</button>`
              ).join('')}
            </div>
            <div style="display:flex;gap:8px">
              <textarea id="visit-note-input-${pharma.id}" placeholder="Ajouter une note de visite… (Ctrl+Entrée pour valider)"
                style="flex:1;padding:8px 12px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);font-size:12px;color:var(--text);resize:none;height:60px;font-family:inherit"
                onkeydown="if(event.ctrlKey&&event.key==='Enter')saveVisitNote('${pharma.id}')"></textarea>
              <button onclick="saveVisitNote('${pharma.id}')" class="btn btn-primary" style="font-size:12px;align-self:flex-end;padding:8px 14px">Ajouter</button>
            </div>
          </div>
        </div>`;
      })()}
  `;

  // ── HTML : Imports historique fichiers (history) ──────────
  const __importsHtml = `
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
  `;

  // ── Split __opportunitiesHTML : Best&Work va dans tab "best", le reste va dans "opp" ──
  // Préservation du marker __opportunitiesHTML (toujours calculé en amont)
  const __bestPanelHtml = __bestWorkHTML;
  const __oppExtraHtml = __peerRecsHTML + __opsOpportunitiesHTML + __catalogueGapsHTML;

  // ── Tabbar sticky ──
  const __tabbarHtml = `
    <nav class="a-pharma-tabs" role="tablist">
      <button class="a-pharma-tab ${__pharmaTab==='overview'?'is-active':''}" role="tab" onclick="window.__pharmaSwitchTab('overview')">Vue d'ensemble</button>
      <button class="a-pharma-tab ${__pharmaTab==='best'?'is-active':''}" role="tab" onclick="window.__pharmaSwitchTab('best')">🏆 Best & À travailler</button>
      <button class="a-pharma-tab ${__pharmaTab==='opp'?'is-active':''}" role="tab" onclick="window.__pharmaSwitchTab('opp')">🎁 Opportunités</button>
      <button class="a-pharma-tab ${__pharmaTab==='history'?'is-active':''}" role="tab" onclick="window.__pharmaSwitchTab('history')">📊 Historique</button>
      <button class="a-pharma-tab ${__pharmaTab==='notes'?'is-active':''}" role="tab" onclick="window.__pharmaSwitchTab('notes')">📝 Notes & Visites</button>
    </nav>`;

  // ── Compose panels par tab ──
  const __overviewPanel = __kpisHtml + __mdlHtml + __clientInfoHtml + __palierHtml + __wmlHtml + __ytdHtml;
  const __bestPanel = __bestPanelHtml || `<div class="card" style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Pas de données Best & À travailler disponibles pour cette pharmacie.</div>`;
  const __oppPanel = __switchSectionHtml + __addSectionHtml + __veilleHtml + __suggestionsHtml + __oppExtraHtml;
  const __historyPanel = __topProdsHtml + __trendHtml + __chartHtml + __histProdsHtml + __importsHtml;
  const __notesPanel = __notesHtmlSection;

  const __activePanel =
    __pharmaTab === 'overview' ? __overviewPanel :
    __pharmaTab === 'best'     ? __bestPanel :
    __pharmaTab === 'opp'      ? __oppPanel :
    __pharmaTab === 'history'  ? __historyPanel :
    __notesPanel;

  document.getElementById('pharma-content').innerHTML = `
    <div class="fade-up">
      ${__headerHtml}
      ${__tabbarHtml}
      <div class="a-pharma-panel" role="tabpanel">
        ${__activePanel}
      </div>

      <!-- Bouton flottant Nouvelle visite (DA Intégral Pharma) -->
      <button class="np-fab" onclick="showFicheVisite('${pharma.id}')" aria-label="Nouvelle visite">
        Nouvelle visite
      </button>
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
  const { year: curY, month: curM } = getCurrentPeriod(allPhSales.length ? allPhSales : getSales());
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);
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

  // WML data for this pharmacy
  const wmlVisEM = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
  const nnEM = s => (s||'').trim().toUpperCase().replace(/\s+/g,' ');
  const wmlEnt = wmlVisEM.find(d => nnEM(d.nom) === nnEM(pharma.name));

  const dest = client?.email ? `${client.nom} <${client.email}>` : pharma.name;
  const moisCur = `${monthName(curM)} ${curY}`;
  const moisPrev = prevY ? `${monthName(prevM)} ${prevY}` : '—';
  const deltaStr = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : '';

  const wmlBlock = wmlEnt ? (() => {
    const nnEM2 = s => (s||'').trim().toUpperCase().replace(/\s+/g,' ');
    const directNames = new Set(allPhSales.map(s => nnEM2(s.artDesignation)));
    const missed = (wmlEnt.pr||[]).filter(([nom]) => nom && !directNames.has(nnEM2(nom))).slice(0,3);
    const missedStr = missed.length ? `\n\n💡 Produits à découvrir en commande directe :\n${missed.map(([nom,,,,],i)=>`${i+1}. ${nom}`).join('\n')}` : '';
    return `\n📦 Vos achats Intégral Pharma via le groupement OPSO (Jan–Avr 2026) :\n• CA groupement : ${fmt(wmlEnt.ca)} sur 4 mois\n• Marge brute : ${fmt(wmlEnt.mg)}${missedStr}`;
  })() : '';

  const emailBody = `Bonjour,

Je me permets de vous contacter pour faire un point sur votre activité avec Intégral Pharma.

📊 Vos chiffres — ${moisCur} :
• CA IP : ${fmt(caCur)}${deltaStr ? ` (${deltaStr} vs ${moisPrev})` : ''}
• Références commandées : ${salesCur.length}

${topProds.length ? `🏆 Vos top produits ce mois :\n${topProds.map(([name, ca], i) => `${i+1}. ${name} — ${fmt(ca)}`).join('\n')}\n\n` : ''}${wmlBlock}

N'hésitez pas à me contacter pour toute question ou pour planifier une visite.

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
  document.addEventListener('keydown', function emEsc(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', emEsc); } });
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
let prodCatAfm = 'all';        // catalogue grossiste IP : filtre AFMCODE/famille
let prodCatSearch = '';        // catalogue grossiste IP : recherche
let prodCatPage = 1;           // catalogue grossiste IP : pagination
const PROD_CAT_PER_PAGE = 100;
let prodSortCol = 'ca';
let prodSortAsc = false;
let prodPharmaFilter = 'tous'; // 'tous' or pharmacyId
let prodTableQuery = '', prodTableSort = 'ca', prodTableSortAsc = false, prodTablePage = 1;
let prodPeriodFilter = 'all'; // 'all' or 'YYYY-MM'
let prodWmlFilter = false;  // filtre: produits présents dans données WML
const PROD_TABLE_PER_PAGE = 50;

function renderProduits() {
  // Bridge robuste BENCHMARK (defer race condition)
  try { if (typeof BENCHMARK !== 'undefined' && !window.BENCHMARK) window.BENCHMARK = BENCHMARK; } catch(e){}
  const __BENCH_CAT = (typeof BENCHMARK !== 'undefined' && BENCHMARK.length) ? BENCHMARK :
                      (window.BENCHMARK && window.BENCHMARK.length) ? window.BENCHMARK : [];

  // Auto-retry si BENCHMARK pas encore chargé
  if (__BENCH_CAT.length === 0 && !window.__prodPollArmed) {
    window.__prodPollArmed = true;
    let __polls = 0;
    const __poll = setInterval(() => {
      __polls++;
      try { if (typeof BENCHMARK !== 'undefined' && !window.BENCHMARK) window.BENCHMARK = BENCHMARK; } catch(e){}
      const ok = (typeof BENCHMARK !== 'undefined' && BENCHMARK.length) ||
                 (window.BENCHMARK && window.BENCHMARK.length);
      if (ok) {
        clearInterval(__poll);
        window.__prodPollArmed = false;
        if (state.currentPage === 'produits' && typeof renderProduits === 'function') renderProduits();
      } else if (__polls > 60) {
        clearInterval(__poll);
        window.__prodPollArmed = false;
      }
    }, 500);
  }

  if (__BENCH_CAT.length === 0) {
    document.getElementById('prod-content').innerHTML = `
      <div class="card fade-up" style="margin:24px 0;padding:30px 24px;text-align:center;background:linear-gradient(135deg,rgba(0,87,255,0.08) 0%,rgba(124,58,237,0.05) 100%);border-left:3px solid var(--blue)">
        <div style="font-size:36px;margin-bottom:14px;animation:spin 1.2s linear infinite;display:inline-block">📦</div>
        <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">Catalogue Intégral Pharma — chargement…</div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:18px">Les 10 500 références IP (3,6 Mo) se téléchargent. Patiente quelques secondes.</div>
        <button onclick="renderProduits()" style="padding:10px 20px;border-radius:10px;border:none;background:var(--blue);color:#fff;font-size:13px;font-weight:700;cursor:pointer">🔄 Recharger</button>
        <style>@keyframes spin {from{transform:rotate(0)}to{transform:rotate(360deg)}}</style>
      </div>`;
    return;
  }

  // ── Classification AFMCODE / famille ──────────
  const __priceOfBench = (b) => (typeof b.prix_ip === 'number' && b.prix_ip > 0) ? b.prix_ip :
                                (typeof b.prix_ht === 'number' && b.prix_ht > 0) ? b.prix_ht : 0;
  const __familleOfBench = (b) => {
    if (b.is_froid) return 'froid';
    const n = (b.artnature || '').trim();
    if (n === 'Biosimilaire') return 'biosim';
    if (n === 'Generique') return 'generique';
    if (n === 'Generique Partenaire') return 'gen_partenaire';
    if (!b.has_ameli) return 'nr';
    const p = __priceOfBench(b);
    if (p > 0 && p <= 4.33) return 'princeps_pp';
    if (p > 4.33 && p <= 468) return 'princeps_mi';
    if (p > 468) return 'princeps_ch';
    return 'princeps_pp';
  };

  // Compteurs par famille (calculés une fois)
  const __benchCountByFam = (() => {
    const m = { all: __BENCH_CAT.length, princeps_pp: 0, princeps_mi: 0, princeps_ch: 0, froid: 0, generique: 0, gen_partenaire: 0, biosim: 0, nr: 0 };
    for (const b of __BENCH_CAT) m[__familleOfBench(b)]++;
    return m;
  })();

  // Filtre + tri
  const __benchFilter = __BENCH_CAT.filter(b => {
    if (prodCatAfm !== 'all' && __familleOfBench(b) !== prodCatAfm) return false;
    if (prodCatSearch) {
      const q = prodCatSearch.toLowerCase();
      if (!(b.designation || '').toLowerCase().includes(q) && !(b.cip13 || '').includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (a.ip_rank_qty || 99999) - (b.ip_rank_qty || 99999));

  const __benchTotalPages = Math.max(1, Math.ceil(__benchFilter.length / PROD_CAT_PER_PAGE));
  if (prodCatPage > __benchTotalPages) prodCatPage = 1;
  const __benchPage = __benchFilter.slice((prodCatPage - 1) * PROD_CAT_PER_PAGE, prodCatPage * PROD_CAT_PER_PAGE);

  // Chips (ordre Will 2026-06-10)
  const __afmChips = [
    { key: 'all',            label: 'Tout',                          color: '#0057FF' },
    { key: 'princeps_pp',    label: 'Princeps · 0 — 4,33 €',          color: '#10B981' },
    { key: 'princeps_mi',    label: 'Princeps · 4,33 — 468 €',        color: '#0057FF' },
    { key: 'princeps_ch',    label: 'Princeps · > 468 €',             color: '#FF6B35' },
    { key: 'froid',          label: '❄️ Froid',                       color: '#00C6FF' },
    { key: 'generique',      label: '💊 Génériques',                  color: '#94A3B8' },
    { key: 'gen_partenaire', label: '✓ Gén. partenaires',             color: '#14B86A' },
    { key: 'biosim',         label: '🧬 Biosimilaires',               color: '#7C3AED' },
    { key: 'nr',             label: '🔴 Non remboursés',              color: '#FF9F1C' },
  ];

  const __afmChipsHtml = __afmChips.map(c => {
    const active = prodCatAfm === c.key;
    const count = __benchCountByFam[c.key] || 0;
    return `<button onclick="prodCatAfm='${c.key}';prodCatPage=1;renderProduits()" style="
      padding:8px 16px;border-radius:22px;border:1.5px solid ${active ? c.color : 'var(--border2)'};
      background:${active ? c.color : 'transparent'};color:${active ? '#fff' : 'var(--text2)'};
      cursor:pointer;font-size:13px;font-weight:${active ? '700' : '500'};white-space:nowrap;transition:all .15s;
      display:inline-flex;align-items:center;gap:8px
    ">${c.label}<span style="font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;opacity:.85;font-weight:600">${count.toLocaleString('fr-FR')}</span></button>`;
  }).join('');

  const __famBadge = (b) => {
    const f = __familleOfBench(b);
    const def = __afmChips.find(c => c.key === f);
    if (!def) return '';
    return `<span style="display:inline-block;padding:3px 8px;border-radius:6px;background:${def.color}22;color:${def.color};font-size:11px;font-weight:700;letter-spacing:0.02em;white-space:nowrap">${def.label.replace(/^[^\s]+\s?/, '')}</span>`;
  };

  const __pagBtns = (() => {
    const ps = Math.max(1, prodCatPage - 2);
    const pe = Math.min(__benchTotalPages, prodCatPage + 2);
    const btns = [];
    if (prodCatPage > 1) btns.push(`<button onclick="prodCatPage=1;renderProduits()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border2);background:transparent;cursor:pointer;font-size:12px">«</button>`);
    if (prodCatPage > 1) btns.push(`<button onclick="prodCatPage=${prodCatPage-1};renderProduits()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border2);background:transparent;cursor:pointer;font-size:12px">‹</button>`);
    for (let p = ps; p <= pe; p++) btns.push(`<button onclick="prodCatPage=${p};renderProduits()" style="padding:6px 12px;border-radius:8px;border:1px solid ${p===prodCatPage?'var(--blue)':'var(--border2)'};background:${p===prodCatPage?'var(--blue)':'transparent'};color:${p===prodCatPage?'#fff':'var(--text2)'};cursor:pointer;font-size:12px;font-weight:${p===prodCatPage?'700':'400'}">${p}</button>`);
    if (prodCatPage < __benchTotalPages) btns.push(`<button onclick="prodCatPage=${prodCatPage+1};renderProduits()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border2);background:transparent;cursor:pointer;font-size:12px">›</button>`);
    if (prodCatPage < __benchTotalPages) btns.push(`<button onclick="prodCatPage=${__benchTotalPages};renderProduits()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border2);background:transparent;cursor:pointer;font-size:12px">»</button>`);
    return btns.join('');
  })();

  document.getElementById('prod-content').innerHTML = `
    <div class="card fade-up" style="margin:24px 0;padding:24px 28px">
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:20px">
        <div style="flex:1;min-width:240px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--blue);font-weight:800;margin-bottom:4px">Catalogue grossiste</div>
          <div style="font-size:24px;font-weight:800;color:var(--text);letter-spacing:-0.02em">📦 Catalogue Intégral Pharma</div>
          <div style="font-size:13px;color:var(--text3);margin-top:4px">${__BENCH_CAT.length.toLocaleString('fr-FR')} références IP · filtrable par AFMCODE</div>
        </div>
        <div style="position:relative;min-width:280px;flex:1;max-width:420px">
          <input type="text" placeholder="Rechercher CIP13, désignation…" value="${prodCatSearch.replace(/"/g, '&quot;')}"
            oninput="prodCatSearch=this.value;prodCatPage=1;renderProduits()"
            style="width:100%;padding:11px 36px 11px 14px;border-radius:12px;border:1.5px solid var(--border2);background:var(--bg2);font-size:14px;color:var(--text);outline:none;font-family:'DM Sans',system-ui,sans-serif">
          ${prodCatSearch ? `<button onclick="prodCatSearch='';prodCatPage=1;renderProduits()" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text3);font-size:18px;padding:2px 8px">×</button>` : ''}
        </div>
      </div>

      <!-- Chips AFMCODE -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--border1)">${__afmChipsHtml}</div>

      <!-- Compteur -->
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <strong style="color:var(--text);font-size:14px;font-family:'Geist Mono',ui-monospace,monospace">${__benchFilter.length.toLocaleString('fr-FR')}</strong>
        produits · page <strong style="color:var(--text)">${prodCatPage}</strong> / ${__benchTotalPages.toLocaleString('fr-FR')}
      </div>

      <!-- Table -->
      <div style="overflow-x:auto;border-radius:12px;border:1px solid var(--border1)">
        <table style="width:100%;border-collapse:collapse;font-family:'DM Sans',system-ui,sans-serif">
          <thead>
            <tr style="background:var(--bg2)">
              <th style="padding:12px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">Rang IP</th>
              <th style="padding:12px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">Produit</th>
              <th style="padding:12px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">CIP13</th>
              <th style="padding:12px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">Famille AFMCODE</th>
              <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">Prix HT</th>
              <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">Prix IP</th>
              <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">Remise</th>
              <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">Vol IP</th>
              <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">Vol Ameli</th>
              <th style="padding:12px 14px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text3);font-weight:800">YoY Jan</th>
            </tr>
          </thead>
          <tbody>
            ${__benchPage.map(b => `
              <tr style="border-bottom:1px solid var(--border1);transition:background .15s" onmouseenter="this.style.background='var(--bg2)'" onmouseleave="this.style.background='transparent'">
                <td style="padding:10px 14px;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--text3);font-weight:600">#${b.ip_rank_qty || '—'}</td>
                <td style="padding:10px 14px;font-size:13px;font-weight:600;color:var(--text);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(b.designation || '').replace(/"/g, '&quot;')}">${b.designation || ''}</td>
                <td style="padding:10px 14px;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--text2)">${b.cip13 || ''}</td>
                <td style="padding:10px 14px">${__famBadge(b)}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--text2)">${b.prix_ht ? b.prix_ht.toFixed(2) + ' €' : '—'}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:13px;font-weight:700;color:var(--blue)">${b.prix_ip ? b.prix_ip.toFixed(2) + ' €' : '—'}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:${b.remise_pct > 0 ? 'var(--mint)' : 'var(--text3)'};font-weight:700">${b.remise_pct > 0 ? b.remise_pct.toFixed(1) + '%' : '—'}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;color:var(--text2)">${(b.ip_qty || 0).toLocaleString('fr-FR')}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;color:var(--text3)">${b.ameli_total ? (b.ameli_total >= 1e6 ? (b.ameli_total/1e6).toFixed(1).replace('.0','') + ' M' : b.ameli_total >= 1e3 ? (b.ameli_total/1e3).toFixed(0) + ' k' : b.ameli_total.toLocaleString('fr-FR')) : '—'}</td>
                <td style="padding:10px 14px;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px">${b.yoy_jan !== null && b.yoy_jan !== undefined ? `<span style="color:${b.yoy_jan >= 0 ? 'var(--mint)' : 'var(--rose)'};font-weight:700">${b.yoy_jan >= 0 ? '▲' : '▼'} ${Math.abs(b.yoy_jan).toFixed(1)}%</span>` : '—'}</td>
              </tr>
            `).join('') || '<tr><td colspan="10" style="padding:50px;text-align:center;color:var(--text3);font-size:14px">Aucun produit ne correspond aux filtres.</td></tr>'}
          </tbody>
        </table>
      </div>
      ${__benchTotalPages > 1 ? `<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:18px;flex-wrap:wrap">${__pagBtns}</div>` : ''}
    </div>
  `;
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
  let data = Object.values(prodMap).map(p => ({ ...p, froid: isFroid({ artDesignation: p.label }) }));
  if (prodFamille !== 'tous') {
    if (prodFamille === 'froid') data = data.filter(p => p.froid);
    else data = data.filter(p => p.cat === prodFamille);
  }
  if (prodTableQuery) {
    const q2 = prodTableQuery.toLowerCase();
    data = data.filter(p => p.label.toLowerCase().includes(q2));
  }
  data.sort((a, b) => b.ca - a.ca);
  // Compute momentum for CSV
  const allSalesRawCsv = getSales();
  const { year: csvY, month: csvM } = getCurrentPeriod(allSalesRawCsv);
  const { year: csvPY, month: csvPM } = getPrevPeriod(csvY, csvM);
  const csvCur  = csvY  ? getSales({ year: csvY,  month: csvM  }) : [];
  const csvPrev = csvPY ? getSales({ year: csvPY, month: csvPM }) : [];
  const csvCurMap = {}, csvPrevMap = {};
  for (const s of csvCur)  { const k = (s.artDesignation||'').trim().toUpperCase(); if (k) csvCurMap[k]  = (csvCurMap[k]  || 0) + s.mntNetHt; }
  for (const s of csvPrev) { const k = (s.artDesignation||'').trim().toUpperCase(); if (k) csvPrevMap[k] = (csvPrevMap[k] || 0) + s.mntNetHt; }
  const pharmaLabel = prodPharmaFilter === 'tous' ? 'Toutes' : (state.pharmacies.find(p => p.id === prodPharmaFilter)?.name || '');
  const header = ['Désignation','Famille','CA HT','Qtés','Nb Pharmacies','PU Moyen HT','Tendance M/M-1'];
  const rows = data.map(p => {
    const cat = CATS[p.cat] || CATS.mi;
    const pu = p.qte > 0 ? p.ca / p.qte : 0;
    const nk = p.label.trim().toUpperCase();
    const cCa = csvCurMap[nk] || 0, pCa = csvPrevMap[nk] || 0;
    const mom = (cCa > 0 && pCa > 0) ? ((cCa - pCa) / pCa * 100).toFixed(1) + '%' : '';
    return [
      `"${p.label.replace(/"/g,'""')}"`,
      cat.label,
      String(p.ca.toFixed(2)).replace('.',','),
      String(Math.round(p.qte)),
      p.pharmas.size,
      String(pu.toFixed(4)).replace('.',','),
      mom,
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

        <!-- Évolution mensuelle Chart.js -->
        ${monthKeys.length > 1 ? `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border1)">
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px">Évolution mensuelle (CA)</div>
          <div style="position:relative;height:160px"><canvas id="prod-breakdown-chart"></canvas></div>
        </div>` : ''}

        <!-- Benchmark data -->
        ${bench ? `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border1)">
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px">Données marché (Ameli / IP)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:10px">
            ${bench.ip_qty ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:var(--blue)">${fmtNum(bench.ip_qty)}</div><div style="font-size:10px;color:var(--text3)">Qté IP</div></div>` : ''}
            ${bench.ip_ca ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:var(--mint)">${fmt(bench.ip_ca)}</div><div style="font-size:10px;color:var(--text3)">CA IP</div></div>` : ''}
            ${bench.rot_pharma_jan26 ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:var(--amber)">${bench.rot_pharma_jan26.toFixed(1)}</div><div style="font-size:10px;color:var(--text3)">Rot./pharma</div></div>` : ''}
            ${bench.prix_ip ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:var(--blue)">${fmtP(bench.prix_ip)}</div><div style="font-size:10px;color:var(--text3)">Prix IP</div></div>` : ''}
            ${bench.yoy_jan != null ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:${bench.yoy_jan >= 0 ? 'var(--mint)' : 'var(--rose)'}">${bench.yoy_jan >= 0 ? '+' : ''}${bench.yoy_jan.toFixed(1)}%</div><div style="font-size:10px;color:var(--text3)">YoY jan.</div></div>` : ''}
            ${bench.has_ameli && bench.ameli_total ? `<div style="background:var(--bg2);padding:10px;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:800;color:var(--text)">${fmtNum(bench.ameli_total)}</div><div style="font-size:10px;color:var(--text3)">Boîtes Ameli total</div></div>` : ''}
          </div>
          ${bench.offre_ip ? `<div style="padding:10px 14px;background:rgba(0,87,255,.08);border:1px solid rgba(0,87,255,.2);border-radius:10px;font-size:12px;font-weight:600;color:var(--blue)">🎁 Offre IP : ${bench.offre_ip}</div>` : ''}
        </div>` : ''}
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function escB(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escB); }
  });
  document.body.appendChild(modal);

  // Draw Chart.js line chart for monthly evolution
  if (monthKeys.length > 1) {
    setTimeout(() => {
      const cvs = document.getElementById('prod-breakdown-chart');
      if (!cvs) return;
      const labels = monthKeys.map(k => { const [y, m] = k.split('-'); return monthName(+m).slice(0,3) + ' ' + y; });
      const vals   = monthKeys.map(k => +(byMonth[k] || 0).toFixed(2));
      new Chart(cvs, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: vals,
            borderColor: '#0057FF',
            backgroundColor: 'rgba(0,87,255,.08)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#0057FF',
            fill: true,
            tension: 0.35,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.parsed.y) } } },
          scales: {
            x: { ticks: { color: '#888', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.05)' } },
            y: { ticks: { color: '#888', font: { size: 10 }, callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,.05)' } },
          },
        },
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
      </div>` : emptyState('pharmacy','Aucune pharmacie suivie','Importez un premier fichier Excel pour démarrer le suivi de votre portefeuille.')}

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
  let { year: curY, month: curM } = getCurrentPeriod(allSales.length ? allSales : getSales());
  if (!curY) { curY = new Date().getFullYear(); curM = new Date().getMonth() + 1; }
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

      <!-- Cumul annuel -->
      ${(() => {
        const ytdMonths = [];
        for (let m = 1; m <= curM; m++) ytdMonths.push({ year: curY, month: m });
        const ytdRows = state.pharmacies.map(ph => {
          const actualYTD  = ytdMonths.reduce((s, { year, month }) => s + getSales({ pharmacyId: ph.id, year, month }).reduce((a, x) => a + x.mntNetHt, 0), 0);
          const targetYTD  = ytdMonths.reduce((s, { year, month }) => s + (objectives[`${ph.id}_${year}_${month}`] || 0), 0);
          const pct = targetYTD > 0 ? actualYTD / targetYTD * 100 : null;
          return { ph, actualYTD, targetYTD, pct };
        }).filter(r => r.actualYTD > 0 || r.targetYTD > 0);

        const totalActYTD = ytdRows.reduce((s, r) => s + r.actualYTD, 0);
        const totalObjYTD = ytdRows.reduce((s, r) => s + r.targetYTD, 0);
        const totalPct    = totalObjYTD > 0 ? totalActYTD / totalObjYTD * 100 : null;
        if (!ytdRows.length) return '';

        return `<div class="card fade-up" style="margin-bottom:24px">
          <div class="card-header">
            <div>
              <div class="card-title">Cumul annuel — Jan ${curY} → ${monthName(curM)} ${curY}</div>
              <div class="card-subtitle">CA réalisé vs objectif pour chaque pharmacie</div>
            </div>
            ${totalPct !== null ? `
            <div style="text-align:right">
              <div style="font-size:22px;font-weight:900;color:${totalPct >= 100 ? 'var(--mint)' : totalPct >= 70 ? 'var(--amber)' : 'var(--rose)'}">${totalPct.toFixed(1)}%</div>
              <div style="font-size:11px;color:var(--text3)">Secteur YTD</div>
            </div>` : ''}
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="border-bottom:2px solid var(--border2)">
                <th style="padding:8px 16px;font-size:11px;color:var(--text3);font-weight:700;text-align:left">Pharmacie</th>
                <th style="padding:8px 12px;font-size:11px;color:var(--text3);font-weight:700;text-align:right">Réalisé YTD</th>
                <th style="padding:8px 12px;font-size:11px;color:var(--text3);font-weight:700;text-align:right">Objectif YTD</th>
                <th style="padding:8px 12px;font-size:11px;color:var(--text3);font-weight:700;text-align:right">Atteinte</th>
                <th style="padding:8px 16px;font-size:11px;color:var(--text3);font-weight:700;text-align:left">Barre</th>
              </tr></thead>
              <tbody>
                ${ytdRows.map(r => {
                  const color = r.pct === null ? 'var(--text3)' : r.pct >= 100 ? 'var(--mint)' : r.pct >= 70 ? 'var(--amber)' : 'var(--rose)';
                  return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:10px 16px">
                      <div style="display:flex;align-items:center;gap:8px">
                        <span style="width:8px;height:8px;border-radius:50%;background:${r.ph.color};flex-shrink:0"></span>
                        <span style="font-size:13px;font-weight:600">${r.ph.name}</span>
                      </div>
                    </td>
                    <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;color:var(--blue)">${fmt(r.actualYTD)}</td>
                    <td style="padding:10px 12px;text-align:right;font-size:12px;color:var(--text3)">${r.targetYTD > 0 ? fmt(r.targetYTD) : '—'}</td>
                    <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;color:${color}">${r.pct !== null ? r.pct.toFixed(1) + '%' : '—'}</td>
                    <td style="padding:10px 16px;width:120px">
                      <div style="height:6px;border-radius:3px;background:var(--border1)">
                        <div style="height:100%;width:${r.pct !== null ? Math.min(r.pct,100).toFixed(0) : 0}%;background:${color};border-radius:3px"></div>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
                <tr style="background:var(--glass2);font-weight:700;border-top:2px solid var(--border2)">
                  <td style="padding:10px 16px;font-size:13px;font-weight:800">Total secteur</td>
                  <td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:800;color:var(--blue)">${fmt(totalActYTD)}</td>
                  <td style="padding:10px 12px;text-align:right;font-size:13px;color:var(--text3)">${totalObjYTD > 0 ? fmt(totalObjYTD) : '—'}</td>
                  <td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:800;color:${totalPct !== null ? (totalPct >= 100 ? 'var(--mint)' : totalPct >= 70 ? 'var(--amber)' : 'var(--rose)') : 'var(--text3)'}">${totalPct !== null ? totalPct.toFixed(1)+'%' : '—'}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>`;
      })()}

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

  // Top produits sur les 6 derniers mois
  const allSalesRaw = getSales();
  const adminTopProds = (() => {
    if (!allSalesRaw.length) return null;
    const { year: curY, month: curM } = getCurrentPeriod(allSalesRaw);
    const periods = [];
    for (let i = 5; i >= 0; i--) {
      let m = curM - i, y = curY;
      if (m <= 0) { m += 12; y--; }
      periods.push({ year: y, month: m });
    }
    const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const totalMap = {};
    for (const { year, month } of periods) {
      const ps = getSales({ year, month });
      for (const s of ps) {
        const k = nn(s.artDesignation);
        if (!k) continue;
        if (!totalMap[k]) totalMap[k] = { label: s.artDesignation, total: 0 };
        totalMap[k].total += s.mntNetHt;
      }
    }
    const top8 = Object.entries(totalMap).sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([k, v]) => v.label);
    const datasets = top8.map(label => {
      const data = periods.map(({ year, month }) => {
        const ps = getSales({ year, month });
        return +ps.filter(s => nn(s.artDesignation) === nn(label)).reduce((a, s) => a + s.mntNetHt, 0).toFixed(2);
      });
      return { label: label.slice(0, 30), data };
    });
    const labels = periods.map(p => monthName(p.month).slice(0,3) + ' ' + String(p.year).slice(2));
    return { labels, datasets };
  })();

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

      <!-- Export complet -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <div class="card-title">Exports</div>
            <div class="card-subtitle">Téléchargez vos données</div>
          </div>
        </div>
        <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap">
          <button onclick="exportRapportSecteurCSV()" style="padding:8px 16px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);color:var(--text);cursor:pointer;font-size:12px;font-weight:600">📊 Rapport secteur CSV</button>
          <button onclick="exportAllSalesCSV()" style="padding:8px 16px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);color:var(--text);cursor:pointer;font-size:12px;font-weight:600">📦 Toutes les ventes CSV</button>
          <button onclick="printRapportMensuel()" style="padding:8px 16px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);color:var(--text);cursor:pointer;font-size:12px;font-weight:600">🖨 Rapport mensuel imprimable</button>
        </div>
      </div>

      <!-- Top produits 6 mois -->
      ${adminTopProds ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div>
            <div class="card-title">Top produits — 6 derniers mois</div>
            <div class="card-subtitle">CA des 8 meilleures références sur 6 mois glissants</div>
          </div>
        </div>
        <div class="card-body"><div style="height:240px"><canvas id="admin-top-prods-chart"></canvas></div></div>
      </div>` : ''}

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

  // Draw top products line chart
  if (adminTopProds) {
    setTimeout(() => {
      const cvs = document.getElementById('admin-top-prods-chart');
      if (!cvs) return;
      const palette = ['#0057FF','#00E5A0','#FFB020','#FF4D6D','#9B5CFF','#06B6D4','#84CC16','#EC4899'];
      new Chart(cvs, {
        type: 'line',
        data: {
          labels: adminTopProds.labels,
          datasets: adminTopProds.datasets.map((ds, i) => ({
            label: ds.label,
            data: ds.data,
            borderColor: palette[i % palette.length],
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#888', font: { size: 10 }, boxWidth: 12, padding: 8 } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
          },
          scales: {
            x: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.05)' } },
            y: { ticks: { color: '#888', font: { size: 11 }, callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,.05)' } },
          },
        },
      });
    }, 50);
  }
}

function showEditPharmacyModal(pharmacyId) {
  const ph = state.pharmacies.find(p => p.id === pharmacyId);
  if (!ph) return;
  const existing = document.getElementById('edit-pharma-modal');
  if (existing) existing.remove();

  // CLIENTS data (CIP, adresse, groupements) si disponible
  const clientInfoEdit = typeof CLIENTS !== 'undefined'
    ? CLIENTS.find(c => c.nom && c.nom.toUpperCase().trim() === ph.name.toUpperCase().trim())
    : null;

  const modal = document.createElement('div');
  modal.id = 'edit-pharma-modal';
  modal.className = 'np-modal';
  modal.innerHTML = `
    <div class="np-modal-card">
      <div class="np-modal-header">
        <div class="np-modal-title">
          <span class="np-pin np-pin-sm" aria-hidden="true"></span>
          Modifier l'officine
        </div>
        <button class="np-modal-close" onclick="document.getElementById('edit-pharma-modal').remove()" aria-label="Fermer">✕</button>
      </div>
      <div class="np-modal-body np-modal-grid2">
        <div class="np-modal-field" style="grid-column:1 / -1">
          <label>Nom de l'officine</label>
          <input id="edit-pharma-name" type="text" value="${ph.name.replace(/"/g,'&quot;')}" placeholder="Pharmacie de la République">
        </div>
        ${clientInfoEdit?.cip ? `
        <div class="np-modal-field">
          <label>CIP officine</label>
          <input type="text" value="${clientInfoEdit.cip}" disabled style="background:var(--np-surface-2);color:var(--np-text-dim)">
        </div>` : ''}
        ${clientInfoEdit?.ville ? `
        <div class="np-modal-field">
          <label>Ville</label>
          <input type="text" value="${clientInfoEdit.cp || ''} ${clientInfoEdit.ville || ''}" disabled style="background:var(--np-surface-2);color:var(--np-text-dim)">
        </div>` : ''}
        <div class="np-modal-field" style="grid-column:1 / -1">
          <label>Couleur d'identification</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:6px 0">
            ${['#0057FF','#0041CC','#14B86A','#7C3AED','#F43F5E','#FF9F1C','#0B1F4D','#64748B'].map(c =>
              `<button onclick="document.querySelectorAll('#edit-pharma-modal .color-pick').forEach(b=>b.style.outline='none');this.style.outline='3px solid var(--np-brand-soft)';this.style.outlineOffset='2px';document.getElementById('edit-pharma-color').value='${c}'"
                class="color-pick"
                style="width:32px;height:32px;border-radius:50%;background:${c};border:1px solid rgba(0,0,0,.1);cursor:pointer;${ph.color===c?'outline:3px solid var(--np-brand-soft);outline-offset:2px;':''}" aria-label="Couleur ${c}"></button>`
            ).join('')}
            <input type="color" id="edit-pharma-color" value="${ph.color}" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--np-border-strong);cursor:pointer;padding:0">
          </div>
        </div>
      </div>
      <div class="np-modal-footer">
        <button class="np-btn np-btn-danger" onclick="if(confirm('Supprimer définitivement cette officine ?')){document.getElementById('edit-pharma-modal').remove();deletePharmacy('${ph.id}')}">🗑 Supprimer</button>
        <button class="np-btn np-btn-ghost" onclick="document.getElementById('edit-pharma-modal').remove()">Annuler</button>
        <button class="np-btn np-btn-primary" onclick="saveEditPharmacy('${ph.id}')">Enregistrer</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('edit-pharma-name')?.focus(), 50);
  document.addEventListener('keydown', function epEsc(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', epEsc); } });
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

function exportAllSalesCSV() {
  const allSales = getSales();
  if (!allSales.length) { showToast('Aucune donnée', 'error'); return; }
  const header = ['Pharmacie','Mois','Annee','Designation','Code Article','ID Article','Famille','Qte','PU Brut HT','PU Net HT','Mnt Net HT'];
  const rows = allSales.map(s => {
    const ph = state.pharmacies.find(p => p.id === s.pharmacyId);
    return [
      `"${(ph?.name||'').replace(/"/g,'""')}"`,
      s.month, s.year,
      `"${(s.artDesignation||'').replace(/"/g,'""')}"`,
      s.artCode||'', s.artId||'', s.artFamille||'',
      String((s.qte||0).toFixed(2)).replace('.',','),
      String((s.puBrut||0).toFixed(4)).replace('.',','),
      String((s.puNet||0).toFixed(4)).replace('.',','),
      String((s.mntNetHt||0).toFixed(4)).replace('.',','),
    ];
  });
  const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `toutes_ventes_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Export CSV — ${allSales.length} lignes de vente`, 'success');
}

function exportRapportSecteurCSV() {
  const allSales = getSales();
  if (!allSales.length) { showToast('Aucune donnée', 'error'); return; }
  const { year: curY, month: curM } = getCurrentPeriod(allSales);
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);
  const salesCur  = getSales({ year: curY, month: curM });
  const salesPrev = prevY ? getSales({ year: prevY, month: prevM }) : [];
  const objectives = loadObjectives ? loadObjectives() : {};

  const lines = [];
  const sep = ';';
  const push = (...cols) => lines.push(cols.map(c => (c === null || c === undefined) ? '' : String(c)).join(sep));

  // Section 1 : Global KPIs
  push('=== KPIs SECTEUR ===');
  push('Indicateur', 'Valeur', 'Mois courant', 'Mois precedent', 'Delta %');
  const caCur  = sumCA(salesCur);
  const caPrev = sumCA(salesPrev);
  const delta  = caPrev > 0 ? ((caCur - caPrev) / caPrev * 100).toFixed(1) : '';
  push('CA Total HT', '', String(caCur.toFixed(2)).replace('.',','), String(caPrev.toFixed(2)).replace('.',','), delta);
  push('Nb Pharmacies actives', '', new Set(salesCur.map(s => s.pharmacyId)).size, new Set(salesPrev.map(s => s.pharmacyId)).size, '');
  push('Nb References', '', new Set(salesCur.map(s => s.artDesignation)).size, '', '');
  push('');

  // Section 2 : Per pharmacy
  push('=== PHARMACIES ===');
  push('Pharmacie', 'CA M Courant', 'CA M-1', 'Delta %', 'Objectif', 'Atteinte %', 'Nb Ref');
  state.pharmacies.forEach(ph => {
    const cur  = sumCA(salesCur.filter(s => s.pharmacyId === ph.id));
    const prev = sumCA(salesPrev.filter(s => s.pharmacyId === ph.id));
    const d    = prev > 0 ? ((cur - prev) / prev * 100).toFixed(1) : '';
    const k    = `${ph.id}_${curY}_${curM}`;
    const obj  = objectives[k] || 0;
    const att  = obj > 0 ? (cur / obj * 100).toFixed(1) : '';
    const nRef = new Set(salesCur.filter(s => s.pharmacyId === ph.id).map(s => s.artDesignation)).size;
    if (cur > 0 || prev > 0) push(ph.name, String(cur.toFixed(2)).replace('.',','), String(prev.toFixed(2)).replace('.',','), d, obj > 0 ? String(obj.toFixed(2)).replace('.',',') : '', att, nRef);
  });
  push('');

  // Section 3 : Top 30 produits
  push('=== TOP 30 PRODUITS ===');
  push('Rang', 'Produit', 'CA HT', 'Qte', 'Nb Pharmacies');
  const byProd = {};
  for (const s of salesCur) {
    const k = (s.artDesignation||'').trim();
    if (!k) continue;
    if (!byProd[k]) byProd[k] = { ca: 0, qte: 0, pharmas: new Set() };
    byProd[k].ca += s.mntNetHt; byProd[k].qte += s.qte; byProd[k].pharmas.add(s.pharmacyId);
  }
  Object.entries(byProd).sort((a,b) => b[1].ca - a[1].ca).slice(0,30).forEach(([name, v], i) =>
    push(i+1, name, String(v.ca.toFixed(2)).replace('.',','), String(Math.round(v.qte)), v.pharmas.size));

  const csv = lines.join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `rapport_secteur_${monthName(curM)}_${curY}_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Rapport secteur exporté', 'success');
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

async function addProspectAsPharmacy(name) {
  if (!name) return;
  const existing = state.pharmacies.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) { showToast(`${name} est déjà une pharmacie cliente`, 'info'); return; }
  if (!confirm(`Ajouter "${name}" comme nouvelle pharmacie cliente ?`)) return;
  const code  = name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 4);
  const color = PHARMA_COLORS[state.pharmacies.length % PHARMA_COLORS.length];
  const { data, error } = await sb.from('pharmacies').insert({ name, code, color }).select().single();
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  state.pharmacies.push({ id: data.id, name: data.name, code: data.code, color: data.color });
  showToast(`"${name}" ajoutée — importez un Excel pour commencer`, 'success');
  updateNavBadge();
  navigate('import');
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
    data = data.filter(d => d.designation.toLowerCase().includes(q) || (d.cip13||'').includes(q) || (d.atc2||'').toLowerCase().includes(q));
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


function benchSparkline(months, width=60, height=18) {
  if (!months || !months.length) return '';
  const vals = months.slice(-12);
  const mx = Math.max(...vals, 1);
  const bw = Math.floor(width / vals.length) - 1;
  const last4avg = vals.slice(-4).reduce((a,b)=>a+b,0)/4;
  const first4avg = vals.slice(0,4).reduce((a,b)=>a+b,0)/4;
  const growing = last4avg >= first4avg;
  const col = growing ? '#00E5A0' : '#FF4D6D';
  const bars = vals.map((v,i) => {
    const h = Math.max(1, Math.round(v / mx * height));
    const x = i * (bw + 1);
    const y = height - h;
    const opacity = 0.35 + (i / vals.length) * 0.65;
    return '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" fill="'+col+'" opacity="'+opacity.toFixed(2)+'"/>';
  }).join('');
  return '<svg width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" style="display:block">'+bars+'</svg>';
}

function renderBenchmark() {
  if (typeof BENCHMARK === 'undefined') {
    document.getElementById('bench-content').innerHTML = emptyState('chart', 'Données Benchmark indisponibles', 'Le fichier benchmark-data.js n\'est pas chargé. Vérifiez votre import.');
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

  // Per-product pharmacy count map
  const pharmPerProd = new Map();
  for (const s of salesAll) {
    const k = nnBench(s.artDesignation);
    if (!k || !s.pharmacyId) continue;
    if (!pharmPerProd.has(k)) pharmPerProd.set(k, new Set());
    pharmPerProd.get(k).add(s.pharmacyId);
  }
  const nTotalPharma = state.pharmacies.length || 1;

  // WML popularity map: nom normalisé → nb pharmacies OPSO achetant via WML
  const wmlBenchMapCRM = new Map();
  for (const d of (typeof getWmlVisible === 'function' ? getWmlVisible() : [])) {
    const seen = new Set();
    for (const pr of (d.pr || [])) {
      const nom = Array.isArray(pr) ? pr[0] : pr;
      const k = nnBench(nom);
      if (k && !seen.has(k)) { seen.add(k); wmlBenchMapCRM.set(k, (wmlBenchMapCRM.get(k)||0)+1); }
    }
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
    data = data.filter(d => d.designation.toLowerCase().includes(q) || (d.cip13||'').includes(q) || (d.atc2||'').toLowerCase().includes(q));
  }
  if (benchCrossFilter === 'vendus')     data = data.filter(d => salesMap[nnBench(d.designation)]?.ca > 0);
  if (benchCrossFilter === 'non_vendus') data = data.filter(d => !salesMap[nnBench(d.designation)]?.ca);
  if (benchCrossFilter === 'wml')        data = data.filter(d => wmlBenchMapCRM.has(nnBench(d.designation)));

  // Inject our sales data for sorting
  data = data.map(d => {
    const sv = salesMap[nnBench(d.designation)];
    return { ...d, notre_ca: sv?.ca || 0, notre_qte: sv?.qte || 0 };
  });

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
    return `<th style="text-align:${align};cursor:pointer;user-select:none;color:${active?'var(--blue)':'var(--text2)'};font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;background:var(--bg);position:sticky;top:0;z-index:1" onclick="benchSortCol='${col}';benchSortAsc=${active?!benchSortAsc:false};renderBenchmark()">${label}${arrow}</th>`;
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
    const pharmSet = pharmPerProd.get(nnBench(d.designation));
    const nPharmaB = pharmSet ? pharmSet.size : 0;
    const penetPct = nTotalPharma > 0 ? Math.round(nPharmaB / nTotalPharma * 100) : 0;
    const penetBadge = nPharmaB > 0
      ? `<div style="font-size:10px;color:${nPharmaB === nTotalPharma ? 'var(--mint)' : nPharmaB >= 2 ? 'var(--amber)' : 'var(--text3)'};font-weight:600">${nPharmaB}/${nTotalPharma} pharma</div>`
      : '';
    const nosVentesHtml = sv?.ca > 0
      ? `<div style="text-align:right">
          <div style="font-size:11px;font-weight:700;color:var(--mint)">${fmt(sv.ca)}</div>
          <div style="font-size:10px;color:var(--text3)">${fmtNum(Math.round(sv.qte))} u.</div>
          ${partIP !== null ? `<div style="font-size:10px;color:var(--blue);font-weight:600">${partIP.toFixed(2)}% du CA IP</div>` : ''}
          ${penetBadge}
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
      <td style="padding:4px 8px">${d.has_ameli && d.ameli_months ? benchSparkline(d.ameli_months) : ''}</td>
      ${wmlBenchMapCRM.size > 0 ? `<td style="text-align:center">${wmlBenchMapCRM.get(nnBench(d.designation)) > 0 ? `<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(0,229,160,.1);color:var(--mint);font-weight:700">📦 ×${wmlBenchMapCRM.get(nnBench(d.designation))}</span>` : ''}</td>` : ''}
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
            ...(wmlBenchMapCRM.size > 0 ? [{ key: 'wml', label: `WML OPSO (${fmtNum(BENCHMARK.filter(d => wmlBenchMapCRM.has(nnBench(d.designation))).length)})`, color: '#00E5A0' }] : []),
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
              ${salesAll.length > 0 ? thB('notre_ca', 'Nos ventes CA') : ''}
              <th style="text-align:center;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:.5px" title="Tendance Ameli 12 mois">Tendance</th>
              ${wmlBenchMapCRM.size > 0 ? '<th style="text-align:center;color:var(--mint);font-size:11px" title="Nb pharmacies OPSO achetant via WML">WML OPSO</th>' : ''}
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
  const { sv, svByPharma } = (() => {
    const allS = getSales();
    const matching = allS.filter(s => nnB(s.artDesignation) === nnB(d.designation));
    const total = matching.reduce((acc, s) => ({ ca: acc.ca + s.mntNetHt, qte: acc.qte + s.qte }), { ca: 0, qte: 0 });
    const byPh = {};
    for (const s of matching) {
      const ph = state.pharmacies.find(p => p.id === s.pharmacyId);
      if (!byPh[s.pharmacyId]) byPh[s.pharmacyId] = { name: ph?.name || '?', color: ph?.color || '#888', ca: 0, qte: 0 };
      byPh[s.pharmacyId].ca  += s.mntNetHt;
      byPh[s.pharmacyId].qte += s.qte;
    }
    return { sv: total, svByPharma: Object.values(byPh).sort((a,b) => b.ca - a.ca) };
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
            <div style="font-size:11px;font-weight:700;color:var(--mint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Nos ventes</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:12px;color:var(--text3)">CA total réalisé</span>
              <span style="font-size:14px;font-weight:800;color:var(--mint)">${fmt(sv.ca)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:10px">
              <span style="font-size:12px;color:var(--text3)">Quantité vendue</span>
              <span style="font-size:13px;font-weight:700">${fmtNum(Math.round(sv.qte))} u.</span>
            </div>
            ${d.ip_ca > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:10px">
              <span style="font-size:12px;color:var(--text3)">Part du CA IP</span>
              <span style="font-size:13px;font-weight:700;color:var(--blue)">${(sv.ca / d.ip_ca * 100).toFixed(2)}%</span>
            </div>` : ''}
            ${svByPharma.length > 1 ? `<div style="border-top:1px solid rgba(0,229,160,.2);padding-top:10px;margin-top:4px">
              <div style="font-size:10px;font-weight:700;color:var(--mint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Répartition par pharmacie</div>
              ${svByPharma.map(p => `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px">
                <div style="display:flex;align-items:center;gap:5px;flex:1;min-width:0">
                  <span style="width:7px;height:7px;border-radius:50%;background:${p.color};flex-shrink:0"></span>
                  <span style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <span style="font-size:12px;font-weight:700">${fmt(p.ca)}</span>
                  <span style="font-size:10px;color:var(--text3);margin-left:4px">${fmtNum(Math.round(p.qte))}u</span>
                </div>
              </div>`).join('')}
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
const PAGE_TITLES = {
  dashboard:  'Pilotage',
  pharmacies: 'Pharmacies',
  produits:   'Analyse Portefeuille',
  import:     'Import',
  admin:      'Administration',
  catalogue:  'Catalogue Produits IP',
  benchmark:  'Benchmark Marché',
  simulateur: 'Simulateur de panier',
  offilog:    'Offilog — Parapharmacie',
  groupements:'Suivi Groupement',
  objectifs:  'Objectifs commerciaux',
  marketing:  'Marketing — Fiches commerciales',
};
const PAGE_SUBTITLES = {
  dashboard:  'Performance commerciale en temps réel',
  pharmacies: 'Portefeuille clients & fiches détaillées',
  produits:   'Mix produit · marge · pénétration',
  catalogue:  'Référentiel produits IP',
  benchmark:  'Comparatif marché & remboursement Ameli',
  simulateur: 'Calcul de panier & marges',
  offilog:    'Veille parapharmacie & alertes prix concurrents',
  groupements:'Suivi groupements & adhérents',
  marketing:  'Fiches commerciales · offres ·  PDF',
};
// Historique simple pour le bouton retour topbar
window._navHistory = window._navHistory || [];

function navigate(page) {
  // Push dans historique seulement si différent de la page actuelle
  if (state.currentPage && state.currentPage !== page) {
    window._navHistory.push(state.currentPage);
    if (window._navHistory.length > 20) window._navHistory.shift();
  }
  state.currentPage = page;
  document.querySelectorAll('.nav-item, .a-sidebar-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === `page-${page}`));

  // Pose data-layout sur .a-page-content selon la page (active CSS Wave 4 Agent A)
  // - reader : Marketing home (max-width 1100, padding aéré)
  // - full   : Pharmacies, Catalogue, Benchmark, Offilog, Produits (max-width none, tables denses)
  // - default: autres (max-width clamp(1100, 92vw, 1600))
  const LAYOUT_BY_PAGE = {
    marketing: 'reader',
    pharmacies: 'full',
    catalogue: 'full',
    benchmark: 'full',
    offilog: 'full',
    produits: 'full',
  };
  const pageContent = document.querySelector('.a-page-content, .page-content');
  if (pageContent) pageContent.setAttribute('data-layout', LAYOUT_BY_PAGE[page] || 'default');

  // Fermer sidebar mobile apres navigation
  if (typeof closeSidebarMobile === 'function') closeSidebarMobile();

  // Title + breadcrumb subtitle (sync sur les 2 titres : large + inline)
  const titleText = PAGE_TITLES[page] || page;
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titleText;
  const titleInlineEl = document.getElementById('topbar-title-inline');
  if (titleInlineEl) titleInlineEl.textContent = titleText;
  const crumbEl = document.getElementById('topbar-breadcrumb');
  if (crumbEl) {
    const sub = PAGE_SUBTITLES[page];
    if (sub) { crumbEl.style.display = ''; crumbEl.textContent = sub; }
    else     { crumbEl.style.display = 'none'; crumbEl.textContent = ''; }
  }
  // Back button : visible si historique non vide
  updateBackButton();

  // Loading bar : show pendant le render (le lazy bundle de marketing/benchmark
  // peut prendre ~1-2s)
  showTopbarLoader();

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
    marketing:   (typeof renderMarketing === 'function' ? renderMarketing : null),
  };
  if (renders[page]) {
    try { renders[page](); } catch (e) { console.error('[nav] render error', e); }
  }
  // Cache la barre apres render (next frame pour laisser respirer)
  requestAnimationFrame(() => requestAnimationFrame(hideTopbarLoader));

  // Scroll top apres navigation (UX intuitive)
  const pc = document.querySelector('.page-content');
  if (pc) pc.scrollTop = 0;
}

function navBack() {
  if (!window._navHistory || !window._navHistory.length) return;
  const prev = window._navHistory.pop();
  // Pop again pour eviter de re-push dans navigate
  const cur = state.currentPage;
  state.currentPage = null;
  navigate(prev);
  // Le navigate ci-dessus va push cur dans l'historique, retirons-le
  if (window._navHistory[window._navHistory.length - 1] === cur) window._navHistory.pop();
  updateBackButton();
}

function updateBackButton() {
  const btn = document.getElementById('topbar-back-btn');
  if (!btn) return;
  btn.style.display = (window._navHistory && window._navHistory.length > 0) ? '' : 'none';
}

// ── SIDEBAR : toggle desktop + overlay mobile ─────────
function toggleSidebar() {
  const cur = document.documentElement.dataset.sidebar || '';
  const next = (cur === 'collapsed') ? 'expanded' : 'collapsed';
  document.documentElement.dataset.sidebar = next;
  try { localStorage.setItem('mk_sidebar_collapsed', next === 'collapsed' ? '1' : '0'); } catch {}
  // Resize charts apres transition
  setTimeout(() => {
    if (window.Chart && Chart.instances) {
      try { Object.values(Chart.instances).forEach(c => c.resize && c.resize()); } catch {}
    }
    window.dispatchEvent(new Event('resize'));
  }, 220);
}

function restoreSidebarState() {
  try {
    const v = localStorage.getItem('mk_sidebar_collapsed');
    if (v === '1') document.documentElement.dataset.sidebar = 'collapsed';
    else if (v === '0') document.documentElement.dataset.sidebar = 'expanded';
  } catch {}
}

function openSidebarMobile() {
  // Si mobile-shell.js a expose son API, on delegue (il a focus trap + swipe + overlay)
  if (window.MobileShell && typeof window.MobileShell.open === 'function') {
    window.MobileShell.open();
    return;
  }
  // Fallback (mobile-shell pas charge)
  document.documentElement.dataset.sidebarMobile = 'open';
  const bk = document.getElementById('sidebar-backdrop');
  if (bk) bk.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeSidebarMobile() {
  if (window.MobileShell && typeof window.MobileShell.close === 'function') {
    if (window.MobileShell.isOpen && window.MobileShell.isOpen()) window.MobileShell.close();
    return;
  }
  if (document.documentElement.dataset.sidebarMobile !== 'open') return;
  document.documentElement.dataset.sidebarMobile = '';
  const bk = document.getElementById('sidebar-backdrop');
  if (bk) bk.classList.remove('visible');
  document.body.style.overflow = '';
}

// ── TOPBAR LOADER ─────────────────────────────
let _topbarLoaderTimer = null;
function showTopbarLoader() {
  const el = document.getElementById('topbar-loader');
  if (!el) return;
  clearTimeout(_topbarLoaderTimer);
  el.classList.add('show');
}
function hideTopbarLoader() {
  const el = document.getElementById('topbar-loader');
  if (!el) return;
  clearTimeout(_topbarLoaderTimer);
  _topbarLoaderTimer = setTimeout(() => el.classList.remove('show'), 80);
}

// ── KEYBOARD SHORTCUTS HELP ───────────────────
function showShortcutsHelp() {
  if (document.getElementById('shortcuts-modal')) return;
  const m = document.createElement('div');
  m.id = 'shortcuts-modal';
  m.className = 'shortcuts-modal';
  m.innerHTML = `
    <div class="shortcuts-card" onclick="event.stopPropagation()">
      <h3>Raccourcis clavier</h3>
      <div class="sc-row"><span>Recherche globale</span><span><kbd>⌘</kbd><kbd>K</kbd></span></div>
      <div class="sc-row"><span>Réduire / agrandir le menu</span><span><kbd>⌘</kbd><kbd>B</kbd></span></div>
      <div class="sc-row"><span>Retour à la page précédente</span><span><kbd>⌘</kbd><kbd>←</kbd></span></div>
      <div class="sc-row"><span>Fermer une fenêtre</span><span><kbd>Échap</kbd></span></div>
      <div class="sc-row"><span>Afficher cette aide</span><span><kbd>?</kbd></span></div>
      <button class="sc-close" onclick="document.getElementById('shortcuts-modal').remove()">Fermer</button>
    </div>
  `;
  m.addEventListener('click', () => m.remove());
  document.body.appendChild(m);
  document.addEventListener('keydown', function escSc(e) {
    if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', escSc); }
  });
}

function updateNavBadge() {
  const badge = document.getElementById('import-badge');
  if (badge) badge.textContent = state.imports.length;
}

// ── MODAL SYSTEM (unifié) ─────────────────────
// Couche commune utilisée par toutes les modales custom (recherche globale,
// fiches, image search marketing, etc.). Comportement :
//   - Echap ferme la dernière modal ouverte
//   - Click backdrop ferme (sauf opts.persistent)
//   - Focus trap Tab/Shift+Tab
//   - aria-modal/role/labelledby
//   - Mobile (<768px) → fullscreen + slide-up
// API: window.openAppModal(el, opts), window.closeAppModal(el)
const __appModalStack = [];

function __appModalIsEditing() {
  const ae = document.activeElement;
  if (!ae) return false;
  const tag = ae.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    // Si du texte est sélectionné, considérer comme édition active
    if (ae.value && ae.selectionStart !== ae.selectionEnd) return true;
    // Sinon, autorise quand même la fermeture par backdrop (UX classique)
    return false;
  }
  return ae.isContentEditable === true;
}

function __appModalFocusables(root) {
  if (!root) return [];
  const sel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(sel)).filter(el => el.offsetParent !== null || el === document.activeElement);
}

function __appModalKeyHandler(e) {
  if (!__appModalStack.length) return;
  const top = __appModalStack[__appModalStack.length - 1];
  if (!top || !top.el || !document.body.contains(top.el)) return;
  if (e.key === 'Escape') {
    if (top.opts && top.opts.persistent) return;
    e.stopPropagation();
    closeAppModal(top.el);
    return;
  }
  if (e.key === 'Tab') {
    const focusables = __appModalFocusables(top.el);
    if (!focusables.length) { e.preventDefault(); return; }
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

function openAppModal(el, opts) {
  if (!el) return;
  opts = opts || {};
  // ARIA
  if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  if (opts.labelledBy) el.setAttribute('aria-labelledby', opts.labelledBy);
  // Animation entrée
  el.classList.add('app-modal-enter');
  requestAnimationFrame(() => {
    el.classList.add('app-modal-enter-active');
    setTimeout(() => el.classList.remove('app-modal-enter', 'app-modal-enter-active'), 200);
  });
  // Backdrop click (cible = elem racine = backdrop)
  if (!opts.persistent && !el.__appModalBackdropBound) {
    el.__appModalBackdropBound = true;
    el.addEventListener('click', function (ev) {
      if (ev.target === el && !__appModalIsEditing()) closeAppModal(el);
    });
  }
  // Mémorise la cible de focus précédente
  const prevFocus = document.activeElement;
  __appModalStack.push({ el: el, opts: opts, prevFocus: prevFocus });
  // Bind global listener si premier ouvert
  if (__appModalStack.length === 1) {
    document.addEventListener('keydown', __appModalKeyHandler, true);
  }
  // Auto-focus
  setTimeout(() => {
    const focusTarget = el.querySelector('[data-autofocus]')
      || el.querySelector('input:not([type="hidden"]):not([disabled])')
      || el.querySelector('button.app-modal-primary, .mk-btn-primary, .btn-primary')
      || __appModalFocusables(el)[0];
    if (focusTarget && typeof focusTarget.focus === 'function') {
      try { focusTarget.focus({ preventScroll: false }); } catch (e) { focusTarget.focus(); }
    }
  }, 60);
}

function closeAppModal(el) {
  if (!el) return;
  const idx = __appModalStack.findIndex(s => s.el === el);
  let entry = null;
  if (idx >= 0) { entry = __appModalStack[idx]; __appModalStack.splice(idx, 1); }
  if (__appModalStack.length === 0) {
    document.removeEventListener('keydown', __appModalKeyHandler, true);
  }
  // Animation sortie
  el.classList.add('app-modal-leave-active');
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
    if (entry && entry.prevFocus && typeof entry.prevFocus.focus === 'function') {
      try { entry.prevFocus.focus({ preventScroll: true }); } catch (e) {}
    }
  }, 180);
}

window.openAppModal = openAppModal;
window.closeAppModal = closeAppModal;

// ── TOAST ─────────────────────────────────────
// Système harmonisé : success / info / warning / error
// Stack vertical (plusieurs toasts), auto-dismiss 3s (5s pour error).
// Compatible avec l'élément #toast historique pour rétrocompat.
function __ensureToastHost() {
  let host = document.getElementById('app-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'app-toast-host';
    host.className = 'app-toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  return host;
}

function showToast(msg, type) {
  type = type || 'info';
  // Normalise les alias
  if (type === 'warn') type = 'warning';
  if (!['success', 'error', 'info', 'warning'].includes(type)) type = 'info';
  const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
  const host = __ensureToastHost();
  // Crée l'item
  const item = document.createElement('div');
  item.className = 'app-toast app-toast-' + type;
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  item.innerHTML = '<span class="app-toast-ico">' + icons[type] + '</span><span class="app-toast-msg"></span>';
  item.querySelector('.app-toast-msg').textContent = msg;
  host.appendChild(item);
  requestAnimationFrame(() => item.classList.add('show'));
  const duration = type === 'error' ? 5000 : 3000;
  const timer = setTimeout(() => dismiss(), duration);
  function dismiss() {
    clearTimeout(timer);
    item.classList.remove('show');
    item.classList.add('leave');
    setTimeout(() => { if (item.parentNode) item.parentNode.removeChild(item); }, 220);
  }
  item.addEventListener('click', dismiss);
  // Backward compat : maintient aussi l'ancien #toast en succès silencieux
  const legacy = document.getElementById('toast');
  if (legacy) {
    // Vide le legacy pour éviter doublon visuel (l'ancien CSS le masquera de toute façon)
    legacy.className = '';
    legacy.textContent = '';
  }
  return { dismiss };
}
window.showToast = showToast;

// ── CATALOGUE ────────────────────────────────
let catQuery = '', catCatFilter = 'tous', catPageNum = 1;
const CAT_PER_PAGE = 30;
let catCurrentData = [];
let _catLeclMap = null;

function getCatLeclMap() {
  if (_catLeclMap) return _catLeclMap;
  _catLeclMap = new Map();
  if (typeof OFFILOG !== 'undefined') {
    for (const p of OFFILOG) {
      if (p.ean && p.prix_leclerc > 0) _catLeclMap.set(String(p.ean), p.prix_leclerc);
    }
  }
  return _catLeclMap;
}

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
    if (catCatFilter === 'leclerc') {
      const lm = getCatLeclMap();
      const lp = b.cip13 ? lm.get(String(b.cip13)) : null;
      return lp != null && lp > 0 && b.prix_ip > 0 && lp < b.prix_ip;
    }
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
    { key: 'leclerc',   label: '🛒 Leclerc moins cher' },
  ];
  const tabsHtml = tabDefs.map(t => {
    const active = catCatFilter === t.key;
    return `<button onclick="catCatFilter='${t.key}';catPageNum=1;renderCatalogue()"
      onmouseover="if(!${active}){this.style.background='var(--blue-bg)';this.style.color='var(--blue)';this.style.borderColor='var(--blue)'}"
      onmouseout="if(!${active}){this.style.background='transparent';this.style.color='var(--text2)';this.style.borderColor='var(--border2)'}"
      style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid ${active ? 'var(--blue)' : 'var(--border2)'};background:${active ? 'var(--blue)' : 'transparent'};color:${active ? '#fff' : 'var(--text2)'};cursor:pointer;white-space:nowrap;transition:all .15s;${active ? 'box-shadow:0 2px 8px rgba(37,99,235,.25)' : ''}">${t.label}</button>`;
  }).join('');

  // ── Leclerc lookup depuis OFFILOG (EAN → prix_leclerc) ──────
  const leclCatMap = getCatLeclMap();

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
    const prixLecl   = b.cip13 ? (leclCatMap.get(String(b.cip13)) || null) : null;
    const leclTag    = prixLecl != null ? `<span style="font-size:10px;padding:1px 5px;background:rgba(0,114,230,.1);color:#0072e6;border-radius:4px;font-weight:700">🛒 Leclerc ${fmtP(prixLecl)}</span>` : '';
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
          ${genTag}${biosimTag}${nrTag}${ameliTag}${offreTag}${rotTag}${leclTag}${cipTag}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">${prix}${addBtn}</div>
    </div>`;
  }).join('')
  : emptyState('search', 'Aucun produit trouvé', 'Affinez votre recherche ou réinitialisez les filtres pour voir plus de résultats.', 'Réinitialiser', "catQuery='';catCatFilter='tous';renderCatalogue&&renderCatalogue()");

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

    <!-- Vraies opportunités : IP absent + OPS/HP/CPR vendent -->
    ${typeof window.renderOpsOpportunitiesHTML === 'function' ? window.renderOpsOpportunitiesHTML() : ''}

    <!-- Top ventes par segment IP x Ameli (réutilisé depuis Marketing) -->
    ${typeof window.renderTopVentesSegmentsHTML === 'function' ? window.renderTopVentesSegmentsHTML() : ''}

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
let offiQuery = '', offiRole = 'tous', offiUnivers = 'tous', offiMarque = 'tous', offiSaison = 'tous', offiPageNum = 1, offiView = 'cards', offiSort = 'alpha';

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
    if (offiRole === 'leclerc') return p.prix_leclerc != null && p.prix_leclerc > 0;
    if (offiRole === 'leclerc_moins') {
      const ip = p.prix_live || p.prix_offilog;
      return p.prix_leclerc != null && p.prix_leclerc > 0 && ip != null && p.prix_leclerc < ip;
    }
    if (offiRole === 'alerte_conc') {
      const ip = p.prix_live || p.prix_offilog;
      if (!ip) return false;
      return [p.prix_drakkars, p.prix_cap3000, p.prix_leclerc, p.prix_pharmacie, p.prix_maxi].some(v => v != null && v > 0 && v < ip);
    }
    if (offiRole === 'favoris') return p.ean && getOffiFavs().has(p.ean);
    if (offiRole === 'concurrence') {
      return [p.prix_drakkars, p.prix_cap3000, p.prix_leclerc, p.prix_pharmacie, p.prix_maxi].some(v => v != null && v > 0);
    }
    if (offiRole !== 'tous' && offiRole === 'offilog' && !p.dans_offilog) return false;
    if (offiRole !== 'tous' && offiRole !== 'offilog' && offiRole !== 'pharmacie' && offiRole !== 'leclerc' && offiRole !== 'leclerc_moins' && offiRole !== 'concurrence' && p.role !== offiRole) return false;
    if (offiUnivers !== 'tous' && p.univers !== offiUnivers) return false;
    if (offiMarque !== 'tous' && p.marque !== offiMarque) return false;
    if (offiSaison === 'pe' && p.saison !== 'Printemps/Été') return false;
    if (offiSaison === 'ah' && p.saison !== 'Automne/Hiver') return false;
    if (offiSaison === 'annee' && p.saison !== 'Toute année' && p.saison != null) return false;
    return true;
  });
  if (offiRole === 'bestsellers') list.sort((a, b) => (a.rang_vente || 999) - (b.rang_vente || 999));
  else if (offiRole === 'leclerc_moins') list.sort((a, b) => {
    const dA = (a.prix_live || a.prix_offilog || 0) - (a.prix_leclerc || 0);
    const dB = (b.prix_live || b.prix_offilog || 0) - (b.prix_leclerc || 0);
    return dB - dA; // plus grand écart en premier
  });
  else if (offiRole === 'alerte_conc') list.sort((a, b) => {
    const ipA = a.prix_live || a.prix_offilog || 0;
    const ipB = b.prix_live || b.prix_offilog || 0;
    const minCA = Math.min(...[a.prix_drakkars, a.prix_cap3000, a.prix_leclerc, a.prix_pharmacie, a.prix_maxi].filter(v => v > 0), Infinity);
    const minCB = Math.min(...[b.prix_drakkars, b.prix_cap3000, b.prix_leclerc, b.prix_pharmacie, b.prix_maxi].filter(v => v > 0), Infinity);
    const gapA = ipA - minCA;
    const gapB = ipB - minCB;
    return gapB - gapA;
  });
  else if (offiRole === 'concurrence') list.sort((a, b) => {
    const nSrcA = [a.prix_drakkars, a.prix_cap3000, a.prix_leclerc, a.prix_pharmacie, a.prix_maxi].filter(v => v != null && v > 0).length;
    const nSrcB = [b.prix_drakkars, b.prix_cap3000, b.prix_leclerc, b.prix_pharmacie, b.prix_maxi].filter(v => v != null && v > 0).length;
    return nSrcB - nSrcA;
  });
  else if (offiSort === 'prix_asc')  list.sort((a, b) => ((a.prix_live || a.prix_offilog) || 0) - ((b.prix_live || b.prix_offilog) || 0));
  else if (offiSort === 'prix_desc') list.sort((a, b) => ((b.prix_live || b.prix_offilog) || 0) - ((a.prix_live || a.prix_offilog) || 0));
  else if (offiSort === 'marge_desc') list.sort((a, b) => (b.marge_pct || 0) - (a.marge_pct || 0));
  else if (offiSort === 'ecart') list.sort((a, b) => {
    const minC = p => Math.min(...[p.prix_drakkars, p.prix_cap3000, p.prix_leclerc, p.prix_pharmacie].filter(v => v != null && v > 0).concat([Infinity]));
    const ref  = p => p.prix_live || p.prix_offilog || 0;
    return (minC(a) - ref(a)) - (minC(b) - ref(b));
  });
  else list.sort((a, b) => (a.produit || '').localeCompare(b.produit || '', 'fr'));
  return list;
}

function offiGoPage(p) { offiPageNum = p; renderOffilog(); }
function offiSetRole(r) { offiRole = r; offiPageNum = 1; renderOffilog(); }
function offiSetUnivers(u) { offiUnivers = u; offiPageNum = 1; renderOffilog(); }
function offiSetMarque(m) { offiMarque = m; offiPageNum = 1; renderOffilog(); }
function offiSetSaison(s) { offiSaison = s; offiPageNum = 1; renderOffilog(); }
function offiExportCSV() {
  const list = offiGetList();
  const header = ['Produit','Marque','EAN','Univers','Role','Dans Offilog','Prix IP','Prix Live','Ma Pharmacie','Drakkars','Cap3000','E.Leclerc','Prix Public','Marge %','Potentiel','Rang Vente'];
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
    p.prix_leclerc   != null ? String(p.prix_leclerc).replace('.',',') : '',
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

// ── Helpers Intégral Pharma (DA bleu corporate / DM Sans) ──
function npPinSvg(size = 18) {
  // Icône abstraite "rapport / analytics" (plus de croix pharma / goutte signature NP)
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 14l3-3 3 2 3-5"/></svg>`;
}
function npAlertSvg(size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}
function npSparklineSvg(months, w = 70, h = 22) {
  if (!months || !months.length) return '';
  const maxV = Math.max(...months, 1);
  const barW = w / months.length;
  const bars = months.map((v, i) => {
    const bh = Math.max(1, (v / maxV) * (h - 2));
    return `<rect x="${i * barW + 0.5}" y="${h - bh}" width="${barW - 1}" height="${bh}" rx="1" class="${i === months.length - 1 ? 'np-spark-last' : ''}"/>`;
  }).join('');
  return `<svg class="np-sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bars}</svg>`;
}
function npEscape(s) { return (s || '').toString().replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

function renderOffilog() {
  const container = document.getElementById('offilog-content');
  if (!container) return;

  if (typeof OFFILOG === 'undefined' || !OFFILOG.length) {
    container.innerHTML = `<div class="np-scope"><div class="np-empty"><div class="np-empty-pin">${npPinSvg(22)}</div><div class="np-empty-title">Catalogue Offilog non chargé</div><div class="np-empty-sub">Le fichier offilog-data.js est manquant.</div></div></div>`;
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
  const nLeclerc  = OFFILOG.filter(p => p.prix_leclerc  != null && p.prix_leclerc  > 0).length;
  const nAlerte   = OFFILOG.filter(p =>
    [p.prix_drakkars, p.prix_cap3000, p.prix_leclerc, p.prix_pharmacie, p.prix_maxi].some(v => v != null && v > 0)
  ).length;
  const nLive       = OFFILOG.filter(p => p.prix_live      != null && p.prix_live      > 0).length;
  const nLeclMoins  = OFFILOG.filter(p => { const ip = p.prix_live||p.prix_offilog; return p.prix_leclerc > 0 && ip != null && p.prix_leclerc < ip; }).length;
  const nAlerteConc = OFFILOG.filter(p => {
    const ip = p.prix_live || p.prix_offilog;
    if (!ip) return false;
    return [p.prix_drakkars, p.prix_cap3000, p.prix_leclerc, p.prix_pharmacie, p.prix_maxi].some(v => v != null && v > 0 && v < ip);
  }).length;
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

  // ── Universe tiles (style NP) ─────────────────
  const univTiles = [{ key: 'tous', label: 'Tout voir', count: nTotal, icon: '◉' }]
    .concat(universSet.map(u => { const m = univMeta(u); return { key: u, label: u, count: universCount[u], icon: m.icon }; }))
    .map(t => {
      const active = offiUnivers === t.key;
      return `<button class="np-univers-tile ${active ? 'np-active' : ''}" onclick="offiSetUnivers('${npEscape(t.key)}')">
        <span class="np-ut-icon">${t.icon}</span>
        <span class="np-ut-label">${t.label.split(' / ')[0].split(' &')[0]}</span>
        <span class="np-ut-count">${fmtNum(t.count)}</span>
      </button>`;
    }).join('');

  // ── Role chips (charte NP) ───────────────────
  const nBest     = OFFILOG.filter(p => p.rang_vente != null).length;
  const offiFavs = getOffiFavs();
  const nFavs = OFFILOG.filter(p => p.ean && offiFavs.has(p.ean)).length;
  const roleTabs = [
    { key: 'tous',            label: 'Toutes références',         klass: '' },
    { key: 'bestsellers',     label: `Top ventes · ${nBest}`,     klass: 'np-lime' },
    { key: 'pharmacie',       label: `Ma Pharmacie · ${nPharma}`, klass: '' },
    { key: 'concurrence',     label: `Avec prix concurrents · ${nAlerte}`, klass: '' },
    { key: 'leclerc',         label: `E.Leclerc · ${nLeclerc}`,   klass: '' },
    { key: 'leclerc_moins',   label: `Leclerc < IP · ${nLeclMoins}`, klass: 'np-pink' },
    { key: 'alerte_conc',     label: `Alerte prix · ${nAlerteConc}`, klass: 'np-pink' },
    { key: 'favoris',         label: `Favoris · ${nFavs}`,        klass: '' },
    { key: 'offilog',         label: 'Dans Offilog',              klass: '' },
    { key: 'Héros',           label: 'Héros',                     klass: 'np-lime' },
    { key: 'Soutien fort',    label: 'Soutien fort',              klass: '' },
    { key: 'Image',           label: 'Image',                     klass: '' },
    { key: 'Opportunité',     label: 'Opportunités',              klass: '' },
  ];
  const roleChips = roleTabs.map(t => {
    const active = offiRole === t.key;
    return `<button class="np-chip ${t.klass} ${active ? 'np-active' : ''}" onclick="offiSetRole('${npEscape(t.key)}')">${t.label}</button>`;
  }).join('');

  // ── Product cards (charte NP : pin-card biseautée, comparateur vertical) ──
  const cardsHtml = page.length ? page.map((p, i) => {
    const hasIP    = p.prix_offilog   != null && p.prix_offilog   > 0;
    const hasLive  = p.prix_live      != null && p.prix_live      > 0;
    const hasMaxi  = p.prix_maxi      != null && p.prix_maxi      > 0;
    const hasDrak  = p.prix_drakkars  != null && p.prix_drakkars  > 0;
    const hasCap   = p.prix_cap3000   != null && p.prix_cap3000   > 0;
    const hasLecl  = p.prix_leclerc   != null && p.prix_leclerc   > 0;
    const hasPharma= p.prix_pharmacie != null && p.prix_pharmacie > 0;
    const hasImg   = p.img && p.img.length > 0;

    const prixAchat = hasLive ? p.prix_live : (hasIP ? p.prix_offilog : null);
    const concVals = [
      hasDrak   ? { src: 'Drakkars',  val: p.prix_drakkars  } : null,
      hasCap    ? { src: 'Cap3000',   val: p.prix_cap3000   } : null,
      hasLecl   ? { src: 'E.Leclerc', val: p.prix_leclerc   } : null,
      hasPharma ? { src: 'Apothical', val: p.prix_pharmacie } : null,
      hasMaxi   ? { src: 'Maxipara',  val: p.prix_maxi      } : null,
    ].filter(Boolean);
    const minConc = concVals.length ? Math.min(...concVals.map(x => x.val)) : null;
    const isAlerte = prixAchat != null && minConc != null && minConc < prixAchat;
    const brandInitial = (p.marque || p.produit || '?').charAt(0).toUpperCase();

    // Comparateur prix vertical : IP / concurrents
    const priceRows = [];
    if (prixAchat != null) {
      priceRows.push({ src: 'Prix achat IP', val: prixAchat, kind: 'achat' });
    }
    concVals.forEach(c => {
      priceRows.push({
        src: c.src,
        val: c.val,
        kind: prixAchat != null && c.val < prixAchat ? 'warn' : (c.val === minConc && concVals.length > 1 ? 'best' : 'normal'),
      });
    });

    const priceRowsHtml = priceRows.length
      ? `<div class="np-price-table">${priceRows.slice(0, 5).map(r =>
          `<div class="np-price-row ${r.kind === 'achat' ? 'np-achat' : r.kind === 'best' ? 'np-best' : r.kind === 'warn' ? 'np-warn' : ''}">
            <span class="np-pr-src">${r.src}</span>
            <span class="np-pr-val">${fmtP(r.val)}</span>
          </div>`).join('')}</div>`
      : '';

    // Delta pill alerte
    const deltaPill = isAlerte
      ? `<span class="np-delta np-delta-neg">−${fmtP(prixAchat - minConc)}</span>`
      : minConc != null && prixAchat != null
        ? `<span class="np-delta np-delta-pos">+${fmtP(minConc - prixAchat)}</span>`
        : '';

    const tagsHtml = [
      p.marque ? `<span class="np-tag np-tag-marque">${p.marque}</span>` : '',
      p.univers ? `<span class="np-tag np-tag-univers">${(p.univers || '').split(' / ')[0].split(' &')[0]}</span>` : '',
      p.dans_offilog ? `<span class="np-tag np-tag-ip">IP</span>` : '',
      p.rang_vente != null ? `<span class="np-tag np-tag-rank">Top #${p.rang_vente}</span>` : '',
      hasLive ? `<span class="np-tag np-tag-live">Live</span>` : '',
      p.saison && p.saison !== 'Toute année' ? `<span class="np-tag np-tag-saison">${p.saison === 'Printemps/Été' ? 'P/É' : 'A/H'}</span>` : '',
    ].filter(Boolean).join('');

    const favOn = p.ean && offiFavs.has(p.ean);

    return `<div class="np-prod-card ${isAlerte ? 'np-alerte' : ''}" onclick="showOffiDetail(${startIdx + i})">
      <div class="np-prod-photo">
        ${hasImg
          ? `<img src="${p.img}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="np-placeholder" style="display:none"><span class="np-ph-letter">${brandInitial}</span></div>`
          : `<div class="np-placeholder"><span class="np-ph-letter">${brandInitial}</span></div>`
        }
        ${isAlerte ? `<div class="np-prod-alert-badge">Alerte prix</div>` : ''}
        ${p.ean ? `<button class="np-prod-fav ${favOn ? 'np-on' : ''}" onclick="event.stopPropagation();toggleOffiFav('${npEscape(p.ean)}')" title="${favOn ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${favOn ? '★' : '☆'}</button>` : ''}
      </div>
      <div class="np-prod-body">
        <div class="np-prod-tags">${tagsHtml}</div>
        <div class="np-prod-name">${p.produit}</div>
        ${p.ean ? `<div class="np-prod-ean">CIP13/EAN · ${p.ean}</div>` : ''}
        ${priceRowsHtml}
        ${deltaPill ? `<div style="margin-top:6px">${deltaPill} <span style="font-size:10px;color:var(--np-text-muted);font-family:Inter">${isAlerte ? 'vs achat IP' : 'sous concurrent le moins cher'}</span></div>` : ''}
      </div>
    </div>`;
  }).join('')
  : `<div class="np-empty" style="grid-column:1/-1"><div class="np-empty-pin">${npPinSvg(22)}</div><div class="np-empty-title">Aucun produit trouvé</div><div class="np-empty-sub">Affinez votre recherche ou réinitialisez les filtres.</div></div>`;

  // ── Table view (charte NP : table dense Inter, sticky header vert) ──
  const tableHtml = page.length ? `
  <div class="np-table-wrap">
    <div class="np-table-scroll">
      <table class="np-table">
        <thead>
          <tr>
            <th>Référence (CIP13/EAN)</th>
            <th>Marque</th>
            <th class="np-num">Prix achat IP</th>
            <th class="np-num">Live</th>
            <th class="np-num">Apothical</th>
            <th class="np-num">Drakkars</th>
            <th class="np-num">Cap3000</th>
            <th class="np-num">E.Leclerc</th>
            <th class="np-num">Maxipara</th>
            <th class="np-num">Marge</th>
          </tr>
        </thead>
        <tbody>
          ${page.map((p, i) => {
            const prixRef  = p.prix_live || p.prix_offilog;
            const concList = [p.prix_drakkars, p.prix_cap3000, p.prix_leclerc, p.prix_pharmacie, p.prix_maxi].filter(x => x != null && x > 0);
            const minConc  = concList.length ? Math.min(...concList) : null;
            const isAlerte = prixRef && minConc && minConc < prixRef;
            const img = p.img ? `<img src="${p.img}" style="width:30px;height:30px;object-fit:contain;border-radius:6px;margin-right:9px;vertical-align:middle;background:#fff;border:1px solid var(--np-border)" onerror="this.style.display='none'">` : '';
            const cell = v => v ? `<td class="np-num"><strong>${fmtP(v)}</strong></td>` : `<td class="np-num" style="color:var(--np-text-muted)">—</td>`;
            const cellWarn = v => v && prixRef && v < prixRef
              ? `<td class="np-num" style="color:var(--np-pink);font-weight:700">${fmtP(v)}</td>`
              : (v ? `<td class="np-num">${fmtP(v)}</td>` : `<td class="np-num" style="color:var(--np-text-muted)">—</td>`);
            return `<tr onclick="showOffiDetail(${startIdx + i})" style="${isAlerte ? 'background:#fff8fb' : ''}">
              <td>
                <div style="display:flex;align-items:center">
                  ${img}
                  <div>
                    <div class="np-cell-name">${p.produit}${isAlerte ? ' <span style="color:var(--np-pink);font-weight:700">●</span>' : ''}</div>
                    <div class="np-cell-sub">${p.univers ? p.univers.split(' / ')[0] : '—'}${p.ean ? ' · ' + p.ean : ''}${p.rang_vente ? ' · Top #' + p.rang_vente : ''}</div>
                  </div>
                </div>
              </td>
              <td style="font-size:11.5px;color:var(--np-text-dim);white-space:nowrap">${p.marque || '—'}</td>
              <td class="np-num np-prix-ip">${prixRef ? fmtP(prixRef) : '—'}</td>
              <td class="np-num">${p.prix_live ? fmtP(p.prix_live) : '<span style="color:var(--np-text-muted)">—</span>'}</td>
              ${cellWarn(p.prix_pharmacie)}
              ${cellWarn(p.prix_drakkars)}
              ${cellWarn(p.prix_cap3000)}
              ${cellWarn(p.prix_leclerc)}
              ${cellWarn(p.prix_maxi)}
              <td class="np-num">${p.marge_pct != null ? `<strong style="color:${p.marge_pct >= 40 ? 'var(--np-brand)' : p.marge_pct >= 20 ? 'var(--np-warning)' : 'var(--np-pink)'}">${p.marge_pct.toFixed(1)}%</strong>` : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>` : `<div class="np-empty"><div class="np-empty-pin">${npPinSvg(22)}</div><div class="np-empty-title">Aucun produit</div><div class="np-empty-sub">Aucune référence ne correspond aux filtres.</div></div>`;

  // ── Pagination (charte NP) ────────────────────
  let pagHtml = '';
  if (totalPages > 1) {
    const btns = [];
    if (offiPageNum > 1) { btns.push(`<button class="np-pag-btn" onclick="offiGoPage(1)">«</button><button class="np-pag-btn" onclick="offiGoPage(${offiPageNum-1})">‹</button>`); }
    let ps = Math.max(1, offiPageNum - 3), pe = Math.min(totalPages, ps + 6);
    if (pe - ps < 6) ps = Math.max(1, pe - 6);
    for (let p = ps; p <= pe; p++) btns.push(`<button class="np-pag-btn${p===offiPageNum?' np-active':''}" onclick="offiGoPage(${p})">${p}</button>`);
    if (offiPageNum < totalPages) { btns.push(`<button class="np-pag-btn" onclick="offiGoPage(${offiPageNum+1})">›</button><button class="np-pag-btn" onclick="offiGoPage(${totalPages})">»</button>`); }
    pagHtml = `<div class="np-pagination">${btns.join('')}</div>`;
  }

  // ── Alerts panel (concurrents < prix achat IP) ──────────────
  const alertes = offiCurrentData.filter(p => {
    const ip = p.prix_live || p.prix_offilog;
    if (!ip) return false;
    return [p.prix_drakkars, p.prix_cap3000, p.prix_leclerc, p.prix_pharmacie, p.prix_maxi]
      .some(v => v != null && v > 0 && v < ip);
  }).slice(0, 6);

  const alertsHtml = (offiRole !== 'alerte_conc' && alertes.length > 0) ? `
    <div class="np-alerts-card">
      <div class="np-alerts-header">
        <div class="np-alerts-icon">${npAlertSvg(20)}</div>
        <div>
          <div class="np-alerts-title">Veille concurrentielle</div>
          <div class="np-alerts-sub">${nAlerteConc} référence${nAlerteConc>1?'s':''} où un concurrent vend en dessous du prix d'achat Intégral Pharma</div>
        </div>
        <button class="np-btn" style="margin-left:auto;background:rgba(255,255,255,.22);border:1.5px solid rgba(255,255,255,.4);color:#fff" onclick="offiSetRole('alerte_conc')">Voir toutes →</button>
      </div>
      ${alertes.map(p => {
        const ip = p.prix_live || p.prix_offilog;
        const concList = [
          { src: 'Drakkars',  v: p.prix_drakkars  },
          { src: 'Cap3000',   v: p.prix_cap3000   },
          { src: 'E.Leclerc', v: p.prix_leclerc   },
          { src: 'Apothical', v: p.prix_pharmacie },
          { src: 'Maxipara',  v: p.prix_maxi      },
        ].filter(x => x.v != null && x.v > 0 && x.v < ip).sort((a,b) => a.v - b.v);
        const worst = concList[0];
        const idx = offiCurrentData.indexOf(p);
        return `<div class="np-alert-item" onclick="showOffiDetail(${idx})" style="cursor:pointer">
          <div class="np-alert-thumb">${p.img ? `<img src="${p.img}" alt="" onerror="this.style.display='none'">` : npPinSvg(20)}</div>
          <div class="np-alert-body">
            <div class="np-al-name">${p.produit}</div>
            <div class="np-al-meta">${p.marque || ''}${p.marque && worst ? ' · ' : ''}${worst ? `Casse-prix ${worst.src}` : ''}</div>
          </div>
          <div class="np-alert-prices">
            <span class="np-ap-conc">${fmtP(worst.v)}</span>
            <span class="np-ap-ip">Achat IP ${fmtP(ip)}</span>
            <span class="np-delta np-delta-neg np-delta-giant">−${fmtP(ip - worst.v)}</span>
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  // ── Container final (charte NP) ───────────────
  const hasFilters = offiQuery || offiRole !== 'tous' || offiUnivers !== 'tous' || offiMarque !== 'tous' || offiSaison !== 'tous' || offiSort !== 'alpha';

  container.innerHTML = `
  <div class="np-scope">
    <!-- Hero header Intégral Pharma -->
    <div class="np-hero">
      <div class="np-hero-inner" style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap">
        <div>
          <div class="np-hero-eyebrow">Intégral Pharma · Catalogue parapharmacie</div>
          <h1 class="np-hero-title">Offilog<br><span class="np-accent">veille concurrentielle</span></h1>
          <div class="np-hero-tagline">${fmtNum(nTotal)} références · ${universSet.length} univers · ${fmtNum(nImg)} avec photo</div>
        </div>
        <div class="np-hero-stats">
          <div class="np-hero-stat"><div class="np-hs-val">${fmtNum(nOff)}</div><div class="np-hs-lbl">Dans Offilog</div></div>
          <div class="np-hero-stat np-lime"><div class="np-hs-val">${fmtNum(nLive)}</div><div class="np-hs-lbl">Prix live</div></div>
          <div class="np-hero-stat"><div class="np-hs-val">${fmtNum(nLeclerc)}</div><div class="np-hs-lbl">E.Leclerc</div></div>
          ${nAlerteConc > 0 ? `<div class="np-hero-stat np-pink" onclick="offiSetRole('alerte_conc')" title="Alertes prix concurrent < achat IP"><div class="np-hs-val">${fmtNum(nAlerteConc)}</div><div class="np-hs-lbl">Alertes prix</div></div>` : ''}
          <div class="np-hero-stat"><div class="np-hs-val">${margeMoy.toFixed(0)}%</div><div class="np-hs-lbl">Marge moy.</div></div>
        </div>
      </div>
    </div>

    <!-- KPI grid pin-cards -->
    <div class="np-kpi-grid">
      <div class="np-kpi"><div class="np-kpi-icon">${npPinSvg(18)}</div><div class="np-kpi-value">${fmtNum(nTotal)}</div><div class="np-kpi-label">Total références</div></div>
      <div class="np-kpi np-kpi-pink"><div class="np-kpi-icon">${npAlertSvg(18)}</div><div class="np-kpi-value">${fmtNum(nAlerteConc)}</div><div class="np-kpi-label">En alerte prix</div></div>
      <div class="np-kpi np-kpi-lime"><div class="np-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div><div class="np-kpi-value">${fmtNum(nLeclerc)}</div><div class="np-kpi-label">Référencés Leclerc</div></div>
      <div class="np-kpi np-kpi-gray"><div class="np-kpi-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><div class="np-kpi-value">${fmtNum(nPharma)}</div><div class="np-kpi-label">Pharmacies clientes</div></div>
    </div>

    ${alertsHtml}

    <!-- Univers navigator -->
    <div class="np-univers-strip">
      <div class="np-univers-row">${univTiles}</div>
    </div>

    <!-- Search & filter toolbar -->
    <div class="np-toolbar">
      <div class="np-toolbar-row">
        <div class="np-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Rechercher une référence, marque, CIP13/EAN…" value="${offiQuery}"
            oninput="offiQuery=this.value;offiPageNum=1;renderOffilog()" autocomplete="off">
          ${offiQuery ? `<button class="np-search-clear" onclick="offiQuery='';offiPageNum=1;renderOffilog()">✕</button>` : ''}
        </div>
        <select onchange="offiSetMarque(this.value)">
          <option value="tous">Toutes marques</option>
          ${marqueSet.map(m => `<option value="${m.replace(/"/g,'&quot;')}" ${offiMarque===m?'selected':''}>${m}</option>`).join('')}
        </select>
        <select onchange="offiSort=this.value;offiPageNum=1;renderOffilog()">
          <option value="alpha"     ${offiSort==='alpha'?'selected':''}>Tri A → Z</option>
          <option value="prix_asc"  ${offiSort==='prix_asc'?'selected':''}>Prix croissant</option>
          <option value="prix_desc" ${offiSort==='prix_desc'?'selected':''}>Prix décroissant</option>
          <option value="marge_desc"${offiSort==='marge_desc'?'selected':''}>Marge décroissante</option>
          <option value="ecart"     ${offiSort==='ecart'?'selected':''}>Écart vs concurrent</option>
        </select>
        <div class="np-view-toggle">
          <button class="${offiView==='cards'?'np-active':''}" onclick="offiView='cards';renderOffilog()" title="Vue grille">⊞</button>
          <button class="${offiView==='table'?'np-active':''}" onclick="offiView='table';renderOffilog()" title="Vue tableau">☰</button>
        </div>
        <button class="np-btn np-btn-ghost" onclick="offiExportCSV()" title="Exporter en CSV">⬇ CSV</button>
        ${hasFilters ? `<button class="np-btn np-btn-danger" onclick="offiQuery='';offiRole='tous';offiUnivers='tous';offiMarque='tous';offiSaison='tous';offiSort='alpha';offiPageNum=1;renderOffilog()">✕ Réinitialiser</button>` : ''}
      </div>
      <div class="np-toolbar-row">
        ${roleChips}
      </div>
    </div>

    <div class="np-meta-bar">
      <div><strong>${fmtNum(offiCurrentData.length)}</strong> référence${offiCurrentData.length>1?'s':''} · page ${offiPageNum} / ${totalPages}</div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--np-blue)">Intégral Pharma</div>
    </div>

    ${offiView === 'table'
      ? tableHtml
      : `<div class="np-card-grid">${cardsHtml}</div>`
    }

    ${pagHtml}
  </div>`;
}

// ── OFFILOG DETAIL MODAL (charte Normandie Pharma) ─────
function showOffiDetail(idx) {
  const p = offiCurrentData[idx];
  if (!p) return;
  offiDetailProduct = p;

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
  const pharmaSet = new Set(prodSales.map(s => s.pharmacyId).filter(Boolean));

  // Comparateur prix vertical : achat IP + canaux concurrents
  const pricesRaw = [
    { label: 'Prix achat IP (Excel)', value: p.prix_offilog,   kind: 'achat' },
    { label: 'Prix Offilog live',     value: p.prix_live,      kind: 'normal' },
    { label: 'Apothical (officine)',  value: p.prix_pharmacie, kind: 'normal' },
    { label: 'Drakkars',              value: p.prix_drakkars,  kind: 'normal' },
    { label: 'Cap3000',               value: p.prix_cap3000,   kind: 'normal' },
    { label: 'E.Leclerc',             value: p.prix_leclerc,   kind: 'normal' },
    { label: 'Maxipara',              value: p.prix_maxi,      kind: 'normal' },
  ].filter(r => r.value != null && r.value > 0);

  const concVals = [p.prix_drakkars, p.prix_cap3000, p.prix_pharmacie, p.prix_leclerc, p.prix_maxi].filter(v => v != null && v > 0);
  const minConc  = concVals.length ? Math.min(...concVals) : null;
  const deltaConc = (prixIP && minConc) ? minConc - prixIP : null;

  // Flag best & alerte
  const priceRowsHtml = pricesRaw.map(pr => {
    let cls = '';
    if (pr.kind === 'achat') cls = 'np-best';
    else if (pr.value === minConc && minConc !== null && concVals.length > 1) cls = 'np-best';
    return `<div class="np-modal-price-row ${cls}">
      <span class="np-mpr-src">${pr.label}${pr.kind === 'achat' ? ' <strong style="color:var(--np-brand)">●</strong>' : ''}</span>
      <span class="np-mpr-val">${fmtP(pr.value)}</span>
    </div>`;
  }).join('');

  const imgHtml = p.img
    ? `<img src="${p.img}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div style="display:none;align-items:center;justify-content:center;color:var(--np-brand)">${npPinSvg(40)}</div>`
    : `<div style="color:var(--np-brand)">${npPinSvg(40)}</div>`;

  const navPrev = idx > 0
    ? `<button class="np-btn np-btn-ghost" onclick="document.getElementById('offi-dm').remove();showOffiDetail(${idx - 1})">← Précédent</button>`
    : `<button class="np-btn np-btn-ghost" disabled style="opacity:.4">← Précédent</button>`;
  const navNext = idx < offiCurrentData.length - 1
    ? `<button class="np-btn np-btn-ghost" onclick="document.getElementById('offi-dm').remove();showOffiDetail(${idx + 1})">Suivant →</button>`
    : `<button class="np-btn np-btn-ghost" disabled style="opacity:.4">Suivant →</button>`;

  const ventesHtml = prodSales.length ? `
    <div style="margin-top:14px;padding:14px 16px;background:var(--np-blue-lt);border-radius:14px;border:1px solid rgba(0,87,255,.18)">
      <div style="font-size:11px;font-weight:700;color:var(--np-blue-d);margin-bottom:10px;text-transform:uppercase;letter-spacing:.8px">Nos ventes officines</div>
      <div style="display:flex;gap:18px;flex-wrap:wrap">
        <div><div style="font-family:'DM Sans',sans-serif;font-weight:800;font-size:20px;color:var(--np-blue-d);font-variant-numeric:tabular-nums">${fmt(salesTotCa)}</div><div style="font-size:10px;color:var(--np-text-dim);font-weight:600;text-transform:uppercase;letter-spacing:.6px">CA HT</div></div>
        <div><div style="font-family:'DM Sans',sans-serif;font-weight:800;font-size:20px;color:var(--np-navy);font-variant-numeric:tabular-nums">${fmtNum(Math.round(salesTotQte))}</div><div style="font-size:10px;color:var(--np-text-dim);font-weight:600;text-transform:uppercase;letter-spacing:.6px">Unités</div></div>
        ${pharmaSet.size ? `<div><div style="font-family:'DM Sans',sans-serif;font-weight:800;font-size:20px;color:var(--np-navy);font-variant-numeric:tabular-nums">${pharmaSet.size}</div><div style="font-size:10px;color:var(--np-text-dim);font-weight:600;text-transform:uppercase;letter-spacing:.6px">Pharmacies</div></div>` : ''}
      </div>
    </div>` : '';

  const ameliHtml = bm ? `
    <div style="margin-bottom:18px">
      <div class="np-modal-section-title">Benchmark Ameli national</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
        ${bm.ip_qty ? `<div style="background:var(--np-surface-2);padding:14px;border-radius:12px"><div style="font-family:'DM Sans',sans-serif;font-weight:800;font-size:20px;color:var(--np-blue);font-variant-numeric:tabular-nums;letter-spacing:-.3px">${fmtNum(bm.ip_qty)}</div><div style="font-size:10px;color:var(--np-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px">Unités IP</div></div>` : ''}
        ${bm.ip_ca ? `<div style="background:var(--np-surface-2);padding:14px;border-radius:12px"><div style="font-family:'DM Sans',sans-serif;font-weight:800;font-size:20px;color:var(--np-blue);font-variant-numeric:tabular-nums;letter-spacing:-.3px">${fmt(bm.ip_ca)}</div><div style="font-size:10px;color:var(--np-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px">CA IP</div></div>` : ''}
        ${bm.rot_pharma_jan26 ? `<div style="background:var(--np-surface-2);padding:14px;border-radius:12px"><div style="font-family:'DM Sans',sans-serif;font-weight:800;font-size:20px;color:var(--np-amber);font-variant-numeric:tabular-nums;letter-spacing:-.3px">${bm.rot_pharma_jan26.toFixed(1)}</div><div style="font-size:10px;color:var(--np-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px">Rotation/mois</div></div>` : ''}
        ${bm.ip_rank_qty ? `<div style="background:var(--np-surface-2);padding:14px;border-radius:12px"><div style="font-family:'DM Sans',sans-serif;font-weight:800;font-size:20px;color:var(--np-navy);font-variant-numeric:tabular-nums;letter-spacing:-.3px">#${bm.ip_rank_qty}</div><div style="font-size:10px;color:var(--np-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px">Rang IP</div></div>` : ''}
      </div>
      ${bm.has_ameli && bm.ameli_months ? `<div class="np-modal-chart-wrap"><canvas id="offi-ameli-chart"></canvas></div>` : ''}
      ${bm.atc2 ? `<div style="font-size:11px;color:var(--np-text-dim);margin-top:4px">Classe ATC : <strong style="color:var(--np-navy)">${bm.atc2}</strong></div>` : ''}
    </div>` : '';

  const existing = document.getElementById('offi-dm');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'offi-dm';
  modal.className = 'np-scope np-modal-overlay';
  modal.innerHTML = `
    <div class="np-modal">
      <!-- Header -->
      <div class="np-modal-head">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--np-brand)">${p.univers || 'Parapharmacie'}</span>
            ${p.dans_offilog ? `<span class="np-tag np-tag-ip">IP Offilog</span>` : ''}
            ${p.rang_vente != null ? `<span class="np-tag np-tag-rank">Top #${p.rang_vente}</span>` : ''}
            ${p.saison && p.saison !== 'Toute année' ? `<span class="np-tag np-tag-saison">${p.saison === 'Printemps/Été' ? '☀ P/É' : '❄ A/H'}</span>` : ''}
          </div>
          <div style="font-family:'DM Sans',sans-serif;font-weight:800;font-size:24px;color:var(--np-navy);line-height:1.2;letter-spacing:-.5px">${p.produit}</div>
        </div>
        <button class="np-modal-close" onclick="document.getElementById('offi-dm').remove()" title="Fermer (Échap)">✕</button>
      </div>
      <!-- Body -->
      <div class="np-modal-body">
        <!-- Left: hero + ventes -->
        <div>
          <div class="np-modal-hero">
            <div class="np-mh-img">${imgHtml}</div>
            <div class="np-mh-brand">${p.marque || '—'}</div>
            <div class="np-mh-name">${p.produit}</div>
            ${p.ean ? `<div class="np-mh-ean">CIP13/EAN · ${p.ean}</div>` : ''}
          </div>
          ${ventesHtml}
        </div>
        <!-- Right: prices + benchmark -->
        <div>
          <div class="np-modal-section-title">Comparateur de prix</div>
          <div class="np-modal-prices">
            ${priceRowsHtml || '<div style="color:var(--np-text-muted);padding:14px 0">Aucun prix disponible pour cette référence.</div>'}
          </div>
          ${deltaConc != null ? `<div style="margin-bottom:18px;padding:14px 18px;border-radius:14px;background:${deltaConc > 0 ? 'var(--np-blue-lt)' : 'var(--np-rose-lt)'};border:1px solid ${deltaConc > 0 ? 'rgba(0,87,255,.25)' : 'rgba(244,63,94,.3)'};display:flex;align-items:center;gap:10px">
            <div style="color:${deltaConc > 0 ? 'var(--np-blue)' : 'var(--np-rose)'}">${deltaConc > 0 ? npPinSvg(20) : npAlertSvg(20)}</div>
            <div style="font-size:13px;font-weight:600;color:${deltaConc > 0 ? 'var(--np-blue-d)' : 'var(--np-rose)'}">
              ${deltaConc > 0
                ? `Prix d'achat IP <strong>moins cher de ${fmtP(deltaConc)}</strong> vs concurrent le moins cher`
                : `<strong>Alerte</strong> · concurrent vend ${fmtP(Math.abs(deltaConc))} sous le prix d'achat IP`}
            </div>
          </div>` : ''}
          ${ameliHtml}
          ${p.marge_pct != null ? `<div>
            <div class="np-modal-section-title">Marge pharmacien</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:12px;color:var(--np-text-dim)">Estimation officine</span>
              <span style="font-family:'DM Sans',sans-serif;font-weight:800;font-size:24px;color:${p.marge_pct >= 40 ? 'var(--np-green-d)' : p.marge_pct >= 20 ? 'var(--np-amber)' : 'var(--np-rose)'};font-variant-numeric:tabular-nums;letter-spacing:-.4px">${p.marge_pct.toFixed(1)}%</span>
            </div>
            <div style="height:8px;border-radius:4px;background:var(--np-surface-3);overflow:hidden">
              <div style="height:100%;width:${Math.min(100, p.marge_pct)}%;background:${p.marge_pct >= 40 ? 'var(--np-green)' : p.marge_pct >= 20 ? 'var(--np-amber)' : 'var(--np-rose)'};border-radius:4px;transition:width .4s"></div>
            </div>
          </div>` : ''}
        </div>
      </div>
      <!-- Footer -->
      <div class="np-modal-foot">
        ${navPrev}
        ${prixIP ? `<button class="np-btn np-btn-lime" onclick="simAddOffilog(offiDetailProduct.produit,${prixIP});this.textContent='✓ Ajouté au simulateur'">+ Simulateur</button>` : ''}
        <button class="np-btn np-btn-primary" onclick="document.getElementById('offi-dm').remove()">Fermer</button>
        ${navNext}
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function escH(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escH); }
    if (e.key === 'ArrowRight' && idx < offiCurrentData.length - 1) { modal.remove(); document.removeEventListener('keydown', escH); showOffiDetail(idx + 1); }
    if (e.key === 'ArrowLeft'  && idx > 0) { modal.remove(); document.removeEventListener('keydown', escH); showOffiDetail(idx - 1); }
  });
  document.body.appendChild(modal);

  // Draw Ameli chart (bleu Intégral Pharma)
  if (bm && bm.has_ameli && bm.ameli_months) {
    setTimeout(() => {
      const ctx = document.getElementById('offi-ameli-chart');
      if (!ctx || typeof Chart === 'undefined') return;
      const labels = ['Jan25','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc','Jan26'];
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: bm.ameli_months,
            backgroundColor: bm.ameli_months.map((v, i) => i === 12 ? '#0057FF' : 'rgba(0,87,255,.30)'),
            borderRadius: 6,
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#fff',
              borderColor: '#0057FF',
              borderWidth: 1,
              titleColor: '#0B1F4D',
              bodyColor: '#0B1F4D',
              padding: 10,
              cornerRadius: 10,
              callbacks: { label: c => ' ' + fmtNum(c.parsed.y) + ' dispensations' },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 10, family: 'DM Sans' } } },
            y: { grid: { color: 'rgba(11,31,77,.04)' }, ticks: { color: '#64748B', font: { size: 10, family: 'DM Sans' }, callback: v => fmtNum(v) } },
          }
        }
      });
    }, 80);
  }
}

// ── EMPTY STATE ───────────────────────────────
// SVG illustrations contextuelles (loupe, dossier vide, paquet, graphe, pharmacie, etc.)
const EMPTY_SVG = {
  search:   `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="27" cy="27" r="14" stroke="currentColor" stroke-width="2.5" opacity=".7"/><path d="M37.5 37.5L50 50" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M22 27h10M27 22v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".4"/></svg>`,
  folder:   `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M8 18a4 4 0 0 1 4-4h12l4 5h24a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V18z" stroke="currentColor" stroke-width="2.5" opacity=".7"/><path d="M20 32h24M20 38h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".4"/></svg>`,
  box:      `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M10 22l22-10 22 10v22L32 54 10 44V22z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" opacity=".7"/><path d="M10 22l22 10 22-10M32 32v22" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" opacity=".5"/></svg>`,
  chart:    `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M8 54h48" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".7"/><rect x="14" y="34" width="8" height="16" rx="2" stroke="currentColor" stroke-width="2.5" opacity=".5"/><rect x="28" y="22" width="8" height="28" rx="2" stroke="currentColor" stroke-width="2.5" opacity=".7"/><rect x="42" y="14" width="8" height="36" rx="2" stroke="currentColor" stroke-width="2.5" opacity=".5"/></svg>`,
  pharmacy: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="12" y="14" width="40" height="40" rx="6" stroke="currentColor" stroke-width="2.5" opacity=".7"/><path d="M32 24v20M22 34h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>`,
  bell:     `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M18 28a14 14 0 0 1 28 0v8l4 8H14l4-8v-8z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" opacity=".7"/><path d="M28 48a4 4 0 0 0 8 0" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  doc:      `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M16 10h22l12 12v32a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" opacity=".7"/><path d="M36 10v12h12M22 32h20M22 40h20M22 48h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".5"/></svg>`,
};

// Signature étendue : emptyState(icon, title, sub, ctaLabel?, ctaOnclick?)
//   icon = clé SVG (search/folder/box/chart/pharmacy/bell/doc) ou emoji legacy
//   ctaLabel + ctaOnclick = bouton CTA optionnel sous le sub
function emptyState(icon, title, sub, ctaLabel, ctaOnclick) {
  const svg = (typeof icon === 'string') ? EMPTY_SVG[icon] : null;
  const iconHtml = svg
    ? `<div class="empty-icon empty-icon--svg">${svg}</div>`
    : `<div class="empty-icon">${icon || ''}</div>`;
  const cta = (ctaLabel && ctaOnclick)
    ? `<button class="btn btn-ghost btn-sm empty-cta" onclick="${String(ctaOnclick).replace(/"/g, '&quot;')}">${ctaLabel}</button>`
    : '';
  return `<div class="empty">${iconHtml}<div class="empty-title">${title}</div><div class="empty-sub">${sub}</div>${cta}</div>`;
}

// ── INIT ──────────────────────────────────────
async function initApp() {
  if (!state.user) return;
  await load();
  await grpSyncFromStorage();

  // Si le shell JARVIS Phase 1+ est actif, on s'arrête après la data load.
  // Les données sont disponibles via window.CLIENTS / window.OFFILOG etc.
  // L'UI est gérée par crm/jarvis/main.js (carte + sheet + greeting).
  if (window.__JARVIS_SHELL_ACTIVE__) {
    console.log('[JARVIS] data loaded, legacy UI bypass');
    return;
  }

  // Guards null safety : refonte sidebar a vire certains ID (nav-admin n'existe plus)
  var elName = document.getElementById('sidebar-user-name');
  if (elName) elName.textContent = state.user.name;
  var elRole = document.getElementById('sidebar-user-role');
  if (elRole) elRole.textContent = state.user.role;
  var elAvatar = document.getElementById('sidebar-avatar');
  if (elAvatar) elAvatar.textContent = state.user.name.charAt(0);
  var elAdmin = document.getElementById('nav-admin');
  if (elAdmin) elAdmin.style.display = state.user.role === 'admin' ? 'flex' : 'none';

  updateNavBadge();
  navigate('marketing');
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
let grpProspectSearch = '';
let grpProspectAlliance = '';
let grpProspectExpanded = null;
let grpSearchModal = '';

// Membres du groupement : { grpId: [pharmacyId, ...] } — localStorage + sync Supabase Storage
const GRP_CONFIG_PATH = 'grp_config.json';

function grpLoadMembers() {
  try { return JSON.parse(localStorage.getItem('grp_members') || '{}'); } catch { return {}; }
}
function grpSaveMembers(members) {
  localStorage.setItem('grp_members', JSON.stringify(members));
  // Sync silencieux vers Supabase Storage
  const blob = new Blob([JSON.stringify(members)], { type: 'application/json' });
  sb.storage.from(STORAGE_BUCKET).upload(GRP_CONFIG_PATH, blob, { upsert: true }).catch(() => {});
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
async function grpSyncFromStorage() {
  try {
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).download(GRP_CONFIG_PATH);
    if (error || !data) return;
    const text = await data.text();
    const remote = JSON.parse(text);
    // Fusionner : remote a priorité sur localStorage
    localStorage.setItem('grp_members', JSON.stringify(remote));
  } catch {}
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
                onclick="grpAddMember('${grpId}','${ph.id}');grpRenderModal('${grpId}')">
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
  document.addEventListener('keydown', function grpEsc(e) { if (e.key === 'Escape') { modal.remove(); renderGroupements(); document.removeEventListener('keydown', grpEsc); } });
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
    { key: 'prospects',       label: 'Prospects',        icon: '🎯' },
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
  if (onglet === 'prospects')       return renderGrpProspects();
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

function grpConfirmRemove(grpId, phId) {
  const ph = state.pharmacies.find(p => String(p.id) === String(phId));
  const name = ph ? ph.name : 'ce membre';
  if (confirm('Retirer ' + name + ' du groupement ?')) grpRemoveMember(grpId, phId);
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
                <button onclick="grpConfirmRemove('${grp.id}','${ph.id}')"
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
  let { year: curY, month: curM } = getCurrentPeriod(allSales);
  if (!curY) { curY = new Date().getFullYear(); curM = new Date().getMonth() + 1; }
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


// ── Onglet Prospects groupements ──────────────────────────────

function renderGrpProspects() {
  const data = typeof GRP_PROSPECTS !== 'undefined' ? GRP_PROSPECTS : [];
  const opso = data.find(g => g.statut === 'accord');
  const prospects = data.filter(g => g.statut !== 'accord');

  // Filtre + search
  const q = grpProspectSearch.toLowerCase();
  const filtered = prospects.filter(g => {
    const matchQ = !q || g.nom.toLowerCase().includes(q)
      || (g.dirs || []).some(d => d.nom.toLowerCase().includes(q))
      || (g.alliance || '').toLowerCase().includes(q);
    const matchA = !grpProspectAlliance || g.alliance === grpProspectAlliance;
    return matchQ && matchA;
  });

  // Alliances uniques pour filtres
  const alliances = [...new Set(prospects.map(g => g.alliance).filter(Boolean))].sort();

  // Helper: chip alliance
  function allianceBadge(alliance) {
    if (!alliance) return '';
    const colors = {
      'EVECIAL GROUP': '#F59E0B', 'APSAGIR': '#10B981', 'HYGIE31': '#8B5CF6',
      'ASTERA': '#EC4899', 'OCP Phoenix': '#EF4444', 'WELCOOP': '#0EA5E9',
      'CPCSC': '#64748B', 'Federgy': '#1D4ED8',
    };
    const c = colors[alliance] || '#6366F1';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:${c}22;color:${c};white-space:nowrap">${alliance}</span>`;
  }

  // Card OPSO Santé focus
  const opsoCard = opso ? (() => {
    const dirs = (opso.dirs || []).slice(0, 4);
    const dirsHtml = dirs.map(d => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">👤</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#fff">${d.nom}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.55)">${d.fn}</div>
        </div>
      </div>`).join('');

    const contactHtml = [
      opso.telDir   ? `<a href="tel:${opso.telDir}"   style="display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.8);font-size:12px;text-decoration:none">📞 ${opso.telDir}</a>` : '',
      opso.emailDir ? `<a href="mailto:${opso.emailDir}" style="display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.8);font-size:12px;text-decoration:none">✉ ${opso.emailDir}</a>` : '',
      opso.site     ? `<a href="${opso.site}" target="_blank" style="display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.8);font-size:12px;text-decoration:none">🌐 Site web</a>` : '',
    ].filter(Boolean).join('');

    return `
    <div style="background:linear-gradient(135deg,#1e1b4b 0%,#2d2a7a 40%,#4338CA 100%);border-radius:20px;padding:24px 28px;margin-bottom:24px;position:relative;overflow:hidden">
      <div style="position:absolute;top:-40px;right:-30px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
      <div style="position:absolute;bottom:-20px;left:40%;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.03)"></div>
      <div style="position:relative">
        <!-- Badge accord signé -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;background:rgba(16,185,129,.25);border:1px solid rgba(16,185,129,.4);font-size:11px;font-weight:700;color:#34D399;letter-spacing:.5px">
            ✓ ACCORD SIGNÉ — PREMIER CLIENT
          </span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
          <!-- Gauche: identité -->
          <div>
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Groupement</div>
            <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-.5px;margin-bottom:4px">Bretagne Pharma</div>
            <div style="font-size:14px;color:rgba(255,255,255,.5);margin-bottom:16px">Groupe OPSO Santé · Normandie Pharma</div>
            ${opso.nbAdherents ? `<div style="font-size:13px;color:rgba(255,255,255,.7);margin-bottom:6px">🏪 ${opso.nbAdherents} pharmacies adhérentes</div>` : ''}
            ${opso.alliance ? `<div style="margin-bottom:12px">${allianceBadge(opso.alliance)}</div>` : ''}
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">${contactHtml}</div>
          </div>
          <!-- Droite: décideurs -->
          <div>
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">Interlocuteurs clés</div>
            ${dirsHtml || '<div style="color:rgba(255,255,255,.4);font-size:13px">Aucun décideur identifié</div>'}
          </div>
        </div>
      </div>
    </div>`;
  })() : '';

  // Filtres alliance
  const filtersHtml = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      <button onclick="grpProspectAlliance='';renderGroupements()"
        style="padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;border:1.5px solid ${!grpProspectAlliance ? 'var(--blue)' : 'var(--border2)'};background:${!grpProspectAlliance ? 'rgba(0,87,255,.1)' : 'var(--bg2)'};color:${!grpProspectAlliance ? 'var(--blue)' : 'var(--text3)'};cursor:pointer">
        Tous (${prospects.length})
      </button>
      ${alliances.map(a => {
        const colors = {'EVECIAL GROUP':'#F59E0B','APSAGIR':'#10B981','HYGIE31':'#8B5CF6','ASTERA':'#EC4899','OCP Phoenix':'#EF4444','WELCOOP':'#0EA5E9','CPCSC':'#64748B','Federgy':'#1D4ED8'};
        const c = colors[a] || '#6366F1';
        const cnt = prospects.filter(g => g.alliance === a).length;
        const active = grpProspectAlliance === a;
        return `<button onclick="grpProspectAlliance='${a}';renderGroupements()"
          style="padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;border:1.5px solid ${active ? c : 'var(--border2)'};background:${active ? c + '18' : 'var(--bg2)'};color:${active ? c : 'var(--text3)'};cursor:pointer">
          ${a} (${cnt})
        </button>`;
      }).join('')}
    </div>`;

  // Table prospects
  const rowsHtml = filtered.map(g => {
    const dir1 = (g.dirs || [])[0];
    const dir2 = (g.dirs || [])[1];
    const expanded = grpProspectExpanded === g.nom;
    const extraDirs = (g.dirs || []).slice(2);

    const expandedHtml = expanded ? `
      <tr>
        <td colspan="8" style="padding:0">
          <div style="background:var(--bg);border-top:1px solid var(--border2);padding:16px 20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
            ${extraDirs.length ? `<div>
              <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Autres décideurs</div>
              ${extraDirs.map(d => `<div style="font-size:12px;color:var(--text);margin-bottom:4px"><span style="font-weight:600">${d.nom}</span> <span style="color:var(--text3);font-size:11px">${d.fn}</span></div>`).join('')}
            </div>` : ''}
            ${g.email ? `<div><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Email groupement</div><a href="mailto:${g.email}" style="font-size:12px;color:var(--blue)">${g.email}</a></div>` : ''}
            ${g.cotisation ? `<div><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Cotisation</div><div style="font-size:12px;color:var(--text)">${g.cotisation}</div></div>` : ''}
            ${g.siren ? `<div><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">SIREN</div><div style="font-size:12px;color:var(--text)">${g.siren}</div></div>` : ''}
            ${g.site ? `<div><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Site web</div><a href="${g.site}" target="_blank" style="font-size:12px;color:var(--blue)">${g.site}</a></div>` : ''}
            ${g.adresse ? `<div><div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Adresse</div><div style="font-size:12px;color:var(--text)">${g.adresse}</div></div>` : ''}
          </div>
        </td>
      </tr>` : '';

    return `
      <tr style="border-bottom:1px solid var(--border);cursor:pointer;background:${expanded ? 'var(--bg)' : ''}"
          onclick="grpProspectExpanded=grpProspectExpanded==='${g.nom.replace(/'/g,"\\'")}' ? null : '${g.nom.replace(/'/g,"\\'")}';renderGroupements()">
        <td style="padding:10px 14px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${g.nom}</div>
          ${g.alliance ? `<div style="margin-top:3px">${allianceBadge(g.alliance)}</div>` : ''}
        </td>
        <td style="padding:10px 12px">
          ${dir1 ? `<div style="font-size:12px;font-weight:600;color:var(--text)">${dir1.nom}</div><div style="font-size:11px;color:var(--text3)">${dir1.fn}</div>` : '<span style="color:var(--text4);font-size:11px">—</span>'}
        </td>
        <td style="padding:10px 12px">
          ${dir2 ? `<div style="font-size:12px;font-weight:600;color:var(--text)">${dir2.nom}</div><div style="font-size:11px;color:var(--text3)">${dir2.fn}</div>` : '<span style="color:var(--text4);font-size:11px">—</span>'}
        </td>
        <td style="padding:10px 12px;white-space:nowrap">
          ${g.telDir ? `<a href="tel:${g.telDir}" onclick="event.stopPropagation()" style="font-size:12px;color:var(--mint);text-decoration:none;font-weight:600">${g.telDir}</a>` : '<span style="color:var(--text4);font-size:11px">—</span>'}
        </td>
        <td style="padding:10px 12px">
          ${g.emailDir ? `<a href="mailto:${g.emailDir}" onclick="event.stopPropagation()" style="font-size:12px;color:var(--blue);text-decoration:none">${g.emailDir}</a>` : '<span style="color:var(--text4);font-size:11px">—</span>'}
        </td>
        <td style="padding:10px 12px;text-align:center">
          ${g.nbAdherents != null ? `<span style="font-size:13px;font-weight:700;color:var(--text)">${g.nbAdherents}</span>` : '<span style="color:var(--text4);font-size:11px">—</span>'}
        </td>
        <td style="padding:10px 12px;text-align:center">
          ${g.nbLabos != null ? `<span style="font-size:12px;color:var(--text2)">${g.nbLabos}</span>` : '<span style="color:var(--text4);font-size:11px">—</span>'}
        </td>
        <td style="padding:10px 12px;text-align:center">
          <span style="font-size:10px;color:var(--text3)">${expanded ? '▲' : '▼'}</span>
        </td>
      </tr>
      ${expandedHtml}`;
  }).join('');

  return `
  ${opsoCard}

  <div class="card">
    <div class="card-header" style="flex-wrap:wrap;gap:12px">
      <div>
        <div class="card-title">Prospects groupements</div>
        <div class="card-subtitle">${filtered.length} groupement${filtered.length > 1 ? 's' : ''} · ${filtered.filter(g => g.dirs && g.dirs.length > 0).length} avec décideurs identifiés</div>
      </div>
      <input type="text" placeholder="Rechercher groupement, décideur…" value="${grpProspectSearch}"
        oninput="grpProspectSearch=this.value;renderGroupements()"
        style="padding:7px 14px;border-radius:10px;border:1.5px solid var(--border2);background:var(--bg2);font-size:13px;color:var(--text);min-width:220px;outline:none"
        onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border2)'">
    </div>

    ${filtersHtml}

    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid var(--border2)">
            <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--text3)">Groupement</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--text3)">Décideur 1</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--text3)">Décideur 2</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--mint)">Tél direct</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--blue)">Email direct</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:var(--text3)">Adhérents</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:var(--text3)">Labos</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:var(--text3)"></th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="8" style="padding:32px;text-align:center;color:var(--text3)">Aucun résultat</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function proposerCommande(pharmacyId) {
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) return;

  const allPhSales = getSales({ pharmacyId: pharma.id });
  if (!allPhSales.length) { showToast('Aucune donnée pour cette pharmacie', 'error'); return; }

  const { year, month } = getCurrentPeriod(allPhSales);
  const lastSales = getSales({ pharmacyId: pharma.id, year, month });
  if (!lastSales.length) { showToast('Aucune vente pour la période en cours', 'error'); return; }

  const modal = document.createElement('div');
  modal.id = 'proposer-cmd-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:2000;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg1);border:1px solid var(--border2);border-radius:20px;max-width:480px;width:100%;padding:28px;box-shadow:0 24px 64px rgba(0,0,0,.4)">
      <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">🛒 Proposer une commande</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px">${pharma.name} · basé sur ${monthName(month)} ${year}</div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:700;color:var(--text2);display:block;margin-bottom:6px">Facteur de croissance</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${[100,105,110,115,120].map(pct => `
            <button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.style.background='');this.style.background='var(--blue)';this.style.color='#fff';document.getElementById('growth-input').value=${pct}"
              style="padding:6px 14px;border-radius:8px;border:1px solid var(--border2);background:${pct===100?'var(--blue)':'transparent'};color:${pct===100?'#fff':'var(--text2)'};cursor:pointer;font-size:12px;font-weight:600">${pct === 100 ? 'Identique' : '+' + (pct-100) + '%'}</button>`).join('')}
        </div>
        <input type="number" id="growth-input" value="100" min="50" max="200" step="1"
          style="margin-top:10px;width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border2);background:var(--bg2);font-size:13px;color:var(--text);box-sizing:border-box">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button onclick="document.getElementById('proposer-cmd-modal').remove()" style="padding:8px 18px;border-radius:10px;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-size:13px">Annuler</button>
        <button onclick="confirmerCommande('${pharma.id}',${year},${month})" style="padding:8px 18px;border-radius:10px;border:none;background:var(--blue);color:#fff;cursor:pointer;font-size:13px;font-weight:700">Créer la simulation →</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function pcEsc(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', pcEsc); } });
}

function confirmerCommande(pharmacyId, year, month) {
  const factor = parseFloat(document.getElementById('growth-input')?.value || '100') / 100;
  document.getElementById('proposer-cmd-modal')?.remove();

  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) return;

  const sales = getSales({ pharmacyId: pharma.id, year, month });
  const aggMap = {};
  for (const s of sales) {
    const k = (s.artDesignation || '').trim().toUpperCase();
    if (!k) continue;
    if (!aggMap[k]) aggMap[k] = { designation: s.artDesignation, artCode: s.artCode, puNet: s.puNet, qte: 0, cat: classifyProduct(s) };
    aggMap[k].qte += s.qte;
    if (s.puNet > 0) aggMap[k].puNet = s.puNet;
  }

  const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  state.sim.pharmacyId = pharma.id;
  state.sim.name = `${pharma.name} — ${monthName(month)} ${year}${factor !== 1 ? ' ×'+factor.toFixed(2) : ''}`;
  state.sim.items = Object.values(aggMap)
    .filter(r => r.qte > 0 && r.puNet > 0)
    .map(r => {
      const bench = typeof BENCHMARK !== 'undefined' ? BENCHMARK.find(b => nn(b.designation) === nn(r.designation)) : null;
      const puNet = bench?.prix_ip > 0 ? bench.prix_ip : r.puNet;
      return {
        designation: r.designation,
        code: r.artCode || (bench?.cip13 || ''),
        cat: r.cat,
        froid: bench?.is_froid || false,
        hasAmeli: bench?.has_ameli || false,
        rot: bench?.rot_pharma_jan26 || null,
        puNet,
        puBrut: puNet * 1.05,
        qty: Math.max(1, Math.round(r.qte * factor)),
      };
    })
    .sort((a, b) => (b.qty * b.puNet) - (a.qty * a.puNet));

  showToast(`${state.sim.items.length} produits chargés dans le simulateur`, 'success');
  navigate('simulateur');
}

function simFromWmlMissed(pharmacyId) {
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) return;
  const wmlVis = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
  const nnSim = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const wmlEntry = wmlVis.find(d => nnSim(d.nom) === nnSim(pharma.name));
  if (!wmlEntry || !wmlEntry.pr || !wmlEntry.pr.length) {
    showToast('Aucune donnée WML pour cette pharmacie', 'error'); return;
  }
  const allPhSales = getSales({ pharmacyId: pharma.id });
  const directNames = new Set(allPhSales.map(s => nnSim(s.artDesignation)));
  const missed = wmlEntry.pr.filter(([nom]) => nom && !directNames.has(nnSim(nom)));
  if (!missed.length) { showToast('Tous les produits WML sont déjà commandés en direct', 'info'); return; }
  state.sim.pharmacyId = pharma.id;
  state.sim.name = `WML manquants → ${pharma.name}`;
  state.sim.items = missed.map(([nom, ca, mg, qt, ean]) => {
    const offi = typeof OFFILOG !== 'undefined' ? OFFILOG.find(p => nnSim(p.produit) === nnSim(nom)) : null;
    const puNet = offi && offi.prix_offilog > 0 ? offi.prix_offilog : (qt > 0 ? ca / qt : 0);
    const bench = typeof BENCHMARK !== 'undefined' ? BENCHMARK.find(b => nnSim(b.designation) === nnSim(nom)) : null;
    return {
      designation: nom,
      code: bench?.cip13 || '',
      cat: bench ? (bench.categorie || 'nr') : 'nr',
      froid: bench?.is_froid || false,
      puNet: puNet > 0 ? puNet : (ca && qt ? ca/qt : 1),
      puBrut: (puNet > 0 ? puNet : 1) * 1.05,
      qty: Math.max(1, Math.round((qt || 4) / 4)),
    };
  }).filter(it => it.puNet > 0);
  document.getElementById('fiche-visite-modal')?.remove();
  navigate('simulateur');
  setTimeout(() => renderSimulator(), 80);
  showToast(`${state.sim.items.length} produits WML chargés dans le simulateur`, 'success');
}

function filterPharmaHistTable(q) {
  const tbody = document.getElementById('pharma-hist-tbody');
  if (!tbody) return;
  const ql = q.toLowerCase().trim();
  tbody.querySelectorAll('tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (!cells.length) return;
    const text = cells[1]?.textContent?.toLowerCase() || '';
    row.style.display = (!ql || text.includes(ql)) ? '' : 'none';
  });
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

  // Veille prix parapharmacie — produits achetés par cette pharmacie avec données concurrents
  const offiAlertes = (() => {
    if (typeof OFFILOG === 'undefined') return [];
    const nnk = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const results = [];
    for (const [k, prod] of Object.entries(byProd)) {
      const op = OFFILOG.find(p => nnk(p.produit) === k);
      if (!op) continue;
      const concMap = [
        op.prix_drakkars  > 0 ? [op.prix_drakkars,  'Drakkars',  '#6366f1'] : null,
        op.prix_cap3000   > 0 ? [op.prix_cap3000,   'Cap3000',   '#ea580c'] : null,
        op.prix_leclerc   > 0 ? [op.prix_leclerc,   'Leclerc',   '#0072e6'] : null,
        op.prix_pharmacie > 0 ? [op.prix_pharmacie, 'Apothical', '#00E5A0'] : null,
        op.prix_maxi      > 0 ? [op.prix_maxi,      'Maxipara',  '#FFB020'] : null,
      ].filter(Boolean);
      if (!concMap.length) continue;
      const sorted = concMap.slice().sort((a, b) => a[0] - b[0]);
      results.push({ label: prod.label, sorted, prixAchat: op.prix_offilog || op.prix_live });
    }
    return results.slice(0, 5);
  })();

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Load saved visit notes for fiche
  let savedNotesFiche = [];
  try { savedNotesFiche = JSON.parse(localStorage.getItem(`visit_notes_${pharma.id}`) || '[]'); } catch {}
  savedNotesFiche = savedNotesFiche.slice(0, 5);

  // WML lookup for this pharmacy
  const nnWmlFv = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const wmlVisFv = typeof getWmlVisible === 'function' ? getWmlVisible() : [];
  const wmlEntryFv = wmlVisFv.find(d => nnWmlFv(d.nom) === nnWmlFv(pharma.name)) || null;

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

        <!-- WML Achats IP -->
        ${wmlEntryFv ? `
        <div style="margin-bottom:20px;padding:14px 16px;background:#f0fdf4;border-radius:12px;border-left:3px solid #14B86A">
          <div style="font-size:11px;font-weight:800;color:#0d8530;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">📦 Achats Intégral Pharma — WML Jan–Avr 2026</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
            <div style="text-align:center;padding:8px;background:#fff;border-radius:8px">
              <div style="font-size:16px;font-weight:900;color:#0d8530">${fmt(wmlEntryFv.ca)}</div>
              <div style="font-size:10px;color:#64748b">CA total</div>
            </div>
            <div style="text-align:center;padding:8px;background:#fff;border-radius:8px">
              <div style="font-size:16px;font-weight:900;color:#0d8530">${fmt(wmlEntryFv.mg)}</div>
              <div style="font-size:10px;color:#64748b">Marge brute</div>
            </div>
            <div style="text-align:center;padding:8px;background:#fff;border-radius:8px">
              <div style="font-size:16px;font-weight:900;color:#d97706">${wmlEntryFv.ca > 0 ? (wmlEntryFv.mg/wmlEntryFv.ca*100).toFixed(1) : '0'}%</div>
              <div style="font-size:10px;color:#64748b">Taux marge</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:10px">
            ${(wmlEntryFv.ca_m||[]).map((v,i) => {
              const mo = ['Jan','Fév','Mar','Avr'][i] || '';
              return `<div style="flex:1;text-align:center">
                <div style="font-size:10px;font-weight:700;color:${v>0?'#0d8530':'#94a3b8'};margin-bottom:3px">${v>0?fmt(v):'—'}</div>
                <div style="height:6px;border-radius:3px;background:${v>0?'#14B86A':'#e2e8f0'}"></div>
                <div style="font-size:9px;color:#94a3b8;margin-top:2px">${mo}</div>
              </div>`;
            }).join('')}
          </div>
          ${(wmlEntryFv.pr||[]).length > 0 ? `
          <div style="font-size:10px;font-weight:700;color:#0d8530;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">Top produits achetés</div>
          ${(wmlEntryFv.pr||[]).slice(0,3).map(([nom,ca,mg,qt],i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #d1fae5">
              <div style="font-size:11px;font-weight:600;color:#1e293b;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i+1}. ${nom}</div>
              <div style="font-size:11px;font-weight:700;color:#0d8530;margin-left:8px;flex-shrink:0">${fmt(ca)}</div>
            </div>`).join('')}
          ` : ''}
          ${(() => {
            const nnFv2 = s => (s||'').trim().toUpperCase().replace(/\s+/g,' ');
            const directNamesFv = new Set(allPhSales.map(s => nnFv2(s.artDesignation)));
            const missedFv = (wmlEntryFv.pr||[]).filter(([nom]) => nom && !directNamesFv.has(nnFv2(nom)));
            if (!missedFv.length) return '';
            const totCaFv = missedFv.reduce((s,[,ca])=>s+ca,0);
            return `<div style="margin-top:10px;padding:10px;background:#fffbeb;border-radius:8px;border-left:2px solid #d97706">
              <div style="font-size:10px;font-weight:800;color:#92400e;text-transform:uppercase;margin-bottom:6px">À proposer (WML non commandés · ${fmt(totCaFv)})</div>
              ${missedFv.slice(0,4).map(([nom,ca,,qt]) => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #fde68a;font-size:11px">
                <span style="font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">→ ${nom}</span>
                <span style="font-weight:700;color:#d97706;margin-left:8px;white-space:nowrap">${fmt(ca)} · ${Math.round(qt)} u</span>
              </div>`).join('')}
              ${missedFv.length > 4 ? `<div style="font-size:10px;color:#92400e;margin-top:4px">+${missedFv.length-4} autres</div>` : ''}
              <button onclick="simFromWmlMissed('${pharma.id}')" style="margin-top:8px;width:100%;padding:7px;border-radius:8px;border:none;background:#d97706;color:#fff;cursor:pointer;font-size:12px;font-weight:700">🛒 Simuler commande WML</button>
            </div>`;
          })()}
        </div>` : ''}

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

        <!-- Prix parapharmacie concurrents -->
        ${offiAlertes.length ? `
        <div style="margin-bottom:20px">
          <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Prix parapharmacie concurrents</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:8px">Prix de vente constatés — Drakkars · Cap3000 · Leclerc · Apothical · Maxipara</div>
          ${offiAlertes.map(a => `
            <div style="padding:7px 0;border-bottom:1px solid #f1f5f9">
              <div style="font-size:12px;font-weight:600;color:#1e293b;margin-bottom:3px">${a.label}${a.prixAchat ? `<span style="font-size:10px;color:#94a3b8;font-weight:400;margin-left:6px">achat IP ${fmtP(a.prixAchat)}</span>` : ''}</div>
              <div style="display:flex;gap:5px;flex-wrap:wrap">
                ${a.sorted.map(([prix, src, col]) => `<span style="font-size:10px;padding:1px 7px;border-radius:6px;background:${col}18;color:${col};font-weight:600">${src} ${fmtP(prix)}</span>`).join('')}
              </div>
            </div>`).join('')}
        </div>` : ''}

        <!-- Notes -->
        <div style="margin-bottom:8px">
          <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Notes de visite</div>
          ${savedNotesFiche.length ? `
          <div style="margin-bottom:10px">
            ${savedNotesFiche.map(n => `
              <div style="padding:6px 10px;margin-bottom:4px;background:#f8fafc;border-radius:7px;border-left:3px solid #0057FF">
                <div style="font-size:9px;color:#94a3b8;margin-bottom:2px">${n.date}</div>
                <div style="font-size:11px;color:#1e293b;white-space:pre-wrap">${(n.text||'').replace(/</g,'&lt;')}</div>
              </div>`).join('')}
          </div>` : ''}
          <div style="border:1.5px dashed #cbd5e1;border-radius:8px;min-height:60px;padding:10px;font-size:12px;color:#94a3b8">Note de cette visite : ___________</div>
        </div>
      </div>

      <!-- Actions -->
      <div style="padding:16px 28px;border-top:1px solid #e2e8f0;display:flex;gap:10px;justify-content:flex-end">
        <button onclick="copyFicheResume('${pharmacyId}')" style="padding:9px 20px;border-radius:10px;border:1.5px solid #059669;background:#ecfdf5;color:#047857;font-size:13px;font-weight:700;cursor:pointer">📋 Copier résumé</button>
        <button onclick="window.print()" style="padding:9px 20px;border-radius:10px;border:1.5px solid #2563EB;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:700;cursor:pointer">🖨 Imprimer</button>
        <button onclick="document.getElementById('fiche-visite-modal').remove()" style="padding:9px 20px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:13px;font-weight:700;cursor:pointer">Fermer</button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function fvEsc(e) { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', fvEsc); } });
  document.body.appendChild(modal);
}


function copyFicheResume(pharmacyId) {
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) return;
  const allPhSales = getSales({ pharmacyId: pharma.id });
  const { year: curY, month: curM } = getCurrentPeriod(allPhSales.length ? allPhSales : getSales());
  const { year: prevY, month: prevM } = getPrevPeriod(curY, curM);
  const salesCur  = curY  ? getSales({ pharmacyId: pharma.id, year: curY, month: curM  }) : [];
  const salesPrev = prevY ? getSales({ pharmacyId: pharma.id, year: prevY, month: prevM }) : [];
  const caCur  = sumCA(salesCur);
  const caPrev = sumCA(salesPrev);
  const curLabel  = curY  ? monthName(curM) + ' ' + curY  : '—';
  const prevLabel = prevY ? monthName(prevM) + ' ' + prevY : '—';
  const byProd = {};
  for (const s of salesCur) {
    const k = (s.artDesignation || '').trim().toUpperCase();
    if (!k) continue;
    if (!byProd[k]) byProd[k] = { label: s.artDesignation, ca: 0, qte: 0 };
    byProd[k].ca  += s.mntNetHt;
    byProd[k].qte += s.qte;
  }
  const top5 = Object.values(byProd).sort((a, b) => b.ca - a.ca).slice(0, 5);
  const nn = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const ourNorms = new Set(Object.keys(byProd));
  const addOpps = typeof BENCHMARK !== 'undefined'
    ? BENCHMARK.filter(b => b.rot_pharma_jan26 > 2 && b.prix_ip > 0 && !ourNorms.has(nn(b.designation)))
        .sort((a, b) => b.rot_pharma_jan26 - a.rot_pharma_jan26).slice(0, 3)
    : [];
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const delta = caPrev > 0 ? ((caCur - caPrev) / caPrev * 100).toFixed(0) : null;
  const deltaStr = delta ? (delta >= 0 ? ' (+' + delta + '%)' : ' (' + delta + '%)') : '';
  let lines = [
    '📋 Compte-rendu — ' + pharma.name,
    '📅 ' + today,
    '',
    'CA ' + curLabel + ' : ' + fmt(caCur) + deltaStr,
    caPrev > 0 ? 'CA ' + prevLabel + ' : ' + fmt(caPrev) : null,
  ].filter(l => l !== null);
  if (top5.length) {
    lines.push('');
    lines.push('🏆 Top produits :');
    top5.forEach((p, i) => lines.push((i + 1) + '. ' + p.label + ' — ' + fmt(p.ca)));
  }
  if (addOpps.length) {
    lines.push('');
    lines.push('💡 À proposer :');
    addOpps.forEach(b => lines.push('• ' + b.designation + ' (' + b.rot_pharma_jan26.toFixed(1) + ' rot./ph)'));
  }
  const text = lines.join('\n');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Résumé copié — prêt à coller', 'success'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Résumé copié', 'success');
  }
}

// ── BOOT ──────────────────────────────────────
// ── GLOBAL SEARCH (Cmd+K) ────────────────────
let globalSearchQuery = '';

function showGlobalSearch() {
  const existing = document.getElementById('global-search-modal');
  if (existing) { closeAppModal(existing); return; }

  globalSearchQuery = '';
  const modal = document.createElement('div');
  modal.id = 'global-search-modal';
  modal.className = 'app-modal app-modal-search';
  modal.innerHTML = `
    <div class="app-modal-panel app-modal-panel-search" role="document">
      <div class="app-modal-head app-modal-head-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="app-modal-search-ico" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="gs-input" type="text" placeholder="Rechercher produit, pharmacie, marque, EAN…"
          class="app-modal-search-input" data-autofocus
          oninput="gsSearch(this.value)" autocomplete="off" spellcheck="false"
          aria-label="Recherche globale">
        <span class="app-modal-kbd" aria-hidden="true">ESC</span>
        <button type="button" class="app-modal-close-btn" aria-label="Fermer" onclick="closeAppModal(document.getElementById('global-search-modal'))">&times;</button>
      </div>
      <div id="gs-results" class="app-modal-body app-modal-body-search">
        <div class="app-modal-empty">Tapez au moins 2 caractères…</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal(modal, { labelledBy: null });
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

  // Search sales (current period products)
  const salesHits = (() => {
    const allS = getSales();
    if (!allS.length) return [];
    const { year: curY, month: curM } = getCurrentPeriod(allS);
    const curSales = getSales({ year: curY, month: curM });
    const byProd = {};
    for (const s of curSales) {
      const k = (s.artDesignation||'').trim().toUpperCase();
      if (!k || !k.toLowerCase().includes(ql)) continue;
      if (!byProd[k]) byProd[k] = { label: s.artDesignation, ca: 0, qte: 0, cat: classifyProduct(s) };
      byProd[k].ca  += s.mntNetHt;
      byProd[k].qte += s.qte;
    }
    return Object.values(byProd).sort((a, b) => b.ca - a.ca).slice(0, 3);
  })();

  // Search visit notes
  const noteHits = [];
  for (const ph of (state.pharmacies || [])) {
    const key = `visit_notes_${ph.id}`;
    let notes = [];
    try { notes = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    for (const n of notes) {
      if ((n.text||'').toLowerCase().includes(ql)) {
        noteHits.push({ ph, note: n });
        if (noteHits.length >= 3) break;
      }
    }
    if (noteHits.length >= 3) break;
  }

  const total = offiHits.length + benchHits.length + pharmaHits.length + clientHits.length + noteHits.length + salesHits.length;
  if (total === 0) {
    res.innerHTML = emptyState('search', 'Aucun résultat', `Rien ne correspond à « ${globalSearchQuery} ». Essayez un autre terme ou vérifiez l'orthographe.`);
    return;
  }

  const highlight = str => {
    const re = new RegExp(`(${globalSearchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    return (str||'').replace(re, '<mark style="background:#fef08a;color:#713f12;border-radius:2px;padding:0 1px">$1</mark>');
  };

  let html = '';

  if (salesHits.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:1px">Mes ventes — mois courant (${salesHits.length})</div>`;
    html += salesHits.map(p => {
      const cat = CATS[p.cat] || CATS.mi;
      return `<div onclick="document.getElementById('global-search-modal').remove();prodTableQuery='${(p.label||'').replace(/'/g,"\\'").slice(0,30)}';navigate('produits');setTimeout(()=>renderProduits(),100)"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .1s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="width:36px;height:36px;border-radius:8px;background:${cat.color}18;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${cat.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${highlight(p.label)}</div>
          <div style="font-size:11px;color:var(--text3)">${cat.label} · ${fmt(p.ca)} · ${fmtNum(Math.round(p.qte))} unités</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><path d="m9 18 6-6-6-6"/></svg>
      </div>`;
    }).join('');
  }

  if (offiHits.length) {
    const um = u => univMeta(u || 'Non classé');
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:${OFFILOG_ORANGE};text-transform:uppercase;letter-spacing:1px">Catalogue Parapharmacie (${offiHits.length})</div>`;
    html += offiHits.map((p, i) => {
      const m = um(p.univers);
      const hasConcData = [p.prix_drakkars, p.prix_cap3000, p.prix_leclerc, p.prix_pharmacie, p.prix_maxi].some(v => v != null && v > 0);
      return `<div onclick="document.getElementById('global-search-modal').remove();offiQuery='${p.produit.replace(/'/g,"\\'").replace(/"/g,'&quot;').slice(0,30)}';navigate('offilog');setTimeout(()=>renderOffilog(),100)"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .1s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="width:36px;height:36px;border-radius:8px;background:${m.bg};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${m.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${highlight(p.produit)}${hasConcData ? ' <span style="font-size:10px;color:var(--blue);background:rgba(0,87,255,.08);padding:1px 5px;border-radius:6px">prix</span>' : ''}</div>
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

  if (noteHits.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:var(--rose);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Notes de visite (${noteHits.length})</div>`;
    html += noteHits.map(({ ph, note }) => `
      <div onclick="document.getElementById('global-search-modal').remove();showPharmaDetail('${ph.id}')"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .1s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,77,109,.1);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">📝</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:var(--text)">${ph.name} <span style="font-weight:400;color:var(--text3);font-size:11px">· ${note.date}</span></div>
          <div style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${highlight(note.text)}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><path d="m9 18 6-6-6-6"/></svg>
      </div>`).join('');
  }

  if (wmlProdHits.length) {
    html += `<div style="padding:8px 12px 4px;font-size:10px;font-weight:700;color:#14B86A;text-transform:uppercase;letter-spacing:1px;margin-top:4px">Produits WML groupement (${wmlProdHits.length})</div>`;
    html += wmlProdHits.map(h => `
      <div onclick="document.getElementById('global-search-modal').remove();navigate('wml');setTimeout(renderWml,80)"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .1s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(20,184,106,.14);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">📦</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${highlight(h.nom)}</div>
          <div style="font-size:11px;color:var(--text3)">${h.pharmaName} · ${fmt(h.ca)}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><path d="m9 18 6-6-6-6"/></svg>
      </div>`).join('');
  }

  res.innerHTML = html;
}

function showLoginForm() {
  document.getElementById('login-form').style.display  = '';
  document.getElementById('reset-form').style.display  = 'none';
  document.getElementById('newpass-form').style.display = 'none';
}
function showResetForm() {
  document.getElementById('login-form').style.display  = 'none';
  document.getElementById('reset-form').style.display  = '';
  document.getElementById('newpass-form').style.display = 'none';
  document.getElementById('reset-email').focus();
}
function showNewPassForm() {
  document.getElementById('login-form').style.display  = 'none';
  document.getElementById('reset-form').style.display  = 'none';
  document.getElementById('newpass-form').style.display = '';
  document.getElementById('newpass-input').focus();
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginScreen = document.getElementById('login-screen');
  const appEl       = document.getElementById('app');

  // Détection lien recovery Supabase (#type=recovery dans le hash)
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  if (hashParams.get('type') === 'recovery') {
    const accessToken  = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken) {
      await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' });
    }
    showNewPassForm();
    // Nettoyer le hash sans rechargement
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      state.user = null;
      appEl.classList.remove('visible');
      loginScreen.style.display = 'flex';
      showLoginForm();
    } else if (event === 'PASSWORD_RECOVERY') {
      loginScreen.style.display = 'flex';
      showNewPassForm();
    }
  });

  if (await restoreSession()) {
    loginScreen.style.display = 'none';
    appEl.classList.add('visible');
    await initApp();
  }

  // Restore sidebar collapsed state au boot
  if (typeof restoreSidebarState === 'function') restoreSidebarState();

  // Raccourcis clavier globaux
  document.addEventListener('keydown', e => {
    const target = e.target;
    const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    // Cmd/Ctrl + K : recherche globale
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      showGlobalSearch();
      return;
    }
    // Cmd/Ctrl + B : toggle sidebar
    if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      if (typeof toggleSidebar === 'function') toggleSidebar();
      return;
    }
    // Cmd/Ctrl + ArrowLeft : retour
    if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft' && !inField) {
      if (window._navHistory && window._navHistory.length) {
        e.preventDefault();
        navBack();
      }
      return;
    }
    // "?" : cheatsheet (uniquement si pas dans un champ)
    if (e.key === '?' && !inField && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      showShortcutsHelp();
      return;
    }
    // Escape : ferme overlay sidebar mobile
    if (e.key === 'Escape' && document.documentElement.dataset.sidebarMobile === 'open') {
      closeSidebarMobile();
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

  document.getElementById('reset-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    const msg   = document.getElementById('reset-msg');
    const btn   = e.target.querySelector('button[type=submit]');

    btn.disabled    = true;
    btn.textContent = 'Envoi…';

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://willmorel49-coder.github.io/jarvis-app/crm/'
    });

    if (error) {
      msg.textContent  = 'Erreur : ' + error.message;
      msg.style.color  = 'var(--rose)';
    } else {
      msg.textContent  = 'Email envoyé ! Vérifiez votre boîte mail.';
      msg.style.color  = 'var(--mint)';
    }
    msg.style.display = 'block';
    btn.disabled      = false;
    btn.textContent   = 'Envoyer le lien →';
  });

  document.getElementById('newpass-form').addEventListener('submit', async e => {
    e.preventDefault();
    const newPassword = document.getElementById('newpass-input').value;
    const errEl       = document.getElementById('newpass-error');
    const btn         = e.target.querySelector('button[type=submit]');

    if (newPassword.length < 6) {
      errEl.textContent  = 'Le mot de passe doit faire au moins 6 caractères.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Enregistrement…';

    const { error } = await sb.auth.updateUser({ password: newPassword });

    if (error) {
      errEl.textContent   = 'Erreur : ' + error.message;
      errEl.style.display = 'block';
      btn.disabled        = false;
      btn.textContent     = 'Enregistrer →';
    } else {
      await sb.auth.signOut();
      showLoginForm();
      document.getElementById('login-error').textContent  = 'Mot de passe mis à jour — connectez-vous.';
      document.getElementById('login-error').style.color  = 'var(--mint)';
      document.getElementById('login-error').classList.add('show');
    }
  });
});
