// benchmark-focus.js — Focus produits par categorie, opportunites basees sur ventes IP National
// Expose : window.buildProductFocusByCategoryHtml()
//
// Vue centrale de la page Benchmark : pour chaque famille IP, top 15 produits
// qui se vendent dans IP National (OPS+CPR+HP) avec mon statut sur chacun.
// Permet de detecter les leads (ABSENT / FAIBLE) par categorie produit.

(function () {
  'use strict';

  // ───────── helpers ─────────────────────────────────────────────────
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
  var TOP_PER_FAMILLE = 15;

  // ───────── caches ──────────────────────────────────────────────────
  var __myCaByArtcode = null;
  function getMyCaByArtcode() {
    if (__myCaByArtcode) return __myCaByArtcode;
    var out = {};
    var cp = window.CLIENT_PRODUCTS || {};
    for (var cip in cp) {
      var arr = cp[cip] || [];
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        out[p.artcode] = (out[p.artcode] || 0) + (p.ca || 0);
      }
    }
    __myCaByArtcode = out;
    return out;
  }

  var __ipNationalByFamille = null;
  function getIpNationalByFamille() {
    if (__ipNationalByFamille) return __ipNationalByFamille;
    var ops = window.OPS_AGGREGATE || {};
    var cpr = window.CPR_AGGREGATE || {};
    var hp  = window.HP_AGGREGATE  || {};

    // Fusion par artcode : ca + qte + repartition par etablissement (single-pass par source)
    // Map au lieu d'objet : itération + lookup plus rapides sur 15k+ entrées
    var fused = new Map();
    function add(src, key) {
      for (var code in src) {
        var p = src[code];
        var ca = p.ca || 0;
        var existing = fused.get(code);
        if (!existing) {
          existing = {
            artcode: code, ean: p.ean, designation: p.designation, marque: p.marque,
            nature: p.nature, sousfamille: p.sousfamille, collection: p.collection,
            afmcode: p.afmcode, ca: 0, qte: 0,
            byEst: { ops: 0, cpr: 0, hp: 0 },
          };
          fused.set(code, existing);
        }
        existing.ca += ca;
        existing.qte += p.qte || 0;
        existing.byEst[key] += ca;
      }
    }
    add(ops, 'ops'); add(cpr, 'cpr'); add(hp, 'hp');

    // Regroupe par famille (single-pass via Map.forEach, evite ré-itération via for..in)
    var byFam = {};
    for (var f = 0; f < FAMILLES.length; f++) byFam[FAMILLES[f]] = [];
    fused.forEach(function (prod) {
      var fam = familleFromAttrs(prod.nature, prod.afmcode, prod.sousfamille);
      byFam[fam].push(prod);
    });
    // Trie chaque famille par CA decroissant (n log n par famille)
    var sortFn = function (a, b) { return b.ca - a.ca; };
    for (var ff = 0; ff < FAMILLES.length; ff++) {
      byFam[FAMILLES[ff]].sort(sortFn);
    }
    __ipNationalByFamille = byFam;
    return byFam;
  }

  // ───────── rendu ────────────────────────────────────────────────────
  function statusFromPdm(pdm, isPresent) {
    if (!isPresent) return { label: 'ABSENT',  col: '#FF3B30', bg: 'rgba(255,59,48,.08)' };
    if (pdm < 1)    return { label: 'FAIBLE',  col: '#FF9500', bg: 'rgba(255,149,0,.08)' };
    if (pdm < 10)   return { label: 'OK',      col: '#0057FF', bg: 'rgba(0,87,255,.08)' };
    return            { label: 'FORT',    col: '#34C759', bg: 'rgba(52,199,89,.08)' };
  }

  function buildFamilleSection(famille, products, myCaMap, statsOut) {
    if (!products.length) return '';
    var color = FAMILLE_COLORS[famille] || '#0057FF';
    var topLen = Math.min(TOP_PER_FAMILLE, products.length);

    // Single-pass : total famille + top top CA + counts statuts + rows HTML
    // Au lieu de 4 traversees distinctes (reduce x2, count loop, map). totalFamCa garde la passe complete famille (necessaire pour topPct).
    var totalFamCa = 0;
    for (var pi = 0; pi < products.length; pi++) totalFamCa += products[pi].ca;

    var topFamCa = 0;
    var absentCnt = 0, faibleCnt = 0;
    var rowsParts = new Array(topLen);

    for (var k = 0; k < topLen; k++) {
      var p = products[k];
      var pCa = p.ca;
      topFamCa += pCa;

      var myCa = myCaMap[p.artcode] || 0;
      var isPresent = myCa > 0;
      var pdm = pCa > 0 ? (myCa / pCa * 100) : 0;
      var st = statusFromPdm(pdm, isPresent);
      if (!isPresent) absentCnt++;
      else if (pdm < 1) faibleCnt++;

      var be = p.byEst;
      var ops = be.ops, cpr = be.cpr, hp = be.hp;
      var maxEst = ops; if (cpr > maxEst) maxEst = cpr; if (hp > maxEst) maxEst = hp; if (maxEst < 1) maxEst = 1;
      var opsW = (ops / maxEst * 100);
      var cprW = (cpr / maxEst * 100);
      var hpW  = (hp  / maxEst * 100);

      var bg = isPresent ? '#FFFFFF' : st.bg;
      var caCol = isPresent ? '#0B1F4D' : '#CBD5E1';
      var caTxt = isPresent ? fmtEuro(myCa) : '— €';
      var pdmTxt = isPresent ? ('PdM ' + pdm.toFixed(2) + ' %') : 'aucun achat';
      var design = escapeHtml(p.designation || p.artcode);
      var marque = escapeHtml(p.marque || '—');
      var artcode = escapeHtml(p.artcode);

      rowsParts[k] =
        '<div style="padding:12px 16px;display:grid;grid-template-columns:24px 1fr 180px 110px 90px;gap:14px;align-items:center;border-bottom:1px solid rgba(60,60,67,0.12);background:' + bg + '">' +
        '<span style="color:#94A3B8;font-weight:800;font-size:13px;font-variant-numeric:tabular-nums">' + (k + 1) + '</span>' +
        '<div style="min-width:0">' +
        '<div style="font-weight:700;color:#0B1F4D;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + design + '</div>' +
        '<div style="font-size:10.5px;color:#94A3B8;margin-top:2px">' + marque + ' · CIP ' + artcode + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:2px;font-size:9.5px;color:#64748B;line-height:1.3">' +
        '<div style="display:flex;align-items:center;gap:4px"><span style="width:10px;font-weight:700;color:#0057FF">O</span><div style="flex:1;height:4px;background:rgba(60,60,67,0.06);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + opsW + '%;background:#0057FF"></div></div><b style="font-variant-numeric:tabular-nums;color:#0B1F4D;min-width:42px;text-align:right">' + fmtEuro(ops) + '</b></div>' +
        '<div style="display:flex;align-items:center;gap:4px"><span style="width:10px;font-weight:700;color:#7C3AED">C</span><div style="flex:1;height:4px;background:rgba(60,60,67,0.06);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + cprW + '%;background:#7C3AED"></div></div><b style="font-variant-numeric:tabular-nums;color:#0B1F4D;min-width:42px;text-align:right">' + fmtEuro(cpr) + '</b></div>' +
        '<div style="display:flex;align-items:center;gap:4px"><span style="width:10px;font-weight:700;color:#14B86A">H</span><div style="flex:1;height:4px;background:rgba(60,60,67,0.06);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + hpW + '%;background:#14B86A"></div></div><b style="font-variant-numeric:tabular-nums;color:#0B1F4D;min-width:42px;text-align:right">' + fmtEuro(hp) + '</b></div>' +
        '</div>' +
        '<div style="text-align:right">' +
        '<b style="color:' + caCol + ';font-variant-numeric:tabular-nums;font-size:13px">' + caTxt + '</b>' +
        '<div style="font-size:10.5px;color:' + st.col + ';font-weight:700;margin-top:1px">' + pdmTxt + '</div>' +
        '</div>' +
        '<span style="background:' + st.bg + ';color:' + st.col + ';padding:5px 10px;border-radius:6px;font-size:10.5px;font-weight:800;letter-spacing:.4px;text-align:center;text-transform:uppercase">' + st.label + '</span>' +
        '</div>';
    }

    if (statsOut) {
      statsOut.nbOpp += absentCnt + faibleCnt;
      statsOut.ipTotal += topFamCa;
    }

    var topPct = totalFamCa > 0 ? (topFamCa / totalFamCa * 100) : 0;
    var summaryBadges =
      '<span style="background:rgba(255,59,48,.12);color:#FF3B30;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:800">' + absentCnt + ' absent' + (absentCnt > 1 ? 's' : '') + '</span> ' +
      '<span style="background:rgba(255,149,0,.12);color:#FF9500;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:800;margin-left:4px">' + faibleCnt + ' faible' + (faibleCnt > 1 ? 's' : '') + '</span> ';

    var rows = rowsParts.join('');

    return [
      '<div style="background:#FFFFFF;border-radius:14px;padding:0;margin-bottom:16px;box-shadow:0 0 0 0.5px rgba(0,0,0,0.05),0 1px 3px rgba(0,0,0,0.06);overflow:hidden">',
      '  <div style="padding:14px 18px;background:linear-gradient(135deg,' + color + '12,' + color + '04);border-bottom:1px solid rgba(60,60,67,0.12);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">',
      '    <div style="display:flex;align-items:center;gap:10px;min-width:0">',
      '      <span style="width:14px;height:14px;border-radius:50%;background:' + color + '"></span>',
      '      <div>',
      '        <div style="font-size:17px;font-weight:800;color:#0B1F4D;letter-spacing:-.3px">' + escapeHtml(famille) + '</div>',
      '        <div style="font-size:11px;color:#64748B">Top ' + topLen + ' sur ' + fmtNum(products.length) + ' réfs · ' + fmtEuro(totalFamCa) + ' CA IP National · top = ' + topPct.toFixed(0) + '%</div>',
      '      </div>',
      '    </div>',
      '    <div>' + summaryBadges + '</div>',
      '  </div>',
      '  <div style="padding:8px 16px;background:#F2F2F7;display:grid;grid-template-columns:24px 1fr 180px 110px 90px;gap:14px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#64748B;font-weight:800">',
      '    <span>#</span><span>Produit</span><span>OPS · CPR · HP</span><span style="text-align:right">Mon CA · PdM</span><span style="text-align:right">Statut</span>',
      '  </div>',
      rows,
      '</div>'
    ].join('');
  }

  // ───────── entry point ──────────────────────────────────────────────
  window.buildProductFocusByCategoryHtml = function () {
    try {
      if (!window.OPS_AGGREGATE || !window.CPR_AGGREGATE || !window.HP_AGGREGATE) return '';

      var byFam = getIpNationalByFamille();
      var myCa = getMyCaByArtcode();

      // Construit les sections d'abord en aggregeant nbOpp via statsOut (single-pass au lieu de re-iterer le top)
      var stats = { nbOpp: 0, ipTotal: 0 };
      var sectionsParts = new Array(FAMILLES.length);
      for (var sf = 0; sf < FAMILLES.length; sf++) {
        sectionsParts[sf] = buildFamilleSection(FAMILLES[sf], byFam[FAMILLES[sf]] || [], myCa, stats);
      }
      var sections = sectionsParts.join('');
      var nbOpp = stats.nbOpp;

      // Header explicatif (concis)
      var header = [
        '<div style="background:#FFFFFF;border-radius:14px;padding:18px 20px;margin-bottom:16px;box-shadow:0 0 0 0.5px rgba(0,0,0,0.05),0 1px 3px rgba(0,0,0,0.06)">',
        '  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px">',
        '    <div>',
        '      <h2 style="margin:0;font-size:22px;font-weight:800;color:#0B1F4D;letter-spacing:-.4px">Focus produits par catégorie</h2>',
        '      <div style="font-size:13px;color:#64748B;margin-top:4px">Top ' + TOP_PER_FAMILLE + ' produits qui se vendent dans IP National (OPS + CPR + HP) · mon statut sur chaque produit</div>',
        '    </div>',
        '    <div style="text-align:right">',
        '      <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Opportunités détectées</div>',
        '      <div style="font-size:26px;font-weight:800;color:#FF9500;font-variant-numeric:tabular-nums">' + nbOpp + '<span style="font-size:14px;color:#94A3B8"> / ' + (TOP_PER_FAMILLE * 6) + '</span></div>',
        '      <div style="font-size:11px;color:#94A3B8">produits ABSENT ou FAIBLE</div>',
        '    </div>',
        '  </div>',
        '  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid rgba(60,60,67,0.12);font-size:11.5px;color:#64748B">',
        '    <span><b style="color:#FF3B30">●</b> ABSENT : 0 € chez moi · à recruter en visite</span>',
        '    <span><b style="color:#FF9500">●</b> FAIBLE : PdM < 1% · sous-pénétré</span>',
        '    <span><b style="color:#0057FF">●</b> OK : PdM 1-10%</span>',
        '    <span><b style="color:#34C759">●</b> FORT : PdM > 10% · fidèle</span>',
        '  </div>',
        '</div>'
      ].join('');

      return header + sections;
    } catch (e) {
      console.warn('[buildProductFocusByCategoryHtml]', e);
      return '';
    }
  };
})();
