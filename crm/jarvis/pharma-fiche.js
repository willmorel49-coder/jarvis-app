// JARVIS · pharma-fiche.js
// Génère le HTML d'une fiche pharmacie pour affichage dans la sheet (snap medium).

export function renderPharmaFiche(pharma) {
  const ville = escapeHtml(pharma.ville || '—');
  const cp = escapeHtml(pharma.cp || '');
  const adresse = escapeHtml(pharma.adresse || '');
  const cip = escapeHtml(pharma.cip || '—');
  const email = pharma.email ? `<a href="mailto:${escapeHtml(pharma.email)}" class="jarvis-link">${escapeHtml(pharma.email)}</a>` : '<span class="jarvis-muted">—</span>';
  const tel = pharma.tel ? `<a href="tel:${escapeHtml(pharma.tel)}" class="jarvis-link">${escapeHtml(pharma.tel)}</a>` : '<span class="jarvis-muted">—</span>';
  const ca = pharma.ca2023 ? formatEuro(pharma.ca2023) : '<span class="jarvis-muted">—</span>';
  const pot = pharma.potentielGx ? formatEuro(pharma.potentielGx) : '<span class="jarvis-muted">—</span>';
  const groupChips = [pharma.pelgraz, pharma.pelmeg, pharma.ecodage, pharma.gros1, pharma.gros2]
    .filter(Boolean)
    .map((g) => `<span class="jarvis-chip">${escapeHtml(g)}</span>`)
    .join('');
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${pharma.lat},${pharma.lng}`;
  const gmapsDir = `https://www.google.com/maps/dir/?api=1&destination=${pharma.lat},${pharma.lng}`;

  return `
    <div class="pharma-fiche">
      <header class="pharma-fiche-header">
        <div>
          <div class="pharma-fiche-cip">CIP ${cip}</div>
          <h3 class="pharma-fiche-name">${escapeHtml(pharma.nom || '—')}</h3>
          <div class="pharma-fiche-loc">${adresse} · ${cp} ${ville}</div>
        </div>
      </header>
      ${groupChips ? `<div class="pharma-fiche-chips">${groupChips}</div>` : ''}
      <div class="pharma-fiche-kpis">
        <div class="pharma-fiche-kpi">
          <div class="pharma-fiche-kpi-label">CA 2023</div>
          <div class="pharma-fiche-kpi-value">${ca}</div>
        </div>
        <div class="pharma-fiche-kpi">
          <div class="pharma-fiche-kpi-label">Potentiel Gx</div>
          <div class="pharma-fiche-kpi-value">${pot}</div>
        </div>
      </div>
      <div class="pharma-fiche-contact">
        <div class="pharma-fiche-row"><span class="jarvis-muted">Email</span>${email}</div>
        <div class="pharma-fiche-row"><span class="jarvis-muted">Tél</span>${tel}</div>
      </div>
      ${pharma.commentaire ? `<div class="pharma-fiche-note">${escapeHtml(pharma.commentaire)}</div>` : ''}
      ${renderTopProducts(pharma.cip)}
      <div class="pharma-fiche-actions">
        <a class="jarvis-btn jarvis-btn-primary" href="${gmapsDir}" target="_blank" rel="noopener">Itinéraire ↗</a>
        <a class="jarvis-btn jarvis-btn-ghost" href="${gmapsUrl}" target="_blank" rel="noopener">Voir sur GMaps</a>
        <button class="jarvis-btn jarvis-btn-ghost" id="pharma-fiche-close">↓ Réduire</button>
      </div>
    </div>
  `;
}

function renderTopProducts(cip) {
  // Affiche les top 5 produits achetés (depuis client-products.js)
  const products = (window.CLIENT_PRODUCTS && window.CLIENT_PRODUCTS[cip]) ? window.CLIENT_PRODUCTS[cip] : null;
  if (!products || !products.length) return '';
  const top5 = products.slice(0, 5);
  const totalCa = (window.CLIENT_PRODUCTS_TOTAL_CA && window.CLIENT_PRODUCTS_TOTAL_CA[cip]) || products.reduce((s, p) => s + (p.ca || 0), 0);
  return `
    <div class="pharma-fiche-products">
      <div class="pharma-fiche-products-title">Top produits achetés <span class="jarvis-muted">· total ${formatEuro(totalCa)}</span></div>
      ${top5.map((p) => `
        <div class="pharma-fiche-product">
          <span class="pharma-fiche-product-name">${escapeHtml(p.designation)}</span>
          <span class="pharma-fiche-product-meta">×${p.qte} · <b>${formatEuro(p.ca)}</b></span>
        </div>
      `).join('')}
    </div>
  `;
}

function formatEuro(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
