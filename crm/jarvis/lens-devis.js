// JARVIS · lens-devis.js
// Lentille DEVIS — module commercial autonome pour William Morel (Intégral Pharma).
// Objectif : préparer un devis chiffré pour un pharmacien en < 30 secondes
// (catalogue IP + stock), avec exports propres (presse-papier, mail, impression, sauvegarde).
//
// Conventions :
//   - ES module, aucune dépendance externe
//   - APIs natives uniquement : navigator.clipboard, mailto:, window.print, localStorage
//   - Mobile-first iOS Safari 14+, full-screen sheet sur mobile, modal centré sur desktop
//   - Style "Apple Numbers / Wallet / Mail" : surface claire, hairlines, chiffres tabulaires
//
// Sources de données globales utilisées :
//   - window.CATALOGUE_IP   : ~650 produits { ean, nom, marque, molecule, prix_ht, prix_ip, remise_pct, froid, categorie }
//   - window.STOCK          : 6370 refs keyées par artcode CIP7 { nom, ean, marque, dispo, ... }
//   - window.CLIENTS        : 517 pharmacies { cip, nom, adresse, cp, ville, email, tel, contact }
//   - window.CLIENT_PRODUCTS: top historique par cip (suggestion de panier type)

// ─── Constantes & état module ─────────────────────────────────────────────────

const LS_CART  = 'jarvis.devis.cart';
const LS_SAVED = 'jarvis.devis.saved';

const IP_COORDS = {
  nom: 'INTÉGRAL PHARMA',
  ligne1: 'Grossiste répartiteur pharmaceutique',
  ligne2: 'Saint-Berthevin · Mayenne (53)',
  email: 'contact@integralpharma.fr',
};

const CONDITIONS_2026 = 'Conditions IP 2026 — Tranches officielles : 0-4,33€ remise 0,18€ fixe · 4,33-468€ remise 3,9% · >468€ remise 19,50€ fixe';

// Etat interne (vit le temps que la lens est ouverte)
let cart = [];                  // [{ ean, nom, marque, molecule, prix_ht, prix_ip, remise_pct, qte }]
let pharma = null;              // { cip, nom, adresse, cp, ville, email, tel, contact } | null
let devisNumber = '';
let devisDate = '';
let suggestionsIndex = null;    // index lazy-built pour autocomplete
let searchTimer = null;
let activeSuggestionIdx = -1;

// Refs DOM (réinitialisées à chaque ouverture)
let overlayEl = null;
let cardEl = null;
let bodyEl = null;
let escHandler = null;
let lastFocusBeforeOpen = null;

// ─── API publique ─────────────────────────────────────────────────────────────

export function openDevisLens(opts = {}) {
  injectStyles();
  restoreCartFromStorage();
  resolvePharmaFromOpts(opts);
  devisNumber = makeDevisNumber();
  devisDate = formatDate(new Date());

  mountOverlay();
  attachHandlers();
  refreshAll();

  // Si nouveau panier et pharmacie connue : proposer suggestion
  if (pharma && cart.length === 0 && opts.suggest !== false) {
    proposeHistoricSuggestion();
  }
}

export function setupDevisIntents(ctx) {
  // Le spec parle d'un array ctx.intents. main.js actuel utilise intents.js
  // (rule-based). On supporte les deux : array OU registerIntent().
  const rule = {
    re: /\b(devis|panier|facture|simul|cot[ae]r)\b/i,
    action: () => openDevisLens(),
  };
  if (ctx && Array.isArray(ctx.intents)) {
    ctx.intents.push(rule);
  } else if (ctx && typeof ctx.registerIntent === 'function') {
    ctx.registerIntent(rule);
  } else {
    // Fallback global : expose une commande utilisable depuis main.js
    window.__JARVIS_DEVIS_INTENT__ = rule;
  }
}

// ─── Construction du DOM ──────────────────────────────────────────────────────

function mountOverlay() {
  if (overlayEl) closeDevis(true);
  lastFocusBeforeOpen = document.activeElement;

  overlayEl = document.createElement('div');
  overlayEl.className = 'ld-overlay';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');
  overlayEl.setAttribute('aria-label', 'Devis Intégral Pharma');

  cardEl = document.createElement('div');
  cardEl.className = 'ld-card';
  cardEl.innerHTML = renderCardSkeleton();
  overlayEl.appendChild(cardEl);
  document.body.appendChild(overlayEl);

  bodyEl = cardEl.querySelector('.ld-body');

  // Trigger animation
  requestAnimationFrame(() => {
    overlayEl.classList.add('ld-overlay--open');
    cardEl.classList.add('ld-card--open');
  });

  // Focus initial sur la recherche
  setTimeout(() => {
    const input = cardEl.querySelector('.ld-search-input');
    if (input) input.focus();
  }, 200);
}

function renderCardSkeleton() {
  return `
    <header class="ld-header">
      <div class="ld-header-brand">
        <div class="ld-logo" aria-hidden="true">IP</div>
        <div class="ld-brand-meta">
          <div class="ld-brand-title">${escapeHtml(IP_COORDS.nom)}</div>
          <div class="ld-brand-sub">${escapeHtml(IP_COORDS.ligne1)} · ${escapeHtml(IP_COORDS.ligne2)}</div>
        </div>
      </div>
      <div class="ld-header-meta">
        <div class="ld-devis-no" id="ld-devis-no"></div>
        <div class="ld-devis-date" id="ld-devis-date"></div>
      </div>
      <button class="ld-close" aria-label="Fermer le devis" type="button">×</button>
    </header>

    <div class="ld-body">
      <!-- A · Pharmacie destinataire -->
      <section class="ld-section ld-section--pharma">
        <div class="ld-section-label">Devis pour</div>
        <div class="ld-pharma-block" id="ld-pharma-block"></div>
      </section>

      <!-- B · Recherche produit -->
      <section class="ld-section ld-section--search">
        <div class="ld-section-label">Ajouter un produit</div>
        <div class="ld-search-wrap">
          <input class="ld-search-input" type="search" inputmode="search"
                 placeholder="Nom, EAN, code CIP13…"
                 autocomplete="off" autocorrect="off" spellcheck="false" />
          <div class="ld-suggestions" id="ld-suggestions" role="listbox" hidden></div>
        </div>
      </section>

      <!-- C · Panier -->
      <section class="ld-section ld-section--cart">
        <div class="ld-section-head">
          <div class="ld-section-label">Lignes du devis</div>
          <button class="ld-link-btn" data-action="clear-cart" type="button">Vider</button>
        </div>
        <div class="ld-cart" id="ld-cart"></div>
      </section>

      <!-- D · Totaux -->
      <section class="ld-section ld-section--totals" id="ld-totals"></section>

      <!-- Mention conditions -->
      <div class="ld-conditions">${escapeHtml(CONDITIONS_2026)}</div>

      <!-- Devis archivés -->
      <details class="ld-archives">
        <summary>Devis archivés</summary>
        <div class="ld-archives-list" id="ld-archives-list"></div>
      </details>
    </div>

    <footer class="ld-footer">
      <button class="ld-btn ld-btn--ghost" data-action="copy" type="button">
        <span class="ld-btn-ico" aria-hidden="true">${ICON_COPY}</span> Copier
      </button>
      <button class="ld-btn ld-btn--ghost" data-action="mail" type="button">
        <span class="ld-btn-ico" aria-hidden="true">${ICON_MAIL}</span> Mail
      </button>
      <button class="ld-btn ld-btn--ghost" data-action="print" type="button">
        <span class="ld-btn-ico" aria-hidden="true">${ICON_PRINT}</span> Imprimer
      </button>
      <button class="ld-btn ld-btn--primary" data-action="save" type="button">
        <span class="ld-btn-ico" aria-hidden="true">${ICON_SAVE}</span> Enregistrer
      </button>
    </footer>
  `;
}

