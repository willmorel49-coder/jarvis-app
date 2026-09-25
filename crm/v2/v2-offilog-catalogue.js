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
    if (!C) { corps.innerHTML = '<div class="offcat-wait">' + (V2._offcatKO ? 'Le catalogue n\'a pas pu être chargé. Vérifie la connexion puis rouvre-le.' : 'Chargement du catalogue…') + '</div>'; return; }
    var pdfs = declarerPdfs();
    var complet = pdfs.filter(function (d) { return !d.p.rayon; })[0];
    // 26/09 : « Meilleures ventes » n'est pas un rayon (nos meilleures ventes + top ventes du marché + index des marques)
    var ventes = pdfs.filter(function (d) { return /meilleures-ventes/.test(d.p.fichier); })[0];
    var rayons = pdfs.filter(function (d) { return d.p.rayon && d !== ventes; });
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
