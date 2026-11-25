/* PHIRST · écran « Encaisser » (24/11/2026) : d'après la maquette V2 validée par Will le 24/11 (R-encaisser-maquette, m1 « Le total puis une relance »),
   telle quelle : le total dû HT en grand et la part en retard ; la relance du moment sur toute la largeur, son message ouvert à côté
   (Mail en premier, SMS, Copier, « J'ai envoyé la relance ») ; dessous les autres relances, « Attendu bientôt », « Relances notées » (7 jours) ;
   les sommes dossier par dossier (Reçu / Accepté aujourd'hui, Annuler, Supprimer avec confirmation) ; la feuille « Noter une somme ».
   Tables : dossier_sommes (une somme rattachée à UN volet du dossier) et somme_relances (le journal des relances), lues avec les dossiers,
   leurs volets et la piste liée (téléphone, mail, titulaire). La signature du message se lit dans le réglage de la marque (phirst_marque_publique).
   L'app n'envoie rien : le message part du Mail ou du téléphone de Yann (mailto: / sms:). Réservé à Yann (la téléprospectrice ne voit rien,
   règles restrictives en base). Toute la logique est dans phirst-encaisser-pur.js, testée (tests/phirst-encaisser.test.mjs).
   Chaque geste écrit, puis met l'écran à jour avec la ligne RENDUE par la base : jamais de « c'est noté » avant la réponse.
   Paramètre d'adresse : V2.go('encaisser', <id du dossier>) ouvre la feuille « Noter une somme » sur cette pharmacie. */
