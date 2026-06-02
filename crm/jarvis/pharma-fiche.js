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

  // --- Chips groupement (pelgraz/pelmeg = legacy Accord, on les ignore)
  const groupChips = [pharma.ecodage, pharma.gros1, pharma.gros2]
    .filter(Boolean)
    .map((g) => `<span class="jarvis-chip">${escapeHtml(g)}</span>`)
    .join('');

  // --- KPIs
  const isClient = pharma.ca2023 && pharma.ca2023 > 0;
  const kpiHtml  = isClient ? renderKpisClient(pharma) : renderKpisProspect(pharma);

  // --- Pré-calcul mix famille (1 seul passage) pour les 3 nouvelles sections
  const mixData = isClient ? computeMixData(pharma) : null;

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

      <!-- MANQUE À GAGNER (gros chiffre, juste sous KPI hero) -->
      ${mixData ? renderManqueAGagner(mixData) : ''}

      <!-- CONTACT -->
      <div class="pharma-fiche-contact">
        <div class="pharma-fiche-row"><span class="jarvis-muted">Email</span>${email}</div>
        <div class="pharma-fiche-row"><span class="jarvis-muted">Tél</span>${tel}</div>
      </div>

      <!-- COMMENTAIRE -->
      ${pharma.commentaire ? `<div class="pharma-fiche-note">${escapeHtml(pharma.commentaire)}</div>` : ''}

      <!-- TOP PRODUITS -->
      ${renderTopProducts(pharma.cip)}

      <!-- MIX vs OPS NANTES -->
      ${mixData ? renderMixVsOps(mixData) : ''}

      <!-- OPPORTUNITÉS SECTEUR -->
      ${mixData ? renderOpportunitesSecteur(pharma.cip) : ''}

      <!-- TIMELINE MENSUELLE CLIENT -->
      ${renderClientTimeline(pharma.cip)}

      <!-- DERNIÈRES FACTURES -->
      ${renderRecentInvoices(pharma.cip)}

      <!-- ACTIONS -->
      <div class="pharma-fiche-actions">
        <a class="jarvis-btn jarvis-btn-primary" href="${gmapsDir}" target="_blank" rel="noopener">Itinéraire ↗</a>
        <a class="jarvis-btn jarvis-btn-ghost" href="${gmapsUrl}" target="_blank" rel="noopener">Voir sur GMaps</a>
        <button class="jarvis-btn jarvis-btn-ghost" id="pharma-fiche-close">↓ Réduire</button>
      </div>

      <!-- CTA DEVIS (sticky bottom) -->
      ${renderDevisCta(pharma.cip)}
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
   TIMELINE MENSUELLE + DERNIÈRES FACTURES (SALES_BY_CLIENT_MONTH / DETAIL)
   ================================================================ */

