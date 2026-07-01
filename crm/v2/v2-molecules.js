/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Par produit" (pages.molecules) — onglet de "Catalogue & prix"
   Calé sur le catalogue grossiste : mêmes familles (tranches de prix / froid / NR),
   table simple, SANS stats Ameli. Vue réseau PAR PRODUIT (CIP) :
   rotation moyenne/pharmacie, marge pharmacien (MDL), remise Intégral, CA d'achat.
   Données précalculées dans window.PROD_STATS (prod-stats-data.js).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : (n + ' €'); };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(n); };

  // Mêmes familles que le catalogue grossiste (sous-ensemble dérivable par CIP)
  var FAMS = [
    { k: 'all',    label: 'Tout',                        sc: '#0050E6' },
    { k: 'pr_low', label: 'Princeps · petits prix',      sc: '#1E9E6A' },
    { k: 'pr_mid', label: 'Princeps · intermédiaire',    sc: '#0050E6' },
    { k: 'pr_high',label: 'Princeps · cher',             sc: '#C7791A' },
    { k: 'nr',     label: 'NR',                          sc: '#E0556E' },
    { k: 'genbio', label: 'Génériques + biosimilaires',  sc: '#7C3AED' },
  ];
  var FAM_BY = {}; FAMS.forEach(function (f) { FAM_BY[f.k] = f; });
  var FAM_SHORT = { pr_low: 'Princeps petits prix', pr_mid: 'Princeps intermédiaire', pr_high: 'Princeps cher', nr: 'NR', genbio: 'Génér. + biosim' };

  var S = { sort: 'rota', q: '', chip: 'all' };
  var COLS = [
    { k: 'rota', l: 'Rotation', sub: '/phie/an', fmt: num },
    { k: 'marge', l: 'Marge pharmacien', sub: '/an (MDL)', fmt: eur, accent: 'var(--c-opp)' },
    { k: 'remise', l: 'Remise Intégral', sub: '/an', fmt: eur, accent: 'var(--ip-blue)' },
    { k: 'ca', l: 'CA achat', sub: 'HT /an', fmt: eur },
  ];
  function cap(s) { s = (s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function famBadge(k) {
    var f = FAM_BY[k]; if (!f || k === 'all') return '';
    return '<span class="mol-fam" style="--fc:' + f.sc + '">' + esc(FAM_SHORT[k] || f.label) + '</span>';
  }

  function baseData() {
    var data = (window.PROD_STATS || []);
    if (S.chip !== 'all') data = data.filter(function (r) { return r.f === S.chip; });
    var q = S.q.trim().toLowerCase();
    if (q) data = data.filter(function (r) { return (r.d || '').toLowerCase().indexOf(q) >= 0 || (r.c || '').indexOf(q) >= 0; });
    return data;
  }
  function counts() {
    var c = {}; FAMS.forEach(function (f) { c[f.k] = 0; });
    (window.PROD_STATS || []).forEach(function (r) { c.all++; if (c[r.f] != null) c[r.f]++; });
    return c;
  }

  function rowsHtml() {
    var data = baseData().slice();
    data.sort(function (a, b) { return (b[S.sort] || 0) - (a[S.sort] || 0); });
    var shown = data.slice(0, 200);
    if (!shown.length) return '<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--muted)">Aucun produit.</td></tr>';
    return shown.map(function (r, i) {
      return '<tr>' +
        '<td class="num" style="color:var(--muted-2);width:30px;text-align:right;font-family:var(--mono)">' + (i + 1) + '</td>' +
        '<td><span style="font-weight:700">' + esc(cap(r.d)) + '</span></td>' +
        '<td class="mono" style="color:var(--muted);font-size:11.5px">' + esc(r.c) + '</td>' +
        '<td>' + famBadge(r.f) + '</td>' +
        '<td class="num mono">' + num(r.n) + '</td>' +
        COLS.map(function (c) {
          return '<td class="num mono"' + (c.accent ? ' style="color:' + c.accent + ';font-weight:800"' : '') + '>' + c.fmt(r[c.k] || 0) + '</td>';
        }).join('') +
      '</tr>';
    }).join('');
  }

  V2.molFilter = function (k) { S.chip = k; V2.render(); };
  V2.molSort = function (k) { S.sort = k; fill(); syncHead(); };
  var _t = null;
  V2.molSearch = function (v) { S.q = v || ''; if (_t) clearTimeout(_t); _t = setTimeout(fill, 200); };
  function fill() {
    var b = document.getElementById('mol-tbody'); if (b) b.innerHTML = rowsHtml();
    var cnt = document.getElementById('mol-count'); if (cnt) cnt.textContent = num(baseData().length);
  }
  function syncHead() {
    Array.prototype.forEach.call(document.querySelectorAll('.mol-th'), function (th) {
      th.classList.toggle('on', th.getAttribute('data-k') === S.sort);
    });
  }

  V2.pages.molecules = {
    render: function (root, param) {
      if (param != null && param !== '') { S.q = String(param); S.chip = 'all'; }
      var tabs = V2.priceTabs ? V2.priceTabs('molecules') : '';
      if (!window.PROD_STATS) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap">' + tabs + '<div class="v2-empty"><div class="v2-empty-d">Données produits indisponibles.</div></div></div>';
        return;
      }
      var c = counts();
      var chips = FAMS.map(function (f) {
        var on = S.chip === f.k ? ' on' : '';
        return '<button class="v2-seg' + on + '" style="--sc:' + f.sc + '" onclick="V2.molFilter(\'' + f.k + '\')">' +
          (f.k === 'all' ? '' : '<span class="sw"></span>') + esc(f.label) + '<span class="cnt">' + num(c[f.k] || 0) + '</span></button>';
      }).join('');
      var th = function (col) {
        return '<th class="num mol-th' + (S.sort === col.k ? ' on' : '') + '" data-k="' + col.k + '" onclick="V2.molSort(\'' + col.k + '\')" style="cursor:pointer;white-space:nowrap">' +
          col.l + '<small style="display:block;font-weight:500;color:var(--muted-2)">' + col.sub + ' ↕</small></th>';
      };
      var qVal = S.q.replace(/"/g, '&quot;');
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' + tabs +
          '<div class="v2-page-title">Par produit</div>' +
          '<div class="v2-page-sub">Ce qu\'une pharmacie moyenne du réseau fait sur chaque produit (par CIP) : rotation, marge pharmacien (MDL), ta remise et le CA. Classé par familles, comme le catalogue.</div>' +
          '<div class="mol-search"><span>' + ICO('search', 18) + '</span><input id="mol-q" type="search" placeholder="Chercher un produit ou un CIP (doliprane, 3400…)" value="' + qVal + '" oninput="V2.molSearch(this.value)" autocomplete="off"></div>' +
          '<div class="v2-segs">' + chips + '</div>' +
          '<div class="cat-count"><b id="mol-count" style="color:var(--ip-ink);font-family:var(--mono)">' + num(baseData().length) + '</b> produit' + '</div>' +
          '<div style="overflow-x:auto"><table class="v2-table mol-table"><thead><tr>' +
            '<th class="num">#</th><th>Produit</th><th>CIP13</th><th>Famille</th>' +
            '<th class="num mol-th' + (S.sort === 'n' ? ' on' : '') + '" data-k="n" onclick="V2.molSort(\'n\')" style="cursor:pointer">Phies<small style="display:block;font-weight:500;color:var(--muted-2)">réseau ↕</small></th>' +
            COLS.map(th).join('') +
          '</tr></thead><tbody id="mol-tbody">' + rowsHtml() + '</tbody></table></div>' +
          '<div class="v2-page-sub" style="margin-top:14px;font-size:12px">Estimations à partir des ventes réelles du réseau (5 mois, annualisées) · marge MDL = produits remboursables · top 200 affichés.</div>' +
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
      '.mol-fam{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;color:var(--fc);background:color-mix(in srgb,var(--fc) 14%,transparent);white-space:nowrap}';
    document.head.appendChild(st);
  }
})();
