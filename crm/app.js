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
  const get = (...keys) => { for (const k of keys) if (row[k] !== undefined) return row[k]; return ''; };
  return {
    artDesignation: get('ARTDESIGNATION','Art Designation','designation'),
    artCode:        get('ARTCODE','Art Code','code'),
    artId:          get('ARTID','Art ID','id'),
    qte:            parseFloat(get('PLVQTE','Qte','qte')) || 0,
    puBrut:         parseFloat(get('PLVPUBRUT_MOY','PU Brut','pu_brut')) || 0,
    puNet:          parseFloat(get('PLVPUNET_MOY','PU Net','pu_net')) || 0,
    mntNetHt:       parseFloat(get('PLVMNTNETHT_MOY','Mnt Net HT','mnt_net')) || 0,
  };
}

async function importFile(file) {
  const { name, code, color, month, year } = pharmaMetaFromFilename(file.name);
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
  const name = (sale.artDesignation || '').toUpperCase();
  if (/FROID|RÉFRIGÉR|REFRIGER|THERMOSENS/i.test(name)) return 'froid';
  if (/BIOSIM|BIOSIMILAIRE/i.test(name))                 return 'biosim';
  if (/\bGNR\b|GÉNÉR|GENERI/i.test(name))               return 'generique';
  if (/\bNR\b/.test(name))                               return 'nr';
  const p = sale.puNet || 0;
  return p > 468 ? 'ch' : p > 4.33 ? 'mi' : 'pp';
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

function topPharmacies(n = 10) {
  const sales = getSales();
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

function caByMonth() {
  const sales = getSales();
  const map = {};
  for (const s of sales) {
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
function renderDashboard() {
  const sales  = getSales();
  const ca     = sumCA(sales);
  const marge  = sumMarge(sales);
  const mpct   = margePct(sales);
  const qte    = sumQte(sales);
  const nPh    = new Set(sales.map(s => s.pharmacyId)).size;
  const nProd  = new Set(sales.map(s => s.artCode)).size;
  const top    = topProducts(sales, 8);
  const topPh  = topPharmacies(5);
  const byM    = caByMonth();
  const maxCA  = Math.max(...topPh.map(p => p.ca), 1);

  // Pre-compute categories with taux
  const rawCats = byCategory(sales);
  const catRows = Object.keys(CATS)
    .map(k => {
      const d = rawCats[k] || { ca: 0, marge: 0, qte: 0, nb: 0 };
      const brut = Object.keys(rawCats[k] || {}).length
        ? sales.filter(s => classifyProduct(s) === k).reduce((a, s) => a + s.puBrut * s.qte, 0)
        : 0;
      return { key: k, ...CATS[k], ...d, taux: brut > 0 ? d.marge / brut * 100 : 0 };
    })
    .filter(c => c.nb > 0)
    .sort((a, b) => b.ca - a.ca);

  // Pre-compute top products rows HTML
  const topRowsHtml = top.map((p, i) => {
    const cat = CATS[p.cat] || CATS.mi;
    return `<tr>
      <td>${renderRank(i)}</td>
      <td class="td-name">${p.name}</td>
      <td><span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${cat.color}22;color:${cat.color}">${cat.label}</span></td>
      <td class="td-num" style="text-align:right">${fmt(p.ca)}</td>
      <td class="td-num" style="text-align:right;color:var(--mint)">${fmt(p.marge)}</td>
    </tr>`;
  }).join('');

  // Pre-compute category rows HTML
  const catRowsHtml = catRows.map(c => `<tr>
    <td>
      <span style="display:inline-flex;align-items:center;gap:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:${c.color};flex-shrink:0"></span>
        ${c.icon} ${c.label}
      </span>
    </td>
    <td class="td-num" style="text-align:right">${fmtNum(c.nb)}</td>
    <td class="td-num" style="text-align:right">${fmtNum(Math.round(c.qte))}</td>
    <td class="td-num" style="text-align:right">${fmt(c.ca)}</td>
    <td class="td-num" style="text-align:right;color:var(--mint)">${fmt(c.marge)}</td>
    <td class="td-num" style="text-align:right;color:${c.taux > 15 ? 'var(--mint)' : 'var(--amber)'}">${c.taux.toFixed(1)}%</td>
    <td style="min-width:100px">${renderProgress(c.ca, ca, c.color)}</td>
  </tr>`).join('');

  document.getElementById('dash-content').innerHTML = `
    <div class="kpi-grid fade-up" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card kc-b">
        <div class="kpi-icon">💰</div>
        <div class="kpi-value">${fmt(ca)}</div>
        <div class="kpi-label">CA Net HT</div>
      </div>
      <div class="kpi-card kc-g">
        <div class="kpi-icon">📈</div>
        <div class="kpi-value">${fmt(marge)}</div>
        <div class="kpi-label">Marge Brute</div>
      </div>
      <div class="kpi-card kc-p">
        <div class="kpi-icon">%</div>
        <div class="kpi-value">${mpct.toFixed(1)}%</div>
        <div class="kpi-label">Taux de marge</div>
      </div>
      <div class="kpi-card kc-a">
        <div class="kpi-icon">📦</div>
        <div class="kpi-value">${fmtNum(Math.round(qte))}</div>
        <div class="kpi-label">Unités vendues</div>
      </div>
      <div class="kpi-card kc-b">
        <div class="kpi-icon">🏥</div>
        <div class="kpi-value">${nPh}</div>
        <div class="kpi-label">Pharmacies actives</div>
      </div>
      <div class="kpi-card kc-g">
        <div class="kpi-icon">💊</div>
        <div class="kpi-value">${fmtNum(nProd)}</div>
        <div class="kpi-label">Références</div>
      </div>
    </div>

    <div class="grid-2 fade-up">
      <div class="card">
        <div class="card-header">
          <div class="card-title">CA Net par période</div>
          <div class="card-subtitle">${byM.length} période(s)</div>
        </div>
        <div class="card-body">
          ${byM.length ? '<div class="chart-wrap"><canvas id="chart-ca-month"></canvas></div>' : emptyState('📊','Aucune donnée','Importez des fichiers Excel')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Répartition par famille</div></div>
        <div class="card-body">
          ${catRows.length ? '<div class="chart-wrap"><canvas id="chart-cat-donut"></canvas></div>' : emptyState('📊','Aucune donnée','Importez des fichiers Excel')}
        </div>
      </div>
    </div>

    ${catRows.length ? `
    <div class="card fade-up">
      <div class="card-header"><div class="card-title">Familles produits</div><div class="badge badge-blue">${catRows.length} familles</div></div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr>
            <th>Famille</th>
            <th style="text-align:right">Lignes</th>
            <th style="text-align:right">Unités</th>
            <th style="text-align:right">CA Net HT</th>
            <th style="text-align:right">Marge brute</th>
            <th style="text-align:right">Taux marge</th>
            <th>Poids CA</th>
          </tr></thead>
          <tbody>${catRowsHtml}</tbody>
        </table>
      </div>
    </div>` : ''}

    <div class="grid-2 fade-up">
      <div class="card">
        <div class="card-header"><div class="card-title">Top Pharmacies</div></div>
        <div class="card-body" style="padding:12px 0">
          ${topPh.length ? topPh.map((p, i) => `
            <div class="stat-row" style="padding:10px 22px;cursor:pointer" onclick="showPharmaDetail('${p.id}')">
              ${renderRank(i)}
              <span style="width:10px;height:10px;border-radius:50%;background:${p.pharma.color};flex-shrink:0"></span>
              <div class="stat-row-info">
                <div class="stat-row-name">${p.pharma.name}</div>
                <div class="stat-row-sub">${fmtNum(Math.round(p.qte))} unités</div>
              </div>
              <div class="stat-row-bar">${renderProgress(p.ca, maxCA, p.pharma.color)}</div>
              <div class="stat-row-val">${fmt(p.ca)}</div>
            </div>
          `).join('') : emptyState('🏥', 'Aucune pharmacie', 'Importez des fichiers pour voir les classements')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Top Produits</div>
          <div class="badge badge-blue">${top.length} produits</div>
        </div>
        <div style="overflow-x:auto">
          ${top.length ? `
          <table class="data-table">
            <thead><tr>
              <th>#</th><th>Désignation</th><th>Famille</th>
              <th style="text-align:right">CA HT</th>
              <th style="text-align:right">Marge</th>
            </tr></thead>
            <tbody>${topRowsHtml}</tbody>
          </table>` : emptyState('💊', 'Aucun produit', 'Les produits apparaîtront après import')}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    if (byM.length) {
      const ctx = document.getElementById('chart-ca-month');
      if (ctx) {
        if (state.charts['ca-month']) state.charts['ca-month'].destroy();
        state.charts['ca-month'] = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: byM.map(([k]) => { const [y,m] = k.split('-'); return `${monthName(+m)} ${y}`; }),
            datasets: [{
              label: 'CA Net HT (€)',
              data: byM.map(([,v]) => +v.toFixed(2)),
              backgroundColor: 'rgba(0,87,255,0.5)',
              borderColor: '#0057FF',
              borderWidth: 2,
              borderRadius: 8,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8899BB', font: { size: 11 } } },
              y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8899BB', font: { size: 11 }, callback: v => fmt(v) } },
            }
          }
        });
      }
    }

    if (catList.length) {
      const ctx2 = document.getElementById('chart-cat-donut');
      if (ctx2) {
        if (state.charts['cat-donut']) state.charts['cat-donut'].destroy();
        const sorted = [...catList].sort((a,b) => b.ca - a.ca);
        state.charts['cat-donut'] = new Chart(ctx2, {
          type: 'doughnut',
          data: {
            labels: sorted.map(c => c.label),
            datasets: [{
              data: sorted.map(c => +c.ca.toFixed(2)),
              backgroundColor: sorted.map(c => c.color + 'CC'),
              borderColor: sorted.map(c => c.color),
              borderWidth: 2,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { color: '#8899BB', font: { size: 11 }, boxWidth: 12, padding: 10 } },
              tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed)} (${(ctx.parsed / ca * 100).toFixed(1)}%)` } },
            },
            cutout: '65%',
          }
        });
      }
    }
  }, 50);
}

