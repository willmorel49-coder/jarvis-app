/* ═══════════════════════════════════════════════════════════════════════════════
   MOTION 3 · « LE PLAN-SÉQUENCE » — chargé après motion-1.js et motion-2.js.
   Ordinateur seulement (≥ 820 px de large et ≥ 600 px de haut) ; sinon : dose 2.
   Mesure à connaître : la page est plus longue de --m3-extra (une fois), après le bloc
   des chiffres. Le texte, les tailles et l'alignement de chaque élément restent ceux
   de la page d'origine (seul leur « y » dans la page est décalé de cette longueur).
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var M = window.MOTION; if (!M) return;
  var R = document.documentElement;
  var clamp = function(x, a, b){ return Math.min(b, Math.max(a, x)); };
  var vh = function(){ return window.innerHeight || 800; };
  var grand = function(){ return window.innerWidth >= 820 && vh() >= 600; };

  var sec = document.getElementById("chiffres");
  var dedans = sec && sec.querySelector(".dedans");
  var chiffres = sec ? [].slice.call(sec.querySelectorAll("[data-m-cible]")) : [];
  var etat = { actif: false, extra: 0, haut: 0, pad: 0 };

  /* B · les passages de couleur */
  function passage(cible, classe){
    var s = document.getElementById(cible); if (!s) return null;
    var d = document.createElement("div"); d.className = "m3-passage " + classe; d.setAttribute("aria-hidden", "true");
    var nappes = s.querySelector(".nappes");
    if (nappes && nappes.nextSibling) s.insertBefore(d, nappes.nextSibling); else s.insertBefore(d, s.firstChild);
    return { el: d, sec: s };
  }
  var passages = [passage("reseau", "m3-passage--clair"), passage("rejoindre", "m3-passage--nuit")].filter(Boolean);

  /* A · tenir le bloc : on mesure la hauteur naturelle, on y ajoute la longueur du plan fixe */
  function armer(){
    if (!sec || !dedans) return;
    desarmer();
    if (!grand()) return;
    var h = vh();
    etat.extra = Math.round(clamp(h * .9, 520, 900));
    sec.style.height = "";                                    /* hauteur naturelle d'abord */
    var natur = sec.getBoundingClientRect().height;
    var cs = getComputedStyle(sec); etat.pad = parseFloat(cs.paddingTop) || 0;
    var hd = dedans.getBoundingClientRect().height;
    etat.haut = Math.max(56, Math.round((h - hd) / 2));
    sec.style.height = (natur + etat.extra) + "px";
    sec.setAttribute("data-m-tenu", "");
    dedans.classList.add("m3-colle");
    dedans.style.setProperty("--m3-haut", etat.haut + "px");
    R.style.setProperty("--m3-extra", etat.extra + "px");
    R.classList.add("m3");
    etat.actif = true;
  }
  function desarmer(){
    if (!sec) return;
    sec.style.height = ""; sec.removeAttribute("data-m-tenu");
    if (dedans) dedans.classList.remove("m3-colle");
    R.classList.remove("m3"); R.style.removeProperty("--m3-extra");
    etat.actif = false; etat.extra = 0;
    chiffres.forEach(function(c){ M.valeur(c, 1); });
  }

  function peindre(){
    if (!grand()){ if (etat.actif) { desarmer(); } return; }
    if (!etat.actif && sec && !sec.hasAttribute("data-m-tenu")) armer();
    var h = vh();
    if (etat.actif){
      var r = sec.getBoundingClientRect();
      /* P = 0 quand le bloc se colle, 1 quand il se décolle */
      var P = clamp((etat.haut - etat.pad - r.top) / etat.extra, 0, 1);
      chiffres.forEach(function(c, k){
        var a = .06 + k * .2;                                  /* quatre fenêtres qui se suivent */
        M.valeur(c, clamp((P - a) / .3, 0, 1));
      });
    }
    passages.forEach(function(p){
      var rs = p.sec.getBoundingClientRect();
      if (rs.top > h + 100 || rs.bottom < -100) return;
      var g = clamp((h * .95 - rs.top) / (h * .55), 0, 1);
      p.el.style.setProperty("--m3-g", g.toFixed(3));
    });
  }
  M.frame(peindre);
  window.addEventListener("resize", function(){ if (etat.actif) { desarmer(); } M.demander(); });
  /* les polices et les images changent la hauteur : on réarme une fois tout chargé */
  window.addEventListener("load", function(){ if (etat.actif){ desarmer(); } M.demander(); });
  peindre();
  M.demander();
})();
