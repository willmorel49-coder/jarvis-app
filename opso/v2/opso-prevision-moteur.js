// ═══════════════════════════════════════════════════════════════════
// OPSO Santé — « Prévision du contrat » : le moteur de calcul.
// Propre à OPSO (jamais chargé côté CRM JARVIS).
//
// ⚠️ CE FICHIER NE PORTE AUCUN CHIFFRE DU PLAN : ni seuil, ni taux, ni panier, ni marge,
// ni produit. Le dépôt est public et le plan est confidentiel. Tout cela vit dans le fichier
// protégé `window.OPSO_PREVISION` (opso-prevision-2027-data.js, seau Supabase fermé, clé
// `opsoprevision` de PROTEGES dans v2-boot.js), chargé à la demande pour les seuls comptes
// autorisés. Ici : la mécanique seule (RFA par quadrimestre, année mois par mois, panier
// produit par produit, mise en forme).
//
// `OPSO_PREVISION_MOTEUR(D)` rend le moteur pour un jeu de données D (testé hors navigateur,
// tests/opso-prevision-moteur.test.mjs, avec un plan inventé).
// ═══════════════════════════════════════════════════════════════════
(function (G) {
  'use strict';

  function creer(D) {
    var P = D.plan;
    var MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    var MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    // Notre marge par pharmacie et par mois : droite qui passe par les paliers du plan (ils sont alignés), prolongée au-delà.
    var dern = P.BUD.length - 1;
    var pente = (P.MARG[dern] - P.MARG[0]) / (P.BUD[dern] - P.BUD[0]);
    function margeDe(b) { return P.MARG[0] + (b - P.BUD[0]) * pente; }

    function defauts() {
      return { n: P.NEUF, b: P.BUD[0], palier: 0, seuils: P.SEUILS.map(function (s) { return s.slice(); }), taux: P.TAUX.slice() };   // seuils[quadrimestre][cran]
    }

    // RFA d'un quadrimestre de nq mois : chaque taux sur la seule part au-dessus de nq × seuil mensuel de CE quadrimestre (s = seuils des crans)
    function rfa(x, nq, s, t) {
      var r = x * t[0];
      for (var i = 1; i < t.length; i++) r += Math.max(0, x - nq * s[i]) * (t[i] - t[i - 1]);
      return r;
    }
    function cranDe(x, nq, s) { var c = 0; for (var i = 0; i < s.length; i++) if (s[i] === 0 || x > nq * s[i]) c = i; return c; }

    /* Année mois par mois.
       reel : mois réels déjà connus et complets [{retenu, actives, nouvelles, marge}] (vide tant qu'aucun mois n'est complet).
       Les mois sans ventes suivent le réglage (o.n nouvelles par mois, o.b € par pharmacie) à partir du dernier mois connu. */
    function annee(o, reel) {
      reel = reel || [];
      var k = reel.length, depart = k ? reel[k - 1].actives : P.P0, mois = [];
      for (var m = 1; m <= 12; m++) {
        if (m <= k) {
          var r = reel[m - 1];
          mois.push({ m: m, reel: true, ca: r.retenu, eff: r.actives, fin: r.actives, neuf: r.nouvelles, marge: r.marge });
        } else {
          var j = m - k, eff = Math.min(depart + o.n * (j - 0.5), P.CAP), fin = Math.min(depart + o.n * j, P.CAP);
          var neuf = Math.min(o.n, Math.max(0, P.CAP - depart - o.n * (j - 1)));
          mois.push({ m: m, reel: false, ca: o.b * eff, eff: eff, fin: fin, neuf: neuf, marge: margeDe(o.b) * eff });
        }
      }
      var quads = P.quads.map(function (q, qi) {
        var ms = mois.slice(q.de - 1, q.a), nq = ms.length;
        var ca = ms.reduce(function (s, x) { return s + x.ca; }, 0);
        var sq = o.seuils[qi], cran = cranDe(ca, nq, sq), suivant = cran < sq.length - 1 ? nq * sq[cran + 1] : null;
        return { nom: q.nom, echeance: q.echeance, de: q.de, a: q.a, nq: nq, ca: ca,
                 rfa: rfa(ca, nq, sq, o.taux), cran: cran, taux: o.taux[cran],
                 seuilSuivant: suivant, manque: suivant === null ? 0 : Math.max(0, suivant - ca) };
      });
      var sumEff = mois.reduce(function (s, x) { return s + x.eff; }, 0);
      var marge = mois.reduce(function (s, x) { return s + (x.marge == null ? margeDe(o.b) * x.eff : x.marge); }, 0);
      var tot = {
        ca: mois.reduce(function (s, x) { return s + x.ca; }, 0),
        rfa: quads.reduce(function (s, q) { return s + q.rfa; }, 0),
        marge: marge, livr: sumEff * P.LIV * P.COUT,
        primes: P.PRIME * mois.reduce(function (s, x) { return s + x.neuf; }, 0),
        dec: mois[11].ca, finDec: mois[11].fin, moisPh: sumEff
      };
      tot.reste = tot.marge - tot.rfa - tot.livr - tot.primes;
      return { mois: mois, quads: quads, tot: tot };
    }

    /* Du réel au calcul : les mois COMPLETS de l'année (lus dans les ventes de l'app) deviennent `reel`,
       et la suite de l'année suit le rythme constaté (nouvelles pharmacies par mois depuis le départ, panier des 3 derniers mois).
       mois : tableau [{retenu, actives, nouvelles}] du premier mois au dernier mois complet. */
    function constate(mois) {
      var k = mois.length;
      if (!k) return null;
      var reel = mois.map(function (x) {
        // marge estimée avec la règle du plan (même droite), faute de marge réelle par mois
        return { retenu: x.retenu, actives: x.actives, nouvelles: x.nouvelles, marge: x.actives ? margeDe(x.retenu / x.actives) * x.actives : 0 };
      });
      var rythme = Math.max(0, (reel[k - 1].actives - P.P0) / (k - 0.5));
      var der = reel.slice(Math.max(0, k - 3));
      var act = der.reduce(function (s, x) { return s + x.actives; }, 0);
      var panier = act ? der.reduce(function (s, x) { return s + x.retenu; }, 0) / act : P.BUD[0];
      return { reel: reel, rythme: rythme, panier: panier };
    }

    /* D'où viennent les chiffres : panier d'une pharmacie = catalogue produit par produit × rotation + autres achats mesurés.
       Rotation d'un produit = rythme moyen du réseau + a × (rythme des pharmacies qui le commandent − rythme moyen) ;
       le palier k (0 à dern) ⇒ a = k / dern. Un panier libre donne a par la même droite ; hors des paliers, a est borné et on le dit. */
    function detail(o) {
      var X = D.detail, a = (o.b - P.BUD[0]) / (P.BUD[dern] - P.BUD[0]), aa = Math.min(1, Math.max(0, a));
      var cat = { ca: 0, retenu: 0, marge: 0, boites: 0 };
      var lignes = X.lignes.map(function (x) {
        var rot = x.rm + aa * (x.ra - x.rm), ca = rot * x.n, mg = rot * x.mb;
        cat.ca += ca; cat.marge += mg; cat.boites += rot; if (x.rfa) cat.retenu += ca;
        return { x: x, rot: rot, ca: ca, marge: mg };
      });
      var A = X.autres;
      return { a: aa, horsBornes: a < -1e-9 || a > 1 + 1e-9, lignes: lignes, cat: cat, autres: A,
               panier: { ca: cat.ca + A.ca, retenu: cat.retenu + A.retenu, marge: cat.marge + A.marge } };
    }

    // ---------- affichage ----------
    var nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
    var nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
    var nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var nf3 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
    var nfp = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function eur(x) { return nf0.format(Math.round(x)) + ' €'; }
    function e2(x) { return nf2.format(x) + ' €'; }
    function keur(x) { return x >= 1e6 ? nf1.format(Math.round(x / 1e5) / 10) + ' M€' : nf0.format(Math.round(x / 1000)) + ' k€'; }
    function kE(x) { return nf0.format(x / 1000) + ' k€'; }   // en milliers précis : un montant arrondi au million se lirait comme un seuil
    function pct(t) { return nfp.format(t * 100) + ' %'; }
    function nb(x) { return nf0.format(Math.round(x)); }
    function signe(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + eur(Math.abs(x)); }
    function rot(x) { return x >= 0.1 ? nf2.format(x) : x >= 0.001 ? nf3.format(x) : '< 0,001'; }

    return { D: D, P: P, MOIS: MOIS, MOIS_L: MOIS_L, defauts: defauts, annee: annee, constate: constate, detail: detail,
             rfa: rfa, cranDe: cranDe, margeDe: margeDe, eur: eur, e2: e2, keur: keur, kE: kE, pct: pct, nb: nb, signe: signe, rot: rot };
  }

  G.OPSO_PREVISION_MOTEUR = creer;
  if (typeof module !== 'undefined' && module.exports) module.exports = creer;
})(typeof window !== 'undefined' ? window : globalThis);
