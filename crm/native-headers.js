/* ══════════════════════════════════════════════════════════════════════════
   native-headers.js — Pattern Large Title iOS pour CRM Intégral Pharma
   ──────────────────────────────────────────────────────────────────────────
   - Injecte .large-title-block AVANT le contenu rendu de chaque page.
   - N'altère AUCUN render existant : on agit en frère, pas en parent.
   - Wrap window.navigate pour ré-injecter à chaque changement de page.
   - Wrap window.renderDashboard et autres render functions pour ré-injecter
     après chaque re-render (les renderXxxV2 vident #X-content).
   - IntersectionObserver sur .large-title-block de la page ACTIVE :
     quand il sort du viewport top, on ajoute body.is-compact-header.
   ══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ════════════ N'agit qu'en mode classique ════════════
  function isClassic() {
    return document.documentElement.dataset.mode !== 'jarvis';
  }

  // ════════════ Mapping pageId → label/sub/eyebrow ════════════
  // Le sub est résolu à chaque call (compteurs dynamiques).
  const PAGE_META = {
    dashboard: {
      label: 'Pilotage',
      eyebrow: 'Performance commerciale',
      sub: () => {
        const c = (window.CLIENTS || []);
        const actifs = c.filter(p => (p.ca2023 || 0) > 0).length;
        const totalCa = c.reduce((s, p) => s + (p.ca2023 || 0), 0);
        if (!actifs) return 'Vue d\'ensemble du portefeuille';
        const m = (totalCa / 1_000_000).toFixed(1);
        return `${m} M€ cumulés · ${actifs} pharmacies actives`;
      },
      containerId: 'dash-content',
      compactTitle: 'Pilotage',
    },
    pharmacies: {
      label: 'Pharmacies',
      eyebrow: 'Secteur Grand Ouest',
      sub: () => {
        const n = (window.CLIENTS || []).length;
        return n ? `${n.toLocaleString('fr-FR')} sur 8 départements` : '8 départements suivis';
      },
      containerId: 'pharma-content',
      compactTitle: 'Pharmacies',
    },
    produits: {
      label: 'Produits',
      eyebrow: 'Portefeuille',
      sub: () => {
        const n = Object.keys(window.SALES_BY_PRODUCT || {}).length;
        return n ? `${n.toLocaleString('fr-FR')} références analysées` : 'Analyse portefeuille';
      },
      containerId: 'prod-content',
      compactTitle: 'Produits',
    },
    catalogue: {
      label: 'Catalogue IP',
      eyebrow: 'Données',
      sub: () => {
        const n = (window.CATALOGUE_IP || []).length;
        return n ? `${n.toLocaleString('fr-FR')} produits référencés` : 'TOP IP décroissant';
      },
      containerId: 'cat-content',
      compactTitle: 'Catalogue IP',
    },
    benchmark: {
      label: 'Analyses',
      eyebrow: 'Comparatif',
      sub: () => 'Mon secteur vs OPS Nantes',
      containerId: 'bench-content',
      compactTitle: 'Analyses',
    },
    simulateur: {
      label: 'Simulateur',
      eyebrow: 'Gain switch',
      sub: () => 'Compare ton panier vs IP',
      containerId: 'simul-content',
      compactTitle: 'Simulateur',
    },
    offilog: {
      label: 'Parapharmacie',
      eyebrow: 'Offilog',
      sub: () => {
        const n = (window.OFFILOG || []).length;
        return n ? `Offilog · ${n.toLocaleString('fr-FR')} références prix marché` : 'Offilog · prix marché';
      },
      containerId: 'offilog-content',
      compactTitle: 'Parapharmacie',
    },
    groupements: {
      label: 'Adhérents',
      eyebrow: 'Groupements',
      sub: () => 'Suivi groupements',
      containerId: 'groupements-content',
      compactTitle: 'Adhérents',
    },
    admin: {
      label: 'Réglages',
      eyebrow: 'Système',
      sub: () => 'Administration',
      containerId: 'admin-content',
      compactTitle: 'Réglages',
    },
    objectifs: {
      label: 'Objectifs',
      eyebrow: 'Pilotage commercial',
      sub: () => 'Objectifs commerciaux',
      containerId: 'objectifs-content',
      compactTitle: 'Objectifs',
    },
    import: {
      label: 'Import',
      eyebrow: 'Données',
      sub: () => 'Importer un fichier Excel',
      containerId: 'import-content',
      compactTitle: 'Import',
    },
  };

  // ════════════ État global ════════════
  let _io = null;
  let _observedEl = null;
  let _injectionLock = false; // anti-récursion pour le wrap renderXxx

  // ════════════ Construction du DOM large-title ════════════
  function buildLargeTitleHTML(meta, currentSub) {
    // Note : on encode les chaînes côté JS (textContent) plutôt que template
    // pour éviter toute injection HTML depuis des compteurs dynamiques.
    return ''; // placeholder, on construit en DOM ci-dessous
  }

  function buildLargeTitleNode(meta) {
    const block = document.createElement('div');
    block.className = 'large-title-block';
    block.setAttribute('data-lt-block', 'true');
    block.setAttribute('data-lt-hide-next', 'true'); // hint CSS fallback :has

    const row = document.createElement('div');
    row.className = 'large-title-row';

    const textCol = document.createElement('div');
    textCol.style.minWidth = '0';
    textCol.style.flex = '1';

    if (meta.eyebrow) {
      const eyebrow = document.createElement('div');
      eyebrow.className = 'large-title-eyebrow';
      eyebrow.textContent = meta.eyebrow;
      textCol.appendChild(eyebrow);
    }

    const h1 = document.createElement('h1');
    h1.className = 'large-title';
    h1.textContent = meta.label;
    textCol.appendChild(h1);

    const sub = document.createElement('div');
    sub.className = 'large-title-subtitle';
    try {
      sub.textContent = typeof meta.sub === 'function' ? meta.sub() : (meta.sub || '');
    } catch (e) {
      sub.textContent = '';
    }
    textCol.appendChild(sub);

    row.appendChild(textCol);
    block.appendChild(row);
    return block;
  }

  // ════════════ Injection dans le container de page ════════════
  function injectInto(containerId, meta) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    // Supprime tout large-title-block déjà présent dans CE container
    const existing = container.querySelector(':scope > .large-title-block');
    if (existing) existing.remove();

    const node = buildLargeTitleNode(meta);
    container.insertBefore(node, container.firstChild);
    return node;
  }

  // ════════════ Update topbar compact title + document.title ════════════
  function updateTopbar(meta) {
    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle) topbarTitle.textContent = meta.compactTitle || meta.label;
    document.title = `Intégral Pharma · ${meta.label}`;
  }

  // ════════════ IntersectionObserver (shrink behavior) ════════════
  function setupObserver(targetEl) {
    // Nettoyage de l'ancien observer
    if (_io) {
      try { _io.disconnect(); } catch (e) {}
      _io = null;
      _observedEl = null;
    }
    if (!targetEl) return;

    // Quand le block large-title sort (ou est presque sorti) du viewport top
    // → on bascule en mode compact. Sinon → mode repos.
    // rootMargin top négatif : déclenche AVANT que le titre disparaisse complètement.
    const scrollRoot = targetEl.closest('.page-content') || null;

    _io = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      // intersectionRatio < 0.4 → en grande partie sorti → compact
      if (e.intersectionRatio < 0.4) {
        document.body.classList.add('is-compact-header');
      } else {
        document.body.classList.remove('is-compact-header');
      }
    }, {
      root: scrollRoot,
      // Le titre disparaît dès qu'il croise la zone topbar (~52px)
      rootMargin: '-44px 0px 0px 0px',
      threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
    });

    _io.observe(targetEl);
    _observedEl = targetEl;
  }

  // ════════════ Fallback scroll listener (si IO indispo / fail) ════════════
  function setupScrollFallback() {
    const root = document.querySelector('.page-content');
    if (!root) return;
    let raf = null;
    root.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        if (root.scrollTop > 80) {
          document.body.classList.add('is-compact-header');
        } else {
          document.body.classList.remove('is-compact-header');
        }
      });
    }, { passive: true });
  }

  // ════════════ Apply pour la page active ════════════
  function applyForPage(pageId) {
    if (!isClassic()) {
      document.body.classList.remove('is-compact-header');
      return;
    }
    const meta = PAGE_META[pageId];
    if (!meta) {
      // Page inconnue : on retire le mode compact pour éviter état pollué.
      document.body.classList.remove('is-compact-header');
      return;
    }

    _injectionLock = true;
    try {
      const node = injectInto(meta.containerId, meta);
      updateTopbar(meta);
      // Reset scroll de la page active vers le haut pour réafficher le large title
      const pc = document.querySelector('.page-content');
      // On NE force PAS le scroll-to-top : Will pourrait revenir sur une page
      // au milieu — on laisse l'état natif. Mais on resynchronise la classe.
      document.body.classList.remove('is-compact-header');
      if (node) setupObserver(node);
    } finally {
      _injectionLock = false;
    }
  }

  // ════════════ Wrap window.navigate ════════════
  function wrapNavigate() {
    const orig = window.navigate;
    if (typeof orig !== 'function' || orig.__ltWrapped) return;
    const wrapped = function (page) {
      const ret = orig.apply(this, arguments);
      // Après le render natif, on injecte. setTimeout 0 pour laisser le DOM se poser.
      setTimeout(() => applyForPage(page), 0);
      return ret;
    };
    wrapped.__ltWrapped = true;
    window.navigate = wrapped;
  }

  // ════════════ Wrap des render* (re-render sans changer de page) ════════════
  // Les render functions vident leur container — il faut ré-injecter ensuite.
  function wrapRenderers() {
    const names = [
      'renderDashboard', 'renderPharmacies', 'renderProduits', 'renderAdmin',
      'renderCatalogue', 'renderBenchmark', 'renderSimulator', 'renderOffilog',
      'renderGroupements', 'renderObjectifs',
    ];
    // Mapping render → pageId
    const map = {
      renderDashboard: 'dashboard',
      renderPharmacies: 'pharmacies',
      renderProduits: 'produits',
      renderAdmin: 'admin',
      renderCatalogue: 'catalogue',
      renderBenchmark: 'benchmark',
      renderSimulator: 'simulateur',
      renderOffilog: 'offilog',
      renderGroupements: 'groupements',
      renderObjectifs: 'objectifs',
    };
    names.forEach((name) => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__ltWrapped) return;
      const pageId = map[name];
      const wrapped = function () {
        const ret = orig.apply(this, arguments);
        if (_injectionLock) return ret; // évite récursion
        setTimeout(() => applyForPage(pageId), 0);
        return ret;
      };
      wrapped.__ltWrapped = true;
      window[name] = wrapped;
    });
  }

  // ════════════ Init ════════════
  function init() {
    if (!isClassic()) return;

    // Wrap navigate (peut ne pas exister encore au DOMContentLoaded car app.js defer)
    // → on tente plusieurs fois en cas de course. On n'injecte le large-title
    // QU'UNE SEULE FOIS, dès que navigate ET renderDashboard sont disponibles,
    // pour éviter un flicker (re-render répété pendant 3.6 s) sur la page active.
    let tries = 0;
    let appliedOnce = false;
    const tryWrap = () => {
      tries++;
      const hasNav = typeof window.navigate === 'function';
      const hasRender = typeof window.renderDashboard === 'function';
      if (hasNav) wrapNavigate();
      if (hasRender) wrapRenderers();

      if (hasNav && hasRender && !appliedOnce) {
        // Tout est prêt → on injecte une seule fois pour la page courante.
        const activePage = document.querySelector('.page.active');
        const pageId = activePage ? activePage.id.replace(/^page-/, '') : 'dashboard';
        applyForPage(pageId);
        appliedOnce = true;
        return;
      }

      if (tries < 30) {
        setTimeout(tryWrap, 120);
      } else if (!appliedOnce) {
        // Safety net : timeout atteint sans nav/render — injecte quand même.
        const activePage = document.querySelector('.page.active');
        const pageId = activePage ? activePage.id.replace(/^page-/, '') : 'dashboard';
        applyForPage(pageId);
        appliedOnce = true;
      }
    };
    tryWrap();

    // Fallback scroll : sécurité si IntersectionObserver inactif (Safari < 12.1)
    if (!('IntersectionObserver' in window)) {
      setupScrollFallback();
    }

    // Re-apply quand la fenêtre revient au focus (sécurité contre désync)
    window.addEventListener('focus', () => {
      const activePage = document.querySelector('.page.active');
      if (!activePage) return;
      const pageId = activePage.id.replace(/^page-/, '');
      // Vérifie qu'un large-title est bien présent ; sinon réinjecte.
      const meta = PAGE_META[pageId];
      if (!meta) return;
      const container = document.getElementById(meta.containerId);
      if (container && !container.querySelector(':scope > .large-title-block')) {
        applyForPage(pageId);
      }
    });

    // Re-apply si on toggle le mode (au cas où index passe en classic depuis jarvis)
    const modeObserver = new MutationObserver(() => {
      if (isClassic()) {
        const activePage = document.querySelector('.page.active');
        const pageId = activePage ? activePage.id.replace(/^page-/, '') : 'dashboard';
        applyForPage(pageId);
      } else {
        document.body.classList.remove('is-compact-header');
      }
    });
    modeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
