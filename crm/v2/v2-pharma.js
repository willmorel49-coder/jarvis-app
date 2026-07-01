/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Opportunités pharmacie" (pages.pharma)
   Vue A : liste des officines (CA du mois + marge MDL générée)
   Vue B : fiche opportunités — top marché OPS+CPR+HP que la pharma
           ne commande PAS, classé en 8 catégories.
   ── Vanilla JS pur · IIFE · zéro dépendance · zéro emoji ──
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {}; // ce fichier charge AVANT v2-app.js → on garantit le registry

  // helpers locaux (V2.esc/V2.cap définis dans v2-app.js, chargé APRÈS → on défère)
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // ── State local module (toggle cartes catégories + recherche) ──
  // collapsed[catKey] === true → carte repliée. Par défaut : 1ère ouverte.
  var collapsed = {};
  // Repli des sections secondaires de la fiche (Top 5, Best-sellers IP).
  // true = repliée. Par défaut repliées (cf. sectionOpen()).
  var sectionCollapsed = {};
  function sectionOpen(key) { return (key in sectionCollapsed) ? !sectionCollapsed[key] : false; }
  var searchQuery = '';
  // Sélection de produits cochés (bouton +) pour le PDF RDV — propre à une pharma
  var selCips = null;   // Set des CIP cochés
  var selPid = null;    // pharma à laquelle appartient la sélection courante
  // Filtre segment OPSO : 'all' | 'cliente' | 'prospect'
  var opsoFilter = 'all';
  // Sous-onglet Opportunités : 'officines' | 'groupements' | 'listes'
  var pharmaView = 'officines';
  var selGroup = null;        // groupement ouvert
  var netScope = 'reseau';    // réf. de la reco fiche : 'reseau' (réseau IP) | 'groupement' (son groupement)
  var recoFam = null;         // famille active dans la fiche officine (master-détail)
  var recoInitKey = null;     // (pid|scope) déjà pré-sélectionné ? — tout coché par défaut
  var grpListFilter = 'all';  // listing best rotations groupement : 'all' | 'gap' (ce qu'elle ne commande pas)
  var selList = null;         // liste personnalisée ouverte (id)
  var grpCollapsed = {};      // repli des catégories en vue groupement / liste

  // ── Listes personnalisées (Big pharma, PDA, NR…) — localStorage ──
  var LISTS_KEY = 'v2_pharma_lists';
  function listsGet() { try { return JSON.parse(localStorage.getItem(LISTS_KEY) || '[]'); } catch (e) { return []; } }
  function listsSave(a) { try { localStorage.setItem(LISTS_KEY, JSON.stringify(a)); } catch (e) {} }
  function listGet(id) { var a = listsGet(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function listUpsert(l) { var a = listsGet(), f = false; for (var i = 0; i < a.length; i++) { if (a[i].id === l.id) { a[i] = l; f = true; } } if (!f) a.push(l); listsSave(a); }
  function listIdsObj(l) { var o = {}; (l && l.ids || []).forEach(function (id) { o[String(id)] = 1; }); return o; }
  // état temporaire du sélecteur d'ajout de pharmacies
  var plPick = { q: '', grp: '', set: null };

  // ── Helpers OPSO ──────────────────────────────────────────────
  function isOpso() { return !!(window.V2_BRAND && window.V2_BRAND.opso); }

  // Badge HTML cliente / prospect (OPSO uniquement)
  function opsoBadge(p) {
    if (!isOpso()) return '';
    if (p.inDb) {
      return '<span class="opso-badge opso-badge-cliente">Cliente</span>';
    }
    return '<span class="opso-badge opso-badge-prospect">Prospect</span>';
  }

  // ── Définition des 8 catégories (ordre EXACT du brief) ─────────
  var CATS = [
    { key: 'pp',     label: 'Princeps · Petits prix',    sub: '0 – 4,33 €',      color: '#1E9E6A', cap: 30 },
    { key: 'mi',     label: 'Princeps · Intermédiaires', sub: '4,33 – 468 €',    color: '#0050E6', cap: 30 },
    { key: 'ch',     label: 'Princeps · Chers',          sub: '> 468 €',         color: '#C7791A', cap: 20 },
    { key: 'froid',  label: 'Froid',                     sub: 'chaîne du froid', color: '#00B5D8', cap: 30 },
    { key: 'gen',    label: 'Génériques',                sub: '',                color: '#737A8C', cap: 30 },
    { key: 'genp',   label: 'Génériques partenaires',    sub: '',                color: '#1E9E6A', cap: 30 },
    { key: 'biosim', label: 'Biosimilaires',             sub: '',                color: '#6D4FC4', cap: 20 },
    { key: 'nr',     label: 'Non remboursés',            sub: 'marge libre',     color: '#C7791A', cap: 30 }
  ];

  // ── Index BENCHMARK (Map cip13 → bench) — construit une seule fois ──
  var _benchIdx = null;
  var _nrIdx = null; // Set des CIP NR (Sagitta shortlist)
  function benchIndex() {
    if (_benchIdx) return _benchIdx;
    _benchIdx = new Map();
    var B = window.BENCHMARK || [];
    for (var i = 0; i < B.length; i++) {
      var b = B[i];
      if (b.cip13) _benchIdx.set(String(b.cip13), b);
    }
    return _benchIdx;
  }
  function nrIndex() {
    if (_nrIdx) return _nrIdx;
    _nrIdx = new Set();
    var S = window.SAGITTA_SHORTLIST || [];
    for (var i = 0; i < S.length; i++) {
      var c = String(S[i].cip13 || S[i].cip || '');
      if (c) _nrIdx.add(c);
    }
    return _nrIdx;
  }

  // Remboursable = présent en BENCHMARK avec has_ameli ET pas NR Sagitta
  function isRemboursable(cip) {
    var c = String(cip || '');
    if (!c) return false;
    if (nrIndex().has(c)) return false;
    var b = benchIndex().get(c);
    return !!(b && b.has_ameli === true);
  }

  // ── Marge MDL générée par une pharma (sur ses ventes remboursables) ──
  function margeMDLpharma(sales) {
    var total = 0;
    for (var i = 0; i < sales.length; i++) {
      var s = sales[i];
      if (isRemboursable(s.artCode)) {
        total += V2.margeMDLboite(s.puNet || 0) * (s.qte || 0);
      }
    }
    return total;
  }

  // ── Ventes d'une pharma ────────────────────────────────────────
  // Index ventes par pharmacie (construit 1× par jeu de données) — évite N×filter(325k)
  var _salesIdx = null, _salesIdxRef = null;
  function salesIndex() {
    if (_salesIdx && _salesIdxRef === V2.sales) return _salesIdx;
    _salesIdx = {}; var S = V2.sales || [];
    for (var i = 0; i < S.length; i++) { var k = String(S[i].pharmacyId); (_salesIdx[k] || (_salesIdx[k] = [])).push(S[i]); }
    _salesIdxRef = V2.sales; return _salesIdx;
  }
  // toutes ventes d'une pharma, TOUS commerciaux (vue groupements = vue d'équipe)
  function pharmaSalesAll(pid) { return salesIndex()[String(pid)] || []; }
  function pharmaSales(pid) {
    var base = pharmaSalesAll(pid);
    return V2.commFilter ? base.filter(function (s) { return s.commercial === V2.commFilter; }) : base;
  }
  // libellé période couverte par les données (ex. "cumul 5 mois · janv.–mai 2026")
  function periodLabel() {
    var MN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    var ms = {}, yr = null;
    (V2.sales || []).forEach(function (s) { if (s.month) { ms[s.month] = 1; if (s.year) yr = s.year; } });
    var ks = Object.keys(ms).map(Number).sort(function (a, b) { return a - b; });
    if (!ks.length) return '';
    var span = MN[ks[0] - 1] + '–' + MN[ks[ks.length - 1] - 1] + (yr ? ' ' + yr : '');
    return 'cumul ' + ks.length + ' mois · ' + span;
  }

  // ── Classement d'un produit benchmark dans une des 8 catégories ──
  // Priorité : NR > biosim > gen.part > gen > froid > princeps(pp/mi/ch)
  function classify(b, cip) {
    if (!b) return null;
    var nat = String(b.artnature || '').toLowerCase();
    // 8. Non remboursés : dans Sagitta OU has_ameli=false
    if (nrIndex().has(cip) || b.has_ameli === false) return 'nr';
    // 7. Biosimilaires
    if (nat === 'biosimilaire') return 'biosim';
    // 6. Génériques partenaires
    if (nat === 'generique_partenaire') return 'genp';
    // 5. Génériques
    if (nat === 'generique') return 'gen';
    // 4. Froid
    if (b.is_froid === true) return 'froid';
    // 1-3. Princeps par tranche prix (champ categorie : pp/mi/ch)
    if (b.categorie === 'pp' || b.categorie === 'mi' || b.categorie === 'ch') return b.categorie;
    return null; // hors périmètre des 8 catégories
  }

  // ── Fusion OPS + CPR + HP par CIP (cumul qte/ca + détail par source) ──
  // Clé commune : ean (= CIP13, identique à BENCHMARK.cip13 et sales.artCode)
  // Retourne Map cip13 → { cip, qte, ca, ops, cpr, hp, designation }
  var _marketCache = null;
  function mergeMarket() {
    if (_marketCache) return _marketCache;
    var out = new Map();
    var sources = [
      { agg: window.OPS_AGGREGATE, k: 'ops' },
      { agg: window.CPR_AGGREGATE, k: 'cpr' },
      { agg: window.HP_AGGREGATE,  k: 'hp' }
    ];
    for (var si = 0; si < sources.length; si++) {
      var agg = sources[si].agg, k = sources[si].k;
      if (!agg) continue;
      for (var code in agg) {
        if (!Object.prototype.hasOwnProperty.call(agg, code)) continue;
        var row = agg[code];
        var cip = String(row.ean || ''); // ean = CIP13
        if (!cip) continue;
        var cur = out.get(cip);
        if (!cur) { cur = { cip: cip, qte: 0, ca: 0, ops: 0, cpr: 0, hp: 0, designation: row.designation || '' }; out.set(cip, cur); }
        var q = row.qte || 0;
        cur.qte += q;
        cur.ca += row.ca || 0;
        cur[k] += q;
        if (!cur.designation && row.designation) cur.designation = row.designation;
      }
    }
    _marketCache = out;
    return out;
  }

  // ── Construit les opportunités par catégorie pour une pharma ────
  function buildOpportunities(pid) {
    var sales = pharmaSales(pid);
    // CIP déjà commandés par cette pharma
    var owned = new Set();
    sales.forEach(function (s) {
      var c = String(s.artCode || '');
      if (c.length >= 7) owned.add(c);
    });

    var bIdx = benchIndex();
    var market = mergeMarket();

    // buckets par catégorie
    var buckets = {};
    CATS.forEach(function (c) { buckets[c.key] = []; });

    market.forEach(function (m, cip) {
      if (owned.has(cip)) return;            // déjà commandé → pas une opp
      var b = bIdx.get(cip);
      if (!b) return;                        // pas dans le catalogue IP → on ignore
      var cat = classify(b, cip);
      if (!cat || !buckets[cat]) return;
      var bp = V2.bestPrice(b);
      buckets[cat].push({
        cip: cip,
        designation: b.designation || m.designation || '',
        prix_ip: bp.ip,
        offre: bp.offre,
        marketQte: m.qte,
        ops: m.ops, cpr: m.cpr, hp: m.hp
      });
    });

    // tri par qté marché desc + cap par catégorie
    return CATS.map(function (c) {
      var rows = buckets[c.key];
      rows.sort(function (a, b) { return b.marketQte - a.marketQte; });
      var totalQte = rows.reduce(function (s, r) { return s + r.marketQte; }, 0);
      return { cat: c, rows: rows.slice(0, c.cap), oppCount: rows.length, totalQte: totalQte };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ── Analyse VOLUMES IP : best-sellers IP (par volume) que la pharma ne prend pas
  function buildIpVolumeReco(pid, limit) {
    var B = window.BENCHMARK || [];
    if (!B.length) return null;
    var bought = {};
    pharmaSales(pid).forEach(function (s) {
      var c = String(s.artCode == null ? '' : s.artCode).trim();
      if (c) bought[c] = (bought[c] || 0) + (s.qte || 0);
    });
    var top = B.filter(function (b) { return (+b.ip_qty || 0) > 0; })
      .sort(function (a, b) { return (+b.ip_qty || 0) - (+a.ip_qty || 0); });
    var manque = [];
    for (var i = 0; i < top.length && manque.length < (limit || 40); i++) {
      var b = top[i];
      var q = bought[String(b.cip13 == null ? '' : b.cip13).trim()] || 0;
      if (q === 0) manque.push(b);
    }
    return { manque: manque, total: top.length };
  }

  function ipVolumeSection(pid) {
    var reco = buildIpVolumeReco(pid, 40);
    if (!reco || !reco.manque.length) return '';
    var rows = reco.manque.map(function (b) {
      var rank = b.ip_rank_qty ? ('#' + b.ip_rank_qty) : '';
      var cip = String(b.cip13 == null ? '' : b.cip13).trim();
      var on = selCips && selCips.has(cip);
      return '<div class="ipv-row">' +
        '<span class="ipv-rank">' + rank + '</span>' +
        '<span class="ipv-name">' + esc(cap((b.designation || '').toLowerCase())) + '</span>' +
        '<span class="ipv-vol">' + V2.fmtNum(+b.ip_qty || 0) + ' u<small>/an IP</small></span>' +
        '<button type="button" class="opp-add' + (on ? ' on' : '') + '" data-cip="' + esc(cip) +
          '" onclick="V2.pharmaToggleSel(this)" aria-label="Ajouter au PDF RDV">' + (on ? '✓' : '+') + '</button>' +
        '</div>';
    }).join('');
    var open = sectionOpen('ipv');
    return '<div class="ph-section">' +
      sectionHead('Best-sellers IP à pousser',
        'les produits qui sortent le plus chez Intégral Pharma (volume) que cette officine ne commande pas',
        'ipv', open) +
      (open ? '<div class="v2-card" style="padding:6px 0">' + rows + '</div>' : '') +
      '</div>';
  }

  // ── Réseau : par CIP, nb de pharmacies qui le commandent + volume total (rotation) ──
  // Statistiques CIP → {ph:Set des pharmacies, qte}. Calculées sur tout le réseau,
  // ou restreintes à un sous-ensemble de pharmacies (pidSet) pour la vue groupement.
  var _statsCache = {};
  function computeStats(key, pidSet) {
    if (_statsCache[key]) return _statsCache[key];
    var m = new Map(), phies = {}, months = {};
    (V2.sales || []).forEach(function (s) {
      var pid = String(s.pharmacyId);
      if (pidSet && !pidSet.has(pid)) return;
      var c = String(s.artCode || ''); if (c.length < 7) return;
      phies[pid] = 1;
      if (s.month) months[(s.year || '') + '-' + s.month] = 1;
      var e = m.get(c); if (!e) { e = { ph: new Set(), qte: 0 }; m.set(c, e); }
      e.ph.add(pid); e.qte += (s.qte || 0);
    });
    _statsCache[key] = { map: m, total: Object.keys(phies).length, months: Object.keys(months).length || 5 };
    return _statsCache[key];
  }
  var _netTotal = 0, _statsMonths = 5;
  function cipStats() {
    var st = computeStats('__net__', null);
    _netTotal = st.total; _statsMonths = st.months;
    return st.map;
  }
  // Pharmacies du même groupement que `pid` (selon pharma.groupement).
  function groupementPids(pid) {
    var p = (V2.pharmacies || []).filter(function (x) { return String(x.id) === String(pid); })[0];
    var g = p && p.groupement ? String(p.groupement).trim() : '';
    if (!g) return { name: '', set: null };
    var set = new Set();
    (V2.pharmacies || []).forEach(function (x) { if (String(x.groupement || '').trim() === g) set.add(String(x.id)); });
    return { name: g, set: set };
  }
  // Rotation moyenne = boîtes/an pour une pharmacie qui le commande (moyenne réseau).
  function rotationYear(cip) {
    var e = cipStats().get(String(cip)); if (!e || !e.ph.size) return 0;
    return Math.round(e.qte / e.ph.size / _statsMonths * 12);
  }
  // Gain estimé = remise (PPHT - prix net) × rotation moyenne annuelle.
  function gainYear(b) {
    if (!b) return 0;
    var bp = V2.bestPrice(b), ht = bp.ht || 0, ip = bp.ip || 0;
    if (!(ht > 0 && ip > 0 && ip < ht)) return 0;
    return Math.round((ht - ip) * rotationYear(b.cip13));
  }
  V2.rotationYear = rotationYear; V2.gainYear = gainYear;   // réutilisable (marketing, prépa)

  // Produits que cette officine NE commande PAS, classés par nb de pharmacies (de la
  // référence choisie) qui les prennent. scope = 'reseau' (réseau IP) | 'groupement'.
  function buildNetworkReco(pid, limit, scope) {
    cipStats(); // initialise _netTotal/_statsMonths (réseau)
    var st, total;
    if (scope === 'groupement') {
      var g = groupementPids(pid);
      if (!g.set || g.set.size < 2) return { rows: [], total: 0, name: g.name };
      st = computeStats('grp:' + g.name, g.set); total = st.total;
    } else {
      st = computeStats('__net__', null); total = st.total;
    }
    var stats = st.map, bIdx = benchIndex();
    var owned = new Set();
    pharmaSales(pid).forEach(function (s) { var c = String(s.artCode || ''); if (c.length >= 7) owned.add(c); });
    var rows = [];
    stats.forEach(function (e, cip) {
      if (owned.has(cip)) return;
      var b = bIdx.get(cip); if (!b) return;          // doit être au catalogue IP pour être proposable
      var bp = V2.bestPrice(b);
      rows.push({ cip: cip, designation: b.designation || '', nb: e.ph.size, prix: bp.ip, offre: bp.offre,
                  froid: !!b.is_froid, rota: rotationYear(cip), gain: gainYear(b) });
    });
    rows.sort(function (a, b) { return b.nb - a.nb; });
    return { rows: rows.slice(0, limit || 40), total: total };
  }
  V2.setNetScope = function (s) { netScope = s; V2.render(); };
  function networkRecoSection(pid) {
    var g = groupementPids(pid);
    var scope = (netScope === 'groupement' && g.set && g.set.size >= 2) ? 'groupement' : 'reseau';
    var built = buildNetworkReco(pid, 40, scope);
    var reco = built.rows;
    var tot = built.total || _netTotal || (V2.pharmacies || []).length || 0;
    // Sélecteur de référence (réseau IP / son groupement)
    var toggle = '<div class="net-scope">' +
      '<button type="button" class="net-scope-b' + (scope === 'reseau' ? ' on' : '') + '" onclick="V2.setNetScope(\'reseau\')">Réseau Intégral Pharma</button>' +
      (g.name
        ? '<button type="button" class="net-scope-b' + (scope === 'groupement' ? ' on' : '') + '" onclick="V2.setNetScope(\'groupement\')">Son groupement · ' + esc(g.name) + '</button>'
        : '') +
      '</div>';
    var titre = scope === 'groupement'
      ? 'À pousser : son groupement le prend, pas elle'
      : 'À pousser : tout le réseau le prend, pas elle';
    var soustitre = scope === 'groupement'
      ? 'produits que le plus de pharmacies de ' + esc(g.name) + ' commandent et que cette officine n\'a pas — gain estimé = rotation moyenne × ta remise'
      : 'produits que le plus de pharmacies du réseau commandent et que cette officine n\'a pas — gain estimé = rotation moyenne × ta remise';
    var open = sectionOpen('netreco');
    if (!reco.length) {
      // groupement sélectionné mais trop peu de pharmacies / aucune reco → on garde le sélecteur
      if (scope === 'reseau') return '';
      return '<div class="ph-section">' +
        sectionHead(titre, soustitre, 'netreco', open) +
        (open ? '<div class="v2-card" style="padding:14px">' + toggle +
          '<div style="color:var(--muted);font-size:13px;padding:8px 4px">Pas assez de pharmacies de ce groupement dans tes données pour comparer. Bascule sur « Réseau Intégral Pharma ».</div></div>' : '') +
        '</div>';
    }
    var totalGain = reco.reduce(function (s, r) { return s + (r.gain || 0); }, 0);
    var rows = reco.map(function (r, i) {
      var on = selCips && selCips.has(r.cip);
      var pct = tot ? Math.min(100, Math.round(r.nb / tot * 100)) : 0;
      return '<div class="ipv-row">' +
        '<span class="ipv-rank">#' + (i + 1) + '</span>' +
        '<span class="ipv-name">' + esc(cap((r.designation || '').toLowerCase())) + (r.froid ? ' <span class="ph-froid">FROID</span>' : '') +
          '<small style="display:block;color:var(--muted);font-family:var(--mono)">' + V2.fmtNum(r.nb) + '/' + V2.fmtNum(tot) + ' phies (' + pct + '%)' + (r.rota > 0 ? ' · rotation ~' + V2.fmtNum(r.rota) + '/an' : '') + (r.prix > 0 ? ' · ' + V2.fmtEur(r.prix) + (r.offre ? ' <span class="ph-offre">offre</span>' : '') : '') + '</small></span>' +
        '<span class="ipv-vol" style="color:var(--c-opp);font-weight:800" title="rotation moyenne × remise PPHT→net">' + (r.gain > 0 ? '+' + V2.fmtEur(r.gain) + '<small>/an</small>' : '—') + '</span>' +
        '<button type="button" class="opp-add' + (on ? ' on' : '') + '" data-cip="' + esc(r.cip) +
          '" onclick="V2.pharmaToggleSel(this)" aria-label="Ajouter au PDF RDV">' + (on ? '✓' : '+') + '</button>' +
        '</div>';
    }).join('');
    return '<div class="ph-section">' +
      sectionHead(titre, soustitre, 'netreco', open) +
      (open ? '<div class="v2-card" style="padding:6px 0">' +
        '<div style="padding:10px 12px 4px">' + toggle + '</div>' +
        '<div class="ipv-row" style="background:var(--card-2)"><span class="ipv-rank"></span><span class="ipv-name" style="font-weight:700">Potentiel total de cette liste</span><span class="ipv-vol" style="color:var(--c-opp);font-weight:800">+' + V2.fmtEur(totalGain) + '<small>/an</small></span><span style="width:30px"></span></div>' +
        rows + '</div>' : '') +
      '</div>';
  }

  // Liste catégorisée (même moule que l'onglet groupement) : produits que la
  // référence (réseau IP ou son groupement) commande et que cette officine n'a PAS.
  function buildRecoCats(pid, scope) {
    cipStats();
    var st, total;
    if (scope === 'groupement') {
      var g = groupementPids(pid);
      if (!g.set || g.set.size < 2) return { cats: [], panel: 0, total: 0 };
      st = computeStats('grp:' + g.name, g.set); total = st.total;
    } else { st = computeStats('__net__', null); total = st.total; }
    var stats = st.map, bIdx = benchIndex();
    var grpScope = (scope === 'groupement');
    var owned = new Set();
    pharmaSales(pid).forEach(function (s) { var c = String(s.artCode || ''); if (c.length >= 7) owned.add(c); });
    // RÉSEAU : seuil de pénétration par famille (bas, pour avoir BEAUCOUP de produits et
    // bien répartis) + plafond par famille (équilibre, aucune famille n'écrase les autres).
    // GROUPEMENT : on prend TOUT ce que le groupement commande et qu'elle n'a pas (aucun seuil).
    var PEN = { pp: 0.20, mi: 0.08, gen: 0.08, genp: 0.08, nr: 0.08, ch: 0.04, froid: 0.04, biosim: 0.02 };
    var penFor = function (k) { return PEN[k] != null ? PEN[k] : 0.08; };
    var CAP = grpScope ? 200 : 40;   // plafond par famille
    var buckets = {}; CATS.forEach(function (c) { buckets[c.key] = []; });
    stats.forEach(function (e, cip) {
      if (owned.has(cip)) return;
      var b = bIdx.get(cip); if (!b) return;
      var cat = classify(b, cip); if (!cat || !buckets[cat]) return;
      if (!grpScope && total >= 2 && e.ph.size < Math.max(2, Math.ceil(total * penFor(cat)))) return;  // réseau : seuil
      var bp = V2.bestPrice(b), ht = bp.ht || 0, ip = bp.ip || 0;
      var rem = (ht > 0 && ip > 0 && ip <= ht) ? Math.round((1 - ip / ht) * 1000) / 10 : 0;
      buckets[cat].push({ cip: cip, designation: b.designation || '', prix_ht: ht, prix_ip: ip, offre: bp.offre,
                          remise: rem, froid: !!b.is_froid, sortie: e.ph.size, qte: e.qte });
    });
    return {
      panel: total, total: total,
      cats: CATS.map(function (c) {
        return { cat: c, rows: buckets[c.key].sort(function (a, b) { return b.sortie - a.sortie || b.qte - a.qte; }).slice(0, CAP) };
      }).filter(function (o) { return o.rows.length; })
    };
  }
  // Best rotations du groupement (ou réseau si pas de groupement), avec marqueur
  // "commande / ne commande pas" pour CETTE officine. Pour cibler en RDV.
  function grpBestRotations(pid, limit) {
    cipStats();
    var g = groupementPids(pid), st, total, isGrp = !!(g.set && g.set.size >= 2);
    if (isGrp) { st = computeStats('grp:' + g.name, g.set); total = st.total; }
    else { st = computeStats('__net__', null); total = st.total; }
    var stats = st.map, bIdx = benchIndex();
    var owned = new Set();
    pharmaSales(pid).forEach(function (s) { var c = String(s.artCode || ''); if (c.length >= 7) owned.add(c); });
    var rows = [];
    stats.forEach(function (e, cip) {
      var b = bIdx.get(cip); if (!b) return;
      var bp = V2.bestPrice(b), ht = bp.ht || 0, ip = bp.ip || 0;
      var rem = (ht > 0 && ip > 0 && ip <= ht) ? Math.round((1 - ip / ht) * 1000) / 10 : 0;
      rows.push({ cip: cip, designation: b.designation || '', prix_ip: ip, remise: rem, froid: !!b.is_froid, sortie: e.ph.size, qte: e.qte, owned: owned.has(cip) });
    });
    rows.sort(function (a, b) { return b.sortie - a.sortie || b.qte - a.qte; });
    return { rows: rows.slice(0, limit || 50), total: total, name: g.name, isGrp: isGrp };
  }
  V2.pharmaGrpFilter = function (f) { grpListFilter = f; V2.render(); };

  // Sélecteur de référence réutilisé (réseau IP / son groupement)
  function recoScopeToggle(pid) {
    var g = groupementPids(pid);
    var scope = (netScope === 'groupement' && g.set && g.set.size >= 2) ? 'groupement' : 'reseau';
    var html = '<div class="net-scope">' +
      '<button type="button" class="net-scope-b' + (scope === 'reseau' ? ' on' : '') + '" onclick="V2.setNetScope(\'reseau\')">Réseau Intégral Pharma</button>' +
      (g.name ? '<button type="button" class="net-scope-b' + (scope === 'groupement' ? ' on' : '') + '" onclick="V2.setNetScope(\'groupement\')">Son groupement · ' + esc(g.name) + '</button>' : '') +
      '</div>';
    return { scope: scope, name: g.name, html: html };
  }

  // Résumé "par molécule" (réseau) sur la fiche : ce qu'une molécule rapporte.
  function molSummarySection() {
    var M = window.PROD_STATS; if (!M || !M.length) return '';
    var top = M.slice().sort(function (a, b) { return (b.marge || 0) - (a.marge || 0); }).slice(0, 8);
    var rows = top.map(function (r, i) {
      return '<div class="ipv-row">' +
        '<span class="ipv-rank">#' + (i + 1) + '</span>' +
        '<span class="ipv-name">' + esc(cap((r.d || '').toLowerCase())) +
          '<small style="display:block;color:var(--muted);font-family:var(--mono)">rotation ~' + V2.fmtNum(r.rota) + '/an · ' + r.n + ' phies · ta remise ' + V2.fmtEur(r.remise) + '/an</small></span>' +
        '<span class="ipv-vol" style="color:var(--c-opp);font-weight:800" title="marge pharmacien MDL / an">' + V2.fmtEur(r.marge) + '<small>/an</small></span>' +
        '</div>';
    }).join('');
    var open = sectionOpen('molsum');
    return '<div class="ph-section">' +
      sectionHead('Ce qu\'un produit rapporte (réseau)',
        'rotation moyenne par pharmacie & marge pharmacien (MDL) — l\'argument chiffré à montrer au comptoir',
        'molsum', open) +
      (open ? '<div class="v2-card" style="padding:6px 0">' + rows +
        '<div style="text-align:right;padding:8px 14px"><a class="v2-cat-link" style="cursor:pointer" onclick="V2.go(\'molecules\')">Tous les produits →</a></div></div>' : '') +
      '</div>';
  }

  // VUE A — Liste des officines
  // ─────────────────────────────────────────────────────────────
  function listRowHtml(x) {
    var color = x.p.color || 'var(--ip-blue)';
    var oppPill = (x.opp == null)
      ? '<span class="v2-row-opp v2-row-opp-pending mono">…</span>'
      : '<span class="v2-row-opp mono">' + V2.fmtNum(x.opp) + ' opp</span>';
    var badge = opsoBadge(x.p);
    return '<a class="v2-row' + (isOpso() && x.p.inDb ? ' opso-row-cliente' : '') + '" onclick="V2.go(\'pharma\',\'' + V2.esc(String(x.p.id)) + '\')">' +
      '<span class="v2-row-dot" style="background:' + V2.esc(color) + '"></span>' +
      '<span class="v2-row-name">' + V2.esc(x.p.name) + '</span>' +
      badge +
      oppPill +
      '<span class="v2-row-meta">marge MDL</span>' +
      '<span class="v2-row-val mono" style="color:var(--c-opp)">' + V2.fmtEur(x.marge) + '</span>' +
      '<span class="v2-row-val mono" style="min-width:84px;text-align:right">' + V2.fmtEur(x.ca) + '</span>' +
      '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
  }

  function renderList(root) {
    var marketReady = !!window.OPS_AGGREGATE;
    var phs = (V2.pharmacies || []).map(function (p) {
      var sales = pharmaSales(p.id);
      var x = { p: p, ca: V2.sumCA(sales), marge: margeMDLpharma(sales), opp: null };
      if (marketReady) {
        x.opp = buildOpportunities(p.id).reduce(function (s, o) { return s + o.oppCount; }, 0);
      }
      return x;
    });

    // ── Tri OPSO : clientes d'abord, puis par CA desc ──
    if (isOpso()) {
      phs.sort(function (a, b) {
        var ac = a.p.inDb ? 1 : 0;
        var bc = b.p.inDb ? 1 : 0;
        if (bc !== ac) return bc - ac;   // clientes (1) avant prospects (0)
        return b.ca - a.ca;
      });
    } else {
      phs.sort(function (a, b) { return b.ca - a.ca; });
    }

    // Marché sectoriel pas encore chargé → on charge en tâche de fond puis on
    // rafraîchit la liste pour afficher le compteur d'opportunités par officine.
    if (!marketReady) {
      V2.loadFiles(['establishments']).then(function () {
        _marketCache = null;
        if (V2.route && V2.route.name === 'pharma' && !V2.route.param) V2.render();
      });
    }

    // ── Compteurs OPSO ──
    var nbClientes = 0, nbProspects = 0;
    if (isOpso()) {
      phs.forEach(function (x) { if (x.p.inDb) nbClientes++; else nbProspects++; });
    }

    function applyFilters(list) {
      var q = searchQuery.trim().toLowerCase();
      return list.filter(function (x) {
        if (V2.commFilter && (x.p.comms || []).indexOf(V2.commFilter) < 0) return false;
        if (q && x.p.name.toLowerCase().indexOf(q) < 0) return false;
        if (isOpso() && opsoFilter === 'cliente' && !x.p.inDb) return false;
        if (isOpso() && opsoFilter === 'prospect' && x.p.inDb) return false;
        return true;
      });
    }

    // ── Barre commercial (Tous / Will / Pauline) — si plusieurs commerciaux ──
    var commBar = '';
    var comms = V2.commercials ? V2.commercials() : [];
    if (comms.length > 1) {
      var cseg = function (val, label) {
        return '<button type="button" class="v2-seg' + (V2.commFilter === val ? ' on' : '') + '" style="--sc:var(--ip-blue)" onclick="V2.pharmaSetComm(\'' + val + '\')">' + label + '</button>';
      };
      commBar = '<div class="v2-segs" style="margin-bottom:14px">' + cseg('', 'Tous') +
        comms.map(function (cm) { return cseg(cm, cm); }).join('') + '</div>';
    }

    function cardHtml(filtered) {
      return filtered.length
        ? filtered.map(listRowHtml).join('')
        : '<div class="v2-empty"><div class="v2-empty-t">Aucune officine</div><div class="v2-empty-d">' +
          (searchQuery ? 'Aucun résultat pour « ' + V2.esc(searchQuery) + ' ».' : 'Aucune pharmacie chargée.') +
          '</div></div>';
    }

    // ── Barre de filtres OPSO (segment clientes / prospects) ──
    var opsoFilterBar = '';
    if (isOpso()) {
      function segBtn(val, label, count) {
        var on = (opsoFilter === val) ? ' on' : '';
        var sc = val === 'cliente' ? 'var(--ip-blue)' : (val === 'prospect' ? 'var(--muted)' : 'var(--ip-blue)');
        return '<button type="button" class="v2-seg' + on + '" style="--sc:' + sc + '" ' +
          'onclick="V2.pharmaOpsoFilter(\'' + val + '\')">' +
          label + '<span class="cnt">' + count + '</span></button>';
      }
      opsoFilterBar =
        '<div class="v2-segs" style="margin-bottom:14px">' +
          segBtn('all',      'Toutes',    phs.length) +
          segBtn('cliente',  'Clientes',  nbClientes) +
          segBtn('prospect', 'Prospects', nbProspects) +
        '</div>';

      var counterHtml =
        '<div class="opso-counter">' +
          '<span class="opso-counter-item opso-counter-cliente">' + nbClientes + ' cliente' + (nbClientes > 1 ? 's' : '') + '</span>' +
          '<span class="opso-counter-sep">·</span>' +
          '<span class="opso-counter-item opso-counter-prospect">' + nbProspects + ' prospect' + (nbProspects > 1 ? 's' : '') + '</span>' +
        '</div>';

      opsoFilterBar = counterHtml + opsoFilterBar;
    }

    var filtered = applyFilters(phs);

    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-title">Mes officines</div>' +
        '<div class="v2-page-sub">' + phs.length + ' pharmacie' + (phs.length > 1 ? 's' : '') +
          ' · clique pour voir les opportunités</div>' +
        pharmaTabs('officines') +
        commBar +
        opsoFilterBar +
        '<div class="v2-search" style="margin-bottom:20px;padding:14px 18px">' + ICO('search', 20, 2) +
          '<input id="v2-pharma-search" placeholder="Rechercher une officine…" autocomplete="off" value="' +
          V2.esc(searchQuery) + '"></div>' +
        '<div class="v2-card" id="v2-pharma-card">' + cardHtml(filtered) + '</div>' +
      '</div>';

    // Recherche live : on ne re-render QUE la liste pour préserver le focus
    var inp = document.getElementById('v2-pharma-search');
    if (inp) {
      inp.addEventListener('input', function () {
        searchQuery = inp.value;
        var card = document.getElementById('v2-pharma-card');
        if (!card) return;
        var f = applyFilters(phs);
        card.innerHTML = cardHtml(f);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // VUE B — Fiche opportunités d'une pharma
  // ─────────────────────────────────────────────────────────────
  function stat(label, value, color) {
    return '<div class="v2-pharma-stat" style="--sc:' + color + '">' +
      '<div class="v2-pharma-stat-l">' + label + '</div>' +
      '<div class="v2-pharma-stat-v mono">' + value + '</div></div>';
  }

  // En-tête de section unifié — réutilise le composant partagé v2.css (.v2-section-head
  // + .v2-sh-t / .v2-sh-s / .v2-sh-end) au lieu des 5 blocs flex inline recopiés.
  // toggleKey/open → section repliable (Top 5, Best-sellers IP repliés par défaut).
  function sectionHead(title, desc, toggleKey, open) {
    var tog = toggleKey != null;
    return '<div class="v2-section-head' + (tog ? ' ph-sh-toggle' : '') + '"' +
      (tog ? ' onclick="V2.pharmaToggleSection(\'' + toggleKey + '\')"' : '') + '>' +
      '<h2 class="v2-sh-t">' + esc(title) + '</h2>' +
      (desc ? '<span class="v2-sh-s">' + esc(desc) + '</span>' : '') +
      (tog ? '<span class="v2-sh-end v2-section-chev' + (open ? ' open' : '') + '">' + ICO('chev', 16) + '</span>' : '') +
      '</div>';
  }

  function renderCatCard(o, idx) {
    var c = o.cat;
    var key = c.key;
    // par défaut : première catégorie ouverte, le reste replié
    var isCollapsed = (key in collapsed) ? collapsed[key] : (idx !== 0);
    var hasRows = o.rows.length > 0;

    var head =
      '<div class="v2-cat-head" onclick="V2.pharmaToggleCat(\'' + key + '\')">' +
        '<span class="v2-cat-accent" style="background:' + c.color + '"></span>' +
        '<div class="v2-cat-titles">' +
          '<div class="v2-cat-t">' + c.label +
            (c.sub ? '<span class="v2-cat-sub">' + c.sub + '</span>' : '') + '</div>' +
          '<div class="v2-cat-meta mono">' + o.oppCount + ' opp · ' + V2.fmtNum(o.totalQte) + ' u marché</div>' +
        '</div>' +
        '<span class="v2-cat-chev' + (isCollapsed ? '' : ' open') + '">' + ICO('chev', 18) + '</span>' +
      '</div>';

    if (isCollapsed) return '<div class="v2-card v2-cat">' + head + '</div>';

    var body;
    if (!hasRows) {
      body = '<div class="v2-cat-empty">Aucune opportunité — cette officine couvre déjà cette catégorie.</div>';
    } else {
      var trs = o.rows.map(function (r, i) {
        var on = !!(selCips && selCips.has(r.cip));
        var addBtn = '<button type="button" class="opp-add' + (on ? ' on' : '') + '" data-cip="' +
          V2.esc(r.cip) + '" onclick="V2.pharmaToggleSel(this)" aria-label="Ajouter au PDF RDV">' +
          ICO(on ? 'check' : 'plus', 15) + '</button>';
        return '<tr>' +
          '<td class="num" style="color:var(--muted-2);width:34px;text-align:right;font-family:var(--mono)">' + (i + 1) + '</td>' +
          '<td><span class="v2-cat-prod">' + V2.esc(r.designation) + '</span></td>' +
          '<td class="mono" style="color:var(--muted);font-size:12px">' + V2.esc(r.cip) + '</td>' +
          '<td class="num">' + (r.prix_ip != null && r.prix_ip > 0 ? V2.fmtEur(r.prix_ip) + (r.offre ? ' <span class="ph-offre">offre</span>' : '') : '—') + '</td>' +
          '<td class="num" style="font-weight:700">' + V2.fmtNum(r.marketQte) + '</td>' +
          '<td class="num">' + (r.ops ? V2.fmtNum(r.ops) : '·') + '</td>' +
          '<td class="num">' + (r.cpr ? V2.fmtNum(r.cpr) : '·') + '</td>' +
          '<td class="num">' + (r.hp ? V2.fmtNum(r.hp) : '·') + '</td>' +
          '<td style="width:46px;text-align:center">' + addBtn + '</td>' +
          '</tr>';
      }).join('');
      body = '<div class="v2-cat-table-wrap ph-opp-tbl"><table class="v2-table">' +
        '<thead><tr>' +
          '<th class="num">#</th><th>Produit</th><th>CIP</th>' +
          '<th class="num">Prix IP</th><th class="num">Vol. marché</th>' +
          '<th class="num">OPS</th><th class="num">CPR</th><th class="num">HP</th>' +
          '<th></th>' +
        '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    }

    return '<div class="v2-card v2-cat open">' + head + body + '</div>';
  }

  // ── CA par mois (officine) ────────────────────
  var MN_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function monthlyCA(sales) {
    var by = {};
    sales.forEach(function (s) {
      if (!s.month || !s.year) return;
      var k = s.year * 12 + (s.month - 1);
      if (!by[k]) by[k] = { k: k, year: s.year, month: s.month, ca: 0 };
      by[k].ca += s.mntNetHt || 0;
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return a.k - b.k; });
  }

  // ── Ce que l'officine commande déjà, ventilé par tranche/catégorie ──
  function ownedByCat(sales) {
    var bIdx = benchIndex();
    var buckets = {};
    CATS.forEach(function (c) { buckets[c.key] = { ca: 0, qte: 0, mdl: 0, refs: new Set() }; });
    var other = { ca: 0, qte: 0, refs: new Set() };
    sales.forEach(function (s) {
      var cip = String(s.artCode || '');
      var b = cip ? bIdx.get(cip) : null;
      var cat = b ? classify(b, cip) : null;
      var bk = (cat && buckets[cat]) ? buckets[cat] : other;
      bk.ca += s.mntNetHt || 0;
      bk.qte += s.qte || 0;
      if (cip.length >= 7) bk.refs.add(cip);
      if (cat && buckets[cat] && isRemboursable(cip)) {
        if (s.puNet > 0) buckets[cat].mdl += V2.margeMDLboite(s.puNet) * (s.qte || 0);
      }
    });
    return { buckets: buckets, other: other };
  }

  // ── Top N produits commandés (en valeur/CA) par catégorie ──
  function ownedTopByCat(sales, n) {
    var bIdx = benchIndex();
    var byCat = {}; CATS.forEach(function (c) { byCat[c.key] = {}; });
    sales.forEach(function (s) {
      var cip = String(s.artCode || ''); if (cip.length < 7) return;
      var b = bIdx.get(cip); var cat = b ? classify(b, cip) : null;
      if (!cat || !byCat[cat]) return;
      var m = byCat[cat], e = m[cip];
      if (!e) { e = m[cip] = { cip: cip, designation: (b && b.designation) || s.artDesignation || cip, ca: 0, qte: 0 }; }
      e.ca += s.mntNetHt || 0;
      e.qte += s.qte || 0;
    });
    return CATS.map(function (c) {
      var arr = Object.keys(byCat[c.key]).map(function (k) { return byCat[c.key][k]; })
        .sort(function (a, b) { return b.ca - a.ca; });
      return { cat: c, rows: arr.slice(0, n || 5), total: arr.length };
    }).filter(function (o) { return o.rows.length; });
  }

  function topByCatSection(sales) {
    var data = ownedTopByCat(sales, 5);
    if (!data.length) return '';
    var cards = data.map(function (o) {
      var rows = o.rows.map(function (r, i) {
        return '<div class="ph-top-row">' +
          '<span class="ph-top-rank mono">' + (i + 1) + '</span>' +
          '<span class="ph-top-name">' + esc(r.designation) + '</span>' +
          '<span class="ph-top-val mono">' + V2.fmtEur(r.ca) + '<span class="ph-top-q"> · ' + V2.fmtNum(r.qte) + ' u</span></span>' +
        '</div>';
      }).join('');
      return '<div class="ph-top-card">' +
        '<div class="ph-top-head"><span class="ph-top-dot" style="background:' + o.cat.color + '"></span>' +
          '<span class="ph-top-t">' + esc(o.cat.label) + '</span>' +
          '<span class="ph-top-n mono">' + V2.fmtNum(o.total) + ' réf.</span></div>' +
        rows + '</div>';
    }).join('');
    var open = sectionOpen('top5');
    return '<div class="ph-topcats ph-section">' +
        sectionHead('Top 5 par catégorie', 'ses meilleures références commandées, en valeur (CA)', 'top5', open) +
        (open ? '<div class="ph-top-grid">' + cards + '</div>' : '') +
      '</div>';
  }

  function activitySection(sales, marge, ca) {
    // 1. CA par mois
    var months = monthlyCA(sales);
    var maxM = months.reduce(function (m, x) { return Math.max(m, x.ca); }, 1);
    var barsHtml = months.map(function (m) {
      var h = m.ca > 0 ? Math.max(5, m.ca / maxM * 100) : 0;
      return '<div class="ph-mbar" title="' + esc(cap(MN_SHORT[m.month - 1]) + ' ' + m.year + ' · ' + V2.fmtEur(m.ca)) + '">' +
        '<div class="ph-mbar-v mono">' + V2.fmtK(m.ca) + '</div>' +
        '<div class="ph-mbar-track"><span class="ph-mbar-fill" style="height:' + h + '%"></span></div>' +
        '<div class="ph-mbar-l">' + cap(MN_SHORT[m.month - 1]) + '</div></div>';
    }).join('');
    var chartCard =
      '<div class="v2-card" style="padding:18px 20px">' +
        '<div class="v2-card-t" style="margin-bottom:16px">' + ICO('pilo', 17) + 'CA par mois</div>' +
        (months.length ? '<div class="ph-mchart">' + barsHtml + '</div>'
                       : '<div class="v2-cat-empty" style="border:none;padding:10px 0">Aucune vente sur la période.</div>') +
      '</div>';

    // 2. Commandé par tranche
    var oc = ownedByCat(sales);
    var rowsArr = CATS.map(function (c) {
      var b = oc.buckets[c.key];
      return { c: c, refs: b.refs.size, qte: b.qte, ca: b.ca, mdl: b.mdl };
    }).filter(function (r) { return r.refs > 0; })
      .sort(function (a, b) { return b.ca - a.ca; });
    var maxCa = rowsArr.reduce(function (m, r) { return Math.max(m, r.ca); }, 1);
    var trRows = rowsArr.map(function (r) {
      var pct = r.ca > 0 ? Math.max(3, r.ca / maxCa * 100) : 0;
      return '<tr>' +
        '<td><span class="ph-tr-cat"><span class="ph-tr-dot" style="background:' + r.c.color + '"></span>' + esc(r.c.label) +
          (r.c.sub ? '<span class="ph-tr-sub">' + esc(r.c.sub) + '</span>' : '') + '</span>' +
          '<div class="ph-tr-bar"><span style="width:' + pct.toFixed(1) + '%;background:' + r.c.color + '"></span></div></td>' +
        '<td class="num">' + V2.fmtNum(r.refs) + '</td>' +
        '<td class="num">' + V2.fmtNum(r.qte) + '</td>' +
        '<td class="num" style="font-weight:700">' + V2.fmtEur(r.ca) + '</td>' +
        '<td class="num" style="color:var(--c-opp);font-weight:700">' + (r.mdl > 0 ? V2.fmtEur(r.mdl) : '—') + '</td>' +
        '</tr>';
    }).join('');
    if (oc.other.refs.size) {
      trRows += '<tr><td><span class="ph-tr-cat"><span class="ph-tr-dot" style="background:var(--muted-2)"></span>Hors catégories</span></td>' +
        '<td class="num">' + V2.fmtNum(oc.other.refs.size) + '</td><td class="num">' + V2.fmtNum(oc.other.qte) + '</td>' +
        '<td class="num" style="font-weight:700">' + V2.fmtEur(oc.other.ca) + '</td><td class="num">—</td></tr>';
    }
    var trCard =
      '<div class="v2-card" style="padding:0;overflow:hidden">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('cat', 17) + 'Ce qu\'elle commande déjà · par tranche</div>' +
          '<span class="v2-card-link" style="cursor:default;color:var(--muted)">marge MDL ' + V2.fmtEur(marge) + '</span></div>' +
        (trRows
          ? '<div class="v2-cat-table-wrap" style="border-top:none"><table class="v2-table">' +
            '<thead><tr><th>Tranche / famille</th><th class="num">Réfs</th><th class="num">Volume</th><th class="num">CA net</th><th class="num">Marge MDL</th></tr></thead>' +
            '<tbody>' + trRows + '</tbody></table></div>'
          : '<div class="v2-cat-empty">Aucun produit commandé identifié.</div>') +
      '</div>';

    var open = sectionOpen('activity');
    return '<div class="ph-activity ph-section">' +
        sectionHead('Activité de l\'officine', 'son CA, ce qu\'elle commande et sa marge', 'activity', open) +
        (open ? '<div class="ph-act-grid">' + chartCard + trCard + '</div>' : '') +
      '</div>';
  }

  // ── Rangée d'actions natives (44px) sous le nom : appeler / mailer / itinéraire ──
  // Friction terrain n°1 levée : un commercial debout en pharmacie appelle/route d'un pouce.
  // Chaque lien n'apparaît que si la donnée existe au modèle (tel/email/ville/cp).
  // Glyphes inline (stroke 1.7, bouts arrondis = même grammaire que v2-icons.js).
  function actIco(d) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var ACT_GLYPH = {
    phone: '<path d="M6.5 3.5h3l1.4 4-2 1.3a11 11 0 0 0 5.3 5.3l1.3-2 4 1.4v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5z"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4.5 7 7.5 5.5L19.5 7"/>',
    map: '<path d="M12 21s6.5-5.4 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 15.6 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.4"/>'
  };
  function contactActions(p) {
    var tel = (p.tel == null ? '' : String(p.tel)).trim();
    var email = (p.email == null ? '' : String(p.email)).trim();
    var locParts = [p.name, p.adresse, p.cp, p.ville].filter(function (x) { return x; });
    var loc = locParts.join(' ').trim();
    var links = [];
    if (tel) {
      links.push('<a class="v2-btn v2-btn-ghost ph-act-link" href="tel:' + esc(tel.replace(/[^+0-9]/g, '')) +
        '">' + actIco(ACT_GLYPH.phone) + 'Appeler</a>');
    }
    if (email) {
      links.push('<a class="v2-btn v2-btn-ghost ph-act-link" href="mailto:' + esc(email) +
        '">' + actIco(ACT_GLYPH.mail) + 'E-mail</a>');
    }
    if (loc) {
      links.push('<a class="v2-btn v2-btn-ghost ph-act-link" href="https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(loc) + '" target="_blank" rel="noopener">' + actIco(ACT_GLYPH.map) + 'Itinéraire</a>');
    }
    if (!links.length) return '';
    return '<div class="ph-contact-row">' + links.join('') + '</div>';
  }

  function renderDetail(root, pid) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (!pharma) { renderList(root); return; }

    // Agrégats marché + catalogue IP chargés ? sinon lazy-load + état loading
    if (!window.OPS_AGGREGATE || !window.BENCHMARK) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du marché sectoriel…</div></div>';
      V2.loadFiles(['establishments', 'bench']).then(function () { _marketCache = null; V2.render(); });
      return;
    }

    // Nouvelle pharma → on repart d'une sélection vide
    if (String(selPid) !== String(pid)) { selPid = String(pid); selCips = new Set(); }

    var sales = pharmaSales(pid);
    var ca = V2.sumCA(sales);
    var marge = margeMDLpharma(sales);
    var nbRefs = new Set(sales.map(function (s) { return String(s.artCode || ''); })
      .filter(function (c) { return c.length >= 7; })).size;

    // On ne montre PLUS les tableaux à l'écran (trop d'espace). On propose directement
    // les DEUX listes d'achats en PDF : réseau Intégral et son groupement.
    var dataR = buildRecoCats(pid, 'reseau');
    var nReseau = dataR.cats.reduce(function (s, o) { return s + o.rows.length; }, 0);
    var g = groupementPids(pid);
    var hasGrp = !!(g.set && g.set.size >= 2);
    var nGrp = hasGrp ? buildRecoCats(pid, 'groupement').cats.reduce(function (s, o) { return s + o.rows.length; }, 0) : 0;

    var ficheBadge = isOpso() ? ' ' + opsoBadge(pharma) : '';
    var loc = [pharma.cp, pharma.ville].filter(function (x) { return x; }).join(' ');
    var tel = (pharma.tel == null ? '' : String(pharma.tel)).trim();
    var email = (pharma.email == null ? '' : String(pharma.email)).trim();

    // ── En-tête : identité + KPIs + contacts ──
    var kpi = function (l, v, cls, raw) {
      var dc = (raw != null && raw > 0) ? ' data-count="' + raw + '"' : '';
      return '<div class="phf-hkpi"><span class="phf-hkpi-l">' + l + '</span><span class="phf-hkpi-v ' + (cls || '') + ' mono"' + dc + '>' + v + '</span></div>';
    };
    var head =
      '<div class="phf-hcard">' +
        '<div class="phf-hid">' +
          (pharma.code ? '<span class="phf-code">' + esc(String(pharma.code)) + '</span>' : '') +
          '<div class="phf-hname">' + esc(pharma.name) + ficheBadge + '</div>' +
          (loc ? '<div class="phf-hloc">' + ICO('pharma', 13) + esc(loc) + '</div>' : '') +
        '</div>' +
        '<div class="phf-hkpis">' +
          kpi('CA cumulé', V2.fmtEur(ca), '', ca) +
          kpi('Marge MDL', V2.fmtEur(marge), 'phf-pos', marge) +
          kpi('Références', V2.fmtNum(nbRefs), '', nbRefs) +
          kpi('À pousser', V2.fmtNum(nReseau), 'phf-push', nReseau) +
        '</div>' +
        ((tel || email) ? '<div class="phf-hcontacts">' +
          (tel ? '<a class="phf-cbtn2" href="tel:' + esc(tel.replace(/[^+0-9]/g, '')) + '">' + ICO('phone', 15) + 'Appeler</a>' : '') +
          (email ? '<a class="phf-cbtn2" href="mailto:' + esc(email) + '">' + ICO('mail', 15) + 'E-mail</a>' : '') +
        '</div>' : '') +
      '</div>';

    // ── Bloc STATS (pour le RDV) — sections repliables ──
    if (!('activity' in sectionCollapsed)) sectionCollapsed['activity'] = false; // Activité ouverte par défaut
    var stats = '<div class="ph-stats">' + activitySection(sales, marge, ca) + topByCatSection(sales) + '</div>';

    // ── Deux propositions de liste d'achats (PDF) ──
    var canShare = !!(V2.canShareFiles && V2.canShareFiles());
    var propCard = function (scope, color, title, sub, n) {
      if (n <= 0) return '';
      return '<div class="phf-prop" style="--pc:' + color + '">' +
        '<div class="phf-prop-ic">' + ICO('fiche', 22) + '</div>' +
        '<div class="phf-prop-main"><div class="phf-prop-t">' + title + '</div><div class="phf-prop-s">' + sub + '</div></div>' +
        '<div class="phf-prop-n mono">' + V2.fmtNum(n) + '<small>produits</small></div>' +
        '<div class="phf-prop-acts">' +
          '<button class="phf-pdf" onclick="V2.pharmaListPdf(\'' + esc(String(pid)) + '\',\'' + scope + '\')">' + ICO('download', 16) + 'Télécharger</button>' +
          (canShare ? '<button class="phf-pdf phf-pdf-ghost" onclick="V2.pharmaListPdf(\'' + esc(String(pid)) + '\',\'' + scope + '\',\'share\')">' + ICO('spark', 16) + 'Partager</button>' : '') +
        '</div>' +
      '</div>';
    };
    var props = '<div class="phf-props">' +
      propCard('reseau', 'var(--ip-blue)', 'Liste réseau Intégral Pharma', 'ce que tout le réseau commande et qu\'elle n\'a pas', nReseau) +
      (hasGrp ? propCard('groupement', 'var(--c-opp)', 'Liste de son groupement · ' + esc(g.name), 'ce que son groupement commande et qu\'elle n\'a pas', nGrp) : '') +
      ((nReseau <= 0 && !hasGrp) ? '<div class="v2-card"><div class="phf-empty">Cette officine commande déjà l\'essentiel du catalogue.</div></div>' : '') +
    '</div>';

    // ── Listing : best rotations de son groupement, avec marqueur commande / ne commande pas ──
    var rot = grpBestRotations(pid, 60);
    var nOwn = rot.rows.filter(function (r) { return r.owned; }).length;
    var nGap = rot.rows.length - nOwn;
    var shownRot = (grpListFilter === 'gap') ? rot.rows.filter(function (r) { return !r.owned; }) : rot.rows;
    var rotRows = shownRot.map(function (r, i) {
      var pct = rot.total ? Math.min(100, Math.round(r.sortie / rot.total * 100)) : 0;
      var tag = r.owned
        ? '<span class="phf-mk phf-mk-own">' + ICO('check', 12) + ' Commande</span>'
        : '<span class="phf-mk phf-mk-gap">À pousser</span>';
      return '<tr class="' + (r.owned ? 'phf-r-own' : 'phf-r-gap') + '">' +
        '<td class="phf-td-l"><div class="phf-desig">' + esc(cap((r.designation || '').toLowerCase())) + (r.froid ? ' <span class="ph-froid">FROID</span>' : '') + '</div><div class="phf-cip">' + esc(r.cip) + '</div></td>' +
        '<td>' + tag + '</td>' +
        '<td><span class="phf-price">' + (r.prix_ip > 0 ? V2.fmtEur(r.prix_ip) : '—') + '</span></td>' +
        '<td><span class="phf-rem' + (r.remise > 0 ? '' : ' phf-none') + '">' + (r.remise > 0 ? r.remise + ' %' : '—') + '</span></td>' +
        '<td class="phf-tc"><span class="phf-sortie"><span class="mono phf-sortie-n">' + r.sortie + '/' + rot.total + '</span><span class="phf-bar"><i style="width:' + pct + '%"></i></span></span></td>' +
      '</tr>';
    }).join('');
    var listing = rot.rows.length ? '<div class="v2-card" style="padding:0;overflow:hidden;margin-top:8px">' +
      '<div class="phf-phead" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
        '<div><div class="phf-ptitle"><span class="phf-pdot" style="background:var(--c-opp)"></span>Best rotations ' + (rot.isGrp ? 'de son groupement · ' + esc(rot.name) : 'du réseau') + '</div>' +
          '<div class="phf-psub">les produits les plus commandés par ' + (rot.isGrp ? 'son groupement' : 'le réseau') + ' — ce qu\'elle a déjà et ce qu\'il reste à pousser</div></div>' +
        '<div class="phf-rotfilter">' +
          '<button class="phf-rf' + (grpListFilter === 'all' ? ' on' : '') + '" onclick="V2.pharmaGrpFilter(\'all\')">Tout · ' + rot.rows.length + '</button>' +
          '<button class="phf-rf' + (grpListFilter === 'gap' ? ' on' : '') + (nGap === 0 ? ' phf-rf-off" disabled title="Elle commande déjà tous les best-sellers"' : '" onclick="V2.pharmaGrpFilter(\'gap\')"') + '>À pousser · ' + nGap + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="phf-tablewrap"><table class="phf-tbl"><thead><tr>' +
        '<th class="phf-tl">Produit</th><th>Statut</th><th>Prix net IP</th><th>Remise</th><th class="phf-tc">Nbr pharma</th>' +
      '</tr></thead><tbody>' + rotRows + '</tbody></table></div>' +
      '<div class="phf-foot">' + ICO('check', 13) + ' ' + nOwn + ' déjà commandé' + (nOwn > 1 ? 's' : '') + ' · <b style="color:var(--c-amber);margin-left:4px">' + nGap + ' à pousser</b> — sur les ' + rot.rows.length + ' meilleures rotations ' + (rot.isGrp ? 'du groupement' : 'du réseau') + '.</div>' +
    '</div>' : '';

    // ── Hub à onglets : l'en-tête reste fixe, le contenu bascule Vue d'ensemble / Audit ──
    var apercu = stats +
      sectionHead('Listes d\'achats à pousser', 'deux propositions prêtes à générer en PDF pour le rendez-vous') +
      props + listing;
    var auditTab = (V2.audit && window.WML_SALES && window.PROD_STATS)
      ? '<div id="aud">' + V2.audit.sheetFor(pid) + V2.audit.importSection() + '</div>' : '';
    var tabs = '<div class="ph-fiche-tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 16px">' +
      '<button class="ph-vtab on" id="phft-apercu" onclick="V2.phFicheTab(\'apercu\')">' + ICO('pharma', 15, 2) + 'Vue d\'ensemble & opportunités</button>' +
      (auditTab ? '<button class="ph-vtab" id="phft-audit" onclick="V2.phFicheTab(\'audit\')">' + ICO('pilo', 15, 2) + 'Audit marge</button>' : '') +
      '</div>';

    // Liseré / halo contextuel : le pilier Opportunités porte SA lumière (--pil-opp).
    root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
      '<div class="v2-wrap ph-detail" style="--accent:var(--pil-opp)">' +
        head +
        tabs +
        '<div id="phft-c-apercu">' + apercu + '</div>' +
        (auditTab ? '<div id="phft-c-audit" style="display:none">' + auditTab + '</div>' : '') +
      '</div>';
  }

  V2.phFicheTab = function (t) {
    ['apercu', 'audit'].forEach(function (x) {
      var b = document.getElementById('phft-' + x), c = document.getElementById('phft-c-' + x);
      if (b) b.classList.toggle('on', x === t);
      if (c) {
        var show = (x === t);
        c.style.display = show ? '' : 'none';
        if (show) { c.classList.remove('mo-view-in'); void c.offsetWidth; c.classList.add('mo-view-in'); }
      }
    });
  };

  // ── Barre d'action collante (pattern .v2-cartbar maison) ──────────
  // Apparaît dès qu'un produit est coché : le CTA Prépa RDV reste atteignable
  // au pouce après scroll, sans dupliquer la logique (réutilise pharmaPrepaPreview).
  function pharmaCartbar() {
    return '<div class="v2-cartbar" id="ph-cartbar">' +
      '<div class="v2-cartbar-in">' +
        '<span class="v2-cartbar-badge mono" id="ph-cartbar-n">0</span>' +
        '<span class="v2-cartbar-lbl" id="ph-cartbar-lbl">produit retenu</span>' +
        '<button class="v2-btn v2-btn-primary v2-cartbar-go" id="ph-cartbar-go">' +
          ICO('download', 16) + 'Préparer le RDV</button>' +
      '</div></div>';
  }
  // Affiche/masque la barre + synchronise compteur et action (sans re-render).
  function refreshCartbar() {
    var bar = document.getElementById('ph-cartbar');
    if (!bar) return;
    var n = selCips ? selCips.size : 0;
    var grp = (String(selPid).indexOf('GRP:') === 0);
    if (n > 0) {
      var nEl = document.getElementById('ph-cartbar-n');
      var lEl = document.getElementById('ph-cartbar-lbl');
      var gEl = document.getElementById('ph-cartbar-go');
      if (nEl) nEl.textContent = n;
      if (lEl) lEl.textContent = 'produit' + (n > 1 ? 's' : '') + ' retenu' + (n > 1 ? 's' : '');
      if (gEl) {
        gEl.innerHTML = ICO('download', 16) + 'Liste d\'achats';
        gEl.onclick = function () {
          if (grp) { V2.grpDownloadPdf(encodeURIComponent(String(selPid).slice(4))); }
          else { V2.pharmaListPdf(String(selPid)); }
        };
      }
      bar.classList.add('show');
    } else {
      bar.classList.remove('show');
    }
  }

  // ── Handlers exposés ───────────────────────────────────────────
  // Met à jour le libellé du bouton PDF sans re-render (préserve le scroll)
  function refreshPdfBtn() {
    var b = document.getElementById('v2-opp-pdf');
    if (!b) return;
    var n = selCips ? selCips.size : 0;
    var grp = (String(selPid).indexOf('GRP:') === 0);
    // Fiche officine (master-détail) : bouton libellé « Liste d'achats », compteur séparé.
    if (b.classList.contains('phf-pdf')) {
      b.innerHTML = ICO('download', 16) + 'Liste d\'achats (PDF)';
      var sc = document.getElementById('phf-selcount');
      if (sc) { var bb = sc.querySelector('b'); if (bb) bb.textContent = n; }
      return;
    }
    b.innerHTML = ICO('download', 17) + (n
      ? (grp ? 'Liste · ' : 'Prépa RDV · ') + n + ' produit' + (n > 1 ? 's' : '')
      : (grp ? 'Liste d\'achats (PDF)' : 'Préparer le RDV (PDF)'));
  }

  // Coche / décoche un produit (toggle ciblé, pas de re-render).
  // Le ✓ sert au PDF RDV immédiat ET alimente la "fiche en cours" partagée.
  V2.pharmaToggleSel = function (btn) {
    if (!selCips) selCips = new Set();
    var cip = btn.getAttribute('data-cip');
    if (selCips.has(cip)) {
      selCips.delete(cip);
      btn.classList.remove('on');
      btn.innerHTML = ICO('plus', 15);
      if (V2.ficheCart) V2.ficheCart.remove(cip);
    } else {
      selCips.add(cip);
      btn.classList.add('on');
      btn.innerHTML = ICO('check', 15);
      if (V2.ficheCart) {
        var b = benchIndex().get(String(cip));
        var bp = V2.bestPrice(b);
        V2.ficheCart.add({
          cip13: cip,
          designation: b ? b.designation : cip,
          prix_ip: bp.ip,
          prix_ht: bp.ht,
          remise_pct: bp.remise,
          is_froid: b ? b.is_froid : false,
          src: 'opp'
        });
      }
      V2.toast('Retenu — ajouté à la fiche en cours');
    }
    // Surlignage de la ligne (fiche officine master-détail)
    var tr = btn.closest && btn.closest('tr.phf-picked, tr[data-cip]');
    if (tr) tr.classList.toggle('phf-picked', selCips.has(cip));
    refreshPdfBtn();
    refreshCartbar();
  };

  // Replie / déplie une section secondaire (Top 5, Best-sellers IP) sans perdre le scroll.
  V2.pharmaToggleSection = function (key) {
    var cur = (key in sectionCollapsed) ? sectionCollapsed[key] : true;
    sectionCollapsed[key] = !cur;
    var y = window.scrollY || window.pageYOffset || 0;
    V2.render();
    try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
  };

  V2.pharmaToggleCat = function (key) {
    var idx = -1;
    for (var i = 0; i < CATS.length; i++) { if (CATS[i].key === key) { idx = i; break; } }
    var cur = (key in collapsed) ? collapsed[key] : (idx !== 0);
    collapsed[key] = !cur;
    var y = window.scrollY || window.pageYOffset || 0; // préserve la position de lecture
    V2.render();
    try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
  };

  // ── Handler filtre OPSO (segment clientes / prospects) ──
  V2.pharmaOpsoFilter = function (val) {
    opsoFilter = val;
    V2.render();
  };
  V2.pharmaSetComm = function (val) {
    V2.commFilter = val || '';
    V2.render();
  };

  function buildPrepaHtml(pid) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (!pharma) return null;
    var sales = pharmaSales(pid);
    var ca = V2.sumCA(sales), marge = margeMDLpharma(sales);
    var nbRefs = new Set(sales.map(function (s) { return String(s.artCode || ''); }).filter(function (c) { return c.length >= 7; })).size;
    var opps = buildOpportunities(pid);
    var totalOpp = opps.reduce(function (s, o) { return s + o.oppCount; }, 0);
    var today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    function esc(s) { return V2.esc(s); }

    // Si Will a coché des produits (bouton +) → le PDF ne contient QUE sa sélection.
    // Sinon → top marché par catégorie (15 max), comportement par défaut.
    var useSel = !!(selCips && selCips.size && String(selPid) === String(pid));
    var sections;
    if (useSel) {
      // PDF construit DIRECTEMENT depuis la sélection cochée (même liste que la fiche :
      // produits que la référence prend et qu'elle n'a pas), groupée par familles.
      var bIdxP = benchIndex(), buckP = {};
      CATS.forEach(function (c) { buckP[c.key] = []; });
      selCips.forEach(function (cip) {
        var b = bIdxP.get(String(cip)); if (!b) return;
        var cat = classify(b, cip); if (!cat || !buckP[cat]) return;
        var bp = V2.bestPrice(b);
        buckP[cat].push({ cip: String(cip), designation: b.designation || '', prix_ip: bp.ip, marketQte: rotationYear(cip) || 0 });
      });
      sections = CATS.map(function (c) {
        var rows = buckP[c.key].sort(function (a, b) { return (b.marketQte || 0) - (a.marketQte || 0); });
        return { cat: c, rows: rows, oppCount: rows.length, totalQte: rows.reduce(function (s, r) { return s + (r.marketQte || 0); }, 0) };
      }).filter(function (o) { return o.rows.length; });
    } else {
      sections = opps.map(function (o) {
        return { cat: o.cat, rows: o.rows.slice(0, 15), oppCount: o.oppCount, totalQte: o.totalQte };
      }).filter(function (o) { return o.rows.length; });
    }

    var catSections = sections.map(function (o) {
      var rows = o.rows.map(function (r, i) {
        return '<tr>' +
          '<td style="padding:4px 6px;text-align:center;color:#9AA1B2;font-size:9px">' + (i + 1) + '</td>' +
          '<td style="padding:4px 6px;font-size:10px;font-weight:600;color:#10131C">' + esc((r.designation || '').slice(0, 52)) + '</td>' +
          '<td style="padding:4px 6px;font-family:monospace;font-size:9px;color:#737A8C">' + esc(r.cip) + '</td>' +
          '<td style="padding:4px 6px;text-align:right;font-family:monospace;font-size:10px;font-weight:700;color:#0050E6">' + (r.prix_ip ? r.prix_ip.toFixed(2) + ' €' : '—') + '</td>' +
          '<td style="padding:4px 6px;text-align:right;font-family:monospace;font-size:10px;font-weight:700;color:#1E9E6A">' + V2.fmtNum(r.marketQte) + '</td>' +
          '</tr>';
      }).join('');
      return '<div style="margin-bottom:13px;page-break-inside:avoid">' +
        '<div style="display:flex;align-items:center;gap:9px;padding:7px 11px;background:linear-gradient(90deg,' + o.cat.color + '22,transparent);border-left:4px solid ' + o.cat.color + ';border-radius:5px;margin-bottom:5px">' +
          '<div style="font-size:12px;font-weight:800;color:#10131C">' + esc(o.cat.label) + '</div>' +
          '<div style="font-size:9px;color:#737A8C;margin-left:auto;font-family:monospace">' + o.oppCount + ' opp · ' + V2.fmtNum(o.totalQte) + ' u marché</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse">' +
          '<thead><tr style="background:#F4F6FB">' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:center">#</th>' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:left">Produit</th>' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:left">CIP13</th>' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:right">Prix IP</th>' +
            '<th style="padding:5px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;text-align:right">Vol marché</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }).join('');

    // ── Portrait : CA/mois + commandé par tranche ──
    var months = monthlyCA(sales);
    var maxM = months.reduce(function (m, x) { return Math.max(m, x.ca); }, 1);
    var monthBars = months.map(function (m) {
      var h = m.ca > 0 ? Math.max(6, Math.round(m.ca / maxM * 62)) : 0;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">' +
        '<div style="font-size:8px;font-weight:700;color:#2A2F3C;font-family:monospace">' + V2.fmtK(m.ca) + '</div>' +
        '<div style="width:100%;max-width:34px;height:62px;display:flex;align-items:flex-end;background:#EEF1F6;border-radius:5px 5px 2px 2px;overflow:hidden"><div style="width:100%;height:' + h + 'px;background:linear-gradient(180deg,#0050E6,#0034A0)"></div></div>' +
        '<div style="font-size:8px;color:#737A8C;font-weight:600">' + cap(MN_SHORT[m.month - 1]) + '</div>' +
      '</div>';
    }).join('');
    var oc = ownedByCat(sales);
    var trRows = CATS.map(function (c) { var b = oc.buckets[c.key]; return { c: c, refs: b.refs.size, ca: b.ca, mdl: b.mdl }; })
      .filter(function (r) { return r.refs > 0; }).sort(function (a, b) { return b.ca - a.ca; })
      .map(function (r) {
        return '<tr style="border-bottom:1px solid #F0F2F7">' +
          '<td style="padding:4px 7px;font-size:9.5px;font-weight:600;color:#10131C"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + r.c.color + ';margin-right:6px;vertical-align:middle"></span>' + esc(r.c.label) + '</td>' +
          '<td style="padding:4px 7px;text-align:right;font-size:9.5px;font-family:monospace">' + V2.fmtNum(r.refs) + '</td>' +
          '<td style="padding:4px 7px;text-align:right;font-size:9.5px;font-family:monospace;font-weight:700">' + V2.fmtEur(r.ca) + '</td>' +
          '<td style="padding:4px 7px;text-align:right;font-size:9.5px;font-family:monospace;color:#1E9E6A;font-weight:700">' + (r.mdl > 0 ? V2.fmtEur(r.mdl) : '—') + '</td>' +
        '</tr>';
      }).join('');
    var ident = [pharma.code, pharma.ville, pharma.tel].filter(function (x) { return x; }).map(esc).join('  ·  ');
    var pot = (pharma.potentiel != null && pharma.potentiel !== '') ? ('Potentiel ' + esc(String(pharma.potentiel))) : '';
    function kpiTile(l, v, col) {
      return '<div style="border:1px solid #E5E9F2;border-radius:9px;padding:9px 11px"><div style="font-size:8px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em;font-weight:700">' + l + '</div><div style="font-size:15px;font-weight:800;color:' + col + ';font-family:monospace">' + v + '</div></div>';
    }

    // Top 5 commandé par catégorie (en valeur) — cartes 2 colonnes
    var tops = ownedTopByCat(sales, 5);
    var topCards = tops.map(function (o) {
      var rws = o.rows.map(function (r, i) {
        return '<div style="display:flex;align-items:center;gap:7px;padding:3px 9px;border-top:1px solid #F4F6FB">' +
          '<span style="font-size:8px;color:#9AA1B2;font-family:monospace;width:10px">' + (i + 1) + '</span>' +
          '<span style="flex:1;font-size:9.5px;font-weight:600;color:#10131C;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc((r.designation || '').slice(0, 34)) + '</span>' +
          '<span style="font-size:9px;font-family:monospace;font-weight:700;color:#10131C">' + V2.fmtEur(r.ca) + '</span></div>';
      }).join('');
      return '<div style="border:1px solid #E5E9F2;border-radius:9px;overflow:hidden;page-break-inside:avoid">' +
        '<div style="display:flex;align-items:center;gap:7px;padding:6px 9px;background:linear-gradient(90deg,' + o.cat.color + '18,transparent)">' +
          '<span style="width:7px;height:7px;border-radius:50%;background:' + o.cat.color + '"></span>' +
          '<span style="font-size:10px;font-weight:800;color:#10131C;flex:1">' + esc(o.cat.label) + '</span>' +
          '<span style="font-size:8px;color:#737A8C;font-family:monospace">' + V2.fmtNum(o.total) + ' réf.</span></div>' +
        rws + '</div>';
    }).join('');
    var topCatBlock = tops.length
      ? '<h2 style="font-size:14px;font-weight:800;margin:0 0 10px;border-bottom:1px solid #E5E9F2;padding-bottom:5px">Top 5 commandé · par catégorie (en valeur)</h2>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:18px">' + topCards + '</div>'
      : '';

    var html =
      '<div style="padding:18px 22px;font-family:Satoshi,Inter,system-ui,sans-serif;color:#10131C">' +
        // En-tête identité
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:13px;border-bottom:2px solid #10131C;margin-bottom:16px">' +
          '<div style="display:flex;align-items:center;gap:13px">' +
            '<div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(150deg,#0050E6,#0034A0);position:relative;flex-shrink:0"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div></div>' +
            '<div><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.1em;font-weight:800">Préparation rendez-vous · Intégral Pharma</div>' +
              '<div style="font-size:21px;font-weight:800;letter-spacing:-.02em;line-height:1.1">' + esc(pharma.name) + '</div>' +
              (ident ? '<div style="font-size:10.5px;color:#737A8C;margin-top:3px">' + ident + '</div>' : '') + '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0">' +
            (pharma.groupement ? '<div style="display:inline-block;font-size:9px;font-weight:800;color:#0050E6;background:#EAF0FF;border-radius:6px;padding:3px 8px">' + esc(pharma.groupement) + '</div>' : '') +
            (pot ? '<div style="font-size:10px;color:#737A8C;margin-top:5px;font-weight:700">' + pot + '</div>' : '') +
            '<div style="font-size:10px;color:#9AA1B2;margin-top:5px;font-family:monospace">' + today + '</div>' +
          '</div>' +
        '</div>' +
        // KPI
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:16px">' +
          kpiTile('CA cumulé (5 mois)', V2.fmtEur(ca), '#0050E6') +
          kpiTile('Marge MDL', V2.fmtEur(marge), '#1E9E6A') +
          kpiTile('Références', V2.fmtNum(nbRefs), '#6D4FC4') +
          kpiTile('Opportunités', V2.fmtNum(totalOpp), '#C7791A') +
        '</div>' +
        // Portrait 2 colonnes
        '<div style="display:grid;grid-template-columns:1fr 1.15fr;gap:12px;margin-bottom:18px;page-break-inside:avoid">' +
          '<div style="border:1px solid #E5E9F2;border-radius:11px;padding:12px 14px">' +
            '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;margin-bottom:10px">CA par mois</div>' +
            '<div style="display:flex;align-items:flex-end;gap:7px">' + (monthBars || '<div style="font-size:10px;color:#9AA1B2">—</div>') + '</div>' +
          '</div>' +
          '<div style="border:1px solid #E5E9F2;border-radius:11px;padding:12px 14px">' +
            '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;margin-bottom:8px">Ce qu\'elle commande · par tranche</div>' +
            (trRows ? '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
              '<th style="text-align:left;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">Tranche</th>' +
              '<th style="text-align:right;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">Réfs</th>' +
              '<th style="text-align:right;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">CA</th>' +
              '<th style="text-align:right;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">MDL</th>' +
              '</tr></thead><tbody>' + trRows + '</tbody></table>' : '<div style="font-size:10px;color:#9AA1B2">Aucune commande identifiée.</div>') +
          '</div>' +
        '</div>' +
        // Top 5 commandé par catégorie
        topCatBlock +
        // Opportunités à présenter
        '<h2 style="font-size:14px;font-weight:800;margin:0 0 10px;border-bottom:1px solid #E5E9F2;padding-bottom:5px">' +
          (useSel ? 'À présenter · ' + selCips.size + ' produit' + (selCips.size > 1 ? 's' : '') + ' retenus'
                  : 'Opportunités à présenter · top marché OPS + HP + CPR') + '</h2>' +
        catSections +
        // Notes
        '<div style="margin-top:16px;page-break-inside:avoid">' +
          '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;margin-bottom:7px">Notes du rendez-vous</div>' +
          '<div style="border:1px solid #E5E9F2;border-radius:10px;height:96px;background:repeating-linear-gradient(#fff,#fff 23px,#EEF1F6 23px,#EEF1F6 24px)"></div>' +
        '</div>' +
        // Footer
        '<div style="margin-top:14px;padding-top:8px;border-top:1px solid #E5E9F2;display:flex;justify-content:space-between;font-size:8px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">' +
          '<div>Intégral Pharma · Normandie · Document confidentiel</div><div>Marge MDL : 0,18€ &lt;4,33€ · 3,9% &lt;468€ · 19,50€ au-delà</div></div>' +
      '</div>';

    return { html: html, pharma: pharma };
  }

  // Génère le PDF de la prépa RDV (pagebreak propre → multi-pages OK)
  V2.pharmaDownloadPdf = function (pid) {
    if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
    var built = buildPrepaHtml(pid);
    if (!built) { V2.toast('Pharmacie introuvable', 'error'); return; }
    V2.toast('Génération du PDF…');
    window.ensureHtml2Pdf().then(function () {
      return (document.fonts && document.fonts.ready) ? document.fonts.ready : null;
    }).then(function () {
      try { window.scrollTo(0, 0); } catch (e) {}
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;left:0;top:0;width:794px;overflow:hidden;background:#fff;z-index:1';
      wrap.innerHTML = built.html;
      document.body.appendChild(wrap);
      var veil = document.createElement('div');
      veil.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:2147483600;display:flex;align-items:center;justify-content:center;font:600 14px Satoshi,system-ui,sans-serif;color:#737A8C';
      veil.textContent = 'Génération du PDF…';
      document.body.appendChild(veil);
      function cleanP() { if (wrap.parentNode) document.body.removeChild(wrap); if (veil.parentNode) document.body.removeChild(veil); }
      var fn = 'Prepa-RDV-' + (built.pharma.name || 'pharma').replace(/[^A-Za-z0-9-]/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      window.html2pdf().from(wrap.firstChild).set({
        filename: fn, margin: [0, 0, 0, 0], image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794, windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).save().then(function () {
        cleanP(); V2.toast('PDF téléchargé');
      }).catch(function (e) { console.error(e); cleanP(); V2.toast('Erreur PDF', 'error'); });
    });
  };

  // Aperçu visuel (modal) de la prépa RDV avant téléchargement — WYSIWYG
  function fitPrepaSheet() {
    var scroll = document.getElementById('prepa-scroll'), holder = document.getElementById('prepa-holder'), sheet = document.getElementById('prepa-sheet');
    if (!scroll || !holder || !sheet) return;
    var avail = scroll.clientWidth - 48; if (avail <= 0) return;
    var scale = Math.min(1, avail / 794);
    sheet.style.transform = 'scale(' + scale + ')';
    var h = sheet.firstChild ? sheet.firstChild.offsetHeight : sheet.offsetHeight;
    holder.style.width = (794 * scale) + 'px'; holder.style.height = (h * scale) + 'px';
  }
  V2.pharmaPrepaClose = function () { var bd = document.getElementById('prepa-modal'); if (bd) bd.classList.remove('open'); };
  V2.pharmaPrepaPreview = function (pid) {
    var built = buildPrepaHtml(pid);
    if (!built) { V2.toast('Pharmacie introuvable', 'error'); return; }
    var bd = document.getElementById('prepa-modal');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'prepa-modal'; bd.className = 'prepa-modal';
      bd.innerHTML =
        '<div class="prepa-dialog" onclick="event.stopPropagation()">' +
          '<div class="prepa-top">' +
            '<div class="prepa-tt">' + ICO('fiche', 17, 2) + ' Aperçu · Préparation rendez-vous</div>' +
            '<button class="v2-btn v2-btn-primary" id="prepa-dl">' + ICO('download', 16) + ' Télécharger le PDF</button>' +
            '<button class="prepa-x" onclick="V2.pharmaPrepaClose()" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
          '</div>' +
          '<div class="prepa-scroll" id="prepa-scroll"><div class="prepa-holder" id="prepa-holder"><div class="prepa-sheet" id="prepa-sheet"></div></div></div>' +
        '</div>';
      bd.onclick = function () { V2.pharmaPrepaClose(); };
      document.body.appendChild(bd);
    }
    bd.querySelector('#prepa-sheet').innerHTML = built.html;
    bd.querySelector('#prepa-dl').onclick = function () { V2.pharmaDownloadPdf(pid); };
    bd.classList.add('open');
    requestAnimationFrame(function () { requestAnimationFrame(fitPrepaSheet); });
    if (!V2._prepaResize) { window.addEventListener('resize', fitPrepaSheet); V2._prepaResize = true; }
  };

  // ── Enregistrement dans le registry ────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  // SOUS-ONGLET GROUPEMENTS — listes d'achats idéales par groupement
  // (produits commandés, triés par nb de pharmacies qui commandent)
  // ═══════════════════════════════════════════════════════════════
  function pharmaTabs(active) {
    return '<div class="ph-vtabs">' +
      '<button class="ph-vtab' + (active === 'officines' ? ' on' : '') + '" onclick="V2.pharmaView(\'officines\')">' + ICO('pharma', 15, 2) + 'Officines</button>' +
      '<button class="ph-vtab' + (active === 'listes' ? ' on' : '') + '" onclick="V2.pharmaView(\'listes\')">' + ICO('fiche', 15, 2) + 'Mes listes</button>' +
      '<button class="ph-vtab' + (active === 'carte' ? ' on' : '') + '" onclick="V2.pharmaView(\'carte\')">' + ICO('grid', 15, 2) + 'Carte secteur</button>' +
    '</div>';
  }
  function groupName(p) { return (String(p.groupement || '').trim()) || '— Sans groupement'; }
  function grpLogo(name, big) {
    var l = window.GRP_LOGOS && window.GRP_LOGOS[name];
    var cls = 'grp-logo' + (big ? ' grp-logo-big' : '');
    if (l) return '<span class="' + cls + '"><img src="' + esc(l) + '" alt=""></span>';
    var ini = String(name || '?').replace(/[^A-Za-zÀ-ÿ0-9]+/g, ' ').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '?';
    return '<span class="' + cls + ' grp-logo-x">' + esc(ini) + '</span>';
  }
  // Vue Groupements = vue d'équipe : TOUJOURS toutes les pharmacies des 4
  // commerciaux, sans tenir compte du filtre commercial.
  function groupementList() {
    var byG = {};
    (V2.pharmacies || []).forEach(function (p) {
      var g = groupName(p);
      (byG[g] = byG[g] || { name: g, members: [] }).members.push(p);
    });
    return Object.keys(byG).map(function (g) {
      var o = byG[g];
      o.nb = o.members.length;
      o.active = o.members.filter(function (p) { return pharmaSalesAll(p.id).length > 0; }).length;
      return o;
    }).sort(function (a, b) { return b.active - a.active || b.nb - a.nb; });
  }
  function groupementProducts(grpName) {
    var ids = {};
    (V2.pharmacies || []).forEach(function (p) {
      if (groupName(p) === grpName) ids[String(p.id)] = 1;
    });
    return productsForIds(ids, 'GRP:' + grpName);
  }
  // ── Overrides produits par liste/groupement (retirés / ajoutés à la main) ──
  var OV_KEY = 'v2_list_overrides';
  function ovAll() { try { return JSON.parse(localStorage.getItem(OV_KEY) || '{}'); } catch (e) { return {}; } }
  function ovSave(o) { try { localStorage.setItem(OV_KEY, JSON.stringify(o)); } catch (e) {} }
  function overridesGet(key) { var o = ovAll()[key] || {}; return { removed: o.removed || {}, added: o.added || {} }; }
  function ovWrite(key, ov) { var a = ovAll(); a[key] = { removed: ov.removed, added: ov.added }; ovSave(a); }
  function ovRemoveProduct(key, cip) { var ov = overridesGet(key); delete ov.added[cip]; ov.removed[cip] = 1; ovWrite(key, ov); }
  function ovAddProduct(key, cip) { var ov = overridesGet(key); delete ov.removed[cip]; ov.added[cip] = 1; ovWrite(key, ov); }
  function ovRestoreAll(key) { var ov = overridesGet(key); ov.removed = {}; ovWrite(key, ov); }
  // barre d'outils produits (réafficher les masqués + ajouter un produit)
  function prodToolbar(ovKey) {
    var rm = Object.keys(overridesGet(ovKey).removed).length, enc = encodeURIComponent(ovKey);
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:-4px 0 12px;flex-wrap:wrap">' +
      (rm ? '<button class="v2-btn v2-btn-ghost" onclick="V2.itemRestoreAll(\'' + enc + '\')">' + ICO('back', 15) + rm + ' produit' + (rm > 1 ? 's' : '') + ' masqué' + (rm > 1 ? 's' : '') + ' · réafficher</button>' : '<span></span>') +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.itemAddOpen(\'' + enc + '\')">' + ICO('plus', 16) + 'Ajouter un produit</button>' +
    '</div>';
  }

  // Agrégation des achats pour un ENSEMBLE de pharmacies (ids = {pharmacyId:1}).
  // Mutualisé par les groupements ET les listes personnalisées.
  // ovKey (optionnel) : applique les produits retirés/ajoutés à la main.
  function productsForIds(ids, ovKey) {
    var bIdx = benchIndex(), byCip = {}, activeSet = {};
    (V2.sales || []).forEach(function (s) {
      if (!ids[String(s.pharmacyId)]) return;
      var cip = String(s.artCode || ''); if (cip.length < 7) return;
      activeSet[String(s.pharmacyId)] = 1;
      var e = byCip[cip] || (byCip[cip] = { ph: {}, qte: 0, ca: 0 });
      e.ph[String(s.pharmacyId)] = 1; e.qte += s.qte || 0; e.ca += s.mntNetHt || 0;
    });
    var ov = ovKey ? overridesGet(ovKey) : { removed: {}, added: {} };
    // produits ajoutés manuellement et non commandés par le panel : entrée vide (sortie 0)
    Object.keys(ov.added).forEach(function (cip) { if (!byCip[cip]) byCip[cip] = { ph: {}, qte: 0, ca: 0, manual: true }; });
    // seuil de diffusion : un produit n'apparaît que s'il est commandé par >= 20% des pharmacies
    // (actives) du groupement (les produits ajoutés à la main passent toujours).
    var panel0 = Object.keys(activeSet).length;
    var seuil = Math.max(1, Math.ceil(panel0 * 0.20));
    var buckets = {}; CATS.forEach(function (c) { buckets[c.key] = []; });
    Object.keys(byCip).forEach(function (cip) {
      if (ov.removed[cip]) return;                       // produit retiré à la main
      var b = bIdx.get(cip); if (!b) return;
      var cat = classify(b, cip); if (!cat || !buckets[cat]) return;
      if (!byCip[cip].manual && Object.keys(byCip[cip].ph).length < seuil) return;   // < 20% des pharmacies → masqué
      var e = byCip[cip], ht = (b.prix_ht > 0) ? b.prix_ht : 0, ip0 = (b.prix_ip > 0) ? b.prix_ip : 0;
      // prix le plus bas : offre labo (Sanofi, UPSA…) valide si remise ≤ 50%
      // (au-delà = donnée offre_ip aberrante → ignorée)
      var off = (b.offre_ip > 0) ? b.offre_ip : 0;
      var hasOffer = off > 0 && ht > 0 && off < ht && off >= ht * 0.5;
      var ip = hasOffer ? off : ip0;
      var rem = (ht > 0 && ip > 0 && ip <= ht) ? Math.round((1 - ip / ht) * 1000) / 10 : 0;
      buckets[cat].push({ cip: cip, designation: b.designation, prix_ht: ht, prix_ip: ip, offre: hasOffer, remise: rem,
                          froid: !!b.is_froid, sortie: Object.keys(e.ph).length, qte: e.qte, manual: !!e.manual });
    });
    return {
      panel: Object.keys(activeSet).length,
      members: Object.keys(ids).length,
      ovKey: ovKey || '',
      cats: CATS.map(function (c) {
        return { cat: c, rows: buckets[c.key].sort(function (a, b) { return b.sortie - a.sortie || b.qte - a.qte; }) };
      }).filter(function (o) { return o.rows.length; })
    };
  }

  function renderGroupementsList(root) {
    var list = groupementList();
    var rows = list.map(function (g) {
      return '<a class="v2-row" onclick="V2.pharmaGroup(\'' + encodeURIComponent(g.name) + '\')">' +
        grpLogo(g.name) +
        '<span class="v2-row-name">' + esc(g.name) + '</span>' +
        '<span class="v2-row-opp mono">' + g.active + ' / ' + g.nb + ' actives</span>' +
        '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
    }).join('') || '<div class="v2-empty"><div class="v2-empty-d">Aucun groupement.</div></div>';
    root.innerHTML = V2.topbar({ back: true, backTo: 'groupements', backLabel: 'Groupements' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-title">Groupements</div>' +
        '<div class="v2-page-sub">Opportunités par groupement · ce que commandent les pharmacies adhérentes — liste d\'achats à pousser</div>' +
        (V2.grpSpaceTabs ? V2.grpSpaceTabs('opp') : '') +
        '<div class="v2-card" style="margin-top:16px">' + rows + '</div>' +
      '</div>';
  }

  function renderGrpCatCard(o, idx, panel, ovKey) {
    var c = o.cat, key = 'g_' + c.key;
    var enc = ovKey ? encodeURIComponent(ovKey) : '';
    var collapsed = (key in grpCollapsed) ? grpCollapsed[key] : (idx !== 0);
    var head =
      '<div class="v2-cat-head" onclick="V2.grpToggleCat(\'' + c.key + '\')">' +
        '<span class="v2-cat-accent" style="background:' + c.color + '"></span>' +
        '<div class="v2-cat-titles"><div class="v2-cat-t">' + c.label +
          (c.sub ? '<span class="v2-cat-sub">' + c.sub + '</span>' : '') + '</div>' +
          '<div class="v2-cat-meta mono">' + o.rows.length + ' produits</div></div>' +
        '<span class="v2-cat-chev' + (collapsed ? '' : ' open') + '">' + ICO('chev', 18) + '</span>' +
      '</div>';
    if (collapsed) return '<div class="v2-card v2-cat">' + head + '</div>';
    var trs = o.rows.slice(0, 80).map(function (r, i) {
      var on = !!(selCips && selCips.has(r.cip));
      return '<tr>' +
        '<td class="num" style="color:var(--muted-2);width:30px;text-align:right;font-family:var(--mono)">' + (i + 1) + '</td>' +
        '<td><span class="v2-cat-prod">' + esc(r.designation) + '</span>' + (r.froid ? ' <span class="ph-froid">FROID</span>' : '') + (r.manual ? ' <span class="ph-manual">ajouté</span>' : '') + '</td>' +
        '<td class="mono" style="color:var(--muted);font-size:12px">' + esc(r.cip) + '</td>' +
        '<td class="num cat-ip" style="color:var(--ip-blue);font-weight:700">' + (r.prix_ip > 0 ? V2.fmtEur(r.prix_ip) + (r.offre ? ' <span class="ph-offre">offre</span>' : '') : '—') + '</td>' +
        '<td class="num" style="color:var(--c-mint);font-weight:700">' + (r.remise > 0 ? r.remise + '%' : '—') + '</td>' +
        '<td class="num" style="font-weight:800">' + r.sortie + '<span style="color:var(--muted-2);font-weight:500">/' + panel + '</span></td>' +
        '<td style="width:46px;text-align:center"><button type="button" class="opp-add' + (on ? ' on' : '') + '" data-cip="' + esc(r.cip) + '" onclick="V2.pharmaToggleSel(this)" aria-label="Sélectionner pour le PDF">' + ICO(on ? 'check' : 'plus', 15) + '</button></td>' +
        (enc ? '<td style="width:38px;text-align:center"><button type="button" class="ph-rmprod" title="Retirer ce produit de la liste" onclick="V2.itemRemove(\'' + enc + '\',\'' + esc(r.cip) + '\')">' + ICO('close', 14, 2) + '</button></td>' : '') +
      '</tr>';
    }).join('');
    var body = '<div class="v2-cat-table-wrap"><table class="v2-table">' +
      '<thead><tr><th class="num">#</th><th>Produit</th><th>CIP</th><th class="num">Prix net</th><th class="num">Remise</th>' +
      '<th class="num">Nbr pharma</th><th></th>' + (enc ? '<th></th>' : '') + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    return '<div class="v2-card v2-cat open">' + head + body + '</div>';
  }

  function renderGroupementDetail(root, grpName) {
    if (!window.BENCHMARK) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du catalogue…</div></div>';
      V2.loadFiles(['bench', 'sagitta']).then(function () { V2.render(); });
      return;
    }
    if (String(selPid) !== 'GRP:' + grpName) { selPid = 'GRP:' + grpName; selCips = new Set(); }
    var data = groupementProducts(grpName);
    var total = data.cats.reduce(function (s, o) { return s + o.rows.length; }, 0);
    var hero =
      '<div class="v2-card" style="margin-bottom:22px;padding:0">' +
        '<div style="display:flex;align-items:center;gap:14px;padding:20px 22px;border-bottom:1px solid var(--line);flex-wrap:wrap">' +
          grpLogo(grpName, true) +
          '<div style="flex:1;min-width:160px">' +
            '<div style="font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.1">' + esc(grpName) + '</div>' +
            '<div style="font-size:12px;color:var(--muted);margin-top:3px">' + data.panel + ' pharmacie' + (data.panel > 1 ? 's' : '') + ' active' + (data.panel > 1 ? 's' : '') + ' · ' + total + ' produits commandés · ' + periodLabel() + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button id="v2-opp-pdf" class="v2-btn v2-btn-primary" onclick="V2.grpDownloadPdf(\'' + encodeURIComponent(grpName) + '\')">' +
              ICO('download', 17) + (selCips && selCips.size ? 'Liste · ' + selCips.size + ' produit' + (selCips.size > 1 ? 's' : '') : 'Liste d\'achats (PDF)') + '</button>' +
            (V2.canShareFiles && V2.canShareFiles() ? '<button class="v2-btn v2-btn-ghost" onclick="V2.grpDownloadPdf(\'' + encodeURIComponent(grpName) + '\',\'share\')">' + ICO('spark', 16) + 'Partager</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    // ── Pharmacies membres du groupement ──
    var members = (V2.pharmacies || []).filter(function (p) {
      return groupName(p) === grpName;
    }).map(function (p) {
      var ps = pharmaSalesAll(p.id);
      return { p: p, ca: V2.sumCA(ps), active: ps.length > 0 };
    }).sort(function (a, b) { return (b.active - a.active) || (b.ca - a.ca); });
    var memRows = members.map(function (m) {
      return '<a class="v2-row" onclick="V2.go(\'pharma\',\'' + esc(String(m.p.id)) + '\')">' +
        '<span class="v2-row-dot" style="background:' + esc(m.p.color || 'var(--c-cat)') + '"></span>' +
        '<span class="v2-row-name">' + esc(m.p.name) + (m.p.ville ? ' <span style="color:var(--muted);font-weight:500">· ' + esc(m.p.ville) + '</span>' : '') + '</span>' +
        (m.active ? '<span class="v2-row-val mono">' + V2.fmtEur(m.ca) + '</span>' : '<span class="v2-row-meta">non cliente</span>') +
        '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
    }).join('');
    var membersCard =
      '<div class="v2-card" style="margin-bottom:22px">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pharma', 17) + 'Pharmacies du groupement</div>' +
          '<span class="v2-card-link" style="cursor:default;color:var(--muted)">' + members.length + ' · ' + data.panel + ' cliente' + (data.panel > 1 ? 's' : '') + '</span></div>' +
        (memRows || '<div class="v2-empty"><div class="v2-empty-d">Aucune pharmacie de ce groupement dans tes données.</div></div>') +
      '</div>';
    var catsHtml = data.cats.length
      ? data.cats.map(function (o, i) { return renderGrpCatCard(o, i, data.panel, data.ovKey); }).join('')
      : '<div class="v2-empty"><div class="v2-empty-d">Aucun achat identifié pour ce groupement.</div></div>';
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap ph-detail" style="--accent:var(--pil-opp)">' +
        '<button class="v2-back" style="margin-bottom:16px" onclick="V2.pharmaGroupBack()">' + ICO('back', 16) + 'Tous les groupements</button>' +
        hero +
        membersCard +
        sectionHead('Liste d\'achats idéale', 'produits triés par nombre de pharmacies qui les commandent (Sortie)') +
        prodToolbar(data.ovKey) +
        catsHtml +
      '</div>' +
      pharmaCartbar();

    refreshCartbar();
  }

  // ── Handlers groupements ──
  V2.pharmaView = function (v) { pharmaView = v; selGroup = null; selList = null; V2.render(); };
  // ── Commande recommandée : pré-remplit une fiche avec les meilleures opportunités ──
  V2.pharmaRecoOrder = function (pid) {
    if (!window.BENCHMARK) { V2.toast('Catalogue en cours de chargement…'); V2.loadFiles(['bench']).then(function () {}); return; }
    if (!V2.fiches || !V2.fiches.createFrom) { V2.toast('Module fiches indisponible', 'error'); return; }
    var cats = buildOpportunities(pid), rows = [];
    cats.forEach(function (o) { (o.rows || []).forEach(function (r) { rows.push(r); }); });
    rows.sort(function (a, b) { return b.marketQte - a.marketQte; });
    rows = rows.slice(0, 20);
    if (!rows.length) { V2.toast('Aucune opportunité à recommander pour cette officine', 'warn'); return; }
    var bIdx = benchIndex();
    var products = rows.map(function (r) {
      var b = bIdx.get(r.cip), bp = b ? V2.bestPrice(b) : { ip: r.prix_ip, ht: null, remise: 0 };
      return { cip13: r.cip, designation: r.designation, prix_ip: bp.ip, prix_ht: bp.ht, remise_pct: bp.remise, is_froid: b ? !!b.is_froid : false, qty: 1 };
    });
    var ph = (V2.pharmacies || []).filter(function (p) { return String(p.id) === String(pid); })[0];
    V2.fiches.createFrom({ title: 'Commande recommandée — ' + (ph ? ph.name : ''), destId: String(pid), products: products });
    V2.toast(rows.length + ' produits recommandés');
  };
  V2.pharmaGroup = function (enc) { try { selGroup = decodeURIComponent(enc); } catch (e) { selGroup = enc; } V2.render(); window.scrollTo(0, 0); };
  V2.pharmaGroupBack = function () { selGroup = null; V2.render(); };

  // ── Handlers LISTES personnalisées ──
  V2.pharmaListOpen = function (id) { selList = id; V2.render(); window.scrollTo(0, 0); };
  V2.pharmaListBack = function () { selList = null; V2.render(); };
  V2.pharmaListNew = function () {
    var name = (window.prompt('Nom de la liste (ex : Big pharma, Pharma PDA, Liste NR) :') || '').trim();
    if (!name) return;
    var l = { id: 'L' + (V2._lid = (V2._lid || 0) + 1) + '_' + (listsGet().length + 1) + '_' + name.replace(/\W+/g, '').slice(0, 6), name: name, ids: [] };
    listUpsert(l); selList = l.id; V2.render(); window.scrollTo(0, 0);
  };
  V2.pharmaListRename = function (id) {
    var l = listGet(id); if (!l) return;
    var name = (window.prompt('Renommer la liste :', l.name) || '').trim(); if (!name) return;
    l.name = name; listUpsert(l); V2.render();
  };
  V2.pharmaListDelete = function (id) {
    var l = listGet(id); if (!l) return;
    if (!window.confirm('Supprimer la liste « ' + l.name + ' » ? (les pharmacies ne sont pas supprimées, juste la liste)')) return;
    listsSave(listsGet().filter(function (x) { return x.id !== id; }));
    selList = null; V2.toast('Liste supprimée'); V2.render();
  };
  V2.pharmaListRemovePh = function (id, pid) {
    var l = listGet(id); if (!l) return;
    l.ids = (l.ids || []).filter(function (x) { return String(x) !== String(pid); });
    listUpsert(l); V2.render();
  };
  // — Sélecteur d'ajout de pharmacies (modale) —
  V2.pharmaListAddOpen = function (id) {
    var l = listGet(id); if (!l) return;
    plPick = { q: '', grp: '', set: {} };
    renderPickModal(l);
  };
  V2.plPickSearch = function (q) { plPick.q = q || ''; refreshPickList(); };
  V2.plPickGrp = function (g) { plPick.grp = g || ''; refreshPickList(); };
  V2.plPickToggle = function (pid) { if (plPick.set[pid]) delete plPick.set[pid]; else plPick.set[pid] = 1; refreshPickList(); refreshPickCount(); };
  V2.plPickClose = function () { var m = document.getElementById('pl-pick'); if (m && m.parentNode) m.parentNode.removeChild(m); };
  V2.plPickConfirm = function (id) {
    var l = listGet(id); if (!l) return;
    var have = {}; (l.ids || []).forEach(function (x) { have[String(x)] = 1; });
    Object.keys(plPick.set).forEach(function (pid) { if (!have[pid]) l.ids.push(pid); });
    listUpsert(l); V2.plPickClose(); V2.toast('Pharmacies ajoutées'); V2.render();
  };

  // ── Curation des produits d'une liste d'achats (retirer / ajouter) ──
  function keepScroll(fn) { var y = window.scrollY || 0; fn(); try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); } }
  V2.itemRemove = function (enc, cip) {
    var key; try { key = decodeURIComponent(enc); } catch (e) { key = enc; }
    ovRemoveProduct(key, cip);
    keepScroll(function () { V2.render(); });
    V2.toast('Produit retiré');
  };
  V2.itemRestoreAll = function (enc) {
    var key; try { key = decodeURIComponent(enc); } catch (e) { key = enc; }
    ovRestoreAll(key);
    keepScroll(function () { V2.render(); });
    V2.toast('Produits masqués réaffichés');
  };
  var prodPick = { q: '', key: '', set: null };
  V2.itemAddOpen = function (enc) {
    var key; try { key = decodeURIComponent(enc); } catch (e) { key = enc; }
    if (!window.BENCHMARK) { V2.toast('Catalogue en cours de chargement…'); V2.loadFiles(['bench']).then(function () {}); return; }
    prodPick = { q: '', key: key, set: {} };
    renderProdPick();
  };
  V2.prodPickSearch = function (q) { prodPick.q = q || ''; refreshProdList(); };
  V2.prodPickToggle = function (cip) { if (prodPick.set[cip]) delete prodPick.set[cip]; else prodPick.set[cip] = 1; refreshProdList(); refreshProdCount(); };
  V2.prodPickClose = function () { var m = document.getElementById('prod-pick'); if (m && m.parentNode) m.parentNode.removeChild(m); };
  V2.prodPickConfirm = function () {
    var k = prodPick.key, n = 0;
    Object.keys(prodPick.set).forEach(function (cip) { ovAddProduct(k, cip); n++; });
    V2.prodPickClose();
    keepScroll(function () { V2.render(); });
    if (n) V2.toast(n + ' produit' + (n > 1 ? 's' : '') + ' ajouté' + (n > 1 ? 's' : ''));
  };
  function renderProdPick() {
    var ex = document.getElementById('prod-pick'); if (ex) ex.parentNode.removeChild(ex);
    var m = document.createElement('div'); m.id = 'prod-pick'; m.className = 'pl-pick-ov';
    m.innerHTML =
      '<div class="pl-pick-card" onclick="event.stopPropagation()">' +
        '<div class="pl-pick-top"><div class="pl-pick-t">Ajouter un produit à la liste</div>' +
          '<button class="prepa-x" onclick="V2.prodPickClose()" title="Fermer">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="pl-pick-filters"><input class="pl-pick-search" placeholder="Rechercher un produit (nom ou CIP)…" oninput="V2.prodPickSearch(this.value)"></div>' +
        '<div class="pl-pick-list" id="prod-pick-list"></div>' +
        '<div class="pl-pick-foot"><span id="prod-pick-count" class="mono">0 sélectionné</span>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.prodPickConfirm()">Ajouter à la liste</button></div>' +
      '</div>';
    m.addEventListener('click', function (e) { if (e.target === m) V2.prodPickClose(); });
    document.body.appendChild(m);
    refreshProdList(); refreshProdCount();
  }
  function refreshProdList() {
    var box = document.getElementById('prod-pick-list'); if (!box) return;
    var B = window.BENCHMARK || [], ql = (prodPick.q || '').toLowerCase().trim();
    if (ql.length < 2) { box.innerHTML = '<div style="padding:22px;text-align:center;color:var(--muted)">Tape au moins 2 lettres pour chercher un produit du catalogue.</div>'; return; }
    var out = [], n = 0;
    for (var i = 0; i < B.length && n < 400; i++) {
      var b = B[i], hay = ((b.designation || '') + ' ' + (b.cip13 || '')).toLowerCase();
      if (hay.indexOf(ql) < 0) continue;
      var cip = String(b.cip13 || ''), sel = !!prodPick.set[cip], bp = V2.bestPrice(b);
      out.push('<div class="pl-pick-row" onclick="V2.prodPickToggle(\'' + esc(cip) + '\')">' +
        '<span class="pl-pick-chk' + (sel ? ' on' : '') + '">' + (sel ? ICO('check', 13, 2.4) : '') + '</span>' +
        '<div style="flex:1;min-width:0"><div class="pl-pick-n">' + esc(b.designation || cip) + '</div>' +
          '<div class="pl-pick-a">' + esc(cip) + (bp.ip != null ? ' · ' + V2.fmtEur(bp.ip) : '') + '</div></div>' +
      '</div>'); n++;
    }
    box.innerHTML = out.join('') || '<div style="padding:22px;text-align:center;color:var(--muted)">Aucun produit trouvé.</div>';
  }
  function refreshProdCount() {
    var n = Object.keys(prodPick.set || {}).length, c = document.getElementById('prod-pick-count');
    if (c) c.textContent = n + ' sélectionné' + (n > 1 ? 's' : '');
  }
  // Générateur PDF générique « liste d'achats » (groupement OU liste perso)
  // Récap d'une officine pour le PDF (KPIs + CA/mois + commandé par tranche) — comble
  // le haut de page et donne le contexte RDV. Vide pour les PDF groupement/liste.
  function recapPdfHtml(pid) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (!pharma) return '';
    var sales = pharmaSales(pid);
    if (!sales.length) return '';
    var MONO = "'Geist Mono',ui-monospace,monospace";
    var ca = V2.sumCA(sales), marge = margeMDLpharma(sales);
    var nbRefs = new Set(sales.map(function (s) { return String(s.artCode || ''); }).filter(function (c) { return c.length >= 7; })).size;
    var months = monthlyCA(sales);
    var maxM = months.reduce(function (m, x) { return Math.max(m, x.ca); }, 1);
    var bars = months.map(function (m) {
      var w = m.ca > 0 ? Math.max(4, m.ca / maxM * 100) : 0;
      return '<div style="display:flex;align-items:center;gap:9px;padding:4px 0;border-bottom:1px solid #F4F6FB">' +
        '<span style="width:30px;font-size:9px;color:#737A8C;font-weight:700">' + cap(MN_SHORT[m.month - 1]) + '</span>' +
        '<div style="flex:1;height:11px;background:#EEF1F6;border-radius:6px;overflow:hidden"><div style="height:100%;width:' + w + '%;background:linear-gradient(90deg,#0050E6,#0034A0);border-radius:6px"></div></div>' +
        '<span style="width:48px;text-align:right;font-size:9px;font-weight:700;font-family:' + MONO + ';color:#10131C">' + V2.fmtK(m.ca) + '</span>' +
      '</div>';
    }).join('');
    var oc = ownedByCat(sales);
    var trRows = CATS.map(function (c) { var b = oc.buckets[c.key]; return { c: c, refs: b.refs.size, ca: b.ca }; })
      .filter(function (r) { return r.refs > 0; }).sort(function (a, b) { return b.ca - a.ca; })
      .map(function (r, i) {
        return '<tr' + (i ? ' style="border-top:1px solid #F1F4F9"' : '') + '>' +
          '<td style="padding:3px 0;font-size:10px;font-weight:600;color:#10131C"><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:' + r.c.color + ';margin-right:6px;vertical-align:middle"></span>' + esc(r.c.label) + '</td>' +
          '<td style="padding:3px 0;text-align:right;font-size:10px;font-family:' + MONO + ';color:#737A8C">' + V2.fmtNum(r.refs) + ' réfs</td>' +
          '<td style="padding:3px 0;text-align:right;font-size:10px;font-family:' + MONO + ';font-weight:700;color:#10131C">' + V2.fmtEur(r.ca) + '</td>' +
        '</tr>';
      }).join('');
    // CA/mois : barres verticales (hauteur), le mois max mis en avant en bleu (design « Tableau dense pro »)
    var colBars = months.map(function (m) {
      var h = m.ca > 0 ? Math.max(8, Math.round(m.ca / maxM * 56)) : 0;
      var hot = m.ca >= maxM * 0.999;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">' +
        '<div style="font-family:' + MONO + ';font-size:8px;color:' + (hot ? '#0050E6' : '#737A8C') + ';font-weight:' + (hot ? '700' : '400') + '">' + V2.fmtK(m.ca) + '</div>' +
        '<div style="width:100%;max-width:26px;height:' + h + 'px;background:' + (hot ? '#0050E6' : '#DCE6FB') + ';border-radius:3px 3px 0 0"></div>' +
        '<div style="font-size:8px;color:#737A8C;font-weight:600">' + cap(MN_SHORT[m.month - 1]) + '</div>' +
      '</div>';
    }).join('');
    var kpiTile = function (l, v, col, accent) {
      return '<div style="flex:1;border:1px solid #E7EBF2;border-radius:8px;padding:9px 11px;background:#F7F9FC' + (accent ? ';border-left:3px solid ' + accent : '') + '">' +
        '<div style="font-size:8.5px;font-weight:700;letter-spacing:.5px;color:#737A8C;text-transform:uppercase">' + l + '</div>' +
        '<div style="font-family:' + MONO + ';font-size:17px;font-weight:700;color:' + col + ';margin-top:3px">' + v + '</div></div>';
    };
    var grpTile = '<div style="flex:1;border:1px solid #E7EBF2;border-radius:8px;padding:9px 11px;background:#F7F9FC;border-left:3px solid #0050E6">' +
      '<div style="font-size:8.5px;font-weight:700;letter-spacing:.5px;color:#737A8C;text-transform:uppercase">' + (pharma.groupement ? 'Groupement' : 'Ville') + '</div>' +
      '<div style="font-size:15px;font-weight:800;color:#0050E6;margin-top:5px;letter-spacing:-.2px">' + esc(pharma.groupement || pharma.ville || '—') + '</div></div>';
    return '<div style="page-break-inside:avoid;margin-bottom:14px">' +
      '<div style="font-size:9.5px;font-weight:800;letter-spacing:1.2px;color:#737A8C;text-transform:uppercase;margin-bottom:7px">Récap de l\'officine</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px">' +
        kpiTile('CA cumulé', V2.fmtEur(ca), '#10131C', '') +
        kpiTile('Marge MDL générée', V2.fmtEur(marge), '#1E9E6A', '#1E9E6A') +
        kpiTile('Réf. commandées', V2.fmtNum(nbRefs), '#10131C', '') +
        grpTile +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<div style="flex:0 0 230px;border:1px solid #E7EBF2;border-radius:8px;padding:10px 12px">' +
          '<div style="font-size:8.5px;font-weight:800;letter-spacing:.8px;color:#737A8C;text-transform:uppercase;margin-bottom:9px">CA par mois</div>' +
          '<div style="display:flex;align-items:flex-end;gap:9px;height:74px">' + (colBars || '<div style="font-size:10px;color:#9AA1B2">—</div>') + '</div>' +
        '</div>' +
        '<div style="flex:1;border:1px solid #E7EBF2;border-radius:8px;padding:10px 12px">' +
          '<div style="font-size:8.5px;font-weight:800;letter-spacing:.8px;color:#737A8C;text-transform:uppercase;margin-bottom:8px">Ce qu\'elle commande déjà · par tranche</div>' +
          (trRows ? '<table style="width:100%;border-collapse:collapse;table-layout:fixed"><colgroup><col style="width:44%"><col style="width:28%"><col style="width:28%"></colgroup><tbody>' + trRows + '</tbody></table>' : '<div style="font-size:10px;color:#9AA1B2">Aucune commande identifiée.</div>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function achatsPdf(title, data, useSel, mode, portraitPid) {
    if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
    var grpName = title;
    var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    V2.toast('Génération du PDF…');
    function e2(v) { return (v ? v.toFixed(2).replace('.', ',') : '0,00') + ' €'; }
    // Multi-pages restauré (html2canvas auto-dimensionne sur la hauteur réelle de l'élément) :
    // plus de plafond — html2pdf pagine tout le contenu.
    var PDF_CAP = Infinity, truncated = false;
    var sections = data.cats.map(function (o) {
      var rows = (useSel && selCips) ? o.rows.filter(function (r) { return selCips.has(r.cip); }) : o.rows;
      if (rows.length > PDF_CAP) { rows = rows.slice(0, PDF_CAP); truncated = true; }
      return { cat: o.cat, rows: rows };
    }).filter(function (o) { return o.rows.length; });
    var totalProd = sections.reduce(function (s, o) { return s + o.rows.length; }, 0);
    var panel = (data.panel > 0) ? data.panel : 0;   // garde anti "x/0" dans le rendu
    if (!sections.length || !panel) { V2.toast('Aucun produit à proposer pour cette liste', 'warn'); return; }
    var MONO = "'Geist Mono',ui-monospace,monospace";
    var pharma = portraitPid ? (V2.pharmacies || []).find(function (p) { return String(p.id) === String(portraitPid); }) : null;
    var headName = pharma ? pharma.name : grpName;
    var headSub = pharma ? [pharma.code, pharma.ville].filter(function (x) { return x; }).join(' · ') : (panel + ' pharmacies du panel');
    var COLS6 = '<colgroup><col style="width:40%"><col style="width:20%"><col style="width:16%"><col style="width:11%"><col style="width:13%"></colgroup>';

    // ── Familles (en-tête de famille coloré + table dense, design "Tableau dense pro") ──
    var catHtml = sections.map(function (o) {
      var trs = o.rows.map(function (r, i) {
        var bg = (i % 2 === 1) ? '#F7F9FC' : '#FFFFFF';
        var badge = (r.froid ? ' <span style="font-size:7px;font-weight:800;color:#0086A3;background:#E3F7FB;padding:1px 5px;border-radius:4px;vertical-align:middle">FROID</span>' : '') +
          (r.offre ? ' <span style="font-size:7px;font-weight:800;color:#1E9E6A;background:#E6F6EE;padding:1px 5px;border-radius:4px;vertical-align:middle">OFFRE</span>' : '');
        return '<tr style="page-break-inside:avoid;background:' + bg + ';border-bottom:1px solid #F1F4F9">' +
          '<td style="padding:6px 8px;font-size:10px;font-weight:700;color:#10131C">' + esc((r.designation || '').slice(0, 52)) + badge + '</td>' +
          '<td style="padding:6px 8px;font-family:' + MONO + ';font-size:9px;color:#737A8C">' + esc(r.cip) + '</td>' +
          '<td style="padding:6px 8px;text-align:right;font-family:' + MONO + ';font-size:10px;font-weight:700;color:#10131C;white-space:nowrap">' + (r.prix_ip ? e2(r.prix_ip) : '—') + '</td>' +
          '<td style="padding:6px 8px;text-align:right;font-family:' + MONO + ';font-size:10px;font-weight:700;color:' + (r.remise > 0 ? o.cat.color : '#A8AFBE') + '">' + (r.remise > 0 ? r.remise + ' %' : '—') + '</td>' +
          '<td style="padding:6px 8px;text-align:center;font-family:' + MONO + ';font-size:9.5px;color:#10131C">' + r.sortie + '<span style="color:#A8AFBE">/' + panel + '</span></td>' +
          '</tr>';
      }).join('');
      return '<div style="page-break-after:avoid;page-break-inside:avoid;margin-top:11px">' +
        '<div style="background:' + o.cat.color + ';display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-radius:5px 5px 0 0">' +
          '<span style="color:#FFFFFF;font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase">' + esc(o.cat.label) + (o.cat.sub ? ' <span style="font-weight:600;color:rgba(255,255,255,.8)">· ' + esc(o.cat.sub) + '</span>' : '') + '</span>' +
          '<span style="color:rgba(255,255,255,.85);font-size:9px;font-weight:700">' + o.rows.length + ' produit' + (o.rows.length > 1 ? 's' : '') + '</span>' +
        '</div></div>' +
        '<table style="width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #E7EBF2;border-top:none">' + COLS6 +
          '<tbody>' + trs + '</tbody></table>';
    }).join('');

    var thd = function (h, al, light) { return '<th style="text-align:' + al + ';padding:6px 8px;font-size:8.5px;font-weight:800;letter-spacing:.6px;color:' + (light ? '#C7D2E6' : '#FFFFFF') + ';text-transform:uppercase">' + h + '</th>'; };

    var html = '<div style="width:794px;background:#FFFFFF;color:#10131C;font-family:Satoshi,Inter,system-ui,sans-serif;font-size:11px;line-height:1.35">' +
      // Bandeau en-tête
      '<div style="background:linear-gradient(90deg,#0034A0,#0050E6);padding:14px 22px;display:flex;align-items:center;justify-content:space-between;page-break-inside:avoid">' +
        '<div style="display:flex;align-items:center;gap:13px">' +
          '<div style="width:34px;height:34px;border-radius:8px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:800;color:#0050E6;font-size:17px;letter-spacing:-1px">IP</div>' +
          '<div><div style="color:#FFFFFF;font-size:15px;font-weight:800;line-height:1.1">Intégral Pharma</div>' +
            '<div style="color:#A9C2F5;font-size:10px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;margin-top:2px">Liste d\'achats recommandée</div></div>' +
        '</div>' +
        '<div style="text-align:right;color:#FFFFFF">' +
          '<div style="font-size:11px;font-weight:700">' + esc(headName) + '</div>' +
          '<div style="font-size:10px;color:#A9C2F5;margin-top:1px">' + esc(headSub) + '</div>' +
          '<div style="font-size:10px;color:#A9C2F5;margin-top:1px">Édité le ' + dateStr + ' · <span style="color:#FFFFFF;font-weight:700">' + totalProd + ' produits à pousser</span></div>' +
        '</div>' +
      '</div>' +
      // Sous-bandeau référence
      '<div style="background:#10131C;padding:6px 22px;page-break-inside:avoid">' +
        '<span style="color:#C7D2E6;font-size:9.5px;font-weight:600;letter-spacing:.3px">RÉFÉRENCE — ' + esc(grpName) + ' · <span style="color:#FFFFFF">' + panel + ' pharmacies</span> · produits commandés par la référence et absents de l\'officine</span>' +
      '</div>' +
      '<div style="padding:16px 22px 20px">' +
        (portraitPid ? recapPdfHtml(portraitPid) : '') +
        // Titre liste + en-tête colonnes global (sombre)
        '<div style="display:flex;align-items:center;justify-content:space-between;border-top:2px solid #10131C;padding-top:9px;margin-bottom:9px;page-break-after:avoid">' +
          '<div style="font-size:12px;font-weight:800;color:#10131C">Liste à pousser <span style="color:#737A8C;font-weight:600;font-size:10px">— ' + totalProd + ' produits, par famille</span></div>' +
          '<div style="font-size:9px;color:#737A8C">Nbr pharma = pharmacies qui commandent / ' + panel + '</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;table-layout:fixed;page-break-after:avoid">' + COLS6 +
          '<thead><tr style="background:#10131C">' + thd('Produit', 'left') + thd('CIP13', 'left', true) + thd('Prix net IP', 'right') + thd('Remise', 'right') + thd('Nbr pharma', 'center') + '</tr></thead></table>' +
        (catHtml || '<div style="color:#9AA1B2;padding:36px;text-align:center;font-size:12px">Aucun produit à proposer.</div>') +
        // Pied
        '<div style="margin-top:16px;padding-top:9px;border-top:1px solid #E7EBF2;display:flex;align-items:center;justify-content:space-between;page-break-inside:avoid">' +
          '<div style="font-size:8.5px;color:#737A8C;line-height:1.45"><span style="font-weight:800;color:#0050E6">Intégral Pharma</span> · Liste d\'achats recommandée — données réseau au ' + dateStr + '.<br>Prix nets HT indicatifs. Nbr pharma = nb de pharmacies de la référence commandant le produit / ' + panel + '.' + (truncated ? '<br>Top ' + PDF_CAP + ' par famille (les plus commandés) — pour cocher d\'autres produits, sélectionne-les dans l\'app avant l\'export.' : '') + '</div>' +
          '<div style="text-align:right;font-size:8.5px;color:#A8AFBE;white-space:nowrap">' + esc(grpName) + (pharma && pharma.ville ? '<br>' + esc(pharma.ville) : '') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    // Aperçu avant impression (sauf clic explicite "Partager" sur mobile → partage direct)
    var fn = 'Liste-' + grpName.replace(/[^A-Za-z0-9-]/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
    var shareTitle = 'Liste d\'achats · ' + grpName;
    if (mode === 'share') { pdfGenerate(html, fn, 'share', shareTitle); }
    else { V2.pdfPreview(html, fn, shareTitle); }
  }

  // Génère et télécharge/partage un PDF à partir d'un HTML 794px (réutilisable).
  function pdfGenerate(html, fn, mode, shareTitle) {
    if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
    V2.toast('Génération du PDF…');
    window.ensureHtml2Pdf().then(function () {
      return (document.fonts && document.fonts.ready) ? document.fonts.ready : null;
    }).then(function () {
      try { window.scrollTo(0, 0); } catch (e) {}
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;left:0;top:0;width:794px;overflow:hidden;background:#fff;z-index:1';
      wrap.innerHTML = html; document.body.appendChild(wrap);
      var veil = document.createElement('div');
      veil.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:2147483600;display:flex;align-items:center;justify-content:center;font:600 14px Satoshi,system-ui,sans-serif;color:#737A8C';
      veil.textContent = 'Génération du PDF…';
      document.body.appendChild(veil);
      var worker = window.html2pdf().from(wrap.firstChild).set({
        filename: fn, margin: [0, 0, 0, 0], image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
      });
      function cleanup() { if (wrap.parentNode) document.body.removeChild(wrap); if (veil.parentNode) document.body.removeChild(veil); }
      if (mode === 'share' && V2.shareOrSaveBlob) {
        worker.outputPdf('blob').then(function (blob) { return V2.shareOrSaveBlob(blob, fn, shareTitle || fn); })
          .then(function () { cleanup(); V2.toast('PDF prêt à partager'); })
          .catch(function (e) { console.error(e); cleanup(); V2.toast('Erreur PDF', 'error'); });
      } else {
        worker.save().then(function () { cleanup(); V2.toast('PDF téléchargé'); })
          .catch(function (e) { console.error(e); cleanup(); V2.toast('Erreur PDF', 'error'); });
      }
    });
  }

  // Génère le PDF DEPUIS l'élément exact de l'aperçu (ce que l'utilisateur voit) -> rendu identique.
  function pdfFromSheet(fn, mode, shareTitle) {
    var sheet = document.getElementById('pdfprev-sheet');
    var inner = sheet && sheet.firstChild;
    if (!inner) { V2.toast('Aperçu introuvable', 'error'); return; }
    if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
    var prevT = sheet.style.transform; sheet.style.transform = 'none';   // capture à l'échelle 1:1 (794px réels)
    V2.toast('Génération du PDF…');
    window.ensureHtml2Pdf().then(function () {
      return (document.fonts && document.fonts.ready) ? document.fonts.ready : null;
    }).then(function () {
      var worker = window.html2pdf().from(inner).set({
        filename: fn, margin: [0, 0, 0, 0], image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
      });
      function done(msg) { sheet.style.transform = prevT; V2.toast(msg); }
      if (mode === 'share' && V2.shareOrSaveBlob) {
        worker.outputPdf('blob').then(function (blob) { return V2.shareOrSaveBlob(blob, fn, shareTitle || fn); })
          .then(function () { done('PDF prêt à partager'); }).catch(function (e) { console.error(e); done('Erreur PDF'); });
      } else {
        worker.save().then(function () { done('PDF téléchargé'); }).catch(function (e) { console.error(e); done('Erreur PDF'); });
      }
    });
  }

  // Aperçu avant impression — modal WYSIWYG (réutilise le style .prepa-*)
  function fitPrevSheet() {
    var scroll = document.getElementById('pdfprev-scroll'), holder = document.getElementById('pdfprev-holder'), sheet = document.getElementById('pdfprev-sheet');
    if (!scroll || !holder || !sheet) return;
    var avail = scroll.clientWidth - 32; if (avail <= 0) return;
    var scale = Math.min(1, avail / 794);
    sheet.style.transform = 'scale(' + scale + ')';
    var h = sheet.firstChild ? sheet.firstChild.offsetHeight : sheet.offsetHeight;
    holder.style.width = (794 * scale) + 'px'; holder.style.height = (h * scale) + 'px';
  }
  V2.pdfPreviewClose = function () { var b = document.getElementById('pdf-prev'); if (b) b.classList.remove('open'); };
  V2.pdfPreview = function (html, fn, shareTitle) {
    var bd = document.getElementById('pdf-prev');
    if (!bd) {
      bd = document.createElement('div'); bd.id = 'pdf-prev'; bd.className = 'prepa-modal';
      bd.innerHTML = '<div class="prepa-dialog" onclick="event.stopPropagation()">' +
        '<div class="prepa-top">' +
          '<div class="prepa-tt">' + ICO('fiche', 17, 2) + ' Aperçu avant impression</div>' +
          '<button class="v2-btn v2-btn-primary" id="pdfprev-dl">' + ICO('download', 16) + ' Télécharger</button>' +
          (V2.canShareFiles && V2.canShareFiles() ? '<button class="v2-btn v2-btn-ghost" id="pdfprev-sh">' + ICO('spark', 16) + ' Partager</button>' : '') +
          '<button class="prepa-x" onclick="V2.pdfPreviewClose()" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
        '</div>' +
        '<div class="prepa-scroll" id="pdfprev-scroll"><div class="prepa-holder" id="pdfprev-holder"><div class="prepa-sheet" id="pdfprev-sheet"></div></div></div>' +
      '</div>';
      bd.onclick = function () { V2.pdfPreviewClose(); };
      document.body.appendChild(bd);
    }
    bd.querySelector('#pdfprev-sheet').innerHTML = html;
    bd.querySelector('#pdfprev-dl').onclick = function () { pdfFromSheet(fn, 'save'); };
    var sh = bd.querySelector('#pdfprev-sh'); if (sh) sh.onclick = function () { pdfFromSheet(fn, 'share', shareTitle); };
    bd.classList.add('open');
    requestAnimationFrame(function () { requestAnimationFrame(fitPrevSheet); });
    if (!V2._pdfPrevResize) { window.addEventListener('resize', fitPrevSheet); V2._pdfPrevResize = true; }
  };
  V2.grpDownloadPdf = function (enc, mode) {
    var grpName; try { grpName = decodeURIComponent(enc); } catch (e) { grpName = enc; }
    achatsPdf(grpName, groupementProducts(grpName), !!(selCips && selCips.size && selPid === 'GRP:' + grpName), mode);
  };
  V2.listDownloadPdf = function (id, mode) {
    var l = listGet(id); if (!l) return;
    achatsPdf(l.name, productsForIds(listIdsObj(l), 'LST:' + id), !!(selCips && selCips.size && selPid === 'LST:' + id), mode);
  };
  // PDF officine = liste d'achats PURE (même format que le groupement, SANS récap RDV).
  // scope = 'reseau' (réf. réseau IP) | 'groupement' (réf. son groupement). Toute la liste.
  V2.pharmaListPdf = function (pid, scope, mode) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (!pharma) { V2.toast('Pharmacie introuvable', 'error'); return; }
    if (!window.BENCHMARK) { V2.toast('Catalogue en cours de chargement…'); V2.loadFiles(['bench', 'sagitta']).then(function () {}); return; }
    scope = (scope === 'groupement') ? 'groupement' : 'reseau';
    var data = buildRecoCats(pid, scope);
    var label = (scope === 'groupement') ? (groupementPids(pid).name || 'Groupement') : 'Réseau Intégral Pharma';
    achatsPdf(pharma.name + ' — ' + label, data, false, mode, pid);
  };
  V2.grpToggleCat = function (catKey) {
    var key = 'g_' + catKey, idx = -1;
    for (var i = 0; i < CATS.length; i++) { if (CATS[i].key === catKey) { idx = i; break; } }
    var cur = (key in grpCollapsed) ? grpCollapsed[key] : (idx !== 0);
    grpCollapsed[key] = !cur;
    var y = window.scrollY || 0; V2.render();
    try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
  };

  // ════════════════════════════════════════════
  // LISTES PERSONNALISÉES (Big pharma, PDA, NR…)
  // ════════════════════════════════════════════
  function renderListesList(root) {
    var lists = listsGet();
    var cards = lists.map(function (l) {
      var ids = listIdsObj(l), ca = 0, actSet = {};
      (V2.sales || []).forEach(function (s) { if (ids[String(s.pharmacyId)]) { ca += s.mntNetHt || 0; actSet[String(s.pharmacyId)] = 1; } });
      var nb = (l.ids || []).length, active = Object.keys(actSet).length;
      return '<a class="v2-row" onclick="V2.pharmaListOpen(\'' + esc(l.id) + '\')">' +
        '<span class="pl-badge">' + ICO('fiche', 16) + '</span>' +
        '<div style="flex:1;min-width:0"><div class="v2-row-name">' + esc(l.name) + '</div>' +
          '<div class="v2-row-meta mono">' + nb + ' pharmacie' + (nb > 1 ? 's' : '') + ' · ' + active + ' active' + (active > 1 ? 's' : '') + '</div></div>' +
        '<span class="v2-row-val mono">' + V2.fmtEur(ca) + '</span>' +
        '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
    }).join('');
    var empty = '<div class="v2-empty"><div class="v2-empty-t">Aucune liste pour l\'instant</div>' +
      '<div class="v2-empty-d">Crée des listes sur-mesure (ex : Big pharma, Pharma PDA, Liste NR) en piochant des pharmacies dans n\'importe quel groupement. Tu retrouves leurs achats agrégés et l\'export PDF, exactement comme pour un groupement.</div></div>';
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-title">Opportunités pharmacie</div>' +
        '<div class="v2-page-sub">Mes listes sur-mesure · des pharmacies que tu regroupes toi-même</div>' +
        pharmaTabs('listes') +
        '<div style="display:flex;justify-content:flex-end;margin:2px 0 12px"><button class="v2-btn v2-btn-primary" onclick="V2.pharmaListNew()">' + ICO('plus', 16) + ' Nouvelle liste</button></div>' +
        (lists.length ? '<div class="v2-card">' + cards + '</div>' : empty) +
      '</div>';
  }

  function renderListeDetail(root, id) {
    var l = listGet(id);
    if (!l) { selList = null; renderListesList(root); return; }
    if (!window.BENCHMARK) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du catalogue…</div></div>';
      V2.loadFiles(['bench', 'sagitta']).then(function () { V2.render(); });
      return;
    }
    if (String(selPid) !== 'LST:' + id) { selPid = 'LST:' + id; selCips = new Set(); }
    var ids = listIdsObj(l);
    var data = productsForIds(ids, 'LST:' + id);
    var total = data.cats.reduce(function (s, o) { return s + o.rows.length; }, 0);
    var nb = (l.ids || []).length;
    var hero =
      '<div class="v2-card" style="margin-bottom:22px;padding:0">' +
        '<div style="display:flex;align-items:center;gap:14px;padding:20px 22px;border-bottom:1px solid var(--line);flex-wrap:wrap">' +
          '<span class="pl-badge pl-badge-big">' + ICO('fiche', 22) + '</span>' +
          '<div style="flex:1;min-width:160px">' +
            '<div style="font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.1">' + esc(l.name) +
              ' <button class="pl-rename" title="Renommer" onclick="V2.pharmaListRename(\'' + esc(id) + '\')">' + ICO('fiche', 13) + '</button></div>' +
            '<div style="font-size:12px;color:var(--muted);margin-top:3px">' + nb + ' pharmacie' + (nb > 1 ? 's' : '') + ' · ' + data.panel + ' active' + (data.panel > 1 ? 's' : '') + ' · ' + total + ' produits commandés · ' + periodLabel() + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.pharmaListAddOpen(\'' + esc(id) + '\')">' + ICO('plus', 16) + 'Ajouter des pharmacies</button>' +
            (total ? '<button class="v2-btn v2-btn-primary" onclick="V2.listDownloadPdf(\'' + esc(id) + '\')">' + ICO('download', 17) + (selCips && selCips.size ? 'Liste · ' + selCips.size + ' produit' + (selCips.size > 1 ? 's' : '') : 'Liste d\'achats (PDF)') + '</button>' : '') +
            (total && V2.canShareFiles && V2.canShareFiles() ? '<button class="v2-btn v2-btn-ghost" onclick="V2.listDownloadPdf(\'' + esc(id) + '\',\'share\')">' + ICO('spark', 16) + 'Partager</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    var members = (V2.pharmacies || []).filter(function (p) { return ids[String(p.id)]; }).map(function (p) {
      var ps = pharmaSalesAll(p.id);
      return { p: p, ca: V2.sumCA(ps), active: ps.length > 0 };
    }).sort(function (a, b) { return (b.active - a.active) || (b.ca - a.ca); });
    var memRows = members.map(function (m) {
      return '<div class="v2-row pl-mem" onclick="V2.go(\'pharma\',\'' + esc(String(m.p.id)) + '\')">' +
        '<span class="v2-row-dot" style="background:' + esc(m.p.color || 'var(--c-cat)') + '"></span>' +
        '<span class="v2-row-name">' + esc(m.p.name) + (m.p.ville ? ' <span style="color:var(--muted);font-weight:500">· ' + esc(m.p.ville) + '</span>' : '') +
          (m.p.groupement ? ' <span class="pl-mem-grp">' + esc(groupName(m.p)) + '</span>' : '') + '</span>' +
        (m.active ? '<span class="v2-row-val mono">' + V2.fmtEur(m.ca) + '</span>' : '<span class="v2-row-meta">non cliente</span>') +
        '<button class="pl-rm" title="Retirer de la liste" onclick="event.stopPropagation();V2.pharmaListRemovePh(\'' + esc(id) + '\',\'' + esc(String(m.p.id)) + '\')">' + ICO('close', 15, 2) + '</button>' +
      '</div>';
    }).join('');
    var membersCard =
      '<div class="v2-card" style="margin-bottom:22px">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pharma', 17) + 'Pharmacies de la liste</div>' +
          '<span class="v2-card-link" onclick="V2.pharmaListAddOpen(\'' + esc(id) + '\')">+ Ajouter</span></div>' +
        (memRows || '<div class="v2-empty"><div class="v2-empty-d">Liste vide. Clique « Ajouter des pharmacies » pour piocher des officines (filtre par groupement disponible).</div></div>') +
      '</div>';
    var catsHtml = data.cats.length
      ? data.cats.map(function (o, i) { return renderGrpCatCard(o, i, data.panel, data.ovKey); }).join('')
      : (nb ? '<div class="v2-empty"><div class="v2-empty-d">Aucun achat identifié pour ces pharmacies.</div></div>' : '');
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap ph-detail" style="--accent:var(--pil-opp)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;flex-wrap:wrap">' +
          '<button class="v2-back" onclick="V2.pharmaListBack()">' + ICO('back', 16) + 'Mes listes</button>' +
          '<button class="v2-btn v2-btn-ghost pl-del" onclick="V2.pharmaListDelete(\'' + esc(id) + '\')">' + ICO('close', 15, 2) + 'Supprimer la liste</button>' +
        '</div>' +
        hero +
        membersCard +
        (nb ? sectionHead('Liste d\'achats idéale', 'produits triés par nombre de pharmacies de la liste qui les commandent (Sortie)') : '') +
        (nb ? prodToolbar(data.ovKey) : '') +
        catsHtml +
      '</div>' +
      pharmaCartbar();
    refreshCartbar();
  }

  // ── Sélecteur d'ajout de pharmacies (modale) ──
  function renderPickModal(l) {
    var ex = document.getElementById('pl-pick'); if (ex) ex.parentNode.removeChild(ex);
    var grps = {}; (V2.pharmacies || []).forEach(function (p) { var g = groupName(p); grps[g] = 1; });
    var grpOpts = '<option value="">Tous les groupements</option>' +
      Object.keys(grps).sort().map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join('');
    var m = document.createElement('div'); m.id = 'pl-pick'; m.className = 'pl-pick-ov';
    m.innerHTML =
      '<div class="pl-pick-card" onclick="event.stopPropagation()">' +
        '<div class="pl-pick-top"><div class="pl-pick-t">Ajouter à « ' + esc(l.name) + ' »</div>' +
          '<button class="prepa-x" onclick="V2.plPickClose()" title="Fermer">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="pl-pick-filters">' +
          '<input class="pl-pick-search" placeholder="Rechercher (nom, ville, CP)…" oninput="V2.plPickSearch(this.value)">' +
          '<select class="pl-pick-grp" onchange="V2.plPickGrp(this.value)">' + grpOpts + '</select>' +
        '</div>' +
        '<div class="pl-pick-list" id="pl-pick-list"></div>' +
        '<div class="pl-pick-foot"><span id="pl-pick-count" class="mono">0 sélectionnée</span>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.plPickConfirm(\'' + esc(l.id) + '\')">Ajouter à la liste</button></div>' +
      '</div>';
    m.addEventListener('click', function (e) { if (e.target === m) V2.plPickClose(); });
    document.body.appendChild(m);
    refreshPickList(); refreshPickCount();
  }
  function refreshPickList() {
    var box = document.getElementById('pl-pick-list'); if (!box) return;
    var l = selList ? listGet(selList) : null;
    var have = {}; (l && l.ids || []).forEach(function (x) { have[String(x)] = 1; });
    var ql = (plPick.q || '').toLowerCase().trim();
    var rows = (V2.pharmacies || []).filter(function (p) {
      if (plPick.grp && groupName(p) !== plPick.grp) return false;
      if (ql && ((p.name || '') + ' ' + (p.ville || '') + ' ' + (p.cp || '')).toLowerCase().indexOf(ql) < 0) return false;
      return true;
    }).slice(0, 500);
    box.innerHTML = rows.map(function (p) {
      var pid = String(p.id), inList = !!have[pid], sel = !!plPick.set[pid];
      return '<div class="pl-pick-row' + (inList ? ' in' : '') + '"' + (inList ? '' : ' onclick="V2.plPickToggle(\'' + esc(pid) + '\')"') + '>' +
        '<span class="pl-pick-chk' + (sel || inList ? ' on' : '') + '">' + ((sel || inList) ? ICO('check', 13, 2.4) : '') + '</span>' +
        '<div style="flex:1;min-width:0"><div class="pl-pick-n">' + esc(p.name) + '</div>' +
          '<div class="pl-pick-a">' + esc(p.ville || '') + (p.groupement ? ' · ' + esc(groupName(p)) : '') + '</div></div>' +
        (inList ? '<span class="pl-pick-tag">déjà</span>' : '') +
      '</div>';
    }).join('') || '<div style="padding:22px;text-align:center;color:var(--muted)">Aucune pharmacie.</div>';
  }
  function refreshPickCount() {
    var n = Object.keys(plPick.set || {}).length, c = document.getElementById('pl-pick-count');
    if (c) c.textContent = n + ' sélectionnée' + (n > 1 ? 's' : '');
  }

  // ════════════════════════════════════════════
  // CARTE DE MON SECTEUR
  // ════════════════════════════════════════════
  var _secMap = null;
  function ensureLeafletP(cb) {
    if (window.L && window.L.map) { cb(); return; }
    if (window.__leafletLoadingP) { setTimeout(function () { ensureLeafletP(cb); }, 200); return; }
    window.__leafletLoadingP = true;
    var css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = 'vendor/leaflet/leaflet.css'; document.head.appendChild(css);
    var s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js';
    s.onload = function () { cb(); }; s.onerror = function () { cb(); }; document.head.appendChild(s);
  }
  // CA total d'une officine (respecte le filtre commercial)
  function caOfPharma(pid) { return V2.sumCA(pharmaSales(pid)); }
  // palette par CA : prospect (gris) → client (bleu de + en + foncé)
  function secStyle(ca) {
    if (ca <= 0) return { r: 5, color: '#9AA1B2', fill: '#C4CAD6' };
    if (ca < 3000) return { r: 7, color: '#0050E6', fill: '#7FB0FF' };
    if (ca < 12000) return { r: 9, color: '#0050E6', fill: '#3D86FF' };
    if (ca < 35000) return { r: 12, color: '#0034A0', fill: '#0050E6' };
    return { r: 16, color: '#0034A0', fill: '#0034A0' };
  }
  function renderCarte(root) {
    var comms = V2.commercials ? V2.commercials() : [];
    var commBar = '';
    if (comms.length > 1) {
      var cb = function (val, lbl) { return '<button type="button" class="v2-seg' + (V2.commFilter === val ? ' on' : '') + '" style="--sc:var(--ip-blue)" onclick="V2.pharmaSetComm(\'' + val + '\')">' + lbl + '</button>'; };
      commBar = '<div class="v2-segs" style="margin-bottom:12px">' + cb('', 'Tous') + comms.map(function (c) { return cb(c, c); }).join('') + '</div>';
    }
    var withGeo = (V2.pharmacies || []).filter(function (p) {
      if (V2.commFilter && (p.comms || []).indexOf(V2.commFilter) < 0) return false;
      return typeof p.lat === 'number' && typeof p.lng === 'number';
    });
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-title">Opportunités pharmacie</div>' +
        '<div class="v2-page-sub">Carte de mon secteur · ' + withGeo.length + ' officines localisées</div>' +
        pharmaTabs('carte') + commBar +
        '<div class="sec-mapwrap"><div class="sec-map" id="sec-map"></div>' +
          '<div class="sec-legend">' +
            '<div class="sec-legend-t">Chiffre d\'affaires</div>' +
            '<div class="sec-legend-row"><span class="sec-dot" style="width:8px;height:8px;background:#C4CAD6;border-color:#9AA1B2"></span>prospect / pas de vente</div>' +
            '<div class="sec-legend-row"><span class="sec-dot" style="width:10px;height:10px;background:#7FB0FF;border-color:#0050E6"></span>jusqu\'à 3 k€</div>' +
            '<div class="sec-legend-row"><span class="sec-dot" style="width:13px;height:13px;background:#3D86FF;border-color:#0050E6"></span>3 – 12 k€</div>' +
            '<div class="sec-legend-row"><span class="sec-dot" style="width:16px;height:16px;background:#0050E6;border-color:#0034A0"></span>12 – 35 k€</div>' +
            '<div class="sec-legend-row"><span class="sec-dot" style="width:20px;height:20px;background:#0034A0;border-color:#0034A0"></span>35 k€ et +</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    ensureLeafletP(function () { initSecteurMap(withGeo); });
  }
  function initSecteurMap(list) {
    var el = document.getElementById('sec-map'); if (!el) return;
    if (!window.L) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Carte indisponible — vérifie ta connexion internet.</div>'; return; }
    if (_secMap) { try { _secMap.remove(); } catch (e) {} _secMap = null; }
    el.innerHTML = '';
    _secMap = window.L.map(el, { scrollWheelZoom: true, preferCanvas: true }).setView([46.7, 2.4], 6);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap, © CARTO', maxZoom: 19 }).addTo(_secMap);
    var pts = [];
    list.forEach(function (p) {
      var ca = caOfPharma(p.id), st = secStyle(ca);
      var mk = window.L.circleMarker([p.lat, p.lng], { radius: st.r, color: st.color, weight: 1.5, fillColor: st.fill, fillOpacity: .82 });
      var pop = '<b>' + esc(p.name) + '</b>' + (p.ville ? '<br>' + esc(p.cp || '') + ' ' + esc(p.ville) : '') +
        (p.groupement ? '<br><span style="color:#737A8C">' + esc(groupName(p)) + '</span>' : '') +
        '<br><b style="color:#0050E6">' + V2.fmtEur(ca) + '</b> de CA' +
        '<br><a href="#" onclick="V2.go(\'pharma\',\'' + esc(String(p.id)) + '\');return false" style="color:#0050E6;font-weight:700">Ouvrir la fiche →</a>';
      mk.bindPopup(pop); mk.addTo(_secMap); pts.push([p.lat, p.lng]);
    });
    if (pts.length) { try { _secMap.fitBounds(pts, { padding: [40, 40], maxZoom: 11 }); } catch (e) {} }
    setTimeout(function () { try { _secMap.invalidateSize(); } catch (e) {} }, 120);
  }

  V2.pages.pharma = {
    render: function (root, param) {
      // deep-link d'une sous-vue depuis l'accueil/⌘K : V2.go('pharma','groupements'|'listes'|'carte'|'officines')
      // consommé UNE SEULE FOIS (sinon ça réinitialise selGroup/selList à chaque rendu → on ne peut plus ouvrir un groupement)
      if (param === 'groupements' || param === 'listes' || param === 'carte' || param === 'officines') {
        pharmaView = param; selGroup = null; selList = null; param = null;
        if (V2.route) V2.route.param = null;
      }
      if (param) { renderDetail(root, param); return; }
      if (pharmaView === 'groupements') {
        if (selGroup) renderGroupementDetail(root, selGroup);
        else renderGroupementsList(root);
        return;
      }
      if (pharmaView === 'listes') {
        if (selList) renderListeDetail(root, selList);
        else renderListesList(root);
        return;
      }
      if (pharmaView === 'carte') { renderCarte(root); return; }
      renderList(root);
    }
  };

  // ── Styles spécifiques au pilier (injectés une fois) ───────────
  // Cohérents avec v2.css ; aucune classe .v2-* du design system n'est redéfinie.
  if (!document.getElementById('v2-pharma-style')) {
    var st = document.createElement('style');
    st.id = 'v2-pharma-style';
    st.textContent = [
      '.v2-pharma-pin{width:46px;height:46px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 3px 9px rgba(16,19,28,.18),0 1px 0 rgba(255,255,255,.25) inset}',
      '.v2-pharma-stats{display:grid;grid-template-columns:repeat(4,1fr)}',
      '@media(max-width:720px){.v2-pharma-stats{grid-template-columns:repeat(2,1fr)}}',
      '.v2-pharma-stat{padding:16px 22px;border-right:1px solid var(--line);border-top:1px solid var(--line)}',
      '.v2-pharma-stat:nth-child(-n+4){border-top:none}',
      '.v2-pharma-stat:nth-child(4n){border-right:none}',
      '@media(max-width:720px){.v2-pharma-stat:nth-child(2n){border-right:none}.v2-pharma-stat:nth-child(2){border-top:none}}',
      '.v2-pharma-stat-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}',
      '.v2-pharma-stat-v{font-size:22px;font-weight:700;letter-spacing:-.03em;margin-top:6px;color:var(--sc,var(--ip-ink))}',
      '.v2-cat{margin-bottom:13px;transition:box-shadow .2s var(--ease)}',
      '.v2-cat.open{box-shadow:var(--sh-3)}',
      '.v2-cat-head{display:flex;align-items:center;gap:14px;padding:15px 20px;cursor:pointer;user-select:none;transition:background .14s}',
      '.v2-cat-head:hover{background:var(--card-2)}',
      '.v2-cat-accent{width:5px;align-self:stretch;border-radius:3px;flex-shrink:0;min-height:34px}',
      '.v2-cat-titles{flex:1;min-width:0}',
      '.v2-cat-t{font-size:15px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}',
      '.v2-cat-sub{font-size:11.5px;font-weight:600;color:var(--muted);font-family:var(--mono)}',
      '.v2-cat-meta{font-size:11.5px;color:var(--muted);margin-top:3px}',
      '.v2-cat-chev{color:var(--muted-2);flex-shrink:0;transition:transform .25s var(--ease)}',
      '.v2-cat-chev.open{transform:rotate(90deg)}',
      '.v2-cat-table-wrap{overflow-x:auto;border-top:1px solid var(--line)}',
      '.v2-cat-prod{font-weight:600}',
      '.v2-cat-empty{padding:22px 20px;text-align:center;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}',
      // ── Activité officine : grille + chart mensuel + tranches ──
      '.ph-act-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:14px;margin-bottom:6px}',
      '@media(max-width:860px){.ph-act-grid{grid-template-columns:1fr}}',
      '.ph-mchart{display:flex;align-items:flex-end;gap:10px;height:150px}',
      '.ph-mbar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;min-width:0}',
      '.ph-mbar-v{font-size:10.5px;font-weight:700;color:var(--ip-ink-2)}',
      '.ph-mbar-track{flex:1;width:100%;max-width:42px;display:flex;align-items:flex-end;background:var(--line-2);border-radius:7px 7px 3px 3px;overflow:hidden}',
      '.ph-mbar-fill{display:block;width:100%;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,var(--c-fiche),var(--ip-blue-d));transition:height .6s var(--ease)}',
      '.ph-mbar-l{font-size:11px;color:var(--muted);font-weight:600}',
      '.ph-tr-cat{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13.5px}',
      '.ph-tr-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}',
      '.ph-tr-sub{font-size:11px;color:var(--muted);font-family:var(--mono);font-weight:500;margin-left:2px}',
      '.ph-tr-bar{height:4px;border-radius:999px;background:var(--line);overflow:hidden;margin-top:6px}',
      '.ph-tr-bar span{display:block;height:100%;border-radius:999px}',
      // ── Top 5 par catégorie ──
      '.ph-top-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}',
      '.ph-top-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);overflow:hidden}',
      '.ph-top-head{display:flex;align-items:center;gap:9px;padding:12px 15px;border-bottom:1px solid var(--line)}',
      '.ph-top-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}',
      '.ph-top-t{font-weight:800;font-size:13.5px;letter-spacing:-.01em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ph-top-n{font-size:11px;color:var(--muted);flex-shrink:0}',
      '.ph-top-row{display:flex;align-items:center;gap:10px;padding:8px 15px;border-bottom:1px solid var(--line-2)}',
      '.ph-top-row:last-child{border-bottom:none}',
      '.ph-top-rank{font-size:11px;color:var(--muted-2);width:14px;flex-shrink:0;text-align:right}',
      '.ph-top-name{flex:1;min-width:0;font-size:12.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ph-top-val{font-size:12px;font-weight:700;color:var(--ip-ink-2);flex-shrink:0}',
      '.ph-top-q{color:var(--muted);font-weight:500}',
      // onglets Officines / Groupements
      '.ph-vtabs{display:flex;gap:6px;margin:6px 0 18px}',
      '.ph-vtab{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:9px 16px;font-family:var(--font);font-size:13.5px;font-weight:700;color:var(--muted);cursor:pointer;box-shadow:var(--sh-1);transition:.16s var(--ease)}',
      '.ph-vtab svg{color:currentColor}',
      '.ph-vtab.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:0 3px 9px rgba(0,80,230,.26)}',
      '.ph-froid{font-size:8.5px;font-weight:800;letter-spacing:.03em;padding:1px 5px;border-radius:5px;color:var(--c-froid);background:color-mix(in srgb,var(--c-froid) 13%,#fff)}',
      '.ph-offre{font-size:8.5px;font-weight:800;letter-spacing:.03em;padding:1px 5px;border-radius:5px;color:var(--c-amber);background:color-mix(in srgb,var(--c-amber) 14%,#fff);text-transform:uppercase}',
      '.ph-manual{font-size:8.5px;font-weight:800;letter-spacing:.03em;padding:1px 5px;border-radius:5px;color:var(--pil-opp);background:color-mix(in srgb,var(--pil-opp) 13%,#fff);text-transform:uppercase}',
      '.ph-rmprod{width:26px;height:26px;border-radius:7px;border:1px solid var(--line);background:var(--card);color:var(--muted-2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:.15s var(--ease)}',
      '.ph-rmprod:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 35%,var(--line));background:color-mix(in srgb,var(--c-rose) 8%,#fff)}',
      // ── Listes personnalisées ──
      '.pl-badge{width:38px;height:38px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(150deg,var(--pil-opp),#16804f);box-shadow:0 3px 9px rgba(30,158,106,.28),0 1px 0 rgba(255,255,255,.25) inset}',
      '.pl-badge-big{width:48px;height:48px;border-radius:13px}',
      '.pl-rename{border:none;background:transparent;color:var(--muted-2);cursor:pointer;padding:2px;vertical-align:middle;border-radius:6px;transition:.15s var(--ease)}',
      '.pl-rename:hover{color:var(--ip-blue);background:var(--halo)}',
      '.pl-mem{cursor:pointer}',
      '.pl-mem-grp{font-size:10.5px;font-weight:700;color:var(--muted-2);background:var(--card-2);border:1px solid var(--line);border-radius:999px;padding:1px 8px;margin-left:6px;vertical-align:middle}',
      '.pl-rm{flex-shrink:0;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--muted-2);cursor:pointer;display:flex;align-items:center;justify-content:center;margin-left:8px;transition:.15s var(--ease)}',
      '.pl-rm:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 35%,var(--line));background:color-mix(in srgb,var(--c-rose) 8%,#fff)}',
      '.pl-del{color:var(--c-rose) !important}',
      // modale d\'ajout de pharmacies
      '.pl-pick-ov{position:fixed;inset:0;z-index:130;display:flex;align-items:center;justify-content:center;padding:4vh 16px;background:rgba(16,19,28,.45);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}',
      '.pl-pick-card{width:min(560px,96vw);max-height:90vh;display:flex;flex-direction:column;background:var(--card);border-radius:20px;box-shadow:var(--sh-pop);overflow:hidden}',
      '.pl-pick-top{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}',
      '.pl-pick-t{flex:1;font-weight:800;font-size:15.5px;letter-spacing:-.01em}',
      '.pl-pick-filters{display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}',
      '.pl-pick-search{flex:1;min-width:160px;border:1px solid var(--line);border-radius:var(--r-control);padding:9px 12px;font-family:var(--font);font-size:13.5px;background:var(--surf-sunken)}',
      '.pl-pick-grp{border:1px solid var(--line);border-radius:var(--r-control);padding:9px 12px;font-family:var(--font);font-size:13px;background:var(--card);max-width:200px}',
      '.pl-pick-list{flex:1;overflow-y:auto;padding:6px 0}',
      '.pl-pick-row{display:flex;align-items:center;gap:11px;padding:9px 16px;cursor:pointer;transition:background .12s}',
      '.pl-pick-row:hover{background:var(--card-2)}',
      '.pl-pick-row.in{opacity:.6;cursor:default}',
      '.pl-pick-chk{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--line-strong);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;transition:.12s var(--ease)}',
      '.pl-pick-chk.on{background:var(--ip-blue);border-color:var(--ip-blue)}',
      '.pl-pick-n{font-size:13.5px;font-weight:700;letter-spacing:-.01em}',
      '.pl-pick-a{font-size:11.5px;color:var(--muted);margin-top:1px}',
      '.pl-pick-tag{font-size:10px;font-weight:700;color:var(--muted-2);background:var(--card-2);border:1px solid var(--line);border-radius:999px;padding:2px 8px;flex-shrink:0}',
      '.pl-pick-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-top:1px solid var(--line);background:var(--card-2)}',
      // carte de secteur
      '.sec-mapwrap{position:relative;border-radius:var(--r-card);overflow:hidden;border:1px solid var(--line);box-shadow:var(--sh-1)}',
      '.sec-map{width:100%;height:calc(100vh - 280px);min-height:420px;background:#EAEEF3}',
      '.sec-legend{position:absolute;right:14px;bottom:14px;z-index:500;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:12px;padding:11px 13px;box-shadow:var(--sh-2);font-size:11.5px}',
      '.sec-legend-t{font-weight:800;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:7px}',
      '.sec-legend-row{display:flex;align-items:center;gap:8px;color:var(--ip-ink-2);margin-bottom:4px;font-weight:600}',
      '.sec-dot{display:inline-block;border-radius:50%;border:1.5px solid;flex-shrink:0}',
      '.sec-map .leaflet-popup-content{font:13px/1.45 var(--font,sans-serif);margin:10px 12px}',
      // logo groupement (image réelle ou badge initiales)
      '.grp-logo{width:38px;height:38px;border-radius:10px;flex-shrink:0;background:#fff;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:var(--sh-1)}',
      '.grp-logo img{max-width:100%;max-height:100%;object-fit:contain}',
      '.grp-logo-x{background:var(--c-cat);color:#fff;font-weight:800;font-size:14px;border:none}',
      '.grp-logo-big{width:48px;height:48px;border-radius:13px}',
      '.grp-logo-big.grp-logo-x{font-size:17px}',
      // ── Modal aperçu prépa RDV ──
      '.prepa-modal{position:fixed;inset:0;z-index:120;background:rgba(16,19,28,.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;opacity:0;pointer-events:none;transition:opacity .2s var(--ease)}',
      '.prepa-modal.open{opacity:1;pointer-events:auto}',
      '.prepa-dialog{width:min(900px,96vw);max-height:92vh;background:var(--card);border-radius:20px;box-shadow:var(--sh-pop);display:flex;flex-direction:column;overflow:hidden;transform:scale(.97);transition:transform .24s var(--ease)}',
      '.prepa-modal.open .prepa-dialog{transform:scale(1)}',
      '.prepa-top{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line);background:rgba(251,252,254,.85)}',
      '.prepa-tt{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;letter-spacing:-.01em;flex:1}',
      '.prepa-tt svg{color:var(--ip-blue)}',
      '.prepa-x{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.16s var(--ease)}',
      '.prepa-x:hover{color:var(--ip-ink);transform:rotate(90deg)}',
      '.prepa-scroll{overflow-y:auto;overflow-x:hidden;padding:24px;background:#EBEEF4;flex:1}',
      '.prepa-holder{margin:0 auto;overflow:hidden;border-radius:8px;box-shadow:0 14px 44px rgba(16,19,28,.2)}',
      '.prepa-sheet{width:794px;transform-origin:top left;background:#fff}',
      '@media(max-width:560px){.prepa-top{flex-wrap:wrap}.prepa-top .v2-btn{order:3;width:100%}}',
      // Badge "opportunités" dans la liste des officines
      '.v2-row-opp{flex-shrink:0;font-size:11.5px;font-weight:700;color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 12%,transparent);border:1px solid color-mix(in srgb,var(--c-opp) 26%,transparent);border-radius:999px;padding:3px 10px;letter-spacing:-.01em}',
      '.v2-row-opp-pending{color:var(--muted-2);background:var(--card-2);border-color:var(--line);font-weight:600}',
      // Bouton + de sélection produit (devient ✓ vert une fois coché)
      '.opp-add{width:28px;height:28px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s var(--ease);flex-shrink:0}',
      '.opp-add:hover{border-color:var(--c-opp);color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 8%,transparent)}',
      '.opp-add.on{background:var(--c-opp);border-color:var(--c-opp);color:#fff;box-shadow:0 2px 6px color-mix(in srgb,var(--c-opp) 40%,transparent)}',
      '.opp-add.on:hover{background:var(--c-opp);color:#fff}',
      // ── Best-sellers IP à pousser (analyse volumes) ──
      '.ipv-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid var(--line)}',
      '.ipv-row:last-child{border-bottom:none}',
      '.net-scope{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
      '.net-scope-b{flex:0 1 auto;padding:7px 13px;border-radius:9px;border:1px solid var(--line);background:var(--card);font-family:var(--font);font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}',
      '.net-scope-b:hover{color:var(--ip-ink)}',
      '.net-scope-b.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}',
      /* ===== Fiche officine master-détail (phf-) ===== */
      '.phf-shell{display:grid;grid-template-columns:312px 1fr;gap:18px;align-items:start}',
      '.phf-rail{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);overflow:hidden;position:sticky;top:74px}',
      '.phf-offhead{padding:20px;background:linear-gradient(150deg,var(--ip-blue),var(--ip-blue-d));color:#fff;position:relative;overflow:hidden}',
      '.phf-offhead::after{content:"";position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08)}',
      '.phf-code{display:inline-block;font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:.04em;background:rgba(255,255,255,.16);color:#fff;padding:4px 9px;border-radius:var(--r-pill);margin-bottom:11px}',
      '.phf-offname{font-size:19px;font-weight:800;line-height:1.15;letter-spacing:-.01em;margin:0;position:relative;z-index:1}',
      '.phf-offloc{font-size:13px;font-weight:500;opacity:.85;margin-top:5px;display:flex;align-items:center;gap:5px;position:relative;z-index:1}',
      '.phf-offloc svg{opacity:.9}',
      '.phf-contacts{display:flex;gap:8px;margin-top:14px;position:relative;z-index:1}',
      '.phf-cbtn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12.5px;font-weight:700;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:var(--r-btn);padding:9px 10px;cursor:pointer;transition:background .15s;text-decoration:none}',
      '.phf-cbtn:hover{background:rgba(255,255,255,.26)}',
      '.phf-kpis{padding:8px 20px 14px;border-bottom:1px solid var(--line)}',
      '.phf-kpi{display:flex;align-items:baseline;justify-content:space-between;padding:9px 0;border-bottom:1px dashed var(--line)}',
      '.phf-kpi:last-child{border-bottom:0}',
      '.phf-kpi-l{font-size:12.5px;color:var(--muted);font-weight:500}',
      '.phf-kpi-v{font-size:16px;font-weight:800;letter-spacing:-.01em}',
      '.phf-kpi-v.phf-pos{color:var(--c-opp)}',
      '.phf-kpi-v.phf-push{color:var(--ip-blue)}',
      '.phf-fam-title{padding:15px 20px 8px;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-2)}',
      '.phf-famlist{padding:0 12px 6px;display:flex;flex-direction:column;gap:3px}',
      '.phf-fam{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:11px 12px;border:1px solid transparent;border-radius:var(--r-md);background:none;cursor:pointer;font:inherit;color:var(--ip-ink);transition:background .14s,border-color .14s}',
      '.phf-fam:hover{background:var(--surf-sunken)}',
      '.phf-fam.on{background:var(--card-2);border-color:var(--line-strong);box-shadow:var(--sh-1)}',
      '.phf-dot{width:9px;height:9px;border-radius:50%;flex:none;box-shadow:0 0 0 3px rgba(0,0,0,.03)}',
      '.phf-fam-nm{flex:1;font-size:13.5px;font-weight:600;line-height:1.25}',
      '.phf-fam.on .phf-fam-nm{font-weight:800}',
      '.phf-fam-ct{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--muted);background:var(--surf-sunken);border-radius:var(--r-pill);padding:2px 9px;min-width:28px;text-align:center}',
      '.phf-fam.on .phf-fam-ct{background:var(--ip-blue);color:#fff}',
      '.phf-refbox{margin:10px 12px 14px;padding:13px;background:var(--surf-sunken);border:1px solid var(--line);border-radius:var(--r-md)}',
      '.phf-ref-h{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-2);margin-bottom:9px}',
      '.phf-ref{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;padding:10px 11px;border-radius:var(--r-sm);border:1.5px solid var(--line);background:var(--card);cursor:pointer;margin-bottom:7px;font:inherit;color:var(--ip-ink);transition:border-color .15s,box-shadow .15s}',
      '.phf-ref:last-child{margin-bottom:0}',
      '.phf-ref.on{border-color:var(--ip-blue);box-shadow:0 0 0 3px rgba(0,80,230,.10)}',
      '.phf-radio{width:16px;height:16px;border-radius:50%;border:2px solid var(--muted-2);flex:none;margin-top:1px;position:relative;transition:border-color .15s}',
      '.phf-ref.on .phf-radio{border-color:var(--ip-blue)}',
      '.phf-ref.on .phf-radio::after{content:"";position:absolute;inset:2px;border-radius:50%;background:var(--ip-blue)}',
      '.phf-ref-t{font-size:13px;font-weight:700;line-height:1.2;display:block}',
      '.phf-ref-s{font-size:11.5px;color:var(--muted);font-weight:500;margin-top:2px;display:block}',
      '.phf-segref{display:flex;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-btn);padding:4px}',
      '.phf-segref-b{flex:1;padding:9px 8px;border:0;border-radius:9px;background:transparent;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .15s,color .15s}',
      '.phf-segref-b:hover{color:var(--ip-ink)}',
      '.phf-segref-b.on{background:var(--ip-blue);color:#fff;box-shadow:var(--sh-1)}',
      /* Disposition HORIZONTALE (une seule colonne) */
      '.phf-hcard{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);padding:16px 20px;margin-bottom:14px}',
      '.phf-hid{min-width:180px;flex:1}',
      '.phf-hname{font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.15;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.phf-hloc{font-size:12.5px;color:var(--muted);font-weight:500;margin-top:4px;display:flex;align-items:center;gap:5px}',
      '.phf-hkpis{display:flex;gap:10px;flex-wrap:wrap}',
      '.phf-hkpi{background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);padding:8px 14px;min-width:92px}',
      '.phf-hkpi-l{display:block;font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap}',
      '.phf-hkpi-v{display:block;font-size:17px;font-weight:800;letter-spacing:-.01em;margin-top:2px}',
      '.phf-hkpi-v.phf-pos{color:var(--c-opp)}',
      '.phf-hkpi-v.phf-push{color:var(--ip-blue)}',
      '.phf-hcontacts{display:flex;gap:8px}',
      '.phf-cbtn2{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--ip-blue);background:var(--card-2);border:1px solid var(--line-strong);border-radius:var(--r-btn);padding:9px 12px;cursor:pointer;text-decoration:none;transition:background .15s,border-color .15s}',
      '.phf-cbtn2:hover{background:#fff;border-color:var(--ip-blue)}',
      '.phf-bar2{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:12px}',
      '.phf-refwrap{display:flex;align-items:center;gap:10px}',
      '.phf-refwrap .phf-ref-h{margin:0;white-space:nowrap}',
      '.phf-bar2 .phf-segref{width:auto}',
      '.phf-bar2 .phf-segref-b{flex:0 0 auto;padding:9px 14px}',
      '.phf-bar2r{display:flex;align-items:center;gap:12px;margin-left:auto}',
      '.phf-tabs{display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:6px;margin-bottom:14px}',
      '.phf-tab{flex:none;display:flex;align-items:center;gap:8px;padding:9px 14px;border:1px solid var(--line-strong);border-radius:var(--r-pill);background:var(--card);font:inherit;font-size:13px;font-weight:600;color:var(--ip-ink);cursor:pointer;white-space:nowrap;transition:background .14s,border-color .14s,color .14s}',
      '.phf-tab:hover{border-color:var(--ip-blue)}',
      '.phf-tab.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.phf-tab.on .phf-fam-ct{background:rgba(255,255,255,.22);color:#fff}',
      '.phf-phead{display:block}',
      '.ph-stats .ph-section{margin-bottom:18px}',
      '@media(max-width:640px){.phf-bar2r{margin-left:0;width:100%}.phf-bar2 .phf-pdf{flex:1;justify-content:center}}',
      '.phf-panel{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);overflow:hidden;min-width:0}',
      '.phf-phead{padding:18px 22px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}',
      '.phf-ptitle{font-size:18px;font-weight:800;letter-spacing:-.01em;display:flex;align-items:center;gap:10px}',
      '.phf-pdot{width:11px;height:11px;border-radius:50%;flex:none}',
      '.phf-prange{color:var(--muted);font-weight:600;font-size:14px}',
      '.phf-psub{font-size:12.5px;color:var(--muted);font-weight:500;margin-top:5px;max-width:560px;line-height:1.4}',
      '.phf-pright{display:flex;align-items:center;gap:12px}',
      '.phf-selcount{font-size:12px;font-weight:600;color:var(--muted);white-space:nowrap}',
      '.phf-selcount b{font-family:var(--mono);color:var(--ip-blue);font-weight:800}',
      '.phf-pdf{display:inline-flex;align-items:center;gap:8px;background:var(--ip-blue);color:#fff;border:0;border-radius:var(--r-btn);padding:11px 17px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:var(--sh-2);transition:background .15s,transform .1s}',
      '.phf-pdf:hover{background:var(--ip-blue-d)}',
      '.phf-pdf:active{transform:translateY(1px)}',
      '.phf-pdf-ghost{background:var(--card);color:var(--ip-blue);border:1px solid var(--line-strong);box-shadow:none}',
      '.phf-pdf-ghost:hover{background:var(--card-2);border-color:var(--ip-blue)}',
      '.phf-props{display:grid;gap:12px;margin-bottom:8px}',
      '.phf-prop{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--pc,var(--ip-blue));border-radius:var(--r-card);box-shadow:var(--sh-1);padding:16px 20px}',
      '.phf-prop-ic{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;background:var(--pc,var(--ip-blue));flex:none}',
      '.phf-prop-main{flex:1;min-width:160px}',
      '.phf-prop-t{font-size:16px;font-weight:800;letter-spacing:-.01em}',
      '.phf-prop-s{font-size:12.5px;color:var(--muted);font-weight:500;margin-top:2px}',
      '.phf-prop-n{font-size:22px;font-weight:800;color:var(--pc,var(--ip-blue));text-align:center;line-height:1}',
      '.phf-prop-n small{display:block;font-size:10px;font-weight:600;color:var(--muted);letter-spacing:.03em;margin-top:3px}',
      '.phf-prop-acts{display:flex;gap:8px;flex-wrap:wrap}',
      '.phf-rf-off{opacity:.45;cursor:default}',
      '@media(max-width:640px){.phf-prop{flex-direction:column;align-items:stretch}.phf-prop-acts{width:100%;gap:8px}.phf-prop-acts .phf-pdf{flex:1;justify-content:center}}',
      '.phf-mk{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;letter-spacing:.02em;padding:3px 9px;border-radius:var(--r-pill);white-space:nowrap}',
      '.phf-mk-own{color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 13%,transparent)}',
      '.phf-mk-gap{color:var(--c-amber);background:color-mix(in srgb,var(--c-amber) 15%,transparent)}',
      '.phf-r-gap td{background:color-mix(in srgb,var(--c-amber) 5%,transparent)}',
      '.phf-rotfilter{display:flex;gap:6px}',
      '.phf-rf{padding:7px 12px;border-radius:var(--r-pill);border:1px solid var(--line-strong);background:var(--card);font:inherit;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap}',
      '.phf-rf:hover{color:var(--ip-ink)}',
      '.phf-rf.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.phf-fambar{display:none}',
      '.phf-tablewrap{overflow-x:auto}',
      '.phf-tbl{width:100%;border-collapse:collapse;font-size:13px}',
      '.phf-tbl thead th{background:var(--card-2);font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);text-align:right;padding:11px 12px;border-bottom:1px solid var(--line-strong);white-space:nowrap}',
      '.phf-tbl thead th.phf-tl{text-align:left}',
      '.phf-tbl thead th.phf-tc{text-align:center}',
      '.phf-tbl tbody td{padding:12px;border-bottom:1px solid var(--line);text-align:right;vertical-align:middle}',
      '.phf-tbl tbody tr:last-child td{border-bottom:0}',
      '.phf-tbl tbody tr{transition:background .12s}',
      '.phf-tbl tbody tr:hover{background:var(--surf-sunken)}',
      '.phf-tbl tbody tr.phf-picked{background:rgba(30,158,106,.06)}',
      '.phf-td-l{text-align:left}',
      '.phf-desig{font-weight:700;line-height:1.25}',
      '.phf-cip{font-family:var(--mono);font-size:11px;color:var(--muted-2);font-weight:500;margin-top:2px}',
      '.phf-price{font-family:var(--mono);font-weight:700;font-size:13.5px}',
      '.phf-rem{font-family:var(--mono);font-weight:700;color:var(--c-opp)}',
      '.phf-rem.phf-none{color:var(--muted-2);font-weight:500}',
      '.phf-vol{font-family:var(--mono);color:var(--muted);font-weight:600}',
      '.phf-sortie{display:inline-flex;align-items:center;gap:8px;justify-content:flex-end}',
      '.phf-sortie-n{font-weight:700;font-size:12.5px;white-space:nowrap}',
      '.phf-bar{width:46px;height:6px;border-radius:var(--r-pill);background:var(--surf-sunken);overflow:hidden;flex:none}',
      '.phf-bar i{display:block;height:100%;border-radius:var(--r-pill);background:var(--ip-blue)}',
      '.phf-badges{display:inline-flex;gap:5px;justify-content:center;flex-wrap:wrap}',
      '.phf-bdg{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:var(--r-pill);white-space:nowrap}',
      '.phf-bdg-froid{background:rgba(0,181,216,.13);color:#0086a3}',
      '.phf-bdg-offre{background:rgba(30,158,106,.13);color:var(--c-opp)}',
      '.phf-bdg-empty{color:var(--muted-2)}',
      '.phf-check{width:26px;height:26px;border-radius:8px;border:1.5px solid var(--line-strong);background:var(--card);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:var(--muted-2);transition:all .14s;line-height:1}',
      '.phf-check:hover{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.phf-check.on{background:var(--c-opp);border-color:var(--c-opp);color:#fff}',
      '.phf-th-check,.phf-td-check{text-align:center;width:50px}',
      '.phf-foot{padding:13px 22px;background:var(--card-2);border-top:1px solid var(--line);font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:7px}',
      '.phf-empty{padding:48px 24px;text-align:center;color:var(--muted);font-size:14px}',
      '@media(max-width:900px){.phf-shell{grid-template-columns:1fr}.phf-rail{position:static}.phf-fam-title,.phf-famlist{display:none}' +
        '.phf-fambar{display:flex;gap:8px;overflow-x:auto;padding:12px 16px;border-bottom:1px solid var(--line);-webkit-overflow-scrolling:touch;position:sticky;top:0;background:var(--card);z-index:6}' +
        '.phf-fchip{flex:none;display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid var(--line-strong);border-radius:var(--r-pill);background:var(--card);font:inherit;font-size:13px;font-weight:600;color:var(--ip-ink);cursor:pointer;white-space:nowrap}' +
        '.phf-fchip.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}' +
        '.phf-fchip.on .phf-fam-ct{background:rgba(255,255,255,.22);color:#fff}}',
      '@media(max-width:640px){.phf-phead{flex-direction:column;align-items:stretch}.phf-pright{justify-content:space-between}.phf-pdf{flex:1;justify-content:center}}',
      '.ipv-rank{flex-shrink:0;width:44px;font-size:12px;font-weight:700;color:var(--ip-blue);font-variant-numeric:tabular-nums}',
      '.ipv-name{flex:1;min-width:0;font-size:13.5px;font-weight:500;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ipv-vol{flex-shrink:0;font-size:13px;font-weight:700;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.ipv-vol small{font-weight:500;color:var(--muted-2);font-size:11px}',
      // ── Badges OPSO (clientes / prospects) — uniquement en mode OPSO ──
      '.opso-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.01em;flex-shrink:0;vertical-align:middle}',
      '.opso-badge-cliente{color:#0d8530;background:color-mix(in srgb,#11a63c 13%,transparent);border:1px solid color-mix(in srgb,#11a63c 28%,transparent)}',
      '.opso-badge-prospect{color:var(--muted);background:var(--card-2);border:1px solid var(--line)}',
      // Ligne cliente légèrement mise en relief
      '.opso-row-cliente{background:color-mix(in srgb,#11a63c 4%,transparent)}',
      '.opso-row-cliente:hover{background:color-mix(in srgb,#11a63c 8%,transparent)}',
      // ── Compteur clientes / prospects (bandeau au-dessus des filtres) ──
      '.opso-counter{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:13px;font-weight:600;color:var(--muted)}',
      '.opso-counter-sep{color:var(--muted-2)}',
      '.opso-counter-cliente{color:#0d8530;font-weight:700}',
      '.opso-counter-prospect{color:var(--muted);font-weight:600}',
      // ── Barre RDV collante du pilier : empilée AU-DESSUS de la barre fiche globale (#v2-cartbar) ──
      // pharmaToggleSel alimente aussi V2.ficheCart → la barre globale est présente ;
      // on décale la nôtre vers le haut pour éviter le chevauchement, lumière du pilier sur le badge.
      '#ph-cartbar{bottom:calc(64px + env(safe-area-inset-bottom))}',
      '#ph-cartbar .v2-cartbar-badge{background:var(--accent,var(--ip-blue))}',
      '#ph-cartbar .v2-cartbar-go:active{transform:scale(.97)}',
      // ── Lumière du pilier Opportunités : liseré 3px contextuel (grammaire d\'appartenance) ──
      '.ph-detail .v2-card{position:relative}',
      // Hero = 1er .v2-card direct, qu\'il soit le 1er enfant (fiche pharma) ou précédé du bouton retour (fiche groupement).
      '.ph-detail>.v2-card:first-child::before,.ph-detail>.v2-back:first-child+.v2-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px;background:var(--accent,var(--ip-blue));opacity:.9}',
      // ── Rangée d\'actions natives (appeler / e-mail / itinéraire) ──
      '.ph-contact-row{display:flex;gap:var(--gap-tight);flex-wrap:wrap;padding:var(--sp-3) var(--sp-6)}',
      '.ph-act-link{flex:1;min-width:120px;min-height:var(--tap-min);justify-content:center;gap:8px;font-weight:700;text-decoration:none}',
      '.ph-act-link svg{flex-shrink:0}',
      '.ph-act-link:active{transform:scale(.97)}',
      '@media(max-width:560px){.ph-act-link{min-width:0;padding-left:10px;padding-right:10px}}',
      // ── Sections repliables (toggle) : étend le composant partagé .v2-section-head ──
      '.v2-section-head.ph-sh-toggle{cursor:pointer;user-select:none;align-items:center}',
      '.v2-section-head.ph-sh-toggle:hover .v2-sh-t{color:var(--accent,var(--ip-blue))}',
      '.v2-section-chev{display:inline-flex;color:var(--muted-2);flex-shrink:0;transition:transform .25s var(--ease)}',
      '.v2-section-chev.open{transform:rotate(90deg)}',
      // ── Étend la hit-area du bouton + à 44px sous 640px (glyphe inchangé) ──
      '.opp-add{position:relative}',
      '.opp-add:active{transform:scale(.97)}',
      '@media(max-width:640px){.opp-add::before{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:var(--tap-min);height:var(--tap-min)}}',
      // ── Table opportunités : sous mobile, replier OPS/CPR/HP, épingler produit + action ──
      // Ciblé .ph-opp-tbl uniquement (n\'affecte pas la table groupements à 7 colonnes data).
      '@media(max-width:640px){' +
        '.ph-opp-tbl .v2-table th:nth-child(6),.ph-opp-tbl .v2-table td:nth-child(6),' +
        '.ph-opp-tbl .v2-table th:nth-child(7),.ph-opp-tbl .v2-table td:nth-child(7),' +
        '.ph-opp-tbl .v2-table th:nth-child(8),.ph-opp-tbl .v2-table td:nth-child(8){display:none}' +
        '.ph-opp-tbl .v2-table th:nth-child(2),.ph-opp-tbl .v2-table td:nth-child(2){position:sticky;left:34px;z-index:1;background:var(--card)}' +
        '.ph-opp-tbl .v2-table thead th:nth-child(2){background:var(--card-2)}' +
        '.ph-opp-tbl .v2-table th:last-child,.ph-opp-tbl .v2-table td:last-child{position:sticky;right:0;z-index:1;background:var(--card);box-shadow:-6px 0 8px -6px rgba(16,19,28,.14)}' +
        '.ph-opp-tbl .v2-table thead th:last-child{background:var(--card-2)}' +
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }
})();
