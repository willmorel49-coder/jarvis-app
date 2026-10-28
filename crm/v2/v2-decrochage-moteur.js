/* ═══════════════════════════════════════════════════════════════════════════
   MOTEUR « À RAPPELER CETTE SEMAINE » — les officines dont les achats
   décrochent, et rien d'autre : aucun HTML, aucun DOM, aucun appel réseau.
   Même motif que v2-appro-moteur.js / v2-produits-moteur.js : l'écran
   (v2-decrochage.js) dessine, ce fichier compte. Testé dans
   tests/decrochage-moteur.test.mjs, sur des ventes inventées.

   ⚠️ UNE SEULE RÈGLE DE DÉCROCHAGE DANS L'APP. Avant ce fichier, la baisse se
   calculait à trois endroits avec trois règles (radar « Qui inviter »,
   Pilotage, fiche). Celle-ci est la règle du radar, validée par Will le
   27/10/2026 (questions cliquées) : baisse ≥ 25 % ET ≥ 500 € d'achats sur les
   3 mois d'avant, 3 derniers mois COMPLETS contre les 3 précédents. Le test de
   parité fait tourner le vrai `achats()` du radar sur les mêmes ventes.
   28/10/2026 (décision de Will, « Les deux ») : les achats ponctuels (achats
   dans 2 mois au plus sur les 6 d'avant la fenêtre récente) n'entrent plus,
   partout ; et calculer() rend l'évolution du portefeuille pour le bandeau
   « tout le portefeuille baisse » de l'écran (la liste n'en dépend pas).

   ⚠️ LES DEUX PIÈGES DU RADAR, REPRIS TELS QUELS (voir v2-rdv-radar.js) :
   1. Le dernier mois du fichier est presque toujours incomplet : un mois de
      queue sous 60 % de la médiane est écarté, sinon TOUT le monde « baisse ».
   2. La fenêtre se cale sur le fichier DU COMMERCIAL, pas sur le réseau, et
      seule sa part d'une officine partagée se compare : les fichiers ne
      s'arrêtent pas au même mois d'un commercial à l'autre.

   ⚠️ AUCUNE ÉCRITURE ICI. « revenue » / « toujours en baisse » se CALCULENT à
   chaque ouverture à partir des ventes ; seuls les gestes du commercial
   (appelée, notée, pas pertinent) s'enregistrent, et pas par ce fichier.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};

  // Les seuils, en UN endroit. Aucun texte affiché ne les écrit en dur : il
  // les lit ici (règle du 19/08/2026, « ce qui est annoncé se lit dans le réglage »).
  var REGLAGES = Object.freeze({
    baissePct: 0.25,          // baisse minimale entre les deux trimestres
    baisseMinAvant: 500,      // € d'achats minimum sur les 3 mois d'avant
    revenuePct: 0.8,          // « revenue » : 80 % du niveau mensuel d'avant
    enCoursJours: 14,         // contactée depuis moins de 14 jours → « en cours »
    pasPertinentJours: 60,    // « pas pertinent » masque 60 jours
    moisIncompletPct: 0.6,    // mois de queue sous 60 % de la médiane → écarté
    moisMin: 6,               // six mois COMPLETS, sinon pas de liste
    maxLignes: 10,
    // 28/10/2026, décision de Will (« Les deux ») :
    // (a) achat ponctuel = achats dans 2 mois AU PLUS sur les 6 qui précèdent
    //     la fenêtre récente → n'est pas un décrochage, n'entre pas.
    regulariteMois: 6,
    ponctuelMoisMax: 2,
    // (b) médiane d'évolution du portefeuille (officines ≥ baisseMinAvant)
    //     ≤ −10 % → bandeau « tout le portefeuille baisse ». La liste ne change pas.
    portefeuilleBaissePct: 0.10
  });

  function reglages(r) {
    var o = {}, k;
    for (k in REGLAGES) o[k] = REGLAGES[k];
    if (r) for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k];
    return o;
  }

  // Mois ⇄ entier (année × 12 + mois − 1), comme le radar.
  function k(y, m) { return y * 12 + (m - 1); }
  function cle(n) { var m = n % 12 + 1; return Math.floor(n / 12) + '-' + (m < 10 ? '0' : '') + m; }
  function deCle(s) { var p = String(s || '').split('-'); return p.length < 2 ? null : k(+p[0], +p[1]); }
  function jours(a, b) { return Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 864e5); }
  function ventesDe(ventes, commercial) {
    if (!commercial) return ventes || [];
    return (ventes || []).filter(function (v) { return v.commercial === commercial; });
  }

  // ── La fenêtre, sur les ventes DU commercial (déjà filtrées) ─────────────
  // Même calcul que achats() du radar : médiane des totaux mensuels, mois de
  // queue écartés tant qu'ils sont sous 60 % de la médiane, ancre = dernier
  // mois retenu, six mois complets au moins.
  function fenetre(siennes, R) {
    R = R || REGLAGES;
    var parMois = {}, i;
    for (i = 0; i < siennes.length; i++) {
      var v = siennes[i];
      if (!v.month || !v.year) continue;
      var n = k(v.year, v.month);
      parMois[n] = (parMois[n] || 0) + (v.mntNetHt || 0);
    }
    var cles = Object.keys(parMois).map(Number).sort(function (a, b) { return a - b; });
    var totaux = cles.map(function (n) { return parMois[n]; }).sort(function (a, b) { return a - b; });
    var mediane = totaux.length ? totaux[Math.floor(totaux.length / 2)] : 0;
    var complets = cles.slice(), ecartes = [];
    while (complets.length && parMois[complets[complets.length - 1]] < mediane * R.moisIncompletPct) {
      ecartes.push(complets.pop());
    }
    var ancre = complets.length ? complets[complets.length - 1] : null;
    var comparable = complets.length >= R.moisMin && ancre != null;
    return {
      comparable: comparable, ancre: ancre, moisComplets: complets.length,
      moisEcartes: ecartes.sort(function (a, b) { return a - b; }).map(cle)
    };
  }

  // Avant et récent par officine, sur les seules ventes du commercial.
  // Plus, pour la règle des achats ponctuels : sur les `regulariteMois` mois qui
  // précèdent la fenêtre récente, combien sont CONNUS (le fichier du commercial
  // a des ventes ce mois-là) et dans combien l'officine a acheté (net > 0).
  function sommes(siennes, ancre, R) {
    R = R || REGLAGES;
    var par = {}, mois = {}, connus = {}, bas = ancre - 2 - R.regulariteMois, i;
    for (i = 0; i < siennes.length; i++) {
      var v = siennes[i];
      if (!v.month || !v.year) continue;
      var n = k(v.year, v.month), id = String(v.pharmacyId);
      var a = par[id] || (par[id] = { recent: 0, avant: 0, moisConnus: 0, moisAchat: 0 });
      if (n <= ancre && n > ancre - 3) a.recent += (v.mntNetHt || 0);
      else if (n <= ancre - 3 && n > ancre - 6) a.avant += (v.mntNetHt || 0);
      if (n <= ancre - 3 && n >= bas) {
        connus[n] = 1;
        var m = mois[id] || (mois[id] = {});
        m[n] = (m[n] || 0) + (v.mntNetHt || 0);
      }
    }
    var nbConnus = Object.keys(connus).length;
    for (var pid in par) {
      par[pid].moisConnus = nbConnus;
      for (var c in mois[pid] || {}) if (mois[pid][c] > 0) par[pid].moisAchat++;
    }
    return par;
  }

  // Achat ponctuel : des achats dans `ponctuelMoisMax` mois au plus sur
  // `regulariteMois`. Un mois absent du fichier n'est PAS compté vide : on
  // n'écarte que si c'est certain (assez de mois connus sans achat), sinon on garde.
  function ponctuel(a, r) {
    var R = reglages(r);
    if (!a || typeof a.moisConnus !== 'number' || typeof a.moisAchat !== 'number') return false;
    return a.moisConnus - a.moisAchat >= R.regulariteMois - R.ponctuelMoisMax;
  }

  // La baisse seule. Elle ne veut rien dire sous le plancher : passer de 40 € à
  // 20 €, c'est une boîte de moins, pas un décrochage.
  function baisse(a, R) {
    if (!a || !(a.avant >= R.baisseMinAvant) || a.avant <= 0) return false;
    return (a.avant - a.recent) / a.avant >= R.baissePct;
  }

  // LA règle : une baisse, hors achat ponctuel. Le radar et le Pilotage
  // l'appellent avec ce que rend sommes() — ils suivent sans rien recalculer.
  function enBaisse(a, r) {
    var R = reglages(r);
    return baisse(a, R) && !ponctuel(a, R);
  }

  // Évolution du portefeuille : médiane de (récent − avant) / avant sur les
  // officines au-dessus du plancher. Médiane comme fenetre() (élément du milieu,
  // le plus haut des deux si le nombre est pair). null s'il n'y en a aucune.
  function portefeuille(par, R) {
    var ev = [];
    for (var id in par) if (par[id].avant >= R.baisseMinAvant) ev.push((par[id].recent - par[id].avant) / par[id].avant);
    if (!ev.length) return { evolution: null, officines: 0, enBaisse: false };
    ev.sort(function (a, b) { return a - b; });
    var med = ev[Math.floor(ev.length / 2)];
    return { evolution: med, officines: ev.length, enBaisse: med <= -R.portefeuilleBaissePct };
  }

  // Dernier geste enregistré par officine (le plus récent l'emporte).
  function derniersGestes(suivis) {
    var d = {};
    (suivis || []).forEach(function (s) {
      if (!s || s.pharmacy_id == null) return;
      var id = String(s.pharmacy_id), p = d[id];
      if (!p || String(s.geste_le || '') > String(p.geste_le || '')) d[id] = s;
    });
    return d;
  }

  // ── Résultat d'un geste : « revenue » ou « toujours en baisse » ──────────
  // Moyenne mensuelle des mois COMPLETS après le mois de référence, contre le
  // niveau mensuel d'avant (enregistré au geste, sinon recalculé sur les 3 mois
  // d'avant le mois de référence). null tant qu'aucun mois complet n'a suivi.
  function resultat(suivi, ventes, commercial, r, fen) {
    var R = reglages(r);
    var ref = deCle(suivi && suivi.mois_ref);
    if (ref == null) return null;
    var siennes = ventesDe(ventes, commercial);
    var F = fen || fenetre(siennes, R);
    if (F.ancre == null || F.ancre <= ref) return null;
    var id = String(suivi.pharmacy_id), depuis = 0, avant = 0;
    for (var i = 0; i < siennes.length; i++) {
      var v = siennes[i];
      if (String(v.pharmacyId) !== id || !v.month || !v.year) continue;
      var n = k(v.year, v.month);
      if (n > ref && n <= F.ancre) depuis += (v.mntNetHt || 0);
      else if (n <= ref - 3 && n > ref - 6) avant += (v.mntNetHt || 0);
    }
    var niveau = typeof suivi.avant_mensuel === 'number' && suivi.avant_mensuel > 0
      ? suivi.avant_mensuel : avant / 3;
    if (!(niveau > 0)) return null;
    var depuisMensuel = depuis / (F.ancre - ref);
    return {
      statut: depuisMensuel >= niveau * R.revenuePct ? 'revenue' : 'toujours_en_baisse',
      avantMensuel: niveau, depuisMensuel: depuisMensuel,
      moisMesures: F.ancre - ref, jusqua: cle(F.ancre)
    };
  }

  /* entree = {
       ventes: [{pharmacyId, year, month, commercial, mntNetHt}],  // V2.sales tel quel
       commercial: 'KV',             // ses ventes seules ; vide = toutes
       aujourdhui: 'AAAA-MM-JJ',
       voit: function (pid) → bool,  // facultatif (V2.voitVentesDe)
       contacts: {pid: 'AAAA-MM-JJ'},// dernier contact connu (visite, note, RDV)
       suivis: [{pharmacy_id, statut, motif, mois_ref, geste_le, avant_mensuel}],
       reprises: {pid: 1},           // changement de titulaire
       habitudes: function (pid) → n,// références habituelles absentes (facultatif)
       reglages: {…}                 // facultatif, pour les tests
     }
     → { comparable, moisRef, periode, moisEcartes, moisComplets,
         lignes:[…], total, nbARappeler, masquees, ponctuels, revenues:[…],
         portefeuille: {evolution, officines, enBaisse} } */
  function calculer(e) {
    var R = reglages(e && e.reglages);
    var siennes = ventesDe(e.ventes, e.commercial);
    var F = fenetre(siennes, R);
    var vide = {
      comparable: false, moisRef: F.ancre != null ? cle(F.ancre) : null, periode: null,
      moisEcartes: F.moisEcartes, moisComplets: F.moisComplets,
      lignes: [], total: 0, nbARappeler: null, masquees: 0, ponctuels: 0, revenues: [],
      portefeuille: null
    };
    if (!F.comparable) return vide;

    var par = sommes(siennes, F.ancre, R);
    var voit = e.voit || function () { return true; };
    var contacts = e.contacts || {}, reprises = e.reprises || {};
    var habitudes = e.habitudes || function () { return 0; };
    var gestes = derniersGestes(e.suivis);
    var auj = e.aujourdhui;
    var lignes = [], masquees = 0, ponctuels = 0, revenues = [];

    Object.keys(par).forEach(function (id) {
      var a = par[id];
      if (!baisse(a, R) || !voit(id)) return;
      if (ponctuel(a, R)) { ponctuels++; return; }   // compté, jamais écarté en silence
      var g = gestes[id] || null;
      if (g && g.statut === 'pas_pertinent' && g.geste_le && jours(g.geste_le, auj) < R.pasPertinentJours) {
        masquees++;
        return;
      }
      var res = null;
      if (g && (g.statut === 'appelee' || g.statut === 'notee')) {
        res = resultat(g, siennes, null, R, F);
        if (res && res.statut === 'revenue') { revenues.push({ pid: id, suivi: g, resultat: res }); return; }
      }
      var geste = g && g.statut !== 'pas_pertinent' && g.geste_le ? String(g.geste_le).slice(0, 10) : '';
      var contact = contacts[id] ? String(contacts[id]).slice(0, 10) : '';
      var dernier = geste > contact ? geste : contact;
      lignes.push({
        pid: id, avant: a.avant, recent: a.recent,
        pct: (a.avant - a.recent) / a.avant,
        avantMensuel: a.avant / 3,
        ecartMensuel: (a.avant - a.recent) / 3,
        raison: reprises[id] ? 'reprise' : 'baisse',
        habitudes: habitudes(id) || 0,
        dernierContact: dernier || null,
        etat: dernier && jours(dernier, auj) < R.enCoursJours ? 'en_cours' : 'a_rappeler',
        suivi: g, resultat: res
      });
    });

    // Les « à rappeler » d'abord, puis les « en cours » ; dans chaque groupe,
    // par euros en jeu (Pharwiz : trier par euros, pas par pourcentage).
    lignes.sort(function (x, y) {
      if (x.etat !== y.etat) return x.etat === 'a_rappeler' ? -1 : 1;
      return y.ecartMensuel - x.ecartMensuel;
    });
    return {
      comparable: true, moisRef: cle(F.ancre),
      periode: { avant: [cle(F.ancre - 5), cle(F.ancre - 3)], recent: [cle(F.ancre - 2), cle(F.ancre)] },
      moisEcartes: F.moisEcartes, moisComplets: F.moisComplets,
      lignes: lignes.slice(0, R.maxLignes), total: lignes.length,
      nbARappeler: lignes.filter(function (l) { return l.etat === 'a_rappeler'; }).length,
      masquees: masquees, ponctuels: ponctuels, revenues: revenues,
      portefeuille: portefeuille(par, R)
    };
  }

  var D = {
    REGLAGES: REGLAGES, calculer: calculer, resultat: resultat, enBaisse: enBaisse, ponctuel: ponctuel,
    fenetre: function (ventes, commercial, r) { return fenetre(ventesDe(ventes, commercial), reglages(r)); },
    sommes: function (ventes, commercial, ancre, r) { return sommes(ventesDe(ventes, commercial), ancre, reglages(r)); },
    cle: cle, deCle: deCle
  };
  V2.decrochage = D;
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window
   : (typeof globalThis !== 'undefined' ? globalThis : this));
