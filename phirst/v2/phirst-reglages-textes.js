/* PHIRST · Réglages de Yann : « Pour la téléprospectrice » (L1, 24/11/2026), d'après la maquette 5-reglages (Z-idees) :
   trois rubriques — Mes premières phrases (idée 1), Mes réponses (idée 2), Mes références (idée 8).
   Lecture et écriture DIRECTES dans phirst_textes / phirst_entendues (Yann est membre de l'espace : règle d'accès « membres »).
   La logique (propositions de départ, tri, comptes du mois, validations) est dans phirst-textes-pur.js, testée.
   Ce fichier garde son propre état et ne redessine que sa zone (#ri-zone) : une frappe ne redessine rien, un brouillon survit à un redessin.
   Appelé par phirst-reglages.js : html() (la zone), lire(base), monter(racine), oublier(). */
(function () {
  'use strict';
  var T = window.PHIRST_TEXTES_PUR, P = window.PHIRST_PUR, X = window.PHIRST_ECRAN;
  if (!T || !P || !X) return;
  var esc = X.esc, DELAI = 10000;
  var PAS = 'Pas enregistré : réessayez dans un instant.';
  var Z = null, racine = null, tToast = 0;
  /* Au téléphone (maquette 25/11), les trois rubriques arrivent repliées ; à l'ordinateur, la première reste ouverte comme avant. */
  function petitEcran() { try { return !!(window.matchMedia && window.matchMedia('(max-width:700px)').matches); } catch (e) { return false; } }
  function neuf() {
    return { lu: false, erreur: false, ws: null, phrases: {}, reponses: [], refs: [], comptes: {}, brouillons: {}, sel: T.RAISONS[0].cle,
      ouvert: { ph: !petitEcran(), ob: false, rf: false }, formOb: false, formRf: false, occupe: false, jeton: 0, erreurs: {} };
  }
  Z = neuf();
  function sb() { return window.V2 && typeof window.V2.sb === 'function' ? window.V2.sb() : null; }

  var IC = {
    bulle: '<path d="M4 5h16v11H10l-5 4v-4H4z"/>',
    reponse: '<path d="M9 7l-5 5 5 5"/><path d="M4 12h10a6 6 0 016 6"/>',
    etoile: '<path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.3 6.8 19l1-5.8L3.6 9.1l5.8-.8z"/>'
  };
  function ico(p, t) { return '<svg width="' + (t || 24) + '" height="' + (t || 24) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  function pluriel(n, un, plu) { return n + ' ' + (n > 1 ? plu : un); }

  /* ── lectures ── */
  function borne(p) {
    return new Promise(function (ok) {
      var t = setTimeout(function () { ok(null); }, DELAI);
      Promise.resolve(p).then(function (v) { clearTimeout(t); ok(v); }, function () { clearTimeout(t); ok(null); });
    });
  }
  /* Une lecture qui échoue (tables pas encore posées, panne) = « pas pu être lu », jamais « rien d'écrit ». */
  function lire(b) {
    var tok = ++Z.jeton;
    Z.lu = false; Z.erreur = false;
    var u = window.V2 && window.V2.user;
    if (!b || !u) { Z.lu = true; Z.erreur = true; monter(); return Promise.resolve(); }
    var debut = new Date(Date.now() - 40 * 864e5).toISOString();   // marge : le mois exact se recompte en pur
    return borne(b.from('crm_members').select('workspace_id').eq('user_id', u.id).limit(1).maybeSingle().then(function (m) {
      var ws = m && !m.error && m.data && m.data.workspace_id; if (!ws) return null;
      return Promise.all([
        b.from('phirst_textes').select('id,sorte,cle,titre,texte,details,created_at,updated_at').eq('workspace_id', ws).order('created_at', { ascending: true }).limit(500),
        b.from('phirst_entendues').select('texte_id,created_at').eq('workspace_id', ws).gte('created_at', debut).limit(5000)
      ]).then(function (r) { return !r[0] || r[0].error || !r[1] || r[1].error ? null : { ws: ws, textes: r[0].data || [], entendues: r[1].data || [] }; });
    })).then(function (d) {
      if (tok !== Z.jeton) return;
      Z.lu = true; Z.erreur = !d;
      if (d) { Z.ws = d.ws; ranger(d.textes); Z.comptes = T.comptesDuMois(d.entendues, Date.now()); }
      monter();
    });
  }
  function ranger(lignes) {
    Z.phrases = {}; Z.reponses = []; Z.refs = [];
    lignes.forEach(function (l) {
      if (l.sorte === 'phrase') Z.phrases[l.cle] = l;
      else if (l.sorte === 'reponse') Z.reponses.push(l);
      else if (l.sorte === 'reference') Z.refs.push(l);
    });
  }

  /* ── les briques ── */
  function texteDe(r) { var l = Z.phrases[r.cle]; return l && l.texte && l.texte.trim() ? l.texte.trim() : r.propo; }
  function brouillon(cle, base) { var b = Z.brouillons[cle]; return typeof b === 'string' ? b : base; }
  function mention(r) {
    var l = Z.phrases[r.cle], b = brouillon('ph:' + r.cle, texteDe(r));
    if (b !== texteDe(r)) return 'Modification pas encore enregistrée';
    return l && l.texte && l.texte.trim() ? T.modifiee(l.updated_at) || 'Phrase écrite par vous' : 'Proposition de départ';
  }
  function actions(k, id, sale, remettre) {
    return '<div class="ri-actions"><button type="button" class="dz-btn plein" data-ri="save" data-k="' + k + '" data-id="' + esc(id) + '"' + (sale ? '' : ' hidden') + '>Enregistrer</button>' +
      '<button type="button" class="dz-btn petit" data-ri="cancel" data-k="' + k + '" data-id="' + esc(id) + '"' + (sale ? '' : ' hidden') + '>Annuler</button>' +
      (k === 'ph' ? '<button type="button" class="dz-lien" data-ri="remettre" data-id="' + esc(id) + '"' + (remettre ? '' : ' hidden') + '>Remettre la proposition</button>' : '') + '</div>';
  }
  function zoneTexte(k, id, texte, label) {
    return '<label class="dz-sr" for="ri-c-' + k + '-' + esc(id) + '">' + esc(label) + '</label><textarea class="ri-champ" id="ri-c-' + k + '-' + esc(id) + '" data-k="' + k + '" data-id="' + esc(id) + '" data-f="ri-' + k + '-' + esc(id) + '" rows="' + (k === 'ph' ? 4 : 3) + '" maxlength="' + T.LONG_MAX + '">' + esc(texte) + '</textarea>';
  }
  function cartePh(r) {
    var t = texteDe(r), b = brouillon('ph:' + r.cle, t), sale = b !== t;
    return '<li class="ri-carte" data-ph="' + r.cle + '"' + (sale ? ' data-sale' : '') + (r.cle === Z.sel ? ' data-sel' : '') + '><div class="ri-ligne"><h4 class="ri-raison">' + esc(r.raison) + '</h4><p class="ri-mention" data-m' + (sale ? ' data-sale' : '') + '>' + esc(mention(r)) + '</p></div>' +
      zoneTexte('ph', r.cle, b, (T.MAILS.indexOf(r) >= 0 ? 'Texte du mail : ' : 'Phrase d’ouverture : ') + r.raison) + '<p class="ri-err" data-e hidden role="alert"></p>' + actions('ph', r.cle, sale, b !== r.propo) + '</li>';
  }
  function apercu() {
    var r = T.raisonDe(Z.sel), b = r ? brouillon('ph:' + r.cle, texteDe(r)) : '';
    return '<li class="ri-apercu-li"><div class="ri-apercu" aria-live="polite"><p class="ri-apercu-k">Ce que la téléprospectrice lira</p><p class="ri-apercu-q" id="ri-apercu-q">« ' + esc(b.trim()) + ' »</p>' +
      '<p class="ri-apercu-m" id="ri-apercu-m">' + esc(apercuSous(r, b)) + '</p></div></li>';
  }
  function apercuSous(r, b) { return r && T.MAILS.indexOf(r) >= 0 ? 'Le mail envoyé au pharmacien à la place d’un appel : sa signature et le lien de la présentation s’ajoutent tout seuls' : r ? 'Quand elle appelle pour : ' + r.raison.charAt(0).toLowerCase() + r.raison.slice(1) + ' · se lit en environ ' + T.secondes(b) + ' secondes' : ''; }
  function carteOb(o) {
    var n = Z.comptes[o.id] || 0, max = 1;
    Z.reponses.forEach(function (x) { max = Math.max(max, Z.comptes[x.id] || 0); });
    var t = o.texte, b = brouillon('ob:' + o.id, t), sale = b !== t;
    return '<li class="ri-obj" data-ob="' + esc(o.id) + '"' + (sale ? ' data-sale' : '') + '><div class="ri-obj-g"><h4 class="ri-obj-q">« ' + esc(o.titre) + ' »</h4>' +
      '<p class="ri-fois">' + (n > 0 ? 'Entendue <b>' + n + '</b> fois ce mois-ci' : 'Pas encore entendue ce mois-ci') + '</p>' +
      '<div class="ri-barre" aria-hidden="true"><i style="width:' + Math.round(n / max * 100) + '%"></i></div></div>' +
      '<div class="ri-obj-d">' + zoneTexte('ob', o.id, b, 'Votre réponse à : ' + o.titre) + '<p class="ri-err" data-e hidden role="alert"></p>' + actions('ob', o.id, sale, false) + '</div></li>';
  }
  function interrupteur(r, cle, texte) {
    var on = r.details && r.details[cle] === true;
    return '<button type="button" class="ri-inter" role="switch" aria-checked="' + on + '" data-ri="inter" data-cle="' + cle + '" data-id="' + esc(r.id) + '"><span>' + texte + '</span><span class="ri-piste" aria-hidden="true"></span></button>';
  }
  function carteRf(r) {
    var d = r.details || {}, cite = d.citee === true, sansPos = typeof d.lat !== 'number' || typeof d.lon !== 'number';
    return '<li class="ri-ref" data-rf="' + esc(r.id) + '"' + (cite ? '' : ' data-non') + '><h4 class="ri-ref-nom">' + esc(r.titre) + '</h4><p class="ri-ref-ville">' + esc(T.villeAvecDep(d.ville, d.cp)) + '</p>' +
      '<p class="ri-ref-fait"><b>' + esc(d.pose || '') + '</b>' + (d.an ? ' · ' + esc(d.an) : '') + '</p><p class="ri-note"' + (cite ? ' data-ok' : '') + '>' + esc(T.noteReference(r)) + '</p>' +
      (sansPos ? '<p class="ri-note">Position pas trouvée : elle ne sera pas proposée « près d’elle ».</p>' : '') +
      interrupteur(r, 'citee', 'Accepte d’être citée') + interrupteur(r, 'visite', 'Accepte une visite') + '</li>';
  }
  function rubrique(id, ic, titre, sous, nb, ouvert, corps) {
    return '<details class="dz-repli ri" id="ri-' + id + '" data-ri-d="' + id + '"' + (ouvert ? ' open' : '') + '><summary data-f="ri-sum-' + id + '"><span class="rg-pastille">' + ico(IC[ic], 24) + '</span>' +
      '<span><span class="ri-t">' + esc(titre) + '</span><span class="ri-s">' + esc(sous) + '</span></span><span class="ri-nb">' + esc(nb) + '</span><i class="dz-chev" aria-hidden="true"></i></summary>' +
      '<div class="ri-corps">' + corps + '</div></details>';
  }
  function nbRetouchees() { return T.RAISONS.filter(function (r) { var l = Z.phrases[r.cle]; return l && l.texte && l.texte.trim() && l.texte.trim() !== r.propo; }).length; }

  function corpsPh() {
    return '<p class="rg-sous">Une phrase d’ouverture par raison d’appeler. Elle s’affiche en haut de la fiche, au moment où la téléprospectrice décroche. Écrivez comme vous parleriez : court, poli, sans promesse. Tant que vous n’avez rien écrit, elle lit la proposition de départ.</p>' +
      '<ul class="ri-liste" id="ri-liste-ph">' + T.RAISONS.map(cartePh).join('') + apercu() + '</ul>' +
      '<p class="rg-sous"><b>Le mail « Lui écrire plutôt ».</b> Après deux appels sans réponse, ou si le pharmacien demande une documentation, la téléprospectrice lui propose ce mail. Les mots entre accolades se remplacent tout seuls : {titulaire}, {pharmacie} et {lien} (la présentation de Yann ; la ligne qui le porte disparaît s’il n’y a pas de lien). Votre signature s’ajoute en bas.</p>' +
      '<ul class="ri-liste" id="ri-liste-mail">' + T.MAILS.map(cartePh).join('') + '</ul>';
  }
  function corpsOb() {
    var h = '<p class="rg-sous">Ce qu’elle entend le plus souvent, de la plus fréquente à la moins fréquente, avec la réponse que vous lui donnez à lire. Le nombre de fois se met à jour tout seul à chaque appel.</p>';
    if (Z.reponses.length) h += '<ul class="ri-liste-o" id="ri-liste-ob">' + T.reponsesTriees(Z.reponses, Z.comptes).map(carteOb).join('') + '</ul>';
    else h += '<div class="ri-depart"><p class="rg-sous">Rien n’est encore écrit : la téléprospectrice n’a pas de réponse à lire. Écrivez la première, ou reprenez les ' + T.REPONSES_DEPART.length + ' propositions de départ puis retouchez-les.</p>' +
      '<button type="button" class="dz-btn plein" data-ri="depart"' + (Z.occupe ? ' disabled' : '') + '>Reprendre les ' + T.REPONSES_DEPART.length + ' propositions</button></div>';
    h += '<form class="ri-form" id="ri-form-ob" data-ri-form="ob"' + (Z.formOb ? '' : ' hidden') + ' novalidate><h4 class="ri-form-t">Ajouter une objection</h4>' +
      '<label>Ce que le pharmacien dit<input type="text" id="ri-f-ob-q" autocomplete="off" maxlength="160" placeholder="Par exemple : Je dois en parler à mon associé"></label>' +
      '<label>Votre réponse, en deux ou trois lignes<textarea class="ri-champ" id="ri-f-ob-r" rows="3" maxlength="' + T.LONG_MAX + '"></textarea></label>' +
      '<p class="ri-err" id="ri-f-ob-e" role="alert" hidden></p><div class="ri-form-a"><button type="submit" class="dz-btn plein">Ajouter</button><button type="button" class="dz-btn" data-ri="annuler-form" data-f="ob">Annuler</button></div></form>' +
      '<div class="ri-pied"><button type="button" class="dz-btn" id="ri-btn-ob" data-ri="ouvrir-form" data-f="ob"' + (Z.formOb ? ' hidden' : '') + '>+ Ajouter une objection</button></div>';
    return h;
  }
  function corpsRf() {
    var h = '<p class="rg-sous">Les pharmacies que vous avez déjà équipées et que la téléprospectrice peut citer. Elles lui apparaissent quand elle appelle une pharmacie proche : les deux plus proches, avec une phrase prête. Une pharmacie dont l’interrupteur « citée » est éteint ne lui est jamais montrée.</p>';
    if (Z.refs.length) h += '<ul class="ri-liste" id="ri-liste-rf">' + Z.refs.map(carteRf).join('') + '</ul>';
    else h += '<p class="rg-sous"><b>Pas encore de référence.</b> Ajoutez la première pharmacie que vous avez équipée : elle ne sera montrée qu’avec votre accord.</p>';
    h += '<form class="ri-form" id="ri-form-rf" data-ri-form="rf"' + (Z.formRf ? '' : ' hidden') + ' novalidate><h4 class="ri-form-t">Ajouter une référence</h4><div class="ri-form-g">' +
      '<label>Nom de la pharmacie<input type="text" id="ri-f-rf-n" autocomplete="off" maxlength="160"></label><label>Ville<input type="text" id="ri-f-rf-v" autocomplete="off" maxlength="80" placeholder="Par exemple : Quimper"></label>' +
      '<label>Code postal<input type="text" id="ri-f-rf-c" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="29000"></label><label>Année<input type="text" id="ri-f-rf-a" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="2024"></label>' +
      '<label class="ri-large">Ce qui a été fait<input type="text" id="ri-f-rf-f" autocomplete="off" maxlength="160" placeholder="Par exemple : Agencement complet"></label></div>' +
      '<p class="rg-sous">Elle est ajoutée avec les deux interrupteurs éteints : vous les allumez quand le pharmacien a donné son accord. Le code postal sert à calculer la distance avec la pharmacie appelée.</p>' +
      '<p class="ri-err" id="ri-f-rf-e" role="alert" hidden></p><div class="ri-form-a"><button type="submit" class="dz-btn plein"' + (Z.occupe ? ' disabled' : '') + '>Ajouter</button><button type="button" class="dz-btn" data-ri="annuler-form" data-f="rf">Annuler</button></div></form>' +
      '<div class="ri-pied"><button type="button" class="dz-btn" id="ri-btn-rf" data-ri="ouvrir-form" data-f="rf"' + (Z.formRf ? ' hidden' : '') + '>+ Ajouter une référence</button></div>';
    return h;
  }
  function html() {
    var tete = '<div class="ri-tete"><p class="rg-sur">Pour la téléprospectrice</p><h2 id="ri-h">Ce qu’elle dit, ce qu’elle répond, qui elle peut citer</h2><p>Vous l’écrivez une fois ; elle le retrouve à l’écran pendant l’appel.</p></div>';
    if (!Z.lu) return '<section class="ri-groupe" aria-labelledby="ri-h">' + tete + '<p class="rg-sous">Chargement de vos textes…</p></section>';
    if (Z.erreur) return '<section class="ri-groupe" aria-labelledby="ri-h">' + tete + '<p class="rg-inconnu">Vos phrases, vos réponses et vos références n’ont pas pu être lues pour l’instant : rechargez la page dans quelques minutes. En attendant, la téléprospectrice lit les phrases de départ.</p></section>';
    var nbm = nbRetouchees(), top = T.reponsesTriees(Z.reponses, Z.comptes)[0], nTop = top ? Z.comptes[top.id] || 0 : 0;
    var sPh = pluriel(T.RAISONS.length, 'raison d’appeler', 'raisons d’appeler') + (nbm ? ' · ' + pluriel(nbm, 'phrase écrite par vous', 'phrases écrites par vous') : ' · toutes à leur proposition de départ');
    var sOb = !top ? 'À écrire : ce que le pharmacien répond le plus souvent' : nTop > 0 ? 'La plus entendue : « ' + top.titre + ' », ' + nTop + ' fois ce mois-ci' : 'Pas encore entendue ce mois-ci : ' + pluriel(Z.reponses.length, 'objection écrite', 'objections écrites');
    var sRf = Z.refs.length ? T.resumeReferences(Z.refs) : 'À ajouter : les pharmacies que vous avez déjà équipées';
    return '<section class="ri-groupe" aria-labelledby="ri-h">' + tete +
      rubrique('ph', 'bulle', 'Mes premières phrases', sPh, pluriel(T.RAISONS.length, 'phrase', 'phrases'), Z.ouvert.ph, corpsPh()) +
      rubrique('ob', 'reponse', 'Mes réponses', sOb, pluriel(Z.reponses.length, 'objection', 'objections'), Z.ouvert.ob, corpsOb()) +
      rubrique('rf', 'etoile', 'Mes références', sRf, pluriel(Z.refs.length, 'référence', 'références'), Z.ouvert.rf, corpsRf()) + '</section>';
  }

  /* ── dessin de la zone ── */
  function zone() { return racine && racine.querySelector('#ri-zone'); }
  function taille(t) { if (!t.offsetParent) return; t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, 96) + 'px'; }
  function tailles() { var z = zone(); if (z) Array.prototype.forEach.call(z.querySelectorAll('textarea.ri-champ'), taille); }
  function monter() {
    var z = zone(); if (!z) return;
    var act = document.activeElement, cle = act && z.contains(act) && act.getAttribute ? act.getAttribute('data-f') : null;
    var ouvrirChamp = z.querySelector('[data-ri-form]:not([hidden]) input');
    var vals = {}; Array.prototype.forEach.call(z.querySelectorAll('.ri-form input, .ri-form textarea'), function (c) { if (c.id) vals[c.id] = c.value; });
    z.innerHTML = html();
    Object.keys(vals).forEach(function (id) { var c = z.querySelector('#' + id); if (c) c.value = vals[id]; });
    placer(); tailles();
    if (cle) { var n = z.querySelector('[data-f="' + cle + '"]'); if (n) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
    else if (ouvrirChamp && (Z.formOb || Z.formRf)) { var f = z.querySelector('[data-ri-form]:not([hidden]) input'); if (f && !f.value) f.focus(); }
  }
  /* L'aperçu est dans le flux, juste sous la ligne de la phrase choisie : il ne recouvre rien. */
  function placer() {
    var ul = racine && racine.querySelector('#ri-liste-ph'); if (!ul) return;
    var li = ul.querySelector('.ri-apercu-li'), cartes = Array.prototype.slice.call(ul.querySelectorAll('[data-ph]')), card = ul.querySelector('[data-ph="' + Z.sel + '"]');
    if (!li || !card) return;
    var i = cartes.indexOf(card), une = window.matchMedia && window.matchMedia('(max-width:900px)').matches, fin = une ? i : Math.min(i | 1, cartes.length - 1);
    if (cartes[fin].nextElementSibling === li) return;
    var avant = card.getBoundingClientRect().top; cartes[fin].after(li);
    var d = card.getBoundingClientRect().top - avant; if (d) window.scrollBy(0, d);
  }
  function dire(t, err) {
    var n = document.getElementById('ri-toast');
    if (!n) { n = document.createElement('p'); n.id = 'ri-toast'; n.className = 'ri-toast'; n.setAttribute('role', 'status'); document.body.appendChild(n); }
    n.textContent = t; n.hidden = false; n.toggleAttribute('data-err', !!err);
    clearTimeout(tToast); tToast = setTimeout(function () { n.hidden = true; }, err ? 5000 : 2600);
  }

  /* ── mises à jour en place pendant la frappe ── */
  function majCarte(k, id) {
    var z = zone(); if (!z) return;
    if (k === 'ph') {
      var r = T.raisonDe(id), li = z.querySelector('[data-ph="' + id + '"]'); if (!r || !li) return;
      var t = texteDe(r), b = brouillon('ph:' + id, t), sale = b !== t;
      li.toggleAttribute('data-sale', sale); li.toggleAttribute('data-sel', id === Z.sel);
      var m = li.querySelector('[data-m]'); m.textContent = mention(r); m.toggleAttribute('data-sale', sale);
      li.querySelector('[data-ri="save"]').hidden = !sale; li.querySelector('[data-ri="cancel"]').hidden = !sale; li.querySelector('[data-ri="remettre"]').hidden = b === r.propo;
    } else {
      var li2 = z.querySelector('[data-ob="' + id + '"]'), o = Z.reponses.filter(function (x) { return x.id === id; })[0]; if (!li2 || !o) return;
      var s2 = brouillon('ob:' + id, o.texte) !== o.texte;
      li2.toggleAttribute('data-sale', s2); li2.querySelector('[data-ri="save"]').hidden = !s2; li2.querySelector('[data-ri="cancel"]').hidden = !s2;
    }
  }
  function majApercu() {
    var q = document.getElementById('ri-apercu-q'), m = document.getElementById('ri-apercu-m'), r = T.raisonDe(Z.sel); if (!q || !r) return;
    var b = brouillon('ph:' + r.cle, texteDe(r)); q.textContent = '« ' + b.trim() + ' »'; m.textContent = apercuSous(r, b);
  }
  function montrerErreur(li, m) { var e = li && li.querySelector('[data-e]'); if (e) { e.textContent = m; e.hidden = !m; } }

  /* ── écritures (directes, sous la règle d'accès « membres de l'espace ») ── */
  function ecrire(promesse, apres) {
    if (Z.occupe) return;
    Z.occupe = true;
    Promise.resolve(promesse).then(function (r) {
      Z.occupe = false;
      if (!r || r.error) { dire(PAS, true); return; }
      apres(r.data);
    }, function () { Z.occupe = false; dire(PAS, true); });
  }
  function enregistrer(k, id, li) {
    var b = sb(); if (!b || !Z.ws) { dire(PAS, true); return; }
    var now = new Date().toISOString();
    if (k === 'ph') {
      var r = T.raisonDe(id), v = T.texteValide(brouillon('ph:' + id, texteDe(r)));
      if (v.erreur) { montrerErreur(li, v.erreur); return; }
      /* Revenir à la proposition : on range un texte VIDE (rien ne se supprime) ; la proposition de départ reprend la main. */
      var texte = v.texte === r.propo ? '' : v.texte, l = Z.phrases[id];
      ecrire(l ? b.from('phirst_textes').update({ texte: texte, updated_at: now }).eq('id', l.id).select().single()
        : b.from('phirst_textes').insert({ workspace_id: Z.ws, sorte: 'phrase', cle: id, titre: r.raison, texte: texte }).select().single(), function (d) {
        Z.phrases[id] = d; delete Z.brouillons['ph:' + id]; montrerErreur(li, ''); monter();
        dire(v.alerte ? 'Enregistré. ' + v.alerte : 'Enregistré', !!v.alerte);
      });
    } else {
      var o = Z.reponses.filter(function (x) { return x.id === id; })[0], vo = T.texteValide(brouillon('ob:' + id, o.texte));
      if (vo.erreur) { montrerErreur(li, vo.erreur); return; }
      ecrire(b.from('phirst_textes').update({ texte: vo.texte, updated_at: now }).eq('id', id).select().single(), function (d) {
        Object.assign(o, d); delete Z.brouillons['ob:' + id]; monter(); dire(vo.alerte ? 'Enregistré. ' + vo.alerte : 'Enregistré', !!vo.alerte);
      });
    }
  }
  function annuler(k, id) { delete Z.brouillons[k + ':' + id]; monter(); }
  function remettre(id) {
    var r = T.raisonDe(id); Z.brouillons['ph:' + id] = r.propo; Z.sel = id; monter();
    dire('Proposition remise : cliquez sur Enregistrer pour la garder');
  }
  function basculer(id, cle) {
    var b = sb(), r = Z.refs.filter(function (x) { return x.id === id; })[0]; if (!b || !r) return;
    var d = Object.assign({}, r.details || {}); d[cle] = !(d[cle] === true);
    if (cle === 'citee' && !d.citee) d.visite = false;   // une pharmacie non citée n'est pas montrée : sa visite non plus
    ecrire(b.from('phirst_textes').update({ details: d, updated_at: new Date().toISOString() }).eq('id', id).select().single(), function (x) { Object.assign(r, x); monter(); dire('Enregistré'); });
  }
  function reprendreDepart() {
    var b = sb(); if (!b || !Z.ws) { dire(PAS, true); return; }
    var cles = [], lignes = T.REPONSES_DEPART.map(function (x) { var c = T.cleDe(x.titre, cles); cles.push(c); return { workspace_id: Z.ws, sorte: 'reponse', cle: c, titre: x.titre, texte: x.texte }; });
    ecrire(b.from('phirst_textes').insert(lignes).select(), function (d) {
      Z.reponses = Z.reponses.concat(d || []); Z.ouvert.ob = true; monter();
      dire('Enregistré : ' + pluriel(lignes.length, 'réponse reprise', 'réponses reprises') + ', à retoucher à votre idée');
    });
  }
  function ajouterObjection(f) {
    var q = f.querySelector('#ri-f-ob-q'), r = f.querySelector('#ri-f-ob-r'), e = f.querySelector('#ri-f-ob-e'), v = T.validerReponse(q.value, r.value);
    if (v.erreur) { e.textContent = v.erreur; e.hidden = false; (q.value.trim() ? r : q).focus(); return; }
    e.hidden = true;
    var b = sb(); if (!b || !Z.ws) { dire(PAS, true); return; }
    var cle = T.cleDe(v.titre, Z.reponses.map(function (x) { return x.cle; }));
    ecrire(b.from('phirst_textes').insert({ workspace_id: Z.ws, sorte: 'reponse', cle: cle, titre: v.titre, texte: v.texte }).select().single(), function (d) {
      Z.reponses.push(d); Z.formOb = false; f.reset(); monter(); dire(v.alerte ? 'Enregistré : objection ajoutée. ' + v.alerte : 'Enregistré : objection ajoutée', !!v.alerte);
    });
  }
  function ajouterReference(f) {
    var e = f.querySelector('#ri-f-rf-e');
    var v = T.validerReference({ nom: f.querySelector('#ri-f-rf-n').value, ville: f.querySelector('#ri-f-rf-v').value, cp: f.querySelector('#ri-f-rf-c').value, pose: f.querySelector('#ri-f-rf-f').value, an: f.querySelector('#ri-f-rf-a').value });
    if (v.erreur) { e.textContent = v.erreur; e.hidden = false; return; }
    e.hidden = true;
    var b = sb(); if (!b || !Z.ws) { dire(PAS, true); return; }
    Z.occupe = true;
    /* La position (pour la distance) : l'annuaire des officines du même code postal ; si rien n'est trouvé, la référence s'ajoute quand même, et le dit. */
    Promise.resolve(b.from('phirst_officines').select('nom,nom_affiche,ville,cp,lat,lon').eq('cp', v.cp).limit(60)).then(function (a) { return a && !a.error ? T.choisirPosition(a.data || [], v.nom) : null; }, function () { return null; }).then(function (pos) {
      Z.occupe = false;
      var cle = 'r-' + (window.crypto && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now()));
      var l = T.ligneReference(v, pos, cle); l.workspace_id = Z.ws;
      ecrire(b.from('phirst_textes').insert(l).select().single(), function (d) {
        Z.refs.push(d); Z.formRf = false; f.reset(); monter();
        dire(pos ? 'Enregistré : référence ajoutée' : 'Enregistré : référence ajoutée, mais sa position n’a pas été trouvée', !pos);
      });
    });
  }

  /* ── les événements (une seule fois, sur la racine de l'écran) ── */
  function brancher(r) {
    racine = r;
    if (r.__ri) return; r.__ri = true;
    function ici() { return window.V2 && window.V2.route && window.V2.route.name === 'reglages'; }
    r.addEventListener('input', function (ev) {
      var t = ev.target; if (!ici() || !t.matches || !t.matches('textarea[data-k]')) return;
      var k = t.getAttribute('data-k'), id = t.getAttribute('data-id'); Z.brouillons[k + ':' + id] = t.value; taille(t);
      var li = t.closest('li'); montrerErreur(li, '');
      if (k === 'ph') { Z.sel = id; Array.prototype.forEach.call(r.querySelectorAll('[data-ph]'), function (n) { majCarte('ph', n.getAttribute('data-ph')); }); majApercu(); } else majCarte('ob', id);
    });
    r.addEventListener('focusin', function (ev) {
      var t = ev.target; if (!ici() || !t.matches || !t.matches('textarea[data-k="ph"]')) return;
      var id = t.getAttribute('data-id'); if (id === Z.sel) return; Z.sel = id;
      Array.prototype.forEach.call(r.querySelectorAll('[data-ph]'), function (n) { majCarte('ph', n.getAttribute('data-ph')); }); majApercu(); placer();
    });
    r.addEventListener('toggle', function (ev) {
      var d = ev.target; if (!d || !d.getAttribute || !d.getAttribute('data-ri-d')) return;
      Z.ouvert[d.getAttribute('data-ri-d')] = d.open; if (d.open) tailles();
    }, true);
    r.addEventListener('click', function (ev) {
      if (!ici()) return;
      var b = ev.target.closest && ev.target.closest('[data-ri]'); if (!b) return;
      var a = b.getAttribute('data-ri'), k = b.getAttribute('data-k'), id = b.getAttribute('data-id');
      if (a === 'save') enregistrer(k, id, b.closest('li'));
      else if (a === 'cancel') annuler(k, id);
      else if (a === 'remettre') remettre(id);
      else if (a === 'inter') basculer(id, b.getAttribute('data-cle'));
      else if (a === 'depart') reprendreDepart();
      else if (a === 'ouvrir-form') { Z['form' + (b.getAttribute('data-f') === 'ob' ? 'Ob' : 'Rf')] = true; monter(); }
      else if (a === 'annuler-form') { var f = b.getAttribute('data-f'); Z['form' + (f === 'ob' ? 'Ob' : 'Rf')] = false; monter(); var bt = r.querySelector('#ri-btn-' + f); if (bt) bt.focus(); }
    });
    r.addEventListener('submit', function (ev) {
      var f = ev.target.closest && ev.target.closest('[data-ri-form]'); if (!f || !ici()) return;
      ev.preventDefault(); if (Z.occupe) return;
      if (f.getAttribute('data-ri-form') === 'ob') ajouterObjection(f); else ajouterReference(f);
    });
  }
  /* Nouvelle visite de l'écran : on repart de zéro (les brouillons non enregistrés ne survivent pas à un changement d'écran). */
  function remise() { var n = neuf(); n.jeton = Z.jeton + 1; Z = n; }

  window.PHIRST_RG_TEXTES = { html: html, lire: lire, brancher: brancher, remise: remise, monter: monter, etat: function () { return Z; } };
})();
