/* ═══════════════════════════════════════════════════════════════════
   APPLE DENSITY — Toggle Compact / Cozy / Spacious
   Persist localStorage 'a-density', applique sur :root[data-density].
   Bind boutons [data-density-toggle] button[data-density="..."].
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VALUES = ['compact', 'cozy', 'spacious'];
  var DEFAULT = 'cozy';
  var LS_KEY = 'a-density';

  function current() {
    return document.documentElement.dataset.density || DEFAULT;
  }

  function setDensity(value) {
    if (VALUES.indexOf(value) === -1) value = DEFAULT;
    document.documentElement.dataset.density = value;
    try { localStorage.setItem(LS_KEY, value); } catch (e) {}
    updateButtons(value);
    resizeCharts();
    try {
      document.dispatchEvent(new CustomEvent('apple:density-change', { detail: { value: value } }));
    } catch (e) {}
  }

  function cycleDensity() {
    var c = current();
    var idx = VALUES.indexOf(c);
    var next = VALUES[(idx + 1) % VALUES.length];
    setDensity(next);
  }

  // ─── Boutons ──────────────────────────────────────────────────────
  function bindButtons() {
    var roots = document.querySelectorAll('[data-density-toggle]');
    roots.forEach(function (root) {
      if (root.__appleDensityBound) return;
      root.__appleDensityBound = true;
      var btns = root.querySelectorAll('button[data-density]');
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var v = btn.getAttribute('data-density');
          setDensity(v);
        });
      });
    });
    updateButtons(current());
  }

  function updateButtons(active) {
    var btns = document.querySelectorAll('[data-density-toggle] button[data-density]');
    btns.forEach(function (b) {
      var v = b.getAttribute('data-density');
      if (v === active) {
        b.classList.add('is-active');
        b.setAttribute('aria-pressed', 'true');
      } else {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      }
    });
  }

  // ─── MutationObserver pour rebinder si re-render ─────────────────
  var rebindT = null;
  function watchDom() {
    if (typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function () {
      if (rebindT) return;
      rebindT = setTimeout(function () {
        rebindT = null;
        bindButtons();
      }, 80);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Chart.js resize ──────────────────────────────────────────────
  function resizeCharts() {
    if (typeof window.Chart === 'undefined') return;
    setTimeout(function () {
      try {
        // Chart.js v3/v4 : Chart.instances est un objet { id: instance }
        if (window.Chart.instances) {
          var instances = window.Chart.instances;
          // Peut être Map ou Object
          if (typeof instances.forEach === 'function') {
            instances.forEach(function (inst) { try { inst.resize(); } catch (e) {} });
          } else {
            Object.keys(instances).forEach(function (k) {
              try { instances[k].resize(); } catch (e) {}
            });
          }
        }
        // Fallback : trigger window resize
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
      } catch (e) {}
    }, 200);
  }

  // ─── Boot ─────────────────────────────────────────────────────────
  function boot() {
    var saved = DEFAULT;
    try { saved = localStorage.getItem(LS_KEY) || DEFAULT; } catch (e) {}
    if (VALUES.indexOf(saved) === -1) saved = DEFAULT;
    document.documentElement.dataset.density = saved;

    bindButtons();
    watchDom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─── Public API ───────────────────────────────────────────────────
  window.appleSetDensity = setDensity;
  window.appleCycleDensity = cycleDensity;
  window.appleGetDensity = current;
})();
