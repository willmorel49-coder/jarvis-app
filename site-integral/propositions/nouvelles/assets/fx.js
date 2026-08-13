/* ------------------------------------------------------------------
   FX — le moteur des trois signatures.

   Il lit les classes posées sur <body> et n'active que ce qui est
   demandé : UN défilé, UN mouvement, UN geste 3D. Rien d'autre.

   Règles tenues :
   · le masquage n'est posé qu'ici (classe `js-anim` sur <html>) — si ce
     script ne tourne pas, la page reste entièrement lisible ;
   · un élément déjà visible à l'arrivée est révélé tout de suite, sinon
     il resterait invisible pour toujours après un rechargement à mi-page ;
   · en mouvement réduit, tout est révélé d'emblée et rien ne s'anime ;
   · les compteurs ne montrent jamais une valeur fausse : ils montent
     vers le chiffre exact et s'arrêtent dessus.
------------------------------------------------------------------ */

(function () {
  "use strict";

  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var corps = document.body;
  var cls = corps.className.split(/\s+/);

  function a(prefixe) {
    for (var i = 0; i < cls.length; i++) {
      if (cls[i].indexOf(prefixe) === 0) return cls[i];
    }
    return null;
  }

  /* ---------- Le menu, y compris sur téléphone ---------- */
  var b = document.querySelector(".burger");
  var n = document.querySelector(".liens");
  if (b && n) {
    b.addEventListener("click", function () {
      var o = n.getAttribute("data-ouvert") === "true";
      n.setAttribute("data-ouvert", o ? "false" : "true");
      b.setAttribute("aria-expanded", o ? "false" : "true");
    });
    n.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        n.setAttribute("data-ouvert", "false");
        b.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        n.setAttribute("data-ouvert", "false");
        b.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Le mouvement : une seule signature ---------- */
  var mo = a("mo");

  function decouperEnMots(el) {
    // Pour mo3 seulement : chaque mot devient une boîte qu'on peut décaler.
    if (el.querySelector(".mot")) return;
    var t = el.textContent;
    el.textContent = "";
    t.split(/(\s+)/).forEach(function (bout, i) {
      if (!bout.trim()) { el.appendChild(document.createTextNode(bout)); return; }
      var s = document.createElement("span");
      s.className = "mot";
      s.style.transitionDelay = (i * 0.028) + "s";
      s.textContent = bout;
      el.appendChild(s);
    });
  }

  function monterCompteur(el) {
    var texte = el.textContent.trim();
    var m = texte.match(/^([\d\s  ]+)(.*)$/);
    if (!m) return;
    var cible = parseInt(m[1].replace(/[^\d]/g, ""), 10);
    var suffixe = m[2];
    if (!cible || cible > 100000) return;
    var debut = null, duree = 900;
    function pas(t) {
      if (debut === null) debut = t;
      var p = Math.min(1, (t - debut) / duree);
      var v = Math.round(cible * (1 - Math.pow(1 - p, 3)));
      el.textContent = v.toLocaleString("fr-FR") + suffixe;
      if (p < 1) requestAnimationFrame(pas);
      else el.textContent = cible.toLocaleString("fr-FR") + suffixe; // valeur exacte
    }
    requestAnimationFrame(pas);
  }

  function mouvement() {
    var cibles = Array.prototype.slice.call(document.querySelectorAll(".fx"));
    if (!cibles.length) return;

    if (reduit || !("IntersectionObserver" in window)) {
      cibles.forEach(function (el) { el.classList.add("vu"); });
      return;
    }
    document.documentElement.classList.add("js-anim");
    if (mo === "mo3") {
      document.querySelectorAll(".fx h1, .fx h2").forEach(decouperEnMots);
    }

    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("vu");
        if (mo === "mo7") {
          e.target.querySelectorAll(".chiffres b").forEach(monterCompteur);
        }
        obs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });

    cibles.forEach(function (el) {
      var r = el.getBoundingClientRect();
      // Déjà à l'écran au chargement : on révèle sans attendre.
      if (r.top < window.innerHeight && r.bottom > 0) {
        el.classList.add("vu");
        if (mo === "mo7") el.querySelectorAll(".chiffres b").forEach(monterCompteur);
      } else {
        obs.observe(el);
      }
    });
  }

  /* ---------- Le geste 3D des portes (td1) ---------- */
  function portes() {
    var v = Array.prototype.slice.call(document.querySelectorAll(".volet"));
    if (!v.length) return;
    function toutes() { v.forEach(function (x) { x.style.setProperty("--ouv", "1"); }); }
    if (reduit || !("IntersectionObserver" in window)) { toutes(); return; }
    v.forEach(function (x) {
      x.style.setProperty("--ouv", "0");
      x.style.transition = "transform .7s cubic-bezier(.22,.8,.25,1)";
    });
    var o = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = v.indexOf(e.target);
        setTimeout(function () { e.target.style.setProperty("--ouv", "1"); }, i * 95);
        o.unobserve(e.target);
      });
    }, { threshold: 0.2 });
    v.forEach(function (x) {
      var r = x.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) x.style.setProperty("--ouv", "1");
      else o.observe(x);
    });
  }

  /* ---------- Les défilés ---------- */
  function defiles() {
    var s = a("s");

    if (s === "s1") {
      var piste = document.querySelector(".s1 .sites");
      document.querySelectorAll(".s1 .fleche").forEach(function (f) {
        f.addEventListener("click", function () {
          var d = f.dataset.sens === "-" ? -1 : 1;
          piste.scrollBy({ left: d * piste.clientWidth * 0.8, behavior: reduit ? "auto" : "smooth" });
        });
      });
    }

    if (s === "s2" || s === "s8") {
      var items = Array.prototype.slice.call(document.querySelectorAll(".sites .site"));
      var boutons = Array.prototype.slice.call(
        document.querySelectorAll(".onglet, .point"));
      function montrer(i) {
        items.forEach(function (el, j) { el.setAttribute("data-actif", i === j ? "1" : "0"); });
        boutons.forEach(function (el, j) {
          if (s === "s2") el.setAttribute("aria-selected", i === j ? "true" : "false");
          else el.setAttribute("aria-current", i === j ? "true" : "false");
        });
      }
      boutons.forEach(function (el, i) {
        el.addEventListener("click", function () { montrer(i); });
      });
      montrer(0);
    }

    if (s === "s3") {
      document.querySelectorAll(".s3 .site__tete").forEach(function (t) {
        t.addEventListener("click", function () {
          var site = t.closest(".site");
          site.setAttribute("data-ouv", site.getAttribute("data-ouv") === "1" ? "0" : "1");
        });
      });
      var p = document.querySelector(".s3 .site");
      if (p) p.setAttribute("data-ouv", "1");
    }
  }

  function demarrer() {
    mouvement();
    portes();
    defiles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarrer);
  } else {
    demarrer();
  }
})();

