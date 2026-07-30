/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Appro Intégral (V2.pages.appro)
   Outil pour l'équipe ACHATS/APPRO d'Intégral (interne) : voir ce qui
   monte (demande réseau × marché France), anticiper (saison à venir,
   nouveautés, ruptures à sécuriser), et négocier les labos (volume +
   croissance par génériqueur = levier). 100% sur les flux déjà en place,
   aucune dépendance externe.
   Flux : PROD_STATS (réseau), TENDANCE/MOMENTUM/SAISON/NOUVEAUTES (Medic'AM
   + BDPM), AMELI_AVG (marché France), STOCK_IP, RUPTURES, GENERIQUEURS.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var fmt = function (n) { return V2.fmtNum ? V2.fmtNum(n) : String(Math.round(n || 0)); };
  var cap = function (s) { s = String(s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function tend(c) { return V2.tendance ? V2.tendance(c) : (window.TENDANCE && window.TENDANCE.data ? window.TENDANCE.data[c] : null); }
  function mom(c) { return V2.momentum ? V2.momentum(c) : null; }
  function stock(c) { return V2.stock ? V2.stock(c) : 0; }
  function rupt(c) { return V2.rupture ? V2.rupture(c) : null; }
  function marketFr(c) { return (window.AMELI_AVG && window.AMELI_AVG.data && window.AMELI_AVG.data[String(c)]) || 0; }
  function pctHtml(v) { if (v == null) return '<span class="ap-flat">—</span>'; var s = Math.round(v); return '<span class="' + (s > 0 ? 'ap-up' : s < 0 ? 'ap-down' : 'ap-flat') + '">' + (s > 0 ? '▲ +' : s < 0 ? '▼ ' : '') + s + ' %</span>'; }

  // ── Section 1 : ce qui MONTE (croissance marché × présence réseau) ──
  function rising() {
    var P = window.PROD_STATS || [], out = [];
    for (var i = 0; i < P.length; i++) {
      var r = P[i], g = tend(r.c);
      if (g == null || g < 15 || (r.n || 0) < 20) continue;   // rising & présent dans ≥20 officines réseau
      out.push({ c: r.c, d: r.d, g: g, m: mom(r.c), n: r.n, ca: r.ca || 0, mk: marketFr(r.c), st: stock(r.c), ru: !!rupt(r.c) });
    }
    out.sort(function (a, b) { return b.g - a.g; });
    return out.slice(0, 25);
  }

  // ── Section 2a : ruptures à sécuriser (tension ANSM × demande réseau) ──
  function ruptToSecure() {
    var P = window.PROD_STATS || [], out = [];
    for (var i = 0; i < P.length; i++) {
      var r = P[i], ru = rupt(r.c); if (!ru) continue;
      out.push({ c: r.c, d: r.d, n: r.n || 0, st: stock(r.c), dci: ru.d || '' });
    }
    out.sort(function (a, b) { return b.n - a.n; });   // les plus achetés par le réseau d'abord
    return out.slice(0, 12);
  }

  // ── Section 2b : nouveautés (AMM récente) ──
  function nouveautes() {
    var N = (window.NOUVEAUTES && window.NOUVEAUTES.data) || {}, out = [];
    Object.keys(N).forEach(function (c) { var o = N[c]; if (o && o.n) out.push({ c: c, n: o.n, labo: o.labo || '', amm: o.amm || '' }); });
    out.sort(function (a, b) { return (b.amm || '').localeCompare(a.amm || ''); });   // AMM la plus récente d'abord
    return out.slice(0, 12);
  }

  // ── Section 2c : saison qui arrive (classes ATC2 qui montent le mois prochain) ──
  function saisonNext() {
    var S = (window.SAISON && window.SAISON.data) || {};
    var now = new Date().getMonth(), next = (now + 1) % 12, out = [];
    Object.keys(S).forEach(function (k) {
      var o = S[k]; if (!o || !o.idx) return;
      var vNext = o.idx[next], vNow = o.idx[now];
      if (vNext >= 105) out.push({ code: k, l: o.l || k, now: vNow, next: vNext, delta: vNext - vNow });   // vrai pic au-dessus de la moyenne annuelle
    });
    out.sort(function (a, b) { return b.next - a.next; });
    return { rows: out.slice(0, 8), next: next };
  }

  // ── Section 3 : négo labos — VRAI volume réseau par génériqueur (WML_SALES) ──
  function negoLabos() {
    var S = window.WML_SALES, G = window.GENERIQUEURS || {};
    if (!S) return [];
    var P = window.PROD_STATS || [], ps = {};
    for (var k = 0; k < P.length; k++) ps[String(P[k].c)] = P[k];
    var by = {}, totCa = 0;
    for (var i = 0; i < S.length; i++) {
      var r = S[i], q = r[4] || 0; if (q <= 0) continue;
      var c = String(r[3]), lab = G[c]; if (!lab) continue;
      var o = by[lab] || (by[lab] = { lab: lab, ca: 0, q: 0, cips: {} });
      o.ca += (r[6] || 0); o.q += q; o.cips[c] = (o.cips[c] || 0) + q; totCa += (r[6] || 0);
    }
    var out = Object.keys(by).map(function (lab) {
      var o = by[lab], cips = Object.keys(o.cips);
      var tops = cips.map(function (c) { return { c: c, q: o.cips[c] }; })
        .sort(function (a, b) { return b.q - a.q; }).slice(0, 3)
        .map(function (t) { return ps[t.c] ? ps[t.c].d : t.c; });
      var gs = 0, gn = 0; cips.forEach(function (c) { var g = tend(c); if (g != null) { gs += g; gn++; } });
      return { lab: lab, ca: o.ca, q: o.q, nref: cips.length, g: gn ? gs / gn : null, tops: tops, pct: totCa ? Math.round(o.ca / totCa * 100) : 0 };
    }).sort(function (a, b) { return b.ca - a.ca; });
    return out.slice(0, 12);
  }

  // ═══ COCKPIT RÉASSORT : croise WML_SALES (vitesse réseau) × STOCK_IP (couverture) ═══
  var MINVEL = 5;      // seuil de bruit : au moins 5 bts/mois réseau pour être « mouvant »
  var CIBLE = 21, CIBLE_TENSION = 30;   // couverture cible en jours (réappro inclus) — relevée si tension/hausse
  var _cipIdx = null, _cipIdxRef = null;

  // Index par CIP : demande mensuelle réseau (6 mois) + stock plateforme → vitesse, couverture, qté conseillée.
  // Construit une seule fois et mis en cache (pattern salesByPid de v2-audit.js, transposé cip13).
  function cipIndex() {
    var S = window.WML_SALES;
    if (!S) return {};
    if (_cipIdx && _cipIdxRef === S) return _cipIdx;
    var P = window.PROD_STATS || [], ps = {};
    for (var i = 0; i < P.length; i++) ps[String(P[i].c)] = P[i];
    var stk = (window.STOCK_IP && window.STOCK_IP.data) || {};
    var dem = {};
    for (var j = 0; j < S.length; j++) {
      var r = S[j], q = r[4] || 0, m = r[1];
      if (q <= 0 || m < 1 || m > 6) continue;
      var c = String(r[3]), a = dem[c] || (dem[c] = [0, 0, 0, 0, 0, 0]);
      a[m - 1] += q;
    }
    var idx = {};
    // P1 (audit) : inclure aussi les fast-movers EN RUPTURE plateforme (vendus mais stock 0 = absents de STOCK_IP).
    var keys = {};
    Object.keys(stk).forEach(function (c) { keys[c] = 1; });
    Object.keys(dem).forEach(function (c) { var a = dem[c]; if ((a[0] + a[1] + a[2] + a[3] + a[4] + a[5]) / 6 >= MINVEL) keys[c] = 1; });
    Object.keys(keys).forEach(function (c) {
      var a = dem[c], tot = a ? (a[0] + a[1] + a[2] + a[3] + a[4] + a[5]) : 0;
      var vM = tot / 6, st = Math.max(0, stk[c] || 0), vD = vM / 30;   // stock borné à 0 (jamais de couverture négative)
      var cov = vD > 0 ? st / vD : (st > 0 ? 9999 : 0);
      var p = ps[c];
      var isRupt = !!rupt(c), tg = tend(c);
      var cibleJ = (isRupt || (tg != null && tg > 0)) ? CIBLE_TENSION : CIBLE;
      var qcmd = Math.max(0, Math.round(cibleJ * vD - st));
      idx[c] = { c: c, d: p ? p.d : c, vM: vM, st: st, cov: cov, qcmd: qcmd,
        ppht: p ? (p.ppht || 0) : 0, stale: p ? p.stale : 0, rupt: isRupt, f: p ? p.f : '' };
    });
    _cipIdx = idx; _cipIdxRef = S;
    return idx;
  }

  // Santé du stock : compteurs de tête (tension / à commander / dormants / capital immobilisé).
  function stockHealth() {
    var idx = cipIndex(), t = 0, a = 0, r = 0, cap = 0, ncmd = 0;
    Object.keys(idx).forEach(function (k) {
      var o = idx[k], mov = o.vM >= MINVEL;
      if (mov && o.cov < 7) t++; else if (mov && o.cov < 21) a++;
      if (o.st > 0 && (o.cov > 90 || o.stale === 1)) { r++; cap += o.st * o.ppht; }
      if (mov && o.qcmd > 0) ncmd++;
    });
    return { tension: t, acmd: a, ross: r, cap: cap, ncmd: ncmd };
  }

  // Réassort recommandé : produits mouvants à recommander, triés par urgence (couverture croissante).
  function reassort() {
    var idx = cipIndex(), out = [];
    Object.keys(idx).forEach(function (k) { var o = idx[k]; if (o.vM >= MINVEL && o.qcmd > 0 && o.cov <= 90) out.push(o); });
    out.sort(function (a, b) { return a.cov - b.cov; });
    return out.slice(0, 24);
  }

  // Rossignols : stock dormant (couverture > 90 j ou flag stale), trié par capital immobilisé.
  function rossignols() {
    var idx = cipIndex(), out = [];
    Object.keys(idx).forEach(function (k) { var o = idx[k]; if (o.st > 0 && (o.cov > 90 || o.stale === 1)) { o.cap = o.st * o.ppht; out.push(o); } });
    out.sort(function (a, b) { return b.cap - a.cap; });
    return out.slice(0, 16);
  }

  function covBadge(cov) {
    if (cov >= 9999) return '<span class="ap-cov ko">jamais vendu</span>';
    var cls = cov < 7 ? 'ko' : cov < 21 ? 'wa' : 'ok';
    var lab = cov > 90 ? '90+ j' : Math.round(cov) + ' j';
    return '<span class="ap-cov ' + cls + '">' + lab + '</span>';
  }

  // ═══ RADAR D'ANTICIPATION : événements marché datés (curés + auto à venir) ═══
  var TCOL = { remb: '#0050E6', gen: '#6D5AE6', bio: '#0E7C86', prix: '#C98A1A', sais: '#1E9E6A', rup: '#D5573B', vig: '#6B7280' };
  // Événements réels 2026-2027 (sourcés HAS/ANSM/Légifrance/Le Moniteur). À terme alimentés par robots.
  var EVENTS = [
    { y: 2026, m: 6, d: 15, t: 'remb', ti: 'Wegovy · Mounjaro remboursés', sub: 'demande qui explose, contingentement labo', reco: 'stock sécurité +30 %' },
    { y: 2026, m: 7, d: 20, t: 'gen', ti: 'Apixaban générique (Eliquis)', sub: 'bascule anticoagulant, très gros volume', reco: 'basculer vers les Gx' },
    { y: 2026, m: 6, d: 28, t: 'gen', ti: 'Dapagliflozin générique (Forxiga)', sub: 'falaise SGLT2, classe en forte croissance', reco: 'référencer les Gx' },
    { y: 2026, m: 4, d: 1, t: 'bio', ti: 'Ustekinumab biosimilaire (Stelara)', sub: 'substituable officine, bascule rapide', reco: 'référencer/négocier bio' },
    { y: 2026, m: 9, d: 1, t: 'prix', ti: 'PLFSS 2026 — vague de baisses de prix', sub: '1,4 Md€ : cardio, onco, inflammatoire, neuro', reco: 'alléger le surstock avant' },
    { y: 2026, m: 10, d: 14, t: 'sais', ti: 'Campagne vaccinale grippe / Covid', sub: 'pic d’achat vaccins oct.-nov.', reco: 'pré-stock avant l’ouverture' },
    { y: 2026, m: 11, d: 1, t: 'sais', ti: 'Saison hivernale ORL / antibiotiques', sub: 'amoxicilline, antipyrétiques — plan hivernal ANSM', reco: 'constituer le stock dès octobre' },
    { y: 2027, m: 1, d: 15, t: 'sais', ti: 'Pré-achat antihistaminiques', sub: 'allergies pollen de plus en plus précoces', reco: 'anticiper dès janvier' },
    { y: 2027, m: 3, d: 31, t: 'sais', ti: 'Clôture précommandes vaccins 27-28', sub: 'deadline d’achat vaccins grippe', reco: 'précommander à temps' },
    { y: 2030, m: 2, d: 1, t: 'vig', ti: 'Vyndaqel (tafamidis) — PAS de Gx avant ~2030', sub: 'exclusivité orpheline + accords labo jusqu’en 2031', reco: 'rester sur le princeps' }
  ];
  function evDays(ev) { var now = new Date(); var t = new Date(ev.y, ev.m - 1, ev.d); return Math.round((t - now) / 86400000); }
  function evZone(ev) { if (ev.t === 'vig') return 'surv'; var dd = evDays(ev); if (dd < -30) return null; if (dd < 8) return 'now'; if (dd < 46) return 'prep'; if (dd < 200) return 'surv'; return null; }   // audit #4 : masquer le vieux passé

  function radarSection(reaTop) {
    var zones = [['now', '#D5573B', 'Agir maintenant', 'à traiter cette semaine'], ['prep', '#C98A1A', 'Préparer', 'sous 30-45 jours'], ['surv', '#1E9E6A', 'Surveiller', '30 à 90 jours']];
    var byZone = { now: [], prep: [], surv: [] };
    EVENTS.forEach(function (ev) { var z = evZone(ev); if (z) byZone[z].push(ev); });
    var nowY = new Date().getFullYear();
    var live = (reaTop || []).slice(0, 4).map(function (o) {
      return '<div class="rev"><div class="rt"><span class="dot" style="background:#D5573B"></span>' + esc(cap(o.d)) + '</div>' +
        '<div class="rs">couverture ' + Math.round(o.cov) + ' j · ' + fmt(Math.round(o.vM)) + '/mois réseau</div>' +
        '<div class="rr">→ commander ~' + fmt(o.qcmd) + '</div></div>';
    }).join('');
    // Nouveaux groupes génériques détectés (robot BDPM, diff mensuel) → événement d'anticipation
    var gn = (_generData && _generData.newGeneric) ? _generData.newGeneric : [];
    var generHtml = gn.slice(0, 5).map(function (g) {
      return '<div class="rev"><div class="rt"><span class="dot" style="background:#6D5AE6"></span>Nouveau générique — ' + esc((g.lib || '').split(',')[0]) + '</div>' +
        '<div class="rs">groupe générique ouvert · ' + esc(g.since || '') + '</div><div class="rr">→ basculer les achats vers le Gx</div></div>';
    }).join('');
    live = generHtml + live;
    return '<div class="rad">' + zones.map(function (z) {
      var evs = byZone[z[0]].map(function (ev) {
        var dd = evDays(ev), lab = dd < 0 ? 'en cours' : (ev.d + ' ' + MOIS[ev.m - 1] + (ev.y > nowY ? ' ' + ev.y : ''));
        return '<div class="rev"><div class="rt"><span class="dot" style="background:' + (TCOL[ev.t] || '#6B7280') + '"></span>' + esc(ev.ti) + '</div>' +
          '<div class="rs">' + lab + ' · ' + esc(ev.sub) + '</div><div class="rr">→ ' + esc(ev.reco) + '</div></div>';
      }).join('');
      var body = (z[0] === 'now' ? live : '') + evs;
      if (!body) body = '<div class="ap-empty">—</div>';
      return '<div class="v2-card rzone" style="--z:' + z[1] + '"><div class="rzh"><span class="ring"></span><div><h3>' + z[2] + '</h3><small>' + z[3] + '</small></div></div>' + body + '</div>';
    }).join('') + '</div>';
  }

  // Ne re-render QUE si l'utilisateur est encore sur l'écran Appro (audit robustesse) :
  // les chargeurs différés (ensure*) résolvent en asynchrone ; sans ce garde, un flux qui
  // arrive après une navigation re-rendrait inutilement une autre page (flicker, travail perdu).
  function approRerender() {
    try { if (V2.route && V2.route.name === 'appro' && V2.render) V2.render(); } catch (e) {}
  }

  // ═══ STOCK PAR ÉTABLISSEMENT (7 sites) + rééquilibrage inter-sites — ETAB_PRICES (NR) ═══
  var _etabState = 0;   // 0 pas tenté · 1 en cours · 2 fini
  function ensureEtab() {
    if (window.ETAB_PRICES) { _etabState = 2; return; }
    if (_etabState) return;
    _etabState = 1;
    var s = document.createElement('script');
    s.src = 'etab-prices-data.js?v=' + (window.__APPRO_V || '20260729c'); s.async = false;
    s.onload = function () { _etabState = 2; approRerender(); };
    s.onerror = function () { _etabState = 2; };
    document.head.appendChild(s);
  }
  function siteStock() {
    var EP = window.ETAB_PRICES; if (!EP || !EP.etabs) return null;
    var out = EP.etabs.map(function (e) {
      var P = EP.prices[e.code] || {}, t = 0;
      for (var c in P) { if (P[c] && P[c][1] > 0) t += P[c][1]; }
      return { code: e.code, stock: t };
    });
    var tot = out.reduce(function (a, b) { return a + b.stock; }, 0);
    out.sort(function (a, b) { return b.stock - a.stock; });
    return { sites: out, total: tot };
  }
  function rebalance() {
    var EP = window.ETAB_PRICES; if (!EP || !EP.prices) return [];
    var PS = window.PROD_STATS || [], etabs = EP.etabs.map(function (e) { return e.code; }), out = [];
    for (var k = 0; k < PS.length; k++) {
      var c = String(PS[k].c), per = {}, tot = 0, nz = 0, mx = 0, mxE = null;
      for (var j = 0; j < etabs.length; j++) {
        var e = etabs[j], v = (EP.prices[e] && EP.prices[e][c]) ? Math.max(0, EP.prices[e][c][1]) : 0;
        per[e] = v; if (v > 0) { tot += v; nz++; } if (v > mx) { mx = v; mxE = e; }
      }
      if (tot < 20 || nz < 2) continue;
      var conc = mx / tot, zeros = etabs.filter(function (e) { return per[e] === 0; }).length;
      if (conc > 0.55 && zeros >= 1) out.push({ d: PS[k].d, per: per, tot: tot, mxE: mxE, conc: conc, zeros: zeros });
    }
    out.sort(function (a, b) { return b.tot - a.tot; });
    return out.slice(0, 10);
  }
  function etabSection() {
    if (!window.ETAB_PRICES) {
      return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#0E7C86">▤</div><div><h3>Stock par établissement</h3><div class="ap-sub">chargement des stocks des 7 sites…</div></div></div></div>';
    }
    var ss = siteStock(), reb = rebalance(), etabs = window.ETAB_PRICES.etabs.map(function (e) { return e.code; });
    var mx = 0; ss.sites.forEach(function (s) { if (s.stock > mx) mx = s.stock; });
    var strip = ss.sites.map(function (s) {
      return '<div class="site"><div class="code">' + s.code + '</div><div class="qt mono">' + fmt(s.stock) + '</div>' +
        '<div class="pct">' + (ss.total ? Math.round(s.stock / ss.total * 100) : 0) + ' %</div><div class="sbar"><i style="width:' + (mx ? Math.round(s.stock / mx * 100) : 0) + '%"></i></div></div>';
    }).join('');
    var rows = reb.map(function (p) {
      var m = 0; etabs.forEach(function (e) { if (p.per[e] > m) m = p.per[e]; });
      var bars = etabs.map(function (e) {
        var v = p.per[e], hpx = v === 0 ? 2 : Math.round(4 + v / m * 32);
        return '<div class="col"><div class="b ' + (v === 0 ? 'zero' : v === m ? 'hot' : '') + '" style="height:' + hpx + 'px"></div><small>' + e + '</small></div>';
      }).join('');
      return '<div class="imb"><div class="imn">' + esc(cap(p.d)) + '</div>' +
        '<div class="imm">' + fmt(p.tot) + ' u · <b>' + Math.round(p.conc * 100) + ' % sur ' + p.mxE + '</b> · ' + p.zeros + ' site' + (p.zeros > 1 ? 's' : '') + ' à 0</div>' +
        '<div class="imbar">' + bars + '</div>' +
        '<div class="imfix">→ équilibrer depuis ' + p.mxE + ' — <b>transférer</b> plutôt que commander</div></div>';
    }).join('') || '<div class="ap-empty">Stock équilibré sur les sites.</div>';
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#0E7C86">▤</div><div><h3>Stock par établissement</h3>' +
      '<div class="ap-sub">' + fmt(ss.total) + ' unités sur 7 sites (NR) — un produit concentré sur un site, à 0 ailleurs = à rééquilibrer, pas à racheter</div></div></div>' +
      '<div class="sites">' + strip + '</div>' +
      '<div class="imbhd">Rééquilibrage inter-sites <span>' + reb.length + '</span></div>' + rows + '</div>';
  }

  // ═══ VEILLE GÉNÉRIQUES (BDPM, robot mensuel) : bascules princeps→Gx + nouveaux groupes ═══
  var _generState = 0, _generData = null;
  function ensureGener() {
    if (_generData || _generState) return;
    _generState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('generiques-bdpm.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _generData = j || {}; _generState = 2; approRerender(); })
        .catch(function () { _generState = 2; });
    } catch (e) { _generState = 2; }
  }
  function basculesGx() {
    if (!_generData || !_generData.princepsWithGeneric || !window.WML_SALES) return [];
    var set = {}; _generData.princepsWithGeneric.forEach(function (c) { set[c] = 1; });
    var P = window.PROD_STATS || [], ps = {}; for (var i = 0; i < P.length; i++) ps[String(P[i].c)] = P[i];
    var bought = {}, S = window.WML_SALES;
    for (var j = 0; j < S.length; j++) { var r = S[j]; if (r[4] > 0) { var c = String(r[3]); if (set[c]) bought[c] = (bought[c] || 0) + r[4]; } }
    var out = Object.keys(bought).map(function (c) { return { c: c, q: bought[c], d: ps[c] ? ps[c].d : c }; });
    out.sort(function (a, b) { return b.q - a.q; });
    return out.slice(0, 12);
  }
  function basculesCard() {
    if (!_generData) return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#6D5AE6">G</div><div><h3>Bascules génériques</h3><div class="ap-sub">chargement de la base médicaments (BDPM)…</div></div></div></div>';
    var b = basculesGx(); if (!b.length) return '';
    var rows = b.map(function (o) {
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap(o.d)) + '<small>princeps acheté par le réseau — un générique existe</small></div>' +
        '<div class="ap-mini">' + fmt(o.q) + ' u/an</div><div class="ap-st ok">bascule Gx</div></div>';
    }).join('');
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#6D5AE6">G</div><div><h3>Bascules génériques à faire</h3>' +
      '<div class="ap-sub">' + (_generData.meta ? _generData.meta.nAvecGenerique : '') + ' groupes avec générique (BDPM) — les princeps que TU achètes encore et qui ont un générique dispo, top 12 par volume</div></div></div>' + rows + '</div>';
  }

  // ═══ VEILLE ANSM DISPONIBILITÉS (robot quotidien) : ruptures/tensions + DATE DE RETOUR ═══
  var _ansmState = 0, _ansmData = null;
  var MOIS_L = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function ensureAnsm() {
    if (_ansmData || _ansmState) return;
    _ansmState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('ansm-dispo.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _ansmData = j || {}; _ansmState = 2; approRerender(); })
        .catch(function () { _ansmState = 2; });
    } catch (e) { _ansmState = 2; }
  }
  function retourLabel(r) {
    if (!r) return '';
    if (!r.mois) return '' + r.annee;
    if (r.approx === 'trimestre') return 'T' + (Math.floor((r.mois - 1) / 3) + 1) + ' ' + r.annee;
    var pre = (r.approx === 'début' || r.approx === 'fin' || r.approx === 'mi') ? r.approx + ' ' : '';
    return pre + MOIS_L[r.mois - 1] + ' ' + r.annee;
  }
  function ansmCard() {
    if (!_ansmData) return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-amber)">!</div><div><h3>Ruptures &amp; retours ANSM</h3><div class="ap-sub">chargement des signalements ANSM…</div></div></div></div>';
    var items = (_ansmData.items || []).filter(function (i) { return i.retour && i.retour.iso; });
    items.sort(function (a, b) { return (a.retour.annee * 100 + (a.retour.mois || 13)) - (b.retour.annee * 100 + (b.retour.mois || 13)); });
    var rows = items.slice(0, 15).map(function (i) {
      var rup = /upture/.test(i.st);
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap((i.spec || '').toLowerCase())) +
        (i.dci ? '<small>' + esc(i.dci) + (i.subst ? ' · <b style="color:var(--c-opp)">générique dispo</b>' : '') + '</small>' : '') + '</div>' +
        '<div class="ap-mini">' + (rup ? '<span class="ap-tag ru">rupture</span>' : '<span class="ap-tag" style="color:#a8651a;background:#FFF8EC;border:1px solid #F0DCA8">tension</span>') + '</div>' +
        '<div class="ap-st ok">retour ' + retourLabel(i.retour) + '</div></div>';
    }).join('') || '<div class="ap-empty">Aucune date de retour renseignée pour le moment.</div>';
    var m = _ansmData.meta || {}, bs = m.byStatut || {}, rupN = 0, tenN = 0;
    Object.keys(bs).forEach(function (k) { if (/upture/.test(k)) rupN += bs[k]; if (/ension/.test(k)) tenN += bs[k]; });
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-amber)">!</div><div><h3>Ruptures &amp; retours ANSM</h3>' +
      '<div class="ap-sub">' + (m.n || 0) + ' signalements actifs · ' + rupN + ' ruptures · ' + tenN + ' tensions · <b>' + (m.nDates || 0) + ' avec date de retour</b> · <b style="color:var(--c-opp)">' + (m.nSubst || 0) + ' substituables (générique)</b> — top 15 par échéance</div></div></div>' +
      rows +
      '<div class="ap-foot" style="padding:10px 16px 12px;margin:0">Date de retour = champ « remise à disposition prévue » des fiches ANSM (approximatif, ~1 réf sur 3 renseignée). Source unique gratuite, MAJ quotidienne — personne d\'autre ne l\'agrège.</div></div>';
  }

  // ═══ SIGNAUX DE DEMANDE (Réseau Sentinelles, robot quotidien) — anticiper le comptoir ═══
  var _epiState = 0, _epiData = null;
  var EPI_MAP = {
    grippe: { fam: 'antipyrétiques · ORL · antitussifs', kw: /PARAC[EÉ]TAMOL|IBUPROF|DOLIPRANE|EFFERALGAN|DAFALGAN|TOUX|RHUME|GORGE|NASAL|S[EÉ]RUM PHY|OSCILLO|HUMEX|FERVEX|ACTIFED|RHINO|STREPSIL/i },
    gastro: { fam: 'antidiarrhéiques · réhydratation · antispasmodiques', kw: /DIARRH|SMECTA|IMODIUM|TIORFAN|LOP[EÉ]RAMIDE|R[EÉ]HYDRAT|ULTRALEVURE|SPASFON|PHLORO|ARESTAL|BIOGAIA/i },
    varicelle: { fam: 'antihistaminiques · antiseptiques cutanés', kw: /C[EÉ]TIRIZIN|LORATADIN|POLARAMINE|ANTIHIST|CHLORHEXIDINE|SEPTIVON|BISEPTINE|CICALFATE|DERMASPRAID|CALADRYL|DIPROSONE/i },
    bronchiolite: { fam: 'sérum physiologique · mouche-bébé · désobstruction nourrisson', kw: /S[EÉ]RUM PHY|PHYSIO(DOSE|MER|LOGIQUE)|STERIMAR|MOUCHE|RHINO.*B[EÉ]B|D[EÉ]SOBSTRUCT|PROSPAN|HELICIDINE|BALSAMIQUE|PRORHINEL/i }
  };
  // Odissé / SurSaUD (urgences par département, Santé publique France) — plus fin que Sentinelles
  var _odiState = 0, _odisseData = null;
  function ensureOdisse() {
    if (_odisseData || _odiState) return;
    _odiState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('odisse.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _odisseData = j || {}; _odiState = 2; approRerender(); })
        .catch(function () { _odiState = 2; });
    } catch (e) { _odiState = 2; }
  }
  function ensureEpidemio() {
    if (_epiData || _epiState) return;
    _epiState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('epidemio.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _epiData = j || {}; _epiState = 2; approRerender(); })
        .catch(function () { _epiState = 2; });
    } catch (e) { _epiState = 2; }
  }
  function epidemioCard() {
    if (!_epiData) return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-opp)">✚</div><div><h3>Signaux de demande</h3><div class="ap-sub">chargement de la veille épidémio…</div></div></div></div>';
    var inds = _epiData.indicators || []; if (!inds.length) return '';
    var P = window.PROD_STATS || [];
    var rows = inds.map(function (i) {
      var mp = EPI_MAP[i.cat] || {}, nref = 0;
      if (mp.kw) for (var k = 0; k < P.length; k++) { if ((P[k].n || 0) > 0 && mp.kw.test(P[k].d || '')) nref++; }
      var reg = (i.regions && i.regions[0]) ? i.regions[0].n : '';
      return '<div class="ap-row"><div class="ap-nm">' + esc(i.label) +
        '<small>' + (mp.fam ? 'à renforcer : ' + mp.fam : '') + (reg ? ' · plus fort en ' + esc(cap((reg || '').toLowerCase())) : '') + '</small></div>' +
        '<div class="ap-mini">' + (i.inc100 != null ? i.inc100 + '/100k' : '') + (nref ? ' · ' + nref + ' réfs' : '') + '</div>' +
        '<div class="ap-g">' + pctHtml(i.trend) + '</div></div>';
    }).join('');
    var w = String(_epiData.week || ''), wl = w.length >= 6 ? 'sem. ' + w.slice(4) + ' · ' + w.slice(0, 4) : '';
    // Bloc Odissé : où ça chauffe aux urgences, par département (SurSaUD, plus fin que Sentinelles + bronchiolite)
    var odiHtml = '';
    var odi = _odisseData && _odisseData.pathologies;
    if (odi && odi.length) {
      var ow = String(_odisseData.week || '');
      var orows = odi.map(function (p) {
        var mp = EPI_MAP[p.cat] || {}, nref = 0;
        if (mp.kw) for (var k = 0; k < P.length; k++) { if ((P[k].n || 0) > 0 && mp.kw.test(P[k].d || '')) nref++; }
        var deps = (p.hotDeps || []).slice(0, 3).map(function (d) { return esc(d.n || d.dep || ''); }).filter(Boolean).join(' · ');
        return '<div class="ap-row"><div class="ap-nm">' + esc(p.label) +
          '<small>' + (deps ? 'foyers actifs : ' + deps : '') + (mp.fam ? ' · à renforcer : ' + mp.fam : '') + '</small></div>' +
          '<div class="ap-mini">' + (p.passages != null ? p.passages + ' passages' : '') + (nref ? ' · ' + nref + ' réfs' : '') + '</div>' +
          '<div class="ap-g">' + pctHtml(p.trend) + '</div></div>';
      }).join('');
      odiHtml = '<div class="ap-foot" style="padding:11px 16px 4px;margin:0;font-weight:600;color:var(--ink)">Où ça chauffe — urgences par département' +
        (ow.length >= 6 ? ' · sem. ' + ow.slice(4) : '') + '</div>' +
        '<div class="ap-foot" style="padding:0 16px 6px;margin:0">SurSaUD (Santé publique France) — pré-positionner ces secteurs avant la vague comptoir.</div>' + orows;
    }
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-opp)">✚</div><div><h3>Signaux de demande — épidémie</h3>' +
      '<div class="ap-sub">Réseau Sentinelles ' + wl + ' · ce qui monte = à pré-stocker avant le rush comptoir (incidence France /100k + tendance hebdo)</div></div></div>' + rows + odiHtml +
      '<div class="ap-foot" style="padding:9px 16px 11px;margin:0">Réfs = produits du catalogue réseau associés à la pathologie (mots-clés). Croiser avec le stock avant le pic.</div></div>';
  }

  // ═══ ANTICIPATION RÉGLEMENTAIRE (HAS, robot mensuel) — le prochain Wegovy 3-6 mois avant ═══
  var _hasState = 0, _hasData = null, _bought = null, _boughtRef = null;
  function boughtSet() {
    var S = window.WML_SALES; if (!S) return {};
    if (_bought && _boughtRef === S) return _bought;
    var b = {}; for (var i = 0; i < S.length; i++) { var r = S[i]; if (r[4] > 0) { var c = String(r[3]); b[c] = (b[c] || 0) + r[4]; } }
    _bought = b; _boughtRef = S; return b;
  }

  // ═══ SAISON PAR PRODUIT (Medic'AM 2 ans, robot mensuel) — pré-commander avant le pic ═══
  var _saiState = 0, _saiCip = null;
  function ensureSaisonCip() {
    if (_saiCip || _saiState) return;
    _saiState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('saison-cip.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _saiCip = j || {}; _saiState = 2; approRerender(); })
        .catch(function () { _saiState = 2; });
    } catch (e) { _saiState = 2; }
  }
  function saisonCipCard() {
    if (!_saiCip) return '';   // discret : rien tant que non chargé (évite le clignotement)
    var data = _saiCip.data || {}; if (!Object.keys(data).length) return '';
    var b = boughtSet();
    var now = new Date().getMonth() + 1;
    var win = [now % 12 + 1, (now + 1) % 12 + 1, (now + 2) % 12 + 1];   // 3 prochains mois
    var P = window.PROD_STATS || [], ps = {}; for (var i = 0; i < P.length; i++) ps[String(P[i].c)] = P[i];
    var cand = [];
    Object.keys(data).forEach(function (c) {
      if (!b[c]) return;
      var o = data[c], pm = win[0], pv = o.i[win[0] - 1];
      win.forEach(function (m) { if (o.i[m - 1] > pv) { pv = o.i[m - 1]; pm = m; } });
      if (pv < (pm === 1 ? 1.5 : 1.2)) return;   // audit P2 : pic janvier = renouvellements, seuil relevé
      cand.push({ c: c, pv: pv, pm: pm, q: b[c] });
    });
    if (!cand.length) return '';
    cand.sort(function (a, b2) { return (b2.pv * b2.q) - (a.pv * a.q); });
    var rows = cand.slice(0, 12).map(function (x) {
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap(((ps[x.c] && ps[x.c].d) || x.c).toLowerCase())) +
        '<small>pic en ' + MOIS_L[x.pm - 1] + ' · +' + Math.round((x.pv - 1) * 100) + ' % vs moyenne (Medic\'AM 2 ans)</small></div>' +
        '<div class="ap-mini">' + fmt(x.q) + ' u/an réseau</div>' +
        '<div class="ap-st ok">pré-commander</div></div>';
    }).join('');
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#6D5AE6">☀</div><div><h3>Pré-commander avant le pic</h3>' +
      '<div class="ap-sub">saison PAR PRODUIT (Medic\'AM 2 ans) — ce que le réseau achète et qui monte dans les 3 prochains mois, à stocker avant le pic</div></div></div>' + rows +
      '<div class="ap-foot" style="padding:9px 16px 11px;margin:0">Indice = boîtes remboursées France du mois / moyenne annuelle, sur 2 ans. Pic à venir = constituer le stock maintenant.</div></div>';
  }
  function ensureHas() {
    if (_hasData || _hasState) return;
    _hasState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('has-avis.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _hasData = j || {}; _hasState = 2; approRerender(); })
        .catch(function () { _hasState = 2; });
    } catch (e) { _hasState = 2; }
  }
  function hasCard() {
    if (!_hasData) return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--ip-blue)">§</div><div><h3>Anticipation réglementaire</h3><div class="ap-sub">chargement des avis HAS…</div></div></div></div>';
    var favs = (_hasData.items || []).filter(function (i) { return i.cat === 'reimb'; });
    if (!favs.length) return '';
    var b = boughtSet();
    function dfr(iso) { var p = (iso || '').split('-'); return p.length >= 2 ? MOIS_L[+p[1] - 1] + ' ' + p[0] : iso; }
    var nOurs = favs.filter(function (i) { return (i.cips || []).some(function (c) { return b[c]; }); }).length;
    var rows = favs.slice(0, 12).map(function (i) {
      var ours = (i.cips || []).some(function (c) { return b[c]; });
      return '<div class="ap-row"><div class="ap-nm">' + esc(cap((i.spec || '').toLowerCase())) +
        '<small>avis HAS ' + dfr(i.date) + (i.motif ? ' · ' + esc(i.motif.toLowerCase()) : '') + '</small></div>' +
        '<div class="ap-mini">ASMR ' + esc(i.asmr) + '</div>' +
        (ours ? '<div class="ap-st ok">déjà au catalogue</div>' : '<div class="ap-st ko">à référencer</div>') + '</div>';
    }).join('');
    var m = _hasData.meta || {};
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--ip-blue)">§</div><div><h3>Anticipation réglementaire — HAS</h3>' +
      '<div class="ap-sub">' + (m.nFav || 0) + ' avis favorables récents (amélioration ASMR I-IV) · <b>' + nOurs + ' déjà au catalogue réseau</b> — ce qui va monter/arriver, le signal 3-6 mois avant le remboursement</div></div></div>' + rows +
      '<div class="ap-foot" style="padding:9px 16px 11px;margin:0">Un avis favorable de la Commission de la Transparence précède l\'inscription au remboursement de 3-6 mois. « À référencer » = ASMR élevé qu\'on ne distribue pas encore.</div></div>';
  }

  // ═══ CARNET D'ACHAT DU JOUR — fusion de tous les signaux en décisions (façon salle de marché) ═══
  // Chaque produit stocké = une position : couverture (runway), demande, signaux (rupture,
  // saison, générique) → un VERDICT + une quantité. Onglets par verdict · ticket au clic · export.
  // MITM — médicaments d'intérêt thérapeutique majeur (liste ANSM, robot mensuel) : priorité max
  var _mitmState = 0, _mitmSet = null, _mitmGen = null;
  function ensureMitm() {
    if (_mitmSet || _mitmState) return;
    _mitmState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('mitm.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { var s = {}; ((j && j.cips) || []).forEach(function (c) { s[c] = 1; }); _mitmSet = s; _mitmGen = j && j.generated; _mitmState = 2; approRerender(); })
        .catch(function () { _mitmSet = {}; _mitmState = 2; });
    } catch (e) { _mitmSet = {}; _mitmState = 2; }
  }
  // ── Couche de confiance : fraîcheur des sources (recommandation stratégie : fiabiliser d'abord) ──
  function fdate(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return p.length >= 3 ? p[2] + '/' + p[1] : String(iso); }
  function freshnessBar() {
    var s = [];
    if (_ansmData && _ansmData.generated) s.push('Ruptures ANSM ' + fdate(_ansmData.generated));
    if (_generData && _generData.generated) s.push('Génériques ' + fdate(_generData.generated));
    if (_hasData && _hasData.generated) s.push('HAS ' + fdate(_hasData.generated));
    if (_epiData && _epiData.week) s.push('Épidémio sem. ' + String(_epiData.week).slice(4));
    if (_odisseData && _odisseData.week) s.push('Urgences sem. ' + String(_odisseData.week).slice(4));
    if (_saiCip && _saiCip.generated) s.push('Saison ' + fdate(_saiCip.generated));
    if (_mitmGen) s.push('MITM ' + fdate(_mitmGen));
    if (_prixData && _prixData.generated) s.push('Prix BDPM ' + fdate(_prixData.generated));
    // Date réelle de l'inventaire plateforme = dénominateur des couvertures (audit : talon d'Achille).
    // On l'affiche et on alerte si le stock est vieux (> 35 j) car les jours-avant-rupture s'en trouvent optimistes.
    var stk = window.STOCK_IP && window.STOCK_IP.meta, stockTxt = '<b>stock plateforme = dernier inventaire importé</b> (photographie, pas temps réel)', warn = '';
    if (stk && stk.gen) {
      stockTxt = '<b>stock plateforme arrêté au ' + fdate(stk.gen) + '</b> (photographie, pas temps réel)';
      var age = null;
      try { age = Math.round((new Date().getTime() - new Date(stk.gen + 'T00:00:00').getTime()) / 864e5); } catch (e) {}
      if (age != null && age > 35) warn = '<div class="ap-fresh-warn">⚠️ Inventaire de ' + age + ' jours : les « jours avant rupture » sont donc optimistes (le stock a baissé depuis). À recroiser avant grosse commande — réimporter le stock = priorité.</div>';
    }
    if (!s.length && !warn) return '';
    return '<div class="ap-fresh">🕓 Sources à jour : ' + s.join(' · ') + ' · ' + stockTxt + '. Vitesse = ventes réseau janv.-juin 2026.</div>' + warn;
  }
  function isMitm(c) { return !!(_mitmSet && _mitmSet[c]); }

  var _bookTab = 'all', _carnetActs = null;
  var ORDER_LEAD = 4; // délai fournisseur par défaut (jours) pour la date « commander avant »
  function dtLabel(daysAhead) {
    var d = new Date(Date.now() + Math.round(Math.max(0, daysAhead)) * 86400000);
    return d.getDate() + ' ' + MOIS_L[d.getMonth()];
  }
  function secLab(cov) { return cov < 1 ? 'déjà à sec (stock 0)' : 'à sec ~' + dtLabel(cov); }   // audit #2 : pas de « à sec ~aujourd'hui »
  function carnet() {
    var idx = cipIndex();
    if (!idx || !Object.keys(idx).length) return null;
    var sai = (_saiCip && _saiCip.data) || {};
    var genSet = null;
    if (_generData && _generData.princepsWithGeneric) { genSet = {}; _generData.princepsWithGeneric.forEach(function (c) { genSet[c] = 1; }); }
    var now = new Date().getMonth() + 1, win = [now % 12 + 1, (now + 1) % 12 + 1, (now + 2) % 12 + 1];
    var P = window.PROD_STATS || [], ps = {}; for (var i = 0; i < P.length; i++) ps[String(P[i].c)] = P[i];
    var acts = [], C = { buy: 0, sec: 0, pre: 0, arb: 0, red: 0, eur: 0, redEur: 0 };
    Object.keys(idx).forEach(function (c) {
      var o = idx[c];
      if (o.vM < 3 && o.stale !== 1) return;
      var rupt = V2.rupture ? !!V2.rupture(c) : false;
      var s = sai[c], sUp = 0, sM = 0;
      if (s && s.i) win.forEach(function (m) { if (s.i[m - 1] > sUp) { sUp = s.i[m - 1]; sM = m; } });
      var seasonUp = sUp >= (sM === 1 ? 1.5 : 1.2);   // audit P2 : pic janvier = renouvellements chroniques → seuil relevé
      var isGen = genSet ? !!genSet[c] : false;
      var verdict, cls, prio, qty = 0, reason = '';
      if ((o.stale === 1 || o.cov > 90) && o.st > 0) {
        verdict = 'ALLÉGER'; cls = 'red'; prio = 1; reason = (o.cov > 90 ? (o.cov >= 9999 ? 'invendu' : Math.round(o.cov) + ' j de stock') : 'dormant');
        C.red++; C.redEur += o.st * (o.ppht || 0);
      } else if (o.cov < 7 && o.vM >= 5) {
        qty = o.qcmd;
        if (rupt) { verdict = 'SÉCURISER'; cls = 'sec'; reason = 'tension ANSM · ' + secLab(o.cov) + ' — commander maintenant'; C.sec++; }
        else { verdict = 'ACHETER'; cls = 'buy'; reason = secLab(o.cov) + ' — commander maintenant'; C.buy++; }
        prio = 5; C.eur += qty * (o.ppht || 0);
      } else if (o.qcmd > 0 && o.cov < 21) {
        verdict = 'ACHETER'; cls = 'buy'; prio = 4; qty = o.qcmd;
        reason = 'à sec ~' + dtLabel(o.cov) + ' · commander avant ' + dtLabel(o.cov - ORDER_LEAD); C.buy++; C.eur += qty * (o.ppht || 0);
      } else if (seasonUp) {
        verdict = 'PRÉ-ACHETER'; cls = 'pre'; prio = 3;
        qty = Math.max(o.qcmd, Math.round(o.vM / 30 * 21 * sUp - o.st)); if (qty < 0) qty = 0;
        reason = 'pic ' + MOIS_L[sM - 1] + ' +' + Math.round((sUp - 1) * 100) + '%'; C.pre++; C.eur += qty * (o.ppht || 0);
      } else if (isGen) {
        verdict = 'ARBITRER'; cls = 'arb'; prio = 2; reason = 'générique dispo → basculer'; C.arb++;
      } else return;
      var mitm = isMitm(c);
      if (mitm && (cls === 'sec' || cls === 'buy')) prio += 0.5;   // médicament critique → remonte dans le carnet
      var cmdDays = null;   // jours avant la date limite de commande (pour le calendrier). arb/red = pas de date.
      if (cls === 'buy' || cls === 'sec') cmdDays = Math.max(0, Math.round(o.cov - ORDER_LEAD));
      else if (cls === 'pre') { var nm = new Date().getMonth() + 1, ma = ((sM - nm) + 12) % 12; cmdDays = Math.max(7, ma * 30 - 42); }
      acts.push({ c: c, name: (ps[c] && ps[c].d) || c, o: o, v: verdict, cls: cls, prio: prio, qty: qty, reason: reason, rupt: rupt, season: seasonUp, gen: isGen, mitm: mitm, cmdDays: cmdDays });
    });
    acts.sort(function (a, b) { return (b.prio - a.prio) || (a.o.cov - b.o.cov); });
    _carnetActs = acts;
    return { acts: acts, counts: C };
  }
  function carnetRow(x) {
    var chips = '';
    if (x.mitm) { var crit = x.rupt || (x.o && x.o.cov < 7); chips += crit ? ' <span class="ap-tag" style="color:#B02A37;background:#FDE7EA;border:1px solid #F3B0BC">critique</span>' : ' <span class="ap-tag" style="color:#6B7280;background:var(--card-2,#F6F8FB);border:1px solid var(--line)">surveillé ANSM</span>'; }   // audit P3 : « critique » réservé au croisement avec l'état de stock
    if (x.rupt) chips += ' <span class="ap-tag ru">ANSM</span>';
    if (x.season) chips += ' <span class="ap-tag" style="color:#6D5AE6;background:#EFEBFB;border:1px solid #D3C9F5">saison</span>';
    if (x.gen && x.cls !== 'arb') chips += ' <span class="ap-tag" style="color:#0E7C86;background:#E5F4F5;border:1px solid #B8E0E3">Gx</span>';
    return '<div class="cb-row" onclick="V2.approTicket(\'' + esc(x.c) + '\')"><span class="cb-tag cb-' + x.cls + '">' + x.v + '</span>' +
      '<div class="cb-nm">' + esc(cap((x.name || '').toLowerCase())) + '<small>' + x.reason + chips + '</small></div>' +
      '<div class="cb-cov">' + covBadge(x.o.cov) + '</div>' +
      '<div class="cb-qt">' + (x.qty > 0 ? '+' + fmt(x.qty) + '<small>u</small>' : '—') + '</div></div>';
  }
  V2.approTab = function (t) { _bookTab = t; if (V2.render) V2.render(); };
  var _section = 'today';   // espace affiché : today / anticiper / stock / marche
  V2.approSec = function (s) { _section = s; if (V2.render) V2.render(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} };
  V2.approExport = function () {
    var buys = (_carnetActs || []).filter(function (a) { return a.qty > 0; });
    if (!buys.length) { try { alert('Aucune ligne à commander.'); } catch (e) {} return; }
    var lines = [['CIP', 'Produit', 'Action', 'Quantite', 'Couverture_jours', 'PrixNet_HT', 'Valeur_HT']];
    buys.forEach(function (a) { lines.push([a.c, a.name, a.v, a.qty, Math.round(a.o.cov), a.o.ppht || '', Math.round(a.qty * (a.o.ppht || 0))]); });
    var csv = lines.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    try {
      var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'carnet-achat-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
    } catch (e) {}
  };
  V2.approTicketClose = function () { var el = document.getElementById('appro-ticket'); if (el) el.style.display = 'none'; };
  V2.approTicket = function (cip) {
    cip = String(cip);
    var o = cipIndex()[cip]; if (!o) return;
    var P = window.PROD_STATS || [], p = null; for (var i = 0; i < P.length; i++) if (String(P[i].c) === cip) { p = P[i]; break; }
    var name = (p && p.d) || cip;
    // demande 6 mois (WML)
    var series = [0, 0, 0, 0, 0, 0], S = window.WML_SALES || [];
    for (var j = 0; j < S.length; j++) { var r = S[j]; if (String(r[3]) === cip && r[4] > 0 && r[1] >= 1 && r[1] <= 6) series[r[1] - 1] += r[4]; }
    var mx = Math.max.apply(null, series) || 1;
    var MS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin'];
    var spark = '<div class="tk-spark">' + series.map(function (v, k) {
      return '<div class="tk-bar"><i style="height:' + Math.round(6 + v / mx * 66) + 'px"></i><b>' + fmt(v) + '</b><span>' + MS[k] + '</span></div>';
    }).join('') + '</div>';
    // stock par site (ETAB, NR)
    var EP = window.ETAB_PRICES, sitesHtml = '';
    if (EP && EP.prices && EP.etabs) {
      var per = EP.etabs.map(function (e) { var v = (EP.prices[e.code] && EP.prices[e.code][cip]) ? Math.max(0, EP.prices[e.code][cip][1]) : 0; return { code: e.code, v: v }; });
      var tot = per.reduce(function (a, b) { return a + b.v; }, 0);
      if (tot > 0) {
        var smx = Math.max.apply(null, per.map(function (x) { return x.v; })) || 1;
        sitesHtml = '<div class="tk-h">Stock par établissement</div><div class="tk-sites">' +
          per.map(function (x) { return '<div class="tk-site"><i style="height:' + Math.round(4 + x.v / smx * 30) + 'px"></i><span>' + x.code + '</span><b>' + fmt(x.v) + '</b></div>'; }).join('') + '</div>';
      }
    }
    // signaux
    var sig = [];
    if (isMitm(cip)) { var mc = (V2.rupture && V2.rupture(cip)) || (o && o.cov < 7); sig.push(mc ? '<span class="ap-tag" style="color:#B02A37;background:#FDE7EA;border:1px solid #F3B0BC">critique — MITM en tension</span>' : '<span class="ap-tag" style="color:#6B7280;background:var(--card-2,#F6F8FB);border:1px solid var(--line)">MITM — surveillé ANSM</span>'); }
    if (V2.rupture && V2.rupture(cip)) sig.push('<span class="ap-tag ru">tension ANSM</span>');
    var sai = _saiCip && _saiCip.data && _saiCip.data[cip];
    if (sai) { var pk = sai.p; sig.push('<span class="ap-tag" style="color:#6D5AE6;background:#EFEBFB;border:1px solid #D3C9F5">pic saison ' + MOIS_L[pk - 1] + '</span>'); }
    if (_generData && _generData.princepsWithGeneric && _generData.princepsWithGeneric.indexOf(cip) >= 0) sig.push('<span class="ap-tag" style="color:#0E7C86;background:#E5F4F5;border:1px solid #B8E0E3">générique dispo</span>');
    var mo = V2.momentum ? V2.momentum(cip) : null;
    if (mo != null) sig.push('<span class="ap-tag" style="color:' + (mo > 0 ? 'var(--c-opp)' : '#a8651a') + ';background:var(--card-2,#F6F8FB);border:1px solid var(--line)">momentum ' + (mo > 0 ? '▲' : '▼') + '</span>');
    var net = p ? p.net : o.ppht, rpct = p ? p.rpct : 0;
    var kpis = '<div class="tk-kpis">' +
      '<div class="tk-kpi"><b>' + (o.cov >= 9999 ? 'jamais' : Math.round(o.cov) + ' j') + '</b><span>couverture</span></div>' +
      '<div class="tk-kpi"><b>' + fmt(Math.round(o.vM)) + '</b><span>ventes/mois</span></div>' +
      '<div class="tk-kpi"><b>' + fmt(o.st) + '</b><span>en stock</span></div>' +
      '<div class="tk-kpi"><b style="color:var(--c-opp)">' + (o.qcmd > 0 ? '+' + fmt(o.qcmd) : '—') + '</b><span>à commander</span></div>' +
      '</div>';
    var priceLine = '<div class="tk-price">Prix grossiste (PPHT) <b>' + (V2.fmtEur ? V2.fmtEur(o.ppht) : o.ppht) + '</b>' +
      (rpct > 0 ? ' · abandon de marge <b>' + (Math.round(rpct * 10) / 10) + ' %</b> → net <b>' + (V2.fmtEur ? V2.fmtEur(net) : net) + '</b>' : '') + '</div>';
    // projection du stock → date de rupture (le meilleur d'Aprobot, en clair)
    var proj = '', velDay = o.vM / 30;
    if (velDay > 0 && o.st > 0) {
      var W = 460, Hh = 76, npt = 24, horizon = Math.max(14, Math.min(75, Math.ceil(o.cov) + 7)), pts = [];
      for (var k = 0; k <= npt; k++) { var dd = horizon * k / npt, val = Math.max(0, o.st - velDay * dd); pts.push(Math.round(W * k / npt) + ',' + Math.round(Hh - (val / o.st) * Hh)); }
      var xr = Math.min(W, Math.round(W * o.cov / horizon)), xo = Math.min(W, Math.round(W * Math.max(0, o.cov - ORDER_LEAD) / horizon));
      proj = '<div class="tk-h">Projection du stock</div>' +
        '<div class="tk-proj"><svg viewBox="0 0 ' + W + ' ' + (Hh + 2) + '" preserveAspectRatio="none">' +
          '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#0050E6" stroke-width="2.5" vector-effect="non-scaling-stroke"/>' +
          '<line x1="' + xo + '" y1="0" x2="' + xo + '" y2="' + Hh + '" stroke="#0E7C86" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>' +
          '<line x1="' + xr + '" y1="0" x2="' + xr + '" y2="' + Hh + '" stroke="#D5573B" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>' +
        '</svg></div>' +
        '<div class="tk-projlab"><b style="color:#0E7C86">commander avant ~' + dtLabel(o.cov - ORDER_LEAD) + '</b><b style="color:#D5573B">rupture ~' + dtLabel(o.cov) + '</b></div>';
    }
    var html = '<div class="tk-box"><button class="tk-x" onclick="V2.approTicketClose()">✕</button>' +
      '<div class="tk-title">' + esc(cap((name || '').toLowerCase())) + '</div>' +
      '<div class="tk-cip">CIP ' + esc(cip) + (p && p.f ? ' · ' + esc(p.f) : '') + '</div>' +
      (sig.length ? '<div class="tk-sig">' + sig.join(' ') + '</div>' : '') +
      kpis + priceLine + proj +
      '<div class="tk-h">Demande réseau (6 mois)</div>' + spark +
      sitesHtml + '</div>';
    var el = document.getElementById('appro-ticket');
    if (!el) { el = document.createElement('div'); el.id = 'appro-ticket'; el.className = 'tk-ov'; el.onclick = function (e) { if (e.target === el) V2.approTicketClose(); }; document.body.appendChild(el); }
    el.innerHTML = html; el.style.display = 'flex';
  };

  // ═══ VUE CALENDRIER (synthèse experts) : calendrier d'ACTIONS groupé FOURNISSEUR ═══
  var _laboState = 0, _laboMap = null;
  function ensureLabo() {
    if (_laboMap || _laboState) return;
    _laboState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('labo-cip.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _laboMap = (j && j.data) || {}; _laboState = 2; approRerender(); })
        .catch(function () { _laboMap = {}; _laboState = 2; });
    } catch (e) { _laboMap = {}; _laboState = 2; }
  }
  function laboOf(c) { if (_laboMap && _laboMap[c]) return _laboMap[c]; var G = window.GENERIQUEURS; if (G && G[c]) return G[c]; return 'Divers'; }
  var _calSub = 'today';
  V2.approCal = function (s) { _calSub = s; if (V2.render) V2.render(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} };
  var CLJ = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var CLCOL = { buy: '#D93A2B', sec: '#C77700', pre: '#0050E6' };
  function calDate(days) { return new Date(Date.now() + days * 86400000); }
  function calDayLab(d) { return CLJ[d.getDay()] + ' ' + d.getDate(); }
  function supGroup(items) {
    var m = {}, order = [];
    items.forEach(function (a) {
      var k = laboOf(a.c), g = m[k];
      if (!g) { g = m[k] = { labo: k, lines: [], eur: 0, mitm: 0, cls: a.cls, prio: 0 }; order.push(k); }
      g.lines.push(a); g.eur += a.qty * (a.o.ppht || 0); if (a.mitm) g.mitm++;
      if (a.prio > g.prio) { g.prio = a.prio; g.cls = a.cls; }
    });
    return order.map(function (k) { return m[k]; }).sort(function (a, b) { return b.eur - a.eur; });
  }
  function supCardHtml(s) {
    var lines = s.lines.slice(0, 3).map(function (a) {
      return '<button class="cl-line" onclick="event.stopPropagation();V2.approTicket(\'' + esc(a.c) + '\')">' +
        '<span>' + esc(cap((a.name || '').toLowerCase())) + '</span><b>' + (a.qty > 0 ? '+' + fmt(a.qty) : '—') + '</b></button>';
    }).join('');
    var more = s.lines.length > 3 ? '<div class="cl-more">+' + (s.lines.length - 3) + ' autres lignes</div>' : '';
    return '<div class="cl-sup" style="--c:' + (CLCOL[s.cls] || '#6B7280') + '"><div class="cl-suh"><b>' + esc(s.labo) + (s.mitm ? ' <span class="mitm"></span>' : '') +
      '</b><span>' + s.lines.length + ' ligne' + (s.lines.length > 1 ? 's' : '') + ' · ' + (V2.fmtEur ? V2.fmtEur(s.eur) : fmt(s.eur)) + '</span></div>' + lines + more + '</div>';
  }
  function calToggle() {
    var subs = [['today', 'Aujourd’hui'], ['week', 'Semaine'], ['month', 'Mois'], ['list', 'Toutes les lignes']];
    return '<div class="cl-tabs">' + subs.map(function (t) { return '<button class="cl-tab' + (_calSub === t[0] ? ' on' : '') + '" onclick="V2.approCal(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function calendarView(carnetHtml) {
    ensureLabo();
    var toggle = calToggle();
    if (_calSub === 'list') return toggle + (carnetHtml || '');
    var acts = (_carnetActs || []).filter(function (a) { return a.cmdDays != null; });
    if (!acts.length) return toggle + '<div class="v2-card" style="padding:22px;text-align:center;color:var(--muted)">Chargement du calendrier…</div>';
    var late = acts.filter(function (a) { return a.o.cov <= 1; });
    var byDay = {}; acts.forEach(function (a) { if (a.o.cov <= 1) return; (byDay[a.cmdDays] = byDay[a.cmdDays] || []).push(a); });
    var band = '';
    if (_calSub === 'today' || _calSub === 'week') {
      band = '<div class="cl-band">';
      for (var k = 0; k < 7; k++) { var d = calDate(k); var n = (byDay[k] || []).length + (k === 0 ? late.length : 0); band += '<div class="cl-bd' + (k === 0 ? ' today' : '') + '"><div class="dn">' + CLJ[d.getDay()].replace('.', '') + '</div><div class="cn">' + (n || '·') + '</div></div>'; }
      band += '</div>';
    }
    var body = '';
    if (_calSub === 'today') {
      var t0 = late.concat(byDay[0] || []); var today = supGroup(t0);
      var nM = t0.filter(function (a) { return a.mitm; }).length;
      body = '<div class="cl-today"><div class="cl-th">' + calDayLab(calDate(0)) + '</div>' +
        '<div class="cl-big">' + today.length + ' commande' + (today.length > 1 ? 's' : '') + ' à passer' + (nM ? ' · ' + nM + ' critique' + (nM > 1 ? 's' : '') : '') + '</div>' +
        (today.slice(0, 6).map(supCardHtml).join('') || '<div class="ap-empty">Rien à commander aujourd’hui ✓</div>') +
        (today.length > 6 ? '<div class="cl-more">+' + (today.length - 6) + ' autres labos</div>' : '') + '</div>';
      body += '<div class="cl-th" style="margin-top:14px">Ensuite</div>';
      for (var k2 = 1; k2 <= 6; k2++) { var d2 = calDate(k2); var sp = supGroup(byDay[k2] || []); body += '<div class="cl-nx"><span class="d">' + calDayLab(d2) + '</span><span class="i">' + (sp.length ? sp.length + ' commande' + (sp.length > 1 ? 's' : '') + ' · ' + sp.slice(0, 2).map(function (s) { return s.labo; }).join(', ') : '—') + '</span></div>'; }
    } else if (_calSub === 'week') {
      body = '<div class="cl-wk">';
      for (var k3 = 0; k3 < 7; k3++) { var d3 = calDate(k3); var sps = supGroup((byDay[k3] || []).concat(k3 === 0 ? late : [])); body += '<div class="cl-wc' + (k3 === 0 ? ' today' : '') + '"><div class="cl-wch">' + (k3 === 0 ? 'Auj.' : calDayLab(d3)) + '<b>' + (sps.length || '') + '</b></div>' + (sps.slice(0, 4).map(supCardHtml).join('') || '<div class="cl-more">—</div>') + (sps.length > 4 ? '<div class="cl-more">+' + (sps.length - 4) + ' labos</div>' : '') + '</div>'; }
      body += '</div>';
    } else if (_calSub === 'month') {
      var nowd = new Date(), y = nowd.getFullYear(), mo = nowd.getMonth(), fdow = (new Date(y, mo, 1).getDay() + 6) % 7, ndays = new Date(y, mo + 1, 0).getDate();
      var load = {}; acts.forEach(function (a) { var dd = calDate(a.o.cov <= 1 ? 0 : a.cmdDays); if (dd.getMonth() === mo) load[dd.getDate()] = (load[dd.getDate()] || 0) + 1; });
      var mx = 1; Object.keys(load).forEach(function (k) { if (load[k] > mx) mx = load[k]; });
      function shade(v) { if (!v) return 'transparent'; var t = v / mx; return t > 0.66 ? '#D93A2B' : t > 0.33 ? '#E88A2A' : '#F1C27A'; }
      body = '<div class="cl-mhead">' + cap(MOIS[mo]) + ' ' + y + '</div><div class="cl-mgrid">' + ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(function (x) { return '<div class="cl-mdn">' + x + '</div>'; }).join('');
      for (var i = 0; i < fdow; i++) body += '<div></div>';
      for (var day = 1; day <= ndays; day++) { var v = load[day] || 0, isT = day === nowd.getDate(); body += '<div class="cl-mcell' + (isT ? ' today' : '') + '"><span class="dn">' + day + '</span>' + (v ? '<span class="cn" style="color:' + shade(v) + '">' + v + '</span><span class="ld" style="background:' + shade(v) + '"></span>' : '') + '</div>'; }
      body += '</div><div class="ap-foot" style="padding:8px 2px 0;margin:0">Les jours chauds = beaucoup de commandes à passer. Vue de planification — on exécute dans « Aujourd’hui » et « Semaine ».</div>';
    }
    return toggle + band + body;
  }

  // ═══ BAISSES DE PRIX OFFICIELLES (BDPM prix public, robot quotidien, diff par snapshot) ═══
  var _prixState = 0, _prixData = null;
  function ensurePrix() {
    if (_prixData || _prixState) return;
    _prixState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('prix.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _prixData = j || {}; _prixState = 2; approRerender(); })
        .catch(function () { _prixState = 2; });
    } catch (e) { _prixState = 2; }
  }
  function prixCard() {
    if (!_prixData) return '';
    var d = _prixData, drops = d.drops || [];
    if (!drops.length) {
      // amorçage ou aucune baisse depuis le dernier relevé : présence honnête, pas de carte vide
      return '<div class="ap-foot" style="margin-top:8px">💶 Surveillance des prix publics officiels active — <b>' + (d.nTracked || 0) + ' références suivies</b>. ' +
        (d.baseline ? 'Relevé de départ posé : les baisses apparaîtront ici dès la prochaine révision tarifaire (souvent le 1<sup>er</sup> du mois).' : 'Aucune baisse depuis le dernier relevé.') + '</div>';
    }
    var rows = drops.slice(0, 12).map(function (x) {
      return '<div class="ap-row"><div class="ap-nm">' + esc(x.d || x.c) +
        '<small>' + (x.remb ? 'remb. ' + esc(x.remb) + ' · ' : '') + (x.n ? x.n + ' vendus (réseau)' : 'hors réseau') + '</small></div>' +
        '<div class="ap-mini">' + fmtEur(x.old) + ' → <b>' + fmtEur(x.new) + '</b></div>' +
        '<div class="ap-g"><span class="ap-down">▼ −' + x.pct + ' %</span></div></div>';
    }).join('');
    return card('pilo', 'Baisses de prix officielles', 'prix public BDPM en baisse depuis le dernier relevé — un stock qui se dévalorise, à ne pas surcharger', rows, 'var(--rose,#D5573B)') +
      '<div class="ap-foot" style="margin:0">Prix public TTC officiel (BDPM). ' + (d.nDown || 0) + ' baisse' + ((d.nDown || 0) > 1 ? 's' : '') + ' · ' + (d.nUp || 0) + ' hausse' + ((d.nUp || 0) > 1 ? 's' : '') + ' sur ' + (d.nTracked || 0) + ' réfs suivies. Classé par baisse × volume réseau.</div>';
  }
  function fmtEur(v) { return (v == null ? '—' : String(v.toFixed ? v.toFixed(2) : v).replace('.', ',') + ' €'); }

  // ═══ ACTU APPRO (quotidien, gratuit) : fil d'actualité filtré appro + bloc PRÉDICTIF ═══
  var _infosState = 0, _infosData = null;
  function ensureInfos() {
    if (_infosData || _infosState) return;
    _infosState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('infos-jour.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _infosData = j || {}; _infosState = 2; approRerender(); })
        .catch(function () { _infosState = 2; });
    } catch (e) { _infosState = 2; }
  }
  function actuView() {
    ensureInfos();
    // ── PRÉDICTIF : ce qui arrive, calculé sur nos robots ──
    var pred = [];
    var acts = _carnetActs || [];
    var imm = acts.filter(function (a) { return a.o && a.o.cov <= 7 && (a.cls === 'buy' || a.cls === 'sec'); });
    if (imm.length) pred.push({ ic: '⏱', c: '#D5573B', t: imm.length + ' produits à sec sous 7 jours', s: 'à commander en urgence — ' + imm.slice(0, 2).map(function (a) { return cap((a.name || '').toLowerCase()); }).join(', ') });
    if (_ansmData && _ansmData.items) { var rets = _ansmData.items.filter(function (i) { return i.retour && i.retour.iso; }).sort(function (a, b) { return (a.retour.annee * 100 + (a.retour.mois || 13)) - (b.retour.annee * 100 + (b.retour.mois || 13)); }); if (rets.length) pred.push({ ic: '📦', c: '#0E7C86', t: ((_ansmData.meta && _ansmData.meta.nDates) || rets.length) + ' retours de rupture prévus', s: cap((rets[0].spec || '').toLowerCase()).slice(0, 28) + ' → ' + retourLabel(rets[0].retour) }); }
    if (_generData && _generData.newGeneric && _generData.newGeneric.length) pred.push({ ic: 'Ⓖ', c: '#6D5AE6', t: _generData.newGeneric.length + ' nouveaux génériques', s: 'basculer les achats — ' + esc((_generData.newGeneric[0].lib || '').split(',')[0]) });
    else if (_generData && _generData.meta) pred.push({ ic: 'Ⓖ', c: '#6D5AE6', t: 'bascules génériques disponibles', s: _generData.meta.nAvecGenerique + ' groupes avec un générique — princeps à basculer' });
    if (_hasData && _hasData.items) { var f = _hasData.items.filter(function (i) { return i.cat === 'reimb'; }); if (f.length) pred.push({ ic: '§', c: '#0050E6', t: f.length + ' avis HAS favorables récents', s: 'futurs remboursements 3-6 mois avant — ' + cap((f[0].spec || '').toLowerCase()).slice(0, 26) }); }
    if (_epiData && _epiData.indicators) { var up = _epiData.indicators.filter(function (i) { return i.trend != null && i.trend > 10; }); if (up.length) pred.push({ ic: '✚', c: '#1E9E6A', t: up[0].label + ' en hausse (+' + up[0].trend + ' %)', s: (up[0].regions && up[0].regions[0] ? 'plus fort en ' + cap((up[0].regions[0].n || '').toLowerCase()) + ' · ' : '') + 'renforcer les familles avant le pic' }); }
    var predHtml = pred.map(function (p) { return '<div class="ac-pred"><div class="ac-ic" style="background:' + p.c + '">' + p.ic + '</div><div class="ac-pt"><b>' + p.t + '</b><span>' + p.s + '</span></div></div>'; }).join('') || '<div class="ap-empty">Signaux en cours de chargement…</div>';
    // ── ACTUALITÉ : RSS filtré appro ──
    var news;
    if (_infosData && _infosData.items) {
      var CATN = { ruptures: ['rupture', '#D5573B'], securite: ['sécurité', '#C77700'], reglementaire: ['réglementaire', '#0050E6'] };
      var appro = _infosData.items.filter(function (i) { return CATN[i.cat]; });
      news = appro.slice(0, 14).map(function (i) {
        var cn = CATN[i.cat];
        return '<a class="ac-news" href="' + esc(i.url) + '" target="_blank" rel="noopener"><span class="ac-cat" style="background:' + cn[1] + '">' + cn[0] + '</span>' +
          '<div class="ac-nm"><b>' + esc(i.titre) + '</b><span>' + esc(i.source) + '</span></div></a>';
      }).join('') || '<div class="ap-empty">Pas d’actu appro dans les derniers jours.</div>';
    } else news = '<div class="ap-empty">Chargement de l’actualité…</div>';
    return '<div class="ap-sec">Prédictif — ce qui arrive</div>' +
      '<div class="ap-secsub">calculé chaque jour sur ta donnée réseau + les sources publiques gratuites</div>' +
      '<div class="v2-card ap-card" style="padding:6px 4px">' + predHtml + '</div>' +
      '<div class="ap-sec">Actualité appro du jour</div>' +
      '<div class="ap-secsub">ruptures, sécurité, réglementaire — ANSM &amp; presse pro (RSS gratuit, quotidien)</div>' +
      '<div class="v2-card ap-card" style="padding:0">' + news + '</div>';
  }

  V2.pages.appro = {
    render: function (root) {
      ensureCss();
      // Les flux marché sont-ils là ? (chargés par le socle Copilote)
      if (!window.PROD_STATS) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap"><div class="v2-loading"><div class="v2-spinner"></div><div>Chargement des données marché…</div></div></div>';
        if (V2.loadFiles) V2.loadFiles(['bench']).then(function () { V2.render(); });
        return;
      }

      ensureEtab();   // charge en différé le stock par établissement (gros fichier NR)
      ensureGener();  // charge la veille génériques (BDPM, robot mensuel)
      ensureAnsm();   // charge la veille ANSM disponibilités + dates de retour (robot quotidien)
      ensureEpidemio(); // charge les signaux de demande (Sentinelles, robot quotidien)
      ensureOdisse(); // charge les urgences par département (SurSaUD/Odissé, robot hebdo)
      ensureHas();    // charge l'anticipation réglementaire HAS (robot mensuel)
      ensureSaisonCip(); // charge la saison par produit (Medic'AM, robot mensuel)
      ensureMitm();   // charge la liste des médicaments critiques MITM (ANSM, robot mensuel)
      ensureInfos();  // charge l'actu quotidienne (veille RSS gratuite, filtrée appro)
      ensurePrix();   // charge les baisses de prix officielles (BDPM, robot quotidien)
      // ── Cockpit réassort (crash-safe : ne casse jamais la page si un flux manque) ──
      var kpiBand = '', reaCard = '', rosCard = '', radarHtml = '', etabHtml = '', basculesHtml = '', ansmHtml = '', epiHtml = '', hasHtml = '', saiCipHtml = '', carnetHtml = '', carnetCounts = null;
      try {
        if (window.WML_SALES && window.STOCK_IP) {
          var cb = carnet();
          if (cb && cb.acts.length) {
            var C = cb.counts, acts = cb.acts;
            carnetCounts = C;
            var TABS = [['all', 'Tous', acts.length], ['buy', 'Acheter', C.buy], ['sec', 'Sécuriser', C.sec], ['pre', 'Pré-acheter', C.pre], ['arb', 'Arbitrer', C.arb], ['red', 'Alléger', C.red]];
            var tabBar = TABS.map(function (t) { return '<button class="cb-tab' + (_bookTab === t[0] ? ' on' : '') + '" onclick="V2.approTab(\'' + t[0] + '\')">' + t[1] + ' <b>' + t[2] + '</b></button>'; }).join('');
            var shown = _bookTab === 'all' ? acts : acts.filter(function (a) { return a.cls === _bookTab; });
            var rowsHtml = shown.slice(0, 24).map(carnetRow).join('') || '<div class="ap-empty">Rien dans cette catégorie.</div>';
            carnetHtml = '<div class="v2-card cb-card"><div class="cb-hd"><div><h3>Carnet d\'achat du jour</h3>' +
              '<div class="cb-sub">' + acts.length + ' positions — clique une ligne pour le détail, exporte la commande</div></div>' +
              '<div class="cb-tot"><b>' + (V2.fmtEur ? V2.fmtEur(C.eur) : fmt(C.eur)) + '</b><small>à engager</small></div>' +
              '<button class="cb-exp" onclick="V2.approExport()">⤓ Exporter</button></div>' +
              '<div class="cb-tabs">' + tabBar + '</div>' +
              rowsHtml +
              '<div class="ap-foot" style="padding:10px 16px 12px;margin:0">Priorisé par urgence · quantité = pour revenir à la couverture cible · « à engager » = valeur d\'achat (prix net) des lignes à acheter/pré-acheter.</div></div>';
          }
        }
      } catch (e) { carnetHtml = ''; }
      try {
        radarHtml = radarSection(window.WML_SALES && window.STOCK_IP ? reassort() : []);
        etabHtml = etabSection();
        basculesHtml = basculesCard();
        ansmHtml = ansmCard();
        epiHtml = epidemioCard();
        hasHtml = hasCard();
        saiCipHtml = saisonCipCard();
        if (window.WML_SALES && window.STOCK_IP) {
          var h = stockHealth();
          kpiBand = '<div class="ap-kpis">' +
            '<div class="ap-kpi ko"><div class="ap-kv">' + fmt(h.tension) + '</div><div class="ap-kl">en tension &lt; 7 j</div></div>' +
            '<div class="ap-kpi wa"><div class="ap-kv">' + fmt(h.acmd) + '</div><div class="ap-kl">à commander (7–21 j)</div></div>' +
            '<div class="ap-kpi"><div class="ap-kv">' + fmt(h.ross) + '</div><div class="ap-kl">rossignols / dormants</div></div>' +
            '<div class="ap-kpi eu"><div class="ap-kv mono">' + (V2.fmtEur ? V2.fmtEur(h.cap) : fmt(h.cap)) + '</div><div class="ap-kl">capital dormant</div></div>' +
            '</div>';

          var reaRows = reassort().map(function (o) {
            return '<div class="ap-row"><div class="ap-nm">' + esc(cap(o.d)) + (o.rupt ? ' <span class="ap-tag ru">ANSM</span>' : '') +
              '<small>' + fmt(Math.round(o.vM)) + '/mois réseau · stock ' + fmt(o.st) + '</small></div>' +
              '<div class="ap-covwrap">' + covBadge(o.cov) + '</div>' +
              '<div class="ap-cmd">commander<b>~' + fmt(o.qcmd) + '</b></div></div>';
          }).join('') || '<div class="ap-empty">Rien d\'urgent à réassortir.</div>';
          reaCard = '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-amber)">' + ICO('alert', 15, 2) + '</div>' +
            '<div><h3>À commander — réassort recommandé</h3><div class="ap-sub">couverture en jours (stock plateforme ÷ vitesse réseau) + quantité conseillée — ' + fmt(h.ncmd) + ' réfs à passer, top 24 par urgence</div></div></div>' +
            reaRows +
            '<div class="ap-foot" style="padding:10px 18px 12px;margin:0">Vitesse = ventes réseau/mois (WML, 6 mois). Cible ' + CIBLE + ' j, portée à ' + CIBLE_TENSION + ' j si tension ANSM ou marché en hausse. Photographie du dernier import stock+ventes.</div></div>';

          var rosRows = rossignols().map(function (o) {
            var cv = o.vM > 0 ? Math.round(o.cov) + ' j de stock' : 'aucune vente sur 6 mois';
            return '<div class="ap-row"><div class="ap-nm">' + esc(cap(o.d)) + (o.stale ? ' <span class="ap-tag ru">dormant</span>' : '') +
              '<small>' + cv + ' · stock ' + fmt(o.st) + '</small></div>' +
              '<div class="ap-vol mono">' + (V2.fmtEur ? V2.fmtEur(o.cap) : fmt(o.cap)) + '</div>' +
              '<div class="ap-cmd" style="color:#a8651a">ne plus<b style="color:#a8651a">commander</b></div></div>';
          }).join('') || '<div class="ap-empty">Aucun stock dormant détecté.</div>';
          rosCard = '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:#8A6D3B">' + ICO('cat', 15, 2) + '</div>' +
            '<div><h3>Rossignols — stock dormant</h3><div class="ap-sub">capital immobilisé à écouler, à ne plus commander — top 16 par € dormant</div></div></div>' +
            rosRows + '</div>';
        }
      } catch (e) { kpiBand = ''; reaCard = ''; rosCard = ''; }

      var ris = rising(), rup = ruptToSecure(), nouv = nouveautes(), sai = saisonNext(), neg = negoLabos();

      var risRows = ris.map(function (x) {
        return '<div class="ap-row"><div class="ap-nm">' + esc(cap(x.d)) + (x.ru ? ' <span class="ap-tag ru">rupture</span>' : '') + '<small>' + fmt(x.n) + ' officines réseau · marché FR ~' + fmt(x.mk) + ' bts/an</small></div>' +
          '<div class="ap-g">' + pctHtml(x.g) + '</div>' +
          '<div class="ap-st ' + (x.st > 0 ? 'ok' : 'ko') + '">' + (x.st > 0 ? fmt(x.st) + ' en stock' : 'stock 0') + '</div></div>';
      }).join('') || '<div class="ap-empty">Aucun produit en forte croissance détecté.</div>';

      var rupRows = rup.map(function (x) {
        return '<div class="ap-row"><div class="ap-nm">' + esc(cap(x.d)) + (x.dci ? '<small>' + esc(x.dci) + '</small>' : '') + '</div>' +
          '<div class="ap-mini">' + fmt(x.n) + ' offi.</div>' +
          '<div class="ap-st ' + (x.st > 0 ? 'ok' : 'ko') + '">' + (x.st > 0 ? fmt(x.st) + ' stock' : 'à sécuriser') + '</div></div>';
      }).join('') || '<div class="ap-empty">Aucune rupture sur les produits réseau.</div>';

      var nouvRows = nouv.map(function (x) {
        return '<div class="ap-row"><div class="ap-nm">' + esc(cap(x.n)) + (x.labo ? '<small>' + esc(x.labo) + '</small>' : '') + '</div>' +
          '<div class="ap-mini">AMM ' + esc(x.amm) + '</div></div>';
      }).join('') || '<div class="ap-empty">Aucune nouveauté récente.</div>';

      var saiRows = sai.rows.map(function (x) {
        return '<div class="ap-row"><div class="ap-nm">' + esc(cap(x.l)) + '<small>indice ' + x.next + ' en ' + MOIS[sai.next] + ' (vs ' + x.now + ' ce mois)</small></div>' +
          '<div class="ap-g">' + (x.delta > 0 ? '<span class="ap-up">▲ +' + x.delta + '</span>' : '<span class="ap-flat">' + x.next + '</span>') + '</div></div>';
      }).join('') || '<div class="ap-empty">Pas de pic saisonnier le mois prochain.</div>';

      var negRows = neg.map(function (x) {
        return '<div class="neg-row">' +
          '<div class="neg-top"><span class="neg-lab">' + esc(x.lab) + '</span>' +
            '<span class="neg-share">' + x.pct + ' % du volume Gx</span>' + pctHtml(x.g) + '</div>' +
          '<div class="neg-nums"><b>' + (V2.fmtEur ? V2.fmtEur(x.ca) : fmt(x.ca)) + '</b> · ' + fmt(x.q) + ' u/an · ' + x.nref + ' réfs</div>' +
          (x.tops.length ? '<div class="neg-tops">top : ' + x.tops.map(function (d) { return esc(cap(d)); }).join(' · ') + '</div>' : '') +
          '<div class="neg-line">Levier : ' + fmt(x.q) + ' u/an, ' + x.pct + ' % de notre volume générique' +
            (x.g != null && x.g > 0 ? ', en croissance de +' + Math.round(x.g) + ' %' : '') + ' → obtenir de meilleures conditions</div>' +
        '</div>';
      }).join('') || '<div class="ap-empty">Données génériqueurs indisponibles.</div>';

      function card(ico, title, sub, body, accent) {
        return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:' + accent + '">' + ICO(ico, 15, 2) + '</div>' +
          '<div><h3>' + title + '</h3><div class="ap-sub">' + sub + '</div></div></div>' + body + '</div>';
      }

      // ── Vue globale (3 secondes) : les 4 chiffres qui disent où agir ──
      var CC = carnetCounts || { buy: 0, sec: 0, pre: 0, arb: 0, red: 0, eur: 0, redEur: 0 };
      var nAnticip = 0;
      try { EVENTS.forEach(function (ev) { var z = evZone(ev); if (z === 'now' || z === 'prep') nAnticip++; }); if (_generData && _generData.newGeneric) nAnticip += _generData.newGeneric.length; } catch (e) {}
      function htile(sec, big, lab, sub, col) {
        return '<button class="ap-htile" style="--hc:' + col + '" onclick="V2.approSec(\'' + sec + '\')">' +
          '<div class="ap-hbig">' + big + '</div><div class="ap-hlab">' + lab + '</div><div class="ap-hsub">' + sub + '</div></button>';
      }
      var eurEng = (V2.fmtEur ? V2.fmtEur(CC.eur) : fmt(CC.eur));
      var eurDorm = (V2.fmtEur ? V2.fmtEur(CC.redEur) : fmt(CC.redEur));
      var hero = '<div class="ap-hero">' +
        htile('today', fmt(CC.buy + CC.sec), 'à commander', eurEng + ' à engager', 'var(--ip-blue)') +
        htile('today', fmt(CC.sec), 'à sécuriser', 'ruptures critiques', '#D5573B') +
        htile('anticiper', fmt(nAnticip), 'à anticiper', 'événements à venir', '#6D5AE6') +
        htile('stock', eurDorm, 'capital dormant', fmt(CC.red) + ' réfs à alléger', 'var(--c-amber)') +
        '</div>';

      // ── Navigation : 4 espaces clairs ──
      var NAV = [['today', 'Aujourd’hui'], ['actu', 'Actu'], ['anticiper', 'Anticiper'], ['stock', 'Stock & sites'], ['marche', 'Marché & négo']];
      var nav = '<div class="ap-nav">' + NAV.map(function (n) {
        return '<button class="ap-navb' + (_section === n[0] ? ' on' : '') + '" onclick="V2.approSec(\'' + n[0] + '\')">' + n[1] + '</button>';
      }).join('') + '</div>';

      // ── Contenu selon l'espace ──
      function secHead(t, s) { return '<div class="ap-sec">' + t + '</div>' + (s ? '<div class="ap-secsub">' + s + '</div>' : ''); }
      var content = '';
      if (_section === 'today') {
        content = calendarView(carnetHtml || '<div class="v2-card" style="padding:22px;text-align:center;color:var(--muted)">Chargement du carnet…</div>');
      } else if (_section === 'actu') {
        content = actuView();
      } else if (_section === 'anticiper') {
        content = secHead('Radar 90 jours', 'ce qui va bouger la demande : remboursements, génériques, baisses de prix, saison, ruptures') + radarHtml +
          secHead('Signaux &amp; échéances') + epiHtml + saiCipHtml + hasHtml + ansmHtml;
      } else if (_section === 'stock') {
        content = kpiBand + secHead('Réassort &amp; stock') + reaCard + etabHtml + basculesHtml + rosCard;
      } else {
        content = secHead('Intelligence marché') +
          card('spark', 'Ça monte', 'produits en croissance, présents dans le réseau — à renforcer au stock', risRows, 'var(--c-opp)') +
          '<div class="ap-grid2">' +
            card('alert', 'Ruptures à sécuriser', 'tension ANSM sur des produits que le réseau achète', rupRows, 'var(--c-amber)') +
            card('spark', 'La saison arrive', 'classes qui montent le mois prochain (Medic\'AM)', saiRows, '#6D5AE6') +
          '</div>' +
          card('cat', 'Nouveautés à référencer', 'AMM récentes (BDPM)', nouvRows, 'var(--ip-blue)') +
          card('pilo', 'Négo labos — ton levier', 'vrai volume réseau par génériqueur', negRows, '#0E7C86') +
          prixCard() +
          '<div class="ap-foot">Négo = vrai sell-in réseau (WML) par génériqueur. Génériques : pas d\'abandon de marge Intégral. « Ça monte » / saison = Medic\'AM / BDPM.</div>';
      }

      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' +
          '<div class="v2-page-title">Appro Intégral</div>' +
          '<div class="v2-page-sub">Ta vue du jour en un coup d\'œil — clique un chiffre ou un espace pour agir.</div>' +
          hero + nav + content + freshnessBar() +
        '</div>';
    }
  };

  function ensureCss() {
    if (document.getElementById('ap-css')) return;
    var st = document.createElement('style'); st.id = 'ap-css';
    st.textContent =
      '.ap-card{padding:0;overflow:hidden;margin-bottom:14px}' +
      '.ap-hd{display:flex;align-items:center;gap:11px;padding:13px 18px;border-bottom:1px solid var(--line)}' +
      '.ap-ic{width:28px;height:28px;border-radius:8px;color:#fff;display:grid;place-items:center;flex:none}' +
      '.ap-hd h3{margin:0;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--ip-ink)}' +
      '.ap-sub{font-size:11.5px;color:var(--muted);font-weight:500}' +
      '.ap-row{display:flex;align-items:center;gap:10px;padding:10px 18px;border-top:1px solid var(--line)}.ap-row:first-of-type{border-top:0}' +
      '.ap-nm{flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--ip-ink)}.ap-nm small{display:block;font-size:11px;color:var(--muted);font-weight:500;margin-top:1px}' +
      '.ap-g{flex:none;font-size:12.5px;font-weight:800;text-align:right;min-width:64px}' +
      '.ap-up{color:var(--c-opp)}.ap-down{color:#E0556E}.ap-flat{color:var(--muted)}' +
      '.ap-st{flex:none;font-size:11px;font-weight:800;border-radius:999px;padding:3px 9px;white-space:nowrap}' +
      '.ap-st.ok{color:var(--c-opp);background:#E7F5EC;border:1px solid #BFE6CF}.ap-st.ko{color:#a8651a;background:#FFF1DB;border:1px solid #F0C98A}' +
      '.ap-mini{flex:none;font-size:11.5px;color:var(--muted);font-weight:600;font-family:var(--mono)}' +
      '.ap-vol{flex:none;font-size:13px;font-weight:800;color:var(--ip-ink);text-align:right;min-width:74px}' +
      '.ap-tag{font-size:10px;font-weight:800;border-radius:999px;padding:1px 6px}.ap-tag.ru{color:#a8651a;background:#FFF1DB;border:1px solid #F0C98A}' +
      '.ap-empty{padding:16px 18px;font-size:12.5px;color:var(--muted)}' +
      '.ap-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}' +
      '.ap-foot{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5}' +
      '.ap-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}' +
      '.ap-kpi{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px 14px}' +
      '.ap-kpi.ko{border-color:#F3B0A0;background:#FFF1EE}.ap-kpi.wa{border-color:#F0C98A;background:#FFF8EC}' +
      '.ap-kv{font-size:24px;font-weight:800;color:var(--ip-ink);font-family:var(--mono);letter-spacing:-.02em;line-height:1}' +
      '.ap-kpi.ko .ap-kv{color:#C0561A}.ap-kpi.wa .ap-kv{color:#a8651a}' +
      '.ap-kl{font-size:11px;color:var(--muted);font-weight:600;margin-top:3px}' +
      '.ap-covwrap{flex:none;min-width:66px;text-align:right}' +
      '.ap-cov{font-size:11px;font-weight:800;border-radius:999px;padding:3px 9px;white-space:nowrap}' +
      '.ap-cov.ko{color:#C0561A;background:#FFECEC;border:1px solid #F3B0A0}.ap-cov.wa{color:#a8651a;background:#FFF1DB;border:1px solid #F0C98A}.ap-cov.ok{color:var(--c-opp);background:#E7F5EC;border:1px solid #BFE6CF}' +
      '.ap-cmd{flex:none;font-size:10.5px;color:var(--muted);font-weight:600;text-align:right;min-width:78px;line-height:1.25}.ap-cmd b{display:block;font-size:15px;font-weight:800;color:var(--ip-ink);font-family:var(--mono)}' +
      /* carnet d'achat du jour (salle de marché) */
      '.cb-card{padding:0;overflow:hidden;margin-bottom:16px;border:1px solid var(--line);border-top:3px solid var(--ip-blue)}' +
      '.cb-hd{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line)}' +
      '.cb-hd h3{margin:0;font-size:15px;font-weight:800;color:var(--ip-ink)}' +
      '.cb-sub{font-size:12px;color:var(--muted);font-weight:500;margin-top:2px}' +
      '.cb-tot{margin-left:auto;text-align:right;flex:none}.cb-tot b{display:block;font-size:20px;font-weight:800;font-family:var(--mono);color:var(--ip-blue)}.cb-tot small{font-size:10px;color:var(--muted);font-weight:600}' +
      '.cb-kpis{display:flex;gap:7px;flex-wrap:wrap;padding:12px 16px 6px}' +
      '.cb-k{font-size:11.5px;font-weight:800;border-radius:999px;padding:4px 11px}' +
      '.cb-buy{color:#0B7A4B;background:#E7F5EC;border:1px solid #BFE6CF}' +
      '.cb-sec{color:#C0392B;background:#FDEDEA;border:1px solid #F3B0A0}' +
      '.cb-pre{color:#6D5AE6;background:#EFEBFB;border:1px solid #D3C9F5}' +
      '.cb-arb{color:#0E7C86;background:#E5F4F5;border:1px solid #B8E0E3}' +
      '.cb-red{color:#a8651a;background:#FFF1DB;border:1px solid #F0C98A}' +
      '.cb-exp{flex:none;font-size:12px;font-weight:800;color:var(--ip-blue);background:#EAF1FF;border:1px solid #C8DBFF;border-radius:9px;padding:8px 12px;cursor:pointer;margin-left:10px}.cb-exp:hover{background:#DCE8FF}' +
      '.cb-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:11px 16px 4px;overflow-x:auto}' +
      '.cb-tab{flex:none;font-size:12px;font-weight:700;color:var(--muted);background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:999px;padding:5px 12px;cursor:pointer}' +
      '.cb-tab b{font-family:var(--mono)}.cb-tab.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}' +
      '.cb-row{display:flex;align-items:center;gap:11px;padding:10px 16px;border-top:1px solid var(--line);cursor:pointer}.cb-row:hover{background:var(--card-2,#F6F8FB)}' +
      '.cb-tag{flex:none;width:92px;text-align:center;font-size:10.5px;font-weight:800;border-radius:7px;padding:4px 0}' +
      '.cb-nm{flex:1;min-width:0;font-size:13.5px;font-weight:700;color:var(--ip-ink)}.cb-nm small{display:block;font-size:11px;color:var(--muted);font-weight:500;margin-top:1px}' +
      '.cb-cov{flex:none;min-width:56px;text-align:right}' +
      '.cb-qt{flex:none;min-width:64px;text-align:right;font-size:14px;font-weight:800;font-family:var(--mono);color:var(--ip-ink)}.cb-qt small{font-size:10px;color:var(--muted);font-weight:600;font-family:var(--font)}' +
      '@media(max-width:600px){.cb-tag{width:78px}.cb-cov{display:none}}' +
      /* ticket de position (overlay) */
      '.tk-ov{position:fixed;inset:0;z-index:9000;background:rgba(16,19,28,.45);display:none;align-items:center;justify-content:center;padding:16px}' +
      '.tk-box{background:var(--card);border:1px solid var(--line);border-radius:16px;max-width:520px;width:100%;max-height:88vh;overflow:auto;padding:20px 20px 22px;position:relative;box-shadow:0 18px 50px rgba(16,19,28,.28)}' +
      '.tk-x{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card-2,#F6F8FB);font-size:14px;font-weight:800;color:var(--muted);cursor:pointer}' +
      '.tk-title{font-size:17px;font-weight:800;color:var(--ip-ink);padding-right:34px;line-height:1.2}' +
      '.tk-cip{font-size:11.5px;color:var(--muted);font-weight:600;font-family:var(--mono);margin:3px 0 10px}' +
      '.tk-sig{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}' +
      '.tk-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}' +
      '.tk-kpi{background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:11px;padding:10px 8px;text-align:center}' +
      '.tk-kpi b{display:block;font-size:17px;font-weight:800;font-family:var(--mono);color:var(--ip-ink)}.tk-kpi span{font-size:10px;color:var(--muted);font-weight:600}' +
      '.tk-price{font-size:12.5px;color:var(--muted);background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:10px;padding:9px 12px;margin-bottom:14px}.tk-price b{color:var(--ip-ink);font-family:var(--mono)}' +
      '.tk-h{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:6px 0 8px}' +
      '.tk-proj{border:1px solid var(--line);border-radius:10px;background:var(--card-2,#F6F8FB);padding:6px 8px;margin-bottom:4px}.tk-proj svg{width:100%;height:82px;display:block}' +
      '.tk-projlab{display:flex;justify-content:space-between;font-size:11px;font-weight:800;margin:0 2px 14px}' +
      '.tk-spark{display:flex;align-items:flex-end;gap:6px;height:96px;padding:0 2px}' +
      '.tk-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px}' +
      '.tk-bar i{width:100%;max-width:34px;background:var(--ip-blue);border-radius:4px 4px 0 0;display:block}' +
      '.tk-bar b{font-size:10px;font-weight:700;color:var(--ip-ink);font-family:var(--mono)}.tk-bar span{font-size:9.5px;color:var(--muted);font-weight:600}' +
      '.tk-sites{display:flex;align-items:flex-end;gap:8px;height:52px;margin-bottom:4px}' +
      '.tk-site{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px}.tk-site i{width:100%;max-width:26px;background:#0E7C86;border-radius:3px 3px 0 0;display:block}.tk-site span{font-size:9px;font-weight:700;color:var(--muted)}.tk-site b{font-size:9.5px;font-family:var(--mono);color:var(--ip-ink)}' +
      /* vue globale (hero 4 tuiles) + navigation */
      '.ap-hero{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}' +
      '.ap-htile{text-align:left;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--hc);border-radius:14px;padding:13px 15px;cursor:pointer;transition:.15s}' +
      '.ap-htile:hover{box-shadow:0 4px 14px rgba(16,19,28,.08);transform:translateY(-1px)}' +
      '.ap-hbig{font-size:26px;font-weight:800;font-family:var(--mono);color:var(--hc);letter-spacing:-.02em;line-height:1}' +
      '.ap-hlab{font-size:13px;font-weight:800;color:var(--ip-ink);margin-top:5px}' +
      '.ap-hsub{font-size:11px;color:var(--muted);font-weight:600;margin-top:1px}' +
      '.ap-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;position:sticky;top:0;z-index:10;background:var(--bg,#EEF1F6);padding:8px 0}' +
      '.ap-navb{flex:1;min-width:120px;font-size:13.5px;font-weight:800;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:11px;padding:10px 8px;cursor:pointer;transition:.15s}' +
      '.ap-navb:hover{border-color:#C9D2E0}.ap-navb.on{background:var(--ip-blue);color:#fff;border-color:var(--ip-blue)}' +
      '@media(max-width:640px){.ap-hero{grid-template-columns:1fr 1fr}.ap-navb{min-width:0;font-size:12.5px;padding:9px 4px}}' +
      /* vue calendrier (groupée fournisseur) */
      '.cl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}' +
      '.cl-tab{flex:1;min-width:88px;font-size:12.5px;font-weight:800;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 6px;cursor:pointer}.cl-tab.on{background:var(--ip-ink);color:#fff;border-color:var(--ip-ink)}' +
      '.cl-band{display:flex;gap:5px;margin-bottom:14px}' +
      '.cl-bd{flex:1;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:6px 2px}.cl-bd .dn{font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase}.cl-bd .cn{font-size:14px;font-weight:800;font-family:var(--mono);margin-top:2px}.cl-bd.today{background:var(--ip-blue);color:#fff}.cl-bd.today .dn{color:#fff;opacity:.85}' +
      '.cl-th{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}' +
      '.cl-big{font-size:18px;font-weight:900;margin:3px 0 12px;color:var(--ip-ink)}' +
      '.cl-today{margin-bottom:6px}' +
      '.cl-sup{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--c);border-radius:12px;padding:11px 13px;margin-bottom:9px}' +
      '.cl-suh{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.cl-suh b{font-size:14px;font-weight:800}.cl-suh span{font-size:11.5px;color:var(--muted);font-weight:700;font-family:var(--mono);white-space:nowrap}' +
      '.cl-line{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;background:none;border:0;border-top:1px solid var(--line);padding:7px 0 0;margin-top:7px;font:inherit;cursor:pointer;text-align:left}' +
      '.cl-line span{font-size:12.5px;color:var(--ip-ink);font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cl-line b{font-family:var(--mono);font-size:13px;color:var(--c);flex:none}' +
      '.cl-line:first-of-type{border-top:0}' +
      '.cl-more{font-size:11px;color:var(--muted);font-weight:700;text-align:center;padding:4px}' +
      '.cl-nx{display:flex;align-items:center;gap:10px;padding:9px 2px;border-top:1px solid var(--line);font-size:13px}.cl-nx .d{width:76px;font-weight:800;color:var(--ip-ink)}.cl-nx .i{flex:1;color:var(--muted);font-weight:600;font-size:12px}' +
      '.cl-wk{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}' +
      '.cl-wc{background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:11px;padding:7px 6px;min-height:110px}.cl-wc.today{background:#EAF1FF;border-color:#C8DBFF}' +
      '.cl-wch{font-size:10.5px;font-weight:800;text-transform:uppercase;color:var(--muted);display:flex;justify-content:space-between;margin-bottom:6px}.cl-wch b{color:var(--ip-ink);font-family:var(--mono)}' +
      '.cl-wc .cl-sup{padding:7px 8px;margin-bottom:6px}.cl-wc .cl-suh b{font-size:12px}.cl-wc .cl-suh span{font-size:10px}.cl-wc .cl-line{display:none}' +
      '.cl-mhead{font-size:14px;font-weight:800;margin-bottom:8px}' +
      '.cl-mgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}' +
      '.cl-mdn{font-size:10px;font-weight:800;color:var(--muted);text-align:center}' +
      '.cl-mcell{aspect-ratio:1;border:1px solid var(--line);border-radius:9px;background:var(--card);position:relative}.cl-mcell.today{outline:2px solid var(--ip-blue)}' +
      '.cl-mcell .dn{position:absolute;top:4px;left:6px;font-size:10.5px;font-weight:700;color:var(--muted);font-family:var(--mono)}.cl-mcell .cn{position:absolute;top:4px;right:6px;font-size:12px;font-weight:800;font-family:var(--mono)}.cl-mcell .ld{position:absolute;left:5px;right:5px;bottom:5px;height:5px;border-radius:4px}' +
      '@media(max-width:640px){.cl-wk{grid-template-columns:1fr}.cl-wc{min-height:0}.cl-wc .cl-line{display:flex}.cl-tab{min-width:0}}' +
      '.ap-sec{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ip-ink);margin:22px 0 2px}' +
      '.ap-secsub{font-size:12px;color:var(--muted);margin:0 0 12px;line-height:1.5}' +
      /* actu appro + prédictif */
      '.ac-pred{display:flex;align-items:center;gap:12px;padding:11px 14px;border-top:1px solid var(--line)}.ac-pred:first-child{border-top:0}' +
      '.ac-ic{width:34px;height:34px;border-radius:10px;color:#fff;display:grid;place-items:center;font-size:15px;font-weight:800;flex:none}' +
      '.ac-pt{min-width:0}.ac-pt b{display:block;font-size:14px;font-weight:800;color:var(--ip-ink)}.ac-pt span{font-size:12px;color:var(--muted);font-weight:600}' +
      '.ac-news{display:flex;align-items:flex-start;gap:11px;padding:12px 14px;border-top:1px solid var(--line);text-decoration:none}.ac-news:first-child{border-top:0}.ac-news:hover{background:var(--card-2,#F6F8FB)}' +
      '.ac-cat{flex:none;font-size:10px;font-weight:800;color:#fff;border-radius:999px;padding:3px 9px;margin-top:1px;white-space:nowrap}' +
      '.ac-nm{min-width:0}.ac-nm b{display:block;font-size:13.5px;font-weight:700;color:var(--ip-ink);line-height:1.3}.ac-nm span{font-size:11.5px;color:var(--muted);font-weight:600}' +
      '.ap-fresh{font-size:11px;color:var(--muted);line-height:1.5;margin-top:20px;padding-top:12px;border-top:1px solid var(--line)}.ap-fresh b{color:var(--ip-ink)}' +
      '.ap-fresh-warn{font-size:11.5px;line-height:1.5;margin-top:8px;padding:8px 11px;border-radius:9px;background:rgba(213,87,59,.09);border:1px solid rgba(213,87,59,.28);color:var(--rose,#D5573B)}' +
      /* radar */
      '.rad{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:6px}' +
      '.rzone{padding:0;overflow:hidden}' +
      '.rzh{padding:12px 15px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:9px}' +
      '.rzh .ring{width:16px;height:16px;border-radius:50%;border:3px solid var(--z);flex:none}' +
      '.rzh h3{margin:0;font-size:12.5px;font-weight:800}.rzh small{display:block;font-size:10.5px;color:var(--muted);font-weight:600}' +
      '.rev{padding:11px 15px;border-top:1px solid var(--line)}.rev:first-of-type{border-top:0}' +
      '.rev .rt{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:var(--ip-ink)}' +
      '.rev .rs{font-size:11.5px;color:var(--muted);margin:3px 0 0 14px;line-height:1.4}' +
      '.rev .rr{font-size:11.5px;font-weight:800;color:var(--c-opp);margin:5px 0 0 14px}' +
      /* stock par établissement */
      '.sites{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:9px;padding:14px 16px}' +
      '.site{background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:11px;padding:9px 8px;text-align:center}' +
      '.site .code{font-size:12px;font-weight:800}.site .qt{font-size:16px;font-weight:800;margin:2px 0}.site .pct{font-size:10px;color:var(--muted);font-weight:700}' +
      '.site .sbar{height:5px;border-radius:3px;background:#E4E8EF;margin-top:7px;overflow:hidden}.site .sbar i{display:block;height:100%;background:#0E7C86;border-radius:3px}' +
      '.imbhd{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--ip-ink);padding:6px 16px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center}' +
      '.imbhd span{background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:999px;padding:0 8px;font-size:11px;color:var(--muted)}' +
      '.imb{padding:12px 16px;border-top:1px solid var(--line)}' +
      '.imb .imn{font-size:13px;font-weight:800;color:var(--ip-ink)}' +
      '.imb .imm{font-size:11.5px;color:var(--muted);margin:2px 0 8px}.imb .imm b{color:var(--ip-ink)}' +
      '.imbar{display:flex;align-items:flex-end;gap:6px;height:44px}' +
      '.imbar .col{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}' +
      '.imbar .col .b{width:100%;max-width:32px;border-radius:3px 3px 0 0;background:#C6D0DE;min-height:2px}.imbar .col .b.hot{background:var(--c-amber)}.imbar .col .b.zero{background:#EAEDF2}' +
      '.imbar .col small{font-size:9px;color:var(--muted);font-weight:700}' +
      '.imb .imfix{font-size:11.5px;font-weight:800;color:#0E7C86;margin-top:8px}.imb .imfix b{color:var(--ip-ink)}' +
      /* négo labo chiffrée */
      '.neg-row{padding:12px 16px;border-top:1px solid var(--line)}.neg-row:first-of-type{border-top:0}' +
      '.neg-top{display:flex;align-items:center;gap:9px}' +
      '.neg-lab{font-size:14px;font-weight:800;color:var(--ip-ink)}' +
      '.neg-share{font-size:11px;font-weight:700;color:var(--muted);background:var(--card-2,#F6F8FB);border:1px solid var(--line);border-radius:999px;padding:1px 8px}' +
      '.neg-top .ap-up,.neg-top .ap-down,.neg-top .ap-flat{margin-left:auto;font-size:12.5px;font-weight:800}' +
      '.neg-nums{font-size:12.5px;color:var(--ip-ink);margin-top:5px;font-family:var(--mono)}.neg-nums b{font-weight:800}' +
      '.neg-tops{font-size:11.5px;color:var(--muted);margin-top:3px}' +
      '.neg-line{font-size:11.5px;font-weight:700;color:#0E7C86;margin-top:6px;line-height:1.4}' +
      '@media(max-width:720px){.ap-grid2{grid-template-columns:1fr}.ap-kpis{grid-template-columns:1fr 1fr}.rad{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }
})();
