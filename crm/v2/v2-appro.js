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

  // ── Section 3 : négo labos (agrégation par génériqueur : volume + tendance = levier) ──
  function negoLabos() {
    var P = window.PROD_STATS || [], G = window.GENERIQUEURS || {}, by = {};
    for (var i = 0; i < P.length; i++) {
      var r = P[i], lab = G[r.c]; if (!lab) continue;
      var o = by[lab] || (by[lab] = { lab: lab, ca: 0, n: 0, gs: 0, gn: 0 });
      o.ca += (r.ca || 0) * (r.n || 0);   // volume réseau approché = CA/pharmacie × nb pharmacies
      o.n += 1;
      var g = tend(r.c); if (g != null) { o.gs += g; o.gn++; }
    }
    var out = Object.keys(by).map(function (k) { var o = by[k]; o.g = o.gn ? o.gs / o.gn : null; return o; });
    out.sort(function (a, b) { return b.ca - a.ca; });
    return out.slice(0, 14);
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

      // ── Cockpit réassort (crash-safe : ne casse jamais la page si un flux manque) ──
      var kpiBand = '', reaCard = '', rosCard = '';
      try {
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
        return '<div class="ap-row"><div class="ap-nm">' + esc(x.lab) + '<small>' + fmt(x.n) + ' réfs réseau</small></div>' +
          '<div class="ap-vol mono">' + (V2.fmtEur ? V2.fmtEur(x.ca) : fmt(x.ca)) + '</div>' +
          '<div class="ap-g">' + pctHtml(x.g) + '</div></div>';
      }).join('') || '<div class="ap-empty">Données génériqueurs indisponibles.</div>';

      function card(ico, title, sub, body, accent) {
        return '<div class="v2-card ap-card"><div class="ap-hd"><div class="ap-ic" style="background:' + accent + '">' + ICO(ico, 15, 2) + '</div>' +
          '<div><h3>' + title + '</h3><div class="ap-sub">' + sub + '</div></div></div>' + body + '</div>';
      }

      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap">' +
          '<div class="v2-page-title">Appro Intégral</div>' +
          '<div class="v2-page-sub">Maîtriser les achats et anticiper les ruptures : couverture de stock, réassort conseillé et leviers de négo — d\'après la demande réelle du réseau. Outil de l\'équipe achats.</div>' +
          kpiBand +
          reaCard +
          rosCard +
          card('spark', 'Ça monte', 'produits en croissance, présents dans le réseau — à renforcer au stock', risRows, 'var(--c-opp)') +
          '<div class="ap-grid2">' +
            card('alert', 'Ruptures à sécuriser', 'tension ANSM sur des produits que le réseau achète', rupRows, 'var(--c-amber)') +
            card('spark', 'La saison arrive', 'classes qui montent le mois prochain (Medic\'AM)', saiRows, '#6D5AE6') +
          '</div>' +
          card('cat', 'Nouveautés à référencer', 'AMM récentes (BDPM) — anticiper le référencement', nouvRows, 'var(--ip-blue)') +
          card('pilo', 'Négo labos — ton levier', 'volume réseau par génériqueur × tendance = poids de négociation', negRows, '#0E7C86') +
          '<div class="ap-foot">Chiffres indicatifs (Medic\'AM annualisé / BDPM / demande réseau Intégral). Volume négo = CA moyen/officine × nb officines. Princeps : labo non mappé (génériqueurs uniquement).</div>' +
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
      '@media(max-width:720px){.ap-grid2{grid-template-columns:1fr}.ap-kpis{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(st);
  }
})();
