/* ═══════════════════════════════════════════════════════════════════════════════
   MOTION 2 · « LE DÉFILEMENT » — chargé après motion-1.js. Écouteur passif partagé
   (MOTION.frame) + requestAnimationFrame ; ne calcule que ce qui est à l'écran.
   Ne touche ni au dessin de la carte ni à ses règles de clic.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var M = window.MOTION; if (!M) return;
  var R = document.documentElement;
  var clamp = function(x, a, b){ return Math.min(b, Math.max(a, x)); };
  var vh = function(){ return window.innerHeight || 800; };
  var mobile = function(){ return window.matchMedia("(max-width:640px)").matches; };

  var scene = document.querySelector(".scene"), col = document.querySelector(".scene__col");
  var bas = document.querySelector(".scene__bas");
  var ombre = null;
  if (col){
    ombre = document.createElement("div"); ombre.className = "m2-ombre"; ombre.setAttribute("aria-hidden", "true");
    var voile = col.querySelector(".scene__voile");
    if (voile && voile.nextSibling) col.insertBefore(ombre, voile.nextSibling); else col.appendChild(ombre);
  }
  var bandes = [].slice.call(document.querySelectorAll(".bande"));
  var traits = [].slice.call(document.querySelectorAll("main .sur-titre:not([data-h])"));
  var boite = document.querySelector(".carte-boite");
  var memo = new WeakMap();
  function mettre(el, nom, v){ var m = memo.get(el); if (!m){ m = {}; memo.set(el, m); } if (m[nom] !== v){ m[nom] = v; el.style.setProperty(nom, v); } }
  var premier = true;

  function peindre(){
    var h = vh(), sy = window.scrollY;
    /* 1 · l'ouverture */
    if (scene && ombre){
      var hs = scene.offsetHeight - h, p = hs > 0 ? clamp(sy / hs, 0, 1) : 0;
      if (p < 1.001 && sy < scene.offsetHeight){
        ombre.style.opacity = String(+(p * 1).toFixed(3));
        mettre(ombre, "--m2-noir", String(+(clamp((p - .55) / .45, 0, 1) * .55).toFixed(3)));
        if (bas) bas.style.opacity = String(+(clamp(1 - p * 7, 0, 1)).toFixed(3));
      }
    }
    /* 2 · les bandes photo */
    for (var k = 0; k < bandes.length; k++){
      var b = bandes[k], r = b.getBoundingClientRect();
      if (r.bottom < -200 || r.top > h + 200) continue;
      var q = clamp((h - r.top) / (h + r.height), 0, 1);
      mettre(b, "--m2-zoom", String(+(1.09 - q * .09).toFixed(4)));
      mettre(b, "--m2-texte", ((.5 - q) * (mobile() ? 16 : 34)).toFixed(1) + "px");
    }
    /* 3 · les traits orange */
    for (var j = 0; j < traits.length; j++){
      var t = traits[j], rt = t.getBoundingClientRect();
      if (!premier && (rt.bottom < -50 || rt.top > h + 50)) continue;
      var tr = clamp((h * .96 - rt.top) / (h * .28), 0, 1);
      mettre(t, "--m2-trait", String(+tr.toFixed(3)));
    }
    /* 4 · la carte */
    if (boite && !boite.classList.contains("m2-ouverte")){
      var rb = boite.getBoundingClientRect();
      var o = clamp((h * .98 - rb.top) / (h * .42), 0, 1);
      mettre(boite, "--m2-o", String(+o.toFixed(3)));
      if (o >= 1) boite.classList.add("m2-ouverte");
    }
  }
  var _p = peindre; peindre = function(){ _p(); premier = false; };
  M.frame(function(){ peindre(); });
  R.classList.add("m2");
  M.demander();
})();
