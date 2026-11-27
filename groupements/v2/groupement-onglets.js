/* ════════════════════════════════════════════════════════════════
   Onglets en haut des apps de groupement (OPSO Santé, Essentiels Pharma) — 27/11/2026
   Will, mot pour mot : « on avait dit qu'on reprennait la meme arborescnce que jarvis donc onglets au dessus
   et tout hyper clair au lieu de cliquer la ».
   Remplace l'accueil à tuiles : l'app s'ouvre sur le premier onglet, chaque écran porte la barre d'onglets
   (crm/v2/v2-app.js, topbar) et, quand un onglet réunit plusieurs écrans, la rangée de ses vues juste dessous.
   UNE seule liste pour les deux apps. Un écran non chargé (V2.pages[...]) n'a pas de porte ; un onglet sans
   écran n'apparaît pas : rien ici ne teste le nom du groupement (Essentiels : ni Offilog, ni OPSO, ni contrat).
   Chargé par opso/v2/index.html et essentiels/v2/index.html APRÈS les écrans, AVANT v2-app.js.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  function pg(k) { return !!(k && V2.pages && V2.pages[k]); }
  function vue(k, nom) { return pg(k) ? { k: k, nom: nom } : null; }
  // Sous-écran rattaché à un onglet (il l'allume, garde son « Retour ») mais sans bouton dans la rangée des vues.
  function sous(k, nom) { var v = vue(k, nom); if (v) v.cache = true; return v; }

  // 27/11/2026 — choix cliqués de Will : un écran fusionné n'a plus de porte ; son ancienne adresse ouvre celui qui l'a absorbé.
  // Suivi groupement (pilotage) → Tableau de bord, qui reprend l'activation, les nouvelles du mois et l'Offilog des adhérentes.
  var REMPLACES = { pilotage: 'opsobord' };
  function remplace(k) { var r = REMPLACES[k]; return (r && pg(r)) ? r : null; }

  // Plan du contrat OPSO 2027 (PDF interne) : même condition que l'ancienne tuile de l'accueil. Le verrou réel est côté serveur.
  function planOk() {
    return !!(window.V2_BRAND && window.V2_BRAND.opso && V2.PLAN_OPSO_ACCES && V2.docsProteges && V2.docsProteges.planOpso2027
      && V2.PLAN_OPSO_ACCES.indexOf(String((V2.user && V2.user.email) || '').toLowerCase()) >= 0);
  }

  // L'arbre, recalculé à chaque rendu (l'utilisateur et les écrans chargés décident). Chaque vue = un écran existant.
  function liste() {
    var T = V2.groupementTournees, P = V2.groupementProduits, R = V2.groupementReco, D = V2.groupementDocs, F = V2.groupementFiche;
    var arbre = [
      { id: 'bord', nom: 'Tableau de bord', vues: [vue('opsobord', 'Tableau de bord')] },
      { id: 'pharmacies', nom: 'Pharmacies', vues: [vue('opsopharmacies', 'Par pharmacie'),
        (T && T.visible && T.visible()) ? vue(T.route, 'Carte des tournées') : null] },
      { id: 'produits', nom: 'Produits', vues: [vue('opsoachats', 'Les plus commandés'),
        P ? vue(P.route, 'Nos prix nets') : null,
        vue('opsoprix', 'Offre Privilège'),
        R ? vue(R.route, 'Reco produits') : null,
        // OPSO : le catalogue à imprimer s'ouvre par le bouton « Imprimer le catalogue » de « Les plus commandés » (même classement).
        sous('marketing', 'Catalogue à imprimer')] },
      { id: 'offilog', nom: 'Offilog', vues: [vue('offilog', 'Offilog')] },
      { id: 'documents', nom: 'Documents', vues: [D ? vue(D.route, 'Documents') : null] },
      { id: 'contrat', nom: 'Contrat 2027', vues: [
        (V2.opsoPrevisionOk && V2.opsoPrevisionOk()) ? vue('opsoprevision', 'Prévision') : null,
        planOk() ? { doc: 'planOpso2027', nom: 'Plan du contrat (PDF)' } : null] },
      { id: 'groupement', nom: 'Le groupement', vues: [F ? vue(F.route, F.titre || 'Le groupement') : null] }
    ];
    return arbre.map(function (o) { o.vues = o.vues.filter(Boolean); return o; })
      .filter(function (o) { return o.vues.some(function (v) { return v.k && !v.cache; }); });
  }

  // L'onglet (et la vue) de l'écran ouvert ; null si l'écran n'est dans aucun onglet (sous-écran, fiche…).
  function ou(route) {
    var r = route || V2.route || {}, L = liste();
    for (var i = 0; i < L.length; i++) {
      for (var j = 0; j < L[i].vues.length; j++) if (L[i].vues[j].k === r.name) return { onglet: L[i], vue: L[i].vues[j] };
    }
    return null;
  }

  // Le premier écran du premier onglet : c'est l'ouverture de l'app (l'accueil à tuiles n'existe plus).
  function ouverture() {
    var L = liste();
    for (var i = 0; i < L.length; i++) { var k = premier(L[i]); if (k) return k; }
    return null;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function premier(o) { for (var j = 0; j < o.vues.length; j++) if (o.vues[j].k && !o.vues[j].cache) return o.vues[j].k; return ''; }
  function visibles(o) { return o.vues.filter(function (v) { return !v.cache; }); }

  // Barre d'onglets (dans la barre du haut) : mêmes classes que JARVIS (.tp-menu / .tp-m / .on), plus gx-onglets.
  function barre() {
    var ici = ou(), L = liste();
    if (!L.length) return '';
    return '<nav class="tp-menu gx-onglets" aria-label="Rubriques">' + L.map(function (o) {
      var on = !!(ici && ici.onglet.id === o.id), k = premier(o);
      return '<a class="tp-m' + (on ? ' on' : '') + '" href="#' + esc(k) + '"' + (on ? ' aria-current="page"' : '') +
        ' data-gx-k="' + esc(k) + '" onclick="return V2.groupementOnglets.aller(event,this)">' + esc(o.nom) + '</a>';
    }).join('') + '</nav>';
  }

  // Rangée des vues de l'onglet ouvert, sous la barre : seulement quand l'onglet réunit plusieurs écrans.
  function vues() {
    var ici = ou(), V = ici ? visibles(ici.onglet) : [];
    if (V.length < 2) return '';
    return '<nav class="gx-vues" aria-label="' + esc(ici.onglet.nom) + '"><div class="gx-vues-in">' + V.map(function (v) {
      if (v.doc) return '<button type="button" class="gx-vue gx-vue-doc" onclick="V2.ouvrirDocProtege(\'' + esc(v.doc) + '\')">' + esc(v.nom) + '</button>';
      var on = v.k === ici.vue.k;
      return '<a class="gx-vue' + (on ? ' on' : '') + '" href="#' + esc(v.k) + '"' + (on ? ' aria-current="page"' : '') +
        ' data-gx-k="' + esc(v.k) + '" onclick="return V2.groupementOnglets.aller(event,this)">' + esc(v.nom) + '</a>';
    }).join('') + '</div></nav>';
  }

  // Un clic : même chemin que le reste de l'app (V2.go) ; avec un modificateur, le navigateur ouvre un nouvel onglet.
  function aller(e, a) {
    if (!e || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return true;
    e.preventDefault();
    var k = a.getAttribute('data-gx-k');
    if (k && pg(k)) V2.go(k);
    return false;
  }

  V2.groupementOnglets = { liste: liste, ou: ou, ouverture: ouverture, remplace: remplace, barre: barre, vues: vues, aller: aller };
})();
