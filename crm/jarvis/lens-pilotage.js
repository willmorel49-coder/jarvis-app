// JARVIS · lens-pilotage.js
// Lentille Secteur : vue globale territoire — KPIs, top clients, top produits, mix catalogue, distribution.

import { registerLens } from './lens.js';

registerLens('pilotage', {
  title: 'Secteur',
  render: () => buildPilotage(),
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatEuroShort(n) {
  if (n === null || n === undefined || n === '') return '0 €';
  const num = Number(n);
  if (isNaN(num)) return '0 €';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} M€`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)} k€`;
  return `${sign}${abs.toFixed(0)} €`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

// ─── Data crunching ────────────────────────────────────────────────────────

function computeKpis(clients, catalogueIP, stock, clientProducts) {
  const TOTAL_OFFICINES = 1025;

  // CA total secteur (vrais clients)
  let totalCa = 0;
  let activeCount = 0;
  let prospectsChauds = 0;

  for (const c of clients) {
    const ca = Number(c.ca2023 || 0);
    const pot = Number(c.potentielGx || 0);
    if (ca > 0) {
      totalCa += ca;
      activeCount++;
    } else if (pot > 0) {
      prospectsChauds++;
    }
  }

  // Catalogue IP
  const catalogueCount = Array.isArray(catalogueIP) ? catalogueIP.length : 0;

  // Stock dispo : somme dispo de STOCK (champ dispo)
  let stockDispo = 0;
  if (stock && typeof stock === 'object') {
    for (const ref of Object.values(stock)) {
      const d = Number(ref.dispo || 0);
      if (d > 0) stockDispo += d;
    }
  }

  // Couverture territoire
  const couverturePct = Math.round((clients.length / TOTAL_OFFICINES) * 100);

  return {
    totalCa,
    activeCount,
    prospectsChauds,
    catalogueCount,
    stockDispo,
    couverturePct,
    totalClients: clients.length,
  };
}

function buildTop10Clients(clients, clientProducts) {
  const prodTotals = clientProducts || {};
  return [...clients]
    .filter((c) => Number(c.ca2023 || 0) > 0)
    .sort((a, b) => Number(b.ca2023 || 0) - Number(a.ca2023 || 0))
    .slice(0, 10)
    .map((c) => {
      const prods = prodTotals[c.cip];
      const nbProds = Array.isArray(prods) ? prods.length : 0;
      return {
        nom: c.nom || '—',
        ville: c.ville || '—',
        ca: Number(c.ca2023 || 0),
        nbProds,
        groupement: c.ecodage || '—',
      };
    });
}

function buildTop10Produits(clientProducts, catalogueIP) {
  // Agréger tous les artcodes sur tous les clients
  const byArt = new Map(); // artcode → { designation, totalCa, clients: Set }

  const cp = clientProducts || {};
  for (const [cip, prods] of Object.entries(cp)) {
    if (!Array.isArray(prods)) continue;
    for (const p of prods) {
      const key = p.artcode || p.designation || '';
      if (!key) continue;
      if (!byArt.has(key)) {
        byArt.set(key, { artcode: p.artcode, designation: p.designation || key, totalCa: 0, clients: new Set() });
      }
      const rec = byArt.get(key);
      rec.totalCa += Number(p.ca || 0);
      rec.clients.add(cip);
    }
  }

  // Construire un index catalogue : ean → prix_ip, et artcode → prix_ip
  const catByEan = new Map();
  const catByArtcode = new Map();
  if (Array.isArray(catalogueIP)) {
    for (const prod of catalogueIP) {
      if (prod.ean) catByEan.set(String(prod.ean), prod);
    }
  }

  const top = [...byArt.values()]
    .sort((a, b) => b.totalCa - a.totalCa)
    .slice(0, 10)
    .map((r) => {
      // Essayer de matcher le prix IP via EAN = artcode
      let prixIp = null;
      const cat = catByEan.get(String(r.artcode || '')) || catByArtcode.get(String(r.artcode || ''));
      if (cat) prixIp = cat.prix_ip;
      return {
        designation: r.designation,
        totalCa: r.totalCa,
        nbClients: r.clients.size,
        prixIp,
      };
    });

  return top;
}

function buildMixCategories(catalogueIP) {
  if (!Array.isArray(catalogueIP) || catalogueIP.length === 0) return [];
  const counts = {};
  for (const p of catalogueIP) {
    const cat = p.categorie || 'Autre';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const total = catalogueIP.length;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
    }));
}

function buildVilleBars(clients) {
  const byCp2 = {};
  for (const c of clients) {
    const dept = (c.cp || '').slice(0, 2);
    if (!dept) continue;
    byCp2[dept] = (byCp2[dept] || 0) + 1;
  }
  const entries = Object.entries(byCp2).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries[0] ? entries[0][1] : 1;
  return entries.map(([dept, count]) => ({
    label: `Dépt ${dept}`,
    count,
    pct: Math.round((count / max) * 100),
  }));
}

// ─── Render ────────────────────────────────────────────────────────────────

