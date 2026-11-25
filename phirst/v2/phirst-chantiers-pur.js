/* PHIRST · logique PURE de l'écran « Chantiers » (lot 1, 23/11/2026) : aucune lecture de la page ni de la base, donc testable
   (tests/phirst-chantiers.test.mjs). L'écran (phirst-chantiers.js) et le bloc « Le chantier » des Dossiers ne font que l'affichage et les écritures.
   Règles reprises de la maquette validée par Will le 23/11 (K-chantiers-maquette/assets/chantiers-donnees.js et chantiers.js) :
   un chantier par volet Agencement ou Transfert, ouvert depuis l'étape « Travaux » ; c'est Yann qui coche ; la réception fait passer
   « Travaux » (et pour un Agencement « Réception des travaux ») à faites dans le dossier. Aucune somme d'argent ici.
   Tables : chantiers, chantier_artisans (retire_le = retiré, rien n'est effacé), chantier_taches (fait = la coche, photos).
   L4 (24/11/2026) : idée 9 « Ce client reviendra » (chantier_rappels : les rappels qu'une réception programme, échéances CALCULÉES depuis la date de réception)
   et idée 10 « Un confrère qui a un projet ? » (chantier_confreres : noté au bilan). Aucune somme d'argent ici non plus. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./phirst-dossiers-pur.js'), require('./phirst-pur.js'));
  else racine.PHIRST_CHANTIERS_PUR = fabrique(racine.PHIRST_DOSSIERS_PUR, racine.PHIRST_PUR);
})(typeof window !== 'undefined' ? window : this, function (D, P) {
  'use strict';

  var SORTES_CHANTIER = ['agencement', 'transfert'];
  /* Les tâches proposées à l'ouverture (case cochée par défaut, modifiables ensuite) : validées par Will le 23/11, mot pour mot. */
  var DEPART = ['Dépose de l’ancien mobilier', 'Électricité : prises, réseau, éclairage', 'Sol', 'Peinture', 'Pose du mobilier', 'Enseigne et croix', 'Nettoyage de fin de chantier'];
  var MAX_PHOTOS = 12;
  var JC = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var MC = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var E = ' ';
  var pl = D.pl;

  function jour(s) { var t = String(s || '').slice(0, 10); return D.estJour(t) ? t : null; }
  function aujDe(auj) { return auj || D.aujourdhui(); }
  /* Date courte, sans l'année quand c'est l'année en cours (« 26 nov. », « 18 janv. 2027 ») */
  function cj(s, auj) { var c = D.court(s); return String(s).slice(0, 4) === aujDe(auj).slice(0, 4) ? c.replace(/[ \u00A0]\d{4}$/, '') : c; }
  /* « aujourd'hui », « demain », « dans 12 jours », « passée de 3 jours » (espaces insécables : le nombre ne reste pas seul en bout de ligne) */
  function dans(n) {
    return n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : n > 1 ? 'dans' + E + n + E + 'jours' : 'passée de' + E + (-n) + E + (-n > 1 ? 'jours' : 'jour');
  }
  /* La tuile de date : { j: 'jeu.', n: 26, m: 'nov.' } */
  function tuile(s) {
    var p = String(s).slice(0, 10).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return { j: JC[d.getUTCDay()], n: +p[2], m: MC[+p[1] - 1] };
  }

  /* ── un chantier monté : ses artisans (actifs + tous, pour les noms des tâches déjà faites) et ses tâches ── */
  function monterChantier(ch, artisans, taches) {
    var tous = (artisans || []).filter(function (a) { return a && a.chantier_id === ch.id; }).map(function (a) {
      return { id: a.id, nom: String(a.nom || ''), metier: a.metier ? String(a.metier) : '', tel: a.tel ? String(a.tel) : '', retire: !!a.retire_le, cree: String(a.created_at || '') };
    }).sort(function (a, b) { return a.cree < b.cree ? -1 : a.cree > b.cree ? 1 : 0; });
    var ts = (taches || []).filter(function (t) { return t && t.chantier_id === ch.id; }).map(function (t) {
      return { id: t.id, titre: String(t.titre || ''), art: t.artisan_id || null, prevu: jour(t.prevue), fait: jour(t.fait), ordre: Number(t.ordre) || 0,
        photos: Array.isArray(t.photos) ? t.photos : [], cree: String(t.created_at || '') };
    }).sort(function (a, b) { return a.ordre - b.ordre || (a.cree < b.cree ? -1 : a.cree > b.cree ? 1 : 0); });
    return { id: ch.id, volet_id: ch.volet_id, debut: jour(ch.debut) || D.jourDeHorodatage(ch.created_at), ouverture: jour(ch.ouverture), recuLe: jour(ch.recu_le),
      artisans: tous.filter(function (a) { return !a.retire; }), tousArtisans: tous, taches: ts };
  }
  function artisan(c, id) { for (var i = 0; i < c.tousArtisans.length; i++) if (c.tousArtisans[i].id === id) return c.tousArtisans[i]; return null; }
  function nomArtisan(c, t) { var a = t.art && artisan(c, t.art); return a ? a.nom : 'Pas encore confiée'; }
  /* Tri par date prévue : une tâche datée passe avant une tâche sans date ; à date égale, l'ordre de saisie (tri stable). */
  function parDate(a, b) { if (a.prevu && b.prevu) return a.prevu < b.prevu ? -1 : a.prevu > b.prevu ? 1 : 0; return a.prevu ? -1 : b.prevu ? 1 : 0; }
  function aFaire(c) { return c.taches.filter(function (t) { return !t.fait; }).sort(parDate); }
  function faites(c) { return c.taches.filter(function (t) { return t.fait; }).sort(function (a, b) { return a.fait < b.fait ? 1 : a.fait > b.fait ? -1 : 0; }); }
  function nbFaites(c) { return c.taches.filter(function (t) { return t.fait; }).length; }
  function retard(t, auj) { return t && !t.fait && t.prevu ? Math.max(0, D.joursEntre(t.prevu, aujDe(auj))) : 0; }
  function enRetard(c, auj) { return aFaire(c).filter(function (t) { return retard(t, auj) > 0; }); }
  function prochaine(c) { return aFaire(c)[0] || null; }
  function jours(c, auj) { return D.joursEntre(aujDe(auj), c.ouverture); }
  function pretPourReception(c) { return !c.recuLe && c.taches.length > 0 && !aFaire(c).length; }
  /* La pastille d'état d'un chantier (même ordre que la maquette) : { ton, texte } */
  function statut(c, auj) {
    if (c.recuLe) return { ton: 'vert', texte: 'Réceptionné' };
    if (pretPourReception(c)) return { ton: 'vert', texte: 'Prêt pour la réception' };
    if (jours(c, auj) < 0) return { ton: 'rouge', texte: 'Ouverture passée' };
    var r = enRetard(c, auj).length;
    if (r) return { ton: 'rouge', texte: pl(r, 'tâche en retard', 'tâches en retard') };
    return { ton: 'vert', texte: 'En cours' };
  }
  /* La barre d'avancée : une case par tâche, faites d'abord puis par date ; f = faite, r = en retard, c = la prochaine */
  function segments(c, auj) {
    var pr = prochaine(c);
    return c.taches.slice().sort(function (a, b) {
      if (!!a.fait !== !!b.fait) return a.fait ? -1 : 1;
      var x = a.prevu || '9', y = b.prevu || '9'; return x < y ? -1 : x > y ? 1 : 0;
    }).map(function (t) { return t.fait ? 'f' : retard(t, auj) > 0 ? 'r' : t === pr ? 'c' : ''; });
  }
  /* La ligne de date d'une tâche : { texte, retard } */
  function quand(t, auj) {
    if (t.fait) return { texte: 'Faite le ' + cj(t.fait, auj), retard: false };
    if (!t.prevu) return { texte: 'Date à fixer', retard: false };
    var r = retard(t, auj);
    return r > 0 ? { texte: 'En retard de ' + pl(r, 'jour', 'jours') + ' · prévue le ' + cj(t.prevu, auj), retard: true } : { texte: 'Prévue le ' + cj(t.prevu, auj), retard: false };
  }
  /* « 3 chantiers en cours : 1 avec du retard, 1 prêt pour la réception. » */
  function phraseCompte(cours, auj) {
    if (!cours.length) return 'Aucun chantier en cours.';
    var nr = cours.filter(function (c) { return enRetard(c, auj).length; }).length, np = cours.filter(pretPourReception).length;
    var parts = [nr ? pl(nr, 'avec du retard', 'avec du retard') : '', np ? pl(np, 'prêt pour la réception', 'prêts pour la réception') : ''].filter(Boolean);
    return pl(cours.length, 'chantier en cours', 'chantiers en cours') + (parts.length ? ' : ' + parts.join(', ') + '.' : '.');
  }
  /* En cours : l'ouverture la plus proche en premier ; réceptionnés : la réception la plus récente en premier. */
  function trierEnCours(cs) { return cs.slice().sort(function (a, b) { return a.ouverture < b.ouverture ? -1 : a.ouverture > b.ouverture ? 1 : 0; }); }
  function trierRecus(cs) { return cs.slice().sort(function (a, b) { return a.recuLe < b.recuLe ? 1 : a.recuLe > b.recuLe ? -1 : 0; }); }

  /* ── le lien avec les dossiers ── */
  function aUnChantier(sorte) { return SORTES_CHANTIER.indexOf(sorte) >= 0; }
  function etapeTravaux(v) { for (var i = 0; i < v.etapes.length; i++) if (v.etapes[i].k === 'travaux') return v.etapes[i]; return null; }
  /* Les volets prêts pour un chantier : Agencement ou Transfert, en cours, sans chantier, à une étape au plus de « Travaux ».
     phs = D.pharmacies(...) ; voletsAvecChantier = identifiants des volets qui ont déjà un chantier. Tri : date prévue de « Travaux », puis nom. */
  function prets(phs, voletsAvecChantier) {
    var avec = voletsAvecChantier || [], l = [];
    (phs || []).forEach(function (ph) {
      ph.volets.forEach(function (v) {
        if (!aUnChantier(v.sorte) || v.etat !== 'cours' || avec.indexOf(v.id) >= 0) return;
        var pr = D.prochaineEtape(v); if (!pr) return;
        var i = v.etapes.indexOf(pr), tr = -1;
        v.etapes.forEach(function (e, j) { if (e.k === 'travaux') tr = j; });
        if (tr >= 0 && i >= tr - 1 && i <= tr) l.push({ ph: ph, volet: v, travaux: v.etapes[tr], prochaine: pr });
      });
    });
    return l.sort(function (a, b) {
      var x = a.travaux.prevue || '9999-99-99', y = b.travaux.prevue || '9999-99-99';
      return x < y ? -1 : x > y ? 1 : String(a.ph.dossier.nom || '').localeCompare(String(b.ph.dossier.nom || ''), 'fr', { sensitivity: 'base' });
    });
  }
  /* Les étapes du dossier que la réception fait passer à faites */
  function etapesAReceptionner(sorte) { return sorte === 'agencement' ? ['travaux', 'reception'] : ['travaux']; }
  function texteReception(sorte) {
    return sorte === 'agencement' ? 'les étapes « Travaux » et « Réception des travaux » du dossier passent à faites' : 'l’étape « Travaux » du dossier passe à faite';
  }
  /* Les lignes dossier_etapes à écrire à la réception : faite = aujourd'hui (si elle ne l'est pas déjà) ; date prévue posée si elle manquait. */
  function lignesReception(v, auj) {
    var a = aujDe(auj), cles = etapesAReceptionner(v.sorte), l = [];
    v.etapes.forEach(function (e) {
      if (cles.indexOf(e.k) < 0 || e.faite) return;
      var o = { volet_id: v.id, cle: e.k, faite: a }; if (!e.prevue) o.prevue = a;
      l.push(o);
    });
    return l;
  }
  /* Les tâches habituelles, prêtes à insérer */
  function tachesDepart(chantierId, userId) {
    return DEPART.map(function (t, i) { return { chantier_id: chantierId, user_id: userId, titre: t, ordre: i }; });
  }
  function ordreSuivant(c) { var m = -1; c.taches.forEach(function (t) { if (t.ordre > m) m = t.ordre; }); return m + 1; }
  /* Le résumé du bloc « Le chantier » dans l'étape Travaux du dossier */
  function resume(c, auj) {
    var n = c.taches.length, f = nbFaites(c), pr = prochaine(c), r = enRetard(c, auj).length;
    return {
      avancee: n ? f + ' sur ' + n + ' tâches faites' : 'Aucune tâche pour l’instant',
      ouverture: 'ouverture ' + (c.recuLe ? 'le ' : 'promise le ') + D.jourLong(c.ouverture),
      etat: c.recuLe ? { ton: 'vert', texte: 'Réceptionné le ' + D.court(c.recuLe) } : r ? { ton: 'rouge', texte: pl(r, 'tâche en retard', 'tâches en retard') } : { ton: 'vert', texte: 'En cours' },
      prochaine: pr && !c.recuLe ? 'Prochaine étape : ' + pr.titre + (pr.art && artisan(c, pr.art) ? ' (' + artisan(c, pr.art).nom + ')' : '') + '.' : ''
    };
  }

  /* ── contrôles des champs : { ok, valeur, erreur } ── */
  function verifierTitre(v) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return { ok: false, valeur: '', erreur: 'Écrivez d’abord la tâche.' };
    if (t.length > 200) return { ok: false, valeur: t, erreur: 'La tâche est trop longue : 200 caractères au plus.' };
    return { ok: true, valeur: t };
  }
  function verifierArtisan(s) {
    s = s || {};
    var nom = String(s.nom == null ? '' : s.nom).trim(), met = String(s.metier == null ? '' : s.metier).trim(), tel = String(s.tel == null ? '' : s.tel).trim();
    if (!nom) return { ok: false, erreur: 'Écrivez d’abord le nom de l’entreprise.' };
    if (nom.length > 200) return { ok: false, erreur: 'Le nom est trop long : 200 caractères au plus.' };
    if (met.length > 200) return { ok: false, erreur: 'Le métier est trop long : 200 caractères au plus.' };
    if (tel && (tel.length > 40 || !/^[0-9+ .()\-]+$/.test(tel) || tel.replace(/\D/g, '').length < 4)) return { ok: false, erreur: 'Ce numéro de téléphone ne semble pas juste : des chiffres seulement.' };
    return { ok: true, valeur: { nom: nom, metier: met || null, tel: tel ? D.telLisible(tel) : null } };
  }
  function metierAffiche(a) { return a.metier || 'Métier à préciser'; }
  function lienTel(tel) { var n = String(tel || '').replace(/[^\d+]/g, ''); return n ? 'tel:' + n : ''; }
  /* Photo d'une tâche : seau 'dossiers', sous le compte et le dossier (mêmes règles de seau que les documents des étapes) */
  function cheminPhoto(userId, dossierId, tacheId, nom, horodatage) {
    return userId + '/' + dossierId + '/chantier/' + tacheId + '/' + horodatage + '-' + D.nomFichierPropre(nom);
  }
  function verifierPhoto(f, nbPhotos) {
    if (!f || !f.size) return 'Ce fichier est vide : choisissez-en un autre.';
    if (!/^image\//.test(String(f.type || ''))) return 'Choisissez une photo (une image).';
    if (f.size > D.MAX_FICHIER) return 'Cette photo fait ' + D.tailleLisible(f.size) + ' : le maximum est de 25 Mo.';
    if ((nbPhotos || 0) >= MAX_PHOTOS) return 'Cette tâche a déjà ' + MAX_PHOTOS + ' photos, le maximum.';
    return '';
  }
  /* Taille d'une photo réduite : le grand côté à 1 600 points au plus, proportions gardées */
  function tailleReduite(l, h, max) {
    max = max || 1600; if (!(l > 0) || !(h > 0)) return { l: 0, h: 0 };
    var k = Math.min(1, max / Math.max(l, h)); return { l: Math.round(l * k), h: Math.round(h * k) };
  }


  /* ═══ IDÉE 9 · « Ce client reviendra » : les rappels qu'un chantier réceptionné programme (L4, 24/11/2026) ═══
     Un rappel = une ligne chantier_rappels : { type: bilan | entretien | remplacement, mois, robot, echeance, raison, etiquette, note, retire_le, fait_le }.
     L'échéance est CALCULÉE : date de réception + `mois` (jamais écrite en dur). Les trois départs ci-dessous sont les propositions de la maquette validée ;
     Yann change une date ou retire un rappel, rien d'autre n'est figé. `raison` est la phrase que la téléprospectrice lira ; elle ne contient aucune somme. */
  var RAPPELS_DEPART = [{ type: 'bilan', mois: 3 }, { type: 'entretien', mois: 12 }, { type: 'remplacement', mois: 120, robot: true }];
  var MOTS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
  /* Ajoute n mois à une date AAAA-MM-JJ ; le 31 devient le dernier jour d'un mois plus court (31 août + 6 mois = 28 février). */
  function ajouterMois(s, n) {
    var p = String(s).slice(0, 10).split('-'), m = +p[1] - 1 + n, a = +p[0] + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
    var dernier = new Date(Date.UTC(a, mm + 1, 0)).getUTCDate(), j = Math.min(+p[2], dernier);
    return a + '-' + ('0' + (mm + 1)).slice(-2) + '-' + ('0' + j).slice(-2);
  }
  /* « 3 mois », « 1 an », « 10 ans », « 18 mois » */
  function dureeCourte(m) { return m % 12 === 0 ? (m / 12) + ' ' + (m === 12 ? 'an' : 'ans') : m + ' mois'; }   // espaces simples : ce texte est écrit en base
  /* « Il y a 3 mois », « Il y a un an », « Il y a dix ans » (en lettres jusqu'à dix, comme la maquette) */
  function ilYa(m) {
    if (m % 12 !== 0) return 'Il y a ' + m + ' mois';
    var a = m / 12; return 'Il y a ' + (MOTS[a] || a) + (a === 1 ? ' an' : ' ans');
  }
  function nomRobot(r) { return r === 'pda' ? 'robot PDA' : 'robot Riedl'; }
  /* Le robot de la pharmacie : un volet Riedl ou PDA dans son dossier (ph = D.pharmacies(...)[i]) ; sinon null. */
  function robotDePharmacie(ph) {
    var vs = (ph && ph.volets) || [];
    for (var i = 0; i < vs.length; i++) if (vs[i].sorte === 'riedl' || vs[i].sorte === 'pda') return vs[i].sorte;
    return null;
  }
  function titreRappel(type, mois) {
    return type === 'bilan' ? 'Bilan à ' + dureeCourte(mois) : type === 'entretien' ? 'Contrat d’entretien' : 'Remplacement du robot à étudier';
  }
  /* L'étiquette que la téléprospectrice voit dans sa liste */
  function etiquetteRappel(type, mois) {
    return 'Client · ' + (type === 'bilan' ? 'bilan à ' + dureeCourte(mois) : type === 'entretien' ? 'contrat d’entretien' : 'remplacement du robot');
  }
  /* La phrase écrite (raison n° 1 de la liste). sorte = celle du chantier (agencement | transfert) ; robot = riedl | pda | null. */
  function raisonRappel(type, mois, sorte, robot) {
    var tr = sorte === 'transfert' ? 'de transfert' : 'd’agencement', quoi = robot ? 'pose du ' + nomRobot(robot) : 'réception du chantier ' + tr;
    if (type === 'bilan') return ilYa(mois) + ', ' + quoi + ' : un bilan à faire avec le pharmacien';
    if (type === 'entretien') return ilYa(mois) + ', ' + quoi + ' : le contrat d’entretien est à proposer';
    return ilYa(mois) + ', ' + quoi + ' : un remplacement à étudier';
  }
  /* Les rappels à écrire pour un chantier réceptionné. existants = les types déjà programmés (on n'en double aucun). */
  function rappelsAProgrammer(x, robot, existants) {
    var c = x.c, sorte = x.volet.sorte, deja = {}, l = [];
    (existants || []).forEach(function (r) { deja[r.type] = 1; });
    if (!c.recuLe) return l;
    RAPPELS_DEPART.forEach(function (d) {
      if (deja[d.type] || (d.robot && !robot)) return;
      l.push({ chantier_id: c.id, type: d.type, mois: d.mois, robot: robot || null, echeance: ajouterMois(c.recuLe, d.mois),
        raison: raisonRappel(d.type, d.mois, sorte, robot), etiquette: etiquetteRappel(d.type, d.mois) });
    });
    return l;
  }
  /* Une ligne de la base → le rappel tel que l'écran le montre */
  function monterRappel(r, auj) {
    var date = jour(r.echeance);
    return { id: r.id, chantier: r.chantier_id, type: r.type, mois: Number(r.mois) || 0, robot: r.robot || null, date: date, raison: String(r.raison || ''), etiquette: String(r.etiquette || ''),
      note: r.note ? String(r.note) : '', retire: !!r.retire_le, fait: !!r.fait_le, passe: !!date && date <= aujDe(auj), titre: titreRappel(r.type, Number(r.mois) || 0) };
  }
  var ORDRE_TYPE = { bilan: 0, entretien: 1, remplacement: 2 };
  function rappelsDuChantier(lignes, chantierId, auj) {
    return (lignes || []).filter(function (r) { return r && r.chantier_id === chantierId; }).map(function (r) { return monterRappel(r, auj); })
      .sort(function (a, b) { return (ORDRE_TYPE[a.type] || 0) - (ORDRE_TYPE[b.type] || 0); });
  }
  /* « le 12 février 2027 » ; le remplacement, si loin, se dit par le mois : « en novembre 2036 » */
  function quandRappel(r) {
    if (!r.date) return 'à une date à choisir';
    return r.type === 'remplacement' ? 'en ' + D.long(r.date).replace(/^\d+(er)? /, '') : 'le ' + D.long(r.date);
  }
  /* Le bilan arrivé à échéance et pas encore noté (ni retiré) */
  function bilanAFaire(rappels) {
    return (rappels || []).filter(function (r) { return r.type === 'bilan' && !r.retire && !r.fait && r.passe; })[0] || null;
  }
  /* Le résumé de la carte « Réceptionnés » : une ligne par rappel gardé */
  function resumeRappels(rappels) {
    return (rappels || []).filter(function (r) { return !r.retire; }).map(function (r) { return { titre: r.titre, quand: r.fait ? 'fait' : quandRappel(r) }; });
  }
  /* Une nouvelle date : un vrai jour, et pas avant aujourd'hui (un rappel passé arriverait demain matin sans que Yann l'ait voulu). */
  function verifierDateRappel(v, auj) {
    var t = String(v == null ? '' : v).trim();
    if (!D.estJour(t)) return { ok: false, erreur: 'Choisissez une date.' };
    if (t < aujDe(auj)) return { ok: false, erreur: 'Choisissez une date à partir d’aujourd’hui.' };
    return { ok: true, valeur: t };
  }

  /* ═══ IDÉE 10 · « Un confrère qui a un projet ? » : noté au bilan, il entre dans la liste d'appels « De la part de <pharmacie> » ═══ */
  function verifierConfrere(s, deja) {
    s = s || {};
    var nom = String(s.nom == null ? '' : s.nom).replace(/\s+/g, ' ').trim(), ville = String(s.ville == null ? '' : s.ville).replace(/\s+/g, ' ').trim(), note = String(s.note == null ? '' : s.note).replace(/\s+/g, ' ').trim();
    if (!nom) return { ok: false, champ: 'nom', erreur: 'Écrivez d’abord le nom de la pharmacie du confrère.' };
    if (nom.length > 120) return { ok: false, champ: 'nom', erreur: 'Ce nom est trop long : 120 caractères au plus.' };
    if (!ville) return { ok: false, champ: 'ville', erreur: 'Écrivez aussi sa ville.' };
    if (ville.length > 80) return { ok: false, champ: 'ville', erreur: 'Cette ville est trop longue : 80 caractères au plus.' };
    if (note.length > 300) return { ok: false, champ: 'note', erreur: 'Cette note est trop longue : 300 caractères au plus.' };
    var k = cleConfrere(nom, ville);
    for (var i = 0; i < (deja || []).length; i++) if (!deja[i].retire && cleConfrere(deja[i].nom, deja[i].ville) === k) return { ok: false, champ: 'nom', erreur: 'Ce confrère est déjà dans la liste de la téléprospectrice.' };
    var alerte = P && P.contientMontant && note && P.contientMontant(note) ? 'Cette note parle d’argent : la téléprospectrice ne la verra pas. Retirez la somme pour qu’elle la lise.' : '';
    return { ok: true, valeur: { nom: nom, ville: ville, note: note || null }, alerte: alerte };
  }
  function cleConfrere(nom, ville) {
    var n = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); };
    return n(nom) + '|' + n(ville);
  }
  function monterConfrere(r) {
    return { id: r.id, chantier: r.chantier_id, nom: String(r.nom || ''), ville: String(r.ville || ''), note: r.note ? String(r.note) : '', par: String(r.par || ''), retire: !!r.retire_le, cree: String(r.created_at || '') };
  }
  function confreresDuChantier(lignes, chantierId) {
    return (lignes || []).filter(function (r) { return r && r.chantier_id === chantierId; }).map(monterConfrere)
      .sort(function (a, b) { return a.cree < b.cree ? -1 : a.cree > b.cree ? 1 : 0; });
  }
  /* « de la part de Pharmacie X » : ce que la téléprospectrice dira (et verra dans l'étiquette de sa liste) */
  function phraseDeLaPart(par) { return 'de la part de ' + String(par || '').trim(); }

  return {
    SORTES_CHANTIER: SORTES_CHANTIER, DEPART: DEPART, MAX_PHOTOS: MAX_PHOTOS,
    cj: cj, dans: dans, tuile: tuile, monterChantier: monterChantier, artisan: artisan, nomArtisan: nomArtisan,
    aFaire: aFaire, faites: faites, nbFaites: nbFaites, retard: retard, enRetard: enRetard, prochaine: prochaine, jours: jours, pretPourReception: pretPourReception,
    statut: statut, segments: segments, quand: quand, phraseCompte: phraseCompte, trierEnCours: trierEnCours, trierRecus: trierRecus,
    aUnChantier: aUnChantier, etapeTravaux: etapeTravaux, prets: prets, etapesAReceptionner: etapesAReceptionner, texteReception: texteReception, lignesReception: lignesReception,
    tachesDepart: tachesDepart, ordreSuivant: ordreSuivant, resume: resume,
    RAPPELS_DEPART: RAPPELS_DEPART, ajouterMois: ajouterMois, dureeCourte: dureeCourte, ilYa: ilYa, nomRobot: nomRobot, robotDePharmacie: robotDePharmacie, titreRappel: titreRappel,
    etiquetteRappel: etiquetteRappel, raisonRappel: raisonRappel, rappelsAProgrammer: rappelsAProgrammer, monterRappel: monterRappel, rappelsDuChantier: rappelsDuChantier,
    quandRappel: quandRappel, bilanAFaire: bilanAFaire, resumeRappels: resumeRappels, verifierDateRappel: verifierDateRappel,
    verifierConfrere: verifierConfrere, cleConfrere: cleConfrere, monterConfrere: monterConfrere, confreresDuChantier: confreresDuChantier, phraseDeLaPart: phraseDeLaPart,
    verifierTitre: verifierTitre, verifierArtisan: verifierArtisan, metierAffiche: metierAffiche, lienTel: lienTel, cheminPhoto: cheminPhoto, verifierPhoto: verifierPhoto, tailleReduite: tailleReduite
  };
});
