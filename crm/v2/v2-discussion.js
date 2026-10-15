/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Discussion — « Fil commun » (15/10/2026, version B choisie par Will)
   Le fil de l'équipe mêle, du plus récent au plus ancien, les messages de TOUS les sujets
   et les remontées (le mur d'idées) sous forme de cartes. Les sujets restent à gauche.
   Décisions de Will : sujets libres que tout le monde crée ; toute l'équipe voit tout,
   direction comprise ; aucun sujet privé ; comptes OPSO exclus.

   Tables : discussion_sujets (+ remontee_id), discussion_messages (+ pieces jsonb),
   discussion_reactions, improvements, profils (réponses de la direction).
   • Jamais de DELETE : « retirer » un message = archive = true ; retirer sa réaction = archive = true.
   • Fichiers : seau FERMÉ excel-imports, liens temporaires de 1 h, relus au bout de 45 min.
   • Pas de Realtime : relecture toutes les 45 s, SEULEMENT onglet visible et écran ouvert.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  if (window.V2_BRAND && window.V2_BRAND.opso) return;   // espace OPSO : pas de discussion

  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]; }); };
  var ID = function (s) { return String(s == null ? '' : s).replace(/[^A-Za-z0-9_-]/g, ''); };   // identifiant sûr pour un onclick
  var T_SUJETS = 'discussion_sujets', T_MSG = 'discussion_messages', T_REA = 'discussion_reactions', T_IMP = 'improvements';
  var COLS_M = 'id,sujet_id,parent_id,auteur_id,auteur_nom,texte,cree_le,modifie_le,archive,pieces';
  var COLS_S = 'id,titre,cree_par,cree_par_nom,cree_le,dernier_message_le,remontee_id';
  var COLS_R = 'id,message_id,auteur_id,auteur_nom,emoji,cree_le,archive';
  var MAX_TEXTE = 4000, MAX_TITRE = 120, PAS = 45000;
  var SEAU = 'excel-imports', MAX_OCTETS = 20 * 1048576, COTE = 2000, MAX_PJ = 5, ACCEPT = 'image/*,.pdf,.xls,.xlsx,.csv';
  var EMOJIS = ['👍', '✅', '👀', '🙏'];
  var LIB_EMOJI = ['Pouce levé', 'Fait', 'Je regarde', 'Merci'];
  // Mêmes libellés et mêmes couleurs que v2-remontees.js
  var STATUT = { nouveau: { l: 'Nouveau', c: 'var(--c-amber)' }, 'en cours': { l: 'En réflexion', c: 'var(--ip-blue)' }, fait: { l: 'Fait', c: 'var(--c-mint)' } };
  var REP = { st: 'groupement', sid: '__remontees_reponses__' };

  var S = {
    etat: 'chargement',   // chargement | pret | absent | erreur | horsligne
    sujets: [],           // sujets ordinaires, triés par dernier message
    rems: [],             // sujets de commentaires d'une remontée (remontee_id) : vivent avec leur remontée
    msgs: {},             // id -> message (tous sujets confondus)
    pleins: {},           // sujet_id -> true quand tout le sujet a été lu
    rx: {},               // message_id -> [réactions]
    imps: [], reponses: {}, capIds: {},   // remontées, réponses de la direction, remontées qui ont une capture
    urls: {}, urlsLe: 0,  // chemin -> lien temporaire
    sujet: null,          // sujet ouvert ; null = Fil de l'équipe
    nouveau: false,       // formulaire « Nouveau sujet » ouvert
    filtre: 'tout',       // tout | messages | remontees | fichiers | mentions
    q: '', res: null, rechId: 0,   // recherche
    fich: null, fk: 'tout',        // espace Fichiers et liens d'un sujet : null | 'sujet' | 'equipe' ; sous-filtre
    cible: '',            // sujet choisi dans le menu du fil
    ouverts: {}, rOuvert: {}, repRem: null,
    edit: null, retrait: null,
    mob: 'liste',         // liste | fil (petit écran)
    vuAvant: '', vuFil: {}, vuTimer: null,
    nonLus: {}, dernier: '', dernierImp: '',
    pj: {}, bro: {},      // pièces à joindre par zone d'écriture ; brouillons
    mention: null, vise: null,
    minuteur: null, enVol: false, derniereLecture: 0, occupe: false, nbLectures: 0
  };

  // ── Petits utilitaires ──
  function client() { return (V2.sb && V2.sb()) || null; }
  function moi() { return (V2.user && V2.user.id) || ''; }
  function nomMoi() { return (V2.user && V2.user.name) || 'Moi'; }
  function estAdmin() { return !!(V2.user && V2.user.role === 'admin'); }
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
  function quand(t) {
    if (jourDe(t) === jourDe(Date.now())) return heure(t);
    if (jourDe(t) === jourDe(Date.now() - 86400000)) return 'Hier ' + heure(t);
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + heure(t);
  }
  function ini(nom) { var p = String(nom || '?').trim().split(/\s+/); return ((p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function prenom(nom) { return String(nom || '').trim().split(/\s+/)[0] || ''; }
  function poids(o) { o = +o || 0; if (o < 1024) return o + ' o'; if (o < 1048576) return Math.round(o / 1024) + ' Ko'; return (o / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }
  function libType(t) { return t === 'image' ? 'Photo' : t === 'pdf' ? 'PDF' : t === 'excel' ? 'Excel' : 'Fichier'; }
  function debut(txt, n) { txt = String(txt || '').replace(/\s+/g, ' ').trim(); return txt.length > n ? txt.slice(0, n - 1) + '…' : txt; }
  function echec(msg) { if (V2.toast) V2.toast(msg || 'Action impossible pour le moment', 'error'); }

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

  // ── Le magasin de messages ──
  function liste() { return Object.keys(S.msgs).map(function (k) { return S.msgs[k]; }); }
  function msgsDe(sid) { return liste().filter(function (m) { return m.sujet_id === sid; }); }
  function ordinaire(id) { return S.sujets.filter(function (s) { return s.id === id; })[0] || null; }
  function sujetRemParId(id) { return S.rems.filter(function (s) { return s.id === id; })[0] || null; }
  function remSujet(remId) { return S.rems.filter(function (s) { return String(s.remontee_id) === String(remId); })[0] || null; }
  function remontee(id) { return S.imps.filter(function (i) { return String(i.id) === String(id); })[0] || null; }
  function sujetCourant() { return ordinaire(S.sujet); }
  function ajouterMsg(m) {
    if (!Array.isArray(m.pieces)) m.pieces = [];
    S.msgs[m.id] = m;
    S.dernier = plusRecent(S.dernier, m.cree_le);
  }
  function rangerSujets(data) {
    S.sujets = []; S.rems = [];
    (data || []).forEach(function (s) { if (s.remontee_id) S.rems.push(s); else S.sujets.push(s); });
  }
  function calculerNonLus() {
    S.nonLus = {};
    liste().forEach(function (m) {
      if (!ordinaire(m.sujet_id) || m.archive || m.auteur_id === moi()) return;
      if (m.cree_le > vuDe(m.sujet_id)) S.nonLus[m.sujet_id] = (S.nonLus[m.sujet_id] || 0) + 1;
    });
  }
  function totalNonLus() { var n = 0; for (var k in S.nonLus) n += S.nonLus[k] || 0; return n; }

  // ── Accès aux données (jamais d'exception vers l'extérieur) ──
  function attrape(p) { return p.then(function (r) { return r; }, function (e) { return { error: e || true }; }); }
  function chargerSujets() {
    var c = client(); if (!c) return Promise.resolve({ horsligne: true });
    return attrape(c.from(T_SUJETS).select(COLS_S).eq('archive', false).order('dernier_message_le', { ascending: false }).limit(200));
  }
  function chargerCaps(c) {   // quelles remontées ont une capture : une lecture du dossier
    S.capIds = {};
    if (!c.storage) return Promise.resolve();
    return c.storage.from(SEAU).list('remontees', { limit: 1000 }).then(function (r) {
      if (r.error || !r.data) return;
      var connus = {}; S.imps.forEach(function (i) { connus[i.id + '.jpg'] = i.id; });
      r.data.forEach(function (f) { if (f.id && connus[f.name]) S.capIds[connus[f.name]] = true; });
    }).catch(function () {});
  }
  // Liens temporaires de tout ce qui est affiché, EN UNE FOIS ; gardés 45 min puis relus.
  function signer() {
    var c = client(); if (!c || !c.storage) return Promise.resolve();
    if (S.urlsLe && Date.now() - S.urlsLe > 45 * 60000) { S.urls = {}; S.urlsLe = 0; }
    var need = [], vus = {};
    var voir = function (p) { if (p && !vus[p] && !Object.prototype.hasOwnProperty.call(S.urls, p)) { vus[p] = 1; need.push(p); } };
    liste().forEach(function (m) { (m.pieces || []).forEach(function (p) { voir(p.chemin); }); });
    Object.keys(S.capIds).forEach(function (id) { voir('remontees/' + id + '.jpg'); });
    if (!need.length) return Promise.resolve();
    return c.storage.from(SEAU).createSignedUrls(need, 3600).then(function (s) {
      if (s.error || !s.data) return;
      if (!S.urlsLe) S.urlsLe = Date.now();
      s.data.forEach(function (x, i) { var p = (x && x.path) || need[i]; S.urls[p] = (x && x.signedUrl) || false; });
    }).catch(function () {});
  }
  function urlPiece(p) { return (p && S.urls[p.chemin]) || ''; }
  function urlCap(id) { return S.urls['remontees/' + id + '.jpg'] || ''; }
  function chargerRx(ids) {
    var c = client(); if (!c || !ids.length) return Promise.resolve();
    var morceaux = []; for (var i = 0; i < ids.length; i += 100) morceaux.push(ids.slice(i, i + 100));
    return Promise.all(morceaux.map(function (l) {
      return c.from(T_REA).select(COLS_R).in('message_id', l).eq('archive', false).then(function (r) {
        if (r.error || !r.data) return;
        l.forEach(function (id) { S.rx[id] = []; });
        r.data.forEach(function (x) { (S.rx[x.message_id] = S.rx[x.message_id] || []).push(x); });
      }, function () {});
    }));
  }
  function enrichir(ids) {   // réactions + liens des pièces, puis le fil est repeint
    return Promise.all([chargerRx(ids || Object.keys(S.msgs)), signer()]).then(function () { peindreFlux(); }, function () {});
  }

  function charger() {
    S.etat = 'chargement'; peindre();
    var c = client();
    if (!c) { S.etat = 'horsligne'; return peindre(); }
    var ms = attrape(c.from(T_MSG).select(COLS_M).order('cree_le', { ascending: false }).limit(300));
    var im = attrape(c.from(T_IMP).select('*').order('created_at', { ascending: false }));
    var rep = attrape(c.from('profils').select('data').eq('scope_type', REP.st).eq('scope_id', REP.sid).maybeSingle());
    return Promise.all([chargerSujets(), ms, im, rep]).then(function (a) {
      var rs = a[0], rm = a[1], ri = a[2], rr = a[3];
      if (rs.horsligne) { S.etat = 'horsligne'; return peindre(); }
      if (rs.error) { S.etat = tableAbsente(rs.error) ? 'absent' : 'erreur'; return peindre(); }
      if (rm.error) { S.etat = tableAbsente(rm.error) ? 'absent' : 'erreur'; return peindre(); }
      rangerSujets(rs.data);
      S.msgs = {}; S.dernier = '';
      (rm.data || []).forEach(ajouterMsg);
      S.imps = (!ri.error && ri.data) ? ri.data.slice() : [];
      S.dernierImp = S.imps.reduce(function (acc, i) { return plusRecent(acc, i.created_at); }, '');
      S.reponses = (!rr.error && rr.data && rr.data.data) || {};
      S.etat = 'pret';
      calculerNonLus();
      if (!S.dernier) S.dernier = new Date().toISOString();
      if (S.sujet && !ordinaire(S.sujet)) S.sujet = null;
      if (!S.cible || !ordinaire(S.cible)) S.cible = S.sujets[0] ? S.sujets[0].id : '';
      snapVuFil();
      peindre();
      chargerCaps(c).then(function () { return enrichir(); });
      if (S.sujet) ouvrirSujet(S.sujet, true);
    });
  }

  // Les messages de l'ensemble du fil sont « vus » après quelques secondes d'affichage (pas à l'ouverture,
  // sinon les pastilles de la liste disparaîtraient avant d'avoir été lues).
  function snapVuFil() { S.vuFil = {}; S.sujets.forEach(function (s) { S.vuFil[s.id] = vuDe(s.id); }); }
  function planifierVuFil() {
    if (S.vuTimer) { clearTimeout(S.vuTimer); S.vuTimer = null; }
    if (S.sujet || S.nouveau || S.etat !== 'pret') return;
    S.vuTimer = setTimeout(function () {
      S.vuTimer = null;
      if (S.sujet || S.nouveau || !document.getElementById('dsc') || document.visibilityState !== 'visible') return;
      S.sujets.forEach(function (s) {
        var der = ''; msgsDe(s.id).forEach(function (m) { der = plusRecent(der, m.cree_le); });
        if (der) marquerVu(s.id, der);
      });
      peindreListe();
    }, 6000);
  }

  function ouvrirSujet(id, garderMob, cible) {
    S.sujet = id; S.nouveau = false; S.edit = null; S.retrait = null; S.ouverts = {}; S.fich = null; S.q = ''; S.res = null;
    if (S.vuTimer) { clearTimeout(S.vuTimer); S.vuTimer = null; }
    if (!garderMob) S.mob = 'fil';
    S.vuAvant = vuDe(id);
    var cm = cible && S.msgs[cible];
    if (cm && cm.parent_id) S.ouverts[cm.parent_id] = true;
    var c = client(); if (!c) return;
    peindre(); if (cible) viser(cible);
    c.from(T_MSG).select(COLS_M).eq('sujet_id', id).order('cree_le', { ascending: false }).limit(300)
      .then(function (r) {
        if (S.sujet !== id) return;
        if (r.error) { if (V2.toast) V2.toast('Messages indisponibles pour le moment', 'error'); S.pleins[id] = true; return peindre(); }
        var der = '';
        (r.data || []).forEach(function (m) { ajouterMsg(m); der = plusRecent(der, m.cree_le); });
        S.pleins[id] = true;
        marquerVu(id, der || new Date().toISOString());
        var cm2 = cible && S.msgs[cible]; if (cm2 && cm2.parent_id) S.ouverts[cm2.parent_id] = true;
        peindre();
        if (cible) viser(cible); else basDuFil();
        enrichir(msgsDe(id).map(function (m) { return m.id; }));
      }, function () { S.pleins[id] = true; peindre(); });
  }
  function viser(mid) {   // fait défiler jusqu'au message et le met en évidence un instant (la marque survit aux repeintures)
    S.vise = mid;
    var pose = function () {
      var f = document.getElementById('dsc-flux'); if (!f) return;
      var e = f.querySelector('[data-id="' + ID(mid) + '"]'); if (!e) return;
      e.classList.add('vise');
      f.scrollTop = Math.max(0, e.offsetTop - f.offsetTop - 12);
    };
    setTimeout(pose, 60); setTimeout(pose, 700);
    clearTimeout(viser.t);
    viser.t = setTimeout(function () { S.vise = null; var e = document.querySelector('#dsc-flux .vise'); if (e) e.classList.remove('vise'); }, 3200);
  }

  // Relecture : ne demande QUE les messages plus récents que le dernier reçu (et les remontées nouvelles).
  function relire() {
    if (!document.getElementById('dsc')) { arreter(); return; }
    if (document.visibilityState !== 'visible' || S.etat !== 'pret' || S.enVol) return;
    var c = client(); if (!c) return;
    S.enVol = true; S.derniereLecture = Date.now(); S.nbLectures++;
    var pm = attrape(c.from(T_MSG).select(COLS_M).gt('cree_le', S.dernier).order('cree_le', { ascending: true }).limit(200));
    var pi = S.dernierImp ? attrape(c.from(T_IMP).select('*').gt('created_at', S.dernierImp).order('created_at', { ascending: true })) : Promise.resolve({ data: [] });
    Promise.all([pm, pi]).then(function (a) {
      S.enVol = false;
      var l = (a[0] && a[0].data) || [], nouvImp = (a[1] && a[1].data) || [];
      var inconnu = false, ouvertTouche = false, filTouche = false;
      nouvImp.forEach(function (i) { if (!remontee(i.id)) { S.imps.unshift(i); filTouche = true; } S.dernierImp = plusRecent(S.dernierImp, i.created_at); });
      l.forEach(function (m) {
        if (S.msgs[m.id]) return;
        ajouterMsg(m);
        var sj = ordinaire(m.sujet_id) || sujetRemParId(m.sujet_id);
        if (!sj) inconnu = true; else if (m.cree_le > sj.dernier_message_le) sj.dernier_message_le = m.cree_le;
        if (m.sujet_id === S.sujet) { ouvertTouche = true; marquerVu(m.sujet_id, m.cree_le); }
        else { filTouche = true; if (ordinaire(m.sujet_id) && m.auteur_id !== moi() && !m.archive) S.nonLus[m.sujet_id] = (S.nonLus[m.sujet_id] || 0) + 1; }
      });
      if (!l.length && !nouvImp.length) { if (S.nbLectures % 3 === 0) rafraichirRx(); return; }
      S.sujets.sort(function (x, y) { return x.dernier_message_le < y.dernier_message_le ? 1 : -1; });
      if (inconnu) {   // un sujet créé par quelqu'un d'autre : on relit la liste (une seule fois)
        chargerSujets().then(function (r2) { if (r2 && r2.data) { rangerSujets(r2.data); peindreListe(); peindreFlux(); } });
      }
      peindreListe();
      if (ouvertTouche || (filTouche && !S.sujet)) { var proche = presDuBas(); peindreFlux(); if (ouvertTouche && proche) basDuFil(); }
      if (!S.sujet) planifierVuFil();
      enrichir(l.map(function (m) { return m.id; }));
    }, function () { S.enVol = false; });
  }
  function rafraichirRx() {   // les réactions des autres : de temps en temps, pour ce qui est à l'écran
    var ids = S.sujet ? msgsDe(S.sujet).map(function (m) { return m.id; }) : liste().sort(function (a, b) { return a.cree_le < b.cree_le ? 1 : -1; }).slice(0, 80).map(function (m) { return m.id; });
    if (ids.length) chargerRx(ids).then(function () { peindreFlux(); });
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
  function arreter() { if (S.minuteur) { clearInterval(S.minuteur); S.minuteur = null; } if (S.vuTimer) { clearTimeout(S.vuTimer); S.vuTimer = null; } }

  // ── Texte : liens cliquables et mentions (le texte est ÉCHAPPÉ avant de poser quoi que ce soit) ──
  var RE_URL = /https?:\/\/[^\s<>"']+/g;
  function coupeFin(u) { var mm = /[.,;:!?)\]»]+$/.exec(u); return mm ? [u.slice(0, -mm[0].length), mm[0]] : [u, '']; }
  function domaine(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  function lienHtml(u) {
    var h;
    try { var o = new URL(u); if (!/^https?:$/.test(o.protocol)) return esc(u); h = o.hostname.replace(/^www\./, ''); } catch (e) { return esc(u); }
    return '<a class="dsc-lk" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" title="' + esc(u) + '">' + esc(h) + '</a>';
  }
  function prenomMoi() { return norm(prenom(nomMoi())); }
  function brut(s) {
    return esc(s).replace(/(^|[^\wÀ-ÿ])@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*)/g, function (t, avant, nom) {
      return avant + '<span class="dsc-at' + (norm(nom) === prenomMoi() ? ' moi' : '') + '">@' + nom + '</span>';
    }).replace(/\n/g, '<br>');
  }
  function texteHtml(txt) {
    txt = String(txt == null ? '' : txt);
    var out = '', last = 0, x; RE_URL.lastIndex = 0;
    while ((x = RE_URL.exec(txt))) {
      var c = coupeFin(x[0]);
      out += brut(txt.slice(last, x.index)) + lienHtml(c[0]) + esc(c[1]);
      last = x.index + x[0].length;
    }
    return out + brut(txt.slice(last));
  }
  function liensDe(txt) {
    var l = [], x; RE_URL.lastIndex = 0; txt = String(txt || '');
    while ((x = RE_URL.exec(txt))) l.push(coupeFin(x[0])[0]);
    return l;
  }
  function mentionMoi(m) {
    if (!m || m.archive || m.auteur_id === moi()) return false;
    var re = /(^|[^\wÀ-ÿ])@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*)/g, x, p = prenomMoi();
    while ((x = re.exec(String(m.texte || '')))) if (norm(x[2]) === p) return true;
    return false;
  }
  function surligne(brutTxt, mot) {   // <mark> sur le mot cherché, sans tenir compte des accents ni de la casse
    var t = String(brutTxt || ''), n = '';
    for (var i = 0; i < t.length; i++) { var u = t.charAt(i).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); n += u.length ? u.charAt(0) : ' '; }
    var q = norm(mot).trim(), k = q ? n.indexOf(q) : -1;
    var a = 0, b = t.length;
    if (k > 70) { a = k - 60; }
    if (t.length - a > 190) { b = a + 190; }
    var out = a > 0 ? '…' : '', pos = a;
    while (q && k >= 0 && k < b) {
      out += esc(t.slice(pos, k)) + '<mark>' + esc(t.slice(k, k + q.length)) + '</mark>';
      pos = k + q.length; k = n.indexOf(q, pos);
    }
    return out + esc(t.slice(pos, b)) + (b < t.length ? '…' : '');
  }
  function personnes() {
    var vus = {}, l = [];
    var voir = function (n) { n = String(n || '').trim(); if (n && n !== nomMoi() && !vus[n]) { vus[n] = 1; l.push(n); } };
    liste().forEach(function (m) { voir(m.auteur_nom); });
    S.imps.forEach(function (i) { voir(i.author_name); });
    S.sujets.forEach(function (s) { voir(s.cree_par_nom); });
    return l.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
  }

  // ── Pièces jointes d'un message ──
  var ICO_DOC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
  var ICO_XLS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/></svg>';
  var ICO_LIEN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
  var ICO_CLIP = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.7 1.7 0 0 1-2.4-2.4l8.3-8.3"/></svg>';
  var ICO_IDEE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>';
  var ICO_FIL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';
  function icoType(t) { return t === 'excel' ? ICO_XLS : ICO_DOC; }

  function piecesHtml(m) {
    var l = m.pieces || []; if (!l.length || m.archive) return '';
    var imgs = '', docs = '';
    l.forEach(function (p) {
      var u = urlPiece(p);
      if (p.type === 'image') {
        imgs += u ? '<button type="button" class="dsc-ph" data-src="' + esc(u) + '" data-nom="' + esc(p.nom) + '" onclick="V2.discussion.zoom(this)" title="Agrandir la photo"><img loading="lazy" src="' + esc(u) + '" alt="' + esc(p.nom) + '"></button>'
          : '<span class="dsc-ph vide" title="' + esc(p.nom) + '">Photo en cours de chargement</span>';
      } else {
        var corpsDoc = '<i class="dsc-di ' + esc(p.type) + '">' + icoType(p.type) + '</i><span><b>' + esc(p.nom) + '</b><small>' + libType(p.type) + ' · ' + poids(p.octets) + '</small></span>';
        docs += u ? '<a class="dsc-doc" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer" title="Ouvrir ' + esc(p.nom) + '">' + corpsDoc + '</a>'
          : '<span class="dsc-doc vide">' + corpsDoc + '</span>';
      }
    });
    return '<div class="dsc-pjs">' + imgs + docs + '</div>';
  }

  // ── Réactions rapides : 4, toujours les mêmes ──
  function reactionsHtml(m) {
    if (m.archive) return '';
    var rows = S.rx[m.id] || [];
    return '<div class="dsc-rx" role="group" aria-label="Réactions">' + EMOJIS.map(function (e, k) {
      var qui = rows.filter(function (r) { return r.emoji === e; }), n = qui.length;
      var mien = qui.some(function (r) { return r.auteur_id === moi(); });
      var noms = qui.map(function (r) { return r.auteur_nom; }).join(', ');
      return '<button type="button" class="dsc-re' + (n ? ' a' : '') + (mien ? ' moi' : '') + '" data-qui="' + esc(noms || LIB_EMOJI[k]) + '" title="' + esc(n ? noms : LIB_EMOJI[k]) + '" aria-pressed="' + mien + '" ' +
        'aria-label="' + esc(LIB_EMOJI[k] + (n ? ', ' + n + (n > 1 ? ' personnes' : ' personne') : '') + (mien ? ', votre réaction' : '')) + '" onclick="V2.discussion.reagir(\'' + ID(m.id) + '\',' + k + ')">' +
        '<span aria-hidden="true">' + e + '</span>' + (n ? '<b>' + n + '</b>' : '') + '</button>';
    }).join('') + '</div>';
  }

  // ── Un message (dans le fil de l'équipe ou dans un sujet) ──
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
  function corpsMsg(m) {
    if (m.archive) return '<p class="dsc-ret">Message retiré</p>';
    if (S.edit === m.id) return editeurHtml(m);
    return (m.texte ? '<p>' + texteHtml(m.texte) + (m.modifie_le ? ' <i class="dsc-mod">(modifié)</i>' : '') + '</p>' : '') + piecesHtml(m);
  }
  function reponseHtml(r) {
    var mien = r.auteur_id === moi();
    return '<div class="dsc-r" data-id="' + ID(r.id) + '"><span class="dsc-av p' + (mien ? ' moi' : '') + '" aria-hidden="true">' + esc(ini(r.auteur_nom)) + '</span>' +
      '<div class="dsc-rb"><div class="dsc-mh"><b>' + esc(r.auteur_nom) + '</b><time>' + esc(quand(r.cree_le)) + '</time></div>' +
      corpsMsg(r) + reactionsHtml(r) + (mien && S.edit !== r.id ? '<div class="dsc-ma">' + actionsMien(r) + '</div>' : '') + '</div></div>';
  }
  function messageHtml(m, reps, ctx) {   // ctx : 'sujet' | 'fil'
    var mien = m.auteur_id === moi(), ouvert = !!S.ouverts[m.id];
    var visibles = reps.filter(function (r) { return !r.archive; });
    var ment = mentionMoi(m);
    var nv = ctx === 'fil' && !m.archive && m.auteur_id !== moi() && S.vuFil[m.sujet_id] && m.cree_le > S.vuFil[m.sujet_id];
    var actions = '', n = visibles.length;
    if (ctx === 'fil') {
      var sj = ordinaire(m.sujet_id), par = m.parent_id && S.msgs[m.parent_id];
      var rep = par ? '<div class="dsc-enrep">en réponse à ' + esc(par.auteur_nom) + '</div>' : '';
      var tag = '<button type="button" class="dsc-tag" onclick="V2.discussion.vers(\'' + ID(m.sujet_id) + '\',\'' + ID(m.id) + '\')" title="Ouvrir le sujet sur ce message">' + esc(sj ? sj.titre : 'Sujet') + '</button>';
      actions = '<button type="button" class="dsc-lien" onclick="V2.discussion.vers(\'' + ID(m.sujet_id) + '\',\'' + ID(m.id) + '\')">' + (n ? n + (n > 1 ? ' réponses' : ' réponse') : 'Répondre') + '</button>' + actionsMien(m);
      return '<article class="dsc-m' + (mien ? ' moi' : '') + (ment ? ' ment' : '') + (nv ? ' nv' : '') + (S.vise === m.id ? ' vise' : '') + '" data-id="' + ID(m.id) + '">' +
        '<span class="dsc-av' + (mien ? ' moi' : '') + '" aria-hidden="true">' + esc(ini(m.auteur_nom)) + '</span>' +
        '<div class="dsc-mb"><div class="dsc-mh"><b>' + esc(m.auteur_nom) + '</b>' + tag + '<time>' + esc(quand(m.cree_le)) + '</time>' +
        (ment ? '<em class="dsc-pm">Vous êtes mentionné</em>' : '') + (nv ? '<em class="dsc-pn">Nouveau</em>' : '') + '</div>' +
        rep + corpsMsg(m) + reactionsHtml(m) + '<div class="dsc-ma">' + actions + '</div></div></article>';
    }
    if (!m.archive && S.edit !== m.id) {
      actions = '<button type="button" class="dsc-lien" onclick="V2.discussion.fil(\'' + ID(m.id) + '\')" aria-expanded="' + ouvert + '">' + (n ? n + (n > 1 ? ' réponses' : ' réponse') : 'Répondre') + '</button>' + actionsMien(m);
    } else if (m.archive && n) {
      actions = '<button type="button" class="dsc-lien" onclick="V2.discussion.fil(\'' + ID(m.id) + '\')" aria-expanded="' + ouvert + '">' + n + (n > 1 ? ' réponses' : ' réponse') + '</button>';
    }
    return '<article class="dsc-m' + (mien ? ' moi' : '') + (m.archive ? ' ret' : '') + (ment ? ' ment' : '') + (S.vise === m.id ? ' vise' : '') + '" data-id="' + ID(m.id) + '">' +
      '<span class="dsc-av' + (mien ? ' moi' : '') + '" aria-hidden="true">' + esc(ini(m.auteur_nom)) + '</span>' +
      '<div class="dsc-mb"><div class="dsc-mh"><b>' + esc(m.auteur_nom) + '</b><time>' + esc(heure(m.cree_le)) + '</time>' + (ment ? '<em class="dsc-pm">Vous êtes mentionné</em>' : '') + '</div>' +
      corpsMsg(m) + reactionsHtml(m) + '<div class="dsc-ma">' + actions + '</div>' +
      (ouvert ? '<div class="dsc-fil">' + visibles.map(reponseHtml).join('') +
        '<form class="dsc-rf" onsubmit="return V2.discussion.envoyer(event,\'' + ID(m.id) + '\',\'\')"><input type="text" name="c" data-k="r' + ID(m.id) + '" maxlength="' + MAX_TEXTE + '" autocomplete="off" placeholder="Votre réponse" aria-label="Votre réponse">' +
        '<button type="submit" class="v2-btn v2-btn-primary">Répondre</button></form></div>' : '') +
      '</div></article>';
  }

  // ── Une remontée, sous forme de carte ──
  function commentairesDe(remId) {
    var sj = remSujet(remId); if (!sj) return [];
    return msgsDe(sj.id).filter(function (m) { return !m.archive; }).sort(function (a, b) { return a.cree_le < b.cree_le ? -1 : 1; });
  }
  function remHtml(i) {
    var st = STATUT[i.status] || STATUT.nouveau, rep = S.reponses[i.id], admin = estAdmin();
    var coms = commentairesDe(i.id), ouvert = !!S.rOuvert[i.id], u = urlCap(i.id);
    var d = ''; try { d = new Date(i.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + heure(i.created_at); } catch (e) {}
    var pastille = admin
      ? '<button type="button" class="dsc-st" style="--stc:' + st.c + '" onclick="V2.discussion.statut(\'' + ID(i.id) + '\')" title="Changer le statut">' + st.l + '</button>'
      : '<span class="dsc-st" style="--stc:' + st.c + '">' + st.l + '</span>';
    var fond = '';
    if (rep && rep.t) fond += '<div class="dsc-rep"><b>' + esc(rep.par || 'Réponse de la direction') + ' · direction</b>' + esc(rep.t).replace(/\n/g, '<br>') + '</div>';
    if (admin && S.repRem === i.id) {
      fond += '<form class="dsc-repf" onsubmit="return V2.discussion.repondreRem(event,\'' + ID(i.id) + '\')"><textarea name="c" data-k="rep' + ID(i.id) + '" rows="3" maxlength="1000" aria-label="Réponse de la direction, visible par toute l’équipe" placeholder="Réponse visible par toute l’équipe">' + esc((rep && rep.t) || '') + '</textarea>' +
        '<div class="dsc-edb"><button type="submit" class="v2-btn v2-btn-primary">Enregistrer la réponse</button><button type="button" class="v2-btn" onclick="V2.discussion.repRem(\'\')">Annuler</button></div></form>';
    }
    var zoneCom = '';
    if (ouvert) {
      zoneCom = '<div class="dsc-coms">' + (coms.length ? coms.map(function (m) { return reponseHtml(m); }).join('') : '<p class="dsc-sc">Aucun commentaire pour l’instant. Soyez le premier.</p>') +
        composeurHtml({ pk: 'rc:' + ID(i.id), ph: 'Votre commentaire', rows: 2, comm: true }) + '</div>';
    }
    return '<article class="dsc-rc' + (S.vise === 'rem' + i.id ? ' vise' : '') + '" data-rem="' + ID(i.id) + '" data-id="rem' + ID(i.id) + '">' +
      '<button type="button" class="dsc-vote" onclick="V2.discussion.voter(\'' + ID(i.id) + '\')" title="Voter pour cette idée" aria-label="Voter pour cette idée, ' + (i.votes || 0) + ' vote' + ((i.votes || 0) > 1 ? 's' : '') + '"><span aria-hidden="true">▲</span><b>' + (i.votes || 0) + '</b></button>' +
      '<div class="dsc-rcb"><div class="dsc-rch"><span class="dsc-rtag">' + ICO_IDEE + 'Remontée</span><span class="dsc-rpar"><b>' + esc(i.author_name || '—') + '</b> · ' + esc(d) + '</span>' + pastille + '</div>' +
      '<p class="dsc-rtxt">' + texteHtml(i.body) + '</p>' +
      (u ? '<button type="button" class="dsc-shot" data-src="' + esc(u) + '" data-nom="Capture jointe à la remontée" onclick="V2.discussion.zoom(this)" title="Agrandir la capture"><img loading="lazy" src="' + esc(u) + '" alt="Capture d’écran jointe à la remontée"></button>'
        : (S.capIds[i.id] ? '<span class="dsc-shot vide">Capture en cours de chargement</span>' : '')) +
      fond +
      '<div class="dsc-ma"><button type="button" class="dsc-lien" onclick="V2.discussion.commenter(\'' + ID(i.id) + '\')" aria-expanded="' + ouvert + '">' + (ouvert ? 'Masquer les commentaires' : 'Commenter') + (coms.length ? ' (' + coms.length + ')' : '') + '</button>' +
      (admin && S.repRem !== i.id ? '<button type="button" class="dsc-lien dsc-gris" onclick="V2.discussion.repRem(\'' + ID(i.id) + '\')">' + (rep && rep.t ? 'Modifier la réponse' : 'Répondre') + '</button>' : '') + '</div>' +
      zoneCom + '</div></article>';
  }

  // ── Fichiers et liens ──
  function elementsFichiers(portee) {
    var out = [];
    liste().forEach(function (m) {
      if (m.archive) return;
      if (portee === 'sujet' && m.sujet_id !== S.sujet) return;
      var sj = ordinaire(m.sujet_id), sr = sujetRemParId(m.sujet_id);
      if (!sj && !sr) return;
      var titre = sj ? sj.titre : 'Commentaire de remontée';
      (m.pieces || []).forEach(function (p) {
        out.push({ k: p.type === 'image' ? 'photos' : 'docs', nom: p.nom, type: p.type, octets: p.octets, url: urlPiece(p), qui: m.auteur_nom, d: m.cree_le, sujet: titre, sid: m.sujet_id, mid: m.id });
      });
      liensDe(m.texte).forEach(function (u) { out.push({ k: 'liens', nom: domaine(u), type: 'lien', url: u, qui: m.auteur_nom, d: m.cree_le, sujet: titre, sid: m.sujet_id, mid: m.id }); });
    });
    if (portee === 'equipe') S.imps.forEach(function (i) {
      if (S.capIds[i.id]) out.push({ k: 'photos', nom: 'Capture : ' + debut(i.body, 46), type: 'image', url: urlCap(i.id), qui: i.author_name, d: i.created_at, sujet: 'Remontée', rem: i.id });
    });
    return out.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
  }
  function fichiersHtml(portee) {
    var tous = elementsFichiers(portee), n = { tout: tous.length, photos: 0, docs: 0, liens: 0 };
    tous.forEach(function (e) { n[e.k]++; });
    var l = S.fk === 'tout' ? tous : tous.filter(function (e) { return e.k === S.fk; });
    var bascule = S.sujet ? '<div class="dsc-seg" role="group" aria-label="Portée"><button type="button" class="' + (portee === 'sujet' ? 'on' : '') + '" onclick="V2.discussion.portee(\'sujet\')">Ce sujet</button><button type="button" class="' + (portee === 'equipe' ? 'on' : '') + '" onclick="V2.discussion.portee(\'equipe\')">Toute l’équipe</button></div>' : '';
    var sous = ['tout', 'photos', 'docs', 'liens'].map(function (k) {
      return '<button type="button" class="dsc-pill' + (S.fk === k ? ' on' : '') + '" onclick="V2.discussion.sousFiltre(\'' + k + '\')">' + ({ tout: 'Tout', photos: 'Photos', docs: 'Documents', liens: 'Liens' })[k] + ' <b>' + n[k] + '</b></button>';
    }).join('');
    var corps = l.length ? l.map(function (e) {
      var vignette = e.k === 'photos' && e.url ? '<button type="button" class="dsc-fth" data-src="' + esc(e.url) + '" data-nom="' + esc(e.nom) + '" onclick="V2.discussion.zoom(this)" aria-label="Agrandir ' + esc(e.nom) + '"><img loading="lazy" src="' + esc(e.url) + '" alt=""></button>'
        : '<i class="dsc-fth ico ' + esc(e.type) + '">' + (e.k === 'liens' ? ICO_LIEN : icoType(e.type)) + '</i>';
      var titre = e.k === 'liens' ? '<a class="dsc-lk" href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(e.url) + '">' + esc(e.nom) + '</a>'
        : (e.url && e.k === 'docs' ? '<a class="dsc-lk" href="' + esc(e.url) + '" target="_blank" rel="noopener noreferrer">' + esc(e.nom) + '</a>' : '<b>' + esc(e.nom) + '</b>');
      var voir = e.rem ? 'V2.discussion.versRem(\'' + ID(e.rem) + '\')' : 'V2.discussion.vers(\'' + ID(e.sid) + '\',\'' + ID(e.mid) + '\')';
      return '<div class="dsc-fr">' + vignette + '<div class="dsc-frb">' + titre + '<small>' + (e.k === 'liens' ? 'Lien' : libType(e.type) + (e.octets ? ' · ' + poids(e.octets) : '')) + ' · ' + esc(e.qui || '—') + ' · ' + esc(quand(e.d)) + '</small></div>' +
        '<button type="button" class="dsc-tag" onclick="' + voir + '" title="Voir le message">' + esc(e.sujet) + '</button></div>';
    }).join('') : '<p class="dsc-vide">' + (portee === 'sujet' ? 'Aucun fichier ni lien dans ce sujet pour l’instant.' : 'Aucun fichier ni lien pour l’instant.') + '</p>';
    return '<div class="dsc-fh"><div class="dsc-fht"><b>Fichiers et liens</b><span>Du plus récent au plus ancien' + (portee === 'equipe' ? ', pour toute l’équipe' : ', pour ce sujet') + '</span></div>' + bascule + '</div>' +
      '<div class="dsc-pills sous">' + sous + '</div><div class="dsc-fl">' + corps + '</div>';
  }

  // ── Zone d'écriture ──
  function listeSujetsHtml() {
    return S.sujets.map(function (s) { return '<option value="' + ID(s.id) + '"' + (s.id === S.cible ? ' selected' : '') + '>' + esc(s.titre) + '</option>'; }).join('');
  }
  function composeurHtml(o) {
    var pk = o.pk, fil = !!o.select, bas = fil ? ' data-pop="bas"' : '';
    var ph = o.ph || 'Écrire dans ce sujet';
    return '<form class="' + (o.comm ? 'dsc-cc' : 'dsc-c') + '" data-pk="' + pk + '"' + bas + ' onsubmit="return V2.discussion.envoyer(event,\'\',\'' + pk + '\')" ' +
      'ondragover="V2.discussion.survol(event,true)" ondragleave="V2.discussion.survol(event,false)" ondrop="V2.discussion.depot(event,\'' + pk + '\')">' +
      (fil ? '<div class="dsc-cv"><label for="dsc-cible">Écrire dans</label><select id="dsc-cible" name="sujet" onchange="V2.discussion.cible(this.value)" aria-label="Sujet dans lequel écrire">' + listeSujetsHtml() + '</select>' +
        '<button type="button" class="v2-btn dsc-idee" onclick="V2.discussion.idee()" aria-label="Proposer une idée">' + ICO_IDEE + '<span class="dsc-idl">Proposer une idée</span></button></div>' : '') +
      '<div class="dsc-zone"><textarea name="c" data-k="' + (o.comm ? 'rc' + pk.slice(3) : 'nouveau') + '" rows="' + (o.rows || 2) + '" maxlength="' + MAX_TEXTE + '" placeholder="' + esc(ph) + '" aria-label="' + esc(o.comm ? 'Votre commentaire' : 'Votre message') + '" ' +
      'oninput="V2.discussion.saisie(this)" onkeydown="V2.discussion.touche(event,this)" onpaste="V2.discussion.colle(event,\'' + pk + '\')" onblur="V2.discussion.fermerMention()"></textarea>' +
      '<div class="dsc-mp" role="listbox" aria-label="Personnes à mentionner" hidden></div></div>' +
      '<div class="dsc-pv" data-pk="' + pk + '"></div>' +
      '<input type="file" class="dsc-file" accept="' + ACCEPT + '" multiple hidden onchange="V2.discussion.choisis(this,\'' + pk + '\')">' +
      '<div class="dsc-cb"><button type="button" class="dsc-clip" onclick="V2.discussion.joindre(this)" aria-label="Joindre une photo, un PDF ou un fichier Excel" title="Joindre une photo, un PDF ou un fichier Excel">' + ICO_CLIP + '<span>Joindre</span></button>' +
      (o.comm ? '<span class="dsc-note"></span>' : '<span class="dsc-note">Pas de chiffres de ventes dans un message : ils restent dans l’outil.</span>') +
      '<button type="submit" class="v2-btn v2-btn-primary">' + (o.comm ? 'Commenter' : 'Envoyer') + '</button></div></form>';
  }
  function nouveauHtml() {
    return '<div class="dsc-fenetre"><div class="dsc-th"><button type="button" class="dsc-retour" onclick="V2.discussion.retour()">← Sujets</button><div><h2>Nouveau sujet</h2><span>Visible par toute l’équipe commerciale et la direction</span></div></div>' +
      '<form class="dsc-nf" onsubmit="return V2.discussion.creer(event)">' +
      '<label for="dsc-titre">Titre du sujet</label><input id="dsc-titre" name="titre" type="text" maxlength="' + MAX_TITRE + '" autocomplete="off" placeholder="Par exemple : livraison du vendredi">' +
      '<label for="dsc-premier">Premier message</label><textarea id="dsc-premier" name="c" rows="5" maxlength="' + MAX_TEXTE + '" placeholder="Votre message"></textarea>' +
      '<div class="dsc-cb"><span class="dsc-note">Pas de chiffres de ventes dans un message : ils restent dans l’outil.</span>' +
      '<button type="submit" class="v2-btn v2-btn-primary">Créer le sujet</button></div></form></div>';
  }
  function etatHtml(titre, texte, bouton) {
    return '<div class="dsc-etat"><h2>' + esc(titre) + '</h2><p>' + esc(texte) + '</p>' +
      (bouton ? '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.discussion.recharger()">Réessayer</button>' : '') + '</div>';
  }

  // ── Colonne de gauche : le fil de l'équipe, puis les sujets ──
  function listeHtml() {
    var tot = totalNonLus(), surFil = !S.sujet && !S.nouveau;
    var h = '<button type="button" class="dsc-can dsc-canfil' + (surFil ? ' on' : '') + '" onclick="V2.discussion.leFil()">' +
      '<i class="dsc-cfi" aria-hidden="true">' + ICO_FIL + '</i><span class="dsc-cn"><b>Fil de l’équipe</b><small>Tous les sujets et les remontées</small></span>' +
      (tot ? '<em aria-label="' + tot + ' non lus">' + tot + '</em>' : '') + '</button>';
    h += '<div class="dsc-lh"><div><h2>Sujets</h2><span>' + (tot ? tot + (tot > 1 ? ' messages non lus' : ' message non lu') : 'Tout est lu') + '</span></div>' +
      '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.discussion.nouveau()">Nouveau sujet</button></div>';
    if (!S.sujets.length) return h + '<p class="dsc-vide">Aucun sujet pour l’instant. Lancez le premier avec « Nouveau sujet ».</p>';
    return h + '<ul class="dsc-ls">' + S.sujets.map(function (s) {
      var n = s.id === S.sujet ? 0 : (S.nonLus[s.id] || 0);
      return '<li><button type="button" class="dsc-can' + (s.id === S.sujet && !S.nouveau ? ' on' : '') + (n ? ' nl' : '') + '" onclick="V2.discussion.ouvrir(\'' + ID(s.id) + '\')">' +
        '<span class="dsc-cn"><b>' + esc(s.titre) + '</b><small>' + esc(s.cree_par_nom || 'Équipe') + ' · ' + esc(quand(s.dernier_message_le)) + '</small></span>' +
        (n ? '<em aria-label="' + n + ' non lus">' + n + '</em>' : '') + '</button></li>';
    }).join('') + '</ul>';
  }

  // ── Le fil de l'équipe ──
  function messagesDuFil() {
    return liste().filter(function (m) { return !m.archive && ordinaire(m.sujet_id); });
  }
  function comptes() {
    var msg = messagesDuFil(), c = { messages: msg.length, remontees: S.imps.length, mentions: 0, fichiers: 0 };
    c.tout = c.messages + c.remontees;
    msg.forEach(function (m) { if (mentionMoi(m)) c.mentions++; });
    liste().forEach(function (m) { if (!m.archive && sujetRemParId(m.sujet_id) && mentionMoi(m)) c.mentions++; });
    liste().forEach(function (m) { if (m.archive || !(ordinaire(m.sujet_id) || sujetRemParId(m.sujet_id))) return; c.fichiers += (m.pieces || []).length + liensDe(m.texte).length; });
    Object.keys(S.capIds).forEach(function () { c.fichiers++; });
    return c;
  }
  function pillsHtml() {
    var c = comptes();
    var defs = [['tout', 'Tout', c.tout], ['messages', 'Messages', c.messages], ['remontees', 'Remontées', c.remontees], ['fichiers', 'Fichiers et liens', c.fichiers], ['mentions', 'Me mentionne', c.mentions]];
    return defs.map(function (d) {
      return '<button type="button" class="dsc-pill' + (S.filtre === d[0] && !S.q ? ' on' : '') + '" aria-pressed="' + (S.filtre === d[0] && !S.q) + '" onclick="V2.discussion.filtre(\'' + d[0] + '\')">' + d[1] + ' <b>' + d[2] + '</b></button>';
    }).join('');
  }
  function barreHtml() {
    return '<div class="dsc-barre"><div class="dsc-pills" id="dsc-pills">' + pillsHtml() + '</div>' +
      '<form class="dsc-rech" role="search" onsubmit="return V2.discussion.chercher(event)"><input id="dsc-q" type="search" name="q" value="' + esc(S.q) + '" placeholder="Rechercher un message" aria-label="Rechercher dans les messages" autocomplete="off" oninput="V2.discussion.tape(this.value)">' +
      '</form></div>';
  }
  function itemsDuFil() {
    var f = S.filtre, out = [];
    if (f === 'tout' || f === 'messages') messagesDuFil().forEach(function (m) { out.push({ t: 'm', d: m.cree_le, m: m }); });
    if (f === 'mentions') liste().forEach(function (m) { if (!m.archive && (ordinaire(m.sujet_id) || sujetRemParId(m.sujet_id)) && mentionMoi(m)) out.push({ t: 'm', d: m.cree_le, m: m }); });
    if (f === 'tout' || f === 'remontees') S.imps.forEach(function (i) { out.push({ t: 'r', d: i.created_at, i: i }); });
    return out.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
  }
  function filHtmlFlux() {
    if (S.res !== null) return rechercheHtml();
    if (S.filtre === 'fichiers') return fichiersHtml('equipe');
    var l = itemsDuFil(), out = '', j = '';
    if (!l.length) return '<p class="dsc-vide">' + (S.filtre === 'mentions' ? 'Personne ne vous a mentionné pour l’instant.' : S.filtre === 'remontees' ? 'Aucune remontée pour l’instant. Proposez la première idée.' : 'Rien dans le fil pour l’instant. Écrivez le premier message.') + '</p>';
    var repsDe = {}; liste().forEach(function (m) { if (m.parent_id && !m.archive) (repsDe[m.parent_id] = repsDe[m.parent_id] || []).push(m); });
    l.forEach(function (x) {
      var jj = jourDe(x.d);
      if (jj !== j) { out += '<div class="dsc-jour"><span>' + esc(libJour(x.d)) + '</span></div>'; j = jj; }
      if (x.t === 'r') out += remHtml(x.i);
      else if (sujetRemParId(x.m.sujet_id)) out += commentaireDuFilHtml(x.m);
      else out += messageHtml(x.m, repsDe[x.m.id] || [], 'fil');
    });
    return out;
  }
  function commentaireDuFilHtml(m) {   // filtre « Me mentionne » : un commentaire de remontée
    var sj = sujetRemParId(m.sujet_id), imp = sj && remontee(sj.remontee_id);
    return '<article class="dsc-m ment" data-id="' + ID(m.id) + '"><span class="dsc-av" aria-hidden="true">' + esc(ini(m.auteur_nom)) + '</span><div class="dsc-mb"><div class="dsc-mh"><b>' + esc(m.auteur_nom) + '</b>' +
      '<button type="button" class="dsc-tag rem" onclick="V2.discussion.versRem(\'' + ID(sj ? sj.remontee_id : '') + '\')">Remontée : ' + esc(debut(imp ? imp.body : (sj && sj.titre), 50)) + '</button><time>' + esc(quand(m.cree_le)) + '</time><em class="dsc-pm">Vous êtes mentionné</em></div>' +
      corpsMsg(m) + reactionsHtml(m) + '</div></article>';
  }

  // ── Recherche ──
  function rechercheHtml() {
    var q = S.q.trim();
    if (S.res === 'attente') return '<p class="dsc-vide">Recherche en cours…</p>';
    if (!S.res.length) return '<p class="dsc-vide">Aucun résultat pour « ' + esc(q) + ' ».</p>';
    return '<div class="dsc-rsh"><b>' + S.res.length + (S.res.length > 1 ? ' résultats' : ' résultat') + '</b> pour « ' + esc(q) + ' » <button type="button" class="dsc-lien" onclick="V2.discussion.effacer()">Effacer la recherche</button></div>' +
      S.res.map(function (r) {
        var clic = r.rem ? 'V2.discussion.versRem(\'' + ID(r.rem) + '\')' : 'V2.discussion.vers(\'' + ID(r.sid) + '\',\'' + ID(r.mid) + '\')';
        return '<button type="button" class="dsc-rs" onclick="' + clic + '"><span class="dsc-rsh2"><span class="dsc-tag' + (r.rem ? ' rem' : '') + '">' + esc(r.sujet) + '</span><b>' + esc(r.qui || '—') + '</b><time>' + esc(quand(r.d)) + '</time></span>' +
          '<span class="dsc-rst">' + surligne(r.texte, q) + '</span></button>';
      }).join('');
  }
  function lancerRecherche() {
    var q = S.q.trim(), c = client();
    if (q.length < 2 || !c) { S.res = null; peindreFlux(true); peindreBarre(); return; }
    var id = ++S.rechId; S.res = 'attente'; peindreFlux(true); peindreBarre();
    c.from(T_MSG).select(COLS_M).eq('archive', false).ilike('texte', '%' + q.replace(/[%_]/g, ' ') + '%').order('cree_le', { ascending: false }).limit(50).then(function (r) {
      if (id !== S.rechId) return;
      var l = [], nq = norm(q);
      ((r && r.data) || []).forEach(function (m) {
        ajouterMsg(m);
        var sj = ordinaire(m.sujet_id), sr = sujetRemParId(m.sujet_id);
        if (!sj && !sr) return;
        l.push({ d: m.cree_le, texte: m.texte, qui: m.auteur_nom, sujet: sj ? sj.titre : 'Commentaire · ' + debut((remontee(sr.remontee_id) || {}).body || sr.titre, 40), sid: m.sujet_id, mid: m.id, rem: sr ? sr.remontee_id : null });
      });
      S.imps.forEach(function (i) { if (norm(i.body).indexOf(nq) >= 0) l.push({ d: i.created_at, texte: i.body, qui: i.author_name, sujet: 'Remontée', rem: i.id }); });
      l.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
      S.res = l; peindreFlux(true); peindreBarre();
      signer().then(function () { peindreFlux(); });
    }, function () { if (id === S.rechId) { S.res = []; peindreFlux(true); } });
  }

  // ── Un sujet ouvert ──
  function fluxSujetHtml() {
    if (S.fich) return fichiersHtml(S.fich);
    var tous = msgsDe(S.sujet);
    if (!tous.length && !S.pleins[S.sujet]) return '<p class="dsc-vide">Chargement des messages…</p>';
    var racines = tous.filter(function (m) { return !m.parent_id; }).sort(function (a, b) { return a.cree_le < b.cree_le ? -1 : 1; }), out = '', dernierJour = '', divise = false, me = moi();
    var repsDe = {};
    tous.slice().sort(function (a, b) { return a.cree_le < b.cree_le ? -1 : 1; }).forEach(function (m) { if (m.parent_id) (repsDe[m.parent_id] = repsDe[m.parent_id] || []).push(m); });
    racines = racines.filter(function (m) { return !m.archive || (repsDe[m.id] || []).some(function (r) { return !r.archive; }); });
    if (!racines.length) return '<p class="dsc-vide">Aucun message pour l’instant. Écrivez le premier.</p>';
    racines.forEach(function (m) {
      var j = jourDe(m.cree_le);
      if (j !== dernierJour) { out += '<div class="dsc-jour"><span>' + esc(libJour(m.cree_le)) + '</span></div>'; dernierJour = j; }
      if (!divise && m.cree_le > S.vuAvant && m.auteur_id !== me) { out += '<div class="dsc-nouv"><span>Nouveaux messages</span></div>'; divise = true; }
      out += messageHtml(m, repsDe[m.id] || [], 'sujet');
    });
    return out;
  }
  function droiteHtml() {
    if (S.nouveau) return nouveauHtml();
    var s = sujetCourant();
    if (S.sujet && s) {
      return '<div class="dsc-fenetre"><div class="dsc-th"><button type="button" class="dsc-retour" onclick="V2.discussion.retour()">← Sujets</button><div class="dsc-tht"><h2>' + esc(s.titre) + '</h2><span>Ouvert par ' + esc(s.cree_par_nom || 'Équipe') + ' · ' + esc(quand(s.cree_le)) + '</span></div>' +
        '<button type="button" class="v2-btn dsc-bf' + (S.fich ? ' on' : '') + '" aria-pressed="' + !!S.fich + '" onclick="V2.discussion.fichiers()">' + (S.fich ? 'Revenir aux messages' : 'Fichiers et liens') + '</button></div>' +
        '<div class="dsc-flux" id="dsc-flux" tabindex="0" aria-label="Messages du sujet">' + fluxSujetHtml() + '</div>' +
        composeurHtml({ pk: 'main', rows: 2 }) + '</div>';
    }
    return '<div class="dsc-fenetre dsc-fenfil"><div class="dsc-th"><button type="button" class="dsc-retour" onclick="V2.discussion.retour()">← Sujets</button><div class="dsc-tht"><h2>Fil de l’équipe</h2><span>Les messages de tous les sujets et les remontées, du plus récent au plus ancien</span></div></div>' +
      composeurHtml({ pk: 'main', rows: 2, select: true, ph: 'Écrire à l’équipe' }) +
      '<div id="dsc-barrewrap">' + barreHtml() + '</div>' +
      '<div class="dsc-flux" id="dsc-flux" tabindex="0" aria-label="Fil de l’équipe">' + filHtmlFlux() + '</div></div>';
  }

  // ── Peinture : la liste et le fil se repeignent séparément ; la zone d'écriture, jamais pendant une relecture ──
  function peindre() {
    var box = document.getElementById('dsc'); if (!box) return;
    if (S.etat === 'chargement') { box.innerHTML = '<p class="dsc-vide">Chargement de la discussion…</p>'; return; }
    if (S.etat === 'absent') { box.innerHTML = etatHtml('La discussion arrive bientôt', 'Cet espace d’échange est en cours d’installation. Revenez dans quelques jours.'); return; }
    if (S.etat === 'horsligne') { box.innerHTML = etatHtml('Discussion indisponible', 'Il faut être connecté pour lire et écrire à l’équipe.'); return; }
    if (S.etat === 'erreur') { box.innerHTML = etatHtml('Discussion momentanément indisponible', 'Le chargement a échoué. Rien n’est perdu.', true); return; }
    box.innerHTML = '<div class="dsc-deux dsc-' + (S.mob === 'fil' ? 'surfil' : 'surliste') + '"><nav class="dsc-canaux" id="dsc-liste" aria-label="Sujets">' + listeHtml() + '</nav><div class="dsc-droite" id="dsc-droite">' + droiteHtml() + '</div></div>';
    var ta = box.querySelector('textarea[data-k="nouveau"]'), cle = S.sujet || 'fil';
    if (ta && S.bro[cle]) ta.value = S.bro[cle];
    redessinerPj();
    planifierVuFil();
  }
  function peindreListe() { var n = document.getElementById('dsc-liste'); if (n) n.innerHTML = listeHtml(); }
  function peindreBarre() { var n = document.getElementById('dsc-pills'); if (n) n.innerHTML = pillsHtml(); }
  function garderBrouillons(zone) {
    var o = {}; if (!zone) return o;
    var a = zone.querySelectorAll('[data-k]');
    for (var i = 0; i < a.length; i++) if (a[i].value) o[a[i].getAttribute('data-k')] = a[i].value;
    return o;
  }
  function rendreBrouillons(zone, o) {
    for (var k in o) { var e = zone.querySelector('[data-k="' + k + '"]'); if (e && !e.value) e.value = o[k]; }
  }
  function peindreFlux(haut) {   // le fil seul : les brouillons de réponse/commentaire/modification sont conservés
    var f = document.getElementById('dsc-flux'); if (!f) return;
    var brouillons = garderBrouillons(f), top = f.scrollTop;
    var actif = document.activeElement, cleActif = actif && f.contains(actif) ? actif.getAttribute('data-k') : null, debutSel = actif && actif.selectionStart;
    f.innerHTML = S.sujet ? fluxSujetHtml() : filHtmlFlux();
    rendreBrouillons(f, brouillons); f.scrollTop = haut ? 0 : top;
    if (cleActif) { var n = f.querySelector('[data-k="' + cleActif + '"]'); if (n) { try { n.focus({ preventScroll: true }); if (debutSel != null) n.setSelectionRange(debutSel, debutSel); } catch (e) {} } }
    redessinerPj(); peindreBarre();
  }
  function presDuBas() { var f = document.getElementById('dsc-flux'); return !f || (f.scrollHeight - f.scrollTop - f.clientHeight < 80); }
  function basDuFil() { var f = document.getElementById('dsc-flux'); if (f && S.sujet) f.scrollTop = f.scrollHeight; }

  // ── Pièces à joindre ──
  function typeDe(nom, mime) {
    var e = (String(nom || '').split('.').pop() || '').toLowerCase();
    if (/^image\//.test(mime || '') || /^(jpe?g|png|gif|webp|heic|heif)$/.test(e)) return 'image';
    if (mime === 'application/pdf' || e === 'pdf') return 'pdf';
    if (/^(xls|xlsx|csv)$/.test(e)) return 'excel';
    return null;
  }
  function mimeDe(nom, type, blob) {
    if (type === 'image') return 'image/jpeg';
    var e = (String(nom).split('.').pop() || '').toLowerCase();
    if (type === 'pdf') return 'application/pdf';
    if (e === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (e === 'xls') return 'application/vnd.ms-excel';
    if (e === 'csv') return 'text/csv';
    return (blob && blob.type) || 'application/octet-stream';
  }
  function nettoyer(nom) {
    return String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').slice(-80) || 'fichier';
  }
  // Toute image (photo du téléphone, capture collée) est réduite à 2 000 px et passée en JPEG 0,85 (comme les remontées).
  function preparerImage(f) {
    return new Promise(function (ok, ko) {
      var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        var k = Math.min(1, COTE / Math.max(im.naturalWidth, im.naturalHeight, 1));
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
        var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
        x.drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(u);
        cv.toBlob(function (b) { if (b) ok(b); else ko(new Error('image')); }, 'image/jpeg', 0.85);
      };
      im.onerror = function () { URL.revokeObjectURL(u); ko(new Error('image')); };
      im.src = u;
    });
  }
  var uid = 0;
  function ajouterFichiers(pk, files) {
    var l = S.pj[pk] = S.pj[pk] || [];
    Array.prototype.forEach.call(files || [], function (f) {
      if (l.length >= MAX_PJ) { echec('Cinq pièces jointes au plus par message'); return; }
      var type = typeDe(f.name, f.type);
      if (!type) { echec('Format non accepté : photo, PDF ou Excel'); return; }
      if (f.size > MAX_OCTETS) { echec('Fichier trop lourd (20 Mo au plus)'); return; }
      var it = { id: 'p' + (++uid), nom: f.name || 'image.jpg', type: type, octets: f.size, blob: null, pret: false, apercu: '' };
      l.push(it); dessinerPj(pk);
      if (type === 'image') {
        preparerImage(f).then(function (b) {
          it.blob = b; it.octets = b.size; it.nom = it.nom.replace(/\.[^.]+$/, '') + '.jpg'; it.apercu = URL.createObjectURL(b); it.pret = true; dessinerPj(pk);
        }).catch(function () { var i = l.indexOf(it); if (i >= 0) l.splice(i, 1); dessinerPj(pk); echec('Cette image ne peut pas être lue'); });
      } else { it.blob = f; it.pret = true; dessinerPj(pk); }
    });
  }
  function dessinerPj(pk) {
    var l = S.pj[pk] || [], zs = document.querySelectorAll('.dsc-pv');
    for (var i = 0; i < zs.length; i++) {
      if (zs[i].getAttribute('data-pk') !== pk) continue;
      zs[i].innerHTML = l.map(function (p) {
        return '<div class="dsc-pc">' + (p.apercu ? '<img src="' + esc(p.apercu) + '" alt="Aperçu de ' + esc(p.nom) + '">' : '<i class="dsc-di ' + esc(p.type) + '">' + icoType(p.type) + '</i>') +
          '<span><b>' + esc(p.nom) + '</b><small>' + libType(p.type) + ' · ' + (p.pret ? poids(p.octets) : 'préparation…') + '</small></span>' +
          '<button type="button" class="dsc-pcx" onclick="V2.discussion.retirerPj(\'' + pk + '\',\'' + p.id + '\')" aria-label="Retirer ' + esc(p.nom) + '">Retirer</button></div>';
      }).join('');
    }
  }
  function redessinerPj() { Object.keys(S.pj).forEach(dessinerPj); }
  function viderPj(pk) {
    (S.pj[pk] || []).forEach(function (p) { if (p.apercu) { try { URL.revokeObjectURL(p.apercu); } catch (e) {} } });
    S.pj[pk] = []; dessinerPj(pk);
  }
  function televerser(sid, pjs) {
    var c = client(), res = [];
    return pjs.reduce(function (p, x) {
      return p.then(function () {
        var chemin = 'discussion/' + ID(sid) + '/' + (Date.now() + res.length) + '-' + nettoyer(x.nom);
        return c.storage.from(SEAU).upload(chemin, x.blob, { contentType: mimeDe(x.nom, x.type, x.blob), upsert: false }).then(function (u) {
          if (u.error) throw new Error('envoi');
          res.push({ nom: x.nom, type: x.type, octets: x.octets, chemin: chemin });
        });
      });
    }, Promise.resolve()).then(function () { return res; });
  }

  // ── Mentions : @ propose les personnes déjà présentes dans la discussion ──
  function zoneDe(ta) { return ta.parentNode; }
  function mentionFermer() {
    if (S.mention && S.mention.pop) { S.mention.pop.hidden = true; S.mention.pop.innerHTML = ''; }
    S.mention = null;
  }
  function mentionAfficher() {
    var m = S.mention; if (!m) return;
    m.pop.hidden = false;
    m.pop.className = 'dsc-mp' + (m.ta.form && m.ta.form.getAttribute('data-pop') === 'bas' ? ' bas' : '');
    m.pop.innerHTML = m.liste.map(function (n, i) {
      return '<button type="button" role="option" class="' + (i === m.i ? 'on' : '') + '" aria-selected="' + (i === m.i) + '" onmousedown="event.preventDefault()" onclick="V2.discussion.choisir(' + i + ')"><span class="dsc-av p" aria-hidden="true">' + esc(ini(n)) + '</span>' + esc(n) + '</button>';
    }).join('');
  }

  // ── Actions (appelées depuis les boutons) ──
  function valeur(f, nom) { return String((f.elements[nom] && f.elements[nom].value) || '').trim(); }
  function ajouterMessage(m) {
    ajouterMsg(m);
    var sj = ordinaire(m.sujet_id) || sujetRemParId(m.sujet_id);
    if (sj) sj.dernier_message_le = m.cree_le;
    S.sujets.sort(function (a, b) { return a.dernier_message_le < b.dernier_message_le ? 1 : -1; });
    if (ordinaire(m.sujet_id)) marquerVu(m.sujet_id, m.cree_le);
    S.rx[m.id] = S.rx[m.id] || [];
  }
  function assurerSujetRem(remId) {
    var sj = remSujet(remId); if (sj) return Promise.resolve(sj);
    var imp = remontee(remId), c = client();
    return c.from(T_SUJETS).insert({ titre: debut(imp ? imp.body : 'Remontée', MAX_TITRE), cree_par: moi(), cree_par_nom: nomMoi(), remontee_id: remId }).select(COLS_S).single().then(function (r) {
      // 23505 : quelqu'un vient d'ouvrir les commentaires de cette remontée (un seul sujet par remontée en base) → on reprend le sien
      if (r.error && r.error.code === '23505') return c.from(T_SUJETS).select(COLS_S).eq('remontee_id', remId).maybeSingle();
      return r;
    }).then(function (r) {
      if (r.error || !r.data) throw new Error('sujet');
      if (!remSujet(remId)) S.rems.push(r.data);
      return remSujet(remId);
    });
  }
  function surMessage(id) { return S.msgs[id] || null; }
  function suivreIdee() {   // le formulaire « Proposer une idée » est celui de la page Remontées : on relit les idées quand il se ferme
    var essais = 0, vu = false, iv = setInterval(function () {
      essais++;
      var ouvert = !!document.getElementById('v2-remonte-pop');
      if (ouvert) vu = true;
      if ((vu && !ouvert) || essais > 150 || !document.getElementById('dsc')) {
        clearInterval(iv);
        if (!vu) return;
        setTimeout(function () {
          var c = client(); if (!c) return;
          attrape(c.from(T_IMP).select('*').order('created_at', { ascending: false })).then(function (r) {
            if (r.error || !r.data) return;
            S.imps = r.data.slice(); S.dernierImp = S.imps.reduce(function (a, i) { return plusRecent(a, i.created_at); }, '');
            chargerCaps(c).then(function () { return signer(); }).then(function () { if (!S.sujet && !S.res) peindreFlux(); });
          });
        }, 700);
      }
    }, 400);
  }

  V2.discussion = {
    etat: S,
    ouvrir: function (id) { ouvrirSujet(String(id)); },
    leFil: function () {
      S.sujet = null; S.nouveau = false; S.fich = null; S.q = ''; S.res = null; S.mob = 'fil'; S.edit = null; S.retrait = null;
      snapVuFil(); peindre();
    },
    retour: function () { S.mob = 'liste'; S.nouveau = false; peindre(); },
    nouveau: function () { S.nouveau = true; S.mob = 'fil'; S.sujet = null; peindre(); var t = document.getElementById('dsc-titre'); if (t && t.focus) { try { t.focus({ preventScroll: true }); } catch (e) {} } },
    recharger: function () { charger(); },
    fil: function (id) { S.ouverts[id] = !S.ouverts[id]; peindreFlux(); },
    modifier: function (id) { S.edit = id || null; S.retrait = null; peindreFlux(); },
    demanderRetrait: function (id) { S.retrait = id || null; S.edit = null; peindreFlux(); },
    cible: function (id) { S.cible = id; },
    idee: function () {
      if (V2.remonteeOpen) { V2.remonteeOpen(); suivreIdee(); } else echec('La proposition d’idée n’est pas disponible pour le moment');
    },
    // — filtres, recherche, fichiers —
    filtre: function (f) { S.filtre = f; S.q = ''; S.res = null; S.rechId++; var i = document.getElementById('dsc-q'); if (i) i.value = ''; peindreFlux(true); },
    tape: function (v) {
      S.q = v; clearTimeout(V2.discussion._t);
      if (v.trim().length < 2) { S.res = null; S.rechId++; peindreFlux(true); peindreBarre(); return; }
      V2.discussion._t = setTimeout(lancerRecherche, 350);
    },
    chercher: function (ev) { ev.preventDefault(); clearTimeout(V2.discussion._t); lancerRecherche(); return false; },
    effacer: function () { S.q = ''; S.res = null; S.rechId++; var i = document.getElementById('dsc-q'); if (i) i.value = ''; peindreFlux(true); },
    fichiers: function () { S.fich = S.fich ? null : 'sujet'; S.fk = 'tout'; peindre(); },
    portee: function (p) { S.fich = p; peindreFlux(true); },
    sousFiltre: function (k) { S.fk = k; peindreFlux(true); },
    vers: function (sid, mid) {
      if (sujetRemParId(sid)) return V2.discussion.versRem(sujetRemParId(sid).remontee_id);
      S.q = ''; S.res = null; ouvrirSujet(String(sid), false, mid);
    },
    versRem: function (id) {
      S.sujet = null; S.nouveau = false; S.fich = null; S.filtre = 'remontees'; S.q = ''; S.res = null; S.rechId++; S.rOuvert[id] = true; S.mob = 'fil';
      peindre(); viser('rem' + id);
      var sj = remSujet(id), c = client();
      if (sj && c && !S.pleins[sj.id]) c.from(T_MSG).select(COLS_M).eq('sujet_id', sj.id).order('cree_le', { ascending: false }).limit(300).then(function (r) {
        (r.data || []).forEach(ajouterMsg); S.pleins[sj.id] = true; peindreFlux(); enrichir((r.data || []).map(function (m) { return m.id; }));
      }, function () {});
    },
    // — remontées —
    commenter: function (id) {
      S.rOuvert[id] = !S.rOuvert[id]; peindreFlux();
      var sj = remSujet(id), c = client();
      if (S.rOuvert[id] && sj && c && !S.pleins[sj.id]) c.from(T_MSG).select(COLS_M).eq('sujet_id', sj.id).order('cree_le', { ascending: false }).limit(300).then(function (r) {
        (r.data || []).forEach(ajouterMsg); S.pleins[sj.id] = true; peindreFlux(); enrichir((r.data || []).map(function (m) { return m.id; }));
      }, function () {});
    },
    voter: function (id) {
      var c = client(); if (!c) return;
      c.rpc('increment_improvement_votes', { imp_id: id }).then(function (r) {
        if (r && r.error) return echec('Vote non enregistré');
        var i = remontee(id); if (i) i.votes = (i.votes || 0) + 1; peindreFlux();
      }, function () { echec('Vote non enregistré'); });
    },
    statut: function (id) {
      if (!estAdmin()) return;
      var i = remontee(id), c = client(); if (!i || !c) return;
      var ordre = ['nouveau', 'en cours', 'fait'], suivant = ordre[(ordre.indexOf(i.status) + 1) % 3];
      c.from(T_IMP).update({ status: suivant }).eq('id', id).then(function (r) {
        if (r && r.error) return echec('Statut non modifié');
        i.status = suivant; peindreFlux();
      }, function () { echec('Statut non modifié'); });
    },
    repRem: function (id) { S.repRem = id || null; peindreFlux(); },
    repondreRem: function (ev, id) {
      ev.preventDefault();
      if (!estAdmin()) return false;
      var txt = valeur(ev.target, 'c'), c = client(); if (!c) return false;
      c.from('profils').select('data').eq('scope_type', REP.st).eq('scope_id', REP.sid).maybeSingle().then(function (r) {
        if (r.error) throw new Error('lecture');
        var data = (r.data && r.data.data) || {};   // relue juste avant d'écrire : ne pas écraser une réponse posée ailleurs
        if (txt) data[id] = { t: txt, par: nomMoi(), le: new Date().toISOString() }; else delete data[id];
        return c.from('profils').upsert({ scope_type: REP.st, scope_id: REP.sid, data: data, updated_by: moi(), updated_by_name: nomMoi(), updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })
          .then(function (u) { if (u.error) throw new Error('écriture'); S.reponses = data; S.repRem = null; peindreFlux(); });
      }).then(null, function () { echec('Réponse non enregistrée'); });
      return false;
    },
    // — réactions —
    reagir: function (mid, k) {
      var e = EMOJIS[k], c = client(); if (!c || !S.msgs[mid]) return;
      var rows = S.rx[mid] = S.rx[mid] || [];
      var mien = rows.filter(function (r) { return r.emoji === e && r.auteur_id === moi(); })[0];
      if (mien) {   // cliquer à nouveau retire la mienne (archive = true, jamais de DELETE)
        rows.splice(rows.indexOf(mien), 1); peindreFlux();
        if (String(mien.id).indexOf('tmp') === 0) { mien.retire = true; return; }
        c.from(T_REA).update({ archive: true }).eq('id', mien.id).then(function (r) {
          if (r && r.error) { rows.push(mien); peindreFlux(); echec('Réaction non retirée'); }
        }, function () { rows.push(mien); peindreFlux(); echec('Réaction non retirée'); });
      } else {
        var tmp = { id: 'tmp' + Date.now(), message_id: mid, auteur_id: moi(), auteur_nom: nomMoi(), emoji: e, cree_le: new Date().toISOString() };
        rows.push(tmp); peindreFlux();
        var ko = function () { var i = rows.indexOf(tmp); if (i >= 0) rows.splice(i, 1); peindreFlux(); echec('Réaction non enregistrée'); };
        c.from(T_REA).insert({ message_id: mid, auteur_id: moi(), auteur_nom: nomMoi(), emoji: e }).select(COLS_R).single().then(function (r) {
          if (r.error || !r.data) return ko();
          tmp.id = r.data.id;
          if (tmp.retire) c.from(T_REA).update({ archive: true }).eq('id', r.data.id).then(function () {}, function () {});
        }, ko);
      }
    },
    // — pièces jointes —
    joindre: function (btn) { var f = btn.form.querySelector('.dsc-file'); if (f) f.click(); },
    choisis: function (inp, pk) { ajouterFichiers(pk, inp.files); inp.value = ''; },
    colle: function (ev, pk) {
      var fs = (ev.clipboardData && ev.clipboardData.files) || [];
      if (fs.length) { ev.preventDefault(); ajouterFichiers(pk, fs); }
    },
    survol: function (ev, on) { ev.preventDefault(); if (ev.currentTarget && ev.currentTarget.classList) ev.currentTarget.classList.toggle('sur', on); },
    depot: function (ev, pk) {
      ev.preventDefault(); if (ev.currentTarget && ev.currentTarget.classList) ev.currentTarget.classList.remove('sur');
      if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) ajouterFichiers(pk, ev.dataTransfer.files);
    },
    retirerPj: function (pk, id) {
      var l = S.pj[pk] || [], i = l.map(function (p) { return p.id; }).indexOf(id);
      if (i >= 0) { if (l[i].apercu) { try { URL.revokeObjectURL(l[i].apercu); } catch (e) {} } l.splice(i, 1); dessinerPj(pk); }
    },
    zoom: function (el) {
      var src = el.getAttribute('data-src'); if (!src) return;
      var o = document.createElement('div'); o.className = 'dsc-zoom'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Image agrandie');
      var img = document.createElement('img'); img.src = src; img.alt = el.getAttribute('data-nom') || 'Image agrandie';
      var x = document.createElement('button'); x.type = 'button'; x.className = 'dsc-zx'; x.textContent = 'Fermer';
      o.appendChild(img); o.appendChild(x);
      var fermer = function () { document.removeEventListener('keydown', touche); if (o.parentNode) o.parentNode.removeChild(o); };
      var touche = function (e) { if (e.key === 'Escape') fermer(); };
      o.addEventListener('click', fermer); document.addEventListener('keydown', touche);
      document.body.appendChild(o); x.focus();
    },
    // — mentions et saisie —
    saisie: function (ta) {
      if (ta.getAttribute('data-k') === 'nouveau') S.bro[S.sujet || 'fil'] = ta.value;
      var pos = ta.selectionStart, avant = ta.value.slice(0, pos), mm = /(^|[\s(])@([A-Za-zÀ-ÿ'’-]*)$/.exec(avant);
      if (!mm) { mentionFermer(); return; }
      var q = norm(mm[2]);
      var l = personnes().filter(function (n) { return !q || norm(prenom(n)).indexOf(q) === 0 || norm(n).indexOf(q) >= 0; }).slice(0, 5);
      if (!l.length) { mentionFermer(); return; }
      S.mention = { ta: ta, pop: zoneDe(ta).querySelector('.dsc-mp'), debut: pos - mm[2].length - 1, liste: l, i: 0 };
      mentionAfficher();
    },
    choisir: function (i) {
      var m = S.mention; if (!m || !m.liste[i]) return;
      var ta = m.ta, fin = ta.selectionStart, ins = '@' + prenom(m.liste[i]) + ' ';
      ta.value = ta.value.slice(0, m.debut) + ins + ta.value.slice(fin);
      var p = m.debut + ins.length; mentionFermer();
      ta.focus(); try { ta.setSelectionRange(p, p); } catch (e) {}
      if (ta.getAttribute('data-k') === 'nouveau') S.bro[S.sujet || 'fil'] = ta.value;
    },
    fermerMention: function () { setTimeout(mentionFermer, 120); },
    touche: function (ev, ta) {
      var m = S.mention;
      if (m && m.pop && !m.pop.hidden) {
        if (ev.key === 'ArrowDown') { ev.preventDefault(); m.i = (m.i + 1) % m.liste.length; mentionAfficher(); return; }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); m.i = (m.i + m.liste.length - 1) % m.liste.length; mentionAfficher(); return; }
        if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); V2.discussion.choisir(m.i); return; }
        if (ev.key === 'Escape') { ev.preventDefault(); mentionFermer(); return; }
      }
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); if (ta.form) ta.form.requestSubmit(); }
    },
    // — envoi —
    envoyer: function (ev, parent, pk) {
      ev.preventDefault();
      var f = ev.target, v = valeur(f, 'c'), c = client(), pjs = S.pj[pk] || [];
      if ((!v && !pjs.length) || !c || S.occupe) return false;
      if (v.length > MAX_TEXTE) { echec('Message trop long (4 000 caractères au plus)'); return false; }
      if (!pjs.every(function (p) { return p.pret; })) { echec('Une pièce jointe est encore en préparation'); return false; }
      var racine = parent, remId = pk.indexOf('rc:') === 0 ? pk.slice(3) : null, sid = S.sujet;
      if (!remId && !sid) sid = (f.elements.sujet && f.elements.sujet.value) || S.cible;
      if (!remId && !sid) { echec('Choisissez un sujet'); return false; }
      if (parent) {   // répondre à une réponse = répondre au message d'origine du fil
        var p = surMessage(parent);
        if (p && p.parent_id) racine = p.parent_id;
      }
      S.occupe = true;
      var fin = function () { S.occupe = false; };
      var chaine = remId ? assurerSujetRem(remId).then(function (sj) { return sj.id; }) : Promise.resolve(sid);
      chaine.then(function (cible) {
        sid = cible;
        return televerser(cible, pjs);
      }).then(function (pieces) {
        return c.from(T_MSG).insert({ sujet_id: sid, parent_id: racine || null, auteur_id: moi(), auteur_nom: nomMoi(), texte: v, pieces: pieces }).select(COLS_M).single();
      }).then(function (r) {
        fin();
        if (r.error || !r.data) { echec('Message non envoyé : réessayez'); return; }
        ajouterMessage(r.data);
        if (racine) S.ouverts[racine] = true;
        if (remId) S.rOuvert[remId] = true;
        if (f && f.elements && f.elements.c) f.elements.c.value = '';
        if (pk === 'main') delete S.bro[S.sujet || 'fil'];
        viderPj(pk);
        peindreListe(); peindreFlux(!S.sujet && !remId);
        if (S.sujet && !racine) basDuFil();
        signer().then(function () { peindreFlux(); });
      }).then(null, function () { fin(); echec(pjs.length ? 'Envoi impossible : le message et ses pièces jointes sont gardés, réessayez' : 'Message non envoyé : réessayez'); });
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
        return c.from(T_MSG).insert({ sujet_id: sj.id, parent_id: null, auteur_id: moi(), auteur_nom: nomMoi(), texte: v, pieces: [] }).select(COLS_M).single().then(function (r2) {
          S.occupe = false;
          S.sujets.unshift(sj); S.pleins[sj.id] = true;
          if (r2.error || !r2.data) { echec('Sujet créé, mais le premier message n’est pas parti : écrivez-le dans le sujet'); }
          else ajouterMessage(r2.data);
          S.nouveau = false; S.sujet = sj.id; S.cible = sj.id; S.vuAvant = new Date().toISOString(); S.mob = 'fil';
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
        var m = surMessage(id);
        if (m) { m.texte = v; m.modifie_le = maintenant; }
        S.edit = null; peindreFlux();
      }, function () { echec('Modification impossible'); });
      return false;
    },
    retirer: function (id) {
      var c = client(); if (!c) return;
      c.from(T_MSG).update({ archive: true }).eq('id', id).eq('auteur_id', moi()).select(COLS_M).then(function (r) {
        if (r.error || !r.data || !r.data.length) { echec('Retrait impossible'); return; }
        var m = surMessage(id);
        if (m) m.archive = true;
        S.retrait = null; peindreFlux(); peindreListe();
      }, function () { echec('Retrait impossible'); });
    }
  };

  // Appui long sur une réaction (téléphone) : qui a réagi
  document.addEventListener('touchstart', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.dsc-re'); if (!b) return;
    clearTimeout(V2.discussion._lp);
    V2.discussion._lp = setTimeout(function () { if (V2.toast) V2.toast(b.getAttribute('data-qui') || ''); }, 550);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(function (n) { document.addEventListener(n, function () { clearTimeout(V2.discussion._lp); }, { passive: true }); });

  V2.pages.discussion = {
    needs: [],
    render: function (root) {
      if (V2.user && V2.user.opsoOnly) { root.innerHTML = '<div class="v2-wrap v2-u"><p>Cet espace n’est pas ouvert à ce compte.</p></div>'; return; }
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      S.sujet = null; S.nouveau = false; S.mob = 'liste'; S.msgs = {}; S.pleins = {}; S.rx = {}; S.nonLus = {}; S.dernier = ''; S.edit = null; S.retrait = null; S.ouverts = {}; S.rOuvert = {};
      S.filtre = 'tout'; S.q = ''; S.res = null; S.fich = null; S.repRem = null; S.enVol = false; S.occupe = false; S.mention = null; S.bro = {}; S.pj = {}; S.urls = {}; S.urlsLe = 0;
      VU = null;
      root.innerHTML = top + '<div class="v2-wrap v2-u dsc-wrap"><div class="v2-rdv-cap"><h1>Discussion</h1>' +
        '<p>Le fil de l’équipe réunit les messages de tous les sujets et les remontées. Un sujet = une conversation : tout le monde peut en lancer un, et toute l’équipe le voit. ' +
        'Les nouveaux messages arrivent toutes les 45 secondes.</p><div id="dsc-notif"></div></div><div id="dsc"></div></div>';
      if (V2.rdvNotif && V2.rdvNotif.ligne) V2.rdvNotif.ligne(document.getElementById('dsc-notif'));
      demarrer();
      charger();
    }
  };

  function ensureCss() {
    if (document.getElementById('v2-dsc-css')) return;
    var s = document.createElement('style'); s.id = 'v2-dsc-css';
    s.textContent = [
      '.dsc-wrap{max-width:1180px;padding-bottom:60px}',
      '#dsc{margin-top:16px}',
      '.dsc-deux{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;align-items:start}',
      '.dsc-canaux{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1);padding:10px;min-width:0}',
      '.dsc-lh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 6px 10px}',
      '.dsc-lh h2{margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em}',
      '.dsc-lh span{font-size:12.5px;color:var(--muted)}',
      '.dsc-lh .v2-btn{min-height:44px;flex:none}',
      '.dsc-ls{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;max-height:min(470px,56vh);overflow-y:auto}',
      '.dsc-can{display:flex;align-items:center;gap:8px;width:100%;min-height:56px;padding:8px 10px;border:none;border-radius:10px;background:none;font:inherit;color:var(--ip-ink);text-align:left;cursor:pointer}',
      '.dsc-can:hover{background:var(--card-2)}',
      '.dsc-can.on{background:var(--halo)}',
      '.dsc-canfil{min-height:64px;border:1px solid var(--line);background:linear-gradient(135deg,var(--halo),var(--card) 80%);box-shadow:0 6px 18px -10px var(--ip-blue)}',
      '.dsc-canfil.on{border-color:var(--ip-blue);background:linear-gradient(135deg,var(--halo),var(--card) 90%)}',
      '.dsc-cfi{flex:none;width:40px;height:40px;border-radius:12px;background:var(--ip-blue);color:#fff;display:inline-flex;align-items:center;justify-content:center}',
      '.dsc-canfil .dsc-cn b{font-size:15px;font-weight:800}',
      '.dsc-cn{flex:1;min-width:0}',
      '.dsc-cn b{display:block;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsc-can.nl .dsc-cn b{font-weight:800}',
      '.dsc-cn small{display:block;font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsc-can em{flex:none;min-width:22px;height:22px;border-radius:999px;background:var(--ip-blue);color:#fff;font-style:normal;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;padding:0 7px}',
      '.dsc-droite{min-width:0}',
      '.dsc-fenetre{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1);min-width:0;overflow:hidden}',
      '.dsc-th{display:flex;align-items:center;gap:12px;padding:14px 18px 12px;border-bottom:1px solid var(--line)}',
      '.dsc-fenfil .dsc-th{background:linear-gradient(180deg,var(--halo),var(--card))}',
      '.dsc-tht{min-width:0;flex:1}',
      '.dsc-th h2{margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em;overflow-wrap:anywhere}',
      '.dsc-th span{font-size:12.5px;color:var(--muted)}',
      '.dsc-bf{min-height:44px;flex:none;background:var(--card);border:1px solid var(--line-strong);font-weight:700}',
      '.dsc-bf.on{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.dsc-retour{display:none;flex:none;min-height:44px;padding:0 4px;border:none;background:none;font:inherit;font-weight:700;color:var(--ip-blue);cursor:pointer}',
      '.dsc-flux{height:max(380px,min(560px,calc(100vh - 430px)));overflow-y:auto;padding:6px 18px 14px;-webkit-overflow-scrolling:touch}',
      '.dsc-fenfil .dsc-flux{background:var(--card-2)}',
      '.dsc-jour,.dsc-nouv{display:flex;align-items:center;gap:12px;margin:16px 0 6px;font-size:12.5px;font-weight:700;color:var(--muted)}',
      '.dsc-jour::before,.dsc-jour::after,.dsc-nouv::before,.dsc-nouv::after{content:"";flex:1;height:1px;background:var(--line)}',
      '.dsc-jour span{text-transform:capitalize}',
      '.dsc-nouv{color:var(--ip-blue)}',
      '.dsc-nouv::before,.dsc-nouv::after{background:var(--ip-blue)}',
      // messages
      '.dsc-m{display:flex;gap:12px;padding:10px 0;border-radius:10px}',
      '.dsc-fenfil .dsc-m{padding:12px 14px;margin:6px 0;background:var(--card);border:1px solid var(--line);border-radius:12px}',
      '.dsc-m.vise,.dsc-rc.vise{box-shadow:0 0 0 3px var(--ip-blue);background:var(--halo)}',
      '.dsc-m.ment{background:color-mix(in srgb,var(--c-amber) 7%,var(--card))}',
      '.dsc-m.nv{border-color:var(--ip-blue)}',
      '.dsc-av{flex:none;width:38px;height:38px;border-radius:12px;background:var(--halo);color:var(--ip-blue);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}',
      '.dsc-av.moi{background:var(--ip-ink);color:#fff}',
      '.dsc-av.p{width:30px;height:30px;border-radius:10px;font-size:11.5px}',
      '.dsc-mb,.dsc-rb{min-width:0;flex:1}',
      '.dsc-mh{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px}',
      '.dsc-mh b{font-size:14px;font-weight:800}',
      '.dsc-mh time{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.dsc-tag{display:inline-block;max-width:100%;min-height:28px;padding:3px 10px;border:1px solid color-mix(in srgb,var(--ip-blue) 28%,var(--line));border-radius:var(--r-pill);background:var(--halo);color:var(--ip-blue);font:inherit;font-size:12px;font-weight:700;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}',
      '.dsc-tag:hover{border-color:var(--ip-blue)}',
      '.dsc-tag.rem{border-color:color-mix(in srgb,var(--c-amber) 45%,var(--line));background:color-mix(in srgb,var(--c-amber) 10%,var(--card));color:var(--ip-ink)}',
      '.dsc-pm,.dsc-pn{font-style:normal;font-size:11px;font-weight:800;padding:2px 8px;border-radius:var(--r-pill)}',
      '.dsc-pm{background:color-mix(in srgb,var(--c-amber) 18%,var(--card));color:var(--ip-ink);border:1px solid color-mix(in srgb,var(--c-amber) 50%,var(--line))}',
      '.dsc-pn{background:var(--ip-blue);color:#fff}',
      '.dsc-enrep{font-size:12.5px;color:var(--muted);margin-top:1px}',
      '.dsc-m p,.dsc-r p{margin:2px 0 0;font-size:14.5px;line-height:1.5;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.dsc-m p.dsc-ret{color:var(--muted);font-style:italic}',
      '.dsc-mod{font-size:12px;color:var(--muted)}',
      '.dsc-lk{color:var(--ip-blue);font-weight:700;text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}',
      '.dsc-lk::after{content:" ↗";font-size:.85em}',
      '.dsc-at{display:inline-block;padding:0 5px;border-radius:6px;background:var(--halo);color:var(--ip-blue);font-weight:700}',
      '.dsc-at.moi{background:color-mix(in srgb,var(--c-amber) 22%,var(--card));color:var(--ip-ink)}',
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
      '.dsc-ed textarea,.dsc-repf textarea{display:block;width:100%;box-sizing:border-box;min-height:80px;margin-top:4px;padding:10px 12px;border:1px solid var(--line-strong);border-radius:10px;font:inherit;font-size:16px;line-height:1.45;background:#fff;color:var(--ip-ink)}',
      '.dsc-edb{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}',
      // pièces jointes
      '.dsc-pjs{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}',
      '.dsc-ph{display:block;padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--card-2);cursor:zoom-in;line-height:0;max-width:100%}',
      '.dsc-ph:hover{border-color:var(--ip-blue)}',
      '.dsc-ph img{display:block;max-width:100%;width:auto;height:auto;max-height:190px}',
      '.dsc-ph.vide,.dsc-shot.vide{padding:22px 16px;line-height:1.4;font-size:12.5px;color:var(--muted)}',
      '.dsc-doc{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ip-ink);text-decoration:none;max-width:100%}',
      'a.dsc-doc:hover{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.dsc-doc span{min-width:0}',
      '.dsc-doc b{display:block;font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}',
      '.dsc-doc small{display:block;font-size:12px;color:var(--muted)}',
      '.dsc-di{flex:none;width:38px;height:38px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,#B42318 10%,var(--card));color:#B42318;font-style:normal}',
      '.dsc-di.excel{background:color-mix(in srgb,var(--c-mint) 14%,var(--card));color:#17724A}',
      // réactions
      '.dsc-rx{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
      '.dsc-re{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;min-width:44px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card-2);font:inherit;font-size:15px;color:var(--muted);cursor:pointer}',
      '.dsc-re b{font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ip-ink)}',
      '.dsc-re.a{background:var(--card);border-color:var(--line-strong)}',
      '.dsc-re.moi{background:var(--halo);border-color:var(--ip-blue)}',
      '.dsc-re.moi b{color:var(--ip-blue)}',
      '.dsc-re:hover{border-color:var(--ip-blue)}',
      // remontées
      '.dsc-rc{position:relative;display:flex;gap:13px;margin:12px 0;padding:14px 16px;background:linear-gradient(135deg,color-mix(in srgb,var(--ip-blue) 6%,var(--card)),var(--card) 55%);border:1px solid color-mix(in srgb,var(--ip-blue) 24%,var(--line));border-radius:var(--r-md);box-shadow:0 10px 26px -16px var(--ip-blue)}',
      '.dsc-vote{flex:none;align-self:flex-start;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:44px;min-height:48px;border:1px solid var(--line);background:var(--card-2);border-radius:10px;padding:7px 0;cursor:pointer;color:var(--muted);font:inherit}',
      '.dsc-vote:hover{border-color:var(--ip-blue);color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 8%,var(--card))}',
      '.dsc-vote span{font-size:11px;line-height:1}',
      '.dsc-vote b{font-size:14px;font-variant-numeric:tabular-nums;color:var(--ip-ink)}',
      '.dsc-rcb{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}',
      '.dsc-rch{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;font-size:12.5px;color:var(--muted)}',
      '.dsc-rtag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:var(--r-pill);background:var(--ip-blue);color:#fff;font-size:11.5px;font-weight:800;letter-spacing:.02em}',
      '.dsc-rpar{flex:1;min-width:0}',
      '.dsc-rpar b{color:var(--ip-ink)}',
      '.dsc-st{border:1px solid color-mix(in srgb,var(--stc) 40%,var(--line));background:color-mix(in srgb,var(--stc) 12%,var(--card));color:var(--ip-ink);font:inherit;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;padding:4px 10px;border-radius:var(--r-pill);display:inline-block}',
      'button.dsc-st{cursor:pointer;min-height:32px}',
      '@media (max-width:760px){button.dsc-st{min-height:44px}}',
      '.dsc-rtxt{margin:0;font-size:15px;line-height:1.5;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.dsc-shot{align-self:flex-start;display:block;max-width:100%;padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--card-2);cursor:zoom-in;line-height:0}',
      '.dsc-shot:hover{border-color:var(--ip-blue)}',
      '.dsc-shot img{display:block;max-width:100%;width:auto;height:auto;max-height:170px}',
      '.dsc-rep{font-size:13.5px;line-height:1.5;color:var(--ip-ink);background:color-mix(in srgb,var(--c-mint) 9%,var(--card));border:1px solid color-mix(in srgb,var(--c-mint) 30%,var(--line));border-radius:8px;padding:9px 12px}',
      '.dsc-rep b{display:block;font-size:11.5px;font-weight:800;color:var(--ip-ink);margin-bottom:2px}',
      '.dsc-repf textarea{margin-top:0}',
      '.dsc-coms{display:flex;flex-direction:column;gap:10px;margin-top:4px;padding-top:10px;border-top:1px dashed var(--line-strong)}',
      '.dsc-sc{margin:0;font-size:13px;color:var(--muted)}',
      // barre de filtres et recherche
      '.dsc-barre{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;padding:9px 18px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--card)}',
      '.dsc-pills{display:flex;gap:6px;flex-wrap:wrap;flex:0 1 auto;min-width:0}',
      '.dsc-pill{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 11px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card-2);font:inherit;font-size:13px;font-weight:700;color:var(--ip-ink);cursor:pointer;white-space:nowrap}',
      '.dsc-pill b{font-size:12px;font-variant-numeric:tabular-nums;color:var(--muted)}',
      '.dsc-pill:hover{border-color:var(--ip-blue)}',
      '.dsc-pill.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.dsc-pill.on b{color:#fff}',
      '.dsc-rech{flex:1 1 170px;min-width:170px}',
      '.dsc-rech input{display:block;width:100%;box-sizing:border-box;min-height:40px;padding:0 12px;border:1px solid var(--line-strong);border-radius:var(--r-pill);font:inherit;font-size:14px;background:#fff;color:var(--ip-ink)}',
      '.dsc-rech input:focus,.dsc-cv select:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.dsc-rsh{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin:12px 0 6px;font-size:13.5px;color:var(--ip-ink)}',
      '.dsc-rs{display:block;width:100%;margin:6px 0;padding:11px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card);font:inherit;text-align:left;color:var(--ip-ink);cursor:pointer}',
      '.dsc-rs:hover{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.dsc-rsh2{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;margin-bottom:4px}',
      '.dsc-rsh2 b{font-size:13.5px}',
      '.dsc-rsh2 time{font-size:12px;color:var(--muted)}',
      '.dsc-rst{display:block;font-size:14px;line-height:1.5;overflow-wrap:anywhere}',
      '.dsc-rst mark{background:color-mix(in srgb,var(--c-amber) 35%,var(--card));color:var(--ip-ink);padding:0 2px;border-radius:3px;font-weight:700}',
      // fichiers et liens
      '.dsc-fh{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 14px;margin:12px 0 8px}',
      '.dsc-fht b{display:block;font-size:15px;font-weight:800}',
      '.dsc-fht span{font-size:12.5px;color:var(--muted)}',
      '.dsc-seg{display:inline-flex;gap:2px;padding:3px;background:var(--card-2);border:1px solid var(--line);border-radius:10px}',
      '.dsc-seg button{border:none;background:none;padding:0 12px;min-height:40px;border-radius:7px;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer}',
      '.dsc-seg button.on{background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-1)}',
      '.dsc-pills.sous{margin-bottom:8px}',
      '.dsc-fr{display:flex;align-items:center;gap:12px;margin:6px 0;padding:8px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card)}',
      '.dsc-fth{flex:none;width:52px;height:52px;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:var(--card-2);padding:0;display:inline-flex;align-items:center;justify-content:center;color:var(--muted);font-style:normal;cursor:zoom-in}',
      '.dsc-fth img{width:100%;height:100%;object-fit:cover}',
      '.dsc-fth.ico{cursor:default}',
      '.dsc-fth.ico.pdf{color:#B42318}',
      '.dsc-fth.ico.excel{color:#17724A}',
      '.dsc-frb{flex:1;min-width:0}',
      '.dsc-frb b,.dsc-frb .dsc-lk{display:block;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsc-frb small{display:block;font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsc-fr .dsc-tag{flex:0 1 190px}',
      // vides, états
      '.dsc-vide{margin:24px 18px;color:var(--muted);font-size:14px}',
      '.dsc-etat{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1);padding:40px 24px;text-align:center}',
      '.dsc-etat h2{margin:0 0 8px;font-size:18px;font-weight:800}',
      '.dsc-etat p{margin:0 0 14px;color:var(--muted);font-size:14.5px}',
      // zone d\'écriture
      '.dsc-c{border-top:1px solid var(--line);padding:12px 14px;background:var(--card-2)}',
      '.dsc-fenfil .dsc-c{border-top:none;border-bottom:none;background:var(--card)}',
      '.dsc-fenfil .dsc-c{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:start;padding:12px 18px}',
      '.dsc-fenfil .dsc-cv{grid-column:1/-1;margin-bottom:0}',
      '.dsc-fenfil .dsc-zone{grid-column:1;grid-row:2}',
      '.dsc-fenfil .dsc-cb{display:contents}',
      '.dsc-fenfil .dsc-clip{grid-column:2;grid-row:2;min-height:48px;margin:0}',
      '.dsc-fenfil .dsc-cb .v2-btn{grid-column:3;grid-row:2;min-height:48px;margin:0}',
      '.dsc-fenfil .dsc-pv{grid-column:1/-1;grid-row:3}',
      '.dsc-fenfil .dsc-note{grid-column:1/-1;grid-row:4;font-size:12px}',
      '.dsc-fenfil .dsc-c textarea{min-height:48px;height:48px;padding:11px 12px}',
      '.dsc-c.sur,.dsc-cc.sur{box-shadow:inset 0 0 0 2px var(--ip-blue);background:var(--halo)}',
      '.dsc-cv{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}',
      '.dsc-cv label{font-size:13px;font-weight:700;color:var(--ip-ink)}',
      '.dsc-fenfil .dsc-cv select,.dsc-cv select{flex:1 1 200px;min-width:0;min-height:44px;height:44px;padding:0 10px;border:1px solid var(--line-strong);border-radius:10px;font:inherit;font-size:16px;background:#fff;color:var(--ip-ink)}',
      '.dsc-idee{min-height:44px;margin-left:auto;background:var(--card);display:inline-flex;align-items:center;gap:6px;border-color:color-mix(in srgb,var(--ip-blue) 40%,var(--line));color:var(--ip-blue);font-weight:700}',
      '.dsc-zone{position:relative}',
      '.dsc-c textarea,.dsc-cc textarea,.dsc-nf textarea,.dsc-nf input{display:block;width:100%;box-sizing:border-box;min-height:64px;padding:10px 12px;border:1px solid var(--line-strong);border-radius:12px;font:inherit;font-size:16px;line-height:1.45;resize:none;background:#fff;color:var(--ip-ink)}',
      '.dsc-nf input{min-height:48px}',
      '.dsc-c textarea:focus,.dsc-cc textarea:focus,.dsc-rf input:focus,.dsc-nf textarea:focus,.dsc-nf input:focus,.dsc-ed textarea:focus,.dsc-repf textarea:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.dsc-cc{padding:0}',
      '.dsc-cc textarea{min-height:56px}',
      '.dsc-nf{padding:14px 18px 16px}',
      '.dsc-nf label{display:block;margin:10px 0 6px;font-size:13px;font-weight:700;color:var(--ip-ink)}',
      '.dsc-cb{display:flex;align-items:center;gap:10px;margin-top:10px}',
      '.dsc-note{flex:1;font-size:12.5px;color:var(--muted)}',
      '.dsc-cb .v2-btn{min-height:44px}',
      '.dsc-clip{display:inline-flex;align-items:center;gap:6px;min-height:44px;min-width:44px;padding:0 12px;border:1px solid var(--line-strong);border-radius:10px;background:var(--card);font:inherit;font-size:13px;font-weight:700;color:var(--ip-ink);cursor:pointer}',
      '.dsc-clip:hover{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.dsc-pv{display:flex;flex-direction:column;gap:6px}',
      '.dsc-pv:not(:empty){margin-top:8px}',
      '.dsc-pc{display:flex;align-items:center;gap:10px;padding:6px 8px;border:1px solid var(--line);border-radius:12px;background:var(--card)}',
      '.dsc-pc img{width:56px;height:44px;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:#fff}',
      '.dsc-pc span{flex:1;min-width:0}',
      '.dsc-pc b{display:block;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsc-pc small{display:block;font-size:12px;color:var(--muted)}',
      '.dsc-pcx{min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card-2);font:inherit;font-size:12.5px;font-weight:700;color:var(--ip-ink);cursor:pointer}',
      // mentions
      '.dsc-mp{position:absolute;left:0;bottom:calc(100% + 6px);z-index:6;min-width:240px;max-width:100%;padding:4px;background:var(--card);border:1px solid var(--line-strong);border-radius:12px;box-shadow:0 16px 36px -12px rgba(16,19,28,.35)}',
      '.dsc-mp.bas{bottom:auto;top:calc(100% + 6px)}',
      '.dsc-mp[hidden]{display:none}',
      '.dsc-mp button{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:4px 10px;border:none;border-radius:8px;background:none;font:inherit;font-size:14px;font-weight:600;color:var(--ip-ink);text-align:left;cursor:pointer}',
      '.dsc-mp button.on,.dsc-mp button:hover{background:var(--halo)}',
      // agrandissement
      '.dsc-zoom{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(16,19,28,.72);cursor:zoom-out}',
      '.dsc-zoom img{max-width:100%;max-height:100%;border-radius:10px;box-shadow:0 24px 60px rgba(16,19,28,.4);background:#fff}',
      '.dsc-zx{position:absolute;top:14px;right:14px;min-height:44px;padding:0 16px;border:none;border-radius:var(--r-pill);background:#fff;font:inherit;font-weight:700;color:var(--ip-ink);cursor:pointer}',
      '@media (max-width:1000px){',
      '  .dsc-deux{grid-template-columns:260px minmax(0,1fr)}',
      '}',
      '@media (max-width:760px){',
      '  .dsc-wrap{padding-left:14px;padding-right:14px}',
      '  .dsc-deux{grid-template-columns:1fr}',
      '  .dsc-surliste .dsc-droite{display:none}',
      '  .dsc-surfil .dsc-canaux{display:none}',
      '  .dsc-retour{display:inline-flex;align-items:center}',
      '  .dsc-ls{max-height:none}',
      '  .dsc-flux{padding:4px 12px 12px;height:min(520px,62vh)}',
      '  .dsc-th{padding:10px 12px;flex-wrap:wrap}',
      '  .dsc-nf{padding:12px}',
      '  .dsc-note{font-size:12px}',
      '  .dsc-barre{padding:8px 12px}',
      '  .dsc-pills{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}',
      '  .dsc-pill{min-height:44px;flex:none}',
      '  .dsc-rech{flex:1 1 100%}',
      '  .dsc-rech input{min-height:44px;font-size:16px}',
      '  .dsc-fenfil .dsc-m{padding:10px;gap:9px}',
      '  .dsc-av{width:34px;height:34px}',
      '  .dsc-rc{padding:12px;gap:9px}',
      '  .dsc-re{min-height:44px}',
      '  .dsc-doc b{max-width:180px}',
      '  .dsc-fr{flex-wrap:wrap}',
      '  .dsc-fr .dsc-tag{flex:1 1 100%}',
      '  .dsc-idee{margin-left:0;flex:none;min-width:44px;padding:0 12px}',
      '  .dsc-idl{display:none}',
      '  .dsc-cv{flex-wrap:nowrap}',
      '  .dsc-cv label{display:none}',
      '  .dsc-rpar{flex:1 1 100%;order:3}',
      '  .dsc-tag{min-height:44px;display:inline-flex;align-items:center}',
      '  .dsc-fenfil .dsc-mh .dsc-tag{order:3;flex:1 1 100%;min-height:44px;display:flex;align-items:center;font-size:12.5px}',
      '  .dsc-fenfil .dsc-c{padding:12px}',
      '  .dsc-fenfil .dsc-c textarea{height:48px}',
      '  .dsc-fenfil .dsc-cb .v2-btn{padding:0 14px}',
      '  .dsc-seg button{min-height:44px}',
      '  .dsc-cb .dsc-note{display:none}',
      '  .dsc-clip span{display:none}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
