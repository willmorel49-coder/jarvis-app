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

/* A2 · les quatre pictos du métier en boucle (voir a2m.css) */
(function(){
  "use strict";
  var MT = window.MT; if (!MT) return;
  var R = document.documentElement, cards = MT.cartes();
  if (cards.length !== 4) return;
  cards.forEach(function(c, i){
    var svg = c.querySelector(".picto svg"); if (!svg) return;
    MT.etape(svg, i);
    c.classList.add("mt2c", "mt-s" + i);
    c.style.setProperty("--mt-d", (.5 + i * 1.9).toFixed(1) + "s");
    if (MT.doux) c.classList.add("mt-fin");
  });
  if (MT.doux) return;
  R.classList.add("mt2");
  MT.vue(cards, .4, function(c, vu){ c.classList.toggle("mt-vit", vu); });
})();

/* A2 · métiers et sceaux en boucle lente, seulement quand ils sont à l'écran */
(function(){
  "use strict";
  var MT = window.MT; if (!MT) return;
  var mets = MT.mets(), sceaux = MT.sceaux();
  mets.forEach(function(m, i){
    var s = m.querySelector(".picto svg"); if (!s) return;
    MT.met(s, i); m.classList.add("mt2m"); m.style.setProperty("--mt-d", (i * 2.1).toFixed(1) + "s");
  });
  sceaux.forEach(function(s, i){ MT.sceau(s); s.classList.add("mt2s"); s.style.setProperty("--mt-d", (i * -4.5).toFixed(1) + "s"); });
  if (MT.doux){ sceaux.forEach(function(s){ s.classList.add("mt-fin-sceau"); }); return; }
  MT.vue(mets.concat(sceaux), .4, function(el, vu){ el.classList.toggle("mt-vit", vu); });
})();
