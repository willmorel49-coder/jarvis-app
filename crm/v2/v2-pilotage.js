/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier 4 — PILOTAGE (tableau de bord commercial)
   À partir de V2.sales : CA net HT, marge MDL, familles, top pharma.
   Graphes en CSS/SVG pur — aucune dépendance externe. Zéro emoji.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2; if (!V2) return;
  V2.pages = V2.pages || {};

  // ── State période (local module) ──────────────
  var PERIOD = 'current';            // 'current' | '3m' | 'year'

  // ── Couleurs familles (spec) ──────────────────
  var FAM = [
    { key: 'froid',      label: 'Froid',         color: '#00B5D8' },
    { key: 'generiques', label: 'Génériques',    color: '#737A8C' },
    { key: 'biosim',     label: 'Biosimilaires', color: '#6D4FC4' },
    { key: 'nr',         label: 'NR',            color: '#C7791A' },
    { key: 'princeps',   label: 'Princeps',      color: '#0050E6' },
  ];

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

  // ════════════════════════════════════════════
  // PAGE
  // ════════════════════════════════════════════
  V2.pages.pilotage = {
    render: function (root) {
      var sales = V2.sales || [];
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      injectStyles();

      // ── Empty state ──
      if (!sales.length) {
        root.innerHTML = top +
          '<div class="v2-wrap">' +
            '<div class="v2-page-title">Pilotage</div>' +
            '<div class="v2-page-sub">Ton chiffre d\'affaires, ta marge MDL et tes familles produits.</div>' +
            '<div class="v2-card"><div class="v2-empty">' +
              '<div class="v2-empty-ico">' + ICO('pilo', 64, 1.4) + '</div>' +
              '<div class="v2-empty-t">Pas encore de ventes importées</div>' +
              '<div class="v2-empty-d">Importe tes relevés de ventes pour voir ton CA, ta marge MDL et l\'évolution sur 13 mois.</div>' +
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

      var kpis =
        '<div class="v2-kpis">' +
          '<div class="v2-kpi k1"><div class="v2-kpi-l">CA net HT</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtEur(caCur) + '</div>' + deltaHtml(caCur, caPrev, pf && pf.prevLabel) + '</div>' +
          '<div class="v2-kpi k2"><div class="v2-kpi-l">Marge MDL générée</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtEur(mdlCur) + '</div>' +
            '<div class="v2-kpi-d" style="color:var(--muted)">' + mdlPct.toFixed(1).replace('.', ',') + ' % du CA</div></div>' +
          '<div class="v2-kpi k3"><div class="v2-kpi-l">Pharmacies actives</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtNum(nbActive) + '</div>' +
            '<div class="v2-kpi-d" style="color:var(--muted)">sur ' + V2.fmtNum((V2.pharmacies || []).length) + ' au total</div></div>' +
          '<div class="v2-kpi k4"><div class="v2-kpi-l">Panier moyen</div>' +
            '<div class="v2-kpi-v mono">' + V2.fmtEur(panier) + '</div>' +
            '<div class="v2-kpi-d" style="color:var(--muted)">par officine active</div></div>' +
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

      // ── Marge MDL par pharmacie (top 10) ──
      var mdlRows = phRows.slice().filter(function (r) { return r.mdl > 0; })
        .sort(function (a, b) { return b.mdl - a.mdl; }).slice(0, 10);
      var maxMdl = mdlRows.length ? mdlRows[0].mdl : 1;
      var mdlHtml = mdlRows.map(function (r, i) {
        var pct = maxMdl > 0 ? Math.max(2, r.mdl / maxMdl * 100) : 0;
        return '<a class="v2-row" onclick="V2.go(\'pharma\',\'' + esc(r.id) + '\')">' +
          '<span class="mono pilo-rank">' + (i + 1) + '</span>' +
          '<span class="v2-row-dot" style="background:var(--c-mint)"></span>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="v2-row-name">' + esc(pharmaName(r.id)) + '</div>' +
            '<div class="pilo-bar"><span class="pilo-bar-fill" data-w="' + pct.toFixed(1) + '" style="width:0;background:var(--c-mint)"></span></div>' +
          '</div>' +
          '<div class="v2-row-val mono" style="flex-shrink:0">' + V2.fmtEur(r.mdl) + '</div>' +
          '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
        '</a>';
      }).join('');
      var mdlCard =
        '<div class="v2-card">' +
          '<div class="v2-card-head"><div class="v2-card-t">' + ICO('euro', 17) + 'Marge MDL par pharmacie</div>' +
            '<span class="v2-card-link" style="color:var(--muted);cursor:default">remboursables</span></div>' +
          (mdlHtml || '<div class="v2-empty"><div class="v2-empty-d">Aucune marge MDL sur la période (pas de ventes remboursables).</div></div>') +
        '</div>';

      // ── Segmented period ──
      function seg(mode, lbl) {
        return '<button class="pilo-segbtn' + (PERIOD === mode ? ' on' : '') + '" data-p="' + mode + '">' + lbl + '</button>';
      }
      var header =
        '<div class="pilo-head">' +
          '<div>' +
            '<div class="v2-page-title">Pilotage</div>' +
            '<div class="v2-page-sub" style="margin-bottom:0">' + (pf ? esc(pf.label) : '') + ' · ton tableau de bord commercial</div>' +
          '</div>' +
          '<div class="pilo-seg">' + seg('current', 'Mois courant') + seg('3m', '3 mois') + seg('year', 'Année') + '</div>' +
        '</div>';

      root.innerHTML = top +
        '<div class="v2-wrap">' +
          header +
          kpis +
          chart.html +
          '<div class="pilo-grid2">' + topCaCard + famCard + '</div>' +
          mdlCard +
        '</div>';

      // ── Bind segmented ──
      Array.prototype.forEach.call(root.querySelectorAll('.pilo-segbtn'), function (b) {
        b.onclick = function () { PERIOD = b.dataset.p; V2.render(); };
      });

      // ── Animate bars at mount ──
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          Array.prototype.forEach.call(root.querySelectorAll('.pilo-bar-fill'), function (el) {
            el.style.width = (el.dataset.w || 0) + '%';
          });
          Array.prototype.forEach.call(root.querySelectorAll('.pilo-cbar-fill'), function (el) {
            el.style.height = (el.dataset.h || 0) + '%';
          });
        });
      });

      // ── Bind chart hover ──
      chart.bind(root);
    }
  };

  // ── Mini bar chart CSS 13 mois ────────────────
  function build13MonthChart(sales) {
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
    var maxCa = bars.reduce(function (a, b) { return Math.max(a, b.ca); }, 0) || 1;

    var barsHtml = bars.map(function (b, i) {
      var h = b.ca > 0 ? Math.max(3, b.ca / maxCa * 100) : 0;
      var isLast = (i === bars.length - 1);
      return '<div class="pilo-cbar" data-tip="' + esc(cap(b.full) + ' ' + b.year + ' · ' + V2.fmtEur(b.ca)) + '">' +
        '<div class="pilo-cbar-track">' +
          '<span class="pilo-cbar-fill' + (isLast ? ' cur' : '') + '" data-h="' + h.toFixed(1) + '" style="height:0"></span>' +
        '</div>' +
        '<span class="pilo-cbar-lbl">' + b.mlabel + '</span>' +
      '</div>';
    }).join('');

    var html =
      '<div class="v2-card" style="padding:18px 20px;margin-bottom:14px">' +
        '<div class="v2-card-t" style="margin-bottom:4px">' + ICO('pilo', 17) + 'Évolution du CA · 13 mois</div>' +
        '<div class="v2-page-sub" style="margin-bottom:14px">Survole une barre pour voir le détail mensuel</div>' +
        '<div class="pilo-chart" id="pilo-chart">' + barsHtml +
          '<div class="pilo-tip" id="pilo-tip"></div>' +
        '</div>' +
      '</div>';

    function bind(root) {
      var tip = root.querySelector('#pilo-tip');
      var chartEl = root.querySelector('#pilo-chart');
      if (!tip || !chartEl) return;
      Array.prototype.forEach.call(root.querySelectorAll('.pilo-cbar'), function (el) {
        el.addEventListener('mouseenter', function () {
          tip.textContent = el.dataset.tip;
          tip.classList.add('show');
          var cr = chartEl.getBoundingClientRect();
          var er = el.getBoundingClientRect();
          var x = er.left - cr.left + er.width / 2;
          tip.style.left = Math.min(Math.max(x, 70), cr.width - 70) + 'px';
        });
        el.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
      });
    }
    return { html: html, bind: bind };
  }

  // ── Styles spécifiques pilotage (one-time) ────
  function injectStyles() {
    if (document.getElementById('pilo-styles')) return;
    var css =
      '.pilo-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}' +
      '.pilo-seg{display:inline-flex;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:4px;box-shadow:var(--sh-1)}' +
      '.pilo-segbtn{border:none;background:transparent;border-radius:9px;padding:8px 15px;font-family:var(--font);font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;transition:.18s var(--ease);white-space:nowrap}' +
      '.pilo-segbtn:hover{color:var(--ip-ink)}' +
      '.pilo-segbtn.on{background:var(--ip-blue);color:#fff;box-shadow:0 2px 8px rgba(0,80,230,.28)}' +
      '.pilo-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}' +
      '@media(max-width:820px){.pilo-grid2{grid-template-columns:1fr}}' +
      '.pilo-rank{color:var(--muted-2);font-size:12px;width:18px;flex-shrink:0;text-align:center}' +
      '.pilo-vals{text-align:right;flex-shrink:0}' +
      // progress bars (horizontales)
      '.pilo-bar{margin-top:6px;height:5px;border-radius:999px;background:var(--line);overflow:hidden}' +
      '.pilo-bar-fill{display:block;height:100%;border-radius:999px;transition:width .7s var(--ease)}' +
      // familles
      '.pilo-fam{margin-bottom:15px}.pilo-fam:last-child{margin-bottom:2px}' +
      '.pilo-fam-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;font-size:13.5px}' +
      '.pilo-fam-l{display:flex;align-items:center;gap:8px;font-weight:600}' +
      '.pilo-fam-ico{display:inline-flex;align-items:center}' +
      '.pilo-fam-v{display:flex;align-items:baseline;gap:9px}' +
      '.pilo-fam-pct{font-size:11.5px;color:var(--muted)}' +
      // chart 13 mois
      '.pilo-chart{position:relative;display:flex;align-items:flex-end;gap:6px;height:160px;padding-top:8px}' +
      '.pilo-cbar{flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;height:100%;cursor:default;min-width:0}' +
      '.pilo-cbar-track{flex:1;width:100%;max-width:34px;display:flex;align-items:flex-end;border-radius:7px 7px 3px 3px;overflow:hidden;background:var(--line-2)}' +
      '.pilo-cbar-fill{display:block;width:100%;border-radius:7px 7px 3px 3px;background:color-mix(in srgb,var(--ip-blue) 78%,#fff);transition:height .7s var(--ease)}' +
      '.pilo-cbar-fill.cur{background:linear-gradient(180deg,var(--ip-blue),var(--ip-blue-d))}' +
      '.pilo-cbar:hover .pilo-cbar-fill{background:var(--c-pilo)}' +
      '.pilo-cbar:hover .pilo-cbar-fill.cur{background:linear-gradient(180deg,var(--c-pilo),#A65F12)}' +
      '.pilo-cbar-lbl{font-size:10.5px;color:var(--muted);font-weight:600;font-family:var(--mono)}' +
      '.pilo-tip{position:absolute;top:-6px;transform:translateX(-50%);background:var(--ip-ink);color:#fff;font-size:12px;font-weight:600;' +
        'padding:7px 11px;border-radius:9px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;box-shadow:var(--sh-pop);z-index:5;font-family:var(--mono)}' +
      '.pilo-tip.show{opacity:1}';
    var st = document.createElement('style');
    st.id = 'pilo-styles'; st.textContent = css;
    document.head.appendChild(st);
  }
})();
