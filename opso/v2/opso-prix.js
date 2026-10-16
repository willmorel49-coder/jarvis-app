/* ═══════════════════════════════════════════════════════════════════
   OPSO Santé · « Les prix OPSO Santé » — listing À PART du catalogue (15/10/2026).
   Demande de Will : le PFHT, notre prix Intégral habituel sur facture, et le prix
   négocié pour OPSO Santé. Prix HT par boîte, jamais de pourcentage.
   Sections, dans l'ordre : Wegovy comprimés (à venir) · Mounjaro injectable ·
   Hélicidine · Offre spéciale (en dernier ; sans nom de laboratoire, et seulement les
   produits que les adhérentes OPSO commandent déjà — Will, 16/10/2026).
   Toute l'offre tient sur UNE page A4 tant que les rangées restent lisibles (≥ 6 mm).
   ⚠️ Les prix négociés sont des CONDITIONS COMMERCIALES : aucun prix, aucun taux,
   aucune liste de CIP négociés n'est écrit ici. Tout vient de opso-prix-negocies.json,
   dans le seau privé « donnees-protegees » (lecture : compte connecté seulement).
   Sans session ou en cas d'échec, l'écran le dit et n'affiche aucun chiffre de repli.
   Réutilise les pièces de opso-catalogue.js (V2.opsoCatalogue.commun) : styles oc-*,
   aperçu A4, impression, CSV.
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
      of.push({ cip: c, cipTexte: c, nom: b.designation, pfht: pfhtDe(ppht, !!froid[c]), habituel: b.prix_ip, opso: b.offre_ip });
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
  function charger(root) {
    _etat = 'charge';
    Promise.all([chargerNegocies(), V2.loadFiles ? V2.loadFiles(['bench', 'ppht']) : 0]).then(function (r) {
      _neg = r[0]; _bench = true; _etat = 'ok';
    }).catch(function (e) {
      _neg = null; _etat = 'echec';
      try { console.warn('[opso-prix] chargement impossible :', e && e.message); } catch (x) {}
    }).then(function () { if (V2.route && V2.route.name === ROUTE) render(root); });
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

  // ── Rendu ──
  function dateEdition() { var d = new Date(); return d.getDate() + (d.getDate() === 1 ? 'er ' : ' ') + MOIS[d.getMonth()] + ' ' + d.getFullYear(); }
  var CAP = 23, UN_BANDEAU = 1.7;   // une page = 23 lignes ; un bandeau de section pèse 1,7 ligne
  var H_LIGNE = 10.2, H_MIN = 6;    // hauteur d'une rangée (mm) ; en dessous de 6 mm on repasse sur plusieurs pages
  function paginer(d) {
    var pages = [], cur = null, place = 0, unites = 0;
    d.sections.forEach(function (s) { unites += UN_BANDEAU + s.items.length; });
    // Toute l'offre sur UNE page : les rangées se resserrent juste ce qu'il faut (p.h, en mm).
    if (unites <= CAP * H_LIGNE / H_MIN) {
      cur = [];
      d.sections.forEach(function (s) { cur.push({ bandeau: s, suite: false }); s.items.forEach(function (it) { cur.push({ it: it, s: s }); }); });
      cur.h = Math.min(H_LIGNE, Math.floor(CAP * H_LIGNE / unites * 100) / 100);
      return [cur];
    }
    function nouvelle() { cur = []; pages.push(cur); place = 0; }
    d.sections.forEach(function (s) {
      var suite = false, i = 0;
      if (s.fort && cur && s.items.length + UN_BANDEAU <= CAP) nouvelle();   // la section mise en avant tient sur UNE page : on ne la coupe pas
      while (i < s.items.length) {
        if (!cur || place + UN_BANDEAU + 1 > CAP) nouvelle();
        cur.push({ bandeau: s, suite: suite }); place += UN_BANDEAU;
        while (i < s.items.length && place + 1 <= CAP) { cur.push({ it: s.items[i], s: s }); place += 1; i++; }
        suite = true;
      }
    });
    return pages;
  }
  function piedHtml(num, total) {
    return '<footer class="oc-pied"><span>Intégral Pharma, groupe de grossistes-répartiteurs, pour les adhérentes d’OPSO Santé</span>' +
      '<span>Édition du ' + esc(dateEdition()) + ' · ' + num + ' / ' + total + '</span></footer>';
  }
  function ligneHtml(it, fort) {
    return '<div class="op-ligne' + (fort ? ' fort' : '') + '"><span class="op-nom">' + esc(it.nom) + '</span>' +
      '<span class="op-cip">' + esc(it.cipTexte) + '</span><span class="op-n">' + eur(it.pfht) + '</span>' +
      '<span class="op-n">' + eur(it.habituel) + '</span><span class="op-opso">' + eur(it.opso) + '</span></div>';
  }
  function enteteHtml() {
    return '<div class="op-entete"><span>Désignation</span><span>CIP</span><span class="op-n">PFHT</span><span class="op-n">Prix Intégral habituel</span><span class="op-opso">Prix OPSO Santé</span></div>';
  }
  function couvertureHtml(d, total, debuts) {
    var C = V2.opsoCatalogue.commun;
    var tuiles = d.sections.map(function (s, i) {
      return '<li><span class="oc-t-num">' + String(i + 1).padStart(2, '0') + '</span><b>' + esc(s.titre) + (s.etiquette ? ' — ' + esc(s.etiquette) : '') + '</b>' +
        '<span>' + s.items.length + (s.items.length > 1 ? ' produits' : ' produit') + ' · page ' + debuts[s.k] + '</span></li>';
    }).join('');
    return '<section class="oc-page oc-couv">' +
      '<header class="oc-couv-haut"><div class="oc-halo"></div>' +
        '<div class="oc-lockup"><img class="l-ip" src="' + esc(C.logoIntegral) + '" alt="Intégral Pharma"><span class="by">by</span><img class="l-opso" src="' + esc(C.logo()) + '" alt="OPSO Santé"></div>' +
        '<h1 class="op-titre">' + TITRE + '</h1>' +
        '<p class="oc-accroche">Pour chaque produit : le prix fabricant (PFHT), notre prix habituel sur facture, et le prix négocié pour les adhérentes d’OPSO Santé.</p>' +
        '<p class="oc-chiffre">Édition du ' + esc(dateEdition()) + '</p>' +
      '</header>' +
      '<div class="oc-couv-bas"><h2>Au sommaire</h2><ol class="oc-tuiles">' + tuiles + '</ol>' +
        '<div class="oc-lire"><h2>Comment lire une ligne</h2>' +
          '<p>PFHT : prix fabricant hors taxes. Prix Intégral habituel : le prix HT que facture Intégral Pharma, abandon de marge déduit. Prix OPSO Santé : le prix HT négocié pour les adhérentes d’OPSO Santé, en vert. Tous les prix sont HT, par boîte.</p>' +
          '<p>Les comprimés Wegovy ne sont pas encore disponibles : leurs prix sont donnés à l’avance.</p></div>' +
      '</div>' + piedHtml(1, total) + '</section>';
  }
  function pagesHtml(d) {
    var pages = paginer(d), total = pages.length + 1, debuts = {};
    pages.forEach(function (p, i) { p.forEach(function (e) { if (e.bandeau && debuts[e.bandeau.k] == null) debuts[e.bandeau.k] = i + 2; }); });
    var html = couvertureHtml(d, total, debuts);
    pages.forEach(function (p, i) {
      var serre = p.h && p.h < H_LIGNE;
      html += '<section class="oc-page op-page' + (serre ? ' op-serre" style="--h:' + p.h + 'mm' : '') + '"><header class="oc-r-haut"><h2>' + TITRE + '</h2><span class="oc-r-sous">prix HT par boîte</span></header>' + enteteHtml();
      p.forEach(function (e) {
        if (e.bandeau) html += '<div class="op-bandeau' + (e.bandeau.fort ? ' fort' : '') + '"><b>' + esc(e.bandeau.titre) + (e.suite ? ' <small>(suite)</small>' : '') + '</b>' +
          (e.bandeau.etiquette ? '<em>' + esc(e.bandeau.etiquette) + '</em>' : '') + '</div>';
        else html += ligneHtml(e.it, e.s.fort);
      });
      html += piedHtml(i + 2, total) + '</section>';
    });
    return html;
  }

  var STYLE_ID = 'op-styles';
  function injectStyles() {
    V2.opsoCatalogue.commun.styles();
    if (document.getElementById(STYLE_ID)) return;
    var cols = 'minmax(0,1fr) 33mm 24mm 28mm 33mm';
    var css = [
      '.op-titre{font-size:44pt!important}',
      '.op-entete,.op-ligne{display:grid;grid-template-columns:' + cols + ';align-items:center;column-gap:3mm;padding:0 11mm 0 12mm}',
      '.op-entete{height:11mm;font-size:8pt;color:var(--gris);text-transform:uppercase;letter-spacing:.03em;line-height:1.15;border-bottom:.3mm solid rgba(42,45,47,.15)}',
      '.op-entete .op-opso{color:var(--vert-f)}',
      '.op-entete .op-n,.op-entete .op-opso{white-space:normal}',
      '.op-n{text-align:right;white-space:nowrap}',
      '.op-opso{text-align:right;white-space:nowrap}',
      '.op-ligne{height:var(--h,' + H_LIGNE + 'mm);border-top:.25mm solid rgba(42,45,47,.08);font-size:9.5pt}',
      '.op-nom{font-size:9.5pt;line-height:1.15;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}',
      '.op-cip{font-size:8.5pt;color:var(--gris);white-space:nowrap}',
      '.op-ligne .op-n{color:var(--gris)}',
      '.op-ligne .op-opso{font-size:12pt;font-weight:700;color:var(--vert-f)}',
      '.op-ligne.fort{background:linear-gradient(90deg,rgba(243,244,196,0) 55%,var(--lime-p) 100%)}',
      '.op-ligne.fort .op-opso{font-size:13pt;color:var(--anthra);background:var(--lime);border-radius:2mm;padding:.8mm 2.4mm;justify-self:end}',
      '.op-bandeau{height:calc(var(--h,' + H_LIGNE + 'mm) * ' + UN_BANDEAU + ');display:flex;align-items:flex-end;gap:4mm;padding:0 12mm 1.6mm;border-top:.25mm solid rgba(42,45,47,.08)}',
      '.op-bandeau b{font-weight:400;font-size:13pt;color:var(--vert-f)}',
      '.op-bandeau b small{font-size:9pt;color:var(--gris)}',
      '.op-bandeau em{font-style:normal;font-size:9pt;color:var(--anthra);background:var(--lime);border-radius:3mm;padding:.4mm 3mm}',
      '.op-bandeau.fort b{color:var(--anthra)}',
      // page resserrée (toute l'offre sur une page) : une seule ligne par désignation, prix OPSO plus compact
      '.op-serre .op-entete,.op-serre .op-ligne{grid-template-columns:minmax(0,1fr) 25mm 22mm 25mm 28mm}',   // la désignation gagne la place des chiffres
      '.op-serre .op-nom{-webkit-line-clamp:1;font-size:8.5pt}',
      '.op-serre .op-ligne{font-size:8.5pt}',
      '.op-serre .op-cip{font-size:8pt}',
      '.op-serre .op-ligne .op-opso{font-size:10.5pt}',
      '.op-serre .op-ligne.fort .op-opso{font-size:10.5pt;padding:.3mm 2mm}',
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
    lignes: lignes, pfht: pfhtDe, paginer: paginer, csvTexte: csv,
    signalees: 0, sansPrix: 0, lignesN: 0,   // lus par la sonde
    donnees: construire,
    csv: function () { V2.opsoCatalogue.commun.telecharger(csv()); },
    imprimer: function () {
      var avant = document.title, d = construire(); if (!d) return;
      document.title = 'Prix-OPSO-Sante';
      V2.opsoCatalogue.commun.preparerHtml(pagesHtml(d)).then(function () {
        try { window.print(); } catch (e) { V2.toast && V2.toast('Impression impossible', 'error'); }
        setTimeout(function () { document.title = avant; }, 1500);
      });
    },
    reessayer: function () { _etat = 'vide'; var r = document.getElementById('v2-root'); if (r) render(r); }
  };

  V2.pages[ROUTE] = { needs: [], render: render };
  window.addEventListener('resize', function () { var r = document.getElementById('v2-root'); if (r && V2.route && V2.route.name === ROUTE && V2.opsoCatalogue && V2.opsoCatalogue.commun) V2.opsoCatalogue.commun.ajuster(r); });
})();
