/* ═══════════════════════════════════════════════════════════════════
   OPSO Santé · « Le catalogue » — côté GROSSISTE (ventes Intégral), A4 multipage.
   Demande de Will (30/09/2026) : un catalogue GLOBAL, pas « du mois », où chaque
   produit est classé par le NOMBRE DE PHARMACIES qui le commandent.
   - Classement : pharmacies du RÉSEAU Intégral (PROD_RESEAU, generate_prod_reseau.mjs)
     + « dont N OPSO », compté en direct sur V2.sales (le compte OPSO ne reçoit que
     ses adhérents).
   - Prix : PPHT + prix net (V2.bestPrice sur BENCHMARK recollé à BENCH_COND).
     EXCEPTION décidée par Will pour CE catalogue OPSO seulement. Génériques et non
     remboursables : un seul prix, le net. Jamais de pourcentage ni de prix barré.
   - Période : LUE dans PROD_RESEAU.periode, jamais écrite en dur.
   - « Les prix OPSO Santé » (20/10/2026) : page 2, rendue par opso-prix.js (V2.opsoPrix.pourCatalogue), mêmes prix et même contrôle
     que l'écran « Les prix ». Fichier opso-prix-negocies.json illisible → la page et son entrée de sommaire disparaissent.
   - Offre Privilège OPSO Santé : page 3 (avant le 20/10 : page 2), prix LUS dans le fichier privé
     donnees-protegees/opso-offre-privilege.json (jamais dans le code), plus les lignes de l'« Offre spéciale » de opso-prix
     que le fichier ne contient pas (même offre, même mécanique). Fichier illisible → page absente.
   Prend la route « marketing » (chargé APRÈS v2-marketing.js, qui reste en place).
   Sortie : impression navigateur A4 (photos offilog.fr sans CORS, comme la fiche).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var eur = function (v) { return V2.fmtEur ? V2.fmtEur(v) : v.toFixed(2).replace('.', ',') + ' €'; };
  var ent = function (v) { return Number(v).toLocaleString('fr-FR'); };

  // Rayons = tranches PROD_STATS.f. `deux` : PPHT + prix net ; sinon le net seul.
  // 'gen' hors répertoire ANSM (OPSO_NONGEN : Spagulax, Permixon…) → rangé en remboursable ('pr').
  var PAR_PAGE = 22;
  var RAYONS = [
    { k: 'remb', label: 'Médicaments remboursables', f: { pr_low: 1, pr_mid: 1, pr_high: 1, pr: 1 }, pages: 2, deux: true, court: 'Remboursables' },
    // « Autres génériques » (Guy, 21/10/2026) : on y attend Biogaran, Viatris, Teva… que le rayon ne contient pas.
    { k: 'gen', label: 'Autres génériques', f: { gen: 1 }, pages: 1, deux: false, court: 'Autres génériques' },
    { k: 'biosim', label: 'Biosimilaires', f: { biosim: 1 }, pages: 1, deux: true, court: 'Biosimilaires' },
    { k: 'nr', label: 'Non remboursables', f: { nr: 1 }, pages: 2, deux: false, court: 'Non remboursables' }
  ];
  var TITRE = 'Le catalogue';   // titre de la couverture ET de l’Excel
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function periodeTexte(p) {
    if (!p) return '';
    return p.de === p.a ? 'commandes de ' + MOIS[p.de - 1] + ' ' + p.annee
      : 'commandes de ' + MOIS[p.de - 1] + ' à ' + MOIS[p.a - 1] + ' ' + p.annee;
  }
  function normCip(c) { return String(c == null ? '' : c).replace(/\D/g, '').replace(/^0+/, ''); }

  // ── Données ──
  var SRC_RESEAU = '../../crm/v2/prod-reseau-data.js?v=20261015xm';
  var SRC_NONGEN = 'opso-nongen-data.js?v=20261001a';
  var SRC_CHOIX = 'opso-catalogue-choix-data.js?v=20261020rp';   // CIP à retirer / à ajouter (retour du 15/10)
  function chargerScript(src, temoin) {
    if (window[temoin] || document.querySelector('script[src^="' + src.split('?')[0] + '"]')) return Promise.resolve();
    return new Promise(function (ok) { var s = document.createElement('script'); s.src = src; s.onload = s.onerror = function () { ok(); }; document.head.appendChild(s); });
  }
  function chargerPhotos() {
    return Promise.all([
      window.OFFILOG_BEST ? 0 : chargerScript('../../crm/v2/offilog-bestsellers-data.js?v=20260903b', 'OFFILOG_BEST'),
      window.MKT_IMG ? 0 : chargerScript('../../crm/v2/mkt-images-data.js?v=20260929k', 'MKT_IMG')
    ]);
  }
  var _photos = null, _photosDemandees = false;
  function photoDe(cip) {
    if (!_photos) {
      _photos = {};
      (window.OFFILOG_BEST || []).forEach(function (b) { if (b && b.ean && b.img) _photos[normCip(b.ean)] = b.img; });
      var M = window.MKT_IMG || {};
      Object.keys(M).forEach(function (k) { if (M[k] && !_photos[normCip(k)]) _photos[normCip(k)] = M[k]; });
    }
    return _photos[normCip(cip)] || '';
  }

  // ── Offre Privilège : fichier privé du seau Supabase (même lecture que opso-prix.js) ──
  var _offre = null, _offreEtat = '';   // _offreEtat : '' · charge · ok · echec
  function offreValide(j) {
    return j && typeof j === 'object' && typeof j.titre === 'string' && j.titre &&
      Array.isArray(j.mentions) && j.mentions.every(function (m) { return typeof m === 'string'; }) &&
      Array.isArray(j.lignes) && j.lignes.length > 0 && j.lignes.every(function (l) {
        return l && /^\d{8,13}$/.test(String(l.cip)) && typeof l.prix === 'number' && l.prix > 0 && (l.ppht == null || typeof l.ppht === 'number');
      });
  }
  function chargerOffre() {
    var c = V2.sb && V2.sb();
    if (!c || !c.storage) return Promise.reject(new Error('pas de session'));
    return c.storage.from('donnees-protegees').download('opso-offre-privilege.json').then(function (r) {
      if (!r || r.error || !r.data) throw new Error('lecture impossible');
      return r.data.text();
    }).then(function (t) { var j = JSON.parse(t); if (!offreValide(j)) throw new Error('fichier illisible'); return j; });
  }
  function lancerOffre(root) {
    if (_offreEtat) return;
    _offreEtat = 'charge';
    var fin = function () { if (V2.route && V2.route.name === 'marketing') render(root); };
    try {
      chargerOffre().then(function (j) { _offre = j; _offreEtat = 'ok'; }).catch(function (e) {
        _offre = null; _offreEtat = 'echec';
        try { console.warn('[opso-catalogue] offre privilège indisponible :', e && e.message); } catch (x) {}
      }).then(fin);
    } catch (e) { _offreEtat = 'echec'; try { console.warn('[opso-catalogue] offre privilège indisponible :', e && e.message); } catch (x) {} }
  }

  // ── Les prix OPSO Santé : fichier privé lu par opso-prix.js (même chargement que l'écran « Les prix ») ──
  var _prixEtat = '';   // '' · charge · ok · echec
  var HAUT_PRIX = 25;   // mm : hauteur de l'en-tête de page (.oc-r-haut) ; opso-prix.js place le reste dessous
  // Pages 2 et 3 sous UN titre, celui de l'offre (Guy, 21/10/2026 : « je ne vois pas la différence entre prix OPSO et offre
  // privilège OPSO ») ; titre LU dans le fichier privilège, ce libellé ne sert que s'il est illisible.
  function titrePrix() { return (_offreEtat === 'ok' && _offre && _offre.titre) || 'Offre Privilège OPSO Santé'; }
  function lancerPrix(root) {
    if (_prixEtat) return;
    _prixEtat = 'charge';
    var fin = function () { if (V2.route && V2.route.name === 'marketing') render(root); };
    try {
      if (!V2.opsoPrix || !V2.opsoPrix.charger) throw new Error('opso-prix.js absent');
      V2.opsoPrix.charger().then(function (ok) { _prixEtat = ok ? 'ok' : 'echec'; }).catch(function () { _prixEtat = 'echec'; }).then(fin);
    } catch (e) { _prixEtat = 'echec'; try { console.warn('[opso-catalogue] prix OPSO indisponibles :', e && e.message); } catch (x) {} }
  }

  // Construit les rayons : produits du réseau classés par nombre de pharmacies, avec prix.
  var _cache = null, _ccEssaye = false;
  function construire() {
    var R = window.PROD_RESEAU, PS = window.PROD_STATS, B = window.BENCHMARK;
    if (!R || !PS || !B || !window.OPSO_CATALOGUE_CHOIX) return null;   // sans la liste, un produit retiré reviendrait
    var nonGen = {}; (window.OPSO_NONGEN || []).forEach(function (c) { nonGen[normCip(c)] = 1; });
    var CH = window.OPSO_CATALOGUE_CHOIX || {}, retirer = {}, ajouter = {};
    (CH.retirer || []).forEach(function (c) { retirer[normCip(c)] = 1; });
    (CH.ajouter || []).forEach(function (c) { ajouter[normCip(c)] = 1; });
    // Produit de l'Offre Privilège : affiché UNE fois, dans l'offre (Will, 16/10 : « des doublons avec l'offre privilège »).
    // Dans son rayon, le suivant prend sa place.
    var enOffre = {};
    // Page « Les prix OPSO Santé » : ses CIP (Mounjaro, Hélicidine) sont montrés là, et les lignes de l'Offre spéciale absentes du fichier
    // privilège rejoignent l'Offre Privilège (page 3) : une seule fois dans tout le document.
    // L'Offre Privilège (page 3, cartes par marque) est dessinée par opso-prix.js avec les prix de CE fichier ; sans les prix OPSO
    // lisibles (P absent), elle disparaît avec son entrée de sommaire et ses produits retournent dans les rayons.
    var P = (_prixEtat === 'ok' && V2.opsoPrix && V2.opsoPrix.pourCatalogue)
      ? V2.opsoPrix.pourCatalogue(HAUT_PRIX, { fichier: (_offreEtat === 'ok' ? _offre : null), retirer: retirer }) : null;
    var fichier = {}; if (_offreEtat === 'ok' && _offre) _offre.lignes.forEach(function (l) { fichier[normCip(l.cip)] = l; });
    var affiches = null;   // CIP réellement montrés dans l'Offre Privilège
    if (P && _offreEtat === 'ok' && P.offrePages.length) {
      affiches = {}; P.offre.forEach(function (it) { affiches[normCip(it.cip)] = 1; enOffre[normCip(it.cip)] = 1; });
      _offre.lignes.forEach(function (l) { if (retirer[normCip(l.cip)]) enOffre[normCip(l.cip)] = 1; });   // un produit retiré ne revient pas dans son rayon
    }
    if (P) P.cips.forEach(function (c) { enOffre[normCip(c)] = 1; });
    // Produit ajouté sans fiche dans PROD_STATS (aiguilles Easydrip+ 6 et 8 mm : jamais vendues par nos comptes) :
    // nom, rayon et PPHT lus au catalogue Intégral complet. On l'attend ; s'il n'a pas pu se charger, le catalogue sort sans eux.
    var CC = window.CATALOGUE_COMPLET;
    if (!CC && !_ccEssaye) return null;
    var cle = [R.empreinte, PS.length, B.length, (V2.sales || []).length, (window.OPSO_NONGEN || []).length, (CH.retirer || []).join(), (CH.ajouter || []).join(), CC ? 'cc' : '', _offreEtat === 'ok' ? 'offre' + _offre.lignes.length + _offre.maj : _offreEtat, _prixEtat === 'ok' ? 'prix' + (P ? P.n + '/' + P.offre.length + '/' + P.offrePages.length + '/' + P.cips.join() : 'x') : _prixEtat].join('|');
    if (_cache && _cache.cle === cle) return _cache;
    var ps = {}; PS.forEach(function (r) { var c = normCip(r.c); if (c && !ps[c]) ps[c] = r; });
    if (CC && CC.rows) CC.rows.forEach(function (r) { var c = normCip(r[0]); if (ajouter[c] && !ps[c]) ps[c] = { c: r[0], d: r[1], f: r[4], ppht: r[5], stale: 0 }; });
    var bench = {}; B.forEach(function (r) { var c = normCip(r && r.cip13); if (c && !bench[c]) bench[c] = r; });
    var opso = {};
    (V2.sales || []).forEach(function (s) {
      if (!(s.qte > 0) || (V2.estReste && V2.estReste(s.pharmacyId))) return;
      var c = normCip(s.artCode); (opso[c] || (opso[c] = {}))[s.pharmacyId] = 1;
    });
    var rayons = RAYONS.map(function (r) { return { r: r, items: [], sansPrix: 0, vus: 0, reserve: [] }; });
    var ordre = 0;
    Object.keys(R.n).forEach(function (cip) {
      var c = normCip(cip), p = ps[c]; if (!p || enOffre[c]) return;
      var f = p.f === 'gen' && nonGen[c] ? 'pr' : p.f;
      var ray = rayons.filter(function (x) { return x.r.f[f]; })[0]; if (!ray) return;
      // R.n est déjà trié par nombre décroissant : les premiers du rayon, plus les produits ajoutés à leur rang.
      // Un produit retiré garde sa place dans le décompte (le suivant ne la reprend pas) ; les suivants du classement
      // ne servent qu'à compléter la dernière page du rayon (réserve, voir plus bas).
      var dedans = ray.vus < ray.r.pages * PAR_PAGE, hors = !dedans && !ajouter[c];
      if (hors && ray.reserve.length >= PAR_PAGE) return;
      var bp = V2.bestPrice(bench[c]);
      if (bp.ip && !(bp.ht > bp.ip) && p.ppht > bp.ip && !p.stale) bp.ht = p.ppht;   // PPHT absent du benchmark : celui du catalogue
      // Produit ajouté absent du benchmark : remboursable à PPHT connu → PPHT − barème, comme horsBenchmark (v2-pharma).
      if (!bp.ip && ajouter[c] && ray.r.k === 'remb' && p.ppht > 0 && !p.stale && V2.abandonBareme) { bp.ht = p.ppht; bp.ip = Math.round((p.ppht - V2.abandonBareme(p.ppht)) * 100) / 100; }
      // … non remboursable (aiguilles Easydrip) : le PPHT, comme horsBenchmark pour un NR.
      if (!bp.ip && ajouter[c] && ray.r.k === 'nr' && p.ppht > 0 && !p.stale) bp.ip = p.ppht;
      if (!bp.ip) { if (dedans) ray.sansPrix++; return; }           // jamais une ligne sans prix net
      ray.vus++;
      if (retirer[c]) return;
      (hors ? ray.reserve : ray.items).push({
        cip: cip, nom: p.d || (bench[c] && bench[c].designation) || cip, n: R.n[cip],
        opso: opso[c] ? Object.keys(opso[c]).length : 0,
        ppht: ray.r.deux && bp.ht && bp.ht > bp.ip ? bp.ht : null, net: bp.ip, ordre: ordre++
      });
    });
    // Dernière page d'un rayon à moitié vide : complétée par les suivants du classement, à leur rang (Will, 20/10/2026 :
    // « remplir les pages 6, 7 et 11 »). Le nombre de pages ne change pas.
    rayons.forEach(function (x) {
      var manque = (PAR_PAGE - x.items.length % PAR_PAGE) % PAR_PAGE;
      if (manque && x.items.length) x.items = x.items.concat(x.reserve.slice(0, manque)).sort(function (a, b) { return a.ordre - b.ordre; });
      delete x.reserve;
    });
    var nOpso = {}; (V2.sales || []).forEach(function (s) { if (s.qte > 0 && !(V2.estReste && V2.estReste(s.pharmacyId))) nOpso[s.pharmacyId] = 1; });
    // Offre Privilège : prix du fichier privé, désignation / part du réseau comme les rayons, tri par part décroissante.
    var offre = null;
    if (affiches) {
      var rn = {}; Object.keys(R.n).forEach(function (k) { rn[normCip(k)] = k; });
      var lo = _offre.lignes.filter(function (l) { return !retirer[normCip(l.cip)] && affiches[normCip(l.cip)]; }).map(function (l) {
        var c = normCip(l.cip), p = ps[c], cip = rn[c] || String(l.cip);
        return { cip: cip, nom: (p && p.d) || (bench[c] && bench[c].designation) || cip, n: R.n[cip] || 0,
          opso: opso[c] ? Object.keys(opso[c]).length : 0, ppht: l.ppht > 0 ? l.ppht : null, net: l.prix };
      });
      // Lignes de l'Offre spéciale (opso-prix) absentes du fichier : prix net = prix OPSO, PPHT = celui de l'app. Les autres sont déjà dans le fichier.
      var ecarts = [];
      P.offre.forEach(function (it) {
        var c = normCip(it.cip);
        if (fichier[c]) { if (Math.abs(fichier[c].prix - it.opso) > 0.004) ecarts.push({ cip: it.cip, fichier: fichier[c].prix, prix: it.opso }); return; }
        if (retirer[c]) return;
        var cip = rn[c] || String(it.cip), p = ps[c];
        lo.push({ cip: cip, nom: (p && p.d) || (bench[c] && bench[c].designation) || it.nom, n: R.n[cip] || 0,
          opso: opso[c] ? Object.keys(opso[c]).length : 0, ppht: it.ppht > 0 ? it.ppht : null, net: it.opso, ajoutPrix: true });
      });
      lo.sort(function (a, b) { return b.n - a.n; });
      if (lo.length) offre = { titre: _offre.titre, mentions: _offre.mentions, items: lo, ecarts: ecarts, pages: P.offrePages, signalees: P.lignesSignalees || [] };
    }
    _cache = { cle: cle, offre: offre, prix: P && P.pages.length ? P : null, rayons: rayons.filter(function (x) { return x.items.length; }), R: R, opsoPharmas: Object.keys(nOpso).length };
    return _cache;
  }

  // ── Rendu ──
  var LOGO_IP = 'assets/logo-integral-serre.png';
  function logoOpso() { return (window.V2_BRAND && window.V2_BRAND.logoWhite) || 'assets/opsosante-logo-blanc.png'; }
  function monogramme(nom) {
    var m = String(nom || '').replace(/[^A-Za-zÀ-ÿ]/g, '');
    return esc(m.slice(0, 2)).toUpperCase();
  }
  // Réseau Intégral en POURCENTAGE seulement (règle Will 01/10) ; seul le nombre OPSO s'écrit en clair.
  function pct(n, tot) { var p = n / tot * 100; return p < 1 ? '< 1\u202f%' : Math.round(p) + '\u202f%'; }
  function ligneHtml(it, rang, max, deux, tot) {
    var ph = photoDe(it.cip);
    var vign = '<span class="oc-vign"><span class="oc-mono">' + monogramme(it.nom) + '</span>' +
      (ph ? '<img src="' + esc(ph) + '" alt="" onerror="this.remove()">' : '') + '</span>';
    var w = Math.max(3, Math.round(it.n / max * 100));
    var prix = deux
      ? '<span class="oc-ppht">' + (it.ppht ? eur(it.ppht) : '') + '</span><span class="oc-net">' + eur(it.net) + '</span>'
      : '<span class="oc-net">' + eur(it.net) + '</span>';
    return '<div class="oc-ligne">' +
      '<span class="oc-rang">' + rang + '</span>' + vign +
      '<span class="oc-nom">' + esc(it.nom) + '</span>' +
      '<span class="oc-jauge"><span class="oc-barre"><i style="width:' + w + '%"></i></span>' +
        '<b>' + pct(it.n, tot) + '</b>' + (it.opso ? '<em>' + it.opso + (it.opso > 1 ? ' adhérentes' : ' adhérente') + ' OPSO</em>' : '') + '</span>' +
      '<span class="oc-prix' + (deux ? ' deux' : '') + '">' + prix + '</span></div>';
  }
  function piedHtml(d, num, total) {
    return '<footer class="oc-pied oc-pied-cat"><span>Intégral Pharma, groupe de grossistes-répartiteurs, pour les adhérentes d’OPSO Santé</span>' +
      '<span>' + esc(periodeTexte(d.R.periode)) + ' · ' + num + ' / ' + total + '</span></footer>';
  }
  function nbPagesPrix(d) { return d.prix ? d.prix.pages.length : 0; }
  function couvertureHtml(d, total, debuts) {
    var np = nbPagesPrix(d), dec = np + nbPagesOffre(d);   // « Les prix » puis l'offre : pages 2 et 3, UNE entrée du sommaire (n° 01)
    var marques = d.prix ? d.prix.titres.map(function (t) { return t.split(' ')[0]; }).join(', ') : '';
    var pagesOffre = dec === 1 ? 'page 2' : dec === 2 ? 'pages 2 et 3' : 'pages 2 à ' + (1 + dec);
    var tuiles = (d.prix ? '<li class="oc-t-large"><span class="oc-t-num">01</span><b>' + esc(titrePrix()) + '</b><span>' + esc(marques) +
        (d.offre ? ' et ' + d.offre.items.length + ' autres produits' : '') + ' · ' + pagesOffre + '</span></li>' : '') +
      d.rayons.map(function (x, i) {
        return '<li><span class="oc-t-num">' + String(i + 1 + (d.prix ? 1 : 0)).padStart(2, '0') + '</span><b>' + esc(x.r.label) + '</b>' +
          '<span>' + x.items.length + ' produits · page ' + debuts[i] + '</span></li>';
      }).join('');
    var ex = d.rayons[0] && d.rayons[0].items[0];
    return '<section class="oc-page oc-couv">' +
      '<header class="oc-couv-haut"><div class="oc-halo"></div>' +
        '<div class="oc-lockup"><img class="l-ip" src="' + LOGO_IP + '" alt="Intégral Pharma"><span class="by">by</span><img class="l-opso" src="' + esc(logoOpso()) + '" alt="OPSO Santé"></div>' +
        '<h1>' + TITRE + '</h1>' +
        '<p class="oc-accroche">Les produits les plus commandés dans le réseau Intégral, et ceux que les adhérentes d’OPSO Santé commandent déjà.</p>' +
        '<p class="oc-chiffre"><b>' + d.opsoPharmas + '</b> adhérentes OPSO Santé commandent chez Intégral Pharma</p>' +
      '</header>' +
      '<div class="oc-couv-bas' + (dec ? ' oc-dense' : '') + '"><h2>Au sommaire</h2><ol class="oc-tuiles">' + tuiles + '</ol>' +
        (ex ? '<div class="oc-lire"><h2>Comment lire une ligne</h2>' +
          '<p>La barre et le pourcentage donnent la part des pharmacies du réseau Intégral qui ont commandé le produit (' + esc(periodeTexte(d.R.periode)) + '). ' +
          '« N adhérentes OPSO » : combien de pharmacies d’OPSO Santé le commandent.</p>' +
          '<p>PPHT : prix pharmacien hors taxes. Prix net : prix HT facturé par Intégral Pharma, abandon de marge déduit. Autres génériques et non remboursables : prix net seul.</p></div>' : '') +
      '</div>' + piedHtml(d, 1, total) + '</section>';
  }
  // Pages « Les prix OPSO Santé » : corps rendu par opso-prix.js, en-tête au gabarit des pages du catalogue, pied du catalogue.
  function prixHtml(d, total) {
    return d.prix.pages.map(function (pg, i) {
      return '<section class="oc-page oc-prixpage op-doc" style="' + pg.vars + '">' +
        '<header class="oc-r-haut"><h2>' + esc(titrePrix()) + (i ? ' <small>(suite)</small>' : '') + '</h2>' +
          '<span class="oc-r-sous">trois prix HT par boîte, un dosage par ligne</span></header>' +
        pg.html + piedHtml(d, 2 + i, total) + '</section>';
    }).join('');
  }
  // Offre Privilège (20/10/2026) : cartes par marque au rendu « Offre spéciale » de opso-prix.js (bandeau vert, 3 prix, pastille OPSO Santé),
  // sur UNE page A4 si possible. Mentions LUES dans le fichier, sans nom de laboratoire (Will, 16/10). Hauteurs et pagination : opso-prix.js.
  function nbPagesOffre(d) { return d.offre ? d.offre.pages.length : 0; }
  function offreHtml(d, total, num) {
    var o = d.offre;
    return o.pages.map(function (pg, i) {
      return '<section class="oc-page oc-prixpage op-doc ' + pg.cls + '" style="' + pg.vars + '">' +
        '<header class="oc-r-haut"><h2>' + esc(o.titre) + (i ? ' <small>(suite)</small>' : '') + '</h2>' +
          '<span class="oc-r-sous">prix HT par boîte, regroupés par marque</span></header>' +
        pg.html + piedHtml(d, num + i, total) + '</section>';
    }).join('');
  }
  function pagesHtml(d) {
    var pages = [], debuts = [], np = nbPagesPrix(d), dec = np + nbPagesOffre(d), num = 2 + dec;
    d.rayons.forEach(function (x) {
      debuts.push(num);
      for (var i = 0; i < x.items.length; i += PAR_PAGE) { pages.push({ x: x, de: i }); num++; }
    });
    var total = pages.length + 1 + dec;
    var html = couvertureHtml(d, total, debuts);
    if (d.prix) html += prixHtml(d, total);
    if (d.offre) html += offreHtml(d, total, 2 + np);
    pages.forEach(function (pg, k) {
      var x = pg.x, lot = x.items.slice(pg.de, pg.de + PAR_PAGE), suite = pg.de > 0;
      var max = x.items[0].n;   // barres à l'échelle du rayon (le 1er du rayon = barre pleine)
      // « Prix Intégral Pharma » sur chaque page de rayon, des remboursables à la fin (Guy, 21/10/2026 : nous mettre en avant).
      html += '<section class="oc-page oc-rayon r-' + x.r.k + '">' +
        '<header class="oc-r-haut"><div class="oc-r-titre"><span class="oc-r-ip">Prix Intégral Pharma</span>' +
          '<h2>' + esc(x.r.label) + (suite ? ' <small>(suite)</small>' : '') + '</h2></div>' +
          '<span class="oc-r-sous">classés par part des pharmacies du réseau</span></header>' +
        '<div class="oc-entete"><span></span><span></span><span>Produit</span><span>Commandé par</span>' +
          '<span class="oc-prix' + (x.r.deux ? ' deux' : '') + '">' + (x.r.deux ? '<span>PPHT</span><span>Prix net</span>' : '<span>Prix net</span>') + '</span></div>' +
        lot.map(function (it, i) { return ligneHtml(it, pg.de + i + 1, max, x.r.deux, d.R.officines); }).join('') +
        piedHtml(d, k + 2 + dec, total) + '</section>';
    });
    return html;
  }

  function injectStyles() {
    if (document.getElementById('oc-styles')) return;
    var css = [
      '.oc-barre-outils{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin:0 0 16px}',
      '.oc-actions{display:flex;flex-wrap:wrap;gap:10px}',
      '@media (max-width:520px){.oc-actions{width:100%}.oc-actions .v2-btn{flex:1 1 100%;white-space:normal}}',
      '@media print{.oc-actions{display:none!important}}',
      '.oc-barre-outils p{margin:0;color:var(--muted);font-size:13.5px;max-width:640px}',
      '.oc-apercu{background:#e9ecef;border-radius:14px;padding:14px;overflow:hidden}',
      '.oc-apercu .oc-cadre{width:calc(210mm * var(--s,1));height:calc(297mm * var(--s,1));margin:0 auto 14px;overflow:hidden;border-radius:3px;box-shadow:0 20px 40px -24px rgba(42,45,47,.5),0 2px 6px rgba(42,45,47,.12)}',
      '.oc-apercu .oc-page{transform:scale(var(--s,1));transform-origin:0 0}',
      '#oc-print{display:none}',
      // ════ LES PAGES (charte OPSO : vert, lime, anthracite) ════
      '.oc-page{--vert:#11a63c;--vert-f:#0d8530;--anthra:#2a2d2f;--gris:#64686a;--lime:#dddf4b;--lime-p:#f3f4c4;',
      ' width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff;color:var(--anthra);font-family:"Varela Round",system-ui,-apple-system,sans-serif;font-size:10pt;line-height:1.25;',
      ' -webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.oc-page *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      ':where(.oc-page) :where(h1,h2,p,ol,li,header,footer,section){margin:0;padding:0;font-weight:400;font-family:inherit;letter-spacing:normal;text-transform:none;color:inherit;list-style:none}',
      // couverture
      '.oc-couv-haut{position:relative;height:150mm;padding:14mm 14mm 0;color:#fff;overflow:hidden;',
      ' background:radial-gradient(ellipse 60% 70% at 85% 8%, rgba(221,223,75,.6) 0%, rgba(221,223,75,0) 60%),radial-gradient(circle at 10% 110%, rgba(255,255,255,.2) 0%, rgba(255,255,255,0) 45%),linear-gradient(165deg,#18bd4c 0%,#11a63c 45%,#0b7a2b 100%);',
      ' border-radius:0 0 0 22mm}',
      '.oc-halo{position:absolute;right:-40mm;top:-50mm;width:150mm;height:150mm;border-radius:50%;background:repeating-radial-gradient(circle, rgba(255,255,255,.10) 0 .35mm, rgba(255,255,255,0) .35mm 7mm)}',
      '.oc-lockup{position:relative;display:flex;align-items:center;gap:3mm}',
      '.oc-lockup .l-ip{height:12mm;width:auto;background:#fff;border-radius:2.5mm;padding:1.3mm 2.2mm}',
      '.oc-lockup .by{font-family:"Caveat",cursive;font-size:18pt;color:rgba(255,255,255,.9);line-height:1}',
      '.oc-lockup .l-opso{height:16mm;width:auto}',
      '.oc-couv h1{position:relative;font-size:52pt;line-height:1;margin-top:30mm;color:#fff}',
      '.oc-accroche{position:relative;font-size:15pt;line-height:1.3;margin-top:6mm;max-width:150mm;color:rgba(255,255,255,.96)}',
      '.oc-chiffre{position:relative;display:inline-block;margin-top:9mm;font-size:12pt;color:var(--anthra);background:var(--lime);padding:2mm 5mm;border-radius:5mm 5mm 5mm 0}',
      '.oc-couv-bas{padding:12mm 14mm 0}',
      '.oc-couv-bas h2{font-size:13pt;color:var(--vert-f);margin-bottom:4mm}',
      '.oc-tuiles{display:grid;grid-template-columns:1fr 1fr;gap:4mm}',
      '.oc-tuiles li{position:relative;padding:4mm 5mm 4mm 17mm;border-radius:4mm;background:radial-gradient(ellipse 90% 90% at 30% 20%, #ffffff 0%, #f1f9f0 60%, #e2f1e4 100%);min-height:19mm}',
      '.oc-tuiles b{display:block;font-weight:400;font-size:12pt;line-height:1.2}',
      '.oc-tuiles span:last-child{display:block;font-size:9.5pt;color:var(--gris);margin-top:1mm}',
      '.oc-t-num{position:absolute;left:5mm;top:4.2mm;font-size:13pt;color:var(--vert)}',
      // 5 entrées au sommaire (avec l'offre) = 3 rangées : on resserre pour rester au-dessus du pied
      '.oc-dense{padding-top:9mm}',
      '.oc-dense .oc-tuiles{gap:3mm 4mm}',
      '.oc-dense .oc-tuiles li{padding-top:3.2mm;padding-bottom:3.2mm;min-height:16mm}',
      '.oc-dense .oc-t-num{top:3.4mm}',
      '.oc-dense .oc-lire{margin-top:6mm}',
      '.oc-lire{margin-top:9mm;padding-top:5mm;border-top:.3mm solid rgba(42,45,47,.12)}',
      '.oc-lire p{font-size:10pt;color:var(--gris);line-height:1.45;margin-top:1.6mm;max-width:170mm}',
      // pages de rayon
      '.oc-r-haut{position:relative;height:25mm;padding:8mm 12mm 0;color:#fff;background:radial-gradient(ellipse 50% 120% at 92% 0%, rgba(221,223,75,.5) 0%, rgba(221,223,75,0) 60%),linear-gradient(160deg,#16b848 0%,#11a63c 50%,#0d8530 100%);display:flex;align-items:baseline;justify-content:space-between;gap:6mm}',
      '.oc-r-haut h2{font-size:19pt;line-height:1;color:#fff}',
      '.oc-r-haut h2 small{font-size:11pt;color:rgba(255,255,255,.8)}',
      '.oc-r-sous{font-size:9.5pt;color:rgba(255,255,255,.92);white-space:nowrap}',
      // pages de rayon : étiquette lime « Prix Intégral Pharma » au-dessus du titre, bandeau de même hauteur
      '.oc-rayon .oc-r-haut{padding-top:5mm;padding-bottom:4.6mm;align-items:flex-end}',
      '.oc-rayon .oc-r-sous{padding-bottom:.5mm}',
      '.oc-r-titre{display:flex;flex-direction:column;align-items:flex-start;gap:2mm}',
      '.oc-r-ip{font-size:9pt;line-height:1;color:var(--anthra);background:var(--lime);padding:1.2mm 2.8mm;border-radius:3mm 3mm 3mm 0}',
      // sommaire : l'entrée de l'offre (pages 2 et 3) sur toute la largeur
      '.oc-tuiles li.oc-t-large{grid-column:1/-1}',
      '.oc-entete,.oc-ligne{display:grid;grid-template-columns:7mm 10mm minmax(0,1fr) 56mm 46mm;align-items:center;column-gap:2.5mm;padding:0 10mm 0 8mm}',
      '.oc-entete{height:9mm;font-size:8.5pt;color:var(--gris);text-transform:uppercase;letter-spacing:.04em}',
      '.oc-ligne{height:10.6mm;border-top:.25mm solid rgba(42,45,47,.08)}',
      '.oc-ligne:nth-child(odd){background:linear-gradient(90deg,rgba(17,166,60,.045),rgba(17,166,60,0) 70%)}',
      '.oc-rang{font-size:9pt;color:var(--gris);text-align:right}',
      '.oc-vign{position:relative;width:9mm;height:9mm;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 40% 30%, #fff 0%, #eef8e6 70%, #d9efd9 100%);display:flex;align-items:center;justify-content:center}',
      '.oc-mono{font-size:8pt;color:var(--vert-f)}',
      '.oc-vign img{position:absolute;inset:8%;width:84%;height:84%;object-fit:contain;background:#fff;border-radius:50%}',
      '.oc-nom{font-size:9.5pt;line-height:1.15;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}',
      '.oc-jauge{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:2mm;align-items:center}',
      '.oc-barre{height:2.4mm;border-radius:2mm;background:#edf0ee;overflow:hidden}',
      '.oc-barre i{display:block;height:100%;border-radius:2mm;background:linear-gradient(90deg,#0d8530,#11a63c 70%,#8fd14a)}',
      '.oc-jauge b{font-weight:400;font-size:11pt;color:var(--anthra);text-align:right;min-width:11mm}',
      '.oc-jauge em{grid-column:1/-1;font-style:normal;font-size:8pt;color:var(--vert-f);margin-top:.6mm}',
      '.oc-prix{display:grid;grid-template-columns:1fr;text-align:right;white-space:nowrap}',
      '.oc-prix.deux{grid-template-columns:1fr 1fr;column-gap:3mm}',
      '.oc-ppht{font-size:9.5pt;color:var(--gris)}',
      '.oc-net{font-size:11.5pt;color:var(--vert-f)}',
      // pied du catalogue sur UNE ligne (à 8 pt, « Santé » passait seul à la ligne) ; l'écran opsoprix garde son pied à 8 pt
      '.oc-pied span:last-child{white-space:nowrap}.oc-pied.oc-pied-cat{font-size:7.5pt}',
      '.oc-pied{position:absolute;left:12mm;right:12mm;bottom:6mm;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6mm;font-size:8pt;color:var(--gris);border-top:.3mm solid rgba(42,45,47,.12);padding-top:2.2mm}'
    ].join('\n');
    var st = document.createElement('style'); st.id = 'oc-styles'; st.textContent = css; document.head.appendChild(st);
  }

  var MM = 96 / 25.4;
  function ajusterApercu(root) {
    var ap = root.querySelector('.oc-apercu'); if (!ap) return;
    var s = Math.min(1, (ap.clientWidth - 28) / (210 * MM));
    ap.style.setProperty('--s', s.toFixed(4));
  }
  // Même enveloppe que les autres écrans : barre du haut (retour à l'accueil) + marges de page.
  function page(html) { return V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) + '<div class="v2-wrap">' + html + '</div>'; }
  function render(root) {
    injectStyles();
    lancerOffre(root);
    lancerPrix(root);
    var d = construire();
    if (!d) {
      root.innerHTML = page('<div class="v2-empty" style="padding:40px;text-align:center;color:var(--muted)">Chargement du catalogue…</div>');
      Promise.all([chargerScript(SRC_RESEAU, 'PROD_RESEAU'), chargerScript(SRC_NONGEN, 'OPSO_NONGEN'), chargerScript(SRC_CHOIX, 'OPSO_CATALOGUE_CHOIX'), V2.loadFiles ? V2.loadFiles(['bench', 'catcomplet']) : 0]).then(function () {
        _ccEssaye = true;
        if (V2.route && V2.route.name === 'marketing' && construire()) render(root);
        else if (V2.route && V2.route.name === 'marketing') root.innerHTML = page('<div class="v2-empty" style="padding:40px;text-align:center;color:var(--muted)">Le catalogue n’a pas pu se charger. Rechargez la page.</div>');
      });
      return;
    }
    var nb = 0; d.rayons.forEach(function (x) { nb += x.items.length; });
    root.innerHTML = page('<div class="oc-barre-outils"><div><h1 class="v2-h1" style="margin:0 0 4px">Le catalogue</h1>' +
      '<p>' + nb + ' produits parmi les plus commandés dans le réseau Intégral (' + esc(periodeTexte(d.R.periode)) + '), avec le nombre d’adhérentes OPSO Santé qui les commandent.</p></div>' +
      '<div class="oc-actions"><button class="v2-btn primary" id="oc-btn-pdf" onclick="V2.opsoCatalogue.pdf()">Télécharger en PDF</button>' +
      '<button class="v2-btn primary" id="oc-btn-csv" onclick="V2.opsoCatalogue.csv()">Télécharger en Excel (CSV)</button></div></div>' +
      '<div class="oc-apercu">' + pagesHtml(d).replace(/<section class="oc-page/g, '<div class="oc-cadre"><section class="oc-page').replace(/<\/section>/g, '</section></div>') + '</div>');
    ajusterApercu(root);
    if (V2.opsoPrix && V2.opsoPrix.ajusterNoms) V2.opsoPrix.ajusterNoms(root);   // désignation trop longue de la page des prix : 8 pt serré, jamais coupée
    // Photos demandées UNE fois : deux rendus coup sur coup (rayons + Offre Privilège) trouvaient les balises
    // posées mais pas encore lues → chargerScript rendait la main tout de suite → rendu sans fin, page figée (16/10/2026).
    if ((!window.OFFILOG_BEST || !window.MKT_IMG) && !_photosDemandees) { _photosDemandees = true; chargerPhotos().then(function () { _photos = null; if (V2.route && V2.route.name === 'marketing') render(root); }); }
  }

  var STYLE_IMPR = '@page{size:A4;margin:0}' +
    '@media print{html,body{background:#fff!important;margin:0!important;padding:0!important;height:auto!important;overflow:visible!important}' +
    'body>*:not(#oc-print){display:none!important}#oc-print{display:block!important}' +
    '#oc-print .oc-page{height:296mm;break-after:page;page-break-after:always}#oc-print .oc-page:last-child{break-after:auto;page-break-after:auto}}';
  function nettoyer() {
    ['oc-print', 'oc-print-style'].forEach(function (id) { var e = document.getElementById(id); if (e && e.parentNode) e.parentNode.removeChild(e); });
  }
  var printBound = false;
  function preparer() {
    var d = construire(); if (!d) return Promise.resolve(null);
    return preparerHtml(pagesHtml(d));
  }
  // Mise en page d'impression du catalogue (« Les prix » passe par pdfDePages depuis le 20/10/2026).
  function preparerHtml(pagesDuDocument) {
    injectStyles(); nettoyer();
    var st = document.createElement('style'); st.id = 'oc-print-style'; st.textContent = STYLE_IMPR; document.head.appendChild(st);
    var box = document.createElement('div'); box.id = 'oc-print'; box.innerHTML = pagesDuDocument; document.body.appendChild(box);
    if (!printBound) { printBound = true; window.addEventListener('afterprint', nettoyer); }
    var attentes = Array.prototype.map.call(box.querySelectorAll('img'), function (im) {
      return new Promise(function (ok) { if (im.complete) return ok(); im.addEventListener('load', ok); im.addEventListener('error', ok); });
    });
    var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    return Promise.race([Promise.all(attentes.concat([fonts])), new Promise(function (ok) { setTimeout(ok, 6000); })]).then(function () { return box; });
  }
  // ── CSV pour Excel français (Mac) : UTF-8 + BOM, « ; », CRLF, virgule décimale.
  //    Les MÊMES lignes que l'écran (construire()), même arrondi du pourcentage. Jamais le nombre réseau. ──
  var virgule = function (v) { return (Math.round(v * 100) / 100).toFixed(2).replace('.', ','); };
  function partCsv(n, tot) { var p = n / tot * 100; return p < 1 ? '< 1%' : Math.round(p) + '%'; }   // même règle que pct(), sans espace
  // Un texte qui commence par = + - @ serait lu par Excel comme une formule : on le neutralise par une apostrophe.
  function sansFormule(v) { v = String(v == null ? '' : v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
  function champ(v) { v = String(v == null ? '' : v); return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function csv() {
    var d = construire(); if (!d) return null;
    var lignes = [['Rayon', 'Rang', 'Produit', 'CIP13', 'Part des pharmacies du réseau', 'dont OPSO', 'PPHT', 'Prix net']];
    // Page « Les prix OPSO Santé » : prix net = prix OPSO ; pas de part du réseau ni de PPHT (la page ne les montre pas).
    if (d.prix) d.prix.sections.forEach(function (sec) {
      sec.items.forEach(function (it, i) {
        lignes.push([sansFormule(titrePrix() + ' - ' + sec.titre + (sec.etiquette ? ' (' + sec.etiquette + ')' : '')), i + 1, sansFormule(it.nom),
          it.cip ? '="' + it.cip + '"' : it.cipTexte, '', '', '', virgule(it.opso)]);
      });
    });
    if (d.offre) d.offre.items.forEach(function (it, i) {
      lignes.push([sansFormule(d.offre.titre), i + 1, sansFormule(it.nom), '="' + it.cip + '"', partCsv(it.n, d.R.officines), it.opso,
        it.ppht ? virgule(it.ppht) : '', virgule(it.net)]);
    });
    d.rayons.forEach(function (x) {
      x.items.forEach(function (it, i) {
        lignes.push([sansFormule(x.r.court), i + 1, sansFormule(it.nom), '="' + it.cip + '"', partCsv(it.n, d.R.officines), it.opso,
          x.r.deux && it.ppht ? virgule(it.ppht) : '', virgule(it.net)]);
      });
    });
    var per = periodeTexte(d.R.periode).replace(/^commandes de /, '').replace(/[\\/:*?"<>|]/g, ' ');
    return { texte: '﻿' + lignes.map(function (l) { return l.map(champ).join(';'); }).join('\r\n') + '\r\n', nom: 'Catalogue OPSO - ' + per + '.csv' };
  }
  function telechargerCsv() { telechargerTexte(csv()); }
  function telechargerTexte(c) {
    if (!c) { V2.toast && V2.toast('Téléchargement impossible, réessayez dans un instant', 'error'); return; }
    var url = URL.createObjectURL(new Blob([c.texte], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = c.nom;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  // ── PDF téléchargé directement (20/10/2026). Passer par l'impression ouvrait la fenêtre d'impression, et Safari y
  //    peignait en NOIR tout dégradé transparent (couverture, bandeaux des pages). html2canvas (déjà chargé) redessine la
  //    page à sa façon : étiquettes de prix comme barrées, icônes décalées. modern-screenshot (MIT, ajouté avec l'accord de
  //    Will le 20/10/2026) fait dessiner chaque page par le navigateur lui-même ; jsPDF (dans html2pdf) pose une image par page A4. ──
  var SRC_CAPTURE = 'https://cdn.jsdelivr.net/npm/modern-screenshot@4.7.0/dist/index.js';
  // Empreinte du fichier vérifié le 20/10/2026 : si jsDelivr en servait un autre, le navigateur le refuse (comme v2-concurrents-liens.js).
  var SRI_CAPTURE = 'sha384-5Ua3TI0kiMYH8QdNy+vc5IWS3MTa2DzQEm/uKFDQ+/biJctek9hiSP6moIm2PVog';
  function chargerCapture() {
    if (window.modernScreenshot) return Promise.resolve();
    return new Promise(function (ok, ko) {
      var s = document.createElement('script'); s.integrity = SRI_CAPTURE; s.crossOrigin = 'anonymous'; s.src = SRC_CAPTURE;
      s.onload = ok; s.onerror = function () { ko(new Error('modern-screenshot non chargé')); }; document.head.appendChild(s);
    });
  }
  var pdfEnCours = false;
  function telechargerPdf() {
    if (pdfEnCours) return;
    var d = construire(); if (!d) { V2.toast && V2.toast('Le catalogue charge encore, réessayez dans un instant', 'error'); return; }
    pdfDePages({ html: pagesHtml(d), bouton: 'oc-btn-pdf', nom: 'Catalogue-Integral-Pharma-OPSO-Sante.pdf', fini: 'Catalogue téléchargé' });
  }
  // Même PDF direct pour tout écran A4 de la famille (« Les prix », opso-prix.js, 20/10/2026) : on lui passe ses pages,
  // l'id de son bouton, le nom du fichier et le message de fin.
  function pdfDePages(o) {
    if (pdfEnCours) return;
    if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast && V2.toast('Module PDF indisponible', 'error'); return; }
    pdfEnCours = true;
    var btn = document.getElementById(o.bouton), libelle = btn ? btn.textContent : '';
    var etat = function (t) { if (btn) { btn.textContent = t; btn.disabled = true; } };
    etat('Préparation du PDF…');
    injectStyles();
    var wrap = document.createElement('div');
    wrap.id = 'oc-pdf';
    wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;background:#fff';
    // Ombres portées : la photo du navigateur (WebKit) les rend en bandes grises pleines → retirées du PDF seulement.
    wrap.innerHTML = '<style>#oc-pdf .oc-page,#oc-pdf .oc-page *{box-shadow:none!important}</style>' + o.html;
    document.body.appendChild(wrap);
    if (V2.opsoPrix && V2.opsoPrix.ajusterNoms) V2.opsoPrix.ajusterNoms(wrap);
    var pages = Array.prototype.slice.call(wrap.querySelectorAll('.oc-page'));
    var fin = function (ok) {
      pdfEnCours = false; if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (polices.parentNode) polices.parentNode.removeChild(polices);
      if (btn) { btn.textContent = libelle; btn.disabled = false; }
      V2.toast && (ok ? V2.toast(o.fini) : V2.toast('Le PDF n’a pas pu être créé, réessayez', 'error'));
    };
    // Polices : la feuille Google Fonts vient d'un autre site, la photo ne peut pas la lire et retombe sur la police
    // système. Son texte, posé le temps du PDF dans une feuille de la page, est lu et embarqué par modern-screenshot
    // (son option font.cssText, elle, laisse les adresses distantes que Safari refuse de charger dans la photo).
    var polices = document.createElement('style');
    var css = Promise.all(Array.prototype.map.call(document.querySelectorAll('link[href*="fonts.googleapis.com/css"]'), function (l) {
      return fetch(l.href).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
    })).then(function (textes) { polices.textContent = textes.join('\n'); document.head.appendChild(polices); });
    // Photos d'un site qui refuse la copie (Cap3000, Drakkars…) : sinon un rond vide ; on les retire et le monogramme
    // posé dessous reprend sa place, comme à l'écran quand une photo manque.
    var photos = Array.prototype.map.call(wrap.querySelectorAll('img'), function (im) {
      var src = im.currentSrc || im.src; if (!src || /^data:/.test(src)) return 0;
      return fetch(src, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error(r.status); })
        .catch(function () { if (im.parentNode) im.parentNode.removeChild(im); });
    });
    var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : 0;
    Promise.all([window.ensureHtml2Pdf(), chargerCapture(), css, Promise.all(photos), fonts]).then(function () {
      if (!window.modernScreenshot || !window.html2pdf) throw new Error('outils PDF non chargés');
      var opt = { scale: 2, quality: 0.92, backgroundColor: '#ffffff' };
      var images = [];
      return pages.reduce(function (suite, pg, i) {
        return suite.then(function () {
          etat('PDF : page ' + (i + 1) + ' sur ' + pages.length + '…');
          return window.modernScreenshot.domToJpeg(pg, opt).then(function (u) { images.push(u); });
        });
      }, Promise.resolve()).then(function () { return images; });
    }).then(function (images) {
      // Document vierge d'une page tiré d'html2pdf (jsPDF n'y est pas exposé seul), puis une image pleine page par page.
      var vide = document.createElement('canvas'); vide.width = vide.height = 10;
      return window.html2pdf().set({ margin: 0, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(vide, 'canvas').toPdf().get('pdf').then(function (pdf) {
        images.forEach(function (u, i) { if (i) pdf.addPage(); pdf.addImage(u, 'JPEG', 0, 0, 210, 297); });
        pdf.save(o.nom);
      });
    }).then(function () { fin(true); }, function (e) { console.error(e); fin(false); });
  }
  V2.opsoCatalogue = {
    pdf: telechargerPdf,
    csv: telechargerCsv,
    imprimer: function () {
      var avant = document.title;
      document.title = 'Catalogue-Integral-Pharma-OPSO-Sante';
      preparer().then(function (box) {
        if (!box) return;
        if (V2.opsoPrix && V2.opsoPrix.ajusterNoms) V2.opsoPrix.ajusterNoms(box);
        try { window.print(); } catch (e) { V2.toast && V2.toast('Impression impossible', 'error'); }
        setTimeout(function () { document.title = avant; }, 1500);
      });
    },
    preparer: preparer,
    donnees: construire,
    etats: function () { return { prix: _prixEtat, offre: _offreEtat }; },   // lu par les sondes
    // Pièces communes réutilisées par les autres écrans A4 OPSO (opso-prix.js) : mêmes styles, mêmes logos, même PDF, même CSV.
    commun: { styles: injectStyles, ajuster: ajusterApercu, logo: logoOpso, logoIntegral: LOGO_IP, enveloppe: page, pdf: pdfDePages,
      telecharger: telechargerTexte, csv: { champ: champ, sansFormule: sansFormule, virgule: virgule } }
  };

  V2.pages.marketing = { needs: [], render: render };
  window.addEventListener('resize', function () { var r = document.getElementById('v2-root'); if (r && V2.route && V2.route.name === 'marketing') ajusterApercu(r); });
})();
