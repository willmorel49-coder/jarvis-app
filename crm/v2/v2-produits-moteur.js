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

  // Agrégat d'un groupe : pour chaque CIP, combien d'officines du groupe
  // l'achètent réellement (net > 0) et pour quel montant cumulé.
  // Mémorisé sur l'index : une seule fois par clé, quel que soit le nombre
  // d'officines qui s'en servent. Sans ça, la vue Achats recalculerait le
  // même agrégat une fois par officine — des millions d'opérations.
  M.agregatGroupe = function (idx, cle) {
    idx._agg = idx._agg || {};
    if (idx._agg[cle]) return idx._agg[cle];
    var membres = idx.membres[cle] || [];
    var cnt = {}, som = {}, i, cip;
    for (i = 0; i < membres.length; i++) {
      var v = idx.netParOfficine[membres[i]];
      if (!v) continue;
      for (cip in v) {
        if (!Object.prototype.hasOwnProperty.call(v, cip)) continue;
        if (!(v[cip] > 0)) continue;
        cnt[cip] = (cnt[cip] || 0) + 1;
        som[cip] = (som[cip] || 0) + v[cip];
      }
    }
    idx._agg[cle] = { cnt: cnt, som: som, taille: membres.length };
    return idx._agg[cle];
  };

  M.listingOfficine = function (idx, phId, opts) {
    opts = opts || {};
    var seuil = opts.seuil == null ? M.SEUIL_PEERS : opts.seuil;
    var stock = opts.stock || {};
    var exigerStock = opts.exigerStock !== false;

    var grp = M.groupeComparaison(idx, phId);
    if (!grp) return { groupe: null, nbConfreres: 0, lignes: [] };

    var id = String(phId);
    var mien = idx.netParOfficine[id] || {};
    var agg = M.agregatGroupe(idx, grp.cle);
    // L'officine cible appartient au groupe agrégé : on retire sa propre
    // contribution pour ne compter que les confrères.
    var dansLeGroupe = (idx.membres[grp.cle] || []).indexOf(id) >= 0;
    var n = grp.taille - (dansLeGroupe ? 1 : 0);
    if (n <= 0) return { groupe: grp, nbConfreres: 0, lignes: [] };

    var out = [], cip;
    for (cip in agg.cnt) {
      if (!Object.prototype.hasOwnProperty.call(agg.cnt, cip)) continue;
      if (mien[cip] > 0) continue;                       // elle le prend déjà
      // L'agrégat ne compte que les officines dont le net est > 0. La cible
      // ayant été écartée juste au-dessus, sa contribution est forcément
      // nulle : rien à retrancher ici, seul le dénominateur change.
      var peers = agg.cnt[cip], somme = agg.som[cip];
      if (peers <= 0) continue;
      var pct = peers / n;
      if (pct < seuil) continue;
      var st = +stock[cip] || 0;
      if (exigerStock && !(st > 0)) continue;
      var moy = somme / peers;
      out.push({
        cip: cip, peers: peers, pctPeers: pct, caMoyen: moy,
        potentiel: moy * pct, stock: st
      });
    }
    out.sort(function (a, b) { return b.potentiel - a.potentiel; });
    return { groupe: grp, nbConfreres: n, lignes: out };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2PRODUITS = M;
})(typeof window !== 'undefined' ? window : this);
