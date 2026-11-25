/* PHIRST · logique PURE de l'écran « Vitrine » de Yann (24/11/2026) : aucune lecture de la page ni de la base, donc testable
   (tests/phirst-vitrine.test.mjs). L'écran (phirst-vitrine.js) ne fait que les lectures, l'affichage et les écritures.
   Il lit les demandes reçues par les pages (vitrine_demandes), les range, choisit la piste où les mettre (par dossier, par nom et ville,
   sinon une piste neuve), prépare la note, le lien à copier et l'état de chaque page ; et il fait le va-et-vient entre la feuille de saisie
   et la forme des notes de Yann (phirst-lettre-contenu.js : normaliser / verifier). Les dates sont dites à l'heure de Paris. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique(require('./phirst-pur.js'), require('./phirst-lettre-contenu.js'));
  else racine.PHIRST_VITRINE_PUR = fabrique(racine.PHIRST_PUR, racine.PHIRST_LETTRE);
})(typeof window !== 'undefined' ? window : this, function (P, L) {
  'use strict';

  var NB_VU = L.MAX.vu, NB_PROPOSE = L.MAX.propose, MAX_DEMANDES = 50;
  /* `source` de la piste créée : le champ est un texte libre (« annuaire », « transfert », « robot »… : supabase/crm-pipeline.sql, aucune contrainte). */
  var SOURCE_PISTE = 'vitrine';
  var ETAPE_PISTE = 'a_qualifier';

  function txt(v) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''; }

  /* ── les dates, à l'heure de Paris ── */
  function partiesParis(iso) {
    var t = Date.parse(iso); if (!isFinite(t)) return null;
    var p = {};
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    return { jour: p.year + '-' + p.month + '-' + p.day, h: +p.hour, m: +p.minute, annee: +p.year };
  }
  /* « mardi 24 novembre » (l'année n'est dite que si ce n'est pas celle de `maintenant`). '' si la date est illisible. */
  function jourParis(iso, maintenant) {
    var p = partiesParis(iso); if (!p) return '';
    var ref = partiesParis(new Date(maintenant == null ? Date.now() : maintenant).toISOString());
    return L.jourLisible(p.jour, ref ? ref.annee : null);
  }
  /* « mardi 24 novembre à 18 h 40 ». */
  function quandParis(iso, maintenant) {
    var p = partiesParis(iso); if (!p) return '';
    return jourParis(iso, maintenant) + ' à ' + p.h + ' h' + (p.m ? ' ' + (p.m < 10 ? '0' : '') + p.m : '');
  }

  /* ── les demandes ── */
  /* Non traitées d'abord ; dans chaque groupe, la plus récente en premier ; 50 au plus (les non traitées passent avant, donc ne sont jamais écartées pour de plus anciennes). */
  function trierDemandes(liste) {
    var l = (Array.isArray(liste) ? liste : []).filter(function (d) { return d && d.id; });
    function t(d) { var v = Date.parse(d.created_at); return isFinite(v) ? v : 0; }
    l = l.map(function (d, i) { return { d: d, i: i }; });
    l.sort(function (a, b) {
      var ta = a.d.traitee_le ? 1 : 0, tb = b.d.traitee_le ? 1 : 0;
      if (ta !== tb) return ta - tb;
      return t(b.d) - t(a.d) || a.i - b.i;
    });
    return l.map(function (x) { return x.d; }).slice(0, MAX_DEMANDES);
  }
  /* Deux lectures (les 50 dernières ; toutes les non traitées) qui se recoupent : une demande ne compte qu'une fois. */
  function fusionner(a, b) {
    var vu = {}, r = [];
    (a || []).concat(b || []).forEach(function (d) { if (d && d.id && !vu[d.id]) { vu[d.id] = 1; r.push(d); } });
    return r;
  }
  function origineLibelle(o) { return o === 'lettre' ? 'par sa page' : o === 'expertise' ? 'par l’ancienne vitrine' : ''; }
  /* Le numéro tel que le pharmacien l'a tapé, mis en groupes de deux s'il est français ; sinon tel quel. */
  function telAffiche(t) {
    var s = txt(t), c = s.replace(/[^\d+]/g, '');
    if (/^0\d{9}$/.test(c)) return c.replace(/(\d{2})(?=\d)/g, '$1 ');
    if (/^\+33\d{9}$/.test(c)) return '+33 ' + c.slice(3, 4) + ' ' + c.slice(4).replace(/(\d{2})(?=\d)/g, '$1 ');
    return s;
  }
  function lienTel(t) { var c = txt(t).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, ''); return c ? 'tel:' + c : ''; }
  /* « Pharmacie des Tilleuls · Angers » */
  function titreDemande(d) { return [txt(d && d.pharmacie), txt(d && d.ville)].filter(Boolean).join('\u00A0· ') || 'Pharmacie non précisée'; }
  function phraseCompte(liste) {
    var n = (liste || []).filter(function (d) { return !d.traitee_le; }).length;
    if (!n) return 'Rien à rappeler pour l’instant.';
    return n === 1 ? 'Une demande à rappeler.' : n + ' demandes à rappeler.';
  }

  /* ── la piste où mettre une demande ── */
  /* 1) la piste liée au même dossier ; 2) la piste de même nom et même ville (accents et majuscules ignorés) ; 3) une piste neuve.
     Une piste archivée ne passe qu'après les pistes vivantes ; si elle est seule, on la rend marquée `archivee` (l'écran le dit :
     la demande est notée sur elle, mais elle n'est pas dans les Appels tant qu'on ne la rouvre pas). */
  function choisirPiste(demande, pistes) {
    var d = demande || {}, l = (Array.isArray(pistes) ? pistes : []).filter(function (p) { return p && p.id; });
    function meilleure(c) { var v = c.filter(function (p) { return p.stage !== 'archive'; })[0]; return v || c[0] || null; }
    function rendre(mode, p) { return p ? { mode: mode, piste: p, archivee: p.stage === 'archive' } : null; }
    if (d.dossier_id) { var a = rendre('dossier', meilleure(l.filter(function (p) { return p.dossier_id === d.dossier_id; }))); if (a) return a; }
    var nom = txt(d.pharmacie);
    if (nom) { var k = P.cle(nom, d.ville); var b = rendre('nom', meilleure(l.filter(function (p) { return P.cle(p.nom, p.ville) === k; }))); if (b) return b; }
    return { mode: 'nouvelle', piste: null, archivee: false };
  }
  /* La piste neuve : les champs écrits dans crm_prospects. dossier_id seulement si la demande en a un. */
  function nouvellePiste(demande, workspaceId) {
    var d = demande || {}, nom = txt(d.pharmacie) || 'Demande de la vitrine';
    var p = { workspace_id: workspaceId, nom: nom.slice(0, 120), ville: txt(d.ville) || null, telephone: txt(d.tel) || null, pharmacien: txt(d.nom) || null,
      stage: ETAPE_PISTE, source: SOURCE_PISTE };
    if (d.dossier_id) p.dossier_id = d.dossier_id;
    return p;
  }
  /* La note du journal : « Demande reçue par la page : <motif> — <nom> — <tel> — <mot> » (les morceaux vides sont sautés). */
  function corpsNote(d) {
    d = d || {};
    var debut = d.origine === 'expertise' ? 'Demande reçue par l’ancienne vitrine' : 'Demande reçue par la page';
    var m = [txt(d.motif), txt(d.nom), txt(d.tel), txt(d.mot)].filter(Boolean);
    return (debut + (m.length ? ' : ' + m.join(' — ') : '')).slice(0, 2400);
  }
  /* Ce que l'écran dit quand tout a marché. */
  function phraseSucces(choix) {
    return choix && choix.archivee ? 'Notée sur sa piste, qui est archivée : rouvrez-la depuis « Mes pistes » dans les Appels pour la rappeler.'
      : 'Ajoutée à vos pistes : elle est dans vos Appels.';
  }
  var ETAPES_AJOUT = { pistes: 'retrouver vos pistes', piste: 'créer la piste', note: 'écrire la note dans la piste', traitee: 'marquer la demande comme traitée' };
  /* Une étape a raté : on dit laquelle, et ce qui est déjà fait. Jamais « réussi », jamais la demande marquée traitée. */
  function phraseErreur(etape, fait) {
    var q = ETAPES_AJOUT[etape] || ETAPES_AJOUT.traitee;
    if (etape === 'traitee' && fait) return 'La piste et la note sont faites, mais la demande n’a pas pu être marquée comme traitée : appuyez de nouveau sur le bouton, rien ne sera écrit en double.';
    if (etape === 'note' && fait) return 'La piste est créée, mais la note n’a pas pu s’écrire : appuyez de nouveau sur le bouton, la piste ne sera pas créée une deuxième fois.';
    return 'Pas ajoutée : impossible de ' + q + '. Réessayez dans un instant ; la demande reste à traiter.';
  }

  /* ── le lien de la page ── */
  /* Le lien à envoyer : l'adresse du réglage de la marque + « # » + le jeton (le jeton reste dans le « # » : il n'est jamais envoyé à un serveur). '' si l'un manque. */
  function lienCopie(adresse, jeton) {
    var a = txt(adresse), j = txt(jeton);
    if (!a || !j || !/^[A-Za-z0-9_-]{24,64}$/.test(j)) return '';
    return a.replace(/#.*$/, '') + '#' + j;
  }
  function lienVoir(jeton) { var j = txt(jeton); return /^[A-Za-z0-9_-]{24,64}$/.test(j) ? 'lettre/#' + j : ''; }
  /* L'état d'une page : pas de lettre, lien actif, lien coupé. */
  function etatLettre(lettre) {
    if (!lettre) return { id: 'aucune', texte: 'Pas encore préparée', ton: '', action: 'Préparer la page' };
    if (lettre.ouverte === false) return { id: 'coupe', texte: 'Lien coupé', ton: 'orange', action: 'Modifier la page' };
    return { id: 'actif', texte: 'Lien actif', ton: 'vert', action: 'Modifier la page' };
  }
  /* Ce que change couper / rouvrir, dit au pharmacien : à lire AVANT de confirmer. */
  function phraseBascule(lettre) {
    return lettre && lettre.ouverte === false
      ? 'Le même lien refonctionne : le pharmacien revoit sa page, avec vos dernières notes.'
      : 'Le pharmacien qui ouvre le lien ne voit plus sa page. Vous pouvez la rouvrir quand vous voulez : le lien reste le même.';
  }
  /* Les messages de `verifier` commencent par le nom du champ en minuscule (« constat 1 : … ») : affichés avec une majuscule. */
  function majuscule(m) { m = String(m == null ? '' : m); return m.charAt(0).toUpperCase() + m.slice(1); }
  function majLettre(lettre) { return lettre && lettre.updated_at ? jourParis(lettre.updated_at) : ''; }

  /* ── la feuille « La page de <pharmacie> » ── */
  /* La date faite de l'étape « 1er rendez-vous » (cle 'rdv') d'un dossier : la plus ancienne si plusieurs volets l'ont faite. '' sinon. */
  function rdvFait(volets, etapes, dossierId) {
    var ids = {}; (volets || []).forEach(function (v) { if (v && v.dossier_id === dossierId) ids[v.id] = 1; });
    var m = '';
    (etapes || []).forEach(function (e) {
      var f = e && e.faite ? String(e.faite).slice(0, 10) : '';
      if (e && e.cle === 'rdv' && ids[e.volet_id] && L.estJour(f) && (!m || f < m)) m = f;
    });
    return m;
  }
  /* Le contenu enregistré → les valeurs de la feuille : 4 lignes de constats, 5 d'idées (les vides gardent leur place). */
  function valeursFeuille(contenu, rdv) {
    var c = L.normaliser(contenu);
    function lignes(l, n) { var r = []; for (var i = 0; i < n; i++) r.push(l[i] ? { zone: l[i].zone, t: l[i].t, d: l[i].d } : { zone: '', t: '', d: '' }); return r; }
    return { rdv: c.rdv || (L.estJour(rdv) ? rdv : ''), mot: c.mot, vu: lignes(c.vu, NB_VU), propose: lignes(c.propose, NB_PROPOSE), surfaces: c.surfaces, postes: c.postes, entree: c.entree, suite: c.suite };
  }
  function enTexte(n) { return n == null ? '' : String(n); }
  /* Les valeurs → une table plate { 'mot': …, 'vu.0.t': …, 'surfaces.demain': … } : les noms des champs de la feuille sont ceux de `verifier`. */
  function aplatir(v) {
    var o = { rdv: v.rdv || '', mot: v.mot || '' };
    v.vu.forEach(function (x, i) { o['vu.' + i + '.zone'] = x.zone; o['vu.' + i + '.t'] = x.t; o['vu.' + i + '.d'] = x.d; });
    v.propose.forEach(function (x, i) { o['propose.' + i + '.zone'] = x.zone; o['propose.' + i + '.t'] = x.t; o['propose.' + i + '.d'] = x.d; });
    ['aujourdhui', 'demain'].forEach(function (k) {
      o['surfaces.' + k] = enTexte(v.surfaces[k]); o['postes.' + k] = enTexte(v.postes[k]); o['entree.' + k] = v.entree[k] || '';
    });
    o['suite.t'] = v.suite.t; o['suite.quand'] = v.suite.quand; o['suite.d'] = v.suite.d;
    return o;
  }
  /* La table plate lue dans la feuille → la saisie à donner à `verifier`. Les champs non remplis restent vides, rien n'est inventé. */
  function assembler(plat) {
    function g(n) { var v = plat && plat[n]; return v == null ? '' : String(v); }
    function lignes(nom, n) { var r = []; for (var i = 0; i < n; i++) r.push({ zone: g(nom + '.' + i + '.zone'), t: g(nom + '.' + i + '.t'), d: g(nom + '.' + i + '.d') }); return r; }
    return { rdv: g('rdv'), mot: g('mot'), vu: lignes('vu', NB_VU), propose: lignes('propose', NB_PROPOSE),
      surfaces: { aujourdhui: g('surfaces.aujourdhui'), demain: g('surfaces.demain') }, postes: { aujourdhui: g('postes.aujourdhui'), demain: g('postes.demain') },
      entree: { aujourdhui: g('entree.aujourdhui'), demain: g('entree.demain') }, suite: { t: g('suite.t'), quand: g('suite.quand'), d: g('suite.d') } };
  }
  /* Le compteur du mot : « 120 sur 400 » ; au-delà, dit de combien (le texte n'est JAMAIS coupé). */
  function compteur(texte, max) {
    var n = txt(texte).length;
    return n > max ? { n: n, trop: true, texte: n + ' sur ' + max + ' : ' + (n - max) + ' de trop' } : { n: n, trop: false, texte: n + ' sur ' + max };
  }

  return { NB_VU: NB_VU, NB_PROPOSE: NB_PROPOSE, MAX_DEMANDES: MAX_DEMANDES, SOURCE_PISTE: SOURCE_PISTE, ETAPE_PISTE: ETAPE_PISTE,
    jourParis: jourParis, quandParis: quandParis, trierDemandes: trierDemandes, fusionner: fusionner, origineLibelle: origineLibelle, telAffiche: telAffiche, lienTel: lienTel,
    titreDemande: titreDemande, phraseCompte: phraseCompte, choisirPiste: choisirPiste, nouvellePiste: nouvellePiste, corpsNote: corpsNote,
    phraseSucces: phraseSucces, phraseErreur: phraseErreur, lienCopie: lienCopie, lienVoir: lienVoir, etatLettre: etatLettre, phraseBascule: phraseBascule,
    majuscule: majuscule, majLettre: majLettre, rdvFait: rdvFait, valeursFeuille: valeursFeuille, aplatir: aplatir, assembler: assembler, compteur: compteur };
});
