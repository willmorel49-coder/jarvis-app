/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Catalogue & prix" (pages.molecules) — app JARVIS
   Catalogue UNIQUE : tous les produits du réseau en 6 catégories
   (Princeps ×3 tranches · NR · Génériques · Biosimilaires), classés par
   NB DE PHARMACIES qui commandent (tous commerciaux). Par CIP : nb
   pharmacies, PPHT (tarif) + Net remisé (réel) + remise %, rotation,
   marge pharmacien, prix/stock par établissement. Doc PDF « top N par
   catégorie » + création de sélections marketing.
   Données : PROD_STATS (prod-stats-data.js) + ETAB_PRICES.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : (n + ' €'); };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(n); };
  function eurK(n) { n = +n || 0; return n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + ' k€' : eur(n); }

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
  var LIMIT = 200;

  var S = { sort: 'n', q: '', chip: 'all', etab: '', stockOnly: false, perCat: 5 };
  try { var sv = JSON.parse(localStorage.getItem('mol.S') || '{}'); ['sort', 'chip', 'etab', 'stockOnly', 'perCat'].forEach(function (k) { if (sv[k] != null) S[k] = sv[k]; }); } catch (e) {}
  function save() { try { localStorage.setItem('mol.S', JSON.stringify({ sort: S.sort, chip: S.chip, etab: S.etab, stockOnly: S.stockOnly, perCat: S.perCat })); } catch (e) {} }

  var COLS = [
    { k: 'rota', l: 'Rotation', sub: '/phie/an', fmt: num },
    { k: 'marge', l: 'Marge pharma.', sub: '/an (MDL)', fmt: eurK, accent: 'var(--c-opp)' },
  ];
  function cap(s) { s = (s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function famBadge(k) { var f = FAM_BY[k]; if (!f || k === 'all') return ''; return '<span class="mol-fam" style="--fc:' + f.sc + '">' + esc(FAM_SHORT[k] || f.label) + '</span>'; }

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
  // prix effectifs d'une ligne : PPHT (étab prioritaire) + net + remise%
  function pricing(r) {
    var er = etabRec(r.c);
    var ppht = (er && er[0] > 0) ? er[0] : (r.ppht || 0);
    var net = r.net || 0;
    var stk = er ? er[1] : null;
    var rpct = (ppht > 0 && net > 0 && net < ppht) ? Math.round((ppht - net) / ppht * 1000) / 10 : (er ? 0 : (r.rpct || 0));
    return { ppht: ppht, net: net, stk: stk, rpct: rpct };
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
    var total = data.length;
    var shown = data.slice(0, LIMIT);
    var showStock = !!(window.ETAB_PRICES && S.etab);
    var ncol = 10 + (showStock ? 1 : 0);
    if (!shown.length) {
      var why = S.q ? 'Aucun résultat pour « ' + esc(S.q) + ' ».' : (S.etab && S.stockOnly) ? 'Rien en stock dans ' + esc(S.etab) + '.' : 'Aucun produit dans cette catégorie.';
      return '<tr><td colspan="' + ncol + '" style="padding:26px;text-align:center;color:var(--muted)">' + why + '<br><button class="v2-btn v2-btn-ghost" style="margin-top:12px" onclick="V2.molReset()">Réinitialiser les filtres</button></td></tr>';
    }
    var rows = shown.map(function (r, i) {
      var p = pricing(r);
      var stockTd = showStock ? '<td class="num mono" data-label="Stock" style="font-weight:800;color:' + (p.stk > 0 ? 'var(--c-opp)' : 'var(--c-rose)') + '">' + (p.stk != null ? num(p.stk) : '—') + '</td>' : '';
      var pphtTd = p.rpct > 0
        ? '<td class="num mono mol-ppht" data-label="PPHT">' + (p.ppht > 0 ? eur(p.ppht) : '—') + '</td>'
        : '<td class="num mono" data-label="PPHT" style="color:var(--muted)">' + (p.ppht > 0 ? eur(p.ppht) : '—') + '</td>';
      return '<tr style="--rowc:' + (FAM_BY[r.f] ? FAM_BY[r.f].sc : 'transparent') + '">' +
        '<td class="num mol-rk" data-label="#">' + (i + 1) + '</td>' +
        '<td class="mol-name" data-label="Produit"><span>' + esc(cap(r.d)) + '</span></td>' +
        '<td class="mono mol-cip" data-label="CIP">' + esc(r.c) + '</td>' +
        '<td data-label="Famille">' + famBadge(r.f) + '</td>' +
        '<td class="num mono mol-nph" data-label="Pharmacies">' + num(r.n) + '</td>' +
        pphtTd +
        '<td class="num mono mol-net" data-label="Net remisé">' + (p.net > 0 ? eur(p.net) : '—') + '</td>' +
        '<td class="num" data-label="Remise">' + (p.rpct > 0 ? '<span class="mol-rem">−' + String(p.rpct).replace('.', ',') + '%</span>' : '<span style="color:var(--muted-2)">—</span>') + '</td>' +
        COLS.map(function (c) { return '<td class="num mono" data-label="' + esc(c.l) + '"' + (c.accent ? ' style="color:' + c.accent + ';font-weight:800"' : '') + '>' + c.fmt(r[c.k] || 0) + '</td>'; }).join('') +
        stockTd +
      '</tr>';
    }).join('');
    if (total > LIMIT) rows += '<tr class="mol-more"><td colspan="' + ncol + '" style="padding:14px;text-align:center;color:var(--muted-2);font-size:12.5px">' + LIMIT + ' produits affichés sur ' + num(total) + ' — affine la recherche ou la catégorie pour voir les autres.</td></tr>';
    return rows;
  }

  V2.molFilter = function (k) { S.chip = k; save(); V2.render(); };
  V2.molSort = function (k) { S.sort = k; save(); fill(); syncHead(); var ms = document.getElementById('mol-msort'); if (ms) ms.value = k; };
  V2.molEtab = function (code) { S.etab = code || ''; save(); if (!window.ETAB_PRICES) ensureEtab(function () { if (V2.route && V2.route.name === 'molecules') V2.render(); }); V2.render(); };
  V2.molStockOnly = function (on) { S.stockOnly = !!on; save(); V2.render(); };
  V2.molPerCat = function (n) { S.perCat = (+n) || 0; save(); V2.render(); };
  V2.molReset = function () { S = { sort: 'n', q: '', chip: 'all', etab: '', stockOnly: false, perCat: 5 }; save(); V2.render(); };
  var _t = null;
  V2.molSearch = function (v) { S.q = v || ''; if (_t) clearTimeout(_t); _t = setTimeout(fill, 200); };
  function fill() {
    var b = document.getElementById('mol-tbody'); if (b) b.innerHTML = rowsHtml();
    var cnt = document.getElementById('mol-count'); var tot = baseData().length;
    if (cnt) cnt.innerHTML = (tot > LIMIT ? '<b>' + LIMIT + '</b> affichés sur <b>' + num(tot) + '</b>' : '<b>' + num(tot) + '</b> produit' + (tot > 1 ? 's' : ''));
  }
  function syncHead() { Array.prototype.forEach.call(document.querySelectorAll('.mol-th'), function (th) { th.classList.toggle('on', th.getAttribute('data-k') === S.sort); }); }

  // ── Créer une sélection marketing : top N PAR catégorie ──
  V2.molList = function () {
    if (!V2.mkt || !V2.mkt.newSelection) { if (V2.toast) V2.toast('Marketing indisponible'); return; }
    var perCat = S.perCat > 0 ? S.perCat : 9999;
    var fams = (S.chip === 'all') ? FAM_ORDER : [S.chip];
    var q = S.q.trim().toLowerCase();
    var products = [];
    fams.forEach(function (k) {
      var rows = (window.PROD_STATS || []).filter(function (r) { return r.f === k; });
      if (q) rows = rows.filter(function (r) { return (r.d || '').toLowerCase().indexOf(q) >= 0 || (r.c || '').indexOf(q) >= 0; });
      if (S.etab && S.stockOnly) rows = rows.filter(function (r) { var er = etabRec(r.c); return !!(er && er[1] > 0); });
      rows.sort(function (a, b) { return (b.n || 0) - (a.n || 0) || (b.rota || 0) - (a.rota || 0); });
      rows.slice(0, perCat).forEach(function (r) { var p = pricing(r);
        products.push({ src: 'cat', key: String(r.c), id: '', name: r.d, brand: '', ean: '', cip: String(r.c), price: p.net || p.ppht || 0, remise: 0, img: '', froid: false, cat: (FAM_BY[k] && FAM_BY[k].label) || '' }); });
    });
    if (!products.length) { if (V2.toast) V2.toast('Aucun produit'); return; }
    var suffix = S.etab ? ' · ' + S.etab : '';
    var title = (S.chip === 'all') ? ('Top ' + (S.perCat > 0 ? S.perCat + ' ' : '') + 'par catégorie' + suffix) : ((FAM_BY[S.chip] ? FAM_BY[S.chip].label : 'Top') + ' — top pharmacies' + suffix);
    if (V2.toast) V2.toast(products.length + ' produits ajoutés à la sélection');
    V2.mkt.newSelection(title, 'Les meilleures ventes par catégorie (par nb de pharmacies qui commandent)' + (S.etab ? ' — prix ' + S.etab : '') + '.', products);
  };

  // ── Document PDF : top N par catégorie (pour le comptoir) ──
  V2.molPdf = function () {
    if (typeof window.ensureHtml2Pdf !== 'function') { if (V2.toast) V2.toast('Module PDF indisponible', 'error'); return; }
    var DATA = window.PROD_STATS || []; if (!DATA.length) { if (V2.toast) V2.toast('Catalogue vide', 'warn'); return; }
    var btn = document.getElementById('mol-docbtn'); if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
    var perCat = S.perCat; var showStock = !!(window.ETAB_PRICES && S.etab);
    var e2 = function (v) { return (v ? (+v).toFixed(2).replace('.', ',') : '—') + (v ? ' €' : ''); };
    var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    if (V2.toast) V2.toast('Génération du PDF…');
    var byFam = {}; FAM_ORDER.forEach(function (k) { byFam[k] = []; });
    DATA.forEach(function (r) { if (byFam[r.f]) byFam[r.f].push(r); });
    var gEco = 0, gR = 0, gN = 0, gProd = 0;
    var secs = FAM_ORDER.map(function (k) {
      var rows = byFam[k].filter(function (r) { if (!(S.etab && S.stockOnly)) return true; var er = etabRec(r.c); return !!(er && er[1] > 0); });
      rows.sort(function (a, b) { return (b.n || 0) - (a.n || 0) || (b.rota || 0) - (a.rota || 0); });
      if (perCat > 0) rows = rows.slice(0, perCat);
      if (!rows.length) return '';
      var sEco = 0, sR = 0, sN = 0;
      var trs = rows.map(function (r, i) {
        var p = pricing(r); var eco = (p.rpct > 0) ? (p.ppht - p.net) : 0;
        if (p.rpct > 0) { sEco += eco; sR += p.rpct; sN++; }
        var stockTd = showStock ? '<td style="padding:5px 7px;text-align:right;font-family:monospace;font-size:10px;font-weight:700;color:' + (p.stk > 0 ? '#1E9E6A' : '#E0556E') + '">' + (p.stk != null ? p.stk : '—') + '</td>' : '';
        return '<tr style="border-bottom:1px solid #EEF1F6;page-break-inside:avoid">' +
          '<td style="padding:5px 7px;color:#9AA1B2;font-size:9px;text-align:right">' + (i + 1) + '</td>' +
          '<td style="padding:5px 7px;font-size:11.5px;font-weight:600;color:#10131C">' + esc(cap(r.d).slice(0, 46)) + '</td>' +
          '<td style="padding:5px 7px;font-family:monospace;font-size:9.5px;color:#737A8C">' + esc(r.c) + '</td>' +
          '<td style="padding:5px 7px;text-align:right;font-family:monospace;font-size:10.5px;color:#9AA1B2;text-decoration:' + (p.rpct > 0 ? 'line-through' : 'none') + '">' + e2(p.ppht) + '</td>' +
          '<td style="padding:5px 7px;text-align:right;font-family:monospace;font-size:12px;font-weight:800;color:#0050E6">' + e2(p.net) + '</td>' +
          '<td style="padding:5px 7px;text-align:right;font-family:monospace;font-size:10.5px;font-weight:800;color:#0f7a52">' + (eco > 0 ? '−' + e2(eco) : '—') + '</td>' +
          '<td style="padding:5px 7px;text-align:right"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#E8F0FE;color:#0034A0;font-family:monospace;font-size:11px;font-weight:800">' + num(r.n) + '</span></td>' +
          stockTd + '</tr>';
      }).join('');
      var avgR = sN ? Math.round(sR / sN * 10) / 10 : 0;
      gEco += sEco; gR += sR; gN += sN; gProd += rows.length;
      var ths = ['#', 'Produit', 'CIP', 'PPHT', 'Net remisé', 'Économie', 'Pharmacies'].concat(showStock ? ['Stock'] : []);
      return '<div style="margin-bottom:14px;page-break-inside:avoid">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:linear-gradient(90deg,' + FAM_BY[k].sc + '22,transparent);border-left:4px solid ' + FAM_BY[k].sc + ';border-radius:5px;margin-bottom:4px">' +
          '<div style="font-size:12.5px;font-weight:800;color:#10131C">' + esc(FAM_BY[k].label) + '</div>' +
          '<div style="margin-left:auto;text-align:right;font-size:10px;color:#0f7a52;font-weight:800">' + (avgR > 0 ? 'remise moy. −' + String(avgR).replace('.', ',') + '% · éco. −' + e2(sEco) : 'top ' + rows.length) + '</div></div>' +
        '<table style="width:100%;border-collapse:collapse"><thead style="display:table-header-group"><tr style="background:#F4F6FB">' +
          ths.map(function (h, ci) { return '<th style="padding:4px 7px;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#737A8C;text-align:' + (ci < 3 ? 'left' : 'right') + '">' + h + '</th>'; }).join('') +
        '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    }).filter(Boolean).join('');
    if (!secs) { if (btn) { btn.disabled = false; btn.style.opacity = ''; } if (V2.toast) V2.toast('Aucun produit à afficher', 'warn'); return; }
    var gAvg = gN ? Math.round(gR / gN * 10) / 10 : 0;
    var synth = '<div style="display:flex;gap:10px;margin-bottom:14px">' +
      '<div style="flex:1;padding:10px 14px;background:#F4F6FB;border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:800;color:#0050E6">' + gProd + '</div><div style="font-size:9px;color:#737A8C;text-transform:uppercase">produits sélectionnés</div></div>' +
      '<div style="flex:1;padding:10px 14px;background:#EAF7F1;border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:800;color:#0f7a52">−' + String(gAvg).replace('.', ',') + '%</div><div style="font-size:9px;color:#737A8C;text-transform:uppercase">remise moyenne réseau</div></div>' +
      '<div style="flex:1;padding:10px 14px;background:#EAF7F1;border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:800;color:#0f7a52">−' + e2(gEco) + '</div><div style="font-size:9px;color:#737A8C;text-transform:uppercase">économie cumulée</div></div></div>';
    var subt = 'Top ' + (perCat > 0 ? perCat + ' ' : '') + 'par catégorie · classé par nb de pharmacies qui commandent' + (S.etab ? ' · prix &amp; stock ' + esc(S.etab) : ' · prix net indicatif');
    var html = '<div style="padding:18px 22px;font-family:Satoshi,Inter,system-ui,sans-serif;color:#10131C">' +
      '<div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #10131C;padding-bottom:12px;margin-bottom:14px">' +
        '<div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(150deg,#0050E6,#0034A0);display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div>' +
        '<div style="flex:1"><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Intégral Pharma · catalogue & prix</div>' +
          '<div style="font-size:18px;font-weight:800">Top produits par catégorie' + (S.etab ? ' · ' + esc(S.etab) : '') + '</div>' +
          '<div style="font-size:10px;color:#737A8C">' + subt + '</div></div>' +
        '<div style="text-align:right;font-size:11px;font-weight:700;font-family:monospace">' + dateStr + '</div>' +
      '</div>' + synth + secs +
      '<div style="margin-top:14px;padding-top:8px;border-top:1px solid #E5E9F2;display:flex;justify-content:space-between;font-size:8.5px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">' +
        '<span>Intégral Pharma · « Pharmacies » = officines du réseau qui commandent</span>' +
        '<span>Prix nets indicatifs — hors conditions particulières, nous consulter</span></div>' +
    '</div>';
    window.ensureHtml2Pdf().then(function () { return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; }).then(function () {
      var wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff';
      wrap.innerHTML = html; document.body.appendChild(wrap);
      var fn = 'Integral-Pharma_Top-produits' + (S.etab ? '_' + S.etab : '') + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
      window.html2pdf().from(wrap.firstChild).set({ filename: fn, margin: [8, 8, 10, 8], image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } })
        .save().then(function () { if (wrap.parentNode) document.body.removeChild(wrap); if (btn) { btn.disabled = false; btn.style.opacity = ''; } if (V2.toast) V2.toast('Doc téléchargé'); })
        .catch(function () { if (wrap.parentNode) document.body.removeChild(wrap); if (btn) { btn.disabled = false; btn.style.opacity = ''; } if (V2.toast) V2.toast('Erreur PDF', 'error'); });
    });
  };

  V2.pages.molecules = {
    render: function (root, param) {
      if (param != null && param !== '') { S.q = String(param); S.chip = 'all'; }
      if (!window.PROD_STATS) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) + '<div class="v2-wrap"><div class="v2-empty"><div class="v2-empty-d">Données produits indisponibles.</div></div></div>';
        return;
      }
      if (!window.ETAB_PRICES) ensureEtab(function () { if (V2.route && V2.route.name === 'molecules') V2.render(); });
      var c = counts();
      var chips = FAMS.map(function (f) {
        return '<button class="v2-seg' + (S.chip === f.k ? ' on' : '') + '" style="--sc:' + f.sc + '" onclick="V2.molFilter(\'' + f.k + '\')">' + (f.k === 'all' ? '' : '<span class="sw"></span>') + esc(f.label) + '<span class="cnt">' + num(c[f.k] || 0) + '</span></button>';
      }).join('');
      var ETABS = (window.ETAB_PRICES && window.ETAB_PRICES.etabs) || [];
      var etabBtns = '<button class="mol-chip' + (S.etab === '' ? ' on' : '') + '" onclick="V2.molEtab(\'\')">Tous</button>' +
        ETABS.map(function (e) { return '<button class="mol-chip' + (S.etab === e.code ? ' on' : '') + '" onclick="V2.molEtab(\'' + e.code + '\')">' + esc(e.code) + '</button>'; }).join('');
      var etabBar = ETABS.length ? ('<div class="mol-bar"><span class="mol-barlbl">Établissement — prix &amp; stock</span><div class="mol-chips">' + etabBtns + '</div>' +
        (S.etab ? '<label class="mol-tgl"><input type="checkbox"' + (S.stockOnly ? ' checked' : '') + ' onchange="V2.molStockOnly(this.checked)"> En stock uniquement</label>' : '') + '</div>') : '<div class="mol-bar mol-bar-wait"><span class="mol-barlbl">Chargement des prix par établissement…</span></div>';
      var perBtns = [3, 5, 10, 15, 0].map(function (n) { return '<button class="mol-chip' + (S.perCat === n ? ' on' : '') + '" onclick="V2.molPerCat(' + n + ')">' + (n === 0 ? 'Tous' : n) + '</button>'; }).join('');
      var docBar = '<div class="mol-bar"><span class="mol-barlbl">Produits par catégorie (doc &amp; fiche)</span><div class="mol-chips">' + perBtns + '</div>' +
        '<button id="mol-docbtn" class="v2-btn v2-btn-primary mol-doc" onclick="V2.molPdf()">' + ICO('download', 15) + 'Télécharger le PDF — top ' + (S.perCat > 0 ? S.perCat : 'tous') + '/catégorie</button>' +
        '<button class="v2-btn v2-btn-ghost mol-doc" onclick="V2.molList()">' + ICO('plus', 15) + 'Ouvrir dans Marketing →</button></div>';
      var th = function (col) { return '<th class="num mol-th' + (S.sort === col.k ? ' on' : '') + '" data-k="' + col.k + '" onclick="V2.molSort(\'' + col.k + '\')" style="cursor:pointer;white-space:nowrap">' + col.l + '<small style="display:block;font-weight:500;color:var(--muted-2)">' + col.sub + ' ' + (S.sort === col.k ? '↓' : '↕') + '</small></th>'; };
      var showStock = !!(window.ETAB_PRICES && S.etab);
      var msort = '<div class="mol-msort"><label>Trier par</label><select onchange="V2.molSort(this.value)">' +
        '<option value="n"' + (S.sort === 'n' ? ' selected' : '') + '>Nb de pharmacies</option><option value="rota"' + (S.sort === 'rota' ? ' selected' : '') + '>Rotation</option><option value="marge"' + (S.sort === 'marge' ? ' selected' : '') + '>Marge pharma.</option></select></div>';
      var qVal = S.q.replace(/"/g, '&quot;');
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' +
          '<div class="v2-page-title">Catalogue &amp; prix</div>' +
          '<div class="v2-page-sub">Tous les produits du réseau, classés par nb de pharmacies qui commandent : PPHT, ton prix net remisé, remise, rotation, marge pharmacien, + stock par établissement. Génère un doc « top par catégorie » ou une liste marketing.</div>' +
          '<div class="mol-search"><span>' + ICO('search', 18) + '</span><input id="mol-q" type="search" placeholder="Chercher un produit ou un CIP (doliprane, 3400…)" value="' + qVal + '" oninput="V2.molSearch(this.value)" autocomplete="off"></div>' +
          '<div class="v2-segs mol-segs">' + chips + '</div>' +
          etabBar + docBar +
          '<div class="mol-note">Le PDF et la liste couvrent <b>les 6 catégories</b> (top par catégorie). Le tableau ci-dessous suit tes filtres.</div>' +
          '<div class="mol-countrow"><span class="cat-count" id="mol-count"></span>' + msort + '</div>' +
          '<div class="mol-scroll" style="overflow-x:auto"><table class="v2-table mol-table"><thead><tr>' +
            '<th class="num">#</th><th>Produit</th><th>CIP13</th><th>Famille</th>' +
            '<th class="num mol-th' + (S.sort === 'n' ? ' on' : '') + '" data-k="n" onclick="V2.molSort(\'n\')" style="cursor:pointer">Pharmacies<small style="display:block;font-weight:500;color:var(--muted-2)">réseau ' + (S.sort === 'n' ? '↓' : '↕') + '</small></th>' +
            '<th class="num">PPHT<small style="display:block;font-weight:500;color:var(--muted-2)">tarif</small></th>' +
            '<th class="num">Net remisé<small style="display:block;font-weight:500;color:var(--muted-2)">réel</small></th>' +
            '<th class="num">Remise</th>' +
            COLS.map(th).join('') +
            (showStock ? '<th class="num">Stock</th>' : '') +
          '</tr></thead><tbody id="mol-tbody">' + rowsHtml() + '</tbody></table></div>' +
          '<div class="v2-page-sub" style="margin-top:14px;font-size:12px">Ventes réelles du réseau (5 mois, annualisées) · marge MDL = remboursables · Net remisé = prix d\'achat moyen constaté · prix/stock = établissement choisi.</div>' +
        '</div>';
      fill();
    }
  };

  if (!document.getElementById('v2-mol-css')) {
    var st = document.createElement('style'); st.id = 'v2-mol-css';
    st.textContent =
      '.mol-search{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 14px;margin:14px 0;transition:border-color .15s,box-shadow .15s}' +
      '.mol-search:focus-within{border-color:var(--ip-blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--ip-blue) 14%,transparent)}' +
      '.mol-search span{color:var(--ip-blue);display:flex}' +
      '.mol-search input{flex:1;border:none;outline:none;background:none;font-family:var(--font);font-size:16px;color:var(--ip-ink)}' +
      // table
      '.mol-table{border-collapse:separate;border-spacing:0}' +
      '.mol-table td,.mol-table th{padding:9px 11px;vertical-align:middle}' +
      '.mol-table td.num,.mol-table th.num,.mol-table .mono{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}' +
      '.mol-table thead th{position:sticky;top:0;z-index:2;background:var(--card);font-size:11px;font-weight:700;color:var(--muted);box-shadow:inset 0 -1px 0 var(--line)}' +
      '.mol-table thead th small{font-size:10px}' +
      '.mol-table th.mol-th.on{color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 8%,#fff);box-shadow:inset 0 -2px 0 var(--ip-blue)}' +
      '.mol-table th.mol-th:hover{background:color-mix(in srgb,var(--ip-blue) 5%,#fff)}' +
      '.mol-table tbody tr{box-shadow:inset 3px 0 0 var(--rowc,transparent)}' +
      '.mol-table tbody tr:nth-child(even){background:color-mix(in srgb,var(--ip-blue) 2.5%,transparent)}' +
      '.mol-table tbody tr:hover{background:color-mix(in srgb,var(--rowc,var(--ip-blue)) 6%,transparent)}' +
      '.mol-table tbody tr.mol-more:hover{background:none}' +
      '.mol-rk{color:var(--muted-2);width:30px;text-align:right;font-family:var(--mono)}' +
      '.mol-name{max-width:280px}.mol-name span{font-weight:700;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.mol-cip{color:var(--muted);font-size:11.5px;width:1%;white-space:nowrap}' +
      '.mol-nph{font-weight:800}' +
      '.mol-ppht{color:var(--muted-2);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--muted-2) 55%,transparent)}' +
      '.mol-net{color:var(--ip-blue);font-weight:800;font-size:15px;background:color-mix(in srgb,var(--ip-blue) 4%,transparent)}' +
      '.mol-fam{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;color:var(--fc);background:color-mix(in srgb,var(--fc) 14%,transparent);white-space:nowrap}' +
      '.mol-rem{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:800;font-family:var(--mono);color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 13%,#fff);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c-opp) 22%,transparent)}' +
      // segs (familles)
      '.mol-segs .v2-seg .cnt{margin-left:6px;padding:1px 7px;border-radius:999px;font-family:var(--mono);font-size:11px;font-weight:800;color:var(--muted);background:color-mix(in srgb,var(--ip-ink) 7%,transparent)}' +
      '.mol-segs .v2-seg.on .cnt{background:color-mix(in srgb,#fff 22%,transparent);color:#fff}' +
      // bars
      '.mol-bar{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;margin:0 0 12px;padding:12px 14px;border-radius:14px;background:linear-gradient(180deg,color-mix(in srgb,var(--ip-blue) 5%,#fff),#fff);border:1px solid color-mix(in srgb,var(--ip-blue) 14%,var(--line))}' +
      '.mol-bar-wait{opacity:.7}' +
      '.mol-barlbl{position:relative;padding-left:12px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ip-blue)}' +
      '.mol-barlbl::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:4px;height:14px;border-radius:2px;background:var(--ip-blue)}' +
      '.mol-chips{display:flex;gap:6px;flex-wrap:wrap}' +
      '.mol-chip{border:1px solid var(--line-strong,#d7dbe6);background:#fff;border-radius:999px;padding:6px 13px;font-family:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:.12s}' +
      '.mol-chip:hover{border-color:color-mix(in srgb,var(--ip-blue) 45%,var(--line));color:var(--ip-ink)}' +
      '.mol-chip:active{transform:scale(.96)}' +
      '.mol-chip.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:0 1px 6px color-mix(in srgb,var(--ip-blue) 30%,transparent)}' +
      '.mol-tgl{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--ip-ink);cursor:pointer;margin-left:auto}' +
      '.mol-tgl input{width:16px;height:16px;accent-color:var(--ip-blue)}' +
      '.mol-note{font-size:12px;color:var(--muted);margin:2px 0 8px;line-height:1.4}' +
      '.mol-countrow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:6px 0 10px}' +
      '.cat-count{font-size:13px;color:var(--muted)} .cat-count b{color:var(--ip-ink);font-family:var(--mono)}' +
      '.mol-msort{display:none}' +
      // mobile : cartes
      '@media(max-width:640px){' +
        '#mol-q{font-size:16px}' +
        '.mol-search{position:sticky;top:0;z-index:20}' +
        '.mol-segs{overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch}.mol-segs::-webkit-scrollbar{display:none}.mol-segs .v2-seg{flex:0 0 auto}' +
        '.mol-bar{flex-direction:column;align-items:stretch;gap:8px}.mol-tgl{margin-left:0}.mol-doc{width:100%;justify-content:center}' +
        '.mol-msort{display:flex;align-items:center;gap:10px}.mol-msort label{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase}.mol-msort select{flex:1;min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ip-ink);font-family:inherit;font-size:15px;padding:0 12px}' +
        '.mol-scroll{overflow-x:visible}' +
        '.mol-table thead{position:absolute;left:-9999px}' +
        '.mol-table,.mol-table tbody,.mol-table tr,.mol-table td{display:block;width:auto}' +
        '.mol-table tbody tr{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--rowc,var(--line));border-radius:14px;padding:12px 14px 8px;margin:0 0 12px;box-shadow:var(--sh-1,0 1px 2px rgba(16,19,28,.05));position:relative}' +
        '.mol-table tbody tr:nth-child(even){background:var(--card)}' +
        '.mol-table td{padding:5px 0;border:none;display:flex;justify-content:space-between;align-items:baseline;gap:12px;text-align:right;font-size:13.5px;min-height:32px}' +
        '.mol-table td::before{content:attr(data-label);color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.02em;flex:0 0 auto;text-align:left}' +
        '.mol-table td.mol-name{display:block;font-size:16px;font-weight:800;margin-bottom:6px;padding-bottom:8px;border-bottom:1px solid var(--line);text-align:left}.mol-table td.mol-name::before{display:none}.mol-name span{white-space:normal}' +
        '.mol-table td.mol-net{font-size:17px;font-weight:800}.mol-table td.mol-net::before{color:var(--ip-blue)}' +
        '.mol-table td.mol-rk{position:absolute;top:11px;right:14px;padding:0;min-height:0;color:var(--muted-2);font-size:12px}.mol-table td.mol-rk::before{display:none}' +
        '.mol-table tr.mol-more{border:none;background:none;box-shadow:none;text-align:center}.mol-table tr.mol-more td{display:block;text-align:center}.mol-table tr.mol-more td::before{display:none}' +
      '}';
    document.head.appendChild(st);
  }
})();
