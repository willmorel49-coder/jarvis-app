/* ------------------------------------------------------------------
   INTÉGRAL PHARMA — "Minuit & Cuivre" — effect stack
   Signature 3D-rotate reused from Codrops "RotatingOnScrollAnimations"
   (initRotateOnScroll), extended with: Lenis smooth-scroll wired to
   ScrollTrigger, page-load intro curtain, custom cursor, split-line
   masked heading reveals, a pinned scroll-scrub kinetic band, hero
   parallax (mouse + scroll), magnetic CTAs, card tilt, animated
   counters, and brand-color glow accents.
   Safe on Safari: CSS 3D transforms only, no WebGL, no clip-text.
------------------------------------------------------------------ */
(function () {
  'use strict';

  var doc = document.documentElement;

  // If the engine is missing, reveal everything and bail out cleanly.
  if (!window.gsap) {
    doc.classList.add('fx-fail');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (window.ScrambleTextPlugin) gsap.registerPlugin(ScrambleTextPlugin);

  var REDUCE  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DESKTOP = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches;

  var preloadImages = function (selector) {
    return new Promise(function (resolve) {
      if (!window.imagesLoaded) { resolve(); return; }
      imagesLoaded(document.querySelectorAll(selector), { background: true }, resolve);
    });
  };

  /* ---------- Intro curtain ---------- */
  function playIntro() {
    var intro = document.getElementById('intro');
    if (!intro || REDUCE) { if (intro) intro.remove(); return Promise.resolve(); }
    return new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (done) return; done = true; resolve(); };
      var tl = gsap.timeline({ onComplete: function () { intro.remove(); finish(); } });
      tl.set(intro, { autoAlpha: 1 })
        .from('#intro .intro__mark', { scale: 0.6, autoAlpha: 0, duration: 0.55, ease: 'power3.out' })
        .from('#intro .intro__word span', { yPercent: 120, duration: 0.65, stagger: 0.06, ease: 'power4.out' }, '-=0.2')
        .from('#intro .intro__bar i', { scaleX: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out' }, '-=0.35')
        .to('#intro .intro__inner', { autoAlpha: 0, duration: 0.35, delay: 0.2 })
        .to('#intro .intro__panel', {
          yPercent: -100, duration: 0.75, stagger: 0.07, ease: 'power4.inOut',
          onStart: finish   // let the page reveal as the curtain lifts
        }, '-=0.1');
    });
  }

  /* ---------- Split-line masked reveals (every display heading) ---------- */
  function splitHeading(el) {
    var lines = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = lines.map(function (l) {
      return '<span class="ln"><span class="ln__i">' + l + '</span></span>';
    }).join('');
  }
  function initHeadings() {
    gsap.utils.toArray('[data-split]').forEach(function (el) {
      splitHeading(el);
      el.style.visibility = 'visible';
      var inners = el.querySelectorAll('.ln__i');
      if (REDUCE) { gsap.set(inners, { yPercent: 0 }); return; }
      gsap.set(inners, { yPercent: 110 });
      gsap.to(inners, {
        yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.12,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true }
      });
    });
  }

  /* ---------- Fade-up reveals ---------- */
  function initReveals() {
    gsap.utils.toArray('[data-fade]').forEach(function (el) {
      if (REDUCE) { gsap.set(el, { opacity: 1, y: 0 }); return; }
      gsap.fromTo(el, { y: 26, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  }

  /* ---------- Signature: rotate-on-scroll (reused Codrops mechanic) ---------- */
  function initRotateOnScroll() {
    if (REDUCE) return;
    gsap.utils.toArray('[data-rotate]').forEach(function (item) {
      var soft = item.dataset.rotate === 'soft';
      var rotationX = soft ? gsap.utils.random(16, 26) : gsap.utils.random(55, 85);
      var rotationY = gsap.utils.random(-14, 14);
      var rotationZ = soft ? gsap.utils.random(-6, 6) : gsap.utils.random(-14, 14);
      var setZ = gsap.quickSetter(item, 'z', 'px');
      gsap.fromTo(item,
        { rotationX: rotationX, rotationY: rotationY, rotationZ: rotationZ },
        {
          rotationX: -rotationX, rotationY: -rotationY, rotationZ: -rotationZ, ease: 'none',
          scrollTrigger: {
            trigger: item, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true,
            onUpdate: function (self) { setZ(Math.sin(self.progress * Math.PI) * (soft ? -24 : -46)); }
          }
        }
      );
    });
  }

  /* ---------- Flowing sine offset for the réseau gallery ---------- */
  function positionGalleryItems() {
    var items = gsap.utils.toArray('.rgallery__item');
    var amplitude = window.innerWidth * (window.innerWidth < 720 ? 0.11 : 0.18);
    items.forEach(function (item, i) { gsap.set(item, { x: Math.sin(i * 0.7) * amplitude }); });
  }

  /* ---------- Kinetic marquee band — pinned scroll-scrub on desktop ---------- */
  function initKinetic() {
    var wrap = document.querySelector('.kinetic');
    if (!wrap) return;
    var rows = wrap.querySelectorAll('.mark__inner');
    if (REDUCE) return;

    if (DESKTOP && rows.length >= 2) {
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrap, start: 'top top', end: '+=120%',
          scrub: 0.6, pin: true, anticipatePin: 1, invalidateOnRefresh: true
        }
      });
      tl.fromTo(rows[0], { x: '6vw' },  { x: '-55%', ease: 'none' }, 0)
        .fromTo(rows[1], { x: '-45%' }, { x: '8vw',  ease: 'none' }, 0);
      return;
    }

    // Fallback (mobile / no-pin): simple opposing scrub, no pin.
    wrap.querySelectorAll('.mark').forEach(function (m) {
      var inner = m.querySelector('.mark__inner');
      var rev = m.dataset.dir === 'rev';
      gsap.fromTo(inner,
        { x: rev ? '-30%' : '8vw' },
        { x: rev ? '8vw' : '-40%', ease: 'none',
          scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true } }
      );
    });
  }

  /* ---------- Animated counters (9, 100, +14 000) ---------- */
  function initCountUp() {
    gsap.utils.toArray('[data-count]').forEach(function (el) {
      var target = parseInt(el.dataset.count, 10);
      var render = function (v) { el.textContent = Math.round(v).toLocaleString('fr-FR'); };
      if (REDUCE) { render(target); return; }
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: function () {
          var o = { v: 0 };
          gsap.to(o, { v: target, duration: 1.8, ease: 'power2.out', onUpdate: function () { render(o.v); } });
        }
      });
    });
  }

  /* ---------- Hero parallax (scroll + mouse) ---------- */
  function initHeroParallax() {
    if (REDUCE) return;
    var media = document.querySelector('.hero__media');
    gsap.to('.hero__copy', { yPercent: -8, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    if (media) {
      gsap.to(media, { yPercent: 10, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    }
    if (!DESKTOP || !media) return;

    var mx = gsap.quickTo(media, 'x', { duration: 0.6, ease: 'power3' });
    var my = gsap.quickTo(media, 'y', { duration: 0.6, ease: 'power3' });
    var orbs = [].map.call(document.querySelectorAll('.hero [data-orb]'), function (o) {
      return {
        k: parseFloat(o.dataset.orb) || 1,
        dx: gsap.quickTo(o, 'x', { duration: 1, ease: 'power3' }),
        dy: gsap.quickTo(o, 'y', { duration: 1, ease: 'power3' })
      };
    });
    window.addEventListener('pointermove', function (e) {
      var rx = e.clientX / window.innerWidth - 0.5;
      var ry = e.clientY / window.innerHeight - 0.5;
      mx(rx * 22); my(ry * 16);
      orbs.forEach(function (o) { o.dx(rx * 44 * o.k); o.dy(ry * 44 * o.k); });
    });
  }

  /* ---------- Magnetic CTAs ---------- */
  function initMagnetic() {
    if (!DESKTOP || REDUCE) return;
    gsap.utils.toArray('[data-magnetic]').forEach(function (btn) {
      var xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
      var yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.4);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      btn.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }

  /* ---------- Card tilt (pointer) ---------- */
  function initTilt() {
    if (!DESKTOP || REDUCE) return;
    gsap.utils.toArray('[data-tilt]').forEach(function (card) {
      var rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3' });
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * 10); rx(-py * 10);
      });
      card.addEventListener('pointerleave', function () { rx(0); ry(0); });
    });
  }

  /* ---------- Custom cursor (desktop only) ---------- */
  function initCursor() {
    if (!DESKTOP) return;
    var ring = document.querySelector('.cursor__ring');
    var dot = document.querySelector('.cursor__dot');
    var label = document.querySelector('.cursor__label');
    if (!ring || !dot) return;
    document.body.classList.add('has-cursor');

    var rx = gsap.quickTo(ring, 'x', { duration: 0.32, ease: 'power3' });
    var ry = gsap.quickTo(ring, 'y', { duration: 0.32, ease: 'power3' });
    var dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power2' });
    var dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power2' });
    var lx = gsap.quickTo(label, 'x', { duration: 0.28, ease: 'power3' });
    var ly = gsap.quickTo(label, 'y', { duration: 0.28, ease: 'power3' });

    window.addEventListener('pointermove', function (e) {
      rx(e.clientX); ry(e.clientY);
      dx(e.clientX); dy(e.clientY);
      lx(e.clientX); ly(e.clientY);
    });

    var targets = document.querySelectorAll('a, button, [data-cursor], .rgallery__item, .pill');
    [].forEach.call(targets, function (el) {
      el.addEventListener('pointerenter', function () {
        document.body.classList.add('cursor-hover');
        var lbl = el.getAttribute('data-cursor');
        if (lbl && label) { label.textContent = lbl; document.body.classList.add('cursor-labeled'); }
      });
      el.addEventListener('pointerleave', function () {
        document.body.classList.remove('cursor-hover', 'cursor-labeled');
      });
    });
  }

  /* ---------- Optional scramble flourish on the hero eyebrow ---------- */
  function scrambleEyebrow() {
    if (REDUCE || !window.ScrambleTextPlugin) return;
    var eb = document.querySelector('.hero .eyebrow');
    if (!eb) return;
    var text = eb.textContent;
    gsap.to(eb, { duration: 1.1, ease: 'none', scrambleText: { text: text, chars: 'upperCase', speed: 0.4 } });
  }

  /* ---------- Boot ---------- */
  function boot() {
    try {
      gsap.ticker.lagSmoothing(0);

      if (!REDUCE && window.Lenis) {
        var lenis = new Lenis({ lerp: 0.1 });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      }

      initHeadings();
      initReveals();
      initRotateOnScroll();
      positionGalleryItems();
      initKinetic();
      initCountUp();
      initHeroParallax();
      initMagnetic();
      initTilt();
      initCursor();
      scrambleEyebrow();

      window.addEventListener('resize', function () {
        positionGalleryItems();
        ScrollTrigger.refresh();
      });
      ScrollTrigger.refresh();
    } catch (err) {
      doc.classList.add('fx-fail');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Safety net: if something stalls, reveal everything.
    var fail = setTimeout(function () { doc.classList.add('fx-fail'); }, 4500);
    preloadImages('.rgallery__item, .hero__photo').then(function () {
      return playIntro();
    }).then(function () {
      clearTimeout(fail);
      boot();
    })['catch'](function () {
      clearTimeout(fail);
      doc.classList.add('fx-fail');
    });
  });
})();