function renderClientTimeline(cip) {
  const monthly = window.SALES_BY_CLIENT_MONTH && window.SALES_BY_CLIENT_MONTH[cip];
  if (!monthly || !Object.keys(monthly).length) return '';
  const months = Object.keys(monthly).sort();
  const values = months.map(m => monthly[m].ca);
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0);
  const moisLabel = (ym) => {
    const noms = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
    return noms[parseInt(ym.split('-')[1], 10) - 1] || ym;
  };
  return `
    <div class="pharma-fiche-timeline">
      <div class="pharma-fiche-timeline-title">Évolution mensuelle <span class="jarvis-muted">· ${months.length} mois · ${formatEuro(total)}</span></div>
      <div class="pharma-fiche-timeline-bars">
        ${months.map(m => {
          const pct = Math.round((monthly[m].ca / max) * 100);
          return `
            <div class="pharma-fiche-timeline-col" title="${m} · ${formatEuro(monthly[m].ca)}">
              <div class="pharma-fiche-timeline-bar-wrap"><div class="pharma-fiche-timeline-bar" style="height:${Math.max(pct, 4)}%"></div></div>
              <div class="pharma-fiche-timeline-label">${moisLabel(m)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    <style>
      .pharma-fiche-timeline {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        padding: 10px 12px;
        margin-bottom: 12px;
      }
      .pharma-fiche-timeline-title {
        font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: var(--text); margin-bottom: 10px;
      }
      .pharma-fiche-timeline-bars {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(28px, 1fr));
        gap: 4px;
        align-items: end;
        height: 80px;
      }
      .pharma-fiche-timeline-col { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; }
      .pharma-fiche-timeline-bar-wrap { width: 100%; height: 60px; display: flex; align-items: flex-end; }
      .pharma-fiche-timeline-bar { width: 100%; background: linear-gradient(180deg, var(--blue), var(--indigo)); border-radius: 3px 3px 0 0; min-height: 3px; }
      .pharma-fiche-timeline-label { font-size: 9px; color: var(--text-dim); font-weight: 700; }
    </style>
  `;
}

function renderRecentInvoices(cip) {
  const detail = window.SALES_BY_CLIENT_DETAIL && window.SALES_BY_CLIENT_DETAIL[cip];
  if (!detail || !detail.length) return '';
  const top5 = detail.slice(0, 5);
  return `
    <div class="pharma-fiche-invoices">
      <div class="pharma-fiche-products-title">Dernières factures <span class="jarvis-muted">· ${detail.length} lignes</span></div>
      ${top5.map(l => `
        <div class="pharma-fiche-invoice-row">
          <span class="pharma-fiche-invoice-date">${formatDate(l.date)}</span>
          <span class="pharma-fiche-invoice-name">${escapeHtml(l.designation)}</span>
          <span class="pharma-fiche-invoice-qty">×${l.qte}</span>
          <span class="pharma-fiche-invoice-ca"><b>${formatEuro(l.ca)}</b></span>
        </div>
      `).join('')}
    </div>
    <style>
      .pharma-fiche-invoices {
        background: var(--surface-glass-strong);
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        padding: 10px 12px;
        margin-bottom: 12px;
      }
      .pharma-fiche-invoice-row {
        display: grid;
        grid-template-columns: 60px 1fr auto auto;
        gap: 8px;
        padding: 5px 0;
        font-size: 11.5px;
        border-bottom: 1px solid var(--border);
        align-items: center;
      }
      .pharma-fiche-invoice-row:last-child { border: none; }
      .pharma-fiche-invoice-date { font-size: 10px; color: var(--blue); font-weight: 700; }
      .pharma-fiche-invoice-name {
        color: var(--text-dim);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .pharma-fiche-invoice-qty { color: var(--text-muted); font-size: 10px; }
      .pharma-fiche-invoice-ca { font-variant-numeric: tabular-nums; }
      .pharma-fiche-invoice-ca b { color: var(--text); }
    </style>
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
   CLASSIFIER FAMILLE — local, indépendant
   ================================================================ */

const FAMILLE_COLORS = {
  'Froid':            '#00B5D8',
  'Biosimilaires':    '#7C3AED',
  'Génériques':       '#94A3B8',
  'Gén. partenaires': '#14B86A',
  'Non remboursés':   '#FF9F1C',
  'Princeps':         '#0057FF',
};

const FAMILLE_ORDER = ['Froid', 'Biosimilaires', 'Génériques', 'Gén. partenaires', 'Non remboursés', 'Princeps'];

function familleFromAttrs(nature, afmcode, sousfamille) {
  const n  = (nature || '').trim();
  const a  = (afmcode || '').trim().toUpperCase();
  const sf = (sousfamille || '').toLowerCase();
  if (n === 'Biosimilaire') return 'Biosimilaires';
  if (sf.includes('froid')) return 'Froid';
  if (a && a !== 'REMBSS' && a !== '#N/A') return 'Non remboursés';
  if (n === 'Generique Partenaire') return 'Gén. partenaires';
  if (n === 'Generique') return 'Génériques';
  return 'Princeps';
}

/** Récupère les attributs catalogue d'un artcode (STOCK puis OPS_AGGREGATE) */
function getProductAttrs(artcode) {
  const stock = window.STOCK && window.STOCK[artcode];
  if (stock) return { nature: stock.nature, afmcode: stock.afmcode, sousfamille: stock.sousfamille };
  const ops = window.OPS_AGGREGATE && window.OPS_AGGREGATE[artcode];
  if (ops) return { nature: ops.nature, afmcode: ops.afmcode, sousfamille: ops.sousfamille };
  return { nature: '', afmcode: '', sousfamille: '' };
}

/* ================================================================
   MIX FAMILLE — pré-calculé une fois par fiche
   ================================================================ */

/**
 * Compute :
 *  - mine : { famille → ca, qte, pct }
 *  - ops  : { famille → ca, pct }
 *  - caTotalPharma
 *  - manqueAGagner (somme des gaps positifs × caTotalPharma)
 */
function computeMixData(pharma) {
  const cip = pharma.cip;
  const prods = window.CLIENT_PRODUCTS && window.CLIENT_PRODUCTS[cip];
  const opsAgg = window.OPS_AGGREGATE;
  if (!prods || !prods.length || !opsAgg) return null;

  // Mix pharma
  const mine = {};
  FAMILLE_ORDER.forEach(f => { mine[f] = { ca: 0, qte: 0, pct: 0 }; });
  let mineTotal = 0;
  for (const p of prods) {
    const attrs = getProductAttrs(p.artcode);
    const fam = familleFromAttrs(attrs.nature, attrs.afmcode, attrs.sousfamille);
    if (!mine[fam]) mine[fam] = { ca: 0, qte: 0, pct: 0 };
    mine[fam].ca  += (p.ca  || 0);
    mine[fam].qte += (p.qte || 0);
    mineTotal     += (p.ca  || 0);
  }
  if (mineTotal > 0) {
    FAMILLE_ORDER.forEach(f => { mine[f].pct = (mine[f].ca / mineTotal) * 100; });
  }

  // Mix OPS Nantes
  const ops = {};
  FAMILLE_ORDER.forEach(f => { ops[f] = { ca: 0, pct: 0 }; });
  let opsTotal = 0;
  for (const artcode in opsAgg) {
    const o = opsAgg[artcode];
    const fam = familleFromAttrs(o.nature, o.afmcode, o.sousfamille);
    if (!ops[fam]) ops[fam] = { ca: 0, pct: 0 };
    ops[fam].ca += (o.ca || 0);
    opsTotal    += (o.ca || 0);
  }
  if (opsTotal > 0) {
    FAMILLE_ORDER.forEach(f => { ops[f].pct = (ops[f].ca / opsTotal) * 100; });
  }

  // Manque à gagner : somme des gaps positifs où pharma sous-indexée
  let manque = 0;
  FAMILLE_ORDER.forEach(f => {
    const gapPct = ops[f].pct - mine[f].pct;
    if (gapPct > 0) {
      manque += (gapPct / 100) * mineTotal;
    }
  });

  return {
    mine,
    ops,
    caTotalPharma: mineTotal,
    manqueAGagner: manque,
  };
}

/* ================================================================
   SECTION A — OPPORTUNITÉS SECTEUR (Top 5 produits absents)
   ================================================================ */

function renderOpportunitesSecteur(cip) {
  const prods   = window.CLIENT_PRODUCTS && window.CLIENT_PRODUCTS[cip];
  const opsAgg  = window.OPS_AGGREGATE;
  if (!opsAgg) return '';

  const ownedSet = new Set((prods || []).map(p => String(p.artcode)));

  // Itère OPS_AGGREGATE, retient ceux NON présents chez la pharma
  const candidates = [];
  for (const artcode in opsAgg) {
    if (ownedSet.has(String(artcode))) continue;
    const o = opsAgg[artcode];
    if (!o || !(o.ca > 0)) continue;
    candidates.push({
      artcode,
      designation: o.designation || '',
      marque:      o.marque || '',
      ca:          o.ca || 0,
    });
  }
  candidates.sort((a, b) => b.ca - a.ca);
  const top5 = candidates.slice(0, 5);
  if (!top5.length) return '';

  const rows = top5.map(p => {
    const desig = truncate(p.designation, 35);
    return `
      <div class="pf-opp-item">
        <div class="pf-opp-main">
          <div class="pf-opp-name">${escapeHtml(desig)}</div>
          <div class="pf-opp-brand">${escapeHtml(p.marque || '—')}</div>
        </div>
        <div class="pf-opp-right">
          <span class="pf-opp-ca">${formatEuro(p.ca)}</span>
          <span class="pf-opp-tag">ABSENT</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="pf-section">
      <div class="pf-section-header">Opportunités secteur · Top 5</div>
      <div class="pf-opp-list">${rows}</div>
      <div class="pf-section-sub">Produits qui font le CA à OPS Nantes mais absents ici</div>
    </div>
  `;
}

/* ================================================================
   SECTION B — MIX vs OPS NANTES (mini bars)
   ================================================================ */

function renderMixVsOps(mixData) {
  if (!mixData) return '';
  const { mine, ops } = mixData;

  const rows = FAMILLE_ORDER.map(fam => {
    const minePct = mine[fam].pct || 0;
    const opsPct  = ops[fam].pct  || 0;
    const indice  = opsPct > 0 ? Math.round((minePct / opsPct) * 100) : 0;
    const color   = FAMILLE_COLORS[fam] || '#0057FF';
    const maxRef  = Math.max(minePct, opsPct, 1);
    const mineW   = (minePct / maxRef) * 100;
    const opsW    = (opsPct  / maxRef) * 100;
    const indiceCls = indice >= 100 ? 'pf-idx-high' : (indice >= 70 ? 'pf-idx-mid' : 'pf-idx-low');

    return `
      <div class="pf-mix-row">
        <div class="pf-mix-fam">
          <span class="pf-mix-dot" style="background:${color}"></span>
          <span class="pf-mix-name">${fam}</span>
          <span class="pf-mix-indice ${indiceCls}">${indice}</span>
        </div>
        <div class="pf-mix-bars">
          <div class="pf-mix-bar-row">
            <span class="pf-mix-bar-label">Mine</span>
            <div class="pf-mix-bar-track"><div class="pf-mix-bar-fill" style="width:${mineW}%;background:${color}"></div></div>
            <span class="pf-mix-bar-pct">${minePct.toFixed(1)}%</span>
          </div>
          <div class="pf-mix-bar-row">
            <span class="pf-mix-bar-label pf-mix-bar-label-dim">OPS</span>
            <div class="pf-mix-bar-track"><div class="pf-mix-bar-fill pf-mix-bar-fill-dim" style="width:${opsW}%;background:${color}"></div></div>
            <span class="pf-mix-bar-pct pf-mix-bar-pct-dim">${opsPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="pf-section">
      <div class="pf-section-header">Mix vs OPS Nantes</div>
      <div class="pf-mix-list">${rows}</div>
      <div class="pf-section-sub">Indice 100 = aligné · &lt;100 = sous-indexé · &gt;100 = sur-indexé</div>
    </div>
  `;
}

/* ================================================================
   SECTION C — MANQUE À GAGNER (gros chiffre)
   ================================================================ */

function renderManqueAGagner(mixData) {
  if (!mixData || !mixData.manqueAGagner || mixData.manqueAGagner <= 0) return '';
  const m = mixData.manqueAGagner;
  return `
    <div class="pf-mag">
      <div class="pf-mag-label">Manque à gagner estimé</div>
      <div class="pf-mag-value">+${formatEuroCompact(m)}</div>
      <div class="pf-mag-sub">si vous aligniez le mix sur OPS Nantes</div>
    </div>
  `;
}

/* ================================================================
   SECTION D — CTA DEVIS (sticky bottom)
   ================================================================ */

function renderDevisCta(cip) {
  // Bouton toujours présent. Si openDevisLens absent au moment du click,
  // graceful fallback : alert/tooltip "bientôt disponible".
  const iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`;
  return `
    <div class="pf-devis-cta-wrap">
      <button type="button" class="pf-devis-cta" data-cip="${escapeHtml(cip || '')}" onclick="(function(btn){var c=btn.getAttribute('data-cip');if(typeof window.openDevisLens==='function'){window.openDevisLens({cip:c});}else{btn.classList.add('pf-devis-cta--unavailable');btn.setAttribute('title','Bientôt disponible');}})(this)">
        ${iconSvg}
        <span>Préparer un devis pour cette pharmacie</span>
      </button>
    </div>
  `;
}

/* ================================================================
   HELPERS UTILS LOCAUX
   ================================================================ */

function truncate(str, n) {
  const s = String(str || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function formatEuroCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace('.0', '') + 'M€';
  if (v >= 1000)    return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k€';
  return Math.round(v) + '€';
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

/* =========================================================
   NOUVELLES SECTIONS — iOS native, fond #F2F2F7, hairlines
   ========================================================= */

.pf-section {
  background: #FFFFFF;
  border: 0.5px solid rgba(60,60,67,0.18);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.pf-section-header {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #6E6E73;
  margin-bottom: 10px;
}
.pf-section-sub {
  font-size: 10.5px;
  color: #8E8E93;
  margin-top: 8px;
  line-height: 1.35;
}

/* ---- A) Opportunités secteur ---- */
.pf-opp-list { display: flex; flex-direction: column; }
.pf-opp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 4px;
  border-bottom: 0.5px solid rgba(60,60,67,0.18);
  transition: background-color 0.12s;
}
.pf-opp-item:last-child { border-bottom: 0; }
.pf-opp-item:active { background: rgba(60,60,67,0.08); }
.pf-opp-main { flex: 1; min-width: 0; }
.pf-opp-name {
  font-size: 13px;
  color: #1C1C1E;
  font-weight: 600;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pf-opp-brand {
  font-size: 11px;
  color: #8E8E93;
  margin-top: 2px;
}
.pf-opp-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}
.pf-opp-ca {
  font-size: 12px;
  font-weight: 700;
  color: #1C1C1E;
  font-variant-numeric: tabular-nums;
  background: rgba(0, 87, 255, 0.08);
  padding: 2px 7px;
  border-radius: 6px;
}
.pf-opp-tag {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #FF3B30;
  background: rgba(255, 59, 48, 0.10);
  padding: 1px 5px;
  border-radius: 4px;
}

/* ---- B) Mix vs OPS Nantes ---- */
.pf-mix-list { display: flex; flex-direction: column; gap: 10px; }
.pf-mix-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 8px;
  border-bottom: 0.5px solid rgba(60,60,67,0.18);
}
.pf-mix-row:last-child { border-bottom: 0; padding-bottom: 0; }
.pf-mix-fam {
  display: flex;
  align-items: center;
  gap: 7px;
}
.pf-mix-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pf-mix-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #1C1C1E;
}
.pf-mix-indice {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 1px 6px;
  border-radius: 5px;
}
.pf-idx-high { background: rgba(52, 199, 89, 0.14); color: #1A8D3E; }
.pf-idx-mid  { background: rgba(255, 149, 0, 0.14); color: #C96800; }
.pf-idx-low  { background: rgba(255, 59, 48, 0.12); color: #C0392B; }

.pf-mix-bars { display: flex; flex-direction: column; gap: 3px; padding-left: 15px; }
.pf-mix-bar-row {
  display: grid;
  grid-template-columns: 28px 1fr 42px;
  align-items: center;
  gap: 6px;
}
.pf-mix-bar-label {
  font-size: 9.5px;
  font-weight: 700;
  color: #1C1C1E;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.pf-mix-bar-label-dim { color: #8E8E93; font-weight: 600; }
.pf-mix-bar-track {
  height: 6px;
  background: rgba(60,60,67,0.10);
  border-radius: 3px;
  overflow: hidden;
}
.pf-mix-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.pf-mix-bar-fill-dim { opacity: 0.45; }
.pf-mix-bar-pct {
  font-size: 10.5px;
  font-weight: 700;
  color: #1C1C1E;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.pf-mix-bar-pct-dim { color: #8E8E93; font-weight: 600; }

/* ---- C) Manque à gagner (BIG number) ---- */
.pf-mag {
  background: linear-gradient(135deg, rgba(52,199,89,0.10) 0%, rgba(52,199,89,0.04) 100%);
  border: 0.5px solid rgba(52,199,89,0.30);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
  text-align: center;
}
.pf-mag-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #1A8D3E;
}
.pf-mag-value {
  font-size: 32px;
  font-weight: 800;
  color: #34C759;
  letter-spacing: -0.5px;
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.pf-mag-sub {
  font-size: 11px;
  color: #1A8D3E;
  margin-top: 4px;
  font-weight: 500;
}

/* ---- D) CTA Devis (sticky bottom-ish) ---- */
.pf-devis-cta-wrap {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  padding: 10px 0 6px;
  margin-top: 8px;
  background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 35%, #FFFFFF 100%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 5;
}
.pf-devis-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  max-width: 360px;
  height: 50px;
  border-radius: 12px;
  border: 0;
  background: #0057FF;
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.1px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 87, 255, 0.25);
  transition: transform 0.08s ease, box-shadow 0.12s ease, background 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.pf-devis-cta:hover { background: #0048D9; }
.pf-devis-cta:active {
  transform: scale(0.985);
  box-shadow: 0 2px 6px rgba(0, 87, 255, 0.20);
}
.pf-devis-cta--unavailable {
  background: #8E8E93;
  box-shadow: none;
  cursor: not-allowed;
}
.pf-devis-cta svg { flex-shrink: 0; }

`;
  document.head.appendChild(style);
})();