// ── PHARMACIES ────────────────────────────────
let pharmaSearch = '';

function renderPharmacies() {
  const topPh = topPharmacies(50);
  const filtered = topPh.filter(p => p.pharma.name.toLowerCase().includes(pharmaSearch.toLowerCase()));
  const maxCA = Math.max(...filtered.map(p => p.ca), 1);

  document.getElementById('pharma-content').innerHTML = `
    <div class="card fade-in">
      <div class="card-header">
        <div class="card-title">Pharmacies (${filtered.length})</div>
        <div class="search-wrap" style="width:260px">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Rechercher..." value="${pharmaSearch}" oninput="pharmaSearch=this.value;renderPharmacies()" />
        </div>
      </div>
      ${filtered.length ? filtered.map((p,i) => `
        <div class="pharma-item" onclick="showPharmaDetail('${p.id}')">
          <div class="rank ${i < 3 ? ['rank-1','rank-2','rank-3'][i] : 'rank-n'}">${i < 3 ? '🥇🥈🥉'[i] : i+1}</div>
          <div class="pharma-dot" style="background:${p.pharma.color}"></div>
          <div class="pharma-info">
            <div class="pharma-name">${p.pharma.name}</div>
            <div class="pharma-meta">${p.pharma.code} · ${fmtNum(p.qte)} unités</div>
          </div>
          <div style="flex:1;max-width:160px;padding:0 12px">${renderProgress(p.ca, maxCA, p.pharma.color)}</div>
          <div class="pharma-stats">
            <div class="pharma-ca">${fmt(p.ca)}</div>
            <div class="pharma-qte">CA net HT</div>
          </div>
          <div style="color:var(--text3);font-size:16px">›</div>
        </div>
      `).join('') : emptyState('🏥', pharmaSearch ? 'Aucun résultat' : 'Aucune pharmacie', pharmaSearch ? 'Essayez un autre terme' : 'Importez des fichiers Excel pour voir vos pharmacies')}
    </div>
  `;
}

