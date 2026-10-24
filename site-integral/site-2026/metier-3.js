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

/* ═══════════════════════════════════════════════════════════════════════════════
   A3 · « LE PLAN FIXE » (suite). Position réelle lue à chaque défilement (aucune notification
   unique) ; les textes ne sont jamais rendus transparents : ils sont masqués par clip-path. 
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var MT = window.MT; if (!MT) return;
  var R = document.documentElement, clamp = MT.clamp, mk = MT.mk;
  var sec = document.getElementById("metier"), cartes = sec && sec.querySelector(".cartes"), dedans = sec && sec.querySelector(".dedans");
  var cards = MT.cartes();
  if (!sec || !cartes || !dedans || cards.length !== 4) return;
  var tete = dedans.firstElementChild;
  var mq = window.matchMedia("(min-width:900px) and (min-height:620px) and (prefers-reduced-motion:no-preference)");
  var etat = null;
  var NS = "http://www.w3.org/2000/svg";

  function base(i, k){ var g = cards[i].querySelector(".picto svg .mt-b"); return g ? g.cloneNode(true) : mk("g", {}); }
  function ov(i){ var g = mk("g", { "class": "mt-g" }); g.innerHTML = MT.O[i]; return g; }
  function sc(i){ return mk("g", { "class": "sc mt1c mt-s" + i }); }
  function svgDe(html){ var g = mk("g", {}); g.innerHTML = html; return g; }
  function construire(){
    var svg = mk("svg", { "class": "mt3-svg", viewBox: "0 0 100 100", "aria-hidden": "true", focusable: "false" });
    svg.innerHTML = '<defs><radialGradient id="mt3-lueur"><stop offset="0" stop-color="#F39A1B" stop-opacity=".42"/><stop offset=".5" stop-color="#F39A1B" stop-opacity=".14"/><stop offset="1" stop-color="#F39A1B" stop-opacity="0"/></radialGradient></defs>' +
      '<path class="tache" d="M14 52C10 28 30 10 52 12c24 2 38 16 36 40C86 76 66 90 44 88 28 86 16 74 14 52z"/>';
    var s = [], g, tr;
    /* 1 · le référencement : trois feuilles, la dernière est lue ligne à ligne puis validée */
    g = sc(0); tr = mk("g", { transform: "translate(5.4 5) scale(1.6)" });
    [[4.2, -3.4, ""], [8.4, -6.8, " g2"]].forEach(function(o){
      var gh = mk("g", { "class": "gh" + o[2], style: "--to:translate(" + o[0] + "px," + o[1] + "px)" });
      var p0 = cards[0].querySelector('.picto svg .sp[data-o="0"]').cloneNode(true); p0.removeAttribute("style"); p0.setAttribute("class", "gh" + o[2]);
      p0.style.setProperty("--to", "translate(" + o[0] + "px," + o[1] + "px)"); tr.appendChild(p0);
    });
    tr.appendChild(base(0)); tr.appendChild(ov(0)); g.appendChild(tr); svg.appendChild(g); s.push(g);
    /* 2 · la disponibilité : le bac se remplit */
    g = sc(1); tr = mk("g", { transform: "translate(5.4 5) scale(1.6)" });
    tr.appendChild(base(1)); tr.appendChild(ov(1)); g.appendChild(tr);
    svg.appendChild(g); s.push(g);
    /* 3 · la préparation : le colis se pose, le ruban se tire */
    g = sc(2); tr = mk("g", { transform: "translate(5.4 2.5) scale(1.6)" });
    tr.appendChild(base(2)); tr.appendChild(ov(2)); g.appendChild(tr);
    g.appendChild(svgDe('<ellipse class="ombre" cx="50" cy="86.5" rx="15" ry="2.2"/>')); svg.appendChild(g); s.push(g);
    /* 4 · la livraison : le camion roule vers l'officine, qui s'éclaire */
    g = sc(3);
    var cam = mk("g", { transform: "translate(0 22) scale(.92)" }), ci = mk("g", { "class": "camion" });
    ci.appendChild(base(3)); cam.appendChild(ci); g.appendChild(cam);
    g.appendChild(svgDe('<path class="gr3" d="M4 74.2h60"/><g class="mt-b">' +
      '<path class="sp" style="--k:0" pathLength="1" d="M70 74.2V53.5L82 43l12 10.5v20.7"/>' +
      '<path class="sp" style="--k:1" pathLength="1" d="M78 74.2v-8.5h8v8.5"/></g>' +
      '<circle class="lueur3" cx="82" cy="56" r="17"/><path class="gx" pathLength="1" d="M82 49.5v8.5M77.8 53.8h8.4"/>'));
    svg.appendChild(g); s.push(g);
    return { svg: svg, sc: s };
  }

  function activer(){
    var sv = construire();
    var vis = document.createElement("div"); vis.className = "mt3-visuel"; vis.setAttribute("aria-hidden", "true"); vis.appendChild(sv.svg);
    var rep = document.createElement("div"); rep.className = "mt3-repere"; rep.setAttribute("aria-hidden", "true");
    rep.innerHTML = '<span class="n"><span>1</span><span>2</span><span>3</span><span>4</span></span><span class="rail"><i></i><b></b></span>';
    var piste = document.createElement("div"); piste.className = "mt3-piste";
    cartes.insertBefore(vis, cartes.firstChild); cartes.appendChild(rep);
    dedans.parentNode.insertBefore(piste, dedans.nextSibling);
    sec.classList.add("mt3"); R.classList.add("mt1", "mt3on");
    etat = { sv: sv, vis: vis, rep: rep, piste: piste, idx: -1, visible: false, tm: [], io: null };
    cards.forEach(function(c){ c.classList.remove("mt3-on"); });
    mesurer();
    if ("IntersectionObserver" in window){
      etat.io = new IntersectionObserver(function(es){ etat.visible = es[0].isIntersecting; if (etat.visible) poser(etat.idx); }, { threshold: .3 });
      etat.io.observe(cartes);
    } else etat.visible = true;
    if ("ResizeObserver" in window){ etat.ro = new ResizeObserver(function(){ if (etat){ mesurer(); maj(); } }); etat.ro.observe(tete); }
    maj();
  }
  function desactiver(){
    var e = etat; etat = null;
    e.tm.forEach(clearTimeout); if (e.io) e.io.disconnect(); if (e.ro) e.ro.disconnect();
    [e.vis, e.rep, e.piste].forEach(function(n){ if (n.parentNode) n.parentNode.removeChild(n); });
    sec.classList.remove("mt3"); R.classList.remove("mt3on");
    cartes.style.height = ""; cards.forEach(function(c){ c.classList.remove("mt3-on"); });
    if (!document.querySelector(".mt1c.mt-on")) R.classList.remove("mt1");
  }
  function mesurer(){
    if (!etat) return;
    var hp = Math.round(innerHeight * 2.3);
    etat.piste.style.height = hp + "px";
    cartes.style.height = "";
    var dispo = dedans.clientHeight - tete.offsetHeight - parseFloat(getComputedStyle(cartes).marginTop);
    cartes.style.height = clamp(dispo, 320, 620) + "px";
    var w = etat.rep.querySelector(".rail").offsetWidth; etat.rail = w;
  }
  /* la scène de l'étape i s'allume ; l'ancienne s'éteint après avoir fini de s'effacer */
  function poser(i){
    if (!etat || i < 0) return;
    etat.sv.sc.forEach(function(g, k){
      if (k === i){
        g.classList.add("vis");
        if (etat.visible){ clearTimeout(etat.tm[k]); g.classList.add("mt-on"); }
      } else if (g.classList.contains("vis")){
        g.classList.remove("vis");
        (function(g, k){ clearTimeout(etat.tm[k]); etat.tm[k] = setTimeout(function(){ g.classList.remove("mt-on"); }, 600); })(g, k);
      }
    });
    etat.sv.svg.querySelector(".tache").style.transform = "rotate(" + (i * 9 - 5) + "deg) scale(" + (1 + (i % 2) * .05) + ")";
    [].forEach.call(etat.rep.querySelectorAll(".n span"), function(n, k){ n.classList.toggle("on", k === i); });
    cards.forEach(function(c, k){ c.classList.toggle("mt3-on", k === i); });
  }
  function maj(){
    if (!etat) return;
    var r = etat.piste.getBoundingClientRect(), run = etat.piste.offsetHeight;
    var p = clamp((innerHeight - 16 - r.top) / run, 0, 1);
    var i = clamp(Math.floor(p * 4), 0, 3);
    if (i !== etat.idx){ etat.idx = i; poser(i); }
    var f = clamp((p * 4 - .5) / 3, 0, 1);
    etat.rep.style.setProperty("--p", f.toFixed(4));
    etat.rep.style.setProperty("--px", (f * Math.max(0, (etat.rail || 0) - 4)).toFixed(1));
    if (tete.offsetHeight !== etat.ht){ etat.ht = tete.offsetHeight; mesurer(); }
  }
  function sync(){
    if (mq.matches && !etat) activer(); else if (!mq.matches && etat) desactiver();
    if (etat) mesurer();
    maj();
  }
  window.addEventListener("scroll", maj, { passive: true });
  window.addEventListener("resize", sync);
  if (mq.addEventListener) mq.addEventListener("change", sync); else if (mq.addListener) mq.addListener(sync);
  window.addEventListener("load", sync);
  setTimeout(sync, 1800); setTimeout(sync, 5000);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);
  sync();
})();

