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
  var COUNT_SEL   = '.v2-kpi-v.mono, .opso-chip-n.mono, [data-count]';    // chiffres « titres » + opt-in générique [data-count]
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
      /* Stagger reveal ~34ms (cohérent --mo-dur 300ms + base v2-motion.css) */
      '[data-reveal]{transition-delay:calc(var(--mo-i, 0) * 34ms)}',
      '[data-reveal] .v2-kpi-v{transition-delay:calc(var(--mo-i, 0) * 34ms + 60ms)}',
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

    // Ripple positionné au point de contact (boutons, tuiles, onglets, chips) — transform/opacity, RM-safe
    document.addEventListener('pointerdown', function (e) {
      if (RM) return;
      try {
        var host = e.target && e.target.closest ? e.target.closest('.v2-btn,.v2-pil,.ph-vtab,.grp-tab,.v2-seg,.v2-rchip') : null;
        if (!host) return;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        host.classList.add('mo-rippling');
        var r = host.getBoundingClientRect(), size = Math.max(r.width, r.height) * 1.1;
        var ink = document.createElement('span');
        ink.className = 'mo-ripple';
        ink.style.width = ink.style.height = size + 'px';
        ink.style.left = (e.clientX - r.left - size / 2) + 'px';
        ink.style.top = (e.clientY - r.top - size / 2) + 'px';
        host.appendChild(ink);
        ink.addEventListener('animationend', function () { if (ink.parentNode) ink.parentNode.removeChild(ink); });
      } catch (err) {}
    }, true);
  }

  // ── Hover magnétique subtil sur .v2-btn (délégué, une seule fois) ───
  // Le bouton « penche » de quelques px vers le curseur puis revient au
  // repos avec un rattrapage ressort (courbe --ease en CSS). Amplitude
  // minuscule → premium, jamais gadget. RM-safe, coarse-pointer-safe,
  // et sans re-layout (transform pur piloté par variables CSS).
  var MAG_MAX = 5;          // décalage max en px (sobre)
  var magBound = false;
  function bindMagnetic() {
    if (magBound || RM) return;
    // pas de magnétisme sur écrans tactiles (pas de survol pertinent)
    try {
      if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    } catch (e) {}
    magBound = true;
    var cur = null, ticking = false, lx = 0, ly = 0;

    function apply() {
      ticking = false;
      if (!cur) return;
      cur.style.setProperty('--mo-mx', lx.toFixed(2) + 'px');
      cur.style.setProperty('--mo-my', ly.toFixed(2) + 'px');
    }
    function reset(el) {
      if (!el) return;
      el.classList.remove('mo-mag-live');
      el.style.setProperty('--mo-mx', '0px');
      el.style.setProperty('--mo-my', '0px');
    }

    document.addEventListener('pointermove', function (e) {
      if (RM || e.pointerType === 'touch') return;
      var btn = e.target && e.target.closest ? e.target.closest('.v2-btn') : null;
      if (btn !== cur) {
        if (cur) reset(cur);      // on a quitté l'ancien bouton
        cur = btn;
        if (cur) { cur.classList.add('mo-mag', 'mo-mag-live'); }
      }
      if (!cur) return;
      try {
        var r = cur.getBoundingClientRect();
        // vecteur (curseur → centre), normalisé puis borné à MAG_MAX
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        lx = Math.max(-MAG_MAX, Math.min(MAG_MAX, dx * 0.35));
        ly = Math.max(-MAG_MAX, Math.min(MAG_MAX, dy * 0.35));
      } catch (err) { return; }
      if (!ticking) { ticking = true; raf(apply); }
    }, true);

    // sortie : rattrapage ressort vers 0 (retire la classe -live → courbe --ease)
    document.addEventListener('pointerleave', function () {
      if (cur) { reset(cur); cur = null; }
    }, true);
    // filet : au relâchement/annulation, on relâche aussi l'attraction
    document.addEventListener('pointerup', function () {
      if (cur) { cur.classList.remove('mo-mag-live'); reset(cur); cur = null; }
    }, true);
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
      // count-up des chiffres opt-in [data-count] hors blocs reveal (ex. KPIs fiche officine)
      try { var lc = root.querySelectorAll('[data-count]'); for (var i = 0; i < lc.length; i++) { if (RM) break; if (inViewport(lc[i])) animateNumber(lc[i]); } } catch (e2) {}
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
    bindMagnetic();
    // tente d'envelopper render ; si pas prêt, réessaie quelques frames
    var tries = 0;
    (function tryWrap() {
      if (wrapRender() || tries++ > 30) { watchRoot(); raf(pass); return; }
      raf(tryWrap);
    })();
  }

  // ══════════════════════════════════════════════════════════════════
  // API PUBLIQUE « façon Framer Motion » (100% vanilla, WAAPI) — à la
  // disposition de toutes les pages via V2.motion.* . Respecte TOUJOURS
  // prefers-reduced-motion (RM) : en mode réduit on pose l'état final,
  // sans animation. Zéro dépendance, hors-ligne.
  // ══════════════════════════════════════════════════════════════════
  var EASE_OUT    = 'cubic-bezier(.32,.72,0,1)';      // décélération franche (= --mo-ease-in)
  var EASE_SOFT   = 'cubic-bezier(.33,.02,0,.98)';    // couleur/opacité douce (= --mo-ease-soft)
  var EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)';   // ressort léger avec dépassement (pop)

  function canWAAPI(el) { return el && typeof el.animate === 'function'; }

  // animate(el, keyframes, opts) → Animation|null. Wrapper WAAPI + RM-safe.
  // opts: {duration=300, delay=0, easing, fill='both', to:{styles état final}, onfinish}
  function moAnimate(el, keyframes, opts) {
    opts = opts || {};
    if (!el) return null;
    if (RM || !canWAAPI(el)) {
      if (opts.to) { for (var k in opts.to) { try { el.style[k] = opts.to[k]; } catch (e) {} } }
      if (typeof opts.onfinish === 'function') { try { opts.onfinish(); } catch (e2) {} }
      return null;
    }
    var a = el.animate(keyframes, {
      duration: opts.duration != null ? opts.duration : 300,
      delay: opts.delay || 0,
      easing: opts.easing || EASE_OUT,
      fill: opts.fill || 'both'
    });
    if (typeof opts.onfinish === 'function') a.addEventListener('finish', opts.onfinish);
    return a;
  }

  // enter(el, opts) : apparition douce (fondu + glisse depuis le bas)
  function moEnter(el, opts) {
    opts = opts || {};
    var dy = opts.y != null ? opts.y : 8;
    return moAnimate(el, [
      { opacity: 0, transform: 'translateY(' + dy + 'px)' },
      { opacity: 1, transform: 'none' }
    ], { duration: opts.duration || 320, delay: opts.delay || 0, easing: opts.easing || EASE_OUT, to: { opacity: '1', transform: 'none' } });
  }

  // stagger(els, opts) : entrée en cascade (step ms entre chaque, plafonné)
  function moStagger(els, opts) {
    opts = opts || {};
    var step = opts.step != null ? opts.step : 40;
    var cap = opts.cap != null ? opts.cap : 12;
    var list = (els && els.length != null) ? els : (els ? [els] : []);
    for (var i = 0; i < list.length; i++) {
      moEnter(list[i], { delay: (opts.delay || 0) + Math.min(i, cap) * step, y: opts.y, duration: opts.duration, easing: opts.easing });
    }
    return list.length;
  }

  // inView(el, cb, opts) : déclenche cb UNE fois quand el entre à l'écran
  function moInView(el, cb, opts) {
    if (!el || typeof cb !== 'function') return function () {};
    if (RM || !('IntersectionObserver' in window)) { try { cb(el); } catch (e) {} return function () {}; }
    opts = opts || {};
    var o = new IntersectionObserver(function (ents) {
      for (var i = 0; i < ents.length; i++) { if (ents[i].isIntersecting) { try { cb(el); } catch (e) {} o.disconnect(); break; } }
    }, { rootMargin: opts.rootMargin || '0px 0px -8% 0px', threshold: opts.threshold != null ? opts.threshold : 0.05 });
    o.observe(el);
    return function () { try { o.disconnect(); } catch (e) {} };
  }

  // layout(container, opts) : FLIP — anime en douceur le repositionnement des
  // enfants entre deux états (filtre/tri/ajout). Capture l'état, puis .after()
  // après mutation du DOM. opts:{selector, duration=340}
  function moLayout(container, opts) {
    opts = opts || {};
    if (!container) return { after: function () {} };
    var sel = opts.selector || null;
    function kids() { return Array.prototype.slice.call(sel ? container.querySelectorAll(sel) : container.children); }
    var first = [];
    kids().forEach(function (c) { first.push([c, c.getBoundingClientRect()]); });
    function firstOf(c) { for (var i = 0; i < first.length; i++) if (first[i][0] === c) return first[i][1]; return null; }
    return {
      after: function () {
        if (RM) return;
        kids().forEach(function (c) {
          var f = firstOf(c);
          if (!f) { moEnter(c, { y: 6, duration: 260 }); return; }
          if (!canWAAPI(c)) return;
          var l = c.getBoundingClientRect();
          var dx = f.left - l.left, dy = f.top - l.top;
          if (!dx && !dy) return;
          c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
            { duration: opts.duration || 340, easing: EASE_OUT });
        });
      }
    };
  }

  // recordThen(container, mutateFn, opts) : capture → mutation → FLIP, en un appel
  function moRecordThen(container, mutateFn, opts) {
    var l = moLayout(container, opts);
    if (typeof mutateFn === 'function') { try { mutateFn(); } catch (e) {} }
    raf(function () { l.after(); });
  }

  // namespace public « façon Framer Motion » (pas d'autres globals)
  V2.motion = {
    pass: pass, refresh: pass,
    animate: moAnimate, enter: moEnter, stagger: moStagger,
    inView: moInView, layout: moLayout, recordThen: moRecordThen,
    countUp: function (el) { try { if (!RM) animateNumber(el); } catch (e) {} },
    magnetic: function (el) { if (el && el.classList) el.classList.add('mo-mag'); return el; },
    reduced: function () { return RM; },
    ease: { out: EASE_OUT, soft: EASE_SOFT, spring: EASE_SPRING }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
