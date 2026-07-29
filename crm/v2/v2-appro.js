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
    Object.keys(stk).forEach(function (c) {
      var a = dem[c], tot = a ? (a[0] + a[1] + a[2] + a[3] + a[4] + a[5]) : 0;
      var vM = tot / 6, st = stk[c], vD = vM / 30;
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
  function evZone(ev) { if (ev.t === 'vig') return 'surv'; var dd = evDays(ev); if (dd < 8) return 'now'; if (dd < 46) return 'prep'; if (dd < 200) return 'surv'; return null; }

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

  // ═══ STOCK PAR ÉTABLISSEMENT (7 sites) + rééquilibrage inter-sites — ETAB_PRICES (NR) ═══
  var _etabState = 0;   // 0 pas tenté · 1 en cours · 2 fini
  function ensureEtab() {
    if (window.ETAB_PRICES) { _etabState = 2; return; }
    if (_etabState) return;
    _etabState = 1;
    var s = document.createElement('script');
    s.src = 'etab-prices-data.js?v=' + (window.__APPRO_V || '20260729c'); s.async = false;
    s.onload = function () { _etabState = 2; try { V2.render(); } catch (e) {} };
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
        '<div class="pct">' + Math.round(s.stock / ss.total * 100) + ' %</div><div class="sbar"><i style="width:' + Math.round(s.stock / mx * 100) + '%"></i></div></div>';
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
        .then(function (j) { _generData = j || {}; _generState = 2; try { V2.render(); } catch (e) {} })
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
        .then(function (j) { _ansmData = j || {}; _ansmState = 2; try { V2.render(); } catch (e) {} })
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
    varicelle: { fam: 'antihistaminiques · antiseptiques cutanés', kw: /C[EÉ]TIRIZIN|LORATADIN|POLARAMINE|ANTIHIST|CHLORHEXIDINE|SEPTIVON|BISEPTINE|CICALFATE|DERMASPRAID|CALADRYL|DIPROSONE/i }
  };
  function ensureEpidemio() {
    if (_epiData || _epiState) return;
    _epiState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('epidemio.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _epiData = j || {}; _epiState = 2; try { V2.render(); } catch (e) {} })
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
    return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:var(--c-opp)">✚</div><div><h3>Signaux de demande — épidémie</h3>' +
      '<div class="ap-sub">Réseau Sentinelles ' + wl + ' · ce qui monte = à pré-stocker avant le rush comptoir (incidence France /100k + tendance hebdo)</div></div></div>' + rows +
      '<div class="ap-foot" style="padding:9px 16px 11px;margin:0">Réfs = produits du catalogue réseau associés à la pathologie (mots-clés). Croiser avec le stock avant le pic.</div></div>';
  }

  // ═══ ANTICIPATION RÉGLEMENTAIRE (HAS, robot mensuel) — le prochain Wegovy 3-6 mois avant ═══
  var _hasState = 0, _hasData = null, _bought = null, _boughtRef = null;
  function boughtSet() {
    var S = window.WML_SALES; if (!S) return {};
    if (_bought && _boughtRef === S) return _bought;
    var b = {}; for (var i = 0; i < S.length; i++) { var r = S[i]; if (r[4] > 0) b[String(r[3])] = 1; }
    _bought = b; _boughtRef = S; return b;
  }
  function ensureHas() {
    if (_hasData || _hasState) return;
    _hasState = 1;
    try {
      var day = new Date().toISOString().slice(0, 10);
      fetch('has-avis.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { _hasData = j || {}; _hasState = 2; try { V2.render(); } catch (e) {} })
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
      ensureHas();    // charge l'anticipation réglementaire HAS (robot mensuel)
      // ── Cockpit réassort (crash-safe : ne casse jamais la page si un flux manque) ──
      var kpiBand = '', reaCard = '', rosCard = '', radarHtml = '', etabHtml = '', basculesHtml = '', ansmHtml = '', epiHtml = '', hasHtml = '';
      try {
        radarHtml = radarSection(window.WML_SALES && window.STOCK_IP ? reassort() : []);
        etabHtml = etabSection();
        basculesHtml = basculesCard();
        ansmHtml = ansmCard();
        epiHtml = epidemioCard();
        hasHtml = hasCard();
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

      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' +
          '<div class="v2-page-title">Appro Intégral</div>' +
          '<div class="v2-page-sub">Maîtriser les achats et anticiper au jour près : santé du stock, radar des événements à venir, réassort conseillé, équilibre des 7 sites, saison et leviers de négo — sur la demande réelle du réseau. Outil de l\'équipe achats.</div>' +
          kpiBand +
          '<div class="ap-sec">Radar 90 jours — à anticiper</div>' +
          '<div class="ap-secsub">Ce qui va bouger la demande : remboursements, génériques, baisses de prix, saison, ruptures — croisé avec ton réassort urgent en temps réel.</div>' +
          radarHtml +
          epiHtml +
          hasHtml +
          '<div class="ap-sec">Piloter les achats</div>' +
          reaCard +
          ansmHtml +
          basculesHtml +
          etabHtml +
          rosCard +
          '<div class="ap-sec">Intelligence marché</div>' +
          card('spark', 'Ça monte', 'produits en croissance, présents dans le réseau — à renforcer au stock', risRows, 'var(--c-opp)') +
          '<div class="ap-grid2">' +
            card('alert', 'Ruptures à sécuriser', 'tension ANSM sur des produits que le réseau achète', rupRows, 'var(--c-amber)') +
            card('spark', 'La saison arrive', 'classes qui montent le mois prochain (Medic\'AM)', saiRows, '#6D5AE6') +
          '</div>' +
          card('cat', 'Nouveautés à référencer', 'AMM récentes (BDPM) — anticiper le référencement', nouvRows, 'var(--ip-blue)') +
          card('pilo', 'Négo labos — ton levier', 'vrai volume réseau (sell-in WML) par génériqueur — poids de négociation chiffré', negRows, '#0E7C86') +
          '<div class="ap-foot">Négo labos = vrai sell-in réseau (WML) par génériqueur. Génériques : pas d\'abandon de marge Intégral (les génériqueurs gèrent leurs remises). « Ça monte » / saison = Medic\'AM / BDPM annualisés. Princeps : labo non mappé.</div>' +
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
      '.ap-sec{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ip-ink);margin:22px 0 2px}' +
      '.ap-secsub{font-size:12px;color:var(--muted);margin:0 0 12px;line-height:1.5}' +
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
