/* ═══════════════════════════════════════════════════════════════════════════
   MOTEUR APPRO — les formules, et rien d'autre : aucun HTML, aucun DOM.
   Extrait de v2-appro.js le 27/09/2026, sans changement de calcul, pour que
   l'écran « La grille et la fiche » et les écrans existants partagent la même
   arithmétique. Un défaut de formule se corrige désormais à UN seul endroit.
   Même motif que v2-produits-moteur.js / v2-produits.js.

   Sources : stock par site = etab-prices-data.js (ETAB_PRICES)
             vitesse de vente = réseau entier sur les mois complets (cipIndex)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  var M = {
    PLANCHER: 14,        // art. R.5124-59 CSP : obligation de service public, stock ≥ deux semaines
    CIBLE: 21,           // cible interne de réassort, en jours de couverture
    CIBLE_TENSION: 30,   // relevée sur une référence en tension/rupture ANSM
    DORMANT: 180,        // au-delà, le stock ne tourne plus — c'est un donneur potentiel
    MINVEL: 5            // seuil de bruit : au moins 5 bts/mois réseau pour être « mouvant »
  };

  /* ── Zone d'une référence : le vocabulaire du métier, pas une échelle de couleurs ──
     ⚠️ Piège déjà payé : ABSENT DE L'INVENTAIRE ≠ INVENTORIÉ À ZÉRO. Sans le drapeau
     `unk`, des centaines de références jamais inventoriées passaient pour « à sec » —
     autant de fausses urgences, et un carnet d'achat gonflé. */
  M.zone = function (o) {
    if (!o) return 'inconnu';
    if (o.unk) return 'inconnu';
    var cov = o.cov;
    if (cov == null) return 'inconnu';
    if (cov < 1) return 'sec';
    if (cov < M.PLANCHER) return 'hors';
    if (cov < M.cible(o)) return 'sous';
    if (cov > M.DORMANT) return 'dormant';
    return 'ok';
  };

  M.LIB = {
    inconnu: 'jamais inventorié',
    sec: 'moins d’un jour',
    hors: 'sous le plancher légal',
    sous: 'sous la cible',
    ok: 'servi',
    dormant: 'dormant'
  };

  /* ⚠️ 27/09/2026 — « à sec » ne veut PAS dire stock nul, mais MOINS D'UN JOUR de
     couverture. Sur les 3 469 références du catalogue, les 20 références classées ici
     ont TOUTES du stock (ex. CIP 3401321104311 : 2 boîtes pour 1 339 ventes/mois).
     La phrase « stock nul » y était donc fausse à chaque fois qu'elle s'affichait. */
  M.VERDICT = {
    sec: { g: 'Commander en urgence',
           p: 'Moins d’un jour de couverture : au premier appel d’officine, la ligne ne suit plus.' },
    hors: { g: 'Commander', p: 'La couverture est sous le plancher légal de deux semaines : l’obligation de service public n’est plus tenue.' },
    sous: { g: 'Commander', p: 'Au-dessus de la loi, sous notre cible interne. Ce n’est pas urgent, c’est du réglage.' },
    dormant: { g: 'Ne rien commander', p: 'Plus de six mois de couverture. Ce stock dort : la question est de l’écouler, pas d’en ajouter.' },
    ok: { g: 'Ne rien faire', p: 'La couverture est dans la cible. Cette ligne n’a pas besoin de vous aujourd’hui.' },
    inconnu: { g: 'Inventorier d’abord', p: 'Cette référence n’a jamais été inventoriée : on ne commande pas sur un stock qu’on ne connaît pas.' }
  };

  M.cible = function (o) { return (o && o.tension) ? M.CIBLE_TENSION : M.CIBLE; };

  /* Quantité conseillée : de quoi revenir à la cible, jamais négative.
     On ne commande pas sur une donnée de stock qui n'existe pas. */
  M.qte = function (o) {
    if (!o || o.unk) return 0;
    return Math.max(0, Math.round(M.cible(o) * ((o.vM || 0) / 30) - (o.st || 0)));
  };

  /* ── Répartition d'une référence entre les 7 sites + couverture par site ──
     ⚠️ Un site SANS LIGNE pour ce produit est « non communiqué » (POS en sept. 2026),
     PAS un site à zéro : il n'est ni donneur ni receveur.
     ⚠️ HYPOTHÈSE ASSUMÉE, à écrire à l'écran : faute de ventes par établissement, la
     demande est supposée répartie à parts égales entre les sept sites. La couverture
     par site est donc un ordre de grandeur, pas une mesure. C'est le premier chiffre
     à remplacer par la vraie donnée. Tout affichage qui s'en sert doit le marquer. */
  M.estime = true;   // drapeau lu par l'affichage : tant qu'il est vrai, la couverture par site est estimée

  M.parSite = function (cip, vM) {
    var EP = window.ETAB_PRICES; if (!EP || !EP.prices || !EP.etabs) return null;
    var codes = EP.etabs.map(function (e) { return e.code; });
    var vD = (vM || 0) / 30 / codes.length, out = [], tot = 0, nc = 0;
    codes.forEach(function (e) {
      var row = EP.prices[e] && EP.prices[e][cip];
      if (!row) { nc++; out.push({ site: e, st: null, cov: null }); return; }
      var st = Math.max(0, row[1] || 0);
      tot += st;
      out.push({ site: e, st: st, cov: vD > 0 ? st / vD : (st > 0 ? 9999 : 0) });
    });
    return { sites: out, tot: tot, nc: nc, n: codes.length };
  };

  /* Transférer entre sites ne sort pas un euro de marchandise : on le propose AVANT
     la commande au laboratoire. Décision n°8 du dossier métier. */
  M.transferts = function (cip, vM) {
    var p = M.parSite(cip, vM); if (!p) return [];
    var don = [], rec = [], mv = [], i;
    p.sites.forEach(function (x) {
      if (x.st == null) return;                       // non communiqué : on n'y touche pas
      if (x.cov >= 9999) { if (x.st > 1) don.push({ site: x.site, st: x.st }); return; }
      if (x.cov > M.DORMANT && x.st > 1) don.push({ site: x.site, st: x.st });
      else if (x.cov < M.PLANCHER) rec.push({ site: x.site, st: x.st, cov: x.cov });
    });
    don.sort(function (a, b) { return b.st - a.st; });
    rec.sort(function (a, b) { return a.cov - b.cov; });
    var di = 0;
    for (i = 0; i < rec.length && di < don.length; i++) {
      var besoin = Math.max(1, Math.round((vM || 0) / 30 / p.n * M.CIBLE - rec[i].st));
      var dispo = Math.max(0, don[di].st - 1);
      var q = Math.min(besoin, dispo);
      if (q > 0) { mv.push({ de: don[di].site, vers: rec[i].site, q: q }); don[di].st -= q; }
      if (don[di].st <= 1) di++;
    }
    return mv;
  };

  /* Tout le stock réseau posé sur un seul site : les six autres ne peuvent pas servir. */
  M.concentre = function (cip, vM) {
    var p = M.parSite(cip, vM); if (!p || p.tot <= 0) return null;
    var mx = 0, site = '';
    p.sites.forEach(function (x) { if (x.st != null && x.st > mx) { mx = x.st; site = x.site; } });
    return (mx / p.tot >= 0.9) ? { site: site, st: mx, part: mx / p.tot } : null;
  };

  /* Libellé d'une couverture en jours — 9999 = du stock mais aucune vente. */
  M.jours = function (k) {
    if (k == null) return '—';
    if (k >= 9999) return 'aucune vente';
    if (k >= 400) return Math.round(k / 30) + ' mois';
    return Math.round(k) + ' j';
  };

  V2.approM = M;
})();
