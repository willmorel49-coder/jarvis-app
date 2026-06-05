/* ═══════════════════════════════════════════════════════════════════════════
 * mobile-gestures.js — CRM Intégral Pharma · Gestures iOS-native
 * ───────────────────────────────────────────────────────────────────────────
 * Vanilla JS pur · IIFE self-contained · Safari iOS 14+ · zéro dépendance.
 *
 * Couverture :
 *   1) Swipe-back depuis le bord gauche (fiche pharmacie, produit, benchmark…)
 *   2) Pull-to-refresh sur les listes (Pilotage, Pharmacies, Produits, Offilog)
 *   3) Bottom-sheet swipe-down sur les modales mobile
 *      (cooperate avec native-shell.js pour le sheet "Plus")
 *   4) Tap feedback global (touch-action: manipulation déjà géré côté CSS)
 *
 * NE PAS toucher :
 *   - Hamburger / sidebar drawer → mobile-shell.js
 *   - Sheet "Plus" → native-shell.js (déjà gère son propre swipe-down)
 *   - Modales marketing → marketing.js
 * ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.__MOBILE_GESTURES_INIT__) return;
  window.__MOBILE_GESTURES_INIT__ = true;

  // ─────────────────────────────────────────────────────────────────
  // Constantes & helpers
  // ─────────────────────────────────────────────────────────────────
  var MOBILE_BP = 768;
  var EDGE_ZONE = 24;       // px depuis le bord gauche pour activer swipe-back
  var SWIPE_BACK_THRESHOLD = 100; // px avant de valider le retour
  var SWIPE_BACK_PREVIEW   = 50;  // px avant de commencer le preview visuel
  var PTR_THRESHOLD = 70;   // px à tirer vers le bas pour valider le refresh
  var PTR_PREVIEW   = 12;   // px avant d'afficher le spinner
  var SHEET_SWIPE_THRESHOLD = 80; // px vers le bas pour fermer un sheet

  var isMobile = function () {
    return window.matchMedia('(max-width: ' + MOBILE_BP + 'px)').matches;
  };
  var isClassic = function () {
    return (document.documentElement.dataset.mode || 'classic') === 'classic';
  };
  var isReducedMotion = function () {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  // ─────────────────────────────────────────────────────────────────
  // 1) SWIPE-BACK depuis le bord gauche
  //    Heuristique : on est dans une "vue de détail" si la page-content
  //    contient un bouton retour (.np-back-btn) ou data-detail-view,
  //    OU si une modale plein écran .modal/.bench-detail-modal est ouverte.
  // ─────────────────────────────────────────────────────────────────
  var sb = {
    startX: 0, startY: 0, currentX: 0,
    startedAt: 0,
    active: false,
    target: null,         // élément à translater (page-content ou modal)
    backAction: null,     // fonction à appeler quand on valide le retour
    locked: false,        // verrou anti scroll horizontal
  };

  function findDetailContext(touchTarget) {
    // Priorité 1 : modale plein écran ouverte (benchmark, edit, etc.)
    var openModal = document.querySelector(
      '#bench-detail-modal, #edit-pharma-modal, [data-mobile-sheet].is-open, .np-modal.is-open'
    );
    if (openModal) {
      // On ne swipe-back que sur les éléments tactiles à l'intérieur de la modale
      if (openModal.contains(touchTarget)) {
        return {
          target: openModal,
          backAction: function () {
            // Cherche un bouton close standard, sinon supprime
            var closeBtn = openModal.querySelector(
              '[data-close], .np-modal-close, .modal-close, [aria-label="Fermer"], [aria-label="Close"]'
            );
            if (closeBtn) closeBtn.click();
            else openModal.remove();
          },
          translateContext: openModal,
        };
      }
      return null;
    }

    // Priorité 2 : page-content avec bouton retour
    var pageContent = document.querySelector('.page-content');
    if (!pageContent) return null;
    var backBtn = pageContent.querySelector(
      '.np-back-btn, [data-back-btn], .back-btn'
    );
    if (!backBtn) return null;

    // Le touch doit avoir démarré dans la page active
    var activePage = pageContent.querySelector('.page.active');
    if (!activePage || !activePage.contains(touchTarget)) return null;

    return {
      target: activePage,
      backAction: function () { backBtn.click(); },
      translateContext: activePage,
    };
  }

  function onSwipeBackStart(e) {
    if (!isMobile() || !isClassic()) return;
    if (sb.active) return;
    var t = e.touches && e.touches[0];
    if (!t) return;

    // Zone bord gauche uniquement
    if (t.clientX > EDGE_ZONE) return;

    // Pas pendant un drawer ouvert (déjà géré par mobile-shell.js)
    if (document.body.classList.contains('drawer-open')) return;

    // Pas pendant un sheet natif ouvert (géré par native-shell.js)
    if (document.body.classList.contains('ns-sheet-open')) return;

    var ctx = findDetailContext(e.target);
    if (!ctx) return;

    sb.startX = t.clientX;
    sb.startY = t.clientY;
    sb.currentX = t.clientX;
    sb.startedAt = Date.now();
    sb.active = true;
    sb.locked = false;
    sb.target = ctx.translateContext;
    sb.backAction = ctx.backAction;
  }

  function onSwipeBackMove(e) {
    if (!sb.active || !sb.target) return;
    var t = e.touches && e.touches[0];
    if (!t) return;
    sb.currentX = t.clientX;

    var dx = sb.currentX - sb.startX;
    var dy = t.clientY - sb.startY;

    // Annule si geste plus vertical qu'horizontal (scroll)
    if (!sb.locked) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
        cancelSwipeBack();
        return;
      }
      if (dx > 8) sb.locked = true; // verrou horizontal acquis
    }

    if (dx <= 0) {
      // Geste vers la gauche → on annule (pas de retour gauche-droite inversé)
      if (sb.target.style.transform) sb.target.style.transform = '';
      return;
    }

    // Preview visuel à partir de SWIPE_BACK_PREVIEW
    if (dx >= SWIPE_BACK_PREVIEW) {
      var travel = dx - SWIPE_BACK_PREVIEW;
      sb.target.style.transform = 'translateX(' + Math.min(travel, window.innerWidth) + 'px)';
      sb.target.style.transition = 'none';
      sb.target.style.willChange = 'transform';
      sb.target.style.boxShadow = '-12px 0 32px -8px rgba(11, 31, 77, .25)';
      // Empêche le scroll horizontal natif
      if (e.cancelable) e.preventDefault();
    }
  }

  function cancelSwipeBack() {
    if (sb.target) {
      sb.target.style.transition = 'transform 200ms cubic-bezier(.4,0,.2,1), box-shadow 200ms';
      sb.target.style.transform = '';
      sb.target.style.boxShadow = '';
      var tgt = sb.target;
      setTimeout(function () {
        if (tgt) {
          tgt.style.willChange = '';
          tgt.style.transition = '';
        }
      }, 220);
    }
    sb.active = false;
    sb.target = null;
    sb.backAction = null;
    sb.locked = false;
  }

  function onSwipeBackEnd() {
    if (!sb.active || !sb.target) {
      sb.active = false;
      return;
    }
    var dx = sb.currentX - sb.startX;
    var dt = Date.now() - sb.startedAt;
    var velocity = dx / Math.max(dt, 1);

    // Validation : seuil distance OU vitesse rapide
    var shouldGoBack = dx >= SWIPE_BACK_THRESHOLD || (dx >= SWIPE_BACK_PREVIEW && velocity > 0.6);

    if (shouldGoBack) {
      // Anime jusqu'à la sortie puis trigger le back
      var tgt = sb.target;
      var action = sb.backAction;
      tgt.style.transition = 'transform 200ms cubic-bezier(.4,0,.2,1), opacity 180ms';
      tgt.style.transform = 'translateX(' + window.innerWidth + 'px)';
      tgt.style.opacity = '.6';
      setTimeout(function () {
        tgt.style.transition = '';
        tgt.style.transform = '';
        tgt.style.opacity = '';
        tgt.style.boxShadow = '';
        tgt.style.willChange = '';
        try { action && action(); } catch (e) { /* noop */ }
      }, 180);
      sb.active = false;
      sb.target = null;
      sb.backAction = null;
      sb.locked = false;
    } else {
      cancelSwipeBack();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 2) PULL-TO-REFRESH sur pages liste
  //    Listes ciblées : dashboard, pharmacies, produits, offilog, benchmark, catalogue
  // ─────────────────────────────────────────────────────────────────
  var PTR_PAGES = {
    dashboard:   function () { if (typeof renderDashboard   === 'function') renderDashboard(); },
    pharmacies:  function () { if (typeof renderPharmacies  === 'function') renderPharmacies(); },
    produits:    function () { if (typeof renderProduits    === 'function') renderProduits(); },
    offilog:     function () { if (typeof renderOffilog     === 'function') renderOffilog(); },
    benchmark:   function () { if (typeof renderBenchmark   === 'function') renderBenchmark(); },
    catalogue:   function () { if (typeof renderCatalogue   === 'function') renderCatalogue(); },
    groupements: function () { if (typeof renderGroupements === 'function') renderGroupements(); },
  };

  var ptr = {
    startY: 0, currentY: 0,
    active: false, pulling: false, refreshing: false,
    indicator: null,
  };

  function ensurePtrIndicator() {
    if (ptr.indicator) return ptr.indicator;
    var el = document.querySelector('.ptr-indicator');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ptr-indicator';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 12 12 4 4 12"/><line x1="12" y1="4" x2="12" y2="20"/></svg>';
      document.body.appendChild(el);
    }
    ptr.indicator = el;
    return el;
  }

  function getCurrentPage() {
    return (window.state && window.state.currentPage) || 'dashboard';
  }

  function isAtScrollTop() {
    // page-content + document scroll
    var pc = document.querySelector('.page-content');
    if (pc && pc.scrollTop > 0) return false;
    var docTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    return docTop <= 0;
  }

  function onPtrStart(e) {
    if (!isMobile() || !isClassic()) return;
    if (sb.active) return; // priorité au swipe-back
    if (ptr.refreshing) return;
    if (document.body.classList.contains('drawer-open')) return;
    if (document.body.classList.contains('ns-sheet-open')) return;
    // Ne PAS déclencher si un modal/sheet est ouvert
    if (document.querySelector('#bench-detail-modal, #edit-pharma-modal, [data-mobile-sheet].is-open')) return;

    var page = getCurrentPage();
    if (!PTR_PAGES[page]) return;

    if (!isAtScrollTop()) return;

    var t = e.touches && e.touches[0];
    if (!t) return;
    ptr.startY = t.clientY;
    ptr.currentY = t.clientY;
    ptr.active = true;
    ptr.pulling = false;
  }

  function onPtrMove(e) {
    if (!ptr.active) return;
    var t = e.touches && e.touches[0];
    if (!t) return;
    ptr.currentY = t.clientY;
    var dy = ptr.currentY - ptr.startY;

    if (dy <= 0) {
      // Geste vers le haut → annule
      if (ptr.pulling) {
        document.body.classList.remove('is-pulling');
        if (ptr.indicator) ptr.indicator.style.transform = '';
        ptr.pulling = false;
      }
      return;
    }

    // Vérifie qu'on est toujours en haut
    if (!isAtScrollTop()) {
      onPtrEnd();
      return;
    }

    if (dy >= PTR_PREVIEW) {
      ensurePtrIndicator();
      if (!ptr.pulling) {
        ptr.pulling = true;
        document.body.classList.add('is-pulling');
      }
      // Translation élastique (rubber band)
      var elastic = Math.min(dy * 0.6, 120);
      if (ptr.indicator) {
        ptr.indicator.style.transform =
          'translateX(-50%) translateY(' + (elastic - 20) + 'px) ' +
          'rotate(' + Math.min(dy / PTR_THRESHOLD * 180, 180) + 'deg)';
      }
      if (e.cancelable && dy > 30) e.preventDefault();
    }
  }

  function onPtrEnd() {
    if (!ptr.active) return;
    var dy = ptr.currentY - ptr.startY;
    var page = getCurrentPage();
    var doRefresh = ptr.pulling && dy >= PTR_THRESHOLD && PTR_PAGES[page];

    ptr.active = false;
    ptr.pulling = false;
    document.body.classList.remove('is-pulling');

    if (ptr.indicator) {
      ptr.indicator.style.transform = '';
    }

    if (doRefresh) {
      ptr.refreshing = true;
      document.body.classList.add('is-refreshing');
      // Léger délai pour laisser l'utilisateur voir l'animation
      setTimeout(function () {
        try { PTR_PAGES[page](); } catch (e) {}
        setTimeout(function () {
          document.body.classList.remove('is-refreshing');
          ptr.refreshing = false;
          if (typeof window.showToast === 'function') {
            try { window.showToast('Actualisé', 'success'); } catch (e) {}
          }
        }, 320);
      }, 120);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 3) BOTTOM-SHEET swipe-down sur modales mobile
  //    Cible : éléments marqués [data-mobile-sheet] OU classes connues
  //    Le sheet "Plus" (native-shell.js) gère déjà son propre swipe.
  // ─────────────────────────────────────────────────────────────────
  var SHEET_SELECTOR = '[data-mobile-sheet], #bench-detail-modal > div, #edit-pharma-modal .np-modal-card';

  function attachSheetSwipe(sheetEl, options) {
    if (!sheetEl || sheetEl.__mobileSwipeBound__) return;
    sheetEl.__mobileSwipeBound__ = true;
    options = options || {};
    var threshold = options.threshold || SHEET_SWIPE_THRESHOLD;
    var closeAction = options.onClose || function () {
      // Cherche un bouton fermer standard
      var btn = sheetEl.querySelector('[data-close], .np-modal-close, .modal-close, [aria-label="Fermer"]');
      if (btn) { btn.click(); return; }
      // Fallback : trouve la racine modale et la supprime
      var root = sheetEl.id && sheetEl.id.endsWith('-modal')
        ? sheetEl
        : (sheetEl.closest('[id$="-modal"]') || sheetEl.closest('.np-modal') || sheetEl.parentElement);
      if (root && root.parentElement) root.remove();
      else sheetEl.remove();
    };

    var sy = 0, dy = 0, dragging = false;

    function start(e) {
      if (!isMobile()) return;
      var t = e.touches ? e.touches[0] : e;
      // Démarre uniquement depuis le tiers haut du sheet (zone handle/header)
      var rect = sheetEl.getBoundingClientRect();
      if (t.clientY - rect.top > rect.height * 0.35) return;
      sy = t.clientY;
      dy = 0;
      dragging = true;
      sheetEl.style.transition = 'none';
    }
    function move(e) {
      if (!dragging) return;
      var t = e.touches ? e.touches[0] : e;
      dy = t.clientY - sy;
      if (dy < 0) dy = 0;
      sheetEl.style.transform = 'translateY(' + dy + 'px)';
      if (e.cancelable && dy > 6) e.preventDefault();
    }
    function end() {
      if (!dragging) return;
      dragging = false;
      sheetEl.style.transition = 'transform 220ms cubic-bezier(.4,0,.2,1)';
      if (dy > threshold) {
        sheetEl.style.transform = 'translateY(100%)';
        setTimeout(function () {
          sheetEl.style.transition = '';
          sheetEl.style.transform = '';
          try { closeAction(); } catch (e) {}
        }, 200);
      } else {
        sheetEl.style.transform = '';
      }
    }

    sheetEl.addEventListener('touchstart', start, { passive: true });
    sheetEl.addEventListener('touchmove', move, { passive: false });
    sheetEl.addEventListener('touchend', end, { passive: true });
    sheetEl.addEventListener('touchcancel', end, { passive: true });
  }

  // Observer : quand une modale s'injecte dans le DOM, on l'équipe du swipe
  function observeModals() {
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          // L'élément lui-même
          if (n.matches && n.matches(SHEET_SELECTOR)) attachSheetSwipe(n);
          // Descendants
          if (n.querySelectorAll) {
            var matches = n.querySelectorAll(SHEET_SELECTOR);
            for (var k = 0; k < matches.length; k++) attachSheetSwipe(matches[k]);
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // Couvre les modales déjà présentes
    var existing = document.querySelectorAll(SHEET_SELECTOR);
    for (var i = 0; i < existing.length; i++) attachSheetSwipe(existing[i]);
  }

  // ─────────────────────────────────────────────────────────────────
  // 4) TAP FEEDBACK enhancement
  //    Le CSS gère déjà :active (style-mobile-touch.css §B).
  //    Ici on s'assure que touch-action: manipulation est posé partout
  //    (anti-double-tap zoom Safari iOS sur les zones cliquables).
  // ─────────────────────────────────────────────────────────────────
  function injectTouchActionFallback() {
    // Cas où des éléments ont des onclick inline mais pas la classe — runtime
    var nodes = document.querySelectorAll('[onclick]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.style.touchAction) n.style.touchAction = 'manipulation';
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────────────
  function init() {
    // Swipe-back
    document.addEventListener('touchstart', onSwipeBackStart, { passive: true });
    document.addEventListener('touchmove', onSwipeBackMove, { passive: false });
    document.addEventListener('touchend', onSwipeBackEnd, { passive: true });
    document.addEventListener('touchcancel', function () {
      if (sb.active) cancelSwipeBack();
    }, { passive: true });

    // Pull-to-refresh (séparé du swipe-back : axes différents)
    document.addEventListener('touchstart', onPtrStart, { passive: true });
    document.addEventListener('touchmove', onPtrMove, { passive: false });
    document.addEventListener('touchend', onPtrEnd, { passive: true });
    document.addEventListener('touchcancel', onPtrEnd, { passive: true });

    // Bottom-sheet swipe-down
    observeModals();

    // Tap feedback fallback
    injectTouchActionFallback();
    // Re-scan périodique léger après chaque render majeur (event custom si présent)
    document.addEventListener('jarvis:rendered', injectTouchActionFallback);

    // Reduced motion : on coupe les animations swipe (mais on garde le tap)
    if (isReducedMotion()) {
      // Pas besoin de remettre transitions : déjà géré par le CSS @media reduced-motion
    }

    // API publique pour debug
    window.MobileGestures = {
      cancelSwipeBack: cancelSwipeBack,
      attachSheetSwipe: attachSheetSwipe,
      isSwipingBack: function () { return sb.active; },
      isPulling: function () { return ptr.pulling; },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
