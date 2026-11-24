/* PHIRST · logique PURE des textes de Yann pour la téléprospectrice (L1, 24/11/2026) : aucune lecture de la page ni de la base,
   donc testable (tests/phirst-textes.test.mjs). Trois idées :
   1. « La première phrase » : une phrase d'ouverture par raison d'appeler. Tant que Yann n'en a pas écrit, la PROPOSITION DE DÉPART
      s'affiche, marquée comme telle (jamais présentée comme écrite par lui).
   2. « Les réponses de Yann » : une objection entendue → la réponse de Yann ; « Entendue N fois ce mois » (mois de Paris).
   3. « Les voisines équipées » : les pharmacies déjà équipées par Yann ; la téléprospectrice ne voit que les CITABLES, les deux plus proches.
   Les écrans (phirst-reglages.js pour Yann, phirst-appels.js pour la téléprospectrice) ne font que lire, écrire et afficher.
   Les clés des raisons (cession, creation…) sont celles de P.MOTIFS. Depuis L4 (24/11/2026), « ars », « client » et « recommande » sont dans RAISONS
   (donc dans Réglages, « Mes premières phrases ») et leur étiquette dans P.MOTIFS. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./phirst-pur.js'));
  else racine.PHIRST_TEXTES_PUR = fabrique(racine.PHIRST_PUR);
})(typeof window !== 'undefined' ? window : this, function (P) {
  'use strict';

  var LONG_MAX = 1200;   // comme la base (phirst_textes.texte)

  /* ── 1. Les raisons d'appeler et leur proposition de départ (ordre = celui de l'écran Réglages) ── */
  var RAISONS = [
    { cle: 'cession', raison: 'Vente de la pharmacie', propo: 'Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies. Votre officine est en vente : Yann peut montrer au repreneur ce qu’un nouvel agencement apporterait. Avez-vous deux minutes ?' },
    { cle: 'creation', raison: 'Création de pharmacie', propo: 'Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies. Vous préparez l’ouverture d’une officine : Yann conçoit l’agencement et suit les travaux jusqu’à la remise des clés. Avez-vous deux minutes ?' },
    { cle: 'procedure', raison: 'Procédure collective', propo: 'Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies, en toute discrétion. Il connaît les périodes délicates d’une officine et propose des solutions simples, sans engagement. Puis-je vous en dire un mot ?' },
    { cle: 'omnicell', raison: 'Robot Omnicell abandonné', propo: 'Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies. Il semble qu’un robot ne serve plus dans votre officine. Yann installe des robots Riedl et peut vous montrer comment retrouver cet espace. Avez-vous deux minutes ?' },
    { cle: 'robot', raison: 'Robot de plus de 8 ans', propo: 'Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies. Votre robot a plus de huit ans : c’est souvent le bon moment d’en parler. Yann installe des robots Riedl et peut vous dire ce que le remplacer changerait chez vous.' },
    { cle: 'ehpad', raison: 'EHPAD voisin', propo: 'Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies. Un EHPAD est installé près de votre officine : Yann installe des robots PDA, qui préparent les piluliers. Cela peut vous ouvrir ce marché. Avez-vous deux minutes ?' },
    { cle: 'pda', raison: 'Marché public PDA', propo: 'Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies. Un marché public de préparation des doses à administrer vient d’être publié près de chez vous. Yann équipe des officines en robots PDA : il peut vous dire ce qu’il faut prévoir.' },
    { cle: 'ars', raison: 'Transfert autorisé par l’ARS', propo: 'Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies. L’ARS vient d’autoriser le transfert de votre officine : Yann conçoit l’agencement des nouveaux locaux et suit le chantier. Avez-vous deux minutes ?' },
    { cle: 'client', raison: 'Client qui revient', propo: 'Bonjour, ici l’équipe de Yann, l’agenceur avec qui vous avez déjà travaillé. Nous prenons de vos nouvelles : un nouveau projet se dessine-t-il dans votre officine ?' },
    { cle: 'recommande', raison: 'Recommandé par un confrère', propo: 'Bonjour, un confrère de votre région nous a recommandés auprès de vous. Yann est agenceur de pharmacies et a équipé son officine. Puis-je vous présenter ce qu’il a fait ?' },
    { cle: 'relance', raison: 'Relance promise', propo: 'Bonjour, je vous rappelle comme convenu, de la part de Yann. Avez-vous eu le temps d’y réfléchir ? Je suis là pour fixer un moment qui vous arrange.' },
    { cle: 'pmr', raison: 'Accessibilité PMR', propo: 'Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies. L’accès de votre officine aux personnes à mobilité réduite est un sujet de mise en conformité : Yann peut vous dire ce qui est simple à faire. Avez-vous deux minutes ?' }
  ];
  /* Les raisons « à venir » : plus aucune (L4 a passé ars, client et recommande dans RAISONS, 24/11/2026). La liste reste, vide, pour qu'une
     future raison puisse y attendre son lot sans toucher au reste. */
  var A_VENIR = [];

  /* Le mail de « Lui écrire plutôt » (L2, idée 4) : un texte de Yann comme les phrases, mais qui n'est PAS une raison d'appeler (pas dans RAISONS).
     Mots remplacés tout seuls : {titulaire}, {pharmacie}, {lien} (la ligne qui le porte disparaît s'il n'y a aucun lien). La signature s'ajoute en bas (lue en base). */
  var MAILS = [
    { cle: 'mail_lettre', raison: 'Le mail de la lettre', propo: 'Bonjour {titulaire},\n\nJe vous écris de la part de Yann, agenceur de pharmacies dans le Grand Ouest. Il a préparé une présentation de ce qu’il peut faire pour votre officine.\nVous pouvez la lire ici : {lien}\n\nSi vous souhaitez en parler, répondez simplement à ce message : nous vous rappellerons à l’heure qui vous convient.' }
  ];
  function raisonDe(cle) {
    var k = String(cle == null ? '' : cle), tout = RAISONS.concat(A_VENIR, MAILS);
    for (var i = 0; i < tout.length; i++) if (tout[i].cle === k) return tout[i];
    return null;
  }
  /* Une liste de lignes { cle, texte } (ou { cle → texte }) → un objet { cle: texte } sans les phrases vides. */
  function phrasesParCle(lignes) {
    var o = {};
    (Array.isArray(lignes) ? lignes : []).forEach(function (l) {
      if (l && typeof l.cle === 'string' && typeof l.texte === 'string' && l.texte.trim()) o[l.cle] = l.texte.trim();
    });
    return o;
  }
  /* La phrase de la raison `cle` : celle de Yann s'il l'a écrite, sinon la proposition de départ. Rend null si la raison est inconnue.
     { cle, raison, texte, source: 'yann' | 'proposition' }. */
  function phraseDe(cle, phrases) {
    var r = raisonDe(cle); if (!r) return null;
    var par = phrases && !Array.isArray(phrases) ? phrases : phrasesParCle(phrases), t = par && typeof par[r.cle] === 'string' ? par[r.cle].trim() : '';
    return t ? { cle: r.cle, raison: r.raison, texte: t, source: 'yann' } : { cle: r.cle, raison: r.raison, texte: r.propo, source: 'proposition' };
  }
  /* La mention sous « Pour commencer ». `yann` : celui qui regarde est Yann (le lien vers Réglages n'a de sens que pour lui). */
  function mentionPhrase(source, yann) {
    if (source === 'yann') return { texte: 'Phrase écrite par Yann', lienReglages: !!yann };
    return { texte: 'Proposition de départ · Yann ne l’a pas encore écrite', lienReglages: !!yann };
  }
  /* « Modifiée aujourd'hui à 17 h 40 » / « Modifiée le 20 novembre à 17 h 40 » (heure de Paris), à partir de updated_at. */
  function modifiee(iso, maintenant) {
    var t = Date.parse(iso); if (!isFinite(t)) return '';
    var d = new Date(t), jr = P.aujourdhui(d), h = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit' }).formatToParts(d), hh = '', mm = '';
    h.forEach(function (x) { if (x.type === 'hour') hh = x.value; if (x.type === 'minute') mm = x.value; });
    var heure = Number(hh) + ' h ' + mm;
    return 'Modifiée ' + (jr === P.aujourdhui(maintenant == null ? new Date() : new Date(maintenant)) ? 'aujourd’hui' : 'le ' + P.jourFr(jr)) + ' à ' + heure;
  }
  /* Les secondes pour lire une phrase à voix haute (≈ 2,5 mots par seconde). */
  function secondes(t) { var n = (String(t == null ? '' : t).trim().match(/\S+/g) || []).length; return Math.max(1, Math.round(n / 2.5)); }
  /* Un texte à enregistrer : espaces nettoyés ; { erreur } s'il est vide ou trop long ; { alerte } s'il parle d'argent
     (la base le retire alors de ce que lit la téléprospectrice : Yann doit le savoir). */
  function texteValide(t) {
    var s = String(t == null ? '' : t).replace(/\r/g, '').trim();
    if (!s) return { erreur: 'Écrivez d’abord le texte.' };
    if (s.length > LONG_MAX) return { erreur: 'Ce texte est trop long : ' + LONG_MAX + ' caractères au plus.' };
    return { texte: s, alerte: P.contientMontant(s) ? 'Ce texte parle d’argent : la téléprospectrice ne le verra pas. Retirez la somme pour qu’elle le lise.' : '' };
  }

  /* ── 2. Les réponses : « entendue N fois ce mois » ── */
  /* lignes : [{ texte_id, created_at }] (phirst_entendues) → { texte_id: nombre } pour le mois de Paris de `maintenant`. */
  function comptesDuMois(lignes, maintenant) {
    var mois = P.aujourdhui(maintenant == null ? new Date() : new Date(maintenant)).slice(0, 7), o = {};
    (Array.isArray(lignes) ? lignes : []).forEach(function (l) {
      if (!l || !l.texte_id) return;
      var t = Date.parse(l.created_at); if (!isFinite(t) || P.aujourdhui(new Date(t)).slice(0, 7) !== mois) return;
      o[l.texte_id] = (o[l.texte_id] || 0) + 1;
    });
    return o;
  }
  /* « Entendue 9 fois ce mois » ; zéro → dit ce que ça veut dire, jamais un « 0 » seul. */
  function foisDuMois(n, aLaFin) {
    var c = Math.max(0, Math.floor(Number(n) || 0)), fin = aLaFin ? ' ce mois-ci' : ' ce mois';
    return c > 0 ? 'Entendue ' + c + (c > 1 ? ' fois' : ' fois') + fin : 'Pas encore entendue' + fin;
  }
  /* La plus fréquente d'abord ; à égalité l'ordre d'écriture. reponses : [{ id, ... }], comptes : { id: n }. */
  function reponsesTriees(reponses, comptes) {
    var c = comptes || {};
    return (Array.isArray(reponses) ? reponses : []).map(function (r, i) { return { r: r, i: i, n: c[r.id] || 0 }; })
      .sort(function (a, b) { return b.n - a.n || a.i - b.i; }).map(function (x) { return x.r; });
  }
  /* La clé d'une nouvelle réponse : le titre en minuscules sans accents, tirets, unique parmi les clés existantes. */
  function cleDe(titre, existantes) {
    var base = P.norm(titre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'reponse', k = base, n = 2, pris = {};
    (existantes || []).forEach(function (e) { pris[e] = true; });
    while (pris[k]) k = base + '-' + (n++);
    return k;
  }
  /* L'objection telle qu'on l'affiche : sans guillemets autour, sans point final. */
  function objectionNette(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim().replace(/^[«"“]\s*|\s*[»"”]$/g, '').trim(); }
  function validerReponse(objection, reponse) {
    var q = objectionNette(objection), r = texteValide(reponse);
    if (!q || r.erreur) return { erreur: 'Écrivez ce que le pharmacien dit, puis votre réponse.' };
    if (q.length > 160) return { erreur: 'Ce que le pharmacien dit doit tenir en 160 caractères.' };
    return { titre: q, texte: r.texte, alerte: r.alerte || (P.contientMontant(q) ? 'Ce texte parle d’argent : la téléprospectrice ne le verra pas. Retirez la somme pour qu’elle le lise.' : '') };
  }
  /* Les six propositions de départ, que Yann peut reprendre d'un clic puis retoucher (elles ne s'affichent jamais à la téléprospectrice
     sans son enregistrement : ce qui est dit au pharmacien se valide). */
  var REPONSES_DEPART = [
    { titre: 'On a déjà un robot', texte: 'Très bien, et ce n’est pas pour le remplacer. Yann regarde si votre robot est bien placé et s’il suit votre activité : un conseil sur place, sans engagement. Je peux vous proposer un rendez-vous ?' },
    { titre: 'Nous n’avons pas le budget', texte: 'Je comprends. Un premier rendez-vous n’engage à rien, et Yann chiffre le projet avec vous avant toute décision : vous saurez ce que cela représente réellement. On le regarde ensemble ?' },
    { titre: 'Envoyez-moi une documentation', texte: 'Avec plaisir, je vous envoie la présentation de Yann. Pour qu’elle serve vraiment, puis-je noter un court rendez-vous la semaine prochaine pour la commenter avec vous ?' },
    { titre: 'Rappelez-moi après l’été', texte: 'Bien sûr. Fixons dès maintenant une date de rappel : je note la semaine de la rentrée, et Yann préparera votre dossier d’ici là.' },
    { titre: 'On travaille avec un autre agenceur', texte: 'C’est très bien, vous avez un interlocuteur de confiance. Yann ne cherche pas à le remplacer : il propose un second regard, utile pour comparer, notamment sur la robotique.' },
    { titre: 'Je vends dans deux ans', texte: 'Justement : un agencement bien pensé aide à mieux vendre. Yann peut vous dire ce qui valorise votre officine aux yeux d’un repreneur, sans gros travaux.' }
  ];
  /* Ce que la téléprospectrice lit dans le journal de l'appel : « Il a dit : « A », « B » ». Une objection qui parle d'argent n'y entre
     pas (la base refuse tout le journal d'un appel qui contient une somme). */
  function ditsEnTexte(titres) {
    var l = [];
    (Array.isArray(titres) ? titres : []).forEach(function (t) { var n = objectionNette(t); if (n && !P.contientMontant(n) && l.indexOf(n) < 0) l.push(n); });
    return l.length ? 'Il a dit : ' + l.map(function (n) { return '« ' + n + ' »'; }).join(', ') : '';
  }

  /* ── 3. Les références : pharmacies déjà équipées par Yann ── */
  var CP = /^\d{5}$/;
  function departementDe(cp) { return CP.test(String(cp || '')) ? String(cp).slice(0, 2) : ''; }
  /* « Douarnenez (29) » */
  function villeAvecDep(ville, cp) { var d = departementDe(cp); return String(ville || '').trim() + (d ? ' (' + d + ')' : ''); }
  function anneeValide(a) { var s = String(a == null ? '' : a).trim(); return /^(19|20)\d\d$/.test(s) ? Number(s) : null; }
  /* Le formulaire « Ajouter une référence » : tout est obligatoire. Elle naît avec les deux interrupteurs ÉTEINTS (l'accord du pharmacien se note ensuite). */
  function validerReference(c) {
    c = c || {};
    var nom = String(c.nom || '').replace(/\s+/g, ' ').trim(), ville = String(c.ville || '').replace(/\s+/g, ' ').trim(), cp = String(c.cp || '').replace(/\s/g, ''),
      pose = String(c.pose || '').replace(/\s+/g, ' ').trim(), an = anneeValide(c.an);
    if (!nom || !ville || !pose || an == null) return { erreur: 'Remplissez le nom, la ville, le code postal, ce qui a été fait et l’année (quatre chiffres).' };
    if (!CP.test(cp)) return { erreur: 'Le code postal a cinq chiffres : par exemple 29100.' };
    if (nom.length > 160 || pose.length > 160 || ville.length > 80) return { erreur: 'Un des champs est trop long.' };
    return { nom: nom, ville: ville, cp: cp, pose: pose, an: an };
  }
  /* Les lignes de l'annuaire (phirst_officines : nom, nom_affiche, ville, cp, lat, lon) d'un même code postal → la position de la référence.
     D'abord la pharmacie du même nom ; à défaut la première du même code postal (position de la commune : juste à quelques km). null si aucune. */
  function choisirPosition(lignes, nom) {
    var l = (Array.isArray(lignes) ? lignes : []).filter(function (x) { return x && typeof x.lat === 'number' && typeof x.lon === 'number' && isFinite(x.lat) && isFinite(x.lon); });
    if (!l.length) return null;
    var n = P.norm(nom).replace(/^pharmacie\s+(de la |de l |du |des |de |d )?/, ''), exact = null;
    if (n) l.forEach(function (x) { if (!exact && (P.norm(x.nom_affiche || x.nom).indexOf(n) >= 0)) exact = x; });
    var x = exact || l[0];
    return { lat: x.lat, lon: x.lon, precise: !!exact };
  }
  /* La ligne à écrire dans phirst_textes pour une référence ; `position` : { lat, lon } ou null. */
  function ligneReference(v, position, cle) {
    return { sorte: 'reference', cle: cle, titre: v.nom, texte: '', details: {
      ville: v.ville, cp: v.cp, lat: position ? position.lat : null, lon: position ? position.lon : null, pose: v.pose, an: v.an, citee: false, visite: false } };
  }
  /* Ce que Yann lit sous une référence selon ses deux interrupteurs. */
  function noteReference(r) {
    var d = (r && r.details) || {};
    if (d.citee !== true) return 'Pas montrée à la téléprospectrice';
    return 'Montrée à la téléprospectrice' + (d.visite === true ? ' · visite possible' : '');
  }
  function resumeReferences(refs) {
    var l = Array.isArray(refs) ? refs : [], c = l.filter(function (r) { return r.details && r.details.citee === true; }).length, v = l.filter(function (r) { return r.details && r.details.visite === true; }).length;
    function pl(n, un, plu) { return n + ' ' + (n > 1 ? plu : un); }
    return pl(c, 'peut être citée', 'peuvent être citées') + ' · ' + pl(v, 'accepte une visite', 'acceptent une visite');
  }
  /* Ce que la téléprospectrice reçoit (telepro_textes) ou ce que Yann lit : une référence → la forme d'affichage { id, nom, ville, cp, lat, lon, pose, an, visite }.
     Une référence NON citée n'en sort jamais, d'où qu'elle vienne (ceinture et bretelles avec la base). */
  function referencesCitables(lignes) {
    return (Array.isArray(lignes) ? lignes : []).map(function (l) {
      if (!l) return null;
      if (l.details) { var d = l.details; return d.citee === true ? { id: l.id, nom: l.titre, ville: d.ville, cp: d.cp, lat: d.lat, lon: d.lon, pose: d.pose, an: d.an, visite: d.visite === true } : null; }
      return l;
    }).filter(function (r) { return r && r.nom; });
  }
  /* Les `combien` références citables les plus proches de `cible` ({ lat, lon }), avec la distance à vol d'oiseau arrondie (au moins 1 km). */
  function voisines(refs, cible, combien) {
    if (!cible || typeof cible.lat !== 'number' || typeof cible.lon !== 'number') return [];
    return (Array.isArray(refs) ? refs : []).filter(function (r) { return r && typeof r.lat === 'number' && typeof r.lon === 'number'; })
      .map(function (r) { return { ref: r, exact: P.kmEntre(cible, { lat: r.lat, lon: r.lon }) }; })
      .sort(function (a, b) { return a.exact - b.exact; }).slice(0, combien || 2)
      .map(function (x) { return { ref: x.ref, km: Math.max(1, Math.round(x.exact)) }; });
  }
  /* « de Rezé », « du Mans », « des Herbiers », « d'Auray » */
  function de(v) {
    v = String(v || '').trim();
    if (/^Les /.test(v)) return 'des ' + v.slice(4);
    if (/^Le /.test(v)) return 'du ' + v.slice(3);
    if (/^La /.test(v)) return 'de La ' + v.slice(3);
    if (/^[AEIOUYÉÈÊ]/i.test(v)) return 'd’' + v;
    return 'de ' + v;
  }
  /* « Phrase prête » : ce que la téléprospectrice peut dire. Rien n'est écrit en dur sur l'accord : il se lit dans la référence (citable → toujours vrai ici). */
  function phraseVoisine(ref, km) {
    var pose = String(ref.pose || '').trim(); pose = pose.charAt(0).toLowerCase() + pose.slice(1);
    var fin = ref.visite ? ' Son titulaire accepte que je vous en parle et vous reçoit volontiers pour une visite.' : ' Son titulaire accepte que je vous en parle.';
    return 'Votre confrère ' + de(ref.ville) + ', à ' + km + ' km, a travaillé avec Yann : ' + pose + (ref.an ? ' en ' + ref.an : '') + '.' + fin;
  }

  return { LONG_MAX: LONG_MAX, RAISONS: RAISONS, A_VENIR: A_VENIR, MAILS: MAILS, REPONSES_DEPART: REPONSES_DEPART, raisonDe: raisonDe, phrasesParCle: phrasesParCle, phraseDe: phraseDe,
    mentionPhrase: mentionPhrase, modifiee: modifiee, secondes: secondes, texteValide: texteValide,
    comptesDuMois: comptesDuMois, foisDuMois: foisDuMois, reponsesTriees: reponsesTriees, cleDe: cleDe, objectionNette: objectionNette, validerReponse: validerReponse, ditsEnTexte: ditsEnTexte,
    departementDe: departementDe, villeAvecDep: villeAvecDep, anneeValide: anneeValide, validerReference: validerReference, choisirPosition: choisirPosition, ligneReference: ligneReference,
    noteReference: noteReference, resumeReferences: resumeReferences, referencesCitables: referencesCitables, voisines: voisines, de: de, phraseVoisine: phraseVoisine };
});
