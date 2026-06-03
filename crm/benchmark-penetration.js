// benchmark-penetration.js
// Analyse "Pénétration commerciale" — secteur William Morel (Intégral Pharma · 8 dpts)
// Question commerciale : pour chaque famille produit, combien de MES pharmacies actives
// achètent déjà, vs combien ne le font pas (= trous de raquette = visites à programmer).
//
// Expose : window.buildPenetrationCommercialeHtml() -> string HTML self-contained.
// Appelée par crm/classic-overrides.js page Benchmark, juste après Manque à Gagne.
//
// Méthode :
//   - Pharma "active" = au moins 1 ligne de CA dans CLIENT_PRODUCTS (donc effectivement
//     facturée par IP sur la période) — sert de dénominateur (univers Will).
//   - Pénétration famille F = nb pharmas avec >=1 produit famille F / nb pharmas actives total.
//   - Trou de raquette = pharma active ET sans achat dans famille F. Tri par CA cumulé décroissant.
//   - Top produits OPS : on regarde combien de nos pharmas achètent les 10 plus gros codes OPS.
//
// Pas de Chart.js, pas de dépendance. Helpers locaux.

(function () {
  'use strict';

  // ───────── Helpers self-contained ────────────────────────────────────────
  function fmtEuroPlain(n) {
    var v = Math.round(Number(n) || 0);
    return v.toLocaleString('fr-FR') + ' €';
  }
  function fmtEuro(n) {
    if (!n) return '0 €';
    var abs = Math.abs(n);
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

  // ───────── Logique famille (réimplémentée localement) ────────────────────
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

  // STOCK utilise le champ "marque" comme afmcode pour ce mapping (cf. benchmark-manque-a-gagne.js).
  function famOfArtcode(artcode, stock) {
    var stk = stock[artcode];
    if (!stk) return null;
    return familleFromAttrs(stk.nature, stk.marque, stk.sousfamille);
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

  function penetrationColor(pct) {
    if (pct >= 75) return '#14B86A';
    if (pct >= 40) return '#FF9F1C';
    return '#FF4D6D';
  }
  function penetrationLabel(pct) {
    if (pct >= 75) return 'BIEN PÉNÉTRÉ';
    if (pct >= 40) return 'À DÉVELOPPER';
    return 'SOUS-PÉNÉTRÉ';
  }

  // ───────── KPI hero card (pattern unifié avec manque-a-gagne) ───────────
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

  // ───────── Indexation des achats par pharmacie ───────────────────────────
  // Pour chaque CIP : { totalCa, byFam: {famille: ca}, codes: Set(artcodes) }
  // Et pour chaque famille : Set des CIP qui achètent dans cette famille.
  function indexClientPurchases(CLIENT_PRODUCTS, stock) {
    var byCip = {};
    var famPharmaSet = {};
    for (var i = 0; i < FAMILLES.length; i++) famPharmaSet[FAMILLES[i]] = {};

    for (var cip in CLIENT_PRODUCTS) {
      if (!Object.prototype.hasOwnProperty.call(CLIENT_PRODUCTS, cip)) continue;
      var rows = CLIENT_PRODUCTS[cip];
      if (!rows || !rows.length) continue;

      var total = 0;
      var fams = {};
      var codes = {};
      for (var j = 0; j < rows.length; j++) {
        var r = rows[j];
        var ca = Number(r.ca) || 0;
        if (ca <= 0) continue;
        total += ca;
        codes[r.artcode] = 1;
        var fam = famOfArtcode(r.artcode, stock);
        if (!fam) continue;
        fams[fam] = (fams[fam] || 0) + ca;
        famPharmaSet[fam][cip] = 1;
      }
      if (total > 0) {
        byCip[cip] = { totalCa: total, byFam: fams, codes: codes };
      }
    }
    return { byCip: byCip, famPharmaSet: famPharmaSet };
  }

  // ───────── BLOC 1 — Synthèse hero ────────────────────────────────────────
  function buildSynthesisBlock(famRows, nbActives, mostUnder) {
    var avgPen = famRows.reduce(function (s, r) { return s + r.penPct; }, 0) / Math.max(1, famRows.length);
    var sub2 = mostUnder ? fmtPct(mostUnder.penPct, 1) + ' · ' + mostUnder.nbHas + '/' + nbActives + ' pharmas achètent' : '—';
    var sub3 = mostUnder ? fmtNum(mostUnder.nbMiss) + ' clients actifs sans aucun achat · ' + fmtEuro(mostUnder.missCa) + ' de CA hors cette famille chez eux' : '—';

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Synthèse — Où placer mes visites ?</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">' + fmtNum(nbActives) + ' pharmas actives sur le territoire · 8 mois roulants</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">' +
          kpiHero(
            'Pénétration moyenne',
            fmtPct(avgPen, 1),
            '% moyen pharmas actives par famille IP',
            '#0057FF',
            'Moyenne arithmétique des 6 taux familles'
          ) +
          kpiHero(
            'Famille la moins pénétrée',
            mostUnder ? escapeHtml(mostUnder.famille) : '—',
            sub2,
            mostUnder ? penetrationColor(mostUnder.penPct) : '#94A3B8',
            'Cible de visite n°1 = clients actifs sans achat ici'
          ) +
          kpiHero(
            'Trous de raquette',
            mostUnder ? fmtNum(mostUnder.nbMiss) : '—',
            sub3,
            '#FF4D6D',
            'Pharmas qui achètent IP mais pas dans cette famille'
          ) +
        '</div>' +
      '</div>';
  }

  // ───────── BLOC 2 — Tableau pénétration par famille ─────────────────────
  function buildFamilleBlock(famRows, nbActives) {
    // Trié par pénétration croissante (les plus sous-pénétrées en haut).
    var sorted = famRows.slice().sort(function (a, b) { return a.penPct - b.penPct; });

    var rowsHtml = sorted.map(function (r, idx) {
      var col = FAMILLE_COLORS[r.famille] || '#0057FF';
      var pCol = penetrationColor(r.penPct);
      var pLabel = penetrationLabel(r.penPct);
      var gaugeW = Math.max(2, Math.min(100, r.penPct));
      var highlight = idx === 0 ? 'linear-gradient(90deg,#FFF5F7 0%,#fff 60%)' : '#fff';
      var reco = '';
      if (r.penPct < 40) reco = 'Sous-pénétration franche. ' + r.nbMiss + ' clients actifs ne touchent pas cette famille — c\'est mon vivier de visites prioritaire.';
      else if (r.penPct < 75) reco = 'Marge de progression. ' + r.nbMiss + ' clients actifs à ramener sur cette famille en visite ciblée.';
      else reco = 'Famille bien couverte sur le territoire. Travailler la profondeur de gamme chez les ' + r.nbHas + ' clients déjà acquéreurs.';

      return '' +
        '<div style="padding:16px 18px;border-bottom:1px solid #F2F6FF;background:' + highlight + '">' +
          '<div style="display:grid;grid-template-columns:180px 1fr 130px 130px;gap:16px;align-items:center">' +
            // colonne 1 : famille + badge
            '<div>' +
              '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
                '<span style="width:12px;height:12px;border-radius:50%;background:' + col + '"></span>' +
                '<div style="font-size:14.5px;font-weight:800;color:#0B1F4D">' + escapeHtml(r.famille) + '</div>' +
              '</div>' +
              '<div style="display:inline-block;padding:3px 9px;border-radius:999px;background:' + pCol + '18;color:' + pCol + ';font-size:10px;font-weight:800;letter-spacing:.8px">' + pLabel + '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:6px">' + fmtEuro(r.ca) + ' de CA famille</div>' +
            '</div>' +
            // colonne 2 : barre gauge
            '<div>' +
              '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:#64748B;margin-bottom:4px">' +
                '<span><b style="color:' + pCol + '">' + r.nbHas + ' pharmas achètent</b> sur ' + nbActives + ' actives</span>' +
                '<span style="color:#FF4D6D;font-weight:700">' + r.nbMiss + ' trous de raquette</span>' +
              '</div>' +
              '<div style="position:relative;height:16px;background:#F2F6FF;border-radius:6px;overflow:hidden">' +
                '<div style="height:100%;width:' + gaugeW + '%;background:' + pCol + ';border-radius:6px;transition:width .3s"></div>' +
                '<div style="position:absolute;top:0;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;color:#0B1F4D;letter-spacing:.3px">' +
                  fmtPct(r.penPct, 1) + ' du territoire actif' +
                '</div>' +
              '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8;margin-top:5px">Profondeur moyenne : ' + r.avgRefs.toFixed(1).replace('.', ',') + ' réfs / pharma acheteuse</div>' +
            '</div>' +
            // colonne 3 : nb pharmas
            '<div style="text-align:right">' +
              '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Pharmas acheteuses</div>' +
              '<div style="font-size:20px;font-weight:800;color:' + col + ';font-variant-numeric:tabular-nums">' + r.nbHas + '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8">sur ' + nbActives + ' actives</div>' +
            '</div>' +
            // colonne 4 : CA moyen
            '<div style="text-align:right">' +
              '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">CA moyen / acheteuse</div>' +
              '<div style="font-size:18px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums">' + fmtEuro(r.avgCaPerPharma) + '</div>' +
              '<div style="font-size:10.5px;color:#94A3B8">si ' + r.nbMiss + ' rejoignent : +' + fmtEuro(r.avgCaPerPharma * r.nbMiss) + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:10px;padding:8px 12px;background:#F8FAFF;border-left:3px solid ' + pCol + ';border-radius:6px;font-size:12px;color:#0B1F4D;line-height:1.45">' +
            '<b style="color:' + pCol + '">→</b> ' + escapeHtml(reco) +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Pénétration par famille IP · tri sous-pénétration croissante</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">% pharmas acheteuses / pharmas actives — en haut = à attaquer</span>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:0;box-shadow:0 2px 8px rgba(11,31,77,.04);overflow:hidden">' +
          '<div style="padding:10px 18px;background:#F2F6FF;border-bottom:1px solid #E8EEFF;display:grid;grid-template-columns:180px 1fr 130px 130px;gap:16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">' +
            '<span>Famille IP</span><span>Taux de pénétration territoire</span><span style="text-align:right">Pharmas OK</span><span style="text-align:right">Potentiel</span>' +
          '</div>' +
          rowsHtml +
          '<div style="padding:12px 18px;background:#F8FAFF;border-top:1px solid #E8EEFF;font-size:11px;color:#64748B;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
            '<span><b style="color:#FF4D6D">Rouge</b> < 40 % · <b style="color:#FF9F1C">Orange</b> 40-75 % · <b style="color:#14B86A">Vert</b> ≥ 75 %</span>' +
            '<span>Pénétration = pharmas avec ≥1 achat famille / pharmas actives au global</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ───────── BLOC 3 — Trous de raquette : top 20 pharmas cibles ────────────
  function buildHolesBlock(targetRow, byCip, famPharmaSet, CLIENTS_BY_CIP) {
    if (!targetRow) return '';
    var famille = targetRow.famille;
    var setHasFam = famPharmaSet[famille] || {};

    // Liste des CIP actifs sans achat dans cette famille.
    var candidates = [];
    for (var cip in byCip) {
      if (!Object.prototype.hasOwnProperty.call(byCip, cip)) continue;
      if (setHasFam[cip]) continue; // déjà acheteur
      var rec = byCip[cip];
      candidates.push({ cip: cip, totalCa: rec.totalCa, byFam: rec.byFam });
    }
    candidates.sort(function (a, b) { return b.totalCa - a.totalCa; });
    var top = candidates.slice(0, 20);

    var col = FAMILLE_COLORS[famille] || '#FF4D6D';

    var rowsHtml = top.map(function (c, idx) {
      var clt = CLIENTS_BY_CIP[c.cip] || {};
      var nom = clt.nom || ('CIP ' + c.cip);
      var ville = clt.ville || '';
      var cp = clt.cp || '';
      // Top 3 familles déjà achetées
      var famArr = [];
      for (var f in c.byFam) famArr.push({ f: f, ca: c.byFam[f] });
      famArr.sort(function (a, b) { return b.ca - a.ca; });
      var top3 = famArr.slice(0, 3);
      var top3Html = top3.map(function (t) {
        var tc = FAMILLE_COLORS[t.f] || '#94A3B8';
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:' + tc + '14;color:' + tc + ';font-size:10.5px;font-weight:700;margin-right:5px">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:' + tc + '"></span>' +
          escapeHtml(t.f) + ' ' + fmtEuro(t.ca) +
        '</span>';
      }).join('');

      var rankCol = idx < 3 ? '#FF4D6D' : idx < 10 ? '#FF9F1C' : '#94A3B8';

      return '' +
        '<div style="padding:12px 16px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:34px 1fr 140px 110px;gap:14px;align-items:center">' +
          '<div style="font-size:14px;font-weight:800;color:#fff;background:' + rankCol + ';border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center">' + (idx + 1) + '</div>' +
          '<div style="min-width:0">' +
            '<div style="font-size:13.5px;font-weight:800;color:#0B1F4D;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(nom) + '</div>' +
            '<div style="font-size:11px;color:#64748B;margin-top:2px">' + escapeHtml(cp) + ' ' + escapeHtml(ville) + ' · CIP ' + escapeHtml(c.cip) + '</div>' +
            '<div style="margin-top:6px">' + top3Html + '</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">CA global IP</div>' +
            '<div style="font-size:16px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums">' + fmtEuro(c.totalCa) + '</div>' +
            '<div style="font-size:10px;color:#FF4D6D;font-weight:700">0 € sur ' + escapeHtml(famille) + '</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<a href="#" data-cip="' + escapeHtml(c.cip) + '" data-famille="' + escapeHtml(famille) + '" style="display:inline-block;padding:7px 12px;background:' + col + ';color:#fff;border-radius:8px;text-decoration:none;font-size:11.5px;font-weight:800;letter-spacing:.3px">→ Cibler</a>' +
          '</div>' +
        '</div>';
    }).join('');

    if (!rowsHtml) {
      rowsHtml = '<div style="padding:18px;color:#94A3B8;text-align:center;font-size:12.5px">Aucun trou de raquette détecté sur cette famille.</div>';
    }

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Trous de raquette · Famille <span style="color:' + col + '">' + escapeHtml(famille) + '</span></h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">Top 20 clients actifs sans aucun achat sur cette famille · tri CA décroissant</span>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:0;box-shadow:0 2px 8px rgba(11,31,77,.04);overflow:hidden">' +
          '<div style="padding:10px 16px;background:#F2F6FF;border-bottom:1px solid #E8EEFF;display:grid;grid-template-columns:34px 1fr 140px 110px;gap:14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">' +
            '<span>#</span><span>Pharmacie · où elle dépense déjà</span><span style="text-align:right">CA global IP</span><span style="text-align:right">Action</span>' +
          '</div>' +
          rowsHtml +
          '<div style="padding:12px 16px;background:#F8FAFF;border-top:1px solid #E8EEFF;font-size:11px;color:#64748B">' +
            'Lecture : ces ' + Math.min(20, top.length) + ' pharmacies achètent IP au global mais zéro produit ' + escapeHtml(famille) + '. ' +
            'Si elles s\'alignaient au CA moyen famille (' + fmtEuro(targetRow.avgCaPerPharma) + ' par pharma), potentiel = ' + fmtEuro(targetRow.avgCaPerPharma * Math.min(20, top.length)) + '.' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ───────── BLOC 4 — Pénétration des 10 produits phares OPS ──────────────
  function buildOpsTopBlock(OPS_AGGREGATE, byCip, CLIENTS, nbActives) {
    if (!OPS_AGGREGATE) return '';
    // Top 10 OPS par CA
    var arr = [];
    for (var code in OPS_AGGREGATE) {
      if (!Object.prototype.hasOwnProperty.call(OPS_AGGREGATE, code)) continue;
      var p = OPS_AGGREGATE[code];
      arr.push({ code: code, designation: p.designation || code, ca: Number(p.ca) || 0 });
    }
    arr.sort(function (a, b) { return b.ca - a.ca; });
    var top10 = arr.slice(0, 10);

    // Pour chaque code, compter combien de mes pharmas l'achètent (via byCip[*].codes)
    var top10Pen = top10.map(function (t) {
      var nbHas = 0;
      for (var cip in byCip) {
        if (byCip[cip].codes && byCip[cip].codes[t.code]) nbHas++;
      }
      return { code: t.code, designation: t.designation, opsCa: t.ca, nbHas: nbHas };
    });

    // Total pharmacies du territoire (CLIENTS), et pharmacies à potentiel (>0)
    var totalTerritoire = CLIENTS.length;
    var nbPotentiel = 0;
    for (var i = 0; i < CLIENTS.length; i++) {
      if ((Number(CLIENTS[i].potentielGx) || 0) > 0) nbPotentiel++;
    }

    var rowsHtml = top10Pen.map(function (r, idx) {
      var penPct = totalTerritoire > 0 ? (r.nbHas / totalTerritoire * 100) : 0;
      var penActivesPct = nbActives > 0 ? (r.nbHas / nbActives * 100) : 0;
      var pCol = penetrationColor(penActivesPct);
      var gaugeW = Math.max(2, Math.min(100, penActivesPct));
      var oppMiss = Math.max(0, nbPotentiel - r.nbHas);

      return '' +
        '<div style="padding:12px 16px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:30px 1fr 130px 120px 130px;gap:14px;align-items:center">' +
          '<div style="font-size:13px;font-weight:800;color:#94A3B8;text-align:center">' + (idx + 1) + '</div>' +
          '<div style="min-width:0">' +
            '<div style="font-size:13px;font-weight:800;color:#0B1F4D;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(r.designation) + '</div>' +
            '<div style="font-size:10.5px;color:#94A3B8;margin-top:2px;font-family:monospace">CIP ' + escapeHtml(r.code) + ' · OPS Nantes ' + fmtEuro(r.opsCa) + '</div>' +
          '</div>' +
          '<div>' +
            '<div style="font-size:10.5px;color:#64748B;margin-bottom:3px"><b style="color:' + pCol + '">' + r.nbHas + '</b> / ' + nbActives + ' actives</div>' +
            '<div style="position:relative;height:10px;background:#F2F6FF;border-radius:5px;overflow:hidden">' +
              '<div style="height:100%;width:' + gaugeW + '%;background:' + pCol + ';border-radius:5px"></div>' +
            '</div>' +
            '<div style="font-size:10px;color:#94A3B8;margin-top:2px">' + fmtPct(penActivesPct, 1) + ' de mes actives</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Sur ' + fmtNum(totalTerritoire) + '</div>' +
            '<div style="font-size:15px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums">' + fmtPct(penPct, 1) + '</div>' +
            '<div style="font-size:10px;color:#94A3B8">' + r.nbHas + ' / ' + totalTerritoire + '</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Opportunité</div>' +
            '<div style="font-size:15px;font-weight:800;color:#FF4D6D;font-variant-numeric:tabular-nums">' + fmtNum(oppMiss) + '</div>' +
            '<div style="font-size:10px;color:#94A3B8">pharmas potentiel >0 sans achat</div>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div style="margin-bottom:22px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">' +
          '<h3 style="font-size:15px;font-weight:800;color:#0B1F4D;margin:0;letter-spacing:-.2px">Top 10 produits secteur OPS — qui les achète sur mon territoire ?</h3>' +
          '<span style="font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#94A3B8;font-weight:700">' + fmtNum(nbPotentiel) + ' pharmas à potentiel >0 sur ' + fmtNum(totalTerritoire) + ' au total</span>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:0;box-shadow:0 2px 8px rgba(11,31,77,.04);overflow:hidden">' +
          '<div style="padding:10px 16px;background:#F2F6FF;border-bottom:1px solid #E8EEFF;display:grid;grid-template-columns:30px 1fr 130px 120px 130px;gap:14px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">' +
            '<span>#</span><span>Produit phare OPS</span><span>Pénétration actives</span><span style="text-align:right">% sur territoire</span><span style="text-align:right">Opportunité</span>' +
          '</div>' +
          rowsHtml +
          '<div style="padding:12px 16px;background:#F8FAFF;border-top:1px solid #E8EEFF;font-size:11px;color:#64748B">' +
            '<b style="color:#0B1F4D">Lecture :</b> les 10 produits qui font le plus de CA chez OPS Nantes. ' +
            'Colonne "Opportunité" = nombre de pharmacies à potentiel Gx >0 sur mon territoire qui ne l\'achètent pas encore — autant de portes à pousser.' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ───────── FONCTION PRINCIPALE ──────────────────────────────────────────
  window.buildPenetrationCommercialeHtml = function () {
    var CLIENT_PRODUCTS = window.CLIENT_PRODUCTS;
    var STOCK = window.STOCK;
    var CLIENTS = window.CLIENTS;
    var OPS_AGGREGATE = window.OPS_AGGREGATE;
    if (!CLIENT_PRODUCTS || !STOCK || !CLIENTS) return '';

    // Index achats par CIP × famille
    var idx = indexClientPurchases(CLIENT_PRODUCTS, STOCK);
    var byCip = idx.byCip;
    var famPharmaSet = idx.famPharmaSet;

    // Nb pharmas actives = celles qui ont au moins 1 ligne CA réelle dans CLIENT_PRODUCTS
    var nbActives = 0;
    for (var cip in byCip) { if (Object.prototype.hasOwnProperty.call(byCip, cip)) nbActives++; }
    if (nbActives === 0) return '';

    // Carte CIP -> client pour les jointures noms/villes
    var CLIENTS_BY_CIP = {};
    for (var i = 0; i < CLIENTS.length; i++) {
      if (CLIENTS[i] && CLIENTS[i].cip) CLIENTS_BY_CIP[CLIENTS[i].cip] = CLIENTS[i];
    }

    // Construire lignes famille
    var famRows = FAMILLES.map(function (f) {
      var setHas = famPharmaSet[f] || {};
      var nbHas = 0;
      var caTotal = 0;
      var nbRefsTotal = 0;
      for (var c in setHas) {
        if (!Object.prototype.hasOwnProperty.call(setHas, c)) continue;
        nbHas++;
        var rec = byCip[c];
        if (rec && rec.byFam[f]) caTotal += rec.byFam[f];
        // Count refs of this fam for this CIP (codes mapped to f)
        if (rec && rec.codes) {
          for (var ac in rec.codes) {
            var stk = STOCK[ac];
            if (!stk) continue;
            if (familleFromAttrs(stk.nature, stk.marque, stk.sousfamille) === f) nbRefsTotal++;
          }
        }
      }
      var nbMiss = nbActives - nbHas;
      var penPct = nbActives > 0 ? (nbHas / nbActives * 100) : 0;
      var avgCaPerPharma = nbHas > 0 ? caTotal / nbHas : 0;
      var avgRefs = nbHas > 0 ? nbRefsTotal / nbHas : 0;
      // CA potentiellement déjà fait ailleurs par les pharmas qui ne touchent pas cette famille = somme de leur CA global
      var missCa = 0;
      for (var c2 in byCip) {
        if (!setHas[c2]) missCa += byCip[c2].totalCa;
      }
      return {
        famille: f,
        nbHas: nbHas, nbMiss: nbMiss,
        penPct: penPct,
        ca: caTotal, avgCaPerPharma: avgCaPerPharma,
        avgRefs: avgRefs,
        missCa: missCa
      };
    });

    // Famille la plus sous-pénétrée (la cible n°1 visites) — exclut familles à 0 pharma (cas dégénéré).
    var underPool = famRows.filter(function (r) { return r.nbHas > 0; }).slice();
    underPool.sort(function (a, b) { return a.penPct - b.penPct; });
    var mostUnder = underPool[0] || famRows[0];

    // ── Assemblage ──
    return '' +
      '<div style="font-family:\'DM Sans\',-apple-system,sans-serif;color:#0B1F4D;max-width:1280px;margin:0 auto">' +
        // Bandeau d'introduction
        '<div style="background:linear-gradient(135deg,#0B1F4D 0%,#FF4D6D 100%);border-radius:14px;padding:18px 22px;margin-bottom:22px;color:#fff;box-shadow:0 4px 16px rgba(255,77,109,.18)">' +
          '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.75;font-weight:700;margin-bottom:4px">Pénétration commerciale · trous de raquette</div>' +
          '<h2 style="font-size:22px;font-weight:800;margin:0 0 6px;letter-spacing:-.3px">Où sont mes prochaines visites — analyse client-par-client</h2>' +
          '<div style="font-size:12.5px;opacity:.85;line-height:1.5">' +
            'Sur ' + fmtNum(nbActives) + ' pharmacies actives (= au moins 1 facture IP), on regarde combien achètent réellement dans CHAQUE famille. ' +
            'Les pharmacies actives mais absentes d\'une famille = mes <b>trous de raquette</b> : elles achètent IP, donc elles peuvent acheter plus, ailleurs dans la gamme.' +
          '</div>' +
        '</div>' +
        buildSynthesisBlock(famRows, nbActives, mostUnder) +
        buildFamilleBlock(famRows, nbActives) +
        buildHolesBlock(mostUnder, byCip, famPharmaSet, CLIENTS_BY_CIP) +
        buildOpsTopBlock(OPS_AGGREGATE, byCip, CLIENTS, nbActives) +
        // Pied de page méthodo
        '<div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:14px 18px;margin-bottom:18px;font-size:11.5px;color:#64748B;line-height:1.55">' +
          '<b style="color:#0B1F4D">Notes méthodologiques</b> — ' +
          'Univers : ' + fmtNum(nbActives) + ' pharmas avec au moins 1 ligne CA sur les 8 mois roulants (source : CLIENT_PRODUCTS). ' +
          'Famille d\'un artcode déterminée par familleFromAttrs(nature, marque/afmcode, sousfamille) — même règle que le module Manque à Gagne. ' +
          'Pénétration = nbPharmasAcheteuses(famille) / nbActives. ' +
          'Trou de raquette = CIP actif global sans aucune ligne CA dans la famille analysée. ' +
          'Bloc OPS top 10 : on isole les 10 codes-articles à plus gros CA OPS Nantes et on compte mes pharmas qui les facturent.' +
        '</div>' +
      '</div>';
  };

})();