// ─── Refresh global ───────────────────────────────────────────────────────────

function refreshAll() {
  if (!cardEl) return;
  cardEl.querySelector('#ld-devis-no').textContent = devisNumber;
  cardEl.querySelector('#ld-devis-date').textContent = devisDate;
  renderPharmaBlock();
  renderCart();
  renderTotals();
  renderArchives();
}

function renderPharmaBlock() {
  const wrap = cardEl.querySelector('#ld-pharma-block');
  if (!wrap) return;
  if (pharma) {
    const contact = pharma.contact ? `<div class="ld-pharma-contact">${escapeHtml(pharma.contact)}</div>` : '';
    const tel = pharma.tel ? `<span class="ld-pharma-pill">Tél ${escapeHtml(pharma.tel)}</span>` : '';
    const mail = pharma.email ? `<span class="ld-pharma-pill">${escapeHtml(pharma.email)}</span>` : '';
    wrap.innerHTML = `
      <div class="ld-pharma-name">${escapeHtml(pharma.nom || 'Pharmacie')}</div>
      <div class="ld-pharma-addr">${escapeHtml([pharma.adresse, pharma.cp, pharma.ville].filter(Boolean).join(' · '))}</div>
      ${contact}
      <div class="ld-pharma-pills">
        ${pharma.cip ? `<span class="ld-pharma-pill">CIP ${escapeHtml(pharma.cip)}</span>` : ''}
        ${tel}${mail}
      </div>
      <button class="ld-link-btn ld-link-btn--small" data-action="edit-pharma" type="button">Modifier</button>
    `;
  } else {
    wrap.innerHTML = `
      <div class="ld-pharma-empty">Aucune pharmacie sélectionnée</div>
      <input class="ld-pharma-input" id="ld-pharma-name" type="text"
             placeholder="Nom de l'officine" />
      <input class="ld-pharma-input" id="ld-pharma-city" type="text"
             placeholder="Code postal · Ville" />
    `;
  }
}

function renderCart() {
  const wrap = cardEl.querySelector('#ld-cart');
  if (!wrap) return;

  if (cart.length === 0) {
    wrap.innerHTML = `
      <div class="ld-cart-empty">
        Aucune ligne. Cherche un produit ci-dessus pour démarrer le devis.
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <table class="ld-cart-table">
      <thead>
        <tr>
          <th class="ld-th-num">#</th>
          <th class="ld-th-prod">Produit</th>
          <th class="ld-th-qte">Qté</th>
          <th class="ld-th-num">PHT</th>
          <th class="ld-th-num">P. IP</th>
          <th class="ld-th-num">Remise</th>
          <th class="ld-th-num">Économie</th>
          <th class="ld-th-act"></th>
        </tr>
      </thead>
      <tbody>
        ${cart.map((line, i) => renderCartRow(line, i)).join('')}
      </tbody>
    </table>
  `;
}

function renderCartRow(line, i) {
  const remisePct = computeRemisePct(line);
  const ecoUnit = (line.prix_ht || 0) - (line.prix_ip || 0);
  const ecoTotal = ecoUnit * (line.qte || 0);
  const sub = [line.marque, line.molecule].filter(Boolean).join(' · ');

  return `
    <tr data-row="${i}">
      <td class="ld-td-num">${i + 1}</td>
      <td class="ld-td-prod">
        <div class="ld-prod-name">${escapeHtml(line.nom)}</div>
        <div class="ld-prod-sub">${escapeHtml(sub)}${sub && line.ean ? ' · ' : ''}${line.ean ? 'EAN ' + escapeHtml(line.ean) : ''}</div>
      </td>
      <td class="ld-td-qte">
        <input class="ld-qte-input" type="number" inputmode="numeric"
               min="1" step="1" value="${line.qte}" data-row="${i}" />
      </td>
      <td class="ld-td-num ld-num">${fmtEur(line.prix_ht)}</td>
      <td class="ld-td-num ld-num ld-num--ip">${fmtEur(line.prix_ip)}</td>
      <td class="ld-td-num ld-num">${remisePct != null ? '-' + remisePct.toFixed(1) + '%' : '—'}</td>
      <td class="ld-td-num ld-num ld-num--eco">${fmtEur(ecoTotal)}</td>
      <td class="ld-td-act">
        <button class="ld-row-del" data-action="remove" data-row="${i}"
                type="button" aria-label="Supprimer la ligne ${i + 1}">×</button>
      </td>
    </tr>
  `;
}

function renderTotals() {
  const wrap = cardEl.querySelector('#ld-totals');
  if (!wrap) return;
  const t = computeTotals();
  wrap.innerHTML = `
    <div class="ld-totals-grid">
      <div class="ld-total-cell">
        <div class="ld-total-label">Total HT brut</div>
        <div class="ld-total-value ld-num">${fmtEur(t.totalHt)}</div>
      </div>
      <div class="ld-total-cell">
        <div class="ld-total-label">Total IP</div>
        <div class="ld-total-value ld-total-value--ip ld-num">${fmtEur(t.totalIp)}</div>
      </div>
      <div class="ld-total-cell ld-total-cell--hero">
        <div class="ld-total-label">Économie totale</div>
        <div class="ld-total-value ld-total-value--eco ld-num">${fmtEur(t.economie)}</div>
        <div class="ld-total-sub">Soit ${t.remiseMoyenne.toFixed(1)}% de remise moyenne</div>
      </div>
    </div>
  `;
}

function renderArchives() {
  const wrap = cardEl.querySelector('#ld-archives-list');
  if (!wrap) return;
  const saved = readSaved();
  if (saved.length === 0) {
    wrap.innerHTML = '<div class="ld-archives-empty">Aucun devis sauvegardé pour le moment.</div>';
    return;
  }
  wrap.innerHTML = saved.slice(0, 20).map((d) => `
    <div class="ld-archive-row">
      <div class="ld-archive-meta">
        <div class="ld-archive-no">${escapeHtml(d.numero)}</div>
        <div class="ld-archive-sub">${escapeHtml(d.date)} · ${escapeHtml(d.pharma || '—')} · ${d.lignes} ligne${d.lignes > 1 ? 's' : ''}</div>
      </div>
      <div class="ld-archive-actions">
        <div class="ld-archive-eco ld-num">${fmtEur(d.economie)}</div>
        <button class="ld-link-btn" data-action="reload" data-id="${escapeAttr(d.id)}" type="button">Recharger</button>
        <button class="ld-link-btn ld-link-btn--danger" data-action="delete-archive" data-id="${escapeAttr(d.id)}" type="button">Supprimer</button>
      </div>
    </div>
  `).join('');
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function attachHandlers() {
  // Close
  cardEl.querySelector('.ld-close').addEventListener('click', () => closeDevis());
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closeDevis();
  });

  // ESC + focus trap
  escHandler = (e) => {
    if (e.key === 'Escape') { closeDevis(); return; }
    if (e.key === 'Tab') trapFocus(e);
  };
  document.addEventListener('keydown', escHandler);

  // Search input
  const input = cardEl.querySelector('.ld-search-input');
  input.addEventListener('input', onSearchInput);
  input.addEventListener('keydown', onSearchKeydown);
  input.addEventListener('blur', () => {
    // Délai pour permettre le click sur une suggestion
    setTimeout(hideSuggestions, 150);
  });

  // Délégation sur le body (panier, archives, pharmacie)
  bodyEl.addEventListener('click', onBodyClick);
  bodyEl.addEventListener('input', onBodyInput);
  bodyEl.addEventListener('change', onBodyChange);

  // Footer (exports)
  cardEl.querySelector('.ld-footer').addEventListener('click', onFooterClick);

  // Swipe-down close sur mobile (handle implicite : top de la card)
  setupSwipeDown(cardEl);
}

