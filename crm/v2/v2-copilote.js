/* ═══════════════════════════════════════════════════════════════════
   COPILOTE — le cerveau du copilote pharmacien (onglet global).
   Socle : croise les FEEDS de données (chaque source = 1 feed, robot → fichier
   → app), lus de façon unifiée via V2.market / V2.zone / V2.reco.
   Page : surface unique qui incarne le projet global — aujourd'hui le MARCHÉ
   France (feed #1, Medic'AM), croisé à TES ventes réseau. Les feeds suivants
   (ruptures, potentiel de zone) viendront s'y brancher sans casser l'écran.
   100% client, hors-ligne, zéro dépendance.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};

  // ── SOCLE · axe PRODUIT · marché France (indicatif) ──
  V2.market = function (cip) {
    var A = window.AMELI_AVG;
    if (!A || !A.data) return null;
    var v = A.data[String(cip)];
    if (v == null) return null;
    return { avgYear: v, avgMonth: Math.round(v / 12 * 10) / 10, meta: A.meta };
  };
  V2.marketMeta = function () { return (window.AMELI_AVG && window.AMELI_AVG.meta) || null; };
  // ── SOCLE · feed #2 · ruptures/tensions ANSM (par CIP13) ──
  V2.rupture = function (cip) {
    var R = window.RUPTURES;
    if (!R || !R.data) return null;
    return R.data[String(cip)] || null;   // { d: DCI, dt: date signalement } ou null
  };
  // ── SOCLE · feed #3 · potentiel de zone (par officine) ──
  V2.zone = function (pid) {
    var Z = window.ZONE;
    if (!Z || !Z.data) return null;
    return Z.data[String(pid)] || null;   // { c: commune, cc, dep, pop } ou null
  };
  // ── SOCLE · stock Intégral disponible par CIP13 (tous établissements confondus) ──
  V2.stock = function (cip) { var S = window.STOCK_IP; return (S && S.data && S.data[String(cip)]) || 0; };
  V2.reco = V2.reco || function () { return null; };   // feed à venir

  // ── helpers ──
  function esc(s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var ICO = window.ICO || function () { return ''; };
  function num(n) { return V2.fmtNum ? V2.fmtNum(n) : String(n); }
  function eur(n) { return V2.fmtEur ? V2.fmtEur(n) : (Math.round(n) + ' €'); }
  function cap(s) { s = (s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function PS() { return window.PROD_STATS || []; }
  // Règles Will : uniquement des PRINCEPS (pas de génériques/NR/biosim) + seulement
  // ce qu'Intégral a en stock (tous établissements confondus).
  function isPr(f) { return f === 'pr_low' || f === 'pr_mid' || f === 'pr_high'; }
  function stk(cip) { return V2.stock ? V2.stock(cip) : 0; }
  function eligible(r) { return isPr(r.f) && stk(r.c) > 0; }
  function stockCell(cip) { var s = stk(cip); return '<td class="num mono co-stk">' + (s > 0 ? num(s) : '—') + '</td>'; }

  var FAM = { pr_low: 'Petits prix', pr_mid: 'Interméd.', pr_high: 'Chers', nr: 'NR', gen: 'Génér.', biosim: 'Biosim.' };

  function totalPharma() {
    var s = {};
    (V2.sales || []).forEach(function (x) { if (x.qte > 0) s[String(x.pharmacyId)] = 1; });
    var n = Object.keys(s).length;
    return n || (V2.pharmacies || []).length || 1;
  }
  function orderedCips(pid) {
    var s = {};
    (V2.sales || []).forEach(function (x) { if (String(x.pharmacyId) === String(pid) && x.qte > 0) s[String(x.artCode)] = 1; });
    return s;
  }
  function netCell(r) {
    var showAb = r.f !== 'gen' && r.rpct > 0;
    return '<td class="num mono co-net">' + (r.net > 0 ? eur(r.net) : '—') + '</td>' +
      '<td class="num">' + (showAb ? '<span class="co-ab">−' + String(r.rpct).replace('.', ',') + '%</span>' : '<span class="co-dash">—</span>') + '</td>';
  }

  // gros marchés France sous-exploités par TON réseau (marché France élevé × faible pénétration)
  function bigMarkets(limit) {
    var tot = totalPharma(), out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;
      var m = V2.market(r.c); if (!m) return;
      var pen = Math.min(1, (r.n || 0) / tot);
      out.push({ r: r, fr: m.avgYear, pen: pen, opp: m.avgYear * (1 - pen) });
    });
    out.sort(function (a, b) { return b.opp - a.opp; });
    return out.slice(0, limit || 20);
  }
  // par officine : gros marchés France qu'elle ne commande pas (= ce qu'elle laisse passer)
  function officineGaps(pid, limit) {
    var owned = orderedCips(pid), out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;
      if (owned[String(r.c)]) return;
      var m = V2.market(r.c); if (!m || m.avgYear < 12) return;
      out.push({ r: r, fr: m.avgYear });
    });
    out.sort(function (a, b) { return b.fr - a.fr; });
    return out.slice(0, limit || 25);
  }

  // ── INTELLIGENCE DE TOURNÉE (croisement produit × officine × zone) ──
  var _topCips = null;
  function topMarketCips(n) {
    if (_topCips) return _topCips;
    var arr = [];
    PS().forEach(function (r) { if (!eligible(r)) return; var m = V2.market(r.c); if (m) arr.push({ c: String(r.c), fr: m.avgYear }); });
    arr.sort(function (a, b) { return b.fr - a.fr; });
    _topCips = arr.slice(0, n || 150).map(function (x) { return x.c; });
    return _topCips;
  }
  // pour chaque officine : nb de gros marchés France non commandés (= à gagner) + zone
  function tournee(dep) {
    var top = topMarketCips(150);
    var out = [];
    (V2.pharmacies || []).forEach(function (p) {
      var z = V2.zone ? V2.zone(p.id) : null;
      if (dep && (!z || z.dep !== dep)) return;
      var owned = orderedCips(p.id);
      var miss = 0;
      for (var i = 0; i < top.length; i++) { if (!owned[top[i]]) miss++; }
      if (miss <= 0) return;
      var pop = z ? z.pop : 0;
      out.push({ p: p, miss: miss, z: z, score: miss * 1000 + Math.min(400, pop / 1000) });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  function tourneeDeps() {
    var d = {};
    (V2.pharmacies || []).forEach(function (p) { var z = V2.zone ? V2.zone(p.id) : null; if (z && z.dep) d[z.dep] = (d[z.dep] || 0) + 1; });
    return Object.keys(d).sort();
  }
  var selDep = '';
  V2.copiloteSelDep = function (d) { selDep = d; if (V2.render) V2.render(); };

  // produits que le réseau commande ET en tension ANSM (à anticiper / alternative molécule)
  function reseauRuptures(limit) {
    if (!window.RUPTURES) return [];
    var out = [];
    PS().forEach(function (r) {
      if (!eligible(r)) return;
      var rp = V2.rupture(r.c);
      if (rp && (r.n || 0) > 0) out.push({ r: r, rp: rp });
    });
    out.sort(function (a, b) { return (b.r.n || 0) - (a.r.n || 0); });
    return out.slice(0, limit || 15);
  }
  function rupRow(o) {
    var r = o.r, rp = o.rp;
    return '<tr>' +
      '<td><div class="co-prod">' + esc(cap(r.d)) + '</div><div class="co-cip">' + esc(r.c) + '</div></td>' +
      '<td><span class="co-fam co-fam-mol">' + esc(cap((rp.d || '—').toLowerCase())) + '</span></td>' +
      '<td class="num mono">' + num(r.n || 0) + '</td>' +
      '<td class="num co-cip">' + esc(rp.dt || '—') + '</td>' +
      netCell(r) +
      stockCell(r.c) +
      '<td class="num"><button class="v2-btn v2-btn-ghost" style="padding:6px 12px" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir</button></td>' +
      '</tr>';
  }

  var selPid = null;
  function pharmaOptions() {
    var phs = (V2.pharmacies || []).slice();
    // tri par CA décroissant (proxy activité) pour un défaut pertinent
    var caOf = {};
    (V2.sales || []).forEach(function (s) { caOf[String(s.pharmacyId)] = (caOf[String(s.pharmacyId)] || 0) + (s.mntNetHt || 0); });
    phs.sort(function (a, b) { return (caOf[String(b.id)] || 0) - (caOf[String(a.id)] || 0); });
    return phs;
  }
  V2.copiloteSelPharma = function (id) { selPid = id; if (V2.render) V2.render(); };

  // ── styles ──
  function injectCss() {
    if (document.getElementById('v2-copilote-css')) return;
    var st = document.createElement('style'); st.id = 'v2-copilote-css';
    st.textContent = [
      '.co-hero{position:relative;margin-bottom:26px}',
      '.co-hero h1{font-size:clamp(26px,4.6vw,38px);font-weight:800;letter-spacing:-.025em;margin:0 0 8px}',
      '.co-hero h1 .ac{color:var(--ip-blue)}',
      '.co-hero p{color:var(--muted);font-size:15.5px;margin:0;max-width:64ch}',
      '.co-feeds{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}',
      '.co-feed{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);font-size:13px;font-weight:600;color:var(--muted)}',
      '.co-feed .d{width:8px;height:8px;border-radius:50%;background:var(--muted-2)}',
      '.co-feed.on{color:var(--ink);border-color:color-mix(in srgb,var(--c-opp) 40%,var(--line))}',
      '.co-feed.on .d{background:var(--c-opp);box-shadow:0 0 0 3px color-mix(in srgb,var(--c-opp) 18%,transparent)}',
      '.co-feed.on.warn .d{background:var(--c-amber);box-shadow:0 0 0 3px color-mix(in srgb,var(--c-amber) 18%,transparent)}',
      '.co-feed.on.info .d{background:var(--ip-blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--ip-blue) 18%,transparent)}',
      '.co-zone{display:flex;flex-wrap:wrap;align-items:center;gap:16px;padding:11px 16px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--ip-blue) 4%,var(--card-2));font-size:13.5px;color:var(--ink)}',
      '.co-zone-i{display:inline-flex;align-items:center;gap:7px}.co-zone-i svg{color:var(--ip-blue)}.co-zone-i b{font-family:var(--mono);font-weight:800}',
      '.co-zone-src{margin-left:auto;font-size:11px;color:var(--muted-2)}',
      '.co-table td.co-rank{font-family:var(--mono);font-weight:700;color:var(--muted-2);width:40px;text-align:center}',
      '.co-opp{display:inline-block;font-family:var(--mono);font-weight:800;color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 9%,var(--card));padding:2px 10px;border-radius:var(--r-pill);white-space:nowrap}',
      '.co-saison{display:flex;flex-wrap:wrap;gap:10px;padding:16px}',
      '.co-sais-i{display:inline-flex;align-items:center;gap:9px;padding:9px 14px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card-2)}',
      '.co-sais-up{font-family:var(--mono);font-weight:800;color:var(--c-opp);font-size:13px}',
      '.co-sais-l{font-size:13.5px;font-weight:600;color:var(--ink)}',
      '.co-fam-mol{color:var(--ip-blue-d,#0034A0);background:color-mix(in srgb,var(--ip-blue) 8%,var(--card));border-color:color-mix(in srgb,var(--ip-blue) 20%,var(--line))}',
      '.co-pill-warn{color:var(--c-amber-txt,#9A5B12) !important;background:#FBF1E2 !important}',
      '.co-table td.co-stk{color:var(--c-opp);font-weight:700}',
      '.co-tension{display:inline-block;font-size:10.5px;font-weight:700;color:var(--c-amber-txt,#9A5B12);background:#FBF1E2;border:1px solid #F0E2C6;padding:1px 7px;border-radius:var(--r-pill);margin-left:8px;vertical-align:middle;white-space:nowrap}',
      '.co-sec{margin-top:30px}',
      '.co-sec-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:4px}',
      '.co-sec-h h2{font-size:20px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '.co-sec-h .co-pill{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 9%,var(--card));padding:3px 9px;border-radius:var(--r-pill)}',
      '.co-sub{color:var(--muted);font-size:13.5px;margin:0 0 14px;max-width:74ch}',
      '.co-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden;box-shadow:var(--sh-1)}',
      '.co-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--card-2)}',
      '.co-toolbar label{font-size:12.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}',
      '.co-select{font:inherit;font-size:14.5px;font-weight:600;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:var(--r-btn);padding:9px 12px;min-width:230px;max-width:100%;cursor:pointer}',
      '.co-scroll{overflow-x:auto}',
      '.co-table{border-collapse:collapse;width:100%;min-width:720px;font-size:14px}',
      '.co-table thead th{position:sticky;top:0;background:var(--card);text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:11px 14px;border-bottom:1.5px solid var(--line);white-space:nowrap;z-index:1}',
      '.co-table th.num,.co-table td.num{text-align:right}',
      '.co-table tbody td{padding:10px 14px;border-bottom:1px solid var(--line-2);vertical-align:middle}',
      '.co-table tbody tr:hover{background:var(--card-2)}',
      '.co-table .co-prod{font-weight:600;color:var(--ink)}',
      '.co-table .co-cip{font-family:var(--mono);font-size:12px;color:var(--muted-2)}',
      '.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}',
      '.co-fr{font-family:var(--mono);font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}',
      '.co-fr small{font-weight:500;color:var(--muted-2)}',
      '.co-net{font-weight:800;color:var(--ip-blue)}',
      '.co-ab{color:var(--c-opp);font-weight:700}.co-dash{color:var(--muted-2)}',
      '.co-fam{display:inline-block;font-size:11px;font-weight:700;color:var(--muted);background:var(--card-2);border:1px solid var(--line);padding:2px 8px;border-radius:var(--r-pill)}',
      '.co-pen{display:inline-flex;align-items:center;gap:7px}',
      '.co-bar{width:52px;height:6px;border-radius:3px;background:var(--surf-sunken,#eef2f8);overflow:hidden}',
      '.co-bar i{display:block;height:100%;background:var(--ip-blue);border-radius:3px}',
      '.co-foot{padding:11px 16px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);background:var(--card-2)}',
      '.co-empty{padding:26px;text-align:center;color:var(--muted)}',
      '@media(max-width:640px){.co-select{min-width:0;width:100%}}'
    ].join('');
    document.head.appendChild(st);
  }

  function feedStrip(nbTension) {
    var m = V2.marketMeta();
    return '<div class="co-feeds">' +
      '<span class="co-feed on"><span class="d"></span>Marché France' + (m ? ' · ' + esc(m.periode) : '') + '</span>' +
      (window.RUPTURES
        ? '<span class="co-feed on warn"><span class="d"></span>Ruptures ANSM · ' + num(nbTension || 0) + ' produits en tension</span>'
        : '<span class="co-feed"><span class="d"></span>Ruptures ANSM · bientôt</span>') +
      (window.ZONE
        ? '<span class="co-feed on info"><span class="d"></span>Potentiel de zone · ' + num((window.ZONE.meta || {}).n || 0) + ' officines</span>'
        : '<span class="co-feed"><span class="d"></span>Potentiel de zone · bientôt</span>') +
      '</div>';
  }
  function tensionBadge(cip) {
    var rp = V2.rupture ? V2.rupture(cip) : null;
    if (!rp) return '';
    return ' <span class="co-tension" title="Signalé en rupture/risque de rupture à l\'ANSM' + (rp.dt ? ' · dernier signalement ' + esc(rp.dt) : '') + (rp.d ? ' · ' + esc(rp.d) : '') + '">⚠ tension</span>';
  }

  function marketRow(o) {
    var r = o.r, penPct = Math.round(o.pen * 100);
    return '<tr>' +
      '<td><div class="co-prod">' + esc(cap(r.d)) + tensionBadge(r.c) + '</div><div class="co-cip">' + esc(r.c) + '</div></td>' +
      '<td><span class="co-fam">' + (FAM[r.f] || r.f) + '</span></td>' +
      '<td class="num"><span class="co-fr">~' + num(o.fr) + '<small> /an</small></span></td>' +
      '<td class="num"><span class="co-pen"><span class="mono">' + num(r.n || 0) + '</span><span class="co-bar"><i style="width:' + penPct + '%"></i></span></span></td>' +
      netCell(r) +
      stockCell(r.c) +
      '<td class="num"><button class="v2-btn v2-btn-ghost" style="padding:6px 12px" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir</button></td>' +
      '</tr>';
  }
  function gapRow(o) {
    var r = o.r;
    return '<tr>' +
      '<td><div class="co-prod">' + esc(cap(r.d)) + tensionBadge(r.c) + '</div><div class="co-cip">' + esc(r.c) + '</div></td>' +
      '<td><span class="co-fam">' + (FAM[r.f] || r.f) + '</span></td>' +
      '<td class="num"><span class="co-fr">~' + num(o.fr) + '<small> /an</small></span></td>' +
      netCell(r) +
      stockCell(r.c) +
      '<td class="num"><button class="v2-btn v2-btn-ghost" style="padding:6px 12px" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir</button></td>' +
      '</tr>';
  }

  function tourRow(o, i) {
    var p = o.p, z = o.z;
    return '<tr>' +
      '<td class="num co-rank">' + (i + 1) + '</td>' +
      '<td><div class="co-prod">' + esc(p.name) + '</div><div class="co-cip">' + (z ? esc(z.c) + ' (' + esc(z.dep) + ')' : 'zone inconnue') + '</div></td>' +
      '<td class="num mono">' + (z && z.pop ? num(z.pop) : '—') + '</td>' +
      '<td class="num"><span class="co-opp">' + o.miss + ' à pousser</span></td>' +
      '<td class="num"><button class="v2-btn v2-btn-primary" style="padding:6px 13px" onclick="V2.go(\'pharma\',\'' + esc(String(p.id)) + '\')">Visite</button></td>' +
      '</tr>';
  }

  V2.pages.copilote = {
    render: function (root) {
      injectCss();
      var hasData = !!(window.AMELI_AVG && window.PROD_STATS && (V2.sales || []).length);
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';

      if (!hasData) {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="co-hero"><h1>Copilote</h1><p>Chargement des données réseau…</p></div></div>';
        if (V2.loadFiles) V2.loadFiles(['bench']).then(function () { V2.render(); });
        return;
      }

      var nbTension = 0;
      if (window.RUPTURES) PS().forEach(function (r) { if (V2.rupture(r.c)) nbTension++; });

      // Section 1 — gros marchés France sous-exploités
      var big = bigMarkets(18);
      var t1 = '<div class="co-card"><div class="co-scroll"><table class="co-table"><thead><tr>' +
        '<th>Produit</th><th>Famille</th><th class="num">Marché France</th><th class="num">Ton réseau</th>' +
        '<th class="num">Net remisé</th><th class="num">Abandon</th><th class="num">Stock IP</th><th class="num"></th>' +
        '</tr></thead><tbody>' + big.map(marketRow).join('') + '</tbody></table></div>' +
        '<div class="co-foot">« Ton réseau » = nombre de tes officines qui commandent déjà ce produit (barre = couverture). Marché France Ameli, à titre indicatif.</div></div>';

      // Section ruptures réseau — produits commandés par le réseau et en tension ANSM
      var rupRes = reseauRuptures(15);
      var rupSec = rupRes.length ? '<section class="co-sec">' +
        '<div class="co-sec-h"><h2>Ruptures dans ton réseau</h2><span class="co-pill co-pill-warn">' + rupRes.length + ' produits</span></div>' +
        '<p class="co-sub">Produits que tes officines commandent, actuellement signalés en rupture / risque de rupture à l\'ANSM. Anticipe le réassort, ou propose la molécule (DCI) comme alternative.</p>' +
        '<div class="co-card"><div class="co-scroll"><table class="co-table"><thead><tr>' +
        '<th>Produit</th><th>Molécule (DCI)</th><th class="num">Ton réseau</th><th class="num">Signalé le</th><th class="num">Net remisé</th><th class="num">Abandon</th><th class="num">Stock IP</th><th class="num"></th>' +
        '</tr></thead><tbody>' + rupRes.map(rupRow).join('') + '</tbody></table></div>' +
        '<div class="co-foot">« Ton réseau » = nombre de tes officines qui commandent ce produit. Signalements ANSM (rupture / risque).</div></div></section>' : '';

      // Section 2 — par officine
      var phs = pharmaOptions();
      if (!selPid && phs.length) selPid = String(phs[0].id);
      var selName = '';
      var opts = phs.map(function (p) {
        var s = String(p.id) === String(selPid); if (s) selName = p.name;
        return '<option value="' + esc(String(p.id)) + '"' + (s ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
      var gaps = selPid ? officineGaps(selPid, 25) : [];
      var t2body = gaps.length
        ? '<div class="co-scroll"><table class="co-table"><thead><tr>' +
          '<th>Produit</th><th>Famille</th><th class="num">Marché France</th><th class="num">Net remisé</th><th class="num">Abandon</th><th class="num">Stock IP</th><th class="num"></th>' +
          '</tr></thead><tbody>' + gaps.map(gapRow).join('') + '</tbody></table></div>'
        : '<div class="co-empty">Cette officine commande déjà les plus gros marchés France. 👍</div>';
      var z = selPid && V2.zone ? V2.zone(selPid) : null;
      var zoneStrip = z ? '<div class="co-zone">' +
        '<span class="co-zone-i">' + ICO('pharma', 14) + esc(z.c) + (z.dep ? ' (' + esc(z.dep) + ')' : '') + '</span>' +
        '<span class="co-zone-i">Population de la commune <b>' + num(z.pop) + '</b> hab.</span>' +
        '<span class="co-zone-src">zone · geo.api.gouv.fr</span>' +
        '</div>' : '';
      var t2 = '<div class="co-card">' +
        '<div class="co-toolbar"><label>Officine</label><select class="co-select" onchange="V2.copiloteSelPharma(this.value)">' + opts + '</select></div>' +
        zoneStrip +
        t2body +
        '<div class="co-foot">Produits à fort marché France que <b>' + esc(selName) + '</b> ne commande pas encore — à présenter à la prochaine visite.</div></div>';

      // Section « Ma tournée » — intelligence de prospection (où concentrer les visites)
      var tour = tournee(selDep);
      var deps = tourneeDeps();
      var depOpts = '<option value="">Tous secteurs</option>' + deps.map(function (d) { return '<option value="' + d + '"' + (d === selDep ? ' selected' : '') + '>Dép. ' + d + '</option>'; }).join('');
      var tourTop = tour.slice(0, 25);
      var tourSec = '<section class="co-sec">' +
        '<div class="co-sec-h"><h2>Ma tournée · où concentrer les visites</h2><span class="co-pill">' + tour.length + ' officines</span></div>' +
        '<p class="co-sub">Classées par ce que tu as à y gagner : les gros marchés France qu\'elles ne commandent pas encore, pondéré par la taille de leur zone. Filtre par département pour préparer une journée.</p>' +
        '<div class="co-card">' +
          '<div class="co-toolbar"><label>Secteur</label><select class="co-select" onchange="V2.copiloteSelDep(this.value)">' + depOpts + '</select></div>' +
          '<div class="co-scroll"><table class="co-table"><thead><tr><th class="num">#</th><th>Officine</th><th class="num">Zone (hab.)</th><th class="num">À gagner</th><th class="num"></th></tr></thead><tbody>' +
          (tourTop.length ? tourTop.map(tourRow).join('') : '<tr><td colspan="5" class="co-empty">Aucune opportunité dans ce secteur.</td></tr>') +
          '</tbody></table></div>' +
          '<div class="co-foot">Priorité = gros marchés France non commandés × taille de la zone. « À gagner » = combien de ces marchés (sur les 150 plus gros) l\'officine laisse passer.</div>' +
        '</div></section>';

      // Saisonnalité — classes thérapeutiques qui montent le mois en cours
      var saisonSec = '';
      if (window.SAISON && window.SAISON.data) {
        var mo = (new Date()).getMonth() + 1;
        var moLabel = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][mo];
        var sarr = [];
        for (var k in window.SAISON.data) { var sd = window.SAISON.data[k]; var sv = (sd.idx && sd.idx[mo - 1]) || 100; if (sv > 105) sarr.push({ l: sd.l, v: sv }); }
        sarr.sort(function (a, b) { return b.v - a.v; });
        var stop = sarr.slice(0, 8);
        if (stop.length) {
          saisonSec = '<section class="co-sec"><div class="co-sec-h"><h2>Saisonnalité · à anticiper en ' + moLabel + '</h2><span class="co-pill">' + stop.length + ' familles</span></div>' +
            '<p class="co-sub">Classes thérapeutiques qui montent ce mois-ci en France (vs leur moyenne annuelle, Medic\'AM) — à mettre en avant et à ne pas laisser tomber en rupture.</p>' +
            '<div class="co-card"><div class="co-saison">' +
            stop.map(function (s) { return '<div class="co-sais-i"><span class="co-sais-up">+' + (s.v - 100) + '%</span><span class="co-sais-l">' + esc(cap(s.l.toLowerCase())) + '</span></div>'; }).join('') +
            '</div><div class="co-foot">Indice mensuel Medic\'AM : 100 = moyenne annuelle. « +34 % » = ce mois-ci la classe se vend 34 % au-dessus de sa moyenne.</div></div></section>';
        }
      }

      root.innerHTML = top +
        '<div class="v2-wrap">' +
          '<div class="co-hero">' +
            '<h1>Copilote <span class="ac">·</span> le cerveau de ta tournée</h1>' +
            '<p>Ici on croise le <b>marché réel France</b> (ce qu\'une pharmacie moyenne vend) avec <b>tes ventes réseau</b>, pour repérer où pousser quoi. On ne montre que les <b>princeps en stock Intégral</b> (tous établissements confondus).</p>' +
            feedStrip(nbTension) +
          '</div>' +
          tourSec +
          saisonSec +
          '<section class="co-sec">' +
            '<div class="co-sec-h"><h2>Les gros marchés France à sécuriser</h2><span class="co-pill">' + big.length + ' produits</span></div>' +
            '<p class="co-sub">Produits que la France consomme beaucoup mais que peu de tes officines commandent encore — les meilleures opportunités de volume, catalogue Intégral à l\'appui.</p>' +
            t1 +
          '</section>' +
          rupSec +
          '<section class="co-sec">' +
            '<div class="co-sec-h"><h2>Par officine · ce qu\'elle laisse passer</h2></div>' +
            '<p class="co-sub">Choisis une officine : voici les gros marchés France qu\'elle ne commande pas encore. Ta liste d\'arguments pour la prochaine visite.</p>' +
            t2 +
          '</section>' +
        '</div>';

      // motion léger (count-up des chiffres marché si dispo, RM-safe)
      try {
        if (V2.motion && V2.motion.stagger) V2.motion.stagger(root.querySelectorAll('.co-sec'), { step: 60, y: 8 });
      } catch (e) {}
    }
  };
})();