function buildPilotage() {
  const clients = (window.CLIENTS) || [];
  const catalogueIP = window.CATALOGUE_IP || [];
  const stock = window.STOCK || {};
  const clientProducts = window.CLIENT_PRODUCTS || {};

  const kpis = computeKpis(clients, catalogueIP, stock, clientProducts);
  const top10Clients = buildTop10Clients(clients, clientProducts);
  const top10Produits = buildTop10Produits(clientProducts, catalogueIP);
  const mixCats = buildMixCategories(catalogueIP);
  const distBars = buildVilleBars(clients);

  return `
<style>
  .lens-pilotage-wrap {}
  .lens-pilotage-kpi-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 4px;
  }
  @media (min-width: 500px) {
    .lens-pilotage-kpi-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .lens-pilotage-kpi--hero {
    grid-column: 1 / -1;
  }
  @media (min-width: 500px) {
    .lens-pilotage-kpi--hero { grid-column: span 1; }
  }
  .lens-pilotage-table {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
    font-size: 12px;
  }
  .lens-pilotage-row {
    display: grid;
    grid-template-columns: 22px 1fr 60px 54px 64px 60px;
    gap: 6px;
    align-items: center;
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
  }
  @media (max-width: 480px) {
    .lens-pilotage-row {
      grid-template-columns: 20px 1fr 52px 46px;
    }
    .lens-pilotage-col-prods,
    .lens-pilotage-col-group { display: none; }
  }
  .lens-pilotage-row:last-child { border-bottom: none; }
  .lens-pilotage-row--head {
    font-size: 10px;
    letter-spacing: .8px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 700;
    background: var(--surface-glass);
    padding: 7px 12px;
  }
  .lens-pilotage-col-rank { color: var(--text-muted); font-weight: 700; }
  .lens-pilotage-col-nom { font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lens-pilotage-col-ville { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lens-pilotage-col-ca { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--mint); }
  .lens-pilotage-col-prods { text-align: right; color: var(--text-dim); font-variant-numeric: tabular-nums; }
  .lens-pilotage-col-group { color: var(--text-muted); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .lens-pilotage-prod-table {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
    font-size: 12px;
  }
  .lens-pilotage-prod-row {
    display: grid;
    grid-template-columns: 22px 1fr 54px 36px 52px;
    gap: 6px;
    align-items: center;
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
  }
  .lens-pilotage-prod-row:last-child { border-bottom: none; }
  .lens-pilotage-prod-row--head {
    font-size: 10px;
    letter-spacing: .8px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 700;
    background: var(--surface-glass);
    padding: 7px 12px;
  }
  .lens-pilotage-prod-col-rank { color: var(--text-muted); font-weight: 700; }
  .lens-pilotage-prod-col-nom { font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lens-pilotage-prod-col-ca { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--amber); }
  .lens-pilotage-prod-col-clients { text-align: right; color: var(--text-dim); font-variant-numeric: tabular-nums; }
  .lens-pilotage-prod-col-prix { text-align: right; color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }

  .lens-pilotage-mix-bar-row { display: grid; grid-template-columns: 110px 1fr 36px 36px; gap: 10px; align-items: center; font-size: 11px; }
  .lens-pilotage-mix-bar-label { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lens-pilotage-mix-bar-track { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-pill); height: 7px; overflow: hidden; }
  .lens-pilotage-mix-bar-fill { background: linear-gradient(90deg, var(--blue), var(--indigo)); height: 100%; transition: width .4s ease; }
  .lens-pilotage-mix-bar-pct { font-weight: 700; color: var(--text); text-align: right; font-variant-numeric: tabular-nums; }
  .lens-pilotage-mix-bar-count { color: var(--text-muted); text-align: right; font-variant-numeric: tabular-nums; }

  .lens-pilotage-footer {
    margin-top: 28px;
    padding: 12px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .lens-pilotage-footer-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--mint); flex-shrink: 0; }
</style>

<div class="lens-pilotage-wrap">

  <!-- 1. KPI HERO GRID -->
  <div class="lens-pilotage-kpi-grid">

    <div class="lens-kpi lens-kpi--hero lens-pilotage-kpi--hero">
      <div class="lens-kpi-label">CA total secteur</div>
      <div class="lens-kpi-value">${formatEuroShort(kpis.totalCa)}</div>
      <div class="lens-kpi-sub">CA 2023 · ${kpis.activeCount} clients actifs</div>
    </div>

    <div class="lens-kpi">
      <div class="lens-kpi-label">Clients actifs</div>
      <div class="lens-kpi-value">${kpis.activeCount}</div>
      <div class="lens-kpi-sub">avec CA 2023 > 0</div>
    </div>

    <div class="lens-kpi">
      <div class="lens-kpi-label">Prospects chauds</div>
      <div class="lens-kpi-value">${kpis.prospectsChauds}</div>
      <div class="lens-kpi-sub">potentiel Gx > 0</div>
    </div>

    <div class="lens-kpi">
      <div class="lens-kpi-label">Catalogue IP</div>
      <div class="lens-kpi-value">${fmtNum(kpis.catalogueCount)}</div>
      <div class="lens-kpi-sub">produits référencés</div>
    </div>

    <div class="lens-kpi">
      <div class="lens-kpi-label">Stock dispo</div>
      <div class="lens-kpi-value">${fmtNum(kpis.stockDispo)}</div>
      <div class="lens-kpi-sub">unités disponibles</div>
    </div>

    <div class="lens-kpi">
      <div class="lens-kpi-label">Couverture</div>
      <div class="lens-kpi-value">${kpis.couverturePct}%</div>
      <div class="lens-kpi-sub">${fmtNum(kpis.totalClients)} / 1 025 officines</div>
    </div>

  </div>

  <!-- 2. TOP 10 CLIENTS -->
  <h3 class="lens-section-title">Top 10 clients · CA 2023</h3>
  <div class="lens-pilotage-table">
    <div class="lens-pilotage-row lens-pilotage-row--head">
      <span>#</span>
      <span>Officine</span>
      <span>Ville</span>
      <span style="text-align:right">CA</span>
      <span class="lens-pilotage-col-prods" style="text-align:right">Produits</span>
      <span class="lens-pilotage-col-group">Groupement</span>
    </div>
    ${top10Clients.map((c, i) => `
    <div class="lens-pilotage-row">
      <span class="lens-pilotage-col-rank">${i + 1}</span>
      <span class="lens-pilotage-col-nom" title="${escapeHtml(c.nom)}">${escapeHtml(c.nom)}</span>
      <span class="lens-pilotage-col-ville">${escapeHtml(c.ville)}</span>
      <span class="lens-pilotage-col-ca">${formatEuroShort(c.ca)}</span>
      <span class="lens-pilotage-col-prods">${c.nbProds > 0 ? c.nbProds : '—'}</span>
      <span class="lens-pilotage-col-group">${escapeHtml(c.groupement)}</span>
    </div>`).join('')}
  </div>

  <!-- 3. TOP 10 PRODUITS -->
  <h3 class="lens-section-title">Top 10 produits · tous clients</h3>
  <div class="lens-pilotage-prod-table">
    <div class="lens-pilotage-prod-row lens-pilotage-prod-row--head">
      <span>#</span>
      <span>Désignation</span>
      <span style="text-align:right">CA total</span>
      <span style="text-align:right">Clients</span>
      <span style="text-align:right">Prix IP</span>
    </div>
    ${top10Produits.length === 0
      ? `<div style="padding:20px 12px;color:var(--text-muted);font-size:13px;text-align:center">Aucune donnée CLIENT_PRODUCTS disponible</div>`
      : top10Produits.map((p, i) => `
    <div class="lens-pilotage-prod-row">
      <span class="lens-pilotage-prod-col-rank">${i + 1}</span>
      <span class="lens-pilotage-prod-col-nom" title="${escapeHtml(p.designation)}">${escapeHtml(p.designation)}</span>
      <span class="lens-pilotage-prod-col-ca">${formatEuroShort(p.totalCa)}</span>
      <span class="lens-pilotage-prod-col-clients">${p.nbClients}</span>
      <span class="lens-pilotage-prod-col-prix">${p.prixIp != null ? formatEuroShort(p.prixIp) : '—'}</span>
    </div>`).join('')}
  </div>

  <!-- 4. MIX CATÉGORIES CATALOGUE -->
  <h3 class="lens-section-title">Mix catégories · catalogue IP</h3>
  <div style="display:flex;flex-direction:column;gap:8px;">
    ${mixCats.length === 0
      ? `<div style="color:var(--text-muted);font-size:13px">Aucune donnée catalogue</div>`
      : mixCats.map((m) => `
    <div class="lens-pilotage-mix-bar-row">
      <span class="lens-pilotage-mix-bar-label" title="${escapeHtml(m.label)}">${escapeHtml(m.label)}</span>
      <div class="lens-pilotage-mix-bar-track">
        <div class="lens-pilotage-mix-bar-fill" style="width:${m.pct}%"></div>
      </div>
      <span class="lens-pilotage-mix-bar-pct">${m.pct}%</span>
      <span class="lens-pilotage-mix-bar-count">${m.count}</span>
    </div>`).join('')}
  </div>

  <!-- 5. DISTRIBUTION TERRITOIRE -->
  <h3 class="lens-section-title">Distribution territoire · officines / dpt</h3>
  <div class="lens-bar-chart">
    ${distBars.map((b) => `
    <div class="lens-bar-row">
      <span class="lens-bar-label">${escapeHtml(b.label)}</span>
      <div class="lens-bar-track"><div class="lens-bar-fill" style="width:${b.pct}%"></div></div>
      <span class="lens-bar-value">${b.count}</span>
    </div>`).join('')}
  </div>

  <!-- 6. FOOTER -->
  <div class="lens-pilotage-footer">
    <div class="lens-pilotage-footer-dot"></div>
    <span>CA basé sur STATS 2023 &nbsp;·&nbsp; stock au 01/06/2026 &nbsp;·&nbsp; catalogue IP · ${fmtNum(kpis.catalogueCount)} réf.</span>
  </div>

</div>
  `;
}
