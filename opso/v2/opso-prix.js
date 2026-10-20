/* ═══════════════════════════════════════════════════════════════════
   OPSO Santé · « Les prix OPSO Santé » — listing À PART du catalogue (15/10/2026).
   Demande de Will : le PFHT, notre prix Intégral habituel sur facture, et le prix
   négocié pour OPSO Santé. Prix HT par boîte, jamais de pourcentage.
   Sections, dans l'ordre : Wegovy comprimés (à venir) · Mounjaro injectable ·
   Hélicidine · Offre spéciale (en dernier ; sans nom de laboratoire, et seulement les
   produits que les adhérentes OPSO commandent déjà — Will, 16/10/2026).
   Mise en page « Les familles de produits » (maquette p2 choisie par Will le 16/10/2026) : Wegovy et Mounjaro
   en grands blocs, Hélicidine en bandeau, l'Offre spéciale en cartes par marque ; pas de couverture séparée.
   ⚠️ Les prix négociés sont des CONDITIONS COMMERCIALES : aucun prix, aucun taux,
   aucune liste de CIP négociés n'est écrit ici. Tout vient de opso-prix-negocies.json,
   dans le seau privé « donnees-protegees » (lecture : compte connecté seulement).
   Sans session ou en cas d'échec, l'écran le dit et n'affiche aucun chiffre de repli.
   Réutilise les pièces de opso-catalogue.js (V2.opsoCatalogue.commun) : page A4 oc-page, pied oc-pied,
   logos, aperçu A4, impression, CSV.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var eur = function (v) { return v == null ? '' : v.toFixed(2).replace('.', ',') + ' €'; };
  var r2 = function (x) { return Math.round((x + 1e-9) * 100) / 100; };
  var normCip = function (c) { return String(c == null ? '' : c).replace(/\D/g, ''); };
  var ROUTE = 'opsoprix';
  var TITRE = 'Les prix OPSO Santé';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MSG_INDISPO = 'Prix non disponibles — reconnectez-vous';

  // ── PFHT : on remonte du PPHT en inversant la marge réglementée du grossiste ──
  // froid : le supplément de 0,63 € est retiré d'abord ; palier bas : −0,30 € ; palier médian : ÷ 1,0693 ; au-delà : −32,50 €.
  var SEUIL_BAS = 4.6290043, SEUIL_HAUT = 501.4646;   // 468,97 × 1,0693
  function pfhtDe(ppht, froid) {
    if (!(ppht > 0)) return null;
    var x = froid ? ppht - 0.63 : ppht;
    if (x <= SEUIL_BAS) x = x - 0.30;
    else if (x <= SEUIL_HAUT) x = x / 1.0693;
    else x = x - 32.50;
    return r2(x);
  }

  // ── Construction des lignes (pure : pas de DOM, testable en node) ──
  // ctx = { neg (le fichier négocié), bench (tableau BENCHMARK), ppht (carte CIP → PPHT), froid (tableau de CIP), bestPrice (fonction),
  //         commandes (carte CIP → 1 des produits commandés par les adhérentes OPSO ; null = ventes absentes, pas de filtre) }
  function dosage(nom) { var m = /(\d+(?:[.,]\d+)?)\s*mg/i.exec(nom || ''); return m ? parseFloat(m[1].replace(',', '.')) : 0; }
  function lignes(ctx) {
    var neg = ctx.neg, froid = {}, bench = {}, pp = ctx.ppht || {}, bp = ctx.bestPrice;
    (ctx.froid || []).forEach(function (c) { froid[normCip(c)] = 1; });
    (ctx.bench || []).forEach(function (b) { var c = normCip(b && b.cip13); if (c && !bench[c]) bench[c] = b; });
    var sections = [
      { k: 'wegovy', titre: 'Wegovy comprimés', etiquette: 'à venir', items: [] },
      { k: 'mounjaro', titre: 'Mounjaro injectable', etiquette: '', items: [] },
      { k: 'helicidine', titre: 'Hélicidine', etiquette: '', items: [] },
      { k: 'offre', titre: 'Offre spéciale', etiquette: '', items: [], fort: true }
    ];
    var S = {}; sections.forEach(function (s) { S[s.k] = s; });
    var signalees = [], sansPrix = [], nonCommandes = 0;
    function pph(c, b) { return (pp[c] > 0 ? pp[c] : (b && b.prix_ht > 0 ? b.prix_ht : 0)); }
    function ajouter(sec, it) {
      // Contrôle : PFHT ≤ prix OPSO < prix habituel. Sinon la ligne est signalée, jamais corrigée.
      it.signalee = !(it.pfht != null && it.opso != null && it.habituel != null && it.pfht <= it.opso && it.opso < it.habituel);
      if (it.signalee) {
        signalees.push(it);
        try { console.warn('[opso-prix] ligne à vérifier :', it.nom, it.cip, 'PFHT', it.pfht, 'habituel', it.habituel, 'OPSO', it.opso); } catch (e) {}
      }
      S[sec].items.push(it);
    }
    function manque(nom, cip, raison) { sansPrix.push({ nom: nom, cip: cip, raison: raison }); }

    // 1. Wegovy comprimés : les chiffres sont ceux du fichier, tels quels.
    (neg.wegovyCp || []).forEach(function (w) {
      ajouter('wegovy', { cip: '', cipTexte: 'à venir', nom: w.nom, pfht: w.pfht, habituel: w.ip, opso: w.opso });
    });
    // 2. Mounjaro : prix habituel = net de l'app ; prix OPSO = PPHT moins le taux du fichier, arrondi au centime.
    var taux = neg.mounjaro && neg.mounjaro.taux, mj = [];
    ((neg.mounjaro && neg.mounjaro.cips) || []).forEach(function (cip) {
      var c = normCip(cip), b = bench[c]; if (!b) return manque('', cip, 'absent du benchmark');
      var p = bp(b), ppht = pph(c, b); if (!p.ip || !(ppht > 0)) return manque(b.designation, cip, 'sans prix');
      mj.push({ cip: c, cipTexte: c, nom: b.designation, pfht: pfhtDe(ppht, !!froid[c]), habituel: p.ip, opso: r2(ppht * (1 - taux)), _d: dosage(b.designation) });
    });
    mj.sort(function (a, b) { return a._d - b._d || (a.nom < b.nom ? -1 : 1); }).forEach(function (it) { delete it._d; ajouter('mounjaro', it); });
    // 3. Hélicidine : prix habituel = net de l'app ; prix OPSO = celui du fichier.
    (neg.helicidine || []).forEach(function (h) {
      var c = normCip(h.cip), b = bench[c]; if (!b) return manque('', h.cip, 'absent du benchmark');
      var p = bp(b), ppht = pph(c, b); if (!p.ip || !(ppht > 0)) return manque(b.designation, h.cip, 'sans prix');
      ajouter('helicidine', { cip: c, cipTexte: c, nom: b.designation, pfht: pfhtDe(ppht, !!froid[c]), habituel: p.ip, opso: h.opso });
    });
    // 4. Offre spéciale : habituel = net standard SANS l'offre ; prix OPSO = l'offre. Seulement ce que les adhérentes OPSO commandent déjà.
    var of = [];
    (neg.offreSanofiUpsa || []).forEach(function (cip) {
      var c = normCip(cip), b = bench[c];
      if (ctx.commandes && !ctx.commandes[c]) { nonCommandes++; return; }
      if (!b) return manque('', cip, 'absent du benchmark');
      var ppht = pph(c, b); if (!(b.prix_ip > 0) || !(b.offre_ip > 0) || !(ppht > 0)) return manque(b.designation, cip, 'sans prix');
      of.push({ cip: c, cipTexte: c, nom: b.designation, pfht: pfhtDe(ppht, !!froid[c]), habituel: b.prix_ip, opso: b.offre_ip, ppht: ppht });   // ppht : lu par « Le catalogue » (Offre Privilège)
    });
    of.sort(function (a, b) { return a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0; }).forEach(function (it) { ajouter('offre', it); });

    var n = 0; sections.forEach(function (s) { n += s.items.length; });
    return { sections: sections.filter(function (s) { return s.items.length; }), n: n, signalees: signalees, sansPrix: sansPrix, nonCommandes: nonCommandes };
  }

  // ── Chargement : le fichier négocié (seau privé) + le benchmark protégé ──
  var _neg = null, _etat = 'vide', _bench = false;   // _etat : vide · charge · ok · echec
  function formeValide(j) {
    return j && typeof j === 'object' && Array.isArray(j.wegovyCp) && j.mounjaro && typeof j.mounjaro.taux === 'number' && j.mounjaro.taux > 0 && j.mounjaro.taux < 1 &&
      Array.isArray(j.mounjaro.cips) && Array.isArray(j.helicidine) && Array.isArray(j.offreSanofiUpsa);
  }
  function chargerNegocies() {
    var c = V2.sb && V2.sb();
    if (!c || !c.storage) return Promise.reject(new Error('pas de session'));
    return c.storage.from('donnees-protegees').download('opso-prix-negocies.json').then(function (r) {
      if (!r || r.error || !r.data) throw new Error('lecture impossible');
      return r.data.text();
    }).then(function (t) { var j = JSON.parse(t); if (!formeValide(j)) throw new Error('fichier illisible'); return j; });
  }
  // Chargement partagé : l'écran « Les prix » et « Le catalogue » (qui reprend ce document en page 2) passent par ici.
  // silencieux : un échec lancé par le catalogue ne bloque pas l'écran « Les prix » (il retentera à son ouverture).
  var _prom = null;
  function chargerDonnees(silencieux) {
    if (_etat === 'ok') return Promise.resolve(true);
    if (_etat === 'charge' && _prom) return _prom;
    _etat = 'charge';
    _prom = Promise.all([chargerNegocies(), V2.loadFiles ? V2.loadFiles(['bench', 'ppht']) : 0]).then(function (r) {
      _neg = r[0]; _bench = true; _etat = 'ok'; return true;
    }).catch(function (e) {
      _neg = null; _etat = silencieux ? 'vide' : 'echec';
      try { console.warn('[opso-prix] chargement impossible :', e && e.message); } catch (x) {}
      return false;
    });
    return _prom;
  }
  function charger(root) {
    chargerDonnees(false).then(function () { if (V2.route && V2.route.name === ROUTE) render(root); });
  }
  function contexte() {
    if (_etat !== 'ok' || !_neg || !Array.isArray(window.BENCHMARK) || !Array.isArray(window.FROID_CIPS)) return null;
    // Produits commandés par les adhérentes OPSO : même règle que « Le catalogue » (quantité > 0, hors « reste du réseau »).
    var ventes = V2.sales || [], commandes = null;
    if (ventes.length) {
      commandes = {};
      ventes.forEach(function (s) { if (s.qte > 0 && !(V2.estReste && V2.estReste(s.pharmacyId))) commandes[normCip(s.artCode)] = 1; });
    } else { try { console.warn('[opso-prix] ventes OPSO absentes : offre affichée sans filtre'); } catch (e) {} }
    return { neg: _neg, bench: window.BENCHMARK, ppht: window.PPHT || {}, froid: window.FROID_CIPS, bestPrice: V2.bestPrice, commandes: commandes };
  }
  var _d = null;
  function construire() {
    var ctx = contexte(); if (!ctx) return null;
    _d = lignes(ctx);
    V2.opsoPrix.signalees = _d.signalees.length; V2.opsoPrix.sansPrix = _d.sansPrix.length; V2.opsoPrix.lignesN = _d.n; V2.opsoPrix.nonCommandes = _d.nonCommandes;
    return _d;
  }

  // ── Rendu : « Les familles de produits » (maquette p2, choisie par Will le 16/10/2026) ──
  // Page 1 : bandeau court (logos, titre, édition) + légende des trois prix + Wegovy et Mounjaro en grands blocs.
  // Ensuite : Hélicidine en bandeau, puis l'Offre spéciale en cartes par marque sur deux colonnes équilibrées.
  // Le nombre de produits varie (filtre des commandes, nouveaux CIP) : chaque hauteur est FIXÉE en CSS et refaite ici
  // au millimètre ; ce qui ne tient pas passe à la page suivante, coupé entre deux rangées et marqué « (suite) ».
  function dateEdition() { var d = new Date(); return d.getDate() + (d.getDate() === 1 ? 'er ' : ' ') + MOIS[d.getMonth()] + ' ' + d.getFullYear(); }
  var H = {
    bas: 277, haut1: 73, haut: 17, ecart: 4.5, ecartCarte: 3.4, bord: 0.6, plusMax: 3,   // mm ; plusMax = ce qu'une rangée peut gagner pour remplir la page
    famTete: 28, famCols: 10, famRang: 10.6,
    bandeCols: 7, rang: 11.2,
    offreTete: 17, carteTete: 10.5, carteCols: 5.6
  };
  function hFam(n) { return H.famTete + H.famCols + n * H.famRang + H.bord; }
  function hBande(n) { return H.bandeCols + n * H.rang + H.bord; }
  function hCarte(n) { return H.carteTete + H.carteCols + n * H.rang + H.bord; }
  function hColonne(c) { var h = 0; c.forEach(function (x, i) { h += hCarte(x.items.length) + (i ? H.ecartCarte : 0); }); return h; }
  function rangsColonne(c) { var n = 0; c.forEach(function (x) { n += x.items.length; }); return n; }
  // Offre spéciale : une carte par marque (le premier mot de la désignation), dans l'ordre alphabétique des lignes.
  function marques(items) {
    var cartes = [], parNom = {};
    items.forEach(function (it) {
      var m = String(it.nom || '').trim().split(/\s+/)[0].toUpperCase() || '—';
      if (!parNom[m]) { parNom[m] = { nom: m, items: [], ordre: cartes.length }; cartes.push(parNom[m]); }
      parNom[m].items.push(it);
    });
    return cartes;
  }
  // Toutes les cartes tiennent sur la page : deux colonnes équilibrées (la plus grande carte d'abord, dans la colonne la moins remplie).
  function equilibrer(file, cap) {
    var cols = [[], []], h = [0, 0];
    file.slice().sort(function (a, b) { return b.items.length - a.items.length || a.ordre - b.ordre; }).forEach(function (x) {
      var c = h[0] <= h[1] ? 0 : 1; cols[c].push(x); h[c] += hCarte(x.items.length) + (cols[c].length > 1 ? H.ecartCarte : 0);
    });
    if (Math.max(h[0], h[1]) > cap + 1e-6) return null;
    cols.forEach(function (c) { c.sort(function (a, b) { return a.ordre - b.ordre; }); });
    if (!cols[0].length || (cols[1].length && hColonne(cols[1]) > hColonne(cols[0]))) cols.reverse();   // la colonne la plus haute à gauche
    return { cols: cols.filter(function (c) { return c.length; }), reste: [] };
  }
  // Sinon : colonne de gauche puis de droite ; une carte d'au moins 6 rangées est coupée entre deux rangées, le reste va à la page suivante.
  function remplir(file, cap) {
    var cols = [[], []], ci = 0, h = 0, f = file.slice();
    while (f.length && ci < 2) {
      var x = f[0], dispo = cap - h - (cols[ci].length ? H.ecartCarte : 0);
      var k = Math.floor((dispo - hCarte(0)) / H.rang + 1e-6), n = x.items.length;
      if (k >= n) { cols[ci].push(x); h += hCarte(n) + (cols[ci].length > 1 ? H.ecartCarte : 0); f.shift(); continue; }
      var tropHaute = hCarte(n) > H.bas - H.haut - 2 * H.ecart - H.offreTete;   // plus haute qu'une colonne de page neuve
      if ((n >= 6 && k >= 2 && n - k >= 2) || (k >= 1 && !cols[ci].length && tropHaute)) {   // une petite carte passe entière à la colonne suivante
        cols[ci].push({ nom: x.nom, items: x.items.slice(0, k), ordre: x.ordre, suite: x.suite });
        f[0] = { nom: x.nom, items: x.items.slice(k), ordre: x.ordre, suite: true };
      }
      ci++; h = 0;
    }
    return { cols: cols.filter(function (c) { return c.length; }), reste: f };
  }
  function miseEnPage(d, haut1, plusMax) {
    var pages = [], pg = null;
    function nouvelle() { pg = { blocs: [], y: pages.length ? H.haut : (haut1 > 0 ? haut1 : H.haut1), rangs: 0, cols: null }; pages.push(pg); }
    function reste() { return H.bas - pg.y - H.ecart; }
    nouvelle();
    d.sections.forEach(function (s) {
      if (s.k === 'offre') {
        var file = marques(s.items).map(function (c) { return { nom: c.nom, items: c.items, ordre: c.ordre, suite: false }; }), suite = false;
        while (file.length) {
          var cap = reste() - H.offreTete - H.ecart;
          if (cap < hCarte(Math.min(2, file[0].items.length)) && pg.blocs.length) { nouvelle(); continue; }
          var r = equilibrer(file, cap) || remplir(file, cap);
          if (!r.cols.length) { if (pg.blocs.length) { nouvelle(); continue; } r = { cols: [[file[0]]], reste: file.slice(1) }; }   // garde-fou : jamais de boucle sans fin
          pg.blocs.push({ type: 'offre', s: s, suite: suite }, { type: 'grille', cols: r.cols });
          pg.y += H.ecart + H.offreTete; pg.yGrille = pg.y + H.ecart; pg.cols = r.cols;
          pg.y = pg.yGrille + Math.max.apply(null, r.cols.map(hColonne));
          file = r.reste; suite = true;
          if (file.length) nouvelle();
        }
        return;
      }
      var fam = s.k !== 'helicidine', i = 0, suiteS = false;
      while (i < s.items.length) {
        var n = s.items.length - i, k = Math.floor((reste() - (fam ? hFam(0) : hBande(0))) / (fam ? H.famRang : H.rang) + 1e-6);
        if (k < Math.min(2, n) && pg.blocs.length) { nouvelle(); continue; }
        k = Math.max(1, Math.min(n, k));
        pg.blocs.push({ type: fam ? 'fam' : 'bande', s: s, items: s.items.slice(i, i + k), suite: suiteS });
        pg.y += H.ecart + (fam ? hFam(k) : hBande(k)); pg.rangs += k;
        i += k; suiteS = true;
      }
    });
    // Ce qui reste de hauteur est rendu aux rangées (jusqu'à plusMax chacune) : la page se remplit sans trou au bas.
    pages.forEach(function (p) {
      var e = plusMax > 0 ? plusMax : H.plusMax;
      if (!p.cols) { if (p.rangs) e = Math.min(e, (H.bas - p.y) / p.rangs); }
      else p.cols.forEach(function (c) { e = Math.min(e, (H.bas - p.yGrille - hColonne(c) - 0) / (p.rangs + rangsColonne(c))); });
      p.e = Math.max(0, Math.floor(e * 100) / 100);
    });
    return pages;
  }

  var SV = {   // visuels dessinés (aucune photo : les liens photo du catalogue répondent 404 le 16/10/2026)
    stylo: '<svg viewBox="0 0 60 60" aria-hidden="true"><ellipse cx="32" cy="50" rx="20" ry="3" fill="#06301a" fill-opacity=".26"/><g transform="rotate(-38 30 30)"><rect x="6" y="23" width="40" height="14" rx="4" fill="#fff"/><rect x="6" y="23" width="14" height="14" rx="4" fill="#dddf4b"/><rect x="46" y="26" width="6" height="8" rx="1.5" fill="#cfe5d6"/><rect x="52" y="29" width="7" height="2" fill="#fff"/><rect x="24" y="27" width="16" height="2" rx="1" fill="#0d8530"/><rect x="24" y="31" width="10" height="2" rx="1" fill="#92b9a2"/><rect x="9" y="24.2" width="34" height="2.2" rx="1.1" fill="#fff" fill-opacity=".85"/></g></svg>',
    boite: '<svg viewBox="0 0 60 60" aria-hidden="true"><ellipse cx="31" cy="53" rx="19" ry="3" fill="#06301a" fill-opacity=".26"/><rect x="9" y="20" width="42" height="30" rx="4" fill="#fff"/><rect x="11" y="30" width="5" height="18" rx="2.5" fill="#dfeee5"/><rect x="9" y="20" width="42" height="9" rx="4" fill="#dddf4b"/><circle cx="22" cy="40" r="5" fill="#0d8530"/><circle cx="36" cy="40" r="5" fill="#92b9a2"/><ellipse cx="44" cy="13" rx="6" ry="3.5" fill="#fff" transform="rotate(-25 44 13)"/><ellipse cx="33" cy="10" rx="6" ry="3.5" fill="#dddf4b" transform="rotate(15 33 10)"/><rect x="12" y="21.2" width="36" height="2" rx="1" fill="#fff" fill-opacity=".7"/></svg>',
    flacon: '<svg viewBox="0 0 60 60" aria-hidden="true"><ellipse cx="31" cy="56" rx="19" ry="3" fill="#06301a" fill-opacity=".26"/><rect x="23" y="6" width="14" height="9" rx="2" fill="#dddf4b"/><path d="M25 15h10v5c8 3 11 8 11 14v16a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V34c0-6 3-11 11-14z" fill="#fff"/><rect x="19" y="32" width="22" height="14" rx="2" fill="#0d8530"/><rect x="22" y="36" width="16" height="2" fill="#fff"/><rect x="22" y="40" width="10" height="2" fill="#dddf4b"/><rect x="17" y="30" width="2.6" height="22" rx="1.3" fill="#fff" fill-opacity=".9"/><rect x="24" y="7.2" width="12" height="1.6" rx=".8" fill="#fff" fill-opacity=".6"/></svg>',
    sachet: '<svg viewBox="0 0 60 60" aria-hidden="true"><ellipse cx="31" cy="52" rx="19" ry="3" fill="#06301a" fill-opacity=".26"/><path d="M12 12h36v36H12z" fill="#fff"/><path d="M14 20h2.6v22H14z" fill="#dfeee5"/><path d="M12 12h36v7H12z" fill="#dddf4b"/><path d="M12 48h36v-5H12z" fill="#92b9a2"/><circle cx="30" cy="31" r="6" fill="#0d8530"/><path d="M12 12.8h36" stroke="#fff" stroke-opacity=".75" stroke-width="1.2"/></svg>'
  };
  var SOUS_TITRE = { wegovy: 'Comprimés', mounjaro: 'Stylo injecteur · un dosage par ligne' };
  function suiteTxt(b) { return b.suite ? ' <small>(suite)</small>' : ''; }
  function majuscule(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  function dose(nom) { var m = /(\d+(?:,\d+)?)\s*mg/i.exec(nom || ''); return m ? m[1] + ' mg' : ''; }
  function nomHtml(it) { return '<div class="op-nom"><span class="op-nm">' + esc(it.nom) + '</span><i>CIP13 : ' + esc(it.cipTexte) + '</i></div>'; }
  function prixHtml(it) { return '<div class="op-p">' + eur(it.pfht) + '</div><div class="op-p">' + eur(it.habituel) + '</div><div class="op-po">' + eur(it.opso) + '</div>'; }
  var CH = '<div class="op-ch"><span>Présentation</span><span>PFHT</span><span>Habituel</span><span class="o">OPSO Santé</span></div>';
  function famHtml(b) {
    var s = b.s, stylo = s.k === 'mounjaro';
    var sous = (SOUS_TITRE[s.k] || '') + (s.etiquette === 'à venir' ? ' — pas encore disponibles, prix donnés à l’avance' : '');
    return '<div class="op-fam"><div class="op-fam-h"><div class="op-vis">' + (stylo ? SV.stylo : SV.boite) + '</div>' +
      '<div><div class="op-fam-t">' + esc(s.titre) + suiteTxt(b) + '</div>' + (sous ? '<div class="op-fam-s">' + esc(sous) + '</div>' : '') + '</div>' +
      (s.etiquette ? '<span class="op-pill">' + esc(majuscule(s.etiquette)) + '</span>' : '') + '</div>' +
      '<div class="op-cols"><span>Dosage</span><span>Désignation</span><span>PFHT</span><span>Prix Intégral habituel</span><span class="o">Prix OPSO Santé</span></div>' +
      b.items.map(function (it) {
        return '<div class="op-rw' + (stylo ? ' vign' : '') + '"><div class="op-dose">' + (stylo ? '<span class="op-th">' + SV.stylo + '</span>' : '') + '<span>' + esc(dose(it.nom)) + '</span></div>' +
          nomHtml(it) + prixHtml(it) + '</div>';
      }).join('') + '</div>';
  }
  function bandeHtml(b) {
    return '<div class="op-bande"><div class="op-bande-c"><span class="op-ico">' + SV.flacon + '</span><b>' + esc(b.s.titre) + suiteTxt(b) + '</b></div>' +
      '<div>' + CH + b.items.map(function (it) { return '<div class="op-pr">' + nomHtml(it) + prixHtml(it) + '</div>'; }).join('') + '</div></div>';
  }
  function offreHtml(b) {
    var n = b.s.items.length;
    return '<div class="op-os"><div><div class="op-os-t">' + esc(b.s.titre) + suiteTxt(b) + '</div><div class="op-os-s">Produits regroupés par marque · tous les prix sont HT, par boîte</div></div>' +
      '<span class="op-pill">' + n + (n > 1 ? ' produits' : ' produit') + '</span></div>';
  }
  function carteHtml(x) {
    var sachets = x.items.filter(function (it) { return /\bSACH/i.test(it.nom); }).length * 2 > x.items.length;
    var tot = x.total || x.items.length;
    return '<div class="op-carte"><div class="op-carte-h"><span class="op-ico">' + (sachets ? SV.sachet : SV.boite) + '</span><b>' + esc(majuscule(x.nom.toLowerCase())) + suiteTxt(x) + '</b>' +
      '<span class="op-carte-n">' + tot + (tot > 1 ? ' présentations' : ' présentation') + '</span></div>' + CH +
      x.items.map(function (it) { return '<div class="op-pr">' + nomHtml(it) + prixHtml(it) + '</div>'; }).join('') + '</div>';
  }
  function haut1Html() {
    var C = V2.opsoCatalogue.commun, logo = (window.V2_BRAND && window.V2_BRAND.logo) || 'assets/opsosante-logo.png';
    return '<header class="op-couv"><div class="op-logos"><img class="op-l1" src="' + esc(C.logoIntegral) + '" alt="Intégral Pharma"><span class="op-by">by</span><img class="op-l2" src="' + esc(logo) + '" alt="OPSO Santé"></div>' +
      '<h1 class="op-titre">' + TITRE + '</h1><div class="op-sous"><span class="op-pill">Édition du ' + esc(dateEdition()) + '</span><span>Un dosage par ligne, trois prix HT par boîte.</span></div></header>' +
      legendeHtml();
  }
  function hautHtml(p) {
    var t = [];
    p.blocs.forEach(function (b) { if (b.s && t.indexOf(b.s.titre) < 0) t.push(b.s.titre); });
    var quoi = t.length > 1 ? t.slice(0, -1).join(', ') + ' et ' + t[t.length - 1] : t.join('');
    var C = V2.opsoCatalogue.commun, logo = (window.V2_BRAND && window.V2_BRAND.logo) || 'assets/opsosante-logo.png';
    return '<header class="op-haut"><div class="op-haut-t' + ((TITRE + quoi).length > 48 ? ' long' : '') + '">' + TITRE + (quoi ? ' · ' + esc(quoi) : '') + '</div>' +
      '<div class="op-logos2"><img class="op-l1" src="' + esc(C.logoIntegral) + '" alt="Intégral Pharma"><img src="' + esc(logo) + '" alt="OPSO Santé"></div></header>';
  }
  function piedHtml(num, total) {
    return '<footer class="oc-pied"><span>Intégral Pharma, groupe de grossistes-répartiteurs, pour les adhérentes d’OPSO Santé</span>' +
      '<span>Édition du ' + esc(dateEdition()) + ' · ' + num + ' / ' + total + '</span></footer>';
  }
  // Largeur des colonnes de prix : un prix à trois chiffres élargit les colonnes (sections à cartes ou bandeau).
  function varsCols(sections) {
    var lmax = 0;
    sections.forEach(function (s) { if (s.k === 'helicidine' || s.k === 'offre') s.items.forEach(function (it) { [it.pfht, it.habituel, it.opso].forEach(function (v) { lmax = Math.max(lmax, eur(v).length); }); }); });
    return ';--cn:' + Math.max(12.5, 1.7 * lmax + 2.3).toFixed(1) + 'mm;--co:' + Math.max(17.5, 2 * lmax + 5.5).toFixed(1) + 'mm';
  }
  function blocsHtml(p, totaux) {
    var html = '';
    p.blocs.forEach(function (b) {
      if (b.type === 'fam') html += famHtml(b);
      else if (b.type === 'bande') html += bandeHtml(b);
      else if (b.type === 'offre') html += offreHtml(b);
      else html += '<div class="op-grille">' + b.cols.map(function (c) {
        return '<div class="op-col">' + c.map(function (x) { x.total = totaux[x.nom]; return carteHtml(x); }).join('') + '</div>';
      }).join('') + '</div>';
    });
    return html;
  }
  function totauxMarques(d) {
    var totaux = {};
    marques((d.sections.filter(function (s) { return s.k === 'offre'; })[0] || { items: [] }).items).forEach(function (c) { totaux[c.nom] = c.items.length; });
    return totaux;
  }
  function pagesHtml(d) {
    var pages = miseEnPage(d), total = pages.length, totaux = totauxMarques(d), cols = varsCols(d.sections);
    return pages.map(function (p, i) {
      var html = '<section class="oc-page op-doc" style="--e:' + p.e + 'mm' + cols + '">' + (i ? hautHtml(p) : haut1Html());
      html += blocsHtml(p, totaux);
      return html + piedHtml(i + 1, total) + '</section>';
    }).join('');
  }
  function legendeHtml() {
    return '<div class="op-leg"><div><b>PFHT</b>prix fabricant hors taxes</div><div><b>Prix Intégral habituel</b>prix HT facturé, abandon de marge déduit</div>' +
      '<div class="o"><b>Prix OPSO Santé</b>le prix négocié pour les adhérentes</div></div>';
  }
  // ── Pour « Le catalogue » : le corps de la page « Les prix OPSO Santé » (légende + Wegovy + Mounjaro + Hélicidine), SANS la grande
  // en-tête de couverture, ni pied, ni l'Offre spéciale (elle rejoint l'Offre Privilège). `haut` = hauteur déjà prise par l'en-tête du catalogue.
  // Rend { pages: [{ html, vars }], offre: [lignes de l'Offre spéciale], titres, n } ou null si les prix ne sont pas chargés.
  function pourCatalogue(haut) {
    var d = construire(); if (!d) return null;
    var corps = { sections: d.sections.filter(function (s) { return s.k !== 'offre'; }) };
    var offre = (d.sections.filter(function (s) { return s.k === 'offre'; })[0] || { items: [] }).items;
    var n = 0; corps.sections.forEach(function (s) { n += s.items.length; });
    var cips = []; corps.sections.forEach(function (s) { s.items.forEach(function (it) { if (it.cip) cips.push(it.cip); }); });
    if (!n) return { pages: [], offre: offre, titres: [], n: 0, cips: cips, sections: [], signalees: d.signalees.length };
    var pages = miseEnPage(corps, haut + 13, 2.2), vars = varsCols(corps.sections);   // 13 mm = 5 mm de marge + 8 mm de légende
    return {
      pages: pages.map(function (p, i) { return { html: (i ? '' : legendeHtml()) + blocsHtml(p, {}), vars: '--e:' + p.e + 'mm' + vars, fin: p.y }; }),
      offre: offre, n: n, cips: cips, sections: corps.sections, signalees: d.signalees.length,
      titres: corps.sections.map(function (s) { return s.titre; })
    };
  }

  // Filet : une désignation plus longue que deux lignes passe en 8 pt serré plutôt que d'être coupée.
  function ajusterNoms(el) {
    Array.prototype.forEach.call(el.querySelectorAll('.op-nm'), function (n) { if (n.scrollHeight > n.clientHeight + 1) n.classList.add('long'); });
  }

  var STYLE_ID = 'op-styles-familles';
  function injectStyles() {
    V2.opsoCatalogue.commun.styles();
    if (document.getElementById(STYLE_ID)) return;
    var e = 'var(--e,0mm)';
    var css = [
      '.op-doc{--vert:#0d8530;--vert-v:#11a63c;--vert-f:#0a6a26;--gris:#4f5456;--trait:#d3e2d8;-webkit-print-color-adjust:exact;print-color-adjust:exact;' +
        'background:radial-gradient(ellipse 120% 50% at 100% 0%,#f4f9ee 0,rgba(244,249,238,0) 70%),linear-gradient(180deg,#fffdf8 0,#f1f7f2 100%)}',
      '.op-doc .op-pill{background:linear-gradient(180deg,#e9eb68 0,#dddf4b 55%,#d2d53a 100%);color:var(--anthra);border-radius:5mm 5mm 5mm 0;padding:1.4mm 4mm;font-size:9.5pt;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 .4mm .9mm rgba(6,48,26,.25)}',
      // page 1 : bandeau court + légende (73 mm en tout, cf. H.haut1)
      '.op-couv{position:relative;height:60mm;color:#fff;padding:9mm 12mm 0;border-radius:0 0 0 16mm;overflow:hidden;' +
        'background:radial-gradient(ellipse 85mm 60mm at 96% -6%,rgba(255,252,222,.95) 0,rgba(214,236,120,.7) 22%,rgba(139,207,76,.32) 48%,rgba(139,207,76,0) 75%),linear-gradient(200deg,#1db84a 0%,#0d8530 55%,#0a6a26 100%);box-shadow:inset 0 -1px 0 rgba(255,255,255,.18),0 .8mm 2mm rgba(6,48,26,.2)}',
      '.op-couv::after{content:"";position:absolute;right:-30mm;top:-30mm;width:90mm;height:90mm;border-radius:50%;border:1px solid rgba(255,255,255,.14);box-shadow:0 0 0 9mm rgba(255,255,255,.015)}',
      '.op-couv::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,rgba(255,255,255,0) 20%,rgba(255,255,255,.75) 100%)}',
      '.op-logos{position:relative;z-index:1;display:flex;align-items:center;gap:4mm}',
      '.op-logos .op-l1{height:11mm;width:auto;background:#fff;border-radius:2.4mm;padding:1mm 1.6mm}',
      '.op-by{font-style:italic;font-size:10pt}',
      '.op-logos .op-l2{height:14mm;width:auto}',
      '.op-doc .op-titre{position:relative;z-index:1;font-size:27pt;line-height:1.05;margin-top:7mm;color:#fff}',
      '.op-sous{position:relative;z-index:1;display:flex;align-items:center;gap:4mm;margin-top:3mm;font-size:10pt}',
      '.op-leg{display:flex;gap:3mm;height:8mm;margin:5mm 12mm 0;font-size:8pt;color:var(--gris);line-height:1.3}',
      '.op-leg div{position:relative;flex:1 1 auto;white-space:nowrap;padding-left:6.6mm}',
      '.op-leg div::before{content:"";position:absolute;left:0;top:.8mm;width:5mm;height:3mm;border-radius:1.7mm 1.7mm 1.7mm 0;background:linear-gradient(180deg,#fff,#e4ece7);border:1px solid #b9cdbf;box-sizing:border-box}',
      '.op-leg .o::before{background:linear-gradient(180deg,#e9eb68 0,#dddf4b 55%,#d2d53a 100%);border-color:#c6c935;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 .3mm .6mm rgba(6,48,26,.25)}',
      '.op-leg div:nth-child(2)::before{background:linear-gradient(180deg,#f3faf5,#d6e8dc);border-color:#9fbfaa}',
      '.op-leg b{display:block;font-weight:400;font-size:8.5pt;color:var(--anthra)}',
      '.op-leg .o b{color:var(--vert)}',
      // pages suivantes : en-tête court (17 mm, cf. H.haut)
      '.op-haut{height:17mm;padding:8mm 12mm 0;display:flex;align-items:center;justify-content:space-between;gap:4mm}',
      '.op-haut-t{font-size:15pt;color:var(--vert);white-space:nowrap}.op-haut-t.long{font-size:12pt}',
      '.op-logos2{display:flex;align-items:center;gap:3mm;flex:none}.op-logos2 img{height:9mm;width:auto}',
      '.op-logos2 .op-l1{background:#fff;border:1px solid var(--trait);border-radius:2mm;padding:.8mm 1.2mm}',
      // grands blocs Wegovy / Mounjaro
      '.op-fam{margin:4.5mm 12mm 0;border-radius:6mm;overflow:hidden;border:1px solid var(--trait);background:#fff;box-shadow:0 .5mm 1.6mm rgba(6,48,26,.14)}',
      '.op-fam-h{height:28mm;display:flex;align-items:center;gap:5mm;padding:0 6mm;color:#fff;' +
        'background:radial-gradient(ellipse 70mm 40mm at 100% -10%,rgba(255,252,222,.55) 0,rgba(221,223,75,.4) 30%,rgba(221,223,75,0) 65%),linear-gradient(200deg,#13a63f,#0a6a26);box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}',
      '.op-vis{width:22mm;height:20mm;flex:none}.op-vis svg{width:100%;height:100%;display:block}',
      '.op-fam-t{font-size:17pt;line-height:1.05}.op-fam-t small,.op-os-t small{font-size:10pt}',
      '.op-fam-s{font-size:8.5pt;margin-top:1mm;color:#eaf6ee}',
      '.op-fam-h .op-pill{margin-left:auto}',
      '.op-cols,.op-rw{display:grid;grid-template-columns:28mm minmax(0,1fr) 20mm 20mm 29mm;align-items:center;column-gap:2.5mm;padding:0 6mm}',
      '.op-cols{height:10mm;font-size:8pt;line-height:1.2;color:var(--gris);text-align:right}',
      '.op-cols span:nth-child(-n+2){text-align:left}.op-cols .o{color:var(--vert)}',
      '.op-rw{height:calc(' + H.famRang + 'mm + ' + e + ');border-top:1px solid var(--trait)}',
      '.op-dose{display:flex;align-items:center;gap:1.5mm;white-space:nowrap;font-size:12.5pt;line-height:1;color:var(--vert-f)}',
      '.op-th{width:8mm;height:9mm;flex:none}.op-th svg{width:100%;height:100%;display:block}',
      '.op-rw .op-nm{font-size:9pt}',
      '.op-rw .op-p{font-size:9.5pt}',
      '.op-rw .op-po{border-radius:3mm 3mm 3mm 0;padding:1.2mm 3mm;font-size:13pt}',
      '.op-rw:nth-child(odd){background:#fbfdfb}',
      // désignation + CIP, prix (communs aux blocs, au bandeau et aux cartes)
      '.op-nom{min-width:0;line-height:1.15}',
      '.op-nm{display:block;max-height:2.3em;overflow:hidden;font-size:8.5pt}.op-nm.long{font-size:8pt;letter-spacing:-.02em}',
      '.op-nom i{display:block;font-style:normal;font-size:8pt;color:var(--gris);margin-top:.4mm;white-space:nowrap}',
      '.op-p{text-align:right;font-size:8.5pt;white-space:nowrap}',
      '.op-po{justify-self:end;background:linear-gradient(180deg,#e9eb68 0,#dddf4b 55%,#d2d53a 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 .4mm .8mm rgba(6,48,26,.22);color:var(--anthra);border-radius:2.4mm 2.4mm 2.4mm 0;padding:.9mm 1.8mm;font-size:10pt;white-space:nowrap}',
      // Hélicidine en bandeau
      '.op-bande{margin:4.5mm 12mm 0;border-radius:5mm;border:1px solid var(--trait);background:#fff;box-shadow:0 .5mm 1.6mm rgba(6,48,26,.14);overflow:hidden;display:grid;grid-template-columns:minmax(30mm,auto) minmax(0,1fr)}',
      '.op-bande-c{display:flex;align-items:center;justify-content:center;gap:2mm;padding:2mm 4mm;color:#fff;background:radial-gradient(ellipse 60mm 30mm at 100% 0%,rgba(236,240,150,.5) 0,rgba(236,240,150,0) 60%),linear-gradient(200deg,#16ad42,#0a6a26);box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}',
      '.op-bande-c b{font-weight:400;font-size:12pt;white-space:nowrap}',
      '.op-bande .op-ico{width:6mm;height:6mm}',
      '.op-ch,.op-pr{display:grid;grid-template-columns:minmax(0,1fr) var(--cn,12.5mm) var(--cn,12.5mm) var(--co,17.5mm);column-gap:1.6mm;align-items:center;padding:0 3.5mm}',
      '.op-ch{height:5.6mm;font-size:8pt;color:var(--gris);text-align:right;white-space:nowrap}.op-ch span:first-child{text-align:left}.op-ch .o{color:var(--vert)}',
      '.op-bande .op-ch{height:7mm;padding-top:1.4mm}',
      '.op-pr{height:calc(' + H.rang + 'mm + ' + e + ');border-top:1px solid var(--trait)}',
      '.op-ch+.op-pr{border-top:0}',
      // Offre spéciale : en-tête vert + cartes par marque
      '.op-os{height:17mm;margin:4.5mm 12mm 0;border-radius:5mm;color:#fff;display:flex;align-items:center;gap:4mm;padding:0 6mm;' +
        'background:radial-gradient(ellipse 80mm 30mm at 100% -20%,rgba(255,252,222,.55) 0,rgba(221,223,75,.4) 30%,rgba(221,223,75,0) 65%),linear-gradient(200deg,#16ad42,#0a6a26);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 .5mm 1.6mm rgba(6,48,26,.18)}',
      '.op-os-t{font-size:15pt;line-height:1.1}.op-os-s{font-size:8.5pt;color:#eaf6ee;margin-top:.6mm}',
      '.op-os .op-pill{margin-left:auto}',
      '.op-grille{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:4mm;align-items:start;margin:4.5mm 12mm 0}',
      '.op-col{display:flex;flex-direction:column;gap:3.4mm}',
      '.op-carte{border-radius:4.5mm;border:1px solid var(--trait);background:#fff;box-shadow:0 .5mm 1.6mm rgba(6,48,26,.14);overflow:hidden}',
      '.op-carte-h{height:10.5mm;display:flex;align-items:center;gap:2.5mm;padding:0 3.5mm;background:linear-gradient(110deg,#e3f1e8,#f6faf7 75%);border-bottom:1px solid var(--trait)}',
      '.op-carte-h b{font-weight:400;font-size:11.5pt;color:var(--vert-f);letter-spacing:.3px;white-space:nowrap}',
      '.op-carte-h b small{font-size:8.5pt;color:var(--gris)}',
      '.op-carte-n{margin-left:auto;font-size:8pt;color:var(--gris);white-space:nowrap}',
      '.op-ico{width:7mm;height:7mm;flex:none}.op-ico svg{width:100%;height:100%;display:block}',
      '.op-alerte{margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#fff6dc;color:#5c4400;font-size:13.5px}',
      '@media print{.op-alerte{display:none!important}}'
    ].join('\n');
    var st = document.createElement('style'); st.id = STYLE_ID; st.textContent = css; document.head.appendChild(st);
  }
  function vide(root, html) { root.innerHTML = V2.opsoCatalogue.commun.enveloppe('<div class="v2-empty" style="padding:40px;text-align:center;color:var(--muted)">' + html + '</div>'); }
  function render(root) {
    if (!V2.opsoCatalogue || !V2.opsoCatalogue.commun) { root.innerHTML = '<div style="padding:40px;text-align:center">Écran indisponible. Rechargez la page.</div>'; return; }
    injectStyles();
    if (_etat === 'vide') { vide(root, 'Chargement des prix…'); charger(root); return; }
    if (_etat === 'charge') { vide(root, 'Chargement des prix…'); return; }
    var d = construire();
    if (!d) {
      vide(root, '<p style="margin:0 0 14px">' + MSG_INDISPO + '</p><button class="v2-btn primary" onclick="V2.opsoPrix.reessayer()">Réessayer</button>');
      return;
    }
    var alerte = '';
    if (d.signalees.length || d.sansPrix.length) {
      alerte = '<div class="op-alerte">' + (d.signalees.length ? d.signalees.length + (d.signalees.length > 1 ? ' lignes sont à vérifier' : ' ligne est à vérifier') + ' (les prix ne sont pas dans l’ordre attendu). ' : '') +
        (d.sansPrix.length ? d.sansPrix.length + (d.sansPrix.length > 1 ? ' produits ne sont pas affichés' : ' produit n’est pas affiché') + ' faute de prix.' : '') + '</div>';
    }
    root.innerHTML = V2.opsoCatalogue.commun.enveloppe('<div class="oc-barre-outils"><div><h1 class="v2-h1" style="margin:0 0 4px">' + TITRE + '</h1>' +
      '<p>' + d.n + ' produits : le PFHT, notre prix habituel sur facture et le prix négocié pour OPSO Santé. Prix HT par boîte.</p></div>' +
      '<div class="oc-actions"><button class="v2-btn primary" onclick="V2.opsoPrix.imprimer()">Imprimer / enregistrer en PDF</button>' +
      '<button class="v2-btn primary" id="op-btn-csv" onclick="V2.opsoPrix.csv()">Télécharger en Excel (CSV)</button></div></div>' + alerte +
      '<div class="oc-apercu">' + pagesHtml(d).replace(/<section class="oc-page/g, '<div class="oc-cadre"><section class="oc-page').replace(/<\/section>/g, '</section></div>') + '</div>');
    V2.opsoCatalogue.commun.ajuster(root);
    ajusterNoms(root);
  }

  // ── Excel (CSV) : mêmes lignes que l'écran, UTF-8 + BOM, « ; », CRLF, virgule décimale ──
  function csv() {
    var d = construire(); if (!d) return null;
    var K = V2.opsoCatalogue.commun.csv, v = function (x) { return x == null ? '' : K.virgule(x); };
    var lignesCsv = [['Section', 'Désignation', 'CIP13', 'PFHT', 'Prix Intégral habituel', 'Prix OPSO Santé']];
    d.sections.forEach(function (s) {
      s.items.forEach(function (it) {
        lignesCsv.push([K.sansFormule(s.titre + (s.etiquette ? ' (' + s.etiquette + ')' : '')), K.sansFormule(it.nom), it.cip ? '="' + it.cip + '"' : it.cipTexte, v(it.pfht), v(it.habituel), v(it.opso)]);
      });
    });
    var dt = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return { texte: '﻿' + lignesCsv.map(function (l) { return l.map(K.champ).join(';'); }).join('\r\n') + '\r\n',
      nom: 'Prix OPSO Sante - ' + dt.getFullYear() + '-' + p2(dt.getMonth() + 1) + '-' + p2(dt.getDate()) + '.csv' };
  }

  V2.opsoPrix = {
    lignes: lignes, pfht: pfhtDe, paginer: miseEnPage, csvTexte: csv,
    charger: function () { return chargerDonnees(true); }, pourCatalogue: pourCatalogue, styles: function () { injectStyles(); },
    etat: function () { return _etat; },
    ajusterNoms: ajusterNoms,
    signalees: 0, sansPrix: 0, lignesN: 0,   // lus par la sonde
    donnees: construire,
    csv: function () { V2.opsoCatalogue.commun.telecharger(csv()); },
    imprimer: function () {
      var avant = document.title, d = construire(); if (!d) return;
      document.title = 'Prix-OPSO-Sante';
      V2.opsoCatalogue.commun.preparerHtml(pagesHtml(d)).then(function (box) {
        if (box) ajusterNoms(box);
        try { window.print(); } catch (e) { V2.toast && V2.toast('Impression impossible', 'error'); }
        setTimeout(function () { document.title = avant; }, 1500);
      });
    },
    reessayer: function () { _etat = 'vide'; var r = document.getElementById('v2-root'); if (r) render(r); }
  };

  V2.pages[ROUTE] = { needs: [], render: render };
  window.addEventListener('resize', function () { var r = document.getElementById('v2-root'); if (r && V2.route && V2.route.name === ROUTE && V2.opsoCatalogue && V2.opsoCatalogue.commun) V2.opsoCatalogue.commun.ajuster(r); });
})();
