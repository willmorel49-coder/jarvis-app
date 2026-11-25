/* PHIRST · écran « Chantiers », lot 1 (23/11/2026) : d'après la maquette V2 validée par Will (une carte par chantier, feuilles « Les tâches »
   et « Les artisans »). C'est Yann qui coche ; le lien de l'artisan viendra dans un 2e temps (aucun bouton « Envoyer le lien » ici).
   Tables : chantiers (un par volet Agencement ou Transfert), chantier_artisans, chantier_taches ; lues avec les dossiers, volets et étapes
   (pour « Prêts pour un chantier » et la réception, qui fait passer « Travaux » à faite dans le dossier). Photos : seau `dossiers`.
   Toute la logique est dans phirst-chantiers-pur.js, testée (tests/phirst-chantiers.test.mjs) ; ici : l'affichage et les écritures.
   Chaque geste écrit, puis met l'écran à jour avec la ligne RENDUE par la base : jamais de « réussi » avant la réponse.
   Paramètre d'adresse : V2.go('chantiers', <id du chantier>) ouvre la feuille de ses tâches.
   L4 (24/11/2026) : idée 9 « Ce client reviendra » (un chantier réceptionné programme ses rappels : table chantier_rappels, échéances calculées depuis
   la date de réception ; la téléprospectrice les reçoit par le robot du matin, sans jamais voir le chantier) et idée 10 « Un confrère qui a un projet ? »
   (noté au bilan : table chantier_confreres). Si ces deux tables n'existent pas encore, l'écran garde tout ce qu'il avait et n'affiche pas ces blocs. */
