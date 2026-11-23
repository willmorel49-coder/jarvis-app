/* PHIRST · écran « Vitrine » de Yann (24/11/2026) : les pages préparées pour ses pharmacies (une par dossier, lien à jeton), les demandes que
   les pharmaciens laissent sur ces pages, et la feuille où Yann écrit ses notes (« Ce que j’ai vu », « Ce que je propose », la suite).
   Toute la logique est dans phirst-vitrine-pur.js et phirst-lettre-contenu.js, testées (tests/phirst-vitrine.test.mjs).
   Ici : les lectures, l'affichage et les écritures. Chaque écriture attend la réponse de la base avant de dire « fait ».
   La téléprospectrice n'a aucun accès : l'écran le dit, et AUCUNE lecture n'est lancée pour elle. */
(function () {
  'use strict';
  var Vp = window.PHIRST_VITRINE_PUR, L = window.PHIRST_LETTRE, V2 = window.V2, X = window.PHIRST_ECRAN;
  if (!Vp || !L || !V2 || !X) return;
  V2.pages = V2.pages || {};
  var esc = X.esc, PAS = 'Pas enregistré : réessayez dans un instant.';
  var ADRESSE = (window.V2_BRAND && window.V2_BRAND.lettre) || '';
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }

  var S = { racine: null, jeton: 0, telepro: false, roleConnu: false, charge: false, erreur: false, ws: null,
    demandes: [], dossiers: [], lettres: [], occupe: {}, fait: {}, partiel: {}, flash: '', flashErr: false, tFlash: 0,
    confirme: null, lienVu: null, f: null, depuis: null };

  function ico(n, t) {
    t = t || 20;
    var p = { tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
      copier: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
      oeil: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', crayon: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>' }[n];
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function idc(n) { return 'vt-' + String(n).replace(/\./g, '-'); }
  function lettreDe(did) { return S.lettres.filter(function (l) { return l.dossier_id === did; })[0] || null; }
  function dossier(did) { return S.dossiers.filter(function (d) { return d.id === did; })[0] || null; }
  function focus(n) { if (n) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }

  /* ── lectures ── */
  function toutLire(fabrique) {
    var tout = [];
    function page(n) {
      return fabrique().range(n * 1000, n * 1000 + 999).then(function (r) {
        if (!r || r.error) throw new Error('lecture');
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
    function ok(r) { if (!r || r.error) throw new Error('lecture'); return r.data || []; }
    return Promise.all([
      base.from('crm_members').select('workspace_id').eq('user_id', u.id).limit(1).maybeSingle(),
      base.from('vitrine_demandes').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(Vp.MAX_DEMANDES),
      base.from('vitrine_demandes').select('*').eq('user_id', u.id).is('traitee_le', null).order('created_at', { ascending: false }).limit(Vp.MAX_DEMANDES),
      base.from('dossiers').select('id,nom,ville,created_at').eq('user_id', u.id).order('created_at', { ascending: false }),
      base.from('dossier_lettres').select('id,dossier_id,jeton,ouverte,contenu,updated_at').eq('user_id', u.id)
    ]).then(function (x) {
      if (tok !== S.jeton) return;
      S.ws = x[0] && !x[0].error && x[0].data ? x[0].data.workspace_id : null;
      S.demandes = Vp.trierDemandes(Vp.fusionner(ok(x[1]), ok(x[2])));
      S.dossiers = ok(x[3]); S.lettres = ok(x[4]);
      S.charge = true; S.erreur = false; dessiner();
    }).then(null, function () { if (tok === S.jeton) { S.erreur = true; dessiner(); } });
  }

  /* ── les demandes ── */
  function carteDemande(d) {
    var id = esc(d.id), occ = !!S.occupe[d.id], tel = Vp.telAffiche(d.tel), lien = Vp.lienTel(d.tel), orig = Vp.origineLibelle(d.origine);
    var h = '<li class="dz-carte vt-dem" data-dem="' + id + '"><div class="dz-carte-h"><span class="dz-et' + (d.traitee_le ? ' vert' : ' orange') + '">' + (d.traitee_le ? 'Dans vos pistes' : 'À rappeler') + '</span>' +
      '<span class="vt-quand">' + esc(Vp.quandParis(d.created_at)) + '</span></div>' +
      '<h3>' + esc(Vp.titreDemande(d)) + '</h3><p class="dz-sous vt-sous">' + esc(d.motif || '') + (orig ? ' · ' + esc(orig) : '') + '</p>';
    h += '<p class="vt-qui">' + (d.nom ? '<b>' + esc(d.nom) + '</b> · ' : '') + esc(tel) + '</p>';
    if (d.mot) h += '<p class="vt-mot">« ' + esc(d.mot) + ' »</p>';
    if (S.fait[d.id]) h += '<p class="dz-flash vt-fait" role="status">' + esc(S.fait[d.id].texte) + '</p>';
    if (S.fait[d.id] && S.fait[d.id].err) h = h.replace('class="dz-flash vt-fait"', 'class="dz-flash dz-err vt-fait"');
    if (d.traitee_le) h += '<p class="vt-traitee">Dans vos pistes depuis le ' + esc(Vp.jourParis(d.traitee_le)) + '.</p>';
    h += '<div class="vt-bs">' + (lien ? '<a class="dz-btn petit' + (d.traitee_le ? '' : ' plein') + '" href="' + esc(lien) + '">' + ico('tel', 18) + 'Appeler le ' + esc(tel) + '</a>' : '');
    if (!d.traitee_le) h += '<button type="button" class="dz-btn petit" data-vt="ajouter" data-id="' + id + '" data-f="d-' + id + '"' + (occ ? ' disabled aria-busy="true"' : '') + '>' + ico('plus', 18) + (occ ? 'Ajout en cours…' : 'Ajouter à mes pistes') + '</button>';
    else h += '<button type="button" class="dz-btn petit" data-vers="appels">Ouvrir les Appels</button>';
    return h + '</div></li>';
  }
  function blocDemandes() {
    var l = S.demandes, h = '<section class="dz-groupe vt-bloc" aria-labelledby="vt-t-dem"><div class="dz-groupe-t"><h2 id="vt-t-dem">Reçu par vos pages</h2><span>' + esc(Vp.phraseCompte(l)) + '</span></div>';
    if (!l.length) return h + '<div class="dz-vide"><p>Aucune demande pour l’instant.</p><p>Quand un pharmacien écrit depuis sa page, ou depuis « Démarrer un projet » de l’ancienne vitrine, sa demande arrive ici, avec son numéro.</p></div></section>';
    return h + '<ul class="vt-liste">' + l.map(carteDemande).join('') + '</ul></section>';
  }

  /* ── les pages ── */
  function cartePage(d) {
    var l = lettreDe(d.id), e = Vp.etatLettre(l), id = esc(d.id), lien = l ? Vp.lienCopie(ADRESSE, l.jeton) : '', maj = Vp.majLettre(l);
    var h = '<article class="dz-carte vt-page" data-page="' + id + '"><div class="dz-carte-h"><span class="dz-et' + (e.ton ? ' ' + e.ton : '') + '">' + esc(e.texte) + '</span>' +
      (maj ? '<span class="vt-quand">Modifiée le ' + esc(maj) + '</span>' : '') + '</div><h3>' + esc(d.nom) + '</h3>' + (d.ville ? '<p class="dz-sous">' + esc(d.ville) + '</p>' : '');
    h += '<div class="vt-bs"><button type="button" class="dz-btn petit' + (l ? '' : ' plein') + '" data-vt="feuille" data-id="' + id + '" data-f="p-' + id + '">' + ico('crayon', 18) + esc(e.action) + '</button>';
    if (l) h += '<button type="button" class="dz-btn petit" data-vt="copier" data-id="' + id + '" data-f="c-' + id + '">' + ico('copier', 18) + 'Copier le lien</button>' +
      '<a class="dz-btn petit" href="' + esc(Vp.lienVoir(l.jeton)) + '" target="_blank" rel="noopener">' + ico('oeil', 18) + 'Voir la page<span class="dz-sr"> (s’ouvre dans un nouvel onglet)</span></a>';
    h += '</div>';
    if (l && S.lienVu === d.id) h += '<div class="dz-champ vt-lien"><label for="vt-lien-' + id + '">Le lien (sélectionné : copiez-le à la main)</label><input id="vt-lien-' + id + '" type="text" readonly value="' + esc(lien) + '"></div>';
    if (l && !lien) h += '<p class="vt-pet">L’adresse des pages n’est pas réglée : le lien ne peut pas être copié pour l’instant.</p>';
    if (l && S.confirme === d.id) {
      h += '<div class="cz-confirme vt-conf" role="group" aria-label="' + (l.ouverte === false ? 'Rouvrir' : 'Couper') + ' le lien"><p>' + esc(Vp.phraseBascule(l)) + '</p><div class="vt-bs">' +
        '<button type="button" class="dz-btn petit plein" data-vt="bascule" data-id="' + id + '"' + (S.occupe[d.id] ? ' disabled' : '') + '>' + (l.ouverte === false ? 'Oui, rouvrir le lien' : 'Oui, couper le lien') + '</button>' +
        '<button type="button" class="dz-btn petit" data-vt="annuler" data-id="' + id + '">Ne rien changer</button></div></div>';
    } else if (l) h += '<button type="button" class="dz-lien vt-coupe" data-vt="confirmer" data-id="' + id + '" data-f="b-' + id + '">' + (l.ouverte === false ? 'Rouvrir le lien' : 'Couper le lien') + '</button>';
    return h + '</article>';
  }
  function blocPages() {
    var h = '<section class="dz-groupe vt-bloc" aria-labelledby="vt-t-pag"><div class="dz-groupe-t"><h2 id="vt-t-pag">Vos pages préparées</h2><span>' + esc(S.lettres.length ? S.lettres.length + ' sur ' + S.dossiers.length : '') + '</span></div>';
    if (!S.dossiers.length) return h + '<div class="dz-vide"><p>Aucun dossier pour l’instant.</p><p>Chaque page est préparée pour un dossier : créez d’abord le dossier de la pharmacie.</p><button type="button" class="dz-btn plein" data-vers="dossiers">Ouvrir les Dossiers</button></div></section>';
    return h + '<div class="vt-grille">' + S.dossiers.map(cartePage).join('') + '</div></section>';
  }

  /* ── dessin ── */
  function feuille() { return S.racine && S.racine.querySelector('#vt-feuille'); }
  function htmlFlash() { return S.flash ? '<p class="dz-flash vt-flash' + (S.flashErr ? ' dz-err' : '') + '" role="status">' + esc(S.flash) + '</p>' : ''; }
  function htmlPage() {
    var corps;
    if (S.erreur) corps = '<div class="dz-vide"><p>Vos pages ne se sont pas affichées.</p><p>Vérifiez votre connexion, puis réessayez.</p><button type="button" class="dz-btn plein" data-vt="reessayer">Réessayer</button></div>';
    else if (!S.charge) corps = '<div class="dz-vide"><p>Vos pages arrivent…</p></div>';
    else corps = htmlFlash() + blocDemandes() + blocPages();
    return corps;
  }
  function dessiner() {
    var r = S.racine; if (!r || !V2.route || V2.route.name !== 'vitrine') return;
    var pg = r.querySelector('#vt-pg');
    if (!pg) {
      r.innerHTML = X.cadre('<section class="pa dz cz vt" aria-label="Vitrine">' + X.tete('Vitrine', 'Les pages préparées pour vos pharmacies.') +
        '<div id="vt-pg"></div><dialog class="cz-feuille vt-feuille" id="vt-feuille" aria-labelledby="vt-f-titre"></dialog></section>');
      pg = r.querySelector('#vt-pg');
      var F = feuille();
      F.addEventListener('click', function (ev) { if (ev.target === F) fermer(); });
      F.addEventListener('close', function () {
        if (F.open) return; var d = S.depuis; S.depuis = null; S.f = null; F.innerHTML = '';
        if (d) focus(r.querySelector('[data-f="' + d + '"]'));
      });
    }
    var act = document.activeElement, cle = act && pg.contains(act) && act.getAttribute ? act.getAttribute('data-f') : null;
    pg.innerHTML = htmlPage();
    if (cle) focus(pg.querySelector('[data-f="' + cle + '"]'));
    var champ = pg.querySelector('.vt-lien input'); if (champ && S.lienVu) { focus(champ); try { champ.select(); } catch (e) { /* rien */ } }
  }
  function dire(t, err) {
    S.flash = t; S.flashErr = !!err; clearTimeout(S.tFlash);
    if (!err) S.tFlash = setTimeout(function () { S.flash = ''; var n = S.racine && S.racine.querySelector('.vt-flash'); if (n) n.remove(); }, 6000);
    dessiner();
  }
  function pageTelepro() {
    return X.cadre('<section class="pa pa-attente" aria-label="Vitrine">' + X.tete('Vitrine', 'Les pages préparées pour vos pharmacies.') +
      '<div class="pa-vide"><p>Cet écran est réservé à Yann. Vos outils sont les Appels, l’Agenda et la Veille.</p><div class="pa-bs">' +
      '<button type="button" class="lg-gros" data-vers="appels">Ouvrir mes Appels</button><button type="button" class="pa-b" data-vers="agenda">Ouvrir l’Agenda</button></div></div></section>');
  }

  /* ── « Ajouter à mes pistes » : retrouver, créer la piste, noter, marquer traitée ── */
  function ajouter(id) {
    var d = S.demandes.filter(function (x) { return x.id === id; })[0], base = sb();
    if (!d || d.traitee_le || S.occupe[id] || !base) return;
    var p = S.partiel[id] || { prospectId: null, note: false, archivee: false };
    S.occupe[id] = true; delete S.fait[id]; dessiner();
    function stop(etape, fait) { S.occupe[id] = false; S.fait[id] = { texte: Vp.phraseErreur(etape, fait), err: true }; dessiner(); }
    function retrouver() {
      if (p.prospectId) return Promise.resolve({ mode: 'deja', piste: { id: p.prospectId }, archivee: p.archivee });
      if (!S.ws) return Promise.reject({ etape: 'pistes' });
      return toutLire(function () { return base.from('crm_prospects').select('id,nom,ville,stage,dossier_id').eq('workspace_id', S.ws).order('id'); })
        .then(function (l) { return Vp.choisirPiste(d, l); }, function () { throw { etape: 'pistes' }; });
    }
    function creer(c) {
      if (c.piste) return c;
      return base.from('crm_prospects').insert(Vp.nouvellePiste(d, S.ws)).select('id').single().then(function (r) {
        if (!r || r.error || !r.data) throw { etape: 'piste' };
        return { mode: 'nouvelle', piste: { id: r.data.id }, archivee: false };
      }, function () { throw { etape: 'piste' }; });
    }
    function noter(c) {
      p.prospectId = c.piste.id; p.archivee = c.archivee; S.partiel[id] = p;
      if (p.note) return c;
      return base.from('crm_activities').insert({ prospect_id: c.piste.id, type: 'note', body: Vp.corpsNote(d) }).then(function (r) {
        if (!r || r.error) throw { etape: 'note', fait: true };
        p.note = true; return c;
      }, function () { throw { etape: 'note', fait: true }; });
    }
    function marquer(c) {
      var t = new Date().toISOString();
      return base.from('vitrine_demandes').update({ traitee_le: t, prospect_id: c.piste.id }).eq('id', id).select('id,traitee_le,prospect_id').then(function (r) {
        if (!r || r.error || !r.data || !r.data.length) throw { etape: 'traitee', fait: true };
        d.traitee_le = r.data[0].traitee_le || t; d.prospect_id = c.piste.id; delete S.partiel[id];
        S.occupe[id] = false; S.fait[id] = { texte: Vp.phraseSucces(c) }; dessiner();
        var b = S.racine && S.racine.querySelector('[data-dem="' + id + '"] [data-vers="appels"]'); focus(b);
      }, function () { throw { etape: 'traitee', fait: true }; });
    }
    return retrouver().then(creer).then(noter).then(marquer).then(null, function (e) { stop(e && e.etape || 'traitee', e && e.fait); });
  }

  /* ── copier le lien, couper / rouvrir ── */
  function copier(did) {
    var l = lettreDe(did), lien = l ? Vp.lienCopie(ADRESSE, l.jeton) : '';
    if (!lien) { dire('L’adresse des pages n’est pas réglée : le lien ne peut pas être copié pour l’instant.', true); return; }
    function secours() { S.lienVu = did; S.flash = ''; dessiner(); dire('Copie refusée par le navigateur : le lien est sélectionné, copiez-le à la main.', true); var c = S.racine.querySelector('.vt-lien input'); if (c) { focus(c); try { c.select(); } catch (e) { /* rien */ } } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lien).then(function () { S.lienVu = null; dire('Lien copié : collez-le dans votre mail ou votre SMS.'); }, secours);
    else secours();
  }
  function bascule(did) {
    var l = lettreDe(did), base = sb(); if (!l || !base || S.occupe[did]) return;
    S.occupe[did] = true; dessiner();
    base.from('dossier_lettres').update({ ouverte: l.ouverte === false }).eq('id', l.id).select('id,ouverte').then(function (r) {
      S.occupe[did] = false;
      if (!r || r.error || !r.data || !r.data.length) { dire(PAS, true); return; }
      l.ouverte = r.data[0].ouverte; S.confirme = null;
      dire(l.ouverte ? 'Le lien est rouvert : le pharmacien revoit sa page.' : 'Le lien est coupé : le pharmacien ne voit plus sa page.');
    }, function () { S.occupe[did] = false; dire(PAS, true); });
  }

  /* ── la feuille « La page de <pharmacie> » ── */
  function ch(n, lib, v, o) {
    o = o || {}; var i = idc(n);
    return '<div class="dz-champ' + (o.cl ? ' ' + o.cl : '') + '"><label for="' + i + '">' + esc(lib) + '</label>' +
      (o.area ? '<textarea id="' + i + '" data-n="' + n + '" rows="' + (o.rows || 3) + '" aria-describedby="' + i + '-e">' + esc(v) + '</textarea>'
        : '<input id="' + i + '" data-n="' + n + '" type="' + (o.type || 'text') + '"' + (o.mode ? ' inputmode="' + o.mode + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + ' autocomplete="off" value="' + esc(v) + '" aria-describedby="' + i + '-e">') +
      (o.cpt ? '<p class="vt-cpt" id="' + i + '-c" data-cpt="' + n + '" data-max="' + o.cpt + '"></p>' : '') +
      (o.aide ? '<p class="vt-pet">' + esc(o.aide) + '</p>' : '') +
      '<p class="vt-err" id="' + i + '-e" data-e="' + n + '" role="alert" hidden></p></div>';
  }
  function zone(n, zones, v, lib) {
    var i = idc(n);
    return '<div class="dz-champ"><label for="' + i + '">' + esc(lib) + '</label><select id="' + i + '" data-n="' + n + '" aria-describedby="' + i + '-e"><option value="">Choisir la zone</option>' +
      zones.map(function (z) { return '<option value="' + z[0] + '"' + (z[0] === v ? ' selected' : '') + '>' + esc(z[1]) + '</option>'; }).join('') + '</select><p class="vt-err" id="' + i + '-e" data-e="' + n + '" role="alert" hidden></p></div>';
  }
  function lignes(nom, zones, nb, p, lib) {
    var h = '';
    for (var k = 0; k < nb; k++) {
      var b = nom + '.' + k;
      h += '<fieldset class="vt-ligne"><legend>' + esc(lib) + ' ' + (k + 1) + '</legend>' + zone(b + '.zone', zones, p[b + '.zone'], 'Zone du plan') +
        ch(b + '.t', 'Titre', p[b + '.t'], {}) + ch(b + '.d', 'Détail', p[b + '.d'], { area: true, rows: 2 }) + '</fieldset>';
    }
    return h;
  }
  function corpsFeuille(did, p) {
    var d = dossier(did) || {};
    return '<div class="cz-f-tete"><div class="cz-f-tete-g"><p class="dz-kicker">Vitrine</p><h2 id="vt-f-titre" tabindex="-1">La page de ' + (/^pharmacie\s/i.test(d.nom || '') ? 'la ' : '') + esc(d.nom || '') + '</h2></div>' +
      '<button type="button" class="dz-btn petit" data-vt="fermer">Fermer</button></div>' +
      '<form class="cz-f-corps vt-form" data-vt-form novalidate><p class="cz-f-intro">Le plan de la page est un plan type, le même pour chaque pharmacie : la zone que vous choisissez pour chaque constat ou chaque idée s’allume sur la page. Ce que vous laissez vide n’apparaît pas.</p>' +
      '<div class="cz-f-form">' + ch('rdv', 'Rendez-vous', p.rdv, { type: 'date', aide: 'Le jour du premier rendez-vous (rempli d’après le dossier quand il est fait).' }) +
      ch('mot', 'Le mot', p.mot, { area: true, rows: 4, cpt: L.MAX.mot }) + '</div>' +
      '<h3 class="cz-f-h">Ce que j’ai vu <span>' + Vp.NB_VU + ' lignes au plus</span></h3><div class="cz-f-form">' + lignes('vu', L.ZONES_VU, Vp.NB_VU, p, 'Constat') + '</div>' +
      '<h3 class="cz-f-h">Ce que je propose <span>' + Vp.NB_PROPOSE + ' lignes au plus</span></h3><div class="cz-f-form">' + lignes('propose', L.ZONES_PROPOSE, Vp.NB_PROPOSE, p, 'Idée') + '</div>' +
      '<h3 class="cz-f-h">Le plan</h3><div class="cz-f-form"><div class="cz-f-deux">' +
      ch('surfaces.aujourdhui', 'Surface aujourd’hui (m²)', p['surfaces.aujourdhui'], { mode: 'numeric' }) + ch('surfaces.demain', 'Surface demain (m²)', p['surfaces.demain'], { mode: 'numeric' }) +
      ch('postes.aujourdhui', 'Postes au comptoir aujourd’hui', p['postes.aujourdhui'], { mode: 'numeric' }) + ch('postes.demain', 'Postes au comptoir demain', p['postes.demain'], { mode: 'numeric' }) +
      ch('entree.aujourdhui', 'L’entrée aujourd’hui', p['entree.aujourdhui'], { ph: 'Rue' }) + ch('entree.demain', 'L’entrée demain', p['entree.demain'], { ph: 'Parking' }) + '</div></div>' +
      '<h3 class="cz-f-h">La suite</h3><div class="cz-f-form">' + ch('suite.t', 'Ce qui est prévu', p['suite.t'], { ph: 'Le relevé du nouveau local' }) +
      ch('suite.quand', 'Date et heure', p['suite.quand'], { type: 'datetime-local' }) + ch('suite.d', 'Détail', p['suite.d'], { area: true, rows: 2 }) + '</div>' +
      '<p class="vt-err vt-resume" role="alert" hidden></p><div class="vt-f-pied"><button type="submit" class="dz-btn plein" data-f="vt-ok">Enregistrer</button><span class="vt-f-ok" role="status"></span></div></form>';
  }
  function majCompteurs(F) {
    Array.prototype.forEach.call(F.querySelectorAll('[data-cpt]'), function (c) {
      var i = F.querySelector('[data-n="' + c.getAttribute('data-cpt') + '"]'), k = Vp.compteur(i ? i.value : '', +c.getAttribute('data-max'));
      c.textContent = k.texte; c.classList.toggle('trop', k.trop);
    });
  }
  function ouvrir(did) {
    var F = feuille(), d = dossier(did); if (!F || !d) return;
    var l = lettreDe(did); S.depuis = 'p-' + did; S.f = { did: did };
    var p = Vp.aplatir(Vp.valeursFeuille(l ? l.contenu : {}, ''));
    F.innerHTML = corpsFeuille(did, p); majCompteurs(F);
    if (!F.open) { try { F.showModal(); } catch (e) { F.setAttribute('open', ''); } }
    focus(F.querySelector('#vt-f-titre'));
    /* la date du 1er rendez-vous, lue dans le dossier, seulement si la page n'a pas encore de date */
    var base = sb(); if (!p.rdv && base) {
      base.from('dossier_volets').select('id,dossier_id').eq('dossier_id', did).then(function (v) {
        var ids = v && !v.error && v.data ? v.data.map(function (x) { return x.id; }) : []; if (!ids.length) return;
        return base.from('dossier_etapes').select('volet_id,cle,faite').in('volet_id', ids).eq('cle', 'rdv').then(function (e) {
          var f = e && !e.error && e.data ? Vp.rdvFait(v.data, e.data, did) : '', c = F.querySelector('[data-n="rdv"]');
          if (f && c && S.f && S.f.did === did && !c.value) c.value = f;
        });
      }).then(null, function () { /* la date reste vide : Yann la tape */ });
    }
  }
  function fermer() { var F = feuille(); if (F && F.open) { try { F.close(); } catch (e) { F.removeAttribute('open'); } } }
  function lirePlat(F) {
    var p = {}; Array.prototype.forEach.call(F.querySelectorAll('[data-n]'), function (c) { p[c.getAttribute('data-n')] = c.value; }); return p;
  }
  function montrerErreurs(F, erreurs) {
    Array.prototype.forEach.call(F.querySelectorAll('[data-e]'), function (e) { e.hidden = true; e.textContent = ''; });
    Array.prototype.forEach.call(F.querySelectorAll('[data-n]'), function (c) { c.removeAttribute('aria-invalid'); });
    var resume = F.querySelector('.vt-resume'), sans = [];
    erreurs.forEach(function (e) {
      var m = F.querySelector('[data-e="' + e.champ + '"]'), c = F.querySelector('[data-n="' + e.champ + '"]');
      if (!m || !c) { sans.push(Vp.majuscule(e.message)); return; }
      m.textContent = Vp.majuscule(e.message); m.hidden = false; c.setAttribute('aria-invalid', 'true');
    });
    resume.textContent = sans.length ? sans.join(' ') : erreurs.length ? 'Corrigez les champs signalés ci-dessus, puis enregistrez de nouveau.' : ''; resume.hidden = !resume.textContent;
    var premier = F.querySelector('[aria-invalid="true"]'); if (premier) focus(premier); else if (!resume.hidden) focus(F.querySelector('#vt-f-titre'));
  }
  function enregistrer(form) {
    var F = feuille(), did = S.f && S.f.did, base = sb(); if (!F || !did || !base || S.occupe['f']) return;
    var ok = F.querySelector('[data-vt-form] button[type=submit]'), dit = F.querySelector('.vt-f-ok'); dit.textContent = '';
    var v = L.verifier(Vp.assembler(lirePlat(F)));
    if (!v.ok) { montrerErreurs(F, v.erreurs); return; }
    montrerErreurs(F, []);
    var l = lettreDe(did), u = V2.user; S.occupe['f'] = true; ok.disabled = true;
    function fin(m, err) { S.occupe['f'] = false; ok.disabled = false; if (err) { var e = F.querySelector('.vt-resume'); e.textContent = m; e.hidden = false; } }
    function reussi(ligne) {
      S.occupe['f'] = false; ok.disabled = false;
      if (l) { l.contenu = ligne.contenu; l.updated_at = ligne.updated_at; } else S.lettres.push(ligne);
      dessiner();
      dit.innerHTML = 'Page enregistrée. <a class="dz-lien" href="' + esc(Vp.lienVoir(ligne.jeton)) + '" target="_blank" rel="noopener">Voir la page<span class="dz-sr"> (s’ouvre dans un nouvel onglet)</span></a>';
    }
    var q = l ? base.from('dossier_lettres').update({ contenu: v.valeur, updated_at: new Date().toISOString() }).eq('id', l.id)
      : base.from('dossier_lettres').insert({ dossier_id: did, user_id: u && u.id, contenu: v.valeur });
    q.select('id,dossier_id,jeton,ouverte,contenu,updated_at').then(function (r) {
      if (!r || r.error || !r.data || !r.data.length) { fin(PAS, true); return; }
      reussi(r.data[0]);
    }, function () { fin(PAS, true); });
  }

  /* ── clics ── */
  function clic(ev) {
    var t = ev.target.closest('[data-vt],[data-vers]'); if (!t) return;
    if (t.hasAttribute('data-vers') && !t.hasAttribute('data-vt')) { V2.go(t.getAttribute('data-vers')); return; }
    var a = t.getAttribute('data-vt'), id = t.getAttribute('data-id');
    if (a === 'ajouter') ajouter(id);
    else if (a === 'feuille') ouvrir(id);
    else if (a === 'fermer') fermer();
    else if (a === 'copier') copier(id);
    else if (a === 'confirmer') { S.confirme = id; dessiner(); }
    else if (a === 'annuler') { S.confirme = null; dessiner(); focus(S.racine.querySelector('[data-f="b-' + id + '"]')); }
    else if (a === 'bascule') bascule(id);
    else if (a === 'reessayer') charger();
  }

  /* ── entrée ── */
  V2.pages.vitrine = { needs: [], render: function (root) {
    S.racine = root; S.flash = ''; S.flashErr = false; S.occupe = {}; S.fait = {}; S.partiel = {}; S.confirme = null; S.lienVu = null; S.f = null; S.depuis = null;
    root.innerHTML = X.cadre('<section class="pa dz cz vt" aria-label="Vitrine">' + X.tete('Vitrine', 'Les pages préparées pour vos pharmacies.') + '<div class="dz-vide"><p>Un instant…</p></div></section>');
    if (!root.__vt) {
      root.__vt = true;
      root.addEventListener('click', function (ev) { if (V2.route && V2.route.name === 'vitrine') clic(ev); });
      root.addEventListener('submit', function (ev) {
        if (!V2.route || V2.route.name !== 'vitrine') return;
        var f = ev.target.closest && ev.target.closest('[data-vt-form]'); if (!f) return; ev.preventDefault(); enregistrer(f);
      });
      root.addEventListener('input', function (ev) {
        var c = ev.target, F = feuille(); if (!c || !c.getAttribute || !c.getAttribute('data-n') || !F) return;
        var m = F.querySelector('[data-e="' + c.getAttribute('data-n') + '"]'); if (m) { m.hidden = true; m.textContent = ''; } c.removeAttribute('aria-invalid');
        if (c.getAttribute('data-n') === 'mot') majCompteurs(F);
        var s = F.querySelector('.vt-f-ok'); if (s) s.textContent = '';
      });
    }
    var tok = ++S.jeton;
    S.roleConnu = false; S.telepro = false; S.charge = false;
    function suite(t) {
      if (tok !== S.jeton || !V2.route || V2.route.name !== 'vitrine') return;
      S.roleConnu = true; S.telepro = !!t;
      if (S.telepro) { root.innerHTML = pageTelepro(); return; }
      charger();
    }
    if (window.PHIRST_ROLE) window.PHIRST_ROLE.estTelepro().then(suite, function () { suite(false); });
    else suite(false);
  } };
})();
