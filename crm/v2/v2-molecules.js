/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Catalogue & prix" (pages.molecules) — app JARVIS
   Catalogue UNIQUE (fusion « Par produit » + « Catalogues grossiste ») :
   tous les produits vendus par le réseau, classés en 6 catégories
   (Princeps ×3 tranches · NR · Génériques · Biosimilaires), avec par CIP :
   Phies réseau, rotation, marge pharmacien (MDL), remise Intégral, CA, et
   le PRIX NET (PPHT) + STOCK de l'établissement choisi. Génère un doc PDF
   « top N par catégorie » et des sélections marketing. Données : PROD_STATS
   (prod-stats-data.js) + ETAB_PRICES (etab-prices-data.js).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : (n + ' €'); };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(n); };

  // 6 catégories voulues
  var FAMS = [
    { k: 'all',    label: 'Tout',                     sc: '#0050E6' },
    { k: 'pr_low', label: 'Princeps · petits prix',   sc: '#1E9E6A' },
    { k: 'pr_mid', label: 'Princeps · intermédiaire', sc: '#0050E6' },
    { k: 'pr_high',label: 'Princeps · cher',          sc: '#C7791A' },
    { k: 'nr',     label: 'NR',                        sc: '#E0556E' },
    { k: 'gen',    label: 'Génériques',               sc: '#7C3AED' },
    { k: 'biosim', label: 'Biosimilaires',            sc: '#00B5D8' },
  ];
  var FAM_BY = {}; FAMS.forEach(function (f) { FAM_BY[f.k] = f; });
  var FAM_SHORT = { pr_low: 'Princeps petits prix', pr_mid: 'Princeps intermédiaire', pr_high: 'Princeps cher', nr: 'NR', gen: 'Génériques', biosim: 'Biosimilaires' };
  var FAM_ORDER = ['pr_low', 'pr_mid', 'pr_high', 'nr', 'gen', 'biosim'];

  var S = { sort: 'n', q: '', chip: 'all', etab: '', stockOnly: false, perCat: 5 };
  var COLS = [
    { k: 'rota', l: 'Rotation', sub: '/phie/an', fmt: num },
    { k: 'marge', l: 'Marge pharma.', sub: '/an (MDL)', fmt: eur, accent: 'var(--c-opp)' },
  ];
  function cap(s) { s = (s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function famBadge(k) { var f = FAM_BY[k]; if (!f || k === 'all') return ''; return '<span class="mol-fam" style="--fc:' + f.sc + '">' + esc(FAM_SHORT[k] || f.label) + '</span>'; }

  // ── prix + stock par établissement ──
  function ensureEtab(cb) {
    if (window.ETAB_PRICES) { cb(); return; }
    var s = document.createElement('script'); s.src = 'etab-prices-data.js?v=20260701e1';
    s.onload = function () { cb(); }; s.onerror = function () { cb(); };
    document.head.appendChild(s);
  }
  function etabRec(cip) {
    var E = window.ETAB_PRICES; if (!E || cip == null || cip === '') return null;
    cip = String(cip);
    if (S.etab && E.prices && E.prices[S.etab]) return E.prices[S.etab][cip] || null;
    return (E.all && E.all[cip]) || null;
  }

  function baseData() {
    var data = (window.PROD_STATS || []);
    if (S.chip !== 'all') data = data.filter(function (r) { return r.f === S.chip; });
    var q = S.q.trim().toLowerCase();
    if (q) data = data.filter(function (r) { return (r.d || '').toLowerCase().indexOf(q) >= 0 || (r.c || '').indexOf(q) >= 0; });
    if (S.etab && S.stockOnly) data = data.filter(function (r) { var er = etabRec(r.c); return !!(er && er[1] > 0); });
    return data;
  }
  function counts() { var c = {}; FAMS.forEach(function (f) { c[f.k] = 0; }); (window.PROD_STATS || []).forEach(function (r) { c.all++; if (c[r.f] != null) c[r.f]++; }); return c; }

  function rowsHtml() {
    var data = baseData().slice();
    data.sort(function (a, b) { return (b[S.sort] || 0) - (a[S.sort] || 0); });
    var shown = data.slice(0, 200);
    var showStock = !!(window.ETAB_PRICES && S.etab);
    var ncol = 11 + (showStock ? 1 : 0);
    if (!shown.length) return '<tr><td colspan="' + ncol + '" style="padding:24px;text-align:center;color:var(--muted)">Aucun produit.</td></tr>';
    return shown.map(function (r, i) {
      var er = etabRec(r.c);
      var ppht = (er && er[0] > 0) ? er[0] : (r.ppht || 0);
      var net = r.net || 0;
      var stk = er ? er[1] : null;
      var rpct = (ppht > 0 && net > 0 && net <= ppht) ? Math.round((ppht - net) / ppht * 1000) / 10 : (r.rpct || 0);
      var stockTd = showStock ? '<td class="num mono" style="font-weight:800;color:' + (stk > 0 ? 'var(--c-opp)' : 'var(--c-rose)') + '">' + (stk != null ? num(stk) : '—') + '</td>' : '';
      return '<tr>' +
        '<td class="num" style="color:var(--muted-2);width:30px;text-align:right;font-family:var(--mono)">' + (i + 1) + '</td>' +
        '<td><span style="font-weight:700">' + esc(cap(r.d)) + '</span></td>' +
        '<td class="mono" style="color:var(--muted);font-size:11.5px">' + esc(r.c) + '</td>' +
        '<td>' + famBadge(r.f) + '</td>' +
        '<td class="num mono" style="font-weight:800">' + num(r.n) + '</td>' +
        '<td class="num mono" style="color:var(--muted)">' + (ppht > 0 ? eur(ppht) : '—') + '</td>' +
        '<td class="num mono" style="color:var(--ip-blue);font-weight:800">' + (net > 0 ? eur(net) : '—') + '</td>' +
        '<td class="num">' + (rpct > 0 ? '<span class="mol-rem">−' + String(rpct).replace('.', ',') + '%</span>' : '<span style="color:var(--muted-2)">—</span>') + '</td>' +
        COLS.map(function (c) { return '<td class="num mono"' + (c.accent ? ' style="color:' + c.accent + ';font-weight:800"' : '') + '>' + c.fmt(r[c.k] || 0) + '</td>'; }).join('') +
        stockTd +
      '</tr>';
    }).join('');
  }

  V2.molFilter = function (k) { S.chip = k; V2.render(); };
  V2.molSort = function (k) { S.sort = k; fill(); syncHead(); };
  V2.molEtab = function (code) { S.etab = code || ''; if (!window.ETAB_PRICES) ensureEtab(function () { if (V2.route && V2.route.name === 'molecules') V2.render(); }); V2.render(); };
  V2.molStockOnly = function (on) { S.stockOnly = !!on; V2.render(); };
  V2.molPerCat = function (n) { S.perCat = (+n) || 0; V2.render(); };
  var _t = null;
  V2.molSearch = function (v) { S.q = v || ''; if (_t) clearTimeout(_t); _t = setTimeout(fill, 200); };
  function fill() { var b = document.getElementById('mol-tbody'); if (b) b.innerHTML = rowsHtml(); var cnt = document.getElementById('mol-count'); if (cnt) cnt.textContent = num(baseData().length); }
  function syncHead() { Array.prototype.forEach.call(document.querySelectorAll('.mol-th'), function (th) { th.classList.toggle('on', th.getAttribute('data-k') === S.sort); }); }

  // ── Créer une sélection marketing (liste parfaite) depuis la vue courante ──
  V2.molList = function () {
    if (!V2.mkt || !V2.mkt.newSelection) { if (V2.toast) V2.toast('Marketing indisponible'); return; }
    var perCat = S.perCat > 0 ? S.perCat : 9999;   // nb de produits PAR catégorie sur la fiche
    var fams = (S.chip === 'all') ? FAM_ORDER : [S.chip];
    var q = S.q.trim().toLowerCase();
    var products = [];
    fams.forEach(function (k) {
      var rows = (window.PROD_STATS || []).filter(function (r) { return r.f === k; });
      if (q) rows = rows.filter(function (r) { return (r.d || '').toLowerCase().indexOf(q) >= 0 || (r.c || '').indexOf(q) >= 0; });
      if (S.etab && S.stockOnly) rows = rows.filter(function (r) { var er = etabRec(r.c); return !!(er && er[1] > 0); });
      rows.sort(function (a, b) { return (b.n || 0) - (a.n || 0) || (b.rota || 0) - (a.rota || 0); });   // top nb pharmacies
      rows.slice(0, perCat).forEach(function (r) {
        var er = etabRec(r.c); var px = (er && er[0] > 0) ? er[0] : 0;
        products.push({ src: 'cat', key: String(r.c), id: '', name: r.d, brand: '', ean: '', cip: String(r.c), price: px, remise: 0, img: '', froid: false, cat: (FAM_BY[k] && FAM_BY[k].label) || '' });
      });
    });
    if (!products.length) { if (V2.toast) V2.toast('Aucun produit'); return; }
    var suffix = S.etab ? ' · ' + S.etab : '';
    var title = (S.chip === 'all')
      ? ('Top ' + (S.perCat > 0 ? S.perCat + ' ' : '') + 'par catégorie' + suffix)
      : ((FAM_BY[S.chip] ? FAM_BY[S.chip].label : 'Top produits') + ' — top pharmacies' + suffix);
    V2.mkt.newSelection(title,
      'Les meilleures ventes par catégorie (par nb de pharmacies qui commandent)' + (S.etab ? ' — prix ' + S.etab : '') + '.', products);
  };

  // ── Document PDF : top N par catégorie ──
  V2.molPdf = function () {
    if (typeof window.ensureHtml2Pdf !== 'function') { if (V2.toast) V2.toast('Module PDF indisponible', 'error'); return; }
    var DATA = window.PROD_STATS || []; if (!DATA.length) { if (V2.toast) V2.toast('Catalogue vide', 'warn'); return; }
    var perCat = S.perCat; var showStock = !!(window.ETAB_PRICES && S.etab);
    var e2 = function (v) { return (v ? (+v).toFixed(2).replace('.', ',') : '—') + (v ? ' €' : ''); };
    var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    if (V2.toast) V2.toast('Génération du PDF…');
    var byFam = {}; FAM_ORDER.forEach(function (k) { byFam[k] = []; });
    DATA.forEach(function (r) { if (byFam[r.f]) byFam[r.f].push(r); });
    var secs = FAM_ORDER.map(function (k) {
      var rows = byFam[k].filter(function (r) { if (!(S.etab && S.stockOnly)) return true; var er = etabRec(r.c); return !!(er && er[1] > 0); });
      rows.sort(function (a, b) { return (b.n || 0) - (a.n || 0) || (b.rota || 0) - (a.rota || 0); });
      if (perCat > 0) rows = rows.slice(0, perCat);
      if (!rows.length) return '';
      var trs = rows.map(function (r, i) {
        var er = etabRec(r.c);
        var ppht = (er && er[0] > 0) ? er[0] : (r.ppht || 0);
        var net = r.net || 0; var stk = er ? er[1] : null;
        var rpct = (ppht > 0 && net > 0 && net <= ppht) ? Math.round((ppht - net) / ppht * 1000) / 10 : (r.rpct || 0);
        var stockTd = showStock ? '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:9.5px;font-weight:700;color:' + (stk > 0 ? '#1E9E6A' : '#E0556E') + '">' + (stk != null ? stk : '—') + '</td>' : '';
        return '<tr style="border-bottom:1px solid #EEF1F6">' +
          '<td style="padding:3px 6px;color:#9AA1B2;font-size:9px;text-align:right">' + (i + 1) + '</td>' +
          '<td style="padding:3px 6px;font-size:10px;font-weight:600;color:#10131C">' + esc(cap(r.d).slice(0, 52)) + '</td>' +
          '<td style="padding:3px 6px;font-family:monospace;font-size:8.5px;color:#737A8C">' + esc(r.c) + '</td>' +
          '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:9.5px;color:#9AA1B2;text-decoration:line-through">' + e2(ppht) + '</td>' +
          '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:10px;font-weight:800;color:#0050E6">' + e2(net) + '</td>' +
          '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:9px;font-weight:700;color:#0f7a52">' + (rpct > 0 ? '−' + String(rpct).replace('.', ',') + '%' : '—') + '</td>' +
          '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:9.5px;font-weight:800">' + num(r.n) + '</td>' +
          stockTd +
          '</tr>';
      }).join('');
      var ths = ['#', 'Produit', 'CIP', 'PPHT', 'Net remisé', 'Remise', 'Pharmacies'].concat(showStock ? ['Stock'] : []);
      return '<div style="margin-bottom:13px;page-break-inside:avoid">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:linear-gradient(90deg,' + FAM_BY[k].sc + '22,transparent);border-left:4px solid ' + FAM_BY[k].sc + ';border-radius:5px;margin-bottom:4px">' +
          '<div style="font-size:12px;font-weight:800;color:#10131C">' + esc(FAM_BY[k].label) + '</div><div style="font-size:9px;color:#737A8C">top ' + rows.length + '</div></div>' +
        '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#F4F6FB">' +
          ths.map(function (h, ci) { return '<th style="padding:4px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#737A8C;text-align:' + (ci < 3 ? 'left' : 'right') + '">' + h + '</th>'; }).join('') +
        '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    }).filter(Boolean).join('');
    if (!secs) { if (V2.toast) V2.toast('Aucun produit à afficher', 'warn'); return; }
    var subt = 'Top ' + (perCat > 0 ? perCat + ' ' : '') + 'par catégorie · classé par nb de pharmacies qui commandent' + (S.etab ? ' · prix &amp; stock ' + esc(S.etab) : ' · prix net indicatif');
    var html = '<div style="padding:18px 22px;font-family:Satoshi,Inter,system-ui,sans-serif;color:#10131C">' +
      '<div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #10131C;padding-bottom:12px;margin-bottom:14px">' +
        '<div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(150deg,#0050E6,#0034A0);display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div>' +
        '<div style="flex:1"><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Intégral Pharma · catalogue & prix</div>' +
          '<div style="font-size:18px;font-weight:800">Top produits par catégorie' + (S.etab ? ' · ' + esc(S.etab) : '') + '</div>' +
          '<div style="font-size:10px;color:#737A8C">' + subt + '</div></div>' +
        '<div style="text-align:right;font-size:11px;font-weight:700;font-family:monospace">' + dateStr + '</div>' +
      '</div>' + secs +
      '<div style="margin-top:14px;padding-top:8px;border-top:1px solid #E5E9F2;font-size:8px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">Intégral Pharma · document commercial · « Phies » = nb d\'officines du réseau qui commandent' + (S.etab ? ' · prix/stock ' + esc(S.etab) : '') + '</div>' +
    '</div>';
    window.ensureHtml2Pdf().then(function () { return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; }).then(function () {
      var wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff';
      wrap.innerHTML = html; document.body.appendChild(wrap);
      var fn = 'catalogue-top-produits' + (S.etab ? '-' + S.etab : '') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      window.html2pdf().from(wrap.firstChild).set({ filename: fn, margin: [8, 8, 10, 8], image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } })
        .save().then(function () { if (wrap.parentNode) document.body.removeChild(wrap); if (V2.toast) V2.toast('Doc téléchargé'); })
        .catch(function (e) { if (wrap.parentNode) document.body.removeChild(wrap); if (V2.toast) V2.toast('Erreur PDF', 'error'); });
    });
  };

  V2.pages.molecules = {
    render: function (root, param) {
      if (param != null && param !== '') { S.q = String(param); S.chip = 'all'; }
      if (!window.PROD_STATS) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap"><div class="v2-empty"><div class="v2-empty-d">Données produits indisponibles.</div></div></div>';
        return;
      }
      if (!window.ETAB_PRICES) ensureEtab(function () { if (V2.route && V2.route.name === 'molecules') V2.render(); });
      var c = counts();
      var chips = FAMS.map(function (f) {
        var on = S.chip === f.k ? ' on' : '';
        return '<button class="v2-seg' + on + '" style="--sc:' + f.sc + '" onclick="V2.molFilter(\'' + f.k + '\')">' +
          (f.k === 'all' ? '' : '<span class="sw"></span>') + esc(f.label) + '<span class="cnt">' + num(c[f.k] || 0) + '</span></button>';
      }).join('');
      var ETABS = (window.ETAB_PRICES && window.ETAB_PRICES.etabs) || [];
      var etabBtns = '<button class="mol-chip' + (S.etab === '' ? ' on' : '') + '" onclick="V2.molEtab(\'\')">Tous</button>' +
        ETABS.map(function (e) { return '<button class="mol-chip' + (S.etab === e.code ? ' on' : '') + '" onclick="V2.molEtab(\'' + e.code + '\')">' + esc(e.code) + '</button>'; }).join('');
      var etabBar = ETABS.length ? ('<div class="mol-bar"><span class="mol-barlbl">Établissement — prix &amp; stock</span><div class="mol-chips">' + etabBtns + '</div>' +
        (S.etab ? '<label class="mol-tgl"><input type="checkbox"' + (S.stockOnly ? ' checked' : '') + ' onchange="V2.molStockOnly(this.checked)"> En stock uniquement</label>' : '') + '</div>') : '';
      var PERCATS = [3, 5, 10, 15, 0];
      var perBtns = PERCATS.map(function (n) { return '<button class="mol-chip' + (S.perCat === n ? ' on' : '') + '" onclick="V2.molPerCat(' + n + ')">' + (n === 0 ? 'Tous' : n) + '</button>'; }).join('');
      var docBar = '<div class="mol-bar"><span class="mol-barlbl">Produits par catégorie (doc &amp; fiche)</span><div class="mol-chips">' + perBtns + '</div>' +
        '<button class="v2-btn v2-btn-primary mol-doc" onclick="V2.molPdf()">' + ICO('download', 15) + 'Générer le doc — top ' + (S.perCat > 0 ? S.perCat : 'tous') + '/catégorie</button>' +
        '<button class="v2-btn v2-btn-ghost mol-doc" onclick="V2.molList()">' + ICO('plus', 15) + 'Créer la liste' + (S.chip !== 'all' ? ' (' + esc(FAM_SHORT[S.chip] || '') + ')' : '') + '</button></div>';
      var th = function (col) { return '<th class="num mol-th' + (S.sort === col.k ? ' on' : '') + '" data-k="' + col.k + '" onclick="V2.molSort(\'' + col.k + '\')" style="cursor:pointer;white-space:nowrap">' + col.l + '<small style="display:block;font-weight:500;color:var(--muted-2)">' + col.sub + ' ↕</small></th>'; };
      var showStock = !!(window.ETAB_PRICES && S.etab);
      var qVal = S.q.replace(/"/g, '&quot;');
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' +
          '<div class="v2-page-title">Catalogue &amp; prix</div>' +
          '<div class="v2-page-sub">Tous les produits du réseau par catégorie (princeps par tranche · NR · génériques · biosimilaires) : nb de pharmacies, rotation, marge pharmacien, ta remise, et ton prix net + stock par établissement. Génère un doc « top par catégorie » ou une liste.</div>' +
          '<div class="mol-search"><span>' + ICO('search', 18) + '</span><input id="mol-q" type="search" placeholder="Chercher un produit ou un CIP (doliprane, 3400…)" value="' + qVal + '" oninput="V2.molSearch(this.value)" autocomplete="off"></div>' +
          '<div class="v2-segs">' + chips + '</div>' +
          etabBar + docBar +
          '<div class="cat-count"><b id="mol-count" style="color:var(--ip-ink);font-family:var(--mono)">' + num(baseData().length) + '</b> produit(s)</div>' +
          '<div style="overflow-x:auto"><table class="v2-table mol-table"><thead><tr>' +
            '<th class="num">#</th><th>Produit</th><th>CIP13</th><th>Famille</th>' +
            '<th class="num mol-th' + (S.sort === 'n' ? ' on' : '') + '" data-k="n" onclick="V2.molSort(\'n\')" style="cursor:pointer">Pharmacies<small style="display:block;font-weight:500;color:var(--muted-2)">réseau ↕</small></th>' +
            '<th class="num">PPHT<small style="display:block;font-weight:500;color:var(--muted-2)">tarif</small></th>' +
            '<th class="num">Net remisé<small style="display:block;font-weight:500;color:var(--muted-2)">réel</small></th>' +
            '<th class="num">Remise</th>' +
            COLS.map(th).join('') +
            (showStock ? '<th class="num">Stock</th>' : '') +
          '</tr></thead><tbody id="mol-tbody">' + rowsHtml() + '</tbody></table></div>' +
          '<div class="v2-page-sub" style="margin-top:14px;font-size:12px">Estimations à partir des ventes réelles du réseau (5 mois, annualisées) · marge MDL = produits remboursables · prix net + stock = établissement choisi · top 200 affichés.</div>' +
        '</div>';
    }
  };

  if (!document.getElementById('v2-mol-css')) {
    var st = document.createElement('style'); st.id = 'v2-mol-css';
    st.textContent =
      '.mol-search{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:14px 0}' +
      '.mol-search span{color:var(--ip-blue);display:flex}' +
      '.mol-search input{flex:1;border:none;outline:none;background:none;font-family:var(--font);font-size:15px;color:var(--ip-ink)}' +
      '.mol-table th.mol-th.on{color:var(--ip-blue)}' +
      '.mol-table td,.mol-table th{padding:8px 10px}' +
      '.mol-fam{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;color:var(--fc);background:color-mix(in srgb,var(--fc) 14%,transparent);white-space:nowrap}' +
      '.mol-rem{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:800;color:#0f7a52;background:color-mix(in srgb,#1E9E6A 14%,#fff);font-family:var(--mono)}' +
      '.mol-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:11px 13px;background:color-mix(in srgb,var(--ip-blue) 4%,#fff);border:1px solid color-mix(in srgb,var(--ip-blue) 15%,var(--line));border-radius:12px}' +
      '.mol-barlbl{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ip-blue)}' +
      '.mol-chips{display:flex;gap:6px;flex-wrap:wrap}' +
      '.mol-chip{border:1px solid var(--line-strong,#d7dbe6);background:#fff;border-radius:999px;padding:6px 13px;font-family:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:.12s}' +
      '.mol-chip:active{transform:scale(.96)}' +
      '.mol-chip.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}' +
      '.mol-tgl{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--ip-ink);cursor:pointer;margin-left:auto}' +
      '.mol-tgl input{width:16px;height:16px;accent-color:var(--ip-blue)}' +
      '.mol-doc{margin-left:0}';
    document.head.appendChild(st);
  }
})();
