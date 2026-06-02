// benchmark-laboratoires.js
// Analyse "Comparatif laboratoires fabricants" du commercial William Morel
// vs benchmark sectoriel OPS Nantes.
//
// Expose : window.buildLaboratoiresComparisonHtml() -> string HTML self-contained.
// Appelée par crm/classic-overrides.js sur la page Benchmark.
//
// Objectif analytique : révéler les angles morts du portefeuille labo de Will.
//   - Bloc 1 : Top 20 mes labos vs OPS (mix, PdM, indice, famille dominante)
//   - Bloc 2 : Top 10 labos OPS où Will est ABSENT ou très en retard
//     (CA OPS > 50 k€ et mon CA < 5 k€) — leviers de prospection
//   - Bloc 3 : Matrice 6 familles IP × top 5 labos Will (qui pousse quoi)
//
// Méthode :
//   * Normalisation labo : strict d'abord, puis casefold+trim, puis stripping
//     des suffixes "FRANCE / SAS / SA / LABORATOIRES" pour la clé de match,
//     mais on garde TOUJOURS le nom original côté affichage Will.
//   * Indice mix /100 = (myPctPortefeuille / opsPctMarche) × 100
//   * Manque à gagner labo = (CA OPS labo / CA total OPS) × CA total Will − Mon CA actuel
//     -> représente ce que je ferais sur ce labo si mon mix collait à OPS Nantes.

