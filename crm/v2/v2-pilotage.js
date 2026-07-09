/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier 4 — PILOTAGE (tableau de bord commercial)
   À partir de V2.sales : CA net HT, marge MDL, familles, top pharma.
   Graphes en CSS/SVG pur — aucune dépendance externe. Zéro emoji.
   Mode OPSO : section groupement (taux activation, périmètres, top produits).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2; if (!V2) return;
  V2.pages = V2.pages || {};

  // ── State période (local module) ──────────────
  var PERIOD = 'current';            // 'current' | '3m' | 'year'

  // ── Couleurs familles → tokens de séries (spec signature) ─────
  // froid->cyan · biosim->violet cat · nr->ambre · princeps->bleu fiche · génériques->muted
  var FAM = [
    { key: 'froid',      label: 'Froid',         color: 'var(--c-froid)' },
    { key: 'generiques', label: 'Génériques',    color: 'var(--muted)' },
    { key: 'biosim',     label: 'Biosimilaires', color: 'var(--c-cat)' },
    { key: 'nr',         label: 'NR',            color: 'var(--c-amber)' },
    { key: 'princeps',   label: 'Princeps',      color: 'var(--c-fiche)' },
  ];

  // ── Tranches de prix (prix net grossiste / achat unitaire) ────
  // petits->ok · intermédiaires->info · chers->ambre · très chers->bad-d (critique)
  var TIERS = [
    { label: '0 – 4,33 €',     sub: 'petits prix',     color: 'var(--ok)' },
    { label: '4,33 – 468 €',   sub: 'intermédiaires',  color: 'var(--info)' },
    { label: '468 – 2 000 €',  sub: 'chers',           color: 'var(--c-amber)' },
    { label: '> 2 000 €',      sub: 'très chers',      color: 'var(--bad-d)' },
  ];
  function priceTier(pu) {
    pu = +pu || 0;
    if (pu < 4.33) return 0;
    if (pu < 468) return 1;
    if (pu < 2000) return 2;
    return 3;
  }

  // ── Index produit cip13 → {has_ameli, is_froid, artnature, isNR} ──
  var _idx = null, _idxStamp = null;
  function normCip(c) { return String(c == null ? '' : c).replace(/\D/g, ''); }
  function productIndex() {
    var B = window.BENCHMARK || [];
    var S = window.SAGITTA_SHORTLIST || [];
    var stamp = B.length + 'x' + S.length;
    if (_idx && _idxStamp === stamp) return _idx;
    var m = {};
    B.forEach(function (b) {
      var c = normCip(b.cip13); if (!c) return;
      m[c] = {
        has_ameli: !!b.has_ameli,
        is_froid: !!b.is_froid,
        artnature: b.artnature || '',
      };
    });
    // SAGITTA = short list NR (non remboursable) : marque isNR=true
    S.forEach(function (s) {
      var c = normCip(s.cip13); if (!c) return;
      if (!m[c]) m[c] = { has_ameli: false, is_froid: false, artnature: '' };
      m[c].isNR = true;
    });
    _idx = m; _idxStamp = stamp; return m;
  }

  // famille d'une vente (priorité : froid > biosim > génériques > NR > princeps)
  function familyOf(sale, idx) {
    var info = idx[normCip(sale.artCode)] || null;
    if (info) {
      if (info.is_froid) return 'froid';
      if (info.artnature === 'biosimilaire') return 'biosim';
      if (info.artnature === 'generique' || info.artnature === 'generique_partenaire') return 'generiques';
      if (info.isNR) return 'nr';
    }
    // fallback sur artFamille texte des ventes
    var f = (sale.artFamille || '').toLowerCase();
    if (f) {
      if (/froid|frigo|réfri|refri/.test(f)) return 'froid';
      if (/biosim/.test(f)) return 'biosim';
      if (/génér|gener|\bgx\b/.test(f)) return 'generiques';
      if (/\bnr\b|non.?rembours/.test(f)) return 'nr';
    }
    return 'princeps';
  }

  // remboursable = has_ameli ET pas NR Sagitta
  function isRemboursable(sale, idx) {
    var info = idx[normCip(sale.artCode)];
    if (!info) return false;
    return info.has_ameli && !info.isNR;
  }

  // marge MDL d'une ligne de vente (0 si non remboursable)
  function mdlOf(sale, idx) {
    if (!isRemboursable(sale, idx)) return 0;
    return V2.margeMDLboite(sale.puNet) * (sale.qte || 0);
  }

  // ── Périodes ──────────────────────────────────
  // clé mois absolue (pour tri/comparaison)
  function mkey(year, month) { return year * 12 + (month - 1); }

  // détecte la liste des (year,month) présents, triés croissant
  function availableMonths(sales) {
    var seen = {};
    sales.forEach(function (s) {
      if (s.month && s.year) seen[mkey(s.year, s.month)] = { year: s.year, month: s.month };
    });
    return Object.keys(seen).map(function (k) { return seen[k]; })
      .sort(function (a, b) { return mkey(a.year, a.month) - mkey(b.year, b.month); });
  }

  // renvoie {label, prevLabel, inPeriod(sale), inPrev(sale)}
  function periodFilter(sales, mode) {
    var months = availableMonths(sales);
    if (!months.length) return null;
    var last = months[months.length - 1];
    var lastK = mkey(last.year, last.month);
    var MN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

    if (mode === 'current') {
      return {
        label: cap(MN[last.month - 1]) + ' ' + last.year,
        prevLabel: 'mois précédent',
        inPeriod: function (s) { return mkey(s.year, s.month) === lastK; },
        inPrev: function (s) { return mkey(s.year, s.month) === lastK - 1; },
      };
    }
    if (mode === '3m') {
      var startK = lastK - 2, pStart = lastK - 5, pEnd = lastK - 3;
      return {
        label: '3 derniers mois',
        prevLabel: '3 mois précédents',
        inPeriod: function (s) { var k = mkey(s.year, s.month); return k >= startK && k <= lastK; },
        inPrev: function (s) { var k = mkey(s.year, s.month); return k >= pStart && k <= pEnd; },
      };
    }
    // year = année du mois courant
    var y = last.year;
    return {
      label: 'Année ' + y,
      prevLabel: 'année ' + (y - 1),
      inPeriod: function (s) { return s.year === y; },
      inPrev: function (s) { return s.year === y - 1; },
    };
  }

  // ── helpers ───────────────────────────────────
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  var esc = V2.esc || function (s) { return String(s == null ? '' : s); };

  function pharmaName(id) {
    var p = (V2.pharmacies || []).filter(function (x) { return x.id === id; })[0];
    return p ? p.name : 'Pharmacie ' + id;
  }
  function pharmaColor(id, fallback) {
    var p = (V2.pharmacies || []).filter(function (x) { return x.id === id; })[0];
    return (p && p.color) || fallback;
  }

  function deltaHtml(cur, prev, prevLabel) {
    if (!isFinite(prev) || prev === 0) {
      if (cur > 0) return '<div class="v2-kpi-d up">Nouvelle période</div>';
      return '<div class="v2-kpi-d" style="color:var(--muted)">—</div>';
    }
    var d = (cur - prev) / Math.abs(prev) * 100;
    var up = d >= 0;
    var arrow = up ? '▲' : '▼';
    return '<div class="v2-kpi-d ' + (up ? 'up' : 'dn') + '">' + arrow + ' ' +
      (up ? '+' : '') + d.toFixed(1).replace('.', ',') + ' % vs ' + esc(prevLabel || 'préc.') + '</div>';
  }

  // ── Détection mode OPSO ───────────────────────
  function isOpso() {
    return !!(window.V2_BRAND && window.V2_BRAND.opso);
  }

  // ── Mini sparkline SVG (tendance sur N points) ──────────────
  // Ligne + aire douce, dernier point marqué. Couleur passée en paramètre.
  function sparkline(vals, color, w, h) {
    w = w || 132; h = h || 34;
    var n = vals.length;
    if (n < 2) return '';
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    var span = (max - min) || 1;
    var pad = 3;
    var iw = w - pad * 2, ih = h - pad * 2;
    var pts = vals.map(function (v, i) {
      var x = pad + (n === 1 ? 0 : i / (n - 1) * iw);
      var y = pad + ih - ((v - min) / span) * ih;
      return [x, y];
    });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = line + ' L' + pts[n - 1][0].toFixed(1) + ' ' + (h - pad) + ' L' + pts[0][0].toFixed(1) + ' ' + (h - pad) + ' Z';
    var last = pts[n - 1];
    var gid = 'spk' + Math.random().toString(36).slice(2, 7);
    return '<svg class="pilo-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + color + '" stop-opacity=".22"/>' +
        '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path class="pilo-spark-line" d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.6" fill="' + color + '"/>' +
    '</svg>';
  }

  // Série CA mensuelle (N derniers mois présents), pour sparklines KPI
  function monthlyCaSeries(sales, n) {
    var months = availableMonths(sales);
    if (!months.length) return [];
    var last = months[months.length - 1], lastK = mkey(last.year, last.month);
    var byK = {};
    sales.forEach(function (s) { if (s.month && s.year) { var k = mkey(s.year, s.month); byK[k] = (byK[k] || 0) + (s.mntNetHt || 0); } });
    var out = [];
    for (var i = n - 1; i >= 0; i--) out.push(byK[lastK - i] || 0);
    return out;
  }

  // ── Top produits par CA (période courante) ────
  // Agrège par artDesignation (label produit), renvoie top N
  function buildTopProducts(salesArr, n) {
    var byProd = {};
    salesArr.forEach(function (s) {
      var key = (s.artDesignation || s.artCode || 'Inconnu').trim();
      if (!byProd[key]) byProd[key] = { label: key, ca: 0, qte: 0 };
      byProd[key].ca += (s.mntNetHt || 0);
      byProd[key].qte += (s.qte || 0);
    });
    return Object.keys(byProd).map(function (k) { return byProd[k]; })
      .sort(function (a, b) { return b.ca - a.ca; })
      .slice(0, n || 10);
  }

  // ════════════════════════════════════════════
  // SECTION OPSO — groupement
  // ════════════════════════════════════════════
  function buildOpsoSection(salesCur, salesPrev, pf) {
    var pharmacies = V2.pharmacies || [];
    var total = pharmacies.length;

    // Taux d'activation : officines inDb (commandent déjà)
    var clientes = pharmacies.filter(function (p) { return p.inDb; }).length;
    var prospects = total - clientes;
    var tauxPct = total > 0 ? (clientes / total * 100) : 0;

    // CA groupement (période)
    var caGrp = V2.sumCA(salesCur);
    var caGrpPrev = V2.sumCA(salesPrev);

    // Officines avec CA > 0 sur la période
    var caByPh = {};
    salesCur.forEach(function (s) {
      caByPh[s.pharmacyId] = (caByPh[s.pharmacyId] || 0) + (s.mntNetHt || 0);
    });
    var nbActif = Object.keys(caByPh).filter(function (id) { return caByPh[id] > 0; }).length;

    // Répartition par périmètre (NP / BP / OPSO / autre)
    var perims = {};
    pharmacies.forEach(function (p) {
      var per = (p.perimetre || '').trim() || 'Autre';
      if (!perims[per]) perims[per] = { label: per, total: 0, actives: 0, ca: 0 };
      perims[per].total++;
      if (p.inDb) perims[per].actives++;
    });
    // rattacher le CA par périmètre
    salesCur.forEach(function (s) {
      var ph = pharmacies.filter(function (x) { return x.id === s.pharmacyId; })[0];
      if (!ph) return;
      var per = (ph.perimetre || '').trim() || 'Autre';
      if (perims[per]) perims[per].ca += (s.mntNetHt || 0);
    });
    var perimList = Object.keys(perims).map(function (k) { return perims[k]; })
      .sort(function (a, b) { return b.ca - a.ca; });

    // Couleurs périmètre — tokens de séries (sépare les périmètres sans clinquant)
    var PERIM_COLORS = { 'NP': 'var(--c-fiche)', 'BP': 'var(--c-cat)', 'OPSO': 'var(--c-amber)' };
    function perimColor(lbl) { return PERIM_COLORS[lbl] || 'var(--muted-2)'; }

    // Top 8 produits groupement
    var topProds = buildTopProducts(salesCur, 8);
    var maxProd = topProds.length ? topProds[0].ca : 1;

    // ── HTML ───────────────────────────────────

    // KPI taux d'activation
    var tauxBar = Math.round(tauxPct);
    var kpiActivation =
      '<div class="v2-card opso-act-card" style="margin-bottom:14px;padding:20px 22px">' +
        '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('pharma', 17) + 'Taux d\'activation groupement</div>' +
        '<div class="opso-act-body">' +
          '<div class="opso-act-gauge">' +
            '<div class="opso-gauge-track">' +
              '<div class="opso-gauge-fill" data-w="' + tauxBar + '" style="width:0"></div>' +
            '</div>' +
            '<div class="opso-gauge-labels">' +
              '<span class="mono" style="font-size:13px;font-weight:700;color:' + V2.tint(tauxBar, 30, 60) + '">' + tauxBar + ' %</span>' +
              '<span style="font-size:12px;color:var(--muted)">' + total + ' officines au listing</span>' +
            '</div>' +
          '</div>' +
          '<div class="opso-act-chips">' +
            '<div class="opso-chip-stat active">' +
              '<div class="opso-chip-n mono">' + clientes + '</div>' +
              '<div class="opso-chip-l">Clientes</div>' +
            '</div>' +
            '<div class="opso-chip-stat prospect">' +
              '<div class="opso-chip-n mono">' + prospects + '</div>' +
              '<div class="opso-chip-l">Prospects</div>' +
            '</div>' +
            '<div class="opso-chip-stat actif">' +
              '<div class="opso-chip-n mono">' + nbActif + '</div>' +
              '<div class="opso-chip-l">Actives / période</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // KPIs groupement CA
    var kpiGrp =
      '<div class="v2-kpis opso-kpi-grp" style="margin-bottom:14px">' +
        '<div class="v2-kpi k1">' +
          '<div class="v2-kpi-l">CA groupement</div>' +
          '<div class="v2-kpi-v mono">' + V2.fmtEur(caGrp) + '</div>' +
          deltaHtml(caGrp, caGrpPrev, pf && pf.prevLabel) +
        '</div>' +
        '<div class="v2-kpi k4">' +
          '<div class="v2-kpi-l">Panier moyen clientes actives</div>' +
          '<div class="v2-kpi-v mono">' + V2.fmtEur(nbActif > 0 ? caGrp / nbActif : 0) + '</div>' +
          '<div class="v2-kpi-d" style="color:var(--muted)">par officine active</div>' +
        '</div>' +
      '</div>';

    // Répartition périmètre
    var hasPerim = perimList.length > 0 && perimList.some(function (p) { return p.label !== 'Autre'; });
    var perimCard = '';
    if (hasPerim) {
      var maxPerimTotal = perimList.reduce(function (a, p) { return Math.max(a, p.total); }, 1);
      var perimRows = perimList.map(function (p) {
        var actPct = p.total > 0 ? Math.round(p.actives / p.total * 100) : 0;
        var barW = Math.max(2, p.total / maxPerimTotal * 100);
        var col = perimColor(p.label);
        return '<div class="opso-perim-row">' +
          '<div class="opso-perim-top">' +
            '<span class="opso-perim-badge" style="background:color-mix(in srgb,' + col + ' 14%,#fff);color:' + col + '">' + esc(p.label) + '</span>' +
            '<div class="opso-perim-nums">' +
              '<span class="mono" style="font-weight:700;font-size:13.5px">' + p.actives + '<span style="color:var(--muted);font-weight:500">/' + p.total + '</span></span>' +
              '<span class="v2-chip ' + (actPct >= 50 ? 'g' : 'a') + '" style="margin-left:8px">' + actPct + ' %</span>' +
              (p.ca > 0 ? '<span class="mono" style="font-size:12px;color:var(--muted);margin-left:12px">' + V2.fmtEur(p.ca) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="pilo-bar" style="margin-top:8px"><span class="pilo-bar-fill" data-w="' + barW.toFixed(1) + '" style="width:0;background:' + col + '"></span></div>' +
        '</div>';
      }).join('');
      perimCard =
        '<div class="v2-card" style="padding:18px 22px;margin-bottom:14px">' +
          '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('grid', 17) + 'Répartition par périmètre</div>' +
          perimRows +
        '</div>';
    }

    // Top produits groupement
    var topProdHtml = topProds.length ?
      topProds.map(function (r, i) {
        var pct = maxProd > 0 ? Math.max(2, r.ca / maxProd * 100) : 0;
        return '<div class="v2-row" style="cursor:default">' +
          '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="v2-row-name">' + esc(r.label) + '</div>' +
            '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:var(--ip-blue)"></span></div>' +
          '</div>' +
          '<div class="pilo-vals">' +
            '<div class="v2-row-val mono">' + V2.fmtEur(r.ca) + '</div>' +
            '<div class="v2-row-meta mono">' + V2.fmtNum(r.qte) + ' unités</div>' +
          '</div>' +
        '</div>';
      }).join('')
      : '<div class="v2-empty"><div class="v2-empty-d">Aucune vente sur la période.</div></div>';

    var topProdCard =
      '<div class="v2-card" style="margin-bottom:14px">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pilo', 17) + 'Top produits groupement</div>' +
          '<span class="v2-card-link" style="color:var(--muted);cursor:default">' + (pf ? esc(pf.label) : '') + '</span></div>' +
        topProdHtml +
      '</div>';

    // ── Détail par officine cliente (classé par CA sur la période) ──
    var refsByPh = {};
    salesCur.forEach(function (s) {
      var k = String(s.artCode || s.artDesignation || '');
      (refsByPh[s.pharmacyId] = refsByPh[s.pharmacyId] || {})[k] = 1;
    });
    var officines = pharmacies.filter(function (p) { return p.inDb; })
      .map(function (p) {
        return { p: p, ca: caByPh[p.id] || 0, refs: refsByPh[p.id] ? Object.keys(refsByPh[p.id]).length : 0 };
      })
      .sort(function (a, b) { return b.ca - a.ca; });
    var maxOffCa = officines.length ? Math.max(officines[0].ca, 1) : 1;
    var SHOWN = 20;
    var offRows = officines.slice(0, SHOWN).map(function (o) {
      var col = perimColor((o.p.perimetre || '').trim());
      var w = Math.max(2, o.ca / maxOffCa * 100);
      var goId = o.p.id;
      return '<div class="v2-row" onclick="V2.go(\'pharma\',\'' + goId + '\')" style="cursor:pointer">' +
        '<span class="opso-perim-badge" style="background:color-mix(in srgb,' + col + ' 14%,#fff);color:' + col + ';flex-shrink:0">' + esc((o.p.perimetre || '–').trim() || '–') + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="v2-row-name">' + esc(o.p.name) + (o.p.hasStats ? ' <span class="opso-new-tag">nouv.</span>' : '') + '</div>' +
          '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + w.toFixed(1) + '" style="width:0;background:' + col + '"></span></div>' +
        '</div>' +
        '<div class="pilo-vals">' +
          '<div class="v2-row-val mono">' + V2.fmtEur(o.ca) + '</div>' +
          '<div class="v2-row-meta mono">' + o.refs + ' réf.' + (o.p.ville ? ' · ' + esc(o.p.ville) : '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    var officinesCard = officines.length ?
      '<div class="v2-card" style="margin-bottom:14px">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pharma', 17) + 'Officines clientes — détail</div>' +
          '<span class="v2-card-link" style="color:var(--muted);cursor:default">' + officines.length + ' clientes' +
          (officines.length > SHOWN ? ' · top ' + SHOWN : '') + '</span></div>' +
        offRows +
      '</div>' : '';

    return {
      html: '<div class="opso-section">' +
              '<div class="opso-section-head">' + ICO('pharma', 16) + 'Groupement OPSO Santé</div>' +
              kpiActivation +
              kpiGrp +
              (perimCard || '') +
              officinesCard +
              topProdCard +
            '</div>',
    };
  }

  // ════════════════════════════════════════════
  // Composants réutilisés par la fiche officine (homogénéisation stats + évolutions).
  V2.deltaHtml = deltaHtml;
  V2.build13MonthChart = build13MonthChart;
  V2.monthlyCaSeries = monthlyCaSeries;
  V2.miniSparkline = sparkline;

  // PAGE
  // ════════════════════════════════════════════
  V2.pages.pilotage = {
    render: function (root) {
      var sales = V2.commSales ? V2.commSales() : (V2.sales || []);
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      injectStyles();

      var opso = isOpso();

      // ── Empty state ──
      if (!sales.length) {
        root.innerHTML = top +
          '<div class="v2-wrap">' +
            '<div class="v2-page-title">Pilotage</div>' +
            '<div class="v2-page-sub">' + (opso ? 'Tableau de bord groupement OPSO Santé.' : 'Ton chiffre d\'affaires, ta marge MDL et tes familles produits.') + '</div>' +
            '<div class="v2-card"><div class="v2-empty">' +
              '<div class="v2-empty-ico">' + ICO('pilo', 64, 1.4) + '</div>' +
              '<div class="v2-empty-t">Tes ventes ne sont pas encore disponibles</div>' +
              '<div class="v2-empty-d">Tes données de ventes ne sont pas encore chargées sur ton périmètre. Contacte ton administrateur pour les activer.</div>' +
            '</div></div>' +
          '</div>';
        return;
      }

      var idx = productIndex();
      var pf = periodFilter(sales, PERIOD);
      var inP = pf ? pf.inPeriod : function () { return true; };
      var inPrev = pf ? pf.inPrev : function () { return false; };

      var cur = sales.filter(inP);
      var prev = sales.filter(inPrev);

      // ── KPI 1 : CA net HT ──
      var caCur = V2.sumCA(cur), caPrev = V2.sumCA(prev);

      // ── KPI 2 : Marge MDL générée (remboursables) ──
      var mdlCur = 0;
      cur.forEach(function (s) { mdlCur += mdlOf(s, idx); });
      var mdlPct = caCur > 0 ? (mdlCur / caCur * 100) : 0;

      // ── KPI 3 : Pharmacies actives (CA > 0) ──
      var caByPh = {};
      cur.forEach(function (s) { caByPh[s.pharmacyId] = (caByPh[s.pharmacyId] || 0) + (s.mntNetHt || 0); });
      var activePh = Object.keys(caByPh).filter(function (id) { return caByPh[id] > 0; });
      var nbActive = activePh.length;

      // ── KPI 4 : Panier moyen ──
      var panier = nbActive ? caCur / nbActive : 0;

      // Séries pour les mini-tendances (12 derniers mois)
      var caSeries = monthlyCaSeries(sales, 12);
      var caTrend = caSeries.length >= 2 ? sparkline(caSeries, 'var(--ip-blue)', 150, 44) : '';
      var activeRatio = (V2.pharmacies || []).length ? Math.round(nbActive / (V2.pharmacies || []).length * 100) : 0;

      // ── HERO : CA net HT (le KPI qui prime) ──
      var heroKpi =
        '<div class="pilo-hero" data-reveal>' +
          '<div class="pilo-hero-main">' +
            '<div class="pilo-hero-l">CA net HT · ' + (pf ? esc(pf.label) : '') + '</div>' +
            '<div class="pilo-hero-v mono" data-count>' + V2.fmtEur(caCur) + '</div>' +
            '<div class="pilo-hero-delta">' + deltaHtml(caCur, caPrev, pf && pf.prevLabel) + '</div>' +
          '</div>' +
          (caTrend ? '<div class="pilo-hero-trend"><div class="pilo-hero-trend-t">12 derniers mois</div>' + caTrend + '</div>' : '') +
        '</div>';

      // ── KPIs secondaires (marge / actives / panier) ──
      var kpis = heroKpi +
        '<div class="v2-kpis pilo-kpis3" data-reveal>' +
          '<div class="v2-kpi k2"><div class="v2-kpi-l">Marge MDL générée</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtEur(mdlCur) + '</div>' +
            '<div class="pilo-kpi-meter"><span class="pilo-kpi-meter-fill" data-w="' + Math.min(100, mdlPct).toFixed(1) + '" style="width:0;background:var(--c-mint)"></span></div>' +
            '<div class="v2-kpi-d" style="color:var(--muted)">' + mdlPct.toFixed(1).replace('.', ',') + ' % du CA net</div></div>' +
          '<div class="v2-kpi k3"><div class="v2-kpi-l">Pharmacies actives</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtNum(nbActive) + '</div>' +
            '<div class="pilo-kpi-meter"><span class="pilo-kpi-meter-fill" data-w="' + activeRatio + '" style="width:0;background:var(--c-cat)"></span></div>' +
            '<div class="v2-kpi-d" style="color:var(--muted)">' + activeRatio + ' % des ' + V2.fmtNum((V2.pharmacies || []).length) + ' officines</div></div>' +
          '<div class="v2-kpi k4"><div class="v2-kpi-l">Panier moyen</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtEur(panier) + '</div>' +
            '<div class="v2-kpi-d" style="color:var(--muted);margin-top:auto">par officine active</div></div>' +
        '</div>';

      // ── Chart 13 mois ──
      var chart = build13MonthChart(sales);

      // ── Top pharmacies par CA (période) + marge MDL par pharma ──
      var phRows = activePh.map(function (id) {
        var phSales = cur.filter(function (s) { return s.pharmacyId === id; });
        var mdl = 0; phSales.forEach(function (s) { mdl += mdlOf(s, idx); });
        return { id: id, ca: caByPh[id], mdl: mdl };
      });

      // Top 10 par CA
      var topCa = phRows.slice().sort(function (a, b) { return b.ca - a.ca; }).slice(0, 10);
      var maxCa = topCa.length ? topCa[0].ca : 1;
      var topCaHtml = topCa.map(function (r, i) {
        var pct = maxCa > 0 ? Math.max(2, r.ca / maxCa * 100) : 0;
        var col = pharmaColor(r.id, 'var(--c-fiche)');
        return '<a class="v2-row" onclick="V2.go(\'pharma\',\'' + esc(r.id) + '\')">' +
          '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
          '<span class="v2-row-dot" style="background:' + col + '"></span>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="v2-row-name">' + esc(pharmaName(r.id)) + '</div>' +
            '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:' + col + '"></span></div>' +
          '</div>' +
          '<div class="pilo-vals">' +
            '<div class="v2-row-val mono">' + V2.fmtEur(r.ca) + '</div>' +
            '<div class="v2-row-meta mono">MDL ' + V2.fmtEur(r.mdl) + '</div>' +
          '</div>' +
          '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
        '</a>';
      }).join('');
      var topCaCard =
        '<div class="v2-card">' +
          '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pharma', 17) + 'Top 10 pharmacies par CA</div>' +
            '<span class="v2-card-link" onclick="V2.go(\'pharma\')">Toutes</span></div>' +
          (topCaHtml || '<div class="v2-empty"><div class="v2-empty-d">Aucune pharmacie active sur la période.</div></div>') +
        '</div>';

      // ── Répartition par famille ──
      var famTotals = {}; FAM.forEach(function (f) { famTotals[f.key] = 0; });
      cur.forEach(function (s) { famTotals[familyOf(s, idx)] += (s.mntNetHt || 0); });
      var famTotal = FAM.reduce(function (a, f) { return a + famTotals[f.key]; }, 0) || 1;
      var famSorted = FAM.slice().sort(function (a, b) { return famTotals[b.key] - famTotals[a.key]; });
      var famHtml = famSorted.map(function (f) {
        var v = famTotals[f.key];
        var pct = v / famTotal * 100;
        var icon = f.key === 'froid' ? 'froid' : 'pill';
        return '<div class="pilo-fam">' +
          '<div class="pilo-fam-top">' +
            '<span class="pilo-fam-l"><span class="pilo-fam-ico" style="color:' + f.color + '">' + ICO(icon, 15) + '</span>' + f.label + '</span>' +
            '<span class="pilo-fam-v"><span class="mono" style="font-weight:700">' + V2.fmtEur(v) + '</span>' +
              '<span class="mono pilo-fam-pct">' + pct.toFixed(1).replace('.', ',') + ' %</span></span>' +
          '</div>' +
          '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:' + f.color + '"></span></div>' +
        '</div>';
      }).join('');
      var famCard =
        '<div class="v2-card" style="padding:18px 20px">' +
          '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('cat', 17) + 'Répartition par famille de produits</div>' +
          famHtml +
        '</div>';

      // ── Répartition par tranche de prix (prix net unitaire) ──
      var tierCA = [0, 0, 0, 0], tierRefs = [{}, {}, {}, {}];
      cur.forEach(function (s) {
        var t = priceTier(s.puNet);
        tierCA[t] += (s.mntNetHt || 0);
        tierRefs[t][normCip(s.artCode)] = 1;
      });
      var tierTotal = tierCA.reduce(function (a, b) { return a + b; }, 0) || 1;
      var tierHtml = TIERS.map(function (t, i) {
        var v = tierCA[i], pct = v / tierTotal * 100, nref = Object.keys(tierRefs[i]).length;
        return '<div class="pilo-fam">' +
          '<div class="pilo-fam-top">' +
            '<span class="pilo-fam-l"><span class="pilo-tier-dot" style="background:' + t.color + '"></span>' + t.label +
              ' <span style="color:var(--muted);font-weight:500;font-size:11.5px">· ' + t.sub + '</span></span>' +
            '<span class="pilo-fam-v"><span class="mono" style="font-weight:700">' + V2.fmtEur(v) + '</span>' +
              '<span class="mono pilo-fam-pct">' + pct.toFixed(1).replace('.', ',') + ' %</span></span>' +
          '</div>' +
          '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:' + t.color + '"></span></div>' +
          '<div class="pilo-tier-meta mono">' + nref + ' référence' + (nref > 1 ? 's' : '') + '</div>' +
        '</div>';
      }).join('');
      var tierCard =
        '<div class="v2-card" style="padding:18px 20px">' +
          '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('cat', 17) + 'Répartition par tranche de prix</div>' +
          tierHtml +
        '</div>';

      // ── CA & marge par groupement ──
      var phById = {}; (V2.pharmacies || []).forEach(function (p) { phById[p.id] = p; });
      function grpKey(ph) { return (ph && (ph.groupement || '').trim()) || 'Indépendants'; }
      var grpAgg = {};
      cur.forEach(function (s) {
        var ph = phById[s.pharmacyId]; if (!ph) return;
        var g = grpKey(ph);
        var o = grpAgg[g] || (grpAgg[g] = { name: g, ca: 0, mdl: 0, prev: 0, ph: {} });
        o.ca += (s.mntNetHt || 0); o.mdl += mdlOf(s, idx); o.ph[s.pharmacyId] = 1;
      });
      prev.forEach(function (s) {
        var ph = phById[s.pharmacyId]; if (!ph) return;
        var o = grpAgg[grpKey(ph)]; if (o) o.prev += (s.mntNetHt || 0);
      });
      var grpList = Object.keys(grpAgg).map(function (k) { return grpAgg[k]; })
        .sort(function (a, b) { return b.ca - a.ca; });
      var grpCard = '';
      if (grpList.length >= 2 && !opso) {
        var topG = grpList.slice(0, 10);
        var maxG = Math.max(topG[0].ca, 1);
        var grpHtml = topG.map(function (g, i) {
          var pct = Math.max(2, g.ca / maxG * 100);
          var nb = Object.keys(g.ph).length;
          return '<div class="v2-row" style="cursor:default">' +
            '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="v2-row-name">' + esc(g.name) + '</div>' +
              '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:var(--ip-blue)"></span></div>' +
            '</div>' +
            '<div class="pilo-vals">' +
              '<div class="v2-row-val mono">' + V2.fmtEur(g.ca) + '</div>' +
              '<div class="v2-row-meta mono">' + nb + ' off. · MDL ' + V2.fmtEur(g.mdl) + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
        grpCard =
          '<div class="v2-card">' +
            '<div class="v2-card-head"><div class="v2-card-t">' + ICO('grid', 17) + 'CA &amp; marge par groupement</div>' +
              '<span class="v2-card-link" style="color:var(--muted);cursor:default">' + grpList.length + ' groupements</span></div>' +
            grpHtml +
          '</div>';
      }

      // ── Pénétration du marché Ameli (couverture de gamme + marchés non couverts) ──
      var B = window.BENCHMARK || [];
      var ameliMkt = {};
      B.forEach(function (b) {
        if (!b.has_ameli) return;
        var c = normCip(b.cip13); if (!c) return;
        ameliMkt[c] = { desc: (b.designation || c), market: +b.ameli_total || 0 };
      });
      var ameliCips = Object.keys(ameliMkt);
      var ameliCard = '';
      if (ameliCips.length) {
        var myQ = {}; cur.forEach(function (s) { var c = normCip(s.artCode); if (c) myQ[c] = (myQ[c] || 0) + (s.qte || 0); });
        var coveredN = 0; ameliCips.forEach(function (c) { if (myQ[c] > 0) coveredN++; });
        var totalN = ameliCips.length;
        var covBar = Math.round(totalN ? coveredN / totalN * 100 : 0);
        var gaps = ameliCips.filter(function (c) { return !myQ[c] && ameliMkt[c].market > 0; })
          .map(function (c) { return ameliMkt[c]; })
          .sort(function (a, b) { return b.market - a.market; }).slice(0, 10);
        var maxGap = gaps.length ? Math.max(gaps[0].market, 1) : 1;
        var gapHtml = gaps.length ? gaps.map(function (r, i) {
          var pct = Math.max(3, r.market / maxGap * 100);
          return '<div class="v2-row" style="cursor:default">' +
            '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="v2-row-name">' + esc(r.desc) + '</div>' +
              '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:var(--c-amber)"></span></div>' +
            '</div>' +
            '<div class="pilo-vals">' +
              '<div class="v2-row-val mono">' + V2.fmtNum(r.market) + '</div>' +
              '<div class="v2-row-meta mono" style="color:var(--c-amber)">non commandé</div>' +
            '</div>' +
          '</div>';
        }).join('') : '<div class="v2-empty"><div class="v2-empty-d">Tu couvres tous les marchés Ameli disponibles.</div></div>';
        ameliCard =
          '<div class="v2-card" style="margin-bottom:14px">' +
            '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pilo', 17) + 'Pénétration du marché Ameli</div>' +
              '<span class="v2-card-link" style="color:var(--muted);cursor:default">couverture de gamme</span></div>' +
            '<div class="opso-gauge-track" style="margin-top:2px"><div class="opso-gauge-fill" data-w="' + covBar + '" style="width:0"></div></div>' +
            '<div class="opso-gauge-labels" style="margin-bottom:18px">' +
              '<span class="mono" style="font-size:13px;font-weight:700;color:' + V2.tint(covBar, 30, 60) + '">' + covBar + ' %</span>' +
              '<span style="font-size:12px;color:var(--muted)">' + V2.fmtNum(coveredN) + ' / ' + V2.fmtNum(totalN) + ' produits Ameli commandés</span>' +
            '</div>' +
            '<div class="pilo-ameli-sub">Plus gros marchés Ameli que tu ne commandes pas <span style="color:var(--muted-2)">— volume national</span></div>' +
            gapHtml +
          '</div>';
      }

      // ── Alerte : Top 10 pharmacies en BAISSE (CA décline sur les mois) ──
      // Compare la 2e moitié des mois disponibles à la 1re (moyenne mensuelle).
      var allMonths = availableMonths(sales);
      var mdlCard;
      if (allMonths.length >= 2) {
        var nM = allMonths.length, cut = Math.ceil(nM / 2);
        var earlyK = {}, lateK = {};
        allMonths.forEach(function (m, i) { (i < cut ? earlyK : lateK)[mkey(m.year, m.month)] = 1; });
        var nEarly = cut, nLate = nM - cut;
        var eByPh = {}, lByPh = {};
        sales.forEach(function (s) {
          var k = mkey(s.year, s.month), v = s.mntNetHt || 0;
          if (earlyK[k]) eByPh[s.pharmacyId] = (eByPh[s.pharmacyId] || 0) + v;
          else if (lateK[k]) lByPh[s.pharmacyId] = (lByPh[s.pharmacyId] || 0) + v;
        });
        var decl = Object.keys(eByPh).map(function (id) {
          var em = (eByPh[id] || 0) / nEarly, lm = (lByPh[id] || 0) / nLate;
          return { id: id, em: em, lm: lm, drop: lm - em, pct: em > 0 ? (lm - em) / em * 100 : 0 };
        }).filter(function (r) { return r.em > 0 && r.drop < 0; })
          .sort(function (a, b) { return a.drop - b.drop; }).slice(0, 10);
        var maxDrop = decl.length ? Math.abs(decl[0].drop) : 1;
        var declHtml = decl.map(function (r, i) {
          var pct = maxDrop > 0 ? Math.max(3, Math.abs(r.drop) / maxDrop * 100) : 0;
          return '<a class="v2-row" onclick="V2.go(\'pharma\',\'' + esc(r.id) + '\')">' +
            '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
            '<span class="v2-row-dot" style="background:var(--c-rose)"></span>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="v2-row-name">' + esc(pharmaName(r.id)) + '</div>' +
              '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:var(--c-rose)"></span></div>' +
            '</div>' +
            '<div class="pilo-vals">' +
              '<div class="v2-row-val mono" style="color:var(--c-rose)">▼ ' + V2.fmtEur(Math.abs(r.drop)) + '/mois</div>' +
              '<div class="v2-row-meta mono">' + r.pct.toFixed(0).replace('-', '−') + ' %</div>' +
            '</div>' +
            '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
          '</a>';
        }).join('');
        mdlCard =
          '<div class="v2-card">' +
            '<div class="v2-card-head"><div class="v2-card-t">' + ICO('alert', 17) + 'Pharmacies en baisse · à relancer</div>' +
              '<span class="v2-card-link" style="color:var(--muted);cursor:default">2nde moitié vs 1ère</span></div>' +
            (declHtml || '<div class="v2-empty"><div class="v2-empty-d">Aucune pharmacie en recul sur la période.</div></div>') +
          '</div>';
      } else {
        mdlCard = '';
      }

      // ── Section OPSO groupement (conditionnelle) ──
      var opsoSect = opso ? buildOpsoSection(cur, prev, pf) : null;

      // ── Segmented period ──
      function seg(mode, lbl) {
        return '<button class="pilo-segbtn' + (PERIOD === mode ? ' on' : '') + '" data-p="' + mode + '">' + lbl + '</button>';
      }
      // sélecteur commercial (Tous / Will / Pauline) si plusieurs
      var comms = V2.commercials ? V2.commercials() : [];
      var commSeg = '';
      if (comms.length > 1) {
        var cb = function (val, lbl) { return '<button class="pilo-segbtn pilo-commbtn' + (V2.commFilter === val ? ' on' : '') + '" data-c="' + val + '">' + lbl + '</button>'; };
        commSeg = '<div class="pilo-seg" style="margin-right:8px">' + cb('', 'Tous') + comms.map(function (cm) { return cb(cm, cm); }).join('') + '</div>';
      }
      var header =
        '<div class="pilo-head">' +
          '<div>' +
            '<div class="v2-page-title">Pilotage</div>' +
            '<div class="v2-page-sub" style="margin-bottom:0">' + (pf ? esc(pf.label) : '') + (V2.commFilter ? ' · ' + esc(V2.commFilter) : (opso ? ' · Groupement OPSO Santé' : ' · ton tableau de bord commercial')) + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:0;flex-wrap:wrap;align-items:center">' + commSeg +
            '<div class="pilo-seg">' + seg('current', 'Dernier mois') + seg('3m', '3 mois') + seg('year', 'Année') + '</div>' +
          '</div>' +
        '</div>';

      // ── Mise en page « épurée » : l'essentiel ouvert, le détail replié ──
      // Bloc dépliable (progressive disclosure) : la page s'ouvre calme,
      // Will déplie seulement ce qu'il veut voir. Natif <details> = zéro JS,
      // respecte prefers-reduced-motion, pas de dépendance.
      function disc(title, hint, body, open) {
        if (!body) return '';
        return '<details class="pilo-disc"' + (open ? ' open' : '') + '>' +
            '<summary class="pilo-disc-sum">' +
              '<span class="pilo-disc-t">' + esc(title) + '</span>' +
              (hint ? '<span class="pilo-disc-hint">' + esc(hint) + '</span>' : '') +
              '<span class="pilo-disc-chev">' + ICO('chev', 16) + '</span>' +
            '</summary>' +
            '<div class="pilo-disc-body">' + body + '</div>' +
          '</details>';
      }

      // Détail : répartition du CA (familles + tranches de prix)
      var repartition = '<div class="pilo-grid2" data-reveal>' + famCard + tierCard + '</div>';
      // Détail : classements (top pharmacies + groupements)
      var classements = grpCard ? ('<div class="pilo-grid2" data-reveal>' + topCaCard + grpCard + '</div>') : ('<div data-reveal>' + topCaCard + '</div>');
      // Détail : marché Ameli & pharmacies à relancer
      var marche = (ameliCard && mdlCard) ? ('<div class="pilo-grid2" data-reveal>' + ameliCard + mdlCard + '</div>')
        : (ameliCard || mdlCard ? '<div data-reveal>' + (ameliCard || mdlCard) + '</div>' : '');

      // Repères pour les intitulés dépliables (aide à la lecture, pas des objectifs)
      var nbGrp = grpList.length;

      var marcheLink = (V2.pages && V2.pages.marche && !opso)
        ? '<a class="pilo-marche" onclick="V2.go(\'marche\')">' + ICO('spark', 17) +
            '<span><b>Marché &amp; opportunités</b><small>Marché France × tes ventes réseau : où pousser quoi, princeps en stock Intégral.</small></span>' +
            '<span class="pilo-marche-go">Ouvrir ' + ICO('chev', 16) + '</span></a>'
        : '';
      root.innerHTML = top +
        '<div class="v2-wrap">' +
          header +
          marcheLink +
          (opsoSect ? opsoSect.html : '') +
          // ── ESSENTIEL, toujours visible : où j'en suis en un coup d'œil ──
          kpis +
          chart.html +
          // ── DÉTAIL, replié par défaut : Will déplie au besoin ──
          disc('Répartition de mon chiffre d\'affaires', 'familles de produits et tranches de prix', repartition, false) +
          disc('Mes pharmacies', (nbActive ? nbActive + ' active' + (nbActive > 1 ? 's' : '') + ' sur la période' : '') + (nbGrp >= 2 && !opso ? ' · ' + nbGrp + ' groupements' : ''), classements, false) +
          (marche ? disc('Marché Ameli & pharmacies à relancer', 'ce que je ne commande pas encore, et qui décroche', marche, false) : '') +
        '</div>';

      // ── Bind segmented ──
      Array.prototype.forEach.call(root.querySelectorAll('.pilo-segbtn'), function (b) {
        b.onclick = function () {
          if (b.classList.contains('pilo-commbtn')) { V2.commFilter = b.dataset.c || ''; }
          else { PERIOD = b.dataset.p; }
          V2.render();
        };
      });

      // ── Animate bars at mount ──
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          Array.prototype.forEach.call(root.querySelectorAll('.pilo-bar-fill'), function (el) {
            el.style.width = (el.dataset.w || 0) + '%';
          });
          // jauges (activation OPSO + meters KPI + couverture Ameli)
          Array.prototype.forEach.call(root.querySelectorAll('.opso-gauge-fill,.pilo-kpi-meter-fill'), function (el) {
            el.style.width = (el.dataset.w || 0) + '%';
          });
        });
      });

      // ── Reveal au scroll (respecte prefers-reduced-motion) ──
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
      var revs = root.querySelectorAll('[data-reveal]');
      if (reduce || !('IntersectionObserver' in window)) {
        Array.prototype.forEach.call(revs, function (el) { el.classList.add('in'); });
      } else {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        Array.prototype.forEach.call(revs, function (el) { io.observe(el); });
      }

      // ── Dépliage : révéler + (re)jouer les barres du contenu à l'ouverture ──
      // Le contenu d'un <details> replié est masqué : l'observer ne le voit pas
      // et les barres ne s'animent pas. On force le rendu propre à la 1ʳᵉ ouverture.
      var _mo = V2.motion;
      Array.prototype.forEach.call(root.querySelectorAll('.pilo-disc'), function (d) {
        d.addEventListener('toggle', function () {
          if (!d.open) return;
          Array.prototype.forEach.call(d.querySelectorAll('[data-reveal]'), function (el) { el.classList.add('in'); });
          // Révélation douce du contenu à l'ouverture (fondu + léger glissé),
          // sans toucher au <details> ni aux barres animées ci-dessous.
          var body = d.querySelector('.pilo-disc-body');
          if (body && _mo && _mo.enter) _mo.enter(body, { y: 6, duration: 260 });
          requestAnimationFrame(function () {
            Array.prototype.forEach.call(d.querySelectorAll('.pilo-bar-fill'), function (el) { el.style.width = (el.dataset.w || 0) + '%'; });
            Array.prototype.forEach.call(d.querySelectorAll('.opso-gauge-fill,.pilo-kpi-meter-fill'), function (el) { el.style.width = (el.dataset.w || 0) + '%'; });
          });
        });
      });

      // ── Count-up des chiffres clés, déclenché à leur arrivée à l'écran ──
      // L'ENTRÉE (fondu + glissé) des blocs est déjà pilotée par l'observer
      // local du pilotage (classe .in, plus haut). On n'ajoute donc AUCUNE 2ᵉ
      // animation d'entrée ici — sinon double mouvement saccadé. Uniquement le
      // count-up (idempotent via data-mo-counted) : grand CA hero + les 3 KPI.
      if (_mo && _mo.inView && _mo.countUp) {
        var heroV = root.querySelector('.pilo-hero-v[data-count]');
        if (heroV) _mo.inView(heroV, function (el) { _mo.countUp(el); });
        var kpis3 = root.querySelector('.pilo-kpis3');
        if (kpis3) _mo.inView(kpis3, function (el) {
          Array.prototype.forEach.call(el.querySelectorAll('.v2-kpi-v.mono'), function (n) { _mo.countUp(n); });
        });
      }

      // ── Graphe 13 mois : les barres POUSSENT depuis la base, en cascade ──
      // Même grammaire que la fiche officine (applyPharmaMotion) : scaleY(0→1)
      // uniquement (transform, jamais height), transform-origin base, une seule
      // passe WAAPI, RM-safe (V2.motion pose l'état final sans animation).
      // On anime les BARRES, pas la carte : son entrée reste gérée par le
      // reveal .in de l'observer local — aucune double animation d'entrée.
      // La pousse des barres est désormais dans chart.bind() → homogène Pilotage ↔ fiche officine.
      if (_mo && _mo.stagger) {
        _mo.stagger(root.querySelectorAll('.pilo-chart .pilo-cbar-v'), { step: 45, y: 4, duration: 260, delay: 220 });
        _mo.stagger(root.querySelectorAll('.pilo-kfs .pilo-kf'), { step: 60, y: 6, duration: 280, delay: 340 });
      }

      // ── Bind chart (sélection de mois + pousse + tooltip) ──
      chart.bind(root);
    }
  };

  // ── Mini bar chart CSS 13 mois ────────────────
  function build13MonthChart(sales) {
    injectStyles();   // garantit les styles du chart même hors page Pilotage (ex : fiche officine)
    var months = availableMonths(sales);
    if (!months.length) return { html: '', bind: function () {} };
    var last = months[months.length - 1];
    var lastK = mkey(last.year, last.month);
    var MN = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    var MNfull = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    // 13 derniers mois (incl. courant), même sans vente
    var bars = [];
    for (var i = 12; i >= 0; i--) {
      var k = lastK - i;
      var y = Math.floor(k / 12), mo = (k % 12);
      bars.push({ year: y, month: mo + 1, mlabel: MN[mo], full: MNfull[mo], ca: 0 });
    }
    var byK = {};
    bars.forEach(function (b, ix) { byK[mkey(b.year, b.month)] = ix; });
    sales.forEach(function (s) {
      if (!s.month || !s.year) return;
      var ix = byK[mkey(s.year, s.month)];
      if (ix != null) bars[ix].ca += (s.mntNetHt || 0);
    });
    // Retire les mois VIDES en tête (avant le 1er mois avec des ventes) : pas de colonnes fantômes.
    var _f = 0; while (_f < bars.length - 1 && bars[_f].ca <= 0) _f++;
    if (_f > 0) bars = bars.slice(_f);
    var maxCa = bars.reduce(function (a, b) { return Math.max(a, b.ca); }, 0) || 1;

    // Repères dérivés des vraies ventes : moyenne (mois actifs), mois record
    var nonEmpty = bars.filter(function (b) { return b.ca > 0; });
    var avg = nonEmpty.length ? nonEmpty.reduce(function (a, b) { return a + b.ca; }, 0) / nonEmpty.length : 0;
    var best = null;
    bars.forEach(function (b) { if (b.ca > 0 && (!best || b.ca > best.ca)) best = b; });

    // Grammaire fiche officine : valeur k€ au-dessus, barre qui pousse depuis
    // la base, mois en dessous. Mois record = seul accent fort ; dernier mois marqué.
    var barsHtml = bars.map(function (b, i) {
      var h = b.ca > 0 ? Math.max(4, b.ca / maxCa * 100) : 0;
      var isLast = (i === bars.length - 1);
      var hot = best && b.year === best.year && b.month === best.month;
      // évolution vs mois précédent (si les deux mois ont des ventes)
      var pc = i > 0 ? bars[i - 1].ca : 0, dchip = '', dtip = '';
      if (b.ca > 0 && pc > 0) {
        var dd = (b.ca - pc) / pc * 100, up = dd >= 0;
        dchip = '<span class="pilo-cbar-d ' + (up ? 'up' : 'dn') + '">' + (up ? '+' : '') + Math.round(dd) + '%</span>';
        dtip = ' · ' + (up ? '▲ +' : '▼ ') + Math.round(dd) + '% vs mois préc.';
      }
      return '<div class="pilo-cbar' + (hot ? ' pilo-cbar-hot' : '') + (isLast ? ' pilo-cbar-cur' : '') + '" data-i="' + i + '" data-tip="' + esc(cap(b.full) + ' ' + b.year + ' · ' + V2.fmtEur(b.ca) + dtip) + '">' +
        '<span class="pilo-cbar-v mono">' + V2.fmtK(b.ca) + '</span>' + dchip +
        '<div class="pilo-cbar-track">' +
          '<span class="pilo-cbar-fill' + (isLast ? ' cur' : '') + '" style="height:' + h.toFixed(1) + '%"></span>' +
        '</div>' +
        '<span class="pilo-cbar-lbl' + (isLast ? ' on' : '') + '">' + b.mlabel + '</span>' +
      '</div>';
    }).join('');

    // Repères chiffrés sous le graphe (moyenne · meilleur mois · mois actifs),
    // même présentation que le tableau de bord de la fiche officine.
    function kf(l, v) {
      return '<div class="pilo-kf"><span class="pilo-kf-l">' + l + '</span><span class="pilo-kf-v mono">' + v + '</span></div>';
    }
    var kfs =
      '<div class="pilo-kfs">' +
        (avg > 0 ? kf('Moyenne', V2.fmtEur(avg) + '<small>/mois</small>') : '') +
        (best ? kf('Meilleur mois', esc(cap(best.full)) + ' · ' + V2.fmtEur(best.ca)) : '') +
        kf('Mois actifs', V2.fmtNum(nonEmpty.length) + '<small>/' + bars.length + '</small>') +
      '</div>';

    var range = cap(bars[0].full) + ' ' + bars[0].year + ' → ' + cap(bars[bars.length - 1].full) + ' ' + bars[bars.length - 1].year;
    var html =
      '<div class="v2-card pilo-chart-card" data-reveal>' +
        '<div class="pilo-chart-head">' +
          '<div class="v2-card-t">' + ICO('pilo', 17) + 'Évolution du CA · ' + bars.length + ' mois</div>' +
          '<span class="pilo-chart-period mono">' + esc(range) + '</span>' +
        '</div>' +
        '<div class="pilo-readout" id="pilo-readout"></div>' +
        '<div class="pilo-hint">Touche un mois pour voir son évolution</div>' +
        '<div class="pilo-chart" id="pilo-chart">' + barsHtml +
          '<div class="pilo-tip" id="pilo-tip"></div>' +
        '</div>' +
        kfs +
      '</div>';

    function bind(root) {
      // révèle le chart même hors page Pilotage (la fiche n'a pas d'observer data-reveal)
      var card = root.querySelector('.pilo-chart-card'); if (card) card.classList.add('in');
      var tip = root.querySelector('#pilo-tip');
      var chartEl = root.querySelector('#pilo-chart');
      var readout = root.querySelector('#pilo-readout');
      var barEls = root.querySelectorAll('.pilo-cbar');
      if (!chartEl) return;

      // ── Barres qui POUSSENT (homogène Pilotage ↔ fiche officine) ──
      var mo = V2.motion || null;
      if (mo && mo.animate) {
        var fills = root.querySelectorAll('.pilo-chart .pilo-cbar-fill');
        for (var cf = 0; cf < fills.length; cf++) {
          mo.animate(fills[cf], [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
            { duration: 460, delay: 120 + Math.min(cf, 12) * 42, easing: mo.ease && mo.ease.out, to: { transform: 'scaleY(1)' } });
        }
      }

      // ── Choisir un mois → encart d'évolution ──
      function selectMonth(i) {
        var b = bars[i]; if (!b) return;
        Array.prototype.forEach.call(barEls, function (el) { el.classList.toggle('sel', (+el.dataset.i) === i); });
        if (!readout) return;
        var prev = i > 0 ? bars[i - 1].ca : 0;
        var evHtml;
        if (b.ca > 0 && prev > 0) {
          var up = b.ca >= prev, pct = Math.round(Math.abs((b.ca - prev) / prev * 100));
          evHtml = '<span class="pilo-ro-d ' + (up ? 'up' : 'dn') + '">' + (up ? '▲ +' : '▼ ') + pct + ' % vs mois préc.</span>';
        } else { evHtml = '<span class="pilo-ro-d mut">' + (b.ca > 0 ? 'premier mois' : 'pas de vente') + '</span>'; }
        var avgHtml = (b.ca > 0 && avg > 0)
          ? '<span class="pilo-ro-a mono">' + (b.ca >= avg ? '+' : '−') + Math.round(Math.abs((b.ca - avg) / avg * 100)) + ' % vs moyenne</span>' : '';
        readout.innerHTML = '<span class="pilo-ro-m">' + esc(cap(b.full) + ' ' + b.year) + '</span>' +
          '<span class="pilo-ro-v mono">' + V2.fmtEur(b.ca) + '</span>' + evHtml + avgHtml;
      }
      Array.prototype.forEach.call(barEls, function (el) {
        el.addEventListener('click', function () { selectMonth(+el.dataset.i); });
      });
      // Défaut = dernier mois ; mais si le dernier semble PARTIEL (chute >60% vs préc.),
      // on sélectionne le dernier mois complet — évite un « −89% » trompeur à l'ouverture.
      var defI = bars.length - 1;
      if (defI > 0 && bars[defI].ca > 0 && bars[defI - 1].ca > 0 && bars[defI].ca < bars[defI - 1].ca * 0.4) defI = defI - 1;
      selectMonth(defI);

      // ── Tooltip au survol (conservé) ──
      if (tip) {
        Array.prototype.forEach.call(barEls, function (el) {
          var show = function () {
            tip.textContent = el.dataset.tip; tip.classList.add('show');
            var cr = chartEl.getBoundingClientRect(), er = el.getBoundingClientRect();
            var x = er.left - cr.left + er.width / 2;
            tip.style.left = Math.min(Math.max(x, 70), cr.width - 70) + 'px';
          };
          el.addEventListener('mouseenter', show);
          el.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
        });
        chartEl.addEventListener('pointerleave', function () { tip.classList.remove('show'); });
      }
    }
    return { html: html, bind: bind };
  }

  // ── Styles spécifiques pilotage (one-time) ────
  function injectStyles() {
    if (document.getElementById('pilo-styles')) return;
    var css =
      // ── Voix data (signature n°1) : tout chiffre mono, tabular, aligné ──
      '.pilo-vals .mono,.pilo-fam-v .mono,.pilo-rank,.pilo-cbar-lbl,.pilo-cbar-v,.pilo-kf-v,.pilo-chart-period,.pilo-tier-meta,.pilo-tip,.opso-chip-n,.opso-perim-nums .mono,.opso-gauge-labels .mono{font-feature-settings:"tnum" 1,"lnum" 1;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.02em}' +
      '.pilo-vals .v2-row-val,.pilo-vals .v2-row-meta{font-variant-numeric:tabular-nums lining-nums}' +
      '.pilo-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}' +
      '.pilo-seg{display:inline-flex;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:4px;box-shadow:var(--sh-1)}' +
      '.pilo-segbtn{border:none;background:transparent;border-radius:9px;padding:8px 15px;font-family:var(--font);font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;transition:.18s var(--ease);white-space:nowrap}' +
      '.pilo-segbtn:hover{color:var(--ip-ink)}' +
      '.pilo-segbtn.on{background:var(--ip-blue);color:#fff;box-shadow:0 2px 8px rgba(0,80,230,.28)}' +
      '.pilo-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}' +
      '@media(max-width:820px){.pilo-grid2{grid-template-columns:1fr}}' +
      // ── HERO KPI (CA net = héros) ─────────────────
      '.pilo-hero{position:relative;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;' +
        'background:linear-gradient(120deg,color-mix(in srgb,var(--ip-blue) 6%,var(--card)),var(--card) 62%);' +
        'border:1px solid color-mix(in srgb,var(--ip-blue) 20%,var(--line));border-radius:var(--r-card);' +
        'padding:24px 26px;margin-bottom:14px;box-shadow:var(--sh-2);overflow:hidden}' +
      '.pilo-hero::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;' +
        'background:linear-gradient(180deg,var(--ip-blue),var(--ip-blue-d))}' +
      '.pilo-hero-main{min-width:0}' +
      '.pilo-hero-l{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700}' +
      '.pilo-hero-v{font-family:var(--mono);font-size:clamp(34px,6vw,46px);font-weight:700;letter-spacing:-.035em;line-height:1.02;margin-top:8px;color:var(--ip-ink)}' +
      '.pilo-hero-delta{margin-top:8px}.pilo-hero-delta .v2-kpi-d{font-size:13px}' +
      '.pilo-hero-trend{flex-shrink:0;text-align:right}' +
      '.pilo-hero-trend-t{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted-2);font-weight:700;margin-bottom:6px}' +
      '@media(max-width:560px){.pilo-hero{padding:20px 20px}.pilo-hero-trend{text-align:left}.pilo-hero .pilo-spark{width:100%}}' +
      // sparklines
      '.pilo-spark{display:block;overflow:visible}' +
      '.pilo-spark-line{stroke-dasharray:520;stroke-dashoffset:520;animation:pilo-draw 1s var(--mo-ease-in) forwards}' +
      '@keyframes pilo-draw{to{stroke-dashoffset:0}}' +
      // KPI secondaires : 3 colonnes + mini-jauge
      '.pilo-kpis3{grid-template-columns:repeat(3,1fr)}' +
      '@media(max-width:720px){.pilo-kpis3{grid-template-columns:1fr}}' +
      '.pilo-kpis3 .v2-kpi{display:flex;flex-direction:column}' +
      '.pilo-kpi-meter{height:5px;border-radius:999px;background:var(--surf-sunken);overflow:hidden;margin-top:10px;box-shadow:inset 0 1px 1px rgba(16,19,28,.05)}' +
      '.pilo-kpi-meter-fill{display:block;height:100%;border-radius:999px;transition:width var(--mo-dur) var(--mo-ease-in)}' +
      // reveal au scroll
      '[data-reveal]{opacity:0;transform:translateY(14px);transition:opacity .5s var(--mo-ease-in),transform .5s var(--mo-ease-in)}' +
      '[data-reveal].in{opacity:1;transform:none}' +
      '@media(prefers-reduced-motion:reduce){[data-reveal]{opacity:1;transform:none;transition:none}.pilo-spark-line{animation:none;stroke-dashoffset:0}}' +
      '.pilo-rank{color:var(--muted-2);font-size:12px;width:18px;flex-shrink:0;text-align:center}' +
      '.pilo-vals{text-align:right;flex-shrink:0}' +
      // progress bars (horizontales) — track creux, signature de profondeur par ton
      '.pilo-bar{margin-top:6px;height:5px;border-radius:999px;background:var(--surf-sunken);overflow:hidden;box-shadow:inset 0 1px 1px rgba(16,19,28,.05)}' +
      '.pilo-bar-fill{display:block;height:100%;border-radius:999px;transition:width var(--mo-dur) var(--mo-ease-in)}' +
      // familles
      '.pilo-fam{margin-bottom:15px}.pilo-fam:last-child{margin-bottom:2px}' +
      '.pilo-fam-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;font-size:13.5px}' +
      '.pilo-fam-l{display:flex;align-items:center;gap:8px;font-weight:600}' +
      '.pilo-fam-ico{display:inline-flex;align-items:center}' +
      '.pilo-fam-v{display:flex;align-items:baseline;gap:9px}' +
      '.pilo-fam-pct{font-size:11.5px;color:var(--muted)}' +
      // tranches de prix
      '.pilo-tier-dot{display:inline-block;width:9px;height:9px;border-radius:3px;flex-shrink:0}' +
      '.pilo-tier-meta{font-size:10.5px;color:var(--muted-2);margin-top:4px}' +
      '.pilo-ameli-sub{font-size:12px;font-weight:600;color:var(--muted);margin-bottom:10px;letter-spacing:.005em}' +
      // ── Blocs dépliables (progressive disclosure) : le détail reste calme et rangé ──
      '.pilo-marche{display:flex;align-items:center;gap:12px;margin-top:var(--sp-4,16px);padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-card,14px);background:var(--card);box-shadow:var(--sh-1);cursor:pointer;text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}' +
      '.pilo-marche:hover{border-color:var(--ip-blue,#0057FF);transform:translateY(-1px)}' +
      '.pilo-marche>svg:first-child{color:var(--ip-blue,#0057FF);flex-shrink:0}' +
      '.pilo-marche span:nth-child(2){flex:1;min-width:0}' +
      '.pilo-marche b{display:block;font-size:14.5px;font-weight:700}' +
      '.pilo-marche small{display:block;font-size:12px;color:var(--muted);margin-top:2px;line-height:1.4}' +
      '.pilo-marche-go{display:inline-flex;align-items:center;gap:3px;font-size:13px;font-weight:700;color:var(--ip-blue,#0057FF);white-space:nowrap}' +
      '.pilo-disc{margin-top:var(--sp-4);border:1px solid var(--line);border-radius:var(--r-card);background:var(--card);box-shadow:var(--sh-1);overflow:hidden}' +
      '.pilo-disc[open]{box-shadow:var(--sh-2)}' +
      '.pilo-disc-sum{display:flex;align-items:center;gap:12px;padding:17px 20px;cursor:pointer;list-style:none;user-select:none;transition:background .16s var(--ease)}' +
      '.pilo-disc-sum::-webkit-details-marker{display:none}' +
      '.pilo-disc-sum:hover{background:var(--card-2)}' +
      '.pilo-disc-t{font-size:15px;font-weight:700;color:var(--ip-ink);letter-spacing:-.01em}' +
      '.pilo-disc-hint{font-size:12.5px;color:var(--muted);font-weight:500;flex:1;min-width:0}' +
      '.pilo-disc-chev{margin-left:auto;color:var(--muted-2);display:inline-flex;flex-shrink:0;transition:transform .2s var(--mo-ease-soft)}' +
      '.pilo-disc[open] .pilo-disc-chev{transform:rotate(90deg)}' +
      '.pilo-disc-body{padding:2px 20px 20px}' +
      '@media(max-width:560px){.pilo-disc-hint{flex:0 0 100%;order:3}.pilo-disc-sum{flex-wrap:wrap;gap:4px 10px}.pilo-disc-body{padding:2px 14px 16px}}' +
      '@media(prefers-reduced-motion:reduce){.pilo-disc-chev{transition:none}}' +
      // ── Chart 13 mois : la pièce maîtresse (grammaire fiche officine) ──
      '.pilo-chart-card{padding:20px 22px 18px;margin-bottom:14px}' +
      '.pilo-chart-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}' +
      '.pilo-chart-period{font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap}' +
      // ── Encart d\'évolution du mois choisi (sélection sur le graphe) ──
      '.pilo-readout{display:flex;align-items:center;flex-wrap:wrap;gap:8px 13px;margin:14px 0 4px;padding:11px 15px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md)}' +
      '.pilo-ro-m{font-size:13.5px;font-weight:800;color:var(--ip-ink);letter-spacing:-.01em;text-transform:capitalize}' +
      '.pilo-ro-v{font-size:16px;font-weight:800;color:var(--ip-blue);font-variant-numeric:tabular-nums}' +
      '.pilo-ro-d{font-size:11.5px;font-weight:800;display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px}' +
      '.pilo-ro-d.up{color:var(--c-mint-txt,#0F7A52);background:color-mix(in srgb,#0F7A52 12%,transparent)}' +
      '.pilo-ro-d.dn{color:var(--c-rose-txt,#C7283D);background:color-mix(in srgb,#C7283D 12%,transparent)}' +
      '.pilo-ro-d.mut{color:var(--muted);background:var(--card)}' +
      '.pilo-ro-a{margin-left:auto;font-size:12px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums}' +
      '.pilo-hint{font-size:10.5px;color:var(--muted-2,#9AA1B2);font-weight:600;margin:0 0 8px 2px}' +
      '.pilo-cbar{cursor:pointer;transition:transform .15s var(--ease)}' +
      '.pilo-cbar:hover{transform:translateY(-2px)}' +
      '.pilo-cbar.sel .pilo-cbar-track{box-shadow:0 0 0 2px var(--ip-blue),0 0 0 5px color-mix(in srgb,var(--ip-blue) 16%,transparent)}' +
      '.pilo-cbar.sel .pilo-cbar-lbl{color:var(--ip-blue);font-weight:800}' +
      '.pilo-cbar.sel .pilo-cbar-v{color:var(--ip-blue)}' +
      '.pilo-chart{position:relative;display:flex;align-items:flex-end;gap:8px;height:196px}' +
      '@media(max-width:640px){.pilo-chart{gap:5px;height:168px}}' +
      '.pilo-cbar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;cursor:default;min-width:0}' +
      '.pilo-cbar-v{font-size:10.5px;font-weight:700;color:var(--muted);white-space:nowrap}' +
      '.pilo-cbar-d{font-size:9px;font-weight:800;line-height:1;white-space:nowrap;margin-top:1px}' +
      '.pilo-cbar-d.up{color:#0F7A52}.pilo-cbar-d.dn{color:#E0556E}' +
      '@media(max-width:640px){.pilo-cbar-d{display:none}}' +
      '@media(max-width:640px){.pilo-cbar-v{visibility:hidden}.pilo-cbar-hot .pilo-cbar-v,.pilo-cbar-cur .pilo-cbar-v{visibility:visible}}' +
      '.pilo-cbar-track{flex:1;width:100%;max-width:40px;display:flex;align-items:flex-end;background:var(--line-2);border-radius:8px 8px 3px 3px;overflow:hidden}' +
      '.pilo-cbar-fill{display:block;width:100%;border-radius:8px 8px 3px 3px;transform-origin:50% 100%;' +
        'background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 46%,#fff),color-mix(in srgb,var(--ip-blue) 78%,#fff));transition:background .18s var(--ease)}' +
      '.pilo-cbar:hover .pilo-cbar-fill{background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 62%,#fff),var(--ip-blue))}' +
      /* dernier mois : accent soutenu + libellé bleu */
      '.pilo-cbar-fill.cur{background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 80%,#fff),var(--ip-blue))}' +
      /* mois record : SEUL accent fort du graphe (hiérarchie calme) */
      '.pilo-cbar-hot .pilo-cbar-fill,.pilo-cbar-hot:hover .pilo-cbar-fill{background:linear-gradient(180deg,var(--ip-blue),var(--ip-blue-d));box-shadow:0 2px 8px color-mix(in srgb,var(--ip-blue) 32%,transparent)}' +
      '.pilo-cbar-hot .pilo-cbar-v{color:var(--ip-blue);font-weight:800}' +
      '.pilo-cbar-hot .pilo-cbar-lbl{color:var(--ip-ink);font-weight:700}' +
      '@media(prefers-reduced-motion:reduce){.pilo-bar-fill,.opso-gauge-fill,.pilo-kpi-meter-fill{transition:none}}' +
      '.pilo-cbar-lbl{font-size:10.5px;color:var(--muted);font-weight:600;font-family:var(--mono)}' +
      '.pilo-cbar-lbl.on{color:var(--ip-blue);font-weight:700}' +
      /* repères dérivés sous le graphe (moyenne · meilleur mois · mois actifs) */
      '.pilo-kfs{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}' +
      '.pilo-kf{flex:1;min-width:110px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);padding:9px 12px}' +
      '.pilo-kf-l{display:block;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);white-space:nowrap}' +
      '.pilo-kf-v{display:block;font-size:14.5px;font-weight:800;letter-spacing:-.01em;margin-top:3px;color:var(--ip-ink)}' +
      '.pilo-kf-v small{font-size:10.5px;color:var(--muted);font-weight:600}' +
      '.pilo-tip{position:absolute;top:-6px;transform:translateX(-50%);background:var(--ip-ink);color:#fff;font-size:12px;font-weight:600;' +
        'padding:7px 11px;border-radius:9px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:var(--sh-pop);z-index:5;font-family:var(--mono)}' +
      '.pilo-tip.show{opacity:1}' +
      // ── OPSO section ──────────────────────────────
      '.opso-section{margin-bottom:10px}' +
      '.opso-section-head{display:flex;align-items:center;gap:8px;font-size:11px;text-transform:uppercase;letter-spacing:.07em;' +
        'font-weight:700;color:var(--ip-blue);margin-bottom:14px;padding:0 2px}' +
      '.opso-act-body{display:flex;flex-direction:column;gap:18px}' +
      '.opso-gauge-track{height:10px;border-radius:999px;background:var(--surf-sunken);overflow:hidden;margin-bottom:8px;box-shadow:inset 0 1px 2px rgba(16,19,28,.06)}' +
      '.opso-gauge-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--ip-blue),var(--ip-blue-d));transition:width var(--mo-dur) var(--mo-ease-in)}' +
      '.opso-gauge-labels{display:flex;align-items:center;justify-content:space-between}' +
      '.opso-act-chips{display:flex;gap:12px;flex-wrap:wrap}' +
      '.opso-chip-stat{flex:1;min-width:80px;background:var(--card-2);border:1px solid var(--line);border-radius:14px;padding:14px 16px;text-align:center}' +
      '.opso-chip-stat.active{border-color:color-mix(in srgb,var(--ip-blue) 30%,var(--line));background:color-mix(in srgb,var(--ip-blue) 5%,var(--card))}' +
      '.opso-chip-stat.prospect{border-color:color-mix(in srgb,var(--c-amber) 30%,var(--line));background:color-mix(in srgb,var(--c-amber) 5%,var(--card))}' +
      '.opso-chip-n{font-size:26px;font-weight:700;letter-spacing:-.03em;color:var(--ip-ink)}' +
      '.opso-chip-l{font-size:11.5px;color:var(--muted);font-weight:600;margin-top:3px}' +
      '.opso-chip-stat.active .opso-chip-n{color:var(--ip-blue)}' +
      '.opso-chip-stat.prospect .opso-chip-n{color:var(--c-amber)}' +
      '.opso-kpi-grp{grid-template-columns:repeat(2,1fr) !important}' +
      '@media(max-width:600px){.opso-kpi-grp{grid-template-columns:1fr !important}}' +
      '.opso-perim-row{margin-bottom:16px}.opso-perim-row:last-child{margin-bottom:4px}' +
      '.opso-perim-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}' +
      '.opso-perim-badge{display:inline-flex;align-items:center;padding:4px 11px;border-radius:10px;font-size:12px;font-weight:700;letter-spacing:.01em}' +
      '.opso-perim-nums{display:flex;align-items:center;flex-wrap:wrap}' +
      '.opso-new-tag{display:inline-block;margin-left:6px;vertical-align:middle;font-size:9.5px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--ok);background:color-mix(in srgb,var(--ok) 14%,transparent);border:1px solid color-mix(in srgb,var(--ok) 30%,transparent);border-radius:999px;padding:1px 7px;font-family:var(--mono)}';

    var st = document.createElement('style');
    st.id = 'pilo-styles'; st.textContent = css;
    document.head.appendChild(st);
  }
})();
