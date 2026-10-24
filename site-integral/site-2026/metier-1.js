/* ═══════════════════════════════════════════════════════════════════════════════
   MÉTIER · socle commun des trois versions (fabriqué par animation/fabrique.py).
   Les pictos de la section #metier, des métiers (« Nous rejoindre ») et les sceaux
   des distinctions (« Notre mission ») sont les dessins D'ORIGINE : on les découpe en
   traits (pour pouvoir les tracer) et on leur ajoute UN geste orange, jamais un autre dessin.
   Vanilla, aucune librairie. Sans script : la page actuelle. Mouvement réduit : état final.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var R = document.documentElement;
  if (!R.classList.contains("js")) return;
  var NS = "http://www.w3.org/2000/svg";
  var MT = window.MT = { doux: window.matchMedia("(prefers-reduced-motion: reduce)").matches };
  var clamp = MT.clamp = function(x, a, b){ return Math.min(b, Math.max(a, x)); };
  function mk(tag, at){ var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); return e; }
  MT.mk = mk;

  /* le dessin d'origine, découpé en traits (un « M » = un trait) ; l'apparence est identique */
  MT.split = function(svg){
    if (svg.__mt) return svg.querySelector(".mt-b");
    var g = mk("g", { "class": "mt-b" }), k = 0;
    [].slice.call(svg.children).forEach(function(n, io){
      if (n.tagName === "path"){
        n.getAttribute("d").split(/(?=M)/).forEach(function(d){
          var p = mk("path", { d: d, pathLength: 1, "class": "sp", "data-o": io });
          p.style.setProperty("--k", k++); g.appendChild(p);
        });
      } else {
        n.setAttribute("pathLength", 1); n.setAttribute("class", "sp"); n.setAttribute("data-o", io);
        n.style.setProperty("--k", k++); g.appendChild(n);
      }
    });
    svg.textContent = ""; svg.appendChild(g); svg.__mt = k;
    return g;
  };

  /* le geste orange propre à chacune des quatre étapes (coordonnées du picto, 56 × 56) */
  MT.O = [
    '<path class="gs" pathLength="1" style="--g:0" d="M21 21h14"/><path class="gs" pathLength="1" style="--g:1" d="M21 27.5h14"/>' +
    '<path class="gs" pathLength="1" style="--g:2" d="M21 34h9"/><path class="gc" pathLength="1" d="M33 38.5l2.6 2.5 5-5.5"/>',
    '<path class="gb" d="M26.4 19.5v-5.2h3.4v5.2"/>',
    '<path class="gt" pathLength="1" d="M20 19.8l16 7.6"/>',
    '<path class="gr" d="M6 50.5h44"/>'
  ];
  MT.etape = function(svg, i){
    MT.split(svg);
    var o = mk("g", { "class": "mt-g mt-e" + i }); o.innerHTML = MT.O[i];
    svg.appendChild(o);
    return o;
  };
  /* un trait de lumière orange qui parcourt les contours clés d'un picto de métier */
  MT.CLES = [[2, 3], [2, 4], [0], [0]];
  MT.met = function(svg, i){
    var g = MT.split(svg), o = mk("g", { "class": "mt-g mt-m" });
    MT.CLES[i].forEach(function(key, h){
      [].forEach.call(g.querySelectorAll('[data-o="' + key + '"]'), function(p){
        var c = p.cloneNode(true); c.setAttribute("class", "hl"); c.style.setProperty("--h", h); o.appendChild(c);
      });
    });
    svg.appendChild(o);
  };
  /* le sceau : l'icône est tracée, un anneau fin l'entoure */
  MT.sceau = function(sc){
    var svg = sc.querySelector("svg"); if (!svg || sc.__mt) return;
    MT.split(svg); sc.__mt = 1;
    var a = mk("svg", { "class": "mt-anneau", viewBox: "0 0 52 52", "aria-hidden": "true" });
    a.appendChild(mk("rect", { x: 1, y: 1, width: 50, height: 50, rx: 15, "class": "rb" }));
    a.appendChild(mk("rect", { x: 1, y: 1, width: 50, height: 50, rx: 15, pathLength: 1, "class": "ra" }));
    sc.appendChild(a);
  };
  MT.vue = function(els, seuil, fn){
    if (!("IntersectionObserver" in window)){ els.forEach(function(e){ fn(e, true); }); return; }
    var io = new IntersectionObserver(function(es){ es.forEach(function(x){ fn(x.target, x.isIntersecting); }); }, { threshold: seuil });
    els.forEach(function(e){ io.observe(e); });
  };
  MT.cartes = function(){ return [].slice.call(document.querySelectorAll("#metier .cartes .carte")); };
  MT.mets = function(){ return [].slice.call(document.querySelectorAll("#rejoindre .met")); };
  MT.sceaux = function(){ return [].slice.call(document.querySelectorAll("#vision .label__sceau")); };
  MT.ease = function(x){ return 1 - Math.pow(1 - clamp(x, 0, 1), 3); };
})();


