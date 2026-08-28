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

/* ═══ La vie des surfaces — cinq gestes légers, arrêtés hors écran ═══════════ */
(function(){
  "use strict";
  var doux = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var souris = window.matchMedia("(pointer: fine)").matches;

  /* a · les nappes sous les tuiles teintées, le pied compris */
  var tuiles = [].slice.call(document.querySelectorAll(".tuile.pastel, .tuile.pastel--droite, .tuile.bleu, .tuile.nuit, .tuile.doux, .tuile.doux--droite, .pied"));
  var nappes = [];
  tuiles.forEach(function(t){
    var n = document.createElement("div"); n.className = "nappes"; n.setAttribute("aria-hidden", "true");
    n.innerHTML = '<span class="n1"></span><span class="n2"></span><span class="n3"></span><span class="n4"></span><span class="nl"></span>';
    t.insertBefore(n, t.firstChild); nappes.push(n);
  });
  function veiller(els, classe){
    if (!("IntersectionObserver" in window)){ return; }
    var io = new IntersectionObserver(function(en){
      en.forEach(function(e){ e.target.classList.toggle(classe, !e.isIntersecting); });
    }, { rootMargin: "150px" });
    els.forEach(function(el){ io.observe(el); });
    document.addEventListener("visibilitychange", function(){ els.forEach(function(el){ if (document.hidden) el.classList.add(classe); }); });
  }
  veiller(nappes, "pause");

  /* b · le titre qui se lève mot à mot */
  [].slice.call(document.querySelectorAll("[data-mots]")).forEach(function(el){
    if (doux) return;
    var mots = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = "";
    var k = 0;
    mots.forEach(function(ligne, li){
      ligne.trim().split(/\s+/).forEach(function(m){
        if (!m) return;
        var masque = document.createElement("span"); masque.className = "mot";
        var i = document.createElement("i"); i.textContent = m.replace(/&nbsp;/g, " "); i.style.setProperty("--d", (k * 70) + "ms");
        masque.appendChild(i); el.appendChild(masque); el.appendChild(document.createTextNode(" ")); k++;
      });
      if (li < mots.length - 1) el.appendChild(document.createElement("br"));
    });
    var suite = el.parentNode.querySelectorAll(".apres-titre");
    [].forEach.call(suite, function(s, j){ s.style.setProperty("--d", (k * 70 + 150 + j * 120) + "ms"); });
  });

  /* c · le reflet derrière une phrase */
  var reflets = [].slice.call(document.querySelectorAll("[data-reflet]"));
  reflets.forEach(function(el){
    var t = document.createElement("span"); t.className = "reflet__texte"; while (el.firstChild) t.appendChild(el.firstChild);
    var l = document.createElement("span"); l.className = "reflet__lumiere"; l.setAttribute("aria-hidden", "true");
    el.appendChild(l); el.appendChild(t); el.classList.add("reflet");
  });
  veiller(reflets, "pause");

  /* d · les cartes qui s'inclinent sous le curseur */
  if (souris && !doux){
    [].slice.call(document.querySelectorAll(".carte")).forEach(function(c){
      var MAX = 4;
      c.addEventListener("mousemove", function(e){
        var r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        c.style.setProperty("--ry", ((px - .5) * 2 * MAX).toFixed(2) + "deg");
        c.style.setProperty("--rx", ((py - .5) * -2 * MAX).toFixed(2) + "deg");
        c.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        c.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        c.classList.add("penche");
      });
      c.addEventListener("mouseleave", function(){ c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); c.classList.remove("penche"); });
    });
  }

  /* e · les boutons aimantés */
  if (souris && !doux){
    var aimants = [].slice.call(document.querySelectorAll("[data-aimant]"));
    if (aimants.length){
      aimants.forEach(function(b){ b.classList.add("aimant"); });
      var enVol = false;
      window.addEventListener("mousemove", function(e){
        if (enVol) return; enVol = true;
        requestAnimationFrame(function(){
          enVol = false;
          aimants.forEach(function(b){
            var r = b.getBoundingClientRect();
            if (r.width === 0) return;
            var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
            if (Math.abs(dx) < r.width / 2 + 60 && Math.abs(dy) < r.height / 2 + 60){
              b.style.transform = "translate(" + (dx * .22).toFixed(1) + "px," + (dy * .22).toFixed(1) + "px)";
            } else if (b.style.transform){ b.style.transform = ""; }
          });
        });
      }, { passive: true });
    }
  }
})();
