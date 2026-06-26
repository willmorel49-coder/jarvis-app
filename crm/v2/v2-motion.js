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
  var INSP_SEL    = '.cat-insp.open, .off-insp.open';       // panneaux inspecteur glissés

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

  // ── Styles locaux du module (injectés une fois) ────────────────────
  // On ne (re)définit AUCUN token global ici : on aligne seulement la
  // grammaire de mouvement de ce module sur la durée canonique --mo-dur
  // (300ms) et on fournit l'état « above-the-fold » sans transition.
  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css = [
      /* Stagger reveal ramené à ~30ms (cohérent --mo-dur 300ms) */
      '[data-reveal]{transition-delay:calc(var(--mo-i, 0) * 30ms)}',
      '[data-reveal] .v2-kpi-v{transition-delay:calc(var(--mo-i, 0) * 30ms + 50ms)}',
      /* Above-the-fold : déjà visible au render → pas de double-anim     */
      /* (reveal + mo-view-in). On force l'état final SANS transition.    */
      '[data-reveal].mo-instant{transition:none !important;transition-delay:0s !important;opacity:1;transform:none}',
      '[data-reveal].mo-instant .v2-kpi-v{transition:none !important;transition-delay:0s !important}',
      /* Stagger du contenu d\'un panneau inspecteur une fois glissé.     */
      /* Le panneau garde sa propre translateX ; on n\'anime QUE le       */
      /* contenu interne (head/body/cta) en transform/opacity.           */
      '.cat-insp [data-reveal],.off-insp [data-reveal]{transform:translateY(6px)}',
      '.cat-insp [data-reveal].is-in,.off-insp [data-reveal].is-in{transform:translateY(0)}'
    ].join('');
    try {
      var tag = document.createElement('style');
      tag.setAttribute('data-mo', 'motion-js');
      tag.appendChild(document.createTextNode(css));
      (document.head || document.documentElement).appendChild(tag);
    } catch (e) { stylesInjected = false; }
  }

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

  // révèle SANS transition (above-the-fold) : évite la double-anim
  // reveal + mo-view-in à l'ouverture d'une vue. Le bloc atterrit déjà
  // dans son état final ; seul le wrapper joue mo-view-in.
  function revealInstant(el) {
    if (!el || el.classList.contains('is-in')) return;
    el.classList.add('mo-instant');
    el.classList.add('is-in');
    countUpWithin(el);
  }

  // un bloc est-il (au moins en partie) dans le viewport au moment du render ?
  function inViewport(el) {
    try {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var vw = window.innerWidth || document.documentElement.clientWidth;
      return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
    } catch (e) { return true; } // en cas de doute : révéler tout de suite
  }

  // ── Reveal : marque les blocs, assigne le stagger, observe ──────────
  // immediate=true au 1er passage post-render : les blocs déjà visibles
  // se révèlent sans transition ; seuls les blocs hors-écran restent
  // animés au scroll (via l'IntersectionObserver).
  function passReveal(scope, immediate) {
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
      } else if (immediate && inViewport(el)) {
        // above-the-fold : déjà à l'écran → état final direct, pas de reveal
        revealInstant(el);
      } else {
        io.observe(el); // hors-écran : reveal animé au scroll
      }
    }
  }

  // ── Stagger du contenu des panneaux inspecteur (cat-insp / off-insp) ─
  // Continuité spatiale : une fois le panneau glissé, son head/body/CTA
  // se posent en cascade (--mo-i 0/1/2). Tagué une seule fois par panneau.
  function passInspector(scope) {
    if (RM || !io) return;
    var panels = scope.querySelectorAll(INSP_SEL);
    for (var p = 0; p < panels.length; p++) {
      var panel = panels[p];
      if (panel.getAttribute('data-mo-insp') === '1') continue;
      panel.setAttribute('data-mo-insp', '1');
      var pre = panel.classList.contains('cat-insp') ? 'cat' : 'off';
      var parts = [
        panel.querySelector('.' + pre + '-insp-head'),
        panel.querySelector('.' + pre + '-insp-body'),
        panel.querySelector('.' + pre + '-insp-cta')
      ];
      var staged = [];
      var k = 0;
      for (var j = 0; j < parts.length; j++) {
        var part = parts[j];
        if (!part || part.hasAttribute('data-reveal')) continue;
        part.setAttribute('data-reveal', ''); // état caché (opacity/translateY)
        part.style.setProperty('--mo-i', k++);
        staged.push(part);
      }
      if (!staged.length) continue;
      void panel.offsetWidth; // fige l'état initial avant de jouer la cascade
      raf(function (list) {
        return function () {
          for (var n = 0; n < list.length; n++) revealEl(list[n]);
        };
      }(staged));
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
  var __moLastRoute = null;
  function viewTransition(scope) {
    if (RM) return;
    // Ne glisser que sur un vrai changement d'écran (pas un re-render interne : filtre, onglet, repli)
    var rt = V2.route ? (V2.route.name + '/' + (V2.route.param || '')) : '';
    if (rt === __moLastRoute) return;
    __moLastRoute = rt;
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
      // 1er passage post-render : les blocs above-the-fold se révèlent
      // sans transition (pas de double-anim avec mo-view-in) ; les blocs
      // hors-écran restent animés au scroll via l'IntersectionObserver.
      passReveal(root, true);
      passInspector(root); // cascade interne des panneaux inspecteur glissés
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
    injectStyles();
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
