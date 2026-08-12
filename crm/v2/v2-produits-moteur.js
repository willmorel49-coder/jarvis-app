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
  // Paliers de repli. 30 % marche pour les 506 officines qui ont un vrai
  // groupement, mais PAS pour les petites officines tombées sur le repli
  // « comparables » : leurs pairs sont d'autres toutes petites officines qui
  // nous achètent peu, et à 30 % leur liste est VIDE (4 cas mesurés le
  // 11/08/2026 : Pharmacie FAURE, Grande Pharmacie des Voûtes, Bajatière,
  // Mirman — de 1 552 € à 6 102 € de CA). On descend d'un cran jusqu'à
  // obtenir MIN_LIGNES produits. Le pourcentage réel reste affiché sur
  // chaque ligne : le commercial voit toujours d'où sort le chiffre.
  M.SEUILS = [0.30, 0.20, 0.10, 0.05];
  M.MIN_LIGNES = 5;
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
    var idx = { officines: {}, netParOfficine: {}, qteParCip: {}, cles: {}, membres: {},
                premierMois: {}, moisMax: 0 };
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
      // Mois de PREMIERE commande : c'est lui qui dit si une reference vient
      // d'entrer chez l'officine. Le fichier mensuel de Will porte la preuve,
      // aucune trace serveur n'est necessaire.
      // v2-boot nomme le champ `month`, les tests `mois` : on accepte les deux.
      var mo = +(v.mois != null ? v.mois : v.month) || 0;
      if (mo > 0) {
        var pm = idx.premierMois[ph] || (idx.premierMois[ph] = {});
        if (pm[cip] === undefined || mo < pm[cip]) pm[cip] = mo;
        if (mo > idx.moisMax) idx.moisMax = mo;
      }
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

  // Un seul passage, à un seuil donné. C'est la primitive ; listingOfficine
  // l'appelle une ou plusieurs fois selon le repli.
  function passe(idx, phId, grp, n, mien, seuil, stock, exigerStock) {
    var agg = M.agregatGroupe(idx, grp.cle);
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
    return out;
  }

  M.listingOfficine = function (idx, phId, opts) {
    opts = opts || {};
    var stock = opts.stock || {};
    var exigerStock = opts.exigerStock !== false;

    var grp = M.groupeComparaison(idx, phId);
    if (!grp) return { groupe: null, nbConfreres: 0, seuil: null, lignes: [] };

    var id = String(phId);
    var mien = idx.netParOfficine[id] || {};
    // L'officine cible appartient au groupe agrégé : on retire sa propre
    // contribution pour ne compter que les confrères.
    var dansLeGroupe = (idx.membres[grp.cle] || []).indexOf(id) >= 0;
    var n = grp.taille - (dansLeGroupe ? 1 : 0);
    if (n <= 0) return { groupe: grp, nbConfreres: 0, seuil: null, lignes: [] };

    // Seuil imposé par l'appelant → un seul passage, strict.
    if (opts.seuil != null) {
      return {
        groupe: grp, nbConfreres: n, seuil: opts.seuil,
        lignes: passe(idx, phId, grp, n, mien, opts.seuil, stock, exigerStock)
      };
    }
    // Repli désactivé → un seul passage au seuil nominal.
    if (opts.garantirMin === false) {
      return {
        groupe: grp, nbConfreres: n, seuil: M.SEUIL_PEERS,
        lignes: passe(idx, phId, grp, n, mien, M.SEUIL_PEERS, stock, exigerStock)
      };
    }
    // Sinon : on descend les paliers jusqu'à obtenir assez de produits.
    var lignes = [], seuil = M.SEUILS[0], i;
    for (i = 0; i < M.SEUILS.length; i++) {
      seuil = M.SEUILS[i];
      lignes = passe(idx, phId, grp, n, mien, seuil, stock, exigerStock);
      if (lignes.length >= M.MIN_LIGNES) break;
    }
    return { groupe: grp, nbConfreres: n, seuil: seuil, lignes: lignes };
  };

  // Combien de mois de stock on tient sur ce produit, au rythme du réseau.
  M.couverture = function (idx, cip, stock) {
    var parMois = (idx.qteParCip[String(cip)] || 0) / M.MOIS_COUVERTS;
    if (!(parMois > 0)) return null;
    return (+((stock || {})[String(cip)]) || 0) / parMois;
  };

  // La même matière, lue par produit : sur combien d'officines ce produit
  // est-il un trou, et pour quel potentiel cumulé.
  M.listingProduits = function (idx, opts) {
    opts = opts || {};
    var stock = opts.stock || {};
    var filtre = opts.filtreGroupement ? String(opts.filtreGroupement).trim() : null;
    var par = {}, id, i, cip;

    for (id in idx.officines) {
      if (!Object.prototype.hasOwnProperty.call(idx.officines, id)) continue;
      if (filtre && idx.officines[id].groupement !== filtre) continue;
      var r = M.listingOfficine(idx, id, opts);
      for (i = 0; i < r.lignes.length; i++) {
        var l = r.lignes[i];
        var e = par[l.cip] || (par[l.cip] = {
          cip: l.cip, officines: 0, potentiel: 0, stock: l.stock, couverture: null
        });
        e.officines += 1;
        e.potentiel += l.potentiel;
      }
    }

    var out = [];
    for (cip in par) {
      if (!Object.prototype.hasOwnProperty.call(par, cip)) continue;
      par[cip].couverture = M.couverture(idx, cip, stock);
      out.push(par[cip]);
    }
    out.sort(function (a, b) { return b.potentiel - a.potentiel; });
    return out;
  };

  // ── Liste sur mesure (prospect) ────────────────────────────────
  // Un prospect n'a aucun historique chez nous : la comparaison aux confrères
  // ne s'applique pas. On part du catalogue et on compose par quotas.

  // Abandon de marge Intégral, barème par tranche (ROBOT.md §10).
  // On prend le BARÈME, pas le net moyen réellement pratiqué : à un prospect
  // on annonce ce à quoi il a droit, pas la moyenne négociée d'un autre.
  M.bareme = function (ppht) {
    ppht = +ppht || 0;
    if (ppht <= 4.33) return 0.18;
    if (ppht <= 468) return Math.round(ppht * 0.0389 * 100) / 100;
    return 19.50;
  };
  // Seuls les princeps portent un abandon de marge. Génériques, NR et
  // biosimilaires : net = tarif, aucun abandon, jamais de chiffre inventé.
  M.porteAbandon = function (fam) { return String(fam || '').indexOf('pr_') === 0; };

  M.FAMILLES = ['pr_low', 'pr_mid', 'pr_high', 'nr', 'gen', 'biosim'];

  // Laboratoires présents dans une famille, du plus fourni au moins fourni.
  // Sert à ne proposer à l'écran que des labos qui existent vraiment en stock.
  M.labosDisponibles = function (produits, fam) {
    var cnt = {}, i, l;
    produits = produits || [];
    for (i = 0; i < produits.length; i++) {
      var p = produits[i];
      if (String(p.fam || '') !== fam) continue;
      if (!(+p.stock > 0)) continue;
      l = p.labo ? String(p.labo).trim() : '';
      if (!l) continue;
      cnt[l] = (cnt[l] || 0) + 1;
    }
    var out = [];
    for (l in cnt) {
      if (Object.prototype.hasOwnProperty.call(cnt, l)) out.push({ nom: l, n: cnt[l] });
    }
    out.sort(function (a, b) { return b.n - a.n || (a.nom < b.nom ? -1 : 1); });
    return out;
  };

  M.listeSurMesure = function (produits, opts) {
    opts = opts || {};
    var quotas = opts.quotas || {};
    var abandonMin = opts.abandonMin || {};
    var labos = opts.labos || {};
    var exclusifs = opts.exclusifs || {};
    var sansRupture = !!opts.sansRupture;
    produits = produits || [];

    // Index des labos retenus par famille, pour un test en temps constant.
    var labosSet = {}, ff, k;
    for (ff in labos) {
      if (!Object.prototype.hasOwnProperty.call(labos, ff)) continue;
      var liste = labos[ff];
      if (!liste || !liste.length) continue;              // liste vide = aucun filtre
      labosSet[ff] = {};
      for (k = 0; k < liste.length; k++) labosSet[ff][String(liste[k]).trim()] = 1;
    }

    var parFam = {}, dispo = {}, i, f;
    for (i = 0; i < M.FAMILLES.length; i++) { parFam[M.FAMILLES[i]] = []; dispo[M.FAMILLES[i]] = 0; }

    for (i = 0; i < produits.length; i++) {
      var p = produits[i];
      f = String(p.fam || '');
      if (!parFam[f]) continue;                       // famille inconnue : ignorée
      if (!(+p.stock > 0)) continue;                  // jamais ce qu'on ne peut pas livrer
      if (sansRupture && p.rupture) continue;
      // Filtre laboratoire : un produit sans labo identifié ne peut pas
      // satisfaire un filtre, il sort. Sans filtre, il reste.
      if (labosSet[f] && !labosSet[f][p.labo ? String(p.labo).trim() : '']) continue;
      if (exclusifs[f] && !p.exclusif) continue;

      var ppht = +p.ppht || 0;
      var porte = M.porteAbandon(f) && ppht > 0;
      var ab = porte ? M.bareme(ppht) : null;
      var pct = porte ? (ab / ppht) * 100 : null;
      // Un seuil d'abandon posé sur une famille qui n'en porte pas ne filtre
      // rien : sinon régler « ≥ 5 % » viderait les génériques sans raison.
      if (porte && abandonMin[f] != null && pct < +abandonMin[f]) continue;

      dispo[f] += 1;
      parFam[f].push({
        cip: p.cip, fam: f, n: +p.n || 0, ppht: ppht, stock: +p.stock || 0,
        rupture: !!p.rupture, labo: p.labo || null, exclusif: !!p.exclusif,
        abandon: ab, abandonPct: pct,
        net: porte ? Math.round((ppht - ab) * 100) / 100 : ppht
      });
    }

    var lignes = [];
    for (i = 0; i < M.FAMILLES.length; i++) {
      f = M.FAMILLES[i];
      var q = +quotas[f] || 0;
      if (q <= 0) continue;
      // « Top » = le plus d'officines du réseau qui nous le prennent.
      parFam[f].sort(function (a, b) { return b.n - a.n; });
      lignes = lignes.concat(parFam[f].slice(0, q));
    }
    return { lignes: lignes, dispo: dispo };
  };

  // ── Suivi d'effet ──────────────────────────────────────────────
  // `moisBase` = dernier mois present dans les donnees AU MOMENT de la
  // proposition. On ne compare pas a une date : le fichier arrive avec du
  // retard, et c'est son avancement qui fait foi.
  M.suiviProposition = function (idx, phId, cips, moisBase) {
    cips = cips || [];
    moisBase = +moisBase || 0;
    var pm = (idx.premierMois || {})[String(phId)] || {};
    var entres = [], enAttente = [], dejaPris = [], i;
    for (i = 0; i < cips.length; i++) {
      var c = String(cips[i]), m = pm[c];
      if (m === undefined) enAttente.push(c);
      else if (m > moisBase) entres.push({ cip: c, mois: m });
      else dejaPris.push(c);
    }
    entres.sort(function (a, b) { return a.mois - b.mois; });
    return {
      total: cips.length, entres: entres, enAttente: enAttente, dejaPris: dejaPris,
      moisRecus: Math.max(0, (idx.moisMax || 0) - moisBase)
    };
  };

  // Ce que l'officine a commence a prendre depuis un mois donne, sans qu'on
  // lui ait rien propose : la mesure marche meme sans proposition enregistree.
  M.nouveautesOfficine = function (idx, phId, depuisMois) {
    var pm = (idx.premierMois || {})[String(phId)] || {};
    depuisMois = +depuisMois || 0;
    var out = [], c;
    for (c in pm) {
      if (!Object.prototype.hasOwnProperty.call(pm, c)) continue;
      if (pm[c] >= depuisMois) out.push({ cip: c, mois: pm[c] });
    }
    out.sort(function (a, b) { return b.mois - a.mois || (a.cip < b.cip ? -1 : 1); });
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2PRODUITS = M;
})(typeof window !== 'undefined' ? window : this);
