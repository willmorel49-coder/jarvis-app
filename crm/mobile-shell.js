/* ═══════════════════════════════════════════════════════════════
 * mobile-shell.js — Drawer hamburger pour CRM Intégral Pharma
 * Cible : iPhone (Safari). Vanilla JS, IIFE, self-contained.
 * Comportement :
 *   - Injecte un bouton hamburger fixed top-left (mode classic uniquement)
 *   - Toggle la sidebar via classe body.drawer-open
 *   - Overlay tap → close · Swipe-left sur drawer → close
 *   - ESC → close · Clic nav-item → close · Focus trap pendant l'ouverture
 *   - Scrolle l'item actif dans la vue à l'ouverture
 *   - Désactivé en mode JARVIS (pas de sidebar)
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Évite double-init
  if (window.__MOBILE_SHELL_INIT__) return;
  window.__MOBILE_SHELL_INIT__ = true;

  const MOBILE_BP = 768;
  const SWIPE_CLOSE_THRESHOLD = 60; // px vers la gauche pour fermer
  const SWIPE_VELOCITY_THRESHOLD = 0.4; // px/ms

  const isMobile = () => window.matchMedia('(max-width: ' + MOBILE_BP + 'px)').matches;
  const isClassicMode = () => document.documentElement.dataset.mode === 'classic';

  // ── State ─────────────────────────────────────────────────────
  let hamburgerBtn = null;
  let overlayEl = null;
  let sidebarEl = null;
  let lastFocused = null;
  let touchStartX = 0;
  let touchStartT = 0;
  let touchCurrentX = 0;
  let isDragging = false;
  let sidebarWidth = 0;

  // ── DOM creation ──────────────────────────────────────────────
  function ensureHamburger() {
    if (document.querySelector('.mob-hamburger')) {
      hamburgerBtn = document.querySelector('.mob-hamburger');
      return;
    }
    const btn = document.createElement('button');
    btn.className = 'mob-hamburger';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Ouvrir le menu');
    btn.setAttribute('aria-controls', 'mob-sidebar');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
        '<line x1="4" y1="7"  x2="20" y2="7"/>' +
        '<line x1="4" y1="12" x2="20" y2="12"/>' +
        '<line x1="4" y1="17" x2="20" y2="17"/>' +
      '</svg>';
    btn.addEventListener('click', openDrawer);
    document.body.appendChild(btn);
    hamburgerBtn = btn;
  }

  function ensureOverlay() {
    if (document.querySelector('.mob-drawer-overlay')) {
      overlayEl = document.querySelector('.mob-drawer-overlay');
      return;
    }
    const ov = document.createElement('div');
    ov.className = 'mob-drawer-overlay';
    ov.setAttribute('aria-hidden', 'true');
    ov.addEventListener('click', closeDrawer);
    document.body.appendChild(ov);
    overlayEl = ov;
  }

  function ensureSidebarA11y() {
    sidebarEl = document.querySelector('nav.sidebar');
    if (!sidebarEl) return;
    if (!sidebarEl.id) sidebarEl.id = 'mob-sidebar';
    sidebarEl.setAttribute('role', 'dialog');
    sidebarEl.setAttribute('aria-modal', 'true');
    sidebarEl.setAttribute('aria-label', 'Menu de navigation');
  }

  // ── Open / Close ──────────────────────────────────────────────
  function openDrawer() {
    if (!isMobile() || !isClassicMode()) return;
    if (!sidebarEl) ensureSidebarA11y();
    if (document.body.classList.contains('drawer-open')) return;

    lastFocused = document.activeElement;
    document.body.classList.add('drawer-open');
    if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'true');

    // Scrolle l'item actif dans la vue
    requestAnimationFrame(function () {
      const active = sidebarEl && sidebarEl.querySelector('.nav-item.active');
      if (active && typeof active.scrollIntoView === 'function') {
        try { active.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) {}
      }
      // Focus le premier élément interactif du drawer
      const firstFocusable = getFocusables()[0];
      if (firstFocusable) firstFocusable.focus({ preventScroll: true });
    });
  }

  function closeDrawer() {
    if (!document.body.classList.contains('drawer-open')) return;
    document.body.classList.remove('drawer-open');
    document.body.classList.remove('drawer-dragging');
    if (sidebarEl) sidebarEl.style.transform = '';
    if (overlayEl) overlayEl.style.opacity = '';
    if (hamburgerBtn) {
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    }
    // Restore focus
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  // ── Focus trap ────────────────────────────────────────────────
  function getFocusables() {
    if (!sidebarEl) return [];
    return Array.prototype.filter.call(
      sidebarEl.querySelectorAll(
        'a[href], button, [tabindex]:not([tabindex="-1"]), input, select, textarea, .nav-item'
      ),
      function (el) { return !el.hasAttribute('disabled') && el.offsetParent !== null; }
    );
  }

  function handleFocusTrap(e) {
    if (e.key !== 'Tab') return;
    if (!document.body.classList.contains('drawer-open')) return;
    const list = getFocusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  // ── Keyboard ──────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) {
      closeDrawer();
      return;
    }
    handleFocusTrap(e);
  }

  // ── Swipe-to-close (touch) ────────────────────────────────────
  function onTouchStart(e) {
    if (!document.body.classList.contains('drawer-open')) return;
    if (!sidebarEl || !sidebarEl.contains(e.target)) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchCurrentX = t.clientX;
    touchStartT = Date.now();
    sidebarWidth = sidebarEl.getBoundingClientRect().width || 280;
    isDragging = false;
  }

  function onTouchMove(e) {
    if (!touchStartT) return;
    const t = e.touches[0];
    touchCurrentX = t.clientX;
    const dx = touchCurrentX - touchStartX;
    if (!isDragging && dx < -8) {
      isDragging = true;
      document.body.classList.add('drawer-dragging');
    }
    if (isDragging && dx < 0) {
      // ne suit que les drags vers la gauche
      sidebarEl.style.transform = 'translateX(' + dx + 'px)';
      const progress = 1 - Math.min(1, Math.abs(dx) / sidebarWidth);
      if (overlayEl) overlayEl.style.opacity = String(progress);
      e.preventDefault();
    }
  }

  function onTouchEnd() {
    if (!touchStartT) return;
    const dx = touchCurrentX - touchStartX;
    const dt = Date.now() - touchStartT;
    const velocity = Math.abs(dx) / Math.max(dt, 1);

    document.body.classList.remove('drawer-dragging');

    if (isDragging && (dx < -SWIPE_CLOSE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD)) {
      closeDrawer();
    } else {
      // restore
      if (sidebarEl) sidebarEl.style.transform = '';
      if (overlayEl) overlayEl.style.opacity = '';
    }

    touchStartT = 0;
    touchStartX = 0;
    touchCurrentX = 0;
    isDragging = false;
  }

  // ── Auto-close au clic nav-item ───────────────────────────────
  function bindNavItemAutoClose() {
    if (!sidebarEl) return;
    sidebarEl.addEventListener('click', function (e) {
      const item = e.target.closest('.nav-item, .sidebar-user');
      if (!item) return;
      if (!document.body.classList.contains('drawer-open')) return;
      // léger délai pour laisser navigate() s'exécuter avant l'animation de fermeture
      setTimeout(closeDrawer, 80);
    });
  }

  // ── Resize watcher : ferme si on dépasse mobile ───────────────
  function onResize() {
    if (!isMobile() && document.body.classList.contains('drawer-open')) {
      closeDrawer();
    }
  }

  // ── Mode change observer (toggle JARVIS <-> classic) ──────────
  function observeModeChange() {
    const mo = new MutationObserver(function () {
      if (!isClassicMode() && document.body.classList.contains('drawer-open')) {
        closeDrawer();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    ensureSidebarA11y();
    ensureHamburger();
    ensureOverlay();
    bindNavItemAutoClose();

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    // Touch events sur la sidebar pour le swipe-to-close
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    observeModeChange();

    // API publique minimale (utile pour debug)
    window.MobileShell = {
      open: openDrawer,
      close: closeDrawer,
      isOpen: function () { return document.body.classList.contains('drawer-open'); }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