(function () {
  'use strict';
  var E = window.PHIRST_ENCAISSER_PUR, D = window.PHIRST_DOSSIERS_PUR, V2 = window.V2, X = window.PHIRST_ECRAN;
  if (!E || !D || !V2 || !X) return;
  V2.pages = V2.pages || {};
  var PAS = 'Pas enregistré : réessayez dans un instant.';
  var COLS_PISTE = 'id,nom,ville,departement,pharmacien,telephone,email,dossier_id';
  var esc = X.esc, NB = E.NB;
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }

  var S = {
    racine: null, jeton: 0, telepro: false, roleConnu: false, charge: false, erreur: false,
    dossiers: [], volets: [], pistes: [], sommes: [], rels: [], marque: null,
    voir: null, choisie: null, ouverts: {}, canal: 'mail', saisi: null, occupe: false, retourFocus: null, tFlash: 0
  };

  function ico(n, t) {
    t = t || 20; var p = {
      enveloppe: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>', message: '<path d="M4 5h16v11H9l-5 4z"/>',
      copier: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
      coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>', euro: '<path d="M17 6.5A7 7 0 1017 17.5"/><path d="M4 10.5h9M4 13.5h9"/>'
    }[n];
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function auj() { return D.aujourdhui(); }
  var pl = E.pl, eur = E.eur, maj = E.maj;
  function court(s) { return E.court(s, auj()); }

  /* ── les données montées ── */
  function pisteDe(id) { return S.pistes.filter(function (p) { return p.dossier_id === id; })[0] || null; }
  /* Les pharmacies qui ont au moins un volet : { id, nom, ville, titulaire, tel, mail, volets:[{ id, sorte, nom }] } */
  function phs() {
    return D.pharmacies(S.dossiers, S.volets, []).filter(function (x) { return x.volets.length; }).map(function (x) {
      var d = x.dossier, p = pisteDe(d.id);
      return { id: d.id, nom: d.nom || (p && p.nom) || 'Pharmacie', ville: d.ville || (p && p.ville) || '', titulaire: d.titulaire || (p && p.pharmacien) || '',
        tel: (p && p.telephone) || '', mail: (p && p.email) || '', volets: x.volets.map(function (v) { return { id: v.id, sorte: v.sorte, nom: E.VOLETS[v.sorte] || v.nom }; }) };
    });
  }
  function monte() {
    var liste = phs(), parVolet = {}, parPh = {};
    liste.forEach(function (p) { parPh[p.id] = p; p.volets.forEach(function (v) { parVolet[v.id] = { ph: p, volet: v }; }); });
    var lignes = S.sommes.map(E.ligneDe).filter(function (l) { return parVolet[l.volet]; });
    lignes.forEach(function (l) { l.ph = parVolet[l.volet].ph; l.sorte = parVolet[l.volet].volet.sorte; });
    var dern = E.dernieres(S.rels), a = auj(), att = E.attentes(lignes, a, dern), rel = E.relances(att, a);
    return { phs: liste, parPh: parPh, parVolet: parVolet, lignes: lignes, dern: dern, att: att, rel: rel, af: E.aFaire(rel, a) };
  }
  function ligne(id) { return S.sommes.filter(function (s) { return s.id === id; })[0] || null; }

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
        ws ? toutLire(function () { return base.from('crm_prospects').select(COLS_PISTE).eq('workspace_id', ws).not('dossier_id', 'is', null).order('id'); }) : Promise.resolve([]),
        toutLire(function () { return base.from('dossier_sommes').select('*').order('created_at'); }),
        toutLire(function () { return base.from('somme_relances').select('*').order('created_at'); }),
        base.rpc('phirst_marque_publique').then(function (r) { return r && !r.error ? r.data : null; }, function () { return null; })
      ]).then(function (x) {
        if (x[0].error) throw new Error('dossiers');
        if (tok !== S.jeton) return;
        S.dossiers = x[0].data || []; S.volets = x[1]; S.pistes = x[2]; S.sommes = x[3]; S.rels = x[4]; S.marque = x[5];
        S.charge = true; S.erreur = false; dessiner();
      });
    }).then(null, function () { if (tok === S.jeton) { S.erreur = true; dessiner(); } });
  }

  /* ── l'écran ── */
  function pastille(a) { var e = E.etiquette(a, auj()); return '<span class="dz-et' + (e.ton ? ' en-jours ' + e.ton : '') + '">' + esc(e.texte) + '</span>'; }
  function bande(M) {
    var d = E.du(M.lignes), r = E.enRetard(M.att), phrase = E.phraseBande(M.lignes.length, M.rel, auj());
    return '<section class="en-bande" aria-labelledby="en-t"><div><p class="en-sur">' + esc(maj(E.longJour(auj()))) + '</p><h1 id="en-t">Encaisser</h1>' +
      (d ? '<p class="en-grand"><b>' + eur(d) + '</b><span>HT attendus,<br>tous dossiers</span></p>' + (r ? '<p class="en-retard">dont ' + eur(r) + ' en retard</p>' : '<p class="en-retard ok">aucun retard</p>')
        : '<p class="en-grand"><b>0' + NB + '€</b><span>attendu<br>pour l’instant</span></p>') +
      '</div><p class="en-phrase">' + esc(phrase) + '</p></section>';
  }
  function messageDe(a) { return E.message(a, a.l.ph, a.l.sorte, E.signature(S.marque), auj()); }
  function carteRelance(a, rang, total) {
    var l = a.l, p = l.ph, m = messageDe(a), texte = S.saisi && S.saisi.id === l.id ? S.saisi.texte : m.texte;
    var a2 = [p.titulaire || p.nom, p.mail || 'pas d’adresse mail notée', E.telLisible(p.tel) || 'pas de numéro noté'];
    return '<section class="dz-carte en-maint" aria-labelledby="en-t-maint" data-ligne="' + esc(l.id) + '"><div class="en-maint-g">' +
      '<p class="dz-kicker">Maintenant · relance ' + rang + ' sur ' + total + '</p>' +
      '<div class="en-qui"><span class="en-ini" aria-hidden="true">' + esc(E.nomCourt(p.nom).charAt(0)) + '</span><div><h2 id="en-t-maint" tabindex="-1">Relancer ' + esc(E.laPh(p.nom)) + '</h2><p>' + esc([p.ville, E.VOLETS[l.sorte]].filter(Boolean).join(' · ')) + '</p></div></div>' +
      '<p class="en-somme"><b>' + eur(l.montant) + '</b><small>HT</small>' + pastille(a) + '</p>' +
      '<p class="en-detail">' + esc(E.phraseRelance(a, l.sorte, auj())) + '</p>' +
      '<div class="en-envois"><a class="dz-btn plein" id="en-mail" href="' + esc(E.lienMail(p.mail, m.objet, texte)) + '">' + ico('enveloppe', 20) + 'Envoyer par Mail</a>' +
      '<div class="en-deux">' + (E.telSms(p.tel) ? '<a class="dz-btn" id="en-sms" href="' + esc(E.lienSms(p.tel, texte)) + '">' + ico('message', 20) + 'Envoyer par SMS</a>'
        : '<button type="button" class="dz-btn" id="en-sms" aria-disabled="true" data-en="sans-tel">' + ico('message', 20) + 'Envoyer par SMS</button>') +
      '<button type="button" class="dz-btn" id="en-copie" data-en="copie">' + ico('copier', 20) + 'Copier le message</button></div></div>' +
      '<div class="en-fait"><button type="button" class="dz-btn" id="en-fait" data-en="fait" data-id="' + esc(l.id) + '">' + ico('coche', 20) + '<span id="en-fait-t">' + (S.canalClique ? 'J’ai bien envoyé la relance par ' + (S.canal === 'sms' ? 'SMS' : 'Mail') : 'J’ai envoyé la relance') + '</span></button></div>' +
      '<p class="en-pet">À ' + esc(a2.join(' · ')) + '</p></div>' +
      '<div class="en-msg-c"><p class="en-objet">Objet : <b id="en-objet">' + esc(m.objet) + '</b></p>' +
      '<div class="dz-champ"><label for="en-texte">Le message, déjà écrit : vous pouvez le modifier</label><textarea id="en-texte" data-id="' + esc(l.id) + '">' + esc(texte) + '</textarea></div>' +
      '</div></section>';
  }
  function boutonNoter(M, cls) {
    return M.phs.length ? '<button type="button" class="dz-btn plein' + (cls || '') + '" data-en="noter">' + ico('plus', 20) + 'Noter une somme</button>'
      : '<button type="button" class="dz-btn plein' + (cls || '') + '" data-vers="dossiers">Ouvrir les dossiers</button>';
  }
  function carteRien(M) {
    var b = E.bientot(M.att)[0], nn = E.notees(S.rels, auj()).length;
    if (!M.lignes.length) return '<section class="dz-carte en-maint" aria-labelledby="en-t-maint"><div class="en-maint-g"><p class="dz-kicker">Rien n’est attendu</p>' +
      '<div class="en-qui"><span class="en-ini" aria-hidden="true">€</span><div><h2 id="en-t-maint" tabindex="-1">Notez ce que vous facturez</h2><p>Une somme se note sur le dossier d’une pharmacie</p></div></div>' +
      '<p class="en-detail">Recopiez le montant hors taxes de votre devis, de votre acompte ou de votre solde : la facture elle-même reste dans votre logiciel. L’app suit ensuite le retard et écrit la relance à votre place.</p>' +
      '<div class="en-envois">' + boutonNoter(M) + '</div></div>' +
      '<div class="en-msg-c"><p class="en-objet"><b>Ce que l’app fera ensuite</b></p><ul class="en-liste">' +
      '<li><div class="g"><p class="n">Le total attendu</p><p class="q">Tout ce qui reste dû, hors taxes, et la part en retard.</p></div></li>' +
      '<li><div class="g"><p class="n">La relance du moment</p><p class="q">La somme la plus en retard d’abord, avec son message déjà écrit.</p></div></li>' +
      '<li><div class="g"><p class="n">Les devis sans réponse</p><p class="q">Dix jours après l’envoi, l’app propose de relancer.</p></div></li></ul></div></section>';
    var t = b ? 'Prochaine rentrée : ' + E.nomCourt(b.l.ph.nom) : 'Tout est relancé cette semaine';
    return '<section class="dz-carte en-maint" aria-labelledby="en-t-maint"><div class="en-maint-g"><p class="dz-kicker">Rien à relancer</p>' +
      '<div class="en-qui"><span class="en-ini" aria-hidden="true">' + ico('coche', 22) + '</span><div><h2 id="en-t-maint" tabindex="-1">' + esc(t) + '</h2>' + (b ? '<p>' + esc([b.l.ph.ville, E.VOLETS[b.l.sorte]].filter(Boolean).join(' · ')) + '</p>' : '') + '</div></div>' +
      (b ? '<p class="en-somme"><b>' + eur(b.l.montant) + '</b><small>HT' + (b.l.echeance ? ', attendus le ' + court(b.l.echeance) : '') + '</small></p>' : '') +
      '<p class="en-detail">' + (M.rel.length ? 'Chaque relance attend sa réponse une semaine. Notez chaque paiement dès qu’il arrive.' : 'Personne n’est en retard. Notez chaque paiement dès qu’il arrive.') + '</p>' +
      '<div class="en-envois"><button type="button" class="dz-btn" data-en="vers-sommes">' + ico('euro', 20) + 'Voir les sommes</button></div></div>' +
      '<div class="en-msg-c"><p class="en-objet"><b>Cette semaine</b></p><p class="en-pet">' + (nn ? pl(nn, 'relance') + ' notée' + (nn > 1 ? 's' : '') + ' : la liste est à droite.' : 'Aucune relance notée.') + '</p></div></section>';
  }
  function autres(M, premiere) {
    var l = M.rel.filter(function (a) { return a !== premiere; });
    if (!l.length) return '';
    var t = premiere ? (l.length === 1 ? 'L’autre relance' : 'Les ' + l.length + ' autres relances') : (l.length === 1 ? 'La relance de la semaine' : 'Les ' + l.length + ' relances de la semaine');
    return '<section class="dz-carte en-bloc" aria-labelledby="en-t-autres"><h3 id="en-t-autres">' + t + '</h3><ul class="en-liste en-autres">' + l.map(function (a) {
      return '<li><div class="g"><p class="n">' + esc(a.l.ph.nom) + '</p><p class="q">' + esc(maj(E.quoiCourt(a.l))) + ' · ' + esc(E.VOLETS[a.l.sorte]) + '</p></div><div class="d"><p class="m">' + eur(a.l.montant) + '</p>' + pastille(a) + '</div>' +
        (E.recente(a, auj()) ? '' : '<button type="button" class="dz-btn petit" data-en="prendre" data-id="' + esc(a.l.id) + '" aria-label="Préparer la relance de ' + esc(a.l.ph.nom) + '">Préparer</button>') + '</li>';
    }).join('') + '</ul></section>';
  }
  function droite(M) {
    var b = E.bientot(M.att), nn = E.notees(S.rels, auj());
    var h = '<section class="dz-carte en-bloc" aria-labelledby="en-t-bientot"><h3 id="en-t-bientot">Attendu bientôt</h3>' + (b.length ? '<ul class="en-liste">' + b.map(function (a) {
      return '<li><div class="g"><p class="n">' + esc(a.l.ph.nom) + '</p><p class="q">' + esc(maj(E.quoiCourt(a.l))) + (a.l.echeance ? ' · le ' + court(a.l.echeance) : '') + '</p></div><p class="m">' + eur(a.l.montant) + '</p></li>';
    }).join('') + '</ul>' : '<p class="en-vide">Rien n’arrive à échéance pour l’instant.</p>') + '</section>';
    var parId = {}; M.lignes.forEach(function (l) { parId[l.id] = l; });
    var vues = nn.filter(function (r) { return parId[r.somme_id]; });
    h += '<section class="dz-carte en-bloc" aria-labelledby="en-t-notees"><h3 id="en-t-notees">Relances notées</h3>' + (vues.length ? '<ul class="en-liste">' + vues.map(function (r) {
      var l = parId[r.somme_id];
      return '<li><div class="g"><p class="n">' + esc(l.ph.nom) + '</p><p class="q">' + court(String(r.jour).slice(0, 10)) + ' · par ' + (r.canal === 'sms' ? 'SMS' : 'Mail') + '</p></div><p class="m">' + eur(l.montant) + '</p></li>';
    }).join('') + '</ul>' : '<p class="en-vide">Aucune relance notée ces sept derniers jours. Chaque relance envoyée s’écrit ici, et la somme attend sa réponse une semaine.</p>') + '</section>';
    return h;
  }
  function sommes(M) {
    var h = '<section class="en-sommes" id="en-sommes" aria-labelledby="en-t-sommes" tabindex="-1"><div class="en-sommes-t"><div><h2 id="en-t-sommes">Les sommes, dossier par dossier</h2>' +
      '<p>Recopiées de votre logiciel, hors taxes. Rien de tout cela n’apparaît sur la page envoyée au pharmacien.</p></div>' + boutonNoter(M) + '</div>';
    if (!M.phs.length) return h + '<p class="en-vide">Aucun dossier pour l’instant : une somme se note sur le dossier d’une pharmacie, ouvert depuis les Dossiers de projet.</p></section>';
    M.phs.forEach(function (p) {
      var ls = M.lignes.filter(function (l) { return l.ph.id === p.id; }), r = E.resteDossier(ls, p.volets.map(function (v) { return v.sorte; }));
      h += '<details class="dz-repli en-ph" id="en-a-' + esc(p.id) + '" data-ph="' + esc(p.id) + '"' + (S.ouverts[p.id] ? ' open' : '') + '><summary><span>' + esc(p.nom) + '</span>' + (p.ville ? '<span class="dz-n">' + esc(p.ville) + '</span>' : '') + '<span class="v">' +
        p.volets.map(function (v) { return '<span class="dz-et">' + esc(v.nom) + '</span>'; }).join('') + '</span>' +
        '<span class="reste' + (r.zero ? ' zero' : '') + '">' + esc(r.texte) + '</span><i class="dz-chev" aria-hidden="true"></i></summary><div class="dz-repli-c">';
      if (ls.length) h += '<ul class="en-lignes">' + ls.map(function (l) {
        var ret = !l.faitLe && l.type !== 'devis' && l.echeance && l.echeance < auj(), quoi = l.libelle || E.TYPES[l.type];
        return '<li class="en-ligne"' + (l.faitLe ? ' data-fait' : '') + ' data-l="' + esc(l.id) + '"><div><p class="t">' + esc(quoi) + '<span class="dz-et">' + esc(E.VOLETS[l.sorte]) + '</span></p>' +
          '<p class="q">' + esc(E.TYPES[l.type]) + ' · ' + esc(E.detailLigne(l, auj())) + '</p></div>' +
          '<p class="m">' + eur(l.montant) + (ret ? ' <span class="dz-et rouge">en retard</span>' : '') + '</p>' +
          '<div class="a">' + (l.faitLe ? '<button type="button" class="dz-btn petit" data-en="annuler" data-id="' + esc(l.id) + '">Annuler « ' + (l.type === 'devis' ? 'accepté' : 'reçu') + ' »</button>'
            : '<button type="button" class="dz-btn petit plein" data-en="recu" data-id="' + esc(l.id) + '">' + ico('coche', 18) + (l.type === 'devis' ? 'Accepté aujourd’hui' : 'Reçu aujourd’hui') + '</button>') +
          '<button type="button" class="dz-btn petit" data-en="suppr" data-id="' + esc(l.id) + '">Supprimer</button></div>' +
          (S.confirmer === l.id ? '<div class="cz-confirme" role="group" aria-label="Confirmer la suppression"><p>Supprimer « ' + esc(quoi) + ' » (' + eur(l.montant) + ' HT) ? Elle disparaît du total et des relances.</p>' +
            '<div class="en-deux"><button type="button" class="dz-btn plein" data-en="oui" data-id="' + esc(l.id) + '">Oui, supprimer</button><button type="button" class="dz-btn" data-en="garder" data-id="' + esc(l.id) + '">La garder</button></div></div>' : '') + '</li>';
      }).join('') + '</ul>';
      else h += '<p class="en-vide">Aucune somme notée pour cette pharmacie.</p>';
      h += '<button type="button" class="dz-btn" data-en="noter" data-id="' + esc(p.id) + '">' + ico('plus', 20) + 'Noter une somme pour cette pharmacie</button></div></details>';
    });
    return h + '</section>';
  }
  function reservee() {
    return '<section class="pa pa-attente" aria-label="Encaisser">' + X.tete('Encaisser', 'Acomptes, situations et soldes.') +
      '<div class="pa-vide"><p>Cet écran est réservé à Yann. Vos outils sont les Appels, l’Agenda et la Veille.</p><div class="pa-bs">' +
      '<button type="button" class="lg-gros" data-vers="appels">Ouvrir mes Appels</button><button type="button" class="pa-b" data-vers="agenda">Ouvrir l’Agenda</button></div></div></section>';
  }
  function pg() { return S.racine && S.racine.querySelector('#en-pg'); }
  function feuille() { return S.racine && S.racine.querySelector('#en-feuille'); }
  function dessiner() {
    var r = S.racine; if (!r || !V2.route || V2.route.name !== 'encaisser') return;
    if (S.telepro) { r.innerHTML = X.cadre(reservee()); return; }
    if (!S.roleConnu) { r.innerHTML = X.cadre('<section class="pa dz cz en" aria-label="Encaisser"><div class="dz-vide"><p>Un instant…</p></div></section>'); return; }
    if (!pg()) {
      r.innerHTML = X.cadre('<section class="pa dz cz en" aria-label="Encaisser"><div id="en-pg"></div><dialog class="cz-feuille en-f" id="en-feuille" aria-labelledby="en-f-titre"></dialog></section>');
      var F = feuille();
      F.addEventListener('click', function (ev) { if (ev.target === F) fermer(); });
      F.addEventListener('close', function () { if (F.open) return; var b = S.retourFocus; S.retourFocus = null; if (b && document.contains(b)) try { b.focus(); } catch (e) {} });
    }
    var P = pg();
    if (!S.charge && !S.erreur) { P.innerHTML = '<div class="dz-vide"><p>Vos sommes arrivent…</p></div>'; return; }
    if (S.erreur) { P.innerHTML = '<div class="dz-tete"><div class="dz-tete-g"><h1>Encaisser</h1></div></div><div class="dz-vide"><p>Vos sommes ne se sont pas affichées.</p><p>Réessayez dans un instant.</p><button type="button" class="dz-btn plein" data-en="reessayer">Réessayer</button></div>'; return; }
    var M = monte(), premiere = null;
    if (S.choisie) M.af.forEach(function (a) { if (a.l.id === S.choisie) premiere = a; });
    if (!premiere) premiere = M.af[0] || null;
    if (!premiere || !S.saisi || S.saisi.id !== premiere.l.id) S.saisi = null;
    if (!premiere || S.premId !== premiere.l.id) { S.canal = 'mail'; S.canalClique = false; }
    S.premId = premiere ? premiere.l.id : null;
    var rang = M.rel.length - M.af.length + 1;
    P.innerHTML = bande(M) + '<div class="en-grille">' + (premiere ? carteRelance(premiere, rang, M.rel.length) : carteRien(M)) +
      '<div class="en-trois">' + autres(M, premiere) + droite(M) + '</div></div>' + sommes(M);
    var t = P.querySelector('#en-texte');
    if (t) { hauteur(t); }
  }
  function hauteur(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
  function dire(m) {
    var F = feuille(), hote = F && F.open ? F : S.racine.querySelector('.en'); if (!hote) return;
    var f = hote.querySelector(':scope > .en-flash');
    if (!f) { f = document.createElement('div'); f.className = 'en-flash'; f.setAttribute('role', 'status'); hote.appendChild(f); }
    f.textContent = m; f.hidden = false; clearTimeout(S.tFlash); S.tFlash = setTimeout(function () { f.hidden = true; }, 4200);
  }
  function focus(sel) { var n = S.racine.querySelector(sel); if (n) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } return n; }

  /* ── écritures ── */
  function geste(fn) {
    if (S.occupe) return Promise.resolve();
    S.occupe = true;
    return Promise.resolve().then(fn).then(null, function () { dire(PAS); }).then(function () { S.occupe = false; });
  }
  function remplacer(liste, r) { var i = -1; liste.forEach(function (x, k) { if (x.id === r.id) i = k; }); if (i >= 0) liste[i] = r; else liste.push(r); }
  function noterRelance(id) {
    var u = V2.user, M = monte(), a = M.att.filter(function (x) { return x.l.id === id; })[0]; if (!u || !a) return;
    var canal = S.canal === 'sms' ? 'sms' : 'mail';
    return geste(function () {
      return sb().from('somme_relances').insert({ somme_id: id, user_id: u.id, canal: canal }).select().single().then(function (r) {
        if (r.error || !r.data) throw new Error('relance');
        S.rels.push(r.data); S.choisie = null; S.saisi = null; S.canal = 'mail'; S.canalClique = false; dessiner();
        dire('Relance notée. ' + maj(E.laPh(a.l.ph.nom)) + ' attend sa réponse une semaine.');
        focus('#en-t-maint');
      });
    });
  }
  function faitLe(id, valeur) {
    var s = ligne(id); if (!s) return;
    return geste(function () {
      return sb().from('dossier_sommes').update({ fait_le: valeur, updated_at: new Date().toISOString() }).eq('id', id).select().single().then(function (r) {
        if (r.error || !r.data) throw new Error('somme');
        remplacer(S.sommes, r.data); dessiner();
        var l = E.ligneDe(r.data);
        dire(valeur ? (l.type === 'devis' ? 'Devis accepté' : 'Paiement reçu') + ' : ' + eur(l.montant) + ' HT, noté.' : 'C’est annulé : la somme est de nouveau attendue.');
        focus('.en-ligne[data-l="' + id + '"] [data-en="' + (valeur ? 'annuler' : 'recu') + '"]');
      });
    });
  }
  function supprimer(id) {
    var s = ligne(id), M = monte(), l = M.lignes.filter(function (x) { return x.id === id; })[0]; if (!s) return;
    return geste(function () {
      return sb().from('dossier_sommes').delete().eq('id', id).select('id').then(function (r) {
        if (r.error || !r.data || !r.data.length) throw new Error('suppr');
        S.sommes = S.sommes.filter(function (x) { return x.id !== id; }); S.rels = S.rels.filter(function (x) { return x.somme_id !== id; });
        S.confirmer = null; if (S.choisie === id) S.choisie = null; dessiner(); dire('Somme supprimée.');
        if (l) focus('#en-a-' + l.ph.id + ' > summary');
      });
    });
  }

  /* ── la feuille « Noter une somme » ── */
  function ouvrirFeuille(phId, depuis) {
    var F = feuille(), M = monte(); if (!F || !M.phs.length) return;
    S.retourFocus = depuis || null;
    var choix = phId && M.parPh[phId] ? phId : '', a = auj();
    F.innerHTML = '<div class="cz-f-tete"><div class="cz-f-tete-g"><p class="dz-kicker">Encaisser</p><h2 id="en-f-titre" tabindex="-1">Noter une somme</h2></div><button type="button" class="dz-btn petit" data-en="fermer">Fermer</button></div>' +
      '<form class="cz-f-corps" novalidate id="en-f-form"><p class="cz-f-intro">Recopiez le montant hors taxes de votre devis ou de votre facture : la facture elle-même reste dans votre logiciel. L’app suit le retard et écrit la relance.</p>' +
      '<div class="cz-f-form"><div class="dz-champ"><label for="en-f-ph">La pharmacie</label><select id="en-f-ph"><option value="">Choisir une pharmacie…</option>' +
      M.phs.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === choix ? ' selected' : '') + '>' + esc(p.nom) + (p.ville ? ' · ' + esc(p.ville) : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="dz-champ"><label for="en-f-volet">Pour quel projet</label><select id="en-f-volet"></select></div>' +
      '<div class="cz-f-deux"><div class="dz-champ"><label for="en-f-type">Ce que c’est</label><select id="en-f-type">' + E.ORDRE_TYPES.map(function (k) { return '<option value="' + k + '"' + (k === 'acompte' ? ' selected' : '') + '>' + E.TYPES[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="dz-champ"><label for="en-f-montant">Montant hors taxes (€)</label><input id="en-f-montant" type="text" inputmode="decimal" autocomplete="off" placeholder="12 600"></div></div>' +
      '<div class="dz-champ"><label for="en-f-lib">Précision <span class="en-facult">(facultatif)</span></label><input id="en-f-lib" type="text" maxlength="' + E.MAX_LIB + '" placeholder="ex. Acompte de 30 % à la commande"></div>' +
      '<div class="cz-f-deux"><div class="dz-champ"><label for="en-f-env">Envoyé le</label><input id="en-f-env" type="date" value="' + esc(a) + '"></div>' +
      '<div class="dz-champ" id="en-c-ech"><label for="en-f-ech">À payer le</label><input id="en-f-ech" type="date"></div></div>' +
      '<p class="cz-pet" id="en-f-aide"></p><p class="en-f-err" role="alert" hidden id="en-f-err"></p>' +
      '<button type="submit" class="dz-btn plein">' + ico('coche', 20) + 'Noter la somme</button></div></form>';
    var sp = F.querySelector('#en-f-ph'), sv = F.querySelector('#en-f-volet'), st = F.querySelector('#en-f-type');
    function volets() {
      var p = monte().parPh[sp.value];
      sv.innerHTML = p ? p.volets.map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(v.nom) + '</option>'; }).join('') : '<option value="">Choisir d’abord la pharmacie</option>';
      sv.disabled = !p;
    }
    function aide() { F.querySelector('#en-c-ech').hidden = st.value === 'devis'; F.querySelector('#en-f-aide').textContent = E.aideType(st.value); }
    sp.addEventListener('change', volets); st.addEventListener('change', aide); volets(); aide();
    F.querySelector('#en-f-form').onsubmit = function (ev) { ev.preventDefault(); enregistrer(); };
    if (!F.open) { try { F.showModal(); } catch (e) { F.setAttribute('open', ''); } }
    F.scrollTop = 0;
    var h = F.querySelector('#en-f-titre'); if (h) try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
  }
  function fermer() { var F = feuille(); if (F && F.open) { try { F.close(); } catch (e) { F.removeAttribute('open'); } } }
  function enregistrer() {
    var F = feuille(), u = V2.user; if (!F || !u || S.occupe) return;
    var g = function (s) { return F.querySelector(s); }, err = g('#en-f-err');
    var v = E.verifier({ dossier: g('#en-f-ph').value, volet: g('#en-f-volet').value, type: g('#en-f-type').value, montant: g('#en-f-montant').value,
      libelle: g('#en-f-lib').value, envoyeLe: g('#en-f-env').value, echeance: g('#en-f-ech').value });
    ['#en-f-ph', '#en-f-volet', '#en-f-montant', '#en-f-env', '#en-f-ech'].forEach(function (s) { g(s).removeAttribute('aria-invalid'); });
    if (!v.ok) {
      var champ = g({ ph: '#en-f-ph', volet: '#en-f-volet', type: '#en-f-type', montant: '#en-f-montant', env: '#en-f-env', ech: '#en-f-ech' }[v.champ] || '#en-f-ph');
      err.textContent = v.erreur; err.hidden = false; champ.setAttribute('aria-invalid', 'true'); champ.focus(); return;
    }
    err.hidden = true;
    var phId = g('#en-f-ph').value, val = v.valeur; val.user_id = u.id;
    return geste(function () {
      return sb().from('dossier_sommes').insert(val).select().single().then(function (r) {
        if (r.error || !r.data) throw new Error('noter');
        S.sommes.push(r.data); S.ouverts[phId] = true; S.retourFocus = null; fermer(); dessiner();
        var p = monte().parPh[phId];
        dire('Somme notée : ' + eur(Number(r.data.montant)) + ' HT, ' + (p ? p.nom : 'la pharmacie') + '.');
        var bloc = S.racine.querySelector('#en-a-' + phId); if (bloc) { if (bloc.scrollIntoView) bloc.scrollIntoView({ block: 'center' }); focus('#en-a-' + phId + ' > summary'); }
      }).then(null, function (e) { if (F.open) { err.textContent = PAS; err.hidden = false; } throw e; });
    });
  }

  /* ── gestes ── */
  function clic(ev) {
    var vers = ev.target.closest('[data-vers]'); if (vers) { fermer(); V2.go(vers.getAttribute('data-vers')); return; }
    var lien = ev.target.closest('#en-mail, a#en-sms');
    if (lien) {
      var t = S.racine.querySelector('#en-texte'), M = monte(), id = t && t.getAttribute('data-id'), a = M.att.filter(function (x) { return x.l.id === id; })[0];
      if (a && t) { var m = messageDe(a); lien.href = lien.id === 'en-mail' ? E.lienMail(a.l.ph.mail, m.objet, t.value) : E.lienSms(a.l.ph.tel, t.value); }
      S.canal = lien.id === 'en-mail' ? 'mail' : 'sms'; S.canalClique = true;
      var ft = S.racine.querySelector('#en-fait-t'); if (ft) ft.textContent = 'J’ai bien envoyé la relance par ' + (S.canal === 'sms' ? 'SMS' : 'Mail');
      return;   // le lien s'ouvre (Mail ou Messages) : l'app n'envoie rien
    }
    var b = ev.target.closest('[data-en]'); if (!b || b.disabled) return;
    var act = b.getAttribute('data-en'), bid = b.getAttribute('data-id');
    if (act === 'reessayer') { charger(); return; }
    if (act === 'fermer') { fermer(); return; }
    if (act === 'noter') { ouvrirFeuille(bid, b); return; }
    if (act === 'vers-sommes') { var so = S.racine.querySelector('#en-sommes'); if (so) { if (so.scrollIntoView) so.scrollIntoView({ block: 'start' }); try { so.focus({ preventScroll: true }); } catch (e) {} } return; }
    if (act === 'sans-tel') { dire('Aucun numéro de portable noté pour cette pharmacie : copiez le message, ou envoyez-le par Mail.'); return; }
    if (act === 'copie') {
      var tx = S.racine.querySelector('#en-texte'), val = tx ? tx.value : '';
      try { navigator.clipboard.writeText(val).then(function () { dire('Message copié.'); }, function () { tx.select(); dire('Le message est sélectionné : copiez-le avec Cmd + C.'); }); }
      catch (e) { if (tx) tx.select(); dire('Le message est sélectionné : copiez-le avec Cmd + C.'); }
      return;
    }
    if (act === 'fait') { noterRelance(bid); return; }
    if (act === 'prendre') { S.choisie = bid; S.saisi = null; S.canal = 'mail'; S.canalClique = false; dessiner(); var h = S.racine.querySelector('#en-t-maint'); if (h) { if (h.scrollIntoView) h.scrollIntoView({ block: 'center' }); focus('#en-t-maint'); } return; }
    var s = ligne(bid); if (!s) return;
    var l = E.ligneDe(s), ph = monte().parVolet[l.volet]; if (ph) S.ouverts[ph.ph.id] = true;
    if (act === 'recu') { faitLe(bid, auj()); return; }
    if (act === 'annuler') { faitLe(bid, null); return; }
    if (act === 'suppr') { S.confirmer = bid; dessiner(); focus('.en-ligne[data-l="' + bid + '"] [data-en="garder"]'); return; }
    if (act === 'garder') { S.confirmer = null; dessiner(); focus('.en-ligne[data-l="' + bid + '"] [data-en="suppr"]'); return; }
    if (act === 'oui') { supprimer(bid); return; }
  }
  function saisie(ev) {
    var t = ev.target; if (!t || t.id !== 'en-texte') return;
    S.saisi = { id: t.getAttribute('data-id'), texte: t.value }; hauteur(t);
  }
  function bascule(ev) { var d = ev.target; if (d && d.matches && d.matches('.en-ph')) S.ouverts[d.getAttribute('data-ph')] = d.open; }

  /* ── entrée ── */
  V2.pages.encaisser = { needs: [], render: function (root) {
    S.racine = root; S.voir = V2.route && V2.route.param ? String(V2.route.param) : null;
    S.choisie = null; S.saisi = null; S.confirmer = null; S.canal = 'mail'; S.canalClique = false; S.occupe = false;
    root.innerHTML = '';
    if (!root.__en) {
      root.__en = true;
      root.addEventListener('click', function (ev) { if (V2.route && V2.route.name === 'encaisser') clic(ev); });
      root.addEventListener('input', function (ev) { if (V2.route && V2.route.name === 'encaisser') saisie(ev); });
      root.addEventListener('toggle', function (ev) { if (V2.route && V2.route.name === 'encaisser') bascule(ev); }, true);
    }
    var tok = ++S.jeton;
    function suite() {
      if (tok !== S.jeton) return;
      S.telepro = false;
      charger().then(function () {
        if (!S.charge || !S.voir || !V2.route || V2.route.name !== 'encaisser') return;
        if (monte().parPh[S.voir]) ouvrirFeuille(S.voir, null);
      });
    }
    if (window.PHIRST_ROLE) {
      S.charge = false; S.erreur = false; S.telepro = false; S.roleConnu = false; dessiner();
      window.PHIRST_ROLE.estTelepro().then(function (t) {
        if (tok !== S.jeton || !V2.route || V2.route.name !== 'encaisser') return;
        S.roleConnu = true;
        if (t) { S.telepro = true; dessiner(); return; }
        suite();
      }, function () { S.roleConnu = true; suite(); });
    } else { S.roleConnu = true; suite(); }
  } };
})();
