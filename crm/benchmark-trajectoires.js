// benchmark-trajectoires.js
// Analyse des TRAJECTOIRES TEMPORELLES par famille IP sur 8 mois (oct 2025 → mai 2026)
// pour William Morel · Intégral Pharma · 8 dpts.
//
// Expose : window.buildTrajectoiresHtml() -> string HTML self-contained.
// Appelée par crm/classic-overrides.js sur la page Benchmark.
//
// Méthode :
//   - Régression linéaire simple (moindres carrés) sur les CA mensuels
//     pour estimer la pente (€/mois) et la convertir en % moyen / mois sur la base du CA moyen
//   - Croissance simple : (CA dernier mois − CA premier mois) / CA premier mois × 100
//   - Tags croissance basés sur slopePct/mois : >+15 / +3 à +15 / -3 à +3 / -3 à -15 / <-15
//   - Sparklines SVG 8 points inline, couleurs famille
//   - Heatmap famille × mois avec intensité couleur famille + valeur € + mini bar mix mensuel
//   - Alertes saisonnalité : pic mois >25 % du CA famille période, recul, accélération

(function () {
  'use strict';

  // ───────── Helpers self-contained ────────────────────────────────────────
  function fmtEuroPlain(n) {
    var v = Math.round(Number(n) || 0);
    return v.toLocaleString('fr-FR') + ' €';
  }
  function fmtEuro(n) {
    if (!n && n !== 0) return '0 €';
    var abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(2).replace('.', ',') + ' M€';
    if (abs >= 1000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' k€';
    return Math.round(n).toLocaleString('fr-FR') + ' €';
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString('fr-FR'); }
  function fmtPct(n, d) {
    d = d == null ? 1 : d;
    return (Number(n) || 0).toFixed(d).replace('.', ',') + ' %';
  }
  function fmtPctSigned(n, d) {
    d = d == null ? 1 : d;
    var v = Number(n) || 0;
    var sign = v > 0 ? '+' : (v < 0 ? '−' : '');
    return sign + Math.abs(v).toFixed(d).replace('.', ',') + ' %';
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ───────── Constantes ───────────────────────────────────────────────────
  var FAMILLES_ORDER = ['Froid', 'Biosimilaires', 'Génériques', 'Gén. partenaires', 'Non remboursés', 'Princeps'];
  var FAMILLE_COLORS = {
    'Froid': '#00B5D8',
    'Biosimilaires': '#7C3AED',
    'Génériques': '#94A3B8',
    'Gén. partenaires': '#14B86A',
    'Non remboursés': '#FF9F1C',
    'Princeps': '#0057FF'
  };
  // Libellés FR courts pour les mois "YYYY-MM"
  var MONTH_LABELS = {
    '01': 'janv.', '02': 'févr.', '03': 'mars', '04': 'avril',
    '05': 'mai', '06': 'juin', '07': 'juil.', '08': 'août',
    '09': 'sept.', '10': 'oct.', '11': 'nov.', '12': 'déc.'
  };
  function monthLabel(m) {
    if (!m) return '';
    var parts = m.split('-');
    var lab = MONTH_LABELS[parts[1]] || parts[1];
    var year = parts[0] && parts[0].length === 4 ? parts[0].slice(2) : parts[0];
    return lab + ' ' + year;
  }
  function monthShort(m) {
    if (!m) return '';
    var parts = m.split('-');
    return (MONTH_LABELS[parts[1]] || parts[1]).replace('.', '');
  }

  // ───────── Régression linéaire simple (moindres carrés) ─────────────────
  // x : index 0..n-1 (mois), y : CA mensuel
  function linReg(yArr) {
    var n = yArr.length;
    if (n < 2) return { slope: 0, intercept: yArr[0] || 0, slopePct: 0, mean: yArr[0] || 0 };
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var i = 0; i < n; i++) {
      var y = Number(yArr[i]) || 0;
      sumX += i;
      sumY += y;
      sumXY += i * y;
      sumXX += i * i;
    }
    var meanY = sumY / n;
    var denom = (n * sumXX) - (sumX * sumX);
    var slope = denom !== 0 ? ((n * sumXY) - (sumX * sumY)) / denom : 0;
    var intercept = (sumY - slope * sumX) / n;
    var slopePct = meanY > 0 ? (slope / meanY) * 100 : 0;
    return { slope: slope, intercept: intercept, slopePct: slopePct, mean: meanY };
  }

  // ───────── Tag croissance selon pente % / mois ──────────────────────────
  function trendTag(slopePct) {
    if (slopePct > 15) return { label: 'En forte croissance', icon: '🔥', color: '#14B86A', bg: '#E6F8EF' };
    if (slopePct > 3)  return { label: 'Croissance',          icon: '📈', color: '#14B86A', bg: '#EEFAF3' };
    if (slopePct >= -3)return { label: 'Stable',              icon: '→',  color: '#94A3B8', bg: '#F2F6FF' };
    if (slopePct >= -15)return{ label: 'Déclin',              icon: '📉', color: '#FF9F1C', bg: '#FFF6E8' };
    return                      { label: 'Forte chute',       icon: '⚠️', color: '#FF4D6D', bg: '#FFF0F3' };
  }

  // Couleur de la sparkline selon trend
  function sparkColor(slopePct) {
    if (slopePct > 3)  return '#14B86A';
    if (slopePct < -3) return '#FF4D6D';
    return '#94A3B8';
  }

  // ───────── Sparkline SVG ────────────────────────────────────────────────
  function buildSparkline(values, color, width, height) {
    width = width || 160; height = height || 36;
    var n = values.length;
    if (n === 0) return '';
    var max = Math.max.apply(null, values);
    var min = Math.min.apply(null, values);
    if (max === min) { max = max + 1; min = min - 1; }
    var pad = 3;
    var w = width - pad * 2;
    var h = height - pad * 2;
    var pts = values.map(function (v, i) {
      var x = pad + (n === 1 ? w / 2 : (i / (n - 1)) * w);
      var y = pad + h - ((v - min) / (max - min)) * h;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var polyline = '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />';
    // Aire sous la courbe
    var areaPts = pts.slice();
    var firstX = pad.toFixed(1);
    var lastX = (pad + w).toFixed(1);
    var bottomY = (pad + h).toFixed(1);
    areaPts.push(lastX + ',' + bottomY);
    areaPts.unshift(firstX + ',' + bottomY);
    var area = '<polygon points="' + areaPts.join(' ') + '" fill="' + color + '" opacity="0.12" />';
    // Marqueurs début/fin
    var firstPt = pts[0].split(',');
    var lastPt = pts[pts.length - 1].split(',');
    var dots =
      '<circle cx="' + firstPt[0] + '" cy="' + firstPt[1] + '" r="2.5" fill="#fff" stroke="' + color + '" stroke-width="1.5"/>' +
      '<circle cx="' + lastPt[0] + '" cy="' + lastPt[1] + '" r="2.8" fill="' + color + '"/>';
    return '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="display:block">' +
      area + polyline + dots +
      '</svg>';
  }

  // ───────── Construction des séries par famille ──────────────────────────
  function buildFamilySeries(monthly, months, total) {
    return FAMILLES_ORDER.map(function (fam) {
      var famData = (monthly && monthly[fam]) || {};
      var series = months.map(function (m) {
        var d = famData[m] || {};
        return { ca: Number(d.ca) || 0, qte: Number(d.qte) || 0 };
      });
      var caSerie = series.map(function (s) { return s.ca; });
      var totalCa = caSerie.reduce(function (a, b) { return a + b; }, 0);
      var first = caSerie[0] || 0;
      var last = caSerie[caSerie.length - 1] || 0;
      var growth = first > 0 ? ((last - first) / first) * 100 : (last > 0 ? 100 : 0);
      var reg = linReg(caSerie);
      var maxIdx = 0; var maxVal = -Infinity;
      caSerie.forEach(function (v, i) { if (v > maxVal) { maxVal = v; maxIdx = i; } });
      var minIdx = 0; var minVal = Infinity;
      caSerie.forEach(function (v, i) { if (v < minVal) { minVal = v; minIdx = i; } });
      // Accélération 3 derniers mois : pente sur 3 dernières valeurs vs pente 3 valeurs précédentes
      var last3 = caSerie.slice(-3);
      var prev3 = caSerie.slice(-6, -3);
      var sumLast3 = last3.reduce(function (a, b) { return a + b; }, 0);
      var sumPrev3 = prev3.reduce(function (a, b) { return a + b; }, 0);
      var accel3m = sumPrev3 > 0 ? ((sumLast3 - sumPrev3) / sumPrev3) * 100 : 0;
      // % du CA mensuel pour cette famille (mix qui glisse)
      var monthlyMix = caSerie.map(function (v, i) {
        var totMonth = total[i] || 0;
        return totMonth > 0 ? (v / totMonth) * 100 : 0;
      });
      // Concentration : part max d'un mois / CA famille période
      var peakShare = totalCa > 0 ? (maxVal / totalCa) * 100 : 0;
      return {
        famille: fam,
        color: FAMILLE_COLORS[fam] || '#0057FF',
        series: series,
        caSerie: caSerie,
        totalCa: totalCa,
        first: first,
        last: last,
        growth: growth,
        slope: reg.slope,
        slopePct: reg.slopePct,
        maxIdx: maxIdx,
        maxVal: maxVal,
        minIdx: minIdx,
        minVal: minVal,
        accel3m: accel3m,
        monthlyMix: monthlyMix,
        peakShare: peakShare
      };
    });
  }

  // ───────── BLOC 1 — Trajectoire par famille (cards) ─────────────────────
  function buildBlockTrajectoires(rows, months, grandTotal) {
    // Trier par CA total décroissant
    var sorted = rows.slice().sort(function (a, b) { return b.totalCa - a.totalCa; });

    // Mettre en évidence top croissance / top chute
    var withData = rows.filter(function (r) { return r.totalCa > 0; });
    var topGrowth = withData.slice().sort(function (a, b) { return b.slopePct - a.slopePct; })[0];
    var topDecline = withData.slice().sort(function (a, b) { return a.slopePct - b.slopePct; })[0];

    function headlineCard(label, row, isUp) {
      if (!row) return '';
      var col = isUp ? '#14B86A' : '#FF4D6D';
      var icon = isUp ? '🔥' : '⚠️';
      return '' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:14px;box-shadow:0 2px 8px rgba(11,31,77,.05);position:relative;overflow:hidden">' +
          '<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:' + col + '"></div>' +
          '<div style="font-size:24px;line-height:1">' + icon + '</div>' +
          '<div style="flex:1">' +
            '<div style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin-bottom:3px">' + escapeHtml(label) + '</div>' +
            '<div style="font-size:17px;font-weight:800;color:#0B1F4D;letter-spacing:-.2px">' + escapeHtml(row.famille) + '</div>' +
            '<div style="font-size:11.5px;color:#64748B;margin-top:2px">' +
              '<b style="color:' + col + '">' + fmtPctSigned(row.slopePct, 1) + ' / mois</b>' +
              ' · ' + fmtEuro(row.first) + ' → ' + fmtEuro(row.last) +
            '</div>' +
          '</div>' +
          '<div style="margin-left:auto">' + buildSparkline(row.caSerie, col, 110, 36) + '</div>' +
        '</div>';
    }

    var headlines = '' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:14px">' +
        headlineCard('Famille la plus dynamique', topGrowth, true) +
        headlineCard('Famille la plus dégradée', topDecline, false) +
      '</div>';

    var cardsHtml = sorted.map(function (r) {
      var tag = trendTag(r.slopePct);
      var lineCol = sparkColor(r.slopePct);
      var growthLine = (r.first > 0)
        ? (fmtEuro(r.first) + ' → ' + fmtEuro(r.last) + ' (' + fmtPctSigned(r.growth, 0) + ')')
        : '0 € → ' + fmtEuro(r.last);
      var spark = buildSparkline(r.caSerie, lineCol, 220, 44);
      // Mini barre mix moyen sur la période
      var mixMoy = grandTotal > 0 ? (r.totalCa / grandTotal) * 100 : 0;
      // Mois max / mois min
      var peakMonth = months[r.maxIdx] ? monthLabel(months[r.maxIdx]) : '—';
      var lowMonth = months[r.minIdx] ? monthLabel(months[r.minIdx]) : '—';
      return '' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:16px 18px;box-shadow:0 2px 8px rgba(11,31,77,.04);position:relative;overflow:hidden">' +
          '<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:' + r.color + '"></div>' +
          // Titre + tag
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<span style="width:12px;height:12px;border-radius:50%;background:' + r.color + '"></span>' +
              '<div style="font-size:15px;font-weight:800;color:#0B1F4D">' + escapeHtml(r.famille) + '</div>' +
            '</div>' +
            '<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:' + tag.bg + ';color:' + tag.color + ';font-size:10.5px;font-weight:800;letter-spacing:.5px">' +
              '<span style="font-size:13px;line-height:1">' + tag.icon + '</span>' + escapeHtml(tag.label) +
            '</div>' +
          '</div>' +
          // Sparkline + chiffres
          '<div style="display:grid;grid-template-columns:1fr 220px;gap:14px;align-items:center">' +
            '<div>' +
              '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">' +
                '<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Trend Lin. Reg.</div>' +
                '<div style="font-size:18px;font-weight:800;color:' + lineCol + ';font-variant-numeric:tabular-nums;letter-spacing:-.3px">' + fmtPctSigned(r.slopePct, 1) + ' / mois</div>' +
              '</div>' +
              '<div style="font-size:12px;color:#0B1F4D;margin-bottom:8px">' +
                '<b style="color:#64748B">Période</b> ' + growthLine +
              '</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;color:#64748B">' +
                '<span><b style="color:#0B1F4D">CA période</b> ' + fmtEuro(r.totalCa) + ' (' + fmtPct(mixMoy, 1) + ' du total)</span>' +
                '<span><b style="color:#14B86A">Pic</b> ' + escapeHtml(peakMonth) + ' (' + fmtEuro(r.maxVal) + ')</span>' +
                '<span><b style="color:#FF9F1C">Creux</b> ' + escapeHtml(lowMonth) + ' (' + fmtEuro(r.minVal) + ')</span>' +
              '</div>' +
            '</div>' +
            '<div style="text-align:right">' +
              spark +
              '<div style="font-size:9px;letter-spacing:.5px;color:#94A3B8;margin-top:2px;display:flex;justify-content:space-between">' +
                '<span>' + escapeHtml(monthShort(months[0])) + '</span>' +
                '<span>' + escapeHtml(monthShort(months[months.length - 1])) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Trajectoires par famille IP · 8 mois</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">Régression linéaire sur CA mensuels · pente exprimée en % du CA moyen</span>' +
        '</div>' +
        headlines +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:14px">' +
          cardsHtml +
        '</div>' +
      '</div>';
  }

  // ───────── BLOC 2 — Heatmap famille × mois ──────────────────────────────
  function buildBlockHeatmap(rows, months, totalByMonth) {
    // Max global par famille (pour intensité)
    var totalAllFam = rows.reduce(function (s, r) { return s + r.totalCa; }, 0);

    function intensity(value, max) {
      if (max <= 0) return 0.08;
      var ratio = value / max;
      // floor min pour rester lisible
      return Math.max(0.08, Math.min(1, ratio));
    }

    // hex -> rgba avec alpha
    function rgba(hex, alpha) {
      var h = hex.replace('#', '');
      var r = parseInt(h.substring(0, 2), 16);
      var g = parseInt(h.substring(2, 4), 16);
      var b = parseInt(h.substring(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(2) + ')';
    }

    // Header months
    var headHtml = '<div style="display:grid;grid-template-columns:160px repeat(' + months.length + ',1fr) 110px;background:#F2F6FF;border-bottom:1px solid #E8EEFF">' +
      '<div style="padding:10px 12px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Famille</div>' +
      months.map(function (m) {
        return '<div style="padding:10px 6px;text-align:center;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#64748B;font-weight:800">' + escapeHtml(monthShort(m)) + '<br><span style="font-weight:600;color:#94A3B8">' + (m.split('-')[0].slice(2)) + '</span></div>';
      }).join('') +
      '<div style="padding:10px 8px;text-align:right;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Total fam.</div>' +
      '</div>';

    // Rows
    var rowsHtml = rows.map(function (r) {
      var maxF = Math.max.apply(null, r.caSerie);
      var cells = r.caSerie.map(function (v, i) {
        var alpha = intensity(v, maxF);
        var bg = rgba(r.color, alpha);
        var totMonth = totalByMonth[i] || 0;
        var mix = totMonth > 0 ? (v / totMonth) * 100 : 0;
        var qte = (r.series[i] && r.series[i].qte) || 0;
        var tip = r.famille + ' · ' + monthLabel(months[i]) + '\nCA : ' + fmtEuroPlain(v) + '\nQté : ' + fmtNum(qte) + ' boîtes\nMix mois : ' + fmtPct(mix, 1);
        var txtCol = alpha > 0.55 ? '#fff' : '#0B1F4D';
        return '<div title="' + escapeHtml(tip) + '" style="padding:8px 4px;background:' + bg + ';border-right:1px solid #fff;border-bottom:1px solid #fff;text-align:center;color:' + txtCol + ';font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.25">' +
          '<div>' + fmtEuro(v) + '</div>' +
          '<div style="height:3px;margin:3px auto 0;width:80%;background:' + (alpha > 0.55 ? 'rgba(255,255,255,.45)' : 'rgba(11,31,77,.1)') + ';border-radius:2px;overflow:hidden">' +
            '<div style="height:100%;width:' + Math.min(100, mix) + '%;background:' + (alpha > 0.55 ? '#fff' : r.color) + '"></div>' +
          '</div>' +
          '<div style="font-size:9px;font-weight:600;opacity:.85;margin-top:2px">' + fmtPct(mix, 0) + '</div>' +
        '</div>';
      }).join('');

      var totalFam = r.totalCa;
      var totalPct = totalAllFam > 0 ? (totalFam / totalAllFam) * 100 : 0;

      return '<div style="display:grid;grid-template-columns:160px repeat(' + months.length + ',1fr) 110px;border-bottom:1px solid #F2F6FF">' +
        '<div style="padding:10px 12px;display:flex;align-items:center;gap:8px;background:#fff">' +
          '<span style="width:10px;height:10px;border-radius:50%;background:' + r.color + '"></span>' +
          '<span style="font-size:12.5px;font-weight:700;color:#0B1F4D">' + escapeHtml(r.famille) + '</span>' +
        '</div>' +
        cells +
        '<div style="padding:10px 8px;text-align:right;background:#F8FAFF;font-size:12px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums">' +
          fmtEuro(totalFam) +
          '<div style="font-size:10px;color:#94A3B8;font-weight:600">' + fmtPct(totalPct, 1) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // Total mensuel
    var totalRowHtml = '<div style="display:grid;grid-template-columns:160px repeat(' + months.length + ',1fr) 110px;background:#0B1F4D;color:#fff">' +
      '<div style="padding:10px 12px;font-size:11px;font-weight:800;letter-spacing:.5px">TOTAL MENSUEL</div>' +
      months.map(function (m, i) {
        var v = totalByMonth[i] || 0;
        return '<div style="padding:10px 4px;text-align:center;font-size:11px;font-weight:800;font-variant-numeric:tabular-nums;border-right:1px solid rgba(255,255,255,.08)">' + fmtEuro(v) + '</div>';
      }).join('') +
      '<div style="padding:10px 8px;text-align:right;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums">' + fmtEuro(totalAllFam) + '</div>' +
      '</div>';

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Heatmap · CA famille × mois</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">Intensité couleur = part du pic famille · barre = % du CA mensuel total</span>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(11,31,77,.04)">' +
          headHtml + rowsHtml + totalRowHtml +
        '</div>' +
      '</div>';
  }

  // ───────── BLOC 3 — Alertes saisonnalité & dynamique ────────────────────
  function buildBlockAlertes(rows, months) {
    var alerts = [];

    // Saisonnalité : famille avec mois > 25 % du CA famille période
    rows.forEach(function (r) {
      if (r.totalCa <= 0) return;
      r.caSerie.forEach(function (v, i) {
        var share = (v / r.totalCa) * 100;
        if (share > 25) {
          alerts.push({
            type: 'peak',
            severity: share > 35 ? 'high' : 'med',
            famille: r.famille,
            color: r.color,
            icon: '🎯',
            title: 'Pic ' + r.famille + ' en ' + monthLabel(months[i]),
            text: fmtPct(share, 0) + ' du CA ' + r.famille + ' période concentré sur ce mois — préparer le réassort en amont l\'an prochain.',
            value: share
          });
        }
      });
    });
    // Ne garder que le pic le + élevé par famille pour éviter le bruit
    var seenPeak = {};
    alerts = alerts.filter(function (a) {
      if (a.type !== 'peak') return true;
      if (seenPeak[a.famille]) return false;
      seenPeak[a.famille] = true;
      return true;
    });

    // 2 plus grosses chutes entre m1 et m2 consécutifs
    var drops = [];
    rows.forEach(function (r) {
      for (var i = 1; i < r.caSerie.length; i++) {
        var prev = r.caSerie[i - 1];
        var cur = r.caSerie[i];
        if (prev > 1000 && cur < prev) {
          var pct = ((cur - prev) / prev) * 100;
          if (pct < -15) {
            drops.push({
              famille: r.famille,
              color: r.color,
              pct: pct,
              m1: months[i - 1],
              m2: months[i],
              prev: prev,
              cur: cur
            });
          }
        }
      }
    });
    drops.sort(function (a, b) { return a.pct - b.pct; }); // plus négatif en tête
    drops.slice(0, 2).forEach(function (d) {
      alerts.push({
        type: 'drop',
        severity: d.pct < -30 ? 'high' : 'med',
        famille: d.famille,
        color: d.color,
        icon: '📉',
        title: 'Recul ' + d.famille + ' : ' + fmtPctSigned(d.pct, 0),
        text: monthLabel(d.m1) + ' (' + fmtEuro(d.prev) + ') → ' + monthLabel(d.m2) + ' (' + fmtEuro(d.cur) + ') — vérifier si rupture stock, perte client clé ou effet calendaire.',
        value: d.pct
      });
    });

    // Accélérations 3 derniers mois > +20 %
    rows.forEach(function (r) {
      if (r.accel3m > 20) {
        alerts.push({
          type: 'accel',
          severity: r.accel3m > 50 ? 'high' : 'med',
          famille: r.famille,
          color: r.color,
          icon: '🚀',
          title: 'Accélération ' + r.famille,
          text: fmtPctSigned(r.accel3m, 0) + ' sur les 3 derniers mois vs 3 mois précédents — capitaliser, lancer un push commercial ciblé.',
          value: r.accel3m
        });
      }
    });

    // Tri par sévérité
    var sevOrder = { high: 0, med: 1, low: 2 };
    alerts.sort(function (a, b) { return (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9); });

    if (alerts.length === 0) {
      return '' +
        '<div style="margin-bottom:22px">' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">' +
            '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Alertes saisonnalité & dynamique</h3>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:18px;color:#64748B;font-size:12px">Aucune alerte significative sur la période. Toutes les familles suivent une trajectoire régulière.</div>' +
        '</div>';
    }

    var typeBg = { peak: '#F0F9FF', drop: '#FFF0F3', accel: '#E6F8EF' };
    var typeAccent = { peak: '#0057FF', drop: '#FF4D6D', accel: '#14B86A' };

    var cardsHtml = alerts.map(function (a) {
      var bg = typeBg[a.type] || '#F8FAFF';
      var accent = typeAccent[a.type] || a.color;
      var sevTag = a.severity === 'high'
        ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#FF4D6D;color:#fff;font-size:9px;font-weight:800;letter-spacing:.8px;margin-left:6px">URGENT</span>'
        : '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#FF9F1C;color:#fff;font-size:9px;font-weight:800;letter-spacing:.8px;margin-left:6px">À SUIVRE</span>';
      return '<div style="background:' + bg + ';border:1px solid #E8EEFF;border-left:4px solid ' + accent + ';border-radius:10px;padding:12px 14px;display:flex;gap:12px;align-items:flex-start">' +
          '<div style="font-size:22px;line-height:1">' + a.icon + '</div>' +
          '<div style="flex:1">' +
            '<div style="display:flex;align-items:center;flex-wrap:wrap">' +
              '<span style="font-size:13px;font-weight:800;color:#0B1F4D">' + escapeHtml(a.title) + '</span>' +
              sevTag +
            '</div>' +
            '<div style="font-size:11.5px;color:#0B1F4D;line-height:1.5;margin-top:4px">' + escapeHtml(a.text) + '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Alertes saisonnalité & dynamique</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">' + alerts.length + ' signal' + (alerts.length > 1 ? 'aux' : '') + ' actionnable' + (alerts.length > 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:10px">' +
          cardsHtml +
        '</div>' +
      '</div>';
  }

  // ───────── FONCTION PRINCIPALE ──────────────────────────────────────────
  window.buildTrajectoiresHtml = function () {
    var monthly = window.SALES_BY_FAMILLE_MONTHLY;
    var byMonth = window.SALES_BY_MONTH;
    var total = window.SALES_TOTAL;
    if (!monthly || !byMonth || !total) return '';

    // Liste triée des mois disponibles (intersection des données dispo)
    var monthSet = {};
    Object.keys(byMonth).forEach(function (m) { monthSet[m] = true; });
    FAMILLES_ORDER.forEach(function (f) {
      if (monthly[f]) Object.keys(monthly[f]).forEach(function (m) { monthSet[m] = true; });
    });
    var months = Object.keys(monthSet).sort();
    if (months.length < 2) return '';

    // Total mensuel toutes familles confondues (depuis byMonth)
    var totalByMonth = months.map(function (m) {
      var d = byMonth[m] || {};
      return Number(d.ca) || 0;
    });
    var grandTotal = totalByMonth.reduce(function (a, b) { return a + b; }, 0);

    var rows = buildFamilySeries(monthly, months, totalByMonth);

    var periodStart = monthLabel(months[0]);
    var periodEnd = monthLabel(months[months.length - 1]);

    return '' +
      '<div style="font-family:\'DM Sans\',-apple-system,sans-serif;color:#0B1F4D;max-width:1280px;margin:0 auto">' +
        // Bandeau intro
        '<div style="background:linear-gradient(135deg,#0B1F4D 0%,#0057FF 100%);border-radius:14px;padding:18px 22px;margin-bottom:22px;color:#fff;box-shadow:0 4px 16px rgba(0,87,255,.18)">' +
          '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.75;font-weight:700;margin-bottom:4px">Trajectoires temporelles · 8 mois</div>' +
          '<h2 style="font-size:22px;font-weight:800;margin:0 0 6px;letter-spacing:-.3px">Qu\'est-ce qui monte, qu\'est-ce qui descend sur mon secteur ?</h2>' +
          '<div style="font-size:12.5px;opacity:.85;line-height:1.5">' +
            'Période ' + escapeHtml(periodStart) + ' → ' + escapeHtml(periodEnd) +
            ' · CA total ' + fmtEuro(grandTotal) +
            ' · ' + fmtNum(total.factures || 0) + ' factures · ' + fmtNum(total.nb_clients || 0) + ' pharmacies actives.' +
            ' Méthode : régression linéaire moindres carrés sur CA mensuels + variation simple début/fin de période.' +
          '</div>' +
        '</div>' +
        buildBlockTrajectoires(rows, months, grandTotal) +
        buildBlockHeatmap(rows, months, totalByMonth) +
        buildBlockAlertes(rows, months) +
        // Pied de page méthodo
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:14px 18px;margin-bottom:18px;font-size:11.5px;color:#64748B;line-height:1.55">' +
          '<b style="color:#0B1F4D">Notes méthodologiques</b> — ' +
          'Pente Lin. Reg. : pente / CA moyen mensuel, exprimée en % / mois (signal direction). ' +
          'Tags : > +15 % forte croissance · +3/+15 croissance · ±3 stable · -3/-15 déclin · < -15 forte chute. ' +
          'Accélération 3 mois : Σ 3 derniers mois vs Σ 3 mois précédents — capte les ruptures de tendance récentes. ' +
          'Heatmap : intensité = CA / pic famille (focale intra-famille) · barre = mix CA mensuel total (focale inter-famille). ' +
          'Pic saisonnier signalé dès qu\'un mois représente plus de 25 % du CA famille période.' +
        '</div>' +
      '</div>';
  };

})();
