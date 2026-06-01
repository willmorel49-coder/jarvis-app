// JARVIS · pharma-fiche.js
// Génère le HTML d'une fiche pharmacie pour affichage dans la sheet (snap medium/full).

export function renderPharmaFiche(pharma) {
  const ville    = escapeHtml(pharma.ville   || '—');
  const cp       = escapeHtml(pharma.cp      || '');
  const adresse  = escapeHtml(pharma.adresse || '');
  const cip      = escapeHtml(pharma.cip     || '—');
  const email    = pharma.email
    ? `<a href="mailto:${escapeHtml(pharma.email)}" class="jarvis-link">${escapeHtml(pharma.email)}</a>`
    : '<span class="jarvis-muted">—</span>';
  const tel      = pharma.tel
    ? `<a href="tel:${escapeHtml(pharma.tel)}" class="jarvis-link">${escapeHtml(pharma.tel)}</a>`
    : '<span class="jarvis-muted">—</span>';

  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${pharma.lat},${pharma.lng}`;
  const gmapsDir = `https://www.google.com/maps/dir/?api=1&destination=${pharma.lat},${pharma.lng}`;

  // --- Statut
  const status   = getStatusLabel(pharma);

  // --- Chips groupement
  const groupChips = [pharma.pelgraz, pharma.pelmeg, pharma.ecodage, pharma.gros1, pharma.gros2]
    .filter(Boolean)
    .map((g) => `<span class="jarvis-chip">${escapeHtml(g)}</span>`)
    .join('');

  // --- KPIs
  const isClient = pharma.ca2023 && pharma.ca2023 > 0;
  const kpiHtml  = isClient ? renderKpisClient(pharma) : renderKpisProspect(pharma);

  return `
    <div class="pharma-fiche">

      <!-- HEADER -->
      <header class="pharma-fiche-header">
        <div class="pharma-fiche-header-top">
          <div>
            <div class="pharma-fiche-cip">CIP ${cip}</div>
            <h3 class="pharma-fiche-name">${escapeHtml(pharma.nom || '—')}</h3>
            <div class="pharma-fiche-loc">${adresse ? adresse + ' · ' : ''}${cp} ${ville}</div>
          </div>
          <span class="pharma-fiche-status pharma-fiche-status--${status.cls}">${status.label}</span>
        </div>
      </header>

      <!-- GROUPEMENTS -->
      ${groupChips ? `<div class="pharma-fiche-chips">${groupChips}</div>` : ''}

      <!-- KPIs -->
      ${kpiHtml}

      <!-- CONTACT -->
      <div class="pharma-fiche-contact">
        <div class="pharma-fiche-row"><span class="jarvis-muted">Email</span>${email}</div>
        <div class="pharma-fiche-row"><span class="jarvis-muted">Tél</span>${tel}</div>
      </div>

      <!-- COMMENTAIRE -->
      ${pharma.commentaire ? `<div class="pharma-fiche-note">${escapeHtml(pharma.commentaire)}</div>` : ''}

      <!-- TOP PRODUITS -->
      ${renderTopProducts(pharma.cip)}

      <!-- ACTIONS -->
      <div class="pharma-fiche-actions">
        <a class="jarvis-btn jarvis-btn-primary" href="${gmapsDir}" target="_blank" rel="noopener">Itinéraire ↗</a>
        <a class="jarvis-btn jarvis-btn-ghost" href="${gmapsUrl}" target="_blank" rel="noopener">Voir sur GMaps</a>
        <button class="jarvis-btn jarvis-btn-ghost" id="pharma-fiche-close">↓ Réduire</button>
      </div>
    </div>
  `;
}

/* ================================================================
   HELPERS KPI
   ================================================================ */

function renderKpisClient(pharma) {
  const ca        = pharma.ca2023 ? formatEuro(pharma.ca2023) : '—';
  const secteurPct = getSecteurPct(pharma);
  const marge     = getMargeEstimee(pharma.cip);
  const nbProd    = getNbProduits(pharma.cip);

  return `
    <div class="pharma-fiche-kpis pharma-fiche-kpis--3">
      <div class="pharma-fiche-kpi">
        <div class="pharma-fiche-kpi-label">CA 2023</div>
        <div class="pharma-fiche-kpi-value">${ca}</div>
        ${secteurPct !== null ? `<div class="pharma-fiche-kpi-sub">${secteurPct}% du secteur</div>` : ''}
      </div>
      <div class="pharma-fiche-kpi">
        <div class="pharma-fiche-kpi-label">Marge est.</div>
        <div class="pharma-fiche-kpi-value">${marge !== null ? formatEuro(marge) : '<span class="jarvis-muted">—</span>'}</div>
        ${marge !== null ? '<div class="pharma-fiche-kpi-sub">sur produits IP</div>' : ''}
      </div>
      <div class="pharma-fiche-kpi">
        <div class="pharma-fiche-kpi-label">Réfs achetées</div>
        <div class="pharma-fiche-kpi-value">${nbProd !== null ? nbProd : '<span class="jarvis-muted">—</span>'}</div>
        ${nbProd !== null ? '<div class="pharma-fiche-kpi-sub">produits distincts</div>' : ''}
      </div>
    </div>
  `;
}

