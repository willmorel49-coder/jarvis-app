/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Espace Marketing — « LE BUREAU » (22/09/2026)
   Choix de Will parmi les trois organisations proposées (marketing-trois-
   logiques.vercel.app) : une pièce, quatre portes égales — Supports
   officine, Documents partagés, Le nouveau site, LinkedIn — plus une
   rangée de repères (Catalogue & prix, Veille secteur, Assistant
   stratégie). Consigne de Will : LinkedIn ne doit plus occuper tout
   l'espace ; rien d'important cachée dans un menu.

   Cet écran ne stocke rien et n'écrit rien lui-même :
   - les fiches viennent de v2-mkt.js (V2.mkt.fichesRecentes, .fichesResume) ;
   - les documents viennent de v2-mkt.js (V2.mkt.docsRecents, .docsNb) ;
   - le post de la semaine et ses chiffres viennent de v2-mkt-li-plan.js
     (V2.lip.pret, .lecture, .apercu) — même lecture que v2-mkt-semaine.js ;
   - jetons, élévations, boutons, squelette, gestes : v2-mkt-socle.js (.mk-espace).
   Un seul accent, le bleu. On n'anime que transform et opacity.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  function S() { return V2.mktSocle || {}; }
  function ic(n, s, w) { var x = S(); return x.ic ? x.ic(n, s, w) : ''; }

  var REPERES = [
    ['catalogues', 'Catalogue & prix', 'catalogue'],
    ['veille', 'Veille secteur', 'veille'],
    ['strategie', 'Assistant stratégie', 'strategie']
  ];

  /* ─────────────────────── CSS ─────────────────────── */
  function injectCss() {
    if (document.getElementById('v2-mkt-bureau-css')) return;
    var s = document.createElement('style'); s.id = 'v2-mkt-bureau-css';
    s.textContent = [
      '#v2-root .mkb{max-width:1320px;margin:0 auto;padding:32px 32px 64px}',
      '.mkb-tete{margin-bottom:24px}',
      '.mkb-h1{margin:0;font-size:var(--mk-s1);line-height:var(--mk-s1l);font-weight:700;letter-spacing:-.02em}',
      '.mkb-sous{margin:4px 0 0;color:var(--mk-attenue);max-width:64ch}',

      /* ── les quatre portes ── */
      '.mkb-portes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}',
      '.mkb-porte{display:flex;flex-direction:column;text-align:left;padding:8px;min-width:0;width:100%}',
      '.mkb-vitrine{position:relative;border-radius:var(--mk-r-vig);overflow:hidden;aspect-ratio:4/3;display:grid;place-items:center;',
      'background:radial-gradient(70% 60% at 22% 8%,#FFFFFF 0,rgba(255,255,255,0) 70%),linear-gradient(135deg,#EEF2FA 0,#E1E8F5 100%);',
      'box-shadow:0 1px 2px rgba(11,31,77,.08) inset,0 0 0 1px rgba(16,19,28,.05) inset}',
      '.mkb-vitrine::after{content:"";position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;background:linear-gradient(118deg,rgba(255,255,255,.55) 0,rgba(255,255,255,.12) 26%,transparent 26.3%)}',
      '.mkb-feuille{position:relative;height:78%;aspect-ratio:794/1123;display:block}',
      '.mkb-feuille svg{position:absolute;top:0;right:0;bottom:0;left:0;height:100%;width:100%;border-radius:3px;',
      'box-shadow:0 0 0 1px rgba(16,19,28,.10),2px 4px 4px rgba(11,31,77,.06),6px 16px 24px -8px rgba(11,31,77,.18),18px 40px 64px -24px rgba(11,31,77,.30)}',
      '.mkb-eventail{position:relative;height:72%;aspect-ratio:794/1123;display:block}',
      '.mkb-eventail .mkd-page,.mkb-eventail .mk-sq{position:absolute;top:0;left:0;height:100%;width:auto;aspect-ratio:794/1123;border-radius:3px;overflow:hidden;',
      'box-shadow:0 0 0 1px rgba(16,19,28,.10),2px 4px 4px rgba(11,31,77,.06),6px 16px 24px -8px rgba(11,31,77,.18),18px 40px 64px -24px rgba(11,31,77,.30)}',
      '.mkb-eventail .mkd-page:nth-child(1),.mkb-eventail .mk-sq:nth-child(1){transform:translate(-34%,8%) scale(.86)}',
      '.mkb-eventail .mkd-page:nth-child(3),.mkb-eventail .mk-sq:nth-child(3){transform:translate(34%,8%) scale(.86)}',
      '.mkb-eventail .mkd-page:nth-child(2),.mkb-eventail .mk-sq:nth-child(2){z-index:1}',
      '.mkb-ecran{position:relative;display:block;width:84%;border-radius:8px;overflow:hidden;background:#0A2A7A;',
      'box-shadow:0 0 0 1px rgba(16,19,28,.10),2px 4px 4px rgba(11,31,77,.06),6px 16px 24px -8px rgba(11,31,77,.18),18px 40px 64px -24px rgba(11,31,77,.30)}',
      '.mkb-ecran img{display:block;width:100%;height:auto}',
      '.mkb-couv-mini{position:relative;display:block;width:84%;border-radius:var(--mk-r-vig);overflow:hidden;box-shadow:0 0 0 1px rgba(16,19,28,.10)}',
      '.mkb-li-mini{position:absolute;top:50%;left:50%;width:420px;max-width:none;transform:translate(-50%,-50%) scale(var(--mkb-k,.62));transform-origin:center;',
      'border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgba(16,19,28,.10),2px 4px 4px rgba(11,31,77,.06),6px 16px 24px -8px rgba(11,31,77,.18),18px 40px 64px -24px rgba(11,31,77,.30)}',
      '.mkb-li-mini .lpo-li{max-width:none;margin:0;pointer-events:none}',
      '.mkb-li-sq{width:84%;aspect-ratio:1200/628;border-radius:var(--mk-r-vig)}',
      /* la silhouette de secours (aucune fiche/document pour l’instant) : sans largeur propre, elle s’écrase dans la vitrine */
      '.mkb-vitrine .mk-silhouette{width:56%}',
      '.mkb-porte .mkb-nom{margin:16px 8px 0;display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.mkb-porte .mkb-nom strong{font-size:var(--mk-s2);line-height:var(--mk-s2l);font-weight:700;letter-spacing:-.01em}',
      '.mkb-porte .mkb-nom svg{color:var(--mk-attenue);flex:none;transition:transform var(--mk-t2) var(--mk-sortie),color var(--mk-t2) var(--mk-sortie)}',
      '@media (hover:hover){.mkb-porte:hover .mkb-nom svg{transform:translateX(3px);color:var(--mk-bleu-txt)}}',
      '.mkb-etat{margin:4px 8px 8px;font-size:var(--mk-s5);line-height:18px;color:var(--mk-attenue);font-weight:550}',
      '.mkb-etat b{color:var(--mk-encre);font-weight:700}',

      /* ── repères ── */
      '.mkb-reperes{margin-top:32px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:8px 16px;align-items:center}',
      '.mkb-reperes>.mkb-cap{grid-column:1/-1;margin-left:8px;display:block;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--mk-attenue)}',
      '.mkb-repere{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 12px 6px 8px;text-align:left;width:100%;min-width:0}',
      '.mkb-repere i{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:var(--mk-groupe);color:var(--mk-encre2);font-style:normal;flex:none}',
      '.mkb-repere .mkb-txt{flex:1;min-width:0}',
      '.mkb-repere .mkb-txt strong{display:block;font-size:var(--mk-s4);font-weight:650;line-height:20px}',
      '.mkb-repere .mkb-txt span{display:block;font-size:var(--mk-s5);color:var(--mk-attenue);font-weight:500;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mkb-repere>svg{color:var(--mk-attenue);flex:none}',
      '.mkb-ameliorer{justify-self:end}',

      /* ── « Le nouveau site » (renderSite) ── */
      '.mkb-site-carte{padding:0;overflow:hidden}',
      '.mkb-site-img{display:block;width:100%;height:auto;background:#0A2A7A}',
      '.mkb-site-actions{display:flex;flex-wrap:wrap;gap:12px;padding:20px 24px}',
      '.mkb-site-suite{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:24px}',
      '.mkb-tuile{min-width:0;display:block;text-align:left;cursor:pointer;padding:8px 8px 16px;width:100%}',
      '.mkb-tuile .mkb-vig{border-radius:var(--mk-r-vig);overflow:hidden;background:var(--mk-groupe);aspect-ratio:1.7;display:block;position:relative}',
      '.mkb-tuile .mkb-vig img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}',
      '.mkb-tuile .mkb-vig-fx{display:block;width:100%;height:100%}',
      '.mkb-tuile strong{display:block;margin:12px 8px 0;font-size:var(--mk-s3);font-weight:650;line-height:22px}',
      '.mkb-tuile span{display:block;margin:2px 8px 0;font-size:var(--mk-s5);color:var(--mk-attenue);font-weight:500}',

      '@media (max-width:1100px){.mkb-reperes{grid-template-columns:repeat(2,minmax(0,1fr))}.mkb-reperes>.mkb-cap{grid-column:1/-1}.mkb-ameliorer{grid-column:1/-1;justify-self:start}}',

      /* ═══ 390 px : une porte par ligne, plein écran ═══ */
      '@media (max-width:860px){',
      '#v2-root .mkb{padding:16px 16px 32px}',
      '.mkb-portes{grid-template-columns:minmax(0,1fr);gap:16px}',
      '.mkb-reperes{grid-template-columns:minmax(0,1fr);gap:4px}',
      '.mkb-reperes>.mkb-cap{margin-top:8px}',
      '.mkb-ameliorer{justify-self:start;margin-top:8px}',
      '.mkb-site-suite{grid-template-columns:minmax(0,1fr)}',
      '.mkb-site-actions{padding:16px}',
      '.mkb-li-mini{width:320px}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ─────────────── la fiche la plus récente : un petit dessin de page, jamais la feuille réelle ─────────────── */
  var uid = 0;
  function ficheSvg(f) {
    var acc = /^#6D4FC4$/i.test(f.accent || '') ? '#10131C' : (f.accent || '#0050E6');   // pas de violet sur cet écran
    var plier = S().plier || function (t) { return [t]; };
    var T = plier(f.titre || 'Sans titre', 24).slice(0, 2), id = 'mkbf' + (++uid), bande = f.tete === 'band';
    var h = '<svg viewBox="0 0 794 1123" role="img" aria-label="Fiche : ' + esc(f.titre || 'sans titre') + '"><rect width="794" height="1123" fill="#fff"/>';
    if (bande) {
      h += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs>' +
        '<rect width="794" height="330" fill="' + esc(acc) + '"/><rect width="794" height="330" fill="url(#' + id + ')"/><path d="M0 0h300L130 330H0z" fill="#fff" fill-opacity=".08"/>';
    } else {
      h += '<rect width="794" height="' + (f.tete === 'slim' ? 22 : 6) + '" fill="' + esc(acc) + '"/>';
    }
    h += '<text x="64" y="92" font-size="24" font-weight="700" letter-spacing="3" fill="' + (bande ? '#fff' : esc(acc)) + '" fill-opacity="' + (bande ? '.8' : '1') + '">INTÉGRAL PHARMA</text>';
    for (var i = 0; i < T.length; i++) h += '<text x="64" y="' + (168 + i * 60) + '" font-size="52" font-weight="800" letter-spacing="-1.2" fill="' + (bande ? '#fff' : '#10131C') + '">' + esc(T[i]) + '</text>';
    var n = Math.max(1, Math.min(f.nb || 3, 4)), y0 = 410;
    for (var k = 0; k < n; k++) {
      var y = y0 + k * 128;
      h += '<rect x="64" y="' + y + '" width="84" height="84" rx="10" fill="#EEF1F6"/><rect x="176" y="' + (y + 14) + '" width="' + (420 - (k % 3) * 60) + '" height="20" rx="10" fill="#10131C" fill-opacity=".82"/>' +
        '<rect x="176" y="' + (y + 52) + '" width="' + (260 + (k % 2) * 70) + '" height="14" rx="7" fill="#C9CFDB"/><rect x="64" y="' + (y + 106) + '" width="666" height="2" fill="#EEF1F6"/>';
    }
    return h + '<rect x="64" y="1068" width="220" height="10" rx="5" fill="#DCE2EE"/></svg>';
  }
  function silhouette() { return '<div class="mk-silhouette" aria-hidden="true"><i></i><i></i><i style="width:60%"></i></div>'; }

  /* ─────────────── porte « Supports officine » ─────────────── */
  function porteSupports() {
    var R = (V2.mkt && V2.mkt.fichesResume) ? V2.mkt.fichesResume() : { total: 0, aEnvoyer: 0, brouillons: 0, envoyees: 0 };
    var F = (V2.mkt && V2.mkt.fichesRecentes) ? V2.mkt.fichesRecentes(1) : [];
    var vit = (F && F.length) ? '<span class="mkb-feuille">' + ficheSvg(F[0]) + '</span>' : silhouette();
    var etat = R.total
      ? '<b>' + R.total + '</b> fiche' + (R.total > 1 ? 's' : '') + ' · <b>' + R.aEnvoyer + '</b> à envoyer · <b>' + R.brouillons + '</b> brouillon' + (R.brouillons > 1 ? 's' : '')
      : 'Aucune fiche pour l’instant';
    return { vit: vit, etat: etat };
  }

  /* ─────────────── porte « Documents partagés » ─────────────── */
  function porteDocuments() {
    var D = (V2.mkt && V2.mkt.docsRecents) ? V2.mkt.docsRecents(3) : [];
    var n = (V2.mkt && V2.mkt.docsNb) ? V2.mkt.docsNb() : null;
    var vit;
    if (D === null) {
      vit = '<span class="mkb-eventail">' + [0, 1, 2].map(function () { return '<span class="mk-sq" aria-hidden="true"></span>'; }).join('') + '</span>';
    } else if (D.length) {
      vit = '<span class="mkb-eventail">' + D.map(function (d) { return '<span class="mkd-page">' + d.pageHtml + '</span>'; }).join('') + '</span>';
    } else {
      vit = silhouette();
    }
    var etat = (n === null) ? '<i class="mk-sq" style="display:inline-block;width:140px;height:14px;border-radius:7px;vertical-align:middle"></i>'
      : (n ? '<b>' + n + '</b> document' + (n > 1 ? 's' : '') + ' partagé' + (n > 1 ? 's' : '') : 'Aucun document pour l’instant');
    return { vit: vit, etat: etat };
  }

  /* ─────────────── porte « Le nouveau site » ─────────────── */
  function porteSite() {
    var vit = '<span class="mkb-ecran"><img src="img/site-2026.jpg" alt="Accueil du nouveau site Intégral Pharma" width="1280" height="900"></span>';
    var etat = 'La maquette 2026 · les 20 propositions notées · la banque d’effets';
    return { vit: vit, etat: etat };
  }

  /* ─────────────── porte « LinkedIn » ─────────────── */
  function porteLinkedin() {
    var lip = V2.lip || {}, pret = lip.pret ? lip.pret() : 'rate';
    if (pret === false) {
      return { vit: '<span class="mkb-couv-mini mk-sq" aria-hidden="true" style="aspect-ratio:1200/628"></span>',
        etat: '<i class="mk-sq" style="display:inline-block;width:160px;height:14px;border-radius:7px;vertical-align:middle"></i>' };
    }
    if (pret === 'rate') {
      return { vit: '<span class="mkb-couv-mini">' + S().couverture({ titre: 'Le plan LinkedIn' }) + '</span>', etat: 'Le plan LinkedIn.' };
    }
    var L = lip.lecture(), hero = null, nb = 0, pubn = 0, i;
    for (i = 0; i < L.posts.length; i++) { var p = L.posts[i]; if (!p.ecarte && p.lundi === L.cette) { nb++; if (p.etape === 'pret') pubn++; if (!hero) hero = p; } }
    (L.libres || []).forEach(function (x) { if (x.lundi === L.cette) { nb++; if (x.etape === 'pret') pubn++; } });
    var vit = hero
      ? '<span class="mkb-li-mini" data-mkb-li="1">' + lip.apercu(hero.n) + '</span>'
      : '<span class="mkb-couv-mini">' + S().couverture({ titre: 'Le plan LinkedIn' }) + '</span>';
    var etat = nb
      ? '<b>' + nb + '</b> post' + (nb > 1 ? 's' : '') + ' cette semaine · <b>' + pubn + '</b> prêt' + (pubn > 1 ? 's' : '') + ' à publier'
      : 'Aucun post prévu cette semaine';
    return { vit: vit, etat: etat };
  }

  function porteHtml(k, go, nom, D) {
    return '<button type="button" class="mkb-porte mk-souleve mk-lever mk-press" data-mkb-go="' + esc(go[0]) + (go[1] ? '/' + esc(go[1]) : '') + '" aria-label="Ouvrir ' + esc(nom) + '">' +
      '<span class="mkb-vitrine">' + D.vit + '</span>' +
      '<span class="mkb-nom"><strong>' + esc(nom) + '</strong>' + ic('suivant', 22, 2) + '</span>' +
      '<span class="mkb-etat">' + D.etat + '</span></button>';
  }

  function reperesHtml() {
    var libre = !(window.V2_BRAND && window.V2_BRAND.opso) && !!V2.remonteeOpen;
    var h = '<span class="mkb-cap">Repères</span>' + REPERES.map(function (r) {
      return '<button type="button" class="mkb-repere mk-souleve mk-press" data-mkb-repere="' + r[0] + '"><i>' + ic(r[2], 20) + '</i>' +
        '<span class="mkb-txt"><strong>' + esc(r[1]) + '</strong></span>' + ic('suivant', 18, 2) + '</button>';
    }).join('');
    if (libre) h += '<button type="button" class="mk-btn mk-texte mkb-ameliorer" onclick="V2.remonteeOpen()">Proposer une amélioration</button>';
    return '<div class="mkb-reperes">' + h + '</div>';
  }

  // Le post-visuel de la porte LinkedIn est réduit à l'échelle (le composant réel n'a pas de largeur fixe) :
  // on le mesure une fois posé et on lui applique le facteur qui le fait tenir dans la vitrine.
  function caleLiMini(root) {
    var w = root.querySelector('[data-mkb-li]'); if (!w) return;
    var vitrine = w.parentNode;
    var naturalW = 420, naturalH = w.scrollHeight || 560;
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () {
      naturalH = w.scrollHeight || naturalH;
      var vw = vitrine.clientWidth || 300, vh = vitrine.clientHeight || 225;
      var k = Math.min((vw * .92) / naturalW, (vh * .92) / naturalH, .9);
      if (k > 0 && isFinite(k)) w.style.setProperty('--mkb-k', k);
    });
  }

  /* ─────────────── l'écran ─────────────── */
  function render(root) {
    injectCss();
    var barre = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
    var supports = porteSupports(), documents = porteDocuments(), site = porteSite(), linkedin = porteLinkedin();
    var corps = '' +
      '<div class="mkb-tete"><h1 class="mkb-h1">Marketing</h1><p class="mkb-sous">Quatre espaces, un par usage. Chaque porte s’ouvre en plein écran et revient ici.</p></div>' +
      '<div class="mkb-portes">' +
        porteHtml('supports', ['marketing', 'fiches'], 'Supports officine', supports) +
        porteHtml('documents', ['marketing', 'docs'], 'Documents partagés', documents) +
        porteHtml('site', ['marketing', 'site'], 'Le nouveau site', site) +
        porteHtml('linkedin', ['posts'], 'LinkedIn', linkedin) +
      '</div>' +
      reperesHtml();
    root.innerHTML = barre + '<main class="mk-espace mkb" id="mkb">' + corps + '</main>';

    var el = document.getElementById('mkb');
    el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-mkb-go],[data-mkb-repere]') : null; if (!b) return;
      if (b.hasAttribute('data-mkb-repere')) {
        var k = b.getAttribute('data-mkb-repere');
        if (S().nouveau) S().nouveau(k);
        return;
      }
      var go = b.getAttribute('data-mkb-go').split('/');
      if (go[0] === 'posts') { if (S().aller) S().aller('posts'); return; }
      V2.go.apply(V2, go);
    });

    caleLiMini(el);
    if (S().cascade) S().cascade(el.querySelectorAll('.mkb-porte,.mkb-repere'));
  }

  /* ─────────────── « Le nouveau site » (route #marketing/site) ─────────────── */
  function banqueEffetsSvg() {
    return '<svg class="mkb-vig-fx" viewBox="0 0 600 400" role="img" aria-label="Banque d’effets : 52 composants"><defs><linearGradient id="mkbBq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E63FF"/><stop offset=".5" stop-color="#0042C2"/><stop offset="1" stop-color="#001B70"/></linearGradient></defs><rect width="600" height="400" fill="url(#mkbBq)"/><path d="M0 0h230L100 400H0z" fill="#fff" fill-opacity=".07"/>' +
      [0, 1, 2, 3, 4, 5].map(function (i) { return '<rect x="' + (330 + (i % 3) * 84) + '" y="' + (70 + Math.floor(i / 3) * 120) + '" width="68" height="100" rx="10" fill="#fff" fill-opacity="' + (.10 + i * .05) + '"/>'; }).join('') +
      '<text x="40" y="120" font-size="26" font-weight="700" letter-spacing="2.6" fill="#fff" fill-opacity=".8">BANQUE D’EFFETS</text><text x="38" y="230" font-size="120" font-weight="800" letter-spacing="-4" fill="#fff">52</text><text x="40" y="290" font-size="30" font-weight="600" fill="#fff" fill-opacity=".9">composants</text></svg>';
  }
  function renderSite(root) {
    var barre = V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '';
    var corps = '' +
      '<div class="mkb-tete"><h1 class="mkb-h1">Le nouveau site</h1><p class="mkb-sous">La maquette « Rendre la marge à l’officine française. », l’accueil et la page RSE.</p></div>' +
      '<div class="mkb-site-carte mk-souleve">' +
        '<img class="mkb-site-img" src="img/site-2026.jpg" alt="Accueil du nouveau site : « Rendre la marge à l’officine française. »" width="1280" height="900">' +
        '<div class="mkb-site-actions">' +
          '<button type="button" class="mk-btn mk-plein mk-press" onclick="V2.go(\'marketing\',\'site-plein\')">' + ic('ext', 18, 2) + 'Ouvrir en plein écran</button>' +
          '<button type="button" class="mk-btn mk-press" onclick="window.open(\'../../site-integral/site-2026/index.html\',\'_blank\',\'noopener\')">' + ic('ext', 18, 2) + 'Dans un nouvel onglet</button>' +
        '</div>' +
      '</div>' +
      '<div class="mkb-site-suite">' +
        '<button type="button" class="mkb-tuile mk-souleve mk-lever mk-press" onclick="V2.go(\'marketing\',\'propositions\')"><span class="mkb-vig"><img src="img/maquettes-2026.jpg" alt="La galerie des vingt maquettes du site, avec les notes" width="1280" height="520"></span><strong>Les 20 maquettes notées</strong><span>La galerie d’où vient cette version</span></button>' +
        '<button type="button" class="mkb-tuile mk-souleve mk-lever mk-press" onclick="V2.go(\'marketing\',\'fxbank\')"><span class="mkb-vig">' + banqueEffetsSvg() + '</span><strong>La banque d’effets</strong><span>52 composants réutilisables pour le site</span></button>' +
      '</div>';
    root.innerHTML = barre + '<main class="mk-espace mkb mkb-site" id="mkb-site">' + corps + '</main>';
    injectCss();
    var el = document.getElementById('mkb-site');
    if (S().cascade) S().cascade(el.querySelectorAll('.mkb-site-carte,.mkb-tuile'));
  }

  V2.mktBureau = { render: render, renderSite: renderSite };
})();
