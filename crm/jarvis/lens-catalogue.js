// JARVIS · lens-catalogue.js
// Lentille Catalogue : affichage des produits Offilog avec recherche + alertes prix.

import { registerLens } from './lens.js';

registerLens('catalogue', {
  title: 'Catalogue Offilog',
  render: () => buildCatalogue(),
  onMount: (body) => attachHandlers(body),
});

let cachedProducts = null;
let currentFilter = { search: '', alertOnly: false };

function buildCatalogue() {
  const products = getProducts();
  return `
    <div class="lens-catalogue">
      <div class="lens-toolbar">
        <input class="lens-search" type="search" placeholder="Rechercher un produit, marque, EAN…" id="cat-search" />
        <label class="lens-toggle">
          <input type="checkbox" id="cat-alerts" />
          <span>En alerte uniquement</span>
        </label>
      </div>
      <div class="lens-count" id="cat-count">${products.length} références</div>
      <div class="lens-grid" id="cat-grid">${renderGrid(products)}</div>
    </div>
  `;
}

function attachHandlers(body) {
  const search = body.querySelector('#cat-search');
  const alertToggle = body.querySelector('#cat-alerts');
  const grid = body.querySelector('#cat-grid');
  const count = body.querySelector('#cat-count');

  function refresh() {
    const filtered = filterProducts(getProducts(), currentFilter);
    grid.innerHTML = renderGrid(filtered);
    count.textContent = `${filtered.length} référence${filtered.length > 1 ? 's' : ''}`;
  }

  search.addEventListener('input', (e) => {
    currentFilter.search = e.target.value.toLowerCase().trim();
    refresh();
  });
  alertToggle.addEventListener('change', (e) => {
    currentFilter.alertOnly = e.target.checked;
    refresh();
  });
}

function getProducts() {
  if (cachedProducts) return cachedProducts;
  // Priorité : catalogue IP réel (TOP IP DÉCROISSANT.xlsb) puis fallback OFFILOG
  if (window.CATALOGUE_IP && window.CATALOGUE_IP.length) {
    cachedProducts = window.CATALOGUE_IP.map((p) => ({
      ean: p.ean,
      produit: p.nom,
      marque: p.marque || '',
      categorie: p.categorie || '',
      molecule: p.molecule || '',
      prix_offilog: p.prix_ip,      // prix achat IP (référence)
      prix_ht: p.prix_ht,
      prix_ip: p.prix_ip,
      remise_pct: p.remise_pct,
      offre_ip: p.offre_ip,
      froid: p.froid,
      // Stock dispo (si stock.js chargé)
      stock_dispo: (window.STOCK_EAN && window.STOCK && window.STOCK[window.STOCK_EAN[p.ean]]) ? window.STOCK[window.STOCK_EAN[p.ean]].dispo : null,
    }));
    return cachedProducts;
  }
  const raw = (typeof window !== 'undefined' && window.OFFILOG) ? window.OFFILOG : [];
  cachedProducts = raw;
  return cachedProducts;
}

function filterProducts(products, { search, alertOnly }) {
  let out = products;
  if (search) {
    out = out.filter((p) => {
      // champ correct : p.produit (pas p.nom — inexistant dans OFFILOG)
      const hay = `${p.produit || ''} ${p.marque || ''} ${p.ean || ''}`.toLowerCase();
      return hay.includes(search);
    });
  }
  if (alertOnly) {
    out = out.filter((p) => hasAlert(p));
  }
  return out.slice(0, 200);
}

function hasAlert(p) {
  // prix_offilog = prix achat HT pharmacien (référence IP)
  // Alerte si un concurrent (Leclerc / Drakkars / Cap3000) vend < prix achat IP
  const ip = p.prix_offilog;
  if (!ip || ip <= 0) return false;
  return [p.prix_leclerc, p.prix_drakkars, p.prix_cap3000]
    .some((px) => typeof px === 'number' && px > 0 && px < ip);
}

function renderGrid(products) {
  if (!products.length) {
    return `<div class="lens-empty">Aucun produit ne correspond.</div>`;
  }
  return products.map(renderCard).join('');
}

function renderCard(p) {
  const img = p.img ? `<img src="${escapeAttr(p.img)}" alt="" loading="lazy" />` : `<div class="card-img-placeholder">⌬</div>`;
  const alert = hasAlert(p);
  // prix_offilog = prix achat HT (référence) — pas de champ prix_achat_ip dans OFFILOG
  const pxOf = formatPrice(p.prix_offilog);
  const pxLec = formatPrice(p.prix_leclerc);
  const pxDra = formatPrice(p.prix_drakkars);
  const pxCap = formatPrice(p.prix_cap3000);
  return `
    <article class="card-prod ${alert ? 'card-prod--alert' : ''}">
      <div class="card-prod-img">${img}</div>
      <div class="card-prod-body">
        <div class="card-prod-brand">${escapeHtml(p.marque || '')}</div>
        <h4 class="card-prod-name">${escapeHtml(p.produit || '—')}</h4>
        ${alert ? `<div class="card-prod-alert">⚠ Concurrent < achat Offilog</div>` : ''}
        <div class="card-prod-prices">
          <div class="prx"><span>Offilog</span><b>${pxOf}</b></div>
          <div class="prx"><span>Leclerc</span><b>${pxLec}</b></div>
          <div class="prx"><span>Drak</span><b>${pxDra}</b></div>
          <div class="prx"><span>Cap3k</span><b>${pxCap}</b></div>
        </div>
      </div>
    </article>
  `;
}

function formatPrice(n) {
  if (typeof n !== 'number' || n <= 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
