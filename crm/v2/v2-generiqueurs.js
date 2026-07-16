/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · CA par génériqueur (helper partagé)
   window.GENERIQUEURS = { "<cip13>": "Biogaran", ... } (table BDPM).
   Agrège un jeu de ventes (s.artCode = cip13, s.mntNetHt = CA net) par
   génériqueur. Rendu = carte à barres. Utilisé fiche client + Pilotage.
   Défensif : si la table n'est pas chargée / aucun générique → rien.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  // Palette barres (dégradé bleu→ambre, cohérent app)
  var BAR = ['#0050E6', '#1E6FE6', '#2C86D8', '#00A9B5', '#0F9E6A', '#5BA83C',
    '#C7A11A', '#E08A1B', '#EA6A2C', '#D9553F', '#B4476B', '#7C4FC4'];

  function eur(n) { return V2.fmtEur ? V2.fmtEur(n) : (Math.round(n || 0).toLocaleString('fr') + ' €'); }

  // Agrège les ventes par génériqueur. Renvoie { rows:[{lab,ca,n}], total }.
  V2.caParGeneriqueur = function (sales) {
    var G = window.GENERIQUEURS || null;
    if (!G || !sales) return { rows: [], total: 0, loaded: !!G };
    var by = {}, total = 0;
    for (var i = 0; i < sales.length; i++) {
      var s = sales[i], cip = s.artCode != null ? String(s.artCode) : '';
      var lab = cip && G[cip];
      if (!lab) continue;                       // pas un générique référencé BDPM
      var ca = s.mntNetHt || 0;
      var e = by[lab] || (by[lab] = { lab: lab, ca: 0, n: 0 });
      e.ca += ca; e.n += 1; total += ca;
    }
    var rows = Object.keys(by).map(function (k) { return by[k]; });
    rows.sort(function (a, b) { return b.ca - a.ca; });
    return { rows: rows, total: total, loaded: true };
  };

  function injectCss() {
    if (document.getElementById('v2-gnq-css')) return;
    var st = document.createElement('style'); st.id = 'v2-gnq-css';
    st.textContent =
      '.gnq-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md,14px);padding:16px 18px}' +
      '.gnq-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px}' +
      '.gnq-t{font-size:14.5px;font-weight:800;color:var(--ip-ink);letter-spacing:-.01em}' +
      '.gnq-tot{font-family:var(--mono);font-size:12.5px;font-weight:700;color:var(--muted)}' +
      '.gnq-row{display:grid;grid-template-columns:104px 1fr auto;align-items:center;gap:10px;padding:5px 0}' +
      '.gnq-lab{font-size:12.5px;font-weight:700;color:var(--ip-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.gnq-bar{height:9px;border-radius:6px;background:var(--card-2,#eef1f6);overflow:hidden}' +
      '.gnq-bar > i{display:block;height:100%;border-radius:6px}' +
      '.gnq-val{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ip-ink);white-space:nowrap}' +
      '.gnq-val small{color:var(--muted);font-weight:600;margin-left:4px}' +
      '.gnq-empty{font-size:13px;color:var(--muted);padding:6px 0}' +
      '@media(max-width:520px){.gnq-row{grid-template-columns:88px 1fr auto}.gnq-lab{font-size:11.5px}}';
    document.head.appendChild(st);
  }

  // Carte visuelle « CA par génériqueur ». opts: { title, max } . Renvoie '' si rien.
  V2.generiqueurCard = function (sales, opts) {
    opts = opts || {};
    var r = V2.caParGeneriqueur(sales);
    if (!r.loaded || !r.rows.length) return '';   // table absente ou zéro générique
    injectCss();
    var maxRows = opts.max || 12;
    var shown = r.rows.slice(0, maxRows);
    var maxCa = shown[0].ca || 1;
    var body = shown.map(function (o, i) {
      var pct = r.total ? Math.round(o.ca / r.total * 100) : 0;
      var w = Math.max(3, Math.round(o.ca / maxCa * 100));
      var col = BAR[i % BAR.length];
      return '<div class="gnq-row">' +
        '<span class="gnq-lab" title="' + esc(o.lab) + '">' + esc(o.lab) + '</span>' +
        '<span class="gnq-bar"><i style="width:' + w + '%;background:' + col + '"></i></span>' +
        '<span class="gnq-val">' + eur(o.ca) + '<small>' + pct + '%</small></span>' +
      '</div>';
    }).join('');
    var extra = r.rows.length > maxRows ? ('<div class="gnq-empty">+ ' + (r.rows.length - maxRows) + ' autres génériqueurs</div>') : '';
    return '<div class="gnq-card">' +
      '<div class="gnq-h"><span class="gnq-t">' + esc(opts.title || 'CA par génériqueur') + '</span>' +
        '<span class="gnq-tot">' + eur(r.total) + ' · ' + r.rows.length + ' génériqueurs</span></div>' +
      body + extra +
    '</div>';
  };
})();
