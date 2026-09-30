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
    return (info && info.d) || nomBench(code) || nomAmeli(code) || '';
  }
  // Libellé manquant partout ailleurs : la base Ameli open data (publique, 1,2 Mo) le connaît
  // souvent. Chargée en différé, seulement si un produit sans libellé est à l'écran ; les
  // libellés se posent alors en place (aucun re-rendu, la chorégraphie continue).
  function ameli() { try { return typeof AMELI_2025 !== 'undefined' ? AMELI_2025 : null; } catch (e) { return null; } }
  function nomAmeli(code) {
    var A = ameli(); if (!A) return '';
    var r = A[cip13(code)] || A[String(code)];
    return (r && r.lib) || '';
  }
  var _ameliDemande = false;
  function ensureAmeli() {
    if (_ameliDemande || ameli()) return;
    var r = root$(); if (!r || !r.querySelector('[data-lib]')) return;
    _ameliDemande = true;
    if (document.querySelector('script[src*="ameli-boxes-data.js"]')) return;
    var sc = document.createElement('script');
    sc.src = '../../crm/ameli-boxes-data.js?v=20261001';
    sc.onload = function () {
      _achCache = null;
      var rr = root$(); if (!rr) return;
      var ns = rr.querySelectorAll('[data-lib]');
      for (var i = 0; i < ns.length; i++) {
        var nom = nomAmeli(ns[i].getAttribute('data-lib'));
        if (nom) { ns[i].textContent = nom; ns[i].removeAttribute('data-lib'); }
      }
    };
    document.head.appendChild(sc);
  }
  // Nom affiché : le libellé, sinon « Produit sans libellé » et le CIP en petit.
  function nomHtml(code, d) {
    if (d) return esc(d);
    return '<span class="opx-nolib" data-lib="' + esc(code) + '">Produit sans libellé <small>CIP ' + esc(code) + '</small></span>';
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

  // ── Refonte UX 2 (30/09/2026, designer B) : primitives visuelles communes ──
  var reduceMv = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var _vueCle = null;
  // Vrai au PREMIER rendu d'un écran (pas à chaque frappe dans une recherche) :
  // la chorégraphie d'entrée ne se rejoue jamais sur un re-rendu.
  function premiereVue(cle) { var f = cle !== _vueCle; _vueCle = cle; return f && !reduceMv; }
  // Anneau de proportion (arc dessiné une fois à l'entrée).
  function anneau(frac, cls, clair) {
    var f = Math.max(0, Math.min(1, frac || 0));
    var c0 = clair ? '#ffffff' : '#92b9a2', c1 = clair ? '#cbe4d6' : '#3e7f59';
    return '<svg class="opx-ring ' + (cls || '') + '" viewBox="0 0 120 120" aria-hidden="true">' +
      '<defs><linearGradient id="opxg' + (cls || 'r') + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c0 + '"/><stop offset="1" stop-color="' + c1 + '"/></linearGradient></defs>' +
      '<circle class="t" cx="60" cy="60" r="50"/>' +
      '<circle class="v" cx="60" cy="60" r="50" pathLength="1" stroke="url(#opxg' + (cls || 'r') + ')" style="stroke-dasharray:' + f.toFixed(4) + ' 1"/></svg>';
  }
  // Courbe large (cartes clientes) : même principe que spark(), à l'échelle de la carte.
  function sparkL(vals, i) {
    if (!vals || vals.length < 2) return '';
    var W = 240, H = 52, pad = 4, mn = 0, mx = Math.max.apply(null, vals);
    if (mx <= 0) mx = 1;
    var pts = vals.map(function (v, k) { return [pad + k * (W - 2 * pad) / (vals.length - 1), H - pad - (v - mn) / (mx - mn) * (H - 2 * pad - 4)]; });
    var d = pts.map(function (q, k) { return (k ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('');
    var a = d + 'L' + pts[pts.length - 1][0].toFixed(1) + ',' + H + 'L' + pts[0][0].toFixed(1) + ',' + H + 'Z';
    var lp = pts[pts.length - 1];
    return '<svg class="opx-spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" style="--i:' + i + '"><path class="a" d="' + a + '"/><path class="l" pathLength="1" d="' + d + '"/><circle class="d" cx="' + lp[0].toFixed(1) + '" cy="' + lp[1].toFixed(1) + '" r="3.4"/></svg>';
  }
  // Nombre qui roule d'une valeur à l'autre (changement de mois) au lieu de clignoter.
  function roule(el, de, a, fmt) {
    if (!el) return;
    if (reduceMv || de === a) { el.textContent = fmt(a); return; }
    var t0 = null, dur = 460;
    function st(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(de + (a - de) * e);
      if (p < 1) requestAnimationFrame(st);
    }
    requestAnimationFrame(st);
    setTimeout(function () { el.textContent = fmt(a); }, dur + 400);
  }
  function lienFiche(id) {
    return 'tabindex="0" role="link" onkeydown="if(event.key===\'Enter\')this.click()" onclick="V2.go(\'opsopharmacies\',\'' + esc(id) + '\')"';
  }
  var potOuvert = false;
  V2.opsoPotToggle = function (o) { potOuvert = !!o; };

  function renderPharmaciesList(root) {
    injectAchStyle();
    var NB = netBase();
    var rows = computePharmaRows(NB);
    var clientes = rows.filter(function (r) { return r.cliente; }).sort(function (a, b) { return b.total - a.total; });
    var potentiel = rows.filter(function (r) { return !r.cliente; }).sort(function (a, b) { return a.p.name.localeCompare(b.p.name, 'fr'); });

    var q = fold(phSearch);
    function match(r) { return !q || fold(r.p.name).indexOf(q) >= 0 || fold(r.p.ville).indexOf(q) >= 0; }
    var clientesF = clientes.filter(match), potentielF = potentiel.filter(match);
    var entree = premiereVue('ph');

    var maxTotal = clientes.length ? Math.max(clientes[0].total, 1) : 1;
    var dernier = NB.mois && NB.mois.length ? NB.mois[NB.mois.length - 1] : null;
    var avant = NB.mois && NB.mois.length > 1 ? NB.mois[NB.mois.length - 2] : null;

    function ecart(r) {
      // Un écart arrondi à 0 % n'apprend rien (lignes réparties à parts égales) : on le tait.
      if (r.prevCa > 0 && Math.round((r.lastCa - r.prevCa) / r.prevCa * 1000)) {
        var pc = (r.lastCa - r.prevCa) / r.prevCa * 100;
        return '<span class="opso-d ' + (pc >= 0 ? 'up' : 'dn') + '">' + (pc >= 0 ? '▲ ' : '▼ ') + pct1(pc).replace('-', '') + '</span>';
      }
      return r.lastCa > 0 ? '<span class="opso-d new">nouveau</span>' : '';
    }
    function partTxt(r) { return pct1(NB.total ? r.total / NB.total * 100 : 0).replace('+', ''); }
    // Les 3 premières : grandes cartes éclairées (rang en grand, courbe large, part du cumul).
    function carteTop(r, idx) {
      var rk = clientes.indexOf(r) + 1;
      return '<a class="v2-row opx-top t' + rk + '" style="--i:' + idx + '" ' + lienFiche(r.p.id) + ' aria-label="' + esc(beau(r.p.name)) + ', ' + esc(euros(r.total)) + '">' +
        '<span class="opx-top-rk mono" aria-hidden="true">' + rk + '</span>' +
        '<span class="opx-cl-id"><span class="opso-av" aria-hidden="true">' + esc(initiales(r.p.name)) + '</span>' +
          '<span class="opx-cl-t"><span class="v2-row-name">' + esc(beau(r.p.name)) + '</span>' +
          '<span class="opx-cl-v">' + esc(beau(r.p.ville || '')) + ' · ' + r.nbProduits + ' produit' + (r.nbProduits > 1 ? 's' : '') + '</span></span></span>' +
        '<span class="opx-top-n"><b class="mono">' + euros(r.total) + '</b>' + ecart(r) + '</span>' +
        sparkL(r.serie, idx) +
        '<span class="opx-top-p"><span class="opx-cl-sh" aria-hidden="true"><i style="width:' + Math.max(2, Math.round(r.total / maxTotal * 100)) + '%"></i></span><em><b class="mono">' + partTxt(r) + '</b> du cumul</em></span>' +
      '</a>';
    }
    // Les suivantes : lignes compactes (rang, nom, courbe courte, montant, écart).
    function carte(r, idx) {
      var rk = clientes.indexOf(r) + 1;
      return '<a class="v2-row opx-cl" style="--i:' + idx + '" ' + lienFiche(r.p.id) + ' aria-label="' + esc(beau(r.p.name)) + ', ' + esc(euros(r.total)) + '">' +
        '<span class="opx-cl-rk mono">' + rk + '</span>' +
        '<span class="opx-cl-id"><span class="opso-av" aria-hidden="true">' + esc(initiales(r.p.name)) + '</span>' +
          '<span class="opx-cl-t"><span class="v2-row-name">' + esc(beau(r.p.name)) + '</span>' +
          '<span class="opx-cl-v">' + esc(beau(r.p.ville || '')) + ' · ' + r.nbProduits + ' produit' + (r.nbProduits > 1 ? 's' : '') + '</span></span></span>' +
        sparkL(r.serie, idx) +
        '<span class="opx-cl-n"><b class="mono">' + euros(r.total) + '</b>' + ecart(r) + '</span>' +
        '<span class="opx-cl-sh" aria-hidden="true"><i style="width:' + Math.max(2, Math.round(r.total / maxTotal * 100)) + '%"></i></span>' +
      '</a>';
    }
    // Pastille d'une adhérente sans achat (grille compacte, dans le dépliant).
    function pastille(r) {
      return '<a class="opx-pot-c" ' + lienFiche(r.p.id) + '>' +
        '<span class="opso-av off" aria-hidden="true">' + esc(initiales(r.p.name)) + '</span>' +
        '<span class="opx-pot-t"><b>' + esc(beau(r.p.name)) + '</b><em>' + esc(beau(r.p.ville || '')) + '</em></span></a>';
    }
    // Poids de chaque cliente dans le cumul : une bande proportionnelle.
    var bande = clientes.map(function (r, i) {
      var part = NB.total ? r.total / NB.total : 0;
      return '<span class="opx-seg" style="flex-grow:' + Math.max(1, Math.round(r.total)) + ';--i:' + i + ';--l:' + (Math.max(0, 1 - i * 0.045)).toFixed(3) + '" title="' + esc(beau(r.p.name)) + ' · ' + esc(euros(r.total)) + '" onclick="V2.go(\'opsopharmacies\',\'' + esc(r.p.id) + '\')">' +
        (part >= 0.05 ? '<b>' + esc(initiales(r.p.name)) + '</b><em class="mono">' + Math.round(part * 100) + ' %</em>' : '') + '</span>';
    }).join('');
    // Mur des adhérentes : une pastille par pharmacie du réseau, allumée si cliente.
    var mur = '';
    for (var m = 0; m < NB.adherentes; m++) mur += '<i' + (m < NB.pharmaClientes ? ' class="on"' : '') + ' style="--k:' + m + '"></i>';

    var ouvert = potOuvert || (!!q && potentielF.length > 0);
    var hero = '<section class="v2-card opx-hero opx-lit">' +
      '<div class="opx-hero-ring">' + anneau(NB.adherentes ? NB.pharmaClientes / NB.adherentes : 0, 'cl', true) +
        '<div class="opx-ring-c"><b class="mono"><span data-count="' + NB.pharmaClientes + '">' + NB.pharmaClientes + '</span><small>/' + NB.adherentes + '</small></b><span>clientes</span></div></div>' +
      '<div class="opx-hero-n">' +
        '<div class="opx-kv big"><span class="opx-lbl">Cumul HT</span><b class="mono" data-count="' + Math.round(NB.total) + '" data-fmt="eur">' + euros(NB.total) + '</b></div>' +
        (dernier ? '<div class="opx-kv"><span class="opx-lbl">' + MOIS_PLEIN[dernier.m - 1] + ' ' + dernier.y + '</span><b class="mono" data-count="' + Math.round(dernier.ca) + '" data-fmt="eur">' + euros(dernier.ca) + '</b></div>' : '') +
      '</div>' +
      '<div class="opx-hero-w"><span class="opx-lbl">Poids de chaque cliente</span><div class="opx-band" aria-hidden="true">' + bande + '</div></div>' +
    '</section>';

    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page opx-ph' + (entree ? ' opx-first' : '') + '">' +
        '<div class="opx-head"><div class="v2-page-title">Pharmacies</div><div class="opx-sub">' + esc(periodeTxt(NB)) + '</div></div>' +
        hero +
        '<div class="opso-search">' + ICO('search', 18, 2) + '<input class="v2-field" type="search" aria-label="Chercher une pharmacie ou une ville" placeholder="Chercher une pharmacie, une ville…" value="' + esc(phSearch) + '" oninput="V2.opsoPhSearch(this.value)"></div>' +
        '<div class="opx-sec-h"><h2><b class="mono">' + clientesF.length + '</b> cliente' + (clientesF.length > 1 ? 's' : '') + '</h2>' +
          (avant && dernier ? '<span class="opx-leg">écart ' + MOIS_ABREV[dernier.m - 1] + ' / ' + MOIS_ABREV[avant.m - 1] + '</span>' : '') + '</div>' +
        (clientesF.length ? (function () {
          var tops = clientesF.filter(function (r) { return clientes.indexOf(r) < 3; });
          var autres = clientesF.filter(function (r) { return clientes.indexOf(r) >= 3; });
          return (tops.length ? '<div class="opx-tops">' + tops.map(carteTop).join('') + '</div>' : '') +
            (autres.length ? '<div class="opx-grid">' + autres.map(function (r, k) { return carte(r, k + tops.length); }).join('') + '</div>' : '');
        })() : '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t">Aucune cliente trouvée</div></div></div>') +
        (potentielF.length ? '<details class="v2-card opx-pot"' + (ouvert ? ' open' : '') + ' ontoggle="V2.opsoPotToggle(this.open)">' +
          '<summary class="opx-pot-s"><span class="opx-pot-n"><b class="mono">' + potentielF.length + '</b> sans achat · potentiel</span>' +
            (q ? '' : '<span class="opx-wall" aria-hidden="true">' + mur + '</span>') +
            '<span class="opx-pot-chev" aria-hidden="true">' + ICO('chev', 18) + '</span></summary>' +
          '<div class="opx-pot-g">' + potentielF.map(pastille).join('') + '</div>' +
        '</details>' : '') +
      '</div>';
  }

  // Courbe mensuelle de la fiche : une colonne cliquable par mois, relevé en tête.
  var _fiCourbe = null;
  function courbeFiche(serie, mois) {
    var n = serie.length, mx = Math.max.apply(null, serie.concat([1])), W = 800, H = 220, top = 40, bas = 14;
    var ys = serie.map(function (v) { return top + (1 - v / mx) * (H - top - bas); });
    var xs = serie.map(function (v, k) { return (k + 0.5) / n * W; });
    var d = xs.map(function (x, k) { return (k ? 'L' : 'M') + x.toFixed(1) + ',' + ys[k].toFixed(1); }).join('');
    var a = d + 'L' + xs[n - 1].toFixed(1) + ',' + H + 'L' + xs[0].toFixed(1) + ',' + H + 'Z';
    var somme = serie.reduce(function (s, v) { return s + v; }, 0), moy = n ? somme / n : 0;
    var yMoy = top + (1 - moy / mx) * (H - top - bas);
    var best = serie.indexOf(Math.max.apply(null, serie));
    var cols = serie.map(function (v, k) {
      return '<button type="button" class="opx-ch-c' + (k === n - 1 ? ' on' : '') + (k === best ? ' best' : '') + '" style="--yf:' + (ys[k] / H).toFixed(4) + ';--k:' + k + '" onclick="V2.opsoFiMois(' + k + ')" aria-label="' + esc(MOIS_PLEIN[mois[k].m - 1] + ' ' + mois[k].y + ' : ' + euros(v)) + '">' +
        '<span class="opx-ch-v mono">' + euroK(v) + '</span><span class="opx-ch-dot"></span><span class="opx-ch-m">' + MOIS_ABREV[mois[k].m - 1] + '</span></button>';
    }).join('');
    return {
      moy: moy,
      html: '<div class="opx-ch" style="--n:' + n + '">' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
          '<defs><linearGradient id="opxarea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4e9f70" stop-opacity=".22"/><stop offset="1" stop-color="#4e9f70" stop-opacity="0"/></linearGradient></defs>' +
          '<path class="a" d="' + a + '"/><line class="m" x1="0" x2="' + W + '" y1="' + yMoy.toFixed(1) + '" y2="' + yMoy.toFixed(1) + '"/><path class="l" d="' + d + '"/></svg>' +
        '<div class="opx-ch-cols">' + cols + '</div></div>'
    };
  }
  V2.opsoFiMois = function (k) {
    var C = _fiCourbe, r = root$();
    if (!C || !r) return;
    var prev = C.sel; C.sel = k;
    var cs = r.querySelectorAll('.opx-ch-c');
    for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('on', i === k);
    var mEl = r.querySelector('.opx-ro-m'), vEl = r.querySelector('.opx-ro-v'), dEl = r.querySelector('.opx-ro-d');
    if (mEl) mEl.textContent = MOIS_PLEIN[C.mois[k].m - 1] + ' ' + C.mois[k].y;
    roule(vEl, C.serie[prev] || 0, C.serie[k], euros);
    if (dEl) dEl.innerHTML = deltaMois(C.serie, k);
  };
  function deltaMois(serie, k) {
    if (k < 1 || !(serie[k - 1] > 0)) return '';
    var pc = (serie[k] - serie[k - 1]) / serie[k - 1] * 100;
    if (!Math.round(pc * 10)) return '';
    return '<span class="opso-d ' + (pc >= 0 ? 'up' : 'dn') + '">' + (pc >= 0 ? '▲ ' : '▼ ') + pct1(pc).replace('-', '') + '</span>';
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
    var total = 0, lastCa = 0, prevCa = 0, produits = {}, parMois = {};
    salesP.forEach(function (s) {
      total += (s.mntNetHt || 0);
      if (s.artCode && ((s.mntNetHt || 0) > 0 || (s.qte || 0) > 0)) produits[s.artCode] = 1;
      if (s.year && s.month) {
        var k = s.year * 12 + s.month;
        parMois[k] = (parMois[k] || 0) + (s.mntNetHt || 0);
        if (lastKey != null && k === lastKey) lastCa += (s.mntNetHt || 0);
        if (prevKey != null && k === prevKey) prevCa += (s.mntNetHt || 0);
      }
    });
    var cliente = total > 0;
    var entree = premiereVue('fi|' + id);

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

    // Rang parmi les clientes et poids dans le cumul du réseau (même calcul que la liste).
    var rang = 0;
    if (cliente) {
      var cls = computePharmaRows(NB).filter(function (r) { return r.cliente; }).sort(function (a, b) { return b.total - a.total; });
      cls.forEach(function (r, i) { if (String(r.p.id) === String(id)) rang = i + 1; });
    }
    var part = NB.total ? total / NB.total : 0;
    var serie = mois.map(function (mo) { return parMois[mo.y * 12 + mo.m] || 0; });
    var courbe = cliente && serie.length > 1 ? courbeFiche(serie, mois) : null;
    _fiCourbe = courbe ? { serie: serie, mois: mois, sel: serie.length - 1 } : null;
    var dernier = mois.length ? mois[mois.length - 1] : null;
    var nProd = Object.keys(produits).length;

    var maxProd = top5.length ? Math.max(top5[0].ca, 1) : 1;
    // Sa place dans le réseau : les clientes en colonnes (même tri que la liste), la sienne allumée.
    var rangHtml = '';
    if (rang && courbe && cls.length > 1) {
      var mxr = Math.max(cls[0].total, 1);
      rangHtml = '<div class="opx-fh-rk" aria-hidden="true">' + cls.map(function (r, i) {
        return '<i' + (String(r.p.id) === String(id) ? ' class="on"' : '') + ' style="height:' + Math.max(4, Math.round(r.total / mxr * 100)) + '%;--i:' + i + '"></i>';
      }).join('') + '</div>';
    }
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page opx-fi' + (entree ? ' opx-first' : '') + '">' +
        '<div class="opf-fhead">' +
          '<span class="opso-av lg' + (cliente ? '' : ' off') + '" aria-hidden="true">' + esc(initiales(p.name)) + '</span>' +
          '<div class="opf-fhead-t"><div class="v2-page-title">' + esc(beau(p.name)) + '</div>' +
          '<div class="opx-sub">' + esc(beau(p.ville || '')) + (p.cp ? ' (' + esc(p.cp) + ')' : '') + (p.code ? ' · CIP ' + esc(p.code) : '') + '</div></div>' +
          '<span class="opso-chip' + (cliente ? '' : ' off') + '">' + (cliente ? 'Cliente' : 'Potentiel') + '</span>' +
        '</div>' +
        '<section class="v2-card opx-fh opx-lit">' +
          '<div class="opx-fh-ring">' + anneau(part, 'fi', true) + '<div class="opx-ring-c"><b class="mono">' + pct1(part * 100).replace('+', '') + '</b><span>du réseau</span></div></div>' +
          '<div class="opx-fh-n">' +
            '<div class="opx-kv big"><span class="opx-lbl">Cumul · ' + esc(periodeTxt(NB)) + '</span><b class="mono" data-count="' + Math.round(total) + '" data-fmt="eur">' + euros(total) + '</b></div>' +
            '<div class="opx-fh-pills">' +
              (rang ? '<span class="opx-pill"><b class="mono">n° ' + rang + '</b> sur ' + NB.pharmaClientes + ' clientes</span>' : '') +
              '<span class="opx-pill"><b class="mono" data-count="' + nProd + '">' + nProd + '</b> produit' + (nProd > 1 ? 's' : '') + '</span>' +
            '</div>' +
          '</div>' +
          (dernier && !courbe ? '<div class="opx-kv opx-fh-last"><span class="opx-lbl">' + MOIS_PLEIN[dernier.m - 1] + ' ' + dernier.y + '</span><b class="mono" data-count="' + Math.round(lastCa) + '" data-fmt="eur">' + euros(lastCa) + '</b>' + deltaMois(serie, serie.length - 1) + '</div>' : '') +
          rangHtml +
        '</section>' +
        (courbe ? '<section class="v2-card opx-curve">' +
            '<div class="opx-ro"><span class="opx-ro-m">' + MOIS_PLEIN[dernier.m - 1] + ' ' + dernier.y + '</span><b class="opx-ro-v mono">' + euros(serie[serie.length - 1]) + '</b><span class="opx-ro-d">' + deltaMois(serie, serie.length - 1) + '</span><span class="opx-ch-moy"><i aria-hidden="true"></i>moy. <b class="mono">' + euros(courbe.moy) + '</b>/mois</span></div>' +
            courbe.html + '</section>' :
          '<div class="v2-card" style="padding:18px 20px 8px"><div class="v2-empty"><div class="v2-empty-t">Aucun achat enregistré</div><div class="v2-empty-d">Cette officine n\'a pas encore commandé chez Intégral Pharma.</div></div></div>') +
        (top5.length ? '<section class="v2-card opx-pp"><div class="opx-sec-h in"><h2>Produits phares</h2></div>' +
          top5.map(function (x, i) {
            var b = Math.round(x.boites);
            return '<div class="opx-pp-r" style="--i:' + i + '">' +
              '<span class="opx-pp-rk mono">' + (i + 1) + '</span>' +
              '<div class="opx-pp-m"><div class="opx-pp-n">' + nomHtml(x.c, nomProduit(x.c, x.d)) + '</div>' +
              '<div class="opx-pp-bar" aria-hidden="true"><i style="width:' + Math.max(3, Math.round(x.ca / maxProd * 100)) + '%"></i></div></div>' +
              '<div class="opx-pp-v"><b class="mono">' + euros(x.ca) + '</b><em>' + b + ' boîte' + (b > 1 ? 's' : '') + '</em></div>' +
            '</div>';
          }).join('') +
        '</section>' : '') +
      '</div>';
    ensureAmeli();
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
      lines.push([csvCell(it.d || 'Produit sans libellé'), it.code, csvCell(CAT_LABELS[it.cat] || ''), it.n, NB.pharmaClientes, it.boites, Math.round(it.ca)].join(';'));
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

  var grpOuvert = {}, achSwap = false;
  V2.opsoGrpToggle = function (n, o) { grpOuvert[n] = !!o; };

  function renderAchats(root) {
    var NB = netBase();
    var D = computeAchats(NB);
    var list = achFiltered(D);
    var shown = list.slice(0, achShown);
    var entree = premiereVue('ach');
    var swap = achSwap && !reduceMv; achSwap = false;

    var cats = D.hasCat ? CAT_ORDER.filter(function (k) { return D.byCat[k] > 0; }) : [];
    var tabsHtml = '<button class="v2-tab' + (achTab === 'all' ? ' on' : '') + '" onclick="V2.opsoAchTab(\'all\')">Tous<em>' + D.items.length + '</em></button>' +
      cats.map(function (k) {
        return '<button class="v2-tab' + (achTab === k ? ' on' : '') + '" onclick="V2.opsoAchTab(\'' + k + '\')">' + esc(CAT_LABELS[k]) + '<em>' + D.byCat[k] + '</em></button>';
      }).join('');
    // Au téléphone, les 8 onglets deviennent une liste déroulante (plus rien hors cadre).
    var selHtml = '<select class="v2-field opx-tabsel" aria-label="Catégorie" onchange="V2.opsoAchTab(this.value)">' +
      '<option value="all"' + (achTab === 'all' ? ' selected' : '') + '>Tous · ' + D.items.length + '</option>' +
      cats.map(function (k) { return '<option value="' + k + '"' + (achTab === k ? ' selected' : '') + '>' + esc(CAT_LABELS[k]) + ' · ' + D.byCat[k] + '</option>'; }).join('') +
    '</select>';

    var NC = NB.pharmaClientes || 0;
    function nPh(n) { return n + ' pharmacie' + (n > 1 ? 's' : ''); }
    function bt(b) { return b + ' boîte' + (b > 1 ? 's' : ''); }
    // Une pastille par pharmacie cliente (pleine = elle commande ce produit).
    function pastilles(n) {
      var s = '';
      for (var i = 0; i < NC; i++) s += '<i' + (i < n ? ' class="on"' : '') + ' style="--k:' + i + '"></i>';
      return '<span class="opx-dots" aria-hidden="true" style="--nc:' + NC + '">' + s + '</span>';
    }
    function vignette(it, cls) {
      var src = photoDe(it.code);
      var ini = esc((it.d || '?').replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 2).toUpperCase());
      return '<span class="' + cls + '" data-code="' + esc(it.code) + '">' +
        (src ? '<img src="' + esc(src) + '" loading="lazy" alt="" onerror="this.remove()">' : '') +
        '<b>' + ini + '</b></span>';
    }
    // Podium : les 3 premiers sur des marches (2 · 1 · 3), sur une scène éclairée.
    // Avec photo : la boîte posée sur un plateau, l'anneau « n sur 19 » en médaillon.
    // Sans photo : aucun cadre vide, l'anneau devient le visuel de la marche.
    function marche(it, i) {
      var src = photoDe(it.code);
      return '<div class="opx-pod p' + (i + 1) + (src ? ' has-img' : '') + '" style="--i:' + i + '">' +
        '<div class="opx-pod-vis">' +
          '<span class="opx-pod-img" data-code="' + esc(it.code) + '" data-pod="1">' + (src ? '<img src="' + esc(src) + '" alt="" onerror="var p=this.closest(\'.opx-pod\');if(p)p.classList.remove(\'has-img\');this.remove()">' : '') + '</span>' +
          '<div class="opx-pod-ring">' + anneau(NC ? it.n / NC : 0, 'p' + (i + 1), true) + '<div class="opx-ring-c"><b class="mono">' + it.n + '<small>/' + NC + '</small></b><span>pharmacies</span></div></div>' +
        '</div>' +
        '<div class="opx-pod-name">' + nomHtml(it.code, it.d) + '</div>' +
        '<div class="opx-pod-foot"><b class="mono">' + euros(it.ca) + '</b><span>' + bt(it.boites) + '</span></div>' +
        '<div class="opx-step"><span class="mono">' + (i + 1) + '</span></div>' +
      '</div>';
    }
    // Suivants du podium (4 à 6) : cartes compactes.
    function suivant(it, i) {
      return '<div class="opx-run" style="--i:' + i + '"><span class="opx-run-rk mono">' + (i + 1) + '</span>' + vignette(it, 'opf-thumb') +
        '<div class="opx-run-t"><div class="opx-run-n">' + nomHtml(it.code, it.d) + '</div><div class="opx-run-g"><span class="opx-li-bar" aria-hidden="true"><i style="width:' + (NC ? Math.round(it.n / NC * 100) : 0) + '%"></i></span><b class="mono">' + it.n + '/' + NC + '</b></div></div>' +
        '<div class="opx-run-v"><b class="mono">' + euros(it.ca) + '</b><span>' + bt(it.boites) + '</span></div></div>';
    }
    // Ligne d'un groupe : le nombre de pharmacies est porté par l'en-tête du groupe ;
    // la ligne montre le CA en barre (relatif au premier CA du groupe).
    function ligne(it, rk, maxCa) {
      return '<div class="opx-li">' +
        '<span class="opx-li-rk mono">' + rk + '</span>' + vignette(it, 'opf-thumb') +
        '<div class="opx-li-t"><div class="opx-li-n">' + nomHtml(it.code, it.d) + '</div><span class="opx-li-bar" aria-hidden="true"><i style="width:' + Math.max(3, Math.round(it.ca / maxCa * 100)) + '%"></i></span></div>' +
        '<div class="opx-li-v"><b class="mono">' + euros(it.ca) + '</b><span>' + bt(it.boites) + '</span></div>' +
      '</div>';
    }
    var nPod = achSearch ? 0 : Math.min(6, shown.length);
    var podium = shown.slice(0, nPod), reste = shown.slice(nPod);
    // Groupes par nombre de pharmacies, repliables ; le premier est ouvert.
    var groupes = [], cur = null;
    reste.forEach(function (it, j) {
      if (!cur || cur.n !== it.n) { cur = { n: it.n, items: [], rk0: nPod + j + 1 }; groupes.push(cur); }
      cur.items.push(it);
    });
    var groupesHtml = groupes.map(function (g, gi) {
      var nb = list.filter(function (x) { return x.n === g.n; }).length;
      var ouvert = achSearch ? true : (grpOuvert.hasOwnProperty(g.n) ? grpOuvert[g.n] : gi === 0);
      var maxCa = Math.max.apply(null, g.items.map(function (x) { return x.ca; }).concat([1]));
      return '<details class="v2-card opx-grp"' + (ouvert ? ' open' : '') + ' ontoggle="V2.opsoGrpToggle(' + g.n + ',this.open)">' +
        '<summary class="opx-grp-s" aria-label="' + esc('Commandés par ' + nPh(g.n) + ', ' + nb + ' produit' + (nb > 1 ? 's' : '')) + '"><span class="opx-grp-n"><b class="mono">' + g.n + '</b><span>sur ' + NC + '</span></span>' +
          '<span class="opx-grp-d">' + pastilles(g.n) + '</span>' +
          '<span class="opx-grp-c mono">' + nb + ' produit' + (nb > 1 ? 's' : '') + '</span>' +
          '<span class="opx-pot-chev" aria-hidden="true">' + ICO('chev', 18) + '</span></summary>' +
        '<div class="opx-grp-b">' + g.items.map(function (it, k) { return ligne(it, g.rk0 + k, maxCa); }).join('') + '</div>' +
      '</details>';
    }).join('');

    var ordre = [1, 0, 2].filter(function (k) { return k < Math.min(3, podium.length); });
    injectAchStyle();
    ensurePhotos();
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page opx-ach' + (entree ? ' opx-first' : '') + '">' +
        '<div class="opx-head"><div class="v2-page-title">Meilleurs achats</div>' +
          '<div class="opx-sub">Classés par nombre de pharmacies qui les commandent' +
          '<details class="opx-info"><summary aria-label="Comment c\'est classé">i</summary><span>À égalité, par quantités puis par CA. ' + (D.hasCat ? '' : 'Catégories en cours de chargement. ') + '</span></details>' +
          ' · ' + esc(periodeTxt(NB)) + '</div></div>' +
        '<div class="opf-tools">' +
          '<div class="opso-search">' + ICO('search', 18, 2) + '<input class="v2-field" type="search" aria-label="Chercher un produit ou un CIP" placeholder="Chercher un produit, un CIP…" value="' + esc(achSearch) + '" oninput="V2.opsoAchSearch(this.value)"></div>' +
          '<button class="v2-btn v2-btn-ghost opf-export" onclick="V2.opsoAchExport()">' + ICO('download', 16) + ' Exporter (CSV)</button>' +
        '</div>' +
        '<div class="v2-tabs opx-tabs">' + tabsHtml + '</div>' + selHtml +
        '<div class="opx-list' + (swap ? ' opx-swap' : '') + '">' +
          '<div class="opx-count"><b class="mono">' + list.length + '</b> référence' + (list.length > 1 ? 's' : '') + '</div>' +
          (podium.length ? '<section class="opx-podium">' +
              '<div class="opx-stage opx-lit">' + ordre.map(function (k) { return marche(podium[k], k); }).join('') + '</div>' +
              (podium.length > 3 ? '<div class="opx-runs">' + podium.slice(3).map(function (it, k) { return suivant(it, k + 3); }).join('') + '</div>' : '') +
            '</section>' : '') +
          (shown.length ? groupesHtml : '<div class="v2-card"><div class="v2-empty"><div class="v2-empty-t">Aucun résultat</div></div></div>') +
          (list.length > shown.length ? '<div class="opf-more"><button class="v2-btn" onclick="V2.opsoAchMore()">Voir plus (' + (list.length - shown.length) + ' de plus)</button></div>' : '') +
        '</div>' +
      '</div>';

    ensureAmeli();
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
        // Les photos se posent en place (pas de re-rendu : la chorégraphie d'entrée continue).
        var r = root$();
        if (!r || !V2.route || V2.route.name !== 'opsoachats') return;
        var vs = r.querySelectorAll('[data-code]');
        for (var i = 0; i < vs.length; i++) {
          if (vs[i].querySelector('img')) continue;
          var ph = photoDe(vs[i].getAttribute('data-code'));
          if (!ph) continue;
          var im = document.createElement('img'); im.src = ph; im.alt = ''; im.loading = 'lazy';
          im.onerror = function () { var pp = this.closest('.opx-pod'); if (pp) pp.classList.remove('has-img'); this.remove(); };
          vs[i].insertBefore(im, vs[i].firstChild);
          var pod = vs[i].closest('.opx-pod'); if (pod) pod.classList.add('has-img');
        }
      };
      document.head.appendChild(sc);
    });
  }

  V2.opsoAchSearch = function (val) { achSearch = val || ''; achShown = 60; var r = root$(); if (r) gardeFocus(r, function () { renderAchats(r); }); };
  V2.opsoAchTab = function (k) { achTab = k; achShown = 60; achSwap = true; var r = root$(); if (r) renderAchats(r); };
  V2.opsoAchMore = function () { achShown += 60; var r = root$(); if (r) renderAchats(r); };

  V2.pages.opsoachats = { needs: [], render: renderAchats };

  // ── Offilog (rendu par le module partagé v2-offilog.js, non modifié) : ce
  // module ne fait qu'orchestrer l'entrée à l'écran — une classe posée au
  // premier rendu de l'écran, retirée une fois la cascade jouée, et un indice
  // d'ordre sur les premiers éléments. Aucune donnée n'est touchée.
  (function () {
    if (reduceMv || !('MutationObserver' in window)) return;
    var vu = false, enCours = false;
    function orchestre() {
      var r = root$(), onOff = V2.route && V2.route.name === 'offilog';
      if (!onOff) { vu = false; enCours = false; return; }
      if (vu || enCours || !r) return;
      var wrap = r.querySelector('.v2-wrap'), cartes = r.querySelectorAll('.off-card');
      if (!wrap || !cartes.length) return;
      vu = true; enCours = true;
      var groupes = [r.querySelectorAll('.offb-n'), r.querySelectorAll('.offr'), cartes];
      groupes.forEach(function (g) { for (var i = 0; i < g.length && i < 16; i++) g[i].style.setProperty('--oi', i); });
      wrap.classList.add('opx-off');
      setTimeout(function () { wrap.classList.remove('opx-off'); enCours = false; }, 1900);
    }
    function brancher() {
      var r = root$();
      if (!r) { setTimeout(brancher, 400); return; }
      new MutationObserver(orchestre).observe(r, { childList: true, subtree: true });
    }
    brancher();
  })();

  function injectAchStyle() {
    if (document.getElementById('opf-style')) return;
    var st = document.createElement('style'); st.id = 'opf-style';
    st.textContent = ''
      // Vignette produit : photo sur un fond éclairé par le haut, initiales dessous
      + '.opf-thumb,.opx-pod-img{position:relative;flex:none;display:grid;place-items:center;overflow:hidden;background:radial-gradient(120% 90% at 50% 0%,#fff 0%,var(--surf-sunken,#F4F6FB) 100%);border:1px solid var(--line,#E4E8F0)}'
      + '.opf-thumb{width:44px;height:44px;border-radius:12px}'
      + '.opf-thumb b,.opx-pod-img b{font-weight:700;color:var(--ip-blue-d,#3e7f59);letter-spacing:.02em}'
      + '.opf-thumb b{font-size:13px}'
      + '.opf-thumb img,.opx-pod-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff;padding:4px}'
      // 29/09/2026 — règle du brief « aucun texte < 13 px » : .v2-row-meta et
      // .v2-kpi-l/.v2-kpi-d (classes GÉNÉRIQUES de v2.css, à 12px partout dans
      // l'appli, sur des dizaines d'écrans déjà en ligne) ne sont PAS touchées
      // dans v2.css — ça régresserait tout le reste de l'app. Le correctif est
      // scopé aux deux écrans de ce module (.opf-page), chirurgical.
      + '.opf-page .v2-row-meta,.opf-page .v2-kpi-l,.opf-page .v2-kpi-d{font-size:13px}';
    document.head.appendChild(st);
  }
})();
