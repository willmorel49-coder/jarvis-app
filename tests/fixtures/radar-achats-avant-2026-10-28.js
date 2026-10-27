/* FIGÉ LE 28/10/2026 — NE PAS MODIFIER NI « METTRE À JOUR ».
 *
 * Copie de l'ANCIEN `achats()` du radar « Qui inviter » (crm/v2/v2-rdv-radar.js
 * au commit HEAD d'avant le branchement sur V2.decrochage), recopiée mot pour
 * mot par `git show HEAD:crm/v2/v2-rdv-radar.js`.
 *
 * Pourquoi un fichier à part : depuis ce jour, le vrai `achats()` appelle le
 * moteur (v2-decrochage-moteur.js). Si le test de parité (cas 7 de
 * tests/decrochage-moteur.test.mjs) continuait à extraire `achats()` du radar,
 * il comparerait le moteur à lui-même — un test circulaire, toujours vert.
 * Cette copie est la règle d'AVANT, calculée à la main : c'est elle qui sert
 * de référence indépendante.
 *
 * Ce fichier n'est chargé par aucune page : seuls les tests le lisent.
 */
  function achats() {
    var moiC = moi();
    var toutes = V2.sales || [];
    // Sans commercial rattaché, le portefeuille est vide de toute façon
    // (`recenser()` rend une liste vide) : on garde le réseau pour ne pas
    // diviser par zéro, aucun officine ne sera noté.
    var s = moiC ? toutes.filter(function (v) { return v.commercial === moiC; }) : toutes;
    var m = {}, i, parMois = {};
    for (i = 0; i < s.length; i++) {
      if (!s[i].month || !s[i].year) continue;
      var mk0 = s[i].year * 12 + (s[i].month - 1);
      parMois[mk0] = (parMois[mk0] || 0) + (s[i].mntNetHt || 0);
    }
    var cles = Object.keys(parMois).map(Number).sort(function (a, b) { return a - b; });
    var totaux = cles.map(function (k) { return parMois[k]; }).slice().sort(function (a, b) { return a - b; });
    var mediane = totaux.length ? totaux[Math.floor(totaux.length / 2)] : 0;

    var complets = cles.slice(), ecartes = [];
    while (complets.length && parMois[complets[complets.length - 1]] < mediane * 0.6) {
      ecartes.push(complets.pop());
    }
    var ancre = complets.length ? complets[complets.length - 1] : null;
    // Six mois COMPLETS, pas six mois de fichier. Sans ça on ne compare rien :
    // mieux vaut une raison de moins qu'une raison fausse.
    var comparable = complets.length >= 6 && ancre != null;

    // `total` reste le chiffre d'affaires COMPLET de l'officine, tous
    // commerciaux confondus — c'est ce qu'affiche la fiche, ça ne doit pas
    // changer de sens. Seules les deux fenêtres de comparaison se limitent aux
    // ventes du commercial connecté : 5 officines sur 702 sont couvertes par
    // deux commerciaux, et le fichier de l'autre peut s'arrêter plus tôt — sa
    // part disparaîtrait de la fenêtre récente et rejouerait la fausse baisse.
    for (i = 0; i < toutes.length; i++) {
      var v = toutes[i], k = String(v.pharmacyId);
      if (!m[k]) m[k] = { total: 0, recent: 0, avant: 0 };
      m[k].total += (v.mntNetHt || 0);
      if (comparable && v.month && v.year && (!moiC || v.commercial === moiC)) {
        var mk = v.year * 12 + (v.month - 1);
        if (mk <= ancre && mk > ancre - 3) m[k].recent += (v.mntNetHt || 0);
        else if (mk <= ancre - 3 && mk > ancre - 6) m[k].avant += (v.mntNetHt || 0);
      }
    }
    return {
      par: m, comparable: comparable,
      periode: comparable
        ? { recent: [nomMois(ancre - 2), nomMois(ancre)], avant: [nomMois(ancre - 5), nomMois(ancre - 3)] }
        : null,
      moisEcartes: ecartes.sort().map(nomMois),
      moisComplets: complets.length
    };
  }
