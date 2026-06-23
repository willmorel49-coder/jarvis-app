/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Par produit" (pages.molecules) — onglet de "Catalogue & prix"
   Vue réseau PAR PRODUIT (CIP) : rotation moyenne/pharmacie + marge pharmacien
   (MDL), remise Intégral (PPHT→net) et CA d'achat. Données précalculées dans
   window.PROD_STATS (prod-stats-data.js). Trié par ventes (rotation).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : (n + ' €'); };
  var num = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(n); };

  var S = { sort: 'rota', q: '' };
  var COLS = [
    { k: 'rota', l: 'Rotation', sub: '/phie/an', fmt: num },
    { k: 'marge', l: 'Marge pharmacien', sub: '/an (MDL)', fmt: eur, accent: 'var(--c-opp)' },
    { k: 'remise', l: 'Remise Intégral', sub: '/an (PPHT→net)', fmt: eur, accent: 'var(--ip-blue)' },
    { k: 'ca', l: 'CA achat', sub: 'HT /an', fmt: eur },
  ];
  function cap(s) { s = (s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }

  function rowsHtml() {
    var data = (window.PROD_STATS || []).slice();
    var q = S.q.trim().toLowerCase();
    if (q) data = data.filter(function (r) { return (r.d || '').toLowerCase().indexOf(q) >= 0 || (r.c || '').indexOf(q) >= 0; });
    data.sort(function (a, b) { return (b[S.sort] || 0) - (a[S.sort] || 0); });
    var shown = data.slice(0, 200);
    if (!shown.length) return '<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--muted)">Aucun produit.</td></tr>';
    return shown.map(function (r, i) {
      return '<tr>' +
        '<td class="num" style="color:var(--muted-2);width:30px;text-align:right;font-family:var(--mono)">' + (i + 1) + '</td>' +
        '<td><span style="font-weight:700">' + esc(cap(r.d)) + '</span></td>' +
        '<td class="mono" style="color:var(--muted);font-size:11.5px">' + esc(r.c) + '</td>' +
        '<td class="num mono">' + num(r.n) + '</td>' +
        COLS.map(function (c) {
          return '<td class="num mono"' + (c.accent ? ' style="color:' + c.accent + ';font-weight:800"' : '') + '>' + c.fmt(r[c.k] || 0) + '</td>';
        }).join('') +
      '</tr>';
    }).join('');
  }

  V2.molSort = function (k) { S.sort = k; fill(); syncHead(); };
  var _t = null;
  V2.molSearch = function (v) { S.q = v || ''; if (_t) clearTimeout(_t); _t = setTimeout(fill, 200); };
  function fill() { var b = document.getElementById('mol-tbody'); if (b) b.innerHTML = rowsHtml(); }
  function syncHead() {
    Array.prototype.forEach.call(document.querySelectorAll('.mol-th'), function (th) {
      th.classList.toggle('on', th.getAttribute('data-k') === S.sort);
    });
  }

  V2.pages.molecules = {
    render: function (root) {
      var tabs = V2.priceTabs ? V2.priceTabs('molecules') : '';
      if (!window.PROD_STATS) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap">' + tabs + '<div class="v2-empty"><div class="v2-empty-d">Données produits indisponibles.</div></div></div>';
        return;
      }
      var th = function (c) {
        return '<th class="num mol-th' + (S.sort === c.k ? ' on' : '') + '" data-k="' + c.k + '" onclick="V2.molSort(\'' + c.k + '\')" style="cursor:pointer;white-space:nowrap">' +
          c.l + '<small style="display:block;font-weight:500;color:var(--muted-2)">' + c.sub + ' ↕</small></th>';
      };
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' + tabs +
          '<div class="v2-page-title">Par produit</div>' +
          '<div class="v2-page-sub">Ce qu\'une pharmacie moyenne du réseau fait sur chaque produit (par CIP) : rotation, marge pharmacien (MDL), ta remise et le CA. ' + num((window.PROD_STATS || []).length) + ' produits, triés par ventes.</div>' +
          '<div class="mol-search"><span>' + ICO('search', 18) + '</span><input id="mol-q" type="search" placeholder="Chercher un produit ou un CIP (doliprane, 3400…)" oninput="V2.molSearch(this.value)" autocomplete="off"></div>' +
          '<div style="overflow-x:auto"><table class="v2-table mol-table"><thead><tr>' +
            '<th class="num">#</th><th>Produit</th><th>CIP</th><th class="num mol-th' + (S.sort === 'n' ? ' on' : '') + '" data-k="n" onclick="V2.molSort(\'n\')" style="cursor:pointer">Phies<small style="display:block;font-weight:500;color:var(--muted-2)">réseau ↕</small></th>' +
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
      '.mol-table td,.mol-table th{padding:8px 10px}';
    document.head.appendChild(st);
  }
})();
