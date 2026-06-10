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

  // ── NAVIGATION ────────────────────────────────
  V2.go = function (name, param) {
    V2.route = { name: name, param: param || null };
    try { location.hash = '#' + name + (param ? '/' + encodeURIComponent(param) : ''); } catch (e) {}
    V2.render();
    try { document.querySelector('.v2-wrap, .v2-content')?.scrollTo?.({ top: 0 }); window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {}
  };

  function parseHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return { name: 'home', param: null };
    var parts = h.split('/');
    return { name: parts[0] || 'home', param: parts[1] ? decodeURIComponent(parts[1]) : null };
  }

  // ── SHELL (topbar) ────────────────────────────
  function topbar(opts) {
    opts = opts || {};
    var back = opts.back
      ? '<button class="v2-back" onclick="V2.go(\'' + (opts.backTo || 'home') + '\')">' + ICO('back', 16) + (opts.backLabel || 'Accueil') + '</button>'
      : '';
    var initials = (V2.user && V2.user.name ? V2.user.name.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('') : 'WM').toUpperCase();
    return '' +
      '<div class="v2-top">' +
        (back ||
         '<a class="v2-brand" onclick="V2.go(\'home\')"><span class="v2-logo">' + ICO('logo', 22) + '</span>' +
         '<span><span class="v2-brand-t">Intégral Pharma</span><br><span class="v2-brand-s">Espace commercial</span></span></a>') +
        '<div class="v2-top-search" onclick="V2.openCmdk()">' + ICO('search', 15, 2) + 'Rechercher<kbd>⌘K</kbd></div>' +
        '<div class="v2-av" title="' + (V2.user ? V2.user.name : '') + '" onclick="V2.userMenu()">' + initials + '</div>' +
      '</div>';
  }
  V2.topbar = topbar;

  V2.userMenu = function () {
    if (confirm('Te déconnecter ?')) V2.signOut();
  };

  // ── RENDER (routeur) ──────────────────────────
  V2.render = function () {
    var root = $app(); if (!root) return;
    var page = V2.pages[V2.route.name];
    if (!page) { V2.route.name = 'home'; page = V2.pages.home; }
    if (!page) { root.innerHTML = '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>'; return; }
    try {
      page.render(root, V2.route.param);
    } catch (e) {
      console.error('[V2 render ' + V2.route.name + ']', e);
      root.innerHTML = topbar({ back: true }) + '<div class="v2-wrap"><div class="v2-empty"><div class="v2-empty-t">Une erreur est survenue</div><div class="v2-empty-d">' + (e && e.message ? e.message : '') + '</div><button class="v2-btn v2-btn-primary" onclick="V2.go(\'home\')">Retour à l\'accueil</button></div></div>';
    }
  };

  // ════════════════════════════════════════════
  // PAGE HOME (accueil réel B-signature)
  // ════════════════════════════════════════════
  V2.pages.home = {
    render: function (root) {
      var phs = V2.pharmacies || [];
      // pharmacies récentes : par CA décroissant (proxy d'activité)
      var withCa = phs.map(function (p) {
        var ca = V2.sumCA(V2.sales.filter(function (s) { return s.pharmacyId === p.id; }));
        return { p: p, ca: ca };
      }).filter(function (x) { return x.ca > 0; }).sort(function (a, b) { return b.ca - a.ca; });
      var recent = withCa.slice(0, 3);
      var COLORS = ['var(--c-opp)', 'var(--c-pilo)', 'var(--c-fiche)'];

      var nbPharma = withCa.length;
      var caTotal = withCa.reduce(function (s, x) { return s + x.ca; }, 0);
      var today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

      var recentHtml = recent.length
        ? recent.map(function (x, i) {
            return '<a class="v2-rchip" onclick="V2.go(\'pharma\',\'' + x.p.id + '\')"><span class="d" style="background:' + COLORS[i] + '"></span>' + esc(x.p.name) + '</a>';
          }).join('') + '<span class="v2-rchip more" onclick="V2.go(\'pharma\')">toutes mes officines</span>'
        : '<span class="v2-rchip more" onclick="V2.go(\'pharma\')">voir mes officines</span>';

      var P = [
        { k: 'pharma', cls: 'p1', ico: 'opp', tag: 'RDV', t: 'Opportunités pharmacie', d: 'Arrive sur une officine et vois direct quoi proposer : ses best, ce qu\'elle ne commande pas, classé par catégorie et tranche de prix.', go: 'Choisir une pharmacie' },
        { k: 'fiches', cls: 'p2', ico: 'fiche', tag: 'PDF', t: 'Fiches commerciales', d: 'Crée une fiche produit sur-mesure et sors-la en PDF à montrer ou envoyer au pharmacien pendant le rendez-vous.', go: 'Créer une fiche' },
        { k: 'catalogue', cls: 'p3', ico: 'cat', tag: (window.BENCHMARK ? V2.fmtNum(window.BENCHMARK.length) : '10 500'), t: 'Catalogue grossiste', d: 'Tout le catalogue médicaments IP par tranches de prix et familles AFMCODE, avec ton volume et le marché Ameli.', go: 'Explorer le catalogue' },
        { k: 'offilog', cls: 'p5', accent: 'var(--c-froid)', ico: 'spark', tag: 'Veille', t: 'Offilog & concurrents', d: 'Ta parapharma : ton prix d\'achat IP comparé en direct aux prix publics E.Leclerc, Drakkars et Cap3000. Repère où un concurrent casse les prix.', go: 'Ouvrir Offilog' },
        { k: 'pilotage', cls: 'p4', ico: 'pilo', tag: V2.fmtK(caTotal) + ' €', t: 'Pilotage CA & marge', d: 'Ton chiffre d\'affaires, ta marge MDL, tes objectifs et qui commande quoi. Le tableau de bord de ta tournée.', go: 'Voir mon pilotage' },
      ];
      var pilHtml = P.map(function (p) {
        return '<a class="v2-pil ' + p.cls + '"' + (p.accent ? ' style="--accent:' + p.accent + '"' : '') + ' onclick="V2.go(\'' + p.k + '\')">' +
          '<div class="v2-pil-head"><div class="v2-pil-ico">' + ICO(p.ico, 26) + '</div><span class="v2-pil-num">' + p.tag + '</span></div>' +
          '<div class="v2-pil-t">' + p.t + '</div><div class="v2-pil-d">' + p.d + '</div>' +
          '<div class="v2-pil-go">' + p.go + ' <span class="arrow">→</span></div></a>';
      }).join('');

      var firstName = (V2.user && V2.user.name ? V2.user.name.split(' ')[0] : 'Will');

      root.innerHTML = topbar() +
        '<div class="v2-wrap narrow">' +
          '<div class="v2-hero">' +
            '<span class="v2-eyebrow"><span class="dot"></span>' + cap(today) + ' · ' + nbPharma + ' officines actives</span>' +
            '<h1>Bonjour ' + esc(firstName) + ', par où on commence ?</h1>' +
            '<p>Cherche une pharmacie, ou ouvre directement un de tes outils</p>' +
          '</div>' +
          '<div class="v2-search" onclick="V2.openCmdk()">' + ICO('search', 24, 2) +
            '<input readonly placeholder="Pharmacie, produit, page…" style="cursor:pointer"><kbd>⌘K</kbd></div>' +
          '<div class="v2-recent">' + recentHtml + '</div>' +
          '<div class="v2-piliers">' + pilHtml + '</div>' +
        '</div>';
    }
  };

  // ════════════════════════════════════════════
  // COMMAND PALETTE ⌘K
  // ════════════════════════════════════════════
  var cmdkIdx = null, cmdkSel = 0, cmdkResults = [];
  function buildCmdkIndex() {
    var idx = [];
    // Pages
    [['home', 'Accueil', 'opp'], ['pharma', 'Opportunités pharmacie', 'opp'], ['fiches', 'Fiches commerciales', 'fiche'], ['catalogue', 'Catalogue grossiste', 'cat'], ['offilog', 'Offilog & concurrents', 'spark'], ['pilotage', 'Pilotage CA & marge', 'pilo']]
      .forEach(function (p) { idx.push({ grp: 'Pages', label: p[1], ico: p[2], action: function () { V2.go(p[0]); } }); });
    // Pharmacies
    (V2.pharmacies || []).forEach(function (p) {
      idx.push({ grp: 'Pharmacies', label: p.name, ico: 'pharma', meta: '', action: function () { V2.go('pharma', p.id); } });
    });
    // Produits (top 300 BENCHMARK par rang)
    var B = window.BENCHMARK || [];
    B.slice().sort(function (a, b) { return (a.ip_rank_qty || 9e9) - (b.ip_rank_qty || 9e9); }).slice(0, 300)
      .forEach(function (b) { idx.push({ grp: 'Produits', label: b.designation, ico: 'pill', meta: b.cip13, action: function () { V2.go('catalogue', b.cip13); } }); });
    return idx;
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
    return scored.slice(0, 24).map(function (o) { return o.x; });
  }
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
  V2.openCmdk = function () {
    var bd = document.getElementById('v2-cmdk'); if (!bd) return;
    bd.classList.add('open');
    var inp = document.getElementById('v2-cmdk-input');
    inp.value = ''; cmdkSel = 0; cmdkResults = cmdkSearch(''); renderCmdkResults();
    setTimeout(function () { inp.focus(); }, 60);
  };
  V2.closeCmdk = function () { var bd = document.getElementById('v2-cmdk'); if (bd) bd.classList.remove('open'); };
  function mountCmdk() {
    if (document.getElementById('v2-cmdk')) return;
    var bd = document.createElement('div');
    bd.id = 'v2-cmdk'; bd.className = 'v2-cmdk-bd';
    bd.innerHTML = '<div class="v2-cmdk" onclick="event.stopPropagation()">' +
      '<div class="v2-cmdk-search">' + ICO('search', 22, 2) + '<input id="v2-cmdk-input" placeholder="Rechercher pharmacie, produit, page…" autocomplete="off"><kbd style="font-family:var(--mono);font-size:11px;background:#F1F3F8;padding:4px 8px;border-radius:7px;color:var(--ip-ink-2)">Esc</kbd></div>' +
      '<div id="v2-cmdk-results" class="v2-cmdk-results"></div>' +
      '<div class="v2-cmdk-foot"><span>↑↓ naviguer</span><span>↵ ouvrir</span><span>Esc fermer</span></div>' +
      '</div>';
    bd.onclick = function () { V2.closeCmdk(); };
    document.body.appendChild(bd);
    var inp = bd.querySelector('#v2-cmdk-input');
    inp.addEventListener('input', function () { cmdkSel = 0; cmdkResults = cmdkSearch(inp.value); renderCmdkResults(); });
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

  // ── helpers ───────────────────────────────────
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  V2.esc = esc; V2.cap = cap;

  // ════════════════════════════════════════════
  // BOOT
  // ════════════════════════════════════════════
  V2.boot = async function () {
    var root = $app();
    root.innerHTML = '<div class="v2-loading"><div class="v2-spinner"></div><div>Connexion…</div></div>';
    mountCmdk();
    var logged = await V2.loadUserProfile();
    if (!logged) { V2.renderLogin(); return; }
    root.innerHTML = '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement de tes données…</div></div>';
    // charge données Supabase + fichiers essentiels en parallèle
    await Promise.all([
      V2.loadData(),
      V2.loadFiles(['bench', 'establishments', 'sagitta'])
    ]);
    V2.invalidateCmdk();
    V2.route = parseHash();
    V2.render();
    window.addEventListener('hashchange', function () {
      var r = parseHash();
      if (r.name !== V2.route.name || r.param !== V2.route.param) { V2.route = r; V2.render(); }
    });
  };

  // ── LOGIN ─────────────────────────────────────
  V2.renderLogin = function () {
    var root = $app();
    root.innerHTML = '<div class="v2-login"><div class="v2-login-card">' +
      '<div class="v2-login-logo">' + ICO('logo', 30) + '</div>' +
      '<h1>Intégral Pharma</h1><p>Espace commercial · CRM</p>' +
      '<input class="v2-field" id="v2-email" type="email" placeholder="Email" autocomplete="username">' +
      '<input class="v2-field" id="v2-pass" type="password" placeholder="Mot de passe" autocomplete="current-password">' +
      '<button class="v2-btn v2-btn-primary" id="v2-login-btn">Se connecter</button>' +
      '<div class="v2-login-err" id="v2-login-err"></div>' +
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
        else { err.textContent = r.msg || 'Identifiants incorrects'; btn.textContent = 'Se connecter'; btn.disabled = false; }
      });
    }
    btn.onclick = submit;
    document.getElementById('v2-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    document.getElementById('v2-email').focus();
  };

  // démarrage
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(V2.boot, 60); });
  else setTimeout(V2.boot, 60);
})();
