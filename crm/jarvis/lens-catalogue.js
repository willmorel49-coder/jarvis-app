// JARVIS · lens-catalogue.js
// Lentille Catalogue IP — 650 produits, onglets catégories, stock, filtres, tri.

import { registerLens } from './lens.js';

// ─── State ─────────────────────────────────────────────────────────────────
let styleInjected = false;
let state = {
  tab: 'Tous',           // onglet actif
  search: '',
  froid: false,
  inStock: false,
  sort: 'ca',            // 'ca' | 'remise' | 'prix'
  source: 'ip',          // 'ip' | 'offilog'
};

// Catégories canoniques présentes dans CATALOGUE_IP
const CATS_IP = ['Petit prix', 'Intermédiaire', 'Nr'];

// Labels onglets
const TABS = [
  { id: 'Tous',          label: 'Tous',              src: 'ip'      },
  { id: 'Petit prix',    label: 'Petits prix',        src: 'ip'      },
  { id: 'Intermédiaire', label: 'Intermédiaires',     src: 'ip'      },
  { id: 'Nr',            label: 'NR',                 src: 'ip'      },
  { id: 'Parapharmacie', label: 'Parapharmacie',      src: 'offilog' },
];

// ─── Registration ──────────────────────────────────────────────────────────
registerLens('catalogue', {
  title: 'Catalogue IP',
  render: () => buildUI(),
  onMount: (body) => {
    injectStyles();
    attachHandlers(body);
  },
});

// ─── Build HTML ────────────────────────────────────────────────────────────
function buildUI() {
  const tabsHtml = TABS.map(t => `
    <button class="lc-tab${state.tab === t.id ? ' lc-tab--active' : ''}"
            data-tab="${escapeAttr(t.id)}">${escapeHtml(t.label)}</button>
  `).join('');

  return `
    <div class="lens-catalogue">
      <!-- Onglets -->
      <nav class="lc-tabs" id="lc-tabs">${tabsHtml}</nav>

      <!-- Toolbar -->
      <div class="lc-toolbar">
        <input class="lc-search" id="lc-search" type="search"
               placeholder="Nom, EAN, marque, molécule…"
               value="${escapeAttr(state.search)}" />
        <label class="lc-toggle">
          <input type="checkbox" id="lc-froid" ${state.froid ? 'checked' : ''} />
          <span>❄️ Froid uniquement</span>
        </label>
        <label class="lc-toggle">
          <input type="checkbox" id="lc-stock" ${state.inStock ? 'checked' : ''} />
          <span>📦 En stock uniquement</span>
        </label>
        <select class="lc-sort" id="lc-sort">
          <option value="ca"     ${state.sort === 'ca'     ? 'selected' : ''}>CA potentiel ↓</option>
          <option value="remise" ${state.sort === 'remise' ? 'selected' : ''}>Remise % ↓</option>
          <option value="prix"   ${state.sort === 'prix'   ? 'selected' : ''}>Prix IP ↑</option>
        </select>
      </div>

      <!-- Compteur -->
      <div class="lc-count" id="lc-count">…</div>

      <!-- Grille -->
      <div class="lc-grid" id="lc-grid"></div>
    </div>
  `;
}

// ─── Handlers ──────────────────────────────────────────────────────────────
function attachHandlers(body) {
  // Rendu initial
  refreshGrid(body);

  // Onglets
  body.querySelector('#lc-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    state.tab = btn.dataset.tab;
    const tabDef = TABS.find(t => t.id === state.tab);
    state.source = tabDef ? tabDef.src : 'ip';
    body.querySelectorAll('.lc-tab').forEach(b => b.classList.toggle('lc-tab--active', b.dataset.tab === state.tab));
    refreshGrid(body);
  });

  // Search
  body.querySelector('#lc-search').addEventListener('input', (e) => {
    state.search = e.target.value.toLowerCase().trim();
    refreshGrid(body);
  });

  // Froid
  body.querySelector('#lc-froid').addEventListener('change', (e) => {
    state.froid = e.target.checked;
    refreshGrid(body);
  });

  // Stock
  body.querySelector('#lc-stock').addEventListener('change', (e) => {
    state.inStock = e.target.checked;
    refreshGrid(body);
  });

  // Tri
  body.querySelector('#lc-sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    refreshGrid(body);
  });
}

