/* ═══════════════════════════════════════════════════════════════════
   APPLE CMDK — Command palette ⌘K
   Style Raycast/Linear, vanilla JS, zéro dépendance.
   API : window.appleOpenCmdk(), appleCloseCmdk(), appleRefreshCmdkIndex()
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── État interne ─────────────────────────────────────────────────
  var state = {
    open: false,
    query: '',
    items: [],          // index complet
    results: [],        // résultats filtrés (groupés)
    selected: 0,        // index du résultat sélectionné (flat)
    debounceT: null,
    lastFocus: null
  };

  var MAX_PER_GROUP = 8;
  var DEBOUNCE_MS = 60;

  // ─── Build index ──────────────────────────────────────────────────
  function buildIndex() {
    var items = [];

    // 1) Navigation
    var navPages = [
      { id: 'nav:marketing',   label: 'Marketing',    sub: 'Fiches commerciales', group: 'Pages',   action: function () { goPage('marketing'); } },
      { id: 'nav:dashboard',   label: 'Pilotage',     sub: 'Dashboard',           group: 'Pages',   action: function () { goPage('dashboard'); } },
      { id: 'nav:pharmacies',  label: 'Pharmacies',   sub: 'Portefeuille',        group: 'Pages',   action: function () { goPage('pharmacies'); } },
      { id: 'nav:produits',    label: 'Produits',     sub: 'Catalogue IP',        group: 'Pages',   action: function () { goPage('produits'); } },
      { id: 'nav:catalogue',   label: 'Catalogue',    sub: 'Catalogue marketing', group: 'Pages',   action: function () { goPage('catalogue'); } },
      { id: 'nav:benchmark',   label: 'Benchmark',    sub: 'Performance produits',group: 'Pages',   action: function () { goPage('benchmark'); } },
      { id: 'nav:simulateur',  label: 'Simulateur',   sub: 'Devis pharmacie',     group: 'Pages',   action: function () { goPage('simulateur'); } },
      { id: 'nav:offilog',     label: 'Offilog',      sub: 'Veille concurrentielle', group: 'Pages', action: function () { goPage('offilog'); } },
      { id: 'nav:groupements', label: 'Groupements',  sub: 'Réseaux pharmacies',  group: 'Pages',   action: function () { goPage('groupements'); } }
    ];
    items.push.apply(items, navPages);

    // 2) Pharmacies (depuis state.pharmacies)
    try {
      var pharmas = (window.state && window.state.pharmacies) || window.CLIENTS || [];
      for (var i = 0; i < pharmas.length; i++) {
        var p = pharmas[i];
        if (!p) continue;
        var pid = p.id;
        var pname = p.name || p.nom || '';
        var pcity = p.ville || p.city || p.cp || '';
        if (!pname) continue;
        items.push({
          id: 'pharma:' + pid,
          label: pname,
          sub: pcity || 'Pharmacie',
          group: 'Pharmacies',
          inspectable: true,
          action: function (pid) {
            return function () {
              if (typeof window.showPharmaDetail === 'function') {
                window.showPharmaDetail(pid);
              } else {
                goPage('pharmacies');
              }
            };
          }(pid)
        });
      }
    } catch (e) {}

    // 3) Produits IP — top 200 par ip_rank_qty
    try {
      var bench = window.BENCHMARK || [];
      if (bench.length) {
        var top = bench
          .filter(function (b) { return b && b.designation; })
          .slice()
          .sort(function (a, b) {
            var ra = a.ip_rank_qty || 99999;
            var rb = b.ip_rank_qty || 99999;
            return ra - rb;
          })
          .slice(0, 200);
        for (var j = 0; j < top.length; j++) {
          var prod = top[j];
          items.push({
            id: 'prod:' + (prod.cip13 || j),
            label: prod.designation,
            sub: (prod.categorie || 'Produit IP') + (prod.cip13 ? ' · ' + prod.cip13 : ''),
            group: 'Produits IP',
            action: function (cip, designation) {
              return function () {
                goPage('produits');
                // Stub : sera amélioré quand un highlight produit existera
                try { window.__appleCmdkProductPick = { cip: cip, designation: designation }; } catch (e) {}
              };
            }(prod.cip13, prod.designation)
          });
        }
      }
    } catch (e) {}

    // 4) Actions
    var actions = [
      {
        id: 'act:new-fiche',
        label: 'Nouvelle fiche commerciale',
        sub: 'Marketing · fiche vide',
        group: 'Actions',
        action: function () {
          goPage('marketing');
          setTimeout(function () {
            if (typeof window.mkStartBlank === 'function') window.mkStartBlank();
          }, 280);
        }
      },
      {
        id: 'act:toggle-dark',
        label: 'Activer / désactiver le mode sombre',
        sub: 'Thème de l\'interface',
        group: 'Actions',
        action: function () {
          var root = document.documentElement;
          var current = root.dataset.theme;
          if (current === 'dark') {
            root.dataset.theme = 'light';
            try { localStorage.setItem('a-theme', 'light'); } catch (e) {}
          } else {
            root.dataset.theme = 'dark';
            try { localStorage.setItem('a-theme', 'dark'); } catch (e) {}
          }
        }
      },
      {
        id: 'act:cycle-density',
        label: 'Changer la densité d\'affichage',
        sub: 'Compact / Cozy / Spacious',
        group: 'Actions',
        action: function () {
          if (typeof window.appleCycleDensity === 'function') window.appleCycleDensity();
        }
      }
    ];

    // Action contextuelle : PDF fiche pharma (seulement si on est sur une fiche)
    if (window.__currentPharmaId) {
      actions.push({
        id: 'act:pdf-pharma',
        label: 'Télécharger le PDF de la fiche pharmacie',
        sub: 'Listing Best + À travailler',
        group: 'Actions',
        action: function () {
          if (typeof window.exportPharmaListingPDF === 'function') {
            window.exportPharmaListingPDF(window.__currentPharmaId);
          }
        }
      });
    }

    items.push.apply(items, actions);

    state.items = items;
  }

  function goPage(p) {
    if (typeof window.navigate === 'function') {
      window.navigate(p);
    } else {
      try { location.hash = '#' + p; } catch (e) {}
    }
  }

  // ─── Fuzzy match ──────────────────────────────────────────────────
  function score(item, q) {
    if (!q) return 1;
    var label = (item.label || '').toLowerCase();
    var sub = (item.sub || '').toLowerCase();
    var hay = label + ' ' + sub;
    if (hay.indexOf(q) === -1) return 0;
    var s = 1;
    if (label.indexOf(q) !== -1) s += 4;
    if (label.indexOf(q) === 0) s += 6;
    if (label.split(' ').some(function (w) { return w.indexOf(q) === 0; })) s += 2;
    if (label === q) s += 10;
    // Bonus exact word boundary
    return s;
  }

  function filter(q) {
    q = (q || '').toLowerCase().trim();
    var groups = {};
    var order = ['Actions', 'Pages', 'Pharmacies', 'Produits IP'];
    if (!q) {
      // Affichage par défaut : actions + pages + premières pharmas
      for (var i = 0; i < state.items.length; i++) {
        var it = state.items[i];
        if (!groups[it.group]) groups[it.group] = [];
        if (groups[it.group].length < MAX_PER_GROUP) groups[it.group].push({ item: it, s: 1 });
      }
    } else {
      for (var k = 0; k < state.items.length; k++) {
        var it2 = state.items[k];
        var sc = score(it2, q);
        if (sc <= 0) continue;
        if (!groups[it2.group]) groups[it2.group] = [];
        groups[it2.group].push({ item: it2, s: sc });
      }
      // Sort par score décroissant
      Object.keys(groups).forEach(function (g) {
        groups[g].sort(function (a, b) { return b.s - a.s; });
      });
    }

    var out = [];
    order.forEach(function (g) {
      if (!groups[g] || !groups[g].length) return;
      var total = groups[g].length;
      var shown = groups[g].slice(0, MAX_PER_GROUP).map(function (x) { return x.item; });
      out.push({ group: g, items: shown, remaining: Math.max(0, total - shown.length) });
    });

    state.results = out;
    state.selected = 0;
  }

  // ─── DOM ─────────────────────────────────────────────────────────
  function ensureDom() {
    if (document.getElementById('a-cmdk')) return document.getElementById('a-cmdk');
    var html = ''
      + '<div class="a-cmdk-backdrop" id="a-cmdk" data-open="false" role="dialog" aria-modal="true" aria-label="Palette de commandes">'
      +   '<div class="a-cmdk" role="combobox" aria-haspopup="listbox" aria-expanded="true">'
      +     '<div class="a-cmdk-search">'
      +       '<svg class="a-cmdk-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
      +         '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>'
      +         '<path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      +       '</svg>'
      +       '<input id="a-cmdk-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" '
      +              'placeholder="Rechercher pharmacie, produit, page…" aria-label="Recherche" aria-autocomplete="list" aria-controls="a-cmdk-results" />'
      +       '<kbd class="a-cmdk-kbd">Esc</kbd>'
      +     '</div>'
      +     '<div class="a-cmdk-results" id="a-cmdk-results" role="listbox"></div>'
      +     '<div class="a-cmdk-footer">'
      +       '<span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>'
      +       '<span><kbd>↵</kbd> ouvrir</span>'
      +       '<span><kbd>⌘</kbd><kbd>↵</kbd> inspector</span>'
      +       '<span><kbd>Esc</kbd> fermer</span>'
      +     '</div>'
      +   '</div>'
      + '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);

    var root = document.getElementById('a-cmdk');
    var input = document.getElementById('a-cmdk-input');

    root.addEventListener('click', function (e) {
      if (e.target === root) close();
    });
    input.addEventListener('input', function (e) {
      var v = e.target.value;
      clearTimeout(state.debounceT);
      state.debounceT = setTimeout(function () {
        state.query = v;
        filter(v);
        render();
      }, DEBOUNCE_MS);
    });
    input.addEventListener('keydown', onKeydown);
    return root;
  }

  function flatItems() {
    var flat = [];
    state.results.forEach(function (g) {
      g.items.forEach(function (it) { flat.push(it); });
    });
    return flat;
  }

  function onKeydown(e) {
    var flat = flatItems();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!flat.length) return;
      state.selected = (state.selected + 1) % flat.length;
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flat.length) return;
      state.selected = (state.selected - 1 + flat.length) % flat.length;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!flat.length) return;
      var it = flat[state.selected];
      if (!it) return;
      var inspectorMode = e.metaKey || e.ctrlKey;
      close();
      try {
        if (inspectorMode && it.inspectable && typeof window.openInspector === 'function') {
          window.openInspector(it);
        } else {
          it.action();
        }
      } catch (err) { console.error('[cmdk] action error', err); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlight(label, q) {
    if (!q) return escapeHtml(label);
    var lower = label.toLowerCase();
    var idx = lower.indexOf(q.toLowerCase());
    if (idx < 0) return escapeHtml(label);
    return escapeHtml(label.slice(0, idx))
      + '<mark>' + escapeHtml(label.slice(idx, idx + q.length)) + '</mark>'
      + escapeHtml(label.slice(idx + q.length));
  }

  function render() {
    var box = document.getElementById('a-cmdk-results');
    if (!box) return;
    if (!state.results.length) {
      box.innerHTML = '<div class="a-cmdk-empty">Aucun résultat</div>';
      return;
    }
    var q = (state.query || '').trim();
    var flatIdx = 0;
    var html = state.results.map(function (g) {
      var rowsHtml = g.items.map(function (it) {
        var idx = flatIdx++;
        var sel = idx === state.selected;
        var icon = iconFor(g.group);
        return ''
          + '<div class="a-cmdk-row" role="option" data-idx="' + idx + '" aria-selected="' + (sel ? 'true' : 'false') + '">'
          +   '<span class="a-cmdk-row-icon">' + icon + '</span>'
          +   '<span class="a-cmdk-row-text">'
          +     '<span class="a-cmdk-row-label">' + highlight(it.label, q) + '</span>'
          +     (it.sub ? '<span class="a-cmdk-row-sub">' + escapeHtml(it.sub) + '</span>' : '')
          +   '</span>'
          + '</div>';
      }).join('');
      var more = g.remaining > 0
        ? '<div class="a-cmdk-more">…et ' + g.remaining + ' autre' + (g.remaining > 1 ? 's' : '') + '</div>'
        : '';
      return '<div class="a-cmdk-group" data-group="' + escapeHtml(g.group) + '">' + rowsHtml + more + '</div>';
    }).join('');
    box.innerHTML = html;

    // Bind clicks
    var rows = box.querySelectorAll('.a-cmdk-row');
    rows.forEach(function (r) {
      r.addEventListener('mousemove', function () {
        var i = parseInt(r.getAttribute('data-idx'), 10);
        if (i !== state.selected) {
          state.selected = i;
          // Update aria-selected sans re-render complet
          rows.forEach(function (rr) { rr.setAttribute('aria-selected', 'false'); });
          r.setAttribute('aria-selected', 'true');
        }
      });
      r.addEventListener('click', function () {
        var i = parseInt(r.getAttribute('data-idx'), 10);
        state.selected = i;
        var flat = flatItems();
        var it = flat[i];
        if (!it) return;
        close();
        try { it.action(); } catch (err) { console.error('[cmdk] click error', err); }
      });
    });

    // Scroll selected into view
    var selEl = box.querySelector('[aria-selected="true"]');
    if (selEl && selEl.scrollIntoView) {
      selEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function iconFor(group) {
    switch (group) {
      case 'Pages':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.7"/></svg>';
      case 'Pharmacies':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      case 'Produits IP':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 7l9-4 9 4-9 4-9-4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 7v10l9 4 9-4V7" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
      case 'Actions':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
      default:
        return '';
    }
  }

  // ─── Open / Close ─────────────────────────────────────────────────
  function open() {
    if (state.open) return;
    state.open = true;
    state.lastFocus = document.activeElement;
    buildIndex();
    var root = ensureDom();
    filter('');
    render();
    requestAnimationFrame(function () {
      root.setAttribute('data-open', 'true');
      document.body.classList.add('a-cmdk-locked');
      var input = document.getElementById('a-cmdk-input');
      if (input) {
        input.value = '';
        state.query = '';
        try { input.focus(); } catch (e) {}
      }
    });
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    var root = document.getElementById('a-cmdk');
    if (root) root.setAttribute('data-open', 'false');
    document.body.classList.remove('a-cmdk-locked');
    if (state.lastFocus && state.lastFocus.focus) {
      try { state.lastFocus.focus(); } catch (e) {}
    }
  }

  function refresh() {
    if (!state.open) return;
    buildIndex();
    filter(state.query);
    render();
  }

  // ─── Public API ───────────────────────────────────────────────────
  window.appleOpenCmdk = open;
  window.appleCloseCmdk = close;
  window.appleRefreshCmdkIndex = function () {
    buildIndex();
    if (state.open) { filter(state.query); render(); }
  };

  // Pré-build de l'index au boot (différé)
  function lazyBoot() {
    setTimeout(function () { try { buildIndex(); } catch (e) {} }, 800);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', lazyBoot, { once: true });
  } else {
    lazyBoot();
  }
})();
