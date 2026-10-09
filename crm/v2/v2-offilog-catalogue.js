/* ═══════════════════════════════════════════════════════════
   V2 · OFFILOG — CATALOGUE CLIENT (25/09/2026)
   Demande Will : un catalogue Offilog à montrer ET à envoyer au pharmacien,
   avec pour chaque produit le tarif laboratoire HT, l'écart en % et notre
   prix Offilog HT.
   - Tarif laboratoire HT : relevé dans un catalogue de plateforme 2026 (le
     prix tarif est le même pour tous les pharmaciens). Les conditions de ce
     tiers ne sont JAMAIS reprises, ni son nom.
   - Prix Offilog HT : relevé sur offilog.fr, compte connecté.
   - Écart = 1 − prix Offilog / tarif laboratoire.
   Les deux prix vivent dans `offilog-catalogue-prix.js`, fichier PROTÉGÉ
   (Supabase `donnees-protegees`, clé `offilogcatalogue`), jamais dans le dépôt.
   Il porte aussi la liste des PDF (`pdfs`) : le catalogue mis en page
   (maquette 1B « Studio couleur », choisie par Will le 25/09) est fabriqué
   À L'AVANCE sur le Mac (~/jarvis-catalogue-offilog/pdf/, Chrome → PDF),
   complet + un par rayon, et déposé dans le même seau, sous offilog-catalogue/.
   Ici on ne fait que les ouvrir ou les envoyer (V2.docsProteges).
   Chargé par le CRM seulement (absent de l'app OPSO) : sans ce module,
   le bouton de l'écran Offilog ne s'affiche pas.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var F = { rayon: '', marque: '', min: 0 };

  function eur(v) { return v == null ? '' : v.toFixed(2).replace('.', ',') + ' €'; }
  function pct(v) { return Math.round(v) + ' %'; }
  function mo(o) { return (o / 1048576).toFixed(o < 10485760 ? 1 : 0).replace('.', ',') + ' Mo'; }
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
  function filtrees() {
    return lignes().filter(function (x) {
      return (!F.rayon || x.rayon === F.rayon) && (!F.marque || x.marque === F.marque) && x.ecart >= F.min;
    }).sort(function (a, b) { return a.rayon.localeCompare(b.rayon, 'fr') || a.marque.localeCompare(b.marque, 'fr') || a.nom.localeCompare(b.nom, 'fr'); });
  }
  function valeurs(cle) {
    var m = {};
    lignes().forEach(function (x) { if (x[cle]) m[x[cle]] = (m[x[cle]] || 0) + 1; });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (k) { return [k, m[k]]; });
  }

  // Les PDF sont déclarés comme documents privés : V2.ouvrirDocProtege les
  // ouvre, V2.docProtegeFichier les rend en fichier à partager.
  function declarerPdfs() {
    var C = window.OFFILOG_CATALOGUE, D = V2.docsProteges;
    if (!C || !C.pdfs || !D) return [];
    return C.pdfs.map(function (p, i) {
      var cle = 'offcat' + i;
      D[cle] = { fichier: 'offilog-catalogue/' + p.fichier, titre: 'Catalogue Offilog · ' + (p.rayon || 'complet'), type: 'pdf' };
      return { cle: cle, p: p };
    });
  }

  // ── Fenêtre ─────────────────────────────────────────────
  function rendre() {
    var bd = document.getElementById('offcat-modal'); if (!bd) return;
    var C = window.OFFILOG_CATALOGUE;
    var corps = bd.querySelector('.offcat-body');
    if (!C) { corps.innerHTML = '<div class="offcat-wait">' + (V2._offcatKO ? 'Le catalogue n\'a pas pu être chargé. Vérifiez la connexion puis rouvrez-le.' : 'Chargement du catalogue…') + '</div>'; return; }
    var pdfs = declarerPdfs();
    var complet = pdfs.filter(function (d) { return !d.p.rayon; })[0];
    // 26/09 : « Meilleures ventes » n'est pas un rayon (nos meilleures ventes + top ventes du marché + index des marques)
    var ventes = pdfs.filter(function (d) { return /meilleures-ventes/.test(d.p.fichier); })[0];
    // 26/09 : éditions saisonnières (meilleures ventes de la saison) et catalogue court de prospection
    var prospect = pdfs.filter(function (d) { return /prospection/.test(d.p.fichier); })[0];
    var saisons = pdfs.filter(function (d) { return /-saison-/.test(d.p.fichier); });
    var rayons = pdfs.filter(function (d) { return d.p.rayon && d !== ventes && d !== prospect && saisons.indexOf(d) < 0; });
    function actions(d) {
      return '<button class="v2-btn v2-btn-ghost" onclick="V2.ouvrirDocProtege(\'' + d.cle + '\')">' + ICO('fiche', 15, 2) + ' Voir</button>' +
        '<button class="v2-btn v2-btn-primary" onclick="V2.offCatEnvoyer(\'' + d.cle + '\')">' + ICO('spark', 15, 2) + ' Envoyer</button>';
    }
    var L = filtrees();
    var moy = L.length ? L.reduce(function (s, x) { return s + x.ecart; }, 0) / L.length : 0;
    function sel(cle, lib) {
      return '<label class="offcat-f"><span>' + lib + '</span><select onchange="V2.offCatFiltre(\'' + cle + '\', this.value)">' +
        '<option value="">Tous</option>' + valeurs(cle).map(function (v) {
          return '<option value="' + esc(v[0]) + '"' + (F[cle] === v[0] ? ' selected' : '') + '>' + esc(v[0]) + ' (' + v[1] + ')</option>';
        }).join('') + '</select></label>';
    }
    var mins = [0, 10, 20, 30, 40];
    corps.innerHTML =
      '<div class="offcat-src">' + V2.fmtNum(lignes().length) + ' produits · tarif laboratoire HT 2026 · prix Offilog HT relevés le ' + dateFr(C.maj) + '</div>' +
      (complet ? '<div class="offcat-hero"><div><div class="offcat-h">Le catalogue complet</div>' +
        '<div class="offcat-d">' + V2.fmtNum(complet.p.produits) + ' produits · ' + complet.p.pages + ' pages · ' + mo(complet.p.octets) + '</div></div>' +
        '<div class="offcat-act">' + actions(complet) + '</div></div>' : '') +
      (ventes ? '<div class="offcat-hero"><div><div class="offcat-h">Nos meilleures ventes</div>' +
        '<div class="offcat-d">' + V2.fmtNum(ventes.p.produits) + ' produits · top ventes du marché signalés · toutes nos marques · ' + ventes.p.pages + ' pages · ' + mo(ventes.p.octets) + '</div></div>' +
        '<div class="offcat-act">' + actions(ventes) + '</div></div>' : '') +
      blocLgo(C) +
      (prospect ? '<div class="offcat-hero"><div><div class="offcat-h">Pour un prospect</div>' +
        '<div class="offcat-d">Catalogue court à laisser en visite · ' + V2.fmtNum(prospect.p.produits) + ' produits · ' + prospect.p.pages + ' pages · ' + mo(prospect.p.octets) + '</div></div>' +
        '<div class="offcat-act">' + actions(prospect) + '</div></div>' : '') +
      (saisons.length ? '<div class="offcat-l">Une saison</div><div class="offcat-rayons">' + saisons.map(function (d) {
        return '<div class="offcat-rayon"><div class="offcat-rn">' + esc(d.p.rayon) + '</div>' +
          '<div class="offcat-d">' + V2.fmtNum(d.p.produits) + ' produits · ' + d.p.pages + ' pages · ' + mo(d.p.octets) + '</div>' +
          '<div class="offcat-act">' + actions(d) + '</div></div>';
      }).join('') + '</div>' : '') +
      (rayons.length ? '<div class="offcat-l">Un rayon seulement</div><div class="offcat-rayons">' + rayons.map(function (d) {
        return '<div class="offcat-rayon"><div class="offcat-rn">' + esc(d.p.rayon) + '</div>' +
          '<div class="offcat-d">' + V2.fmtNum(d.p.produits) + ' produits · ' + mo(d.p.octets) + '</div>' +
          '<div class="offcat-act">' + actions(d) + '</div></div>';
      }).join('') + '</div>' : '<div class="offcat-wait">Les PDF ne sont pas encore déposés.</div>') +
      '<div class="offcat-l">Excel sur mesure</div>' +
      '<div class="offcat-filtres">' + sel('rayon', 'Rayon') + sel('marque', 'Marque') +
        '<label class="offcat-f"><span>Écart minimal</span><select onchange="V2.offCatFiltre(\'min\', this.value)">' +
          mins.map(function (m) { return '<option value="' + m + '"' + (F.min === m ? ' selected' : '') + '>' + (m ? '≥ ' + m + ' %' : 'Tous') + '</option>'; }).join('') +
        '</select></label>' +
        '<div class="offcat-f"><span>&nbsp;</span><button class="v2-btn v2-btn-ghost" onclick="V2.offCatExcel()"' + (L.length ? '' : ' disabled') + '>' + ICO('download', 15, 2) + ' Excel · ' + V2.fmtNum(L.length) + ' produits</button></div>' +
      '</div>' +
      '<div class="offcat-kpi">' + (L.length ? 'En moyenne <b class="mono">−' + pct(moy) + '</b> sous le tarif laboratoire' : 'Aucun produit pour ces filtres.') + '</div>' +
      (L.length ? '<div class="offcat-tab"><table><thead><tr><th>Produit</th><th class="n">Tarif labo HT</th><th class="n">Écart</th><th class="n">Prix Offilog HT</th></tr></thead><tbody>' +
        L.slice(0, 30).map(function (x) {
          return '<tr><td><span class="mq">' + esc(x.marque) + '</span> ' + esc(x.nom) + '<small class="mono">' + esc(x.ean) + ' · ' + esc(x.rayon) + '</small></td>' +
            '<td class="n mono barre">' + eur(x.tarif) + '</td><td class="n"><span class="offcat-pill mono">−' + pct(x.ecart) + '</span></td><td class="n mono fort">' + eur(x.prix) + '</td></tr>';
        }).join('') +
      '</tbody></table>' + (L.length > 30 ? '<div class="offcat-plus">… et ' + V2.fmtNum(L.length - 30) + ' autres dans l\'Excel</div>' : '') + '</div>' : '');
  }

  V2.offCatFiltre = function (cle, v) { F[cle] = cle === 'min' ? +v : v; rendre(); };

  // ── Les meilleures ventes, au format d'import de chaque logiciel ──
  // 09/10/2026 — mêmes colonnes, ligne de titre, encodage et décimales que les catalogues Intégral
  // de l'écran Logiciels officine (fabriqués par ~/jarvis-catalogues-lgo/build.py). Offilog ne donne
  // ni code article ni taux de TVA : ces deux colonnes restent vides. Le prix est le prix Offilog HT.
  var G = { lgo: 'winpharma', n: 300 };
  function dec(v, n) { return v == null ? '' : { v: v, n: n == null ? 2 : n }; }   // nombre à n décimales
  var WIN = ['Commentaire', 'Code Labo', 'EAN13', 'EAN13_2', 'Libellé', 'TVA', 'Prix A HT', 'Remise1', 'Vignette', 'Code Acte',
    'QteMin', 'Gabarit', 'Gammes', 'Labo', 'Labo adr1', 'Labo adr2', 'Labo cp', 'Labo ville', 'Labo tel', 'fou_fax',
    'fou_web', 'QteMin2', 'RemQte2', 'QteMin3', 'RemQte3', 'QteMin4', 'RemQte4', 'Referencement', 'Conditions'];
  var LISIBLE = ['EAN', 'LIBELLE', 'PRIX TARIF HT', 'PRIX NET HT', 'CATEGORIE'];
  function lisible(x) { return [x.ean, x.lib, dec(x.tarif), dec(x.prix), x.rayon]; }
  var LGO = [
    { s: 'winpharma', nom: 'Winpharma', t: WIN, titre: true, utf8: true,
      f: function (x) { var r = WIN.map(function () { return ''; }); r[2] = x.ean; r[4] = x.lib; r[6] = dec(x.prix, 5); r[7] = dec(0, 5); r[10] = 1; return r; } },
    { s: 'lgpi', nom: 'LGPI', t: ['CODE PRODUIT', 'DESIGNATION', 'PRIX NET HT'], f: function (x) { return [x.ean, x.lib, dec(x.prix)]; } },
    { s: 'smartrx', nom: 'Smart RX', t: ['CODE ARTICLE', 'CIP13', 'GAMME', '(fixe)', '(fixe)', '(fixe)', 'LIBELLE', 'PRIX NET HT', 'TVA', '', '', '', '(fixe)', '(fixe)', 'ABANDON DE MARGE'],
      f: function (x, g) { return ['', x.ean, g, 1, 1, 1, x.lib, dec(x.prix), '', '', '', '', 1, 99999, dec(0)]; } },
    { s: 'leo', nom: 'LEO', titre: true, t: ['CIP7', 'CIP13', 'EAN', 'Libellé', 'Prix HT Catalogue', 'Prix HT Remisé', 'Gabarit', 'Mini de commande',
      'Gamme', 'Sous Gamme', 'Seuil n° 1', 'Prix HT remisé 1', 'Seuil n° 2', 'Prix HT remisé 2', 'Seuil n° 3', 'Prix HT remisé 3'],
      f: function (x, g) { var cip = /^3400/.test(x.ean); return ['', cip ? x.ean : '', cip ? '' : x.ean, x.lib, dec(x.tarif), dec(x.prix), '', '', g, x.rayon, '', '', '', '', '', '']; } },
    { s: 'pharmaland', nom: 'Pharmaland', t: ['CODE ARTICLE', 'CIP13', 'GAMME', '(fixe)', '(fixe)', '(fixe)', 'LIBELLE', 'PRIX NET HT', 'TVA', 'ABANDON DE MARGE'],
      f: function (x, g) { return ['', x.ean, g, 1, 1, 1, x.lib, dec(x.prix), '', dec(0)]; } },
    { s: 'pharmony', nom: 'Pharmony', t: ['CIP13', 'DESIGNATION', 'PRIX ACHAT U HT', 'ABANDON DE MARGE'], f: function (x) { return [x.ean, x.lib, dec(x.prix), dec(0)]; } },
    { s: 'pharmavitale', nom: 'Pharmavitale', t: LISIBLE, titre: true, f: lisible },
    { s: 'visiopharm', nom: 'VisioPharm', t: LISIBLE, titre: true, f: lisible }
  ];
  // Les produits classés, la meilleure vente en tête. Sans rang, sans prix ou sans code à 13 chiffres : hors fichier.
  function ventesClassees() {
    var C = window.OFFILOG_CATALOGUE;
    if (!C) return [];
    if (!C._ventes) {
      C._ventes = lignes().filter(function (x) { return x.rang > 0 && x.prix > 0 && /^\d{13}$/.test(String(x.ean)); })
        .sort(function (a, b) { return a.rang - b.rang; })
        .map(function (x) {
          var m = String(x.marque || '').trim(), n = String(x.nom || '').trim();
          return { ean: String(x.ean), lib: m && n.toLowerCase().indexOf(m.toLowerCase()) < 0 ? m + ' ' + n : n, tarif: x.tarif, prix: x.prix, rayon: x.rayon, rang: x.rang };
        });
    }
    return C._ventes;
  }
  function lgoChoisi() { return LGO.filter(function (l) { return l.s === G.lgo; })[0] || LGO[0]; }
  function blocLgo(C) {
    var V = ventesClassees(); if (!V.length) return '';
    var n = Math.min(G.n || V.length, V.length), l = lgoChoisi();
    var tailles = [200, 300, 500].filter(function (t) { return t < V.length; });
    function bouton(type, lib, cls) {
      return '<div class="offcat-f"><span>&nbsp;</span><button class="v2-btn ' + cls + '" onclick="V2.offCatLgoFichier(\'' + type + '\')">' + ICO('download', 15, 2) + ' ' + lib + '</button></div>';
    }
    return '<div class="offcat-l">Les meilleures ventes, pour son logiciel</div>' +
      '<div class="offcat-filtres offcat-lgo">' +
        '<label class="offcat-f"><span>Logiciel</span><select onchange="V2.offCatLgo(\'lgo\', this.value)">' + LGO.map(function (o) {
          return '<option value="' + o.s + '"' + (o === l ? ' selected' : '') + '>' + o.nom + '</option>';
        }).join('') + '</select></label>' +
        '<label class="offcat-f"><span>Sélection</span><select onchange="V2.offCatLgo(\'n\', this.value)">' + tailles.map(function (t) {
          return '<option value="' + t + '"' + (G.n === t ? ' selected' : '') + '>Les ' + t + ' meilleures ventes</option>';
        }).join('') + '<option value="0"' + (n === V.length ? ' selected' : '') + '>Toutes les ventes classées (' + V2.fmtNum(V.length) + ')</option></select></label>' +
        bouton('xlsx', 'Excel', 'v2-btn-primary') + bouton('csv', 'CSV', 'v2-btn-ghost') +
      '</div>' +
      '<div class="offcat-kpi">Dans l\'ordre des ventes, de la <b class="mono">n° 1</b> à la <b class="mono">n° ' + V2.fmtNum(V[n - 1].rang) + '</b>' +
        (C.ventes ? ' · classement Offilog du ' + dateFr(C.ventes) : '') + ' · colonnes de ' + l.nom +
        ' · le CSV s\'importe dans le logiciel, l\'Excel sert à le relire.</div>';
  }
  V2.offCatLgo = function (cle, v) { G[cle] = cle === 'n' ? +v : v; rendre(); };

  // Windows-1252 : l'encodage attendu par tous les logiciels sauf Winpharma. Hors table → « ? ».
  var CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';   // octets 0x80 à 0x9F
  function cp1252(s) {
    var o = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), k = CP1252.indexOf(s.charAt(i));
      o[i] = (c < 128 || (c > 159 && c < 256)) ? c : (k >= 0 ? 128 + k : 63);
    }
    return o;
  }
  function csvVal(v) {
    if (v && v.n != null) return v.v.toFixed(v.n).replace('.', ',');
    return String(v).replace(/;/g, ',').replace(/[\r\n]+/g, ' ');
  }
  // Le fichier, tel qu'il sera enregistré : { nom, titres, lignes } — lu aussi par la sonde de preuve.
  V2.offCatLgoDonnees = function () {
    var V = ventesClassees(), l = lgoChoisi(), n = Math.min(G.n || V.length, V.length);
    var entier = n === V.length, gamme = 'OFFILOG' + (entier ? '' : ' TOP ' + n);
    return { lgo: l, nom: 'offilog-' + (entier ? 'meilleures-ventes' : 'top' + n) + '-' + l.s, titres: l.t,
      lignes: V.slice(0, n).map(function (x) { return l.f(x, gamme); }) };
  };
  V2.offCatLgoCsv = function () {
    var d = V2.offCatLgoDonnees();
    var txt = (d.lgo.titre ? d.titres.join(';') + '\r\n' : '') + d.lignes.map(function (r) { return r.map(csvVal).join(';') + '\r\n'; }).join('');
    return d.lgo.utf8 ? new TextEncoder().encode(txt) : cp1252(txt);
  };
  V2.offCatLgoFichier = function (type) {
    var d = V2.offCatLgoDonnees(); if (!d.lignes.length) return;
    if (type === 'csv') {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([V2.offCatLgoCsv()], { type: 'text/csv' }));
      a.download = d.nom + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return;
    }
    ensureXlsx().then(function () {
      // Une seule feuille, les mêmes colonnes, rien d'autre : certains logiciels refusent le reste.
      var aoa = [d.titres].concat(d.lignes.map(function (r) { return r.map(function (v) { return v && v.n != null ? v.v : v; }); }));
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = d.titres.map(function (h) { return { wch: /^(LIB|DESIG)/i.test(h) ? 52 : Math.max(12, h.length + 2) }; });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catalogue');
      XLSX.writeFile(wb, d.nom + '.xlsx');
    }).catch(function () { V2.toast('Export Excel indisponible (hors ligne ?)', 'error'); });
  };

  V2.offCatEnvoyer = function (cle) {
    if (!V2.docProtegeFichier) return;
    V2.toast('Préparation du PDF…');
    V2.docProtegeFichier(cle).then(function (f) {
      if (!f) { V2.toast('PDF indisponible (connexion ?)', 'error'); return; }
      // le fichier du seau porte son dossier (offilog-catalogue/…) : on ne garde que son nom
      var nom = f.name.split('/').pop();
      return V2.shareOrSaveBlob(new File([f], nom, { type: 'application/pdf' }), nom, V2.docsProteges[cle].titre);
    }, function () { V2.toast('PDF indisponible (connexion ?)', 'error'); });
  };

  V2.offCatalogue = function () {
    var bd = document.getElementById('offcat-modal');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'offcat-modal'; bd.className = 'off-mkt-modal';
      bd.innerHTML =
        '<div class="off-mkt-dialog offcat-dialog" onclick="event.stopPropagation()">' +
          '<div class="off-mkt-top offcat-top">' +
            '<div class="t">' + ICO('grid', 17, 2) + ' Catalogue Offilog pour le pharmacien</div>' +
            '<button class="off-mkt-x" onclick="V2.offCatFermer()" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
          '</div>' +
          '<div class="offcat-body"></div>' +
        '</div>';
      bd.onclick = function () { V2.offCatFermer(); };
      document.body.appendChild(bd);
    }
    bd.classList.add('open');
    rendre();
    if (!window.OFFILOG_CATALOGUE && V2.loadFiles) {
      V2._offcatKO = false;
      V2.loadFiles(['offilogcatalogue']).then(function () {
        if (!window.OFFILOG_CATALOGUE) V2._offcatKO = true;
        rendre();
      }, function () { V2._offcatKO = true; rendre(); });
    }
  };
  V2.offCatFermer = function () { var bd = document.getElementById('offcat-modal'); if (bd) bd.classList.remove('open'); };

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
  V2.offCatExcel = function () {
    var L = filtrees(); if (!L.length) return;
    var C = window.OFFILOG_CATALOGUE;
    ensureXlsx().then(function () {
      var titre = [F.rayon, F.marque, F.min ? 'écart ≥ ' + F.min + ' %' : ''].filter(Boolean).join(' · ') || 'Tout le catalogue';
      var aoa = [
        ['Catalogue Offilog — ' + titre],
        ['Prix HT, hors promotions, susceptibles d\'évoluer · tarif laboratoire 2026 · prix Offilog relevés le ' + dateFr(C.maj) + (C.ventes ? ' · rang = classement des meilleures ventes Offilog au ' + dateFr(C.ventes) : '')],
        [],
        ['Rayon', 'Marque', 'Produit', 'EAN', 'Tarif labo HT (€)', 'Écart vs tarif labo (%)', 'Prix Offilog HT (€)', 'Rang ventes Offilog', 'Top vente du marché']
      ];
      L.forEach(function (x) { aoa.push([x.rayon, x.marque, x.nom, x.ean, x.tarif, Math.round(x.ecart), x.prix, x.rang || '', x.topm ? 'Oui' : '']); });
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 24 }, { wch: 22 }, { wch: 60 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 17 }, { wch: 18 }, { wch: 19 }];
      ws['!autofilter'] = { ref: 'A4:I' + (L.length + 4) };
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catalogue Offilog');
      var bout = [F.rayon, F.marque].filter(Boolean).join('-').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
      XLSX.writeFile(wb, 'Catalogue-Offilog' + (bout ? '-' + bout : '') + '-' + new Date().toISOString().slice(0, 10) + '.xlsx');
    }).catch(function () { V2.toast('Export Excel indisponible (hors ligne ?)', 'error'); });
  };

  (function css() {
    if (document.getElementById('offcat-css')) return;
    var st = document.createElement('style'); st.id = 'offcat-css';
    st.textContent = [
      '.offcat-dialog{width:min(1040px,96vw)}',
      '.offcat-body{overflow-y:auto;padding:18px 20px 22px;flex:1}',
      '.offcat-src{font-size:13px;color:var(--muted);margin-bottom:14px}',
      '.offcat-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px 22px;border-radius:18px;margin-bottom:18px;color:#1d1300;background:radial-gradient(120% 140% at 12% 0%,#FFE58A 0%,#FFC21A 45%,#F5A300 100%);box-shadow:0 10px 30px rgba(245,163,0,.28),inset 0 1px 0 rgba(255,255,255,.6)}',
      '.offcat-h{font-family:"Bodoni Moda",Georgia,serif;font-size:26px;font-weight:700;letter-spacing:-.01em}',
      '.offcat-hero .offcat-d{color:#4a3500}',
      '.offcat-d{font-size:13px;color:var(--muted);margin-top:3px}',
      '.offcat-act{display:flex;gap:8px;flex-wrap:wrap}',
      '.offcat-l{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:18px 0 10px}',
      '.offcat-rayons{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}',
      '.offcat-rayon{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:linear-gradient(180deg,var(--card),var(--card-2));display:flex;flex-direction:column;gap:8px}',
      '.offcat-rn{font-weight:800;font-size:15px;color:var(--ip-ink)}',
      '.offcat-rayon .v2-btn{flex:1;min-height:40px}',
      '.offcat-filtres{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:12px}',
      '.offcat-f{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}',
      '.offcat-f select{height:42px;border:1px solid var(--line);border-radius:12px;padding:0 12px;font:inherit;font-size:16px;text-transform:none;letter-spacing:0;font-weight:500;color:var(--ip-ink);background:var(--card);min-width:0}',
      '.offcat-f .v2-btn{height:42px}',
      // 09/10 : bloc « meilleures ventes par logiciel » — colonnes qui laissent la place au texte du menu Sélection ; sur mobile les deux menus prennent la largeur, Excel et CSV côte à côte
      '.offcat-filtres.offcat-lgo{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr) minmax(0,.6fr) minmax(0,.6fr)}',
      '.offcat-lgo .v2-btn{width:100%}',
      '@media(max-width:700px){.offcat-filtres.offcat-lgo{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.offcat-lgo .offcat-f:nth-child(-n+2){grid-column:1/-1}}',
      '.offcat-kpi{font-size:14px;color:var(--ip-ink);margin-bottom:10px}',
      '.offcat-tab{border:1px solid var(--line);border-radius:14px;overflow-x:auto}',
      '.offcat-tab table{width:100%;border-collapse:collapse;font-size:14px}',
      '.offcat-tab th{background:#4165A1;color:#fff;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.04em;padding:9px 10px;white-space:nowrap}',
      '.offcat-tab td{padding:8px 10px;border-top:1px solid var(--line);vertical-align:top;color:var(--ip-ink)}',
      '.offcat-tab td small{display:block;font-size:12px;color:var(--muted);margin-top:2px}',
      '.offcat-tab .n{text-align:right;white-space:nowrap}',
      '.offcat-tab .mq{font-weight:800}',
      '.offcat-tab .barre{color:var(--muted);text-decoration:line-through}',
      '.offcat-tab .fort{font-weight:800}',
      '.offcat-pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#FFC21A;color:#1d1300;font-weight:800;font-size:13px}',
      '.offcat-plus,.offcat-wait{padding:14px;text-align:center;color:var(--muted);font-size:14px}',
      '@media(max-width:700px){.offcat-filtres{grid-template-columns:1fr 1fr}.offcat-hero .offcat-act{width:100%}.offcat-hero .v2-btn{flex:1;min-height:44px}}'
    ].join('');
    document.head.appendChild(st);
  })();
})();