// ─── Refresh ───────────────────────────────────────────────────────────────
function refreshGrid(body) {
  const products = getFiltered();
  const grid  = body.querySelector('#lc-grid');
  const count = body.querySelector('#lc-count');

  const catTotal = getCategoryTotal();
  count.textContent = `${products.length} produit${products.length > 1 ? 's' : ''} affich${products.length > 1 ? 'és' : 'é'} sur ${catTotal} dans la catégorie`;

  grid.innerHTML = products.length
    ? products.map(renderCard).join('')
    : `<div class="lc-empty">Aucun produit ne correspond à votre recherche.</div>`;
}

// ─── Data ──────────────────────────────────────────────────────────────────
function getCategoryTotal() {
  if (state.source === 'offilog') {
    return (window.OFFILOG || []).length;
  }
  const ip = window.CATALOGUE_IP || [];
  return state.tab === 'Tous' ? ip.length : ip.filter(p => p.categorie === state.tab).length;
}

function getFiltered() {
  let products;

  if (state.source === 'offilog') {
    // Mode Parapharmacie → source OFFILOG
    products = (window.OFFILOG || []).map(p => ({
      _src: 'offilog',
      ean: p.ean || '',
      nom: p.produit || '',
      marque: p.marque || '',
      categorie: 'Parapharmacie',
      molecule: '',
      prix_ht: null,
      prix_ip: p.prix_offilog || null,
      remise_pct: null,
      remise_euro: null,
      offre_ip: null,
      froid: false,
      stock_dispo: null,
    }));
  } else {
    // Source CATALOGUE_IP (prioritaire)
    const ip = window.CATALOGUE_IP || [];
    products = ip.map(p => {
      const artcode = window.STOCK_EAN && window.STOCK_EAN[p.ean];
      const stockEntry = artcode && window.STOCK && window.STOCK[artcode];
      return {
        _src: 'ip',
        ean: p.ean || '',
        nom: p.nom || '',
        marque: p.marque || '',
        categorie: p.categorie || '',
        molecule: p.molecule || '',
        prix_ht: p.prix_ht,
        prix_ip: p.prix_ip,
        remise_pct: p.remise_pct,
        remise_euro: p.remise_euro,
        offre_ip: p.offre_ip,
        froid: !!p.froid,
        stock_dispo: stockEntry ? (stockEntry.dispo ?? null) : null,
      };
    });

    // Filtre onglet
    if (state.tab !== 'Tous') {
      products = products.filter(p => p.categorie === state.tab);
    }
  }

  // Filtre recherche
  if (state.search) {
    const q = state.search;
    products = products.filter(p =>
      `${p.nom} ${p.marque} ${p.ean} ${p.molecule}`.toLowerCase().includes(q)
    );
  }

  // Filtre froid
  if (state.froid) {
    products = products.filter(p => p.froid);
  }

  // Filtre stock
  if (state.inStock) {
    products = products.filter(p => p.stock_dispo != null && p.stock_dispo > 0);
  }

  // Tri
  products = sortProducts(products, state.sort);

  return products;
}

function sortProducts(list, sort) {
  const copy = [...list];
  if (sort === 'ca') {
    // CA potentiel = prix_ip × stock_dispo desc (null → 0)
    copy.sort((a, b) => {
      const caA = (a.prix_ip || 0) * (a.stock_dispo || 0);
      const caB = (b.prix_ip || 0) * (b.stock_dispo || 0);
      return caB - caA;
    });
  } else if (sort === 'remise') {
    copy.sort((a, b) => (b.remise_pct || 0) - (a.remise_pct || 0));
  } else if (sort === 'prix') {
    copy.sort((a, b) => {
      const pA = a.prix_ip ?? Infinity;
      const pB = b.prix_ip ?? Infinity;
      return pA - pB;
    });
  }
  return copy;
}