function renderKpisProspect(pharma) {
  const pot = pharma.potentielGx ? formatEuro(pharma.potentielGx) : '—';
  const visite = pharma.prochaineVisite
    ? formatDate(pharma.prochaineVisite)
    : '<span class="jarvis-muted">Non planifiée</span>';

  return `
    <div class="pharma-fiche-kpis pharma-fiche-kpis--2">
      <div class="pharma-fiche-kpi">
        <div class="pharma-fiche-kpi-label">Potentiel Gx</div>
        <div class="pharma-fiche-kpi-value">${pot}</div>
      </div>
      <div class="pharma-fiche-kpi">
        <div class="pharma-fiche-kpi-label">Prochaine visite</div>
        <div class="pharma-fiche-kpi-value pharma-fiche-kpi-value--sm">${visite}</div>
      </div>
    </div>
  `;
}

/* ================================================================
   TOP 10 PRODUITS
   ================================================================ */

function renderTopProducts(cip) {
  const products = (window.CLIENT_PRODUCTS && window.CLIENT_PRODUCTS[cip]) ? window.CLIENT_PRODUCTS[cip] : null;
  if (!products || !products.length) return '';

  const top10   = products.slice(0, 10);
  const totalCa = (window.CLIENT_PRODUCTS_TOTAL_CA && window.CLIENT_PRODUCTS_TOTAL_CA[cip])
    || products.reduce((s, p) => s + (p.ca || 0), 0);

  // Construire un Map artcode → catalogue IP pour matching
  const catMap = buildCatalogueMap();

  const rows = top10.map((p, i) => {
    const match   = catMap.get(String(p.artcode)) || null;
    const remise  = match ? renderRemiseBadge(match) : '';
    const prixIp  = match ? `<span class="pharma-fiche-prod-ip">${formatEuro(match.prix_ip)}</span>` : '';

    return `
      <div class="pharma-fiche-product">
        <span class="pharma-fiche-prod-rank">${i + 1}</span>
        <span class="pharma-fiche-product-name">${escapeHtml(p.designation)}</span>
        <span class="pharma-fiche-product-meta">
          ${prixIp}
          ${remise}
          <span class="pharma-fiche-prod-qty">×${p.qte}</span>
          <b>${formatEuro(p.ca)}</b>
        </span>
      </div>
    `;
  }).join('');

  return `
    <div class="pharma-fiche-products">
      <div class="pharma-fiche-products-title">
        Top produits <span class="jarvis-muted">· total ${formatEuro(totalCa)}</span>
      </div>
      ${rows}
    </div>
  `;
}

/* ================================================================
   HELPERS MÉTIER
   ================================================================ */

/** Statut du client : client / prospect chaud / prospect froid */
export function getStatusLabel(p) {
  if (p.ca2023 && p.ca2023 > 0) {
    return { label: 'Client', cls: 'client' };
  }
  if (p.potentielGx && p.potentielGx >= 200000) {
    return { label: 'Prospect chaud', cls: 'hot' };
  }
  return { label: 'Prospect froid', cls: 'cold' };
}

/** Nb de références IP achetées (longueur CLIENT_PRODUCTS[cip]) */
export function getNbProduits(cip) {
  const prods = window.CLIENT_PRODUCTS && window.CLIENT_PRODUCTS[cip];
  return prods ? prods.length : null;
}

/**
 * Marge estimée = somme sur CLIENT_PRODUCTS[cip] de :
 *   (prix_ht - prix_ip) × qte
 * quand l'artcode matche un produit CATALOGUE_IP via EAN.
 * Retourne null si aucun match.
 */
