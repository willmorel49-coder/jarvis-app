/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Catalogue Intégral Pharma" (pages.catalogue)
   Catalogue GROSSISTE complet (10 500 réf médicaments) : filtres
   familles AFMCODE par tranches de prix, recherche, table triée par
   rang qté, pagination, inspecteur DÉTAIL PRODUIT (prix + potentiel
   marché Vol IP / Vol Ameli + ajout fiche).
   ── Concurrents (Drakkars/Cap3000/Leclerc) = pilier Offilog, PAS ici ──
   ── Validé Will 2026-06-10 (preview catalogue) ──
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  var S = { chip: 'all', q: '', page: 0, sel: null };
  var PER_PAGE = 100;

  var FAMS = [
    { k: 'all',    label: 'Tout',                   sc: '#0050E6' },
    { k: 'p_low',  label: 'Princeps · 0–4,33€',     sc: '#1E9E6A' },
    { k: 'p_mid',  label: 'Princeps · 4,33–468€',   sc: '#0050E6' },
    { k: 'p_high', label: 'Princeps · >468€',       sc: '#C7791A' },
    { k: 'froid',  label: 'Froid',                  sc: '#00B5D8' },
    { k: 'gen',    label: 'Génériques',             sc: '#737A8C' },
    { k: 'genp',   label: 'Génériques partenaires', sc: '#1E9E6A' },
    { k: 'bio',    label: 'Biosimilaires',          sc: '#6D4FC4' },
    { k: 'nr',     label: 'Non remboursés',         sc: '#C7791A' },
  ];
  var FAM_BY_KEY = {}; FAMS.forEach(function (f) { FAM_BY_KEY[f.k] = f; });
  var FAM_SHORT = {
    p_low: 'Petits prix', p_mid: 'Intermédiaire', p_high: 'Cher',
    froid: 'Froid', gen: 'Génér.', genp: 'Génér. part.', bio: 'Biosim.', nr: 'NR'
  };

  // ── Index ─────────────────────────────────────
  var idxBuilt = false, sagittaSet = null, sortedBench = null, benchByCip = null;
  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }
  function refPrice(b) {
    var p = (b.prix_ip != null && b.prix_ip > 0) ? b.prix_ip : b.prix_ht;
    return (typeof p === 'number' && isFinite(p)) ? p : 0;
  }
  function classify(b) {
    if (b.is_froid) return 'froid';
    var an = norm(b.artnature);
    if (an === 'biosimilaire') return 'bio';
    if (an === 'generique_partenaire' || an === 'generique partenaire') return 'genp';
    if (an === 'generique') return 'gen';
    if ((sagittaSet && sagittaSet.has(String(b.cip13))) || b.has_ameli === false) return 'nr';
    var p = refPrice(b);
    if (p <= 4.33) return 'p_low';
    if (p <= 468) return 'p_mid';
    return 'p_high';
  }
  function buildIndex() {
    if (idxBuilt) return;
    var B = window.BENCHMARK || [];
    sagittaSet = new Set();
    (window.SAGITTA_SHORTLIST || []).forEach(function (s) { if (s && s.cip13 != null) sagittaSet.add(String(s.cip13)); });
    benchByCip = new Map();
    sortedBench = B.slice().sort(function (a, b) { return (a.ip_rank_qty || 9e9) - (b.ip_rank_qty || 9e9); });
    B.forEach(function (b) { b._fam = classify(b); if (b.cip13 != null) benchByCip.set(String(b.cip13), b); });
    idxBuilt = true;
  }

  function filteredBase() {
    var q = S.q.trim().toLowerCase();
    if (!q) return sortedBench;
    return sortedBench.filter(function (b) { return norm(b.designation).indexOf(q) >= 0 || norm(b.cip13).indexOf(q) >= 0; });
  }
  function counts(base) {
    var c = { all: base.length };
    FAMS.forEach(function (f) { if (f.k !== 'all') c[f.k] = 0; });
    for (var i = 0; i < base.length; i++) c[base[i]._fam]++;
    return c;
  }
  function fmtBig(n) {
    if (!n) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + ' M';
    if (n >= 1e3) return Math.round(n / 1e3) + ' k';
    return V2.fmtNum(n);
  }
  function famBadge(famKey, short) {
    var f = FAM_BY_KEY[famKey] || FAM_BY_KEY.all;
    var lbl = short ? (FAM_SHORT[famKey] || f.label) : f.label;
    return '<span class="cat-badge" style="--bc:' + f.sc + '">' + esc(lbl) + '</span>';
  }

  // ── Inspecteur DÉTAIL PRODUIT (panneau latéral) ──
  function inspector(b) {
    var ht = (typeof b.prix_ht === 'number' && b.prix_ht > 0) ? b.prix_ht : 0;
    var ip = (typeof b.prix_ip === 'number' && b.prix_ip > 0) ? b.prix_ip : 0;
    var rem = (ht > 0 && ip > 0) ? Math.round((1 - ip / ht) * 1000) / 10 : (b.remise_pct || 0);
    var vol = b.ip_qty || 0;
    var ameli = b.ameli_total || 0;
    var hasOffre = b.offre_ip != null && b.offre_ip > 0;

    var potHtml;
    if (ameli > 0) {
      var part = Math.min(100, (vol / ameli) * 100);
      potHtml = '<div class="cat-pot"><div class="cat-pot-l">Potentiel marché</div>' +
        '<div class="cat-pot-bar"><div class="cat-pot-fill" style="width:' + Math.max(2, part) + '%"></div></div>' +
        '<div class="cat-pot-txt">Tu vends <b>' + V2.fmtNum(vol) + '</b> boîtes · marché France (Ameli) <b>' + fmtBig(ameli) + '</b> · ta part <b>' + part.toFixed(2) + '%</b></div></div>';
    } else {
      potHtml = '<div class="cat-pot nr"><div class="cat-pot-l" style="color:var(--c-amber)">Non remboursé</div>' +
        '<div class="cat-pot-txt">Pas de marché Ameli (hors remboursement). Marge libre pharmacien.</div></div>';
    }

    function kpi(l, v, col) {
      return '<div class="cat-kpi"><div class="cat-kpi-l">' + l + '</div><div class="cat-kpi-v"' + (col ? ' style="color:' + col + '"' : '') + '>' + v + '</div></div>';
    }
    return '<div class="cat-insp' + (S.sel != null ? ' open' : '') + '">' +
      '<div class="cat-insp-head">' +
        '<div style="min-width:0"><div class="cat-insp-name">' + esc(b.designation || '') + '</div>' +
          '<div class="cat-insp-cip mono">CIP ' + esc(b.cip13 || '') + '</div>' +
          '<div style="margin-top:8px">' + famBadge(b._fam) + (hasOffre ? '<span class="cat-offre">OFFRE EN COURS</span>' : '') + '</div></div>' +
        '<button class="cat-insp-x" onclick="V2.catSelect(null)" title="Fermer">' + ICO('close', 18, 2) + '</button>' +
      '</div>' +
      '<div class="cat-insp-body">' +
        '<div class="cat-kpi-grid">' +
          kpi('Prix HT', ht > 0 ? V2.fmtEur(ht) : '—') +
          kpi('Prix net IP', ip > 0 ? V2.fmtEur(ip) : '—', 'var(--ip-blue)') +
          kpi('Remise IP', rem > 0 ? rem + '%' : '—', 'var(--c-mint)') +
          kpi('Volume IP', V2.fmtNum(vol)) +
        '</div>' +
        potHtml +
        '<div class="cat-insp-cta"><button class="v2-btn v2-btn-primary" onclick="V2.catAddToFiche(\'' + esc(b.cip13) + '\')">' + ICO('plus', 17) + ' Ajouter à une fiche commerciale</button></div>' +
      '</div>' +
    '</div>';
  }

  // ── Table rows ────────────────────────────────
  function rowsHtml(rows) {
    return rows.map(function (b, i) {
      var ht = (b.prix_ht > 0) ? b.prix_ht : 0;
      var ip = (b.prix_ip > 0) ? b.prix_ip : 0;
      var rem = (ht > 0 && ip > 0) ? Math.round((1 - ip / ht) * 1000) / 10 : (b.remise_pct || 0);
      var sel = (S.sel != null && String(b.cip13) === String(S.sel)) ? ' sel' : '';
      var hasOffre = b.offre_ip != null && b.offre_ip > 0;
      return '<tr class="cat-row' + sel + '" onclick="V2.catSelect(\'' + esc(b.cip13) + '\')">' +
        '<td class="num" style="color:var(--muted-2);font-size:11px">' + (S.page * PER_PAGE + i + 1) + '</td>' +
        '<td><span class="cat-pname">' + esc((b.designation || '').slice(0, 52)) + '</span>' + (hasOffre ? '<span class="cat-offre-mini">OFFRE</span>' : '') + '</td>' +
        '<td class="cat-cip">' + esc(b.cip13 || '') + '</td>' +
        '<td>' + famBadge(b._fam, true) + '</td>' +
        '<td class="num">' + (ht > 0 ? V2.fmtEur(ht) : '—') + '</td>' +
        '<td class="num cat-ip">' + (ip > 0 ? V2.fmtEur(ip) : '—') + '</td>' +
        '<td class="num cat-rem">' + (rem > 0 ? rem + '%' : '—') + '</td>' +
        '<td class="num">' + V2.fmtNum(b.ip_qty || 0) + '</td>' +
        '<td class="num" style="color:var(--muted)">' + fmtBig(b.ameli_total || 0) + '</td>' +
        '</tr>';
    }).join('');
  }
  function pager(total, pages) {
    if (pages <= 1) return '';
    var from = S.page * PER_PAGE + 1, to = Math.min(total, (S.page + 1) * PER_PAGE);
    return '<div class="cat-pager">' +
      '<button class="v2-btn v2-btn-ghost cat-pg"' + (S.page <= 0 ? ' disabled style="opacity:.4;pointer-events:none"' : '') + ' onclick="V2.catPage(' + (S.page - 1) + ')">' + ICO('back', 15) + ' Précédent</button>' +
      '<span class="cat-pg-info mono">' + from + '–' + to + ' sur ' + V2.fmtNum(total) + ' · page ' + (S.page + 1) + '/' + pages + '</span>' +
      '<button class="v2-btn v2-btn-ghost cat-pg"' + (S.page >= pages - 1 ? ' disabled style="opacity:.4;pointer-events:none"' : '') + ' onclick="V2.catPage(' + (S.page + 1) + ')">Suivant ' + ICO('chev', 15) + '</button>' +
    '</div>';
  }

  // ── Handlers ──────────────────────────────────
  V2.catFilter = function (k) { S.chip = k; S.page = 0; V2.render(); };
  V2.catSearch = function (val) { S.q = val || ''; S.page = 0; rerenderKeepFocus(); };
  V2.catPage = function (p) { S.page = p; V2.render(); try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {} };
  V2.catSelect = function (cip) {
    S.sel = (cip == null || (S.sel != null && String(S.sel) === String(cip))) ? null : cip;
    V2.render();
  };
  V2.catAddToFiche = function (cip) {
    var b = benchByCip.get(String(cip));
    if (!b) return;
    try {
      var cur = JSON.parse(localStorage.getItem('v2_fiche_courante') || '{"products":[]}');
      if (cur.products.some(function (p) { return String(p.cip13) === String(cip); })) {
        V2.toast('Déjà dans la fiche en cours', 'warn'); return;
      }
      cur.products.push({ cip13: b.cip13, designation: b.designation, prix_ip: b.prix_ip, prix_ht: b.prix_ht, remise_pct: b.remise_pct, is_froid: b.is_froid });
      localStorage.setItem('v2_fiche_courante', JSON.stringify(cur));
      V2.toast('✓ Ajouté à la fiche en cours (' + cur.products.length + ')');
    } catch (e) { V2.toast('Erreur', 'error'); }
  };

  function rerenderKeepFocus() {
    V2.render();
    var inp = document.getElementById('cat-search-input');
    if (inp) { inp.focus(); var v = inp.value; try { inp.setSelectionRange(v.length, v.length); } catch (e) {} }
  }

  // ── CSS ───────────────────────────────────────
  function injectCss() {
    if (document.getElementById('v2-cat-css')) return;
    var s = document.createElement('style'); s.id = 'v2-cat-css';
    s.textContent = [
      '.cat-search{display:flex;align-items:center;gap:13px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:18px;box-shadow:var(--sh-2);transition:.2s var(--ease)}',
      '.cat-search:focus-within{border-color:rgba(0,80,230,.4);box-shadow:0 0 0 4px var(--halo),var(--sh-2)}',
      '.cat-search svg{color:var(--ip-blue);flex-shrink:0}',
      '.cat-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:16px;flex:1;color:var(--ip-ink)}',
      '.cat-search .clr{border:none;background:none;cursor:pointer;color:var(--muted);display:flex;padding:2px}',
      '.cat-count{font-size:12px;color:var(--muted);margin-bottom:12px}',
      '.cat-badge{display:inline-block;padding:3px 9px;border-radius:8px;font-size:10.5px;font-weight:700;white-space:nowrap;background:color-mix(in srgb,var(--bc) 13%,#fff);color:var(--bc)}',
      '.cat-tablewrap{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);overflow:hidden}',
      '.cat-table-scroll{overflow-x:auto}',
      '.cat-pname{font-weight:600;color:var(--ip-ink)}',
      '.cat-cip{font-family:var(--mono);font-size:11px;color:var(--muted)}',
      '.cat-ip{font-weight:700;color:var(--ip-blue)}',
      '.cat-rem{color:var(--c-mint);font-weight:700}',
      '.cat-offre-mini{display:inline-block;margin-left:7px;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700;background:#FFF3E0;color:#C7791A}',
      '.cat-offre{display:inline-block;margin-left:7px;padding:2px 7px;border-radius:7px;font-size:10px;font-weight:700;background:#FFF3E0;color:#C7791A}',
      '.cat-row.sel{background:var(--halo)}',
      '.cat-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-top:1px solid var(--line);flex-wrap:wrap}',
      '.cat-pg{padding:8px 14px;font-size:13px}',
      '.cat-pg-info{font-size:12px;color:var(--muted)}',
      // inspecteur latéral
      '.cat-insp{position:fixed;top:0;right:0;width:372px;max-width:90vw;height:100vh;background:var(--card);border-left:1px solid var(--line);box-shadow:var(--sh-3);transform:translateX(100%);transition:transform .32s var(--ease);z-index:50;overflow-y:auto;display:flex;flex-direction:column}',
      '.cat-insp.open{transform:translateX(0)}',
      '.cat-insp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px;border-bottom:1px solid var(--line);background:rgba(251,252,254,.7);backdrop-filter:blur(10px);position:sticky;top:0}',
      '.cat-insp-name{font-size:17px;font-weight:800;letter-spacing:-.02em;line-height:1.2}',
      '.cat-insp-cip{font-size:12px;color:var(--muted);margin-top:4px}',
      '.cat-insp-x{width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:var(--card);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);flex-shrink:0;transition:.18s var(--ease)}',
      '.cat-insp-x:hover{color:var(--ip-ink);transform:rotate(90deg)}',
      '.cat-insp-body{padding:20px}',
      '.cat-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.cat-kpi{background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:13px 14px}',
      '.cat-kpi-l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:5px}',
      '.cat-kpi-v{font-family:var(--mono);font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.cat-pot{margin-top:18px;padding:14px;background:color-mix(in srgb,var(--ip-blue) 6%,#fff);border:1px solid color-mix(in srgb,var(--ip-blue) 22%,transparent);border-radius:13px}',
      '.cat-pot.nr{background:#FFF7ED;border-color:#F0C98A}',
      '.cat-pot-l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ip-blue);font-weight:700;margin-bottom:8px}',
      '.cat-pot-bar{height:8px;border-radius:5px;background:var(--line);overflow:hidden;margin:8px 0 6px}',
      '.cat-pot-fill{height:100%;background:linear-gradient(90deg,var(--ip-blue),#3B82F6);border-radius:5px;transition:width .5s var(--ease)}',
      '.cat-pot-txt{font-size:12px;color:var(--ip-ink-2);line-height:1.5}',
      '.cat-pot-txt b{font-family:var(--mono)}',
      '.cat-insp-cta{margin-top:22px}',
      '.cat-insp-cta .v2-btn{width:100%}',
      '@media(max-width:1100px){.cat-insp{width:340px}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── PAGE ──────────────────────────────────────
  V2.pages.catalogue = {
    render: function (root, param) {
      injectCss();
      if (param != null && param !== '' && String(param) !== String(S.sel)) S.sel = param;

      if (!window.BENCHMARK) {
        root.innerHTML = V2.topbar({ back: true }) +
          '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement du catalogue…</div></div>';
        V2.loadFiles(['bench', 'sagitta']).then(function () { idxBuilt = false; V2.render(); });
        return;
      }
      buildIndex();

      var base = filteredBase();
      var c = counts(base);
      var filtered = (S.chip === 'all') ? base : base.filter(function (b) { return b._fam === S.chip; });
      var total = filtered.length;
      var pages = Math.max(1, Math.ceil(total / PER_PAGE));
      if (S.page >= pages) S.page = pages - 1;
      if (S.page < 0) S.page = 0;
      var pageRows = filtered.slice(S.page * PER_PAGE, (S.page + 1) * PER_PAGE);
      var nbTotal = (window.BENCHMARK || []).length;

      var chips = FAMS.map(function (f) {
        var n = c[f.k] || 0;
        var on = S.chip === f.k ? ' on' : '';
        return '<button class="v2-seg' + on + '" style="--sc:' + f.sc + '" onclick="V2.catFilter(\'' + f.k + '\')">' +
          (f.k === 'all' ? '' : '<span class="sw"></span>') + esc(f.label) + '<span class="cnt">' + V2.fmtNum(n) + '</span></button>';
      }).join('');

      // inspecteur (lazy data pas nécessaire — détail produit = données BENCHMARK déjà là)
      var insHtml = '';
      if (S.sel != null) {
        var sb = benchByCip.get(String(S.sel));
        if (sb) insHtml = inspector(sb); else S.sel = null;
      }

      var tableHtml;
      if (!total) {
        tableHtml = '<div class="cat-tablewrap"><div class="v2-empty">' +
          '<div class="v2-empty-ico">' + ICO('search', 64, 1.4) + '</div>' +
          '<div class="v2-empty-t">Aucune référence</div>' +
          '<div class="v2-empty-d">Aucun produit ne correspond à ce filtre et cette recherche.</div></div></div>';
      } else {
        tableHtml = '<div class="cat-tablewrap"><div class="cat-table-scroll"><table class="v2-table">' +
          '<thead><tr><th class="num">#</th><th>Produit</th><th>CIP13</th><th>Famille</th>' +
          '<th class="num">Prix HT</th><th class="num">Prix IP</th><th class="num">Remise</th>' +
          '<th class="num">Vol IP</th><th class="num">Vol Ameli</th></tr></thead>' +
          '<tbody>' + rowsHtml(pageRows) + '</tbody></table></div>' + pager(total, pages) + '</div>';
      }

      var qVal = S.q.replace(/"/g, '&quot;');
      var clrBtn = S.q ? '<button class="clr" onclick="V2.catSearch(\'\')">' + ICO('close', 16, 2) + '</button>' : '';

      root.innerHTML = V2.topbar({ back: true }) +
        '<div class="v2-wrap"' + (S.sel != null ? ' style="margin-right:372px"' : '') + '>' +
          '<div class="v2-page-title">Catalogue Intégral Pharma</div>' +
          '<div class="v2-page-sub">' + V2.fmtNum(nbTotal) + ' références grossiste · filtre par tranches de prix et familles AFMCODE</div>' +
          '<div class="cat-search">' + ICO('search', 19, 2) +
            '<input id="cat-search-input" autocomplete="off" placeholder="Rechercher par CIP13 ou désignation…" value="' + qVal + '" oninput="V2.catSearch(this.value)">' + clrBtn + '</div>' +
          '<div class="v2-segs">' + chips + '</div>' +
          '<div class="cat-count"><b style="color:var(--ip-ink);font-family:var(--mono)">' + V2.fmtNum(total) + '</b> référence' + (total > 1 ? 's' : '') + (S.chip !== 'all' ? ' · ' + esc(FAM_BY_KEY[S.chip].label) : '') + '</div>' +
          tableHtml +
        '</div>' + insHtml;
    }
  };
})();
