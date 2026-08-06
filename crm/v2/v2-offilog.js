/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Offilog & concurrents" (pages.offilog)
   Catalogue PARAPHARMA = meilleures ventes Offilog (live, connecté),
   classées par ventes décroissantes, AVEC PHOTOS + prix Offilog.
   Enrichi par EAN avec la veille prix (achat IP vs prix publics
   E.Leclerc / Drakkars / Cap3000) depuis OFFILOG.
   ── Même DA que le catalogue grossiste · vanilla · zéro emoji ──
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  // Dossier de CE module (crm/v2/) — pour charger ses fichiers data même quand
  // la page hôte est ailleurs (ex : app OPSO opso/v2/ qui charge depuis ../../crm/v2/).
  var MOD_BASE = (function () {
    try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[?#].*$/, '').replace(/[^/]+$/, ''); } catch (e) {}
    return '';
  })();

  var S = { chip: 'all', q: '', page: 0, sel: null, sort: 'ventes', adv: false };
  var firstPaint = true; // cascade d'entrée réservée au 1er affichage de la grille
  var PER_PAGE = 60;

  // Sélection pour la fiche marketing parapharma
  var mktSel = new Set();
  var mktTitle = '';

  var CHIPS = [
    { k: 'all',         label: 'Tout',           sc: '#0050E6' },
    { k: 'alerte',      label: 'Concurrent moins cher', sc: '#6D4FC4' },
    { k: 'pzcheaper',   label: 'Moins cher sur Pharmazon', sc: 'var(--ip-blue-d)' },
    { k: 'sante',       label: 'Santé',          sc: '#1E9E6A' },
    { k: 'beaute-et-soins', label: 'Beauté & soins', sc: '#6D4FC4' },
    { k: 'hygiene',     label: 'Hygiène',        sc: 'var(--c-froid)' },
    { k: 'bebe',        label: 'Bébé',           sc: '#C7791A' },
    { k: 'solaires',    label: 'Solaires',       sc: '#C7791A' },
    { k: 'veterinaire', label: 'Vétérinaire',    sc: '#737A8C' },
  ];
  var CHIP_BY_KEY = {}; CHIPS.forEach(function (c) { CHIP_BY_KEY[c.k] = c; });

  var CONC = [
    // Concurrence EN LIGNE grand public (TTC). Drakkars/Cap3000 (enseignes de niche)
    // retirés le 06/08/2026 sur décision de Will : on ne garde que la vraie concurrence
    // en ligne. Pharma-GDD à ajouter ici dès que ses prix seront scrapés (aujourd'hui
    // le repo n'a que ses images, pas ses prix). L'axe PRO Offilog vs Pharmazon vit
    // plus bas (pzIndex/inspector), inchangé.
    { key: 'prix_leclerc',  label: 'E.Leclerc', color: '#0066B3' },
  ];

  // ── Index ─────────────────────────────────────
  var idxBuilt = false, items = null, byEan = null, itemsById = null;
  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }
  function numOr0(v) { return (typeof v === 'number' && isFinite(v) && v > 0) ? v : 0; }

  function offIndex() {
    var m = new Map();
    (window.OFFILOG || []).forEach(function (o) { if (o.ean != null) m.set(String(o.ean), o); });
    return m;
  }
  function minConc(o) {
    var mm = 0;
    for (var i = 0; i < CONC.length; i++) {
      var v = numOr0(o[CONC[i].key]);
      if (v > 0 && (mm === 0 || v < mm)) mm = v;
    }
    return mm;
  }

  // index Pharmazon par EAN (prix d'achat sur l'autre plateforme)
  function pzIndex() {
    var m = new Map();
    (window.PHARMAZON || []).forEach(function (p) {
      if (p.ean && p.prix_final != null) {
        var e = String(p.ean);
        if (!m.has(e)) m.set(e, { price: numOr0(p.prix_final), cat: numOr0(p.prix_catalogue), labo: p.labo || '', name: p.name || '' });
      }
    });
    return m;
  }

  function buildIndex() {
    if (idxBuilt) return;
    var offByEan = offIndex();
    var pzByEan = pzIndex();
    items = (window.OFFILOG_BEST || []).map(function (b) {
      var o = b.ean ? offByEan.get(String(b.ean)) : null;
      var achat = o ? numOr0(o.prix_offilog) : 0;
      var conc = {};
      var mc = 0, hasC = false;
      if (o) {
        CONC.forEach(function (c) { var v = numOr0(o[c.key]); conc[c.key] = v; if (v > 0) { hasC = true; if (mc === 0 || v < mc) mc = v; } });
      }
      var alert = achat > 0 && mc > 0 && mc < achat;
      var price = numOr0(b.price);
      var pz = b.ean ? pzByEan.get(String(b.ean)) : null;
      // comparaison achat Offilog vs Pharmazon
      var pzCheaper = !!(pz && pz.price > 0 && price > 0 && pz.price < price);
      return {
        rank: b.rank, id: b.id, name: b.name, brand: b.brand || '',
        price: price, ean: b.ean || '', img: b.img || '', cat: b.cat || '',
        url: b.url || '', univers: o ? (o.univers || '') : '',
        achat: achat, conc: conc, hasConc: hasC, minConc: mc, alert: alert, matched: !!o,
        pz: pz || null, pzCheaper: pzCheaper
      };
    });
    byEan = new Map();
    itemsById = new Map();
    items.forEach(function (it) { if (it.ean) byEan.set(String(it.ean), it); itemsById.set(String(it.id), it); });
    idxBuilt = true;
  }

  function matchChip(it, k) {
    if (k === 'all') return true;
    if (k === 'alerte') return it.alert;
    if (k === 'pzcheaper') return it.pzCheaper;
    return it.cat === k;
  }
  function filteredBase() {
    var q = S.q.trim().toLowerCase();
    var base = items;
    if (q) base = base.filter(function (it) {
      return norm(it.name).indexOf(q) >= 0 || norm(it.brand).indexOf(q) >= 0 || norm(it.ean).indexOf(q) >= 0;
    });
    return base;
  }
  function sorted(list) {
    var a = list.slice();
    if (S.sort === 'prix_asc') a.sort(function (x, y) { return (x.price || 1e9) - (y.price || 1e9); });
    else if (S.sort === 'prix_desc') a.sort(function (x, y) { return (y.price || 0) - (x.price || 0); });
    else a.sort(function (x, y) { return x.rank - y.rank; }); // ventes
    return a;
  }
  function counts(base) {
    var c = { all: base.length, alerte: 0, pzcheaper: 0 };
    CHIPS.forEach(function (ch) { if (c[ch.k] == null) c[ch.k] = 0; });
    for (var i = 0; i < base.length; i++) {
      var it = base[i];
      if (it.alert) c.alerte++;
      if (it.pzCheaper) c.pzcheaper++;
      if (c[it.cat] != null) c[it.cat]++;
    }
    return c;
  }

  // ── Verdict band ──────────────────────────────
  // Message limpide : « où suis-je battu / où suis-je bon ». On mène avec l'alerte
  // (concurrent public sous ton prix d'achat IP — rouge SACRÉ), puis « bien placé »
  // (vert). Les autres chiffres (total / prix moyen / réf. croisées) passent en
  // petit, discrets, sous les deux tuiles-verdict.
  function verdictBand(list) {
    var n = list.length, nAlert = 0, nMatch = 0, nGood = 0, pSum = 0, pN = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it.alert) nAlert++;
      if (it.matched) nMatch++;
      if (it.achat > 0 && it.minConc > 0 && !it.alert) nGood++;   // « bien placé » = produit réellement comparé (achat + prix concurrent) où ton achat tient (avant : comptait des produits jamais comparés)
      if (it.price > 0) { pSum += it.price; pN++; }
    }
    // Tuile ALERTE (rouge) — cliquable : filtre direct sur les produits battus.
    var alertActive = S.chip === 'alerte';
    var alertTile = '<button type="button" class="off-verdict off-verdict-bad' + (nAlert > 0 ? ' hot' : ' cold') + (alertActive ? ' active' : '') +
        '" onclick="V2.offFilter(\'' + (alertActive ? 'all' : 'alerte') + '\')" ' +
        'title="Produits où un prix public concurrent passe sous ton prix d\'achat IP">' +
        '<span class="off-verdict-ic">' + ICO('alert', 20, 2) + '</span>' +
        '<span class="off-verdict-txt">' +
          '<span class="off-verdict-v mono" data-count>' + V2.fmtNum(nAlert) + '</span>' +
          '<span class="off-verdict-l">' + (nAlert > 1 ? 'produits où un concurrent est moins cher que ton achat' : 'produit où un concurrent est moins cher que ton achat') + '</span>' +
        '</span>' +
        '<span class="off-verdict-go">' + (alertActive ? 'Tout revoir' : 'Les voir') + ' ' + ICO('chev', 15, 2.2) + '</span>' +
      '</button>';
    // Tuile BIEN PLACÉ (vert) — calme, informative.
    var goodTile = '<div class="off-verdict off-verdict-ok">' +
        '<span class="off-verdict-ic">' + ICO('check', 20, 2.4) + '</span>' +
        '<span class="off-verdict-txt">' +
          '<span class="off-verdict-v mono" data-count>' + V2.fmtNum(nGood) + '</span>' +
          '<span class="off-verdict-l">produits où ton achat tient face aux prix publics</span>' +
        '</span>' +
      '</div>';
    // Ligne secondaire discrète : total, prix moyen, réf. croisées.
    var meta = '<div class="off-verdict-meta">' +
        '<span><b class="mono">' + V2.fmtNum(n) + '</b> produits</span>' +
        '<span class="off-dot">·</span>' +
        '<span>prix Offilog moyen <b class="mono">' + (pN ? V2.fmtEur(pSum / pN) : '—') + '</b></span>' +
        '<span class="off-dot">·</span>' +
        '<span><b class="mono">' + V2.fmtNum(nMatch) + '</b> réf. comparées aux concurrents</span>' +
      '</div>';
    return '<div class="off-verdict-wrap">' + alertTile + goodTile + '</div>' + meta;
  }

  // ── Squelette de grille (forme des futures cartes) ──
  // Remplace le spinner sur la surface lourde ; shimmer global (.mo-skeleton)
  function skeletonGrid(n) {
    var one =
      '<div class="off-sk-card">' +
        '<div class="off-sk-media mo-skeleton"></div>' +
        '<div class="off-sk-body">' +
          '<div class="off-sk-line mo-skeleton" style="width:42%"></div>' +
          '<div class="off-sk-line mo-skeleton" style="width:88%"></div>' +
          '<div class="off-sk-line mo-skeleton" style="width:64%"></div>' +
          '<div class="off-sk-price mo-skeleton"></div>' +
        '</div>' +
      '</div>';
    var out = '';
    for (var i = 0; i < (n || 12); i++) out += one;
    return '<div class="off-grid" aria-busy="true">' + out + '</div>';
  }

  // ── Carte produit (grille, avec photo) ────────
  function card(it) {
    var sel = (S.sel != null && String(it.id) === String(S.sel)) ? ' sel' : '';
    var img = it.img
      ? '<img class="off-card-img" src="' + esc(it.img) + '" loading="lazy" alt="" onerror="V2.offImgFail(this)">'
      : '<div class="off-card-noimg">' + ICO('pill', 30, 1.4) + '</div>';
    var onMkt = mktSel.has(String(it.id));
    var alertCls = it.alert ? ' alert' : '';
    // alerte prix (rouge SACRÉ) : un concurrent public passe SOUS ton prix d'achat IP.
    // pastille dédiée dans le coin média + rappel chiffré sous le prix.
    var alertFlag = it.alert
      ? '<span class="off-card-flag" title="Un concurrent est moins cher que ton prix d\'achat">' + ICO('alert', 13, 2.2) + ' Alerte prix</span>' : '';
    var concBelow = it.alert && it.minConc > 0
      ? '<span class="off-card-conc mono" title="Un concurrent public passe sous ton prix d\'achat Intégral">conc. ' + V2.fmtEur(it.minConc) + (it.achat > 0 ? ' &lt; achat ' + V2.fmtEur(it.achat) : '') + '</span>' : '';
    return '<div class="off-card' + sel + alertCls + '" data-id="' + esc(it.id) + '" onclick="V2.offSelect(\'' + esc(it.id) + '\')">' +
      '<div class="off-card-media">' +
        '<span class="off-rank mono">#' + it.rank + '</span>' +
        '<button class="off-mkt-add' + (onMkt ? ' on' : '') + '" onclick="event.stopPropagation();V2.offMktToggle(\'' + esc(it.id) + '\',this)" title="Ajouter à la fiche marketing">' + ICO(onMkt ? 'check' : 'plus', 15) + '</button>' +
        img +
        alertFlag +
      '</div>' +
      '<div class="off-card-body">' +
        (it.brand ? '<div class="off-card-brand">' + esc(it.brand) + '</div>' : '<div class="off-card-brand">&nbsp;</div>') +
        '<div class="off-card-name">' + esc(it.name) + '</div>' +
        '<div class="off-card-price mono">' + (it.price > 0 ? V2.fmtEur(it.price) : '—') +
          (it.pz && it.pz.price > 0 ? '<span class="off-card-pz' + (it.pzCheaper ? ' win' : '') + '">Pharmazon ' + V2.fmtEur(it.pz.price) + '</span>' : '') +
          concBelow + '</div>' +
      '</div>' +
    '</div>';
  }

  // ── Inspecteur DÉTAIL ─────────────────────────
  function priceCmpRows(it) {
    if (!it.matched) {
      return '<div class="off-cmp-row muted"><span class="off-cmp-na">Pas de données concurrents pour ce produit (hors périmètre veille).</span></div>';
    }
    // ligne de référence : le prix d'achat IP sert de seuil — tout ce qui passe dessous est en rouge
    var ref = it.achat > 0
      ? '<div class="off-cmp-ref"><span class="off-cmp-src"><span class="dot" style="background:var(--ip-blue)"></span>Ton achat IP (HT)</span>' +
          '<span class="off-cmp-price mono">' + V2.fmtEur(it.achat) + '</span><span class="off-cmp-delta"></span></div>' : '';
    var rows = CONC.map(function (src) {
      var v = numOr0(it.conc[src.key]);
      if (v <= 0) return '<div class="off-cmp-row muted"><span class="off-cmp-src"><span class="dot" style="background:' + src.color + '"></span>' + src.label + '</span><span class="off-cmp-na">prix non connu</span><span class="off-cmp-delta"></span></div>';
      var below = it.achat > 0 && v < it.achat;
      var delta = it.achat > 0 ? (v - it.achat) : 0;
      return '<div class="off-cmp-row' + (below ? ' below' : '') + '">' +
        '<span class="off-cmp-src"><span class="dot" style="background:' + src.color + '"></span>' + src.label + '</span>' +
        '<span class="off-cmp-price ' + (below ? 'bad' : '') + ' mono">' + V2.fmtEur(v) + '</span>' +
        (it.achat > 0 ? '<span class="off-cmp-delta ' + (below ? 'bad' : 'ok') + '">' + (delta >= 0 ? '+' : '') + V2.fmtEur(delta) + '</span>' : '<span class="off-cmp-delta"></span>') +
      '</div>';
    }).join('');
    return ref + rows;
  }
  function inspector(it) {
    var img = it.img ? '<div class="off-insp-img"><img src="' + esc(it.img) + '" loading="lazy" alt="" onerror="this.parentNode.style.display=\'none\'"></div>' : '';
    function kpi(l, v, col) { return '<div class="off-kpi"><div class="off-kpi-l">' + l + '</div><div class="off-kpi-v"' + (col ? ' style="color:' + col + '"' : '') + '>' + v + '</div></div>'; }
    var pzBlock = '';
    if (it.pz && it.pz.price > 0) {
      var oP = it.price, pP = it.pz.price;
      var cheaper = (pP < oP) ? 'Pharmazon' : (oP < pP ? 'Offilog' : '');
      var diff = Math.abs(oP - pP);
      pzBlock = '<div class="off-pz">' +
        '<div class="off-pz-l">Comparatif d\'achat · Offilog vs Pharmazon</div>' +
        '<div class="off-pz-row">' +
          '<div class="off-pz-cell' + (cheaper === 'Offilog' ? ' win' : '') + '"><span>Offilog</span><b class="mono">' + (oP > 0 ? V2.fmtEur(oP) : '—') + '</b></div>' +
          '<div class="off-pz-cell' + (cheaper === 'Pharmazon' ? ' win' : '') + '"><span>Pharmazon' + (it.pz.labo ? ' · ' + esc(it.pz.labo) : '') + '</span><b class="mono">' + V2.fmtEur(pP) + '</b></div>' +
        '</div>' +
        (cheaper ? '<div class="off-pz-note">Moins cher sur <b>' + cheaper + '</b> · écart ' + V2.fmtEur(diff) + '</div>' : '<div class="off-pz-note">Même prix sur les deux plateformes</div>') +
      '</div>';
    }
    var badges = '<span class="off-badge" style="--bc:var(--pil-froid)">#' + it.rank + ' ventes</span>' +
      (it.cat && CHIP_BY_KEY[it.cat] ? '<span class="off-badge" style="--bc:' + CHIP_BY_KEY[it.cat].sc + '">' + esc(CHIP_BY_KEY[it.cat].label) + '</span>' : '') +
      (it.univers && it.univers !== 'Non classé' ? '<span class="off-badge" style="--bc:#6D4FC4">' + esc(it.univers) + '</span>' : '');
    return '<div class="off-insp' + (S.sel != null ? ' open' : '') + '">' +
      '<div class="off-insp-head">' +
        '<div style="min-width:0"><div class="off-insp-name">' + esc(it.name) + '</div>' +
          '<div class="off-insp-sub">' + esc(it.brand || '') + '</div>' +
          '<div class="off-insp-cip mono">EAN ' + esc(it.ean || '—') + '</div></div>' +
        '<button class="off-insp-x" onclick="V2.offSelect(null)" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
      '</div>' +
      '<div class="off-insp-body">' +
        img +
        '<div class="off-badges">' + badges + '</div>' +
        '<div class="off-kpi-grid">' +
          kpi('Prix Offilog', it.price > 0 ? V2.fmtEur(it.price) : '—', 'var(--pil-froid)') +
          kpi('Rang ventes', '#' + it.rank) +
          kpi('Achat IP (HT)', it.achat > 0 ? V2.fmtEur(it.achat) : '—', it.achat > 0 ? 'var(--ok)' : 'var(--muted-2)') +
          kpi('Concurrent mini', it.minConc > 0 ? V2.fmtEur(it.minConc) : '—', '') +
        '</div>' +
        pzBlock +
        '<div class="off-cmp"><div class="off-cmp-l">Prix public concurrents <span>(TTC)</span></div>' + priceCmpRows(it) + '</div>' +
        '<div class="off-insp-cta"><button class="v2-btn v2-btn-primary" onclick="V2.offAddToFiche(\'' + esc(it.ean || it.id) + '\')">' + ICO('plus', 17) + ' Ajouter à une fiche commerciale</button>' +
          (it.url ? '<a class="v2-btn v2-btn-ghost" href="' + esc(it.url) + '" target="_blank" rel="noopener" style="margin-top:8px">Voir sur Offilog</a>' : '') + '</div>' +
      '</div>' +
    '</div>';
  }

  // ── Handlers ──────────────────────────────────
  // photo cassée → placeholder propre (jamais de case blanche)
  V2.offImgFail = function (img) {
    try {
      img.onerror = null;
      var m = img.parentNode; if (!m) return;
      if (img.remove) img.remove(); else m.removeChild(img);
      var d = document.createElement('div');
      d.className = 'off-card-noimg';
      d.innerHTML = ICO('pill', 30, 1.4);
      m.appendChild(d);
    } catch (e) {}
  };

  // FLIP par famille/alertes : on mémorise la position des cartes AVANT le re-render,
  // le passage motion post-render (voir fin de render) rejoue le repositionnement.
  var flipRects = null;
  function captureCardRects() {
    if (!V2.motion || V2.motion.reduced()) { flipRects = null; return; }
    var grid = document.querySelector('.off-grid');
    if (!grid) { flipRects = null; return; }
    flipRects = new Map();
    var cards = grid.querySelectorAll('.off-card');
    for (var i = 0; i < cards.length; i++) {
      var id = cards[i].getAttribute('data-id');
      if (id != null) flipRects.set(String(id), cards[i].getBoundingClientRect());
    }
  }

  V2.offFilter = function (k) {
    captureCardRects(); // repositionnement fluide des cartes qui restent visibles
    S.chip = k; S.page = 0;
    // si on choisit une catégorie (hors verdicts), on ouvre les filtres avancés pour rester cohérent
    if (k !== 'all' && k !== 'alerte' && k !== 'pzcheaper') S.adv = true;
    V2.render();
  };
  V2.offToggleAdv = function () { S.adv = !S.adv; V2.render(); };
  V2.offSearch = function (val) { S.q = val || ''; S.page = 0; rerenderKeepFocus(); };
  V2.offSort = function (v) { S.sort = v; S.page = 0; V2.render(); };
  V2.offPage = function (p) { S.page = p; V2.render(); try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {} };
  V2.offSelect = function (id) {
    S.sel = (id == null || (S.sel != null && String(S.sel) === String(id))) ? null : id;
    V2.render();
  };
  V2.offAddToFiche = function (key) {
    var it = byEan.get(String(key)) || items.filter(function (x) { return String(x.id) === String(key); })[0];
    if (!it) return;
    if (!V2.ficheCart) { V2.toast('Module fiches indisponible', 'error'); return; }
    if (V2.ficheCart.has(it.ean || it.id)) { V2.toast('Déjà dans la fiche en cours', 'warn'); return; }
    var n = V2.ficheCart.add({
      cip13: it.ean || it.id, designation: it.name,
      prix_ip: it.achat || it.price || null, prix_ht: it.price || null,
      remise_pct: null, is_froid: false, src: 'offilog'
    });
    V2.toast('Ajouté à la fiche en cours (' + n + ')');
  };

  function rerenderKeepFocus() {
    V2.render();
    var inp = document.getElementById('off-search-input');
    if (inp) { inp.focus(); var v = inp.value; try { inp.setSelectionRange(v.length, v.length); } catch (e) {} }
  }

  // ── Fiche marketing parapharma (sélection + PDF peps) ──
  function updateMktBar() {
    var bar = document.getElementById('off-mktbar');
    if (!bar) return;
    var n = mktSel.size;
    bar.classList.toggle('hidden', n === 0);
    var ns = document.getElementById('off-mkt-n');
    if (ns) ns.textContent = n + ' produit' + (n > 1 ? 's' : '');
  }
  V2.offMktToggle = function (id, btn) {
    id = String(id);
    if (mktSel.has(id)) { mktSel.delete(id); if (btn) { btn.classList.remove('on'); btn.innerHTML = ICO('plus', 15); } }
    else { mktSel.add(id); if (btn) { btn.classList.add('on'); btn.innerHTML = ICO('check', 15); } }
    updateMktBar();
  };
  V2.offMktTitle = function (v) { mktTitle = v; };
  V2.offMktClear = function () { mktSel.clear(); V2.render(); };

  // proxy CORS (weserv) pour que les photos s'affichent dans le PDF/canvas
  function proxImg(u) {
    if (!u) return '';
    return 'https://images.weserv.nl/?url=ssl:' + encodeURIComponent(u.replace(/^https?:\/\//, '')) + '&w=420&output=jpg';
  }
  function mktSelection() {
    var sel = [];
    mktSel.forEach(function (id) { var it = itemsById && itemsById.get(String(id)); if (it) sel.push(it); });
    return sel;
  }
  function mktTitleVal() { return (mktTitle && mktTitle.trim()) ? mktTitle.trim() : 'Notre sélection bien-être'; }

  // HTML du document (partagé aperçu + PDF) — feuille 794px
  function buildMarketingHtml() {
    var sel = mktSelection();
    var title = mktTitleVal();
    var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    var cards = sel.map(function (it) {
      // dataURL local (offilog-img-data.js) si dispo → marche dans le PDF ;
      // sinon URL brute Offilog (affichage écran OK, mais absente du PDF)
      var img = (window.OFFILOG_IMG && window.OFFILOG_IMG[it.id]) ? window.OFFILOG_IMG[it.id] : it.img;
      var price = it.price > 0 ? V2.fmtEur(it.price) : '';
      return '<div style="break-inside:avoid;page-break-inside:avoid;border:1px solid #ECEFF5;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(16,19,28,.05)">' +
        '<div style="height:148px;background:#FBFCFE;display:flex;align-items:center;justify-content:center;padding:12px">' +
          (img ? '<img crossorigin="anonymous" src="' + esc(img) + '" style="max-width:100%;max-height:100%;object-fit:contain">' : '') +
        '</div>' +
        '<div style="padding:11px 13px 13px">' +
          (it.brand ? '<div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:#9AA1B2;font-weight:800">' + esc(it.brand) + '</div>' : '') +
          '<div style="font-size:11.5px;font-weight:700;color:#10131C;line-height:1.32;min-height:30px;margin-top:2px">' + esc((it.name || '').slice(0, 70)) + '</div>' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-top:8px">' +
            '<span style="font-size:19px;font-weight:800;color:#E0556E;letter-spacing:-.02em">' + esc(price) + '</span>' +
            (it.ean ? '<span style="font-size:8px;color:#9AA1B2;font-family:monospace">' + esc(it.ean) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div style="font-family:Satoshi,Inter,Arial,sans-serif;width:794px;box-sizing:border-box;padding:36px 38px;background:#fff;color:#10131C">' +
        '<div style="background:linear-gradient(120deg,#6D4FC4 0%,#0050E6 45%,#00B5D8 100%);border-radius:18px;padding:26px 30px;color:#fff;margin-bottom:22px;position:relative;overflow:hidden">' +
          '<div style="position:absolute;right:-30px;top:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.12)"></div>' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;opacity:.9">Intégral Pharma · Parapharmacie</div>' +
          '<div style="font-size:30px;font-weight:800;letter-spacing:-.02em;margin-top:8px;line-height:1.05">' + esc(title) + '</div>' +
          '<div style="font-size:13px;opacity:.92;margin-top:8px">' + sel.length + ' produit' + (sel.length > 1 ? 's' : '') + ' sélectionné' + (sel.length > 1 ? 's' : '') + ' · ' + esc(dateStr) + '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">' + cards + '</div>' +
        '<div style="margin-top:26px;padding-top:14px;border-top:1px solid #ECEFF5;display:flex;justify-content:space-between;font-size:9px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.05em">' +
          '<span>Intégral Pharma · Sélection parapharmacie</span>' +
          '<span>Prix indicatifs TTC · ' + esc(dateStr) + '</span>' +
        '</div>' +
      '</div>';
  }

  // attend que toutes les <img> du noeud soient chargées (ou timeout)
  function waitImages(node, timeout) {
    var imgs = Array.prototype.slice.call(node.querySelectorAll('img'));
    if (!imgs.length) return Promise.resolve();
    return new Promise(function (resolve) {
      var left = imgs.length, done = false;
      function fin() { if (!done) { done = true; resolve(); } }
      var to = setTimeout(fin, timeout || 9000);
      function tick() { if (--left <= 0) { clearTimeout(to); fin(); } }
      imgs.forEach(function (im) {
        if (im.complete && im.naturalWidth > 0) { tick(); return; }
        im.addEventListener('load', tick);
        im.addEventListener('error', tick);
      });
    });
  }

  // charge le fichier de vignettes base64 (pour photos dans le PDF) si présent
  var imgLoading = false;
  function ensureImg(cb) {
    if (window.OFFILOG_IMG) { cb(); return; }
    if (imgLoading) { setTimeout(function () { ensureImg(cb); }, 300); return; }
    imgLoading = true;
    var sc = document.createElement('script');
    sc.src = MOD_BASE + 'offilog-img-data.js?v=20260611a';
    sc.onload = function () { imgLoading = false; cb(); };
    sc.onerror = function () { imgLoading = false; cb(); }; // pas grave : repli URL brute
    document.head.appendChild(sc);
  }
  var pzLoading = false;
  function ensurePz(cb) {
    if (window.PHARMAZON) { cb(); return; }
    if (pzLoading) return;
    pzLoading = true;
    function inject(src, onfail) {
      var sc = document.createElement('script'); sc.src = src;
      sc.onload = function () { pzLoading = false; cb(); }; sc.onerror = onfail;
      document.head.appendChild(sc);
    }
    inject(MOD_BASE + 'pharmazon-data.js?v=20260612a', function () {
      inject('pharmazon-data.js?v=20260612a', function () { pzLoading = false; cb(); });
    });
  }

  // ── Aperçu (modal) avant génération ──
  function fitMktSheet() {
    var scroll = document.getElementById('off-mkt-scroll');
    var holder = document.getElementById('off-mkt-holder');
    var sheet = document.getElementById('off-mkt-sheet');
    if (!scroll || !holder || !sheet) return;
    var avail = scroll.clientWidth - 48;
    if (avail <= 0) return;
    var scale = Math.min(1, avail / 794);
    sheet.style.transform = 'scale(' + scale + ')';
    var h = sheet.firstChild ? sheet.firstChild.offsetHeight : sheet.offsetHeight;
    holder.style.width = (794 * scale) + 'px';
    holder.style.height = (h * scale) + 'px';
  }
  function ensureMktModal() {
    var bd = document.getElementById('off-mkt-modal');
    if (bd) return bd;
    bd = document.createElement('div');
    bd.id = 'off-mkt-modal'; bd.className = 'off-mkt-modal';
    bd.innerHTML =
      '<div class="off-mkt-dialog" onclick="event.stopPropagation()">' +
        '<div class="off-mkt-top">' +
          '<div class="t">' + ICO('spark', 17, 2) + ' Aperçu de la fiche marketing</div>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.offMktGenerate()">' + ICO('download', 16, 2) + ' Télécharger le PDF</button>' +
          '<button class="off-mkt-x" onclick="V2.offMktClosePreview()" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
        '</div>' +
        '<div class="off-mkt-scroll" id="off-mkt-scroll"><div class="off-mkt-holder" id="off-mkt-holder"><div class="off-mkt-sheet" id="off-mkt-sheet"></div></div></div>' +
      '</div>';
    bd.onclick = function () { V2.offMktClosePreview(); };
    document.body.appendChild(bd);
    return bd;
  }
  V2.offMktPreview = function () {
    if (!mktSel.size) { V2.toast('Sélectionne au moins un produit', 'warn'); return; }
    ensureImg(function () {
      var bd = ensureMktModal();
      var sheet = bd.querySelector('#off-mkt-sheet');
      sheet.innerHTML = buildMarketingHtml();
      bd.classList.add('open');
      requestAnimationFrame(function () { requestAnimationFrame(fitMktSheet); });
      waitImages(sheet, 9000).then(fitMktSheet);
      if (!V2._mktResize) { window.addEventListener('resize', fitMktSheet); V2._mktResize = true; }
    });
  };
  V2.offMktClosePreview = function () {
    var bd = document.getElementById('off-mkt-modal'); if (bd) bd.classList.remove('open');
  };

  V2.offMktGenerate = function () {
    if (!mktSel.size) { V2.toast('Sélectionne au moins un produit', 'warn'); return; }
    if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
    var title = mktTitleVal();
    V2.toast('Génération du PDF…');
    ensureImg(function () { doGeneratePdf(title); });
  };
  function doGeneratePdf(title) {
    var html = buildMarketingHtml();
    window.ensureHtml2Pdf().then(function () {
      return (document.fonts && document.fonts.ready) ? document.fonts.ready : null;
    }).then(function () {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff';
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
      // IMPORTANT : attendre le chargement des photos (proxy CORS) avant le rendu
      return waitImages(wrap, 12000).then(function () {
        var fn = 'Fiche-marketing-' + (title.replace(/[^A-Za-z0-9-]/g, '_')).slice(0, 40) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
        return window.html2pdf().from(wrap.firstChild).set({
          filename: fn, margin: [8, 8, 10, 8], image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        }).save().then(function () {
          if (wrap.parentNode) document.body.removeChild(wrap);
          V2.toast('Fiche marketing téléchargée');
        });
      }).catch(function (e) { console.error(e); if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('Erreur PDF', 'error'); });
    });
  };

  function pager(total, pages) {
    if (pages <= 1) return '';
    var from = S.page * PER_PAGE + 1, to = Math.min(total, (S.page + 1) * PER_PAGE);
    return '<div class="off-pager">' +
      '<button class="v2-btn v2-btn-ghost off-pg"' + (S.page <= 0 ? ' disabled style="opacity:.4;pointer-events:none"' : '') + ' onclick="V2.offPage(' + (S.page - 1) + ')">' + ICO('back', 15) + ' Précédent</button>' +
      '<span class="off-pg-info mono">' + from + '–' + to + ' sur ' + V2.fmtNum(total) + ' · page ' + (S.page + 1) + '/' + pages + '</span>' +
      '<button class="v2-btn v2-btn-ghost off-pg"' + (S.page >= pages - 1 ? ' disabled style="opacity:.4;pointer-events:none"' : '') + ' onclick="V2.offPage(' + (S.page + 1) + ')">Suivant ' + ICO('chev', 15) + '</button>' +
    '</div>';
  }

  // ── Chargement du fichier best-sellers (lazy, dans crm/v2/) ──
  var bestLoading = false, bestFail = false, offTried = false, pzTried = false;
  function ensureBest(cb) {
    if (window.OFFILOG_BEST) { cb(); return; }
    if (bestLoading) return;
    bestLoading = true;
    function inject(src, onfail) {
      var sc = document.createElement('script');
      sc.src = src;
      sc.onload = function () { bestLoading = false; cb(); };
      sc.onerror = onfail;
      document.head.appendChild(sc);
    }
    // 1) chemin du module (MOD_BASE) → 2) repli chemin relatif → 3) échec
    inject(MOD_BASE + 'offilog-bestsellers-data.js?v=20260610v2m', function () {
      inject('offilog-bestsellers-data.js?v=20260610v2m', function () {
        bestLoading = false; bestFail = true; cb();
      });
    });
  }
  V2.offRetry = function () { bestFail = false; offTried = false; V2.render(); };

  // ── CSS ───────────────────────────────────────
  function injectCss() {
    if (document.getElementById('v2-off-css')) return;
    var s = document.createElement('style'); s.id = 'v2-off-css';
    s.textContent = [
      // grande recherche calme (esprit Launcher)
      '.off-search{display:flex;align-items:center;gap:13px;background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--line);border-radius:16px;padding:0 18px;height:60px;margin-bottom:var(--sp-6);box-shadow:var(--sh-2);transition:.22s var(--mo-ease-soft)}',
      '.off-search:focus-within{border-color:color-mix(in srgb,var(--pil-froid) 42%,transparent);box-shadow:0 0 0 4px color-mix(in srgb,var(--pil-froid) 16%,transparent),var(--sh-2)}',
      '.off-search svg{color:var(--pil-froid);flex-shrink:0}',
      '.off-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:16px;flex:1;color:var(--ip-ink)}',
      '.off-search .clr{border:none;background:none;cursor:pointer;color:var(--muted);display:flex;padding:2px}',
      // ── Bande VERDICT : où suis-je battu / où suis-je bon ──
      '.off-verdict-wrap{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);margin-bottom:var(--sp-3)}',
      '@media(max-width:640px){.off-verdict-wrap{grid-template-columns:1fr;gap:var(--sp-3)}}',
      '.off-verdict{display:flex;align-items:center;gap:14px;text-align:left;width:100%;padding:18px 20px;border-radius:var(--r-card);border:1px solid var(--line);background:linear-gradient(180deg,var(--card),var(--card-2));box-shadow:var(--sh-1);font-family:var(--font)}',
      '.off-verdict-ic{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.off-verdict-txt{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
      '.off-verdict-v{font-size:26px;font-weight:800;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
      '.off-verdict-l{font-size:12.5px;color:var(--muted);line-height:1.3}',
      '.off-verdict-go{display:inline-flex;align-items:center;gap:3px;font-size:12.5px;font-weight:700;flex-shrink:0;white-space:nowrap}',
      // tuile ALERTE (rouge SACRÉ) — cliquable, la plus forte
      '.off-verdict-bad{cursor:pointer;transition:transform .2s var(--mo-ease-soft),box-shadow .2s var(--mo-ease-soft),border-color .2s var(--mo-ease-soft)}',
      '.off-verdict-bad.hot{border-color:color-mix(in srgb,var(--bad) 40%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--bad) 7%,#fff),color-mix(in srgb,var(--bad) 3%,#fff))}',
      '.off-verdict-bad.hot .off-verdict-ic{background:var(--bad);color:#fff;box-shadow:0 4px 12px color-mix(in srgb,var(--bad) 40%,transparent)}',
      '.off-verdict-bad.hot .off-verdict-v{color:var(--bad)}',
      '.off-verdict-bad.hot .off-verdict-go{color:var(--bad)}',
      '.off-verdict-bad.cold{opacity:.9}',
      '.off-verdict-bad.cold .off-verdict-ic{background:var(--card-2);color:var(--muted-2)}',
      '.off-verdict-bad.cold .off-verdict-v{color:var(--ip-ink)}',
      '.off-verdict-bad.cold .off-verdict-go{color:var(--muted)}',
      // tuile ALERTE magnétique : offsets --mo-mx/--mo-my posés en JS (V2.motion),
      // combinés au lift de survol -2px. Au repos les deux valent 0 → aucun décalage.
      '.off-verdict-bad{--mo-mx:0px;--mo-my:0px}',
      '.off-verdict-bad:hover{transform:translate3d(var(--mo-mx),calc(var(--mo-my) - 2px),0);box-shadow:var(--sh-2)}',
      '.off-verdict-bad.hot:hover{border-color:color-mix(in srgb,var(--bad) 58%,transparent)}',
      '.off-verdict-bad.active{box-shadow:0 0 0 3px color-mix(in srgb,var(--bad) 22%,transparent),var(--sh-2);border-color:var(--bad)}',
      // tuile BIEN PLACÉ (vert) — calme
      '.off-verdict-ok .off-verdict-ic{background:color-mix(in srgb,var(--ok) 13%,#fff);color:var(--ok)}',
      '.off-verdict-ok .off-verdict-v{color:var(--ok)}',
      // ligne secondaire discrète
      '.off-verdict-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);margin-bottom:var(--sp-5);padding:0 2px}',
      '.off-verdict-meta b{color:var(--ip-ink);font-weight:700}',
      '.off-verdict-meta .off-dot{color:var(--muted-2);opacity:.6}',
      // barre de contexte + filtres (calme)
      '.off-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:var(--sp-4)}',
      '.off-count{font-size:13px;color:var(--muted)}',
      '.off-count b{color:var(--ip-ink)}',
      // bouton « Filtres » (progressive disclosure)
      '.off-advbtn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);color:var(--ip-ink-2);border-radius:var(--r-md);padding:8px 13px;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;box-shadow:var(--sh-1);transition:.16s var(--mo-ease-soft)}',
      '.off-advbtn svg{color:var(--muted)}',
      '.off-advbtn:hover{border-color:color-mix(in srgb,var(--pil-froid) 32%,var(--line));color:var(--ip-ink)}',
      '.off-advbtn.open{border-color:color-mix(in srgb,var(--pil-froid) 40%,var(--line));background:var(--card-2)}',
      '.off-advbtn-tag{background:color-mix(in srgb,var(--pil-froid) 12%,#fff);color:var(--pil-froid);border-radius:var(--r-pill);padding:2px 9px;font-size:11px;font-weight:700}',
      '.off-advbtn-chev{display:inline-flex;color:var(--muted-2);transition:transform .2s var(--mo-ease-soft)}',
      '.off-advbtn.open .off-advbtn-chev{transform:rotate(90deg)}',
      // panneau avancé déplié
      '.off-adv{background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-card);padding:16px 18px;margin-bottom:var(--sp-5);box-shadow:var(--sh-1)}',
      '.off-adv-l{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin:0 0 10px}',
      '.off-adv-segs{margin-bottom:16px}',
      '.off-adv-segs .v2-seg .sw{width:9px;height:9px;border-radius:50%;background:var(--sc,var(--muted-2));flex-shrink:0}',
      '.off-adv-segs .v2-seg.on .sw{background:#fff}',
      '.off-adv .off-sort{display:inline-flex;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:3px;box-shadow:var(--sh-1)}',
      '.off-sortbtn{border:none;background:transparent;border-radius:8px;padding:6px 11px;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;transition:.16s var(--ease);white-space:nowrap}',
      '.off-sortbtn:hover:not(.on){color:var(--ip-ink);background:var(--card-2)}',
      '.off-sortbtn:active{transform:scale(.97)}',
      '.off-sortbtn.on{background:var(--pil-froid);color:#fff;box-shadow:0 1px 4px color-mix(in srgb,var(--pil-froid) 34%,transparent)}',
      '@media(prefers-reduced-motion:reduce){.off-search,.off-verdict-bad,.off-advbtn,.off-advbtn-chev{transition:none}.off-verdict-bad:hover{transform:none}.off-verdict-bad{--mo-mx:0px!important;--mo-my:0px!important}}',
      // grille de cartes photo
      '.off-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:16px}',
      '.off-card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;cursor:pointer;box-shadow:var(--sh-1);transition:.18s var(--ease);display:flex;flex-direction:column}',
      '.off-card{will-change:transform}',
      '.off-card:hover{transform:translateY(var(--mo-lift));box-shadow:var(--sh-3);border-color:color-mix(in srgb,var(--pil-froid) 22%,transparent)}',
      '.off-card:active{transform:scale(.99)}',
      '.off-card.sel{border-color:var(--pil-froid);box-shadow:0 0 0 3px color-mix(in srgb,var(--pil-froid) 16%,transparent),var(--sh-2)}',
      // signature pilier : liseré 3px var(--bad) sur la carte en alerte (concurrent < achat IP) — seul usage du rouge
      '.off-card.alert{position:relative}',
      '.off-card.alert::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--bad);border-radius:3px 0 0 3px;z-index:3}',
      '.off-card.alert{border-color:color-mix(in srgb,var(--bad) 30%,transparent)}',
      '.off-card.alert:hover{border-color:color-mix(in srgb,var(--bad) 46%,transparent)}',
      // pastille "Alerte prix" en pied de média — hiérarchie forte du signal rouge
      '.off-card-flag{position:absolute;left:8px;bottom:8px;z-index:3;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;letter-spacing:.01em;color:#fff;background:var(--bad);padding:3px 8px 3px 6px;border-radius:8px;box-shadow:0 2px 7px color-mix(in srgb,var(--bad) 42%,transparent)}',
      '.off-card-flag svg{flex:none}',
      '.off-card-conc{font-size:10.5px;font-weight:800;color:var(--bad);font-variant-numeric:tabular-nums}',
      '.off-card-media{position:relative;height:150px;background:var(--surf-sunken);display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--line-2);padding:10px}',
      '.off-card-img{max-width:100%;max-height:100%;object-fit:contain}',
      '.off-card-noimg{color:var(--muted-2)}',
      // squelette de chargement (forme des cartes à venir)
      '.off-sk-card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:var(--sh-1);display:flex;flex-direction:column}',
      '.off-sk-media{height:150px;border-radius:0}',
      '.off-sk-body{padding:11px 13px 14px;display:flex;flex-direction:column;gap:8px}',
      '.off-sk-line{height:10px;border-radius:var(--r-control)}',
      '.off-sk-price{height:16px;width:52px;border-radius:var(--r-control);margin-top:4px}',
      '.off-rank{position:absolute;top:8px;left:8px;background:rgba(16,19,28,.82);color:#fff;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:8px;}',
      '.off-card-alert{position:absolute;bottom:8px;left:8px;width:24px;height:24px;border-radius:8px;background:var(--c-rose);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px color-mix(in srgb,var(--c-rose) 45%,transparent)}',
      '.off-mkt-add{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:9px;border:1px solid var(--line);background:rgba(255,255,255,.94);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:var(--sh-1);transition:transform .14s var(--ease),color .14s var(--ease),border-color .14s var(--ease),background .14s var(--ease);z-index:2}',
      '.off-mkt-add:hover{color:var(--c-opp);border-color:var(--c-opp)}',
      '.off-mkt-add:active{transform:scale(.97)}',
      '.off-mkt-add.on{background:var(--c-opp);border-color:var(--c-opp);color:#fff;box-shadow:0 2px 7px color-mix(in srgb,var(--c-opp) 45%,transparent)}',
      // hit-area terrain : on étend la cible tactile sans grossir le glyphe (pseudo-élément invisible)
      '@media(max-width:640px){.off-mkt-add::before,.off-insp-x::before{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:var(--tap-min);height:var(--tap-min)}}',
      // barre flottante fiche marketing
      '.off-mktbar{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:70;display:flex;align-items:center;gap:13px;background:var(--ip-ink);color:#fff;border-radius:16px;padding:10px 12px 10px 18px;box-shadow:0 16px 42px rgba(16,19,28,.36);max-width:94vw}',
      '.off-mktbar.hidden{display:none}',
      '.off-mktbar .ic{color:#79A8FF;display:flex;flex-shrink:0}',
      '.off-mktbar .n{font-weight:700;font-size:14px;white-space:nowrap}',
      '.off-mktbar .ttl{border:none;outline:none;background:rgba(255,255,255,.12);color:#fff;border-radius:10px;padding:9px 13px;font-family:var(--font);font-size:13px;width:230px}',
      '.off-mktbar .ttl::placeholder{color:rgba(255,255,255,.5)}',
      '.off-mktbar .v2-btn{white-space:nowrap}',
      '.off-mktbar .clr{background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;display:flex;padding:4px}',
      '.off-mktbar .clr:hover{color:#fff}',
      '@media(max-width:680px){.off-mktbar .ttl{width:130px}}',
      // Mobile : la barre flottante se replie (elle est centrée en position:fixed → débordait des 2 côtés). Titre sur sa propre ligne, boutons pleine largeur.
      '@media(max-width:560px){.off-mktbar{flex-wrap:wrap;justify-content:center;left:10px;right:10px;max-width:none;transform:none;bottom:calc(14px + env(safe-area-inset-bottom));padding:12px 14px}.off-mktbar .ttl{order:5;flex:1 1 100%;width:auto}.off-mktbar .v2-btn{flex:1 1 auto}.off-mktbar .clr{margin-left:auto}}',
      // modal aperçu fiche marketing
      '.off-mkt-modal{position:fixed;inset:0;z-index:120;background:rgba(16,19,28,.45);display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;opacity:0;pointer-events:none;transition:opacity .2s var(--ease)}',
      '.off-mkt-modal.open{opacity:1;pointer-events:auto}',
      '.off-mkt-dialog{width:min(900px,96vw);max-height:92vh;background:var(--card);border-radius:20px;box-shadow:var(--sh-pop);display:flex;flex-direction:column;overflow:hidden;transform:scale(.97);transition:transform .24s var(--ease)}',
      '.off-mkt-modal.open .off-mkt-dialog{transform:scale(1)}',
      '.off-mkt-top{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line);background:rgba(251,252,254,.8);}',
      '.off-mkt-top .t{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:-.01em;flex:1}',
      '.off-mkt-top .t svg{color:var(--pil-froid)}',
      '.off-mkt-x{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.16s var(--ease)}',
      '.off-mkt-x:hover{color:var(--ip-ink);transform:rotate(90deg)}',
      '.off-mkt-scroll{overflow-y:auto;overflow-x:hidden;padding:24px;background:#EBEEF4;flex:1}',
      '.off-mkt-holder{margin:0 auto;overflow:hidden;border-radius:8px;box-shadow:0 14px 44px rgba(16,19,28,.2)}',
      '.off-mkt-sheet{width:794px;transform-origin:top left;background:#fff}',
      '@media(max-width:560px){.off-mkt-top{flex-wrap:wrap}.off-mkt-top .v2-btn{order:3;width:100%}}',
      '.off-card-body{padding:11px 13px 14px;display:flex;flex-direction:column;gap:3px;flex:1}',
      '.off-card-brand{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.off-card-name{font-size:12.5px;font-weight:600;line-height:1.35;color:var(--ip-ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}',
      '.off-card-price{font-size:16px;font-weight:800;color:var(--pil-froid);margin-top:5px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
      '.off-card-pz{font-size:10.5px;font-weight:700;color:var(--muted);background:var(--card-2);border:1px solid var(--line);border-radius:7px;padding:1px 6px;font-variant-numeric:tabular-nums}',
      '@media(max-width:640px){.off-grid{grid-template-columns:repeat(2,1fr);gap:10px}.off-card-media{height:118px}.off-card-name{font-size:12px}}',
      '.off-card-pz.win{color:var(--ip-blue-d);background:color-mix(in srgb,var(--ip-blue-d) 10%,#fff);border-color:color-mix(in srgb,var(--ip-blue-d) 28%,transparent)}',
      // comparatif Offilog vs Pharmazon (inspecteur)
      '.off-pz{margin-top:18px;padding:15px;background:color-mix(in srgb,var(--ip-blue-d) 5%,#fff);border:1px solid color-mix(in srgb,var(--ip-blue-d) 22%,transparent);border-radius:13px}',
      '.off-pz-l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ip-blue-d);font-weight:800;margin-bottom:11px}',
      '.off-pz-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.off-pz-cell{border:1px solid var(--line);border-radius:11px;padding:11px 13px;background:var(--card);display:flex;flex-direction:column;gap:3px}',
      '.off-pz-cell span{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700}',
      '.off-pz-cell b{font-size:18px;color:var(--ip-ink)}',
      '.off-pz-cell.win{border-color:var(--ip-blue-d);background:color-mix(in srgb,var(--ip-blue-d) 8%,#fff);box-shadow:0 0 0 2px color-mix(in srgb,var(--ip-blue-d) 18%,transparent)}',
      '.off-pz-cell.win b{color:var(--ip-blue-d)}',
      '.off-pz-note{font-size:12.5px;color:var(--ip-ink-2);margin-top:10px;font-weight:600}',
      '.off-pz-note b{color:var(--ip-blue-d)}',
      '.off-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0 0;flex-wrap:wrap}',
      '.off-pg{padding:8px 14px;font-size:13px}',
      '.off-pg-info{font-size:12px;color:var(--muted)}',
      // inspecteur latéral
      '.off-insp{position:fixed;top:0;right:0;width:392px;max-width:92vw;height:100vh;background:var(--card);border-left:1px solid var(--line);box-shadow:var(--sh-3);transform:translateX(100%);transition:transform .32s var(--ease);z-index:50;overflow-y:auto;display:flex;flex-direction:column}',
      '.off-insp.open{transform:translateX(0)}',
      '.off-insp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-bottom:1px solid var(--line);background:rgba(251,252,254,.97);position:sticky;top:0;z-index:1}',
      '.off-insp-name{font-size:16px;font-weight:800;letter-spacing:-.02em;line-height:1.25}',
      '.off-insp-sub{font-size:12.5px;color:var(--ip-ink-2);font-weight:600;margin-top:4px;text-transform:uppercase;letter-spacing:.03em}',
      '.off-insp-cip{font-size:11.5px;color:var(--muted);margin-top:3px}',
      '.off-insp-x{position:relative;width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:var(--card);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);flex-shrink:0;transition:.18s var(--ease)}',
      '.off-insp-x:hover{color:var(--ip-ink);transform:rotate(90deg)}',
      '.off-insp-x:active{transform:scale(.97)}',
      '.off-insp-body{padding:20px}',
      '.off-insp-img{width:100%;height:180px;border-radius:13px;overflow:hidden;background:var(--surf-sunken);border:1px solid var(--line);margin-bottom:16px;display:flex;align-items:center;justify-content:center;padding:12px}',
      '.off-insp-img img{max-width:100%;max-height:100%;object-fit:contain}',
      '.off-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}',
      '.off-badge{display:inline-block;padding:3px 9px;border-radius:8px;font-size:10.5px;font-weight:700;background:color-mix(in srgb,var(--bc) 13%,#fff);color:var(--bc)}',
      '.off-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.off-kpi{background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:13px 14px}',
      '.off-kpi-l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:5px}',
      '.off-kpi-v{font-family:var(--mono);font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.off-cmp{margin-top:18px;padding:15px;background:var(--card-2);border:1px solid var(--line);border-radius:13px}',
      '.off-cmp-l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:11px}',
      '.off-cmp-l span{text-transform:none;letter-spacing:0;font-weight:500}',
      '.off-cmp-row,.off-cmp-ref{display:grid;grid-template-columns:1fr auto 78px;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-2)}',
      '.off-cmp-row:last-child{border-bottom:none}',
      '.off-cmp-row.muted{opacity:.65}',
      // ligne de référence (achat IP) : le seuil, mis en avant en tête du comparatif
      '.off-cmp-ref{margin:-4px -8px 4px;padding:9px 10px;background:var(--halo);border-radius:10px;border-bottom:none}',
      '.off-cmp-ref .off-cmp-src{color:var(--ip-blue);font-weight:800}',
      '.off-cmp-ref .off-cmp-price{color:var(--ip-blue)}',
      // ligne concurrent sous le seuil : fond rouge léger = signal fort mais mesuré
      '.off-cmp-row.below{background:color-mix(in srgb,var(--bad) 7%,transparent);margin:0 -8px;padding-left:10px;padding-right:10px;border-radius:9px;border-bottom-color:transparent}',
      '.off-cmp-src{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;min-width:0}',
      '.off-cmp-src .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
      '.off-cmp-price{font-size:14px;font-weight:700;text-align:right;white-space:nowrap}',
      '.off-cmp-price.bad{color:var(--bad)}',
      '.off-cmp-na{font-size:12px;color:var(--muted);font-style:italic;text-align:right;white-space:nowrap}',
      '.off-cmp-delta{font-size:11px;font-weight:700;font-family:var(--mono);text-align:right}',
      '.off-cmp-delta.bad{color:var(--bad)}.off-cmp-delta.ok{color:var(--ok)}',
      '.off-insp-cta{margin-top:20px;display:flex;flex-direction:column}',
      '.off-insp-cta .v2-btn{width:100%}',
      '@media(max-width:1100px){.off-insp{width:350px}}',
      '@media(max-width:640px){.off-insp{height:100dvh;padding-bottom:env(safe-area-inset-bottom)}}',
    ].join('');
    document.head.appendChild(s);
  }

  // Magnétique sur la tuile-verdict rouge (délégué, câblé une seule fois).
  // Même physique que V2.motion.magnetic (amplitude 5px), mais ciblée sur
  // .off-verdict-bad (qui n'est pas un .v2-btn) via ses vars --mo-mx/--mo-my.
  var verdictMagBound = false;
  function bindVerdictMagnetic(mo) {
    if (verdictMagBound || !mo || mo.reduced()) return;
    try { if (window.matchMedia && window.matchMedia('(hover: none)').matches) return; } catch (e) {}
    verdictMagBound = true;
    var MAX = 5, cur = null;
    function reset(el) { if (el) { el.style.setProperty('--mo-mx', '0px'); el.style.setProperty('--mo-my', '0px'); } }
    document.addEventListener('pointermove', function (ev) {
      if (mo.reduced() || ev.pointerType === 'touch') return;
      var t = ev.target && ev.target.closest ? ev.target.closest('.off-verdict-bad') : null;
      if (t !== cur) { if (cur) reset(cur); cur = t; }
      if (!cur) return;
      try {
        var r = cur.getBoundingClientRect();
        var dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
        cur.style.setProperty('--mo-mx', Math.max(-MAX, Math.min(MAX, dx * 0.35)).toFixed(2) + 'px');
        cur.style.setProperty('--mo-my', Math.max(-MAX, Math.min(MAX, dy * 0.35)).toFixed(2) + 'px');
      } catch (e) {}
    }, true);
    document.addEventListener('pointerleave', function () { if (cur) { reset(cur); cur = null; } }, true);
    document.addEventListener('pointerup', function () { if (cur) { reset(cur); cur = null; } }, true);
  }

  // ── PAGE ──────────────────────────────────────
  V2.pages.offilog = {
    render: function (root, param) {
      injectCss();
      // consommer le param de deep-link UNE fois (avant : re-forçait S.sel à chaque render → inspecteur inrefermable)
      if (param != null && param !== '' && String(param) !== String(S._lastParam)) S.sel = param;
      S._lastParam = param;

      // Données : meilleures ventes (requis) + OFFILOG (veille, optionnel, en fond)
      if (!window.OFFILOG_BEST) {
        if (bestFail) {
          root.innerHTML = V2.topbar({ back: true }) +
            '<div class="v2-wrap"><div class="v2-empty">' +
              '<div class="v2-empty-ico">' + ICO('alert', 64, 1.4) + '</div>' +
              '<div class="v2-empty-t">Chargement impossible</div>' +
              '<div class="v2-empty-d">Les meilleures ventes Offilog n\'ont pas pu être chargées (connexion ?).</div>' +
              '<button class="v2-btn v2-btn-primary" onclick="V2.offRetry()">' + ICO('back', 16, 2) + ' Réessayer</button>' +
            '</div></div>';
          return;
        }
        // squelette (forme des futures cartes) au lieu du spinner sur la grille lourde
        root.innerHTML = V2.topbar({ back: true }) + (V2.concTabs ? V2.concTabs('prix') : '') +
          '<div class="v2-wrap">' +
            '<div class="v2-page-title">Concurrents</div>' +
            '<div class="v2-page-sub">Chargement des meilleures ventes Offilog…</div>' +
            skeletonGrid(12) +
          '</div>';
        ensureBest(function () { idxBuilt = false; V2.render(); }); // on rend dès que les ventes sont là
        return;
      }
      // Veille concurrents : chargée UNE SEULE FOIS en tâche de fond (n'empêche pas l'affichage)
      if (!window.OFFILOG && !offTried) {
        offTried = true;
        V2.loadFiles(['offilog']).then(function () { idxBuilt = false; V2.render(); });
      }
      // Prix Pharmazon (comparaison achat) : chargés UNE SEULE FOIS en tâche de fond
      if (!window.PHARMAZON && !pzTried) {
        pzTried = true;
        ensurePz(function () { idxBuilt = false; V2.render(); });
      }
      buildIndex();

      var base = filteredBase();
      var c = counts(base);
      var filtered = (S.chip === 'all') ? base : base.filter(function (it) { return matchChip(it, S.chip); });
      filtered = sorted(filtered);
      var total = filtered.length;
      var pages = Math.max(1, Math.ceil(total / PER_PAGE));
      if (S.page >= pages) S.page = pages - 1;
      if (S.page < 0) S.page = 0;
      var pageItems = filtered.slice(S.page * PER_PAGE, (S.page + 1) * PER_PAGE);
      var nbTotal = (window.OFFILOG_BEST || []).length;

      // Chips de CATÉGORIE uniquement (Santé, Beauté, Hygiène…) — repliés dans les
      // filtres avancés. Les « verdicts » (alerte / bien placé) vivent dans la
      // bande du haut ; le raccourci Pharmazon reste ici, discret.
      var advChips = CHIPS.map(function (f) {
        if (f.k === 'alerte') return ''; // porté par la tuile-verdict rouge
        var n = c[f.k] || 0;
        if (f.k !== 'all' && f.k !== 'pzcheaper' && n === 0) return '';
        var on = S.chip === f.k ? ' on' : '';
        return '<button class="v2-seg' + on + '" style="--sc:' + f.sc + '" onclick="V2.offFilter(\'' + f.k + '\')">' +
          (f.k === 'all' ? '' : '<span class="sw"></span>') + esc(f.label) + '<span class="cnt">' + V2.fmtNum(n) + '</span></button>';
      }).join('');

      var insHtml = '';
      if (S.sel != null) {
        var sp = byEan.get(String(S.sel)) || items.filter(function (x) { return String(x.id) === String(S.sel); })[0];
        if (sp) insHtml = inspector(sp); else S.sel = null;
      }

      var gridHtml = total
        ? '<div class="off-grid">' + pageItems.map(card).join('') + '</div>' + pager(total, pages)
        : '<div class="v2-empty"><div class="v2-empty-ico">' + ICO('search', 64, 1.4) + '</div>' +
          '<div class="v2-empty-t">Aucun produit</div><div class="v2-empty-d">Rien ne correspond à ce filtre et cette recherche.</div></div>';

      function sortBtn(v, l) { return '<button class="off-sortbtn' + (S.sort === v ? ' on' : '') + '" onclick="V2.offSort(\'' + v + '\')">' + l + '</button>'; }

      var qVal = S.q.replace(/"/g, '&quot;');
      var clrBtn = S.q ? '<button class="clr" onclick="V2.offSearch(\'\')">' + ICO('close', 16, 2) + '</button>' : '';

      // Contexte de la sélection courante (calme, une ligne) : ce qu'on regarde.
      var ctxLabel = (S.chip === 'all')
        ? (S.q ? 'Résultats pour « ' + esc(S.q) + ' »' : 'Meilleures ventes')
        : esc(CHIP_BY_KEY[S.chip].label);

      // Bloc « Filtres » : progressive disclosure. Fermé par défaut = page calme.
      var advOpen = S.adv;
      var advBtn = '<button type="button" class="off-advbtn' + (advOpen ? ' open' : '') + '" onclick="V2.offToggleAdv()">' +
          ICO('grid', 15, 2) + ' Filtres' +
          (S.chip !== 'all' && S.chip !== 'alerte' ? '<span class="off-advbtn-tag">' + esc(CHIP_BY_KEY[S.chip].label) + '</span>' : '') +
          '<span class="off-advbtn-chev">' + ICO('chev', 14, 2.2) + '</span></button>';
      var advPanel = advOpen
        ? '<div class="off-adv">' +
            '<div class="off-adv-l">Par famille</div>' +
            '<div class="v2-segs off-adv-segs">' + advChips + '</div>' +
            '<div class="off-adv-l">Trier</div>' +
            '<div class="off-sort">' + sortBtn('ventes', 'Meilleures ventes') + sortBtn('prix_asc', 'Prix ↑') + sortBtn('prix_desc', 'Prix ↓') + '</div>' +
          '</div>'
        : '';

      root.innerHTML = V2.topbar({ back: true }) + (V2.concTabs ? V2.concTabs('prix') : '') +
        '<div class="v2-wrap' + (S.sel != null ? ' v2-detail-shift" style="--detw:392px"' : '"') + '>' +
          (V2.priceTabs ? V2.priceTabs('offilog') : '') +
          '<div class="v2-page-title">Concurrents</div>' +
          '<div class="v2-page-sub">Ton prix d\'achat IP (HT) comparé en direct aux prix publics E.Leclerc, Drakkars et Cap3000 (TTC). Vois d\'un coup d\'œil où un concurrent casse les prix sous ton achat.</div>' +
          '<div class="off-search">' + ICO('search', 19, 2) +
            '<input id="off-search-input" autocomplete="off" placeholder="Rechercher par produit, marque ou EAN…" value="' + qVal + '" oninput="V2.offSearch(this.value)">' + clrBtn + '</div>' +
          verdictBand(filtered) +
          '<div class="off-toolbar">' +
            '<div class="off-count"><b class="mono">' + V2.fmtNum(total) + '</b> produit' + (total > 1 ? 's' : '') + ' · ' + ctxLabel + '</div>' +
            advBtn +
          '</div>' +
          advPanel +
          gridHtml +
        '</div>' + insHtml +
        '<div class="off-mktbar' + (mktSel.size ? '' : ' hidden') + '" id="off-mktbar">' +
          '<span class="ic">' + ICO('spark', 18, 2) + '</span>' +
          '<span class="n" id="off-mkt-n">' + mktSel.size + ' produit' + (mktSel.size > 1 ? 's' : '') + '</span>' +
          '<input class="ttl" id="off-mkt-title" placeholder="Titre de la fiche marketing…" value="' + esc(mktTitle) + '" oninput="V2.offMktTitle(this.value)">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.offMktPreview()">' + ICO('grid', 16, 2) + ' Aperçu de la fiche</button>' +
          '<button class="clr" onclick="V2.offMktClear()" title="Vider">' + ICO('close', 16, 2) + '</button>' +
        '</div>';

      // ── Motion « façon Framer Motion » (discret, 150–300ms, RM-safe via l'API) ──
      var mo = V2.motion;
      if (mo) {
        var grid = root.querySelector('.off-grid');
        var isFirst = firstPaint;
        // 1) FLIP : les cartes qui restent affichées glissent de leur ancienne
        //    position vers la nouvelle quand on filtre par famille ou « alertes ».
        var didFlip = false;
        if (grid && flipRects && !mo.reduced()) {
          var cards = grid.querySelectorAll('.off-card');
          for (var fi = 0; fi < cards.length; fi++) {
            var c = cards[fi];
            var prev = flipRects.get(String(c.getAttribute('data-id')));
            if (!prev) continue;
            var now = c.getBoundingClientRect();
            var dx = prev.left - now.left, dy = prev.top - now.top;
            if (!dx && !dy) continue;
            try {
              c.animate(
                [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
                { duration: 300, easing: 'cubic-bezier(.22,.61,.36,1)' }
              );
              didFlip = true;
            } catch (e) {}
          }
        }
        flipRects = null;
        // 2) Cascade d'entrée sur les premières cartes — seulement au 1er affichage
        //    (pas à chaque frappe de recherche / tri / pagination), et jamais pendant un FLIP.
        if (grid && isFirst && !didFlip) {
          mo.stagger(grid.querySelectorAll('.off-card'), { step: 34, cap: 10, y: 8 });
        }
        // 3) Count-up des 2 chiffres verdict quand la bande arrive à l'écran —
        //    au 1er affichage seulement (pas à chaque frappe de recherche).
        var vwrap = root.querySelector('.off-verdict-wrap');
        if (vwrap && isFirst) {
          mo.inView(vwrap, function (el) {
            var cs = el.querySelectorAll('[data-count]');
            for (var i = 0; i < cs.length; i++) mo.countUp(cs[i]);
          });
        }
        firstPaint = false;
        // 4) Tuile verdict rouge (le signal fort) rendue magnétique : elle « penche »
        //    de quelques px vers le curseur (physique alignée sur V2.motion, RM/touch-safe).
        bindVerdictMagnetic(mo);
      }
    }
  };
})();
