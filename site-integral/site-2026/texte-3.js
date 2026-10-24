/* ═══════════════════════════════════════════════════════════════════════════════
   TEXTE 3 · « PLUS COURT » — chargé après texte-1.js. Vanilla.
   Les trois blocs murs (le groupe, le réseau, la centrale) sont proposés en version raccourcie
   (environ la moitié des mots). Le texte complet, celui validé, reste intact derrière « Lire la suite ».
   ⚠ TEXTES À FAIRE VALIDER avant toute mise en ligne (voir RAPPORT.md : original et version courte côte à côte).
   Sans script : la page de base, texte complet.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var T = window.TEXTE; if (!T || !T.blocs.length) return;
  var R = document.documentElement;

  /* un texte court par paragraphe (null = paragraphe laissé tel quel), et ses mots-clés */
  var COURTS = {
    groupe: { ps: [
      "Depuis 2006, Intégral Pharma partage directement la marge avec les officines, en toute transparence.",
      "Chaque agence livre sa région avec ses équipes, et la même idée qu'au premier jour : se mettre du côté du comptoir."
    ], cles: ["partage directement la marge", "du côté du comptoir"] },
    reseau: { ps: [
      "C'est la seule question qui compte vraiment. Celle dont vous connaissez l'équipe par son prénom.",
      "Les sept autres sont là pour la soutenir : le stock d'une agence est le stock de toutes."
    ], cles: ["la seule question", "le stock de toutes"] },
    centrale: { ps: [
      "Offilog est notre centrale de parapharmacie : des produits et des marques pour vos officines.",
      "Une plateforme autonome : vous commandez sur son site, elle vous livre elle-même.",
      "Elle fait partie du groupe, mais c'est Offilog qui répond directement à vos questions."
    ], cles: ["plateforme autonome", "Offilog qui répond directement"] }
  };

  var CHEVRON = '<svg viewBox="0 0 14 9" aria-hidden="true"><path d="M1 1.5 7 7.5l6-6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  function nettoyer(clone){
    /* le clone n'appartient à aucune révélation : il ne porte ni .rv ni état de motion-1 */
    clone.className = clone.className.split(/\s+/).filter(function(c){ return c && c !== "rv" && c !== "vu" && c.indexOf("m-") !== 0; }).join(" ");
    clone.removeAttribute("style");
    clone.removeAttribute("id");
    return clone;
  }

  try {
    T.blocs.forEach(function(b){
      var c = COURTS[b.id]; if (!c) return;
      var ps = b.ps, plein = ps.map(function(p){ return nettoyer(p.cloneNode(true)); });
      var zoneC = document.createElement("div"); zoneC.className = "t3-zone t3-court";
      var inC = document.createElement("div"); inC.className = "t3-in"; zoneC.appendChild(inC);
      var zoneP = document.createElement("div"); zoneP.className = "t3-zone t3-plein"; zoneP.setAttribute("aria-hidden", "true");
      var inP = document.createElement("div"); inP.className = "t3-in"; zoneP.appendChild(inP);
      var bloc = document.createElement("div"); bloc.className = "t3";
      ps[0].parentNode.insertBefore(bloc, ps[0]);
      bloc.appendChild(zoneC); bloc.appendChild(zoneP);
      ps.forEach(function(p, i){
        T.construire(p, c.ps[i], i === 0, null);
        inC.appendChild(p);
        inP.appendChild(plein[i]);
      });
      c.cles.forEach(function(k){ for (var j = 0; j < ps.length; j++) if (T.marquer(ps[j], k, "t1-cle")) break; });
      T.tracer(inC); T.tracer(inP);
      /* la suite : le texte validé, tel quel */
      var btn = document.createElement("button"); btn.type = "button"; btn.className = "lien t3-btn";
      btn.setAttribute("aria-expanded", "false");
      var id = "t3-" + b.id; zoneP.id = id; btn.setAttribute("aria-controls", id);
      var lib = document.createElement("span"); lib.textContent = "Lire la suite";
      btn.appendChild(lib); btn.insertAdjacentHTML("beforeend", CHEVRON);
      bloc.appendChild(btn);
      btn.addEventListener("click", function(){
        var ouvert = bloc.classList.toggle("t3-ouvert");
        btn.setAttribute("aria-expanded", String(ouvert));
        zoneP.setAttribute("aria-hidden", String(!ouvert));
        zoneC.setAttribute("aria-hidden", String(ouvert));
        lib.textContent = ouvert ? "Réduire" : "Lire la suite";
      });
      /* les paragraphes qui suivent dans la même colonne (ex. la consigne de la carte) ne bougent pas */
    });
    R.classList.add("t3");
  } catch (e) { /* imprévu : texte complet de la base, déjà en place */ }
})();
