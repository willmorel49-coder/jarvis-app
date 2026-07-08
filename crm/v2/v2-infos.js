/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Infos du matin" (pages.infos) — design "Brief calme"
   Décliné du même esprit épuré que l'accueil « Launcher » : fond clair,
   hiérarchie limpide, sections calmes regroupées par thème, un accent par
   type d'info. Se lit en 30 secondes. Lit crm/v2/infos-jour.json (robot
   GitHub Actions : RSS ANSM ruptures/sécu/actu + RappelConso + presse pro).
   Sections : L'essentiel du jour → Ruptures & tensions (live ANSM) →
   Rappels parapharma → Actu métier → Opportunités Intégral (rupture
   croisée au catalogue, alternative IP évidente). 100% gratuit, hors-ligne.
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

  // Préférences d'affichage : ce que l'utilisateur veut voir le matin (mémorisé localement).
  var PREF_KEY = 'jarvis_infos_prefs_v1';
  function loadPrefs() {
    var d = { officine: 1, opps: 1, ruptures: 1, rappels: 1 };
    try {
      var p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      for (var k in d) if (p[k] === 0) d[k] = 0;
    } catch (e) {}
    return d;
  }
  var PREFS = loadPrefs();
  V2.infosPrefToggle = function (k) {
    if (!(k in PREFS)) return;
    PREFS[k] = PREFS[k] ? 0 : 1;
    try { localStorage.setItem(PREF_KEY, JSON.stringify(PREFS)); } catch (e) {}
    if (V2.route && V2.route.name === 'infos') V2.render();
  };
  var CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var COPY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

  // « Nouveau depuis ta dernière visite » : compare la date des infos à la dernière ouverture.
  var SEEN_KEY = 'jarvis_infos_seen', seenBaseline = null;
  function seenBase() { if (seenBaseline === null) { try { seenBaseline = localStorage.getItem(SEEN_KEY) || ''; } catch (e) { seenBaseline = ''; } } return seenBaseline; }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, new Date().toISOString().slice(0, 10)); } catch (e) {} }

  // « Copier le brief du matin » : texte prêt à coller (WhatsApp/mail) — veille pure, AUCUN prix ni abandon.
  function fallbackCopy(txt) { try { var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } catch (e) {} }
  V2.infosCopyBrief = function (btn) {
    if (!DATA) return;
    var lines = [], d = ''; try { d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) {}
    lines.push('Infos du matin — ' + cap(d));
    if (DATA.recap && DATA.recap.text) lines.push('', DATA.recap.text.replace(/\n+/g, ' '));
    var its = DATA.items || [];
    var rup = (DATA.ruptures_live && DATA.ruptures_live.length) ? DATA.ruptures_live : its.filter(function (i) { return i.cat === 'ruptures'; });
    if (rup.length) { lines.push('', 'Ruptures & tensions :'); rup.slice(0, 8).forEach(function (r) { lines.push('- ' + cap((r.titre || '').toLowerCase())); }); }
    var rap = DATA.rappels || [];
    if (rap.length) { lines.push('', 'Rappels de produits :'); rap.slice(0, 6).forEach(function (r) { lines.push('- ' + cap((r.titre || '').toLowerCase())); }); }
    var act = its.filter(function (i) { return i.cat !== 'ruptures'; });
    if (act.length) { lines.push('', 'Actu officine :'); act.slice(0, 6).forEach(function (i) { lines.push('- ' + (i.titre || '')); }); }
    var txt = lines.join('\n');
    var ok = function () { if (V2.toast) V2.toast('Brief copié ✅'); if (btn) { var t = btn.getAttribute('data-lbl') || btn.textContent; btn.innerHTML = 'Copié ✅'; setTimeout(function () { btn.innerHTML = COPY_SVG + t; }, 1500); } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { fallbackCopy(txt); ok(); }); else { fallbackCopy(txt); ok(); } }
    catch (e) { fallbackCopy(txt); ok(); }
  };

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
      var stk = V2.stock ? V2.stock(c) : 1;
      if (V2.stock && stk <= 0) continue;   // on ne pousse jamais une alternative en rupture chez Intégral
      var bp = V2.bestPrice ? V2.bestPrice(b) : { ip: b.prix_ip, remise: b.remise_pct };
      hits.push({ d: b.designation || '', cip: c, ip: bp.ip, remise: bp.remise || 0, rank: b.ip_rank_qty || 9999, stock: stk });
    }
    hits.sort(function (a, b) { return (b.remise - a.remise) || (a.rank - b.rank); });
    return hits.slice(0, 2);
  }

  function topDate() {
    try { return cap(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })); }
    catch (e) { return ''; }
  }

  V2.pages.infos = {
    render: function (root) {
      injectStyles();

      if (!LOADED && !FAILED) {
        load(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap narrow inf2">' +
            '<div class="inf-load"><div class="inf-spin"></div><span>Chargement de la veille du matin…</span></div>' +
          '</div>';
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
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-wrap narrow inf2">' +
            '<div class="inf-empty">' +
              '<div class="inf-empty-ic">' + ICO('spark', 26, 2) + '</div>' +
              '<div class="inf-empty-t">' + (FAILED ? 'La veille n\'a pas pu être chargée' : 'Pas encore d\'infos aujourd\'hui') + '</div>' +
              '<div class="inf-empty-d">' + (FAILED ? 'Vérifiez votre connexion. La veille se met à jour chaque matin.' : 'La veille se met à jour automatiquement chaque matin.') + '</div>' +
            '</div>' +
          '</div>';
        return;
      }

      // ── Opportunités IP (si catalogue chargé) ──
      var opps = [];
      if (window.BENCHMARK) {
        opps = ruptures.map(function (r) { return { r: r, alt: r.dci ? ipAlternatives(r.dci) : [] }; }).filter(function (o) { return o.alt.length; });
      }

      var rsrc = rlive.length ? rlive : ruptures;
      var base = seenBase();
      var nbNew = base ? items.filter(function (i) { return i.day && i.day > base; }).length : 0;

      // ════════ HERO : titre + date + une phrase ════════
      var lede = (recap && recap.text) ? esc(recap.text).replace(/\n+/g, ' ')
        : 'Tout ce qui compte ce matin — ruptures, actu officine et opportunités Intégral. À lire en moins d\'une minute.';
      var html = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="v2-wrap narrow inf2">' +
          '<div class="inf-hero">' +
            '<div class="inf-eyebrow"><span class="live"><i></i>Veille du jour</span> · ' + esc(topDate()) + (nbNew ? ' · <span class="inf-new">+' + nbNew + ' nouvelle' + (nbNew > 1 ? 's' : '') + ' depuis ta dernière visite</span>' : '') + '</div>' +
            '<h1>Infos du matin</h1>' +
            '<p class="inf-lede">' + lede + '</p>' +
            '<button class="inf-copy" data-lbl="Copier le brief" onclick="V2.infosCopyBrief(this)">' + COPY_SVG + 'Copier le brief</button>' +
          '</div>';

      // ════════ L'ESSENTIEL = les filtres : chaque carte affiche/masque sa rubrique (mémorisé) ════════
      // Ordre : Actu officine EN AVANT, puis Opportunités, Ruptures, Rappels.
      var stats = [];
      if (actu.length) stats.push({ key: 'officine', n: actu.length, l: (actu.length > 1 ? 'actus officine' : 'actu officine'), a: 'blue', ico: 'list' });
      if (opps.length) stats.push({ key: 'opps', n: opps.length, l: (opps.length > 1 ? 'opportunités Intégral' : 'opportunité Intégral'), a: 'green', ico: 'spark' });
      if (rtot) stats.push({ key: 'ruptures', n: rtot, l: (rtot > 1 ? 'ruptures ou tensions' : 'rupture ou tension'), a: 'rose', ico: 'alert' });
      if (rappels.length) stats.push({ key: 'rappels', n: rappels.length, l: (rappels.length > 1 ? 'produits rappelés' : 'produit rappelé'), a: 'amber', ico: 'alert' });
      if (stats.length) {
        html += '<div class="inf-pick-h">Ce que je veux voir ce matin<span>touche une carte pour l’afficher ou la masquer</span></div>';
        html += '<div class="inf-stats">' + stats.map(function (s) {
          var on = PREFS[s.key] !== 0;
          return '<button type="button" class="inf-stat a-' + s.a + (on ? '' : ' off') + '" aria-pressed="' + on + '" ' +
            'title="' + (on ? 'Masquer' : 'Afficher') + '" onclick="V2.infosPrefToggle(\'' + s.key + '\')">' +
            '<span class="ic">' + ICO(s.ico, 17, 2) + '</span>' +
            '<span class="v"><b data-count="' + s.n + '">' + s.n + '</b><span>' + s.l + '</span></span>' +
            '<span class="tg">' + CHECK_SVG + '</span>' +
          '</button>';
        }).join('') + '</div>';
      }
      if (recap && recap.une) {
        html += '<div class="inf-une"><span class="tag">À la une</span><span>' + esc(recap.une) + '</span></div>';
      }

      // ════════ ACTU OFFICINE (mise en avant, regroupée par rubrique) ════════
      var secActu = '';
      if (actu.length) {
        var actuSorted = actu.slice().sort(function (a, b) { return (b.today ? 1 : 0) - (a.today ? 1 : 0); });
        var aRows = actuSorted.slice(0, 12).map(function (i) {
          var rb = rubricOf(i);
          return '<a class="inf-row"' + (i.url ? ' href="' + esc(i.url) + '" target="_blank" rel="noopener"' : '') + '>' +
            '<span class="row-em">' + (RUBR_EM[rb] || '📰') + '</span>' +
            '<span class="row-body"><b>' + esc(i.titre) + '</b>' +
              '<span>' + esc(i.source || RUBR_LB[rb] || 'Actu') + '</span></span>' +
            (i.url ? '<span class="row-ext">' + ICO('chev', 15, 2) + '</span>' : '') + '</a>';
        }).join('');
        secActu = section('list', 'blue', 'Actu officine',
          'Économie, génériques, sécurité, métier — l\'essentiel de la presse pro.',
          '<div class="inf-list">' + aRows + '</div>');
      }

      // ════════ OPPORTUNITÉS INTÉGRAL ════════
      var secOpps = '';
      if (opps.length) {
        var oppRows = opps.slice(0, 6).map(function (o) {
          var a = o.alt[0];
          var save = a.remise > 0 ? '<span class="pr-save">−' + Math.round(a.remise) + '%</span>' : '';
          var price = a.ip > 0 ? '<span class="pr-price">' + esc(eur(a.ip)) + '</span>' : '';
          return '<a class="inf-opp" onclick="V2.go(\'molecules\',\'' + esc(a.cip) + '\')">' +
            '<div class="opp-top">' +
              '<span class="opp-dci">' + esc(cap(o.r.dci)) + '</span>' +
              '<span class="opp-st st-' + statutType(o.r.statut) + '">' + esc(statutLabel(o.r.statut)) + '</span>' +
            '</div>' +
            '<div class="opp-arrow">→ Alternative en stock chez Intégral</div>' +
            '<div class="opp-prod">' + esc(cap((a.d || '').toLowerCase())) + '</div>' +
            '<div class="opp-foot">' +
              '<span class="opp-cip">CIP ' + esc(a.cip) + '</span>' +
              '<span class="opp-pr">' + price + save + '</span>' +
            '</div>' +
            '<span class="opp-cta">Voir la fiche produit ' + ICO('chev', 15, 2.4) + '</span>' +
          '</a>';
        }).join('');
        secOpps = section('spark', 'green', 'Opportunités Intégral',
          'Molécule en tension = vente à sécuriser. Pour chacune, l\'alternative référencée Intégral.',
          '<div class="inf-opps">' + oppRows + '</div>');
      }

      // ════════ RUPTURES & TENSIONS ════════
      var secRupt = '';
      if (rsrc.length) {
        var rRows = rsrc.slice(0, 14).map(function (r) {
          var ty = statutType(r.statut);
          var meta = rlive.length
            ? (r.depuis ? 'depuis le ' + esc(r.depuis) : 'signalé ANSM')
            : (r.dci ? esc(cap(r.dci)) : 'ANSM');
          return '<a class="inf-row"' + (r.url ? ' href="' + esc(r.url) + '" target="_blank" rel="noopener"' : '') + '>' +
            '<span class="row-dot d-' + ty + '"></span>' +
            '<span class="row-body"><b>' + esc(cap((r.titre || '').toLowerCase())) + '</b><span>' + meta + '</span></span>' +
            '<span class="row-tag t-' + ty + '">' + esc(statutLabel(r.statut)) + '</span>' +
            (r.url ? '<span class="row-ext">' + ICO('chev', 15, 2) + '</span>' : '') + '</a>';
        }).join('');
        var rSub = 'Surveillance ANSM.' + (rsrc.length > 14 ? ' Les ' + Math.min(rsrc.length, 14) + ' dernières alertes.' : '');
        secRupt = section('alert', 'rose', 'Ruptures & tensions', rSub,
          '<div class="inf-list">' + rRows + '</div>');
      }

      // ════════ RAPPELS PARAPHARMA ════════
      var secRappels = '';
      if (rappels.length) {
        var rapRows = rappels.slice(0, 8).map(function (r) {
          return '<a class="inf-row"' + (r.url ? ' href="' + esc(r.url) + '" target="_blank" rel="noopener"' : '') + '>' +
            '<span class="row-dot d-amber"></span>' +
            '<span class="row-body"><b>' + esc(cap((r.titre || '').toLowerCase())) + '</b>' +
              '<span>' + [r.marque ? esc(r.marque) : '', r.risque ? esc(r.risque) : ''].filter(Boolean).join(' · ') + '</span></span>' +
            (r.url ? '<span class="row-ext">' + ICO('chev', 15, 2) + '</span>' : '') + '</a>';
        }).join('');
        secRappels = section('alert', 'amber', 'Rappels parapharma',
          'RappelConso — à retirer des rayons et signaler aux patients.',
          '<div class="inf-list">' + rapRows + '</div>');
      }

      // ── Assemblage selon les préférences (officine en avant) ──
      var body = '';
      if (PREFS.officine) body += secActu;
      if (PREFS.opps) body += secOpps;
      if (PREFS.ruptures) body += secRupt;
      if (PREFS.rappels) body += secRappels;
      if (!body) {
        body = '<div class="inf-allhidden">Tout est masqué. Touche une carte ci-dessus pour réafficher une rubrique.</div>';
      }
      html += body;

      html += '</div>';
      root.innerHTML = html;
      markSeen();   // la prochaine ouverture comparera à aujourd'hui

      // ── Motion (façon Framer Motion, 100% vanilla, RM-safe via l'API) ──
      var mo = V2.motion;
      if (mo) {
        // Compteurs « L'essentiel du jour » : count-up quand la ligne arrive à l'écran
        var statsEl = root.querySelector('.inf-stats');
        if (statsEl) {
          mo.inView(statsEl, function (el) {
            mo.stagger(el.querySelectorAll('.inf-stat'), { step: 60, y: 8 });
            var cs = el.querySelectorAll('[data-count]');
            for (var i = 0; i < cs.length; i++) mo.countUp(cs[i]);
          });
        }
        // Cartes Opportunités Intégral : cascade d'entrée à l'écran
        var oppsEl = root.querySelector('.inf-opps');
        if (oppsEl) {
          mo.inView(oppsEl, function (el) { mo.stagger(el.querySelectorAll('.inf-opp'), { step: 50, cap: 6, y: 10 }); });
        }
        // Rangées de rubriques (ruptures / rappels / actu) : cascade à l'écran
        var lists = root.querySelectorAll('.inf-list');
        for (var L = 0; L < lists.length; L++) {
          (function (listEl) {
            mo.inView(listEl, function (el) { mo.stagger(el.querySelectorAll('.inf-row'), { step: 34, cap: 10, y: 8 }); });
          })(lists[L]);
        }
      }
    }
  };

  // un en-tête de section + son corps, ton calme, un accent par thème
  function section(ico, accent, title, sub, body) {
    return '<section class="inf-sec a-' + accent + '">' +
      '<div class="inf-sec-head">' +
        '<span class="inf-sec-ic">' + ICO(ico, 18, 2) + '</span>' +
        '<span class="inf-sec-meta"><span class="inf-sec-t">' + title + '</span>' +
          '<span class="inf-sec-s">' + sub + '</span></span>' +
      '</div>' + body + '</section>';
  }

  function injectStyles() {
    if (document.getElementById('v2-infos-css')) return;
    var st = document.createElement('style'); st.id = 'v2-infos-css';
    st.textContent = [
      // accents locaux par thème (mappés sur tokens v2.css)
      '.inf2{--a-rose:var(--c-rose);--a-amber:var(--c-amber);--a-blue:var(--ip-blue);--a-green:var(--c-opp)}',
      '.inf2 .a-rose{--acc:var(--c-rose)}.inf2 .a-amber{--acc:var(--c-amber)}.inf2 .a-blue{--acc:var(--ip-blue)}.inf2 .a-green{--acc:var(--c-opp)}',
      // ── HERO ──
      '.inf2 .inf-hero{text-align:center;margin-bottom:var(--sp-6)}',
      '.inf2 .inf-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:10px}',
      '.inf2 .inf-eyebrow .live{display:inline-flex;align-items:center;gap:6px;color:var(--c-rose);font-weight:700}',
      '.inf2 .inf-eyebrow .live i{width:7px;height:7px;border-radius:50%;background:var(--c-rose);box-shadow:0 0 0 3px color-mix(in srgb,var(--c-rose) 20%,transparent);animation:infpulse 1.8s ease-in-out infinite}',
      '@keyframes infpulse{0%,100%{opacity:1}50%{opacity:.4}}',
      '.inf2 .inf-hero h1{font-size:clamp(28px,5vw,38px);font-weight:800;letter-spacing:-.03em;line-height:1.05;margin:0 0 10px}',
      '.inf2 .inf-lede{color:var(--muted);font-size:15px;line-height:1.5;max-width:56ch;margin:0 auto;font-weight:450}',
      '.inf2 .inf-new{color:var(--c-opp,#12a150);font-weight:700}',
      '.inf2 .inf-copy{display:inline-flex;align-items:center;gap:7px;margin-top:14px;padding:8px 15px;border:1px solid var(--line);background:var(--card);color:var(--ip-ink);border-radius:var(--r-pill,999px);font:inherit;font-size:13px;font-weight:700;cursor:pointer;box-shadow:var(--sh-1);transition:transform .16s,border-color .16s,color .16s}',
      '.inf2 .inf-copy:hover{transform:translateY(-1px);border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.inf2 .inf-copy svg{flex:none}',
      // ── L'ESSENTIEL : compteurs ──
      '.inf2 .inf-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}',
      '@media(max-width:720px){.inf2 .inf-stats{grid-template-columns:repeat(2,1fr)}}',
      '.inf2 .inf-stat{display:flex;align-items:center;gap:11px;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1)}',
      '.inf2 .inf-stat .ic{width:34px;height:34px;flex:none;border-radius:10px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--acc) 12%,var(--card));color:var(--acc)}',
      '.inf2 .inf-stat .v{display:flex;flex-direction:column;line-height:1.15;min-width:0}',
      '.inf2 .inf-stat .v b{font-size:22px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
      '.inf2 .inf-stat .v span{font-size:12.5px;color:var(--muted);font-weight:500}',
      // ── Cartes "L'essentiel" transformées en filtres cliquables ──
      '.inf2 .inf-pick-h{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;font-size:13px;font-weight:700;color:var(--ip-ink);margin:2px 0 11px;letter-spacing:-.01em}',
      '.inf2 .inf-pick-h span{font-size:12px;font-weight:500;color:var(--muted)}',
      '.inf2 button.inf-stat{cursor:pointer;width:100%;text-align:left;font:inherit;position:relative;-webkit-appearance:none;appearance:none;transition:transform .2s var(--mo-ease-soft),box-shadow .2s var(--mo-ease-soft),opacity .2s}',
      '.inf2 button.inf-stat:hover{transform:translateY(-2px);box-shadow:var(--sh-2)}',
      '.inf2 button.inf-stat:focus-visible{outline:2px solid var(--acc);outline-offset:2px}',
      '.inf2 .inf-stat .v{padding-right:22px}',
      '.inf2 .inf-stat .tg{position:absolute;top:9px;right:9px;width:19px;height:19px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:var(--acc);color:#fff;border:1.5px solid var(--acc);transition:background .18s,border-color .18s,color .18s}',
      '.inf2 .inf-stat.off{opacity:.6}',
      '.inf2 .inf-stat.off .tg{background:transparent;border-color:var(--line-strong);color:transparent}',
      '.inf2 .inf-stat.off .ic{background:var(--card-2);color:var(--muted-2)}',
      '.inf2 .inf-stat.off .v b{color:var(--muted)}',
      '.inf2 .inf-allhidden{padding:28px 20px;text-align:center;color:var(--muted);font-size:14px;line-height:1.5;background:var(--card-2);border:1px dashed var(--line-strong);border-radius:var(--r-md)}',
      // À la une
      '.inf2 .inf-une{display:flex;align-items:flex-start;gap:11px;padding:14px 16px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);font-size:14px;font-weight:500;line-height:1.4;margin-bottom:var(--sp-7)}',
      '.inf2 .inf-une .tag{flex:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 10%,var(--card));padding:4px 9px;border-radius:var(--r-pill)}',
      // ── SECTIONS ──
      '.inf2 .inf-sec{margin-top:var(--section-gap)}',
      '.inf2 .inf-sec:first-of-type{margin-top:0}',
      '.inf2 .inf-sec-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}',
      '.inf2 .inf-sec-ic{width:38px;height:38px;flex:none;border-radius:11px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--acc) 12%,var(--card));color:var(--acc);border:1px solid color-mix(in srgb,var(--acc) 16%,var(--line))}',
      '.inf2 .inf-sec-meta{display:flex;flex-direction:column;gap:2px;padding-top:1px}',
      '.inf2 .inf-sec-t{font-size:18px;font-weight:700;letter-spacing:-.01em;line-height:1.15}',
      '.inf2 .inf-sec-s{font-size:13px;color:var(--muted);font-weight:450;line-height:1.35}',
      // ── LISTE (rangées calmes) ──
      '.inf2 .inf-list{display:flex;flex-direction:column;gap:8px}',
      '.inf2 .inf-row{display:flex;align-items:center;gap:12px;padding:13px 15px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);text-decoration:none;color:var(--ip-ink);cursor:pointer;box-shadow:var(--sh-1);transition:transform .2s var(--mo-ease-soft),box-shadow .2s var(--mo-ease-soft),border-color .2s var(--mo-ease-soft)}',
      '.inf2 .inf-row:hover{transform:translateY(-2px);box-shadow:var(--sh-2);border-color:color-mix(in srgb,var(--acc) 30%,var(--line))}',
      '.inf2 .inf-row:focus-visible{outline:2px solid var(--acc);outline-offset:2px}',
      '.inf2 .row-dot{width:9px;height:9px;flex:none;border-radius:50%}',
      '.inf2 .row-dot.d-rupt{background:var(--c-rose);box-shadow:0 0 0 4px color-mix(in srgb,var(--c-rose) 16%,transparent)}',
      '.inf2 .row-dot.d-tens{background:var(--c-amber);box-shadow:0 0 0 4px color-mix(in srgb,var(--c-amber) 16%,transparent)}',
      '.inf2 .row-dot.d-amber{background:var(--c-amber);box-shadow:0 0 0 4px color-mix(in srgb,var(--c-amber) 16%,transparent)}',
      '.inf2 .row-em{font-size:19px;flex:none;line-height:1;width:26px;text-align:center}',
      '.inf2 .row-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}',
      '.inf2 .row-body b{font-size:14px;font-weight:600;letter-spacing:-.01em;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.inf2 .row-body span{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.inf2 .row-tag{flex:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;padding:4px 9px;border-radius:var(--r-pill);white-space:nowrap}',
      '.inf2 .row-tag.t-rupt{background:color-mix(in srgb,var(--c-rose) 12%,var(--card));color:var(--c-rose-txt)}',
      '.inf2 .row-tag.t-tens{background:color-mix(in srgb,var(--c-amber) 14%,var(--card));color:var(--c-amber-txt)}',
      '.inf2 .row-ext{flex:none;color:var(--muted-2);display:flex;transition:transform .2s var(--mo-ease-soft),color .2s}',
      '.inf2 .inf-row:hover .row-ext{transform:translateX(2px);color:var(--acc)}',
      // ── OPPORTUNITÉS INTÉGRAL (cartes) ──
      '.inf2 .inf-opps{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}',
      '@media(max-width:640px){.inf2 .inf-opps{grid-template-columns:1fr}}',
      '.inf2 .inf-opp{position:relative;display:flex;flex-direction:column;gap:8px;padding:18px 18px 16px;background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--line);border-left:3px solid var(--c-opp);border-radius:var(--r-card);text-decoration:none;color:var(--ip-ink);cursor:pointer;box-shadow:var(--sh-1);transition:transform .24s var(--mo-ease-soft),box-shadow .24s var(--mo-ease-soft),border-color .24s var(--mo-ease-soft)}',
      '.inf2 .inf-opp:hover{transform:translateY(-3px);box-shadow:var(--sh-2);border-color:var(--line);border-left-color:var(--c-opp)}',
      '.inf2 .inf-opp:focus-visible{outline:2px solid var(--c-opp);outline-offset:2px}',
      '.inf2 .opp-top{display:flex;align-items:center;gap:9px}',
      '.inf2 .opp-dci{font-size:15px;font-weight:700;letter-spacing:-.01em;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.inf2 .opp-st{flex:none;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;padding:4px 8px;border-radius:var(--r-pill)}',
      '.inf2 .opp-st.st-rupt{background:color-mix(in srgb,var(--c-rose) 12%,var(--card));color:var(--c-rose-txt)}',
      '.inf2 .opp-st.st-tens{background:color-mix(in srgb,var(--c-amber) 14%,var(--card));color:var(--c-amber-txt)}',
      '.inf2 .opp-arrow{font-size:11.5px;font-weight:600;color:var(--c-mint-txt)}',
      '.inf2 .opp-prod{font-size:14.5px;font-weight:600;letter-spacing:-.01em;line-height:1.25;color:var(--ip-ink)}',
      '.inf2 .opp-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:2px}',
      '.inf2 .opp-cip{font-family:var(--mono);font-size:11px;color:var(--muted)}',
      '.inf2 .opp-pr{display:flex;align-items:center;gap:8px}',
      '.inf2 .pr-price{font-weight:800;font-size:16px;letter-spacing:-.02em;color:var(--ip-blue)}',
      '.inf2 .pr-save{font-size:11.5px;font-weight:700;color:#fff;background:var(--c-opp);padding:3px 8px;border-radius:var(--r-pill)}',
      '.inf2 .opp-cta{display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;font-weight:700;color:var(--ip-blue)}',
      '.inf2 .opp-cta svg{transition:transform .24s var(--mo-ease-soft)}',
      '.inf2 .inf-opp:hover .opp-cta svg{transform:translateX(3px)}',
      // ── LOADING / EMPTY ──
      '.inf2 .inf-load,.inf2 .inf-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:70px 20px;color:var(--muted)}',
      '.inf2 .inf-spin{width:30px;height:30px;border-radius:50%;border:3px solid var(--line-strong);border-top-color:var(--ip-blue);animation:infspin .8s linear infinite}',
      '@keyframes infspin{to{transform:rotate(360deg)}}',
      '.inf2 .inf-empty-ic{width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--ip-blue) 10%,var(--card));color:var(--ip-blue)}',
      '.inf2 .inf-empty-t{font-size:18px;font-weight:700;color:var(--ip-ink);letter-spacing:-.01em}',
      '.inf2 .inf-empty-d{font-size:14px;max-width:38ch;line-height:1.5}',
      // apparition douce
      '.inf2 .inf-hero,.inf2 .inf-une,.inf2 .inf-sec{animation:infin .45s var(--mo-ease-in) both}',
      '.inf2 .inf-une{animation-delay:.08s}',
      '.inf2 .inf-sec:nth-of-type(1){animation-delay:.10s}.inf2 .inf-sec:nth-of-type(2){animation-delay:.14s}.inf2 .inf-sec:nth-of-type(3){animation-delay:.18s}.inf2 .inf-sec:nth-of-type(4){animation-delay:.22s}',
      '@keyframes infin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      '@media(prefers-reduced-motion:reduce){.inf2 .inf-hero,.inf2 .inf-une,.inf2 .inf-sec{animation:none}.inf2 .inf-row,.inf2 .inf-opp,.inf2 .row-ext,.inf2 .opp-cta svg{transition:none}.inf2 .inf-eyebrow .live i,.inf2 .inf-spin{animation:none}}'
    ].join('');
    document.head.appendChild(st);
  }
})();
