/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier 3 — Catalogue Intégral Pharma & concurrents
   Vue catalogue complet (10 500 réf) : filtres familles AFMCODE par
   tranches de prix, recherche, table triée par rang qté, pagination,
   et inspecteur prix concurrents (IP / Drakkars / Cap3000 / Leclerc).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2;
  var esc = V2.esc;

  // ── State module ──────────────────────────────
  var S = {
    chip: 'all',       // famille active
    q: '',             // recherche
    page: 0,           // page courante (0-indexé)
    sel: null,         // cip13 produit sélectionné (inspecteur)
  };
  var PER_PAGE = 100;

  // ── Définition des 9 familles (ordre exact imposé) ──
  var FAMS = [
    { k: 'all',    label: 'Tout',                     sc: '#0050E6' },
    { k: 'p_low',  label: 'Princeps · 0–4,33€',  sc: '#1E9E6A' },
    { k: 'p_mid',  label: 'Princeps · 4,33–468€',sc: '#0050E6' },
    { k: 'p_high', label: 'Princeps · >468€',    sc: '#C7791A' },
    { k: 'froid',  label: 'Froid',                    sc: '#00B5D8' },
    { k: 'gen',    label: 'Génériques',               sc: '#737A8C' },
    { k: 'genp',   label: 'Génériques partenaires',   sc: '#1E9E6A' },
    { k: 'bio',    label: 'Biosimilaires',            sc: '#6D4FC4' },
    { k: 'nr',     label: 'Non remboursés',           sc: '#C7791A' },
  ];
  var FAM_BY_KEY = {};
  FAMS.forEach(function (f) { FAM_BY_KEY[f.k] = f; });

  // ── Index (construits une fois) ───────────────
  var idxBuilt = false;
  var sagittaSet = null;       // Set cip13 dans Sagitta NR
  var sortedBench = null;      // BENCHMARK trié par ip_rank_qty
  var benchByCip = null;       // Map cip13 → produit
  var concIndexed = false;
  var drakByEan = null, capByEan = null, offByEan = null;

  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }

  // prix de référence d'un produit (prix_ip prioritaire, sinon prix_ht)
  function refPrice(b) {
    var p = (b.prix_ip != null && b.prix_ip > 0) ? b.prix_ip : b.prix_ht;
    return (typeof p === 'number' && isFinite(p)) ? p : 0;
  }

  // Classification d'un produit → clé famille (priorité imposée)
  function classify(b) {
    if (b.is_froid) return 'froid';
    var an = norm(b.artnature);
    if (an === 'biosimilaire') return 'bio';
    if (an === 'generique_partenaire' || an === 'generique partenaire') return 'genp';
    if (an === 'generique') return 'gen';
    if ((sagittaSet && sagittaSet.has(String(b.cip13))) || b.has_ameli === false) return 'nr';
    var p = refPrice(b);
    if (p <= 4.33) return 'p_low';
    if (p <= 468) return 'p_mid';
    return 'p_high';
  }

  function buildIndex() {
    if (idxBuilt) return;
    var B = window.BENCHMARK || [];
    sagittaSet = new Set();
    (window.SAGITTA_SHORTLIST || []).forEach(function (s) {
      if (s && s.cip13 != null) sagittaSet.add(String(s.cip13));
    });
    benchByCip = new Map();
    sortedBench = B.slice().sort(function (a, b) {
      return (a.ip_rank_qty || 9e9) - (b.ip_rank_qty || 9e9);
    });
    B.forEach(function (b) {
      b._fam = classify(b);
      if (b.cip13 != null) benchByCip.set(String(b.cip13), b);
    });
    idxBuilt = true;
  }

  function buildConcIndex() {
    if (concIndexed) return;
    drakByEan = new Map(); capByEan = new Map(); offByEan = new Map();
    function key(e) { return e == null ? null : String(e).trim(); }
    (window.DRAKKARS || []).forEach(function (d) {
      var k = key(d.ean); if (k && !drakByEan.has(k)) drakByEan.set(k, d);
    });
    (window.CAP3000 || []).forEach(function (c) {
      var k = key(c.ean); if (k && !capByEan.has(k)) capByEan.set(k, c);
    });
    (window.OFFILOG || []).forEach(function (o) {
      var k = key(o.ean); if (k && !offByEan.has(k)) offByEan.set(k, o);
    });
    concIndexed = true;
  }

  // ── Base filtrée par recherche (sert au comptage live des chips) ──
  function filteredBase() {
    var q = S.q.trim().toLowerCase();
    if (!q) return sortedBench;
    return sortedBench.filter(function (b) {
      return norm(b.designation).indexOf(q) >= 0 || norm(b.cip13).indexOf(q) >= 0;
    });
  }

  function counts(base) {
    var c = { all: base.length };
    FAMS.forEach(function (f) { if (f.k !== 'all') c[f.k] = 0; });
    for (var i = 0; i < base.length; i++) { c[base[i]._fam]++; }
    return c;
  }

  // ── Badge famille (pastille colorée arrondie) ──
  function famBadge(famKey) {
    var f = FAM_BY_KEY[famKey] || FAM_BY_KEY.all;
    var short = {
      p_low: 'Princeps S', p_mid: 'Princeps M', p_high: 'Princeps L',
      froid: 'Froid', gen: 'Génér.', genp: 'Génér. part.', bio: 'Biosim.', nr: 'NR', all: '—'
    }[famKey] || famKey;
    return '<span class="cat-badge" style="--bc:' + f.sc + '">' +
      '<span class="cat-dot"></span>' + esc(short) + '</span>';
  }

  // ── Inspecteur : 4 cartes prix concurrents ────
  function priceCards(b) {
    buildConcIndex();
    var ean = b.cip13 != null ? String(b.cip13).trim() : null;
    var ipP = refPrice(b);
    var d = ean ? drakByEan.get(ean) : null;
    var c = ean ? capByEan.get(ean) : null;
    var o = ean ? offByEan.get(ean) : null;
    var leclerc = (o && o.prix_leclerc != null && o.prix_leclerc > 0) ? o.prix_leclerc : null;

    var cards = [
      { name: 'Intégral Pharma', sub: 'prix IP (achat HT)', val: ipP > 0 ? ipP : null, ip: true },
      { name: 'Drakkars',  sub: 'prix public TTC', val: d && d.prix > 0 ? d.prix : null },
      { name: 'Cap3000',   sub: 'prix public TTC', val: c && c.prix > 0 ? c.prix : null },
      { name: 'E.Leclerc', sub: 'prix public TTC', val: leclerc },
    ];

    // moins cher parmi ceux qui ont un prix
    var withVal = cards.filter(function (x) { return x.val != null; });
    var minVal = withVal.length ? Math.min.apply(null, withVal.map(function (x) { return x.val; })) : null;

    var html = cards.map(function (x) {
      var on = (x.val != null && minVal != null && x.val === minVal);
      var diff = '';
      if (x.val != null && minVal != null && !on) {
        diff = '<div class="pc-diff">+' + V2.fmtEur(x.val - minVal) + '</div>';
      } else if (on) {
        diff = '<div class="pc-diff best">' + ICO('check', 13, 2.2) + ' le moins cher</div>';
      }
      return '<div class="pc-card' + (x.ip ? ' ip' : '') + (on ? ' best' : '') + (x.val == null ? ' na' : '') + '">' +
        '<div class="pc-name">' + esc(x.name) + '</div>' +
        '<div class="pc-val mono">' + (x.val != null ? V2.fmtEur(x.val) : '—') + '</div>' +
        '<div class="pc-sub">' + esc(x.sub) + '</div>' +
        diff +
        '</div>';
    }).join('');

    var note = withVal.length <= 1
      ? '<div class="pc-note">' + ICO('alert', 14, 1.8) + ' Peu de prix concurrents trouvés pour cette référence (recherche par EAN/CIP).</div>'
      : '';

    return '<div class="pc-grid">' + html + '</div>' + note;
  }

  function statBox(l, v) {
    return '<div class="ins-stat"><div class="ins-stat-l">' + esc(l) + '</div><div class="ins-stat-v mono">' + v + '</div></div>';
  }

  function fmtRem(b) {
    return (b.remise_pct != null && b.remise_pct > 0)
      ? b.remise_pct.toFixed(1).replace('.0', '').replace('.', ',') + ' %' : '—';
  }

  function inspector(b) {
    return '<div class="v2-inspect">' +
      '<div class="v2-inspect-head">' +
        '<div>' +
          '<div class="ins-fam">' + famBadge(b._fam) + (b.categorie ? '<span class="ins-cat">' + esc(b.categorie) + '</span>' : '') + '</div>' +
          '<div class="ins-name">' + esc(b.designation) + '</div>' +
          '<div class="ins-cip mono">CIP ' + esc(b.cip13) + (b.atc2 ? ' · ATC ' + esc(b.atc2) : '') + '</div>' +
        '</div>' +
        '<button class="v2-inspect-x" onclick="V2.catSelect(null)" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
      '</div>' +
      '<div class="ins-stats">' +
        statBox('Prix HT', V2.fmtEur(b.prix_ht || 0)) +
        statBox('Prix IP', V2.fmtEur(b.prix_ip || 0)) +
        statBox('Remise', fmtRem(b)) +
        statBox('Vol. IP', V2.fmtNum(b.ip_qty || 0)) +
        statBox('Vol. Ameli', V2.fmtNum(b.ameli_total || 0)) +
      '</div>' +
      '<div class="ins-sec-t">' + ICO('euro', 16, 1.8) + ' Comparaison prix concurrents</div>' +
      priceCards(b) +
      '</div>';
  }

  // ── Table d'une page ──────────────────────────
  function rowsHtml(rows) {
    return rows.map(function (b) {
      var sel = (S.sel != null && String(b.cip13) === String(S.sel)) ? ' sel' : '';
      return '<tr class="cat-row' + sel + '" onclick="V2.catSelect(\'' + esc(b.cip13) + '\')">' +
        '<td class="num cat-rk">' + (b.ip_rank_qty || '—') + '</td>' +
        '<td class="cat-name">' + esc(b.designation) + '</td>' +
        '<td class="mono cat-cip">' + esc(b.cip13) + '</td>' +
        '<td>' + famBadge(b._fam) + '</td>' +
        '<td class="num">' + V2.fmtEur(b.prix_ht || 0) + '</td>' +
        '<td class="num">' + V2.fmtEur(b.prix_ip || 0) + '</td>' +
        '<td class="num">' + fmtRem(b) + '</td>' +
        '<td class="num">' + V2.fmtNum(b.ip_qty || 0) + '</td>' +
        '<td class="num">' + (b.ameli_total ? V2.fmtNum(b.ameli_total) : '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function pager(total, pages) {
    if (pages <= 1) return '';
    var from = S.page * PER_PAGE + 1;
    var to = Math.min(total, (S.page + 1) * PER_PAGE);
    var prevDis = S.page === 0 ? ' disabled' : '';
    var nextDis = S.page >= pages - 1 ? ' disabled' : '';
    return '<div class="cat-pager">' +
      '<button class="v2-btn v2-btn-ghost cat-pg"' + prevDis + ' onclick="V2.catPage(' + (S.page - 1) + ')">' + ICO('back', 15) + ' Précédent</button>' +
      '<span class="cat-pg-info mono">' + from + '–' + to + ' sur ' + V2.fmtNum(total) + ' · page ' + (S.page + 1) + '/' + pages + '</span>' +
      '<button class="v2-btn v2-btn-ghost cat-pg"' + nextDis + ' onclick="V2.catPage(' + (S.page + 1) + ')">Suivant ' + ICO('chev', 15) + '</button>' +
      '</div>';
  }

  // ── Styles spécifiques (injectés une fois) ────
  function injectCss() {
    if (document.getElementById('v2-cat-css')) return;
    var st = document.createElement('style');
    st.id = 'v2-cat-css';
    st.textContent = [
      '.cat-search{display:flex;align-items:center;gap:13px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:13px 18px;margin-bottom:18px;box-shadow:var(--sh-2);transition:.2s var(--ease)}',
      '.cat-search:focus-within{border-color:rgba(0,80,230,.4);box-shadow:0 0 0 4px var(--halo),var(--sh-2)}',
      '.cat-search svg{color:var(--ip-blue);flex-shrink:0}',
      '.cat-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:15px;color:var(--ip-ink);flex:1;min-width:0}',
      '.cat-search input::placeholder{color:var(--muted)}',
      '.cat-search .clr{cursor:pointer;color:var(--muted-2);display:flex;border:none;background:none;padding:2px}',
      '.cat-search .clr:hover{color:var(--ip-ink)}',
      '.v2-seg .cnt{font-family:var(--mono);font-size:11px;opacity:.75;background:rgba(16,19,28,.05);padding:1px 6px;border-radius:8px}',
      '.v2-seg.on .cnt{background:rgba(255,255,255,.2);opacity:.95}',
      '.v2-seg .sw{width:8px;height:8px;border-radius:50%;background:var(--sc,var(--ip-blue))}',
      '.v2-seg.on .sw{background:#fff}',
      '.cat-tablewrap{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);overflow:hidden}',
      '.cat-table-scroll{overflow-x:auto}',
      '.cat-row{cursor:pointer}',
      '.cat-row.sel{background:var(--halo)!important}',
      '.cat-row.sel td:first-child{box-shadow:inset 3px 0 0 var(--ip-blue)}',
      '.cat-name{font-weight:600;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cat-cip{color:var(--muted);font-size:12px}',
      '.cat-rk{color:var(--muted);font-weight:600}',
      '.cat-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 9px 3px 8px;border-radius:var(--r-pill);font-size:11px;font-weight:700;white-space:nowrap;background:color-mix(in srgb,var(--bc) 11%,#fff);color:var(--bc);border:1px solid color-mix(in srgb,var(--bc) 22%,transparent)}',
      '.cat-dot{width:7px;height:7px;border-radius:50%;background:var(--bc);flex-shrink:0}',
      '.cat-pager{display:flex;align-items:center;justify-content:center;gap:16px;padding:18px;flex-wrap:wrap}',
      '.cat-pg{padding:9px 15px;font-size:13px}',
      '.cat-pg[disabled]{opacity:.4;pointer-events:none}',
      '.cat-pg-info{font-size:12.5px;color:var(--muted)}',
      '.cat-count{font-size:12.5px;color:var(--muted);margin:2px 0 16px;font-weight:500}',
      // inspecteur
      '.v2-inspect{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-3);margin-bottom:20px;overflow:hidden;animation:catIns .3s var(--ease)}',
      '@keyframes catIns{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}',
      '.v2-inspect-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--card-2),var(--card))}',
      '.ins-fam{display:flex;align-items:center;gap:10px;margin-bottom:9px;flex-wrap:wrap}',
      '.ins-cat{font-size:11px;color:var(--muted);font-weight:600}',
      '.ins-name{font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1.2}',
      '.ins-cip{font-size:12px;color:var(--muted);margin-top:5px}',
      '.v2-inspect-x{border:1px solid var(--line);background:var(--card);border-radius:11px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);flex-shrink:0;box-shadow:var(--sh-1);transition:.18s var(--ease)}',
      '.v2-inspect-x:hover{color:var(--ip-ink);border-color:var(--line-strong);transform:rotate(90deg)}',
      '.ins-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--line);border-bottom:1px solid var(--line)}',
      '@media(max-width:680px){.ins-stats{grid-template-columns:repeat(2,1fr)}}',
      '.ins-stat{background:var(--card);padding:13px 18px}',
      '.ins-stat-l{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}',
      '.ins-stat-v{font-size:18px;font-weight:700;margin-top:5px;letter-spacing:-.02em}',
      '.ins-sec-t{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;letter-spacing:-.01em;padding:18px 22px 4px;color:var(--ip-ink)}',
      '.ins-sec-t svg{color:var(--ip-blue)}',
      '.pc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:14px 22px 22px}',
      '@media(max-width:680px){.pc-grid{grid-template-columns:repeat(2,1fr)}}',
      '.pc-card{position:relative;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);padding:15px 16px;transition:.18s var(--ease)}',
      '.pc-card.ip{background:var(--halo);border-color:color-mix(in srgb,var(--ip-blue) 22%,transparent)}',
      '.pc-card.best{border-color:color-mix(in srgb,var(--c-mint) 45%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--c-mint) 14%,transparent)}',
      '.pc-card.na{opacity:.55}',
      '.pc-name{font-size:12.5px;font-weight:700;letter-spacing:-.01em}',
      '.pc-val{font-size:21px;font-weight:700;letter-spacing:-.03em;margin-top:7px}',
      '.pc-sub{font-size:10.5px;color:var(--muted);font-weight:500;margin-top:2px}',
      '.pc-diff{font-size:11px;font-weight:700;color:var(--muted);margin-top:9px;display:flex;align-items:center;gap:4px}',
      '.pc-diff.best{color:var(--c-mint)}',
      '.pc-note{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);padding:0 22px 20px;font-weight:500}',
      '.pc-note svg{color:var(--c-amber);flex-shrink:0}',
    ].join('');
    document.head.appendChild(st);
  }

  // ── Actions exposées ──────────────────────────
  V2.catFilter = function (k) { S.chip = k; S.page = 0; V2.render(); };
  V2.catSearch = function (val) { S.q = val || ''; S.page = 0; rerenderKeepFocus(); };
  V2.catPage = function (p) {
    S.page = p; V2.render();
    var w = document.querySelector('.v2-wrap'); if (w) w.scrollIntoView({ block: 'start' });
  };
  V2.catSelect = function (cip) {
    S.sel = (S.sel != null && String(S.sel) === String(cip)) ? null : cip;
    V2.render();
    if (S.sel != null) { var el = document.querySelector('.v2-inspect'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  };

  // re-render en conservant le focus + curseur dans la recherche
  function rerenderKeepFocus() {
    V2.render();
    var inp = document.getElementById('cat-search-input');
    if (inp) { inp.focus(); var v = inp.value; try { inp.setSelectionRange(v.length, v.length); } catch (e) {} }
  }

  // ── PAGE ──────────────────────────────────────
  V2.pages.catalogue = {
    render: function (root, param) {
      injectCss();

      // param d'URL = cip13 → présélection produit
      if (param != null && param !== '' && String(param) !== String(S.sel)) {
        S.sel = param;
      }

      // Lazy data principale
      if (!window.BENCHMARK) {
        root.innerHTML = V2.topbar({ back: true }) +
          '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du catalogue…</div></div>';
        V2.loadFiles(['bench', 'sagitta']).then(function () { idxBuilt = false; V2.render(); });
        return;
      }

      buildIndex();

      var base = filteredBase();
      var c = counts(base);

      var filtered = (S.chip === 'all') ? base : base.filter(function (b) { return b._fam === S.chip; });
      var total = filtered.length;
      var pages = Math.max(1, Math.ceil(total / PER_PAGE));
      if (S.page >= pages) S.page = pages - 1;
      if (S.page < 0) S.page = 0;
      var pageRows = filtered.slice(S.page * PER_PAGE, (S.page + 1) * PER_PAGE);

      var nbTotal = (window.BENCHMARK || []).length;

      // chips
      var chips = FAMS.map(function (f) {
        var n = c[f.k] || 0;
        var on = S.chip === f.k ? ' on' : '';
        return '<button class="v2-seg' + on + '" style="--sc:' + f.sc + '" onclick="V2.catFilter(\'' + f.k + '\')">' +
          (f.k === 'all' ? '' : '<span class="sw"></span>') +
          esc(f.label) + '<span class="cnt">' + V2.fmtNum(n) + '</span></button>';
      }).join('');

      // inspecteur
      var insHtml = '';
      if (S.sel != null) {
        var sb = benchByCip.get(String(S.sel));
        if (sb) {
          if (!V2.dataLoaded('offilog') || !V2.dataLoaded('drakkars') || !V2.dataLoaded('cap3000')) {
            V2.loadFiles(['offilog', 'drakkars', 'cap3000']).then(function () { concIndexed = false; V2.render(); });
          }
          insHtml = inspector(sb);
        } else {
          S.sel = null;
        }
      }

      var tableHtml;
      if (!total) {
        tableHtml = '<div class="cat-tablewrap"><div class="v2-empty">' +
          '<div class="v2-empty-ico">' + ICO('search', 64, 1.4) + '</div>' +
          '<div class="v2-empty-t">Aucune référence</div>' +
          '<div class="v2-empty-d">Aucun produit ne correspond à ce filtre et cette recherche.</div>' +
          '</div></div>';
      } else {
        tableHtml = '<div class="cat-tablewrap"><div class="cat-table-scroll"><table class="v2-table">' +
          '<thead><tr>' +
            '<th class="num">#</th><th>Produit</th><th>CIP13</th><th>Famille</th>' +
            '<th class="num">Prix HT</th><th class="num">Prix IP</th><th class="num">Remise</th>' +
            '<th class="num">Vol IP</th><th class="num">Vol Ameli</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml(pageRows) + '</tbody>' +
          '</table></div>' + pager(total, pages) + '</div>';
      }

      var qVal = S.q.replace(/"/g, '&quot;');
      var clrBtn = S.q ? '<button class="clr" onclick="V2.catSearch(\'\')">' + ICO('close', 16, 2) + '</button>' : '';

      root.innerHTML = V2.topbar({ back: true }) +
        '<div class="v2-wrap">' +
          '<div class="v2-page-title">Catalogue Intégral Pharma</div>' +
          '<div class="v2-page-sub">' + V2.fmtNum(nbTotal) + ' références · filtre par tranches de prix et familles</div>' +
          '<div class="cat-search">' + ICO('search', 19, 2) +
            '<input id="cat-search-input" autocomplete="off" placeholder="Rechercher par CIP13 ou désignation…" value="' + qVal + '" oninput="V2.catSearch(this.value)">' +
            clrBtn +
          '</div>' +
          '<div class="v2-segs">' + chips + '</div>' +
          insHtml +
          '<div class="cat-count">' + V2.fmtNum(total) + ' référence' + (total > 1 ? 's' : '') + (S.chip !== 'all' ? ' · ' + esc(FAM_BY_KEY[S.chip].label) : '') + '</div>' +
          tableHtml +
        '</div>';
    }
  };
})();
