/* ═══════════════════════════════════════════════
   INTÉGRAL PHARMA CRM — app.js
   Vanilla JS + SheetJS + Chart.js
   Auth & data: localStorage (V1) → Supabase (V2)
═══════════════════════════════════════════════ */

// ── CONSTANTS ────────────────────────────────
const USERS = [
  { id: 1, email: 'admin@integralpharma.fr',   password: 'Admin2024!',   role: 'admin',      name: 'William M.',   pharmacyIds: null },
  { id: 2, email: 'manager@integralpharma.fr', password: 'Manager2024!', role: 'manager',    name: 'Sophie L.',    pharmacyIds: null },
  { id: 3, email: 'demo@integralpharma.fr',    password: 'Demo2024!',    role: 'commercial', name: 'Demo User',    pharmacyIds: [] },
];

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
function save() {
  localStorage.setItem('ip_crm_pharmacies', JSON.stringify(state.pharmacies));
  localStorage.setItem('ip_crm_imports',    JSON.stringify(state.imports));
  localStorage.setItem('ip_crm_sales',      JSON.stringify(state.sales));
}

function load() {
  state.pharmacies = JSON.parse(localStorage.getItem('ip_crm_pharmacies') || '[]');
  state.imports    = JSON.parse(localStorage.getItem('ip_crm_imports')    || '[]');
  state.sales      = JSON.parse(localStorage.getItem('ip_crm_sales')      || '[]');
}

// ── AUTH ─────────────────────────────────────
function tryLogin(email, password) {
  const u = USERS.find(u => u.email === email && u.password === password);
  if (!u) return false;
  state.user = u;
  localStorage.setItem('ip_crm_session', JSON.stringify({ id: u.id, ts: Date.now() }));
  return true;
}

function restoreSession() {
  const raw = localStorage.getItem('ip_crm_session');
  if (!raw) return false;
  const s = JSON.parse(raw);
  if (Date.now() - s.ts > 8 * 3600 * 1000) { localStorage.removeItem('ip_crm_session'); return false; }
  state.user = USERS.find(u => u.id === s.id);
  return !!state.user;
}

function logout() {
  state.user = null;
  localStorage.removeItem('ip_crm_session');
  document.getElementById('app').classList.remove('visible');
  document.getElementById('login-screen').style.display = 'flex';
}

// ── PHARMACY UTILS ────────────────────────────
function pharmaFromFilename(filename) {
  // "Phie de la republique 04 26" → { name, month, year }
  const base = filename.replace(/\.(xlsx|xls|csv)$/i, '').trim();
  const monthYearMatch = base.match(/(\d{2})\s+(\d{2,4})$/);
  let month = null, year = null, namePart = base;
  if (monthYearMatch) {
    month = parseInt(monthYearMatch[1]);
    year  = parseInt(monthYearMatch[2]);
    if (year < 100) year += 2000;
    namePart = base.slice(0, base.length - monthYearMatch[0].length).trim();
  }
  // Normalize name
  const name = namePart
    .replace(/^Phie\s+/i, 'Pharmacie ')
    .replace(/^Ph\s+/i,   'Pharmacie ')
    .replace(/\b\w/g, c => c.toUpperCase());

  // Find or create pharmacy
  let pharma = state.pharmacies.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!pharma) {
    pharma = {
      id:    Date.now() + Math.random(),
      name,
      code:  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,4),
      color: PHARMA_COLORS[state.pharmacies.length % PHARMA_COLORS.length],
    };
    state.pharmacies.push(pharma);
  }
  return { pharma, month, year };
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
  const { pharma, month, year } = pharmaFromFilename(file.name);
  let rows;
  try { rows = await parseExcel(file); }
  catch(e) { return { ok: false, error: 'Erreur lecture fichier' }; }

  if (!rows.length) return { ok: false, error: 'Fichier vide' };

  // Remove existing import for same pharma/period
  if (month && year) {
    state.imports = state.imports.filter(i => !(i.pharmacyId === pharma.id && i.month === month && i.year === year));
    state.sales   = state.sales.filter(s => !(s.pharmacyId === pharma.id && s.month === month && s.year === year));
  }

  const importId = Date.now() + Math.random();
  state.imports.push({ id: importId, pharmacyId: pharma.id, month, year, filename: file.name, importedAt: new Date().toISOString() });

  for (const row of rows) {
    const r = normalizeRow(row);
    if (!r.artDesignation) continue;
    state.sales.push({
      id: Math.random(),
      importId,
      pharmacyId: pharma.id,
      month, year,
      ...r,
    });
  }
  save();
  return { ok: true, pharma, month, year, count: rows.length };
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