function onSearchInput(e) {
  const q = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const results = searchProducts(q);
    showSuggestions(results, q);
  }, 120);
}

function onSearchKeydown(e) {
  const list = cardEl.querySelector('#ld-suggestions');
  if (!list || list.hidden) return;
  const items = list.querySelectorAll('.ld-suggestion');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeSuggestionIdx = Math.min(activeSuggestionIdx + 1, items.length - 1);
    updateSuggestionFocus(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeSuggestionIdx = Math.max(activeSuggestionIdx - 1, 0);
    updateSuggestionFocus(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const idx = activeSuggestionIdx >= 0 ? activeSuggestionIdx : 0;
    const item = items[idx];
    if (item) item.click();
  }
}

function updateSuggestionFocus(items) {
  items.forEach((el, i) => el.classList.toggle('ld-suggestion--active', i === activeSuggestionIdx));
  const el = items[activeSuggestionIdx];
  if (el) el.scrollIntoView({ block: 'nearest' });
}

function onBodyClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'remove') {
    const idx = parseInt(target.dataset.row, 10);
    removeLine(idx);
  } else if (action === 'clear-cart') {
    if (cart.length === 0) return;
    if (confirm('Vider le panier ?')) {
      cart = [];
      persistCart();
      renderCart();
      renderTotals();
    }
  } else if (action === 'edit-pharma') {
    pharma = null;
    renderPharmaBlock();
  } else if (action === 'reload') {
    reloadArchive(target.dataset.id);
  } else if (action === 'delete-archive') {
    deleteArchive(target.dataset.id);
  }
}

function onBodyInput(e) {
  if (e.target.classList.contains('ld-qte-input')) {
    const idx = parseInt(e.target.dataset.row, 10);
    const qte = Math.max(1, parseInt(e.target.value, 10) || 1);
    if (cart[idx]) {
      cart[idx].qte = qte;
      persistCart();
      renderTotals();
      // Refresh juste la ligne (économie totale)
      const row = cardEl.querySelector(`tr[data-row="${idx}"]`);
      if (row) {
        const ecoUnit = (cart[idx].prix_ht || 0) - (cart[idx].prix_ip || 0);
        const cell = row.querySelector('.ld-num--eco');
        if (cell) cell.textContent = fmtEur(ecoUnit * qte);
      }
    }
  }
}

function onBodyChange(e) {
  if (e.target.id === 'ld-pharma-name' || e.target.id === 'ld-pharma-city') {
    const name = (cardEl.querySelector('#ld-pharma-name') || {}).value || '';
    const city = (cardEl.querySelector('#ld-pharma-city') || {}).value || '';
    if (name || city) {
      const m = city.match(/^\s*(\d{4,5})\s*[·\-\s]\s*(.+)$/);
      pharma = {
        cip: '',
        nom: name,
        adresse: '',
        cp: m ? m[1] : '',
        ville: m ? m[2] : city,
        email: '',
        tel: '',
        contact: '',
      };
    }
  }
}

function onFooterClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'copy') exportCopy(btn);
  else if (action === 'mail') exportMail();
  else if (action === 'print') exportPrint();
  else if (action === 'save') exportSave(btn);
}

// ─── Suggestions / recherche ──────────────────────────────────────────────────

