/* ═══════════════════════════════════════════════════════════════════
   APPLE MOTION — Comportements iOS (scroll-aware, sheet, toast)
   Refonte from scratch 2026-06-08
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── 1. SCROLL-AWARE NAVBAR (large title → compact on scroll) ───
  // Toute .a-navbar reçoit data-scroll="rest|scrolled" selon scrollY de son scroll container parent.
  function bindNavbarScroll() {
    var navbars = document.querySelectorAll('.a-navbar:not([data-scroll-bound])');
    navbars.forEach(function (nav) {
      nav.setAttribute('data-scroll-bound', '1');
      // Trouve le scroll container : .a-main parent ou window
      var container = nav.closest('.a-main') || window;
      var isWindow = container === window;

      function update() {
        var y = isWindow ? window.scrollY : container.scrollTop;
        nav.setAttribute('data-scroll', y > 16 ? 'scrolled' : 'rest');
      }

      update();
      var target = isWindow ? window : container;
      target.addEventListener('scroll', update, { passive: true });
    });
  }

  // ─── 2. SHEETS — open/close (overlay backdrop) ───
  function openSheet(sheetId) {
    var backdrop = typeof sheetId === 'string' ? document.getElementById(sheetId) : sheetId;
    if (!backdrop) return;
    backdrop.setAttribute('data-open', 'true');
    document.body.style.overflow = 'hidden';
    // Focus trap basic
    var firstFocusable = backdrop.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) setTimeout(function () { firstFocusable.focus(); }, 100);
  }

  function closeSheet(sheetId) {
    var backdrop = typeof sheetId === 'string' ? document.getElementById(sheetId) : sheetId;
    if (!backdrop) return;
    backdrop.setAttribute('data-open', 'false');
    document.body.style.overflow = '';
  }

  // Auto-bind : tout élément avec data-sheet-close ferme le sheet parent
  function bindSheetCloseButtons() {
    document.addEventListener('click', function (e) {
      var closer = e.target.closest('[data-sheet-close]');
      if (closer) {
        var sheet = closer.closest('.a-sheet-backdrop');
        if (sheet) closeSheet(sheet);
      }
      // Click sur backdrop (hors sheet) ferme
      var backdrop = e.target.classList && e.target.classList.contains('a-sheet-backdrop');
      if (backdrop && e.target.getAttribute('data-open') === 'true') closeSheet(e.target);
    });
    // Escape ferme la sheet ouverte
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var openSheets = document.querySelectorAll('.a-sheet-backdrop[data-open="true"]');
      if (openSheets.length) closeSheet(openSheets[openSheets.length - 1]);
    });
  }

  // ─── 3. TOAST queue ───
  var TOAST_HOST_ID = 'a-toast-host';
  function ensureToastHost() {
    var host = document.getElementById(TOAST_HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = TOAST_HOST_ID;
      host.className = 'a-toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  /**
   * Show a toast.
   * @param {string} message
   * @param {object} [opts] - { variant: 'info'|'success'|'warning'|'danger', duration: 3000 }
   */
  function showToast(message, opts) {
    opts = opts || {};
    var variant = opts.variant || 'info';
    var duration = opts.duration != null ? opts.duration : 2800;

    var host = ensureToastHost();
    var toast = document.createElement('div');
    toast.className = 'a-toast a-toast-' + variant;

    var iconName = variant === 'success' ? 'check-circle' :
                   variant === 'danger'  ? 'alert-triangle' :
                   variant === 'warning' ? 'alert-triangle' : 'info';
    toast.innerHTML =
      '<span class="a-toast-icon">' +
        (window.appleIcon ? window.appleIcon(iconName, 18) : '') +
      '</span>' +
      '<span class="a-toast-msg">' + escapeHtml(message) + '</span>';

    host.appendChild(toast);
    // Trigger animation next frame
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    });

    setTimeout(function () {
      toast.classList.remove('is-visible');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
    }, duration);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── 4. THEME TOGGLE (light/dark/system) ───
  var THEME_KEY = 'a-theme';
  function applyTheme(mode) {
    // mode = 'light' | 'dark' | 'system'
    var root = document.documentElement;
    if (mode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', mode);
    }
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  }
  function loadTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved) applyTheme(saved);
    } catch (e) {}
  }

  // ─── 5. SIDEBAR collapse persistance ───
  var SIDEBAR_KEY = 'a-sidebar-collapsed';
  function applySidebarCollapse(collapsed) {
    var shell = document.querySelector('.a-shell');
    var sidebar = document.querySelector('.a-sidebar');
    if (shell) shell.setAttribute('data-sidebar-collapsed', collapsed ? 'true' : 'false');
    if (sidebar) sidebar.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch (e) {}
  }
  function loadSidebarCollapse() {
    try {
      var saved = localStorage.getItem(SIDEBAR_KEY);
      if (saved === '1') applySidebarCollapse(true);
    } catch (e) {}
  }
  function toggleSidebar() {
    var shell = document.querySelector('.a-shell');
    var current = shell && shell.getAttribute('data-sidebar-collapsed') === 'true';
    applySidebarCollapse(!current);
  }

  // ─── 6. TAP feedback (subtle scale on tap for buttons/cards) ───
  // CSS-driven via :active pseudo-class. Rien à binder en JS.

  // ─── INIT ───
  function init() {
    loadTheme();
    loadSidebarCollapse();
    bindNavbarScroll();
    bindSheetCloseButtons();

    // Re-bind navbars after dynamic page renders (MutationObserver léger)
    var main = document.querySelector('.a-main') || document.body;
    if (main && 'MutationObserver' in window) {
      var mo = new MutationObserver(function () { bindNavbarScroll(); });
      mo.observe(main, { childList: true, subtree: false });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose globals
  window.appleOpenSheet = openSheet;
  window.appleCloseSheet = closeSheet;
  window.appleToast = showToast;
  window.appleSetTheme = applyTheme;
  window.appleToggleSidebar = toggleSidebar;
  window.appleApplySidebarCollapse = applySidebarCollapse;
})();
