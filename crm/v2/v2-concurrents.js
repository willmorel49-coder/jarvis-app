/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier « Ressources concurrents » (pages.concurrents)
   Tout ce qu'on sait des concurrents, au même endroit : Sagitta (3
   catalogues), OCP Incontournables (tous paliers), OCP Marque Conseil,
   Pharmazon, Cooper Préparatoire, Farmaline (prix publics belges) et les
   Études (recherche conditions grossistes). NOTRE net (V2.bestPrice) en
   face de chaque référence quand le code est chez nous.
   Décision Will 10/09/2026. CRM interne SEULEMENT — jamais côté OPSO.
   Données : concurrents-*-data.js (protégés, Supabase, generate_concurrents.py),
   pharmazon-data.js + pharmazon-prix.js (protégé).
   11/09/2026 — ergonomie « mix 3 + 4 » choisie par Will :
     · ordinateur = « le dossier concurrent » : onglets entre concurrents,
       fiche (en-tête, cartouches calculés, nos points forts / les leurs,
       catalogue filtrable) ;
     · téléphone (≤ 700 px) = « le comptoir » : recherche géante d'abord,
       résultats en liste, concurrents en puces défilables ;
     · dans les deux cas un produit s'ouvre en CARTE « tous les prix »
       (classement du moins cher au plus cher, notre ligne surlignée, prix
       publics hors classement) avec « Montrer au pharmacien » : plein écran,
       produit + notre net + PPHT, sans concurrents, écran retournable.
   Vanilla · zéro lib · zéro emoji.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return V2.ICO ? V2.ICO(n, s, w) : (window.ICO ? window.ICO(n, s, w) : ''); };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : String(n); };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(n); };

  // Conditions de TIERS : l'app OPSO ne charge pas ce module, et même chargé
  // par erreur il ne demanderait rien (même garde que Sagitta/OCP dans Offilog).
  var SANS = !!(window.V2_BRAND && window.V2_BRAND.opso);
  var MOD_BASE = (function () {
    try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[?#].*$/, '').replace(/[^/]+$/, ''); } catch (e) {}
    return '';
  })();
  var LIMIT = 200;

  // État local : source ouverte, recherche du catalogue, chip, tri ;
  // puis le comptoir (cq), la carte produit ouverte, le plein écran pharmacien.
  var S = { src: '', q: '', chip: '', sort: '', desc: false, cq: '', carte: null, face: false };
  var tried = {};      // clé loadFiles → déjà demandé
  var pzLoading = false;
  var loading = {};    // source demandée depuis le comptoir, en attente

  // ── Les sources ─────────────────────────────────────────────────────
  // Une entrée par source : ce qu'elle charge, ses colonnes, ses chips.
  // `cols` : [clé, libellé, type] — type 'eur' | 'pct' | 'num' | '' (texte)
  var SRC = {
    sagitta: {
      nom: 'Sagitta', tag: 'Grossiste', accent: '#0E7C86', cles: ['concsagitta'],
      quoi: 'Les trois catalogues Sagitta fusionnés (général, grossiste, para-OTC) : libellé, laboratoire, gamme, tarif, remise et prix net.',
      charge: function () { return !!window.CONCURRENTS_SAGITTA; },
      maj: function () { return window.CONCURRENTS_SAGITTA && CONCURRENTS_SAGITTA.maj; },
      rows: function () { return window.CONCURRENTS_SAGITTA ? CONCURRENTS_SAGITTA.rows : []; },
      cols: function () { return window.CONCURRENTS_SAGITTA ? CONCURRENTS_SAGITTA.cols : []; },
      code: 'cip13', codeAlt: 'ean13', net: 'net',
      chipCol: 'cat', chipLabel: { general: 'Général seulement', grossiste: 'Grossiste', 'para-otc': 'Para-OTC' },
      affiche: [['cip13', 'CIP 13', ''], ['ean13', 'EAN', ''], ['libelle', 'Produit', ''], ['labo', 'Laboratoire', ''], ['gamme', 'Gamme', ''],
        ['tarif', 'Tarif HT', 'eur'], ['remise', 'Remise', 'pct'], ['net', 'Net Sagitta', 'eur'], ['tva', 'TVA', 'pct'], ['qtemin', 'Qté min', 'num']],
      cherche: ['libelle', 'labo', 'gamme', 'cip13', 'ean13']
    },
    ocp: {
      nom: 'OCP · Les Incontournables', tag: 'Promo sept-déc 2026', accent: '#C7791A', cles: ['concocp'],
      quoi: 'Le catalogue promotionnel OCP en entier : chaque produit avec sa condition, TOUS ses paliers de prix net, sa remise et sa page du catalogue.',
      charge: function () { return !!window.CONCURRENTS_OCP; },
      maj: function () { return window.CONCURRENTS_OCP && CONCURRENTS_OCP.incontournables.maj; },
      rows: function () { return window.CONCURRENTS_OCP ? CONCURRENTS_OCP.incontournables.rows : []; },
      cols: function () { return window.CONCURRENTS_OCP ? CONCURRENTS_OCP.incontournables.cols : []; },
      code: 'code13', net: 'net',
      chipCol: 'section', chipLabel: { quadrimestrielle: 'Quadrimestrielle', 'annuelle sans engagement': 'Annuelle sans engagement', 'annuelle avec engagement': 'Annuelle avec engagement' },
      affiche: [['code13', 'Code 13', ''], ['libelle', 'Produit', ''], ['labo', 'Laboratoire', ''], ['section', 'Offre', ''], ['condition', 'Condition', ''],
        ['ppht', 'PPHT', 'eur'], ['net', 'Meilleur net', 'eur'], ['remise', 'Remise', 'pct'], ['paliers', 'Paliers (net)', 'paliers'], ['page', 'Page', '']],
      cherche: ['libelle', 'labo', 'code13', 'condition']
    },
    mc: {
      nom: 'OCP · Marque Conseil', tag: 'Marque distributeur', accent: '#6D4FC4', cles: ['concocp'],
      quoi: 'La marque distributeur d\'OCP : prix public conseillé, tarif LPPR et coefficient de marge maximal par famille. Pas de prix d\'achat dans ce document.',
      charge: function () { return !!window.CONCURRENTS_OCP; },
      maj: function () { return window.CONCURRENTS_OCP && CONCURRENTS_OCP.marqueConseil.maj; },
      rows: function () { return window.CONCURRENTS_OCP ? CONCURRENTS_OCP.marqueConseil.rows : []; },
      cols: function () { return window.CONCURRENTS_OCP ? CONCURRENTS_OCP.marqueConseil.cols : []; },
      code: 'code13', net: '',
      chipCol: 'famille', chipLabel: {},
      affiche: [['code13', 'Code 13', ''], ['famille', 'Famille', ''], ['libelle', 'Produit', ''], ['descriptif', 'Descriptif', ''],
        ['pvc_ttc', 'PVC TTC', 'eur'], ['lppr', 'LPPR', ''], ['tarif_lppr_ttc', 'Tarif LPPR TTC', 'eur'], ['coef_marge_max', 'Coef. marge max', 'num'], ['folio', 'Page', '']],
      cherche: ['libelle', 'famille', 'descriptif', 'code13']
    },
    pharmazon: {
      nom: 'Pharmazon', tag: 'Plateforme labos', accent: '#345DA0', cles: ['pharmazonprix'],
      quoi: 'Le catalogue B2B Pharmazon (offres laboratoires) avec le prix négocié, le prix catalogue et la remise. Export du 14/05/2026, pas un relevé en direct.',
      charge: function () { return !!(window.PHARMAZON && window.PHARMAZON_PRIX); },
      maj: function () { return '2026-05-14'; },
      rows: function () {
        if (!window.PHARMAZON) return [];
        if (V2.fusionnerPrixPharmazon) { try { V2.fusionnerPrixPharmazon(); } catch (e) {} }
        return PHARMAZON.map(function (o) { return [String(o.ean || ''), o.name || '', o.labo || '', o.prix_catalogue, o.remise, o.prix_final]; });
      },
      cols: function () { return ['ean13', 'libelle', 'labo', 'tarif', 'remise', 'net']; },
      code: 'ean13', net: 'net',
      chipCol: '', chipLabel: {},
      affiche: [['ean13', 'EAN', ''], ['libelle', 'Produit', ''], ['labo', 'Laboratoire', ''], ['tarif', 'Prix catalogue', 'eur'], ['remise', 'Remise', 'pct'], ['net', 'Net Pharmazon', 'eur']],
      cherche: ['libelle', 'labo', 'ean13']
    },
    etudes: {
      nom: 'Études · avantages observés', tag: 'Recherche sept. 2026', accent: '#8A6D1F', cles: ['concetudes'],
      quoi: 'Ce que les sources publiques disent des avantages consentis aux officines : décisions, rapports, thèses, factures, CGV. Chaque ligne cite sa source, son extrait et un indice de confiance de 1 à 5.',
      unite: 'observation', go: 'Ouvrir les observations', placeholder: 'Acteur, produit, avantage, source…',
      charge: function () { return !!window.CONCURRENTS_ETUDES; },
      maj: function () { return window.CONCURRENTS_ETUDES && CONCURRENTS_ETUDES.maj; },
      rows: function () { return window.CONCURRENTS_ETUDES ? CONCURRENTS_ETUDES.rows : []; },
      cols: function () { return window.CONCURRENTS_ETUDES ? CONCURRENTS_ETUDES.cols : []; },
      code: 'cip13', net: '',
      chipCol: 'flux', chipLabel: { 'grossiste→pharmacie': 'Grossiste → officine', 'labo→pharmacie': 'Laboratoire → officine', 'groupement→pharmacie': 'Groupement → officine', 'labo→grossiste': 'Laboratoire → grossiste', 'labo→groupement': 'Laboratoire → groupement', 'labo→autre': 'Laboratoire → autre', 'cadre-legal': 'Cadre légal', autre: 'Autre' },
      affiche: [['acteur', 'Acteur', ''], ['libelle', 'Observation', ''], ['avantage', 'Avantage', ''], ['taux', 'Taux %', ''], ['montant', 'Montant', ''],
        ['assiette', 'Assiette', ''], ['condition', 'Condition', ''], ['plafond', 'Plafond légal', ''], ['classification', 'Lecture', ''],
        ['periode', 'Période', ''], ['document', 'Document', ''], ['extrait', 'Extrait', ''], ['source', 'Source', ''], ['url', 'Lien', 'lien'], ['confiance', 'Confiance', 'num']],
      cherche: ['libelle', 'acteur', 'medicament', 'avantage', 'source', 'extrait', 'labo', 'cip13']
    },
    cooper: {
      nom: 'Cooper · Préparatoire', tag: 'Vente directe labo', accent: '#2F6B3A', cles: ['conccooper'],
      quoi: 'Le catalogue préparatoire Cooper vendu en direct aux officines : matières premières, huiles essentielles et végétales, gélules, flaconnage et équipement, avec le prix unitaire HT. Tarif 2023, dernière version publiée.',
      placeholder: 'Produit, famille, rayon, code…',
      charge: function () { return !!window.CONCURRENTS_COOPER; },
      maj: function () { return window.CONCURRENTS_COOPER && CONCURRENTS_COOPER.maj; },
      rows: function () { return window.CONCURRENTS_COOPER ? CONCURRENTS_COOPER.rows : []; },
      cols: function () { return window.CONCURRENTS_COOPER ? CONCURRENTS_COOPER.cols : []; },
      code: 'code13', net: 'prix',
      chipCol: 'famille', chipLabel: {},
      affiche: [['code13', 'Code 13', ''], ['cpf', 'Code CPF', ''], ['famille', 'Famille', ''], ['rayon', 'Rayon', ''], ['libelle', 'Produit', ''], ['detail', 'Détail', ''],
        ['division', 'Division / lot', ''], ['statut', 'Statut', ''], ['cmr', 'CMR', ''], ['prix', 'Prix HT', 'eur'], ['page', 'Page', '']],
      cherche: ['libelle', 'detail', 'famille', 'rayon', 'code13', 'cpf']
    },
    farmaline: {
      nom: 'Farmaline', tag: 'Pharmacie en ligne (BE)', accent: '#B23A6B', cles: ['concfarmaline'],
      quoi: 'Les prix publics de la pharmacie en ligne belge Farmaline (groupe Redcare) sur les produits que JARVIS connaît et sur les codes français : prix affiché, prix barré, remise et prix hors taxe. Un prix consommateur, pas une condition d\'achat : aucun verdict face à notre net.',
      placeholder: 'Produit, marque, laboratoire, rayon, EAN…',
      charge: function () { return !!window.CONCURRENTS_FARMALINE; },
      maj: function () { return window.CONCURRENTS_FARMALINE && CONCURRENTS_FARMALINE.maj; },
      rows: function () { return window.CONCURRENTS_FARMALINE ? CONCURRENTS_FARMALINE.rows : []; },
      cols: function () { return window.CONCURRENTS_FARMALINE ? CONCURRENTS_FARMALINE.cols : []; },
      code: 'ean13', net: '',
      chipCol: 'connu', chipLabel: { connu: 'Connus de JARVIS', 'code FR': 'Codes français' },
      affiche: [['ean13', 'EAN', ''], ['libelle', 'Produit', ''], ['marque', 'Marque', ''], ['labo', 'Laboratoire', ''], ['conditionnement', 'Conditionnement', ''], ['rayon', 'Rayon', ''],
        ['tarif', 'Prix barré TTC', 'eur'], ['prix', 'Prix TTC', 'eur'], ['remise', 'Remise', 'pct'], ['prix_ht', 'Prix HT', 'eur'], ['conseille', 'Prix conseillé TTC', 'eur'], ['stock', 'Stock', ''], ['vendeur', 'Vendeur', ''], ['lien', 'Fiche', 'lien']],
      cherche: ['libelle', 'marque', 'labo', 'rayon', 'ean13']
    }
  };
  var ORDRE = ['sagitta', 'ocp', 'mc', 'pharmazon', 'cooper', 'farmaline', 'etudes'];
  // Nom court (onglets, puces, classement), circuit, poids du fichier (annoncé
  // avant de télécharger : jamais tout d'office), colonne des points forts.
  var COURT = { sagitta: 'Sagitta', ocp: 'OCP Incontournables', mc: 'OCP Marque Conseil', pharmazon: 'Pharmazon', cooper: 'Cooper', farmaline: 'Farmaline', etudes: 'Études' };
  var CIRCUIT = { sagitta: 'Grossiste-répartiteur généraliste', ocp: 'Grossiste-répartiteur · catalogue promotionnel', mc: 'Marque distributeur du grossiste', pharmazon: 'Plateforme d\'achat direct laboratoires', cooper: 'Vente directe laboratoire · préparatoire', farmaline: 'Pharmacie en ligne belge · prix consommateur', etudes: 'Sources publiques : décisions, rapports, thèses, factures, CGV' };
  var POIDS = { sagitta: '2 Mo', ocp: '130 Ko', mc: '130 Ko', pharmazon: '1,3 Mo', cooper: '120 Ko', farmaline: '2 Mo', etudes: '500 Ko' };
  var FORTS = { sagitta: 'gamme', ocp: 'section', pharmazon: 'labo', cooper: 'famille' };
  var CLASSEMENT = ['sagitta', 'ocp', 'pharmazon', 'cooper'];   // seules sources à prix d'achat

  // ── Notre prix (V2.bestPrice = seule source de vérité) ───────────────
  // Index PROD_STATS par CIP13. Génériques et biosimilaires EXCLUS du verdict
  // (leurs remises passent en direct labo → pharmacie, invisibles dans notre
  // net ; en facture chez le grossiste — le face-à-face serait faux).
  var idxNous = null;
  function nous(code) {
    if (!idxNous) {
      idxNous = {};
      (window.PROD_STATS || []).forEach(function (r) { if (r && r.c) idxNous[String(r.c)] = r; });
    }
    var r = code ? idxNous[String(code)] : null;
    if (!r) return null;
    var bp = V2.bestPrice ? V2.bestPrice({ prix_ht: r.ppht, prix_ip: r.net }) : { ip: r.net > 0 ? r.net : null, remise: 0 };
    return { ip: bp.ip, f: r.f, exclu: (r.f === 'gen' || r.f === 'biosim'), d: r.d || '', ppht: r.ppht > 0 ? r.ppht : null, remise: bp.remise || 0, c: String(r.c) };
  }
  function verdict(net, n) {
    if (!n || !(n.ip > 0) || n.exclu || !(net > 0)) return '';
    return n.ip < net ? 'win' : (net < n.ip ? 'lose' : 'egal');
  }

  // ── Chargement ───────────────────────────────────────────────────────
  function charger(src, cb) {
    if (SANS) return;
    var s = SRC[src];
    if (s.charge()) { cb(); return; }
    var k = s.cles.join('+');
    if (src === 'pharmazon' && !window.PHARMAZON && !pzLoading) {
      // Identité publique (pharmazon-data.js) + prix protégé (pharmazonprix),
      // même chemin que l'écran Offilog.
      pzLoading = true;
      var sc = document.createElement('script'); sc.src = MOD_BASE + 'pharmazon-data.js?v=20260903a';
      sc.onload = function () { pzLoading = false; cb(); };
      sc.onerror = function () { pzLoading = false; V2.protegeEchec.pharmazon = true; cb(); };
      document.head.appendChild(sc);
    }
    if (tried[k]) return;
    tried[k] = true;
    if (V2.loadFiles) { try { V2.loadFiles(s.cles).then(cb); } catch (e) { cb(); } }
  }
  function echec(src) {
    var ko = V2.donneesProtegeesKO ? V2.donneesProtegeesKO() : [];
    var cles = SRC[src].cles.concat(src === 'pharmazon' ? ['pharmazon'] : []);
    return cles.some(function (c) { return ko.indexOf(c) >= 0; });
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  function dateFr(d) {
    if (!d) return '';
    var p = String(d).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(d);
  }
  function cap(s, n) { s = String(s || ''); n = n || 60; return s.length > n ? s.slice(0, n - 2) + '…' : s; }
  var LONG = { libelle: 1, descriptif: 1, condition: 1, extrait: 1, source: 1, assiette: 1, detail: 1 };
  function colIdx(s) { var m = {}; s.cols().forEach(function (c, i) { m[c] = i; }); return m; }
  function fmt(v, type) {
    if (v == null || v === '') return '<span class="cc-mute">—</span>';
    if (type === 'eur') return eur(v);
    if (type === 'pct') return (v > 0 ? String(Math.round(v * 10) / 10).replace('.', ',') + ' %' : '<span class="cc-mute">—</span>');
    if (type === 'num') return num(v);
    if (type === 'lien') return /^https?:\/\//.test(String(v)) ? '<a href="' + esc(v) + '" target="_blank" rel="noopener">Voir</a>' : esc(v);
    if (type === 'paliers') return String(v).split('|').map(function (x) { var n = parseFloat(x); return isNaN(n) ? esc(x) : eur(n); }).join(' · ');
    return esc(v);
  }
  function pct1(v, signe) { var t = (Math.round(Math.abs(v) * 10) / 10).toFixed(1).replace('.', ','); return (v < 0 ? '−' : (signe && v > 0 ? '+' : '')) + t + ' %'; }
  function pct0(a, b) { return b ? Math.round(a / b * 100) + ' %' : '—'; }
  function norm(s) { try { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); } catch (e) { return String(s == null ? '' : s).toLowerCase(); } }
  function phone() { try { return window.matchMedia('(max-width:700px)').matches; } catch (e) { return false; } }
  function safeArg(k) { return String(k).replace(/[\\'"<>&]/g, ''); }
  function filtre(s) {
    var ci = colIdx(s), rows = s.rows();
    var q = S.q.trim().toLowerCase();
    var chipI = s.chipCol ? ci[s.chipCol] : -1;
    var out = rows.filter(function (r) {
      if (S.chip && chipI >= 0 && String(r[chipI] || '') !== S.chip) return false;
      if (!q) return true;
      for (var i = 0; i < s.cherche.length; i++) {
        var v = r[ci[s.cherche[i]]];
        if (v != null && String(v).toLowerCase().indexOf(q) >= 0) return true;
      }
      return false;
    });
    if (S.sort && ci[S.sort] != null) {
      var si = ci[S.sort];
      out = out.slice().sort(function (a, b) {
        var x = a[si], y = b[si];
        if (x == null || x === '') return 1;
        if (y == null || y === '') return -1;
        var c = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'fr');
        return S.desc ? -c : c;
      });
    }
    return out;
  }
  function chips(s) {
    if (!s.chipCol) return '';
    var ci = colIdx(s), i = ci[s.chipCol], cnt = {};
    s.rows().forEach(function (r) { var v = String(r[i] || ''); if (v) cnt[v] = (cnt[v] || 0) + 1; });
    var keys = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 14);
    if (keys.length < 2) return '';
    var all = '<button type="button" class="v2-seg' + (!S.chip ? ' on' : '') + '" onclick="V2.ccChip(\'\')">Tout <span class="cnt">' + num(s.rows().length) + '</span></button>';
    return '<div class="v2-segs">' + all + keys.map(function (k) {
      return '<button type="button" class="v2-seg' + (S.chip === k ? ' on' : '') + '" onclick="V2.ccChip(\'' + safeArg(k) + '\')">' + esc(s.chipLabel[k] || k) + ' <span class="cnt">' + num(cnt[k]) + '</span></button>';
    }).join('') + '</div>';
  }

  // ── Index par code (pour la carte produit et le comptoir) ───────────
  // Une source = { map: code → [lignes], n: nb de lignes indexées }.
  var IDX = {};
  function index(k) {
    var s = SRC[k], rows = s.rows();
    if (IDX[k] && IDX[k].n === rows.length) return IDX[k].map;
    var ci = colIdx(s), a = ci[s.code], b = s.codeAlt ? ci[s.codeAlt] : -1, map = {};
    rows.forEach(function (r) {
      var c1 = String(r[a] || ''), c2 = b >= 0 ? String(r[b] || '') : '';
      if (c1) (map[c1] = map[c1] || []).push(r);
      if (c2 && c2 !== c1) (map[c2] = map[c2] || []).push(r);
    });
    IDX[k] = { map: map, n: rows.length };
    return map;
  }

  // ── Analyse d'une source (cartouches + points forts) ────────────────
  // Calculée sur TOUTES les lignes, mise en cache tant que les données ne
  // bougent pas. Pour les sources à prix d'achat : références communes (hors
  // génériques et biosimilaires), gagnées, perdues, écart moyen (notre net
  // face au net concurrent, en % du net concurrent : négatif = en notre faveur),
  // et le détail par valeur de la colonne FORTS (gamme, section, labo, famille).
  var AN = {};
  function analyse(k) {
    var s = SRC[k], rows = s.rows(), key = rows.length + ':' + (window.PROD_STATS || []).length;
    if (AN[k] && AN[k].key === key) return AN[k];
    var ci = colIdx(s), a = { key: key, refs: rows.length, groupes: {}, communes: 0, win: 0, lose: 0, egal: 0, exclus: 0, ecart: null };
    if (s.net) {
      var codeI = ci[s.code], altI = s.codeAlt ? ci[s.codeAlt] : -1, netI = ci[s.net];
      var gcol = FORTS[k] || s.chipCol, gI = gcol ? ci[gcol] : -1, somme = 0;
      rows.forEach(function (r) {
        var n = nous(r[codeI]) || (altI >= 0 ? nous(r[altI]) : null);
        if (!n) return;
        if (n.exclu) { a.exclus++; return; }
        var v = verdict(r[netI], n); if (!v) return;
        a.communes++; if (v === 'win') a.win++; else if (v === 'lose') a.lose++; else a.egal++;
        somme += (n.ip - r[netI]) / r[netI];
        if (gI >= 0) {
          var g = String(r[gI] || '') || '—';
          var o = a.groupes[g] || (a.groupes[g] = { n: 0, win: 0, lose: 0 });
          o.n++; if (v === 'win') o.win++; else if (v === 'lose') o.lose++;
        }
      });
      a.ecart = a.communes ? somme / a.communes * 100 : null;
    } else {
      // comptages descriptifs : valeurs distinctes des colonnes utiles
      var cnt = function (col) { var i = ci[col], m = {}; if (i == null) return m; rows.forEach(function (r) { var v = String(r[i] || '').trim(); if (v) m[v] = (m[v] || 0) + 1; }); return m; };
      if (k === 'mc') {
        a.familles = cnt('famille');
        a.lppr = rows.filter(function (r) { return r[ci.tarif_lppr_ttc] > 0; }).length;
        a.coefMax = rows.reduce(function (m, r) { return r[ci.coef_marge_max] > m ? r[ci.coef_marge_max] : m; }, 0);
        a.coefParFamille = {};
        rows.forEach(function (r) { var f = String(r[ci.famille] || '').trim(), c = r[ci.coef_marge_max]; if (f && c > 0 && !(a.coefParFamille[f] > c)) a.coefParFamille[f] = c; });
      } else if (k === 'farmaline') {
        a.connus = rows.filter(function (r) { return r[ci.connu] === 'connu'; }).length;
        a.stock = rows.filter(function (r) { return r[ci.stock] === 'en stock'; }).length;
        a.baisses = rows.filter(function (r) { return r[ci.remise] > 0; }).length;
        a.rayons = cnt('rayon');
        a.topBaisses = rows.filter(function (r) { return r[ci.remise] > 0 && r[ci.tarif] > 0; }).sort(function (x, y) { return y[ci.remise] - x[ci.remise]; }).slice(0, 5)
          .map(function (r) { return [String(r[ci.libelle] || ''), r[ci.remise], eur(r[ci.tarif]) + ' → ' + eur(r[ci.prix]) + ' TTC', String(r[ci.ean13] || '')]; });
      } else if (k === 'etudes') {
        a.acteurs = cnt('acteur'); a.documents = cnt('document'); a.flux = cnt('flux');
        a.chiffres = rows.filter(function (r) { return (r[ci.taux] != null && r[ci.taux] !== '') || (r[ci.montant] != null && r[ci.montant] !== ''); }).length;
      }
    }
    AN[k] = a; return a;
  }
  function topN(m, n) { return Object.keys(m).sort(function (x, y) { return m[y] - m[x]; }).slice(0, n).map(function (x) { return [x, m[x]]; }); }

  // ── Cartouches ──────────────────────────────────────────────────────
  function cart(l, v, s, cls) {
    return '<div class="cc-c' + (cls ? ' ' + cls : '') + '"><div class="l">' + l + '</div><div class="v num">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
  }
  function cartouchesHtml(k) {
    var s = SRC[k], a = analyse(k), c = COURT[k], maj = dateFr(s.maj());
    if (s.net) {
      var t = a.communes, po = t ? Math.round(a.win / t * 100) : 0, pb = t ? Math.round(a.lose / t * 100) : 0, pe = t ? Math.max(0, 100 - po - pb) : 0;
      var barre = t ? '<div class="bar"><i class="ok" style="width:' + po + '%"></i><i class="bad" style="width:' + pb + '%"></i><i class="eq" style="width:' + pe + '%"></i></div>' : '';
      var sansNet = !t && !(window.PROD_STATS || []).length;
      return '<div class="cc-cart">' +
        cart('Références chez ' + esc(c), num(a.refs), 'relevé du ' + esc(maj)) +
        '<div class="cc-c"><div class="l">Aussi chez nous</div><div class="v num">' + (t ? num(t) : '—') + '</div>' + barre + '<div class="s">' + (sansNet ? 'notre net n\'est pas chargé' : 'hors génériques et biosimilaires' + (a.exclus ? ' (' + num(a.exclus) + ' écartés)' : '')) + '</div></div>' +
        cart('Intégral moins cher', t ? num(a.win) + '<small>' + po + ' %</small>' : '—', 'références gagnées', 'ok') +
        cart(esc(c) + ' moins cher', t ? num(a.lose) + '<small>' + pb + ' %</small>' : '—', 'références perdues', 'bad') +
        cart('Écart moyen sur les communes', a.ecart == null ? '—' : pct1(a.ecart, true), a.ecart == null ? 'aucune référence commune' : (a.ecart < 0 ? 'en notre faveur' : (a.ecart > 0 ? 'en notre défaveur' : 'à égalité')) + ', prix net à prix net', a.ecart == null ? '' : (a.ecart < 0 ? 'ok' : (a.ecart > 0 ? 'bad' : 'eq'))) +
      '</div>';
    }
    if (k === 'mc') {
      return '<div class="cc-cart four">' +
        cart('Références Marque Conseil', num(a.refs), 'relevé du ' + esc(maj)) +
        cart('Familles couvertes', num(Object.keys(a.familles).length), 'pansements, compression, orthèses, incontinence…') +
        cart('Avec tarif LPPR', num(a.lppr) + '<small>' + pct0(a.lppr, a.refs) + '</small>', 'dispositifs remboursables') +
        cart('Coefficient de marge max.', a.coefMax ? '× ' + String(a.coefMax).replace('.', ',') : '—', 'plafond le plus élevé des familles') +
      '</div>';
    }
    if (k === 'farmaline') {
      return '<div class="cc-cart four">' +
        cart('Prix publics relevés', num(a.refs), 'relevé du ' + esc(maj)) +
        cart('Connus de JARVIS', num(a.connus) + '<small>' + pct0(a.connus, a.refs) + '</small>', 'le reste : codes français hors catalogue') +
        cart('En stock chez Farmaline', num(a.stock) + '<small>' + pct0(a.stock, a.refs) + '</small>', 'au moment du relevé') +
        cart('Vendus sous le prix barré', num(a.baisses) + '<small>' + pct0(a.baisses, a.refs) + '</small>', 'prix consommateur, pas une condition d\'achat') +
      '</div>';
    }
    return '<div class="cc-cart four">' +
      cart('Observations', num(a.refs), 'relevé du ' + esc(maj)) +
      cart('Documents cités', num(Object.keys(a.documents).length), 'décisions, rapports, thèses, CGV, factures') +
      cart('Acteurs cités', num(Object.keys(a.acteurs).length), 'grossistes, laboratoires, groupements') +
      cart('Avec un chiffre d\'avantage', num(a.chiffres) + '<small>' + pct0(a.chiffres, a.refs) + '</small>', 'le reste décrit sans chiffrer') +
    '</div>';
  }

  // ── Nos points forts / leurs points forts ───────────────────────────
  // Clic sur une ligne = filtre du catalogue (chip si c'est la colonne des
  // chips, sinon la recherche).
  function fortLigne(k, col, val, sub, pctTxt, largeur, aff) {
    var s = SRC[k], fn = (col === s.chipCol) ? 'V2.ccChip' : 'V2.ccQ';
    return '<button type="button" class="cc-ray" onclick="' + fn + '(\'' + safeArg(val) + '\')"><span class="rn">' + esc(aff || val) + '<small class="num">' + sub + '</small></span>' +
      '<span class="rp num">' + pctTxt + '</span><span class="rb"><i style="width:' + Math.max(2, Math.min(100, largeur)) + '%"></i></span></button>';
  }
  function carteBloc(cls, titre, sub, lead, corps) {
    return '<div class="cc-card ' + cls + '"><h2>' + titre + ' <span class="sub">' + sub + '</span></h2>' + (lead ? '<p class="lead">' + lead + '</p>' : '') + (corps || '<p class="cc-vide">Rien à montrer pour l\'instant.</p>') + '</div>';
  }
  function fortsHtml(k) {
    var s = SRC[k], a = analyse(k), c = COURT[k];
    if (s.net) {
      var col = FORTS[k] || s.chipCol, lab = function (v) { return s.chipLabel[v] || v; };
      var gs = Object.keys(a.groupes).map(function (g) { return { g: g, o: a.groupes[g] }; }).filter(function (x) { return x.o.n >= 3; });
      var win = gs.filter(function (x) { return x.o.win > 0; }).sort(function (x, y) { return y.o.win / y.o.n - x.o.win / x.o.n || y.o.win - x.o.win; }).slice(0, 4);
      var lose = gs.filter(function (x) { return x.o.lose > 0; }).sort(function (x, y) { return y.o.lose / y.o.n - x.o.lose / x.o.n || y.o.lose - x.o.lose; }).slice(0, 4);
      var quoi = { gamme: 'gamme', section: 'offre', labo: 'laboratoire', famille: 'famille' }[col] || col;
      return '<div class="cc-forts">' +
        carteBloc('win', 'Nos points forts', 'où Intégral est le plus souvent moins cher', 'Part des références communes gagnées, par ' + quoi + ' (au moins 3 références communes).',
          win.map(function (x) { var p = Math.round(x.o.win / x.o.n * 100); return fortLigne(k, col, lab(x.g), num(x.o.n) + ' références communes', p + ' %', p); }).join('')) +
        carteBloc('lose', 'Leurs points forts', 'où ' + esc(c) + ' est le plus souvent moins cher', 'Part des références communes perdues, par ' + quoi + '.',
          lose.map(function (x) { var p = Math.round(x.o.lose / x.o.n * 100); return fortLigne(k, col, lab(x.g), num(x.o.n) + ' références communes', p + ' %', p); }).join('')) +
      '</div>';
    }
    if (k === 'mc') {
      var fam = topN(a.familles, 8), maxF = fam.length ? fam[0][1] : 1;
      return '<div class="cc-forts">' +
        carteBloc('neutre', 'Les familles', 'références par famille', '', fam.map(function (f) { return fortLigne(k, 'famille', f[0], '', num(f[1]), f[1] / maxF * 100); }).join('')) +
        carteBloc('neutre', 'Coefficient de marge maximal', 'plafond appliqué par famille', '', Object.keys(a.coefParFamille).sort(function (x, y) { return a.coefParFamille[y] - a.coefParFamille[x]; }).slice(0, 8)
          .map(function (f) { var cf = a.coefParFamille[f]; return fortLigne(k, 'famille', f, '', '× ' + String(cf).replace('.', ','), cf / (a.coefMax || 1) * 100); }).join('')) +
      '</div>';
    }
    if (k === 'farmaline') {
      var ray = topN(a.rayons, 6), maxR = ray.length ? ray[0][1] : 1, maxB = a.topBaisses.length ? a.topBaisses[0][1] : 1;
      return '<div class="cc-forts">' +
        carteBloc('neutre', 'Les rayons les plus relevés', 'références par rayon Farmaline', '', ray.map(function (r) { return fortLigne(k, 'rayon', r[0], '', num(r[1]), r[1] / maxR * 100); }).join('')) +
        carteBloc('lose', 'Où Farmaline vend le plus sous son prix barré', 'les cinq plus fortes baisses', 'Un prix consommateur reste un repère, pas une condition d\'achat.',
          a.topBaisses.map(function (b) { return '<button type="button" class="cc-ray" onclick="V2.ccOuvrir(\'' + safeArg(b[3]) + '\')"><span class="rn">' + esc(cap(b[0], 48)) + '<small class="num">' + esc(b[2]) + '</small></span><span class="rp num">−' + Math.round(b[1]) + ' %</span><span class="rb"><i style="width:' + Math.max(2, b[1] / maxB * 100) + '%"></i></span></button>'; }).join('')) +
      '</div>';
    }
    var flux = topN(a.flux, 8), maxX = flux.length ? flux[0][1] : 1, act = topN(a.acteurs, 8), maxA = act.length ? act[0][1] : 1;
    return '<div class="cc-forts">' +
      carteBloc('neutre', 'Qui donne à qui', 'observations par flux', '', flux.map(function (f) { return fortLigne(k, 'flux', f[0], '', num(f[1]), f[1] / maxX * 100, s.chipLabel[f[0]] || f[0]); }).join('')) +
      carteBloc('neutre', 'Les acteurs les plus cités', 'observations par acteur', '', act.map(function (f) { return fortLigne(k, 'acteur', f[0], '', num(f[1]), f[1] / maxA * 100); }).join('')) +
    '</div>';
  }

  // ── Le comptoir : chercher dans toutes les sources chargées ─────────
  // Une ligne par code 13, qui regroupe les sources où le code apparaît.
  // Les Études ne sont pas des produits : elles restent hors comptoir.
  var COMPTOIR = ['sagitta', 'ocp', 'mc', 'pharmazon', 'cooper', 'farmaline'];
  function condLigne(k, r, ci) {
    var s = SRC[k];
    if (k === 'sagitta') return (s.chipLabel[r[ci.cat]] || 'Catalogue') + (r[ci.remise] > 0 ? ' · abandon de marge ' + String(Math.round(r[ci.remise] * 10) / 10).replace('.', ',') + ' %' : '') + (r[ci.qtemin] > 1 ? ' · minimum ' + num(r[ci.qtemin]) : '');
    if (k === 'ocp') return (s.chipLabel[r[ci.section]] || 'Promo') + (r[ci.condition] ? ' · ' + cap(r[ci.condition], 44) : '') + (r[ci.paliers] ? ' · paliers ' + fmt(r[ci.paliers], 'paliers').replace(/<[^>]+>/g, '') : '');
    if (k === 'pharmazon') return 'Plateforme labos · prix négocié' + (r[ci.remise] > 0 ? ' · abandon de marge ' + String(Math.round(r[ci.remise] * 10) / 10).replace('.', ',') + ' %' : '');
    if (k === 'cooper') return 'Vente directe · tarif 2023' + (r[ci.division] ? ' · ' + r[ci.division] : '') + (r[ci.statut] ? ' · ' + r[ci.statut] : '');
    return '';
  }
  // Le produit complet derrière un code : toutes les sources chargées où il
  // apparaît, notre net, le classement des prix d'achat, les prix publics.
  function produit(code) {
    code = String(code || '');
    var rows = {}, n = nous(code);
    COMPTOIR.forEach(function (k) {
      if (!SRC[k].charge()) return;
      var l = index(k)[code]; if (l && l.length) rows[k] = l[0];
    });
    if (!n) COMPTOIR.some(function (k) {
      var r = rows[k]; if (!r) return false;
      var s = SRC[k], ci = colIdx(s);
      n = nous(r[ci[s.code]]) || (s.codeAlt ? nous(r[ci[s.codeAlt]]) : null);
      return !!n;
    });
    var ks = Object.keys(rows);
    if (!ks.length && !n) return null;
    var prem = ks.length ? rows[ks[0]] : null, cip0 = ks.length ? colIdx(SRC[ks[0]]) : null;
    var lib = (n && n.d) || (prem ? String(prem[cip0.libelle] || '') : ''), labo = '';
    ks.some(function (k) { var ci = colIdx(SRC[k]); var v = ci.labo != null ? prem && rows[k][ci.labo] : ''; if (v) { labo = String(v); return true; } return false; });
    var rangs = [];
    CLASSEMENT.forEach(function (k) {
      var r = rows[k]; if (!r) return;
      var s = SRC[k], ci = colIdx(s), net = r[ci[s.net]];
      if (net > 0) rangs.push({ k: k, nom: COURT[k], net: net, cond: condLigne(k, r, ci) });
    });
    var nb = rangs.length;
    if (n && n.ip > 0) rangs.push({ k: 'nous', nom: 'Intégral Pharma', net: n.ip, nous: true, cond: n.f === 'nr' ? 'Notre net · prix libre' : (n.remise > 0 ? 'Notre net · abandon de marge ' + String(n.remise).replace('.', ',') + ' %' : 'Notre net') });
    rangs.sort(function (a, b) { return a.net - b.net; });
    var p = { code: code, lib: lib, labo: labo, n: n, rangs: rangs, sources: ks, rang: 0, ecart: null, verdict: '', publics: [] };
    if (n && n.ip > 0) {
      p.rang = rangs.map(function (r) { return !!r.nous; }).indexOf(true) + 1;
      if (nb && !n.exclu) {
        var mc = Math.min.apply(null, rangs.filter(function (r) { return !r.nous; }).map(function (r) { return r.net; }));
        p.ecart = Math.round((mc - n.ip) * 100) / 100;   // > 0 : nous moins chers
        p.verdict = Math.abs(p.ecart) < 0.005 ? 'egal' : (p.ecart > 0 ? 'win' : 'lose');
      }
    }
    var ppht = (n && n.ppht) || (rows.ocp ? rows.ocp[colIdx(SRC.ocp).ppht] : null);
    if (ppht > 0) p.publics.push({ nom: 'PPHT', sub: 'prix public HT' + (n && n.d ? ' · ' + n.d : ''), val: eur(ppht) });
    if (rows.farmaline) { var cf = colIdx(SRC.farmaline), rf = rows.farmaline; if (rf[cf.prix] > 0) p.publics.push({ nom: 'Farmaline (BE) · prix consommateur', sub: (rf[cf.prix_ht] > 0 ? eur(rf[cf.prix_ht]) + ' HT' : '') + (rf[cf.tarif] > 0 ? ' · prix barré ' + eur(rf[cf.tarif]) : ''), val: eur(rf[cf.prix]) + ' TTC', lien: rf[cf.lien] }); }
    if (rows.mc) { var cm = colIdx(SRC.mc), rm = rows.mc; if (rm[cm.pvc_ttc] > 0) p.publics.push({ nom: 'OCP Marque Conseil · PVC', sub: 'prix public conseillé' + (rm[cm.tarif_lppr_ttc] > 0 ? ' · LPPR ' + eur(rm[cm.tarif_lppr_ttc]) : ''), val: eur(rm[cm.pvc_ttc]) + ' TTC' }); }
    p.famille = n ? (n.f === 'nr' ? 'Prix libre' : (n.f === 'gen' ? 'Générique' : (n.f === 'biosim' ? 'Biosimilaire' : 'Remboursable'))) : '';
    return p;
  }
  function chercher(q) {
    var t = norm(q.trim()); if (!t) return null;
    var mots = t.split(/\s+/), vus = {}, out = [];
    var ok = function (hay) { for (var i = 0; i < mots.length; i++) if (hay.indexOf(mots[i]) < 0) return false; return true; };
    COMPTOIR.forEach(function (k) {
      var s = SRC[k]; if (!s.charge()) return;
      var ci = colIdx(s), codeI = ci[s.code], altI = s.codeAlt ? ci[s.codeAlt] : -1, cols = s.cherche.map(function (c) { return ci[c]; });
      var rows = s.rows();
      for (var i = 0; i < rows.length && out.length < 400; i++) {
        var r = rows[i], hay = '';
        for (var j = 0; j < cols.length; j++) { var v = r[cols[j]]; if (v != null && v !== '') hay += ' ' + v; }
        var n = nous(r[codeI]) || (altI >= 0 ? nous(r[altI]) : null);
        if (n) hay += ' ' + n.d + ' ' + n.c;
        if (!ok(norm(hay))) continue;
        var key = n ? n.c : String(r[codeI] || r[altI] || '');
        if (!key || vus[key]) continue;
        vus[key] = 1; out.push(key);
      }
    });
    return out.map(produit).filter(Boolean).sort(function (a, b) { return (b.rangs.length - a.rangs.length) || ((b.n && b.n.ip > 0) - (a.n && a.n.ip > 0)) || a.lib.localeCompare(b.lib, 'fr'); }).slice(0, 40);
  }
  function posTxt(p) {
    if (!p.n || !(p.n.ip > 0)) return 'notre net inconnu';
    if (p.n.exclu) return 'hors verdict';
    if (!p.verdict) return 'aucun prix d\'achat concurrent';
    if (p.verdict === 'egal') return 'même prix';
    if (p.verdict === 'win') return '1er sur ' + p.rangs.length + ' · ' + eur(p.ecart) + ' de moins';
    return (p.rang === 1 ? '1er' : p.rang + 'e') + ' sur ' + p.rangs.length + ' · ' + eur(-p.ecart) + ' de plus';
  }
  function resLigne(p) {
    return '<button type="button" class="cc-res' + (S.carte === p.code ? ' on' : '') + '" onclick="V2.ccOuvrir(\'' + safeArg(p.code) + '\')">' +
      '<span class="nom">' + esc(p.lib) + '</span>' +
      '<span class="meta"><span>' + esc(labo0(p)) + '</span><span class="num">' + esc(p.code) + '</span><span>' + p.sources.map(function (k) { return esc(COURT[k]); }).join(' · ') + '</span></span>' +
      '<span class="prix num">' + (p.n && p.n.ip > 0 ? eur(p.n.ip) : '—') + '</span>' +
      '<span class="pos ' + (p.verdict || 'eq') + '">' + esc(posTxt(p)) + '</span></button>';
  }
  function labo0(p) { return p.labo || ''; }
  // Sources pas encore là : on propose de les charger, une par une, avec leur poids.
  function chargeursHtml() {
    var manque = COMPTOIR.filter(function (k) { return !SRC[k].charge() && k !== 'mc'; });
    if (!manque.length) return '';
    return '<div class="cc-chargeurs"><span>Chercher aussi dans</span>' + manque.map(function (k) {
      if (loading[k] || (k === 'pharmazon' && pzLoading)) return '<span class="cc-charg on" aria-busy="true">' + esc(COURT[k]) + ' — chargement…</span>';
      if (echec(k)) return '<button type="button" class="cc-charg" onclick="V2.ccRetry(\'' + k + '\')">' + ICO('back', 14, 2) + ' Réessayer ' + esc(COURT[k]) + '</button>';
      return '<button type="button" class="cc-charg" onclick="V2.ccCharger(\'' + k + '\')">' + ICO('download', 14, 2) + ' Charger ' + esc(COURT[k]) + ' (' + POIDS[k] + ')</button>';
    }).join('') + '</div>';
  }
  function resultatsHtml() {
    var q = S.cq, res = chercher(q);
    var pretes = COMPTOIR.filter(function (k) { return SRC[k].charge(); });
    if (res === null) {
      return '<div class="cc-legende">' + (pretes.length ? 'Sources prêtes : ' + pretes.map(function (k) { return '<b>' + esc(COURT[k]) + '</b>'; }).join(', ') + '.' : 'Aucune source chargée pour l\'instant : le comptoir n\'en télécharge aucune sans qu\'on le lui demande.') + ' Le classement ne compare que des prix d\'achat ; les prix publics (Farmaline, PPHT, Marque Conseil) restent en repère sous la carte.</div>' + chargeursHtml();
    }
    if (!res.length) return '<div class="cc-vide">Aucun produit pour « ' + esc(q) + ' » dans ' + (pretes.length ? pretes.map(function (k) { return COURT[k]; }).join(', ') : 'les sources chargées (aucune)') + '.</div>' + chargeursHtml();
    return '<h2 class="cc-res-h"><span>' + res.length + '</span> produit' + (res.length > 1 ? 's' : '') + ' pour « ' + esc(q) + ' »' + (res.length >= 40 ? ' · les 40 premiers' : '') + '</h2>' + res.map(resLigne).join('') + chargeursHtml();
  }

  // ── La carte produit ────────────────────────────────────────────────
  function rangHtml(t, i, p) {
    var ec = '';
    if (t.nous) {
      ec = p.verdict ? '<span class="ecart ' + p.verdict + '">' + (p.verdict === 'egal' ? 'au même prix' : (p.verdict === 'win' ? eur(p.ecart) + ' d\'avance sur le 2e' : '+' + eur(-p.ecart) + ' sur le 1er')) + '</span>' : (p.n && p.n.exclu ? '<span class="ecart">hors verdict</span>' : '');
    } else if (p.n && p.n.ip > 0 && !p.n.exclu) {
      var d = Math.round((t.net - p.n.ip) * 100) / 100;
      ec = '<span class="ecart">' + (Math.abs(d) < 0.005 ? 'même prix' : (d > 0 ? '+' : '−') + eur(Math.abs(d)) + ' face à nous') + '</span>';
    }
    var pt = (p.n && p.n.ip > 0 && !p.n.exclu && !t.nous) ? '<i class="pt ' + (t.net < p.n.ip ? 'bad' : (t.net > p.n.ip ? 'ok' : 'eq')) + '"></i>' : '';
    return '<div class="cc-rang' + (t.nous ? ' nous' : '') + '"><span class="n num">' + (i + 1) + '</span><span class="qui">' + pt + esc(t.nom) + '</span><span class="cond">' + esc(t.cond) + '</span><span class="val num">' + eur(t.net) + '</span>' + ec + '</div>';
  }
  function carteHtml(p) {
    var n = p.n, ip = n && n.ip > 0 ? n.ip : null;
    var posV = !ip ? '—' : (n.exclu ? 'hors verdict' : (!p.verdict ? '—' : (p.verdict === 'egal' ? 'Égal' : (p.rang === 1 ? '1er' : p.rang + 'e') + ' / ' + p.rangs.length)));
    var devant = p.rang - 1;
    var posS = !ip ? 'notre net inconnu' : (n.exclu ? 'générique ou biosimilaire' : (!p.verdict ? 'aucun prix d\'achat concurrent' : (p.verdict === 'egal' ? 'Même prix' : (p.verdict === 'win' ? 'Les moins chers' : (devant > 1 ? devant + ' concurrents devant' : 'Un concurrent devant')))));
    var ecV = p.ecart == null ? '—' : (p.ecart > 0 ? '−' : (p.ecart < 0 ? '+' : '')) + eur(Math.abs(p.ecart));
    var ecS = p.ecart == null ? '' : (p.ecart >= 0 ? 'sous le meilleur concurrent' : 'au-dessus du moins cher');
    var nbAchat = p.rangs.length;
    var pub = p.publics.length ? '<div class="cc-public"><h3>Prix public, hors classement</h3>' + p.publics.map(function (x) {
      return '<div class="ligne"><span>' + esc(x.nom) + '<small>' + esc(x.sub) + (x.lien && /^https?:\/\//.test(x.lien) ? (x.sub ? ' · ' : '') + '<a href="' + esc(x.lien) + '" target="_blank" rel="noopener">voir la fiche</a>' : '') + '</small></span><b class="num">' + esc(x.val) + '</b></div>';
    }).join('') + '</div>' : '';
    var dans = p.sources.length ? p.sources.map(function (k) { return COURT[k]; }).join(' · ') : 'aucune source chargée';
    return '<article class="cc-carte">' +
      '<div class="ct"><div class="sur">' + (p.famille ? '<span class="tag">' + esc(p.famille) + '</span>' : '') + '<span class="num">Code ' + esc(p.code) + '</span><span>' + esc(dans) + '</span></div>' +
      '<h2>' + esc(p.lib || 'Produit ' + p.code) + '</h2>' + (p.labo ? '<div class="labo">' + esc(p.labo) + '</div>' : '') +
      '<div class="cc-chiffres"><div><small>Notre net</small><b class="num">' + (ip ? eur(ip) : '—') + '</b><i>' + (ip ? (n.f === 'nr' ? 'prix libre' : (n.remise > 0 && !n.exclu ? 'abandon de marge ' + String(n.remise).replace('.', ',') + ' %' : (n.exclu ? 'hors verdict' : 'prix net'))) : 'pas chez nous') + '</i></div>' +
      '<div><small>Position</small><b class="' + (p.verdict || 'eq') + '">' + posV + '</b><i>' + posS + '</i></div>' +
      '<div><small>Écart</small><b class="num ' + (p.verdict || 'eq') + '">' + ecV + '</b><i>' + ecS + '</i></div></div></div>' +
      (nbAchat ? '<div class="cc-classement"><h3>Du moins cher au plus cher · ' + nbAchat + ' prix d\'achat</h3>' + p.rangs.map(function (t, i) { return rangHtml(t, i, p); }).join('') + '</div>' : '<div class="cc-classement"><p class="cc-vide">Aucun prix d\'achat pour ce code dans les sources chargées.</p>' + chargeursHtml() + '</div>') +
      pub +
      (ip ? '<div class="cc-geste"><button type="button" class="cc-btn prim" onclick="V2.ccFace(true)">' + ICO('pharma', 20, 2) + 'Montrer au pharmacien</button><p>Plein écran : le produit et notre prix, sans les concurrents. « Retourner l\'écran » tourne l\'affichage de 180° pour lire de l\'autre côté du comptoir.</p></div>' : '') +
    '</article>';
  }
  // Icône « retourner » (deux flèches en cercle) : absente du jeu d'icônes de l'app.
  var ROTATE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>';
  function faceHtml(p) {
    var n = p.n, ip = n.ip;
    // Montant d'un seul tenant : une seule taille, chiffres tabulaires ; le € à 70 % sur la même ligne de base.
    var gros = esc(ip.toFixed(2).replace('.', ',')) + '<span class="eur">€</span>';
    return '<div class="cc-face-lum"></div>' +
      '<div class="cc-face-haut"><button type="button" class="cc-btn sec" onclick="V2.ccFace(false)">' + ICO('close', 20, 2.2) + 'Fermer</button><button type="button" class="cc-btn sec" onclick="V2.ccTourner()">' + ROTATE + 'Retourner l\'écran</button></div>' +
      '<div class="cc-face-corps"><div class="qui">Intégral Pharma · notre prix net</div><h2>' + esc(p.lib || 'Produit ' + p.code) + '</h2><div class="lab">' + esc(p.labo ? p.labo + ' · ' : '') + 'Code ' + esc(p.code) + '</div>' +
      '<div class="prix"><small>Prix net HT, l\'unité</small><b class="num">' + gros + '</b><div class="bas">' + (n.ppht ? '<div><small>PPHT</small><b class="num">' + eur(n.ppht) + '</b></div>' : '') + (p.famille ? '<div><small>Famille</small><b>' + esc(p.famille) + '</b></div>' : '') + '</div></div></div>' +
      '<div class="cc-face-pied">Intégral Pharma · groupe de grossistes-répartiteurs · prix net HT, hors TVA</div>';
  }
  function overHtml() {
    if (!S.carte) return '';
    var p = produit(S.carte); if (!p) return '';
    var h = '<div class="cc-veil" onclick="V2.ccFermer()"></div><aside class="cc-panel" role="dialog" aria-label="Tous les prix du produit">' +
      '<div class="cc-panel-top"><button type="button" class="cc-retour" onclick="V2.ccFermer()">' + ICO('back', 18, 2.4) + (phone() ? 'Retour' : 'Fermer') + '</button></div>' + carteHtml(p) + '</aside>';
    if (S.face && p.n && p.n.ip > 0) h += '<div class="cc-face on' + (S.tourne ? ' tourne' : '') + '" role="dialog" aria-modal="true" aria-label="Prix Intégral, face au pharmacien">' + faceHtml(p) + '</div>';
    return h;
  }

  // ── Rendu : tableau d'une source (le catalogue) ─────────────────────
  function tableHtml(s) {
    var ci = colIdx(s), data = filtre(s), shown = data.slice(0, LIMIT);
    var codeI = ci[s.code], codeAltI = s.codeAlt ? ci[s.codeAlt] : -1, netI = s.net ? ci[s.net] : -1;
    var avecNous = netI >= 0 && (window.PROD_STATS || []).length > 0;
    var produitOuvrable = s.code && S.src !== 'etudes';
    var head = s.affiche.map(function (c) {
      var on = S.sort === c[0];
      return '<th class="' + (c[2] ? 'num' : '') + (on ? ' on' : '') + '" onclick="V2.ccSort(\'' + c[0] + '\')">' + esc(c[1]) + (on ? (S.desc ? ' ↓' : ' ↑') : '') + '</th>';
    }).join('') + (avecNous ? '<th class="num">Notre net</th><th>Verdict</th>' : '');
    var g = 0, l = 0, e = 0, cmp = 0;
    var body = shown.map(function (r) {
      var n = avecNous ? (nous(r[codeI]) || (codeAltI >= 0 ? nous(r[codeAltI]) : null)) : null;
      var v = n ? verdict(r[netI], n) : '';
      var tds = s.affiche.map(function (c) {
        var val = r[ci[c[0]]];
        var cls = (c[2] ? 'num mono' : '') + (c[0] === 'libelle' ? ' cc-name' : '') + (LONG[c[0]] && c[0] !== 'libelle' ? ' cc-long' : '') + (c[0] === s.code || c[0] === s.codeAlt ? ' mono cc-code' : '');
        return '<td class="' + cls + '" data-label="' + esc(c[1]) + '"' + (LONG[c[0]] ? ' title="' + esc(val) + '"' : '') + '>' + (LONG[c[0]] ? esc(cap(val)) : fmt(val, c[2])) + '</td>';
      }).join('');
      if (avecNous) {
        tds += '<td class="num mono" data-label="Notre net">' + (n && n.ip > 0 ? eur(n.ip) : '<span class="cc-mute">—</span>') + '</td>' +
          '<td data-label="Verdict">' + (v ? '<span class="cc-v ' + v + '">' + (v === 'win' ? 'Intégral moins cher' : v === 'lose' ? s.nom.split(' ·')[0] + ' moins cher' : 'Même prix') + '</span>' : (n && n.exclu ? '<span class="cc-mute" title="Générique ou biosimilaire : remises en direct labo, pas comparables">hors verdict</span>' : '')) + '</td>';
      }
      var code = String(r[codeI] || (codeAltI >= 0 ? r[codeAltI] : '') || '');
      var ouvre = produitOuvrable && code ? ' data-code="' + esc(code) + '" onclick="V2.ccOuvrir(\'' + safeArg(code) + '\')" title="Tous les prix de ce produit"' : '';
      return '<tr class="' + (v ? 'cc-' + v : '') + (ouvre ? ' cc-p' : '') + '"' + ouvre + '>' + tds + '</tr>';
    }).join('');
    // bilan sur TOUTE la sélection filtrée, pas seulement les lignes affichées
    if (avecNous) data.forEach(function (r) {
      var n = nous(r[codeI]) || (codeAltI >= 0 ? nous(r[codeAltI]) : null);
      var v = n ? verdict(r[netI], n) : '';
      if (v) { cmp++; if (v === 'win') g++; else if (v === 'lose') l++; else e++; }
    });
    if (!shown.length) body = '<tr><td colspan="' + (s.affiche.length + 2) + '" style="padding:26px;text-align:center;color:var(--muted)">Aucune ' + (s.unite || 'référence') + ' ne correspond.</td></tr>';
    if (data.length > LIMIT) body += '<tr class="cc-more"><td colspan="' + (s.affiche.length + 2) + '">' + LIMIT + ' lignes affichées sur ' + num(data.length) + ' — affinez la recherche pour voir les autres.</td></tr>';
    var bilan = avecNous && cmp ? '<div class="cc-bilan"><b>' + num(cmp) + '</b> références aussi chez nous · <span class="win">' + num(g) + ' où Intégral est moins cher</span> · <span class="lose">' + num(l) + ' où ' + esc(s.nom.split(' ·')[0]) + ' est moins cher</span> · ' + num(e) + ' au même prix · hors génériques et biosimilaires</div>' : '';
    return bilan +
      '<div class="cc-count">' + num(data.length) + ' ' + (s.unite || 'référence') + (data.length > 1 ? 's' : '') + (produitOuvrable ? ' · une ligne s\'ouvre en carte « tous les prix »' : '') + '</div>' +
      '<div class="cc-tablewrap"><table class="v2-table cc-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  // ── Rendu : onglets, liens, comptoir, fiche ─────────────────────────
  function tabsHtml(k) {
    return '<nav class="cc-tabs" role="tablist" aria-label="Concurrents" data-scroll-x>' + ORDRE.map(function (x) {
      var s = SRC[x], ok = s.charge();
      return '<button type="button" class="cc-tab" role="tab" aria-selected="' + (x === k) + '" onclick="V2.go(\'concurrents\',\'' + x + '\')"><span class="n">' + esc(COURT[x]) + '</span><span class="r num">' + (ok ? num(s.rows().length) + ' ' + (s.unite ? s.unite + 's' : 'réf.') : (echec(x) ? 'non chargé' : POIDS[x] + ' à charger')) + '</span></button>';
    }).join('') + '</nav>';
  }
  function liensHtml() {
    var l = [];
    if (V2.pages.grossistes) l.push('<button type="button" class="cc-lien" onclick="V2.go(\'grossistes\')">' + ICO('grid', 14, 2) + 'Panorama des 93 grossistes-répartiteurs</button>');
    if (V2.pages.offilog) l.push('<button type="button" class="cc-lien" onclick="V2.go(\'offilog\')">' + ICO('froid', 14, 2) + 'Offilog face aux concurrents</button>');
    return l.length ? '<div class="cc-liens">' + l.join('') + '</div>' : '';
  }
  function comptoirBar(geant) {
    return '<div class="cc-cbar' + (geant ? ' geant' : '') + (S.cq ? ' plein' : '') + '">' + ICO('search', geant ? 22 : 18, 2.2) +
      '<input id="cc-cq" type="search" inputmode="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="' + (geant ? 'Produit, laboratoire ou code' : 'Un produit, tous les prix — nom, laboratoire ou code') + '" value="' + esc(S.cq) + '" oninput="V2.ccCq(this.value)" onfocus="V2.ccCqFocus()" aria-label="Chercher un produit dans toutes les sources">' +
      (geant ? '<button type="button" class="vider" onclick="V2.ccCq(\'\', true)" aria-label="Effacer la recherche">Effacer</button>' : '<kbd>' + (navigator.platform && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl+') + 'K</kbd>') +
    '</div>';
  }
  function kickerHtml() {
    return '<div class="cc-kicker"><span class="cc-kicker-t">Ressources concurrents</span><span class="cc-kicker-s">Conditions de tiers : réservé à l\'interne Intégral, jamais dans un document remis à une officine.</span></div>';
  }
  function ficheHtml(k) {
    var s = SRC[k];
    var entete = '<div class="cc-head"><div><span class="cc-eyebrow"><i class="dot"></i>' + esc(s.tag) + '</span><h1 class="v2-page-title">' + esc(s.nom) + '</h1>' +
      '<p class="v2-page-sub">' + esc(s.quoi) + '</p></div>' +
      '<div class="cc-meta"><span>Circuit <b>' + esc(CIRCUIT[k]) + '</b></span>' + (s.charge() ? '<span>Relevé du <b class="num">' + esc(dateFr(s.maj())) + '</b></span><span><b class="num">' + num(s.rows().length) + '</b> ' + (s.unite || 'référence') + 's</span>' : '') + '</div></div>';
    if (!s.charge()) {
      if (echec(k)) {
        return entete + '<div class="v2-empty"><div class="v2-empty-ico">' + ICO('alert', 64, 1.4) + '</div>' +
          '<div class="v2-empty-t">Données protégées non chargées</div>' +
          '<div class="v2-empty-d">Ce catalogue vit dans l\'espace protégé : il faut être connecté et en ligne. Réessayez dans un instant.</div>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.ccRetry(\'' + k + '\')">' + ICO('back', 16, 2) + ' Réessayer</button></div>';
      }
      return entete + '<div class="cc-sk" aria-busy="true"><div class="cc-sk-l" style="width:38%"></div><div class="cc-sk-l" style="width:92%"></div><div class="cc-sk-l" style="width:84%"></div><div class="cc-sk-l" style="width:88%"></div><div class="cc-sk-l" style="width:70%"></div></div>';
    }
    return '<section class="cc-fiche">' + entete + cartouchesHtml(k) + fortsHtml(k) +
      '<div class="cc-catalog"><div class="cc-cat-head"><h2>' + (k === 'etudes' ? 'Les observations' : 'Le catalogue ' + esc(COURT[k])) + '</h2></div>' +
      '<div class="cc-tools"><div class="cc-search">' + ICO('search', 15, 2) + '<input id="cc-q" type="search" placeholder="' + esc(s.placeholder || 'Produit, laboratoire, code…') + '" value="' + esc(S.q) + '" oninput="V2.ccQ(this.value, true)" autocomplete="off"></div>' +
      (S.q || S.chip ? '<button type="button" class="cc-lien" onclick="V2.ccReset()">' + ICO('close', 14, 2) + 'Tout afficher</button>' : '') + '</div>' +
      chips(s) + '<div id="cc-body">' + tableHtml(s) + '</div></div></section>';
  }
  function comptoirHtml() {
    return '<section class="cc-comptoir"><h1 class="v2-page-title">Le comptoir</h1><p class="v2-page-sub">Un nom, un code — et le prix de chacun, à côté du nôtre.</p>' +
      comptoirBar(true) +
      '<div class="cc-puces" data-scroll-x>' + ORDRE.map(function (x) {
        var s = SRC[x], ok = s.charge();
        return '<button type="button" class="cc-puce" onclick="V2.go(\'concurrents\',\'' + x + '\')"><b>' + esc(COURT[x]) + '</b> <i>' + (ok ? num(s.rows().length) : POIDS[x]) + '</i></button>';
      }).join('') + '</div>' +
      '<div id="cc-cres" class="cc-cres">' + resultatsHtml() + '</div></section>';
  }

  // ── Actions ──────────────────────────────────────────────────────────
  var qTimer = null, cqTimer = null;
  V2.ccQ = function (v, depuisInput) { S.q = v; if (!depuisInput) { V2.render(); return; } clearTimeout(qTimer); qTimer = setTimeout(rerender, 160); };
  V2.ccChip = function (k) { S.chip = (S.chip === k) ? '' : k; V2.render(); };
  V2.ccReset = function () { S.q = ''; S.chip = ''; V2.render(); };
  V2.ccSort = function (k) { if (S.sort === k) { if (S.desc) { S.sort = ''; S.desc = false; } else S.desc = true; } else { S.sort = k; S.desc = false; } rerender(); };
  V2.ccRetry = function (k) {
    SRC[k].cles.forEach(function (c) { delete V2.protegeEchec[c]; delete tried[c]; });
    delete tried[SRC[k].cles.join('+')]; delete V2.protegeEchec.pharmazon;
    if (S.src !== k) V2.ccCharger(k); else V2.render();
  };
  V2.ccCharger = function (k) {
    if (SANS || !SRC[k] || SRC[k].charge()) return;
    loading[k] = true; rerenderRes();
    charger(k, function () { loading[k] = false; if (V2.route && V2.route.name === 'concurrents') V2.render(); });
  };
  V2.ccCq = function (v, focus) {
    S.cq = v; S.cqOpen = true; clearTimeout(cqTimer);
    cqTimer = setTimeout(rerenderRes, 160);
    if (focus) { var i = document.getElementById('cc-cq'); if (i) { i.value = ''; i.focus(); } }
  };
  V2.ccCqFocus = function () { S.cqOpen = true; rerenderRes(); };
  V2.ccOuvrir = function (code) {
    S.carte = String(code); S.face = false; S.tourne = false; S.cqOpen = false;
    rerenderOver(); rerenderRes();
  };
  V2.ccFermer = function () { S.carte = null; S.face = false; S.tourne = false; rerenderOver(); rerenderRes(); };
  V2.ccFace = function (on) { S.face = !!on; S.tourne = false; rerenderOver(); };
  V2.ccTourner = function () { S.tourne = !S.tourne; var f = document.querySelector('.cc-face'); if (f) f.classList.toggle('tourne', S.tourne); };
  function rerender() {
    var b = document.getElementById('cc-body');
    if (b && S.src && SRC[S.src]) b.innerHTML = tableHtml(SRC[S.src]); else V2.render();
  }
  function rerenderRes() {
    var r = document.getElementById('cc-cres'); if (!r) return;
    var geant = !!r.closest('.cc-comptoir');
    if (geant) { r.innerHTML = resultatsHtml(); return; }
    // ordinateur : liste déroulante sous la barre, seulement quand on cherche
    var ouvert = S.cqOpen && S.cq.trim();
    r.classList.toggle('open', !!ouvert);
    r.innerHTML = ouvert ? resultatsHtml() : '';
  }
  // La carte et le plein écran vivent HORS de #v2-root : un ancêtre animé
  // (transform de la transition de vue) ferait de « fixed » un simple
  // « absolute » dans la page — constaté sous WebKit : panneau de 13 000 px.
  function overHost() {
    var o = document.getElementById('cc-over');
    if (!o) { o = document.createElement('div'); o.id = 'cc-over'; document.body.appendChild(o); }
    return o;
  }
  function rerenderOver() {
    var o = overHost();
    o.innerHTML = overHtml();
    var ouvert = !!S.carte && (phone() || S.face);
    document.documentElement.classList.toggle('cc-lock', ouvert);
  }
  function fermerTout() { S.carte = null; S.face = false; S.tourne = false; S.cqOpen = false; document.documentElement.classList.remove('cc-lock'); var o = document.getElementById('cc-over'); if (o) o.innerHTML = ''; }
  // Clavier : Échap ferme (plein écran, puis carte, puis liste) ; ⌘K sur cet
  // écran va au comptoir (sur la fenêtre, en capture : avant le raccourci global).
  window.addEventListener('keydown', function (e) {
    if (!(V2.route && V2.route.name === 'concurrents') || SANS) return;
    if (e.key === 'Escape') {
      if (S.face) { V2.ccFace(false); e.stopPropagation(); return; }
      if (S.carte) { V2.ccFermer(); e.stopPropagation(); return; }
      if (S.cqOpen) { S.cqOpen = false; rerenderRes(); }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && !phone()) {
      var i = document.getElementById('cc-cq');
      if (i) { e.preventDefault(); e.stopPropagation(); i.focus(); i.select(); S.cqOpen = true; rerenderRes(); }
    }
  }, true);
  document.addEventListener('click', function (e) {
    if (!S.cqOpen || phone()) return;
    if (e.target.closest && (e.target.closest('.cc-cbar') || e.target.closest('#cc-cres'))) return;
    S.cqOpen = false; rerenderRes();
  });
  window.addEventListener('hashchange', function () { if (!/^#concurrents(\/|$)/.test(location.hash || '')) fermerTout(); });
  var rsTimer = null, dernierMode = null;
  window.addEventListener('resize', function () {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { var m = phone(); if (dernierMode !== null && m !== dernierMode && V2.route && V2.route.name === 'concurrents') V2.render(); dernierMode = m; }, 200);
  });

  // ── PAGE ─────────────────────────────────────────────────────────────
  V2.pages.concurrents = {
    render: function (root, param) {
      injectCss();
      var tel = phone(); dernierMode = tel;
      // Ordinateur : la fiche du premier concurrent d'office. Téléphone : le comptoir.
      var src = (param && SRC[param]) ? param : (tel ? '' : ORDRE[0]);
      if (src !== S.src) { S.src = src; S.q = ''; S.chip = ''; S.sort = ''; S.desc = false; }
      fermerTout();
      var corps = src ? (tel ? tabsHtml(src) + liensHtml() + ficheHtml(src) : tabsHtml(src) + liensHtml() + '<div class="cc-cbar-holder">' + comptoirBar(false) + '<div id="cc-cres" class="cc-cres"></div></div>' + ficheHtml(src)) : comptoirHtml();
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap cc-wrap' + (tel ? ' tel' : '') + '">' + kickerHtml() + corps + '</div>';
      if (SANS) return;
      // Données absentes → on les demande, et on re-rend à l'arrivée. JAMAIS
      // quand elles sont déjà là : le rappel relancerait le rendu, qui
      // relancerait le rappel… (récursion infinie constatée au 1er test WebKit).
      // Sur le comptoir, rien n'est téléchargé d'office (2 Mo pour Sagitta).
      if (src && !SRC[src].charge()) {
        charger(src, function () { if (V2.route && V2.route.name === 'concurrents') V2.render(); });
      }
      var q = document.getElementById('cc-q');
      if (q && S.q) { try { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} }
    }
  };

  // ── CSS (peau Verrière : lumière d'en haut, cartes éclairées, UN accent) ──
  function injectCss() {
    if (document.getElementById('v2-concurrents-css')) return;
    var s = document.createElement('style'); s.id = 'v2-concurrents-css';
    s.textContent = [
      '.cc-wrap{max-width:1180px}',
      '.cc-wrap .num{font-variant-numeric:tabular-nums}',
      '.cc-kicker{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;margin-bottom:14px}',
      '.cc-kicker-t{font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-blue-d)}',
      '.cc-kicker-s{font-size:13px;color:var(--muted)}',
      /* onglets */
      '.cc-tabs{display:flex;gap:6px;padding:6px;margin:0 0 10px;border-radius:var(--r-md);background:#F3F6FB;border:1px solid var(--line);box-shadow:var(--sh-1);overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}',
      '.cc-tabs::-webkit-scrollbar{display:none}',
      '.cc-tab{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-start;gap:1px;min-height:48px;padding:7px 14px;border:0;border-radius:var(--r-control);background:none;font:inherit;color:var(--muted);text-align:left;white-space:nowrap;cursor:pointer;transition:background .18s var(--ease-soft),color .18s var(--ease-soft),box-shadow .18s var(--ease)}',
      '.cc-tab .n{font-size:13.5px;font-weight:700;color:var(--ip-ink-2)}.cc-tab .r{font-size:13px;font-weight:500;color:var(--muted)}',
      '.cc-tab:hover{background:rgba(255,255,255,.8)}',
      '.cc-tab[aria-selected="true"]{background:var(--card);box-shadow:var(--sh-2)}.cc-tab[aria-selected="true"] .n{color:var(--ip-blue)}.cc-tab[aria-selected="true"] .r{color:var(--ip-blue-d)}',
      '.cc-liens{display:flex;gap:6px 14px;flex-wrap:wrap;margin:0 0 16px 4px}',
      '.cc-lien{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 6px;border:0;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--ip-blue);cursor:pointer;border-radius:8px}.cc-lien:hover{text-decoration:underline}',
      /* comptoir */
      '.cc-cbar{position:relative;display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:0 12px 0 16px;min-height:52px;box-shadow:var(--sh-2);color:var(--ip-blue);margin-bottom:6px;transition:box-shadow .3s var(--ease-soft),border-color .3s var(--ease-soft)}',
      '.cc-cbar:focus-within{border-color:rgba(0,80,230,.35);box-shadow:var(--sh-2),0 0 0 3px rgba(0,80,230,.12)}',
      '.cc-cbar input{flex:1;min-width:0;border:0;outline:0;background:none;min-height:44px;font:inherit;font-size:16px;font-weight:500;color:var(--ip-ink)}',
      /* UN seul anneau de focus, porté par le conteneur : la règle globale :focus-visible de v2.css pose sinon un second anneau sur le champ lui-même */
      '.cc-cbar input:focus,.cc-cbar input:focus-visible,.cc-search input:focus,.cc-search input:focus-visible{outline:none !important;box-shadow:none !important;border:0 !important;background:transparent !important}',
      '.cc-cbar input::placeholder{color:var(--muted-2)}',
      '.cc-cbar input::-webkit-search-cancel-button,.cc-cbar input::-webkit-search-decoration{-webkit-appearance:none;display:none}',
      '.cc-cbar kbd{font-family:var(--mono);font-size:12px;background:#F1F3F8;padding:3px 7px;border-radius:6px;color:var(--ip-ink-2)}',
      '.cc-cbar.geant{min-height:64px;border-radius:18px;padding:0 8px 0 18px}.cc-cbar.geant input{font-size:19px;font-weight:600;min-height:56px}',
      '.cc-cbar .vider{display:none;min-width:48px;min-height:48px;border:0;background:none;font:inherit;font-size:14px;font-weight:700;color:var(--muted);border-radius:12px;cursor:pointer}.cc-cbar.plein .vider{display:inline-flex;align-items:center;justify-content:center}',
      '.cc-cres{position:relative}',
      '.cc-wrap:not(.tel) .cc-cres{position:absolute;left:0;right:0;z-index:35;display:none;margin-top:-2px;padding:10px;background:var(--card);border:1px solid rgba(11,31,77,.10);border-radius:var(--r-md);box-shadow:var(--sh-3);max-height:min(62vh,640px);overflow:auto}',
      '.cc-wrap:not(.tel) .cc-cres.open{display:block;animation:cc-arrive .28s var(--ease) both}',
      '.cc-wrap:not(.tel) .cc-tabs,.cc-wrap:not(.tel) .cc-liens,.cc-wrap:not(.tel) .cc-cbar{position:relative;z-index:1}',
      '.cc-wrap:not(.tel) .cc-fiche{position:relative}',
      '.cc-cbar-holder{position:relative}',
      '.cc-res-h{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:6px 4px 8px}.cc-res-h span{color:var(--ip-blue-d)}',
      '.cc-res{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 14px;align-items:center;text-align:left;width:100%;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;min-height:64px;box-shadow:var(--sh-1);font:inherit;color:inherit;cursor:pointer;margin-bottom:8px;transition:transform .3s var(--ease),box-shadow .3s var(--ease),border-color .3s var(--ease-soft)}',
      '.cc-res:hover{transform:translateY(-2px);box-shadow:var(--sh-2);border-color:rgba(0,80,230,.22)}.cc-res.on{border-color:rgba(0,80,230,.35);box-shadow:var(--sh-2),0 0 0 3px rgba(0,80,230,.10)}',
      '.cc-res .nom{grid-column:1;font-size:15px;font-weight:700;color:var(--ip-ink);letter-spacing:-.01em;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.cc-res .meta{grid-column:1;font-size:13px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap}',
      '.cc-res .prix{grid-column:2;grid-row:1;font-size:18px;font-weight:800;color:var(--titre,#0B1F4D);letter-spacing:-.02em;white-space:nowrap}',
      '.cc-res .pos{grid-column:2;grid-row:2;font-size:13px;font-weight:700;white-space:nowrap;text-align:right}',
      '.cc-res .pos.win,.cc-rang .ecart.win,.cc-chiffres b.win{color:#10915E}.cc-res .pos.lose,.cc-rang .ecart.lose,.cc-chiffres b.lose{color:#C8385A}.cc-res .pos.eq,.cc-res .pos.egal,.cc-rang .ecart.egal,.cc-chiffres b.eq,.cc-chiffres b.egal{color:var(--muted)}',
      '.cc-legende,.cc-vide{padding:14px 16px;color:var(--muted);font-size:13.5px;line-height:1.5;background:var(--surf-sunken,#F4F6FB);border-radius:14px;margin-bottom:8px}.cc-legende b{color:var(--ip-ink)}',
      '.cc-chargeurs{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--muted);padding:4px}',
      '.cc-charg{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);box-shadow:var(--sh-1);font:inherit;font-size:13px;font-weight:600;color:var(--ip-blue);cursor:pointer}.cc-charg:hover{border-color:rgba(0,80,230,.3)}.cc-charg.on{color:var(--muted);cursor:default}',
      '.cc-puces{display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin:12px 0 14px;padding:2px}.cc-puces::-webkit-scrollbar{display:none}',
      '.cc-puce{flex:0 0 auto;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);box-shadow:var(--sh-1);font:inherit;font-size:13px;color:var(--ip-ink-2);cursor:pointer;white-space:nowrap}.cc-puce b{font-weight:800;color:var(--titre,#0B1F4D)}.cc-puce i{font-style:normal;color:var(--muted-2)}',
      /* fiche */
      '.cc-fiche{animation:cc-arrive .42s var(--ease) both}',
      '@keyframes cc-arrive{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '.cc-head{display:grid;grid-template-columns:1fr auto;gap:18px 32px;align-items:end;margin:18px 0 20px}',
      '.cc-head .v2-page-title{font-size:34px;line-height:1.04;color:var(--titre,#0B1F4D);margin:0 0 8px}.cc-head .v2-page-sub{max-width:720px;line-height:1.5;margin:0}',
      '.cc-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-blue-d);background:var(--halo);padding:5px 12px;border-radius:20px;margin-bottom:12px}',
      '.cc-eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--ip-blue);box-shadow:0 0 0 3px rgba(0,80,230,.16)}',
      '.cc-meta{display:flex;flex-wrap:wrap;gap:6px 0;font-size:13px;color:var(--ip-ink-2)}.cc-meta>span{display:inline-flex;align-items:center;gap:6px;padding:0 12px;border-right:1px solid var(--line-strong)}.cc-meta>span:first-child{padding-left:0}.cc-meta>span:last-child{border-right:0}.cc-meta b{font-weight:800;color:var(--titre,#0B1F4D)}',
      '.cc-cart{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:22px}.cc-cart.four{grid-template-columns:repeat(4,1fr)}',
      '.cc-c{background:var(--card);border:1px solid rgba(11,31,77,.09);border-radius:var(--r-card);padding:16px 18px 14px;box-shadow:var(--sh-2);min-height:104px}',
      '.cc-c .l{font-size:13px;font-weight:600;color:var(--muted);margin-bottom:6px}.cc-c .v{font-size:30px;font-weight:800;letter-spacing:-.03em;line-height:1;color:var(--titre,#0B1F4D)}.cc-c .v small{font-size:14px;font-weight:600;color:var(--muted);letter-spacing:0;margin-left:4px}.cc-c .s{font-size:13px;color:var(--muted);margin-top:8px}',
      '.cc-c.ok .v{color:#10915E}.cc-c.bad .v{color:#C8385A}.cc-c.eq .v{color:var(--muted)}',
      '.cc-c .bar{display:flex;height:6px;border-radius:4px;overflow:hidden;margin-top:12px;background:#EEF0F4}.cc-c .bar i{display:block;height:100%}.cc-c .bar .ok{background:#10915E}.cc-c .bar .bad{background:#C8385A}.cc-c .bar .eq{background:#B9BFCC}',
      '.cc-forts{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px}',
      '.cc-card{background:var(--card);border:1px solid rgba(11,31,77,.09);border-radius:var(--r-card);box-shadow:var(--sh-2);padding:18px 20px}',
      '.cc-card h2{font-size:15.5px;font-weight:800;letter-spacing:-.02em;color:var(--titre,#0B1F4D);display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 10px;margin:0 0 4px}.cc-card h2 .sub{font-size:13px;font-weight:500;color:var(--muted);letter-spacing:0}.cc-card .lead{font-size:13px;color:var(--muted);margin:0 0 8px}',
      '.cc-ray{display:grid;grid-template-columns:1fr 64px 92px;gap:0 12px;align-items:center;width:100%;min-height:44px;padding:8px 0;border:0;border-top:1px solid var(--line);background:none;font:inherit;text-align:left;cursor:pointer;color:inherit}.cc-ray:first-of-type{border-top:0}.cc-ray:hover .rn{color:var(--ip-blue)}',
      '.cc-ray .rn{font-size:13.5px;font-weight:600;color:var(--ip-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.cc-ray .rn small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;font-weight:500;color:var(--muted)}',
      '.cc-ray .rp{font-size:13px;font-weight:700;text-align:right;white-space:nowrap}.cc-ray .rb{height:8px;border-radius:4px;background:#EEF0F4;overflow:hidden}.cc-ray .rb i{display:block;height:100%;border-radius:4px;transform-origin:left;animation:cc-grow .7s var(--ease) both}',
      '@keyframes cc-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
      '.cc-card.win .rp,.cc-card.win .rb i{color:#10915E;background:#10915E}.cc-card.win .rp{background:none}.cc-card.lose .rp,.cc-card.lose .rb i{color:#C8385A;background:#C8385A}.cc-card.lose .rp{background:none}.cc-card.neutre .rp{color:var(--ip-ink-2)}.cc-card.neutre .rb i{background:var(--ip-blue)}',
      '.cc-cat-head h2{font-size:20px;font-weight:800;letter-spacing:-.025em;color:var(--titre,#0B1F4D);margin:6px 0 0}',
      '.cc-tools{display:flex;gap:10px;align-items:center;margin:12px 0 12px;flex-wrap:wrap}',
      '.cc-search{flex:1;min-width:240px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);padding:0 14px;min-height:48px;color:var(--ip-blue);box-shadow:var(--sh-1)}.cc-search:focus-within{border-color:rgba(0,80,230,.35);box-shadow:0 0 0 3px rgba(0,80,230,.12),var(--sh-1)}',
      '.cc-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:16px;color:var(--ip-ink);min-height:44px}',
      '.cc-search input::-webkit-search-cancel-button,.cc-search input::-webkit-search-decoration{-webkit-appearance:none;display:none}',
      '.cc-bilan{border:1px solid rgba(11,31,77,.10);background:var(--card);box-shadow:var(--sh-1);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--ip-ink-2);margin-bottom:10px;line-height:1.5}',
      '.cc-bilan b{font-size:15px}.cc-bilan .win{color:#10915E;font-weight:700}.cc-bilan .lose{color:#C8385A;font-weight:700}',
      '.cc-count{font-size:12.5px;color:var(--muted-2);margin:0 0 6px 4px;font-family:var(--mono)}',
      '.cc-tablewrap{overflow-x:auto;border:1px solid rgba(11,31,77,.09);border-radius:14px;background:var(--card);box-shadow:var(--sh-1)}',
      '.cc-table th{white-space:nowrap;cursor:pointer;user-select:none;padding:12px 12px}.cc-table th.on{color:var(--ip-blue)}',
      '.cc-table td{padding:9px 12px;border-top:1px solid var(--line);font-size:13px;vertical-align:top}',
      '.cc-table td.num{text-align:right;white-space:nowrap}',
      '.cc-table tr.cc-p{cursor:pointer;transition:background .14s}.cc-table tr.cc-p:hover{background:#F4F7FD}',
      '.cc-name{min-width:220px;max-width:340px;font-weight:600}',
      '.cc-long{min-width:200px;max-width:320px}',
      '.cc-code{font-size:12px;color:var(--muted)}',
      '.cc-mute{color:var(--muted-2)}',
      '.cc-v{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}',
      '.cc-v.win{color:#0B6B45;background:rgba(16,145,94,.12)}.cc-v.lose{color:#9E2A46;background:rgba(200,56,90,.12)}.cc-v.egal{color:var(--ip-ink-2);background:var(--line)}',
      '.cc-more td{padding:14px;text-align:center;color:var(--muted-2);font-size:12.5px}',
      '.cc-sk{display:flex;flex-direction:column;gap:12px;margin-top:20px}',
      '.cc-sk-l{height:16px;border-radius:8px;background:linear-gradient(90deg,var(--line),color-mix(in srgb,var(--line) 40%,#fff),var(--line));background-size:200% 100%;animation:cc-sh 1.2s linear infinite}',
      '@keyframes cc-sh{to{background-position:-200% 0}}',
      /* carte produit : panneau latéral (ordinateur) / feuille plein écran (téléphone) */
      '.cc-veil{position:fixed;inset:0;z-index:60;background:rgba(11,31,77,.28);animation:cc-fade .25s var(--ease-soft) both}',
      '@keyframes cc-fade{from{opacity:0}to{opacity:1}}',
      '.cc-panel{position:fixed;top:0;right:0;bottom:0;z-index:61;width:min(540px,100%);background:var(--paper);overflow:auto;-webkit-overflow-scrolling:touch;padding:12px 16px 40px;box-shadow:-10px 0 40px -20px rgba(11,31,77,.35);animation:cc-slide .34s var(--ease) both}',
      '@keyframes cc-slide{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}',
      '.cc-panel-top{display:flex;align-items:center;margin:0 0 8px}',
      '.cc-retour{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 14px 0 8px;margin-left:-6px;border:0;background:none;font:inherit;font-size:15px;font-weight:700;color:var(--ip-blue);border-radius:12px;cursor:pointer}',
      '.cc-carte{background:var(--card);border:1px solid rgba(11,31,77,.10);border-radius:var(--r-card);box-shadow:var(--sh-3);overflow:hidden}',
      '.cc-carte .ct{padding:22px 24px 18px;background:linear-gradient(#FFFFFF,#F7F9FC)}',
      '.cc-carte .sur{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--muted);margin-bottom:10px}.cc-carte .sur .tag{display:inline-block;font-weight:700;color:var(--ip-blue);background:var(--halo);border-radius:999px;padding:4px 10px}',
      '.cc-carte h2{font-size:24px;font-weight:800;letter-spacing:-.03em;color:var(--titre,#0B1F4D);line-height:1.1;margin:0}.cc-carte .labo{font-size:14px;color:var(--muted);margin-top:6px}',
      '.cc-chiffres{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}',
      '.cc-chiffres div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 12px;box-shadow:var(--sh-1);min-width:0}',
      '.cc-chiffres small{display:block;font-size:13px;color:var(--muted);font-weight:600}.cc-chiffres b{display:block;font-size:21px;font-weight:800;letter-spacing:-.03em;color:var(--titre,#0B1F4D);margin-top:2px;white-space:nowrap}.cc-chiffres i{display:block;font-style:normal;font-size:13px;color:var(--muted-2);margin-top:2px}',
      '.cc-classement{padding:8px 10px 10px;border-top:1px solid var(--line)}.cc-classement h3,.cc-public h3{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:12px 12px 8px;margin:0}',
      '.cc-rang{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:2px 12px;align-items:center;padding:12px 12px;border-radius:14px;min-height:56px}.cc-rang+.cc-rang{margin-top:2px}',
      '.cc-rang .n{font-size:15px;font-weight:800;color:var(--muted-2);grid-row:span 2;width:34px;height:34px;border-radius:999px;display:grid;place-items:center;background:var(--surf-sunken,#F4F6FB)}',
      '.cc-rang .qui{font-size:15px;font-weight:700;color:var(--ip-ink)}.cc-rang .cond{font-size:13px;color:var(--muted);grid-column:2}',
      '.cc-rang .val{grid-column:3;grid-row:1;font-size:19px;font-weight:800;letter-spacing:-.02em;color:var(--ip-ink);text-align:right;white-space:nowrap}.cc-rang .ecart{grid-column:3;grid-row:2;font-size:13px;font-weight:600;text-align:right;color:var(--muted)}',
      '.cc-rang.nous{background:linear-gradient(90deg,#E9F0FF,#F2F6FF);box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 6px 16px -10px rgba(0,80,230,.45);border:1px solid rgba(0,80,230,.22)}.cc-rang.nous .n{background:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}.cc-rang.nous .qui,.cc-rang.nous .val{color:var(--ip-blue-d)}',
      '.cc-rang .pt{display:inline-block;width:8px;height:8px;border-radius:999px;margin-right:6px;vertical-align:1px}.cc-rang .pt.ok{background:#10915E}.cc-rang .pt.bad{background:#C8385A}.cc-rang .pt.eq{background:var(--muted)}',
      '.cc-public{padding:6px 24px 16px;border-top:1px solid var(--line)}.cc-public h3{padding-left:0;padding-right:0}',
      '.cc-public .ligne{display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line-2);font-size:14px}.cc-public .ligne:first-of-type{border-top:0}.cc-public .ligne b{font-size:16px;font-weight:800;letter-spacing:-.02em;white-space:nowrap}.cc-public .ligne span{color:var(--ip-ink-2)}.cc-public .ligne small{display:block;font-size:13px;color:var(--muted-2)}.cc-public a{color:var(--ip-blue);text-decoration:none;font-weight:600}',
      '.cc-geste{padding:16px 24px 22px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--line);background:linear-gradient(#FFFFFF,#F7F9FC)}.cc-geste p{width:100%;font-size:13px;color:var(--muted);line-height:1.45;margin:0}',
      '.cc-btn{display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:0 20px;border:0;border-radius:var(--r-btn);font:inherit;font-size:16px;font-weight:700;cursor:pointer;transition:transform .25s var(--ease),box-shadow .25s var(--ease)}',
      '.cc-btn.prim{background:linear-gradient(#1A62F0,var(--ip-blue));color:#fff;box-shadow:var(--sh-blue);flex:1;justify-content:center}.cc-btn.prim:hover{transform:translateY(-2px)}.cc-btn.prim:active{transform:translateY(0) scale(.98)}',
      '.cc-btn.sec{background:var(--card);border:1px solid rgba(11,31,77,.10);box-shadow:var(--sh-1);color:var(--ip-ink-2);min-height:48px}',
      /* plein écran vers le pharmacien */
      '.cc-face{position:fixed;inset:0;z-index:70;background:var(--paper);display:flex;flex-direction:column;animation:cc-monte .3s var(--ease) both}',
      '@keyframes cc-monte{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}',
      '.cc-face-lum{position:absolute;left:0;right:0;top:0;height:60%;pointer-events:none;background:radial-gradient(70% 90% at 50% -20%,#FFFFFF 0%,rgba(255,255,255,0) 60%),linear-gradient(#DCE7FC 0%,rgba(251,252,254,0) 100%)}',
      '.cc-face-haut{position:relative;display:flex;justify-content:space-between;align-items:center;padding:14px 16px;gap:10px}',
      '.cc-face-corps{position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 28px 40px;gap:12px;width:100%;max-width:880px;margin:0 auto;transition:transform .55s var(--ease)}',
      '.cc-face.tourne .cc-face-corps{transform:rotate(180deg)}',
      '.cc-face .qui{font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ip-blue)}',
      '.cc-face h2{font-size:clamp(28px,5vw,54px);font-weight:800;letter-spacing:-.035em;line-height:1.02;color:var(--titre,#0B1F4D);max-width:16ch;margin:0}.cc-face .lab{font-size:clamp(15px,1.6vw,20px);color:var(--muted)}',
      '.cc-face .prix{margin-top:18px;background:var(--card);border:1px solid rgba(11,31,77,.10);border-radius:28px;box-shadow:var(--sh-3);padding:26px 30px;max-width:640px}',
      '.cc-face .prix small{display:block;font-size:15px;font-weight:700;color:var(--muted);letter-spacing:.02em}.cc-face .prix>b{display:block;font-size:clamp(56px,10vw,112px);font-weight:800;letter-spacing:-.04em;line-height:1;color:var(--ip-blue-d);margin-top:6px;white-space:nowrap;font-variant-numeric:tabular-nums}.cc-face .prix>b .eur{font-size:.7em;font-weight:700;margin-left:.12em;vertical-align:baseline}',
      '.cc-face .bas{display:flex;gap:24px;flex-wrap:wrap;margin-top:18px}.cc-face .bas div small{display:block;font-size:14px;color:var(--muted);font-weight:600}.cc-face .bas div b{display:block;font-size:clamp(22px,3vw,34px);font-weight:800;letter-spacing:-.03em;color:var(--titre,#0B1F4D);margin-top:2px}',
      '.cc-face-pied{position:relative;padding:0 28px 22px;font-size:13px;color:var(--muted-2)}',
      'html.cc-lock,html.cc-lock body{overflow:hidden}',
      '@media (prefers-reduced-motion:reduce){.cc-fiche,.cc-ray .rb i,.cc-veil,.cc-panel,.cc-face,.cc-cres{animation:none !important}.cc-wrap *,.cc-panel *,.cc-face *{transition:none !important}}',
      /* téléphone */
      '@media (max-width:700px){',
      '.cc-kicker{margin-bottom:10px}',
      '.cc-tabs{margin-left:-14px;margin-right:-14px;border-radius:0;border-left:0;border-right:0;padding:6px 10px}',
      '.cc-head{grid-template-columns:1fr;gap:12px;align-items:start;margin-top:12px}.cc-head .v2-page-title{font-size:28px}',
      '.cc-meta{flex-direction:column;gap:4px}.cc-meta>span{padding:0;border-right:0}',
      '.cc-cart,.cc-cart.four{grid-template-columns:1fr 1fr;gap:10px}.cc-c{padding:14px 14px 12px;min-height:0}.cc-c .v{font-size:26px}.cc-cart:not(.four) .cc-c:nth-child(5){grid-column:1/-1}',
      '.cc-forts{grid-template-columns:1fr}.cc-ray{grid-template-columns:1fr 62px 64px}',
      '.cc-search{min-width:0}',
      '.cc-table thead{display:none}.cc-table tr{display:block;border-top:1px solid var(--line);padding:8px 4px}.cc-table td{display:flex;justify-content:space-between;gap:12px;border:0;padding:4px 8px;text-align:left}.cc-table td.num{text-align:right}.cc-table td:before{content:attr(data-label);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;flex:0 0 42%}.cc-name{max-width:none;min-width:0}.cc-long{min-width:0;max-width:none}',
      '.cc-panel{width:100%;left:0;padding:8px 14px 40px;box-shadow:none;animation:cc-slide-tel .38s var(--ease) both}',
      '@keyframes cc-slide-tel{from{transform:translateX(100%)}to{transform:none}}',
      '.cc-veil{display:none}',
      '.cc-carte .ct{padding:18px 18px 16px}.cc-carte h2{font-size:23px}.cc-chiffres{gap:8px}.cc-chiffres div{padding:10px 10px}.cc-chiffres b{font-size:19px}',
      '.cc-classement{padding:6px 6px 8px}.cc-rang{padding:10px 8px;gap:2px 10px}.cc-public{padding:4px 18px 14px}.cc-geste{padding:14px 18px 20px}',
      '.cc-face-corps{padding:0 22px 30px}.cc-face .prix{padding:20px 22px;border-radius:24px}.cc-face-haut .cc-btn{padding:0 14px;font-size:15px}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
