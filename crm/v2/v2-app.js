/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · App — shell, routeur, login, accueil réel, recherche ⌘K
   Architecture modulaire : chaque pilier = fichier séparé (V2.pages.xxx)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2;
  V2.pages = V2.pages || {};   // registry des piliers : { home, pharma, catalogue, fiches, pilotage }
  V2.route = { name: 'home', param: null };

  var $app = function () { return document.getElementById('v2-root'); };

  // Symbole de la touche modificatrice selon l'OS (⌘ sur Mac, Ctrl ailleurs)
  var MOD = (/Mac|iPhone|iPad|iPod/.test((navigator.platform || '') + ' ' + (navigator.userAgent || ''))) ? '⌘' : 'Ctrl';

  // ── TOAST ─────────────────────────────────────
  V2.toast = function (msg, variant) {
    var host = document.getElementById('v2-toast-host');
    if (!host) { host = document.createElement('div'); host.id = 'v2-toast-host'; host.className = 'v2-toast-host'; document.body.appendChild(host); }
    var t = document.createElement('div');
    t.className = 'v2-toast';
    var col = variant === 'error' ? 'var(--c-rose)' : variant === 'warn' ? 'var(--c-amber)' : 'var(--c-mint)';
    t.innerHTML = '<span class="dot" style="background:' + col + '"></span><span>' + msg + '</span>';
    host.appendChild(t);
    requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('show'); }); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 350); }, 2800);
  };

  // ── Bandeau « des chiffres manquent » ─────────
  // ⚠️ 14/08/2026 — Will : « ya plus aucune données sur jarvis ».
  // Depuis le 13/08 les chiffres viennent d'un espace fermé. Quand un de ces
  // fichiers ne se charge pas, l'app s'affichait ENTIÈRE avec des zéros et des
  // listes vides — rien ne disait que c'était un échec de téléchargement. Des
  // zéros muets sur un CA, c'est pire que pas d'écran du tout : on les croit.
  // `wml` a déjà son écran plein (« Données non chargées ») ; ce bandeau couvre
  // les deux autres, qui échouaient sans un mot.
  var LIB_PROTEGE = {
    wml: 'les officines et leurs ventes',
    establishments: 'le chiffre d’affaires par établissement',
    sagitta: 'la sélection Sagitta'
  };
  V2.bandeauDonneesManquantes = function () {
    ensureAppbarCss();
    var ex = document.getElementById('v2-databar');
    var ko = (V2.donneesProtegeesKO && V2.donneesProtegeesKO()) || [];
    if (!ko.length) { if (ex) ex.classList.remove('show'); return; }
    if (!ex) {
      ex = document.createElement('div');
      ex.id = 'v2-databar';
      ex.className = 'v2-appbar v2-appbar-data';
      document.body.appendChild(ex);
    }
    var quoi = ko.map(function (k) { return LIB_PROTEGE[k] || k; }).join(' et ');
    ex.innerHTML =
      '<div class="v2-appbar-in">' +
        '<span class="v2-appbar-lbl">Les chiffres n’ont pas pu être téléchargés (' + quoi +
        '). Ce qui s’affiche est incomplet.</span>' +
        '<button class="v2-btn v2-btn-primary v2-appbar-go" onclick="V2.rechargerDonneesProtegees()">Réessayer</button>' +
      '</div>';
    ex.classList.add('show');
  };
  V2.rechargerDonneesProtegees = function () {
    var ko = (V2.donneesProtegeesKO && V2.donneesProtegeesKO()) || [];
    if (!ko.length || !V2.loadFiles) return;
    V2.toast('Nouvelle tentative…');
    V2.loadFiles(ko).then(function () {
      var reste = (V2.donneesProtegeesKO && V2.donneesProtegeesKO()) || [];
      if (reste.length) V2.toast('Toujours indisponible — vérifie ta connexion', 'error');
      else V2.toast('Chiffres récupérés');
      V2.render();
    });
  };

  // ── NAVIGATION ────────────────────────────────
  /* ── MESURE D'USAGE ────────────────────────────────────────────────
     Ajoutée le 24/08/2026. Avant, RIEN ne mesurait quel écran servait :
     aucune librairie d'audience, aucun journal de connexion, et le trafic
     de GitHub Pages ne laisse aucune trace. Compter les écritures en base
     ne mesure que ce qu'on SAISIT, pas ce qu'on CONSULTE — or l'usage
     principal du CRM est la consultation. Toute refonte se décidait donc
     à l'aveugle.

     Une ligne par ouverture d'écran, jamais deux fois le même en moins de
     5 minutes : faire des allers-retours entre deux onglets ne doit pas
     gonfler le compte.

     Nominatif — décision de Will du 24/08 : « on peut identifier qui, c'est
     pas dérangeant, au contraire ». À annoncer à l'équipe (information CNIL).

     La mesure ne doit JAMAIS casser ni ralentir l'app : pas d'await, échec
     silencieux. Une statistique perdue n'est rien ; un écran qui plante, si. */
  /* ⚠️ L'anti-doublon DOIT survivre au rechargement de page.
     Mesuré en prod le 24/08 dès les premières lignes : « home » a été compté
     deux fois à 6 secondes d'intervalle, dans la MÊME session. Cause : la
     mémoire vive (un simple objet JS) repart à vide à chaque rechargement,
     alors que la session, elle, tient dans sessionStorage.
     Conséquence, et c'est ce qui rendait la mesure trompeuse : tout
     rechargement retombe sur l'ACCUEIL, donc « home » était systématiquement
     sur-compté par rapport aux autres écrans — précisément le classement
     qu'on cherche à lire. L'état de l'anti-doublon vit donc au même endroit
     que la session. */
  function _vusLire() {
    try { return JSON.parse(sessionStorage.getItem('jarvis_vus') || '{}') || {}; }
    catch (e) { return {}; }
  }
  function _vusEcrire(m) {
    try { sessionStorage.setItem('jarvis_vus', JSON.stringify(m)); } catch (e) {}
  }
  V2.mesurer = function (ecran) {
    try {
      if (!ecran || !V2.user) return;
      var t = Date.now();
      var vus = _vusLire();
      if (vus[ecran] && t - vus[ecran] < 5 * 60 * 1000) return;
      vus[ecran] = t;
      _vusEcrire(vus);
      var c = V2.sb && V2.sb();
      if (!c) return;
      var s = '';
      try {
        s = sessionStorage.getItem('jarvis_session') || '';
        if (!s) { s = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('jarvis_session', s); }
      } catch (e) { s = 'sans-stockage'; }
      c.from('usage_ecran').insert({
        ecran: ecran,
        session: s,
        user_id: V2.user.id,
        user_name: V2.user.name
      }).then(function () {}, function () {});
    } catch (e) { /* silence : la mesure ne casse jamais l'app */ }
  };

  // Le bandeau rouge de diagnostic (index.html, #__err) est posé en position:fixed
  // sur <body>, HORS de #v2-root : il ne survivait PAS au re-rendu de l'écran, mais
  // il survivait à la NAVIGATION (constaté au banc de nuit 25/09/2026, ex. l'erreur
  // d'un écran quitté restait affichée avec « [écran : X] » par-dessus l'écran
  // suivant — un diagnostic devient un mensonge dès qu'il désigne le mauvais écran).
  // On l'efface au moment où on QUITTE réellement un écran pour un autre (pas à
  // chaque re-rendu du même écran, qui doit pouvoir garder son erreur visible).
  function __clearStaleErrBanner() {
    try { var b = document.getElementById('__err'); if (b && b.parentNode) b.parentNode.removeChild(b); } catch (e) {}
  }

  V2._navStack = V2._navStack || ['home'];
  V2.go = function (name, param) {
    __clearStaleErrBanner();
    // sens de navigation (pour la transition) : si on revient sur l'écran
    // précédent de la pile → 'back', sinon → 'fwd'
    try {
      var key = name + (param ? '/' + param : '');
      var st = V2._navStack;
      if (st.length >= 2 && st[st.length - 2] === key) { st.pop(); window.__navDir = 'back'; }
      else { st.push(key); if (st.length > 30) st.shift(); window.__navDir = 'fwd'; }
    } catch (e) { window.__navDir = 'fwd'; }
    V2.route = { name: name, param: param || null };
    V2.mesurer(name);   // 24/08/2026 — mesure d'usage, silencieuse et sans await
    try { location.hash = '#' + name + (param ? '/' + encodeURIComponent(param) : ''); } catch (e) {}
    // 11/09/2026 — perf : le clic est ACCUSÉ dans cette frame (classe v2-nav →
    // curseur + filet de progression, voir v2.css), et le rendu lourd part à la
    // frame suivante : le navigateur peint d'abord, l'écran se construit ensuite.
    // Aucun appelant JS de V2.go ne lit le DOM rendu juste après (vérifié le 11/09).
    try { document.documentElement.classList.add('v2-nav'); } catch (e) {}
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 0); };
    raf(function () { setTimeout(function () {
      try { V2.render(); }
      finally {
        try { document.documentElement.classList.remove('v2-nav'); } catch (e) {}
        try { document.querySelector('.v2-wrap, .v2-content')?.scrollTo?.({ top: 0 }); window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {}
      }
    }, 0); });
  };

  // Retour = UN pas en arrière dans l'historique NATIF du navigateur (incassable,
  // gère correctement A→B→A). Chaque V2.go pose un hash → une entrée d'historique ;
  // le handler 'hashchange' re-rend l'écran précédent. Repli accueil si pas d'historique.
  V2.goBack = function () {
    try {
      if (window.history && window.history.length > 1) { window.history.back(); return; }
    } catch (e) {}
    V2.go('home');
  };

  function parseHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return { name: 'home', param: null };
    var parts = h.split('/');
    // 02/10/2026 — L'Argument, la Présentation Intégral et l'Audit marge sont retirés (demande de Will) : leur ancienne adresse ramène à l'accueil.
    // (Fiches PDF garde son adresse : « Commande recommandée » et la barre du panier y mènent encore. L'audit d'une officine vit dans sa fiche, sans cette route.)
    if (parts[0] === 'argument' || parts[0] === 'presentation' || parts[0] === 'audit') {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      return { name: 'home', param: null };
    }
    var param = null;
    if (parts[1]) { try { param = decodeURIComponent(parts[1]); } catch (e) { param = parts[1]; } }  // lien malformé → pas de crash/spinner figé
    return { name: parts[0] || 'home', param: param };
  }

  // ── SHELL (topbar) ────────────────────────────
  function topbar(opts) {
    opts = opts || {};
    var back = opts.back
      ? '<button class="v2-back" onclick="V2.goBack()">' + ICO('back', 16) + 'Retour</button>'
      : '';
    var initials = (V2.user && V2.user.name ? V2.user.name.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('') : 'WM').toUpperCase();
    // Le logo Intégral Pharma est TOUJOURS présent et cliquable → accueil (depuis n'importe où).
    // Sur une page interne, on l'affiche en version compacte (logo seul) à côté du bouton retour.
    var brand = '<a class="v2-brand' + (back ? ' v2-brand-compact' : '') + '" onclick="V2.go(\'home\')" title="Accueil" aria-label="Accueil">' +
      // 02/10/2026 — sur un écran interne, le chemin vers l'accueil est une maison sur fond blanc : le logo
      // (carré bleu à croix) se confondait avec le « + » de la barre. OPSO n'a pas de « + » et garde son logo.
      ((back && !(window.V2_BRAND && window.V2_BRAND.opso))
        ? '<span class="tp-accueil"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.8 9.6V19a1 1 0 0 0 1 1h3.4v-5.2h3.6V20h3.4a1 1 0 0 0 1-1V9.6"/></svg></span>'
        : '<span class="v2-logo">' + ((V2.route && V2.route.name === 'home' && !(window.V2_BRAND && window.V2_BRAND.opso))
          ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/></svg>'
          : ICO('logo', 22)) + '</span>') +
      (back ? '' : '<span><span class="v2-brand-t">' + ((window.V2_BRAND && window.V2_BRAND.name) || 'Intégral Pharma') + '<span class="v2-brand-dot" aria-hidden="true"></span></span><br><span class="v2-brand-s">' + ((window.V2_BRAND && window.V2_BRAND.sub) || 'Espace commercial') + '</span></span>') +
      '</a>';
    // Nom de l'écran (02/10/2026) : donné par l'appelant, sinon lu dans la liste d'outils de
    // l'accueil (G4_PORTES, une seule source). Route inconnue ou sous-écran : pas de nom.
    var nom = '';
    if (back) {
      var nm = opts.nom || nomEcran(V2.route && V2.route.name);
      if (nm) nom = '<div class="tp-nom">' + esc(nm) + '</div>';
    }
    // La bascule Intégral ↔ Escale a quitté la barre : elle est la rubrique « Espace » du rail de l'accueil
    // (panneau « Mon espace » sous 1100 px), dans les deux sens (u2BlocEspace, V2.basculeEspace).
    var plus = plusItems().length
      ? '<button type="button" class="tp-plus" aria-label="Actions rapides" aria-haspopup="menu" aria-expanded="false" onclick="V2.plusMenu(this)">' + ICO('plus', 22, 2.2) + '</button>'
      : '';
    return '' +
      '<div class="v2-top">' +
        '<div class="tp-g">' + back + brand + nom + '</div>' +
        '<div class="tp-d">' +
          ((V2.route && V2.route.name === 'home' && window.V2_BRAND && window.V2_BRAND.opso) ? '' : '<button type="button" class="v2-top-search" aria-label="Rechercher" aria-haspopup="dialog" onclick="V2.onTopSearch()">' + ICO('search', 18, 2) + '<span class="txt">Rechercher</span><kbd>' + MOD + 'K</kbd></button>') +
          plus +
          '<button type="button" class="tp-avb" aria-label="Mon compte" aria-haspopup="menu" aria-expanded="false" title="' + esc(V2.user ? V2.user.name : '') + '" onclick="V2.userMenu(this)"><span class="v2-av">' + esc(initials) + '</span></button>' +
        '</div>' +
      '</div>';
  }
  V2.topbar = topbar;

  // Nom de l'écran affiché dans la barre : on le lit dans G4_PORTES (la liste d'outils de l'accueil),
  // jamais recopié ici. Les portes qui ne sont qu'un raccourci (champ `js`) ne nomment pas l'écran.
  function nomEcran(route) {
    if (!route) return '';
    for (var k in G4_PORTES) {
      var d = G4_PORTES[k];
      if (d.page === route && !d.js) return d.nom;
    }
    return '';
  }
  V2.nomEcran = nomEcran;

  // Le menu « + » de la barre : trois gestes, dans cet ordre, seulement si la fonction existe dans l'espace courant.
  function plusItems() {
    var it = [];
    if (V2.rdvGeste && V2.rdvGeste.ouvrir) it.push({ ic: 'cal', t: 'Noter un rendez-vous', f: function () { V2.rdvGeste.ouvrir(); } });
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.remonteeOpen) it.push({ ic: 'spark', t: 'Proposer une amélioration', f: function () { V2.remonteeOpen(); } });
    if (V2.pages && V2.pages.remontees) it.push({ ic: 'plus', t: 'Proposer un outil', f: function () { V2.go('remontees'); } });
    return it;
  }

  // Menu flottant ancré sous un bouton de la barre : Échap et clic dehors le ferment, Échap rend le focus au bouton.
  function menuBarre(id, btn, html) {
    var ex = document.getElementById(id);
    if (ex) { ex.parentNode.removeChild(ex); if (btn) btn.setAttribute('aria-expanded', 'false'); return null; }
    var m = document.createElement('div');
    m.id = id;
    m.className = 'v2-usermenu';
    m.setAttribute('role', 'menu');
    m.innerHTML = html;
    document.body.appendChild(m);
    if (btn) {
      var r = btn.getBoundingClientRect();
      m.style.top = Math.round(r.bottom + 8) + 'px';
      m.style.right = Math.max(12, Math.round(window.innerWidth - r.right)) + 'px';
      btn.setAttribute('aria-expanded', 'true');
      var f = m.querySelector('[role=menuitem]'); if (f) { try { f.focus(); } catch (e) {} }
    }
    requestAnimationFrame(function () { m.classList.add('open'); });
    setTimeout(function () {
      function close(e) {
        if (e.type === 'keydown' && e.key !== 'Escape') return;
        if (e.type === 'click' && (m.contains(e.target) || (btn && btn.contains(e.target)) || (e.target.closest && e.target.closest('.v2-av')))) return;
        if (m.parentNode) m.parentNode.removeChild(m);
        // le bouton a pu être redessiné pendant que le menu était ouvert (l'écran se repeint) : on rend le focus à son remplaçant
        var cible = btn && (btn.isConnected ? btn : document.querySelector('.v2-top .' + String(btn.className).split(' ')[0]));
        if (cible) { cible.setAttribute('aria-expanded', 'false'); if (e.type === 'keydown') { try { cible.focus(); } catch (x) {} } }
        document.removeEventListener('click', close, true);
        document.removeEventListener('keydown', close, true);
      }
      m._off = function () { document.removeEventListener('click', close, true); document.removeEventListener('keydown', close, true); };
      document.addEventListener('click', close, true);
      document.addEventListener('keydown', close, true);
    }, 0);
    return m;
  }

  V2.plusMenu = function (btn) {
    var it = plusItems();
    if (!it.length) return;
    var m = menuBarre('v2-plusmenu', btn,
      it.map(function (x, i) {
        return '<button type="button" class="v2-pm-it" role="menuitem" data-i="' + i + '">' + ICO(x.ic, 18, 2) + '<span>' + x.t + '</span></button>';
      }).join(''));
    if (!m) return;
    m.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.v2-pm-it');
      if (!b) return;
      var x = it[+b.getAttribute('data-i')];
      if (m._off) m._off();
      if (m.parentNode) m.parentNode.removeChild(m);
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (x) x.f();
    });
  };

  // Bascule Intégral ↔ Escale (bouton de la topbar, 15/09/2026). Le choix est
  // gardé (localStorage, en échec silencieux) pour un usage futur ; la navigation
  // elle-même se fait par l'URL, qui suffit à rester dans l'espace choisi après
  // un rechargement — pas de session cassée, `V2.user` est rechargé par l'autre app.
  // 24/09/2026 — l'espace Escale est le MÊME CRM (?espace=escale, lu dans index.html
  // avant le démarrage) : mêmes modules, données bornées à Escale. escale/v2 redirige ici.
  V2.goSpace = function (dest) {
    try { localStorage.setItem('v2-space', dest); } catch (e) {}
    location.href = dest === 'escale' ? '../../crm/v2/index.html?espace=escale' : '../../crm/v2/index.html';
  };
  // Qui a la bascule, et vers où (topbar + barre du Marketing, v2-mkt-socle.js) :
  // - un commercial Escale nommé (Guy, Tiffany, Philippe, Germain) : dans les deux sens ;
  // - un compte @escalepharma.fr : vers Escale toujours, vers Intégral seulement
  //   s'il a l'accès total (`voitTousReel`) — pas le compte générique 'Escale'.
  V2.basculeEspace = function () {
    var u = V2.user || {};
    var inEscale = !!(window.V2_BRAND && window.V2_BRAND.escale);
    var ok = u.commEscale === true ||
      (/@escalepharma\.fr$/i.test(u.email || '') && (!inEscale || u.voitTousReel === true));
    if (!ok) return null;
    return { to: inEscale ? 'crm' : 'escale', label: inEscale ? 'Intégral' : 'Escale' };
  };

  // ── Sous-onglets des espaces fusionnés (Catalogue & prix / Fiches & présentation) ──
  function subnav(items, active) {
    return '<div class="v2-subnav">' + items.map(function (it) {
      return '<a class="v2-subtab' + (it[0] === active ? ' on' : '') + '" onclick="V2.go(\'' + it[0] + '\')">' + it[1] + '</a>';
    }).join('') + '</div>';
  }
  V2.priceTabs = function (active) {
    // Catalogue unifié = une seule page (pages.molecules) — plus d'onglets.
    return '';
  };
  V2.docTabs = function (active) {
    // Prospection = Présentation seule (les Fiches ne sont plus dans cet espace) → pas d'onglets.
    return '';
  };

  V2.userMenu = function (btn) {
    if (u2PanneauAvatar(btn)) return;   // accueil u2 sous 1100 px : le panneau « Mon espace » remplace ce menu
    var installed = false;
    try { installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) {}
    var m = menuBarre('v2-usermenu', btn && btn.getBoundingClientRect ? btn : null,
      '<div class="v2-um-head">' +
        '<div class="v2-um-name">' + esc(V2.user ? V2.user.name : 'Utilisateur') + '</div>' +
        (V2.user && V2.user.email ? '<div class="v2-um-mail">' + esc(V2.user.email) + '</div>' : '') +
      '</div>' +
      (installed ? '' : '<button class="v2-um-item" role="menuitem" onclick="V2.installApp()">' + ICO('plus', 16, 2) + 'Installer l\'app</button>') +
      '<button class="v2-um-item" role="menuitem" onclick="V2.signOut()">' + ICO('logout', 16, 2) + 'Se déconnecter</button>' +
      // 24/08/2026 — information de l'équipe sur la mesure d'usage (obligation
      // CNIL dès lors qu'elle est nominative). Volontairement factuelle et
      // sans jargon : on dit ce qui est enregistré et à quoi ça sert, rien de plus.
      '<div class="v2-um-note">' + NOTE_USAGE + '</div>');
    // 02/10/2026 — « Rapport d'étonnement » : la ligne n'est posée que pour les comptes admis (v2-etonnement.js).
    if (m && V2.etonnement && V2.etonnement.menu) V2.etonnement.menu(m);
  };

  // ── Partage d'un PDF (mail/WhatsApp sur mobile, sinon téléchargement) ──
  V2.canShareFiles = function () {
    try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; }
  };
  V2.shareOrSaveBlob = function (blob, filename, title) {
    try {
      if (navigator.share && navigator.canShare) {
        var file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: title || filename }).catch(function () {});
        }
      }
    } catch (e) {}
    // repli : téléchargement classique
    var u = URL.createObjectURL(blob); var a = document.createElement('a');
    a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
    return Promise.resolve();
  };

  // ── Installation PWA (écran d'accueil) ────────
  V2.installApp = function () {
    var ex = document.getElementById('v2-usermenu'); if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
    var dp = window.__deferredInstall;
    if (dp && dp.prompt) { try { dp.prompt(); } catch (e) {} window.__deferredInstall = null; return; }
    var ua = navigator.userAgent || '';
    var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var isWin = /Windows/i.test(ua);
    var isEdge = /Edg\//i.test(ua);
    var isFirefox = /Firefox/i.test(ua);
    var steps;
    if (isIOS) {
      steps = '1. Touche le bouton <b>Partager</b> (le carré avec une flèche ⬆) en bas de Safari<br>2. Choisis <b>« Sur l\'écran d\'accueil »</b><br>3. Valide avec <b>Ajouter</b>';
    } else if (isFirefox) {
      steps = 'Firefox n\'installe pas les applis web sur ordinateur. Ouvre le CRM dans <b>Microsoft Edge</b> ou <b>Google Chrome</b>, puis clique l\'icône d\'installation à droite de la barre d\'adresse.';
    } else if (isWin && isEdge) {
      steps = '1. Clique l\'icône <b>d\'installation</b> à droite de la barre d\'adresse (un écran avec une flèche)<br>2. <i>Ou</i> menu <b>···</b> (en haut à droite) → <b>Applications</b> → <b>Installer ce site en tant qu\'application</b><br>3. Confirme avec <b>Installer</b>';
    } else if (isWin) {
      steps = '1. Clique l\'icône <b>d\'installation</b> à droite de la barre d\'adresse (un écran avec une flèche ⬇)<br>2. <i>Ou</i> menu <b>⋮</b> (en haut à droite) → <b>Caster, enregistrer et partager</b> → <b>Installer la page en tant qu\'application…</b><br>3. Confirme avec <b>Installer</b>';
    } else {
      steps = '1. Ouvre le menu du navigateur (<b>⋮</b> en haut à droite)<br>2. Choisis <b>« Installer l\'application »</b> ou <b>« Ajouter à l\'écran d\'accueil »</b>';
    }
    var o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(16,19,28,0.55);';
    o.innerHTML =
      '<div style="background:#fff;border-radius:22px;max-width:380px;width:100%;padding:26px 26px 22px;box-shadow:0 24px 60px rgba(16,19,28,.3);font-family:var(--font,system-ui)">' +
        '<img src="icons/icon-192.png" alt="" style="width:56px;height:56px;border-radius:14px;box-shadow:0 4px 12px rgba(0,80,230,.3)" />' +
        '<div style="font-size:18px;font-weight:800;letter-spacing:-.02em;margin:14px 0 6px;color:#10131C">Installer JARVIS</div>' +
        '<div style="font-size:13.5px;line-height:1.6;color:#46506A;margin-bottom:18px">' + steps + '</div>' +
        '<button class="v2-btn" style="width:100%" onclick="var p=this.closest(\'div[style]\').parentNode;p&&p.remove&&p.remove()">Compris</button>' +
      '</div>';
    o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o);
  };

  // ── Panier flottant (produits retenus pour une fiche) ─────────
  V2.updateCartBar = function () {
    var n = (V2.ficheCart && V2.ficheCart.count) ? V2.ficheCart.count() : 0;
    var ex = document.getElementById('v2-cartbar');
    var onFiches = V2.route && V2.route.name === 'fiches';
    if (n <= 0 || onFiches) { if (ex) ex.classList.remove('show'); return; }
    if (!ex) { ex = document.createElement('div'); ex.id = 'v2-cartbar'; ex.className = 'v2-cartbar'; document.body.appendChild(ex); }
    ex.innerHTML =
      '<div class="v2-cartbar-in">' +
        '<span class="v2-cartbar-badge mono">' + n + '</span>' +
        '<span class="v2-cartbar-lbl">produit' + (n > 1 ? 's' : '') + ' retenu' + (n > 1 ? 's' : '') + ' pour ta fiche</span>' +
        '<button class="v2-btn v2-btn-primary v2-cartbar-go" onclick="V2.go(\'fiches\')">Voir la fiche ' + ICO('chev', 15) + '</button>' +
      '</div>';
    requestAnimationFrame(function () { ex.classList.add('show'); });
  };

  // ── Barres flottantes « app » : installation (PWA) + mise à jour dispo ──
  function ensureAppbarCss() {
    if (document.getElementById('v2-appbar-css')) return;
    var s = document.createElement('style'); s.id = 'v2-appbar-css';
    s.textContent = [
      '.v2-appbar{position:fixed;left:50%;bottom:20px;transform:translate(-50%,150%);z-index:9500;width:max-content;max-width:min(560px,calc(100vw - 32px));opacity:0;transition:transform .34s cubic-bezier(.2,.8,.2,1),opacity .34s}',
      '.v2-appbar.show{transform:translate(-50%,0);opacity:1}',
      '.v2-appbar-update{bottom:20px;z-index:9600}',
      // Chiffres manquants : liseré ambre — c'est un avertissement, pas une panne.
      '.v2-appbar-data{z-index:9700}',
      '.v2-appbar-data .v2-appbar-in{border-color:var(--c-amber,#D98324)}',
      // 44 px minimum : mesuré à 43 px au premier essai, sous la cible tactile.
      '.v2-appbar-data .v2-appbar-go{min-height:44px}',
      '.v2-appbar-in{display:flex;align-items:center;gap:12px;padding:11px 12px 11px 15px;background:var(--card,#fff);border:1px solid var(--line,#E4E8F0);border-radius:16px;box-shadow:0 14px 40px rgba(16,19,28,.22)}',
      '.v2-appbar-ic{flex:none;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--ip-blue,#0050E6) 12%,var(--card,#fff));color:var(--ip-blue,#0050E6)}',
      '.v2-appbar-update .v2-appbar-ic{background:color-mix(in srgb,var(--c-opp,#12A150) 15%,#fff);color:var(--c-opp,#0f7a52)}',
      '.v2-appbar-lbl{flex:1;min-width:0;font-size:13px;font-weight:500;color:var(--ip-ink,#10131C);line-height:1.35}',
      '.v2-appbar-go{flex:none;white-space:nowrap}',
      '.v2-appbar-x{flex:none;border:none;background:none;cursor:pointer;color:var(--muted,#737A8C);width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center}',
      '.v2-appbar-x:hover{background:var(--card-2,#F2F5FA);color:var(--ip-ink,#10131C)}'
    ].join('');
    document.head.appendChild(s);
  }
  var SVG_REFRESH = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>';
  var SVG_X = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  // Proposée uniquement sur l'accueil, si installable et pas déjà installée/refusée.
  V2.installBanner = function () {
    ensureAppbarCss();
    var ex = document.getElementById('v2-installbar');
    var installed = false;
    try { installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) {}
    var dismissed = false; try { dismissed = localStorage.getItem('v2-install-dismissed') === '1'; } catch (e) {}
    var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    var canPrompt = !!window.__deferredInstall || isIOS;
    var onHome = V2.route && V2.route.name === 'home';
    var upd = document.getElementById('v2-updatebar');
    var updShowing = !!(upd && upd.classList.contains('show'));
    if (installed || dismissed || !canPrompt || !onHome || updShowing) { if (ex) ex.classList.remove('show'); return; }
    if (!ex) { ex = document.createElement('div'); ex.id = 'v2-installbar'; ex.className = 'v2-appbar v2-appbar-install'; document.body.appendChild(ex); }
    ex.innerHTML =
      '<div class="v2-appbar-in">' +
        '<span class="v2-appbar-ic">' + ICO('plus', 17, 2.2) + '</span>' +
        '<span class="v2-appbar-lbl">Installe JARVIS sur ton écran d\'accueil — comme une appli, accès direct</span>' +
        '<button class="v2-btn v2-btn-primary v2-appbar-go" onclick="V2.installApp()">Installer</button>' +
        '<button class="v2-appbar-x" title="Plus tard" aria-label="Plus tard" onclick="V2.dismissInstall()">' + SVG_X + '</button>' +
      '</div>';
    requestAnimationFrame(function () { ex.classList.add('show'); });
  };
  V2.dismissInstall = function () {
    try { localStorage.setItem('v2-install-dismissed', '1'); } catch (e) {}
    var ex = document.getElementById('v2-installbar'); if (ex) ex.classList.remove('show');
  };

  // Affichée quand un nouveau service worker a pris la main (nouvelle version déployée).
  V2.showUpdateBanner = function () {
    ensureAppbarCss();
    window.__swUpdateReady = false;
    var ib = document.getElementById('v2-installbar'); if (ib) ib.classList.remove('show'); // la MAJ prime
    var ex = document.getElementById('v2-updatebar');
    if (!ex) { ex = document.createElement('div'); ex.id = 'v2-updatebar'; ex.className = 'v2-appbar v2-appbar-update'; document.body.appendChild(ex); }
    ex.innerHTML =
      '<div class="v2-appbar-in">' +
        '<span class="v2-appbar-ic">' + SVG_REFRESH + '</span>' +
        '<span class="v2-appbar-lbl">Une nouvelle version de JARVIS est disponible</span>' +
        '<button class="v2-btn v2-btn-primary v2-appbar-go" onclick="location.reload()">Actualiser</button>' +
      '</div>';
    requestAnimationFrame(function () { ex.classList.add('show'); });
  };

  // Accent de PILIER courant : chaque écran a SA lumière (halo de tête + liserés).
  // Mappe la route vers le token var(--pil-*) correspondant ; défaut = bleu marque.
  var ROUTE_ACCENT = {
    home: 'var(--accent)', pharma: 'var(--pil-opp)', fiches: 'var(--pil-fiche)',
    catalogue: 'var(--pil-cat)', pilotage: 'var(--pil-pilo)', offilog: 'var(--pil-froid)',
    groupements: 'var(--pil-fiche)', molecules: '#7C3AED', presentation: 'var(--c-opp)',
    infos: 'var(--c-amber)', marketing: 'var(--c-rose)', audit: '#10915E', sagitta: 'var(--pil-froid)',
    produits: 'var(--ip-blue)',
    // 29/09/2026 — écrans OPSO « Pharmacies » et « Meilleurs achats » (opso-pharmacies.js)
    opsopharmacies: 'var(--pil-opp)', opsoachats: 'var(--pil-cat)', opsobord: 'var(--pil-pilo)'
  };
  function accentFor(name) {
    if (name === 'marketing') return (window.V2_BRAND && window.V2_BRAND.opso) ? 'var(--pil-fiche)' : 'var(--pil-rose)';
    return ROUTE_ACCENT[name] || 'var(--accent)';
  }

  // Les données réseau n'ont pas pu être téléchargées. On le DIT, avec un
  // bouton — au lieu de retenter sans fin en silence. Un écran qui explique
  // vaut mieux qu'une app qui tourne en rond.
  function ecranDonneesIndisponibles(root) {
    root.innerHTML =
      '<div class="v2-wrap"><div class="v2-empty">' +
        '<div class="v2-empty-t">Données non chargées</div>' +
        '<div class="v2-empty-d">Les données du réseau n’ont pas pu être téléchargées ' +
        '(17 Mo). Vérifie ta connexion — le Wi-Fi si tu peux — puis réessaie.</div>' +
        '<button class="v2-btn v2-btn-primary" style="min-height:48px" ' +
          'onclick="V2.render()">Réessayer</button>' +
      '</div></div>';
  }

  // Ce que le boot attendait AVANT la phase 2, pour tout écran : c'est le jeu
  // reçu par tout écran qui ne déclare pas `needs`. (wmlca est déjà attaché à wml.)
  // 28/09/2026 — `pharmafrseg` (segmentation Client A/B/C, 32 Ko) et `mktipprix`
  // (154 prix nets des offres marketing, 3,6 Ko) ont quitté le dépôt public : ils
  // rejoignent le jeu attendu par tout écran, comme le CA (`pharmafrca`). Sans la
  // segmentation, la base nationale ne dit plus qui est client — les filtres de La
  // carte et la cible des campagnes rendraient vide.
  V2.NEEDS_DEFAUT = ['bench', 'sagitta', 'prodstatscond', 'pharmafrca', 'pharmafrseg', 'pharmafrcomm', 'mktipprix', 'wmlca', 'biosimcomplet'];
  // 30/09/2026 — Will : « Emmanuel doit voir uniquement ce qui concerne OPSO ». L'espace OPSO
  // ne demande que ce que ses écrans lisent (carte-opso-donnees.md) ; le reste lui est refusé
  // côté Supabase (jarvis_peut_lire_protege) : le demander afficherait « chiffres non téléchargés ».
  if (window.V2_BRAND && window.V2_BRAND.opso) V2.NEEDS_DEFAUT = ['bench', 'sagitta', 'wmlca'];
  // ── RENDER (routeur) ──────────────────────────
  V2.render = function () {
    var root = $app(); if (!root) return;
    // Pas connecté = on ne rend RIEN. V2.boot() a déjà affiché l'écran de connexion et
    // s'est arrêté là, sans jamais brancher l'écouteur `hashchange`. Or plusieurs modules
    // (profil, données réseau) rappellent V2.render() en différé : sans cette garde, ils
    // écrasaient l'écran de connexion par l'accueil. L'utilisateur voyait une app d'apparence
    // normale dont AUCUN onglet ne répondait — le clic changeait le #hash, et personne
    // n'écoutait. Même garde que V2.openCmdk plus bas.
    if (!V2.user) return;
    if (V2.route.name !== 'home' && V2.pages.home && V2.pages.home.quitter) V2.pages.home.quitter();
    injectShellStyles();
    // Les données réseau (27 Mo) ne sont plus chargées au boot : on les charge ici,
    // UNE fois, au premier rendu, derrière un écran de lancement — l'app apparaît
    // instantanément au lieu d'un écran blanc figé. loadData() (dans le .then) mappe
    // ensuite V2.pharmacies/V2.sales, donc AUCUNE page ne s'affiche sans ses données.
    if (V2.loadFiles && !V2.dataLoaded('wml') && !V2._wmlAsked) {
      V2._wmlAsked = true;
      root.innerHTML =
        '<div class="v2-boot-splash"><div class="v2-boot-brand">' + ((window.V2_BRAND && window.V2_BRAND.name) || 'Intégral Pharma') + '</div>'
        + '<div class="v2-spinner"></div>'
        + '<div class="v2-boot-msg">Chargement des données réseau…</div></div>';
      V2.loadFiles(['wml'])
        .then(function () { return V2.loadData ? V2.loadData() : null; })
        .then(function () {
          V2._wmlAsked = false;
          // ⚠️ 13/08/2026 — la boucle infinie de l'iPhone de Will.
          // V2.loadFiles RÉSOUT sa promesse même quand le téléchargement
          // échoue, sans marquer le fichier comme chargé. Sans le contrôle
          // ci-dessous, on repartait aussitôt pour un tour ; et comme la
          // tentative ratée restait mémorisée « déjà terminée », le tour
          // suivant était instantané. Résultat : un rendu qui se rappelle
          // lui-même sans fin, et « RangeError: Maximum call stack size
          // exceeded » en bandeau rouge. Une connexion imparfaite suffisait —
          // et l'app installée y était plus exposée, son service worker ayant
          // vidé les caches au changement de version.
          // ⚠️ 14/08/2026 — `V2.donneesSecours` compte autant que `dataLoaded`.
          // Le fichier pouvait être marqué « chargé » alors qu'il était vide :
          // `loadData()` retombait sur les anciennes tables Supabase et l'app
          // affichait 22 officines au lieu de 690, sans rien dire.
          V2.ventesEnCours = false;
          if (!V2.dataLoaded('wml') || V2.donneesSecours) { ecranDonneesIndisponibles(root); return; }
          V2.render();
        });
      return;
    }
    if (V2.loadFiles && !V2.dataLoaded('wml')) {   // chargement en cours
      // 11/09/2026 (phase 5) — l'accueil n'attend plus les ventes : dès que
      // l'en-tête (officines) est là, il se dessine avec ses tuiles, et le
      // chiffre du Pilotage arrive quand les tranches sont finies (le .then
      // ci-dessus re-rend). SEUL l'accueil se rend ainsi ; tout autre écran
      // lit les ventes et attend la fin : on lui montre l'écran d'attente —
      // sans quoi un clic depuis l'accueil partiel ne montrerait rien.
      // Pas pour OPSO (son accueil met le CA groupement en tête).
      var partiel = V2.route.name === 'home' && window.WML_OFFICINES && !V2.donneesSecours
        && !(window.V2_BRAND && window.V2_BRAND.opso);
      if (!partiel) {
        if (!root.querySelector('.v2-boot-splash')) {
          root.innerHTML =
            '<div class="v2-boot-splash"><div class="v2-boot-brand">' + ((window.V2_BRAND && window.V2_BRAND.name) || 'Intégral Pharma') + '</div>'
            + '<div class="v2-spinner"></div>'
            + '<div class="v2-boot-msg">Chargement des données réseau…</div></div>';
        }
        return;
      }
      V2.ventesEnCours = true;
      if (!V2.pharmacies || !V2.pharmacies.length) V2.pharmacies = V2.mapOfficines ? V2.mapOfficines() : [];
    }
    // 11/09/2026 — perf : les modules différés (index.html : V2_MODULES) ne sont
    // peut-être pas tous exécutés : V2.pages serait incomplet (tuiles de l'accueil,
    // ⌘K, lien profond #rdv → accueil). On attend la fin du manifeste, puis on rend.
    if (V2._modulesEnCours) {
      if (!V2._modulesAttente) {
        V2._modulesAttente = true;
        root.innerHTML = '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>';
        V2.modulesPrets.then(function () { V2._modulesAttente = false; V2.render(); });
      }
      return;
    }
    var page = V2.pages[V2.route.name];
    if (!page) { V2.route.name = 'home'; page = V2.pages.home; }
    if (!page) { root.innerHTML = '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>'; return; }
    // 11/09/2026 (phase 2) — les données lourdes (catalogue, tables protégées)
    // ne sont plus attendues au boot. Un écran qui ne déclare rien reçoit le jeu
    // COMPLET d'avant (V2.NEEDS_DEFAUT) : aucun écran ne peut se rendre avec
    // moins de données qu'hier. Seuls les écrans audités déclarent `needs: []`.
    // Un fichier en échec (protegeEchec) ne bloque pas : l'écran se rend comme
    // avant, avec ses propres garde-fous et le bandeau « données manquantes ».
    var needs = (page.needs === undefined) ? V2.NEEDS_DEFAUT : page.needs, manque = [];
    for (var ni = 0; ni < needs.length; ni++) {
      if (!V2.dataLoaded(needs[ni]) && !(V2.protegeEchec && V2.protegeEchec[needs[ni]])) manque.push(needs[ni]);
    }
    if (manque.length) {
      if (!V2._needsAttente) {
        V2._needsAttente = true;
        root.innerHTML = '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du catalogue…</div></div>';
        // On re-rend l'écran COURANT à l'arrivée (V2.route peut avoir changé
        // entre-temps : V2.render le relit, et redemandera ce qui manque).
        V2.loadFiles(manque).then(function () { V2._needsAttente = false; V2.render(); });
      }
      return;
    }
    // Pose la lumière du pilier courant à la racine : le halo de tête (.v2-halo,
    // frère de .v2) et tous les liserés contextuels de l'écran lisent var(--accent).
    try {
      document.documentElement.style.setProperty('--accent', V2.route.name === 'home' ? 'var(--info)' : accentFor(V2.route.name));
    } catch (e) {}
    try {
      page.render(root, V2.route.param);
    } catch (e) {
      console.error('[V2 render ' + V2.route.name + ']', e);
      root.innerHTML = topbar({ back: true }) + '<div class="v2-wrap"><div class="v2-empty"><div class="v2-empty-t">Une erreur est survenue</div><div class="v2-empty-d">' + (e && e.message ? e.message : '') + '</div><button class="v2-btn v2-btn-primary" onclick="V2.go(\'home\')">Retour à l\'accueil</button></div></div>';
    }
    if (V2.updateCartBar) V2.updateCartBar();
    if (V2.bandeauDonneesManquantes) V2.bandeauDonneesManquantes();
    if (V2.installBanner) V2.installBanner();
    // Le bouton « noter un rendez-vous » vit sur TOUS les écrans : on le
    // repose après chaque rendu, car il doit s'effacer quand une barre
    // flottante occupe déjà le bas, et sur les écrans où il ferait doublon.
    if (V2.rdvGeste) V2.rdvGeste.poser();
    if (window.__swUpdateReady && V2.showUpdateBanner) V2.showUpdateBanner();
  };

  // ════════════════════════════════════════════
  // PAGE HOME (accueil réel B-signature)
  // ════════════════════════════════════════════
  // ── Envoi du kit prospect (lien public + email pré-rempli) ──
  V2.prospectLink = function () {
    var u = V2.user || {};
    var base = location.origin + location.pathname.replace(/[^/]*$/, 'decouvrir.html');
    var p = [];
    if (u.name) p.push('rep=' + encodeURIComponent(u.name));
    if (u.email) p.push('mail=' + encodeURIComponent(u.email));
    return base + (p.length ? ('?' + p.join('&')) : '');
  };
  // message du kit prospect (réutilisé mailto / WhatsApp / SMS)
  V2.prospectMsg = function () {
    var u = V2.user || {}, link = V2.prospectLink();
    return 'Bonjour,\n\nSuite à notre échange, voici une courte présentation d\'Intégral Pharma : qui nous sommes, ce que vous gagnez à travailler avec nous, comment ouvrir un compte, et nos meilleures ventes par catégorie.\n\n' +
      link + '\n\nJe reste à votre disposition pour établir une proposition adaptée à votre officine.\n\nBien à vous,\n' +
      (u.name || '') + (u.email ? '\n' + u.email : '') + '\nIntégral Pharma';
  };
  V2.prospectEmail = function () {
    var inp = document.getElementById('prospect-mail');
    var to = (inp && inp.value || '').trim();
    // garde-fou : pas d'email → focus + message, pas de mailto fantôme
    if (!to) { if (inp) { inp.focus(); } V2.toast('Saisis l\'email de la pharmacie', 'warn'); return; }
    var subj = 'Intégral Pharma — faire connaissance';
    window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(V2.prospectMsg());
    V2.toast('Email préparé');
  };
  V2.prospectCopy = function () {
    var link = V2.prospectLink();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function () { V2.toast('Lien copié'); }, function () { window.prompt('Copie ce lien :', link); });
    } else { window.prompt('Copie ce lien :', link); }
  };
  V2.prospectOpen = function () { window.open(V2.prospectLink(), '_blank'); };
  // canaux terrain : WhatsApp / SMS — simples liens (app externe), zéro requête réseau
  V2.prospectWhatsApp = function () { window.open('https://wa.me/?text=' + encodeURIComponent(V2.prospectMsg()), '_blank'); };
  V2.prospectSMS = function () { window.location.href = 'sms:?&body=' + encodeURIComponent(V2.prospectMsg()); };
  // simulateur de gain : traduit le 6–9 % en euros/mois (estimation, RM/print-safe)
  V2.presSim = function () {
    var inp = document.getElementById('pres-sim-in');
    var v = inp ? parseFloat((inp.value || '').toString().replace(/[^\d.,]/g, '').replace(',', '.')) : 0;
    if (!isFinite(v) || v < 0) v = 0;
    var lo = document.getElementById('pres-sim-lo'), hi = document.getElementById('pres-sim-hi');
    if (lo) lo.textContent = V2.fmtNum(Math.round(v * 0.06));
    if (hi) hi.textContent = V2.fmtNum(Math.round(v * 0.09));
  };
  // Scroll vers la section « Ouvrir un compte » — PAS d'ancre #hash (collision avec le routeur hash de l'app)
  V2.presScrollOpen = function () { var e = document.getElementById('pres-open'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // ════════════════════════════════════════════
  // PAGE PRÉSENTATION — pitch prospect au comptoir
  // ════════════════════════════════════════════
  function injectPresStyles() {
    if (document.getElementById('v2-pres-style')) return;
    var st = document.createElement('style'); st.id = 'v2-pres-style';
    st.textContent = [
      // ── Hero : bleu profond, halos doux, titre plein blanc (jamais clip-text — Safari)
      '.pres-hero{position:relative;text-align:center;padding:46px 28px 36px;border-radius:var(--r-card);overflow:hidden;color:#fff;background:radial-gradient(120% 90% at 85% -10%,rgba(255,255,255,.16),transparent 55%),radial-gradient(80% 70% at 8% 110%,rgba(122,168,255,.20),transparent 62%),linear-gradient(160deg,#0050E6,#0034A0);box-shadow:0 1px 0 rgba(255,255,255,.22) inset,0 18px 44px rgba(0,52,160,.28)}',
      '.pres-logo{width:64px;height:64px;border-radius:18px;margin:0 auto 16px;background:rgba(255,255,255,.94);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 0 rgba(255,255,255,.4) inset,0 8px 20px rgba(0,30,90,.22)}',
      '.pres-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;text-transform:uppercase;letter-spacing:.16em;font-weight:800;color:rgba(255,255,255,.88);background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:var(--r-pill);padding:6px 13px;margin-bottom:14px}',
      '.pres-h1{font-size:30px;font-weight:900;letter-spacing:-.03em;line-height:1.05;color:#fff;margin:0}',
      // CTA hero « Ouvrir un compte » : pastille blanche qui claque sur le bleu
      '.pres-hero-cta{margin-top:22px}',
      '.pres-hero-btn{display:inline-flex;align-items:center;gap:9px;background:#fff;color:var(--ip-blue);font-weight:800;font-size:14.5px;padding:12px 22px;border-radius:var(--r-pill);text-decoration:none;box-shadow:0 10px 24px rgba(0,20,80,.28);transition:transform .22s var(--mo-ease-soft),box-shadow .22s var(--mo-ease-soft)}',
      '.pres-hero-btn svg{color:var(--ip-blue)}',
      '@media(hover:hover){.pres-hero-btn:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(0,20,80,.34)}}',
      '.pres-lead{font-size:18px;font-weight:700;margin-top:12px;letter-spacing:-.01em}',
      '.pres-tag{font-size:13.5px;font-weight:500;color:rgba(255,255,255,.84);margin-top:10px;max-width:560px;margin-left:auto;margin-right:auto;line-height:1.55}',
      // KPI hero : cartes verre, la carte "mid" claque en blanc plein
      '.pres-kpis{display:flex;justify-content:center;align-items:stretch;gap:12px;margin-top:28px;flex-wrap:wrap}',
      '.pres-kpi{flex:1 1 150px;max-width:215px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:16px 18px;box-shadow:0 1px 0 rgba(255,255,255,.12) inset}',
      '.pres-kpi.mid{background:rgba(255,255,255,.96);border-color:rgba(255,255,255,.9);box-shadow:0 12px 28px rgba(0,20,80,.28)}',
      '.pres-kpi.mid .pres-kpi-v{color:var(--ip-blue);font-size:29px}',
      '.pres-kpi.mid .pres-kpi-l{color:var(--ip-ink-2)}',
      '.pres-kpi-v{font-family:var(--mono);font-size:23px;font-weight:700;letter-spacing:-.02em;line-height:1.15}',
      '.pres-kpi-l{font-size:12px;opacity:.88;font-weight:600;margin-top:4px;line-height:1.35}',
      '.pres-reassure{display:flex;justify-content:center;flex-wrap:wrap;gap:10px 12px;margin:18px 0 6px}',
      '.pres-reassure-i{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-pill);padding:10px 16px;font-size:13.5px;font-weight:700;color:var(--ip-ink);box-shadow:var(--sh-1)}',
      '.pres-reassure-i svg{color:var(--c-mint);flex-shrink:0}',
      // ── Titres de section : point bleu + filet, comme le reste de l'app
      '.pres-sec-t{font-size:12px;text-transform:uppercase;letter-spacing:.09em;font-weight:800;color:var(--muted);margin:34px 2px 14px;display:flex;align-items:center;gap:10px}',
      '.pres-sec-t::before{content:"";width:7px;height:7px;border-radius:2px;background:var(--ip-blue);flex-shrink:0}',
      '.pres-sec-t::after{content:"";flex:1;height:1px;background:var(--line)}',
      // ── Cartes : même langage que le Launcher (gradient card→card-2, spotlight --mx/--my)
      '.pres-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}',
      '@media(max-width:720px){.pres-grid{grid-template-columns:1fr}}',
      '.pres-card{position:relative;background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);padding:22px 24px;overflow:hidden}',
      '.pres-grid .pres-card{transition:transform .28s var(--mo-ease-soft),box-shadow .28s var(--mo-ease-soft),border-color .28s var(--mo-ease-soft)}',
      '.pres-grid .pres-card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s var(--mo-ease-soft);background:radial-gradient(240px circle at var(--mx,50%) var(--my,0%),color-mix(in srgb,var(--accent,var(--ip-blue)) 13%,transparent),transparent 62%)}',
      '@media(hover:hover){.pres-grid .pres-card:hover{transform:translateY(-3px);box-shadow:var(--sh-2);border-color:color-mix(in srgb,var(--accent,var(--ip-blue)) 28%,var(--line))}.pres-grid .pres-card:hover::after{opacity:1}}',
      '.pres-card-ic{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;background:color-mix(in srgb,var(--accent,var(--ip-blue)) 11%,#fff);color:var(--accent,var(--ip-blue));border:1px solid color-mix(in srgb,var(--accent,var(--ip-blue)) 20%,transparent)}',
      '.pres-card-t{font-size:16px;font-weight:800;letter-spacing:-.01em;margin-bottom:6px}',
      '.pres-card-d{font-size:13.5px;color:var(--ip-ink-2);line-height:1.55}',
      // ── Preuve chiffrée : bannières bleues + barème en tuiles à liseré
      '.pres-proof{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:14px}',
      '.pres-proof-h{flex:1;min-width:220px;position:relative;overflow:hidden;background:radial-gradient(110% 100% at 88% -14%,rgba(255,255,255,.18),transparent 58%),linear-gradient(150deg,var(--ip-blue),var(--ip-blue-d));color:#fff;border-radius:var(--r-card);padding:22px 24px;box-shadow:0 14px 30px rgba(0,52,160,.22)}',
      '.pres-proof-v{font-family:var(--mono);font-size:29px;font-weight:700;letter-spacing:-.02em;line-height:1.1}',
      '.pres-proof-l{font-size:13px;font-weight:600;opacity:.9;margin-top:6px;line-height:1.4}',
      // 6–9 % = bannière dominante (cœur du pitch), 27 % = secondaire liseré mint
      '.pres-proof-h.lead{flex:1.5 1 260px}',
      '.pres-proof-h.lead .pres-proof-v{font-size:34px}',
      '.pres-proof-h.alt{box-shadow:0 10px 24px rgba(0,52,160,.16)}',
      '.pres-proof-h.alt::after{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c-mint)}',
      '.pres-tiers{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}',
      '.pres-tier{flex:1;min-width:150px;position:relative;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:15px 17px 14px 19px;box-shadow:var(--sh-1)}',
      '.pres-tier::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,var(--ip-blue),color-mix(in srgb,var(--ip-blue) 25%,transparent))}',
      '.pres-tier-r{display:inline-block;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ip-blue);background:var(--halo);border-radius:6px;padding:3px 8px}',
      '.pres-tier-v{font-family:var(--mono);font-size:19px;font-weight:700;margin-top:9px;letter-spacing:-.02em}',
      '.pres-tier-l{font-size:12px;color:var(--muted);margin-top:3px}',
      // Cible tactile : ligne CTA isolée (mène à « Ouvrir un compte ») — padding vertical
      // ajouté sans changer la couleur ni la taille du texte, juste la zone cliquable.
      '.pres-cta-line{display:inline-flex;align-items:center;gap:6px;margin-top:16px;padding:13px 0;font-size:14px;font-weight:700;color:var(--ip-blue);text-decoration:none;cursor:pointer}',
      '.pres-cta-line:hover{text-decoration:underline}',
      '.pres-cta-line:focus-visible{outline:2px solid var(--ip-blue);outline-offset:3px;border-radius:4px}',
      // ── Étapes : timeline verticale (pastilles reliées par un filet)
      '.pres-steps{position:relative}',
      '.pres-steps::before{content:"";position:absolute;left:15px;top:24px;bottom:24px;width:2px;background:var(--line)}',
      '.pres-step{position:relative;display:flex;gap:16px;align-items:flex-start;padding:15px 0}',
      '.pres-step-n{position:relative;width:32px;height:32px;border-radius:50%;background:var(--halo);color:var(--ip-blue);font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--mono);border:1px solid color-mix(in srgb,var(--ip-blue) 22%,transparent);box-shadow:0 0 0 4px var(--card)}',
      '.pres-step-ok{position:relative;width:32px;height:32px;border-radius:50%;background:color-mix(in srgb,var(--c-mint) 13%,#fff);color:var(--c-mint);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid color-mix(in srgb,var(--c-mint) 30%,transparent);box-shadow:0 0 0 4px var(--card)}',
      '.pres-step-t{font-weight:700;font-size:14.5px}',
      '.pres-step-d{font-size:13px;color:var(--muted);margin-top:2px}',
      '.pres-step-cta{position:relative;margin:0 0 8px 48px}',
      '.pres-dl{margin-top:2px}',
      // ── Contact : carte encre avec halo bleu discret
      '.pres-contact{position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;background:radial-gradient(100% 140% at 92% -30%,rgba(0,80,230,.38),transparent 58%),var(--ip-ink);color:#fff;border-radius:var(--r-card);padding:22px 26px;flex-wrap:wrap;box-shadow:0 16px 36px rgba(16,19,28,.16)}',
      '.pres-contact-n{font-size:17px;font-weight:800}',
      '.pres-contact-r{font-size:13px;opacity:.85;margin-top:2px}',
      '.pres-contact-c{margin-left:auto;text-align:right;font-family:var(--mono);font-size:13.5px;line-height:1.7}',
      '.pres-contact-c a{color:#fff;text-decoration:none}',
      '.pres-contact-act{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
      '.pres-contact .v2-btn-ghost{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.28);color:#fff}',
      '.pres-contact .v2-btn-ghost:hover{background:rgba(255,255,255,.2)}',
      // ── Envoi du kit
      '.pres-send{margin-top:18px;background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 5%,#fff),color-mix(in srgb,var(--ip-blue) 2%,#fff));border:1px solid color-mix(in srgb,var(--ip-blue) 18%,var(--line));border-radius:var(--r-card);padding:20px 22px}',
      '.pres-send-t{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:-.01em}',
      '.pres-send-t svg{color:var(--ip-blue)}',
      '.pres-send-d{font-size:13px;color:var(--ip-ink-2);margin:6px 0 12px;line-height:1.5}',
      '.pres-send-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.pres-send-in{flex:1;min-width:200px;border:1px solid var(--line);border-radius:var(--r-control);padding:11px 13px;font-family:var(--font);font-size:14px;background:#fff;transition:border-color .18s,box-shadow .18s}',
      '.pres-send-in{color:var(--ip-ink)}',
      '.pres-send-in:focus{outline:none;border-color:color-mix(in srgb,var(--ip-blue) 45%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--ip-blue) 13%,transparent)}',
      // ── Chips catégories (top ventes) : réemploi du langage tuile-mono
      '.pres-cats{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}',
      '.pres-cat{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ip-blue);background:var(--halo);border:1px solid color-mix(in srgb,var(--ip-blue) 16%,transparent);border-radius:var(--r-pill);padding:6px 12px}',
      // ── Simulateur de gain : encart bleu léger, chiffre-résultat en gros mono
      '.pres-sim{border-color:color-mix(in srgb,var(--ip-blue) 20%,var(--line))}',
      '.pres-sim-lbl{display:block;font-size:13px;font-weight:600;color:var(--ip-ink-2);margin-bottom:10px}',
      '.pres-sim-inwrap{display:inline-flex;align-items:center;gap:8px}',
      '.pres-sim-in{width:150px;border:1px solid var(--line);border-radius:var(--r-control);padding:11px 13px;font-family:var(--mono);font-size:16px;font-weight:700;background:#fff;color:var(--ip-ink)}',
      '.pres-sim-in:focus{outline:none;border-color:color-mix(in srgb,var(--ip-blue) 45%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--ip-blue) 13%,transparent)}',
      '.pres-sim-unit{font-size:13px;color:var(--muted);font-weight:600}',
      '.pres-sim-out{margin-top:16px;font-size:15px;font-weight:600;color:var(--ip-ink)}',
      '.pres-sim-out span{font-family:var(--mono);font-size:26px;font-weight:800;color:var(--ip-blue);letter-spacing:-.02em}',
      '.pres-sim-note{font-size:12px;color:var(--ip-ink-2);margin-top:10px;line-height:1.45}',
      // ── Contact : entête (identité + CTA) puis pied (mail + coordonnées) DANS la carte
      '.pres-contact{flex-direction:column;align-items:stretch;gap:0}',
      '.pres-contact-top{display:flex;align-items:center;gap:16px;flex-wrap:wrap}',
      '.pres-contact-foot{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.16);font-family:var(--mono);font-size:12.5px;line-height:1.6;color:rgba(255,255,255,.82)}',
      '.pres-contact-foot a{color:#fff;text-decoration:none}',
      // ── Zone « côté commercial » : neutre + pointillés pour la distinguer du pitch client
      '.pres-send{position:relative;background:var(--card-2);border:1px dashed color-mix(in srgb,var(--ip-blue) 32%,var(--line))}',
      '.pres-send-badge{display:inline-block;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:var(--r-pill);padding:3px 9px;margin-bottom:10px}',
      // Cibles tactiles confortables (≥44px) sur tous les CTA de la page
      '.pres-contact-act .v2-btn,.pres-step-cta .v2-btn,.pres-send-row .v2-btn,.pres-hero-btn{min-height:44px}',
      // ── Impression : rien de masqué, états finaux posés, .noprint identique
      '@media print{' +
        '.noprint{display:none!important}' +
        // états finaux posés (le motion ne laisse aucun bloc transparent au tirage)
        '.pres-hero *,.pres-eyebrow,.pres-h1,.pres-lead,.pres-tag,.pres-kpis,.pres-reassure-i,.pres-card,.pres-proof-h,.pres-tier,.pres-step,.pres-contact{opacity:1!important;transform:none!important;animation:none!important}' +
        // fonds colorés conservés → plus de texte blanc sur blanc (hero, bannières, contact, pastilles)
        '.pres-hero,.pres-proof-h,.pres-contact,.pres-kpi,.pres-kpi.mid,.pres-step-n,.pres-step-ok,.pres-tier::before,.pres-cat{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        // jamais de coupure au milieu du barème, des étapes, des cartes
        '.pres-card,.pres-grid .pres-card,.pres-proof,.pres-proof-h,.pres-tiers,.pres-tier,.pres-steps,.pres-step,.pres-contact{break-inside:avoid;page-break-inside:avoid}' +
        // titres de section collés à leur bloc + ombres supprimées (pas de gris sale)
        '.pres-sec-t{break-after:avoid;page-break-after:avoid}' +
        '.pres-hero,.pres-card,.pres-contact,.pres-proof-h{box-shadow:none!important}' +
        // texte secondaire lisible en photocopie N&B
        '.pres-card-d,.pres-tier-l,.pres-step-d,.pres-sim-note{color:#333!important}' +
      '}',
      '@media(max-width:480px){' +
        '.pres-hero{padding:36px 18px 28px}' +
        '.pres-h1{font-size:25px}.pres-lead{font-size:16px}.pres-tag{font-size:13px}' +
        '.pres-kpi{max-width:none}.pres-kpi-v{font-size:21px}.pres-kpi.mid .pres-kpi-v{font-size:25px}' +
        '.pres-reassure-i{font-size:13px;padding:8px 13px}' +
        '.pres-proof-v{font-size:24px}.pres-proof-h.lead .pres-proof-v{font-size:27px}' +
        '.pres-tier{min-width:100%;flex-basis:100%}' +
        '.pres-step-cta{margin-left:0}' +
        // 100% forçait l'unité « € / mois » à se compresser et passer sur 2 lignes
        // (mesuré sur le rendu, capture mobile) — flex:1 laisse l'unité sur une ligne.
        '.pres-sim-in{width:auto;flex:1;min-width:0}.pres-sim-inwrap{display:flex}.pres-sim-unit{white-space:nowrap;flex:none}' +
        '.pres-contact-act{margin-left:0;justify-content:stretch}.pres-contact-act .v2-btn{flex:1}' +
        '.pres-send-row{flex-direction:column}.pres-send-in{width:100%;font-size:16px}.pres-send-row .v2-btn{width:100%}' +
      '}',
      // ── Entrée du hero : écran uniquement (jamais en print) + RM-safe
      '@media screen and (prefers-reduced-motion:no-preference){' +
        '@keyframes presIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
        '@keyframes presLogoIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}' +
        '.pres-hero .pres-logo{opacity:0;animation:presLogoIn .5s ease-out forwards}' +
        '.pres-eyebrow,.pres-h1,.pres-lead,.pres-tag,.pres-kpis{opacity:0;animation:presIn .5s ease-out forwards}' +
        '.pres-eyebrow{animation-delay:.06s}.pres-h1{animation-delay:.14s}.pres-lead{animation-delay:.22s}.pres-tag{animation-delay:.28s}.pres-kpis{animation-delay:.36s}' +
      '}',
      '@media(prefers-reduced-motion:reduce){.pres-grid .pres-card{transition:none}.pres-grid .pres-card::after{display:none}}'
    ].join('');
    document.head.appendChild(st);
  }
  V2.pages.presentation = {
    render: function (root) {
      injectPresStyles();
      // charge le catalogue pour des chiffres réels (sinon valeurs de repli)
      if (!window.BENCHMARK && V2.loadFiles && !V2._presBenchTried) {
        V2._presBenchTried = true;   // une seule tentative → pas de boucle de rendu si le chargement échoue
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>';
        V2.loadFiles(['bench']).then(function () { if (V2.route && V2.route.name !== 'presentation') return; /* 11/09/2026 (phase 4) : l'écran a pu changer pendant l'attente */ V2.render(); });
        return;
      }
      var B = window.BENCHMARK || [];   // repli si le benchmark n'a pas chargé (valeurs de repli plus bas)
      var nf = function (n) { return V2.fmtNum(n); };
      var nbRefN = B.length || 10500;
      var nbRemb = 0, nbOffre = 0, nbFroid = 0, nbGx = 0, nbBio = 0;
      B.forEach(function (b) {
        if (b.has_ameli) nbRemb++;
        if (V2.bestPrice(b).offre) nbOffre++;   // même règle que partout (vs PPHT), pas de seuil dupliqué
        if (b.is_froid) nbFroid++;
        if (b.artnature === 'generique' || b.artnature === 'generique_partenaire') nbGx++;
        else if (b.artnature === 'biosimilaire') nbBio++;
      });
      var nbPara = (window.OFFILOG && window.OFFILOG.length) || (window.OFFILOG_BEST && window.OFFILOG_BEST.length) || 3520;
      var nbRef = nf(nbRefN);
      // Logo capsule "ip" inliné (zéro requête réseau, fiable à l'impression)
      var capsule = function (w, h, deco) {
        return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 48 28" ' + (deco ? 'aria-hidden="true" focusable="false"' : 'role="img" aria-label="Intégral Pharma"') + '>' +
          '<rect x="2" y="1.5" width="9" height="5.5" rx="2.75" fill="#0B1F4D"/>' +
          '<rect x="2" y="8.5" width="9" height="18" rx="4.5" fill="#0B1F4D"/>' +
          '<rect x="14" y="6.5" width="11" height="12" rx="5.5" fill="#C9A961"/>' +
          '<rect x="17" y="9.5" width="5" height="6" rx="2.5" fill="#FFFFFF"/>' +
          '<rect x="14" y="6.5" width="4" height="21" rx="2" fill="#C9A961"/></svg>';
      };
      var logoSvg = capsule(40, 24);
      var u = V2.user || {};
      // E-mail d'ouverture : TOUJOURS vers le service client (le commercial en copie).
      // (Avant, le fallback envoyait au commercial connecté → la demande n'arrivait pas chez Intégral.)
      var openMail = 'serviceclient@ouestpharmaservices.fr';
      var openCc = u.email ? '&cc=' + encodeURIComponent(u.email) : '';
      var openSubj = 'Ouverture de compte Intégral Pharma';
      var openBody = 'Bonjour,\n\nJe souhaite ouvrir un compte Intégral Pharma.\nJe joins à ce message : le formulaire d\'ouverture 2026 rempli et signé, mon RIB et mon Kbis (moins de 3 mois).\nMerci de me confirmer l\'ouverture de mon compte et mon code PharmaML.\n\nCordialement,';
      var openHref = 'mailto:' + openMail + '?subject=' + encodeURIComponent(openSubj) + openCc + '&body=' + encodeURIComponent(openBody);
      var ICODL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 18.5h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var ICOCHK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 6.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      // titre de section sémantique (h2) — restaure la hiérarchie pour lecteurs d'écran
      var sect = function (t) { return '<h2 class="pres-sec-t">' + t + '</h2>'; };
      var card = function (color, ico, t, d) {
        return '<div class="pres-card" style="--accent:' + color + '" onmousemove="V2.homeSpot(event,this)"><div class="pres-card-ic">' + ICO(ico, 22) + '</div>' +
          '<div class="pres-card-t">' + t + '</div><div class="pres-card-d">' + d + '</div></div>';
      };
      var step = function (n, t, d) {
        return '<div class="pres-step"><div class="pres-step-n">' + n + '</div><div><div class="pres-step-t">' + t + '</div><div class="pres-step-d">' + d + '</div></div></div>';
      };
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<main class="v2-wrap" aria-label="Présentation Intégral Pharma">' +
          (V2.docTabs ? V2.docTabs('presentation') : '') +
          '<div class="pres-hero">' +
            '<div class="pres-logo">' + logoSvg + '</div>' +
            '<div class="pres-eyebrow">Grossiste-répartiteur · +20 ans</div>' +
            '<h1 class="pres-h1">Intégral Pharma</h1>' +
            '<div class="pres-lead">Plus de marge sur chaque boîte. Sans franco, sans engagement.</div>' +
            '<div class="pres-tag">Un grossiste-répartiteur français indépendant, +20 ans. Vous commandez comme d\'habitude, vous gagnez plus sur chaque boîte.</div>' +
            '<div class="pres-kpis">' +
              '<div class="pres-kpi mid"><div class="pres-kpi-v">6–9 %</div><div class="pres-kpi-l">de marge, nets sur facture</div></div>' +
              '<div class="pres-kpi"><div class="pres-kpi-v">0 €</div><div class="pres-kpi-l">franco à 0 € : commandez même 1 boîte</div></div>' +
              '<div class="pres-kpi"><div class="pres-kpi-v">+14 000</div><div class="pres-kpi-l">réfs parapharma, sans adhésion</div></div>' +
            '</div>' +
            '<div class="pres-hero-cta noprint"><a class="pres-hero-btn" href="javascript:void(0)" onclick="V2.presScrollOpen();return false">' + ICODL + 'Ouvrir un compte</a></div>' +
          '</div>' +

          '<div class="pres-reassure">' +
            '<div class="pres-reassure-i">' + ICOCHK + nf(nbRefN) + ' médicaments</div>' +
            '<div class="pres-reassure-i">' + ICOCHK + 'Grossiste français · +20 ans</div>' +
            '<div class="pres-reassure-i">' + ICOCHK + 'Livraison jusqu\'à 1×/jour selon secteur</div>' +
          '</div>' +

          sect('Ce que vous gagnez') +
          '<div class="pres-grid">' +
            card('var(--c-mint)', 'euro', 'Plus de marge, sur tout le catalogue', 'Plus de marge sur l\'intégralité du catalogue, des prix nets sur facture et une optimisation dès la première boîte. La transparence des conditions, pas les paliers cachés.') +
            card('var(--ip-blue)', 'cat', 'Une centrale parapharmacie unique', 'Via Offilog : une très large collection de parapharmacie, +14 000 produits, +430 laboratoires, sans coût d\'adhésion et au meilleur prix à l\'unité, sans paliers.') +
            card('var(--ip-blue)', 'pilo', 'Un accompagnement chiffré & de proximité', 'Votre commercial vient avec VOS chiffres : meilleures ventes du marché, opportunités de marge, commande déjà préparée. Service réactif et transparent.') +
            card('var(--ip-blue)', 'check', 'Vous gardez votre grossiste principal', 'Intégral vient en complément, sans quota ni volume minimum. Vous testez à votre rythme, boîte par boîte — et vous ne payez la marge que sur ce que vous commandez. L\'objectif se fixe ensemble, jamais une contrainte.') +
          '</div>' +

          sect('Vos conditions — la preuve chiffrée') +
          '<div class="pres-proof">' +
            '<div class="pres-proof-h lead"><div class="pres-proof-v">6–9 %</div><div class="pres-proof-l">d\'abandon de marge constaté, net sur facture (PFHT)</div></div>' +
            '<div class="pres-proof-h alt"><div class="pres-proof-v" data-count>jusqu\'à 27 %</div><div class="pres-proof-l">remise génériqueur, dès la 1ère boîte</div></div>' +
          '</div>' +
          '<div class="pres-card">' +
            '<div class="pres-card-d" style="font-size:13px;color:var(--ip-ink-2)">Barème par tranche, en prix nets sur facture :</div>' +
            '<div class="pres-tiers">' +
              '<div class="pres-tier"><div class="pres-tier-r">&lt; 4,33 €</div><div class="pres-tier-v">4,5 – 30 %</div><div class="pres-tier-l">petits prix</div></div>' +
              '<div class="pres-tier"><div class="pres-tier-r">4,33 – 468 €</div><div class="pres-tier-v" data-count>3,89 %</div><div class="pres-tier-l">intermédiaires</div></div>' +
              '<div class="pres-tier"><div class="pres-tier-r">&gt; 468 €</div><div class="pres-tier-v" data-count>19,50 €</div><div class="pres-tier-l">forfait fixe</div></div>' +
            '</div>' +
            '<div class="pres-card-d" style="font-size:12.5px;color:var(--ip-ink-2);margin-top:12px">Génériques : jusqu\'à 27 % de remise génériqueur dès la 1ère boîte — <b>pas d\'abandon de marge additionnel</b> (l\'abandon 6–9 % concerne le princeps). Livraison jusqu\'à 1×/jour selon secteur. Ni franco ni engagement imposé — l\'objectif se fixe ensemble.</div>' +
            '<div class="pres-card-d" style="font-size:12.5px;color:var(--ip-ink-2);margin-top:6px">Catalogue : ' + nf(nbRefN) + ' médicaments + 14 000 réfs parapharma · ' + nf(nbOffre) + ' références en offre en ce moment — programmes L\'Intégral, ITP, UPSA, Sanofi.</div>' +
            '<a href="javascript:void(0)" onclick="V2.presScrollOpen();return false" class="pres-cta-line" style="margin-top:16px">' + ICODL + 'Ces conditions vous intéressent ? Ouvrez un compte</a>' +
          '</div>' +

          sect('Combien ça vous rapporte') +
          '<div class="pres-card pres-sim">' +
            '<label for="pres-sim-in" class="pres-sim-lbl">Vos achats mensuels chez votre grossiste (hors génériques déjà remisés)</label>' +
            '<div class="pres-sim-inwrap noprint"><input id="pres-sim-in" type="number" inputmode="numeric" min="0" step="500" value="20000" class="pres-sim-in" oninput="V2.presSim()" aria-describedby="pres-sim-note" /><span class="pres-sim-unit">€ / mois</span></div>' +
            '<div class="pres-sim-out"><span id="pres-sim-lo">1 200</span> à <span id="pres-sim-hi">1 800</span> € / mois de marge rendue</div>' +
            '<div class="pres-sim-note" id="pres-sim-note">Estimation à 6–9 % net sur facture, sur vos achats hors génériques et hors offres labo. Le gain réel dépend de votre mix de produits.</div>' +
          '</div>' +

          '<h2 class="pres-sec-t" id="pres-open">Ouvrir un compte en 3 étapes</h2>' +
          '<div class="pres-card" style="padding:8px 24px 18px"><div class="pres-steps">' +
            step('1', 'Téléchargez et remplissez le formulaire 2026', 'Le formulaire d\'ouverture de compte Intégral Pharma 2026.') +
            '<div class="pres-step-cta pres-dl"><a class="v2-btn v2-btn-primary noprint" href="ouverture-compte-integral-pharma-2026.pdf" download>' + ICODL + 'Télécharger le formulaire 2026</a></div>' +
            step('2', 'Renvoyez-le par e-mail avec votre RIB et votre Kbis', 'Joignez le formulaire signé, votre RIB et votre Kbis (moins de 3 mois). Votre demande part à Ouest Pharma Services' + (u.name ? ' — ' + esc(u.name) + ' en copie' : '') + '.') +
            '<div class="pres-step-cta"><a class="v2-btn v2-btn-ghost noprint" href="' + openHref + '">' + ICO('fiche', 16) + 'Ouvrir mon logiciel mail</a></div>' +
            '<div class="pres-step"><div class="pres-step-ok">' + ICOCHK + '</div><div><div class="pres-step-t">Vous recevez votre code PharmaML</div><div class="pres-step-d">Votre compte est ouvert : vous pouvez commander.</div></div></div>' +
          '</div></div>' +

          sect('Vos meilleures ventes par catégorie') +
          '<div class="pres-card"><div class="pres-card-d" style="font-size:13.5px">Demandez à votre commercial le <b>TOP des ventes de votre catégorie</b> : il arrive avec vos références à plus forte rotation, le prix net Intégral Pharma en face et la commande déjà préparée. Vous voyez la marge, produit par produit, avant de commander.</div>' +
            '<div class="pres-cats">' + ['Antalgiques', 'Dermato', 'ORL', 'Digestion', 'Solaires', 'Vétérinaire'].map(function (c) { return '<span class="pres-cat">' + c + '</span>'; }).join('') + '</div></div>' +

          sect('Votre contact') +
          '<div class="pres-contact">' +
            '<div class="pres-contact-top">' +
              '<div class="pres-logo" style="width:46px;height:46px;border-radius:13px;margin:0">' + capsule(30, 18, true) + '</div>' +
              '<div><div class="pres-contact-n">' + esc(u.name || 'Votre commercial Intégral Pharma') + '</div>' +
                '<div class="pres-contact-r">Délégué pharmaceutique référent</div></div>' +
              '<div class="pres-contact-act noprint">' +
                '<a class="v2-btn v2-btn-primary" href="' + openHref + '">' + ICO('fiche', 16) + 'Demander l\'ouverture de mon compte</a>' +
                '<a class="v2-btn v2-btn-ghost" href="tel:0249625055">Être rappelé</a>' +
              '</div>' +
            '</div>' +
            '<div class="pres-contact-foot">' +
              (u.email ? '<a href="mailto:' + esc(u.email) + '">' + esc(u.email) + '</a> · ' : '') +
              'Ouest Pharma Services · Saint-Étienne-de-Montluc (44) — Service client 02 49 62 50 55 · serviceclient@ouestpharmaservices.fr' +
            '</div>' +
          '</div>' +

          '<div class="pres-send noprint">' +
            '<div class="pres-send-badge">Côté commercial</div>' +
            '<div class="pres-send-t">' + ICO('spark', 16) + ' Envoyer le kit à un prospect</div>' +
            '<div class="pres-send-d">Après ta visite : saisis l\'email de la pharmacie → on lui envoie un lien (qui on est, comment ouvrir un compte, ce qu\'elle gagne, tarifs, top ventes par catégorie). Le lien est déjà à ton nom.</div>' +
            '<div class="pres-send-row">' +
              '<input id="prospect-mail" type="email" inputmode="email" autocomplete="off" aria-label="Email de la pharmacie prospect" placeholder="email de la pharmacie" class="pres-send-in" />' +
              '<button class="v2-btn v2-btn-primary" onclick="V2.prospectEmail()">' + ICO('fiche', 16) + 'Préparer l\'email</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.prospectWhatsApp()">WhatsApp</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.prospectSMS()">SMS</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.prospectCopy()">Copier le lien</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.prospectOpen()">Aperçu</button>' +
            '</div>' +
          '</div>' +

          '<div style="text-align:center;font-size:12px;color:var(--muted);margin-top:18px">Document commercial Intégral Pharma — sous réserve des conditions générales.</div>' +
          '<div style="height:30px"></div>' +
        '</main>';
      // ── Motion (RM-safe via V2.motion, print intact : états finaux toujours posés) ──
      if (V2.motion) {
        var mo = V2.motion;
        // cascade douce : chips de réassurance après le hero, puis cartes « Ce que vous gagnez »
        mo.stagger(root.querySelectorAll('.pres-reassure-i'), { step: 55, delay: 420, y: 6 });
        mo.stagger(root.querySelectorAll('.pres-grid .pres-card'), { step: 60, y: 10 });
        // reveal à l'écran : preuve chiffrée, barème, étapes, contact, envoi du kit
        var rv = root.querySelectorAll('.pres-proof-h, .pres-tier, .pres-step, .pres-contact, .pres-send');
        for (var ri = 0; ri < rv.length; ri++) (function (el, i) {
          mo.inView(el, function () { mo.enter(el, { y: 8, delay: (i % 4) * 50 }); });
        })(rv[ri], ri);
        // count-up des chiffres-clés quand ils arrivent à l'écran (les libellés non
        // numériques sont laissés tels quels par l'API — texte officiel jamais altéré)
        var cts = root.querySelectorAll('[data-count]');
        for (var ci = 0; ci < cts.length; ci++) (function (el) {
          mo.inView(el, function () { mo.countUp(el); });
        })(cts[ci]);
      }
    }
  };

  // ── Accueil : styles premium injectés (bento + spotlight au survol) ──
  // Tout est portée sous .v2-home-x pour ne rien casser ailleurs (login, shell, OPSO).
  function injectHomeStyles() {
    if (document.getElementById('v2-home-style')) return;
    var st = document.createElement('style'); st.id = 'v2-home-style';
    st.textContent = [
      // Hero : plus d'air, halo dégradé sobre bleu→orange derrière le titre
      '.v2-home-x .v2-hero{position:relative;margin-bottom:34px;padding-top:8px}',
      // Halo hero : bleu IP (devient vert en OPSO via --ip-blue) + touche orange sobre côté droit
      '.v2-home-x .v2-hero::before{content:"";position:absolute;left:50%;top:-30px;width:min(620px,86%);height:210px;transform:translateX(-50%);pointer-events:none;z-index:-1;background:radial-gradient(60% 100% at 30% 0%,color-mix(in srgb,var(--ip-blue) 11%,transparent),transparent 78%),radial-gradient(55% 100% at 78% 10%,color-mix(in srgb,var(--c-pilo) 9%,transparent),transparent 80%)}',
      /* halo : dégradés radiaux seuls. Le filter:blur(6px) qui les adoucissait portait
         sur 620×210 px — « flou sur une grande surface », interdit (le Mac de Will plante).
         Les arrêts de dégradé ont été étirés (70→78 %, 72→80 %) pour retrouver la douceur. */
      '.v2-home-x .v2-eyebrow{background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--line);padding:6px 13px;border-radius:var(--r-pill);box-shadow:var(--sh-1)}',
      '.v2-home-x .v2-hero h1{background:none}',
      '.v2-home-x .v2-hero .ac{color:var(--ip-blue)}',
      // Recherche : accent dégradé sur l\'icône, kbd plus net
      '.v2-home-x .v2-search{background:linear-gradient(180deg,var(--card),var(--card-2))}',
      '.v2-home-x .v2-search .srch-ic{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:linear-gradient(150deg,color-mix(in srgb,var(--ip-blue) 14%,var(--card)),color-mix(in srgb,var(--c-pilo) 10%,var(--card)));color:var(--ip-blue);flex-shrink:0}',
      '.v2-home-x .v2-search .srch-ic svg{color:var(--ip-blue)}',
      // Sections « moment » : filet dégradé sous le titre
      '.v2-home-x .v2-moment-h::after{background:linear-gradient(90deg,color-mix(in srgb,var(--mc,var(--line)) 40%,transparent),transparent)}',
      // Tuiles bento : spotlight qui suit la souris + liseré dégradé au survol
      '.v2-home-x .v2-pil{background:linear-gradient(180deg,var(--card),var(--card-2));transition:transform .28s var(--mo-ease-soft),box-shadow .28s var(--mo-ease-soft),border-color .28s var(--mo-ease-soft)}',
      '.v2-home-x .v2-pil::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s var(--mo-ease-soft);background:radial-gradient(240px circle at var(--mx,50%) var(--my,0%),color-mix(in srgb,var(--accent) 16%,transparent),transparent 62%)}',
      '.v2-home-x .v2-pil:hover::after{opacity:1}',
      '.v2-home-x .v2-pil::before{height:100%;width:3px;top:0;left:0;right:auto;background:linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 45%,transparent));transform:scaleY(1) scaleX(0);transform-origin:left center;transition:transform .3s var(--mo-ease-soft)}',
      '.v2-home-x .v2-pil:hover::before{transform:scaleY(1) scaleX(1)}',
      '.v2-home-x .v2-pil:hover{transform:translateY(-4px)}',
      // Icône : fond dégradé teinté de l\'accent de la tuile
      '.v2-home-x .v2-pil-ico{background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 16%,var(--card)),color-mix(in srgb,var(--accent) 6%,var(--card)));color:var(--accent);box-shadow:0 1px 0 rgba(255,255,255,.7) inset}',
      '.v2-home-x .v2-pil-num{background:color-mix(in srgb,var(--accent) 10%,transparent);padding:3px 9px;border-radius:var(--r-pill);border:1px solid color-mix(in srgb,var(--accent) 20%,transparent)}',
      // CTA « aller » : la flèche glisse au survol
      '.v2-home-x .v2-pil-go{color:var(--accent);font-weight:700}',
      '.v2-home-x .v2-pil-go .arrow{display:inline-block;transition:transform .28s var(--mo-ease-soft)}',
      '.v2-home-x .v2-pil:hover .v2-pil-go .arrow{transform:translateX(4px)}',
      // Apparition douce en cascade
      '.v2-home-x .v2-moment,.v2-home-x .v2-hero,.v2-home-x .v2-search,.v2-home-x .v2-recent{animation:v2homeIn .5s var(--mo-ease-in) both}',
      '.v2-home-x .v2-search{animation-delay:.04s}.v2-home-x .v2-recent{animation-delay:.08s}',
      '.v2-home-x .v2-moment:nth-of-type(1){animation-delay:.10s}.v2-home-x .v2-moment:nth-of-type(2){animation-delay:.16s}.v2-home-x .v2-moment:nth-of-type(3){animation-delay:.22s}.v2-home-x .v2-moment:nth-of-type(4){animation-delay:.28s}',
      '@keyframes v2homeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      // Accessibilité : on coupe animations + spotlight si mouvement réduit
      '@media(prefers-reduced-motion:reduce){.v2-home-x .v2-moment,.v2-home-x .v2-hero,.v2-home-x .v2-search,.v2-home-x .v2-recent{animation:none}.v2-home-x .v2-pil,.v2-home-x .v2-pil-go .arrow{transition:none}.v2-home-x .v2-pil::after{display:none}}',
      // ─── Accueil « Launcher » (choix Will) : hero calme centré + grande recherche + 4 grandes entrées + « Autres outils » discret
      '.v2-home-x .v2-hero{text-align:center}',
      '.v2-home-x .v2-hero h1{font-size:clamp(28px,5vw,40px);font-weight:700;letter-spacing:-.02em;margin:0 0 9px}',
      '.v2-home-x .v2-hero .ac{color:var(--ip-blue)}',
      '.v2-home-x .v2-hero-sub{color:var(--muted);font-size:15px;margin:0}',
      '.v2-home-x .v2-hero-sub b{color:var(--ip-ink);font-weight:600}',
      '.v2-home-x .v2-search{height:62px;border-radius:16px}',
      '.v2-home-x .v2-search input{font-size:16px}',
      '.v2-home-x .v2-recent{justify-content:center}'
    ].join('');
    document.head.appendChild(st);
  }
  // Relances dues (demande Manon, 10/09/2026) : date saisie fiche par fiche
  // (« Prochaine relance », V2.profil scope 'client') — carte sur l'accueil
  // listant les officines en retard / à relancer aujourd'hui / bientôt.
  // Chargée une fois (cache module), l'accueil se réaffiche dès qu'elle arrive.
  var _relances = null;
  var _relancesPret = false;   // vrai dès que la lecture des relances a répondu (même vide)
  // 22/09/2026 — cascade d'entrée du « tableau vivant » : posée une seule fois
  // par session. V2.render() est rappelé quand les relances arrivent et quand
  // les ventes finissent (voir V2.onOfficinesPretes/onVentesProgres) : la
  // cascade ne doit pas se rejouer à chaque retour sur l'accueil, sinon
  // chaque re-rendu ferait clignoter la page.
  var _homeAnimJoue = false;
  // 19/09/2026 — chacun ne voit que SES relances (demande de Will : « tout le monde voit
  // celles des autres commerciaux »). Dans l'ordre : qui a posé la date (`relance_par`,
  // retenu depuis ce jour) ; pour les dates plus anciennes, le commercial de l'officine
  // (`comms`, même critère que la liste des officines) ; à défaut, le dernier auteur de
  // la fiche. `by` absent = repli local de cet appareil, donc les siennes.
  function relanceEstAMoi(o, ph) {
    var u = V2.user || {}, par = o.data.relance_par;
    if (par) return par === u.id;
    var comms = ph.comms || [];
    if (comms.length) return !!u.commercial && comms.indexOf(String(u.commercial)) >= 0;
    return o.by === undefined || o.by === u.id;
  }
  function loadRelances() {
    if (_relances || !V2.profil || !V2.profil.loadScope) return;
    _relances = [];
    V2.profil.loadScope('client').then(function (all) {
      var byId = {}; (V2.pharmacies || []).forEach(function (p) { byId[String(p.id)] = p; });
      var today0 = new Date(); today0.setHours(0, 0, 0, 0);
      var out = [];
      (all || []).forEach(function (o) {
        var d = o && o.data && o.data.relance_date; if (!d) return;
        var ph = byId[String(o.sid)]; if (!ph) return;
        if (!relanceEstAMoi(o, ph)) return;
        var dt = new Date(d + 'T00:00:00'); if (isNaN(dt.getTime())) return;
        var diff = Math.round((dt - today0) / 86400000);
        out.push({ pid: o.sid, name: ph.name || '', ville: ph.ville || '', diff: diff });
      });
      out.sort(function (a, b) { return a.diff - b.diff; });
      _relances = out; _relancesPret = true;
      if (V2.render) V2.render();
    }).catch(function () { _relances = []; _relancesPret = true; });
  }
  function relancesCardHtml() {
    if (_relances == null) { loadRelances(); return ''; }
    var dus = _relances.filter(function (r) { return r.diff <= 2; }).slice(0, 8);
    if (!dus.length) return '';
    function badge(diff) {
      if (diff < 0) return { c: 'var(--c-rose)', t: diff === -1 ? 'Retard : hier' : 'Retard : J' + diff };
      if (diff === 0) return { c: 'var(--c-amber)', t: 'Aujourd\'hui' };
      return { c: 'var(--c-mint)', t: 'Dans ' + diff + 'j' };
    }
    return '<div class="v2-card" style="margin-bottom:16px;padding:16px 18px">' +
      '<div style="font-size:13px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink);margin-bottom:10px">À relancer</div>' +
      dus.map(function (r) {
        var b = badge(r.diff);
        return '<a onclick="V2.go(\'pharma\',\'' + esc(String(r.pid)) + '\')" style="display:flex;align-items:center;gap:10px;padding:8px 0;text-decoration:none;color:inherit;cursor:pointer;border-top:1px solid var(--line);font-size:13.5px">' +
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.name) + '</span>' +
          '<span style="flex:none;font-size:11px;font-weight:700;color:' + b.c + '">' + b.t + '</span></a>';
      }).join('') +
      '</div>';
  }
  // ════════════════════════════════════════════
  // ACCUEIL u2 « le rail » (choisi par Will le 02/10/2026 ; remplace q1, lui-même venu de g4 validé le 30/09/2026)
  // Même accueil pour tous : les outils sont rangés selon le nombre total
  // d'ouvertures de l'équipe (table usage_ecran, lue par la fonction Supabase
  // accueil_ouvertures, qui ne rend que des totaux). Le RANG seul est affiché :
  // jamais de chiffre d'ouvertures ni de nom de personne. Hors OPSO uniquement.
  // ════════════════════════════════════════════
  // Ordre de repli (mesure du 30/09/2026), utilisé tant que le vrai classement n'est pas là.
  var G4_REPLI = ['pharma', 'produits', 'pilotage', 'marketing', 'infos', 'rdv', 'carte', 'appro', 'todo', 'biosimilaires', 'offilog', 'concurrents', 'remontees', 'marchefr', 'carteGrp', 'lgo', 'groupements', 'academy'];
  // 02/10/2026 — Will : « supprimer audit, fiches pdf, l'argument, audit marge, réforme 2027, présentation intégral ». Les cinq portes
  // portent `retire: true` : absentes de G4_REPLI donc de l'accueil, des menus et des réglages (u2Net les écarte). Elles restent
  // décrites ici pour le nom d'écran de la barre (nomEcran) : audit et fiches ont encore des parcours internes.
  // k = nom de la route mesurée par V2.mesurer (= `ecran` côté base) ; page = écran qui doit exister.
  var G4_PORTES = {
    pharma: { fam: 'clients', ico: 'officines', nom: 'Officines', ph: 'La fiche de chaque client et prospect', page: 'pharma' },
    produits: { fam: 'produits', ico: 'catalogue', nom: 'Catalogue produits', ph: 'Prix et stock des 7 établissements', page: 'produits' },
    pilotage: { fam: 'piloter', ico: 'pilotage', nom: 'Pilotage', ph: 'CA, marge et objectifs', page: 'pilotage' },
    marketing: { fam: 'communiquer', ico: 'marketing', nom: 'Marketing', ph: 'Supports, sélections, LinkedIn', page: 'marketing' },
    infos: { fam: 'veille', ico: 'infos', nom: 'Infos du matin', ph: 'Le brief du jour', page: 'infos' },
    rdv: { fam: 'clients', ico: 'rdv', nom: 'Rendez-vous', ph: 'Demander et suivre vos rendez-vous', page: 'rdv' },
    carte: { fam: 'clients', ico: 'carte', nom: 'La carte', ph: 'Clients, prospects et votre tournée', page: 'carte' },
    appro: { fam: 'piloter', ico: 'appro', nom: 'Appro Intégral', ph: 'Couverture de stock et ruptures', page: 'appro' },
    todo: { fam: 'clients', ico: 'todo', nom: 'To do list', ph: 'Rendez-vous à demander, remerciements, ouvertures', page: 'todo' },
    biosimilaires: { fam: 'produits', ico: 'biosim', nom: 'Biosimilaires', ph: 'Les biosimilaires et leurs références', page: 'biosimilaires' },
    offilog: { fam: 'produits', ico: 'offilog', nom: 'Offilog', ph: 'La centrale parapharmacie', page: 'offilog' },
    concurrents: { fam: 'veille', ico: 'concurrents', nom: 'Concurrents', ph: 'Ce que font les autres', page: 'concurrents' },
    remontees: { fam: 'aide', ico: 'remontees', nom: 'Remontées', ph: 'Le mur d\'idées de l\'équipe', page: 'remontees' },
    marchefr: { fam: 'veille', ico: 'marche', nom: 'Le marché', ph: 'Le marché français d\'une référence, région par région', page: 'marchefr' },
    carteGrp: { fam: 'veille', ico: 'carte-grp', nom: 'Carte des groupements', ph: 'Où sont les adhérents de chaque groupement', page: 'carteGrp' },
    presentation: { retire: true, fam: 'communiquer', ico: 'presentation', nom: 'Présentation Intégral', ph: 'Le groupe de grossistes-répartiteurs en quelques écrans', page: 'presentation' },
    lgo: { fam: 'communiquer', ico: 'lgo', nom: 'Logiciels officine', ph: 'Importer le catalogue dans chaque logiciel', page: 'lgo' },
    fiches: { retire: true, fam: 'clients', ico: 'fiches', nom: 'Fiches PDF', ph: 'Les fiches à laisser en officine', page: 'fiches' },
    argument: { retire: true, fam: 'produits', ico: 'argument', nom: 'L\'Argument', ph: 'Quoi répondre, objection par objection', page: 'argument' },
    audit: { retire: true, fam: 'produits', ico: 'audit', nom: 'Audit marge', ph: 'La marge d\'une officine, calculée avec elle', page: 'audit' },
    // Groupements : pas d'écran à part, c'est l'onglet « groupements » des officines.
    groupements: { fam: 'clients', ico: 'groupements', nom: 'Groupements', ph: 'Les listes et listings d\'achats', page: 'pharma', js: 'V2.go(\'pharma\',\'groupements\')' },
    // Réforme 2027 : document privé, adresse signée valable 1 h, jamais servi par le dépôt public.
    reforme2027: { retire: true, fam: 'produits', ico: 'reforme', nom: 'Réforme 2027', ph: 'Ce qui change pour la marge officinale', page: 'pilotage', js: 'V2.ouvrirDocProtege(\'reforme2027\')' },
    // JARVIS Academy : lien externe (Q_ACADEMY), tuile de « Aide et idées » ; pas d'écran de l'app (page: null).
    academy: { fam: 'aide', ico: 'academy', nom: 'JARVIS Academy', ph: 'Se former à l\'outil, pas à pas', page: null }
  };
  var G4_CLE_ORDRE = 'jarvis_accueil_ordre2';
  var _g4Ordre = null;        // [{e, o, p}] : écran, ouvertures, personnes (jamais affichés)
  var _g4Demande = false;     // un seul appel réseau par chargement de page
  var _g4Esc = {};            // textes Escale des portes Officines et Pilotage
  function g4OrdreNormalise(rows) {
    // Anciens noms d'un même écran : « marche » avant « marchefr », « grossistes »
    // redirige vers Concurrents, « molecules » (Catalogue & prix par produit,
    // sans porte) compte pour Catalogue produits. Ouvertures additionnées ; personnes = le plus
    // grand des deux (deux listes de personnes ne s'additionnent pas).
    var ALIAS = { marche: 'marchefr', grossistes: 'concurrents', molecules: 'produits' };
    var par = {}, out = [];
    (rows || []).forEach(function (r) {
      if (!r || !r.ecran || r.ecran === 'home') return;
      var e = ALIAS[r.ecran] || String(r.ecran);
      var o = Number(r.ouvertures) || 0, p = Number(r.personnes) || 0;
      if (par[e]) { par[e].o += o; par[e].p = Math.max(par[e].p, p); }
      else { par[e] = { e: e, o: o, p: p }; out.push(par[e]); }
    });
    return out;
  }
  // Le classement vient d'abord du cache de la session ; sinon l'ordre de repli
  // s'affiche tout de suite et la demande part sans bloquer. Toute erreur reste
  // silencieuse : l'accueil n'est jamais vide et n'affiche jamais d'erreur.
  function g4ChargerOrdre() {
    if (_g4Ordre) return;
    try {
      var c = sessionStorage.getItem(G4_CLE_ORDRE);
      if (c) { var a = JSON.parse(c); if (a && a.length) { _g4Ordre = a; return; } }
    } catch (e) {}
    if (_g4Demande || !V2.user) return;
    _g4Demande = true;
    try {
      var sb = V2.sb && V2.sb();
      if (!sb || !sb.rpc) return;
      sb.rpc('accueil_ouvertures').then(function (r) {
        try {
          var rows = g4OrdreNormalise(r && r.data);
          if (!rows.length) return;
          _g4Ordre = rows;
          try { sessionStorage.setItem(G4_CLE_ORDRE, JSON.stringify(rows)); } catch (e) {}
          g4Rafraichir();
        } catch (e) {}
      }, function () {});
    } catch (e) {}
  }
  // Nombre d'ouvertures décroissant, puis nombre de personnes ; une porte absente
  // du classement passe après celles qui y sont, dans l'ordre de repli.
  function g4Classer(cles) {
    var info = {};
    (_g4Ordre || []).forEach(function (r) { info[r.e] = r; });
    return cles.slice().sort(function (a, b) {
      var ia = info[a], ib = info[b];
      if (ia && ib) {
        if (ib.o !== ia.o) return ib.o - ia.o;
        if (ib.p !== ia.p) return ib.p - ia.p;
      } else if (ia) { return -1; } else if (ib) { return 1; }
      return G4_REPLI.indexOf(a) - G4_REPLI.indexOf(b);
    });
  }
  // 01/10/2026 — « À la une » : UNE nouveauté annoncée au-dessus de « Vos outils », hors
  // classement (décision de Will). Temporaire : après `fin`, le bandeau disparaît tout seul
  // et l'outil ne garde que son rang dans la liste. Jamais en Escale ni en OPSO.
  var G4_UNE = { page: 'lgo', ico: 'lgo', fin: '2026-10-31',
    nom: 'Le catalogue, au format de chaque logiciel',
    ph: 'Winpharma, LGPI, Smart RX, LEO, Pharmaland… le fichier s\'importe tel quel, mode d\'emploi joint.' };

  // ── Accueil u2 : les pictos (une seule famille, trait 1,75, tirés de la maquette validée) ──
  var U2_IC = {
    officines: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.5 2.5 0 005 0 2.5 2.5 0 005 0 2.5 2.5 0 005 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-4h4v4"/>',
    carte: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    rdv: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    todo: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.3 1.3L7 5M3.5 12l1.3 1.3L7 11M3.5 18l1.3 1.3L7 17"/>',
    fiches: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    groupements: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/><path d="M16 5.6a3 3 0 010 5.8M18 14c1.8.7 3 2.3 3 5"/>',
    produits: '<path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2z"/><path d="M4 7.2l8 4.3 8-4.3M12 11.5V21"/>',
    offilog: '<path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/>',
    biosimilaires: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="9" r="3"/><circle cx="10" cy="17" r="3"/><path d="M9.8 7.6l4.4.8M8.6 9.8l.9 4.2M14.8 11.6l-3.2 3.4"/>',
    audit: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8.5 11.5l2 2 3-4"/>',
    argument: '<path d="M4 5h16v11H11l-4.5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    reforme2027: '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
    pilotage: '<path d="M4.5 17a8.5 8.5 0 1115 0"/><path d="M12 14l3.5-4.5"/><circle cx="12" cy="14.2" r="1.2"/>',
    appro: '<rect x="3.5" y="12" width="7" height="7" rx="1.5"/><rect x="13.5" y="12" width="7" height="7" rx="1.5"/><rect x="8.5" y="4" width="7" height="7" rx="1.5"/>',
    infos: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
    concurrents: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    marchefr: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5z"/>',
    carteGrp: '<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
    marketing: '<path d="M4 10v4h3l8 4V6L7 10z"/><path d="M18.5 9.5a3.5 3.5 0 010 5"/>',
    presentation: '<rect x="3.5" y="4.5" width="17" height="11" rx="2"/><path d="M12 15.5V20M8 20h8"/>',
    lgo: '<rect x="3.5" y="5" width="17" height="12" rx="2"/><path d="M8 21h8M12 17v4M9.5 10.5l2.5 2.5 2.5-2.5M12 8v5"/>',
    remontees: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
    academy: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.8V16c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.2M21.5 9.5V14"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 100 17c1.2 0 1.8-.8 1.8-1.7 0-1.5-1.3-1.6-1.3-2.9 0-.9.7-1.4 1.6-1.4H17a3.5 3.5 0 003.5-3.5C20.5 7 16.8 3.5 12 3.5z"/><circle cx="7.8" cy="11.5" r="1"/><circle cx="10.5" cy="7.7" r="1"/><circle cx="15.2" cy="8" r="1"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    pin: '<path d="M12 16v5.5M8 3h8l-1 6 3 4.5H6L9 9z"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    user: '<circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20c0-4 3.3-6.3 7.5-6.3s7.5 2.3 7.5 6.3"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
    logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
    espace: '<path d="M7 8h13l-3-3.5M17 16H4l3 3.5"/>',
    grille: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    widgets: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="14" width="7" height="6" rx="2"/><rect x="14" y="14" width="6" height="6" rx="2"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>'
  };
  U2_IC.pharma = U2_IC.officines;
  function u2Ic(n, s, cls) {
    return '<svg class="u2-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"' + (s ? ' style="width:' + s + 'px;height:' + s + 'px"' : '') + '>' + (U2_IC[n] || U2_IC.doc) + '</svg>';
  }
  // Les six familles de la maquette, dans cet ordre. Le rattachement d'un outil est le champ `fam` de G4_PORTES.
  var U2_FAMS = [['clients', 'Mes clients'], ['produits', 'Produits et prix'], ['piloter', 'Piloter'], ['veille', 'Veille'], ['communiquer', 'Communiquer'], ['aide', 'Aide et idées']];
  var U2_WIDGETS = { infos: { nom: 'Infos du matin', page: 'infos' }, todo: { nom: 'To do list', page: 'todo' }, relance: { nom: 'À relancer', page: 'rdv' }, semaine: { nom: 'Ma semaine', page: 'rdv' } };
  var U2_WORDRE = ['infos', 'todo', 'relance', 'semaine'];
  // 02/10/2026 — Couleurs : sept teintes d'accent, fond toujours clair. Chaque ligne est calculée une fois (ton foncé, halo clair, ombres) :
  // c = accent, d = ton foncé, h = halo, ci / cg / cd = les trois nappes de la lumière de tête (.v2-halo), o / ol = ombre portée forte / légère, sh / shh = ombres des boutons pleins.
  // Contrastes calculés : blanc sur c ≥ 5,3:1, d sur h ≥ 8:1, c sur h ≥ 4,7:1. La première est le bleu d'origine : sans réglage, rien ne change.
  // m (facultatif) = un motif posé PAR-DESSUS l'accent sur les surfaces pleines (variable CSS de v2-accueil.css) : le léopard, taches plus sombres que c, donc le blanc y reste lisible.
  var U2_TEINTES = [
    { k: 'bleu', nom: 'Bleu JARVIS', c: '#0050E6', d: '#0034A0', ci: '#E4EDFC', cg: '#CFDFFC', cd: '#DCE7FC', h: '#E9F0FF', o: 'rgba(0,80,230,.28)', ol: 'rgba(0,80,230,.10)', sh: '0 4px 12px rgba(0,80,230,.26), 0 8px 24px rgba(0,52,160,.14), 0 1px 0 rgba(255,255,255,.22) inset', shh: '0 6px 16px rgba(0,80,230,.34), 0 14px 34px rgba(0,52,160,.20), 0 1px 0 rgba(255,255,255,.28) inset' },
    { k: 'indigo', nom: 'Indigo', c: '#4B3FD0', d: '#322A89', ci: '#EBEAFA', cg: '#DDDBF6', cd: '#E6E5F9', h: '#EFEEFB', o: 'rgba(75,63,208,.28)', ol: 'rgba(75,63,208,.10)', sh: '0 4px 12px rgba(75,63,208,.26), 0 8px 24px rgba(50,42,137,.14), 0 1px 0 rgba(255,255,255,.22) inset', shh: '0 6px 16px rgba(75,63,208,.34), 0 14px 34px rgba(50,42,137,.20), 0 1px 0 rgba(255,255,255,.28) inset' },
    { k: 'emeraude', nom: 'Émeraude', c: '#0A7A55', d: '#075138', ci: '#E4F0EC', cg: '#D0E6DF', cd: '#DDEDE8', h: '#E9F3F0', o: 'rgba(10,122,85,.28)', ol: 'rgba(10,122,85,.10)', sh: '0 4px 12px rgba(10,122,85,.26), 0 8px 24px rgba(7,81,56,.14), 0 1px 0 rgba(255,255,255,.22) inset', shh: '0 6px 16px rgba(10,122,85,.34), 0 14px 34px rgba(7,81,56,.20), 0 1px 0 rgba(255,255,255,.28) inset' },
    { k: 'corail', nom: 'Corail', c: '#BE3318', d: '#7D2210', ci: '#F8E9E6', cg: '#F3D8D3', cd: '#F6E3DF', h: '#F9EDEA', o: 'rgba(190,51,24,.28)', ol: 'rgba(190,51,24,.10)', sh: '0 4px 12px rgba(190,51,24,.26), 0 8px 24px rgba(125,34,16,.14), 0 1px 0 rgba(255,255,255,.22) inset', shh: '0 6px 16px rgba(190,51,24,.34), 0 14px 34px rgba(125,34,16,.20), 0 1px 0 rgba(255,255,255,.28) inset' },
    { k: 'ambre', nom: 'Ambre', c: '#9C5700', d: '#673900', ci: '#F4EDE3', cg: '#ECDFCF', cd: '#F1E8DC', h: '#F6F0E8', o: 'rgba(156,87,0,.28)', ol: 'rgba(156,87,0,.10)', sh: '0 4px 12px rgba(156,87,0,.26), 0 8px 24px rgba(103,57,0,.14), 0 1px 0 rgba(255,255,255,.22) inset', shh: '0 6px 16px rgba(156,87,0,.34), 0 14px 34px rgba(103,57,0,.20), 0 1px 0 rgba(255,255,255,.28) inset' },
    { k: 'prune', nom: 'Prune', c: '#8E2A7A', d: '#5E1C51', ci: '#F3E8F0', cg: '#EAD7E6', cd: '#F0E2ED', h: '#F5ECF3', o: 'rgba(142,42,122,.28)', ol: 'rgba(142,42,122,.10)', sh: '0 4px 12px rgba(142,42,122,.26), 0 8px 24px rgba(94,28,81,.14), 0 1px 0 rgba(255,255,255,.22) inset', shh: '0 6px 16px rgba(142,42,122,.34), 0 14px 34px rgba(94,28,81,.20), 0 1px 0 rgba(255,255,255,.28) inset' },
    { k: 'leopard', nom: 'Léopard', m: 'var(--u2-leo)', c: '#94561A', d: '#5F370E', ci: '#F6EEE2', cg: '#EFE2CE', cd: '#F3E9DB', h: '#F8F1E7', o: 'rgba(148,86,26,.28)', ol: 'rgba(148,86,26,.10)', sh: '0 4px 12px rgba(148,86,26,.26), 0 8px 24px rgba(95,55,14,.14), 0 1px 0 rgba(255,255,255,.22) inset', shh: '0 6px 16px rgba(148,86,26,.34), 0 14px 34px rgba(95,55,14,.20), 0 1px 0 rgba(255,255,255,.28) inset' }
  ];
  var U2_FAMILLES = U2_FAMS.map(function (f) { return f[0]; });
  var Q_ACADEMY = 'https://jarvis-academy-fr.vercel.app/';
  var NOTE_USAGE = 'Les écrans que vous ouvrez sont enregistrés (votre nom et l\'heure), pour savoir lesquels améliorer en priorité.';
  // ── Dates ──
  function qDateTxt(d) {
    var s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/\b1 /, '1er ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function qSemaine() {
    var now = new Date(), dow = (now.getDay() + 6) % 7, lun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow), noms = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'], j = [];
    for (var i = 0; i < 7; i++) { var d = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + i); j.push({ n: noms[i], j: d.getDate(), passe: i < dow, lib: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }).replace(/\b1$/, '1er') }); }
    var mois = now.toLocaleDateString('fr-FR', { month: 'long' });
    return { dow: dow, jours: j, mois: mois.charAt(0).toUpperCase() + mois.slice(1) };
  }
  function qQuand(diff) {
    if (diff < 0) return { t: diff === -1 ? 'Retard : hier' : 'Retard : ' + (-diff) + ' j', c: 'q-tard' };
    if (diff === 0) return { t: 'Aujourd\'hui', c: 'q-jour-j' };
    return { t: 'Dans ' + diff + ' j', c: '' };
  }
  // Relances dues (mêmes données que l'ancien accueil : `_relances`, retard et jusqu'à J+2, huit au plus).
  function qRelances() {
    if (_relances == null) { loadRelances(); return { l: [], pret: false }; }
    return { l: _relances.filter(function (r) { return r.diff <= 2; }).slice(0, 8), pret: _relancesPret };
  }
  // Relance de chaque jour de la semaine (un point sous le jour) : seules celles de la liste affichée comptent.
  function qParJour(rel, dow) {
    var pj = {};
    rel.forEach(function (r, i) { var k = dow + r.diff; if (k < 0 || k > 6) return; (pj[k] = pj[k] || []).push(i); });
    return pj;
  }
  // ── Infos du matin : infos-jour.json, même adresse et même cache que les autres écrans ──
  var _qInfos = { data: null, t: 0, enCours: false };
  function qInfosCharger() {
    if (_qInfos.enCours || (_qInfos.data && Date.now() - _qInfos.t < 900000)) return;
    _qInfos.enCours = true;
    function fin(j) {
      _qInfos.enCours = false;
      if (j && typeof j === 'object') { _qInfos.data = j; _qInfos.t = Date.now(); }
      _qInfos.fini = true;
      if (_u2.monte) u2MajWidgets();
    }
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('infos-jour.json?d=' + day, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(fin, function () { fin(null); });
    } catch (e) { fin(null); }
  }
  // La date du jour se lit à Paris : l'édition arrive entre 9 h 56 et 11 h 46, avant elle le fichier est celui d'hier.
  function qJourParis(d) {
    try {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
    } catch (e) {}
    return d.toISOString().slice(0, 10);
  }
  function qJourMoins(iso, n) { var t = iso.split('-'); return new Date(Date.UTC(+t[0], +t[1] - 1, +t[2] - n)).toISOString().slice(0, 10); }
  function qDateLongue(iso) {
    try { var t = iso.split('-'), s = new Date(+t[0], +t[1] - 1, +t[2]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); return s.replace(/^1 /, '1er '); } catch (e) { return iso; }
  }
  function qDateCourte(iso) {
    try { var t = iso.split('-'); return new Date(+t[0], +t[1] - 1, +t[2]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace(/^1 /, '1er '); } catch (e) { return iso; }
  }
  function qInfosModele() {
    var d = _qInfos.data;
    if (!d) return { etat: _qInfos.fini ? 'echec' : 'charge' };
    var jour = String(d.day || ''), auj = qJourParis(new Date()), quand = jour === auj ? 'auj' : jour === qJourMoins(auj, 1) ? 'hier' : 'ancien';
    var items = d.items || [], t = (d.recap && d.recap.une) || (items[0] && items[0].titre) || '';
    var nb = typeof d.count_today === 'number' ? d.count_today : null;
    var titre = !t ? 'Le brief du jour est prêt à lire.' : quand === 'auj' ? t : quand === 'hier' ? 'Hier · ' + t : 'Édition du ' + qDateLongue(jour) + ' · ' + t;
    return { etat: 'ok', quand: quand, titre: titre, nb: nb, rupt: typeof d.ruptures_total === 'number' ? d.ruptures_total : null, rapp: Array.isArray(d.rappels) ? d.rappels.length : null,
      puce: quand === 'auj' ? 'Aujourd\'hui' : quand === 'hier' ? 'Hier' : qDateCourte(jour) };
  }

  // ═════════════════════════════════════════════════════════════════
  // ACCUEIL u2 « le rail » : les outils, les réglages gardés par personne, les quatre widgets.
  // Trois zones : à gauche les réglages de son espace (rail + tiroir, jamais d'outil à ouvrir),
  // au centre le seul choix de l'outil, à droite l'aperçu de la journée. Tout ce qui arrive en
  // retard (relances, classement, brief, fin des ventes, réglages de la base) met à jour son
  // morceau EN PLACE : l'accueil ne se redessine pas en entier et ne rejoue aucune entrée.
  // Réglages : table `profils` (scope 'groupement', scope_id '__accueil_<id>__'), comme la To do list.
  // ═════════════════════════════════════════════════════════════════
  var _u2 = { S: null, id: null, dist: false, modifie: false, timer: 0, entree: false, onglet: 'ep', sec: null, ouvert: false, opener: null,
    monte: false, mode: null, todoPret: false, lie: null, sig: {}, sigW: {} };

  function u2Id() { return (V2.user && V2.user.id) || 'local'; }
  function u2Cle() { return 'jarvis_accueil_u2_v1:' + u2Id(); }
  function u2ScopeId() { return '__accueil_' + u2Id() + '__'; }
  function u2Mode() { try { return window.matchMedia('(max-width:1099px)').matches; } catch (e) { return false; } }
  function u2Escale() { return !!(window.V2_BRAND && window.V2_BRAND.escale); }
  function u2Installee() { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } }
  function u2Nb(n) { try { return (Number(n) || 0).toLocaleString('fr-FR'); } catch (e) { return String(n); } }

  // ── Réglages : forme { v:1, epingles:[…]|null, ordre:{famille:[…]}, widgets:{…}, wordre:[…], couleur:'bleu', masques:[…], fordre:[…] } ──
  // epingles null = « rien réglé » : les quatre premiers du classement réel. [] = tout désépinglé.
  // couleur = clé d'une teinte de U2_TEINTES ; masques = outils cachés (restent dans les réglages) ; fordre = ordre des familles.
  function u2Def() { return { v: 1, epingles: null, ordre: {}, widgets: { infos: true, todo: true, relance: true, semaine: true }, wordre: U2_WORDRE.slice(),
    couleur: U2_TEINTES[0].k, masques: [], fordre: U2_FAMILLES.slice() }; }
  // Nettoyage à la lecture : clés inconnues ignorées, outils disparus retirés, doublons retirés.
  function u2Net(raw) {
    var S = u2Def();
    if (!raw || typeof raw !== 'object') return S;
    function connu(k, i, a) { return typeof k === 'string' && !!G4_PORTES[k] && !G4_PORTES[k].retire && a.indexOf(k) === i; }
    if (Array.isArray(raw.epingles)) S.epingles = raw.epingles.filter(connu);
    if (raw.ordre && typeof raw.ordre === 'object' && !Array.isArray(raw.ordre)) {
      U2_FAMS.forEach(function (f) {
        var o = raw.ordre[f[0]];
        if (Array.isArray(o)) S.ordre[f[0]] = o.filter(function (k, i, a) { return connu(k, i, a) && G4_PORTES[k].fam === f[0]; });
      });
    }
    if (raw.widgets && typeof raw.widgets === 'object') U2_WORDRE.forEach(function (k) { if (typeof raw.widgets[k] === 'boolean') S.widgets[k] = raw.widgets[k]; });
    if (Array.isArray(raw.wordre) && raw.wordre.length === U2_WORDRE.length && raw.wordre.every(function (k, i, a) { return !!U2_WIDGETS[k] && a.indexOf(k) === i; })) S.wordre = raw.wordre.slice();
    if (typeof raw.couleur === 'string' && U2_TEINTES.some(function (t) { return t.k === raw.couleur; })) S.couleur = raw.couleur;
    if (Array.isArray(raw.masques)) S.masques = raw.masques.filter(connu);
    if (Array.isArray(raw.fordre)) {
      var fo = raw.fordre.filter(function (k, i, a) { return U2_FAMILLES.indexOf(k) >= 0 && a.indexOf(k) === i; });
      S.fordre = fo.concat(U2_FAMILLES.filter(function (k) { return fo.indexOf(k) < 0; }));   // une famille oubliée se range à la fin
    }
    return S;
  }
  // ── La couleur : posée sur .u2-page et .u2-hors (le tiroir vit sur <body>), lue dans le navigateur AVANT le premier dessin ──
  // Jamais en Escale (son thème impose ses couleurs) ; le bleu d'origine ne pose aucune surcharge.
  function u2Teinte() {
    if (u2Escale()) return U2_TEINTES[0];
    var k = u2S().couleur;
    return U2_TEINTES.filter(function (t) { return t.k === k; })[0] || U2_TEINTES[0];
  }
  function u2Vars(t) {
    return { '--ip-blue': t.c, '--ip-blue-d': t.d, '--halo': t.h, '--sh-blue': t.sh, '--sh-blue-h': t.shh, '--accent': t.c, '--u2-o': t.o, '--u2-ol': t.ol, '--u2-motif': t.m || 'none' };
  }
  function u2StyleAttr() {
    var t = u2Teinte();
    if (t === U2_TEINTES[0]) return '';
    var v = u2Vars(t);
    return ' style="' + Object.keys(v).map(function (n) { return n + ':' + v[n]; }).join(';') + '"';
  }
  function u2PoserTeinte() {
    var t = u2Teinte(), v = u2Vars(t), d = t === U2_TEINTES[0];
    [document.querySelector('.u2-page'), document.getElementById('u2-hors')].forEach(function (el) {
      if (!el) return;
      Object.keys(v).forEach(function (n) { if (d) el.style.removeProperty(n); else el.style.setProperty(n, v[n]); });
    });
    // le halo de tête (.v2-halo, frère de l'accueil, fixé sur la fenêtre) lit --accent et --halo : on les pose sur lui seul
    var hl = document.querySelector('.v2-halo');
    if (hl) {
      var hv = { '--accent': t.c, '--halo': t.h, '--vr-ciel': t.ci, '--vr-ciel-g': t.cg, '--vr-ciel-d': t.cd };
      Object.keys(hv).forEach(function (n) { if (d) hl.style.removeProperty(n); else hl.style.setProperty(n, hv[n]); });
    }
  }
  // Le navigateur d'abord (premier dessin immédiat), la ligne Supabase ensuite.
  function u2S() {
    if (!_u2.S || _u2.id !== u2Id()) {
      _u2.id = u2Id(); _u2.dist = false; _u2.modifie = false;
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(u2Cle()) || 'null'); } catch (e) { raw = null; }
      _u2.S = u2Net(raw);
    }
    return _u2.S;
  }
  // Écriture : navigateur tout de suite, base après 800 ms de calme (un seul envoi pour une rafale), échec silencieux.
  function u2Garder() {
    _u2.modifie = true;
    try { localStorage.setItem(u2Cle(), JSON.stringify(_u2.S)); localStorage.setItem(u2Cle() + ':attente', '1'); } catch (e) {}
    clearTimeout(_u2.timer); _u2.timer = setTimeout(u2Envoyer, 800);
  }
  function u2Envoyer() {
    try {
      var c = V2.sb && V2.sb(); if (!c || !V2.user) return;
      var cle = u2Cle();
      c.from('profils').upsert({ scope_type: 'groupement', scope_id: u2ScopeId(), data: _u2.S, updated_by: V2.user.id,
        updated_by_name: V2.user.name || '', updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })
        .then(function (u) { if (!(u && u.error)) { try { localStorage.removeItem(cle + ':attente'); } catch (e) {} } }, function () {});
    } catch (e) {}
  }
  // La ligne de la base n'est lue qu'une fois par chargement de page ; si le navigateur a du neuf
  // (changement fait avant la réponse, ou envoi resté en attente), c'est lui qui part vers la base.
  function u2Distant() {
    if (_u2.dist || !V2.user) return;
    var c = V2.sb && V2.sb(); if (!c) return;
    _u2.dist = true;
    var id = u2Id();
    try {
      c.from('profils').select('data').eq('scope_type', 'groupement').eq('scope_id', u2ScopeId()).maybeSingle().then(function (r) {
        if (u2Id() !== id || !r || r.error) return;
        var attente = false; try { attente = localStorage.getItem(u2Cle() + ':attente') === '1'; } catch (e) {}
        if (attente || _u2.modifie) { u2Envoyer(); return; }
        if (!r.data || !r.data.data) return;
        _u2.S = u2Net(r.data.data);
        try { localStorage.setItem(u2Cle(), JSON.stringify(_u2.S)); } catch (e) {}
        if (_u2.monte) u2Redessiner();
      }, function () {});
    } catch (e) {}
  }

  // ── Les outils disponibles dans l'espace courant (mêmes filtres que l'ancien accueil), dans l'ordre réel des ouvertures ──
  function u2Cles() {
    var escale = u2Escale();
    return g4Classer(G4_REPLI.filter(function (k) {
      var d = G4_PORTES[k];
      if (!d) return false;
      if (k === 'lgo' && escale) return false;       // pas de « Logiciels officine » en Escale
      return k === 'academy' || !!V2.pages[d.page];  // un outil dont l'écran n'est pas chargé n'apparaît pas
    }));
  }
  function u2Outil(k) {
    var d = G4_PORTES[k];
    var o = { k: k, nom: d.nom, ph: (u2Escale() && _g4Esc[k]) ? _g4Esc[k] : d.ph, act: 'go:' + k, href: '#' + k };
    if (k === 'groupements') { o.act = 'go:pharma/groupements'; o.href = '#pharma/groupements'; }
    else if (k === 'reforme2027') { o.act = 'doc:reforme2027'; o.href = '#pilotage'; }   // document privé : s'ouvre dans le geste du clic
    else if (k === 'academy') { o.act = ''; o.href = Q_ACADEMY; o.ext = true; }
    return o;
  }
  function u2Fam(f, cles) {
    var l = cles.filter(function (k) { return G4_PORTES[k].fam === f; }), o = (u2S().ordre || {})[f] || [];
    var tete = o.filter(function (k) { return l.indexOf(k) >= 0; });
    return tete.concat(l.filter(function (k) { return tete.indexOf(k) < 0; }));
  }
  function u2Epingles(cles) {
    var l = u2S().epingles;
    if (l === null) return cles.slice(0, 4);
    return l.filter(function (k) { return cles.indexOf(k) >= 0; });
  }
  // Les outils réellement montrés : ceux de l'espace, moins ceux que la personne a masqués (ils restent dans ses réglages).
  function u2Vis() { var m = u2S().masques || []; return u2Cles().filter(function (k) { return m.indexOf(k) < 0; }); }
  function u2FamsOrdre() {
    var o = u2S().fordre || U2_FAMILLES;
    return o.map(function (k) { return U2_FAMS.filter(function (f) { return f[0] === k; })[0]; }).filter(Boolean);
  }
  function u2Etat() {
    var cles = u2Cles(), vis = u2Vis();
    var tous = u2FamsOrdre().map(function (f) { return { k: f[0], nom: f[1], cles: u2Fam(f[0], cles) }; }).filter(function (f) { return f.cles.length; });
    var fams = tous.map(function (f) { return { k: f.k, nom: f.nom, cles: f.cles.filter(function (k) { return vis.indexOf(k) >= 0; }) }; }).filter(function (f) { return f.cles.length; });
    if (_u2.onglet !== 'ep' && !fams.some(function (f) { return f.k === _u2.onglet; })) _u2.onglet = 'ep';
    return { cles: cles, vis: vis, tous: tous, fams: fams, ep: u2Epingles(vis) };
  }
  // « Nouveau » (G4_UNE, décision de Will du 01/10) : lu dans G4_UNE, date de fin comprise ; jamais en Escale ni en OPSO.
  function u2Nouveau(k) {
    var u = G4_UNE, b = window.V2_BRAND || {}, d = new Date();
    var jour = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    return !!(u && u.page === k && !b.escale && !b.opso && V2.pages[u.page] && jour <= u.fin);
  }

  // ── Le centre ──
  function u2Tuile(k, o) {
    o = o || {};
    var t = u2Outil(k);
    return '<a class="v2-tuile u2-in" style="--i:' + (o.i || 0) + '" href="' + esc(t.href) + '"' +
      (t.ext ? ' target="_blank" rel="noopener"' : ' data-u2-act="' + esc(t.act) + '"') + ' data-tool="' + esc(k) + '">' +
      '<span class="v2-tuile-ico">' + u2Ic(k) + '</span>' +
      '<span class="v2-tuile-tx">' + (u2Nouveau(k) ? '<span class="u2-nv">Nouveau</span>' : '') +
        '<span class="v2-tuile-nm">' + esc(t.nom) + '</span><span class="v2-tuile-ds">' + esc(t.ph) + '</span></span>' +
      (o.pin ? u2Ic('pin', 16, 'u2-epi') + '<span class="u2-sr">Épinglé</span>' : '') +
      (t.ext ? '<span class="u2-sr">, s\'ouvre dans un nouvel onglet</span>' : '') +
      u2Ic('chev', 20, 'v2-tuile-chev') + '</a>';
  }
  function u2OngletsHtml(etat) {
    var tabs = [{ k: 'ep', nom: 'Épinglés' }].concat(etat.fams.map(function (f) { return { k: f.k, nom: f.nom }; }));
    return tabs.map(function (t) {
      var sel = _u2.onglet === t.k;
      return '<button type="button" class="v2-tab" role="tab" id="u2-tab-' + t.k + '" aria-selected="' + sel + '" tabindex="' + (sel ? '0' : '-1') +
        '" aria-controls="u2-panneau" data-u2-tab="' + t.k + '">' + esc(t.nom) + '</button>';
    }).join('');
  }
  function u2PanneauHtml(etat) {
    var l = etat.ep;
    if (!etat.vis.length) {
      return '<p class="u2-ep-vide">Tous vos outils sont masqués. ' + (u2Mode()
        ? 'Ouvrez « Mon espace » avec votre avatar, en haut à droite, puis, dans « Tous les outils », allumez l\'interrupteur de chaque outil à réafficher, ou choisissez « Revenir aux réglages d\'origine ».'
        : 'Ouvrez « Outils » dans le rail à gauche, puis, dans « Tous les outils », allumez l\'interrupteur de chaque outil à réafficher, ou choisissez « Revenir aux réglages d\'origine ».') + '</p>';
    }
    if (_u2.onglet !== 'ep') { var f = etat.fams.filter(function (x) { return x.k === _u2.onglet; })[0]; l = f ? f.cles : []; }
    if (!l.length) {
      return '<p class="u2-ep-vide">Aucun outil épinglé. ' + (u2Mode()
        ? 'Ouvrez « Mon espace » avec votre avatar, en haut à droite, pour en épingler.'
        : 'Ouvrez « Outils » dans le rail à gauche pour en épingler.') + '</p>';
    }
    var n = 2;
    return '<div class="u2-tuiles">' + l.map(function (k) { return u2Tuile(k, { i: n++, pin: _u2.onglet !== 'ep' && etat.ep.indexOf(k) >= 0 }); }).join('') + '</div>';
  }
  function u2CompteHtml(m) {
    if (m.partiel) return '<span id="v2-ventes-etat">Chargement des ventes… <b>' + ((V2.ventesProgres && V2.ventesProgres.n) || 0) + '</b> / ' + ((V2.ventesProgres && V2.ventesProgres.total) || '?') + '</span>';
    return '<b>' + u2Nb(m.nb) + '</b> ' + (m.nb > 1 ? 'officines actives' : 'officine active') + (m.mes != null ? ' · vos officines : <b>' + u2Nb(m.mes) + '</b>' : '');
  }
  function u2Salut(m) { return m.salut + (m.prenom ? ' ' + m.prenom : ''); }
  function u2CentreHtml(m, etat) {
    var on = u2OngletsHtml(etat), pa = u2PanneauHtml(etat), co = u2CompteHtml(m);
    _u2.sig.onglets = on; _u2.sig.panneau = pa; _u2.sig.compte = co;
    return '<div class="u2-salut u2-in" style="--i:0"><h1 class="v2-titre" id="u2-salut">' + esc(u2Salut(m)) + '</h1>' +
        '<p class="v2-sous">' + esc(qDateTxt(new Date())) + '</p><p class="v2-sous" id="u2-compte">' + co + '</p></div>' +
      '<div class="v2-tabs u2-in" style="--i:1" role="tablist" aria-label="Familles d\'outils" id="u2-onglets">' + on + '</div>' +
      '<div id="u2-panneau" role="tabpanel" aria-labelledby="u2-tab-' + _u2.onglet + '">' + pa + '</div>';
  }

  // ── La droite : quatre widgets, chacun sur de vraies données ──
  function u2WInfos() {
    var info = qInfosModele();
    if (info.etat === 'charge') return '<p class="u2-vide">Chargement du brief du jour…</p>';
    var cases = [];
    if (info.etat === 'ok') {
      if (info.nb != null) cases.push('<div><b>' + info.nb + '</b><span>' + (info.nb > 1 ? 'nouvelles' : 'nouvelle') + '</span>' + (info.quand === 'auj' ? '' : '<small>' + esc(info.puce) + '</small>') + '</div>');
      if (info.rupt != null) cases.push('<div><b>' + info.rupt + '</b><span>' + (info.rupt > 1 ? 'ruptures en cours' : 'rupture en cours') + '</span></div>');
      if (info.rapp != null) cases.push('<div><b>' + info.rapp + '</b><span>' + (info.rapp > 1 ? 'rappels de produits' : 'rappel de produit') + '</span></div>');
    }
    if (!cases.length) return '<p class="u2-vide">Le brief du jour n\'est pas encore arrivé.</p>';
    return '<div class="u2-cpt" style="--n:' + cases.length + '">' + cases.join('') + '</div>' +
      (V2.pages.infos ? '<a class="u2-lien" href="#infos" data-u2-act="go:infos">Lire le brief du jour' + u2Ic('arrow') + '</a>' : '');
  }
  function u2WTodo() {
    if (!V2.todo || !V2.todo.ouverts) return '<p class="u2-vide">Rien à faire pour l\'instant.</p>';
    if (!_u2.todoPret) return '<p class="u2-vide">Chargement de votre liste…</p>';
    var tous = V2.todo.urgents ? V2.todo.urgents() : V2.todo.ouverts();
    if (!tous.length) return '<p class="u2-vide">Rien à faire pour l\'instant.</p>';
    var h = tous.slice(0, 3).map(function (it) {
      return '<button type="button" class="u2-chk" role="checkbox" aria-checked="false" data-u2-a="todo" data-v="' + esc(it.id) + '">' +
        '<span class="u2-bx"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg></span>' +
        '<span class="u2-t">' + esc(V2.todo.libelle ? V2.todo.libelle(it) : (it.nom || it.note || '')) + '</span></button>';
    }).join('');
    if (tous.length > 3) h += '<a class="u2-lien" href="#todo" data-u2-act="go:todo">+ ' + (tous.length - 3) + (tous.length - 3 > 1 ? ' autres à faire' : ' autre à faire') + u2Ic('arrow') + '</a>';
    return h;
  }
  function u2WRelance() {
    var r = qRelances();
    if (!r.pret) return '<p class="u2-vide">Chargement des relances…</p>';
    if (!r.l.length) return '<p class="u2-vide">Aucune relance à faire.</p>';
    var h = r.l.slice(0, 3).map(function (x) {
      var q = qQuand(x.diff), pid = encodeURIComponent(String(x.pid));
      return '<a class="u2-rel" href="#pharma/' + pid + '" data-u2-act="rel:' + pid + '"><span class="u2-pt2' + (x.diff < 0 ? ' u2-tard' : x.diff === 0 ? ' u2-jour' : '') + '"></span>' +
        '<span class="u2-tx"><b>' + esc(x.name) + '</b><span class="' + (x.diff < 0 ? 'u2-tard-t' : '') + '">' + esc(q.t) + '</span></span></a>';
    }).join('');
    var tot = (_relances || []).filter(function (x) { return x.diff <= 2; }).length;   // le vrai nombre dû, pas seulement les huit gardés
    if (tot > 3) h += '<p class="u2-reste">+ ' + (tot - 3) + (tot - 3 > 1 ? ' autres relances' : ' autre relance') + '</p>';
    return h;
  }
  function u2WSemaine() {
    qRelances();   // lance la lecture des relances si elle n'est pas faite (un point sous chaque jour qui en porte)
    var sem = qSemaine(), pj = qParJour(_relances || [], sem.dow);
    var h = '<div class="u2-sem-m">' + esc(sem.mois + ' ' + new Date().getFullYear()) + '</div><div class="u2-sem" role="list">';
    sem.jours.forEach(function (j, k) {
      var n = pj[k] ? pj[k].length : 0, auj = k === sem.dow;
      var lib = j.lib.charAt(0).toUpperCase() + j.lib.slice(1) + (n ? ' : ' + n + (n > 1 ? ' relances' : ' relance') : '');
      h += '<div role="listitem" class="' + (auj ? 'u2-auj' : '') + '" aria-label="' + esc(lib) + '"' + (auj ? ' aria-current="date"' : '') + '>' + j.n + '<b>' + j.j + '</b><i class="u2-pt' + (n ? ' u2-on' : '') + '"></i></div>';
    });
    return h + '</div>';
  }
  function u2WCorps(k) { return k === 'infos' ? u2WInfos() : k === 'todo' ? u2WTodo() : k === 'relance' ? u2WRelance() : u2WSemaine(); }
  function u2DroiteHtml() {
    var S = u2S(), n = 3, h = '';
    _u2.sigW = {};
    S.wordre.forEach(function (k) {
      if (!S.widgets[k]) return;
      var w = U2_WIDGETS[k], corps = u2WCorps(k);
      _u2.sigW[k] = corps;
      h += '<section class="u2-wid u2-in" data-u2-w="' + k + '" aria-labelledby="u2-wt-' + k + '" style="--i:' + (n++) + '"><div class="u2-wid-h"><h2 id="u2-wt-' + k + '">' + esc(w.nom) + '</h2>' +
        (V2.pages[w.page] ? '<a class="u2-lien" href="#' + w.page + '" data-u2-act="go:' + w.page + '">Ouvrir' + u2Ic('arrow') + '</a>' : '') +
        '</div><div class="u2-wid-c">' + corps + '</div></section>';
    });
    if (!h) h = '<div class="u2-wid u2-in" style="--i:3"><p class="u2-vide">Aucun widget affiché. Réactivez-en dans « Mon espace ».</p></div>';
    _u2.sig.droite = S.wordre.map(function (k) { return k + (S.widgets[k] ? '1' : '0'); }).join(',');
    return h;
  }
  // Remplace le contenu d'un morceau seulement s'il a changé ; le focus revient sur le même élément.
  function u2Poser(id, h, cle) {
    var el = document.getElementById(id);
    if (!el || _u2.sig[cle] === h) return;
    var a = document.activeElement, rep = null;
    if (a && el.contains(a)) rep = a.getAttribute('data-tool') ? '[data-tool="' + a.getAttribute('data-tool') + '"]' : a.id ? '#' + a.id : a.getAttribute('data-u2-act') ? '[data-u2-act="' + a.getAttribute('data-u2-act') + '"]' : null;
    el.innerHTML = h; _u2.sig[cle] = h;
    if (rep) { var n = el.querySelector(rep); if (n) { try { n.focus(); } catch (e) {} } }
  }
  function u2MajWidgets() {
    if (!_u2.monte) return;
    var S = u2S(), dr = document.getElementById('u2-droite');
    if (!dr) return;
    var struct = S.wordre.map(function (k) { return k + (S.widgets[k] ? '1' : '0'); }).join(',');
    if (struct !== _u2.sig.droite) { dr.innerHTML = u2DroiteHtml(); return; }
    S.wordre.forEach(function (k) {
      if (!S.widgets[k]) return;
      var el = dr.querySelector('[data-u2-w="' + k + '"] .u2-wid-c'); if (!el) return;
      var h = u2WCorps(k);
      if (_u2.sigW[k] === h) return;
      el.innerHTML = h; _u2.sigW[k] = h;
    });
  }
  function u2MajOnglets() { u2Poser('u2-onglets', u2OngletsHtml(u2Etat()), 'onglets'); }
  function u2MajPanneau() {
    var etat = u2Etat(), p = document.getElementById('u2-panneau');
    if (p) p.setAttribute('aria-labelledby', 'u2-tab-' + _u2.onglet);
    u2Poser('u2-panneau', u2PanneauHtml(etat), 'panneau');
  }
  function u2Onglet(k, focus) {
    var etat = u2Etat();
    if (k !== 'ep' && !etat.fams.some(function (f) { return f.k === k; })) k = 'ep';
    _u2.onglet = k;
    [].slice.call(document.querySelectorAll('#u2-onglets [data-u2-tab]')).forEach(function (b) {
      var s = b.getAttribute('data-u2-tab') === k;
      b.setAttribute('aria-selected', String(s)); b.setAttribute('tabindex', s ? '0' : '-1');
    });
    _u2.sig.onglets = u2OngletsHtml(etat);
    u2MajPanneau();
    if (focus) { var b = document.getElementById('u2-tab-' + k); if (b) { try { b.focus(); } catch (e) {} } }
  }

  // ── Le rail (≥ 1100 px) et le tiroir : seulement des réglages ──
  function u2Rubriques() {
    var l = [];
    if (V2.basculeEspace && V2.basculeEspace()) l.push(['espace', 'Espace', 'espace']);
    l.push(['outils', 'Outils', 'grille'], ['widgets', 'Widgets', 'widgets']);
    if (!u2Escale()) l.push(['couleurs', 'Couleurs', 'palette']);   // Escale impose ses couleurs : pas de choix
    l.push(['compte', 'Compte', 'user']);
    return l;
  }
  function u2RailHtml() {
    return u2Rubriques().map(function (r) {
      return '<button type="button" class="u2-rb" data-u2-rail="' + r[0] + '" aria-haspopup="dialog" aria-expanded="false" aria-controls="u2-volet">' + u2Ic(r[2]) + r[1] + '</button>';
    }).join('');
  }
  function u2BlocEspace() {
    if (!(V2.basculeEspace && V2.basculeEspace())) return '';
    var e = u2Escale();
    return '<section class="u2-mon-b"><h3>Espace</h3><div class="v2-tabs u2-plein" role="radiogroup" aria-label="Espace">' +
      '<button type="button" class="v2-tab" role="radio" aria-checked="' + !e + '" data-u2-a="esp" data-v="integral">Intégral</button>' +
      '<button type="button" class="v2-tab" role="radio" aria-checked="' + e + '" data-u2-a="esp" data-v="escale">Escale</button></div>' +
      '<p class="u2-note">Vous travaillez dans l\'espace ' + (e ? 'Escale' : 'Intégral') + '.</p></section>';
  }
  function u2BtnMouv(a, k, nom, i, n) {
    return '<button type="button" class="u2-pbtn" data-u2-a="' + a + 'up" data-v="' + k + '" aria-label="Monter ' + esc(nom) + '"' + (i === 0 ? ' disabled' : '') + '>' + u2Ic('up') + '</button>' +
      '<button type="button" class="u2-pbtn" data-u2-a="' + a + 'dn" data-v="' + k + '" aria-label="Descendre ' + esc(nom) + '"' + (i === n - 1 ? ' disabled' : '') + '>' + u2Ic('down') + '</button>';
  }
  function u2BlocWidgets() {
    var S = u2S();
    return '<section class="u2-mon-b"><h3>Mes widgets</h3>' + S.wordre.map(function (k, i) {
      var nm = U2_WIDGETS[k].nom, on = S.widgets[k];
      return '<div class="u2-mon-ligne"><span class="u2-lb' + (on ? '' : ' u2-off') + '">' + esc(nm) + '</span><span class="u2-fl">' + u2BtnMouv('w', k, nm, i, S.wordre.length) + '</span>' +
        '<button type="button" class="u2-sw" role="switch" aria-checked="' + on + '" aria-label="Afficher ' + esc(nm) + '" data-u2-a="wtog" data-v="' + k + '"><i></i></button></div>';
    }).join('') + '</section>';
  }
  function u2BlocOutils() {
    var etat = u2Etat(), pins = etat.ep;
    var h = '<section class="u2-mon-b"><h3>Mes outils</h3>';
    if (!pins.length) h += '<p class="u2-vide u2-vide-mini">Aucun outil épinglé. Choisissez-en un ci-dessous.</p>';
    pins.forEach(function (k, i) {
      var nm = G4_PORTES[k].nom;
      h += '<div class="u2-mon-ligne"><span class="u2-lb">' + esc(nm) + '</span><span class="u2-fl">' + u2BtnMouv('p', k, nm, i, pins.length) +
        '<button type="button" class="u2-pbtn" aria-pressed="true" data-u2-a="pin" data-v="' + k + '" aria-label="Désépingler ' + esc(nm) + '">' + u2Ic('pin') + '</button></span></div>';
    });
    h += '<div class="v2-select u2-mon-sel"><select data-u2-sel="pin" aria-label="Épingler un outil"><option value="">Épingler un outil…</option>';
    etat.fams.forEach(function (f) {
      var l = f.cles.filter(function (k) { return pins.indexOf(k) < 0; });
      if (l.length) h += '<optgroup label="' + esc(f.nom) + '">' + l.map(function (k) { return '<option value="' + k + '">' + esc(G4_PORTES[k].nom) + '</option>'; }).join('') + '</optgroup>';
    });
    h += '</select>' + u2Ic('down') + '</div></section>';
    return h + u2BlocFamilles(etat);
  }
  // Tous les outils, famille par famille : afficher / masquer, monter / descendre, épingler. Les familles se déplacent aussi.
  function u2BlocFamilles(etat) {
    var S = u2S(), m = S.masques || [];
    var h = '<section class="u2-mon-b"><h3>Tous les outils</h3><p class="u2-note u2-note-h">Un outil masqué disparaît de votre accueil, sans être perdu : vous le réaffichez ici.</p>';
    etat.tous.forEach(function (f, fi) {
      h += '<div class="u2-fam" role="group" aria-label="' + esc(f.nom) + '"><div class="u2-fam-h"><span class="u2-lb">' + esc(f.nom) + '</span><span class="u2-fl">' + u2BtnMouv('f', f.k, f.nom, fi, etat.tous.length) + '</span></div>';
      f.cles.forEach(function (k, i) {
        var nm = G4_PORTES[k].nom, on = m.indexOf(k) < 0, ep = etat.ep.indexOf(k) >= 0;
        h += '<div class="u2-mon-ligne"><span class="u2-lb' + (on ? '' : ' u2-off') + '">' + esc(nm) + '</span><span class="u2-fl">' + u2BtnMouv('o', k, nm, i, f.cles.length) +
          '<button type="button" class="u2-pbtn" aria-pressed="' + ep + '" data-u2-a="fpin" data-v="' + k + '" aria-label="' + (ep ? 'Désépingler ' : 'Épingler ') + esc(nm) + '"' + (on ? '' : ' disabled') + '>' + u2Ic('pin') + '</button></span>' +
          '<button type="button" class="u2-sw" role="switch" aria-checked="' + on + '" aria-label="Afficher ' + esc(nm) + '" data-u2-a="mtog" data-v="' + k + '"><i></i></button></div>';
      });
      h += '</div>';
    });
    return h + '</section>';
  }
  // Les sept teintes : pastilles rondes de 48 px, nom écrit à côté, coche sur la teinte active (boutons radio, flèches du clavier).
  function u2BlocCouleurs() {
    if (u2Escale()) return '';
    var cur = u2Teinte().k;
    return '<section class="u2-mon-b"><h3>Teinte d\'accent</h3><div class="u2-coul" role="radiogroup" aria-label="Couleur d\'accent">' + U2_TEINTES.map(function (t) {
      var on = t.k === cur;
      return '<button type="button" class="u2-co" role="radio" aria-checked="' + on + '" tabindex="' + (on ? '0' : '-1') + '" data-u2-a="coul" data-v="' + t.k + '">' +
        '<span class="u2-pas' + (t.m ? ' u2-pas-m"' : '" style="background:' + t.c + '"') + '>' + (on ? u2Ic('check') : '') + '</span><span class="u2-co-nm">' + esc(t.nom) + '</span></button>';
    }).join('') + '</div><p class="u2-note">Le fond reste clair. La couleur s\'applique à votre accueil.</p></section>';
  }
  // Un seul retour aux réglages d'origine, avec confirmation dans le tiroir (jamais la boîte du navigateur).
  function u2BlocReset() {
    if (_u2.confirmer) {
      return '<section class="u2-mon-b u2-rz" role="group" aria-label="Revenir aux réglages d\'origine"><p class="u2-note u2-note-h"><b>Tout remettre comme au départ ?</b> Vos couleurs, vos outils épinglés, masqués et rangés, et vos widgets reviennent aux réglages d\'origine.</p>' +
        '<div class="u2-rz-b"><button type="button" class="v2-btn v2-btn-primary" data-u2-a="rzoui">Oui, tout remettre</button><button type="button" class="v2-btn v2-btn-ghost" data-u2-a="rznon">Annuler</button></div></section>';
    }
    return '<section class="u2-mon-b u2-rz"><button type="button" class="v2-btn v2-btn-ghost u2-rz-go" data-u2-a="rz">Revenir aux réglages d\'origine</button></section>';
  }
  // Les mêmes gestes que le menu du compte de la barre (V2.userMenu), et seulement ceux qui existent sur cet appareil.
  function u2BlocCompte() {
    var nom = (V2.user && V2.user.name) || '', br = window.V2_BRAND || {};
    var ini = nom ? nom.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() : '';
    return '<section class="u2-mon-b"><h3>Mon compte</h3><div class="u2-mon-compte"><span class="v2-av">' + esc(ini) + '</span><div><b>' + esc(nom || 'Utilisateur') + '</b><span>' + esc(br.sub || 'Espace commercial') + '</span></div></div>' +
      (u2Installee() ? '' : '<button type="button" class="u2-mon-act" data-u2-a="install">' + u2Ic('download') + 'Installer l\'application</button>') +
      '<div class="u2-eto" id="u2-eto"></div>' +
      '<button type="button" class="u2-mon-act u2-danger" data-u2-a="logout">' + u2Ic('logout') + 'Se déconnecter</button>' +
      '<p class="u2-note">' + esc(NOTE_USAGE) + '</p></section>';
  }
  function u2VoletRendre() {
    var v = document.getElementById('u2-volet'); if (!v) return;
    var t, h;
    if (u2Mode()) { t = 'Mon espace'; h = u2BlocEspace() + u2BlocWidgets() + u2BlocCouleurs() + u2BlocOutils() + u2BlocReset() + u2BlocCompte(); }
    else {
      var s = _u2.sec || 'outils';
      if (s === 'espace' && !(V2.basculeEspace && V2.basculeEspace())) s = 'outils';
      if (s === 'couleurs' && u2Escale()) s = 'outils';
      _u2.sec = s;
      t = s === 'espace' ? 'Espace' : s === 'outils' ? 'Outils' : s === 'widgets' ? 'Widgets' : s === 'couleurs' ? 'Couleurs' : 'Compte';
      h = s === 'espace' ? u2BlocEspace() : s === 'outils' ? u2BlocOutils() + u2BlocReset() : s === 'widgets' ? u2BlocWidgets() : s === 'couleurs' ? u2BlocCouleurs() + u2BlocReset() : u2BlocCompte();
    }
    document.getElementById('u2-vt').textContent = t;
    document.getElementById('u2-mon').innerHTML = h;
    var e = document.getElementById('u2-eto');
    if (e && V2.etonnement && V2.etonnement.menu) { try { V2.etonnement.menu(e); } catch (x) {} }
  }
  function u2Rail() {
    var mode = u2Mode();
    [].slice.call(document.querySelectorAll('[data-u2-rail]')).forEach(function (b) {
      b.setAttribute('aria-expanded', String(!!(_u2.ouvert && !mode && _u2.sec === b.getAttribute('data-u2-rail'))));
    });
    var av = document.querySelector('.u2-page .tp-avb');
    if (av) av.setAttribute('aria-expanded', String(!!(_u2.ouvert && mode)));
  }
  function u2Verrou(on) { try { document.body.style.overflow = on ? 'hidden' : ''; } catch (e) {} }
  function u2PremierFocus() {
    var v = document.getElementById('u2-volet'); if (!v) return;
    var l = [].slice.call(v.querySelectorAll('button:not([disabled]),a[href],select')).filter(function (x) { return x.getClientRects().length; });
    if (l[0]) { try { l[0].focus(); } catch (e) {} }
  }
  function u2Ouvrir(sec, btn) {
    var v = document.getElementById('u2-volet'), f = document.getElementById('u2-fond');
    if (!v) return;
    var mode = u2Mode();
    if (_u2.ouvert && (mode || sec === _u2.sec)) { u2Fermer(true); return; }
    _u2.sec = mode ? null : sec; _u2.opener = btn || null;
    _u2.ouvert = true; _u2.confirmer = false;
    u2VoletRendre();
    // ni `visibility` ni transition de visibilité : WebKit laissait « hidden » sur une partie du contenu (le menu « Épingler un outil »)
    clearTimeout(_u2.tFerme);
    v.classList.add('u2-vu'); void v.offsetWidth; v.classList.add('on');
    if (f) f.classList.add('on');
    if (mode) u2Verrou(true);
    u2Rail();
    setTimeout(u2PremierFocus, 30);
  }
  function u2Fermer(rendre) {
    if (!_u2.ouvert) return;
    var v = document.getElementById('u2-volet'), f = document.getElementById('u2-fond');
    _u2.ouvert = false; _u2.confirmer = false;
    if (v) { v.classList.remove('on'); clearTimeout(_u2.tFerme); _u2.tFerme = setTimeout(function () { if (!_u2.ouvert) v.classList.remove('u2-vu'); }, 320); }
    if (f) f.classList.remove('on');
    u2Verrou(false); u2Rail();
    var o = _u2.opener; _u2.opener = null;
    if (rendre !== false && o && document.contains(o)) { try { o.focus(); } catch (e) {} }
  }
  // Le bouton « avatar » de la barre : sous 1100 px il ouvre le panneau « Mon espace » (appelé par V2.userMenu).
  function u2PanneauAvatar(btn) {
    if (!_u2.monte || !(V2.route && V2.route.name === 'home') || !u2Mode() || !document.getElementById('u2-volet')) return false;
    u2Ouvrir(null, btn);
    return true;
  }

  // ── Les gestes des réglages : agir, garder, redessiner, rendre le focus ──
  function u2Echange(tous, vis, k, d) {
    var i = vis.indexOf(k), j = i + d;
    if (i < 0 || j < 0 || j >= vis.length) return;
    var a = tous.indexOf(k), b = tous.indexOf(vis[j]);
    if (a < 0 || b < 0) return;
    var t = tous[a]; tous[a] = tous[b]; tous[b] = t;
  }
  function u2Agir(a, v, el) {
    var S = u2S(), cles = u2Cles(), vis = u2Vis();
    if (a === 'install') { u2Fermer(false); V2.installApp(); return; }
    if (a === 'logout') { u2Fermer(false); V2.signOut(); return; }
    if (a === 'esp') { if ((v === 'escale') !== u2Escale()) V2.goSpace(v === 'escale' ? 'escale' : 'crm'); return; }
    if (a === 'todo') {
      var fait = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', String(fait));
      if (V2.todo && V2.todo.cocher) V2.todo.cocher(v, fait);
      return;
    }
    if (a === 'rz') { _u2.confirmer = true; u2Redessiner(a, v); return; }
    if (a === 'rznon') { _u2.confirmer = false; u2Redessiner(a, v); return; }
    if (a === 'rzoui') { _u2.confirmer = false; _u2.S = u2Def(); }
    else if (a === 'coul') { if (!U2_TEINTES.some(function (t) { return t.k === v; })) return; S.couleur = v; }
    else if (a === 'mtog') {
      if (!G4_PORTES[v] || G4_PORTES[v].retire) return;
      var im = S.masques.indexOf(v); if (im < 0) S.masques.push(v); else S.masques.splice(im, 1);
    }
    else if (a === 'oup' || a === 'odn') {
      if (!G4_PORTES[v] || G4_PORTES[v].retire) return;
      var fa = G4_PORTES[v].fam, lo = u2Fam(fa, cles).slice();
      u2Echange(lo, lo, v, a === 'oup' ? -1 : 1); S.ordre[fa] = lo;
    }
    else if (a === 'fup' || a === 'fdn') {
      var te = u2Etat().tous.map(function (f) { return f.k; }), lf = S.fordre.filter(function (k) { return te.indexOf(k) >= 0; });
      u2Echange(S.fordre, lf, v, a === 'fup' ? -1 : 1);
    }
    else if (a === 'wtog') S.widgets[v] = !S.widgets[v];
    else if (a === 'wup' || a === 'wdn') u2Echange(S.wordre, S.wordre, v, a === 'wup' ? -1 : 1);
    else if (a === 'pin' || a === 'fpin' || a === 'pup' || a === 'pdn') {
      if (S.epingles === null) S.epingles = u2Epingles(vis);
      if (a === 'pin' || a === 'fpin') { var i = S.epingles.indexOf(v); if (i < 0) S.epingles.push(v); else S.epingles.splice(i, 1); }
      else u2Echange(S.epingles, u2Epingles(vis), v, a === 'pup' ? -1 : 1);
    } else return;
    u2Garder();
    u2Redessiner(a, v);
  }
  function u2Redessiner(a, v) {
    u2PoserTeinte(); u2MajOnglets(); u2MajPanneau(); u2MajWidgets(); u2VoletRendre();
    if (!a) return;
    var vo = document.getElementById('u2-volet'); if (!vo) return;
    var alt = { wup: 'wdn', wdn: 'wup', pup: 'pdn', pdn: 'pup', oup: 'odn', odn: 'oup', fup: 'fdn', fdn: 'fup' };
    var foc = { rz: 'rznon', rzoui: 'rz', rznon: 'rz' };   // la confirmation : le focus va au bouton « Annuler », puis revient sur « Revenir… »
    var n = vo.querySelector('[data-u2-a="' + (foc[a] || a) + '"]' + (foc[a] ? '' : '[data-v="' + v + '"]'));
    if (n && n.disabled) n = alt[a] ? vo.querySelector('[data-u2-a="' + alt[a] + '"][data-v="' + v + '"]') : null;
    if (!n || n.disabled) n = vo.querySelector('select') || vo.querySelector('button:not([disabled])');
    if (n) { try { n.focus(); } catch (e) {} }
  }

  function qAgir(act) {
    var i = act.indexOf(':'), t = act.slice(0, i), v = act.slice(i + 1);
    if (t === 'go') { var p = v.split('/'); if (p[1]) V2.go(p[0], p[1]); else V2.go(p[0]); }
    else if (t === 'rel') V2.go('pharma', decodeURIComponent(v));
    else if (t === 'doc') V2.ouvrirDocProtege(v);
    else if (t === 'space') V2.goSpace(v);
  }

  // ── Les écouteurs : posés une fois sur la racine, ils ignorent tout ce qui n'est pas dans l'accueil ──
  function u2Clic(e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.u2-page, .u2-hors')) return;
    var b;
    if ((b = t.closest('[data-u2-rail]'))) { u2Ouvrir(b.getAttribute('data-u2-rail'), b); return; }
    if ((b = t.closest('[data-u2-tab]'))) { u2Onglet(b.getAttribute('data-u2-tab'), true); return; }
    if (t.closest('[data-u2-fermer]') || t.closest('#u2-fond')) { u2Fermer(true); return; }
    if ((b = t.closest('[data-u2-a]'))) { u2Agir(b.getAttribute('data-u2-a'), b.getAttribute('data-v'), b); return; }
    if ((b = t.closest('[data-u2-act]'))) {
      // un vrai lien : clic avec modificateur = nouvel onglet, laissé au navigateur ; sinon l'écran change tout de suite
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault(); qAgir(b.getAttribute('data-u2-act')); return;
    }
    if (t.closest('[data-u2-skip]')) { var c = document.getElementById('u2-centre'); if (c) c.focus(); }
  }
  function u2Change(e) {
    var s = e.target && e.target.closest && e.target.closest('[data-u2-sel="pin"]');
    if (!s || !s.value || !s.closest('.u2-page, .u2-hors')) return;
    var k = s.value, S = u2S();
    if (!G4_PORTES[k] || G4_PORTES[k].retire) return;
    if (S.epingles === null) S.epingles = u2Epingles(u2Vis());
    if (S.epingles.indexOf(k) < 0) S.epingles.push(k);
    u2Garder(); u2Redessiner('pin', k);
    var n = document.querySelector('#u2-volet select'); if (n) { try { n.focus(); } catch (x) {} }
  }
  function u2Touche(e) {
    var t = e.target; if (!t || !t.closest || !t.closest('.u2-page, .u2-hors')) return;
    if (e.key === 'Escape' && _u2.ouvert) { e.preventDefault(); u2Fermer(true); return; }
    var co = t.closest('[data-u2-a="coul"]');
    if (co && ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].indexOf(e.key) >= 0) {
      var lc = [].slice.call(document.querySelectorAll('#u2-volet [data-u2-a="coul"]')), ic = lc.indexOf(co);
      var nx = lc[(ic + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + lc.length) % lc.length];
      e.preventDefault(); u2Agir('coul', nx.getAttribute('data-v'), nx); return;
    }
    var b = t.closest('[data-u2-tab]');
    if (!b || ['ArrowRight', 'ArrowLeft', 'Home', 'End'].indexOf(e.key) < 0) return;
    var tous = [].slice.call(document.querySelectorAll('#u2-onglets [data-u2-tab]')), i = tous.indexOf(b);
    var k = e.key === 'Home' ? 0 : e.key === 'End' ? tous.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tous.length) % tous.length;
    e.preventDefault(); u2Onglet(tous[k].getAttribute('data-u2-tab'), true);
  }
  function u2Redim() {
    if (!_u2.monte) return;
    var m = u2Mode(); if (m === _u2.mode) return;
    _u2.mode = m;
    if (_u2.ouvert) u2Fermer(false);
    u2VoletRendre(); u2MajPanneau(); u2Rail();
  }
  function u2Lier(root) {
    if (_u2.lie === root) return;
    _u2.lie = root;
    root.addEventListener('click', u2Clic);
    root.addEventListener('change', u2Change);
    root.addEventListener('keydown', u2Touche);
    window.addEventListener('resize', u2Redim);
  }

  // Le classement des ouvertures arrive après le premier dessin : les outils se rangent en place, sans rejouer l'entrée.
  function g4Rafraichir() {
    if (_u2.monte && V2.route && V2.route.name === 'home') { u2MajOnglets(); u2MajPanneau(); if (_u2.ouvert) u2VoletRendre(); }
  }
  function u2Demonter() {
    if (_u2.ouvert) u2Fermer(false);
    u2Verrou(false);
    _u2.monte = false;
    var hl = document.querySelector('.v2-halo'); if (hl) hl.removeAttribute('style');   // le halo des autres écrans reprend ses valeurs
    var h = document.getElementById('u2-hors'); if (h && h.parentNode) h.parentNode.removeChild(h);
  }
  // Monte l'accueil, ou met ses données à jour en place s'il est déjà à l'écran.
  // V2.render() est rappelé quand les relances arrivent et quand les ventes finissent : rien ne se redessine en entier.
  function u2Maj(m) {
    u2PoserTeinte();   // V2.render() remet --accent à la racine à chaque passage
    var h = document.getElementById('u2-salut');
    if (h && h.textContent !== u2Salut(m)) h.textContent = u2Salut(m);
    u2Poser('u2-compte', u2CompteHtml(m), 'compte');
    u2MajOnglets(); u2MajPanneau(); u2MajWidgets();
  }
  function u2Accueil(root, m) {
    if (_u2.monte && root.querySelector('.u2-page')) { u2Maj(m); return; }
    u2S(); g4ChargerOrdre(); qInfosCharger();
    var cascade = !_u2.entree;   // la courte entrée ne joue qu'une fois par chargement de page
    _u2.entree = true; _u2.ouvert = false; _u2.opener = null; _u2.sec = null; _u2.sig = {}; _u2.mode = u2Mode();
    u2Verrou(false);
    var etat = u2Etat();
    root.innerHTML = '<div class="u2-page' + (cascade ? ' u2-cascade' : '') + '"' + u2StyleAttr() + '>' +
      '<button type="button" class="u2-skip" data-u2-skip>Aller aux outils</button>' + topbar() +
      '<div class="u2-grille">' +
        '<nav class="u2-rail" aria-label="Mon espace" id="u2-rail">' + u2RailHtml() + '</nav>' +
        '<main class="u2-centre" id="u2-centre" tabindex="-1">' + u2CentreHtml(m, etat) + '</main>' +
        '<aside class="u2-droite" id="u2-droite" aria-label="Aperçu de la journée">' + u2DroiteHtml() + '</aside>' +
      '</div>' +
      '</div>';
    // Le fond et le tiroir vivent sur <body> : la racine de l'app porte une transformation d'entrée (v2-motion.js, mo-view-in)
    // qui ferait de chaque élément « fixed » un élément collé à la PAGE entière, et non à la fenêtre.
    var vieux = document.getElementById('u2-hors'); if (vieux && vieux.parentNode) vieux.parentNode.removeChild(vieux);
    var hors = document.createElement('div'); hors.id = 'u2-hors'; hors.className = 'u2-hors';
    var sty = u2StyleAttr(); if (sty) hors.setAttribute('style', sty.replace(/^ style="|"$/g, ''));
    hors.innerHTML = '<div class="u2-fond" id="u2-fond"></div>' +
      '<aside class="u2-volet" id="u2-volet" role="dialog" aria-labelledby="u2-vt"><div class="u2-volet-t"><h2 id="u2-vt">Mon espace</h2><button type="button" class="v2-btn v2-btn-ghost" data-u2-fermer>Fermer</button></div><div class="u2-mon" id="u2-mon"></div></aside>';
    document.body.appendChild(hors);
    hors.addEventListener('click', u2Clic); hors.addEventListener('change', u2Change); hors.addEventListener('keydown', u2Touche);
    _u2.monte = true;
    u2PoserTeinte();
    u2VoletRendre();
    u2Lier(root);
    if (cascade) setTimeout(function () { var p = document.querySelector('.u2-cascade'); if (p) p.classList.remove('u2-cascade'); }, 900);
    u2Distant();
    if (V2.todo && V2.todo.charger && !_u2.todoPret) V2.todo.charger().then(function () { _u2.todoPret = true; u2MajWidgets(); }, function () {});
  }

  // Spotlight : la souris met à jour --mx/--my sur la tuile survolée
  V2.homeSpot = function (e, el) {
    try {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    } catch (err) {}
  };

  // 11/09/2026 — perf : CA par officine calculé en UNE passe sur les ventes et
  // mémorisé sur la référence de V2.sales. Avant : 690 × filter() sur ~600 000
  // ventes à CHAQUE retour à l'accueil (≈ 1 s sur Mac, plusieurs sur iPhone).
  // 24/09/2026 — confidentialité : un commercial restreint n'additionne que SES officines.
  var _caByPid = null, _caRef = null, _caUser = null;
  V2.caByPharma = function () {
    if (_caByPid && _caRef === V2.sales && _caUser === V2.user) return _caByPid;
    _caUser = V2.user;
    var m = {}, S = V2.ventesVisibles ? V2.ventesVisibles(V2.sales || []) : (V2.sales || []);
    for (var i = 0; i < S.length; i++) { var s = S[i]; m[s.pharmacyId] = (m[s.pharmacyId] || 0) + (s.mntNetHt || 0); }
    _caByPid = m; _caRef = V2.sales; return m;
  };
  // 11/09/2026 (phase 5) — appelé par v2-boot.js quand l'en-tête des officines
  // est exécuté et que les tranches de ventes commencent : on rend l'accueil
  // tout de suite (V2.render sait qu'il est partiel), et on tient à jour le
  // compteur « Chargement des ventes… n / 28 » sans re-rendre.
  V2.onOfficinesPretes = function () {
    if (!V2.user || V2.route.name !== 'home') return;
    V2.render();
  };
  V2.onVentesProgres = function (n, total) {
    var el = document.getElementById('v2-ventes-etat');
    if (el) el.innerHTML = 'Chargement des ventes… <b>' + n + '</b> / ' + total;
  };
  V2.pages.home = {
    needs: [],   // audité 11/09/2026 : l'accueil ne lit ni BENCHMARK ni PROD_STATS
    render: function (root) {
      injectHomeStyles();
      var phs = V2.pharmacies || [];
      // Phase 5 : accueil dessiné avant la fin des ventes — les chiffres qui en
      // dépendent (officines actives, CA du Pilotage) s'affichent en attente,
      // jamais à « 0 » : un zéro ressemblerait à un vrai zéro.
      var partiel = !!V2.ventesEnCours;
      // pharmacies récentes : par CA décroissant (proxy d'activité)
      var caOf = V2.caByPharma();
      var withCa = phs.map(function (p) {
        return { p: p, ca: caOf[p.id] || 0 };
      }).filter(function (x) { return x.ca > 0; }).sort(function (a, b) { return b.ca - a.ca; });
      var nbPharma = withCa.length;
      var caTotal = withCa.reduce(function (s, x) { return s + x.ca; }, 0);
      var today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      // Personnalisation par compte connecté (22/09/2026) : « ses » officines,
      // jamais de prénom en dur ailleurs que via V2.user.name. Même critère
      // que le reste de l'app (relanceEstAMoi, v2-pilotage.js) : un commercial
      // renseigné ET qui ne voit pas tout le monde.
      var isBrandApart = !!(window.V2_BRAND && window.V2_BRAND.opso);
      var uComm = (V2.user && V2.user.commercial) ? String(V2.user.commercial) : '';
      var voitTous = !!(V2.user && V2.user.voitTous);
      var mesOfficines = (!isBrandApart && uComm && !voitTous)
        ? phs.filter(function (p) { return (p.comms || []).indexOf(uComm) >= 0; }).length : null;
      function hxNum(n) { try { return n.toLocaleString('fr-FR'); } catch (e) { return String(n); } }

      var P = [
        { k: 'pharma', cls: 'p1', ico: 'opp', tag: 'RDV', t: 'Officines', d: 'Arrive sur une officine et vois direct quoi proposer : ses best, ce qu\'elle ne commande pas, son audit marge — classé par catégorie et tranche de prix.', go: 'Choisir une pharmacie' },
        { k: 'produits', cls: 'p3', ico: 'cat', tag: 'Catalogue', t: 'Produits', d: 'Le catalogue des 7 établissements : stock de chaque site, nos ventes face à la France, et les officines à qui proposer chaque produit.', go: 'Ouvrir les produits' },
        // Entrée UNIQUE des produits (11/08/2026). Remplace la tuile Catalogue ;
        // les tuiles « Par molécule » et « Appro » sont retirées plus bas. Les
        // trois écrans restent atteignables depuis Produits et depuis ⌘K.
        { k: 'offilog', cls: 'p5', accent: '#345DA0', ico: 'spark', tag: 'Parapharmacie', t: 'Offilog', d: 'La centrale parapharmacie d\'Intégral, rayon par rayon : ton prix d\'achat, la photo produit, et où un concurrent casse les prix.', go: 'Ouvrir Offilog' },
        { k: 'pilotage', cls: 'p4', ico: 'pilo', tag: partiel ? '…' : V2.fmtK(caTotal) + ' €', t: 'Pilotage', d: 'Ton chiffre d\'affaires, ta marge pharmacien, tes objectifs et qui commande quoi. Le tableau de bord de ta tournée.', go: 'Voir mon pilotage' },
      ];
      // Infos du matin (brief quotidien) — app JARVIS
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.infos) {
        P.push({ k: 'infos', cls: 'p6', accent: 'var(--c-amber)', ico: 'spark', tag: 'Quotidien', t: 'Infos du matin', d: 'Le mur du matin : échéances de marge, sanctions, concurrents au registre, officines en difficulté — puis l\'essentiel en 30 secondes et 30 sources gratuites résumées.', go: 'Lire le matin' });
      }
      // LA CARTE (ex-« Copilote », renommée le 27/08/2026 à la demande de Will).
      // L'ancien nom reste une route valide (#copilote → carte) pour les favoris.
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.carte) {
        P.push({ k: 'carte', cls: 'p1', accent: 'var(--ip-blue)', ico: 'pharma', tag: 'Terrain', t: 'La carte', d: 'Toutes les officines de France : tes clients, les prospects autour, un clic pour la fiche, un autre pour la tournée du jour.', go: 'Ouvrir la carte' });
      }
      // Tuile « Par molécule » retirée le 11/08/2026 : l'écran existe toujours,
      // il est atteignable depuis Produits (lien de bas de page) et depuis ⌘K.
      // Base Biosimilaires (marché FR × réseau IP) — app JARVIS
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.biosimilaires) {
        P.push({ k: 'biosimilaires', cls: 'p3', accent: '#6D4FC4', ico: 'cat', tag: 'Marché FR', t: 'Biosimilaires', d: 'La base complète des biosimilaires France : substituables en officine et labos partenaires (Zentiva, EG, Teva) en tête, croisés à tes ventes et stocks réseau.', go: 'Ouvrir la base' });
      }
      // Missions rémunérées — app JARVIS (l'Audit marge n'a plus de tuile : retiré le 02/10/2026)
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.audit) {
        P.push({ k: 'missions', cls: 'p4', accent: '#0E9E6A', ico: 'pilo', tag: 'Expert 360', t: 'Missions rémunérées', d: 'La rémunération de l\'officine au-delà du produit : vaccination, entretiens, BPM, TROD… les tarifs 2026 + un simulateur « combien elle peut gagner ». L\'argument d\'expert à montrer au pharmacien.', go: 'Ouvrir les missions' });
      }
      // Appro Intégral : tuile retirée le 11/08/2026, rétablie le 02/09/2026 à la demande
      // de Will. Motif du retour : l'écran a reçu « La courbe » (prévision du marché à
      // 3/6/12 mois) et ⌘K seul ne suffit pas — une feature sans porte visible reste
      // introuvable, y compris pour le reste de l'équipe.
      // ⚠️ Bloc à part, conditionné sur V2.pages.appro : placée dans le bloc « Audit
      // marge », la tuile aurait disparu avec lui.
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.appro) {
        P.push({ k: 'appro', cls: 'p5', accent: '#6D5AE6', ico: 'spark', tag: 'Achats', t: 'Appro Intégral', d: 'Ce qu\'il faut acheter et quand : couverture de stock par référence, ruptures à sécuriser, et la courbe du marché à 3, 6 et 12 mois avec sa fourchette — pour pré-acheter au bon moment et négocier avec les laboratoires.', go: 'Ouvrir l\'appro' });
      }
      // Concurrents — UNE entrée depuis le 14/09/2026 (demande de Will) : grossistes,
      // leurs prix et l'actualité du secteur. L'ex-tuile « Grossistes concurrents »
      // est fondue dedans (#grossistes redirige). Conditions de tiers : jamais côté OPSO.
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.concurrents) {
        P.push({ k: 'concurrents', cls: 'p5', accent: '#0E7C86', ico: 'spark', tag: 'Veille', t: 'Concurrents', d: 'Tout sur les concurrents au même endroit, en trois questions : qui sont les grossistes, à quel prix ils vendent face à notre net, et quoi de neuf dans le secteur.', go: 'Ouvrir les concurrents' });
      }
      // Remontées équipe (mur d'idées interne) — app JARVIS
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.remontees) {
        P.push({ k: 'remontees', cls: 'p6', accent: '#7C3AED', ico: 'spark', tag: 'Équipe', t: 'Remontées', d: 'Le mur d\'idées de l\'équipe : propose une amélioration de l\'appli, vote pour celles des autres, suis leur avancement.', go: 'Voir les remontées' });
      }
      // Prise de RDV par mailing — app JARVIS
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.rdv) {
        P.push({ k: 'rdv', cls: 'p1', accent: '#0050E6', ico: 'cal', tag: 'Terrain', t: 'Rendez-vous', d: 'Envoie un lien de réservation à une officine : elle choisit son créneau elle-même, calé sur la géographie de ta journée. L\'invitation part dans ton agenda.', go: 'Voir mes rendez-vous' });
      }
      // Pilier marketing : uniquement en mode OPSO (module v2-marketing chargé)
      if (window.V2_BRAND && window.V2_BRAND.opso && V2.pages.marketing) {
        P.splice(2, 0, { k: 'marketing', cls: 'p2', ico: 'fiche', tag: 'A4', t: 'Fiches marketing OPSO', d: 'Le catalogue : les produits classés par nombre de pharmacies qui les commandent, avec PPHT et prix net, prêt à imprimer.', go: 'Ouvrir le catalogue' });
      } else if (V2.pages.marketing) {
        // App JARVIS : espace Marketing de Pauline & Will (supports + sélections à pousser)
        P.splice(3, 0, { k: 'marketing', cls: 'p6', accent: '#E0556E', ico: 'spark', tag: 'Pauline & Will', t: 'Marketing', d: 'Fabriquez vos supports (flyers produits avec photos et prix) et vos sélections à pousser aux pharmacies. À deux, au même endroit.', go: 'Ouvrir le marketing' });
      }
      // Groupements : fusionné dans le Copilote (carte unique + outils terrain). Plus de carte séparée.
      // Mode OPSO : le suivi groupement passe en tête (1ʳᵉ tuile de l'accueil)
      if (window.V2_BRAND && window.V2_BRAND.opso) {
        var piIdx = P.map(function (x) { return x.k; }).indexOf('pilotage');
        if (piIdx >= 0) {
          var pil = P.splice(piIdx, 1)[0];
          pil.t = 'Suivi groupement';
          pil.d = 'Le tableau de bord OPSO Santé : taux d\'activation des adhérents, CA du groupement, répartition par périmètre et détail par officine.';
          pil.go = 'Voir le suivi';
          // 29/09/2026 — le bloc « le cap » (V2.opsoGroupement) affiche déjà ce
          // même cumul HT en gros au-dessus des tuiles : le tag CA de cette
          // tuile ferait doublon visuel. Retiré uniquement quand ce bloc existe.
          pil.tag = V2.opsoGroupement ? '' : (V2.fmtK(caTotal) + ' €');
          P.unshift(pil);
        }
        // 01/10/2026 — le tableau de bord OPSO (V2.opsoGroupement) n'est plus
        // posé sur l'accueil : il devient une porte, la première.
        if (V2.pages.opsobord) {
          P.unshift({ k: 'opsobord', cls: 'p1', accent: 'var(--pil-pilo)', ico: 'grid', tag: '', t: 'Tableau de bord', d: 'Le chiffre du groupement, le mois, la rémunération, ce que les adhérentes achètent et la trajectoire de l\'année.', go: 'Voir le tableau de bord' });
        }
        // 29/09/2026 — deux nouveaux écrans OPSO (opso-pharmacies.js) : l'évolution
        // par pharmacie, et la liste produits classée par nombre de pharmacies.
        if (V2.pages.opsopharmacies) {
          P.push({ k: 'opsopharmacies', cls: 'p1', accent: 'var(--pil-opp)', ico: 'pharma', tag: 'Par officine', t: 'Pharmacies', d: 'Chaque officine du réseau OPSO Santé : son évolution d\'achats mois par mois chez Intégral Pharma, ses produits phares, et les adhérentes sans achat à relancer.', go: 'Voir les pharmacies' });
        }
        if (V2.pages.opsoachats) {
          P.push({ k: 'opsoachats', cls: 'p3', accent: 'var(--pil-cat)', ico: 'cat', tag: 'Classement', t: 'Meilleurs achats', d: 'Les produits que les pharmacies OPSO commandent chez nous, classés par nombre de pharmacies clientes — la liste de référence à montrer aux adhérents.', go: 'Voir les meilleurs achats' });
        }
      }
      // 11/09/2026 — espace ESCALE PHARMA. 24/09/2026 — Will : « features communes,
      // pas de distinctions » : même accueil, mêmes portes que le CRM ; seules les
      // données (bornées à Escale) et ces deux textes changent.
      if (window.V2_BRAND && window.V2_BRAND.escale) {
        var pmE = {}; P.forEach(function (x) { pmE[x.k] = x; });
        if (pmE.pharma) { pmE.pharma.d = 'Les officines clientes d\'Escale Pharma : coordonnées, groupement, chiffre d\'affaires, et ce qu\'elles commandent ou pas encore.'; }
        if (pmE.pilotage) { pmE.pilotage.d = 'Le chiffre d\'affaires d\'Escale Pharma par commercial, par mois et par groupement, avec la marge et les familles produits.'; }
      }
      function tile(p) {
        var nav = p.route ? ('V2.go(\'' + p.route.name + '\'' + (p.route.param ? ',\'' + p.route.param + '\'' : '') + ')') : ('V2.go(\'' + p.k + '\')');
        return '<a class="v2-pil ' + p.cls + '"' + (p.accent ? ' style="--accent:' + p.accent + '"' : '') + ' onmousemove="V2.homeSpot(event,this)" onclick="' + nav + '">' +
          '<div class="v2-pil-head"><div class="v2-pil-ico">' + ICO(p.ico, 26) + '</div>' + (p.tag ? '<span class="v2-pil-num">' + p.tag + '</span>' : '') + '</div>' +
          '<div class="v2-pil-t">' + p.t + '</div><div class="v2-pil-d">' + p.d + '</div>' +
          '<div class="v2-pil-go">' + p.go + ' <span class="arrow">→</span></div></a>';
      }
      // Une tuile dont l'écran n'est pas chargé (app OPSO allégée, module
      // optionnel absent) ne s'affiche pas : un clic vers rien n'existe pas.
      P = P.filter(function (p) { return p.route ? !!V2.pages[p.route.name] : !!V2.pages[p.k]; });
      // Accueil regroupé "par moment d'usage" (hors OPSO qui garde son ordre suivi-groupement)
      var pilHtml, todoTuile = false, g4Mode = false;
      if (window.V2_BRAND && window.V2_BRAND.opso) {
        // 01/10/2026 — Will : « l'accueil doit être les différentes features,
        // pas directement le pilotage » → l'accueil ne montre plus que les
        // espaces ; le tableau de bord est l'écran « opsobord ».
        pilHtml = '<div class="v2-piliers oa-espaces">' + P.map(tile).join('') + '</div>';
      } else {
        // Accueil g4 (30/09/2026, validé par Will) : voir G4_PORTES / g4OutilsHtml plus haut.
        // La To do list a sa propre porte : la petite carte V2.todo.cardHtml() ferait doublon.
        g4Mode = true;
        todoTuile = !!V2.pages.todo;
        // Textes propres à l'espace Escale (24/09/2026) : ils remplacent ceux de ces deux portes.
        _g4Esc = {};
        if (window.V2_BRAND && window.V2_BRAND.escale) {
          P.forEach(function (x) { if (x.k === 'pharma' || x.k === 'pilotage') _g4Esc[x.k] = x.d; });
        }
      }

      var firstName = (V2.user && V2.user.name ? V2.user.name.split(' ')[0] : 'Will');
      // Salutation par moment de la journée : réservée à l'app JARVIS pour ne
      // rien changer au rendu OPSO/Escale (contrôle : « Bonjour » fixe).
      var salut = (!isBrandApart && new Date().getHours() >= 18) ? 'Bonsoir' : 'Bonjour';
      var tiennesTxt = (!isBrandApart && mesOfficines != null) ? ' · <b>tes officines : ' + hxNum(mesOfficines) + '</b>' : '';


      // La cascade d'entrée ne joue qu'une fois par session : V2.render() est
      // rappelé quand les relances arrivent et quand les ventes finissent, ce
      // deuxième rendu doit arriver déjà visible (v2-home-still), pas rejouer
      // la poussée depuis le centre.
      var jouerAnim = !_homeAnimJoue;
      _homeAnimJoue = true; // posée dès le tout premier rendu : jamais rejouée ensuite (relances, ventes)
      var homeAnimCls = jouerAnim ? 'js-anim' : 'v2-home-still';

      if (g4Mode) {
        u2Accueil(root, { nb: nbPharma, partiel: partiel, mes: mesOfficines, salut: salut, prenom: String((V2.user && V2.user.name) || '').split(' ')[0] });
        return;
      }
      root.innerHTML = topbar() +
        '<div class="v2-wrap narrow v2-home-x ' + homeAnimCls + '">' +
          '<div class="v2-hero">' +
            '<h1>' + salut + ' <span class="ac">' + esc(firstName) + '</span></h1>' +
            '<p class="v2-hero-sub">' + cap(today) + ' · ' + (partiel
              ? '<span id="v2-ventes-etat">Chargement des ventes… <b>' + ((V2.ventesProgres && V2.ventesProgres.n) || 0) + '</b> / ' + ((V2.ventesProgres && V2.ventesProgres.total) || '?') + '</span>'
              : '<b>' + nbPharma + '</b> officines actives') + tiennesTxt + '</p>' +
          '</div>' +
          '<div class="v2-search" role="button" tabindex="0" aria-label="Rechercher une pharmacie, un produit" onclick="V2.onTopSearch()"><span class="srch-ic">' + ICO('search', 18, 2) + '</span>' +
            '<input readonly aria-hidden="true" tabindex="-1" placeholder="' + ((window.V2_BRAND && window.V2_BRAND.opso) ? 'Chercher' : 'Cherche') + ' une pharmacie, un produit…" style="cursor:pointer"><kbd>' + MOD + 'K</kbd></div>' +
          relancesCardHtml() +
          // Accueil « objets bien rangés » : la grande tuile To do list suffit, la petite carte faisait doublon.
          (V2.todo && !todoTuile ? V2.todo.cardHtml() : '') +
          pilHtml +
        '</div>';
      if (window.V2_BRAND && window.V2_BRAND.opso && V2.opsoGroupement) { V2.opsoGroupement.espaces(root); }
    },
    // appelé par V2.render() dès qu'on quitte l'accueil : boucles arrêtées, écouteurs retirés
    quitter: function () { u2Demonter(); }
  };

  // ════════════════════════════════════════════
  // COMMAND PALETTE ⌘K
  // ════════════════════════════════════════════
  var cmdkIdx = null, cmdkSel = 0, cmdkResults = [];
  function buildCmdkIndex() {
    var idx = [];
    // Pages
    var PAGES = [['home', 'Accueil', 'opp'], ['pharma', 'Opportunités pharmacie', 'opp'], ['offilog', 'Offilog · parapharmacie & prix concurrents', 'spark'], ['pilotage', 'Pilotage CA & marge', 'pilo']];
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.concurrents) PAGES.splice(3, 0, ['concurrents', 'Concurrents · grossistes, leurs prix, actualité', 'spark']);
    // 04/09/2026 — l'app OPSO redevient un simple visu groupement : plus de
    // fiches commerciales chez elle (v2-fiches n'y est plus chargé).
    if (window.V2_BRAND && window.V2_BRAND.opso && V2.pages.marketing) PAGES.splice(2, 0, ['marketing', 'Fiches marketing OPSO', 'fiche']);
    else if (V2.pages.marketing) PAGES.splice(2, 0, ['marketing', 'Marketing', 'spark']);
    // 29/09/2026 — écrans OPSO Pharmacies / Meilleurs achats, atteignables au clavier.
    if (window.V2_BRAND && window.V2_BRAND.opso && V2.pages.opsobord) PAGES.push(['opsobord', 'Tableau de bord · chiffre, rémunération, trajectoire', 'grid']);
    if (window.V2_BRAND && window.V2_BRAND.opso && V2.pages.opsopharmacies) PAGES.push(['opsopharmacies', 'Pharmacies · évolution par officine', 'pharma']);
    if (window.V2_BRAND && window.V2_BRAND.opso && V2.pages.opsoachats) PAGES.push(['opsoachats', 'Meilleurs achats · classement par nombre de pharmacies', 'cat']);
    // Une seule entrée « La carte » (l'entrée « Copilote » en doublon est retirée le 27/08/2026).
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.carte) PAGES.splice(1, 0, ['carte', 'La carte · officines, clients, prospects, tournée', 'pharma']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.infos) PAGES.splice(1, 0, ['infos', 'Infos du matin', 'spark']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.produits) PAGES.splice(1, 0, ['produits', 'Produits · catalogue des 7 établissements', 'cat']);
    // molecules / catalogue / appro restent dans ⌘K : c'est le chemin de secours
    // depuis qu'ils ont quitté les tuiles de l'accueil.
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.molecules) PAGES.splice(4, 0, ['molecules', 'Catalogue & prix (par produit)', 'cat']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.appro) PAGES.push(['appro', 'Appro Intégral · vue achats détaillée', 'spark']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.marchefr) PAGES.push(['marchefr', 'Le marché · le marché français d’une référence, région par région', 'cat']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.biosimilaires) PAGES.splice(4, 0, ['biosimilaires', 'Base Biosimilaires (marché FR)', 'cat']);
    if (!(window.V2_BRAND && (window.V2_BRAND.opso || window.V2_BRAND.escale)) && V2.pages.lgo) PAGES.push(['lgo', 'Logiciels officine · importer le catalogue (LGPI, Winpharma, LEO…)', 'list']);
    // Le module Rendez-vous n'était atteignable que par sa tuile. Mis en avant
    // le 17/08, il doit aussi se trouver au clavier — c'est le chemin de ceux
    // qui l'utiliseront tous les jours.
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.rdv) {
      PAGES.splice(1, 0, ['rdv', 'Rendez-vous · prise de RDV & campagnes', 'cal']);
      if (V2.pages.campagne) PAGES.push(['campagne', 'Campagne de rendez-vous · un par un ou groupé en copie cachée', 'cal']);
      if (V2.pages.rdvradar) PAGES.push(['rdvradar', 'Qui inviter · les officines à relancer en priorité', 'cal']);
      if (V2.pages.rdvappels) PAGES.push(['rdvappels', 'Qui appeler · les officines sans adresse mail', 'cal']);
      if (V2.pages.rdvmodeles) PAGES.push(['rdvmodeles', 'Mes modèles de mail de rendez-vous', 'cal']);
      if (V2.pages.rdvsuivi) PAGES.push(['rdvsuivi', 'Suivi & contrôle des rendez-vous', 'cal']);
      if (V2.pages.rdvdispo) PAGES.push(['rdvdispo', 'Mes disponibilités & mon lien de réservation', 'cal']);
    }
    // Une page non chargée (app OPSO allégée) ne se propose pas au clavier.
    PAGES = PAGES.filter(function (p) { return p[0] === 'home' || !!V2.pages[p[0]]; });
    PAGES.forEach(function (p) { idx.push({ grp: 'Pages', label: p[1], ico: p[2], action: function () { V2.go(p[0]); } }); });
    // Espace Groupements (sous-vue de pharma avec param) — recherchable dans ⌘K
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.pharma) {
      idx.push({ grp: 'Pages', label: 'Groupements · listes & listings produits', ico: 'list', action: function () { V2.go('pharma', 'groupements'); } });
    }
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.carteGrp) {
      idx.push({ grp: 'Pages', label: 'Carte groupements · clients & prospects par groupement', ico: 'pharma', action: function () { V2.go('carteGrp'); } });
    }
    // Tournée prospect : intégrée au Copilote (Organisateur de tournée) — recherchable via l'entrée « Copilote ».
    // Pharmacies
    (V2.pharmacies || []).forEach(function (p) {
      idx.push({ grp: 'Pharmacies', label: p.name, ico: 'pharma', meta: '', pid: String(p.id), action: function () { V2.go('pharma', p.id); } });
    });
    // Produits (top 300 PROD_STATS par rotation) — ouvre « Par produit » filtré sur le produit
    var PS = window.PROD_STATS || [];
    PS.slice(0, 300).forEach(function (r) {
      idx.push({ grp: 'Produits', label: r.d, ico: 'pill', meta: r.c, action: function () { V2.go('molecules', r.c); } });
    });
    return idx;
  }
  function deaccLower(s) {
    s = String(s == null ? '' : s).toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  }
  function cmdkSearch(q) {
    if (!cmdkIdx) cmdkIdx = buildCmdkIndex();
    q = (q || '').trim().toLowerCase();
    if (!q) return cmdkIdx.filter(function (x) { return x.grp === 'Pages'; });
    var scored = [];
    for (var i = 0; i < cmdkIdx.length; i++) {
      var x = cmdkIdx[i], l = x.label.toLowerCase();
      var pos = l.indexOf(q);
      if (pos < 0 && (x.meta || '').indexOf(q) < 0) continue;
      scored.push({ x: x, s: (pos === 0 ? 0 : pos < 0 ? 50 : 10) + l.length / 200 });
    }
    scored.sort(function (a, b) { return a.s - b.s; });
    var out = scored.slice(0, 24).map(function (o) { return o.x; });
    // Toutes les officines de France (base nationale) : trouver PAR NOM / VILLE / CP / TITULAIRE,
    // prospects compris. Clic -> fiche pharmacie (éditable même si non cliente).
    if (q.length >= 2 && window.PHARMA_FR && window.PHARMA_FR.p) {
      var shown = {}; out.forEach(function (x) { if (x.pid != null) shown[String(x.pid)] = 1; });
      var D = window.PHARMA_FR, P = D.p, nq = deaccLower(q), extra = [];
      // 11/09/2026 — perf : noms/villes/titulaires normalisés UNE fois (et non
      // 3 × 18 000 normalisations Unicode à chaque touche).
      if (!D.__norm || D.__norm.length !== P.length) {
        D.__norm = new Array(P.length);
        for (var z = 0; z < P.length; z++) { var pz = P[z]; D.__norm[z] = [deaccLower(pz[6]), deaccLower(pz[7]), String(pz[8] || ''), deaccLower(pz[10])]; }
      }
      var NP = D.__norm;
      for (var k = 0; k < P.length && extra.length < 20; k++) {
        var p = P[k], id = String(p[13] || ''), np = NP[k];
        if (!id || shown[id]) continue;
        if (np[0].indexOf(nq) >= 0 || np[1].indexOf(nq) >= 0 ||
            np[2].indexOf(q) >= 0 || np[3].indexOf(nq) >= 0) {
          shown[id] = 1;
          extra.push({ grp: 'Officines (France entière)', label: (p[6] || p[10] || 'Pharmacie'), ico: 'pharma',
            meta: (p[7] || '') + (p[8] ? ' · ' + p[8] : ''), pid: id,
            action: (function (pid) { return function () { V2.go('pharma', pid); }; })(id) });
        }
      }
      out = out.concat(extra);
    }
    // Prospects déjà créés à la main (Supabase 'newpharma')
    if (q.length >= 2 && V2._newph && V2._newph.length) {
      var nq2 = deaccLower(q), seen2 = {};
      out.forEach(function (x) { if (x.pid != null) seen2[String(x.pid)] = 1; });
      V2._newph.forEach(function (o) {
        var d = o.data || {}, id = String(o.sid); if (seen2[id]) return;
        var hay = deaccLower((d.nom || '') + ' ' + (d.ville || '') + ' ' + (d.cp || '') + ' ' + (d.titulaire || ''));
        if (hay.indexOf(nq2) >= 0) out.push({ grp: 'Fiches créées', label: (d.nom || 'Prospect'), ico: 'pharma',
          meta: (d.ville || '') + (d.cp ? ' · ' + d.cp : ''), pid: id,
          action: (function (pid) { return function () { V2.go('pharma', pid); }; })(id) });
      });
    }
    // Toujours proposer de CRÉER une fiche prospect si on ne trouve pas (ou pour ajouter)
    if (q.length >= 2) {
      out.push({ grp: 'Créer', label: '➕ Créer une fiche prospect « ' + q + ' »', ico: 'pharma',
        action: (function (name) { return function () { if (V2.createProspect) V2.createProspect(name); }; })(q.trim()) });
    }
    return out;
  }
  function loadNewProspects() {
    if (!V2.profil || !V2.profil.loadScope) return;
    // Les fiches créées à la main sont des enregistrements 'client' d'id « px_… » portant un nom.
    V2.profil.loadScope('client').then(function (all) {
      V2._newph = (all || []).filter(function (o) { return String(o.sid).indexOf('px_') === 0 && o.data && o.data.nom; });
      var bd = document.getElementById('v2-cmdk'), inp = document.getElementById('v2-cmdk-input');
      if (bd && bd.classList.contains('open') && inp && inp.value) { cmdkResults = cmdkSearch(inp.value); renderCmdkResults(); }
    }).catch(function () {});
  }
  // Chargeur partagé de la base nationale (2,7 Mo, lazy) — pour la recherche d'accueil et les fiches prospect.
  // ── VÉRITÉ CLIENT (canonique, partagée) — un client = officine dont l'id est dans WML_OFFICINES.
  // Le seg BRUT de PHARMA_FR est FAUX (gonflé). MÊME règle que le Copilote (reconcileWithWml).
  // Idempotent (flag D._wmlRecon). À appeler dès que PHARMA_FR est chargé, avant tout affichage de client.
  // 21/09/2026 — c'est le SEUL réconciliateur : La carte et la carte des groupements en portaient chacune
  // une copie, avec un palier calculé sur le seul CA national (ancien, 603 officines) — ouvrir Pharmacies
  // après La carte écrasait les bons paliers. Le palier se lit d'abord dans le CA du CRM (o.ca).
  // `force` = repasser malgré le flag (le CA protégé ou WML sont arrivés après le premier passage).
  // Nom canonique d'un groupement (fusionne les variantes via window.GRP_ALIAS, produit par les agents)
  V2.canonGrp = function (name) { var A = window.GRP_ALIAS || {}; return A[String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')] || name; };
  // Seuils du palier client A/B/C — décision Will du 21/09/2026 : le palier se lit au CA MOYEN PAR
  // MOIS (5 000 €/mois pour A, 1 500 €/mois pour B), jamais en dur sur le total. Le nombre de mois
  // couverts vient de window.WML_MOIS (wml-officines-data.js) ; repli à 8 si absent — c'est le nombre
  // de mois du jeu de données du 21/09/2026, ça retombe donc exactement sur les anciens seuils fixes
  // (40 000 € / 12 000 €).
  V2.seuilsPalier = function () {
    var m = (window.WML_MOIS && window.WML_MOIS.length) ? window.WML_MOIS.length : 8;
    return { a: 5000 * m, b: 1500 * m, mois: m };
  };
  V2.reconcilePharma = function (force) {
    var D = window.PHARMA_FR, W = window.WML_OFFICINES;
    if (!D || !D.p || !D.seg || (D._wmlRecon && !force) || !W || !W.length) return;
    var segIdx = {}; for (var s = 0; s < D.seg.length; s++) segIdx[D.seg[s]] = s;
    function ensureSeg(l) { if (segIdx[l] == null) { D.seg.push(l); segIdx[l] = D.seg.length - 1; } return segIdx[l]; }
    var iA = ensureSeg('Client A'), iB = ensureSeg('Client B'), iC = ensureSeg('Client C'), iPro = ensureSeg('Prospect');
    var canon = function (x) { return String(x || '').normalize ? String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '') : String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    var grpIdx = {}; for (var g = 0; g < D.grp.length; g++) grpIdx[canon(D.grp[g])] = g;
    function ensureGrp(nm) { var k = canon(nm); if (grpIdx[k] == null) { D.grp.push(nm); grpIdx[k] = D.grp.length - 1; } return grpIdx[k]; }
    var wml = {}; W.forEach(function (o) { if (o && o.id) wml[String(o.id).replace(/[^0-9]/g, '')] = o; });
    var seuils = V2.seuilsPalier();
    var nC = 0;
    D.p.forEach(function (p) {
      var o = wml[String(p[13] || '').replace(/[^0-9]/g, '')];
      if (o) { var ca = o.ca || p[12] || 0; p[4] = ca >= seuils.a ? iA : (ca >= seuils.b ? iB : iC); var gr = o.groupement && String(o.groupement).trim(); if (gr && gr !== '—') p[3] = ensureGrp(V2.canonGrp(gr)); nC++; }
      else if (D.seg[p[4]] !== 'Prospect') { p[4] = iPro; }
    });
    // Canonicalise TOUS les groupements (fusionne les doublons partout dans l'appli)
    if (window.GRP_ALIAS) D.p.forEach(function (p) { var g = D.grp[p[3]]; if (g && g !== '—') { var cg = V2.canonGrp(g); if (cg !== g) p[3] = ensureGrp(cg); } });
    var OV = window.GRP_OVR;   // corrections manuelles de groupement (propagation)
    if (OV) D.p.forEach(function (p) { var g = OV[String(p[13] || '').replace(/[^0-9]/g, '')]; if (g) p[3] = ensureGrp(g); });
    D._wmlRecon = true; if (D.meta) D.meta.clients = nC;
  };
  V2.ensurePharmaFr = function (cb) {
    if (window.PHARMA_FR) { try { V2.reconcilePharma(); } catch (e) {} if (cb) cb(); return; }
    V2._pfrCbs = V2._pfrCbs || []; if (cb) V2._pfrCbs.push(cb);
    if (V2._pfrLoading) return;
    V2._pfrLoading = true;
    var s = document.createElement('script'); s.src = (window.V2_DATA_BASE || '../') + 'v2/pharma-fr-data.js?v=' + (window.V2_DATAV || '');
    s.onload = s.onerror = function () {
      V2._pfrLoading = false;
      // la colonne CA protégée se recolle dès que la carte publique est là
      // (jamais côté OPSO : segmentation et commercial affecté du réseau Intégral, 30/09/2026)
      if (window.PHARMA_FR && V2.loadFiles && !(window.V2_BRAND && window.V2_BRAND.opso)) { try { V2.loadFiles(['pharmafrca', 'pharmafrseg', 'pharmafrcomm']); } catch (e) {} }
      try { V2.reconcilePharma(); } catch (e) {}
      var cbs = V2._pfrCbs || []; V2._pfrCbs = [];
      cbs.forEach(function (f) { try { f(); } catch (e) {} });
    };
    document.head.appendChild(s);
  };
  function renderCmdkResults() {
    var box = document.getElementById('v2-cmdk-results'); if (!box) return;
    if (!cmdkResults.length) { box.innerHTML = '<div class="v2-cmdk-grp">Aucun résultat</div>'; return; }
    var html = '', lastGrp = null;
    cmdkResults.forEach(function (x, i) {
      if (x.grp !== lastGrp) { html += '<div class="v2-cmdk-grp">' + x.grp + '</div>'; lastGrp = x.grp; }
      html += '<div class="v2-cmdk-item' + (i === cmdkSel ? ' sel' : '') + '" data-i="' + i + '">' +
        '<span class="ico">' + ICO(x.ico || 'chev', 17) + '</span><span class="lbl">' + esc(x.label) + '</span>' +
        (x.meta ? '<span class="meta">' + esc(x.meta) + '</span>' : '') + '</div>';
    });
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('.v2-cmdk-item'), function (el) {
      el.onclick = function () { var i = +el.dataset.i; if (cmdkResults[i]) { V2.closeCmdk(); cmdkResults[i].action(); } };
    });
  }
  function preloadPharmaFrForSearch() {
    loadNewProspects();   // recharge les fiches créées (petite table) à chaque ouverture
    if (window.PHARMA_FR || !V2.ensurePharmaFr) return;
    V2.ensurePharmaFr(function () {   // dès que la base est là, on relance la recherche courante
      var bd = document.getElementById('v2-cmdk'), inp = document.getElementById('v2-cmdk-input');
      if (bd && bd.classList.contains('open') && inp && inp.value) { cmdkResults = cmdkSearch(inp.value); renderCmdkResults(); }
    });
  }
  V2.openCmdk = function () {
    if (!V2.user) return;   // pas de recherche/navigation tant qu'on n'est pas connecté (écran login)
    var bd = document.getElementById('v2-cmdk'); if (!bd) return;
    bd.classList.add('open');
    preloadPharmaFrForSearch();
    var inp = document.getElementById('v2-cmdk-input');
    inp.value = ''; cmdkSel = 0; cmdkResults = cmdkSearch(''); renderCmdkResults();
    setTimeout(function () { inp.focus(); }, 60);
  };
  // Détection terrain : sur mobile (tactile), on ouvre la recherche et on focus
  // l'input DANS le geste tactile (les navigateurs mobiles bloquent un focus
  // différé hors interaction → le clavier ne montait pas). Desktop garde le ⌘K.
  function isMobileField() {
    try { return window.matchMedia && window.matchMedia('(max-width:640px), (pointer:coarse)').matches; } catch (e) { return false; }
  }
  V2.onTopSearch = function () {
    if (isMobileField()) {
      var bd = document.getElementById('v2-cmdk');
      var inp = document.getElementById('v2-cmdk-input');
      if (bd && inp) {
        bd.classList.add('open');
        preloadPharmaFrForSearch();
        inp.value = ''; cmdkSel = 0; cmdkResults = cmdkSearch(''); renderCmdkResults();
        try { inp.focus(); } catch (e) {}   // focus synchrone = clavier mobile garanti
        return;
      }
    }
    V2.openCmdk();
  };
  V2.closeCmdk = function () { var bd = document.getElementById('v2-cmdk'); if (bd) bd.classList.remove('open'); };
  function mountCmdk() {
    if (document.getElementById('v2-cmdk')) return;
    var bd = document.createElement('div');
    bd.id = 'v2-cmdk'; bd.className = 'v2-cmdk-bd';
    bd.innerHTML = '<div class="v2-cmdk" onclick="event.stopPropagation()">' +
      '<div class="v2-cmdk-search">' + ICO('search', 22, 2) + '<input id="v2-cmdk-input" placeholder="Une pharmacie (nom, ville, CP), un produit, une page…" autocomplete="off"><kbd style="font-family:var(--mono);font-size:11px;background:#F1F3F8;padding:4px 8px;border-radius:7px;color:var(--ip-ink-2)">Esc</kbd></div>' +
      '<div id="v2-cmdk-results" class="v2-cmdk-results"></div>' +
      '<div class="v2-cmdk-foot"><span>↑↓ naviguer</span><span>↵ ouvrir</span><span>Esc fermer</span></div>' +
      '</div>';
    bd.onclick = function () { V2.closeCmdk(); };
    document.body.appendChild(bd);
    var inp = bd.querySelector('#v2-cmdk-input');
    var cmdkTimer = null;   // 11/09/2026 — perf : on cherche 80 ms après la dernière touche
    inp.addEventListener('input', function () {
      clearTimeout(cmdkTimer);
      cmdkTimer = setTimeout(function () { cmdkSel = 0; cmdkResults = cmdkSearch(inp.value); renderCmdkResults(); }, 80);
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdkSel = Math.min(cmdkSel + 1, cmdkResults.length - 1); renderCmdkResults(); scrollSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cmdkSel = Math.max(cmdkSel - 1, 0); renderCmdkResults(); scrollSel(); }
      else if (e.key === 'Enter') { e.preventDefault(); var x = cmdkResults[cmdkSel]; if (x) { V2.closeCmdk(); x.action(); } }
      else if (e.key === 'Escape') { V2.closeCmdk(); }
    });
    function scrollSel() { var s = bd.querySelector('.v2-cmdk-item.sel'); if (s) s.scrollIntoView({ block: 'nearest' }); }
  }
  V2.invalidateCmdk = function () { cmdkIdx = null; };

  // raccourci clavier global ⌘K / Ctrl+K
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); V2.openCmdk(); }
    else if (e.key === 'Escape') { V2.closeCmdk(); }
  });

  // ── Photo de produit cassée (404 chez un tiers : cdn.pharma-gdd.com, weserv→offilog.fr…) ──
  // Un seul gestionnaire, jamais un onerror recopié par écran. `error` ne remonte pas sur
  // <img> : on l'intercepte en phase de CAPTURE au niveau du document (ça marche quand même,
  // la capture descend vers la cible avant que l'événement n'ait besoin de remonter).
  // Limité aux <img data-imgprod> (photo de produit) : jamais les autres images de l'app.
  // Se retire après le premier remplacement — ne boucle jamais, même si le data: échouait.
  var IMGPROD_SECOURS = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    '<rect width="24" height="24" fill="#EEF2FA"/>' +
    '<g fill="none" stroke="#AEB8CE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-30 12 12)"/><path d="M8.8 7.2 14 16.4"/>' +
    '</g></svg>');
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || !t.hasAttribute('data-imgprod') || t.dataset.imgprodSecouru) return;
    t.dataset.imgprodSecouru = '1';
    t.removeAttribute('crossorigin');
    t.src = IMGPROD_SECOURS;
  }, true);

  // ── helpers ───────────────────────────────────
  // 03/09/2026 — échappe AUSSI l'apostrophe. Le pattern onclick="V2.x('+esc(d)+')"
  // est partout : sans ', une donnée avec apostrophe refermait la chaîne JS et
  // permettait d'exécuter du script. `&#39;` s'affiche exactement comme ' —
  // aucun changement visible.
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  V2.esc = esc; V2.cap = cap;

  // ── SIGNATURE SHELL (styles injectés localement, idempotent) ──────────
  // Trois gestes invariants posés ici pour le chrome global : (1) la donnée a
  // sa voix mono ; (2) le wordmark devient marque-outil ; (3) le login est un
  // manifeste sobre. On ne touche ni structure ni classes : on raffine.
  function injectShellStyles() {
    if (document.getElementById('v2-shell-styles')) return;
    // --v2-spark : étincelle chaude de marque (orange IP). Neutralisée en vert
    // sous OPSO pour ne JAMAIS faire fuiter l\'orange dans l\'autre marque.
    var isOpso = !!(window.V2_BRAND && window.V2_BRAND.opso);
    var SPARK = isOpso ? 'var(--info)' : '#F39A1B';
    var css =
      // Variable locale d\'étincelle, posée sur la racine du shell.
      '.v2-top,.v2-login{--v2-spark:' + SPARK + '}' +

      // ══ TOP BAR — raffinée ═══════════════════════════════════════════
      // (2) Wordmark signature : la baseline banale devient marque-outil mono.
      // 25/09/2026 — 9,5px/9px étaient sous le plancher de lecture (12px) : cette
      // règle (injectée après v2.css) gagnait sur le fichier et rendait "ESPACE
      // COMMERCIAL" illisible. Remonté à 12px, desktop et mobile.
      '.v2-brand-s{font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;' +
        'font-size:12px;font-weight:500;color:var(--muted);line-height:1}' +
      '@media(max-width:640px){.v2-brand-s{letter-spacing:.08em}}' +
      // Point-étincelle après le wordmark : signature de marque minuscule.
      '.v2-brand-dot{display:inline-block;width:5px;height:5px;border-radius:50%;margin-left:5px;' +
        'vertical-align:middle;background:var(--v2-spark);' +
        'box-shadow:0 0 0 2px color-mix(in srgb,var(--v2-spark) 20%,transparent)}' +
      // Le wordmark respire au survol : lift signature + le logo prend sa lumière.
      '.v2-brand{transition:transform .22s var(--mo-ease-soft,ease)}' +
      '.v2-brand:hover{transform:translateY(-1px)}' +
      '.v2-brand .v2-logo{transition:box-shadow .22s var(--mo-ease-soft,ease),transform .22s var(--mo-ease-soft,ease)}' +
      '.v2-brand:hover .v2-logo{box-shadow:0 6px 18px color-mix(in srgb,var(--info) 34%,transparent);transform:translateY(-1px)}' +
      // Liseré de tête sur la topbar : seule grammaire d\'appartenance, teintée
      // par la lumière du pilier courant, prolongée d\'une pointe chaude à droite.
      '.v2-top{position:relative}' +
      '.v2-top::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;pointer-events:none;' +
        'background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 34%,transparent),transparent 55%,' +
        'transparent 88%,color-mix(in srgb,var(--v2-spark) 22%,transparent))}' +
      // Pastille recherche ⌘K : kbd raffiné. La taille, l'avatar, « + » et les menus de la barre sont dans v2-pieces.css.
      '.v2-top-search kbd{border:1px solid var(--line);box-shadow:0 1px 0 rgba(16,19,28,.04)}' +

      // ══ LOGIN — première impression de marque ════════════════════════
      // Scène : dégradé de marque sobre (double halo info) + trame de points
      // très légère + pointe chaude en bas. Pas de backdrop-filter (Safari).
      '.v2-login{overflow:hidden}' +
      '.v2-login::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;' +
        'background:' +
          'radial-gradient(ellipse 72% 58% at 50% -6%,color-mix(in srgb,var(--info) 16%,var(--halo)),transparent 60%),' +
          'radial-gradient(ellipse 46% 40% at 92% 104%,color-mix(in srgb,var(--v2-spark) 9%,transparent),transparent 62%),' +
          'radial-gradient(circle at center,var(--card-2) 0.8px,transparent 0.9px);' +
        'background-size:auto,auto,22px 22px;' +
        'background-position:center top,center,center;' +
        'opacity:1;-webkit-mask-image:radial-gradient(ellipse 90% 90% at 50% 30%,#000 55%,transparent 100%);' +
        'mask-image:radial-gradient(ellipse 90% 90% at 50% 30%,#000 55%,transparent 100%)}' +
      // Carte : bord premium (double liseré interne clair) + entrée en douceur.
      '.v2-login-card{position:relative;z-index:1;box-shadow:0 1px 0 rgba(255,255,255,.9) inset,' +
        '0 0 0 1px var(--line),var(--sh-3);' +
        'animation:v2-login-card var(--mo-dur,320ms) var(--mo-ease-in,cubic-bezier(.32,.72,0,1)) both}' +
      '@keyframes v2-login-card{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}' +
      // Le monogramme arrive en pop discret, jamais clinquant.
      '.v2-login-logo{position:relative;box-shadow:0 8px 22px color-mix(in srgb,var(--info) 30%,transparent),' +
        '0 1px 0 rgba(255,255,255,.35) inset;' +
        'animation:v2-login-mono var(--mo-dur,320ms) var(--mo-ease-in,cubic-bezier(.32,.72,0,1)) both}' +
      '@keyframes v2-login-mono{from{opacity:0;transform:translateY(6px) scale(.92)}to{opacity:1;transform:none}}' +
      // Titre net, baseline login en mono uppercase = même voix que le wordmark.
      '.v2-login h1{margin-bottom:5px}' +
      // 25/09/2026 — 10,5px sous le plancher de lecture (12px).
      '.v2-login p{font-family:var(--mono);text-transform:uppercase;letter-spacing:.09em;font-size:12px;' +
        'color:var(--muted-2);margin-bottom:24px}' +
      // Micro-séparateur d\'étincelle sous la baseline : signe de marque discret.
      '.v2-login-spark{width:34px;height:2.5px;border-radius:2px;margin:0 auto 22px;' +
        'background:linear-gradient(90deg,var(--info),var(--v2-spark));opacity:.9}' +
      // Champs : les inputs de login gagnent en assise (padding, animation d\'entrée).
      '.v2-login .v2-field{font-size:15px;margin-bottom:12px}' +
      '.v2-login-fields{animation:v2-login-rise var(--mo-dur,320ms) var(--mo-ease-in,cubic-bezier(.32,.72,0,1)) 60ms both}' +
      '@keyframes v2-login-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
      // Bouton « Afficher » : plus lisible au survol.
      '#v2-eye{border-radius:8px;transition:color .15s var(--ease-soft),background .15s var(--ease-soft)}' +
      '@media(max-width:640px){#v2-eye{min-height:44px;display:flex;align-items:center}}' +
      '#v2-eye:hover{color:var(--ip-ink-2);background:var(--card-2)}' +
      // Pied de carte : réassurance sobre en mono.
      // 25/09/2026 — 9px sous le plancher de lecture (12px).
      '.v2-login-foot{margin-top:22px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;' +
        'font-size:12px;color:var(--muted-2);display:flex;align-items:center;justify-content:center;gap:7px;line-height:1}' +
      '.v2-login-foot::before{content:"";width:5px;height:5px;border-radius:50%;flex:0 0 auto;' +
        'background:var(--c-mint);box-shadow:0 0 0 3px color-mix(in srgb,var(--c-mint) 20%,transparent)}' +

      '@media (prefers-reduced-motion:reduce){.v2-login-card,.v2-login-logo,.v2-login-fields{animation:none}' +
        '.v2-brand,.v2-brand .v2-logo,.v2-top-search{transition:none}}';
    var st = document.createElement('style');
    st.id = 'v2-shell-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }
  V2.injectShellStyles = injectShellStyles;

  // ════════════════════════════════════════════
  // BOOT
  // ════════════════════════════════════════════
  V2.boot = async function () {
    var root = $app();
    root.innerHTML = '<div class="v2-loading"><div class="v2-spinner"></div><div>Connexion…</div></div>';
    mountCmdk();
    // 11/09/2026 — perf : les modules différés partent dès maintenant, pendant
    // l'authentification (et pendant que l'utilisateur tape son mot de passe).
    if (V2.lancerModules) V2.lancerModules();
    var logged = await V2.loadUserProfile();
    if (!logged) { V2.renderLogin(); return; }
    root.innerHTML = '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement de tes données…</div></div>';
    var opso = !!(window.V2_BRAND && window.V2_BRAND.opso);
    // PPHT et PROD_STATS ne sont plus des balises d'index.html (CRM) : ils doivent
    // être en mémoire AVANT bench (applyPPHT, déclenché à l'arrivée de bench, en a
    // besoin — sinon les nets princeps sont figés faux, sans erreur). OPSO les a
    // encore en balises : on ne recharge que ce qui manque.
    var prealables = [];
    if (typeof window.PPHT === 'undefined') prealables.push('ppht');
    if (typeof window.PROD_STATS === 'undefined') prealables.push('prodstats');
    // charge données Supabase + fichiers essentiels en parallèle
    await Promise.all([
      // OPSO : les achats par officine (protégés) doivent être en mémoire
      // AVANT que loadData ne fabrique les fiches — c'est lui qui les répartit.
      // CRM : loadData() sans WML_OFFICINES ne faisait que 3 requêtes Supabase de
      // repli (1 000 ventes tronquées) aussitôt écrasées par le vrai loadData()
      // du premier rendu — retirées le 11/09/2026.
      (opso ? V2.loadFiles(['opsostats', 'opsolisting']).then(function () { return V2.loadData(); }) : Promise.resolve()),
      // le léger d'abord (bench public + colonnes protégées, petites tables) ;
      // establishments (4,3 Mo protégé) part EN FOND après le premier rendu :
      // l'attendre bloquerait la première connexion le temps du téléchargement.
      // 11/09/2026 (phase 2) — CRM : le catalogue (bench 2,9 Mo + prodstats
      // 0,7 Mo + tables protégées) N'EST PLUS attendu ici : l'accueil ne le lit
      // pas. Chaque écran déclare ce qu'il lit (`needs`, voir V2.render) et le
      // charge s'il manque ; le tout part EN FOND juste après le premier rendu.
      // OPSO garde l'ancien enchaînement (PPHT/PROD_STATS en balises).
      (opso
        ? (prealables.length ? V2.loadFiles(prealables) : Promise.resolve()).then(function () { return V2.loadFiles(V2.NEEDS_DEFAUT); })
        : Promise.resolve())
    ]);
    if (!opso) V2.loadFiles(['establishments']);   // aucun écran OPSO ne le lit (30/09/2026)
    V2.invalidateCmdk();
    V2.route = parseHash();
    V2.render();
    if (!opso) {
      setTimeout(function () {
        // loadFiles enchaîne ppht + prodstats AVANT bench (v2-boot.js).
        V2.loadFiles(V2.NEEDS_DEFAUT).then(function () { V2.invalidateCmdk(); });
      }, 250);
    }
    window.addEventListener('hashchange', function () {
      var r = parseHash();
      if (r.name !== V2.route.name || r.param !== V2.route.param) { __clearStaleErrBanner(); V2.route = r; V2.render(); }
    });
  };

  // ── LOGIN ─────────────────────────────────────
  V2.renderLogin = function () {
    var root = $app();
    injectShellStyles();
    // Login = scène marque : la lumière neutre/info (bleu marque) pour le halo signature.
    try { document.documentElement.style.setProperty('--accent', 'var(--info)'); } catch (e) {}
    root.innerHTML = '<div class="v2-login"><div class="v2-login-card">' +
      '<div class="v2-login-logo">' + ICO('logo', 30) + '</div>' +
      '<h1>' + ((window.V2_BRAND && window.V2_BRAND.name) || 'Intégral Pharma') + '</h1>' +
      '<p>' + ((window.V2_BRAND && window.V2_BRAND.sub) || 'Espace commercial · CRM') + '</p>' +
      '<div class="v2-login-spark" aria-hidden="true"></div>' +
      '<form class="v2-login-fields" onsubmit="return false">' +
        '<input class="v2-field" id="v2-email" type="email" inputmode="email" aria-label="Adresse email" placeholder="Email" autocomplete="username">' +
        '<div style="position:relative">' +
          '<input class="v2-field" id="v2-pass" type="password" aria-label="Mot de passe" placeholder="Mot de passe" autocomplete="current-password" style="padding-right:82px">' +
          '<button type="button" id="v2-eye" aria-label="Afficher le mot de passe" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;color:var(--muted);font-family:inherit;font-size:12.5px;font-weight:600;line-height:1;cursor:pointer;padding:10px">Afficher</button>' +
        '</div>' +
        '<button type="submit" class="v2-btn v2-btn-primary" id="v2-login-btn">Se connecter</button>' +
        '<div class="v2-login-err" id="v2-login-err" role="alert"></div>' +
      '</form>' +
      '<div class="v2-login-foot">Connexion sécurisée</div>' +
      '</div></div>';
    var btn = document.getElementById('v2-login-btn');
    var err = document.getElementById('v2-login-err');
    function submit() {
      var em = document.getElementById('v2-email').value.trim();
      var pw = document.getElementById('v2-pass').value;
      if (!em || !pw) { err.textContent = 'Email et mot de passe requis'; return; }
      btn.textContent = 'Connexion…'; btn.disabled = true; err.textContent = '';
      V2.signIn(em, pw).then(function (r) {
        if (r.ok) { V2.boot(); }
        else { err.textContent = r.msg || 'Identifiants incorrects'; btn.textContent = 'Se connecter'; btn.disabled = false; document.getElementById('v2-email').focus(); }
      }).catch(function () {
        err.textContent = 'Connexion impossible — vérifie ta connexion internet.';
        btn.textContent = 'Se connecter'; btn.disabled = false;
      });
    }
    // le <form> capte le clic sur le bouton submit ET la touche Entrée : un
    // SEUL déclencheur, sinon le login partait deux fois (double V2.boot, double
    // listener hashchange). Pas de btn.onclick en plus.
    var frm = btn.form;
    if (frm) { frm.addEventListener('submit', function (e) { e.preventDefault(); submit(); }); }
    else { btn.onclick = submit; }
    var eye = document.getElementById('v2-eye');
    if (eye) eye.onclick = function () { var p = document.getElementById('v2-pass'); var show = p.type === 'password'; p.type = show ? 'text' : 'password'; this.textContent = show ? 'Masquer' : 'Afficher'; this.setAttribute('aria-label', (show ? 'Masquer' : 'Afficher') + ' le mot de passe'); };
    document.getElementById('v2-email').focus();
  };

  // démarrage
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(V2.boot, 60); });
  else setTimeout(V2.boot, 60);
})();
