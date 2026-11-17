/* ═══════════════════════════════════════════════════════
   V2 · OFFILOG — « Catalogue Offilog · 500 meilleures ventes » de Transmettre (PDF et Excel)
   Il ne reste ici que ce dont ce catalogue a besoin : V2.offCatTopLignes, V2.offCatTopFichier et ce qui les alimente
   (ventesClassees, lignes, chargerTop, topPdf, topXlsx, nouveauPdf).
   L'ancienne fenêtre « Catalogue client » (PDF préfabriqués, Excel sur mesure, fichiers au format des logiciels de
   caisse) est RETIRÉE : « Le catalogue Offilog » (v2-offilog-vitrine.js) la remplace.
   Le fichier protégé `offilog-catalogue-prix.js` (clé `offilogcatalogue`, jamais dans le dépôt) porte le tarif
   laboratoire HT et le prix Offilog HT de ses lignes. Écart = prix Offilog / tarif laboratoire − 1.
   Chargé par le CRM seulement (absent de l'app OPSO).
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function dateFr(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }

  // Lignes du fichier protégé : [ean, marque, nom, rayon, tarif, prix, rang ventes Offilog|null, top vente du marché 0/1]
  function lignes() {
    var C = window.OFFILOG_CATALOGUE;
    if (!C || !C.lignes) return [];
    if (!C._obj) {
      C._obj = C.lignes.map(function (l) {
        return { ean: l[0], marque: l[1], nom: l[2], rayon: l[3], tarif: l[4], prix: l[5], ecart: (1 - l[5] / l[4]) * 100, rang: l[6] || null, topm: !!l[7] };
      });
    }
    return C._obj;
  }
  // Les produits classés, la meilleure vente en tête. Sans rang, sans prix ou sans code à 13 chiffres : hors fichier.
  // 09/10/2026 (suite) — on part de TOUTES les ventes classées, comme l'écran Offilog : le rang est celui du
  // dernier relevé (offilog-marche-data.js), les produits sont ceux des meilleures ventes (OFFILOG_BEST, prix
  // dans b.price). Avant, seuls les produits du catalogue client y étaient : « les 300 meilleures ventes »
  // allait de la n° 1 à la n° 396. Un produit du catalogue client garde son prix et son tarif laboratoire
  // (relevé plus récent) ; les autres n'ont pas de tarif laboratoire : la colonne reste vide, jamais devinée.
  // Un produit absent du dernier relevé est hors fichier : la date annoncée sous les boutons vaut pour tous.
  // Sans le relevé du marché en mémoire, on retombe sur le classement porté par le catalogue (C.ventes).
  function ventesClassees() {
    var C = window.OFFILOG_CATALOGUE;
    if (!C) return [];
    if (V2.fusionnerPrixBest) V2.fusionnerPrixBest();
    var B = window.OFFILOG_BEST || [], M = window.OFFILOG_MARCHE, cats = window.OFFILOG_CATS || {};
    var der = M && M.rangs && M.releves ? M.releves.length - 1 : -1;
    var cle = B.length + '|' + (V2.offilogPrixBest || 0) + '|' + (der >= 0 ? M.releves[der] : '') + '|' + Object.keys(cats).length;
    if (C._ventesCle !== cle) {
      var vus = {}, out = [];
      // marque / nom : lus par le catalogue « 500 meilleures ventes » de Transmettre (colonnes séparées) ; les fichiers par logiciel ne lisent que `lib`.
      var pousser = function (ean, lib, tarif, prix, rayon, repli, marque, nom) {
        var s = der >= 0 ? M.rangs[ean] : null, r = der >= 0 ? (s && s[der] > 0 ? s[der] : 0) : repli;
        if (!(r > 0) || !(prix > 0) || !/^\d{13}$/.test(ean) || vus[ean]) return;
        vus[ean] = 1; out.push({ ean: ean, lib: lib, tarif: tarif, prix: prix, rayon: rayon, rang: r, marque: marque || '', nom: nom || lib });
      };
      lignes().forEach(function (x) {
        var m = String(x.marque || '').trim(), n = String(x.nom || '').trim();
        pousser(String(x.ean), m && n.toLowerCase().indexOf(m.toLowerCase()) < 0 ? m + ' ' + n : n, x.tarif, x.prix, x.rayon, x.rang, m, n);
      });
      if (der >= 0) B.forEach(function (b) {
        if (b.ean) pousser(String(b.ean), String(b.name || '').trim(), null, +b.price, cats[String(b.id)] || 'Autres soins', 0, String(b.brand || '').trim(), String(b.name || '').trim());
      });
      C._ventes = out.sort(function (a, b) { return a.rang - b.rang; });
      C._ventesDate = der >= 0 ? M.releves[der] : C.ventes;
      C._ventesCle = cle;
    }
    return C._ventes;
  }
  // ── 06/11/2026 — « Catalogue Offilog · 500 meilleures ventes » dans Transmettre (demande Karine, 05/11) ──
  // Fabriqué DANS LE NAVIGATEUR au moment de « Préparer les fichiers » : les prix sont ceux des fichiers que le robot
  // hebdomadaire met à jour, jamais ceux d'un PDF déposé. Sélection = ventesClassees : rang du dernier relevé, catalogue client d'abord, puis OFFILOG_BEST.
  // Tarif laboratoire absent → cellule vide, jamais deviné ; aucun nom de tiers ; aucun prix dans le dépôt.
  var TOP_N = 500;
  function ligneTop(x) {
    var nom = String(x.nom || x.lib || '').trim(), m = String(x.marque || '').trim();
    // OFFILOG_BEST écrit « MARQUE – produit » : la marque a sa colonne, on ne la répète pas dans le produit.
    if (m && nom.toLowerCase().indexOf(m.toLowerCase() + ' – ') === 0) nom = nom.slice(m.length + 3).trim();
    return { rang: x.rang, marque: m, nom: nom, ean: x.ean, rayon: x.rayon || '', tarif: x.tarif > 0 ? x.tarif : null, prix: x.prix,
      ecart: x.tarif > 0 ? x.prix / x.tarif - 1 : null };
  }
  // Les lignes seules, sans toucher à l'état de l'écran (G) : lues aussi par la sonde de preuve.
  V2.offCatTopLignes = function (n) {
    var V = ventesClassees(), C = window.OFFILOG_CATALOGUE;
    return { lignes: V.slice(0, n || TOP_N).map(ligneTop), total: V.length, date: C ? C._ventesDate : '', maj: C ? C.maj : '' };
  };
  // Charge ce qu'il faut (à la demande), puis vérifie que TOUT est là : un fichier manquant donnerait une liste partielle
  // sans erreur (produits sans prix écartés, ancien classement) — on préfère ne rien fabriquer et le dire.
  var topEnCours = null;
  function chargerTop() {
    if (topEnCours) return topEnCours;
    var cles = [];
    if (!window.OFFILOG_CATALOGUE) cles.push('offilogcatalogue');
    if (!window.OFFILOG_BEST_PRIX) cles.push('offilogbestprix');
    if (!window.OFFILOG_MARCHE) cles.push('offilogmarche');
    if (!window.OFFILOG_CATS) cles.push('offilogcats');
    var p = cles.length && V2.loadFiles ? V2.loadFiles(cles) : Promise.resolve();
    topEnCours = Promise.resolve(p).catch(function () {}).then(function () {
      return V2.offilogChargerMeilleures ? V2.offilogChargerMeilleures() : !!window.OFFILOG_BEST;
    }).then(function () {
      var M = window.OFFILOG_MARCHE;
      var ok = window.OFFILOG_CATALOGUE && window.OFFILOG_BEST && window.OFFILOG_BEST_PRIX && window.OFFILOG_CATS &&
        M && M.rangs && M.releves && M.releves.length;
      if (!ok) throw new Error('données Offilog incomplètes');
      var d = V2.offCatTopLignes();
      if (d.lignes.length < TOP_N) throw new Error('classement incomplet : ' + d.lignes.length + ' produits');
      return d;
    }).then(function (d) { topEnCours = null; return d; }, function (e) { topEnCours = null; throw e; });
    return topEnCours;
  }
  var TOP_TITRE = 'Catalogue Offilog — les ' + TOP_N + ' meilleures ventes';
  var TOP_COLS = ['Rang', 'Marque', 'Produit', 'EAN', 'Rayon', 'Tarif laboratoire HT', 'Écart', 'Prix Offilog HT'];
  function ligneSource(d) {
    return (d.date ? 'Classement des ventes Offilog du ' + dateFr(d.date) : 'Classement des ventes Offilog') +
      (d.maj ? ' · prix du catalogue relevés le ' + dateFr(d.maj) : '') + ' · Prix HT';
  }
  // Un texte relevé sur un site tiers ne doit jamais ouvrir une cellule par = + - @ (formule dans un tableur).
  function sur(t) { return String(t == null ? '' : t).replace(/[\r\n\t]+/g, ' ').replace(/^[\s'=+\-@＝＋－＠]+/, ''); }
  function nomFichierTop(ext) { return 'Catalogue-Offilog-' + TOP_N + '-meilleures-ventes.' + ext; }

  function topXlsx(d) {
    return ensureXlsx().then(function () {
      var aoa = [[TOP_TITRE], [ligneSource(d)], [], TOP_COLS];
      d.lignes.forEach(function (x) { aoa.push([x.rang, sur(x.marque), sur(x.nom), String(x.ean), sur(x.rayon), x.tarif, x.ecart, x.prix]); });
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      for (var r = 4; r < aoa.length; r++) {
        [[5, '0.00'], [6, '0%'], [7, '0.00']].forEach(function (c) { var cl = ws[XLSX.utils.encode_cell({ r: r, c: c[0] })]; if (cl) cl.z = c[1]; });
      }
      ws['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 60 }, { wch: 15 }, { wch: 22 }, { wch: 20 }, { wch: 8 }, { wch: 16 }];
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catalogue');
      return new File([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], nomFichierTop('xlsx'),
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    });
  }

  // PDF : dessiné ligne à ligne avec jsPDF (celui de html2pdf), sans passer par une photo de la page — 500 lignes en
  // image dépasseraient la taille maximale d'un canevas sur certains navigateurs. Texte sélectionnable, léger.
  // html2pdf.bundle embarque jsPDF SANS l'exposer (vérifié le 06/11/2026 : ni window.jspdf ni window.jsPDF après chargement).
  // Et l'objet `pdf` rendu par html2pdf n'a PAS la classe pour constructeur (constructor = Object : vu sous WebKit le
  // 06/11/2026, « doc.setFont is not a function »). On garde donc ce DOCUMENT lui-même : html2pdf rend une page minuscule
  // au bon format, on ajoute une page vierge et on retire la (ou les) page(s) rendue(s).
  function nouveauPdf() {
    var opt = { unit: 'pt', format: 'a4', orientation: 'landscape' };
    var J = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (typeof J === 'function') return Promise.resolve(new J(opt));
    var el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:0;top:0;width:40px;height:20px;background:#fff;font-size:8px';
    el.textContent = '.'; document.body.appendChild(el);
    var fin = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    return window.html2pdf().set({ html2canvas: { scale: 0.5 }, jsPDF: opt }).from(el).toPdf().get('pdf').then(function (pdf) {
      fin();
      if (!pdf || typeof pdf.setFont !== 'function' || typeof pdf.deletePage !== 'function') throw new Error('jsPDF absent');
      var n = pdf.getNumberOfPages();
      pdf.addPage('a4', 'landscape');
      for (var i = n; i >= 1; i--) pdf.deletePage(i);
      pdf.setPage(1);
      return pdf;
    }, function (e) { fin(); throw e; });
  }
  // Polices PDF standard : Latin-1 seulement. Le reste est ramené à son équivalent le plus proche.
  function latin(t) {
    return String(t == null ? '' : t).replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-')
      .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/€/g, 'EUR').replace(/…/g, '...').replace(/×/g, 'x')
      .replace(/[^\x20-\x7e -ÿ]/g, '');
  }
  function eurPdf(v) { return v.toFixed(2).replace('.', ','); }
  function topPdf(d) {
    return window.ensureHtml2Pdf().then(nouveauPdf).then(function (doc) {
      var W = 842, H = 595, MX = 28, HL = 14.5, BAS = 30;
      // colonnes : x de départ, largeur, alignement
      var col = [[MX, 30, 'r'], [MX + 40, 92, 'l'], [MX + 138, 262, 'l'], [MX + 408, 74, 'l'], [MX + 488, 100, 'l'], [MX + 592, 62, 'r'], [MX + 660, 38, 'r'], [MX + 702, 56, 'r']];
      var haut = ['Rang', 'Marque', 'Produit', 'EAN', 'Rayon', 'Tarif labo HT', 'Écart', 'Prix Offilog HT'];
      function tenir(t, w) {
        t = latin(t); if (doc.getTextWidth(t) <= w) return t;
        while (t.length > 1 && doc.getTextWidth(t + '...') > w) t = t.slice(0, -1);
        return t.replace(/\s+$/, '') + '...';
      }
      function cellule(t, c, y) { doc.text(tenir(t, c[1]), c[2] === 'r' ? c[0] + c[1] : c[0], y, { align: c[2] === 'r' ? 'right' : 'left' }); }
      function enTete(premiere) {
        var y = 34;
        if (premiere) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(16, 19, 28); doc.text(latin(TOP_TITRE), MX, y);
          y += 15; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(95, 103, 122); doc.text(latin(ligneSource(d)), MX, y);
          y += 16;
        }
        doc.setFillColor(238, 242, 248); doc.rect(MX - 4, y - 10, W - 2 * MX + 8, 15, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(70, 78, 96);
        haut.forEach(function (h, i) { cellule(h, col[i], y); });
        return y + 6 + HL * 0.7;
      }
      var y = enTete(true), i = 0;
      d.lignes.forEach(function (x) {
        if (y > H - BAS) { doc.addPage(); y = enTete(false); i = 0; }
        if (i % 2) { doc.setFillColor(247, 249, 252); doc.rect(MX - 4, y - 10, W - 2 * MX + 8, HL, 'F'); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(16, 19, 28);
        cellule(String(x.rang), col[0], y); cellule(x.marque, col[1], y); cellule(x.nom, col[2], y);
        doc.setTextColor(95, 103, 122); cellule(x.ean, col[3], y); cellule(x.rayon, col[4], y);
        doc.setTextColor(16, 19, 28);
        cellule(x.tarif == null ? '' : eurPdf(x.tarif), col[5], y);
        cellule(x.ecart == null ? '' : (x.ecart <= 0 ? '-' : '+') + Math.round(Math.abs(x.ecart) * 100) + ' %', col[6], y);
        doc.setFont('helvetica', 'bold'); cellule(eurPdf(x.prix), col[7], y);
        y += HL; i++;
      });
      var n = doc.getNumberOfPages();
      for (var p = 1; p <= n; p++) {
        doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(140, 147, 165);
        doc.text('Prix HT - tarif laboratoire absent : case vide', MX, H - 16);
        doc.text('Page ' + p + ' / ' + n, W - MX, H - 16, { align: 'right' });
      }
      return new File([doc.output('blob')], nomFichierTop('pdf'), { type: 'application/pdf' });
    });
  }

  // type : 'pdf' | 'xlsx' → File, ou null après un message clair (jamais un document vide ou partiel).
  V2.offCatTopFichier = function (type) {
    return chargerTop().then(function (d) { return type === 'xlsx' ? topXlsx(d) : topPdf(d); }).catch(function (e) {
      console.error('catalogue Offilog 500', e);
      V2.toast('Catalogue Offilog : données pas chargées (connexion ?). Rien n\'a été préparé pour ce document, réessayez.', 'error');
      return null;
    });
  };

  // ── Excel ───────────────────────────────────────────────
  var xlsxEnCours = null;
  function ensureXlsx() {
    if (window.XLSX) return Promise.resolve();
    if (xlsxEnCours) return xlsxEnCours;
    xlsxEnCours = new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = function () { window.XLSX ? ok() : ko(); }; s.onerror = function () { xlsxEnCours = null; ko(); };
      document.head.appendChild(s);
    });
    return xlsxEnCours;
  }
})();
