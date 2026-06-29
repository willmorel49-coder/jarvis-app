/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Infos du matin" (pages.infos) — design "Artifact"
   Feed vertical plein écran (snap-scroll), une carte immersive par thème,
   fonds dégradés + gros chiffres. Lit crm/v2/infos-jour.json (robot GitHub
   Actions : RSS ANSM ruptures/sécu/actu + RappelConso + presse pro). Cartes :
   Récap du jour → Ruptures & tensions (live ANSM) → Rappels parapharma →
   Actu métier → Opportunités IP (rupture croisée au catalogue). 100% gratuit.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var eur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : (n + ' €'); };
  function cap(s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  var DATA = null, LOADED = false, FAILED = false;
  function load(cb) {
    if (LOADED || FAILED) { cb(); return; }
    var day = ''; try { day = new Date().toISOString().slice(0, 10); } catch (e) {}
    try {
      fetch('infos-jour.json?d=' + day, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (j) { DATA = j; LOADED = true; cb(); })
        .catch(function () { FAILED = true; cb(); });
    } catch (e) { FAILED = true; cb(); }
  }

  // statut rupture → libellé court + type (rupt/tens)
  function statutLabel(s) { var n = norm(s); if (n.indexOf('rupture') >= 0) return 'Rupture'; if (n.indexOf('remise') >= 0 || n.indexOf('disponible') >= 0) return 'Dispo'; if (n.indexOf('arret') >= 0) return 'Arrêt'; if (n.indexOf('tension') >= 0) return 'Tension'; return 'Signalé'; }
  function statutType(s) { var n = norm(s); if (n.indexOf('rupture') >= 0 || n.indexOf('arret') >= 0) return 'rupt'; return 'tens'; }

  // rubrique métier d'une actu
  function rubricOf(i) {
    if (i.cat === 'securite') return 'secu';
    var x = norm(i.titre + ' ' + (i.resume || ''));
    if (/rappel|pharmacovigilance|retrait de lot|vigilance|defaut qualite|alerte securite/.test(x)) return 'secu';
    if (/generiqu|biosimil|substitu|interchangeab|delivr|repertoire/.test(x)) return 'gen';
    if (/rembours|deremboursement|\bprix\b|honorair|convention|avenant|rosp|tarif|nomenclature|economie|\bmarge|lfss|cnam|ceps|budget|cotation|\bsecu\b|grossist|repartit|distribut|contingent|quota/.test(x)) return 'eco';
    return 'metier';
  }
  var RUBR_EM = { eco: '💶', gen: '🔁', secu: '⚠️', metier: '📰' };
  var RUBR_LB = { eco: 'Économie', gen: 'Génériques', secu: 'Sécurité', metier: 'Métier' };

  // DCI → alternatives catalogue IP
  var DCI_STOP = { de: 1, du: 1, d: 1, et: 1, en: 1, la: 1, le: 1, acide: 1, chlorhydrate: 1, sulfate: 1, sodique: 1, sodium: 1, calcique: 1, calcium: 1, potassique: 1, maleate: 1, fumarate: 1, tartrate: 1, besilate: 1, mesilate: 1, bromure: 1, base: 1, monohydrate: 1, dihydrate: 1, trihydrate: 1, anhydre: 1, micronise: 1, hemifumarate: 1, dipropionate: 1, valerate: 1, acetate: 1, phosphate: 1, citrate: 1, nitrate: 1, succinate: 1, embonate: 1, pamoate: 1 };
  function dciKeys(dci) {
    return norm(dci).split(/[ ,/()\-]+/).filter(function (w) { return w.length >= 5 && !DCI_STOP[w]; });
  }
  function ipAlternatives(dci) {
    var B = window.BENCHMARK; if (!B || !dci) return [];
    var keys = dciKeys(dci); if (!keys.length) return [];
    var hits = [], seen = {};
    for (var i = 0; i < B.length; i++) {
      var b = B[i], d = norm(b.designation || ''), match = false;
      for (var k = 0; k < keys.length; k++) { if (d.indexOf(keys[k]) >= 0) { match = true; break; } }
      if (!match) continue;
      var c = String(b.cip13 || ''); if (seen[c]) continue; seen[c] = 1;
      var bp = V2.bestPrice ? V2.bestPrice(b) : { ip: b.prix_ip, remise: b.remise_pct };
      hits.push({ d: b.designation || '', cip: c, ip: bp.ip, remise: bp.remise || 0, rank: b.ip_rank_qty || 9999 });
    }
    hits.sort(function (a, b) { return (b.remise - a.remise) || (a.rank - b.rank); });
    return hits.slice(0, 2);
  }

  function frDate(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function topDate() { try { return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }).toUpperCase(); } catch (e) { return ''; } }

  // dégradés tuiles rappels (cycle)
  var TILE_GRAD = [
    'linear-gradient(120deg,#FF6B6B,#C2255C)', 'linear-gradient(120deg,#22D3EE,#0E7490)',
    'linear-gradient(120deg,#A3E635,#15803D)', 'linear-gradient(120deg,#F59E0B,#B45309)',
    'linear-gradient(120deg,#A78BFA,#6D28D9)', 'linear-gradient(120deg,#34D399,#0F766E)',
    'linear-gradient(120deg,#FB7185,#9F1239)', 'linear-gradient(120deg,#60A5FA,#1D4ED8)'
  ];

  // configuration des observers après injection du HTML
  function setupFeed() {
    var feed = document.getElementById('art-feed'); if (!feed) return;
    var cards = [].slice.call(feed.querySelectorAll('.art-card'));
    var dots = [].slice.call(document.querySelectorAll('#art-dots b'));
    var navs = [].slice.call(document.querySelectorAll('.art-nav a'));
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var i = cards.indexOf(e.target), key = e.target.getAttribute('data-key');
        dots.forEach(function (d, j) { d.classList.toggle('on', j === i); });
        navs.forEach(function (a) { a.classList.toggle('act', a.getAttribute('data-target') === key); });
      });
    }, { root: feed, threshold: 0.55 });
    cards.forEach(function (c) { io.observe(c); });
  }

  V2.pages.infos = {
    render: function (root) {
      if (!LOADED && !FAILED) {
        load(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
        root.innerHTML = '<div id="infos-art"><div class="art-load"><div class="art-spin"></div><div>Chargement de la veille du matin…</div></div></div>';
        return;
      }
      if (!window.BENCHMARK && V2.loadFiles && DATA) {
        V2.loadFiles(['bench']).then(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
      }

      var items = (DATA && DATA.items) ? DATA.items : [];
      var ruptures = items.filter(function (i) { return i.cat === 'ruptures'; });
      var rlive = (DATA && DATA.ruptures_live) ? DATA.ruptures_live : [];
      var rappels = (DATA && DATA.rappels) ? DATA.rappels : [];
      var actu = items.filter(function (i) { return i.cat !== 'ruptures'; });
      var rtot = (DATA && DATA.ruptures_total) || rlive.length;
      var recap = (DATA && DATA.recap) ? DATA.recap : null;

      // état vide / échec
      if (!DATA || (!items.length && !rlive.length && !rappels.length)) {
        root.innerHTML = '<div id="infos-art"><div class="art-top"><button class="art-back" onclick="V2.go(\'home\')">←</button>' +
          '<div class="art-brand"><span class="art-logo">IP</span><b>Infos du matin</b></div><span></span></div>' +
          '<div class="art-empty">' + (FAILED ? 'La veille n\'a pas pu être chargée (connexion ?).<br>Elle se met à jour chaque matin.' : 'Pas encore d\'infos aujourd\'hui.<br>La veille se met à jour chaque matin.') + '</div></div>';
        return;
      }

      // ── Opportunités IP (si catalogue chargé) ──
      var opps = [];
      if (window.BENCHMARK) {
        opps = ruptures.map(function (r) { return { r: r, alt: r.dci ? ipAlternatives(r.dci) : [] }; }).filter(function (o) { return o.alt.length; });
      }

      var nav = [];   // liens nav bas
      var cards = '';
      var dots = 0;

      // ═══ CARTE 1 · RÉCAP ═══
      var rcount = (DATA && DATA.count_today) || 0;
      var megaR = rcount > 0 ? rcount : ((DATA && DATA.count) || items.length);
      var recItems = '';
      if (recap && recap.une) recItems += '<div class="art-rec"><span class="em">⚖️</span><b>À la une — <u>' + esc(recap.une) + '</u></b></div>';
      if (rtot) recItems += '<div class="art-rec"><span class="em">🔥</span><b><u>' + rtot + '</u> médicaments en rupture ou tension</b></div>';
      if (rappels.length) recItems += '<div class="art-rec"><span class="em">📦</span><b><u>' + rappels.length + '</u> produits parapharma rappelés</b></div>';
      if (opps.length) recItems += '<div class="art-rec"><span class="em">💡</span><b><u>' + opps.length + '</u> opportunités Intégral à saisir</b></div>';
      var lede = (recap && recap.text) ? esc(recap.text).replace(/\n+/g, ' ') : 'Votre brief pharma du matin. Tout ce qui compte, en moins d\'une minute.';
      cards += '<section class="art-card bg-recap" data-key="recap" id="art-recap">' +
        '<span class="kick" style="background:rgba(255,255,255,.16);color:#fff"><span class="em">☀️</span> Récap du jour</span>' +
        '<div class="mega">' + megaR + '<small> ' + (rcount > 0 ? 'aujourd\'hui' : 'infos') + '</small></div>' +
        '<p class="lede">' + lede + '</p>' +
        (recItems ? '<div class="art-recs">' + recItems + '</div>' : '') +
        '<div class="hint">↑ Glissez pour explorer ↑</div></section>';
      nav.push({ k: 'recap', em: '☀️', l: 'Récap' }); dots++;

      // ═══ CARTE 2 · RUPTURES & TENSIONS ═══
      var rsrc = rlive.length ? rlive : ruptures;
      if (rsrc.length) {
        var rRows = rsrc.slice(0, 14).map(function (r) {
          var ty = statutType(r.statut);
          var meta = rlive.length
            ? (r.depuis ? 'depuis le ' + esc(r.depuis) : 'signalé ANSM')
            : (r.dci ? esc(cap(r.dci)) : 'ANSM');
          return '<a class="row"' + (r.url ? ' href="' + esc(r.url) + '" target="_blank" rel="noopener"' : '') + '>' +
            '<div class="ico" style="background:' + (ty === 'rupt' ? 'rgba(255,59,92,.3)' : 'rgba(255,176,32,.25)') + '">' + (ty === 'rupt' ? '🚫' : '💊') + '</div>' +
            '<div class="body"><b>' + esc(cap((r.titre || '').toLowerCase())) + '</b><span>' + meta + '</span></div>' +
            '<div class="tag ' + ty + '">' + esc(statutLabel(r.statut)) + '</div></a>';
        }).join('');
        cards += '<section class="art-card bg-rupt" data-key="ruptures" id="art-ruptures">' +
          '<span class="kick" style="background:rgba(255,59,92,.25);color:#FFD9E0"><span class="em">⚠️</span> Ruptures &amp; tensions</span>' +
          '<div class="mega">' + rtot + '<small> suivies</small></div>' +
          '<p class="lede">Surveillance ANSM en temps réel.' + (rsrc.length > 14 ? ' Voici les ' + Math.min(rsrc.length, 14) + ' dernières alertes.' : '') + '</p>' +
          '<div class="list">' + rRows + '</div></section>';
        nav.push({ k: 'ruptures', em: '⚠️', l: 'Ruptures' }); dots++;
      }

      // ═══ CARTE 3 · RAPPELS PARAPHARMA ═══
      if (rappels.length) {
        var tiles = rappels.slice(0, 8).map(function (r, idx) {
          return '<a class="tile"' + (r.url ? ' href="' + esc(r.url) + '" target="_blank" rel="noopener"' : '') + '>' +
            '<div class="glow" style="background:' + TILE_GRAD[idx % TILE_GRAD.length] + '"></div>' +
            '<h3>' + esc(cap((r.titre || '').toLowerCase())) + '</h3>' +
            (r.marque ? '<p>' + esc(r.marque) + '</p>' : '') +
            (r.risque ? '<span class="risk">⚠ ' + esc(r.risque) + '</span>' : '') + '</a>';
        }).join('');
        cards += '<section class="art-card bg-para" data-key="rappels" id="art-rappels">' +
          '<span class="kick" style="background:rgba(124,58,237,.3);color:#E9D5FF"><span class="em">📦</span> Rappels parapharma</span>' +
          '<div class="mega">' + rappels.length + '<small> rappels</small></div>' +
          '<p class="lede">RappelConso — à retirer des rayons et signaler aux patients.</p>' +
          '<div class="tiles">' + tiles + '</div></section>';
        nav.push({ k: 'rappels', em: '📦', l: 'Rappels' }); dots++;
      }

      // ═══ CARTE 4 · ACTU MÉTIER ═══
      if (actu.length) {
        var actuSorted = actu.slice().sort(function (a, b) { return (b.today ? 1 : 0) - (a.today ? 1 : 0); });
        var gcards = actuSorted.slice(0, 8).map(function (i) {
          var rb = rubricOf(i);
          return '<a class="gcard"' + (i.url ? ' href="' + esc(i.url) + '" target="_blank" rel="noopener"' : '') + '>' +
            '<div class="em">' + (RUBR_EM[rb] || '📰') + '</div>' +
            '<div><b>' + esc(i.titre) + '</b><span>' + esc(i.source || RUBR_LB[rb] || 'Actu') + '</span></div></a>';
        }).join('');
        cards += '<section class="art-card bg-metier" data-key="actu" id="art-actu">' +
          '<span class="kick" style="background:rgba(14,165,168,.3);color:#CCFBF1"><span class="em">📰</span> Actu métier</span>' +
          '<h1 class="title">L\'officine<br>bouge</h1>' +
          '<p class="lede">' + actu.length + ' dossiers à suivre — économie, génériques, sécurité, métier.</p>' +
          '<div class="grid2">' + gcards + '</div></section>';
        nav.push({ k: 'actu', em: '📰', l: 'Actu' }); dots++;
      }

      // ═══ CARTE 5 · OPPORTUNITÉS IP ═══
      if (opps.length) {
        var o0 = opps[0], a0 = o0.alt[0];
        var more = opps.slice(1, 4).map(function (o) {
          var a = o.alt[0];
          return '<a class="row" onclick="V2.go(\'molecules\',\'' + esc(a.cip) + '\')">' +
            '<div class="ico" style="background:rgba(16,185,129,.25)">💡</div>' +
            '<div class="body"><b>' + esc(cap((a.d || '').toLowerCase())) + '</b><span>' + esc(cap(o.r.dci)) + ' en ' + esc(statutLabel(o.r.statut).toLowerCase()) + '</span></div>' +
            (a.remise > 0 ? '<div class="tag tens">−' + Math.round(a.remise) + '%</div>' : '') + '</a>';
        }).join('');
        cards += '<section class="art-card bg-oppo" data-key="oppo" id="art-oppo">' +
          '<span class="kick" style="background:rgba(255,255,255,.18);color:#fff"><span class="em">💡</span> Opportunité Intégral</span>' +
          '<h1 class="title">Tension =<br>opportunité</h1>' +
          '<p class="lede">' + esc(cap(o0.r.dci)) + ' est en ' + esc(statutLabel(o0.r.statut).toLowerCase()) + '. Sécurisez le stock avec l\'alternative référencée Intégral.</p>' +
          '<div class="oppo">' +
            '<div class="oh"><span>⚡</span> Alternative en stock</div>' +
            '<div class="prod">' + esc(cap((a0.d || '').toLowerCase())) + '</div>' +
            '<div class="sub">Référencé catalogue Intégral · CIP ' + esc(a0.cip) + '</div>' +
            '<div class="pricebar"><div class="price">' + (a0.ip > 0 ? esc(eur(a0.ip)) : '—') + '</div>' +
            (a0.remise > 0 ? '<div class="save">−' + Math.round(a0.remise) + ' %</div>' : '') + '</div>' +
            '<button class="cta" onclick="V2.go(\'molecules\',\'' + esc(a0.cip) + '\')">Voir la fiche produit →</button>' +
          '</div>' +
          (more ? '<div class="list" style="margin-top:14px">' + more + '</div>' : '') +
          '</section>';
        nav.push({ k: 'oppo', em: '💡', l: 'Oppos' }); dots++;
      }

      // chrome : topbar + dots + nav
      var dotsHtml = '<div class="art-dots" id="art-dots">';
      for (var d = 0; d < dots; d++) dotsHtml += '<b' + (d === 0 ? ' class="on"' : '') + '></b>';
      dotsHtml += '</div>';

      var navHtml = '<nav class="art-nav">' + nav.map(function (n, idx) {
        return '<a' + (idx === 0 ? ' class="act"' : '') + ' data-target="' + n.k + '" onclick="document.getElementById(\'art-' + n.k + '\').scrollIntoView({behavior:\'smooth\'})"><span class="em">' + n.em + '</span>' + n.l + '</a>';
      }).join('') + '</nav>';

      var top = '<div class="art-top">' +
        '<button class="art-back" onclick="V2.go(\'home\')">←</button>' +
        '<div class="art-brand"><span class="art-logo">IP</span><b>Infos du matin</b></div>' +
        '<div class="art-live"><i></i>' + esc(topDate()) + '</div></div>';

      root.innerHTML = '<div id="infos-art">' + top + dotsHtml +
        '<div class="art-feed" id="art-feed">' + cards + '</div>' + navHtml + '</div>';

      setupFeed();
    }
  };

  if (!document.getElementById('v2-infos-css')) {
    var st = document.createElement('style'); st.id = 'v2-infos-css';
    st.textContent =
      '#infos-art{position:fixed;inset:0;z-index:1200;background:#000;color:#fff;font-family:"Inter",system-ui,-apple-system,sans-serif;--ip-blue:#0050E6;--display:"Space Grotesk","Inter",sans-serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}' +
      '#infos-art *{box-sizing:border-box}' +
      // feed + cards
      '#infos-art .art-feed{height:100dvh;width:100%;max-width:520px;margin:0 auto;overflow-y:scroll;scroll-snap-type:y proximity;scrollbar-width:none;background:#000;overscroll-behavior:contain}' +
      '#infos-art .art-feed::-webkit-scrollbar{display:none}' +
      '#infos-art .art-card{min-height:100dvh;width:100%;scroll-snap-align:start;position:relative;display:flex;flex-direction:column;justify-content:center;padding:104px 22px calc(96px + env(safe-area-inset-bottom,0));overflow:hidden;isolation:isolate}' +
      '#infos-art .art-card::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,.35) 72%,rgba(0,0,0,.72) 100%);pointer-events:none}' +
      // backgrounds
      '#infos-art .bg-recap{background:radial-gradient(120% 90% at 30% 10%,#1E5BFF 0%,#0A33C9 45%,#061A6E 100%)}' +
      '#infos-art .bg-rupt{background:radial-gradient(120% 95% at 80% 5%,#FF4D6D 0%,#B11233 50%,#3A0712 100%)}' +
      '#infos-art .bg-para{background:radial-gradient(120% 90% at 20% 5%,#7C3AED 0%,#4C1D95 50%,#1E0B45 100%)}' +
      '#infos-art .bg-metier{background:radial-gradient(120% 90% at 70% 10%,#0EA5A8 0%,#0B6E73 50%,#04282B 100%)}' +
      '#infos-art .bg-oppo{background:radial-gradient(120% 95% at 50% 0%,#1E5BFF 0%,#0033A0 55%,#021245 100%)}' +
      // top chrome
      '#infos-art .art-top{position:absolute;top:0;left:0;right:0;z-index:50;max-width:520px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(14px + env(safe-area-inset-top,0)) 16px 12px;background:linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,0))}' +
      '#infos-art .art-back{flex:none;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font-size:18px;cursor:pointer;backdrop-filter:blur(8px);-webkit-tap-highlight-color:transparent}' +
      '#infos-art .art-back:active{transform:scale(.92)}' +
      '#infos-art .art-brand{display:flex;align-items:center;gap:9px;flex:1;justify-content:center}' +
      '#infos-art .art-logo{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#3B82F6,var(--ip-blue));display:grid;place-items:center;font-weight:800;font-size:12px;font-family:var(--display);box-shadow:0 4px 16px rgba(0,80,230,.5)}' +
      '#infos-art .art-brand b{font-family:var(--display);font-weight:700;font-size:15px;letter-spacing:-.3px}' +
      '#infos-art .art-live{flex:none;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.5px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);padding:5px 9px;border-radius:30px;display:flex;align-items:center;gap:6px;backdrop-filter:blur(8px)}' +
      '#infos-art .art-live i{width:7px;height:7px;border-radius:50%;background:#FF3B5C;animation:artpulse 1.4s infinite}' +
      '@keyframes artpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}' +
      // progress dots
      '#infos-art .art-dots{position:fixed;top:50%;right:7px;transform:translateY(-50%);z-index:45;display:flex;flex-direction:column;gap:7px;pointer-events:none}' +
      '#infos-art .art-dots b{width:4px;height:14px;border-radius:4px;background:rgba(255,255,255,.22);transition:.3s}' +
      '#infos-art .art-dots b.on{background:#fff;height:22px}' +
      // content
      '#infos-art .kick{font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border-radius:30px;align-self:flex-start;margin-bottom:16px;backdrop-filter:blur(6px)}' +
      '#infos-art .kick .em{font-size:14px}' +
      '#infos-art .title{font-family:var(--display);font-weight:700;font-size:clamp(30px,8.5vw,42px);line-height:1.02;letter-spacing:-1.2px;margin-bottom:14px;text-shadow:0 2px 30px rgba(0,0,0,.4)}' +
      '#infos-art .lede{font-size:15px;line-height:1.5;color:rgba(255,255,255,.82);max-width:36ch;font-weight:500}' +
      '#infos-art .mega{font-family:var(--mono);font-weight:700;font-size:clamp(60px,20vw,104px);line-height:.85;letter-spacing:-3px;margin-bottom:8px;font-variant-numeric:tabular-nums;text-shadow:0 6px 40px rgba(0,0,0,.45)}' +
      '#infos-art .mega small{font-size:.26em;letter-spacing:0;opacity:.75;font-weight:600}' +
      // récap list
      '#infos-art .art-recs{display:flex;flex-direction:column;gap:10px;margin-top:20px}' +
      '#infos-art .art-rec{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:15px;padding:13px 14px;backdrop-filter:blur(14px)}' +
      '#infos-art .art-rec .em{font-size:21px;flex:none}' +
      '#infos-art .art-rec b{font-size:14px;font-weight:700;line-height:1.25;letter-spacing:-.2px}' +
      '#infos-art .art-rec b u{text-decoration:none;color:#9BC2FF;font-family:var(--mono)}' +
      // list rows
      '#infos-art .list{display:flex;flex-direction:column;gap:9px;margin-top:18px}' +
      '#infos-art .row{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.13);backdrop-filter:blur(14px);border-radius:16px;padding:12px 13px;text-decoration:none;color:#fff;cursor:pointer;transition:transform .12s,background .15s}' +
      '#infos-art .row:active{transform:scale(.985)}' +
      '#infos-art .row:hover{background:rgba(255,255,255,.14)}' +
      '#infos-art .row .ico{flex:0 0 38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:18px}' +
      '#infos-art .row .body{flex:1;min-width:0}' +
      '#infos-art .row .body b{display:block;font-size:14px;font-weight:700;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#infos-art .row .body span{display:block;font-size:12px;color:rgba(255,255,255,.62);margin-top:1px}' +
      '#infos-art .tag{font-family:var(--mono);font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:5px 8px;border-radius:7px;white-space:nowrap;flex:none}' +
      '#infos-art .tag.rupt{background:#FF3B5C;color:#fff}' +
      '#infos-art .tag.tens{background:#FFB020;color:#1a1200}' +
      // rappel tiles
      '#infos-art .tiles{display:flex;flex-direction:column;gap:11px;margin-top:18px}' +
      '#infos-art .tile{border-radius:18px;padding:15px 16px;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.16);text-decoration:none;color:#fff;display:block;transition:transform .12s}' +
      '#infos-art .tile:active{transform:scale(.99)}' +
      '#infos-art .tile .glow{position:absolute;inset:0;opacity:.9;z-index:-1}' +
      '#infos-art .tile h3{font-family:var(--display);font-weight:700;font-size:16px;letter-spacing:-.3px;line-height:1.2}' +
      '#infos-art .tile p{font-size:12.5px;color:rgba(255,255,255,.9);margin-top:3px;font-weight:500}' +
      '#infos-art .tile .risk{display:inline-block;margin-top:9px;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:rgba(0,0,0,.32);padding:5px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.2)}' +
      // metier grid
      '#infos-art .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}' +
      '#infos-art .gcard{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13);backdrop-filter:blur(12px);border-radius:16px;padding:14px;min-height:108px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;text-decoration:none;color:#fff;transition:transform .12s,background .15s}' +
      '#infos-art .gcard:active{transform:scale(.98)}' +
      '#infos-art .gcard:hover{background:rgba(255,255,255,.13)}' +
      '#infos-art .gcard .em{font-size:21px}' +
      '#infos-art .gcard b{font-size:13.5px;font-weight:700;letter-spacing:-.2px;line-height:1.2;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +
      '#infos-art .gcard span{display:block;font-family:var(--mono);font-size:9.5px;font-weight:600;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.5px;margin-top:5px}' +
      // opportunity hero
      '#infos-art .oppo{background:rgba(255,255,255,.96);color:#0A0E1A;border-radius:22px;padding:18px;margin-top:20px;box-shadow:0 20px 50px rgba(0,0,0,.5)}' +
      '#infos-art .oppo .oh{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--ip-blue)}' +
      '#infos-art .oppo .prod{font-family:var(--display);font-weight:700;font-size:19px;letter-spacing:-.4px;margin:10px 0 2px;line-height:1.15}' +
      '#infos-art .oppo .sub{font-size:12.5px;color:#5a6172;font-weight:500}' +
      '#infos-art .oppo .pricebar{display:flex;align-items:flex-end;gap:14px;margin-top:14px}' +
      '#infos-art .oppo .price{font-family:var(--mono);font-weight:700;font-size:34px;letter-spacing:-1.5px;color:var(--ip-blue);line-height:1}' +
      '#infos-art .oppo .save{font-family:var(--mono);font-weight:700;font-size:14px;color:#fff;background:#10B981;padding:6px 11px;border-radius:30px;margin-bottom:3px}' +
      '#infos-art .oppo .cta{margin-top:16px;width:100%;border:0;cursor:pointer;background:var(--ip-blue);color:#fff;font-family:inherit;font-weight:700;font-size:15px;padding:15px;border-radius:14px;box-shadow:0 8px 24px rgba(0,80,230,.45);transition:transform .12s}' +
      '#infos-art .oppo .cta:active{transform:scale(.98)}' +
      // hint + nav
      '#infos-art .hint{margin-top:22px;font-family:var(--mono);font-size:10px;letter-spacing:1px;color:rgba(255,255,255,.5);text-transform:uppercase;animation:artbob 1.8s infinite;align-self:flex-start}' +
      '@keyframes artbob{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(5px);opacity:.85}}' +
      '#infos-art .art-nav{position:fixed;bottom:0;left:0;right:0;z-index:50;max-width:520px;margin:0 auto;display:flex;justify-content:space-around;align-items:center;padding:10px 10px calc(12px + env(safe-area-inset-bottom,0));background:linear-gradient(0deg,rgba(0,0,0,.85),rgba(0,0,0,0));backdrop-filter:blur(6px)}' +
      '#infos-art .art-nav a{display:flex;flex-direction:column;align-items:center;gap:3px;color:rgba(255,255,255,.5);text-decoration:none;font-size:9.5px;font-weight:600;font-family:var(--mono);letter-spacing:.3px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:color .15s}' +
      '#infos-art .art-nav a.act{color:#fff}' +
      '#infos-art .art-nav a .em{font-size:19px}' +
      // loading + empty
      '#infos-art .art-load,#infos-art .art-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:40px;color:rgba(255,255,255,.8);font-size:14px;line-height:1.6}' +
      '#infos-art .art-spin{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.2);border-top-color:#fff;animation:artspin .8s linear infinite}' +
      '@keyframes artspin{to{transform:rotate(360deg)}}' +
      '@media(prefers-reduced-motion:reduce){#infos-art .art-feed{scroll-snap-type:none}#infos-art .hint,#infos-art .art-live i{animation:none}}';
    document.head.appendChild(st);
  }
})();