(function () {
  'use strict';

  // ───────── Helpers self-contained ─────────────────────────────────────────
  function fmtEuroPlain(n) {
    var v = Math.round(Number(n) || 0);
    return v.toLocaleString('fr-FR') + ' €';
  }
  function fmtEuro(n) {
    if (!n && n !== 0) return '—';
    var num = Number(n) || 0;
    var abs = Math.abs(num);
    if (abs >= 1e6) return (num / 1e6).toFixed(2).replace('.', ',') + ' M€';
    if (abs >= 1000) return Math.round(num / 1000).toLocaleString('fr-FR') + ' k€';
    return Math.round(num).toLocaleString('fr-FR') + ' €';
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString('fr-FR'); }
  function fmtPct(n, d) { d = d == null ? 1 : d; return (Number(n) || 0).toFixed(d).replace('.', ',') + ' %'; }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ───────── Constantes design ──────────────────────────────────────────────
  var FAMILLES = ['Froid', 'Biosimilaires', 'Génériques', 'Gén. partenaires', 'Non remboursés', 'Princeps'];
  var FAMILLE_COLORS = {
    'Froid': '#00B5D8',
    'Biosimilaires': '#7C3AED',
    'Génériques': '#94A3B8',
    'Gén. partenaires': '#14B86A',
    'Non remboursés': '#FF9F1C',
    'Princeps': '#0057FF'
  };

  // Indice mix / 100 → label coloré
  function indiceLabel(idx) {
    if (idx >= 150) return { txt: 'Sur-indexé', col: '#14B86A' };
    if (idx >= 80)  return { txt: 'Aligné',     col: '#0057FF' };
    if (idx >= 40)  return { txt: 'Sous-indexé', col: '#FF9F1C' };
    return                { txt: 'Très sous-indexé', col: '#FF4D6D' };
  }

  // ───────── Normalisation labo ─────────────────────────────────────────────
  // Stratégie : on génère 3 clés (strict, casefold, stripped) et on indexe OPS
  // par les 3. Match Will : on essaie strict, sinon casefold, sinon stripped.
  function normKeyCase(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function normKeyStrip(s) {
    var x = normKeyCase(s);
    // retire suffixes courants en fin de nom
    x = x.replace(/\b(france|sas|sa|s\.a\.|s\.a\.s|laboratoires|laboratoire|labo|pharma|santé|sante|healthcare|health|f\.?)\b/g, ' ');
    x = x.replace(/[.,\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
    return x;
  }

  function buildOpsLaboIndex() {
    var ops = window.OPS_BY_LABO || {};
    var byStrict = {};
    var byCase = {};
    var byStrip = {};
    for (var k in ops) {
      if (!Object.prototype.hasOwnProperty.call(ops, k)) continue;
      var v = ops[k] || {};
      var entry = { name: k, ca: Number(v.ca) || 0, qte: Number(v.qte) || 0, nb_refs: Number(v.nb_refs) || 0 };
      byStrict[k] = entry;
      var kc = normKeyCase(k);
      if (kc && !byCase[kc]) byCase[kc] = entry;
      var ks = normKeyStrip(k);
      if (ks && !byStrip[ks]) byStrip[ks] = entry;
    }
    return { strict: byStrict, byCase: byCase, byStrip: byStrip };
  }
  function findOpsForLabo(labo, opsIdx) {
    if (!labo) return null;
    if (opsIdx.strict[labo]) return opsIdx.strict[labo];
    var kc = normKeyCase(labo);
    if (opsIdx.byCase[kc]) return opsIdx.byCase[kc];
    var ks = normKeyStrip(labo);
    if (ks && opsIdx.byStrip[ks]) return opsIdx.byStrip[ks];
    return null;
  }

  // Pour le Bloc 2 (labos OPS absents/sous-exploités), on a besoin de l'inverse :
  // matcher un nom OPS à un labo Will (avec ses 3 clés).
  function buildSalesLaboIndex() {
    var sales = window.SALES_BY_LABO || {};
    var byStrict = {};
    var byCase = {};
    var byStrip = {};
    for (var k in sales) {
      if (!Object.prototype.hasOwnProperty.call(sales, k)) continue;
      var v = sales[k] || {};
      var entry = {
        name: k,
        ca: Number(v.ca) || 0,
        qte: Number(v.qte) || 0,
        nb_pharmas: Number(v.nb_pharmas) || 0,
        nb_refs: Number(v.nb_refs) || 0,
        familles: v.familles || {}
      };
      byStrict[k] = entry;
      var kc = normKeyCase(k);
      if (kc && !byCase[kc]) byCase[kc] = entry;
      var ks = normKeyStrip(k);
      if (ks && !byStrip[ks]) byStrip[ks] = entry;
    }
    return { strict: byStrict, byCase: byCase, byStrip: byStrip };
  }
  function findSalesForLabo(labo, salesIdx) {
    if (!labo) return null;
    if (salesIdx.strict[labo]) return salesIdx.strict[labo];
    var kc = normKeyCase(labo);
    if (salesIdx.byCase[kc]) return salesIdx.byCase[kc];
    var ks = normKeyStrip(labo);
    if (ks && salesIdx.byStrip[ks]) return salesIdx.byStrip[ks];
    return null;
  }

  // ───────── Famille dominante d'un labo (chez Will) ────────────────────────
  function dominantFamille(famObj) {
    if (!famObj) return null;
    var best = null, bestCa = -1, total = 0;
    for (var f in famObj) {
      if (!Object.prototype.hasOwnProperty.call(famObj, f)) continue;
      var v = Number(famObj[f]) || 0;
      total += v;
      if (v > bestCa) { bestCa = v; best = f; }
    }
    if (!best || total <= 0) return null;
    return { famille: best, ca: bestCa, pct: bestCa / total };
  }

  // ───────── KPI card ───────────────────────────────────────────────────────
  function kpiHero(label, value, sub, color, footnote) {
    return '' +
      '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:18px 20px;box-shadow:0 2px 8px rgba(11,31,77,.05);position:relative;overflow:hidden">' +
        '<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:' + color + '"></div>' +
        '<div style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin-bottom:6px">' + escapeHtml(label) + '</div>' +
        '<div style="font-size:26px;font-weight:800;color:' + color + ';letter-spacing:-.5px;font-variant-numeric:tabular-nums;line-height:1.15">' + value + '</div>' +
        (sub ? '<div style="font-size:12px;color:#0B1F4D;font-weight:600;margin-top:6px">' + sub + '</div>' : '') +
        (footnote ? '<div style="font-size:10.5px;color:#94A3B8;margin-top:4px">' + footnote + '</div>' : '') +
      '</div>';
  }

  // ───────── BLOC 1 — Top 20 mes labos vs OPS ───────────────────────────────
  function buildTopLabosBlock(myTotal, opsTotal, opsIdx) {
    var sales = window.SALES_BY_LABO || {};
    var rows = [];
    for (var k in sales) {
      if (!Object.prototype.hasOwnProperty.call(sales, k)) continue;
      var v = sales[k] || {};
      var myCa = Number(v.ca) || 0;
      if (myCa <= 0) continue;
      var myPct = myTotal > 0 ? (myCa / myTotal) * 100 : 0;
      var ops = findOpsForLabo(k, opsIdx);
      var opsCa = ops ? ops.ca : 0;
      var opsRefs = ops ? ops.nb_refs : 0;
      var opsPct = opsTotal > 0 ? (opsCa / opsTotal) * 100 : 0;
      var pdm = opsCa > 0 ? (myCa / opsCa) * 100 : null; // ma PdM en valeur sur ce labo
      var indice = (opsPct > 0) ? (myPct / opsPct) * 100 : (myPct > 0 ? 999 : 0);
      var dom = dominantFamille(v.familles);
      rows.push({
        labo: k,
        myCa: myCa,
        myPct: myPct,
        myRefs: Number(v.nb_refs) || 0,
        myPharmas: Number(v.nb_pharmas) || 0,
        opsCa: opsCa,
        opsPct: opsPct,
        opsRefs: opsRefs,
        pdm: pdm,
        indice: indice,
        dom: dom,
        matched: !!ops
      });
    }
    rows.sort(function (a, b) { return b.myCa - a.myCa; });
    var TOP = 20;
    var top = rows.slice(0, TOP);

    var rowsHtml = top.map(function (r, i) {
      var lab = indiceLabel(r.indice);
      var indiceTxt = isFinite(r.indice) ? (Math.round(r.indice).toLocaleString('fr-FR')) : '∞';
      var famCol = r.dom ? (FAMILLE_COLORS[r.dom.famille] || '#64748B') : '#94A3B8';
      var famTxt = r.dom ? r.dom.famille : '—';
      var famPct = r.dom ? fmtPct(r.dom.pct * 100, 0) : '';
      var pdmTxt = r.pdm == null ? '<span style="color:#94A3B8">N/A</span>' :
        (r.pdm >= 100
          ? '<span style="color:#14B86A;font-weight:800">' + fmtPct(r.pdm, 0) + '</span>'
          : '<span style="color:#0B1F4D;font-weight:700">' + fmtPct(r.pdm, 1) + '</span>');
      var rangBg = i < 3 ? '#0057FF' : (i < 10 ? '#5856D6' : '#94A3B8');

      return '' +
        '<tr style="border-bottom:1px solid #F2F6FF">' +
          '<td style="padding:10px 12px;font-size:12px">' +
            '<span style="display:inline-block;min-width:24px;text-align:center;padding:2px 6px;border-radius:6px;background:' + rangBg + ';color:#fff;font-weight:800;font-size:11px">' + (i + 1) + '</span>' +
          '</td>' +
          '<td style="padding:10px 12px;font-size:13px;color:#0B1F4D;font-weight:700">' +
            escapeHtml(r.labo) +
            (!r.matched ? '<div style="font-size:10px;color:#94A3B8;font-weight:500;margin-top:2px">non trouvé chez OPS</div>' : '') +
          '</td>' +
          // Mon CA · % · refs
          '<td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums">' +
            '<div style="font-size:13px;font-weight:800;color:#0057FF">' + fmtEuro(r.myCa) + '</div>' +
            '<div style="font-size:10.5px;color:#94A3B8">' + fmtPct(r.myPct, 1) + ' · ' + fmtNum(r.myRefs) + ' réfs</div>' +
          '</td>' +
          // CA OPS · % · refs
          '<td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums">' +
            '<div style="font-size:13px;font-weight:700;color:#0B1F4D">' + (r.matched ? fmtEuro(r.opsCa) : '—') + '</div>' +
            '<div style="font-size:10.5px;color:#94A3B8">' + (r.matched ? (fmtPct(r.opsPct, 1) + ' · ' + fmtNum(r.opsRefs) + ' réfs') : '—') + '</div>' +
          '</td>' +
          // Ma PdM sur ce labo
          '<td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums;font-size:13px">' +
            pdmTxt +
          '</td>' +
          // Indice mix
          '<td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums">' +
            '<div style="font-size:14px;font-weight:800;color:' + lab.col + '">' + indiceTxt + '</div>' +
            '<div style="display:inline-block;margin-top:2px;padding:2px 8px;border-radius:999px;background:' + lab.col + '18;color:' + lab.col + ';font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase">' + lab.txt + '</div>' +
          '</td>' +
          // Famille dominante
          '<td style="padding:10px 12px">' +
            (r.dom ?
              '<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:' + famCol + '18;color:' + famCol + ';font-size:11px;font-weight:800">' +
                '<span style="width:8px;height:8px;border-radius:50%;background:' + famCol + '"></span>' + escapeHtml(famTxt) +
                ' <span style="opacity:.7;font-weight:600">· ' + famPct + '</span>' +
              '</span>'
              : '<span style="font-size:11px;color:#94A3B8">—</span>') +
          '</td>' +
        '</tr>';
    }).join('');

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Top ' + TOP + ' laboratoires fabricants — Mon mix vs OPS Nantes</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">Indice 100 = mix aligné OPS · &gt;100 sur-indexé · &lt;100 sous-indexé</span>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;box-shadow:0 2px 8px rgba(11,31,77,.04);overflow:auto">' +
          '<table style="width:100%;border-collapse:collapse;font-family:inherit">' +
            '<thead>' +
              '<tr style="background:#F2F6FF">' +
                '<th style="padding:10px 12px;text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">#</th>' +
                '<th style="padding:10px 12px;text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Laboratoire</th>' +
                '<th style="padding:10px 12px;text-align:right;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Mon CA · % portef.</th>' +
                '<th style="padding:10px 12px;text-align:right;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">CA OPS · % marché</th>' +
                '<th style="padding:10px 12px;text-align:right;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Ma PdM /OPS</th>' +
                '<th style="padding:10px 12px;text-align:right;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Indice mix</th>' +
                '<th style="padding:10px 12px;text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Famille dominante</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
          '</table>' +
          '<div style="padding:10px 14px;background:#F8FAFF;border-top:1px solid #E8EEFF;font-size:11px;color:#64748B;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
            '<span><b>Ma PdM</b> = Mon CA / CA OPS sur ce labo · <b>Indice</b> = (mon % / % OPS) × 100</span>' +
            '<span>CA total Will sur 8 mois : ' + fmtEuroPlain(myTotal) + ' · CA total OPS Nantes : ' + fmtEuroPlain(opsTotal) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ───────── BLOC 2 — Labos OPS où je suis ABSENT ou très en retard ─────────
  function buildAbsentBlock(myTotal, opsTotal, salesIdx) {
    var ops = window.OPS_BY_LABO || {};
    var SEUIL_OPS = 50000;   // OPS > 50 k€ = labo significatif
    var SEUIL_MOI = 5000;    // moi < 5 k€ = absent ou très en retard
    var rows = [];
    for (var k in ops) {
      if (!Object.prototype.hasOwnProperty.call(ops, k)) continue;
      var v = ops[k] || {};
      var opsCa = Number(v.ca) || 0;
      if (opsCa < SEUIL_OPS) continue;
      var mine = findSalesForLabo(k, salesIdx);
      var myCa = mine ? mine.ca : 0;
      if (myCa >= SEUIL_MOI) continue;
      // Manque à gagner = part marché OPS × CA total Will − mon CA
      var cibleCa = opsTotal > 0 ? (opsCa / opsTotal) * myTotal : 0;
      var manque = Math.max(0, cibleCa - myCa);
      var tag = myCa <= 0 ? 'ABSENT' : 'SOUS-EXPLOITÉ';
      rows.push({
        labo: k,
        opsCa: opsCa,
        opsRefs: Number(v.nb_refs) || 0,
        myCa: myCa,
        cibleCa: cibleCa,
        manque: manque,
        tag: tag
      });
    }
    rows.sort(function (a, b) { return b.opsCa - a.opsCa; });
    var top = rows.slice(0, 10);

    if (!top.length) {
      return '' +
        '<div style="margin-bottom:22px">' +
          '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:18px;text-align:center;color:#64748B;font-size:13px">' +
            'Aucun labo OPS &gt; 50 k€ où tu serais en dessous de 5 k€. Couverture labo solide.' +
          '</div>' +
        '</div>';
    }

    var totalManque = top.reduce(function (s, r) { return s + r.manque; }, 0);

    var rowsHtml = top.map(function (r, i) {
      var tagCol = r.tag === 'ABSENT' ? '#FF4D6D' : '#FF9F1C';
      var pctOps = opsTotal > 0 ? (r.opsCa / opsTotal) * 100 : 0;

      return '' +
        '<div style="padding:14px 18px;border-bottom:1px solid #F2F6FF;background:' + (i === 0 ? 'linear-gradient(90deg,#FFF5F7 0%,#fff 55%)' : '#fff') + '">' +
          '<div style="display:grid;grid-template-columns:30px 1fr 150px 130px 150px;gap:14px;align-items:center">' +
            '<div style="font-size:18px;font-weight:800;color:#94A3B8;font-variant-numeric:tabular-nums">' + (i + 1) + '</div>' +
            '<div>' +
              '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
                '<span style="font-size:14px;font-weight:800;color:#0B1F4D">' + escapeHtml(r.labo) + '</span>' +
                '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:' + tagCol + ';color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.8px">' + r.tag + '</span>' +
              '</div>' +
              '<div style="font-size:11px;color:#64748B;margin-top:4px">' +
                fmtNum(r.opsRefs) + ' réfs OPS · ' + fmtPct(pctOps, 2) + ' du marché OPS Nantes' +
              '</div>' +
            '</div>' +
            '<div style="text-align:right;font-variant-numeric:tabular-nums">' +
              '<div style="font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#64748B;font-weight:800">CA OPS</div>' +
              '<div style="font-size:15px;font-weight:800;color:#0B1F4D">' + fmtEuro(r.opsCa) + '</div>' +
            '</div>' +
            '<div style="text-align:right;font-variant-numeric:tabular-nums">' +
              '<div style="font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#64748B;font-weight:800">Mon CA</div>' +
              '<div style="font-size:15px;font-weight:800;color:' + (r.myCa > 0 ? '#FF9F1C' : '#FF4D6D') + '">' + fmtEuro(r.myCa) + '</div>' +
            '</div>' +
            '<div style="text-align:right;font-variant-numeric:tabular-nums">' +
              '<div style="font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#64748B;font-weight:800">Manque à gagner</div>' +
              '<div style="font-size:17px;font-weight:800;color:#FF4D6D">+' + fmtEuro(r.manque) + '</div>' +
              '<div style="font-size:10px;color:#94A3B8">si je m\'aligne mix OPS</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Top 10 labos OPS où je suis absent ou très en retard</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">Seuils : CA OPS &gt; 50 k€ · mon CA &lt; 5 k€</span>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;box-shadow:0 2px 8px rgba(11,31,77,.04);overflow:hidden">' +
          '<div style="padding:12px 18px;background:#FFF5F7;border-bottom:1px solid #FFE2E8;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
            '<div style="font-size:12px;color:#7A0D1F;font-weight:700">Leviers de prospection labo prioritaires · à brancher sur le book de visite</div>' +
            '<div style="font-size:13px;color:#FF4D6D;font-weight:800;font-variant-numeric:tabular-nums">Σ manque à gagner top 10 : ' + fmtEuro(totalManque) + '</div>' +
          '</div>' +
          rowsHtml +
          '<div style="padding:10px 14px;background:#F8FAFF;border-top:1px solid #E8EEFF;font-size:11px;color:#64748B">' +
            '<b>Manque à gagner</b> = (CA OPS labo / CA total OPS) × Mon CA total − Mon CA actuel. Hypothèse : je récupère la PdM moyenne OPS sur ce labo.' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ───────── BLOC 3 — Matrice 6 familles × top 5 labos Will ─────────────────
  function buildFamilleMatrixBlock(myTotal) {
    var sales = window.SALES_BY_LABO || {};

    // pour chaque famille, calculer top 5 labos Will + CA famille total
    var byFam = {};
    FAMILLES.forEach(function (f) { byFam[f] = { total: 0, labos: [] }; });

    for (var k in sales) {
      if (!Object.prototype.hasOwnProperty.call(sales, k)) continue;
      var v = sales[k] || {};
      var fams = v.familles || {};
      for (var f in fams) {
        if (!Object.prototype.hasOwnProperty.call(fams, f)) continue;
        var ca = Number(fams[f]) || 0;
        if (ca <= 0) continue;
        if (!byFam[f]) byFam[f] = { total: 0, labos: [] };
        byFam[f].total += ca;
        byFam[f].labos.push({ labo: k, ca: ca, myTotalLabo: Number(v.ca) || 0 });
      }
    }

    var cardsHtml = FAMILLES.map(function (f) {
      var col = FAMILLE_COLORS[f] || '#0057FF';
      var bucket = byFam[f] || { total: 0, labos: [] };
      bucket.labos.sort(function (a, b) { return b.ca - a.ca; });
      var top5 = bucket.labos.slice(0, 5);
      var totalFam = bucket.total;
      var pctOfMyCa = myTotal > 0 ? (totalFam / myTotal) * 100 : 0;

      if (!top5.length) {
        return '' +
          '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:14px;box-shadow:0 2px 8px rgba(11,31,77,.04)">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
              '<span style="width:14px;height:14px;border-radius:50%;background:' + col + '"></span>' +
              '<div style="font-size:13.5px;font-weight:800;color:#0B1F4D">' + escapeHtml(f) + '</div>' +
            '</div>' +
            '<div style="font-size:11px;color:#94A3B8">Aucune vente sur cette famille</div>' +
          '</div>';
      }

      // mini barres horizontales empilées normalisées sur le top labo de la famille
      var maxCa = top5[0].ca;
      var barsHtml = top5.map(function (l) {
        var w = maxCa > 0 ? (l.ca / maxCa) * 100 : 0;
        var pctInFam = totalFam > 0 ? (l.ca / totalFam) * 100 : 0;
        return '' +
          '<div style="margin-bottom:8px">' +
            '<div style="display:flex;justify-content:space-between;font-size:11px;color:#0B1F4D;margin-bottom:3px;gap:8px">' +
              '<span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:62%">' + escapeHtml(l.labo) + '</span>' +
              '<span style="color:#64748B;font-variant-numeric:tabular-nums">' + fmtEuro(l.ca) + ' · ' + fmtPct(pctInFam, 0) + '</span>' +
            '</div>' +
            '<div style="height:8px;background:#F2F6FF;border-radius:4px;overflow:hidden">' +
              '<div style="height:100%;width:' + w.toFixed(1) + '%;background:' + col + ';border-radius:4px"></div>' +
            '</div>' +
          '</div>';
      }).join('');

      return '' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:14px 16px;box-shadow:0 2px 8px rgba(11,31,77,.04);position:relative;overflow:hidden">' +
          '<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:' + col + '"></div>' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<span style="width:12px;height:12px;border-radius:50%;background:' + col + '"></span>' +
              '<div style="font-size:13.5px;font-weight:800;color:#0B1F4D">' + escapeHtml(f) + '</div>' +
            '</div>' +
            '<div style="font-size:11px;color:#64748B;font-weight:700;font-variant-numeric:tabular-nums">' +
              fmtEuro(totalFam) + ' · ' + fmtPct(pctOfMyCa, 1) +
            '</div>' +
          '</div>' +
          barsHtml +
        '</div>';
    }).join('');

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Qui pousse quoi · Top 5 labos par famille IP</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">% = part du labo dans le CA famille</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px">' +
          cardsHtml +
        '</div>' +
      '</div>';
  }

  // ───────── KPI strip d'ouverture ──────────────────────────────────────────
  function buildHeader(myTotal, opsTotal, myNbLabos, opsNbLabos, salesIdx, opsIdx) {
    // Compter combien de mes labos sont matchés OPS
    var sales = window.SALES_BY_LABO || {};
    var matched = 0;
    var unmatchedCa = 0;
    for (var k in sales) {
      if (!Object.prototype.hasOwnProperty.call(sales, k)) continue;
      var v = sales[k] || {};
      if (findOpsForLabo(k, opsIdx)) matched++;
      else unmatchedCa += (Number(v.ca) || 0);
    }
    var pctMatched = myNbLabos > 0 ? (matched / myNbLabos) * 100 : 0;

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px;flex-wrap:wrap">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Analyse labo · périmètre &amp; couverture</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">Will (8 dpts · 8 mois) vs OPS Nantes</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">' +
          kpiHero('Mon portefeuille labo', fmtNum(myNbLabos), 'fournisseurs actifs', '#0057FF', 'sur ' + fmtNum(opsNbLabos) + ' labos chez OPS') +
          kpiHero('Couverture vs OPS', fmtPct(pctMatched, 0), fmtNum(matched) + ' / ' + fmtNum(myNbLabos) + ' labos matchés OPS', '#14B86A', '') +
          kpiHero('CA non-comparé', fmtEuro(unmatchedCa), 'labos sans équivalent OPS', '#FF9F1C', 'spécialités hospitalières / niches') +
          kpiHero('CA total Will', fmtEuro(myTotal), 'vs ' + fmtEuro(opsTotal) + ' OPS Nantes', '#FF4D6D', 'ratio ' + fmtPct((myTotal / opsTotal) * 100, 1) + ' du marché OPS') +
        '</div>' +
      '</div>';
  }

  // ───────── Build principal ────────────────────────────────────────────────
  function build() {
    var salesTotal = window.SALES_TOTAL || {};
    var opsTotal = window.OPS_TOTAL || {};
    var myCa = Number(salesTotal.ca) || 0;
    var opsCa = Number(opsTotal.ca) || 0;
    var myNbLabos = Number(salesTotal.nb_labos) || Object.keys(window.SALES_BY_LABO || {}).length;
    var opsNbLabos = Number(opsTotal.nb_labos) || Object.keys(window.OPS_BY_LABO || {}).length;

    if (!window.SALES_BY_LABO || !window.OPS_BY_LABO || myCa <= 0 || opsCa <= 0) {
      return ''; // silencieux si données manquantes
    }

    var opsIdx = buildOpsLaboIndex();
    var salesIdx = buildSalesLaboIndex();

    return '' +
      '<div style="background:linear-gradient(180deg,#F8FAFF 0%,#fff 200px);padding:18px 20px;border-radius:16px;border:1px solid #E8EEFF;margin-top:12px">' +
        '<div style="margin-bottom:14px">' +
          '<div style="display:inline-block;padding:3px 10px;border-radius:999px;background:#0057FF18;color:#0057FF;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Comparatif laboratoires fabricants</div>' +
          '<h2 style="font-size:20px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.4px">Où mettre la pression labo cette semaine ?</h2>' +
          '<p style="font-size:12.5px;color:#64748B;margin:4px 0 0 0;line-height:1.5">Comparatif fournisseur par fournisseur sur le mix Will vs benchmark OPS Nantes. Sont remontés en priorité (1) les labos où je sous-indexe vs le marché, (2) les labos OPS &gt;50 k€ où je suis absent et (3) la cartographie famille → top 5 labos pour structurer les visites.</p>' +
        '</div>' +
        buildHeader(myCa, opsCa, myNbLabos, opsNbLabos, salesIdx, opsIdx) +
        buildTopLabosBlock(myCa, opsCa, opsIdx) +
        buildAbsentBlock(myCa, opsCa, salesIdx) +
        buildFamilleMatrixBlock(myCa) +
      '</div>';
  }

  window.buildLaboratoiresComparisonHtml = function () {
    try {
      return build();
    } catch (e) {
      try { console.warn('[benchmark-laboratoires] build error', e); } catch (_) {}
      return '';
    }
  };
})();