function buildSuggestionsIndex() {
  if (suggestionsIndex) return suggestionsIndex;
  const map = new Map();
  // 1) CATALOGUE_IP : prix IP officiels
  const ip = window.CATALOGUE_IP || [];
  for (const p of ip) {
    const key = p.ean || p.cip13;
    if (!key) continue;
    map.set(key, {
      ean: key,
      nom: p.nom || '',
      marque: p.marque || '',
      molecule: p.molecule || '',
      prix_ht: typeof p.prix_ht === 'number' ? p.prix_ht : null,
      prix_ip: typeof p.prix_ip === 'number' ? p.prix_ip : null,
      remise_pct: typeof p.remise_pct === 'number' ? p.remise_pct : null,
      froid: !!p.froid,
      _src: 'ip',
      _norm: norm(`${p.nom} ${p.marque} ${p.molecule} ${key}`),
    });
  }
  // 2) STOCK (keyé par artcode) : compléter avec produits du stock non couverts
  const stock = window.STOCK || {};
  for (const artcode in stock) {
    const s = stock[artcode];
    if (!s) continue;
    const ean = s.ean || artcode;
    if (map.has(ean)) continue;
    map.set(ean, {
      ean,
      artcode,
      nom: s.nom || '',
      marque: s.marque || '',
      molecule: s.mol || '',
      prix_ht: null,
      prix_ip: null,
      remise_pct: null,
      froid: false,
      _src: 'stock',
      _norm: norm(`${s.nom} ${s.marque} ${s.mol} ${ean} ${artcode}`),
    });
  }
  suggestionsIndex = Array.from(map.values());
  return suggestionsIndex;
}

function searchProducts(q) {
  const n = norm(q);
  if (!n || n.length < 2) return [];
  const idx = buildSuggestionsIndex();
  const results = [];
  for (let i = 0; i < idx.length && results.length < 30; i++) {
    if (idx[i]._norm.indexOf(n) !== -1) results.push(idx[i]);
  }
  // Priorité : commence par > contient · IP avant stock
  results.sort((a, b) => {
    const aStart = a._norm.startsWith(n) ? 0 : 1;
    const bStart = b._norm.startsWith(n) ? 0 : 1;
    if (aStart !== bStart) return aStart - bStart;
    if (a._src !== b._src) return a._src === 'ip' ? -1 : 1;
    return 0;
  });
  return results.slice(0, 10);
}

function showSuggestions(list, query) {
  const wrap = cardEl.querySelector('#ld-suggestions');
  if (!wrap) return;
  if (!list.length) {
    if (query && query.trim().length >= 2) {
      wrap.innerHTML = `<div class="ld-suggestion ld-suggestion--empty">Aucun produit trouvé pour « ${escapeHtml(query)} »</div>`;
      wrap.hidden = false;
    } else {
      wrap.hidden = true;
      wrap.innerHTML = '';
    }
    return;
  }
  wrap.innerHTML = list.map((p, i) => `
    <div class="ld-suggestion" data-ean="${escapeAttr(p.ean)}" role="option" data-idx="${i}">
      <div class="ld-suggestion-main">
        <div class="ld-suggestion-name">${escapeHtml(p.nom)}</div>
        <div class="ld-suggestion-sub">${escapeHtml([p.marque, p.molecule].filter(Boolean).join(' · '))} · EAN ${escapeHtml(p.ean)}</div>
      </div>
      <div class="ld-suggestion-price ld-num">${p.prix_ip != null ? fmtEur(p.prix_ip) : '<span class="ld-suggestion-tag">stock seul</span>'}</div>
    </div>
  `).join('');
  wrap.hidden = false;
  activeSuggestionIdx = -1;
  wrap.querySelectorAll('.ld-suggestion').forEach((el) => {
    el.addEventListener('mousedown', (ev) => {
      // mousedown plutôt que click pour battre le blur
      ev.preventDefault();
      const ean = el.dataset.ean;
      const prod = list.find((x) => x.ean === ean);
      if (prod) addToCart(prod);
    });
  });
}

function hideSuggestions() {
  const wrap = cardEl && cardEl.querySelector('#ld-suggestions');
  if (wrap) { wrap.hidden = true; wrap.innerHTML = ''; }
  activeSuggestionIdx = -1;
}

// ─── Panier ───────────────────────────────────────────────────────────────────

function addToCart(prod) {
  // Si déjà présent → +1 qte
  const existing = cart.find((c) => c.ean === prod.ean);
  if (existing) {
    existing.qte = (existing.qte || 1) + 1;
  } else {
    cart.push({
      ean: prod.ean,
      nom: prod.nom,
      marque: prod.marque || '',
      molecule: prod.molecule || '',
      prix_ht: prod.prix_ht,
      prix_ip: prod.prix_ip,
      remise_pct: prod.remise_pct,
      qte: 1,
    });
  }
  persistCart();
  renderCart();
  renderTotals();

  // Reset recherche
  const input = cardEl.querySelector('.ld-search-input');
  if (input) { input.value = ''; input.focus(); }
  hideSuggestions();
}

function removeLine(idx) {
  if (idx < 0 || idx >= cart.length) return;
  cart.splice(idx, 1);
  persistCart();
  renderCart();
  renderTotals();
}

function computeRemisePct(line) {
  if (typeof line.remise_pct === 'number' && line.remise_pct > 0) return line.remise_pct;
  if (line.prix_ht && line.prix_ip && line.prix_ht > 0) {
    return ((line.prix_ht - line.prix_ip) / line.prix_ht) * 100;
  }
  return null;
}

function computeTotals() {
  let totalHt = 0;
  let totalIp = 0;
  for (const line of cart) {
    const qte = line.qte || 0;
    if (typeof line.prix_ht === 'number') totalHt += line.prix_ht * qte;
    if (typeof line.prix_ip === 'number') totalIp += line.prix_ip * qte;
  }
  const economie = totalHt - totalIp;
  const remiseMoyenne = totalHt > 0 ? (economie / totalHt) * 100 : 0;
  return { totalHt, totalIp, economie, remiseMoyenne };
}

// ─── Pharmacie ────────────────────────────────────────────────────────────────

function resolvePharmaFromOpts(opts) {
  pharma = null;
  if (!opts || !opts.cip) return;
  const clients = window.CLIENTS || [];
  const found = clients.find((c) => String(c.cip) === String(opts.cip));
  if (found) {
    pharma = {
      cip: found.cip,
      nom: found.nom,
      adresse: found.adresse || '',
      cp: found.cp || '',
      ville: found.ville || '',
      email: found.email || '',
      tel: found.tel || '',
      contact: found.contact || '',
    };
  } else {
    pharma = { cip: opts.cip, nom: '', adresse: '', cp: '', ville: '', email: '', tel: '', contact: '' };
  }
}

