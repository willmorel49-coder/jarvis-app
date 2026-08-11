/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Moteur du listing produits (V2PRODUITS)
   Répond à : « que prennent les confrères de cette officine, qu'elle
   ne prend pas chez nous ? ». Fichier PUR : aucun DOM, aucun réseau,
   aucun V2.*. Il tourne aussi bien dans le navigateur que sous
   `node --test`. Même contrat que v2-rdv-creneaux.js.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  // Part des confrères qui doivent déjà prendre le produit pour qu'il
  // vaille la peine d'être proposé. Mesuré sur les données de prod le
  // 11/08/2026 : 50 % laisse 101 officines sous 5 produits, 20 % noie
  // la liste (188 produits). 30 % = 87 produits, aucune officine à vide.
  M.SEUIL_PEERS = 0.30;
  // Taille minimale d'un groupe pour que la comparaison ait un sens.
  M.MIN_GROUPE = 5;
  // Nombre de mois couverts par WML_SALES (jan.–juin 2026).
  M.MOIS_COUVERTS = 6;

  M.trancheCA = function (ca) {
    ca = +ca || 0;
    if (ca < 10000) return 'a';
    if (ca < 30000) return 'b';
    if (ca < 60000) return 'c';
    return 'd';
  };

  M.dept = function (cp) {
    var s = String(cp == null ? '' : cp).trim().slice(0, 2);
    return s ? s : null;
  };

  M.indexer = function (officines, ventes) {
    var idx = { officines: {}, netParOfficine: {}, qteParCip: {}, cles: {}, membres: {} };
    var i, o, id;

    officines = officines || [];
    for (i = 0; i < officines.length; i++) {
      o = officines[i];
      id = String(o.id);
      idx.officines[id] = {
        id: id,
        groupement: String(o.groupement || '').trim(),
        cp: o.cp,
        ca: +o.ca || 0
      };
      var t = M.trancheCA(o.ca), d = M.dept(o.cp);
      idx.cles[id] = {
        grp: idx.officines[id].groupement ? 'g:' + idx.officines[id].groupement : null,
        deptTranche: d ? 'd:' + d + '|' + t : null,
        tranche: 't:' + t
      };
      var cs = idx.cles[id];
      if (cs.grp) (idx.membres[cs.grp] = idx.membres[cs.grp] || []).push(id);
      if (cs.deptTranche) (idx.membres[cs.deptTranche] = idx.membres[cs.deptTranche] || []).push(id);
      (idx.membres[cs.tranche] = idx.membres[cs.tranche] || []).push(id);
    }

    ventes = ventes || [];
    for (i = 0; i < ventes.length; i++) {
      var v = ventes[i];
      var ph = String(v.pharmacyId), cip = String(v.artCode);
      if (!idx.officines[ph]) continue;      // vente orpheline : ignorée
      var m = idx.netParOfficine[ph] || (idx.netParOfficine[ph] = {});
      m[cip] = (m[cip] || 0) + (+v.mntNetHt || 0);
      idx.qteParCip[cip] = (idx.qteParCip[cip] || 0) + (+v.qte || 0);
    }
    return idx;
  };

  M.groupeComparaison = function (idx, phId) {
    var id = String(phId);
    var cible = idx.officines[id];
    if (!cible) return null;
    var cs = idx.cles[id];

    if (cs.grp && (idx.membres[cs.grp] || []).length >= M.MIN_GROUPE) {
      return {
        type: 'groupement', cle: cs.grp,
        libelle: 'confrères ' + cible.groupement,
        taille: idx.membres[cs.grp].length
      };
    }
    if (cs.deptTranche && (idx.membres[cs.deptTranche] || []).length >= M.MIN_GROUPE) {
      return {
        type: 'comparables', cle: cs.deptTranche,
        libelle: 'officines comparables',
        taille: idx.membres[cs.deptTranche].length
      };
    }
    return {
      type: 'taille', cle: cs.tranche,
      libelle: 'officines de taille comparable',
      taille: (idx.membres[cs.tranche] || []).length
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2PRODUITS = M;
})(typeof window !== 'undefined' ? window : this);
