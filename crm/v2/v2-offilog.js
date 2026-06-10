/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Offilog & concurrents" (pages.offilog)
   Catalogue PARAPHARMA Offilog : recherche, filtres, table triée par
   rang de vente, pagination, inspecteur DÉTAIL avec VEILLE PRIX —
   prix d'achat IP (HT) comparé aux prix PUBLICS concurrents
   (E.Leclerc, Drakkars, Cap3000). Alerte quand un concurrent vend au
   public MOINS CHER que ton prix d'achat (la pharmacie ne peut pas suivre).
   ── Même DA que le catalogue grossiste · vanilla · zéro emoji ──
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  var S = { chip: 'all', q: '', page: 0, sel: null };
  var PER_PAGE = 100;

  var CHIPS = [
    { k: 'all',     label: 'Tout',              sc: '#0050E6' },
    { k: 'alerte',  label: 'Veille prix',       sc: '#E0556E' },
    { k: 'offilog', label: 'Dans Offilog',      sc: '#1E9E6A' },
    { k: 'fort',    label: 'Potentiel fort',    sc: '#C7791A' },
    { k: 'conc',    label: 'Avec concurrent',   sc: '#6D4FC4' },
  ];
  var CHIP_BY_KEY = {}; CHIPS.forEach(function (c) { CHIP_BY_KEY[c.k] = c; });

  // sources concurrentes (prix PUBLIC TTC)
  var CONC = [
    { key: 'prix_leclerc',  label: 'E.Leclerc', color: '#0066B3' },
    { key: 'prix_drakkars', label: 'Drakkars',  color: '#1E9E6A' },
    { key: 'prix_cap3000',  label: 'Cap3000',   color: '#C7791A' },
  ];

  // ── Index ─────────────────────────────────────
  var idxBuilt = false, sortedOff = null, offByEan = null;
  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }
  function numOr0(v) { return (typeof v === 'number' && isFinite(v) && v > 0) ? v : 0; }

  // plus bas prix concurrent public connu (ou 0)
  function minConc(p) {
    var m = 0;
    for (var i = 0; i < CONC.length; i++) {
      var v = numOr0(p[CONC[i].key]);
      if (v > 0 && (m === 0 || v < m)) m = v;
    }
    return m;
  }
  function hasConc(p) {
    for (var i = 0; i < CONC.length; i++) if (numOr0(p[CONC[i].key]) > 0) return true;
    return false;
  }
  // alerte : un concurrent vend au public (TTC) sous ton prix d'achat IP (HT)
  function isAlert(p) {
    var achat = numOr0(p.prix_offilog);
    var mc = minConc(p);
    return achat > 0 && mc > 0 && mc < achat;
  }
  function isFort(p) {
    var s = norm(p.potentiel);
    return s.indexOf('★★★') >= 0 || s.indexOf('fort') >= 0;
  }

  function buildIndex() {
    if (idxBuilt) return;
    var O = window.OFFILOG || [];
    offByEan = new Map();
    sortedOff = O.slice().sort(function (a, b) {
      var ra = (a.rang_vente != null && a.rang_vente > 0) ? a.rang_vente : (a.rang || 9e9);
      var rb = (b.rang_vente != null && b.rang_vente > 0) ? b.rang_vente : (b.rang || 9e9);
      return ra - rb;
    });
    O.forEach(function (p) {
      p._alert = isAlert(p);
      p._inOff = !!p.dans_offilog;
      p._fort = isFort(p);
      p._conc = hasConc(p);
      if (p.ean != null) offByEan.set(String(p.ean), p);
    });
    idxBuilt = true;
  }

  function matchChip(p, k) {
    if (k === 'all') return true;
    if (k === 'alerte') return p._alert;
    if (k === 'offilog') return p._inOff;
    if (k === 'fort') return p._fort;
    if (k === 'conc') return p._conc;
    return true;
  }
  function filteredBase() {
    var q = S.q.trim().toLowerCase();
    if (!q) return sortedOff;
    return sortedOff.filter(function (p) {
      return norm(p.produit_norm || p.produit).indexOf(q) >= 0 ||
             norm(p.marque).indexOf(q) >= 0 || norm(p.ean).indexOf(q) >= 0;
    });
  }
  function counts(base) {
    var c = { all: base.length, alerte: 0, offilog: 0, fort: 0, conc: 0 };
    for (var i = 0; i < base.length; i++) {
      var p = base[i];
      if (p._alert) c.alerte++;
      if (p._inOff) c.offilog++;
      if (p._fort) c.fort++;
      if (p._conc) c.conc++;
    }
    return c;
  }

  // ── Agrégats statistiques sur un périmètre (tout Offilog ou filtre) ──
  function computeAgg(rows) {
    var a = { refs: rows.length, nbOff: 0, nbAlert: 0, nbConc: 0, nbFort: 0,
              achatSum: 0, achatN: 0, pubSum: 0, pubN: 0, margeSum: 0, margeN: 0, ecartSum: 0, ecartN: 0 };
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      if (p._inOff) a.nbOff++;
      if (p._alert) a.nbAlert++;
      if (p._conc) a.nbConc++;
      if (p._fort) a.nbFort++;
      var ach = numOr0(p.prix_offilog); if (ach > 0) { a.achatSum += ach; a.achatN++; }
      var pub = numOr0(p.prix_maxi); if (pub > 0) { a.pubSum += pub; a.pubN++; }
      if (typeof p.marge_pct === 'number' && isFinite(p.marge_pct)) { a.margeSum += p.marge_pct; a.margeN++; }
      if (typeof p.ecart === 'number' && isFinite(p.ecart)) { a.ecartSum += p.ecart; a.ecartN++; }
    }
    a.achatMoy = a.achatN ? a.achatSum / a.achatN : 0;
    a.pubMoy = a.pubN ? a.pubSum / a.pubN : 0;
    a.margeMoy = a.margeN ? a.margeSum / a.margeN : 0;
    a.ecartMoy = a.ecartN ? a.ecartSum / a.ecartN : 0;
    return a;
  }
  function kpiCard(k, l, v, d, vcol) {
    return '<div class="v2-kpi ' + k + '"><div class="v2-kpi-l">' + l + '</div>' +
      '<div class="v2-kpi-v mono"' + (vcol ? ' style="color:' + vcol + '"' : '') + '>' + v + '</div>' +
      (d ? '<div class="v2-kpi-d" style="color:var(--muted)">' + d + '</div>' : '') + '</div>';
  }
  function statBand(agg) {
    return '<div class="v2-kpis off-kpis">' +
      kpiCard('k1', 'Produits', V2.fmtNum(agg.refs),
        agg.nbOff + ' dans Offilog' + (agg.nbFort ? ' · ' + agg.nbFort + ' potentiel fort' : '')) +
      kpiCard('k2', 'Veille prix', V2.fmtNum(agg.nbAlert),
        agg.nbConc ? 'sur ' + V2.fmtNum(agg.nbConc) + ' comparable' + (agg.nbConc > 1 ? 's' : '') : 'aucun comparable',
        agg.nbAlert > 0 ? 'var(--c-rose)' : null) +
      kpiCard('k3', 'Prix achat IP moyen', agg.achatMoy > 0 ? V2.fmtEur(agg.achatMoy) : '—',
        agg.pubMoy > 0 ? 'public moyen ' + V2.fmtEur(agg.pubMoy) : '') +
      kpiCard('k4', 'Marge moyenne', agg.margeN ? agg.margeMoy.toFixed(1).replace('.', ',') + ' %' : '—',
        agg.ecartN ? 'écart moyen ' + V2.fmtEur(agg.ecartMoy) : '') +
    '</div>';
  }

  // ── Inspecteur DÉTAIL (panneau latéral) ────────
  function priceCmpRows(p) {
    var achat = numOr0(p.prix_offilog);
    return CONC.map(function (src) {
      var v = numOr0(p[src.key]);
      if (v <= 0) {
        return '<div class="off-cmp-row muted"><span class="off-cmp-src">' + src.label + '</span>' +
          '<span class="off-cmp-na">prix non connu</span></div>';
      }
      var below = achat > 0 && v < achat;
      var delta = achat > 0 ? (v - achat) : 0;
      var deltaTxt = achat > 0
        ? '<span class="off-cmp-delta ' + (below ? 'bad' : 'ok') + '">' + (delta >= 0 ? '+' : '') + V2.fmtEur(delta) + ' vs achat</span>'
        : '';
      return '<div class="off-cmp-row">' +
        '<span class="off-cmp-src"><span class="dot" style="background:' + src.color + '"></span>' + src.label + '</span>' +
        '<span class="off-cmp-price ' + (below ? 'bad' : '') + ' mono">' + V2.fmtEur(v) + '</span>' +
        deltaTxt + '</div>';
    }).join('');
  }

  function inspector(p) {
    var achat = numOr0(p.prix_offilog);
    var pub = numOr0(p.prix_maxi);
    var marge = (typeof p.marge_pct === 'number' && isFinite(p.marge_pct)) ? p.marge_pct : null;
    var ecart = (typeof p.ecart === 'number' && isFinite(p.ecart)) ? p.ecart : null;
    var img = p.img ? '<div class="off-insp-img"><img src="' + esc(p.img) + '" loading="lazy" alt="" onerror="this.parentNode.style.display=\'none\'"></div>' : '';

    function kpi(l, v, col) {
      return '<div class="off-kpi"><div class="off-kpi-l">' + l + '</div><div class="off-kpi-v"' + (col ? ' style="color:' + col + '"' : '') + '>' + v + '</div></div>';
    }
    var alertBanner = p._alert
      ? '<div class="off-alert"><span class="off-alert-ic">' + ICO('alert', 18, 2) + '</span>' +
        '<div><b>Veille prix</b> — un concurrent vend au public sous ton prix d\'achat IP. La pharmacie ne peut pas s\'aligner sans perdre.</div></div>'
      : '';

    var badges = '';
    if (p.potentiel) badges += '<span class="off-badge" style="--bc:#C7791A">' + esc(p.potentiel) + '</span>';
    if (p.role) badges += '<span class="off-badge" style="--bc:#6D4FC4">' + esc(p.role) + '</span>';
    if (p._inOff) badges += '<span class="off-badge" style="--bc:#1E9E6A">Dans Offilog</span>';

    return '<div class="off-insp' + (S.sel != null ? ' open' : '') + '">' +
      '<div class="off-insp-head">' +
        '<div style="min-width:0"><div class="off-insp-name">' + esc(p.produit || '') + '</div>' +
          '<div class="off-insp-sub">' + esc(p.marque || '') + (p.univers && p.univers !== 'Non classé' ? ' · ' + esc(p.univers) : '') + '</div>' +
          '<div class="off-insp-cip mono">EAN ' + esc(p.ean || '') + '</div></div>' +
        '<button class="off-insp-x" onclick="V2.offSelect(null)" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
      '</div>' +
      '<div class="off-insp-body">' +
        img +
        (badges ? '<div class="off-badges">' + badges + '</div>' : '') +
        alertBanner +
        '<div class="off-kpi-grid">' +
          kpi('Achat IP (HT)', achat > 0 ? V2.fmtEur(achat) : '—', 'var(--ip-blue)') +
          kpi('Public conseillé', pub > 0 ? V2.fmtEur(pub) : '—') +
          kpi('Marge', marge != null ? marge.toFixed(1).replace('.', ',') + ' %' : '—', 'var(--c-mint)') +
          kpi('Écart €', ecart != null ? V2.fmtEur(ecart) : '—') +
        '</div>' +
        '<div class="off-cmp"><div class="off-cmp-l">Prix public concurrents <span>(TTC)</span></div>' +
          priceCmpRows(p) + '</div>' +
        '<div class="off-insp-cta"><button class="v2-btn v2-btn-primary" onclick="V2.offAddToFiche(\'' + esc(p.ean) + '\')">' + ICO('plus', 17) + ' Ajouter à une fiche commerciale</button></div>' +
      '</div>' +
    '</div>';
  }

  // ── Table rows ────────────────────────────────
  function concCell(p, key, achat) {
    var v = numOr0(p[key]);
    if (v <= 0) return '<td class="num" style="color:var(--muted-2)">—</td>';
    var below = achat > 0 && v < achat;
    return '<td class="num' + (below ? ' off-below' : '') + '">' + V2.fmtEur(v) + '</td>';
  }
  function rowsHtml(rows) {
    return rows.map(function (p, i) {
      var achat = numOr0(p.prix_offilog);
      var pub = numOr0(p.prix_maxi);
      var sel = (S.sel != null && String(p.ean) === String(S.sel)) ? ' sel' : '';
      return '<tr class="off-row' + sel + '" onclick="V2.offSelect(\'' + esc(p.ean) + '\')">' +
        '<td class="num" style="color:var(--muted-2);font-size:11px">' + (S.page * PER_PAGE + i + 1) + '</td>' +
        '<td><span class="off-pname">' + esc((p.produit || '').slice(0, 48)) + '</span>' +
          (p._alert ? '<span class="off-alert-mini">' + ICO('alert', 11, 2.4) + ' VEILLE</span>' : '') + '</td>' +
        '<td class="off-marque">' + esc(p.marque || '—') + '</td>' +
        '<td class="num off-achat">' + (achat > 0 ? V2.fmtEur(achat) : '—') + '</td>' +
        '<td class="num" style="color:var(--muted)">' + (pub > 0 ? V2.fmtEur(pub) : '—') + '</td>' +
        concCell(p, 'prix_leclerc', achat) +
        concCell(p, 'prix_drakkars', achat) +
        concCell(p, 'prix_cap3000', achat) +
        '</tr>';
    }).join('');
  }
  function pager(total, pages) {
    if (pages <= 1) return '';
    var from = S.page * PER_PAGE + 1, to = Math.min(total, (S.page + 1) * PER_PAGE);
    return '<div class="off-pager">' +
      '<button class="v2-btn v2-btn-ghost off-pg"' + (S.page <= 0 ? ' disabled style="opacity:.4;pointer-events:none"' : '') + ' onclick="V2.offPage(' + (S.page - 1) + ')">' + ICO('back', 15) + ' Précédent</button>' +
      '<span class="off-pg-info mono">' + from + '–' + to + ' sur ' + V2.fmtNum(total) + ' · page ' + (S.page + 1) + '/' + pages + '</span>' +
      '<button class="v2-btn v2-btn-ghost off-pg"' + (S.page >= pages - 1 ? ' disabled style="opacity:.4;pointer-events:none"' : '') + ' onclick="V2.offPage(' + (S.page + 1) + ')">Suivant ' + ICO('chev', 15) + '</button>' +
    '</div>';
  }

  // ── Handlers ──────────────────────────────────
  V2.offFilter = function (k) { S.chip = k; S.page = 0; V2.render(); };
  V2.offSearch = function (val) { S.q = val || ''; S.page = 0; rerenderKeepFocus(); };
  V2.offPage = function (p) { S.page = p; V2.render(); try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {} };
  V2.offSelect = function (ean) {
    S.sel = (ean == null || (S.sel != null && String(S.sel) === String(ean))) ? null : ean;
    V2.render();
  };
  V2.offAddToFiche = function (ean) {
    var p = offByEan.get(String(ean));
    if (!p) return;
    if (!V2.ficheCart) { V2.toast('Module fiches indisponible', 'error'); return; }
    if (V2.ficheCart.has(p.ean)) { V2.toast('Déjà dans la fiche en cours', 'warn'); return; }
    var n = V2.ficheCart.add({
      cip13: p.ean, designation: p.produit,
      prix_ip: numOr0(p.prix_offilog) || null, prix_ht: numOr0(p.prix_maxi) || null,
      remise_pct: null, is_froid: false, src: 'offilog'
    });
    V2.toast('✓ Ajouté à la fiche en cours (' + n + ')');
  };

  function rerenderKeepFocus() {
    V2.render();
    var inp = document.getElementById('off-search-input');
    if (inp) { inp.focus(); var v = inp.value; try { inp.setSelectionRange(v.length, v.length); } catch (e) {} }
  }

  // ── CSS ───────────────────────────────────────
  function injectCss() {
    if (document.getElementById('v2-off-css')) return;
    var s = document.createElement('style'); s.id = 'v2-off-css';
    s.textContent = [
      '.off-search{display:flex;align-items:center;gap:13px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:18px;box-shadow:var(--sh-2);transition:.2s var(--ease)}',
      '.off-search:focus-within{border-color:rgba(0,80,230,.4);box-shadow:0 0 0 4px var(--halo),var(--sh-2)}',
      '.off-search svg{color:var(--ip-blue);flex-shrink:0}',
      '.off-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:16px;flex:1;color:var(--ip-ink)}',
      '.off-search .clr{border:none;background:none;cursor:pointer;color:var(--muted);display:flex;padding:2px}',
      '.off-count{font-size:12px;color:var(--muted);margin-bottom:12px}',
      '.off-stats-l{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin:18px 0 12px}',
      '.off-kpis{margin-bottom:18px}',
      '.off-tablewrap{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);overflow:hidden}',
      '.off-table-scroll{overflow-x:auto}',
      '.off-pname{font-weight:600;color:var(--ip-ink)}',
      '.off-marque{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.02em}',
      '.off-achat{font-weight:700;color:var(--ip-blue)}',
      '.off-below{color:var(--c-rose);font-weight:700}',
      '.off-row.sel{background:var(--halo)}',
      '.off-alert-mini{display:inline-flex;align-items:center;gap:3px;margin-left:8px;padding:2px 7px;border-radius:6px;font-size:9px;font-weight:800;letter-spacing:.03em;background:color-mix(in srgb,var(--c-rose) 12%,#fff);color:var(--c-rose);vertical-align:middle}',
      '.off-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-top:1px solid var(--line);flex-wrap:wrap}',
      '.off-pg{padding:8px 14px;font-size:13px}',
      '.off-pg-info{font-size:12px;color:var(--muted)}',
      // inspecteur latéral
      '.off-insp{position:fixed;top:0;right:0;width:392px;max-width:92vw;height:100vh;background:var(--card);border-left:1px solid var(--line);box-shadow:var(--sh-3);transform:translateX(100%);transition:transform .32s var(--ease);z-index:50;overflow-y:auto;display:flex;flex-direction:column}',
      '.off-insp.open{transform:translateX(0)}',
      '.off-insp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-bottom:1px solid var(--line);background:rgba(251,252,254,.7);backdrop-filter:blur(10px);position:sticky;top:0;z-index:1}',
      '.off-insp-name{font-size:17px;font-weight:800;letter-spacing:-.02em;line-height:1.2}',
      '.off-insp-sub{font-size:12.5px;color:var(--ip-ink-2);font-weight:600;margin-top:4px}',
      '.off-insp-cip{font-size:11.5px;color:var(--muted);margin-top:3px}',
      '.off-insp-x{width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:var(--card);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);flex-shrink:0;transition:.18s var(--ease)}',
      '.off-insp-x:hover{color:var(--ip-ink);transform:rotate(90deg)}',
      '.off-insp-body{padding:20px}',
      '.off-insp-img{width:100%;height:150px;border-radius:13px;overflow:hidden;background:var(--card-2);border:1px solid var(--line);margin-bottom:16px;display:flex;align-items:center;justify-content:center}',
      '.off-insp-img img{max-width:100%;max-height:100%;object-fit:contain}',
      '.off-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}',
      '.off-badge{display:inline-block;padding:3px 9px;border-radius:8px;font-size:10.5px;font-weight:700;background:color-mix(in srgb,var(--bc) 13%,#fff);color:var(--bc)}',
      '.off-alert{display:flex;gap:11px;align-items:flex-start;padding:13px 15px;border-radius:13px;background:color-mix(in srgb,var(--c-rose) 8%,#fff);border:1px solid color-mix(in srgb,var(--c-rose) 28%,transparent);margin-bottom:16px;font-size:12.5px;line-height:1.5;color:var(--ip-ink-2)}',
      '.off-alert-ic{color:var(--c-rose);flex-shrink:0;margin-top:1px}',
      '.off-alert b{color:var(--c-rose)}',
      '.off-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.off-kpi{background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:13px 14px}',
      '.off-kpi-l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:5px}',
      '.off-kpi-v{font-family:var(--mono);font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.off-cmp{margin-top:18px;padding:15px;background:var(--card-2);border:1px solid var(--line);border-radius:13px}',
      '.off-cmp-l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:11px}',
      '.off-cmp-l span{text-transform:none;letter-spacing:0;font-weight:500}',
      '.off-cmp-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line-2)}',
      '.off-cmp-row:last-child{border-bottom:none}',
      '.off-cmp-row.muted{opacity:.55}',
      '.off-cmp-src{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;flex:1}',
      '.off-cmp-src .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
      '.off-cmp-price{font-size:14px;font-weight:700}',
      '.off-cmp-price.bad{color:var(--c-rose)}',
      '.off-cmp-na{font-size:12px;color:var(--muted);font-style:italic}',
      '.off-cmp-delta{font-size:11px;font-weight:700;font-family:var(--mono);min-width:96px;text-align:right}',
      '.off-cmp-delta.bad{color:var(--c-rose)}',
      '.off-cmp-delta.ok{color:var(--c-mint)}',
      '.off-insp-cta{margin-top:20px}',
      '.off-insp-cta .v2-btn{width:100%}',
      '@media(max-width:1100px){.off-insp{width:350px}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── PAGE ──────────────────────────────────────
  V2.pages.offilog = {
    render: function (root, param) {
      injectCss();
      if (param != null && param !== '' && String(param) !== String(S.sel)) S.sel = param;

      if (!window.OFFILOG) {
        root.innerHTML = V2.topbar({ back: true }) +
          '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du catalogue Offilog…</div></div>';
        V2.loadFiles(['offilog']).then(function () { idxBuilt = false; V2.render(); });
        return;
      }
      buildIndex();

      var base = filteredBase();
      var c = counts(base);
      var filtered = (S.chip === 'all') ? base : base.filter(function (p) { return matchChip(p, S.chip); });
      var total = filtered.length;
      var pages = Math.max(1, Math.ceil(total / PER_PAGE));
      if (S.page >= pages) S.page = pages - 1;
      if (S.page < 0) S.page = 0;
      var pageRows = filtered.slice(S.page * PER_PAGE, (S.page + 1) * PER_PAGE);
      var nbTotal = (window.OFFILOG || []).length;

      var chips = CHIPS.map(function (f) {
        var n = c[f.k] || 0;
        var on = S.chip === f.k ? ' on' : '';
        return '<button class="v2-seg' + on + '" style="--sc:' + f.sc + '" onclick="V2.offFilter(\'' + f.k + '\')">' +
          (f.k === 'all' ? '' : '<span class="sw"></span>') + esc(f.label) + '<span class="cnt">' + V2.fmtNum(n) + '</span></button>';
      }).join('');

      var insHtml = '';
      if (S.sel != null) {
        var sp = offByEan.get(String(S.sel));
        if (sp) insHtml = inspector(sp); else S.sel = null;
      }

      var tableHtml;
      if (!total) {
        tableHtml = '<div class="off-tablewrap"><div class="v2-empty">' +
          '<div class="v2-empty-ico">' + ICO('search', 64, 1.4) + '</div>' +
          '<div class="v2-empty-t">Aucun produit</div>' +
          '<div class="v2-empty-d">Aucun produit ne correspond à ce filtre et cette recherche.</div></div></div>';
      } else {
        tableHtml = '<div class="off-tablewrap"><div class="off-table-scroll"><table class="v2-table">' +
          '<thead><tr><th class="num">#</th><th>Produit</th><th>Marque</th>' +
          '<th class="num">Achat IP HT</th><th class="num">Public TTC</th>' +
          '<th class="num">E.Leclerc</th><th class="num">Drakkars</th><th class="num">Cap3000</th></tr></thead>' +
          '<tbody>' + rowsHtml(pageRows) + '</tbody></table></div>' + pager(total, pages) + '</div>';
      }

      var qVal = S.q.replace(/"/g, '&quot;');
      var clrBtn = S.q ? '<button class="clr" onclick="V2.offSearch(\'\')">' + ICO('close', 16, 2) + '</button>' : '';

      root.innerHTML = V2.topbar({ back: true }) +
        '<div class="v2-wrap"' + (S.sel != null ? ' style="margin-right:392px"' : '') + '>' +
          '<div class="v2-page-title">Offilog &amp; concurrents</div>' +
          '<div class="v2-page-sub">' + V2.fmtNum(nbTotal) + ' produits parapharma · ton prix d\'achat IP comparé aux prix publics E.Leclerc, Drakkars et Cap3000</div>' +
          '<div class="off-search">' + ICO('search', 19, 2) +
            '<input id="off-search-input" autocomplete="off" placeholder="Rechercher par produit, marque ou EAN…" value="' + qVal + '" oninput="V2.offSearch(this.value)">' + clrBtn + '</div>' +
          '<div class="v2-segs">' + chips + '</div>' +
          '<div class="off-stats-l">' + (S.chip === 'all' ? (S.q ? 'Statistiques · résultats « ' + esc(S.q) + ' »' : 'Statistiques · tout Offilog') : 'Statistiques · ' + esc(CHIP_BY_KEY[S.chip].label)) + '</div>' +
          statBand(computeAgg(filtered)) +
          '<div class="off-count"><b style="color:var(--ip-ink);font-family:var(--mono)">' + V2.fmtNum(total) + '</b> produit' + (total > 1 ? 's' : '') + (S.chip !== 'all' ? ' · ' + esc(CHIP_BY_KEY[S.chip].label) : '') + '</div>' +
          tableHtml +
        '</div>' + insHtml;
    }
  };
})();
