/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Espace Marketing — L'ACCUEIL « CETTE SEMAINE » (lot 4, 18/09/2026)
   Choix de Will : la maquette 4. On entre par le temps : LE post de la semaine,
   comme sur LinkedIn, où il en est, qui s'en occupe, et UN bouton plein.
   Dessous : l'autre post de la semaine, puis « Reprendre » (dernières fiches,
   derniers documents).

   Cet écran ne stocke rien et n'écrit rien lui-même :
   - les posts, leur état, l'aperçu LinkedIn, la carte à couverture, « qui s'en
     occupe » et les actions viennent de v2-mkt-li-plan.js (V2.lip.*) ;
   - les fiches, les documents et leurs vignettes viennent de v2-mkt.js (V2.mkt.*) ;
   - jetons, élévations, boutons, squelette, gestes : v2-mkt-socle.js (.mk-espace).
   Un seul accent, le bleu. On n'anime que transform et opacity.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  function S() { return V2.mktSocle || {}; }
  function ic(n, s, w) { var x = S(); return x.ic ? x.ic(n, s, w) : ''; }

  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var ETAPES = [['choisir', 'À choisir'], ['pret', 'Prêt'], ['publie', 'Publié']];
  function jj(n) { return n === 1 ? '1er' : String(n); }
  function jour(iso, plus) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + (plus || 0)); return d; }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  // « Du lundi 14 au dimanche 20 septembre 2026 »
  function periode(lundi) {
    var a = jour(lundi), b = jour(lundi, 6);
    return 'Du lundi ' + jj(a.getDate()) + (a.getMonth() !== b.getMonth() ? ' ' + MOIS[a.getMonth()] : '') + ' au dimanche ' + jj(b.getDate()) + ' ' + MOIS[b.getMonth()] + ' ' + b.getFullYear();
  }

  /* ─────────────────────── CSS ─────────────────────── */
  function injectCss() {
    if (document.getElementById('v2-mkt-semaine-css')) return;
    var s = document.createElement('style'); s.id = 'v2-mkt-semaine-css';
    s.textContent = [
      '#v2-root .mks{max-width:1320px;margin:0 auto;padding:32px 32px 64px}',
      '.mks-tete{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:24px}',
      '.mks-h1{margin:0;font-size:var(--mk-s1);line-height:var(--mk-s1l);font-weight:700;letter-spacing:-.02em}',
      '.mks-sous{margin:4px 0 0;color:var(--mk-attenue)}',
      '.mks-chiffres{display:flex;gap:32px;flex:none}',
      '.mks-chiffres div{display:flex;align-items:baseline;gap:8px}',
      '.mks-chiffres b{font-size:var(--mk-s1);line-height:var(--mk-s1l);font-weight:700;letter-spacing:-.02em}',
      '.mks-chiffres span{max-width:9ch;font-size:var(--mk-s5);line-height:16px;font-weight:600;color:var(--mk-attenue)}',
      '.mks-cap{display:block;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--mk-attenue)}',

      /* le post et son état */
      '.mks-sem{display:grid;grid-template-columns:minmax(0,560px) minmax(0,1fr);gap:32px;align-items:start}',
      '.mks-apercu{position:relative;display:block;border-radius:var(--mk-r-carte);cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.mks-apercu .lpo-li{max-width:none;margin:0}',
      '.mks-cote{display:flex;flex-direction:column;gap:24px;min-width:0}',
      '.mks-bloc{padding:24px}',
      '.mks-h2{margin:4px 0 0;font-size:var(--mk-s2);line-height:var(--mk-s2l);font-weight:700;letter-spacing:-.01em;color:var(--mk-encre)}',
      /* la piste d’état : un curseur qui glisse (transform seul) */
      '.mks-piste{position:relative;display:grid;grid-template-columns:repeat(3,1fr);margin:20px 0 8px}',
      '.mks-piste::before{content:"";position:absolute;left:16.66%;right:16.66%;top:9px;height:2px;border-radius:2px;background:#DCE2EE}',
      '.mks-chariot{position:absolute;top:0;left:0;width:33.333%;height:20px;display:grid;place-items:center;transform:translateX(calc(var(--pas,0)*100%));transition:transform var(--mk-t3) var(--mk-ressort)}',
      '.mks-chariot i{display:block;width:20px;height:20px;border-radius:50%;background:var(--mk-bleu);box-shadow:0 0 0 4px #fff,0 0 0 5px rgba(0,80,230,.25),2px 4px 8px rgba(0,60,190,.4)}',
      '.mks-piste[data-fin="1"] .mks-chariot i{background:var(--mk-vert);box-shadow:0 0 0 4px #fff,0 0 0 5px rgba(30,158,106,.25),2px 4px 8px rgba(20,110,74,.35)}',
      '.mks-piste span{padding-top:32px;text-align:center;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:var(--mk-attenue)}',
      '.mks-piste span.ici{color:var(--mk-encre)}',
      '.mks-ligne{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px}',
      '.mks-ligne+.mks-ligne{border-top:1px solid var(--mk-trait)}',
      '.mks-ligne>span:first-child{font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:500;color:var(--mk-attenue)}',
      '.mks-val{display:flex;align-items:center;gap:8px;font-weight:600;text-align:right}',
      '.mks-action{display:flex;flex-direction:column;gap:4px;margin-top:16px}',
      '.mks-action-etat{display:none}',
      '.mks .mks-action .mk-plein{width:100%}',
      '.mks-fait{display:flex;align-items:center;gap:12px;font-size:var(--mk-s3);line-height:var(--mk-s3l);font-weight:650}',
      '.mks-fait svg{color:var(--mk-vert)}',

      /* l’autre post de la semaine : la carte du lot 3, couchée */
      '.mks-autres{display:grid;gap:12px}',
      '.mks-autres .mks-cap{margin:0 0 -4px 8px}',
      '.mks-autres .lpo-carte{display:grid;grid-template-columns:132px minmax(0,1fr);column-gap:8px;align-items:center}',
      '.mks-autres .lpo-corps{padding:4px 8px;min-width:0}',
      '.mks-autres .lpo-titre{margin:2px 0 0;min-height:0}',
      '.mks-autres .lpo-pied{grid-column:1/-1;padding-left:4px}',
      '.mks-autres .lpo-carte .mk-couv-puce{display:none}',

      /* tout est publié / rien de prévu */
      '.mks-calme{padding:32px;display:grid;gap:16px;justify-items:start}',
      '.mks-calme p{margin:0;color:var(--mk-attenue);max-width:46ch}',
      '.mks-rond{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;color:#fff;background:var(--mk-vert);box-shadow:0 0 0 6px rgba(30,158,106,.14)}',
      '.mks-silh{width:100%;max-width:320px;padding:12px;border-radius:16px;border:1.5px solid #C9CFDB;opacity:.8}',
      '.mks-silh i{display:block;height:8px;border-radius:4px;background:#D5DAE5;margin-top:8px}',
      '.mks-silh i:first-child{width:40%;margin-top:0}',
      '.mks-silh i.v{height:auto;aspect-ratio:1200/628;border-radius:8px;margin-top:12px}',

      /* Reprendre */
      '.mks-rep{margin-top:48px}',
      '.mks-rep-t{display:flex;align-items:center;justify-content:space-between;gap:16px}',
      '.mks-rep-t h2{margin:0;font-size:var(--mk-s2);line-height:var(--mk-s2l);font-weight:700;letter-spacing:-.01em}',
      '.mks-liens{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}',
      '.mks-rang{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:24px;margin-top:16px}',
      '.mks-tuile{min-width:0;padding:0}',
      '.mks .mks-tuile-b{display:block;width:100%;min-width:0;padding:8px 8px 16px;text-align:left;border-radius:var(--mk-r-carte)}',
      '.mks-vig{position:relative;display:grid;place-items:center;aspect-ratio:1.3;overflow:hidden;border-radius:var(--mk-r-vig);background:linear-gradient(158deg,#F3F6FB 0,#E9EEF7 100%)}',
      '.mks-vig>svg,.mks-vig .mkd-page{display:block;height:calc(100% - 20px);width:auto;border-radius:2px;background:#fff;box-shadow:2px 6px 14px -4px rgba(11,31,77,.35)}',
      '.mks-vig .mkd-page.mks-large{height:auto;width:calc(100% - 20px)}',
      '.mks-vig .mkd-page{position:relative;overflow:hidden}',
      '.mks-vig .mkd-img{object-fit:cover;object-position:top}',
      '.mks-vig .mkd-att{position:absolute;top:0;right:0;bottom:0;left:0;background:var(--mk-groupe)}',
      '.mks-vig .mkd-typo{padding:12% 10% 0;gap:4px}',
      '.mks-vig .mkd-typo b,.mks-vig .mkd-typo-note{display:none}',
      '.mks-tuile.mkd-tuile{padding-bottom:0}',
      '.mks-tuile strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin:12px 8px 0;min-height:44px;font-size:var(--mk-s4);line-height:22px;font-weight:650;color:var(--mk-encre);overflow-wrap:anywhere}',
      '.mks-tuile-b>span:last-child{display:block;margin:4px 8px 0;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:500;color:var(--mk-attenue)}',
      '.mks-rep-vide{display:flex;align-items:center;gap:24px;margin-top:16px;color:var(--mk-attenue)}',
      '.mks-rep-vide .mk-silhouette{width:72px;flex:none;padding:8px;gap:5px}',
      '.mks-rep-vide .mk-silhouette i{height:6px}',
      '.mks-rep-vide p{margin:0 0 8px}',

      '@media (max-width:1100px){.mks-rang{grid-template-columns:repeat(3,minmax(0,1fr))}.mks-chiffres{gap:24px}}',

      /* ═══ 390 px : l’aperçu pleine largeur, l’état et LE bouton collés en bas, au-dessus des onglets ═══ */
      '@media (max-width:860px){',
      '#v2-root .mks{padding:16px 16px 120px}',
      '.mks-tete{flex-direction:column;align-items:stretch;gap:12px;margin-bottom:16px}',
      '.mks-chiffres{gap:20px}',
      '.mks-sem{grid-template-columns:minmax(0,1fr);gap:16px}',
      '.mks-apercu p.lpo-lecture{max-height:76px}',
      '.mks-bloc{padding:16px}',
      '.mks-calme{padding:24px 16px}',
      '.mks-silh{max-width:168px;padding:8px}',
      '.mks-action{position:fixed;z-index:60;left:0;right:0;bottom:calc(64px + env(safe-area-inset-bottom,0px));margin:0;padding:24px 16px 8px;gap:6px;',
      'background:linear-gradient(180deg,rgba(251,252,254,0) 0,#FBFCFE 24px)}',
      '.mks-action-etat{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 4px;font-size:var(--mk-s5);line-height:var(--mk-s5l);font-weight:600;color:var(--mk-encre2)}',
      '.mks-action .mk-texte{display:none}',
      '.mks-autres .lpo-carte{grid-template-columns:112px minmax(0,1fr)}',
      '.mks-rep{margin-top:32px}',
      '.mks-rang{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}',
      '.mks-rep-t{flex-direction:column;align-items:flex-start;gap:0}',
      '.mks-liens{justify-content:flex-start;flex-wrap:nowrap;gap:0;margin-left:-8px}',
      '.mks .mks-liens .mk-btn{padding:0 8px;gap:4px;font-size:15px}',
      '.mks-rep-vide{gap:16px}',
      '}',
      '@media (prefers-reduced-motion:reduce){.mks-chariot{transition:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ─────────────── quel post est « le » post de la semaine ───────────────
     La semaine = du lundi au dimanche en cours. Un post écarté (« Pas cette semaine ») n'en fait plus partie.
     1. le premier post non publié de la semaine — d'abord ceux qui ne sont pas confiés à l'autre personne
        quand on a choisi « Pauline » ou « Will » sur l'écran des posts ;
     2. si tout est publié : l'état « Tout est publié », et le prochain post à venir en discret ;
     3. si la semaine n'a aucun post : le prochain à venir devient le post affiché, et l'écran le DIT ;
     4. s'il n'y a plus rien à venir : l'état vide. */
  function choisir(L) {
    var cette = L.cette, fin = iso(jour(cette, 6));
    var sem = [], suite = [];
    L.posts.forEach(function (p) {
      if (p.ecarte) return;
      if (p.lundi === cette) sem.push(p);
      else if (p.d > fin && p.etape !== 'publie') suite.push(p);
    });
    var aFaire = sem.filter(function (p) { return p.etape !== 'publie'; });
    var pourMoi = aFaire.filter(function (p) { return L.moi === 'both' || !p.resp || p.resp === L.moi; });
    var prochain = suite[0] || null;
    if (aFaire.length) {
      var h = pourMoi[0] || aFaire[0];
      return { cas: 'semaine', hero: h, autres: sem.filter(function (p) { return p !== h; }), sem: sem };
    }
    if (sem.length) return { cas: 'publie', hero: null, prochain: prochain, autres: sem, sem: sem };
    if (prochain) return { cas: 'suivante', hero: prochain, autres: [], sem: sem };
    return { cas: 'vide', hero: null, autres: [], sem: sem };
  }
  // Les mêmes chiffres que la phrase de l'écran des posts : même fenêtre, même bascule Pauline / Will / Nous deux.
  function chiffres(L, nbSemaine) {
    var fin = iso(jour(L.cette, L.nbSem * 7 - 1)), prep = 0, pub = 0;
    L.posts.forEach(function (p) {
      if (p.d < L.cette || p.d > fin || p.ecarte || p.etape === 'publie') return;
      if (L.moi !== 'both' && p.resp && p.resp !== L.moi) return;
      if (p.etape === 'pret') pub++; else prep++;
    });
    L.libres.forEach(function (x) { if (x.d >= L.cette && x.d <= fin) { if (x.etape === 'pret') pub++; else if (x.etape === 'choisir') prep++; } });
    var un = function (n, a, b) { return '<div><b>' + n + '</b><span>' + (n > 1 ? b : a) + '</span></div>'; };
    return '<div class="mks-chiffres" aria-label="Où en sont les posts">' + un(nbSemaine, 'post cette semaine', 'posts cette semaine') + un(prep, 'à préparer', 'à préparer') + un(pub, 'à publier', 'à publier') + '</div>';
  }
  function ouSemaine(L, p) {
    if (p.lundi === L.cette) return '';
    if (p.lundi === iso(jour(L.cette, 7))) return 'La semaine prochaine';
    return V2.lip.semLabel ? V2.lip.semLabel(p.lundi) : '';
  }

  /* ─────────────── morceaux ─────────────── */
  var dernPas = -1, dernHero = null;   // point de départ du curseur de la piste
  function pisteHtml(p) {
    var pas = 0; for (var i = 0; i < ETAPES.length; i++) if (ETAPES[i][0] === p.etape) pas = i;
    var depart = (dernHero === p.n && dernPas >= 0) ? dernPas : pas;
    return '<div class="mks-piste" role="img" aria-label="Étape : ' + esc(ETAPES[pas][1]) + '" data-pas="' + pas + '"' + (pas === 2 ? ' data-fin="1"' : '') + ' style="--pas:' + depart + '"><div class="mks-chariot"><i></i></div>' +
      ETAPES.map(function (e, k) { return '<span' + (k === pas ? ' class="ici"' : '') + '>' + e[1] + '</span>'; }).join('') + '</div>';
  }
  function boutonHtml(p) {
    var save = S().saveHtml || function (a) { return a; };
    var plein = function (act, avant, apres) {
      return '<button type="button" class="mk-btn mk-plein mk-grand mk-press mk-save" id="mks-principal" onclick="' + act + '">' + save(avant, apres) + '</button>';
    };
    if (p.etape === 'choisir') return plein('V2.lip.ouvrir(' + p.n + ')', 'Choisir le texte', 'C’est retenu');
    if (p.etape === 'pret' && !p.parti) return plein('V2.lip.agir(' + p.n + ',\'publier\')', ic('ext', 18) + 'Copier et ouvrir LinkedIn', 'Texte copié');
    if (p.etape === 'pret') return plein('V2.lip.agir(' + p.n + ',\'marquer\')', 'Marquer comme publié', 'C’est publié');
    return '';
  }
  function etatPuce(p) {
    var nom = ''; ETAPES.forEach(function (e) { if (e[0] === p.etape) nom = e[1]; });
    return '<span class="lpo-etat ' + p.etape + '"><i></i>' + esc(nom) + '</span>';
  }
  function blocHtml(L, p) {
    var ou = ouSemaine(L, p);
    var visuel = p.media === 'video' ? 'Vidéo importée' : p.media === 'doc' ? 'Document importé' : p.media ? 'Image importée' : 'Couverture proposée';
    var qui = V2.lip.quiHtml(p.n);
    return '<section class="mks-bloc mk-souleve" aria-label="Où en est ce post">' +
      '<span class="mks-cap">' + esc((ou ? ou + ' · ' : '') + p.quand) + '</span>' +
      '<h2 class="mks-h2">' + esc(p.titre) + '</h2>' +
      pisteHtml(p) +
      '<div class="mks-ligne"><span>Qui s’en occupe</span><span class="mks-val">' + qui + (p.qui ? esc(p.qui) : '') + '</span></div>' +
      '<div class="mks-ligne"><span>Sujet et ton</span><span class="mks-val">Sujet ' + esc(p.sujet) + (p.ton ? ' · ' + esc(p.ton) : '') + '</span></div>' +
      '<div class="mks-ligne"><span>Visuel</span><span class="mks-val">' + visuel + '</span></div>' +
      '<div class="mks-action">' +
        '<div class="mks-action-etat">' + etatPuce(p) + '<span>' + esc(p.qui ? p.qui + ' s’en occupe' : p.quand) + '</span></div>' +
        boutonHtml(p) +
        (p.etape !== 'choisir' ? '<button type="button" class="mk-btn mk-texte mk-press" onclick="V2.lip.ouvrir(' + p.n + ')">Relire ou modifier le post</button>' : '') +
      '</div></section>';
  }
  function apercuHtml(p) {
    return '<div class="mks-apercu" role="button" tabindex="0" data-lpo-n="' + p.n + '" data-mk-id="P' + p.n + '" aria-label="Ouvrir le post du ' + esc(p.quand) + '" ' +
      'onclick="V2.lip.ouvrir(' + p.n + ')" onkeydown="if(event.target===this&&(event.key===\'Enter\'||event.key===\' \')){event.preventDefault();V2.lip.ouvrir(' + p.n + ')}">' +
      V2.lip.apercu(p.n) + '</div>';
  }
  function autresHtml(L, R) {
    var h = '', A = R.autres, libres = L.libres.filter(function (x) { return x.lundi === L.cette; });
    if (R.cas === 'publie' && R.prochain) h += '<span class="mks-cap">' + esc(ouSemaine(L, R.prochain) || 'Le prochain post') + '</span>' + V2.lip.carteHtml(R.prochain.n);
    if (A.length || libres.length) {
      h += '<span class="mks-cap">' + (R.cas === 'publie' ? 'Publié cette semaine' : (A.length + libres.length > 1 ? 'Les autres posts de la semaine' : 'L’autre post de la semaine')) + '</span>';
      A.forEach(function (p) { h += V2.lip.carteHtml(p.n); });
      libres.forEach(function (x) { h += x.html; });
    }
    return h ? '<div class="mks-autres">' + h + '</div>' : '';
  }

  // La vignette d'une fiche : sa page, dessinée (bandeau ou filet de SA couleur, son titre, autant de lignes que de produits).
  // Volontairement un dessin, pas la feuille réelle réduite : trois feuilles entières et leurs photos pour 90 px de large,
  // et la feuille porte des prix — cet écran n'en montre aucun.
  var uid = 0;
  function ficheSvg(f) {
    var acc = /^#6D4FC4$/i.test(f.accent || '') ? '#10131C' : (f.accent || '#0050E6');   // pas de violet sur cet écran
    var plier = S().plier || function (t) { return [t]; };
    var T = plier(f.titre || 'Sans titre', 24).slice(0, 3), id = 'mksf' + (++uid), bande = f.tete === 'band', h = '';
    h += '<svg viewBox="0 0 794 1123" role="img" aria-label="Fiche : ' + esc(f.titre || 'sans titre') + '"><rect width="794" height="1123" fill="#fff"/>';
    if (bande) {
      h += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs>' +
        '<rect width="794" height="330" fill="' + esc(acc) + '"/><rect width="794" height="330" fill="url(#' + id + ')"/><path d="M0 0h300L130 330H0z" fill="#fff" fill-opacity=".08"/>';
    } else {
      h += '<rect width="794" height="' + (f.tete === 'slim' ? 22 : 6) + '" fill="' + esc(acc) + '"/>';
    }
    h += '<text x="64" y="92" font-size="24" font-weight="700" letter-spacing="3" fill="' + (bande ? '#fff' : esc(acc)) + '" fill-opacity="' + (bande ? '.8' : '1') + '">INTÉGRAL PHARMA</text>';
    for (var i = 0; i < T.length; i++) h += '<text x="64" y="' + (168 + i * 60) + '" font-size="52" font-weight="800" letter-spacing="-1.2" fill="' + (bande ? '#fff' : '#10131C') + '">' + esc(T[i]) + '</text>';
    var n = Math.max(1, Math.min(f.nb || 3, 5)), y0 = 410;
    for (var k = 0; k < n; k++) {
      var y = y0 + k * 128;
      h += '<rect x="64" y="' + y + '" width="84" height="84" rx="10" fill="#EEF1F6"/><rect x="176" y="' + (y + 14) + '" width="' + (420 - (k % 3) * 60) + '" height="20" rx="10" fill="#10131C" fill-opacity=".82"/>' +
        '<rect x="176" y="' + (y + 52) + '" width="' + (260 + (k % 2) * 70) + '" height="14" rx="7" fill="#C9CFDB"/><rect x="64" y="' + (y + 106) + '" width="666" height="2" fill="#EEF1F6"/>';
    }
    return h + '<rect x="64" y="1068" width="220" height="10" rx="5" fill="#DCE2EE"/></svg>';
  }
  function caler(rang) {
    var P = rang.querySelectorAll('.mks-vig .mkd-page');
    for (var i = 0; i < P.length; i++) {
      var m = /([\d.]+)\s*\/\s*([\d.]+)/.exec(P[i].style.aspectRatio || ''), large = !!(m && +m[2] && (+m[1] / +m[2]) > 1.25);
      if (large !== P[i].classList.contains('mks-large')) { if (large) P[i].classList.add('mks-large'); else P[i].classList.remove('mks-large'); }
    }
  }
  function reprendreHtml() {
    var F = (V2.mkt && V2.mkt.fichesRecentes) ? V2.mkt.fichesRecentes(3) : [];
    var D = (V2.mkt && V2.mkt.docsRecents) ? V2.mkt.docsRecents(3) : [];
    var tuiles = F.map(function (f) {
      return '<div class="mks-tuile mk-souleve mk-lever"><button type="button" class="mks-tuile-b mk-press" onclick="V2.mkt.open(\'' + esc(f.id) + '\')" aria-label="Ouvrir la fiche ' + esc(f.titre || 'sans titre') + '">' +
        '<span class="mks-vig">' + ficheSvg(f) + '</span><strong>' + esc(f.titre || 'Sans titre') + '</strong><span>Fiche · ' + esc(f.statut) + '</span></button></div>';
    });
    if (D === null) {   // la liste des documents arrive : la place est tenue (geste 11)
      for (var i = 0; i < 3; i++) tuiles.push('<div class="mks-tuile mk-souleve" aria-hidden="true"><div class="mks-tuile-b"><span class="mks-vig mk-sq"></span><strong><i class="mk-sq" style="display:block;height:16px;width:80%;border-radius:8px"></i></strong><span><i class="mk-sq" style="display:block;height:12px;width:50%;border-radius:6px"></i></span></div></div>');
    } else {
      D.forEach(function (d) {
        tuiles.push('<div class="mks-tuile mk-souleve mk-lever mkd-tuile" data-name="' + esc(d.name) + '"><button type="button" class="mks-tuile-b mk-press" data-mks-doc aria-label="Ouvrir le document ' + esc(d.nom) + '">' +
          '<span class="mks-vig"><span class="mkd-page" style="aspect-ratio:' + esc(d.ratio) + '">' + d.pageHtml + '</span></span><strong>' + esc(d.nom) + '</strong><span>' + (d.xls ? 'Excel' : 'Document') + ' · ' + esc(d.poids) + '</span></button></div>');
      });
    }
    var tete = '<div class="mks-rep-t"><h2>Reprendre</h2><div class="mks-liens">' +
      '<button type="button" class="mk-btn mk-texte mk-press" onclick="V2.mktSocle.aller(\'fiches\')">Toutes les fiches' + ic('suivant', 18, 2) + '</button>' +
      '<button type="button" class="mk-btn mk-texte mk-press" onclick="V2.mktSocle.aller(\'documents\')">Tous les documents' + ic('suivant', 18, 2) + '</button></div></div>';
    if (!tuiles.length) {
      return '<section class="mks-rep" aria-label="Reprendre">' + tete + '<div class="mks-rep-vide"><div class="mk-silhouette" aria-hidden="true"><i></i><i></i><i></i><i style="width:60%"></i></div>' +
        '<div><p>Vos dernières fiches et vos derniers documents se retrouveront ici, à un clic.</p>' +
        '<button type="button" class="mk-btn mk-press" onclick="V2.mkt.create(\'support\')">' + ic('plus', 18, 2) + 'Créer une fiche</button></div></div></section>';
    }
    return '<section class="mks-rep" aria-label="Reprendre">' + tete + '<div class="mks-rang">' + tuiles.join('') + '</div></section>';
  }

  function teteHtml(sous, chif, local) {
    return '<div class="mks-tete"><div><h1 class="mks-h1">Cette semaine</h1><p class="mks-sous">' + sous + '</p>' +
      (local ? '<p class="lpo-local">' + (window.ICO ? window.ICO('alert', 16, 2) : '') + '<span>Vos choix sont gardés sur cet appareil ; ils ne sont pas encore partagés avec l’équipe.</span></p>' : '') +
      '</div>' + (chif || '') + '</div>';
  }
  // En attendant le plan ou les états : la forme de l'écran (geste 11), jamais un vide.
  function attenteHtml() {
    var l = function (w, h) { return '<i class="mk-sq" style="display:block;height:' + (h || 14) + 'px;width:' + w + ';border-radius:8px;margin-top:12px"></i>'; };
    return '<div class="mks-sem mks-attente" aria-hidden="true">' +
      '<div class="mk-souleve" style="overflow:hidden"><div style="padding:16px">' + l('40%', 18) + l('92%') + l('96%') + l('70%') + '</div><div class="mk-sq" style="aspect-ratio:1200/628;margin-top:8px"></div><div style="height:44px"></div></div>' +
      '<div class="mks-cote"><div class="mks-bloc mk-souleve">' + l('36%') + l('84%', 22) + l('100%', 20) + l('100%', 20) + l('100%', 48) + '</div></div></div>';
  }

  /* ─────────────── l'écran ─────────────── */
  function render(root) {
    injectCss();
    var barre = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
    var lip = V2.lip || {}, pret = lip.pret ? lip.pret() : 'rate';
    var corps, dejaLa = !!root.querySelector('.mks-sem:not(.mks-attente)');
    var cette = iso(jour(iso(new Date()), -((new Date().getDay() + 6) % 7)));
    var regle = ' · un à deux posts par semaine, pas davantage.';

    if (pret === 'rate') {
      corps = teteHtml(esc(periode(cette)) + '.') + '<div class="mks-sem"><section class="mks-calme mk-souleve"><h2 class="mks-h2">Les posts de la semaine ne s’affichent pas pour l’instant.</h2>' +
        '<p>Le plan des posts n’a pas pu être lu. Rechargez la page dans un instant.</p>' +
        '<button type="button" class="mk-btn mk-press" onclick="location.reload()">Recharger la page</button></section></div>';
    } else if (!pret) {
      corps = teteHtml(esc(periode(cette)) + regle) + attenteHtml();
    } else {
      var L = lip.lecture(), R = choisir(L), h = R.hero;
      var nbSemaine = R.sem.length + L.libres.filter(function (x) { return x.lundi === L.cette; }).length;
      var sous = esc(periode(L.cette)) + (R.cas === 'suivante' ? ' · aucun post n’est prévu cette semaine : voici le prochain.' : regle);
      var gauche, droite;
      if (h) {
        gauche = apercuHtml(h);
        droite = blocHtml(L, h) + autresHtml(L, R);
      } else if (R.cas === 'publie') {
        gauche = '<section class="mks-calme mk-souleve" data-mks-etat="publie"><span class="mks-rond" aria-hidden="true">' + ic('coche', 28, 2.5) + '</span>' +
          '<h2 class="mks-h2">Tout est publié cette semaine</h2>' +
          '<p>' + (R.sem.length > 1 ? 'Les ' + R.sem.length + ' posts de la semaine sont en ligne.' : 'Le post de la semaine est en ligne.') +
          (R.prochain ? ' Le prochain est prévu ' + esc(R.prochain.quand.replace(/^./, function (c) { return c.toLowerCase(); }).replace(/ · /, ', à ').replace(/ h /, '\u00a0h\u00a0')) + '.' : '') + '</p>' +
          (R.prochain ? '<button type="button" class="mk-btn mk-press" onclick="V2.lip.ouvrir(' + R.prochain.n + ')">Préparer le prochain</button>' : '') + '</section>';
        droite = autresHtml(L, R);
      } else {
        gauche = '<section class="mks-calme mk-souleve" data-mks-etat="vide"><div class="mks-silh" aria-hidden="true"><i></i><i></i><i style="width:70%"></i><i class="v"></i></div>' +
          '<h2 class="mks-h2">Aucun post n’est prévu cette semaine</h2><p>Le plan ne propose plus rien à venir. Vous pouvez écrire un post hors plan ; il prendra sa place ici.</p>' +
          '<div class="mks-action"><button type="button" class="mk-btn mk-plein mk-grand mk-press" id="mks-principal" onclick="V2.mktSocle.nouveau(\'post\')">' + ic('plus', 18, 2) + 'Écrire un post</button></div></section>';
        droite = autresHtml(L, R);
      }
      corps = teteHtml(sous, chiffres(L, nbSemaine), L.local) + '<div class="mks-sem" data-mks-cas="' + R.cas + '">' + gauche + '<div class="mks-cote">' + droite + '</div></div>';
    }

    root.innerHTML = barre + '<main class="mks mk-espace" id="mks">' + corps + reprendreHtml() + '</main>';

    // un clic sur un document : sa vignette grandit et devient la visionneuse (lot 2)
    var el = document.getElementById('mks');
    el.onclick = function (e) {
      var b = e.target.closest ? e.target.closest('[data-mks-doc]') : null; if (!b) return;
      var t = b.parentNode; V2.mkt.docOuvrir(t.getAttribute('data-name'), t.querySelector('.mkd-page'));
    };
    // une page plus large que sa case (présentation en paysage) se cale sur la largeur ; les vignettes arrivent après coup
    var rang = el.querySelector('.mks-rang');
    if (rang) {
      caler(rang);
      if (window.MutationObserver) { try { new MutationObserver(function () { caler(rang); }).observe(rang, { childList: true, subtree: true }); } catch (e) {} }
    }
    // le curseur de la piste glisse de son ancienne étape vers la nouvelle
    var piste = el.querySelector('.mks-piste');
    if (piste) {
      var pas = +piste.getAttribute('data-pas');
      dernHero = h ? h.n : null; dernPas = pas;
      var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
      raf(function () { raf(function () { piste.style.setProperty('--pas', pas); }); });
    } else { dernHero = null; dernPas = -1; }
    // geste 3 — la cascade ne joue qu'à l'arrivée ; au téléphone le bloc d'état porte le bouton collé en bas : il ne bouge pas
    if (!dejaLa && pret === true && S().cascade) {
      var sel = '.mks-apercu,.mks-autres .lpo-carte,.mks-tuile' + (S().tel && S().tel() ? '' : ',.mks-bloc,.mks-calme');
      S().cascade(el.querySelectorAll(sel));
    }
  }

  V2.mktSemaine = { render: render };
})();
