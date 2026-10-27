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

  // Nettoyage AFFICHAGE des noms de labos (certains titulaires BDPM sont longs/moches).
  // Uniquement cosmétique : ne change pas l'agrégation.
  var LAB_FIX = { 'Glaxosmithkline': 'GSK', 'Reddy': "Dr. Reddy's", 'Pierre Fabre Medicament': 'Pierre Fabre', 'Bouchara-recordati': 'Bouchara-Recordati', 'Stragen-france': 'Stragen', 'Ratiopharm': 'Ratiopharm (Teva)', 'Eg Labo': 'EG Labo' };
  function cleanLab(name) {
    var n = String(name || '').trim();
    if (LAB_FIX[n]) return LAB_FIX[n];
    n = n.replace(/^Laboratoires?\s+/i, '');                          // « Laboratoire(s) Machin » → « Machin »
    n = n.replace(/\s+(Holding|Deutschland|Gesellschaft.*|FUR.*|SA|SAS)$/i, '');
    n = n.replace(/-france$/i, '');
    return n || String(name || '');
  }

  // 27/10/2026 — génériques et biosimilaires séparés (fiche officine, demande de Will).
  // Biosimilaire = CIP de la base officielle window.BIOSIMILAIRES ; son labo = le distributeur en France,
  // sinon le labo partenaire, sinon celui de la table BDPM, sinon le titulaire du référentiel.
  var _bsSrc = null, _bsLab = null;
  function biosimLabos() {
    var B = window.BIOSIMILAIRES, G = window.GENERIQUEURS || {};
    if (!B || !B.molecules) return null;
    if (_bsSrc === B) return _bsLab;            // la base protégée peut remplacer la publique en cours de route
    _bsSrc = B; _bsLab = {};
    B.molecules.forEach(function (m) {
      (m.biosimilaires || []).forEach(function (b) {
        (b.cips || []).forEach(function (c) { c = String(c); _bsLab[c] = b.distrib || b.partenaire_labo || G[c] || b.labo || 'Autre'; });
      });
    });
    return _bsLab;
  }

  // Agrège les ventes par génériqueur. Renvoie { rows:[{lab,ca,n}], total }.
  // type : absent = comme avant (table BDPM telle quelle) · 'gen' = génériques sans les biosimilaires ·
  // 'biosim' = biosimilaires seuls, par laboratoire.
  V2.caParGeneriqueur = function (sales, type) {
    var G = window.GENERIQUEURS || null;
    var BS = type ? biosimLabos() : null;
    if (type === 'biosim') G = BS;
    if (!G || !sales) return { rows: [], total: 0, loaded: !!G };
    var by = {}, total = 0;
    for (var i = 0; i < sales.length; i++) {
      var s = sales[i], cip = s.artCode != null ? String(s.artCode) : '';
      var lab = cip && G[cip];
      if (!lab) continue;                       // pas un générique référencé BDPM
      if (type === 'gen' && BS && BS[cip]) continue;   // biosimilaire : compté à part
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
      '.gnq-card + .gnq-card{margin-top:12px}' +
      '.gnq-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px}' +
      '.gnq-t{font-size:14.5px;font-weight:800;color:var(--ip-ink);letter-spacing:-.01em}' +
      '.gnq-tot{font-family:var(--mono);font-size:12.5px;font-weight:700;color:var(--muted)}' +
      '.gnq-row{display:grid;grid-template-columns:104px 1fr auto;align-items:center;gap:10px;padding:5px 0}' +
      '.gnq-lab{font-size:12.5px;font-weight:700;color:var(--ip-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.gnq-bar{height:9px;border-radius:6px;background:var(--card-2,#eef1f6);overflow:hidden}' +
      '.gnq-bar > i{display:block;height:100%;border-radius:6px}' +
      '.gnq-val{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ip-ink);white-space:nowrap}' +
      '.gnq-val small{color:var(--muted);font-weight:600;margin-left:4px}' +
      '.gnq-an{display:block;font-size:11px;font-weight:600;color:var(--muted)}' +
      '.gnq-note{font-size:12px;color:var(--muted);margin:-4px 0 10px}' +
      '.gnq-note b{white-space:nowrap;font-weight:700}.gnq-12 .gnq-val{min-width:14ch;text-align:right}' +
      '.gnq-empty{font-size:13px;color:var(--muted);padding:6px 0}' +
      '@media(max-width:520px){.gnq-row{grid-template-columns:88px 1fr auto}.gnq-lab{font-size:12px}}';
    document.head.appendChild(st);
  }

  // Carte visuelle « CA par génériqueur ». opts: { title, max } . Renvoie '' si rien.
  V2.generiqueurCard = function (sales, opts) {
    opts = opts || {};
    var r = V2.caParGeneriqueur(sales, opts.type);
    if (!r.loaded || !r.rows.length) return '';   // table absente ou zéro générique
    var qui = opts.type === 'biosim' ? 'laboratoire' : 'génériqueur';
    injectCss();
    // 26/10/2026 — CA ramené à 12 mois (fiche officine seulement, option opts.annuel = { mois, ventes }) :
    // sans l'option, le HTML est identique. Moins de 3 mois : pas de chiffre sur 12 mois.
    var an = null, anBy = {}, anTot = 0;
    if (opts.annuel && opts.annuel.mois >= 3) {
      var ra = V2.caParGeneriqueur(opts.annuel.ventes || [], opts.type);
      var k12 = 12 / opts.annuel.mois;
      ra.rows.forEach(function (o) { anBy[o.lab] = o.ca * k12; });
      anTot = ra.total * k12; an = opts.annuel;
    }
    var maxRows = opts.max || 12;
    var shown = r.rows.slice(0, maxRows);
    var maxCa = shown[0].ca || 1;
    var body = shown.map(function (o, i) {
      var pct = r.total ? Math.round(o.ca / r.total * 100) : 0;
      var w = Math.max(3, Math.round(o.ca / maxCa * 100));
      var col = BAR[i % BAR.length];
      return '<div class="gnq-row">' +
        '<span class="gnq-lab" title="' + esc(o.lab) + '">' + esc(cleanLab(o.lab)) + '</span>' +
        '<span class="gnq-bar"><i style="width:' + w + '%;background:' + col + '"></i></span>' +
        '<span class="gnq-val">' + eur(o.ca) + '<small>' + pct + '%</small>' +
          (an ? '<span class="gnq-an">≈ ' + eur(anBy[o.lab] || 0) + '/an</span>' : '') + '</span>' +
      '</div>';
    }).join('');
    var extra = r.rows.length > maxRows ? ('<div class="gnq-empty">+ ' + (r.rows.length - maxRows) + ' autres ' + qui + 's</div>') : '';
    return '<div class="gnq-card' + (an ? ' gnq-12' : '') + '">' +
      '<div class="gnq-h"><span class="gnq-t">' + esc(opts.title || 'CA par génériqueur') + '</span>' +
        '<span class="gnq-tot">' + eur(r.total) + ' · ' + r.rows.length + ' ' + qui + (r.rows.length > 1 ? 's' : '') + '</span></div>' +
      (an ? '<div class="gnq-note">Sur 12 mois : moyenne de ses ' + an.mois + ' mois × 12, soit <b>≈ ' + eur(anTot) + '/an</b>.</div>' : '') +
      body + extra +
    '</div>';
  };
})();
