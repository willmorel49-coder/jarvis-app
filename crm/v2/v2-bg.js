/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Fond de l'ACCUEIL — « Spotlight curseur » (choix Will, modèle 06)
   Une grande lueur radiale bleu #0050E6 / orange #F39A1B sur fond clair
   #FBFCFE qui SUIT le curseur en douceur (CSS pur, lissé en RAF). Léger,
   « web app » (façon 21st.dev/Linear), pas un ciel. Monté uniquement sur
   l'accueil, s'auto-nettoie en quittant / si l'onglet est masqué. Repli
   statique centré si prefers-reduced-motion ou pas de souris (mobile).
   100% client, zéro dépendance.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var el = null, raf = null;
  var mx = 50, my = 42, tx = 50, ty = 42;   // en %
  var REDUCED = false, HOVER = true;
  try { REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try { HOVER = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}

  var BG =
    'radial-gradient(440px 440px at var(--mx) var(--my),rgba(0,80,230,.22) 0%,rgba(0,80,230,.11) 34%,rgba(0,80,230,0) 70%),' +
    'radial-gradient(780px 780px at var(--mx) var(--my),rgba(243,154,27,.12) 40%,rgba(243,154,27,.045) 66%,rgba(243,154,27,0) 82%),' +
    'radial-gradient(1150px 1150px at var(--mx) var(--my),rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 55%),' +
    'var(--paper,#FBFCFE)';

  function apply() { if (el) { el.style.setProperty('--mx', mx.toFixed(2) + '%'); el.style.setProperty('--my', my.toFixed(2) + '%'); } }
  function onMove(e) {
    var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    tx = (p.clientX / window.innerWidth) * 100;
    ty = (p.clientY / window.innerHeight) * 100;
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop() {
    if (!V2.route || V2.route.name !== 'home') { cleanup(); return; }
    if (document.hidden) { raf = requestAnimationFrame(loop); return; }
    mx += (tx - mx) * 0.12; my += (ty - my) * 0.12;
    apply();
    if (Math.abs(tx - mx) > 0.15 || Math.abs(ty - my) > 0.15) raf = requestAnimationFrame(loop);
    else raf = null;
  }
  function cleanup() {
    if (raf) cancelAnimationFrame(raf); raf = null;
    window.removeEventListener('pointermove', onMove);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
  }

  V2.mountHomeBg = function (root) {
    // le contenu de l'accueil passe au-dessus du fond
    var wrap = root && root.querySelector('.v2-wrap'); if (wrap) { wrap.style.position = 'relative'; wrap.style.zIndex = '1'; }
    if (document.getElementById('v2-bg')) return;   // déjà monté
    el = document.createElement('div'); el.id = 'v2-bg'; el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;background:' + BG;
    el.style.setProperty('--mx', '50%'); el.style.setProperty('--my', '42%');
    document.body.insertBefore(el, document.body.firstChild);
    if (REDUCED || !HOVER) { mx = tx = 50; my = ty = 42; apply(); return; }  // lueur fixe centrée
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
  };

  function hideIfNotHome() { if (V2.route && V2.route.name !== 'home') cleanup(); }

  // Monkey-patch : monte le fond après le rendu de l'accueil (sans toucher v2-app.js)
  function hook() {
    if (!V2.pages || !V2.pages.home || V2.pages.home._bgHooked) return false;
    var orig = V2.pages.home.render;
    V2.pages.home.render = function (root) { orig.call(this, root); try { V2.mountHomeBg(root); } catch (e) {} };
    V2.pages.home._bgHooked = true;
    if (V2.render && !V2.render._bgWrapped) {
      var r = V2.render;
      V2.render = function () { r.apply(this, arguments); try { hideIfNotHome(); } catch (e) {} };
      V2.render._bgWrapped = true;
    }
    return true;
  }
  if (!hook()) { var n = 0, iv = setInterval(function () { if (hook() || ++n > 40) clearInterval(iv); }, 100); }
})();