/* A3 · métiers et sceaux : l'avancement du tracé est une FONCTION de la position à l'écran (réversible, sans minuterie) */
(function(){
  "use strict";
  var MT = window.MT; if (!MT) return;
  var clamp = MT.clamp, ease = MT.ease;
  var mets = MT.mets(), sceaux = MT.sceaux(), items = [];
  mets.forEach(function(m, i){
    var s = m.querySelector(".picto svg"); if (!s) return;
    MT.met(s, i); m.classList.add("mt3m");
    items.push({ el: m, sp: [].slice.call(m.querySelectorAll(".mt-b .sp")), hl: [].slice.call(m.querySelectorAll(".hl")), ring: null });
  });
  sceaux.forEach(function(sc){
    MT.sceau(sc); sc.classList.add("mt3s");
    items.push({ el: sc, sp: [].slice.call(sc.querySelectorAll(".mt-b .sp")), hl: [], ring: sc.querySelector(".ra") });
  });
  if (MT.doux){ sceaux.forEach(function(s){ s.classList.add("mt-fin-sceau"); }); items.forEach(function(it){ it.el.classList.remove("mt3m", "mt3s"); }); return; }
  var raf = 0;
  function maj(){
    raf = 0; var h = innerHeight;
    items.forEach(function(it){
      var r = it.el.getBoundingClientRect();
      if (r.bottom < -80 || r.top > h + 80){ if (it.fait && r.bottom < 0) return; }
      var u = clamp((h * .95 - r.top) / (h * .34), 0, 1);
      it.sp.forEach(function(p, k){ p.style.strokeDashoffset = (1 - ease(clamp(u * 1.5 - k * .07, 0, 1))).toFixed(4); });
      it.hl.forEach(function(p, k){ var ph = clamp((u - .5 - k * .05) / .35, 0, 1); p.style.strokeDashoffset = (.4 - 1.6 * ph).toFixed(4); });
      if (it.ring) it.ring.style.strokeDashoffset = (1 - ease(clamp(u * 1.15, 0, 1))).toFixed(4);
    });
  }
  function demander(){ if (!raf) raf = requestAnimationFrame(maj); }
  window.addEventListener("scroll", demander, { passive: true });
  window.addEventListener("resize", demander);
  window.addEventListener("load", demander);
  maj();
})();
