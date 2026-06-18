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
    return '' +
      '<div class="v2-top">' +
        (back ||
         '<a class="v2-brand" onclick="V2.go(\'home\')"><span class="v2-logo">' + ICO('logo', 22) + '</span>' +
         '<span><span class="v2-brand-t">' + ((window.V2_BRAND && window.V2_BRAND.name) || 'Intégral Pharma') + '</span><br><span class="v2-brand-s">' + ((window.V2_BRAND && window.V2_BRAND.sub) || 'Espace commercial') + '</span></span></a>') +
        '<div class="v2-top-search" onclick="V2.onTopSearch()">' + ICO('search', 15, 2) + 'Rechercher<kbd>' + MOD + 'K</kbd></div>' +
        '<div class="v2-av" title="' + (V2.user ? V2.user.name : '') + '" onclick="V2.userMenu()">' + initials + '</div>' +
      '</div>';
  }
  V2.topbar = topbar;

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
    groupements: 'var(--pil-fiche)'
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
      '.pres-hero{position:relative;text-align:center;padding:40px 24px 30px;border-radius:var(--r-card);overflow:hidden;background:linear-gradient(160deg,#0050E6,#0034A0);color:#fff;box-shadow:0 18px 40px rgba(0,52,160,.32)}',
      '.pres-logo{width:64px;height:64px;border-radius:18px;margin:0 auto 16px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 0 rgba(255,255,255,.25) inset}',
      '.pres-h1{font-size:30px;font-weight:900;letter-spacing:-.03em;line-height:1.05}',
      '.pres-tag{font-size:15px;font-weight:600;opacity:.92;margin-top:10px;max-width:560px;margin-left:auto;margin-right:auto;line-height:1.45}',
      '.pres-kpis{display:flex;justify-content:center;gap:30px;margin-top:24px;flex-wrap:wrap}',
      '.pres-kpi-v{font-family:var(--mono);font-size:24px;font-weight:700;letter-spacing:-.02em}',
      '.pres-kpi-l{font-size:11.5px;opacity:.85;font-weight:600;margin-top:2px}',
      '.pres-sec-t{font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:var(--muted);margin:30px 2px 14px;display:flex;align-items:center;gap:10px}',
      '.pres-sec-t::after{content:"";flex:1;height:1px;background:var(--line)}',
      '.pres-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}',
      '@media(max-width:720px){.pres-grid{grid-template-columns:1fr}}',
      '.pres-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);padding:20px 22px}',
      '.pres-card-ic{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;margin-bottom:13px}',
      '.pres-card-t{font-size:16px;font-weight:800;letter-spacing:-.01em;margin-bottom:6px}',
      '.pres-card-d{font-size:13.5px;color:var(--ip-ink-2);line-height:1.5}',
      '.pres-step{display:flex;gap:15px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line)}',
      '.pres-step:last-child{border-bottom:none}',
      '.pres-step-n{width:30px;height:30px;border-radius:50%;background:var(--halo);color:var(--ip-blue);font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--mono)}',
      '.pres-step-t{font-weight:700;font-size:14.5px}',
      '.pres-step-d{font-size:13px;color:var(--muted);margin-top:2px}',
      '.pres-contact{display:flex;align-items:center;gap:16px;background:var(--ip-ink);color:#fff;border-radius:var(--r-card);padding:20px 24px;flex-wrap:wrap}',
      '.pres-contact-n{font-size:17px;font-weight:800}',
      '.pres-contact-r{font-size:13px;opacity:.85;margin-top:2px}',
      '.pres-contact-c{margin-left:auto;text-align:right;font-family:var(--mono);font-size:13.5px;line-height:1.7}',
      '.pres-contact-c a{color:#fff;text-decoration:none}',
      '.pres-send{margin-top:18px;background:color-mix(in srgb,var(--ip-blue) 5%,#fff);border:1px solid color-mix(in srgb,var(--ip-blue) 20%,var(--line));border-radius:var(--r-card);padding:18px 20px}',
      '.pres-send-t{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:-.01em}',
      '.pres-send-t svg{color:var(--ip-blue)}',
      '.pres-send-d{font-size:13px;color:var(--ip-ink-2);margin:6px 0 12px;line-height:1.5}',
      '.pres-send-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.pres-send-in{flex:1;min-width:200px;border:1px solid var(--line);border-radius:var(--r-control);padding:10px 13px;font-family:var(--font);font-size:14px;background:#fff}'
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
        if (b.offre_ip > 0 && (!(b.prix_ip > 0) || b.offre_ip < b.prix_ip)) nbOffre++;
        if (b.is_froid) nbFroid++;
        if (b.artnature === 'generique' || b.artnature === 'generique_partenaire') nbGx++;
        else if (b.artnature === 'biosimilaire') nbBio++;
      });
      var nbPara = (window.OFFILOG && window.OFFILOG.length) || (window.OFFILOG_BEST && window.OFFILOG_BEST.length) || 3520;
      var nbRef = nf(nbRefN);
      var logoSvg = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
      var u = V2.user || {};
      var card = function (color, ico, t, d) {
        return '<div class="pres-card"><div class="pres-card-ic" style="background:' + color + '">' + ICO(ico, 22) + '</div>' +
          '<div class="pres-card-t">' + t + '</div><div class="pres-card-d">' + d + '</div></div>';
      };
      var step = function (n, t, d) {
        return '<div class="pres-step"><div class="pres-step-n">' + n + '</div><div><div class="pres-step-t">' + t + '</div><div class="pres-step-d">' + d + '</div></div></div>';
      };
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' +
          '<div class="pres-hero">' +
            '<div class="pres-logo">' + logoSvg + '</div>' +
            '<div class="pres-h1">Intégral Pharma</div>' +
            '<div class="pres-tag">Votre grossiste-répartiteur partenaire : un large catalogue, des prix négociés et un accompagnement humain pour faire grandir votre officine.</div>' +
            '<div class="pres-kpis">' +
              '<div><div class="pres-kpi-v">' + nbRef + '</div><div class="pres-kpi-l">médicaments au catalogue</div></div>' +
              '<div><div class="pres-kpi-v">' + nf(nbPara) + '</div><div class="pres-kpi-l">références parapharmacie</div></div>' +
              '<div><div class="pres-kpi-v">' + nf(nbOffre) + '</div><div class="pres-kpi-l">offres labo en ce moment</div></div>' +
            '</div>' +
          '</div>' +

          '<div class="pres-send">' +
            '<div class="pres-send-t">' + ICO('spark', 16) + ' Envoyer le kit à un prospect</div>' +
            '<div class="pres-send-d">Après ta visite : saisis l\'email de la pharmacie → on lui envoie un lien (qui on est, comment ouvrir un compte, ce qu\'elle gagne, tarifs, top ventes par catégorie). Le lien est déjà à ton nom.</div>' +
            '<div class="pres-send-row">' +
              '<input id="prospect-mail" type="email" inputmode="email" placeholder="email de la pharmacie" class="pres-send-in" />' +
              '<button class="v2-btn v2-btn-primary" onclick="V2.prospectEmail()">' + ICO('fiche', 16) + 'Préparer l\'email</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.prospectCopy()">Copier le lien</button>' +
              '<button class="v2-btn v2-btn-ghost" onclick="V2.prospectOpen()">Aperçu</button>' +
            '</div>' +
          '</div>' +

          '<div class="pres-sec-t">Pourquoi travailler avec nous</div>' +
          '<div class="pres-grid">' +
            card('var(--c-cat)', 'cat', 'Un catalogue complet', nf(nbRefN) + ' médicaments + ' + nf(nbPara) + ' références de parapharmacie : princeps, génériques, biosimilaires et chaîne du froid — du petit prix au produit le plus cher. Un seul partenaire pour tout commander.') +
            card('var(--c-opp)', 'spark', 'Des prix négociés & offres labo', 'En ce moment, ' + nf(nbOffre) + ' produits bénéficient d\'une offre laboratoire (Sanofi, UPSA…). Sur un remboursable à marge réglementée, chaque centime gratté à l\'achat tombe à 100 % dans votre poche.') +
            card('var(--c-froid)', 'spark', 'Le comparateur de prix intégré', 'On compare en direct votre prix d\'achat aux prix publics concurrents (E.Leclerc, Drakkars, Cap3000) et aux portails pro. Vous savez toujours si vous êtes au bon prix — la transparence, pas la promesse.') +
            card('var(--c-pilo)', 'pilo', 'Un accompagnement chiffré', 'Votre commercial vient avec VOS chiffres : ce que commandent les officines comparables, vos opportunités de marge par catégorie, et une commande déjà préparée. Des données, pas du blabla.') +
          '</div>' +

          '<div class="pres-sec-t">Ce que ça change pour votre marge</div>' +
          '<div class="pres-card">' +
            '<div class="pres-card-d" style="font-size:14px">' +
              '<b>Remboursables :</b> la marge est réglementée (barème MDL), donc tout se joue sur le <b>prix d\'achat</b>. Nos offres labo le font baisser → votre marge monte, mécaniquement.<br><br>' +
              '<b>Non remboursables & parapharma :</b> marge libre. On vous positionne au <b>bon prix face à la concurrence</b> (comparateur intégré) pour défendre votre marge sans perdre la vente.<br><br>' +
              '<b>Gamme large = un seul fournisseur :</b> moins de commandes éclatées, moins de frais, des conditions globales meilleures.' +
            '</div>' +
          '</div>' +

          '<div class="pres-sec-t">Comment on démarre ensemble</div>' +
          '<div class="pres-card" style="padding:6px 22px">' +
            step('1', 'On fait connaissance', 'Un rendez-vous pour comprendre votre officine, vos volumes et vos priorités.') +
            step('2', 'On vous fait une proposition', 'Conditions commerciales et sélection de produits adaptées à votre activité, chiffrées et transparentes.') +
            step('3', 'Vous testez sans engagement', 'Une première commande pour juger sur pièce : prix, délais, service.') +
            step('4', 'On vous suit dans la durée', 'Visites régulières, offres du moment et optimisation continue de votre marge.') +
          '</div>' +

          '<div class="pres-sec-t">Votre contact</div>' +
          '<div class="pres-contact">' +
            '<div class="pres-logo" style="width:46px;height:46px;border-radius:13px;margin:0;background:linear-gradient(150deg,#0050E6,#0034A0)"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div>' +
            '<div><div class="pres-contact-n">' + esc(u.name || 'Votre commercial Intégral Pharma') + '</div>' +
              '<div class="pres-contact-r">Intégral Pharma · votre interlocuteur dédié</div></div>' +
            '<div class="pres-contact-c">' + (u.email ? '<a href="mailto:' + esc(u.email) + '">' + esc(u.email) + '</a>' : 'Intégral Pharma') + '</div>' +
          '</div>' +
          '<div style="height:30px"></div>' +
        '</div>';
    }
  };

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
      // Pilier marketing : uniquement en mode OPSO (module v2-marketing chargé)
      if (window.V2_BRAND && window.V2_BRAND.opso && V2.pages.marketing) {
        P.splice(2, 0, { k: 'marketing', cls: 'p2', ico: 'fiche', tag: 'A4', t: 'Fiches marketing OPSO', d: 'Crée une sélection de produits négociée par Intégral Pharma, en charte Normandie Pharma, prête à imprimer pour tes adhérents.', go: 'Créer une sélection' });
      } else if (V2.pages.marketing) {
        // App JARVIS : espace Marketing de Pauline & Will (supports + sélections à pousser)
        P.splice(2, 0, { k: 'marketing', cls: 'p6', accent: '#E0556E', ico: 'spark', tag: 'Pauline & Will', t: 'Marketing', d: 'Fabriquez vos supports (flyers produits avec photos et prix) et vos sélections à pousser aux pharmacies. À deux, au même endroit.', go: 'Ouvrir le marketing' });
      }
      // Pilier Groupements (carte de prospection) si présent
      if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.groupements) {
        P.push({ k: 'groupements', cls: 'p7', accent: '#0034A0', ico: 'grid', tag: 'Carte', t: 'Groupements', d: 'La carte de prospection des groupements et pharmacies : qui est où, quel groupement, quels décideurs. Pour préparer ta tournée.', go: 'Ouvrir la carte' });
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
          '<div class="v2-search" onclick="V2.onTopSearch()">' + ICO('search', 24, 2) +
            '<input readonly placeholder="Pharmacie, produit, page…" style="cursor:pointer"><kbd>' + MOD + 'K</kbd></div>' +
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
    var PAGES = [['home', 'Accueil', 'opp'], ['pharma', 'Opportunités pharmacie', 'opp'], ['fiches', 'Fiches commerciales', 'fiche'], ['catalogue', 'Catalogue grossiste', 'cat'], ['offilog', 'Offilog & concurrents', 'spark'], ['pilotage', 'Pilotage CA & marge', 'pilo']];
    if (window.V2_BRAND && window.V2_BRAND.opso && V2.pages.marketing) PAGES.splice(2, 0, ['marketing', 'Fiches marketing OPSO', 'fiche']);
    else if (V2.pages.marketing) PAGES.splice(2, 0, ['marketing', 'Marketing', 'spark']);
    if (!(window.V2_BRAND && window.V2_BRAND.opso) && V2.pages.groupements) PAGES.push(['groupements', 'Groupements (carte)', 'grid']);
    PAGES.forEach(function (p) { idx.push({ grp: 'Pages', label: p[1], ico: p[2], action: function () { V2.go(p[0]); } }); });
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
    var css =
      // (2) Wordmark signature : la baseline banale devient marque-outil mono.
      '.v2-brand-s{font-family:var(--mono);text-transform:uppercase;letter-spacing:.12em;' +
        'font-size:9.5px;font-weight:500;color:var(--muted);line-height:1}' +
      '@media(max-width:640px){.v2-brand-s{font-size:9px;letter-spacing:.1em}}' +
      // Liseré 3px de tête sur la topbar : seule grammaire d'appartenance,
      // teinté par la lumière du pilier courant (var(--accent)).
      '.v2-top{position:relative}' +
      '.v2-top::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;' +
        'background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 34%,transparent),transparent 60%);' +
        'pointer-events:none}' +
      // Pastille recherche topbar : cible tactile terrain >= --tap-min sous mobile,
      // sans grossir le glyphe (la hit-area s\'étend, l\'icône reste).
      '@media(max-width:640px){.v2-top-search{min-width:var(--tap-min);min-height:var(--tap-min);' +
        'justify-content:center}}' +
      // (3) LOGIN — manifeste de marque. Halo signature + baseline mono.
      '.v2-login{overflow:hidden}' +
      '.v2-login::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;' +
        'background:radial-gradient(ellipse 70% 55% at 50% 0%,' +
        'color-mix(in srgb,var(--info) 14%,var(--halo)),transparent 62%)}' +
      '.v2-login-card{position:relative;z-index:1}' +
      // Le monogramme arrive en mo-pop (settle spring réservé aux accents) ;
      // l\'icône glisse sur la courbe d\'entrée canonique, jamais clinquant.
      '.v2-login-logo{animation:v2-login-mono var(--mo-dur,300ms) var(--mo-ease-in,cubic-bezier(.32,.72,0,1)) both}' +
      '@keyframes v2-login-mono{from{opacity:0;transform:translateY(6px) scale(.92)}to{opacity:1;transform:none}}' +
      // Baseline login en mono uppercase = même voix que le wordmark topbar.
      '.v2-login p{font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;font-size:10.5px}' +
      '@media (prefers-reduced-motion:reduce){.v2-login-logo{animation:none}}';
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
    root.innerHTML = '<div class="v2-login"><div class="v2-login-card mo-pop">' +
      '<div class="v2-login-logo">' + ICO('logo', 30) + '</div>' +
      '<h1>' + ((window.V2_BRAND && window.V2_BRAND.name) || 'Intégral Pharma') + '</h1><p>' + ((window.V2_BRAND && window.V2_BRAND.sub) || 'Espace commercial · CRM') + '</p>' +
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
      }).catch(function () {
        err.textContent = 'Connexion impossible — vérifie ta connexion internet.';
        btn.textContent = 'Se connecter'; btn.disabled = false;
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
