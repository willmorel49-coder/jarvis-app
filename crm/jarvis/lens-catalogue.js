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
  const raw = (typeof window !== 'undefined' && window.OFFILOG) ? window.OFFILOG : [];
  cachedProducts = raw.slice(0, 500); // limite premier affichage pour perf
  return cachedProducts;
}

function filterProducts(products, { search, alertOnly }) {
  let out = products;
  if (search) {
    out = out.filter((p) => {
      const hay = `${p.nom || ''} ${p.marque || ''} ${p.ean || ''}`.toLowerCase();
      return hay.includes(search);
    });
  }
  if (alertOnly) {
    out = out.filter((p) => hasAlert(p));
  }
  return out.slice(0, 200);
}

function hasAlert(p) {
  const ip = p.prix_achat_ip || p.prix_ip;
  if (!ip) return false;
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
  const pxIp = formatPrice(p.prix_achat_ip || p.prix_ip);
  const pxOf = formatPrice(p.prix_offilog);
  const pxLec = formatPrice(p.prix_leclerc);
  const pxDra = formatPrice(p.prix_drakkars);
  const pxCap = formatPrice(p.prix_cap3000);
  return `
    <article class="card-prod ${alert ? 'card-prod--alert' : ''}">
      <div class="card-prod-img">${img}</div>
      <div class="card-prod-body">
        <div class="card-prod-brand">${escapeHtml(p.marque || '')}</div>
        <h4 class="card-prod-name">${escapeHtml(p.nom || '—')}</h4>
        ${alert ? `<div class="card-prod-alert">⚠ Concurrent < achat IP</div>` : ''}
        <div class="card-prod-prices">
          <div class="prx"><span>IP</span><b>${pxIp}</b></div>
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
