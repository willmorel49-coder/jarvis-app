// ═══════════════════════════════════════════════════════════════════
// OPSO Santé — écrans « Pharmacies » (évolution par officine) et
// « Meilleurs achats » (liste produits classée par nombre de pharmacies).
// Propre à OPSO (jamais chargé côté CRM JARVIS, garde window.V2_BRAND.opso
// laissée à l'appelant — ce module n'est de toute façon chargé que dans
// opso/v2/index.html). Brief : _travail-opso-offilog/BRIEF-PHARMACIES.md,
// 29/09/2026.
//
// Sources de données : UNIQUEMENT V2.pharmacies / V2.sales / window.PROD_STATS
// / window.BENCHMARK — déjà chargés côté OPSO pour le bloc « le cap »
// (opso-groupement.js). Aucun nouveau fichier, aucune donnée protégée
// supplémentaire. Les totaux réseau (adhérentes, clientes, cumul, mois,
// mois en attente) viennent de V2.opsoGroupement.computeData() : MÊME calcul
// que le bloc d'accueil, donc recoupement garanti par construction.
// ═══════════════════════════════════════════════════════════════════
(function () {
  "use strict";
  var V2 = window.V2 || (window.V2 = {});
  V2.pages = V2.pages || {};

  var esc = V2.esc || function (s) { return String(s == null ? '' : s); };
  var euros = V2.fmtEur || function (n) { return Math.round(n || 0) + ' €'; };
  var euroK = V2.fmtK || euros;

  function pct1(n) {
    var v = Math.round((n || 0) * 10) / 10;
    return (v > 0 ? '+' : '') + String(v).replace('.', ',') + ' %';
  }
  function esc2(s) { return esc(s); }
  // CIP normalisé sans zéros de tête — même règle que opso-groupement.js / v2-boot.js.
  function normCip(c) { return String(c == null ? '' : c).replace(/\D/g, '').replace(/^0+/, ''); }
  // Recherche insensible aux accents et à la casse.
  function fold(s) {
    try { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    catch (e) { return String(s == null ? '' : s).toLowerCase(); }
  }

  var MOIS_ABREV = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var MOIS_PLEIN = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  // Mêmes 8 catégories que le bloc « Ce que les adhérentes achètent » de
  // opso-groupement.js (tranche tarifaire PROD_STATS.f) — pas de champ
  // « rayon » séparé dans PROD_STATS (vérifié dans generate_prod_stats.py) :
  // remettre les MÊMES clés plutôt qu'en inventer une 2ᵉ grille inconsistante.
  var CAT_LABELS = {
    pr_low: 'Princeps petits prix', pr_mid: 'Princeps intermédiaires', pr_high: 'Princeps chers',
    tch: 'Princeps très chers', gen: 'Génériques', biosim: 'Biosimilaires', nr: 'Non remboursables', x: 'Autres références'
  };
  var CAT_ORDER = ['pr_low', 'pr_mid', 'pr_high', 'tch', 'gen', 'biosim', 'nr', 'x'];

  function root$() { return document.getElementById('v2-root'); }

  // ── Résolution du nom produit (mêmes règles que opso-groupement.js) ──
  var _prodIndex = null, _prodIndexBuilt = false;
  function prodIndex() {
    if (_prodIndexBuilt) return _prodIndex;
    var PS = (window.PROD_STATS && window.PROD_STATS.length) ? window.PROD_STATS : null;
    if (!PS) return null;
    _prodIndex = {}; PS.forEach(function (r) { var c = normCip(r.c); if (c && !_prodIndex[c]) _prodIndex[c] = r; });
    _prodIndexBuilt = true;
    return _prodIndex;
  }
  var _benchIndex = null;
  function nomBench(code) {
    var B = window.BENCHMARK;
    if (!B || !B.length) return '';
    if (!_benchIndex) { _benchIndex = {}; B.forEach(function (r) { var c = normCip(r && r.cip13); if (c && !_benchIndex[c]) _benchIndex[c] = r.designation || ''; }); }
    return _benchIndex[normCip(code)] || '';
  }
  function nomProduit(code, fallbackDesignation) {
    if (fallbackDesignation) return fallbackDesignation;
    var idx = prodIndex();
    var info = idx && idx[normCip(code)];
    return (info && info.d) || nomBench(code) || ('CIP ' + code);
  }

  // ── Base réseau : réutilise EXACTEMENT le calcul de opso-groupement.js ──
  function netBase() {
    if (V2.opsoGroupement && V2.opsoGroupement.computeData) return V2.opsoGroupement.computeData();
    // Repli minimal si le module n'est pour une raison quelconque pas chargé
    // (ne devrait jamais arriver côté OPSO — il est chargé avant celui-ci).
    return { adherentes: (V2.pharmacies || []).length, pharmaClientes: 0, total: 0, mois: [], nextAbrev: null, periode: '' };
  }

  function periodeTxt(NB) {
    return NB.periode + (NB.nextAbrev ? ' · ' + NB.nextAbrev.charAt(0).toUpperCase() + NB.nextAbrev.slice(1) + ' en attente' : '');
  }

  // ═══════════════════════════════════════════════════════════════
  // ÉCRAN 1 — PHARMACIES (liste + fiche par officine)
  // ═══════════════════════════════════════════════════════════════
  var phSearch = '';

  // Agrège V2.sales par pharmacie : total, dernier mois, mois précédent (sur
  // le calendrier RÉSEAU — un mois sans achat compte pour 0, pas « absent »),
  // nb de produits distincts.
  function computePharmaRows(NB) {
    var sales = V2.sales || [];
    var mois = NB.mois || [];
    var lastKey = mois.length ? (mois[mois.length - 1].y * 12 + mois[mois.length - 1].m) : null;
    var prevKey = mois.length > 1 ? (mois[mois.length - 2].y * 12 + mois[mois.length - 2].m) : null;

    var byPh = {};
    sales.forEach(function (s) {
      var id = String(s.pharmacyId);
      if (!byPh[id]) byPh[id] = { total: 0, lastCa: 0, prevCa: 0, produits: {} };
      var b = byPh[id];
      b.total += (s.mntNetHt || 0);
      if (s.artCode && ((s.mntNetHt || 0) > 0 || (s.qte || 0) > 0)) b.produits[s.artCode] = 1;
      if (s.year && s.month) {
        var k = s.year * 12 + s.month;
        if (lastKey != null && k === lastKey) b.lastCa += (s.mntNetHt || 0);
        if (prevKey != null && k === prevKey) b.prevCa += (s.mntNetHt || 0);
      }
    });

    var rows = (V2.pharmacies || []).map(function (p) {
      var b = byPh[String(p.id)] || { total: 0, lastCa: 0, prevCa: 0, produits: {} };
      return {
        p: p, total: b.total, lastCa: b.lastCa, prevCa: b.prevCa,
        nbProduits: Object.keys(b.produits).length,
        cliente: b.total > 0
      };
    });
    return rows;
  }

  function renderPharmaciesList(root) {
    injectAchStyle();
    var NB = netBase();
    var rows = computePharmaRows(NB);
    var clientes = rows.filter(function (r) { return r.cliente; }).sort(function (a, b) { return b.total - a.total; });
    var potentiel = rows.filter(function (r) { return !r.cliente; }).sort(function (a, b) { return a.p.name.localeCompare(b.p.name, 'fr'); });

    var q = fold(phSearch);
    function match(r) { return !q || fold(r.p.name).indexOf(q) >= 0 || fold(r.p.ville).indexOf(q) >= 0; }
    var clientesF = clientes.filter(match), potentielF = potentiel.filter(match);

    function row(r) {
      var deltaTxt = '';
      if (r.prevCa > 0) deltaTxt = '<span class="v2-row-meta">' + pct1((r.lastCa - r.prevCa) / r.prevCa * 100) + ' vs mois préc.</span>';
      else if (r.lastCa > 0) deltaTxt = '<span class="v2-row-meta">nouveau ce mois-ci</span>';
      return '<a class="v2-row" onclick="V2.go(\'opsopharmacies\',\'' + esc(r.p.id) + '\')">' +
        '<span class="v2-row-dot" style="background:' + esc(r.p.color || '#11a63c') + '"></span>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="v2-row-name">' + esc(r.p.name) + '</div>' +
          '<div class="v2-row-meta">' + esc(r.p.ville || '') + (r.p.code ? ' · CIP ' + esc(r.p.code) : '') + ' · ' + r.nbProduits + ' produit' + (r.nbProduits > 1 ? 's' : '') + '</div>' +
        '</div>' +
        (r.cliente ? '<div style="text-align:right">' + '<span class="v2-row-val">' + euros(r.total) + '</span>' + deltaTxt + '</div>' : '<span class="v2-row-meta">Sans achat — potentiel</span>') +
        '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
    }

    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page">' +
        '<div class="v2-page-title">Pharmacies</div>' +
        '<div class="v2-page-sub">Les officines du réseau OPSO Santé et leur évolution d\'achats chez Intégral Pharma, mois par mois. ' +
          NB.pharmaClientes + ' clientes sur ' + NB.adherentes + ' adhérentes · ' + esc(periodeTxt(NB)) + '.</div>' +
        '<input class="v2-field" type="search" placeholder="Chercher une pharmacie, une ville…" value="' + esc(phSearch) + '" oninput="V2.opsoPhSearch(this.value)" style="margin-bottom:18px">' +
        '<div class="v2-card"><div class="v2-card-head"><span class="v2-card-t">Clientes · les plus gros acheteurs en tête (' + clientesF.length + ')</span></div>' +
          (clientesF.length ? clientesF.map(row).join('') : '<div class="v2-empty"><div class="v2-empty-t">Aucun résultat</div></div>') +
        '</div>' +
        (potentielF.length ? '<div class="v2-card" style="margin-top:16px"><div class="v2-card-head"><span class="v2-card-t">Adhérentes sans achat — potentiel (' + potentielF.length + ')</span></div>' +
          potentielF.map(row).join('') +
        '</div>' : '') +
      '</div>';
  }

  function renderPharmaciesFiche(root, id) {
    injectAchStyle();
    var NB = netBase();
    var p = (V2.pharmacies || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p) { renderPharmaciesList(root); return; }
    var salesP = (V2.sales || []).filter(function (s) { return String(s.pharmacyId) === String(id); });
    var mois = NB.mois || [];
    var lastKey = mois.length ? (mois[mois.length - 1].y * 12 + mois[mois.length - 1].m) : null;
    var prevKey = mois.length > 1 ? (mois[mois.length - 2].y * 12 + mois[mois.length - 2].m) : null;
    var total = 0, lastCa = 0, prevCa = 0, produits = {};
    salesP.forEach(function (s) {
      total += (s.mntNetHt || 0);
      if (s.artCode && ((s.mntNetHt || 0) > 0 || (s.qte || 0) > 0)) produits[s.artCode] = 1;
      if (s.year && s.month) {
        var k = s.year * 12 + s.month;
        if (lastKey != null && k === lastKey) lastCa += (s.mntNetHt || 0);
        if (prevKey != null && k === prevKey) prevCa += (s.mntNetHt || 0);
      }
    });
    var cliente = total > 0;

    // Produits phares : top 5 CA de cette pharmacie
    var byProd = {};
    salesP.forEach(function (s) {
      if (!s.artCode) return;
      if (!byProd[s.artCode]) byProd[s.artCode] = { d: s.artDesignation || '', ca: 0, boites: 0 };
      if (s.artDesignation) byProd[s.artCode].d = s.artDesignation;
      byProd[s.artCode].ca += (s.mntNetHt || 0);
      byProd[s.artCode].boites += (s.qte || 0);
    });
    var top5 = Object.keys(byProd).map(function (c) { return { c: c, d: byProd[c].d, ca: byProd[c].ca, boites: byProd[c].boites }; })
      .filter(function (x) { return x.ca > 0; })
      .sort(function (a, b) { return b.ca - a.ca; }).slice(0, 5);

    var chart = (V2.build13MonthChart && salesP.length) ? V2.build13MonthChart(salesP) : null;

    var deltaHtmlSafe = V2.deltaHtml ? V2.deltaHtml(lastCa, prevCa, mois.length > 1 ? MOIS_PLEIN[mois[mois.length - 2].m - 1] : 'préc.', prevKey != null) : '';

    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page">' +
        '<div class="v2-page-title">' + esc(p.name) + '</div>' +
        '<div class="v2-page-sub">' + esc(p.ville || '') + (p.cp ? ' (' + esc(p.cp) + ')' : '') + (p.code ? ' · CIP ' + esc(p.code) : '') + ' · Réseau OPSO Santé' + (cliente ? ' · cliente' : ' · adhérente sans achat (potentiel)') + '</div>' +
        '<div class="v2-kpis">' +
          '<div class="v2-kpi k1"><div class="v2-kpi-l">Cumul chez Intégral Pharma</div><div class="v2-kpi-v mono">' + euros(total) + '</div><div class="v2-kpi-d" style="color:var(--muted)">' + esc(periodeTxt(NB)) + '</div></div>' +
          '<div class="v2-kpi k2"><div class="v2-kpi-l">Dernier mois</div><div class="v2-kpi-v mono">' + euros(lastCa) + '</div>' + deltaHtmlSafe + '</div>' +
          '<div class="v2-kpi k3"><div class="v2-kpi-l">Produits distincts commandés</div><div class="v2-kpi-v mono">' + Object.keys(produits).length + '</div></div>' +
          '<div class="v2-kpi k4"><div class="v2-kpi-l">Statut</div><div class="v2-kpi-v" style="font-size:16px">' + (cliente ? 'Cliente' : 'Potentiel') + '</div></div>' +
        '</div>' +
        '<div class="v2-card" style="padding:18px 20px 8px">' +
          '<div class="v2-card-head" style="padding:0 0 8px"><span class="v2-card-t">Évolution mensuelle des achats</span></div>' +
          (chart ? chart.html : '<div class="v2-empty"><div class="v2-empty-t">Aucun achat enregistré</div><div class="v2-empty-d">Cette officine n\'a pas encore commandé chez Intégral Pharma.</div></div>') +
        '</div>' +
        (top5.length ? '<div class="v2-card" style="margin-top:16px"><div class="v2-card-head"><span class="v2-card-t">Produits phares</span></div>' +
          top5.map(function (x, i) {
            return '<div class="v2-row" style="cursor:default">' +
              '<span class="mono" style="color:var(--muted);width:18px;flex:none">' + (i + 1) + '</span>' +
              '<div style="flex:1;min-width:0"><div class="v2-row-name">' + esc(nomProduit(x.c, x.d)) + '</div></div>' +
              '<div style="text-align:right"><span class="v2-row-val">' + euros(x.ca) + '</span><div class="v2-row-meta">' + Math.round(x.boites) + ' boîte' + (Math.round(x.boites) > 1 ? 's' : '') + '</div></div>' +
            '</div>';
          }).join('') +
        '</div>' : '') +
      '</div>';
    if (chart && chart.bind) chart.bind(root);
  }

  V2.opsoPhSearch = function (val) {
    phSearch = val || '';
    var r = root$(); if (r && V2.route && V2.route.name === 'opsopharmacies' && !V2.route.param) renderPharmaciesList(r);
  };

  V2.pages.opsopharmacies = {
    needs: [],
    render: function (root, param) {
      if (param) renderPharmaciesFiche(root, param);
      else renderPharmaciesList(root);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ÉCRAN 2 — MEILLEURS ACHATS (liste produits, classée par nb de pharmacies)
  // ═══════════════════════════════════════════════════════════════
  var achTab = 'all', achSearch = '', achShown = 60;
  var _achCache = null;

  function computeAchats(NB) {
    if (_achCache) return _achCache;
    var sales = V2.sales || [];
    var mois = NB.mois || [];
    var lastKey = mois.length ? (mois[mois.length - 1].y * 12 + mois[mois.length - 1].m) : null;
    var prevKey = mois.length > 1 ? (mois[mois.length - 2].y * 12 + mois[mois.length - 2].m) : null;

    var byProduct = {};
    sales.forEach(function (s) {
      if (!s.artCode) return;
      if (!byProduct[s.artCode]) byProduct[s.artCode] = { d: '', ca: 0, boites: 0, pharmaSet: {}, lastCa: 0, prevCa: 0 };
      var p = byProduct[s.artCode];
      if (s.artDesignation) p.d = s.artDesignation;
      p.ca += (s.mntNetHt || 0);
      p.boites += (s.qte || 0);
      if ((s.mntNetHt || 0) > 0 || (s.qte || 0) > 0) p.pharmaSet[s.pharmacyId] = 1;
      if (s.year && s.month) {
        var k = s.year * 12 + s.month;
        if (lastKey != null && k === lastKey) p.lastCa += (s.mntNetHt || 0);
        if (prevKey != null && k === prevKey) p.prevCa += (s.mntNetHt || 0);
      }
    });

    var idx = prodIndex();
    var items = Object.keys(byProduct).map(function (code) {
      var p = byProduct[code];
      var n = Object.keys(p.pharmaSet).length;
      if (!n) return null;
      var info = idx && idx[normCip(code)];
      var cat = 'x';
      if (info && CAT_LABELS[info.f]) { cat = info.f; if (cat === 'pr_high' && info.ppht > 3000) cat = 'tch'; }
      return { code: code, d: nomProduit(code, p.d), n: n, ca: p.ca, boites: Math.round(p.boites), cat: cat, lastCa: p.lastCa, prevCa: p.prevCa };
    }).filter(Boolean);
    items.sort(function (a, b) { return b.n - a.n || b.ca - a.ca; });

    var byCat = {};
    CAT_ORDER.forEach(function (k) { byCat[k] = 0; });
    items.forEach(function (it) { byCat[it.cat] = (byCat[it.cat] || 0) + 1; });

    _achCache = { items: items, byCat: byCat, hasCat: !!idx };
    return _achCache;
  }

  function csvCell(s) { s = String(s == null ? '' : s); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

  V2.opsoAchExport = function () {
    var NB = netBase();
    var D = computeAchats(NB);
    var list = achFiltered(D);
    var head = ['Produit', 'CIP', 'Categorie', 'Pharmacies clientes', 'Sur adherentes', 'Boites', 'CA EUR HT'];
    var lines = [head.join(';')];
    list.forEach(function (it) {
      lines.push([csvCell(it.d), it.code, csvCell(CAT_LABELS[it.cat] || ''), it.n, NB.pharmaClientes, it.boites, Math.round(it.ca)].join(';'));
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'opso_meilleurs_achats.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  function achFiltered(D) {
    var q = fold(achSearch);
    return D.items.filter(function (it) {
      if (achTab !== 'all' && it.cat !== achTab) return false;
      if (q && fold(it.d).indexOf(q) < 0 && it.code.indexOf(achSearch.trim()) < 0) return false;
      return true;
    });
  }

  function renderAchats(root) {
    var NB = netBase();
    var D = computeAchats(NB);
    var list = achFiltered(D);
    var shown = list.slice(0, achShown);

    var tabsHtml = '<button class="v2-tab' + (achTab === 'all' ? ' on' : '') + '" onclick="V2.opsoAchTab(\'all\')">Tous (' + D.items.length + ')</button>' +
      (D.hasCat ? CAT_ORDER.filter(function (k) { return D.byCat[k] > 0; }).map(function (k) {
        return '<button class="v2-tab' + (achTab === k ? ' on' : '') + '" onclick="V2.opsoAchTab(\'' + k + '\')">' + esc(CAT_LABELS[k]) + ' (' + D.byCat[k] + ')</button>';
      }).join('') : '');

    function gaugeRow(it, idx2) {
      var pct = NB.pharmaClientes ? Math.min(100, Math.round(it.n / NB.pharmaClientes * 100)) : 0;
      var evo = '';
      if (it.prevCa > 0) evo = '<span class="opf-evo ' + (it.lastCa >= it.prevCa ? 'up' : 'dn') + '">' + pct1((it.lastCa - it.prevCa) / it.prevCa * 100) + '</span>';
      return '<div class="v2-row" style="cursor:default">' +
        '<span class="mono" style="color:var(--muted);width:22px;flex:none">' + (idx2 + 1) + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="v2-row-name">' + esc(it.d) + '</div>' +
          '<div class="opf-gauge-row"><span class="opf-gauge"><span class="opf-gauge-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="v2-row-meta">' + it.n + ' / ' + NB.pharmaClientes + ' pharmacies</span>' + evo + '</div>' +
        '</div>' +
        '<div style="text-align:right"><span class="v2-row-val">' + euros(it.ca) + '</span><div class="v2-row-meta">' + it.boites + ' boîte' + (it.boites > 1 ? 's' : '') + '</div></div>' +
      '</div>';
    }

    injectAchStyle();
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page">' +
        '<div class="v2-page-title">Meilleurs achats</div>' +
        '<div class="v2-page-sub">Les produits que les pharmacies OPSO commandent chez Intégral Pharma, classés par NOMBRE DE PHARMACIES qui les commandent (puis par quantités et CA). ' +
          (D.hasCat ? '' : 'Catégories en cours de chargement… ') + esc(periodeTxt(NB)) + '.</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
          '<input class="v2-field" style="flex:1;min-width:220px" type="search" placeholder="Chercher un produit, un CIP…" value="' + esc(achSearch) + '" oninput="V2.opsoAchSearch(this.value)">' +
          '<button class="v2-btn" onclick="V2.opsoAchExport()">' + ICO('download', 16) + ' Exporter (CSV)</button>' +
        '</div>' +
        '<div class="v2-tabs" style="overflow-x:auto;margin-bottom:14px">' + tabsHtml + '</div>' +
        '<div class="v2-card"><div class="v2-card-head"><span class="v2-card-t">' + list.length + ' référence' + (list.length > 1 ? 's' : '') + '</span></div>' +
          (shown.length ? shown.map(gaugeRow).join('') : '<div class="v2-empty"><div class="v2-empty-t">Aucun résultat</div></div>') +
        '</div>' +
        (list.length > shown.length ? '<div style="text-align:center;margin-top:16px"><button class="v2-btn" onclick="V2.opsoAchMore()">Voir plus (' + (list.length - shown.length) + ' de plus)</button></div>' : '') +
      '</div>';

    // PROD_STATS pas encore en mémoire : re-tente la catégorisation (comme
    // opso-groupement.js), sans effacer la liste déjà affichée entre-temps.
    if (!D.hasCat) {
      var tries = 0;
      (function poll() {
        tries++;
        if (window.PROD_STATS && window.PROD_STATS.length) { _achCache = null; if (V2.route && V2.route.name === 'opsoachats') renderAchats(root$()); return; }
        if (tries < 12) setTimeout(poll, 700);
      })();
    }
  }

  V2.opsoAchSearch = function (val) { achSearch = val || ''; achShown = 60; var r = root$(); if (r) renderAchats(r); };
  V2.opsoAchTab = function (k) { achTab = k; achShown = 60; var r = root$(); if (r) renderAchats(r); };
  V2.opsoAchMore = function () { achShown += 60; var r = root$(); if (r) renderAchats(r); };

  V2.pages.opsoachats = { needs: [], render: renderAchats };

  function injectAchStyle() {
    if (document.getElementById('opf-style')) return;
    var st = document.createElement('style'); st.id = 'opf-style';
    st.textContent = ''
      + '.opf-gauge-row{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap}'
      + '.opf-gauge{flex:0 1 130px;height:5px;background:var(--surf-sunken,#F4F6FB);border-radius:999px;overflow:hidden}'
      + '.opf-gauge-fill{display:block;height:100%;background:var(--ip-blue,#11a63c);border-radius:999px}'
      + '.opf-evo{font-size:13px;font-weight:600}'
      + '.opf-evo.up{color:var(--c-mint,#0d8530)}'
      + '.opf-evo.dn{color:var(--muted,#646B80)}'
      // 29/09/2026 — règle du brief « aucun texte < 13 px » : .v2-row-meta et
      // .v2-kpi-l/.v2-kpi-d (classes GÉNÉRIQUES de v2.css, à 12px partout dans
      // l'appli, sur des dizaines d'écrans déjà en ligne) ne sont PAS touchées
      // dans v2.css — ça régresserait tout le reste de l'app. Le correctif est
      // scopé aux deux écrans de ce module (.opf-page), chirurgical.
      + '.opf-page .v2-row-meta,.opf-page .v2-kpi-l,.opf-page .v2-kpi-d{font-size:13px}';
    document.head.appendChild(st);
  }
})();
