/* ═══════════════════════════════════════════════════════════════════
   APPLE SHORTCUTS — Keyboard shortcuts globaux
   ⌘K / ⌘B / ⌘. / ⌘/ / ⌘F / Esc / ? / G+letter
   Ne se déclenche pas dans input/textarea/contenteditable.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── Détection input actif ────────────────────────────────────────
  function isTypingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  }

  // ─── State G-mode ─────────────────────────────────────────────────
  var gModeActive = false;
  var gModeTimer = null;
  function enterGMode() {
    gModeActive = true;
    if (gModeTimer) clearTimeout(gModeTimer);
    gModeTimer = setTimeout(function () { gModeActive = false; }, 1500);
  }
  function exitGMode() {
    gModeActive = false;
    if (gModeTimer) { clearTimeout(gModeTimer); gModeTimer = null; }
  }

  function nav(page) {
    if (typeof window.navigate === 'function') {
      window.navigate(page);
    }
  }

  // ─── Sidebar toggle ──────────────────────────────────────────────
  function toggleSidebar() {
    var sb = document.querySelector('.a-sidebar');
    if (!sb) {
      // fallback : .sidebar ou .app-sidebar
      sb = document.querySelector('.sidebar, .app-sidebar, [data-sidebar]');
    }
    if (!sb) return;
    var collapsed = sb.getAttribute('data-collapsed') === 'true';
    var next = !collapsed;
    sb.setAttribute('data-collapsed', next ? 'true' : 'false');
    try { localStorage.setItem('a-sidebar-collapsed', next ? '1' : '0'); } catch (e) {}
  }

  function restoreSidebar() {
    try {
      var v = localStorage.getItem('a-sidebar-collapsed');
      if (v === '1') {
        var sb = document.querySelector('.a-sidebar');
        if (sb) sb.setAttribute('data-collapsed', 'true');
      }
    } catch (e) {}
  }

  // ─── Focus search ────────────────────────────────────────────────
  function focusSearch() {
    var candidates = document.querySelectorAll(
      'input[type="search"], input.search-box, .global-search-input, .a-search input, [data-search] input'
    );
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var r = el.getBoundingClientRect();
      var visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      if (visible) {
        try { el.focus(); el.select && el.select(); } catch (e) {}
        return true;
      }
    }
    return false;
  }

  // ─── Cascade Esc : cmdk → inspector → sheet → modal ──────────────
  function escCascade() {
    // 1) cmdk
    var cmdk = document.getElementById('a-cmdk');
    if (cmdk && cmdk.getAttribute('data-open') === 'true') {
      if (typeof window.appleCloseCmdk === 'function') { window.appleCloseCmdk(); return true; }
    }
    // 2) cheatsheet
    var cs = document.getElementById('a-cheatsheet');
    if (cs && cs.getAttribute('data-open') === 'true') {
      cs.setAttribute('data-open', 'false');
      return true;
    }
    // 3) inspector
    var insp = document.querySelector('.a-inspector[data-open="true"], [data-inspector][data-open="true"]');
    if (insp) {
      insp.setAttribute('data-open', 'false');
      if (typeof window.closeInspector === 'function') window.closeInspector();
      return true;
    }
    // 4) sheet (bottom sheet)
    var sheet = document.querySelector('.a-sheet[data-open="true"], .bottom-sheet[data-open="true"], [data-sheet][data-open="true"]');
    if (sheet) {
      sheet.setAttribute('data-open', 'false');
      return true;
    }
    // 5) modal classique
    var modal = document.querySelector('.modal-backdrop[style*="display: block"], .modal.is-open, .modal[data-open="true"], .a-modal[data-open="true"]');
    if (modal) {
      var closeBtn = modal.querySelector('[data-close], .modal-close, .close');
      if (closeBtn && closeBtn.click) closeBtn.click();
      else if (modal.setAttribute) modal.setAttribute('data-open', 'false');
      return true;
    }
    return false;
  }

  // ─── Cheatsheet overlay ──────────────────────────────────────────
  function ensureCheatsheet() {
    var existing = document.getElementById('a-cheatsheet');
    if (existing) return existing;
    var navHtml = ''
      + row(['⌘','K'], 'Palette de commandes')
      + row(['⌘','B'], 'Replier la sidebar')
      + row(['⌘','F'], 'Focus recherche')
      + row(['G','M'], 'Marketing')
      + row(['G','P'], 'Pharmacies')
      + row(['G','D'], 'Pilotage')
      + row(['G','O'], 'Offilog')
      + row(['G','B'], 'Benchmark')
      + row(['G','S'], 'Simulateur')
      + row(['G','C'], 'Catalogue')
      + row(['G','R'], 'Produits')
      + row(['G','U'], 'Groupements');
    var actHtml = ''
      + row(['⌘','.'], 'PDF fiche pharmacie')
      + row(['Esc'], 'Fermer palette / panneau')
      + row(['?'], 'Cette aide');
    var viewHtml = ''
      + row(['⌘','/'], 'Changer la densité');
    var html = ''
      + '<div class="a-cheatsheet-backdrop" id="a-cheatsheet" data-open="false" role="dialog" aria-modal="true" aria-label="Raccourcis clavier">'
      +   '<div class="a-cheatsheet">'
      +     '<h2 class="a-cheatsheet-title">Raccourcis clavier</h2>'
      +     '<p class="a-cheatsheet-sub">Pour naviguer plus vite. Appuie sur <kbd>?</kbd> pour rouvrir cette aide.</p>'
      +     '<div class="a-cheatsheet-grid">'
      +       '<div class="a-cheatsheet-col">'
      +         '<h4>Navigation</h4>'
      +         '<div class="a-cheatsheet-list">' + navHtml + '</div>'
      +       '</div>'
      +       '<div class="a-cheatsheet-col">'
      +         '<h4>Actions</h4>'
      +         '<div class="a-cheatsheet-list">' + actHtml + '</div>'
      +       '</div>'
      +       '<div class="a-cheatsheet-col">'
      +         '<h4>Vue</h4>'
      +         '<div class="a-cheatsheet-list">' + viewHtml + '</div>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    var cs = document.getElementById('a-cheatsheet');
    cs.addEventListener('click', function (e) {
      if (e.target === cs) cs.setAttribute('data-open', 'false');
    });
    return cs;
  }
  function row(keys, label) {
    var keysHtml = keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join('');
    return '<div class="a-cheatsheet-row"><span>' + label + '</span><span class="a-cheatsheet-keys">' + keysHtml + '</span></div>';
  }
  function toggleCheatsheet() {
    var cs = ensureCheatsheet();
    var open = cs.getAttribute('data-open') === 'true';
    cs.setAttribute('data-open', open ? 'false' : 'true');
  }

  // ─── Keyboard handler ────────────────────────────────────────────
  function onKeydown(e) {
    // ESC : toujours actif, même dans input
    if (e.key === 'Escape') {
      if (escCascade()) e.preventDefault();
      return;
    }

    // Ignore si on tape dans un champ
    if (isTypingTarget(e.target)) return;

    var cmd = e.metaKey || e.ctrlKey;
    var key = e.key;

    // ⌘K — palette
    if (cmd && (key === 'k' || key === 'K')) {
      e.preventDefault();
      if (typeof window.appleOpenCmdk === 'function') window.appleOpenCmdk();
      return;
    }

    // ⌘B — sidebar toggle
    if (cmd && (key === 'b' || key === 'B')) {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    // ⌘. — PDF fiche pharma
    if (cmd && key === '.') {
      e.preventDefault();
      if (window.__currentPharmaId && typeof window.exportPharmaListingPDF === 'function') {
        window.exportPharmaListingPDF(window.__currentPharmaId);
      }
      return;
    }

    // ⌘/ — cycle density
    if (cmd && key === '/') {
      e.preventDefault();
      if (typeof window.appleCycleDensity === 'function') window.appleCycleDensity();
      return;
    }

    // ⌘F — focus omnibox courante
    if (cmd && (key === 'f' || key === 'F')) {
      if (focusSearch()) {
        e.preventDefault();
      }
      return;
    }

    // ? — cheatsheet
    if (!cmd && !e.altKey && (key === '?' || (e.shiftKey && key === '/'))) {
      e.preventDefault();
      toggleCheatsheet();
      return;
    }

    // G-then-letter (désactivé sur mobile et si meta/ctrl)
    if (cmd || e.altKey) return;
    if (isMobile()) return;

    if (!gModeActive) {
      if (key === 'g' || key === 'G') {
        e.preventDefault();
        enterGMode();
      }
      return;
    }

    // gModeActive
    var navMap = {
      m: 'marketing', M: 'marketing',
      p: 'pharmacies', P: 'pharmacies',
      d: 'dashboard', D: 'dashboard',
      o: 'offilog', O: 'offilog',
      b: 'benchmark', B: 'benchmark',
      s: 'simulateur', S: 'simulateur',
      c: 'catalogue', C: 'catalogue',
      r: 'produits', R: 'produits',
      u: 'groupements', U: 'groupements'
    };
    if (navMap[key]) {
      e.preventDefault();
      exitGMode();
      nav(navMap[key]);
    } else {
      exitGMode();
    }
  }

  // ─── Init ────────────────────────────────────────────────────────
  function init() {
    document.addEventListener('keydown', onKeydown, true);
    restoreSidebar();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Public helper (utile pour debug / tests)
  window.appleShortcuts = {
    toggleSidebar: toggleSidebar,
    toggleCheatsheet: toggleCheatsheet,
    focusSearch: focusSearch
  };
})();
