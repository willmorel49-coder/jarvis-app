/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Motion — couche COMPORTEMENT (pairée avec v2-motion.css)
   Reveal au scroll · count-up des KPI · transition de vue · press subtil.
   Auto-initialisée, namespacée sous window.V2.motion, zéro dépendance.

   Principes : calme, rapide, premium (niveau Apple/Linear). Jamais flashy.
   - N'altère JAMAIS l'innerHTML géré par l'app : ne touche que classes + vars CSS.
   - Idempotente & ré-entrante : l'app remplace l'innerHTML de #v2-root à
     chaque navigation ; on ré-applique proprement sans fuiter d'observers.
   - Respecte prefers-reduced-motion : pas d'anim, contenu visible direct.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var V2 = window.V2;
  if (!V2) return; // garde : pas de V2 → no-op silencieux

  // ── Réglages ──────────────────────────────────────────────────────
  var STAGGER_CAP = 8;     // index de stagger plafonné (les retardataires n'attendent pas)
  var COUNT_MS    = 600;   // durée du count-up
  var REVEAL_SEL  = '.v2-hero, .v2-pil, .v2-kpi, .v2-card'; // blocs de 1er niveau, classes réelles
  var COUNT_SEL   = '.v2-kpi-v.mono, .opso-chip-n.mono';    // chiffres « titres » uniquement

  // prefers-reduced-motion : lu une fois, mais on respecte aussi un changement live
  var RM = false;
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    RM = !!mq.matches;
    var onMq = function (e) { RM = !!e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq); // anciens navigateurs
  } catch (e) {}

  var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };

  // ── IntersectionObserver partagé, créé UNE seule fois ──────────────
  // (on ne le déconnecte jamais : les nœuds retirés du DOM lors d'un
  //  re-render sont lâchés naturellement par l'observer — pas de fuite,
  //  et pas de course entre deux passes qui le recréeraient.)
  var io = null;
  function ensureObserver() {
    if (io || !('IntersectionObserver' in window)) return io;
    io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var en = entries[i];
        if (en.isIntersecting) {
          revealEl(en.target);
          io.unobserve(en.target); // une seule fois
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    return io;
  }

  function revealEl(el) {
    if (!el || el.classList.contains('is-in')) return;
    el.classList.add('is-in');
    countUpWithin(el); // déclenche le count-up des chiffres révélés
  }

  // ── Reveal : marque les blocs, assigne le stagger, observe ──────────
  function passReveal(scope) {
    var els = scope.querySelectorAll(REVEAL_SEL);
    if (!els.length) return;
    var idx = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute('data-reveal')) continue; // déjà traité dans cette vue
      el.setAttribute('data-reveal', '');
      el.style.setProperty('--mo-i', Math.min(idx, STAGGER_CAP));
      idx++;
      if (RM || !io) {
        // reduced-motion ou pas d'IO : visible immédiatement, sans anim
        revealEl(el);
      } else {
        io.observe(el);
      }
    }
  }

  // ── Count-up : parse le nombre affiché (format FR), anime 0→valeur ──
  // Format FR : espaces (normale, fine, insécable) = séparateur de milliers,
  // virgule = décimale ; préfixe/suffixe (€, %, …) préservés ; on RESTAURE
  // la chaîne d'origine exacte à la fin pour ne jamais corrompre le format.
  function parseFr(txt) {
    // sépare préfixe / coeur numérique / suffixe
    var m = txt.match(/^(\D*?)(-?[\d    .,]+)(\D*)$/);
    if (!m) return null;
    var pre = m[1], core = m[2], suf = m[3];
    // retire tous les séparateurs de milliers (espaces sous toutes formes)
    var cleaned = core.replace(/[    ]/g, '');
    // virgule décimale → point ; on ne garde que le 1er point décimal
    var dot = cleaned.lastIndexOf(',');
    if (dot >= 0) {
      cleaned = cleaned.slice(0, dot).replace(/[.,]/g, '') + '.' + cleaned.slice(dot + 1).replace(/[.,]/g, '');
    } else {
      cleaned = cleaned.replace(/\./g, ''); // points = milliers ici (rare), on enlève
    }
    var val = parseFloat(cleaned);
    if (!isFinite(val)) return null;
    var decimals = dot >= 0 ? cleaned.split('.')[1].length : 0;
    return { val: val, pre: pre, suf: suf, decimals: decimals };
  }

  // reformate une valeur intermédiaire en gardant l'allure FR + préfixe/suffixe
  function fmtFr(v, decimals, pre, suf) {
    var s;
    try { s = v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }
    catch (e) { s = (decimals ? v.toFixed(decimals).replace('.', ',') : String(Math.round(v))); }
    return pre + s + suf;
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); } // cubic ease-out, calme

  function animateNumber(el) {
    if (RM) return;
    if (el.getAttribute('data-mo-counted') === '1') return;
    var original = el.textContent;
    var p = parseFr(original);
    if (!p) { el.setAttribute('data-mo-counted', '1'); return; } // non numérique → on laisse tel quel
    el.setAttribute('data-mo-counted', '1');
    var start = 0, t0 = 0;
    function step(ts) {
      if (!t0) t0 = ts;
      var t = Math.min((ts - t0) / COUNT_MS, 1);
      var cur = start + (p.val - start) * easeOut(t);
      if (t < 1) {
        el.textContent = fmtFr(cur, p.decimals, p.pre, p.suf);
        raf(step);
      } else {
        el.textContent = original; // RESTAURE la chaîne exacte (format intact)
      }
    }
    raf(step);
  }

  // count-up de tous les chiffres « titres » contenus dans un bloc révélé
  function countUpWithin(scope) {
    if (RM) return;
    var nums = scope.querySelectorAll(COUNT_SEL);
    for (var i = 0; i < nums.length; i++) animateNumber(nums[i]);
  }

  // ── Transition de vue : retrigger .mo-view-in sur le wrapper ────────
  function viewTransition(scope) {
    if (RM) return;
    var wrap = scope.querySelector('.v2-wrap') || scope;
    var cls = (window.__navDir === 'back') ? 'mo-view-back' : 'mo-view-in';
    wrap.classList.remove('mo-view-in', 'mo-view-back');
    // force reflow puis re-add pour relancer l'animation CSS
    void wrap.offsetWidth;
    wrap.classList.add(cls);
  }

  // ── Press / ripple subtil sur .v2-btn (délégué, une seule fois) ─────
  var pressBound = false;
  function bindPress() {
    if (pressBound || RM) return;
    pressBound = true;
    document.addEventListener('pointerdown', function (e) {
      try {
        var btn = e.target && e.target.closest ? e.target.closest('.v2-btn') : null;
        if (!btn) return;
        btn.classList.remove('mo-press');
        void btn.offsetWidth;
        btn.classList.add('mo-press');
      } catch (err) {}
    }, true); // capture : n'interfère pas avec les handlers onclick existants
  }

  // ── Passe complète post-render ──────────────────────────────────────
  function pass() {
    try {
      var root = document.getElementById('v2-root');
      if (!root) return;
      ensureObserver(); // créé une seule fois ; jamais déconnecté
      viewTransition(root);
      passReveal(root);
      // les blocs déjà dans le viewport au render se révèlent à la frame suivante
      // (IntersectionObserver émet de façon asynchrone — géré nativement).
    } catch (e) { /* une passe ne doit jamais bloquer l'app */ }
  }

  // ── Hook : on enveloppe V2.render (garde l'original, puis passe) ────
  function wrapRender() {
    if (typeof V2.render !== 'function' || V2.render.__moWrapped) return false;
    var orig = V2.render;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      raf(pass); // après que l'app ait écrit son innerHTML
      return r;
    };
    wrapped.__moWrapped = true;
    V2.render = wrapped;
    return true;
  }

  // ── Fallback robuste : MutationObserver sur #v2-root ────────────────
  // Si V2.render n'est pas encore défini au boot, ou si une vue est rendue
  // hors render (ex. renderLogin), on rattrape via les mutations du conteneur.
  function watchRoot() {
    if (!('MutationObserver' in window)) return;
    var root = document.getElementById('v2-root');
    if (!root) return;
    var scheduled = false;
    var mo = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      raf(function () { scheduled = false; pass(); });
    });
    try { mo.observe(root, { childList: true }); } catch (e) {}
  }

  // ── Bootstrap ───────────────────────────────────────────────────────
  function start() {
    bindPress();
    // tente d'envelopper render ; si pas prêt, réessaie quelques frames
    var tries = 0;
    (function tryWrap() {
      if (wrapRender() || tries++ > 30) { watchRoot(); raf(pass); return; }
      raf(tryWrap);
    })();
  }

  // namespace public minimal (pas d'autres globals)
  V2.motion = { pass: pass, refresh: pass };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
