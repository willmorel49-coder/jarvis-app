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

  V2._navStack = V2._navStack || ['home'];
  V2.go = function (name, param) {
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
    // ligne ~1326) — un compte @escalepharma.fr. Les commerciaux Escale ne l'ont
    // jamais : ils sont renvoyés vers escale/v2 avant même de voir cette page.
    // Vers Intégral (depuis Escale) : email @escalepharma.fr NE SUFFIT PAS — tous
    // les commerciaux Escale l'ont aussi. Il faut en plus `voitTousReel` (posé dans
    // v2-boot.js AVANT la bascule locale de commercial/voitTous propre à l'espace
    // Escale) : seul le compte à accès total l'a à true, pas le compte générique (commercial='Escale').
    var spaceSw = '';
    var mail = (V2.user && V2.user.email) || '';
    if (/@escalepharma\.fr$/i.test(mail)) {
      var inEscale = !!(window.V2_BRAND && window.V2_BRAND.escale);
      if (!inEscale || (V2.user && V2.user.voitTousReel === true)) {
        var swTo = inEscale ? 'crm' : 'escale';
        var swLabel = inEscale ? 'Intégral' : 'Escale';
        spaceSw = '<button class="v2-spacesw" title="Basculer vers l\'espace ' + swLabel + '" aria-label="Basculer vers l\'espace ' + swLabel + '" onclick="V2.goSpace(\'' + swTo + '\')">' +
          '<span aria-hidden="true">⇄</span>' + swLabel + '</button>';
      }
    }
    return '' +
      '<div class="v2-top">' +
        back + brand + spaceSw +
        ((V2.route && V2.route.name === 'home') ? '' : '<div class="v2-top-search" onclick="V2.onTopSearch()">' + ICO('search', 15, 2) + 'Rechercher<kbd>' + MOD + 'K</kbd></div>') +
        ((!(window.V2_BRAND && (window.V2_BRAND.opso || window.V2_BRAND.escale)) && V2.remonteeOpen) ? '<button class="v2-idea" title="Proposer une amélioration à l\'équipe" aria-label="Proposer une amélioration" onclick="V2.remonteeOpen()">' + ICO('spark', 16, 2) + '</button>' : '') +
        '<div class="v2-av" title="' + (V2.user ? V2.user.name : '') + '" onclick="V2.userMenu()">' + initials + '</div>' +
      '</div>';
  }
  V2.topbar = topbar;

  // Bascule Intégral ↔ Escale (bouton de la topbar, 15/09/2026). Le choix est
  // gardé (localStorage, en échec silencieux) pour un usage futur ; la navigation
  // elle-même se fait par l'URL, qui suffit à rester dans l'espace choisi après
  // un rechargement — pas de session cassée, `V2.user` est rechargé par l'autre app.
  V2.goSpace = function (dest) {
    try { localStorage.setItem('v2-space', dest); } catch (e) {}
    location.href = dest === 'escale' ? '../../escale/v2/index.html' : '../../crm/v2/index.html';
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
    produits: 'var(--ip-blue)'
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
  V2.NEEDS_DEFAUT = ['bench', 'sagitta', 'prodstatscond', 'pharmafrca', 'wmlca', 'biosimcomplet'];
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
      '.pres-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;text-transform:uppercase;letter-spacing:.16em;font-weight:800;color:rgba(255,255,255,.88);background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:var(--r-pill);padding:6px 13px;margin-bottom:14px}',
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
      '.pres-kpi-l{font-size:11.5px;opacity:.88;font-weight:600;margin-top:4px;line-height:1.35}',
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
      '.pres-tier-r{display:inline-block;font-family:var(--mono);font-size:11.5px;font-weight:700;color:var(--ip-blue);background:var(--halo);border-radius:6px;padding:3px 8px}',
      '.pres-tier-v{font-family:var(--mono);font-size:19px;font-weight:700;margin-top:9px;letter-spacing:-.02em}',
      '.pres-tier-l{font-size:12px;color:var(--muted);margin-top:3px}',
      '.pres-cta-line{display:inline-flex;align-items:center;gap:6px;margin-top:16px;font-size:14px;font-weight:700;color:var(--ip-blue);text-decoration:none;cursor:pointer}',
      '.pres-cta-line:hover{text-decoration:underline}',
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
      '.pres-send-badge{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:var(--r-pill);padding:3px 9px;margin-bottom:10px}',
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
        '.pres-sim-in{width:100%}.pres-sim-inwrap{display:flex}' +
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

          '<div style="text-align:center;font-size:11px;color:var(--muted);margin-top:18px">Document commercial Intégral Pharma — sous réserve des conditions générales.</div>' +
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
      '.v2-home-x .v2-recent{justify-content:center}',
      // ── « Les objets bien rangés » (24/09/2026, maquette v5, « go » de Will) ──
      // Objets en volume (SVG inline, lumière en haut à gauche, un seul bleu
      // décliné), rangés : « Tous les jours » en grand, les rayons en lignes
      // (objet + nom + phrase + chevron), « En cours de développement » en bas.
      // Mouvement : transform et opacity seulement, rien ne boucle.
      '.v2-home-x .hv-titre{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--ip-ink-3,#5B6273);margin:22px 4px 10px}',
      '.v2-home-x .hv-titre::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(16,19,28,.12),rgba(16,19,28,0))}',
      '.v2-home-x .hv-obj{display:block;flex:none;overflow:visible}',
      '.v2-home-x .hv-obj g,.v2-home-x .hv-obj rect,.v2-home-x .hv-obj path,.v2-home-x .hv-obj circle,.v2-home-x .hv-obj ellipse,.v2-home-x .hv-obj line{transform-box:fill-box;transform-origin:50% 50%}',
      '.v2-home-x .hv-obj .o-corps{transform-origin:50% 100%}',
      '.v2-home-x .hv-obj .o-leve{transition:transform 420ms cubic-bezier(.3,.7,.4,1.2)}',
      '.v2-home-x .hv-obj .o-sol{transition:transform 420ms cubic-bezier(.3,.7,.4,1.2),opacity 420ms cubic-bezier(.2,.8,.2,1)}',
      '.v2-home-x .hv-porte:hover .o-leve,.v2-home-x .hv-porte.joue .o-leve{transform:translateY(-5px)}',
      '.v2-home-x .hv-porte:hover .o-sol,.v2-home-x .hv-porte.joue .o-sol{transform:scale(.8);opacity:.6}',
      '.v2-home-x .hv-porte{position:relative;display:flex;cursor:pointer;color:var(--ip-ink);text-decoration:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}',
      '.v2-home-x .hv-porte:focus-visible{outline:3px solid var(--ip-blue,#0050E6);outline-offset:3px}',
      '.v2-home-x .hv-txt{display:block;min-width:0}',
      '.v2-home-x .hv-nom{display:block;font-weight:800;letter-spacing:-.01em;line-height:1.2}',
      '.v2-home-x .hv-phrase{display:block;font-size:13px;color:var(--ip-ink-3,#5B6273);line-height:1.35;margin-top:3px}',
      '.v2-home-x .hv-fleche{flex:none;display:flex;align-self:center;margin-left:auto;color:var(--ip-ink-3,#5B6273);transition:transform 300ms cubic-bezier(.3,.7,.4,1.2)}',
      '.v2-home-x .hv-porte:hover .hv-fleche,.v2-home-x .hv-porte.joue .hv-fleche{transform:translateX(3px);color:var(--ip-blue,#0050E6)}',
      // Tous les jours : To do list pleine largeur, puis la grille 2×2.
      '.v2-home-x .hv-todo,.v2-home-x .hv-grand{overflow:hidden;background:radial-gradient(180px 130px at 22% 18%,var(--card,#fff) 0%,color-mix(in srgb,var(--ip-blue,#0050E6) 5%,var(--card,#fff)) 100%);border:1px solid var(--line);border-radius:22px;box-shadow:0 1px 2px rgba(16,19,28,.05),0 4px 10px rgba(16,19,28,.05),0 12px 24px rgba(16,19,28,.05);min-height:44px;transition:transform 300ms cubic-bezier(.3,.7,.4,1.2)}',
      '.v2-home-x .hv-todo::before,.v2-home-x .hv-grand::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.9) 0%,rgba(255,255,255,0) 38%)}',
      '.v2-home-x .hv-todo>*,.v2-home-x .hv-grand>*{position:relative}',
      '.v2-home-x .hv-todo:hover,.v2-home-x .hv-grand:hover{box-shadow:0 3px 6px rgba(0,52,160,.08),0 10px 22px rgba(0,52,160,.08),0 20px 36px rgba(0,52,160,.08);transform:translateY(-2px)}',
      '.v2-home-x .hv-todo:active,.v2-home-x .hv-grand:active,.v2-home-x .hv-ligne:active{transform:scale(.98)}',
      '.v2-home-x .hv-todo{align-items:center;gap:14px;padding:10px 18px 10px 10px;margin-bottom:10px}',
      '.v2-home-x .hv-todo .hv-obj{width:78px;height:78px}',
      '.v2-home-x .hv-todo .hv-nom{font-size:18px}',
      '.v2-home-x .hv-grille{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px}',
      '.v2-home-x .hv-grand{flex-direction:column;align-items:flex-start;padding:8px 14px 16px}',
      '.v2-home-x .hv-grand .hv-obj{width:88px;height:88px;margin:0 0 4px -6px}',
      '.v2-home-x .hv-grand .hv-nom{font-size:17px}',
      // Les rayons
      '.v2-home-x .hv-rayons{display:grid;gap:12px}',
      '.v2-home-x .hv-rayon{position:relative;overflow:hidden;background:var(--card,#fff);border:1px solid var(--line);border-radius:22px;box-shadow:0 1px 2px rgba(16,19,28,.05),0 4px 10px rgba(16,19,28,.05),0 12px 24px rgba(16,19,28,.05);padding:12px}',
      '.v2-home-x .hv-rayon::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.7) 0%,rgba(255,255,255,0) 34%)}',
      '.v2-home-x .hv-rayon>*{position:relative}',
      '.v2-home-x .hv-rayon-tete{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:2px 6px 8px;flex-wrap:wrap}',
      '.v2-home-x .hv-rayon-nom{margin:0;font-size:16px;font-weight:800;line-height:1.3;letter-spacing:-.01em;color:var(--ip-blue,#0050E6)}',
      '.v2-home-x .hv-rayon-rappel{font-size:13px;color:var(--ip-ink-3,#5B6273)}',
      '.v2-home-x .hv-lignes{display:grid;gap:8px}',
      '.v2-home-x .hv-ligne{align-items:center;gap:10px;background:color-mix(in srgb,var(--ip-blue,#0050E6) 5%,var(--card,#fff));border-radius:16px;padding:5px 14px 5px 5px;min-height:72px;transition:transform 250ms cubic-bezier(.3,.7,.4,1.2)}',
      '.v2-home-x .hv-ligne:hover{background:color-mix(in srgb,var(--ip-blue,#0050E6) 12%,var(--card,#fff))}',
      '.v2-home-x .hv-ligne .hv-obj{width:58px;height:58px}',
      '.v2-home-x .hv-ligne .hv-nom{font-size:15px}',
      '.v2-home-x .hv-ligne .hv-txt{flex:1}',
      '@media(min-width:640px){.v2-home-x .hv-lignes{grid-template-columns:1fr 1fr}}',
      '@media(min-width:860px){.v2-home-x .hv-rayons{grid-template-columns:1fr 1fr;align-items:start;gap:14px}.v2-home-x .hv-lignes{grid-template-columns:1fr}}',
      // « En cours de développement » : en retrait (filet pointillé, gris), même pastille pour tous.
      '.v2-home-x .v2-enc-chip{display:inline-flex;align-items:center;font-size:13px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;color:var(--ip-ink-3,#5B6273);background:color-mix(in srgb,var(--ip-blue,#0050E6) 6%,var(--card,#fff));border-radius:999px;padding:6px 13px;margin:26px 0 12px 4px}',
      '.v2-home-x .v2-enc{position:relative;background:var(--card,#fff);border:1.5px dashed rgba(16,19,28,.16);border-radius:20px;padding:16px 18px;margin-bottom:16px}',
      '.v2-home-x .v2-enc-liens{display:flex;flex-wrap:wrap;gap:10px}',
      '.v2-home-x .v2-enc-l{min-height:46px;display:inline-flex;align-items:center;gap:8px;background:color-mix(in srgb,var(--ip-blue,#0050E6) 6%,var(--card,#fff));border-radius:12px;padding:10px 14px;font-size:14px;font-weight:700;color:var(--ip-ink-3,#5B6273);text-decoration:none;cursor:pointer;transition:transform .25s cubic-bezier(.3,.7,.4,1.2)}',
      '.v2-home-x .v2-enc-l:hover{background:color-mix(in srgb,var(--ip-blue,#0050E6) 12%,var(--card,#fff));transform:translateY(-3px)}',
      '.v2-home-x .v2-enc-l:focus-visible{outline:3px solid var(--ip-blue,#0050E6);outline-offset:3px}',
      '.v2-home-x .v2-enc-l svg{color:inherit;flex:none}.v2-home-x .v2-enc-l .fl{font-weight:800}',
      // 13 px : cette ligne dit COMMENT obtenir l'accès, une information utile ne se met pas en petit.
      '.v2-home-x .v2-enc-n{margin:12px 0 0;font-size:13px;line-height:1.5;color:var(--ip-ink-3,#6B7280)}',
      // Arrivée : masquage posé par le script (classe js-anim, UNE fois par session),
      // chaque bloc se révèle en entrant à l'écran ; l'objet se pose, son ombre se resserre.
      '.v2-home-x.js-anim .hv-anim:not(.vu){opacity:0;transform:translateY(14px) scale(.97)}',
      '.v2-home-x.js-anim .hv-anim.vu:not(.fin){animation:hvArriver 560ms cubic-bezier(.3,.7,.4,1.2) both;animation-delay:calc(var(--i,0) * 55ms)}',
      '@keyframes hvArriver{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}',
      '.v2-home-x.js-anim .hv-anim:not(.vu) .o-corps{opacity:0}',
      '.v2-home-x.js-anim .hv-anim.vu .o-corps{animation:hvPoser 820ms cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--d,0) * 70ms + 180ms)}',
      '.v2-home-x.js-anim .hv-anim.vu .o-ombre{animation:hvOmbre 820ms cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--d,0) * 70ms + 180ms)}',
      '@keyframes hvPoser{0%{opacity:0;transform:translateY(-18px)}42%{opacity:1;transform:translateY(0) scale(1.04,.94)}62%{transform:translateY(-5px) scale(.99,1.02)}82%{transform:translateY(0) scale(1.01,.99)}100%{opacity:1;transform:none}}',
      '@keyframes hvOmbre{0%{opacity:.2;transform:scale(1.5,1.3)}42%{opacity:1;transform:scale(.92,1)}100%{opacity:1;transform:none}}',
      // Au survol ou à l'appui, le détail propre à chaque objet bouge, une fois par geste.
      '.v2-home-x .hv-porte:hover .d-pop,.v2-home-x .hv-porte.joue .d-pop{animation:hvPop 560ms cubic-bezier(.3,.7,.4,1.2) both;animation-delay:calc(var(--r,0) * 90ms)}',
      '.v2-home-x .hv-porte:hover .d-pulse,.v2-home-x .hv-porte.joue .d-pulse{animation:hvPulse 620ms cubic-bezier(.3,.7,.4,1.2)}',
      '.v2-home-x .hv-porte:hover .d-saut,.v2-home-x .hv-porte.joue .d-saut{animation:hvSaut 760ms cubic-bezier(.2,.8,.2,1)}',
      '.v2-home-x .hv-porte:hover .d-leve,.v2-home-x .hv-porte.joue .d-leve{animation:hvLeve 700ms cubic-bezier(.3,.7,.4,1.2)}',
      '.v2-home-x .hv-porte:hover .d-monte,.v2-home-x .hv-porte.joue .d-monte{animation:hvMonte 620ms cubic-bezier(.3,.7,.4,1.2) both;animation-delay:calc(var(--r,0) * 90ms)}',
      '.v2-home-x .hv-porte:hover .d-fleche,.v2-home-x .hv-porte.joue .d-fleche{animation:hvFleche 620ms cubic-bezier(.3,.7,.4,1.2) 200ms both}',
      '.v2-home-x .hv-porte:hover .d-orbite,.v2-home-x .hv-porte.joue .d-orbite{animation:hvOrbite 900ms cubic-bezier(.3,.7,.4,1.2)}',
      '.v2-home-x .hv-porte:hover .d-balance,.v2-home-x .hv-porte.joue .d-balance{animation:hvBalance 820ms ease-out}',
      '.v2-home-x .hv-porte:hover .d-balance2,.v2-home-x .hv-porte.joue .d-balance2{animation:hvBalance2 820ms ease-out 80ms}',
      '.v2-home-x .hv-porte:hover .d-presse,.v2-home-x .hv-porte.joue .d-presse{animation:hvPresse 420ms ease-in-out}',
      '.v2-home-x .hv-porte:hover .d-jauge,.v2-home-x .hv-porte.joue .d-jauge{animation:hvJauge 760ms cubic-bezier(.3,.7,.4,1.2) both}',
      '.v2-home-x .hv-porte:hover .d-soleil,.v2-home-x .hv-porte.joue .d-soleil{animation:hvSoleil 820ms cubic-bezier(.2,.8,.2,1) both}',
      '.v2-home-x .hv-porte:hover .d-tourne,.v2-home-x .hv-porte.joue .d-tourne{animation:hvTourne 1100ms ease-in-out}',
      '.v2-home-x .hv-porte:hover .d-note,.v2-home-x .hv-porte.joue .d-note{animation:hvNote 700ms cubic-bezier(.3,.7,.4,1.2)}',
      '.v2-home-x .hv-porte:hover .d-ondes,.v2-home-x .hv-porte.joue .d-ondes{animation:hvOndes 560ms cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--r,0) * 110ms)}',
      '.v2-home-x .hv-obj .d-monte{transform-origin:50% 100%}',
      '.v2-home-x .hv-obj .d-jauge{transform-origin:0% 50%}',
      '.v2-home-x .hv-obj .d-balance,.v2-home-x .hv-obj .d-balance2{transform-origin:50% 100%}',
      '.v2-home-x .hv-obj .d-orbite{transform-box:view-box;transform-origin:48px 46px}',
      '.v2-home-x .hv-obj .d-tourne{transform-box:view-box;transform-origin:48px 42px}',
      '@keyframes hvPop{0%{transform:scale(0)}60%{transform:scale(1.22)}100%{transform:scale(1)}}',
      '@keyframes hvPulse{0%{transform:scale(1)}35%{transform:scale(.86)}70%{transform:scale(1.14)}100%{transform:scale(1)}}',
      '@keyframes hvSaut{0%{transform:translateY(0)}28%{transform:translateY(-12px)}52%{transform:translateY(0) scale(1.06,.92)}70%{transform:translateY(-4px)}86%{transform:translateY(0)}100%{transform:none}}',
      '@keyframes hvLeve{0%{transform:none}40%{transform:translate(1px,-8px) rotate(-4deg)}100%{transform:none}}',
      '@keyframes hvMonte{0%{transform:scaleY(.2)}70%{transform:scaleY(1.08)}100%{transform:none}}',
      '@keyframes hvFleche{0%{opacity:0;transform:translate(-6px,6px)}100%{opacity:1;transform:none}}',
      '@keyframes hvOrbite{0%{transform:none}45%{transform:rotate(14deg)}100%{transform:none}}',
      '@keyframes hvBalance{0%{transform:none}25%{transform:rotate(-9deg)}55%{transform:rotate(5deg)}80%{transform:rotate(-2deg)}100%{transform:none}}',
      '@keyframes hvBalance2{0%{transform:none}25%{transform:rotate(9deg)}55%{transform:rotate(-5deg)}80%{transform:rotate(2deg)}100%{transform:none}}',
      '@keyframes hvPresse{0%{transform:none}45%{transform:translateY(4px)}100%{transform:none}}',
      '@keyframes hvJauge{0%{transform:scaleX(.15)}75%{transform:scaleX(1.06)}100%{transform:none}}',
      '@keyframes hvSoleil{0%{opacity:.3;transform:translateY(16px)}100%{opacity:1;transform:none}}',
      '@keyframes hvTourne{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}',
      '@keyframes hvNote{0%{transform:none}35%{transform:translateY(-6px) rotate(-10deg) scale(1.08)}70%{transform:rotate(3deg)}100%{transform:none}}',
      '@keyframes hvOndes{0%{opacity:0;transform:translateX(-7px) scale(.6)}100%{opacity:1;transform:none}}',
      '@media(prefers-reduced-motion:reduce){.v2-home-x .hv-anim,.v2-home-x .hv-obj .o-corps,.v2-home-x .hv-obj .o-ombre{opacity:1!important;transform:none!important;animation:none!important}.v2-home-x .hv-obj *{animation:none!important;transition:none!important}.v2-home-x .hv-porte,.v2-home-x .hv-fleche,.v2-home-x .v2-enc-l{transition:none!important;animation:none!important}.v2-home-x .hv-porte:hover,.v2-home-x .hv-porte:hover .hv-fleche,.v2-home-x .v2-enc-l:hover{transform:none!important}}'
    ].join('');
    document.head.appendChild(st);
  }
  // Relances dues (demande Manon, 10/09/2026) : date saisie fiche par fiche
  // (« Prochaine relance », V2.profil scope 'client') — carte sur l'accueil
  // listant les officines en retard / à relancer aujourd'hui / bientôt.
  // Chargée une fois (cache module), l'accueil se réaffiche dès qu'elle arrive.
  var _relances = null;
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
        out.push({ pid: o.sid, name: ph.name || '', diff: diff });
      });
      out.sort(function (a, b) { return a.diff - b.diff; });
      _relances = out;
      if (V2.render) V2.render();
    }).catch(function () { _relances = []; });
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
  // Accueil v5 (24/09/2026) : chaque bloc .hv-anim se révèle en entrant à
  // l'écran, une seule fois. Filets : ce qui est déjà à l'écran est révélé tout
  // de suite, et au bout de 8 s plus rien ne reste masqué.
  function hvReveler(root) {
    var blocs = [].slice.call(root.querySelectorAll('.hv-anim'));
    if (!blocs.length) return;
    function montrer(el) { el.classList.add('vu'); }
    function aLEcran(el) { var r = el.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }
    function verifier() { blocs.forEach(function (el) { if (!el.classList.contains('vu') && aLEcran(el)) montrer(el); }); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (en) { if (en.isIntersecting) { montrer(en.target); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
      blocs.forEach(function (el) { io.observe(el); });
    }
    verifier();
    setTimeout(verifier, 1200);
    setTimeout(function () { blocs.forEach(montrer); }, 8000);
    var enAttente = false;
    window.addEventListener('scroll', function () {
      if (enAttente) return; enAttente = true;
      requestAnimationFrame(function () { enAttente = false; verifier(); });
    }, { passive: true, capture: true });
  }
  // Une fois l'arrivée jouée, le bloc rend la main (le survol peut le soulever) ;
  // à l'appui sur téléphone, le détail de l'objet joue une fois (classe joue).
  document.addEventListener('animationend', function (e) {
    var t = e.target;
    if (e.animationName === 'hvArriver' && t.classList && t.classList.contains('hv-anim')) t.classList.add('fin');
  });
  document.addEventListener('pointerdown', function (e) {
    var p = e.target && e.target.closest ? e.target.closest('.v2-home-x .hv-porte') : null;
    if (!p) return;
    p.classList.remove('joue'); void p.offsetWidth; p.classList.add('joue');
    clearTimeout(p._hvT); p._hvT = setTimeout(function () { p.classList.remove('joue'); }, 1200);
  });
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
  var _caByPid = null, _caRef = null;
  V2.caByPharma = function () {
    if (_caByPid && _caRef === V2.sales) return _caByPid;
    var m = {}, S = V2.sales || [];
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
      var isBrandApart = !!(window.V2_BRAND && (window.V2_BRAND.opso || window.V2_BRAND.escale));
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
        P.splice(2, 0, { k: 'marketing', cls: 'p2', ico: 'fiche', tag: 'A4', t: 'Fiches marketing OPSO', d: 'Crée une sélection de produits négociée par Intégral Pharma, en charte Normandie Pharma, prête à imprimer pour tes adhérents.', go: 'Créer une sélection' });
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
          pil.tag = V2.fmtK(caTotal) + ' €';
          P.unshift(pil);
        }
      }
      // 11/09/2026 — espace ESCALE PHARMA (escale/v2) : un visu pour Alexandre et ses
      // quatre commerciaux. Deux entrées, le suivi en tête ; le reste n'est pas chargé.
      if (window.V2_BRAND && window.V2_BRAND.escale) {
        var pmE = {}; P.forEach(function (x) { pmE[x.k] = x; });
        if (pmE.pharma) { pmE.pharma.d = 'Les officines clientes d\'Escale Pharma : coordonnées, groupement, chiffre d\'affaires, et ce qu\'elles commandent ou pas encore.'; pmE.pharma.go = 'Voir les officines'; }
        if (pmE.pilotage) { pmE.pilotage.t = 'Suivi Escale'; pmE.pilotage.d = 'Le chiffre d\'affaires d\'Escale Pharma par commercial, par mois et par groupement, avec la marge et les familles produits.'; pmE.pilotage.go = 'Voir le suivi'; }
        P = [pmE.pilotage, pmE.pharma].filter(Boolean);
      }
      function tile(p) {
        var nav = p.route ? ('V2.go(\'' + p.route.name + '\'' + (p.route.param ? ',\'' + p.route.param + '\'' : '') + ')') : ('V2.go(\'' + p.k + '\')');
        return '<a class="v2-pil ' + p.cls + '"' + (p.accent ? ' style="--accent:' + p.accent + '"' : '') + ' onmousemove="V2.homeSpot(event,this)" onclick="' + nav + '">' +
          '<div class="v2-pil-head"><div class="v2-pil-ico">' + ICO(p.ico, 26) + '</div><span class="v2-pil-num">' + p.tag + '</span></div>' +
          '<div class="v2-pil-t">' + p.t + '</div><div class="v2-pil-d">' + p.d + '</div>' +
          '<div class="v2-pil-go">' + p.go + ' <span class="arrow">→</span></div></a>';
      }
      // Une tuile dont l'écran n'est pas chargé (app OPSO allégée, module
      // optionnel absent) ne s'affiche pas : un clic vers rien n'existe pas.
      P = P.filter(function (p) { return p.route ? !!V2.pages[p.route.name] : !!V2.pages[p.k]; });
      // Accueil regroupé "par moment d'usage" (hors OPSO qui garde son ordre suivi-groupement)
      var pilHtml;
      if (window.V2_BRAND && (window.V2_BRAND.opso || window.V2_BRAND.escale)) {
        pilHtml = '<div class="v2-piliers">' + P.map(tile).join('') + '</div>';
      } else {
        var pmap = {}; P.forEach(function (p) { pmap[p.k] = p; });
        // Libellés courts pour l'accueil ; les pages restent atteignables via ⌘K.
        if (pmap.molecules) { pmap.molecules.t = 'Catalogue & prix'; }
        if (pmap.presentation) { pmap.presentation.t = 'Présentation'; }
        // 03/09/2026 — la tuile s'appelle OFFILOG, pas « Concurrents » : c'est la
        // centrale parapharmacie du groupe, la veille concurrente n'en est qu'un
        // usage. Demande de Will, mot pour mot : « ça devient une feature Offilog
        // identifiée avec le logo ».
        if (pmap.offilog) { pmap.offilog.t = 'Offilog'; }

        // ── « Les objets bien rangés » (24/09/2026, maquette v5, « go » de Will) ──
        // Will : « le 1 mais bien rangé comme le 4 ». Le quotidien en grand
        // (To do list, puis Officines · La carte · Catalogue produits · Pilotage),
        // les rayons en lignes objet + nom + phrase + chevron, et tout en bas
        // « En cours de développement ». Une porte = une page, plus de dépli.
        // Missions rémunérées n'est plus sur l'accueil (sa page reste, ⌘K aussi).
        // Une porte dont l'écran n'est pas chargé ne s'affiche pas.
        // Objets en volume de la maquette v5 (24/09/2026), repris tels quels ; dégradés préfixés hv.
        var HV_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><linearGradient id="hvB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FA6FF"/><stop offset=".5" stop-color="#0050E6"/><stop offset="1" stop-color="#0034A0"/></linearGradient><linearGradient id="hvBm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CFDEFF"/><stop offset=".55" stop-color="#6C9BFF"/><stop offset="1" stop-color="#2F6BEF"/></linearGradient><linearGradient id="hvF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0050E6"/><stop offset="1" stop-color="#002C8A"/></linearGradient><linearGradient id="hvP" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#F3F7FF"/><stop offset="1" stop-color="#D6E2F8"/></linearGradient><linearGradient id="hvC" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#E1EBFF"/><stop offset="1" stop-color="#BFD3FF"/></linearGradient><radialGradient id="hvS" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#DCE7FF"/><stop offset=".45" stop-color="#4C82F5"/><stop offset="1" stop-color="#0034A0"/></radialGradient><radialGradient id="hvO" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0034A0" stop-opacity=".36"/><stop offset=".55" stop-color="#0034A0" stop-opacity=".12"/><stop offset="1" stop-color="#0034A0" stop-opacity="0"/></radialGradient></defs></svg>';
        var HV_OBJ = {
          todo: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="87" rx="29" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><rect x="20" y="17" width="56" height="67" rx="13" fill="url(#hvB)"/><rect x="25" y="24" width="46" height="54" rx="8" fill="url(#hvP)"/><rect x="36" y="11" width="24" height="12" rx="6" fill="url(#hvBm)"/><ellipse cx="43" cy="14" rx="5" ry="1.5" fill="#fff" opacity=".7"/><rect x="31" y="33" width="13" height="13" rx="4" fill="#E1EBFF"/><g class="d-pop"><rect x="31" y="33" width="13" height="13" rx="4" fill="url(#hvB)"/><path d="M34.2 39.8l2.6 2.6 4.6-5.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g><rect x="48" y="37" width="18" height="5" rx="2.5" fill="#BFD3FF"/><rect x="31" y="54" width="13" height="13" rx="4" fill="#E1EBFF"/><rect x="48" y="58" width="13" height="5" rx="2.5" fill="#D6E2F8"/><path d="M23.5 27 q1-6 8-7.5" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round" fill="none"/></g></g></svg>',
          officines: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="86" rx="32" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><rect x="14" y="27" width="68" height="54" rx="12" fill="#BFD3FF"/><rect x="14" y="22" width="68" height="54" rx="12" fill="url(#hvP)"/><g class="d-pulse"><rect x="22" y="31" width="27" height="27" rx="8" fill="url(#hvB)"/><path d="M33 36h5v6h6v5h-6v6h-5v-6h-6v-5h6z" fill="#fff"/></g><rect x="55" y="34" width="19" height="5" rx="2.5" fill="#BFD3FF"/><rect x="55" y="44" width="13" height="5" rx="2.5" fill="#D6E2F8"/><rect x="22" y="64" width="52" height="5" rx="2.5" fill="#E1EBFF"/><path d="M21 27h24" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g></g></svg>',
          carte: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="87" rx="36" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><path d="M12 32 L34 25 L34 76 L12 83Z" fill="url(#hvC)"/><path d="M34 25 L60 32 L60 83 L34 76Z" fill="#BFD3FF"/><path d="M60 32 L84 25 L84 76 L60 83Z" fill="url(#hvC)"/><path d="M18 72 C26 64 32 72 40 64 S54 54 60 58 S72 52 78 44" fill="none" stroke="#0050E6" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="0.1 5.5"/><ellipse cx="47" cy="58" rx="5" ry="1.8" fill="#0034A0" opacity=".3"/><g class="d-saut"><path d="M47 57 C41 49 37 44 37 38 A10 10 0 1 1 57 38 C57 44 53 49 47 57Z" fill="url(#hvB)"/><circle cx="47" cy="38" r="4" fill="#fff"/><ellipse cx="42.5" cy="32.5" rx="3" ry="2" fill="#fff" opacity=".55"/></g><path d="M15 36 L31 31" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".85"/></g></g></svg>',
          catalogue: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="46" cy="86" rx="32" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><path d="M16 54 L26 44 L72 44 L62 54Z" fill="#9BC0FF"/><path d="M62 54 L72 44 L72 72 L62 82Z" fill="url(#hvF)"/><rect x="16" y="54" width="46" height="28" rx="3" fill="url(#hvB)"/><rect x="35" y="54" width="8" height="28" fill="#fff" opacity=".26"/><path d="M35 54 L45 44 L53 44 L43 54Z" fill="#fff" opacity=".35"/><path d="M19.5 58 v12" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".5"/><g class="d-leve"><path d="M24 34 L31 27 L61 27 L54 34Z" fill="#E1EBFF"/><path d="M54 34 L61 27 L61 45 L54 52Z" fill="#4C82F5"/><rect x="24" y="34" width="30" height="18" rx="2.5" fill="url(#hvBm)"/><path d="M37 38.5h4v3.5h3.5v4h-3.5v3.5h-4v-3.5h-3.5v-4h3.5z" fill="#fff"/></g></g></g></svg>',
          pilotage: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="87" rx="36" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><rect x="12" y="24" width="72" height="58" rx="14" fill="#BFD3FF"/><rect x="12" y="19" width="72" height="58" rx="14" fill="url(#hvP)"/><rect x="22" y="66" width="52" height="3" rx="1.5" fill="#E1EBFF"/><rect class="d-monte" style="--r:0" x="26" y="52" width="11" height="14" rx="3" fill="url(#hvBm)"/><rect class="d-monte" style="--r:1" x="42.5" y="43" width="11" height="23" rx="3" fill="url(#hvBm)"/><rect class="d-monte" style="--r:2" x="59" y="32" width="11" height="34" rx="3" fill="url(#hvB)"/><g class="d-fleche"><path d="M24 44 L39 34 L50 38 L67 23" fill="none" stroke="#0034A0" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M61 20.5 L71 19 L69.5 29Z" fill="#0034A0" stroke="#0034A0" stroke-width="1.5" stroke-linejoin="round"/></g><path d="M19 24h22" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g></g></svg>',
          groupements: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="85" rx="30" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><g class="d-orbite"><g stroke="#BFD3FF" stroke-width="3.5" stroke-linecap="round"><line x1="48" y1="46" x2="21" y2="27"/><line x1="48" y1="46" x2="76" y2="26"/><line x1="48" y1="46" x2="19" y2="66"/><line x1="48" y1="46" x2="77" y2="64"/><line x1="21" y1="27" x2="76" y2="26"/></g><circle cx="21" cy="27" r="8" fill="url(#hvS)"/><circle cx="76" cy="26" r="8" fill="url(#hvS)"/><circle cx="19" cy="66" r="8" fill="url(#hvS)"/><circle cx="77" cy="64" r="8" fill="url(#hvS)"/></g><g class="d-pulse"><circle cx="48" cy="46" r="14" fill="url(#hvS)"/><ellipse cx="43" cy="40" rx="4.5" ry="2.8" fill="#fff" opacity=".6"/></g></g></g></svg>',
          carteGrp: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="87" rx="36" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><path d="M12 32 L34 25 L34 76 L12 83Z" fill="url(#hvC)"/><path d="M34 25 L60 32 L60 83 L34 76Z" fill="#BFD3FF"/><path d="M60 32 L84 25 L84 76 L60 83Z" fill="url(#hvC)"/><g stroke="#0050E6" stroke-width="2.6" stroke-linecap="round" opacity=".5"><line x1="25" y1="48" x2="47" y2="62"/><line x1="47" y1="62" x2="71" y2="42"/><line x1="25" y1="48" x2="71" y2="42"/></g><circle class="d-pop" style="--r:0" cx="25" cy="48" r="7.5" fill="url(#hvS)"/><circle class="d-pop" style="--r:1" cx="47" cy="62" r="7.5" fill="url(#hvS)"/><circle class="d-pop" style="--r:2" cx="71" cy="42" r="7.5" fill="url(#hvS)"/><path d="M15 36 L31 31" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".85"/></g></g></svg>',
          biosimilaires: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="86" rx="32" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><g class="d-balance"><rect x="17" y="34" width="27" height="48" rx="8" fill="url(#hvP)"/><path d="M17 56 H44 V74 A8 8 0 0 1 36 82 H25 A8 8 0 0 1 17 74Z" fill="url(#hvBm)"/><rect x="22.5" y="28" width="16" height="8" rx="2" fill="#D6E2F8"/><rect x="20.5" y="18" width="20" height="12" rx="3.5" fill="url(#hvB)"/><rect x="21" y="39" width="4" height="34" rx="2" fill="#fff" opacity=".8"/></g><g class="d-balance2"><rect x="52" y="34" width="27" height="48" rx="8" fill="url(#hvP)"/><path d="M52 52 H79 V74 A8 8 0 0 1 71 82 H60 A8 8 0 0 1 52 74Z" fill="url(#hvB)"/><rect x="57.5" y="28" width="16" height="8" rx="2" fill="#D6E2F8"/><rect x="55.5" y="18" width="20" height="12" rx="3.5" fill="url(#hvB)"/><rect x="56" y="39" width="4" height="34" rx="2" fill="#fff" opacity=".8"/></g></g></g></svg>',
          offilog: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="50" cy="86" rx="33" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><g class="d-presse"><rect x="31" y="19" width="6" height="12" rx="1.5" fill="#0034A0"/><rect x="31" y="15" width="20" height="6" rx="3" fill="#0034A0"/></g><rect x="27" y="30" width="14" height="9" rx="2.5" fill="url(#hvBm)"/><rect x="18" y="38" width="32" height="44" rx="10" fill="url(#hvB)"/><rect x="23" y="51" width="22" height="17" rx="4" fill="#fff" opacity=".92"/><rect x="27" y="56" width="14" height="3" rx="1.5" fill="#BFD3FF"/><rect x="27" y="62" width="9" height="3" rx="1.5" fill="#BFD3FF"/><rect x="21" y="42" width="3.5" height="30" rx="1.75" fill="#fff" opacity=".35"/><g class="d-balance2"><path d="M54 32 H80 L76 70 H58Z" fill="url(#hvC)"/><rect x="52" y="27" width="30" height="6" rx="2" fill="#BFD3FF"/><rect x="60" y="70" width="14" height="12" rx="3" fill="url(#hvB)"/><rect x="59" y="42" width="16" height="10" rx="3" fill="url(#hvBm)"/></g></g></g></svg>',
          appro: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="89" rx="34" ry="4.5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><rect x="14" y="14" width="68" height="58" rx="11" fill="url(#hvP)"/><rect x="20" y="20" width="56" height="46" rx="6" fill="#E1EBFF"/><rect x="20" y="41" width="56" height="4" fill="#BFD3FF"/><rect x="24" y="27" width="12" height="14" rx="2.5" fill="url(#hvB)"/><rect x="38" y="31" width="10" height="10" rx="2.5" fill="url(#hvBm)"/><rect x="50" y="25" width="14" height="16" rx="2.5" fill="url(#hvB)"/><rect x="66" y="31" width="7" height="10" rx="2" fill="url(#hvBm)"/><rect x="24" y="50" width="14" height="16" rx="2.5" fill="url(#hvBm)"/><rect x="40" y="54" width="10" height="12" rx="2.5" fill="url(#hvB)"/><path d="M20 19h22" stroke="#fff" stroke-width="3" stroke-linecap="round"/><rect x="14" y="76" width="68" height="9" rx="4.5" fill="#E1EBFF"/><rect class="d-jauge" x="14" y="76" width="44" height="9" rx="4.5" fill="url(#hvB)"/></g></g></svg>',
          infos: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="46" cy="87" rx="32" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><g class="d-soleil"><circle cx="64" cy="28" r="19" fill="#E1EBFF"/><circle cx="64" cy="28" r="11.5" fill="url(#hvS)"/></g><rect x="20" y="32" width="58" height="48" rx="6" fill="#BFD3FF"/><rect x="14" y="36" width="58" height="46" rx="6" fill="url(#hvP)"/><rect x="20" y="43" width="36" height="6" rx="3" fill="url(#hvB)"/><rect x="20" y="54" width="18" height="21" rx="3" fill="url(#hvBm)"/><rect x="42" y="55" width="24" height="4" rx="2" fill="#BFD3FF"/><rect x="42" y="63" width="20" height="4" rx="2" fill="#BFD3FF"/><rect x="42" y="71" width="24" height="4" rx="2" fill="#D6E2F8"/><path d="M19 40.5h16" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g></g></svg>',
          concurrents: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="87" rx="28" ry="4.5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><rect x="42" y="70" width="12" height="12" rx="3" fill="#0034A0"/><rect x="31" y="80" width="34" height="5" rx="2.5" fill="url(#hvBm)"/><circle cx="48" cy="42" r="32" fill="url(#hvC)"/><circle cx="48" cy="42" r="27" fill="url(#hvB)"/><circle cx="48" cy="42" r="18" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.5"/><circle cx="48" cy="42" r="9" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.5"/><line x1="21" y1="42" x2="75" y2="42" stroke="#fff" stroke-opacity=".2" stroke-width="1.2"/><line x1="48" y1="15" x2="48" y2="69" stroke="#fff" stroke-opacity=".2" stroke-width="1.2"/><g class="d-tourne"><path d="M48 42 L48 15 A27 27 0 0 1 71.4 28.5Z" fill="#fff" opacity=".3"/></g><circle cx="61" cy="33" r="3.2" fill="#E1EBFF"/><circle cx="37" cy="54" r="2.6" fill="#E1EBFF" opacity=".85"/><ellipse cx="34" cy="24" rx="9" ry="4" fill="#fff" opacity=".22" transform="rotate(-32 34 24)"/></g></g></svg>',
          remontees: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="48" cy="86" rx="34" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><rect x="12" y="20" width="72" height="62" rx="11" fill="#BFD3FF"/><rect x="12" y="16" width="72" height="62" rx="11" fill="url(#hvP)"/><rect x="19" y="24" width="25" height="22" rx="3.5" fill="#E1EBFF" transform="rotate(-5 31.5 35)"/><rect x="24" y="33" width="14" height="3" rx="1.5" fill="#BFD3FF" transform="rotate(-5 31.5 35)"/><circle cx="31" cy="26" r="2.6" fill="#0034A0"/><rect x="20" y="51" width="25" height="22" rx="3.5" fill="url(#hvBm)" transform="rotate(3 32.5 62)"/><circle cx="32" cy="53" r="2.6" fill="#0034A0"/><rect x="51" y="51" width="25" height="21" rx="3.5" fill="#D6E2F8" transform="rotate(-3 63.5 61.5)"/><circle cx="63" cy="53" r="2.6" fill="#0034A0"/><g class="d-note"><rect x="50" y="22" width="26" height="24" rx="3.5" fill="url(#hvB)" transform="rotate(5 63 34)"/><rect x="55" y="32" width="15" height="3" rx="1.5" fill="#fff" opacity=".7" transform="rotate(5 63 34)"/><rect x="55" y="38" width="10" height="3" rx="1.5" fill="#fff" opacity=".5" transform="rotate(5 63 34)"/><circle cx="63" cy="24" r="2.6" fill="#E1EBFF"/></g><path d="M18 21h24" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g></g></svg>',
          marketing: '<svg class="hv-obj" focusable="false" viewBox="0 0 96 96" aria-hidden="true"><g class="o-sol"><ellipse class="o-ombre" cx="46" cy="84" rx="30" ry="5" fill="url(#hvO)"/></g><g class="o-leve"><g class="o-corps"><path d="M34 55 L39 72 Q40 76 44 75 L47 74 L43 58Z" fill="#0034A0"/><rect x="15" y="38" width="17" height="18" rx="5" fill="url(#hvBm)"/><path d="M28 40 L62 22 Q70 18 70 27 V65 Q70 74 62 70 L28 54Z" fill="url(#hvB)"/><ellipse cx="68" cy="46" rx="6" ry="24" fill="#0034A0"/><ellipse cx="69" cy="46" rx="3.8" ry="19" fill="#9BC0FF"/><path d="M32 42 L59 28" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/><path class="d-ondes" style="--r:0" d="M79 37 Q84 46 79 55" fill="none" stroke="#0050E6" stroke-width="3.5" stroke-linecap="round"/><path class="d-ondes" style="--r:1" d="M85.5 30 Q93 46 85.5 62" fill="none" stroke="#6C9BFF" stroke-width="3.5" stroke-linecap="round"/></g></g></svg>'
        };
        var hvI = 0;
        function goJs(k, param) { return 'V2.go(\'' + k + '\'' + (param ? ',\'' + param + '\'' : '') + ')'; }
        // cls : hv-todo | hv-grand | hv-ligne ; d : rang de l'objet dans son bloc (délai de pose).
        function porte(cls, k, obj, nom, phrase, d, js, fleche, i) {
          if (k && !V2.pages[k]) return '';
          return '<a class="hv-porte ' + cls + '" role="link" tabindex="0" style="--d:' + d + (i != null ? ';--i:' + i : '') + '" onclick="' + (js || goJs(k)) + '" onkeydown="if(event.key===\'Enter\')this.click()">' +
            HV_OBJ[obj] +
            '<span class="hv-txt"><span class="hv-nom">' + esc(nom) + '</span><span class="hv-phrase">' + esc(phrase) + '</span></span>' +
            (fleche ? '<span class="hv-fleche" aria-hidden="true">' + ICO('chev', 18) + '</span>' : '') + '</a>';
        }
        function ligne(k, obj, nom, phrase, d, js) { return porte('hv-ligne', k, obj, nom, phrase, d, js, true); }
        function rayon(nom, label, rappel, lignes) {
          var l = lignes.join(''); if (!l) return '';
          return '<section class="hv-rayon hv-anim" style="--i:' + (hvI++) + '" aria-label="' + label + '">' +
            '<div class="hv-rayon-tete"><h2 class="hv-rayon-nom">' + nom + '</h2>' +
            (rappel ? '<span class="hv-rayon-rappel">' + rappel + '</span>' : '') + '</div>' +
            '<div class="hv-lignes">' + l + '</div></section>';
        }
        var terrain = [
          ligne('pharma', 'groupements', 'Groupements', 'Les listes et listings d\'achats', 0, goJs('pharma', 'groupements')),
          ligne('carteGrp', 'carteGrp', 'Carte des groupements', 'Où sont les adhérents de chaque groupement', 1)
        ];
        // 14/09/2026 — le responsable d'Escale Pharma a l'accès total ET garde son
        // espace escale/v2 (demande de Will). Seul un compte @escalepharma.fr
        // arrive ici : les commerciaux Escale sont renvoyés avant.
        if (/@escalepharma\.fr$/i.test((V2.user && V2.user.email) || '')) {
          terrain.push(ligne('', 'pilotage', 'Espace Escale Pharma', 'Le suivi Escale et ses officines clientes', 2, 'location.href=\'../../escale/v2/index.html\''));
        }
        var grille = [
          porte('hv-grand', 'pharma', 'officines', 'Officines', 'La fiche de chaque client et prospect', 1),
          // La tournée se compose DANS la carte (« Ajouter à ma tournée ») : la page
          // autonome v2-tournee.js n'est plus chargée depuis le 11/09 (redondante).
          porte('hv-grand', 'carte', 'carte', 'La carte', 'Clients, prospects et ta tournée', 2),
          porte('hv-grand', 'produits', 'catalogue', 'Catalogue produits', 'Prix et stock des 7 établissements', 3),
          porte('hv-grand', 'pilotage', 'pilotage', 'Pilotage', 'CA, marge et objectifs', 4)
        ].join('');
        pilHtml = HV_DEFS + '<div class="hv-titre hv-anim" style="--i:' + (hvI++) + '">Tous les jours</div>' +
          porte('hv-todo hv-anim', 'todo', 'todo', 'To do list', 'Tes rendez-vous à demander, remerciements, ouvertures', 0, '', true, hvI++) +
          (grille ? '<div class="hv-grille hv-anim" style="--i:' + (hvI++) + '">' + grille + '</div>' : '') +
          '<div class="hv-titre hv-anim" style="--i:0">Les rayons</div>' +
          '<div class="hv-rayons">' +
            rayon('Le terrain', 'Le terrain', 'et 3 objets plus haut', terrain) +
            rayon('Les produits', 'Les produits', 'et le Catalogue plus haut', [
              ligne('biosimilaires', 'biosimilaires', 'Biosimilaires', 'Les biosimilaires et leurs références', 0),
              ligne('offilog', 'offilog', 'Offilog', 'La centrale parapharmacie', 1),
              ligne('appro', 'appro', 'Appro Intégral', 'Couverture de stock et ruptures', 2)
            ]) +
            rayon('Piloter &amp; informer', 'Piloter et informer', 'et le Pilotage plus haut', [
              ligne('infos', 'infos', 'Infos du matin', 'Le brief du jour', 0),
              ligne('concurrents', 'concurrents', 'Concurrents', 'Ce que font les autres', 1),
              ligne('remontees', 'remontees', 'Remontées', 'Le mur d\'idées de l\'équipe', 2)
            ]) +
            rayon('Vendre &amp; convaincre', 'Vendre et convaincre', '', [
              ligne('marketing', 'marketing', 'Marketing', 'Supports, sélections, LinkedIn', 0)
            ]) +
          '</div>';

        // ── En cours de développement ─────────────────────────────────────
        // Ce qui n'est pas fini ou sert rarement descend ici, en retrait, même
        // pastille pour tous (Will, 23 et 24/09/2026) : Rendez-vous, JARVIS
        // Academy, puis Réforme 2027, Fiches PDF, L'Argument, Audit marge et
        // Présentation Intégral. JARVIS Design n'a plus sa place sur le CRM.
        // ⚠️ CE DÉPÔT EST PUBLIC : aucun code d'accès n'est écrit ici. JARVIS
        // Academy est protégée par un code partagé qui se demande de vive voix.
        // Outil INTERNE Intégral (bêta) : jamais montré au groupement — le
        // 04/09/2026, Will : « ils n'ont pas accès à jarvis academy ni jarvis design ! »
        function pic(d) { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>'; }
        var PIC = {
          cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
          cap: '<path d="M2 9 12 4l10 5-10 5-10-5z"/><path d="M6 11.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-5.5"/><line x1="22" y1="9" x2="22" y2="15"/>',
          reforme: '<rect x="5" y="3" width="12" height="17" rx="1.5"/><line x1="8" y1="8" x2="14" y2="8"/><line x1="8" y1="12" x2="14" y2="12"/><circle cx="17" cy="17" r="4"/><path d="M15.3 17l1.1 1.1 2.1-2.3"/>',
          fiche: '<path d="M6 3h7l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M13 3v4a1 1 0 0 0 1 1h4"/><line x1="8" y1="13" x2="15" y2="13"/><line x1="8" y1="16" x2="12" y2="16"/>',
          argument: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="14" width="3" height="6" rx="0.5"/><rect x="11" y="10" width="3" height="10" rx="0.5"/><rect x="16" y="6" width="3" height="14" rx="0.5"/>',
          audit: '<circle cx="10" cy="10" r="6"/><line x1="7.5" y1="12.5" x2="12.5" y2="7.5"/><line x1="14.3" y1="14.3" x2="20" y2="20"/><circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>',
          presentation: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M7 12l3-3 2 2 4-4"/><line x1="12" y1="16" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/>'
        };
        function enc(k, ico, nom, js) {
          if (!V2.pages[k]) return '';
          return '<a class="v2-enc-l" role="link" tabindex="0" onclick="' + (js || goJs(k)) + '" onkeydown="if(event.key===\'Enter\')this.click()">' + pic(PIC[ico]) + esc(nom) + '</a>';
        }
        pilHtml +=
          '<div class="v2-enc-chip hv-anim" style="--i:0">En cours de développement</div>' +
          '<div class="v2-enc hv-anim" style="--i:1"><div class="v2-enc-liens">' +
            enc('rdv', 'cal', 'Rendez-vous') +
            '<a class="v2-enc-l" href="https://jarvis-academy-fr.vercel.app/" target="_blank" rel="noopener">' + pic(PIC.cap) + 'JARVIS Academy <span class="fl">↗</span></a>' +
            // Réforme 2027 : document privé, adresse signée valable 1 h, jamais servi
            // par le dépôt public. Le fichier porte du CA réseau, il reste dans Supabase.
            enc('pilotage', 'reforme', 'Réforme 2027', 'V2.ouvrirDocProtege(\'reforme2027\')') +
            enc('fiches', 'fiche', 'Fiches PDF') +
            enc('argument', 'argument', 'L\'Argument') +
            enc('audit', 'audit', 'Audit marge') +
            enc('presentation', 'presentation', 'Présentation Intégral') +
          '</div>' +
          '<p class="v2-enc-n">Le code d\'accès de JARVIS Academy se demande à Will — il n\'est écrit nulle part.</p></div>';
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

      root.innerHTML = topbar() +
        '<div class="v2-wrap narrow v2-home-x ' + homeAnimCls + '">' +
          '<div class="v2-hero">' +
            '<h1>' + salut + ' <span class="ac">' + esc(firstName) + '</span></h1>' +
            '<p class="v2-hero-sub">' + cap(today) + ' · ' + (partiel
              ? '<span id="v2-ventes-etat">Chargement des ventes… <b>' + ((V2.ventesProgres && V2.ventesProgres.n) || 0) + '</b> / ' + ((V2.ventesProgres && V2.ventesProgres.total) || '?') + '</span>'
              : '<b>' + nbPharma + '</b> officines actives') + tiennesTxt + '</p>' +
          '</div>' +
          '<div class="v2-search" role="button" tabindex="0" aria-label="Rechercher une pharmacie, un produit" onclick="V2.onTopSearch()"><span class="srch-ic">' + ICO('search', 18, 2) + '</span>' +
            '<input readonly aria-hidden="true" tabindex="-1" placeholder="Cherche une pharmacie, un produit…" style="cursor:pointer"><kbd>' + MOD + 'K</kbd></div>' +
          relancesCardHtml() +
          (V2.todo ? V2.todo.cardHtml() : '') +
          pilHtml +
        '</div>';
      if (jouerAnim) hvReveler(root);
    }
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
    // Une seule entrée « La carte » (l'entrée « Copilote » en doublon est retirée le 27/08/2026).
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.carte) PAGES.splice(1, 0, ['carte', 'La carte · officines, clients, prospects, tournée', 'pharma']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.infos) PAGES.splice(1, 0, ['infos', 'Infos du matin', 'spark']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.produits) PAGES.splice(1, 0, ['produits', 'Produits · catalogue des 7 établissements', 'cat']);
    // molecules / catalogue / appro restent dans ⌘K : c'est le chemin de secours
    // depuis qu'ils ont quitté les tuiles de l'accueil.
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.molecules) PAGES.splice(4, 0, ['molecules', 'Catalogue & prix (par produit)', 'cat']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.appro) PAGES.push(['appro', 'Appro Intégral · vue achats détaillée', 'spark']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.biosimilaires) PAGES.splice(4, 0, ['biosimilaires', 'Base Biosimilaires (marché FR)', 'cat']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.audit) PAGES.push(['audit', 'Audit Marge (par pharmacie)', 'pilo']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.presentation) PAGES.push(['presentation', 'Présentation Intégral Pharma', 'pharma']);
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
      if (window.PHARMA_FR && V2.loadFiles) { try { V2.loadFiles(['pharmafrca']); } catch (e) {} }
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
      '.v2-brand-s{font-family:var(--mono);text-transform:uppercase;letter-spacing:.12em;' +
        'font-size:9.5px;font-weight:500;color:var(--muted);line-height:1}' +
      '@media(max-width:640px){.v2-brand-s{font-size:9px;letter-spacing:.1em}}' +
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
      '.v2-login p{font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;font-size:10.5px;' +
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
      '.v2-login-foot{margin-top:22px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.11em;' +
        'font-size:9px;color:var(--muted-2);display:flex;align-items:center;justify-content:center;gap:7px;line-height:1}' +
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
      (opso ? V2.loadFiles(['opsostats']).then(function () { return V2.loadData(); }) : Promise.resolve()),
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
    V2.loadFiles(['establishments']);
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
      if (r.name !== V2.route.name || r.param !== V2.route.param) { V2.route = r; V2.render(); }
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