function sumCA(sales) { return sales.reduce((a, s) => a + (s.mntNetHt || 0), 0); }
function sumQte(sales) { return sales.reduce((a, s) => a + (s.qte || 0), 0); }

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
    if (!map[k]) map[k] = { name: s.artDesignation, code: s.artCode, qte: 0, ca: 0 };
    map[k].qte += s.qte;
    map[k].ca  += s.mntNetHt;
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
  const sales = getSales();
  const ca    = sumCA(sales);
  const qte   = sumQte(sales);
  const nPh   = new Set(sales.map(s => s.pharmacyId)).size;
  const nProd = new Set(sales.map(s => s.artCode)).size;
  const top   = topProducts(sales, 8);
  const topPh = topPharmacies(5);
  const byM   = caByMonth();
  const maxCA = Math.max(...topPh.map(p => p.ca), 1);

  document.getElementById('dash-content').innerHTML = `
    <div class="kpi-grid fade-up">
      <div class="kpi-card kc-b">
        <div class="kpi-icon">💰</div>
        <div class="kpi-value">${fmt(ca)}</div>
        <div class="kpi-label">CA Total HT</div>
      </div>
      <div class="kpi-card kc-g">
        <div class="kpi-icon">📦</div>
        <div class="kpi-value">${fmtNum(qte)}</div>
        <div class="kpi-label">Unités vendues</div>
      </div>
      <div class="kpi-card kc-p">
        <div class="kpi-icon">🏥</div>
        <div class="kpi-value">${nPh}</div>
        <div class="kpi-label">Pharmacies actives</div>
      </div>
      <div class="kpi-card kc-a">
        <div class="kpi-icon">💊</div>
        <div class="kpi-value">${fmtNum(nProd)}</div>
        <div class="kpi-label">Références</div>
      </div>
    </div>

    <div class="grid-2 fade-up">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">CA par période</div>
            <div class="card-subtitle">${byM.length} période(s) importée(s)</div>
          </div>
        </div>
        <div class="card-body">
          ${byM.length ? `<div class="chart-wrap"><canvas id="chart-ca-month"></canvas></div>` : emptyState('📊','Aucune donnée','Importez des fichiers Excel pour voir l\'évolution')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Top Pharmacies</div></div>
        <div class="card-body" style="padding:12px 0">
          ${topPh.length ? topPh.map((p,i) => `
            <div class="stat-row" style="padding:10px 22px" onclick="showPharmaDetail('${p.id}')">
              <div class="stat-row-rank">${renderRank(i)}</div>
              <div style="width:10px;height:10px;border-radius:50%;background:${p.pharma.color};flex-shrink:0"></div>
              <div class="stat-row-info">
                <div class="stat-row-name">${p.pharma.name}</div>
                <div class="stat-row-sub">${fmtNum(p.qte)} unités</div>
              </div>
              <div class="stat-row-bar">${renderProgress(p.ca, maxCA, p.pharma.color)}</div>
              <div class="stat-row-val">${fmt(p.ca)}</div>
            </div>
          `).join('') : emptyState('🏥','Aucune pharmacie','Importez des fichiers pour voir les classements')}
        </div>
      </div>
    </div>

    <div class="card fade-up">
      <div class="card-header">
        <div class="card-title">Top Produits</div>
        <div class="badge badge-blue">${top.length} produits</div>
      </div>
      <div style="overflow-x:auto">
        ${top.length ? `
        <table class="data-table">
          <thead><tr>
            <th>#</th><th>Désignation</th><th>Code</th>
            <th style="text-align:right">Quantité</th><th style="text-align:right">CA HT</th>
          </tr></thead>
          <tbody>
            ${top.map((p,i) => `
              <tr>
                <td>${renderRank(i)}</td>
                <td class="td-name">${p.name}</td>
                <td><span class="badge badge-blue">${p.code}</span></td>
                <td class="td-num" style="text-align:right">${fmtNum(p.qte)}</td>
                <td class="td-num" style="text-align:right;color:var(--mint)">${fmt(p.ca)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : emptyState('💊','Aucun produit','Les produits apparaîtront après import')}
      </div>
    </div>
  `;

  if (byM.length) {
    setTimeout(() => {
      const ctx = document.getElementById('chart-ca-month');
      if (!ctx) return;
      if (state.charts['ca-month']) state.charts['ca-month'].destroy();
      state.charts['ca-month'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: byM.map(([k]) => { const [y,m] = k.split('-'); return `${monthName(+m)} ${y}`; }),
          datasets: [{
            label: 'CA HT (€)',
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
    }, 50);
  }
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
  document.getElementById('admin-content').innerHTML = `
    <div class="fade-up" style="max-width:700px">
      <div class="section-title">Administration</div>
      <div class="section-sub">Gestion des accès et des données</div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div class="card-title">Utilisateurs</div></div>
        <table class="data-table">
          <thead><tr><th>Email</th><th>Nom</th><th>Rôle</th><th>Accès</th></tr></thead>
          <tbody>
            ${USERS.map(u => `
              <tr>
                <td class="td-name">${u.email}</td>
                <td>${u.name}</td>
                <td><span class="badge ${u.role==='admin'?'badge-rose':u.role==='manager'?'badge-amber':'badge-blue'}">${u.role}</span></td>
                <td style="color:var(--text3)">${u.pharmacyIds === null ? 'Toutes' : u.pharmacyIds?.length ? u.pharmacyIds.length+' pharmacies' : 'Aucune'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Données</div></div>
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
          <button class="btn btn-ghost" onclick="if(confirm('Supprimer toutes les données ?')){localStorage.clear();location.reload()}" style="color:var(--rose);border-color:rgba(255,77,109,.3)">
            🗑 Réinitialiser toutes les données
          </button>
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

  const titles = { dashboard: 'Dashboard', pharmacies: 'Pharmacies', produits: 'Produits', import: 'Import', admin: 'Administration' };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  const renders = { dashboard: renderDashboard, pharmacies: renderPharmacies, produits: renderProduits, import: renderImport, admin: renderAdmin };
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
function initApp() {
  load();

  // Sidebar user info
  document.getElementById('sidebar-user-name').textContent = state.user.name;
  document.getElementById('sidebar-user-role').textContent = state.user.role;
  document.getElementById('sidebar-avatar').textContent = state.user.name.charAt(0);

  // Hide admin for non-admin
  document.getElementById('nav-admin').style.display = state.user.role === 'admin' ? 'flex' : 'none';

  updateNavBadge();
  navigate('dashboard');
}

// ── BOOT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (restoreSession()) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    initApp();
  }

  // Login form
  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const err      = document.getElementById('login-error');
    if (tryLogin(email, password)) {
      err.classList.remove('show');
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').classList.add('visible');
      initApp();
    } else {
      err.textContent = 'Email ou mot de passe incorrect';
      err.classList.add('show');
    }
  });
});
