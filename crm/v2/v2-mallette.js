/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · La Mallette (V2.pages.mallette) — 16/10/2026
   « Les documents à envoyer » : la bibliothèque des documents utiles aux commerciaux, une mallette où l'on range ce qu'on veut
   envoyer, puis un seul PDF (page de garde + sommaire + les VRAIES pages) ou des fichiers séparés, et le mail qui les explique.
   Maquette choisie par Will : m1 « La Mallette » (mallette-maquettes-2026-10-16.vercel.app/m1.html).

   Les listings sont fabriqués par le moteur de « Transmettre » (v2-pharma.js, V2.pharmaPont) : aucun calcul n'est recopié ici.
   Les envois suivent « Transmettre » : DEUX temps (Préparer, puis Envoyer) pour que Safari accepte la feuille de partage,
   des pièces jointes réelles (jamais un lien d'hébergeur vers un pharmacien), une trace dans les notes de la fiche.
   Aucun prix, aucun pourcentage ni condition chiffrée dans les textes de l'écran.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2; if (!V2) return;
  V2.pages = V2.pages || {};
  var CB = '?v=20261016zb';
  var TX_BUCKET = 'marketing-pdfs';   // le même seau que Marketing › Documents partagés et « Transmettre »
  var PDFLIB = 'vendor/pdf-lib-1.17.1.min.js';
  var JSZIP = 'vendor/jszip-3.10.1.min.js';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function isOpso() { return !!(window.V2_BRAND && window.V2_BRAND.opso); }
  function isEscale() { return !!(window.V2_BRAND && window.V2_BRAND.escale); }
  // Le nom qui part chez le pharmacien : « Intégral Pharma » (JARVIS est le nom de l'outil, jamais celui de l'expéditeur) ; Escale Pharma dans son espace.
  function marque() { return isEscale() ? ((window.V2_BRAND && window.V2_BRAND.name) || 'Escale Pharma') : 'Intégral Pharma'; }
  // Documents à l'en-tête Intégral et dossiers du logiciel : pas dans les espaces Escale ni OPSO (deux marques distinctes), comme « Transmettre ».
  function docsFixes() { return !isEscale() && !isOpso(); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var reduit = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ——— La feuille de style (chargée dès que le module est là, bien avant le premier clic) ———
  (function () {
    if (document.getElementById('v2-mallette-css')) return;
    var l = document.createElement('link'); l.id = 'v2-mallette-css'; l.rel = 'stylesheet'; l.href = 'v2-mallette.css' + CB;
    document.head.appendChild(l);
  })();

  // ——— Pictos (même trait que le reste de l'app) ———
  var P = {
    building: 'M4 21V6l8-3 8 3v15M9 21v-5h6v5M8 10h2M14 10h2M8 13h2M14 13h2',
    signature: 'M4 20h16M5 15c2.5 0 3-8 5.5-8s.5 8 3 8 2-3.5 5-3.5',
    book: 'M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM5 17a3 3 0 013-3h10',
    monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
    note: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    upload: 'M12 16V5M7.5 9.5L12 5l4.5 4.5M5 20h14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    plus: 'M12 5v14M5 12h14',
    up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', x: 'M6 6l12 12M18 6L6 18',
    mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
    download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14',
    chev: 'M9 5l7 7-7 7',
    send: 'M4 12l16-8-6 16-3-7z',
    case: 'M3 8h18v12H3zM9 8V5h6v3M3 13h18M11 13h2',
    grid: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16',
    layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
    search: 'M11 4.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM16 16l4 4',
    user: 'M12 4.8a3.7 3.7 0 100 7.4 3.7 3.7 0 000-7.4zM4.5 20c0-4 3.3-6.3 7.5-6.3s7.5 2.3 7.5 6.3'
  };
  function ic(n) { return '<svg class="ml-i" viewBox="0 0 24 24" aria-hidden="true"><path d="' + P[n] + '"/></svg>'; }

  // ═══════════════ LES DOCUMENTS (adresses vérifiées en production le 16/10/2026) ═══════════════
  var FAMILLES = [
    { id: 'presenter', nom: 'Présenter Intégral', icone: 'building' },
    { id: 'compte', nom: 'Ouvrir un compte', icone: 'signature' },
    { id: 'offres', nom: 'Offres et catalogues', icone: 'book' },
    { id: 'lgo', nom: 'Son logiciel', icone: 'monitor' },
    { id: 'fiches', nom: 'Fiches pratiques', icone: 'note' },
    { id: 'listings', nom: 'Listings produits', icone: 'list' },
    { id: 'equipe', nom: 'Déposés par l’équipe', icone: 'upload' }
  ];
  var COURT = { tout: 'Tout', presenter: 'Présenter', compte: 'Ouvrir un compte', offres: 'Offres', lgo: 'Son logiciel', fiches: 'Fiches', listings: 'Listings', equipe: 'Équipe' };
  var ICO_FAM = {}; FAMILLES.forEach(function (f) { ICO_FAM[f.id] = f.icone; });

  // pages = nombre RÉEL de pages (relevé sur le fichier le 16/10/2026) ; ko = poids réel arrondi.
  var FIXES = [
    { id: 'presentation-groupements', famille: 'presenter', titre: 'Présentation Intégral Pharma', sous: 'Le groupe, les agences, la façon de travailler avec les groupements d’achat', url: '../../site-integral/assets/Presentation-Integral-Pharma-groupements.pdf', pages: 7, ko: 921,
      phrase: 'qui nous sommes, nos agences et notre façon de travailler avec les groupements' },
    { id: 'plaquette-prospection', famille: 'presenter', titre: 'Plaquette de prospection', sous: 'Quatre pages pour un premier rendez-vous', url: '../../MARKETING/IP PROSPECTION PGN.pdf', pages: 4, ko: 4922,
      phrase: 'l’essentiel d’Intégral Pharma en quatre pages' },
    { id: 'ouverture-compte', famille: 'compte', titre: 'Ouverture de compte 2026', sous: 'Le formulaire, une seule page', url: 'ouverture-compte-integral-pharma-2026.pdf', pages: 1, ko: 127,
      phrase: 'le formulaire d’ouverture de compte, une seule page à nous retourner remplie' },
    { id: 'catalogue-integral', famille: 'offres', titre: 'Catalogue Intégral', sous: 'Toute la gamme en dix pages', url: 'catalogue-integral.pdf', pages: 10, ko: 1111,
      phrase: 'notre catalogue, pour voir toute la gamme d’un coup d’œil' },
    { id: 'catalogue-itp', famille: 'offres', titre: 'Catalogue ITP juin 2026', sous: 'Quatorze pages', url: 'catalogue-itp.pdf', pages: 14, ko: 8307,
      phrase: 'le catalogue ITP de juin 2026' },
    { id: 'offre-2026', famille: 'offres', titre: 'Offre 2026', sous: 'Neuf pages', url: '../../MARKETING/OFFRE V1 2026 (3).pdf', pages: 9, ko: 1890,
      phrase: 'notre offre 2026' },
    { id: 'biosim-memo', famille: 'fiches', titre: 'Fiche mémo biosimilaires', sous: 'Une page à garder au comptoir', url: '../../MARKETING/BIOSIM FICHE MEMO.pdf', pages: 1, ko: 127,
      phrase: 'une fiche mémo sur les biosimilaires, à garder au comptoir' },
    { id: 'infosoft', famille: 'fiches', titre: 'Fiche Infosoft', sous: 'Une page', url: '../../MARKETING/INFOSOFT .pdf', pages: 1, ko: 251,
      phrase: 'la fiche Infosoft' }
  ];
  FIXES.forEach(function (d) { d.type = 'pdf'; d.kind = 'fixe'; });

  // Les huit logiciels dont on a le pas-à-pas ET les fichiers de meilleures ventes (crm/v2/lgo/) — mêmes slugs que « Transmettre ».
  var LGO = [
    { s: 'winpharma', nom: 'Winpharma', pages: 1, ko: 91, xl: [25, 35, 55] }, { s: 'lgpi', nom: 'LGPI', pages: 4, ko: 505, xl: [12, 15, 22] },
    { s: 'smartrx', nom: 'Smart RX', pages: 1, ko: 92, xl: [21, 28, 44] }, { s: 'pharmavitale', nom: 'Pharmavitale', pages: 1, ko: 87, xl: [14, 18, 27] },
    { s: 'pharmony', nom: 'Pharmony', pages: 2, ko: 433, xl: [13, 17, 24] }, { s: 'visiopharm', nom: 'VisioPharm', pages: 1, ko: 87, xl: [14, 18, 27] },
    { s: 'pharmaland', nom: 'Pharmaland', pages: 1, ko: 97, xl: [17, 24, 36] }, { s: 'leo', nom: 'LEO', pages: 1, ko: 91, xl: [21, 30, 46] }
  ];
  var LGO_DOCS = [];
  LGO.forEach(function (l) {
    LGO_DOCS.push({ id: 'tuto-' + l.s, kind: 'fixe', famille: 'lgo', lgo: l.s, titre: 'Commander depuis ' + l.nom, sous: 'Le pas-à-pas pour commander chez nous depuis ' + l.nom, type: 'pdf',
      url: 'lgo/tuto-' + l.s + '.pdf', pages: l.pages, ko: l.ko, phrase: 'le pas-à-pas pour commander chez nous directement depuis ' + l.nom });
    [200, 300, 500].forEach(function (n, i) {
      LGO_DOCS.push({ id: 'top' + n + '-' + l.s, kind: 'fixe', famille: 'lgo', lgo: l.s, titre: 'Nos ' + n + ' meilleures ventes · ' + l.nom, sous: 'Fichier Excel prêt à importer', type: 'xlsx',
        url: 'lgo/integral-top' + n + '-' + l.s + '.xlsx', nomFichier: 'integral-top' + n + '-' + l.s + '.xlsx', lignes: n, ko: l.xl[i],
        phrase: 'nos ' + n + ' meilleures ventes, dans un fichier prêt à importer dans ' + l.nom });
    });
  });

  // Listings fabriqués à la demande, par le moteur de « Transmettre » (V2.pharmaPont.listing). Le nombre de pages n'est connu qu'une fois le PDF fabriqué.
  var LISTINGS = [
    { id: 'listing-reseau', kind: 'listing', lk: 'reseau', famille: 'listings', titre: 'Meilleures rotations du réseau', sous: 'Les produits les plus commandés par nos pharmacies', type: 'pdf', pages: null, ko: null, fabrique: true,
      phrase: 'les produits les plus commandés par les pharmacies de notre réseau, famille par famille' },
    { id: 'listing-ses-ventes', kind: 'listing', lk: 'ventes', famille: 'listings', titre: 'Ses ventes et ses opportunités', sous: 'Pour une pharmacie cliente : ce qu’elle commande, ce qui lui manque', type: 'pdf', pages: null, ko: null, fabrique: true, clientSeul: true,
      phrase: 'ce que vous commandez chez nous et les produits que vos confrères commandent le plus' }
  ];

  // ——— État de l'écran (survit aux redessins du routeur) ———
  var S = {
    tab: 'tout', q: '', lgoF: '', unPdf: true, ton: 'chaleureux', sel: [], extras: {}, ajoutes: [], dest: null,
    equipe: null, equipeErr: '', eqDocs: {}, prets: null, busy: '', etape: 0, total: 0, tracee: null,
    mailObjet: '', mailCorps: '', mailMod: false, init: false, dlg: null, grpSurvol: '', groupes: null, apercu: {}, destQ: '', destRes: [], pile: []
  };

  function doc(id) {
    if (S.extras[id]) return S.extras[id];
    var i;
    if (id.indexOf('eq:') === 0) { var nom = id.slice(3), f = (S.equipe || []).filter(function (x) { return x.name === nom; })[0]; return f ? eqDoc(f) : null; }
    for (i = 0; i < FIXES.length; i++) if (FIXES[i].id === id) return docsFixes() ? FIXES[i] : null;
    for (i = 0; i < LGO_DOCS.length; i++) if (LGO_DOCS[i].id === id) return docsFixes() ? LGO_DOCS[i] : null;
    for (i = 0; i < LISTINGS.length; i++) if (LISTINGS[i].id === id) return LISTINGS[i];
    return null;
  }
  function tous() {
    var d = [];
    if (docsFixes()) d = d.concat(FIXES, LGO_DOCS);
    d = d.concat(LISTINGS);
    S.ajoutes.forEach(function (id) { if (S.extras[id] && S.extras[id].kind === 'listing') d.push(S.extras[id]); });
    (S.equipe || []).forEach(function (f) { d.push(eqDoc(f)); });
    S.ajoutes.forEach(function (id) { if (S.extras[id] && S.extras[id].kind === 'local') d.push(S.extras[id]); });
    return d;
  }
  function selDocs() { return S.sel.map(doc).filter(Boolean); }
  function estChoisi(id) { return S.sel.indexOf(id) >= 0; }

  // ——— Libellés ———
  function pagesTxt(n) { return n + (n > 1 ? ' pages' : ' page'); }
  function poids(ko) { return ko >= 1024 ? (ko / 1024).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(ko)) + ' Ko'; }
  function libPages(d) {
    if (d.type === 'pdf') return d.pages ? pagesTxt(d.pages) : (d.fabrique ? 'Fabriqué à l’envoi' : 'PDF');
    return d.lignes ? d.lignes + ' lignes' : 'Excel';
  }
  function metaDoc(d) { var p = libPages(d); return d.ko ? p + ' · ' + poids(d.ko) : p; }
  function nomLgo(s) { var l = LGO.filter(function (x) { return x.s === s; })[0]; return l ? l.nom : ''; }
  function pretty(n) { n = String(n || ''); var i = n.indexOf('__'); return i >= 0 ? n.slice(i + 2) : n; }
  function isXls(n) { return /\.xlsx?$/i.test(n); }
  function mime(n) { return /\.xlsx$/i.test(n) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : /\.xls$/i.test(n) ? 'application/vnd.ms-excel' : 'application/pdf'; }
  function sanit(n) { return String(n || 'document').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'document'; }
  function nomPropre(t) { return String(t || 'document').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function eqDoc(f) {
    var id = 'eq:' + f.name;
    if (!S.eqDocs[id] || S.eqDocs[id].ko !== Math.round((f.size || 0) / 1024)) {
      var x = isXls(f.name);
      S.eqDocs[id] = { id: id, kind: 'equipe', famille: 'equipe', titre: pretty(f.name).replace(/\.[^.]+$/, ''), sous: x ? 'Excel déposé par l’équipe' : 'PDF déposé par l’équipe', type: x ? 'xlsx' : 'pdf',
        pages: null, ko: Math.round((f.size || 0) / 1024), bucket: f.name, nomFichier: pretty(f.name), phrase: 'un document complémentaire' };
    }
    return S.eqDocs[id];
  }

  // ═══════════════ LA COUVERTURE DESSINÉE EN CSS ═══════════════
  function feuille(d, mini) {
    var x = d.type === 'xlsx', pg = d.type === 'pdf' ? (d.pages || 1) : 1;
    var ico = ICO_FAM[d.famille] || 'note';
    var haut = mini ? '' : '<span class="ml-sh-top">' + ic(x ? 'grid' : ico) + '<b class="ml-sh-tag">' + (x ? 'XLS' : 'PDF') + '</b></span><span class="ml-sh-t">' + esc(d.titre) + '</span>';
    var pied = mini ? '' : '<span class="ml-sh-f">' + esc(d.type === 'pdf' ? (d.pages ? pagesTxt(pg) : (d.fabrique ? 'Sur mesure' : 'PDF')) : (d.lignes ? d.lignes + ' lignes' : 'Excel')) + '</span>';
    return '<span class="ml-pile' + (mini ? ' ml-mini' : '') + (!x && pg > 1 ? ' ml-multi' : '') + (!x && pg > 6 ? ' ml-multi2' : '') + '"><span class="ml-sheet' + (x ? ' ml-x' : '') + (mini ? ' ml-mini' : '') + '">' +
      '<span class="ml-sh-band">' + haut + '</span><span class="ml-sh-body"><i></i><i></i><i></i>' + pied + '</span></span></span>';
  }

  // ═══════════════ LE MUR ═══════════════
  function visibles() {
    var d = tous();
    if (S.tab !== 'tout') d = d.filter(function (x) { return x.famille === S.tab; });
    else if (!S.q) d = d.filter(function (x) { return !(x.famille === 'lgo' && x.type === 'xlsx'); });
    if (S.tab === 'lgo' && S.lgoF) d = d.filter(function (x) { return x.lgo === S.lgoF; });
    if (S.q) { var n = norm(S.q); d = d.filter(function (x) { return norm(x.titre + ' ' + (x.sous || '') + ' ' + (x.lgo ? nomLgo(x.lgo) : '')).indexOf(n) >= 0; }); }
    return d;
  }
  function carte(d) {
    var chips = '';
    if (d.fabrique) chips += '<span class="ml-chip">Fabriqué à la demande</span>';
    if (d.clientSeul) chips += '<span class="ml-chip ml-chip--ok">Pour une cliente</span>';
    return '<button type="button" class="ml-doc" data-doc="' + esc(d.id) + '" aria-pressed="false">' +
      '<span class="ml-tuile">' + feuille(d) + '<span class="ml-pick" aria-hidden="true">' + ic('plus') + '<span class="ml-rk">0</span></span></span>' +
      '<span class="ml-corps"><span class="ml-so">' + esc(d.sous || '') + '</span><span class="ml-me">' + esc(metaDoc(d)) + chips + '</span></span></button>';
  }
  function tuilesAtelier(quoi) {
    var l = '<button type="button" class="ml-atelier-t" data-action="listing-grp"><span class="ml-vide-page">' + ic('list') + '</span><span><b>Fabriquer un listing</b><span class="ml-s">Les produits que commandent les pharmacies du groupement de votre choix</span></span><span class="ml-plus">' + ic('plus') + '</span></button>';
    var u = '<label class="ml-atelier-t" id="ml-zone-depot"><span class="ml-vide-page">' + ic('upload') + '</span><span><b>Déposer un PDF ou un Excel</b><span class="ml-s">Glissez un fichier ici, ou touchez pour le choisir : toute l’équipe le retrouve</span></span><span class="ml-plus">' + ic('plus') + '</span><input type="file" id="ml-fichier" accept=".pdf,.xls,.xlsx,application/pdf" multiple aria-label="Déposer un PDF ou un Excel"></label>';
    return quoi === 'listing' ? l : quoi === 'depot' ? u : l + u;
  }
  function aucun() {
    return '<div class="ml-aucun"><b>Aucun document trouvé' + (S.q ? ' pour « ' + esc(S.q) + ' »' : '') + '</b>Essayez un autre mot, ou ouvrez toute la bibliothèque.<br><button type="button" class="ml-lien" id="ml-tout-voir">Voir tous les documents</button></div>';
  }
  function famillesVisibles() {
    var d = tous(), has = {}; d.forEach(function (x) { has[x.famille] = 1; });
    return FAMILLES.filter(function (f) { return has[f.id] || f.id === 'listings' || f.id === 'equipe'; });
  }
  function rendreMur() {
    var zone = $('#ml-mur'); if (!zone) return;
    var d = visibles(), h = '';
    if (S.tab === 'lgo') {
      h += '<div class="ml-filtre-lgo"><label for="ml-lgo-f">Votre logiciel</label><div class="v2-select"><select id="ml-lgo-f" aria-label="Filtrer par logiciel"><option value="">Tous les logiciels</option>' +
        LGO.map(function (l) { return '<option value="' + l.s + '"' + (l.s === S.lgoF ? ' selected' : '') + '>' + esc(l.nom) + '</option>'; }).join('') + '</select>' + ic('down') + '</div></div>';
    }
    if (S.tab === 'tout') {
      if (!S.q) h += '<div class="ml-sec"><div class="ml-atelier">' + tuilesAtelier() + '</div></div>';
      famillesVisibles().forEach(function (f) {
        var it = d.filter(function (x) { return x.famille === f.id; });
        if (!it.length) return;
        h += '<div class="ml-sec"><div class="ml-sec-h"><h2>' + esc(f.nom) + '</h2><span class="ml-n">' + it.length + '</span></div><div class="ml-mur">' + it.map(carte).join('') + '</div></div>';
      });
      if (!d.length) h += aucun();
    } else {
      if (S.tab === 'listings' && !S.q) h += '<div class="ml-sec"><div class="ml-atelier">' + tuilesAtelier('listing') + '</div></div>';
      if (S.tab === 'equipe' && !S.q) h += '<div class="ml-sec"><div class="ml-atelier">' + tuilesAtelier('depot') + '</div></div>';
      if (S.tab === 'equipe' && S.equipe === null) h += '<p class="ml-vide-mini" style="margin-top:14px">Lecture des documents de l’équipe…</p>';
      else if (S.tab === 'equipe' && S.equipeErr) h += '<p class="ml-vide-mini" style="margin-top:14px">' + esc(S.equipeErr) + '</p>';
      if (d.length) h += '<div class="ml-sec"><div class="ml-mur">' + d.map(carte).join('') + '</div></div>';
      else if (S.tab === 'equipe' && !S.q && S.equipe !== null && !S.equipeErr) h += '<p class="ml-vide-mini" style="margin-top:14px">Rien de déposé pour l’instant : les fichiers que vous ajoutez apparaissent ici, pour toute l’équipe.</p>';
      else if (!(S.tab === 'equipe' && !S.q)) h += aucun();
    }
    zone.innerHTML = h;
    majMur();
  }
  function majMur() {
    $$('[data-doc]').forEach(function (b) {
      var i = S.sel.indexOf(b.getAttribute('data-doc'));
      b.setAttribute('aria-pressed', i >= 0 ? 'true' : 'false');
      var rk = $('.ml-rk', b); if (rk) rk.textContent = i + 1;
    });
  }
  function rendreOnglets() {
    var all = tous();
    var cnt = function (id) { return all.filter(function (x) { return id === 'tout' ? !(x.famille === 'lgo' && x.type === 'xlsx') : x.famille === id; }).length; };
    var fam = [{ id: 'tout', nom: 'Tout' }].concat(famillesVisibles());
    if (fam.map(function (f) { return f.id; }).indexOf(S.tab) < 0) S.tab = 'tout';
    var el = $('#ml-onglets'); if (!el) return;
    el.innerHTML = fam.map(function (f) {
      return '<button type="button" class="v2-tab' + (f.id === S.tab ? ' on' : '') + '" role="tab" data-tab="' + f.id + '" aria-selected="' + (f.id === S.tab) + '" title="' + esc(f.nom) + ' · ' + cnt(f.id) + '">' + esc(COURT[f.id] || f.nom) + '</button>';
    }).join('');
  }

  // ═══════════════ LA MALLETTE ═══════════════
  function pileHtml() { var h = ''; for (var k = 4; k >= 0; k--) h += '<i style="--k:' + k + '"></i>'; return h; }
  function totaux() {
    var docs = selDocs(), pdfs = docs.filter(function (d) { return d.type === 'pdf'; });
    var connues = 0, inconnues = 0, ko = 0, koPdf = 0;
    docs.forEach(function (d) { ko += d.ko || 0; });
    pdfs.forEach(function (d) { if (d.pages) connues += d.pages; else inconnues++; koPdf += d.ko || 0; });
    return { docs: docs, pdfs: pdfs, xl: docs.length - pdfs.length, connues: connues, inconnues: inconnues, ko: ko, koPdf: koPdf };
  }
  function enveloppe(t) { return t.pdfs.length ? 2 : 0; }   // page de garde + sommaire (un seul PDF)
  function sousTexte(t) {
    var n = t.docs.length; if (!n) return 'Rien de choisi pour l’instant';
    var pages = t.connues + (S.unPdf ? enveloppe(t) : 0), poidsTxt = poids(S.unPdf ? t.koPdf + (t.pdfs.length ? 14 : 0) : t.ko);
    var inc = t.inconnues ? ' + ' + t.inconnues + (t.inconnues > 1 ? ' listings' : ' listing') : '';
    if (!t.pdfs.length) return poidsTxt;
    return pagesTxt(pages) + inc + ' · ' + poidsTxt + (t.inconnues ? ' ou plus' : '');
  }
  function rendre() {
    var t = totaux(), n = t.docs.length, docs = t.docs;
    $$('[data-compte]').forEach(function (b) {
      if (b.textContent !== String(n)) { b.textContent = n; b.classList.remove('ml-bump'); void b.offsetWidth; b.classList.add('ml-bump'); }
    });
    var lib = $('#ml-lib-docs'); if (lib) lib.textContent = n > 1 ? 'documents' : 'document';
    var sous = sousTexte(t);
    var st = $('#ml-sous'); if (st) st.textContent = sous;
    var cs = $('#ml-cap-sous'); if (cs) cs.textContent = n ? sous : 'Touchez un document pour l’ajouter';
    $$('.ml-pile3').forEach(function (p) {
      p.classList.toggle('ml-sep', !S.unPdf);
      $$('i', p).forEach(function (i) { i.classList.toggle('ml-on', parseInt(i.style.getPropertyValue('--k'), 10) < Math.min(n, 5)); });
    });
    // bilan
    var b, pages = t.connues + enveloppe(t);
    if (!n) b = 'Choisissez des documents : vous pourrez les réunir en un seul PDF, ou les envoyer séparément.';
    else if (S.unPdf) {
      b = t.pdfs.length
        ? '<b>Un seul PDF' + (t.inconnues ? '' : ' de ' + pagesTxt(pages)) + '</b>, page de garde et sommaire compris.' + (t.inconnues ? ' Le nombre de pages s’annonce une fois les listings fabriqués.' : '')
        : '<b>Aucun PDF à réunir</b> : ' + (t.xl > 1 ? 'les fichiers Excel partent' : 'le fichier Excel part') + ' tel' + (t.xl > 1 ? 's' : '') + ' quel' + (t.xl > 1 ? 's' : '') + '.';
      if (t.xl && t.pdfs.length) b += ' ' + t.xl + (t.xl > 1 ? ' fichiers Excel ne peuvent' : ' fichier Excel ne peut') + ' pas entrer dans un PDF : ' + (t.xl > 1 ? 'ils partent' : 'il part') + ' à côté.';
    } else b = '<b>' + n + (n > 1 ? ' fichiers' : ' fichier') + '</b>, chacun gardé tel quel (réunis dans un dossier compressé .zip au téléchargement).';
    var bi = $('#ml-bilan'); if (bi) bi.innerHTML = b;
    $$('#ml-mode [data-mode]').forEach(function (x) { var on = (x.getAttribute('data-mode') === 'unique') === S.unPdf; x.setAttribute('aria-checked', on); x.classList.toggle('on', on); });
    var li = $('#ml-liste'); if (!li) return;
    li.className = 'ml-liste ' + (S.unPdf ? 'ml-mode-unique' : 'ml-mode-separes');
    var h = '';
    if (!n) {
      h = '<div class="ml-vide"><span class="ml-ico">' + ic('case') + '</span><b>Votre mallette est vide</b><span>Touchez un document pour le glisser ici, ou déposez un fichier sur cette colonne.</span></div>';
    } else {
      if (S.unPdf && t.pdfs.length) {
        h += '<li class="ml-rg ml-garde"><span class="ml-num">' + ic('layers').replace('class="ml-i"', 'class="ml-i" width="16" height="16"') + '</span><span class="ml-gp"></span><span class="ml-rt"><b>Page de garde et sommaire</b><small>' + (S.dest ? 'Préparée pour ' + esc(S.dest.nom) : 'Page de garde sans nom de pharmacie') + '</small></span></li>';
      }
      docs.forEach(function (d, i) {
        h += '<li class="ml-rg' + (S.nouveau === d.id ? ' ml-neuf' : '') + '" data-row="' + esc(d.id) + '">' +
          '<span class="ml-num">' + (i + 1) + '</span>' + feuille(d, true) +
          '<span class="ml-rt"><b>' + esc(d.titre) + '</b><small>' + esc(metaDoc(d)) + '</small></span>' +
          '<span class="ml-ra"><button type="button" data-mv="-1" aria-label="Monter ' + esc(d.titre) + '"' + (i === 0 ? ' disabled' : '') + '>' + ic('up') + '</button>' +
          '<button type="button" data-mv="1" aria-label="Descendre ' + esc(d.titre) + '"' + (i === n - 1 ? ' disabled' : '') + '>' + ic('down') + '</button>' +
          '<button type="button" data-rm aria-label="Retirer ' + esc(d.titre) + '">' + ic('x') + '</button></span></li>';
      });
    }
    S.nouveau = null;
    li.innerHTML = h;
    rendrePied();
    majMur();
  }
  function destLibelle() { return S.dest ? S.dest.nom + (S.dest.ville ? ' · ' + S.dest.ville : '') : 'Sans destinataire'; }
  function canShare(files) { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: files })); } catch (e) { return false; } }
  function totalKoFichiers(files) { return files.reduce(function (s, f) { return s + (f.size || 0); }, 0); }
  function tailleTxt(b) { b = +b || 0; return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' Ko' : (b / 1048576).toFixed(1).replace('.', ',') + ' Mo'; }
  function rendrePied() {
    var el = $('#ml-pied'); if (!el) return;
    var n = S.sel.length;
    var destB = '<span class="ml-lb-champ">Destinataire</span><button type="button" class="ml-dest" data-action="dest" aria-haspopup="dialog">' +
      '<span class="ml-dest-ic">' + ic('user') + '</span><span class="ml-dest-tx"><b>' + esc(S.dest ? S.dest.nom : 'Sans destinataire') + '</b><small>' +
      esc(S.dest ? [S.dest.ville, S.dest.client ? 'cliente' : 'prospect', S.dest.email || 'pas d’e-mail connu'].filter(Boolean).join(' · ') : 'Mail générique : vous choisirez l’adresse dans votre messagerie') + '</small></span>' + ic('chev') + '</button>';
    var corps;
    if (S.busy === 'prepare') {
      corps = '<div class="ml-etat" role="status">' + ic('layers') + '<span>Préparation du fichier ' + S.etape + ' sur ' + S.total + '…</span></div>' +
        '<button type="button" class="v2-btn v2-btn-primary ml-occupe" disabled>' + ic('layers') + 'Préparation…</button>';
    } else if (S.prets) {
      var f = S.prets.files, tot = totalKoFichiers(f), partage = canShare(f);
      corps = '<div class="ml-etat ml-pret" role="status"><b>' + f.length + ' fichier' + (f.length > 1 ? 's' : '') + ' prêt' + (f.length > 1 ? 's' : '') + '</b><span>' + tailleTxt(tot) +
        (S.prets.unPdf && S.prets.pages ? ' · PDF de ' + pagesTxt(S.prets.pages) : '') + '</span>' +
        (S.prets.unPdf && S.prets.xl ? '<small>' + S.prets.xl + (S.prets.xl > 1 ? ' fichiers Excel partent' : ' fichier Excel part') + ' à côté du PDF.</small>' : '') +
        (tot > 20 * 1048576 ? '<small class="ml-alerte">Plus de 20 Mo : de nombreuses messageries refusent un mail aussi lourd.</small>' : '') +
        (!partage ? '<small>Sur cet appareil, les fichiers arrivent dans Téléchargements : glissez-les dans le mail avant de l’envoyer.</small>' : '') + '</div>' +
        (partage ? '<button type="button" class="v2-btn v2-btn-primary" data-action="envoyer">' + ic('send') + 'Envoyer</button>' : '') +
        '<div class="ml-duo"><button type="button" class="v2-btn ' + (partage ? 'v2-btn-ghost' : 'v2-btn-primary') + '" data-action="telecharger">' + ic('download') + (S.prets.unPdf ? 'Télécharger' : 'Télécharger (.zip)') + '</button>' +
        '<button type="button" class="v2-btn v2-btn-ghost" data-action="modifier">Modifier</button></div>';
    } else {
      corps = '<button type="button" class="v2-btn v2-btn-primary" data-action="preparer"' + (n ? '' : ' disabled') + '>' + ic('check') + 'Préparer l’envoi</button>' +
        '<p class="ml-duo-t">' + (n ? (S.unPdf ? 'Un seul PDF, prêt à joindre à votre mail.' : 'Les fichiers sont gardés tels quels.') : 'Choisissez au moins un document.') + '</p>';
    }
    el.innerHTML = destB + corps +
      '<button type="button" class="v2-btn v2-btn-ghost" data-action="mail"' + (n ? '' : ' disabled') + '>' + ic('mail') + 'Préparer le mail</button>';
  }
  function invalider() { if (S.prets) { S.prets = null; } }

  // ——— Changements de sélection ———
  function surChange(nouveau) { invalider(); if (nouveau) S.nouveau = nouveau; rendre(); }
  function basculer(id) {
    var i = S.sel.indexOf(id);
    if (i >= 0) S.sel.splice(i, 1); else { var d = doc(id); if (!d) return false; if (d.clientSeul && !(S.dest && S.dest.client)) { V2.toast('Ce listing est pour une pharmacie cliente : choisissez-la d’abord comme destinataire.', 'warn'); return false; } S.sel.push(id); }
    surChange(i < 0 ? id : null);
    return i < 0;
  }
  function ajouter(id) { if (S.sel.indexOf(id) < 0 && doc(id)) { S.sel.push(id); surChange(id); } }
  function retirer(id) { var i = S.sel.indexOf(id); if (i >= 0) { S.sel.splice(i, 1); surChange(); } }
  function deplacer(id, pas) { var i = S.sel.indexOf(id), j = i + pas; if (i < 0 || j < 0 || j >= S.sel.length) return; S.sel.splice(j, 0, S.sel.splice(i, 1)[0]); surChange(); }
  function vider() { S.sel = []; surChange(); }

  // ——— Le vol d'un document vers la mallette ———
  function cibleVol() { var cap = $('#ml-cap'); return cap && getComputedStyle(cap).display !== 'none' ? $('.ml-pile3', cap) : $('.ml-mal-h .ml-pile3'); }
  function voler(depuis, d) {
    if (reduit || !depuis || !depuis.animate) return;
    var a = depuis.getBoundingClientRect(), c = cibleVol(); if (!c || !a.width) return;
    var b = c.getBoundingClientRect();
    var v = document.createElement('div'); v.className = 'ml-vol';
    v.innerHTML = feuille(d, true);
    var w = Math.min(a.width, 90), hh = w * 1.414;
    v.style.cssText = 'left:' + (a.left + (a.width - w) / 2) + 'px;top:' + a.top + 'px;width:' + w + 'px;height:' + hh + 'px;border-radius:5px';
    var inner = $('.ml-pile', v); inner.style.width = '100%'; inner.style.height = '100%'; $('.ml-sheet', v).style.height = '100%'; $('.ml-sheet', v).style.aspectRatio = 'auto';
    document.body.appendChild(v);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + hh / 2);
    var an = v.animate([{ transform: 'translate(0,0) scale(1) rotate(0deg)' }, { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 40) + 'px) scale(.8) rotate(-6deg)', offset: 0.5 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.45) rotate(5deg)' }], { duration: 440, easing: 'cubic-bezier(.45,.05,.25,1)' });
    an.onfinish = function () { v.remove(); c.classList.remove('ml-rebond'); void c.offsetWidth; c.classList.add('ml-rebond'); };
  }

  // ═══════════════ FENÊTRES ET TIROIR ═══════════════
  function ouvrirDlg(id) {
    var d = $('#' + id); if (!d) return;
    S.dernierFocus = document.activeElement; d.classList.add('ml-on'); document.body.classList.add('ml-fige'); S.pile.push({ t: 'dlg', el: id }); S.dlg = id;
  }
  function majFige() { if (!S.pile.length) document.body.classList.remove('ml-fige'); }
  function fermerTop() {
    var t = S.pile.pop(); if (!t) return false;
    if (t.t === 'dlg') { var el = $('#' + t.el); if (el) el.classList.remove('ml-on'); S.dlg = null; majFige(); var f = S.dernierFocus; if (f && f.focus && document.body.contains(f)) { try { f.focus({ preventScroll: true }); } catch (x) {} } }
    else if (t.t === 'tiroir') { var m = $('#ml-mal'), fo = $('#ml-fond'); if (m) m.classList.remove('ml-on'); if (fo) fo.classList.remove('ml-on'); majFige(); }
    return true;
  }
  function ouvrirTiroir() {
    if (S.pile.some(function (x) { return x.t === 'tiroir'; })) return;
    $('#ml-mal').classList.add('ml-on'); $('#ml-fond').classList.add('ml-on'); document.body.classList.add('ml-fige'); S.pile.push({ t: 'tiroir' });
  }
  function fermerTiroir() {
    var i = S.pile.map(function (x) { return x.t; }).lastIndexOf('tiroir');
    if (i >= 0) { S.pile.splice(i, 1); var m = $('#ml-mal'), fo = $('#ml-fond'); if (m) m.classList.remove('ml-on'); if (fo) fo.classList.remove('ml-on'); majFige(); }
  }

  // ——— Choix du groupement ———
  function groupes() { try { return (V2.pharmaPont && V2.pharmaPont.groupements) ? V2.pharmaPont.groupements() : []; } catch (e) { return []; } }
  function apercuGrp(g) {
    S.grpSurvol = g.nom;
    var box = $('#ml-g-apercu'); if (!box) return;
    var pont = V2.pharmaPont, a = null;
    if (pont && pont.pret()) { a = S.apercu[g.nom]; if (!a) { try { a = S.apercu[g.nom] = pont.apercu(g.nom); } catch (e) { a = null; } } }
    var fam = a ? a.familles.map(function (f) { return '<div class="ml-fm"><h3>' + esc(f.famille) + '</h3><p>' + f.produits.map(esc).join(' · ') + '</p></div>'; }).join('') : '';
    box.innerHTML = '<div class="ml-fiche"><div class="ml-band"><small>Listing</small><b>' + esc(g.nom) + '</b><span>' + (a ? a.produits + ' produits · ' : '') + g.actives + (g.actives > 1 ? ' pharmacies clientes' : ' pharmacie cliente') + '</span></div>' +
      (fam || '<div class="ml-fm"><p>Chargement du catalogue…</p></div>') + '</div>' +
      '<p class="ml-nb">Aperçu : les premiers produits de chaque famille. Le listing complet se fabrique à l’envoi, sur les commandes réelles des pharmacies ' + esc(g.nom) + '.</p>';
    if (!a && pont && !pont.pret() && !S.apercuCharge) {
      S.apercuCharge = true;
      pont.charger().then(function () { S.apercuCharge = false; if (S.dlg === 'ml-dlg-grp' && S.grpSurvol === g.nom) apercuGrp(g); }, function () { S.apercuCharge = false; });
    }
  }
  function rendreGrp() {
    var q = norm(($('#ml-gq') || {}).value || '');
    var tout = S.groupes || [];
    var l = tout.filter(function (g) { return !q || norm(g.nom).indexOf(q) >= 0; });
    var liste = $('#ml-g-liste'); if (!liste) return;
    liste.innerHTML = l.length ? l.map(function (g) {
      var dedans = estChoisi('lg:' + g.nom);
      return '<button type="button" class="ml-gr" data-grp="' + esc(g.nom) + '"><span class="ml-tx"><b>' + esc(g.nom) + '</b><small>' + g.actives + (g.actives > 1 ? ' pharmacies clientes' : ' pharmacie cliente') + '</small></span>' +
        (dedans ? '<span class="ml-chip ml-chip--ok">Dans la mallette</span>' : ic('chev')) + '</button>';
    }).join('') : (tout.length ? '<div class="ml-aucun"><b>Aucun groupement ne correspond</b>Vérifiez l’orthographe ou effacez la recherche.</div>'
      : '<div class="ml-aucun"><b>Aucun groupement à proposer pour l’instant</b>Les ventes ne sont pas encore chargées : réessayez dans un instant.</div>');
    if (l.length && (!S.grpSurvol || !l.some(function (g) { return g.nom === S.grpSurvol; }))) apercuGrp(l[0]);
    var fams = $('#ml-g-fams'); if (fams) fams.innerHTML = '';
  }
  function ouvrirGrp() {
    S.groupes = groupes(); S.grpSurvol = ''; S.apercu = {};
    var q = $('#ml-gq'); if (q) { q.value = ''; q.placeholder = 'Chercher parmi les ' + S.groupes.length + ' groupements…'; }
    rendreGrp(); ouvrirDlg('ml-dlg-grp');
    if (V2.pharmaPont) V2.pharmaPont.charger().then(function () { if (S.dlg === 'ml-dlg-grp') { var g = (S.groupes || []).filter(function (x) { return x.nom === S.grpSurvol; })[0]; if (g) apercuGrp(g); } });
    setTimeout(function () { if (window.innerWidth > 760 && q) { try { q.focus({ preventScroll: true }); } catch (x) {} } }, 50);
  }
  function choisirGrp(nom, depuis) {
    var g = (S.groupes || []).filter(function (x) { return x.nom === nom; })[0] || { nom: nom, actives: 0 };
    var id = 'lg:' + nom;
    S.extras[id] = { id: id, kind: 'listing', lk: 'grp', grp: nom, famille: 'listings', titre: 'Listing ' + nom, sous: g.actives + (g.actives > 1 ? ' pharmacies clientes' : ' pharmacie cliente') + ' ' + nom, type: 'pdf', pages: null, ko: null, fabrique: true,
      phrase: 'les produits les plus commandés par les pharmacies ' + nom + ' chez nous' };
    if (S.ajoutes.indexOf(id) < 0) { S.ajoutes.push(id); rendreOnglets(); rendreMur(); }
    var dejaLa = estChoisi(id), r = depuis ? depuis.getBoundingClientRect() : null;
    ajouter(id);
    fermerTop();
    V2.toast(dejaLa ? 'Le listing ' + esc(nom) + ' est déjà dans la mallette' : 'Listing ' + esc(nom) + ' ajouté : il se fabrique au moment de préparer l’envoi');
    if (r && !dejaLa) voler({ getBoundingClientRect: function () { return r; }, animate: true }, S.extras[id]);
  }

  // ——— Choix du destinataire : une pharmacie cliente ou un prospect, cherché par nom, ville, code postal ou titulaire ———
  function cpDe(c) { c = String(c == null ? '' : c).trim(); return /^\d{4}$/.test(c) ? '0' + c : c; }
  function chercherDest(q) {
    var out = [], vus = {}, nq = norm(q);
    if (nq.length < 2) return out;
    var cle = nq.replace(/\s/g, '');
    (V2.pharmacies || []).forEach(function (p) {
      if (out.length >= 12) return;
      var hay = norm((p.name || '') + ' ' + (p.ville || '') + ' ' + cpDe(p.cp));
      if (hay.indexOf(nq) >= 0 || (/^\d+$/.test(cle) && cpDe(p.cp).indexOf(cle) === 0)) { vus[String(p.id)] = 1; out.push({ pid: String(p.id), nom: p.name || 'Pharmacie', ville: p.ville || '', cp: cpDe(p.cp), client: true }); }
    });
    var D = window.PHARMA_FR;
    if (D && D.p) {
      var Pp = D.p;
      if (!D.__mal || D.__mal.length !== Pp.length) {
        D.__mal = new Array(Pp.length);
        for (var z = 0; z < Pp.length; z++) { var pz = Pp[z]; D.__mal[z] = [norm(pz[6]), norm(pz[7]), String(pz[8] || ''), norm(pz[10])]; }
      }
      for (var k = 0; k < Pp.length && out.length < 24; k++) {
        var p = Pp[k], id = String(p[13] || ''); if (!id || vus[id]) continue;
        var np = D.__mal[k];
        if (np[0].indexOf(nq) >= 0 || np[1].indexOf(nq) >= 0 || (np[2] && np[2].indexOf(cle) === 0 && /^\d+$/.test(cle)) || np[3].indexOf(nq) >= 0) {
          vus[id] = 1; out.push({ pid: id, nom: p[6] || p[10] || 'Pharmacie', ville: p[7] || '', cp: p[8] || '', client: false });
        }
      }
    }
    (V2._newph || []).forEach(function (o) {
      if (out.length >= 28) return; var d = o.data || {}, id = String(o.sid); if (vus[id]) return;
      if (norm((d.nom || '') + ' ' + (d.ville || '') + ' ' + (d.cp || '') + ' ' + (d.titulaire || '')).indexOf(nq) >= 0) { vus[id] = 1; out.push({ pid: id, nom: d.nom || 'Prospect', ville: d.ville || '', cp: d.cp || '', client: false }); }
    });
    return out;
  }
  function rendreDest() {
    var liste = $('#ml-d-liste'); if (!liste) return;
    var q = ($('#ml-dq') || {}).value || '';
    S.destRes = chercherDest(q);
    var h = '<button type="button" class="ml-gr" data-dest=""><span class="ml-tx"><b>Sans destinataire</b><small>Mail générique : vous choisirez l’adresse dans votre messagerie</small></span>' + (S.dest ? ic('chev') : '<span class="ml-chip ml-chip--ok">Choisi</span>') + '</button>';
    if (norm(q).length < 2) h += '<div class="ml-aucun"><b>Cherchez une pharmacie</b>Tapez son nom, sa ville, son code postal ou le nom du titulaire. Les clientes et les prospects sont proposés.</div>';
    else if (!S.destRes.length) h += '<div class="ml-aucun"><b>Aucune pharmacie trouvée</b>' + (window.PHARMA_FR ? 'Vérifiez l’orthographe.' : 'La base de toutes les officines se charge : réessayez dans un instant.') + '</div>';
    else h += S.destRes.map(function (r, i) {
      return '<button type="button" class="ml-gr" data-dest="' + i + '"><span class="ml-tx"><b>' + esc(r.nom) + '</b><small>' + esc([r.ville, r.cp].filter(Boolean).join(' · ')) + '</small></span><span class="ml-chip' + (r.client ? ' ml-chip--ok' : '') + '">' + (r.client ? 'Cliente' : 'Prospect') + '</span></button>';
    }).join('');
    liste.innerHTML = h;
  }
  function ouvrirDest() {
    var q = $('#ml-dq'); if (q) q.value = '';
    rendreDest(); ouvrirDlg('ml-dlg-dest');
    if (!window.PHARMA_FR && V2.ensurePharmaFr) V2.ensurePharmaFr(function () { if (S.dlg === 'ml-dlg-dest') rendreDest(); });
    if (V2.loadFiles) V2.loadFiles(['clientsactifs', 'clients', 'officinesinfos']).then(function () {}, function () {});
    setTimeout(function () { if (window.innerWidth > 760 && q) { try { q.focus({ preventScroll: true }); } catch (x) {} } }, 50);
  }
  function choisirDest(idx) {
    if (idx === '' || idx == null) { appliquerDest(null); fermerTop(); return; }
    var r = S.destRes[parseInt(idx, 10)]; if (!r) return;
    fermerTop();
    var pont = V2.pharmaPont, vide = { pid: r.pid, nom: r.nom, ville: r.ville, titulaire: '', email: '', client: r.client, groupement: '', lgo: '' };
    // Tout de suite : ce que les bases savent déjà. Puis, sans rien bloquer : la saisie de l'équipe sur la fiche (e-mail, logiciel).
    var c0 = vide; try { if (pont) c0 = pont.contactTout(r.pid); } catch (e) { c0 = vide; }
    appliquerDest(c0);
    var charge = V2.loadFiles ? V2.loadFiles(['clientsactifs', 'clients']).then(function () {}, function () {}) : Promise.resolve();
    charge.then(function () { return pont ? pont.contact(r.pid) : null; }).then(function (c) {
      if (c && S.dest && S.dest.pid === String(r.pid)) { S.dest = c; if (c.lgo && nomLgo(c.lgo) && !S.lgoTouche) S.lgoF = c.lgo; rendrePied(); if (S.tab === 'lgo') rendreMur(); }
    }, function () {});
  }
  function appliquerDest(c) {
    S.dest = c; S.mailMod = false; S.lgoTouche = false;
    if (c && c.lgo && nomLgo(c.lgo)) S.lgoF = c.lgo; else if (!c) S.lgoF = '';
    // Un listing « pour une cliente » n'a de sens que pour une cliente.
    if (!(c && c.client) && estChoisi('listing-ses-ventes')) { S.sel = S.sel.filter(function (i) { return i !== 'listing-ses-ventes'; }); V2.toast('« Ses ventes et ses opportunités » est retiré : ce listing est pour une pharmacie cliente.', 'warn'); }
    invalider(); rendre(); rendreMur();
    if (c) V2.toast('Destinataire : ' + esc(c.nom));
  }

  // ═══════════════ LE MAIL ═══════════════
  function expediteur() { return (V2.user && V2.user.name) || ''; }
  function composerMail() {
    var docs = selDocs(), dest = S.dest, ton = S.ton, unPdf = S.unPdf, n = docs.length;
    var pdfs = docs.filter(function (d) { return d.type === 'pdf'; });
    var reunis = unPdf && pdfs.length > 1;
    var t = totaux();
    var objet = n === 0 ? 'Documents ' + marque()
      : (dest ? dest.nom + ' · ' : '') + (n === 1 ? docs[0].titre : (unPdf ? 'Votre dossier ' + marque() : 'Vos documents ' + marque()));
    var intro;
    if (n === 0) intro = 'Vous trouverez ci-joint nos documents.';
    else if (ton === 'court') intro = reunis ? 'Voici, réunis en un seul PDF :' : (n > 1 ? 'Voici les documents dont nous avons parlé :' : 'Voici le document dont nous avons parlé :');
    else if (ton === 'detaille') intro = 'Suite à notre échange, je vous adresse ' + (reunis ? 'un dossier unique' + (t.inconnues ? '' : ' de ' + pagesTxt(t.connues + 2)) + ' qui réunit :' : (n > 1 ? 'les ' + n + ' documents suivants :' : 'le document suivant :'));
    else intro = 'Merci pour votre accueil. Comme promis, je vous envoie ' + (reunis ? 'tout ce dont nous avons parlé, réuni dans un seul PDF :' : (n > 1 ? 'les documents dont nous avons parlé :' : 'le document dont nous avons parlé :'));
    var lignes = docs.map(function (d) { return '• ' + d.titre + (ton === 'court' ? '' : ' — ' + d.phrase); });
    var fin;
    if (ton === 'court') fin = 'Je reste disponible.';
    else if (ton === 'detaille') fin = (docs.some(function (d) { return d.id === 'ouverture-compte'; }) ? 'Le formulaire d’ouverture de compte peut m’être retourné par simple réponse à ce mail. ' : '') + 'Je vous appelle dans quelques jours pour en parler, et reste joignable d’ici là.';
    else fin = 'N’hésitez pas à m’appeler si une question se pose : je passe volontiers vous voir pour en parler.';
    var signature = ['Bien cordialement,'].concat(expediteur() ? [expediteur()] : []).concat([marque()]);
    var corps = ['Bonjour,', '', intro, ''].concat(lignes).concat(['', fin, ''], signature).join('\n');
    return { objet: objet, corps: corps, a: dest ? dest.email : '' };
  }
  function lienMail(m) { return 'mailto:' + encodeURIComponent(m.a || '') + '?subject=' + encodeURIComponent(m.objet) + '&body=' + encodeURIComponent(m.corps); }
  var ecritureT = null;
  function ecrire(texte) {
    var ta = $('#ml-m-corps'); if (!ta) return; clearInterval(ecritureT);
    var lignes = texte.split('\n');
    if (reduit) { ta.value = texte; majMailto(); return; }
    var i = 0; ta.value = '';
    ecritureT = setInterval(function () {
      i++; ta.value = lignes.slice(0, i).join('\n'); ta.scrollTop = ta.scrollHeight;
      if (i >= lignes.length) { clearInterval(ecritureT); ta.value = texte; ta.scrollTop = 0; majMailto(); }
    }, 22);
  }
  function majMailto() {
    var o = $('#ml-m-objet'), c = $('#ml-m-corps'), a = $('#ml-m-ouvrir'); if (!o || !c || !a) return;
    S.mailObjet = o.value; S.mailCorps = c.value;
    a.setAttribute('href', lienMail({ a: S.dest ? S.dest.email : '', objet: o.value, corps: c.value }));
  }
  function remplirMail(avecEcriture) {
    var m = composerMail(), dest = S.dest;
    $('#ml-m-objet').value = m.objet;
    $('#ml-m-a').innerHTML = dest ? esc(dest.titulaire || dest.nom) + ' <span>· ' + esc(dest.nom) + (dest.email ? ' · ' + esc(dest.email) : ' · pas d’e-mail connu') + '</span>' : '<span>Vous choisirez l’adresse dans votre messagerie</span>';
    $('#ml-m-titre').textContent = dest ? 'Le mail pour ' + dest.nom : 'Le mail pour votre client';
    $$('#ml-tons [data-ton]').forEach(function (t) { var on = t.getAttribute('data-ton') === S.ton; t.setAttribute('aria-checked', on); t.classList.toggle('on', on); });
    var docs = selDocs(), pj = '';
    if (S.unPdf) {
      pj = (docs.some(function (d) { return d.type === 'pdf'; }) ? '<span class="ml-chip">' + ic('note') + esc(nomFichier('pdf')) + '</span>' : '') +
        docs.filter(function (d) { return d.type !== 'pdf'; }).map(function (d) { return '<span class="ml-chip">' + ic('grid') + esc(fichierNom(d)) + '</span>'; }).join('');
    } else pj = '<span class="ml-chip">' + ic('layers') + esc(nomFichier('zip')) + ' · ' + docs.length + (docs.length > 1 ? ' fichiers' : ' fichier') + '</span>';
    $('#ml-m-pj').innerHTML = pj || '<span class="ml-chip">Aucune pièce jointe</span>';
    S.mailMod = false;
    if (avecEcriture) ecrire(m.corps); else { $('#ml-m-corps').value = m.corps; majMailto(); }
    majMailto();
  }
  function ouvrirMail() { remplirMail(true); ouvrirDlg('ml-dlg-mail'); }
  function copierMail() {
    var txt = 'Objet : ' + $('#ml-m-objet').value + '\n\n' + $('#ml-m-corps').value;
    var ok = function () { V2.toast('Mail copié : collez-le dans votre messagerie'); };
    var repli = function () { var ta = $('#ml-m-corps'); ta.focus(); ta.select(); try { document.execCommand('copy'); ok(); } catch (x) { V2.toast('Copie impossible : sélectionnez le texte à la main', 'warn'); } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, repli); else repli(); } catch (x) { repli(); }
  }
  // Le texte qui part avec la feuille de partage : celui que la personne a relu (et peut-être modifié), sinon le texte proposé.
  function texteEnvoi() {
    if (S.mailMod && (S.mailObjet || S.mailCorps)) return { objet: S.mailObjet, corps: S.mailCorps };
    var m = composerMail(); return { objet: m.objet, corps: m.corps };
  }

  // ═══════════════ LES FICHIERS ═══════════════
  function nomFichier(ext) { return nomPropre(marque() + (S.dest ? ' — ' + S.dest.nom : '')) + '.' + ext; }
  function fichierNom(d) { return d.nomFichier || (nomPropre(d.titre) + (d.type === 'pdf' ? '.pdf' : '.xlsx')); }
  function charger(src, globale) {
    if (window[globale]) return Promise.resolve();
    return new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('Chargement impossible : ' + globale)); }; document.head.appendChild(s); });
  }
  function txSb() { return (V2.sb && V2.sb()) || null; }
  function recupererFichier(d) {
    if (d.kind === 'local') return Promise.resolve(d.fichier);
    if (d.kind === 'listing') {
      var pont = V2.pharmaPont; if (!pont) return Promise.resolve(null);
      var o = { pid: S.dest ? S.dest.pid : '', grp: d.grp, nom: S.dest ? S.dest.nom : '' };
      return Promise.resolve(pont.listing(d.lk, o)).then(function (f) { if (f && !(f.name && f.size)) return f; if (f) { var nf = new File([f], nomPropre(d.titre) + '.pdf', { type: 'application/pdf' }); return nf; } return null; });
    }
    if (d.kind === 'equipe') {
      var c = txSb(); if (!c || !c.storage) return Promise.resolve(null);
      return c.storage.from(TX_BUCKET).download(d.bucket).then(function (r) { return (r && r.data && !r.error) ? new File([r.data], fichierNom(d), { type: mime(d.bucket) }) : null; });
    }
    return fetch(encodeURI(d.url)).then(function (r) { if (!r.ok) throw new Error(d.url); return r.blob(); }).then(function (b) { return new File([b], fichierNom(d), { type: d.type === 'pdf' ? 'application/pdf' : mime('x.xlsx') }); });
  }
  // Les polices standard d'un PDF ne savent écrire que le jeu WinAnsi : on remplace ce qu'elles ne savent pas dessiner.
  function propre(t) {
    return String(t == null ? '' : t).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, '...').replace(/[\u00A0\u202F\u2009]/g, ' ')
      .replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2022\u20AC\u0152\u0153]/g, '');
  }
  function lignesDe(texte, font, taille, largeur) {
    var mots = propre(texte).split(' '), out = [], cur = '';
    mots.forEach(function (m) {
      var essai = cur ? cur + ' ' + m : m;
      if (font.widthOfTextAtSize(essai, taille) <= largeur || !cur) cur = essai; else { out.push(cur); cur = m; }
    });
    if (cur) out.push(cur);
    return out;
  }
  // Un seul PDF : page de garde, page de sommaire numérotée, puis les VRAIES pages de chaque PDF dans l'ordre de la mallette.
  function assembler(recus) {
    return charger(PDFLIB, 'PDFLib').then(function () {
      var L = window.PDFLib, bleu = L.rgb(0, 0.314, 0.902), encre = L.rgb(0.059, 0.078, 0.125), gris = L.rgb(0.42, 0.45, 0.52), blanc = L.rgb(1, 1, 1);
      var pdfs = recus.filter(function (r) { return r.d.type === 'pdf'; }), autres = recus.filter(function (r) { return r.d.type !== 'pdf'; });
      var out;
      return L.PDFDocument.create().then(function (pdf) {
        out = pdf;
        return Promise.all([pdf.embedFont(L.StandardFonts.Helvetica), pdf.embedFont(L.StandardFonts.HelveticaBold)]);
      }).then(function (f) {
        var reg = f[0], gras = f[1];
        // 1. on ouvre chaque PDF pour compter ses VRAIES pages
        return pdfs.reduce(function (p, r) {
          return p.then(function () { return r.file.arrayBuffer(); }).then(function (buf) { return L.PDFDocument.load(buf, { ignoreEncryption: true }); }).then(function (src) { r.src = src; r.n = src.getPageCount(); });
        }, Promise.resolve()).then(function () {
          var W = 595, H = 842, date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), dest = S.dest;
          var PAR_PAGE = 15, nSom = Math.max(1, Math.ceil((pdfs.length + (autres.length ? autres.length + 1 : 0)) / PAR_PAGE));
          var total = 1 + nSom + pdfs.reduce(function (s, r) { return s + r.n; }, 0);
          // 2. page de garde
          var g = out.addPage([W, H]);
          g.drawRectangle({ x: 0, y: 0, width: W, height: H, color: L.rgb(0.965, 0.973, 0.99) });
          g.drawRectangle({ x: 0, y: H - 330, width: W, height: 330, color: bleu });
          g.drawText(propre(marque()).toUpperCase(), { x: 48, y: H - 72, size: 12, font: gras, color: blanc });
          g.drawText(dest ? 'PREPARE POUR' : 'VOTRE DOSSIER', { x: 48, y: H - 170, size: 11, font: gras, color: L.rgb(0.8, 0.87, 1) });
          var titre = dest ? dest.nom : 'Documents ' + marque(), y = H - 212;
          lignesDe(titre, gras, 30, W - 96).slice(0, 3).forEach(function (ln) { g.drawText(ln, { x: 48, y: y, size: 30, font: gras, color: blanc }); y -= 36; });
          if (dest && dest.ville) g.drawText(propre(dest.ville), { x: 48, y: y - 4, size: 14, font: reg, color: L.rgb(0.88, 0.92, 1) });
          g.drawText(propre(date), { x: 48, y: H - 310, size: 13, font: reg, color: L.rgb(0.88, 0.92, 1) });
          g.drawText(propre(pdfs.length + (pdfs.length > 1 ? ' documents' : ' document') + ' · ' + (total - 1 - nSom) + ' pages'), { x: 48, y: H - 400, size: 15, font: gras, color: encre });
          g.drawText('Votre interlocuteur', { x: 48, y: 150, size: 10, font: reg, color: gris });
          g.drawText(propre(expediteur() || marque()), { x: 48, y: 130, size: 16, font: gras, color: encre });
          g.drawText(propre(marque()), { x: 48, y: 110, size: 11, font: reg, color: gris });
          // 3. sommaire numéroté
          var entrees = pdfs.map(function (r) { return { d: r.d, n: r.n, pdf: true }; });
          if (autres.length) { entrees.push({ titre: 'Fichiers joints à part (Excel)' }); autres.forEach(function (r) { entrees.push({ d: r.d, pdf: false }); }); }
          var page = 1 + nSom + 1, idx = 0, sp = null, ys = 0;
          entrees.forEach(function (e, i) {
            if (i % PAR_PAGE === 0) {
              sp = out.addPage([W, H]); ys = H - 150;
              sp.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: bleu });
              sp.drawText('Sommaire', { x: 48, y: H - 90, size: 26, font: gras, color: encre });
              sp.drawText(propre(dest ? dest.nom : marque()), { x: 48, y: H - 112, size: 11, font: reg, color: gris });
            }
            if (!e.d) { sp.drawText(propre(e.titre), { x: 48, y: ys, size: 12, font: gras, color: gris }); ys -= 40; return; }
            idx++;
            sp.drawText(String(idx).padStart(2, '0'), { x: 48, y: ys, size: 12, font: gras, color: bleu });
            lignesDe(e.d.titre, gras, 12, W - 270).slice(0, 2).forEach(function (ln, k) { sp.drawText(ln, { x: 82, y: ys - k * 14, size: 12, font: gras, color: encre }); });
            var droite = e.pdf ? (e.n > 1 ? 'pages ' + page + ' à ' + (page + e.n - 1) : 'page ' + page) : 'fichier joint à part';
            var wd = reg.widthOfTextAtSize(droite, 11);
            sp.drawText(propre(droite), { x: W - 48 - wd, y: ys, size: 11, font: reg, color: gris });
            if (e.pdf) page += e.n;
            ys -= 40;
          });
          // 4. les vraies pages, dans l'ordre
          return pdfs.reduce(function (p, r) {
            return p.then(function () { return out.copyPages(r.src, r.src.getPageIndices()); }).then(function (pages) { pages.forEach(function (pg) { out.addPage(pg); }); });
          }, Promise.resolve()).then(function () { return out.save(); }).then(function (octets) {
            return { file: new File([octets], nomFichier('pdf'), { type: 'application/pdf' }), pages: total, parDoc: pdfs.map(function (r) { return { id: r.d.id, n: r.n }; }) };
          });
        });
      });
    });
  }
  function preparer() {
    if (S.busy || !S.sel.length) return;
    var docs = selDocs(); if (!docs.length) return;
    S.busy = 'prepare'; S.etape = 0; S.total = docs.length; S.prets = null; rendrePied();
    var recus = [], echecs = [], chaine = Promise.resolve();
    docs.forEach(function (d) {
      chaine = chaine.then(function () {
        S.etape++; rendrePied();
        return recupererFichier(d).then(function (f) { if (f) recus.push({ d: d, file: f }); else echecs.push(d.titre); }, function (e) { console.error('[mallette]', d.id, e); echecs.push(d.titre); });
      });
    });
    chaine.then(function () {
      if (!recus.length) throw new Error('aucun');
      if (S.unPdf && recus.some(function (r) { return r.d.type === 'pdf'; })) {
        var xl = recus.filter(function (r) { return r.d.type !== 'pdf'; });
        return assembler(recus).then(function (a) {
          S.prets = { unPdf: true, files: [a.file].concat(xl.map(function (r) { return r.file; })), pages: a.pages, xl: xl.length, parDoc: a.parDoc, docs: recus.map(function (r) { return r.d; }) };
        });
      }
      S.prets = { unPdf: false, files: recus.map(function (r) { return r.file; }), xl: recus.filter(function (r) { return r.d.type !== 'pdf'; }).length, docs: recus.map(function (r) { return r.d; }) };
    }).then(function () {
      if (echecs.length) V2.toast('Non préparé : ' + esc(echecs.join(', ')), 'error');
    }, function (e) {
      console.error('[mallette] préparation', e);
      V2.toast(echecs.length ? 'Rien n’a pu être préparé : ' + esc(echecs.join(', ')) : 'La préparation a échoué : vérifiez votre connexion et réessayez', 'error');
    }).then(function () { S.busy = ''; rendrePied(); });
  }
  function telechargerBlob(blob, nom) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function nomUnique(nom, pris) {
    var base = nom, k = 2; while (pris[nom]) { var i = base.lastIndexOf('.'); nom = (i > 0 ? base.slice(0, i) : base) + ' (' + k + ')' + (i > 0 ? base.slice(i) : ''); k++; }
    pris[nom] = 1; return nom;
  }
  function telecharger() {
    var p = S.prets; if (!p) return;
    var btn = $('[data-action="telecharger"]');
    if (!p.unPdf && p.files.length > 1) {
      if (btn) btn.disabled = true;
      return charger(JSZIP, 'JSZip').then(function () {
        var zip = new window.JSZip(), pris = {};
        p.files.forEach(function (f) { zip.file(nomUnique(f.name, pris), f); });
        return zip.generateAsync({ type: 'blob' });
      }).then(function (b) { telechargerBlob(b, nomFichier('zip')); V2.toast('Votre dossier de fichiers est téléchargé'); tracer(p); }, function () { V2.toast('Le dossier .zip n’a pas pu être fabriqué : réessayez', 'error'); })
        .then(function () { if (btn) btn.disabled = false; });
    }
    p.files.forEach(function (f, i) { setTimeout(function () { telechargerBlob(f, f.name); }, i * 400); });
    V2.toast(p.files.length > 1 ? p.files.length + ' fichiers téléchargés — à joindre au mail' : 'Fichier téléchargé — à joindre au mail');
    tracer(p);
  }
  // Une note par lot, dans la fiche de la pharmacie (comme « Transmettre ») ; rien sans destinataire.
  function tracer(p) {
    if (!S.dest || S.tracee === p || !V2.notes || !V2.notes.addAuto) return;
    S.tracee = p;
    var lignes = (p.docs || []).map(function (d) { return '- ' + d.titre; });
    var corps = 'Documents préparés pour envoi en pièces jointes (La Mallette) :\n' + lignes.join('\n');
    V2.notes.addAuto('client', S.dest.pid, corps).then(function (ok) {
      if (!ok) { S.tracee = null; V2.toast('La trace dans les notes de la fiche n’a pas pu s’enregistrer', 'warn'); }
    });
  }
  function envoyer() {
    var p = S.prets; if (!p) return;
    var tt = texteEnvoi();
    try {
      if (canShare(p.files)) {
        // Le clic EST le geste : le fichier est déjà prêt, la feuille de partage s'ouvre tout de suite (Safari refuse sinon).
        navigator.share({ files: p.files, title: tt.objet, text: tt.corps })
          .then(function () { tracer(p); })
          .catch(function (e) { if (!e || e.name !== 'AbortError') { telecharger(); } });
        return;
      }
    } catch (e) {}
    telecharger();
  }

  // ——— Dépôt d'un PDF ou d'un Excel : même seau que Marketing › Documents partagés et « Transmettre » ———
  function chargerEquipe() {
    var c = txSb();
    if (!c || !c.storage) { S.equipe = []; S.equipeErr = 'Connexion requise pour lire les documents de l’équipe.'; return Promise.resolve(); }
    return c.storage.from(TX_BUCKET).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } }).then(function (r) {
      if (r.error) { S.equipe = []; S.equipeErr = 'Les documents de l’équipe sont illisibles (' + (r.error.message || 'erreur') + ').'; return; }
      S.equipeErr = '';
      S.equipe = (r.data || []).filter(function (f) { return f.name && f.id && f.name !== '.emptyFolderPlaceholder'; }).map(function (f) { return { name: f.name, size: (f.metadata || {}).size || 0 }; });
    }).catch(function () { S.equipe = []; S.equipeErr = 'Les documents de l’équipe sont injoignables : réessayez dans un instant.'; });
  }
  function recevoir(files) {
    var all = Array.prototype.slice.call(files || []), ok = all.filter(function (f) { return /\.(pdf|xlsx|xls)$/i.test(f.name); });
    if (!ok.length) { V2.toast('Choisissez un fichier PDF ou Excel.', 'warn'); return; }
    var c = txSb(), echecs = [], ajoutes = [], locaux = [], chaine = Promise.resolve();
    ok.forEach(function (f) {
      chaine = chaine.then(function () {
        if (!c || !c.storage) { locaux.push(f); return; }
        var cle = Date.now() + '-' + Math.floor(Math.random() * 1000) + '__' + sanit(f.name);
        return c.storage.from(TX_BUCKET).upload(cle, f, { contentType: mime(f.name), upsert: false }).then(function (r) {
          if (r && r.error) { echecs.push(f.name + ' (' + (r.error.message || 'refusé') + ')'); locaux.push(f); } else ajoutes.push(cle);
        }, function () { echecs.push(f.name); locaux.push(f); });
      });
    });
    chaine.then(function () { return ajoutes.length ? chargerEquipe() : null; }).then(function () {
      ajoutes.forEach(function (cle) { S.sel.push('eq:' + cle); });
      locaux.forEach(function (f) {
        var id = 'local:' + f.name + ':' + f.size, x = isXls(f.name);
        S.extras[id] = { id: id, kind: 'local', famille: 'equipe', titre: f.name.replace(/\.[^.]+$/, ''), sous: 'Ajouté à l’instant', type: x ? 'xlsx' : 'pdf', pages: null, ko: Math.round(f.size / 1024), fichier: f, nomFichier: f.name, phrase: 'un document complémentaire' };
        if (S.ajoutes.indexOf(id) < 0) S.ajoutes.push(id);
        if (S.sel.indexOf(id) < 0) S.sel.push(id);
      });
      S.tab = 'equipe'; rendreOnglets(); rendreMur(); surChange();
      if (locaux.length && !ajoutes.length) V2.toast('Ajouté pour cet envoi seulement : le dépôt pour l’équipe n’a pas abouti' + (echecs.length ? ' (' + esc(echecs.join(', ')) + ')' : ''), 'warn');
      else if (echecs.length) V2.toast('Non déposé pour l’équipe : ' + esc(echecs.join(', ')), 'warn');
      else V2.toast(ajoutes.length > 1 ? ajoutes.length + ' fichiers ajoutés pour toute l’équipe' : 'Fichier ajouté pour toute l’équipe');
    });
  }

  // ═══════════════ LA PAGE ═══════════════
  function gabarit() {
    return '<div class="v2-u ml-page" id="ml-root">' +
      '<main class="ml-shell" id="ml-contenu">' +
        '<section class="ml-biblio" aria-label="Bibliothèque">' +
          '<div class="ml-tete"><div><h1 class="v2-titre">La Mallette</h1><p class="v2-sous">Les documents à envoyer. Touchez un document : il part dans votre mallette, prêt à être envoyé.</p></div>' +
            '<label class="v2-champ ml-recherche">' + ic('search') + '<input type="text" id="ml-q" placeholder="Rechercher un document…" aria-label="Rechercher un document" autocomplete="off"></label></div>' +
          '<div class="ml-barre"><div class="v2-tabs" role="tablist" aria-label="Familles de documents" id="ml-onglets"></div></div>' +
          '<div id="ml-mur"></div>' +
        '</section>' +
        '<aside class="ml-mal" id="ml-mal" aria-label="Ma mallette">' +
          '<div class="ml-mal-h"><div class="ml-pile3" aria-hidden="true"></div>' +
            '<div class="ml-mal-t"><div class="ml-big"><b data-compte>0</b><span id="ml-lib-docs">documents</span></div><p id="ml-sous"></p></div>' +
            '<button type="button" class="ml-lien" id="ml-vider">Vider</button>' +
            '<button type="button" class="ml-pbtn ml-fermer" id="ml-fermer-tiroir" aria-label="Fermer la mallette">' + ic('x') + '</button></div>' +
          '<div class="ml-mal-m"><div class="v2-tabs ml-plein" role="radiogroup" aria-label="Forme de l’envoi" id="ml-mode">' +
            '<button type="button" class="v2-tab on" role="radio" aria-checked="true" data-mode="unique">Un seul PDF</button>' +
            '<button type="button" class="v2-tab" role="radio" aria-checked="false" data-mode="separes">Fichiers séparés</button></div>' +
            '<p class="ml-bilan" id="ml-bilan" aria-live="polite"></p></div>' +
          '<ol class="ml-liste ml-mode-unique" id="ml-liste" aria-label="Documents dans la mallette"></ol>' +
          '<div class="ml-mal-f" id="ml-pied"></div>' +
        '</aside>' +
      '</main></div>';
  }
  // Tout ce qui est « fixed » (barre du bas, fond, fenêtres) vit sur <body> : la racine de l'app porte une transformation d'entrée (mo-view-in)
  // qui ferait de chaque élément fixe un élément collé à la PAGE entière, et non à la fenêtre (même règle que le tiroir de l'accueil).
  function gabaritHors() {
    return '<div class="ml-cap" id="ml-cap"><div class="ml-pile3" aria-hidden="true"></div><div class="ml-cap-t"><b data-compte>0</b> documents<small id="ml-cap-sous"></small></div>' +
        '<button type="button" class="v2-btn v2-btn-primary" data-ouvre="sortie">Ouvrir la mallette</button></div>' +
      '<div class="ml-fond" id="ml-fond"></div>' +
      // Fenêtre : listing d'un groupement
      '<div class="ml-dlg-fond" id="ml-dlg-grp" role="dialog" aria-modal="true" aria-labelledby="ml-g-titre"><div class="ml-dlg">' +
        '<div class="ml-dlg-h"><div class="ml-tx"><h2 id="ml-g-titre">Fabriquer un listing</h2><p>Choisissez le groupement de la pharmacie : le listing reprend les produits que ses pharmacies commandent le plus chez nous.</p></div>' +
          '<button type="button" class="ml-pbtn" data-fermer aria-label="Fermer">' + ic('x') + '</button></div>' +
        '<div class="ml-dlg-c"><div class="ml-grp-2"><div class="ml-grp-l">' +
          '<label class="v2-champ">' + ic('search') + '<input type="text" id="ml-gq" placeholder="Chercher un groupement…" aria-label="Chercher un groupement" autocomplete="off"></label>' +
          '<div class="ml-grp-fams" id="ml-g-fams"></div><div class="ml-grp-liste" id="ml-g-liste"></div></div>' +
          '<div class="ml-grp-r" id="ml-g-apercu"></div></div></div></div></div>' +
      // Fenêtre : le destinataire
      '<div class="ml-dlg-fond" id="ml-dlg-dest" role="dialog" aria-modal="true" aria-labelledby="ml-d-titre"><div class="ml-dlg ml-dlg-etroit">' +
        '<div class="ml-dlg-h"><div class="ml-tx"><h2 id="ml-d-titre">À qui envoyez-vous ?</h2><p>Une pharmacie cliente ou un prospect : son nom, sa ville et son adresse e-mail s’ajoutent au mail et à la page de garde.</p></div>' +
          '<button type="button" class="ml-pbtn" data-fermer aria-label="Fermer">' + ic('x') + '</button></div>' +
        '<div class="ml-dlg-c"><label class="v2-champ">' + ic('search') + '<input type="text" id="ml-dq" placeholder="Nom, ville, code postal ou titulaire…" aria-label="Chercher une pharmacie" autocomplete="off"></label>' +
          '<div class="ml-grp-liste ml-dest-liste" id="ml-d-liste"></div></div></div></div>' +
      // Fenêtre : le mail
      '<div class="ml-dlg-fond" id="ml-dlg-mail" role="dialog" aria-modal="true" aria-labelledby="ml-m-titre"><div class="ml-dlg ml-dlg-mail">' +
        '<div class="ml-dlg-h"><div class="ml-tx"><h2 id="ml-m-titre">Le mail pour votre client</h2><p>Relisez-le, modifiez-le comme vous voulez : rien ne part tant que vous n’avez pas envoyé.</p></div>' +
          '<button type="button" class="ml-pbtn" data-fermer aria-label="Fermer">' + ic('x') + '</button></div>' +
        '<div class="ml-dlg-c">' +
          '<div class="ml-champ"><span class="ml-lb">À</span><div class="ml-a" id="ml-m-a"></div></div>' +
          '<div class="ml-champ"><span class="ml-lb">Ton du message</span><div class="v2-tabs ml-plein" role="radiogroup" aria-label="Ton du message" id="ml-tons">' +
            '<button type="button" class="v2-tab" role="radio" aria-checked="false" data-ton="court">Court</button>' +
            '<button type="button" class="v2-tab on" role="radio" aria-checked="true" data-ton="chaleureux">Chaleureux</button>' +
            '<button type="button" class="v2-tab" role="radio" aria-checked="false" data-ton="detaille">Détaillé</button></div></div>' +
          '<div class="ml-champ"><label for="ml-m-objet">Objet</label><input type="text" id="ml-m-objet" autocomplete="off"></div>' +
          '<div class="ml-champ"><label for="ml-m-corps">Message</label><textarea id="ml-m-corps" data-mail-corps spellcheck="true"></textarea></div>' +
          '<div class="ml-champ"><span class="ml-lb">Pièces jointes à l’envoi</span><div class="ml-pj" id="ml-m-pj"></div></div>' +
          '<p class="ml-honnete">« Ouvrir dans Mail » ne reprend que le texte. Pour joindre les fichiers, utilisez « Préparer l’envoi » puis « Envoyer » : la feuille de partage de l’appareil joint toutes les pièces toute seule. Sinon, « Télécharger » les dépose dans vos Téléchargements.</p>' +
        '</div>' +
        '<div class="ml-dlg-f"><button type="button" class="v2-btn v2-btn-ghost" id="ml-copier">' + ic('note') + 'Copier le mail</button>' +
          '<a class="v2-btn v2-btn-primary" id="ml-m-ouvrir" href="#">' + ic('mail') + 'Ouvrir dans Mail</a></div>' +
      '</div></div>' +
    '';
  }

  function surClic(ev) {
    var t = ev.target;
    var dd = t.closest('[data-doc]');
    if (dd) { var id = dd.getAttribute('data-doc'); if (basculer(id)) voler($('.ml-sheet', dd), doc(id)); return; }
    var tabB = t.closest('[data-tab]');
    if (tabB) { S.tab = tabB.getAttribute('data-tab'); rendreOnglets(); rendreMur(); if (S.tab === 'equipe' && S.equipe === null) chargerEquipe().then(function () { rendreOnglets(); rendreMur(); }); return; }
    if (t.closest('#ml-tout-voir')) { S.q = ''; var qi = $('#ml-q'); if (qi) qi.value = ''; S.tab = 'tout'; rendreOnglets(); rendreMur(); return; }
    var act = t.closest('[data-action]');
    if (act && !act.disabled) {
      var a = act.getAttribute('data-action');
      if (a === 'listing-grp') { ouvrirGrp(); return; }
      if (a === 'mail') { ouvrirMail(); return; }
      if (a === 'dest') { ouvrirDest(); return; }
      if (a === 'preparer') { preparer(); return; }
      if (a === 'envoyer') { envoyer(); return; }
      if (a === 'telecharger') { telecharger(); return; }
      if (a === 'modifier') { S.prets = null; rendrePied(); return; }
    }
    var g = t.closest('[data-grp]'); if (g) { choisirGrp(g.getAttribute('data-grp'), g); return; }
    var de = t.closest('[data-dest]'); if (de) { choisirDest(de.getAttribute('data-dest')); return; }
    var ouv = t.closest('[data-ouvre]'); if (ouv) { var w = ouv.getAttribute('data-ouvre'); if (w === 'sortie') ouvrirTiroir(); else if (w === 'grp') ouvrirGrp(); return; }
    var mv = t.closest('[data-mv]');
    if (mv) {
      var row = mv.closest('[data-row]'), rid = row.getAttribute('data-row'), pas = parseInt(mv.getAttribute('data-mv'), 10);
      var avant = {}; $$('[data-row]').forEach(function (r) { avant[r.getAttribute('data-row')] = r.getBoundingClientRect().top; });
      deplacer(rid, pas);
      $$('[data-row]').forEach(function (r) {
        var k = r.getAttribute('data-row'), dy = (avant[k] || 0) - r.getBoundingClientRect().top;
        if (!reduit && dy && r.animate) r.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.32,.72,0,1)' });
      });
      var nb = $('[data-row="' + rid.replace(/["\\]/g, '\\$&') + '"] [data-mv="' + pas + '"]'); if (nb && !nb.disabled) nb.focus({ preventScroll: true });
      return;
    }
    var rm = t.closest('[data-rm]');
    if (rm) {
      var r2 = rm.closest('[data-row]'), id2 = r2.getAttribute('data-row');
      if (!reduit && r2.animate) { r2.animate([{ transform: 'none' }, { transform: 'translateX(60px) scale(.96)' }], { duration: 180, easing: 'ease-in' }).onfinish = function () { retirer(id2); }; }
      else retirer(id2);
      return;
    }
    var md = t.closest('#ml-mode [data-mode]'); if (md) { S.unPdf = md.getAttribute('data-mode') === 'unique'; invalider(); rendre(); return; }
    var tn = t.closest('#ml-tons [data-ton]'); if (tn) { S.ton = tn.getAttribute('data-ton'); remplirMail(true); return; }
    if (t.closest('#ml-vider')) { if (S.sel.length) { vider(); V2.toast('Mallette vidée'); } return; }
    if (t.closest('[data-fermer]')) { fermerTop(); return; }
    if (t.closest('#ml-fermer-tiroir') || t.id === 'ml-fond') { fermerTiroir(); return; }
    if (t.classList && t.classList.contains('ml-dlg-fond')) { fermerTop(); return; }
    if (t.closest('#ml-copier')) { copierMail(); return; }
  }

  function brancher(racines) {
    function surInput(ev) {
      var id = ev.target.id;
      if (id === 'ml-q') { S.q = ev.target.value.trim(); rendreMur(); }
      else if (id === 'ml-gq') rendreGrp();
      else if (id === 'ml-dq') rendreDest();
      else if (id === 'ml-m-objet') { S.mailMod = true; majMailto(); }
      else if (id === 'ml-m-corps') { S.mailMod = true; clearInterval(ecritureT); majMailto(); }
    }
    function surChangement(ev) {
      if (ev.target.id === 'ml-lgo-f') { S.lgoF = ev.target.value; S.lgoTouche = true; rendreMur(); }
      if (ev.target.id === 'ml-fichier') { recevoir(ev.target.files); ev.target.value = ''; }
    }
    racines.forEach(function (el) { el.addEventListener('click', surClic); el.addEventListener('input', surInput); el.addEventListener('change', surChangement); });
    var lg = $('#ml-g-liste');
    var survol = function (ev) { var b = ev.target.closest('[data-grp]'); if (b) { var g = (S.groupes || []).filter(function (x) { return x.nom === b.getAttribute('data-grp'); })[0]; if (g && g.nom !== S.grpSurvol) apercuGrp(g); } };
    if (lg) { lg.addEventListener('mouseover', survol); lg.addEventListener('focusin', survol); }
    // dépôt par glisser-déposer : la colonne de la mallette et la tuile de dépôt
    function zone(z, cls) {
      ['dragenter', 'dragover'].forEach(function (n) { z.addEventListener(n, function (ev) { if (ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types || [], 'Files') >= 0) { ev.preventDefault(); z.classList.add(cls); } }); });
      z.addEventListener('dragleave', function () { z.classList.remove(cls); });
      z.addEventListener('drop', function (ev) { ev.preventDefault(); z.classList.remove(cls); if (ev.dataTransfer && ev.dataTransfer.files.length) recevoir(ev.dataTransfer.files); });
    }
    zone($('#ml-mal'), 'ml-depose');
    racines[0].addEventListener('dragenter', function (ev) { var z = ev.target.closest && ev.target.closest('#ml-zone-depot'); if (z && !z._lie) { z._lie = true; zone(z, 'ml-depose'); } });
  }
  // Sous 1100 px la mallette est un tiroir « fixed » : elle passe sur <body> avec le reste de la couche fixe ; au-dessus, elle revient dans la page.
  function placerMal() {
    var mal = $('#ml-mal'), hors = $('#ml-hors'), shell = $('#ml-contenu'); if (!mal || !hors || !shell) return;
    var tiroir = window.innerWidth < 1100;
    if (tiroir && mal.parentNode !== hors) hors.appendChild(mal);
    else if (!tiroir && mal.parentNode !== shell) { fermerTiroir(); shell.appendChild(mal); }
  }
  function retirerHors() { var h = document.getElementById('ml-hors'); if (h && h.parentNode) h.parentNode.removeChild(h); document.body.classList.remove('ml-fige'); S.pile = []; S.dlg = null; }

  // Échap ferme la fenêtre ou le tiroir du dessus ; le défilement du fond est rendu en quittant l'écran.
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && V2.route && V2.route.name === 'mallette' && S.pile.length) { if (fermerTop()) ev.preventDefault(); }
  });
  window.addEventListener('hashchange', function () {
    S.pile = []; S.dlg = null; document.body.classList.remove('ml-fige');
    if (!/^#mallette(\/|$)/.test(location.hash || '')) retirerHors();
  });
  window.addEventListener('resize', function () { if (document.getElementById('ml-hors')) { placerMal(); if (window.innerWidth >= 1100) fermerTiroir(); } });

  V2.pages.mallette = {
    needs: [],
    render: function (root) {
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      if (isOpso()) { root.innerHTML = top + '<div class="v2-wrap"><div class="v2-empty"><div class="v2-empty-t">La Mallette n’est pas disponible ici</div></div></div>'; return; }
      var rouvrir = S.dlg;
      retirerHors();
      root.innerHTML = top + gabarit();
      var hors = document.createElement('div'); hors.id = 'ml-hors'; hors.className = 'v2-u ml-hors'; hors.innerHTML = gabaritHors();
      document.body.appendChild(hors);
      var el = $('#ml-root', root);
      placerMal();
      brancher([el, hors]);
      $$('.ml-pile3').forEach(function (p) { p.innerHTML = pileHtml(); });
      // La première ouverture n'est pas vide : les trois documents de tous les rendez-vous sont déjà dans la mallette.
      if (!S.init) { S.init = true; S.sel = ['presentation-groupements', 'plaquette-prospection', 'ouverture-compte'].filter(function (i) { return !!doc(i); }); }
      S.sel = S.sel.filter(function (i) { return !!doc(i); });
      if (S.equipe === null && S.equipe !== undefined && !S.chargementEquipe) { S.chargementEquipe = true; chargerEquipe().then(function () { S.chargementEquipe = false; if (V2.route && V2.route.name === 'mallette' && $('#ml-mur')) { rendreOnglets(); rendreMur(); rendre(); } }); }
      rendreOnglets(); rendreMur(); rendre();
      if (rouvrir === 'ml-dlg-mail') ouvrirMail(); else if (rouvrir === 'ml-dlg-grp') ouvrirGrp(); else if (rouvrir === 'ml-dlg-dest') ouvrirDest();
    }
  };

  // Hors du classement et de l'accueil : utilitaire pour les sondes et pour l'aide.
  V2.mallette = {
    etat: function () { return { sel: S.sel.slice(), dest: S.dest, unPdf: S.unPdf, prets: !!S.prets }; },
    catalogue: function () { return FIXES.concat(LGO_DOCS).map(function (d) { return { id: d.id, url: d.url, pages: d.pages, type: d.type, ko: d.ko }; }); }
  };
})();
