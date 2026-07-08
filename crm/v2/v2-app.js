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

  // ── NAVIGATION ────────────────────────────────
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
    // Le logo Intégral Pharma est TOUJOURS présent et cliquable → accueil (depuis n'importe où).
    // Sur une page interne, on l'affiche en version compacte (logo seul) à côté du bouton retour.
    var brand = '<a class="v2-brand' + (back ? ' v2-brand-compact' : '') + '" onclick="V2.go(\'home\')" title="Accueil" aria-label="Accueil">' +
      '<span class="v2-logo">' + ICO('logo', 22) + '</span>' +
      (back ? '' : '<span><span class="v2-brand-t">' + ((window.V2_BRAND && window.V2_BRAND.name) || 'Intégral Pharma') + '<span class="v2-brand-dot" aria-hidden="true"></span></span><br><span class="v2-brand-s">' + ((window.V2_BRAND && window.V2_BRAND.sub) || 'Espace commercial') + '</span></span>') +
      '</a>';
    return '' +
      '<div class="v2-top">' +
        back + brand +
        '<div class="v2-top-search" onclick="V2.onTopSearch()">' + ICO('search', 15, 2) + 'Rechercher<kbd>' + MOD + 'K</kbd></div>' +
        '<div class="v2-av" title="' + (V2.user ? V2.user.name : '') + '" onclick="V2.userMenu()">' + initials + '</div>' +
      '</div>';
  }
  V2.topbar = topbar;

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
      '<button class="v2-um-item" onclick="V2.signOut()">' + ICO('logout', 16, 2) + 'Se déconnecter</button>';
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('open'); });
    setTimeout(function () {
      function close(e) {
        if (e.type === 'keydown' && e.key !== 'Escape') return;
        if (e.type === 'click' && m.contains(e.target)) return;
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
    var steps = isIOS
      ? '1. Touche le bouton <b>Partager</b> (le carré avec une flèche ⬆) en bas de Safari<br>2. Choisis <b>« Sur l\'écran d\'accueil »</b><br>3. Valide avec <b>Ajouter</b>'
      : '1. Ouvre le menu du navigateur (<b>⋮</b> en haut à droite)<br>2. Choisis <b>« Installer l\'application »</b> ou <b>« Ajouter à l\'écran d\'accueil »</b>';
    var o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(16,19,28,.5);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)';
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

  // Accent de PILIER courant : chaque écran a SA lumière (halo de tête + liserés).
  // Mappe la route vers le token var(--pil-*) correspondant ; défaut = bleu marque.
  var ROUTE_ACCENT = {
    home: 'var(--accent)', pharma: 'var(--pil-opp)', fiches: 'var(--pil-fiche)',
    catalogue: 'var(--pil-cat)', pilotage: 'var(--pil-pilo)', offilog: 'var(--pil-froid)',
    groupements: 'var(--pil-fiche)', molecules: '#7C3AED', presentation: 'var(--c-opp)',
    infos: 'var(--c-amber)', marketing: 'var(--c-rose)', audit: '#10915E', sagitta: 'var(--pil-froid)'
  };
  function accentFor(name) {
    if (name === 'marketing') return (window.V2_BRAND && window.V2_BRAND.opso) ? 'var(--pil-fiche)' : 'var(--pil-rose)';
    return ROUTE_ACCENT[name] || 'var(--accent)';
  }

  // ── RENDER (routeur) ──────────────────────────
  V2.render = function () {
    var root = $app(); if (!root) return;
    injectShellStyles();
    var page = V2.pages[V2.route.name];
    if (!page) { V2.route.name = 'home'; page = V2.pages.home; }
    if (!page) { root.innerHTML = '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>'; return; }
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
  V2.prospectEmail = function () {
    var inp = document.getElementById('prospect-mail');
    var to = (inp && inp.value || '').trim();
    var u = V2.user || {}, link = V2.prospectLink();
    var subj = 'Intégral Pharma — faire connaissance';
    var body = 'Bonjour,\n\nSuite à notre échange, voici une courte présentation d\'Intégral Pharma : qui nous sommes, ce que vous gagnez à travailler avec nous, comment ouvrir un compte, et nos meilleures ventes par catégorie.\n\n' +
      link + '\n\nJe reste à votre disposition pour établir une proposition adaptée à votre officine.\n\nBien à vous,\n' +
      (u.name || '') + (u.email ? '\n' + u.email : '') + '\nIntégral Pharma';
    window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
  };
  V2.prospectCopy = function () {
    var link = V2.prospectLink();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function () { V2.toast('Lien copié'); }, function () { window.prompt('Copie ce lien :', link); });
    } else { window.prompt('Copie ce lien :', link); }
  };
  V2.prospectOpen = function () { window.open(V2.prospectLink(), '_blank'); };

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
      '.pres-h1{font-size:30px;font-weight:900;letter-spacing:-.03em;line-height:1.05;color:#fff}',
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
      '.pres-send-in:focus{outline:none;border-color:color-mix(in srgb,var(--ip-blue) 45%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--ip-blue) 13%,transparent)}',
      // ── Impression : rien de masqué, états finaux posés, .noprint identique
      '@media print{.pres-hero .noprint,.pres-send.noprint,.pres-contact-act.noprint,.pres-step-cta .noprint{display:none!important}.pres-hero *,.pres-eyebrow,.pres-h1,.pres-lead,.pres-tag,.pres-kpis,.pres-reassure-i,.pres-card,.pres-proof-h,.pres-tier,.pres-step,.pres-contact,.pres-send{opacity:1!important;transform:none!important;animation:none!important}}',
      '@media(max-width:480px){' +
        '.pres-hero{padding:36px 18px 28px}' +
        '.pres-h1{font-size:25px}.pres-lead{font-size:16px}.pres-tag{font-size:13px}' +
        '.pres-kpi{max-width:none}.pres-kpi-v{font-size:21px}.pres-kpi.mid .pres-kpi-v{font-size:25px}' +
        '.pres-reassure-i{font-size:13px;padding:8px 13px}' +
        '.pres-proof-v{font-size:24px}' +
        '.pres-step-cta{margin-left:0}' +
        '.pres-contact{flex-direction:column;align-items:stretch}.pres-contact-c{margin-left:0;text-align:left}' +
        '.pres-contact-act{margin-left:0;justify-content:stretch}.pres-contact-act .v2-btn{flex:1}' +
        '.pres-send-row{flex-direction:column}.pres-send-in,.pres-send-row .v2-btn{width:100%}' +
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
      if (!window.BENCHMARK && V2.loadFiles) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>';
        V2.loadFiles(['bench']).then(function () { V2.render(); });
        return;
      }
      var B = window.BENCHMARK || [];
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
      var capsule = function (w, h) {
        return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 48 28" role="img" aria-label="Intégral Pharma">' +
          '<rect x="2" y="1.5" width="9" height="5.5" rx="2.75" fill="#0B1F4D"/>' +
          '<rect x="2" y="8.5" width="9" height="18" rx="4.5" fill="#0B1F4D"/>' +
          '<rect x="14" y="6.5" width="11" height="12" rx="5.5" fill="#C9A961"/>' +
          '<rect x="17" y="9.5" width="5" height="6" rx="2.5" fill="#FFFFFF"/>' +
          '<rect x="14" y="6.5" width="4" height="21" rx="2" fill="#C9A961"/></svg>';
      };
      var logoSvg = capsule(40, 24);
      var u = V2.user || {};
      // E-mail pré-rempli ouverture de compte (réutilise u.email/u.name, fallback service client)
      var openMail = u.email || 'serviceclient@ouestpharmaservices.fr';
      var openSubj = 'Ouverture de compte Intégral Pharma';
      var openBody = 'Bonjour,\n\nJe souhaite ouvrir un compte Intégral Pharma.\nVous trouverez ci-joint mon formulaire d\'ouverture rempli, mon RIB et mon Kbis.\n\nCordialement,';
      var openHref = 'mailto:' + openMail + '?subject=' + encodeURIComponent(openSubj) + '&body=' + encodeURIComponent(openBody);
      var ICODL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 18.5h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var ICOCHK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 6.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var card = function (color, ico, t, d) {
        return '<div class="pres-card" style="--accent:' + color + '" onmousemove="V2.homeSpot(event,this)"><div class="pres-card-ic">' + ICO(ico, 22) + '</div>' +
          '<div class="pres-card-t">' + t + '</div><div class="pres-card-d">' + d + '</div></div>';
      };
      var step = function (n, t, d) {
        return '<div class="pres-step"><div class="pres-step-n">' + n + '</div><div><div class="pres-step-t">' + t + '</div><div class="pres-step-d">' + d + '</div></div></div>';
      };
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' +
          (V2.docTabs ? V2.docTabs('presentation') : '') +
          '<div class="pres-hero">' +
            '<div class="pres-logo">' + logoSvg + '</div>' +
            '<div class="pres-eyebrow">Grossiste-répartiteur · +20 ans</div>' +
            '<div class="pres-h1">Intégral Pharma</div>' +
            '<div class="pres-lead">Plus de marge sur chaque boîte. Sans franco, sans engagement.</div>' +
            '<div class="pres-tag">Un groupe de grossistes français à vos côtés. Acteur de la santé depuis plus de 20 ans, partenaire de proximité pour améliorer durablement la rentabilité de votre officine.</div>' +
            '<div class="pres-kpis">' +
              '<div class="pres-kpi mid"><div class="pres-kpi-v" data-count>6–9 %</div><div class="pres-kpi-l">de marge, nets sur facture</div></div>' +
              '<div class="pres-kpi"><div class="pres-kpi-v" data-count>0 €</div><div class="pres-kpi-l">ni franco ni engagement</div></div>' +
              '<div class="pres-kpi"><div class="pres-kpi-v" data-count>' + nf(nbPara) + '</div><div class="pres-kpi-l">réfs parapharma, sans adhésion</div></div>' +
            '</div>' +
          '</div>' +

          '<div class="pres-reassure">' +
            '<div class="pres-reassure-i">' + ICOCHK + 'Ni franco</div>' +
            '<div class="pres-reassure-i">' + ICOCHK + 'Ni engagement de CA</div>' +
            '<div class="pres-reassure-i">' + ICOCHK + 'Livraison 2×/sem. à 1×/jour</div>' +
          '</div>' +

          '<div class="pres-sec-t">Ce que vous gagnez</div>' +
          '<div class="pres-grid">' +
            card('var(--c-mint)', 'spark', 'Plus de marge, sur tout le catalogue', 'Meilleure marge sur l\'intégralité du catalogue, des prix nets sur facture et une optimisation dès la première boîte. La transparence des conditions, pas les paliers cachés.') +
            card('var(--c-cat)', 'cat', 'Une centrale parapharmacie unique', 'Via Offilog : la plus grande collection de parapharmacie de France, +14 000 produits, +430 laboratoires, sans coût d\'adhésion et au meilleur prix à l\'unité, sans paliers.') +
            card('var(--c-pilo)', 'pilo', 'Un accompagnement chiffré & de proximité', 'Votre commercial vient avec VOS chiffres : meilleures ventes du marché, opportunités de marge, commande déjà préparée. Service réactif et transparent.') +
            card('var(--c-fiche)', 'spark', 'Travaillez en toute sérénité', 'Pas de franco ni d\'engagement de CA imposé. L\'objectif se fixe ensemble, en bonne intelligence et avec bon sens, entre vous et votre commercial — un partenariat équilibré, jamais une contrainte.') +
          '</div>' +

          '<div class="pres-sec-t">Vos conditions — la preuve chiffrée</div>' +
          '<div class="pres-proof">' +
            '<div class="pres-proof-h"><div class="pres-proof-v" data-count>jusqu\'à 27 %</div><div class="pres-proof-l">sur les génériques, dès la 1ère boîte</div></div>' +
            '<div class="pres-proof-h"><div class="pres-proof-v" data-count>6–9 %</div><div class="pres-proof-l">de remise constatée, nets sur facture (PFHT)</div></div>' +
          '</div>' +
          '<div class="pres-card">' +
            '<div class="pres-card-d" style="font-size:13px;color:var(--muted)">Barème par tranche, en prix nets sur facture :</div>' +
            '<div class="pres-tiers">' +
              '<div class="pres-tier"><div class="pres-tier-r">&lt; 4,33 €</div><div class="pres-tier-v" data-count>4,5 – 30 %</div><div class="pres-tier-l">petits prix</div></div>' +
              '<div class="pres-tier"><div class="pres-tier-r">4,33 – 468 €</div><div class="pres-tier-v" data-count>3,89 %</div><div class="pres-tier-l">intermédiaires</div></div>' +
              '<div class="pres-tier"><div class="pres-tier-r">&gt; 468 €</div><div class="pres-tier-v" data-count>19,50 €</div><div class="pres-tier-l">forfait fixe</div></div>' +
            '</div>' +
            '<div class="pres-card-d" style="font-size:12.5px;color:var(--muted);margin-top:12px">Génériques : jusqu\'à 27 % dès la 1ère boîte. Livraison adaptée au secteur (de 2×/semaine à 1×/jour). Ni franco ni engagement imposé — l\'objectif se fixe ensemble, en bonne intelligence.</div>' +
            '<div class="pres-card-d" style="font-size:12.5px;color:var(--muted);margin-top:6px">Catalogue : ' + nf(nbRefN) + ' médicaments + ' + nf(nbPara) + ' réfs parapharma · ' + nf(nbOffre) + ' offres labo en ce moment (L\'Intégral, ITP, UPSA, Sanofi).</div>' +
            '<div class="pres-cta-line" style="cursor:default">Ces conditions vous intéressent ? Ouvrez un compte ci-dessous ↓</div>' +
          '</div>' +

          '<div class="pres-sec-t">Ouvrir un compte en 3 étapes</div>' +
          '<div class="pres-card" style="padding:8px 24px 18px"><div class="pres-steps">' +
            step('1', 'Téléchargez et remplissez le formulaire 2026', 'Le formulaire d\'ouverture de compte Intégral Pharma 2026.') +
            '<div class="pres-step-cta pres-dl"><a class="v2-btn v2-btn-primary noprint" href="ouverture-compte-integral-pharma-2026.pdf" download>' + ICODL + 'Télécharger le formulaire 2026</a></div>' +
            step('2', 'Renvoyez-le par e-mail avec votre RIB et votre Kbis', 'Joignez le formulaire rempli, votre RIB et votre Kbis (et pièces justificatives).') +
            '<div class="pres-step-cta"><a class="v2-btn v2-btn-ghost noprint" href="' + openHref + '">' + ICO('fiche', 16) + 'Envoyer par e-mail</a></div>' +
            '<div class="pres-step"><div class="pres-step-ok">' + ICOCHK + '</div><div><div class="pres-step-t">Vous recevez votre code PharmaML</div><div class="pres-step-d">Votre compte est ouvert : vous pouvez commander.</div></div></div>' +
          '</div></div>' +

          '<div class="pres-sec-t">Vos meilleures ventes par catégorie</div>' +
          '<div class="pres-card"><div class="pres-card-d" style="font-size:13.5px">Au comptoir, votre commercial vous présente les <b>meilleures ventes réelles du marché par catégorie</b>, avec le prix net Intégral Pharma et les offres labo du moment — la preuve concrète de la marge sur vos références à plus forte rotation.</div></div>' +

          '<div class="pres-sec-t">Votre contact</div>' +
          '<div class="pres-contact">' +
            '<div class="pres-logo" style="width:46px;height:46px;border-radius:13px;margin:0">' + capsule(30, 18) + '</div>' +
            '<div><div class="pres-contact-n">' + esc(u.name || 'Votre commercial Intégral Pharma') + '</div>' +
              '<div class="pres-contact-r">Délégué pharmaceutique référent</div></div>' +
            '<div class="pres-contact-act noprint">' +
              '<a class="v2-btn v2-btn-primary" href="' + openHref + '">' + ICO('fiche', 16) + 'Demander l\'ouverture de mon compte</a>' +
              '<a class="v2-btn v2-btn-ghost" href="tel:0249625055">Être rappelé</a>' +
            '</div>' +
          '</div>' +
          (u.email ? '<div class="pres-contact-c" style="text-align:center;font-family:var(--mono);font-size:13px;color:var(--muted);margin-top:10px"><a href="mailto:' + esc(u.email) + '" style="color:var(--ip-blue);text-decoration:none">' + esc(u.email) + '</a></div>' : '') +
          '<div style="text-align:center;font-size:12px;color:var(--muted);margin-top:10px">Ouest Pharma Services · Saint-Étienne-de-Montluc (44) — Service client 02 49 62 50 55 · serviceclient@ouestpharmaservices.fr</div>' +

          '<div class="pres-send noprint">' +
            '<div class="pres-send-t">' + ICO('spark', 16) + ' Envoyer le kit à un prospect</div>' +
            '<div class="pres-send-d">Après ta visite : saisis l\'email de la pharmacie → on lui envoie un lien (qui on est, comment ouvrir un compte, ce qu\'elle gagne, tarifs, top ventes par catégorie). Le lien est déjà à ton nom.</div>' +
            '<div class="pres-send-row">' +
              '<input id="prospect-mail" type="email" inputmode="email" placeholder="email de la pharmacie" class="pres-send-in" />' +
              '<button class="v2-btn v2-btn-primary" onclick="V2.prospectEmail()">' + ICO('fiche', 16) + 'Préparer l\'email</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.prospectCopy()">Copier le lien</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.prospectOpen()">Aperçu</button>' +
            '</div>' +
          '</div>' +

          '<div style="text-align:center;font-size:11px;color:var(--muted-2);margin-top:18px" class="noprint">Document commercial Intégral Pharma — sous réserve des conditions générales.</div>' +
          '<div style="height:30px"></div>' +
        '</div>';
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
      '.v2-home-x .v2-hero::before{content:"";position:absolute;left:50%;top:-30px;width:min(620px,86%);height:210px;transform:translateX(-50%);pointer-events:none;z-index:-1;background:radial-gradient(60% 100% at 30% 0%,color-mix(in srgb,var(--ip-blue) 11%,transparent),transparent 70%),radial-gradient(55% 100% at 78% 10%,color-mix(in srgb,var(--c-pilo) 9%,transparent),transparent 72%);filter:blur(6px)}',
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
      '.v2-home-x .v2-hero-sub b{color:var(--ink);font-weight:600}',
      '.v2-home-x .v2-search{height:62px;border-radius:16px}',
      '.v2-home-x .v2-search input{font-size:16px}',
      '.v2-home-x .v2-recent{justify-content:center}',
      '.v2-home-x .v2-lch-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:10px}',
      '@media(max-width:640px){.v2-home-x .v2-lch-grid{grid-template-columns:1fr;gap:12px}}',
      '.v2-home-x .v2-lch-card{position:relative;display:flex;flex-direction:column;gap:42px;min-height:150px;padding:24px 22px;background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--line);border-radius:var(--r-lg,20px);text-decoration:none;color:var(--ink);cursor:pointer;overflow:hidden;transition:transform .28s var(--mo-ease-soft),box-shadow .28s var(--mo-ease-soft),border-color .28s var(--mo-ease-soft)}',
      '.v2-home-x .v2-lch-card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s var(--mo-ease-soft);background:radial-gradient(260px circle at var(--mx,50%) var(--my,0%),color-mix(in srgb,var(--accent) 14%,transparent),transparent 62%)}',
      '.v2-home-x .v2-lch-card:hover{transform:translateY(-4px);box-shadow:var(--sh-2,0 18px 42px rgba(16,24,43,.10));border-color:color-mix(in srgb,var(--accent) 30%,var(--line))}',
      '.v2-home-x .v2-lch-card:hover::after{opacity:1}',
      '.v2-home-x .v2-lch-ico{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 16%,var(--card)),color-mix(in srgb,var(--accent) 6%,var(--card)));color:var(--accent);box-shadow:0 1px 0 rgba(255,255,255,.7) inset}',
      '.v2-home-x .v2-lch-arrow{position:absolute;top:24px;right:22px;color:var(--muted-2,#98a1b4);font-size:19px;font-weight:700;line-height:1;transition:transform .28s var(--mo-ease-soft),color .28s}',
      '.v2-home-x .v2-lch-card:hover .v2-lch-arrow{transform:translateX(3px);color:var(--accent)}',
      '.v2-home-x .v2-lch-meta{display:flex;flex-direction:column;gap:4px}',
      '.v2-home-x .v2-lch-t{font-size:18px;font-weight:700;letter-spacing:-.01em}',
      '.v2-home-x .v2-lch-d{font-size:13.5px;color:var(--muted);line-height:1.35}',
      '.v2-home-x .v2-lch-more{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:24px;padding-top:18px;border-top:1px solid var(--line)}',
      '.v2-home-x .v2-lch-more .lbl{font-size:12.5px;color:var(--muted);margin-right:4px;font-weight:600}',
      '.v2-home-x .v2-lch-mini{display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);color:var(--ink);font-size:13px;font-weight:500;text-decoration:none;cursor:pointer;transition:border-color .2s,transform .2s,box-shadow .2s}',
      '.v2-home-x .v2-lch-mini svg{color:var(--muted-2,#98a1b4);width:15px;height:15px;flex-shrink:0}',
      '.v2-home-x .v2-lch-mini:hover{border-color:color-mix(in srgb,var(--ip-blue) 40%,var(--line));transform:translateY(-1px);box-shadow:var(--sh-1)}',
      '.v2-home-x .v2-lch-card,.v2-home-x .v2-lch-more{animation:v2homeIn .5s var(--mo-ease-in) both}',
      '.v2-home-x .v2-lch-card:nth-of-type(1){animation-delay:.10s}.v2-home-x .v2-lch-card:nth-of-type(2){animation-delay:.14s}.v2-home-x .v2-lch-card:nth-of-type(3){animation-delay:.18s}.v2-home-x .v2-lch-card:nth-of-type(4){animation-delay:.22s}.v2-home-x .v2-lch-more{animation-delay:.28s}',
      '@media(prefers-reduced-motion:reduce){.v2-home-x .v2-lch-card,.v2-home-x .v2-lch-more{animation:none}.v2-home-x .v2-lch-card,.v2-home-x .v2-lch-arrow{transition:none}.v2-home-x .v2-lch-card::after{display:none}}',
      // ─── Carte vedette « Copilote » (pleine largeur, en tête de l\'accueil)
      '.v2-home-x .v2-lch-feat{position:relative;display:flex;align-items:center;gap:18px;padding:22px 24px;margin-bottom:16px;border-radius:var(--r-lg,20px);text-decoration:none;color:#fff;cursor:pointer;overflow:hidden;background:linear-gradient(120deg,var(--ip-blue),#0034A0);box-shadow:0 14px 34px color-mix(in srgb,var(--ip-blue) 30%,transparent);transition:transform .28s var(--mo-ease-soft),box-shadow .28s var(--mo-ease-soft);animation:v2homeIn .5s var(--mo-ease-in) both}',
      '.v2-home-x .v2-lch-feat::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(320px circle at var(--mx,80%) var(--my,0%),rgba(255,255,255,.18),transparent 60%)}',
      '.v2-home-x .v2-lch-feat:hover{transform:translateY(-3px);box-shadow:0 20px 46px color-mix(in srgb,var(--ip-blue) 38%,transparent)}',
      '.v2-home-x .v2-lch-feat-ic{flex:none;width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.16);color:#fff}',
      '.v2-home-x .v2-lch-feat-main{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;position:relative}',
      '.v2-home-x .v2-lch-feat-tag{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.82)}',
      '.v2-home-x .v2-lch-feat-t{font-size:19px;font-weight:800;letter-spacing:-.01em}',
      '.v2-home-x .v2-lch-feat-d{font-size:13.5px;color:rgba(255,255,255,.86);line-height:1.4}',
      '.v2-home-x .v2-lch-feat .v2-lch-arrow{position:static;color:rgba(255,255,255,.9);font-size:22px;flex:none}',
      '@media(prefers-reduced-motion:reduce){.v2-home-x .v2-lch-feat{animation:none;transition:none}}'
    ].join('');
    document.head.appendChild(st);
  }
  // Spotlight : la souris met à jour --mx/--my sur la tuile survolée
  V2.homeSpot = function (e, el) {
    try {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    } catch (err) {}
  };

  V2.pages.home = {
    render: function (root) {
      injectHomeStyles();
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
        { k: 'pharma', cls: 'p1', ico: 'opp', tag: 'RDV', t: 'Officines', d: 'Arrive sur une officine et vois direct quoi proposer : ses best, ce qu\'elle ne commande pas, son audit marge — classé par catégorie et tranche de prix.', go: 'Choisir une pharmacie' },
        { k: 'fiches', cls: 'p2', ico: 'fiche', tag: 'PDF', t: 'Fiches commerciales', d: 'Crée une fiche produit sur-mesure et sors-la en PDF à montrer ou envoyer au pharmacien pendant le rendez-vous.', go: 'Créer une fiche' },
        { k: 'catalogue', cls: 'p3', ico: 'cat', tag: (window.BENCHMARK ? V2.fmtNum(window.BENCHMARK.length) : '10 500'), t: 'Catalogue grossiste', d: 'Tout le catalogue médicaments IP par tranches de prix et familles AFMCODE, avec ton volume et le marché Ameli.', go: 'Explorer le catalogue' },
        { k: 'offilog', cls: 'p5', accent: 'var(--c-froid)', ico: 'spark', tag: 'Veille', t: 'Offilog & concurrents', d: 'Ta parapharma : ton prix d\'achat IP comparé en direct aux prix publics E.Leclerc, Drakkars et Cap3000. Repère où un concurrent casse les prix.', go: 'Ouvrir Offilog' },
        { k: 'pilotage', cls: 'p4', ico: 'pilo', tag: V2.fmtK(caTotal) + ' €', t: 'Pilotage', d: 'Ton chiffre d\'affaires, ta marge MDL, tes objectifs et qui commande quoi. Le tableau de bord de ta tournée.', go: 'Voir mon pilotage' },
      ];
      // Infos du matin (brief quotidien) — app JARVIS
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.infos) {
        P.push({ k: 'infos', cls: 'p6', accent: 'var(--c-amber)', ico: 'spark', tag: 'Quotidien', t: 'Infos du matin', d: 'La veille du jour : ruptures ANSM, sécurité, réglementaire et actu officine — avec ton alternative IP pour chaque molécule en tension.', go: 'Voir la veille' });
      }
      // Copilote — hub global (croise marché France × ventes réseau) — app JARVIS
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.copilote) {
        P.push({ k: 'copilote', cls: 'p1', accent: 'var(--ip-blue)', ico: 'spark', tag: 'Nouveau', t: 'Copilote', d: 'Le cerveau de ta tournée : croise le marché réel France avec tes ventes réseau pour repérer où pousser quoi.', go: 'Ouvrir le Copilote' });
      }
      // Pilier Molécules (analyse réseau : rotation + marge pharmacien) — app JARVIS
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.molecules) {
        P.push({ k: 'molecules', cls: 'p3', accent: '#7C3AED', ico: 'cat', tag: 'Réseau', t: 'Par molécule', d: 'Ce qu\'une pharmacie moyenne fait sur chaque molécule : rotation, marge pharmacien et ta remise. Pour chiffrer ce que ça rapporte au comptoir.', go: 'Voir les molécules' });
      }
      // Audit Marge (abandon de marge par pharmacie) — app JARVIS
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.audit) {
        P.push({ k: 'audit', cls: 'p4', accent: '#10915E', ico: 'pilo', tag: 'Par pharmacie', t: 'Audit marge', d: 'Ce qu\'Intégral rend à chaque pharmacie via l\'abandon de marge — par tranche, vs son grossiste actuel, calculé sur ses vrais achats. Un audit offert, prêt en PDF.', go: 'Ouvrir l\'audit' });
      }
      // Pilier marketing : uniquement en mode OPSO (module v2-marketing chargé)
      if (window.V2_BRAND && window.V2_BRAND.opso && V2.pages.marketing) {
        P.splice(2, 0, { k: 'marketing', cls: 'p2', ico: 'fiche', tag: 'A4', t: 'Fiches marketing OPSO', d: 'Crée une sélection de produits négociée par Intégral Pharma, en charte Normandie Pharma, prête à imprimer pour tes adhérents.', go: 'Créer une sélection' });
      } else if (V2.pages.marketing) {
        // App JARVIS : espace Marketing de Pauline & Will (supports + sélections à pousser)
        P.splice(2, 0, { k: 'marketing', cls: 'p6', accent: '#E0556E', ico: 'spark', tag: 'Pauline & Will', t: 'Marketing', d: 'Fabriquez vos supports (flyers produits avec photos et prix) et vos sélections à pousser aux pharmacies. À deux, au même endroit.', go: 'Ouvrir le marketing' });
      }
      // Espace Groupements : cartographie + grossistes + onglet « Opportunités groupements » (génération PDF)
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.groupements) {
        P.push({ k: 'groupements', cls: 'p7', accent: '#0034A0', ico: 'grid', tag: 'Carte + listes', t: 'Groupements', d: 'La cartographie de prospection, les grossistes, et les opportunités par groupement (liste d\'achats à pousser en PDF) — réunis en onglets.', go: 'Ouvrir les groupements' });
      }
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
      function tile(p) {
        var nav = p.route ? ('V2.go(\'' + p.route.name + '\'' + (p.route.param ? ',\'' + p.route.param + '\'' : '') + ')') : ('V2.go(\'' + p.k + '\')');
        return '<a class="v2-pil ' + p.cls + '"' + (p.accent ? ' style="--accent:' + p.accent + '"' : '') + ' onmousemove="V2.homeSpot(event,this)" onclick="' + nav + '">' +
          '<div class="v2-pil-head"><div class="v2-pil-ico">' + ICO(p.ico, 26) + '</div><span class="v2-pil-num">' + p.tag + '</span></div>' +
          '<div class="v2-pil-t">' + p.t + '</div><div class="v2-pil-d">' + p.d + '</div>' +
          '<div class="v2-pil-go">' + p.go + ' <span class="arrow">→</span></div></a>';
      }
      // Accueil regroupé "par moment d'usage" (hors OPSO qui garde son ordre suivi-groupement)
      var pilHtml;
      if (window.V2_BRAND && window.V2_BRAND.opso) {
        pilHtml = '<div class="v2-piliers">' + P.map(tile).join('') + '</div>';
      } else {
        var pmap = {}; P.forEach(function (p) { pmap[p.k] = p; });
        // Libellés courts pour l'accueil ; les pages restent atteignables via ⌘K.
        if (pmap.molecules) { pmap.molecules.t = 'Catalogue & prix'; }
        if (pmap.presentation) { pmap.presentation.t = 'Présentation'; }
        if (pmap.offilog) { pmap.offilog.t = 'Concurrents'; }
        // ── Accueil « Launcher » (choix Will) : 4 grandes entrées, tout le reste en « Autres outils »
        var ESSENTIAL = ['pharma', 'molecules', 'marketing', 'infos'];
        var ACC = { pharma: 'var(--ip-blue)', molecules: 'var(--ip-blue)', marketing: '#F39A1B', infos: '#F39A1B' };
        var SUB = {
          pharma: 'Fiches, visites & suivi terrain',
          molecules: 'Tous les produits, prix & marge réseau',
          marketing: 'Supports & sélections à pousser',
          infos: 'Ruptures, actu & opportunités du jour'
        };
        var ICOK = { pharma: 'pharma', molecules: 'cat', marketing: 'fiche', infos: 'spark' };
        // catalogue grossiste médicaments replié · fiches retiré · audit fusionné dans la fiche pharmacie
        var used = { catalogue: 1, fiches: 1, audit: 1 };
        function bigCard(k) {
          var p = pmap[k]; if (!p) return ''; used[k] = 1;
          return '<a class="v2-lch-card" style="--accent:' + (ACC[k] || 'var(--ip-blue)') + '" onmousemove="V2.homeSpot(event,this)" onclick="V2.go(\'' + k + '\')">' +
            '<span class="v2-lch-ico">' + ICO(ICOK[k] || p.ico, 24) + '</span>' +
            '<span class="v2-lch-arrow">→</span>' +
            '<span class="v2-lch-meta"><span class="v2-lch-t">' + esc(p.t) + '</span><span class="v2-lch-d">' + (SUB[k] || '') + '</span></span></a>';
        }
        var big = ESSENTIAL.map(bigCard).filter(Boolean).join('');
        var featured = '';
        if (pmap.copilote) {
          used.copilote = 1;
          featured = '<a class="v2-lch-feat" onmousemove="V2.homeSpot(event,this)" onclick="V2.go(\'copilote\')">' +
            '<span class="v2-lch-feat-ic">' + ICO('spark', 26) + '</span>' +
            '<span class="v2-lch-feat-main"><span class="v2-lch-feat-tag">Nouveau · Copilote</span>' +
            '<span class="v2-lch-feat-t">Le cerveau de ta tournée</span>' +
            '<span class="v2-lch-feat-d">Le marché réel France croisé à tes ventes réseau — où pousser quoi, officine par officine.</span></span>' +
            '<span class="v2-lch-arrow">→</span></a>';
        }
        pilHtml = featured + '<div class="v2-lch-grid">' + big + '</div>';
        var rest = P.filter(function (p) { return !used[p.k]; });
        if (rest.length) {
          pilHtml += '<div class="v2-lch-more"><span class="lbl">Autres outils</span>' +
            rest.map(function (p) { return '<a class="v2-lch-mini" onclick="V2.go(\'' + p.k + '\')">' + ICO(p.ico, 15) + esc(p.t) + '</a>'; }).join('') +
            '</div>';
        }
      }

      var firstName = (V2.user && V2.user.name ? V2.user.name.split(' ')[0] : 'Will');

      root.innerHTML = topbar() +
        '<div class="v2-wrap narrow v2-home-x">' +
          '<div class="v2-hero">' +
            '<h1>Bonjour <span class="ac">' + esc(firstName) + '</span></h1>' +
            '<p class="v2-hero-sub">' + cap(today) + ' · <b>' + nbPharma + '</b> officines actives</p>' +
          '</div>' +
          '<div class="v2-search" onclick="V2.onTopSearch()"><span class="srch-ic">' + ICO('search', 18, 2) + '</span>' +
            '<input readonly placeholder="Cherche une pharmacie, un produit…" style="cursor:pointer"><kbd>' + MOD + 'K</kbd></div>' +
          '<div class="v2-recent">' + recentHtml + '</div>' +
          pilHtml +
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
    var PAGES = [['home', 'Accueil', 'opp'], ['pharma', 'Opportunités pharmacie', 'opp'], ['offilog', 'Grossistes concurrents', 'spark'], ['pilotage', 'Pilotage CA & marge', 'pilo']];
    if (window.V2_BRAND && window.V2_BRAND.opso) PAGES.splice(2, 0, ['fiches', 'Fiches commerciales', 'fiche']); // OPSO garde les fiches
    if (window.V2_BRAND && window.V2_BRAND.opso && V2.pages.marketing) PAGES.splice(2, 0, ['marketing', 'Fiches marketing OPSO', 'fiche']);
    else if (V2.pages.marketing) PAGES.splice(2, 0, ['marketing', 'Marketing', 'spark']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.copilote) PAGES.splice(1, 0, ['copilote', 'Copilote (marché & opportunités)', 'spark']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.infos) PAGES.splice(1, 0, ['infos', 'Infos du matin', 'spark']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.molecules) PAGES.splice(3, 0, ['molecules', 'Catalogue & prix (par produit)', 'cat']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.audit) PAGES.push(['audit', 'Audit Marge (par pharmacie)', 'pilo']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.presentation) PAGES.push(['presentation', 'Présentation Intégral Pharma', 'pharma']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.groupements) PAGES.push(['groupements', 'Groupements (carte)', 'grid']);
    PAGES.forEach(function (p) { idx.push({ grp: 'Pages', label: p[1], ico: p[2], action: function () { V2.go(p[0]); } }); });
    // Pharmacies
    (V2.pharmacies || []).forEach(function (p) {
      idx.push({ grp: 'Pharmacies', label: p.name, ico: 'pharma', meta: '', action: function () { V2.go('pharma', p.id); } });
    });
    // Produits (top 300 PROD_STATS par rotation) — ouvre « Par produit » filtré sur le produit
    var PS = window.PROD_STATS || [];
    PS.slice(0, 300).forEach(function (r) {
      idx.push({ grp: 'Produits', label: r.d, ico: 'pill', meta: r.c, action: function () { V2.go('molecules', r.c); } });
    });
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
    injectShellStyles();
    // Login = scène marque : la lumière neutre/info (bleu marque) pour le halo signature.
    try { document.documentElement.style.setProperty('--accent', 'var(--info)'); } catch (e) {}
    root.innerHTML = '<div class="v2-login"><div class="v2-login-card">' +
      '<div class="v2-login-logo">' + ICO('logo', 30) + '</div>' +
      '<h1>' + ((window.V2_BRAND && window.V2_BRAND.name) || 'Intégral Pharma') + '</h1>' +
      '<p>' + ((window.V2_BRAND && window.V2_BRAND.sub) || 'Espace commercial · CRM') + '</p>' +
      '<div class="v2-login-spark" aria-hidden="true"></div>' +
      '<div class="v2-login-fields">' +
        '<input class="v2-field" id="v2-email" type="email" inputmode="email" aria-label="Adresse email" placeholder="Email" autocomplete="username">' +
        '<div style="position:relative">' +
          '<input class="v2-field" id="v2-pass" type="password" aria-label="Mot de passe" placeholder="Mot de passe" autocomplete="current-password" style="padding-right:82px">' +
          '<button type="button" id="v2-eye" aria-label="Afficher le mot de passe" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;color:var(--muted);font:600 12.5px/1 inherit;cursor:pointer;padding:10px">Afficher</button>' +
        '</div>' +
        '<button class="v2-btn v2-btn-primary" id="v2-login-btn">Se connecter</button>' +
        '<div class="v2-login-err" id="v2-login-err" role="alert"></div>' +
      '</div>' +
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
    btn.onclick = submit;
    document.getElementById('v2-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    var eye = document.getElementById('v2-eye');
    if (eye) eye.onclick = function () { var p = document.getElementById('v2-pass'); var show = p.type === 'password'; p.type = show ? 'text' : 'password'; this.textContent = show ? 'Masquer' : 'Afficher'; this.setAttribute('aria-label', (show ? 'Masquer' : 'Afficher') + ' le mot de passe'); };
    document.getElementById('v2-email').focus();
  };

  // démarrage
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(V2.boot, 60); });
  else setTimeout(V2.boot, 60);
})();
