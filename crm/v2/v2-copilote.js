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

  // ── styles (mobile-first : cartes, chips, cibles 44px) ──
  function injectCss() {
    if (document.getElementById('v2-copilote-css')) return;
    var st = document.createElement('style'); st.id = 'v2-copilote-css';
    st.textContent = [
      /* héro calme */
      '.co-hero{position:relative;margin-bottom:20px}',
      '.co-hero h1{font-size:clamp(24px,4.6vw,34px);font-weight:800;letter-spacing:-.025em;margin:0 0 6px}',
      '.co-hero h1 .ac{color:var(--ip-blue)}',
      '.co-hero p{color:var(--muted);font-size:15px;line-height:1.5;margin:0;max-width:58ch}',
      /* capteurs actifs — bande discrète */
      '.co-feeds{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}',
      '.co-feed{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);font-size:11.5px;font-weight:600;color:var(--muted-2)}',
      '.co-feed .d{width:6px;height:6px;border-radius:50%;background:var(--muted-2);flex:none}',
      '.co-feed.on{color:var(--muted)}',
      '.co-feed.on .d{background:var(--c-opp)}',
      '.co-feed.on.warn .d{background:var(--c-amber)}',
      '.co-feed.on.info .d{background:var(--ip-blue)}',
      /* sections */
      '.co-sec{margin-top:28px}',
      '.co-sec-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px}',
      '.co-sec-h h2{font-size:19px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '.co-pill{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 9%,var(--card));padding:3px 9px;border-radius:var(--r-pill)}',
      '.co-sub{color:var(--muted);font-size:13.5px;line-height:1.5;margin:0 0 14px;max-width:70ch}',
      '.co-sub b{color:var(--ip-ink)}',
      /* chips secteur (filtre département) */
      '.co-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}',
      '.co-chip{min-height:44px;padding:0 16px;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);font:inherit;font-size:13.5px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;box-shadow:var(--sh-1);transition:border-color .2s var(--ease-soft),color .2s var(--ease-soft)}',
      '.co-chip:hover{border-color:color-mix(in srgb,var(--ip-blue) 32%,var(--line));color:var(--ip-ink)}',
      '.co-chip.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff;box-shadow:var(--sh-blue)}',
      /* cartes officines — la tournée */
      '.co-tour{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:var(--gap-grid,14px)}',
      '.co-pcard{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:9px;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);padding:16px;box-shadow:var(--sh-1);cursor:pointer;font:inherit;color:var(--ip-ink);min-height:44px;transition:transform .22s var(--ease),box-shadow .22s var(--ease-soft),border-color .22s var(--ease-soft)}',
      '.co-pcard:hover{transform:translateY(var(--mo-lift,-3px));box-shadow:var(--sh-2)}',
      '.co-pcard.sel{border-color:color-mix(in srgb,var(--ip-blue) 45%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--ip-blue) 13%,transparent),var(--sh-2)}',
      '.co-pcard .nm{font-weight:800;font-size:15.5px;line-height:1.3;letter-spacing:-.01em}',
      '.co-pcard .loc{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;color:var(--muted);font-size:12.5px}',
      '.co-pcard .loc svg{color:var(--ip-blue);flex:none}',
      '.co-pcard .loc b{font-family:var(--mono);font-weight:700;color:var(--ip-ink-2)}',
      '.co-push{display:flex;align-items:baseline;gap:7px;margin-top:auto;padding-top:4px}',
      '.co-push b{font-family:var(--mono);font-size:26px;font-weight:800;color:var(--ip-blue);line-height:1;font-variant-numeric:tabular-nums}',
      '.co-push span{font-size:12.5px;font-weight:600;color:var(--muted)}',
      '.co-warnchip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--c-amber-txt,#9A5B12);background:#FBF1E2;border:1px solid #F0E2C6;padding:3px 9px;border-radius:var(--r-pill);width:max-content;max-width:100%}',
      '.co-warnchip svg{flex:none}',
      '.co-go{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;color:var(--ip-blue)}',
      '.co-go svg{transition:transform .2s var(--ease)}',
      '.co-pcard:hover .co-go svg{transform:translateX(3px)}',
      /* focus officine — prépare ta visite */
      '#co-focus{scroll-margin-top:calc(var(--topbar-h,60px) + 12px)}',
      '.co-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden;box-shadow:var(--sh-1)}',
      '.co-fhead{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:var(--card-2)}',
      '.co-fhead .fn{min-width:0;flex:1 1 220px}',
      '.co-fhead h3{font-size:17px;font-weight:800;letter-spacing:-.015em;margin:0 0 3px}',
      '.co-fzone{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;color:var(--muted);font-size:13px}',
      '.co-fzone svg{color:var(--ip-blue)}.co-fzone b{font-family:var(--mono);font-weight:800;color:var(--ip-ink-2)}',
      '.co-facts{display:flex;flex-wrap:wrap;align-items:center;gap:10px}',
      '.co-lab{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}',
      '.co-select{font:inherit;font-size:14px;font-weight:600;color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:var(--r-btn,12px);padding:10px 12px;min-height:44px;max-width:100%;cursor:pointer}',
      '.co-facts .v2-btn{min-height:44px}',
      /* petites cartes argument produit */
      '.co-args{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:16px}',
      '.co-arg{display:flex;flex-direction:column;gap:8px;border:1px solid var(--line);border-radius:var(--r-md,14px);background:var(--card);padding:14px;box-shadow:var(--sh-1)}',
      '.co-arg .t{font-weight:800;font-size:14.5px;line-height:1.3;color:var(--ip-ink)}',
      '.co-arg .t .psh{display:block;color:var(--muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}',
      '.co-arg .s{font-size:13px;color:var(--muted);line-height:1.55;margin:0}',
      '.co-arg .s b{font-family:var(--mono);color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.co-arg .s b.stk{color:var(--c-opp)}',
      '.co-prix{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:auto;padding-top:4px}',
      '.co-net{font-family:var(--mono);font-weight:800;font-size:15px;color:var(--ip-blue);font-variant-numeric:tabular-nums}',
      '.co-ab{font-size:11.5px;font-weight:700;color:var(--c-mint-txt,#0F7A52);background:color-mix(in srgb,var(--c-opp) 12%,var(--card));padding:2px 8px;border-radius:var(--r-pill)}',
      '.co-arg .v2-btn{min-height:44px;justify-content:center}',
      /* alerte « à sécuriser » */
      '.co-secu{margin:0 16px 16px;border:1px solid #F0E2C6;background:#FDF7EC;border-radius:var(--r-md,14px);padding:12px 14px}',
      '.co-secu h4{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:var(--c-amber-txt,#9A5B12);margin:0 0 4px}',
      '.co-secu h4 svg{flex:none}',
      '.co-secu-r{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:8px 0;border-top:1px solid #F0E2C6;font-size:13px}',
      '.co-secu-r:first-of-type{border-top:none}',
      '.co-secu-r .p{font-weight:700;color:var(--ip-ink)}',
      '.co-secu-r .m{color:var(--muted);font-size:12px}',
      /* saisonnalité — bande légère */
      '.co-saison{display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px}',
      '.co-sais-i{display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card-2)}',
      '.co-sais-up{font-family:var(--mono);font-weight:800;color:var(--c-opp);font-size:12.5px}',
      '.co-sais-l{font-size:13px;font-weight:600;color:var(--ip-ink)}',
      /* vue marché — repliée, secondaire */
      '.co-det{border:1px solid var(--line);border-radius:var(--r-card);background:var(--card);box-shadow:var(--sh-1);overflow:hidden}',
      '.co-det>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:16px 18px;min-height:44px;cursor:pointer;font-weight:800;font-size:15px;color:var(--ip-ink)}',
      '.co-det>summary::-webkit-details-marker{display:none}',
      '.co-det>summary .ch{flex:none;display:inline-flex;color:var(--muted-2);transition:transform .2s var(--ease)}',
      '.co-det[open]>summary .ch{transform:rotate(90deg)}',
      '.co-det>summary .co-pill{margin-left:auto}',
      '.co-det .co-sub{padding:0 18px 4px}',
      '.co-mkt{border-top:1px solid var(--line-2);padding:12px 18px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}',
      '.co-mkt .id{flex:1 1 200px;min-width:0}',
      '.co-mkt .id .p{font-weight:700;font-size:14px;color:var(--ip-ink)}',
      '.co-mkt .id .c{font-family:var(--mono);font-size:11.5px;color:var(--muted-2);margin-top:1px}',
      '.co-mkt .ms{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}',
      '.co-mkt .m{display:flex;flex-direction:column;gap:1px;min-width:60px}',
      '.co-mkt .m i{font-style:normal;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted-2)}',
      '.co-mkt .m span{font-family:var(--mono);font-weight:700;font-size:13px;color:var(--ip-ink);font-variant-numeric:tabular-nums}',
      '.co-mkt .m span.blue{color:var(--ip-blue)}.co-mkt .m span.grn{color:var(--c-opp)}',
      '.co-mkt .v2-btn{min-height:44px;margin-left:auto}',
      '.co-mkth{padding:16px 18px 6px;font-size:13.5px;font-weight:800;color:var(--ip-ink);border-top:1px solid var(--line)}',
      /* chips famille / tension */
      '.co-fam{display:inline-block;font-size:10.5px;font-weight:700;color:var(--muted);background:var(--card-2);border:1px solid var(--line);padding:1px 7px;border-radius:var(--r-pill);vertical-align:middle;margin-left:6px}',
      '.co-fam-mol{color:var(--ip-blue-d,#0034A0);background:color-mix(in srgb,var(--ip-blue) 8%,var(--card));border-color:color-mix(in srgb,var(--ip-blue) 20%,var(--line))}',
      '.co-tension{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:var(--c-amber-txt,#9A5B12);background:#FBF1E2;border:1px solid #F0E2C6;padding:1px 7px;border-radius:var(--r-pill);margin-left:6px;vertical-align:middle;white-space:nowrap}',
      '.co-tension svg{flex:none}',
      /* « voir plus » — pur HTML, zéro état JS */
      '.co-more{margin-top:12px}',
      '.co-more>summary{list-style:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);font-size:13.5px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;box-shadow:var(--sh-1)}',
      '.co-more>summary::-webkit-details-marker{display:none}',
      '.co-more>summary svg{color:var(--muted-2)}',
      '.co-more[open]>summary{margin-bottom:12px}',
      /* divers */
      '.co-foot{padding:11px 16px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);background:var(--card-2);line-height:1.5}',
      '.co-empty{padding:24px;text-align:center;color:var(--muted);font-size:14px}',
      '.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}',
      '@media(max-width:560px){.co-tour{grid-template-columns:1fr}.co-args{grid-template-columns:1fr;padding:12px}.co-facts{width:100%}.co-select{flex:1 1 auto;width:auto}.co-facts .v2-btn{width:100%;justify-content:center}.co-mkt .v2-btn{margin-left:0;width:100%;justify-content:center}}'
    ].join('');
    document.head.appendChild(st);
  }

  function feedStrip(nbTension) {
    var m = V2.marketMeta();
    return '<div class="co-feeds" aria-label="Capteurs actifs">' +
      '<span class="co-feed on"><span class="d"></span>Marché France' + (m ? ' · ' + esc(m.periode) : '') + '</span>' +
      (window.RUPTURES
        ? '<span class="co-feed on warn"><span class="d"></span>Ruptures ANSM · ' + num(nbTension || 0) + ' en tension</span>'
        : '<span class="co-feed"><span class="d"></span>Ruptures ANSM · bientôt</span>') +
      (window.ZONE
        ? '<span class="co-feed on info"><span class="d"></span>Zones · ' + num((window.ZONE.meta || {}).n || 0) + ' officines</span>'
        : '<span class="co-feed"><span class="d"></span>Zones · bientôt</span>') +
      (window.SAISON ? '<span class="co-feed on"><span class="d"></span>Saisonnalité</span>' : '') +
      '</div>';
  }
  function tensionBadge(cip) {
    var rp = V2.rupture ? V2.rupture(cip) : null;
    if (!rp) return '';
    return ' <span class="co-tension" title="Signalé en rupture/risque de rupture à l\'ANSM' + (rp.dt ? ' · dernier signalement ' + esc(rp.dt) : '') + (rp.d ? ' · ' + esc(rp.d) : '') + '">' + ICO('alert', 10) + 'tension</span>';
  }
  function abChip(r) {
    return (r.f !== 'gen' && r.rpct > 0)
      ? '<span class="co-ab">abandon de marge −' + String(r.rpct).replace('.', ',') + '%</span>' : '';
  }

  // carte officine — la brique de « Ta tournée »
  function tourCard(o, nbTens) {
    var p = o.p, z = o.z;
    var sel = String(p.id) === String(selPid);
    return '<button type="button" class="co-pcard' + (sel ? ' sel' : '') + '" aria-pressed="' + (sel ? 'true' : 'false') + '" ' +
      'onclick="V2.copiloteSelPharma(\'' + esc(String(p.id)) + '\');var f=document.getElementById(\'co-focus\');if(f)f.scrollIntoView()">' +
      '<span class="nm">' + esc(p.name) + '</span>' +
      '<span class="loc">' + ICO('pharma', 13) +
        (z ? '<span>' + esc(z.c) + (z.dep ? ' (' + esc(z.dep) + ')' : '') + '</span>' + (z.pop ? '<span>· <b>' + num(z.pop) + '</b> hab.</span>' : '') : '<span>zone inconnue</span>') +
      '</span>' +
      (nbTens > 0 ? '<span class="co-warnchip">' + ICO('alert', 11) + nbTens + ' produit' + (nbTens > 1 ? 's' : '') + ' en tension chez elle</span>' : '') +
      '<span class="co-push"><b>' + o.miss + '</b><span>produits à pousser</span></span>' +
      '<span class="co-go">Préparer la visite ' + ICO('chev', 12) + '</span>' +
      '</button>';
  }

  // petite carte argument produit — le cœur du focus officine
  function argCard(o) {
    var r = o.r, s = stk(r.c);
    return '<div class="co-arg">' +
      '<div class="t"><span class="psh">À pousser</span>' + esc(cap(r.d)) + tensionBadge(r.c) + '</div>' +
      '<p class="s">Une pharmacie moyenne en vend <b>~' + num(o.fr) + '</b>/an en France · tu en as <b class="stk">' + num(s) + '</b> en stock Intégral.</p>' +
      '<div class="co-prix">' + (r.net > 0 ? '<span class="co-net">' + eur(r.net) + ' net remisé</span>' : '') + abChip(r) + '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir la fiche</button>' +
      '</div>';
  }

  // ligne « à sécuriser » — produits qu'elle commande, en tension ANSM
  function secuRow(o) {
    var r = o.r, rp = o.rp;
    return '<div class="co-secu-r"><span class="p">' + esc(cap(r.d)) + '</span>' +
      (rp.d ? '<span class="m">DCI ' + esc(cap(String(rp.d).toLowerCase())) + '</span>' : '') +
      (rp.dt ? '<span class="m">signalé le <span class="mono">' + esc(rp.dt) + '</span></span>' : '') +
      '<span class="m">stock IP <span class="mono">' + num(stk(r.c)) + '</span></span>' +
      '</div>';
  }

  // ligne légère « vue marché » (repliée, secondaire)
  function mktLine(o) {
    var r = o.r;
    return '<div class="co-mkt"><div class="id"><div class="p">' + esc(cap(r.d)) + '<span class="co-fam">' + (FAM[r.f] || r.f) + '</span>' + tensionBadge(r.c) + '</div><div class="c">' + esc(r.c) + '</div></div>' +
      '<div class="ms">' +
      '<span class="m"><i>France</i><span>~' + num(o.fr) + '/an</span></span>' +
      '<span class="m"><i>Ton réseau</i><span>' + num(r.n || 0) + ' off.</span></span>' +
      '<span class="m"><i>Net remisé</i><span class="blue">' + (r.net > 0 ? eur(r.net) : '—') + '</span></span>' +
      '<span class="m"><i>Stock IP</i><span class="grn">' + num(stk(r.c)) + '</span></span>' +
      '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir</button></div>';
  }
  function rupLine(o) {
    var r = o.r, rp = o.rp;
    return '<div class="co-mkt"><div class="id"><div class="p">' + esc(cap(r.d)) + '<span class="co-fam co-fam-mol">' + esc(cap((rp.d || '—').toLowerCase())) + '</span></div><div class="c">' + esc(r.c) + (rp.dt ? ' · signalé le ' + esc(rp.dt) : '') + '</div></div>' +
      '<div class="ms">' +
      '<span class="m"><i>Ton réseau</i><span>' + num(r.n || 0) + ' off.</span></span>' +
      '<span class="m"><i>Net remisé</i><span class="blue">' + (r.net > 0 ? eur(r.net) : '—') + '</span></span>' +
      '<span class="m"><i>Stock IP</i><span class="grn">' + num(stk(r.c)) + '</span></span>' +
      '</div>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.go(\'molecules\',\'' + esc(r.c) + '\')">Voir</button></div>';
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

      // ordre de calcul conservé : marchés → ruptures réseau → officine → tournée → saison
      var big = bigMarkets(18);
      var rupRes = reseauRuptures(15);

      // officine sélectionnée (focus)
      var phs = pharmaOptions();
      if (!selPid && phs.length) selPid = String(phs[0].id);
      var selName = '';
      var opts = phs.map(function (p) {
        var s = String(p.id) === String(selPid); if (s) selName = p.name;
        return '<option value="' + esc(String(p.id)) + '"' + (s ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('');
      var gaps = selPid ? officineGaps(selPid, 25) : [];
      var z = selPid && V2.zone ? V2.zone(selPid) : null;

      // tournée + secteurs
      var tour = tournee(selDep);
      var deps = tourneeDeps();

      // CIP éligibles en tension (pour badges cartes + bloc « à sécuriser »)
      var tensionCips = {};
      if (window.RUPTURES) PS().forEach(function (r) { if (eligible(r) && V2.rupture(r.c)) tensionCips[String(r.c)] = 1; });
      function nbTensChez(pid) {
        var owned = orderedCips(pid), n = 0;
        for (var c in tensionCips) { if (owned[c]) n++; }
        return n;
      }

      // ── « Ta tournée » : chips secteur + cartes officines ──
      var chips = '<div class="co-chips" aria-label="Filtrer par secteur">' +
        '<button type="button" class="co-chip' + (selDep ? '' : ' on') + '" aria-pressed="' + (selDep ? 'false' : 'true') + '" onclick="V2.copiloteSelDep(\'\')">Tous secteurs</button>' +
        deps.map(function (d) {
          var on = d === selDep;
          return '<button type="button" class="co-chip' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" onclick="V2.copiloteSelDep(\'' + esc(d) + '\')">Dép. ' + esc(d) + '</button>';
        }).join('') +
        '</div>';
      var tourTop = tour.slice(0, 10), tourMore = tour.slice(10, 25);
      var tourGrid = tourTop.length
        ? '<div class="co-tour">' + tourTop.map(function (o) { return tourCard(o, nbTensChez(o.p.id)); }).join('') + '</div>' +
          (tourMore.length ? '<details class="co-more"><summary>' + ICO('chev', 12) + 'Voir ' + tourMore.length + ' officines de plus</summary><div class="co-tour">' + tourMore.map(function (o) { return tourCard(o, nbTensChez(o.p.id)); }).join('') + '</div></details>' : '')
        : '<div class="co-card"><div class="co-empty">Aucune opportunité dans ce secteur.</div></div>';
      var tourSec = '<section class="co-sec">' +
        '<div class="co-sec-h"><h2>Ta tournée</h2><span class="co-pill">' + tour.length + ' officines</span></div>' +
        '<p class="co-sub">Classées par ce que tu as à y gagner. Touche une officine pour préparer ta visite.</p>' +
        chips + tourGrid +
        '</section>';

      // ── Focus officine : « Prépare ta visite » ──
      var zoneLine = z
        ? '<span class="co-fzone">' + ICO('pharma', 13) + esc(z.c) + (z.dep ? ' (' + esc(z.dep) + ')' : '') + (z.pop ? ' · <b>' + num(z.pop) + '</b> hab. dans la commune' : '') + '</span>'
        : '<span class="co-fzone">' + ICO('pharma', 13) + 'zone inconnue</span>';
      var argsHtml;
      if (gaps.length) {
        var g1 = gaps.slice(0, 6), g2 = gaps.slice(6);
        argsHtml = '<div class="co-args">' + g1.map(argCard).join('') + '</div>' +
          (g2.length ? '<details class="co-more" style="margin:0 16px 16px"><summary>' + ICO('chev', 12) + 'Voir ' + g2.length + ' autres arguments</summary><div class="co-args" style="padding:12px 0 0">' + g2.map(argCard).join('') + '</div></details>' : '');
      } else {
        argsHtml = '<div class="co-empty">Cette officine commande déjà les plus gros marchés France.</div>';
      }
      var secu = [];
      if (selPid && window.RUPTURES) {
        var ownedSel = orderedCips(selPid);
        PS().forEach(function (r) {
          if (!eligible(r)) return;
          if (!ownedSel[String(r.c)]) return;
          var rp = V2.rupture(r.c);
          if (rp) secu.push({ r: r, rp: rp });
        });
        secu.sort(function (a, b) { return (b.r.n || 0) - (a.r.n || 0); });
        secu = secu.slice(0, 6);
      }
      var secuHtml = secu.length
        ? '<div class="co-secu"><h4>' + ICO('alert', 13) + 'À sécuriser — elle commande ces produits, signalés en tension ANSM</h4>' + secu.map(secuRow).join('') + '</div>'
        : '';
      var focusSec = '<section class="co-sec" id="co-focus">' +
        '<div class="co-sec-h"><h2>Prépare ta visite</h2>' + (gaps.length ? '<span class="co-pill">' + gaps.length + ' arguments</span>' : '') + '</div>' +
        '<p class="co-sub">Tes arguments pour <b>' + esc(selName) + '</b> : les gros marchés France qu\'elle ne commande pas encore.</p>' +
        '<div class="co-card">' +
          '<div class="co-fhead">' +
            '<div class="fn"><h3>' + esc(selName) + '</h3>' + zoneLine + '</div>' +
            '<div class="co-facts">' +
              '<label class="co-lab" for="co-selph">Officine</label>' +
              '<select id="co-selph" class="co-select" onchange="V2.copiloteSelPharma(this.value)">' + opts + '</select>' +
              (selPid ? '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'pharma\',\'' + esc(String(selPid)) + '\')">Ouvrir la fiche</button>' : '') +
            '</div>' +
          '</div>' +
          argsHtml + secuHtml +
          '<div class="co-foot">Marché France Ameli (ce qu\'une pharmacie moyenne vend, indicatif) · uniquement des princeps en stock Intégral, tous établissements confondus · zone geo.api.gouv.fr.</div>' +
        '</div></section>';

      // ── Saisonnalité — bande compacte (inchangée sur le fond) ──
      var saisonSec = '';
      if (window.SAISON && window.SAISON.data) {
        var mo = (new Date()).getMonth() + 1;
        var moLabel = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][mo];
        var sarr = [];
        for (var k in window.SAISON.data) { var sd = window.SAISON.data[k]; var sv = (sd.idx && sd.idx[mo - 1]) || 100; if (sv > 105) sarr.push({ l: sd.l, v: sv }); }
        sarr.sort(function (a, b) { return b.v - a.v; });
        var stop = sarr.slice(0, 8);
        if (stop.length) {
          saisonSec = '<section class="co-sec"><div class="co-sec-h"><h2>Ce mois-ci, ça monte</h2><span class="co-pill">' + moLabel + '</span></div>' +
            '<p class="co-sub">Classes thérapeutiques au-dessus de leur moyenne annuelle en ' + moLabel + ' (Medic\'AM) — à glisser dans tes visites.</p>' +
            '<div class="co-card"><div class="co-saison">' +
            stop.map(function (s) { return '<div class="co-sais-i"><span class="co-sais-up">+' + (s.v - 100) + '%</span><span class="co-sais-l">' + esc(cap(s.l.toLowerCase())) + '</span></div>'; }).join('') +
            '</div><div class="co-foot">Indice mensuel Medic\'AM : 100 = moyenne annuelle. « +34 % » = la classe se vend 34 % au-dessus de sa moyenne ce mois-ci.</div></div></section>';
        }
      }

      // ── Vue marché — SECONDAIRE, repliée par défaut ──
      var mktSec = '<section class="co-sec"><details class="co-det">' +
        '<summary><span class="ch">' + ICO('chev', 13) + '</span>Vue marché · gros marchés France' + (rupRes.length ? ' &amp; tensions réseau' : '') + '<span class="co-pill">' + (big.length + rupRes.length) + '</span></summary>' +
        '<p class="co-sub">Les produits que la France consomme beaucoup mais que peu de tes officines commandent — pour creuser au calme, pas indispensable en visite.</p>' +
        big.map(mktLine).join('') +
        (rupRes.length
          ? '<div class="co-mkth">Produits en tension dans ton réseau (' + rupRes.length + ') — anticipe le réassort, ou propose la molécule (DCI) en alternative</div>' + rupRes.map(rupLine).join('')
          : '') +
        '<div class="co-foot">« Ton réseau » = nombre de tes officines qui commandent déjà ce produit. Marché France Ameli, à titre indicatif · signalements ANSM (rupture / risque).</div>' +
        '</details></section>';

      root.innerHTML = top +
        '<div class="v2-wrap">' +
          '<div class="co-hero">' +
            '<h1>Ta tournée<span class="ac">.</span></h1>' +
            '<p>Où aller, quoi pousser. On croise le <b>marché France</b> avec <b>tes ventes réseau</b> — uniquement des <b>princeps en stock Intégral</b>.</p>' +
            feedStrip(nbTension) +
          '</div>' +
          tourSec +
          focusSec +
          saisonSec +
          mktSec +
        '</div>';

      // motion léger : cascade d'entrée des cartes (RM-safe via V2.motion)
      try {
        if (V2.motion && V2.motion.stagger) {
          V2.motion.stagger(root.querySelectorAll('.co-tour .co-pcard'), { step: 40, y: 8 });
          V2.motion.stagger(root.querySelectorAll('#co-focus .co-arg'), { step: 40, y: 8 });
        }
      } catch (e) {}
    }
  };
})();
