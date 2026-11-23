/* PHIRST · logique PURE de l'écran « Réglages » (23/11/2026) : aucune lecture de la page ni de la base, donc testable
   (tests/phirst-reglages.test.mjs). L'écran (phirst-reglages.js) ne fait que les lectures, l'affichage et le changement de mot de passe.
   D'après la maquette V2 validée par Will le 23/11 (M-reglages-maquette, elle-même d'après m1 « Le tableau de bord » choisie le 29/10).
   Tout se LIT, rien n'est écrit en dur : la base = une lecture qui répond ; la liste du jour = son heure de calcul (moins de 36 h) ;
   images, vidéo et plafond = l'adresse /api/etat de l'ancienne version (seule à connaître ses clés) ; dépense = jobs du mois.
   Une lecture qui échoue donne « état inconnu pour l'instant », JAMAIS « hors service » (un contrôle qui échoue ne condamne rien),
   et l'outil inconnu ne compte pas dans « N outils sur M en service ». */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./phirst-pur.js'));
  else racine.PHIRST_REGLAGES_PUR = fabrique(racine.PHIRST_PUR);
})(typeof window !== 'undefined' ? window : this, function (P) {
  'use strict';

  var MDP_MIN = 6;   // comme l'ancienne version ; si la base en demande plus, son message est traduit par messageMdp()
  var INCONNU = 'État inconnu pour l’instant : la vérification n’a pas répondu. Rechargez la page dans quelques minutes.';

  /* Les quatre outils, dans l'ordre de la maquette. `quoi` = ce qu'il permet ; les états viennent des lectures. */
  var OUTILS = [
    { id: 'base', t: 'Vos dossiers et vos comptes', ic: 'dossier',
      quoi: 'Garde les pharmacies, les dossiers, les chantiers, les fichiers déposés, et qui a le droit d’entrer.' },
    { id: 'liste', t: 'La liste du jour', ic: 'soleil',
      quoi: 'Chaque matin, le robot prépare vos appels du jour et relève les reprises d’officines parues au BODACC.' },
    { id: 'images', t: 'Les images réalistes de la pharmacie', ic: 'photo',
      quoi: 'Dans l’Atelier 3D, transforme la maquette en photos que le pharmacien peut regarder.' },
    { id: 'video', t: 'La vidéo de visite', ic: 'film',
      quoi: 'Fabrique le petit film de visite de l’officine. Sert aussi de secours pour les images.' }
  ];

  /* Ce que chaque lecture a rendu → l'état de chaque outil : 'ok', 'panne' ou 'inconnu', et la phrase à afficher.
     l = { base: true | false | null, liste: { frais, calculeLe } | null, etat: { images, video, plafondCentimes } | null, maintenant }.
     base : true = une lecture a répondu ; false ou null = elle n'a pas répondu → inconnu (jamais « hors service »).
     liste : frais → en service, avec l'heure ; calculeLe sans frais → pas recalculée depuis… ; sans calculeLe → inconnu.
     etat : null (adresse muette) → images et vidéo inconnues ; un booléen → allumé / éteint. */
  function etats(l) {
    l = l || {};
    var e = l.etat && typeof l.etat === 'object' ? l.etat : null, li = l.liste || null, maint = l.maintenant;
    var heure = li && li.calculeLe ? P.miseAJourFr(li.calculeLe, maint) : '';
    var images = e && typeof e.images === 'boolean' ? e.images : null, video = e && typeof e.video === 'boolean' ? e.video : null;
    var r = {
      base: l.base === true ? ['ok', 'En service'] : ['inconnu', INCONNU],
      liste: li && li.frais === true ? ['ok', 'En service' + (heure ? ' · mise à jour ' + heure : '')]
        : li && heure ? ['panne', 'Pas recalculée depuis ' + heure + ' : l’accueil, les Appels et la Veille n’ont plus de liste du jour.']
        : ['inconnu', INCONNU],
      images: images === true ? ['ok', 'En service — et sans frais'] : images === false ? ['panne', 'Le bouton « Images réalistes » de l’Atelier 3D ne rendra rien.'] : ['inconnu', INCONNU],
      video: video === true ? ['ok', 'En service'] : video === false ? ['panne', 'La vidéo n’est pas disponible.' + (images === true ? ' Les images, elles, marchent quand même.' : '')] : ['inconnu', INCONNU]
    };
    return OUTILS.map(function (o) { return { id: o.id, t: o.t, ic: o.ic, quoi: o.quoi, etat: r[o.id][0], texte: r[o.id][1] }; });
  }

  /* Le bandeau : « N outils sur M en service », M = les outils dont l'état est connu. */
  function bilan(outils) {
    var ok = 0, panne = 0, inconnu = 0;
    (outils || []).forEach(function (o) { if (o.etat === 'ok') ok++; else if (o.etat === 'panne') panne++; else inconnu++; });
    var sur = ok + panne, phrase;
    if (!sur) phrase = 'L’état des outils n’a pas pu être lu pour l’instant. Rechargez la page dans quelques minutes.';
    else if (panne) phrase = 'Ce qui est éteint ci-dessous ne s’allumera pas tout seul : prévenez Will.';
    else if (inconnu) phrase = (inconnu > 1 ? inconnu + ' outils n’ont' : 'Un outil n’a') + ' pas pu être vérifié' + (inconnu > 1 ? 's' : '') + ' pour l’instant. Rechargez la page dans quelques minutes.';
    else phrase = 'Tout fonctionne. Vos appels, vos dossiers, les images et la vidéo sont prêts.';
    return { ok: ok, panne: panne, inconnu: inconnu, sur: sur, phrase: phrase,
      chiffre: sur ? String(ok) : '?', libelle: sur ? (ok > 1 ? 'outils' : 'outil') + '\nsur ' + sur + ' en service' : 'état des outils\ninconnu' };
  }

  /* Le 1er du mois à minuit UTC : le même début de mois que l'ancienne version (lib/cost.ts, qui tourne en UTC chez Vercel). */
  function debutDuMois(maintenant) {
    var d = new Date(maintenant == null ? Date.now() : maintenant);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  }
  /* La dépense du mois : somme de jobs.cost_cents depuis le début du mois (les lignes plus anciennes sont ignorées par sûreté). */
  function depenseDuMois(jobs, maintenant) {
    var debut = Date.parse(debutDuMois(maintenant));
    return (Array.isArray(jobs) ? jobs : []).reduce(function (s, j) {
      var c = j && Number(j.cost_cents), t = j && Date.parse(j.created_at);
      return s + (isFinite(c) && c > 0 && (!j.created_at || !isFinite(t) || t >= debut) ? c : 0);
    }, 0);
  }
  function plafondValide(p) { return typeof p === 'number' && isFinite(p) && p > 0 ? Math.round(p) : null; }
  function eur(c) {
    var n = Math.round(Number(c) || 0), neg = n < 0; n = Math.abs(n);
    return (neg ? '−' : '') + Math.floor(n / 100) + ',' + ('0' + (n % 100)).slice(-2) + ' €';
  }
  /* La jauge : null si la dépense ou le plafond n'ont pas pu être lus (l'écran le dit, sans chiffre inventé). */
  function jauge(depense, plafond) {
    var pl = plafondValide(plafond);
    if (pl == null || typeof depense !== 'number' || !isFinite(depense)) return null;
    var d = Math.max(0, Math.round(depense)), p = Math.min(100, Math.round(100 * d / pl));
    return { depense: d, plafond: pl, p: p, fort: p >= 80, reste: Math.max(0, pl - d),
      gauche: d ? p + ' % du plafond' : 'Rien n’a été dépensé ce mois-ci', droite: 'Reste ' + eur(Math.max(0, pl - d)) };
  }

  /* Le formulaire du mot de passe : '' si bon, sinon le message, et quel champ signaler (1 ou 2). */
  function verifierMdp(a, b) {
    a = String(a == null ? '' : a); b = String(b == null ? '' : b);
    if (a.length < MDP_MIN) return { message: 'Le mot de passe doit faire au moins ' + MDP_MIN + ' caractères.', champ: 1 };
    if (a !== b) return { message: 'Les deux mots de passe ne correspondent pas.', champ: 2 };
    return { message: '', champ: 0 };
  }
  /* La réponse de la base (auth.updateUser) → une phrase en français qui dit quoi faire. Jamais le message anglais tel quel. */
  function messageMdp(err) {
    if (!err) return '';
    var code = String(err.code || ''), m = String(err.message || ''), nom = String(err.name || '');
    var n = /at least (\d+) characters/i.exec(m);
    // « same_password » d'abord : son message anglais (« New password should be different… ») contient aussi « password should ».
    if (code === 'same_password' || /different from the old/i.test(m)) return 'C’est déjà votre mot de passe actuel : choisissez-en un autre.';
    if (code === 'weak_password' || /password should|weak password/i.test(m))
      return n ? 'Le mot de passe doit faire au moins ' + n[1] + ' caractères.' : 'Ce mot de passe est trop simple : choisissez-en un plus long, avec des chiffres et des lettres.';
    if (code === 'reauthentication_needed' || /reauthenticat/i.test(m)) return 'Pour changer votre mot de passe, déconnectez-vous, reconnectez-vous, puis recommencez.';
    if (code === 'session_not_found' || nom === 'AuthSessionMissingError' || /session missing|session_not_found/i.test(m)) return 'Votre session a expiré : reconnectez-vous, puis recommencez.';
    if (code === 'over_request_rate_limit' || /rate limit/i.test(m)) return 'Trop d’essais d’un coup : attendez une minute, puis recommencez.';
    return 'Mot de passe pas changé : réessayez dans un instant.';
  }

  return { MDP_MIN: MDP_MIN, INCONNU: INCONNU, OUTILS: OUTILS, etats: etats, bilan: bilan, debutDuMois: debutDuMois, depenseDuMois: depenseDuMois,
    plafondValide: plafondValide, eur: eur, jauge: jauge, verifierMdp: verifierMdp, messageMdp: messageMdp };
});
