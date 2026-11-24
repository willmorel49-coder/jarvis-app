/* PHIRST · logique PURE de « Le mot du vendredi » (idée 11, 24/11/2026) : trois lignes sur la semaine de la téléprospectrice, calculées depuis le
   journal réel (crm_activities, type « appel »), et le choix « pour viser mieux la suivante ». Aucune lecture de la page ni de la base :
   testable (tests/phirst-l3-mot.test.mjs). Rien n'est écrit en dur côté chiffres : tout se compte. Une raison ne se compare qu'à partir
   de 5 appels (en dessous, un « 1 sur 1 » ferait croire à une règle). L'écran est phirst-mot.js. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./phirst-pur.js'), require('./phirst-dossiers-pur.js'));
  else racine.PHIRST_MOT_PUR = fabrique(racine.PHIRST_PUR, racine.PHIRST_DOSSIERS_PUR);
})(typeof window !== 'undefined' ? window : this, function (P, D) {
  'use strict';
  var MIN_APPELS = 5;

  /* La raison d'appeler d'une fiche = sa `source` (écrite à la création depuis l'écran Appels : origineDe du robot). `motifs` = ce que le robot du matin
     range sous ce nom (getCallPlan de la V1) ; sans `motifs`, la raison se compte mais ne se propose pas en tête de liste. */
  var RAISONS = {
    cession: { nom: 'Les ventes d’officines', enTete: 'les ventes d’officines', motifs: ['cession'] },
    creation: { nom: 'Les ouvertures d’officines', enTete: 'les ouvertures d’officines', motifs: ['creation'] },
    transfert: { nom: 'Les ventes et ouvertures d’officines', enTete: 'les ventes et ouvertures d’officines', motifs: ['cession', 'creation'] },
    collective: { nom: 'Les pharmacies en difficulté', enTete: 'les pharmacies en difficulté', motifs: ['procedure'] },
    robot: { nom: 'Les robots d’une autre marque', enTete: 'les robots d’une autre marque', motifs: ['robot', 'omnicell'] },
    marche: { nom: 'Les marchés de préparation des doses', enTete: 'les marchés de préparation des doses', motifs: ['pda'] },
    pda: { nom: 'Les EHPAD à proximité', enTete: 'les EHPAD à proximité', motifs: ['ehpad'] },
    annuaire: { nom: 'L’annuaire et les relances', enTete: '', motifs: null },
    signal: { nom: 'La veille du BODACC', enTete: '', motifs: null }
  };
  function raisonDe(source) { return RAISONS[source] || { nom: 'Les autres pistes', enTete: '', motifs: null }; }

  /* ── la semaine ── */
  /* Visible du vendredi au lundi (Will, 24/11/2026). */
  function visible(auj) { var d = P.jourDeSemaine(auj); return d === 5 || d === 6 || d === 0 || d === 1; }
  /* La semaine racontée : lundi → dimanche. Du vendredi au dimanche : celle qui se termine ; le lundi : celle qui vient de finir. */
  function semaine(auj) {
    var d = P.jourDeSemaine(auj), depuisLundi = d === 0 ? 6 : d - 1;
    var lundi = P.ajouterJours(auj, d === 1 ? -7 : -depuisLundi);
    return { debut: lundi, vendredi: P.ajouterJours(lundi, 4), fin: P.ajouterJours(lundi, 6) };
  }
  function libelleSemaine(s) {
    var a = s.debut.split('-'), b = s.vendredi.split('-'), M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return 'semaine du ' + (+a[2] === 1 ? '1er' : +a[2]) + (a[1] !== b[1] ? ' ' + M[+a[1] - 1] : '') + ' au ' + (+b[2] === 1 ? '1er' : +b[2]) + ' ' + M[+b[1] - 1];
  }
  /* Quand le choix compte : le lundi même (le robot a déjà tourné : dès demain matin), sinon lundi prochain ; une semaine seulement. */
  function periode(auj) {
    var lundi = P.jourDeSemaine(auj) === 1;
    var du = lundi ? auj : P.ajouterJours(auj, (8 - P.jourDeSemaine(auj)) % 7 || 7);
    return { du: du, au: P.ajouterJours(du, 6), quand: lundi ? 'cette semaine' : 'la semaine prochaine', liste: lundi ? 'la liste de demain matin' : 'la liste du lundi' };
  }

  /* ── le journal : un appel = une ligne crm_activities ── */
  /* 'rdv' | 'sans' (personne au bout du fil) | 'decroche' (décroché, sans rendez-vous). Texte de l'écran Appels ou JSON de la V1. */
  function resultat(body) {
    var b = String(body == null ? '' : body).trim(), o = null;
    if (b.charAt(0) === '{') { try { o = JSON.parse(b); } catch (e) { o = null; } }
    var r = o && typeof o === 'object' ? String(o.resultat || '') : '';
    if (r) return r === 'rdv' ? 'rdv' : (r === 'injoignable' || r === 'mauvais_numero' || r === 'barrage') ? 'sans' : 'decroche';
    var t = P.norm(b);
    if (/rdv obtenu/.test(t)) return 'rdv';
    if (/injoignable/.test(t)) return 'sans';
    return 'decroche';
  }
  /* Compte la semaine. appels = lignes { prospect_id, author_id, body, created_at } ; fiches = { id: { source } } ; equipe = P.equipeParId. */
  function compter(appels, fiches, equipe, sem) {
    var par = {};   // par fiche : { source, decroche, rdv }
    (appels || []).forEach(function (a) {
      if (!P.estTelepro(equipe, a.author_id)) return;
      var j = D.jourDeHorodatage(a.created_at); if (!j || j < sem.debut || j > sem.fin) return;
      var f = par[a.prospect_id] || (par[a.prospect_id] = { source: (fiches[a.prospect_id] && fiches[a.prospect_id].source) || '', decroche: false, rdv: false });
      var r = resultat(a.body);
      if (r !== 'sans') f.decroche = true;
      if (r === 'rdv') f.rdv = true;
    });
    var ids = Object.keys(par), c = { appelees: ids.length, decroche: 0, rdv: 0, parRaison: {} };
    ids.forEach(function (id) {
      var f = par[id], k = f.source || 'autre', x = c.parRaison[k] || (c.parRaison[k] = { source: k, appels: 0, rdv: 0 });
      x.appels++; if (f.decroche) c.decroche++; if (f.rdv) { c.rdv++; x.rdv++; }
    });
    return c;
  }
  /* ── les trois lignes ── */
  function pluriel(n, un, plus) { return n + ' ' + (n > 1 ? plus : un); }
  /* Ligne 1 : segments { t, b }. null = pas un seul appel noté cette semaine. */
  function phrase(c) {
    if (!c.appelees) return null;
    var s = [{ t: 'La téléprospectrice a appelé ' }, { t: pluriel(c.appelees, 'pharmacie', 'pharmacies'), b: true }, { t: ' : ' }];
    s.push({ t: String(c.decroche), b: true }, { t: c.decroche > 1 ? ' ont décroché' : c.decroche === 1 ? ' a décroché' : ' n’a décroché' });
    if (c.rdv) s.push({ t: ', et ' }, { t: String(c.rdv), b: true }, { t: c.rdv > 1 ? ' ont pris rendez-vous avec vous.' : ' a pris rendez-vous avec vous.' });
    else s.push({ t: ', et aucun rendez-vous n’a encore été pris avec vous.' });
    return s;
  }
  function rythme(appels, rdv) { var n = Math.round(appels / rdv); return n <= 1 ? 'soit un à chaque appel' : 'soit un tous les ' + n + ' appels'; }
  /* Ligne 2 : les raisons comparables (au moins MIN_APPELS appels), celles qui ont donné au moins un rendez-vous, les 2 meilleures. */
  function raisons(c) {
    return Object.keys(c.parRaison).map(function (k) { return c.parRaison[k]; })
      .filter(function (x) { return x.appels >= MIN_APPELS && x.rdv >= 1; })
      .sort(function (a, b) { return b.rdv / b.appels - a.rdv / a.appels || b.rdv - a.rdv || (a.source < b.source ? -1 : 1); })
      .slice(0, 2).map(function (x) {
        return { source: x.source, nom: raisonDe(x.source).nom, gras: pluriel(x.rdv, 'rendez-vous', 'rendez-vous') + ' sur ' + pluriel(x.appels, 'appel', 'appels'), rythme: rythme(x.appels, x.rdv) };
      });
  }
  function phraseRaisons(c) {
    var r = raisons(c);
    return r.length ? { liste: r, vide: '' } : { liste: [], vide: 'Les raisons d’appeler se comparent dès ' + MIN_APPELS + ' appels pour une même raison, avec au moins un rendez-vous : ce n’est pas encore le cas cette semaine.' };
  }
  /* Ligne 3 : la raison qu'on peut mettre en tête (la meilleure qui a des motifs connus du robot), ou null. */
  function proposition(c, auj) {
    var r = raisons(c).filter(function (x) { return raisonDe(x.source).motifs; })[0];
    if (!r) return null;
    var def = raisonDe(r.source), p = periode(auj);
    return { source: r.source, motifs: def.motifs, nom: def.nom, enTete: def.enTete, periode: p,
      bouton: 'Mettre ' + def.enTete + ' en tête ' + p.quand,
      texte: 'C’est ce qui a donné le plus de rendez-vous cette semaine : vous pouvez le placer en premier dans la liste de la téléprospectrice.' };
  }
  /* La ligne à enregistrer (table ligne_priorite) */
  function ligneAEnregistrer(prop) {
    return { source: prop.source, motifs: prop.motifs, libelle: prop.nom.slice(0, 120), valable_du: prop.periode.du, valable_jusqu: prop.periode.au, pris_en_compte_le: null, annule_le: null };
  }
  /* Un choix déjà enregistré compte tant qu'il n'est ni expiré ni annulé (« Revenir à l'ordre habituel » ne supprime rien : il date l'annulation). */
  function choixEnCours(ligne, auj) {
    if (!ligne || ligne.annule_le || !ligne.valable_jusqu || String(ligne.valable_jusqu).slice(0, 10) < auj) return null;
    return { source: ligne.source, nom: raisonDe(ligne.source).nom, du: String(ligne.valable_du).slice(0, 10), priseEnCompte: !!ligne.pris_en_compte_le };
  }
  /* La phrase de confirmation : honnête tant que le robot n'a pas dit qu'il en a tenu compte. */
  function phraseChoix(ch, auj) {
    if (ch.priseEnCompte) return 'C’est fait : la liste de la téléprospectrice commence par ' + raisonDe(ch.source).enTete + '.';
    var p = ch.du <= auj ? 'la liste de demain matin' : 'la liste du ' + P.dateLongue(ch.du).split(' ')[0];
    return 'C’est noté : ' + p + ' commencera par ' + raisonDe(ch.source).enTete + '.';
  }
  return { MIN_APPELS: MIN_APPELS, RAISONS: RAISONS, raisonDe: raisonDe, visible: visible, semaine: semaine, libelleSemaine: libelleSemaine, periode: periode, resultat: resultat, compter: compter,
    phrase: phrase, raisons: raisons, phraseRaisons: phraseRaisons, proposition: proposition, ligneAEnregistrer: ligneAEnregistrer, choixEnCours: choixEnCours, phraseChoix: phraseChoix };
});
