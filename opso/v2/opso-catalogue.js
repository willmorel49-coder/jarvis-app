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
  var PAR_PAGE = 22;
  var RAYONS = [
    { k: 'remb', label: 'Médicaments remboursables', f: { pr_low: 1, pr_mid: 1, pr_high: 1 }, pages: 2, deux: true },
    { k: 'gen', label: 'Génériques', f: { gen: 1 }, pages: 1, deux: false },
    { k: 'biosim', label: 'Biosimilaires', f: { biosim: 1 }, pages: 1, deux: true },
    { k: 'nr', label: 'Non remboursables', f: { nr: 1 }, pages: 2, deux: false }
  ];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function periodeTexte(p) {
    if (!p) return '';
    return p.de === p.a ? 'commandes de ' + MOIS[p.de - 1] + ' ' + p.annee
      : 'commandes de ' + MOIS[p.de - 1] + ' à ' + MOIS[p.a - 1] + ' ' + p.annee;
  }
  function normCip(c) { return String(c == null ? '' : c).replace(/\D/g, '').replace(/^0+/, ''); }

  // ── Données ──
  var SRC_RESEAU = '../../crm/v2/prod-reseau-data.js?v=20260930a';
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
  var _photos = null;
  function photoDe(cip) {
    if (!_photos) {
      _photos = {};
      (window.OFFILOG_BEST || []).forEach(function (b) { if (b && b.ean && b.img) _photos[normCip(b.ean)] = b.img; });
      var M = window.MKT_IMG || {};
      Object.keys(M).forEach(function (k) { if (M[k] && !_photos[normCip(k)]) _photos[normCip(k)] = M[k]; });
    }
    return _photos[normCip(cip)] || '';
  }

  // Construit les rayons : produits du réseau classés par nombre de pharmacies, avec prix.
  var _cache = null;
  function construire() {
    var R = window.PROD_RESEAU, PS = window.PROD_STATS, B = window.BENCHMARK;
    if (!R || !PS || !B) return null;
    var cle = [R.empreinte, PS.length, B.length, (V2.sales || []).length].join('|');
    if (_cache && _cache.cle === cle) return _cache;
    var ps = {}; PS.forEach(function (r) { var c = normCip(r.c); if (c && !ps[c]) ps[c] = r; });
    var bench = {}; B.forEach(function (r) { var c = normCip(r && r.cip13); if (c && !bench[c]) bench[c] = r; });
    var opso = {};
    (V2.sales || []).forEach(function (s) {
      if (!(s.qte > 0) || (V2.estReste && V2.estReste(s.pharmacyId))) return;
      var c = normCip(s.artCode); (opso[c] || (opso[c] = {}))[s.pharmacyId] = 1;
    });
    var rayons = RAYONS.map(function (r) { return { r: r, items: [], sansPrix: 0 }; });
    Object.keys(R.n).forEach(function (cip) {
      var c = normCip(cip), p = ps[c]; if (!p) return;
      var ray = rayons.filter(function (x) { return x.r.f[p.f]; })[0]; if (!ray) return;
      if (ray.items.length >= ray.r.pages * PAR_PAGE) return;       // R.n est déjà trié par nombre décroissant
      var bp = V2.bestPrice(bench[c]);
      if (bp.ip && !(bp.ht > bp.ip) && p.ppht > bp.ip && !p.stale) bp.ht = p.ppht;   // PPHT absent du benchmark : celui du catalogue
      if (!bp.ip) { ray.sansPrix++; return; }                       // jamais une ligne sans prix net
      ray.items.push({
        cip: cip, nom: p.d || (bench[c] && bench[c].designation) || cip, n: R.n[cip],
        opso: opso[c] ? Object.keys(opso[c]).length : 0,
        ppht: ray.r.deux && bp.ht && bp.ht > bp.ip ? bp.ht : null, net: bp.ip
      });
    });
    var nOpso = {}; (V2.sales || []).forEach(function (s) { if (s.qte > 0 && !(V2.estReste && V2.estReste(s.pharmacyId))) nOpso[s.pharmacyId] = 1; });
    _cache = { cle: cle, rayons: rayons.filter(function (x) { return x.items.length; }), R: R, opsoPharmas: Object.keys(nOpso).length };
    return _cache;
  }

  // ── Rendu ──
  var LOGO_IP = 'assets/logo-integral-serre.png';
  function logoOpso() { return (window.V2_BRAND && window.V2_BRAND.logoWhite) || 'assets/opsosante-logo-blanc.png'; }
  function monogramme(nom) {
    var m = String(nom || '').replace(/[^A-Za-zÀ-ÿ]/g, '');
    return esc(m.slice(0, 2)).toUpperCase();
  }
  function ligneHtml(it, rang, max, deux) {
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
        '<b>' + ent(it.n) + '</b>' + (it.opso ? '<em>dont ' + it.opso + ' OPSO</em>' : '') + '</span>' +
      '<span class="oc-prix' + (deux ? ' deux' : '') + '">' + prix + '</span></div>';
  }
  function piedHtml(d, num, total) {
    return '<footer class="oc-pied"><span>Intégral Pharma, groupe de grossistes-répartiteurs, pour les adhérentes d’OPSO Santé</span>' +
      '<span>' + esc(periodeTexte(d.R.periode)) + ' · ' + num + ' / ' + total + '</span></footer>';
  }
  function couvertureHtml(d, total, debuts) {
    var tuiles = d.rayons.map(function (x, i) {
      return '<li><span class="oc-t-num">' + String(i + 1).padStart(2, '0') + '</span><b>' + esc(x.r.label) + '</b>' +
        '<span>' + x.items.length + ' produits · page ' + debuts[i] + '</span></li>';
    }).join('');
    var ex = d.rayons[0] && d.rayons[0].items[0];
    return '<section class="oc-page oc-couv">' +
      '<header class="oc-couv-haut"><div class="oc-halo"></div>' +
        '<div class="oc-lockup"><img class="l-ip" src="' + LOGO_IP + '" alt="Intégral Pharma"><span class="by">by</span><img class="l-opso" src="' + esc(logoOpso()) + '" alt="OPSO Santé"></div>' +
        '<h1>Le catalogue</h1>' +
        '<p class="oc-accroche">Les produits que les pharmacies du réseau Intégral commandent le plus, classés par nombre de pharmacies.</p>' +
        '<p class="oc-chiffre"><b>' + ent(d.R.officines) + '</b> pharmacies du réseau · dont <b>' + d.opsoPharmas + '</b> adhérentes OPSO Santé</p>' +
      '</header>' +
      '<div class="oc-couv-bas"><h2>Au sommaire</h2><ol class="oc-tuiles">' + tuiles + '</ol>' +
        (ex ? '<div class="oc-lire"><h2>Comment lire une ligne</h2>' +
          '<p>La barre et le chiffre donnent le nombre de pharmacies du réseau qui ont commandé le produit (' + esc(periodeTexte(d.R.periode)) + '). ' +
          '« dont N OPSO » : combien d’entre elles sont adhérentes d’OPSO Santé.</p>' +
          '<p>PPHT : prix pharmacien hors taxes. Prix net : prix HT facturé par Intégral Pharma, abandon de marge déduit. Génériques et non remboursables : prix net seul.</p></div>' : '') +
      '</div>' + piedHtml(d, 1, total) + '</section>';
  }
  function pagesHtml(d) {
    var pages = [], debuts = [], num = 2;
    d.rayons.forEach(function (x) {
      debuts.push(num);
      for (var i = 0; i < x.items.length; i += PAR_PAGE) { pages.push({ x: x, de: i }); num++; }
    });
    var total = pages.length + 1;
    var html = couvertureHtml(d, total, debuts);
    pages.forEach(function (pg, k) {
      var x = pg.x, lot = x.items.slice(pg.de, pg.de + PAR_PAGE), suite = pg.de > 0;
      var max = x.items[0].n;   // barres à l'échelle du rayon (le 1er du rayon = barre pleine)
      html += '<section class="oc-page oc-rayon r-' + x.r.k + '">' +
        '<header class="oc-r-haut"><h2>' + esc(x.r.label) + (suite ? ' <small>(suite)</small>' : '') + '</h2>' +
          '<span class="oc-r-sous">classés par nombre de pharmacies du réseau</span></header>' +
        '<div class="oc-entete"><span></span><span></span><span>Produit</span><span>Commandé par (pharmacies)</span>' +
          '<span class="oc-prix' + (x.r.deux ? ' deux' : '') + '">' + (x.r.deux ? '<span>PPHT</span><span>Prix net</span>' : '<span>Prix net</span>') + '</span></div>' +
        lot.map(function (it, i) { return ligneHtml(it, pg.de + i + 1, max, x.r.deux); }).join('') +
        piedHtml(d, k + 2, total) + '</section>';
    });
    return html;
  }

  function injectStyles() {
    if (document.getElementById('oc-styles')) return;
    var css = [
      '.oc-barre-outils{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin:0 0 16px}',
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
      '.oc-pied span:last-child{white-space:nowrap}',
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
    var d = construire();
    if (!d) {
      root.innerHTML = page('<div class="v2-empty" style="padding:40px;text-align:center;color:var(--muted)">Chargement du catalogue…</div>');
      Promise.all([chargerScript(SRC_RESEAU, 'PROD_RESEAU'), V2.loadFiles ? V2.loadFiles(['bench']) : 0]).then(function () {
        if (V2.route && V2.route.name === 'marketing' && construire()) render(root);
        else if (V2.route && V2.route.name === 'marketing') root.innerHTML = page('<div class="v2-empty" style="padding:40px;text-align:center;color:var(--muted)">Le catalogue n’a pas pu se charger. Rechargez la page.</div>');
      });
      return;
    }
    var nb = 0; d.rayons.forEach(function (x) { nb += x.items.length; });
    root.innerHTML = page('<div class="oc-barre-outils"><div><h1 class="v2-h1" style="margin:0 0 4px">Le catalogue</h1>' +
      '<p>' + nb + ' produits parmi les plus commandés par les ' + ent(d.R.officines) + ' pharmacies du réseau Intégral (' + esc(periodeTexte(d.R.periode)) + '), avec le nombre d’adhérentes OPSO Santé qui les commandent.</p></div>' +
      '<button class="v2-btn primary" onclick="V2.opsoCatalogue.imprimer()">Imprimer / enregistrer en PDF</button></div>' +
      '<div class="oc-apercu">' + pagesHtml(d).replace(/<section class="oc-page/g, '<div class="oc-cadre"><section class="oc-page').replace(/<\/section>/g, '</section></div>') + '</div>');
    ajusterApercu(root);
    if (!window.OFFILOG_BEST || !window.MKT_IMG) chargerPhotos().then(function () { _photos = null; if (V2.route && V2.route.name === 'marketing') render(root); });
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
    injectStyles(); nettoyer();
    var st = document.createElement('style'); st.id = 'oc-print-style'; st.textContent = STYLE_IMPR; document.head.appendChild(st);
    var box = document.createElement('div'); box.id = 'oc-print'; box.innerHTML = pagesHtml(d); document.body.appendChild(box);
    if (!printBound) { printBound = true; window.addEventListener('afterprint', nettoyer); }
    var attentes = Array.prototype.map.call(box.querySelectorAll('img'), function (im) {
      return new Promise(function (ok) { if (im.complete) return ok(); im.addEventListener('load', ok); im.addEventListener('error', ok); });
    });
    var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    return Promise.race([Promise.all(attentes.concat([fonts])), new Promise(function (ok) { setTimeout(ok, 6000); })]).then(function () { return box; });
  }
  V2.opsoCatalogue = {
    imprimer: function () {
      var avant = document.title;
      document.title = 'Catalogue-Integral-Pharma-OPSO-Sante';
      preparer().then(function (box) {
        if (!box) return;
        try { window.print(); } catch (e) { V2.toast && V2.toast('Impression impossible', 'error'); }
        setTimeout(function () { document.title = avant; }, 1500);
      });
    },
    preparer: preparer,
    donnees: construire
  };

  V2.pages.marketing = { needs: [], render: render };
  window.addEventListener('resize', function () { var r = document.getElementById('v2-root'); if (r && V2.route && V2.route.name === 'marketing') ajusterApercu(r); });
})();
