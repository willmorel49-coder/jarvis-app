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

  // Noms d'officine : la base mêle MAJUSCULES et casse mixte. On affiche « Pharmacie de
  // l'Etoile - Elbeuf » partout (les accents perdus dans la base ne se devinent pas).
  var PETITS = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, et: 1, en: 1, sur: 1, sous: 1, d: 1, l: 1, au: 1, aux: 1, 'à': 1 };
  function beau(nom) {
    var t = String(nom == null ? '' : nom).trim();
    if (!t) return t;
    try {
      return t.toLowerCase().replace(/[\p{L}\d]+/gu, function (w, off) {
        return (off > 0 && PETITS[w]) ? w : w.charAt(0).toUpperCase() + w.slice(1);
      });
    } catch (e) { return t; }
  }
  // Initiales de l'avatar : deux mots significatifs, sinon deux lettres du seul mot.
  function initiales(nom) {
    var mots = (String(nom == null ? '' : nom).toLowerCase().match(/[a-zà-ÿ]+/g) || []).filter(function (w) { return !PETITS[w] && w !== 'pharmacie' && w !== 'grande'; });
    if (!mots.length) return 'PH';
    return (mots.length > 1 ? mots[0].charAt(0) + mots[1].charAt(0) : mots[0].slice(0, 2)).toUpperCase();
  }
  // Mini-courbe des achats mensuels d'une officine (tracé posé par CSS, pathLength=1).
  function spark(vals, i) {
    if (!vals || vals.length < 2) return '';
    var W = 88, H = 30, pad = 3, mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (mx === mn) mx = mn + 1;
    var pts = vals.map(function (v, k) { return [pad + k * (W - 2 * pad) / (vals.length - 1), H - pad - (v - mn) / (mx - mn) * (H - 2 * pad)]; });
    var d = pts.map(function (q, k) { return (k ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('');
    var a = d + 'L' + pts[pts.length - 1][0].toFixed(1) + ',' + H + 'L' + pts[0][0].toFixed(1) + ',' + H + 'Z';
    var lp = pts[pts.length - 1];
    return '<svg class="opso-spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" style="--i:' + i + '"><path class="a" d="' + a + '"/><path class="l" pathLength="1" d="' + d + '"/><circle class="d" cx="' + lp[0].toFixed(1) + '" cy="' + lp[1].toFixed(1) + '" r="2.6"/></svg>';
  }
  // Une saisie relance le dessin de l'écran : on rend le focus (et le curseur) au champ de recherche.
  function gardeFocus(root, fn) {
    var a = document.activeElement, pos = 0, garde = !!(a && a.type === 'search' && root && root.contains(a));
    if (garde) pos = a.selectionStart == null ? (a.value || '').length : a.selectionStart;
    fn();
    if (garde) {
      var n = root.querySelector('input[type=search]');
      if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
    }
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
      if (!byPh[id]) byPh[id] = { total: 0, lastCa: 0, prevCa: 0, produits: {}, m: {} };
      var b = byPh[id];
      b.total += (s.mntNetHt || 0);
      if (s.artCode && ((s.mntNetHt || 0) > 0 || (s.qte || 0) > 0)) b.produits[s.artCode] = 1;
      if (s.year && s.month) {
        var k = s.year * 12 + s.month;
        b.m[k] = (b.m[k] || 0) + (s.mntNetHt || 0);
        if (lastKey != null && k === lastKey) b.lastCa += (s.mntNetHt || 0);
        if (prevKey != null && k === prevKey) b.prevCa += (s.mntNetHt || 0);
      }
    });

    var rows = (V2.pharmacies || []).map(function (p) {
      var b = byPh[String(p.id)] || { total: 0, lastCa: 0, prevCa: 0, produits: {}, m: {} };
      return {
        p: p, total: b.total, lastCa: b.lastCa, prevCa: b.prevCa,
        serie: mois.map(function (mo) { return b.m[mo.y * 12 + mo.m] || 0; }),
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

    var maxTotal = clientes.length ? Math.max(clientes[0].total, 1) : 1;
    function row(r, idx) {
      var deltaTxt = '';
      // Un écart arrondi à 0 % n'apprend rien (lignes réparties à parts égales) : on le tait.
      if (r.prevCa > 0 && Math.round((r.lastCa - r.prevCa) / r.prevCa * 1000)) {
        var pc = (r.lastCa - r.prevCa) / r.prevCa * 100;
        deltaTxt = '<span class="opso-d ' + (pc >= 0 ? 'up' : 'dn') + '">' + pct1(pc).replace('-', '−') + '</span><span class="opso-d-l">vs mois préc.</span>';
      } else if (r.lastCa > 0) deltaTxt = '<span class="opso-d new">nouveau ce mois-ci</span>';
      var nom = beau(r.p.name);
      return '<a class="v2-row opso-ph" tabindex="0" role="link" onkeydown="if(event.key===\'Enter\')this.click()" onclick="V2.go(\'opsopharmacies\',\'' + esc(r.p.id) + '\')">' +
        (r.cliente ? '<span class="opso-ph-rk">' + (clientes.indexOf(r) + 1) + '</span>' : '') +
        '<span class="opso-av' + (r.cliente ? '' : ' off') + '" aria-hidden="true">' + esc(initiales(r.p.name)) + '</span>' +
        '<div class="opso-ph-main">' +
          '<div class="v2-row-name">' + esc(nom) + '</div>' +
          '<div class="v2-row-meta">' + esc(beau(r.p.ville || '')) + (r.p.code ? ' · CIP ' + esc(r.p.code) : '') + ' · ' + r.nbProduits + ' produit' + (r.nbProduits > 1 ? 's' : '') + '</div>' +
          (r.cliente ? '<span class="opso-share" aria-hidden="true"><i style="width:' + Math.max(3, Math.round(r.total / maxTotal * 100)) + '%;--i:' + idx + '"></i></span>' : '') +
        '</div>' +
        (r.cliente ? spark(r.serie, idx) : '') +
        (r.cliente ? '<div class="opso-ph-r"><span class="v2-row-val">' + euros(r.total) + '</span><div class="opso-ph-d">' + deltaTxt + '</div></div>' : '<span class="opso-none">Sans achat — potentiel</span>') +
        '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
    }

    var dernier = NB.mois && NB.mois.length ? NB.mois[NB.mois.length - 1] : null;
    var stats = '<div class="opf-stats">' +
      '<div class="opf-stat"><div class="opf-stat-l">Clientes</div><div class="opf-stat-v"><span data-count="' + NB.pharmaClientes + '">' + NB.pharmaClientes + '</span><small>/' + NB.adherentes + '</small></div><div class="opf-stat-n">adhérentes qui achètent chez Intégral Pharma</div></div>' +
      '<div class="opf-stat"><div class="opf-stat-l">Cumul HT</div><div class="opf-stat-v" data-count="' + Math.round(NB.total) + '" data-fmt="eur">' + euros(NB.total) + '</div><div class="opf-stat-n">' + esc(NB.periode) + '</div></div>' +
      (dernier ? '<div class="opf-stat"><div class="opf-stat-l">Dernier mois</div><div class="opf-stat-v" data-count="' + Math.round(dernier.ca) + '" data-fmt="eur">' + euros(dernier.ca) + '</div><div class="opf-stat-n">' + MOIS_PLEIN[dernier.m - 1] + ' ' + dernier.y + '</div></div>' : '') +
    '</div>';

    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page">' +
        '<div class="v2-page-title">Pharmacies</div>' +
        '<div class="v2-page-sub">Les officines du réseau OPSO Santé et leur évolution d\'achats chez Intégral Pharma, mois par mois. ' +
          NB.pharmaClientes + ' clientes sur ' + NB.adherentes + ' adhérentes · ' + esc(periodeTxt(NB)) + '.</div>' +
        stats +
        '<div class="opso-search">' + ICO('search', 18, 2) + '<input class="v2-field" type="search" aria-label="Chercher une pharmacie ou une ville" placeholder="Chercher une pharmacie, une ville…" value="' + esc(phSearch) + '" oninput="V2.opsoPhSearch(this.value)"></div>' +
        '<div class="v2-card"><div class="v2-card-head"><span class="v2-card-t">Clientes · les plus gros acheteurs en tête (' + clientesF.length + ')</span><span class="opso-card-note">Écart : dernier mois comparé au mois précédent</span></div>' +
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

    var maxProd = top5.length ? Math.max(top5[0].ca, 1) : 1;
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page">' +
        '<div class="opf-fhead">' +
          '<span class="opso-av lg' + (cliente ? '' : ' off') + '" aria-hidden="true">' + esc(initiales(p.name)) + '</span>' +
          '<div class="opf-fhead-t"><div class="v2-page-title">' + esc(beau(p.name)) + '</div>' +
          '<div class="v2-page-sub">' + esc(beau(p.ville || '')) + (p.cp ? ' (' + esc(p.cp) + ')' : '') + (p.code ? ' · CIP ' + esc(p.code) : '') + ' · Réseau OPSO Santé' + (cliente ? ' · cliente' : ' · adhérente sans achat (potentiel)') + '</div></div>' +
          '<span class="opso-chip' + (cliente ? '' : ' off') + '">' + (cliente ? 'Cliente' : 'Potentiel') + '</span>' +
        '</div>' +
        '<div class="v2-kpis">' +
          '<div class="v2-kpi k1"><div class="v2-kpi-l">Cumul chez Intégral Pharma</div><div class="v2-kpi-v mono" data-count="' + Math.round(total) + '" data-fmt="eur">' + euros(total) + '</div><div class="v2-kpi-d" style="color:var(--muted)">' + esc(periodeTxt(NB)) + '</div></div>' +
          '<div class="v2-kpi k2"><div class="v2-kpi-l">Dernier mois</div><div class="v2-kpi-v mono" data-count="' + Math.round(lastCa) + '" data-fmt="eur">' + euros(lastCa) + '</div>' + deltaHtmlSafe + '</div>' +
          '<div class="v2-kpi k3"><div class="v2-kpi-l">Produits distincts commandés</div><div class="v2-kpi-v mono" data-count="' + Object.keys(produits).length + '">' + Object.keys(produits).length + '</div></div>' +
          '<div class="v2-kpi k4"><div class="v2-kpi-l">Statut</div><div class="v2-kpi-v" style="font-size:16px">' + (cliente ? 'Cliente' : 'Potentiel') + '</div></div>' +
        '</div>' +
        // Le graphique est déjà une carte : plus de carte dans la carte.
        (chart ? '<div class="opf-fiche-chart">' + chart.html + '</div>' :
          '<div class="v2-card" style="padding:18px 20px 8px"><div class="v2-card-head" style="padding:0 0 8px"><span class="v2-card-t">Évolution mensuelle des achats</span></div><div class="v2-empty"><div class="v2-empty-t">Aucun achat enregistré</div><div class="v2-empty-d">Cette officine n\'a pas encore commandé chez Intégral Pharma.</div></div></div>') +
        (top5.length ? '<div class="v2-card opso-prod" style="margin-top:16px"><div class="v2-card-head"><span class="v2-card-t">Produits phares</span></div>' +
          top5.map(function (x, i) {
            return '<div class="v2-row" style="cursor:default">' +
              '<span class="mono opso-prod-rk">' + (i + 1) + '</span>' +
              '<div style="flex:1;min-width:0"><div class="v2-row-name">' + esc(nomProduit(x.c, x.d)) + '</div><span class="opso-share" aria-hidden="true"><i style="width:' + Math.max(3, Math.round(x.ca / maxProd * 100)) + '%;--i:' + i + '"></i></span></div>' +
              '<div style="text-align:right"><span class="v2-row-val">' + euros(x.ca) + '</span><div class="v2-row-meta">' + Math.round(x.boites) + ' boîte' + (Math.round(x.boites) > 1 ? 's' : '') + '</div></div>' +
            '</div>';
          }).join('') +
        '</div>' : '') +
      '</div>';
    if (chart && chart.bind) chart.bind(root);
  }

  V2.opsoPhSearch = function (val) {
    phSearch = val || '';
    var r = root$(); if (r && V2.route && V2.route.name === 'opsopharmacies' && !V2.route.param) gardeFocus(r, function () { renderPharmaciesList(r); });
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

    var tabsHtml = '<button class="v2-tab' + (achTab === 'all' ? ' on' : '') + '" onclick="V2.opsoAchTab(\'all\')">Tous<em>' + D.items.length + '</em></button>' +
      (D.hasCat ? CAT_ORDER.filter(function (k) { return D.byCat[k] > 0; }).map(function (k) {
        return '<button class="v2-tab' + (achTab === k ? ' on' : '') + '" onclick="V2.opsoAchTab(\'' + k + '\')">' + esc(CAT_LABELS[k]) + '<em>' + D.byCat[k] + '</em></button>';
      }).join('') : '');

    // 2ᵉ passe (29/09/2026) : plus de badge d'évolution — sur ces données il
    // valait « 0 % » presque partout (lignes injectées réparties à parts égales
    // sur les mois, cf. opso-groupement.js), du bruit sur chaque ligne.
    var NC = NB.pharmaClientes || 0;
    function nPh(n) { return n + ' pharmacie' + (n > 1 ? 's' : ''); }
    // Une pastille par pharmacie cliente (pleine = elle commande ce produit) —
    // se lit d'un coup d'œil ; au-delà de 24 clientes, une jauge.
    function partage(n, jauge) {
      if (!jauge && NC > 0 && NC <= 24) {
        var s = '';
        for (var i = 0; i < NC; i++) s += '<i' + (i < n ? ' class="on"' : '') + ' style="--k:' + i + '"></i>';
        return '<span class="opf-dots" aria-hidden="true" style="--nc:' + NC + '">' + s + '</span>';
      }
      var pct = NC ? Math.min(100, Math.round(n / NC * 100)) : 0;
      return '<span class="opf-gauge" aria-hidden="true"><span class="opf-gauge-fill" style="width:' + pct + '%"></span></span>';
    }
    function vignette(it, cls) {
      var src = photoDe(it.code);
      var ini = esc((it.d || '?').replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 2).toUpperCase());
      return '<span class="' + cls + '">' +
        (src ? '<img src="' + esc(src) + '" loading="lazy" alt="" onerror="this.remove()">' : '') +
        '<b>' + ini + '</b></span>';
    }
    function carte(it, i) {
      return '<div class="opf-pod">' +
        '<span class="opf-pod-rk mono">' + (i + 1) + '</span>' +
        vignette(it, 'opf-pod-img') +
        '<div class="opf-pod-name">' + esc(it.d) + '</div>' +
        '<div class="opf-pod-n"><span class="mono">' + it.n + '</span><span> sur ' + NC + ' pharmacies</span></div>' +
        partage(it.n) +
        '<div class="opf-pod-foot"><span class="mono">' + euros(it.ca) + '</span><span>' + it.boites + ' boîte' + (it.boites > 1 ? 's' : '') + '</span></div>' +
      '</div>';
    }
    function ligne(it, rk) {
      return '<div class="v2-row opf-li" style="cursor:default">' +
        '<span class="mono opf-li-rk">' + rk + '</span>' +
        vignette(it, 'opf-thumb') +
        '<div style="flex:1;min-width:0">' +
          '<div class="v2-row-name">' + esc(it.d) + '</div>' +
          '<div class="opf-gauge-row">' + partage(it.n, true) + '<span class="v2-row-meta">' + it.n + ' / ' + NC + '</span></div>' +
        '</div>' +
        '<div style="text-align:right;flex:none"><span class="v2-row-val">' + euros(it.ca) + '</span><div class="v2-row-meta">' + it.boites + ' boîte' + (it.boites > 1 ? 's' : '') + '</div></div>' +
      '</div>';
    }
    // Podium = les 6 premiers de la liste filtrée ; le reste est regroupé par
    // nombre de pharmacies (« commandé par 5 pharmacies »…), pas une liste plate.
    var nPod = achSearch ? 0 : Math.min(6, shown.length);
    var podium = shown.slice(0, nPod), reste = shown.slice(nPod);
    var groupes = '', curN = null, buf = '';
    reste.forEach(function (it, j) {
      if (it.n !== curN) {
        if (buf) groupes += buf + '</div>';
        curN = it.n;
        var nb = list.filter(function (x) { return x.n === curN; }).length;
        buf = '<div class="v2-card opf-grp"><div class="v2-card-head"><span class="v2-card-t">Commandé' + (nb > 1 ? 's' : '') + ' par ' + nPh(curN) + '</span><span class="v2-row-meta">' + nb + ' produit' + (nb > 1 ? 's' : '') + '</span></div>';
      }
      buf += ligne(it, nPod + j + 1);
    });
    if (buf) groupes += buf + '</div>';

    injectAchStyle();
    ensurePhotos();
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page">' +
        '<div class="v2-page-title">Meilleurs achats</div>' +
        '<div class="v2-page-sub">Les produits que les pharmacies OPSO commandent chez Intégral Pharma, classés par NOMBRE DE PHARMACIES qui les commandent (puis par quantités et CA). ' +
          (D.hasCat ? '' : 'Catégories en cours de chargement… ') + esc(periodeTxt(NB)) + '.</div>' +
        '<div class="opf-tools">' +
          '<div class="opso-search">' + ICO('search', 18, 2) + '<input class="v2-field" type="search" aria-label="Chercher un produit ou un CIP" placeholder="Chercher un produit, un CIP…" value="' + esc(achSearch) + '" oninput="V2.opsoAchSearch(this.value)"></div>' +
          '<button class="v2-btn v2-btn-ghost opf-export" onclick="V2.opsoAchExport()">' + ICO('download', 16) + ' Exporter (CSV)</button>' +
        '</div>' +
        '<div class="v2-tabs" style="overflow-x:auto;margin-bottom:6px">' + tabsHtml + '</div>' +
        '<div class="opf-count v2-row-meta">' + list.length + ' référence' + (list.length > 1 ? 's' : '') + '</div>' +
        (podium.length ? '<div class="opf-pod-t">Le socle du réseau · les produits commandés par le plus de pharmacies</div><div class="opf-pods">' + podium.map(carte).join('') + '</div>' : '') +
        (shown.length ? groupes : '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t">Aucun résultat</div></div></div>') +
        (list.length > shown.length ? '<div class="opf-more"><button class="v2-btn" onclick="V2.opsoAchMore()">Voir plus (' + (list.length - shown.length) + ' de plus)</button></div>' : '') +
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

  // ── Photos produit : fiches Offilog (EAN) + MKT_IMG (CIP13), les mêmes que
  // l'écran Offilog et les supports Marketing. Chargées APRÈS le premier
  // affichage (2,3 Mo) ; la liste se redessine quand elles arrivent. Sans
  // photo : les initiales du produit.
  var _photoIdx = null, _photoLoading = false;
  function cip13(code) {
    var c = String(code == null ? '' : code).replace(/\D/g, '');
    if (c.length !== 7) return c;
    var b = '34009' + c, s = 0;
    for (var i = 0; i < 12; i++) s += (+b[i]) * (i % 2 ? 3 : 1);
    return b + ((10 - s % 10) % 10);
  }
  function photoDe(code) {
    if (!_photoIdx) {
      if (!window.OFFILOG_BEST && !window.MKT_IMG) return '';
      _photoIdx = {};
      (window.OFFILOG_BEST || []).forEach(function (b) { if (b && b.ean && b.img) _photoIdx[normCip(b.ean)] = b.img; });
      var M = window.MKT_IMG || {};
      Object.keys(M).forEach(function (k) { if (M[k] && !_photoIdx[normCip(k)]) _photoIdx[normCip(k)] = M[k]; });
    }
    return _photoIdx[normCip(cip13(code))] || _photoIdx[normCip(code)] || '';
  }
  function ensurePhotos() {
    if (_photoLoading || (window.OFFILOG_BEST && window.MKT_IMG)) return;
    _photoLoading = true;
    var files = [];
    // v2-offilog.js peut avoir déjà injecté le fichier : ne pas le recharger
    // (il déclare un `const` global, un 2ᵉ chargement lèverait une erreur).
    if (!window.OFFILOG_BEST && !document.querySelector('script[src*="offilog-bestsellers-data.js"]')) files.push('../../crm/v2/offilog-bestsellers-data.js?v=20260903b');
    if (!window.MKT_IMG && !document.querySelector('script[src*="mkt-images-data.js"]')) files.push('../../crm/v2/mkt-images-data.js?v=20260929k');
    var restants = files.length;
    if (!restants) return;
    files.forEach(function (src) {
      var sc = document.createElement('script');
      sc.src = src;
      sc.onload = sc.onerror = function () {
        if (--restants) return;
        _photoIdx = null;
        if (V2.route && V2.route.name === 'opsoachats') renderAchats(root$());
      };
      document.head.appendChild(sc);
    });
  }

  V2.opsoAchSearch = function (val) { achSearch = val || ''; achShown = 60; var r = root$(); if (r) gardeFocus(r, function () { renderAchats(r); }); };
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
      // Pastilles de partage (une par pharmacie cliente)
      + '.opf-dots{display:inline-flex;flex-wrap:wrap;gap:3px;max-width:100%}'
      + '.opf-dots i{width:8px;height:8px;border-radius:50%;background:var(--line,#E4E8F0)}'
      + '.opf-dots i.on{background:var(--ip-blue,#11a63c)}'
      // Vignette produit : photo sur un fond éclairé par le haut, initiales dessous
      + '.opf-thumb,.opf-pod-img{position:relative;flex:none;display:grid;place-items:center;overflow:hidden;background:radial-gradient(120% 90% at 50% 0%,#fff 0%,var(--surf-sunken,#F4F6FB) 100%);border:1px solid var(--line,#E4E8F0)}'
      + '.opf-thumb{width:44px;height:44px;border-radius:12px}'
      + '.opf-thumb b,.opf-pod-img b{font-weight:700;color:var(--ip-blue-d,#0d8530);letter-spacing:.02em}'
      + '.opf-thumb b{font-size:13px}'
      + '.opf-thumb img,.opf-pod-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;padding:4px}'
      + '.opf-li{gap:12px}'
      + '.opf-li-rk{color:var(--muted);width:26px;flex:none;font-size:13px}'
      + '.opf-count{margin:0 0 10px}'
      + '.opf-grp{margin-bottom:14px}'
      + '.opf-grp .v2-card-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}'
      // Podium « le socle du réseau »
      + '.opf-pod-t{font-weight:650;font-size:15px;margin:4px 0 12px;color:var(--ip-ink,#0B1633)}'
      + '.opf-pods{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-bottom:22px}'
      + '.opf-pod{position:relative;display:flex;flex-direction:column;gap:9px;padding:16px;border-radius:var(--r-card,18px);border:1px solid var(--line,#E4E8F0);background:linear-gradient(180deg,#fff 0%,var(--card-2,#FAFBFD) 100%);box-shadow:var(--sh-2)}'
      + '.opf-pod:first-child{background:radial-gradient(140% 80% at 50% 0%,var(--halo,#E6F7EC) 0%,#fff 62%);border-color:color-mix(in srgb,var(--ip-blue,#11a63c) 30%,var(--line,#E4E8F0))}'
      + '.opf-pod-rk{position:absolute;top:24px;left:26px;z-index:1;min-width:26px;height:26px;padding:0 7px;display:grid;place-items:center;border-radius:999px;background:#fff;border:1px solid var(--line,#E4E8F0);box-shadow:var(--sh-1);font-size:13px;font-weight:700;color:var(--ip-ink,#0B1633)}'
      + '.opf-pod-img{width:100%;height:112px;border-radius:14px}'
      + '.opf-pod-img b{font-size:26px}'
      + '.opf-pod-name{font-weight:650;font-size:14px;line-height:1.3;min-height:2.6em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
      + '.opf-pod-n{display:flex;align-items:baseline;gap:4px;font-size:13px;color:var(--muted)}'
      + '.opf-pod-n .mono{font-size:26px;font-weight:700;color:var(--ip-blue-d,#0d8530);line-height:1}'
      + '.opf-pod-foot{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);border-top:1px solid var(--line,#E4E8F0);padding-top:8px;margin-top:auto}'
      + '.opf-pod-foot .mono{color:var(--ip-ink,#0B1633);font-weight:600}'
      + '@media (max-width:520px){.opf-pods{grid-template-columns:1fr 1fr;gap:10px}.opf-pod{padding:12px}.opf-pod-img{height:84px}.opf-pod-n .mono{font-size:22px}.opf-pod .opf-dots{gap:2px}.opf-pod .opf-dots i{width:5px;height:5px}.opf-pod-rk{top:18px;left:18px}}'
      // 29/09/2026 — règle du brief « aucun texte < 13 px » : .v2-row-meta et
      // .v2-kpi-l/.v2-kpi-d (classes GÉNÉRIQUES de v2.css, à 12px partout dans
      // l'appli, sur des dizaines d'écrans déjà en ligne) ne sont PAS touchées
      // dans v2.css — ça régresserait tout le reste de l'app. Le correctif est
      // scopé aux deux écrans de ce module (.opf-page), chirurgical.
      + '.opf-page .v2-row-meta,.opf-page .v2-kpi-l,.opf-page .v2-kpi-d{font-size:13px}';
    document.head.appendChild(st);
  }
})();
