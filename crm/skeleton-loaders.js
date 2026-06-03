/* ============================================================
   SKELETON LOADERS — Intégral Pharma CRM
   IIFE qui injecte skeletons sur navigate() + splash boot.
   Mode classique uniquement. Aucune dépendance externe.
   ============================================================ */
(function () {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────
  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls)  node.className = cls;
    if (html) node.innerHTML = html;
    return node;
  }

  function wrap(cls) {
    var w = document.createElement('div');
    w.className = 'skel-wrap ' + (cls || '');
    w.setAttribute('data-skel', '1');
    return w;
  }

  // ── Pattern : LISTE ─────────────────────────────────────
  function mountListSkeleton(container, nRows) {
    if (!container) return;
    nRows = nRows || 6;
    container.innerHTML = '';
    var root = wrap('skel-list');
    for (var i = 0; i < nRows; i++) {
      root.appendChild(el('div', 'skel-row',
        '<span class="skeleton skeleton-circle"></span>' +
        '<div class="skel-row-text">' +
          '<span class="skeleton skeleton-text--lg" style="width:' + (140 + Math.round(Math.random() * 80)) + 'px"></span>' +
          '<span class="skeleton skeleton-text" style="width:' + (60 + Math.round(Math.random() * 60)) + 'px"></span>' +
        '</div>' +
        '<span class="skeleton skeleton-text" style="width:60px"></span>'
      ));
    }
    container.appendChild(root);
  }

  // ── Pattern : DASHBOARD ─────────────────────────────────
  function mountDashboardSkeleton(container) {
    if (!container) return;
    container.innerHTML = '';
    var root = wrap('skel-dashboard');

    // Hero KPI
    root.appendChild(el('div', 'skel-hero',
      '<span class="skeleton skeleton-text"></span>' +
      '<span class="skeleton skeleton-text--xl"></span>' +
      '<span class="skeleton skeleton-text" style="width:120px"></span>'
    ));

    // 3 mini KPIs
    var row = el('div', 'skel-kpi-row');
    for (var i = 0; i < 3; i++) {
      row.appendChild(el('div', 'skel-kpi-card',
        '<span class="skeleton skeleton-text" style="width:70px"></span>' +
        '<span class="skeleton skeleton-text--lg" style="width:100px"></span>' +
        '<span class="skeleton skeleton-text" style="width:50px"></span>'
      ));
    }
    root.appendChild(row);

    // Top ligne (top pharmacies/produits)
    root.appendChild(el('div', 'skel-card',
      '<span class="skeleton skeleton-text--lg" style="width:140px"></span>' +
      '<span class="skeleton skeleton-line"></span>' +
      '<span class="skeleton skeleton-line" style="width:80%"></span>' +
      '<span class="skeleton skeleton-line" style="width:65%"></span>'
    ));

    // Chart placeholder
    root.appendChild(el('div', 'skel-chart',
      '<span class="skeleton skeleton-text--lg" style="width:180px"></span>' +
      '<span class="skeleton skeleton-block--tall"></span>'
    ));

    container.appendChild(root);
  }

  // ── Pattern : TABLE ─────────────────────────────────────
  function mountTableSkeleton(container, nRows, nCols) {
    if (!container) return;
    nRows = nRows || 8;
    nCols = nCols || 5;
    container.innerHTML = '';
    var root = wrap('skel-table');
    var gridTpl = 'repeat(' + nCols + ', 1fr)';

    // header row
    var head = el('div', 'skel-tr');
    head.style.gridTemplateColumns = gridTpl;
    for (var c = 0; c < nCols; c++) {
      head.appendChild(el('span', 'skeleton skeleton-text', ''));
    }
    root.appendChild(head);

    // body rows
    for (var r = 0; r < nRows; r++) {
      var tr = el('div', 'skel-tr');
      tr.style.gridTemplateColumns = gridTpl;
      for (var cc = 0; cc < nCols; cc++) {
        tr.appendChild(el('span', 'skeleton skeleton-line', ''));
      }
      root.appendChild(tr);
    }
    container.appendChild(root);
  }

  // ── Pattern : CARD simple ───────────────────────────────
  function mountCardSkeleton(container) {
    if (!container) return;
    container.innerHTML = '';
    var root = wrap('');
    root.appendChild(el('div', 'skel-card',
      '<span class="skeleton skeleton-text--lg"></span>' +
      '<span class="skeleton skeleton-line"></span>' +
      '<span class="skeleton skeleton-line" style="width:85%"></span>' +
      '<span class="skeleton skeleton-line" style="width:60%"></span>' +
      '<span class="skeleton skeleton-block"></span>'
    ));
    container.appendChild(root);
  }

  // ── Pattern : BENCHMARK ─────────────────────────────────
  function mountBenchmarkSkeleton(container) {
    if (!container) return;
    container.innerHTML = '';
    var root = wrap('skel-bench');

    // Header KPI bench
    var header = el('div', 'skel-bench-header');
    header.appendChild(el('span', 'skeleton skeleton-text--xl', ''));
    var kpis = el('div', 'skel-bench-kpis');
    for (var i = 0; i < 4; i++) {
      kpis.appendChild(el('div', 'skel-kpi-card',
        '<span class="skeleton skeleton-text" style="width:60px"></span>' +
        '<span class="skeleton skeleton-text--lg" style="width:80px"></span>'
      ));
    }
    header.appendChild(kpis);
    root.appendChild(header);

    // 6 sections famille
    for (var s = 0; s < 6; s++) {
      var section = el('div', 'skel-bench-section');
      section.appendChild(el('span', 'skeleton skeleton-text--lg', ''));
      section.appendChild(el('span', 'skeleton skeleton-line', ''));
      section.appendChild(el('span', 'skeleton skeleton-line', ''));
      section.appendChild(el('span', 'skeleton skeleton-line', ''));
      var pills = el('div', '');
      pills.style.display = 'flex';
      pills.style.gap = '8px';
      pills.style.flexWrap = 'wrap';
      for (var p = 0; p < 4; p++) {
        pills.appendChild(el('span', 'skeleton skeleton-pill', ''));
      }
      section.appendChild(pills);
      root.appendChild(section);
    }
    container.appendChild(root);
  }

  // ── Clear (fade-out) ────────────────────────────────────
  function clearSkeleton(container, transitionMs) {
    if (!container) return;
    transitionMs = (typeof transitionMs === 'number') ? transitionMs : 200;
    var wraps = container.querySelectorAll('.skel-wrap');
    if (!wraps.length) return;
    wraps.forEach(function (w) {
      w.classList.add('skel-wrap--out');
    });
    setTimeout(function () {
      wraps.forEach(function (w) { if (w.parentNode) w.parentNode.removeChild(w); });
    }, transitionMs + 20);
  }

  // ── API publique ────────────────────────────────────────
  window.mountListSkeleton      = mountListSkeleton;
  window.mountDashboardSkeleton = mountDashboardSkeleton;
  window.mountTableSkeleton     = mountTableSkeleton;
  window.mountCardSkeleton      = mountCardSkeleton;
  window.mountBenchmarkSkeleton = mountBenchmarkSkeleton;
  window.clearSkeleton          = clearSkeleton;

  // ── Page → (containerId, mountFn) ───────────────────────
  var PAGE_MAP = {
    dashboard:   { id: 'dash-content',        mount: mountDashboardSkeleton },
    pharmacies:  { id: 'pharma-content',      mount: mountListSkeleton      },
    produits:    { id: 'prod-content',        mount: mountCardSkeleton      },
    import:      { id: 'import-content',      mount: mountCardSkeleton      },
    admin:       { id: 'admin-content',       mount: mountCardSkeleton      },
    catalogue:   { id: 'cat-content',         mount: mountTableSkeleton     },
    benchmark:   { id: 'bench-content',       mount: mountBenchmarkSkeleton },
    simulateur:  { id: 'simul-content',       mount: mountCardSkeleton      },
    offilog:     { id: 'offilog-content',     mount: mountTableSkeleton     },
    groupements: { id: 'groupements-content', mount: mountListSkeleton      },
    objectifs:   { id: 'objectifs-content',   mount: mountCardSkeleton      },
    marketing:   { id: 'marketing-content',   mount: mountCardSkeleton      }
  };

  // True si le conteneur ne contient QUE des skeletons (ou est vide).
  function containerIsEmpty(c) {
    if (!c) return false;
    if (!c.firstElementChild) return true;
    // S'il ne contient que des wrappers skeleton, considéré comme vide
    var kids = c.children;
    for (var i = 0; i < kids.length; i++) {
      if (!kids[i].classList || !kids[i].classList.contains('skel-wrap')) return false;
    }
    return true;
  }

  // ── Hook navigate() ────────────────────────────────────
  // On wrap dans un setTimeout pour laisser perf-boot / classic-overrides
  // / native-shell / native-headers installer leurs propres patches d'abord.
  function installNavigateHook() {
    if (typeof window.navigate !== 'function') return false;
    if (window.__skeletonNavWrapped) return true;
    var prev = window.navigate;

    window.navigate = function (page) {
      try {
        var entry = PAGE_MAP[page];
        if (entry) {
          var c = document.getElementById(entry.id);
          if (c && containerIsEmpty(c)) {
            entry.mount(c);
          }
        }
      } catch (e) {
        // Ne jamais bloquer la navigation pour une erreur de skeleton
        if (window.console && console.warn) console.warn('[skeleton] mount failed', e);
      }
      return prev.apply(this, arguments);
    };
    window.__skeletonNavWrapped = true;
    return true;
  }

  // Tente d'installer le hook plusieurs fois (les autres patches arrivent)
  function tryInstallHook() {
    if (installNavigateHook()) return;
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (installNavigateHook() || attempts > 50) clearInterval(iv);
    }, 100);
  }

  // ── Splash boot ────────────────────────────────────────
  function mountSplash() {
    if (document.getElementById('app-splash')) return;
    var s = el('div', 'app-splash',
      '<div class="app-splash-logo">IP</div>' +
      '<div class="app-splash-spinner"></div>' +
      '<div class="app-splash-caption">Chargement des données…</div>'
    );
    s.id = 'app-splash';
    // Insertion à la racine du body
    (document.body || document.documentElement).appendChild(s);
  }

  function dismissSplash() {
    var s = document.getElementById('app-splash');
    if (!s) return;
    if (s.classList.contains('app-splash--dismiss')) return;
    s.classList.add('app-splash--dismiss');
    setTimeout(function () {
      if (s.parentNode) s.parentNode.removeChild(s);
    }, 300);
  }

  window.dismissSplash = dismissSplash;

  function dataReady() {
    // Heuristique : au moins une des grosses tables est prête
    return !!(window.SALES_TOTAL || window.CLIENTS || window.BENCHMARK || window.OFFILOG);
  }

  function bootWatch() {
    if (dataReady()) {
      dismissSplash();
      return;
    }
    mountSplash();
    var checks = 0;
    var iv = setInterval(function () {
      checks++;
      if (dataReady()) {
        clearInterval(iv);
        // Laisse 100ms pour que le premier render finisse de monter le DOM
        setTimeout(dismissSplash, 100);
      } else if (checks > 80) {
        // Safety net : 8s max
        clearInterval(iv);
        dismissSplash();
      }
    }, 100);
  }

  // ── Init ───────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bootWatch();
      tryInstallHook();
    });
  } else {
    bootWatch();
    tryInstallHook();
  }
})();
