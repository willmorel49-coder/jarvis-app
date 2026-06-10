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

  // ── State local module (toggle cartes catégories + recherche) ──
  // collapsed[catKey] === true → carte repliée. Par défaut : 1ère ouverte.
  var collapsed = {};
  var searchQuery = '';
  // Sélection de produits cochés (bouton +) pour le PDF RDV — propre à une pharma
  var selCips = null;   // Set des CIP cochés
  var selPid = null;    // pharma à laquelle appartient la sélection courante

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
  // VUE A — Liste des officines
  // ─────────────────────────────────────────────────────────────
  function listRowHtml(x) {
    var color = x.p.color || 'var(--ip-blue)';
    var oppPill = (x.opp == null)
      ? '<span class="v2-row-opp v2-row-opp-pending mono">…</span>'
      : '<span class="v2-row-opp mono">' + V2.fmtNum(x.opp) + ' opp</span>';
    return '<a class="v2-row" onclick="V2.go(\'pharma\',\'' + V2.esc(String(x.p.id)) + '\')">' +
      '<span class="v2-row-dot" style="background:' + V2.esc(color) + '"></span>' +
      '<span class="v2-row-name">' + V2.esc(x.p.name) + '</span>' +
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
    }).sort(function (a, b) { return b.ca - a.ca; });

    // Marché sectoriel pas encore chargé → on charge en tâche de fond puis on
    // rafraîchit la liste pour afficher le compteur d'opportunités par officine.
    if (!marketReady) {
      V2.loadFiles(['establishments']).then(function () {
        _marketCache = null;
        if (V2.route && V2.route.name === 'pharma' && !V2.route.param) V2.render();
      });
    }

    function filterList() {
      var q = searchQuery.trim().toLowerCase();
      return q ? phs.filter(function (x) { return x.p.name.toLowerCase().indexOf(q) >= 0; }) : phs;
    }

    var filtered = filterList();
    var rowsHtml = filtered.length
      ? filtered.map(listRowHtml).join('')
      : '<div class="v2-empty"><div class="v2-empty-t">Aucune officine</div><div class="v2-empty-d">' +
        (searchQuery ? 'Aucun résultat pour « ' + V2.esc(searchQuery) + ' ».' : 'Aucune pharmacie chargée.') +
        '</div></div>';

    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-title">Mes officines</div>' +
        '<div class="v2-page-sub">' + phs.length + ' pharmacie' + (phs.length > 1 ? 's' : '') +
          ' · clique pour voir les opportunités</div>' +
        '<div class="v2-search" style="margin-bottom:20px;padding:14px 18px">' + ICO('search', 20, 2) +
          '<input id="v2-pharma-search" placeholder="Rechercher une officine…" autocomplete="off" value="' +
          V2.esc(searchQuery) + '"></div>' +
        '<div class="v2-card" id="v2-pharma-card">' + rowsHtml + '</div>' +
      '</div>';

    // Recherche live : on ne re-render QUE la liste pour préserver le focus
    var inp = document.getElementById('v2-pharma-search');
    if (inp) {
      inp.addEventListener('input', function () {
        searchQuery = inp.value;
        var card = document.getElementById('v2-pharma-card');
        if (!card) return;
        var f = filterList();
        card.innerHTML = f.length
          ? f.map(listRowHtml).join('')
          : '<div class="v2-empty"><div class="v2-empty-t">Aucun résultat</div></div>';
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

  function renderDetail(root, pid) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (!pharma) { renderList(root); return; }

    // Agrégats marché chargés ? sinon lazy-load + état loading
    if (!window.OPS_AGGREGATE) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du marché sectoriel…</div></div>';
      V2.loadFiles(['establishments']).then(function () { _marketCache = null; V2.render(); });
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

    var hero =
      '<div class="v2-card" style="margin-bottom:22px;padding:0">' +
        '<div style="display:flex;align-items:center;gap:14px;padding:20px 22px;border-bottom:1px solid var(--line);flex-wrap:wrap">' +
          '<span class="v2-pharma-pin" style="background:' + V2.esc(pharma.color || 'var(--ip-blue)') + '">' +
            ICO('pharma', 22) + '</span>' +
          '<div style="flex:1;min-width:160px">' +
            '<div style="font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.1">' + V2.esc(pharma.name) + '</div>' +
            (pharma.code ? '<div style="font-size:12px;color:var(--muted);margin-top:3px;font-family:var(--mono)">' + V2.esc(pharma.code) + '</div>' : '') +
          '</div>' +
          '<button id="v2-opp-pdf" class="v2-btn v2-btn-primary" onclick="V2.pharmaDownloadPdf(\'' + V2.esc(String(pid)) + '\')">' +
            ICO('download', 17) + (selCips && selCips.size
              ? 'PDF RDV · ' + selCips.size + ' produit' + (selCips.size > 1 ? 's' : '')
              : 'Télécharger le PDF RDV') + '</button>' +
        '</div>' +
        '<div class="v2-pharma-stats">' +
          stat('CA du mois', V2.fmtEur(ca), 'var(--c-fiche)') +
          stat('Marge MDL générée', V2.fmtEur(marge), 'var(--c-opp)') +
          stat('Références commandées', V2.fmtNum(nbRefs), 'var(--c-cat)') +
          stat('Opportunités détectées', V2.fmtNum(totalOpp), 'var(--c-amber)') +
        '</div>' +
      '</div>';

    var catsHtml = opps.map(renderCatCard).join('');

    root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
      '<div class="v2-wrap">' +
        hero +
        '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:16px;flex-wrap:wrap">' +
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
      ? 'PDF RDV · ' + n + ' produit' + (n > 1 ? 's' : '')
      : 'Télécharger le PDF RDV');
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
      V2.toast('✓ Retenu — ajouté à la fiche en cours');
    }
    refreshPdfBtn();
  };

  V2.pharmaToggleCat = function (key) {
    var idx = -1;
    for (var i = 0; i < CATS.length; i++) { if (CATS[i].key === key) { idx = i; break; } }
    var cur = (key in collapsed) ? collapsed[key] : (idx !== 0);
    collapsed[key] = !cur;
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

    var html =
      '<div style="padding:16px 20px;font-family:Inter,system-ui,sans-serif;color:#10131C">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #0050E6;padding-bottom:11px;margin-bottom:15px">' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<div style="width:42px;height:42px;border-radius:11px;background:linear-gradient(150deg,#0050E6,#0034A0);position:relative">' +
              '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div></div>' +
            '<div><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Intégral Pharma · Opportunités</div>' +
              '<div style="font-size:18px;font-weight:800;color:#10131C">' + esc(pharma.name) + '</div>' +
              (pharma.code ? '<div style="font-size:10px;color:#737A8C;font-family:monospace">' + esc(pharma.code) + '</div>' : '') + '</div>' +
          '</div>' +
          '<div style="text-align:right"><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Édité le</div>' +
            '<div style="font-size:12px;font-weight:700;font-family:monospace">' + today + '</div></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:18px">' +
          '<div style="border:1px solid #E5E9F2;border-radius:8px;padding:9px 11px"><div style="font-size:8px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em;font-weight:700">CA du mois</div><div style="font-size:16px;font-weight:800;color:#0050E6;font-family:monospace">' + V2.fmtEur(ca) + '</div></div>' +
          '<div style="border:1px solid #E5E9F2;border-radius:8px;padding:9px 11px"><div style="font-size:8px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Marge MDL</div><div style="font-size:16px;font-weight:800;color:#1E9E6A;font-family:monospace">' + V2.fmtEur(marge) + '</div></div>' +
          '<div style="border:1px solid #E5E9F2;border-radius:8px;padding:9px 11px"><div style="font-size:8px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Références</div><div style="font-size:16px;font-weight:800;color:#6D4FC4;font-family:monospace">' + V2.fmtNum(nbRefs) + '</div></div>' +
          '<div style="border:1px solid #E5E9F2;border-radius:8px;padding:9px 11px"><div style="font-size:8px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Opportunités</div><div style="font-size:16px;font-weight:800;color:#C7791A;font-family:monospace">' + V2.fmtNum(totalOpp) + '</div></div>' +
        '</div>' +
        '<h2 style="font-size:14px;font-weight:800;margin:0 0 10px;border-bottom:1px solid #E5E9F2;padding-bottom:5px">' +
          (useSel ? 'Sélection RDV · ' + selCips.size + ' produit' + (selCips.size > 1 ? 's' : '') + ' retenus'
                  : 'Opportunités par catégorie · top marché OPS + HP + CPR') + '</h2>' +
        catSections +
        '<div style="margin-top:16px;padding-top:8px;border-top:1px solid #E5E9F2;display:flex;justify-content:space-between;font-size:8px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">' +
          '<div>Intégral Pharma · Normandie · Document confidentiel</div><div>Marge MDL : 0,18€ &lt;4,33€ · 3,9% &lt;468€ · 19,50€ au-delà</div></div>' +
      '</div>';

    window.ensureHtml2Pdf().then(function () {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff';
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
      var fn = 'Opportunites-' + (pharma.name || 'pharma').replace(/[^A-Za-z0-9-]/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      window.html2pdf().from(wrap).set({
        filename: fn, margin: [10, 10, 12, 10], image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }).save().then(function () {
        document.body.removeChild(wrap); V2.toast('✓ PDF téléchargé');
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
      // Badge "opportunités" dans la liste des officines
      '.v2-row-opp{flex-shrink:0;font-size:11.5px;font-weight:700;color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 12%,transparent);border:1px solid color-mix(in srgb,var(--c-opp) 26%,transparent);border-radius:999px;padding:3px 10px;letter-spacing:-.01em}',
      '.v2-row-opp-pending{color:var(--muted-2);background:var(--card-2);border-color:var(--line);font-weight:600}',
      // Bouton + de sélection produit (devient ✓ vert une fois coché)
      '.opp-add{width:28px;height:28px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s var(--ease);flex-shrink:0}',
      '.opp-add:hover{border-color:var(--c-opp);color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 8%,transparent)}',
      '.opp-add.on{background:var(--c-opp);border-color:var(--c-opp);color:#fff;box-shadow:0 2px 6px color-mix(in srgb,var(--c-opp) 40%,transparent)}',
      '.opp-add.on:hover{background:var(--c-opp);color:#fff}'
    ].join('\n');
    document.head.appendChild(st);
  }
})();