function proposeHistoricSuggestion() {
  if (!pharma || !pharma.cip) return;
  const tops = (window.CLIENT_PRODUCTS || {})[pharma.cip];
  if (!Array.isArray(tops) || tops.length === 0) return;

  // Notification non-bloquante en haut du panier (suggestion opt-in)
  const wrap = cardEl.querySelector('#ld-cart');
  if (!wrap) return;
  const banner = document.createElement('div');
  banner.className = 'ld-suggest-banner';
  banner.innerHTML = `
    <div class="ld-suggest-text">
      ${tops.length} produits déjà achetés par cette officine. Pré-remplir le devis ?
    </div>
    <div class="ld-suggest-actions">
      <button class="ld-link-btn ld-link-btn--small" type="button" data-suggest="yes">Oui · top 8</button>
      <button class="ld-link-btn ld-link-btn--small ld-link-btn--ghost" type="button" data-suggest="no">Non merci</button>
    </div>
  `;
  wrap.parentNode.insertBefore(banner, wrap);
  banner.addEventListener('click', (e) => {
    const choice = e.target.dataset.suggest;
    if (choice === 'yes') {
      const idx = buildSuggestionsIndex();
      const idxByEan = new Map(idx.map((p) => [p.ean, p]));
      const top8 = tops.slice(0, 8);
      for (const t of top8) {
        const prod = idxByEan.get(t.artcode) || idxByEan.get(String(t.artcode));
        if (prod) addToCart(prod);
      }
      banner.remove();
    } else if (choice === 'no') {
      banner.remove();
    }
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

function buildTextDevis() {
  const lines = [];
  const SEP = '─'.repeat(56);
  lines.push(IP_COORDS.nom);
  lines.push(IP_COORDS.ligne1);
  lines.push(IP_COORDS.ligne2 + ' · ' + IP_COORDS.email);
  lines.push('');
  lines.push(`Devis n° ${devisNumber}`);
  lines.push(`Date : ${devisDate}`);
  lines.push('');
  if (pharma) {
    lines.push('Destinataire :');
    if (pharma.nom) lines.push('  ' + pharma.nom);
    const addr = [pharma.adresse, pharma.cp, pharma.ville].filter(Boolean).join(' · ');
    if (addr) lines.push('  ' + addr);
    if (pharma.cip) lines.push('  CIP ' + pharma.cip);
    if (pharma.contact) lines.push('  Contact : ' + pharma.contact);
    if (pharma.tel) lines.push('  Tél : ' + pharma.tel);
    if (pharma.email) lines.push('  Email : ' + pharma.email);
    lines.push('');
  }
  lines.push(SEP);
  lines.push(padRight('# Produit', 36) + padLeft('Qté', 5) + padLeft('PHT', 8) + padLeft('P.IP', 8) + padLeft('Éco €', 9));
  lines.push(SEP);
  cart.forEach((line, i) => {
    const num = String(i + 1).padStart(2, ' ');
    const nom = (line.nom || '').slice(0, 33);
    const qte = String(line.qte);
    const pht = line.prix_ht != null ? fmtEurPlain(line.prix_ht) : '—';
    const pip = line.prix_ip != null ? fmtEurPlain(line.prix_ip) : '—';
    const eco = fmtEurPlain(((line.prix_ht || 0) - (line.prix_ip || 0)) * (line.qte || 0));
    lines.push(padRight(`${num} ${nom}`, 36) + padLeft(qte, 5) + padLeft(pht, 8) + padLeft(pip, 8) + padLeft(eco, 9));
    if (line.marque || line.molecule || line.ean) {
      const sub = [line.marque, line.molecule, line.ean ? 'EAN ' + line.ean : ''].filter(Boolean).join(' · ');
      lines.push('   ' + sub);
    }
  });
  lines.push(SEP);
  const t = computeTotals();
  lines.push(padRight('Total HT brut', 50) + padLeft(fmtEurPlain(t.totalHt), 16));
  lines.push(padRight('Total IP', 50) + padLeft(fmtEurPlain(t.totalIp), 16));
  lines.push(padRight(`ÉCONOMIE (${t.remiseMoyenne.toFixed(1)}%)`, 50) + padLeft(fmtEurPlain(t.economie), 16));
  lines.push('');
  lines.push(CONDITIONS_2026);
  return lines.join('\n');
}

function exportCopy(btn) {
  const txt = buildTextDevis();
  const done = () => flashBtn(btn, 'Copié');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
  } else {
    fallbackCopy(txt, done);
  }
}

function fallbackCopy(txt, done) {
  const ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { /* noop */ }
  ta.remove();
}

function exportMail() {
  const subject = `Devis Intégral Pharma ${devisNumber}${pharma && pharma.nom ? ' — ' + pharma.nom : ''}`;
  const body = buildTextDevis();
  const to = pharma && pharma.email ? encodeURIComponent(pharma.email) : '';
  const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  // Sur iOS Safari : window.location est plus fiable que window.open pour mailto:
  window.location.href = href;
}

function exportPrint() {
  document.body.classList.add('ld-printing');
  // Laisse le rendu se stabiliser
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove('ld-printing'), 500);
  }, 100);
}

function exportSave(btn) {
  if (cart.length === 0) {
    flashBtn(btn, 'Panier vide');
    return;
  }
  const saved = readSaved();
  const t = computeTotals();
  const entry = {
    id: 'd' + Date.now() + Math.random().toString(36).slice(2, 6),
    numero: devisNumber,
    date: devisDate,
    timestamp: Date.now(),
    pharma: pharma ? pharma.nom : '',
    cip: pharma ? pharma.cip : '',
    lignes: cart.length,
    totalHt: t.totalHt,
    totalIp: t.totalIp,
    economie: t.economie,
    cart: cart.slice(),
    pharmaSnap: pharma ? { ...pharma } : null,
  };
  saved.unshift(entry);
  // Cap à 50 devis
  while (saved.length > 50) saved.pop();
  try {
    localStorage.setItem(LS_SAVED, JSON.stringify(saved));
    flashBtn(btn, 'Enregistré');
    renderArchives();
  } catch (e) {
    flashBtn(btn, 'Erreur');
  }
}

function reloadArchive(id) {
  const saved = readSaved();
  const entry = saved.find((d) => d.id === id);
  if (!entry) return;
  cart = (entry.cart || []).slice();
  pharma = entry.pharmaSnap ? { ...entry.pharmaSnap } : null;
  devisNumber = entry.numero;
  devisDate = entry.date;
  persistCart();
  refreshAll();
}

