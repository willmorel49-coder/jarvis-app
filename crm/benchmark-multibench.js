// benchmark-multibench.js — Comparatif Mon secteur vs 3 etablissements IP
// Expose : window.buildMultiBenchHtml() -> string HTML
// Appel depuis crm/classic-overrides.js (page Benchmark, en tete).

(function () {
  'use strict';

  // ───────── helpers locaux (auto-suffisants) ──────────────────────────
  function fmtEuro(n) {
    if (!n) return '0 €';
    var abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + ' M€';
    if (abs >= 1e3) return Math.round(n / 1e3) + ' k€';
    return Math.round(n) + ' €';
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString('fr-FR'); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function familleFromAttrs(nature, afmcode, sousfamille) {
    var n = (nature || '').trim();
    var a = (afmcode || '').trim().toUpperCase();
    var sf = (sousfamille || '').toLowerCase();
    if (n === 'Biosimilaire') return 'Biosimilaires';
    if (sf.indexOf('froid') >= 0) return 'Froid';
    if (a && a !== 'REMBSS' && a !== '#N/A') return 'Non remboursés';
    if (n === 'Generique Partenaire') return 'Gén. partenaires';
    if (n === 'Generique') return 'Génériques';
    return 'Princeps';
  }

  var FAMILLES = ['Froid', 'Biosimilaires', 'Génériques', 'Gén. partenaires', 'Non remboursés', 'Princeps'];
  var FAMILLE_COLORS = {
    'Froid': '#00B5D8', 'Biosimilaires': '#7C3AED', 'Génériques': '#94A3B8',
    'Gén. partenaires': '#14B86A', 'Non remboursés': '#FF9F1C', 'Princeps': '#0057FF',
  };

  // Cache memoise — calculer le mix par famille pour chaque etablissement une seule fois
  var __mixCache = {};
  function computeMixByFamille(aggregate) {
    var fams = { 'Froid': 0, 'Biosimilaires': 0, 'Génériques': 0, 'Gén. partenaires': 0, 'Non remboursés': 0, 'Princeps': 0 };
    var total = 0;
    if (!aggregate) return { fams: fams, total: 0 };
    for (var code in aggregate) {
      var p = aggregate[code];
      var fam = familleFromAttrs(p.nature, p.afmcode, p.sousfamille);
      fams[fam] = (fams[fam] || 0) + (p.ca || 0);
      total += p.ca || 0;
    }
    return { fams: fams, total: total };
  }
  function getMix(key) {
    if (__mixCache[key]) return __mixCache[key];
    var agg = window[key + '_AGGREGATE'];
    __mixCache[key] = computeMixByFamille(agg);
    return __mixCache[key];
  }

  // Mix Will calcule depuis SALES_BY_FAMILLE
  function getMixWill() {
    var sf = window.SALES_BY_FAMILLE || {};
    var fams = { 'Froid': 0, 'Biosimilaires': 0, 'Génériques': 0, 'Gén. partenaires': 0, 'Non remboursés': 0, 'Princeps': 0 };
    var total = 0;
    for (var f in fams) {
      var v = (sf[f] && sf[f].ca) || 0;
      fams[f] = v;
      total += v;
    }
    return { fams: fams, total: total };
  }

  // Top 5 produits qui SE RECOUVRENT a la fois aux 3 etablissements
  function getTop5CommonProducts() {
    var ops = window.OPS_AGGREGATE || {};
    var cpr = window.CPR_AGGREGATE || {};
    var hp = window.HP_AGGREGATE || {};
    var union = {};
    var keys = Object.keys(ops);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (cpr[k] && hp[k]) {
        var totalCa = (ops[k].ca || 0) + (cpr[k].ca || 0) + (hp[k].ca || 0);
        union[k] = { code: k, designation: ops[k].designation, marque: ops[k].marque,
                     ops: ops[k].ca || 0, cpr: cpr[k].ca || 0, hp: hp[k].ca || 0, total: totalCa };
      }
    }
    var arr = Object.keys(union).map(function (k) { return union[k]; });
    arr.sort(function (a, b) { return b.total - a.total; });
    return arr.slice(0, 10);
  }

  // ───────── rendu principal ──────────────────────────────────────────
  window.buildMultiBenchHtml = function () {
    try {
      var hasMulti = window.OPS_TOTAL && window.CPR_TOTAL && window.HP_TOTAL;
      if (!hasMulti) return '';

      var myTotal = (window.SALES_TOTAL && window.SALES_TOTAL.ca) || 0;
      var willMix = getMixWill();

      var benches = [
        { key: 'OPS', label: 'OPS Nantes', color: '#0057FF' },
        { key: 'CPR', label: 'CPR',        color: '#7C3AED' },
        { key: 'HP',  label: 'HP',         color: '#14B86A' },
      ];

      // Cards KPI etablissements (header)
      var headerCards = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px">';
      // Card Will (premiere)
      headerCards += [
        '<div style="background:linear-gradient(135deg,#0057FF,#5856D6);color:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 0 0 0.5px rgba(0,87,255,.3),0 6px 20px rgba(0,87,255,.25)">',
        '  <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.78);font-weight:800">Mon secteur</div>',
        '  <div style="font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;margin:4px 0">' + fmtEuro(myTotal) + '</div>',
        '  <div style="font-size:11px;color:rgba(255,255,255,.78)">' + fmtNum((window.SALES_TOTAL || {}).factures || 0) + ' factures · 8 dpts</div>',
        '</div>'
      ].join('');
      // 3 cards etablissements
      for (var i = 0; i < benches.length; i++) {
        var b = benches[i];
        var T = window[b.key + '_TOTAL'] || {};
        var poidsWill = T.ca > 0 ? (myTotal / T.ca * 100) : 0;
        headerCards += [
          '<div style="background:#FFFFFF;border-radius:14px;padding:16px 18px;box-shadow:0 0 0 0.5px rgba(0,0,0,0.05),0 1px 3px rgba(0,0,0,0.06);border-left:4px solid ' + b.color + '">',
          '  <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800">Établissement ' + escapeHtml(b.label) + '</div>',
          '  <div style="font-size:24px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums;margin:4px 0">' + fmtEuro(T.ca || 0) + '</div>',
          '  <div style="font-size:11px;color:#94A3B8">' + fmtNum(T.nb_produits || 0) + ' réfs · ' + fmtNum(T.nb_labos || 0) + ' labos</div>',
          '  <div style="font-size:11px;color:' + b.color + ';font-weight:700;margin-top:2px">Mon poids : ' + poidsWill.toFixed(1) + ' %</div>',
          '</div>'
        ].join('');
      }
      headerCards += '</div>';

      // Mix par famille — 4 colonnes (Will + 3 etablissements)
      var mixRows = '';
      for (var fi = 0; fi < FAMILLES.length; fi++) {
        var fam = FAMILLES[fi];
        var fc = FAMILLE_COLORS[fam];
        var willPct = willMix.total > 0 ? (willMix.fams[fam] / willMix.total * 100) : 0;
        var cells = '<div style="font-size:13px;font-weight:700;color:#0B1F4D;display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:' + fc + '"></span>' + escapeHtml(fam) + '</div>';

        // Cell Mon secteur
        cells += pctCell(willPct, fc, true);
        // 3 cells etablissements
        for (var bi = 0; bi < benches.length; bi++) {
          var b2 = benches[bi];
          var mix = getMix(b2.key);
          var pct = mix.total > 0 ? (mix.fams[fam] / mix.total * 100) : 0;
          var delta = willPct - pct;
          var deltaCol = delta > 2 ? '#14B86A' : delta < -2 ? '#FF4D6D' : '#94A3B8';
          var sign = delta > 0 ? '+' : '';
          cells += [
            '<div style="font-size:12px;color:#0B1F4D;font-variant-numeric:tabular-nums;text-align:right">',
            '  <b>' + pct.toFixed(1) + '%</b>',
            '  <div style="font-size:10px;color:' + deltaCol + ';font-weight:700">' + sign + delta.toFixed(1) + ' pts</div>',
            '</div>'
          ].join('');
        }
        mixRows += '<div style="display:grid;grid-template-columns:170px 90px 110px 110px 110px;gap:12px;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(60,60,67,0.12)">' + cells + '</div>';
      }
      function pctCell(pct, color, big) {
        var size = big ? '13px' : '12px';
        return '<div style="font-size:' + size + ';color:#0B1F4D;font-variant-numeric:tabular-nums;text-align:right"><b style="color:' + color + '">' + pct.toFixed(1) + '%</b></div>';
      }

      var mixTable = [
        '<h3 style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:16px 0 10px">Mix produit par famille · 4 vues comparatives</h3>',
        '<div style="background:#FFFFFF;border-radius:14px;padding:0;box-shadow:0 0 0 0.5px rgba(0,0,0,0.05),0 1px 3px rgba(0,0,0,0.06);overflow:hidden">',
        '  <div style="display:grid;grid-template-columns:170px 90px 110px 110px 110px;gap:12px;padding:10px 14px;background:#F2F2F7;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">',
        '    <span>Famille IP</span>',
        '    <span style="text-align:right;color:#0057FF">Mon secteur</span>',
        '    <span style="text-align:right">OPS Nantes</span>',
        '    <span style="text-align:right">CPR</span>',
        '    <span style="text-align:right">HP</span>',
        '  </div>',
        mixRows,
        '</div>'
      ].join('');

      // Top 10 produits communs aux 3 etablissements
      var topCommon = getTop5CommonProducts();
      var commonRows = '';
      for (var ti = 0; ti < topCommon.length; ti++) {
        var t = topCommon[ti];
        var maxCa = Math.max(t.ops, t.cpr, t.hp, 1);
        commonRows += [
          '<div style="display:grid;grid-template-columns:28px 1fr 100px 100px 100px;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(60,60,67,0.12);font-size:12.5px">',
          '  <span style="color:#94A3B8;font-weight:800">' + (ti + 1) + '</span>',
          '  <div style="min-width:0">',
          '    <div style="font-weight:700;color:#0B1F4D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(t.designation || t.code) + '</div>',
          '    <div style="font-size:10.5px;color:#94A3B8;margin-top:2px">' + escapeHtml(t.marque || '—') + '</div>',
          '  </div>',
          benchCellWithBar(t.ops, maxCa, '#0057FF'),
          benchCellWithBar(t.cpr, maxCa, '#7C3AED'),
          benchCellWithBar(t.hp,  maxCa, '#14B86A'),
          '</div>'
        ].join('');
      }
      function benchCellWithBar(value, max, color) {
        var w = (value / max) * 100;
        return [
          '<div style="text-align:right">',
          '  <b style="color:' + color + ';font-variant-numeric:tabular-nums;font-size:11.5px">' + fmtEuro(value) + '</b>',
          '  <div style="height:4px;background:rgba(60,60,67,0.08);border-radius:2px;overflow:hidden;margin-top:3px"><div style="height:100%;width:' + w + '%;background:' + color + '"></div></div>',
          '</div>'
        ].join('');
      }

      var topTable = topCommon.length ? [
        '<h3 style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:16px 0 10px">Top 10 produits communs · 3 etablissements compares</h3>',
        '<div style="background:#FFFFFF;border-radius:14px;padding:0;box-shadow:0 0 0 0.5px rgba(0,0,0,0.05),0 1px 3px rgba(0,0,0,0.06);overflow:hidden">',
        '  <div style="display:grid;grid-template-columns:28px 1fr 100px 100px 100px;gap:10px;padding:10px 14px;background:#F2F2F7;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">',
        '    <span>#</span>',
        '    <span>Produit</span>',
        '    <span style="text-align:right;color:#0057FF">OPS</span>',
        '    <span style="text-align:right;color:#7C3AED">CPR</span>',
        '    <span style="text-align:right;color:#14B86A">HP</span>',
        '  </div>',
        commonRows,
        '<div style="padding:10px 14px;background:#FAFBFF;font-size:11px;color:#64748B">Produits qui tournent fort dans les 3 etablissements IP · cible nationale prioritaire</div>',
        '</div>'
      ].join('') : '';

      return [
        '<h2 style="font-size:18px;font-weight:800;color:#0B1F4D;margin:0 0 12px">Vue multi-établissements · Mon secteur vs OPS / CPR / HP</h2>',
        headerCards,
        mixTable,
        topTable
      ].join('');
    } catch (e) {
      console.warn('[buildMultiBenchHtml] error', e);
      return '';
    }
  };
})();
