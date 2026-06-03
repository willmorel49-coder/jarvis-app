// benchmark-manque-a-gagne.js
// Analyse "Manque à gagner" du commercial William Morel (Intégral Pharma · 8 dpts)
// vs benchmark sectoriel OPS Nantes (5 113 réfs · 8,6 M€).
//
// Expose : window.buildManqueAGagneHtml() -> string HTML self-contained.
// Appelée par crm/classic-overrides.js sur la page Benchmark.
//
// Méthode : pour chaque famille / tranche, on calcule
//   - le mix CA Will (CA famille / CA total Will)
//   - le mix CA OPS Nantes (CA famille OPS / CA total OPS)
//   - le delta en points puis le delta € au prorata du CA total Will
//   - Manque à gagner = max(0, opsMix - myMix) * CA Total Will
//   - Le total est la somme des écarts négatifs (sous-indexations chiffrées)

(function () {
  'use strict';

  // ───────── Helpers self-contained ────────────────────────────────────────
  function fmtEuroPlain(n) {
    const v = Math.round(Number(n) || 0);
    return v.toLocaleString('fr-FR') + ' €';
  }
  function fmtEuro(n) {
    if (!n) return '0 €';
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(2).replace('.', ',') + ' M€';
    if (abs >= 1000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' k€';
    return Math.round(n).toLocaleString('fr-FR') + ' €';
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString('fr-FR'); }
  function fmtPct(n, d) { d = d == null ? 1 : d; return (Number(n) || 0).toFixed(d).replace('.', ',') + ' %'; }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ───────── Logique famille / tranche (réimplémentée localement) ─────────
  function familleFromAttrs(nature, afmcode, sousfamille) {
    var n = (nature || '').trim();
    var a = (afmcode || '').trim().toUpperCase();
    var sf = (sousfamille || '').toLowerCase();
    if (n === 'Biosimilaire') return 'Biosimilaires';
    if (sf.indexOf('froid') !== -1) return 'Froid';
    if (a && a !== 'REMBSS' && a !== '#N/A') return 'Non remboursés';
    if (n === 'Generique Partenaire') return 'Gén. partenaires';
    if (n === 'Generique') return 'Génériques';
    return 'Princeps';
  }
  function trancheFromPrix(prix) {
    if (prix <= 4.33) return 'petit';
    if (prix <= 468) return 'inter';
    return 'haut';
  }

  // ───────── Constantes design ─────────────────────────────────────────────
  var FAMILLES = ['Froid', 'Biosimilaires', 'Génériques', 'Gén. partenaires', 'Non remboursés', 'Princeps'];
  var FAMILLE_COLORS = {
    'Froid': '#00B5D8',
    'Biosimilaires': '#7C3AED',
    'Génériques': '#94A3B8',
    'Gén. partenaires': '#14B86A',
    'Non remboursés': '#FF9F1C',
    'Princeps': '#0057FF'
  };
  var TRANCHES = [
    { key: 'petit', label: 'Petit prix', sub: '≤ 4,33 € HT', remise: 'remise 0,18 € fixe / boîte', color: '#0057FF' },
    { key: 'inter', label: 'Intermédiaire', sub: '4,33 – 468 € HT', remise: 'remise 3,9 %', color: '#5856D6' },
    { key: 'haut',  label: 'Haut prix', sub: '> 468 € HT', remise: 'remise 19,50 € fixe / boîte', color: '#FF9F1C' }
  ];

  // Code couleur du gap (€)
  function gapColor(gap) {
    var abs = Math.abs(gap);
    if (abs >= 50000) return '#FF4D6D';      // rouge : >50k€
    if (abs >= 10000) return '#FF9F1C';      // orange : 10-50k€
    return '#14B86A';                         // vert : <10k€
  }
  function gapBadgeLabel(gap) {
    var abs = Math.abs(gap);
    if (abs >= 50000) return 'PRIORITÉ HAUTE';
    if (abs >= 10000) return 'À TRAVAILLER';
    return 'OK';
  }

  // ───────── Agrégation OPS par famille et par tranche × famille ──────────
  function buildOpsAggregates() {
    var agg = (window.OPS_AGGREGATE || {});
    var fams = { 'Froid': { ca: 0, qte: 0, nb: 0 }, 'Biosimilaires': { ca: 0, qte: 0, nb: 0 }, 'Génériques': { ca: 0, qte: 0, nb: 0 }, 'Gén. partenaires': { ca: 0, qte: 0, nb: 0 }, 'Non remboursés': { ca: 0, qte: 0, nb: 0 }, 'Princeps': { ca: 0, qte: 0, nb: 0 } };
    var tranches = { petit: { ca: 0, qte: 0, nb: 0 }, inter: { ca: 0, qte: 0, nb: 0 }, haut: { ca: 0, qte: 0, nb: 0 } };
    var total = 0;
    for (var code in agg) {
      if (!Object.prototype.hasOwnProperty.call(agg, code)) continue;
      var p = agg[code];
      var ca = Number(p.ca) || 0;
      var qte = Number(p.qte) || 0;
      var fam = familleFromAttrs(p.nature, p.afmcode, p.sousfamille);
      if (fams[fam]) {
        fams[fam].ca += ca;
        fams[fam].qte += qte;
        fams[fam].nb += 1;
      }
      total += ca;
      if (qte > 0 && ca > 0) {
        var tr = trancheFromPrix(ca / qte);
        tranches[tr].ca += ca;
        tranches[tr].qte += qte;
        tranches[tr].nb += 1;
      }
    }
    return { fams: fams, tranches: tranches, total: total };
  }

  // ───────── KPI hero card ─────────────────────────────────────────────────
  function kpiHero(label, value, sub, color, footnote) {
    return '' +
      '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:18px 20px;box-shadow:0 2px 8px rgba(11,31,77,.05);position:relative;overflow:hidden">' +
        '<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:' + color + '"></div>' +
        '<div style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin-bottom:6px">' + escapeHtml(label) + '</div>' +
        '<div style="font-size:28px;font-weight:800;color:' + color + ';letter-spacing:-.5px;font-variant-numeric:tabular-nums;line-height:1.1">' + value + '</div>' +
        (sub ? '<div style="font-size:12px;color:#0B1F4D;font-weight:600;margin-top:6px">' + sub + '</div>' : '') +
        (footnote ? '<div style="font-size:10.5px;color:#94A3B8;margin-top:4px">' + footnote + '</div>' : '') +
      '</div>';
  }

  // ───────── BLOC 1 — Synthèse manque à gagner global ─────────────────────
  function buildSynthesisBlock(famRows, trancheRows, totalManque) {
    // tri par |Δ €| décroissant
    var famSorted = famRows.slice().sort(function (a, b) { return Math.abs(b.gap) - Math.abs(a.gap); });
    var famSousIdx = famSorted.filter(function (r) { return r.gap > 0; })[0]; // premier sous-indexé (gap manque > 0 = manque)
    var trSorted = trancheRows.slice().sort(function (a, b) { return Math.abs(b.gap) - Math.abs(a.gap); });
    var trSousIdx = trSorted.filter(function (r) { return r.gap > 0; })[0];

    var sub1 = (famSousIdx ? 'Plus gros levier : ' + escapeHtml(famSousIdx.famille) : 'Mix très aligné OPS Nantes');
    var sub2 = famSousIdx ? '<span style="color:#FF4D6D;font-weight:800">' + fmtEuroPlain(famSousIdx.gap) + '</span> à conquérir · ' + fmtPct(famSousIdx.deltaPts, 1) + ' pts d\'écart vs OPS' : '—';
    var sub3 = trSousIdx ? '<span style="color:#FF4D6D;font-weight:800">' + fmtEuroPlain(trSousIdx.gap) + '</span> à récupérer · remise IP : ' + escapeHtml(trSousIdx.remise) : '—';

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Synthèse — Combien je laisse sur la table ?</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">CA total Will sur 8 mois · ' + fmtEuroPlain((window.SALES_TOTAL || {}).ca || 0) + '</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">' +
          kpiHero(
            'Manque à gagner total',
            fmtEuroPlain(totalManque),
            'Si j\'alignais mon mix famille sur OPS Nantes',
            '#FF4D6D',
            'Méthode : Σ écarts négatifs (opsMix – myMix) × CA Will'
          ) +
          kpiHero(
            'Famille N°1 à attaquer',
            famSousIdx ? escapeHtml(famSousIdx.famille) : '—',
            sub2,
            famSousIdx ? gapColor(famSousIdx.gap) : '#94A3B8',
            famSousIdx ? ('Je fais ' + fmtPct(famSousIdx.myPct, 1) + ' du CA · OPS en fait ' + fmtPct(famSousIdx.opsPct, 1)) : ''
          ) +
          kpiHero(
            'Tranche prix sous-indexée',
            trSousIdx ? escapeHtml(trSousIdx.label) : '—',
            sub3,
            trSousIdx ? gapColor(trSousIdx.gap) : '#94A3B8',
            trSousIdx ? (escapeHtml(trSousIdx.sub) + ' · ' + fmtPct(trSousIdx.deltaPts, 1) + ' pts sous OPS') : ''
          ) +
        '</div>' +
      '</div>';
  }

  // ───────── BLOC 2 — Manque à gagner par famille ─────────────────────────
  function buildFamilleBlock(famRows, totals) {
    var sorted = famRows.slice().sort(function (a, b) { return Math.abs(b.gap) - Math.abs(a.gap); });

    var rowsHtml = sorted.map(function (r, idx) {
      var col = FAMILLE_COLORS[r.famille] || '#0057FF';
      var deltaSign = r.deltaPts >= 0 ? '+' : '';
      var deltaCol = r.deltaPts > 2 ? '#14B86A' : r.deltaPts < -2 ? '#FF4D6D' : '#94A3B8';
      var gapAbs = Math.abs(r.gap);
      var gapCol = gapColor(r.gap);
      var badge = gapBadgeLabel(r.gap);
      // barre de progression : largeur = myPct, repère vertical à opsPct
      var maxPct = Math.max(r.myPct, r.opsPct, 5);
      var myW = (r.myPct / maxPct) * 100;
      var opsMark = (r.opsPct / maxPct) * 100;
      var recoTxt = '';
      if (r.gap >= 50000) recoTxt = 'Priorité haute — gros volume potentiel. Cibler les pharmacies du secteur OPS qui achètent cette famille.';
      else if (r.gap >= 10000) recoTxt = 'À travailler — proposer la gamme en visite, push sur prospects chauds.';
      else if (r.gap > 0) recoTxt = 'Petit gap, à conforter.';
      else if (r.gap <= -10000) recoTxt = 'Sur-performance — territoire fidèle, à défendre.';
      else recoTxt = 'Aligné OPS — bon équilibre.';

      var couvCol = r.indiceCouv >= 90 ? '#14B86A' : r.indiceCouv >= 50 ? '#FF9F1C' : '#FF4D6D';
      var couvLabel = r.indiceCouv >= 90 ? 'Bonne couverture' : r.indiceCouv >= 50 ? 'Couverture partielle' : 'Faible couverture';

      return '' +
        '<div style="padding:16px 18px;border-bottom:1px solid #F2F6FF;background:' + (idx === 0 && r.gap > 10000 ? 'linear-gradient(90deg,#FFF5F7 0%,#fff 60%)' : '#fff') + '">' +
          '<div style="display:grid;grid-template-columns:180px 1fr 130px 130px;gap:16px;align-items:center">' +
            // colonne 1 : famille + badge
            '<div>' +
              '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
                '<span style="width:12px;height:12px;border-radius:50%;background:' + col + '"></span>' +
                '<div style="font-size:14.5px;font-weight:800;color:#0B1F4D">' + escapeHtml(r.famille) + '</div>' +
              '</div>' +
              '<div style="display:inline-block;padding:3px 9px;border-radius:999px;background:' + gapCol + '18;color:' + gapCol + ';font-size:10px;font-weight:800;letter-spacing:.8px">' + badge + '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:6px">' + fmtNum(r.myRefs) + ' réfs facturées · ' + fmtNum(r.myPharmas) + ' pharmas</div>' +
            '</div>' +
            // colonne 2 : barre + repère cible
            '<div>' +
              '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:#64748B;margin-bottom:4px">' +
                '<span><b style="color:#0057FF">Moi</b> ' + fmtEuro(r.myCa) + ' · ' + fmtPct(r.myPct, 1) + '</span>' +
                '<span><b style="color:#64748B">Cible OPS</b> ' + fmtEuro(r.cibleCa) + ' · ' + fmtPct(r.opsPct, 1) + '</span>' +
              '</div>' +
              '<div style="position:relative;height:16px;background:#F2F6FF;border-radius:6px;overflow:hidden">' +
                '<div style="height:100%;width:' + myW + '%;background:' + col + ';border-radius:6px;transition:width .3s"></div>' +
                '<div style="position:absolute;top:-2px;bottom:-2px;left:' + opsMark + '%;width:2px;background:#0B1F4D;box-shadow:0 0 0 2px #fff"></div>' +
                '<div style="position:absolute;top:-14px;left:calc(' + opsMark + '% - 18px);font-size:9px;color:#0B1F4D;font-weight:800;letter-spacing:.5px;width:40px;text-align:center">OPS</div>' +
              '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:5px">' +
                fmtNum(r.opsRefs) + ' réfs OPS Nantes · couverture de mon catalogue : ' + fmtPct(r.indiceCouv, 0) +
                ' <span style="color:' + couvCol + ';font-weight:700;margin-left:6px">' + couvLabel + '</span>' +
              '</div>' +
            '</div>' +
            // colonne 3 : Δ pts mix
            '<div style="text-align:right">' +
              '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Écart mix</div>' +
              '<div style="font-size:18px;font-weight:800;color:' + deltaCol + ';font-variant-numeric:tabular-nums">' + deltaSign + r.deltaPts.toFixed(1).replace('.', ',') + ' pts</div>' +
              '<div style="font-size:10.5px;color:#94A3B8">Moi ' + fmtPct(r.myPct, 1) + ' vs OPS ' + fmtPct(r.opsPct, 1) + '</div>' +
            '</div>' +
            // colonne 4 : Δ €
            '<div style="text-align:right">' +
              '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">' + (r.gap >= 0 ? 'Manque à gagner' : 'Sur-performance') + '</div>' +
              '<div style="font-size:20px;font-weight:800;color:' + gapCol + ';font-variant-numeric:tabular-nums">' + (r.gap >= 0 ? '+' : '−') + fmtEuro(gapAbs) + '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8">si je m\'aligne OPS</div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:10px;padding:8px 12px;background:#F8FAFF;border-left:3px solid ' + gapCol + ';border-radius:6px;font-size:12px;color:#0B1F4D;line-height:1.45">' +
            '<b style="color:' + gapCol + '">→</b> ' + escapeHtml(recoTxt) +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Manque à gagner détaillé par famille IP</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">Trié par |Δ €| décroissant · top = où aller en visite</span>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:0;box-shadow:0 2px 8px rgba(11,31,77,.04);overflow:hidden">' +
          '<div style="padding:10px 18px;background:#F2F6FF;border-bottom:1px solid #E8EEFF;display:grid;grid-template-columns:180px 1fr 130px 130px;gap:16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">' +
            '<span>Famille IP</span><span>Mix CA Moi vs cible OPS</span><span style="text-align:right">Δ pts mix</span><span style="text-align:right">Δ € chiffré</span>' +
          '</div>' +
          rowsHtml +
          '<div style="padding:12px 18px;background:#F8FAFF;border-top:1px solid #E8EEFF;font-size:11px;color:#64748B;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
            '<span><b style="color:#FF4D6D">Rouge</b> = gap > 50 k€ · <b style="color:#FF9F1C">Orange</b> = 10-50 k€ · <b style="color:#14B86A">Vert</b> = aligné</span>' +
            '<span>Cible OPS = mix OPS Nantes appliqué à mon CA total ' + fmtEuro(totals.myTotal) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ───────── BLOC 3 — Manque à gagner par tranche de prix ─────────────────
  function buildTrancheBlock(trancheRows, totals) {
    var sorted = trancheRows.slice().sort(function (a, b) { return Math.abs(b.gap) - Math.abs(a.gap); });

    var rowsHtml = sorted.map(function (r) {
      var deltaSign = r.deltaPts >= 0 ? '+' : '';
      var deltaCol = r.deltaPts > 2 ? '#14B86A' : r.deltaPts < -2 ? '#FF4D6D' : '#94A3B8';
      var gapAbs = Math.abs(r.gap);
      var gapCol = gapColor(r.gap);
      var badge = gapBadgeLabel(r.gap);
      var maxPct = Math.max(r.myPct, r.opsPct, 5);
      var myW = (r.myPct / maxPct) * 100;
      var opsMark = (r.opsPct / maxPct) * 100;
      var recoTxt = '';
      if (r.key === 'petit' && r.gap >= 10000) recoTxt = 'Petit prix sous-indexé : volume boîtes manqué, chaque boîte = +0,18 € de remise. Pousser les boîtes < 4,33 €.';
      else if (r.key === 'inter' && r.gap >= 10000) recoTxt = 'Cœur de marché sous-représenté : c\'est la tranche 3,9 % de remise, la plus rentable en CA absolu.';
      else if (r.key === 'haut' && r.gap >= 10000) recoTxt = 'Haut prix sous-indexé : remise fixe 19,50 €/boîte, gros effet de levier sur le CA même à faible volume.';
      else if (r.key === 'petit' && r.gap < 0) recoTxt = 'Volume petit prix sur-indexé — bonne couverture des génériques et OTC.';
      else if (r.key === 'inter' && r.gap < 0) recoTxt = 'Cœur de marché sur-performant — territoire fidèle.';
      else if (r.key === 'haut' && r.gap < 0) recoTxt = 'Sur-performance haut prix — bel attache aux biothérapies / oncologie.';
      else recoTxt = 'Tranche alignée OPS Nantes.';

      return '' +
        '<div style="padding:16px 18px;border-bottom:1px solid #F2F6FF">' +
          '<div style="display:grid;grid-template-columns:230px 1fr 130px 130px;gap:16px;align-items:center">' +
            '<div>' +
              '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
                '<span style="width:12px;height:12px;border-radius:50%;background:' + r.color + '"></span>' +
                '<div style="font-size:14.5px;font-weight:800;color:#0B1F4D">' + escapeHtml(r.label) + '</div>' +
              '</div>' +
              '<div style="font-size:11px;color:#64748B;margin-bottom:3px">' + escapeHtml(r.sub) + '</div>' +
              '<div style="display:inline-block;padding:3px 9px;border-radius:999px;background:' + gapCol + '18;color:' + gapCol + ';font-size:10px;font-weight:800;letter-spacing:.8px">' + badge + '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:6px;font-weight:600">Remise IP : ' + escapeHtml(r.remise) + '</div>' +
            '</div>' +
            '<div>' +
              '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:#64748B;margin-bottom:4px">' +
                '<span><b style="color:#0057FF">Moi</b> ' + fmtEuro(r.myCa) + ' · ' + fmtPct(r.myPct, 1) + '</span>' +
                '<span><b style="color:#64748B">Cible OPS</b> ' + fmtEuro(r.cibleCa) + ' · ' + fmtPct(r.opsPct, 1) + '</span>' +
              '</div>' +
              '<div style="position:relative;height:16px;background:#F2F6FF;border-radius:6px;overflow:hidden">' +
                '<div style="height:100%;width:' + myW + '%;background:' + r.color + ';border-radius:6px"></div>' +
                '<div style="position:absolute;top:-2px;bottom:-2px;left:' + opsMark + '%;width:2px;background:#0B1F4D;box-shadow:0 0 0 2px #fff"></div>' +
                '<div style="position:absolute;top:-14px;left:calc(' + opsMark + '% - 18px);font-size:9px;color:#0B1F4D;font-weight:800;letter-spacing:.5px;width:40px;text-align:center">OPS</div>' +
              '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:5px">' + fmtNum(r.myQte) + ' boîtes facturées · OPS ' + fmtNum(r.opsQte) + ' boîtes · ' + fmtNum(r.opsNb) + ' réfs sur la tranche</div>' +
            '</div>' +
            '<div style="text-align:right">' +
              '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Écart mix</div>' +
              '<div style="font-size:18px;font-weight:800;color:' + deltaCol + ';font-variant-numeric:tabular-nums">' + deltaSign + r.deltaPts.toFixed(1).replace('.', ',') + ' pts</div>' +
              '<div style="font-size:10.5px;color:#94A3B8">Moi ' + fmtPct(r.myPct, 1) + ' vs OPS ' + fmtPct(r.opsPct, 1) + '</div>' +
            '</div>' +
            '<div style="text-align:right">' +
              '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">' + (r.gap >= 0 ? 'Manque à gagner' : 'Sur-performance') + '</div>' +
              '<div style="font-size:20px;font-weight:800;color:' + gapCol + ';font-variant-numeric:tabular-nums">' + (r.gap >= 0 ? '+' : '−') + fmtEuro(gapAbs) + '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8">si je m\'aligne OPS</div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:10px;padding:8px 12px;background:#F8FAFF;border-left:3px solid ' + gapCol + ';border-radius:6px;font-size:12px;color:#0B1F4D;line-height:1.45">' +
            '<b style="color:' + gapCol + '">→</b> ' + escapeHtml(recoTxt) +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Manque à gagner par tranche de prix · effet remise IP</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">3 tranches · 3 régimes de remise différents</span>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:0;box-shadow:0 2px 8px rgba(11,31,77,.04);overflow:hidden">' +
          '<div style="padding:10px 18px;background:#F2F6FF;border-bottom:1px solid #E8EEFF;display:grid;grid-template-columns:230px 1fr 130px 130px;gap:16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">' +
            '<span>Tranche prix · remise IP</span><span>Mix CA Moi vs cible OPS</span><span style="text-align:right">Δ pts mix</span><span style="text-align:right">Δ € chiffré</span>' +
          '</div>' +
          rowsHtml +
          '<div style="padding:12px 18px;background:linear-gradient(135deg,#F0F4FF,#fff);border-top:1px solid #E8EEFF;font-size:11.5px;color:#0B1F4D;line-height:1.5">' +
            '<b style="color:#0057FF">Lecture commerciale</b> — Les 3 tranches sont rémunérées différemment : ' +
            '<b>petit prix</b> = 0,18 € fixe par boîte (volume) · ' +
            '<b>intermédiaire</b> = 3,9 % du PHT (cœur de marché) · ' +
            '<b>haut prix</b> = 19,50 € fixe par boîte (effet de levier).' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ───────── FONCTION PRINCIPALE ──────────────────────────────────────────
  window.buildManqueAGagneHtml = function () {
    var SALES_TOTAL = window.SALES_TOTAL;
    var SALES_BY_FAMILLE = window.SALES_BY_FAMILLE;
    var SALES_BY_TRANCHE = window.SALES_BY_TRANCHE;
    var OPS_AGGREGATE = window.OPS_AGGREGATE;
    if (!SALES_TOTAL || !SALES_BY_FAMILLE || !SALES_BY_TRANCHE || !OPS_AGGREGATE) return '';

    var myTotal = Number(SALES_TOTAL.ca) || 0;
    if (myTotal <= 0) return '';

    var ops = buildOpsAggregates();
    var opsTotal = ops.total;
    if (opsTotal <= 0) return '';

    // ── Lignes famille ──────────────────────────────────────────────────
    // Compte mes artcodes par famille (pour indice couverture)
    var stock = window.STOCK || {};
    var salesProd = window.SALES_BY_PRODUCT || {};
    var myFamRefSet = { 'Froid': {}, 'Biosimilaires': {}, 'Génériques': {}, 'Gén. partenaires': {}, 'Non remboursés': {}, 'Princeps': {} };
    for (var artcode in salesProd) {
      if (!Object.prototype.hasOwnProperty.call(salesProd, artcode)) continue;
      var stk = stock[artcode];
      if (!stk) continue;
      var fam = familleFromAttrs(stk.nature, stk.marque, stk.sousfamille);
      if (myFamRefSet[fam]) myFamRefSet[fam][artcode] = 1;
    }

    var famRows = FAMILLES.map(function (f) {
      var mine = SALES_BY_FAMILLE[f] || { ca: 0, qte: 0, lignes: 0, nb_refs: 0, nb_pharmas: 0 };
      var opsF = ops.fams[f] || { ca: 0, qte: 0, nb: 0 };
      var myCa = Number(mine.ca) || 0;
      var opsCa = Number(opsF.ca) || 0;
      var myPct = myTotal > 0 ? (myCa / myTotal * 100) : 0;
      var opsPct = opsTotal > 0 ? (opsCa / opsTotal * 100) : 0;
      var deltaPts = myPct - opsPct;
      // Cible CA si on appliquait le mix OPS au CA total Will
      var cibleCa = (opsPct / 100) * myTotal;
      // gap > 0 = manque à gagner ; gap < 0 = sur-performance
      var gap = cibleCa - myCa;
      // Indice couverture produits : nb réfs facturées Will / nb réfs OPS dans la famille
      var myRefs = Number(mine.nb_refs) || Object.keys(myFamRefSet[f] || {}).length;
      var opsRefs = Number(opsF.nb) || 0;
      var indiceCouv = opsRefs > 0 ? Math.min(100, (myRefs / opsRefs) * 100) : 0;
      return {
        famille: f,
        myCa: myCa, opsCa: opsCa,
        myPct: myPct, opsPct: opsPct, deltaPts: deltaPts,
        cibleCa: cibleCa, gap: gap,
        myRefs: myRefs, opsRefs: opsRefs,
        myPharmas: Number(mine.nb_pharmas) || 0,
        indiceCouv: indiceCouv
      };
    });

    // ── Lignes tranche ──────────────────────────────────────────────────
    var trancheRows = TRANCHES.map(function (t) {
      var mine = SALES_BY_TRANCHE[t.key] || { ca: 0, qte: 0 };
      var opsT = ops.tranches[t.key] || { ca: 0, qte: 0, nb: 0 };
      var myCa = Number(mine.ca) || 0;
      var opsCa = Number(opsT.ca) || 0;
      var myPct = myTotal > 0 ? (myCa / myTotal * 100) : 0;
      var opsPct = opsTotal > 0 ? (opsCa / opsTotal * 100) : 0;
      var deltaPts = myPct - opsPct;
      var cibleCa = (opsPct / 100) * myTotal;
      var gap = cibleCa - myCa;
      return {
        key: t.key, label: t.label, sub: t.sub, remise: t.remise, color: t.color,
        myCa: myCa, opsCa: opsCa,
        myQte: Number(mine.qte) || 0, opsQte: Number(opsT.qte) || 0, opsNb: Number(opsT.nb) || 0,
        myPct: myPct, opsPct: opsPct, deltaPts: deltaPts,
        cibleCa: cibleCa, gap: gap
      };
    });

    // ── Manque à gagner total = somme des gaps positifs (sous-indexations chiffrées) ──
    var totalManque = famRows.reduce(function (s, r) { return s + Math.max(0, r.gap); }, 0);

    var totals = { myTotal: myTotal, opsTotal: opsTotal };

    // ── Assemblage ──────────────────────────────────────────────────────
    return '' +
      '<div style="font-family:\'DM Sans\',-apple-system,sans-serif;color:#0B1F4D;max-width:1280px;margin:0 auto">' +
        // Bandeau d'introduction commerciale
        '<div style="background:linear-gradient(135deg,#0B1F4D 0%,#0057FF 100%);border-radius:14px;padding:18px 22px;margin-bottom:22px;color:#fff;box-shadow:0 4px 16px rgba(0,87,255,.18)">' +
          '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.75;font-weight:700;margin-bottom:4px">Analyse manque à gagner · benchmark sectoriel</div>' +
          '<h2 style="font-size:22px;font-weight:800;margin:0 0 6px;letter-spacing:-.3px">Mon mix produit vs OPS Nantes — combien je laisse sur la table ?</h2>' +
          '<div style="font-size:12.5px;opacity:.85;line-height:1.5">' +
            'Base de comparaison : ' + fmtNum((window.OPS_TOTAL || {}).nb_produits || ops.fams ? Object.keys(OPS_AGGREGATE || {}).length : 0) + ' produits agrégés OPS Nantes pour ' + fmtEuro(opsTotal) + ' de CA · vs mon CA actuel ' + fmtEuro(myTotal) + ' sur 8 mois (8 dpts).' +
            ' Méthode : pour chaque famille / tranche, on applique le mix % OPS à mon CA total. La différence = manque à gagner chiffré.' +
          '</div>' +
        '</div>' +
        buildSynthesisBlock(famRows, trancheRows, totalManque) +
        buildFamilleBlock(famRows, totals) +
        buildTrancheBlock(trancheRows, totals) +
        // Pied de page méthodo
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:14px 18px;margin-bottom:18px;font-size:11.5px;color:#64748B;line-height:1.55">' +
          '<b style="color:#0B1F4D">Notes méthodologiques</b> — ' +
          'Manque à gagner d\'une famille = (mix OPS – mon mix) × mon CA total, plafonné à zéro côté positif. ' +
          'Le total ne représente pas une opportunité brute additive (les +/− se compensent partiellement) : c\'est la somme des sous-indexations. ' +
          'L\'indice de couverture compare mes références facturées à celles présentes chez OPS Nantes dans la même famille (capé à 100 %). ' +
          'Les tranches de prix utilisent le prix unitaire moyen (CA/QTE).' +
        '</div>' +
      '</div>';
  };

})();
