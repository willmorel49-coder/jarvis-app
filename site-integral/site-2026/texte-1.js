/* ═══════════════════════════════════════════════════════════════════════════════
   TEXTE 1 · « L'AIR » — mêmes mots, mieux posés. Vanilla. Chargé après motion-2.js.
   · la phrase d'attaque de chaque bloc de texte long passe un cran au-dessus ;
   · un paragraphe long est coupé visuellement aux fins de phrase (ou au deux-points) ;
   · un ou deux mots-clés par bloc reçoivent un trait orange fin qui se trace à l'arrivée.
   AUCUN mot n'est ajouté, retiré ni changé : le texte est seulement rangé dans des <span>.
   Sans script : la page actuelle. Expose window.TEXTE (réutilisé par texte-2.js et texte-3.js).
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var R = document.documentElement;
  if (!R.classList.contains("js")) return;
  var doux = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var T = window.TEXTE = { blocs: [], version: 1 };

  /* les blocs de texte long de l'accueil (sélecteurs sur la page de base) */
  var DEF = [
    { id: "groupe",    sel: "#groupe .lead-aere",
      cles: ["partager directement la marge", "du côté du comptoir"] },
    { id: "reseau",    sel: "#reseau .duo p.corps:not(#carte-consigne)",
      cles: ["la seule question", "le stock de toutes"] },
    { id: "centrale",  sel: "#centrale .lead-aere",
      cles: ["plateforme autonome", "Offilog qui vous répond directement"] },
    { id: "depots",    sel: "#depots .duo > p.lead-aere",
      cles: ["chaque jour"] },
    { id: "rejoindre", sel: "#rejoindre p.lire",
      cles: ["le métier s'apprend sur place"] }
  ];

  function mots(s){ return s.split(/[ \u00a0]+/).filter(Boolean).length; }
  function phrases(txt){
    var re = /[^.!?]+[.!?]+(?:[ ]+|$)|[^.!?]+$/g, m, out = [];
    while ((m = re.exec(txt))) { var s = m[0].replace(/\s+$/, ""); if (s) out.push(s); }
    return out;
  }
  function span(cls, txt){ var s = document.createElement("span"); s.className = cls; s.textContent = txt; return s; }

  /* marquer(racine, phrase, classe, balise) : enveloppe la 1re occurrence de la phrase (texte exact, espaces
     insécables tolérés) ; ne change aucun caractère. Rend true si trouvée. */
  T.marquer = function(racine, phrase, cls, balise){
    var re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[ \\u00a0]"));
    var wk = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, null), n;
    while ((n = wk.nextNode())) {
      var m = re.exec(n.nodeValue); if (!m) continue;
      var apres = n.splitText(m.index); apres.splitText(m[0].length);
      var e = document.createElement(balise || "span"); e.className = cls + (cls === "t1-cle" && phrase.length <= 22 ? " t1-cle--court" : "");
      apres.parentNode.replaceChild(e, apres); e.appendChild(apres);
      return true;
    }
    return false;
  };

  /* construire(p, texte, premier, cles) : range le texte du paragraphe en blocs (attaque / phrases) */
  T.construire = function(p, texte, premier, cles){
    texte = texte.replace(/[ \t\r\n]+/g, " ").trim();
    var ph = phrases(texte), parts = [];
    ph.forEach(function(s, k){
      var att = premier && (k === 0);
      var i = s.search(/[ \u00a0]:[ \u00a0]/);
      if (i > 0 && mots(s) >= (att ? 22 : 28)) {
        parts.push({ t: s.slice(0, i + 2), att: att, suite: false, tete: !att });
        parts.push({ t: s.slice(i + 3), att: false, suite: true });  /* le début en grand, la suite en corps */
      } else parts.push({ t: s, att: att, suite: false });
    });
    p.textContent = "";
    parts.forEach(function(x, k){
      if (k) p.appendChild(document.createTextNode(" "));
      p.appendChild(span((x.att ? "t1-att" : "t1-ph") + (x.suite ? " t1-suite" : "") + (x.tete ? " t1-tete" : ""), x.t));
    });
    p.classList.add("t1-p");
    (cles || []).forEach(function(c){ T.marquer(p, c, "t1-cle"); });
    T.marquer(p, "14 000", "t1-nb"); T.marquer(p, "Intégral Pharma", "t1-nb");                    /* un nombre ne se coupe pas en fin de ligne */
  };

  /* le trait orange se trace quand le mot-clé arrive à l'écran */
  var io = null;
  if (!doux && "IntersectionObserver" in window) {
    io = new IntersectionObserver(function(en){
      en.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add("t1-trace"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -14% 0px", threshold: 0.6 });
  }
  T.tracer = function(racine){
    [].forEach.call(racine.querySelectorAll(".t1-cle:not(.t1-trace)"), function(c){
      if (io) io.observe(c); else c.classList.add("t1-trace");
    });
  };

  try {
    DEF.forEach(function(d){
      var ps = [].slice.call(document.querySelectorAll(d.sel));
      if (!ps.length) return;
      var bloc = { id: d.id, ps: ps, cles: d.cles, sec: ps[0].closest(".tuile") };
      T.blocs.push(bloc);
      ps.forEach(function(p, i){ T.construire(p, p.textContent, i === 0, i === 0 && ps.length === 1 ? d.cles : null); });
      /* mots-clés : cherchés dans le bloc entier (chacun dans le paragraphe où il se trouve) */
      if (ps.length > 1) d.cles.forEach(function(c){ for (var k = 0; k < ps.length; k++) if (T.marquer(ps[k], c, "t1-cle")) break; });
      T.tracer(ps[0].parentNode);
    });
    R.classList.add("t1");
  } catch (e) { /* en cas d'imprévu : la page reste celle de la base */ }
})();