// ─── Card ──────────────────────────────────────────────────────────────────
function renderCard(p) {
  const marque = p.marque
    ? `<div class="lc-card-brand">${escapeHtml(p.marque)}${p.froid ? ' <span class="lc-cold">❄️</span>' : ''}</div>`
    : p.froid ? `<div class="lc-card-brand"><span class="lc-cold">❄️</span></div>` : '';

  const molecule = p.molecule
    ? `<div class="lc-card-mol">${escapeHtml(p.molecule)}</div>`
    : '';

  const prixHt = (typeof p.prix_ht === 'number' && p.prix_ht > 0)
    ? `<span class="lc-card-ht">${fmt(p.prix_ht)}</span>`
    : '';

  const prixIp = (typeof p.prix_ip === 'number' && p.prix_ip > 0)
    ? `<span class="lc-card-ip">${fmt(p.prix_ip)}</span>`
    : `<span class="lc-card-ip lc-card-ip--na">—</span>`;

  const remise = (typeof p.remise_pct === 'number' && p.remise_pct > 0)
    ? `<span class="lc-chip-remise">-${p.remise_pct.toFixed(1)}%</span>`
    : '';

  const offreIp = (typeof p.offre_ip === 'number' && p.offre_ip > 0)
    ? `<div class="lc-card-offre">Offre IP : ${fmt(p.offre_ip)}</div>`
    : '';

  let stockHtml;
  if (p._src === 'offilog') {
    stockHtml = '';
  } else if (p.stock_dispo == null) {
    stockHtml = `<div class="lc-card-stock lc-stock-unknown">Stock inconnu</div>`;
  } else if (p.stock_dispo === 0) {
    stockHtml = `<div class="lc-card-stock lc-stock-out">⚠ Rupture</div>`;
  } else {
    stockHtml = `<div class="lc-card-stock lc-stock-ok">📦 ${p.stock_dispo.toLocaleString('fr-FR')} en stock</div>`;
  }

  return `
    <article class="lc-card">
      ${marque}
      <h4 class="lc-card-name">${escapeHtml(p.nom || '—')}</h4>
      ${molecule}
      <div class="lc-card-prices">
        ${prixHt}
        ${prixIp}
        ${remise}
      </div>
      ${offreIp}
      ${stockHtml}
    </article>
  `;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
  }).format(n);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function escapeAttr(s) { return escapeHtml(s); }

// ─── Styles ────────────────────────────────────────────────────────────────
function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;

  const css = `
/* ── lens-catalogue scoped styles ── */
.lens-catalogue {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-bottom: 24px;
}

/* Onglets */
.lc-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px 16px 0;
  border-bottom: 1px solid rgba(255,255,255,.08);
  margin-bottom: 0;
}
.lc-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary, rgba(255,255,255,.55));
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  transition: color .15s, border-color .15s;
  white-space: nowrap;
}
.lc-tab:hover {
  color: var(--text-primary, #fff);
}
.lc-tab--active {
  border-bottom-color: var(--blue, #0057FF);
  color: var(--blue, #0057FF);
  font-weight: 600;
}

/* Toolbar */
.lc-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(255,255,255,.025);
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.lc-search {
  flex: 1;
  min-width: 180px;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px;
  color: inherit;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  padding: 7px 12px;
  transition: border-color .15s;
}
.lc-search:focus {
  border-color: var(--blue, #0057FF);
}
.lc-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  color: var(--text-secondary, rgba(255,255,255,.65));
  user-select: none;
}
.lc-toggle input[type=checkbox] {
  accent-color: var(--blue, #0057FF);
  width: 14px;
  height: 14px;
}
.lc-sort {
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px;
  color: inherit;
  font-family: inherit;
  font-size: 12px;
  outline: none;
  padding: 6px 10px;
  cursor: pointer;
}

/* Compteur */
.lc-count {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-secondary, rgba(255,255,255,.5));
}

/* Grille */
.lc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  padding: 8px 16px;
}
.lc-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 48px 16px;
  color: var(--text-secondary, rgba(255,255,255,.4));
  font-size: 14px;
}

/* Card */
.lc-card {
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform .18s ease, box-shadow .18s ease;
  cursor: default;
}
.lc-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,.35);
}
.lc-card-brand {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255,255,255,.5));
  line-height: 1.2;
}
.lc-cold { font-style: normal; }
.lc-card-name {
  font-family: 'Inter Tight', 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 700;
  margin: 0;
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: var(--text-primary, #fff);
}
.lc-card-mol {
  font-size: 10px;
  font-style: italic;
  color: rgba(255,255,255,.38);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.lc-card-prices {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.lc-card-ht {
  font-size: 11px;
  color: rgba(255,255,255,.35);
  text-decoration: line-through;
}
.lc-card-ip {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #fff);
}
.lc-card-ip--na {
  font-size: 14px;
  color: rgba(255,255,255,.3);
}
.lc-chip-remise {
  font-size: 10px;
  font-weight: 700;
  background: rgba(0,229,160,.2);
  color: #00E5A0;
  border-radius: 4px;
  padding: 2px 5px;
}
.lc-card-offre {
  font-size: 10px;
  color: #FFB020;
  font-weight: 600;
}
.lc-card-stock {
  font-size: 10px;
  font-weight: 600;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,.06);
}
.lc-stock-ok   { color: rgba(0,229,160,.85); }
.lc-stock-out  { color: #FF4D6D; }
.lc-stock-unknown { color: rgba(255,255,255,.25); }
`;

  const tag = document.createElement('style');
  tag.id = 'lens-catalogue-styles';
  tag.textContent = css;
  document.head.appendChild(tag);
}
