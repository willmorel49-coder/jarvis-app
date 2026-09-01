/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier « Infos du matin » (pages.infos) — L'ÉDITION DU MATIN

   Ce n'est plus un agrégateur de flux : c'est une ÉDITION. Le robot
   generate_brief.py lit chaque matin les 11 fichiers déjà produits par les
   autres robots (presse pro, ANSM, Journal officiel, avis de prix CEPS, HAS,
   EMA, épidémio, urgences, rappels de lots, veille concurrents), regroupe les
   doublons, note l'importance pour un grossiste-répartiteur, et écrit
   brief-jour.json + brief-archive.json.

   L'écran le met en page :
     LA UNE            — le sujet du jour, en grand, avec son angle métier
     LES 5 QUI COMPTENT— le reste du top, numéroté
     LE RADAR          — les chiffres du jour, tous mesurés, avec leur source
     TES MARGES        — Journal officiel, avec compte à rebours (hors filtres)
     OPPORTUNITÉS      — rupture × catalogue Intégral (calculé ICI, jamais publié)
     RUPTURES / RAPPELS— les rubriques de terrain
     LE FIL            — tout le reste, cherchable et filtrable par thème
     LES MATINS D'AVANT— l'archive, 120 éditions

   Design « Brief calme » : fond clair, un accent par thème, zéro emoji
   (iconographie ICO maison). Se lit en 30 secondes, se fouille en 3 minutes.

   ⚠️ brief-jour.json est PUBLIC (dépôt GitHub Pages) : il ne contient que de
      l'information publique. Tout ce qui est prix / remise / stock Intégral est
      calculé ici, dans le navigateur, à partir du catalogue déjà chargé.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var ICO = window.ICO || function () { return ''; };
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  function cap(s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  var BRIEF = null, ARCHIVE = null, LOADED = false, FAILED = false;

  /* ── accent visuel par thème : une couleur veut toujours dire la même chose ── */
  var THEME_ACC = {
    marge: 'amber', remboursement: 'blue', generique: 'green', rupture: 'rose',
    securite: 'rose', concurrence: 'violet', officine: 'blue', industrie: 'muted',
    sante: 'teal', autre: 'muted'
  };
  var THEME_ICO = {
    marge: 'euro', remboursement: 'euro', generique: 'pill', rupture: 'alert',
    securite: 'alert', concurrence: 'opp', officine: 'pharma', industrie: 'cat',
    sante: 'pill', autre: 'list'
  };

  /* filtre de thème + recherche sur le fil (mémorisé lui aussi) */
  var TH_KEY = 'jarvis_brief_theme_v1';
  var THEME_SEL = (function () { try { return localStorage.getItem(TH_KEY) || ''; } catch (e) { return ''; } })();
  var QUERY = '';
  V2.briefTheme = function (t) {
    THEME_SEL = (THEME_SEL === t) ? '' : t;
    try { localStorage.setItem(TH_KEY, THEME_SEL); } catch (e) {}
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  V2.briefSearch = function (el) {
    QUERY = el.value || '';
    var q = norm(QUERY.trim());
    var rows = document.querySelectorAll('#brief-fil .tu');
    var vus = 0;
    for (var i = 0; i < rows.length; i++) {
      var ok = !q || norm(rows[i].getAttribute('data-q') || '').indexOf(q) >= 0;
      rows[i].style.display = ok ? '' : 'none';
      if (ok) vus++;
    }
    var vide = document.getElementById('brief-fil-vide');
    if (vide) vide.style.display = vus ? 'none' : '';
    var cpt = document.getElementById('brief-fil-cpt');
    if (cpt) cpt.textContent = vus + (vus > 1 ? ' articles' : ' article');
  };

  var COPY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  /* ── « nouveau depuis ta dernière visite » ── */
  var SEEN_KEY = 'jarvis_infos_seen', seenBaseline = null;
  function seenBase() { if (seenBaseline === null) { try { seenBaseline = localStorage.getItem(SEEN_KEY) || ''; } catch (e) { seenBaseline = ''; } } return seenBaseline; }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, new Date().toISOString().slice(0, 10)); } catch (e) {} }

  /* ════════════════ chargement ════════════════ */
  function load(cb) {
    if (LOADED) { cb(); return; }
    FAILED = false;   // nouvelle tentative à chaque entrée sur la page
    var day = ''; try { day = new Date().toISOString().slice(0, 10); } catch (e) {}
    var get = function (f, obligatoire) {
      return fetch(f + '?d=' + day, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .catch(function (e) { if (obligatoire) throw e; return null; });
    };
    try {
      Promise.all([get('brief-jour.json', true), get('brief-archive.json', false)])
        .then(function (res) { BRIEF = res[0]; ARCHIVE = res[1]; LOADED = true; cb(); })
        .catch(function () { FAILED = true; cb(); });
    } catch (e) { FAILED = true; cb(); }
  }

  /* ════════════════ dates ════════════════ */
  function joDateFr(iso) {
    try {
      var d = new Date(iso + 'T00:00:00');
      var s = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      return d.getDate() === 1 ? s.replace(/^1 /, '1er ') : s;
    } catch (e) { return iso; }
  }
  function ilYA(iso) {
    var j;
    try { j = Math.round((new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 86400000); }
    catch (e) { return ''; }
    if (j === null || isNaN(j)) return '';
    if (j <= 0) return "aujourd'hui";
    if (j === 1) return 'hier';
    if (j < 7) return 'il y a ' + j + ' jours';
    return joDateFr(iso);
  }
  function topDate() {
    try {
      var d = new Date(), s = cap(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
      return d.getDate() === 1 ? s.replace(/ 1 /, ' 1er ') : s;
    } catch (e) { return ''; }
  }

  /* ════════════════ copier le brief (WhatsApp / mail) ════════════════
     Veille pure : AUCUN prix, AUCUN abandon de marge, AUCUNE donnée Intégral —
     ce texte peut finir chez un pharmacien. */
  function fallbackCopy(txt) { try { var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } catch (e) {} }
  V2.infosCopyBrief = function (btn) {
    if (!BRIEF) return;
    var L = [];
    L.push("L'édition du matin — " + topDate());
    (BRIEF.cinq || []).forEach(function (c, i) {
      L.push('', (i + 1) + '. ' + c.t);
      if (c.r) L.push('   ' + c.r);
      var meta = [];
      if (c.srcs && c.srcs.length) meta.push(c.srcs.slice(0, 3).join(', '));
      if (c.faits && c.faits.length) meta.push(c.faits.join(' · '));
      if (meta.length) L.push('   (' + meta.join(' — ') + ')');
      if (c.u) L.push('   ' + c.u);
    });
    var R = BRIEF.radar || [];
    if (R.length) {
      L.push('', 'Le radar du jour :');
      R.forEach(function (r) { L.push('- ' + r.v + (r.unite || '') + ' ' + r.l + ' (' + r.src + ')'); });
    }
    var txt = L.join('\n');
    var ok = function () {
      if (V2.toast) V2.toast('Brief copié ✅');
      if (btn) { var t = btn.getAttribute('data-lbl') || 'Copier le brief'; btn.innerHTML = 'Copié ✅'; setTimeout(function () { btn.innerHTML = COPY_SVG + t; }, 1500); }
    };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { fallbackCopy(txt); ok(); }); else { fallbackCopy(txt); ok(); } }
    catch (e) { fallbackCopy(txt); ok(); }
  };

  /* dépliage de l'archive */
  var ARCH_OPEN = false;
  V2.briefArchive = function () { ARCH_OPEN = !ARCH_OPEN; if (V2.route && V2.route.name === 'infos') V2.render(); };

  /* ════════════════════════════ RENDU ════════════════════════════ */  /* ════════════════════════════ RENDU · « LE MUR » ════════════════════════════
     Direction choisie par Will le 01/09/2026 parmi quatre maquettes.
     Le parti pris : l'IMAGE D'ABORD. Aucune carte blanche dans le fil — chaque
     article EST une tuile d'image, de taille variable, avec son titre posé dessus.
     Les articles sans photo deviennent des affiches de couleur, donc le mur reste
     entièrement visuel, sans trou.
     Will, 02/09/2026 : « vire de "ce qui touche tes marges" à "à retirer des rayons" ».
     Six blocs retirés d'un coup — Journal officiel, radar chiffré, filtres de rubriques,
     opportunités catalogue, alertes de stock, rappels. La page ne garde que ce qui se
     REGARDE : la une, puis le mur (filtrable par rubrique, cherchable).
     ⚠️ Les données de ces six blocs sont toujours dans brief-jour.json : les remettre
        ou les déplacer ailleurs ne coûte que du gabarit, rien à recalculer. */
  V2.pages.infos = {
    render: function (root) {
      injectStyles();

      if (!LOADED && !FAILED) {
        load(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap inf2">' +
            '<div class="inf-load"><div class="inf-spin"></div><span>Composition de l\'édition du matin…</span></div>' +
          '</div>';
        return;
      }
      if (!BRIEF || !(BRIEF.cinq || []).length) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap inf2"><div class="inf-empty">' +
            '<div class="inf-empty-ic">' + ICO('spark', 26, 2) + '</div>' +
            '<div class="inf-empty-t">' + (FAILED ? "L'édition du matin n'a pas pu être chargée" : "Pas encore d'édition aujourd'hui") + '</div>' +
            '<div class="inf-empty-d">' + (FAILED ? 'Vérifie ta connexion. L\'édition se compose chaque matin vers 9 h.' : 'L\'édition se compose automatiquement chaque matin vers 9 h.') + '</div>' +
          '</div></div>';
        return;
      }

      var cinq = BRIEF.cinq || [], une = cinq[0];
      /* Dans « Le Mur », il n'y a plus « les 5 » d'un côté et « le fil » de l'autre :
         il y a UNE tuile de tête et LE MUR. Les 4 autres du top rejoignent le mur en
         tête, à leur rang — c'est le classement qui les distingue, pas une section. */
      var mur = cinq.slice(1).concat(BRIEF.fil || []);
      var base = seenBase();
      var nbNew = base ? mur.filter(function (i) { return i.d && i.d > base; }).length : 0;
      var nIll = mur.filter(function (i) { return i.img; }).length + (une && une.img ? 1 : 0);

      var html = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap inf2">';

      /* ──────────── TÊTE COMPACTE ────────────
         Le mur commence tout de suite : pas de grand bandeau qui mange un écran. */
      html += '<header class="mur-tete">' +
        '<div class="mur-tete-g">' +
          '<span class="mur-d"><i></i>Édition du jour · ' + esc(topDate()) +
            (nbNew ? ' · <b>' + nbNew + ' nouveau' + (nbNew > 1 ? 'x' : '') + '</b>' : '') + '</span>' +
          '<h1>L\'édition du matin</h1>' +
        '</div>' +
        '<div class="mur-tete-d">' +
          '<span><b>' + esc(mur.length + 1) + '</b> articles</span>' +
          '<span><b>' + esc(nIll) + '</b> illustrés</span>' +
          '<span><b>' + esc(BRIEF.compte.fichiers) + '</b> sources gratuites</span>' +
        '</div>' +
        '<div class="mur-act">' +
          '<button class="inf-copy" data-lbl="Copier le brief" onclick="V2.infosCopyBrief(this)">' + COPY_SVG + 'Copier le brief</button>' +
          (ARCHIVE && ARCHIVE.n > 1 ? '<button class="inf-ghost" onclick="V2.briefArchive()">' + ICO('cal', 14, 2) + 'Les matins d\'avant</button>' : '') +
        '</div>' +
      '</header>';

      /* ──────────── LA TUILE DE TÊTE ──────────── */
      if (une) html += tuileUne(une);

      /* Will, 02/09/2026 : « vire de “ce qui touche tes marges” à “à retirer
         des rayons” ». Six blocs retirés d'un coup — Journal officiel, radar,
         filtres de rubriques, opportunités catalogue, alertes de stock, rappels.
         La page ne garde que ce qui se REGARDE : la une, puis le mur. */

      /* ════════════════ LE MUR ════════════════ */
      if (mur.length) {
        var compte = {};
        mur.forEach(function (i) { compte[i.theme] = (compte[i.theme] || 0) + 1; });
        // ⚠️ ordre MÉTIER, jamais par volume : trier par volume met « Autre » en tête.
        var ordre = (BRIEF.themes_ordre || Object.keys(compte)).filter(function (t) { return compte[t]; });
        var visibles = THEME_SEL ? mur.filter(function (i) { return i.theme === THEME_SEL; }) : mur;

        var chips = '<button type="button" class="brf-chip' + (THEME_SEL ? '' : ' on') + '" onclick="V2.briefTheme(\'\')">Tout <i>' + mur.length + '</i></button>' +
          ordre.map(function (t) {
            return '<button type="button" class="brf-chip a-' + (THEME_ACC[t] || 'muted') + (THEME_SEL === t ? ' on' : '') + '" onclick="V2.briefTheme(\'' + esc(t) + '\')">' +
              '<i class="pt"></i>' + esc((BRIEF.themes_l && BRIEF.themes_l[t]) || t) + ' <i>' + compte[t] + '</i></button>';
          }).join('');

        // rythme des hauteurs : c'est ce qui fait un MUR et pas une grille
        var RYTHME = ['', 'h', 'l', '', 'xl', 'l', 'h', ''];
        var HAUT = { '': 1.25, h: 1.333, l: 1, xl: 1.5 };   // hauteur relative de chaque format
        var nCol = colonnes(root); COLS_VUE = nCol; surveilleLargeur();
        var cols = [], charge = [];
        for (var k = 0; k < nCol; k++) { cols.push(''); charge.push(0); }
        visibles.forEach(function (i, n) {
          var fmt = RYTHME[n % RYTHME.length];
          // on dépose toujours dans la colonne la plus courte : c'est ce qui donne
          // le décalage du mur sans laisser un pied de page en escalier
          var min = 0;
          for (var k = 1; k < nCol; k++) if (charge[k] < charge[min]) min = k;
          var q = norm((i.t || '') + ' ' + (i.r || '') + ' ' + (i.s || '') + ' ' + ((BRIEF.themes_l && BRIEF.themes_l[i.theme]) || ''));
          cols[min] += tuile(i, fmt, q);
          charge[min] += HAUT[fmt] + 0.06;
        });
        var tuiles = cols.map(function (c) { return '<div class="mur-col">' + c + '</div>'; }).join('');

        html += '<section class="mur-sec" id="brief-fil">' +
          '<div class="mur-rub"><b>Le mur</b>' +
            '<span id="brief-fil-cpt">' + visibles.length + (visibles.length > 1 ? ' articles' : ' article') + '</span></div>' +
          '<div class="brf-chips">' + chips + '</div>' +
          '<div class="brf-search">' + ICO('search', 16, 2) +
            '<input type="search" placeholder="Chercher au mur (molécule, mot-clé, source)…" oninput="V2.briefSearch(this)" value="' + esc(QUERY) + '">' +
          '</div>' +
          '<div class="mur">' + tuiles + '</div>' +
          '<div class="inf-allhidden" id="brief-fil-vide" style="display:none">Aucun article ne correspond à cette recherche.</div>' +
        '</section>';
      }

      /* ── LES MATINS D'AVANT ── */
      if (ARCH_OPEN && ARCHIVE && (ARCHIVE.jours || []).length) {
        html += '<section class="inf-sec a-violet">' +
          rubrique('Les matins d\'avant', ARCHIVE.n + ' édition' + (ARCHIVE.n > 1 ? 's' : '') + ' archivée' + (ARCHIVE.n > 1 ? 's' : '') + ' — la une de chaque jour et ses cinq titres.') +
          '<div class="brf-arch">' + ARCHIVE.jours.slice(0, 30).map(function (j) {
            return '<div class="brf-day"><div class="brf-day-d">' + esc(joDateFr(j.d)) + '</div>' +
              '<div class="brf-day-l">' + (j.titres || []).map(function (t) {
                return '<a' + (t.u ? ' href="' + esc(t.u) + '" target="_blank" rel="noopener"' : '') + '>' +
                  '<i class="a-' + (THEME_ACC[t.theme] || 'muted') + '"></i>' + esc(t.t) + '</a>';
              }).join('') + '</div></div>';
          }).join('') + '</div>' +
        '</section>';
      }

      /* ── pied de page : la traçabilité ── */
      var maj = '';
      try { maj = new Date(BRIEF.genere).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
      html += '<div class="brf-foot">Édition composée le ' + esc(maj) + ' à partir de ' +
        esc(BRIEF.compte.fichiers) + ' sources gratuites, toutes lisibles en entier.<br>' +
        esc(BRIEF.compte.entrees) + ' informations lues, ' + esc(BRIEF.compte.sujets) +
        ' sujets après regroupement des doublons.</div>';

      html += '</div>';
      root.innerHTML = html;
      markSeen();

      if (QUERY) {
        var inp = root.querySelector('.brf-search input');
        if (inp) V2.briefSearch(inp);
      }

      /* ── Motion (vanilla, respecte prefers-reduced-motion via l'API) ── */
      var mo = V2.motion;
      if (mo) {
        var u = root.querySelector('.mur-une');
        if (u) mo.inView(u, function (el) { mo.stagger([el], { step: 0, y: 12 }); });
        var jet = root.querySelector('.mur-jetons');
        if (jet) mo.inView(jet, function (el) {
          mo.stagger(el.querySelectorAll('.mj'), { step: 50, y: 10 });
          var cs = el.querySelectorAll('[data-count]');
          for (var i = 0; i < cs.length; i++) mo.countUp(cs[i]);
        });
        var st = root.querySelector('.inf-stats');
        if (st) mo.inView(st, function (el) {
          mo.stagger(el.querySelectorAll('.inf-stat'), { step: 60, y: 8 });
          var cs = el.querySelectorAll('[data-count]');
          for (var i = 0; i < cs.length; i++) mo.countUp(cs[i]);
        });
        var m = root.querySelector('.mur');
        if (m) mo.inView(m, function (el) { mo.stagger(el.querySelectorAll('.tu'), { step: 32, cap: 12, y: 12 }); });
        var oppsEl = root.querySelector('.inf-opps');
        if (oppsEl) mo.inView(oppsEl, function (el) { mo.stagger(el.querySelectorAll('.inf-opp'), { step: 50, cap: 6, y: 10 }); });
        var lists = root.querySelectorAll('.inf-list');
        for (var L = 0; L < lists.length; L++) (function (listEl) {
          mo.inView(listEl, function (el) { mo.stagger(el.querySelectorAll('.inf-row'), { step: 30, cap: 10, y: 8 }); });
        })(lists[L]);
      }
    }
  };

  /* Combien de colonnes ? Décidé ici plutôt qu'en CSS, puisque c'est nous qui
     répartissons les tuiles. Les paliers reprennent ceux du reste de l'app. */
  function colonnes(root) {
    var w = (root && root.clientWidth) || (window.innerWidth || 1200);
    return w >= 1120 ? 4 : w >= 820 ? 3 : 2;
  }
  // un changement de palier doit redistribuer le mur — sinon la page garde
  // 4 colonnes serrées sur un téléphone tourné.
  var COLS_VUE = 0, RESIZE_POSE = false;
  function surveilleLargeur() {
    if (RESIZE_POSE) return;
    RESIZE_POSE = true;
    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (!V2.route || V2.route.name !== 'infos') return;
        var el = document.querySelector('.inf2');
        if (el && colonnes(el) !== COLS_VUE) V2.render();
      }, 180);
    });
  }

  /* ════════════════ briques du mur ════════════════ */

  /* La couverture. La photo que le site déclare lui-même, posée sur une planche
     dessinée aux couleurs du thème. Deux garde-fous :
     — la moitié des sources métier n'ont AUCUNE image : la planche prend le relais
       et l'article reste une tuile pleine, jamais un trou dans le mur ;
     — si le serveur refuse d'être appelé depuis ailleurs, `onerror` retire la photo
       et la planche réapparaît toute seule. */
  function couverture(c, ratio) {
    return '<span class="mq-cov ' + (ratio || 'r-4x5') + '">' +
      '<span class="mq-plaque a-' + (THEME_ACC[c.theme] || 'muted') + '"></span>' +
      (c.img ? '<img src="' + esc(c.img) + '" alt="" loading="lazy" decoding="async" ' +
               'referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</span>';
  }
  function sourcesLine(c) {
    var s = (c.srcs && c.srcs.length) ? c.srcs : [c.s];
    return esc(s.slice(0, 3).join(' · ')) + (s.length > 3 ? ' <b>+' + (s.length - 3) + '</b>' : '');
  }

  /* LA TUILE DE TÊTE — large, avec le chapeau et l'angle métier */
  function tuileUne(c) {
    return '<article class="mur-une a-' + (THEME_ACC[c.theme] || 'blue') + '">' +
      couverture(c, 'r-21x9') + '<span class="veil"></span>' +
      '<div class="b">' +
        '<span class="cat">À la une · ' + esc(c.theme_l) + '</span>' +
        '<h2>' + esc(c.t) + '</h2>' +
        (c.r ? '<p>' + esc(c.r) + '</p>' : '') +
        '<div class="pour"><b>Pour toi</b>' + esc(c.pour_toi) + '</div>' +
        '<div class="f">' + sourcesLine(c) + ' · ' + esc(ilYA(c.d)) +
          (c.mn ? ' · ' + esc(c.mn) + ' min' : '') +
          (c.entier ? ' · <span class="ok">✓ lisible en entier</span>' : '') + '</div>' +
      '</div>' +
      (c.u ? '<a class="tout" href="' + esc(c.u) + '" target="_blank" rel="noopener" aria-label="' + esc(c.t) + '"></a>' : '') +
    '</article>';
  }

  /* UNE TUILE DU MUR */
  function tuile(a, taille, q) {
    var RATIO = { '': 'r-4x5', h: 'r-3x4', l: 'r-1x1', xl: 'r-4x6' };
    return '<article class="tu ' + taille + ' a-' + (THEME_ACC[a.theme] || 'muted') + '" data-q="' + esc(q) + '">' +
      couverture(a, RATIO[taille] || 'r-4x5') + '<span class="veil"></span>' +
      '<div class="b">' +
        '<span class="cat">' + esc(a.theme_l) + '</span>' +
        '<h3>' + esc(a.t) + '</h3>' +
        '<div class="f">' + esc(a.s) +
          (a.n_src > 1 ? ' <b>+' + (a.n_src - 1) + '</b>' : '') + ' · ' + esc(ilYA(a.d)) +
          (a.mn ? ' · ' + esc(a.mn) + ' min' : '') +
          (a.neuf ? ' · <span class="neuf">nouveau</span>' : '') +
          (a.entier ? '<br><span class="ok">✓ lisible en entier</span>' : '') + '</div>' +
      '</div>' +
      (a.u ? '<a class="tout" href="' + esc(a.u) + '" target="_blank" rel="noopener" aria-label="' + esc(a.t) + '"></a>' : '') +
    '</article>';
  }

  /* un titre de rubrique */
  function rubrique(titre, sous) {
    return '<div class="mur-rub"><b>' + titre + '</b>' + (sous ? '<span>' + sous + '</span>' : '') + '</div>';
  }

  function injectStyles() {
    if (document.getElementById('v2-infos-css')) return;
    var st = document.createElement('style'); st.id = 'v2-infos-css';
    st.textContent = [
      /* ══════════ TYPOGRAPHIE DE PRESSE ══════════
         Newsreader (SIL OFL, 132 Ko, déjà sur le disque) UNIQUEMENT pour les titres
         d'articles : c'est le geste qui fait la différence entre une liste de liens
         et un journal. Le reste du CRM ne bouge pas, il reste en Inter.
         ⚠️ Une police citée dans une pile sans @font-face retombe en SILENCE sur la
            police système. Elle est donc déclarée ici, et la sonde MESURE la largeur
            d'un texte témoin pour prouver qu'elle s'affiche vraiment. */
      "@font-face{font-family:'Newsreader';src:url('fonts/newsreader.woff2') format('woff2');" +
        "font-weight:200 800;font-style:normal;font-display:swap}",
      "@font-face{font-family:'Newsreader';src:url('fonts/newsreader-italic.woff2') format('woff2');" +
        "font-weight:200 800;font-style:italic;font-display:swap}",
      ".inf2{--serif:'Newsreader',Georgia,'Times New Roman',serif}",
      /* le magazine respire : cet écran est plus large que le reste du CRM */
      '.v2-wrap.inf2{max-width:1360px}',

      /* accents locaux (mappés sur les tokens de v2.css) */
      '.inf2 .a-rose{--acc:var(--c-rose);--acc-t:var(--c-rose-txt)}',
      '.inf2 .a-amber{--acc:var(--c-amber);--acc-t:var(--c-amber-txt)}',
      '.inf2 .a-blue{--acc:var(--ip-blue);--acc-t:var(--ip-blue)}',
      '.inf2 .a-green{--acc:var(--c-opp);--acc-t:var(--c-mint-txt)}',
      '.inf2 .a-violet{--acc:var(--c-cat);--acc-t:var(--c-cat)}',
      '.inf2 .a-muted{--acc:var(--muted);--acc-t:var(--muted)}',
      '.inf2 .a-teal{--acc:var(--c-froid);--acc-t:#006F80}',


      /* ── « Ce qui touche tes marges » (Journal officiel) ──
         Éclairé, pas encadré de rouge : c'est important, pas alarmant. */

      /* ── filtres rapides ── */

      /* ── sections ── */
      '.inf2 .inf-sec{margin-bottom:var(--section-gap)}',

      /* ── listes ── */

      /* ── fil : chips + recherche ── */
      '.inf2 .brf-chips{display:flex;gap:var(--gap-tight);flex-wrap:wrap;margin-bottom:var(--sp-3)}',
      '.inf2 .brf-chip{display:inline-flex;align-items:center;gap:6px;min-height:var(--tap-min);padding:0 14px;border-radius:var(--r-pill);border:1px solid var(--line-strong);background:var(--card);font-size:12.5px;font-weight:650;color:var(--ip-ink-2);cursor:pointer;transition:all .18s var(--ease-soft)}',
      '.inf2 .brf-chip i{font:700 11px/1 var(--mono);font-style:normal;color:var(--muted-2)}',
      '.inf2 .brf-chip:hover{border-color:var(--acc,var(--ip-blue))}',
      '.inf2 .brf-chip.on{background:var(--acc,var(--ip-blue));border-color:var(--acc,var(--ip-blue));color:#fff}',
      '.inf2 .brf-chip.on i{color:rgba(255,255,255,.75)}',
      '.inf2 .brf-search{display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--line-strong);border-radius:var(--r-control);padding:0 var(--sp-3);margin-bottom:var(--sp-3);color:var(--muted-2)}',
      /* 16px minimum : en dessous, iOS zoome sur le champ au focus */
      '.inf2 .brf-search input{flex:1 1 auto;min-width:0;border:0;outline:0;background:transparent;font:400 16px/1 var(--font);color:var(--ip-ink);min-height:var(--tap-min);padding:0}',
      '.inf2 .brf-search input::placeholder{color:var(--muted-2)}',

      /* ── opportunités Intégral ── */

      /* ── archive ── */
      '.inf2 .brf-arch{display:flex;flex-direction:column;gap:var(--sp-3)}',
      '.inf2 .brf-day{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:var(--sp-4);box-shadow:var(--sh-1)}',
      '.inf2 .brf-day-d{font:700 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted-2);margin-bottom:10px}',
      '.inf2 .brf-day-l{display:flex;flex-direction:column;gap:7px}',
      '.inf2 .brf-day-l a{display:flex;align-items:flex-start;gap:9px;font-size:13.5px;line-height:1.4;color:var(--ip-ink-2);text-decoration:none;min-height:28px}',
      '.inf2 .brf-day-l a:hover{color:var(--ip-blue)}',
      '.inf2 .brf-day-l i{flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--acc);margin-top:6px}',

      /* ── divers ── */
      '.inf2 .brf-foot{font-size:11.5px;line-height:1.6;color:var(--muted-2);text-align:center;padding:var(--sp-5) 0 var(--sp-2);border-top:1px solid var(--line-2)}',
      '.inf2 .inf-allhidden{text-align:center;font-size:13.5px;color:var(--muted);padding:var(--sp-5);background:var(--card-2);border-radius:var(--r-md)}',
      '.inf2 .inf-load{display:flex;align-items:center;justify-content:center;gap:12px;padding:var(--sp-8) var(--sp-4);color:var(--muted);font-size:14px}',
      '.inf2 .inf-spin{width:20px;height:20px;border-radius:50%;border:2.4px solid var(--line-strong);border-top-color:var(--ip-blue);animation:infspin .8s linear infinite}',
      '@keyframes infspin{to{transform:rotate(360deg)}}',
      '@media(prefers-reduced-motion:reduce){.inf2 .inf-spin{animation-duration:2.4s}}',
      '.inf2 .inf-empty{text-align:center;padding:var(--sp-8) var(--sp-4);background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1)}',
      '.inf2 .inf-empty-ic{color:var(--muted-2);margin-bottom:12px}',
      '.inf2 .inf-empty-t{font-size:16.5px;font-weight:700;color:var(--ip-ink);margin-bottom:7px}',
      '.inf2 .inf-empty-d{font-size:13.5px;color:var(--muted);max-width:38ch;margin:0 auto;line-height:1.5}',

      /* ══════════ TÊTE COMPACTE ══════════
         « Le Mur » ne s'ouvre pas sur un grand bandeau : le mur commence tout de
         suite. La tête tient sur une ligne, titre à gauche, chiffres à droite. */
      '.inf2 .mur-tete{display:flex;align-items:flex-end;justify-content:space-between;gap:var(--sp-5);flex-wrap:wrap;padding:var(--sp-5) 0 var(--sp-5)}',
      '.inf2 .mur-d{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;font:600 11px/1 var(--mono);letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:11px}',
      '.inf2 .mur-d i{width:7px;height:7px;border-radius:50%;background:var(--c-rose);display:inline-block}',
      '.inf2 .mur-d b{color:var(--c-mint-txt)}',
      '.inf2 .mur-tete h1{font-family:var(--serif);font-weight:500;font-size:clamp(34px,5.4vw,60px);line-height:.95;letter-spacing:-.033em;margin:0;color:var(--ip-ink)}',
      '.inf2 .mur-tete-d{display:flex;gap:var(--sp-5);flex-wrap:wrap;font:600 11px/1 var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--muted-2);padding-bottom:6px}',
      '.inf2 .mur-tete-d b{display:block;font-size:19px;color:var(--ip-ink);letter-spacing:-.02em;margin-bottom:5px;font-variant-numeric:tabular-nums}',
      '.inf2 .mur-act{display:flex;gap:var(--sp-2);flex-wrap:wrap;width:100%}',
      '.inf2 .inf-copy,.inf2 .inf-ghost{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap-min);padding:0 18px;border-radius:var(--r-btn);font-size:14px;font-weight:650;cursor:pointer;transition:transform .2s var(--ease),box-shadow .2s var(--ease)}',
      '.inf2 .inf-copy{border:0;background:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}',
      '.inf2 .inf-copy:hover{transform:translateY(var(--mo-lift));box-shadow:var(--sh-blue-h)}',
      '.inf2 .inf-ghost{border:1px solid var(--line-strong);background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-1)}',
      '.inf2 .inf-ghost:hover{transform:translateY(var(--mo-lift));box-shadow:var(--sh-2)}',

      /* ══════════ TITRE DE RUBRIQUE ══════════ */
      '.inf2 .mur-rub{display:flex;align-items:baseline;gap:var(--sp-3);flex-wrap:wrap;padding-bottom:var(--sp-3);border-bottom:1.5px solid var(--ip-ink);margin-bottom:var(--sp-4)}',
      '.inf2 .mur-rub b{font-family:var(--serif);font-weight:600;font-size:24px;letter-spacing:-.02em;color:var(--ip-ink)}',
      '.inf2 .mur-rub span{font:600 11px/1 var(--mono);letter-spacing:.11em;text-transform:uppercase;color:var(--muted-2)}',
      '.inf2 .mur-sec{margin-bottom:var(--section-gap)}',

      /* ══════════ COUVERTURE ══════════ */
      '.inf2 .mq-cov{position:relative;display:block;overflow:hidden;background:var(--surf-sunken)}',
      '.inf2 .mq-cov.r-4x5{aspect-ratio:4/5}.inf2 .mq-cov.r-3x4{aspect-ratio:3/4}',
      '.inf2 .mq-cov.r-1x1{aspect-ratio:1/1}.inf2 .mq-cov.r-4x6{aspect-ratio:4/6}',
      '.inf2 .mq-cov.r-21x9{aspect-ratio:21/9}',
      '.inf2 .mq-cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;transition:transform .6s var(--ease)}',
      /* la planche dessinée, TOUJOURS sous la photo : si la photo ne charge pas, elle
         réapparaît seule. Jamais de trou dans le mur, jamais de rectangle gris. */
      '.inf2 .mq-plaque{position:absolute;inset:0;background:linear-gradient(152deg,color-mix(in srgb,var(--acc) 92%,#0B1020) 0%,color-mix(in srgb,var(--acc) 64%,#fff) 48%,color-mix(in srgb,var(--acc) 34%,#fff) 100%)}',
      '.inf2 .mq-plaque::before{content:"";position:absolute;inset:0;background:radial-gradient(62% 74% at 24% 8%,rgba(255,255,255,.48),transparent 60%),radial-gradient(52% 62% at 88% 98%,rgba(11,16,32,.26),transparent 62%)}',
      '.inf2 .mq-plaque::after{content:"";position:absolute;inset:0;opacity:.55;background:repeating-linear-gradient(58deg,rgba(255,255,255,.16) 0 1px,transparent 1px 12px)}',
      '.inf2 .veil{position:absolute;inset:0;z-index:2;background:linear-gradient(0deg,rgba(8,11,20,.94) 0%,rgba(8,11,20,.62) 40%,rgba(8,11,20,.04) 78%)}',

      /* ══════════ LA TUILE DE TÊTE ══════════ */
      '.inf2 .mur-une{position:relative;border-radius:var(--r-card);overflow:hidden;background:#10131C;margin-bottom:var(--section-gap);box-shadow:var(--sh-3)}',
      '.inf2 .mur-une:hover .mq-cov img{transform:scale(1.035)}',
      '.inf2 .mur-une .b{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:var(--sp-7) var(--sp-7) var(--sp-6);max-width:900px}',
      '.inf2 .mur-une .cat,.inf2 .tu .cat{display:inline-block;font:700 9.5px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#fff;background:var(--acc);padding:7px 12px;border-radius:var(--r-pill);margin-bottom:12px}',
      '.inf2 .mur-une h2{font-family:var(--serif);font-weight:600;font-size:clamp(25px,3.6vw,46px);line-height:1.06;letter-spacing:-.026em;color:#fff;margin:0 0 12px;text-wrap:balance}',
      '.inf2 .mur-une p{font-size:15.5px;line-height:1.55;color:rgba(255,255,255,.82);margin:0 0 13px;max-width:64ch}',
      '.inf2 .pour{display:inline-flex;gap:10px;align-items:center;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);border-radius:var(--r-pill);padding:9px 16px;color:#fff;font-size:13.5px;font-weight:600;margin-bottom:12px}',
      '.inf2 .pour b{font:700 9px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#8FB4FF}',
      '.inf2 .mur-une .f,.inf2 .tu .f{font:600 10.5px/1.6 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.66)}',
      '.inf2 .f .ok{color:#7BE0AF}.inf2 .f b{color:#fff}',
      '.inf2 .f .neuf{color:#7BE0AF;font-weight:700}',
      /* le lien couvre toute la tuile : une seule cible, très grande */
      '.inf2 .tout{position:absolute;inset:0;z-index:4}',

      /* ══════════ LE MUR ══════════ */
'.inf2 .mur{display:flex;align-items:flex-start;gap:var(--sp-3)}',
      '.inf2 .mur-col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:var(--sp-3)}',
      '.inf2 .tu{position:relative;margin:0 0 var(--sp-3);border-radius:var(--r-md);overflow:hidden;background:#10131C;box-shadow:var(--sh-1);transition:transform .3s var(--ease),box-shadow .3s var(--ease)}',
      
      '.inf2 .tu:hover{transform:translateY(var(--mo-lift));box-shadow:var(--sh-2)}',
      '.inf2 .tu:hover .mq-cov img{transform:scale(1.06)}',
      '.inf2 .tu .b{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:var(--sp-4) 17px 16px}',
      '.inf2 .tu h3{font-family:var(--serif);font-weight:600;font-size:19px;line-height:1.2;letter-spacing:-.014em;color:#fff;margin:0 0 9px;text-wrap:balance}',
      '.inf2 .tu.xl h3{font-size:23px}',

      /* ══════════ LE RADAR, EN JETONS ══════════ */

      /* ══════════ PASTILLES DE RUBRIQUE ══════════ */
      '.inf2 .brf-chips{display:flex;gap:var(--gap-tight);flex-wrap:wrap;margin-bottom:var(--sp-3)}',
      '.inf2 .brf-chip{display:inline-flex;align-items:center;gap:7px;min-height:var(--tap-min);padding:0 15px;border-radius:var(--r-pill);border:1.5px solid var(--line-strong);background:var(--card);font-size:12.5px;font-weight:650;color:var(--ip-ink-2);cursor:pointer;transition:all .18s var(--ease-soft)}',
      '.inf2 .brf-chip .pt{width:8px;height:8px;border-radius:50%;background:var(--acc,var(--muted));display:inline-block}',
      '.inf2 .brf-chip i{font:700 11px/1 var(--mono);font-style:normal;color:var(--muted-2)}',
      '.inf2 .brf-chip:hover{border-color:var(--acc,var(--ip-blue))}',
      '.inf2 .brf-chip.on{background:var(--ip-ink);border-color:var(--ip-ink);color:#fff}',
      '.inf2 .brf-chip.on i{color:rgba(255,255,255,.7)}',
      '.inf2 .brf-search{display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--line-strong);border-radius:var(--r-control);padding:0 var(--sp-3);margin-bottom:var(--sp-4);color:var(--muted-2)}',
      /* 16px minimum : en dessous, iOS zoome sur le champ au focus */
      '.inf2 .brf-search input{flex:1 1 auto;min-width:0;border:0;outline:0;background:transparent;font:400 16px/1 var(--font);color:var(--ip-ink);min-height:var(--tap-min);padding:0}',
      '.inf2 .brf-search input::placeholder{color:var(--muted-2)}',
      /* ── téléphone ── */
      '@media(max-width:640px){',
      '.inf2 .mq-cov.r-21x9{aspect-ratio:4/5}',
      '.inf2 .mur-une{border-radius:var(--r-md)}',
      '.inf2 .mur-une .b{padding:var(--sp-5) var(--sp-4) var(--sp-4)}',
      '.inf2 .mur-tete{padding:var(--sp-4) 0}',
      '.inf2 .mur-tete-d{gap:var(--sp-4);font-size:10px}',
      '.inf2 .mur-tete-d b{font-size:16px}',
      '.inf2 .tu h3{font-size:15.5px;line-height:1.24}.inf2 .tu.xl h3{font-size:18px}',
      '.inf2 .tu .b{padding:var(--sp-3) 13px 12px}',
      '.inf2 .tu .cat{font-size:8.5px;padding:5px 9px;margin-bottom:9px}',
      '.inf2 .tu .f{font-size:9.5px;line-height:1.5}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }
})();
