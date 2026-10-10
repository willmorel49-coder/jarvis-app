/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Opportunités pharmacie" (pages.pharma)
   Vue A : liste des officines (CA du mois + marge nette générée)
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
  var _chartBind = null;   // bind du chart 13 mois (homogénéisé avec Pilotage), appelé après render
  // Sélection de produits cochés (bouton +) pour le PDF RDV — propre à une pharma
  var selCips = null;   // Set des CIP cochés
  var selPid = null;    // pharma à laquelle appartient la sélection courante
  // Filtre segment OPSO : 'all' | 'cliente' | 'prospect'
  var opsoFilter = 'all';
  var secteurTab = 'clients';   // JARVIS : bascule Clients / Prospects (par UGA) dans l'onglet Officines
  // Sous-onglet Opportunités : 'officines' | 'groupements' | 'listes'
  var pharmaView = 'officines';
  var selGroup = null;        // groupement ouvert
  var netScope = 'reseau';    // réf. de la reco fiche : 'reseau' (réseau IP) | 'groupement' (son groupement)
  var recoFam = null;         // famille active dans la fiche officine (master-détail)
  var recoInitKey = null;     // (pid|scope) déjà pré-sélectionné ? — tout coché par défaut
  var grpListFilter = 'all';  // listing best rotations groupement : 'all' | 'gap' (ce qu'elle ne commande pas)
  var grpRotExpanded = false; // demande Pauline G. (10/09/2026) : la fiche montre trop de lignes d'un coup — repliée par défaut, 15 lignes visibles, bouton « Voir tout »
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
  // 11/09/2026 — espace Escale Pharma (escale/v2) : même écran, libellés à son nom.
  function isEscale() { return !!(window.V2_BRAND && window.V2_BRAND.escale); }
  function reseauLbl(court) { return isEscale() ? (court ? 'Réseau Escale' : 'Réseau Escale Pharma') : (court ? 'Réseau Intégral' : 'Réseau Intégral Pharma'); }

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

  // Mounjaro et Wegovy : remboursés depuis le 15/06/2026, mais sans marché Ameli dans
  // le BENCHMARK (has_ameli=false) → ils tombaient en « Non remboursés » à 15 %.
  // Décision Will 14/09/2026 : barème des remboursés. Tous dosages, par désignation.
  function rembourseForce(b) {
    return !!(b && /^(MOUNJARO|WEGOVY)\b/i.test(String(b.designation || '')));
  }

  // Remboursable = présent en BENCHMARK avec has_ameli ET pas NR Sagitta
  function isRemboursable(cip) {
    var c = String(cip || '');
    if (!c) return false;
    var b = benchIndex().get(c);
    if (rembourseForce(b)) return true;
    if (nrIndex().has(c)) return false;
    return !!(b && b.has_ameli === true);
  }

  // ── Marge nette officine — ce que la pharmacie gagne grâce à Intégral ──
  // Barème V2.margeNetteBoite (v2-boot.js). 25/09/2026 — Will : calculable sur le PRINCEPS
  // remboursé seulement (tranches pp/mi/ch + froid). Génériques, biosimilaires et NR
  // (marge libre, incalculable) → hors calcul, jamais 0 € déguisé en marge.
  // Produit inconnu du BENCHMARK : on ne compte rien (jamais de fausse marge).
  function margeNettePrinceps(cat) { return cat === 'pp' || cat === 'mi' || cat === 'ch' || cat === 'froid'; }
  function margeNetteCat(cip) {
    var b = cip ? benchIndex().get(cip) : null;
    return b ? classify(b, cip) : null;
  }
  function margeNetteLigne(s) {
    var cip = String(s.artCode || '');
    var cat = margeNetteCat(cip);
    if (!margeNettePrinceps(cat) || !isRemboursable(cip)) return 0;
    return V2.margeNetteBoite(s.puNet || 0, true) * (s.qte || 0);
  }
  function margeNettePharma(sales) {
    var total = 0;
    for (var i = 0; i < sales.length; i++) total += margeNetteLigne(sales[i]);
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
  // 24/09/2026 — confidentialité : rien pour l'officine d'un collègue (V2.voitVentesDe, v2-boot.js)
  function pharmaSalesAll(pid) { if (V2.voitVentesDe && !V2.voitVentesDe(pid)) return []; return salesIndex()[String(pid)] || []; }
  // cliente ou non — pas un chiffre de vente : reste vrai pour l'officine d'un collègue
  function aDesVentes(pid) { return (salesIndex()[String(pid)] || []).length > 0; }
  function pharmaSales(pid) {
    var base = pharmaSalesAll(pid);
    return V2.commFilter ? base.filter(function (s) { return s.commercial === V2.commFilter; }) : base;
  }
  // libellé période couverte par les données (ex. "cumul 5 mois · janv.–mai 2026")
  function periodLabel() {
    var MN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    var ms = {}, yr = null, parCom = {};
    // 11/09/2026 — perf : mémorisé sur la référence de V2.sales (passe complète sinon)
    if (periodLabel._ref === V2.sales && periodLabel._val != null) return periodLabel._val;
    (V2.sales || []).forEach(function (s) {
      if (!s.month) return;
      ms[s.month] = 1; if (s.year) yr = s.year;
      if (s.commercial) (parCom[s.commercial] || (parCom[s.commercial] = {}))[s.month] = 1;
    });
    var ks = Object.keys(ms).map(Number).sort(function (a, b) { return a - b; });
    periodLabel._ref = V2.sales;
    if (!ks.length) return (periodLabel._val = '');
    var der = ks[ks.length - 1];
    var span = MN[ks[0] - 1] + '–' + MN[der - 1] + (yr ? ' ' + yr : '');
    // 25/09/2026 — garde « mois incomplet » (reference_dernier_mois_incomplet) : chaque secteur
    // a son fichier, qui ne s'arrête pas forcément au même mois. Les listes sont des cumuls
    // (rien n'est écarté ni comparé), mais l'étiquette le DIT quand le dernier mois manque à un
    // secteur actif dans les 3 mois d'avant (un secteur parti plus tôt ne compte pas).
    var actifs = 0, courts = 0;
    Object.keys(parCom).forEach(function (c) {
      var m = parCom[c]; if (!(m[der - 1] || m[der - 2] || m[der - 3] || m[der])) return;
      actifs++; if (!m[der]) courts++;
    });
    var note = courts ? ' (' + MN[der - 1] + ' incomplet : ' + courts + ' secteur' + (courts > 1 ? 's' : '') + ' sur ' + actifs + ' s\'arrête' + (courts > 1 ? 'nt' : '') + ' avant)' : '';
    return (periodLabel._val = 'cumul ' + ks.length + ' mois · ' + span + note);
  }

  // ── Classement d'un produit benchmark dans une des 8 catégories ──
  // Priorité : NR (sauf froid) > biosim > gen.part > gen > froid > princeps(pp/mi/ch)
  // 25/09/2026 — le BENCHMARK du 07/05 ne marque que 54 produits froids : Eylea, les vaccins,
  // Mounjaro… (491 CIP) sortaient hors « Froid » ici alors que Pilotage les y range. Même source
  // que Pilotage : FROID_CIPS (froid-data.js, sous-famille Froid du grossiste, corrigée le 19/09).
  var _froidSrc = null, _froidSet = {};
  function estFroid(b, cip) {
    if (b && b.is_froid === true) return true;
    var F = window.FROID_CIPS; if (!F) return false;
    if (_froidSrc !== F) { _froidSrc = F; _froidSet = {}; F.forEach(function (c) { _froidSet[String(c).replace(/\D/g, '')] = 1; }); }
    return !!_froidSet[String(cip || (b && b.cip13) || '')];
  }
  function classify(b, cip) {
    if (!b) return null;
    var nat = String(b.artnature || '').toLowerCase();
    // 8. Non remboursés : dans Sagitta OU has_ameli=false
    // 25/09/2026 — un NR de la chaîne du froid (vaccins TICOVAC, RABIPUR…) va en « Froid »,
    // comme dans Pilotage (familyOf : froid avant NR). Sa marge reste hors calcul (isRemboursable).
    if (!rembourseForce(b) && (nrIndex().has(cip) || b.has_ameli === false)) return estFroid(b, cip) ? 'froid' : 'nr';
    // 7. Biosimilaires
    if (nat === 'biosimilaire') return 'biosim';
    // 6. Génériques partenaires — 25/09/2026, décision de Will : seuls EG · Zentiva · Zydus · Teva
    // (liste du 04/08). Le BENCHMARK du 07/05 y rangeait aussi Accord, KRKA, Viatris GE, Cooper (210) :
    // labo lu dans le catalogue complet ; labo inconnu (catalogue pas encore arrivé) → on garde le BENCHMARK.
    if (nat === 'generique_partenaire') {
      var ci = V2.produits && V2.produits.catalogueIndex ? V2.produits.catalogueIndex() : null, cr = ci && ci[cip];
      return (cr && cr.labo && !/^(EG|ZENTIVA|ZYDUS|TEVA)\b/i.test(cr.labo)) ? 'gen' : 'genp';
    }
    // 5. Génériques
    if (nat === 'generique') return 'gen';
    // 4. Froid
    if (estFroid(b, cip)) return 'froid';
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

  // 11/09/2026 — perf : compteur d'opportunités SANS reconstruire les 8 seaux
  // pour chacune des 690 officines. Même définition que buildOpportunities :
  // CIP du marché présents au catalogue IP et classés, que l'officine ne
  // commande pas. La part indépendante de l'officine est calculée une fois.
  var _mkClassified = null;
  function marketClassified() {
    if (_mkClassified) return _mkClassified;
    var bIdx = benchIndex(), out = new Set();
    mergeMarket().forEach(function (m, cip) {
      var b = bIdx.get(cip); if (!b) return;
      var cat = classify(b, cip);
      if (cat && cat !== 'gen' && CATS.some(function (c) { return c.key === cat; })) out.add(cip);
    });
    return (_mkClassified = out);
  }
  // 05/10/2026 — le compteur portait sur tout le marché classé : 5 320 à 6 001 sur chaque ligne, donc
  // aucun repère entre deux officines. Il porte sur les OPP_TOP meilleures ventes du secteur (en unités).
  var OPP_TOP = 100, _mkTop = null;
  function marketTop() {
    if (_mkTop) return _mkTop;
    var market = mergeMarket(), arr = Array.from(marketClassified());
    arr.sort(function (a, b) { return market.get(b).qte - market.get(a).qte; });
    return (_mkTop = new Set(arr.slice(0, OPP_TOP)));
  }
  function oppCount(pid) {
    var mk = marketTop(), sales = pharmaSales(pid), seen = new Set(), n = mk.size;
    for (var i = 0; i < sales.length; i++) {
      var c = String(sales[i].artCode || '');
      if (c.length >= 7 && mk.has(c) && !seen.has(c)) { seen.add(c); n--; }
    }
    return n;
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
      if (!cat || !buckets[cat] || cat === 'gen') return;   // génériques non partenaires : jamais une opportunité
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
    // 23/09/2026 — remontée de Pauline S. : « tu marques le générique de Spasfon Lyoc
    // mais en général cela nous échappe quand ça passe générique (Viatris, Biogaran) ».
    // Les génériques NON partenaires ne sont plus des opportunités ; les génériques
    // partenaires (EG · Zentiva · Zydus · Teva) le restent (seau 'genp').
    return CATS.filter(function (c) { return c.key !== 'gen'; }).map(function (c) {
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
  // 05/10/2026 — Will, depuis la fiche d'une officine : « il y a que 4 pharmacies de
  // référence alors qu'on en a bcp plus » dans son groupement. Le jeu d'un commercial restreint ne détaille que SES
  // officines : « son groupement » se comptait donc sur les siennes seules. Les totaux par
  // groupement d'au moins 5 officines (officines actives, nombre d'officines par produit —
  // aucun montant) arrivent tout faits dans son jeu (decouper_par_commercial.py, grp-agregats.js).
  // Rend { panel, nb:{cip:n} } ; null = accès total, groupement trop petit, ou fichier pas encore là.
  var _grpAgDemande = false, _grpAgMemo = {};
  function agregatGroupement(nom) {
    if (!V2._dossierVentes || !V2.loadFiles) return null;
    var A = window.GRP_AGREGATS;
    if (!A) {
      if (!_grpAgDemande) {
        _grpAgDemande = true;
        V2.loadFiles(['grpagregats']).then(function () {
          if (!window.GRP_AGREGATS) return;
          Object.keys(_statsCache).forEach(function (k) { if (k.indexOf('grp:') === 0) delete _statsCache[k]; });
          if (V2.route && V2.route.name === 'pharma') V2.render();
        });
      }
      return null;
    }
    var cle = (isEscale() ? 'E:' : 'T:') + nom;
    if (_grpAgMemo[cle] !== undefined) return _grpAgMemo[cle];
    var a = (isEscale() ? A.E : A.T) || {}, g = a[nom], out = null;
    if (g) {
      out = { panel: g[0], nb: {} };
      for (var i = 0; i < g[1].length; i += 2) out.nb[A.P[g[1][i]]] = g[1][i + 1];
    }
    return (_grpAgMemo[cle] = out);
  }
  function computeStats(key, pidSet) {
    if (_statsCache[key]) return _statsCache[key];
    var ag = key.indexOf('grp:') === 0 ? agregatGroupement(key.slice(4)) : null;
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
    var st = { map: m, total: Object.keys(phies).length, months: Object.keys(months).length || 5 };
    if (ag) {
      // tout le groupement : le nombre d'officines vient du total, pas de ses seules officines
      Object.keys(ag.nb).forEach(function (c) {
        var e = m.get(c); if (!e) { e = { ph: null, qte: 0 }; m.set(c, e); }
        e.ph = { size: ag.nb[c] };
      });
      st.total = ag.panel;
    }
    // total pas encore arrivé (commercial restreint) : on ne fige pas le compte partiel
    if (ag || key.indexOf('grp:') !== 0 || !V2._dossierVentes || window.GRP_AGREGATS) _statsCache[key] = st;
    return st;
  }
  var _netTotal = 0, _statsMonths = 5;
  function cipStats() {
    var st = computeStats('__net__', null);
    _netTotal = st.total; _statsMonths = st.months;
    return st.map;
  }
  // Nom de groupement CANONIQUE (table GRP_ALIAS via V2.canonGrp) : sans elle,
  // « UPP » / « Pharm-UPP » ou « SRA via IP » / « SRA via SRA » comptent comme
  // des groupements différents — la carte fusionne, le listing doit fusionner pareil.
  function canonG(g) { return (V2.canonGrp ? V2.canonGrp(g) : g) || g; }
  // Pharmacies du même groupement que `pid` (selon pharma.groupement, canonisé).
  function groupementPids(pid) {
    var p = (V2.pharmacies || []).filter(function (x) { return String(x.id) === String(pid); })[0];
    var g = p && p.groupement ? String(p.groupement).trim() : '';
    if (!g) return { name: '', set: null };
    var cg = canonG(g);
    var set = new Set();
    (V2.pharmacies || []).forEach(function (x) {
      var xg = String(x.groupement || '').trim();
      if (xg && canonG(xg) === cg) set.add(String(x.id));
    });
    return { name: cg, set: set };
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
      '<button type="button" class="net-scope-b' + (scope === 'reseau' ? ' on' : '') + '" onclick="V2.setNetScope(\'reseau\')">' + reseauLbl() + '</button>' +
      (g.name
        ? '<button type="button" class="net-scope-b' + (scope === 'groupement' ? ' on' : '') + '" onclick="V2.setNetScope(\'groupement\')">Son groupement · ' + esc(g.name) + '</button>'
        : '') +
      '</div>';
    var titre = scope === 'groupement'
      ? 'À pousser : son groupement le prend, pas elle'
      : 'À pousser : tout le réseau le prend, pas elle';
    var soustitre = scope === 'groupement'
      ? 'produits que le plus de pharmacies de ' + esc(g.name) + ' commandent et que cette officine n\'a pas — gain estimé = rotation moyenne × votre abandon de marge'
      : 'produits que le plus de pharmacies du réseau commandent et que cette officine n\'a pas — gain estimé = rotation moyenne × votre abandon de marge';
    var open = sectionOpen('netreco');
    if (!reco.length) {
      // groupement sélectionné mais trop peu de pharmacies / aucune reco → on garde le sélecteur
      if (scope === 'reseau') return '';
      return '<div class="ph-section">' +
        sectionHead(titre, soustitre, 'netreco', open) +
        (open ? '<div class="v2-card" style="padding:14px">' + toggle +
          '<div style="color:var(--muted);font-size:13px;padding:8px 4px">Pas assez de pharmacies de ce groupement dans vos données pour comparer. Basculez sur « ' + reseauLbl() + ' ».</div></div>' : '') +
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
        '<span class="ipv-vol" style="color:var(--c-opp);font-weight:800" title="rotation moyenne × abandon de marge PPHT→net">' + (r.gain > 0 ? '+' + V2.fmtEur(r.gain) + '<small>/an</small>' : '—') + '</span>' +
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
    // GROUPEMENT : ce que le groupement commande et qu'elle n'a pas, commandé par au moins
    // 10 % de ses pharmacies (Will, 24/09/2026 : 38 pages et 1 à 2 min de PDF sans seuil).
    var PEN_GRP = 0.10;
    var PEN = { pp: 0.20, mi: 0.08, gen: 0.08, genp: 0.08, nr: 0.08, ch: 0.04, froid: 0.04, biosim: 0.02 };
    var penFor = function (k) { return PEN[k] != null ? PEN[k] : 0.08; };
    var CAP = grpScope ? 200 : 40;   // plafond par famille
    var buckets = {}; CATS.forEach(function (c) { buckets[c.key] = []; });
    stats.forEach(function (e, cip) {
      if (owned.has(cip)) return;
      var b = bIdx.get(cip); if (!b) return;
      var cat = classify(b, cip); if (!cat || !buckets[cat]) return;
      if (!grpScope && total >= 2 && e.ph.size < Math.max(2, Math.ceil(total * penFor(cat)))) return;  // réseau : seuil
      if (grpScope && e.ph.size < Math.max(2, Math.ceil(total * PEN_GRP))) return;  // groupement : seuil 10 %
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
  V2.pharmaRotExpand = function () { grpRotExpanded = true; V2.render(); };

  // Sélecteur de référence réutilisé (réseau IP / son groupement)
  function recoScopeToggle(pid) {
    var g = groupementPids(pid);
    var scope = (netScope === 'groupement' && g.set && g.set.size >= 2) ? 'groupement' : 'reseau';
    var html = '<div class="net-scope">' +
      '<button type="button" class="net-scope-b' + (scope === 'reseau' ? ' on' : '') + '" onclick="V2.setNetScope(\'reseau\')">' + reseauLbl() + '</button>' +
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
          '<small style="display:block;white-space:normal;color:var(--muted);font-family:var(--mono)">rotation ~' + V2.fmtNum(r.rota) + '/an · ' + r.n + ' phies · votre abandon de marge ' + V2.fmtEur(r.remise) + '/an</small></span>' +
        '<span class="ipv-vol" style="color:var(--c-opp);font-weight:800" title="marge nette gagnée par l\'officine / an">' + V2.fmtEur(r.marge) + '<small>/an</small></span>' +
        '</div>';
    }).join('');
    var open = sectionOpen('molsum');
    return '<div class="ph-section">' +
      sectionHead('Ce qu\'un produit rapporte (réseau)',
        'rotation moyenne par pharmacie & marge nette de l\'officine —l\'argument chiffré à montrer au comptoir',
        'molsum', open) +
      (open ? '<div class="v2-card" style="padding:6px 0">' + rows +
        '<div style="text-align:right;padding:8px 14px"><a class="v2-cat-link" style="cursor:pointer" onclick="V2.go(\'molecules\')">Tous les produits →</a></div></div>' : '') +
      '</div>';
  }

  // VUE A — Liste des officines
  // ─────────────────────────────────────────────────────────────
  // 05/10/2026 — demande de Will : le code postal s'affiche après le nom et se cherche.
  // Un code saisi sans son zéro de tête (« 1000 » pour 01000) est remis sur 5 chiffres.
  function cpDe(p) { var c = String(p.cp == null ? '' : p.cp).trim(); return /^\d{4}$/.test(c) ? '0' + c : c; }
  // Recherche de la liste : le nom, ou le DÉBUT du code postal quand on ne tape que des chiffres
  // (« 14 » = tout le Calvados, « 14000 » = Caen), ou la ville — sans tenir compte des accents ni
  // des traits d'union (« saint lo » trouve Saint-Lô).
  function villeCle(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function correspond(p, q) {
    if ((p.name || '').toLowerCase().indexOf(q) >= 0) return true;
    var n = q.replace(/\s/g, '');
    if (/^\d+$/.test(n)) return cpDe(p).indexOf(n) === 0;
    var v = villeCle(q);
    if (!v) return false;
    if (villeCle(p.ville).indexOf(v) >= 0) return true;
    // 05/10/2026 — remontée de Karine (« ma phie Blin à Issé ») : l'équipe cherche aussi une officine
    // par le nom de son titulaire (base clients, colonne contact).
    var e = ((window.CLIENTS_ACTIFS || {}).d || {})[String(p.id)];
    return !!(e && e[3] && villeCle(e[3]).indexOf(v) >= 0);
  }
  function listRowHtml(x) {
    var color = x.p.color || 'var(--ip-blue)';
    var oppPill = (x.opp == null)
      ? '<span class="v2-row-opp v2-row-opp-pending mono">…</span>'
      // 05/10/2026 — officine d'un collègue : ses ventes ne sont pas lues, le compteur affichait
      // tout le catalogue sur chaque ligne. « — », comme la marge et le CA à côté.
      : !V2.voitVentesDe(x.p.id)
        ? '<span class="v2-row-opp mono" title="Compteur réservé à son commercial">—</span>'
        : '<span class="v2-row-opp mono" title="' + x.opp + ' des ' + marketTop().size + ' meilleures ventes du secteur ne sont pas commandées par cette officine">' + x.opp + ' / ' + marketTop().size + ' opp</span>';
    var badge = opsoBadge(x.p);
    return '<a class="v2-row' + (isOpso() && x.p.inDb ? ' opso-row-cliente' : '') + '" onclick="V2.go(\'pharma\',\'' + V2.esc(String(x.p.id)) + '\')">' +
      '<span class="v2-row-dot" style="background:' + V2.esc(color) + '"></span>' +
      '<span class="v2-row-name">' + V2.esc(x.p.name) + (cpDe(x.p) ? ' <span style="color:var(--muted);font-weight:500">· ' + V2.esc(cpDe(x.p)) + '</span>' : '') + '</span>' +
      badge + (x.p._cree ? '<span class="v2-row-meta">' + (x.p._archive ? 'archivée' : 'créé à la main') + '</span>' : '') +
      (x.p._sansVente ? '<span class="v2-row-meta">aucune vente sur la période</span>' : '') +
      oppPill +
      '<span class="v2-row-meta">marge nette</span>' +
      // 24/09/2026 — officine d'un collègue : « — » plutôt qu'un faux « 0 € »
      '<span class="v2-row-val mono" style="color:var(--c-opp)">' + (V2.voitVentesDe(x.p.id) ? V2.fmtEur(x.marge) : '—') + '</span>' +
      '<span class="v2-row-val mono" style="min-width:84px;text-align:right">' + (V2.voitVentesDe(x.p.id) ? V2.fmtEur(x.ca) : '—') + '</span>' +
      '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
  }

  // ── Secteur : UGA -> commerciaux (25/09/2026, choix de Will) ──
  // Une UGA appartient à TOUS les commerciaux qui y ont au moins un client (tous les noms
  // de `comms`, pas seulement le premier) : avant, le seul « plus de clients » laissait
  // Guillaume ou Pauline A. sans aucun prospect. Ordre = plus de clients d'abord.
  var _ugaComm = null;
  function ugaCommMap() {
    if (_ugaComm) return _ugaComm;
    var D = window.PHARMA_FR; if (!D || !D.p) return {};   // pas de cache tant que PHARMA_FR absent
    var idComm = {};
    (V2.pharmacies || []).forEach(function (p) {
      var k = String(p.id).replace(/[^0-9]/g, '');
      if (k && p.comms && p.comms.length) idComm[k] = p.comms;
    });
    var count = {};
    D.p.forEach(function (p) {
      var cs = idComm[String(p[13] || '').replace(/[^0-9]/g, '')]; if (!cs) return;
      var uga = p[2]; if (uga == null) return;
      var m = count[uga] || (count[uga] = {});
      cs.forEach(function (c) { if (c) m[c] = (m[c] || 0) + 1; });
    });
    var map = {};
    Object.keys(count).forEach(function (uga) {
      map[uga] = Object.keys(count[uga]).sort(function (a, b) { return count[uga][b] - count[uga][a] || (a < b ? -1 : 1); });
    });
    if (Object.keys(map).length) _ugaComm = map;   // ne pas cacher une map vide (clients pas encore chargés)
    return map;
  }
  // pseudo-ligne de liste pour un point PHARMA_FR (prospect ou promu) — réutilise listRowHtml
  function prospectPseudoX(p) {
    return { p: { id: p[13], name: nameOf(p[13], p[6] || p[10] || 'Pharmacie'), color: '#9AA1B2', inDb: false, comms: [], _prospect: true, cp: p[8], ville: p[7] }, ca: 0, marge: 0, opp: 0 };
  }
  // Fiches prospect créées à la main (ids « px_… », table `profils`) : elles n'existaient que dans
  // la recherche générale. 05/10/2026 — elles entrent dans l'onglet Prospects. Rien n'est jamais
  // supprimé : une fiche marquée `archive` est seulement masquée.
  // 05/10/2026 — `voirArchives` : la liste des fiches archivées, seul chemin pour en rétablir une sans son lien.
  var _crees = [], _creesAt = 0, voirArchives = false;
  function chargerCrees() {
    if (!V2.profil || !V2.profil.loadCrees || Date.now() - _creesAt < 3000) return;
    _creesAt = Date.now();
    V2.profil.loadCrees().then(function (l) {
      var avant = JSON.stringify(_crees); _crees = l || [];
      if (JSON.stringify(_crees) !== avant && secteurTab === 'prospects' && V2.route && V2.route.name === 'pharma' && !V2.route.param) V2.render();
    }).catch(function () {});
  }
  function creesRows(q, arch) {
    return _crees.filter(function (o) { return o.data && o.data.nom && !o.data.archive === !arch; }).map(function (o) {
      return { p: { id: o.sid, name: o.data.nom, cp: o.data.cp, ville: o.data.ville, color: '#9AA1B2', inDb: false, comms: [], _prospect: true, _cree: true, _archive: !!arch }, ca: 0, marge: 0, opp: 0 };
    }).filter(function (x) { return !q || correspond(x.p, q); });
  }
  function isClientSeg(p) { var s = window.PHARMA_FR && window.PHARMA_FR.seg[p[4]]; return s && s.indexOf('Client') === 0; }
  // Prospects (non-clients) des UGA d'un ou plusieurs commerciaux. Plafonné à `cap`.
  // `q` : la recherche se fait AVANT le plafond, sinon un code postal hors des 300 premiers reste introuvable.
  function commercialProspects(comm, cap, q) {
    var D = window.PHARMA_FR, cms = [].concat(comm || []); if (!D || !D.p || !cms.length) return { rows: [], total: 0 };
    var uc = ugaCommMap(), out = [];
    for (var i = 0; i < D.p.length; i++) {
      var p = D.p[i];
      if (!(uc[p[2]] || []).some(function (c) { return cms.indexOf(c) >= 0; }) || isClientSeg(p) || (V2.promoted && V2.promoted[String(p[13])])) continue;
      out.push(p);
    }
    if (q) { out = out.map(prospectPseudoX).filter(function (x) { return correspond(x.p, q); }); return { rows: out.slice(0, cap || 200), total: out.length }; }
    var total = out.length;
    return { rows: out.slice(0, cap || 200).map(prospectPseudoX), total: total };
  }
  // Prospects explicitement passés en client (V2.promoted) -> pseudo-clients pour la liste.
  function promotedRows() {
    var D = window.PHARMA_FR, prom = V2.promoted || {}, out = [];
    if (!D || !D.p) return out;
    var byId = {}; D.p.forEach(function (p) { byId[String(p[13])] = p; });
    Object.keys(prom).forEach(function (pid) {
      if (!prom[pid]) return;
      if ((V2.pharmacies || []).some(function (c) { return String(c.id) === String(pid); })) return; // déjà client réel
      var p = byId[String(pid)]; if (p) { var x = prospectPseudoX(p); x.p._promu = true; out.push(x); }
    });
    return out;
  }

  // 05/10/2026 — remontée de Karine (« je ne trouve pas ma phie Blin à Issé ») : la liste ne portait
  // que les officines ayant une vente sur la période. Un client de la base clients sans vente
  // (361 sur 2 341 ce jour-là) n'était ni dans Clients ni dans Prospects : introuvable.
  // Il entre dans Clients, marqué « aucune vente sur la période ». Même règle de portefeuille que
  // l'export « Mes clients » : la colonne commercial de la base (en code : KV, ALH…) fait foi, et le
  // code d'un prénom est celui qu'il porte le plus souvent. Sans commercial choisi (direction) : tous.
  // `deja` = lignes déjà dans la liste (ventes + promus), pour ne doubler personne.
  function sansVenteRows(deja) {
    var CA = (window.CLIENTS_ACTIFS || {}).d, D = window.PHARMA_FR; if (!CA || !D || !D.p) return [];
    var noms = V2.commFilter ? [V2.commFilter] : (V2.ventesRestreintes && V2.ventesRestreintes() ? V2.mesComms() : []);
    var vu = {}, compte = {}, codes = {}, out = [];
    deja.forEach(function (x) { vu[String(x.p.id)] = 1; });
    (V2.pharmacies || []).forEach(function (p) {
      var cd = (CA[String(p.id)] || [])[7]; if (!cd) return;
      (p.comms || []).forEach(function (n) { var m = compte[n] || (compte[n] = {}); m[cd] = (m[cd] || 0) + 1; });
    });
    noms.forEach(function (n) { var m = compte[n] || {}, best = ''; Object.keys(m).forEach(function (k) { if (!best || m[k] > m[best]) best = k; }); if (best) codes[best] = 1; });
    D.p.forEach(function (p) {
      var id = String(p[13] || ''), e = CA[id];
      if (!e || vu[id] || (noms.length && !codes[e[7]])) return;
      vu[id] = 1;
      var x = prospectPseudoX(p); x.p._prospect = false; x.p._sansVente = true; out.push(x);
    });
    return out;
  }

  function renderList(root) {
    var marketReady = !!window.OPS_AGGREGATE;
    var phs = (V2.pharmacies || []).map(function (p) {
      var sales = pharmaSales(p.id);
      var x = { p: p, ca: V2.sumCA(sales), marge: margeNettePharma(sales), opp: null };
      if (marketReady) x.opp = oppCount(p.id);
      return x;
    });

    // JARVIS : PHARMA_FR sert aux promus (dans Clients) et aux prospects par UGA. Charge puis rafraîchit.
    if (!isOpso() && !window.PHARMA_FR && V2.ensurePharmaFr) {
      V2.ensurePharmaFr(function () { _ugaComm = null; if (V2.route && V2.route.name === 'pharma' && !V2.route.param) V2.render(); });
    }
    if (!isOpso() && window.PHARMA_FR) { try { phs = phs.concat(promotedRows()); } catch (e) {} }
    if (!isOpso() && window.PHARMA_FR) { try { phs = phs.concat(sansVenteRows(phs)); } catch (e) {} }
    if (!isOpso()) chargerCrees();

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
        _marketCache = null; _mkClassified = null; _mkTop = null;
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
        if (V2.commFilter && !x.p._promu && !x.p._sansVente && (x.p.comms || []).indexOf(V2.commFilter) < 0) return false;
        if (q && !correspond(x.p, q)) return false;
        if (isOpso() && opsoFilter === 'cliente' && !x.p.inDb) return false;
        if (isOpso() && opsoFilter === 'prospect' && x.p.inDb) return false;
        return true;
      });
    }

    var commBar = commSelect();
    var nAff = '';   // « 128 officines » : le compte de ce qui est affiché, écrit par listBody()
    var pl = function (n, mot) { return V2.fmtNum(n) + ' ' + mot + (n > 1 ? 's' : ''); };

    function cardHtml(filtered) {
      nAff = pl(filtered.length, 'officine');
      return filtered.length
        ? filtered.map(listRowHtml).join('')
        : '<div class="v2-empty"><div class="v2-empty-t">Aucune officine</div><div class="v2-empty-d">' +
          (searchQuery ? 'Aucun résultat pour « ' + V2.esc(searchQuery) + ' ».' : 'Aucune pharmacie chargée.') +
          '</div></div>';
    }

    // ── Barre de filtres OPSO (segment clientes / prospects) ──
    var opsoFilterBar = '', counterHtml = '';
    if (isOpso()) {
      function segBtn(val, label, count) {
        var on = (opsoFilter === val) ? ' on' : '';
        var sc = val === 'cliente' ? 'var(--ip-blue)' : (val === 'prospect' ? 'var(--muted)' : 'var(--ip-blue)');
        return '<button type="button" class="v2-seg' + on + '" aria-pressed="' + (opsoFilter === val) + '" style="--sc:' + sc + '" ' +
          'onclick="V2.pharmaOpsoFilter(\'' + val + '\')">' +
          label + '<span class="cnt">' + count + '</span></button>';
      }
      opsoFilterBar =
        '<div class="v2-segs">' +
          segBtn('all',      'Toutes',    phs.length) +
          segBtn('cliente',  'Clientes',  nbClientes) +
          segBtn('prospect', 'Prospects', nbProspects) +
        '</div>';

      counterHtml =
        '<div class="opso-counter">' +
          '<span class="opso-counter-item opso-counter-cliente">' + nbClientes + ' cliente' + (nbClientes > 1 ? 's' : '') + '</span>' +
          '<span class="opso-counter-sep">·</span>' +
          '<span class="opso-counter-item opso-counter-prospect">' + nbProspects + ' prospect' + (nbProspects > 1 ? 's' : '') + '</span>' +
        '</div>';
    }

    // ── Bascule Clients / Prospects (JARVIS uniquement) ──
    var secteurBar = '';
    if (!isOpso()) {
      var sTab = function (val, label) {
        return '<button type="button" class="v2-seg' + (secteurTab === val ? ' on' : '') + '" aria-pressed="' + (secteurTab === val) + '" style="--sc:var(--ip-blue)" onclick="V2.pharmaSecteurTab(\'' + val + '\')">' + label + '</button>';
      };
      secteurBar = '<div class="v2-segs">' + sTab('clients', 'Clients') + sTab('prospects', 'Prospects de mon secteur') + '</div>';
    }

    // Contenu de la liste selon la bascule (Clients par défaut, sinon Prospects par UGA du commercial).
    function listBody() {
      try {
        if (!isOpso() && secteurTab === 'prospects') {
          nAff = '';
          var q = searchQuery.trim().toLowerCase();
          var lienArch = function (txt, on) { return '<a class="v2-row" id="of-archives" style="justify-content:center;color:var(--muted);cursor:pointer" onclick="V2.pharmaVoirArchives(' + on + ')">' + txt + '</a>'; };
          var archs = creesRows(voirArchives ? q : '', true);
          if (voirArchives) {
            nAff = pl(archs.length, 'fiche') + ' archivée' + (archs.length > 1 ? 's' : '');
            return (archs.length ? archs.map(listRowHtml).join('')
              : '<div class="v2-empty"><div class="v2-empty-t">Aucune fiche archivée</div><div class="v2-empty-d">' + (q ? 'Aucun résultat.' : 'Les fiches archivées apparaissent ici ; ouvrez-en une pour la rétablir.') + '</div></div>') +
              lienArch('Revenir aux prospects', 'false');
          }
          var archLien = archs.length ? lienArch('Voir ' + (archs.length > 1 ? 'les ' + V2.fmtNum(archs.length) + ' fiches archivées' : 'la fiche archivée'), 'true') : '';
          var crees = creesRows(q), creesHtml = crees.map(listRowHtml).join('');
          if (crees.length) nAff = pl(crees.length, 'prospect');
          // 25/09/2026 — un commercial n'a pas de barre de choix (un seul nom dans ses ventes) : ses UGA d'office.
          var qui = V2.commFilter || (V2.mesComms ? V2.mesComms() : []);
          if (!qui.length) return creesHtml + '<div class="v2-empty"><div class="v2-empty-t">Choisissez un commercial</div><div class="v2-empty-d">Sélectionnez un commercial dans le menu au-dessus pour voir les prospects de son secteur (UGA).</div></div>' + archLien;
          if (!window.PHARMA_FR) return creesHtml + '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement des prospects…</div></div>' + archLien;
          var pr = commercialProspects(qui, 300, q);
          var rows = crees.concat(pr.rows);
          nAff = pr.total > pr.rows.length ? pl(rows.length, 'prospect') + ' affichés sur ' + V2.fmtNum(pr.total + crees.length) : pl(rows.length, 'prospect');
          if (!rows.length) return '<div class="v2-empty"><div class="v2-empty-t">Aucun prospect</div><div class="v2-empty-d">' + (q ? 'Aucun résultat.' : 'Aucun prospect dans les UGA de ce commercial.') + '</div></div>' + archLien;
          var more = (pr.total > pr.rows.length) ? '<a class="v2-row" style="justify-content:center;color:var(--muted);cursor:pointer" onclick="V2.go(\'pharma\',\'carte\')">+ ' + (pr.total - pr.rows.length) + ' autres prospects · voir sur la carte</a>' : '';
          return rows.map(listRowHtml).join('') + more + archLien;
        }
      } catch (e) { return '<div class="v2-empty"><div class="v2-empty-t">Prospects indisponibles</div><div class="v2-empty-d">Réessayez plus tard.</div></div>'; }
      return cardHtml(applyFilters(phs));
    }

    var corps = listBody();
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap v2-u">' +
        teteOfficines('Les officines de votre secteur et leurs opportunités.',
          isOpso() ? '' : '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            (secteurTab === 'clients' ? '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.pharmaClientsXlsx()">' + ICO('download', 18) + 'Mes clients en Excel</button>' : '') +
            '<button type="button" class="v2-btn v2-btn-ghost" id="of-creer" onclick="V2.pharmaCreerProspect()">' + ICO('plus', 18) + 'Créer un prospect</button></div>') +
        pharmaTabs('officines') +
        counterHtml +
        '<div class="of-bar">' + commBar + secteurBar + opsoFilterBar + '</div>' +
        '<label class="v2-champ of-recherche">' + ICO('search', 20, 2) +
          '<input id="v2-pharma-search" type="text" placeholder="Nom, titulaire, ville ou code postal…" aria-label="Rechercher une officine par son nom, son titulaire, sa ville ou son code postal" autocomplete="off" value="' +
          V2.esc(searchQuery) + '"></label>' +
        '<p class="of-n" id="v2-pharma-n" aria-live="polite">' + nAff + '</p>' +
        '<div class="v2-card" id="v2-pharma-card">' + corps + '</div>' +
      '</div>';

    // Recherche live : on ne re-render QUE la liste pour préserver le focus
    var inp = document.getElementById('v2-pharma-search');
    if (inp) {
      inp.addEventListener('input', function () {
        searchQuery = inp.value;
        var card = document.getElementById('v2-pharma-card');
        if (!card) return;
        card.innerHTML = listBody();
        var n = document.getElementById('v2-pharma-n'); if (n) n.textContent = nAff;
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
      (tog ? ' data-sec="' + esc(toggleKey) + '" onclick="V2.pharmaToggleSection(\'' + toggleKey + '\')"' : '') + '>' +
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
      if (cat && buckets[cat]) buckets[cat].mdl += margeNetteLigne(s);
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

  // Fiche prospect créée à la main (introuvable en base) : id « px_… ».
  var _newProspectSeed = null;
  V2.createProspect = function (name) {
    var id = 'px_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    _newProspectSeed = { id: id, nom: name || '' };
    V2.go('pharma', id);
  };
  // 05/10/2026 — bouton « Créer un prospect » de l'écran Officines : au retour, la liste s'ouvre sur les prospects.
  V2.pharmaCreerProspect = function () { secteurTab = 'prospects'; V2.createProspect(''); };
  function renderCreatedProspect(root, pid) {
    var seed = (_newProspectSeed && _newProspectSeed.id === pid) ? { nom: _newProspectSeed.nom } : {};
    root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
      '<div class="v2-wrap v2-prospect">' +
        '<div class="v2-card v2-prospect-hd">' +
          '<div class="v2-prospect-top">' +
            '<div class="v2-pharma-pin" style="background:linear-gradient(150deg,#00B37E,#00875A)">' + (V2.ICO ? V2.ICO('pharma', 22) : '') + '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="v2-prospect-n">Nouvelle fiche prospect</div>' +
              '<div class="v2-prospect-a">Renseignez l\'identité et les coordonnées ci-dessous</div>' +
            '</div>' +
          '</div>' +
          '<p class="v2-prospect-note">Nouvelle officine — indiquez son nom, son code postal, ses coordonnées, vos infos et vos notes. Chaque champ est enregistré dès que vous le quittez, partagé avec l\'équipe, et la fiche se retrouve dans Officines, onglet Prospects.</p>' +
        '</div>' +
        (V2.profil ? V2.profil.newProspectSection(pid, seed) : '') +
        (V2.profil ? V2.profil.section('client', pid) : '') +
        (V2.rdvPrepa ? V2.rdvPrepa.section(pid) : '') +
        (V2.notes ? V2.notes.section('client', pid) : '') +
        '<div class="v2-card v2-prospect-acts">' + txProspectBtn(pid) +
          '<button type="button" class="v2-btn v2-btn-ghost" id="of-archiver" onclick="V2.pharmaArchiverProspect(\'' + esc(String(pid).replace(/[^0-9A-Za-z_-]/g, '')) + '\')" title="La fiche sort des listes, rien n\'est effacé">Archiver cette fiche</button></div>' +
      '</div>';
    if (V2.profil) V2.profil.hydrate();
    if (V2.notes) V2.notes.hydrate();
    if (V2.rdvPrepa) V2.rdvPrepa.hydrate();
    // Fiche déjà remplie : son nom en titre, pas « Nouvelle fiche prospect ».
    if (V2.profil && V2.profil.charger) V2.profil.charger('client', pid).then(function (d) {
      if (!V2.route || String(V2.route.param) !== String(pid)) return;
      var b = root.querySelector('#of-archiver');
      if (b && d.archive) b.textContent = 'Rétablir cette fiche';
      if (!d.nom) return;
      var n = root.querySelector('.v2-prospect-n'), a = root.querySelector('.v2-prospect-a');
      if (n) n.textContent = d.nom;
      if (a) a.textContent = [cpDe(d), d.ville].filter(function (x) { return x; }).join(' ') || 'Fiche créée à la main';
    });
  }
  // 05/10/2026 — demande de Will : archiver une fiche prospect créée à la main (erreur, doublon).
  // Rien n'est effacé : `archive` la sort de la liste et de la recherche générale, le même bouton la rétablit.
  V2.pharmaArchiverProspect = function (pid) {
    if (!/^px_[A-Za-z0-9_-]+$/.test(String(pid)) || !V2.profil || !V2.profil.charger || !V2.profil.poser) return;
    V2.profil.charger('client', pid).then(function (d) {
      var arch = !d.archive;
      if (arch && !window.confirm('Archiver la fiche ' + (d.nom || 'de ce prospect') + ' ?\n\nElle sort de la liste des prospects et de la recherche, pour toute l\'équipe. Rien n\'est effacé : elle peut être rétablie.')) return;
      return V2.profil.poser('client', pid, 'archive', arch).then(function () {
        // L'enregistrement part en tâche de fond : les listes déjà chargées sont mises à jour tout de suite.
        _crees.forEach(function (o) { if (String(o.sid) === String(pid)) { if (arch) o.data.archive = true; else delete o.data.archive; } });
        _creesAt = arch ? Date.now() : 0;
        if (arch && V2._newph) V2._newph = V2._newph.filter(function (o) { return String(o.sid) !== String(pid); });
        if (V2.toast) V2.toast(arch ? 'Fiche archivée' : 'Fiche rétablie');
        if (arch) { secteurTab = 'prospects'; voirArchives = false; V2.go('pharma'); } else V2.render();
      });
    }).catch(function () {});
  };
  // 21/09/2026 — demande de Will : on transmet aussi des documents depuis une fiche prospect.
  function txProspectBtn(pid) {
    return '<button class="v2-btn v2-btn-ghost" onclick="V2.pharmaTransmettre(\'' + esc(String(pid)) + '\')" title="catalogues, documents de l\'équipe — en pièces jointes">' +
      (V2.ICO ? V2.ICO('fiche', 15, 2) : '') + 'Choisir quoi lui transmettre</button>' +
      (V2.todo ? '<button class="v2-btn v2-btn-ghost" onclick="V2.todo.menu(\'' + esc(String(pid).replace(/[^0-9A-Za-z_-]/g, '')) + '\')" title="demande de rendez-vous, suite de rendez-vous, ouverture de compte…">' +
        (window.ICO ? window.ICO('check', 15, 2) : '') + 'Ajouter à la to do list</button>' : '');
  }

  // Officine trouvée dans la base nationale (prospect / non-cliente) par son id.
  function pharmaFrById(pid) {
    var D = window.PHARMA_FR; if (!D || !D.p) return null;
    for (var i = 0; i < D.p.length; i++) if (String(D.p[i][13]) === String(pid)) return D.p[i];
    return null;
  }
  // Fiche d'une officine NON cliente (prospect) : coordonnées + infos + notes éditables,
  // sauvegardées comme pour un futur client (Supabase, même id que la carte).
  // ── Nom d'officine corrigé à la main (bouton Valider) — appliqué partout via V2.nameOvr ──
  function nameOf(pid, orig) { return (V2.nameOvr && V2.nameOvr[String(pid)]) || orig || ''; }
  function nameEditor(pid, currentName) {
    var idp = 'nm-' + String(pid).replace(/[^a-zA-Z0-9]/g, '');
    return '<div class="phf-nmedit"><span class="phf-nmedit-l">Corriger le nom de la pharmacie</span>' +
      '<div class="phf-nmedit-row"><input id="' + idp + '" class="phf-nmedit-in" type="text" value="' + esc(currentName || '') + '" placeholder="Nom de la pharmacie"></input>' +
      '<button class="phf-nmedit-btn" onclick="V2.saveOfficineName(\'' + esc(String(pid)) + '\',\'' + idp + '\')">Valider</button></div></div>';
  }
  V2.saveOfficineName = function (pid, inputId) {
    var el = document.getElementById(inputId); if (!el) return;
    if (!V2.user) { if (V2.toast) V2.toast('Connecte-toi pour modifier le nom'); return; }
    var val = (el.value || '').trim();
    V2.nameOvr = V2.nameOvr || {};
    if (val) V2.nameOvr[String(pid)] = val; else delete V2.nameOvr[String(pid)];
    var ph = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (ph && val) ph.name = val;
    if (window.PHARMA_FR) { var pt = pharmaFrById(pid); if (pt && val) pt[6] = val; }
    if (V2.profil && V2.profil.saveOverride) V2.profil.saveOverride(pid, { nom: val });
    if (V2.toast) V2.toast(val ? 'Nom mis à jour ✓' : 'Nom réinitialisé');
    V2.render();
  };

  // ── Titulaire(s) de l'officine (affiché + corrigeable) — via V2.titOvr, sinon base nationale ──
  function titulaireOf(pid, orig) { return (V2.titOvr && V2.titOvr[String(pid)]) || orig || ''; }
  function clientTitulaire(pid) {   // titulaire connu (override, sinon base clients, sinon PHARMA_FR p[10])
    var base = '';
    var ca = ((window.CLIENTS_ACTIFS || {}).d || {})[String(pid)];
    if (ca && ca[3]) base = ca[3];
    if (!base && window.PHARMA_FR) { var pt = pharmaFrById(pid); if (pt && pt[10]) base = pt[10]; }
    return titulaireOf(pid, base);
  }
  function titEditor(pid, currentTit) {
    var idp = 'tit-' + String(pid).replace(/[^a-zA-Z0-9]/g, '');
    return '<div class="phf-nmedit"><span class="phf-nmedit-l">Titulaire(s) de la pharmacie</span>' +
      '<div class="phf-nmedit-row"><input id="' + idp + '" class="phf-nmedit-in" type="text" value="' + esc(currentTit || '') + '" placeholder="Nom du/des titulaire(s)"></input>' +
      '<button class="phf-nmedit-btn" onclick="V2.saveOfficineTit(\'' + esc(String(pid)) + '\',\'' + idp + '\')">Valider</button></div></div>';
  }
  V2.saveOfficineTit = function (pid, inputId) {
    var el = document.getElementById(inputId); if (!el) return;
    if (!V2.user) { if (V2.toast) V2.toast('Connecte-toi pour modifier le titulaire'); return; }
    var val = (el.value || '').trim();
    V2.titOvr = V2.titOvr || {};
    if (val) V2.titOvr[String(pid)] = val; else delete V2.titOvr[String(pid)];
    if (window.PHARMA_FR) { var pt = pharmaFrById(pid); if (pt) pt[10] = val; }
    if (V2.profil && V2.profil.saveOverride) V2.profil.saveOverride(pid, { titulaire: val });
    if (V2.toast) V2.toast(val ? 'Titulaire mis à jour ✓' : 'Titulaire réinitialisé');
    V2.render();
  };

  function renderProspectFiche(root, pid) {
    if (!window.PHARMA_FR) {   // base nationale pas encore chargée → lazy-load puis re-rendu
      root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement de la fiche…</div></div>';
      if (V2.ensurePharmaFr) V2.ensurePharmaFr(function () { V2.render(); });
      else renderList(root);
      return;
    }
    if (V2.reconcilePharma) V2.reconcilePharma();   // vérité client (seg brut PHARMA_FR faux)
    var p = pharmaFrById(pid);
    if (!p) { renderList(root); return; }
    var D = window.PHARMA_FR;
    var ville = p[7] || '', cp = p[8] || '', seg = D.seg[p[4]] || 'Prospect';
    var grp = (D.grp[p[3]] && D.grp[p[3]] !== '—') ? D.grp[p[3]] : '', uga = D.uga[p[2]] || '';
    var q = encodeURIComponent((p[6] || '') + ' ' + ville + ' ' + cp);
    // 23/09/2026 — FINESS du jour (officinesinfos, public, 90 % des officines) : adresse,
    // tel, fax, SIREN, date d'ouverture. Chargé en tâche de fond, jamais au démarrage
    // (poids). Ne remplace jamais une saisie de l'équipe (coordSection gère la priorité).
    if (!window.OFFICINES_INFOS && V2.loadFiles) {
      if (!_oiAsked) { _oiAsked = true; V2.loadFiles(['officinesinfos']).then(function () { if (V2.route && V2.route.param) V2.render(); }); }
    }
    var oi = (window.OFFICINES_INFOS || {})[String(pid)] || null;
    var oiAdresse = oi ? (oi[0] || '') : '', oiTel = oi ? (oi[1] || '') : '', oiFax = oi ? (oi[2] || '') : '', oiSiren = oi ? (oi[3] || '') : '', oiDateouv = oi ? (oi[4] || '') : '';
    // 05/10/2026 — client de la base sans vente sur la période (ouvert depuis la liste Clients) :
    // son titulaire est celui de la base clients, l'annuaire national pouvant porter l'ancien.
    var caSV = ((window.CLIENTS_ACTIFS || {}).d || {})[String(pid)] || null;
    var seed = { nom: p[6] || '', groupement: grp || '', titulaire: (caSV && caSV[3]) || p[10] || dirigeantsDe(oi), tel: p[9] || oiTel, email: p[11] || '', adresse: oiAdresse };
    var secteurDe = (ugaCommMap()[p[2]] || []).join(', ');   // commerciaux présents dans son UGA
    var badge = function (t, cls) { return t ? '<span class="v2-chip' + (cls ? ' ' + cls : '') + '">' + esc(t) + '</span>' : ''; };
    // 23/09/2026 — un prospect n'a jamais de grossiste/génériqueur connu (base clients
    // = clientes seulement) : estimation d'après son groupement, jamais écrite en base.
    var probable = V2.probableParGroupement ? V2.probableParGroupement(pid) : null;
    var probableLignes = (probable && (probable.grossiste || probable.generiqueur)) ?
      '<div class="v2-prospect-probable">' +
        (probable.grossiste ? '<span>Grossiste probable</span><b>' + esc(V2.probableTexte(probable.grossiste, probable.groupement)) + '</b>' : '') +
        (probable.generiqueur ? '<span>Génériqueur probable</span><b>' + esc(V2.probableTexte(probable.generiqueur, probable.groupement)) + '</b>' : '') +
      '</div>' : '';
    root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
      '<div class="v2-wrap v2-prospect">' +
        '<div class="v2-card v2-prospect-hd">' +
          '<div class="v2-prospect-top">' +
            '<div class="v2-pharma-pin" style="background:linear-gradient(150deg,#0057FF,#0034A0)">' + (V2.ICO ? V2.ICO('pharma', 22) : '') + '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="v2-prospect-n">' + esc(nameOf(pid, p[6] || p[10]) || 'Pharmacie') + '</div>' +
              '<div class="v2-prospect-a">' + esc(ville) + (cp ? ' · ' + esc(cp) : '') + '</div>' +
              '<div class="v2-prospect-badges">' + badge(caSV ? 'Client' : seg, 'pr') + badge(grp) + badge(uga ? 'UGA ' + uga : '') + badge(secteurDe ? 'Secteur de ' + secteurDe : '') + '</div>' +
              ((oiSiren || oiFax || oiDateouv) ? '<div class="v2-prospect-extra">' +
                (oiSiren ? '<a href="https://annuaire-entreprises.data.gouv.fr/entreprise/' + esc(oiSiren) + '" target="_blank" rel="noopener">SIREN ' + esc(oiSiren) + '</a>' : '') +
                (oiFax ? (oiSiren ? ' · ' : '') + 'Fax ' + esc(oiFax) : '') +
                (oiDateouv ? ((oiSiren || oiFax) ? ' · ' : '') + 'Ouverte le ' + esc(oiDateouv) : '') +
              '</div>' : '') +
              ((dirigeantsDe(oi) && !memesNoms(p[10], dirigeantsDe(oi))) ? '<div class="v2-prospect-extra">Dirigeant(s) déclaré(s) : ' + esc(dirigeantsDe(oi)) + '</div>' : '') +
              (equipeDe(oi) ? '<div class="v2-prospect-extra">Pharmaciens : ' + esc(equipeDe(oi)) + '</div>' : '') +
              (cessation(oi) ? '<div class="v2-prospect-extra v2-cessee">' + esc(cessation(oi)) + '</div>' : '') +
              (retraiteDe(oi) ? '<div class="v2-prospect-extra v2-retraite">Titulaire proche de la retraite (62 ans ou plus)</div>' : '') +
              (autresOfficinesHtml(oi) ? '<div class="v2-prospect-extra">Dirige aussi : ' + autresOfficinesHtml(oi) + '</div>' : '') +
              (venteFondsHtml(oi) ? '<div class="v2-prospect-extra">' + venteFondsHtml(oi) + '</div>' : '') +
              (procedureHtml(oi) ? '<div class="v2-prospect-extra v2-retraite">Procédure collective : ' + procedureHtml(oi) + '</div>' : '') +
              probableLignes +
            '</div>' +
          '</div>' +
          (caSV ? '<p class="v2-prospect-note">Cliente de la base clients' + (caSV[3] ? ' (' + esc(caSV[3]) + ')' : '') + ' — aucune vente sur la période. Ses coordonnées, infos et notes se complètent ici. Tout est sauvegardé.</p>'
                : '<p class="v2-prospect-note">Officine non cliente — complétez ses coordonnées, infos et notes pour la suivre comme un futur client. Tout est sauvegardé.</p>') +
        '</div>' +
        '<div class="v2-card" style="padding:12px 16px 14px">' + nameEditor(pid, p[6] || '') + '</div>' +
        // 27/09/2026 — le potentiel sur un PROSPECT : c'est ici qu'il sert le plus, puisque
        // aucune vente n'existe encore. Découvert en le testant : la fiche prospect suit une
        // branche à part, où la colonne « chiffres » n'existe pas — le bloc y manquait.
        (V2.potentielBloc ? V2.potentielBloc({ cp: cp, ville: ville }) : '') +
        (V2.profil ? V2.profil.coordSection(pid, seed) : '') +
        (V2.profil ? V2.profil.section('client', pid) : '') +
        (V2.rdvPrepa ? V2.rdvPrepa.section(pid) : '') +
        (V2.notes ? V2.notes.section('client', pid) : '') +
        '<div class="v2-card v2-prospect-acts">' +
          ((V2.promoted && V2.promoted[String(pid)])
            ? '<span class="v2-btn v2-btn-ghost" style="cursor:default;color:var(--c-opp);border-color:var(--c-opp)">✓ Passé en client</span>'
            : '<button class="v2-btn v2-btn-primary" onclick="V2.promoteToClient(\'' + esc(String(pid)) + '\')">➕ Passer en client</button>') +
          txProspectBtn(pid) +
          '<a class="v2-btn v2-btn-ghost" href="https://www.google.com/maps/search/?api=1&query=' + q + '" target="_blank" rel="noopener">Voir sur Google Maps</a>' +
        '</div>' +
      '</div>';
    if (V2.profil) V2.profil.hydrate();
    if (V2.notes) V2.notes.hydrate();
    if (V2.rdvPrepa) V2.rdvPrepa.hydrate();
  }

  var _clientsAsked = false;   // évite de redemander clients-data.js à chaque rendu
  var _oiAsked = false;        // évite de redemander officines-infos-data.js à chaque rendu
  // 23/09/2026 — annuaire des entreprises (colonnes 5-8 d'OFFICINES_INFOS) : dirigeants déclarés,
  // société cessée. « Cessée » ne veut PAS dire pharmacie fermée : une vente ferme souvent
  // l'ancienne société et en ouvre une nouvelle — d'où « reprise ou fermeture à vérifier ».
  function dateFr(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  function memesNoms(a, b) {   // au moins un nom de famille commun → même personne, pas de doublon
    var mots = function (s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^A-Z]+/).filter(function (x) { return x.length > 2 && ['MME', 'MLLE'].indexOf(x) < 0; }); };
    var A = mots(a); return mots(b).some(function (x) { return A.indexOf(x) >= 0; });
  }
  // Reprise probable quand l'établissement a été (ré)ouvert au FINESS au plus 2 mois avant la
  // cessation ou après, ou quand l'officine nous commande encore (cliente) ; sinon « à vérifier ».
  // Dirigeants déclarés — JAMAIS ceux d'une société cessée (anciens propriétaires), même si le fichier en portait.
  function dirigeantsDe(oi) { return (oi && oi[6] !== 'C' && oi[5]) || ''; }
  // 24/09/2026 — colonnes 9-10 (robot ~/fiches-officines) : 'R' = un dirigeant a 62 ans ou plus
  // (l'année de naissance n'est jamais publiée), et les officines dirigées par la même personne
  // (nom + prénoms + mois de naissance identiques à l'annuaire des entreprises).
  function retraiteDe(oi) { return !!(oi && oi[6] !== 'C' && oi[9] === 'R'); }
  // 24/09/2026 — colonnes 11-12 (robot ~/fiches-officines, BODACC) : dernière vente du fonds publiée
  // depuis 2019 ('A|V|date|prix|id' — A = cette société a racheté, V = elle a vendu) et dernière
  // procédure collective publiée depuis 2021 ('date|libellé|id'). Date = parution au BODACC.
  function bodaccLien(id) {
    return id ? ' · <a href="https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:' + encodeURIComponent(id) +
      '" target="_blank" rel="noopener">voir l\'annonce</a>' : '';
  }
  function venteFondsHtml(oi) {
    var v = oi && oi[11] ? String(oi[11]).split('|') : null;
    if (!v || !v[1]) return '';
    return (v[0] === 'V' ? 'Vente' : 'Rachat') + ' du fonds publié' + (v[0] === 'V' ? 'e' : '') + ' le ' + esc(dateFr(v[1])) +
      (v[2] ? ' · prix annoncé ' + esc(Number(v[2]).toLocaleString('fr-FR')) + ' €' : '') + bodaccLien(v[3]);
  }
  function procedureHtml(oi) {
    var v = oi && oi[12] ? String(oi[12]).split('|') : null;
    if (!v || !v[0]) return '';
    return esc(v[1] || 'Procédure collective') + ' — publié le ' + esc(dateFr(v[0])) + bodaccLien(v[2]);
  }
  // 24/09/2026 — colonne 13 (robot ~/fiches-officines, Annuaire Santé RPPS) : 'titulaires|adjoints',
  // pharmaciens déclarés sur le FINESS de l'officine. Des comptes seulement, jamais de nom.
  function equipeDe(oi) {
    var v = oi && oi[13] ? String(oi[13]).split('|') : null;
    if (!v) return '';
    var t = +v[0] || 0, a = +v[1] || 0;
    return (t ? t + ' titulaire' + (t > 1 ? 's' : '') : 'titulaire non déclaré') +
      (a ? ' + ' + a + ' adjoint' + (a > 1 ? 's' : '') : ', sans adjoint déclaré');
  }
  var _nomsPf = null;
  function officineLabel(id) {
    var D = window.PHARMA_FR;
    if (!_nomsPf && D && D.p) { _nomsPf = {}; D.p.forEach(function (r) { _nomsPf[String(r[13])] = (r[6] || '') + (r[7] ? ' (' + r[7] + ')' : ''); }); }
    return (_nomsPf && _nomsPf[id]) || 'Officine ' + id;
  }
  function autresOfficinesHtml(oi) {
    if (!oi || oi[6] === 'C' || !oi[10]) return '';
    return String(oi[10]).split(',').map(function (id) {
      return '<a href="#" onclick="V2.go(\'pharma\',\'' + esc(id) + '\');return false">' + esc(officineLabel(id)) + '</a>';
    }).join(' · ');
  }
  function cessation(oi, cliente) {
    if (!oi || oi[6] !== 'C') return '';
    var reprise = cliente || (oi[4] && oi[7] && (new Date(oi[4]) - new Date(oi[7])) / 864e5 > -62);
    return 'Société cessée' + (oi[7] ? ' le ' + dateFr(oi[7]) : '') + (reprise ? ' — reprise probable' : ' — reprise ou fermeture à vérifier');
  }
  // Coordonnées SAISIES par l'équipe sur la fiche (table `profils`, scope 'client').
  // Elles étaient enregistrées mais jamais relues : le commercial corrigeait un
  // numéro, le rechargement le faisait disparaître de l'en-tête. Une lecture par
  // officine, gardée en mémoire, puis un re-rendu.
  var _coordSaisie = {};       // pid -> { tel, email, adresse } | null tant qu'on lit


  // ══ Fiche d'ANALYSE (27/08/2026) — disposition « Cockpit » (ordinateur : l'humain à gauche,
  // les chiffres à droite) et « Terrain » (téléphone : notes et infos d'abord, chiffres ensuite).
  // Demande Will : CA par mois et évolution · CA par tranche + top 5 · détail par tranche face à
  // l'officine moyenne du réseau et son évolution · TOUTES les infos officine et les notes.
  // Plus de ruptures ni de « ce qu'Intégral peut lui rendre » : c'est une fiche d'analyse.
  var _netCache = null, _netRef = null;
  function networkByCat() {   // réseau entier (tous commerciaux), 1 passe sur V2.sales, mise en cache
    if (_netCache && _netRef === V2.sales) return _netCache;
    var bIdx = benchIndex(), S = V2.sales || [];
    var months = {}, act = {}, caByPid = {};
    for (var i = 0; i < S.length; i++) {
      var s = S[i]; if (!s.month || !s.year) continue;
      var mk = s.year * 12 + (s.month - 1);
      var m = months[mk] || (months[mk] = { mk: mk, year: s.year, month: s.month, total: 0, byCat: {} });
      var cip = String(s.artCode || ''); var b = cip ? bIdx.get(cip) : null;
      var cat = (b ? classify(b, cip) : null) || 'other';
      var v = s.mntNetHt || 0, pk = String(s.pharmacyId);
      m.byCat[cat] = (m.byCat[cat] || 0) + v; m.total += v;
      if (V2.estReste(pk)) continue;   // total du reste du réseau : compté en €, pas comme officine
      (act[mk] || (act[mk] = {}))[pk] = 1;
      caByPid[pk] = (caByPid[pk] || 0) + v;
    }
    var R = V2.reperesReseau();   // commercial restreint : repères réseau tout faits
    var list = Object.keys(months).map(function (k) { return months[k]; }).sort(function (x, y) { return x.mk - y.mk; });
    list.forEach(function (m) {
      m.n = (R && R.act[m.month]) || Object.keys(act[m.mk] || {}).length || 1;   // officines actives ce mois-là
      m.avg = m.total / m.n; m.avgByCat = {};
      Object.keys(m.byCat).forEach(function (c) { m.avgByCat[c] = m.byCat[c] / m.n; });
    });
    var ranking = Object.keys(caByPid).sort(function (x, y) { return caByPid[y] - caByPid[x]; });
    _netCache = { months: list, caByPid: caByPid, ranking: ranking, R: R }; _netRef = V2.sales;
    return _netCache;
  }
  function pctOf(a, b) { return (b > 0) ? Math.round((a - b) / b * 100) : null; }
  function evoHtml(p, suffix) {
    if (p == null) return '<span class="pha-flat">—</span>';
    var c = p > 2 ? 'pha-up' : (p < -2 ? 'pha-dn' : 'pha-flat');
    return '<span class="' + c + ' mono">' + (p > 0 ? '+' : '') + p + ' %' + (suffix || '') + '</span>';
  }
  function monthLabel(m) { return MN_SHORT[m.month - 1]; }

  var top5Cat = null;   // catégorie ouverte dans « Top 10 par catégorie »
  V2.pharmaTop5Cat = function (key) { top5Cat = key; if (!l1MajTout()) V2.render(); };

  // 09/10/2026 — règle de Will : « chaque officine est lue jusqu'au dernier mois chargé pour SON commercial ».
  // Chaque secteur (fichier d'un commercial) s'arrête à son mois (cf. reference_dernier_mois_incomplet, même façon
  // de faire que moisCouverts() du brief) ; l'officine s'arrête au PLUS PETIT des derniers mois de ses secteurs.
  var _derCom = null, _derComRef = null;
  function dernierMkParCommercial() {
    if (_derCom && _derComRef === V2.sales) return _derCom;
    _derCom = {}; var S = V2.sales || [];
    for (var i = 0; i < S.length; i++) {
      if (!S[i].month || !S[i].year) continue;
      var c = S[i].commercial || '', mk = S[i].year * 12 + (S[i].month - 1);
      if (_derCom[c] == null || mk > _derCom[c]) _derCom[c] = mk;
    }
    _derComRef = V2.sales; return _derCom;
  }
  function finOfficine(sales) {
    var der = dernierMkParCommercial(), fin = null;
    for (var i = 0; i < sales.length; i++) {
      var s = sales[i]; if (!s.month || !s.year) continue;
      var d = der[s.commercial || '']; if (d != null && (fin == null || d < fin)) fin = d;
    }
    return fin;
  }

  // Tout ce que la fiche d'analyse calcule, en un seul objet (partagé ordinateur / téléphone).
  function analyseData(pid, sales) {
    var net = networkByCat();
    var netMonths = net.months;
    var fin = finOfficine(sales);   // dernier mois de SON secteur : au-delà, on ne lit rien (ni mois, ni lignes, ni moyenne)
    if (fin != null) {
      netMonths = netMonths.filter(function (m) { return m.mk <= fin; });
      sales = sales.filter(function (s) { return !s.month || !s.year || s.year * 12 + (s.month - 1) <= fin; });
    }
    var byM = {}, cntM = {}; sales.forEach(function (s) { if (s.month && s.year) { var k = s.year * 12 + (s.month - 1); byM[k] = (byM[k] || 0) + (s.mntNetHt || 0); cntM[k] = (cntM[k] || 0) + 1; } });
    var pts = netMonths.map(function (m) { return { mk: m.mk, label: monthLabel(m), year: m.year, ca: byM[m.mk] || 0, net: m.avg }; });
    var n = pts.length, last = pts[n - 1] || null, prev = pts[n - 2] || null;
    // 08/10/2026 — la moyenne par mois se compte DEPUIS LA PREMIÈRE COMMANDE de l'officine
    // (une officine arrivée en juin est comparée sur ses mois d'activité, pas sur toute la
    // période), et le repère se prend sur la MÊME fenêtre. Le cumul, lui, ne change pas.
    // i0 = rang du premier mois où elle a au moins une ligne de vente ; nAct = n - i0.
    var i0 = n; for (var q0 = 0; q0 < n; q0++) { if (cntM[pts[q0].mk]) { i0 = q0; break; } }
    var nAct = n - i0;
    var caTot = pts.reduce(function (a, p) { return a + p.ca; }, 0);
    var netTot = pts.reduce(function (a, p, i) { return a + (i >= i0 ? p.net : 0); }, 0);
    var oc = ownedByCat(sales);
    var topAll = ownedTopByCat(sales, 10);
    var cats = CATS.map(function (c) {
      var bk = oc.buckets[c.key];
      var netByM = netMonths.map(function (m) { return m.avgByCat[c.key] || 0; });
      var t = topAll.filter(function (o) { return o.cat.key === c.key; })[0];
      return { key: c.key, label: c.label, sub: c.sub, color: c.color, refs: bk.refs.size, qte: bk.qte, ca: bk.ca, mdl: bk.mdl,
        netMoy: nAct ? netByM.reduce(function (a, v, i) { return a + (i >= i0 ? v : 0); }, 0) / nAct : 0, netByM: netByM, top: t ? t.rows : [], nbRefs: t ? t.total : 0 };
    });
    // CA par mois et par catégorie de l'officine (pour l'évolution du dernier mois)
    var bIdx = benchIndex();
    var mine = {}, mineQ = {}; sales.forEach(function (s) {
      if (!s.month || !s.year) return; var k = s.year * 12 + (s.month - 1);
      var cip = String(s.artCode || ''); var b = cip ? bIdx.get(cip) : null; var cat = (b ? classify(b, cip) : null) || 'other';
      var mm = mine[cat] || (mine[cat] = {}); mm[k] = (mm[k] || 0) + (s.mntNetHt || 0);
      var mq = mineQ[cat] || (mineQ[cat] = {}); mq[k] = (mq[k] || 0) + (s.qte || 0);
    });
    cats.forEach(function (c) {
      var mm = mine[c.key] || {};
      c.moy = nAct ? c.ca / nAct : 0;
      c.part = caTot > 0 ? c.ca / caTot * 100 : 0;
      c.gap = pctOf(c.moy, c.netMoy);
      c.evo = (last && prev) ? pctOf(mm[last.mk] || 0, mm[prev.mk] || 0) : null;
      c.netEvo = (last && prev) ? pctOf(netMonths[n - 1].avgByCat[c.key] || 0, netMonths[n - 2].avgByCat[c.key] || 0) : null;
      // Part de la catégorie dans le CA de CHAQUE mois (null = officine inactive ce mois-là),
      // face à la part de la même catégorie dans le CA réseau du même mois.
      c.partByM = netMonths.map(function (m) { var t = byM[m.mk] || 0; return t > 0 ? (mm[m.mk] || 0) / t * 100 : null; });
      c.netPartByM = netMonths.map(function (m) { return m.total > 0 ? (m.byCat[c.key] || 0) / m.total * 100 : 0; });
      var act = c.partByM.filter(function (v) { return v != null; });
      c.partLast = act.length ? act[act.length - 1] : null;
      c.partEvo = act.length >= 2 ? act[act.length - 1] - act[act.length - 2] : null;
      // et les mêmes mois en VALEUR (€) et en VOLUME (boîtes) — null = mois sans commande
      var mq = mineQ[c.key] || {};
      c.caByM = netMonths.map(function (m) { return (byM[m.mk] || 0) > 0 ? (mm[m.mk] || 0) : null; });
      c.qByM = netMonths.map(function (m) { return (byM[m.mk] || 0) > 0 ? (mq[m.mk] || 0) : null; });
    });
    var rank = net.R ? (net.R.rg[String(pid)] || 0) : net.ranking.indexOf(String(pid)) + 1;
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); }) || {};
    var grpName = String(pharma.groupement || '').trim();
    if (grpName && grpName !== '—') grpName = canonG(grpName);
    var grpPids = (grpName && grpName !== '—') ? (V2.pharmacies || []).filter(function (p) { var g = String(p.groupement || '').trim(); return g && canonG(g) === grpName; }).map(function (p) { return String(p.id); }) : [];
    var grpRank = 0;
    var rgg = net.R && net.R.rgg[String(pid)];
    if (rgg) { grpRank = rgg[0]; grpPids = { length: rgg[1] }; }
    else if (grpPids.length >= 2 && !net.R) { var sorted = grpPids.slice().sort(function (x, y) { return (net.caByPid[y] || 0) - (net.caByPid[x] || 0); }); grpRank = sorted.indexOf(String(pid)) + 1; }
    return { pts: pts, n: n, i0: i0, nAct: nAct, debut: pts[i0] || null, last: last, prev: prev, caTot: caTot, caMoy: nAct ? caTot / nAct : 0, netMoy: nAct ? netTot / nAct : 0,
      evoM: (last && prev) ? pctOf(last.ca, prev.ca) : null, evoNet: (last && prev) ? pctOf(last.net, prev.net) : null,
      cats: cats, other: { refs: oc.other.refs.size, qte: oc.other.qte, ca: oc.other.ca },
      rank: rank, nOff: net.R ? net.R.no : net.ranking.length, grpName: grpName, grpRank: grpRank, nGrp: grpPids.length };
  }

  function trancheRow(c, maxCa) {
    var absent = c.ca <= 0;
    return '<tr' + (absent ? ' class="pha-absent"' : '') + '><td><span class="ph-tr-dot" style="background:' + c.color + '"></span><b>' + esc(c.label) + '</b>' + (c.sub ? ' <span class="pha-sub">' + esc(c.sub) + '</span>' : '') + '</td>' +
      '<td class="num">' + V2.fmtNum(c.refs) + '</td>' +
      '<td class="num"><b>' + V2.fmtEur(c.ca) + '</b><div class="pha-bar"><i style="width:' + (maxCa > 0 ? Math.max(c.ca > 0 ? 3 : 0, c.ca / maxCa * 100) : 0).toFixed(1) + '%;background:' + c.color + '"></i></div></td>' +
      '<td class="num">' + Math.round(c.part) + ' %</td>' +
      '<td class="num" style="color:var(--c-opp);font-weight:700">' + (c.mdl > 0 ? V2.fmtEur(c.mdl) : '—') + '</td>' +
      '<td class="num" style="color:var(--muted)">' + (c.mdl > 0 && c.ca > 0 ? (c.mdl / c.ca * 100).toFixed(1).replace('.', ',') + ' %' : '—') + '</td>' +
      '<td class="num">' + V2.fmtEur(c.netMoy) + '</td>' +
      '<td class="num">' + (absent ? (c.netMoy > 0 ? '<span class="pha-dn">absente</span>' : '—') : evoHtml(c.gap)) + '</td>' +
      '<td class="num">' + evoHtml(c.evo) + '<div class="pha-sub">réseau ' + evoHtml(c.netEvo) + '</div></td></tr>';
  }
  function analyseTranches(A) {
    var maxCa = A.cats.reduce(function (m, c) { return Math.max(m, c.ca); }, 0);
    var rows = A.cats.map(function (c) { return trancheRow(c, maxCa); }).join('');
    if (A.other.refs > 0) rows += '<tr><td><span class="ph-tr-dot" style="background:var(--muted-2)"></span>Hors catégories</td><td class="num">' + V2.fmtNum(A.other.refs) + '</td><td class="num"><b>' + V2.fmtEur(A.other.ca) + '</b></td><td class="num">' + Math.round(A.caTot > 0 ? A.other.ca / A.caTot * 100 : 0) + ' %</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>';
    // Total : la marge nette de l'officine, toutes tranches confondues. Le taux se lit
    // sur les achats qui ont réellement produit de la marge (princeps remboursés seuls).
    var totRefs = A.other.refs, totMarge = 0, caMarge = 0;
    A.cats.forEach(function (c) { totRefs += c.refs; totMarge += c.mdl; if (c.mdl > 0) caMarge += c.ca; });
    rows += '<tr style="border-top:1.5px solid var(--line)"><td><b>Total · marge nette de l\'officine</b></td>' +
      '<td class="num"><b>' + V2.fmtNum(totRefs) + '</b></td><td class="num"><b>' + V2.fmtEur(A.caTot) + '</b></td><td class="num">100 %</td>' +
      '<td class="num" style="color:var(--c-opp);font-weight:800">' + (totMarge > 0 ? V2.fmtEur(totMarge) : '—') + '</td>' +
      '<td class="num"><b>' + (caMarge > 0 ? (totMarge / caMarge * 100).toFixed(1).replace('.', ',') + ' %' : '—') + '</b></td>' +
      '<td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>';
    var legende = '<div class="pha-sub" style="padding:8px 18px 12px;line-height:1.5">' +
      'Marge nette gagnée par l\'officine : <b>0,18 €</b> par boîte jusqu\'à 4,33 € · <b>4,2 %</b> de 4,33 à 468 € · ' +
      '<b>19,50 €</b> par boîte au-delà. Princeps remboursés seulement : génériques, biosimilaires et non remboursés hors calcul.</div>';
    var desk ='<div class="v2-card pha-card pha-desk" style="padding:0;overflow:hidden"><div class="pha-ch" style="padding:16px 18px 6px"><h3>Son CA par tranche, face à l\'officine moyenne du réseau</h3><span class="pha-sub">écart = sa moyenne mensuelle vs celle du réseau, ' + l1Fenetre(A) + ' (depuis sa première commande) · évolution = dernier mois vs le précédent</span></div>' +
      '<div class="v2-cat-table-wrap" style="border-top:none"><table class="v2-table pha-table"><thead><tr><th>Tranche</th><th class="num">Réf.</th><th class="num">CA ' + A.nAct + ' mois</th><th class="num">Part</th><th class="num">Marge nette</th><th class="num">Taux</th><th class="num">Réseau / mois</th><th class="num">Écart</th><th class="num">Évol.</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + legende + '</div>';
    // Téléphone : une ligne par tranche, dépliable sur son top 10
    var on = A.cats.filter(function (c) { return c.ca > 0; }).sort(function (x, y) { return y.ca - x.ca; });
    var mob = '<div class="v2-card pha-card pha-mob"><div class="pha-ch"><h3>Par tranche</h3><span class="pha-sub">' + A.nAct + ' mois · top 10 au clic</span></div>' +
      on.map(function (c, i) {
        return '<details class="pha-det"' + (i === 0 ? ' open' : '') + '><summary><span><span class="ph-tr-dot" style="background:' + c.color + '"></span>' + esc(c.label) + '</span><span class="mono">' + V2.fmtK(c.ca) + ' <span class="pha-sub">' + Math.round(c.part) + ' %</span> ' + ICO('chev', 14) + '</span></summary>' +
          '<div class="pha-bar" style="margin:0 0 8px"><i style="width:' + (maxCa > 0 ? (c.ca / maxCa * 100).toFixed(1) : 0) + '%;background:' + c.color + '"></i></div>' +
          c.top.map(function (t, j) { return '<div class="pha-r"><i>' + (j + 1) + '</i><span>' + esc(t.designation) + '</span><b class="mono">' + V2.fmtEur(t.ca) + '</b></div>'; }).join('') +
          '<div class="pha-sub" style="padding:2px 0 8px">' + (c.mdl > 0 ? 'marge nette ' + V2.fmtEur(c.mdl) + ' · ' : '') + 'réseau ' + V2.fmtEur(c.netMoy) + '/mois · ' + evoHtml(c.gap) + ' · évol. ' + evoHtml(c.evo) + ' (réseau ' + evoHtml(c.netEvo) + ')</div></details>';
      }).join('') +
      A.cats.filter(function (c) { return c.ca <= 0 && c.netMoy > 0; }).map(function (c) { return '<div class="pha-r pha-r1"><span><span class="ph-tr-dot" style="background:' + c.color + '"></span>' + esc(c.label) + '</span><b class="pha-dn">absente</b><span class="pha-sub" style="grid-column:1/-1">le réseau en fait ' + V2.fmtEur(c.netMoy) + '/mois</span></div>'; }).join('') +
    legende + '</div>';
    return desk + mob;
  }

  // ── Parts par catégorie, MOIS PAR MOIS (demande Will 04/09/2026 : « il faut vraiment que
  // sur les clients on voit les parts mois par mois d'évolution sur les catégories,
  // notamment les biosimilaires »). Une tuile par catégorie : barres = sa part du CA du
  // mois, tiret gris = part de la même catégorie dans le CA du réseau ce mois-là.
  function fmtPart(v) {
    if (v == null) return '—';
    var r = v < 9.95 ? Math.round(v * 10) / 10 : Math.round(v);
    return String(r).replace('.', ',');
  }
  function ptsHtml(d) {
    if (d == null) return '<span class="pha-flat">—</span>';
    var r = Math.round(d * 10) / 10;
    var c = r > 0.5 ? 'pha-up' : (r < -0.5 ? 'pha-dn' : 'pha-flat');
    return '<span class="' + c + ' mono">' + (r > 0 ? '+' : '') + String(r).replace('.', ',') + ' pt' + (Math.abs(r) >= 2 ? 's' : '') + '</span>';
  }
  // Unité de la carte : 'part' (% du CA du mois) · 'eur' (CA net) · 'vol' (boîtes)
  // (Will, 04/09/2026 : « j'aimerais aussi voir [...] en terme de valeur et de volume »)
  var partsUnit = 'part';
  V2.pharmaPartsUnit = function (u) { partsUnit = u; if (!l1MajTout()) V2.render(); };
  function partTileSvg(c, pts, unit) {
    var n = pts.length; if (!n) return '';
    var vals = unit === 'eur' ? c.caByM : (unit === 'vol' ? c.qByM : c.partByM);
    var withNet = unit === 'part';   // en € / boîtes, l'échelle réseau n'est pas comparable
    var fmtVal = unit === 'part' ? fmtPart : V2.fmtK;
    var w = 300, h = 100, padT = 17, padB = 15, padS = 4;
    var W = w - padS * 2, H = h - padT - padB, base = padT + H;
    var max = unit === 'part' ? 1 : 0;
    vals.forEach(function (v) { if (v != null && v > max) max = v; });
    if (withNet) c.netPartByM.forEach(function (v) { if (v > max) max = v; });
    max = (max || 1) * 1.18;
    var bw = Math.min(24, W / n * 0.56);
    var xc = function (i) { return padS + (i + 0.5) * (W / n); };
    var yv = function (v) { return base - Math.max(0, v) / max * H; };
    var quoi = unit === 'eur' ? 'CA net' : (unit === 'vol' ? 'Boîtes' : 'Part dans le CA');
    var g = '<svg class="pha-part-ch" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(quoi + ' — ' + c.label) + ', mois par mois">' +
      '<line x1="' + padS + '" x2="' + (w - padS) + '" y1="' + base + '" y2="' + base + '" stroke="rgba(16,19,28,.14)"/>';
    // Barres + tirets réseau d'abord, valeurs PAR-DESSUS avec un halo blanc : sans lui,
    // un tiret à la même hauteur barre le chiffre et « 2,4 » se lit « -2,4 ».
    var labels = '';
    pts.forEach(function (p, i) {
      var v = vals[i], x = xc(i);
      if (v == null) {
        labels += '<text x="' + x.toFixed(1) + '" y="' + (base - 4) + '" font-size="10" text-anchor="middle" fill="#B9C0D0">·</text>';
      } else {
        var y = yv(v);
        if (v > 0) g += '<rect x="' + (x - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (base - y).toFixed(1) + '" rx="2.5" fill="' + c.color + '" opacity=".9"/>';
        // Si le tiret réseau passe dans la zone du chiffre, on pose le chiffre AU-DESSUS
        // du tiret : les bouts de tiret qui dépassent se liraient comme un signe moins.
        var ly = y - 4;
        if (withNet) { var nyv = yv(c.netPartByM[i]); if (nyv < y + 2 && nyv > y - 16) ly = nyv - 5; }
        labels += '<text x="' + x.toFixed(1) + '" y="' + ly.toFixed(1) + '" font-size="9.5" font-weight="700" text-anchor="middle" fill="#10131C" font-family="var(--mono)" stroke="#fff" stroke-width="3" paint-order="stroke">' + fmtVal(v) + '</text>';
      }
      if (withNet) {
        var ny = yv(c.netPartByM[i]);
        g += '<line x1="' + (x - bw / 2 - 3).toFixed(1) + '" x2="' + (x + bw / 2 + 3).toFixed(1) + '" y1="' + ny.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="#7A8299" stroke-width="1.8" stroke-dasharray="3 2"/>';
      }
      g += '<text x="' + x.toFixed(1) + '" y="' + (h - 3) + '" font-size="9.5" text-anchor="middle" fill="' + (v == null ? '#B9C0D0' : '#737A8C') + '" font-weight="600">' + esc(p.label) + '</text>';
    });
    return g + labels + '</svg>';
  }
  function analyseParts(A) {
    if (A.n < 2) return '';
    // Une catégorie jamais commandée n'encombre pas la fiche — sauf les biosimilaires,
    // toujours visibles (c'est le combat commercial du moment) : 0 % face au tiret réseau.
    var show = A.cats.filter(function (c) { return c.ca > 0 || c.key === 'biosim'; });
    if (!show.length) return '';
    var unit = partsUnit;
    var tiles = show.map(function (c) {
      var netLast = c.netPartByM.length ? c.netPartByM[c.netPartByM.length - 1] : null;
      var vals = unit === 'eur' ? c.caByM : (unit === 'vol' ? c.qByM : c.partByM);
      var act = vals.filter(function (v) { return v != null; });
      var lastV = act.length ? act[act.length - 1] : null;
      var prevV = act.length >= 2 ? act[act.length - 2] : null;
      var headVal, deltaTxt;
      if (unit === 'part') {
        headVal = fmtPart(c.partLast) + '<small> %</small>';
        deltaTxt = ptsHtml(c.partEvo);
      } else {
        headVal = lastV == null ? '—'
          : (unit === 'eur' ? V2.fmtEur(lastV) : V2.fmtNum(lastV) + '<small> boîtes</small>');
        deltaTxt = evoHtml((lastV != null && prevV != null) ? pctOf(lastV, prevV) : null);
      }
      return '<div class="pha-part' + (c.key === 'biosim' ? ' pha-part-bio' : '') + '">' +
        '<div class="pha-part-hd"><span class="pha-part-t"><span class="ph-tr-dot" style="background:' + c.color + '"></span>' + esc(c.label) + '</span>' +
          '<span class="pha-part-v mono">' + headVal + '</span></div>' +
        '<div class="pha-part-sub">' + deltaTxt + ' <span class="pha-sub">vs mois préc.' + (unit === 'part' ? ' · réseau ' + fmtPart(netLast) + ' %' : '') + '</span></div>' +
        partTileSvg(c, A.pts, unit) +
      '</div>';
    }).join('');
    var sub = unit === 'part'
      ? 'part de chaque catégorie dans son CA du mois · <i class="pha-net-dash"></i> = part de la catégorie dans le CA réseau du même mois'
      : (unit === 'eur' ? 'CA net de chaque catégorie, mois par mois' : 'boîtes commandées dans chaque catégorie, mois par mois');
    var btn = function (val, lbl) {
      return '<button class="pha-part-btn' + (unit === val ? ' on' : '') + '" onclick="V2.pharmaPartsUnit(\'' + val + '\')">' + lbl + '</button>';
    };
    return '<div class="v2-card pha-card"><div class="pha-ch pha-parts-head"><div><h3>Par catégorie, mois par mois</h3>' +
      '<span class="pha-sub">' + sub + '</span></div>' +
      '<div class="pha-part-seg">' + btn('part', 'Part %') + btn('eur', 'CA €') + btn('vol', 'Boîtes') + '</div></div>' +
      '<div class="pha-parts">' + tiles + '</div></div>';
  }

  function analyseTop5(A) {
    var on = A.cats.filter(function (c) { return c.top.length; }).sort(function (x, y) { return y.ca - x.ca; });
    if (!on.length) return '';
    var cur = on.filter(function (c) { return c.key === top5Cat; })[0] || on[0];
    return '<div class="v2-card pha-card pha-desk"><div class="pha-ch"><h3>Top 10 par catégorie</h3><span class="pha-sub">ses meilleures références, en valeur</span></div>' +
      '<div class="pha-tabs">' + on.map(function (c) { return '<button class="pha-tab' + (c.key === cur.key ? ' on' : '') + '" onclick="V2.pharmaTop5Cat(\'' + c.key + '\')"><span class="ph-tr-dot" style="background:' + c.color + '"></span>' + esc(c.label.replace('Princeps · ', '')) + '</button>'; }).join('') + '</div>' +
      cur.top.map(function (t, i) { return '<div class="pha-r"><i>' + (i + 1) + '</i><span>' + esc(t.designation) + '</span><b class="mono">' + V2.fmtEur(t.ca) + ' <small>· ' + V2.fmtNum(t.qte) + ' u</small></b></div>'; }).join('') +
      '<div class="pha-sub" style="margin-top:6px">' + V2.fmtNum(cur.nbRefs) + ' référence' + (cur.nbRefs > 1 ? 's' : '') + ' commandée' + (cur.nbRefs > 1 ? 's' : '') + ' dans cette catégorie</div></div>';
  }

  // ── « Ne commande plus » (remontée de Florent, 07/10/2026) : ce qu'elle commandait régulièrement et qui
  // manque dans son dernier mois complet. La MÊME règle que la rubrique « Ses achats » du brief
  // (V2.briefOfficine.nePlusCommandes), les mêmes catégories que le Top 10, toutes les lignes.
  var nePlusCat = null;
  V2.pharmaNePlusCat = function (key) { nePlusCat = key; if (!l1MajTout()) V2.render(); };
  function analyseNePlus(pid) {
    if (!V2.briefOfficine || !V2.briefOfficine.nePlusCommandes) return '';
    var ventes = pharmaSalesAll(pid);   // tous commerciaux : le fichier d'un seul inventerait des absences
    if (!ventes.length) return '';
    var np = V2.briefOfficine.nePlusCommandes(ventes), moisFr = V2.briefOfficine.moisFr;
    var carte = function (sous, corps) {
      return '<div class="v2-card pha-card pha-np"><div class="pha-ch"><h3>Ne commande plus</h3><span class="pha-sub">' + sous + '</span></div>' + corps + '</div>';
    };
    if (!np.connu) {
      return carte('ses habitudes interrompues', '<div class="pha-sub">' + (np.avant.length < 4
        ? 'Pas assez de mois de commandes connus pour repérer une habitude.'
        : 'Aucune commande enregistrée en ' + esc(moisFr(np.fin)) + ' : impossible de distinguer un produit abandonné d\'un mois sans commande.') + '</div>');
    }
    var sous = 'commandé au moins 4 mois sur les ' + np.avant.length + ' précédents, absent en ' + esc(moisFr(np.fin));
    var bIdx = benchIndex(), suivi = {}, ca = {}, q = {};
    np.lignes.forEach(function (l) { suivi[l.cip] = 1; });
    ventes.forEach(function (s) { var c = String(s.artCode || ''); if (suivi[c]) { ca[c] = (ca[c] || 0) + (s.mntNetHt || 0); q[c] = (q[c] || 0) + (s.qte || 0); } });
    var parCat = {}, classees = 0;
    np.lignes.forEach(function (l) {
      var b = bIdx.get(l.cip), cat = b ? classify(b, l.cip) : null;
      if (!cat) return;
      var nb = Math.max(1, Object.keys(l.mois).length);
      (parCat[cat] || (parCat[cat] = [])).push({ designation: b.designation || l.cip, mois: l.mois, dernier: l.dernier, caMois: (ca[l.cip] || 0) / nb, qMois: (q[l.cip] || 0) / nb });
      classees++;
    });
    if (!classees) {
      return carte(sous, '<div class="pha-sub">' + (np.lignes.length
        ? V2.fmtNum(np.lignes.length) + ' référence' + (np.lignes.length > 1 ? 's interrompues' : ' interrompue') + ', hors des catégories suivies.'
        : 'Tout ce qu\'elle commandait régulièrement a été recommandé en ' + esc(moisFr(np.fin)) + '.') + '</div>');
    }
    var somme = function (rows) { return rows.reduce(function (t, r) { return t + r.caMois; }, 0); };
    var on = CATS.filter(function (c) { return parCat[c.key]; }).sort(function (x, y) { return somme(parCat[y.key]) - somme(parCat[x.key]); });
    var cur = on.filter(function (c) { return c.key === nePlusCat; })[0] || on[0];
    var rows = parCat[cur.key].sort(function (x, y) { return y.caMois - x.caMois; });
    var frise = np.avant.concat([np.fin]);
    var ligne = function (r, i) {
      return '<div class="pha-r"><i>' + (i + 1) + '</i><span>' + esc(r.designation) +
        '<span class="pha-np-s"><span class="pha-np-m" aria-hidden="true">' + frise.map(function (m) {
          return '<span class="pha-np-d' + (m === np.fin ? ' fin' : (r.mois[m] ? ' on' : '')) + '" title="' + esc(moisFr(m)) + '"></span>';
        }).join('') + '</span>dernière commande : ' + esc(moisFr(r.dernier)) + '</span></span>' +
        '<b class="mono">' + V2.fmtEur(r.caMois) + ' <small>/ mois · ' + V2.fmtNum(Math.round(r.qMois)) + ' u</small></b></div>';
    };
    return carte(sous,
      '<div class="pha-tabs">' + on.map(function (c) { return '<button class="pha-tab' + (c.key === cur.key ? ' on' : '') + '" onclick="V2.pharmaNePlusCat(\'' + c.key + '\')"><span class="ph-tr-dot" style="background:' + c.color + '"></span>' + esc(c.label.replace('Princeps · ', '')) + ' · ' + parCat[c.key].length + '</button>'; }).join('') + '</div>' +
      rows.slice(0, 10).map(ligne).join('') +
      (rows.length > 10 ? '<details class="pha-np-plus"><summary>Voir les ' + (rows.length - 10) + ' autres</summary>' + rows.slice(10).map(function (r, i) { return ligne(r, i + 10); }).join('') + '</details>' : '') +
      '<div class="pha-sub" style="margin-top:6px">' + V2.fmtNum(rows.length) + ' référence' + (rows.length > 1 ? 's interrompues' : ' interrompue') + ' dans cette catégorie · environ ' + V2.fmtEur(somme(rows)) + ' par mois, moyenne des mois commandés' +
        (np.lignes.length > classees ? ' · ' + V2.fmtNum(np.lignes.length - classees) + (np.lignes.length - classees > 1 ? ' autres références interrompues' : ' autre référence interrompue') + ' hors des catégories suivies' : '') +
        ' · <span class="pha-np-m" aria-hidden="true"><span class="pha-np-d on"></span></span> commandé <span class="pha-np-m" aria-hidden="true"><span class="pha-np-d"></span></span> pas commandé <span class="pha-np-m" aria-hidden="true"><span class="pha-np-d fin"></span></span> ' + esc(moisFr(np.fin)) + '</div>');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FICHE « MENU » — maquette 8 retenue par Will (09/10/2026, remplace la 1b jugée « trop complexe »)
  // À gauche : carte d'identité courte + menu de rubriques ; à droite : UNE rubrique à plat
  // (Résumé, À proposer, Commandes, Catégories, Ne commande plus, Meilleurs produits, Fiche, Notes,
  // puis, REPLIÉ, « Tout le détail » : les blocs d'avant, contenu inchangé).
  // Changer de rubrique, de base de comparaison, déplier une catégorie ou passer en vue
  // « À montrer au pharmacien » se fait SUR PLACE (jamais V2.render) : la page ne remonte pas.
  // ══════════════════════════════════════════════════════════════════════════
  var NB = ' ';
  var MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  // État de la fiche affichée. Remis à zéro quand on change d'officine (la vue pharmacien n'est PAS retenue).
  var L1 = { pid: null, A: null, G: null, dataR: null, dataG: null, nom: '', b: 'reseau', ouv: {}, vu: {}, vue: 'commercial', rub: 'resume', ecran: 'liste', tous: { neplus: false, meilleurs: false }, edit: false, k: 0, np: null, marge: 0, hasGrp: false, nR: 0, nG: 0 };

  function l1Nb(n) { return Math.round(n).toLocaleString('fr-FR').replace(/[   ]/g, NB); }
  function l1Eur(n) { return l1Nb(n) + NB + '€'; }
  function l1Pct(n) { return l1Nb(n) + NB + '%'; }
  function l1Moy(arr, i0) { var s = 0, k = 0; for (var i = i0; i < arr.length; i++) { s += arr[i] || 0; k++; } return k ? s / k : 0; }
  function l1MoisAn(mk) { return MOIS_LONG[mk % 12] + ' ' + Math.floor(mk / 12); }
  function l1Pl(n, un, plu) { return n + NB + (n > 1 ? plu : un); }
  function l1Rang(n) { return n === 1 ? '1er' : n + 'e'; }
  // « 2026-05 » → « mai 2026 »
  function l1YmLong(ym) { var p = String(ym || '').split('-'); return p.length < 2 ? String(ym || '') : MOIS_LONG[+p[1] - 1] + ' ' + p[0]; }
  // « de juin à août 2026 », « d’avril à août 2026 » : la fenêtre sur laquelle la moyenne de l'officine est comptée
  function l1De(mois) { return (/^[aeiouéh]/.test(mois) ? 'd’' : 'de ') + mois; }
  function l1Fenetre(A) {
    var a = A.debut, b = A.last; if (!a || !b) return '';
    var ya = Math.floor(a.mk / 12), yb = Math.floor(b.mk / 12);
    return l1De(MOIS_LONG[a.mk % 12] + (ya !== yb ? ' ' + ya : '')) + ' à ' + MOIS_LONG[b.mk % 12] + ' ' + yb;
  }
  // « de janvier à août 2026 » : tous les mois chargés (base des listes à proposer)
  function l1FenetreReseau(A) {
    // les listes se fondent sur TOUS les mois chargés du réseau, pas sur la fenêtre de cette officine
    var tm = networkByCat().months, a = tm[0], b = tm[tm.length - 1]; if (!a || !b) return '';
    var ya = Math.floor(a.mk / 12), yb = Math.floor(b.mk / 12);
    return l1De(MOIS_LONG[a.mk % 12] + (ya !== yb ? ' ' + ya : '')) + ' à ' + MOIS_LONG[b.mk % 12] + ' ' + yb;
  }
  function l1PeriodeMoy(A) { return 'en moyenne par mois, ' + l1Fenetre(A); }
  function l1PeriodeCumul(A) { return 'en cumul sur ' + l1Pl(A.nAct, 'mois', 'mois'); }

  // ── Repère « groupement d'achat » ──
  // Même définition que le réseau : par mois, la moyenne des officines du groupement qui ont commandé
  // CE mois-là (au moins 2). Non proposé si on ne peut pas le compter honnêtement : jeu d'un commercial
  // restreint (le reste du réseau n'y est qu'un total), groupement d'une seule officine, ou un mois de
  // la fenêtre où moins de 2 officines du groupement ont commandé. Jamais un chiffre approché.
  var _l1GrpMemo = { ref: null, par: {} };
  function l1Groupe(pid, A) {
    if (networkByCat().R || !A.nAct) return null;
    var g = groupementPids(pid); if (!g.set || g.set.size < 2) return null;
    if (_l1GrpMemo.ref !== V2.sales) _l1GrpMemo = { ref: V2.sales, par: {} };
    var gcle = g.name + '|' + A.pts.length + '|' + (A.last ? A.last.mk : 0), G = _l1GrpMemo.par[gcle];
    if (!G) {
      var idx = salesIndex(), act = {}, tot = {};
      g.set.forEach(function (p) {
        if (V2.estReste(p)) return;
        var rows = idx[p]; if (!rows) return;
        for (var j = 0; j < rows.length; j++) {
          var s = rows[j]; if (!s.month || !s.year) continue;
          var mk = s.year * 12 + (s.month - 1);
          (act[mk] || (act[mk] = {}))[p] = 1;
          tot[mk] = (tot[mk] || 0) + (s.mntNetHt || 0);
        }
      });
      G = { name: g.name, set: g.set, mks: A.pts.map(function (p) { return p.mk; }), n: [], avg: [], cat: null };
      A.pts.forEach(function (pt, i) {
        var c = act[pt.mk] ? Object.keys(act[pt.mk]).length : 0;
        G.n[i] = c; G.avg[i] = c >= 2 ? tot[pt.mk] / c : null;
      });
      _l1GrpMemo.par[gcle] = G;
    }
    for (var i = A.i0; i < A.n; i++) { if (!(G.n[i] >= 2)) return null; }
    return G;
  }
  // Par catégorie : calculé à la première demande seulement (classer chaque ligne coûte).
  function l1GroupeCats(G) {
    if (G.cat) return G.cat;
    var bIdx = benchIndex(), idx = salesIndex(), sum = {}, pos = {};
    CATS.forEach(function (c) { sum[c.key] = G.mks.map(function () { return 0; }); });
    G.mks.forEach(function (mk, i) { pos[mk] = i; });
    G.set.forEach(function (p) {
      if (V2.estReste(p)) return;
      var rows = idx[p]; if (!rows) return;
      for (var j = 0; j < rows.length; j++) {
        var s = rows[j]; if (!s.month || !s.year) continue;
        var i = pos[s.year * 12 + (s.month - 1)]; if (i == null) continue;
        var cip = String(s.artCode || ''), b = cip ? bIdx.get(cip) : null, cat = b ? classify(b, cip) : null;
        if (cat && sum[cat]) sum[cat][i] += (s.mntNetHt || 0);
      }
    });
    var out = {};
    CATS.forEach(function (c) { out[c.key] = sum[c.key].map(function (v, i) { return G.n[i] >= 2 ? v / G.n[i] : 0; }); });
    return (G.cat = out);
  }
  // Une base de comparaison : « le réseau » ou « son groupement d'achat ».
  function l1Ref(k) {
    var A = L1.A, G = L1.G, grp = (k === 'groupement' && !!G), nom = A.grpName;
    return {
      k: grp ? 'groupement' : 'reseau',
      court: grp ? nom : 'Le réseau',
      long: grp ? 'l’officine moyenne de son groupement d’achat (' + nom + ')' : 'l’officine moyenne du réseau',
      etiq: grp ? 'L’officine moyenne de ' + nom : 'L’officine moyenne du réseau',
      trait: grp ? 'Moyenne de ' + nom : 'Moyenne du réseau',
      que: grp ? nom : 'le réseau',
      serie: grp ? G.avg : A.pts.map(function (p) { return p.net; }),
      moy: grp ? l1Moy(G.avg, A.i0) : A.netMoy,
      catSerie: function (c) { return grp ? l1GroupeCats(G)[c.key] : c.netByM; },
      catMoy: function (c) { return grp ? l1Moy(l1GroupeCats(G)[c.key], A.i0) : c.netMoy; }
    };
  }

  // ── Ce qu'elle ne commande plus : mêmes règles que « Ses achats » du brief et que le bloc replié ──
  function l1NePlus(pid) {
    if (!V2.briefOfficine || !V2.briefOfficine.nePlusCommandes) return null;
    var ventes = pharmaSalesAll(pid); if (!ventes.length) return null;
    var np = V2.briefOfficine.nePlusCommandes(ventes);
    if (!np.connu) return { connu: false, avant: np.avant.length, fin: np.fin, lignes: [] };
    var bIdx = benchIndex(), suivi = {}, ca = {};
    np.lignes.forEach(function (l) { suivi[l.cip] = 1; });
    ventes.forEach(function (s) { var c = String(s.artCode || ''); if (suivi[c]) ca[c] = (ca[c] || 0) + (s.mntNetHt || 0); });
    var lignes = [];
    np.lignes.forEach(function (l) {
      var b = bIdx.get(l.cip), cat = b ? classify(b, l.cip) : null;
      if (!cat) return;
      var nb = Math.max(1, Object.keys(l.mois).length);
      lignes.push({ nom: b.designation || l.cip, cat: cat, dernier: l.dernier, caMois: (ca[l.cip] || 0) / nb });
    });
    lignes.sort(function (x, y) { return y.caMois - x.caMois; });
    return { connu: true, avant: np.avant.length, fin: np.fin, total: np.lignes.length, lignes: lignes };
  }
  function l1CatLabel(key) { for (var i = 0; i < CATS.length; i++) { if (CATS[i].key === key) return CATS[i].label; } return key; }

  // ── Les 5 premiers produits d'une liste, toutes catégories confondues ──
  function l1Premiers(data) {
    var all = []; (data.cats || []).forEach(function (o) { o.rows.forEach(function (r) { all.push({ r: r, cat: o.cat.key }); }); });
    all.sort(function (x, y) { return y.r.sortie - x.r.sortie || y.r.qte - x.r.qte; });
    return all;
  }
  function l1PartDes(r, total) { return total ? Math.min(100, Math.round(r.sortie / total * 100)) : 0; }
  function l1NomProduit(r) { return esc(cap((r.designation || '').toLowerCase())); }

  // ═════════ Rendu « menu » (maquette 8 retenue par Will, 09/10/2026) — préfixe l8- ═════════
  // Une carte d'identité courte, un menu de rubriques à gauche, UNE rubrique à droite, à plat.
  // Aucun calcul ne change : les fonctions de données (analyseData, l1Ref, l1NePlus, listes) servent telles quelles.
  var L8_IC = {
    resume: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    proposer: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
    commandes: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
    categories: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    neplus: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    meilleurs: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z"/>',
    tout: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    chev: '<path d="m9 18 6-6-6-6"/>',
    tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    rdv: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    oeil: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    haut: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>', bas: '<path d="M12 5v14M5.5 12.5 12 19l6.5-6.5"/>',
    pdf: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    excel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    todo: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>', joint: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>', cata: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/>', envoi: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>', ecran: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'
  };
  function l8Ic(k, s) { s = s || 20; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + L8_IC[k] + '</svg>'; }
  // Les rubriques, dans l'ordre du menu. [clé, mot, interne ?]
  var L8_RUB = [['resume', 'Résumé'], ['proposer', 'À proposer'], ['commandes', 'Commandes'], ['categories', 'Catégories'], ['neplus', 'Ne commande plus'], ['meilleurs', 'Meilleurs produits'], ['tout', 'Tout le détail', 1]];
  var L8_PROFIL = [['gros1', 'Grossiste n°1'], ['gros2', 'Grossiste n°2'], ['gros3', 'Grossiste n°3'], ['gros4', 'Grossiste n°4'], ['gen1', 'Génériqueur n°1'], ['gen2', 'Génériqueur n°2'], ['gen3', 'Génériqueur n°3'], ['biosim', 'Partenaire biosimilaires'], ['lgo', 'Logiciel (LGO)'], ['robot', 'Robot / automate'], ['tel_perso', 'Tél perso (titulaire)'], ['cle_crypto', 'Clé de cryptage'], ['autre', 'Autre info']];

  // Écart d'une valeur face à un repère (règle R7) : rapport ≥ 2 → « 6,3 fois plus » ; sinon « + 23 % » / « − 17 % ».
  function l8Ecart(a, ref) {
    if (!(ref > 0)) return null;
    var r = a / ref;
    if (r >= 2) return { t: r.toFixed(1).replace('.', ',') + NB + '<span class="l8-fp">fois' + NB + 'plus</span>', c: 'pha-up', e: (r - 1) * 100, f: 1 };
    var p = Math.round((r - 1) * 100);
    if (p === 0) return { t: 'Égal', c: 'pha-flat', e: 0 };
    return { t: (p < 0 ? '−' : '+') + NB + Math.abs(p) + NB + '%', c: p < 0 ? 'pha-dn' : 'pha-up', e: p };
  }
  function l8Fleche(e) { return e && e.e !== 0 ? l8Ic(e.e < 0 ? 'bas' : 'haut', 16) : ''; }
  function l8Vide(t) { return '<p class="l8-vide">' + t + '</p>'; }
  function l8MoisCourt(mk) { return MOIS_LONG[mk % 12]; }

  // Texte derrière le « ? » (jamais à l'écran en permanence)
  function l8AideBase() {
    var A = L1.A, R = l1Ref(L1.b), t = 'Les écarts se lisent face à ' + R.long + ', ' + l1Fenetre(A) + '.';
    if (A.n >= 2) { var k = Math.min(4, A.n - 1), ex = A.pts[A.n - k]; t += ' Sa moyenne se compte depuis sa première commande : une officine arrivée en ' + MOIS_LONG[ex.mk % 12] + ' est comparée sur ses ' + k + ' mois, pas sur ' + A.n + '.'; }
    return t + ' La moyenne des officines qui ont commandé ce mois-là, toutes régions confondues.';
  }
  function l8Tete(titre, droite, aide) {
    return '<div class="l8-tete"><h2 class="l8-t">' + titre + '</h2><div class="l8-tete-d">' + (droite || '') +
      (aide ? '<button type="button" class="l8-aide" aria-label="Qu’est-ce que c’est ?" aria-expanded="false" onclick="V2.pharmaL.aide(this)"><span aria-hidden="true">?</span></button>' : '') + '</div></div>' +
      (aide ? '<p class="l8-aide-txt" hidden>' + esc(aide) + '</p>' : '');
  }
  // Sélecteur « Face à » : la comparaison se dit UNE fois, ici (R1)
  function l8Face() {
    if (!L1.G) return '<span class="l8-fl">Face à</span><b class="l8-ref">Le réseau</b>';
    var b = function (k, txt) { return '<button type="button" class="l8-seg-b" aria-pressed="' + (L1.b === k ? 'true' : 'false') + '" onclick="V2.pharmaL.base(\'' + k + '\')">' + esc(txt) + '</button>'; };
    return '<span class="l8-fl">Face à</span><div class="l8-seg" role="group" aria-label="Face à">' + b('reseau', 'Le réseau') + b('groupement', L1.A.grpName) + '</div>';
  }

  // Haut de la page « Stats » : le « Face à » et son « ? », écrits UNE fois pour toutes les rubriques
  function l8TeteStats() {
    return '<div class="l8-st-tete"><div class="l8-tete-d">' + l8Face() +
      '<button type="button" class="l8-aide" aria-label="Qu’est-ce que c’est ?" aria-expanded="false" onclick="V2.pharmaL.aide(this)"><span aria-hidden="true">?</span></button></div>' +
      '<p class="l8-aide-txt" hidden>' + esc(l8AideBase()) + '</p></div>';
  }

  // ── Résumé : un grand chiffre, la courbe, trois repères sans cadre
  function l8Resume() {
    var A = L1.A, R = l1Ref(L1.b), last = A.last, prev = A.prev, h = l8Tete('Résumé');
    if (A.nAct === 0) return h + l8Vide('Aucune commande enregistrée pour cette officine.');
    var e = l8Ecart(A.caMoy, R.moy);
    // Le grand chiffre EST l'afficheur de la courbe : au repos la moyenne par mois ; au geste, le montant du mois lu
    h += '<div class="l8-grand"><span class="l8-n"><span id="l8-gv" data-vers="' + Math.round(A.caMoy) + '" data-fmt="n" data-dl="100" data-du="800">' + l1Nb(A.caMoy) + '</span><small>' + NB + '€</small></span><span class="l8-u" id="l8-gu">par mois</span>' +
      '<span class="l8-puce ' + (e ? e.c : 'pha-flat') + '" id="l8-gp"' + (e ? '' : ' hidden') + '>' + (e ? l8Fleche(e) + e.t : '') + '</span></div>';
    h += '<div class="l8-graph" id="l8-graph"></div>';
    var evo = (last && prev && prev.ca > 0) ? l8Ecart(last.ca, prev.ca) : null;
    h += '<div class="l8-reps">' +
      '<div class="l8-rep"><div class="l8-rl">En ' + (last ? l8MoisCourt(last.mk) : '—') + '</div><div class="l8-rv" data-vers="' + Math.round(last ? last.ca : 0) + '" data-dl="250" data-du="700">' + l1Eur(last ? last.ca : 0) + '</div>' +
        '<div class="l8-rt ' + (evo ? evo.c : 'pha-flat') + '">' + (evo ? evo.t + NB + 'sur' + NB + l8MoisCourt(prev.mk) : (prev ? 'Pas de commande en ' + l8MoisCourt(prev.mk) : '')) + '</div></div>' +
      '<div class="l8-rep"><div class="l8-rl">Cumul</div><div class="l8-rv" data-vers="' + Math.round(A.caTot) + '" data-dl="340" data-du="700">' + l1Eur(A.caTot) + '</div><div class="l8-rt pha-flat">sur ' + l1Pl(A.nAct, 'mois', 'mois') + '</div></div>' +
      '<div class="l8-rep" id="l8-rep-place">' + l8PlaceHtml() + '</div>' +
      '</div>';
    return h;
  }
  // Le bloc « Sa place » (se met à jour sur place quand « Face à » change)
  function l8PlaceHtml() {
    var place = l8Place();
    return place ? '<div class="l8-rl">Sa place</div><div class="l8-rv l8-rv-mots">' + place.mots + '</div><div class="l8-rt pha-flat">' + place.sous + '</div>' +
      '<div class="l8-rt l8-interne">' + place.rang + '</div>' : '';
  }
  // Sa place : en mots (tiers) ; le rang chiffré est interne
  function l8Place() {
    var A = L1.A, grp = (L1.b === 'groupement' && A.grpRank && A.nGrp > 1 && A.grpName);
    var rang = grp ? A.grpRank : A.rank, tot = grp ? A.nGrp : A.nOff;
    if (!rang || !tot) return null;
    var t = rang / tot, mots = t <= 1 / 3 ? 'Premier tiers' : (t <= 2 / 3 ? 'Deuxième tiers' : 'Dernier tiers');
    return { mots: mots, sous: grp ? 'de son groupement' : 'du réseau', rang: 'Rang : <span class="mono">' + l1Rang(rang) + '</span> sur <span class="mono">' + l1Nb(tot) + '</span>' };
  }

  // ── À proposer : les deux listes (réseau, groupement d'achat) côte à côte, chacune avec ses actions
  function l8Proposer() {
    var A = L1.A, pid = String(L1.pid).replace(/[^0-9A-Za-z_-]/g, '');
    var cols = [['reseau', 'Le réseau', L1.dataR, L1.nR]];
    if (L1.hasGrp) cols.push(['groupement', A.grpName, L1.dataG, L1.nG]);
    var aide = L1.hasGrp
      ? 'Deux listes, chacune fondée sur ce que commandent les officines de sa base : celles du réseau, et celles de ' + A.grpName + ', ' + l1FenetreReseau(A) + '. Le pourcentage est la part des officines qui commandent le produit.'
      : 'Fondée sur ce que commandent les officines du réseau, ' + l1FenetreReseau(A) + '. Le pourcentage est la part des officines qui commandent le produit.';
    var voir = V2.pages.produits ? '<button type="button" class="l8-btn l8-btn-pri" aria-label="Voir la liste à l’écran" onclick="V2.go(\'produits\', \'' + pid + '\')">' + l8Ic('ecran', 18) + 'Voir</button>' : '';
    var h = l8Tete('À proposer', voir, aide) + '<div class="l8-2l' + (cols.length > 1 ? ' l8-2l-deux' : '') + '">';
    cols.forEach(function (c) {
      var sc = c[0], data = c[2], n = c[3];
      h += '<div class="l8-liste"><h3 class="l8-lnom">' + esc(c[1]) + '</h3>';
      if (n <= 0) { h += l8Vide('Rien à lui proposer sur cette base.') + '</div>'; return; }
      h += '<div class="l8-pcompte"><div class="l8-pn">' + l1Nb(n) + '<small>produits</small></div><div class="l8-pacts">' +
        '<button type="button" class="l8-btn l8-interne" aria-label="Télécharger la liste en PDF : ' + esc(c[1]) + '" onclick="V2.pharmaListPdf(\'' + pid + '\',\'' + sc + '\')">' + l8Ic('pdf', 18) + 'PDF</button>' +
        '<button type="button" class="l8-btn l8-interne" aria-label="Télécharger la liste en Excel : ' + esc(c[1]) + '" onclick="V2.pharmaListXlsx(\'' + pid + '\',\'' + sc + '\')">' + l8Ic('excel', 18) + 'Excel</button>' +
        '<button type="button" class="l8-btn l8-interne" aria-label="Envoyer la liste au pharmacien : ' + esc(c[1]) + '" onclick="V2.pharmaTransmettre(\'' + pid + '\',[\'L:' + sc + '\'])">' + l8Ic('envoi', 18) + 'Envoyer</button></div></div>';
      h += '<div class="l8-ctete l8-ctete-d">Part des officines qui le commandent</div>';
      l1Premiers(data).slice(0, 5).forEach(function (x, k) {
        var p = l1PartDes(x.r, data.total);
        h += '<div class="l8-lg"><span class="l8-ln">' + l1NomProduit(x.r) + '<small>' + esc(l1CatLabel(x.cat)) + '</small></span><span class="l8-pbar" aria-hidden="true"><i style="--w:' + l8Fin(p / 100) + ';--i:' + l8Cran(k) + '"></i></span><span class="l8-lm">' + l1Pct(p) + '</span></div>';
      });
      h += '</div>';
    });
    return h + '</div>';
  }

  // ── Commandes : mois par mois, ce qui bouge, répartition
  function l8Commandes() {
    var A = L1.A, R = l1Ref(L1.b), h = l8Tete('Commandes');
    if (A.nAct === 0) return h + l8Vide('Aucune commande enregistrée pour cette officine.');
    h += '<div class="l8-ctete l8-lu"><span>Par mois</span><span class="l8-lv" id="l8-lu" aria-hidden="true"></span></div><div class="l8-cmd" id="l8-cmd"></div>';
    var last = A.last, prev = A.prev;
    if (last && prev) {
      var lignes = [];
      if (prev.ca > 0) lignes.push({ nom: 'Au total', a: last.ca, p: prev.ca });
      lignes = lignes.concat(A.cats.map(function (c) { return { nom: c.label, a: c.caByM[A.n - 1], p: c.caByM[A.n - 2] }; })
        .filter(function (x) { return x.a > 0 && x.p > 0; }).sort(function (x, y) { return Math.abs(y.a - y.p) - Math.abs(x.a - x.p); }).slice(0, 2));
      h += '<div class="l8-sst"><h3>Ce qui bouge</h3><span>en ' + l8MoisCourt(last.mk) + ', face à ' + l8MoisCourt(prev.mk) + '</span></div>';
      if (!lignes.length) h += l8Vide('Aucune commande en ' + esc(l1MoisAn(prev.mk)) + ' : rien à comparer.');
      lignes.forEach(function (x) {
        var e = l8Ecart(x.a, x.p), haut = x.a >= x.p;
        h += '<div class="l8-bouge"><span class="l8-f ' + (haut ? 'h' : 'b') + '">' + l8Ic(haut ? 'haut' : 'bas', 18) + '</span><span class="l8-bn">' + esc(x.nom) + '</span><span class="l8-bv ' + e.c + '">' + e.t + '</span></div>';
      });
    }
    if (A.caTot > 0) {
      var tri = A.cats.filter(function (c) { return c.ca > 0; }).sort(function (a, b) { return b.ca - a.ca; });
      var tete3 = tri.slice(0, 3), somme = tete3.reduce(function (s, c) { return s + c.ca; }, 0);
      var rows = tete3.map(function (c) { return { n: c.label, v: c.ca }; });
      if (A.caTot - somme > 0.5) rows.push({ n: 'Les autres', v: A.caTot - somme });
      h += '<div class="l8-sst"><h3>Répartition</h3><span>' + esc(l1PeriodeCumul(A)) + '</span></div>';
      rows.forEach(function (x, k) {
        var p = Math.max(0, Math.min(100, Math.round(x.v / A.caTot * 100)));
        h += '<div class="l8-lg"><span class="l8-ln">' + esc(x.n) + '</span><span class="l8-pbar" aria-hidden="true"><i style="--w:' + l8Fin(p / 100) + ';--i:' + l8Cran(k) + '"></i></span><span class="l8-lm">' + l1Pct(p) + '</span></div>';
      });
    }
    h += '<div class="l8-lg l8-interne"><span class="l8-ln">Marge nette</span><span class="l8-lm">' + l1Eur(L1.marge) + '</span><span class="l8-lg-g">' + esc(l1PeriodeCumul(A)) + '</span></div>';
    return h;
  }

  // ── Catégories : une ligne par catégorie (montant par mois, barre, écart) ; le détail se déplie sur place
  function l8Categories() {
    var A = L1.A, R = l1Ref(L1.b), pres = [], abs = [], h = l8Tete('Catégories');
    A.cats.forEach(function (c) {
      var ref = R.catMoy(c);
      if (c.ca > 0) pres.push({ c: c, ref: ref, e: l8Ecart(c.moy, ref) });
      else if (ref > 0) abs.push({ c: c, ref: ref });
    });
    pres.sort(function (x, y) { return (y.e ? y.e.e : -1e9) - (x.e ? x.e.e : -1e9); });
    if (!pres.length && !abs.length) return h + l8Vide('Aucune commande enregistrée pour cette officine.');
    h += '<div class="l8-ctete">Par mois</div>';
    var rang = 0;
    var ligne = function (x, absente) {
      var k = x.c.key, ouv = !!L1.ouv[k], e = x.e, mini = '<span class="l8-mini' + (absente ? ' abs' : '') + '" data-mini="' + k + '" style="--i:' + l8Cran(rang++) + '"></span>';
      var mil = absente ? '<span class="l8-cm l8-cabs">Absente</span>' + mini + '<span class="l8-ce"></span>'
        : '<span class="l8-cm">' + l1Eur(x.c.moy) + '</span>' + mini + (e ? '<span class="l8-ce"><span class="l8-pastille ' + e.c + '">' + e.t + '</span></span>' : '<span class="l8-ce l8-cabs">Sans repère</span>');
      return '<div class="l8-cat"><button type="button" class="l8-crow" aria-expanded="' + (ouv ? 'true' : 'false') + '" onclick="V2.pharmaL.cat(\'' + k + '\')"><span class="l8-cn">' + esc(x.c.label) + '</span><span class="l8-cinf">' + mil + '</span><span class="l8-cc">' + l8Ic('chev', 18) + '</span></button>' +
        '<div class="l8-detail" id="l8-d-' + k + '"' + (ouv ? '' : ' hidden') + '></div></div>';
    };
    pres.forEach(function (x) { h += ligne(x, false); });
    abs.forEach(function (x) { h += ligne(x, true); });
    return h;
  }

  // ── Ne commande plus
  function l8NePlus() {
    var np = L1.np, A = L1.A, n = (np && np.connu) ? np.lignes.length : 0;
    var aide = n ? l1Pl(n, 'produit', 'produits') + ' commandé' + (n > 1 ? 's' : '') + ' au moins 4 mois sur les ' + np.avant + ' précédents, et absent' + (n > 1 ? 's' : '') + ' en ' + l1YmLong(np.fin) + '.' : '';
    var h = l8Tete('Ne commande plus', n ? '<span class="l8-cnt">' + n + '</span>' : '', aide);
    if (!np) return h + l8Vide('Pas de commandes connues pour repérer une habitude interrompue.');
    if (!np.connu) return h + l8Vide(np.avant < 4 ? 'Pas assez de mois de commandes connus pour repérer une habitude.' : 'Aucune commande enregistrée en ' + esc(l1YmLong(np.fin)) + ' : impossible de distinguer un produit abandonné d’un mois sans commande.');
    if (!n) return h + l8Vide('Tout ce qu’elle commandait régulièrement a été recommandé en ' + esc(l1YmLong(np.fin)) + '.');
    h += '<div class="l8-ctete l8-ctete-d">Dernière commande</div>';
    // la frise couvre les mois de la période ; chaque produit y est posé au mois de son dernier achat (le texte « depuis… » reste)
    var mois = l8Mois().pts, N = mois.length;
    h += '<div class="l8-lg l8-fz l8-fzt" aria-hidden="true"><span class="l8-ln"></span><span class="l8-frz" data-lab="1"></span><span class="l8-lg-g"></span></div>';
    np.lignes.slice(0, L1.tous.neplus ? n : 6).forEach(function (q, k) {
      var ym = String(q.dernier).split('-'), mk = (+ym[0]) * 12 + (+ym[1] - 1), idx = -1;
      mois.forEach(function (p, j) { if (p.mk === mk) idx = j; });
      if (idx < 0) idx = mk < mois[0].mk ? 0 : N - 1;
      h += '<div class="l8-lg l8-fz"><span class="l8-ln">' + esc(q.nom) + '<small>' + esc(l1CatLabel(q.cat)) + '</small></span><span class="l8-frz" data-mi="' + idx + '" style="--i:' + l8Cran(k) + '" role="img" aria-label="' + esc(q.nom) + ' : dernière commande en ' + esc(l1YmLong(q.dernier)) + '"></span><span class="l8-lg-g">' + esc(l1YmLong(q.dernier)) + '</span></div>';
    });
    if (n > 6) h += '<div class="l8-plus"><button type="button" class="l8-lien" onclick="V2.pharmaL.plus(\'neplus\')">' + (L1.tous.neplus ? 'Réduire' : 'Voir les ' + n) + '</button></div>';
    return h;
  }

  // ── Meilleurs produits : 5, puis « Voir les 10 »
  function l8TopTous() {
    var tous = [];
    L1.A.cats.forEach(function (c) { (c.top || []).forEach(function (t) { tous.push({ nom: t.designation, ca: t.ca, qte: t.qte, label: c.label }); }); });
    tous.sort(function (a, b) { return b.ca - a.ca; });
    return tous.slice(0, 10);
  }
  function l8Top() {
    var A = L1.A, tous = l8TopTous(), aide = cap(l1PeriodeCumul(A)) + ', ' + l1Fenetre(A) + '.';
    var h = l8Tete('Meilleurs produits', '<span class="l8-dr">sur ' + l1Pl(A.nAct, 'mois', 'mois') + '</span>', aide);
    if (!tous.length) return h + l8Vide('Aucun produit classé dans ses commandes.');
    var max = tous[0].ca || 1;
    tous.slice(0, L1.tous.meilleurs ? 10 : 5).forEach(function (t, k) {
      h += '<div class="l8-lg"><span class="l8-ln">' + esc(t.nom) + '<small>' + esc(t.label) + ' · ' + l1Nb(t.qte) + NB + 'boîte' + (t.qte > 1 ? 's' : '') + '</small></span><span class="l8-pbar" aria-hidden="true"><i style="--w:' + l8Fin(Math.max(0, Math.min(1, t.ca / max))).toFixed(3) + ';--i:' + l8Cran(k) + '"></i></span><span class="l8-lm l8-lm-l">' + l1Eur(t.ca) + '</span></div>';
    });
    if (tous.length > 5) h += '<div class="l8-plus"><button type="button" class="l8-lien" onclick="V2.pharmaL.plus(\'meilleurs\')">' + (L1.tous.meilleurs ? 'Réduire' : 'Voir les ' + tous.length) + '</button></div>';
    return h;
  }

  // ═══ La courbe qu'on parcourt (maquette 10a retenue par Will, 10/10/2026) — préfixe l8- ═══
  // Seul le DESSIN des chiffres change. Les séries sont celles que la fiche affiche déjà (A.pts à partir de A.i0, l1Ref).
  // L'arrivée est écrite en @keyframes et pilotée par une horloge (L1.vu[rubrique] = instant d'entrée à l'écran) : la fiche
  // est redessinée plusieurs fois après l'ouverture ; une rubrique déjà vue reprend là où elle en était (retard négatif --l8t).
  var L8_CH = {};
  var L8_DUREE = 1500;     // au-delà, une rubrique est construite à l'état final, sans classe
  function l8Calme() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function l8F1(v) { return String(Math.round(l8Fin(v) * 10) / 10); }
  // Largeur réelle d'un conteneur, arrondie vers le bas : le dessin n'est jamais réduit, aucun texte ne passe sous 13 px à l'écran
  function l8Larg(el, defaut) { var w = el ? Math.floor(el.getBoundingClientRect().width) : 0; return w > 0 ? w : defaut; }
  function l8Fin(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function l8Cran(k) { return Math.min(k, 8); }          // cascade plafonnée à 8 crans
  function l8Ease(t) { return 1 - Math.pow(1 - t, 3); }
  // interpolation par requestAnimationFrame (mouvement réduit : état final tout de suite)
  function l8Tween(dur, fn, fin) {
    if (l8Calme() || dur <= 0) { fn(1); if (fin) fin(); return { stop: function () {} }; }
    var stop = false, t0 = null;
    function pas(ts) {
      if (stop) return;
      if (t0 === null) t0 = ts;
      var t = (ts - t0) / dur;
      if (t >= 1) { fn(1); if (fin) fin(); return; }
      fn(l8Ease(t)); requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
    return { stop: function () { stop = true; } };
  }
  // Une série lisible : jamais de NaN, jamais de null
  function l8Serie(a) { return (a || []).map(l8Fin); }
  // courbe lissée, interpolation monotone (Fritsch-Carlson) : jamais de bosse inventée
  function l8Lisse(P) {
    var n = P.length, d = [], m = [], i;
    if (!n) return '';
    var p = 'M' + l8F1(P[0][0]) + ' ' + l8F1(P[0][1]);
    if (n < 2) return p;
    for (i = 0; i < n - 1; i++) d[i] = (P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    for (i = 0; i < n - 1; i++) {
      var dx = (P[i + 1][0] - P[i][0]) / 3;
      p += 'C' + l8F1(P[i][0] + dx) + ' ' + l8F1(P[i][1] + m[i] * dx) + ' ' + l8F1(P[i + 1][0] - dx) + ' ' + l8F1(P[i + 1][1] - m[i + 1] * dx) + ' ' + l8F1(P[i + 1][0]) + ' ' + l8F1(P[i + 1][1]);
    }
    return p;
  }
  // pas de graduation : des graduations rondes (1, 2, 2,5, 3, 4, 5 × 10^k), le plus près possible de trois sous la hauteur maximale
  function l8Pas3(haut) {
    var h = Math.max(haut, 1), p = Math.pow(10, Math.floor(Math.log(h / 3) / Math.LN10)), c = [1, 2, 2.5, 3, 4, 5, 10, 20, 25], best = null, dist = 9;
    for (var i = 0; i < c.length; i++) {
      var n = Math.floor(h / (c[i] * p)), d = Math.abs(n - 3);
      if (n >= 1 && (!best || d < dist || (d === dist && n > best.n))) { best = { s: c[i] * p, n: n }; dist = d; }
    }
    return best ? Math.max(1, best.s) : h;
  }
  // texte sans balise (descriptions lisibles) : l'écart se dit « − 12 % », « 6,3 fois plus »
  function l8Txt(e) { return e ? e.t.replace(/<[^>]+>/g, '') : ''; }
  var l8FmtE = function (v) { return l1Eur(v); }, l8FmtN = function (v) { return l1Nb(v); };

  // L'horloge des animations (celle de la page, figée pendant une longue tâche) : un retard calculé avec elle reste exact
  // même si la fiche met un moment à se construire ; l'heure de l'ordinateur compterait deux fois ce temps.
  function l8Now() { var t = document.timeline && document.timeline.currentTime; return t == null ? performance.now() : t; }
  // ── L'horloge. Une rubrique pas encore vue reste à son état de départ (l8-av) ; vue depuis moins de 1,5 s elle reprend où elle
  // en était (l8-lit + retard négatif) ; au-delà elle est à l'état final, sans classe. nu = état final, sans mouvement.
  function l8Etat(k, nu) {
    var s = document.getElementById('l8-v-' + k); if (!s) return null;
    s.classList.remove('l8-av', 'l8-lit'); s.style.removeProperty('--l8t'); clearTimeout(s._ft);
    if (l8Calme() || nu) return s;
    var t0 = L1.vu[k];
    if (t0 == null) { s.classList.add('l8-av'); return s; }
    var dt = l8Now() - t0;
    if (dt < L8_DUREE) {
      s.classList.add('l8-lit'); s.style.setProperty('--l8t', (-Math.round(dt)) + 'ms');
      s._ft = setTimeout(function () { s.classList.remove('l8-lit'); s.style.removeProperty('--l8t'); }, L8_DUREE - dt + 60);
    }
    return s;
  }
  // Un dessin refait dans une rubrique en cours de lecture : SEUL le nouvel élément reçoit son retard (le temps déjà écoulé).
  // On ne change jamais le retard d'une animation qui tourne déjà : elle sauterait en avant du temps écoulé.
  function l8Cadre(el, k) {
    if (!el) return;
    var s = document.getElementById('l8-v-' + k), t0 = L1.vu[k];
    if (s && s.classList.contains('l8-lit') && t0 != null) el.style.setProperty('--l8t', (-Math.round(l8Now() - t0)) + 'ms'); else el.style.removeProperty('--l8t');
  }
  // un nombre qui compte vers sa valeur sur la même horloge (largeur figée avant de partir, chiffres tabulaires)
  function l8Compteurs(k) {
    var s = document.getElementById('l8-v-' + k); if (!s || l8Calme()) return;
    Array.prototype.forEach.call(s.querySelectorAll('[data-vers]'), function (el) {
      var vers = l8Fin(el.getAttribute('data-vers')), fmt = el.getAttribute('data-fmt') === 'n' ? l8FmtN : l8FmtE, fin = fmt(vers);
      var dl = l8Fin(el.getAttribute('data-dl')), dur = l8Fin(el.getAttribute('data-du')) || 700, t0 = L1.vu[k];
      if (t0 != null && l8Now() - t0 >= dl + dur) { el.textContent = fin; return; }
      if (!el.style.minWidth) { if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block'; el.style.minWidth = el.offsetWidth + 'px'; }
      el.textContent = fmt(0);
      if (t0 == null) return;
      (function pas() {
        if (!el.isConnected || el._stop) return;
        var t = (l8Now() - L1.vu[k] - dl) / dur;
        if (t >= 1) { el.textContent = fin; return; }
        el.textContent = fmt(Math.round(vers * l8Ease(Math.max(0, t)))); requestAnimationFrame(pas);
      })();
    });
  }
  // la rubrique entre à l'écran : l'horloge démarre (une seule fois par officine)
  var _l8Obs = null;
  function l8Lancer(k) {
    if (L1.vu[k] != null) return;
    L1.vu[k] = l8Now(); l8Etat(k); l8Compteurs(k);
  }
  function l8Observer() {
    if (_l8Obs) { _l8Obs.disconnect(); _l8Obs = null; }
    var ks = Object.keys(L8_F).filter(function (k) { return L1.vu[k] == null; });
    if (!ks.length) return;
    if (l8Calme() || !('IntersectionObserver' in window)) { ks.forEach(function (k) { L1.vu[k] = l8Now() - L8_DUREE; }); return; }
    _l8Obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { _l8Obs.unobserve(e.target); l8Lancer(e.target.getAttribute('data-k')); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    ks.forEach(function (k) { var s = document.getElementById('l8-v-' + k); if (s) _l8Obs.observe(s); });
  }

  // grand chiffre qui glisse d'une valeur à l'autre (lecture du mois survolé)
  function l8Glisse(el, vers, dur) {
    if (!el) return;
    el._stop = 1;
    var de = el._v == null ? vers : el._v; el._v = vers;
    if (el._tw) el._tw.stop();
    el._tw = l8Tween(dur, function (t) { el.textContent = l1Nb(de + (vers - de) * t); }, function () { el.textContent = l1Nb(vers); });
  }

  // ── axe vertical : 0 sur la ligne de base, puis trois graduations rondes en euros, dans la gouttière de gauche
  function l8Axe(W, pl, pr, top, s, Y) {
    var y0 = Y(0).toFixed(1), h = '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y0 + '" y2="' + y0 + '" stroke="rgba(16,19,28,.16)"/>' +
      '<text class="l8-ax" x="' + (pl - 10) + '" y="' + (Y(0) + 4.5).toFixed(1) + '" text-anchor="end">0</text>';
    for (var k = 1; k * s <= top; k++) {
      var y = Y(k * s).toFixed(1);
      h += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(16,19,28,.07)" stroke-dasharray="2 5"/>' +
        '<text class="l8-ax" x="' + (pl - 10) + '" y="' + (Number(y) + 4.5).toFixed(1) + '" text-anchor="end">' + l1Eur(k * s) + '</text>';
    }
    return h;
  }
  // gouttières du dessin : à gauche de quoi écrire la plus grande graduation, à droite de quoi nommer le repère (jamais coupé)
  function l8Marges(W, top, s, nom) {
    var tx = ''; for (var k = 1; k * s <= top; k++) tx = l1Eur(k * s);
    var pl = Math.max(W > 560 ? 64 : 54, Math.ceil(tx.length * 7.8) + 18), cap = W > 560 ? 150 : 112;
    var long = nom ? Math.min(cap, Math.ceil(nom.length * 8) + 26) : 14;
    return { pl: pl, pr: Math.max(W > 560 ? 96 : 76, long) };
  }
  function l8Court(nom, pr) { var m = Math.max(4, Math.floor((pr - 24) / 8)); return nom.length > m ? nom.slice(0, m - 1) + '…' : nom; }

  // ── la courbe : o = { id, W, H, ser, ref, refTout, nom, desc, labs }. Échelle 1 : 1 (le SVG a la largeur réelle de son conteneur).
  // Une seule valeur (1 mois) : un point, pas de ligne. Repère absent ou nul : pas de ligne de repère.
  function l8Tracer(o) {
    var W = o.W, H = o.H, ser = l8Serie(o.ser), ref = l8Serie(o.ref), N = ser.length, id = o.id;
    var refOk = ref.some(function (v) { return v > 0; });
    var mx = Math.max.apply(null, ser.concat(l8Serie(o.refTout), refOk ? ref : [], [1])), top = mx * 1.04, s = l8Pas3(top);
    var mg = l8Marges(W, top, s, refOk ? (o.nomMax || o.nom) : ''), pl = mg.pl, pr = mg.pr, pt = 14, pb = 32;
    var X = function (i) { return N > 1 ? pl + (W - pl - pr) * i / (N - 1) : pl + (W - pl - pr) / 2; }, Y = function (v) { return pt + (H - pt - pb) * (1 - v / top); };
    var P = ser.map(function (v, i) { return [X(i), Y(v)]; }), R = ref.map(function (v, i) { return [X(i), Y(v)]; });
    L8_CH[id] = { id: id, W: W, H: H, pl: pl, pr: pr, pt: pt, N: N, X: X, Y: Y, ser: ser, ref: ref.slice(), refOk: refOk, nom: o.nom, desc: o.desc, labs: o.labs, top: top };
    var d = l8Lisse(P), yb = Y(0), pas = W < 540 ? 2 : 1, lab = '', i;
    for (i = (N - 1) % pas; i < N; i += pas) lab += '<text class="l8-mo" data-i="' + i + '" x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (N === 1 ? 'middle' : i === 0 ? 'start' : i === N - 1 ? 'end' : 'middle') + '">' + esc(o.labs[i]) + '</text>';
    var aire = N > 1 ? '<path class="l8-aire" d="' + d + 'L' + X(N - 1).toFixed(1) + ' ' + yb.toFixed(1) + 'L' + X(0).toFixed(1) + ' ' + yb.toFixed(1) + 'Z" fill="url(#l8-ga-' + id + ')"/>' : '';
    var trait = N > 1 ? '<path class="l8-halo" pathLength="1" d="' + d + '" fill="none" stroke="#0050E6" stroke-opacity=".10" stroke-width="10" stroke-linecap="round"/>' +
      '<path class="l8-ligne" pathLength="1" d="' + d + '" fill="none" stroke="url(#l8-gl-' + id + ')" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' : '';
    var rp = refOk ? '<path class="l8-ref" d="' + (N > 1 ? l8Lisse(R) : 'M' + (X(0) - 10).toFixed(1) + ' ' + R[0][1].toFixed(1) + 'h20') + '" fill="none" stroke="#8591AC" stroke-width="2.5" stroke-linecap="round"/>' +
      '<text class="l8-refnom" x="' + (X(N - 1) + (N > 1 ? 15 : 20)).toFixed(1) + '" y="' + (R[N - 1][1] + 4.5).toFixed(1) + '">' + esc(l8Court(o.nom, pr)) + '</text>' : '';
    return '<svg class="l8-tr" id="l8-s-' + id + '" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" tabindex="0" aria-label="' + esc(o.desc) + '">' +
      '<defs><linearGradient id="l8-ga-' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0050E6" stop-opacity=".30"/><stop offset=".55" stop-color="#2A6AF0" stop-opacity=".10"/><stop offset="1" stop-color="#2A6AF0" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="l8-gl-' + id + '" gradientUnits="userSpaceOnUse" x1="' + pl + '" y1="0" x2="' + (W - pr) + '" y2="0"><stop offset="0" stop-color="#2A6AF0"/><stop offset=".6" stop-color="#0050E6"/><stop offset="1" stop-color="#0034A0"/></linearGradient></defs>' +
      l8Axe(W, pl, pr, top, s, Y) + aire + rp + trait +
      '<g class="l8-fin" transform="translate(' + X(N - 1).toFixed(1) + ' ' + P[N - 1][1].toFixed(1) + ')"><circle class="l8-puls" r="7" fill="#0050E6"/><circle class="l8-dot" r="6.5" fill="#0050E6" stroke="#fff" stroke-width="2.5"/></g>' +
      '<g class="l8-curs"><line class="l8-rule" x1="0" x2="0" y1="' + pt + '" y2="' + yb.toFixed(1) + '" stroke="#0050E6" stroke-opacity=".35" stroke-width="1.5"/>' +
      (refOk ? '<g class="l8-p2"><circle r="5" fill="#fff" stroke="#8591AC" stroke-width="2.5"/></g>' : '') +
      '<g class="l8-p1"><circle r="14" fill="#0050E6" fill-opacity=".14"/><circle r="6.5" fill="#0050E6" stroke="#fff" stroke-width="3"/></g></g>' +
      lab + '<rect class="l8-zone" x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff" fill-opacity="0"/></svg>';
  }

  // ── le geste : survol, doigt ou flèches parcourent les mois ; cb = { actif(i), repos(), texte(i) }. Rend l'interface du graphique.
  function l8Lier(id, cb) {
    var svg = document.getElementById('l8-s-' + id), ch = L8_CH[id]; if (!svg || !ch) return null;
    var zone = svg.querySelector('.l8-zone'), curs = svg.querySelector('.l8-curs'), rule = svg.querySelector('.l8-rule'), p1 = svg.querySelector('.l8-p1'), p2 = svg.querySelector('.l8-p2');
    var labs = svg.querySelectorAll('.l8-mo'), refp = svg.querySelector('.l8-ref'), refn = svg.querySelector('.l8-refnom'), act = -1, tm = null, tr = null, N = ch.N;
    var px = function (a, b) { return 'translate(' + a.toFixed(1) + 'px,' + b.toFixed(1) + 'px)'; };
    function mettre(i) {
      clearTimeout(tm);
      var x = ch.X(i), neuf = act < 0;
      if (neuf) curs.classList.add('nt');
      rule.style.transform = px(x, 0); p1.style.transform = px(x, ch.Y(ch.ser[i])); if (p2) p2.style.transform = px(x, ch.Y(ch.ref[i]));
      if (neuf) { void svg.getBoundingClientRect(); curs.classList.remove('nt'); curs.classList.add('on'); }
      act = i;
      Array.prototype.forEach.call(labs, function (t) { t.classList.toggle('on', Number(t.getAttribute('data-i')) === i); });
      svg.setAttribute('aria-label', cb.texte(i));
      cb.actif(i);
    }
    function repos() {
      clearTimeout(tm); if (act < 0) return;
      act = -1; curs.classList.remove('on');
      Array.prototype.forEach.call(labs, function (t) { t.classList.remove('on'); });
      svg.setAttribute('aria-label', ch.desc);
      cb.repos();
    }
    function indice(e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * ch.W / (r.width || ch.W);
      if (N < 2) return 0;
      return Math.max(0, Math.min(N - 1, Math.round((x - ch.pl) / (ch.W - ch.pl - ch.pr) * (N - 1))));
    }
    zone.addEventListener('pointerdown', function (e) { mettre(indice(e)); });
    zone.addEventListener('pointermove', function (e) { var i = indice(e); if (i !== act) mettre(i); });
    zone.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') repos(); });
    ['pointerup', 'pointercancel'].forEach(function (n) { zone.addEventListener(n, function (e) { if (e.pointerType === 'touch') { clearTimeout(tm); tm = setTimeout(repos, 1600); } }); });
    svg.addEventListener('keydown', function (e) {
      var k = e.key, i = act < 0 ? N - 1 : act;
      if (k === 'ArrowLeft') i = Math.max(0, i - 1); else if (k === 'ArrowRight') i = Math.min(N - 1, i + 1);
      else if (k === 'Home') i = 0; else if (k === 'End') i = N - 1;
      else if (k === 'Escape') { repos(); return; } else return;
      e.preventDefault(); mettre(i);
    });
    svg.addEventListener('blur', repos);
    // « Face à » : le repère GLISSE vers sa nouvelle position en 350 ms (l'échelle verticale ne bouge pas)
    ch.api = {
      indice: function () { return act; },
      aller: mettre,
      setRef: function (neuf, nom, desc) {
        var de = ch.ref.slice(); ch.desc = desc; if (act < 0) svg.setAttribute('aria-label', desc);
        neuf = l8Serie(neuf);
        if (refn) refn.textContent = l8Court(nom, ch.pr);
        if (tr) tr.stop();
        if (!refp) { ch.ref = neuf; return; }
        tr = l8Tween(350, function (t) {
          ch.ref = de.map(function (v, i) { return v + (neuf[i] - v) * t; });
          var R = ch.ref.map(function (v, i) { return [ch.X(i), ch.Y(v)]; });
          refp.setAttribute('d', N > 1 ? l8Lisse(R) : 'M' + (ch.X(0) - 10).toFixed(1) + ' ' + R[0][1].toFixed(1) + 'h20');
          if (refn) refn.setAttribute('y', (R[N - 1][1] + 4.5).toFixed(1));
          if (act >= 0 && p2) p2.style.transform = px(ch.X(act), ch.Y(ch.ref[act]));
        });
      }
    };
    return ch.api;
  }

  // ── Les séries de la période (celles de L1.A, rien n'est recalculé) et les deux repères
  function l8Mois() {
    var pts = L1.A.pts.slice(L1.A.i0);
    return { pts: pts, N: pts.length, ser: pts.map(function (p) { return l8Fin(p.ca); }), labs: pts.map(function (p) { return p.label; }) };
  }
  function l8RefSerie(R) { return L1.A.pts.slice(L1.A.i0).map(function (p, i) { return l8Fin(R.serie[L1.A.i0 + i]); }); }
  // L'échelle verticale est calée sur le maximum de l'officine ET des deux repères : « Face à » ne la fait pas bouger
  function l8RefTout() {
    var t = l8RefSerie(l1Ref('reseau'));
    if (L1.G) t = t.concat(l8RefSerie(l1Ref('groupement')));
    return t;
  }
  // La gouttière du nom du repère se calcule sur le plus long des deux noms : « Face à » ne la fait pas bouger, aucun nom n'est coupé en route
  function l8NomMax() { var a = l1Ref('reseau').court, b = L1.G ? l1Ref('groupement').court : ''; return b.length > a.length ? b : a; }
  function l8Desc(R, quoi) { return quoi + ', face à ' + R.long + '. Flèches gauche et droite pour parcourir les mois.'; }
  function l8Puce(p, e) {
    if (!p) return;
    if (!e) { p.hidden = true; return; }
    p.hidden = false; p.className = (p.className.indexOf('l8-cpuce') >= 0 ? 'l8-puce l8-cpuce ' : 'l8-puce ') + e.c; p.innerHTML = l8Fleche(e) + e.t;
  }

  // ── Résumé : le grand chiffre est l'afficheur, la courbe est la pièce maîtresse
  function l8CourbeResume(W) {
    var R = l1Ref(L1.b), m = l8Mois();
    return l8Tracer({ id: 'cr', W: W, H: W > 560 ? 290 : 188, ser: m.ser, ref: l8RefSerie(R), refTout: l8RefTout(), nom: R.court, nomMax: l8NomMax(), labs: m.labs, desc: l8Desc(R, 'Ce qu’elle commande chaque mois') });
  }
  function l8LierResume() {
    var gv = document.getElementById('l8-gv'), ch = L8_CH.cr; if (!gv || !ch) return;
    gv._v = Math.round(L1.A.caMoy);
    var u = document.getElementById('l8-gu'), p = document.getElementById('l8-gp'), m = l8Mois();
    var ecartMois = function (i) { var R = l1Ref(L1.b); return l8Ecart(m.ser[i], l8Fin(R.serie[L1.A.i0 + i])); };
    l8Lier('cr', {
      texte: function (i) { var R = l1Ref(L1.b), e = ecartMois(i); return l1MoisAn(m.pts[i].mk) + ' : ' + l1Eur(m.ser[i]) + (e ? ', ' + l8Txt(e) + ' face à ' + R.long : ''); },
      actif: function (i) { l8Glisse(gv, m.ser[i], 180); u.textContent = l1MoisAn(m.pts[i].mk); l8Puce(p, ecartMois(i)); },
      repos: function () { l8Glisse(gv, Math.round(L1.A.caMoy), 240); u.textContent = 'par mois'; l8Puce(p, l8Ecart(L1.A.caMoy, l1Ref(L1.b).moy)); }
    });
  }
  // « Face à » : le repère glisse, les pastilles et « Sa place » se mettent à jour sur place
  function l8RebaseResume() {
    var ch = L8_CH.cr, R = l1Ref(L1.b), ref = l8RefSerie(R);
    if (!ch || !ch.api || !document.getElementById('l8-s-cr')) return;
    if (ch.refOk !== ref.some(function (v) { return v > 0; })) { l8Peindre(['resume']); return; }
    var rp = document.getElementById('l8-rep-place'); if (rp) rp.innerHTML = l8PlaceHtml();
    ch.api.setRef(ref, R.court, l8Desc(R, 'Ce qu’elle commande chaque mois'));
    var a = ch.api.indice();
    if (a >= 0) ch.api.aller(a); else l8Puce(document.getElementById('l8-gp'), l8Ecart(L1.A.caMoy, R.moy));
  }

  // ── Commandes : colonnes par mois, le repère en trait d'escalier, même geste que la courbe
  var l8Pastille = function (e) { return e ? '<span class="l8-pastille ' + e.c + '">' + e.t + '</span>' : ''; };
  function l8Marche(ch, ref) {
    var d = '';
    ref.forEach(function (v, i) {
      var y = ch.Y(v).toFixed(1), x0 = (ch.pl + ch.slot * i).toFixed(1), x1 = (ch.pl + ch.slot * (i + 1)).toFixed(1);
      d += (i ? 'L' + x0 + ' ' + y : 'M' + x0 + ' ' + y) + 'L' + x1 + ' ' + y;
    });
    return d;
  }
  function l8Colonnes(W) {
    var R = l1Ref(L1.b), m = l8Mois(), N = m.N, ref = l8RefSerie(R), refOk = ref.some(function (v) { return v > 0; }), H = W > 560 ? 260 : 178, pt = 26, pb = 32;
    var mx = Math.max.apply(null, m.ser.concat(l8RefTout(), [1])), top = mx * 1.04, s = l8Pas3(top), mg = l8Marges(W, top, s, refOk ? l8NomMax() : ''), pl = mg.pl, pr = mg.pr;
    var slot = (W - pl - pr) / N, bw = Math.min(slot * 0.58, 46), grand = slot >= 52, Y = function (v) { return pt + (H - pt - pb) * (1 - v / top); };
    var desc = l8Desc(R, 'Ses commandes mois par mois');
    var ch = L8_CH.cm = { id: 'cm', W: W, H: H, pl: pl, pr: pr, N: N, slot: slot, Y: Y, ref: ref.slice(), refOk: refOk, desc: desc };
    var cols = '', vl = '', lab = '', yb = Y(0), pas = slot < 40 ? 2 : 1;
    for (var i = 0; i < N; i++) {
      var cx = pl + slot * (i + 0.5), x0 = cx - bw / 2, x1 = cx + bw / 2, yt = Y(m.ser[i]), r = Math.max(0, Math.min(6, bw / 2, (yb - yt) / 2));
      cols += '<path class="l8-col" style="--i:' + l8Cran(i) + '" d="M' + l8F1(x0) + ' ' + l8F1(yb) + 'L' + l8F1(x0) + ' ' + l8F1(yt + r) + 'Q' + l8F1(x0) + ' ' + l8F1(yt) + ' ' + l8F1(x0 + r) + ' ' + l8F1(yt) + 'L' + l8F1(x1 - r) + ' ' + l8F1(yt) + 'Q' + l8F1(x1) + ' ' + l8F1(yt) + ' ' + l8F1(x1) + ' ' + l8F1(yt + r) + 'L' + l8F1(x1) + ' ' + l8F1(yb) + 'Z" fill="#0050E6"/>';
      if (grand) vl += '<text class="l8-cvl" style="--i:' + l8Cran(i) + ';--dy:' + l8F1(yb - yt) + 'px" x="' + l8F1(cx) + '" y="' + l8F1(yt - 9) + '" text-anchor="middle">' + l1Nb(m.ser[i]) + '</text>';
      if (i % pas === (N - 1) % pas) lab += '<text class="l8-mo" data-i="' + i + '" x="' + l8F1(cx) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(m.labs[i]) + '</text>';
    }
    return '<svg class="l8-tr l8-cols" id="l8-s-cm" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" tabindex="0" aria-label="' + esc(desc) + '">' +
      l8Axe(W, pl, pr, top, s, Y) + cols +
      (refOk ? '<path class="l8-marche" pathLength="1" d="' + l8Marche(ch, ref) + '" fill="none" stroke="#8591AC" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<text class="l8-refnom" x="' + l8F1(W - pr + 15) + '" y="' + l8F1(Y(ref[N - 1]) + 4.5) + '">' + esc(l8Court(R.court, pr)) + '</text>' : '') + vl + lab +
      '<rect class="l8-zone" x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff" fill-opacity="0"/></svg>';
  }
  function l8LierCols() {
    var svg = document.getElementById('l8-s-cm'), ch = L8_CH.cm; if (!svg || !ch) return;
    var cols = svg.querySelectorAll('.l8-col'), labs = svg.querySelectorAll('.l8-mo'), lu = document.getElementById('l8-lu'), zone = svg.querySelector('.l8-zone');
    var mp = svg.querySelector('.l8-marche'), rn = svg.querySelector('.l8-refnom'), act = -1, tm = null, tr = null, m = l8Mois(), N = ch.N;
    function mettre(i) {
      clearTimeout(tm); act = i; svg.classList.add('hov');
      Array.prototype.forEach.call(cols, function (c, k) { c.classList.toggle('act', k === i); });
      Array.prototype.forEach.call(labs, function (t) { t.classList.toggle('on', Number(t.getAttribute('data-i')) === i); });
      var R = l1Ref(L1.b), e = l8Ecart(m.ser[i], l8Fin(R.serie[L1.A.i0 + i]));
      if (lu) lu.innerHTML = l1MoisAn(m.pts[i].mk) + NB + '·' + NB + '<b>' + l1Eur(m.ser[i]) + '</b> ' + l8Pastille(e);
      svg.setAttribute('aria-label', l1MoisAn(m.pts[i].mk) + ' : ' + l1Eur(m.ser[i]) + (e ? ', ' + l8Txt(e) + ' face à ' + R.long : ''));
    }
    function repos() {
      clearTimeout(tm); act = -1; svg.classList.remove('hov'); if (lu) lu.innerHTML = ''; svg.setAttribute('aria-label', ch.desc);
      Array.prototype.forEach.call(cols, function (c) { c.classList.remove('act'); });
      Array.prototype.forEach.call(labs, function (t) { t.classList.remove('on'); });
    }
    var indice = function (e) { var r = svg.getBoundingClientRect(); return Math.max(0, Math.min(N - 1, Math.floor(((e.clientX - r.left) * ch.W / (r.width || ch.W) - ch.pl) / ch.slot))); };
    zone.addEventListener('pointerdown', function (e) { mettre(indice(e)); });
    zone.addEventListener('pointermove', function (e) { var i = indice(e); if (i !== act) mettre(i); });
    zone.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') repos(); });
    ['pointerup', 'pointercancel'].forEach(function (n) { zone.addEventListener(n, function (e) { if (e.pointerType === 'touch') { clearTimeout(tm); tm = setTimeout(repos, 1600); } }); });
    svg.addEventListener('keydown', function (e) {
      var k = e.key, i = act < 0 ? N - 1 : act;
      if (k === 'ArrowLeft') i = Math.max(0, i - 1); else if (k === 'ArrowRight') i = Math.min(N - 1, i + 1); else if (k === 'Home') i = 0; else if (k === 'End') i = N - 1;
      else if (k === 'Escape') { repos(); return; } else return;
      e.preventDefault(); mettre(i);
    });
    svg.addEventListener('blur', repos);
    ch.api = { indice: function () { return act; }, aller: mettre, setRef: function (neuf, nom) {
      var de = ch.ref.slice(), R = l1Ref(L1.b); neuf = l8Serie(neuf); ch.desc = l8Desc(R, 'Ses commandes mois par mois');
      if (rn) rn.textContent = l8Court(nom, ch.pr);
      if (tr) tr.stop();
      if (mp) tr = l8Tween(350, function (t) { ch.ref = de.map(function (v, i) { return v + (neuf[i] - v) * t; }); mp.setAttribute('d', l8Marche(ch, ch.ref)); if (rn) rn.setAttribute('y', l8F1(ch.Y(ch.ref[N - 1]) + 4.5)); });
      else ch.ref = neuf;
      if (act >= 0) mettre(act); else svg.setAttribute('aria-label', ch.desc);
    } };
  }
  function l8RebaseCols() {
    var ch = L8_CH.cm, R = l1Ref(L1.b), ref = l8RefSerie(R);
    if (!ch || !ch.api || !document.getElementById('l8-s-cm')) return;
    if (ch.refOk !== ref.some(function (v) { return v > 0; })) { l8Peindre(['commandes']); return; }
    ch.api.setRef(ref, R.court);
  }

  // ── Catégories : une petite courbe sur la période par ligne ; un clic déplie SA courbe en grand (même geste)
  function l8CatPar(key) { var a = L1.A.cats; for (var i = 0; i < a.length; i++) { if (a[i].key === key) return a[i]; } return null; }
  function l8CatSerie(c) { var i0 = L1.A.i0; return l8Mois().pts.map(function (p, i) { return l8Fin(c.caByM[i0 + i]); }); }
  function l8CatRef(c, R) { var i0 = L1.A.i0, ser = R.catSerie(c) || []; return l8Mois().pts.map(function (p, i) { return l8Fin(ser[i0 + i]); }); }
  function l8Mini(ser, ref, W, absente) {
    var N = ser.length, H = 38, mx = Math.max.apply(null, ser.concat(ref, [1]));
    var X = function (i) { return N > 1 ? 4 + (W - 8) * i / (N - 1) : W / 2; }, Y = function (v) { return 5 + (H - 10) * (1 - v / mx); };
    var pts = function (a) { return a.map(function (v, i) { return [X(i), Y(v)]; }); };
    var refOk = ref.some(function (v) { return v > 0; });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' +
      (refOk ? '<path d="' + (N > 1 ? l8Lisse(pts(ref)) : 'M' + (X(0) - 8) + ' ' + l8F1(Y(ref[0])) + 'h16') + '" fill="none" stroke="#8591AC" stroke-width="1.8" stroke-linecap="round"/>' : '') +
      (absente ? '' : (N > 1 ? '<path class="l8-m1" pathLength="1" d="' + l8Lisse(pts(ser)) + '" fill="none" stroke="#0050E6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' : '') +
        '<circle class="l8-m2" cx="' + l8F1(X(N - 1)) + '" cy="' + l8F1(Y(ser[N - 1])) + '" r="3.6" fill="#0050E6"/>') + '</svg>';
  }
  function l8Minis() {
    var R = l1Ref(L1.b);
    Array.prototype.forEach.call(document.querySelectorAll('.l8-mini[data-mini]'), function (el) {
      var c = l8CatPar(el.getAttribute('data-mini')); if (!c || el.closest('[hidden]')) return;
      l8Cadre(el, 'categories'); el.innerHTML = l8Mini(l8CatSerie(c), l8CatRef(c, R), Math.max(80, l8Larg(el, 160)), c.ca <= 0);
    });
  }
  // la grande courbe d'une catégorie, au-dessus de ce qui s'y rattache
  function l8CourbeCat(key) {
    var box = document.getElementById('l8-dcv-' + key), lu = document.getElementById('l8-lu-' + key), c = l8CatPar(key); if (!box || !c) return;
    var A = L1.A, R = l1Ref(L1.b), m = l8Mois(), N = m.N, ser = l8CatSerie(c), id = 'cc' + key, W = Math.max(240, l8Larg(box, 440));
    var tout = l8CatRef(c, l1Ref('reseau')); if (L1.G) tout = tout.concat(l8CatRef(c, l1Ref('groupement')));
    var ref = l8CatRef(c, R), refAt = function (i) { return l8Fin(ref[i]); };
    l8Cadre(box, 'categories'); box.innerHTML = l8Tracer({ id: id, W: W, H: W > 560 ? 240 : 190, ser: ser, ref: ref, refTout: tout, nom: R.court, nomMax: l8NomMax(), labs: m.labs, desc: l8Desc(R, c.label + ', mois par mois') });
    var api = l8Lier(id, {
      texte: function (i) { var e = l8Ecart(ser[i], refAt(i)); return l1MoisAn(m.pts[i].mk) + ' : ' + l1Eur(ser[i]) + (e ? ', ' + l8Txt(e) + ' face à ' + R.long : ''); },
      actif: function (i) { if (lu) lu.innerHTML = l1MoisAn(m.pts[i].mk) + NB + '·' + NB + '<b>' + l1Eur(ser[i]) + '</b> ' + l8Pastille(l8Ecart(ser[i], refAt(i))); },
      repos: function () { if (api) api.aller(N - 1); }
    });
    if (api) api.aller(N - 1);
  }
  // la hauteur du dépli s'anime (jamais rejouée par un redessin : seul un clic l'appelle)
  function l8Hauteur(d, ouvrir) {
    clearTimeout(d._ht); d.style.overflow = 'hidden';
    if (l8Calme()) { d.style.overflow = ''; if (!ouvrir) d.hidden = true; return; }
    var h = d.scrollHeight;
    d.style.height = ouvrir ? '0px' : h + 'px'; void d.offsetHeight;
    d.style.transition = 'height .38s var(--ease)'; d.style.height = ouvrir ? h + 'px' : '0px';
    d._ht = setTimeout(function () { d.style.transition = ''; d.style.height = ''; d.style.overflow = ''; if (!ouvrir) d.hidden = true; }, 400);
  }

  // ── Ne commande plus : frise des mois de la période, un point par produit au mois de son dernier achat
  function l8Frises() {
    var N = l8Mois().N;
    Array.prototype.forEach.call(document.querySelectorAll('.l8-frz'), function (el) {
      if (el.closest('[hidden]')) return;
      var W = Math.max(200, l8Larg(el, 360)), slot = W / N, lab = el.hasAttribute('data-lab'), H = lab ? 22 : 44, h = '', cx = function (i) { return slot * (i + 0.5); };
      if (lab) { var m = l8Mois(); for (var i = (N - 1) % (slot < 36 ? 2 : 1); i < N; i += (slot < 36 ? 2 : 1)) h += '<text x="' + l8F1(cx(i)) + '" y="16" text-anchor="middle">' + esc(m.labs[i]) + '</text>'; }
      else {
        var k = Math.max(0, Math.min(N - 1, Number(el.getAttribute('data-mi')) || 0));
        for (var j = 0; j < N; j++) h += '<circle cx="' + l8F1(cx(j)) + '" cy="22" r="2.4" fill="#D5DCEB"/>';
        h += (k < N - 1 ? '<line class="l8-sil" x1="' + l8F1(cx(k)) + '" x2="' + l8F1(cx(N - 1)) + '" y1="22" y2="22" stroke="#8591AC" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 6"/>' : '') +
          '<g transform="translate(' + l8F1(cx(k)) + ' 22)"><circle class="l8-fdot" r="12" fill="#0050E6" fill-opacity=".14"/><circle class="l8-fdot" r="6.5" fill="#0050E6" stroke="#fff" stroke-width="2.5"/></g>';
      }
      l8Cadre(el, 'neplus'); el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' + h + '</svg>';
    });
  }

  // Les rubriques construites à la demande (les autres — Fiche, Notes, Tout le détail — portent des formulaires : construites une fois)
  var L8_F = { resume: l8Resume, proposer: l8Proposer, commandes: l8Commandes, categories: l8Categories, neplus: l8NePlus, meilleurs: l8Top };

  // Le détail d'une catégorie, sur place (mois par mois, sa part, meilleurs produits, ce qu'elle ne commande plus, à proposer)
  // Le dépli d'une catégorie (construit à l'ouverture)
  function l8DetailHtml(key) {
    var A = L1.A, R = l1Ref(L1.b), c = null, i;
    for (i = 0; i < A.cats.length; i++) { if (A.cats[i].key === key) c = A.cats[i]; }
    if (!c) return '';
    var h = '';
    if (c.ca <= 0) {
      h += '<p class="large">Elle n’en commande pas. ' + esc(cap(R.que)) + ' en commande pour <b>' + l1Eur(R.catMoy(c)) + '</b> par mois (' + esc(l1PeriodeMoy(A)) + ').</p>';
    } else {
      var p = A.caTot > 0 ? Math.round(c.ca / A.caTot * 100) : 0;
      var rv = R.catSerie(c)[A.n - 1];
      h += '<div><h4>Ses ' + A.nAct + ' mois</h4><div class="l8-lu2" id="l8-lu-' + key + '"></div><div class="l8-dcv" id="l8-dcv-' + key + '"></div>' +
        '<p>' + cap(MOIS_LONG[A.last.mk % 12]) + ' : <b>' + l1Eur(c.caByM[A.n - 1] || 0) + '</b>, contre <b>' + l1Eur(rv || 0) + '</b> pour ' + esc(R.long) + '.</p></div>';
      h += '<div><h4>Sa part, ' + l1PeriodeCumul(A) + '</h4><p><b>' + l1Pct(p) + '</b> de ses commandes · <b>' + l1Nb(c.refs) + '</b> produit' + (c.refs > 1 ? 's' : '') + ' différent' + (c.refs > 1 ? 's' : '') + '.</p>' +
        '<div class="l8-piste-p"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div></div>';
      if (c.top && c.top.length) {
        var t5 = c.top.slice(0, 5);
        h += '<div><h4>' + (t5.length > 1 ? 'Ses ' + t5.length + ' meilleurs produits' : 'Son meilleur produit') + ', ' + l1PeriodeCumul(A) + '</h4>';
        t5.forEach(function (t) { h += '<div class="l8-dp l8-dp3"><span class="l8-dpn">' + esc(t.designation) + '</span><b class="mono">' + l1Eur(t.ca) + '</b><span class="l8-dpq">' + l1Nb(t.qte) + NB + 'boîte' + (t.qte > 1 ? 's' : '') + '</span></div>'; });
        h += '</div>';
      }
    }
    var np = L1.np && L1.np.connu ? L1.np.lignes.filter(function (q) { return q.cat === key; }) : [];
    if (np.length) {
      h += '<div><h4>Elle ne commande plus</h4>';
      np.slice(0, 5).forEach(function (q) { h += '<div class="l8-np"><b>' + esc(q.nom) + '</b><span>dernière commande en ' + esc(l1YmLong(q.dernier)) + '</span></div>'; });
      if (np.length > 5) h += '<p class="pha-sub l8-interne">Et ' + (np.length - 5) + ' autre' + (np.length - 5 > 1 ? 's' : '') + ' : voir « Tout le détail ».</p>';
      h += '</div>';
    }
    var pr = [], vus = {};
    [['reseau', L1.dataR, 'du réseau'], ['groupement', L1.dataG, L1.hasGrp ? 'de ' + A.grpName : '']].forEach(function (src) {
      var d = src[1]; if (!d || !d.cats) return;
      d.cats.forEach(function (o) {
        if (o.cat.key !== key) return;
        o.rows.slice(0, 5).forEach(function (r) {
          var cle = r.cip, e = vus[cle]; if (!e) { e = vus[cle] = { n: l1NomProduit(r), m: [] }; pr.push(e); }
          e.m.push('commandé par <b>' + l1Pct(l1PartDes(r, d.total)) + '</b> des officines ' + esc(src[2]));
        });
      });
    });
    if (pr.length) {
      h += '<div><h4>À lui proposer dans cette catégorie</h4>';
      pr.forEach(function (q) { h += '<div class="l8-dp">' + q.n + '<span>' + q.m.map(function (m) { return '<i class="l8-cp">' + m + '</i>'; }).join('') + '</span></div>'; });
      h += '</div>';
    }
    return h;
  }

  // Menu : les compteurs (mêmes sources que les rubriques)
  function l8Compte(k) {
    var A = L1.A;
    if (k === 'proposer') return '<b>' + l1Nb(L1.nR) + '</b>' + (L1.hasGrp ? NB + '·' + NB + '<b>' + l1Nb(L1.nG) + '</b>' : '');
    if (k === 'categories') return String(A.cats.filter(function (c) { return c.ca > 0 || c.netMoy > 0; }).length);
    if (k === 'neplus') return (L1.np && L1.np.connu && L1.np.lignes.length) ? String(L1.np.lignes.length) : '';
    if (k === 'meilleurs') { var n = l8TopTous().length; return n ? String(n) : ''; }
    return '';
  }

  // L'onglet « Infos », en lecture : à gauche les coordonnées puis les notes, à droite le marché et le reste. Chaque ligne de la fiche paraît une fois.
  // Les formulaires existants (« Infos officine ») n'apparaissent qu'avec « Modifier ».
  function l8InfosHtml(c) {
    var coord = ['Titulaire', 'Téléphone', 'E-mail', 'Adresse', 'Commercial', 'Prochaine relance'], g = [], marche = [], ga = null;
    // Une note sans libellé (la description du groupement d'achat) reste sous la ligne qu'elle complète.
    var dern = null;
    c.rows.forEach(function (r) {
      if (!r.l && dern) { dern.n.push(r); return; }
      dern = { r: r, n: [] };
      if (coord.indexOf(r.l) >= 0) g.push(dern); else if (r.l === 'Groupement d’achat' && !ga) ga = dern; else marche.push(dern);
    });
    g.sort(function (a, b) { return coord.indexOf(a.r.l) - coord.indexOf(b.r.l); });
    if (ga) marche.unshift(ga);
    var note = function (r) { return '<p class="l8-fnote">' + r.v + '</p>'; };
    var ligne = function (x) { var r = x.r; return (r.l ? '<div class="l8-fr"><dt>' + r.l + '</dt><dd' + (r.c ? ' class="' + r.c + '"' : '') + '>' + r.v + '</dd></div>' : note(r)) + x.n.map(note).join(''); };
    var h = l8Tete('Infos', '<button type="button" class="l8-btn l8-interne" id="l8-modif" onclick="V2.pharmaL.modifier()">' + (L1.edit ? 'Terminer' : 'Modifier') + '</button>');
    h += '<div class="l8-forms">' + c.infos + '</div>';
    h += '<div class="l8-icols"><div class="l8-icol"><div class="l8-lect"><h3 class="l8-gt">Coordonnées</h3><dl class="l8-fl-l" data-n="' + g.length + '">' + g.map(ligne).join('') + '</dl></div>' +
      '<h3 class="l8-gt l8-gt-suite" id="l8-notes-t">Notes de l’équipe</h3>' + c.notes + '</div>' +
      '<div class="l8-icol l8-lect"><h3 class="l8-gt">Marché et autres</h3><dl class="l8-fl-l" data-n="' + marche.length + '">' + marche.map(ligne).join('') + '</dl></div></div>';
    return h;
  }

  // Assemble la page : carte d'identité courte, menu, rubriques. c = ce que renderDetail a calculé.
  function l8Page(c) {
    var pid = esc(c.pidSafe);
    var acts = (c.tel ? '<a class="l8-act" href="tel:' + esc(c.tel.replace(/[^+0-9]/g, '')) + '"><span class="l8-rond">' + l8Ic('tel', 22) + '</span>Appeler</a>' : '') +
      (c.mail ? '<a class="l8-act" href="mailto:' + esc(c.mail) + '"><span class="l8-rond">' + l8Ic('mail', 22) + '</span>E-mail</a>' : '') +
      (c.mail && V2.rdv ? '<button type="button" class="l8-act" onclick="V2.rdv.proposer(\'' + pid + '\')" title="Elle choisit son créneau, calé sur la géographie de votre journée"><span class="l8-rond">' + l8Ic('rdv', 22) + '</span>Rendez-vous</button>' : '');
    // Deuxième rangée : les trois actions qui étaient derrière « Autres actions » (le catalogue n'existe que si le logiciel est reconnu : c.lgo)
    var acts2 = (V2.todo ? '<button type="button" class="l8-act" title="Ajouter à la to do list" aria-label="Ajouter à la to do list" onclick="V2.todo.menu(\'' + pid + '\')"><span class="l8-rond">' + l8Ic('todo', 22) + '</span>To do list</button>' : '') +
      '<button type="button" class="l8-act" title="Choisir quoi lui transmettre" aria-label="Choisir quoi lui transmettre" onclick="V2.pharmaTransmettre(\'' + pid + '\')"><span class="l8-rond">' + l8Ic('joint', 22) + '</span>Transmettre</button>' + (c.lgo || '');
    var menu = L8_RUB.map(function (m) {
      var k = m[0];
      return '<button type="button" class="l8-row' + (m[2] ? ' l8-interne' : '') + '" data-r="' + k + '"' + (k === L1.rub ? ' aria-current="page"' : '') + ' onclick="V2.pharmaL.go(\'' + k + '\')"><span class="l8-tuile">' + l8Ic(k, 18) + '</span><span class="l8-mot">' + m[1] + '</span><span class="l8-cpt" id="l8-cpt-' + k + '">' + l8Compte(k) + '</span><span class="l8-chev">' + l8Ic('chev', 18) + '</span></button>';
    }).join('');
    // Les sept rubriques à la suite : les six de chiffres se construisent dans l8Afficher ; « Tout le détail » est repliée
    var rubs = L8_RUB.map(function (m) {
      var k = m[0], inner = '';
      if (k === 'tout') inner = '<button type="button" class="l8-lg-b" id="l8-tout-btn" aria-expanded="false" onclick="V2.pharmaL.detail()"><span class="l8-ln">Tout le détail<small>Brief du jour, détail produit par produit, CA par génériqueur</small></span><span class="l8-cc">' + l8Ic('chev', 18) + '</span></button><div id="l8-tout-corps" hidden>' + c.tout + '</div>';
      return '<section class="l8-rub' + (m[2] ? ' l8-interne' : '') + '" id="l8-v-' + k + '" data-k="' + k + '" aria-label="' + m[1] + '">' + inner + '</section>';
    }).join('');
    var ong = function (k, mot) { var on = L1.ong === k; return '<button type="button" class="l8-ong" role="tab" id="l8-t-' + k + '" aria-controls="l8-p-' + k + '" data-ong="' + k + '" aria-selected="' + on + '" tabindex="' + (on ? '0' : '-1') + '" onclick="V2.pharmaL.onglet(\'' + k + '\')">' + mot + '</button>'; };
    return '<div class="pha l8" data-ong="' + L1.ong + '">' +
      '<div class="pha-rail l8-rail">' +
        '<header class="l8-id"><h1 class="l8-nom">' + c.nom + '</h1><p class="l8-sous">' + esc(c.sous) + '</p>' + (acts ? '<div class="l8-acts l8-interne">' + acts + '</div>' : '') + '<div class="l8-acts l8-acts-2 l8-interne">' + acts2 + '</div></header>' +
        '<div class="l8-ongs l8-interne" role="tablist" aria-label="Stats ou infos de l’officine" onkeydown="V2.pharmaL.touche(event)">' + ong('stats', 'Stats') + ong('infos', 'Infos') + '</div>' +
        '<nav class="l8-menu" aria-label="Rubriques">' + menu + '</nav>' +
        '<div class="l8-pied"><button type="button" class="l8-lien gris l8-interne" onclick="V2.pharmaL.vue()">' + l8Ic('oeil', 18) + '<span>À montrer au pharmacien</span></button>' +
'</div>' +
      '</div>' +
      '<div class="pha-main l8-main">' +
        '<div class="l8-vpbar"><span>Vue à montrer au pharmacien</span><button type="button" class="l8-lien" onclick="V2.pharmaL.vue()">Revenir à ma vue</button></div>' +
        '<div class="l8-vpid">' + c.vpid + '</div>' +
        '<div class="l8-pan" id="l8-p-stats" role="tabpanel" aria-labelledby="l8-t-stats"' + (L1.ong === 'stats' ? '' : ' hidden') + '><div id="l8-stat-tete">' + l8TeteStats() + '</div>' + rubs + '</div>' +
        '<div class="l8-pan l8-interne" id="l8-p-infos" role="tabpanel" aria-labelledby="l8-t-infos" data-edit="' + (L1.edit ? '1' : '0') + '"' + (L1.ong === 'infos' ? '' : ' hidden') + '>' + l8InfosHtml(c) + '</div>' +
      '</div></div>';
  }

  // État de la fiche : remis à zéro quand on change d'officine (la vue pharmacien n'est PAS retenue)
  function l8Init(pid, A, o) {
    if (String(L1.pid) !== String(pid)) { L1.b = 'reseau'; L1.ouv = {}; L1.vu = {}; L1.vue = 'commercial'; L1.rub = 'resume'; L1.ong = 'stats'; L1.tous = { neplus: false, meilleurs: false }; L1.edit = false; }
    L1.pid = String(pid); L1.A = A; L1.marge = o.marge; L1.dataR = o.dataR; L1.dataG = o.dataG; L1.nR = o.nR; L1.nG = o.nG; L1.hasGrp = o.hasGrp;
    L1.G = l1Groupe(pid, A);
    if (!L1.G) L1.b = 'reseau';
    L1.np = l1NePlus(pid);
    L1.k = (L1.k || 0) + 1;       // un rendu complet invalide les rubriques construites à la demande
  }

  // Construit (ou reconstruit) les six rubriques de chiffres, l'une sous l'autre, sans jamais refaire la fiche.
  // garde = rubriques déjà construites qu'on ne touche pas (« Face à » : leur repère glisse, rien n'est redessiné) ;
  // dans ce cas les autres sont refaites sans mouvement.
  function l8Afficher(garde) {
    var p = document.querySelector('.pha.l8'); if (!p) return;
    p.setAttribute('data-ong', L1.ong);
    var tt = document.getElementById('l8-stat-tete'); if (tt && tt.getAttribute('data-ok') !== String(L1.k)) { tt.innerHTML = l8TeteStats(); tt.setAttribute('data-ok', String(L1.k)); }
    var neuves = [];
    Object.keys(L8_F).forEach(function (k) {
      var el = document.getElementById('l8-v-' + k);
      if (!el || el.getAttribute('data-ok') === String(L1.k)) return;
      if (garde && garde.indexOf(k) >= 0 && el.getAttribute('data-ok')) { el.setAttribute('data-ok', String(L1.k)); return; }
      el.innerHTML = L8_F[k](); el.setAttribute('data-ok', String(L1.k));
      l8Etat(k, !!garde); l8Compteurs(k); neuves.push(k);
    });
    l8Peindre(garde ? neuves : null); l8Observer(); l8Sommaire();
  }
  // Ce qui dépend de la largeur réelle : courbe, colonnes, petites courbes, frises, courbe d'une catégorie ouverte.
  // quoi = liste de rubriques à (re)dessiner (toutes si absent). Le redessin ne rejoue jamais l'arrivée : l'horloge reprend (--l8t).
  function l8Peindre(quoi) {
    if (L1.ong !== 'stats' || !L1.A) return;
    var veut = function (k) { return !quoi || quoi.indexOf(k) >= 0; }, vis = function (el) { return el && !el.closest('[hidden]'); };
    var g = document.getElementById('l8-graph');
    if (veut('resume') && vis(g)) { l8Cadre(g, 'resume'); g.innerHTML = l8CourbeResume(Math.max(260, l8Larg(g, 320))); l8LierResume(); }
    var c = document.getElementById('l8-cmd');
    if (veut('commandes') && vis(c)) { l8Cadre(c, 'commandes'); c.innerHTML = l8Colonnes(Math.max(260, l8Larg(c, 700))); l8LierCols(); }
    if (veut('categories')) { l8Minis(); Object.keys(L1.ouv).forEach(function (k) { if (L1.ouv[k]) l8Detail(k); }); }
    if (veut('neplus')) l8Frises();
  }
  function l8Detail(key) {
    var d = document.getElementById('l8-d-' + key); if (!d || d.hidden) return;
    d.innerHTML = l8DetailHtml(key);
    l8CourbeCat(key);
  }
  // Sommaire : la ligne de la rubrique à l'écran est marquée (la dernière rubrique dont le haut est passé sous la ligne des 140 px)
  function l8Sommaire() {
    var p = document.querySelector('.pha.l8'); if (!p || L1.ong !== 'stats') return;
    var cur = L8_RUB[0][0];
    if (L1.verrou) cur = L1.verrou;
    else {
      L8_RUB.forEach(function (m) { var s = document.getElementById('l8-v-' + m[0]); if (s && s.getBoundingClientRect().top <= 140) cur = m[0]; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = L8_RUB[L8_RUB.length - 1][0];
    }
    L1.rub = cur;
    Array.prototype.forEach.call(p.querySelectorAll('.l8-row'), function (b) { if (b.getAttribute('data-r') === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  if (!window.__l8Scroll) {
    window.__l8Scroll = true;
    var _l8Att = false;
    window.addEventListener('scroll', function () { if (_l8Att) return; _l8Att = true; requestAnimationFrame(function () { _l8Att = false; if (document.querySelector('.pha.l8')) l8Sommaire(); }); }, { passive: true });
    ['wheel', 'touchstart', 'keydown'].forEach(function (n) { window.addEventListener(n, function () { L1.verrou = null; }, { passive: true }); });
  }
  var _l8T = null;
  if (!window.__l8Resize) {
    window.__l8Resize = true;
    window.addEventListener('resize', function () { clearTimeout(_l8T); _l8T = setTimeout(function () { if (document.querySelector('.pha.l8')) l8Peindre(); }, 120); });
  }
  // « Tous les chiffres en détail » : les blocs d'avant, contenu inchangé, repliés
  function l1ToutHtml(pid, A) {
    return analyseTranches(A) + analyseParts(A) + analyseTop5(A) + analyseNePlus(pid);
  }
  function l1ToutSection(pid, A) {
    var open = sectionOpen('tout');
    return '<div class="ph-section l8-tout" id="l8-tout">' +
      '<div class="v2-section-head ph-sh-toggle" data-sec="tout" role="button" tabindex="0" aria-expanded="' + (open ? 'true' : 'false') + '" onclick="V2.pharmaL.tout()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();V2.pharmaL.tout();}">' +
        '<h2 class="v2-sh-t">Tous les chiffres en détail</h2><span class="v2-sh-s">tableau par catégorie, graphes, meilleurs produits, frise de « Ne commande plus »</span>' +
        '<span class="v2-sh-end v2-section-chev' + (open ? ' open' : '') + '">' + ICO('chev', 16) + '</span></div>' +
      '<div id="l8-tout-body"' + (open ? '' : ' hidden') + '>' + (open ? l1ToutHtml(pid, A) : '') + '</div></div>';
  }
  // Après un filtre interne au détail (unité des parts, onglets) : on ne refait que cette zone.
  function l1MajTout() {
    var b = document.getElementById('l8-tout-body');
    if (!b || !L1.A || b.hidden) return false;
    b.innerHTML = l1ToutHtml(L1.pid, L1.A);
    if (V2.motion && V2.motion.pass) V2.motion.pass();
    return true;
  }

  V2.pharmaL = {
    // Porte d'entrée : une rubrique de chiffres = onglet « Stats » et défilement jusqu'à elle ; « fiche » et « notes » = onglet « Infos » (« notes » défile jusqu'aux notes). Jamais V2.render.
    go: function (r) {
      var infos = (r === 'fiche' || r === 'notes');
      if (infos && L1.vue === 'pharmacien') return;
      if (!infos && !document.getElementById('l8-v-' + r)) return;
      if (r === 'tout' && L1.vue === 'pharmacien') return;
      V2.pharmaL.onglet(infos ? 'infos' : 'stats', true);
      var el = document.getElementById(infos ? (r === 'notes' ? 'l8-notes-t' : 'l8-p-infos') : 'l8-v-' + r); if (!el) return;
      if (!infos) { L1.rub = r; L1.verrou = r; clearTimeout(L1.tv); L1.tv = setTimeout(function () { L1.verrou = null; l8Sommaire(); }, 1500); l8Sommaire(); }
      var calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try { el.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(true); }
    },
    // Les deux onglets : on montre une zone, on cache l'autre
    onglet: function (o, garder) {
      if (o !== 'infos') o = 'stats';
      if (o === 'infos' && L1.vue === 'pharmacien') return;
      var change = L1.ong !== o; L1.ong = o;
      var p = document.querySelector('.pha.l8'); if (!p) return;
      p.setAttribute('data-ong', o);
      ['stats', 'infos'].forEach(function (k) {
        var b = document.getElementById('l8-t-' + k), z = document.getElementById('l8-p-' + k), on = k === o;
        if (b) { b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }
        if (z) z.hidden = !on;
      });
      if (change) { l8Peindre(); if (!garder) { try { window.scrollTo(0, 0); } catch (e) {} } l8Sommaire(); }
    },
    // Flèches gauche / droite entre les deux onglets
    touche: function (e) {
      var k = e.key; if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
      e.preventDefault();
      var o = (k === 'ArrowLeft' || k === 'Home') ? 'stats' : 'infos';
      V2.pharmaL.onglet(o); var b = document.getElementById('l8-t-' + o); if (b) b.focus();
    },
    // « Face à » : le repère GLISSE (courbe du Résumé, escalier des Commandes) ; Catégories est refaite sans mouvement
    base: function (k) {
      if (k === 'groupement' && !L1.G) k = 'reseau';
      if (k === L1.b) return;
      L1.b = k; L1.k++;
      l8Afficher(['resume', 'commandes', 'proposer', 'neplus', 'meilleurs']);
      l8RebaseResume(); l8RebaseCols();
    },
    aide: function (btn) {
      var v = btn.closest ? btn.closest('.l8-tete,.l8-st-tete') : null, t = v && v.nextElementSibling; if (!t || !t.classList.contains('l8-aide-txt')) t = v && v.querySelector('.l8-aide-txt'); if (!t) return;
      t.hidden = !t.hidden; btn.setAttribute('aria-expanded', t.hidden ? 'false' : 'true');
    },
    cat: function (key) {
      var d = document.getElementById('l8-d-' + key); if (!d) return;
      var ouv = d.hidden;                      // fermé → on l'ouvre
      // une seule catégorie ouverte à la fois
      Object.keys(L1.ouv).forEach(function (k) {
        if (k === key || !L1.ouv[k]) return;
        var o = document.getElementById('l8-d-' + k), b = o && o.previousElementSibling;
        L1.ouv[k] = false; if (b) b.setAttribute('aria-expanded', 'false'); if (o) l8Hauteur(o, false);
      });
      L1.ouv[key] = ouv;
      var b = d.previousElementSibling; if (b) b.setAttribute('aria-expanded', ouv ? 'true' : 'false');
      if (!ouv) { l8Hauteur(d, false); return; }
      d.hidden = false; l8Detail(key); l8Hauteur(d, true);
      if (!l8Calme()) { d.classList.add('l8-lit'); d.style.setProperty('--l8t', '0ms'); clearTimeout(d._ft); d._ft = setTimeout(function () { d.classList.remove('l8-lit'); d.style.removeProperty('--l8t'); }, 1100); }
    },
    plus: function (w) { L1.tous[w] = !L1.tous[w]; L1.k++; l8Afficher(); },
    // « Modifier » : les formulaires existants remplacent la lecture ; « Terminer » les referme.
    modifier: function () {
      var p = document.getElementById('l8-p-infos'); if (!p) return;
      L1.edit = !L1.edit; p.setAttribute('data-edit', L1.edit ? '1' : '0');
      var b = document.getElementById('l8-modif'); if (b) b.textContent = L1.edit ? 'Terminer' : 'Modifier';
      if (L1.edit) return;
      // À la fermeture, la lecture reprend ce qui vient d'être saisi (les formulaires enregistrent comme avant)
      var pid = L1.pid, vals = {}, avant = JSON.stringify(_coordSaisie[pid] || {});
      Array.prototype.forEach.call(p.querySelectorAll('.v2-profil-box [data-fk]'), function (f) {
        var k = f.getAttribute('data-fk'), v = (f.value || '').trim(), box = f.closest('.v2-profil-box'), seed = {};
        try { seed = JSON.parse(box.getAttribute('data-seed') || '{}') || {}; } catch (e) {}
        if (v && v !== '__add__' && (v !== seed[k] || (_coordSaisie[pid] || {})[k] != null || k === 'tel' || k === 'email' || k === 'adresse' || k === 'relance_date')) vals[k] = v;
      });
      var neuf = Object.assign({}, _coordSaisie[pid] || {}, vals);
      if (JSON.stringify(neuf) !== avant) { _coordSaisie[pid] = neuf; V2.render(); }
    },
    // « Tout le détail » : la dernière rubrique, repliée ; à l'ouverture elle ouvre aussi le tableau interne
    detail: function () {
      var b = document.getElementById('l8-tout-btn'), c = document.getElementById('l8-tout-corps'); if (!b || !c) return;
      var ouv = c.hidden; c.hidden = !ouv; b.setAttribute('aria-expanded', ouv ? 'true' : 'false');
      if (ouv) V2.pharmaL.tout(true);
    },
    tout: function (ouvrir) {
      var b = document.getElementById('l8-tout-body'); if (!b) return;
      var ouv = (ouvrir === true) ? true : b.hidden;
      if (ouv && !b.firstChild) { b.innerHTML = l1ToutHtml(L1.pid, L1.A); if (V2.motion && V2.motion.pass) V2.motion.pass(); }
      b.hidden = !ouv; sectionCollapsed.tout = !ouv;
      var h = document.querySelector('#l8-tout .v2-section-head'); if (h) h.setAttribute('aria-expanded', ouv ? 'true' : 'false');
      var ch = document.querySelector('#l8-tout .v2-section-chev'); if (ch) ch.classList.toggle('open', ouv);
    },
    // Vue « À montrer au pharmacien » : liste blanche en CSS (.pha-wrap[data-vue]), pas de nouveau rendu.
    vue: function (v) {
      L1.vue = v || (L1.vue === 'pharmacien' ? 'commercial' : 'pharmacien');
      var w = document.querySelector('.pha-wrap'); if (w) w.setAttribute('data-vue', L1.vue);
      document.body.classList.toggle('l8-vp', L1.vue === 'pharmacien');
      if (L1.vue === 'pharmacien') V2.pharmaL.onglet('stats', true);   // « Infos » est interne
      l8Afficher(); l8Sommaire();
    }
  };
  // Quand on quitte la fiche, la vue pharmacien ne reste pas collée au reste de l'application.
  if (!window.__l8Hash) {
    window.__l8Hash = true;
    window.addEventListener('hashchange', function () {
      var r = (location.hash || '').replace(/^#/, '').split('/')[0];
      if (r !== 'pharma') document.body.classList.remove('l8-vp');
    });
  }

  function renderDetail(root, pid) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (!pharma) {
      if (String(pid).indexOf('px_') === 0) renderCreatedProspect(root, pid);   // fiche créée à la main
      else renderProspectFiche(root, pid);                                        // prospect de la base nationale
      return;
    }

    // Agrégats marché + catalogue IP chargés ? sinon lazy-load + état loading
    if (!window.OPS_AGGREGATE || !window.BENCHMARK) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du marché sectoriel…</div></div>';
      V2.loadFiles(['establishments', 'bench']).then(function () { _marketCache = null; _mkClassified = null; _mkTop = null; if (V2.route && V2.route.name !== 'pharma') return; /* 11/09/2026 (phase 4) : l'écran a pu changer pendant l'attente */ V2.render(); });
      return;
    }

    // PHARMA_FR (base nationale) = source du titulaire connu — charge en tâche de fond puis rafraîchit.
    if (!window.PHARMA_FR && V2.ensurePharmaFr) { V2.ensurePharmaFr(function () { if (V2.route && V2.route.param) V2.render(); }); }

    // CLIENTS = seule source de l'e-mail et de l'adresse postale (absents de WML).
    // Sans lui, ni le bouton E-mail ni « Proposer un RDV » ne peuvent s'afficher.
    if (!window.CLIENTS && V2.loadFiles) {
      if (!_clientsAsked) {
        _clientsAsked = true;
        V2.loadFiles(['clients']).then(function () { if (V2.route && V2.route.param) V2.render(); });
      }
    }
    // 23/09/2026 — FINESS du jour (adresse, tel, fax, SIREN) : complète les trous
    // de la base clients pour les clientes aussi (pas seulement les prospects).
    if (!window.OFFICINES_INFOS && V2.loadFiles) {
      if (!_oiAsked) { _oiAsked = true; V2.loadFiles(['officinesinfos']).then(function () { if (V2.route && V2.route.param) V2.render(); }); }
    }

    // Nouvelle pharma → on repart d'une sélection vide
    if (String(selPid) !== String(pid)) { selPid = String(pid); selCips = new Set(); }

    var sales = pharmaSales(pid);
    var ca = V2.sumCA(sales);
    var marge = margeNettePharma(sales);

    // On ne montre PLUS les tableaux à l'écran (trop d'espace). On propose directement
    // les DEUX listes d'achats en PDF : réseau Intégral et son groupement.
    var dataR = buildRecoCats(pid, 'reseau');
    var nReseau = dataR.cats.reduce(function (s, o) { return s + o.rows.length; }, 0);
    var g = groupementPids(pid);
    var hasGrp = !!(g.set && g.set.size >= 2);
    // 24/09/2026 — officine d'un collègue (commercial restreint) : aucun chiffre de vente. Lu ici car la
    // carte des listes en dépend (08/10/2026 : en vue 1b, les listes passent dans la colonne des chiffres).
    var voitVentes = V2.voitVentesDe(pid);
    var dataG = hasGrp ? buildRecoCats(pid, 'groupement') : null;
    var nGrp = dataG ? dataG.cats.reduce(function (s, o) { return s + o.rows.length; }, 0) : 0;

    var ficheBadge = isOpso() ? ' ' + opsoBadge(pharma) : '';
    var repriseBadge = (window.REPRISES && REPRISES[String(pid)])
      ? ' <span class="phf-reprise" title="Le titulaire a changé récemment — moment clé pour (re)capter la relation">🔄 Reprise récente</span>' : '';

    // ── Colonne « humain » : identité + actions + listes + infos officine + notes ──
    var pidSafe = esc(String(pid).replace(/[^0-9A-Za-z_-]/g, ''));
    // ⚠️ Téléphone et e-mail ne sont PAS dans WML_OFFICINES : seules 182 des 717
    // officines y ont un numéro, et AUCUNE n'y a d'e-mail. Les deux vivent dans
    // CLIENTS, dans la base nationale et dans le complément d'annuaire — c'est
    // exactement ce que `V2.rdvInfo` réconcilie déjà par le CIP. La fiche lisait
    // `pharma.tel` seul : elle affichait « à compléter » sur 473 officines dont
    // le numéro était pourtant connu de l'app. On lit donc la source réconciliée
    // pour les DEUX, comme le fait l'écran Rendez-vous depuis le 10/08/2026.
    var infoRdv = (V2.rdvInfo ? V2.rdvInfo(pid) : null);
    // Ce que l'équipe a saisi à la main passe AVANT tout le reste : c'est une
    // correction volontaire, elle doit gagner sur l'annuaire.
    if (_coordSaisie[pid] === undefined && V2.profil && V2.profil.charger) {
      _coordSaisie[pid] = null;
      V2.profil.charger('client', pid).then(function (d) {
        _coordSaisie[pid] = d || {};
        if (V2.route && String(V2.route.param) === String(pid)) V2.render();
      }).catch(function () { _coordSaisie[pid] = {}; });
    }
    var saisi = _coordSaisie[pid] || {};
    var tel = String(saisi.tel || '').trim() || (infoRdv && infoRdv.tel) || (pharma.tel == null ? '' : String(pharma.tel)).trim() || '';
    // 10/09/2026 — ce que la base clients sait d'elle et que rien d'autre ne dit :
    // le logiciel de gestion, le portable, le rythme de livraison.
    var logiciel = (infoRdv && infoRdv.logiciel) || '', portable = (infoRdv && infoRdv.portable) || '', livraison = (infoRdv && infoRdv.livraison) || '';
    // 11/09/2026 — génériqueur(s) déclaré(s) : fichier clients Escale seulement (11ᵉ champ).
    var caBase = ((window.CLIENTS_ACTIFS || {}).d || {})[String(pid)], generiqueur = (caBase && caBase[10]) || '';
    // Sans le module Rendez-vous (espace Escale), V2.rdvInfo n'existe pas : la base clients se lit ici directement.
    if (!infoRdv && caBase) { logiciel = logiciel || caBase[5] || ''; portable = portable || caBase[1] || ''; }
    var mail = String(saisi.email || '').trim() || (pharma.email == null ? '' : String(pharma.email)).trim() || (infoRdv && infoRdv.email) || (!infoRdv && caBase && caBase[2]) || '';
    // 23/09/2026 — l'adresse et la ville se complètent aussi depuis la base clients
    // (caBase[11] adresse, [12] cp, [13] ville) quand la saisie et l'annuaire RDV n'ont rien.
    // 23/09/2026 — FINESS du jour (public, national) : dernier recours, après la
    // saisie de l'équipe, l'annuaire RDV et la base clients (ROBOT.md, priorité par champ).
    var oi = (window.OFFICINES_INFOS || {})[String(pid)] || null;
    if (!tel) tel = (oi && oi[1]) || '';
    var adresse = String(saisi.adresse || '').trim() || (caBase && caBase[11]) || (infoRdv && infoRdv.adresse) || (oi && oi[0]) || '';   // base clients (09/2026) avant CLIENTS (05/2026)
    // Même trou pour la ville : WML ne la connaît pas partout (« à compléter »
    // sur une officine dont l'annuaire donne pourtant la commune).
    var loc = [pharma.cp || (infoRdv && infoRdv.cp) || (caBase && caBase[12]), pharma.ville || (infoRdv && infoRdv.ville) || (caBase && caBase[13])]
      .filter(function (x) { return x; }).join(' ');
    var titulaire = clientTitulaire(pid);
    var comms = (pharma.comms || []).join(', ');
    // 23/09/2026 — données de la base clients jamais montrées jusqu'ici : interlocuteur
    // (si différent du titulaire), UGA, fax, SIREN, grossiste principal, structure qui livre,
    // note de potentiel (1-8, PAS un €, sens non confirmé). Jamais l'encours ni une condition
    // commerciale : ROBOT.md interdit.
    var interloc = (caBase && caBase[3]) ? (caBase[3] + (caBase[4] ? ' (' + caBase[4] + ')' : '')) : '';
    if (interloc && titulaire && caBase[3] === titulaire) interloc = '';  // même personne que le titulaire : pas de doublon
    var uga = (caBase && caBase[8]) || '';
    var fax = (caBase && caBase[15]) || (oi && oi[2]) || '';
    var siren = (caBase && caBase[14]) || (oi && oi[3]) || '';
    var nf = V2.normFournisseur || function (v) { return v || ''; };   // « Phoenix » → « Phoenix Pharma », « Mylan » → « Viatris (Mylan) »…
    var grossiste = nf((caBase && caBase[18]) || '');
    var livreePar = (caBase && caBase[16]) || '';
    var potentiel = (pharma.potentiel != null && pharma.potentiel !== '') ? (pharma.potentiel + ' / 8') : '';
    // 23/09/2026 — demande Will : quand le grossiste/génériqueur n'est connu ni de la
    // base clients ni d'une saisie de l'équipe, estimation d'après la répartition
    // CONNUE du même groupement (V2.probableParGroupement, jamais devant une donnée
    // connue, jamais écrite en base ni dans le Profil commercial).
    var probable = V2.probableParGroupement ? V2.probableParGroupement(pid) : null;
    var grpInfo = (function () {
      var g = String(pharma.groupement || '').trim();
      if (!g || g === '—' || !window.GRP_INFO) return null;
      var key = canonG(g).toLowerCase().replace(/[^a-z0-9]/g, '');
      return window.GRP_INFO[key] || null;
    })();
    var kv = function (l, v, empty) { return '<span>' + l + '</span><span' + (v ? '' : ' class="pha-empty"') + '>' + (v ? v : (empty || 'à compléter')) + '</span>'; };
    var kvProbable = function (l, estim) { return '<span>' + l + '</span><span class="pha-probable">' + esc(V2.probableTexte(estim, probable && probable.groupement)) + '</span>'; };
    // Les lignes de la carte (libellé → valeur), construites une seule fois : la carte d'avant les affiche telles quelles,
    // la rubrique « Fiche » du menu les lit en lignes.
    var kvHtml = '' +
          kv('Ville', esc(loc)) +
          (adresse ? kv('Adresse', esc(adresse)) : '') +
          kv('Titulaire', esc(titulaire || dirigeantsDe(oi))) +
          ((dirigeantsDe(oi) && titulaire && !memesNoms(titulaire, dirigeantsDe(oi))) ? kv('Dirigeant(s) déclaré(s)', esc(dirigeantsDe(oi))) : '') +
          (equipeDe(oi) ? kv('Pharmaciens', esc(equipeDe(oi))) : '') +
          (cessation(oi, true) ? '<span>Société</span><span class="pha-cessee">' + esc(cessation(oi, true)) + '</span>' : '') +
          (retraiteDe(oi) ? '<span>À savoir</span><span class="pha-retraite">Titulaire proche de la retraite (62 ans ou plus)</span>' : '') +
          (autresOfficinesHtml(oi) ? '<span>Dirige aussi</span><span class="pha-grpinfo">' + autresOfficinesHtml(oi) + '</span>' : '') +
          (venteFondsHtml(oi) ? '<span>Annonce légale</span><span class="pha-grpinfo">' + venteFondsHtml(oi) + '</span>' : '') +
          (procedureHtml(oi) ? '<span>Procédure collective</span><span class="pha-retraite">' + procedureHtml(oi) + '</span>' : '') +
          (interloc ? kv('Interlocuteur', esc(interloc)) : '') +
          kv('Groupement', (pharma.groupement && pharma.groupement !== '—') ? esc(canonG(pharma.groupement)) : '') +
          (grpInfo && grpInfo.description ? '<span></span><span class="pha-grpinfo"><span class="pha-grpdesc" title="' + esc(grpInfo.description) + '">' + esc(grpInfo.description) + '</span>' + (grpInfo.site ? ' <a href="' + esc(grpInfo.site) + '" target="_blank" rel="noopener">' + esc(grpInfo.site.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>' : '') + '</span>' : '') +
          kv('Téléphone', tel ? esc(tel) : '') +
          (portable && portable !== tel ? kv('Portable', esc(portable)) : '') +
          (fax ? kv('Fax', esc(fax)) : '') +
          kv('E-mail', mail ? esc(mail) : '') +
          (uga ? kv('UGA', esc(uga)) : '') +
          (siren ? '<span>SIREN</span><span><a href="https://annuaire-entreprises.data.gouv.fr/entreprise/' + esc(siren) + '" target="_blank" rel="noopener">' + esc(siren) + '</a></span>' : '') +
          kv('Logiciel', logiciel ? esc(logiciel) : '', 'inconnu') +
          (livraison ? kv('Livraison', esc(livraison)) : '') +
          (generiqueur ? kv('Génériqueur', esc(generiqueur)) : (probable && probable.generiqueur ? kvProbable('Génériqueur probable', probable.generiqueur) : '')) +
          (grossiste ? kv('Grossiste principal', esc(grossiste)) : (probable && probable.grossiste ? kvProbable('Grossiste probable', probable.grossiste) : '')) +
          (livreePar ? kv('Livrée par', esc(livreePar)) : '') +
          (potentiel ? kv('Potentiel', esc(potentiel)) : '');
    var idCard =
      '<div class="pha-id">' +
        '<div class="pha-code mono">' + (pharma.code ? 'CIP ' + esc(String(pharma.code)) + ' · ' : '') + (isEscale() ? 'CLIENTE ESCALE' : 'CLIENTE INTÉGRAL') + (comms ? ' · ' + esc(comms.toUpperCase()) : '') + '</div>' +
        '<div class="pha-name">' + esc(nameOf(pid, pharma.name)) + ficheBadge + repriseBadge + '</div>' +
        '<div class="pha-kv">' + kvHtml + '</div>' +
        '<div class="pha-acts">' +
          (tel ? '<a class="pha-btn" href="tel:' + esc(tel.replace(/[^+0-9]/g, '')) + '">' + ICO('phone', 15) + 'Appeler</a>' : '') +
          (mail ? '<a class="pha-btn" href="mailto:' + esc(mail) + '">' + ICO('mail', 15) + 'E-mail</a>' : '') +
          (mail && V2.rdv ? '<button class="pha-btn pha-btn-pri" onclick="V2.rdv.proposer(\'' + pidSafe + '\')" title="Elle choisit son créneau, calé sur la géographie de votre journée">' + ICO('cal', 15) + 'Proposer un RDV</button>' : '') +
          (!tel && !mail ? '<span class="pha-sub" style="color:rgba(255,255,255,.7)">Téléphone et e-mail à renseigner dans « Infos officine »</span>' : '') +
        '</div>' +
      '</div>';

    // ── Listes à proposer (PDF réseau / groupement + écran Produits calé sur elle) ──
    var pdfBtn = function (scope, label, n, cls) {
      if (n <= 0) return '';
      return '<button class="pha-btn pha-btn-w ' + (cls || '') + '" onclick="V2.pharmaListPdf(\'' + esc(String(pid)) + '\',\'' + scope + '\')" title="ce qu\'elle n\'a pas encore, prêt en PDF">' +
        ICO('download', 15) + label + ' <b class="mono">' + V2.fmtNum(n) + '</b></button>' +
        '<button class="pha-btn pha-btn-w ' + (cls || '') + '" onclick="V2.pharmaListXlsx(\'' + esc(String(pid)) + '\',\'' + scope + '\')" title="la même liste, en Excel">' +
        ICO('download', 15) + label + ' · Excel</button>';
    };
    var btnProduits = V2.pages.produits
      ? '<button class="pha-btn pha-btn-w pha-btn-opp" onclick="V2.go(\'produits\', \'' + pidSafe + '\')">' + ICO('cat', 14, 2) + ' Ce que ses confrères prennent</button>'
      : '';
    var aDesPdf = (nReseau > 0 || (hasGrp && nGrp > 0));
    txMail[String(pid)] = mail;
    var btnTx = '<button class="pha-btn pha-btn-w pha-btn-tx" onclick="V2.pharmaTransmettre(\'' + pidSafe + '\')" title="listings, catalogues, documents de l\'équipe — en pièces jointes">' +
      ICO('fiche', 15, 2) + 'Choisir quoi lui transmettre</button>';
    // 01/10/2026 — le catalogue au format de SON logiciel, à un geste de la fiche : ouvre
    // Transmettre, la case déjà cochée. Affiché seulement quand le logiciel est reconnu ;
    // la saisie de l'équipe (lue en différé) fait foi, comme dans Transmettre.
    var btnLgo = '';
    if (!isEscale() && !isOpso()) {
      var lgoHtml = voitVentes ? lgoRondHtml : lgoBtnHtml;   // fiche « menu » : bouton rond de la 2e rangée de la carte bleue
      btnLgo = '<span id="pha-lgo-btn" data-pid="' + pidSafe + '" style="display:contents">' + lgoHtml(pid, txLgoDetect(pid, null)) + '</span>';
      if (V2.profil && V2.profil.charger) V2.profil.charger('client', pid).then(function (d) {
        setTimeout(function () {
          var el = document.getElementById('pha-lgo-btn');
          if (el && el.getAttribute('data-pid') === String(pid)) el.innerHTML = lgoHtml(pid, txLgoDetect(pid, d));
        }, 0);
      }, function () {});
    }
    // 23/09/2026 — Ma liste : demande de rendez-vous, suite de rendez-vous, ouverture de compte…
    var btnTodo = V2.todo ? '<button class="pha-btn pha-btn-w" onclick="V2.todo.menu(\'' + pidSafe + '\')" title="demande de rendez-vous, suite de rendez-vous, ouverture de compte…">' +
      ICO('check', 15, 2) + 'Ajouter à la to do list</button>' : '';
    // 08/10/2026 — fiche « lecture » (1b) : les deux listes (voir à l'écran, PDF, envoyer) passent dans
    // le bloc « À proposer » de la colonne des chiffres ; ici restent les autres actions, une seule fois.
    // Officine d'un collègue : la carte reste telle qu'avant (rien de 1b n'y est affiché).
    var listes =
      '<div class="v2-card pha-card pha-lists"><div class="pha-kl">' + (voitVentes ? 'Autres actions' : 'Listes à proposer') + '</div>' +
        (voitVentes ? '' : btnProduits) +
        btnTodo +
        (!voitVentes && aDesPdf ? pdfBtn('reseau', reseauLbl(true), nReseau, '') : '') +
        (!voitVentes && aDesPdf && hasGrp ? pdfBtn('groupement', esc(g.name), nGrp, 'pha-btn-grp') : '') +
        btnLgo +
        btnTx +
      '</div>';

    // ── Infos officine : TOUJOURS visibles (demande Will : les infos saisies doivent rester) ──
    var infos = V2.profil ? (function () {
      var cipLine = '<div class="pha-cip">CIP <b class="mono">' + esc(String(pharma.code || '—')) + '</b> · ' + esc(pharma.name || '') + '</div>';
      var grps = {}; (V2.pharmacies || []).forEach(function (p) { var gg = String(p.groupement || '').trim(); if (gg && gg !== '—') grps[gg] = 1; });
      var gopts = Object.keys(grps).sort(function (x, y) { return x.localeCompare(y, 'fr'); });
      var cur = String(pharma.groupement || '').trim();
      var grpEdit = '<label class="v2-profil-f v2-profil-f-wide" style="display:block;margin-bottom:12px"><span style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:4px">Groupement</span>' +
        '<select style="width:100%;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:10px;padding:9px 11px;font:inherit;font-size:13.5px;color:var(--ip-ink);background:var(--card-2);cursor:pointer" onchange="V2.setPharmaGroupement(\'' + esc(String(pid)) + '\', this)">' +
          '<option value="">—</option>' +
          gopts.map(function (gg) { return '<option' + (gg === cur ? ' selected' : '') + '>' + esc(gg) + '</option>'; }).join('') +
          '<option value="__add__">➕ préciser…</option>' +
        '</select></label>';
      return '<div class="v2-card pha-card pha-infos"><div class="pha-ch"><h3>Infos officine</h3><span class="pha-sub">grossistes, génériqueurs, logiciel, robot… tout ce que l\'équipe a noté</span></div>' +
        cipLine + nameEditor(pid, nameOf(pid, pharma.name)) + titEditor(pid, titulaire) + grpEdit +
        // L'en-tête dit « Téléphone et e-mail à renseigner dans Infos officine » :
        // jusqu'ici la promesse était vide, il n'y avait aucun champ où les mettre.
        V2.profil.coordSection(pid, { tel: tel, email: mail, adresse: adresse }, ['tel', 'email', 'adresse'], 'Coordonnées') +
        V2.profil.coordSection(pid, {}, ['relance_date'], 'Relance') +
        // 23/09/2026 — pré-remplissage « d'après la base clients » quand personne n'a
        // encore saisi (logiciel, grossiste principal, génériqueur(s), clé PharmaML) :
        // une saisie de l'équipe gagne toujours (fill() dans v2-profil.js).
        V2.profil.section('client', pid, {
          lgo: logiciel || '', gros1: grossiste || '',
          gen1: generiqueur ? nf(generiqueur.split(' / ')[0]) : '',
          gen2: generiqueur ? nf(generiqueur.split(' / ')[1] || '') : '',
          cle_crypto: (caBase && caBase[17]) || ''
        }) + '</div>';
    })() : '';
    var notes = V2.notes ? '<div class="pha-notes">' + (V2.rdvPrepa ? V2.rdvPrepa.section(pid) : '') + V2.notes.section('client', pid) + '</div>' : '';

    // ── Colonne « chiffres » ──
    var A = analyseData(pid, sales);
    var chiffres = '';
    // 09/10/2026 — maquette 8 « Le menu » (remplace la 1b, jugée « trop complexe ») : l'état de la fiche est posé ici,
    // la page est assemblée plus bas (carte d'identité courte, menu, une rubrique à la fois).
    if (voitVentes) l8Init(pid, A, { marge: marge, dataR: dataR, dataG: dataG, nR: nReseau, nG: nGrp, hasGrp: hasGrp });
    // 24/09/2026 — officine d'un collègue (commercial restreint) : aucun chiffre de vente,
    // ni « déjà commandé / à pousser » (ça dirait ce qu'elle achète), ni audit de marge.
    if (!voitVentes) chiffres = '<div class="v2-card pha-card"><div class="pha-sub" style="padding:16px 18px">Les chiffres de vente de cette officine sont réservés à son commercial' + (pharma.comms && pharma.comms.length ? ' (' + esc(pharma.comms.join(', ')) + ')' : '') + '.</div></div>';
    // 27/09/2026 — « Ce que cette officine devrait vendre » (v2-potentiel.js). Construit
    // sur des données PUBLIQUES (Assurance Maladie, INSEE, FINESS) : il s'affiche donc
    // AUSSI pour l'officine d'un collègue, après le message de restriction — il ne dit
    // rien de ce qu'elle achète, seulement ce que sa population laisse attendre.
    var potentielHtml = V2.potentielBloc ? V2.potentielBloc(pharma) : '';
    if (!voitVentes) chiffres += potentielHtml;

    // Best rotations du groupement / réseau : détail produit par produit, replié (inchangé)
    var rot = grpBestRotations(pid, 60);
    var nOwn = rot.rows.filter(function (r) { return r.owned; }).length;
    var nGap = rot.rows.length - nOwn;
    var shownRotAll = (grpListFilter === 'gap') ? rot.rows.filter(function (r) { return !r.owned; }) : rot.rows;
    var ROT_LOT = 15;
    var shownRot = grpRotExpanded ? shownRotAll : shownRotAll.slice(0, ROT_LOT);
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
    var listingBody = rot.rows.length ? '<div class="v2-card" style="padding:0;overflow:hidden;margin-top:8px">' +
      '<div class="phf-phead" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
        '<div><div class="phf-ptitle"><span class="phf-pdot" style="background:var(--c-opp)"></span>Best rotations ' + (rot.isGrp ? 'de son groupement · ' + esc(rot.name) : 'du réseau') + '</div>' +
          '<div class="phf-psub">les produits les plus commandés par ' + (rot.isGrp ? 'son groupement' : 'le réseau') + ' — ce qu\'elle a déjà et ce qu\'il reste à pousser</div></div>' +
        '<div class="phf-rotfilter">' +
          '<button class="phf-rf' + (grpListFilter === 'all' ? ' on' : '') + '" onclick="V2.pharmaGrpFilter(\'all\')">Tout · ' + rot.rows.length + '</button>' +
          '<button class="phf-rf' + (grpListFilter === 'gap' ? ' on' : '') + (nGap === 0 ? ' phf-rf-off" disabled title="Elle commande déjà tous les best-sellers"' : '" onclick="V2.pharmaGrpFilter(\'gap\')"') + '>À pousser · ' + nGap + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="phf-tablewrap"><table class="phf-tbl"><thead><tr>' +
        '<th class="phf-tl">Produit</th><th>Statut</th><th>Prix net IP</th><th title="Abandon de marge">Abandon</th><th class="phf-tc">Nbr pharma</th>' +
      '</tr></thead><tbody>' + rotRows + '</tbody></table></div>' +
      (!grpRotExpanded && shownRotAll.length > ROT_LOT ? '<button class="phf-rf" style="margin:10px 14px" onclick="V2.pharmaRotExpand()">Voir tout (' + shownRotAll.length + ')</button>' : '') +
      '<div class="phf-foot">' + ICO('check', 13) + ' ' + nOwn + ' déjà commandé' + (nOwn > 1 ? 's' : '') + ' · <b style="color:var(--c-amber);margin-left:4px">' + nGap + ' à pousser</b> — sur les ' + rot.rows.length + ' meilleures rotations ' + (rot.isGrp ? 'du groupement' : 'du réseau') + '.</div>' +
    '</div>' : '';
    var listing = rot.rows.length ? (function () {
      var open = sectionOpen('bestrot');
      return '<div class="ph-section">' +
        sectionHead('Voir le détail produit par produit', 'ce qu\'elle a déjà et ce qu\'il reste à pousser, ligne par ligne', 'bestrot', open) +
        (open ? listingBody : '') +
      '</div>';
    })() : '';
    // CA par génériqueur (Biogaran, Zentiva, EG…) — table BDPM ; section repliable (inchangé)
    var generiqueurSec = (function () {
      var card = V2.generiqueurCard ? V2.generiqueurCard(sales, { title: 'Ses achats par génériqueur' }) : '';
      if (!card) return '';
      var open = sectionOpen('gnq');
      return '<div class="ph-section">' +
        sectionHead('CA par génériqueur', 'combien elle achète chez Biogaran, Zentiva, EG…', 'gnq', open) +
        (open ? card : '') +
      '</div>';
    })();

    // Brief du jour (v2-brief-officine.js) : rempli après coup, sans re-rendre la fiche.
    // Posé APRÈS les chiffres (demande de Will, 22/09/2026) : une ligne de résumé qui ouvre la fenêtre.
    var briefOff = V2.briefOfficine ? '<div class="v2-card pha-card" id="brief-off" data-pid="' + esc(pid) + '"><div class="pha-sub" style="padding:12px 18px">Brief du jour en préparation…</div></div>' : '';
    // Vue « À montrer au pharmacien » (liste blanche en CSS, voir .pha-wrap[data-vue]) : son nom, son adresse,
    // son titulaire, son groupement d'achat et les rubriques sans leurs éléments internes.
    var vue = voitVentes ? L1.vue : 'commercial';
    var apercu;
    if (voitVentes) {
      // La rubrique Fiche lit les lignes de la carte d'avant (mêmes valeurs, même ordre) ; « Modifier » ouvre les formulaires existants.
      var fRows = [], tmpK = document.createElement('div');
      tmpK.innerHTML = kvHtml;
      for (var q = 0; q + 1 < tmpK.children.length; q += 2) {
        var lab = tmpK.children[q].textContent, vs = tmpK.children[q + 1];
        fRows.push({ l: lab === 'Groupement' ? 'Groupement d’achat' : lab, v: vs.innerHTML, c: vs.className });
      }
      fRows.forEach(function (r) {
        if (r.l === 'Téléphone' && tel) r.v = '<a href="tel:' + esc(tel.replace(/[^+0-9]/g, '')) + '">' + r.v + '</a>';
        if (r.l === 'E-mail' && mail) { var mailAff = mail.replace(/[\s;,]+$/, ''); r.v = '<a href="mailto:' + esc(mailAff) + '">' + esc(mailAff) + '</a>'; }
      });
      var avant = [];
      if (pharma.code) avant.push({ l: 'CIP', v: '<span class="mono">' + esc(String(pharma.code)) + '</span>', c: '' });
      avant.push({ l: 'Statut', v: (isEscale() ? 'Cliente Escale' : 'Cliente Intégral') + ficheBadge, c: '' });
      if (comms) avant.push({ l: 'Commercial', v: esc(comms), c: '' });
      if (window.REPRISES && REPRISES[String(pid)]) avant.push({ l: 'Reprise récente', v: 'Le titulaire a changé récemment : moment clé pour (re)capter la relation', c: '' });
      var rel = ''; try { if (saisi.relance_date) rel = new Date(saisi.relance_date + 'T12:00:00').toLocaleDateString('fr-FR'); } catch (e) {}
      var apres = [{ l: 'Prochaine relance', v: rel || 'à compléter', c: rel ? '' : 'pha-empty' }];
      L8_PROFIL.forEach(function (p) { if (saisi[p[0]]) apres.push({ l: p[1], v: esc(String(saisi[p[0]])), c: '' }); });
      fRows = avant.concat(fRows, apres);
      var ctx = {
        pidSafe: pidSafe, nom: esc(nameOf(pid, pharma.name)), sous: [pharma.ville || (infoRdv && infoRdv.ville) || (caBase && caBase[13]) || '', (pharma.groupement && pharma.groupement !== '—') ? canonG(pharma.groupement) : ''].filter(function (x) { return x; }).join(' · '),
        tel: tel, mail: mail, lgo: btnLgo, rows: fRows, infos: infos, notes: '<div class="l8-notes">' + notes + '</div>',
        tout: l1ToutSection(pid, A) + potentielHtml + briefOff + listing + generiqueurSec,
        vpid: '<p>' + esc([adresse, loc].filter(function (x) { return x; }).join(', ')) + '</p><p>Titulaire : ' + esc(titulaire || dirigeantsDe(oi) || '—') + '</p>' +
          '<p>Groupement d’achat : ' + esc((pharma.groupement && pharma.groupement !== '—') ? canonG(pharma.groupement) : '—') + '</p>'
      };
      apercu = l8Page(ctx);
    } else {
      apercu =
        '<div class="pha">' +
          '<div class="pha-rail">' + idCard + listes + infos + notes + '</div>' +
          '<div class="pha-main">' + chiffres + briefOff + listing + generiqueurSec + '</div>' +
        '</div>';
    }
    if (!voitVentes) { listing = ''; generiqueurSec = ''; }
    // 02/10/2026 — l'onglet « Audit marge » est retiré (décision de Will) : plus d'onglets, la fiche n'a que l'analyse.
    var tabs = '';
    // Bouton « Aujourd'hui · N » : seule commande de la ligne, calée à droite.
    if (briefOff) tabs = '<div class="ph-fiche-line">' + tabs + '<span class="bo-spacer"></span>' + V2.briefOfficine.bouton() + '</div>';

    root.innerHTML = V2.topbar({ back: true, backTo: 'pharma', backLabel: 'Officines' }) +
      '<div class="v2-wrap ph-detail pha-wrap" data-vue="' + vue + '" style="--accent:var(--pil-opp)">' +
        tabs +
        '<div id="phft-c-apercu">' + apercu + '</div>' +
      '</div>';
    document.body.classList.toggle('l8-vp', vue === 'pharmacien');
    if (voitVentes) l8Afficher();
    if (V2.profil) V2.profil.hydrate();
    if (V2.notes) V2.notes.hydrate();
    if (V2.rdvPrepa) V2.rdvPrepa.hydrate();
    if (briefOff) V2.briefOfficine.hydrate(pid, pharmaSalesAll(pid));
  }

  // Changer le groupement d'une pharmacie depuis sa fiche (correction persistée + appliquée).
  V2.setPharmaGroupement = function (pid, el) {
    var v = el && el.value;
    if (v === '__add__') {
      v = (window.prompt('Nom du groupement :', '') || '').trim();
      if (!v) { V2.render(); return; }   // annulation → on restaure l'affichage réel du select
    }
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (pharma) pharma.groupement = v || '';
    if (V2.profil && V2.profil.saveOverride) V2.profil.saveOverride(pid, { groupement: v || '' });
    if (V2.toast) V2.toast(v ? 'Groupement : ' + v : 'Groupement retiré');
    V2.render();
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
          var pid = String(selPid);
          if (pid.indexOf('GRP:') === 0) { V2.grpDownloadPdf(encodeURIComponent(pid.slice(4)).replace(/'/g, '%27')); }
          else if (pid.indexOf('LST:') === 0) { V2.listDownloadPdf(pid.slice(4)); }   // liste perso → bon PDF (avant : « Pharmacie introuvable »)
          else { V2.pharmaListPdf(pid); }
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
  // Le ✓ sert au PDF RDV immédiat et à la barre « Prépa RDV » (plus de panier de fiche depuis le 02/10/2026).
  V2.pharmaToggleSel = function (btn) {
    if (!selCips) selCips = new Set();
    var cip = btn.getAttribute('data-cip');
    if (selCips.has(cip)) {
      selCips.delete(cip);
      btn.classList.remove('on');
      btn.innerHTML = ICO('plus', 15);
    } else {
      selCips.add(cip);
      btn.classList.add('on');
      btn.innerHTML = ICO('check', 15);
      V2.toast('Retenu pour le rendez-vous');
    }
    // Surlignage de la ligne (fiche officine master-détail)
    var tr = btn.closest && btn.closest('tr.phf-picked, tr[data-cip]');
    if (tr) tr.classList.toggle('phf-picked', selCips.has(cip));
    refreshPdfBtn();
    refreshCartbar();
  };

  // Replie / déplie une section secondaire (Top 5, Best-sellers IP) sans perdre le scroll.
  // Motion : mémorise la section qui vient de S'OUVRIR pour la révéler en douceur
  // après le re-render (le contenu replié n'existe dans le DOM qu'une fois ouvert).
  var _justOpenedSection = null;
  V2.pharmaToggleSection = function (key) {
    var cur = (key in sectionCollapsed) ? sectionCollapsed[key] : true;
    sectionCollapsed[key] = !cur;
    _justOpenedSection = (!sectionCollapsed[key]) ? key : null; // ouverte → à révéler
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
  V2.pharmaSecteurTab = function (v) { secteurTab = v || 'clients'; voirArchives = false; V2.render(); };
  V2.pharmaVoirArchives = function (on) { voirArchives = !!on; V2.render(); };
  V2.promoteToClient = function (pid) {
    if (!V2.user) { if (V2.toast) V2.toast('Connecte-toi pour passer un prospect en client'); return; }
    V2.promoted = V2.promoted || {};
    V2.promoted[String(pid)] = true;
    if (V2.profil && V2.profil.saveOverride) V2.profil.saveOverride(pid, { promu: true });
    if (V2.toast) V2.toast('Passé en client ✓ — visible dans vos Clients');
    V2.render();
  };
  V2.pharmaSetComm = function (val) {
    V2.commFilter = val || '';
    V2.render();
    var sel = document.getElementById('v2-pharma-comm'); if (sel) sel.focus();
  };

  function buildPrepaHtml(pid) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    if (!pharma) return null;
    var sales = pharmaSales(pid);
    var ca = V2.sumCA(sales), marge = margeNettePharma(sales);
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
          '<td style="padding:4px 6px;font-size:12px;font-weight:600;color:#10131C">' + esc((r.designation || '').slice(0, 52)) + '</td>' +
          '<td style="padding:4px 6px;font-family:monospace;font-size:9px;color:#737A8C">' + esc(r.cip) + '</td>' +
          '<td style="padding:4px 6px;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:#0050E6">' + (r.prix_ip ? r.prix_ip.toFixed(2) + ' €' : '—') + '</td>' +
          '<td style="padding:4px 6px;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:#1E9E6A">' + V2.fmtNum(r.marketQte) + '</td>' +
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
    // Même trou que sur l'écran : `pharma.tel` seul laissait le PDF sans numéro
    // pour 473 officines sur 717. On prend la saisie de l'équipe, puis WML, puis
    // la source réconciliée par le CIP.
    var infoPrepa = (V2.rdvInfo ? V2.rdvInfo(pid) : null);
    var telPrepa = String((_coordSaisie[pid] || {}).tel || '').trim() ||
      (pharma.tel == null ? '' : String(pharma.tel)).trim() || (infoPrepa && infoPrepa.tel) || '';
    var ident = [pharma.code, pharma.ville, telPrepa].filter(function (x) { return x; }).map(esc).join('  ·  ');
    var pot = (pharma.potentiel != null && pharma.potentiel !== '') ? ('Potentiel ' + esc(String(pharma.potentiel))) : '';
    function kpiTile(l, v, col) {
      return '<div style="border:1px solid #E5E9F2;border-radius:9px;padding:9px 11px"><div style="font-size:8px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em;font-weight:700">' + l + '</div><div style="font-size:15px;font-weight:800;color:' + col + ';font-family:monospace">' + v + '</div></div>';
    }

    // Top 10 commandé par catégorie (en valeur) — cartes 2 colonnes
    var tops = ownedTopByCat(sales, 10);
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
          '<span style="font-size:12px;font-weight:800;color:#10131C;flex:1">' + esc(o.cat.label) + '</span>' +
          '<span style="font-size:8px;color:#737A8C;font-family:monospace">' + V2.fmtNum(o.total) + ' réf.</span></div>' +
        rws + '</div>';
    }).join('');
    var topCatBlock = tops.length
      ? '<h2 style="font-size:14px;font-weight:800;margin:0 0 10px;border-bottom:1px solid #E5E9F2;padding-bottom:5px">Top 10 commandé · par catégorie (en valeur)</h2>' +
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
              (ident ? '<div style="font-size:12px;color:#737A8C;margin-top:3px">' + ident + '</div>' : '') + '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0">' +
            (pharma.groupement ? '<div style="display:inline-block;font-size:9px;font-weight:800;color:#0050E6;background:#EAF0FF;border-radius:6px;padding:3px 8px">' + esc(pharma.groupement) + '</div>' : '') +
            (pot ? '<div style="font-size:12px;color:#737A8C;margin-top:5px;font-weight:700">' + pot + '</div>' : '') +
            '<div style="font-size:12px;color:#9AA1B2;margin-top:5px;font-family:monospace">' + today + '</div>' +
          '</div>' +
        '</div>' +
        // KPI
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:16px">' +
          kpiTile('CA cumulé (5 mois)', V2.fmtEur(ca), '#0050E6') +
          kpiTile('Marge nette', V2.fmtEur(marge), '#1E9E6A') +
          kpiTile('Références', V2.fmtNum(nbRefs), '#6D4FC4') +
          kpiTile('Opportunités', V2.fmtNum(totalOpp), '#C7791A') +
        '</div>' +
        // Portrait 2 colonnes
        '<div style="display:grid;grid-template-columns:1fr 1.15fr;gap:12px;margin-bottom:18px;page-break-inside:avoid">' +
          '<div style="border:1px solid #E5E9F2;border-radius:11px;padding:12px 14px">' +
            '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;margin-bottom:10px">CA par mois</div>' +
            '<div style="display:flex;align-items:flex-end;gap:7px">' + (monthBars || '<div style="font-size:12px;color:#9AA1B2">—</div>') + '</div>' +
          '</div>' +
          '<div style="border:1px solid #E5E9F2;border-radius:11px;padding:12px 14px">' +
            '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;margin-bottom:8px">Ce qu\'elle commande · par tranche</div>' +
            (trRows ? '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
              '<th style="text-align:left;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">Tranche</th>' +
              '<th style="text-align:right;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">Réfs</th>' +
              '<th style="text-align:right;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">CA</th>' +
              '<th style="text-align:right;font-size:7.5px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;padding:0 7px 4px">Marge nette</th>' +
              '</tr></thead><tbody>' + trRows + '</tbody></table>' : '<div style="font-size:12px;color:#9AA1B2">Aucune commande identifiée.</div>') +
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
          '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#737A8C;margin-bottom:7px">Notes du rendez-vous</div>' +
          '<div style="border:1px solid #E5E9F2;border-radius:10px;height:96px;background:repeating-linear-gradient(#fff,#fff 23px,#EEF1F6 23px,#EEF1F6 24px)"></div>' +
        '</div>' +
        // Footer
        '<div style="margin-top:14px;padding-top:8px;border-top:1px solid #E5E9F2;display:flex;justify-content:space-between;font-size:8px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">' +
          '<div>Intégral Pharma · Normandie · Document confidentiel</div><div>Marge nette (princeps) : 0,18€ &le;4,33€ · 4,2% &le;468€ · 19,50€ au-delà</div></div>' +
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
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, // sans windowWidth : html2pdf centre la feuille dans la fenêtre, la capture partait rognée à gauche
        jsPDF: { unit: 'pt', format: [595.5, 842.25], orientation: 'portrait' }, // 794 × 1123 px entiers : pas de dérive de 0,5 px par page
        pagebreak: { mode: ['css', 'legacy'] }
      }).save().then(function () {
        cleanP(); V2.toast('PDF téléchargé');
      }).catch(function (e) { console.error(e); cleanP(); V2.toast('Erreur PDF', 'error'); });
    }).catch(function (e) { console.error(e); V2.toast('Module PDF indisponible — vérifiez votre connexion', 'error'); });
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
    // 02/10/2026 — pièce commune « onglets » (.v2-tabs), la même que sur les autres écrans alignés
    var t = function (val, ico, label) {
      return '<button type="button" role="tab" class="v2-tab' + (active === val ? ' on' : '') + '" aria-selected="' + (active === val) + '" onclick="V2.pharmaView(\'' + val + '\')">' + ICO(ico, 18, 2) + label + '</button>';
    };
    return '<div class="v2-tabs ph-v4" role="tablist" aria-label="Vues des officines">' +
      t('officines', 'pharma', 'Officines') + t('groupements', 'opp', 'Groupements') + t('listes', 'fiche', 'Mes listes') + t('carte', 'grid', 'Carte secteur') +
    '</div>';
  }
  // Titre d'écran commun aux quatre vues (pièce .v2-tete) : un seul titre, un sous-titre, une action à droite.
  function teteOfficines(sous, action) {
    return '<div class="v2-tete"><div><h1 class="v2-titre">Mes officines</h1><p class="v2-sous">' + sous + '</p></div>' + (action || '') + '</div>';
  }
  // Menu « Commercial » (pièce .v2-select) à la place d'une pastille par prénom — seulement s'il y a plusieurs commerciaux.
  function commSelect() {
    var comms = V2.commercials ? V2.commercials() : [];
    if (comms.length < 2) return '';
    return '<label class="v2-select"><select id="v2-pharma-comm" aria-label="Commercial" onchange="V2.pharmaSetComm(this.value)">' +
      '<option value="">Commercial : Tous</option>' +
      comms.map(function (c) { return '<option value="' + esc(c) + '"' + (V2.commFilter === c ? ' selected' : '') + '>Commercial : ' + esc(c) + '</option>'; }).join('') +
      '</select><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></label>';
  }
  // 25/09/2026 — la table d'alias range fermées et statuts inconnus sous « — » : un 2e « sans
  // groupement » (9 officines) s'affichait comme un groupement à part. Un seul panier — et Intégral
  // Pharma / Themis Conseil, notés « PAS un groupement » dans la table d'alias, y vont aussi.
  function groupName(p) { var g = String(p.groupement || '').trim(), c = g ? canonG(g) : ''; return (!c || c === '—' || /PAS un groupement/.test(c)) ? '— Sans groupement' : c; }
  function grpLogo(name, big) {
    // ⚠️ 15/08/2026 — les 3,6 Mo de logos ont quitté le fichier de ventes.
    // Ils ne se chargent plus au démarrage mais ICI, au premier écran qui en
    // affiche. En attendant, on montre les initiales : personne ne voit un
    // écran vide, et l'iPhone n'a pas à digérer 3,6 Mo d'images pour ouvrir
    // l'app. Une fois arrivés, on redessine.
    if (!window.GRP_LOGOS && !V2._grpLogosDemande && V2.loadFiles) {
      V2._grpLogosDemande = true;
      V2.loadFiles(['grplogos']).then(function () { if (V2.render) V2.render(); });
    }
    var l = window.GRP_LOGOS && window.GRP_LOGOS[name];
    // Les logos sont indexés par les noms BRUTS des fichiers WML ; le listing
    // affiche désormais les noms canoniques (GRP_ALIAS) → on indexe aussi les
    // logos par nom canonique, sinon 13 groupements retomberaient en initiales.
    if (!l && window.GRP_LOGOS) {
      if (!V2._grpLogoCanon || V2._grpLogoCanonRef !== window.GRP_LOGOS) {
        var m = {};
        Object.keys(window.GRP_LOGOS).forEach(function (k) { var c = canonG(k); if (!m[c]) m[c] = window.GRP_LOGOS[k]; });
        V2._grpLogoCanon = m; V2._grpLogoCanonRef = window.GRP_LOGOS;
      }
      l = V2._grpLogoCanon[name];
    }
    var cls = 'grp-logo' + (big ? ' grp-logo-big' : '');
    if (l) return '<span class="' + cls + '"><img src="' + esc(l) + '" alt=""></span>';
    var ini = String(name || '?').replace(/[^A-Za-zÀ-ÿ0-9]+/g, ' ').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '?';
    return '<span class="' + cls + ' grp-logo-x">' + esc(ini) + '</span>';
  }
  // Vue Groupements = vue d'équipe : TOUJOURS toutes les pharmacies des 4
  // commerciaux, sans tenir compte du filtre commercial.
  var grpListSort = 'active';   // 'active' (par défaut, nb pharmacies actives) | 'name' (alphabétique)
  // Recherche du sous-écran « Listes d'achats à proposer » (Karine, 17/09/2026, aee2d602).
  // Variable de module (pas seulement la valeur du <input>) : elle survit à l'ouverture
  // d'un groupement puis au retour, tant que l'onglet Groupements reste ouvert.
  var grpListSearch = '';
  function grpSearchNorm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  }
  function groupementList() {
    var byG = {};
    (V2.pharmacies || []).forEach(function (p) {
      var g = groupName(p);
      (byG[g] = byG[g] || { name: g, members: [] }).members.push(p);
    });
    var list = Object.keys(byG).map(function (g) {
      var o = byG[g];
      o.nb = o.members.length;
      o.active = o.members.filter(function (p) { return aDesVentes(p.id); }).length;
      return o;
    });
    if (grpListSort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }); });
    else list.sort(function (a, b) { return b.active - a.active || b.nb - a.nb; });
    if (grpListSearch) {
      var q = grpSearchNorm(grpListSearch);
      list = list.filter(function (g) { return grpSearchNorm(g.name).indexOf(q) >= 0; });
    }
    return list;
  }
  V2.grpListSortSet = function (mode) { grpListSort = mode === 'name' ? 'name' : 'active'; V2.render(); };
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
    var rm = Object.keys(overridesGet(ovKey).removed).length, enc = encodeURIComponent(ovKey).replace(/'/g, '%27');
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:-4px 0 12px;flex-wrap:wrap">' +
      (rm ? '<button class="v2-btn v2-btn-ghost" onclick="V2.itemRestoreAll(\'' + enc + '\')">' + ICO('back', 15) + rm + ' produit' + (rm > 1 ? 's' : '') + ' masqué' + (rm > 1 ? 's' : '') + ' · réafficher</button>' : '<span></span>') +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.itemAddOpen(\'' + enc + '\')">' + ICO('plus', 16) + 'Ajouter un produit</button>' +
    '</div>';
  }

  // Biosimilaires absents de BENCHMARK (figé au 07/05/2026) : mesuré le 15/09/2026, 39 biosimilaires
  // vendus sur le réseau n'y figuraient pas et n'apparaissaient donc jamais (décision Will : option 1).
  // Reconnus par la base officielle (window.BIOSIMILAIRES), libellé et prix pris au catalogue complet.
  var _biosimCips = null, _biosimSrc = null, _catDemande = false;
  function biosimHorsCatalogue(cip) {
    var B = window.BIOSIMILAIRES;
    if (!B || !B.molecules) return null;
    if (_biosimSrc !== B) {              // la base protégée peut remplacer la publique en cours de route
      _biosimSrc = B; _biosimCips = {};
      B.molecules.forEach(function (m) { (m.biosimilaires || []).forEach(function (s) { (s.cips || []).forEach(function (c) { _biosimCips[c] = 1; }); }); });
    }
    if (!_biosimCips[cip]) return null;
    var cat = V2.produits && V2.produits.catalogueIndex ? V2.produits.catalogueIndex() : null;
    var r = cat && cat[cip];
    if (!r) return null;
    // net du 22/06 parfois AU-DESSUS du PPHT (22 codes adalimumab/tocilizumab : tarif baissé depuis) :
    // on n'affiche alors que le PPHT, jamais un prix net plus cher que le tarif.
    return { cip13: cip, designation: r.d, artnature: 'biosimilaire', has_ameli: true, prix_ht: r.ppht,
             prix_ip: (r.net > 0 && r.net <= r.ppht) ? r.net : null };
  }
  // 25/09/2026 — 1 221 produits vendus (≈ 3,3 M€, Entresto 798 k€, Ozempic, Takhzyro…) manquaient au
  // BENCHMARK du 07/05 : invisibles dans toutes les listes de groupement. Même rattrapage que les
  // biosimilaires, pour toutes les familles : fiche reconstituée depuis le catalogue complet, tarif
  // du jour (PPHT), tranche recalculée, net jamais au-dessus du PPHT, barème d'abandon pour un princeps.
  function horsBenchmark(cip) {
    var cat = V2.produits && V2.produits.catalogueIndex ? V2.produits.catalogueIndex() : null;
    var r = cat && cat[cip]; if (!r) return null;
    var pp = (window.PPHT && window.PPHT[cip] > 0) ? window.PPHT[cip] : (r.ppht > 0 ? r.ppht : 0);
    var f = r.f, pr = f === 'pr_low' || f === 'pr_mid' || f === 'pr_high';
    var net = (r.net > 0 && pp > 0 && r.net <= pp) ? r.net
      : ((pr || f === 'biosim') && pp > 0 && V2.abandonBareme) ? Math.round((pp - V2.abandonBareme(pp)) * 100) / 100 : pp;
    // Générique d'un labo partenaire (EG · Zentiva · Zydus · Teva, confirmé par Will le 04/08) → « Génériques partenaires ».
    var genp = f === 'gen' && /^(EG|ZENTIVA|ZYDUS|TEVA)\b/i.test(r.labo || '');
    return { cip13: cip, designation: r.d, prix_ht: pp, prix_ip: net > 0 ? net : null, has_ameli: f !== 'nr',
             artnature: genp ? 'generique_partenaire' : (f === 'gen' ? 'generique' : (f === 'biosim' ? 'biosimilaire' : '')),
             categorie: pr ? (pp <= 4.33 ? 'pp' : (pp <= 468 ? 'mi' : 'ch')) : '' };
  }
  // Le catalogue complet (1,3 Mo) arrive sans bloquer l'écran ; la liste se redessine à son arrivée.
  function demanderCatComplet() {
    if (window.CATALOGUE_COMPLET || _catDemande || !V2.loadFiles) return;
    _catDemande = true;
    var fin = function () { if (window.CATALOGUE_COMPLET && V2.route && V2.route.name === 'pharma') V2.render(); };
    V2.loadFiles(['catcomplet']).then(fin, fin);
  }

  // Agrégation des achats pour un ENSEMBLE de pharmacies (ids = {pharmacyId:1}).
  // Mutualisé par les groupements ET les listes personnalisées.
  // ovKey (optionnel) : applique les produits retirés/ajoutés à la main.
  function productsForIds(ids, ovKey) {
    var bIdx = benchIndex(), byCip = {}, activeSet = {};
    // 24/09/2026 — confidentialité : une liste personnalisée ou un petit groupement (< 5 officines)
    // trahirait les achats d'une officine précise → seulement les siennes pour un commercial restreint.
    // Un groupement d'au moins 5 officines reste un agrégat par produit (accepté par Will).
    if (V2.ventesRestreintes() && !(String(ovKey || '').indexOf('GRP:') === 0 && Object.keys(ids).length >= 5)) {
      var idsV = {}; Object.keys(ids).forEach(function (k) { if (V2.voitVentesDe(k)) idsV[k] = ids[k]; }); ids = idsV;
    }
    (V2.sales || []).forEach(function (s) {
      if (!ids[String(s.pharmacyId)]) return;
      var cip = String(s.artCode || ''); if (cip.length < 7) return;
      activeSet[String(s.pharmacyId)] = 1;
      var e = byCip[cip] || (byCip[cip] = { ph: {}, qte: 0, ca: 0 });
      e.ph[String(s.pharmacyId)] = 1; e.qte += s.qte || 0; e.ca += s.mntNetHt || 0;
    });
    // 05/10/2026 — commercial restreint : le groupement ENTIER, pas ses seules officines (agregatGroupement)
    var ag = String(ovKey || '').indexOf('GRP:') === 0 ? agregatGroupement(String(ovKey).slice(4)) : null;
    if (ag) Object.keys(ag.nb).forEach(function (cip) {
      (byCip[cip] || (byCip[cip] = { ph: {}, qte: 0, ca: 0 })).n = ag.nb[cip];
    });
    var nbPh = function (e) { return e.n || Object.keys(e.ph).length; };
    var ov = ovKey ? overridesGet(ovKey) : { removed: {}, added: {} };
    // produits ajoutés manuellement et non commandés par le panel : entrée vide (sortie 0)
    Object.keys(ov.added).forEach(function (cip) { if (!byCip[cip]) byCip[cip] = { ph: {}, qte: 0, ca: 0, manual: true }; });
    // seuil de diffusion : un produit n'apparaît que s'il est commandé par >= 20% des pharmacies
    // (actives) du groupement (les produits ajoutés à la main passent toujours).
    var panel0 = ag ? ag.panel : Object.keys(activeSet).length;
    var seuil = Math.max(1, Math.ceil(panel0 * 0.20));
    // Biosimilaires : peu de boîtes par officine et jamais les mêmes d'une officine à
    // l'autre → à 20 %, Leadersanté (80 phies) en montrait 1 sur 18 commandés.
    // Décision Will 15/09/2026 : un biosimilaire apparaît dès 2 pharmacies du groupement.
    var seuilBiosim = Math.min(seuil, 2);
    var buckets = {}; CATS.forEach(function (c) { buckets[c.key] = []; });
    Object.keys(byCip).forEach(function (cip) {
      if (ov.removed[cip]) return;                       // produit retiré à la main
      var b = bIdx.get(cip) || biosimHorsCatalogue(cip) || horsBenchmark(cip); if (!b) return;
      var cat = classify(b, cip); if (!cat || !buckets[cat]) return;
      if (!byCip[cip].manual && nbPh(byCip[cip]) < (cat === 'biosim' ? seuilBiosim : seuil)) return;   // < 20% des pharmacies (biosim : < 2) → masqué
      // Prix : toujours via V2.bestPrice() (gère offre labo + barème d'abandon) — cette
      // fonction recalculait son propre prix "à la main" sur b.prix_ht/prix_ip/offre_ip
      // bruts, donc ratait toutes les corrections faites dans applyPPHT()/fusionsProtegees()
      // (produits froid, princeps mal classés NR, biosimilaires, génériques sans prix —
      // signalé par Will le 10/09/2026, ce moteur alimente Groupements + Listes + leurs PDF/Excel).
      var e = byCip[cip], bp = V2.bestPrice(b);
      if (!bp.ht && !bp.ip) return;   // 25/09/2026 — ni PPHT ni prix net connus : jamais « 0 € » sur un document
      buckets[cat].push({ cip: cip, designation: b.designation, prix_ht: bp.ht || 0, prix_ip: bp.ip || 0,
                          offre: bp.offre, remise: bp.remise,
                          froid: estFroid(b, cip), sortie: nbPh(e), qte: e.qte, manual: !!e.manual });
    });
    return {
      panel: panel0,
      members: Object.keys(ids).length,
      ovKey: ovKey || '',
      cats: CATS.map(function (c) {
        return { cat: c, rows: buckets[c.key].sort(function (a, b) { return b.sortie - a.sortie || b.qte - a.qte; }) };
      }).filter(function (o) { return o.rows.length; })
    };
  }

  // Compteur + lignes de la liste — extrait à part pour ne redessiner QUE ce
  // bloc à chaque frappe dans la recherche (le champ garde le focus et le curseur).
  function grpListBody() {
    var list = groupementList();
    var n = list.length;
    var rows = list.map(function (g) {
      return '<a class="v2-row" onclick="V2.pharmaGroup(\'' + encodeURIComponent(g.name).replace(/'/g, '%27') + '\')">' +
        grpLogo(g.name) +
        '<span class="v2-row-name">' + esc(g.name) + '</span>' +
        '<span class="v2-row-opp mono">' + g.active + ' / ' + g.nb + ' actives</span>' +
        '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
    }).join('');
    var empty = grpListSearch
      ? '<div class="v2-empty"><div class="v2-empty-d">Aucun groupement ne correspond à « ' + esc(grpListSearch) + ' ».</div></div>'
      : '<div class="v2-empty"><div class="v2-empty-d">Aucun groupement.</div></div>';
    return '<div class="v2-grp-count mono" style="font-size:12px;color:var(--muted);font-weight:600;padding:0 2px 12px">' +
        n + ' groupement' + (n > 1 ? 's' : '') +
      '</div>' + (rows || empty);
  }
  function renderGroupementsList(root) {
    var sortBar =
      '<div class="v2-card" style="margin-top:16px;padding:10px 14px;display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:12px;color:var(--muted);font-weight:600">Trier :</span>' +
        '<div class="v2-segs">' +
          '<button type="button" class="v2-seg' + (grpListSort === 'active' ? ' on' : '') + '" style="--sc:var(--ip-blue)" onclick="V2.grpListSortSet(\'active\')">Activité</button>' +
          '<button type="button" class="v2-seg' + (grpListSort === 'name' ? ' on' : '') + '" style="--sc:var(--ip-blue)" onclick="V2.grpListSortSet(\'name\')">Nom (A→Z)</button>' +
        '</div>' +
      '</div>';
    var searchBar =
      '<div class="v2-search" style="margin-top:16px;padding:12px 16px">' + ICO('search', 18, 2) +
        '<input id="v2-grp-search" placeholder="Rechercher un groupement…" autocomplete="off" value="' + esc(grpListSearch) + '">' +
        '<button type="button" id="v2-grp-search-x" class="v2-grp-search-x" aria-label="Effacer la recherche" onclick="V2.grpListSearchClear()"' +
          (grpListSearch ? '' : ' style="display:none"') + '>' + ICO('close', 16, 2) + '</button>' +
      '</div>';
    // 02/10/2026 — même tête et mêmes onglets que « Mes listes » et « Carte secteur » (la vue n'avait plus aucune porte depuis l'accueil à grandes portes)
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap v2-u">' +
        teteOfficines('Opportunités par groupement · ce que commandent les pharmacies adhérentes — liste d\'achats à pousser.') +
        pharmaTabs('groupements') +
        sortBar +
        searchBar +
        '<div class="v2-card" style="margin-top:16px" id="v2-grp-list-card">' + grpListBody() + '</div>' +
      '</div>';
    // Recherche live : on ne re-render QUE la liste (+ compteur) pour préserver
    // le focus et le curseur du champ (même modèle que la recherche officines).
    var inp = document.getElementById('v2-grp-search');
    if (inp) {
      inp.addEventListener('input', function () {
        grpListSearch = inp.value;
        var card = document.getElementById('v2-grp-list-card');
        if (card) card.innerHTML = grpListBody();
        var x = document.getElementById('v2-grp-search-x');
        if (x) x.style.display = grpListSearch ? '' : 'none';
      });
    }
  }
  V2.grpListSearchClear = function () {
    grpListSearch = '';
    var inp = document.getElementById('v2-grp-search'); if (inp) inp.value = '';
    var card = document.getElementById('v2-grp-list-card'); if (card) card.innerHTML = grpListBody();
    var x = document.getElementById('v2-grp-search-x'); if (x) x.style.display = 'none';
    if (inp) inp.focus();
  };

  function renderGrpCatCard(o, idx, panel, ovKey) {
    var c = o.cat, key = 'g_' + c.key;
    var enc = ovKey ? encodeURIComponent(ovKey).replace(/'/g, '%27') : '';
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
    // 25/09/2026 — plus de plafond à 80 lignes : l'en-tête annonçait « 432 produits » et n'en montrait
    // que 80, alors que le PDF et l'Excel les donnent tous. L'écran montre ce que le document contient.
    var trs = o.rows.map(function (r, i) {
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
      '<thead><tr><th class="num">#</th><th>Produit</th><th>CIP</th><th class="num">Prix net</th><th class="num" title="Abandon de marge">Abandon</th>' +
      '<th class="num">Nbr pharma</th><th></th>' + (enc ? '<th></th>' : '') + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    return '<div class="v2-card v2-cat open">' + head + body + '</div>';
  }

  function renderGroupementDetail(root, grpName) {
    if (!window.BENCHMARK) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du catalogue…</div></div>';
      V2.loadFiles(['bench', 'sagitta']).then(function () { if (V2.route && V2.route.name !== 'pharma') return; /* 11/09/2026 (phase 4) : l'écran a pu changer pendant l'attente */ V2.render(); });
      return;
    }
    demanderCatComplet();
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
            '<button id="v2-opp-pdf" class="v2-btn v2-btn-primary" onclick="V2.grpDownloadPdf(\'' + encodeURIComponent(grpName).replace(/'/g, '%27') + '\')">' +
              ICO('download', 17) + (selCips && selCips.size ? 'Liste · ' + selCips.size + ' produit' + (selCips.size > 1 ? 's' : '') : 'Liste d\'achats (PDF)') + '</button>' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.grpDownloadXlsx(\'' + encodeURIComponent(grpName).replace(/'/g, '%27') + '\')">' + ICO('download', 16) + 'Excel</button>' +
            (V2.canShareFiles && V2.canShareFiles() ? '<button class="v2-btn v2-btn-ghost" onclick="V2.grpDownloadPdf(\'' + encodeURIComponent(grpName).replace(/'/g, '%27') + '\',\'share\')">' + ICO('spark', 16) + 'Partager</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    // ── Pharmacies membres du groupement ──
    var members = (V2.pharmacies || []).filter(function (p) {
      return groupName(p) === grpName;
    }).map(function (p) {
      var ps = pharmaSalesAll(p.id);
      return { p: p, ca: V2.sumCA(ps), active: aDesVentes(p.id), voit: V2.voitVentesDe(p.id) };
    }).sort(function (a, b) { return (b.active - a.active) || (b.ca - a.ca); });
    var memRows = members.map(function (m) {
      return '<a class="v2-row" onclick="V2.go(\'pharma\',\'' + esc(String(m.p.id)) + '\')">' +
        '<span class="v2-row-dot" style="background:' + esc(m.p.color || 'var(--c-cat)') + '"></span>' +
        '<span class="v2-row-name">' + esc(m.p.name) + (m.p.ville ? ' <span style="color:var(--muted);font-weight:500">· ' + esc(m.p.ville) + '</span>' : '') + '</span>' +
        (m.active ? (m.voit ? '<span class="v2-row-val mono">' + V2.fmtEur(m.ca) + '</span>' : '<span class="v2-row-meta">cliente</span>') : '<span class="v2-row-meta">non cliente</span>') +
        '<span class="v2-row-chev">' + ICO('chev', 16) + '</span>' +
      '</a>';
    }).join('');
    var membersCard =
      '<div class="v2-card" style="margin-bottom:22px">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pharma', 17) + 'Pharmacies du groupement</div>' +
          '<span class="v2-card-link" style="cursor:default;color:var(--muted)">' + members.length + ' · ' + data.panel + ' cliente' + (data.panel > 1 ? 's' : '') + '</span></div>' +
        (memRows || '<div class="v2-empty"><div class="v2-empty-d">Aucune pharmacie de ce groupement dans vos données.</div></div>') +
      '</div>';
    var catsHtml = data.cats.length
      ? data.cats.map(function (o, i) { return renderGrpCatCard(o, i, data.panel, data.ovKey); }).join('')
      : '<div class="v2-empty"><div class="v2-empty-d">Aucun achat identifié pour ce groupement.</div></div>';
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap ph-detail" style="--accent:var(--pil-opp)">' +
        '<button class="v2-back" style="margin-bottom:16px" onclick="V2.pharmaGroupBack()">' + ICO('back', 16) + 'Tous les groupements</button>' +
        hero +
        membersCard +
        (V2.profil ? V2.profil.section('groupement', grpName) : '') +
        (V2.notes ? V2.notes.section('groupement', grpName) : '') +
        sectionHead('Liste d\'achats idéale', 'produits triés par nombre de pharmacies qui les commandent (Sortie)') +
        prodToolbar(data.ovKey) +
        catsHtml +
      '</div>' +
      pharmaCartbar();
    if (V2.profil) V2.profil.hydrate();
    if (V2.notes) V2.notes.hydrate();

    refreshCartbar();
  }

  // ── Handlers groupements ──
  V2.pharmaView = function (v) { pharmaView = v; selGroup = null; selList = null; V2.render(); };
  V2.pharmaGroup = function (enc) {
    try { selGroup = decodeURIComponent(enc); } catch (e) { selGroup = enc; }
    // 19/09/2026 (Karine, aee2d602) — ouvrir un groupement ne changeait pas le hash :
    // le bouton PRÉCÉDENT du navigateur sortait alors carrément de l'onglet Groupements
    // au lieu d'y revenir. On pousse une entrée d'historique dédiée (même adresse) ;
    // le popstate ci-dessous la referme comme le bouton « Retour » de l'appli.
    try { history.pushState({ v2GrpDetail: true }, '', location.href); } catch (e) {}
    V2.render(); window.scrollTo(0, 0);
  };
  V2.pharmaGroupBack = function () {
    try {
      if (selGroup && window.history.state && window.history.state.v2GrpDetail) { window.history.back(); return; }
    } catch (e) {}
    selGroup = null; V2.render();
  };
  // Bouton précédent du navigateur depuis un groupement ouvert : referme le détail et
  // republie la liste — recherche (grpListSearch) et tri (grpListSort) restent en mémoire,
  // ce sont des variables de module, pas des valeurs lues dans le DOM qu'on vient de jeter.
  window.addEventListener('popstate', function () {
    if (selGroup && V2.route && V2.route.name === 'pharma') { selGroup = null; V2.render(); }
  });

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
    if (ql.length < 2) { box.innerHTML = '<div style="padding:22px;text-align:center;color:var(--muted)">Tapez au moins 2 lettres pour chercher un produit du catalogue.</div>'; return; }
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
    var ca = V2.sumCA(sales);
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
          '<td style="padding:3px 0;font-size:12px;font-weight:600;color:#10131C"><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:' + r.c.color + ';margin-right:6px;vertical-align:middle"></span>' + esc(r.c.label) + '</td>' +
          '<td style="padding:3px 0;text-align:right;font-size:12px;font-family:' + MONO + ';color:#737A8C">' + V2.fmtNum(r.refs) + ' réfs</td>' +
          '<td style="padding:3px 0;text-align:right;font-size:12px;font-family:' + MONO + ';font-weight:700;color:#10131C">' + V2.fmtEur(r.ca) + '</td>' +
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
        kpiTile('Réf. commandées', V2.fmtNum(nbRefs), '#10131C', '') +
        grpTile +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<div style="flex:0 0 230px;border:1px solid #E7EBF2;border-radius:8px;padding:10px 12px">' +
          '<div style="font-size:8.5px;font-weight:800;letter-spacing:.8px;color:#737A8C;text-transform:uppercase;margin-bottom:9px">CA par mois</div>' +
          '<div style="display:flex;align-items:flex-end;gap:9px;height:74px">' + (colBars || '<div style="font-size:12px;color:#9AA1B2">—</div>') + '</div>' +
        '</div>' +
        '<div style="flex:1;border:1px solid #E7EBF2;border-radius:8px;padding:10px 12px">' +
          '<div style="font-size:8.5px;font-weight:800;letter-spacing:.8px;color:#737A8C;text-transform:uppercase;margin-bottom:8px">Ce qu\'elle commande déjà · par tranche</div>' +
          (trRows ? '<table style="width:100%;border-collapse:collapse;table-layout:fixed"><colgroup><col style="width:44%"><col style="width:28%"><col style="width:28%"></colgroup><tbody>' + trRows + '</tbody></table>' : '<div style="font-size:12px;color:#9AA1B2">Aucune commande identifiée.</div>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // 23/09/2026 — demande de Will : le PDF officine montre aussi CE QU'ELLE COMMANDE,
  // toutes familles confondues (le top 5 par tranche ne suffisait pas), avant ses opportunités.
  var PDF_TOP_VENTES = 50;
  function topVentesData(pid) {
    var sales = pharmaSales(pid);
    if (!sales.length) return null;
    var bIdx = benchIndex(), by = {}, caTot = 0;
    // nom de secours : catalogue complet (produits absents du BENCHMARK, ventes compactes sans libellé)
    var cc = V2.produits && V2.produits.catalogueIndex ? V2.produits.catalogueIndex() : null;
    sales.forEach(function (s) {
      var cip = String(s.artCode || ''); if (cip.length < 7) return;
      var e = by[cip];
      if (!e) {
        var b = bIdx.get(cip), ck = b ? classify(b, cip) : null;
        e = by[cip] = { cip: cip, designation: (b && b.designation) || s.artDesignation || (cc && cc[cip] && cc[cip].d) || cip, cat: CATS.filter(function (c) { return c.key === ck; })[0] || null, ca: 0, qte: 0 };
      }
      e.ca += s.mntNetHt || 0; e.qte += s.qte || 0;
    });
    var all = Object.keys(by).map(function (k) { return by[k]; }).filter(function (r) { return r.ca > 0; });
    all.forEach(function (r) { caTot += r.ca; });
    all.sort(function (a, b) { return b.ca - a.ca; });
    var rows = all.slice(0, PDF_TOP_VENTES);
    if (!rows.length) return null;
    return { rows: rows, nb: all.length, caTot: caTot, caTop: rows.reduce(function (a, r) { return a + r.ca; }, 0) };
  }
  function topVentesPdfHtml(pid) {
    var t = topVentesData(pid);
    if (!t) return '';
    var MONO = "'Geist Mono',ui-monospace,monospace";
    var rows = t.rows, caTot = t.caTot, caTop = t.caTop, all = { length: t.nb };
    var COLS = '<colgroup><col style="width:5%"><col style="width:39%"><col style="width:22%"><col style="width:10%"><col style="width:14%"><col style="width:10%"></colgroup>';
    var th = function (h, al) { return '<th style="text-align:' + al + ';padding:6px 8px;font-size:8.5px;font-weight:800;letter-spacing:.6px;color:#FFFFFF;text-transform:uppercase">' + h + '</th>'; };
    var trs = rows.map(function (r, i) {
      var c = r.cat;
      return '<tr style="page-break-inside:avoid;background:' + (i % 2 ? '#F7F9FC' : '#FFFFFF') + ';border-bottom:1px solid #F1F4F9">' +
        '<td style="padding:6px 8px;font-family:' + MONO + ';font-size:9px;color:#9AA1B2">' + (i + 1) + '</td>' +
        '<td style="padding:6px 8px;font-size:12px;font-weight:700;color:#10131C">' + esc(String(r.designation).slice(0, 52)) + '</td>' +
        '<td style="padding:6px 8px;font-size:9px;color:#4A5163;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:' + (c ? c.color : '#C9CFDA') + ';margin-right:5px;vertical-align:middle"></span>' + esc(c ? c.label : 'Autres') + '</td>' +
        '<td style="padding:6px 8px;text-align:right;font-family:' + MONO + ';font-size:9.5px;color:#10131C">' + V2.fmtNum(r.qte) + '</td>' +
        '<td style="padding:6px 8px;text-align:right;font-family:' + MONO + ';font-size:12px;font-weight:800;color:#10131C;white-space:nowrap">' + V2.fmtEur(r.ca) + '</td>' +
        '<td style="padding:6px 8px;text-align:right;font-family:' + MONO + ';font-size:9px;color:#737A8C">' + (caTot > 0 ? (r.ca / caTot * 100).toFixed(1).replace('.', ',') + ' %' : '—') + '</td>' +
      '</tr>';
    }).join('');
    return '<div style="margin-bottom:16px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;border-top:2px solid #10131C;padding-top:9px;margin-bottom:9px;page-break-after:avoid">' +
        '<div style="font-size:12px;font-weight:800;color:#10131C">Ce qu\'elle commande <span style="color:#737A8C;font-weight:600;font-size:12px">— ses ' + rows.length + ' premiers produits, toutes familles</span></div>' +
        '<div style="font-size:9px;color:#737A8C">' + (caTot > 0 ? Math.round(caTop / caTot * 100) + ' % de son CA · ' : '') + V2.fmtNum(all.length) + ' réf. commandées</div>' +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #E7EBF2">' + COLS +
        '<thead><tr style="background:#10131C">' + th('#', 'left') + th('Produit', 'left') + th('Famille', 'left') + th('Boîtes', 'right') + th('CA HT', 'right') + th('Part', 'right') + '</tr></thead>' +
        '<tbody>' + trs + '</tbody></table>' +
    '</div>';
  }

  // 24/09/2026 — Will : les 5 styles aussi pour le PDF d'un CLIENT. Mêmes contenus que
  // recapPdfHtml + topVentesPdfHtml, en données brutes : chaque style les met en page.
  function clientPdfData(pid) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    var sales = pharma ? pharmaSales(pid) : [];
    if (!sales.length) return null;
    var oc = ownedByCat(sales);
    return {
      ca: V2.sumCA(sales),
      refs: new Set(sales.map(function (s) { return String(s.artCode || ''); }).filter(function (c) { return c.length >= 7; })).size,
      lieu: pharma.groupement ? ['Groupement', pharma.groupement] : ['Ville', pharma.ville || '—'],
      code: [pharma.code, pharma.ville].filter(function (x) { return x; }).join(' · '),
      mois: monthlyCA(sales).map(function (m) { return { m: cap(MN_SHORT[m.month - 1]), ca: m.ca }; }),
      tranches: CATS.map(function (c) { var b = oc.buckets[c.key]; return { label: c.label, color: c.color, refs: b.refs.size, ca: b.ca }; })
        .filter(function (r) { return r.refs > 0; }).sort(function (a, b) { return b.ca - a.ca; }),
      top: topVentesData(pid),
      fmtEur: V2.fmtEur, fmtK: V2.fmtK, fmtNum: V2.fmtNum
    };
  }

  function achatsPdf(title, data, useSel, mode, portraitPid, prospectNom) {
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
    var headName = pharma ? pharma.name : (prospectNom || grpName);
    var headSub = pharma ? [pharma.code, pharma.ville].filter(function (x) { return x; }).join(' · ') : (panel + ' pharmacies du panel');
    var COLS6 = '<colgroup><col style="width:34%"><col style="width:15%"><col style="width:14%"><col style="width:11%"><col style="width:15%"><col style="width:11%"></colgroup>';

    // ── Familles (en-tête de famille coloré + table dense, design "Tableau dense pro") ──
    var catHtml = sections.map(function (o) {
      var trs = o.rows.map(function (r, i) {
        var bg = (i % 2 === 1) ? '#F7F9FC' : '#FFFFFF';
        var badge = (r.froid ? ' <span style="font-size:7px;font-weight:800;color:#0086A3;background:#E3F7FB;padding:1px 5px;border-radius:4px;vertical-align:middle">FROID</span>' : '') +
          (r.offre ? ' <span style="font-size:7px;font-weight:800;color:#1E9E6A;background:#E6F6EE;padding:1px 5px;border-radius:4px;vertical-align:middle">OFFRE</span>' : '');
        return '<tr style="page-break-inside:avoid;background:' + bg + ';border-bottom:1px solid #F1F4F9">' +
          '<td style="padding:6px 8px;font-size:12px;font-weight:700;color:#10131C">' + esc((r.designation || '').slice(0, 52)) + badge + '</td>' +
          '<td style="padding:6px 8px;font-family:' + MONO + ';font-size:9px;color:#737A8C">' + esc(r.cip) + '</td>' +
          '<td style="padding:6px 8px;text-align:right;font-family:' + MONO + ';font-size:9.5px;color:#B6BFCE;white-space:nowrap">' + (r.prix_ht > 0 ? (r.prix_ip > 0 && r.prix_ip < r.prix_ht ? '<span style="text-decoration:line-through">' + e2(r.prix_ht) + '</span>' : e2(r.prix_ht)) : '—') + '</td>' +
          '<td style="padding:6px 8px;text-align:right;font-family:' + MONO + ';font-size:12px;font-weight:800;color:#0050E6;white-space:nowrap">' + (r.prix_ip ? e2(r.prix_ip) : '—') + '</td>' +
          '<td style="padding:6px 8px;text-align:center;font-family:' + MONO + ';font-size:9.5px;color:#10131C">' + r.sortie + '<span style="color:#A8AFBE">/' + panel + '</span></td>' +
          '</tr>';
      }).join('');
      return '<div style="page-break-after:avoid;page-break-inside:avoid;margin-top:11px">' +
        '<div style="background:' + o.cat.color + ';display:flex;align-items:center;justify-content:space-between;padding:4px 10px;border-radius:5px 5px 0 0">' +
          '<span style="color:#FFFFFF;font-size:12px;font-weight:800;letter-spacing:.4px;text-transform:uppercase">' + esc(o.cat.label) + (o.cat.sub ? ' <span style="font-weight:600;color:rgba(255,255,255,.8)">· ' + esc(o.cat.sub) + '</span>' : '') + '</span>' +
          '<span style="color:rgba(255,255,255,.85);font-size:9px;font-weight:700">' + o.rows.length + ' produit' + (o.rows.length > 1 ? 's' : '') + '</span>' +
        '</div></div>' +
        '<table style="width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #E7EBF2;border-top:none">' + COLS6 +
          '<tbody>' + trs + '</tbody></table>';
    }).join('');

    var thd = function (h, al, light) { return '<th style="text-align:' + al + ';padding:6px 8px;font-size:8.5px;font-weight:800;letter-spacing:.6px;color:' + (light ? '#C7D2E6' : '#FFFFFF') + ';text-transform:uppercase">' + h + '</th>'; };

    var html = '<div style="width:794px;background:#FFFFFF;color:#10131C;font-family:Satoshi,Inter,system-ui,sans-serif;font-size:12px;line-height:1.35">' +
      // Bandeau en-tête
      '<div style="background:linear-gradient(90deg,#0034A0,#0050E6);padding:14px 22px;display:flex;align-items:center;justify-content:space-between;page-break-inside:avoid">' +
        '<div style="display:flex;align-items:center;gap:13px">' +
          '<div style="width:34px;height:34px;border-radius:8px;background:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:800;color:#0050E6;font-size:17px;letter-spacing:-1px">IP</div>' +
          '<div><div style="color:#FFFFFF;font-size:15px;font-weight:800;line-height:1.1">Intégral Pharma</div>' +
            '<div style="color:#A9C2F5;font-size:12px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;margin-top:2px">' + (pharma ? 'Ses achats · ses opportunités' : 'Liste d\'achats recommandée') + '</div></div>' +
        '</div>' +
        '<div style="text-align:right;color:#FFFFFF">' +
          '<div style="font-size:12px;font-weight:700">' + esc(headName) + '</div>' +
          '<div style="font-size:12px;color:#A9C2F5;margin-top:1px">' + esc(headSub) + '</div>' +
          '<div style="font-size:12px;color:#A9C2F5;margin-top:1px">Édité le ' + dateStr + ' · <span style="color:#FFFFFF;font-weight:700">' + totalProd + (prospectNom ? ' produits' : ' produits à pousser') + '</span></div>' +
        '</div>' +
      '</div>' +
      // Sous-bandeau référence
      '<div style="background:#10131C;padding:6px 22px;page-break-inside:avoid">' +
        '<span style="color:#C7D2E6;font-size:9.5px;font-weight:600;letter-spacing:.3px">RÉFÉRENCE — ' + esc(grpName) + ' · <span style="color:#FFFFFF">' + panel + ' pharmacies</span> · ' + (prospectNom ? 'produits les plus commandés par la référence' : 'produits commandés par la référence et absents de l\'officine') + '</span>' +
      '</div>' +
      '<div style="padding:16px 22px 20px">' +
        (portraitPid ? recapPdfHtml(portraitPid) + topVentesPdfHtml(portraitPid) : '') +
        // Titre liste + en-tête colonnes global (sombre)
        '<div style="display:flex;align-items:center;justify-content:space-between;border-top:2px solid #10131C;padding-top:9px;margin-bottom:9px;page-break-after:avoid">' +
          '<div style="font-size:12px;font-weight:800;color:#10131C">' + (prospectNom ? 'Meilleures rotations' : pharma ? 'Ses opportunités d\'achat' : 'Liste à pousser') + ' <span style="color:#737A8C;font-weight:600;font-size:12px">— ' + totalProd + ' produits, par famille</span></div>' +
          '<div style="font-size:9px;color:#737A8C">Nbr pharma = pharmacies qui commandent / ' + panel + '</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;table-layout:fixed;page-break-after:avoid">' + COLS6 +
          '<thead><tr style="background:#10131C">' + thd('Produit', 'left') + thd('CIP13', 'left', true) + thd('PPHT', 'right') + thd('Prix net IP', 'right') + thd('Nbr pharma', 'center') + '</tr></thead></table>' +
        (catHtml || '<div style="color:#9AA1B2;padding:36px;text-align:center;font-size:12px">Aucun produit à proposer.</div>') +
        // Pied
        '<div style="margin-top:16px;padding-top:9px;border-top:1px solid #E7EBF2;display:flex;align-items:center;justify-content:space-between;page-break-inside:avoid">' +
          '<div style="font-size:8.5px;color:#737A8C;line-height:1.45"><span style="font-weight:800;color:#0050E6">Intégral Pharma</span> · Liste d\'achats recommandée — données réseau : ' + (periodLabel() || 'au ' + dateStr) + '.<br>Prix nets HT indicatifs. Nbr pharma = nb de pharmacies de la référence commandant le produit / ' + panel + '.' + (truncated ? '<br>Top ' + PDF_CAP + ' par famille (les plus commandés) — pour cocher d\'autres produits, sélectionne-les dans l\'app avant l\'export.' : '') + '</div>' +
          '<div style="text-align:right;font-size:8.5px;color:#A8AFBE;white-space:nowrap">' + esc(grpName) + (pharma && pharma.ville ? '<br>' + esc(pharma.ville) : '') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    // Aperçu avant impression (sauf clic explicite "Partager" sur mobile → partage direct)
    var fn = 'Liste-' + grpName.replace(/[^A-Za-z0-9-]/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
    var shareTitle = 'Liste d\'achats · ' + grpName;
    if (mode === 'blob') return pdfGenerate(html, fn, 'blob');
    if (mode === 'share') { pdfGenerate(html, fn, 'share', shareTitle); }
    else { V2.pdfPreview(html, fn, shareTitle); }
  }

  // Génère et télécharge/partage un PDF à partir d'un HTML 794px (réutilisable).
  // mode 'blob' : ne télécharge rien, rend une promesse de File (pour « Transmettre »).
  function pdfGenerate(html, fn, mode, shareTitle) {
    if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
    V2.toast('Génération du PDF…');
    return window.ensureHtml2Pdf().then(function () {
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
      // A4 en pt « arrondi » (794 × 1123 px) : en mm, html2pdf évite les coupures sur 1122 px mais découpe à 1121,5 → lignes coupées vers la p.10
      var worker = window.html2pdf().from(wrap.firstChild).set({
        filename: fn, margin: [0, 0, 0, 0], image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'pt', format: [595.5, 842.25], orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
      });
      function cleanup() { if (wrap.parentNode) document.body.removeChild(wrap); if (veil.parentNode) document.body.removeChild(veil); }
      if (mode === 'blob') {
        return worker.outputPdf('blob').then(function (blob) { cleanup(); return new File([blob], fn, { type: 'application/pdf' }); },
          function (e) { console.error(e); cleanup(); return null; });
      }
      if (mode === 'share' && V2.shareOrSaveBlob) {
        worker.outputPdf('blob').then(function (blob) { return V2.shareOrSaveBlob(blob, fn, shareTitle || fn); })
          .then(function () { cleanup(); V2.toast('PDF prêt à partager'); })
          .catch(function (e) { console.error(e); cleanup(); V2.toast('Erreur PDF', 'error'); });
      } else {
        worker.save().then(function () { cleanup(); V2.toast('PDF téléchargé'); })
          .catch(function (e) { console.error(e); cleanup(); V2.toast('Erreur PDF', 'error'); });
      }
    }).catch(function (e) { console.error(e); V2.toast('Module PDF indisponible — vérifiez votre connexion', 'error'); });
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
        jsPDF: { unit: 'pt', format: [595.5, 842.25], orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
      });
      function done(msg) { sheet.style.transform = prevT; V2.toast(msg); }
      if (mode === 'share' && V2.shareOrSaveBlob) {
        worker.outputPdf('blob').then(function (blob) { return V2.shareOrSaveBlob(blob, fn, shareTitle || fn); })
          .then(function () { done('PDF prêt à partager'); }).catch(function (e) { console.error(e); done('Erreur PDF'); });
      } else {
        worker.save().then(function () { done('PDF téléchargé'); }).catch(function (e) { console.error(e); done('Erreur PDF'); });
      }
    }).catch(function (e) { console.error(e); sheet.style.transform = prevT; V2.toast('Module PDF indisponible — vérifiez votre connexion', 'error'); });
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
    // Génère depuis un clone hors-écran positionné en top:0 (pdfGenerate) et NON
    // depuis la feuille de l'aperçu (scrollée) : évite le blanc en haut de la page 1
    // (html2canvas incluait le décalage de scroll de la modale). Même HTML = rendu identique.
    bd.querySelector('#pdfprev-dl').onclick = function () { pdfGenerate(html, fn, 'save', shareTitle); };
    var sh = bd.querySelector('#pdfprev-sh'); if (sh) sh.onclick = function () { pdfGenerate(html, fn, 'share', shareTitle); };
    bd.classList.add('open');
    requestAnimationFrame(function () { requestAnimationFrame(fitPrevSheet); });
    if (!V2._pdfPrevResize) { window.addEventListener('resize', fitPrevSheet); V2._pdfPrevResize = true; }
  };
  // 25/09/2026 — les produits absents du BENCHMARK viennent du catalogue complet (1,3 Mo, chargé
  // en différé) : un PDF lancé avant son arrivée partait sans eux. On l'attend avant tout document.
  var _catEssai = false;   // une seule attente : si le catalogue ne vient pas, le document part quand même
  function avecCatalogue(fn) {
    if (window.CATALOGUE_COMPLET || !V2.loadFiles) return fn();
    _catEssai = true;
    V2.toast('Mise à jour du catalogue…');
    V2.loadFiles(['catcomplet']).then(fn, fn);
  }
  V2.grpDownloadPdf = function (enc, mode) {
    if (!window.CATALOGUE_COMPLET && V2.loadFiles && !_catEssai) return avecCatalogue(function () { V2.grpDownloadPdf(enc, mode); });
    var grpName; try { grpName = decodeURIComponent(enc); } catch (e) { grpName = enc; }
    achatsPdf(grpName, groupementProducts(grpName), !!(selCips && selCips.size && selPid === 'GRP:' + grpName), mode);
  };
  V2.listDownloadPdf = function (id, mode) {
    if (!window.CATALOGUE_COMPLET && V2.loadFiles && !_catEssai) return avecCatalogue(function () { V2.listDownloadPdf(id, mode); });
    var l = listGet(id); if (!l) return;
    achatsPdf(l.name, productsForIds(listIdsObj(l), 'LST:' + id), !!(selCips && selCips.size && selPid === 'LST:' + id), mode);
  };
  // ── Export Excel des mêmes listes (SheetJS, chargé à la demande comme dans v2-mkt) ──
  var xlsxLoading = false;
  function ensureXLSX(cb) {
    if (window.XLSX) { cb(true); return; }
    if (xlsxLoading) { setTimeout(function () { ensureXLSX(cb); }, 250); return; }
    xlsxLoading = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = function () { xlsxLoading = false; cb(!!window.XLSX); };
    s.onerror = function () { xlsxLoading = false; cb(false); };
    document.head.appendChild(s);
  }
  // Mêmes colonnes que le PDF (Produit, CIP13, PPHT, Prix net IP, Nbr pharma) :
  // pas de colonne « abandon » — le % ne figure jamais sur un document remis.
  // mode 'blob' : ne télécharge rien, rend une promesse de File (pour « Transmettre »).
  function achatsXlsx(title, data, useSel, mode) {
    var sections = data.cats.map(function (o) {
      var rows = (useSel && selCips) ? o.rows.filter(function (r) { return selCips.has(r.cip); }) : o.rows;
      return { cat: o.cat, rows: rows };
    }).filter(function (o) { return o.rows.length; });
    var panel = (data.panel > 0) ? data.panel : 0;
    if (!sections.length || !panel) { V2.toast('Aucun produit à proposer pour cette liste', 'warn'); return Promise.resolve(null); }
    V2.toast('Génération de l\'Excel…');
    return new Promise(function (resolve) { ensureXLSX(function (ok) {
      if (!ok || !window.XLSX) { V2.toast('Export Excel indisponible (hors ligne ?)', 'error'); resolve(null); return; }
      var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      var used = {};
      function sheetName(name) {
        var n = String(name).replace(/[\[\]\:\*\?\/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Liste';
        var base = n; var i = 2; while (used[n.toLowerCase()]) { n = (base.slice(0, 25) + ' ' + i); i++; } used[n.toLowerCase()] = 1; return n;
      }
      var wb = window.XLSX.utils.book_new();
      sections.forEach(function (o) {
        var head = ['#', 'Produit', 'CIP13', 'PPHT (€)', 'Prix net IP (€)', 'Nb pharmacies / ' + panel];
        var aoa = [
          ['Intégral Pharma — Liste d\'achats recommandée · ' + title],
          [o.cat.label + (o.cat.sub ? ' · ' + o.cat.sub : '') + ' — éditée le ' + dateStr + (periodLabel() ? ' · ventes ' + periodLabel() : '') + ' · référence ' + panel + ' pharmacie' + (panel > 1 ? 's' : '')],
          [],
          head
        ];
        o.rows.forEach(function (r, i) {
          aoa.push([
            i + 1,
            (r.designation || '') + (r.froid ? ' [FROID]' : '') + (r.offre ? ' [OFFRE]' : ''),
            String(r.cip),
            r.prix_ht > 0 ? +r.prix_ht.toFixed(2) : '',
            r.prix_ip > 0 ? +r.prix_ip.toFixed(2) : '',
            r.sortie
          ]);
        });
        var ws = window.XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 4 }, { wch: 48 }, { wch: 15 }, { wch: 10 }, { wch: 14 }, { wch: 17 }];
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }];
        window.XLSX.utils.book_append_sheet(wb, ws, sheetName(o.cat.label));
      });
      var fn = 'Liste-' + String(title).replace(/[^A-Za-z0-9-]/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.xlsx';
      if (mode === 'blob') { resolve(new File([window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], fn, { type: txMime(fn) })); return; }
      window.XLSX.writeFile(wb, fn);
      V2.toast('Excel téléchargé');
      resolve(null);
    }); });
  }
  // ── 25/09/2026 — grossistes et génériqueurs PROBABLES (demande de Will : « le remplir avec ce qui
  // est sûrement le cas, avec les données qu'on a à dispo et les probabilités »). Une case vide
  // prend la valeur la plus fréquente chez les officines du même groupement, sinon du même
  // département. Jamais tiré des ventes Intégral : testé le 01/09, juste 1 fois sur 10.
  // obs : [{ id, grp, dep, gros1, gros2, gen1, gen2 }] — toutes les officines connues de l'app.
  // Rend { id: { gros1: { nom, pct, ou, k, n }, ... } } pour les cases VIDES seulement.
  // pct = taux de réussite MESURÉ à l'aveugle sur les officines dont on connaît la réponse
  // (on cache leur valeur, on devine, on compare), par niveau (groupement / département) et
  // par tranche de majorité, plafonné par la part majoritaire elle-même — la part seule surestime
  // (mesuré le 25/09 : « 94 % du groupement » = juste 85 fois sur 100).
  function deduitProbables(obs) {
    function sans(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
    function famGros(v) {
      var u = sans(v);
      if (!u || /INTEGRAL|AUTRE|TOUS|GIPHAR|^\?/.test(u)) return '';
      if (/ALLIANCE/.test(u)) return 'ALLIANCE'; if (/CERP/.test(u)) return 'CERP'; if (/OCP/.test(u)) return 'OCP';
      if (/PHOENIX/.test(u)) return 'PHOENIX'; if (/CEDP/.test(u)) return 'CEDP'; if (/SAGITTA/.test(u)) return 'SAGITTA';
      return u.replace(/[^A-Z0-9]/g, '');
    }
    function famGen(v) {
      var u = sans(v);
      if (!u || /AUTRE|TOUS|^\?/.test(u)) return '';
      if (/VIATRIS|MYLAN/.test(u)) return 'VIATRIS'; if (/BIOGARAN/.test(u)) return 'BIOGARAN'; if (/TEVA/.test(u)) return 'TEVA';
      if (/SANDOZ/.test(u)) return 'SANDOZ'; if (/ZENTIVA/.test(u)) return 'ZENTIVA'; if (/ARROW/.test(u)) return 'ARROW';
      if (/^EG\b/.test(u)) return 'EG'; if (/CRISTERS/.test(u)) return 'CRISTERS';
      return u.replace(/[^A-Z0-9]/g, '');
    }
    var CH = [['gros1', '', famGros], ['gros2', 'gros1', famGros], ['gen1', '', famGen], ['gen2', 'gen1', famGen]];
    var parGrp = {}, parDep = {};
    obs.forEach(function (o) {
      if (o.grp) (parGrp[o.grp] || (parGrp[o.grp] = [])).push(o);
      if (o.dep) (parDep[o.dep] || (parDep[o.dep] = [])).push(o);
    });
    function top(lot, champ, fam, soi, exclu) {
      var n = 0, c = {}, lib = {};
      lot.forEach(function (o) {
        if (o === soi) return; var f = fam(o[champ]); if (!f || f === exclu) return;
        n++; c[f] = (c[f] || 0) + 1; var l = lib[f] || (lib[f] = {}); l[o[champ]] = (l[o[champ]] || 0) + 1;
      });
      var best = ''; Object.keys(c).forEach(function (f) { if (!best || c[f] > c[best]) best = f; });
      if (!best) return null;
      var l = lib[best], nom = ''; Object.keys(l).forEach(function (k) { if (!nom || l[k] > l[nom]) nom = k; });
      return { nom: nom, fam: best, k: c[best], n: n };
    }
    // devine un champ pour une officine : son groupement (≥ 3 officines connues), sinon son département (≥ 5)
    function devine(o, ch, prec) {
      var exclu = ch[1] ? ch[2](prec) : '', t = null, ou = '';
      if (o.grp && parGrp[o.grp]) { t = top(parGrp[o.grp], ch[0], ch[2], o, exclu); ou = 'groupement'; if (t && t.n < 3) t = null; }
      if (!t && o.dep && parDep[o.dep]) { t = top(parDep[o.dep], ch[0], ch[2], o, exclu); ou = 'département'; if (t && t.n < 5) t = null; }
      if (!t) return null;
      var p = t.k / t.n; t.ou = ou; t.tranche = ou + (p >= 0.8 ? 3 : p >= 0.6 ? 2 : 1);
      return t;
    }
    // étalonnage à l'aveugle, champ par champ et tranche par tranche
    var eta = {};
    CH.forEach(function (ch) {
      var m = eta[ch[0]] = {};
      obs.forEach(function (o) {
        if (!ch[2](o[ch[0]])) return;
        var t = devine(o, ch, ch[1] ? o[ch[1]] : ''); if (!t) return;
        var s = m[t.tranche] || (m[t.tranche] = { n: 0, ok: 0 }); s.n++; if (t.fam === ch[2](o[ch[0]])) s.ok++;
      });
    });
    var res = {};
    obs.forEach(function (o) {
      var r = {};
      CH.forEach(function (ch) {
        if (o[ch[0]]) return;
        var prec = ch[1] ? (o[ch[1]] || (r[ch[1]] || {}).nom) : '';
        var t = devine(o, ch, prec); if (!t) return;
        var s = eta[ch[0]][t.tranche];
        if (!s || s.n < 10) return;                     // tranche jamais vérifiée : on ne devine pas
        // le plus prudent des deux : le taux mesuré de la tranche, ou la part réelle (« 3 sur 8 » ne s'affiche jamais « 80 % »)
        var pct = Math.min(Math.round(100 * s.ok / s.n), Math.round(100 * t.k / t.n));
        if (pct < 40) return;                           // moins de 4 chances sur 10 : case laissée vide
        r[ch[0]] = { nom: t.nom, pct: pct, ou: t.ou, k: t.k, n: t.n };
      });
      if (Object.keys(r).length) res[o.id] = r;
    });
    res._etalonnage = eta;
    return res;
  }
  // ── 25/09/2026 — « Mes clients » en Excel (demande de Will : Karine doit pouvoir extraire
  // son fichier clients elle-même). Mêmes officines que la liste à l'écran (filtre commercial +
  // recherche), mêmes colonnes que le fichier fait à la main le 25/09, sans SIREN ni clé PharmaML.
  // Ventes : celles que la session voit déjà (V2.voitVentesDe), mois lus dans les données.
  V2.pharmaClientsXlsx = function () {
    var q = searchQuery.trim().toLowerCase();
    var noms = V2.commFilter ? [V2.commFilter] : (V2.ventesRestreintes && V2.ventesRestreintes() ? V2.mesComms() : []);
    var c = V2.sb && V2.sb();
    V2.toast('Préparation de l\'Excel…');
    var socle = Promise.all([
      V2.loadFiles ? V2.loadFiles(['clientsactifs', 'officinesinfos']).catch(function () {}) : null,
      V2.profil ? V2.profil.loadScope('client') : [],
      V2.profil ? V2.profil.loadScope('override') : []
    ]);
    var phs = [];
    socle.then(function (res) {
      // Qui suit l'officine : la base clients fait foi (colonne commercial, en code : KV, ALH…).
      // L'app nomme les commerciaux par leur prénom : le code d'un prénom est celui qu'il porte
      // le plus souvent dans la base. Sans base pour l'officine → son commercial dans les ventes.
      var CA = (window.CLIENTS_ACTIFS || {}).d || {}, compte = {};
      (V2.pharmacies || []).forEach(function (p) {
        var cd = (CA[String(p.id)] || [])[7]; if (!cd) return;
        (p.comms || []).forEach(function (n) { var m = compte[n] || (compte[n] = {}); m[cd] = (m[cd] || 0) + 1; });
      });
      var codes = {};
      noms.forEach(function (n) { var m = compte[n] || {}, best = ''; Object.keys(m).forEach(function (k) { if (!best || m[k] > m[best]) best = k; }); if (best) codes[best] = 1; });
      var vu = {};
      function garde(id, p) {
        if (/EX/.test(id)) return false;   // ancien code d'une officine : ses ventes sont rattachées plus bas
        var cd = (CA[id] || [])[7];
        if (noms.length) { if (cd ? !codes[cd] : !(p && (p.comms || []).some(function (n) { return noms.indexOf(n) >= 0; }))) return false; }
        return true;
      }
      (V2.pharmacies || []).forEach(function (p) { var id = String(p.id); if (!vu[id] && garde(id, p)) { vu[id] = 1; phs.push(p); } });
      // officines de la base sans vente cette année (absentes de la liste des ventes)
      // (nom lu dans l'annuaire national de la carte, p[13] = CIP, p[6] = nom)
      var nomFr = {};
      if (noms.length && window.PHARMA_FR && PHARMA_FR.p) PHARMA_FR.p.forEach(function (x) { if (x[13]) nomFr[String(x[13]).replace(/[^0-9]/g, '')] = x[6]; });
      if (noms.length) Object.keys(codes).length && Object.keys(CA).forEach(function (id) {
        if (!vu[id] && codes[CA[id][7]]) { vu[id] = 1; phs.push({ id: id, name: nomFr[id] || '', comms: [], cp: CA[id][12] || '', ville: CA[id][13] || '' }); }
      });
      if (q) phs = phs.filter(function (p) { return (p.name || '').toLowerCase().indexOf(q) >= 0; });
      var ids = phs.map(function (p) { return String(p.id); });
      if (!c || !ids.length) return res.concat([[]]);
      var out = [], lots = [];
      for (var i = 0; i < ids.length; i += 150) lots.push(ids.slice(i, i + 150));
      return Promise.all(lots.map(function (lot) {
        return c.from('notes').select('scope_id,author_name,body,created_at').eq('scope_type', 'client').in('scope_id', lot)
          .then(function (r) { if (!r.error && r.data) out = out.concat(r.data); });
      })).then(function () { return res.concat([out]); }).catch(function () { return res.concat([out]); });
    }).then(function (res) {
      if (!phs.length) { V2.toast('Aucune officine à extraire', 'warn'); return; }
      var prof = {}, over = {}, notes = {};
      (res[1] || []).forEach(function (x) { prof[x.sid] = x.data || {}; });
      (res[2] || []).forEach(function (x) { over[x.sid] = x.data || {}; });
      (res[3] || []).forEach(function (n) { (notes[n.scope_id] || (notes[n.scope_id] = [])).push(n); });
      ensureXLSX(function (ok) {
        if (!ok || !window.XLSX) { V2.toast('Export Excel indisponible (hors ligne ?)', 'error'); return; }
        var CA = (window.CLIENTS_ACTIFS || {}).d || {}, OI = window.OFFICINES_INFOS || {};
        // Toutes les officines connues (base clients + fiches saisies) nourrissent les probables
        function cleGrp(v) { return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
        var connues = {};
        Object.keys(CA).forEach(function (id) { connues[id] = 1; });
        Object.keys(prof).forEach(function (id) { connues[id] = 1; });
        var probables = deduitProbables(Object.keys(connues).map(function (id) {
          var b = CA[id] || [], pr = prof[id] || {}, ov = over[id] || {};
          var gs = String(b[10] || '').split('/').map(function (g) { return g.trim(); }).filter(Boolean);
          return { id: id, grp: cleGrp(pr.groupement || ov.groupement || b[6]), dep: String(pr.cp || b[12] || '').slice(0, 2),
            gros1: pr.gros1 || b[18] || '', gros2: pr.gros2 || '', gen1: pr.gen1 || gs[0] || '', gen2: pr.gen2 || gs[1] || '' };
        }));
        var MN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
        var moisVus = {}, an = 2026;
        (V2.sales || []).forEach(function (s) { if (s.month) { moisVus[s.month] = 1; if (s.year) an = s.year; } });
        var mois = Object.keys(moisVus).map(Number).sort(function (a, b) { return a - b; });
        var periode = mois.length ? MN[mois[0] - 1] + '-' + MN[mois[mois.length - 1] - 1] : '';
        function fr(d) { d = String(d || ''); var m = d.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : d; }
        var head = ['CIP', 'Pharmacie', 'Nom commercial (annuaire)', 'Adresse', 'CP', 'Ville', 'UGA', 'Téléphone',
          'Portable / tél. perso', 'Fax', 'Mail', 'Titulaire (contact)', 'Fonction', 'Dirigeant(s) déclaré(s)',
          'Pharmaciens RPPS (titulaires / adjoints)', 'Ouverture ou reprise', 'Groupement', 'Livrée par', 'LGO', 'Robot',
          'Grossiste 1', 'Grossiste 2', 'Grossiste 3 / autre', 'Génériqueur 1', 'Génériqueur 2', 'Génériqueur 3', 'Biosimilaires',
          'Grossistes / génériqueurs probables : d\'où ça vient']
          .concat(mois.map(function (m) { return 'CA HT ' + MN[m - 1] + ' ' + an; }))
          .concat(['CA HT ' + an + (periode ? ' (' + periode + ')' : ''), 'Nb de produits différents',
            'À savoir', 'Vente du fonds (BODACC)', 'Procédure collective (BODACC)', 'Dernière note', 'Notes de l\'équipe (plus récente en premier)']);
        var rows = phs.map(function (p) {
          var id = String(p.id), b = CA[id] || [], o = OI[id] || [], pr = prof[id] || {}, ov = over[id] || {};
          var gens = String(b[10] || '').split('/').map(function (g) { return g.trim(); }).filter(Boolean);
          var parMois = {}, refs = {}, tot = 0;
          pharmaSales(id).concat(pharmaSales('EX' + id), pharmaSales(id + 'EX')).forEach(function (s) { parMois[s.month] = (parMois[s.month] || 0) + (s.mntNetHt || 0); tot += s.mntNetHt || 0; if (s.artCode) refs[s.artCode] = 1; });
          var savoir = [];
          if (o[6] === 'C') savoir.push('Société déclarée cessée' + (o[7] ? ' le ' + fr(o[7]) : '') + ' — reprise probable ou à vérifier');
          if (o[9] === 'R') savoir.push('Un dirigeant a 62 ans ou plus (départ en retraite possible)');
          if (o[10]) savoir.push('Dirige aussi : ' + String(o[10]).split(',').map(function (x) { return x.trim(); }).join(', '));
          var vf = '', pc = '', rp = '';
          if (o[11]) { var a = String(o[11]).split('|'); vf = (a[0] === 'A' ? 'Rachat' : 'Vente') + ' du fonds le ' + fr(a[1]) + (/^\d+$/.test(a[2] || '') ? ' pour ' + Number(a[2]).toLocaleString('fr-FR').replace(/\s/g, ' ') + ' €' : ''); }
          if (o[12]) { var e = String(o[12]).split('|'); pc = fr(e[0]) + ' — ' + (e[1] || ''); }
          if (o[13]) { var r = String(o[13]).split('|'); rp = r[0] + ' / ' + (r[1] || ''); }
          // case vide → valeur probable, écrite « CERP Rouen (probable à 86 %) », et d'où elle vient
          var pb = probables[id] || {}, pourquoi = [];
          function ou(champ, lib, sure) {
            if (sure) return sure;
            var d = pb[champ]; if (!d) return '';
            pourquoi.push(lib + ' : ' + d.k + ' officine' + (d.k > 1 ? 's' : '') + ' sur ' + d.n + ' du même ' + d.ou);
            return d.nom + ' (probable à ' + d.pct + ' %)';
          }
          var ns = (notes[id] || []).slice().sort(function (x, y) { return String(y.created_at).localeCompare(String(x.created_at)); });
          return [id, ov.nom || p.name || o[8] || '', o[8] || '', pr.adresse || b[11] || o[0] || '', pr.cp || b[12] || p.cp || '', pr.ville || b[13] || p.ville || '',
            b[8] || '', pr.tel || b[0] || o[1] || p.tel || '', pr.tel_perso || b[1] || '', b[15] || o[2] || '', pr.email || b[2] || '',
            pr.titulaire || ov.titulaire || b[3] || '', b[4] || '', o[6] !== 'C' ? (o[5] || '') : '', rp, fr(o[4]),
            pr.groupement || ov.groupement || b[6] || p.groupement || '', b[16] || '', pr.lgo || b[5] || '', pr.robot || '',
            ou('gros1', 'Grossiste 1', pr.gros1 || b[18]), ou('gros2', 'Grossiste 2', pr.gros2), [pr.gros3, pr.gros4].filter(Boolean).join(' / '),
            ou('gen1', 'Génériqueur 1', pr.gen1 || gens[0]), ou('gen2', 'Génériqueur 2', pr.gen2 || gens[1]), pr.gen3 || gens.slice(2).join(' / '), pr.biosim || '',
            pourquoi.join('\n')]
            .concat(mois.map(function (m) { return parMois[m] ? Math.round(parMois[m] * 100) / 100 : 0; }))
            .concat([Math.round(tot * 100) / 100, Object.keys(refs).length, savoir.join('\n'), vf, pc,
              ns.length ? fr(ns[0].created_at) : '',
              ns.map(function (n) { return fr(n.created_at) + ' · ' + (n.author_name || '—') + ' : ' + String(n.body || '').trim(); }).join('\n')]);
        });
        var iTot = 28 + mois.length;
        rows.sort(function (x, y) { return (y[iTot] || 0) - (x[iTot] || 0); });
        var qui = V2.commFilter || (V2.mesComms ? V2.mesComms()[0] : '') || '';
        var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        var titre = 'Mes clients' + (qui ? ' · ' + qui : '') + ' · ' + rows.length + ' officine' + (rows.length > 1 ? 's' : '') +
          ' · extraction du ' + dateStr + ' · classées par chiffre d\'affaires' + (periode ? ' · ventes ' + periode + ' ' + an : '');
        var totaux = ['', 'TOTAL'].concat(new Array(26).fill('')).concat(mois.map(function (m, j) {
          return Math.round(rows.reduce(function (s, r) { return s + (r[28 + j] || 0); }, 0) * 100) / 100;
        })).concat([Math.round(rows.reduce(function (s, r) { return s + (r[iTot] || 0); }, 0) * 100) / 100]);
        var ws = window.XLSX.utils.aoa_to_sheet([[titre], head].concat(rows).concat([totaux]));
        var larg = [9, 30, 24, 30, 7, 20, 8, 14, 14, 14, 30, 26, 11, 28, 12, 12, 18, 10, 16, 12, 14, 14, 16, 14, 14, 14, 14, 40]
          .concat(mois.map(function () { return 11; })).concat([13, 10, 34, 26, 26, 12, 80]);
        ws['!cols'] = larg.map(function (w) { return { wch: w }; });
        ws['!autofilter'] = { ref: window.XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: rows.length + 1, c: head.length - 1 } }) };
        ws['!freeze'] = { xSplit: 2, ySplit: 2 };
        for (var ri = 2; ri <= rows.length + 2; ri++) for (var ci = 28; ci <= iTot; ci++) {
          var cell = ws[window.XLSX.utils.encode_cell({ r: ri, c: ci })]; if (cell && cell.t === 'n') cell.z = '# ##0 €';
        }
        var wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, 'Mes clients');
        window.XLSX.writeFile(wb, 'Mes-clients' + (qui ? '-' + String(qui).replace(/[^A-Za-z0-9-]/g, '_') : '') + '-' + new Date().toISOString().slice(0, 10) + '.xlsx');
        V2.toast('Excel téléchargé · ' + rows.length + ' officine' + (rows.length > 1 ? 's' : ''));
      });
    });
  };
  V2.grpDownloadXlsx = function (enc) {
    if (!window.CATALOGUE_COMPLET && V2.loadFiles && !_catEssai) return avecCatalogue(function () { V2.grpDownloadXlsx(enc); });
    var grpName; try { grpName = decodeURIComponent(enc); } catch (e) { grpName = enc; }
    achatsXlsx(grpName, groupementProducts(grpName), !!(selCips && selCips.size && selPid === 'GRP:' + grpName));
  };
  V2.listDownloadXlsx = function (id) {
    if (!window.CATALOGUE_COMPLET && V2.loadFiles && !_catEssai) return avecCatalogue(function () { V2.listDownloadXlsx(id); });
    var l = listGet(id); if (!l) return;
    achatsXlsx(l.name, productsForIds(listIdsObj(l), 'LST:' + id), !!(selCips && selCips.size && selPid === 'LST:' + id));
  };
  // PDF officine = liste d'achats PURE (même format que le groupement, SANS récap RDV).
  // scope = 'reseau' (réf. réseau IP) | 'groupement' (réf. son groupement). Toute la liste.
  V2.pharmaListPdf = function (pid, scope, mode) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    var prospect = (!pharma && tx.pid === String(pid)) ? (tx.nom || 'Officine') : '';
    if (!pharma && !prospect) { V2.toast('Pharmacie introuvable', 'error'); return; }
    if (!window.BENCHMARK) { V2.toast('Catalogue en cours de chargement…'); V2.loadFiles(['bench', 'sagitta']).then(function () {}); return; }
    scope = (scope === 'groupement') ? 'groupement' : 'reseau';
    // Prospect (21/09/2026) : rien d'acheté chez nous, donc la liste ENTIÈRE — celle de son
    // groupement (la même que l'écran Groupements) ou les meilleures rotations du réseau.
    if (prospect) {
      // 23/09/2026 : 5 styles au choix et pages découpées par nous (v2-pdf-prospect.js)
      if (V2.prospectPdf) {
        return V2.prospectPdf(scope === 'groupement' ? groupementProducts(tx.grp) : buildRecoCats(pid, 'reseau'),
          { nom: prospect, ref: scope === 'groupement' ? tx.grp : reseauLbl(), reseau: scope !== 'groupement' }, mode);
      }
      return (scope === 'groupement')
        ? achatsPdf(tx.grp, groupementProducts(tx.grp), false, mode, null, prospect)
        : achatsPdf(reseauLbl(), buildRecoCats(pid, 'reseau'), false, mode, null, prospect);
    }
    var data = buildRecoCats(pid, scope);
    var label = (scope === 'groupement') ? (groupementPids(pid).name || 'Groupement') : reseauLbl();
    var faire = function () {
      if (V2.prospectPdf) {
        return V2.prospectPdf(data, { nom: pharma.name, ref: label, reseau: scope !== 'groupement', client: clientPdfData(pid), fichier: pharma.name + ' — ' + label,
          maxPages: 10 }, mode);   // Will, 24/09/2026 : 8-10 pages maximum
      }
      return achatsPdf(pharma.name + ' — ' + label, data, false, mode, pid);
    };
    // « Ce qu'elle commande » nomme ses produits hors BENCHMARK via le catalogue complet (différé)
    if (!window.CATALOGUE_COMPLET && V2.loadFiles) return V2.loadFiles(['catcomplet']).then(faire, faire);
    return faire();
  };
  // 09/10/2026 — le même listing en Excel (demande de Will) : mêmes produits que l'écran et le PDF,
  // mêmes colonnes que l'Excel des groupements. Toute la liste, là où le PDF client s'arrête à 10 pages.
  V2.pharmaListXlsx = function (pid, scope, mode) {
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); });
    var prospect = (!pharma && tx.pid === String(pid)) ? (tx.nom || 'Officine') : '';
    if (!pharma && !prospect) { V2.toast('Pharmacie introuvable', 'error'); return Promise.resolve(null); }
    if (!window.BENCHMARK) { V2.toast('Catalogue en cours de chargement…'); V2.loadFiles(['bench', 'sagitta']).then(function () {}); return Promise.resolve(null); }
    var grp = (scope === 'groupement');
    var data = prospect ? (grp ? groupementProducts(tx.grp) : buildRecoCats(pid, 'reseau')) : buildRecoCats(pid, grp ? 'groupement' : 'reseau');
    var ref = grp ? (prospect ? tx.grp : (groupementPids(pid).name || 'Groupement')) : reseauLbl();
    return achatsXlsx((prospect || pharma.name) + ' — ' + ref, data, false, mode);
  };

  // ════════════════════════════════════════════
  // TRANSMETTRE À L'OFFICINE — demande Will, 14/09/2026
  // Sur la fiche, on coche ce qu'on lui envoie : ses listings (réseau /
  // groupement), les documents de l'app, et la bibliothèque partagée où
  // chacun dépose ses PDF et Excel (même stockage que Marketing › Documents).
  // Les fichiers partent en PIÈCES JOINTES (feuille de partage ou
  // téléchargement), jamais en lien : une adresse d'hébergeur ne sort pas.
  // ════════════════════════════════════════════
  var TX_BUCKET = 'marketing-pdfs';
  var TX_APP_DOCS = [
    { f: 'catalogue-integral.pdf', label: 'Catalogue L\'Intégral' },
    { f: 'catalogue-itp.pdf', label: 'Catalogue ITP' },
    { f: 'ouverture-compte-integral-pharma-2026.pdf', label: 'Formulaire d\'ouverture de compte 2026' }
  ];
  var tx = { pid: null, sel: {}, docs: null, docsErr: null, busy: '', step: 0, total: 0, files: null };
  // 25/09/2026 — catalogue TOP 200/300/500 prêt à importer dans SON logiciel (LGO) :
  // mode d'emploi PDF + fichier CSV + Excel, déposés dans lgo/ (fabriqués par
  // ~/jarvis-catalogues-lgo). Classement = nombre de pharmacies du réseau, génériques exclus.
  var TX_LGO = [
    { s: 'leo', nom: 'LEO', re: /\bleo\b|isipharm/ }, { s: 'lgpi', nom: 'LGPI', re: /lgpi|pharmagest/ },
    { s: 'pharmaland', nom: 'Pharmaland', re: /pharmaland|\blsi\b/ }, { s: 'pharmony', nom: 'Pharmony', re: /pharmony/ },
    { s: 'smartrx', nom: 'Smart RX', re: /smart/ }, { s: 'winpharma', nom: 'Winpharma', re: /winpharma|\bwin ?auto/ },   // « WIN AUTOPILOTE » = module de Winpharma
    { s: 'pharmavitale', nom: 'Pharmavitale', re: /pharmavitale/ }, { s: 'visiopharm', nom: 'VisioPharm', re: /visio/ }
  ];
  var TX_LGO_N = [200, 300, 500];
  tx.lgo = { pid: null, s: '', n: 300, auto: false, touched: false };
  function txLgoNom(s) { var l = TX_LGO.filter(function (x) { return x.s === s; })[0]; return l ? l.nom : s; }
  // « LGPI / Offilog » → lgpi : on prend le premier morceau qui désigne un logiciel connu.
  // 25/09 : aussi « Winpharma, bascule vers LGPI » → winpharma (le premier cité, pas le premier du tableau).
  function txLgoSlug(v) {
    var parts = String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[\/,;+]|\bet\b|\bpuis\b|\bvers\b/);
    for (var i = 0; i < parts.length; i++) {
      var l = TX_LGO.filter(function (x) { return x.re.test(parts[i]); })[0];
      if (l) return l.s;
    }
    return '';
  }
  V2.lgoSlug = txLgoSlug;   // rubrique « Logiciels officine » (v2-lgo.js) : même reconnaissance
  // Même ordre que la fiche : saisie de l'équipe, puis annuaire RDV, puis base clients.
  // La saisie fait foi : un logiciel saisi sans mode d'emploi (Caduciel…) ne laisse pas
  // l'annuaire en proposer un autre — le commercial choisit.
  function txLgoDetect(pid, saisi) {
    if (saisi && String(saisi.lgo || '').trim()) return txLgoSlug(saisi.lgo);
    var ri = V2.rdvInfo ? V2.rdvInfo(pid) : null;
    var ca = ((window.CLIENTS_ACTIFS || {}).d || {})[String(pid)];
    return txLgoSlug(saisi && saisi.lgo) || txLgoSlug(ri && ri.logiciel) || txLgoSlug(ca && ca[5]);
  }
  function txLgoLabel(s, n) { return 'Catalogue TOP ' + n + ' · ' + txLgoNom(s); }
  // Bouton de la fiche officine (« Listes à proposer ») : rien si le logiciel n'est pas reconnu.
  function lgoBtnHtml(pid, s) {
    if (!s) return '';
    return '<button class="pha-btn pha-btn-w pha-btn-lgo" onclick="V2.pharmaTxCatalogue(\'' + esc(String(pid)) + '\',\'' + s + '\')" title="mode d\'emploi + fichier à importer, déjà cochés dans la fenêtre d\'envoi">' +
      ICO('download', 15) + 'Catalogue pour ' + esc(txLgoNom(s)) + '</button>';
  }
  // Fiche « menu » : même bouton, en rond dans la carte bleue (libellé court dessous, libellé complet en title).
  function lgoRondHtml(pid, s) {
    if (!s) return '';
    return '<button type="button" class="l8-act" title="Catalogue pour ' + esc(txLgoNom(s)) + ' : mode d\'emploi + fichier à importer, déjà cochés dans la fenêtre d\'envoi" aria-label="Catalogue pour ' + esc(txLgoNom(s)) + '" onclick="V2.pharmaTxCatalogue(\'' + esc(String(pid)) + '\',\'' + s + '\')">' +
      '<span class="l8-rond">' + l8Ic('cata', 22) + '</span>Catalogue</button>';
  }
  // 25/09 — sans mail type, le texte dit ce qu'est chaque pièce jointe ; avec le catalogue
  // pour son logiciel, l'objet et l'introduction le nomment.
  function txTexteDefaut(files) {
    var g = Object.keys(tx.sel).filter(function (k) { return tx.sel[k] && k.indexOf('G:') === 0; })[0];
    var nom = g ? txLgoNom(g.split(':')[1]) : '';
    var lignes = files.map(function (f) {
      var n = f.name;
      return '- ' + n + (/^mode-emploi-import-/.test(n) ? ' : à ouvrir en premier, il détaille chaque étape'
        : /^integral-top\d+-.*\.csv$/.test(n) ? ' : le fichier à importer dans ' + nom
        : /^integral-top\d+-.*\.xlsx$/.test(n) ? ' : le même contenu au format Excel, pour le consulter' : '');
    }).join('\n');
    if (!g) return { objet: 'Documents pour votre officine', corps: 'Bonjour,\n\nVeuillez trouver ci-joint :\n' + lignes + '\n\nJe reste à votre disposition pour en parler.\n\nBien cordialement,' };
    return { objet: 'Catalogue Intégral Pharma pour ' + nom + ' : mode d\'emploi et fichier à importer',
      corps: 'Bonjour,\n\nVoici le catalogue des ' + g.split(':')[2] + ' produits les plus commandés par les pharmacies du réseau Intégral Pharma, avec son mode d\'emploi pour ' + nom + ' :\n' + lignes +
        '\n\nSi l\'import bloque, appelez-moi : nous le faisons ensemble.\n\nBien cordialement,' };
  }
  var txMail = {};
  function txSb() { return (V2.sb && V2.sb()) || null; }
  function txPretty(n) { n = String(n || ''); var i = n.indexOf('__'); return i >= 0 ? n.slice(i + 2) : n; }
  function txSize(b) { b = +b || 0; return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' Ko' : (b / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }
  function txIsXls(n) { return /\.xlsx?$/i.test(n); }
  function txMime(n) {
    return /\.xlsx$/i.test(n) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : /\.xls$/i.test(n) ? 'application/vnd.ms-excel' : 'application/pdf';
  }
  function txSanitize(n) { return String(n || 'document').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'document'; }
  function txLoadDocs() {
    var c = txSb();
    if (!c || !c.storage) { tx.docs = []; tx.docsErr = 'Connexion requise pour lire la bibliothèque partagée.'; return Promise.resolve(); }
    return c.storage.from(TX_BUCKET).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } }).then(function (r) {
      if (r.error) { tx.docs = []; tx.docsErr = 'Bibliothèque partagée illisible (' + (r.error.message || 'erreur') + ').'; return; }
      tx.docsErr = null;
      tx.docs = (r.data || []).filter(function (f) { return f.name && f.id && f.name !== '.emptyFolderPlaceholder'; })
        .map(function (f) { return { name: f.name, size: (f.metadata || {}).size || 0 }; });
    }).catch(function () { tx.docs = []; tx.docsErr = 'Bibliothèque partagée injoignable — réessayez dans un instant.'; });
  }
  // 25/09/2026 — documents FAITS dans l'app (fiches Marketing de l'équipe, fiches biosimilaires
  // « pharmacien », catalogue par catégorie) : générés ou lus au moment de préparer le mail.
  var TX_PROTEGES = ['biosimSynthesePharma', 'biosimDetailPharma'];   // jamais les versions « interne »
  var txFiches = null;
  function txLoadFiches() {
    if (!V2.mkt || !V2.mkt.fichesPourMail) { txFiches = []; return Promise.resolve(); }
    return V2.mkt.fichesPourMail().then(function (a) { txFiches = a || []; }, function () { txFiches = []; });
  }
  V2.pharmaTxFiches = function () { return txFiches ? Promise.resolve() : txLoadFiches(); };
  function txProtegeTitre(c) { var d = (V2.docsProteges || {})[c]; return d ? d.titre : c; }
  function txIsClient(pid) { return (V2.pharmacies || []).some(function (p) { return String(p.id) === String(pid); }); }
  function txCount(pid, scope) { return buildRecoCats(pid, scope).cats.reduce(function (s, o) { return s + o.rows.length; }, 0); }
  function txItems(pid) {
    var its = [];
    var cli = txIsClient(pid);
    // Mail type de la To do list (aucune officine) : pas de listing, seulement les documents.
    if (tx.modele) pid = null;
    // Prospect : pas d'achats chez nous → meilleures rotations du réseau, et la liste de son
    // groupement s'il est connu. benchIndex() se fige s'il est lu avant l'arrivée du catalogue.
    var nR = pid && (cli || window.BENCHMARK) ? txCount(pid, 'reseau') : 0;
    if (nR > 0) its.push({ k: 'L:reseau', grp: 'listing', label: (cli ? 'Listing ' : 'Meilleures rotations · ') + reseauLbl(), meta: V2.fmtNum(nR) + ' produits · PDF généré' });
    if (nR > 0) its.push({ k: 'X:reseau', grp: 'listing', xls: true, label: (cli ? 'Listing ' : 'Meilleures rotations · ') + reseauLbl() + ' · Excel', meta: V2.fmtNum(nR) + ' produits · Excel généré' });
    if (pid && !cli && tx.grp && window.BENCHMARK) {
      var gp = groupementProducts(tx.grp);
      var nP = gp.panel >= 2 ? gp.cats.reduce(function (s, o) { return s + o.rows.length; }, 0) : 0;
      if (nP > 0) its.push({ k: 'L:groupement', grp: 'listing', label: 'Listing ' + tx.grp, meta: V2.fmtNum(nP) + ' produits · ' + gp.panel + ' pharmacies du groupement · PDF généré' });
      if (nP > 0) its.push({ k: 'X:groupement', grp: 'listing', xls: true, label: 'Listing ' + tx.grp + ' · Excel', meta: V2.fmtNum(nP) + ' produits · ' + gp.panel + ' pharmacies du groupement · Excel généré' });
    }
    var g = cli ? groupementPids(pid) : {};
    if (g.set && g.set.size >= 2) {
      var nG = txCount(pid, 'groupement');
      if (nG > 0) its.push({ k: 'L:groupement', grp: 'listing', label: 'Listing ' + (g.name || 'groupement'), meta: V2.fmtNum(nG) + ' produits · PDF généré' });
      if (nG > 0) its.push({ k: 'X:groupement', grp: 'listing', xls: true, label: 'Listing ' + (g.name || 'groupement') + ' · Excel', meta: V2.fmtNum(nG) + ' produits · Excel généré' });
    }
    // Documents à l'en-tête Intégral : pas dans les espaces Escale ni OPSO (deux marques distinctes).
    if (!isEscale() && !isOpso()) TX_APP_DOCS.forEach(function (d) { its.push({ k: 'S:' + d.f, grp: 'app', label: d.label, meta: 'PDF' }); });
    if (!isEscale() && !isOpso()) {
      (txFiches || []).forEach(function (f) { its.push({ k: 'M:' + f.id, grp: 'fab', label: f.titre, meta: 'Fiche ' + f.type.toLowerCase() + ' · ' + f.n + ' produit' + (f.n > 1 ? 's' : '') + ' · PDF généré' }); });
      if (V2.mkt && V2.mkt.catalogueCategoriesFichier) its.push({ k: 'C:categories', grp: 'fab', label: 'Catalogue par catégorie', meta: 'Princeps par tranche de prix et non remboursables · PDF généré' });
      if (V2.docProtegeFichier) TX_PROTEGES.forEach(function (c) { its.push({ k: 'P:' + c, grp: 'fab', label: txProtegeTitre(c), meta: 'PDF' }); });
      if (tx.lgo.s) its.push({ k: 'G:' + tx.lgo.s + ':' + tx.lgo.n, grp: 'lgo', ic: 'LGO', label: txLgoLabel(tx.lgo.s, tx.lgo.n),
        meta: 'Mode d\'emploi PDF + fichier CSV + Excel · 3 pièces jointes' });
    }
    (tx.docs || []).forEach(function (d) {
      its.push({ k: 'D:' + d.name, grp: 'lib', label: txPretty(d.name), meta: (txIsXls(d.name) ? 'Excel' : 'PDF') + ' · ' + txSize(d.size), xls: txIsXls(d.name) });
    });
    return its;
  }
  // Prospect (23/09/2026), puis client (24/09) : chacun choisit le style de ses listings PDF parmi 5 (v2-pdf-prospect.js)
  function txStyleHtml(listings) {
    if (!listings.length || !V2.prospectPdfStyles || !V2.prospectPdfStyle) return '';
    var cur = V2.prospectPdfStyle();
    return '<div class="tx-style"><span class="tx-gs">Style des listings PDF</span><div class="tx-style-b">' +
      V2.prospectPdfStyles.map(function (s) {
        return '<button type="button" class="v2-seg' + (s.id === cur ? ' on' : '') + '" data-s="' + s.id + '"' + (tx.busy ? ' disabled' : '') + ' onclick="V2.pharmaTxStyle(' + s.id + ')">' + s.id + ' · ' + esc(s.nom) + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="v2-btn v2-btn-ghost tx-apercu"' + (tx.busy ? ' disabled' : '') + ' onclick="V2.pharmaTxApercu()">' + ICO('fiche', 15, 2) + 'Voir l\'aperçu</button></div>';
  }
  function txRender() {
    var bd = document.getElementById('tx-modal');
    if (!bd || !tx.pid) return;
    var pharma = (V2.pharmacies || []).find(function (p) { return String(p.id) === tx.pid; });
    var nom = pharma ? nameOf(tx.pid, pharma.name) : (tx.nom || 'l\'officine');
    var mail = txMail[tx.pid] || '';
    var its = txItems(tx.pid);
    var nSel = its.filter(function (i) { return tx.sel[i.k]; }).length;
    function row(i) {
      return '<label class="tx-row"><input type="checkbox" data-k="' + esc(i.k) + '"' + (tx.sel[i.k] ? ' checked' : '') + (tx.busy ? ' disabled' : '') + ' onchange="V2.pharmaTxToggle(this)">' +
        '<span class="tx-ic' + (i.xls ? ' tx-ic-x' : i.ic ? ' tx-ic-g' : '') + '">' + (i.ic || (i.xls ? 'XLS' : 'PDF')) + '</span>' +
        '<span class="tx-l"><b>' + esc(i.label) + '</b><small>' + esc(i.meta) + '</small></span></label>';
    }
    function group(title, sub, arr, extra) {
      if (!arr.length && !extra) return '';
      return '<div class="tx-g"><div class="tx-gh"><span class="pha-kl">' + title + '</span>' + (sub ? '<span class="tx-gs">' + sub + '</span>' : '') + '</div>' +
        arr.map(row).join('') + (extra || '') + '</div>';
    }
    var of = function (grp) { return its.filter(function (i) { return i.grp === grp; }); };
    var lgoHtml = '';
    if (!isEscale() && !isOpso()) {
      var dis = tx.busy ? ' disabled' : '';
      lgoHtml = '<div class="tx-g"><div class="tx-gh"><span class="pha-kl">Catalogue pour son logiciel</span><span class="tx-gs">' +
          (tx.lgo.auto && !tx.lgo.touched ? 'logiciel repris de sa fiche' : tx.lgo.s ? 'produits les plus commandés du réseau, hors génériques' : tx.lgo.brut ? 'saisi « ' + esc(tx.lgo.brut) + ' » : pas encore de mode d\'emploi pour ce logiciel' : 'logiciel inconnu : à choisir') + '</span></div>' +
        '<div class="tx-lgo"><select class="tx-lgo-s" aria-label="Logiciel de l\'officine" onchange="V2.pharmaTxLgo(this.value)"' + dis + '>' +
          '<option value="">Choisir le logiciel…</option>' +
          TX_LGO.map(function (l) { return '<option value="' + l.s + '"' + (l.s === tx.lgo.s ? ' selected' : '') + '>' + esc(l.nom) + '</option>'; }).join('') +
        '</select><div class="tx-style-b tx-lgo-n">' +
          TX_LGO_N.map(function (n) { return '<button type="button" class="v2-seg' + (n === tx.lgo.n ? ' on' : '') + '"' + dis + ' onclick="V2.pharmaTxLgoN(' + n + ')">' + n + ' produits</button>'; }).join('') +
        '</div>' + (tx.lgo.s && !tx.modele ? '<a class="tx-lgo-pas" onclick="V2.pharmaTxClose();V2.lgoOuvrirSur=\'pas\';V2.go(\'lgo\',\'' + tx.lgo.s + '\')">Voir le pas-à-pas ' + esc(txLgoNom(tx.lgo.s)) + ' ›</a>' : '') +
        '</div>' + of('lgo').map(row).join('') + '</div>';
    }
    var lib = of('lib');
    var libMsg = tx.docs === null ? '<div class="tx-empty">Chargement de la bibliothèque…</div>'
      : tx.docsErr ? '<div class="tx-empty tx-err">' + esc(tx.docsErr) + '</div>'
      : (!lib.length ? '<div class="tx-empty">Aucun fichier déposé pour l\'instant. Le premier ajouté sera proposé sur toutes les fiches, pour toute l\'équipe.</div>' : '');
    var upl = '<label class="v2-btn v2-btn-ghost tx-upl' + (tx.busy ? ' is-busy' : '') + '">' + ICO('plus', 15, 2) +
      (tx.busy === 'upload' ? 'Envoi en cours…' : 'Ajouter un PDF ou un Excel') +
      '<input type="file" accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" multiple style="display:none"' +
      (tx.busy ? ' disabled' : '') + ' onchange="V2.pharmaTxUpload(this)"></label>';

    var body = document.getElementById('tx-body');
    var keepY = body ? body.scrollTop : 0;
    document.getElementById('tx-tt').innerHTML = ICO('fiche', 17, 2) + (tx.modele ? ' Documents à joindre au mail' : ' Transmettre à ' + esc(nom));
    body.innerHTML =
      (tx.modele ? '<div class="tx-to">Mail : <b>' + esc(tx.texte.objet) + '</b><br>L\'adresse du pharmacien s\'ajoute ensuite dans votre messagerie.</div>'
        : mail ? '<div class="tx-to">Destinataire : <b>' + esc(mail) + '</b></div>'
            : '<div class="tx-to tx-err">Pas d\'e-mail connu pour cette officine — à renseigner dans « Infos officine ».</div>') +
      (tx.modele ? '' : pharma ? group('Ses listings produits', 'ce qu\'elle n\'a pas encore', of('listing'), txStyleHtml(of('listing')))
              : group('Listings produits', 'les plus commandés' + (tx.grp ? ' · son groupement : ' + esc(tx.grp) : ''), of('listing'),
                  (window.BENCHMARK ? '' : '<div class="tx-empty">Chargement du catalogue…</div>') + txStyleHtml(of('listing')))) +
      lgoHtml +
      group('Documents Intégral Pharma', '', of('app')) +
      group('Faits dans l\'app', 'fiches Marketing de l\'équipe, biosimilaires, catalogue', of('fab'),
        txFiches === null && !isEscale() && !isOpso() ? '<div class="tx-empty">Chargement des fiches Marketing…</div>' : '') +
      group('Bibliothèque de l\'équipe', 'déposés par chacun, visibles par tous', lib, libMsg + upl);
    body.scrollTop = keepY;

    var foot;
    if (tx.busy === 'prepare') {
      foot = '<div class="tx-state">Préparation du fichier ' + tx.step + ' sur ' + tx.total + '…</div>';
    } else if (tx.files) {
      var tot = tx.files.reduce(function (s, f) { return s + (f.size || 0); }, 0);
      var canSh = false;
      try { canSh = !!(navigator.share && navigator.canShare && navigator.canShare({ files: tx.files })); } catch (e) {}
      var tt = tx.texte || txTexteDefaut(tx.files);
      var href = 'mailto:' + encodeURIComponent(mail) + '?subject=' + encodeURIComponent(tt.objet) + '&body=' + encodeURIComponent(tt.corps);
      foot = '<div class="tx-state"><b>' + tx.files.length + ' fichier' + (tx.files.length > 1 ? 's' : '') + ' prêt' + (tx.files.length > 1 ? 's' : '') + '</b> · ' + txSize(tot) +
          (tot > 20 * 1048576 ? '<span class="tx-warn">Plus de 20 Mo : de nombreuses messageries refusent un mail aussi lourd.</span>' : '') +
          (!canSh ? '<span class="tx-hint">Les fichiers arrivent dans Téléchargements : glisse-les dans le mail avant de l\'envoyer.</span>' : '') + '</div>' +
        '<button class="v2-btn v2-btn-ghost" onclick="V2.pharmaTxReset()">Modifier</button>' +
        (!canSh && (mail || tx.modele) ? '<a class="v2-btn v2-btn-ghost" href="' + esc(href) + '">Ouvrir le mail</a>' : '') +
        '<button class="v2-btn v2-btn-primary" onclick="V2.pharmaTxSend()">' + ICO(canSh ? 'spark' : 'download', 16) + (canSh ? 'Envoyer' : 'Télécharger les fichiers') + '</button>';
    } else if (tx.choixSeul) {   // simple choix pour « Préparer le mail » : on revient à la fenêtre du mail
      foot = '<div class="tx-state">' + (nSel ? '<b>' + nSel + '</b> document' + (nSel > 1 ? 's' : '') + ' choisi' + (nSel > 1 ? 's' : '') : 'Cochez les documents à joindre') + '</div>' +
        '<button class="v2-btn v2-btn-primary" onclick="V2.pharmaTxClose()">' + ICO('check', 16, 2) + 'Valider le choix</button>';
    } else {
      foot = '<div class="tx-state">' + (nSel ? '<b>' + nSel + '</b> sélectionné' + (nSel > 1 ? 's' : '') : tx.modele ? 'Cochez les documents à joindre' : 'Cochez ce que vous voulez lui transmettre') + '</div>' +
        '<button class="v2-btn v2-btn-primary"' + (nSel && !tx.busy ? '' : ' disabled') + ' onclick="V2.pharmaTxPrepare()">' + ICO('check', 16, 2) + 'Préparer les fichiers</button>';
    }
    document.getElementById('tx-foot').innerHTML = foot;
  }
  // 23/09/2026 — `presel` : clés à pré-cocher (Ma liste › Ouverture de compte coche le
  // formulaire) ; `info` {nom, mail} : quand on n'est pas sur la fiche (Ma liste), le nom et
  // l'e-mail d'un prospect ne sont pas à l'écran, ils viennent de la ligne de la liste.
  // 23/09 soir : `info.texte` {objet, corps} = le mail type de la To do list, qui part AVEC
  // les pièces jointes (feuille de partage) ; sans officine (`pid` vide), mode « modèle ».
  V2.pharmaTransmettre = function (pid, presel, info) {
    var texte = (info && info.texte) || null, modele = !pid;
    pid = modele ? '__modele__' : String(pid);
    if (tx.pid !== pid || (tx.texte && texte && tx.texte.objet !== texte.objet)) { tx.sel = {}; tx.files = null; }
    tx.pid = pid; tx.busy = ''; tx.texte = texte; tx.modele = modele;
    // 25/09/2026 — la fenêtre « Préparer le mail » de la To do list tient la liste des pièces
    // jointes : la sélection repart EXACTEMENT de la sienne et lui est renvoyée à chaque coche.
    tx.surChoix = (info && info.surChoix) || null; tx.choixSeul = !!(info && info.choixSeul);
    if (tx.surChoix) { tx.sel = {}; tx.files = null; }
    (presel || []).forEach(function (k) { tx.sel[k] = true; });
    if (tx.lgo.pid !== pid) {
      var s0 = modele ? '' : txLgoDetect(pid, null);
      tx.lgo = { pid: pid, s: s0, n: 300, auto: !!s0, touched: false };
      // La saisie de l'équipe (Infos officine) passe avant la base clients : lue en différé.
      if (!modele && V2.profil && V2.profil.charger) V2.profil.charger('client', pid).then(function (d) {
        var s1 = txLgoDetect(pid, d);
        var brut = d && String(d.lgo || '').trim() && !s1 ? String(d.lgo).trim() : '';
        if (tx.lgo.pid === pid && brut !== (tx.lgo.brut || '')) { tx.lgo.brut = brut; if (s1 === tx.lgo.s) txRender(); }
        if (tx.lgo.pid === pid && !tx.lgo.touched && s1 !== tx.lgo.s) {
          var k0 = 'G:' + tx.lgo.s + ':' + tx.lgo.n;   // case déjà cochée : elle suit le logiciel
          if (tx.sel[k0]) { delete tx.sel[k0]; if (s1) tx.sel['G:' + s1 + ':' + tx.lgo.n] = true; if (tx.surChoix) tx.surChoix(Object.keys(tx.sel)); }
          tx.lgo.s = s1; tx.lgo.auto = !!s1; txRender();
        }
      }, function () {});
    }
    if (modele) txMail[pid] = '';
    else if (!txIsClient(pid)) {   // fiche prospect : l'e-mail et le nom sont ceux affichés à l'écran
      var em = document.querySelector('.v2-prospect input[data-fk="email"]'), nm = document.querySelector('.v2-prospect input[data-fk="nom"]');
      var gr = document.querySelector('.v2-prospect input[data-fk="groupement"]');
      tx.grp = (gr && (gr.value || '').trim()) ? canonG((gr.value || '').trim()) : '';
      if (!window.BENCHMARK && V2.loadFiles) V2.loadFiles(['bench', 'sagitta']).then(txRender, txRender);
      var pt = pharmaFrById(pid);
      txMail[pid] = (em ? (em.value || '').trim() : '') || (info && info.mail) || '';
      tx.nom = nameOf(pid, (nm && (nm.value || '').trim()) || (info && info.nom) || (pt && (pt[6] || pt[10])) || '');
    } else if (info && info.mail && !txMail[pid]) txMail[pid] = info.mail;
    var bd = document.getElementById('tx-modal');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'tx-modal'; bd.className = 'prepa-modal';
      bd.innerHTML = '<div class="prepa-dialog tx-dialog" onclick="event.stopPropagation()">' +
        '<div class="prepa-top"><div class="prepa-tt" id="tx-tt"></div>' +
          '<button class="prepa-x" onclick="V2.pharmaTxClose()" title="Fermer">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="tx-body" id="tx-body"></div><div class="tx-foot" id="tx-foot"></div></div>';
      bd.onclick = function () { V2.pharmaTxClose(); };
      document.body.appendChild(bd);
    }
    bd.classList.add('open');
    txRender();
    txLoadDocs().then(txRender);
    txLoadFiches().then(txRender);
  };
  // Nom lisible d'une pièce jointe à partir de sa clé (S: document de l'app, D: bibliothèque, L: listing généré).
  V2.pharmaTxLabel = function (k) {
    k = String(k || '');
    if (k.indexOf('S:') === 0) { var d = TX_APP_DOCS.find(function (x) { return x.f === k.slice(2); }); return d ? d.label : k.slice(2); }
    if (k.indexOf('D:') === 0) return txPretty(k.slice(2));
    if (k.indexOf('P:') === 0) return txProtegeTitre(k.slice(2));
    if (k === 'C:categories') return 'Catalogue par catégorie';
    if (k.indexOf('G:') === 0) { var g = k.split(':'); return txLgoLabel(g[1], g[2]); }
    if (k.indexOf('M:') === 0) { var f = (txFiches || []).filter(function (x) { return x.id === k.slice(2); })[0]; return f ? f.titre : 'Fiche Marketing'; }
    if (k === 'L:reseau') return 'Listing produits (réseau)';
    if (k === 'L:groupement') return 'Listing produits (groupement)';
    if (k === 'X:reseau') return 'Listing produits (réseau) · Excel';
    if (k === 'X:groupement') return 'Listing produits (groupement) · Excel';
    return k;
  };
  // Depuis le bouton de la fiche : Transmettre s'ouvre sur le catalogue de son logiciel, coché.
  V2.pharmaTxCatalogue = function (pid, s) {
    V2.pharmaTransmettre(pid);
    if (tx.lgo.pid === String(pid) && !tx.lgo.touched && s && tx.lgo.s !== s && TX_LGO.some(function (l) { return l.s === s; })) { tx.lgo.s = s; tx.lgo.auto = true; }
    if (tx.lgo.s) { tx.sel['G:' + tx.lgo.s + ':' + tx.lgo.n] = true; tx.files = null; txRender(); }
  };
  V2.pharmaTxClose = function () { var bd = document.getElementById('tx-modal'); if (bd) bd.classList.remove('open'); };
  V2.pharmaTxReset = function () { tx.files = null; txRender(); };
  V2.pharmaTxStyle = function (n) { if (!tx.busy && V2.prospectPdfStyle) V2.prospectPdfStyle(n); };
  V2.pharmaTxApercu = function () {
    if (tx.busy || !tx.pid) return;
    var ls = txItems(tx.pid).filter(function (i) { return i.grp === 'listing' && i.k.indexOf('L:') === 0; });
    var pick = ls.filter(function (i) { return tx.sel[i.k]; })[0] || ls[0];
    if (pick) V2.pharmaListPdf(tx.pid, pick.k.slice(2));
  };
  // Style changé (ici ou dans l'aperçu) : les fichiers déjà préparés ne sont plus les bons.
  window.addEventListener('pdfp-style', function () {
    if (tx.busy) return;
    tx.files = null;
    var bd = document.getElementById('tx-modal'); if (bd && bd.classList.contains('open')) txRender();
  });
  // Changer de logiciel ou de taille : la case suit (une seule version du catalogue cochée).
  function txLgoSet(s, n) {
    var old = 'G:' + tx.lgo.s + ':' + tx.lgo.n, was = !!tx.sel[old];
    delete tx.sel[old];
    tx.lgo.s = s; tx.lgo.n = n; tx.lgo.touched = true;
    if (was && s) tx.sel['G:' + s + ':' + n] = true;
    if (tx.surChoix) tx.surChoix(Object.keys(tx.sel));
    tx.files = null; txRender();
  }
  V2.pharmaTxLgo = function (s) { if (!tx.busy) txLgoSet(TX_LGO.some(function (l) { return l.s === s; }) ? s : '', tx.lgo.n); };
  V2.pharmaTxLgoN = function (n) { if (!tx.busy && TX_LGO_N.indexOf(+n) >= 0) txLgoSet(tx.lgo.s, +n); };
  V2.pharmaTxToggle = function (el) {
    var k = el.getAttribute('data-k');
    if (el.checked) tx.sel[k] = true; else delete tx.sel[k];
    if (tx.surChoix) tx.surChoix(Object.keys(tx.sel));
    tx.files = null; txRender();
  };
  function txFetch(pid, k) {
    if (k.indexOf('L:') === 0) return Promise.resolve(V2.pharmaListPdf(pid, k.slice(2), 'blob'));
    if (k.indexOf('X:') === 0) return V2.pharmaListXlsx(pid, k.slice(2), 'blob');
    if (k.indexOf('M:') === 0) return V2.mkt && V2.mkt.fichePdfFichier ? V2.mkt.fichePdfFichier(k.slice(2)) : Promise.resolve(null);
    if (k === 'C:categories') return V2.mkt && V2.mkt.catalogueCategoriesFichier ? V2.mkt.catalogueCategoriesFichier() : Promise.resolve(null);
    if (k.indexOf('P:') === 0) return TX_PROTEGES.indexOf(k.slice(2)) >= 0 && V2.docProtegeFichier ? V2.docProtegeFichier(k.slice(2)) : Promise.resolve(null);
    if (k.indexOf('G:') === 0) {
      var g = k.split(':'), s = g[1], n = +g[2];
      if (!TX_LGO.some(function (l) { return l.s === s; }) || TX_LGO_N.indexOf(n) < 0) return Promise.resolve(null);
      var base = 'integral-top' + n + '-' + s, nom = txLgoLabel(s, n);
      var parts = [
        { f: 'tuto-' + s + '.pdf', name: 'mode-emploi-import-' + s + '.pdf', type: 'application/pdf', l: nom + ' · mode d\'emploi' },
        { f: base + '.csv', name: base + '.csv', type: 'text/csv', l: nom + ' · fichier CSV' },
        { f: base + '.xlsx', name: base + '.xlsx', type: txMime('x.xlsx'), l: nom + ' · fichier Excel' }
      ];
      return Promise.all(parts.map(function (p) {
        return fetch('lgo/' + p.f).then(function (r) { if (!r.ok) throw new Error(p.f); return r.blob(); })
          .then(function (b) { var fl = new File([b], p.name, { type: p.type }); fl.txLabel = p.l; return fl; });
      }));
    }
    if (k.indexOf('S:') === 0) {
      return fetch(k.slice(2)).then(function (r) { return r.ok ? r.blob() : null; })
        .then(function (b) { return b ? new File([b], k.slice(2), { type: 'application/pdf' }) : null; });
    }
    var c = txSb(), name = k.slice(2);
    if (!c || !c.storage) return Promise.resolve(null);
    return c.storage.from(TX_BUCKET).download(name).then(function (r) {
      return (r && r.data && !r.error) ? new File([r.data], txPretty(name), { type: txMime(name) }) : null;
    });
  }
  // 24/09/2026 : le style du listing (prospect ou client) est écrit dans la trace (savoir lequel l'équipe utilise)
  function txStyleNote(pid, k) {
    if (k.indexOf('L:') !== 0 || !V2.prospectPdfStyle || !V2.prospectPdfStyles) return '';
    var n = V2.prospectPdfStyle(), s = V2.prospectPdfStyles.find(function (x) { return x.id === n; });
    return s ? ' (style ' + s.id + ' · ' + s.nom + ')' : '';
  }
  // Deux temps (Préparer puis Envoyer) : Safari n'ouvre la feuille de partage que
  // dans le clic lui-même — après plusieurs secondes de génération, il la refuse.
  V2.pharmaTxPrepare = function () {
    if (tx.busy || !tx.pid) return;
    var pid = tx.pid;
    var its = txItems(pid).filter(function (i) { return tx.sel[i.k]; });
    if (!its.length) return;
    tx.busy = 'prepare'; tx.step = 0; tx.total = its.length; txRender();
    var out = [], fails = [], chain = Promise.resolve();
    its.forEach(function (it) {
      chain = chain.then(function () {
        tx.step++; txRender();
        return txFetch(pid, it.k).then(function (f) {
          if (Array.isArray(f)) { if (f.length) out.push.apply(out, f); else fails.push(it.label); }
          else if (f) { f.txLabel = it.label + txStyleNote(pid, it.k); out.push(f); } else fails.push(it.label);
        },
          function () { fails.push(it.label); });
      });
    });
    chain.then(function () {
      tx.busy = ''; tx.files = out.length ? out : null; txRender();
      if (fails.length) V2.toast('Non préparé : ' + fails.join(', '), 'error');
    });
  };
  function txDownloadAll(files) {
    files.forEach(function (f, i) {
      setTimeout(function () {
        var u = URL.createObjectURL(f), a = document.createElement('a');
        a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      }, i * 400);
    });
    V2.toast(files.length > 1 ? files.length + ' fichiers téléchargés — à joindre au mail' : 'Fichier téléchargé — à joindre au mail');
  }
  // Trace dans les notes de la fiche : une ligne par lot préparé (pas de doublon si
  // on appuie deux fois). Le CRM ne voit pas le mail partir, d'où « préparés pour envoi ».
  function txTrace(pid, files) {
    if (!V2.notes || !V2.notes.addAuto || tx.traced === files || tx.modele) return;
    tx.traced = files;
    var body = 'Documents préparés pour envoi en pièces jointes :\n' + files.map(function (f) { return '- ' + (f.txLabel || f.name); }).join('\n');
    V2.notes.addAuto('client', pid, body).then(function (ok) {
      if (!ok) { tx.traced = null; V2.toast('La trace dans les notes de la fiche n\'a pas pu s\'enregistrer', 'warn'); }
    });
  }
  V2.pharmaTxSend = function () {
    var files = tx.files, pid = tx.pid;
    if (!files || !files.length) return;
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: files })) {
        var tt = tx.texte || txTexteDefaut(files);
        var sh = { files: files, title: tt.objet, text: tt.corps };
        navigator.share(sh)
          .then(function () { txTrace(pid, files); })
          .catch(function (e) { if (!e || e.name !== 'AbortError') { txDownloadAll(files); txTrace(pid, files); } });
        return;
      }
    } catch (e) {}
    txDownloadAll(files);
    txTrace(pid, files);
  };
  V2.pharmaTxUpload = function (input) {
    var all = input && input.files ? [].slice.call(input.files) : [];
    var ok = all.filter(function (f) { return /\.(pdf|xlsx|xls)$/i.test(f.name); });
    if (!ok.length) { V2.toast('Choisissez un fichier PDF ou Excel.', 'warn'); return; }
    var c = txSb();
    if (!c || !c.storage) { V2.toast('Connexion requise pour ajouter un fichier.', 'error'); return; }
    tx.busy = 'upload'; txRender();
    var failed = [], added = [], chain = Promise.resolve();
    ok.forEach(function (f) {
      chain = chain.then(function () {
        var key = Date.now() + '-' + Math.floor(Math.random() * 1000) + '__' + txSanitize(f.name);
        return c.storage.from(TX_BUCKET).upload(key, f, { contentType: txMime(f.name), upsert: false })
          .then(function (r) { if (r && r.error) failed.push(f.name + ' (' + (r.error.message || 'refusé') + ')'); else added.push(key); },
            function () { failed.push(f.name); });
      });
    });
    chain.then(txLoadDocs).then(function () {
      added.forEach(function (k) { tx.sel['D:' + k] = true; });
      tx.busy = ''; tx.files = null; txRender();
      if (failed.length) V2.toast('Non ajouté : ' + failed.join(', '), 'error');
      else if (ok.length < all.length) V2.toast('Ajouté. Ignoré : fichiers qui ne sont ni PDF ni Excel.', 'warn');
      else V2.toast(added.length > 1 ? added.length + ' fichiers ajoutés pour toute l\'équipe' : 'Fichier ajouté pour toute l\'équipe');
    });
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
      // 11/09/2026 — perf : par l'index ventes (une passe complète PAR liste sinon)
      Object.keys(ids).forEach(function (pid) {
        var ss = pharmaSalesAll(pid);
        for (var si = 0; si < ss.length; si++) ca += ss[si].mntNetHt || 0;
        if (aDesVentes(pid)) actSet[pid] = 1;
      });
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
      '<div class="v2-empty-d">Créez des listes sur mesure (ex : Big pharma, Pharma PDA, Liste NR) en piochant des pharmacies dans n\'importe quel groupement. Vous retrouvez leurs achats agrégés et l\'export PDF, exactement comme pour un groupement.</div></div>';
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap v2-u">' +
        teteOfficines('Vos listes sur mesure : des pharmacies que vous regroupez vous-même.',
          '<button type="button" class="v2-btn v2-btn-primary" onclick="V2.pharmaListNew()">' + ICO('plus', 18) + 'Nouvelle liste</button>') +
        pharmaTabs('listes') +
        (lists.length ? '<div class="v2-card">' + cards + '</div>' : empty) +
      '</div>';
  }

  function renderListeDetail(root, id) {
    var l = listGet(id);
    if (!l) { selList = null; renderListesList(root); return; }
    if (!window.BENCHMARK) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du catalogue…</div></div>';
      V2.loadFiles(['bench', 'sagitta']).then(function () { if (V2.route && V2.route.name !== 'pharma') return; /* 11/09/2026 (phase 4) : l'écran a pu changer pendant l'attente */ V2.render(); });
      return;
    }
    demanderCatComplet();
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
            (total ? '<button class="v2-btn v2-btn-ghost" onclick="V2.listDownloadXlsx(\'' + esc(id) + '\')">' + ICO('download', 16) + 'Excel</button>' : '') +
            (total && V2.canShareFiles && V2.canShareFiles() ? '<button class="v2-btn v2-btn-ghost" onclick="V2.listDownloadPdf(\'' + esc(id) + '\',\'share\')">' + ICO('spark', 16) + 'Partager</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    var members = (V2.pharmacies || []).filter(function (p) { return ids[String(p.id)]; }).map(function (p) {
      var ps = pharmaSalesAll(p.id);
      return { p: p, ca: V2.sumCA(ps), active: aDesVentes(p.id), voit: V2.voitVentesDe(p.id) };
    }).sort(function (a, b) { return (b.active - a.active) || (b.ca - a.ca); });
    var memRows = members.map(function (m) {
      return '<div class="v2-row pl-mem" onclick="V2.go(\'pharma\',\'' + esc(String(m.p.id)) + '\')">' +
        '<span class="v2-row-dot" style="background:' + esc(m.p.color || 'var(--c-cat)') + '"></span>' +
        '<span class="v2-row-name">' + esc(m.p.name) + (m.p.ville ? ' <span style="color:var(--muted);font-weight:500">· ' + esc(m.p.ville) + '</span>' : '') +
          (m.p.groupement ? ' <span class="pl-mem-grp">' + esc(groupName(m.p)) + '</span>' : '') + '</span>' +
        (m.active ? (m.voit ? '<span class="v2-row-val mono">' + V2.fmtEur(m.ca) + '</span>' : '<span class="v2-row-meta">cliente</span>') : '<span class="v2-row-meta">non cliente</span>') +
        '<button class="pl-rm" title="Retirer de la liste" onclick="event.stopPropagation();V2.pharmaListRemovePh(\'' + esc(id) + '\',\'' + esc(String(m.p.id)) + '\')">' + ICO('close', 15, 2) + '</button>' +
      '</div>';
    }).join('');
    var membersCard =
      '<div class="v2-card" style="margin-bottom:22px">' +
        '<div class="v2-card-head"><div class="v2-card-t">' + ICO('pharma', 17) + 'Pharmacies de la liste</div>' +
          '<span class="v2-card-link" onclick="V2.pharmaListAddOpen(\'' + esc(id) + '\')">+ Ajouter</span></div>' +
        (memRows || '<div class="v2-empty"><div class="v2-empty-d">Liste vide. Cliquez sur « Ajouter des pharmacies » pour piocher des officines (filtre par groupement disponible).</div></div>') +
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
    var commBar = commSelect();
    var withGeo = (V2.pharmacies || []).filter(function (p) {
      if (V2.commFilter && (p.comms || []).indexOf(V2.commFilter) < 0) return false;
      return typeof p.lat === 'number' && typeof p.lng === 'number';
    });
    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<div class="v2-wrap v2-u">' +
        teteOfficines('La carte de votre secteur · ' + V2.fmtNum(withGeo.length) + ' officine' + (withGeo.length > 1 ? 's' : '') + ' localisée' + (withGeo.length > 1 ? 's' : '')) +
        pharmaTabs('carte') + (commBar ? '<div class="of-bar">' + commBar + '</div>' : '') +
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
    if (!window.L) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Carte indisponible — vérifiez votre connexion internet.</div>'; return; }
    if (_secMap) { try { _secMap.remove(); } catch (e) {} _secMap = null; }
    el.innerHTML = '';
    _secMap = window.L.map(el, { scrollWheelZoom: true, preferCanvas: true }).setView([46.7, 2.4], 6);
    V2.fondCarte(_secMap);
    var pts = [];
    list.forEach(function (p) {
      var ca = caOfPharma(p.id), st = secStyle(ca);
      var mk = window.L.circleMarker([p.lat, p.lng], { radius: st.r, color: st.color, weight: 1.5, fillColor: st.fill, fillOpacity: .82 });
      var pop = '<b>' + esc(p.name) + '</b>' + (p.ville ? '<br>' + esc(p.cp || '') + ' ' + esc(p.ville) : '') +
        (p.groupement ? '<br><span style="color:#737A8C">' + esc(groupName(p)) + '</span>' : '') +
        (V2.voitVentesDe(p.id) ? '<br><b style="color:#0050E6">' + V2.fmtEur(ca) + '</b> de CA' : '') +
        '<br><a href="#" onclick="V2.go(\'pharma\',\'' + esc(String(p.id)) + '\');return false" style="color:#0050E6;font-weight:700">Ouvrir la fiche →</a>';
      mk.bindPopup(pop); mk.addTo(_secMap); pts.push([p.lat, p.lng]);
    });
    if (pts.length) { try { _secMap.fitBounds(pts, { padding: [40, 40], maxZoom: 11 }); } catch (e) {} }
    setTimeout(function () { try { _secMap.invalidateSize(); } catch (e) {} }, 120);
  }

  // ── Touches motion (façon Framer Motion), 100% via l'API V2.motion ─────
  // Appelé après chaque rendu du pilier. Tout est RM-safe (l'API pose l'état
  // final sans animation si prefers-reduced-motion). Aucune logique touchée :
  // on ne fait qu'animer transform/opacity d'éléments déjà rendus.
  function applyPharmaMotion(root) {
    var M = V2.motion; if (!M || !root) return;

    // 1) Cascade d'entrée sur les cartes « quoi lui proposer » + les listes d'achats.
    var props = root.querySelectorAll('.phf-props .phf-prop');
    if (props.length) M.stagger(props, { step: 55, y: 10, duration: 300 });

    // 2) KPIs de l'officine : le count-up [data-count] est déjà auto-branché ;
    //    on le déclenche à coup sûr quand la carte entête arrive à l'écran.
    var kcard = root.querySelector('.phf-hcard');
    if (kcard) {
      M.inView(kcard, function (el) {
        var nums = el.querySelectorAll('.phf-hkpi-v[data-count]');
        for (var i = 0; i < nums.length; i++) M.countUp(nums[i]);
      });
    }

    // 2bis) Graphe CA du tableau de bord : les barres poussent en cascade depuis
    //       la ligne de base (transform:scaleY uniquement — jamais width/height),
    //       puis valeurs et repères fondent en douceur. RM-safe via V2.motion.
    var fills = root.querySelectorAll('.ph-mchart .ph-mbar-fill');
    for (var f = 0; f < fills.length; f++) {
      M.animate(fills[f], [
        { transform: 'scaleY(0)' },
        { transform: 'scaleY(1)' }
      ], { duration: 480, delay: 140 + Math.min(f, 12) * 50, easing: M.ease.out, to: { transform: 'scaleY(1)' } });
    }
    if (fills.length) {
      M.stagger(root.querySelectorAll('.ph-mchart .ph-mbar-v'), { step: 50, y: 4, duration: 260, delay: 220 });
      M.stagger(root.querySelectorAll('.ph-dash-kfs .ph-dash-kf'), { step: 60, y: 6, duration: 280, delay: 340 });
    }

    // 3) CTA primaire (télécharger la liste d'achats PDF) rendu magnétique.
    var cta = root.querySelector('.phf-pdf:not(.phf-pdf-ghost)');
    if (cta) M.magnetic(cta);

    // 4) Révélation douce du contenu de la section repliable qui vient de s'ouvrir.
    if (_justOpenedSection) {
      var head = root.querySelector('.v2-section-head[data-sec="' + _justOpenedSection + '"]');
      var body = head && head.parentNode ? head.nextElementSibling : null;
      if (body) M.enter(body, { y: 6, duration: 260 });
      _justOpenedSection = null;
    }
  }

  V2.pages.pharma = {
    render: function (root, param) {
      var _out = (function () {
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
      })();
      // Touches motion post-rendu (RM-safe, transform/opacity uniquement).
      try {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { applyPharmaMotion(root); });
        else applyPharmaMotion(root);
      } catch (e) {}
      return _out;
    }
  };

  // ── Styles spécifiques au pilier (injectés une fois) ───────────
  // Cohérents avec v2.css ; aucune classe .v2-* du design system n'est redéfinie.
  if (!document.getElementById('v2-pharma-style')) {
    var st = document.createElement('style');
    st.id = 'v2-pharma-style';
    st.textContent = [
      '.v2-prospect{display:flex;flex-direction:column;gap:0}',
      '.v2-prospect-hd{padding:18px 20px}',
      '.v2-prospect-top{display:flex;align-items:center;gap:14px}',
      '.v2-prospect-n{font-size:18px;font-weight:800;letter-spacing:-.01em;line-height:1.2}',
      '.v2-prospect-a{color:var(--muted);font-size:13px;margin-top:2px}',
      '.v2-prospect-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
      '.v2-prospect-extra{margin-top:6px;font-size:12px;color:var(--muted);overflow-wrap:anywhere}',
      '.v2-prospect-extra a{color:inherit;text-decoration:underline}',
      '.v2-prospect-extra.v2-cessee{color:var(--c-rose-txt);font-weight:700}',
      '.v2-prospect-extra.v2-retraite{color:var(--c-amber-txt);font-weight:700}',
      // Estimation « probable » (grossiste/génériqueur, jamais une donnée connue) :
      // italique, teinte ambre distincte du reste de la fiche.
      '.v2-prospect-probable{margin-top:8px;font-size:12px;font-style:italic;color:var(--c-amber-txt);display:flex;flex-direction:column;gap:2px}',
      '.v2-prospect-probable span{font-weight:700;font-style:normal}',
      '.v2-prospect-probable b{font-weight:600}',
      '.v2-chip.pr{background:color-mix(in srgb,var(--ip-blue) 12%,#fff);color:var(--ip-blue);box-shadow:0 0 0 1px color-mix(in srgb,var(--ip-blue) 22%,transparent) inset}',
      '.v2-prospect-note{margin:14px 0 0;font-size:12.5px;line-height:1.5;color:var(--muted)}',
      '.v2-prospect-acts{padding:14px 18px;display:flex;gap:10px;flex-wrap:wrap}',
      '.v2-pharma-pin{width:46px;height:46px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 3px 9px rgba(16,19,28,.18),0 1px 0 rgba(255,255,255,.25) inset}',
      '.v2-pharma-stats{display:grid;grid-template-columns:repeat(4,1fr)}',
      '@media(max-width:720px){.v2-pharma-stats{grid-template-columns:repeat(2,1fr)}}',
      '.v2-pharma-stat{padding:16px 22px;border-right:1px solid var(--line);border-top:1px solid var(--line)}',
      '.v2-pharma-stat:nth-child(-n+4){border-top:none}',
      '.v2-pharma-stat:nth-child(4n){border-right:none}',
      '@media(max-width:720px){.v2-pharma-stat:nth-child(2n){border-right:none}.v2-pharma-stat:nth-child(2){border-top:none}}',
      '.v2-pharma-stat-l{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}',
      '.v2-pharma-stat-v{font-size:22px;font-weight:700;letter-spacing:-.03em;margin-top:6px;color:var(--sc,var(--ip-ink))}',
      '.v2-cat{margin-bottom:13px;transition:box-shadow .2s var(--ease)}',
      '.v2-cat.open{box-shadow:var(--sh-3)}',
      '.v2-cat-head{display:flex;align-items:center;gap:14px;padding:15px 20px;cursor:pointer;user-select:none;transition:background .14s}',
      '.v2-cat-head:hover{background:var(--card-2)}',
      '.v2-cat-accent{width:5px;align-self:stretch;border-radius:3px;flex-shrink:0;min-height:34px}',
      '.v2-cat-titles{flex:1;min-width:0}',
      '.v2-cat-t{font-size:15px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}',
      '.v2-cat-sub{font-size:12px;font-weight:600;color:var(--muted);font-family:var(--mono)}',
      '.v2-cat-meta{font-size:12px;color:var(--muted);margin-top:3px}',
      '.v2-cat-chev{color:var(--muted-2);flex-shrink:0;transition:transform .25s var(--ease)}',
      '.v2-cat-chev.open{transform:rotate(90deg)}',
      '.v2-cat-table-wrap{overflow-x:auto;border-top:1px solid var(--line)}',
      '.v2-cat-prod{font-weight:600}',
      '.v2-cat-empty{padding:22px 20px;text-align:center;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}',
      // ── Tableau de bord officine : graphe CA visible dès l'arrivée ──
      '.ph-act-grid{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);gap:14px;margin-bottom:6px}',
      '@media(max-width:960px){.ph-act-grid{grid-template-columns:1fr}}',
      '.ph-dash-chart{padding:18px 20px 16px;display:flex;flex-direction:column}',
      '.ph-dash-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}',
      '.ph-dash-period{font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap}',
      '.ph-mchart{display:flex;align-items:flex-end;gap:10px;height:168px;flex:1}',
      '.ph-mbar{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;min-width:0}',
      '.ph-mbar-v{font-size:12px;font-weight:700;color:var(--muted)}',
      '.ph-mbar-track{flex:1;width:100%;max-width:44px;display:flex;align-items:flex-end;background:var(--line-2);border-radius:8px 8px 3px 3px;overflow:hidden}',
      '.ph-mbar-fill{display:block;width:100%;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 46%,#fff),color-mix(in srgb,var(--ip-blue) 78%,#fff));transform-origin:50% 100%}',
      '.ph-mbar-l{font-size:12px;color:var(--muted);font-weight:600}',
      /* Mois record : seul accent fort du graphe (hiérarchie calme façon Launcher) */
      '.ph-mbar-hot .ph-mbar-fill{background:linear-gradient(180deg,var(--ip-blue),var(--ip-blue-d));box-shadow:0 2px 8px color-mix(in srgb,var(--ip-blue) 32%,transparent)}',
      '.ph-mbar-hot .ph-mbar-v{color:var(--ip-blue);font-weight:800}',
      '.ph-mbar-hot .ph-mbar-l{color:var(--ip-ink);font-weight:700}',
      /* Repères dérivés sous le graphe (moyenne · meilleur mois · mois actifs) */
      '.ph-dash-kfs{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}',
      '.ph-dash-kf{flex:1;min-width:104px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);padding:9px 12px}',
      '.ph-dash-kf-l{display:block;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);white-space:nowrap}',
      '.ph-dash-kf-v{display:block;font-size:14.5px;font-weight:800;letter-spacing:-.01em;margin-top:3px;color:var(--ip-ink)}',
      '.ph-dash-kf-v small{font-size:12px;color:var(--muted);font-weight:600}',
      '.ph-tr-cat{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13.5px}',
      '.ph-tr-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}',
      '.ph-tr-sub{font-size:12px;color:var(--muted);font-family:var(--mono);font-weight:500;margin-left:2px}',
      '.ph-tr-bar{height:4px;border-radius:999px;background:var(--line);overflow:hidden;margin-top:6px}',
      '.ph-tr-bar span{display:block;height:100%;border-radius:999px}',
      // ── Top 5 par catégorie ──
      // ── Détail mois par mois × catégorie (heatmap calme) ──
      '.ph-mcat{margin-top:var(--section-gap,20px)}',
      '.ph-mcat-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card)}',
      '.ph-mcat-table{border-collapse:collapse;width:100%;font-size:12.5px}',
      '.ph-mcat-table th,.ph-mcat-table td{padding:7px 11px;white-space:nowrap;border-bottom:1px solid var(--line-2,var(--line))}',
      '.ph-mcat-table tbody tr:last-child td,.ph-mcat-table tbody tr:last-child th{border-bottom:none}',
      '.ph-mcat-corner{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}',
      '.ph-mcat-mth{text-align:right;font-size:12px;font-weight:700;color:var(--muted);text-transform:capitalize}',
      '.ph-mcat-rh{text-align:left;font-weight:600;color:var(--ip-ink);position:sticky;left:0;background:var(--card);z-index:1}',
      '.ph-mcat-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:middle}',
      '.ph-mcat-c{text-align:right;font-variant-numeric:tabular-nums;color:var(--ip-ink);font-weight:600}',
      '.ph-mcat-z{color:var(--muted-2)}',
      '.ph-mcat-tot{text-align:right;font-variant-numeric:tabular-nums;font-weight:800;color:var(--ip-blue);background:var(--card-2)}',
      '.ph-mcat-ev-h{text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}',
      '.ph-mcat-ev{text-align:right;font-size:12px;font-weight:800;white-space:nowrap;color:var(--muted-2)}',
      '.ph-mcat-ev.up{color:var(--c-mint-txt)}.ph-mcat-ev.dn{color:var(--c-rose)}',
      // bandeau KPI de la fiche = mêmes cartes que Pilotage, juste resserré
      '.ph-kpis{margin-bottom:14px}',
      '.ph-act-below{margin-top:16px}',
      '.ph-kpis .v2-kpi{padding:13px 15px}',
      '.ph-kpis .v2-kpi-v{font-size:21px;margin-top:5px;white-space:nowrap}',
      '.ph-kpis .v2-kpi-v small{font-size:12px;font-weight:600;color:var(--muted)}',
      '.ph-kpis .v2-kpi-d{font-size:12px;line-height:1.3}',
      '.ph-mcat-trow th,.ph-mcat-trow td{font-weight:800;background:var(--card-2);color:var(--ip-ink);border-top:1px solid var(--line)}',
      '.ph-top-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}',
      '.ph-top-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);overflow:hidden}',
      '.ph-top-head{display:flex;align-items:center;gap:9px;padding:12px 15px;border-bottom:1px solid var(--line)}',
      '.ph-top-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}',
      '.ph-top-t{font-weight:800;font-size:13.5px;letter-spacing:-.01em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ph-top-n{font-size:12px;color:var(--muted);flex-shrink:0}',
      '.ph-top-row{display:flex;align-items:center;gap:10px;padding:8px 15px;border-bottom:1px solid var(--line-2)}',
      '.ph-top-row:last-child{border-bottom:none}',
      '.ph-top-rank{font-size:12px;color:var(--muted-2);width:14px;flex-shrink:0;text-align:right}',
      '.ph-top-name{flex:1;min-width:0;font-size:12.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ph-top-val{font-size:12px;font-weight:700;color:var(--ip-ink-2);flex-shrink:0}',
      '.ph-top-q{color:var(--muted);font-weight:500}',
      // 02/10/2026 — quatre onglets : au téléphone ils se rangent deux par deux (sinon 413 px dans 360)
      '@media (max-width:760px){.v2-tabs.ph-v4{display:grid;grid-template-columns:1fr 1fr;width:100%}.v2-tabs.ph-v4 .v2-tab{width:100%}}',
      // onglets Officines / Groupements
      '.ph-vtabs{display:flex;gap:6px;margin:6px 0 18px}',
      '.ph-vtab{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);border-radius:12px;padding:9px 16px;font-family:var(--font);font-size:13.5px;font-weight:700;color:var(--muted);cursor:pointer;box-shadow:var(--sh-1);transition:.16s var(--ease)}',
      '.ph-vtab svg{color:currentColor}',
      '.ph-vtab:hover{color:var(--ip-ink);border-color:var(--line-strong);transform:translateY(-1px)}',
      '.ph-vtab.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:0 3px 9px rgba(0,80,230,.26)}',
      '.ph-vtab.on:hover{color:#fff;transform:translateY(-1px)}',
      /* Onglets de la fiche officine (Vue d\'ensemble / Audit) : segmented control net */
      '.ph-fiche-tabs{position:relative;background:var(--card-2);border:1px solid var(--line);border-radius:14px;padding:4px;gap:4px !important;box-shadow:var(--sh-1) inset}',
      '.ph-fiche-tabs .ph-vtab{border:1px solid transparent;background:transparent;box-shadow:none;border-radius:10px;padding:10px 18px}',
      '.ph-fiche-tabs .ph-vtab:hover{background:var(--card);border-color:var(--line);transform:none}',
      '.ph-fiche-tabs .ph-vtab.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:0 3px 10px rgba(0,80,230,.28);transform:none}',
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
      '.pl-mem-grp{font-size:12px;font-weight:700;color:var(--muted-2);background:var(--card-2);border:1px solid var(--line);border-radius:999px;padding:1px 8px;margin-left:6px;vertical-align:middle}',
      '.pl-rm{flex-shrink:0;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--muted-2);cursor:pointer;display:flex;align-items:center;justify-content:center;margin-left:8px;transition:.15s var(--ease)}',
      '.pl-rm:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 35%,var(--line));background:color-mix(in srgb,var(--c-rose) 8%,#fff)}',
      '.pl-del{color:var(--c-rose) !important}',
      // modale d\'ajout de pharmacies
      '.pl-pick-ov{position:fixed;inset:0;z-index:130;display:flex;align-items:center;justify-content:center;padding:4vh 16px;background:rgba(16,19,28,0.55);}',
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
      '.pl-pick-a{font-size:12px;color:var(--muted);margin-top:1px}',
      '.pl-pick-tag{font-size:12px;font-weight:700;color:var(--muted-2);background:var(--card-2);border:1px solid var(--line);border-radius:999px;padding:2px 8px;flex-shrink:0}',
      '.pl-pick-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-top:1px solid var(--line);background:var(--card-2)}',
      // carte de secteur
      '.sec-mapwrap{position:relative;border-radius:var(--r-card);overflow:hidden;border:1px solid var(--line);box-shadow:var(--sh-1)}',
      '.sec-map{width:100%;height:calc(100vh - 280px);min-height:420px;background:#EAEEF3}',
      '.sec-legend{position:absolute;right:14px;bottom:14px;z-index:500;background:rgba(255,255,255,0.96);border:1px solid var(--line);border-radius:12px;padding:11px 13px;box-shadow:var(--sh-2);font-size:12px}',
      '.sec-legend-t{font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:7px}',
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
      '.prepa-modal{position:fixed;inset:0;z-index:120;background:rgba(16,19,28,0.55);display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;opacity:0;pointer-events:none;transition:opacity .2s var(--ease)}',
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
      '.v2-row-opp{flex-shrink:0;font-size:12px;font-weight:700;color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 12%,transparent);border:1px solid color-mix(in srgb,var(--c-opp) 26%,transparent);border-radius:999px;padding:3px 10px;letter-spacing:-.01em}',
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
      '.phf-code{display:inline-block;font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.04em;background:rgba(255,255,255,.16);color:#fff;padding:4px 9px;border-radius:var(--r-pill);margin-bottom:11px}',
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
      '.phf-fam-title{padding:15px 20px 8px;font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-2)}',
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
      '.phf-ref-h{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-2);margin-bottom:9px}',
      '.phf-ref{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;padding:10px 11px;border-radius:var(--r-sm);border:1.5px solid var(--line);background:var(--card);cursor:pointer;margin-bottom:7px;font:inherit;color:var(--ip-ink);transition:border-color .15s,box-shadow .15s}',
      '.phf-ref:last-child{margin-bottom:0}',
      '.phf-ref.on{border-color:var(--ip-blue);box-shadow:0 0 0 3px rgba(0,80,230,.10)}',
      '.phf-radio{width:16px;height:16px;border-radius:50%;border:2px solid var(--muted-2);flex:none;margin-top:1px;position:relative;transition:border-color .15s}',
      '.phf-ref.on .phf-radio{border-color:var(--ip-blue)}',
      '.phf-ref.on .phf-radio::after{content:"";position:absolute;inset:2px;border-radius:50%;background:var(--ip-blue)}',
      '.phf-ref-t{font-size:13px;font-weight:700;line-height:1.2;display:block}',
      '.phf-ref-s{font-size:12px;color:var(--muted);font-weight:500;margin-top:2px;display:block}',
      '.phf-segref{display:flex;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-btn);padding:4px}',
      '.phf-segref-b{flex:1;padding:9px 8px;border:0;border-radius:9px;background:transparent;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .15s,color .15s}',
      '.phf-segref-b:hover{color:var(--ip-ink)}',
      '.phf-segref-b.on{background:var(--ip-blue);color:#fff;box-shadow:var(--sh-1)}',
      /* Disposition HORIZONTALE (une seule colonne) */
      '.phf-hcard{position:relative;display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);padding:18px 22px;margin-bottom:14px;overflow:hidden}',
      '.phf-hcard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,var(--ip-blue),var(--ip-blue-d))}',
      '.phf-hid{min-width:180px;flex:1}',
      '.phf-hname{font-size:21px;font-weight:800;letter-spacing:-.025em;line-height:1.12;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.phf-htit{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);font-weight:600;margin-top:4px}',
      '.phf-htit span{color:var(--ip-ink)}',
      '.phf-reprise{font-size:12px;font-weight:800;letter-spacing:.01em;color:#8a4b00;background:#FFF1DB;border:1px solid #F0C98A;border-radius:999px;padding:3px 9px;white-space:nowrap}',
      '.phf-nmedit-l{display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:5px}',
      '.phf-nmedit-row{display:flex;gap:8px;align-items:center}',
      '.phf-nmedit-in{flex:1;min-width:0;border:1px solid var(--line-strong);border-radius:10px;padding:9px 11px;font:inherit;font-size:13.5px;color:var(--ip-ink);background:var(--card-2)}',
      '.phf-nmedit-btn{flex:none;border:none;border-radius:10px;padding:9px 16px;font:inherit;font-weight:800;font-size:13px;color:#fff;background:var(--ip-blue);cursor:pointer;min-height:40px}',
      '.phf-nmedit-btn:hover{filter:brightness(1.06)}',
      '.phf-hloc{font-size:12.5px;color:var(--muted);font-weight:500;margin-top:5px;display:flex;align-items:center;gap:5px}',
      '.phf-hkpis{display:flex;gap:10px;flex-wrap:wrap}',
      '.phf-hkpi{position:relative;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);padding:11px 16px 12px;min-width:100px;overflow:hidden;transition:transform .18s var(--ease),box-shadow .18s var(--ease),border-color .18s var(--ease)}',
      '.phf-hkpi::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--line-strong);opacity:0;transition:opacity .18s var(--ease)}',
      '.phf-hkpi:hover{transform:translateY(-2px);box-shadow:var(--sh-2);border-color:var(--line-strong)}',
      '.phf-hkpi:hover::before{opacity:1}',
      '.phf-hkpi-l{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}',
      '.phf-hkpi-v{display:block;font-size:18px;font-weight:800;letter-spacing:-.02em;margin-top:4px;line-height:1}',
      '.phf-hkpi-v.phf-pos{color:var(--c-opp)}',
      '.phf-hkpi-v.phf-push{color:var(--c-amber);font-size:22px}',
      /* KPI "A pousser" — la carte-action prioritaire du commercial : accent ambre affirme */
      '.phf-hkpi:has(.phf-push){background:linear-gradient(155deg,color-mix(in srgb,var(--c-amber) 15%,#fff),color-mix(in srgb,var(--c-amber) 6%,#fff));border-color:color-mix(in srgb,var(--c-amber) 36%,var(--line));box-shadow:0 2px 8px color-mix(in srgb,var(--c-amber) 14%,transparent)}',
      '.phf-hkpi:has(.phf-push)::before{background:var(--c-amber);opacity:1}',
      '.phf-hkpi:has(.phf-push) .phf-hkpi-l{color:var(--c-amber-txt)}',
      '.phf-hkpi:has(.phf-push):hover{box-shadow:0 6px 16px color-mix(in srgb,var(--c-amber) 22%,transparent)}',
      '.phf-hcontacts{display:flex;gap:8px}',
      '.phf-cbtn2{display:inline-flex;align-items:center;gap:6px;min-height:var(--tap-min,44px);box-sizing:border-box;font-size:12.5px;font-weight:700;color:var(--ip-blue);background:var(--card-2);border:1px solid var(--line-strong);border-radius:var(--r-btn);padding:9px 12px;cursor:pointer;text-decoration:none;transition:background .15s,border-color .15s}',
      '.phf-cbtn2:hover{background:#fff;border-color:var(--ip-blue)}',
      // Boutons compacts « Listes à proposer » (en haut de la fiche)
      '.phf-actions{display:flex;align-items:center;flex-wrap:wrap;gap:9px;margin:14px 0 2px}',
      '.phf-actions-l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-right:2px}',
      '.phf-actbtn{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#fff;background:var(--ip-blue);border:1px solid var(--ip-blue);border-radius:var(--r-btn,11px);padding:9px 14px;cursor:pointer;box-shadow:0 2px 8px rgba(0,80,230,.22);transition:transform .15s var(--ease),box-shadow .15s var(--ease)}',
      '.phf-actbtn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,80,230,.28)}',
      '.phf-actbtn b{font-weight:800;background:rgba(255,255,255,.22);padding:1px 7px;border-radius:999px;font-size:12px}',
      '.phf-actbtn-grp{background:var(--c-opp);border-color:var(--c-opp);box-shadow:0 2px 8px rgba(18,161,80,.22)}',
      '.phf-actbtn-grp:hover{box-shadow:0 6px 16px rgba(18,161,80,.28)}',
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
      /* Métamorphose « Launcher » : rythme aéré dans la fiche officine. */
      '#phft-c-apercu>.v2-section-head{margin-top:var(--section-gap,28px)}',
      '#phft-c-apercu>.v2-section-head:first-child{margin-top:6px}',
      '#phft-c-apercu>.ph-section{margin-top:var(--section-gap,28px)}',
      '#phft-c-apercu>.ph-section:first-child{margin-top:6px}',
      '#phft-c-apercu>.ph-stats{margin-top:var(--section-gap,28px)}',
      '#phft-c-apercu .phf-props{margin-top:12px}',
      '@media(max-width:640px){.phf-bar2r{margin-left:0;width:100%}.phf-bar2 .phf-pdf{flex:1;justify-content:center}}',
      '.phf-panel{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);overflow:hidden;min-width:0}',
      '.phf-phead{padding:18px 22px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}',
      '.phf-ptitle{font-size:18px;font-weight:800;letter-spacing:-.01em;display:flex;align-items:center;gap:10px}',
      '.phf-pdot{width:11px;height:11px;border-radius:50%;flex:none}',
      /* ══ Fiche d'analyse : Cockpit (≥ 901 px) / Terrain (téléphone) ══ */
      '.pha{display:grid;grid-template-columns:330px minmax(0,1fr);gap:18px;align-items:start}',
      '.pha-rail,.pha-main{display:flex;flex-direction:column;gap:14px;min-width:0}',
      '.pha-card{padding:16px 18px}',
      '.pha-ch{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
      '.pha-ch h3{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em}',
      '.pha-sub{font-size:12px;color:var(--muted);font-weight:500}',
      '.pha-up{color:var(--c-mint-txt)}.pha-dn{color:var(--c-rose-txt)}.pha-flat{color:var(--muted)}',
      '.pha-id{border-radius:var(--r-card);padding:22px 22px 20px;color:#fff;position:relative;overflow:hidden;background:linear-gradient(160deg,#173FA8 0%,#0B1F4D 55%,#08163A 100%);box-shadow:0 18px 40px rgba(11,31,77,.30),inset 0 1px 0 rgba(255,255,255,.18)}',
      // 23/09/2026 — le lien SIREN prenait le bleu par défaut du navigateur, illisible
      // sur la carte bleu nuit : il reprend la couleur du texte de la carte, souligné.
      '.pha-id a{color:inherit;text-decoration:underline}',
      '.pha-id::before{content:"";position:absolute;width:420px;height:420px;border-radius:50%;left:-120px;top:-260px;background:radial-gradient(closest-side,rgba(120,170,255,.55),rgba(120,170,255,0))}',
      '.pha-id>*{position:relative}',
      '.pha-code{font-size:12px;opacity:.75;font-weight:700;letter-spacing:.04em}',
      '.pha-name{font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.1;margin:6px 0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.pha-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px}',
      '.pha-kv span:nth-child(odd){color:rgba(255,255,255,.62);font-weight:600}',
      '.pha-kv span:nth-child(even){font-weight:700;text-align:right;overflow-wrap:anywhere}',
      '.pha-kv .pha-empty{color:rgba(255,255,255,.45);font-weight:500}',
      // Estimation « probable » (jamais une donnée connue) : italique, teinte ambre
      // distincte du blanc plein des vraies valeurs, lisible sur la carte bleu nuit.
      '.pha-kv .pha-probable{font-style:italic;font-weight:600;color:rgba(255,196,110,.92)}',
      '.pha-kv .pha-grpinfo{text-align:left;font-weight:500;font-size:12px;color:rgba(255,255,255,.75);line-height:1.4;overflow-wrap:anywhere}',
      '.pha-kv .pha-grpinfo a{color:#fff;text-decoration:underline}',
      // Description du groupement ramenée à 2 lignes (texte complet au survol) : elle prenait un demi-écran sur téléphone.
      '.pha-kv .pha-cessee{color:#FFB3B3;font-weight:700}',
      '.pha-kv .pha-retraite{color:#FFD39A;font-weight:700}',
      '.pha-kv .pha-retraite a{color:inherit;text-decoration:underline}',
      '.pha-kv .pha-grpdesc{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}',
      '.pha-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}',
      '.pha-btn{display:inline-flex;align-items:center;gap:7px;min-height:var(--tap-min,44px);padding:0 14px;border-radius:var(--r-btn,12px);border:1px solid var(--line-strong);background:var(--card);font:inherit;font-weight:700;font-size:13px;color:var(--ip-ink);cursor:pointer;text-decoration:none;white-space:nowrap}',
      '.pha-id .pha-btn{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.22);color:#fff}',
      '.pha-id .pha-btn-pri{background:#fff;color:var(--ip-blue-d);border-color:#fff;box-shadow:0 6px 16px rgba(0,0,0,.25)}',
      '.pha-btn-w{width:100%;justify-content:space-between;margin-top:8px}',
      '.pha-btn-w b{background:rgba(16,19,28,.08);padding:1px 8px;border-radius:999px;font-size:12px}',
      '.pha-btn-opp{background:var(--c-opp);border-color:var(--c-opp);color:#fff;justify-content:center}',
      '.pha-btn-grp b{background:color-mix(in srgb,var(--c-opp) 18%,transparent);color:var(--c-mint-txt)}',
      '.pha-lists .pha-kl{margin-bottom:2px}',
      '.pha-btn-tx{justify-content:center;background:var(--ip-ink);border-color:var(--ip-ink);color:#fff}',
      '.pha-btn-lgo{justify-content:center}',
      '.tx-dialog{width:min(620px,96vw)}',
      '.tx-body{flex:1;min-height:0;overflow-y:auto;padding:14px 18px 6px;-webkit-overflow-scrolling:touch}',
      '.tx-to{font-size:13px;color:var(--muted);margin-bottom:12px;overflow-wrap:anywhere}',
      '.tx-to b{color:var(--ip-ink)}',
      '.tx-err{color:#C7283D}',
      '.tx-g{margin-bottom:16px}',
      '.tx-gh{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px}',
      '.tx-gs{font-size:12px;color:var(--muted)}',
      '.tx-row{display:flex;align-items:center;gap:12px;min-height:48px;padding:6px 10px;border:1px solid var(--line);border-radius:12px;margin-bottom:6px;cursor:pointer;background:var(--card);transition:border-color .16s var(--ease)}',
      '.tx-row:has(input:checked){border-color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 6%,var(--card))}',
      '.tx-row input{width:20px;height:20px;margin:0;flex-shrink:0;accent-color:var(--ip-blue)}',
      '.tx-ic{flex-shrink:0;width:38px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font:800 10px var(--mono,ui-monospace,monospace);letter-spacing:.04em;color:#fff;background:#C7283D}',
      '.tx-ic-x{background:#1E7A45}',
      '.tx-ic-g{background:var(--ip-blue)}',
      '.tx-lgo{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px}',
      '.tx-lgo-s{min-height:44px;border:1px solid var(--line-strong);border-radius:10px;padding:8px 11px;font:inherit;font-size:16px;color:var(--ip-ink);background:var(--card-2);cursor:pointer}',
      '.tx-lgo .tx-lgo-n{width:auto}',
      '.tx-lgo-pas{font-size:13px;font-weight:700;color:var(--info,#0050E6);cursor:pointer;min-height:44px;display:inline-flex;align-items:center;text-decoration:underline;text-underline-offset:3px}',
      '.tx-hint{display:block;margin-top:3px;font-size:13px;font-weight:600;color:var(--ip-ink)}',
      '.tx-lgo .v2-seg{padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer}',
      '.tx-lgo .v2-seg[disabled],.tx-lgo-s[disabled]{opacity:.45;pointer-events:none}',
      '.tx-l{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}',
      '.tx-l b{font-size:13.5px;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.tx-l small{font-size:12px;color:var(--muted)}',
      '.tx-empty{font-size:12.5px;color:var(--muted);padding:6px 2px 10px}',
      '.tx-style{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:6px 0 4px}',
      '.tx-style-b{display:flex;flex-wrap:wrap;gap:6px;width:100%}',
      '.tx-style .v2-seg{padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer}',
      '.tx-style .v2-seg[disabled]{opacity:.45;pointer-events:none}',
      '.tx-upl{min-height:44px;gap:7px}',
      '.tx-upl.is-busy{opacity:.6;pointer-events:none}',
      '.tx-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--line);background:var(--card)}',
      '.tx-state{flex:1;min-width:160px;font-size:13px;color:var(--muted)}',
      '.tx-state b{color:var(--ip-ink)}',
      '.tx-warn{display:block;color:var(--c-amber);font-size:12px;margin-top:2px}',
      '.tx-foot .v2-btn[disabled]{opacity:.45;pointer-events:none}',
      '.pha-cip{font-size:12.5px;color:var(--muted);margin:0 0 12px;padding:8px 12px;background:var(--card-2);border-radius:10px}',
      '.pha-cip b{color:var(--ip-ink)}',
      '.pha-infos .v2-profil-box{box-shadow:none;border:none;padding:12px 0 0;margin-top:6px;overflow:visible}',
      '.pha-wrap{max-width:1280px}',
      '.pha-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}',
      '.pha-kpi{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-1);padding:14px 16px;position:relative;overflow:hidden;min-width:0}',
      '.pha-kpi::after{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--a,var(--ip-blue))}',
      '.pha-kl{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:800}',
      '.pha-kval{font-size:24px;font-weight:800;letter-spacing:-.03em;margin-top:5px;line-height:1.1;color:var(--ip-ink)}',
      '.pha-kval small{font-size:13px;color:var(--muted);font-weight:700}',
      '.pha-kd{font-size:12px;font-weight:700;margin-top:3px}',
      '.pha-chart{width:100%;height:auto;display:block}',
      '.pha-legend{display:flex;gap:16px;font-size:12px;font-weight:700;color:var(--muted);margin-top:6px;flex-wrap:wrap}',
      '.pha-legend i{display:inline-block;width:18px;height:3px;border-radius:2px;vertical-align:middle;margin-right:6px}',
      '.pha-table{font-size:12.5px}.pha-table td,.pha-table th{white-space:nowrap;padding:8px 8px}',
      '.pha-table td:first-child{white-space:normal;min-width:150px}.pha-table td:first-child .pha-sub{display:block;padding-left:17px}',
      '.pha-table .ph-tr-dot{margin-right:8px}',
      '.pha-absent td{color:var(--muted)}',
      '.pha-bar{height:6px;border-radius:999px;background:var(--surf-sunken,#F4F6FB);overflow:hidden;margin-top:4px;width:64px;margin-left:auto}',
      '.pha-bar i{display:block;height:100%;border-radius:999px}',
      '.pha-parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:12px}',
      '.pha-parts-head{align-items:flex-start}',
      '.pha-part-seg{display:inline-flex;background:var(--surf-sunken,#F4F6FB);border:1px solid var(--line);border-radius:10px;padding:2px;gap:2px;flex:none}',
      '.pha-part-btn{border:0;background:transparent;border-radius:8px;padding:6px 11px;font:inherit;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;min-height:32px;white-space:nowrap}',
      '.pha-part-btn.on{background:var(--card);color:var(--ip-ink);box-shadow:0 1px 3px rgba(16,19,28,.12)}',
      '.pha-part{border:1px solid var(--line);border-radius:12px;background:var(--card-2);padding:10px 12px 8px;min-width:0}',
      '.pha-part-bio{border-color:color-mix(in srgb,#6D4FC4 45%,var(--line));background:color-mix(in srgb,#6D4FC4 5%,var(--card-2))}',
      '.pha-part-hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
      '.pha-part-t{font-size:12.5px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pha-part-t .ph-tr-dot{margin-right:7px}',
      '.pha-part-v{font-size:18px;font-weight:800;letter-spacing:-.02em;white-space:nowrap}',
      '.pha-part-v small{font-size:12px;color:var(--muted);font-weight:700}',
      '.pha-part-sub{font-size:12px;font-weight:700;margin:1px 0 6px}',
      '.pha-part-ch{width:100%;height:auto;display:block}',
      '.pha-net-dash{display:inline-block;width:16px;height:0;border-top:2px dashed #7A8299;vertical-align:middle}',
      '.pha-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
      '.pha-tab{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line-strong);background:var(--card);border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;min-height:36px;color:var(--ip-ink)}',
      '.pha-tab.on{background:var(--ip-ink);color:#fff;border-color:var(--ip-ink)}',
      '.pha-r{display:grid;grid-template-columns:20px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--line);font-size:13.5px}',
      '.pha-r i{font-style:normal;font-family:var(--mono);font-weight:800;color:var(--muted)}',
      '.pha-r b{white-space:nowrap}.pha-r b small{color:var(--muted);font-weight:600}',
      '.pha-np .pha-r>span{min-width:0}.pha-np .pha-r b small{font-size:12px}',
      '.pha-np-s{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:3px;font-size:12px;color:var(--muted)}',
      '.pha-np-m{display:inline-flex;gap:3px;vertical-align:middle}',
      '.pha-np-d{width:9px;height:9px;border-radius:2px;background:var(--line-strong)}',
      '.pha-np-d.on{background:var(--ip-blue,#0050E6)}',
      '.pha-np-d.fin{background:transparent;box-shadow:inset 0 0 0 1.5px #C7283D}',
      '.pha-np-plus summary{cursor:pointer;font-size:12.5px;font-weight:700;padding:10px 0;border-top:1px solid var(--line)}',
      '.pha-r1{grid-template-columns:1fr auto}',
      '.pha-det{border-top:1px solid var(--line)}',
      '.pha-det summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;min-height:46px;font-weight:800;font-size:13.5px;gap:8px}',
      '.pha-det summary::-webkit-details-marker{display:none}',
      '.pha-det summary .ph-tr-dot{margin-right:8px}',
      '.pha-det[open] summary svg{transform:rotate(180deg)}',
      '.pha-det .pha-bar{width:100%;margin-left:0}',
      '.pha-mob{display:none}',
      '.pha-notes .v2-notes-box{margin:0}',
      // ⚠️ `display:contents` fait des cartes du rail les enfants directs du flex,
      // et `align-items:start` (hérité de la grille du bureau) les dimensionne sur
      // leur contenu au lieu de la largeur disponible. La zone de dictée (champ +
      // micro + bouton « Ajouter ») réclame 390 px : sur un iPhone, TOUTE la page
      // partait 14 px hors de l'écran et le bouton « Ajouter » était coupé.
      // `align-self:stretch` les recale sur la colonne, `min-width:0` les laisse
      // se réduire. Mesuré à 360 / 390 / 430 px.
      '@media(max-width:900px){.pha{display:flex;flex-direction:column;gap:12px}.pha-rail,.pha-main{display:contents}',
      '  .pha-rail>*,.pha-main>*{min-width:0;align-self:stretch}',
      '  .pha-id{order:-3}.pha-lists{order:-2}.pha-notes{order:-1}',
      '  .pha-desk{display:none}.pha-mob{display:block}.pha-kpis{grid-template-columns:1fr 1fr}.pha-kval{font-size:20px}.pha-lists{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.pha-lists .pha-kl{width:100%}.pha-lists .pha-btn-w{width:auto;margin-top:0;flex:1 1 auto}}',
      /* ══ Fiche « menu » (maquette 8, 09/10/2026) — préfixe l8- ══ */
      '.pha.l8{grid-template-columns:340px minmax(0,1fr);gap:56px;padding-top:4px}',
      '.l8-rail{position:sticky;top:16px;gap:12px;align-self:start}',
      '.l8-main{max-width:980px;min-height:560px}',
      '.pha.l8[data-ong="infos"] .l8-main{max-width:1040px}',
      '.l8-id{position:relative;border-radius:24px;padding:24px 24px 20px;color:#fff;background:radial-gradient(110% 80% at 10% -6%,#2A6AF0 0%,rgba(42,106,240,0) 62%),radial-gradient(90% 70% at 105% 108%,#002A86 0%,rgba(0,42,134,0) 66%),#0050E6;box-shadow:var(--sh-blue)}',
      '.l8-nom{margin:0;font-size:28px;font-weight:800;letter-spacing:-.025em;line-height:1.1;color:#fff;overflow-wrap:anywhere}',
      '.l8-sous{margin:6px 0 0;font-size:15px;font-weight:600;color:#fff}',
      '.l8-acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:22px}',
      '.l8-acts-2{margin-top:14px}',
      '.l8-act{display:flex;flex-direction:column;align-items:center;gap:6px;padding:0;border:0;background:transparent;color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer;min-height:var(--tap-min,44px);text-decoration:none;-webkit-tap-highlight-color:transparent}',
      '.l8-act:hover{color:#fff}',
      '.l8-rond{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:#1B58D6;box-shadow:0 1px 0 rgba(255,255,255,.28) inset,0 0 0 1px rgba(255,255,255,.18) inset;transition:transform .18s var(--ease),background .18s}',
      '.l8-act:hover .l8-rond{transform:translateY(-2px);background:#2A66E8}',
      '.l8-act:active .l8-rond{transform:scale(.94)}',
      '.l8-acts:not(.l8-acts-2) .l8-act:first-child .l8-rond{background:#fff;color:var(--ip-blue);box-shadow:0 4px 12px rgba(0,30,110,.35)}',
      '.l8-ongs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;background:var(--surf-sunken);border:1px solid var(--line);border-radius:14px}',
      '.l8-ong{min-height:var(--tap-min,44px);padding:0 12px;border:0;border-radius:10px;background:transparent;color:var(--ip-ink-2);font:inherit;font-size:16px;font-weight:800;letter-spacing:-.01em;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.l8-ong:hover{color:var(--ip-ink)}',
      '.l8-ong[aria-selected="true"]{background:var(--ip-blue);color:#fff;box-shadow:0 2px 8px rgba(0,60,180,.28)}',
      '.l8-ong:focus-visible{outline:3px solid color-mix(in srgb,var(--ip-blue) 40%,transparent);outline-offset:2px}',
      '.pha.l8[data-ong="infos"] .l8-menu{display:none}',
      '.l8-pan[hidden]{display:none}',
      '.l8-st-tete{margin-bottom:28px}.l8-st-tete .l8-tete-d{justify-content:flex-start}.l8-st-tete .l8-aide-txt{margin:4px 0 0}',
      '.l8-rub{scroll-margin-top:24px}',
      '.l8-rub+.l8-rub{margin-top:52px;padding-top:40px;border-top:1px solid var(--line-strong)}',
      '.l8-lg-b{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:6px 0;border:0;background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer}',
      '.l8-lg-b:hover .l8-ln{color:var(--ip-blue)}',
      '.l8-lg-b .l8-cc{display:flex;color:#7C859B;transition:transform .25s var(--ease)}',
      '.l8-lg-b[aria-expanded="true"] .l8-cc{transform:rotate(90deg);color:var(--ip-blue)}',
      '#l8-tout-corps[hidden]{display:none}',
      '.l8-icols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 56px;align-items:start}',
      '.l8-icol{min-width:0}',
      '.l8-gt{margin:0 0 4px;font-size:17px;font-weight:800;letter-spacing:-.02em}',
      '.l8-gt-suite{margin-top:40px;margin-bottom:12px}',
      '.l8-menu{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);padding:4px;display:flex;flex-direction:column}',
      '.l8-row{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:0 10px;border:0;background:transparent;border-radius:12px;color:var(--ip-ink);font:inherit;font-size:16px;font-weight:700;letter-spacing:-.01em;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .2s var(--ease)}',
      '.l8-row+.l8-row::before{content:"";position:absolute;left:54px;right:10px;top:0;height:1px;background:var(--line)}',
      '.l8-row:hover{background:var(--surf-sunken)}',
      '.l8-tuile{width:32px;height:32px;flex:none;border-radius:9px;display:grid;place-items:center;background:var(--halo);color:var(--ip-blue);transition:background .2s var(--ease),color .2s var(--ease),transform .25s var(--ease)}',
      '.l8-mot{flex:1;min-width:0}',
      '.l8-cpt{font-family:var(--mono);font-size:14px;font-weight:600;color:var(--muted);white-space:nowrap;word-spacing:-.3em}',
      '.l8-cpt b{color:var(--ip-blue);font-weight:700}',
      '.l8-chev{flex:none;color:#7C859B;display:flex}',
      '@media(min-width:901px){.l8-row[aria-current="page"]{background:var(--halo)}.l8-row[aria-current="page"] .l8-tuile{background:var(--ip-blue);color:#fff;transform:scale(1.06)}.l8-row[aria-current="page"]+.l8-row::before,.l8-row[aria-current="page"]::before{display:none}.l8-row[aria-current="page"] .l8-chev{color:var(--ip-blue)}}',
      '.l8-pied{display:flex;flex-wrap:wrap;gap:0 18px}',
      '.l8-lien{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap-min,44px);padding:0;border:0;background:transparent;color:var(--ip-blue);font:inherit;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:-.01em}',
      '.l8-lien:hover{color:var(--ip-blue-d)}',
      '.l8-lien.gris{color:var(--ip-ink-2)}',
      '.l8-vpbar,.l8-vpid{display:none}',
      '.l8-tete{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 16px;margin-bottom:20px;min-height:48px}',
      '.l8-t{margin:0;font-size:22px;font-weight:800;letter-spacing:-.025em;line-height:1.15}',
      '.l8-tete-d{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.l8-fl{font-size:14px;font-weight:700;color:var(--muted)}',
      '.l8-ref{font-size:14px;font-weight:800}',
      '.l8-dr,.l8-cnt{font-size:14px;font-weight:600;color:var(--muted)}',
      '.l8-cnt{font-family:var(--mono);font-size:22px;font-weight:800}',
      '.l8-seg{display:inline-flex;background:var(--surf-sunken);border:1px solid var(--line);border-radius:12px;padding:3px;gap:2px;max-width:100%}',
      '.l8-seg-b{border:0;background:transparent;border-radius:9px;padding:0 14px;min-height:var(--tap-min,44px);font:inherit;font-size:14px;font-weight:700;color:var(--muted);cursor:pointer;min-width:0}',
      '.l8-seg-b[aria-pressed="true"]{background:var(--card);color:var(--ip-ink);box-shadow:0 1px 3px rgba(16,19,28,.12)}',
      '.l8-aide{width:var(--tap-min,44px);height:var(--tap-min,44px);border:0;background:transparent;padding:0;display:inline-grid;place-items:center;cursor:pointer;color:var(--muted)}',
      '.l8-aide span{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--muted);display:grid;place-items:center;font-weight:800;font-size:14px;line-height:1}',
      '.l8-aide:hover span{color:var(--ip-blue);border-color:var(--ip-blue)}',
      '.l8-aide-txt{margin:-8px 0 16px;padding:10px 12px;border-radius:var(--r-md);background:var(--card-2);font-size:14px;line-height:1.45;font-weight:600;color:var(--ip-ink)}',
      '.l8-aide-txt[hidden]{display:none}',
      '.l8-vide{margin:10px 0;color:var(--muted);font-weight:600;font-size:15px}',
      '.l8-grand{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 20px}',
      '.l8-n{font-family:var(--mono);font-weight:800;font-size:clamp(56px,8vw,96px);letter-spacing:-.05em;line-height:1;word-spacing:-.32em;color:var(--ip-ink)}',
      '.l8-n small{font-size:.38em;font-weight:700;letter-spacing:0;color:var(--muted);word-spacing:normal}',
      '.l8-u{font-size:17px;font-weight:700;color:var(--muted)}',
      '.l8-puce{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:17px;font-weight:700;padding:5px 12px 5px 9px;border-radius:999px;word-spacing:-.3em;background:var(--surf-sunken)}',
      '.l8-puce.pha-up{background:color-mix(in srgb,var(--c-mint) 13%,#fff)}.l8-puce.pha-dn{background:color-mix(in srgb,var(--c-rose) 13%,#fff)}',
      '.l8-graph{margin:24px 0 8px}',
      '.l8-reps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px;margin-top:24px}',
      '.l8-rep{border-top:1px solid var(--line-strong);padding-top:12px}',
      '.l8-rl{font-size:14px;font-weight:700;color:var(--muted)}',
      '.l8-rv{margin-top:4px;font-family:var(--mono);font-size:26px;font-weight:800;letter-spacing:-.03em;word-spacing:-.3em;line-height:1.15}',
      '.l8-rv-mots{font-family:var(--font);font-size:21px;letter-spacing:-.02em;word-spacing:normal;line-height:1.2}',
      '.l8-rt{margin-top:2px;font-size:14px;font-weight:700}',
      '.l8-rt .mono{word-spacing:-.3em}',
      '.l8-ctete{font-size:14px;font-weight:700;color:var(--muted);margin-bottom:4px}',
      '.l8-ctete-d{text-align:right}',
      '.l8-lg{display:flex;align-items:center;gap:12px;min-height:52px;padding:6px 0;border-top:1px solid var(--line)}',
      '.l8-lg:last-child{border-bottom:1px solid var(--line)}',
      '.l8-ln{flex:1;min-width:0;font-size:16px;font-weight:700;letter-spacing:-.01em}',
      '.l8-ln small{display:block;font-size:13px;font-weight:600;color:var(--muted);letter-spacing:0}',
      '.l8-lm{font-family:var(--mono);font-size:15px;font-weight:700;white-space:nowrap;word-spacing:-.3em;min-width:48px;text-align:right}',
      '.l8-lm-l{min-width:76px}',
      '.l8-lg-g{font-size:14px;font-weight:600;color:var(--muted);white-space:nowrap}',
      '.l8-pbar{width:128px;height:6px;border-radius:3px;background:var(--surf-sunken);position:relative;flex:none}',
      '.l8-pbar i{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:3px;background:linear-gradient(90deg,#2A6AF0,#0050E6);transform-origin:0 50%;transform:scaleX(var(--w,1))}',
      '.l8-plus{margin-top:4px}',
      '.l8-sst{margin:28px 0 8px;display:flex;align-items:baseline;justify-content:space-between;gap:12px}',
      '.l8-sst h3{margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em}',
      '.l8-sst span{font-size:14px;font-weight:600;color:var(--muted)}',
      '.l8-fp{font-family:var(--font);word-spacing:normal}',
      '.l8-dp.l8-dp3{display:grid;grid-template-columns:minmax(0,1fr) 84px 80px;align-items:baseline;gap:0 12px}.l8-dp3 .l8-dpn{font-size:14px;font-weight:700;color:var(--ip-ink);text-align:left}.l8-dp3 .mono{text-align:right;white-space:nowrap;word-spacing:-.3em;font-size:14px}.l8-dp3 .l8-dpq{text-align:right;white-space:nowrap}',
      '.l8-bouge{display:flex;align-items:center;gap:12px;min-height:52px;border-top:1px solid var(--line)}',
      '.l8-bouge:last-child{border-bottom:1px solid var(--line)}',
      '.l8-f{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;flex:none}',
      '.l8-f.h{background:var(--c-mint-txt)}.l8-f.b{background:var(--c-rose-txt)}',
      '.l8-bn{flex:1;font-weight:700}',
      '.l8-bv{font-family:var(--mono);font-weight:700;word-spacing:-.3em}',
      '.l8-cat{border-top:1px solid var(--line)}',
      '.l8-cat:last-of-type{border-bottom:1px solid var(--line)}',
      '.l8-crow{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto 20px;align-items:center;gap:0 14px;min-height:56px;padding:6px 0;border:0;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer}',
      '.l8-crow:hover .l8-cn{color:var(--ip-blue)}',
      '.l8-cn{font-size:16px;font-weight:700;letter-spacing:-.01em}',
      '.l8-cinf{display:grid;grid-template-columns:96px 236px 108px;align-items:center;gap:0 18px}',
      '.l8-cm{font-family:var(--mono);font-size:15px;font-weight:700;text-align:right;word-spacing:-.3em}',
      '.l8-ce{display:flex;justify-content:flex-start;font-family:var(--mono);font-size:14px;font-weight:700;word-spacing:-.3em}',
      '.l8-cabs{font-size:14px;font-weight:700;color:var(--muted)}',
      '.l8-cc{display:flex;justify-content:flex-end;color:#7C859B;transition:transform .25s var(--ease)}',
      '.l8-crow[aria-expanded="true"] .l8-cc{transform:rotate(90deg);color:var(--ip-blue)}',
      '.l8-detail{padding:4px 0 24px;display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:8px 40px}',
      '.l8-detail[hidden]{display:none}',
      '.l8-detail>div{min-width:0}',
      '.l8-detail h4{margin:14px 0 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}',
      '.l8-detail p{margin:0;font-size:14px;font-weight:600;line-height:1.4;color:var(--ip-ink-2)}.l8-detail p b{font-weight:800}',
      '.l8-detail .large{grid-column:1/-1}',
      '.l8-dp{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 12px;padding:8px 0;border-top:1px solid var(--line);font-size:14px;font-weight:700}',
      '.l8-cp{display:block;text-align:left;font-style:normal;text-wrap:balance}',
      '.l8-dp span{font-size:13px;color:var(--muted);font-weight:600;text-align:right}.l8-dp span .mono{color:var(--ip-ink);font-weight:800}',
      '.l8-np{display:block;padding:8px 0;border-top:1px solid var(--line)}.l8-np b{display:block;font-size:14px;font-weight:800}.l8-np span{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-top:2px}',
      '.l8-piste-p{height:10px;margin-top:6px;border-radius:999px;background:var(--surf-sunken);overflow:hidden}.l8-piste-p i{display:block;height:100%;background:var(--ip-blue);border-radius:999px}',
      '.l8-2l{display:grid;grid-template-columns:minmax(0,1fr);gap:36px}',
      '.l8-liste{min-width:0;position:relative}',
      '.l8-lnom{margin:0 0 10px;font-size:17px;font-weight:800;letter-spacing:-.01em;overflow-wrap:anywhere}',
      '@media(min-width:900px){.l8-2l-deux{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 40px}.l8-2l-deux .l8-liste+.l8-liste::before{content:"";position:absolute;left:-20px;top:0;bottom:0;width:1px;background:var(--line)}.l8-2l-deux .l8-pn{font-size:clamp(44px,4.4vw,56px)}.l8-2l-deux .l8-pacts{flex-basis:100%}}',
      '.l8-pcompte{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:16px 24px;margin-bottom:8px}',
      '.l8-pn{font-family:var(--mono);font-weight:800;font-size:clamp(52px,7vw,80px);letter-spacing:-.05em;line-height:1;word-spacing:-.3em;color:var(--ip-blue)}',
      '.l8-pn small{font-family:var(--font);font-size:17px;font-weight:700;letter-spacing:0;color:var(--muted);margin-left:10px;word-spacing:normal}',
      '.l8-pacts{display:flex;gap:8px;flex-wrap:wrap}',
      '.l8-btn{display:inline-flex;align-items:center;gap:8px;min-height:var(--tap-min,44px);padding:0 16px;border-radius:var(--r-btn);border:1px solid var(--line-strong);background:var(--card);color:var(--ip-ink);font:inherit;font-size:14px;font-weight:700;cursor:pointer;box-shadow:var(--sh-1)}',
      '.l8-btn:hover{border-color:var(--ip-blue)}',
      '.l8-btn-pri{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}',
      '.l8-btn-pri:hover{background:var(--ip-blue-d)}',
      '.l8-fl-l{margin:0}',
      '.l8-fr{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:52px;padding:6px 0;border-top:1px solid var(--line)}',
      'dl.l8-fl-l:last-of-type .l8-fr:last-child{border-bottom:1px solid var(--line)}',
      '.l8-fr dt{font-size:14px;font-weight:600;color:var(--muted);flex:none}',
      '.l8-fr dd{margin:0;font-size:16px;font-weight:700;text-align:right;min-width:0;overflow-wrap:anywhere}',
      '.l8-fr dd a{color:var(--ip-blue);text-decoration:none;display:inline-flex;align-items:center;min-height:var(--tap-min,44px)}',
      '.l8-fr dd.pha-empty{color:var(--muted);font-weight:500}',
      '.l8-fr dd.pha-probable{font-style:italic}',
      '.l8-fr dd.pha-cessee{color:var(--c-rose-txt)}.l8-fr dd.pha-retraite{color:#8A4B00}',
      '.l8-fnote{margin:0;padding:8px 0;font-size:14px;font-weight:600;color:var(--muted);border-top:1px solid var(--line)}',
      '.l8-fnote a{color:var(--ip-blue)}',
      '.l8-forms{display:none}',
      '#l8-p-infos[data-edit="1"] .l8-forms{display:block;margin-bottom:28px}',
      '#l8-p-infos[data-edit="1"] .l8-lect{display:none}',
      '.l8-notes .v2-notes-box,.l8-notes .v2-rp-box{background:transparent;border:0;box-shadow:none;border-radius:0;padding:0;margin:0 0 28px}',
      '.l8-notes .v2-note{background:transparent;border:0;border-top:1px solid var(--line);border-radius:0;padding:12px 0}',
      '.l8-notes .v2-notes-list{max-height:none}',
      '.l8-notes .v2-notes-hd{font-size:17px;font-weight:800;color:var(--ip-ink)}',
      '.l8-rattr{margin:0}',
      /* vue « À montrer au pharmacien » : les éléments internes disparaissent, une liste blanche reste */
      '.pha-wrap[data-vue="pharmacien"] .l8-interne{display:none!important}',
      '.pha-wrap[data-vue="pharmacien"] .ph-fiche-line{display:none}',
      '.pha-wrap[data-vue="pharmacien"] .l8-vpbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px;font-size:14px;font-weight:700;color:var(--muted)}',
      '.pha-wrap[data-vue="pharmacien"] .l8-vpid{display:block;margin-bottom:20px}',
      '.l8-vpid p{margin:2px 0 0;font-size:15px;font-weight:600;color:var(--ip-ink-2)}',
      'body.l8-vp .v2-top{display:none}',
      /* ══ La courbe qu'on parcourt (maquette 10a, 10/10/2026) : le dessin des chiffres. Arrivée en @keyframes pilotée par l'horloge L1.vu (--l8t = retard négatif) ══ */
      '#l8-v-resume{background:radial-gradient(ellipse 48% 150px at 22% 130px,rgba(0,80,230,.07),rgba(0,80,230,0)) no-repeat}',
      '.l8-rep:empty{display:none}',
      '.l8-graph{margin:18px 0 4px}',
      '.l8-tr{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:crosshair}',
      '.l8-tr:focus{outline:none}',
      '.l8-tr:focus-visible{outline:3px solid color-mix(in srgb,var(--ip-blue) 55%,transparent);outline-offset:6px;border-radius:12px}',
      '.l8-tr text{font-family:var(--font);font-size:13px;font-weight:600;fill:#646B80}',
      '.l8-tr .l8-refnom{font-weight:800;fill:#4A5266}',
      '.l8-tr .l8-mo.on{fill:var(--ip-ink);font-weight:800}',
      '.l8-tr .l8-curs{opacity:0;transition:opacity .18s;pointer-events:none}',
      '.l8-tr .l8-curs.on{opacity:1}',
      '.l8-tr .l8-curs .l8-rule,.l8-tr .l8-curs .l8-p1,.l8-tr .l8-curs .l8-p2{transition:transform .16s var(--ease)}',
      '.l8-tr .l8-curs.nt .l8-rule,.l8-tr .l8-curs.nt .l8-p1,.l8-tr .l8-curs.nt .l8-p2{transition:none}',
      '.l8-ligne,.l8-halo,.l8-marche,.l8-m1{stroke-dasharray:1 2;stroke-dashoffset:0}',
      '.l8-aire{transform-box:fill-box;transform-origin:50% 100%}',
      '.l8-fin .l8-dot,.l8-fin .l8-puls,.l8-m2,.l8-fdot{transform-box:fill-box;transform-origin:center}',
      '.l8-puls{opacity:0}',
      '.l8-av .l8-ligne,.l8-av .l8-halo,.l8-av .l8-marche,.l8-av .l8-m1{stroke-dashoffset:1}',
      '.l8-av .l8-aire{transform:scaleY(0)}',
      '.l8-av .l8-ref{opacity:0}',
      '.l8-av .l8-fin .l8-dot,.l8-av .l8-m2,.l8-av .l8-fdot{transform:scale(0)}',
      '.l8-lit .l8-ligne,.l8-lit .l8-halo{animation:l8-trace .8s var(--ease) backwards;animation-delay:var(--l8t,0ms)}',
      '.l8-lit .l8-aire{animation:l8-aire .78s var(--ease) backwards;animation-delay:calc(100ms + var(--l8t,0ms))}',
      '.l8-lit .l8-ref{animation:l8-fondu .6s ease backwards;animation-delay:calc(200ms + var(--l8t,0ms))}',
      '.l8-lit .l8-fin .l8-dot{animation:l8-pop .38s cubic-bezier(.22,1,.36,1) backwards;animation-delay:calc(520ms + var(--l8t,0ms))}',
      '.l8-lit .l8-fin .l8-puls{animation:l8-bat .7s var(--ease) backwards;animation-delay:calc(700ms + var(--l8t,0ms))}',
      '@keyframes l8-trace{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}',
      '@keyframes l8-aire{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
      '@keyframes l8-fondu{from{opacity:0}to{opacity:1}}',
      '@keyframes l8-pop{from{transform:scale(0)}to{transform:scale(1)}}',
      '@keyframes l8-bat{0%{transform:scale(1);opacity:0}15%{opacity:.4}100%{transform:scale(3.2);opacity:0}}',
      /* Commandes : colonnes, le repère en escalier */
      '.l8-lu{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0 12px;min-height:36px}',
      '.l8-lv{color:var(--ip-ink);font-size:15px;font-weight:700;display:inline-flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;gap:0 8px;min-width:0}',
      '.l8-lv b,.l8-lu2 b{font-family:var(--mono);font-weight:800;word-spacing:-.3em}',
      '.l8-cmd{min-height:260px}',
      '.l8-cols .l8-col{fill:var(--ip-blue);transform-box:fill-box;transform-origin:50% 100%;transition:fill .22s}',
      '.l8-cols.hov .l8-col:not(.act){fill:#CBD8F4}',
      '.l8-cols .l8-cvl{font-family:var(--mono);font-size:13px;font-weight:700;fill:var(--ip-ink-2);font-variant-numeric:tabular-nums;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}',
      '.l8-av .l8-cols .l8-col{transform:scaleY(0)}',
      '.l8-av .l8-cols .l8-cvl{transform:translateY(var(--dy))}',
      '.l8-lit .l8-cols .l8-col{animation:l8-col .6s var(--ease) backwards;animation-delay:calc(var(--i)*45ms + var(--l8t,0ms))}',
      '.l8-lit .l8-cols .l8-cvl{animation:l8-vl .6s var(--ease) backwards;animation-delay:calc(var(--i)*45ms + var(--l8t,0ms))}',
      '.l8-lit .l8-cols .l8-marche{animation:l8-trace .7s var(--ease) backwards;animation-delay:calc(400ms + var(--l8t,0ms))}',
      '@keyframes l8-col{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
      '@keyframes l8-vl{from{transform:translateY(var(--dy))}to{transform:translateY(0)}}',
      '.l8-pastille{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:13px;font-weight:700;padding:2px 10px;border-radius:999px;word-spacing:-.3em;white-space:nowrap;background:var(--surf-sunken)}',
      '.l8-pastille.pha-up{background:color-mix(in srgb,var(--c-mint) 13%,#fff)}.l8-pastille.pha-dn{background:color-mix(in srgb,var(--c-rose) 13%,#fff)}',
      '.l8-pastille svg{width:14px;height:14px}',
      /* À proposer, Meilleurs produits, Répartition : barres fines qui poussent en cascade */
      '.l8-av .l8-pbar i{transform:scaleX(0)}',
      '.l8-lit .l8-pbar i{animation:l8-barre .65s var(--ease) backwards;animation-delay:calc(var(--i,0)*40ms + var(--l8t,0ms))}',
      '@keyframes l8-barre{from{transform:scaleX(0)}to{transform:scaleX(var(--w,1))}}',
      /* Catégories : petite courbe par ligne, courbe en grand au clic */
      '.l8-mini{display:block;height:38px;min-width:0}',
      '.l8-mini svg{display:block;width:100%;height:38px;overflow:visible;transition:transform .25s var(--ease)}',
      '.l8-mini.abs svg path{stroke-dasharray:1 5}',
      '.l8-crow:hover .l8-mini svg,.l8-crow:focus-visible .l8-mini svg{transform:scale(1.03)}',
      '.l8-lit .l8-m1{animation:l8-trace .7s var(--ease) backwards;animation-delay:calc(var(--i,0)*60ms + var(--l8t,0ms))}',
      '.l8-lit .l8-m2{animation:l8-pop .4s cubic-bezier(.22,1,.36,1) backwards;animation-delay:calc(var(--i,0)*60ms + 500ms + var(--l8t,0ms))}',
      '.l8-detail .l8-dcv{margin-top:2px}',
      '.l8-lu2{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;min-height:36px;font-size:15px;font-weight:700}',
      /* Ne commande plus : frise des mois de la période */
      '.l8-fz{display:grid;grid-template-columns:minmax(0,1fr) 372px 96px;gap:0 14px;align-items:center;min-height:56px}',
      '.l8-fz .l8-lg-g{text-align:right}',
      '.l8-fzt{min-height:30px;padding:0;border-top:0}',
      '.l8-frz{display:block;min-width:0;height:44px}.l8-fzt .l8-frz{height:22px}',
      '.l8-frz svg{display:block;width:100%;overflow:visible}',
      '.l8-frz text{font-family:var(--font);font-size:13px;font-weight:600;fill:#646B80}',
      '.l8-av .l8-frz .l8-sil{opacity:0}',
      '.l8-lit .l8-frz .l8-fdot{animation:l8-pop .45s cubic-bezier(.22,1,.36,1) backwards;animation-delay:calc(var(--i,0)*50ms + var(--l8t,0ms))}',
      '.l8-lit .l8-frz .l8-sil{animation:l8-fondu .5s ease backwards;animation-delay:calc(var(--i,0)*50ms + 250ms + var(--l8t,0ms))}',
      '@media(max-width:899px){.l8-pbar{width:72px}}',
      '@media(max-width:900px){',
      '.pha.l8{display:block;padding-top:0}',
      '.pha.l8>.pha-rail,.pha.l8>.pha-main{display:flex;flex-direction:column;gap:16px;min-width:0}',
      '.l8-rail{position:static}',
      '.pha.l8 .l8-menu{display:none}',
      '.l8-icols{display:block}.l8-icol+.l8-icol{margin-top:40px}',
      '.l8-rub+.l8-rub{margin-top:36px;padding-top:28px}',
      '.l8-id{padding:20px 20px 16px}',
      '.l8-nom{font-size:26px}',
      '.l8-acts{margin-top:16px}.l8-acts-2{margin-top:12px}',
      '.l8-main{min-height:0}',
      '.l8-tete{flex-direction:column;align-items:flex-start;margin-bottom:12px}',
      '.l8-t{font-size:28px}',
      '.l8-n{font-size:60px}',
      '.l8-reps{grid-template-columns:1fr;gap:0;margin-top:12px}',
      '.l8-cmd{min-height:178px}',
      '.l8-fz{grid-template-columns:minmax(0,1fr) 92px;gap:0 10px;padding:6px 0 4px;min-height:68px}',
      '.l8-fz .l8-ln{grid-column:1/-1}',
      '.l8-fzt{min-height:28px;padding:0}.l8-fzt .l8-ln{display:none}.l8-fzt .l8-lg-g{visibility:hidden}',
      '.l8-rep{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:0 12px;padding:12px 0}',
      '.l8-rv{margin:0;font-size:22px}',
      '.l8-rv-mots{font-size:19px}',
      '.l8-rt{margin:0;width:100%;text-align:right}',
      '.l8-crow{grid-template-columns:minmax(0,1fr) 20px;grid-template-areas:"n c" "x x";padding:10px 0;min-height:64px}',
      '.l8-cn{grid-area:n}.l8-cc{grid-area:c}',
      '.l8-cinf{grid-area:x;grid-template-columns:76px minmax(0,1fr) 108px;gap:0 12px;margin-top:6px}',
      '.l8-cm{text-align:left}',
      '.l8-detail{grid-template-columns:1fr}',
      '.l8-fr{flex-wrap:wrap}',
      '.l8-fnote a{padding:13px 0}',
      '.l8-pacts{width:100%}.l8-pacts .l8-btn{flex:1;justify-content:center;padding:0 8px}',
      '}',
      '@media(prefers-reduced-motion:reduce){.l8-tr *,.l8-tr,.l8-mini *,.l8-frz *,.l8-pbar i{transition:none!important;animation:none!important}}',
      '#l8-tout-body[hidden]{display:none!important}',
      '.phf-prange{color:var(--muted);font-weight:600;font-size:14px}',
      '.phf-psub{font-size:12.5px;color:var(--muted);font-weight:500;margin-top:5px;max-width:560px;line-height:1.4}',
      '.phf-pright{display:flex;align-items:center;gap:12px}',
      '.phf-selcount{font-size:12px;font-weight:600;color:var(--muted);white-space:nowrap}',
      '.phf-selcount b{font-family:var(--mono);color:var(--ip-blue);font-weight:800}',
      '.phf-pdf{display:inline-flex;align-items:center;gap:8px;background:var(--ip-blue);color:#fff;border:0;border-radius:var(--r-btn);padding:11px 17px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:var(--sh-blue);transition:background .15s var(--ease),transform .15s var(--ease),box-shadow .15s var(--ease)}',
      '.phf-pdf:hover{background:var(--ip-blue-d);transform:translateY(-1px);box-shadow:var(--sh-blue-h)}',
      '.phf-pdf:active{transform:translateY(0)}',
      '.phf-pdf-ghost{background:var(--card);color:var(--ip-blue);border:1px solid var(--line-strong);box-shadow:none}',
      '.phf-pdf-ghost:hover{background:var(--card-2);border-color:var(--ip-blue)}',
      '.phf-props{display:grid;gap:12px;margin-bottom:8px}',
      '.phf-prop{position:relative;display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--pc,var(--ip-blue));border-radius:var(--r-card);box-shadow:var(--sh-1);padding:16px 20px;transition:transform .2s var(--ease),box-shadow .2s var(--ease),border-color .2s var(--ease)}',
      '.phf-prop:hover{transform:translateY(-2px);box-shadow:var(--sh-2);border-color:color-mix(in srgb,var(--pc,var(--ip-blue)) 30%,var(--line))}',
      '.phf-prop-ic{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(150deg,var(--pc,var(--ip-blue)),color-mix(in srgb,var(--pc,var(--ip-blue)) 70%,#000));flex:none;box-shadow:0 3px 9px color-mix(in srgb,var(--pc,var(--ip-blue)) 30%,transparent),0 1px 0 rgba(255,255,255,.25) inset;transition:transform .2s var(--ease)}',
      '.phf-prop:hover .phf-prop-ic{transform:scale(1.06)}',
      '.phf-prop-main{flex:1;min-width:160px}',
      '.phf-prop-t{font-size:16px;font-weight:800;letter-spacing:-.01em}',
      '.phf-prop-s{font-size:12.5px;color:var(--muted);font-weight:500;margin-top:2px}',
      '.phf-prop-n{font-size:24px;font-weight:800;color:var(--pc,var(--ip-blue));text-align:center;line-height:1;letter-spacing:-.03em}',
      '.phf-prop-n small{display:block;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.05em;text-transform:uppercase;margin-top:4px}',
      '.phf-prop-acts{display:flex;gap:8px;flex-wrap:wrap}',
      '.phf-rf-off{opacity:.45;cursor:default}',
      '@media(max-width:640px){.phf-prop{flex-direction:column;align-items:stretch}.phf-prop-acts{width:100%;gap:8px}.phf-prop-acts .phf-pdf{flex:1;justify-content:center}}',
      '.phf-mk{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;letter-spacing:.02em;padding:4px 10px;border-radius:var(--r-pill);white-space:nowrap}',
      '.phf-mk-own{color:var(--c-mint-txt);background:color-mix(in srgb,var(--c-opp) 13%,transparent)}',
      '.phf-mk-gap{color:var(--c-amber-txt);background:color-mix(in srgb,var(--c-amber) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c-amber) 24%,transparent)}',
      '.phf-r-gap td{background:color-mix(in srgb,var(--c-amber) 5%,transparent)}',
      '.phf-rotfilter{display:flex;gap:6px}',
      '.phf-rf{padding:7px 13px;border-radius:var(--r-pill);border:1px solid var(--line-strong);background:var(--card);font:inherit;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap;transition:background .15s var(--ease),border-color .15s var(--ease),color .15s var(--ease)}',
      '.phf-rf:hover{color:var(--ip-ink);border-color:var(--muted-2)}',
      '.phf-rf.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:0 2px 7px rgba(0,80,230,.22)}',
      '.phf-fambar{display:none}',
      '.phf-tablewrap{overflow-x:auto}',
      '.phf-tbl{width:100%;border-collapse:collapse;font-size:13px}',
      '.phf-tbl thead th{position:sticky;top:0;z-index:2;background:var(--card-2);font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);text-align:right;padding:12px;border-bottom:1px solid var(--line-strong);white-space:nowrap}',
      '.phf-tbl thead th.phf-tl{text-align:left}',
      '.phf-tbl thead th.phf-tc{text-align:center}',
      '.phf-tbl tbody td{padding:12px;border-bottom:1px solid var(--line);text-align:right;vertical-align:middle}',
      '.phf-tbl tbody tr:last-child td{border-bottom:0}',
      '.phf-tbl tbody tr{transition:background .12s var(--ease)}',
      '.phf-tbl tbody tr:hover{background:var(--surf-sunken)}',
      '.phf-tbl tbody tr.phf-picked{background:rgba(30,158,106,.06)}',
      /* Ligne "a pousser" : liseree ambre discrete a gauche pour scan rapide au comptoir */
      '.phf-tbl tbody tr.phf-r-gap td:first-child{box-shadow:inset 3px 0 0 var(--c-amber)}',
      '.phf-tbl tbody tr.phf-r-gap:hover{background:color-mix(in srgb,var(--c-amber) 7%,transparent)}',
      '.phf-td-l{text-align:left}',
      '.phf-desig{font-weight:700;line-height:1.25}',
      '.phf-cip{font-family:var(--mono);font-size:12px;color:var(--muted-2);font-weight:500;margin-top:2px}',
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
      '.phf-foot{padding:13px 22px;background:var(--card-2);border-top:1px solid var(--line);font-size:12px;color:var(--muted);display:flex;align-items:center;gap:7px}',
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
      '.ipv-vol small{font-weight:500;color:var(--muted-2);font-size:12px}',
      // ── Badges OPSO (clientes / prospects) — uniquement en mode OPSO ──
      '.opso-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.01em;flex-shrink:0;vertical-align:middle}',
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
      // ── Barre RDV collante du pilier : posée au-dessus du bas de l'écran (décalage de 64 px conservé) ──
      // (02/10/2026 : la barre « fiche globale » #v2-cartbar n'existe plus ; seule reste celle-ci.) Lumière du pilier sur le badge.
      // 02/10/2026 — #v2-root garde un transform (animation d'entrée) : une barre « fixed » placée dedans reste au bas de la PAGE, hors de l'écran.
      // « sticky » la fait coller au bas de l'écran ; c'était la barre globale (retirée) qui était vue jusque-là.
      '#ph-cartbar{position:sticky;bottom:calc(64px + env(safe-area-inset-bottom))}',
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
      // ── Mobile terrain : toggles réseau/groupement empilés (fini le débordement latéral du libellé long) ──
      '@media(max-width:640px){.net-scope{flex-direction:column}.net-scope-b{white-space:normal;text-align:left;min-width:0;justify-content:flex-start}}',
      // ── Table audit/rotations : 1re colonne (produit) collante pendant le scroll horizontal, comme la table Opportunités ──
      '@media(max-width:640px){.phf-tbl th:first-child,.phf-tbl td:first-child{position:sticky;left:0;z-index:1;background:var(--card)}.phf-tbl thead th:first-child{background:var(--card-2)}.phf-tbl tbody tr:hover td:first-child{background:var(--surf-sunken)}}',
      // ── Boutons d\'action denses (coche/retirer) : zone tactile élargie à 44px sans changer le visuel ──
      '@media(max-width:640px){.phf-check,.ph-rmprod,.pl-rm{position:relative}.phf-check::before,.ph-rmprod::before,.pl-rm::before{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:var(--tap-min,44px);height:var(--tap-min,44px)}}',
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
