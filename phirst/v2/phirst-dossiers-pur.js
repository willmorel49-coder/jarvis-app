/* PHIRST · logique PURE de l'écran « Dossiers de projet » (23/11/2026) : aucune lecture de la page ni de la base, donc testable
   (tests/phirst-dossiers.test.mjs). L'écran (phirst-dossiers.js) ne fait que l'affichage et les écritures.
   Modèle : un dossier par PHARMACIE (table `dossiers`), à volets (`dossier_volets`, un par sorte), chaque volet a ses étapes
   (`dossier_etapes`, une ligne par étape touchée). « Terminé » n'est jamais stocké : il se calcule.
   Les 4 sortes et leurs 37 étapes (textes `t`, noms courts `c`, clés `k`) sont ceux de la maquette choisie par Will, mot pour mot. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.PHIRST_DOSSIERS_PUR = fabrique();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var ORDRE = ['transfert', 'agencement', 'riedl', 'pda'];
  var SORTES = {
    transfert: { nom: 'Transfert', etapes: [
      { k: 'rdv', c: '1er rendez-vous', t: 'Premier rendez-vous : le projet, le quartier visé, le calendrier souhaité' },
      { k: 'local', c: 'Nouveau local', t: 'Le nouveau local : trouvé, visité, réservé sous réserve de l’accord de l’ARS' },
      { k: 'plans', c: 'Plans', t: 'Les plans du nouveau local, pour la demande' },
      { k: 'demande', c: 'Demande à l’ARS', t: 'Demande déposée à l’ARS' },
      { k: 'reponse', c: 'Réponse de l’ARS', t: 'Réponse de l’ARS : accord ou refus' },
      { k: 'contest', c: 'Contestation possible', t: 'Le temps pendant lequel l’accord peut encore être contesté (durée à confirmer par Yann)' },
      { k: 'agenc', c: 'Agencement', t: 'Agencement du nouveau local : plan, devis, bon pour accord' },
      { k: 'travaux', c: 'Travaux', t: 'Travaux' },
      { k: 'demenage', c: 'Ouverture', t: 'Déménagement et ouverture au public' }] },
    agencement: { nom: 'Agencement', etapes: [
      { k: 'rdv', c: '1er rendez-vous', t: 'Premier rendez-vous : les besoins du pharmacien (cahier des besoins)' },
      { k: 'releve', c: 'Relevé', t: 'Relevé : mesures, photos « avant », plan existant' },
      { k: 'ambiance', c: 'Ambiance', t: 'Inspirations et ambiance choisies avec le pharmacien' },
      { k: 'plan3d', c: 'Plan et 3D', t: 'Plan et 3D présentés' },
      { k: 'devis', c: 'Devis', t: 'Devis envoyé' },
      { k: 'bon', c: 'Bon pour accord', t: 'Bon pour accord signé' },
      { k: 'mobilier', c: 'Mobilier', t: 'Commande et fabrication du mobilier' },
      { k: 'travaux', c: 'Travaux', t: 'Travaux (le chantier, ses artisans, ses dates)' },
      { k: 'reception', c: 'Réception', t: 'Réception des travaux' }] },
    riedl: { nom: 'Robotique Riedl', etapes: [
      { k: 'rdv', c: '1er rendez-vous', t: 'Premier rendez-vous : le besoin, le robot actuel s’il y en a un' },
      { k: 'visite', c: 'Visite technique', t: 'Visite technique : mesures de la réserve, accès pour la livraison, électricité' },
      { k: 'implant', c: 'Implantation', t: 'Implantation : où va le robot, quel modèle' },
      { k: 'offre', c: 'Offre', t: 'Offre et financement envoyés (achat ou location)' },
      { k: 'bon', c: 'Bon de commande', t: 'Bon de commande signé' },
      { k: 'prepa', c: 'Préparation', t: 'Préparation sur place : place libérée, prises, réseau, lien avec le logiciel de la pharmacie' },
      { k: 'demontage', c: 'Démontage', t: 'Démontage de l’ancien robot', facultative: true },
      { k: 'livraison', c: 'Livraison', t: 'Livraison et montage' },
      { k: 'service', c: 'Mise en service', t: 'Mise en service et formation de l’équipe' },
      { k: 'suivi', c: 'Suivi', t: 'Suivi : premier bilan, contrat d’entretien' }] },
    pda: { nom: 'Robotique PDA', etapes: [
      { k: 'rdv', c: '1er rendez-vous', t: 'Premier rendez-vous : les EHPAD servis (ou patients à domicile), le nombre de résidents' },
      { k: 'etude', c: 'Étude', t: 'Étude : le volume à préparer, le choix de la machine (et d’une déblistéreuse si besoin)' },
      { k: 'offre', c: 'Offre', t: 'Offre et financement envoyés' },
      { k: 'bon', c: 'Bon de commande', t: 'Bon de commande signé' },
      { k: 'prepa', c: 'Préparation', t: 'Préparation : le local de préparation, le logiciel relié à celui de la pharmacie' },
      { k: 'install', c: 'Installation', t: 'Livraison et installation' },
      { k: 'formation', c: 'Formation', t: 'Formation de l’équipe et premiers essais (double contrôle)' },
      { k: 'demarrage', c: 'Démarrage', t: 'Démarrage avec le premier EHPAD' },
      { k: 'suivi', c: 'Suivi', t: 'Suivi : premier bilan, entretien' }] }
  };

  var MAX_FICHIER = 25 * 1024 * 1024;
  var MAX_DOCS = 40;

  /* ── dates (AAAA-MM-JJ ; « aujourd'hui » à l'heure de Paris, ce fichier marche seul en node) ── */
  var MC = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var ML = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var JS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function estJour(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(ms(s)); }
  function ms(iso) { return Date.parse(String(iso).slice(0, 10) + 'T12:00:00Z'); }
  function jourDe(d) {
    var p = {};
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  function aujourdhui(d) { return jourDe(d); }
  /* « maintenant » à l'heure de Paris : AAAA-MM-JJTHH:MM (même forme que le début d'un rendez-vous) */
  function maintenant(d) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  }
  /* Le jour (heure de Paris) d'un horodatage de la base (« 2026-07-02T23:30:00+00:00 » est le 3 juillet à Paris). */
  function jourDeHorodatage(ts) {
    if (!ts) return '';
    var s = String(ts), t = Date.parse(s);
    if (isNaN(t)) return estJour(s.slice(0, 10)) ? s.slice(0, 10) : '';
    return jourDe(new Date(t));
  }
  function joursEntre(de, a) { return Math.round((ms(a) - ms(de)) / 864e5); }
  function parties(s) { return String(s).slice(0, 10).split('-'); }
  function court(s) { if (!estJour(String(s).slice(0, 10))) return ''; var p = parties(s); return (+p[2] === 1 ? '1er' : +p[2]) + ' ' + MC[+p[1] - 1] + ' ' + p[0]; }
  function long(s) { if (!estJour(String(s).slice(0, 10))) return ''; var p = parties(s); return (+p[2] === 1 ? '1er' : +p[2]) + ' ' + ML[+p[1] - 1] + ' ' + p[0]; }
  function jourLong(s) { if (!estJour(String(s).slice(0, 10))) return ''; return JS[new Date(ms(s)).getUTCDay()] + ' ' + long(s); }
  function heureFr(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm)); if (!m) return '';
    return m[2] === '00' ? Number(m[1]) + ' h' : Number(m[1]) + ' h ' + m[2];
  }
  function maj1(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  function pl(n, un, plus) { return n + ' ' + (n > 1 ? plus : un); }

  /* ── les étapes d'un volet ── */
  function remplacementDe(details) { var r = details && details.remplacement; return typeof r === 'string' ? r.trim() : ''; }
  function etapesDe(sorte, details) {
    var S = SORTES[sorte]; if (!S) return [];
    var avec = !!remplacementDe(details);
    return S.etapes.filter(function (e) { return !e.facultative || avec; });
  }
  /* Un volet vivant : ses étapes (démontage seulement s'il y a un remplacement) fusionnées avec les lignes `dossier_etapes` déjà touchées.
     Une étape sans ligne = rien de prévu, rien de fait. Une ligne dont la clé n'est pas une étape du volet est ignorée. */
  function monterVolet(volet, lignes) {
    var par = {};
    (lignes || []).forEach(function (l) { if (l && (volet.id == null || l.volet_id == null || l.volet_id === volet.id)) par[l.cle] = l; });
    var details = volet.details && typeof volet.details === 'object' && !Array.isArray(volet.details) ? volet.details : {};
    var etapes = etapesDe(volet.sorte, details).map(function (e, i) {
      var l = par[e.k] || {};
      return {
        k: e.k, n: i + 1, t: e.t, c: e.c, facultative: !!e.facultative,
        prevue: estJour(String(l.prevue || '').slice(0, 10)) ? String(l.prevue).slice(0, 10) : null,
        faite: estJour(String(l.faite || '').slice(0, 10)) ? String(l.faite).slice(0, 10) : null,
        notes: typeof l.notes === 'string' ? l.notes : '',
        docs: Array.isArray(l.docs) ? l.docs : []
      };
    });
    return {
      id: volet.id, dossier_id: volet.dossier_id, sorte: volet.sorte, nom: SORTES[volet.sorte] ? SORTES[volet.sorte].nom : volet.sorte,
      etat: volet.etat || 'cours', raison: volet.raison || '', depuis: volet.depuis ? String(volet.depuis).slice(0, 10) : '',
      ouvert: jourDeHorodatage(volet.created_at), details: details, etapes: etapes
    };
  }
  /* Les pharmacies : chaque dossier avec ses volets montés, dans l'ordre des sortes. */
  function pharmacies(dossiers, volets, lignes) {
    return (dossiers || []).map(function (d) {
      var vs = (volets || []).filter(function (v) { return v.dossier_id === d.id && SORTES[v.sorte]; })
        .sort(function (a, b) { return ORDRE.indexOf(a.sorte) - ORDRE.indexOf(b.sorte); })
        .map(function (v) { return monterVolet(v, (lignes || []).filter(function (l) { return l.volet_id === v.id; })); });
      return { dossier: d, volets: vs };
    });
  }
  function nbFaites(v) { return v.etapes.filter(function (e) { return e.faite; }).length; }
  function prochaineEtape(v) { for (var i = 0; i < v.etapes.length; i++) if (!v.etapes[i].faite) return v.etapes[i]; return null; }
  function retard(e, auj) {
    if (!e || e.faite || !e.prevue) return 0;
    return Math.max(0, joursEntre(e.prevue, auj || aujourdhui()));
  }
  /* terminé = calculé : toutes les étapes faites et état « cours » */
  function estTermine(v) { return v.etat === 'cours' && v.etapes.length > 0 && nbFaites(v) === v.etapes.length; }
  function termineLe(v) {
    var m = ''; v.etapes.forEach(function (e) { if (e.faite && e.faite > m) m = e.faite; });
    return m;
  }
  /* cours | retard | pause | perdu | termine */
  function etatAffiche(v, auj) {
    if (v.etat === 'perdu') return 'perdu';
    if (v.etat === 'pause') return 'pause';
    if (estTermine(v)) return 'termine';
    return retard(prochaineEtape(v), auj) > 0 ? 'retard' : 'cours';
  }
  function actif(v) { return v.etat === 'cours' && !estTermine(v); }

  /* Le volet dont la prochaine chose presse le plus (règle de urgent() de la maquette) : ni perdu ni terminé ; une étape sans date passe
     après toute date ; un volet en pause passe après tous les autres. */
  function urgent(volets, auj) {
    var best = null, bs = 1e9;
    auj = auj || aujourdhui();
    (volets || []).forEach(function (v) {
      if (v.etat === 'perdu' || estTermine(v)) return;
      var e = prochaineEtape(v); if (!e) return;
      var s = e.prevue ? -joursEntre(e.prevue, auj) : 4000;
      if (v.etat === 'pause') s += 5000;
      if (s < bs) { bs = s; best = { volet: v, etape: e }; }
    });
    return best;
  }
  function enRetard(volets, auj) {
    return (volets || []).some(function (v) { return actif(v) && retard(prochaineEtape(v), auj) > 0; });
  }
  /* Les groupes de la liste (règle de groupes2() de la maquette). Un dossier SANS volet est « à démarrer » : l'ancienne version en a un. */
  function groupes(phs, auj) {
    var g = { av: [], dem: [], fin: [], att: [] };
    (phs || []).forEach(function (ph) {
      var vs = ph.volets, a = vs.filter(actif);
      if (!vs.length) g.dem.push(ph);
      else if (!a.length) { if (vs.every(estTermine)) g.fin.push(ph); else g.att.push(ph); }
      else if (a.some(function (v) { return nbFaites(v) > 0; })) g.av.push(ph);
      else g.dem.push(ph);
    });
    ['av', 'dem', 'fin', 'att'].forEach(function (k) { g[k] = trierCartes(g[k], auj); });
    return g;
  }
  /* Tri des cartes : en retard d'abord, puis la date de la prochaine chose (sans date : à la fin), puis le nom. */
  function trierCartes(phs, auj) {
    function cle(ph) {
      var u = urgent(ph.volets, auj);
      return { r: enRetard(ph.volets, auj) ? 0 : 1, d: u && u.etape.prevue ? u.etape.prevue : '9999-99-99', n: String(ph.dossier.nom || '') };
    }
    return (phs || []).map(function (ph) { return { ph: ph, k: cle(ph) }; }).sort(function (a, b) {
      return a.k.r - b.k.r || (a.k.d < b.k.d ? -1 : a.k.d > b.k.d ? 1 : 0) || a.k.n.localeCompare(b.k.n, 'fr', { sensitivity: 'base' });
    }).map(function (x) { return x.ph; });
  }
  /* « 3 pharmacies, 5 volets : 2 avancent, 1 à démarrer, … » */
  function phraseCompte(g, nbPharmacies, nbVolets) {
    if (!nbPharmacies) return '';
    var n = { av: g.av.length, dem: g.dem.length, fin: g.fin.length, att: g.att.length };
    var parts = [
      n.av === 0 ? 'aucune n’avance' : n.av === 1 ? '1 avance' : n.av + ' avancent',
      n.dem ? n.dem + ' à démarrer' : '',
      n.fin ? n.fin + (n.fin > 1 ? ' terminées' : ' terminée') : '',
      n.att ? n.att + (n.att > 1 ? ' en pause ou perdues' : ' en pause ou perdue') : ''
    ].filter(Boolean);
    var vol = nbVolets ? pl(nbPharmacies, 'pharmacie', 'pharmacies') + ', ' + pl(nbVolets, 'volet', 'volets') : pl(nbPharmacies, 'pharmacie', 'pharmacies') + ', aucun volet';
    return vol + ' : ' + parts.join(', ') + '.';
  }
  /* La pastille d'une carte de pharmacie */
  function statutPharmacie(volets, auj) {
    if (!volets.length) return { ton: '', texte: 'À démarrer' };
    if (enRetard(volets, auj)) return { ton: 'rouge', texte: 'En retard' };
    if (volets.some(actif)) return { ton: 'vert', texte: 'En cours' };
    if (volets.every(estTermine)) return { ton: 'vert', texte: 'Terminé' };
    return { ton: 'orange', texte: 'En pause ou perdu' };
  }
  /* La pastille d'un volet */
  function statutVolet(v, auj) {
    var e = etatAffiche(v, auj);
    return { pause: { ton: 'orange', texte: 'En pause' }, perdu: { ton: 'rouge', texte: 'Perdu' }, termine: { ton: 'vert', texte: 'Terminé' },
      retard: { ton: 'rouge', texte: 'En retard' }, cours: { ton: 'vert', texte: 'En cours' } }[e];
  }
  function suffixeVolet(v) { return v.etat === 'pause' ? ' · en pause' : v.etat === 'perdu' ? ' · perdu' : estTermine(v) ? ' · terminé' : ''; }
  /* La ligne de date sous une étape : { texte, retard } */
  function ligneDate(e, auj) {
    if (!e || !e.prevue) return { texte: 'Date à fixer', retard: false };
    var r = retard(e, auj);
    return r > 0 ? { texte: 'En retard de ' + pl(r, 'jour', 'jours') + ' · prévue le ' + court(e.prevue), retard: true }
      : { texte: 'Prévue le ' + court(e.prevue), retard: false };
  }
  /* Les détails d'un volet, en lignes de segments { t, b } (b = en gras) */
  function detailsVolet(v) {
    var d = v.details || [], l = [];
    if (v.sorte === 'transfert' && typeof d.regroupement === 'string' && d.regroupement.trim()) {
      var vi = typeof d.regroupementVille === 'string' ? d.regroupementVille.trim() : '';
      l.push({ cle: 'regroupement', segs: [{ t: 'Regroupement avec ' }, { t: d.regroupement.trim() + (vi ? ' (' + vi + ')' : ''), b: true }] });
    }
    if (v.sorte === 'pda') {
      var s = [];
      if (Number.isInteger(d.ehpad)) s.push({ t: d.ehpad + ' EHPAD', b: true });
      if (Number.isInteger(d.residents)) { if (s.length) s.push({ t: ' · ' }); s.push({ t: d.residents + ' résidents', b: true }); }
      if (s.length) l.push({ cle: 'pda', segs: s });
    }
    if (v.sorte === 'riedl' && remplacementDe(d)) l.push({ cle: 'remplacement', segs: [{ t: 'Remplacement d’un robot : ' }, { t: remplacementDe(d), b: true }] });
    return l;
  }
  function texteSegs(segs) { return segs.map(function (s) { return s.t; }).join(''); }
  /* La carte sans « prochaine chose » : les raisons des volets en pause ou perdus */
  function texteSansProchaine(volets) {
    return (volets || []).filter(function (v) { return v.raison; }).map(function (v) { return v.nom + ' : ' + v.raison; }).join(' ');
  }

  /* ── nom de fichier, chemin, taille ── */
  function nomFichierPropre(nom) {
    var s = String(nom == null ? '' : nom).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    var i = s.lastIndexOf('.'), base = i > 0 ? s.slice(0, i) : s, ext = i > 0 ? s.slice(i + 1).replace(/[^a-z0-9]/g, '').slice(0, 10) : '';
    base = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!base) base = 'document';
    var max = 80 - (ext ? ext.length + 1 : 0);
    base = base.slice(0, max).replace(/-+$/g, '') || 'document'.slice(0, max);
    return ext ? base + '.' + ext : base;
  }
  function cheminDocument(userId, dossierId, sorte, cle, nom, horodatage) {
    return userId + '/' + dossierId + '/etapes/' + sorte + '/' + cle + '/' + horodatage + '-' + nomFichierPropre(nom);
  }
  /* Un numéro français à 10 chiffres s'écrit par paires (« 02 61 91 24 07 ») ; tout autre numéro reste tel quel. */
  function telLisible(t) { var n = String(t == null ? '' : t).replace(/\D/g, ''); return n.length === 10 ? n.replace(/(\d{2})(?=\d)/g, '$1 ') : String(t == null ? '' : t).trim(); }
  /* Le geste de la ligne de détails d'un volet : « Modifier » quand il y a déjà un détail, sinon ce que le geste ajoute. Agencement : aucun détail. */
  function gesteDetails(sorte, details) {
    var d = details || {};
    if (sorte === 'transfert') return String(d.regroupement || '').trim() ? 'Modifier le regroupement' : 'Ajouter un regroupement';
    if (sorte === 'riedl') return String(d.remplacement || '').trim() ? 'Modifier' : 'Indiquer un remplacement de robot';
    if (sorte === 'pda') return (d.ehpad != null && d.ehpad !== '') || (d.residents != null && d.residents !== '') ? 'Modifier' : 'Préciser les EHPAD servis';
    return '';
  }
  function tailleLisible(o) {
    o = Number(o) || 0;
    if (o < 1024) return o + ' o';
    if (o < 1024 * 1024) return Math.round(o / 1024) + ' Ko';
    return (Math.round(o / 1024 / 1024 * 10) / 10).toString().replace('.', ',') + ' Mo';
  }
  /* '' si le fichier peut partir, sinon la phrase à dire AVANT l'envoi */
  function verifierFichier(f, nbDocs) {
    if (!f || !f.size) return 'Ce fichier est vide : choisissez-en un autre.';
    if (f.size > MAX_FICHIER) return 'Ce fichier fait ' + tailleLisible(f.size) + ' : le maximum est de 25 Mo par fichier.';
    if ((nbDocs || 0) >= MAX_DOCS) return 'Cette étape accepte ' + MAX_DOCS + ' documents au plus.';
    return '';
  }
  function nouveauDoc(nom, chemin, taille, ajoute) { return { nom: String(nom), chemin: chemin, taille: taille, ajoute: ajoute }; }

  /* ── contrôles des champs : { ok, valeur, erreur } ── */
  function texteCourt(v, requis, libelle) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return requis ? { ok: false, valeur: '', erreur: (libelle || 'Ce champ') + ' est obligatoire.' } : { ok: true, valeur: '' };
    if (t.length > 200) return { ok: false, valeur: t, erreur: (libelle || 'Ce texte') + ' est trop long : 200 caractères au plus.' };
    return { ok: true, valeur: t };
  }
  function verifierRaison(v) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return { ok: false, valeur: '', erreur: 'Dites en quelques mots pourquoi : la raison est obligatoire.' };
    if (t.length > 500) return { ok: false, valeur: t, erreur: 'La raison est trop longue : 500 caractères au plus.' };
    return { ok: true, valeur: t };
  }
  function verifierEntier(v, libelle) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return { ok: true, valeur: null };
    if (!/^\d{1,9}$/.test(t)) return { ok: false, valeur: null, erreur: (libelle || 'Ce nombre') + ' : indiquez un nombre entier, zéro ou plus.' };
    return { ok: true, valeur: Number(t) };
  }
  function verifierNotes(v) {
    var t = String(v == null ? '' : v);
    return t.length > 8000 ? { ok: false, valeur: t, erreur: 'La note est trop longue : 8 000 caractères au plus.' } : { ok: true, valeur: t };
  }
  /* Les détails d'un volet, saisis dans le formulaire : Riedl { remplacement: 'marque' } si « remplacement » est coché, Transfert { regroupement,
     regroupementVille } (facultatif), PDA { ehpad, residents } (facultatif). `saisie` = { remplace, remplacement, regroupement, regroupementVille, ehpad, residents }. */
  function verifierDetails(sorte, saisie) {
    saisie = saisie || {};
    if (sorte === 'riedl') {
      if (!saisie.remplace) return { ok: true, details: {} };
      var m = texteCourt(saisie.remplacement, true, 'La marque du robot à remplacer');
      return m.ok ? { ok: true, details: { remplacement: m.valeur } } : { ok: false, erreur: m.erreur };
    }
    if (sorte === 'transfert') {
      var r = texteCourt(saisie.regroupement, false, 'Le nom de la seconde officine'), vi = texteCourt(saisie.regroupementVille, false, 'La ville de la seconde officine');
      if (!r.ok) return { ok: false, erreur: r.erreur };
      if (!vi.ok) return { ok: false, erreur: vi.erreur };
      if (!r.valeur) return { ok: true, details: {} };
      var o = { regroupement: r.valeur }; if (vi.valeur) o.regroupementVille = vi.valeur;
      return { ok: true, details: o };
    }
    if (sorte === 'pda') {
      var e = verifierEntier(saisie.ehpad, 'Le nombre d’EHPAD'), re = verifierEntier(saisie.residents, 'Le nombre de résidents');
      if (!e.ok) return { ok: false, erreur: e.erreur };
      if (!re.ok) return { ok: false, erreur: re.erreur };
      var p = {}; if (e.valeur != null) p.ehpad = e.valeur; if (re.valeur != null) p.residents = re.valeur;
      return { ok: true, details: p };
    }
    return { ok: SORTES[sorte] ? true : false, details: {}, erreur: SORTES[sorte] ? undefined : 'Cette sorte de projet n’existe pas.' };
  }
  /* « Une pharmacie hors de vos pistes » : nom obligatoire, ville et titulaire facultatifs */
  function verifierPharmacie(saisie) {
    saisie = saisie || {};
    var n = texteCourt(saisie.nom, true, 'Le nom de la pharmacie'), v = texteCourt(saisie.ville, false, 'La ville'), t = texteCourt(saisie.titulaire, false, 'Le nom du titulaire');
    var m = [n, v, t].filter(function (x) { return !x.ok; })[0];
    if (m) return { ok: false, erreur: m.erreur };
    return { ok: true, valeur: { nom: n.valeur, ville: v.valeur || null, titulaire: t.valeur || null } };
  }
  /* Ce que le dossier prend d'une piste */
  function pharmacieDePiste(p) {
    return { nom: String(p.nom || '').trim(), ville: p.ville ? String(p.ville).trim() : null, titulaire: p.pharmacien ? String(p.pharmacien).trim() : null };
  }

  /* ── pistes ── */
  function norm(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  /* Les pistes qui peuvent devenir un dossier : sans dossier, non archivées, filtrées par nom ou ville, par ordre alphabétique. */
  function pistesSansDossier(pistes, recherche) {
    var q = norm(recherche);
    return (pistes || []).filter(function (p) {
      if (p.dossier_id || p.stage === 'archive') return false;
      return !q || norm(p.nom).indexOf(q) >= 0 || norm(p.ville).indexOf(q) >= 0;
    }).sort(function (a, b) { return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' }); });
  }
  /* Le prochain rendez-vous (non annulé, début à venir) d'une piste. maintenant = AAAA-MM-JJTHH:MM, heure de Paris. */
  function prochainRdv(rdvs, prospectId, maintenant) {
    var best = null;
    (rdvs || []).forEach(function (r) {
      if (!r || r.prospect_id !== prospectId || r.statut === 'annule' || !r.debut || String(r.debut) < String(maintenant)) return;
      if (!best || String(r.debut) < String(best.debut)) best = r;
    });
    return best;
  }
  function quandRdv(r) {
    var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String((r && r.debut) || '')); if (!m) return '';
    return maj1(jourLong(m[1])) + ' à ' + heureFr(m[2]);
  }
  /* « Ouvrir la 3D » : l'adresse du réglage + l'identifiant du dossier (le même dans l'ancienne version) */
  function adresse3D(base, dossierId) {
    var b = String(base || '').replace(/\/+$/, '');
    return b && dossierId ? b + '/' + dossierId : '';
  }
  /* Les sortes qu'on peut encore ajouter à un dossier */
  function sortesAbsentes(volets) {
    var ont = (volets || []).map(function (v) { return v.sorte; });
    return ORDRE.filter(function (s) { return ont.indexOf(s) < 0; });
  }

  return {
    SORTES: SORTES, ORDRE: ORDRE, MAX_FICHIER: MAX_FICHIER, MAX_DOCS: MAX_DOCS,
    aujourdhui: aujourdhui, maintenant: maintenant, jourDeHorodatage: jourDeHorodatage, joursEntre: joursEntre, estJour: estJour, court: court, long: long, jourLong: jourLong, heureFr: heureFr, pl: pl, maj1: maj1,
    remplacementDe: remplacementDe, etapesDe: etapesDe, monterVolet: monterVolet, pharmacies: pharmacies,
    nbFaites: nbFaites, prochaineEtape: prochaineEtape, retard: retard, estTermine: estTermine, termineLe: termineLe, etatAffiche: etatAffiche, actif: actif,
    urgent: urgent, enRetard: enRetard, groupes: groupes, trierCartes: trierCartes, phraseCompte: phraseCompte, statutPharmacie: statutPharmacie, statutVolet: statutVolet,
    suffixeVolet: suffixeVolet, ligneDate: ligneDate, detailsVolet: detailsVolet, texteSegs: texteSegs, texteSansProchaine: texteSansProchaine,
    nomFichierPropre: nomFichierPropre, cheminDocument: cheminDocument, tailleLisible: tailleLisible, telLisible: telLisible, gesteDetails: gesteDetails, verifierFichier: verifierFichier, nouveauDoc: nouveauDoc,
    verifierRaison: verifierRaison, verifierEntier: verifierEntier, verifierNotes: verifierNotes, verifierDetails: verifierDetails, verifierPharmacie: verifierPharmacie, texteCourt: texteCourt,
    pharmacieDePiste: pharmacieDePiste, norm: norm, pistesSansDossier: pistesSansDossier, prochainRdv: prochainRdv, quandRdv: quandRdv, adresse3D: adresse3D, sortesAbsentes: sortesAbsentes
  };
});