function deleteArchive(id) {
  if (!confirm('Supprimer ce devis archivé ?')) return;
  const saved = readSaved().filter((d) => d.id !== id);
  try { localStorage.setItem(LS_SAVED, JSON.stringify(saved)); } catch (e) {}
  renderArchives();
}

function readSaved() {
  try {
    const raw = localStorage.getItem(LS_SAVED);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function persistCart() {
  try {
    localStorage.setItem(LS_CART, JSON.stringify(cart));
  } catch (e) { /* localStorage full ou bloqué */ }
}

function restoreCartFromStorage() {
  try {
    const raw = localStorage.getItem(LS_CART);
    if (!raw) { cart = []; return; }
    const arr = JSON.parse(raw);
    cart = Array.isArray(arr) ? arr : [];
  } catch (e) { cart = []; }
}

// ─── Close + cleanup ──────────────────────────────────────────────────────────

function closeDevis(immediate) {
  if (!overlayEl) return;
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  if (immediate) {
    overlayEl.remove();
    overlayEl = null; cardEl = null; bodyEl = null;
    return;
  }
  overlayEl.classList.remove('ld-overlay--open');
  cardEl.classList.remove('ld-card--open');
  const el = overlayEl;
  setTimeout(() => {
    el.remove();
    if (overlayEl === el) {
      overlayEl = null; cardEl = null; bodyEl = null;
    }
    if (lastFocusBeforeOpen && typeof lastFocusBeforeOpen.focus === 'function') {
      try { lastFocusBeforeOpen.focus(); } catch (e) {}
    }
  }, 380);
}

function trapFocus(e) {
  if (!cardEl) return;
  const focusables = cardEl.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function setupSwipeDown(card) {
  let startY = null;
  let currentY = 0;
  let isDragging = false;

  function onStart(e) {
    // Ne déclenche que sur le header (handle visuel) sur mobile
    if (window.innerWidth > 720) return;
    if (!e.target.closest('.ld-header')) return;
    startY = (e.touches ? e.touches[0].clientY : e.clientY);
    currentY = 0;
    isDragging = true;
  }
  function onMove(e) {
    if (!isDragging || startY === null) return;
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    currentY = Math.max(0, y - startY);
    if (currentY > 0) {
      card.style.transform = `translateY(${currentY}px)`;
      if (e.cancelable) e.preventDefault();
    }
  }
  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (currentY > 120) {
      closeDevis();
    } else {
      card.style.transform = '';
    }
    startY = null;
    currentY = 0;
  }
  card.addEventListener('touchstart', onStart, { passive: true });
  card.addEventListener('touchmove', onMove, { passive: false });
  card.addEventListener('touchend', onEnd);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDevisNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `DEVIS-${y}${m}${day}-${suffix}`;
}

function formatDate(d) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function norm(s) {
  // Range U+0300..U+036F = "Combining Diacritical Marks" (accents séparés post-NFD)
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fmtEur(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
  }).format(n);
}

function fmtEurPlain(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(2).replace('.', ',') + ' €';
}

function padRight(s, len) {
  s = String(s);
  if (s.length >= len) return s.slice(0, len);
  return s + ' '.repeat(len - s.length);
}
function padLeft(s, len) {
  s = String(s);
  if (s.length >= len) return s.slice(0, len);
  return ' '.repeat(len - s.length) + s;
}

function flashBtn(btn, msg) {
  if (!btn) return;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="ld-btn-flash">${escapeHtml(msg)}</span>`;
  setTimeout(() => {
    btn.innerHTML = original;
    btn.disabled = false;
  }, 1400);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function escapeAttr(s) { return escapeHtml(s); }

// ─── Icônes inline (SVG, pas d'emoji) ─────────────────────────────────────────

const ICON_COPY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICON_MAIL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const ICON_PRINT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M6 14h12v8H6z"/></svg>';
const ICON_SAVE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>';

// ─── Styles ───────────────────────────────────────────────────────────────────

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const css = `
/* ── lens-devis scoped styles · iOS native look ── */
.ld-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0);
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  transition: background .25s ease, backdrop-filter .25s ease;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.ld-overlay--open {
  background: rgba(20,20,30,.42);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
}
.ld-card {
  background: #F2F2F7;
  width: 100%; max-width: 980px;
  max-height: calc(100vh - 48px);
  border-radius: 20px;
  box-shadow:
    0 1px 0 rgba(255,255,255,.6) inset,
    0 24px 60px -8px rgba(20,20,30,.35),
    0 8px 24px -4px rgba(0,0,0,.18);
  display: flex; flex-direction: column;
  overflow: hidden;
  transform: translateY(100%);
  transition: transform 380ms cubic-bezier(.34,1.56,.64,1);
  color: #1C1C1E;
}
.ld-card--open { transform: translateY(0); }

@media (max-width: 720px) {
  .ld-overlay { padding: 0; align-items: flex-end; }
  .ld-card {
    max-width: 100%;
    max-height: 92vh;
    height: 92vh;
    border-radius: 16px 16px 0 0;
  }
  .ld-card::before {
    content: '';
    display: block;
    width: 38px; height: 5px;
    background: rgba(60,60,67,.28);
    border-radius: 3px;
    margin: 8px auto 0;
    flex-shrink: 0;
  }
}

/* ── Header ── */
.ld-header {
  position: relative;
  padding: 18px 22px 16px;
  background: #FFFFFF;
  border-bottom: 0.5px solid rgba(60,60,67,.18);
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 6px 12px;
  align-items: center;
  flex-shrink: 0;
}
.ld-header-brand { display: flex; align-items: center; gap: 12px; grid-column: 1; }
.ld-logo {
  width: 44px; height: 44px;
  background: linear-gradient(135deg, #0057FF 0%, #2D7BFF 100%);
  color: #FFFFFF;
  border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 19px; letter-spacing: -.5px;
  font-family: 'SF Pro Display', -apple-system, system-ui, sans-serif;
  box-shadow: 0 2px 6px rgba(0,87,255,.32);
}
.ld-brand-title {
  font-size: 14px; font-weight: 700; letter-spacing: -.1px; color: #1C1C1E;
  line-height: 1.2;
}
.ld-brand-sub {
  font-size: 11px; color: rgba(60,60,67,.62);
  line-height: 1.3;
}
.ld-header-meta {
  grid-column: 2; grid-row: 1;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
.ld-devis-no {
  font-size: 11px; font-weight: 700;
  letter-spacing: .03em;
  color: #0057FF;
}
.ld-devis-date {
  font-size: 11px; color: rgba(60,60,67,.6);
  margin-top: 2px;
}
.ld-close {
  position: absolute;
  top: 12px; right: 14px;
  width: 30px; height: 30px;
  border: 0; background: rgba(120,120,128,.16);
  border-radius: 50%;
  color: rgba(60,60,67,.72);
  font-size: 18px; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: transform 80ms ease, background-color .15s;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}
.ld-close:hover { background: rgba(120,120,128,.24); }
.ld-close:active { transform: scale(.92); }

/* ── Body scroll ── */
.ld-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px 18px 80px;
}
.ld-section { margin-bottom: 18px; }
.ld-section-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px;
}
.ld-section-label {
  font-size: 12px; font-weight: 600;
  letter-spacing: .04em; text-transform: uppercase;
  color: rgba(60,60,67,.6);
  margin-bottom: 6px;
  padding: 0 4px;
}

/* ── Pharmacie ── */
.ld-pharma-block {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 12px 14px;
  border: 0.5px solid rgba(60,60,67,.12);
}
.ld-pharma-name {
  font-size: 16px; font-weight: 700;
  letter-spacing: -.2px; color: #1C1C1E;
}
.ld-pharma-addr {
  font-size: 13px; color: rgba(60,60,67,.7);
  margin-top: 2px;
}
.ld-pharma-contact {
  font-size: 13px; color: #1C1C1E;
  margin-top: 4px; font-weight: 500;
}
.ld-pharma-pills {
  display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;
}
.ld-pharma-pill {
  font-size: 11px; font-weight: 600;
  background: rgba(0,87,255,.08);
  color: #0057FF;
  border-radius: 6px;
  padding: 3px 7px;
  font-variant-numeric: tabular-nums;
}
.ld-pharma-empty {
  font-size: 13px; color: rgba(60,60,67,.55);
  font-style: italic; margin-bottom: 8px;
}
.ld-pharma-input {
  display: block;
  width: 100%; box-sizing: border-box;
  background: rgba(120,120,128,.08);
  border: 0; border-radius: 8px;
  padding: 10px 12px;
  font-size: 16px;
  font-family: inherit;
  color: #1C1C1E;
  margin-top: 6px;
  outline: none;
  transition: background-color .15s;
}
.ld-pharma-input:focus { background: rgba(120,120,128,.14); }

/* ── Recherche & suggestions ── */
.ld-search-wrap { position: relative; }
.ld-search-input {
  width: 100%; box-sizing: border-box;
  background: #FFFFFF;
  border: 0.5px solid rgba(60,60,67,.18);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 16px;
  font-family: inherit;
  color: #1C1C1E;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.ld-search-input:focus {
  border-color: #0057FF;
  box-shadow: 0 0 0 3px rgba(0,87,255,.16);
}
.ld-suggestions {
  position: absolute;
  top: calc(100% + 4px); left: 0; right: 0;
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,.16), 0 1px 2px rgba(0,0,0,.06);
  border: 0.5px solid rgba(60,60,67,.18);
  max-height: 320px; overflow-y: auto;
  z-index: 10;
  padding: 4px;
}
.ld-suggestion {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color .12s;
}
.ld-suggestion:hover,
.ld-suggestion--active {
  background: rgba(0,87,255,.08);
}
.ld-suggestion--empty {
  cursor: default;
  color: rgba(60,60,67,.55);
  font-size: 13px;
  font-style: italic;
}
.ld-suggestion--empty:hover { background: transparent; }
.ld-suggestion-main { flex: 1; min-width: 0; }
.ld-suggestion-name {
  font-size: 14px; font-weight: 600;
  color: #1C1C1E;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ld-suggestion-sub {
  font-size: 11px;
  color: rgba(60,60,67,.6);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.ld-suggestion-price {
  font-size: 14px; font-weight: 700;
  color: #0057FF;
  white-space: nowrap;
}
.ld-suggestion-tag {
  font-size: 10px; font-weight: 600;
  color: rgba(60,60,67,.5);
  background: rgba(120,120,128,.12);
  padding: 2px 6px; border-radius: 4px;
}

/* ── Panier (table) ── */
.ld-cart {
  background: #FFFFFF;
  border-radius: 12px;
  border: 0.5px solid rgba(60,60,67,.12);
  overflow: hidden;
}
.ld-cart-empty {
  padding: 28px 16px;
  text-align: center;
  font-size: 13px;
  color: rgba(60,60,67,.55);
}
.ld-cart-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
.ld-cart-table thead th {
  text-align: left;
  font-size: 11px; font-weight: 600;
  letter-spacing: .04em; text-transform: uppercase;
  color: rgba(60,60,67,.55);
  padding: 8px 10px;
  border-bottom: 0.5px solid rgba(60,60,67,.18);
  background: #FAFAFC;
}
.ld-cart-table tbody td {
  padding: 10px;
  border-bottom: 0.5px solid rgba(60,60,67,.08);
  font-size: 13px;
  vertical-align: middle;
}
.ld-cart-table tbody tr:last-child td { border-bottom: 0; }
.ld-th-num { text-align: right; }
.ld-th-prod { min-width: 200px; }
.ld-th-qte { width: 70px; }
.ld-th-act { width: 32px; }
.ld-td-num { text-align: right; }
.ld-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
.ld-num--ip { color: #0057FF; font-weight: 600; }
.ld-num--eco { color: #34C759; font-weight: 700; }
.ld-prod-name {
  font-weight: 600; font-size: 13px;
  color: #1C1C1E; line-height: 1.3;
}
.ld-prod-sub {
  font-size: 11px;
  color: rgba(60,60,67,.55);
  margin-top: 2px;
}
.ld-qte-input {
  width: 56px;
  background: rgba(120,120,128,.12);
  border: 0; border-radius: 7px;
  padding: 6px 8px;
  font-size: 14px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: #1C1C1E;
  text-align: center;
  outline: none;
  transition: background-color .15s;
}
.ld-qte-input:focus { background: rgba(0,87,255,.12); }
.ld-row-del {
  width: 26px; height: 26px;
  border: 0; background: transparent;
  border-radius: 50%;
  font-size: 17px; line-height: 1;
  color: rgba(60,60,67,.45);
  cursor: pointer;
  transition: background-color .15s, color .15s, transform 80ms;
  -webkit-tap-highlight-color: transparent;
  padding: 0;
}
.ld-row-del:hover { background: rgba(255,59,48,.12); color: #FF3B30; }
.ld-row-del:active { transform: scale(.9); }

/* ── Suggestion historique ── */
.ld-suggest-banner {
  background: rgba(255,176,32,.10);
  border: 0.5px solid rgba(255,176,32,.32);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.ld-suggest-text { color: #1C1C1E; flex: 1; }
.ld-suggest-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* ── Totaux ── */
.ld-totals-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr;
  gap: 10px;
}
.ld-total-cell {
  background: #FFFFFF;
  border-radius: 12px;
  border: 0.5px solid rgba(60,60,67,.12);
  padding: 12px 14px;
}
.ld-total-label {
  font-size: 11px; font-weight: 600;
  letter-spacing: .04em; text-transform: uppercase;
  color: rgba(60,60,67,.6);
}
.ld-total-value {
  font-size: 22px; font-weight: 700;
  margin-top: 4px;
  letter-spacing: -.4px;
  color: #1C1C1E;
}
.ld-total-value--ip { color: #0057FF; }
.ld-total-cell--hero {
  background: linear-gradient(135deg, rgba(52,199,89,.10), rgba(52,199,89,.04));
  border-color: rgba(52,199,89,.32);
}
.ld-total-value--eco {
  color: #34C759;
  font-size: 30px;
  letter-spacing: -.6px;
}
.ld-total-sub {
  font-size: 11px;
  color: rgba(52,199,89,.85);
  margin-top: 2px;
  font-weight: 500;
}
@media (max-width: 720px) {
  .ld-totals-grid { grid-template-columns: 1fr; }
  .ld-total-value { font-size: 18px; }
  .ld-total-value--eco { font-size: 26px; }
}

.ld-conditions {
  font-size: 10.5px;
  color: rgba(60,60,67,.5);
  text-align: center;
  padding: 12px 8px 4px;
  line-height: 1.4;
}

/* ── Archives ── */
.ld-archives {
  margin-top: 12px;
  background: #FFFFFF;
  border-radius: 12px;
  border: 0.5px solid rgba(60,60,67,.12);
  padding: 0;
  overflow: hidden;
}
.ld-archives summary {
  padding: 12px 14px;
  font-size: 13px; font-weight: 600;
  color: #1C1C1E;
  cursor: pointer;
  list-style: none;
  -webkit-tap-highlight-color: transparent;
}
.ld-archives summary::-webkit-details-marker { display: none; }
.ld-archives summary::after {
  content: '+';
  float: right;
  font-weight: 400;
  color: rgba(60,60,67,.5);
}
.ld-archives[open] summary::after { content: '−'; }
.ld-archives-list { padding: 0 14px 12px; }
.ld-archives-empty {
  font-size: 12px; color: rgba(60,60,67,.5);
  padding: 6px 0;
}
.ld-archive-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-top: 0.5px solid rgba(60,60,67,.08);
}
.ld-archive-row:first-child { border-top: 0; }
.ld-archive-no { font-size: 12px; font-weight: 700; color: #0057FF; font-variant-numeric: tabular-nums; }
.ld-archive-sub { font-size: 11px; color: rgba(60,60,67,.6); }
.ld-archive-actions { display: flex; align-items: center; gap: 8px; }
.ld-archive-eco {
  font-size: 13px; font-weight: 700; color: #34C759;
}

/* ── Liens (boutons texte) ── */
.ld-link-btn {
  background: transparent;
  border: 0;
  color: #0057FF;
  font-size: 12px; font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: background-color .12s;
}
.ld-link-btn:hover { background: rgba(0,87,255,.08); }
.ld-link-btn--small { font-size: 11px; padding: 3px 6px; }
.ld-link-btn--ghost { color: rgba(60,60,67,.6); }
.ld-link-btn--danger { color: #FF3B30; }
.ld-link-btn--danger:hover { background: rgba(255,59,48,.08); }

/* ── Footer (exports) ── */
.ld-footer {
  position: sticky; bottom: 0;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-top: 0.5px solid rgba(60,60,67,.18);
  padding: 10px 14px env(safe-area-inset-bottom, 10px);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  flex-shrink: 0;
}
.ld-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  padding: 11px 8px;
  font-size: 13px; font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: transform 80ms ease, background-color .15s;
  -webkit-tap-highlight-color: transparent;
  min-height: 40px;
}
.ld-btn:active { transform: scale(.97); }
.ld-btn--ghost {
  background: rgba(120,120,128,.14);
  color: #1C1C1E;
}
.ld-btn--ghost:hover { background: rgba(120,120,128,.22); }
.ld-btn--primary {
  background: #0057FF;
  color: #FFFFFF;
  box-shadow: 0 1px 2px rgba(0,87,255,.3);
}
.ld-btn--primary:hover { background: #1968FF; }
.ld-btn-ico {
  display: inline-flex; align-items: center;
}
.ld-btn-ico svg { display: block; }
.ld-btn-flash {
  font-size: 12px; font-weight: 700;
}

@media (max-width: 480px) {
  .ld-btn { font-size: 12px; padding: 10px 4px; }
  .ld-btn-ico svg { width: 14px; height: 14px; }
}

/* ── Print ── */
@media print {
  body.ld-printing > *:not(.ld-overlay) { display: none !important; }
  body.ld-printing .ld-overlay {
    position: static !important;
    background: #FFFFFF !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    padding: 0 !important;
  }
  body.ld-printing .ld-card {
    transform: none !important;
    box-shadow: none !important;
    max-height: none !important;
    height: auto !important;
    width: 100% !important;
    max-width: none !important;
    border-radius: 0 !important;
    background: #FFFFFF !important;
  }
  body.ld-printing .ld-close,
  body.ld-printing .ld-footer,
  body.ld-printing .ld-section--search,
  body.ld-printing .ld-archives,
  body.ld-printing .ld-link-btn,
  body.ld-printing .ld-row-del,
  body.ld-printing .ld-suggest-banner { display: none !important; }
  body.ld-printing .ld-body { padding: 0 24px; overflow: visible !important; }
  body.ld-printing .ld-qte-input {
    background: transparent !important;
    border: 0 !important;
    -webkit-appearance: none;
    appearance: none;
    width: 40px;
  }
}
`;
  const tag = document.createElement('style');
  tag.id = 'lens-devis-styles';
  tag.textContent = css;
  document.head.appendChild(tag);
}
