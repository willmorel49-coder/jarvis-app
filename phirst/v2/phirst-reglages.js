/* PHIRST · écran « Réglages » (23/11/2026) : d'après la maquette V2 validée par Will le 23/11 telle quelle (M-reglages-maquette, d'après m1
   « Le tableau de bord » choisie le 29/10). Yann : le bandeau « N outils sur M en service », les 4 outils, le plafond du mois, son compte
   (mot de passe en panneau à droite, se déconnecter), « Détails techniques (pour Will) » replié. La téléprospectrice : son adresse,
   son mot de passe, se déconnecter, rien d'autre (aucune lecture de jobs ni de l'adresse d'état pour elle).
   Toute la logique est dans phirst-reglages-pur.js, testée (tests/phirst-reglages.test.mjs). Rien en dur : chaque état est LU ici,
   et une lecture qui échoue donne « état inconnu pour l'instant », jamais « hors service ». */
(function () {
  'use strict';
  var R = window.PHIRST_REGLAGES_PUR, P = window.PHIRST_PUR, V2 = window.V2, X = window.PHIRST_ECRAN;
  if (!R || !P || !V2 || !X) return;
  V2.pages = V2.pages || {};
  var esc = X.esc, DELAI = 10000;
  /* L'adresse d'état de l'ancienne version (images, vidéo, plafond) : lue dans le réglage de la marque (index.html). */
  var ADRESSE_ETAT = (window.V2_BRAND && window.V2_BRAND.ancienneEtat) || '';
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }

  var S = { racine: null, jeton: 0, telepro: false, roleConnu: false, lu: false, base: null, liste: null, etat: null, depense: null,
    techOuvert: false, flash: '', flashErr: false, tFlash: 0, occupe: false, depuis: null,
    ag: undefined, agForm: false, agDit: '', agErr: false, agOccupe: false };   // ag : undefined = pas lu, 'indispo' = table absente (section cachée), null = aucun lien, { … }

  function ico(n, t) {
    t = t || 20;
    var p = {
      dossier: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>', photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
      soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
      film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
      valide: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>', point: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
      question: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 014.8.9c0 1.7-2.4 2.2-2.4 3.8"/><path d="M12 17h.01"/>',
      cadenas: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', sortir: '<path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4M18 12H9"/>'
    }[n];
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function email() { return (V2.user && V2.user.email) || ''; }

  /* ── les lectures (Yann seulement) : chacune a sa limite de temps, et une lecture muette rend null (= inconnu) ── */
  function borne(p) {
    return new Promise(function (ok) {
      var t = setTimeout(function () { ok(null); }, DELAI);
      Promise.resolve(p).then(function (v) { clearTimeout(t); ok(v); }, function () { clearTimeout(t); ok(null); });
    });
  }
  function lireBase(b) { return b.from('dossiers').select('id').limit(1).then(function (r) { return !!(r && !r.error); }); }
  function lireDepense(b) {
    var debut = R.debutDuMois(), tout = [];
    function page(n) {
      return b.from('jobs').select('cost_cents,created_at').gte('created_at', debut).order('id').range(n * 1000, n * 1000 + 999).then(function (r) {
        if (!r || r.error) return null;
        tout = tout.concat(r.data || []);
        return (r.data || []).length === 1000 && n < 9 ? page(n + 1) : R.depenseDuMois(tout);
      });
    }
    return page(0);
  }
  function lireEtat(b) {
    if (!ADRESSE_ETAT || typeof fetch !== 'function') return Promise.resolve(null);
    return b.auth.getSession().then(function (r) {
      var jeton = r && r.data && r.data.session && r.data.session.access_token; if (!jeton) return null;
      var ac = typeof AbortController === 'function' ? new AbortController() : null, t = ac ? setTimeout(function () { ac.abort(); }, DELAI) : 0;
      return fetch(ADRESSE_ETAT, { headers: { Authorization: 'Bearer ' + jeton }, cache: 'no-store', credentials: 'omit', signal: ac ? ac.signal : undefined })
        .then(function (rep) { clearTimeout(t); return rep.ok ? rep.json() : null; })
        .then(function (j) { return j && typeof j === 'object' ? j : null; }, function () { clearTimeout(t); return null; });
    });
  }
  function lire() {
    var b = sb(), tok = S.jeton;
    S.lu = false; S.base = null; S.liste = null; S.etat = null; S.depense = null;
    if (!b) { S.lu = true; dessiner(); return; }
    var D = window.PHIRST_DONNEES;
    if (window.PHIRST_RG_TEXTES) window.PHIRST_RG_TEXTES.lire(b);   // les textes de Yann pour la téléprospectrice : leur propre lecture, leur propre zone
    Promise.all([borne(lireBase(b)), borne(D && D.ligne ? D.ligne() : null), borne(lireEtat(b)), borne(lireDepense(b))]).then(function (x) {
      if (tok !== S.jeton) return;
      S.base = x[0] === true; S.liste = x[1]; S.etat = x[2]; S.depense = typeof x[3] === 'number' ? x[3] : null; S.lu = true;
      dessiner();
    });
    lireAgenda(b, tok);
  }

  /* ── Votre agenda perso (26/11/2026) : le lien secret de son calendrier ; Phirst n'en garde que les heures (agenda_occupe). ── */
  function lireAgenda(b, tok) {
    Promise.resolve(b.from('agenda_perso').select('lien,etat,nb,message,lu_le,essai_le').limit(1).maybeSingle()).then(function (r) {
      if (tok !== S.jeton) return;
      S.ag = r && !r.error ? (r.data || null) : 'indispo'; dessiner();
    }, function () { if (tok === S.jeton) { S.ag = 'indispo'; dessiner(); } });
  }
  function espace(b) {
    return Promise.resolve(b.from('crm_members').select('workspace_id').eq('user_id', V2.user.id).limit(1).maybeSingle()).then(function (r) {
      if (!r || r.error || !r.data || !r.data.workspace_id) throw new Error('espace');
      return r.data.workspace_id;
    });
  }
  /* L'abonnement porte le jeton par lequel le relais relit l'agenda perso : on en crée un s'il n'y en a pas. */
  function jetonActif(b, ws) {
    return Promise.resolve(b.from('agenda_abonnements').select('jeton').is('revoque_le', null).limit(1).maybeSingle()).then(function (r) {
      if (r && !r.error && r.data && r.data.jeton) return r.data.jeton;
      return Promise.resolve(b.from('agenda_abonnements').insert({ workspace_id: ws }).select('jeton').single()).then(function (n) {
        if (!n || n.error || !n.data) throw new Error('abonnement');
        return n.data.jeton;
      });
    });
  }
  function direAgenda(t, err) { S.agDit = t; S.agErr = !!err; S.agOccupe = false; dessiner(); }
  function resultatLecture(r) {
    if (!r) return 'Lien enregistré. La lecture n’a pas répondu tout de suite : elle se refera toute seule dans un quart d’heure.';
    if (r.etat === 'ok') return 'Agenda relié : ' + r.nb + ' plage' + (r.nb > 1 ? 's' : '') + ' occupée' + (r.nb > 1 ? 's' : '') + ' lue' + (r.nb > 1 ? 's' : '') + ' dans les 3 prochains mois.';
    if (r.etat === 'vide') return 'Agenda relié, mais aucune heure occupée n’y figure dans les 3 prochains mois.';
    return r.message || 'Cet agenda n’a pas pu être lu : vérifiez le lien.';
  }
  function relireAgenda(b, ws) {
    return jetonActif(b, ws).then(function (j) { return window.PHIRST_RDV && window.PHIRST_RDV.relirePerso ? window.PHIRST_RDV.relirePerso(j) : null; }).then(function (r) {
      lireAgenda(b, S.jeton);
      direAgenda(resultatLecture(r), !!r && r.etat === 'erreur');
    });
  }
  function enregistrerAgenda(form) {
    if (S.agOccupe) return;
    var champ = form.querySelector('input'), v = P.lienAgendaPropre(champ.value), b = sb();
    if (v.erreur) { direAgenda(v.erreur, true); var c = S.racine && S.racine.querySelector('[data-f="ag-lien"]'); if (c) c.focus(); return; }
    if (!b || !V2.user) { direAgenda('Pas enregistré : réessayez dans un instant.', true); return; }
    S.agOccupe = true; S.agDit = 'Lecture de votre agenda…'; S.agErr = false; dessiner();
    espace(b).then(function (ws) {
      return Promise.resolve(b.from('agenda_perso').upsert({ user_id: V2.user.id, workspace_id: ws, lien: v.lien, etat: null, nb: null, message: null, essai_le: null, maj_le: new Date().toISOString() }, { onConflict: 'user_id' }))
        .then(function (r) { if (!r || r.error) throw new Error('lien'); S.agForm = false; var c = S.racine && S.racine.querySelector('[data-f="ag-lien"]'); if (c) c.value = ''; return relireAgenda(b, ws); });
    }).then(null, function () { direAgenda('Pas enregistré : réessayez dans un instant.', true); });
  }
  function relireMaintenant() {
    var b = sb(); if (!b || S.agOccupe) return;
    S.agOccupe = true; S.agDit = 'Lecture de votre agenda…'; S.agErr = false; dessiner();
    espace(b).then(function (ws) { return relireAgenda(b, ws); }).then(null, function () { direAgenda('La lecture n’a pas pu partir : réessayez dans un instant.', true); });
  }
  function retirerAgenda() {
    var b = sb(); if (!b || S.agOccupe) return;
    S.agOccupe = true; dessiner();
    Promise.resolve(b.rpc('phirst_agenda_perso_retirer')).then(function (r) {
      if (!r || r.error) throw new Error('retirer');
      S.ag = null; S.agForm = false; direAgenda('Lien retiré : Phirst ne lit plus votre agenda perso, et ses heures ont été effacées.');
    }).then(null, function () { direAgenda('Pas retiré : réessayez dans un instant.', true); });
  }
  var AIDE_AGENDA = [
    { t: 'Agenda iCloud (Calendrier de l’iPhone)', ouvert: true, l: [
      'Sur l’iPhone, ouvrez Calendrier et touchez « Calendriers ».',
      'Touchez le bouton d’informations à côté de votre agenda perso, activez « Calendrier public », puis touchez « Envoyer le lien » et copiez-le.',
      'Collez ce lien ci-dessus (il commence par webcal://).'
    ], n: 'Un calendrier public iCloud se lit par toute personne qui a le lien. Phirst le garde caché et n’en lit que les heures : ne donnez ce lien à personne d’autre.' },
    { t: 'Agenda Google', l: [
      'Depuis un ordinateur (l’adresse ne se voit pas sur le téléphone), ouvrez Google Agenda.',
      'Paramètres › le nom de votre agenda › « Intégrer l’agenda ».',
      'Copiez « Adresse secrète au format iCal » et collez-la ci-dessus.'
    ], n: 'Cette adresse est secrète : ne la donnez à personne d’autre. Si elle a circulé, « Réinitialiser » dans Google en crée une nouvelle.' },
    { t: 'Agenda Outlook', l: [
      'Sur outlook.com ou Outlook sur le web : Paramètres › Calendrier › Calendriers partagés › « Publier un calendrier ».',
      'Choisissez votre calendrier et, si c’est proposé, « Peut voir quand je suis occupé » : même le détail ne sort pas.',
      'Touchez « Publier », copiez le lien ICS et collez-le ci-dessus.'
    ], n: 'Toute personne qui a ce lien voit le calendrier publié : ne le donnez à personne d’autre.' }
  ];
  function sectionAgenda() {
    if (S.ag === undefined || S.ag === 'indispo') return '';
    var a = S.ag, h = '<section class="dz-carte rg-bloc rg-agenda" id="rg-agenda" aria-labelledby="rg-agenda-t"><h2 class="rg-h2" id="rg-agenda-t">Votre agenda perso</h2>' +
      '<p class="rg-sous">Collez ici le lien de votre agenda perso. Phirst y lit seulement les heures où vous êtes pris, jamais le titre ni le détail : elles apparaissent en gris dans l’Agenda, et les créneaux proposés les évitent. La téléprospectrice voit seulement « Yann est occupé ».</p>';
    if (a) {
      var four = P.fournisseurAgenda(a.lien), nom = four ? 'Agenda ' + four + ' relié' : 'Agenda relié', ok = a.etat === 'ok' || a.etat === 'vide';
      if (ok || !a.etat) {
        var lu = a.lu_le ? 'lu ' + P.ageFr(a.lu_le, Date.now()) : 'pas encore lu';
        var nb = a.etat === 'ok' ? a.nb + ' plage' + (a.nb > 1 ? 's' : '') + ' occupée' + (a.nb > 1 ? 's' : '') + ' dans les 3 prochains mois' : a.etat === 'vide' ? 'aucune heure occupée dans les 3 prochains mois' : '';
        h += '<p class="rg-ag-etat" data-ok>' + esc([nom, lu, nb].filter(Boolean).join(' · ')) + '</p>';
      } else {
        h += '<p class="rg-ag-etat" data-err><b>' + esc(nom) + '</b> ' + esc(a.message || 'Cet agenda n’a pas pu être lu.') + ' ' +
          esc(a.lu_le ? 'Dernière lecture réussie ' + P.ageFr(a.lu_le, Date.now()) + ' : ces heures-là restent prises en compte.' : 'Aucune lecture réussie pour l’instant.') + '</p>';
      }
      h += '<div class="rg-ag-bs"><button type="button" class="dz-btn plein" data-rg="ag-relire" data-f="ag-relire"' + (S.agOccupe ? ' disabled' : '') + '>Relire maintenant</button>' +
        '<button type="button" class="dz-btn" data-rg="ag-changer" data-f="ag-changer">Changer le lien</button>' +
        '<button type="button" class="dz-btn" data-rg="ag-retirer" data-f="ag-retirer"' + (S.agOccupe ? ' disabled' : '') + '>Retirer le lien</button></div>';
    }
    if (!a || S.agForm) {
      h += '<form class="rg-form" data-agperso novalidate><div class="dz-champ"><label for="rg-ag-lien">Lien de votre agenda perso</label>' +
        '<input id="rg-ag-lien" type="url" inputmode="url" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" placeholder="webcal://… ou https://…" data-f="ag-lien"></div>' +
        '<button type="submit" class="dz-btn plein" data-f="ag-ok"' + (S.agOccupe ? ' disabled' : '') + '>Enregistrer</button></form>';
    }
    if (S.agDit) h += '<p class="' + (S.agErr ? 'rg-err' : 'rg-ag-dit') + '" role="status">' + esc(S.agDit) + '</p>';
    h += '<div class="rg-ag-aide">' + AIDE_AGENDA.map(function (x) {
      return '<details class="dz-repli rg-ag-d"' + (x.ouvert ? ' open' : '') + '><summary>' + esc(x.t) + '<i class="dz-chev" aria-hidden="true"></i></summary><div class="dz-repli-c"><ol>' +
        x.l.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ol><p>' + esc(x.n) + '</p></div></details>';
    }).join('') + '</div>';
    return h + '</section>';
  }

  /* ── les briques de la maquette ── */
  function outil(o) {
    var marque = o.etat === 'ok' ? '' : o.etat === 'panne' ? ' data-panne' : ' data-inconnu';
    return '<li class="dz-carte rg-outil"' + marque + ' data-outil="' + esc(o.id) + '"><button type="button" class="rg-tog" data-rg="outil" data-id="' + esc(o.id) + '" aria-controls="rg-note" aria-pressed="' + (o.id === S.noteOutil ? 'true' : 'false') + '" aria-label="Lire le détail : ' + esc(o.t) + '"></button><span class="rg-pastille">' + ico(o.etat === 'ok' ? 'valide' : o.etat === 'panne' ? 'point' : 'question', 24) + '</span><div class="rg-outil-c">' +
      '<h3 class="rg-outil-t">' + ico(o.ic, 20) + '<span>' + esc(o.t) + '</span></h3><p class="rg-court">' + esc(court(o)) + '</p><p class="rg-quoi">' + esc(o.quoi) + '</p>' +
      '<p class="rg-etat">' + esc(o.texte) + '</p></div></li>';
  }
  /* Au téléphone, la carte ne porte qu'une ligne d'état ; tout le texte (explication + état) s'affiche au toucher, dans la note. */
  function court(o) {
    if (o.etat === 'ok') return o.texte.replace(' — et sans frais', '').replace(' · mise à jour aujourd’hui à ', ' · ').replace(' · mise à jour ', ' · ');
    if (o.etat === 'panne') return o.id === 'liste' ? 'Pas à jour' : 'Pas disponible';
    return 'État inconnu';
  }
  function noteParDefaut(outils) {   // sans choix de l'utilisateur : le premier outil en panne (ce qu'il faut lire en premier)
    if (S.noteOutil !== undefined) return;
    outils.forEach(function (x) { if (S.noteOutil === undefined && x.etat === 'panne') S.noteOutil = x.id; });
  }
  function noteOutil(outils) {
    var id = S.noteOutil, o = null;
    outils.forEach(function (x) { if (x.id === id) o = x; });
    return '<div class="rg-note" id="rg-note" role="status" aria-live="polite">' + (o ? '<b>' + esc(o.t) + '</b>' + esc(o.quoi) + ' ' + esc(o.texte) : '') + '</div>';
  }
  function plafond() {
    var pl = R.plafondValide(S.etat && S.etat.plafondCentimes), j = R.jauge(S.depense, pl), h = '<section class="dz-carte rg-bloc"><h2 class="rg-h2">Le plafond du mois</h2>';
    if (j) h += '<div class="rg-jauge"><p class="rg-jauge-l"><b>' + esc(R.eur(j.depense)) + '</b><span>sur ' + esc(R.eur(j.plafond)) + ' ce mois-ci</span></p>' +
      '<div class="rg-jauge-p" role="img" aria-label="' + j.p + ' % du plafond du mois utilisé"><i style="width:' + j.p + '%"' + (j.fort ? ' data-fort' : '') + '></i></div>' +
      '<p class="rg-jauge-r"><span>' + esc(j.gauche) + '</span><span>' + esc(j.droite) + '</span></p></div>';
    else h += '<p class="rg-inconnu">' + (pl == null ? 'Le plafond n’a pas pu être lu pour l’instant' : 'La dépense du mois n’a pas pu être lue pour l’instant') + ' : rechargez la page dans quelques minutes.</p>';
    if (pl != null) h += '<p class="rg-sous">L’intelligence artificielle est plafonnée à <b>' + esc(R.eur(pl)) + ' par mois</b>. Au-delà, elle s’arrête d’elle-même : aucune facture ne peut vous surprendre. Les images réalistes, elles, ne coûtent rien et ne comptent pas dans ce plafond.</p>';
    return h + '</section>';
  }
  function htmlFlash() { return S.flash ? '<p class="dz-flash rg-flash' + (S.flashErr ? ' dz-err' : '') + '" role="status">' + esc(S.flash) + '</p>' : ''; }
  function formMdp(dansFeuille) {
    var p = dansFeuille ? 'rg-f-' : 'rg-p-';
    return '<form class="rg-form" data-mdp novalidate><p class="cz-f-intro rg-intro">Choisissez un mot de passe personnel, d’au moins ' + R.MDP_MIN + ' caractères.</p>' +
      '<div class="dz-champ"><label for="' + p + 'mdp1">Nouveau mot de passe</label><input id="' + p + 'mdp1" type="password" autocomplete="new-password" data-f="' + p + 'mdp1"></div>' +
      '<div class="dz-champ"><label for="' + p + 'mdp2">Confirmer le mot de passe</label><input id="' + p + 'mdp2" type="password" autocomplete="new-password" data-f="' + p + 'mdp2"></div>' +
      '<p class="rg-err" role="alert" hidden></p><button type="submit" class="dz-btn plein" data-f="' + p + 'ok">' + ico('cadenas', 20) + 'Changer mon mot de passe</button></form>';
  }
  function deconnexion() { return '<button type="button" class="dz-btn rg-sortir" data-rg="sortir" data-f="sortir">' + ico('sortir', 20) + 'Se déconnecter</button>'; }
  function tech(outils) {
    var e = S.etat, li = S.liste, pl = R.plafondValide(e && e.plafondCentimes);
    function cle(v, nom) { return 'clé ' + nom + ' sur phirst-studio : ' + (typeof v === 'boolean' ? (v ? 'présente' : 'absente') : 'non lue') ; }
    var T = {
      base: 'Supabase, le projet de Phirst (base et stockage des fichiers). Lu par l’app : une lecture qui répond.',
      liste: 'Robot du Mac de Will, chaque matin (table ligne_accueil). « En service » tant que la liste a moins de 36 h.' + (li && li.calculeLe ? ' Dernier calcul : ' + P.miseAJourFr(li.calculeLe) + '.' : ''),
      images: 'Google Gemini, dans l’ancienne version (' + cle(e && e.images, 'GEMINI_API_KEY') + ').',
      video: 'fal.ai (Flux + Kling), dans l’ancienne version (' + cle(e && e.video, 'FAL_KEY') + ').'
    };
    return '<details class="dz-repli rg-tech" data-rg="tech"' + (S.techOuvert ? ' open' : '') + '><summary data-f="tech">Détails techniques (pour Will)<i class="dz-chev" aria-hidden="true"></i></summary><div class="dz-repli-c">' +
      outils.map(function (o) { return '<p><b>' + esc(o.t) + '</b> — ' + esc(T[o.id]) + '</p>'; }).join('') +
      '<p><b>Le plafond</b> — réglage MONTHLY_CAP_CENTS de l’ancienne version, lu par son adresse /api/etat (' + (pl != null ? esc(R.eur(pl)) : 'non lu') + '). La dépense se lit dans la table jobs, depuis le 1er du mois.</p></div></details>';
  }

  function pageYann() {
    if (!S.lu) return '<section class="rg-bande rg-attente" aria-labelledby="rg-h1"><div class="rg-bande-g"><p class="rg-sur">Outils et compte</p><h1 id="rg-h1">Réglages</h1><p class="rg-lede">Outils et compte.</p>' +
      '<p class="rg-phrase">Vérification des outils…</p></div></section>';
    var outils = R.etats({ base: S.base, liste: S.liste, etat: S.etat }), b = R.bilan(outils), lib = b.libelle.split('\n');
    noteParDefaut(outils);
    return '<section class="rg-bande" aria-labelledby="rg-h1"><div class="rg-bande-g"><p class="rg-sur">Outils et compte</p><h1 id="rg-h1">Réglages</h1><p class="rg-lede">Outils et compte.</p>' +
      '<p class="rg-grand"><b>' + esc(b.chiffre) + '</b><span>' + esc(lib[0]) + '<br>' + esc(lib[1]) + '</span></p></div>' +
      '<p class="rg-phrase">' + esc(b.phrase) + '</p></section>' +
      '<div class="rg-grille"><div class="rg-bilan"><p class="rg-sur">Outils et compte</p><b>' + esc(b.chiffre) + '</b><p><span>' + esc(lib[0] + ' ' + lib[1]) + '</span>' + esc(b.phrase) + '</p></div>' +
      '<ul class="rg-outils" aria-label="Les outils de Phirst">' + outils.map(outil).join('') + '</ul>' + noteOutil(outils) +
      '<div id="ri-zone">' + (window.PHIRST_RG_TEXTES ? window.PHIRST_RG_TEXTES.html() : '') + '</div>' + sectionAgenda() +
      '<div class="rg-cote">' + plafond() +
      '<section class="dz-carte rg-bloc" id="rg-compte"><h2 class="rg-h2">Mon compte</h2><p class="rg-sous">' + esc(email()) + '</p>' + htmlFlash() +
      '<button type="button" class="dz-btn plein" data-rg="mdp" data-f="mdp">' + ico('cadenas', 20) + 'Changer mon mot de passe</button>' + deconnexion() + '</section>' +
      tech(outils) + '</div></div>';
  }
  function pageTelepro() {
    return '<div class="dz-tete"><div class="dz-tete-g"><p class="dz-kicker">Compte</p><h1>Réglages</h1><p>' + esc(email()) + '</p></div></div>' +
      '<div class="rg-seul"><section class="dz-carte rg-bloc" id="rg-compte"><h2 class="rg-h2">Mon mot de passe</h2>' + htmlFlash() + formMdp(false) + '</section>' + deconnexion() + '</div>';
  }

  /* ── dessin ── */
  function feuille() { return S.racine && S.racine.querySelector('#rg-feuille'); }
  function dessiner() {
    var r = S.racine; if (!r || !V2.route || V2.route.name !== 'reglages') return;
    var pg = r.querySelector('#rg-pg');
    if (!pg) {
      r.innerHTML = X.cadre('<section class="pa dz cz rg" aria-label="Réglages"><div id="rg-pg"></div><dialog class="cz-feuille rg-feuille" id="rg-feuille" aria-labelledby="rg-f-titre"></dialog></section>');
      pg = r.querySelector('#rg-pg');
      var F = feuille();
      F.addEventListener('click', function (ev) { if (ev.target === F) fermer(); });
      F.addEventListener('close', function () { if (F.open) return; var d = S.depuis; S.depuis = null; F.innerHTML = ''; if (d) { var n = r.querySelector('[data-f="' + d + '"]'); if (n) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } } });
    }
    if (!S.roleConnu) { pg.innerHTML = '<div class="dz-vide"><p>Un instant…</p></div>'; return; }
    var act = document.activeElement, cle = act && pg.contains(act) && act.getAttribute ? act.getAttribute('data-f') : null;
    var gardes = {}; Array.prototype.forEach.call(pg.querySelectorAll('input[data-f]'), function (c) { gardes[c.getAttribute('data-f')] = c.value; });
    pg.innerHTML = S.telepro ? pageTelepro() : pageYann();
    Object.keys(gardes).forEach(function (k) { var c = pg.querySelector('input[data-f="' + k + '"]'); if (c) c.value = gardes[k]; });
    if (cle) { var n = pg.querySelector('[data-f="' + cle + '"]'); if (n) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
  }
  function dire(t, err) {
    S.flash = t; S.flashErr = !!err; clearTimeout(S.tFlash);
    if (!err) S.tFlash = setTimeout(function () { S.flash = ''; var n = S.racine && S.racine.querySelector('.rg-flash'); if (n) n.remove(); }, 6000);
    dessiner();
  }

  /* ── le panneau du mot de passe (Yann) ── */
  function ouvrirMdp() {
    var F = feuille(); if (!F) return;
    S.depuis = 'mdp';
    F.innerHTML = '<div class="cz-f-tete"><div class="cz-f-tete-g"><p class="dz-kicker">Mon compte</p><h2 id="rg-f-titre" tabindex="-1">Mon mot de passe</h2></div>' +
      '<button type="button" class="dz-btn petit" data-rg="fermer">Fermer</button></div><div class="cz-f-corps">' + formMdp(true) + '</div>';
    if (!F.open) { try { F.showModal(); } catch (e) { F.setAttribute('open', ''); } }
    var h2 = F.querySelector('#rg-f-titre'); if (h2) try { h2.focus({ preventScroll: true }); } catch (e) { h2.focus(); }
  }
  function fermer() { var F = feuille(); if (F && F.open) { try { F.close(); } catch (e) { F.removeAttribute('open'); } } }

  function changerMdp(form) {
    if (S.occupe) return;
    var c = form.querySelectorAll('input'), e = form.querySelector('.rg-err'), ok = form.querySelector('button[type=submit]');
    function erreur(m, champ) {
      e.textContent = m; e.hidden = !m;
      c[0].toggleAttribute('aria-invalid', !!m && champ === 1); c[1].toggleAttribute('aria-invalid', !!m && champ === 2);
      if (m) (champ === 2 ? c[1] : c[0]).focus();
    }
    var v = R.verifierMdp(c[0].value, c[1].value);
    if (v.message) { erreur(v.message, v.champ); return; }
    var b = sb(); if (!b) { erreur('Mot de passe pas changé : réessayez dans un instant.', 1); return; }
    S.occupe = true; ok.disabled = true; erreur('', 0);
    var dansFeuille = !!form.closest('dialog');
    Promise.resolve(b.auth.updateUser({ password: c[0].value })).then(function (r) {
      S.occupe = false; ok.disabled = false;
      if (r && r.error) { erreur(R.messageMdp(r.error), 1); return; }
      c[0].value = ''; c[1].value = '';
      if (dansFeuille) fermer();
      dire('Mot de passe changé. Utilisez-le à votre prochaine connexion.');
      /* Le message redessine la page : le bouton d'origine est remplacé. L'avis de fermeture du panneau rend le focus au nouveau,
         mais Safari a perdu ce retour une fois sur deux (23/11, focus resté sur la page) : on le rend aussi ici, après le redessin. */
      if (dansFeuille) setTimeout(function () {
        var n = S.racine && S.racine.querySelector('[data-f="mdp"]'), F = feuille();
        if (n && document.activeElement !== n && !(F && F.open)) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); }
      }, 0);
    }, function (err) {
      S.occupe = false; ok.disabled = false; erreur(R.messageMdp(err || {}), 1);
    });
  }

  function choisirOutil(id) {
    var r = S.racine; if (!r) return;
    var li = r.querySelector('.rg-outil[data-outil="' + id + '"]'), n = r.querySelector('#rg-note'); if (!li || !n) return;
    S.noteOutil = id;
    Array.prototype.forEach.call(r.querySelectorAll('.rg-tog'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-id') === id ? 'true' : 'false'); });
    n.innerHTML = '<b>' + esc(li.querySelector('.rg-outil-t span').textContent) + '</b>' + esc(li.querySelector('.rg-quoi').textContent) + ' ' + esc(li.querySelector('.rg-etat').textContent);
  }
  function clic(ev) {
    var t = ev.target.closest('[data-rg],[data-vers]'); if (!t) return;
    if (t.hasAttribute('data-vers')) { V2.go(t.getAttribute('data-vers')); return; }
    var a = t.getAttribute('data-rg');
    if (a === 'mdp') ouvrirMdp();
    else if (a === 'outil') choisirOutil(t.getAttribute('data-id'));
    else if (a === 'fermer') fermer();
    else if (a === 'sortir' && typeof V2.signOut === 'function') V2.signOut();
    else if (a === 'ag-relire') relireMaintenant();
    else if (a === 'ag-retirer') retirerAgenda();
    else if (a === 'ag-changer') { S.agForm = !S.agForm; S.agDit = ''; dessiner(); var c = S.racine && S.racine.querySelector('[data-f="ag-lien"]'); if (c) c.focus(); }
  }

  /* ── entrée ── */
  V2.pages.reglages = { needs: [], render: function (root) {
    S.racine = root; S.flash = ''; S.flashErr = false; S.occupe = false; S.depuis = null; S.techOuvert = false; S.noteOutil = undefined;
    S.ag = undefined; S.agForm = false; S.agDit = ''; S.agErr = false; S.agOccupe = false;
    root.innerHTML = '';
    if (window.PHIRST_RG_TEXTES) { window.PHIRST_RG_TEXTES.remise(); window.PHIRST_RG_TEXTES.brancher(root); }
    if (!root.__rg) {
      root.__rg = true;
      root.addEventListener('click', function (ev) { if (V2.route && V2.route.name === 'reglages') clic(ev); });
      root.addEventListener('submit', function (ev) {
        if (!V2.route || V2.route.name !== 'reglages') return;
        var g = ev.target.closest && ev.target.closest('[data-agperso]'); if (g) { ev.preventDefault(); enregistrerAgenda(g); return; }
        var f = ev.target.closest && ev.target.closest('[data-mdp]'); if (!f) return;
        ev.preventDefault(); changerMdp(f);
      });
      root.addEventListener('toggle', function (ev) { var d = ev.target; if (d && d.getAttribute && d.getAttribute('data-rg') === 'tech') S.techOuvert = d.open; }, true);
    }
    var tok = ++S.jeton;
    S.roleConnu = false; S.telepro = false; S.lu = false; dessiner();
    function suite(t) {
      if (tok !== S.jeton || !V2.route || V2.route.name !== 'reglages') return;
      S.roleConnu = true; S.telepro = !!t; dessiner();
      if (!S.telepro) lire();
    }
    if (window.PHIRST_ROLE) window.PHIRST_ROLE.estTelepro().then(suite, function () { suite(false); });
    else suite(false);
  } };
})();
