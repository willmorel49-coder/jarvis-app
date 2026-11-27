/* ════════════════════════════════════════════════════════════════
   Réglages COMMUNS des écrans de tournées (27/11/2026) : l'écran Tournées de JARVIS (v2-tournees.js, v2-tournees-carte.js)
   et la carte « Nos tournées et les adhérentes » des apps de groupement (groupements/v2/groupement-tournees.js).
   Demande de Will (27/11/2026), mot pour mot : « il y a aussi SOP sud ouest pharma qui a potentiellement 2 pharma possible a livrer,
   d'ailleurs met de la couleur et de l'interactivité par rapport au tournées de livraisons concerné par les pharma groupement ! »
   puis « adapte sur opso santé et pareil sur cpr et ur les tournée aussi ops sur jarvis fait tout ca propre et sop aussi ».
   Maquette choisie (clic de Will, 27/11) : M2 « Par tournée » (atelier ~/jarvis-preuves/tournees-couleurs-2026-11-27/m2.html).

   - PALETTE : 12 couleurs de tournée, texte blanc posé dessus ≥ 4,5:1 (mesuré le 27/11 : 4,65 à 9,93), écart entre deux couleurs ≥ 7,5
     (OKLab × 100). Au-delà de 12 tournées on reprend au début : le CODE de la tournée est toujours écrit à côté de sa couleur.
   - couleurs(codes) : une couleur par code, dans l'ordre donné (deux codes différents de la même liste ont deux couleurs différentes
     tant qu'ils sont 12 ou moins). Chaque écran passe SA liste (toutes les tournées d'un établissement, ou les seules tournées concernées).
   - GRIS : tournée qui ne touche aucune officine mise en avant. SANS : établissement dont les tournées ne sont pas encore reçues.
   - DEPOTS_SANS_TOURNEES : dépôts dont le fichier de tournées n'est pas encore arrivé. Coordonnées = celles de crm/v2/v2-carte.js (DEPOTS),
     contrôlées égales par tests/tournees-partage.test.mjs.
   - LIVRABLES : officines qu'un établissement SANS tournées pourrait livrer — DÉCISION DE WILL, jamais calculée (une règle « dépôt le plus
     proche » rattacherait 69 adhérentes OPSO et 6 Essentiels à Escale Pharma : mesuré le 27/11/2026, faux). SOP : choix cliqué du 27/11/2026
     (« Ces 2, fichier SOP à venir ») : 2080814 Courtial-Tronche (Beaulieu-sur-Dordogne, 19) et 2016822 Morlens (Le Bouscat, 33).
     Quand le fichier des tournées SOP arrive, SOP sort de DEPOTS_SANS_TOURNEES et ses tournées entrent dans le fichier protégé.
   - GROUPEMENTS_SUIVIS : groupements dont les adhérentes sont mises en avant sur la carte de l'écran Tournées de JARVIS.
   ════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};
  var PALETTE = ['#2358D6', '#B5179E', '#B45309', '#6D28D9', '#0F766E', '#C81E3A', '#4D7C0F', '#0A7BB5', '#3730A3', '#7C4A1E', '#8A6100', '#9D174D'];
  var api = {
    PALETTE: PALETTE,
    GRIS: '#B8BEC6',
    SANS: '#1F2937',
    couleurs: function (codes) {
      var m = {}, n = 0;
      (codes || []).forEach(function (c) { if (c != null && !Object.prototype.hasOwnProperty.call(m, c)) m[c] = PALETTE[n++ % PALETTE.length]; });
      return m;
    },
    DEPOTS_SANS_TOURNEES: {
      SOP: { s: 'SOP', nom: 'Sud Ouest Pharma', ville: 'Montayral', lat: 44.4783, lng: 0.9389 }
    },
    LIVRABLES: {
      SOP: ['2080814', '2016822']
    },
    // Groupements dont les adhérentes sont mises en avant sur les cartes de tournées (ceux qui ont leur app : OPSO Santé, Essentiels Pharma).
    // Noms CANONIQUES (crm/v2/groupement-alias.js, GRP_ALIAS).
    GROUPEMENTS_SUIVIS: ['OPSO Santé', 'Essentiels Pharma']
  };
  V2.tourneesPartage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
