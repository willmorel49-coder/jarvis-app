/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Opportunités pharmacie" (pages.pharma)
   Vue A : liste des officines (CA du mois + marge MDL générée)
   Vue B : fiche opportunités — top marché OPS+CPR+HP que la pharma
           ne commande PAS, classé en 8 catégories.
   ── Vanilla JS pur · IIFE · zéro dépendance · zéro emoji ──
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {}; // ce fichier charge AVANT v2-app.js → on garantit le registry

  // helpers locaux (V2.esc/V2.cap définis dans v2-app.js, chargé APRÈS → on défère)
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // ── State local module (toggle cartes catégories + recherche) ──
  // collapsed[catKey] === true → carte repliée. Par défaut : 1ère ouverte.
  var collapsed = {};
  var searchQuery = '';
  // Sélection de produits cochés (bouton +) pour le PDF RDV — propre à une pharma
  var selCips = null;   // Set des CIP cochés
  var selPid = null;    // pharma à laquelle appartient la sélection courante
  // Filtre segment OPSO : 'all' | 'cliente' | 'prospect'
  var opsoFilter = 'all';

  // ── Helpers OPSO ──────────────────────────────────────────────
  function isOpso() { return !!(window.V2_BRAND && window.V2_BRAND.opso); }

  // Badge HTML cliente / prospect (OPSO uniquement)
  function opsoBadge(p) {
    if (!isOpso()) return '';
    if (p.inDb) {
      return '<span class="opso-badge opso-badge-cliente">Cliente</span>';
    }
    return '<span class="opso-badge opso-badge-prospect">Prospect</span>';
  }

  // ── Définition des 8 catégories (ordre EXACT du brief) ─────────
  var CATS = [
    { key: 'pp',     label: 'Princeps · Petits prix',    sub: '0 – 4,33 €',      color: '#1E9E6A', cap: 30 },
    { key: 'mi',     label: 'Princeps · Intermédiaires', sub: '4,33 – 468 €',    color: '#0050E6', cap: 30 },
    { key: 'ch',     label: 'Princeps · Chers',          sub: '> 468 €',         color: '#C7791A', cap: 20 },
    { key: 'froid',  label: 'Froid',                     sub: 'chaîne du froid', color: '#00B5D8', cap: 30 },
    { key: 'gen',    label: 'Génériques',                sub: '',                color: '#737A8C', cap: 30 },
    { key: 'genp',   label: 'Génériques partenaires',    sub: '',                color: '#1E9E6A', cap: 30 },
    { key: 'biosim', label: 'Biosimilaires',             sub: '',                color: '#6D4FC4', cap: 20 },
    { key: 'nr',     label: 'Non remboursés',            sub: 'marge libre',     color: '#C7791A', cap: 30 }
  ];

  // ── Index BENCHMARK (Map cip13 → bench) — construit une seule fois ──
  var _benchIdx = null;
  var _nrIdx = null; // Set des CIP NR (Sagitta shortlist)
  function benchIndex() {
    if (_benchIdx) return _benchIdx;
    _benchIdx = new Map();
    var B = window.BENCHMARK || [];
    for (var i = 0; i < B.length; i++) {
      var b = B[i];
      if (b.cip13) _benchIdx.set(String(b.cip13), b);
    }
    return _benchIdx;
  }
  function nrIndex() {
    if (_nrIdx) return _nrIdx;
    _nrIdx = new Set();
    var S = window.SAGITTA_SHORTLIST || [];
    for (var i = 0; i < S.length; i++) {
      var c = String(S[i].cip13 || S[i].cip || '');
      if (c) _nrIdx.add(c);
    }
    return _nrIdx;
  }

  // Remboursable = présent en BENCHMARK avec has_ameli ET pas NR Sagitta
  function isRemboursable(cip) {
    var c = String(cip || '');
    if (!c) return false;
    if (nrIndex().has(c)) return false;
    var b = benchIndex().get(c);
    return !!(b && b.has_ameli === true);
  }

  // ── Marge MDL générée par une pharma (sur ses ventes remboursables) ──
  function margeMDLpharma(sales) {
    var total = 0;
    for (var i = 0; i < sales.length; i++) {
      var s = sales[i];
      if (isRemboursable(s.artCode)) {
        total += V2.margeMDLboite(s.puNet || 0) * (s.qte || 0);
      }
    }
    return total;
  }

  // ── Ventes d'une pharma ────────────────────────────────────────
  function pharmaSales(pid) {
    return (V2.sales || []).filter(function (s) { return String(s.pharmacyId) === String(pid); });
  }

  // ── Classement d'un produit benchmark dans une des 8 catégories ──
  // Priorité : NR > biosim > gen.part > gen > froid > princeps(pp/mi/ch)
  function classify(b, cip) {
    if (!b) return null;
    var nat = String(b.artnature || '').toLowerCase();
    // 8. Non remboursés : dans Sagitta OU has_ameli=false
    if (nrIndex().has(cip) || b.has_ameli === false) return 'nr';
    // 7. Biosimilaires
    if (nat === 'biosimilaire') return 'biosim';
    // 6. Génériques partenaires
    if (nat === 'generique_partenaire') return 'genp';
    // 5. Génériques
    if (nat === 'generique') return 'gen';
    // 4. Froid
    if (b.is_froid === true) return 'froid';
    // 1-3. Princeps par tranche prix (champ categorie : pp/mi/ch)
    if (b.categorie === 'pp' || b.categorie === 'mi' || b.categorie === 'ch') return b.categorie;
    return null; // hors périmètre des 8 catégories
  }

  // ── Fusion OPS + CPR + HP par CIP (cumul qte/ca + détail par source) ──
  // Clé commune : ean (= CIP13, identique à BENCHMARK.cip13 et sales.artCode)
  // Retourne Map cip13 → { cip, qte, ca, ops, cpr, hp, designation }
  var _marketCache = null;
  function mergeMarket() {
    if (_marketCache) return _marketCache;
    var out = new Map();
    var sources = [
      { agg: window.OPS_AGGREGATE, k: 'ops' },
      { agg: window.CPR_AGGREGATE, k: 'cpr' },
      { agg: window.HP_AGGREGATE,  k: 'hp' }
    ];
    for (var si = 0; si < sources.length; si++) {
      var agg = sources[si].agg, k = sources[si].k;
      if (!agg) continue;
      for (var code in agg) {
        if (!Object.prototype.hasOwnProperty.call(agg, code)) continue;
        var row = agg[code];
        var cip = String(row.ean || ''); // ean = CIP13
        if (!cip) continue;
        var cur = out.get(cip);
        if (!cur) { cur = { cip: cip, qte: 0, ca: 0, ops: 0, cpr: 0, hp: 0, designation: row.designation || '' }; out.set(cip, cur); }
        var q = row.qte || 0;
        cur.qte += q;
        cur.ca += row.ca || 0;
        cur[k] += q;
        if (!cur.designation && row.designation) cur.designation = row.designation;
      }
    }
    _marketCache = out;
    return out;
  }

  // ── Construit les opportunités par catégorie pour une pharma ────
  function buildOpportunities(pid) {
    var sales = pharmaSales(pid);
    // CIP déjà commandés par cette pharma
    var owned = new Set();
    sales.forEach(function (s) {
      var c = String(s.artCode || '');
      if (c.length >= 7) owned.add(c);
    });

    var bIdx = benchIndex();
    var market = mergeMarket();

    // buckets par catégorie
    var buckets = {};
    CATS.forEach(function (c) { buckets[c.key] = []; });

    market.forEach(function (m, cip) {
      if (owned.has(cip)) return;            // déjà commandé → pas une opp
      var b = bIdx.get(cip);
      if (!b) return;                        // pas dans le catalogue IP → on ignore
      var cat = classify(b, cip);
      if (!cat || !buckets[cat]) return;
      buckets[cat].push({
        cip: cip,
        designation: b.designation || m.designation || '',
        prix_ip: b.prix_ip,
        marketQte: m.qte,
        ops: m.ops, cpr: m.cpr, hp: m.hp
      });
    });

    // tri par qté marché desc + cap par catégorie
    return CATS.map(function (c) {
      var rows = buckets[c.key];
      rows.sort(function (a, b) { return b.marketQte - a.marketQte; });
      var totalQte = rows.reduce(function (s, r) { return s + r.marketQte; }, 0);
      return { cat: c, rows: rows.slice(0, c.cap), oppCount: rows.length, totalQte: totalQte };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ── Analyse VOLUMES IP : best-sellers IP (par volume) que la pharma ne prend pas
  function buildIpVolumeReco(pid, limit) {
    var B = window.BENCHMARK || [];
    if (!B.length) return null;
    var bought = {};
    pharmaSales(pid).forEach(function (s) {
      var c = String(s.artCode == null ? '' : s.artCode).trim();
      if (c) bought[c] = (bought[c] || 0) + (s.qte || 0);
    });
    var top = B.filter(function (b) { return (+b.ip_qty || 0) > 0; })
      .sort(function (a, b) { return (+b.ip_qty || 0) - (+a.ip_qty || 0); });
    var manque = [];
    for (var i = 0; i < top.length && manque.length < (limit || 40); i++) {
      var b = top[i];
      var q = bought[String(b.cip13 == null ? '' : b.cip13).trim()] || 0;
      if (q === 0) manque.push(b);
    }
    return { manque: manque, total: top.length };
  }

  function ipVolumeSection(pid) {
    var reco = buildIpVolumeReco(pid, 40);
    if (!reco || !reco.manque.length) return '';
    var rows = reco.manque.map(function (b) {
      var rank = b.ip_rank_qty ? ('#' + b.ip_rank_qty) : '';
      var cip = String(b.cip13 == null ? '' : b.cip13).trim();
      var on = selCips && selCips.has(cip);
      return '<div class="ipv-row">' +
        '<span class="ipv-rank">' + rank + '</span>' +
        '<span class="ipv-name">' + esc(cap((b.designation || '').toLowerCase())) + '</span>' +
        '<span class="ipv-vol mono">' + V2.fmtNum(+b.ip_qty || 0) + ' u<small>/an IP</small></span>' +
        '<button type="button" class="opp-add' + (on ? ' on' : '') + '" data-cip="' + esc(cip) +
          '" onclick="V2.pharmaToggleSel(this)" aria-label="Ajouter au PDF RDV">' + (on ? '✓' : '+') + '</button>' +
        '</div>';
    }).join('');
    return '<div style="margin-top:26px">' +
      '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px;flex-wrap:wrap">' +
        '<div class="v2-page-title" style="margin:0;font-size:22px">Best-sellers IP à pousser</div>' +
        '<div style="font-size:13px;color:var(--muted)">les produits qui sortent le plus chez Intégral Pharma (volume) que cette officine ne commande pas</div>' +
      '</div>' +
      '<div class="v2-card" style="padding:6px 0">' + rows + '</div>' +
      '</div>';
  }

  // VUE A — Liste des officines
  // ─────────────────────────────────────────────────────────────
  function listRowHtml(x) {
    var color = x.p.color || 'var(--ip-blue)';
    var oppPill = (x.opp == null)
      ? '<span class="v2-row-opp v2-row-opp-pending mono">…</span>'
      : '<span class="v2-row-opp mono">' + V2.fmtNum(x.opp) + ' opp</span>';
    var badge = opsoBadge(x.p);
    return '<a class="v2-row' + (isOpso() && x.p.inDb ? ' opso-row-cliente' : '') + '" onclick="V2.go(\'pharma\',\'' + V2.esc(String(x.p.id)) + '\')">' +
      '<span class="v2-row-dot" style="background:' + V2.esc(color) + '"></span>' +
      '<span class="v2-row-name">' + V2.esc(x.p.name) + '</span>' +
      badge +
      oppPill +
      '<span class="v2-row-meta">marge MDL</span>' +
      '<span class="v2-row-val mono" style="color:var(--c-opp)">' + V2.fmtEur(x.marge) + '</span>' +
      '<span class="v2-row-val mono" style="min-width:84px;text-align:right">' + V2.fmtEur(x.ca) + '</span>' +
      '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
  }

  function renderList(root) {
    var marketReady = !!window.OPS_AGGREGATE;
    var phs = (V2.pharmacies || []).map(function (p) {
      var sales = pharmaSales(p.id);
      var x = { p: p, ca: V2.sumCA(sales), marge: margeMDLpharma(sales), opp: null };
      if (marketReady) {
        x.opp = buildOpportunities(p.id).reduce(function (s, o) { return s + o.oppCount; }, 0);
      }
      return x;
    });

    // ── Tri OPSO : clientes d'abord, puis par CA desc ──
    if (isOpso()) {
      phs.sort(function (a, b) {
        var ac = a.p.inDb ? 1 : 0;
        var bc = b.p.inDb ? 1 : 0;
        if (bc !== ac) return bc - ac;   // clientes (1) avant prospects (0)
        return b.ca - a.ca;
      });
    } else {
      phs.sort(function (a, b) { return b.ca - a.ca; });
    }

    // Marché sectoriel pas encore chargé → on charge en tâche de fond puis on
    // rafraîchit la liste pour afficher le compteur d'opportunités par officine.
    if (!marketReady) {
      V2.loadFiles(['establishments']).then(function () {
        _marketCache = null;
        if (V2.route && V2.route.name === 'pharma' && !V2.route.param) V2.render();
      });
    }

    // ── Compteurs OPSO ──
    var nbClientes = 0, nbProspects = 0;
    if (isOpso()) {
      phs.forEach(function (x) { if (x.p.inDb) nbClientes++; else nbProspects++; });
    }

    function applyFilters(list) {
      var q = searchQuery.trim().toLowerCase();
      return list.filter(function (x) {
        if (q && x.p.name.toLowerCase().indexOf(q) < 0) return false;
        if (isOpso() && opsoFilter === 'cliente' && !x.p.inDb) return false;
        if (isOpso() && opsoFilter === 'prospect' && x.p.inDb) return false;
        return true;
      });
    }

    function cardHtml(filtered) {
      return filtered.length
        ? filtered.map(listRowHtml).join('')
        : '<div class="v2-empty"><div class="v2-empty-t">Aucune officine</div><div class="v2-empty-d">' +
          (searchQuery ? 'Aucun résultat pour « ' + V2.esc(searchQuery) + ' ».' : 'Aucune pharmacie chargée.') +
          '</div></div>';
    }

    // ── Barre de filtres OPSO (segment clientes / prospects) ──
    var opsoFilterBar = '';
    if (isOpso()) {
      function segBtn(val, label, count) {
        var on = (opsoFilter === val) ? ' on' : '';
        var sc = val === 'cliente' ? 'var(--ip-blue)' : (val === 'prospect' ? 'var(--muted)' : 'var(--ip-blue)');
        return '<button type="button" class="v2-seg' + on + '" style="--sc:' + sc + '" ' +
          'onclick="V2.pharmaOpsoFilter(\'' + val + '\')">' +
          label + '<span class="cnt">' + count + '</span></button>';
      }
      opsoFilterBar =
        '<div class="v2-segs" style="margin-bottom:14px">' +
          segBtn('all',      'Toutes',    phs.length) +
          segBtn('cliente',  'Clientes',  nbClientes) +
          segBtn('prospect', 'Prospects', nbProspects) +
        '</div>';

      var counterHtml =
        '<div class="opso-counter">' +
          '<span class="opso-counter-item opso-counter-cliente">' + nbClientes + ' cliente' + (nbClientes > 1 ? 's' : '') + '</span>' +
          '<span class="opso-counter-sep">·</span>' +
          '<span class="opso-counter-item opso-counter-prospect">' + nbProspects + ' prospect' + (nbProspects > 1 ? 's' : '') + '</span>' +
        '</div>';

      opsoFilterBar = counterHtml + opsoFilterBar;
    }

    var filtered = applyFilters(phs);

    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-title">Mes officines</div>' +
        '<div class="v2-page-sub">' + phs.length + ' pharmacie' + (phs.length > 1 ? 's' : '') +
          ' · clique pour voir les opportunités</div>' +
        opsoFilterBar +
        '<div class="v2-search" style="margin-bottom:20px;padding:14px 18px">' + ICO('search', 20, 2) +
          '<input id="v2-pharma-search" placeholder="Rechercher une officine…" autocomplete="off" value="' +
          V2.esc(searchQuery) + '"></div>' +
        '<div class="v2-card" id="v2-pharma-card">' + cardHtml(filtered) + '</div>' +
      '</div>';

    // Recherche live : on ne re-render QUE la liste pour préserver le focus
    var inp = document.getElementById('v2-pharma-search');
    if (inp) {
      inp.addEventListener('input', function () {
        searchQuery = inp.value;
        var card = document.getElementById('v2-pharma-card');
        if (!card) return;
        var f = applyFilters(phs);
        card.innerHTML = cardHtml(f);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // VUE B — Fiche opportunités d'une pharma
  // ─────────────────────────────────────────────────────────────
  function stat(label, value, color) {
    return '<div class="v2-pharma-stat" style="--sc:' + color + '">' +
      '<div class="v2-pharma-stat-l">' + label + '</div>' +
      '<div class="v2-pharma-stat-v mono">' + value + '</div></div>';
  }

  function renderCatCard(o, idx) {
    var c = o.cat;
    var key = c.key;
    // par défaut : première catégorie ouverte, le reste replié
    var isCollapsed = (key in collapsed) ? collapsed[key] : (idx !== 0);
    var hasRows = o.rows.length > 0;

    var head =
      '<div class="v2-cat-head" onclick="V2.pharmaToggleCat(\'' + key + '\')">' +
        '<span class="v2-cat-accent" style="background:' + c.color + '"></span>' +
        '<div class="v2-cat-titles">' +
          '<div class="v2-cat-t">' + c.label +
            (c.sub ? '<span class="v2-cat-sub">' + c.sub + '</span>' : '') + '</div>' +
          '<div class="v2-cat-meta mono">' + o.oppCount + ' opp · ' + V2.fmtNum(o.totalQte) + ' u marché</div>' +
        '</div>' +
        '<span class="v2-cat-chev' + (isCollapsed ? '' : ' open') + '">' + ICO('chev', 18) + '</span>' +
      '</div>';

    if (isCollapsed) return '<div class="v2-card v2-cat">' + head + '</div>';

    var body;
    if (!hasRows) {
      body = '<div class="v2-cat-empty">Aucune opportunité — cette officine couvre déjà cette catégorie.</div>';
    } else {
      var trs = o.rows.map(function (r, i) {
        var on = !!(selCips && selCips.has(r.cip));
        var addBtn = '<button type="button" class="opp-add' + (on ? ' on' : '') + '" data-cip="' +
          V2.esc(r.cip) + '" onclick="V2.pharmaToggleSel(this)" aria-label="Ajouter au PDF RDV">' +
          ICO(on ? 'check' : 'plus', 15) + '</button>';
        return '<tr>' +
          '<td class="num" style="color:var(--muted-2);width:34px;text-align:right;font-family:var(--mono)">' + (i + 1) + '</td>' +
          '<td><span class="v2-cat-prod">' + V2.esc(r.designation) + '</span></td>' +
          '<td class="mono" style="color:var(--muted);font-size:12px">' + V2.esc(r.cip) + '</td>' +
          '<td class="num">' + (r.prix_ip != null && r.prix_ip > 0 ? V2.fmtEur(r.prix_ip) : '—') + '</td>' +
          '<td class="num" style="font-weight:700">' + V2.fmtNum(r.marketQte) + '</td>' +
          '<td class="num">' + (r.ops ? V2.fmtNum(r.ops) : '·') + '</td>' +
          '<td class="num">' + (r.cpr ? V2.fmtNum(r.cpr) : '·') + '</td>' +
          '<td class="num">' + (r.hp ? V2.fmtNum(r.hp) : '·') + '</td>' +
          '<td style="width:46px;text-align:center">' + addBtn + '</td>' +
          '</tr>';
      }).join('');
      body = '<div class="v2-cat-table-wrap"><table class="v2-table">' +
        '<thead><tr>' +
          '<th class="num">#</th><th>Produit</th><th>CIP</th>' +
          '<th class="num">Prix IP</th><th class="num">Vol. marché</th>' +
          '<th class="num">OPS</th><th class="num">CPR</th><th class="num">HP</th>' +
          '<th></th>' +
        '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    }

    return '<div class="v2-card v2-cat open">' + head + body + '</div>';
  }

  // ── CA par mois (officine) ────────────────────
  var MN_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function monthlyCA(sales) {
    var by = {};
    sales.forEach(function (s) {
      if (!s.month || !s.year) return;
      var k = s.year * 12 + (s.month - 1);
      if (!by[k]) by[k] = { k: k, year: s.year, month: s.month, ca: 0 };
      by[k].ca += s.mntNetHt || 0;
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return a.k - b.k; });
  }

  // ── Ce que l'officine commande déjà, ventilé par tranche/catégorie ──
  function ownedByCat(sales) {
    var bIdx = benchIndex();
    var buckets = {};
    CATS.forEach(function (c) { buckets[c.key] = { ca: 0, qte: 0, mdl: 0, refs: new Set() }; });
    var other = { ca: 0, qte: 0, refs: new Set() };
    sales.forEach(function (s) {
      var cip = String(s.artCode || '');
      var b = cip ? bIdx.get(cip) : null;
      var cat = b ? classify(b, cip) : null;
      var bk = (cat && buckets[cat]) ? buckets[cat] : other;
      bk.ca += s.mntNetHt || 0;
      bk.qte += s.qte || 0;
      if (cip.length >= 7) bk.refs.add(cip);
      if (cat && buckets[cat] && isRemboursable(cip)) {
        buckets[cat].mdl += V2.margeMDLboite(s.puNet || 0) * (s.qte || 0);
      }
    });
    return { buckets: buckets, other: other };
  }

  // ── Top N produits commandés (en valeur/CA) par catégorie ──
  function ownedTopByCat(sales, n) {
    var bIdx = benchIndex();
    var byCat = {}; CATS.forEach(function (c) { byCat[c.key] = {}; });
    sales.forEach(function (s) {
      var cip = String(s.artCode || ''); if (cip.length < 7) return;
      var b = bIdx.get(cip); var cat = b ? classify(b, cip) : null;
      if (!cat || !byCat[cat]) return;
      var m = byCat[cat], e = m[cip];
      if (!e) { e = m[cip] = { cip: cip, designation: (b && b.designation) || s.artDesignation || cip, ca: 0, qte: 0 }; }
      e.ca += s.mntNetHt || 0;
      e.qte += s.qte || 0;
    });
    return CATS.map(function (c) {
      var arr = Object.keys(byCat[c.key]).map(function (k) { return byCat[c.key][k]; })
        .sort(function (a, b) { return b.ca - a.ca; });
      return { cat: c, rows: arr.slice(0, n || 5), total: arr.length };
    }).filter(function (o) { return o.rows.length; });
  }

  function topByCatSection(sales) {
    var data = ownedTopByCat(sales, 5);
    if (!data.length) return '';
    var cards = data.map(function (o) {
      var rows = o.rows.map(function (r, i) {
        return '<div class="ph-top-row">' +
          '<span class="ph-top-rank mono">' + (i + 1) + '</span>' +
          '<span class="ph-top-name">' + esc(r.designation) + '</span>' +
          '<span class="ph-top-val mono">' + V2.fmtEur(r.ca) + '<span class="ph-top-q"> · ' + V2.fmtNum(r.qte) + ' u</span></span>' +
        '</div>';
      }).join('');
      return '<div class="ph-top-card">' +
        '<div class="ph-top-head"><span class="ph-top-dot" style="background:' + o.cat.color + '"></span>' +
          '<span class="ph-top-t">' + esc(o.cat.label) + '</span>' +
          '<span class="ph-top-n mono">' + V2.fmtNum(o.total) + ' réf.</span></div>' +
        rows + '</div>';
    }).join('');
    return '<div class="ph-topcats">' +
        '<div style="display:flex;align-items:baseline;gap:10px;margin:26px 0 14px;flex-wrap:wrap">' +
          '<div class="v2-page-title" style="margin:0;font-size:22px">Top 5 par catégorie</div>' +
          '<div style="font-size:13px;color:var(--muted)">ses meilleures références commandées, en valeur (CA)</div>' +
        '</div>' +
        '<div class="ph-top-grid">' + cards + '</div>' +
      '</div>';
  }

  function activitySection(sales, marge, ca) {
    // 1. CA par mois
    var months = monthlyCA(sales);
    var maxM = months.reduce(function (m, x) { return Math.max(m, x.ca); }, 1);
    var barsHtml = months.map(function (m) {
      var h = m.ca > 0 ? Math.max(5, m.ca / maxM * 100) : 0;
      return '<div class="ph-mbar" title="' + esc(cap(MN_SHORT[m.month - 1]) + ' ' + m.year + ' · ' + V2.fmtEur(m.ca)) + '">' +
        '<div class="ph-mbar-v mono">' + V2.fmtK(m.ca) + '</div>' +
        '<div class="ph-mbar-track"><span class="ph-mbar-fill" style="height:' + h + '%"></span></div>' +
        '<div class="ph-mbar-l">' + cap(MN_SHORT[m.month - 1]) + '</div></div>';
    }).join('');
    var chartCard =
      '<div class="v2-card" style="padding:18px 20px">' +
        '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('pilo', 17) + 'CA par mois</div>' +
        (months.length ? '<div class="ph-mchart">' + barsHtml + '</div>'
                       : '<div class="v2-cat-empty" style="border:none;padding:10px 0">Aucune vente sur la période.</div>') +
      '</div>';

    // 2. Commandé par tranche
    var oc = ownedByCat(sales);
    var rowsArr = CATS.map(function (c) {
      var b = oc.buckets[c.key];
      return { c: c, refs: b.refs.size, qte: b.qte, ca: b.ca, mdl: b.mdl };
    }).filter(function (r) { return r.refs > 0; })
      .sort(function (a, b) { return b.ca - a.ca; });
    var maxCa = rowsArr.reduce(function (m, r) { return Math.max(m, r.ca); }, 1);
    var trRows = rowsArr.map(function (r) {
      var pct = r.ca > 0 ? Math.max(3, r.ca / maxCa * 100) : 0;
      return '<tr>' +
        '<td><span class="ph-tr-cat"><span class="ph-tr-dot" style="background:' + r.c.color + '"></span>' + esc(r.c.label) +
          (r.c.sub ? '<span class="ph-tr-sub">' + esc(r.c.sub) + '</span>' : '') + '</span>' +
          '<div class="ph-tr-bar"><span style="width:' + pct.toFixed(1) + '%;background:' + r.c.color + '"></span></div></td>' +
        '<td class="num">' + V2.fmtNum(r.refs) + '</td>' +
        '<td class="num">' + V2.fmtNum(r.qte) + '</td>' +
        '<td class="num" style="font-weight:700">' + V2.fmtEur(r.ca) + '</td>' +
        '<td class="num" style="color:var(--c-opp);font-weight:700">' + (r.mdl > 0 ? V2.fmtEur(r.mdl) : '—') + '</td>' +
        '</tr>';
    }).join('');
    if (oc.other.refs.size) {
      trRows += '<tr><td><span class="ph-tr-cat"><span class="ph-tr-dot" style="background:var(--muted-2)"></span>Hors catégories</span></td>' +
        '<td class="num">' + V2.fmtNum(oc.other.refs.size) + '</td><td class="num">' + V2.fmtNum(oc.other.qte) + '</td>' +
        '<td class="num" style="font-weight:700">' + V2.fmtEur(oc.other.ca) + '</td><td class="num">—</td></tr>';
    }
    var trCard =
      '<div class="v2-card" style="padding:0;overflow:hidden">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('cat', 17) + 'Ce qu\'elle commande déjà · par tranche</div>' +
          '<span class="v2-card-link" style="cursor:default;color:var(--muted)">marge MDL ' + V2.fmtEur(marge) + '</span></div>' +
        (trRows
          ? '<div class="v2-cat-table-wrap" style="border-top:none"><table class="v2-table">' +
            '<thead><tr><th>Tranche / famille</th><th class="num">Réfs</th><th class="num">Volume</th><th class="num">CA net</th><th class="num">Marge MDL</th></tr></thead>' +
            '<tbody>' + trRows + '</tbody></table></div>'
          : '<div class="v2-cat-empty">Aucun produit commandé identifié.</div>') +
      '</div>';

    return '<div class="ph-activity">' +
        '<div style="display:flex;align-items:baseline;gap:10px;margin:4px 0 14px;flex-wrap:wrap">' +
          '<div class="v2-page-title" style="margin:0;font-size:22px">Activité de l\'officine</div>' +
          '<div style="font-size:13px;color:var(--muted)">son CA, ce qu\'elle commande et sa marge</div>' +
        '</div>' +
        '<div class="ph-act-grid">' + chartCard + trCard + '</div>' +
      '</div>';
  }

  function renderDetail(root, pid) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (!pharma) { renderList(root); return; }

    // Agrégats marché + catalogue IP chargés ? sinon lazy-load + état loading
    if (!window.OPS_AGGREGATE || !window.BENCHMARK) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du marché sectoriel…</div></div>';
      V2.loadFiles(['establishments', 'bench']).then(function () { _marketCache = null; V2.render(); });
      return;
    }

    // Nouvelle pharma → on repart d'une sélection vide
    if (String(selPid) !== String(pid)) { selPid = String(pid); selCips = new Set(); }

    var sales = pharmaSales(pid);
    var ca = V2.sumCA(sales);
    var marge = margeMDLpharma(sales);
    var nbRefs = new Set(sales.map(function (s) { return String(s.artCode || ''); })
      .filter(function (c) { return c.length >= 7; })).size;

    var opps = buildOpportunities(pid);
    var totalOpp = opps.reduce(function (s, o) { return s + o.oppCount; }, 0);

    // Badge OPSO dans la fiche (à côté du nom)
    var ficheBadge = isOpso() ? ' ' + opsoBadge(pharma) : '';

    var hero =
      '<div class="v2-card" style="margin-bottom:22px;padding:0">' +
        '<div style="display:flex;align-items:center;gap:14px;padding:20px 22px;border-bottom:1px solid var(--line);flex-wrap:wrap">' +
          '<span class="v2-pharma-pin" style="background:' + V2.esc(pharma.color || 'var(--ip-blue)') + '">' +
            ICO('pharma', 22) + '</span>' +
          '<div style="flex:1;min-width:160px">' +
            '<div style="font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.1;display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
              V2.esc(pharma.name) + ficheBadge +
            '</div>' +
            (pharma.code ? '<div style="font-size:12px;color:var(--muted);margin-top:3px;font-family:var(--mono)">' + V2.esc(pharma.code) + '</div>' : '') +
          '</div>' +
          '<button id="v2-opp-pdf" class="v2-btn v2-btn-primary" onclick="V2.pharmaDownloadPdf(\'' + V2.esc(String(pid)) + '\')">' +
            ICO('download', 17) + (selCips && selCips.size
              ? 'Prépa RDV · ' + selCips.size + ' produit' + (selCips.size > 1 ? 's' : '')
              : 'Préparer le RDV (PDF)') + '</button>' +
        '</div>' +
        '<div class="v2-pharma-stats">' +
          stat('CA cumulé', V2.fmtEur(ca), 'var(--c-fiche)') +
          stat('Marge MDL générée', V2.fmtEur(marge), 'var(--c-opp)') +
          stat('Références commandées', V2.fmtNum(nbRefs), 'var(--c-cat)') +
          stat('Opportunités détectées', V2.fmtNum(totalOpp), 'var(--c-amber)') +
        '</div>' +
      '</div>';

    var catsHtml = opps.map(renderCatCard).join('');

    root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
      '<div class="v2-wrap">' +
        hero +
        activitySection(sales, marge, ca) +
        topByCatSection(sales) +
        '<div style="display:flex;align-items:baseline;gap:10px;margin:26px 0 16px;flex-wrap:wrap">' +
          '<div class="v2-page-title" style="margin:0;font-size:22px">Opportunités par catégorie</div>' +
          '<div style="font-size:13px;color:var(--muted)">ce que le marché commande et que cette officine n\'a pas encore</div>' +
        '</div>' +
        catsHtml +
      '</div>';
  }

  // ── Handlers exposés ───────────────────────────────────────────
  // Met à jour le libellé du bouton PDF sans re-render (préserve le scroll)
  function refreshPdfBtn() {
    var b = document.getElementById('v2-opp-pdf');
    if (!b) return;
    var n = selCips ? selCips.size : 0;
    b.innerHTML = ICO('download', 17) + (n
      ? 'Prépa RDV · ' + n + ' produit' + (n > 1 ? 's' : '')
      : 'Préparer le RDV (PDF)');
  }

  // Coche / décoche un produit (toggle ciblé, pas de re-render).
  // Le ✓ sert au PDF RDV immédiat ET alimente la "fiche en cours" partagée.
  V2.pharmaToggleSel = function (btn) {
    if (!selCips) selCips = new Set();
    var cip = btn.getAttribute('data-cip');
    if (selCips.has(cip)) {
      selCips.delete(cip);
      btn.classList.remove('on');
      btn.innerHTML = ICO('plus', 15);
      if (V2.ficheCart) V2.ficheCart.remove(cip);
    } else {
      selCips.add(cip);
      btn.classList.add('on');
      btn.innerHTML = ICO('check', 15);
      if (V2.ficheCart) {
        var b = benchIndex().get(String(cip));
        V2.ficheCart.add({
          cip13: cip,
          designation: b ? b.designation : cip,
          prix_ip: b ? b.prix_ip : null,
          prix_ht: b ? b.prix_ht : null,
          remise_pct: b ? b.remise_pct : null,
          is_froid: b ? b.is_froid : false,
          src: 'opp'
        });
      }
      V2.toast('Retenu — ajouté à la fiche en cours');
    }
    refreshPdfBtn();
  };

  V2.pharmaToggleCat = function (key) {
    var idx = -1;
    for (var i = 0; i < CATS.length; i++) { if (CATS[i].key === key) { idx = i; break; } }
    var cur = (key in collapsed) ? collapsed[key] : (idx !== 0);
    collapsed[key] = !cur;
    var y = window.scrollY || window.pageYOffset || 0; // préserve la position de lecture
    V2.render();
    try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
  };

  // ── Handler filtre OPSO (segment clientes / prospects) ──
  V2.pharmaOpsoFilter = function (val) {
    opsoFilter = val;
    V2.render();
  };

  V2.pharmaDownloadPdf = function (pid) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (!pharma) { V2.toast('Pharmacie introuvable', 'error'); return; }
    if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
    V2.toast('Génération du PDF…');
    var sales = pharmaSales(pid);
    var ca = V2.sumCA(sales), marge = margeMDLpharma(sales);
    var nbRefs = new Set(sales.map(function (s) { return String(s.artCode || ''); }).filter(function (c) { return c.length >= 7; })).size;
    var opps = buildOpportunities(pid);
    var totalOpp = opps.reduce(function (s, o) { return s + o.oppCount; }, 0);
    var today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    function esc(s) { return V2.esc(s); }

    // Si Will a coché des produits (bouton +) → le PDF ne contient QUE sa sélection.
    // Sinon → top marché par catégorie (15 max), comportement par défaut.
    var useSel = !!(selCips && selCips.size && String(selPid) === String(pid));
    var sections = opps.map(function (o) {
      var rows = useSel
        ? o.rows.filter(function (r) { return selCips.has(r.cip); })
        : o.rows.slice(0, 15);
      return { cat: o.cat, rows: rows, oppCount: useSel ? rows.length : o.oppCount, totalQte: o.totalQte };
    }).filter(function (o) { return o.rows.length; });

    var catSections = sections.map(function (o) {
      var rows = o.rows.map(function (r, i) {
        return '<tr>' +
          '<td style="padding:4px 6px;text-align:center;color:#9AA1B2;font-size:9px">' + (i + 1) + '</td>' +
          '<td style="padding:4px 6px;font-size:10px;font-weight:600;color:#10131C">' + esc((r.designation || '').slice(0, 52)) + '</td>' +
          '<td style="padding:4px 6px;font-family:monospace;font-size:9px;color:#737A8C">' + esc(r.cip) + '</td>' +
          '<td style="padding:4px 6px;text-align:right;font-family:monospace;font-size:10px;font-weight:700;color:#0050E6">' + (r.prix_ip ? r.prix_ip.toFixed(2) + ' €' : '—') + '</td>' +
          '<td style="padding:4px 6px;text-align:right;font-family:monospace;font-size:10px;font-weight:700;color:#1E9E6A">' + V2.fmtNum(r.marketQte) + '</td>' +
          '</tr>';
      }).join('');
      return '<div style="margin-bottom:13px;page-break-inside:avoid">' +
        '<div style="display:flex;align-items:center;gap:9px;padding:7px 11px;background:linear-gradient(90deg,' + o.cat.color + '22,transparent);border-left:4px solid ' + o.cat.color + ';border-radius:5px;margin-bottom:5px">' +
          '<div style="font-size:12px;font-weight:800;color:#10131C">' + esc(o.cat.label) + '</div>' +
          '<div style="font-size:9px;color:#737A8C;margin-left:auto;font-family:monospace">' + o.oppCount + ' opp · ' + V2.fmtNum(o.totalQte) + ' u marché</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse">' +
          '<thead><tr style="background:#F4F6FB">' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:center">#</th>' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:left">Produit</th>' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:left">CIP13</th>' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:right">Prix IP</th>' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:right">Vol marché</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }).join('');

    // ── Portrait : CA/mois + commandé par tranche ──
    var months = monthlyCA(sales);
    var maxM = months.reduce(function (m, x) { return Math.max(m, x.ca); }, 1);
    var monthBars = months.map(function (m) {
      var h = m.ca > 0 ? Math.max(6, Math.round(m.ca / maxM * 62)) : 0;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">' +
        '<div style="font-size:8px;font-weight:700;color:#2A2F3C;font-family:monospace">' + V2.fmtK(m.ca) + '</div>' +
        '<div style="width:100%;max-width:34px;height:62px;display:flex;align-items:flex-end;background:#EEF1F6;border-radius:5px 5px 2px 2px;overflow:hidden"><div style="width:100%;height:' + h + 'px;background:linear-gradient(180deg,#0050E6,#0034A0)"></div></div>' +
        '<div style="font-size:8px;color:#737A8C;font-weight:600">' + cap(MN_SHORT[m.month - 1]) + '</div>' +
      '</div>';
    }).join('');
    var oc = ownedByCat(sales);
    var trRows = CATS.map(function (c) { var b = oc.buckets[c.key]; return { c: c, refs: b.refs.size, ca: b.ca, mdl: b.mdl }; })
      .filter(function (r) { return r.refs > 0; }).sort(function (a, b) { return b.ca - a.ca; })
      .map(function (r) {
        return '<tr style="border-bottom:1px solid #F0F2F7">' +
          '<td style="padding:4px 7px;font-size:9.5px;font-weight:600;color:#10131C"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + r.c.color + ';margin-right:6px;vertical-align:middle"></span>' + esc(r.c.label) + '</td>' +
          '<td style="padding:4px 7px;text-align:right;font-size:9.5px;font-family:monospace">' + V2.fmtNum(r.refs) + '</td>' +
          '<td style="padding:4px 7px;text-align:right;font-size:9.5px;font-family:monospace;font-weight:700">' + V2.fmtEur(r.ca) + '</td>' +
          '<td style="padding:4px 7px;text-align:right;font-size:9.5px;font-family:monospace;color:#1E9E6A;font-weight:700">' + (r.mdl > 0 ? V2.fmtEur(r.mdl) : '—') + '</td>' +
        '</tr>';
      }).join('');
    var ident = [pharma.code, pharma.ville, pharma.tel].filter(function (x) { return x; }).map(esc).join('  ·  ');
    var pot = (pharma.potentiel != null && pharma.potentiel !== '') ? ('Potentiel ' + esc(String(pharma.potentiel))) : '';
    function kpiTile(l, v, col) {
      return '<div style="border:1px solid #E5E9F2;border-radius:9px;padding:9px 11px"><div style="font-size:8px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em;font-weight:700">' + l + '</div><div style="font-size:15px;font-weight:800;color:' + col + ';font-family:monospace">' + v + '</div></div>';
    }

    // Top 5 commandé par catégorie (en valeur) — cartes 2 colonnes
    var tops = ownedTopByCat(sales, 5);
    var topCards = tops.map(function (o) {
      var rws = o.rows.map(function (r, i) {
        return '<div style="display:flex;align-items:center;gap:7px;padding:3px 9px;border-top:1px solid #F4F6FB">' +
          '<span style="font-size:8px;color:#9AA1B2;font-family:monospace;width:10px">' + (i + 1) + '</span>' +
          '<span style="flex:1;font-size:9.5px;font-weight:600;color:#10131C;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc((r.designation || '').slice(0, 34)) + '</span>' +
          '<span style="font-size:9px;font-family:monospace;font-weight:700;color:#10131C">' + V2.fmtEur(r.ca) + '</span></div>';
      }).join('');
      return '<div style="border:1px solid #E5E9F2;border-radius:9px;overflow:hidden;page-break-inside:avoid">' +
        '<div style="display:flex;align-items:center;gap:7px;padding:6px 9px;background:linear-gradient(90deg,' + o.cat.color + '18,transparent)">' +
          '<span style="width:7px;height:7px;border-radius:50%;background:' + o.cat.color + '"></span>' +
          '<span style="font-size:10px;font-weight:800;color:#10131C;flex:1">' + esc(o.cat.label) + '</span>' +
          '<span style="font-size:8px;color:#737A8C;font-family:monospace">' + V2.fmtNum(o.total) + ' réf.</span></div>' +
        rws + '</div>';
    }).join('');
    var topCatBlock = tops.length
      ? '<h2 style="font-size:14px;font-weight:800;margin:0 0 10px;border-bottom:1px solid #E5E9F2;padding-bottom:5px">Top 5 commandé · par catégorie (en valeur)</h2>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:18px">' + topCards + '</div>'
      : '';

    var html =
      '<div style="padding:18px 22px;font-family:Satoshi,Inter,system-ui,sans-serif;color:#10131C">' +
        // En-tête identité
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:13px;border-bottom:2px solid #10131C;margin-bottom:16px">' +
          '<div style="display:flex;align-items:center;gap:13px">' +
            '<div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(150deg,#0050E6,#0034A0);position:relative;flex-shrink:0"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div></div>' +
            '<div><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.1em;font-weight:800">Préparation rendez-vous · Intégral Pharma</div>' +
              '<div style="font-size:21px;font-weight:800;letter-spacing:-.02em;line-height:1.1">' + esc(pharma.name) + '</div>' +
              (ident ? '<div style="font-size:10.5px;color:#737A8C;margin-top:3px">' + ident + '</div>' : '') + '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0">' +
            (pharma.groupement ? '<div style="display:inline-block;font-size:9px;font-weight:800;color:#0050E6;background:#EAF0FF;border-radius:6px;padding:3px 8px">' + esc(pharma.groupement) + '</div>' : '') +
            (pot ? '<div style="font-size:10px;color:#737A8C;margin-top:5px;font-weight:700">' + pot + '</div>' : '') +
            '<div style="font-size:10px;color:#9AA1B2;margin-top:5px;font-family:monospace">' + today + '</div>' +
          '</div>' +
        '</div>' +
        // KPI
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:16px">' +
          kpiTile('CA cumulé (5 mois)', V2.fmtEur(ca), '#0050E6') +
          kpiTile('Marge MDL', V2.fmtEur(marge), '#1E9E6A') +
          kpiTile('Références', V2.fmtNum(nbRefs), '#6D4FC4') +
          kpiTile('Opportunités', V2.fmtNum(totalOpp), '#C7791A') +
        '</div>' +
        // Portrait 2 colonnes
        '<div style="display:grid;grid-template-columns:1fr 1.15fr;gap:12px;margin-bottom:18px;page-break-inside:avoid">' +
          '<div style="border:1px solid #E5E9F2;border-radius:11px;padding:12px 14px">' +
            '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;margin-bottom:10px">CA par mois</div>' +
            '<div style="display:flex;align-items:flex-end;gap:7px">' + (monthBars || '<div style="font-size:10px;color:#9AA1B2">—</div>') + '</div>' +
          '</div>' +
          '<div style="border:1px solid #E5E9F2;border-radius:11px;padding:12px 14px">' +
            '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;margin-bottom:8px">Ce qu\'elle commande · par tranche</div>' +
            (trRows ? '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
              '<th style="text-align:left;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">Tranche</th>' +
              '<th style="text-align:right;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">Réfs</th>' +
              '<th style="text-align:right;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">CA</th>' +
              '<th style="text-align:right;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">MDL</th>' +
              '</tr></thead><tbody>' + trRows + '</tbody></table>' : '<div style="font-size:10px;color:#9AA1B2">Aucune commande identifiée.</div>') +
          '</div>' +
        '</div>' +
        // Top 5 commandé par catégorie
        topCatBlock +
        // Opportunités à présenter
        '<h2 style="font-size:14px;font-weight:800;margin:0 0 10px;border-bottom:1px solid #E5E9F2;padding-bottom:5px">' +
          (useSel ? 'À présenter · ' + selCips.size + ' produit' + (selCips.size > 1 ? 's' : '') + ' retenus'
                  : 'Opportunités à présenter · top marché OPS + HP + CPR') + '</h2>' +
        catSections +
        // Notes
        '<div style="margin-top:16px;page-break-inside:avoid">' +
          '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;margin-bottom:7px">Notes du rendez-vous</div>' +
          '<div style="border:1px solid #E5E9F2;border-radius:10px;height:96px;background:repeating-linear-gradient(#fff,#fff 23px,#EEF1F6 23px,#EEF1F6 24px)"></div>' +
        '</div>' +
        // Footer
        '<div style="margin-top:14px;padding-top:8px;border-top:1px solid #E5E9F2;display:flex;justify-content:space-between;font-size:8px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">' +
          '<div>Intégral Pharma · Normandie · Document confidentiel</div><div>Marge MDL : 0,18€ &lt;4,33€ · 3,9% &lt;468€ · 19,50€ au-delà</div></div>' +
      '</div>';

    window.ensureHtml2Pdf().then(function () {
      return (document.fonts && document.fonts.ready) ? document.fonts.ready : null;
    }).then(function () {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff';
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
      var fn = 'Prepa-RDV-' + (pharma.name || 'pharma').replace(/[^A-Za-z0-9-]/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      window.html2pdf().from(wrap).set({
        filename: fn, margin: [10, 10, 12, 10], image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }).save().then(function () {
        document.body.removeChild(wrap); V2.toast('PDF téléchargé');
      }).catch(function (e) { console.error(e); document.body.removeChild(wrap); V2.toast('Erreur PDF', 'error'); });
    });
  };

  // ── Enregistrement dans le registry ────────────────────────────
  V2.pages.pharma = {
    render: function (root, param) {
      if (param) renderDetail(root, param);
      else renderList(root);
    }
  };

  // ── Styles spécifiques au pilier (injectés une fois) ───────────
  // Cohérents avec v2.css ; aucune classe .v2-* du design system n'est redéfinie.
  if (!document.getElementById('v2-pharma-style')) {
    var st = document.createElement('style');
    st.id = 'v2-pharma-style';
    st.textContent = [
      '.v2-pharma-pin{width:46px;height:46px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 3px 9px rgba(16,19,28,.18),0 1px 0 rgba(255,255,255,.25) inset}',
      '.v2-pharma-stats{display:grid;grid-template-columns:repeat(4,1fr)}',
      '@media(max-width:720px){.v2-pharma-stats{grid-template-columns:repeat(2,1fr)}}',
      '.v2-pharma-stat{padding:16px 22px;border-right:1px solid var(--line);border-top:1px solid var(--line)}',
      '.v2-pharma-stat:nth-child(-n+4){border-top:none}',
      '.v2-pharma-stat:nth-child(4n){border-right:none}',
      '@media(max-width:720px){.v2-pharma-stat:nth-child(2n){border-right:none}.v2-pharma-stat:nth-child(2){border-top:none}}',
      '.v2-pharma-stat-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}',
      '.v2-pharma-stat-v{font-size:22px;font-weight:700;letter-spacing:-.03em;margin-top:6px;color:var(--sc,var(--ip-ink))}',
      '.v2-cat{margin-bottom:13px;transition:box-shadow .2s var(--ease)}',
      '.v2-cat.open{box-shadow:var(--sh-3)}',
      '.v2-cat-head{display:flex;align-items:center;gap:14px;padding:15px 20px;cursor:pointer;user-select:none;transition:background .14s}',
      '.v2-cat-head:hover{background:var(--card-2)}',
      '.v2-cat-accent{width:5px;align-self:stretch;border-radius:3px;flex-shrink:0;min-height:34px}',
      '.v2-cat-titles{flex:1;min-width:0}',
      '.v2-cat-t{font-size:15px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}',
      '.v2-cat-sub{font-size:11.5px;font-weight:600;color:var(--muted);font-family:var(--mono)}',
      '.v2-cat-meta{font-size:11.5px;color:var(--muted);margin-top:3px}',
      '.v2-cat-chev{color:var(--muted-2);flex-shrink:0;transition:transform .25s var(--ease)}',
      '.v2-cat-chev.open{transform:rotate(90deg)}',
      '.v2-cat-table-wrap{overflow-x:auto;border-top:1px solid var(--line)}',
      '.v2-cat-prod{font-weight:600}',
      '.v2-cat-empty{padding:22px 20px;text-align:center;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}',
      // ── Activité officine : grille + chart mensuel + tranches ──
      '.ph-act-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:14px;margin-bottom:6px}',
      '@media(max-width:860px){.ph-act-grid{grid-template-columns:1fr}}',
      '.ph-mchart{display:flex;align-items:flex-end;gap:10px;height:150px}',
      '.ph-mbar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;min-width:0}',
      '.ph-mbar-v{font-size:10.5px;font-weight:700;color:var(--ip-ink-2)}',
      '.ph-mbar-track{flex:1;width:100%;max-width:42px;display:flex;align-items:flex-end;background:var(--line-2);border-radius:7px 7px 3px 3px;overflow:hidden}',
      '.ph-mbar-fill{display:block;width:100%;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,var(--c-fiche),var(--ip-blue-d));transition:height .6s var(--ease)}',
      '.ph-mbar-l{font-size:11px;color:var(--muted);font-weight:600}',
      '.ph-tr-cat{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13.5px}',
      '.ph-tr-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}',
      '.ph-tr-sub{font-size:11px;color:var(--muted);font-family:var(--mono);font-weight:500;margin-left:2px}',
      '.ph-tr-bar{height:4px;border-radius:999px;background:var(--line);overflow:hidden;margin-top:6px}',
      '.ph-tr-bar span{display:block;height:100%;border-radius:999px}',
      // ── Top 5 par catégorie ──
      '.ph-top-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}',
      '.ph-top-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);overflow:hidden}',
      '.ph-top-head{display:flex;align-items:center;gap:9px;padding:12px 15px;border-bottom:1px solid var(--line)}',
      '.ph-top-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}',
      '.ph-top-t{font-weight:800;font-size:13.5px;letter-spacing:-.01em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ph-top-n{font-size:11px;color:var(--muted);flex-shrink:0}',
      '.ph-top-row{display:flex;align-items:center;gap:10px;padding:8px 15px;border-bottom:1px solid var(--line-2)}',
      '.ph-top-row:last-child{border-bottom:none}',
      '.ph-top-rank{font-size:11px;color:var(--muted-2);width:14px;flex-shrink:0;text-align:right}',
      '.ph-top-name{flex:1;min-width:0;font-size:12.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ph-top-val{font-size:12px;font-weight:700;color:var(--ip-ink-2);flex-shrink:0}',
      '.ph-top-q{color:var(--muted);font-weight:500}',
      // Badge "opportunités" dans la liste des officines
      '.v2-row-opp{flex-shrink:0;font-size:11.5px;font-weight:700;color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 12%,transparent);border:1px solid color-mix(in srgb,var(--c-opp) 26%,transparent);border-radius:999px;padding:3px 10px;letter-spacing:-.01em}',
      '.v2-row-opp-pending{color:var(--muted-2);background:var(--card-2);border-color:var(--line);font-weight:600}',
      // Bouton + de sélection produit (devient ✓ vert une fois coché)
      '.opp-add{width:28px;height:28px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s var(--ease);flex-shrink:0}',
      '.opp-add:hover{border-color:var(--c-opp);color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 8%,transparent)}',
      '.opp-add.on{background:var(--c-opp);border-color:var(--c-opp);color:#fff;box-shadow:0 2px 6px color-mix(in srgb,var(--c-opp) 40%,transparent)}',
      '.opp-add.on:hover{background:var(--c-opp);color:#fff}',
      // ── Badges OPSO (clientes / prospects) — uniquement en mode OPSO ──
      '.opso-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.01em;flex-shrink:0;vertical-align:middle}',
      '.opso-badge-cliente{color:#0d8530;background:color-mix(in srgb,#11a63c 13%,transparent);border:1px solid color-mix(in srgb,#11a63c 28%,transparent)}',
      '.opso-badge-prospect{color:var(--muted);background:var(--card-2);border:1px solid var(--line)}',
      // Ligne cliente légèrement mise en relief
      '.opso-row-cliente{background:color-mix(in srgb,#11a63c 4%,transparent)}',
      '.opso-row-cliente:hover{background:color-mix(in srgb,#11a63c 8%,transparent)}',
      // ── Compteur clientes / prospects (bandeau au-dessus des filtres) ──
      '.opso-counter{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:13px;font-weight:600;color:var(--muted)}',
      '.opso-counter-sep{color:var(--muted-2)}',
      '.opso-counter-cliente{color:#0d8530;font-weight:700}',
      '.opso-counter-prospect{color:var(--muted);font-weight:600}'
    ].join('\n');
    document.head.appendChild(st);
  }
})();