/* ═══════════════════════════════════════════════════════════════════════════════
   A1 · « LE TRAJET » (suite) — la lumière suit le défilement avec une vitesse bornée
   (elle ne saute jamais) ; un repli au temps la fait arriver même si personne ne défile.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var MT = window.MT; if (!MT) return;
  var R = document.documentElement, clamp = MT.clamp, mk = MT.mk;
  var cartes = document.querySelector("#metier .cartes"), cards = MT.cartes();
  if (!cartes || cards.length !== 4) return;

  /* ─── 1 · LE MÉTIER : les quatre pictos ───────────────────────────────── */
  cards.forEach(function(c, i){
    var svg = c.querySelector(".picto svg"); if (!svg) return;
    MT.etape(svg, i);
    c.classList.add("mt1c", "mt-s" + i);
    if (MT.doux) c.classList.add("mt-fin");
  });
  /* ─── 2 · LES MÉTIERS ET LES SCEAUX : tracé une fois, à l'arrivée ─────── */
  var mets = MT.mets(), sceaux = MT.sceaux();
  mets.forEach(function(m, i){ var s = m.querySelector(".picto svg"); if (s){ MT.met(s, i); m.classList.add("mt1m"); } });
  sceaux.forEach(function(s){ MT.sceau(s); s.classList.add("mt1s"); if (MT.doux) s.classList.add("mt-fin-sceau"); });
  if (MT.doux) return;
  R.classList.add("mt1");
  MT.vue(mets.concat(sceaux), .55, function(el, vu){
    if (!vu || el.classList.contains("mt-on")) return;
    var d = (mets.indexOf(el) >= 0 ? mets.indexOf(el) : sceaux.indexOf(el)) * 260;
    setTimeout(function(){ el.classList.add("mt-on"); }, d);
  });
  setTimeout(function(){ mets.concat(sceaux).forEach(function(el){
    var r = el.getBoundingClientRect(); if (r.top < innerHeight * .85 && r.bottom > 0) el.classList.add("mt-on"); }); }, 3500);

  /* ─── 3 · LE FIL ET LA LUMIÈRE ─────────────────────────────────────────── */
  var svg = mk("svg", { "class": "mt1-fil", "aria-hidden": "true" });
  var defs = mk("defs", {}); defs.innerHTML = '<radialGradient id="mt1-lueur"><stop offset="0" stop-color="#F39A1B" stop-opacity=".5"/><stop offset=".45" stop-color="#F39A1B" stop-opacity=".16"/><stop offset="1" stop-color="#F39A1B" stop-opacity="0"/></radialGradient>';
  svg.appendChild(defs);
  var lueur = mk("circle", { "class": "lueur", r: 13, cx: 0, cy: 0 }), pt = mk("circle", { "class": "pt", r: 3.1, cx: 0, cy: 0 });
  var segs = [], lisses = [];
  for (var j = 0; j < 4; j++){
    var b = mk("line", { "class": "b" }), d = mk("line", { "class": "d" });
    svg.appendChild(b); svg.appendChild(d); segs.push({ b: b, d: d, x1: 0, y1: 0, x2: 0, y2: 0, len: 1, saut: false });
  }
  svg.appendChild(lueur); svg.appendChild(pt);
  cartes.appendChild(svg);
  function pos(el){ var x = 0, y = 0, e = el; while (e && e !== cartes){ x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x: x, y: y }; }
  function mesurer(){
    var A = [], D = [], cx = [], pr = [];
    cards.forEach(function(c){
      var p = c.querySelector(".picto"), q = pos(p), w = p.offsetWidth, h = p.offsetHeight, cp = pos(c);
      A.push({ x: q.x - 9, y: q.y + h / 2 }); D.push({ x: q.x + w + 10, y: q.y + h / 2 });
      cx.push(q.x + w / 2); pr.push({ top: q.y, bas: cp.y + c.offsetHeight });
    });
    for (var k = 0; k < 4; k++){
      var s = segs[k], x1, y1, x2, y2;
      if (k === 0){ x1 = Math.max(4, A[0].x - 30); y1 = A[0].y; x2 = A[0].x; y2 = A[0].y; s.saut = false; }
      else if (Math.abs(D[k - 1].y - A[k].y) < 4 && A[k].x > D[k - 1].x){ x1 = D[k - 1].x; y1 = D[k - 1].y; x2 = A[k].x; y2 = A[k].y; s.saut = false; }
      else { x1 = cx[k]; y1 = pr[k - 1].bas; x2 = cx[k]; y2 = pr[k].top - 7; s.saut = true; }
      s.x1 = x1; s.y1 = y1; s.x2 = x2; s.y2 = y2; s.len = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
      [s.b, s.d].forEach(function(l){ l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2); });
      s.d.style.strokeDasharray = s.len;
    }
    svg.setAttribute("width", cartes.offsetWidth); svg.setAttribute("height", cartes.offsetHeight);
  }
  mesurer();
  var T = 0, v = 0, t0 = null, tprec = 0, raf = 0, fini = false;
  function cible(){
    var h = innerHeight, s = 0, vu = false;
    cards.forEach(function(c){ var r = c.getBoundingClientRect(); s += clamp((h * .84 - r.top) / (h * .2), 0, 1); if (r.top < h * .88 && r.bottom > 0) vu = true; });
    var t = 0;
    if (vu){ if (t0 === null) t0 = performance.now(); t = clamp((performance.now() - t0 - 1600) / 900, 0, 4); }
    return Math.max(s, t);
  }
  function peindre(){
    var jj = Math.min(3, Math.floor(T)), u = clamp(T - jj, 0, 1);
    for (var k = 0; k < 4; k++){
      var s = segs[k], uk = clamp(T - k, 0, 1);
      s.d.style.strokeDashoffset = s.len * (1 - uk);
      if (uk >= .999 && !cards[k].classList.contains("mt-on")) cards[k].classList.add("mt-on");
    }
    var sg = segs[jj], x = sg.x1 + (sg.x2 - sg.x1) * u, y = sg.y1 + (sg.y2 - sg.y1) * u;
    var o = T <= 0.001 ? 0 : (T >= 3.999 ? 0 : (sg.saut ? clamp(Math.min(u, 1 - u) * 7, 0, 1) : 1));
    [lueur, pt].forEach(function(e){ e.setAttribute("cx", x.toFixed(1)); e.setAttribute("cy", y.toFixed(1)); e.style.opacity = o; });
  }
  function pas(now){
    raf = 0;
    var dt = Math.min(.05, (now - tprec) / 1000 || .016); tprec = now;
    var c = cible(), vt = clamp((c - T) * 1.9, 0, 1.3);
    v += (vt - v) * Math.min(1, dt * 5);
    if (c > T) T = Math.min(c, T + v * dt);
    peindre();
    if (T >= 3.999){ T = 4; peindre(); fini = true; }
    else if (c > T + .0005 || v > .01) raf = requestAnimationFrame(pas);
  }
  function lancer(){ if (!raf && !fini){ tprec = performance.now(); raf = requestAnimationFrame(pas); } }
  window.addEventListener("scroll", lancer, { passive: true });
  window.addEventListener("resize", function(){ mesurer(); peindre(); lancer(); });
  window.addEventListener("load", function(){ mesurer(); lancer(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ mesurer(); peindre(); });
  setInterval(lancer, 500);
  peindre(); lancer();
})();
