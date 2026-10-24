/* ═══════════════════════════════════════════════════════════════════════════════
   TEXTE 2 · « LA LECTURE VIVANTE » — chargé après texte-1.js. Vanilla.
   · chiffres et noms propres en relief (gras + encre pleine) ;
   · une phrase forte par section reprise en grand (mots existants, masquée aux lecteurs d'écran
     puisque le texte est déjà lu juste au-dessus) ;
   · la lecture prend vie : chaque LIGNE passe d'une encre claire à l'encre pleine quand elle monte
     dans l'écran. Par COULEUR (jamais par opacité). Le contraste de l'encre claire reste ≥ 3:1,
     l'encre finale est exactement celle de la page de base.
   Mouvement réduit : relief et citations oui, lecture animée non (tout est à l'encre pleine).
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var T = window.TEXTE; if (!T || !T.blocs.length) return;
  var doux = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var R = document.documentElement;

  /* ── 1 · relief : noms propres et chiffres ───────────────────────────────── */
  var RELIEF = ["Intégral Pharma", "Offilog", "Pharmest", "2006", "14 000", "480"];
  T.blocs.forEach(function(b){
    b.ps.forEach(function(p){ RELIEF.forEach(function(n){ T.marquer(p, n, "t2-rel", "b"); }); });
  });
  var mention = document.querySelector("#reseau .mention b"); if (mention) mention.classList.add("t2-rel");

  /* ── 2 · la phrase forte, DÉPLACÉE (jamais répétée) ─────────────────────────
     La proposition qui suit le deux-points du dernier paragraphe du bloc (déjà isolée par texte-1.js)
     quitte le paragraphe et s'affiche en grand juste en dessous : le deux-points l'annonce, chaque mot
     reste présent une seule fois. Sans script, le paragraphe est celui de la base. */
  var cits = [];
  ["groupe", "reseau", "centrale"].forEach(function(id){
    var b = T.blocs.filter(function(x){ return x.id === id; })[0]; if (!b) return;
    var p = b.ps[b.ps.length - 1], suite = p.querySelector(".t1-suite"); if (!suite) return;
    var f = document.createElement("div"); f.className = "t2-cit";
    var q = document.createElement("p");
    suite.className = "t2-cit__t";                      /* le même nœud : mots, soulignement et relief déjà posés */
    q.appendChild(suite); f.appendChild(q);
    p.parentNode.insertBefore(f, p.nextSibling);
    cits.push(f);
  });
  if (!doux && "IntersectionObserver" in window) {
    cits.forEach(function(f){ f.classList.add("t2-att"); });
    var io = new IntersectionObserver(function(en){
      en.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add("t2-vu"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.3 });
    cits.forEach(function(f){ io.observe(f); });
    /* filet : une citation jamais révélée (observateur muet) se montre au bout de 6 s si elle est à l'écran */
    setTimeout(function(){ cits.forEach(function(f){
      var r = f.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) f.classList.add("t2-vu"); }); }, 6000);
  }

  if (doux) return;

  /* ── 3 · la lecture vivante ──────────────────────────────────────────────── */
  var FONDS = { groupe: [246,250,255], reseau: [44,70,125], centrale: [52,115,244], depots: [246,250,255], rejoindre: [246,250,255] };
  function lum(c){ var a = c.map(function(v){ v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; }
  function contraste(a, b){ var x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  function melange(a, b, t){ return [0, 1, 2].map(function(i){ return a[i] + (b[i] - a[i]) * t; }); }
  function lire(css, fond){
    var m = css.match(/[\d.]+/g); if (!m) return null;
    var c = [+m[0], +m[1], +m[2]], al = m.length > 3 ? +m[3] : 1;
    return al < 1 ? melange(fond, c, al) : c;
  }
  function pale(plein, fond){
    var lo = 0, hi = 1;
    if (contraste(plein, fond) < 3.3) return plein;
    for (var k = 0; k < 14; k++) { var mid = (lo + hi) / 2; if (contraste(melange(plein, fond, mid), fond) >= 3.3) lo = mid; else hi = mid; }
    return melange(plein, fond, lo);
  }

  /* chaque mot dans son <span>, puis les mots regroupés par ligne (lue sur le rendu) */
  var zones = [];
  function envelopper(p){
    var wk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null), n, noeuds = [];
    while ((n = wk.nextNode())) if (n.nodeValue.trim()) noeuds.push(n);
    noeuds.forEach(function(n){
      var frag = document.createDocumentFragment();
      n.nodeValue.split(/([ \t\r\n]+)/).forEach(function(tok){
        if (!tok) return;
        if (/^[ \t\r\n]+$/.test(tok)) frag.appendChild(document.createTextNode(tok));
        else { var s = document.createElement("span"); s.className = "t2-m"; s.textContent = tok; frag.appendChild(s); }
      });
      n.parentNode.replaceChild(frag, n);
    });
  }
  T.blocs.forEach(function(b){ b.ps.forEach(envelopper); zones.push({ bloc: b, lignes: [] }); });

  function mesurer(){
    zones.forEach(function(z){
      z.lignes = [];
      var fond = FONDS[z.bloc.id] || [246,250,255];
      var tous = [];
      z.bloc.ps.forEach(function(p){ [].forEach.call(p.querySelectorAll(".t2-m"), function(w){ w.style.color = ""; tous.push(w); }); });
      var geo = tous.map(function(w){ var r = w.getBoundingClientRect(); return { w: w, y: r.top + r.height / 2, p: w.parentNode }; });
      var cols = geo.map(function(g){ return lire(getComputedStyle(g.w).color, fond); });
      var cur = null, dernierY = null, dernierP = null;
      geo.forEach(function(g, k){
        var plein = cols[k] || [17,19,24];
        if (cur === null || g.p.closest(".t1-p") !== dernierP || Math.abs(g.y - dernierY) > 6) {
          cur = { mots: [], p: -1 }; z.lignes.push(cur); dernierY = g.y; dernierP = g.p.closest(".t1-p");
        }
        cur.mots.push({ el: g.w, plein: plein, pale: pale(plein, fond) });
      });
    });
    peindre(true);
  }
  function rgb(c){ return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")"; }
  function appliquer(l, q){
    l.p = q;
    l.mots.forEach(function(m){ m.el.style.color = q >= 1 ? "" : rgb(melange(m.pale, m.plein, q)); });
  }
  function peindre(force){
    var h = innerHeight;
    zones.forEach(function(z){
      var r = z.bloc.sec.getBoundingClientRect();
      if (!force && (r.bottom < -80 && z.vide) ) return;
      var lecture = z.lignes.map(function(l){ var b = l.mots[0].el.getBoundingClientRect(); return b.top + b.height / 2; });
      z.lignes.forEach(function(l, k){
        var q = Math.max(0, Math.min(1, (h * .86 - lecture[k]) / (h * .26)));
        q = Math.round(q * 50) / 50;
        if (q !== l.p) appliquer(l, q);
      });
      z.vide = r.bottom < 0;
    });
  }
  var rafId = 0;
  function demander(){ if (!rafId) rafId = requestAnimationFrame(function(){ rafId = 0; peindre(false); }); }
  window.addEventListener("scroll", demander, { passive: true });
  var tmr = null;
  window.addEventListener("resize", function(){ clearTimeout(tmr); tmr = setTimeout(mesurer, 160); });
  window.addEventListener("load", mesurer);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(mesurer);
  mesurer();
  R.classList.add("t2");
})();
