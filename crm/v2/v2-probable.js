/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Estimation « probable » du grossiste / génériqueur (V2.probableParGroupement)
   23/09/2026 — demande de Will : « pour là où on n'a pas la donnée, il faut qu'on
   mette quand même, en fonction des groupements dont font partie les pharmacies,
   les données grossistes / génériqueurs les plus probables en fonction des
   officines clientes qu'on a déjà, ça fait des probabilités ».

   Construit UNE FOIS (puis en cache mémoire, jamais en base) la répartition des
   valeurs CONNUES de chaque groupement CANONIQUE (V2.canonGrp), à partir de deux
   sources, saisie de l'équipe prioritaire :
     grossiste   : V2.profil.loadScope('client') → data.gros1, sinon CLIENTS_ACTIFS.d[id][18]
     génériqueur : data.gen1, sinon CLIENTS_ACTIFS.d[id][10] (1ʳᵉ valeur avant « / »)
   Ne retourne une estimation QUE si le groupement compte au moins 5 officines
   connues pour ce champ ET que la valeur dominante y pèse au moins 40 % — et
   JAMAIS pour un champ que l'officine elle-même a déjà (saisi ou base clients).
   Rien n'est écrit dans le Profil commercial ni en base : c'est un affichage
   à part, recalculé au chargement.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  var SEUIL_N = 5, SEUIL_PART = 0.4;

  var _cache = null;       // { grosByGrp, genByGrp, saisieMap } une fois construit
  var _building = false;

  function canonG(g) { return (V2.canonGrp ? V2.canonGrp(g) : g) || g; }

  function pharmaFrRow(pid) {
    var D = window.PHARMA_FR; if (!D || !D.p) return null;
    for (var i = 0; i < D.p.length; i++) { if (String(D.p[i][13]) === String(pid)) return D.p[i]; }
    return null;
  }

  // Groupement CANONIQUE d'une officine : pharma.groupement pour une cliente
  // (overrides déjà appliqués, V2.pharmacies), PHARMA_FR D.grp[p[3]] pour un
  // prospect — même règle que la fiche officine et la carte.
  function groupementOf(pid) {
    var cli = (V2.pharmacies || []).filter(function (p) { return String(p.id) === String(pid); })[0];
    if (cli) {
      var g = String(cli.groupement || '').trim();
      return (g && g !== '—') ? canonG(g) : '';
    }
    var row = pharmaFrRow(pid);
    if (row) {
      var D = window.PHARMA_FR;
      var gg = (D.grp[row[3]] && D.grp[row[3]] !== '—') ? D.grp[row[3]] : '';
      return gg ? canonG(gg) : '';
    }
    return '';
  }

  // Libellés des fichiers (« Phoenix », « Eg », « Mylan », « Viatris »…) alignés sur les
  // listes du Profil commercial (v2-profil.js) : sans ça, « Mylan » et « Viatris » — le même
  // laboratoire — se partageaient les voix et faussaient la part. « Autre » n'est pas une valeur.
  var ALIAS = {
    'PHOENIX': 'Phoenix Pharma', 'CERP BA': 'CERP Bretagne Atlantique', 'ALLIANCE H.': 'Alliance Healthcare',
    'ALLIANCE': 'Alliance Healthcare', 'GIPHAR': 'Giphar Répartition', 'MYLAN': 'Viatris (Mylan)', 'VIATRIS': 'Viatris (Mylan)',
    'EG': 'EG Labo', 'EVOLUGEN': 'Evolupharm', 'AUTRE': ''
  };
  function normVal(v) {
    var s = String(v || '').trim(); if (!s) return '';
    var k = s.toUpperCase();
    return ALIAS.hasOwnProperty(k) ? ALIAS[k] : s;
  }
  V2.normFournisseur = normVal;
  function genFirst(v) { return normVal(String(v || '').split(' / ')[0]); }

  function buildCache() {
    if (_building || _cache) return;
    // Sans la base clients (fichier protégé, arrivé après la connexion), le calcul se ferait
    // sur zéro donnée et resterait figé : on attend qu'elle soit là (prochain rendu).
    if (!window.CLIENTS_ACTIFS || !window.CLIENTS_ACTIFS.d) return;
    _building = true;
    // Le groupement des prospects dépend de PHARMA_FR : on l'assure avant de bâtir,
    // sinon leurs saisies (rares) resteraient orphelines de groupement.
    if (!window.PHARMA_FR && V2.ensurePharmaFr) { V2.ensurePharmaFr(buildReal); return; }
    buildReal();
  }

  function buildReal() {
    var saisiesP = (V2.profil && V2.profil.loadScope) ? V2.profil.loadScope('client') : Promise.resolve([]);
    saisiesP.then(function (list) {
      var saisieMap = {};
      (list || []).forEach(function (r) {
        if (!r || r.sid == null) return;
        var d = r.data || {};
        var gros1 = normVal(d.gros1), gen1 = normVal(d.gen1);
        if (gros1 || gen1) saisieMap[String(r.sid)] = { gros1: gros1, gen1: gen1 };
      });
      var caD = (window.CLIENTS_ACTIFS || {}).d || {};
      var ids = {};
      Object.keys(caD).forEach(function (id) { ids[id] = 1; });
      Object.keys(saisieMap).forEach(function (id) { ids[id] = 1; });

      var grosByGrp = {}, genByGrp = {};
      Object.keys(ids).forEach(function (id) {
        var s = saisieMap[id] || {};
        var caB = caD[id] || null;
        var gros = s.gros1 || (caB ? normVal(caB[18]) : '');
        var gen = s.gen1 || (caB ? genFirst(caB[10]) : '');
        if (!gros && !gen) return;
        var grp = groupementOf(id);
        if (!grp) return;
        if (gros) {
          var b = grosByGrp[grp] || (grosByGrp[grp] = { counts: {}, total: 0 });
          b.counts[gros] = (b.counts[gros] || 0) + 1; b.total++;
        }
        if (gen) {
          var b2 = genByGrp[grp] || (genByGrp[grp] = { counts: {}, total: 0 });
          b2.counts[gen] = (b2.counts[gen] || 0) + 1; b2.total++;
        }
      });
      _cache = { grosByGrp: grosByGrp, genByGrp: genByGrp, saisieMap: saisieMap };
      _building = false;
      // Ré-affiche la fiche déjà ouverte une fois l'estimation disponible (même
      // logique que _oiAsked / _clientsAsked dans v2-pharma.js).
      if (V2.route && V2.render) V2.render();
    }).catch(function () { _building = false; });
  }

  function dominant(bucket) {
    if (!bucket || bucket.total < SEUIL_N) return null;
    var best = null, bestN = 0;
    Object.keys(bucket.counts).forEach(function (v) { if (bucket.counts[v] > bestN) { bestN = bucket.counts[v]; best = v; } });
    if (!best) return null;
    var part = bestN / bucket.total;
    if (part < SEUIL_PART) return null;
    return { val: best, part: Math.round(part * 100), n: bucket.total };
  }

  // Expose la table de correspondance pour la mesure de couverture (script Node/Playwright).
  V2.probableCache = function () { return _cache; };

  V2.probableParGroupement = function (pid) {
    if (!_cache) { buildCache(); return null; }
    var grp = groupementOf(pid);
    var out = { groupement: grp, grossiste: null, generiqueur: null };
    if (!grp) return out;
    var saisie = _cache.saisieMap[String(pid)] || {};
    var caB = ((window.CLIENTS_ACTIFS || {}).d || {})[String(pid)] || null;
    var ownGros = saisie.gros1 || (caB ? normVal(caB[18]) : '');
    var ownGen = saisie.gen1 || (caB ? genFirst(caB[10]) : '');
    if (!ownGros) out.grossiste = dominant(_cache.grosByGrp[grp]);
    if (!ownGen) out.generiqueur = dominant(_cache.genByGrp[grp]);
    return out;
  };

  // Texte lisible (non échappé — à passer dans esc() par l'appelant), ex.
  // « CERP Rouen · 62 % des 13 officines connues de Apothical »
  V2.probableTexte = function (estim, groupementLabel) {
    if (!estim) return '';
    var n = estim.n, plur = n > 1 ? 's' : '';
    return estim.val + ' · ' + estim.part + ' % des ' + n + ' officine' + plur + ' connue' + plur +
      (groupementLabel ? ' de ' + groupementLabel : ' du groupement');
  };
})();
