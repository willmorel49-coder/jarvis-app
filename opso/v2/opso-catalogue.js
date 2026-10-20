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
    { k: 'gen', label: 'Génériques', f: { gen: 1 }, pages: 1, deux: false, court: 'Génériques' },
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
  var SRC_CHOIX = 'opso-catalogue-choix-data.js?v=20261016bf';   // CIP à retirer / à ajouter (retour du 15/10)
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
  var TITRE_PRIX = 'Les prix OPSO Santé';
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
    var enOffre = {}; if (_offreEtat === 'ok' && _offre) _offre.lignes.forEach(function (l) { enOffre[normCip(l.cip)] = 1; });
    // Page « Les prix OPSO Santé » : ses CIP (Mounjaro, Hélicidine) sont montrés là, et les lignes de l'Offre spéciale absentes du fichier
    // privilège rejoignent l'Offre Privilège (page 3) : une seule fois dans tout le document.
    var P = (_prixEtat === 'ok' && V2.opsoPrix && V2.opsoPrix.pourCatalogue) ? V2.opsoPrix.pourCatalogue(HAUT_PRIX) : null;
    var fichier = {}; if (_offreEtat === 'ok' && _offre) _offre.lignes.forEach(function (l) { fichier[normCip(l.cip)] = l; });
    if (P) P.cips.forEach(function (c) { enOffre[normCip(c)] = 1; });
    if (P && _offreEtat === 'ok') P.offre.forEach(function (it) { enOffre[normCip(it.cip)] = 1; });
    // Produit ajouté sans fiche dans PROD_STATS (aiguilles Easydrip+ 6 et 8 mm : jamais vendues par nos comptes) :
    // nom, rayon et PPHT lus au catalogue Intégral complet. On l'attend ; s'il n'a pas pu se charger, le catalogue sort sans eux.
    var CC = window.CATALOGUE_COMPLET;
    if (!CC && !_ccEssaye) return null;
    var cle = [R.empreinte, PS.length, B.length, (V2.sales || []).length, (window.OPSO_NONGEN || []).length, (CH.retirer || []).join(), (CH.ajouter || []).join(), CC ? 'cc' : '', _offreEtat === 'ok' ? 'offre' + _offre.lignes.length + _offre.maj : _offreEtat, _prixEtat === 'ok' ? 'prix' + (P ? P.n + '/' + P.offre.length + '/' + P.cips.join() : 'x') : _prixEtat].join('|');
    if (_cache && _cache.cle === cle) return _cache;
    var ps = {}; PS.forEach(function (r) { var c = normCip(r.c); if (c && !ps[c]) ps[c] = r; });
    if (CC && CC.rows) CC.rows.forEach(function (r) { var c = normCip(r[0]); if (ajouter[c] && !ps[c]) ps[c] = { c: r[0], d: r[1], f: r[4], ppht: r[5], stale: 0 }; });
    var bench = {}; B.forEach(function (r) { var c = normCip(r && r.cip13); if (c && !bench[c]) bench[c] = r; });
    var opso = {};
    (V2.sales || []).forEach(function (s) {
      if (!(s.qte > 0) || (V2.estReste && V2.estReste(s.pharmacyId))) return;
      var c = normCip(s.artCode); (opso[c] || (opso[c] = {}))[s.pharmacyId] = 1;
    });
    var rayons = RAYONS.map(function (r) { return { r: r, items: [], sansPrix: 0, vus: 0 }; });
    Object.keys(R.n).forEach(function (cip) {
      var c = normCip(cip), p = ps[c]; if (!p || enOffre[c]) return;
      var f = p.f === 'gen' && nonGen[c] ? 'pr' : p.f;
      var ray = rayons.filter(function (x) { return x.r.f[f]; })[0]; if (!ray) return;
      // R.n est déjà trié par nombre décroissant : les premiers du rayon, plus les produits ajoutés à leur rang.
      // Un produit retiré garde sa place dans le décompte (le suivant ne la reprend pas).
      var dedans = ray.vus < ray.r.pages * PAR_PAGE;
      if (!dedans && !ajouter[c]) return;
      var bp = V2.bestPrice(bench[c]);
      if (bp.ip && !(bp.ht > bp.ip) && p.ppht > bp.ip && !p.stale) bp.ht = p.ppht;   // PPHT absent du benchmark : celui du catalogue
      // Produit ajouté absent du benchmark : remboursable à PPHT connu → PPHT − barème, comme horsBenchmark (v2-pharma).
      if (!bp.ip && ajouter[c] && ray.r.k === 'remb' && p.ppht > 0 && !p.stale && V2.abandonBareme) { bp.ht = p.ppht; bp.ip = Math.round((p.ppht - V2.abandonBareme(p.ppht)) * 100) / 100; }
      // … non remboursable (aiguilles Easydrip) : le PPHT, comme horsBenchmark pour un NR.
      if (!bp.ip && ajouter[c] && ray.r.k === 'nr' && p.ppht > 0 && !p.stale) bp.ip = p.ppht;
      if (!bp.ip) { if (dedans) ray.sansPrix++; return; }           // jamais une ligne sans prix net
      ray.vus++;
      if (retirer[c]) return;
      ray.items.push({
        cip: cip, nom: p.d || (bench[c] && bench[c].designation) || cip, n: R.n[cip],
        opso: opso[c] ? Object.keys(opso[c]).length : 0,
        ppht: ray.r.deux && bp.ht && bp.ht > bp.ip ? bp.ht : null, net: bp.ip
      });
    });
    var nOpso = {}; (V2.sales || []).forEach(function (s) { if (s.qte > 0 && !(V2.estReste && V2.estReste(s.pharmacyId))) nOpso[s.pharmacyId] = 1; });
    // Offre Privilège : prix du fichier privé, désignation / part du réseau comme les rayons, tri par part décroissante.
    var offre = null;
    if (_offreEtat === 'ok' && _offre) {
      var rn = {}; Object.keys(R.n).forEach(function (k) { rn[normCip(k)] = k; });
      var lo = _offre.lignes.filter(function (l) { return !retirer[normCip(l.cip)]; }).map(function (l) {
        var c = normCip(l.cip), p = ps[c], cip = rn[c] || String(l.cip);
        return { cip: cip, nom: (p && p.d) || (bench[c] && bench[c].designation) || cip, n: R.n[cip] || 0,
          opso: opso[c] ? Object.keys(opso[c]).length : 0, ppht: l.ppht > 0 ? l.ppht : null, net: l.prix };
      });
      // Lignes de l'Offre spéciale (opso-prix) absentes du fichier : prix net = prix OPSO, PPHT = celui de l'app. Les autres sont déjà dans le fichier.
      var ecarts = [];
      if (P) P.offre.forEach(function (it) {
        var c = normCip(it.cip);
        if (fichier[c]) { if (Math.abs(fichier[c].prix - it.opso) > 0.004) ecarts.push({ cip: it.cip, fichier: fichier[c].prix, prix: it.opso }); return; }
        if (retirer[c]) return;
        var cip = rn[c] || String(it.cip), p = ps[c];
        lo.push({ cip: cip, nom: (p && p.d) || (bench[c] && bench[c].designation) || it.nom, n: R.n[cip] || 0,
          opso: opso[c] ? Object.keys(opso[c]).length : 0, ppht: it.ppht > 0 ? it.ppht : null, net: it.opso, ajoutPrix: true });
      });
      lo.sort(function (a, b) { return b.n - a.n; });
      if (lo.length) offre = { titre: _offre.titre, mentions: _offre.mentions, items: lo, ecarts: ecarts };
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
    var np = nbPagesPrix(d), dec = np + (d.offre ? 1 : 0);   // « Les prix » puis l'offre : pages 2 et 3, n° 01 et 02 du sommaire
    var marques = d.prix ? d.prix.titres.map(function (t) { return t.split(' ')[0]; }).join(', ') : '';
    var tuiles = (d.prix ? '<li><span class="oc-t-num">01</span><b>' + TITRE_PRIX + '</b><span>' + esc(marques) + ' · page 2</span></li>' : '') +
      (d.offre ? '<li><span class="oc-t-num">' + String(np + 1).padStart(2, '0') + '</span><b>' + esc(d.offre.titre) + '</b><span>' + d.offre.items.length + ' produits · page ' + (2 + np) + '</span></li>' : '') +
      d.rayons.map(function (x, i) {
        return '<li><span class="oc-t-num">' + String(i + 1 + dec).padStart(2, '0') + '</span><b>' + esc(x.r.label) + '</b>' +
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
          '<p>PPHT : prix pharmacien hors taxes. Prix net : prix HT facturé par Intégral Pharma, abandon de marge déduit. Génériques et non remboursables : prix net seul.</p></div>' : '') +
      '</div>' + piedHtml(d, 1, total) + '</section>';
  }
  // Pages « Les prix OPSO Santé » : corps rendu par opso-prix.js, en-tête au gabarit des pages du catalogue, pied du catalogue.
  function prixHtml(d, total) {
    return d.prix.pages.map(function (pg, i) {
      return '<section class="oc-page oc-prixpage op-doc" style="' + pg.vars + '">' +
        '<header class="oc-r-haut"><h2>' + TITRE_PRIX + (i ? ' <small>(suite)</small>' : '') + '</h2>' +
          '<span class="oc-r-sous">trois prix HT par boîte, un dosage par ligne</span></header>' +
        pg.html + piedHtml(d, 2 + i, total) + '</section>';
    }).join('');
  }
  // Offre Privilège : l'offre sur UNE page A4 (rangées resserrées selon le nombre de lignes). Mentions LUES dans le fichier, sans nom de laboratoire (Will, 16/10).
  var ZONE_LIGNES = 238;   // mm : de la tête de colonnes au pied de page (le pied peut passer sur deux lignes : marge gardée)
  function offreHtml(d, total, num) {
    var o = d.offre, max = Math.max(o.items[0].n, 1);
    var rh = Math.min(9.4, Math.floor(ZONE_LIGNES / o.items.length * 10) / 10);   // 25 lignes : 9,4 mm comme avant ; 32 lignes : 7,4 mm
    return '<section class="oc-page oc-offre r-offre' + (rh < 9 ? ' r-serre' : '') + '" style="--rh:' + rh + 'mm">' +
      '<header class="oc-r-haut"><h2>' + esc(o.titre) + '</h2>' +
        '<span class="oc-r-sous">classés par part des pharmacies du réseau</span></header>' +
      '<p class="oc-mentions">' + esc(o.mentions.join(' · ')) + '</p>' +
      '<div class="oc-entete"><span></span><span></span><span>Produit</span><span>Commandé par</span>' +
        '<span class="oc-prix deux"><span>PPHT</span><span>Prix net</span></span></div>' +
      o.items.map(function (it, i) { return ligneHtml(it, i + 1, max, true, d.R.officines); }).join('') +
      piedHtml(d, num, total) + '</section>';
  }
  function pagesHtml(d) {
    var pages = [], debuts = [], np = nbPagesPrix(d), dec = np + (d.offre ? 1 : 0), num = 2 + dec;
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
      html += '<section class="oc-page oc-rayon r-' + x.r.k + '">' +
        '<header class="oc-r-haut"><h2>' + esc(x.r.label) + (suite ? ' <small>(suite)</small>' : '') + '</h2>' +
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
      '.oc-mentions{padding:2.4mm 12mm 0;height:7mm;font-size:9.5pt;color:var(--vert-f)}',
      '.r-offre .oc-ligne{height:var(--rh,9.4mm)}',
      '.r-offre .oc-vign{width:7.4mm;height:7.4mm}',
      // 32 lignes sur la page : rangées de 7,4 mm, désignation 9 pt, pastille plus petite
      '.r-serre .oc-vign{width:6mm;height:6mm}.r-serre .oc-mono{font-size:6.5pt}',
      '.r-serre .oc-nom{font-size:9pt;line-height:1.1}',
      // 32 lignes : barre sur toute la largeur, « N adhérentes OPSO » et le pourcentage sur la même ligne dessous (tient dans 7,4 mm)
      '.r-serre .oc-jauge{row-gap:.7mm}.r-serre .oc-barre{grid-column:1/-1;height:1.6mm}' +
      '.r-serre .oc-jauge b{grid-row:2;grid-column:2;align-self:baseline;font-size:9.5pt;line-height:1;min-width:0}' +
      '.r-serre .oc-jauge em{grid-row:2;grid-column:1;align-self:baseline;margin-top:0;line-height:1}',
      '.r-serre .oc-net{font-size:11pt}.r-serre .oc-ppht{font-size:9pt}',
      '.r-serre .oc-entete{height:8mm}',
      '.r-serre .oc-mentions{padding-top:1.8mm}',
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
      '<div class="oc-actions"><button class="v2-btn primary" onclick="V2.opsoCatalogue.imprimer()">Imprimer / enregistrer en PDF</button>' +
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
  // Même mise en page d'impression pour tout écran A4 de la famille (ex. opso-prix.js) : on lui passe ses pages.
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
        lignes.push([sansFormule(TITRE_PRIX + ' - ' + sec.titre + (sec.etiquette ? ' (' + sec.etiquette + ')' : '')), i + 1, sansFormule(it.nom),
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
  V2.opsoCatalogue = {
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
    // Pièces communes réutilisées par les autres écrans A4 OPSO (opso-prix.js) : mêmes styles, mêmes logos, même impression, même CSV.
    commun: { styles: injectStyles, ajuster: ajusterApercu, logo: logoOpso, logoIntegral: LOGO_IP, enveloppe: page, preparerHtml: preparerHtml,
      telecharger: telechargerTexte, csv: { champ: champ, sansFormule: sansFormule, virgule: virgule } }
  };

  V2.pages.marketing = { needs: [], render: render };
  window.addEventListener('resize', function () { var r = document.getElementById('v2-root'); if (r && V2.route && V2.route.name === 'marketing') ajusterApercu(r); });
})();
