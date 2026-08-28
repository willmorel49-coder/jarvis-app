/* ═══════════════════════════════════════════════════════════════════════════════
   COMMUN — Intégral Pharma, site 2026. Chargé par index.html et rse.html.
   La barre qui se pose (et s'assombrit sur les tuiles de nuit), le menu du
   téléphone, la révélation unique au défilement, l'arrivée par une ancre.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var doc = document.documentElement;
  var doux = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 1 · la barre se pose, et prend la couleur de ce qu'elle recouvre ───── */
  var barre = document.getElementById("barre");
  var hauteurBarre = barre ? barre.offsetHeight : 48;
  function poser(){
    if (!barre) return;
    var posee = window.scrollY > 60;
    barre.classList.toggle("posee", posee);
    var sombre = false;
    if (posee){
      if (doc.classList.contains("p-nuit") || doc.classList.contains("p-soir")) sombre = true;
      else {
        var el = document.elementFromPoint(Math.round(window.innerWidth / 2), hauteurBarre + 8);
        if (el && el.closest && el.closest(".nuit, .scene, .bande, .pied")) sombre = true;
      }
    }
    barre.classList.toggle("sombre", sombre);
  }
  var enVol = false;
  window.addEventListener("scroll", function(){ if (!enVol){ enVol = true; requestAnimationFrame(function(){ enVol = false; poser(); }); } }, { passive: true });
  window.addEventListener("resize", poser);
  poser();
  window.__poser = poser;

  /* ── 2 · le menu du téléphone ──────────────────────────────────────────── */
  var burger  = document.getElementById("burger");
  var panneau = document.getElementById("panneau");
  function menu(ouvert){
    if (!burger || !panneau) return;
    burger.classList.toggle("ouvert", ouvert);
    panneau.classList.toggle("ouvert", ouvert);
    burger.setAttribute("aria-expanded", ouvert ? "true" : "false");
    burger.setAttribute("aria-label", ouvert ? "Fermer le menu" : "Ouvrir le menu");
    if (ouvert) barre.classList.add("posee"); else poser();
  }
  if (burger && panneau){
    burger.addEventListener("click", function(){ menu(!panneau.classList.contains("ouvert")); });
    panneau.addEventListener("click", function(e){ if (e.target.closest("a")) menu(false); });
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && panneau.classList.contains("ouvert")){ menu(false); burger.focus(); }
    });
    window.addEventListener("resize", function(){ if (window.innerWidth > 900) menu(false); });
  }

  /* ── 3 · la révélation — une seule, jamais de re-masquage, filet de sécurité ── */
  var aRev = [].slice.call(document.querySelectorAll(".rv"));
  function voir(el){ el.classList.add("vu"); }
  if ("IntersectionObserver" in window && !doux){
    var obs = new IntersectionObserver(function(lignes){
      lignes.forEach(function(l){ if (l.isIntersecting){ voir(l.target); obs.unobserve(l.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    aRev.forEach(function(el){ obs.observe(el); });
    function filet(){
      var reste = false;
      aRev.forEach(function(el){
        if (el.classList.contains("vu")) return;
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.96 && r.bottom > -40) voir(el); else reste = true;
      });
      if (!reste) window.removeEventListener("scroll", filet);
    }
    window.addEventListener("scroll", filet, { passive: true });
    window.addEventListener("load", filet);
    filet();
    setTimeout(function(){ aRev.forEach(voir); }, 4000);
  } else {
    aRev.forEach(voir);
  }

  /* ── 4 · arrivée par une ancre : la page bouge après le saut (vidéo, police) ── */
  if (location.hash && location.hash.length > 1){
    window.addEventListener("load", function(){
      requestAnimationFrame(function(){
        var cible = document.getElementById(location.hash.slice(1));
        if (cible) cible.scrollIntoView({ block: "start", behavior: "auto" });
        poser();
      });
    });
  }
})();
