/* PHIRST · logique PURE de « La veille du rendez-vous » (idée 6, 24/11/2026) : aucune lecture de la page ni de la base, donc testable
   (tests/phirst-l3-preparer.test.mjs). L'écran (phirst-preparer.js) lit la fiche, le journal des appels, le rendez-vous et le dossier, puis
   n'affiche QUE ce qui existe : une rubrique sans donnée disparaît, elle ne dit jamais « aucun ». Rien de ce qui est dit à Yann n'est écrit
   en dur : durée = celle du rendez-vous, route = calculée depuis la base de l'agenda, appui chez Intégral = phirst_integral. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./phirst-pur.js'), require('./phirst-dossiers-pur.js'));
  else racine.PHIRST_PREPARER_PUR = fabrique(racine.PHIRST_PUR, racine.PHIRST_DOSSIERS_PUR);
})(typeof window !== 'undefined' ? window : this, function (P, D) {
  'use strict';

  function txt(v) { return typeof v === 'string' ? v.trim() : ''; }
  function point(o) { return o && typeof o.lat === 'number' && typeof o.lon === 'number' ? { lat: o.lat, lon: o.lon } : null; }
  /* Le jour (heure de Paris) d'un horodatage de la base */
  function jourParis(ts) { return D.jourDeHorodatage(ts); }

  /* ── Quels rendez-vous ont leur page ── */
  /* Le prochain jour où Yann travaille, après aujourd'hui : demain, ou lundi quand on est vendredi ou le week-end. */
  function jourDeVeille(auj) { return P.joursOuvres(P.ajouterJours(auj, 1), 1)[0]; }
  /* Une page est prête pour un rendez-vous CONFIRMÉ (pas à confirmer, pas déplacé en attente, pas annulé, pas fait) d'aujourd'hui ou du jour de veille. */
  function pageDisponible(rdv, auj) {
    if (!rdv || rdv.statut !== 'confirme' || !rdv.debut) return false;
    var j = String(rdv.debut).slice(0, 10);
    return j === auj || j === jourDeVeille(auj);
  }
  /* Un rendez-vous qui n'a pas encore de page, mais en aura une : à confirmer ou déplacé, pas encore passé. */
  function pageEnAttente(rdv, auj) {
    if (!rdv || (rdv.statut !== 'propose' && rdv.statut !== 'reporte') || !rdv.debut) return false;
    return String(rdv.debut).slice(0, 10) >= auj;
  }
  /* Le bandeau du haut de l'agenda : les rendez-vous confirmés du jour de veille. null = rien à annoncer. */
  function bandeau(els, auj) {
    var veille = jourDeVeille(auj);
    var l = (els || []).filter(function (e) { return e.rdv.statut === 'confirme' && String(e.rdv.debut).slice(0, 10) === veille; })
      .sort(function (a, b) { return P.minutes(a.rdv.debut) - P.minutes(b.rdv.debut); });
    if (!l.length) return null;
    var demain = veille === P.ajouterJours(auj, 1), mot = demain ? 'Demain' : P.maj(P.dateLongue(veille).split(' ')[0]);
    return {
      jour: veille, n: l.length,
      titre: mot + ' : ' + (l.length > 1 ? l.length + ' rendez-vous, leurs pages sont prêtes.' : '1 rendez-vous, sa page est prête.'),
      sous: 'Prêtes pour ' + P.dateLongue(veille) + '.',
      boutons: l.map(function (e) { return { id: e.rdv.id, texte: P.heureFr(String(e.rdv.debut).slice(11)) + (e.fiche && e.fiche.ville ? ' · ' + e.fiche.ville : '') }; })
    };
  }

  /* ── L'en-tête : jour et heure, durée, route ── */
  /* La route : depuis le rendez-vous d'avant le même jour s'il y en a un, sinon depuis la base de l'agenda (réglage). '' si un lieu n'a pas de position. */
  function route(rdv, fiche, els, base) {
    var vers = point(fiche), de = null, nom = '';
    if (!vers) return null;
    var prev = null;
    (els || []).forEach(function (e) {
      if (e.rdv.id === rdv.id || e.rdv.statut === 'annule' || String(e.rdv.debut).slice(0, 10) !== String(rdv.debut).slice(0, 10)) return;
      if (P.minutes(e.rdv.fin) <= P.minutes(rdv.debut) && (!prev || P.minutes(e.rdv.fin) > P.minutes(prev.rdv.fin))) prev = e;
    });
    if (prev && point(prev.fiche)) { de = point(prev.fiche); nom = prev.fiche.ville || 'le rendez-vous d’avant'; }
    else if (base && point(base)) { de = point(base); nom = base.commune || ''; }
    if (!de) return null;
    var min = P.trajetMin(de, vers);
    return { minutes: min, depuis: nom, texte: 'Environ ' + P.dureeFr(min) + ' de route' + (nom ? ' depuis ' + nom : ''), court: P.dureeFr(min) + (nom ? ' depuis ' + nom : '') };
  }
  function enTete(rdv, fiche, r) {
    var faits = [{ e: 'Jour et heure', v: P.maj(P.quandFr(rdv.debut)).replace(' à ', ' · ') }, { e: 'Durée', v: P.dureeFr(rdv.duree_min || P.DUREE_RDV_DEFAUT) }];
    if (r) faits.push({ e: 'Route', v: r.court });
    return { nom: fiche.nom || 'Pharmacie', lieu: [fiche.ville, fiche.cp ? '(' + fiche.cp + ')' : ''].filter(Boolean).join(' '), faits: faits };
  }

  /* ── Ce qu'a noté la téléprospectrice ── */
  /* Les réponses aux « cinq questions » (lot L2) : le rendez-vous porte `questions_lignes`, un tableau de phrases lisibles (« Projet : Robot Riedl »).
     Affichées telles quelles, 8 au plus, seulement si le tableau est présent et non vide ; sinon rien (pas de bloc vide). */
  function questionsLignes(rdv) {
    var l = rdv && rdv.questions_lignes; if (!Array.isArray(l)) return [];
    return l.filter(function (x) { return typeof x === 'string' && x.trim(); }).map(function (x) { return x.trim().slice(0, 300); }).slice(0, 8);
  }
  /* « Premier rendez-vous » n'apprend rien : on ne le répète pas comme titre du projet. */
  function projetDit(objet) { var o = txt(objet); return o && P.norm(o) !== 'premier rendez-vous' ? o : ''; }
  function origine(rdv, equipe, auj) {
    var par = P.nomAuteur(equipe, rdv.creePar), j = jourParis(rdv.creeLe);
    var qui = rdv.prisParTelepro ? (par ? 'Rendez-vous pris par ' + par : 'Rendez-vous pris par la téléprospectrice') : 'Rendez-vous posé par vous';
    return qui + (j ? ' · ' + P.jourAvecAnnee(j, auj) : '') + '.';
  }
  /* Le journal de la fiche, du plus récent au plus ancien (lignes déjà triées par la base) : au plus 8 lignes. */
  function journal(lignes, equipe, auj, max) {
    return (lignes || []).slice(0, max || 8).map(function (a) {
      var j = jourParis(a.created_at);
      return { quand: j ? P.jourAvecAnnee(j, auj) : '', texte: P.avecAuteur(P.phraseJournal(a.type, a.body), P.nomAuteur(equipe, a.author_id)) };
    });
  }
  /* « Pourquoi elle l'a appelée » : la première note de la fiche (celle que l'écran Appels écrit à la création, avec les raisons). */
  function pourquoiAppelee(lignes) {
    var notes = (lignes || []).filter(function (a) { return a.type === 'note' && txt(a.body) && txt(a.body).charAt(0) !== '{'; });
    return notes.length ? txt(notes[notes.length - 1].body).slice(0, 400) : '';
  }

  /* ── La pharmacie : ce que la fiche et l'annuaire disent, rien d'autre ── */
  function pharmacie(fiche, ligneAnnuaire) {
    var f = ligneAnnuaire || {}, l = [];
    function ajout(e, v, tel) { v = txt(v); if (v) l.push({ e: e, v: v, tel: !!tel }); }
    ajout('Titulaire', fiche.pharmacien || f.pharmacien);
    ajout('Téléphone', P.telFr(fiche.telephone || f.telephone || ''), true);
    ajout('Mail', fiche.email || f.email);
    ajout('Groupement', P.libelleGroupements(f.groupements || []));
    if (f.tt_type) ajout('Cession ou ouverture', f.tt_type + (f.tt_date ? ', annonce officielle du ' + P.frDate(f.tt_date) : ''));
    if (f.fab || f.robot_modele) ajout('Robot actuel', [f.fab, f.robot_modele].filter(Boolean).join(' · ') + (f.robot_date ? ', posé le ' + P.frDate(f.robot_date) : ''));
    else if (fiche.robot_marque) ajout('Robot actuel', fiche.robot_marque);
    if (f.n_ehpad > 0) ajout('EHPAD proches', f.n_ehpad + (f.n_ehpad > 1 ? ' EHPAD' : ' EHPAD') + ' à proximité' + ((f.ehpad_proches || []).length ? ' : ' + f.ehpad_proches.slice(0, 3).join(', ') : ''));
    return l;
  }

  /* ── Les voisines déjà équipées par Yann : des pharmacies de ses dossiers qui ont un volet TERMINÉ, près de celle-ci ── */
  function voisines(fiche, autres, n, maxKm) {
    var c = point(fiche); if (!c) return [];
    return (autres || []).filter(function (a) { return a.id !== fiche.id && a.termines && a.termines.length && point(a); })
      .map(function (a) { return { nom: a.nom, ville: a.ville || '', volets: a.termines.join(', '), km: Math.round(P.kmEntre(c, point(a))) }; })
      .filter(function (a) { return a.km <= (maxKm || 60); }).sort(function (a, b) { return a.km - b.km; }).slice(0, n || 2);
  }

  /* ── Le dossier, s'il existe : ses volets, leur avancée, ce qui retient ── */
  function dossier(ph, auj) {
    if (!ph || !ph.volets.length) return null;
    var retenues = D.retenues([ph], auj);
    return {
      id: ph.dossier.id, nom: ph.dossier.nom,
      volets: ph.volets.map(function (v) {
        var pr = D.prochaineEtape(v), dl = pr ? D.ligneDate(pr, auj) : null, st = D.statutVolet(v, auj);
        return { sorte: v.sorte, nom: v.nom, avance: D.nbFaites(v) + ' sur ' + v.etapes.length, etat: st.texte, ton: st.ton,
          prochaine: pr && v.etat === 'cours' ? pr.t : '', date: pr && v.etat === 'cours' && dl ? dl.texte : '', retard: !!(dl && dl.retard), raison: v.etat !== 'cours' ? v.raison : '' };
      }),
      retient: retenues.map(function (r) { return r.volet.nom + ' : ' + r.etape.c + ' (' + D.deQui(r.qui.qui) + ')' + ' retient ' + r.attendent.map(function (a) { return a.t; }).join(', ') + '.'; })
    };
  }

  /* ── À apporter : une proposition de départ, par sorte de projet. Yann coche ce qu'il a pris. ── */
  var SORTES_TEXTE = [[/riedl|robot/i, 'riedl'], [/transfert|\bars\b|nouveau local/i, 'transfert'], [/agencement|am[ée]nagement|r[ée]novation/i, 'agencement'], [/\bpda\b|pilulier|ehpad|pr[ée]paration des doses/i, 'pda']];
  function sorteDeProjet(objet, volets) {
    var o = txt(objet), i;
    for (i = 0; i < SORTES_TEXTE.length; i++) if (SORTES_TEXTE[i][0].test(o)) return SORTES_TEXTE[i][1];
    var u = D.urgent(volets || [], P.aujourdhui());
    return u ? u.volet.sorte : '';
  }
  var APPORTER = {
    riedl: ['La fiche du robot Riedl (encombrement, accès pour la livraison)', 'Le plan du local, à demander sur place', 'Un mètre laser', 'Un carnet pour noter les questions sur le robot actuel'],
    transfert: ['Le calendrier d’une demande à l’ARS, à imprimer', 'Le plan du local actuel', 'L’adresse et le plan du local visé, à demander au titulaire', 'Le tableau des surfaces d’un transfert'],
    agencement: ['Un mètre laser et un appareil photo', 'Le plan du local actuel, à demander sur place', 'La planche d’ambiance et les échantillons de matières', 'Le carnet des besoins du pharmacien'],
    pda: ['La fiche de la préparation des doses', 'La liste des EHPAD servis, à demander', 'Un carnet pour noter le logiciel de la pharmacie'],
    '': ['De quoi noter', 'Un mètre laser et un appareil photo pour un premier relevé']
  };
  function aApporter(sorte, voisine) {
    var l = (APPORTER[sorte] || APPORTER['']).slice();
    if (voisine) l.push('La fiche de ' + voisine.nom + (voisine.ville ? ', à ' + voisine.ville : '') + ' : un projet déjà réalisé chez vous, à citer en exemple');
    return l;
  }
  /* La clé qui garde les cases cochées d'un rendez-vous dans cet ordinateur */
  function cleCases(rdvId) { return 'phirst-veille-' + String(rdvId); }
  /* Les indices cochés, lus du texte gardé ; un texte illisible = rien de coché (jamais une erreur) */
  function casesLues(texte, n) {
    try { var a = JSON.parse(String(texte)); return Array.isArray(a) ? a.filter(function (i) { return Number.isInteger(i) && i >= 0 && i < n; }) : []; } catch (e) { return []; }
  }

  return {
    jourDeVeille: jourDeVeille, pageDisponible: pageDisponible, pageEnAttente: pageEnAttente, bandeau: bandeau, route: route, enTete: enTete,
    questionsLignes: questionsLignes, projetDit: projetDit, origine: origine, journal: journal, pourquoiAppelee: pourquoiAppelee, pharmacie: pharmacie,
    voisines: voisines, dossier: dossier, sorteDeProjet: sorteDeProjet, aApporter: aApporter, cleCases: cleCases, casesLues: casesLues
  };
});