export function getMargeEstimee(cip) {
  const prods = window.CLIENT_PRODUCTS && window.CLIENT_PRODUCTS[cip];
  if (!prods || !prods.length) return null;
  const catMap = buildCatalogueMap();
  let total    = 0;
  let matched  = 0;
  for (const p of prods) {
    const cat = catMap.get(String(p.artcode));
    if (cat && cat.prix_ht != null && cat.prix_ip != null) {
      total   += (cat.prix_ht - cat.prix_ip) * (p.qte || 0);
      matched++;
    }
  }
  return matched > 0 ? total : null;
}

/** % du CA de cette pharmacie par rapport à la somme totale de tous les CA 2023. */
function getSecteurPct(pharma) {
  if (!pharma.ca2023 || !window.CLIENTS) return null;
  const total = window.CLIENTS.reduce((s, c) => s + (c.ca2023 || 0), 0);
  if (!total) return null;
  return ((pharma.ca2023 / total) * 100).toFixed(1);
}

/** Construit un Map artcode → catalogue IP.
 *  Tente d'abord artcode direct, puis ean, puis ean nettoyé.
 *  Cache dans window pour ne le construire qu'une fois.
 */
function buildCatalogueMap() {
  if (window.__JARVIS_CAT_MAP__) return window.__JARVIS_CAT_MAP__;
  const map  = new Map();
  const cat  = window.CATALOGUE_IP;
  if (!cat) return map;
  for (const item of cat) {
    // Index par ean (artcode dans client-products peut être l'EAN)
    if (item.ean) map.set(String(item.ean), item);
  }
  window.__JARVIS_CAT_MAP__ = map;
  return map;
}

/** Badge remise si disponible dans le catalogue */
function renderRemiseBadge(cat) {
  if (cat.remise_pct && cat.remise_pct > 0) {
    return `<span class="pharma-fiche-badge-remise">-${cat.remise_pct.toFixed(0)}%</span>`;
  }
  if (cat.offre_ip) {
    return `<span class="pharma-fiche-badge-offre">Offre IP</span>`;
  }
  return '';
}

/* ================================================================
   FORMATTERS
   ================================================================ */

function formatEuro(n) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return str;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ================================================================
   STYLES SPÉCIFIQUES FICHE — injectés une seule fois
   ================================================================ */
(function injectFicheStyles() {
  if (document.getElementById('pf-styles')) return;
  const style = document.createElement('style');
  style.id = 'pf-styles';
  style.textContent = `

/* ---- pharma-fiche enrichie ---- */
.pharma-fiche-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

/* Statut chip géant */
.pharma-fiche-status {
  display: inline-flex;
  align-items: center;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .3px;
  white-space: nowrap;
  flex-shrink: 0;
}
.pharma-fiche-status--client {
  background: rgba(0, 122, 255, .12);
  color: #0057ff;
  border: 1px solid rgba(0, 122, 255, .25);
}
.pharma-fiche-status--hot {
  background: rgba(255, 149, 0, .14);
  color: #c96800;
  border: 1px solid rgba(255, 149, 0, .28);
}
.pharma-fiche-status--cold {
  background: rgba(142, 142, 147, .14);
  color: #606063;
  border: 1px solid rgba(142, 142, 147, .28);
}

/* KPIs 3 colonnes pour clients */
.pharma-fiche-kpis--3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.pharma-fiche-kpis--2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}
.pharma-fiche-kpi-sub {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
  font-weight: 500;
}
/* KPI value petite (pour dates) */
.pharma-fiche-kpi-value--sm {
  font-size: 13px !important;
  font-weight: 700 !important;
}

/* Rang produit */
.pharma-fiche-prod-rank {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 700;
  width: 16px;
  flex-shrink: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Prix IP dans liste produit */
.pharma-fiche-prod-ip {
  font-size: 10.5px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

/* Badges remise / offre */
.pharma-fiche-badge-remise,
.pharma-fiche-badge-offre {
  display: inline-block;
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  vertical-align: middle;
}
.pharma-fiche-badge-remise {
  background: rgba(52, 199, 89, .14);
  color: #1a8d3e;
}
.pharma-fiche-badge-offre {
  background: rgba(0, 122, 255, .12);
  color: #0057ff;
}

/* Qté produit */
.pharma-fiche-prod-qty {
  font-size: 10.5px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

/* Ligne produit : rang + nom + meta alignés */
.pharma-fiche-product {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 11.5px;
  border-bottom: 1px solid var(--border);
  gap: 8px;
}
.pharma-fiche-product-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}

`;
  document.head.appendChild(style);
})();