/* ------------------------------------------------------------------
   LA CARTE VIVANTE — survol d'un point → fiche de l'implantation.

   Le composant reprend le principe de `maquette-55` : c'est celui que
   Will trouvait « impressionnant », pas la gélule en three.js.

   Tout le contenu (les dix noms, villes, rôles) est déjà dans la
   légende HTML : si ce script ne tourne pas, on perd le survol, jamais
   l'information.
------------------------------------------------------------------ */
(function () {
  "use strict";

  var carte = document.querySelector(".vive");
  if (!carte) return;

  var fiche = carte.querySelector(".vive__fiche");
  var pts = Array.prototype.slice.call(carte.querySelectorAll(".site-pt"));
  var lignes = Array.prototype.slice.call(carte.querySelectorAll(".vive__lg li"));
  var zone = carte.querySelector(".vive__carte");
  if (!fiche || !pts.length) return;

  function montrer(i) {
    var p = pts[i];
    fiche.innerHTML = '<b>' + p.dataset.nom + '</b><span>' + p.dataset.ville +
                      ' · ' + p.dataset.dep + (p.dataset.statut ? ' · ' + p.dataset.statut : '') + '</span>';
    // On place la fiche au-dessus du point, en pourcentage : la carte est
    // fluide, une position en pixels serait fausse dès qu'elle change de taille.
    fiche.style.left = p.dataset.x + "%";
    fiche.style.top = p.dataset.y + "%";
    fiche.style.transform = "translate(-50%, calc(-100% - 14px))";
    fiche.setAttribute("data-on", "1");
    lignes.forEach(function (l, j) { l.classList.toggle("actif", i === j); });
  }

  function cacher() {
    fiche.setAttribute("data-on", "0");
    lignes.forEach(function (l) { l.classList.remove("actif"); });
  }

  pts.forEach(function (p, i) {
    p.addEventListener("mouseenter", function () { montrer(i); });
    p.addEventListener("focus", function () { montrer(i); });
    p.addEventListener("blur", cacher);
    // Au doigt, le survol n'existe pas : un appui montre la fiche.
    p.addEventListener("click", function (e) { e.preventDefault(); montrer(i); });
  });
  if (zone) zone.addEventListener("mouseleave", cacher);

  // La légende répond aussi : survoler une ligne éclaire son point.
  lignes.forEach(function (l, i) {
    l.addEventListener("mouseenter", function () { montrer(i); });
  });
})();
