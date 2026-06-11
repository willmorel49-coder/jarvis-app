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

  var S = { chip: 'all', q: '', page: 0, sel: null, sort: 'ventes' };
  var PER_PAGE = 60;

  var CHIPS = [
    { k: 'all',         label: 'Tout',           sc: '#0050E6' },
    { k: 'alerte',      label: 'Veille prix',    sc: '#E0556E' },
    { k: 'sante',       label: 'Santé',          sc: '#1E9E6A' },
    { k: 'beaute-et-soins', label: 'Beauté & soins', sc: '#6D4FC4' },
    { k: 'hygiene',     label: 'Hygiène',        sc: '#00B5D8' },
    { k: 'bebe',        label: 'Bébé',           sc: '#C7791A' },
    { k: 'solaires',    label: 'Solaires',       sc: '#C7791A' },
    { k: 'veterinaire', label: 'Vétérinaire',    sc: '#737A8C' },
  ];
  var CHIP_BY_KEY = {}; CHIPS.forEach(function (c) { CHIP_BY_KEY[c.k] = c; });

  var CONC = [
    { key: 'prix_leclerc',  label: 'E.Leclerc', color: '#0066B3' },
    { key: 'prix_drakkars', label: 'Drakkars',  color: '#1E9E6A' },
    { key: 'prix_cap3000',  label: 'Cap3000',   color: '#C7791A' },
  ];

  // ── Index ─────────────────────────────────────
  var idxBuilt = false, items = null, byEan = null;
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

  function buildIndex() {
    if (idxBuilt) return;
    var offByEan = offIndex();
    items = (window.OFFILOG_BEST || []).map(function (b) {
      var o = b.ean ? offByEan.get(String(b.ean)) : null;
      var achat = o ? numOr0(o.prix_offilog) : 0;
      var conc = {};
      var mc = 0, hasC = false;
      if (o) {
        CONC.forEach(function (c) { var v = numOr0(o[c.key]); conc[c.key] = v; if (v > 0) { hasC = true; if (mc === 0 || v < mc) mc = v; } });
      }
      var alert = achat > 0 && mc > 0 && mc < achat;
      return {
        rank: b.rank, id: b.id, name: b.name, brand: b.brand || '',
        price: numOr0(b.price), ean: b.ean || '', img: b.img || '', cat: b.cat || '',
        url: b.url || '', univers: o ? (o.univers || '') : '',
        achat: achat, conc: conc, hasConc: hasC, minConc: mc, alert: alert, matched: !!o
      };
    });
    byEan = new Map();
    items.forEach(function (it) { if (it.ean) byEan.set(String(it.ean), it); });
    idxBuilt = true;
  }

  function matchChip(it, k) {
    if (k === 'all') return true;
    if (k === 'alerte') return it.alert;
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
    var c = { all: base.length, alerte: 0 };
    CHIPS.forEach(function (ch) { if (ch.k !== 'all' && ch.k !== 'alerte') c[ch.k] = 0; });
    for (var i = 0; i < base.length; i++) {
      var it = base[i];
      if (it.alert) c.alerte++;
      if (c[it.cat] != null) c[it.cat]++;
    }
    return c;
  }

  // ── Stat band ─────────────────────────────────
  function kpiCard(k, l, v, d, vcol) {
    return '<div class="v2-kpi ' + k + '"><div class="v2-kpi-l">' + l + '</div>' +
      '<div class="v2-kpi-v mono"' + (vcol ? ' style="color:' + vcol + '"' : '') + '>' + v + '</div>' +
      (d ? '<div class="v2-kpi-d" style="color:var(--muted)">' + d + '</div>' : '') + '</div>';
  }
  function statBand(list) {
    var n = list.length, nAlert = 0, nMatch = 0, pSum = 0, pN = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it.alert) nAlert++;
      if (it.matched) nMatch++;
      if (it.price > 0) { pSum += it.price; pN++; }
    }
    return '<div class="v2-kpis off-kpis">' +
      kpiCard('k1', 'Produits', V2.fmtNum(n), 'meilleures ventes Offilog') +
      kpiCard('k2', 'Veille prix', V2.fmtNum(nAlert), nAlert ? 'concurrent sous ton achat' : 'aucune alerte', nAlert ? 'var(--c-rose)' : null) +
      kpiCard('k3', 'Prix Offilog moyen', pN ? V2.fmtEur(pSum / pN) : '—', 'sur la sélection') +
      kpiCard('k4', 'Réf. croisées', V2.fmtNum(nMatch), 'avec données concurrents') +
    '</div>';
  }

  // ── Carte produit (grille, avec photo) ────────
  function card(it) {
    var sel = (S.sel != null && String(it.id) === String(S.sel)) ? ' sel' : '';
    var img = it.img
      ? '<img class="off-card-img" src="' + esc(it.img) + '" loading="lazy" alt="" onerror="this.style.visibility=\'hidden\'">'
      : '<div class="off-card-noimg">' + ICO('pill', 30, 1.4) + '</div>';
    return '<div class="off-card' + sel + '" onclick="V2.offSelect(\'' + esc(it.id) + '\')">' +
      '<div class="off-card-media">' +
        '<span class="off-rank mono">#' + it.rank + '</span>' +
        (it.alert ? '<span class="off-card-alert" title="Veille prix">' + ICO('alert', 13, 2.4) + '</span>' : '') +
        img +
      '</div>' +
      '<div class="off-card-body">' +
        (it.brand ? '<div class="off-card-brand">' + esc(it.brand) + '</div>' : '<div class="off-card-brand">&nbsp;</div>') +
        '<div class="off-card-name">' + esc(it.name) + '</div>' +
        '<div class="off-card-price mono">' + (it.price > 0 ? V2.fmtEur(it.price) : '—') + '</div>' +
      '</div>' +
    '</div>';
  }

  // ── Inspecteur DÉTAIL ─────────────────────────
  function priceCmpRows(it) {
    if (!it.matched) {
      return '<div class="off-cmp-row muted"><span class="off-cmp-na">Pas de données concurrents pour ce produit (hors périmètre veille).</span></div>';
    }
    return CONC.map(function (src) {
      var v = numOr0(it.conc[src.key]);
      if (v <= 0) return '<div class="off-cmp-row muted"><span class="off-cmp-src">' + src.label + '</span><span class="off-cmp-na">prix non connu</span></div>';
      var below = it.achat > 0 && v < it.achat;
      var delta = it.achat > 0 ? (v - it.achat) : 0;
      return '<div class="off-cmp-row">' +
        '<span class="off-cmp-src"><span class="dot" style="background:' + src.color + '"></span>' + src.label + '</span>' +
        '<span class="off-cmp-price ' + (below ? 'bad' : '') + ' mono">' + V2.fmtEur(v) + '</span>' +
        (it.achat > 0 ? '<span class="off-cmp-delta ' + (below ? 'bad' : 'ok') + '">' + (delta >= 0 ? '+' : '') + V2.fmtEur(delta) + '</span>' : '') +
      '</div>';
    }).join('');
  }
  function inspector(it) {
    var img = it.img ? '<div class="off-insp-img"><img src="' + esc(it.img) + '" loading="lazy" alt="" onerror="this.parentNode.style.display=\'none\'"></div>' : '';
    function kpi(l, v, col) { return '<div class="off-kpi"><div class="off-kpi-l">' + l + '</div><div class="off-kpi-v"' + (col ? ' style="color:' + col + '"' : '') + '>' + v + '</div></div>'; }
    var alertBanner = it.alert
      ? '<div class="off-alert"><span class="off-alert-ic">' + ICO('alert', 18, 2) + '</span><div><b>Veille prix</b> — un concurrent vend au public sous ton prix d\'achat IP. La pharmacie ne peut pas s\'aligner sans perdre.</div></div>'
      : '';
    var badges = '<span class="off-badge" style="--bc:#0050E6">#' + it.rank + ' ventes</span>' +
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
        alertBanner +
        '<div class="off-kpi-grid">' +
          kpi('Prix Offilog', it.price > 0 ? V2.fmtEur(it.price) : '—', 'var(--ip-blue)') +
          kpi('Rang ventes', '#' + it.rank) +
          kpi('Achat IP (HT)', it.achat > 0 ? V2.fmtEur(it.achat) : '—', it.achat > 0 ? 'var(--c-mint)' : 'var(--muted-2)') +
          kpi('Concurrent mini', it.minConc > 0 ? V2.fmtEur(it.minConc) : '—', it.alert ? 'var(--c-rose)' : '') +
        '</div>' +
        '<div class="off-cmp"><div class="off-cmp-l">Prix public concurrents <span>(TTC)</span></div>' + priceCmpRows(it) + '</div>' +
        '<div class="off-insp-cta"><button class="v2-btn v2-btn-primary" onclick="V2.offAddToFiche(\'' + esc(it.ean || it.id) + '\')">' + ICO('plus', 17) + ' Ajouter à une fiche commerciale</button>' +
          (it.url ? '<a class="v2-btn v2-btn-ghost" href="' + esc(it.url) + '" target="_blank" rel="noopener" style="margin-top:8px">Voir sur Offilog</a>' : '') + '</div>' +
      '</div>' +
    '</div>';
  }

  // ── Handlers ──────────────────────────────────
  V2.offFilter = function (k) { S.chip = k; S.page = 0; V2.render(); };
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
    V2.toast('✓ Ajouté à la fiche en cours (' + n + ')');
  };

  function rerenderKeepFocus() {
    V2.render();
    var inp = document.getElementById('off-search-input');
    if (inp) { inp.focus(); var v = inp.value; try { inp.setSelectionRange(v.length, v.length); } catch (e) {} }
  }

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
  var bestLoading = false;
  function ensureBest(cb) {
    if (window.OFFILOG_BEST) { cb(); return; }
    if (bestLoading) return;
    bestLoading = true;
    var sc = document.createElement('script');
    sc.src = 'offilog-bestsellers-data.js?v=20260610v2m';
    sc.onload = function () { bestLoading = false; cb(); };
    sc.onerror = function () { bestLoading = false; cb(); };
    document.head.appendChild(sc);
  }

  // ── CSS ───────────────────────────────────────
  function injectCss() {
    if (document.getElementById('v2-off-css')) return;
    var s = document.createElement('style'); s.id = 'v2-off-css';
    s.textContent = [
      '.off-search{display:flex;align-items:center;gap:13px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:14px;box-shadow:var(--sh-2);transition:.2s var(--ease)}',
      '.off-search:focus-within{border-color:rgba(0,80,230,.4);box-shadow:0 0 0 4px var(--halo),var(--sh-2)}',
      '.off-search svg{color:var(--ip-blue);flex-shrink:0}',
      '.off-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:16px;flex:1;color:var(--ip-ink)}',
      '.off-search .clr{border:none;background:none;cursor:pointer;color:var(--muted);display:flex;padding:2px}',
      '.off-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}',
      '.off-count{font-size:12px;color:var(--muted)}',
      '.off-sort{display:inline-flex;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:3px;box-shadow:var(--sh-1)}',
      '.off-sortbtn{border:none;background:transparent;border-radius:8px;padding:6px 11px;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;transition:.16s var(--ease);white-space:nowrap}',
      '.off-sortbtn.on{background:var(--ip-blue);color:#fff}',
      '.off-stats-l{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin:18px 0 12px}',
      '.off-kpis{margin-bottom:18px}',
      // grille de cartes photo
      '.off-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:16px}',
      '.off-card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;cursor:pointer;box-shadow:var(--sh-1);transition:.18s var(--ease);display:flex;flex-direction:column}',
      '.off-card:hover{transform:translateY(-4px);box-shadow:var(--sh-3);border-color:rgba(0,80,230,.22)}',
      '.off-card.sel{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo),var(--sh-2)}',
      '.off-card-media{position:relative;height:150px;background:#fff;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--line-2);padding:10px}',
      '.off-card-img{max-width:100%;max-height:100%;object-fit:contain}',
      '.off-card-noimg{color:var(--muted-2)}',
      '.off-rank{position:absolute;top:8px;left:8px;background:rgba(16,19,28,.82);color:#fff;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:8px;backdrop-filter:blur(4px)}',
      '.off-card-alert{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:8px;background:var(--c-rose);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px color-mix(in srgb,var(--c-rose) 45%,transparent)}',
      '.off-card-body{padding:11px 13px 14px;display:flex;flex-direction:column;gap:3px;flex:1}',
      '.off-card-brand{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.off-card-name{font-size:12.5px;font-weight:600;line-height:1.35;color:var(--ip-ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}',
      '.off-card-price{font-size:16px;font-weight:800;color:var(--ip-blue);margin-top:5px}',
      '.off-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0 0;flex-wrap:wrap}',
      '.off-pg{padding:8px 14px;font-size:13px}',
      '.off-pg-info{font-size:12px;color:var(--muted)}',
      // inspecteur latéral
      '.off-insp{position:fixed;top:0;right:0;width:392px;max-width:92vw;height:100vh;background:var(--card);border-left:1px solid var(--line);box-shadow:var(--sh-3);transform:translateX(100%);transition:transform .32s var(--ease);z-index:50;overflow-y:auto;display:flex;flex-direction:column}',
      '.off-insp.open{transform:translateX(0)}',
      '.off-insp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-bottom:1px solid var(--line);background:rgba(251,252,254,.7);backdrop-filter:blur(10px);position:sticky;top:0;z-index:1}',
      '.off-insp-name{font-size:16px;font-weight:800;letter-spacing:-.02em;line-height:1.25}',
      '.off-insp-sub{font-size:12.5px;color:var(--ip-ink-2);font-weight:600;margin-top:4px;text-transform:uppercase;letter-spacing:.03em}',
      '.off-insp-cip{font-size:11.5px;color:var(--muted);margin-top:3px}',
      '.off-insp-x{width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:var(--card);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);flex-shrink:0;transition:.18s var(--ease)}',
      '.off-insp-x:hover{color:var(--ip-ink);transform:rotate(90deg)}',
      '.off-insp-body{padding:20px}',
      '.off-insp-img{width:100%;height:180px;border-radius:13px;overflow:hidden;background:#fff;border:1px solid var(--line);margin-bottom:16px;display:flex;align-items:center;justify-content:center;padding:12px}',
      '.off-insp-img img{max-width:100%;max-height:100%;object-fit:contain}',
      '.off-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}',
      '.off-badge{display:inline-block;padding:3px 9px;border-radius:8px;font-size:10.5px;font-weight:700;background:color-mix(in srgb,var(--bc) 13%,#fff);color:var(--bc)}',
      '.off-alert{display:flex;gap:11px;align-items:flex-start;padding:13px 15px;border-radius:13px;background:color-mix(in srgb,var(--c-rose) 8%,#fff);border:1px solid color-mix(in srgb,var(--c-rose) 28%,transparent);margin-bottom:16px;font-size:12.5px;line-height:1.5;color:var(--ip-ink-2)}',
      '.off-alert-ic{color:var(--c-rose);flex-shrink:0;margin-top:1px}',
      '.off-alert b{color:var(--c-rose)}',
      '.off-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.off-kpi{background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:13px 14px}',
      '.off-kpi-l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:5px}',
      '.off-kpi-v{font-family:var(--mono);font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.off-cmp{margin-top:18px;padding:15px;background:var(--card-2);border:1px solid var(--line);border-radius:13px}',
      '.off-cmp-l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:11px}',
      '.off-cmp-l span{text-transform:none;letter-spacing:0;font-weight:500}',
      '.off-cmp-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line-2)}',
      '.off-cmp-row:last-child{border-bottom:none}',
      '.off-cmp-row.muted{opacity:.7}',
      '.off-cmp-src{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;flex:1}',
      '.off-cmp-src .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
      '.off-cmp-price{font-size:14px;font-weight:700}',
      '.off-cmp-price.bad{color:var(--c-rose)}',
      '.off-cmp-na{font-size:12px;color:var(--muted);font-style:italic}',
      '.off-cmp-delta{font-size:11px;font-weight:700;font-family:var(--mono);min-width:74px;text-align:right}',
      '.off-cmp-delta.bad{color:var(--c-rose)}.off-cmp-delta.ok{color:var(--c-mint)}',
      '.off-insp-cta{margin-top:20px;display:flex;flex-direction:column}',
      '.off-insp-cta .v2-btn{width:100%}',
      '@media(max-width:1100px){.off-insp{width:350px}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── PAGE ──────────────────────────────────────
  V2.pages.offilog = {
    render: function (root, param) {
      injectCss();
      if (param != null && param !== '' && String(param) !== String(S.sel)) S.sel = param;

      // Données : meilleures ventes (obligatoire) + OFFILOG (veille, optionnel)
      if (!window.OFFILOG_BEST) {
        root.innerHTML = V2.topbar({ back: true }) +
          '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement des meilleures ventes Offilog…</div></div>';
        ensureBest(function () {
          if (!window.OFFILOG) { V2.loadFiles(['offilog']).then(function () { idxBuilt = false; V2.render(); }); }
          else { idxBuilt = false; V2.render(); }
        });
        return;
      }
      if (!window.OFFILOG) {
        // best dispo, on charge la veille en tâche de fond puis on rerender
        V2.loadFiles(['offilog']).then(function () { idxBuilt = false; V2.render(); });
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

      var chips = CHIPS.map(function (f) {
        var n = c[f.k] || 0;
        if (f.k !== 'all' && f.k !== 'alerte' && n === 0) return '';
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

      root.innerHTML = V2.topbar({ back: true }) +
        '<div class="v2-wrap"' + (S.sel != null ? ' style="margin-right:392px"' : '') + '>' +
          '<div class="v2-page-title">Offilog &amp; concurrents</div>' +
          '<div class="v2-page-sub">' + V2.fmtNum(nbTotal) + ' meilleures ventes Offilog (prix + photos) · ton achat IP comparé aux prix publics E.Leclerc, Drakkars et Cap3000</div>' +
          '<div class="off-search">' + ICO('search', 19, 2) +
            '<input id="off-search-input" autocomplete="off" placeholder="Rechercher par produit, marque ou EAN…" value="' + qVal + '" oninput="V2.offSearch(this.value)">' + clrBtn + '</div>' +
          '<div class="v2-segs">' + chips + '</div>' +
          '<div class="off-stats-l">' + (S.chip === 'all' ? (S.q ? 'Statistiques · résultats « ' + esc(S.q) + ' »' : 'Statistiques · meilleures ventes') : 'Statistiques · ' + esc(CHIP_BY_KEY[S.chip].label)) + '</div>' +
          statBand(filtered) +
          '<div class="off-toolbar">' +
            '<div class="off-count"><b style="color:var(--ip-ink);font-family:var(--mono)">' + V2.fmtNum(total) + '</b> produit' + (total > 1 ? 's' : '') + (S.chip !== 'all' ? ' · ' + esc(CHIP_BY_KEY[S.chip].label) : '') + '</div>' +
            '<div class="off-sort">' + sortBtn('ventes', 'Meilleures ventes') + sortBtn('prix_asc', 'Prix ↑') + sortBtn('prix_desc', 'Prix ↓') + '</div>' +
          '</div>' +
          gridHtml +
        '</div>' + insHtml;
    }
  };
})();
