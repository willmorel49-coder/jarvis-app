/* ============================================================================
   native-motion.js — CRM Intégral Pharma
   IIFE orchestrant les micro-interactions iOS-native :
     - stagger fade-in-up sur le rendu des pages
     - page transitions au switch de .page.active
     - tap feedback (.is-tapping) pour mobile
     - tab bar pulse à l'activation
     - sparkline / chart mount detection
   ----------------------------------------------------------------------------
   Robustesse : si MutationObserver ou matchMedia absent, on skip silencieusement.
   Performance : skip total sur connexions 2g/slow-2g et prefers-reduced-motion.
   API publique : window.mountStaggerAnimation(container)
   ============================================================================ */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // 0) Garde-fous environnement
  // ─────────────────────────────────────────────────────────────────────────
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var MO = window.MutationObserver || window.WebKitMutationObserver;
  if (!MO) return; // pas d'observers → on n'orchestre rien (CSS hover/active suffit)

  // Connexion lente : on désactive les apparitions stagger pour éviter le jank
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var SLOW_NETWORK = !!(conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.saveData));

  // Reduced motion : on respecte intégralement
  var mqReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() {
    return !!(mqReduced && mqReduced.matches);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1) Constantes
  // ─────────────────────────────────────────────────────────────────────────
  var STAGGER_MAX = 8;             // au-delà : index clampé
  var STAGGER_STEP_MS = 40;        // doit matcher le CSS
  var ENTER_DUR_MS = 280;
  var BUFFER_MS = 80;              // marge pour le cleanup will-change

  // Sélecteurs des éléments à "stagger" dans un container fraîchement rendu
  // On vise : details (collapsibles), cards à border-radius inline, sections
  // directes, divs avec box-shadow inline (cards V2).
  var STAGGER_SELECTOR = [
    ':scope > details',
    ':scope > section',
    ':scope > .card',
    ':scope > [style*="border-radius:14px"]',
    ':scope > [style*="border-radius: 14px"]',
    ':scope > [style*="border-radius:12px"]',
    ':scope > [style*="border-radius: 12px"]',
    ':scope > [style*="box-shadow"]'
  ].join(',');

  // Containers de page connus du CRM (renderXxxV2 injecte dans #X-content)
  var PAGE_CONTENT_SELECTORS = [
    '[id$="-content"]',
    '.page__content',
    '.page-content'
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // 2) Stagger : pose .mkt-stagger-prep, puis .mkt-stagger-enter frame suivante
  // ─────────────────────────────────────────────────────────────────────────
  function applyStagger(container) {
    if (!container || reducedMotion() || SLOW_NETWORK) return;

    var children;
    try {
      children = container.querySelectorAll(STAGGER_SELECTOR);
    } catch (e) {
      return; // :scope non supporté très anciens navigateurs
    }
    if (!children || !children.length) return;

    // Cap à 24 pour ne JAMAIS animer 60+ éléments (perf hard guard)
    var max = Math.min(children.length, 24);

    // 2a) Frame N : on pose l'état initial (opacity 0 + translate)
    for (var i = 0; i < max; i++) {
      var el = children[i];
      // Ne pas re-stager un élément déjà animé
      if (el.classList.contains('mkt-stagger-enter') || el.classList.contains('mkt-stagger-done')) continue;
      el.classList.add('mkt-stagger-prep');
      var idx = i < STAGGER_MAX ? i : STAGGER_MAX;
      el.style.setProperty('--mkt-i', idx);
    }

    // 2b) Frame N+1 : on enclenche l'animation (double rAF = reflow garanti)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        for (var j = 0; j < max; j++) {
          var node = children[j];
          if (node.classList.contains('mkt-stagger-done')) continue;
          node.classList.remove('mkt-stagger-prep');
          node.classList.add('mkt-stagger-enter');
        }

        // 2c) Cleanup will-change après la fin de l'anim la plus longue
        var totalMs = ENTER_DUR_MS + STAGGER_MAX * STAGGER_STEP_MS + BUFFER_MS;
        setTimeout(function () {
          for (var k = 0; k < max; k++) {
            var n = children[k];
            n.classList.remove('mkt-stagger-enter');
            n.classList.add('mkt-stagger-done');
            n.style.removeProperty('--mkt-i');
          }
        }, totalMs);
      });
    });
  }

  // API publique pour re-déclencher après un re-render (renderXxxV2)
  window.mountStaggerAnimation = function (container) {
    if (!container) return;
    // Reset des classes pour permettre une nouvelle animation
    var prev = container.querySelectorAll('.mkt-stagger-done');
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove('mkt-stagger-done');
    applyStagger(container);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 3) Page transition : observer .page.active
  // ─────────────────────────────────────────────────────────────────────────
  function animatePageEnter(pageEl) {
    if (!pageEl || reducedMotion()) return;

    pageEl.classList.add('mkt-page-entering');
    setTimeout(function () {
      pageEl.classList.remove('mkt-page-entering');
    }, 260);

    // Stagger les enfants du container de page
    var found = false;
    for (var i = 0; i < PAGE_CONTENT_SELECTORS.length; i++) {
      var container = pageEl.querySelector(PAGE_CONTENT_SELECTORS[i]);
      if (container) {
        applyStagger(container);
        found = true;
        break;
      }
    }
    // Fallback : stagger directement les enfants de la page
    if (!found) {
      applyStagger(pageEl);
    }

    // Détecte sparklines / charts présents dans la page → enclenche le mount
    enhanceCharts(pageEl);
  }

  function observePageSwitches() {
    var pages = document.querySelectorAll('.page');
    if (!pages.length) return;

    var observer = new MO(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
        var t = m.target;
        if (t.classList && t.classList.contains('active') && t.classList.contains('page')) {
          animatePageEnter(t);
        }
      }
    });

    for (var i = 0; i < pages.length; i++) {
      observer.observe(pages[i], { attributes: true, attributeFilter: ['class'] });
    }

    // Animation initiale sur la page active au chargement
    var activeNow = document.querySelector('.page.active');
    if (activeNow) animatePageEnter(activeNow);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4) Observe les re-renders dans les containers de page (renderXxxV2)
  //    Quand le contenu d'un #X-content change, on relance le stagger
  // ─────────────────────────────────────────────────────────────────────────
  function observeContentReRenders() {
    var contents = document.querySelectorAll(PAGE_CONTENT_SELECTORS.join(','));
    if (!contents.length) return;

    var rerenderObserver = new MO(function (mutations) {
      var seen = new Set ? new Set() : null;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type !== 'childList' || !m.addedNodes.length) continue;
        var target = m.target;
        if (!target || !target.parentElement) continue;
        // Skip si c'est juste un sous-ajout (pas un wipe complet)
        if (m.removedNodes.length === 0) continue;
        if (seen) {
          if (seen.has(target)) continue;
          seen.add(target);
        }
        // Ne déclenche que si on est dans une page active
        var page = target.closest('.page');
        if (page && !page.classList.contains('active')) continue;
        applyStagger(target);
        enhanceCharts(target);
      }
    });

    for (var j = 0; j < contents.length; j++) {
      rerenderObserver.observe(contents[j], { childList: true });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5) Tap feedback : .is-tapping sur touchstart (mobile, où :active est lent)
  // ─────────────────────────────────────────────────────────────────────────
  function attachTapFeedback() {
    var tappableSelector = 'button, [role="button"], [data-page], .btn, [data-tap]';

    document.addEventListener('touchstart', function (e) {
      var el = e.target.closest && e.target.closest(tappableSelector);
      if (!el) return;
      el.classList.add('is-tapping');
    }, { passive: true });

    var clear = function () {
      // On nettoie toutes les is-tapping (sécurité multi-touch)
      var tapping = document.querySelectorAll('.is-tapping');
      for (var i = 0; i < tapping.length; i++) tapping[i].classList.remove('is-tapping');
    };

    document.addEventListener('touchend', clear, { passive: true });
    document.addEventListener('touchcancel', clear, { passive: true });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6) Tab bar : pulse à l'activation
  // ─────────────────────────────────────────────────────────────────────────
  function attachTabPulse() {
    document.addEventListener('click', function (e) {
      var tab = e.target.closest && e.target.closest('[data-page]');
      if (!tab) return;
      // Retire la pulse de toutes les autres
      var pulsed = document.querySelectorAll('.mkt-just-activated');
      for (var i = 0; i < pulsed.length; i++) pulsed[i].classList.remove('mkt-just-activated');
      // Pulse seulement si on change vraiment de tab
      requestAnimationFrame(function () {
        tab.classList.add('mkt-just-activated');
        setTimeout(function () {
          tab.classList.remove('mkt-just-activated');
        }, 400);
      });
    }, { passive: true });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7) Sparklines / charts : enhanceCharts(container)
  //    Calcule stroke-dasharray sur polylines et tag les containers
  // ─────────────────────────────────────────────────────────────────────────
  function enhanceCharts(scope) {
    if (!scope || reducedMotion() || SLOW_NETWORK) return;
    var svgs = scope.querySelectorAll ? scope.querySelectorAll('svg') : [];
    for (var i = 0; i < svgs.length; i++) {
      var svg = svgs[i];
      var lines = svg.querySelectorAll('polyline, path.spark-line');
      if (lines.length) {
        svg.classList.add('mkt-spark-enter');
        for (var j = 0; j < lines.length; j++) {
          var p = lines[j];
          var len;
          try {
            len = p.getTotalLength ? p.getTotalLength() : 0;
          } catch (e) {
            len = 0;
          }
          if (len > 0 && len < 10000) {
            p.style.setProperty('--mkt-dash-len', Math.ceil(len));
          }
        }
      }
      var bars = svg.querySelectorAll('rect.bar, rect[data-bar]');
      if (bars.length) {
        svg.classList.add('mkt-chart-enter');
        for (var k = 0; k < bars.length; k++) {
          var clamped = k < 20 ? k : 20;
          bars[k].style.setProperty('--mkt-i', clamped);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8) Bootstrap
  // ─────────────────────────────────────────────────────────────────────────
  function init() {
    try {
      observePageSwitches();
      observeContentReRenders();
      attachTapFeedback();
      attachTabPulse();

      // Si la page active a déjà du contenu rendu au boot, stagger immédiat
      var activeContent = document.querySelector('.page.active [id$="-content"], .page.active');
      if (activeContent) {
        applyStagger(activeContent);
        enhanceCharts(activeContent);
      }
    } catch (err) {
      // Skip silencieux : ne casse jamais l'app si on a un soucis
      if (window.console && console.warn) {
        console.warn('[native-motion] init skipped:', err && err.message);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
