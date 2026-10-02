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
      '<span class="v2-logo">' + ICO('logo', 22) + '</span>' +
      (back ? '' : '<span><span class="v2-brand-t">' + ((window.V2_BRAND && window.V2_BRAND.name) || 'Intégral Pharma') + '<span class="v2-brand-dot" aria-hidden="true"></span></span><br><span class="v2-brand-s">' + ((window.V2_BRAND && window.V2_BRAND.sub) || 'Espace commercial') + '</span></span>') +
      '</a>';
    // 15/09/2026 — bascule Intégral ↔ Escale, en haut à gauche. Réservée aux comptes
    // ayant accès aux deux espaces (le compte Escale à accès total).
    // Vers Escale (depuis le CRM) : même critère que la 7ᵉ carte d'accueil (14/09,
    // ligne ~1326) — un compte @escalepharma.fr (et, depuis le 24/09, les quatre
    // commerciaux Escale, qui ne sont plus renvoyés vers l'espace Escale).
    // Vers Intégral (depuis Escale) : email @escalepharma.fr NE SUFFIT PAS — tous
    // les commerciaux Escale l'ont aussi. Il faut en plus `voitTousReel` (posé dans
    // v2-boot.js AVANT la bascule locale de commercial/voitTous propre à l'espace
    // Escale) : seul le compte à accès total l'a à true, pas le compte générique (commercial='Escale').
    // 24/09/2026 — les quatre commerciaux Escale (adresses @integralpharma.fr) l'ont
    // aussi, dans les deux sens : même CRM, seul le périmètre change (V2.basculeEspace).
    var spaceSw = '';
    var bsc = V2.basculeEspace();
    if (bsc) {
      spaceSw = '<button class="v2-spacesw" title="Basculer vers l\'espace ' + bsc.label + '" aria-label="Basculer vers l\'espace ' + bsc.label + '" onclick="V2.goSpace(\'' + bsc.to + '\')">' +
        '<span aria-hidden="true">⇄</span>' + bsc.label + '</button>';
    }
    return '' +
      '<div class="v2-top">' +
        back + brand + spaceSw +
        ((V2.route && V2.route.name === 'home') ? '' : '<div class="v2-top-search" onclick="V2.onTopSearch()">' + ICO('search', 15, 2) + 'Rechercher<kbd>' + MOD + 'K</kbd></div>') +
        ((!(window.V2_BRAND && window.V2_BRAND.opso) && V2.remonteeOpen) ? '<button class="v2-idea" title="Proposer une amélioration à l\'équipe" aria-label="Proposer une amélioration" onclick="V2.remonteeOpen()">' + ICO('spark', 16, 2) + '</button>' : '') +
        '<div class="v2-av" title="' + (V2.user ? V2.user.name : '') + '" onclick="V2.userMenu()">' + initials + '</div>' +
      '</div>';
  }
  V2.topbar = topbar;

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

  V2.userMenu = function () {
    var ex = document.getElementById('v2-usermenu');
    if (ex) { ex.parentNode.removeChild(ex); return; }
    var m = document.createElement('div');
    m.id = 'v2-usermenu';
    m.className = 'v2-usermenu';
    var installed = false;
    try { installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) {}
    m.innerHTML =
      '<div class="v2-um-head">' +
        '<div class="v2-um-name">' + esc(V2.user ? V2.user.name : 'Utilisateur') + '</div>' +
        (V2.user && V2.user.email ? '<div class="v2-um-mail">' + esc(V2.user.email) + '</div>' : '') +
      '</div>' +
      (installed ? '' : '<button class="v2-um-item" onclick="V2.installApp()">' + ICO('plus', 16, 2) + 'Installer l\'app</button>') +
      '<button class="v2-um-item" onclick="V2.signOut()">' + ICO('logout', 16, 2) + 'Se déconnecter</button>' +
      // 24/08/2026 — information de l'équipe sur la mesure d'usage (obligation
      // CNIL dès lors qu'elle est nominative). Volontairement factuelle et
      // sans jargon : on dit ce qui est enregistré et à quoi ça sert, rien de plus.
      '<div class="v2-um-note">Les écrans que vous ouvrez sont enregistrés (votre nom et l\'heure), pour savoir lesquels améliorer en priorité.</div>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('open'); });
    setTimeout(function () {
      function close(e) {
        if (e.type === 'keydown' && e.key !== 'Escape') return;
        // ignorer aussi le clic sur l'avatar → laisse le toggle de V2.userMenu refermer proprement
        if (e.type === 'click' && (m.contains(e.target) || (e.target.closest && e.target.closest('.v2-av')))) return;
        if (m.parentNode) m.parentNode.removeChild(m);
        document.removeEventListener('click', close, true);
        document.removeEventListener('keydown', close, true);
      }
      document.addEventListener('click', close, true);
      document.addEventListener('keydown', close, true);
    }, 0);
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
  // ── Accueil q1 : feuille de style (maquette q1, classes préfixées q-) ──
  var Q_CSS = `
@font-face{font-family:'Hanken';src:url('polices/hanken.woff2') format('woff2');font-weight:100 900;font-display:swap}
.q-page,.q-portail{
  --encre:#0F1420;--gris:#4A5163;--bleu:#0050E6;--bleu-clair:#3D82FF;--halo:#E9F0FF;--nuit:#0B1530;
  --retard:#C7283D;--vert:#1E9E6A;--vert-fonce:#157A52;--ambre:#C7791A;
  --fond:#F3F5F9;--froid:#DFE4EC;--filet:#E3E7EF;--blanc:#fff;--main:#F7F8FC;
  /* une seule main : trois rayons, un filet, une ombre de pose */
  --r1:8px;--r2:12px;--r3:16px;--pose:0 1px 2px rgba(11,21,48,.04);
  /* courbes CSS : arrivée, déplacement, sinus des boucles */
  --arr:cubic-bezier(.2,.8,.2,1);--dep:cubic-bezier(.4,0,.2,1);--sin:cubic-bezier(.37,0,.63,1);
  /* les quatre ressorts : le script les intègre (k, c) et remplace ces replis par leur courbe exacte */
  --doux:cubic-bezier(.2,.8,.2,1);--tdoux:520ms;--vif:cubic-bezier(.2,.9,.3,1.25);--tvif:420ms;
  --rebond:cubic-bezier(.3,1.7,.5,1);--trebond:620ms;--lourd:cubic-bezier(.2,.8,.2,1);--tlourd:950ms;
}
:where(.q-page,.q-portail) *{box-sizing:border-box;margin:0;padding:0}
.q-page{-webkit-text-size-adjust:100%;font-family:'Hanken',-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;color:var(--encre);font-size:14px;line-height:1.35;
  background:#D9E2F8 linear-gradient(158deg,#EEF2FF 0%,#DCE4F8 46%,#C9D6F5 100%);
  min-height:100vh;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
:where(.q-page,.q-portail) a{color:inherit;text-decoration:none}
:where(.q-page,.q-portail) button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
svg.q-ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none;overflow:visible}
.q-vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.q-page a:focus-visible,.q-page button:focus-visible{outline:2px solid var(--bleu);outline-offset:2px}
.q-js a:focus-visible,.q-js button:focus-visible{outline:none}
/* ---------- cadre ---------- */
.q-app{max-width:1280px;margin:0 auto;padding:16px}
.q-carte{background:var(--blanc);border-radius:28px;overflow:clip;display:grid;grid-template-columns:226px 1fr 318px;
  box-shadow:0 30px 60px -30px rgba(11,21,48,.35),0 1px 0 rgba(255,255,255,.8) inset;min-height:868px;position:relative}
/* ---------- barre latérale ---------- */
.q-side{background:var(--blanc);padding:28px 0 24px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;min-height:868px;align-self:start}
.q-logo{display:flex;align-items:center;gap:12px;padding:0 24px 24px;min-height:44px}
.q-logo .q-rond{width:36px;height:36px;border-radius:50%;background:linear-gradient(145deg,#3D82FF,#0050E6 60%,#0040B8);display:grid;place-items:center;color:#fff;flex:none;box-shadow:0 6px 14px -6px rgba(0,80,230,.6)}
.q-logo b{font-size:20px;font-weight:800;letter-spacing:-.01em;display:block;line-height:1.3}
.q-logo small{font-size:13px;color:var(--gris);display:block;line-height:1.3}
.q-nav{display:flex;flex-direction:column;position:relative;flex:1}
.q-nav .q-barre{position:absolute;right:0;top:0;width:4px;height:100px;border-radius:3px 0 0 3px;background:var(--bleu);transform-origin:0 0;transform:scaleY(.69);will-change:transform}
.q-nav .q-fond{position:absolute;left:0;right:0;top:0;height:100px;background:var(--halo);transform-origin:0 0;transform:scaleY(.69);will-change:transform;z-index:0}
.q-nav a{position:relative;z-index:1;display:grid;grid-template-columns:22px 1fr;column-gap:12px;align-items:start;align-content:center;padding:8px 20px 8px 24px;min-height:52px;color:var(--gris)}
.q-nav a .q-ico{width:22px;height:22px;display:grid;place-items:center;color:#7C8699;margin-top:-2px;transition:color .2s var(--dep)}
.q-nav a b{display:block;font-weight:600;font-size:14.5px;color:var(--encre);line-height:1.3;transition:color .2s var(--dep)}
.q-nav a .q-tx span{display:block;font-size:13px;color:var(--gris);line-height:1.3}
.q-nav a.q-on .q-ico,.q-nav a:hover .q-ico{color:var(--bleu)}
.q-nav a.q-on b{color:var(--bleu)}
/* JARVIS Academy, en pied : la fleur tourne, respire, suit le pointeur et le défilement */
.q-academy{position:relative;margin:16px 20px 0;padding-top:24px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px}
.q-academy::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--filet);transform-origin:0 50%}
.q-fleur{width:84px;height:84px;position:relative;margin-bottom:8px}
.q-fleur .q-suit,.q-fleur .q-ouvre{position:absolute;inset:0;display:block}
.q-fleur .q-suit{will-change:transform}
.q-fleur svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;display:block}
.q-js .q-fleur .q-lobes{animation:q-tourne 26s linear infinite}
.q-js .q-fleur .q-coeur{animation:q-respire-fleur 7s var(--sin) infinite}
@keyframes q-tourne{to{transform:rotate(360deg)}}
@keyframes q-respire-fleur{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.q-academy b{font-size:16px;font-weight:700;color:var(--encre);line-height:1.3}
.q-academy .q-ph{font-size:13px;color:var(--gris);line-height:1.3}
.q-academy .q-btn{margin-top:12px;background:var(--bleu);color:#fff;border-radius:var(--r1);min-height:44px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  font-weight:600;font-size:13.5px;width:100%;box-shadow:0 8px 16px -8px rgba(0,80,230,.6);transition:translate var(--tvif) var(--vif),scale var(--tvif) var(--vif)}
.q-academy:hover .q-btn{translate:0 -2px}
.q-academy:active .q-btn{scale:.97;transition-duration:90ms;transition-timing-function:var(--dep)}
/* ---------- colonne centrale ---------- */
.q-main{background:var(--main);border-left:1px solid var(--filet);padding:24px 32px 32px;min-width:0}
.q-haut{display:flex;align-items:center;gap:16px;margin-bottom:24px;position:relative;z-index:5}
.q-haut .q-logo{display:none}
.q-rech{flex:1;max-width:360px;min-width:0;position:relative}
.q-cherche{display:flex;align-items:center;gap:10px;background:var(--blanc);border:1px solid var(--filet);border-radius:var(--r2);height:44px;padding:0 14px;color:#7C8699;cursor:text;transition:border-color .2s var(--dep)}
.q-cherche:focus-within{border-color:var(--bleu-clair)}
.q-cherche input{flex:1;border:0;outline:0;font:inherit;font-size:14px;color:var(--encre);background:transparent;min-width:0;-webkit-appearance:none;appearance:none}
.q-cherche input::-webkit-search-cancel-button,.q-cherche input::-webkit-search-decoration{-webkit-appearance:none;display:none}
.q-cherche kbd{font:600 13px 'Hanken',sans-serif;color:var(--gris);border:1px solid var(--filet);border-radius:6px;padding:2px 8px}
/* la liste naît du champ : elle n'existe que pendant la saisie */
.q-res{position:absolute;left:0;right:0;top:52px;height:0;background:var(--blanc);border:1px solid var(--filet);border-radius:var(--r2);box-shadow:0 24px 48px -24px rgba(11,21,48,.4),var(--pose);overflow:hidden;z-index:20}
.q-res-in{position:relative;padding:6px}
.q-res-hl{position:absolute;left:6px;right:6px;top:0;height:100px;background:var(--halo);border-radius:var(--r1);transform-origin:0 0;will-change:transform}
.q-r{position:relative;display:flex;align-items:center;gap:12px;min-height:48px;padding:6px 10px;border-radius:var(--r1)}
.q-r .q-r-ic{width:32px;height:32px;border-radius:var(--r1);display:grid;place-items:center;background:var(--halo);color:var(--bleu);flex:none}
.q-r b{display:block;font-size:14px;font-weight:600;line-height:1.3}
.q-r .q-r-tx span{display:block;font-size:13px;color:var(--gris);line-height:1.3}
.q-r mark{background:none;color:var(--bleu)}
.q-res-vide{position:relative;padding:14px 10px;font-size:13.5px;color:var(--gris)}
.q-bt{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 4px;margin-left:auto}
.q-bt>span{display:inline-flex;align-items:center;gap:6px;background:var(--bleu);color:#fff;font-weight:600;font-size:13.5px;border-radius:var(--r1);padding:0 16px;height:36px;box-shadow:0 8px 16px -8px rgba(0,80,230,.6);transition:translate var(--tvif) var(--vif),scale var(--tvif) var(--vif)}
.q-bt:hover>span{translate:0 -2px}
.q-bt:active>span{scale:.97;transition-duration:90ms;transition-timing-function:var(--dep)}
.q-bt.q-petit>span{height:28px;padding:0 12px;font-size:13px}
/* ---------- bandeau bleu ---------- */
.q-bandeau{position:relative;display:block;border-radius:var(--r3);background:linear-gradient(100deg,#0C4CDC 0%,#0046CC 55%,#063DB4 100%);color:#fff;padding:32px;min-height:164px;overflow:visible;
  box-shadow:0 22px 40px -22px rgba(0,80,230,.7)}
.q-bandeau .q-lum,.q-bandeau .q-rai{position:absolute;inset:0;border-radius:var(--r3);overflow:hidden;pointer-events:none}
/* la seule lumière du bandeau vient du pointeur (et, dans le dessin, de la croix, des vitrines et de la porte) */
.q-bandeau .q-lum i{position:absolute;left:-210px;top:-210px;width:420px;height:420px;background:radial-gradient(closest-side,rgba(255,255,255,.1),rgba(255,255,255,0));opacity:0;transition:opacity .3s var(--dep);will-change:transform}
.q-bandeau.q-pres .q-lum i{opacity:var(--lo,1)}
.q-bandeau .q-rai i{position:absolute;top:-40%;bottom:-40%;width:120px;left:0;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.06),rgba(255,255,255,0));transform:translateX(-240px) skewX(-18deg)}
.q-js .q-bandeau .q-rai i{animation:q-rai 14s linear infinite}
@keyframes q-rai{from{transform:translateX(-240px) skewX(-18deg)}to{transform:translateX(1100px) skewX(-18deg)}}
.q-bandeau h1{font-size:24px;font-weight:700;letter-spacing:-.01em;line-height:1.1;position:relative}
.q-bandeau .q-date{font-size:13.5px;color:#fff;margin-top:4px;position:relative}
.q-bandeau p{font-size:14px;line-height:1.45;margin-top:12px;max-width:52%;color:#fff;position:relative}
.q-bandeau p b{color:#fff;font-weight:700;font-size:16px}
.q-bandeau .q-pill{display:inline-flex;align-items:center;min-height:44px;margin-top:8px;position:relative}
.q-bandeau .q-pill>span{display:inline-flex;align-items:center;gap:6px;background:#fff;color:var(--bleu);font-weight:700;font-size:13px;border-radius:var(--r1);padding:0 12px;height:32px}
.q-bandeau .q-pill svg{width:14px;height:14px;will-change:transform}
/* ---------- l'officine dessinée : chaque pièce est une couche, pour que tout se compose sans repeindre ---------- */
.q-illu{position:absolute;right:32px;bottom:0;width:280px;height:200px}
.q-illu span,.q-illu i,.q-illu svg{position:absolute;inset:0;display:block}
.q-illu svg{width:100%;height:100%;overflow:visible}
.q-illu .q-terre{inset:-60% -20% 0 -20%}
.q-illu .q-ter2{inset:37.5% 14.2857% 0 14.2857%}
.q-illu .q-pl{will-change:transform}
.q-illu .q-v1,.q-illu .q-v2,.q-illu .q-v3,.q-illu .q-fl{transform-origin:var(--o)}
/* le vent : deux sinus de périodes premières entre elles, et une rafale qui traverse la scène de gauche à droite */
.q-js .q-illu .q-v1{animation:q-vent-a 8s var(--sin) infinite;animation-delay:var(--a,0s)}
.q-js .q-illu .q-v2{animation:q-vent-b 11s var(--sin) infinite;animation-delay:var(--b,0s)}
.q-js .q-illu .q-v3{animation:q-rafale 17s var(--dep) infinite;animation-delay:var(--r,0s)}
@keyframes q-vent-a{0%,100%{transform:rotate(-1.9deg)}50%{transform:rotate(2.1deg)}}
@keyframes q-vent-b{0%,100%{transform:rotate(1.3deg)}50%{transform:rotate(-1.5deg)}}
@keyframes q-rafale{0%,58%{transform:rotate(0deg)}62%{transform:rotate(5.5deg)}67%{transform:rotate(-2.4deg)}73%{transform:rotate(1.3deg)}80%{transform:rotate(-.6deg)}88%,100%{transform:rotate(0deg)}}
/* la croix : un halo qui vient d'elle, un corps, des diodes */
.q-illu .q-halo{inset:auto;left:5.333%;top:7.477%;width:30.667%;height:42.991%;border-radius:50%;background:radial-gradient(closest-side,rgba(92,240,168,.9),rgba(47,208,138,.35) 45%,rgba(30,158,106,0))}
.q-illu .q-cx{transform-origin:20.667% 28.972%}
.q-illu .q-k{fill:none;stroke:#F2FFF8;stroke-width:3.4;opacity:0}
.q-illu .q-om,.q-illu .q-ba,.q-illu .q-br{opacity:0}
@keyframes q-flic{0%{opacity:0}9%{opacity:1}30%{opacity:.1}47%{opacity:1}66%{opacity:.2}82%,100%{opacity:1}}
@keyframes q-respire{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes q-battre{0%,100%{opacity:1}50%{opacity:.75}}
@keyframes q-led{0%{opacity:0}35%{opacity:.95}100%{opacity:0}}
@keyframes q-ombre{0%,100%{opacity:0}14%,82%{opacity:.5}}
@keyframes q-balai{0%{transform:translateY(60px);opacity:.92}58%{transform:translateY(0);opacity:.92}100%{transform:translateY(0);opacity:0}}
.q-js .q-illu.q-allume .q-halo{animation:q-flic .26s var(--dep) both,q-respire 6s var(--sin) .26s infinite}
.q-js .q-illu.q-allume .q-cc{animation:q-flic .26s var(--dep) both,q-battre 6s var(--sin) .26s infinite}
.q-illu.q-s1 .q-k{animation:q-led .34s var(--dep) both;animation-delay:calc(var(--i)*.18s)}
.q-illu.q-s1 .q-om{animation:q-ombre .9s var(--dep) both}
.q-illu.q-s2 .q-ba{animation:q-balai 1s var(--dep) both}
.q-illu.q-s2 .q-om{animation:q-ombre 1s var(--dep) both}
.q-illu.q-s3 .q-br{animation:q-led .28s var(--dep) both;animation-delay:calc(var(--i)*.19s)}
.q-illu.q-s3 .q-k4{animation:q-led .34s var(--dep) .8s both}
.q-illu.q-s3 .q-om{animation:q-ombre 1.14s var(--dep) both}
/* la façade */
.q-illu .q-nuit,.q-illu .q-ecl{inset:auto;border-radius:9.5%;opacity:0}
.q-illu .q-nuit{background:var(--nuit)}.q-illu .q-ecl{background:#fff}.q-illu .q-po{border-radius:11.5%/4.3%}
.q-illu .q-coffre{inset:52.103% 0 0 0;overflow:hidden}
.q-illu .q-banne{inset:auto;left:0;top:-108.78%;width:100%;height:208.78%;transform-origin:51% 52.34%}
.q-illu .q-fe{inset:auto;top:58.879%;width:5.333%;height:5.607%;transform-origin:50% 16.67%}
.q-illu .q-fe path{fill:none;stroke:#1E62E8;stroke-width:2;stroke-linecap:round}
@keyframes q-eclair{0%{opacity:0}30%{opacity:.5}100%{opacity:0}}
/* titres de section */
.q-sec{display:flex;align-items:center;justify-content:space-between;margin:24px 0 8px;min-height:44px}
.q-sec h2{font-size:16px;font-weight:700;line-height:1.3}
/* ---------- cinq tuiles ---------- */
.q-tuiles{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.q-tuile{position:relative;background:var(--blanc);border:1px solid var(--filet);border-radius:var(--r2);padding:16px 8px 12px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;min-height:116px;box-shadow:var(--pose)}
.q-tuile::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:0 14px 22px -14px rgba(11,21,48,.3);opacity:0;transition:opacity .2s var(--dep);pointer-events:none}
.q-tuile:hover::after{opacity:1}
.q-tuile .q-ico{width:44px;height:44px;border-radius:var(--r2);display:grid;place-items:center;color:#fff}
.q-tuile b{font-size:13.5px;font-weight:700;display:block;line-height:1.3}
.q-tuile .q-tx span{font-size:13px;color:var(--gris);display:block;line-height:1.3;text-wrap:balance}
.q-t-bleu{background:linear-gradient(145deg,#3D82FF,#0050E6)}
.q-t-vert{background:linear-gradient(145deg,#2FB983,#1E9E6A)}
.q-t-ambre{background:linear-gradient(145deg,#E09434,#C7791A)}
.q-t-clair{background:linear-gradient(145deg,#6FA3FF,#3D82FF)}
.q-t-nuit{background:linear-gradient(145deg,#24335E,#0B1530)}
/* ---------- les gestes des pictos : 400 ms, un par outil, dessinés de la même main que l'officine ---------- */
.q-g .q-a-fe{animation:q-g-store .4s var(--dep)}.q-a-fe{transform-origin:12px 10px}
.q-g .q-a-couv{animation:q-g-boite .4s var(--dep)}.q-a-couv{transform-origin:12px 7.5px}
.q-g .q-a-aig{animation:q-g-aig .4s var(--dep)}.q-a-aig{transform-origin:12px 18px}
.q-g .q-a-onde{animation:q-g-onde .4s var(--dep)}.q-a-onde{transform-origin:17px 12px}
.q-g .q-a-ray{animation:q-g-soleil .4s var(--dep)}.q-a-ray{transform-origin:12px 12px}
.q-g .q-a-page{animation:q-g-page .4s var(--dep)}.q-a-page{transform-origin:12px 10px}
.q-g .q-a-pin{animation:q-g-pin .4s var(--dep)}.q-a-pin{transform-origin:12px 21px}
.q-g .q-a-haut{animation:q-g-caisse .4s var(--dep)}.q-a-haut{transform-origin:12px 12px}
.q-g .q-a-c{stroke-dasharray:1;animation:q-g-coche .24s var(--dep) both;animation-delay:calc(var(--i)*80ms)}
.q-g .q-a-n{animation:q-g-noeud .24s var(--dep) both;animation-delay:calc(var(--i)*80ms)}.q-a-n{transform-box:fill-box;transform-origin:50% 50%}
.q-g .q-a-chariot{animation:q-g-chariot .4s var(--dep)}.q-a-chariot{transform-origin:13px 20px}
.q-g .q-a-oeil{animation:q-g-oeil .4s var(--dep)}.q-g .q-a-pup{animation:q-g-pup .4s var(--dep)}.q-a-oeil,.q-a-pup{transform-origin:12px 12px}
@keyframes q-g-store{0%,100%{transform:scaleY(1)}30%{transform:scaleY(1.8)}62%{transform:scaleY(.7)}}
@keyframes q-g-boite{0%,100%{transform:none}38%{transform:translateY(-3.2px) rotate(-7deg)}72%{transform:translateY(-.8px) rotate(2deg)}}
@keyframes q-g-aig{0%,100%{transform:rotate(0deg)}32%{transform:rotate(-96deg)}74%{transform:rotate(13deg)}}
@keyframes q-g-onde{0%{transform:none;opacity:1}46%{transform:translateX(3.6px) scale(1.5);opacity:0}47%{transform:translateX(-1.5px) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes q-g-soleil{0%{transform:rotate(0deg)}70%{transform:rotate(98deg)}100%{transform:rotate(90deg)}}
@keyframes q-g-page{0%,100%{transform:scaleY(1)}46%{transform:scaleY(.08)}}
@keyframes q-g-pin{0%,100%{transform:none}26%{transform:translateY(-6px)}56%{transform:translateY(0) scale(1.07,.9)}78%{transform:translateY(-1.8px)}}
@keyframes q-g-caisse{0%,100%{transform:none}30%{transform:translateY(-4px)}60%{transform:translateY(0) scale(1.06,.9)}80%{transform:translateY(-1px)}}
@keyframes q-g-coche{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes q-g-noeud{0%,100%{transform:scale(1)}45%{transform:scale(1.4)}}
@keyframes q-g-chariot{0%,100%{transform:none}36%{transform:translateX(3px) rotate(-6deg)}72%{transform:translateX(-1px) rotate(1.5deg)}}
@keyframes q-g-oeil{0%,36%,100%{transform:scaleY(1)}18%{transform:scaleY(.1)}}
@keyframes q-g-pup{0%,36%,100%{transform:none}18%{transform:scaleY(.1)}62%{transform:translateX(-1.8px)}84%{transform:translateX(1.4px)}}
/* ---------- tableau ---------- */
.q-table{background:var(--blanc);border:1px solid var(--filet);border-radius:var(--r2);position:relative;box-shadow:var(--pose)}
.q-table .q-tete,.q-table .q-lg{display:grid;grid-template-columns:1fr 2.1fr .75fr;align-items:center;padding:0 20px;gap:12px}
.q-table .q-tete{min-height:40px;padding-top:10px;padding-bottom:10px;color:var(--gris);font-size:13px;border-bottom:1px solid var(--filet)}
.q-table .q-corps{position:relative;padding:4px 0 8px}
/* une seule teinte pâle, qui glisse d'une ligne à l'autre */
.q-table .q-select{position:absolute;left:4px;right:4px;top:0;height:100px;border-radius:var(--r1);background:var(--halo);transform-origin:0 0;will-change:transform;z-index:0;opacity:0;transition:opacity .2s var(--dep)}
.q-table .q-corps.q-survol .q-select{opacity:1}
.q-table .q-lg{position:relative;z-index:1;min-height:44px;padding-top:8px;padding-bottom:8px;color:var(--encre)}
.q-table .q-lg b{font-weight:600;font-size:14px;line-height:1.3}
.q-table .q-lg>span{font-size:13.5px;color:var(--gris);line-height:1.3}
.q-table .q-lg .q-st{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 10px 0 5px;border:1px solid var(--filet);border-radius:999px;font-size:13px;font-weight:500;background:var(--blanc);color:var(--encre);justify-self:start;white-space:nowrap}
.q-table .q-lg .q-st i{width:16px;height:16px;border-radius:50%;background:var(--ambre);flex:none;display:grid;place-items:center}
.q-table .q-lg .q-st i::after{content:"";width:6px;height:6px;border-radius:50%;background:#fff}
.q-table .q-lg .q-st.q-decouvrir i{background:var(--bleu-clair)}
/* ---------- colonne droite ---------- */
.q-droite{background:var(--blanc);border-left:1px solid var(--filet);padding:16px 16px 24px;min-width:0}
.q-pan{background:#EEF1F6;border-radius:var(--r3);padding:24px 16px 16px;display:flex;flex-direction:column;gap:16px;margin-bottom:24px}
.q-profil{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;padding-bottom:16px;position:relative}
.q-profil::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:#DDE2EB;transform-origin:0 50%}
.q-profil .q-avatar{width:72px;height:72px;border-radius:50%;color:#fff;font-size:30px;font-weight:700;display:grid;place-items:center;margin-bottom:8px;
  background:linear-gradient(145deg,#3D82FF,#0050E6 60%,#0040B8);box-shadow:0 10px 24px -8px rgba(0,80,230,.45)}
.q-profil b{font-size:16px;font-weight:700;line-height:1.3}
.q-profil .q-role{font-size:13px;color:var(--gris);line-height:1.3}
/* la pastille émet un anneau toutes les 3 s */
.q-sec.q-d{margin:0;min-height:32px}
.q-sec.q-d h2{font-size:15px}
.q-mois{display:inline-flex;align-items:center;gap:6px;background:var(--blanc);border:1px solid var(--filet);color:var(--bleu);font-weight:600;font-size:13px;border-radius:var(--r1);padding:0 10px;height:32px}
.q-jours{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:-4px}
.q-jour{position:relative;isolation:isolate;border-radius:var(--r1);text-align:center;padding:8px 0}
.q-jour small{display:block;font-size:13px;font-weight:500;color:var(--gris)}
.q-jour b{display:block;font-size:14px;font-weight:700;margin-top:4px;color:var(--encre)}
.q-jour.q-passe b{color:var(--gris)}
/* aujourd'hui : un tampon nuit bleue, posé en dernier ; c'est lui qui imprime le jour (texte blanc) */
.q-liste{display:flex;flex-direction:column;gap:8px}
.q-rel{display:grid;grid-template-columns:20px 1fr 32px;column-gap:12px;align-items:start;align-content:center;min-height:64px;padding:12px;border-radius:var(--r2);background:var(--blanc);border:1px solid var(--filet);box-shadow:var(--pose)}
.q-rel>.q-ic{color:var(--gris);margin-top:-1px}
.q-rel .q-av{width:32px;height:32px;border-radius:50%;background:var(--halo);color:var(--bleu);font-weight:700;font-size:13px;display:grid;place-items:center;align-self:center}
.q-rel .q-tx{min-width:0;line-height:1.3}
.q-rel .q-tx b{display:block;font-size:14px;font-weight:600}
.q-rel .q-tx span{display:block;font-size:13px;color:var(--gris)}
.q-rel .q-tx em{font-style:normal;font-weight:600;color:var(--gris)}
.q-rel .q-tx em.q-tard{color:var(--retard)}
.q-rel .q-tx em.q-jour-j{color:var(--bleu)}
.q-tout{display:flex;align-items:center;justify-content:center;min-height:48px;border:1px solid #CBD2DE;border-radius:var(--r2);font-weight:600;font-size:14px;color:var(--encre)}
.q-note-ex{font-size:13px;color:var(--gris);line-height:1.35;padding:0 4px}
.q-droite .q-sec.q-d.q-infos-t{margin:0 4px 12px}
.q-infos{display:block;background:var(--blanc);border:1px solid var(--filet);border-radius:var(--r2);padding:12px;position:relative;box-shadow:var(--pose)}
.q-infos .q-titre{font-size:13.5px;font-weight:600;line-height:1.3;margin-bottom:12px}
.q-infos .q-trio{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.q-infos .q-v{background:var(--main);border:1px solid var(--filet);border-radius:var(--r1);text-align:center;padding:12px 4px 8px;display:flex;flex-direction:column;align-items:center}
.q-infos .q-v b{display:block;font-size:22px;font-weight:800;line-height:1;color:var(--encre)}
.q-infos .q-v span{display:block;font-size:13px;color:var(--gris);margin:4px 0 8px;line-height:1.3;text-wrap:balance}
.q-infos .q-v em{display:inline-block;font-style:normal;background:var(--bleu);color:#fff;font-size:13px;font-weight:600;border-radius:6px;padding:3px 8px;margin-top:auto}
.q-infos .q-v:nth-child(1) em{background:var(--vert-fonce)}
.q-infos .q-lire{display:flex;align-items:center;gap:6px;color:var(--bleu);font-weight:700;font-size:13.5px;margin-top:12px}
.q-infos .q-lire svg{width:15px;height:15px}
.q-note{font-size:13px;color:var(--gris);padding:16px 20px 0}
/* ---------- ce qui se touche s'enfonce (90 ms), et revient au ressort ---------- */
.q-nav a,.q-tuile,.q-rel,.q-tout,.q-infos,.q-table .q-lg,.q-pill>span{transition:scale var(--tvif) var(--vif)}
.q-nav a:active,.q-tuile:active,.q-rel:active,.q-tout:active,.q-infos:active,.q-table .q-lg:active,.q-bandeau:active .q-pill>span{scale:.97;transition:scale 90ms var(--dep)}
.q-parti{opacity:0!important}
/* ---------- panneau « Vous ouvrez » : l'élément cliqué devient le panneau ---------- */
.q-overlay{position:fixed;inset:0;background:rgba(11,21,48,.35);opacity:0;pointer-events:none;z-index:50}
.q-overlay.q-open{pointer-events:auto}
.q-page:not(.q-js) .q-overlay{transition:opacity .12s var(--dep)!important}
.q-page:not(.q-js) .q-overlay.q-open{opacity:1}
.q-page:not(.q-js) .q-panel{opacity:0;transition:opacity .12s var(--dep),visibility 0s .12s!important}
.q-page:not(.q-js) .q-panel.q-open{opacity:1;transition:opacity .12s var(--dep)!important}
.q-calme .q-bt:hover>span,.q-calme .q-academy:hover .q-btn{translate:none}
.q-calme :active{scale:none!important}
.q-panel{position:fixed;left:50%;top:50%;width:min(420px,calc(100vw - 32px));transform:translate(-50%,-50%);z-index:51;visibility:hidden}
.q-panel.q-open{visibility:visible}
.q-panel.q-sort{pointer-events:none}
.q-p-ombre,.q-p-surf{position:absolute;inset:0;border-radius:var(--r3);transform-origin:0 0;will-change:transform}
.q-p-ombre{box-shadow:0 40px 80px -30px rgba(11,21,48,.5)}
.q-p-surf{background:#fff}
.q-p-corps{position:relative;padding:24px 24px 20px}
.q-p-tete{display:flex;align-items:center;gap:12px}
.q-p-ico{position:relative;width:44px;height:44px;border-radius:var(--r2);display:grid;place-items:center;flex:none;color:var(--bleu);will-change:transform}
.q-p-ico i{position:absolute;inset:0;border-radius:inherit;background:var(--halo)}
.q-p-ico svg{position:relative}
.q-panel-titre{font-size:18px;font-weight:700;color:var(--encre);line-height:1.3;will-change:transform}
/* ---------- anneau de focus : un seul, il glisse d'un élément à l'autre ---------- */
.q-anneau{position:fixed;left:0;top:0;width:10px;height:10px;border:2px solid var(--bleu);border-radius:12px;pointer-events:none;z-index:60;opacity:0;transition:opacity .15s var(--dep);will-change:transform}
.q-anneau.q-vu{opacity:1}
/* ---------- entrée : le masquage est posé par le script (classe js), jamais par la feuille seule ---------- */
.q-js .q-in{opacity:0;translate:0 16px}
.q-js .q-in.q-g{translate:-12px 0}
.q-js .q-in.q-e{scale:.96}
.q-js .q-lg.q-in{translate:0 10px}
.q-js.q-go .q-in{opacity:1;translate:0 0;scale:1;transition:opacity .15s var(--dep) var(--d,0ms),translate var(--tdoux) var(--doux) var(--d,0ms),scale var(--tdoux) var(--doux) var(--d,0ms)}
/* l'avatar se pose au ressort vif */
.q-js.q-go .q-profil .q-avatar.q-in{transition:opacity .15s var(--dep) var(--d,0ms),translate var(--tvif) var(--vif) var(--d,0ms),scale var(--tvif) var(--vif) var(--d,0ms)}
/* sous la ligne de flottaison : le bloc attend son tour, sans jamais être transparent */
.q-js .q-in.q-arme,.q-js.q-go .q-in.q-arme{opacity:1;translate:0 20px;scale:1;transition:none}
.q-js .q-lg.q-in.q-arme,.q-js.q-go .q-lg.q-in.q-arme{translate:0 8px}
/* les textes montent de derrière un cache */
.q-mo{display:inline-block;clip-path:inset(-.14em -.08em -.24em)}
.q-mi,.q-mj{display:inline-block}
.q-js .q-mi,.q-js .q-mj{translate:0 100%}
.q-js.q-go .q-mi,.q-js .q-la .q-mj{translate:0 0;transition:translate var(--tdoux) var(--doux) var(--d,0ms)}
/* le 690 : un tambour par chiffre */
.q-tb{white-space:nowrap}
.q-tb .q-col{display:inline-block;position:relative;clip-path:inset(.2em -1px)}
.q-tb .q-ph{visibility:hidden}
.q-tb .q-rb{position:absolute;left:0;top:.2em;display:block;line-height:1.05;will-change:transform}
.q-tb .q-rb span{display:block;height:1.05em}
.q-js.q-go .q-tb .q-rb{transform:translateY(var(--y));transition:transform var(--tdoux) var(--doux) var(--d)}
/* le bouton du bandeau, puis sa flèche */
.q-js .q-pill>span{opacity:0;translate:-10px 0;scale:.96}
.q-js.q-go .q-pill>span{opacity:1;translate:0 0;scale:1;transition:opacity .15s var(--dep) .4s,translate var(--tvif) var(--vif) .4s,scale var(--tvif) var(--vif) .4s}
.q-js .q-pill svg{translate:-7px 0}
.q-js.q-go .q-pill svg{translate:0 0;transition:translate var(--tvif) var(--vif) .52s}
/* les pictos se dessinent juste après la pose de leur élément */
.q-js .q-dz .q-p{stroke-dasharray:1;stroke-dashoffset:1;opacity:0}
.q-js.q-go .q-dz .q-p{stroke-dashoffset:0;opacity:1;transition:stroke-dashoffset .45s var(--dep) calc(var(--d,0ms) + 120ms),opacity .1s var(--dep) calc(var(--d,0ms) + 120ms)}
.q-js .q-arme .q-dz .q-p,.q-js.q-go .q-arme .q-dz .q-p{stroke-dashoffset:1;opacity:0;transition:none}
/* le repère de la barre latérale */
.q-js .q-nav .q-barre,.q-js .q-nav .q-fond{opacity:0}
.q-js.q-go .q-nav .q-barre,.q-js.q-go .q-nav .q-fond{opacity:1;transition:opacity .15s var(--dep) .12s}
/* l'officine ouvre : feuillage, façade, plante, croix (éteinte), store, vitrines */
.q-js .q-bandeau:not(.q-fini) .q-illu .q-terre{overflow:hidden}
.q-js .q-illu .q-fl{transform:translateY(24px) rotate(var(--u,-9deg))}
.q-js.q-go .q-illu .q-fl{transform:none;transition:transform var(--tlourd) var(--lourd) var(--d,0ms)}
.q-js .q-illu .q-mt{opacity:0;translate:0 24px}
.q-js.q-go .q-illu .q-mt{opacity:1;translate:0 0;transition:opacity .15s var(--dep) 60ms,translate var(--tdoux) var(--doux) 60ms}
.q-js .q-illu .q-mp{opacity:0;translate:0 14px}
.q-js.q-go .q-illu .q-mp{opacity:1;translate:0 0;transition:opacity .15s var(--dep) 180ms,translate var(--tvif) var(--vif) 180ms}
.q-js .q-illu .q-pot{opacity:0}
.q-js.q-go .q-illu .q-pot{opacity:1;transition:opacity .15s var(--dep) 140ms}
.q-js .q-illu .q-cx{scale:0}
.q-js.q-go .q-illu .q-cx{scale:1;transition:scale var(--trebond) var(--rebond) 160ms}
.q-js .q-illu .q-halo,.q-js .q-illu .q-cc{opacity:0}
.q-js .q-illu .q-banne{translate:0 -7.944%}
.q-js.q-go .q-illu .q-banne{translate:0 0;transition:translate var(--tdoux) var(--doux) 280ms}
.q-js .q-illu .q-fe{opacity:0;translate:0 -45%}
.q-js.q-go .q-illu .q-fe{opacity:1;translate:0 0;transition:opacity .12s var(--dep) calc(400ms + var(--i)*30ms),translate var(--tvif) var(--vif) calc(400ms + var(--i)*30ms)}
.q-js .q-illu .q-nuit{opacity:.42}
.q-js.q-go .q-illu .q-nuit{opacity:0;transition:opacity .22s var(--dep) var(--d)}
.q-js.q-go .q-illu .q-ecl{animation:q-eclair .5s var(--dep) var(--d) both}
/* les deux filets se tracent de gauche à droite */
.q-js .q-profil::after,.q-js .q-academy::before{scale:0 1}
.q-js.q-go .q-profil::after{scale:1 1;transition:scale .5s var(--arr) .33s}
.q-js.q-go .q-academy::before{scale:1 1;transition:scale .5s var(--arr) .44s}
/* la fleur, le tampon du jour, la pastille */
.q-js .q-fleur .q-ouvre{scale:0;rotate:-90deg}
.q-js .q-fleur.q-la .q-ouvre{scale:1;rotate:0deg;transition:scale var(--tvif) var(--vif),rotate var(--tlourd) var(--lourd)}
/* après l'entrée : plus aucune transition d'entrée ne traîne, le script pilote */
.q-js .q-bandeau.q-fini .q-pill>span{transition:scale var(--tvif) var(--vif)}
.q-js .q-bandeau.q-fini .q-pill svg,.q-js .q-bandeau.q-fini .q-illu .q-fl{transition:none}
/* boucles suspendues : onglet caché, ou élément hors de l'écran */
.q-pause *,.q-pause *::before,.q-pause *::after,.q-hors,.q-hors *,.q-hors *::before{animation-play-state:paused!important}
/* ---------- 390 ---------- */
@media (max-width:860px){
  .q-app{padding:0}
  .q-carte{grid-template-columns:1fr;border-radius:0;min-height:0;box-shadow:none;background:var(--main)}
  .q-main,.q-side{display:contents}
  .q-side .q-logo{display:none}
  .q-haut{order:1;margin:16px 16px 12px;flex-wrap:wrap;gap:12px}
  .q-haut .q-logo{display:flex;padding:0;width:100%;min-height:0}
  .q-rech{max-width:none;flex:1 1 120px}
  .q-res{right:auto;width:calc(100vw - 32px)}
  .q-cherche input{font-size:16px}
  .q-cherche kbd{display:none}
  .q-bt.q-haut-bt{margin-left:0;flex:none}
  .q-bandeau{order:2;margin:40px 16px 0;padding:24px 20px 16px;min-height:0}
  .q-bandeau p{max-width:none}
  .q-illu{right:-4px;width:150px;height:108px;bottom:auto;top:-48px}
  .q-nav{order:3;background:var(--blanc);border:1px solid var(--filet);border-radius:var(--r2);margin:24px 16px 0;overflow:hidden}
  .q-nav .q-barre{right:auto;left:0;border-radius:0 3px 3px 0}
  .q-nav .q-barre,.q-nav .q-fond{transform:scaleY(.52)}
  .q-nav a{padding:8px 16px 8px 20px}
  .q-sec{margin:24px 16px 8px}
  .q-sec.q-outils{order:4}
  .q-tuiles{order:5;margin:0 16px;grid-template-columns:repeat(2,1fr)}
  .q-tuile:last-child{grid-column:1/-1;flex-direction:row;text-align:left;gap:12px;min-height:0;padding:12px 16px}
  .q-droite{order:6;border-left:0;padding:24px 16px 0;background:transparent}
  .q-pan{padding:20px 16px 16px;border-radius:var(--r2);margin-bottom:24px}
  .q-profil{display:none}
  .q-droite .q-sec.q-d.q-infos-t{margin-left:0;margin-right:0}
  .q-sec#q-tous{order:7}
  .q-table{order:8;margin:0 16px}
  .q-table .q-tete,.q-table .q-lg{grid-template-columns:1fr 1fr;padding-left:16px;padding-right:16px}
  .q-table .q-lg>span:not(.q-st),.q-table .q-tete .q-c2{display:none}
  .q-academy{order:9;margin:12px 16px 0;padding:20px 16px 16px;border:1px solid var(--filet);border-radius:var(--r2);background:var(--blanc)}
  .q-academy::before{display:none}
  .q-fleur{width:72px;height:72px}
  .q-note{order:10;padding:16px 16px 20px}
}
@media (prefers-reduced-motion:reduce){
  .q-page *,.q-page *::before,.q-page *::after,.q-portail *,.q-portail *::before,.q-portail *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
/* ---------- ajouts de l'app : ce que la maquette n'a pas (branchements sur les vraies données) ---------- */
/* avatar du profil : un bouton qui ouvre le menu du compte (déconnexion) ; sur téléphone, le même dans la ligne du logo */
.q-profil .q-avatar{border:0;padding:0;cursor:pointer;font-family:inherit}
.q-moi{display:none}
/* « Nouveau » : une annonce hors classement, de la même main que le bloc Infos */
.q-une{display:grid;grid-template-columns:44px minmax(0,1fr) 16px;column-gap:12px;align-items:center;min-height:72px;margin-top:16px;padding:12px 16px;border-radius:var(--r2);background:var(--blanc);border:1px solid var(--filet);box-shadow:var(--pose)}
.q-une .q-ico{width:44px;height:44px;border-radius:var(--r2);display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#6FA3FF,#3D82FF)}
.q-une .q-nv{display:inline-block;font-style:normal;background:var(--bleu);color:#fff;font-size:13px;font-weight:600;line-height:1.3;border-radius:6px;padding:2px 8px;margin-bottom:4px}
.q-une .q-tx{min-width:0}
.q-une b{display:block;font-size:14px;font-weight:700;line-height:1.3}
.q-une .q-tx>span{display:block;font-size:13px;color:var(--gris);line-height:1.3}
.q-une>svg.q-ic{width:16px;height:16px;color:var(--bleu)}
.q-une,.q-une:active{transition:scale var(--tvif) var(--vif)}
.q-une:active{scale:.97;transition:scale 90ms var(--dep)}
.q-calme .q-une:active{scale:none}
/* la semaine : un point sous les jours qui portent une relance ; ces jours sont des boutons de 44 px */
.q-jour{padding-bottom:12px}
.q-jour.q-rdv{margin:0 -6px;padding:8px 6px 12px;min-height:44px;cursor:pointer}
.q-jour .q-pt{position:absolute;left:50%;bottom:4px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#7C8699}
.q-jour .q-pt.q-tard{background:var(--retard)}
.q-jour .q-pt.q-jour-j{background:var(--bleu)}
.q-jours{position:relative}
.q-jour{z-index:1}
/* la pastille du jour : une forme qui glisse, et par-dessus elle une copie des sept jours en blanc, découpée à sa taille (le texte s'inverse exactement dessous) */
.q-pil{position:absolute;left:0;top:0;bottom:0;width:34px;border-radius:var(--r1);background:var(--nuit);box-shadow:0 10px 18px -10px rgba(11,21,48,.7);pointer-events:none;z-index:0}
.q-inv{position:absolute;inset:0;display:grid;grid-template-columns:repeat(7,1fr);gap:4px;background:var(--nuit);pointer-events:none;z-index:2}
.q-inv .q-jour small,.q-inv .q-jour b{color:#fff}
.q-inv .q-pt{background:#fff}
.q-js .q-pil,.q-js .q-inv{opacity:0}
.q-rel{z-index:0}
.q-rel.q-porte{z-index:2}
.q-tout[hidden],.q-vide[hidden]{display:none}
.q-infos .q-v.q-vieux em{background:var(--bleu)}
.q-p-corps{padding:24px}
.q-vide{font-size:13px;color:var(--gris);line-height:1.35;padding:0 4px}
/* un picto sans geste dessiné à la main joue un petit rebond d'ensemble */
.q-g .q-gen{animation:q-g-gen .4s var(--dep);transform-origin:12px 12px}
@keyframes q-g-gen{0%,100%{transform:none}35%{transform:scale(1.16) rotate(-4deg)}70%{transform:scale(.97)}}
/* sans classement d'usage : la colonne « Usage » n'existe pas */
.q-sans-usage .q-table .q-tete,.q-sans-usage .q-table .q-lg{grid-template-columns:1fr 2.1fr}
.q-sans-usage .q-lg .q-st,.q-sans-usage .q-tete span:last-child{display:none}
.q-table .q-lg.q-ext{cursor:pointer}
/* l'ouverture d'un outil mène au vrai écran : le panneau n'est qu'une carte (icône et nom), sans texte ni bouton */
.q-portail{position:static}
.q-portail.q-fond{transition:opacity .14s var(--dep)}
.q-portail.q-fond.q-evanouit{opacity:0}
@media (max-width:860px){
  .q-haut .q-logo .q-moi{display:grid;margin-left:auto;width:44px;height:44px;border-radius:50%;place-items:center;color:#fff;font-weight:700;font-size:14px;font-family:inherit;border:0;padding:0;cursor:pointer;background:linear-gradient(145deg,#3D82FF,#0050E6 60%,#0040B8);box-shadow:0 6px 14px -6px rgba(0,80,230,.6)}
  .q-une{order:2;margin:16px 16px 0}
  .q-extra{order:2;margin:16px 16px 0}
  .q-liste-plus{margin:0}
}
.q-rel[hidden]{display:none}
.q-jour .q-pt{transition:transform .2s var(--dep)}
.q-jour.q-vise .q-pt{transform:scale(1.8)}
`;
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
  // ACCUEIL « q1 · L'officine s'éveille » (choisi par Will le 02/10/2026 ; remplace g4, validé le 30/09/2026)
  // Même accueil pour tous : les outils sont rangés selon le nombre total
  // d'ouvertures de l'équipe (table usage_ecran, lue par la fonction Supabase
  // accueil_ouvertures, qui ne rend que des totaux). Le RANG seul est affiché :
  // jamais de chiffre d'ouvertures ni de nom de personne. Répartition de la maquette q1 : Officines et six autres outils
  // dans la barre, cinq tuiles, le reste dans le tableau. Hors OPSO uniquement.
  // ════════════════════════════════════════════
  // Ordre de repli (mesure du 30/09/2026), utilisé tant que le vrai classement n'est pas là.
  var G4_REPLI = ['pharma', 'produits', 'pilotage', 'marketing', 'infos', 'rdv', 'carte', 'appro', 'todo', 'biosimilaires', 'offilog', 'concurrents', 'remontees', 'marchefr', 'carteGrp', 'presentation', 'lgo', 'fiches', 'argument', 'audit', 'groupements', 'reforme2027'];
  // k = nom de la route mesurée par V2.mesurer (= `ecran` côté base) ; page = écran qui doit exister.
  var G4_PORTES = {
    pharma: { ico: 'officines', nom: 'Officines', ph: 'La fiche de chaque client et prospect', page: 'pharma' },
    produits: { ico: 'catalogue', nom: 'Catalogue produits', ph: 'Prix et stock des 7 établissements', page: 'produits' },
    pilotage: { ico: 'pilotage', nom: 'Pilotage', ph: 'CA, marge et objectifs', page: 'pilotage' },
    marketing: { ico: 'marketing', nom: 'Marketing', ph: 'Supports, sélections, LinkedIn', page: 'marketing' },
    infos: { ico: 'infos', nom: 'Infos du matin', ph: 'Le brief du jour', page: 'infos' },
    rdv: { ico: 'rdv', nom: 'Rendez-vous', ph: 'Demander et suivre vos rendez-vous', page: 'rdv' },
    carte: { ico: 'carte', nom: 'La carte', ph: 'Clients, prospects et votre tournée', page: 'carte' },
    appro: { ico: 'appro', nom: 'Appro Intégral', ph: 'Couverture de stock et ruptures', page: 'appro' },
    todo: { ico: 'todo', nom: 'To do list', ph: 'Rendez-vous à demander, remerciements, ouvertures', page: 'todo' },
    biosimilaires: { ico: 'biosim', nom: 'Biosimilaires', ph: 'Les biosimilaires et leurs références', page: 'biosimilaires' },
    offilog: { ico: 'offilog', nom: 'Offilog', ph: 'La centrale parapharmacie', page: 'offilog' },
    concurrents: { ico: 'concurrents', nom: 'Concurrents', ph: 'Ce que font les autres', page: 'concurrents' },
    remontees: { ico: 'remontees', nom: 'Remontées', ph: 'Le mur d\'idées de l\'équipe', page: 'remontees' },
    marchefr: { ico: 'marche', nom: 'Le marché', ph: 'Le marché français d\'une référence, région par région', page: 'marchefr' },
    carteGrp: { ico: 'carte-grp', nom: 'Carte des groupements', ph: 'Où sont les adhérents de chaque groupement', page: 'carteGrp' },
    presentation: { ico: 'presentation', nom: 'Présentation Intégral', ph: 'Le groupe de grossistes-répartiteurs en quelques écrans', page: 'presentation' },
    lgo: { ico: 'lgo', nom: 'Logiciels officine', ph: 'Importer le catalogue dans chaque logiciel', page: 'lgo' },
    fiches: { ico: 'fiches', nom: 'Fiches PDF', ph: 'Les fiches à laisser en officine', page: 'fiches' },
    argument: { ico: 'argument', nom: 'L\'Argument', ph: 'Quoi répondre, objection par objection', page: 'argument' },
    audit: { ico: 'audit', nom: 'Audit marge', ph: 'La marge d\'une officine, calculée avec elle', page: 'audit' },
    // Groupements : pas d'écran à part, c'est l'onglet « groupements » des officines.
    groupements: { ico: 'groupements', nom: 'Groupements', ph: 'Les listes et listings d\'achats', page: 'pharma', js: 'V2.go(\'pharma\',\'groupements\')' },
    // Réforme 2027 : document privé, adresse signée valable 1 h, jamais servi par le dépôt public.
    reforme2027: { ico: 'reforme', nom: 'Réforme 2027', ph: 'Ce qui change pour la marge officinale', page: 'pilotage', js: 'V2.ouvrirDocProtege(\'reforme2027\')' }
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

  // ─────────────────────────────────────────────
  // Q1 : données de l'accueil (rien n'est écrit en dur côté personne ni chiffre)
  // ─────────────────────────────────────────────
  // Pictos de la maquette : le trait se dessine (classe q-p). Douze avec leur geste dessiné à la main,
  // les autres tirés des symboles de la maquette (ils jouent un rebond d'ensemble, classe q-gen).
  var Q_PICTO = {"officines": "<path class=\"q-p\" pathLength=\"1\" d=\"M4 10 5 5h14l1 5\"/><path class=\"q-p\" pathLength=\"1\" d=\"M4 10v10h16V10\"/><path class=\"q-p q-a-fe\" pathLength=\"1\" d=\"M4 10c0 1.6 1.3 2.5 2.7 2.5S9.3 11.6 9.3 10c0 1.6 1.2 2.5 2.7 2.5s2.7-.9 2.7-2.5c0 1.6 1.2 2.5 2.6 2.5S20 11.6 20 10\"/><path class=\"q-p\" pathLength=\"1\" d=\"M10 20v-5h4v5\"/>", "catalogue": "<path class=\"q-p q-a-couv\" pathLength=\"1\" d=\"M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M4 7.5V16l8 4 8-4V7.5\"/><path class=\"q-p\" pathLength=\"1\" d=\"M12 11v9\"/>", "pilotage": "<path class=\"q-p\" pathLength=\"1\" d=\"M4 18a8 8 0 1 1 16 0\"/><path class=\"q-p q-a-aig\" pathLength=\"1\" d=\"M12 18l4-6\"/><path class=\"q-p\" pathLength=\"1\" d=\"M12 18h.01\"/>", "marketing": "<path class=\"q-p\" pathLength=\"1\" d=\"M4 10v4h3l7 4V6l-7 4H4Z\"/><path class=\"q-p q-a-onde\" pathLength=\"1\" d=\"M17 9.5a3.5 3.5 0 0 1 0 5\"/><path class=\"q-p\" pathLength=\"1\" d=\"M7 14l1 5h3\"/>", "infos": "<path class=\"q-p\" pathLength=\"1\" d=\"M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0Z\"/><path class=\"q-p q-a-ray\" pathLength=\"1\" d=\"M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4\"/>", "rdv": "<path class=\"q-p\" pathLength=\"1\" d=\"M4 10V7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V10\"/><path class=\"q-p\" pathLength=\"1\" d=\"M4 10h16M8 3v4M16 3v4\"/><g class=\"q-a-page\"><path class=\"q-p\" pathLength=\"1\" d=\"M4 10v7.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V10\"/><path class=\"q-p\" pathLength=\"1\" d=\"M9 15h2\"/></g>", "carte": "<g class=\"q-a-pin\"><path class=\"q-p\" pathLength=\"1\" d=\"M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M14.2 10a2.2 2.2 0 1 1-4.4 0a2.2 2.2 0 1 1 4.4 0Z\"/></g>", "appro": "<path class=\"q-p\" pathLength=\"1\" d=\"M4.5 12h5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 3 18.5v-5A1.5 1.5 0 0 1 4.5 12Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M14.5 12h5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-5a1.5 1.5 0 0 1-1.5-1.5v-5a1.5 1.5 0 0 1 1.5-1.5Z\"/><path class=\"q-p q-a-haut\" pathLength=\"1\" d=\"M9.5 4h5A1.5 1.5 0 0 1 16 5.5v5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 10.5v-5A1.5 1.5 0 0 1 9.5 4Z\"/>", "todo": "<path class=\"q-p q-a-c\" style=\"--i:0\" pathLength=\"1\" d=\"M4 7l2 2 3-3\"/><path class=\"q-p q-a-c\" style=\"--i:1\" pathLength=\"1\" d=\"M4 13l2 2 3-3\"/><path class=\"q-p q-a-c\" style=\"--i:2\" pathLength=\"1\" d=\"M4 19l2 2 3-3\"/><path class=\"q-p\" pathLength=\"1\" d=\"M12 7h8M12 13h8M12 19h8\"/>", "biosim": "<path class=\"q-p\" pathLength=\"1\" d=\"M9 8.5l5.5 .3M8 9.5l1.5 5M15.5 11l-4 4\"/><path class=\"q-p q-a-n\" style=\"--i:0\" pathLength=\"1\" d=\"M9.5 7a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0Z\"/><path class=\"q-p q-a-n\" style=\"--i:1\" pathLength=\"1\" d=\"M19.5 9a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0Z\"/><path class=\"q-p q-a-n\" style=\"--i:2\" pathLength=\"1\" d=\"M12.5 17a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0Z\"/>", "offilog": "<g class=\"q-a-chariot\"><path class=\"q-p\" pathLength=\"1\" d=\"M3 5h2l2.5 11h11L21 8H6.3\"/><path class=\"q-p\" pathLength=\"1\" d=\"M10.3 20a1.3 1.3 0 1 1-2.6 0a1.3 1.3 0 1 1 2.6 0Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M18.3 20a1.3 1.3 0 1 1-2.6 0a1.3 1.3 0 1 1 2.6 0Z\"/></g>", "concurrents": "<path class=\"q-p q-a-oeil\" pathLength=\"1\" d=\"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z\"/><path class=\"q-p q-a-pup\" pathLength=\"1\" d=\"M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0Z\"/>", "remontees": "<path class=\"q-p\" pathLength=\"1\" d=\"M9 18h6M10 21h4M8.5 14.5a6 6 0 1 1 7 0c-.8.6-1.5 1.5-1.5 2.5h-4c0-1-.7-1.9-1.5-2.5Z\"/>", "marche": "<path class=\"q-p\" pathLength=\"1\" d=\"M20.5 12a8.5 8.5 0 1 1-17 0a8.5 8.5 0 1 1 17 0Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17\"/>", "carte-grp": "<path class=\"q-p\" pathLength=\"1\" d=\"M7 14s4-3.5 4-7a4 4 0 0 0-8 0c0 3.5 4 7 4 7ZM17 21s4-3.5 4-7a4 4 0 0 0-8 0c0 3.5 4 7 4 7Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M8.3 7a1.3 1.3 0 1 1-2.6 0a1.3 1.3 0 1 1 2.6 0Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M18.3 14a1.3 1.3 0 1 1-2.6 0a1.3 1.3 0 1 1 2.6 0Z\"/>", "presentation": "<path class=\"q-p\" pathLength=\"1\" d=\"M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M12 16v4M8 20h8M8 12l3-3 2 2 3-4\"/>", "logiciels": "<path class=\"q-p\" pathLength=\"1\" d=\"M6 5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M2 19h20M9 10l-2 1.5L9 13M15 10l2 1.5L15 13\"/>", "pdf": "<path class=\"q-p\" pathLength=\"1\" d=\"M6 3h8l5 5v13H6V3ZM14 3v5h5M9 13h6M9 17h6\"/>", "argument": "<path class=\"q-p\" pathLength=\"1\" d=\"M4 5h16v10H9l-5 4V5Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M8 9h8M8 12h5\"/>", "audit": "<path class=\"q-p\" pathLength=\"1\" d=\"M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 18h2M12 18h4\"/>", "groupements": "<path class=\"q-p\" pathLength=\"1\" d=\"M12 8a3 3 0 1 1-6 0a3 3 0 1 1 6 0Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M19.5 9a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0Z\"/><path class=\"q-p\" pathLength=\"1\" d=\"M3 19c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5M15 14c3 0 5.5 1.8 5.5 4.5\"/>", "reforme": "<path class=\"q-p\" pathLength=\"1\" d=\"M12 4v16M5 20h14M12 6l6 1.5M12 6 6 7.5M4 13l2-5.5 2 5.5a2 2 0 0 1-4 0ZM16 13l2-5.5 2 5.5a2 2 0 0 1-4 0Z\"/>", "academy": "<path class=\"q-p\" pathLength=\"1\" d=\"M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9ZM6 11v4.5c0 1.5 3 3 6 3s6-1.5 6-3V11M21.5 9v5\"/>", "plus": "<path class=\"q-p\" pathLength=\"1\" d=\"M12 5v14M5 12h14\"/>"};
  var Q_SPRITE = "<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\"><defs><linearGradient id=\"q-gFeuille\" x1=\"0\" y1=\"1\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#8FB6FF\" stop-opacity=\".55\"/><stop offset=\"1\" stop-color=\"#DCE8FF\" stop-opacity=\".85\"/></linearGradient><linearGradient id=\"q-gFeuille2\" x1=\"0\" y1=\"1\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#3D82FF\" stop-opacity=\".55\"/><stop offset=\"1\" stop-color=\"#9DC0FF\" stop-opacity=\".75\"/></linearGradient><linearGradient id=\"q-gMur\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#FFFFFF\"/><stop offset=\"1\" stop-color=\"#E4ECFF\"/></linearGradient><linearGradient id=\"q-gVitre\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#CFE0FF\"/><stop offset=\"1\" stop-color=\"#7FA9FF\"/></linearGradient><linearGradient id=\"q-gPorte\" gradientUnits=\"userSpaceOnUse\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\" gradientTransform=\"translate(140 136) scale(26 70)\"><stop offset=\"0\" stop-color=\"#CFE0FF\"/><stop offset=\"1\" stop-color=\"#7FA9FF\"/></linearGradient><linearGradient id=\"q-gInt\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#FFFFFF\"/><stop offset=\"1\" stop-color=\"#DDE8FF\"/></linearGradient><linearGradient id=\"q-gStore\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#3D82FF\"/><stop offset=\"1\" stop-color=\"#1E62E8\"/></linearGradient><radialGradient id=\"q-gl\" cx=\"35%\" cy=\"30%\" r=\"75%\"><stop offset=\"0\" stop-color=\"#7FB0FF\"/><stop offset=\".6\" stop-color=\"#0050E6\"/><stop offset=\"1\" stop-color=\"#003CB0\"/></radialGradient><radialGradient id=\"q-gc\" cx=\"40%\" cy=\"35%\" r=\"70%\"><stop offset=\"0\" stop-color=\"#fff\"/><stop offset=\"1\" stop-color=\"#D7E3F8\"/></radialGradient></defs><symbol id=\"q-i-officines\" viewBox=\"0 0 24 24\"><path d=\"M4 10 5 5h14l1 5M4 10v10h16V10M4 10c0 1.6 1.3 2.5 2.7 2.5S9.3 11.6 9.3 10c0 1.6 1.2 2.5 2.7 2.5s2.7-.9 2.7-2.5c0 1.6 1.2 2.5 2.6 2.5S20 11.6 20 10M10 20v-5h4v5\"/></symbol><symbol id=\"q-i-catalogue\" viewBox=\"0 0 24 24\"><path d=\"M4 7.5 12 4l8 3.5-8 3.5-8-3.5ZM4 7.5V16l8 4 8-4V7.5M12 11v9\"/></symbol><symbol id=\"q-i-pilotage\" viewBox=\"0 0 24 24\"><path d=\"M4 18a8 8 0 1 1 16 0M12 18l4-6M12 18h.01\"/></symbol><symbol id=\"q-i-marketing\" viewBox=\"0 0 24 24\"><path d=\"M4 10v4h3l7 4V6l-7 4H4ZM17 9.5a3.5 3.5 0 0 1 0 5M7 14l1 5h3\"/></symbol><symbol id=\"q-i-infos\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4\"/></symbol><symbol id=\"q-i-rdv\" viewBox=\"0 0 24 24\"><rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2.5\"/><path d=\"M4 10h16M8 3v4M16 3v4M9 15h2\"/></symbol><symbol id=\"q-i-carte\" viewBox=\"0 0 24 24\"><path d=\"M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11Z\"/><circle cx=\"12\" cy=\"10\" r=\"2.2\"/></symbol><symbol id=\"q-i-appro\" viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"12\" width=\"8\" height=\"8\" rx=\"1.5\"/><rect x=\"13\" y=\"12\" width=\"8\" height=\"8\" rx=\"1.5\"/><rect x=\"8\" y=\"4\" width=\"8\" height=\"8\" rx=\"1.5\"/></symbol><symbol id=\"q-i-todo\" viewBox=\"0 0 24 24\"><path d=\"M4 7l2 2 3-3M4 13l2 2 3-3M4 19l2 2 3-3M12 7h8M12 13h8M12 19h8\"/></symbol><symbol id=\"q-i-biosim\" viewBox=\"0 0 24 24\"><circle cx=\"7\" cy=\"7\" r=\"2.5\"/><circle cx=\"17\" cy=\"9\" r=\"2.5\"/><circle cx=\"10\" cy=\"17\" r=\"2.5\"/><path d=\"M9 8.5l5.5 .3M8 9.5l1.5 5M15.5 11l-4 4\"/></symbol><symbol id=\"q-i-offilog\" viewBox=\"0 0 24 24\"><path d=\"M3 5h2l2.5 11h11L21 8H6.3\"/><circle cx=\"9\" cy=\"20\" r=\"1.3\"/><circle cx=\"17\" cy=\"20\" r=\"1.3\"/></symbol><symbol id=\"q-i-concurrents\" viewBox=\"0 0 24 24\"><path d=\"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></symbol><symbol id=\"q-i-remontees\" viewBox=\"0 0 24 24\"><path d=\"M9 18h6M10 21h4M8.5 14.5a6 6 0 1 1 7 0c-.8.6-1.5 1.5-1.5 2.5h-4c0-1-.7-1.9-1.5-2.5Z\"/></symbol><symbol id=\"q-i-marche\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17\"/></symbol><symbol id=\"q-i-carte-grp\" viewBox=\"0 0 24 24\"><path d=\"M7 14s4-3.5 4-7a4 4 0 0 0-8 0c0 3.5 4 7 4 7ZM17 21s4-3.5 4-7a4 4 0 0 0-8 0c0 3.5 4 7 4 7Z\"/><circle cx=\"7\" cy=\"7\" r=\"1.3\"/><circle cx=\"17\" cy=\"14\" r=\"1.3\"/></symbol><symbol id=\"q-i-presentation\" viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M12 16v4M8 20h8M8 12l3-3 2 2 3-4\"/></symbol><symbol id=\"q-i-logiciels\" viewBox=\"0 0 24 24\"><rect x=\"4\" y=\"5\" width=\"16\" height=\"11\" rx=\"2\"/><path d=\"M2 19h20M9 10l-2 1.5L9 13M15 10l2 1.5L15 13\"/></symbol><symbol id=\"q-i-pdf\" viewBox=\"0 0 24 24\"><path d=\"M6 3h8l5 5v13H6V3ZM14 3v5h5M9 13h6M9 17h6\"/></symbol><symbol id=\"q-i-argument\" viewBox=\"0 0 24 24\"><path d=\"M4 5h16v10H9l-5 4V5Z\"/><path d=\"M8 9h8M8 12h5\"/></symbol><symbol id=\"q-i-audit\" viewBox=\"0 0 24 24\"><rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 18h2M12 18h4\"/></symbol><symbol id=\"q-i-groupements\" viewBox=\"0 0 24 24\"><circle cx=\"9\" cy=\"8\" r=\"3\"/><circle cx=\"17\" cy=\"9\" r=\"2.5\"/><path d=\"M3 19c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5M15 14c3 0 5.5 1.8 5.5 4.5\"/></symbol><symbol id=\"q-i-reforme\" viewBox=\"0 0 24 24\"><path d=\"M12 4v16M5 20h14M12 6l6 1.5M12 6 6 7.5M4 13l2-5.5 2 5.5a2 2 0 0 1-4 0ZM16 13l2-5.5 2 5.5a2 2 0 0 1-4 0Z\"/></symbol><symbol id=\"q-i-academy\" viewBox=\"0 0 24 24\"><path d=\"M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9ZM6 11v4.5c0 1.5 3 3 6 3s6-1.5 6-3V11M21.5 9v5\"/></symbol><symbol id=\"q-i-plus\" viewBox=\"0 0 24 24\"><path d=\"M12 5v14M5 12h14\"/></symbol><symbol id=\"q-i-loupe\" viewBox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m20 20-4.3-4.3\"/></symbol><symbol id=\"q-i-fleche\" viewBox=\"0 0 24 24\"><path d=\"M5 12h14M13 6l6 6-6 6\"/></symbol></svg>";
  var Q_ILLU = "<span class=\"q-illu\" id=\"q-illu\" aria-hidden=\"true\"><span class=\"q-terre\"><span class=\"q-ter2\"><span class=\"q-pl\" data-depth=\"0.6\"><span class=\"q-v1\" style=\"--o:77.33% 100%;--r:-.25s\"><span class=\"q-v2\"><span class=\"q-v3\"><svg class=\"q-fl\" style=\"--d:50ms;--u:10deg\" viewBox=\"0 0 300 214\"><path d=\"M232 214 C 190 150, 196 70, 274 36 C 290 110, 272 170, 232 214 Z\" fill=\"url(#q-gFeuille)\"/></svg></span></span></span><span class=\"q-v1\" style=\"--o:20.67% 100%;--a:-3s;--b:-6s;--r:-.5s\"><span class=\"q-v2\"><span class=\"q-v3\"><svg class=\"q-fl\" style=\"--d:0ms;--u:-10deg\" viewBox=\"0 0 300 214\"><path d=\"M62 214 C 20 160, 10 100, 36 44 C 92 86, 96 160, 62 214 Z\" fill=\"url(#q-gFeuille2)\"/></svg></span></span></span></span><svg class=\"q-sol\" viewBox=\"0 0 300 214\"><ellipse cx=\"150\" cy=\"208\" rx=\"120\" ry=\"6\" fill=\"#0B1530\" opacity=\".18\"/></svg><span class=\"q-pl\" data-depth=\"0.3\"><span class=\"q-mt\"><svg class=\"q-facade\" viewBox=\"0 0 300 214\"><clipPath id=\"q-cpPorte\"><rect x=\"140\" y=\"136\" width=\"26\" height=\"70\" rx=\"3\"/></clipPath><rect x=\"78\" y=\"78\" width=\"150\" height=\"128\" rx=\"6\" fill=\"url(#q-gMur)\"/><rect x=\"78\" y=\"78\" width=\"150\" height=\"128\" rx=\"6\" fill=\"none\" stroke=\"#0B1530\" stroke-opacity=\".12\"/><rect x=\"86\" y=\"86\" width=\"134\" height=\"20\" rx=\"4\" fill=\"#0B1530\"/><rect x=\"96\" y=\"93\" width=\"52\" height=\"6\" rx=\"3\" fill=\"#fff\" opacity=\".9\"/><rect x=\"154\" y=\"93\" width=\"30\" height=\"6\" rx=\"3\" fill=\"#fff\" opacity=\".45\"/><rect x=\"90\" y=\"138\" width=\"42\" height=\"42\" rx=\"4\" fill=\"url(#q-gVitre)\"/><rect x=\"174\" y=\"138\" width=\"42\" height=\"42\" rx=\"4\" fill=\"url(#q-gVitre)\"/><path d=\"M94 160 h34 M94 170 h34 M178 160 h34 M178 170 h34\" stroke=\"#fff\" stroke-opacity=\".7\" stroke-width=\"2\"/><rect x=\"98\" y=\"150\" width=\"6\" height=\"8\" rx=\"1.5\" fill=\"#fff\" opacity=\".9\"/><rect x=\"108\" y=\"148\" width=\"6\" height=\"10\" rx=\"1.5\" fill=\"#1E9E6A\" opacity=\".9\"/><rect x=\"118\" y=\"151\" width=\"6\" height=\"7\" rx=\"1.5\" fill=\"#fff\" opacity=\".9\"/><rect x=\"182\" y=\"150\" width=\"6\" height=\"8\" rx=\"1.5\" fill=\"#fff\" opacity=\".9\"/><rect x=\"192\" y=\"149\" width=\"6\" height=\"9\" rx=\"1.5\" fill=\"#C7791A\" opacity=\".9\"/><rect x=\"202\" y=\"151\" width=\"6\" height=\"7\" rx=\"1.5\" fill=\"#fff\" opacity=\".9\"/><g clip-path=\"url(#q-cpPorte)\"><rect id=\"q-porteInt\" x=\"140\" y=\"136\" width=\"26\" height=\"70\" fill=\"url(#q-gInt)\"/><path d=\"M144 160h18M144 171h18\" stroke=\"#B7CBF7\" stroke-width=\"2\"/><rect x=\"145\" y=\"185\" width=\"16\" height=\"21\" rx=\"2\" fill=\"#B7CBF7\"/><g id=\"q-vg\"><rect x=\"140\" y=\"136\" width=\"13\" height=\"70\" fill=\"url(#q-gPorte)\"/><rect x=\"152.5\" y=\"140\" width=\".5\" height=\"62\" fill=\"#fff\" opacity=\".6\"/><circle cx=\"149\" cy=\"172\" r=\"1.8\" fill=\"#0B1530\" opacity=\".6\"/></g><g id=\"q-vd\"><rect x=\"153\" y=\"136\" width=\"13\" height=\"70\" fill=\"url(#q-gPorte)\"/><rect x=\"153\" y=\"140\" width=\".5\" height=\"62\" fill=\"#fff\" opacity=\".6\"/></g></g><rect x=\"140\" y=\"136\" width=\"26\" height=\"70\" rx=\"3\" fill=\"none\" stroke=\"#0B1530\" stroke-opacity=\".18\"/><rect x=\"134\" y=\"203\" width=\"38\" height=\"4\" rx=\"2\" fill=\"#0B1530\" opacity=\".25\"/><path id=\"q-seuil\" d=\"M140 206h26l9 8h-44Z\" fill=\"#fff\" opacity=\"0\"/></svg><i class=\"q-nuit\" style=\"--d:430ms;left:30%;top:64.486%;width:14%;height:19.626%\"></i><i class=\"q-ecl\" style=\"--d:430ms;left:30%;top:64.486%;width:14%;height:19.626%\"></i><i class=\"q-nuit\" style=\"--d:510ms;left:58%;top:64.486%;width:14%;height:19.626%\"></i><i class=\"q-ecl\" style=\"--d:510ms;left:58%;top:64.486%;width:14%;height:19.626%\"></i><i class=\"q-nuit q-po\" style=\"--d:590ms;left:46.667%;top:63.551%;width:8.667%;height:32.71%\"></i><i class=\"q-ecl q-po\" style=\"--d:590ms;left:46.667%;top:63.551%;width:8.667%;height:32.71%\"></i><span class=\"q-coffre\"><svg class=\"q-banne\" id=\"q-banne\" viewBox=\"0 0 300 214\"><path d=\"M80 112 H226 L222 128 H84 Z\" fill=\"url(#q-gStore)\"/><path d=\"M96 112 l-3 16 M120 112 l-2 16 M144 112 l-1 16 M168 112 l1 16 M192 112 l2 16 M216 112 l3 16\" stroke=\"#fff\" stroke-opacity=\".35\" stroke-width=\"3\"/></svg></span><svg class=\"q-fe\" style=\"--i:0;left:27.667%\" viewBox=\"83 126 16 12\"><path d=\"M84 128q7 8 14 0\"/></svg><svg class=\"q-fe\" style=\"--i:1;left:32.333%\" viewBox=\"97 126 16 12\"><path d=\"M98 128q7 8 14 0\"/></svg><svg class=\"q-fe\" style=\"--i:2;left:37.000%\" viewBox=\"111 126 16 12\"><path d=\"M112 128q7 8 14 0\"/></svg><svg class=\"q-fe\" style=\"--i:3;left:41.667%\" viewBox=\"125 126 16 12\"><path d=\"M126 128q7 8 14 0\"/></svg><svg class=\"q-fe\" style=\"--i:4;left:46.333%\" viewBox=\"139 126 16 12\"><path d=\"M140 128q7 8 14 0\"/></svg><svg class=\"q-fe\" style=\"--i:5;left:51.000%\" viewBox=\"153 126 16 12\"><path d=\"M154 128q7 8 14 0\"/></svg><svg class=\"q-fe\" style=\"--i:6;left:55.667%\" viewBox=\"167 126 16 12\"><path d=\"M168 128q7 8 14 0\"/></svg><svg class=\"q-fe\" style=\"--i:7;left:60.333%\" viewBox=\"181 126 16 12\"><path d=\"M182 128q7 8 14 0\"/></svg><svg class=\"q-fe\" style=\"--i:8;left:65.000%\" viewBox=\"195 126 16 12\"><path d=\"M196 128q7 8 14 0\"/></svg></span></span><span class=\"q-pl\" data-depth=\"0.15\"><i class=\"q-halo\"></i><svg class=\"q-pot\" viewBox=\"0 0 300 214\"><path d=\"M62 94 v12 h12\" stroke=\"#0B1530\" stroke-opacity=\".35\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></svg><span class=\"q-cx\"><svg viewBox=\"0 0 300 214\"><rect x=\"52\" y=\"30\" width=\"20\" height=\"64\" rx=\"4\" fill=\"#1E9E6A\"/><rect x=\"30\" y=\"52\" width=\"64\" height=\"20\" rx=\"4\" fill=\"#1E9E6A\"/></svg><svg class=\"q-cc\" viewBox=\"0 0 300 214\"><rect x=\"56\" y=\"34\" width=\"12\" height=\"56\" rx=\"2\" fill=\"#6DF2B0\"/><rect x=\"34\" y=\"56\" width=\"56\" height=\"12\" rx=\"2\" fill=\"#6DF2B0\"/></svg><svg class=\"q-cl\" viewBox=\"0 0 300 214\"><clipPath id=\"q-cpCroix\"><rect x=\"56\" y=\"34\" width=\"12\" height=\"56\" rx=\"2\"/><rect x=\"34\" y=\"56\" width=\"56\" height=\"12\" rx=\"2\"/></clipPath><g clip-path=\"url(#q-cpCroix)\"><rect class=\"q-om\" x=\"30\" y=\"30\" width=\"64\" height=\"64\" fill=\"#1E9E6A\"/><rect class=\"q-k\" style=\"--i:0\" x=\"51\" y=\"51\" width=\"22\" height=\"22\"/><rect class=\"q-k\" style=\"--i:1\" x=\"45.5\" y=\"45.5\" width=\"33\" height=\"33\"/><rect class=\"q-k\" style=\"--i:2\" x=\"40\" y=\"40\" width=\"44\" height=\"44\"/><rect class=\"q-k q-k4\" style=\"--i:3\" x=\"35\" y=\"35\" width=\"54\" height=\"54\"/><rect class=\"q-ba\" x=\"30\" y=\"30\" width=\"64\" height=\"64\" fill=\"#D9FFEA\"/><rect class=\"q-br\" style=\"--i:0\" x=\"56\" y=\"34\" width=\"12\" height=\"22\" fill=\"#F2FFF8\"/><rect class=\"q-br\" style=\"--i:1\" x=\"68\" y=\"56\" width=\"22\" height=\"12\" fill=\"#F2FFF8\"/><rect class=\"q-br\" style=\"--i:2\" x=\"56\" y=\"68\" width=\"12\" height=\"22\" fill=\"#F2FFF8\"/><rect class=\"q-br\" style=\"--i:3\" x=\"34\" y=\"56\" width=\"22\" height=\"12\" fill=\"#F2FFF8\"/></g><rect x=\"60\" y=\"52\" width=\"4\" height=\"20\" fill=\"#fff\" opacity=\".9\"/><rect x=\"52\" y=\"60\" width=\"20\" height=\"4\" fill=\"#fff\" opacity=\".9\"/></svg></span></span><span class=\"q-pl\" data-depth=\"0.08\"><span class=\"q-mp\"><svg viewBox=\"0 0 300 214\"><path d=\"M246 206 h20 l-3-20 h-14 Z\" fill=\"#C7791A\"/></svg><span class=\"q-v1\" style=\"--o:85.33% 86.92%;--a:-5s;--b:-2s;--r:-.05s\"><span class=\"q-v2\"><span class=\"q-v3\"><svg class=\"q-fl\" style=\"--d:240ms;--u:-14deg\" viewBox=\"0 0 300 214\"><path d=\"M256 186 c-14-10 -16-28 -6-40 c10 10 12 26 6 40 Z M256 186 c 2-16 12-26 24-28 c-2 14 -12 24 -24 28 Z M256 186 c-8-14 -22-18 -32-14 c 6 12 20 16 32 14 Z\" fill=\"#1E9E6A\"/><path d=\"M256 186 v-30\" stroke=\"#13764E\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg></span></span></span></span></span></span></span></span>";
  // nom de porte (G4_PORTES) -> picto de la maquette
  var Q_IC = { pharma: 'officines', produits: 'catalogue', pilotage: 'pilotage', marketing: 'marketing', infos: 'infos', rdv: 'rdv', carte: 'carte', appro: 'appro', todo: 'todo', biosimilaires: 'biosim', offilog: 'offilog', concurrents: 'concurrents', remontees: 'remontees', marchefr: 'marche', carteGrp: 'carte-grp', presentation: 'presentation', lgo: 'logiciels', fiches: 'pdf', argument: 'argument', audit: 'audit', groupements: 'groupements', reforme2027: 'reforme' };
  // les cinq tuiles gardent leurs cinq teintes (par place, comme dans la maquette)
  var Q_TEINTES = ['q-t-bleu', 'q-t-ambre', 'q-t-vert', 'q-t-clair', 'q-t-nuit'];
  var Q_NAV = 7, Q_TUILES = 5;   // entrées de la barre latérale, tuiles : le reste va au tableau
  var Q_ACADEMY = 'https://jarvis-academy-fr.vercel.app/';
  var _qInst = null;   // l'accueil monté (un seul à la fois)
  function qSvg(ic) {
    var p = Q_PICTO[ic] || Q_PICTO.officines;
    return '<svg class="q-ic q-dz' + (/q-a-/.test(p) ? '' : ' q-gen') + '" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
  }
  function qUse(ic, st) {
    return '<svg class="q-ic" aria-hidden="true"' + (st ? ' style="' + st + '"' : '') + '><use href="#q-i-' + ic + '"/></svg>';
  }
  // Une porte (outil) : nom, phrase, picto, ce qu'elle fait au clic.
  function qOutil(k, escale) {
    var d = G4_PORTES[k], o = { k: k, nom: d.nom, ph: (escale && _g4Esc[k]) ? _g4Esc[k] : d.ph, ic: Q_IC[k] || 'officines' };
    if (k === 'groupements') { o.act = 'go:pharma/groupements'; o.href = '#pharma/groupements'; }
    // Réforme 2027 : document privé, ouvert dans un nouvel onglet — le navigateur n'accepte l'onglet que dans le geste du clic.
    else if (k === 'reforme2027') { o.act = 'doc:reforme2027'; o.imm = true; }
    else { o.act = 'go:' + k; o.href = '#' + k; }
    return o;
  }
  function qAttr(o) {
    var a = { tabindex: '0', 'data-outil': o.nom, 'data-ic': o.ic, 'data-k': o.k };
    if (o.ext) { a.href = o.ext; a.target = '_blank'; a.rel = 'noopener'; }
    else { a['data-act'] = o.act; if (o.href) a.href = o.href; else a.role = 'link'; if (o.imm) a['data-imm'] = '1'; }
    return a;
  }
  function qAttrStr(a) { var s = ''; for (var k in a) s += ' ' + k + '="' + esc(a[k]) + '"'; return s; }
  function qOutilsLiens(escale) {
    var out = { academy: { k: 'academy', nom: 'JARVIS Academy', ph: 'Se former, à son rythme', ic: 'academy', ext: Q_ACADEMY } };
    if (V2.pages.remontees) out.proposer = { k: 'proposer', nom: 'Proposer un outil', ph: 'Une idée d\'outil : elle rejoint les Remontées', ic: 'plus', act: 'go:remontees', href: '#remontees' };
    var bsc = V2.basculeEspace && V2.basculeEspace();
    if (bsc) {
      // La barre du haut portait la bascule Intégral ↔ Escale ; l'accueil dessine son propre cadre : elle devient une ligne du tableau.
      out.espace = bsc.to === 'escale'
        ? { k: 'escale', nom: 'Espace Escale Pharma', ph: 'Le suivi Escale et ses officines clientes', ic: 'pilotage', act: 'space:escale', imm: false }
        : { k: 'escale', nom: 'Espace Intégral Pharma', ph: 'Revenir au CRM d\'Intégral Pharma', ic: 'pilotage', act: 'space:crm', imm: false };
    }
    return out;
  }
  // Portes visibles (même filtre que l'ancien accueil : l'écran doit exister ; pas de « Logiciels officine » en Escale),
  // rangées par l'ordre réel des ouvertures (rpc accueil_ouvertures, cache de session) ou, à défaut, l'ordre de repli.
  // Répartition de la maquette : Officines en tête de la barre (c'est la grande porte du bandeau), 7 entrées de barre,
  // 5 tuiles, le reste au tableau.
  function qRepartition() {
    var escale = !!(window.V2_BRAND && window.V2_BRAND.escale);
    var cles = G4_REPLI.filter(function (k) {
      var d = G4_PORTES[k];
      if (!d || !V2.pages[d.page]) return false;
      if (k === 'lgo' && escale) return false;
      return true;
    });
    var rang = g4Classer(cles), reste = rang.slice(), nav = [], iP = reste.indexOf('pharma');
    if (iP >= 0) { nav.push('pharma'); reste.splice(iP, 1); }
    nav = nav.concat(reste.splice(0, Q_NAV - nav.length));
    var tuiles = reste.splice(0, Q_TUILES);
    var liens = qOutilsLiens(escale), table = reste.map(function (k) { return qOutil(k, escale); });
    if (liens.espace) table.push(liens.espace);
    return { nav: nav.map(function (k) { return qOutil(k, escale); }), tuiles: tuiles.map(function (k) { return qOutil(k, escale); }), table: table, academy: liens.academy, proposer: liens.proposer || null, sans: !_g4Ordre };
  }
  // « Usage » du tableau : se lit dans le classement réel (jamais un nombre) ; sans classement, pas de colonne.
  function qUsage(k) {
    if (!_g4Ordre || k === 'escale') return null;
    for (var i = 0; i < _g4Ordre.length; i++) if (_g4Ordre[i].e === k) return _g4Ordre[i].o > 0 ? { t: 'Peu ouvert', d: false } : { t: 'À découvrir', d: true };
    return { t: 'À découvrir', d: true };
  }
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
  function qInitiales(nom) {
    var m = String(nom || '').replace(/[^A-Za-zÀ-ÿ0-9 '’-]/g, ' ').split(/[\s'’-]+/).filter(function (w) { return w && !/^(de|du|la|le|les|des|d|l)$/i.test(w); });
    if (!m.length) return '';
    if (m.length === 1) return m[0].slice(0, 2).toUpperCase();
    return (m[0].charAt(0) + m[m.length - 1].charAt(0)).toUpperCase();
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
      if (_qInst) _qInst.majInfos();
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
  function qPlur(n, s, p) { return n + ' ' + (n > 1 ? p : s); }
  // La phrase du bandeau : chaque morceau vient d'une donnée réelle, et se tait quand la donnée manque.
  function qPhrase(m, rel, info) {
    var h;
    if (m.partiel) {
      h = '<span id="v2-ventes-etat">Chargement des ventes… <b>' + ((V2.ventesProgres && V2.ventesProgres.n) || 0) + '</b> / ' + ((V2.ventesProgres && V2.ventesProgres.total) || '?') + '</span>';
    } else {
      h = 'Vous suivez <b id="q-n690">' + m.nb + '</b> ' + (m.nb > 1 ? 'officines actives' : 'officine active') +
        (m.mes != null ? ', dont ' + qPlur(m.mes, 'est la vôtre', 'sont les vôtres') : '') + '.';
    }
    var morceaux = [];
    if (m.partiel) return h;
    if (info && info.etat === 'ok' && info.nb > 0 && (info.quand === 'auj' || info.quand === 'hier')) morceaux.push(qPlur(info.nb, 'nouvelle', 'nouvelles') + (info.quand === 'auj' ? ' aujourd\'hui' : ' hier'));
    var dues = rel.l.filter(function (r) { return r.diff <= 0; }).length;
    if (dues > 0) morceaux.push(qPlur(dues, 'relance', 'relances') + ' à faire');
    if (morceaux.length) h += ' ' + morceaux.join(', ').replace(/^./, function (c) { return c.toUpperCase(); }) + (dues > 0 ? ' : la journée commence par vos fiches.' : '.');
    return h;
  }

  // ─────────────────────────────────────────────
  // Q1 : le HTML (mêmes blocs, mêmes classes que la maquette, préfixées q-)
  // ─────────────────────────────────────────────
  function qNavIn(o) { return '<span class="q-ico">' + qSvg(o.ic) + '</span><span class="q-tx"><b>' + esc(o.nom) + '</b><span data-ph>' + esc(o.ph) + '</span></span>'; }
  function qTuileIn(o, i) { return '<span class="q-ico ' + Q_TEINTES[i % 5] + '">' + qSvg(o.ic) + '</span><span class="q-tx"><b>' + esc(o.nom) + '</b><span data-ph>' + esc(o.ph) + '</span></span>'; }
  function qLigneIn(o) {
    var u = o.ext ? null : qUsage(o.k);
    return '<b>' + esc(o.nom) + '</b><span data-ph>' + esc(o.ph) + '</span>' + (u ? '<span class="q-st' + (u.d ? ' q-decouvrir' : '') + '"><i></i>' + u.t + '</span>' : '<span></span>');
  }
  function qNavHtml(rep) {
    return '<span class="q-fond" id="q-navFond" aria-hidden="true"></span><span class="q-barre" id="q-navBarre" aria-hidden="true"></span>' +
      rep.nav.map(function (o, i) { return '<a class="' + (i === 0 ? 'q-on ' : '') + 'q-in q-g"' + qAttrStr(qAttr(o)) + '>' + qNavIn(o) + '</a>'; }).join('');
  }
  function qTuilesHtml(rep) {
    return rep.tuiles.map(function (o, i) { return '<a class="q-tuile q-in q-e"' + qAttrStr(qAttr(o)) + '>' + qTuileIn(o, i) + '</a>'; }).join('');
  }
  function qTableHtml(rep) {
    return '<span class="q-select" id="q-select" aria-hidden="true"></span>' +
      rep.table.map(function (o) { return '<a class="q-lg q-in"' + qAttrStr(qAttr(o)) + '>' + qLigneIn(o) + '</a>'; }).join('');
  }
  function qCarteRel(r, i) {
    var q = qQuand(r.diff), pid = encodeURIComponent(String(r.pid));
    return '<a tabindex="0" class="q-rel q-in" href="#pharma/' + pid + '" data-outil="' + esc(r.name) + '" data-ic="officines" data-k="relance" data-act="rel:' + pid + '" data-i="' + i + '">' + qUse('officines') +
      '<span class="q-tx"><b>' + esc(r.name) + '</b><span>' + (r.ville ? esc(r.ville) + ' · ' : '') + '<em' + (q.c ? ' class="' + q.c + '"' : '') + '>' + q.t + '</em></span></span><span class="q-av">' + esc(qInitiales(r.name)) + '</span></a>';
  }
  // Un jour qui porte au moins une relance est un bouton, avec un point dessous.
  function qJoursHtml(sem, rel, pj, copie) {
    return sem.jours.map(function (j, k) {
      var ids = pj[k], rdv = !copie && ids && ids.length, r0 = ids && rel.l[ids[0]], q = r0 && qQuand(r0.diff);
      var lib = rdv ? j.lib.charAt(0).toUpperCase() + j.lib.slice(1) + ' : ' + (ids.length > 1 ? ids.length + ' relances, dont ' : '') + r0.name + ', ' + q.t : '';
      return '<div class="q-jour' + (j.passe ? ' q-passe' : '') + (rdv ? ' q-rdv' : '') + (copie ? '' : ' q-in') + '"' +
        (rdv ? ' role="button" tabindex="0" data-k="' + k + '" aria-pressed="' + (k === sem.dow ? 'true' : 'false') + '" aria-label="' + esc(lib) + '"' : '') + '>' +
        '<small>' + j.n + '</small><b>' + j.j + '</b>' + (ids && ids.length ? '<i class="q-pt' + (qQuand(r0.diff).c ? ' ' + qQuand(r0.diff).c : '') + '"></i>' : '') + '</div>';
    }).join('');
  }
  function qInfosIn(info) {
    var titre = info.etat === 'ok' ? info.titre : info.etat === 'charge' ? 'Le brief du jour se charge…' : 'Le brief du jour n\'a pas pu se charger ici. Il s\'ouvre en entier dans l\'écran Infos.';
    var cases = [];
    if (info.etat === 'ok') {
      if (info.nb != null) cases.push('<div class="q-v' + (info.quand === 'auj' ? '' : ' q-vieux') + '"><b>' + info.nb + '</b><span>' + (info.nb > 1 ? 'nouvelles' : 'nouvelle') + '</span><em>' + esc(info.puce) + '</em></div>');
      if (info.rupt != null) cases.push('<div class="q-v"><b>' + info.rupt + '</b><span>' + (info.rupt > 1 ? 'ruptures en cours' : 'rupture en cours') + '</span><em>ANSM</em></div>');
      if (info.rapp != null) cases.push('<div class="q-v"><b>' + info.rapp + '</b><span>' + (info.rapp > 1 ? 'rappels de produits' : 'rappel de produit') + '</span><em>DGCCRF</em></div>');
    }
    return '<div class="q-titre">' + esc(titre) + '</div>' +
      (cases.length ? '<div class="q-trio" style="grid-template-columns:repeat(' + cases.length + ',1fr)">' + cases.join('') + '</div>' : '') +
      '<div class="q-lire">Lire le brief du jour ' + qUse('fleche') + '</div>';
  }
  // « Nouveau » (G4_UNE) : jusqu'à la date de fin, jamais en Escale ni en OPSO.
  function qUneHtml() {
    var u = G4_UNE, b = window.V2_BRAND || {}, d = new Date();
    var jour = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    if (!u || b.escale || b.opso || !V2.pages[u.page] || jour > u.fin) return '';
    return '<a tabindex="0" class="q-une q-in" href="#' + u.page + '" data-outil="' + esc(u.nom) + '" data-ic="' + (Q_IC[u.page] || 'officines') + '" data-k="une" data-act="go:' + u.page + '">' +
      '<span class="q-ico q-t-clair">' + qSvg(Q_IC[u.page] || 'officines') + '</span>' +
      '<span class="q-tx"><em class="q-nv">Nouveau</em><b>' + esc(u.nom) + '</b><span>' + esc(u.ph) + '</span></span>' + qUse('fleche') + '</a>';
  }
  function qIniPers(nom) {
    var m = String(nom || '').split(/\s+/).filter(Boolean);
    return (m.map(function (w) { return w.charAt(0); }).slice(0, 2).join('') || 'WM').toUpperCase();
  }
  function qPageHtml(m, calme) {
    var rep = qRepartition(), sem = qSemaine(), rel = qRelances(), info = qInfosModele(), u = V2.user || {}, br = window.V2_BRAND || {};
    var pj = qParJour(rel.l, sem.dow), nom = u.name || '', ini = qIniPers(nom);
    var phrase = qPhrase(m, rel, info);
    var haut =
      '<div class="q-haut">' +
        '<div class="q-logo"><span class="q-rond">' + qUse('officines') + '</span><div><b>' + esc(br.name || 'Intégral Pharma') + '</b><small>' + esc(br.sub || 'Espace commercial') + '</small></div>' +
          '<button type="button" class="q-moi" data-moi="1" aria-label="Menu du compte : ' + esc(nom) + '">' + esc(ini) + '</button></div>' +
        '<div class="q-rech" id="q-rech"><label class="q-cherche">' + qUse('loupe') + '<input type="search" placeholder="Officine, produit, outil…" aria-label="Rechercher" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="q-res" aria-autocomplete="list"><kbd>' + MOD + 'K</kbd></label></div>' +
        (rep.proposer ? '<a class="q-bt q-haut-bt"' + qAttrStr(qAttr(rep.proposer)) + '><span>' + qUse('plus', 'width:16px;height:16px') + 'Proposer un outil</span></a>' : '') +
      '</div>';
    var bandeau =
      '<a tabindex="0" class="q-bandeau" href="#pharma" data-outil="Officines" data-ic="officines" data-k="pharma" data-act="go:pharma">' +
        '<span class="q-lum" aria-hidden="true"><i></i></span><span class="q-rai" aria-hidden="true"><i></i></span>' +
        '<h1>' + esc(m.salut) + ' ' + esc(m.prenom) + '</h1><div class="q-date">' + esc(qDateTxt(new Date())) + '</div><p>' + phrase + '</p>' +
        '<span class="q-pill"><span>Ouvrir mes officines ' + qUse('fleche') + '</span></span>' + Q_ILLU + '</a>';
    var outils = rep.tuiles.length
      ? '<div class="q-sec q-outils q-in"><h2>Vos autres outils</h2><a tabindex="0" class="q-bt q-petit" href="#tous"><span>Tous vos outils</span></a></div><div class="q-tuiles">' + qTuilesHtml(rep) + '</div>' : '';
    var tous = '<div class="q-sec q-in" id="q-tous"><h2>Tous vos outils</h2></div>' +
      '<div class="q-table q-in"><div class="q-tete"><span>Outil</span><span class="q-c2">Ce qu\'il fait</span><span>Usage</span></div><div class="q-corps" id="q-corps">' + qTableHtml(rep) + '</div></div>';
    var side =
      '<aside class="q-side"><div class="q-logo"><span class="q-rond">' + qUse('officines') + '</span><div><b>' + esc(br.name || 'Intégral Pharma') + '</b><small>' + esc(br.sub || 'Espace commercial') + '</small></div></div>' +
        '<nav class="q-nav" id="q-nav" aria-label="Vos outils les plus ouverts">' + qNavHtml(rep) + '</nav>' +
        '<a class="q-academy"' + qAttrStr(qAttr(rep.academy)) + '>' +
          '<div class="q-fleur" id="q-fleur" data-la="500" aria-hidden="true"><span class="q-suit" id="q-fleurSuit"><span class="q-ouvre">' +
            '<svg class="q-lobes" viewBox="0 0 100 100"><g fill="url(#q-gl)"><ellipse cx="50" cy="26" rx="14" ry="22"/><ellipse cx="50" cy="74" rx="14" ry="22"/><ellipse cx="26" cy="50" rx="22" ry="14"/><ellipse cx="74" cy="50" rx="22" ry="14"/></g></svg>' +
            '<svg class="q-coeur" viewBox="0 0 100 100"><circle cx="50" cy="50" r="15" fill="url(#q-gc)"/><circle cx="50" cy="50" r="6" fill="#0050E6"/></svg>' +
          '</span></span></div>' +
          '<b class="q-in" style="--d:540ms">JARVIS Academy</b><span class="q-ph q-in" style="--d:568ms" data-ph>Se former, à son rythme</span>' +
          '<span class="q-btn q-in" style="--d:596ms">Ouvrir l\'Academy ' + qUse('fleche', 'width:14px;height:14px') + '</span></a></aside>';
    var main = '<main class="q-main">' + haut + bandeau + qUneHtml() + ((V2.todo && !V2.pages.todo) ? '<div class="q-extra">' + V2.todo.cardHtml() + '</div>' : '') + outils + tous +
      '<p class="q-note">Le code d\'accès de JARVIS Academy se demande à Will — il n\'est écrit nulle part.</p></main>';
    var plus = rel.l.length > 3;
    var droite = '<aside class="q-droite"><div class="q-pan">' +
        '<div class="q-profil"><button type="button" class="q-avatar q-in q-e" data-moi="1" aria-label="Menu du compte : ' + esc(nom) + '">' + esc(ini) + '</button><b class="q-in">' + esc(nom) + '</b><span class="q-role q-in">' + esc(br.sub || 'Espace commercial') + '</span></div>' +
        '<div class="q-sec q-d q-sem q-in"><h2>Votre semaine</h2><span class="q-mois" id="q-mois">' + esc(sem.mois) + '</span></div>' +
        '<div class="q-jours" id="q-jours" aria-label="Cette semaine"><span class="q-pil" aria-hidden="true"></span>' + qJoursHtml(sem, rel, pj) + '<div class="q-inv" aria-hidden="true">' + qJoursHtml(sem, rel, pj, true) + '</div></div>' +
        '<div class="q-sec q-d q-rl q-in"><h2>À relancer</h2></div>' +
        '<div class="q-liste" id="q-liste">' + rel.l.map(qCarteRel).join('') + '</div>' +
        '<div class="q-vide q-in" id="q-vide"' + (rel.pret && !rel.l.length ? '' : ' hidden') + '>Aucune relance à faire pour le moment.</div>' +
        '<button type="button" class="q-tout q-in" id="q-tout"' + (plus ? '' : ' hidden') + ' aria-expanded="false">Tout afficher</button>' +
      '</div>' +
      (V2.pages.infos ? '<div class="q-sec q-d q-infos-t q-in"><h2>Infos du matin</h2></div><a tabindex="0" class="q-infos q-in" href="#infos" data-outil="Infos du matin" data-ic="infos" data-k="infos" data-act="go:infos">' + qInfosIn(info) + '</a>' : '') +
      '</aside>';
    return '<div class="q-page ' + (calme ? 'q-calme' : 'q-js') + (rep.sans ? ' q-sans-usage' : '') + '">' + Q_SPRITE + '<div class="q-app"><div class="q-carte">' + side + main + droite + '</div></div></div>';
  }

  // ─────────────────────────────────────────────
  // Q1 : le mouvement et les gestes. Port de la maquette, monté et démonté proprement :
  // une seule boucle d'images (elle s'arrête quand tout dort), des écouteurs tous retirés au départ.
  // ─────────────────────────────────────────────
  function qAgir(act) {
    var i = act.indexOf(':'), t = act.slice(0, i), v = act.slice(i + 1);
    if (t === 'go') { var p = v.split('/'); if (p[1]) V2.go(p[0], p[1]); else V2.go(p[0]); }
    else if (t === 'rel') V2.go('pharma', decodeURIComponent(v));
    else if (t === 'doc') V2.ouvrirDocProtege(v);
    else if (t === 'space') V2.goSpace(v);
  }
  function qMonter(page, m) {
    var D = document, B = D.body, W = window, R = page;
    var inst = { page: page, mort: false };
    function $(s, c) { return (c || page).querySelector(s); }
    function $$(s, c) { return [].slice.call((c || page).querySelectorAll(s)); }
    var JS = R.classList.contains('q-js');
    var ecoutes = [], minuteurs = [], seqT = 0, essaiT = [];
    function ec(cible, type, fn, opt) { cible.addEventListener(type, fn, opt); ecoutes.push([cible, type, fn, opt]); }
    function to(f, ms) { var id = setTimeout(function () { if (!inst.mort) f(); }, ms); minuteurs.push(id); return id; }
    function borne(x, a, b) { return x < a ? a : x > b ? b : x; }
    function f2(x) { return Math.round(x * 100) / 100; }

    /* ---------- le portail : voile, carte d'ouverture, anneau de focus (hors de la page, qui recule sous le voile) ---------- */
    var portail = D.createElement('div');
    portail.className = 'q-portail ' + (JS ? 'q-js q-go' : 'q-calme');
    portail.innerHTML = '<div class="q-overlay"></div><div class="q-panel" aria-hidden="true"><span class="q-p-ombre"></span><span class="q-p-surf"></span>' +
      '<div class="q-p-corps"><div class="q-p-tete"><span class="q-p-ico"><i></i><svg class="q-ic"><use href="#q-i-officines"/></svg></span><div class="q-p-tx"><div class="q-panel-titre"><span class="q-p-nom">—</span></div></div></div></div></div>';
    B.appendChild(portail);

    /* ---------- la physique : quatre ressorts écrits à la main, masse 1, pas borné à 1/30 s, une seule boucle qui s'arrête ---------- */
    var PRE = { doux: [120, 22], vif: [260, 22], rebond: [180, 12], lourd: [60, 16] };
    var vivants = [], taches = [], enRoute = false, dernier = 0, cache = D.hidden, F = {}, tDefil = 0, rafId = 0;
    function Ressort(type, fn, eps) { var p = PRE[type]; this.k = p[0]; this.c = p[1]; this.x = 0; this.t = 0; this.v = 0; this.fn = fn; this.e = eps || .001; this.a = false; }
    Ressort.prototype.vers = function (t) { this.t = t; if (!this.a) { this.a = true; vivants.push(this); } reveil(); return this; };
    Ressort.prototype.pose = function (x) { this.x = this.t = x; this.v = 0; this.fn(x); return this; };
    Ressort.prototype.type = function (n) { var p = PRE[n]; this.k = p[0]; this.c = p[1]; return this; };
    function image(t) {
      rafId = 0;
      if (inst.mort) return;
      var dt = dernier ? Math.min(1 / 30, (t - dernier) / 1000) : 1 / 60, h = dt / 2, i, j, s; dernier = t;
      for (i = 0; i < taches.length;) if (t >= taches[i][0]) { var f = taches[i][1]; taches.splice(i, 1); f(); } else i++;
      for (i = vivants.length; i--;) {
        s = vivants[i];
        for (j = 0; j < 2; j++) { s.v += (-s.k * (s.x - s.t) - s.c * s.v) * h; s.x += s.v * h; }
        if (Math.abs(s.x - s.t) < s.e && Math.abs(s.v) < s.e * 30) { s.x = s.t; s.v = 0; s.a = false; vivants.splice(i, 1); }
        s.fn(s.x);
      }
      if (tDefil && t - tDefil > 110) { tDefil = 0; finDefil(); }
      rendu(t);
      if ((vivants.length || taches.length || tDefil) && !cache) rafId = requestAnimationFrame(image); else { enRoute = false; dernier = 0; }
    }
    function reveil() { if (!enRoute && !cache && !inst.mort) { enRoute = true; dernier = 0; rafId = requestAnimationFrame(image); } }
    function dans(ms, f) { taches.push([performance.now() + ms, f]); reveil(); }
    ec(D, 'visibilitychange', function () { cache = D.hidden; R.classList.toggle('q-pause', cache); if (!cache) reveil(); });
    /* les mêmes ressorts, intégrés une fois et confiés au compositeur : l'entrée reste fluide même si le script est occupé */
    function courbe(n) {
      var p = PRE[n], k = p[0], c = p[1], x = 0, v = 0, h = 1 / 240, i = 0, pts = [];
      for (; i < 600; i++) { v += (-k * (x - 1) - c * v) * h; x += v * h; if (i % 8 === 7) { pts.push(Math.round(x * 1e3) / 1e3); if (i > 48 && Math.abs(x - 1) < .003 && Math.abs(v) < .05) break; } }
      pts[pts.length - 1] = 1; return ['linear(0,' + pts.join(',') + ')', Math.round((i + 1) / 240 * 1000) + 'ms'];
    }
    if (JS && W.CSS && CSS.supports && CSS.supports('transition-timing-function', 'linear(0,.5,1)')) for (var nom in PRE) { var cb = courbe(nom); R.style.setProperty('--' + nom, cb[0]); R.style.setProperty('--t' + nom, cb[1]); }

    /* ---------- repères ---------- */
    var illu = $('.q-illu'), bandeau = $('.q-bandeau'), pill = $('.q-pill'), pillB = pill.firstElementChild, fleche = $('svg', pill), lum = $('.q-lum i');
    var nav = $('.q-nav'), navA = $$('.q-nav a'), navOn = $('.q-nav a.q-on') || navA[0], corps = $('.q-corps'), lignes = $$('.q-corps .q-lg');
    var fleur = $('.q-fleur'), fleurSuit = $('.q-suit'), champ = $('.q-cherche input'), rech = $('.q-rech'), app = $('.q-app');
    var couches = $$('.q-pl', illu).map(function (c) { return { el: c, d: +c.getAttribute('data-depth') }; });
    var feuilles = $$('.q-fl', illu).map(function (f, i) { return { el: f, s: i === 1 ? -1 : 1 }; });
    var fes = $$('.q-fe', illu), banne = $('#q-banne'), vg = $('#q-vg'), vd = $('#q-vd'), seuil = $('#q-seuil');
    var clavier = false;

    /* ---------- une seule forme qui glisse d'une ligne à l'autre : le bord de tête part vite, l'autre suit ---------- */
    function Glisse(cont, els) {
      var o = this; o.h = 0; o.b = 0; o.cont = cont; o.els = els;
      o.sh = new Ressort('doux', function (x) { o.h = x; F.g = 1; }, .05); o.sb = new Ressort('doux', function (x) { o.b = x; F.g = 1; }, .05);
    }
    Glisse.prototype.vers = function (a, net) {
      var o = this, r = a.getBoundingClientRect(), c = o.cont.getBoundingClientRect(), h = r.top - c.top, b = r.bottom - c.top;
      if (net || !JS) { o.sh.pose(h); o.sb.pose(b); return; }
      if (h > o.sh.t) { o.sb.vers(b); dans(28, function () { o.sh.vers(h); }); } else { o.sh.vers(h); dans(28, function () { o.sb.vers(b); }); }
    };
    Glisse.prototype.rend = function () { var t = 'translate3d(0,' + f2(this.h) + 'px,0) scaleY(' + (Math.max(6, this.b - this.h) / 100).toFixed(4) + ')'; for (var i = 0; i < this.els.length; i++) this.els[i].style.transform = t; };
    var gNav = new Glisse(nav, [$('#q-navFond'), $('#q-navBarre')]), gSel = new Glisse(corps, [$('#q-select')]), gRes = null, navVise = navOn;
    function reposer() { if (inst.mort) return; gNav.vers(navVise, true); gNav.rend(); rB = null; rF = null; if (cible) viser(cible, true); for (var i = 0; i < armes.length; i++) armes[i]._y = armes[i].getBoundingClientRect().top + W.scrollY; poserPil(); }
    var armes = [];

    /* ---------- valeurs pilotées par les ressorts, écrites une fois par image ---------- */
    var px = 0, py = 0, sc = 0, porte = 0, vent = 0, ond = 0, lx = 0, ly = 0, fx = 0, fy = 0, fr = 0;
    var sPx = new Ressort('lourd', function (x) { px = x; F.illu = 1; }), sPy = new Ressort('lourd', function (x) { py = x; F.illu = 1; }), sSc = new Ressort('lourd', function (x) { sc = x; F.illu = 1; });
    var sPorte = new Ressort('doux', function (x) { porte = x; F.porte = 1; }), sVent = new Ressort('lourd', function (x) { vent = x; F.vent = 1; }), sOnd = new Ressort('vif', function (x) { ond = x; });
    var sLx = new Ressort('lourd', function (x) { lx = x; F.lum = 1; }, .05), sLy = new Ressort('lourd', function (x) { ly = x; F.lum = 1; }, .05);
    var sFx = new Ressort('lourd', function (x) { fx = x; F.fleur = 1; }, .02), sFy = new Ressort('lourd', function (x) { fy = x; F.fleur = 1; }, .02), sFr = new Ressort('lourd', function (x) { fr = x; F.fleur = 1; }, .05);
    function rendu(t) {
      var i;
      if (F.illu) { F.illu = 0; for (i = 0; i < couches.length; i++) { var c = couches[i]; c.el.style.transform = 'translate3d(' + f2(px * c.d * 22) + 'px,' + f2(py * c.d * 12 - sc * c.d * 40) + 'px,0)'; } }
      if (F.porte) { F.porte = 0; var o = borne(porte, 0, 1), dx = f2(o * 11); vg.setAttribute('transform', 'translate(-' + dx + ' 0)'); vd.setAttribute('transform', 'translate(' + dx + ' 0)'); seuil.setAttribute('opacity', f2(o * .6)); fleche.style.transform = 'translate3d(' + f2(o * 4) + 'px,0,0)'; }
      if (F.vent) { F.vent = 0; for (i = 0; i < feuilles.length; i++) feuilles[i].el.style.transform = vent ? 'rotate(' + f2(vent * feuilles[i].s * 9) + 'deg) scaleY(' + (1 - Math.abs(vent) * .06).toFixed(3) + ')' : ''; }
      if (ond > .004 || ond < -.004) { var ph = t / 1000 * 13; for (i = 0; i < fes.length; i++) fes[i].style.transform = 'scaleY(' + (1 + ond * .5 * Math.sin(ph + i * .9)).toFixed(3) + ')'; banne.style.transform = 'skewX(' + f2(ond * 5 * Math.sin(ph * .6)) + 'deg)'; F.store = 1; }
      else if (F.store) { F.store = 0; for (i = 0; i < fes.length; i++) fes[i].style.transform = ''; banne.style.transform = ''; }
      if (F.lum) { F.lum = 0; lum.style.transform = 'translate3d(' + f2(lx) + 'px,' + f2(ly) + 'px,0)'; }
      if (F.fleur) { F.fleur = 0; fleurSuit.style.transform = 'translate3d(' + f2(fx) + 'px,' + f2(fy) + 'px,0) rotate(' + f2(fr) + 'deg)'; }
      if (F.g) { F.g = 0; gNav.rend(); gSel.rend(); if (gRes) gRes.rend(); }
      if (F.rev) { F.rev = 0; reveler(); }
      if (F.panel) { F.panel = 0; posePanel(); }
      if (F.anneau) { F.anneau = 0; anneau.style.transform = 'translate3d(' + f2(A.x) + 'px,' + f2(A.y) + 'px,0)'; anneau.style.width = f2(A.w) + 'px'; anneau.style.height = f2(A.h) + 'px'; }
    }

    /* ---------- la croix à diodes : trois séquences, une toutes les 18 à 25 s, ou quand on touche l'officine ---------- */
    var seqN = 0, seqOn = false;
    /* paramètres d'adresse de test, sans aucun contrôle à l'écran : ?croix=1, 2 ou 3 rejoue cette séquence toutes les 2 s ; ?geste=Nom d'un outil rejoue le geste de son picto */
    var essai = /[?&]croix=([123])/.exec(location.search), essaiG = /[?&]geste=([^&]+)/.exec(location.search);
    function sequence(n) { if (seqOn || !JS) return; seqOn = true; n = n || (seqN = seqN % 3 + 1); illu.classList.add('q-s' + n); to(function () { illu.classList.remove('q-s' + n); seqOn = false; }, 1250); }
    function planSeq() { clearTimeout(seqT); seqT = setTimeout(function () { if (inst.mort) return; if (!cache && !illu.classList.contains('q-hors')) sequence(); planSeq(); }, 18000 + Math.random() * 7000); }
    function ondeStore() { sOnd.vers(.75); dans(150, function () { sOnd.vers(0); }); }

    /* ---------- porte, lumière, parallaxe : tout part de la position du pointeur ---------- */
    var rB = null, rP = null, rF = null, rT = 0, approche = 0, foc = false, entre = false, pres = false;
    function mesurer() { rB = bandeau.getBoundingClientRect(); rP = pillB.getBoundingClientRect(); rT = $('.q-bandeau p').getBoundingClientRect().right; }
    function majPorte() { sPorte.vers(Math.max(approche, foc ? 1 : 0, entre ? 1 : 0)); }

    /* ---------- ouverture : l'élément cliqué grandit au ressort doux (la page recule sous un voile), puis l'écran s'ouvre ---------- */
    var panel = $('.q-panel', portail), voile = $('.q-overlay', portail), surf = $('.q-p-surf', portail), ombre = $('.q-p-ombre', portail), pCorps = $('.q-p-corps', portail), pTx = $('.q-p-tx', portail), pIco = $('.q-p-ico', portail), pFond = $('i', pIco), pUse = $('use', pIco), titre = $('.q-panel-titre', portail), pNom = $('.q-p-nom', portail);
    var P = { p: 0, on: false, nav: false, src: null, a: null, f: null, i0: null, t0: null, org: null };
    var sP = new Ressort('doux', function (x) { P.p = x; F.panel = 1; }, .0006);
    function mel(a, b, k) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' + Math.round(a[2] + (b[2] - a[2]) * k) + ')'; }
    function rgb(c) { var k = (c || '').match(/[\d.]+/g); return k && k.length >= 3 && (k.length < 4 || +k[3] > .5) ? [+k[0], +k[1], +k[2]] : null; }
    function depuis(src) {
      var el = src, porteS = src === bandeau, repli = false;
      if (porteS) el = $('#q-porteInt'); else if (src.classList.contains('q-bt')) el = src.firstElementChild;
      if (!el.isConnected) { el = $('.q-cherche'); repli = true; }
      var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return { l: r.left, t: r.top, w: Math.max(6, r.width), h: Math.max(6, r.height), ray: porteS ? 2 : (parseFloat(cs.borderTopLeftRadius) || 0), c: (porteS ? null : rgb(cs.backgroundColor)) || [255, 255, 255], el: porteS || repli ? null : el };
    }
    function icoDepuis(src) {
      if (src === bandeau || !src.isConnected) return null;
      var bloc = $('.q-ico[class*="q-t-"],.q-r-ic', src), s = bloc || $('svg.q-ic', src); if (!s) return null;
      var r = s.getBoundingClientRect(), cs = getComputedStyle(s);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, plein: !!bloc, teinte: bloc && bloc.classList.contains('q-ico') ? cs.backgroundImage : '', c: rgb(cs.color) || [0, 80, 230] };
    }
    function nomDepuis(src) {
      if (src === bandeau || !src.isConnected) return null;
      var b = $('b', src); if (!b || b.textContent.trim() !== pNom.textContent) return null;
      var g = D.createRange(); g.selectNodeContents(b); var r = g.getBoundingClientRect(), cs = getComputedStyle(b); if (!r.width) return null;
      return { l: r.left, t: r.top, px: parseFloat(cs.fontSize) || 14, c: rgb(cs.color) || [15, 20, 32] };
    }
    function mesurePanel() {
      var tr = app.style.transform; app.style.transform = ''; surf.style.transform = ombre.style.transform = pIco.style.transform = titre.style.transform = '';
      P.f = surf.getBoundingClientRect(); P.a = depuis(P.src);
      var i = icoDepuis(P.src), k = pIco.getBoundingClientRect();
      pFond.style.backgroundImage = i && i.teinte ? i.teinte : '';
      P.i0 = i ? { dx: i.x - (k.left + k.width / 2), dy: i.y - (k.top + k.height / 2), s: i.w / (i.plein ? k.width : 20), plein: i.plein, c: i.c, c1: i.teinte ? [255, 255, 255] : [0, 80, 230] } : null;
      if (!i) pIco.style.color = '';
      var n = nomDepuis(P.src), rt = titre.getBoundingClientRect(), rn = pNom.getBoundingClientRect();
      P.t0 = n ? { ox: f2(rn.left - rt.left), oy: f2(rn.top - rt.top), x1: rn.left, y1: rn.top, rx0: n.l - P.a.l, ry0: n.t - P.a.t, rx1: rn.left - P.f.left, ry1: rn.top - P.f.top, s: n.px / (parseFloat(getComputedStyle(titre).fontSize) || 18), c: n.c } : null;
      P.kx = k.left + k.width / 2; P.kr = k.right;
      app.style.transformOrigin = '50% ' + f2(W.scrollY + W.innerHeight / 2 - app.offsetTop) + 'px'; app.style.transform = tr;
    }
    function posePanel() {
      var a = P.a, f = P.f; if (!a) return;
      var q = borne(P.p, 0, 1), l = a.l + (f.left - a.l) * q, t = a.t + (f.top - a.t) * q, sx = (a.w + (f.width - a.w) * q) / f.width, sy = (a.h + (f.height - a.h) * q) / f.height, ray = a.ray + (16 - a.ray) * q;
      var tr = 'translate3d(' + f2(l - f.left) + 'px,' + f2(t - f.top) + 'px,0) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')';
      surf.style.transform = tr; ombre.style.transform = tr;
      surf.style.borderRadius = f2(ray / sx) + 'px/' + f2(ray / sy) + 'px';
      surf.style.opacity = borne(q / .12, 0, 1);
      surf.style.backgroundColor = mel(a.c, [255, 255, 255], borne(q * 2, 0, 1));
      ombre.style.opacity = q; voile.style.opacity = q;
      app.style.transform = q > .002 ? 'scale(' + (1 - .015 * q).toFixed(5) + ')' : '';
      var w = sx * f.width, hh = sy * f.height, net = q > .998; pCorps.style.clipPath = net ? '' : 'inset(' + f2(t - f.top) + 'px ' + f2(f.right - l - w) + 'px ' + f2(f.bottom - t - hh) + 'px ' + f2(l - f.left) + 'px round ' + f2(ray) + 'px)';
      /* le nom de l'élément voyage avec la carte : il passe d'abord sous le picto (vers la droite), puis monte à sa place */
      var t0 = P.t0, i = P.i0, c = borne((q - .5) / .4, 0, 1);
      if (t0) {
        var ex = 1 - Math.pow(1 - q, 1.5), u = borne((q - .28) / .36, 0, 1), ey = u * u * (3 - 2 * u), st = t0.s + (1 - t0.s) * q, nx = l + t0.rx0 + (t0.rx1 - t0.rx0) * ex, ny = t + t0.ry0 + (t0.ry1 - t0.ry0) * ey;
        titre.style.transformOrigin = t0.ox + 'px ' + t0.oy + 'px'; titre.style.transform = net ? '' : 'translate3d(' + f2(nx - t0.x1) + 'px,' + f2(ny - t0.y1) + 'px,0) scale(' + st.toFixed(4) + ')';
        titre.style.opacity = q > .001 ? 1 : 0; pNom.style.color = mel(t0.c, [15, 20, 32], borne(q * 3, 0, 1));
      } else { titre.style.transform = ''; titre.style.opacity = borne((q - .12) / .3, 0, 1); pNom.style.color = ''; }
      if (i) { var s = i.s + (1 - i.s) * q, n = borne(q * 3, 0, 1); pIco.style.transform = 'translate3d(' + f2(i.dx * (1 - q)) + 'px,' + f2(i.dy * (1 - q)) + 'px,0) scale(' + s.toFixed(4) + ')'; pIco.style.opacity = q > .001 ? 1 : 0; pFond.style.opacity = i.plein ? 1 : borne(q * 2.5, 0, 1); pIco.style.color = mel(i.c, i.c1, n); }
      else { pIco.style.opacity = c; pIco.style.transform = 'scale(' + (.96 + .04 * c).toFixed(4) + ')'; pFond.style.opacity = 1; }
      if (a.el) a.el.classList.toggle('q-parti', q > .12);
      if (!P.on && !sP.a) rangePanel();
    }
    function rangePanel() { panel.classList.remove('q-open', 'q-sort'); voile.classList.remove('q-open'); voile.style.opacity = ''; app.style.transform = ''; app.style.transformOrigin = ''; if (P.a && P.a.el) P.a.el.classList.remove('q-parti'); P.a = null; P.nav = false; }
    /* Un second clic pendant l'ouverture ne fait rien. Sans animation (mouvement réduit), l'écran s'ouvre tout de suite. */
    function ouvrir(src, nom, agir, ic) {
      if (P.nav) return;
      if (!JS) { agir(); return; }
      P.nav = true;
      pNom.textContent = nom; pUse.setAttribute('href', '#q-i-' + (ic || src.getAttribute('data-ic') || 'officines'));
      P.org = D.activeElement && D.activeElement !== B ? D.activeElement : src;
      P.src = src; P.on = true; panel.classList.remove('q-sort'); panel.classList.add('q-open'); voile.classList.add('q-open');
      mesurePanel(); sP.type('doux').vers(1);
      if (src === bandeau) { entre = true; majPorte(); }
      to(function () { agir(); }, 250);   /* 250 ms : la carte est formée, l'écran suit */
      to(retour, 1800);                    /* garde-fou : si l'écran ne s'est pas ouvert, la carte se referme */
    }
    function retour() {
      if (!P.on) return;
      P.on = false; voile.classList.remove('q-open'); panel.classList.add('q-sort'); mesurePanel(); sP.type('vif').vers(0); entre = false; majPorte();
      if (P.org && P.org.isConnected && P.org.focus) P.org.focus({ preventScroll: true });
    }

    /* ---------- anneau de focus : il se pose au ressort et glisse d'un élément au suivant ---------- */
    var anneau = D.createElement('span'), cible = null, A = { x: 0, y: 0, w: 0, h: 0 }; anneau.className = 'q-anneau'; anneau.setAttribute('aria-hidden', 'true'); portail.appendChild(anneau);
    var sAx = new Ressort('vif', function (x) { A.x = x; F.anneau = 1; }, .05), sAy = new Ressort('vif', function (x) { A.y = x; F.anneau = 1; }, .05), sAw = new Ressort('vif', function (x) { A.w = x; F.anneau = 1; }, .05), sAh = new Ressort('vif', function (x) { A.h = x; F.anneau = 1; }, .05);
    function viser(el, net) {
      cible = el; var t = el === champ ? el.closest('.q-cherche') : el.classList.contains('q-bt') ? el.firstElementChild : el;
      var r = t.getBoundingClientRect(), mg = 3, x = r.left - mg, y = r.top - mg, w = r.width + 2 * mg, h = r.height + 2 * mg, neuf = !anneau.classList.contains('q-vu');
      anneau.style.borderRadius = Math.min(24, (parseFloat(getComputedStyle(t).borderTopLeftRadius) || 6) + mg) + 'px';
      if (net || neuf) { var g = net ? 0 : 7; sAx.pose(x - g); sAy.pose(y - g); sAw.pose(w + 2 * g); sAh.pose(h + 2 * g); }
      sAx.vers(x); sAy.vers(y); sAw.vers(w); sAh.vers(h); anneau.classList.add('q-vu');
    }
    function sansAnneau() { cible = null; anneau.classList.remove('q-vu'); }

    /* ---------- recherche : elle cherche vraiment (les 24 outils, les officines de l'app) ---------- */
    function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function indexOutils() {
      var vus = {}, out = [];
      $$('[data-outil]').forEach(function (a, i) {
        var k = a.getAttribute('data-k'); if (k === 'relance' || k === 'une' || a === bandeau) return;
        var n = a.getAttribute('data-outil'); if (vus[n]) return; vus[n] = 1;
        var ext = a.target === '_blank', e = $('[data-ph]', a);
        out.push({ n: n, ph: e ? e.textContent : '', ic: a.getAttribute('data-ic') || 'officines', href: ext ? a.getAttribute('href') : '', act: a.getAttribute('data-act') || '', imm: a.hasAttribute('data-imm'), o: i + (ext || a.classList.contains('q-bt') ? 2000 : 0) });
      });
      return out.sort(function (a, b) { return a.o - b.o; });
    }
    var GRP_OFF = { 'Pharmacies': 1, 'Officines (France entière)': 1, 'Fiches créées': 1 };
    function chercher(q, brut) {
      var res = [];
      indexOutils().forEach(function (it) {
        var n = norm(it.n), p = norm(it.ph), s = n.indexOf(q) === 0 ? 0 : (' ' + n.replace(/['-]/g, ' ')).indexOf(' ' + q) >= 0 ? 1 : n.indexOf(q) >= 0 ? 2 : (' ' + p.replace(/['-]/g, ' ')).indexOf(' ' + q) >= 0 ? 3 : p.indexOf(q) >= 0 ? 4 : -1;
        if (s >= 0) res.push({ it: it, s: s });
      });
      res.sort(function (a, b) { return a.s - b.s || a.it.o - b.it.o; });
      var out = res.slice(0, 5).map(function (x) { return x.it; });
      /* les officines : la même recherche que la palette de l'app (clientes, base nationale, fiches créées à la main) */
      try {
        var pid = {}, vues = 0, byId = {}; (V2.pharmacies || []).forEach(function (p) { byId[String(p.id)] = p; });
        cmdkSearch(brut).forEach(function (x) {
          if (vues >= 3 || !GRP_OFF[x.grp] || x.pid == null || pid[x.pid]) return;
          pid[x.pid] = 1; vues++;
          var p = byId[String(x.pid)];
          out.push({ n: x.label, ph: x.meta || (p ? [p.ville, p.cp].filter(Boolean).join(' · ') : ''), ic: 'officines', fn: x.action, href: '', act: '', imm: false, o: 3000 });
        });
      } catch (e) {}
      return out;
    }
    function esq(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function marque(t, q) { var i = norm(t).indexOf(q); return i < 0 ? esq(t) : esq(t.slice(0, i)) + '<mark>' + esq(t.slice(i, i + q.length)) + '</mark>' + esq(t.slice(i + q.length)); }
    var res = null, resIn = null, choix = [], sel = 0, listeSort = false;
    var sH = new Ressort('doux', function (x) { if (!res) return; if (listeSort && x < 2) { res.remove(); res = resIn = gRes = null; listeSort = false; return; } res.style.height = f2(Math.max(0, x)) + 'px'; }, .3);
    function fermerListe(net) {
      choix = []; champ.setAttribute('aria-expanded', 'false'); champ.removeAttribute('aria-activedescendant'); if (!res) return;
      if (net || !JS) { res.remove(); res = resIn = gRes = null; listeSort = false; sH.pose(0); } else { listeSort = true; sH.type('vif').vers(0); }
    }
    function choisir(i) { var rows = $$('.q-r', resIn); if (!rows[i]) return; sel = i; rows.forEach(function (a, k) { a.setAttribute('aria-selected', k === i ? 'true' : 'false'); }); champ.setAttribute('aria-activedescendant', 'q-r' + i); if (gRes) gRes.vers(rows[i]); }
    function valider(i, e) {
      var it = choix[i], a = resIn && $$('.q-r', resIn)[i]; if (!it || !a) return;
      if (it.href) { W.open(it.href, '_blank', 'noopener'); return; }
      if (e && e.preventDefault) e.preventDefault();
      var fn = it.fn || function () { qAgir(it.act); };
      if (it.imm) { fn(); champ.value = ''; fermerListe(true); return; }
      ouvrir(a, it.n, fn, it.ic); champ.value = ''; fermerListe(true);
    }
    function lister() {
      var brut = champ.value.trim(), q = norm(brut); if (!q) { fermerListe(); return; }
      listeSort = false;
      choix = chercher(q, brut);
      if (!res) {
        res = D.createElement('div'); res.className = 'q-res'; res.id = 'q-res'; res.setAttribute('role', 'listbox'); res.setAttribute('aria-label', 'Résultats');
        resIn = D.createElement('div'); resIn.className = 'q-res-in'; res.appendChild(resIn); rech.appendChild(res); sH.pose(0);
        res.addEventListener('mousedown', function (e) { e.preventDefault(); });
      }
      champ.setAttribute('aria-expanded', 'true');
      resIn.innerHTML = choix.length ? '<span class="q-res-hl" aria-hidden="true"></span>' + choix.map(function (it, i) {
        return '<a class="q-r" role="option" id="q-r' + i + '" href="' + (it.href ? esq(it.href) : '#') + '"' + (it.href ? ' target="_blank" rel="noopener"' : '') + ' data-ic="' + it.ic + '"><span class="q-r-ic">' + qUse(it.ic) + '</span><span class="q-r-tx"><b>' + marque(it.n, q) + '</b>' + (it.ph ? '<span>' + marque(it.ph, q) + '</span>' : '') + '</span></a>';
      }).join('') : '<div class="q-res-vide">Aucun outil ni officine à ce nom.</div>';
      var rows = $$('.q-r', resIn);
      rows.forEach(function (a, i) { a.addEventListener('mouseenter', function () { choisir(i); }); if (!choix[i].href) a.addEventListener('click', function (e) { valider(i, e); }); });
      gRes = rows.length ? new Glisse(resIn, [$('.q-res-hl', resIn)]) : null; sel = 0;
      if (gRes) { gRes.vers(rows[0], true); gRes.rend(); rows[0].setAttribute('aria-selected', 'true'); champ.setAttribute('aria-activedescendant', 'q-r0'); } else champ.removeAttribute('aria-activedescendant');
      var H = resIn.offsetHeight + 2; if (JS) sH.type('doux').vers(H); else res.style.height = H + 'px';
    }
    ec(champ, 'input', lister);
    ec(champ, 'focus', function () {
      /* la base nationale des officines (chargée à la demande) et les fiches créées à la main : comme la palette */
      try { preloadPharmaFrForSearch(); V2.ensurePharmaFr(function () { if (!inst.mort && D.activeElement === champ && champ.value.trim()) lister(); }); } catch (e) {}
      if (champ.value.trim()) lister();
    });
    ec(champ, 'blur', function () { to(function () { if (D.activeElement !== champ) fermerListe(); }, 140); });
    ec(champ, 'keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (res && choix.length) { e.preventDefault(); choisir(borne(sel + (e.key === 'ArrowDown' ? 1 : -1), 0, choix.length - 1)); } }
      else if (e.key === 'Enter') { if (res && choix.length) { e.preventDefault(); valider(sel, e); } }
      else if (e.key === 'Escape' && (res || champ.value)) { e.preventDefault(); champ.value = ''; fermerListe(); }
    });
    /* ⌘K / Ctrl K : le champ de l'accueil prend le focus (la palette de l'app ne s'ouvre pas par-dessus) */
    ec(D, 'keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); e.stopPropagation(); if (P.on) return; clavier = true; champ.focus(); champ.select(); }
      else if (e.key === 'Tab') clavier = true;
    }, true);

    /* ---------- la phrase, le compteur à tambours, les mots qui montent de derrière un cache ---------- */
    var h1 = $('.q-bandeau h1'), dateEl = $('.q-date'), para = $('.q-bandeau p'), n690 = $('#q-n690'), dateTxt = dateEl.textContent, orig = { h1: h1.innerHTML, p: para.innerHTML }, motsP = [], textesFinis = !JS;
    function mot(c, cl) { var o = D.createElement('span'), i = D.createElement('span'); o.className = 'q-mo'; i.className = cl || 'q-mi'; if (typeof c === 'string') i.textContent = c; else i.appendChild(c); o.appendChild(i); return o; }
    function decoupe(el, cl) {
      var out = []; [].slice.call(el.childNodes).forEach(function (nd) {
        if (nd.nodeType === 3) { var fr = D.createDocumentFragment(); nd.textContent.split(/(\s+)/).forEach(function (w) { if (!w) return; if (/^\s+$/.test(w)) fr.appendChild(D.createTextNode(' ')); else { var mm = mot(w, cl); fr.appendChild(mm); out.push(mm); } }); el.replaceChild(fr, nd); }
        else { var ph = D.createComment(''); el.replaceChild(ph, nd); var mm = mot(nd, cl); el.replaceChild(mm, ph); out.push(mm); }
      });
      return out;
    }
    function phrase() { var lig = -1, hautDer = null; motsP.forEach(function (mm) { var t = mm.offsetTop; if (hautDer === null || Math.abs(t - hautDer) > 7) { lig++; hautDer = t; } mm.firstChild.style.setProperty('--d', (lig * 60) + 'ms'); }); para.classList.add('q-la'); }
    /* un tambour par chiffre : les unités font le plus de chemin ; l'état final et le texte caché = le nombre */
    function tambours(n) {
      var t = String(n), L = t.length, h = '<span class="q-vh">' + t + '</span><span class="q-tb" aria-hidden="true">', i;
      for (i = 0; i < L; i++) {
        var d = +t.charAt(i), p = L - 1 - i, s = p === 0 ? 10 : p === 1 ? 7 : 2, items = [], j;
        for (j = 0; j <= s; j++) items.push(((d - s + j) % 10 + 10) % 10);
        h += '<span class="q-col"><span class="q-ph">' + d + '</span><span class="q-rb" style="--y:-' + f2(s / (s + 1) * 100) + '%;--d:' + (240 + i * 120) + 'ms">' + items.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</span></span>';
      }
      return h + '</span>';
    }
    function roulerPlus(n) {   /* le compteur arrive après l'entrée (ventes chargées) : il roule une fois */
      var el = $('#q-n690'), nb; if (!el) return;
      el.innerHTML = tambours(n); nb = $$('.q-rb', el);
      nb.forEach(function (r) { r.style.transition = 'none'; r.style.transform = 'none'; }); void el.offsetWidth;
      nb.forEach(function (r) { r.style.transition = ''; r.style.transform = ''; });
      to(function () { var e2 = $('#q-n690'); if (e2) e2.textContent = String(n); }, 1700);
    }

    /* ---------- la semaine : la pastille du jour glisse ; un jour qui porte une relance la fait remonter ---------- */
    var jours = $('.q-jours'), cel = $$('.q-jours>.q-jour'), pil = $('.q-pil'), nuit = $('.q-inv'), liste = $('#q-liste'), toutBtn = $('#q-tout'), videEl = $('#q-vide');
    var sem = qSemaine(), selJ = sem.dow, pA = 0, pB = 0, tamp = JS ? 1.45 : 1, plie = true, relSig = '', parJour = {}, relDonnees = [];
    var sTamp = new Ressort('rebond', function (x) { tamp = x; rendrePil(); }, .002);
    var sPa = new Ressort('doux', function (x) { pA = x; rendrePil(); }, .05), sPb = new Ressort('doux', function (x) { pB = x; rendrePil(); }, .05);
    function bords(k) { var w = jours.clientWidth, cw = (w - 24) / 7, a = k * (cw + 4); return [a, a + cw]; }
    function rendrePil() {
      var w = jours.clientWidth, s = tamp, cx = (pA + pB) / 2, l = Math.max(2, pB - pA) * s, c = 'inset(0 ' + (w - pB).toFixed(2) + 'px 0 ' + pA.toFixed(2) + 'px round 8px)';
      nuit.style.webkitClipPath = c; nuit.style.clipPath = c;
      nuit.style.transformOrigin = cx.toFixed(2) + 'px 50%'; nuit.style.transform = s !== 1 ? 'scale(' + s.toFixed(4) + ')' : '';
      pil.style.width = l.toFixed(2) + 'px'; pil.style.transform = 'translate3d(' + (cx - l / 2).toFixed(2) + 'px,0,0)' + (s !== 1 ? ' scaleY(' + s.toFixed(4) + ')' : '');
    }
    function poserPil() { var b = bords(selJ); pA = b[0]; pB = b[1]; sPa.pose(pA); sPb.pose(pB); rendrePil(); }
    function glissePil(a, b) {
      if (!JS) { pA = a; pB = b; rendrePil(); return; }
      if (a > sPa.t) { sPb.vers(b); dans(28, function () { sPa.vers(a); }); } else { sPa.vers(a); dans(28, function () { sPb.vers(b); }); }
    }
    function poserTampon() { pil.style.opacity = nuit.style.opacity = '1'; if (JS) sTamp.vers(1); else { tamp = 1; rendrePil(); } }
    function visibles() { var cartes = $$('.q-rel', liste); cartes.forEach(function (c, i) { c.hidden = plie && i >= 3; }); }
    /* les cartes changent de place sans se téléporter : chacune garde sa position à l'écran, puis rejoint la nouvelle */
    function ordonner(premiers) {
      var cartes = $$('.q-rel', liste), cachees = cartes.map(function (c) { return c.hidden; }), y0 = cartes.map(function (c) { return c.offsetTop; }), prem = premiers.map(function (i) { return cartes.filter(function (c) { return +c.getAttribute('data-i') === i; })[0]; }).filter(Boolean);
      var reste = cartes.filter(function (c) { return prem.indexOf(c) < 0; }).sort(function (a, b) { return +a.getAttribute('data-i') - +b.getAttribute('data-i'); });
      prem.concat(reste).forEach(function (c) { liste.appendChild(c); });
      cartes.forEach(function (c) { c.hidden = false; });
      if (JS) cartes.forEach(function (c, i) {
        var dy = y0[i] - c.offsetTop; if (!dy || cachees[i]) return;
        var s = c._fl || (c._fl = new Ressort('doux', function (x) { c.style.translate = x ? '0 ' + f2(x) + 'px' : ''; }, .3));
        s.type(prem.indexOf(c) >= 0 ? 'vif' : 'doux').pose(dy); s.vers(0);
        if (prem.indexOf(c) >= 0) { c.classList.add('q-porte'); to(function () { c.classList.remove('q-porte'); }, 640); }
      });
      visibles();
    }
    function choisirJour(k) {
      if (k === selJ) { if (JS) { sTamp.x = .94; sTamp.type('vif').vers(1); } return; }
      selJ = k; var b = bords(k); glissePil(b[0], b[1]);
      cel.forEach(function (c, i) { if (c.classList.contains('q-rdv')) c.setAttribute('aria-pressed', i === k ? 'true' : 'false'); });
      if (parJour[k]) ordonner(parJour[k]);
    }
    function lierRel(c) {
      var s = new Ressort('vif', function (x) { c.style.transform = x ? 'translate3d(0,' + f2(-x * 3) + 'px,0)' : ''; });
      if (JS) { c.addEventListener('mouseenter', function () { s.vers(1); }); c.addEventListener('mouseleave', function () { s.vers(0); }); }
      var i = +c.getAttribute('data-i'), cell = null;
      c.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') { var k = relJour(i); if (k >= 0 && cel[k]) cel[k].classList.add('q-vise'); } });
      c.addEventListener('pointerleave', function () { cel.forEach(function (x) { x.classList.remove('q-vise'); }); });
    }
    function relJour(i) { var r = relDonnees[i]; if (!r) return -1; var k = sem.dow + r.diff; return k >= 0 && k <= 6 ? k : -1; }
    /* le point d'un jour : remplit les jours en place (sans changer les éléments, donc sans casser leur entrée) */
    function majJours() {
      var sm = qSemaine(); sem = sm; var dow = sm.dow;
      var html = qJoursHtml(sm, { l: relDonnees }, parJour, false);
      var tmp = D.createElement('div'); tmp.innerHTML = html; var neufs = [].slice.call(tmp.children);
      cel.forEach(function (c, k) {
        var n = neufs[k], tr = n.classList.contains('q-rdv');
        c.classList.toggle('q-rdv', tr);
        ['role', 'tabindex', 'aria-pressed', 'aria-label', 'data-k'].forEach(function (a) { if (n.hasAttribute(a)) c.setAttribute(a, n.getAttribute(a)); else c.removeAttribute(a); });
        var pt = $('.q-pt', c); if (pt) pt.remove(); var np = $('.q-pt', n); if (np) c.appendChild(np);
        if (tr) c.setAttribute('aria-pressed', k === selJ ? 'true' : 'false');
      });
      nuit.innerHTML = qJoursHtml(sm, { l: relDonnees }, parJour, true);
    }
    function relSignature(rel) { return rel.l.map(function (r) { return r.pid + ':' + r.diff + ':' + r.name; }).join('|') + (rel.pret ? '!' : ''); }
    function majRelances(depart) {
      var rel = qRelances(), sig = relSignature(rel); if (sig === relSig) return; relSig = sig;
      relDonnees = rel.l; parJour = qParJour(rel.l, sem.dow);
      if (!depart) {
        liste.innerHTML = rel.l.map(qCarteRel).join('');
        var cartes = $$('.q-rel', liste);
        cartes.forEach(function (c, i) { lierRel(c); if (JS) { c.classList.add('q-arme'); } });
        void liste.offsetWidth;
        cartes.forEach(function (c, i) { c.style.setProperty('--d', (i * 60) + 'ms'); c.classList.remove('q-arme'); if (JS) to(function () { fin(c); }, i * 60 + 1300); else fin(c); });
        plie = true; toutBtn.textContent = 'Tout afficher'; toutBtn.setAttribute('aria-expanded', 'false');
        majJours();
      } else { $$('.q-rel', liste).forEach(lierRel); }
      toutBtn.hidden = rel.l.length <= 3; videEl.hidden = !(rel.pret && !rel.l.length); visibles();
    }
    function basculerTout() { plie = !plie; toutBtn.textContent = plie ? 'Tout afficher' : 'Afficher moins'; toutBtn.setAttribute('aria-expanded', plie ? 'false' : 'true'); visibles(); }

    /* ---------- les données qui arrivent après le premier dessin : mises à jour en place, sans rejouer l'entrée ---------- */
    var phraseCourante = para.innerHTML;
    function majPhrase() {
      var h = qPhrase(m, { l: relDonnees }, qInfosModele()); if (h === phraseCourante) return;
      var aN = /id="q-n690"/.test(phraseCourante);
      phraseCourante = h;
      if (!textesFinis) { orig.p = h; return; }
      para.innerHTML = h;
      if (JS && !aN && /id="q-n690"/.test(h)) roulerPlus(m.nb);
    }
    function majInfos() {
      if (inst.mort) return;
      var el = $('.q-infos'); if (el) { var h = qInfosIn(qInfosModele()); if (el._h !== h) { el._h = h; el.innerHTML = h; } }
      majPhrase();
    }
    function remplir(a, o, interne) {
      ['href', 'role', 'target', 'rel', 'data-act', 'data-imm', 'data-outil', 'data-ic', 'data-k'].forEach(function (k) { a.removeAttribute(k); });
      var at = qAttr(o); for (var k in at) a.setAttribute(k, at[k]);
      a.innerHTML = interne;
    }
    var sigOutils = '';
    function signature(rep) { return [rep.nav, rep.tuiles, rep.table].map(function (l) { return l.map(function (o) { return o.k + (o.ext ? '' : (qUsage(o.k) || {}).t); }).join(','); }).join('/') + (rep.sans ? '!' : ''); }
    function majOutils(depart) {
      var rep = qRepartition(), sig = signature(rep); if (depart) { sigOutils = sig; return true; }
      if (sig === sigOutils) return true;
      var tu = $$('.q-tuile'), ta = lignes;
      if (navA.length !== rep.nav.length || tu.length !== rep.tuiles.length || ta.length !== rep.table.length) return false;
      sigOutils = sig;
      navA.forEach(function (a, i) { remplir(a, rep.nav[i], qNavIn(rep.nav[i])); });
      tu.forEach(function (a, i) { remplir(a, rep.tuiles[i], qTuileIn(rep.tuiles[i], i)); });
      ta.forEach(function (a, i) { remplir(a, rep.table[i], qLigneIn(rep.table[i])); });
      R.classList.toggle('q-sans-usage', !!rep.sans);
      return true;
    }

    /* ---------- entrée : toutes les écritures d'abord (tambours, caches, partition), pour qu'une seule mise en page suffise ---------- */
    if (JS) {
      if (n690) n690.innerHTML = tambours(m.nb);
      decoupe(h1).forEach(function (mm, i) { mm.firstChild.style.setProperty('--d', (i * 60) + 'ms'); });
      var dm = mot(dateTxt); dateEl.textContent = ''; dateEl.appendChild(dm); dm.firstChild.style.setProperty('--d', '120ms');
      motsP = decoupe(para, 'q-mj');
      /* la partition : instant de départ, écart entre voisins */
      [['.q-nav a', 120, 40], ['.q-sec.q-outils', 340, 0], ['.q-tuile', 380, 45], ['.q-une', 360, 0], ['.q-profil .q-avatar', 180, 0], ['.q-profil>b', 240, 0], ['.q-profil .q-role', 268, 0],
        ['.q-sem', 380, 0], ['.q-jours>.q-jour', 405, 25], ['.q-rl', 480, 0], ['.q-rel', 520, 60], ['.q-vide', 520, 0], ['.q-tout', 700, 0], ['.q-infos-t', 660, 0], ['.q-infos', 700, 0],
        ['#q-tous', 540, 0], ['.q-table', 570, 0], ['.q-table .q-lg', 600, 40]].forEach(function (q) { $$(q[0]).forEach(function (el, i) { el.style.setProperty('--d', (q[1] + i * q[2]) + 'ms'); }); });
    }
    gNav.vers(navOn, true); gNav.rend();
    ec(W, 'resize', reposer);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(reposer);
    majOutils(true); majRelances(true); poserPil();
    $$('.q-tuile,.q-tout,.q-infos,.q-une').forEach(function (t) {
      var amp = t.classList.contains('q-tuile') ? 6 : 3, s = new Ressort('vif', function (x) { t.style.transform = x ? 'translate3d(0,' + f2(-x * amp) + 'px,0)' : ''; });
      if (JS) { t.addEventListener('mouseenter', function () { s.vers(1); if (amp === 6) joue(t); }); t.addEventListener('mouseleave', function () { s.vers(0); }); }
    });
    $$('.q-rel', liste).forEach(lierRel); visibles();

    /* ---------- les clics et le clavier : un seul écouteur sur la page ---------- */
    var moiOuvert = false;
    ec(page, 'pointerdown', function (e) { if (e.target.closest && e.target.closest('[data-moi]')) moiOuvert = !!D.getElementById('v2-usermenu'); }, true);
    ec(page, 'click', function (e) {
      if (e.defaultPrevented || e.button) return;
      var t = e.target; if (!t || !t.closest) return;
      if (t.closest('[data-moi]')) { e.preventDefault(); if (moiOuvert) { moiOuvert = false; return; } V2.userMenu(); return; }
      if (t.closest('a[href="#tous"]')) { e.preventDefault(); $('#q-tous').scrollIntoView({ behavior: JS ? 'smooth' : 'auto', block: 'start' }); return; }
      if (t.closest('#q-tout')) { basculerTout(); return; }
      var j = t.closest('.q-jour.q-rdv'); if (j && !j.closest('.q-inv')) { choisirJour(+j.getAttribute('data-k')); return; }
      var a = t.closest('[data-act]'); if (!a || !page.contains(a)) return;
      if ((e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && a.getAttribute('href')) return;   /* nouvel onglet : le navigateur s'en charge */
      e.preventDefault();
      var act = a.getAttribute('data-act');
      if (a.hasAttribute('data-imm')) { qAgir(act); return; }
      ouvrir(a, a.getAttribute('data-outil') || '', function () { qAgir(act); }, a.getAttribute('data-ic'));
    });
    ec(page, 'keydown', function (e) {
      var t = e.target; if (!t || !t.matches) return;
      if ((e.key === 'Enter' || e.key === ' ') && t.matches('.q-jour.q-rdv')) { e.preventDefault(); t.click(); }
      else if (e.key === 'Enter' && t.matches('a[role="link"]')) { e.preventDefault(); t.click(); }
      else if (t.matches('[data-moi]') && (e.key === 'Enter' || e.key === ' ')) moiOuvert = !!D.getElementById('v2-usermenu');
    }, true);

    if (!JS) { R.classList.add('q-pret'); inst.maj = majFn; wrapInst(); return inst; }

    /* ================= tout ce qui suit est du mouvement : absent si l'on a demandé moins d'animations ================= */
    /* focus au clavier : l'anneau, le repère de la barre et la teinte du tableau suivent */
    ec(D, 'mousedown', function () { clavier = false; sansAnneau(); }, true);
    ec(D, 'touchstart', function () { clavier = false; sansAnneau(); }, { capture: true, passive: true });
    ec(D, 'focusin', function (e) {
      var el = e.target; if (!clavier || !el || el === B || !page.contains(el) || !el.getBoundingClientRect) return; viser(el);
      if (el.parentNode === nav) { navVise = el; gNav.vers(el); }
      if (el.parentNode === corps) { var prem = !corps.classList.contains('q-survol'); corps.classList.add('q-survol'); gSel.vers(el, prem); }
      if (el === bandeau) { foc = true; majPorte(); }
      if (el.classList.contains('q-tuile') || el.parentNode === nav) joue(el);
    });
    ec(D, 'focusout', function (e) {
      var el = e.target; if (!e.relatedTarget) sansAnneau();
      if (el.parentNode === nav) { navVise = navOn; gNav.vers(navOn); }
      if (el.parentNode === corps) corps.classList.remove('q-survol');
      if (el === bandeau) { foc = false; majPorte(); }
    });
    /* survol : le repère glisse, la teinte glisse, les tuiles se soulèvent, chaque picto joue son geste */
    function joue(a) { a.classList.remove('q-g'); void a.offsetWidth; a.classList.add('q-g'); clearTimeout(a._g); a._g = setTimeout(function () { a.classList.remove('q-g'); }, 480); if (a === navOn) ondeStore(); }
    navA.forEach(function (a) { a.addEventListener('mouseenter', function () { navVise = a; gNav.vers(a); joue(a); }); });
    nav.addEventListener('mouseleave', function () { navVise = navOn; gNav.vers(navOn); });
    lignes.forEach(function (l) { l.addEventListener('mouseenter', function () { var prem = !corps.classList.contains('q-survol'); corps.classList.add('q-survol'); gSel.vers(l, prem); }); });
    corps.addEventListener('mouseleave', function () { corps.classList.remove('q-survol'); });

    ec(W, 'mousemove', function (e) {
      if (!rB) mesurer();
      var x = e.clientX, y = e.clientY;
      if (!illu.classList.contains('q-hors')) { sPx.vers(borne((x - (rB.left + rB.width * .75)) / (W.innerWidth * .5), -1, 1)); sPy.vers(borne((y - (rB.top + rB.height * .5)) / (W.innerHeight * .5), -1, 1)); }
      var p = x > rB.left && x < rB.right && y > rB.top && y < rB.bottom;
      if (p) { if (!pres) { sLx.pose(x - rB.left); sLy.pose(y - rB.top); F.lum = 1; } sLx.vers(x - rB.left); sLy.vers(y - rB.top); lum.style.setProperty('--lo', f2(.3 + .7 * borne((x - rT + 20) / 130, 0, 1))); }   /* au-dessus du texte, la lumière garde 30 % de sa force : le blanc reste lisible même quand le rai passe */
      if (p !== pres) { pres = p; bandeau.classList.toggle('q-pres', p); }
      var dx = Math.max(rP.left - x, 0, x - rP.right), dy = Math.max(rP.top - y, 0, y - rP.bottom); approche = borne(1 - (Math.sqrt(dx * dx + dy * dy) - 10) / 170, 0, 1); majPorte();
      if (!rF) { var k = fleur.getBoundingClientRect(); rF = [k.left + k.width / 2 - fx, k.top + k.height / 2 - fy]; }
      var kx = x - rF[0], ky = y - rF[1], kd = Math.sqrt(kx * kx + ky * ky) || 1, km = Math.min(10, kd / 40); sFx.vers(kx / kd * km); sFy.vers(ky / kd * km);
    }, { passive: true });
    ec(D, 'mouseleave', function () { sPx.vers(0); sPy.vers(0); approche = 0; majPorte(); sFx.vers(0); sFy.vers(0); if (pres) { pres = false; bandeau.classList.remove('q-pres'); } });
    /* toucher l'officine fait jouer la croix */
    ec(bandeau, 'pointerdown', function (e) { var r = illu.getBoundingClientRect(); if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) sequence(); });

    /* défilement : lu, jamais détourné. Il entraîne les couches et la fleur ; sa vitesse couche les feuilles et fait onduler le store */
    var yDer = W.scrollY;
    function finDefil() { sVent.vers(0); sOnd.vers(0); }
    ec(W, 'scroll', function () {
      var y = W.scrollY, t = performance.now();
      if (tDefil) { var v = borne((y - yDer) / Math.max(8, t - tDefil) / 1.4, -1, 1); sVent.vers(v); sOnd.vers(Math.min(1, Math.abs(v) * 1.2)); }
      yDer = y; tDefil = t; rB = null; rF = null;
      sSc.vers(Math.min(1.5, y / 400)); sFr.vers(y * .22);
      var k = fleur.getBoundingClientRect(); sFx.vers(0); sFy.vers(borne((W.innerHeight / 2 - (k.top + k.height / 2 - fy)) * .04, -14, 14));
      F.rev = 1; if (cible) viser(cible, true); reveil();
    }, { passive: true });

    /* ce qui est sous la ligne de flottaison se pose en entrant dans l'écran (position lue au défilement, pas un simple signal) */
    function la(el) { el.classList.add('q-la'); }
    function fin(el) { el.classList.remove('q-in', 'q-g', 'q-e', 'q-arme'); el.style.removeProperty('--d'); $$('.q-dz', el).forEach(function (z) { z.classList.remove('q-dz'); }); }
    function reveler() {
      if (!armes.length) return; var lim = W.scrollY + W.innerHeight * .94, lot = [];
      armes = armes.filter(function (el) { if (el._y < lim) { lot.push(el); return false; } return true; });
      var k = 0; lot.forEach(function (el) {
        var net = el._y < lim - 140, d = net ? 0 : Math.min(k++, 9) * 40; el.classList.remove('q-arme');   /* net : déjà bien dans l'écran après un saut de défilement, on pose sans rejouer l'entrée */
        if (el.hasAttribute('data-la')) to(function () { la(el); }, net ? 0 : 120);
        else if (net) fin(el);
        else { el.style.setProperty('--d', d + 'ms'); to(function () { fin(el); }, d + 1200); }
      });
    }
    (function () { var H = W.innerHeight, y = W.scrollY; $$('.q-in,[data-la]').forEach(function (el) { var r = el.getBoundingClientRect(); if ((r.width || r.height) && r.top > H - 4) { el.classList.add('q-arme'); el._y = r.top + y; armes.push(el); } }); })();

    R.classList.add('q-pret');
    function finEntree() {
      rB = null;
      if (essai) essaiT.push(setInterval(function () { sequence(+essai[1]); }, 2000)); else planSeq();
      if (essaiG) { var gn = decodeURIComponent(essaiG[1]), ge = $$('.q-nav a,.q-tuile').filter(function (a) { return a.getAttribute('data-outil') === gn; })[0]; if (ge) essaiT.push(setInterval(function () { joue(ge); }, 1300)); }
      var file = $$('.q-in:not(.q-arme)');   /* le ménage est réparti sur plusieurs images, pour ne pas en allonger une */
      (function lot() { for (var k = 0; k < 8 && file.length; k++) fin(file.pop()); if (file.length) dans(16, lot); else bandeau.classList.add('q-fini'); })();
    }
    /* les caches et les tambours partent dès que le compteur est posé, un texte par image : le texte redevient du texte */
    function finTextes() {
      var pas = 0; (function lot() {
        pas++;
        if (pas === 1) h1.innerHTML = orig.h1; else if (pas === 2) dateEl.textContent = dateTxt; else { para.innerHTML = orig.p; para.classList.remove('q-la'); phraseCourante = orig.p; textesFinis = true; return; }
        dans(16, lot);
      })();
    }
    /* le départ : l'état masqué vient d'être calculé (lectures ci-dessus), on lance tout de suite, sans attendre une image */
    void illu.offsetWidth; R.classList.add('q-go');
    $$('[data-la]').forEach(function (el) { if (!el.classList.contains('q-arme')) dans(+el.getAttribute('data-la'), function () { la(el); }); });
    dans(120, function () { var mm = (gNav.h + gNav.b) / 2, h = gNav.h, b = gNav.b; gNav.sh.pose(mm - 10); gNav.sb.pose(mm + 10); gNav.sh.vers(h); gNav.sb.vers(b); });
    dans(200, phrase);
    dans(300, function () { illu.classList.add('q-allume'); });
    dans(500, function () { sequence(1); });
    dans(700, poserTampon);
    dans(1450, finTextes);
    dans(1950, finEntree);
    /* boucles suspendues hors écran */
    var io = null;
    if ('IntersectionObserver' in W) { io = new IntersectionObserver(function (es) { es.forEach(function (en) { en.target.classList.toggle('q-hors', !en.isIntersecting); }); }); [illu, fleur].forEach(function (el) { if (el) io.observe(el); }); }

    inst.io = io;
    return wrapInst();

    /* ---------- l'instance : mise à jour des données, démontage ---------- */
    function majFn(m2) { m = m2; if (!majOutils()) return false; majInfos(); majRelances(); majPhrase(); return true; }
    function wrapInst() {
      inst.maj = majFn; inst.majInfos = majInfos; inst.majOutils = majOutils;
      inst.etat = function () { return { ecoutes: ecoutes.length, minuteurs: minuteurs.length, boucle: enRoute, ressorts: vivants.length, taches: taches.length, portails: D.querySelectorAll('.q-portail').length, mort: inst.mort }; };
      inst.detruire = function () {
        if (inst.mort) return; inst.mort = true;
        ecoutes.forEach(function (x) { x[0].removeEventListener(x[1], x[2], x[3]); });
        minuteurs.forEach(clearTimeout); clearTimeout(seqT); essaiT.forEach(clearInterval);
        if (rafId) cancelAnimationFrame(rafId);
        if (inst.io) inst.io.disconnect();
        vivants.length = 0; taches.length = 0; enRoute = false;
        if (P.on) { portail.classList.add('q-fond'); setTimeout(function () { portail.classList.add('q-evanouit'); }, 16); setTimeout(function () { if (portail.parentNode) portail.parentNode.removeChild(portail); }, 220); }
        else if (portail.parentNode) portail.parentNode.removeChild(portail);
      };
      return inst;
    }
  }

  // Le classement des ouvertures arrive après le premier dessin : l'accueil range les outils en place, sans rejouer l'entrée.
  function g4Rafraichir() {
    if (_qInst && V2.route && V2.route.name === 'home') _qInst.majOutils();
  }
  // Styles de l'accueil : tout sous .q-page (la page) et .q-portail (le voile et la carte d'ouverture, posés sur <body>).
  function qStyles() {
    if (document.getElementById('v2-q-style')) return;
    var st = document.createElement('style'); st.id = 'v2-q-style';
    st.textContent = Q_CSS;
    document.head.appendChild(st);
  }
  // Monte l'accueil, ou met ses données à jour en place s'il est déjà à l'écran.
  // V2.render() est rappelé quand les relances arrivent et quand les ventes finissent : l'entrée ne se rejoue pas.
  function qAccueil(root, m) {
    if (_qInst && _qInst.page.isConnected && root.contains(_qInst.page)) { if (_qInst.maj(m) !== false) return; }
    if (_qInst) { _qInst.detruire(); _qInst = null; }
    g4ChargerOrdre();
    qInfosCharger();
    qStyles();
    var calme = false;
    try { calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    root.innerHTML = qPageHtml(m, calme);
    var page = root.querySelector('.q-page');
    try { _qInst = qMonter(page, m); }
    catch (err) {
      // un défaut de mouvement ne doit jamais laisser la page masquée
      if (window.console) console.error('[accueil q1]', err);
      page.classList.remove('q-js'); page.classList.add('q-calme', 'q-pret');
    }
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
        { k: 'fiches', cls: 'p2', ico: 'fiche', tag: 'PDF', t: 'Fiches commerciales', d: 'Crée une fiche produit sur-mesure et sors-la en PDF à montrer ou envoyer au pharmacien pendant le rendez-vous.', go: 'Créer une fiche' },
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
      // Audit Marge (abandon de marge par pharmacie) — app JARVIS
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.audit) {
        P.push({ k: 'audit', cls: 'p4', accent: '#10915E', ico: 'pilo', tag: 'Par pharmacie', t: 'Audit marge', d: 'Ce qu\'Intégral rend à chaque pharmacie via l\'abandon de marge — par tranche, vs son grossiste actuel, calculé sur ses vrais achats. Un audit offert, prêt en PDF.', go: 'Ouvrir l\'audit' });
        P.push({ k: 'missions', cls: 'p4', accent: '#0E9E6A', ico: 'pilo', tag: 'Expert 360', t: 'Missions rémunérées', d: 'La rémunération de l\'officine au-delà du produit : vaccination, entretiens, BPM, TROD… les tarifs 2026 + un simulateur « combien elle peut gagner ». L\'argument d\'expert à montrer au pharmacien.', go: 'Ouvrir les missions' });
      }
      // « L'Argument » (1er rendez-vous prospect, curseurs + preuves) — app JARVIS.
      // Complément de l'Audit marge : l'Audit exige les achats d'une CLIENTE,
      // l'Argument se règle devant un PROSPECT sans aucune donnée.
      // ⚠️ Bloc à part, conditionné sur SA page (leçon de la tuile Appro).
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.argument) {
        P.push({ k: 'argument', cls: 'p4', accent: 'var(--c-opp)', ico: 'opp', tag: '1er RDV', t: 'L’Argument', d: 'Le premier rendez-vous, chiffré : trois curseurs réglés devant le prospect — ce que son grossiste lui verse vraiment, ce qu\'Intégral met dans sa poche, le gain net par an. Avec les preuves sourcées et les réponses aux objections.', go: 'Ouvrir l’argument' });
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
      // Mode prospection : pitch à montrer au comptoir
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.presentation) {
        P.push({ k: 'presentation', cls: 'p1', accent: 'var(--c-opp)', ico: 'pharma', tag: 'Prospect', t: 'Présentation Intégral Pharma', d: 'Le pitch à montrer au comptoir : qui est Intégral Pharma et comment travailler avec nous. Pour convaincre un prospect en 2 minutes.', go: 'Lancer la présentation' });
      }
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
        qAccueil(root, { nb: nbPharma, partiel: partiel, mes: mesOfficines, salut: salut, prenom: firstName });
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
    quitter: function () { if (_qInst) { _qInst.detruire(); _qInst = null; } }
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
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.audit) PAGES.push(['audit', 'Audit Marge (par pharmacie)', 'pilo']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.presentation) PAGES.push(['presentation', 'Présentation Intégral Pharma', 'pharma']);
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
      // Pastille recherche ⌘K : plus posée, kbd raffiné, hit-area terrain sous mobile.
      '.v2-top-search{transition:border-color .18s var(--ease-soft),box-shadow .2s var(--ease),transform .18s var(--ease-soft)}' +
      '.v2-top-search:hover{transform:translateY(-1px)}' +
      '.v2-top-search kbd{border:1px solid var(--line);box-shadow:0 1px 0 rgba(16,19,28,.04)}' +
      '@media(max-width:640px){.v2-top-search{min-width:var(--tap-min);min-height:var(--tap-min);' +
        'justify-content:center}}' +
      // Avatar : anneau discret pour un contour net sur fond clair.
      '.v2-av{box-shadow:0 0 0 1px color-mix(in srgb,var(--info) 14%,transparent),0 2px 6px rgba(16,19,28,.12)}' +
      '.v2-idea{flex:none;width:38px;height:38px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:color .16s,border-color .16s,background .16s,transform .16s}' +
      '.v2-idea:hover{color:var(--ip-blue);border-color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 8%,var(--card));transform:translateY(-1px)}' +
      // Bascule Intégral ↔ Escale (15/09/2026) : pastille discrète, juste après le logo.
      '.v2-spacesw{flex:none;display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 12px;' +
        'border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--ip-ink-2);' +
        'font-family:var(--font);font-size:12.5px;font-weight:600;cursor:pointer;' +
        'transition:color .16s,border-color .16s,background .16s,transform .16s}' +
      '.v2-spacesw:hover{color:var(--ip-blue);border-color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 8%,var(--card));transform:translateY(-1px)}' +
      '@media(max-width:640px){.v2-spacesw{padding:0 9px;font-size:0}.v2-spacesw span{font-size:15px}}' +

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
