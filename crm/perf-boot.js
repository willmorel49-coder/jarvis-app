/* perf-boot.js — Lazy-loading par onglet pour CRM Intégral Pharma
 *
 * Stratégie :
 *  - Données essentielles (clients, pharmacies-geo, sales-detail, client-products,
 *    stock, catalogue-ip, groupements) restent chargées au boot via <script> dans index.html.
 *  - Données lourdes (benchmark-data 3.6 MB, establishments-aggregate 4 MB,
 *    offilog-data 1.7 MB, drakkars-data 3.8 MB, cap3000-data 2.4 MB) ET les
 *    cavaleries d'analyses benchmark-*.js sont chargées à la demande quand l'onglet
 *    correspondant est ouvert, ou en idle après dashboard, ou au hover de l'onglet.
 *
 * Gain estimé : ~15 MB de moins au boot initial.
 */
(function () {
  'use strict';

  var VERSION = '?v=20260603i';

  // Mapping page -> scripts à charger à la demande
  var LAZY_BUNDLES = {
    benchmark: [
      'benchmark-data.js',
      'establishments-aggregate.js',
      'benchmark-multibench.js',
      'benchmark-focus.js',
      'benchmark-manque-a-gagne.js',
      'benchmark-penetration.js',
      'benchmark-laboratoires.js',
      'benchmark-trajectoires.js'
    ],
    // Marketing dépend de BENCHMARK (themeProducts/searchProducts) — sans ça
    // les cartes thèmes affichent "0 produits" tant que benchmark n'est pas
    // chargé par idlePreload (4 s après boot). On force le chargement en
    // entrant sur l'onglet pour garantir des données affichées.
    marketing: [
      'benchmark-data.js'
    ],
    offilog: [
      'offilog-data.js',
      'drakkars-data.js',
      'cap3000-data.js'
    ]
  };

  var loaded = new Set();
  var pending = Object.create(null); // src -> Promise (in-flight)

  function loadScript(src) {
    if (loaded.has(src)) return Promise.resolve();
    if (pending[src]) return pending[src];
    var p = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src + VERSION;
      // async=false pour preserver l'ordre d'execution dans le bundle
      s.async = false;
      s.onload = function () {
        loaded.add(src);
        delete pending[src];
        resolve();
      };
      s.onerror = function (e) {
        delete pending[src];
        console.warn('[perf-boot] échec chargement', src, e);
        reject(e);
      };
      document.head.appendChild(s);
    });
    pending[src] = p;
    return p;
  }

  // Bridge : exposer les `const X = ...` globals sur window
  // (les data files declarent `const OFFILOG = [...]` qui n'est PAS accessible
  //  via window dans certains modules strict)
  function bridgeGlobals() {
    try { if (typeof BENCHMARK    !== 'undefined') window.BENCHMARK    = BENCHMARK;    } catch (e) {}
    try { if (typeof OFFILOG      !== 'undefined') window.OFFILOG      = OFFILOG;      } catch (e) {}
    try { if (typeof DRAKKARS     !== 'undefined') window.DRAKKARS     = DRAKKARS;     } catch (e) {}
    try { if (typeof CAP3000      !== 'undefined') window.CAP3000      = CAP3000;      } catch (e) {}
    try { if (typeof ESTABLISHMENTS !== 'undefined') window.ESTABLISHMENTS = ESTABLISHMENTS; } catch (e) {}
  }

  var bundlePromises = Object.create(null);

  function loadBundle(page) {
    var bundle = LAZY_BUNDLES[page];
    if (!bundle) return Promise.resolve();
    if (bundlePromises[page]) return bundlePromises[page];

    var p = (async function () {
      for (var i = 0; i < bundle.length; i++) {
        try {
          await loadScript(bundle[i]);
        } catch (err) {
          // On continue malgré l'echec d'un script (degraded mode)
        }
      }
      bridgeGlobals();
    })();

    bundlePromises[page] = p;
    return p;
  }

  // Hook sur window.navigate : on attend que le bundle soit chargé AVANT la nav
  function patchNavigate() {
    var orig = window.navigate;
    if (!orig || orig.__perfBootPatched) return;
    var patched = function (page) {
      var args = arguments;
      var self = this;
      if (LAZY_BUNDLES[page]) {
        return loadBundle(page).then(function () {
          return orig.apply(self, args);
        });
      }
      return orig.apply(self, args);
    };
    patched.__perfBootPatched = true;
    window.navigate = patched;
  }

  // window.navigate peut être defini APRES perf-boot.js (app.js defer).
  // On retry tant qu'il n'existe pas, jusqu'à ce que ce soit pret.
  function waitForNavigate() {
    if (typeof window.navigate === 'function') {
      patchNavigate();
      return;
    }
    // Re-tente jusqu'à 30 fois (3 s) puis abandonne
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (typeof window.navigate === 'function') {
        clearInterval(iv);
        patchNavigate();
      } else if (tries > 30) {
        clearInterval(iv);
        console.warn('[perf-boot] window.navigate introuvable après 3s — lazy load via click only');
      }
    }, 100);
  }

  // Preload sur hover/touch des tabs (data-page)
  function attachHoverPreload() {
    var schedule = window.requestIdleCallback
      ? function (fn) { window.requestIdleCallback(fn, { timeout: 1500 }); }
      : function (fn) { setTimeout(fn, 0); };

    document.addEventListener('mouseover', function (e) {
      var tab = e.target && e.target.closest ? e.target.closest('[data-page]') : null;
      if (!tab) return;
      var page = tab.dataset.page;
      if (LAZY_BUNDLES[page] && !bundlePromises[page]) {
        schedule(function () { loadBundle(page); });
      }
    }, { passive: true, capture: true });

    document.addEventListener('touchstart', function (e) {
      var tab = e.target && e.target.closest ? e.target.closest('[data-page]') : null;
      if (!tab) return;
      var page = tab.dataset.page;
      if (LAZY_BUNDLES[page] && !bundlePromises[page]) {
        schedule(function () { loadBundle(page); });
      }
    }, { passive: true, capture: true });
  }

  // Preload en idle (apres dashboard pret) : benchmark d'abord (plus consulté),
  // puis offilog en second.
  function idlePreload() {
    var schedule = window.requestIdleCallback
      ? function (fn, timeout) { window.requestIdleCallback(fn, { timeout: timeout || 4000 }); }
      : function (fn, timeout) { setTimeout(fn, timeout || 3000); };

    schedule(function () { loadBundle('benchmark'); }, 4000);
    schedule(function () { loadBundle('offilog'); }, 8000);
  }

  function init() {
    waitForNavigate();
    attachHoverPreload();
    idlePreload();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API publique pour debug / forçage externe
  window.__perfBoot = {
    loadBundle: loadBundle,
    bundles: LAZY_BUNDLES,
    loaded: loaded
  };
})();