function showPharmaDetail(pharmacyId) {
  const pharma = state.pharmacies.find(p => String(p.id) === String(pharmacyId));
  if (!pharma) return;
  const sales = getSales({ pharmacyId: pharma.id });
  const top   = topProducts(sales, 10);
  const ca    = sumCA(sales);
  const qte   = sumQte(sales);
  const maxCA = Math.max(...top.map(p => p.ca), 1);

  document.getElementById('pharma-content').innerHTML = `
    <div class="fade-up">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button class="btn btn-ghost" onclick="renderPharmacies()">← Retour</button>
        <div style="width:12px;height:12px;border-radius:50%;background:${pharma.color}"></div>
        <span class="section-title" style="margin:0">${pharma.name}</span>
        <span class="badge badge-blue">${pharma.code}</span>
      </div>
      <div class="kpi-grid">
        <div class="kpi-card kc-b"><div class="kpi-icon">💰</div><div class="kpi-value">${fmt(ca)}</div><div class="kpi-label">CA Total HT</div></div>
        <div class="kpi-card kc-g"><div class="kpi-icon">📦</div><div class="kpi-value">${fmtNum(qte)}</div><div class="kpi-label">Unités vendues</div></div>
        <div class="kpi-card kc-p"><div class="kpi-icon">💊</div><div class="kpi-value">${new Set(sales.map(s=>s.artCode)).size}</div><div class="kpi-label">Références</div></div>
        <div class="kpi-card kc-a"><div class="kpi-icon">📅</div><div class="kpi-value">${state.imports.filter(i=>i.pharmacyId===pharma.id).length}</div><div class="kpi-label">Imports</div></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Top Produits</div></div>
        ${top.length ? `
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>#</th><th>Produit</th><th style="text-align:right">Qté</th><th style="text-align:right">CA HT</th></tr></thead>
            <tbody>
              ${top.map((p,i) => `
                <tr>
                  <td>${renderRank(i)}</td>
                  <td class="td-name">${p.name}<br><span class="badge badge-blue" style="margin-top:4px">${p.code}</span></td>
                  <td class="td-num" style="text-align:right">${fmtNum(p.qte)}</td>
                  <td class="td-num" style="text-align:right;color:var(--mint)">${fmt(p.ca)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : emptyState('💊','Aucune donnée','Importez un fichier pour cette pharmacie')}
      </div>
    </div>
  `;
}

// ── PRODUITS ──────────────────────────────────
let prodSearch = '';

function renderProduits() {
  const sales = getSales();
  const top   = topProducts(sales, 100).filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.code.toLowerCase().includes(prodSearch.toLowerCase()));
  const maxCA = Math.max(...top.map(p => p.ca), 1);

  document.getElementById('prod-content').innerHTML = `
    <div class="card fade-in">
      <div class="card-header">
        <div class="card-title">Catalogue produits (${top.length})</div>
        <div class="search-wrap" style="width:280px">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Nom ou code produit..." value="${prodSearch}" oninput="prodSearch=this.value;renderProduits()" />
        </div>
      </div>
      ${top.length ? `<div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Désignation</th><th>Code</th>
            <th style="text-align:right">Qté totale</th>
            <th style="text-align:right">CA HT</th>
            <th>Performance</th>
          </tr></thead>
          <tbody>
            ${top.map((p,i) => `
              <tr>
                <td>${renderRank(i)}</td>
                <td class="td-name">${p.name}</td>
                <td><span class="badge badge-blue">${p.code}</span></td>
                <td class="td-num" style="text-align:right">${fmtNum(p.qte)}</td>
                <td class="td-num" style="text-align:right;color:var(--mint)">${fmt(p.ca)}</td>
                <td style="min-width:100px">${renderProgress(p.ca, maxCA, '#0057FF')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : emptyState('💊', prodSearch ? 'Aucun résultat' : 'Aucun produit', prodSearch ? 'Essayez un autre terme' : 'Importez des fichiers Excel pour voir les produits')}
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
        <div class="import-zone-sub">Formats acceptés : <strong>.xlsx</strong>, <strong>.xls</strong><br>Nommez vos fichiers comme : <code style="background:rgba(255,255,255,.07);padding:2px 6px;border-radius:4px">Phie de la republique 04 26.xlsx</code></div>
      </div>

      <div id="pending-list" class="import-list" style="${pendingFiles.length ? '' : 'display:none'}"></div>

      ${recentImports.length ? `
      <div style="margin-top:32px">
        <div class="card-title" style="margin-bottom:12px">Historique des imports</div>
        <div class="card">
          <table class="data-table">
            <thead><tr><th>Fichier</th><th>Pharmacie</th><th>Période</th><th>Date import</th></tr></thead>
            <tbody>
              ${recentImports.map(imp => {
                const ph = state.pharmacies.find(p => p.id === imp.pharmacyId);
                return `<tr>
                  <td class="td-name" style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${imp.filename}</td>
                  <td><span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:${ph?.color||'#555'}"></span>${ph?.name||'?'}</span></td>
                  <td class="td-num">${imp.month ? monthName(imp.month)+' '+imp.year : '—'}</td>
                  <td style="color:var(--text3);font-size:12px">${new Date(imp.importedAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</td>
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
      item.querySelector('.import-item-meta').textContent = `${result.pharma.name} · ${result.month ? monthName(result.month)+' '+result.year : 'Période inconnue'} · ${result.count} lignes`;
      item.querySelector('.import-item-status').className = 'import-item-status status-ok';
      item.querySelector('.import-item-status').textContent = '✓ Importé';
      showToast(`${result.pharma.name} importée — ${result.count} lignes`, 'success');
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

// ── NAV ───────────────────────────────────────
function navigate(page) {
  state.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('active', el.id === `page-${page}`));

  const titles = { dashboard: 'Dashboard', pharmacies: 'Pharmacies', produits: 'Produits', catalogue: 'Catalogue IP', import: 'Import', admin: 'Administration' };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  // FAB catalogue visible uniquement sur la page catalogue
  const fab = document.getElementById('cat-cart-fab');
  if (fab) fab.style.setProperty('display', page === 'catalogue' ? '' : 'none', 'important');

  const renders = { dashboard: renderDashboard, pharmacies: renderPharmacies, produits: renderProduits, catalogue: renderCatalogue, import: renderImport, admin: renderAdmin };
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
