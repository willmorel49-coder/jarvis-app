/* ═══════════════════════════════════════════════════════════════════
   COPILOTE — socle « cerveau » du copilote pharmacien.
   Un seul endroit qui croise les FEEDS de données (chaque source = 1 feed,
   robot Python → fichier → app). L'appli lit tout via V2.market / V2.zone /
   V2.reco, de façon unifiée. On empile les feeds sans toucher aux écrans.
   Feed #1 : MARCHÉ France par produit (Medic'AM) → window.AMELI_AVG.
   100% client, hors-ligne, zéro dépendance.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  // ── AXE PRODUIT · marché France (indicatif) ──
  // V2.market(cip) → { avgYear, avgMonth, meta } ou null (NR/para non remboursés).
  V2.market = function (cip) {
    var A = window.AMELI_AVG;
    if (!A || !A.data) return null;
    var v = A.data[String(cip)];
    if (v == null) return null;
    return { avgYear: v, avgMonth: Math.round(v / 12 * 10) / 10, meta: A.meta };
  };
  V2.marketMeta = function () { return (window.AMELI_AVG && window.AMELI_AVG.meta) || null; };

  // ── AXE OFFICINE · potentiel de zone (feed à venir : INSEE/FINESS) ──
  V2.zone = V2.zone || function (/* pharmacyId */) { return null; };

  // ── CROISEMENT produit × officine · recommandations (feed à venir) ──
  V2.reco = V2.reco || function (/* pharmacyId */) { return null; };
})();
