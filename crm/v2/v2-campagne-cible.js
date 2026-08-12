/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Qui vise-t-on ? (V2CIBLE)

   Recense les officines d'un commercial en réunissant DEUX sources qui ne
   se parlent pas :
     · V2.pharmacies — ses clients, venus des ventes réseau (WML)
     · PHARMA_FR     — la base nationale, seule à porter le groupement,
                       le segment (client/prospect) et le commercial

   Le CIP est la clé commune. Une officine présente des deux côtés est
   comptée UNE fois, et c'est la source WML qui gagne sur le statut : elle
   sait qui achète vraiment, la base nationale se trompe (segment PHARMA_FR
   faux, cf. la réconciliation déjà faite dans la carte).

   Fichier PUR : aucun DOM, aucun réseau, aucun V2.*. Il tourne dans le
   navigateur comme sous `node --test`.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  // Colonnes de PHARMA_FR :
  // [lat, lng, uga, grp, seg, comm, nom, ville, cp, tel, titulaire, email, ca, id]
  var COL = { grp: 3, seg: 4, comm: 5, nom: 6, ville: 7, cp: 8, email: 11, id: 13 };

  function txt(v) { return String(v == null ? '' : v).trim(); }
  function dept(cp) { return txt(cp).slice(0, 2); }
  // Comparaison insensible aux accents et à la casse : « Élan Pharmacie »
  // et « elan pharmacie » sont le même groupement pour une recherche.
  function pliage(s) {
    return txt(s).toLowerCase().normalize
      ? txt(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      : txt(s).toLowerCase();
  }

  /**
   * Réunit les deux sources en une seule liste d'officines.
   * @param {object} src
   *   pharmacies  : [{id, name, cp, ville}]  — clients du commercial (WML)
   *   national    : {p:[], seg:[], grp:[], comm:[]} — PHARMA_FR, facultatif
   *   commercial  : nom du commercial pour filtrer les prospects, facultatif
   *                 (vide = on prend tous les prospects de la base)
   *   info        : fonction(cip) -> {nom, ville, cp, email}, facultative
   * @returns {Array} officines normalisées, sans doublon de CIP
   */
  M.recenser = function (src) {
    src = src || {};
    var info = typeof src.info === 'function' ? src.info : function () { return {}; };
    var nat = src.national || null;
    var parCip = {}, out = [];

    function ajouter(o) {
      var cle = txt(o.cip);
      if (!cle) return;
      if (parCip[cle]) {                       // déjà vu : on complète les trous
        var d = parCip[cle];
        if (!d.email && o.email) d.email = o.email;
        if (!d.groupement && o.groupement) d.groupement = o.groupement;
        if (!d.ville && o.ville) d.ville = o.ville;
        if (!d.cp && o.cp) { d.cp = o.cp; d.dept = dept(o.cp); }
        return;
      }
      parCip[cle] = o; out.push(o);
    }

    // Index du national par CIP, pour retrouver le groupement d'un client.
    var idxNat = {};
    if (nat && nat.p) {
      for (var i = 0; i < nat.p.length; i++) {
        var id = txt(nat.p[i][COL.id]);
        if (id) idxNat[id] = nat.p[i];
      }
    }
    function grpDe(ligne) {
      if (!ligne || !nat || !nat.grp) return '';
      var g = txt(nat.grp[ligne[COL.grp]]);
      return (g && g !== '—') ? g : '';
    }

    // 1) Les clients du commercial. Ils sont clients par définition :
    //    ils apparaissent dans ses ventes.
    (src.pharmacies || []).forEach(function (p) {
      var cip = txt(p.id), n = idxNat[cip] || null, inf = info(cip) || {};
      ajouter({
        cip: cip,
        nom: txt(p.name || inf.nom || (n ? n[COL.nom] : '')),
        ville: txt(p.ville || inf.ville || (n ? n[COL.ville] : '')),
        cp: txt(p.cp || inf.cp || (n ? n[COL.cp] : '')),
        dept: dept(p.cp || inf.cp || (n ? n[COL.cp] : '')),
        email: txt(inf.email || (n ? n[COL.email] : '')),
        type: 'client',
        groupement: grpDe(n)
      });
    });

    // 2) Les prospects de la base nationale. On EXCLUT ceux déjà connus
    //    comme clients : le segment du national est faux pour eux.
    if (nat && nat.p && nat.seg) {
      var vise = pliage(src.commercial || '');
      for (var j = 0; j < nat.p.length; j++) {
        var l = nat.p[j], cip2 = txt(l[COL.id]);
        if (!cip2 || parCip[cip2]) continue;
        if (txt(nat.seg[l[COL.seg]]) !== 'Prospect') continue;
        if (vise) {
          var c = nat.comm ? pliage(nat.comm[l[COL.comm]]) : '';
          if (c !== vise) continue;
        }
        var inf2 = info(cip2) || {};
        ajouter({
          cip: cip2,
          nom: txt(l[COL.nom] || inf2.nom),
          ville: txt(l[COL.ville] || inf2.ville),
          cp: txt(l[COL.cp] || inf2.cp),
          dept: dept(l[COL.cp] || inf2.cp),
          email: txt(inf2.email || l[COL.email]),
          type: 'prospect',
          groupement: grpDe(l)
        });
      }
    }

    return out;
  };

  /**
   * Filtre la liste recensée.
   *   type        : 'tous' | 'clients' | 'prospects'
   *   groupements : [] (vide = tous) — « — » désigne « sans groupement »
   *   dept        : '44' ou ''
   *   recherche   : texte libre (nom ou ville)
   *   avecEmail   : true par défaut — sans adresse, on ne peut rien envoyer
   *   opposes     : [cip] qui ont demandé à ne plus être sollicités
   */
  M.filtrer = function (liste, f) {
    f = f || {};
    var sansEmail = f.avecEmail === false;
    var grp = (f.groupements || []).map(pliage);
    var q = pliage(f.recherche || '');
    var opp = {};
    (f.opposes || []).forEach(function (c) { opp[txt(c)] = 1; });

    return (liste || []).filter(function (o) {
      if (opp[o.cip]) return false;
      if (!sansEmail && !o.email) return false;
      if (f.type === 'clients' && o.type !== 'client') return false;
      if (f.type === 'prospects' && o.type !== 'prospect') return false;
      if (f.dept && o.dept !== txt(f.dept)) return false;
      if (grp.length) {
        // « — » = les officines sans groupement connu.
        var g = o.groupement ? pliage(o.groupement) : '—';
        if (grp.indexOf(g) < 0) return false;
      }
      if (q && pliage(o.nom).indexOf(q) < 0 && pliage(o.ville).indexOf(q) < 0) return false;
      return true;
    });
  };

  /** Groupements présents dans la liste, avec leur effectif, du plus gros au plus petit. */
  M.groupements = function (liste) {
    var n = {};
    (liste || []).forEach(function (o) {
      var g = o.groupement || '—';
      n[g] = (n[g] || 0) + 1;
    });
    return Object.keys(n).map(function (g) { return { nom: g, n: n[g] }; })
      .sort(function (a, b) {
        if (a.nom === '—') return 1;            // « sans groupement » toujours en dernier
        if (b.nom === '—') return -1;
        return b.n - a.n || a.nom.localeCompare(b.nom, 'fr');
      });
  };

  /** Compte clients / prospects / joignables : ce qu'on affiche en tête d'écran. */
  M.compter = function (liste) {
    var r = { total: 0, clients: 0, prospects: 0, avecEmail: 0 };
    (liste || []).forEach(function (o) {
      r.total++;
      if (o.type === 'client') r.clients++; else r.prospects++;
      if (o.email) r.avecEmail++;
    });
    return r;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2CIBLE = M;
})(typeof window !== 'undefined' ? window : globalThis);
