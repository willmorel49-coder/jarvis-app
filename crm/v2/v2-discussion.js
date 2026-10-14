/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Discussion — le fil de discussion de l'équipe (14/10/2026)
   Demande d'une commerciale : « mettre un fil de discussion comme Slack ».
   Décisions de Will (14/10/2026) : des SUJETS LIBRES que tout le monde peut créer,
   pas de découpage par officine ; toute l'équipe voit tout, direction comprise ;
   les comptes OPSO sont exclus ; aucun sujet privé.

   Tables Supabase : discussion_sujets, discussion_messages (voir migration.sql).
   • Jamais de DELETE : « retirer » un message = archive = true.
   • Pas de Realtime : relecture toutes les 45 s, SEULEMENT onglet visible et écran
     ouvert, et seulement les messages plus récents que le dernier reçu
     (cree_le > dernier) — en général 0 ligne, quelques octets (quota Supabase).
   • Non lus : dernier message vu par sujet, rangé dans le navigateur (confort par
     appareil). Si la table n'existe pas encore : « La discussion arrive bientôt ».
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  if (window.V2_BRAND && window.V2_BRAND.opso) return;   // espace OPSO : pas de discussion

  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]; }); };
  var ID = function (s) { return String(s == null ? '' : s).replace(/[^A-Za-z0-9_-]/g, ''); };   // identifiant sûr pour un onclick
  var T_SUJETS = 'discussion_sujets', T_MSG = 'discussion_messages';
  var COLS_M = 'id,sujet_id,parent_id,auteur_id,auteur_nom,texte,cree_le,modifie_le,archive';
  var COLS_S = 'id,titre,cree_par,cree_par_nom,cree_le,dernier_message_le';
  var MAX_TEXTE = 4000, MAX_TITRE = 120, PAS = 45000;

  var S = {
    etat: 'chargement',   // chargement | pret | absent | erreur | horsligne
    sujets: [],           // triés par dernier message
    msgs: {},             // sujet_id -> [messages] (seulement les sujets ouverts)
    sujet: null,          // id du sujet ouvert
    nouveau: false,       // formulaire « Nouveau sujet » ouvert
    ouverts: {},          // fils de réponses dépliés
    edit: null,           // id du message en cours de modification
    retrait: null,        // id du message en attente de confirmation de retrait
    mob: 'liste',         // liste | fil (petit écran)
    vuAvant: '',          // dernier vu du sujet à l'ouverture (pour « Nouveaux messages »)
    nonLus: {},           // sujet_id -> nombre
    dernier: '',          // cree_le du dernier message reçu (curseur de relecture)
    minuteur: null, enVol: false, derniereLecture: 0, occupe: false
  };

  // ── Petits utilitaires ──
  function client() { return (V2.sb && V2.sb()) || null; }
  function moi() { return (V2.user && V2.user.id) || ''; }
  function nomMoi() { return (V2.user && V2.user.name) || 'Moi'; }
  function plusRecent(a, b) { return (!a || (b && b > a)) ? b : a; }
  function tableAbsente(err) {
    if (!err) return false;
    var code = String(err.code || ''), msg = String(err.message || '') + ' ' + String(err.details || '');
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST106') return true;
    if (err.status === 404 || err.statusCode === 404) return true;
    return /discussion_(sujets|messages)/.test(msg) && /(could not find|does not exist|schema cache|not found)/i.test(msg);
  }
  function jourDe(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function libJour(t) {
    var d = new Date(t);
    if (jourDe(t) === jourDe(Date.now())) return 'Aujourd’hui';
    if (jourDe(t) === jourDe(Date.now() - 86400000)) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function heure(t) { return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h'); }
  function quand(t) {   // pour un message dans un fil de réponses ou une ligne de liste
    if (jourDe(t) === jourDe(Date.now())) return heure(t);
    if (jourDe(t) === jourDe(Date.now() - 86400000)) return 'Hier ' + heure(t);
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + heure(t);
  }
  function ini(nom) { var p = String(nom || '?').trim().split(/\s+/); return ((p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }
  function corps(txt) { return esc(txt).replace(/\n/g, '<br>'); }

  // ── Mémoire locale : dernier message vu par sujet (par appareil et par personne) ──
  function cleVu() { return 'jarvis_discussion_vu_v1_' + (moi() || 'anon'); }
  var VU = null;
  function lireVu() {
    if (VU) return VU;
    try { var o = JSON.parse(localStorage.getItem(cleVu()) || 'null'); if (o && o.vu) VU = o; } catch (e) {}
    if (!VU) VU = { depuis: new Date().toISOString(), vu: {} };   // 1re ouverture sur cet appareil : l'historique existant compte comme lu
    return VU;
  }
  function ecrireVu() { try { localStorage.setItem(cleVu(), JSON.stringify(VU)); } catch (e) {} }
  function vuDe(id) { var v = lireVu(); return v.vu[id] || v.depuis; }
  function marquerVu(id, iso) {
    var v = lireVu(); if (!iso) return;
    if (!v.vu[id] || iso > v.vu[id]) { v.vu[id] = iso; ecrireVu(); }
    S.nonLus[id] = 0;
  }

  // ── Accès aux données (jamais d'exception vers l'extérieur) ──
  function chargerSujets() {
    var c = client(); if (!c) return Promise.resolve({ horsligne: true });
    return c.from(T_SUJETS).select(COLS_S).eq('archive', false).order('dernier_message_le', { ascending: false }).limit(200)
      .then(function (r) { return r; }, function (e) { return { error: e }; });
  }
  function compterNonLus(sujets) {
    // Une seule requête légère : les messages d'autrui plus récents que le plus ancien « vu » des sujets à examiner.
    var c = client(), cand = sujets.filter(function (s) { return s.dernier_message_le > vuDe(s.id); });
    S.nonLus = {};
    if (!c || !cand.length) return Promise.resolve();
    var depuis = cand.reduce(function (a, s) { var v = vuDe(s.id); return (!a || v < a) ? v : a; }, '');
    return c.from(T_MSG).select('id,sujet_id,auteur_id,cree_le').eq('archive', false).gt('cree_le', depuis).order('cree_le', { ascending: true }).limit(500)
      .then(function (r) {
        (r.data || []).forEach(function (m) {
          S.dernier = plusRecent(S.dernier, m.cree_le);
          if (m.auteur_id !== moi() && m.cree_le > vuDe(m.sujet_id)) S.nonLus[m.sujet_id] = (S.nonLus[m.sujet_id] || 0) + 1;
        });
      }, function () {});
  }
  function totalNonLus() { var n = 0; for (var k in S.nonLus) n += S.nonLus[k] || 0; return n; }

  function charger(root) {
    S.etat = 'chargement'; peindre();
    return chargerSujets().then(function (r) {
      if (r.horsligne) { S.etat = 'horsligne'; return peindre(); }
      if (r.error) { S.etat = tableAbsente(r.error) ? 'absent' : 'erreur'; return peindre(); }
      S.sujets = (r.data || []).slice();
      S.etat = 'pret';
      return compterNonLus(S.sujets).then(function () {
        if (!S.dernier) S.dernier = new Date().toISOString();
        if (S.sujet && !S.sujets.some(function (s) { return s.id === S.sujet; })) S.sujet = null;
        peindre();
        if (S.sujet) ouvrirSujet(S.sujet, true);
      });
    });
  }

  function ouvrirSujet(id, garderMob) {
    S.sujet = id; S.nouveau = false; S.edit = null; S.retrait = null; S.ouverts = {};
    if (!garderMob) S.mob = 'fil';
    S.vuAvant = vuDe(id);
    var c = client(); if (!c) return;
    S.msgs[id] = S.msgs[id] || null; peindre();
    c.from(T_MSG).select(COLS_M).eq('sujet_id', id).order('cree_le', { ascending: false }).limit(300)
      .then(function (r) {
        if (S.sujet !== id) return;
        if (r.error) { if (V2.toast) V2.toast('Messages indisponibles pour le moment', 'error'); S.msgs[id] = []; return peindre(); }
        var l = (r.data || []).slice().reverse();
        S.msgs[id] = l;
        l.forEach(function (m) { S.dernier = plusRecent(S.dernier, m.cree_le); });
        marquerVu(id, l.length ? l[l.length - 1].cree_le : new Date().toISOString());
        peindre(); basDuFil();
      }, function () { S.msgs[id] = []; peindre(); });
  }

  // Relecture : ne demande QUE les messages plus récents que le dernier reçu.
  function relire() {
    if (!document.getElementById('dsc')) { arreter(); return; }
    if (document.visibilityState !== 'visible' || S.etat !== 'pret' || S.enVol) return;
    var c = client(); if (!c) return;
    S.enVol = true; S.derniereLecture = Date.now();
    c.from(T_MSG).select(COLS_M).gt('cree_le', S.dernier).order('cree_le', { ascending: true }).limit(200)
      .then(function (r) {
        S.enVol = false;
        var l = (r && r.data) || [];
        if (!l.length) return;
        var inconnu = false, ouvertTouche = false;
        l.forEach(function (m) {
          S.dernier = plusRecent(S.dernier, m.cree_le);
          var sj = S.sujets.filter(function (s) { return s.id === m.sujet_id; })[0];
          if (!sj) inconnu = true; else if (m.cree_le > sj.dernier_message_le) sj.dernier_message_le = m.cree_le;
          var deja = S.msgs[m.sujet_id];
          if (deja && !deja.some(function (x) { return x.id === m.id; })) { deja.push(m); if (m.sujet_id === S.sujet) ouvertTouche = true; }
          if (m.sujet_id === S.sujet) { marquerVu(m.sujet_id, m.cree_le); }
          else if (m.auteur_id !== moi() && !m.archive) S.nonLus[m.sujet_id] = (S.nonLus[m.sujet_id] || 0) + 1;
        });
        S.sujets.sort(function (a, b) { return a.dernier_message_le < b.dernier_message_le ? 1 : -1; });
        if (inconnu) {   // un sujet créé par quelqu'un d'autre : on relit la liste (une seule fois)
          chargerSujets().then(function (r2) { if (r2 && r2.data) { S.sujets = r2.data.slice(); peindreListe(); } });
        }
        peindreListe();
        if (ouvertTouche) { var proche = presDuBas(); peindreFlux(); if (proche) basDuFil(); }
      }, function () { S.enVol = false; });
  }
  function demarrer() {
    arreter();
    S.minuteur = setInterval(relire, PAS);
    if (!demarrer.vis) {
      demarrer.vis = true;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && document.getElementById('dsc') && Date.now() - S.derniereLecture > PAS) relire();
      });
    }
  }
  function arreter() { if (S.minuteur) { clearInterval(S.minuteur); S.minuteur = null; } }

  // ── Pièces d'affichage ──
  function sujetCourant() { return S.sujets.filter(function (s) { return s.id === S.sujet; })[0] || null; }

  function listeHtml() {
    var tot = totalNonLus();
    var h = '<div class="dsc-lh"><div><h2>Sujets</h2><span>' + (tot ? tot + (tot > 1 ? ' messages non lus' : ' message non lu') : 'Tout est lu') + '</span></div>' +
      '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.discussion.nouveau()">Nouveau sujet</button></div>';
    if (!S.sujets.length) return h + '<p class="dsc-vide">Aucun sujet pour l’instant. Lancez le premier avec « Nouveau sujet ».</p>';
    return h + '<ul class="dsc-ls">' + S.sujets.map(function (s) {
      var n = s.id === S.sujet ? 0 : (S.nonLus[s.id] || 0);
      return '<li><button type="button" class="dsc-can' + (s.id === S.sujet && !S.nouveau ? ' on' : '') + (n ? ' nl' : '') + '" onclick="V2.discussion.ouvrir(\'' + ID(s.id) + '\')">' +
        '<span class="dsc-cn"><b>' + esc(s.titre) + '</b><small>' + esc(s.cree_par_nom || 'Équipe') + ' · ' + esc(quand(s.dernier_message_le)) + '</small></span>' +
        (n ? '<em aria-label="' + n + ' non lus">' + n + '</em>' : '') + '</button></li>';
    }).join('') + '</ul>';
  }

  function messageHtml(m, reps) {
    var mien = m.auteur_id === moi(), ouvert = !!S.ouverts[m.id];
    var visibles = reps.filter(function (r) { return !r.archive; });
    var corpsHtml;
    if (m.archive) corpsHtml = '<p class="dsc-ret">Message retiré</p>';
    else if (S.edit === m.id) corpsHtml = editeurHtml(m);
    else corpsHtml = '<p>' + corps(m.texte) + (m.modifie_le ? ' <i class="dsc-mod">(modifié)</i>' : '') + '</p>';
    var actions = '';
    if (!m.archive && S.edit !== m.id) {
      actions = '<button type="button" class="dsc-lien" onclick="V2.discussion.fil(\'' + ID(m.id) + '\')" aria-expanded="' + ouvert + '">' +
        (visibles.length ? visibles.length + (visibles.length > 1 ? ' réponses' : ' réponse') : 'Répondre') + '</button>' + actionsMien(m);
    } else if (m.archive && visibles.length) {
      actions = '<button type="button" class="dsc-lien" onclick="V2.discussion.fil(\'' + ID(m.id) + '\')" aria-expanded="' + ouvert + '">' + visibles.length + (visibles.length > 1 ? ' réponses' : ' réponse') + '</button>';
    }
    return '<article class="dsc-m' + (mien ? ' moi' : '') + (m.archive ? ' ret' : '') + '" data-id="' + ID(m.id) + '">' +
      '<span class="dsc-av' + (mien ? ' moi' : '') + '" aria-hidden="true">' + esc(ini(m.auteur_nom)) + '</span>' +
      '<div class="dsc-mb"><div class="dsc-mh"><b>' + esc(m.auteur_nom) + '</b><time>' + esc(heure(m.cree_le)) + '</time></div>' + corpsHtml +
      '<div class="dsc-ma">' + actions + '</div>' +
      (ouvert ? '<div class="dsc-fil">' + visibles.map(function (r) { return reponseHtml(r); }).join('') +
        '<form class="dsc-rf" onsubmit="return V2.discussion.envoyer(event,\'' + ID(m.id) + '\')"><input type="text" name="c" data-k="r' + ID(m.id) + '" maxlength="' + MAX_TEXTE + '" autocomplete="off" placeholder="Votre réponse" aria-label="Votre réponse">' +
        '<button type="submit" class="v2-btn v2-btn-primary">Répondre</button></form></div>' : '') +
      '</div></article>';
  }
  function reponseHtml(r) {
    var mien = r.auteur_id === moi(), c;
    if (S.edit === r.id) c = editeurHtml(r);
    else c = '<p>' + corps(r.texte) + (r.modifie_le ? ' <i class="dsc-mod">(modifié)</i>' : '') + '</p>' + (mien ? '<div class="dsc-ma">' + actionsMien(r) + '</div>' : '');
    return '<div class="dsc-r" data-id="' + ID(r.id) + '"><span class="dsc-av p' + (mien ? ' moi' : '') + '" aria-hidden="true">' + esc(ini(r.auteur_nom)) + '</span>' +
      '<div class="dsc-rb"><div class="dsc-mh"><b>' + esc(r.auteur_nom) + '</b><time>' + esc(quand(r.cree_le)) + '</time></div>' + c + '</div></div>';
  }
  function actionsMien(m) {
    if (m.auteur_id !== moi()) return '';
    if (S.retrait === m.id) return '<span class="dsc-conf">Retirer ce message ?</span><button type="button" class="dsc-lien dsc-danger" onclick="V2.discussion.retirer(\'' + ID(m.id) + '\')">Oui, retirer</button>' +
      '<button type="button" class="dsc-lien dsc-gris" onclick="V2.discussion.demanderRetrait(\'\')">Annuler</button>';
    return '<button type="button" class="dsc-lien dsc-gris" onclick="V2.discussion.modifier(\'' + ID(m.id) + '\')">Modifier</button>' +
      '<button type="button" class="dsc-lien dsc-gris" onclick="V2.discussion.demanderRetrait(\'' + ID(m.id) + '\')">Retirer</button>';
  }
  function editeurHtml(m) {
    return '<form class="dsc-ed" onsubmit="return V2.discussion.enregistrer(event,\'' + ID(m.id) + '\')">' +
      '<textarea name="c" data-k="e' + ID(m.id) + '" rows="3" maxlength="' + MAX_TEXTE + '" aria-label="Modifier le message">' + esc(m.texte) + '</textarea>' +
      '<div class="dsc-edb"><button type="submit" class="v2-btn v2-btn-primary">Enregistrer</button>' +
      '<button type="button" class="v2-btn" onclick="V2.discussion.modifier(\'\')">Annuler</button></div></form>';
  }
  function fluxHtml() {
    var tous = S.msgs[S.sujet];
    if (tous === null || tous === undefined) return '<p class="dsc-vide">Chargement des messages…</p>';
    var racines = tous.filter(function (m) { return !m.parent_id; }), out = '', dernierJour = '', divise = false, me = moi();
    var repsDe = {};
    tous.forEach(function (m) { if (m.parent_id) (repsDe[m.parent_id] = repsDe[m.parent_id] || []).push(m); });
    racines = racines.filter(function (m) { return !m.archive || (repsDe[m.id] || []).some(function (r) { return !r.archive; }); });
    if (!racines.length) return '<p class="dsc-vide">Aucun message pour l’instant. Écrivez le premier.</p>';
    racines.forEach(function (m) {
      var j = jourDe(m.cree_le);
      if (j !== dernierJour) { out += '<div class="dsc-jour"><span>' + esc(libJour(m.cree_le)) + '</span></div>'; dernierJour = j; }
      if (!divise && m.cree_le > S.vuAvant && m.auteur_id !== me) { out += '<div class="dsc-nouv"><span>Nouveaux messages</span></div>'; divise = true; }
      out += messageHtml(m, repsDe[m.id] || []);
    });
    return out;
  }
  function composeurHtml() {
    return '<form class="dsc-c" onsubmit="return V2.discussion.envoyer(event,\'\')">' +
      '<textarea name="c" data-k="nouveau" rows="2" maxlength="' + MAX_TEXTE + '" placeholder="Écrire dans ce sujet" aria-label="Votre message" ' +
      'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();this.form.requestSubmit();}"></textarea>' +
      '<div class="dsc-cb"><span>Pas de chiffres de ventes dans un message : ils restent dans l’outil.</span>' +
      '<button type="submit" class="v2-btn v2-btn-primary">Envoyer</button></div></form>';
  }
  function nouveauHtml() {
    return '<div class="dsc-fenetre"><div class="dsc-th"><button type="button" class="dsc-retour" onclick="V2.discussion.retour()">← Sujets</button><div><h2>Nouveau sujet</h2><span>Visible par toute l’équipe commerciale et la direction</span></div></div>' +
      '<form class="dsc-nf" onsubmit="return V2.discussion.creer(event)">' +
      '<label for="dsc-titre">Titre du sujet</label><input id="dsc-titre" name="titre" type="text" maxlength="' + MAX_TITRE + '" autocomplete="off" placeholder="Par exemple : livraison du vendredi">' +
      '<label for="dsc-premier">Premier message</label><textarea id="dsc-premier" name="c" rows="5" maxlength="' + MAX_TEXTE + '" placeholder="Votre message"></textarea>' +
      '<div class="dsc-cb"><span>Pas de chiffres de ventes dans un message : ils restent dans l’outil.</span>' +
      '<button type="submit" class="v2-btn v2-btn-primary">Créer le sujet</button></div></form></div>';
  }
  function filHtml() {
    if (S.nouveau) return nouveauHtml();
    var s = sujetCourant();
    if (!s) return '<div class="dsc-fenetre dsc-neutre"><p class="dsc-vide">Choisissez un sujet à gauche, ou lancez-en un nouveau.</p></div>';
    return '<div class="dsc-fenetre"><div class="dsc-th"><button type="button" class="dsc-retour" onclick="V2.discussion.retour()">← Sujets</button><div><h2>' + esc(s.titre) + '</h2><span>Ouvert par ' + esc(s.cree_par_nom || 'Équipe') + ' · ' + esc(quand(s.cree_le)) + '</span></div></div>' +
      '<div class="dsc-flux" id="dsc-flux" tabindex="0" aria-label="Messages du sujet">' + fluxHtml() + '</div>' + composeurHtml() + '</div>';
  }
  function etatHtml(titre, texte, bouton) {
    return '<div class="dsc-etat"><h2>' + esc(titre) + '</h2><p>' + esc(texte) + '</p>' +
      (bouton ? '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.discussion.recharger()">Réessayer</button>' : '') + '</div>';
  }

  // ── Peinture : la liste et le fil se repeignent séparément ; la zone d'écriture, jamais pendant une relecture ──
  function peindre() {
    var box = document.getElementById('dsc'); if (!box) return;
    if (S.etat === 'chargement') { box.innerHTML = '<p class="dsc-vide">Chargement de la discussion…</p>'; return; }
    if (S.etat === 'absent') { box.innerHTML = etatHtml('La discussion arrive bientôt', 'Cet espace d’échange est en cours d’installation. Revenez dans quelques jours.'); return; }
    if (S.etat === 'horsligne') { box.innerHTML = etatHtml('Discussion indisponible', 'Il faut être connecté pour lire et écrire à l’équipe.'); return; }
    if (S.etat === 'erreur') { box.innerHTML = etatHtml('Discussion momentanément indisponible', 'Le chargement a échoué. Rien n’est perdu.', true); return; }
    box.innerHTML = '<div class="dsc-deux dsc-' + (S.mob === 'fil' ? 'surfil' : 'surliste') + '"><nav class="dsc-canaux" id="dsc-liste" aria-label="Sujets">' + listeHtml() + '</nav><div class="dsc-droite" id="dsc-droite">' + filHtml() + '</div></div>';
  }
  function peindreListe() { var n = document.getElementById('dsc-liste'); if (n) n.innerHTML = listeHtml(); }
  function garderBrouillons(zone) {
    var o = {}; if (!zone) return o;
    var a = zone.querySelectorAll('[data-k]');
    for (var i = 0; i < a.length; i++) if (a[i].value) o[a[i].getAttribute('data-k')] = a[i].value;
    return o;
  }
  function rendreBrouillons(zone, o) {
    for (var k in o) { var e = zone.querySelector('[data-k="' + k + '"]'); if (e && !e.value) e.value = o[k]; }
  }
  function peindreFlux() {   // le fil seul : les brouillons de réponse/modification sont conservés
    var f = document.getElementById('dsc-flux'); if (!f) return;
    var brouillons = garderBrouillons(f), top = f.scrollTop;
    f.innerHTML = fluxHtml();
    rendreBrouillons(f, brouillons); f.scrollTop = top;
  }
  function presDuBas() { var f = document.getElementById('dsc-flux'); return !f || (f.scrollHeight - f.scrollTop - f.clientHeight < 80); }
  function basDuFil() { var f = document.getElementById('dsc-flux'); if (f) f.scrollTop = f.scrollHeight; }

  // ── Actions (appelées depuis les boutons) ──
  function valeur(f, nom) { return String((f.elements[nom] && f.elements[nom].value) || '').trim(); }
  function echec(msg) { if (V2.toast) V2.toast(msg || 'Action impossible pour le moment', 'error'); }
  function ajouterMessage(m) {
    var l = S.msgs[m.sujet_id] = S.msgs[m.sujet_id] || [];
    if (!l.some(function (x) { return x.id === m.id; })) l.push(m);
    S.dernier = plusRecent(S.dernier, m.cree_le);
    var sj = S.sujets.filter(function (s) { return s.id === m.sujet_id; })[0];
    if (sj) sj.dernier_message_le = m.cree_le;
    S.sujets.sort(function (a, b) { return a.dernier_message_le < b.dernier_message_le ? 1 : -1; });
    marquerVu(m.sujet_id, m.cree_le);
  }

  V2.discussion = {
    etat: S,
    ouvrir: function (id) { ouvrirSujet(String(id)); },
    retour: function () { S.mob = 'liste'; S.nouveau = false; peindre(); },
    nouveau: function () { S.nouveau = true; S.mob = 'fil'; S.sujet = null; peindre(); var t = document.getElementById('dsc-titre'); if (t && t.focus) { try { t.focus({ preventScroll: true }); } catch (e) {} } },
    recharger: function () { charger(); },
    fil: function (id) { S.ouverts[id] = !S.ouverts[id]; peindreFlux(); },
    modifier: function (id) { S.edit = id || null; S.retrait = null; peindreFlux(); },
    demanderRetrait: function (id) { S.retrait = id || null; S.edit = null; peindreFlux(); },
    envoyer: function (ev, parent) {
      ev.preventDefault();
      var f = ev.target, v = valeur(f, 'c'), c = client();
      if (!v || !c || S.occupe) return false;
      if (v.length > MAX_TEXTE) { echec('Message trop long (4 000 caractères au plus)'); return false; }
      var racine = parent;
      if (parent) {   // répondre à une réponse = répondre au message d'origine du fil
        var p = (S.msgs[S.sujet] || []).filter(function (x) { return x.id === parent; })[0];
        if (p && p.parent_id) racine = p.parent_id;
      }
      S.occupe = true;
      c.from(T_MSG).insert({ sujet_id: S.sujet, parent_id: racine || null, auteur_id: moi(), auteur_nom: nomMoi(), texte: v }).select(COLS_M).single()
        .then(function (r) {
          S.occupe = false;
          if (r.error || !r.data) { echec('Message non envoyé : réessayez'); return; }
          ajouterMessage(r.data);
          if (racine) S.ouverts[racine] = true;
          if (f && f.elements && f.elements.c) f.elements.c.value = '';
          peindreListe(); peindreFlux(); if (!racine) basDuFil();
        }, function () { S.occupe = false; echec('Message non envoyé : réessayez'); });
      return false;
    },
    creer: function (ev) {
      ev.preventDefault();
      var f = ev.target, titre = valeur(f, 'titre'), v = valeur(f, 'c'), c = client();
      if (!c || S.occupe) return false;
      if (!titre) { echec('Donnez un titre au sujet'); return false; }
      if (!v) { echec('Écrivez le premier message'); return false; }
      if (titre.length > MAX_TITRE) { echec('Titre trop long (120 caractères au plus)'); return false; }
      if (v.length > MAX_TEXTE) { echec('Message trop long (4 000 caractères au plus)'); return false; }
      S.occupe = true;
      c.from(T_SUJETS).insert({ titre: titre, cree_par: moi(), cree_par_nom: nomMoi() }).select(COLS_S).single().then(function (r) {
        if (r.error || !r.data) { S.occupe = false; echec('Sujet non créé : réessayez'); return; }
        var sj = r.data;
        return c.from(T_MSG).insert({ sujet_id: sj.id, parent_id: null, auteur_id: moi(), auteur_nom: nomMoi(), texte: v }).select(COLS_M).single().then(function (r2) {
          S.occupe = false;
          S.sujets.unshift(sj); S.msgs[sj.id] = [];
          if (r2.error || !r2.data) { echec('Sujet créé, mais le premier message n’est pas parti : écrivez-le dans le sujet'); }
          else ajouterMessage(r2.data);
          S.nouveau = false; S.sujet = sj.id; S.vuAvant = new Date().toISOString(); S.mob = 'fil';
          peindre(); basDuFil();
        });
      }).then(null, function () { S.occupe = false; echec('Sujet non créé : réessayez'); });
      return false;
    },
    enregistrer: function (ev, id) {
      ev.preventDefault();
      var v = valeur(ev.target, 'c'), c = client();
      if (!v || !c) return false;
      if (v.length > MAX_TEXTE) { echec('Message trop long (4 000 caractères au plus)'); return false; }
      var maintenant = new Date().toISOString();
      c.from(T_MSG).update({ texte: v, modifie_le: maintenant }).eq('id', id).eq('auteur_id', moi()).select(COLS_M).then(function (r) {
        if (r.error || !r.data || !r.data.length) { echec('Modification impossible'); return; }
        var l = S.msgs[S.sujet] || [], m = l.filter(function (x) { return x.id === id; })[0];
        if (m) { m.texte = v; m.modifie_le = maintenant; }
        S.edit = null; peindreFlux();
      }, function () { echec('Modification impossible'); });
      return false;
    },
    retirer: function (id) {
      var c = client(); if (!c) return;
      c.from(T_MSG).update({ archive: true }).eq('id', id).eq('auteur_id', moi()).select(COLS_M).then(function (r) {
        if (r.error || !r.data || !r.data.length) { echec('Retrait impossible'); return; }
        var m = (S.msgs[S.sujet] || []).filter(function (x) { return x.id === id; })[0];
        if (m) m.archive = true;
        S.retrait = null; peindreFlux();
      }, function () { echec('Retrait impossible'); });
    }
  };

  V2.pages.discussion = {
    needs: [],
    render: function (root) {
      if (V2.user && V2.user.opsoOnly) { root.innerHTML = '<div class="v2-wrap v2-u"><p>Cet espace n’est pas ouvert à ce compte.</p></div>'; return; }
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      S.sujet = null; S.nouveau = false; S.mob = 'liste'; S.msgs = {}; S.nonLus = {}; S.dernier = ''; S.edit = null; S.retrait = null; S.ouverts = {}; S.enVol = false; S.occupe = false;
      VU = null;
      root.innerHTML = top + '<div class="v2-wrap v2-u dsc-wrap"><div class="v2-rdv-cap"><h1>Discussion</h1>' +
        '<p>Un sujet = une conversation. Tout le monde peut en lancer un, et toute l’équipe le voit. ' +
        'Les nouveaux messages arrivent toutes les 45 secondes.</p></div><div id="dsc"></div></div>';
      demarrer();
      charger();
    }
  };

  function ensureCss() {
    if (document.getElementById('v2-dsc-css')) return;
    var s = document.createElement('style'); s.id = 'v2-dsc-css';
    s.textContent = [
      '.dsc-wrap{max-width:1080px;padding-bottom:60px}',
      '#dsc{margin-top:16px}',
      '.dsc-deux{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;align-items:start}',
      '.dsc-canaux{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1);padding:10px;min-width:0}',
      '.dsc-lh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 6px 10px}',
      '.dsc-lh h2{margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em}',
      '.dsc-lh span{font-size:12.5px;color:var(--muted)}',
      '.dsc-lh .v2-btn{min-height:44px;flex:none}',
      '.dsc-ls{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;max-height:min(520px,62vh);overflow-y:auto}',
      '.dsc-can{display:flex;align-items:center;gap:8px;width:100%;min-height:56px;padding:8px 10px;border:none;border-radius:10px;background:none;font:inherit;color:var(--ip-ink);text-align:left;cursor:pointer}',
      '.dsc-can:hover{background:var(--card-2)}',
      '.dsc-can.on{background:var(--halo)}',
      '.dsc-cn{flex:1;min-width:0}',
      '.dsc-cn b{display:block;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsc-can.nl .dsc-cn b{font-weight:800}',
      '.dsc-cn small{display:block;font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsc-can em{flex:none;min-width:22px;height:22px;border-radius:999px;background:var(--ip-blue);color:#fff;font-style:normal;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;padding:0 7px}',
      '.dsc-droite{min-width:0}',
      '.dsc-fenetre{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1);min-width:0;overflow:hidden}',
      '.dsc-neutre{min-height:200px;display:flex;align-items:center;justify-content:center}',
      '.dsc-th{display:flex;align-items:center;gap:12px;padding:14px 18px 12px;border-bottom:1px solid var(--line)}',
      '.dsc-th > div{min-width:0}',
      '.dsc-th h2{margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em;overflow-wrap:anywhere}',
      '.dsc-th span{font-size:12.5px;color:var(--muted)}',
      '.dsc-retour{display:none;flex:none;min-height:44px;padding:0 4px;border:none;background:none;font:inherit;font-weight:700;color:var(--ip-blue);cursor:pointer}',
      '.dsc-flux{height:min(520px,62vh);overflow-y:auto;padding:6px 18px 14px;-webkit-overflow-scrolling:touch}',
      '.dsc-jour,.dsc-nouv{display:flex;align-items:center;gap:12px;margin:16px 0 6px;font-size:12.5px;font-weight:700;color:var(--muted)}',
      '.dsc-jour::before,.dsc-jour::after,.dsc-nouv::before,.dsc-nouv::after{content:"";flex:1;height:1px;background:var(--line)}',
      '.dsc-jour span{text-transform:capitalize}',
      '.dsc-nouv{color:var(--ip-blue)}',
      '.dsc-nouv::before,.dsc-nouv::after{background:var(--ip-blue)}',
      '.dsc-m{display:flex;gap:12px;padding:10px 0}',
      '.dsc-av{flex:none;width:38px;height:38px;border-radius:12px;background:var(--halo);color:var(--ip-blue);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}',
      '.dsc-av.moi{background:var(--ip-ink);color:#fff}',
      '.dsc-av.p{width:30px;height:30px;border-radius:10px;font-size:11.5px}',
      '.dsc-mb,.dsc-rb{min-width:0;flex:1}',
      '.dsc-mh{display:flex;align-items:baseline;gap:8px}',
      '.dsc-mh b{font-size:14px;font-weight:800}',
      '.dsc-mh time{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.dsc-m p,.dsc-r p{margin:2px 0 0;font-size:14.5px;line-height:1.5;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.dsc-m p.dsc-ret{color:var(--muted);font-style:italic}',
      '.dsc-mod{font-size:12px;color:var(--muted)}',
      '.dsc-ma{display:flex;flex-wrap:wrap;align-items:center;gap:0 14px;margin-top:2px}',
      '.dsc-lien{min-height:44px;padding:0;border:none;background:none;font:inherit;font-size:13px;font-weight:700;color:var(--ip-blue);cursor:pointer}',
      '.dsc-lien.dsc-gris{color:var(--muted);font-weight:600}',
      '.dsc-lien.dsc-danger{color:#B42318}',
      '.dsc-conf{font-size:13px;color:var(--ip-ink)}',
      '.dsc-fil{margin:0 0 4px;padding:6px 0 0 4px;display:flex;flex-direction:column;gap:10px}',
      '.dsc-r{display:flex;gap:10px}',
      '.dsc-rf{display:flex;gap:8px;flex-wrap:wrap}',
      '.dsc-rf input{flex:1 1 180px;min-width:0;min-height:44px;padding:8px 12px;border:1px solid var(--line-strong);border-radius:10px;font:inherit;font-size:16px;background:#fff;color:var(--ip-ink)}',
      '.dsc-rf .v2-btn,.dsc-edb .v2-btn{min-height:44px}',
      '.dsc-ed textarea{display:block;width:100%;box-sizing:border-box;min-height:80px;margin-top:4px;padding:10px 12px;border:1px solid var(--line-strong);border-radius:10px;font:inherit;font-size:16px;line-height:1.45;background:#fff;color:var(--ip-ink)}',
      '.dsc-edb{display:flex;gap:8px;margin-top:6px}',
      '.dsc-vide{margin:24px 18px;color:var(--muted);font-size:14px}',
      '.dsc-etat{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1);padding:40px 24px;text-align:center}',
      '.dsc-etat h2{margin:0 0 8px;font-size:18px;font-weight:800}',
      '.dsc-etat p{margin:0 0 14px;color:var(--muted);font-size:14.5px}',
      '.dsc-c{border-top:1px solid var(--line);padding:12px 14px;background:var(--card-2)}',
      '.dsc-c textarea,.dsc-nf textarea,.dsc-nf input{display:block;width:100%;box-sizing:border-box;min-height:64px;padding:10px 12px;border:1px solid var(--line-strong);border-radius:12px;font:inherit;font-size:16px;line-height:1.45;resize:none;background:#fff;color:var(--ip-ink)}',
      '.dsc-nf input{min-height:48px}',
      '.dsc-c textarea:focus,.dsc-rf input:focus,.dsc-nf textarea:focus,.dsc-nf input:focus,.dsc-ed textarea:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.dsc-nf{padding:14px 18px 16px}',
      '.dsc-nf label{display:block;margin:10px 0 6px;font-size:13px;font-weight:700;color:var(--ip-ink)}',
      '.dsc-cb{display:flex;align-items:center;gap:10px;margin-top:10px}',
      '.dsc-cb span{flex:1;font-size:12.5px;color:var(--muted)}',
      '.dsc-cb .v2-btn{min-height:44px}',
      '@media (max-width:760px){',
      '  .dsc-wrap{padding-left:14px;padding-right:14px}',
      '  .dsc-deux{grid-template-columns:1fr}',
      '  .dsc-surliste .dsc-droite{display:none}',
      '  .dsc-surfil .dsc-canaux{display:none}',
      '  .dsc-retour{display:inline-flex;align-items:center}',
      '  .dsc-ls{max-height:none}',
      '  .dsc-flux{padding:4px 12px 12px;height:min(440px,56vh)}',
      '  .dsc-th{padding:10px 12px}',
      '  .dsc-nf{padding:12px}',
      '  .dsc-cb span{font-size:12px}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