(function () {
  'use strict';
  var C = window.PHIRST_CHANTIERS_PUR, D = window.PHIRST_DOSSIERS_PUR, V2 = window.V2, X = window.PHIRST_ECRAN;
  if (!C || !D || !V2 || !X) return;
  V2.pages = V2.pages || {};
  var PAS = 'Pas enregistré : réessayez dans un instant.';
  var COLS_PISTE = 'id,nom,ville,cp,departement,pharmacien,dossier_id';
  var esc = X.esc;
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }

  var S = {
    racine: null, jeton: 0, telepro: false, roleConnu: false, charge: false, erreur: false,
    dossiers: [], volets: [], etapes: [], pistes: [], chantiers: [], artisans: [], taches: [], rappels: [], confreres: [], sansRappels: false,
    voir: null, fc: null, mode: null, ui: {}, form: {}, occupe: false, flash: '', flashErr: false, tFlash: 0, urls: {}
  };

  /* ── petites briques ── */
  function ico(n, t) {
    t = t || 20;
    var p = {
      coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', fleche: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
      photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
      liste: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
      agenda: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
      rond: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
      gens: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0112 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013 6"/>'
    }[n];
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  var pl = D.pl;
  function auj() { return D.aujourdhui(); }
  function dis() { return S.occupe ? ' disabled' : ''; }
  function maj(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ── les données montées ── */
  function pharmacies() { return D.pharmacies(S.dossiers, S.volets, S.etapes); }
  function pisteDe(dossierId) { return S.pistes.filter(function (p) { return p.dossier_id === dossierId; })[0] || null; }
  function infoPh(ph) {
    var d = ph.dossier, p = pisteDe(d.id), ville = d.ville || (p && p.ville) || '';
    return { ville: ville ? ville + (p && p.departement ? ' (' + p.departement + ')' : '') : '', titulaire: d.titulaire || (p && p.pharmacien) || '' };
  }
  /* Chaque chantier avec son volet et sa pharmacie (un chantier dont le volet n'est plus lisible n'est pas montré). */
  function tous() {
    var par = {}, l = [];
    pharmacies().forEach(function (ph) { ph.volets.forEach(function (v) { par[v.id] = { ph: ph, volet: v }; }); });
    S.chantiers.forEach(function (ch) {
      var o = par[ch.volet_id]; if (!o) return;
      l.push({ c: C.monterChantier(ch, S.artisans, S.taches), ph: o.ph, volet: o.volet });
    });
    return l;
  }
  function un(id) { return tous().filter(function (x) { return x.c.id === id; })[0] || null; }

  /* ── lecture ── */
  function toutLire(fabrique) {
    var tout = [];
    function page(n) {
      return fabrique().range(n * 1000, n * 1000 + 999).then(function (r) {
        if (r.error) throw new Error('lecture');
        tout = tout.concat(r.data || []);
        return (r.data || []).length === 1000 && n < 9 ? page(n + 1) : tout;
      });
    }
    return page(0);
  }
  function charger() {
    var u = V2.user, tok = ++S.jeton, base = sb();
    S.charge = false; S.erreur = false;
    if (!u || !base) { S.erreur = true; dessiner(); return Promise.resolve(); }
    dessiner();
    return base.from('crm_members').select('workspace_id').eq('user_id', u.id).limit(1).maybeSingle().then(function (m) {
      var ws = m && !m.error && m.data && m.data.workspace_id;
      return Promise.all([
        base.from('dossiers').select('id,user_id,nom,ville,titulaire,statut,created_at').eq('user_id', u.id).order('created_at', { ascending: false }),
        toutLire(function () { return base.from('dossier_volets').select('*').order('id'); }),
        toutLire(function () { return base.from('dossier_etapes').select('*').order('id'); }),
        ws ? toutLire(function () { return base.from('crm_prospects').select(COLS_PISTE).eq('workspace_id', ws).not('dossier_id', 'is', null).order('id'); }) : Promise.resolve([]),
        toutLire(function () { return base.from('chantiers').select('*').order('id'); }),
        toutLire(function () { return base.from('chantier_artisans').select('*').order('id'); }),
        toutLire(function () { return base.from('chantier_taches').select('*').order('id'); }),
        /* L4 : si ces deux tables n'existent pas encore (SQL pas posé), tout le reste de l'écran continue de marcher */
        toutLire(function () { return base.from('chantier_rappels').select('*').order('id'); }).then(null, function () { return null; }),
        toutLire(function () { return base.from('chantier_confreres').select('*').order('id'); }).then(null, function () { return null; })
      ]).then(function (x) {
        if (x[0].error) throw new Error('dossiers');
        if (tok !== S.jeton) return;
        S.dossiers = x[0].data || []; S.volets = x[1]; S.etapes = x[2]; S.pistes = x[3]; S.chantiers = x[4]; S.artisans = x[5]; S.taches = x[6];
        S.sansRappels = x[7] === null || x[8] === null; S.rappels = x[7] || []; S.confreres = x[8] || [];
        S.charge = true; S.erreur = false; dessiner();
      });
    }).then(null, function () { if (tok === S.jeton) { S.erreur = true; dessiner(); } });
  }

  /* ── la liste ── */
  function segments(c) { return '<div class="dz-frise-c cz-seg" aria-hidden="true">' + C.segments(c, auj()).map(function (k) { return '<i class="' + k + '"></i>'; }).join('') + '</div>'; }
  function pastille(st) { return '<span class="dz-et' + (st.ton ? ' ' + st.ton : '') + '">' + esc(st.texte) + '</span>'; }
  function tuile(s) { var t = C.tuile(s); return '<div class="cz-date" aria-hidden="true"><span>' + t.j + '</span><b>' + t.n + '</b><span>' + t.m + '</span></div>'; }
  function carte(x) {
    var c = x.c, v = x.volet, inf = infoPh(x.ph), a = auj(), pr = C.prochaine(c), f = C.nbFaites(c), n = c.taches.length, reste = C.aFaire(c), r = C.enRetard(c, a), j = C.jours(c, a);
    var h = '<article class="dz-carte cz-carte" id="cz-c-' + esc(c.id) + '" aria-labelledby="cz-n-' + esc(c.id) + '"><div class="cz-tete">' + tuile(c.ouverture) + '<div class="cz-id">' +
      '<div class="dz-carte-h"><span class="dz-et">' + esc(v.nom) + '</span>' + (function (st) { return st.texte === 'En cours' ? '' : pastille(st); })(C.statut(c, a)) + '</div>' +
      '<h3 id="cz-n-' + esc(c.id) + '">' + esc(x.ph.dossier.nom) + '</h3><p class="dz-sous">' + (inf.ville ? esc(inf.ville) + ' · ' : '') + 'ouverture ' + (j < 0 ? 'prévue le ' : 'le ') + esc(D.jourLong(c.ouverture)) + ', ' + C.dans(j) + '</p></div></div>';
    h += '<div class="cz-av">' + segments(c) + '<p class="cz-nn">' + (n ? f + ' sur ' + n + ' tâches faites · ' + Math.round(100 * f / n) + ' %' : 'Aucune tâche pour l’instant') + '</p></div>';
    if (pr) {
      var q = C.quand(pr, a);
      h += '<div class="dz-proch"><span class="dz-kicker">Prochaine étape</span><b>' + esc(pr.titre) + '</b><small class="' + (q.retard ? 'ret' : '') + '">' + esc(C.nomArtisan(c, pr)) + ' · ' + esc(q.texte) + '</small></div>';
      var aussi = r.filter(function (t) { return t !== pr; });
      if (aussi.length) h += '<p class="cz-aussi">Aussi en retard : ' + aussi.map(function (t) { return esc(t.titre) + ' (' + esc(C.nomArtisan(c, t)) + ')'; }).join(' · ') + '</p>';
    } else if (n) h += '<div class="dz-proch cz-fin"><span class="dz-kicker">Tout est coché</span><b>Les ' + n + ' tâches sont faites</b><small>Il reste à prononcer la réception avec le pharmacien.</small></div>';
    else h += '<div class="dz-proch"><span class="dz-kicker">Chantier ouvert</span><b>Ajoutez les tâches et les artisans</b><small>Ouvert le ' + esc(C.cj(c.debut, a)) + ' depuis le dossier.</small></div>';
    h += '<div class="cz-deux"><button class="dz-btn" type="button" data-cz="taches" data-id="' + esc(c.id) + '" data-f="t-' + esc(c.id) + '">' + ico('liste', 18) + 'Les tâches <span class="cz-n">' + (reste.length ? reste.length + ' à faire' : n ? 'toutes faites' : 'aucune') + '</span></button>' +
      '<button class="dz-btn" type="button" data-cz="artisans" data-id="' + esc(c.id) + '" data-f="a-' + esc(c.id) + '">' + ico('gens', 18) + 'Les artisans <span class="cz-n">' + c.artisans.length + '</span></button></div>';
    if (C.pretPourReception(c)) h += '<button class="dz-btn plein" type="button" data-cz="recep-carte" data-id="' + esc(c.id) + '">' + ico('coche', 18) + 'Prononcer la réception</button>';
    return h + '<button type="button" class="dz-lien cz-dos" data-cz="dossier" data-id="' + esc(x.ph.dossier.id) + '" data-s="' + esc(v.sorte) + '">Ouvrir le dossier · volet ' + esc(v.nom) + ico('fleche', 16) + '</button></article>';
  }
  function cartePret(p) {
    var inf = infoPh(p.ph), v = p.volet, tr = p.travaux, pr = p.prochaine, avant = pr !== tr;
    return '<article class="dz-carte cz-pret"><div class="dz-carte-h"><span class="dz-et">' + esc(v.nom) + '</span><span class="dz-et">Étape ' + pr.n + ' sur ' + v.etapes.length + '</span></div>' +
      '<h3>' + esc(p.ph.dossier.nom) + '</h3>' + (inf.ville || inf.titulaire ? '<p class="dz-sous">' + esc([inf.ville, inf.titulaire].filter(Boolean).join(' · ')) + '</p>' : '') +
      '<div class="dz-proch"><span class="dz-kicker">Étape « Travaux »</span><b>' + (tr.prevue ? 'Prévue le ' + esc(C.cj(tr.prevue, auj())) : 'Date à fixer') + '</b><small>' + (avant ? 'Avant elle : ' + esc(pr.t) : 'C’est la prochaine chose à faire du dossier.') + '</small></div>' +
      '<button type="button" class="dz-btn" data-cz="dossier" data-id="' + esc(p.ph.dossier.id) + '" data-s="' + esc(v.sorte) + '">Ouvrir le chantier depuis le dossier' + ico('fleche', 18) + '</button></article>';
  }
  function carteRecue(x) {
    var c = x.c, inf = infoPh(x.ph);
    return '<article class="dz-carte cz-recu"><div class="dz-carte-h"><span class="dz-et">' + esc(x.volet.nom) + '</span><span class="dz-et vert">Réceptionné</span></div><h3>' + esc(x.ph.dossier.nom) + '</h3>' +
      '<p class="dz-sous">' + (inf.ville ? esc(inf.ville) + ' · ' : '') + 'réception le ' + esc(D.court(c.recuLe)) + ' · ' + pl(c.taches.length, 'tâche', 'tâches') + '</p>' +
      miniRappels(x) + (S.sansRappels ? '' : '<button class="dz-btn" type="button" data-cz="taches" data-id="' + esc(c.id) + '">' + ico('agenda', 18) + 'Voir et modifier les rappels</button>') +
      '<button class="dz-btn" type="button" data-cz="taches" data-id="' + esc(c.id) + '">Revoir les tâches et les photos</button></article>';
  }

  /* ── L4 · idée 9 « Ce client reviendra » et idée 10 « Un confrère qui a un projet ? » ── */
  var ICO_RAPPEL = { bilan: 'agenda', entretien: 'liste', remplacement: 'rond' };
  function rappelsDe(x) { return C.rappelsDuChantier(S.rappels, x.c.id, auj()); }
  function confreresDe(x) { return C.confreresDuChantier(S.confreres, x.c.id).filter(function (f) { return !f.retire; }); }
  function ligneRappel(x, r) {
    var h, passe = r.passe;
    if (r.retire) {
      return '<li class="cz-rap retire"><span class="cz-rap-ic">' + ico(ICO_RAPPEL[r.type], 20) + '</span><div class="cz-rap-t"><b>' + esc(r.titre) + '</b><p class="cz-rap-dit">Rappel retiré : il n’arrivera pas dans la liste de la téléprospectrice.</p></div>' +
        '<div class="cz-rap-act"><button class="dz-lien" type="button" data-cz="rap-remettre" data-id="' + esc(r.id) + '"' + dis() + '>Remettre ce rappel</button></div></li>';
    }
    h = '<li class="cz-rap' + (r.fait ? ' fait' : '') + '"><span class="cz-rap-ic">' + ico(ICO_RAPPEL[r.type], 20) + '</span><div class="cz-rap-t"><b>' + esc(r.titre) + '</b>' +
      '<span class="cz-rap-d">' + (r.fait ? 'Fait' : esc(maj(C.quandRappel(r)))) + '</span>' +
      '<p class="cz-rap-dit">' + (r.fait ? 'Ce bilan est noté : il est sorti de la liste de la téléprospectrice.' :
        (passe ? 'Il est arrivé tout seul' : 'Il arrivera tout seul') + ' dans la liste de la téléprospectrice, avec cette raison écrite :<q>' + esc(r.raison) + '</q>') + '</p></div>';
    h += '<div class="cz-rap-act">' + (r.type === 'bilan' && passe ? '<button class="dz-btn' + (r.fait ? '' : ' plein') + ' petit" type="button" data-cz="bilan" data-id="' + esc(x.c.id) + '"' + dis() + '>Ouvrir le bilan</button>' : '') +
      (r.fait ? '' : '<button class="dz-lien" type="button" data-cz="rap-date" data-id="' + esc(r.id) + '"' + dis() + '>Changer la date</button><button class="dz-lien" type="button" data-cz="rap-retirer" data-id="' + esc(r.id) + '"' + dis() + '>Retirer</button>') + '</div>';
    if (!r.fait && S.ui.rdate === r.id) h += '<div class="cz-f-form cz-rap-form"><div class="dz-champ"><label for="cz-rd-' + esc(r.id) + '">Nouvelle date</label><input type="date" id="cz-rd-' + esc(r.id) + '" data-form="rap_date" value="' + esc(val('rap_date', r.date)) + '"' + dis() + '></div>' +
      '<p class="dz-erreur" role="alert">' + esc(S.ui.errRappel || '') + '</p><div class="dz-act"><button class="dz-btn plein petit" type="button" data-cz="rap-ok" data-id="' + esc(r.id) + '" data-f="rap-ok"' + dis() + '>Enregistrer la date</button><button class="dz-lien" type="button" data-cz="rap-annuler"' + dis() + '>Annuler</button></div></div>';
    if (!r.fait && S.ui.rretirer === r.id) h += '<div class="cz-confirme cz-rap-form" role="alertdialog" aria-labelledby="cz-rr-' + esc(r.id) + '"><p id="cz-rr-' + esc(r.id) + '"><b>Retirer ce rappel ?</b></p><p>Il n’arrivera pas dans la liste de la téléprospectrice. Vous pourrez le remettre.</p>' +
      '<div class="dz-act"><button class="dz-btn plein petit" type="button" data-cz="rap-retirer-ok" data-id="' + esc(r.id) + '" data-f="rap-retirer-ok"' + dis() + '>Oui, retirer</button><button class="dz-lien" type="button" data-cz="rap-annuler"' + dis() + '>Annuler</button></div></div>';
    return h + '</li>';
  }
  /* Le bloc de la feuille d'un chantier réceptionné. Rien tant que les deux tables neuves n'existent pas. */
  function blocReviendra(x) {
    if (S.sansRappels) return '';
    var R = rappelsDe(x), robot = C.robotDePharmacie(x.ph), h = '<section class="cz-rv" aria-label="Ce client reviendra"><p class="dz-kicker cz-rv-k"><i></i>Ce client reviendra</p>';
    if (!R.length) {
      return h + '<p class="cz-rv-i">Aucun rappel n’est programmé pour ce chantier. Programmez-les : chacun arrivera tout seul dans la liste de la téléprospectrice, à la date calculée depuis la réception du ' + esc(D.court(x.c.recuLe)) + '.</p>' +
        '<div class="dz-act"><button class="dz-btn plein" type="button" data-cz="rap-programmer" data-id="' + esc(x.c.id) + '" data-f="rap-programmer"' + dis() + '>' + ico('agenda', 18) + 'Programmer les rappels</button></div></section>';
    }
    h += '<p class="cz-rv-i">Chaque rappel arrive tout seul dans la liste de la téléprospectrice. Vous pouvez changer une date ou en retirer un.</p><ul class="cz-raps">' + R.map(function (r) { return ligneRappel(x, r); }).join('') + '</ul>';
    if (!R.some(function (r) { return r.type === 'remplacement'; })) h += '<p class="cz-pet">' + (robot ? 'Le rappel de remplacement du robot n’est pas programmé.' : 'Cette pharmacie n’a pas de robot dans nos dossiers : aucun rappel de remplacement n’est programmé.') + '</p>';
    return h + '</section>';
  }
  /* Le résumé dans la carte d'un chantier réceptionné */
  function miniRappels(x) {
    if (S.sansRappels) return '';
    var l = C.resumeRappels(rappelsDe(x));
    return '<div class="cz-rv-mini"><p class="dz-kicker cz-rv-k"><i></i>Ce client reviendra</p><ul>' + (l.length ? l.map(function (r) { return '<li><b>' + esc(r.titre) + '</b> <span>' + esc(r.quand) + '</span></li>'; }).join('') :
      '<li>Aucun rappel programmé : ouvrez la feuille pour les programmer.</li>') + '</ul></div>';
  }
  /* « Bilans à faire » : un chantier réceptionné dont le bilan est arrivé à échéance, pas encore noté */
  function carteBilan(x, b) {
    var inf = infoPh(x.ph);
    return '<article class="dz-carte cz-bilan"><div class="dz-carte-h"><span class="dz-et">' + esc(b.titre) + '</span><span class="dz-et orange">À faire</span></div><h3>' + esc(x.ph.dossier.nom) + '</h3>' +
      '<p class="dz-sous">' + (inf.ville ? esc(inf.ville) + ' · ' : '') + 'réception le ' + esc(D.long(x.c.recuLe)) + '</p>' +
      '<div class="dz-proch"><span class="dz-kicker">Rappel arrivé le ' + esc(C.cj(b.date, auj())) + '</span><b>Faire le point avec le pharmacien</b><small>Il est dans la liste de la téléprospectrice depuis cette date. Vous pouvez aussi le faire <span style="white-space:nowrap">vous-même</span>.</small></div>' +
      '<button class="dz-btn plein" type="button" data-cz="bilan" data-id="' + esc(x.c.id) + '" data-f="b-' + esc(x.c.id) + '"' + dis() + '>' + ico('agenda', 18) + 'Ouvrir le bilan</button></article>';
  }
  function feuilleBilan(x) {
    var c = x.c, b = rappelsDe(x).filter(function (r) { return r.type === 'bilan'; })[0], cf = confreresDe(x), h = tete(x, b ? b.titre : 'Bilan') + '<div class="cz-f-corps">';
    if (!b) return h + '<p class="dz-vide-d">Le bilan de ce chantier n’est pas programmé : ouvrez « Les tâches » du chantier réceptionné et choisissez « Programmer les rappels ».</p>' + htmlFlash(true) + '</div>';
    h += '<div class="cz-f-ouv"><div><p class="dz-kicker">Réception du chantier</p><p class="cz-f-ouv-d">' + esc(maj(D.jourLong(c.recuLe))) + '<span> · bilan prévu ' + esc(C.quandRappel(b)) + '</span></p></div></div>';
    if (b.fait) h += '<p class="cz-pet ok">Ce bilan est noté. Vous pouvez encore ajouter un confrère ci-dessous.</p>';
    else if (!b.retire) h += '<div class="cz-f-form"><div class="dz-champ"><label for="cz-bi-note">Ce que dit le pharmacien de ses premiers mois</label><textarea id="cz-bi-note" data-form="bi_note" maxlength="600" placeholder="Par exemple : le comptoir est apprécié, il manque un rayonnage dans la réserve."' + dis() + '>' + esc(val('bi_note')) + '</textarea></div>' +
      '<div class="dz-act"><button class="dz-btn petit" type="button" data-cz="bilan-fait" data-id="' + esc(b.id) + '" data-f="bilan-fait"' + dis() + '>' + ico('coche', 18) + 'Noter le bilan comme fait</button></div></div>';
    h += '<section class="cz-cf" aria-labelledby="cz-cf-h"><p class="dz-kicker cz-rv-k"><i></i>Au bilan</p><h3 id="cz-cf-h" class="cz-cf-h">Un confrère qui a un projet ?</h3>' +
      '<p class="cz-rv-i">Un pharmacien qui déménage, s’agrandit ou veut un robot. Donnez son nom : la téléprospectrice l’appellera en vous citant.</p>' +
      '<div class="cz-f-form cz-cf-form"><div class="dz-champ"><label for="cz-cf-nom">Nom de la pharmacie</label><input id="cz-cf-nom" type="text" data-form="cf_nom" data-f="cf-nom" maxlength="120" autocomplete="off" value="' + esc(val('cf_nom')) + '" placeholder="Par exemple : Pharmacie des Hauts Frênes"' + dis() + '></div>' +
      '<div class="dz-champ"><label for="cz-cf-ville">Ville</label><input id="cz-cf-ville" type="text" data-form="cf_ville" data-f="cf-ville" maxlength="80" autocomplete="off" value="' + esc(val('cf_ville')) + '" placeholder="Par exemple : Brest"' + dis() + '></div>' +
      '<div class="dz-champ"><label for="cz-cf-note">Une note (facultatif)</label><textarea id="cz-cf-note" data-form="cf_note" maxlength="300" placeholder="Par exemple : il parle de s’agrandir l’an prochain."' + dis() + '>' + esc(val('cf_note')) + '</textarea></div>' +
      '<p class="dz-erreur" role="alert">' + esc(S.ui.errConfrere || '') + '</p>' +
      '<div class="dz-act"><button class="dz-btn plein" type="button" data-cz="confrere-ajout" data-f="confrere-ajout"' + dis() + '>' + ico('plus', 18) + 'Ajouter à la liste de la téléprospectrice</button></div></div>';
    if (cf.length) h += '<div class="cz-cf-ok" role="status"><span class="cz-cf-coche">' + ico('coche', 20) + '</span><div><p class="cz-cf-ok-t">Elle l’appellera avec : <b>' + esc(C.phraseDeLaPart(x.ph.dossier.nom)) + '</b>.</p><ul class="cz-cf-liste">' +
      cf.map(function (f) { return '<li><div><b>' + esc(f.nom) + '</b> · ' + esc(f.ville) + (f.note ? '<small>' + esc(f.note) + '</small>' : '') + '</div><button class="dz-lien" type="button" data-cz="confrere-retirer" data-id="' + esc(f.id) + '"' + dis() + '>Retirer de la liste</button></li>'; }).join('') + '</ul></div></div>';
    return h + '</section>' + htmlFlash(true) + '</div>';
  }
  function htmlFlash(dansFeuille) {
    if (!S.flash || (!!dansFeuille !== !!(S.fc && feuille() && feuille().open))) return '';
    return '<p class="dz-flash cz-flash' + (S.flashErr ? ' dz-err' : '') + '" role="status">' + esc(S.flash) + '</p>';
  }
  function htmlListe() {
    if (!S.charge && !S.erreur) return '<div class="dz-vide"><p>Vos chantiers arrivent…</p></div>';
    if (S.erreur) return '<div class="dz-tete"><div class="dz-tete-g"><h1>Chantiers</h1></div></div><div class="dz-vide"><p>Vos chantiers ne se sont pas affichés.</p><p>Réessayez dans un instant.</p><button type="button" class="dz-btn plein" data-cz="reessayer">Réessayer</button></div>';
    var l = tous(), cours = C.trierEnCours(l.map(function (x) { return x.c; }).filter(function (c) { return !c.recuLe; })), recus = C.trierRecus(l.map(function (x) { return x.c; }).filter(function (c) { return c.recuLe; }));
    var parId = {}; l.forEach(function (x) { parId[x.c.id] = x; });
    var prets = C.prets(pharmacies(), S.chantiers.map(function (c) { return c.volet_id; }));
    var h = '<div class="dz-tete"><div class="dz-tete-g"><h1>Chantiers</h1><p>Ce qui reste à faire, qui doit venir, et l’ouverture promise au pharmacien. L’ouverture la plus proche passe en premier.</p><p class="dz-compte">' + esc(C.phraseCompte(cours, auj())) + '</p></div>' +
      (prets.length ? '<button class="dz-btn" type="button" data-cz="vers-prets">' + ico('plus', 18) + 'Ouvrir un chantier</button>' : '') + '</div>';
    h += htmlFlash(false);
    if (!l.length && !prets.length) {
      return h + '<div class="dz-vide"><p>Aucun chantier pour l’instant.</p><p>Un chantier s’ouvre depuis l’étape « Travaux » d’un dossier Agencement ou Transfert.</p><button type="button" class="dz-btn plein" data-vers="dossiers">Ouvrir les dossiers</button></div>';
    }
    h += '<section class="dz-groupe"><div class="dz-groupe-t"><h2>En cours</h2><span>' + pl(cours.length, 'chantier', 'chantiers') + '</span></div>' +
      (cours.length ? '<div class="dz-grille cz-grille">' + cours.map(function (c) { return carte(parId[c.id]); }).join('') + '</div>' : '<p class="dz-vide-d">Aucun chantier en cours. Ouvrez-en un depuis l’étape « Travaux » d’un dossier.</p>') + '</section>';
    var bilans = S.sansRappels ? [] : recus.map(function (c) { var b = C.bilanAFaire(rappelsDe(parId[c.id])); return b ? { x: parId[c.id], b: b } : null; }).filter(Boolean);
    if (bilans.length) h += '<section class="dz-groupe" id="cz-bilans"><div class="dz-groupe-t"><h2>Bilans à faire</h2><span>' + pl(bilans.length, 'bilan', 'bilans') + '</span></div><div class="dz-grille cz-grille">' +
      bilans.map(function (o) { return carteBilan(o.x, o.b); }).join('') + '</div></section>';
    if (prets.length) h += '<section class="dz-groupe" id="cz-prets"><div class="dz-groupe-t"><h2>Prêts pour un chantier</h2><span>' + pl(prets.length, 'dossier', 'dossiers') + '</span></div>' +
      '<p class="cz-intro">Un chantier s’ouvre depuis l’étape « Travaux » d’un dossier Agencement ou Transfert. Ces dossiers en sont à une étape au plus.</p><div class="dz-grille">' + prets.map(cartePret).join('') + '</div></section>';
    if (recus.length) h += '<details class="dz-repli"><summary>Réceptionnés <span class="dz-n">' + pl(recus.length, 'chantier', 'chantiers') + '</span><i class="dz-chev"></i></summary><div class="dz-repli-c"><div class="dz-grille">' +
      recus.map(function (c) { return carteRecue(parId[c.id]); }).join('') + '</div></div></details>';
    return h;
  }

  /* ── les feuilles ── */
  function feuille() { return S.racine && S.racine.querySelector('#cz-feuille'); }
  function tete(x, kick) {
    return '<div class="cz-f-tete"><div class="cz-f-tete-g"><p class="dz-kicker">' + kick + '</p><h2 id="cz-f-titre" tabindex="-1">' + esc(x.ph.dossier.nom) + '</h2></div><button class="dz-btn petit" type="button" data-cz="fermer">Fermer</button></div>';
  }
  function val(k, d) { return S.form[k] != null ? S.form[k] : (d || ''); }
  function options(c, sel) {
    return '<option value="">Pas encore confiée</option>' + c.artisans.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.nom) + '</option>'; }).join('');
  }
  function vign(c, t) {
    var ph = t.photos.length ? t.photos[t.photos.length - 1] : null;
    if (ph) {
      var u = S.urls[ph.chemin] && S.urls[ph.chemin].url;
      return '<span class="cz-vg" data-vign="' + esc(t.id) + '">' + (u ? '<a class="cz-vign" href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="Photo : ' + esc(t.titre) + '"><span class="dz-sr"> (s’ouvre dans un nouvel onglet)</span></a>'
        : '<span class="cz-vign cz-vign-att" role="img" aria-label="Photo : ' + esc(t.titre) + '">' + ico('photo', 20) + '</span>') + '</span>';
    }
    if (c.recuLe) return '<span class="cz-vg" aria-hidden="true"></span>';
    return '<label class="cz-ph-btn" for="cz-ph-' + esc(t.id) + '" title="Ajouter une photo">' + ico('photo', 22) + '<span class="dz-sr">Ajouter une photo : ' + esc(t.titre) + '</span>' +
      '<input class="dz-sr" id="cz-ph-' + esc(t.id) + '" type="file" accept="image/*" data-photo="' + esc(t.id) + '"' + dis() + '></label>';
  }
  function ligne(c, t) {
    var q = C.quand(t, auj()), fini = !!c.recuLe;
    return '<li class="cz-tache' + (t.fait ? ' fait' : '') + (q.retard ? ' ret' : '') + '"><button class="cz-coche" type="button" data-cz="coche" data-id="' + esc(t.id) + '" data-f="k-' + esc(t.id) + '" aria-pressed="' + !!t.fait + '" aria-label="' + esc(t.titre) +
      (t.fait ? ' : faite, cliquer pour la remettre à faire' : ' : à faire, cliquer pour la cocher') + '"' + (fini ? ' disabled' : dis()) + '>' + ico('coche', 22) + '</button>' +
      '<div class="cz-tache-t"><b>' + esc(t.titre) + '</b><div class="cz-tache-s">' +
      (t.fait || fini ? '<span>' + esc(C.nomArtisan(c, t)) + '</span>' : '<label class="dz-sr" for="cz-cf-' + esc(t.id) + '">Confiée à</label><select id="cz-cf-' + esc(t.id) + '" data-confier="' + esc(t.id) + '" data-f="cf-' + esc(t.id) + '" class="' + (t.art ? '' : 'vide') + '"' + dis() + '>' + options(c, t.art) + '</select>') +
      '<span class="cz-tache-d' + (q.retard ? ' ret' : '') + '">' + esc(q.texte) + '</span></div></div>' + vign(c, t) + '</li>';
  }
  function feuilleTaches(x) {
    var c = x.c, a = auj(), reste = C.aFaire(c), faites = C.faites(c), n = c.taches.length, j = C.jours(c, a);
    var h = tete(x, 'Chantier · volet ' + esc(x.volet.nom)) + '<div class="cz-f-corps">';
    if (c.recuLe && !S.sansRappels) h += (S.ui.justeRecu ? '<p class="cz-rv-ok" role="status"><span class="cz-cf-coche">' + ico('coche', 20) + '</span>Réception prononcée. Voici ce que ce chantier programme pour la suite.</p>' : '') + blocReviendra(x);
    h += '<div class="cz-f-ouv"><div><p class="dz-kicker">Ouverture promise au pharmacien</p><p class="cz-f-ouv-d">' + esc(maj(D.jourLong(c.ouverture))) + '<span> · ' + C.dans(j) + '</span></p></div>' +
      (c.recuLe ? '' : '<button class="dz-lien" type="button" data-cz="ouv-changer"' + dis() + '>Changer la date</button>') + '</div>';
    if (S.ui.ouv) h += '<div class="cz-f-form"><div class="dz-champ"><label for="cz-ouv-in">Nouvelle date d’ouverture</label><input type="date" id="cz-ouv-in" data-form="ouv" value="' + esc(val('ouv', c.ouverture)) + '"' + dis() + '></div>' +
      '<div class="dz-act"><button class="dz-btn plein petit" type="button" data-cz="ouv-ok"' + dis() + '>Enregistrer la date</button><button class="dz-lien" type="button" data-cz="ouv-annuler"' + dis() + '>Annuler</button></div></div>';
    h += segments(c) + '<p class="cz-nn">' + (n ? C.nbFaites(c) + ' sur ' + n + ' tâches faites' : 'Aucune tâche pour l’instant') + (c.recuLe ? ' · réception le ' + esc(D.court(c.recuLe)) : '') + '</p>';
    if (!c.recuLe) {
      h += '<h3 class="cz-f-h">À faire <span>' + reste.length + '</span></h3>' + (reste.length ? '<ol class="cz-taches">' + reste.map(function (t) { return ligne(c, t); }).join('') + '</ol>' : '<p class="dz-vide-d">Toutes les tâches sont cochées.</p>');
      h += '<details class="cz-f-ajout" data-ajout="tache"' + (S.ui.ajoutTache || !n ? ' open' : '') + '><summary>' + ico('plus', 18) + 'Ajouter une tâche</summary><div class="cz-f-form">' +
        '<div class="dz-champ"><label for="cz-nt-titre">La tâche</label><input id="cz-nt-titre" type="text" data-form="nt_titre" data-f="nt-titre" maxlength="200" value="' + esc(val('nt_titre')) + '" placeholder="Par exemple : pose du rayonnage de la réserve"' + dis() + '></div>' +
        '<div class="cz-f-deux"><div class="dz-champ"><label for="cz-nt-art">Confiée à</label><select id="cz-nt-art" data-form="nt_art"' + dis() + '>' + options(c, val('nt_art')) + '</select></div>' +
        '<div class="dz-champ"><label for="cz-nt-date">Prévue le</label><input id="cz-nt-date" type="date" data-form="nt_date" value="' + esc(val('nt_date')) + '"' + dis() + '></div></div>' +
        '<p class="dz-erreur" role="alert">' + esc(S.ui.errTache || '') + '</p>' +
        '<div class="dz-act"><button class="dz-btn plein petit" type="button" data-cz="ajout-tache" data-f="ajout-tache"' + dis() + '>' + ico('plus', 18) + 'Ajouter la tâche</button></div></div></details>';
    }
    if (faites.length) h += '<details class="dz-repli cz-f-faites"' + (c.recuLe || S.ui.faitesOuvert ? ' open' : '') + ' data-faites><summary>Déjà faites <span class="dz-n">' + faites.length + '</span><i class="dz-chev"></i></summary><div class="dz-repli-c"><ol class="cz-taches">' +
      faites.map(function (t) { return ligne(c, t); }).join('') + '</ol></div></details>';
    if (!c.recuLe) {
      h += '<div class="cz-f-recep">';
      if (S.ui.recep) {
        h += '<div class="cz-confirme" role="alertdialog" aria-labelledby="cz-cf-t"><p id="cz-cf-t"><b>Prononcer la réception du chantier ?</b></p><p>Le chantier passe dans « Réceptionnés », et ' + C.texteReception(x.volet.sorte) + '.</p>' +
          (reste.length ? '<p class="ret">Attention : ' + pl(reste.length, 'tâche n’est pas cochée', 'tâches ne sont pas cochées') + '.</p>' : '') +
          '<div class="dz-act"><button class="dz-btn plein petit" type="button" data-cz="recep-ok" data-f="recep-ok"' + dis() + '>Oui, prononcer la réception</button><button class="dz-lien" type="button" data-cz="recep-annuler"' + dis() + '>Annuler</button></div></div>';
      } else {
        h += '<button class="dz-btn' + (reste.length ? '' : ' plein') + '" type="button" data-cz="recep" data-f="recep"' + dis() + '>' + ico('coche', 18) + 'Prononcer la réception du chantier</button><p class="cz-pet">' +
          (reste.length ? 'Il reste ' + pl(reste.length, 'tâche', 'tâches') + ' à cocher.' : 'Toutes les tâches sont cochées : la réception peut se prononcer avec le pharmacien.') + '</p>';
      }
      h += '</div>';
    }
    return h + htmlFlash(true) + '</div>';
  }
  function feuilleArtisans(x) {
    var c = x.c, nc = c.taches.filter(function (t) { return !t.fait && !t.art; }).length;
    var h = tete(x, 'Chantier · Les artisans') + '<div class="cz-f-corps"><p class="cz-f-intro">Les entreprises qui interviennent sur ce chantier, et ce qui leur est confié.</p>';
    if (!c.artisans.length) h += '<p class="dz-vide-d">Aucun artisan pour l’instant.</p>';
    h += '<ul class="cz-arts">' + c.artisans.map(function (a) {
      var ts = c.taches.filter(function (t) { return t.art === a.id; }), rs = ts.filter(function (t) { return !t.fait; }), lien = C.lienTel(a.tel);
      var li = '<li class="cz-art"><div class="cz-art-t"><b>' + esc(a.nom) + '</b><span>' + esc(C.metierAffiche(a)) + (lien ? ' · <a href="' + esc(lien) + '">' + esc(a.tel) + '</a>' : ' · pas de numéro') + '</span>' +
        '<span class="cz-pet">' + (ts.length ? pl(ts.length, 'tâche', 'tâches') + (rs.length ? ' · ' + rs.length + ' à faire' : ' · tout est fait') : 'Aucune tâche confiée') + '</span></div>';
      if (S.ui.retirer === a.id) li += '<div class="cz-confirme" role="alertdialog" aria-labelledby="cz-ra-' + esc(a.id) + '"><p id="cz-ra-' + esc(a.id) + '"><b>Retirer ' + esc(a.nom) + ' du chantier ?</b></p><p>' +
        (rs.length ? 'Ses ' + pl(rs.length, 'tâche à faire redevient', 'tâches à faire redeviennent') + ' « pas encore confiées ».' : 'Aucune tâche à faire ne lui est confiée.') + '</p>' +
        '<div class="dz-act"><button class="dz-btn plein petit" type="button" data-cz="retirer-ok" data-id="' + esc(a.id) + '" data-f="retirer-ok"' + dis() + '>Oui, retirer</button><button class="dz-lien" type="button" data-cz="retirer-annuler"' + dis() + '>Annuler</button></div></div>';
      else if (!c.recuLe) li += '<button class="dz-lien" type="button" data-cz="retirer" data-id="' + esc(a.id) + '"' + dis() + '>Retirer</button>';
      return li + '</li>';
    }).join('') + '</ul>';
    if (nc && !c.recuLe) h += '<p class="cz-pet">' + pl(nc, 'tâche à faire n’est pas encore confiée', 'tâches à faire ne sont pas encore confiées') + (nc > 1 ? ' : on les confie' : ' : on la confie') + ' dans « Les tâches ».</p>';
    if (!c.recuLe) h += '<details class="cz-f-ajout" data-ajout="artisan"' + (S.ui.ajoutArtisan || !c.artisans.length ? ' open' : '') + '><summary>' + ico('plus', 18) + 'Ajouter un artisan</summary><div class="cz-f-form">' +
      '<div class="dz-champ"><label for="cz-na-nom">Nom de l’entreprise</label><input id="cz-na-nom" type="text" data-form="na_nom" data-f="na-nom" maxlength="200" autocomplete="organization" value="' + esc(val('na_nom')) + '"' + dis() + '></div>' +
      '<div class="cz-f-deux"><div class="dz-champ"><label for="cz-na-met">Métier</label><input id="cz-na-met" type="text" data-form="na_met" maxlength="200" value="' + esc(val('na_met')) + '" placeholder="Par exemple : plomberie"' + dis() + '></div>' +
      '<div class="dz-champ"><label for="cz-na-tel">Téléphone (facultatif)</label><input id="cz-na-tel" type="tel" data-form="na_tel" maxlength="40" autocomplete="tel" value="' + esc(val('na_tel')) + '"' + dis() + '></div></div>' +
      '<p class="dz-erreur" role="alert">' + esc(S.ui.errArtisan || '') + '</p>' +
      '<div class="dz-act"><button class="dz-btn plein petit" type="button" data-cz="ajout-art" data-f="ajout-art"' + dis() + '>' + ico('plus', 18) + 'Ajouter l’artisan</button></div></div></details>';
    return h + htmlFlash(true) + '</div>';
  }
  function rendreFeuille() {
    var F = feuille(); if (!F || !S.fc) return;
    var x = un(S.fc); if (!x) { fermer(); return; }
    var act = document.activeElement, cle = act && F.contains(act) && act.getAttribute ? act.getAttribute('data-f') : null, y = F.scrollTop;
    F.innerHTML = S.mode === 'artisans' ? feuilleArtisans(x) : S.mode === 'bilan' ? feuilleBilan(x) : feuilleTaches(x);
    F.scrollTop = y;
    if (cle) { var n = F.querySelector('[data-f="' + cle + '"]'); if (n && !n.disabled) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
    if (S.mode === 'taches') lireUrls(x.c);
  }
  function ouvrirFeuille(id, mode) {
    var F = feuille(); if (!F || !un(id)) return;
    S.fc = id; S.mode = mode; S.ui = {}; S.form = {}; S.flash = '';
    rendreFeuille();
    if (!F.open) { try { F.showModal(); } catch (e) { F.setAttribute('open', ''); } }
    F.scrollTop = 0;
    var h2 = F.querySelector('h2'); if (h2) try { h2.focus({ preventScroll: true }); } catch (e) { h2.focus(); }
  }
  function fermer() { var F = feuille(); if (F && F.open) { try { F.close(); } catch (e) { F.removeAttribute('open'); } } S.fc = null; S.mode = null; S.ui = {}; S.form = {}; }
  /* Les vignettes : adresses signées demandées à l'ouverture de la feuille (10 minutes), posées sans redessiner la feuille. */
  function lireUrls(c) {
    var base = sb(), maintenant = Date.now(); if (!base) return;
    var manque = c.taches.map(function (t) { return t.photos.length ? t.photos[t.photos.length - 1].chemin : null; })
      .filter(function (ch) { return ch && !(S.urls[ch] && maintenant - S.urls[ch].at < 540000); });
    if (!manque.length) return;
    base.storage.from('dossiers').createSignedUrls(manque, 600).then(function (r) {
      if (r.error || !r.data) return;
      r.data.forEach(function (o) { if (o.signedUrl && o.path) S.urls[o.path] = { url: o.signedUrl, at: Date.now() }; });
      var F = feuille(), x = un(S.fc); if (!F || !x) return;
      x.c.taches.forEach(function (t) {
        var n = F.querySelector('[data-vign="' + t.id + '"]'); if (!n) return;
        var tmp = document.createElement('div'); tmp.innerHTML = vign(x.c, t); n.replaceWith(tmp.firstChild);
      });
    }, function () {});
  }

  /* ── dessin ── */
  function reservee() {
    return '<section class="pa pa-attente" aria-label="Chantiers">' + X.tete('Chantiers', 'Ce qui se monte cette semaine, et ce qui bloque.') +
      '<div class="pa-vide"><p>Cet écran est réservé à Yann. Vos outils sont les Appels, l’Agenda et la Veille.</p><div class="pa-bs">' +
      '<button type="button" class="lg-gros" data-vers="appels">Ouvrir mes Appels</button><button type="button" class="pa-b" data-vers="agenda">Ouvrir l’Agenda</button></div></div></section>';
  }
  function dessiner() {
    var r = S.racine; if (!r || !V2.route || V2.route.name !== 'chantiers') return;
    if (S.telepro) { r.innerHTML = X.cadre(reservee()); return; }
    if (!S.roleConnu) { r.innerHTML = X.cadre('<section class="pa dz cz" aria-label="Chantiers"><div class="dz-vide"><p>Un instant…</p></div></section>'); return; }
    var pg = r.querySelector('#cz-pg');
    if (!pg) {
      r.innerHTML = X.cadre('<section class="pa dz cz" aria-label="Chantiers"><div id="cz-pg"></div><dialog class="cz-feuille" id="cz-feuille" aria-labelledby="cz-f-titre"></dialog></section>');
      pg = r.querySelector('#cz-pg');
      var F = feuille();
      F.addEventListener('click', function (ev) { if (ev.target === F) fermer(); });
      F.addEventListener('close', function () { if (F.open) return; /* refermée puis rouverte aussitôt : l'avis de fermeture arrive après la réouverture */ S.fc = null; S.mode = null; S.ui = {}; S.form = {}; S.flash = ''; var p = r.querySelector('#cz-pg'); if (p) p.innerHTML = htmlListe(); });
    }
    var act = document.activeElement, cle = act && pg.contains(act) && act.getAttribute ? act.getAttribute('data-f') : null;
    pg.innerHTML = htmlListe();
    if (cle) { var n = pg.querySelector('[data-f="' + cle + '"]'); if (n) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
    if (S.fc) rendreFeuille();
  }
  function dire(t, err) {
    S.flash = t; S.flashErr = !!err; clearTimeout(S.tFlash);
    if (!err) S.tFlash = setTimeout(function () { S.flash = ''; var n = S.racine && S.racine.querySelectorAll('.cz-flash'); if (n) Array.prototype.forEach.call(n, function (x) { x.remove(); }); }, 5000);
  }

  /* ── écritures ── */
  function echec(m) { var e = new Error(m); e.dit = true; return e; }
  function geste(fn) {
    if (S.occupe) return Promise.resolve();
    S.occupe = true; S.flash = ''; dessiner();
    return Promise.resolve().then(fn).then(null, function (e) { dire(e && e.dit ? e.message : PAS, true); })
      .then(function () { S.occupe = false; dessiner(); });
  }
  function remplacer(liste, ligne) {
    var i = -1; liste.forEach(function (x, k) { if (x.id === ligne.id) i = k; });
    if (i >= 0) liste[i] = ligne; else liste.push(ligne);
  }
  function maj1(table, liste, id, champs) {
    var o = {}; Object.keys(champs).forEach(function (k) { o[k] = champs[k]; });
    if (table !== 'chantier_artisans' && table !== 'chantier_confreres') o.updated_at = new Date().toISOString();
    return sb().from(table).update(o).eq('id', id).select().single().then(function (r) {
      if (r.error || !r.data) throw new Error(table);
      remplacer(liste, r.data); return r.data;
    });
  }
  function tache(id) { var x = un(S.fc); return x && x.c.taches.filter(function (t) { return t.id === id; })[0]; }
  function cocher(id) {
    var t = tache(id), x = un(S.fc); if (!t || !x || x.c.recuLe) return;
    var fait = t.fait ? null : auj();
    return geste(function () {
      return maj1('chantier_taches', S.taches, id, { fait: fait }).then(function () { dire(fait ? 'C’est noté : « ' + t.titre + ' » est faite.' : '« ' + t.titre + ' » est remise à faire.', false); });
    });
  }
  function confier(id, aid) {
    var t = tache(id), x = un(S.fc); if (!t || !x) return;
    return geste(function () {
      return maj1('chantier_taches', S.taches, id, { artisan_id: aid || null }).then(function () {
        var a = aid && C.artisan(x.c, aid);
        dire(a ? '« ' + t.titre + ' » est confiée à ' + a.nom + '.' : '« ' + t.titre + ' » n’est plus confiée.', false);
      });
    });
  }
  function changerOuverture() {
    var x = un(S.fc), v = String(val('ouv', x && x.c.ouverture)); if (!x) return;
    if (!D.estJour(v)) { dire('Choisissez une date.', true); rendreFeuille(); return; }
    return geste(function () {
      return maj1('chantiers', S.chantiers, x.c.id, { ouverture: v }).then(function () { S.ui.ouv = 0; delete S.form.ouv; dire('Date d’ouverture enregistrée : ' + D.jourLong(v) + '.', false); });
    });
  }
  function ajouterTache() {
    var x = un(S.fc), u = V2.user; if (!x || !u) return;
    var ti = C.verifierTitre(val('nt_titre')), dt = String(val('nt_date')), aid = String(val('nt_art'));
    S.ui.ajoutTache = 1;
    if (!ti.ok) { S.ui.errTache = ti.erreur; rendreFeuille(); var n = feuille().querySelector('#cz-nt-titre'); if (n) n.focus(); return; }
    if (dt && !D.estJour(dt)) { S.ui.errTache = 'Cette date ne semble pas juste.'; rendreFeuille(); return; }
    S.ui.errTache = '';
    return geste(function () {
      return sb().from('chantier_taches').insert({ chantier_id: x.c.id, user_id: u.id, titre: ti.valeur, artisan_id: aid || null, prevue: dt || null, ordre: C.ordreSuivant(x.c) }).select().single().then(function (r) {
        if (r.error || !r.data) throw new Error('tache');
        S.taches.push(r.data); S.form.nt_titre = ''; S.form.nt_date = ''; S.form.nt_art = '';
        dire('Tâche ajoutée : « ' + ti.valeur + ' ».', false);
      });
    });
  }
  function receptionner() {
    var x = un(S.fc); if (!x || x.c.recuLe) return;
    var a = auj(), sorte = x.volet.sorte, lignes = C.lignesReception(x.volet, a);
    return geste(function () {
      return maj1('chantiers', S.chantiers, x.c.id, { recu_le: a }).then(function () {
        S.ui.recep = 0;
        return Promise.all(lignes.map(function (l) {
          l.updated_at = new Date().toISOString();
          return sb().from('dossier_etapes').upsert(l, { onConflict: 'volet_id,cle' }).select().single().then(function (r) {
            if (r.error || !r.data) throw new Error('etape');
            remplacer(S.etapes, r.data);
          });
        })).then(function () {
          var msg = 'Réception prononcée : le chantier passe dans « Réceptionnés », et ' + C.texteReception(sorte) + '.';
          if (S.sansRappels) { dire(msg, false); return; }
          S.ui.justeRecu = 1;
          return ecrireRappels(un(S.fc)).then(function (n) {
            dire(msg + ' ' + (n > 1 ? n + ' rappels sont programmés pour la suite.' : n === 1 ? 'Un rappel est programmé pour la suite.' : ''), false);
          }, function () {
            throw echec('La réception est prononcée, mais les rappels n’ont pas pu être programmés : ouvrez le chantier réceptionné et choisissez « Programmer les rappels ».');
          });
        }, function () {
          throw echec('La réception est prononcée, mais le dossier n’a pas pu être mis à jour : marquez « Travaux » comme faite dans le dossier.');
        });
      });
    });
  }
  /* L4 : programme (écrit) les rappels d'un chantier réceptionné qui n'en a pas encore. Rend le nombre écrit. Les échéances se CALCULENT depuis la date de réception. */
  function ecrireRappels(x) {
    var u = V2.user; if (!x || !x.c.recuLe || !u) return Promise.resolve(0);
    var l = C.rappelsAProgrammer(x, C.robotDePharmacie(x.ph), rappelsDe(x));
    if (!l.length) return Promise.resolve(0);
    l.forEach(function (r) { r.user_id = u.id; });
    return sb().from('chantier_rappels').insert(l).select().then(function (r) {
      if (r.error || !r.data) throw new Error('rappels');
      r.data.forEach(function (ligne) { remplacer(S.rappels, ligne); });
      return r.data.length;
    });
  }
  function programmerRappels() {
    var x = un(S.fc); if (!x || !x.c.recuLe) return;
    return geste(function () {
      return ecrireRappels(x).then(function (n) {
        S.ui.justeRecu = 1;
        dire(n ? (n > 1 ? n + ' rappels sont programmés.' : 'Un rappel est programmé.') + ' Ceux dont la date est passée arrivent dès demain matin dans la liste.' : 'Les rappels étaient déjà programmés.', false);
      });
    });
  }
  function rappel(id) { return S.rappels.filter(function (r) { return r.id === id; })[0] || null; }
  function majRappel(id, champs, msg) {
    var r = rappel(id), m = r && C.monterRappel(r, auj()); if (!r) return;
    return geste(function () {
      return maj1('chantier_rappels', S.rappels, id, champs).then(function () { S.ui.rdate = null; S.ui.rretirer = null; delete S.form.rap_date; dire(typeof msg === 'function' ? msg(m) : msg, false); });
    });
  }
  function changerDateRappel(id) {
    var r = rappel(id); if (!r) return;
    var v = C.verifierDateRappel(val('rap_date', r.echeance), auj());
    if (!v.ok) { S.ui.rdate = id; S.ui.errRappel = v.erreur; rendreFeuille(); return; }
    S.ui.errRappel = '';
    return majRappel(id, { echeance: v.valeur }, function (m) { return 'Date changée : « ' + m.titre + ' » arrivera ' + C.quandRappel({ type: m.type, date: v.valeur }) + '.'; });
  }
  function noterBilanFait(id) {
    var r = rappel(id); if (!r) return;
    var note = String(val('bi_note')).trim().slice(0, 600);
    return majRappel(id, { fait_le: auj(), note: note || null }, 'Bilan noté : il sort de la liste de la téléprospectrice.');
  }
  function ajouterConfrere() {
    var x = un(S.fc), u = V2.user; if (!x || !u) return;
    var v = C.verifierConfrere({ nom: val('cf_nom'), ville: val('cf_ville'), note: val('cf_note') }, C.confreresDuChantier(S.confreres, x.c.id));
    if (!v.ok) { S.ui.errConfrere = v.erreur; rendreFeuille(); var n = feuille().querySelector(v.champ === 'ville' ? '#cz-cf-ville' : '#cz-cf-nom'); if (n) n.focus(); return; }
    S.ui.errConfrere = '';
    return geste(function () {
      return sb().from('chantier_confreres').insert({ chantier_id: x.c.id, user_id: u.id, nom: v.valeur.nom, ville: v.valeur.ville, note: v.valeur.note, par: String(x.ph.dossier.nom || '').trim().slice(0, 120) }).select().single().then(function (r) {
        if (r.error || !r.data) throw new Error('confrere');
        S.confreres.push(r.data); S.form.cf_nom = ''; S.form.cf_ville = ''; S.form.cf_note = '';
        dire('Ajouté à la liste de la téléprospectrice : elle l’appellera avec « ' + C.phraseDeLaPart(x.ph.dossier.nom) + ' ».' + (v.alerte ? ' ' + v.alerte : ''), !!v.alerte);
      });
    }).then(function () { var ok = feuille() && feuille().querySelector('.cz-cf-ok'); if (ok && ok.scrollIntoView) ok.scrollIntoView({ block: 'nearest' }); });
  }
  function retirerConfrere(id) {
    var f = S.confreres.filter(function (r) { return r.id === id; })[0]; if (!f) return;
    return geste(function () {
      return maj1('chantier_confreres', S.confreres, id, { retire_le: auj() }).then(function () { dire(f.nom + ' est retiré de la liste de la téléprospectrice.', false); });
    });
  }
  function retirerArtisan(aid) {
    var x = un(S.fc), a = x && C.artisan(x.c, aid); if (!x || !a) return;
    return geste(function () {
      return maj1('chantier_artisans', S.artisans, aid, { retire_le: auj() }).then(function () {
        S.ui.retirer = null;
        return sb().from('chantier_taches').update({ artisan_id: null, updated_at: new Date().toISOString() }).eq('chantier_id', x.c.id).eq('artisan_id', aid).is('fait', null).select().then(function (r) {
          if (r.error) throw echec(a.nom + ' est retiré du chantier, mais ses tâches à faire n’ont pas pu être libérées : confiez-les à nouveau dans « Les tâches ».');
          (r.data || []).forEach(function (l) { remplacer(S.taches, l); });
          dire(a.nom + ' est retiré du chantier.', false);
        });
      });
    });
  }
  function ajouterArtisan() {
    var x = un(S.fc), u = V2.user; if (!x || !u) return;
    var v = C.verifierArtisan({ nom: val('na_nom'), metier: val('na_met'), tel: val('na_tel') });
    S.ui.ajoutArtisan = 1;
    if (!v.ok) { S.ui.errArtisan = v.erreur; rendreFeuille(); var n = feuille().querySelector('#cz-na-nom'); if (n && !String(val('na_nom')).trim()) n.focus(); return; }
    S.ui.errArtisan = '';
    return geste(function () {
      return sb().from('chantier_artisans').insert({ chantier_id: x.c.id, user_id: u.id, nom: v.valeur.nom, metier: v.valeur.metier, tel: v.valeur.tel }).select().single().then(function (r) {
        if (r.error || !r.data) throw new Error('artisan');
        S.artisans.push(r.data); S.form.na_nom = ''; S.form.na_met = ''; S.form.na_tel = '';
        dire(v.valeur.nom + ' est ajouté au chantier.', false);
      });
    });
  }
  /* Une photo de téléphone pèse 3 à 5 Mo : réduite sur place (grand côté à 1 600 points, JPEG) avant l'envoi. Si l'image ne se lit pas, elle part telle quelle. */
  function reduire(f) {
    return new Promise(function (ok) {
      var url, img = new Image();
      try { url = URL.createObjectURL(f); } catch (e) { ok(f); return; }
      img.onload = function () {
        var t = C.tailleReduite(img.naturalWidth, img.naturalHeight);
        if (!t.l || (t.l === img.naturalWidth && f.size < 900 * 1024 && /jpe?g/.test(f.type))) { URL.revokeObjectURL(url); ok(f); return; }
        var cv = document.createElement('canvas'); cv.width = t.l; cv.height = t.h;
        try { cv.getContext('2d').drawImage(img, 0, 0, t.l, t.h); } catch (e) { URL.revokeObjectURL(url); ok(f); return; }
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { ok(b && b.size && b.size < f.size ? b : f); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(f); };
      img.src = url;
    });
  }
  function envoyerPhoto(id, f) {
    var x = un(S.fc), t = tache(id), u = V2.user, base = sb(); if (!x || !t || !u || !base) return;
    var m = C.verifierPhoto(f, t.photos.length); if (m) { dire(m, true); rendreFeuille(); return; }
    return geste(function () {
      return reduire(f).then(function (b) {
        var jpeg = b !== f, nom = jpeg ? String(f.name || 'photo').replace(/\.[^.]*$/, '') + '.jpg' : (f.name || 'photo.jpg');
        var chemin = C.cheminPhoto(u.id, x.ph.dossier.id, t.id, nom, Date.now());
        return base.storage.from('dossiers').upload(chemin, b, { contentType: jpeg ? 'image/jpeg' : (f.type || 'application/octet-stream'), upsert: false }).then(function (r) {
          if (r.error) throw new Error('envoi');
          return maj1('chantier_taches', S.taches, t.id, { photos: t.photos.concat([{ nom: String(f.name || nom), chemin: chemin, taille: b.size, ajoute: auj() }]) })
            .then(null, function (err) { try { base.storage.from('dossiers').remove([chemin]); } catch (e) {} throw err; });
        }).then(function () { dire('Photo ajoutée à « ' + t.titre + ' ».', false); });
      });
    });
  }

  /* ── gestes ── */
  function clic(ev) {
    var vers = ev.target.closest('[data-vers]'); if (vers) { fermer(); V2.go(vers.getAttribute('data-vers')); return; }
    var b = ev.target.closest('[data-cz]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-cz'), id = b.getAttribute('data-id');
    if (a === 'reessayer') { charger(); return; }
    if (a === 'taches' || a === 'artisans') { ouvrirFeuille(id, a); return; }
    if (a === 'bilan') { ouvrirFeuille(id, 'bilan'); return; }
    if (a === 'recep-carte') { ouvrirFeuille(id, 'taches'); S.ui.recep = 1; rendreFeuille(); var cf = feuille().querySelector('.cz-confirme'); if (cf && cf.scrollIntoView) cf.scrollIntoView({ block: 'nearest' }); return; }
    if (a === 'dossier') { fermer(); V2.go('dossiers', id + ':' + b.getAttribute('data-s') + ':travaux'); return; }
    if (a === 'vers-prets') { var p = S.racine.querySelector('#cz-prets'); if (p && p.scrollIntoView) { try { p.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { p.scrollIntoView(); } } return; }
    if (a === 'fermer') { fermer(); return; }
    if (!S.fc) return;
    if (a === 'coche') { cocher(id); return; }
    if (a === 'ouv-changer') { S.ui.ouv = 1; rendreFeuille(); var i0 = feuille().querySelector('#cz-ouv-in'); if (i0) i0.focus(); return; }
    if (a === 'ouv-annuler') { S.ui.ouv = 0; delete S.form.ouv; rendreFeuille(); return; }
    if (a === 'ouv-ok') { changerOuverture(); return; }
    if (a === 'ajout-tache') { ajouterTache(); return; }
    if (a === 'recep') { S.ui.recep = 1; rendreFeuille(); var c2 = feuille().querySelector('.cz-confirme'); if (c2 && c2.scrollIntoView) c2.scrollIntoView({ block: 'nearest' }); var o2 = feuille().querySelector('[data-f="recep-ok"]'); if (o2) try { o2.focus({ preventScroll: true }); } catch (e) {} return; }
    if (a === 'recep-annuler') { S.ui.recep = 0; rendreFeuille(); return; }
    if (a === 'recep-ok') { receptionner(); return; }
    if (a === 'retirer') { S.ui.retirer = id; rendreFeuille(); return; }
    if (a === 'retirer-annuler') { S.ui.retirer = null; rendreFeuille(); return; }
    if (a === 'retirer-ok') { retirerArtisan(id); return; }
    if (a === 'ajout-art') { ajouterArtisan(); return; }
    if (a === 'rap-programmer') { programmerRappels(); return; }
    if (a === 'rap-date') { S.ui.rdate = id; S.ui.rretirer = null; S.ui.errRappel = ''; rendreFeuille(); var di = feuille().querySelector('#cz-rd-' + id); if (di) di.focus(); return; }
    if (a === 'rap-retirer') { S.ui.rretirer = id; S.ui.rdate = null; rendreFeuille(); var ok0 = feuille().querySelector('[data-f="rap-retirer-ok"]'); if (ok0) try { ok0.focus({ preventScroll: true }); } catch (e) {} return; }
    if (a === 'rap-annuler') { S.ui.rdate = null; S.ui.rretirer = null; delete S.form.rap_date; rendreFeuille(); return; }
    if (a === 'rap-ok') { changerDateRappel(id); return; }
    if (a === 'rap-retirer-ok') { majRappel(id, { retire_le: auj() }, function (m) { return 'Rappel retiré : « ' + m.titre + ' » n’arrivera pas dans la liste de la téléprospectrice.'; }); return; }
    if (a === 'rap-remettre') { majRappel(id, { retire_le: null }, function (m) { return 'Rappel remis : « ' + m.titre + ' » arrivera ' + C.quandRappel(m) + '.'; }); return; }
    if (a === 'bilan-fait') { noterBilanFait(id); return; }
    if (a === 'confrere-ajout') { ajouterConfrere(); return; }
    if (a === 'confrere-retirer') { retirerConfrere(id); return; }
  }
  function saisie(ev) {
    var t = ev.target; if (!t.getAttribute) return;
    var k = t.getAttribute('data-form'); if (k) S.form[k] = t.value;
  }
  function change(ev) {
    var t = ev.target; if (!t.getAttribute) return;
    if (t.getAttribute('data-form')) { saisie(ev); return; }
    if (t.hasAttribute('data-confier')) { confier(t.getAttribute('data-confier'), t.value); return; }
    if (t.hasAttribute('data-photo')) { var f = t.files && t.files[0], id = t.getAttribute('data-photo'); t.value = ''; if (f) envoyerPhoto(id, f); }
  }
  /* Garder ouverts les volets « Ajouter » et « Déjà faites » d'un redessin à l'autre */
  function bascule(ev) {
    var d = ev.target; if (!d || !d.getAttribute) return;
    if (d.getAttribute('data-ajout') === 'tache') S.ui.ajoutTache = d.open ? 1 : 0;
    else if (d.getAttribute('data-ajout') === 'artisan') S.ui.ajoutArtisan = d.open ? 1 : 0;
    else if (d.hasAttribute('data-faites')) S.ui.faitesOuvert = d.open ? 1 : 0;
  }

  /* ── entrée ── */
  V2.pages.chantiers = { needs: [], render: function (root) {
    S.racine = root; S.voir = V2.route && V2.route.param ? String(V2.route.param) : null;
    S.fc = null; S.mode = null; S.ui = {}; S.form = {}; S.flash = ''; S.flashErr = false; S.occupe = false;
    root.innerHTML = '';
    if (!root.__cz) {
      root.__cz = true;
      root.addEventListener('click', function (ev) { if (V2.route && V2.route.name === 'chantiers') clic(ev); });
      root.addEventListener('input', function (ev) { if (V2.route && V2.route.name === 'chantiers') saisie(ev); });
      root.addEventListener('change', function (ev) { if (V2.route && V2.route.name === 'chantiers') change(ev); });
      root.addEventListener('toggle', function (ev) { if (V2.route && V2.route.name === 'chantiers') bascule(ev); }, true);
    }
    var tok = ++S.jeton;
    function suite() {
      if (tok !== S.jeton) return;
      S.telepro = false;
      charger().then(function () {
        if (!S.charge || !S.voir || !V2.route || V2.route.name !== 'chantiers') return;
        var el = S.racine.querySelector('#cz-c-' + S.voir); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
        if (un(S.voir)) ouvrirFeuille(S.voir, 'taches');
      });
    }
    if (window.PHIRST_ROLE) {
      S.charge = false; S.erreur = false; S.telepro = false; S.roleConnu = false; dessiner();
      window.PHIRST_ROLE.estTelepro().then(function (t) {
        if (tok !== S.jeton || !V2.route || V2.route.name !== 'chantiers') return;
        S.roleConnu = true;
        if (t) { S.telepro = true; dessiner(); return; }
        suite();
      }, function () { S.roleConnu = true; suite(); });
    } else { S.roleConnu = true; suite(); }
  } };
})();
