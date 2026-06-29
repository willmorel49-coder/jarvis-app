/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Infos du matin" (pages.infos) — design "Rubriques colorées"
   Lit crm/v2/infos-jour.json (robot GitHub Actions : RSS ANSM ruptures/sécu/actu +
   presse pro). Classe les actus par rubrique métier (Économie/remboursement,
   Génériques/substitution, Sécurité/rappels, Métier) + Opportunités IP en tête
   (ruptures croisées au catalogue par molécule). 100% gratuit, fallback propre.
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

  // statut rupture → classe badge + libellé court
  function statutClass(s) { s = norm(s); if (s.indexOf('rupture') >= 0) return 'nv8-st-bad'; if (s.indexOf('remise') >= 0 || s.indexOf('disponible') >= 0) return 'nv8-st-ok'; return 'nv8-st-warn'; }
  function statutLabel(s) { var n = norm(s); if (n.indexOf('rupture') >= 0) return 'Rupture de stock'; if (n.indexOf('remise') >= 0 || n.indexOf('disponible') >= 0) return 'Remise à dispo'; if (n.indexOf('arret') >= 0) return 'Arrêt de commercialisation'; if (n.indexOf('tension') >= 0) return 'Tension'; return 'Signalé ANSM'; }

  // rubrique métier d'une actu
  function rubricOf(i) {
    if (i.cat === 'securite') return 'secu';
    var x = norm(i.titre + ' ' + (i.resume || ''));
    if (/rappel|pharmacovigilance|retrait de lot|vigilance|defaut qualite|alerte securite/.test(x)) return 'secu';
    if (/generiqu|biosimil|substitu|interchangeab|delivr|repertoire/.test(x)) return 'gen';
    if (/rembours|deremboursement|\bprix\b|honorair|convention|avenant|rosp|tarif|nomenclature|economie|\bmarge|lfss|cnam|ceps|budget|cotation|\bsecu\b|grossist|repartit|distribut|contingent|quota/.test(x)) return 'eco';
    return 'metier';
  }

  // mots à ignorer dans une DCI : sels, hydrates, excipients, liaisons
  var DCI_STOP = { de: 1, du: 1, d: 1, et: 1, en: 1, la: 1, le: 1, acide: 1, chlorhydrate: 1, sulfate: 1, sodique: 1, sodium: 1, calcique: 1, calcium: 1, potassique: 1, maleate: 1, fumarate: 1, tartrate: 1, besilate: 1, mesilate: 1, bromure: 1, base: 1, monohydrate: 1, dihydrate: 1, trihydrate: 1, anhydre: 1, micronise: 1, hemifumarate: 1, dipropionate: 1, valerate: 1, acetate: 1, phosphate: 1, citrate: 1, nitrate: 1, succinate: 1, embonate: 1, pamoate: 1 };
  // clés molécule exploitables extraites d'une DCI (mots significatifs ≥5 lettres)
  function dciKeys(dci) {
    return norm(dci).split(/[ ,/()\-]+/).filter(function (w) { return w.length >= 5 && !DCI_STOP[w]; });
  }
  function ipAlternatives(dci) {
    var B = window.BENCHMARK; if (!B || !dci) return [];
    var keys = dciKeys(dci); if (!keys.length) return [];
    var hits = [], seen = {};
    for (var i = 0; i < B.length; i++) {
      var b = B[i], d = norm(b.designation || '');
      var match = false;
      for (var k = 0; k < keys.length; k++) { if (d.indexOf(keys[k]) >= 0) { match = true; break; } }
      if (!match) continue;
      var c = String(b.cip13 || ''); if (seen[c]) continue; seen[c] = 1;
      var bp = V2.bestPrice ? V2.bestPrice(b) : { ip: b.prix_ip, remise: b.remise_pct };
      hits.push({ d: b.designation || '', cip: c, ip: bp.ip, remise: bp.remise || 0, rank: b.ip_rank_qty || 9999 });
    }
    // priorité : remise IP la plus forte, puis meilleure rotation (rang ventes)
    hits.sort(function (a, b) { return (b.remise - a.remise) || (a.rank - b.rank); });
    return hits.slice(0, 2);
  }

  function frDate(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function dayLabel() { try { return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return 'aujourd\'hui'; } }

  var RUBR = [
    { key: 'eco', cls: 'nv8-eco', h: 'Économie, distribution & remboursement', sub: 'Conventions, prix, marge, répartition, grossistes' },
    { key: 'gen', cls: 'nv8-gen', h: 'Génériques & substitution', sub: 'Biosimilaires, délivrance, répertoire' },
    { key: 'secu', cls: 'nv8-secu', h: 'Sécurité & rappels', sub: 'Pharmacovigilance, rappels de lots' },
    { key: 'metier', cls: 'nv8-metier', h: 'Métier & officine', sub: 'Démographie, missions, accès aux soins' },
  ];

  function band(cls, h, sub, n) {
    return '<div class="nv8-band"><span class="nv8-ico"></span><div class="nv8-htxt"><h2>' + esc(h) + '</h2>' +
      (sub ? '<div class="nv8-sub">' + esc(sub) + '</div>' : '') + '</div><span class="nv8-count">' + n + '</span></div>';
  }
  function actuRow(i) {
    var url = i.url ? ' href="' + esc(i.url) + '" target="_blank" rel="noopener"' : '';
    return '<div class="nv8-actu">' +
      '<div class="nv8-actu-top"><span class="nv8-src">' + esc(i.source || '') + '</span>' +
        (i.today ? '<span class="nv8-now">Aujourd\'hui</span>' : '') +
        '<span class="nv8-when">' + esc(frDate(i.date)) + '</span></div>' +
      '<h3 class="nv8-actu-h">' + esc(i.titre) + '</h3>' +
      (i.resume ? '<p class="nv8-actu-p">' + esc(i.resume) + '</p>' : '') +
      (i.url ? '<a class="nv8-read"' + url + '>Lire l\'article</a>' : '') +
    '</div>';
  }

  V2.infosMore = function (id, btn) {
    var el = document.getElementById(id);
    if (el) { el.classList.remove('nv8-clip'); el.classList.remove('nv8-clip-4'); }
    if (btn) btn.style.display = 'none';
  };

  V2.pages.infos = {
    render: function (root) {
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      if (!LOADED && !FAILED) {
        load(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
        root.innerHTML = top + '<div class="v2-wrap"><div class="v2-loading"><div class="v2-spinner"></div><div>Chargement de la veille du matin…</div></div></div>';
        return;
      }
      if (!window.BENCHMARK && V2.loadFiles && DATA) {
        V2.loadFiles(['bench']).then(function () { if (V2.route && V2.route.name === 'infos') V2.render(); });
      }
      var items = (DATA && DATA.items) ? DATA.items : [];
      var ruptures = items.filter(function (i) { return i.cat === 'ruptures'; });

      var html = '<div id="infos-8">';
      // En-tête
      html += '<header class="nv8-head"><div><span class="nv8-date">' + esc(dayLabel()) + '</span><h1 class="nv8-title">Infos du matin</h1></div>' +
        '<div class="nv8-counter">' +
        (((DATA && DATA.count_today) || 0) > 0 ? '<span class="nv8-chip nv8-today"><b class="nv8-mono">' + DATA.count_today + '</b> aujourd\'hui</span>' : '') +
        '<span class="nv8-chip"><b class="nv8-mono">' + ((DATA && DATA.count) || items.length) + '</b> infos · 7 derniers jours</span></div></header>';

      // Récap en tête (synthèse IA si dispo, sinon calculé)
      if (DATA && DATA.recap && DATA.recap.text) {
        var rcp = DATA.recap;
        html += '<article class="nv8-recap' + (rcp.ai ? ' nv8-recap-ai' : '') + '">' +
          '<div class="nv8-recap-h">' + (rcp.ai ? '✨ Synthèse du matin' : 'L\'essentiel ce matin') + '</div>' +
          '<div class="nv8-recap-t">' + esc(rcp.text).replace(/\n+/g, '<br>') + '</div>' +
          (rcp.une ? '<div class="nv8-recap-une"><span>À la une</span> ' + esc(rcp.une) + '</div>' : '') +
          '</article>';
      }

      if (!DATA || !items.length) {
        html += '<article class="nv8-sec"><div class="nv8-body"><p class="nv8-actu-p" style="padding:18px 0">' +
          (FAILED ? 'La veille du jour n\'a pas pu être chargée (connexion ?). Elle se met à jour chaque matin.' : 'Pas encore d\'infos aujourd\'hui. La veille se met à jour chaque matin.') +
          '</p></div></article></div>';
        root.innerHTML = top + '<div class="v2-wrap">' + html + '</div>';
        return;
      }

      // Opportunités IP
      if (window.BENCHMARK) {
        var opps = ruptures.map(function (r) { return { r: r, alt: r.dci ? ipAlternatives(r.dci) : [] }; }).filter(function (o) { return o.alt.length; });
        if (opps.length) {
          var cards = opps.slice(0, 6).map(function (o) {
            var a = o.alt[0];
            return '<a class="nv8-opp-card" onclick="V2.go(\'molecules\',\'' + esc(a.cip) + '\')" style="cursor:pointer;text-decoration:none;color:inherit">' +
              '<div><div class="nv8-flow"><span class="nv8-rx">' + esc(cap(o.r.dci)) + '</span> <span class="nv8-arr">' + esc((statutLabel(o.r.statut)).toLowerCase()) + '</span> <span class="nv8-arr">→</span> <span class="nv8-ipbadge">Alternative IP en stock</span></div>' +
              '<div class="nv8-altname">' + esc(cap((a.d || '').toLowerCase())) + '</div></div>' +
              '<div class="nv8-price"><span class="nv8-eur nv8-mono">' + (a.ip > 0 ? esc(eur(a.ip)) : '—') + '</span>' +
              (a.remise > 0 ? '<br><span class="nv8-disc nv8-mono">−' + Math.round(a.remise) + ' %</span>' : '') + '</div></a>';
          }).join('');
          html += '<article class="nv8-sec nv8-opp">' + band('', 'Opportunités IP', 'Une rupture en officine, une alternative Intégral Pharma en stock', opps.length) +
            '<div class="nv8-body">' + cards + '</div></article>';
        }
      }

      // Ruptures & tensions médicament — EN DIRECT (API ANSM/BDPM)
      var rlive = (DATA && DATA.ruptures_live) ? DATA.ruptures_live : [];
      if (rlive.length) {
        var rows = rlive.slice(0, 24).map(function (r) {
          return '<a class="nv8-rupt-item"' + (r.url ? ' href="' + esc(r.url) + '" target="_blank" rel="noopener"' : '') + ' style="text-decoration:none;color:inherit">' +
            '<span class="nv8-status ' + statutClass(r.statut) + '">' + esc(statutLabel(r.statut)) + '</span>' +
            '<div><div class="nv8-rupt-name">' + esc(cap((r.titre || '').toLowerCase())) + '</div>' +
            '<div class="nv8-rupt-meta">' + (r.depuis ? '<span class="nv8-since">depuis le <span class="nv8-mono">' + esc(r.depuis) + '</span></span>' : '') +
            (r.url ? ' · <span class="nv8-mol">fiche ANSM ↗</span>' : '') + '</div></div></a>';
        }).join('');
        var rtot = (DATA && DATA.ruptures_total) || rlive.length;
        var rShown = Math.min(rlive.length, 24);
        html += '<article class="nv8-sec nv8-rupt">' + band('', 'Ruptures & tensions médicament', rtot + ' suivies en direct · les plus récentes', rlive.length) +
          '<div class="nv8-body nv8-clip" id="nv8-rupt-body">' + rows + '</div>' +
          (rShown > 6 ? '<button class="nv8-more" onclick="V2.infosMore(\'nv8-rupt-body\',this)">Voir les ' + (rShown - 6) + ' autres</button>' : '') + '</article>';
      } else if (ruptures.length) {
        var rows0 = ruptures.map(function (r) {
          return '<div class="nv8-rupt-item"><span class="nv8-status ' + statutClass(r.statut) + '">' + esc(statutLabel(r.statut)) + '</span>' +
            '<div><div class="nv8-rupt-name">' + esc(r.titre) + '</div>' +
            '<div class="nv8-rupt-meta">' + (r.dci ? '<span class="nv8-mol">' + esc(r.dci) + '</span>' : '') +
            (r.depuis ? (r.dci ? ' · ' : '') + '<span class="nv8-since">depuis le <span class="nv8-mono">' + esc(r.depuis) + '</span></span>' : '') + '</div></div></div>';
        }).join('');
        html += '<article class="nv8-sec nv8-rupt">' + band('', 'Ruptures & tensions ANSM', 'Statut, molécule et date d\'entrée', ruptures.length) +
          '<div class="nv8-body">' + rows0 + '</div></article>';
      }

      // Rappels de produits (parapharma / cosmétiques) — API RappelConso
      var rappels = (DATA && DATA.rappels) ? DATA.rappels : [];
      if (rappels.length) {
        var rc = rappels.slice(0, 12).map(function (r) {
          var img = r.img
            ? '<div class="nv8-rap-img" style="background-image:url(\'' + esc(r.img) + '\')"></div>'
            : '<div class="nv8-rap-img nv8-rap-noimg">⚠</div>';
          return '<a class="nv8-rap-card"' + (r.url ? ' href="' + esc(r.url) + '" target="_blank" rel="noopener"' : '') + '>' + img +
            '<div class="nv8-rap-main">' +
              (r.marque ? '<div class="nv8-rap-brand">' + esc(r.marque) + '</div>' : '') +
              '<div class="nv8-rap-name">' + esc(cap((r.titre || '').toLowerCase())) + '</div>' +
              (r.risque ? '<div class="nv8-rap-risk">⚠ ' + esc(r.risque) + '</div>' : '') +
            '</div></a>';
        }).join('');
        var rapN = Math.min(rappels.length, 12);
        html += '<article class="nv8-sec nv8-rap">' + band('', 'Rappels de produits', 'Parapharma rappelés (RappelConso) — à retirer du rayon', rappels.length) +
          '<div class="nv8-body nv8-rap-grid nv8-clip" id="nv8-rap-body">' + rc + '</div>' +
          (rapN > 6 ? '<button class="nv8-more" onclick="V2.infosMore(\'nv8-rap-body\',this)">Voir les ' + (rapN - 6) + ' autres rappels</button>' : '') + '</article>';
      }

      // Rubriques actu
      var actu = items.filter(function (i) { return i.cat !== 'ruptures'; });
      RUBR.forEach(function (rb) {
        var list = actu.filter(function (i) { return rubricOf(i) === rb.key; });
        if (!list.length) return;
        var bid = 'nv8-rub-' + rb.key;
        html += '<article class="nv8-sec ' + rb.cls + '">' + band('', rb.h, rb.sub, list.length) +
          '<div class="nv8-body nv8-clip-4" id="' + bid + '">' + list.map(actuRow).join('') + '</div>' +
          (list.length > 4 ? '<button class="nv8-more" onclick="V2.infosMore(\'' + bid + '\',this)">Voir les ' + (list.length - 4) + ' autres</button>' : '') + '</article>';
      });

      var maj = (DATA && DATA.generated_at) ? frDate(DATA.generated_at) : '';
      html += '<div class="nv8-foot">Sources : ANSM (ruptures en direct) · RappelConso/DGCCRF (rappels) · Le Quotidien du Pharmacien · Le Moniteur des pharmacies · FSPF · Le Pharmacien de France · Leem' + (maj ? ' · mis à jour le ' + maj : '') + '. Veille santé/officine multi-sources, croisée au catalogue IP, chaque matin.</div>';
      html += '</div>';

      root.innerHTML = top + '<div class="v2-wrap">' + html + '</div>';
    }
  };

  if (!document.getElementById('v2-infos-css')) {
    var st = document.createElement('style'); st.id = 'v2-infos-css';
    st.textContent =
      '#infos-8{--ip-blue:#0050E6;--ip-ink:#10131C;--muted:#737A8C;--muted-2:#9AA1B2;--paper:#FBFCFE;--card:#FFFFFF;--card-2:#F7F9FC;--line:rgba(16,19,28,.07);--line-strong:rgba(16,19,28,.12);--ok:#1E9E6A;--warn:#C7791A;--bad:#E0556E;--cat:#6D4FC4;--froid:#00B5D8;--r-card:20px;--r-md:14px;--r-pill:999px;--sh-1:0 1px 2px rgba(16,19,28,.04);--sh-2:0 6px 24px rgba(16,19,28,.06),0 2px 6px rgba(16,19,28,.04);font-family:"Satoshi",system-ui,sans-serif;color:var(--ip-ink);max-width:760px;margin:0 auto;padding:6px 0 40px;line-height:1.5}' +
      '#infos-8 *{box-sizing:border-box}' +
      '#infos-8 .nv8-mono{font-family:"Geist Mono",ui-monospace,monospace;font-feature-settings:"tnum" 1}' +
      '#infos-8 .nv8-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:22px}' +
      '#infos-8 .nv8-date{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--muted);text-transform:capitalize}' +
      '#infos-8 .nv8-date::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ip-blue);box-shadow:0 0 0 4px rgba(0,80,230,.12)}' +
      '#infos-8 .nv8-title{font-size:28px;font-weight:800;letter-spacing:-.025em;line-height:1.05;margin-top:6px}' +
      '#infos-8 .nv8-counter{display:flex;gap:8px;align-items:center}' +
      '#infos-8 .nv8-chip{display:inline-flex;align-items:baseline;gap:5px;padding:7px 12px;border-radius:var(--r-pill);background:var(--card);border:1px solid var(--line-strong);box-shadow:var(--sh-1);font-size:12px;font-weight:600;color:var(--muted)}' +
      '#infos-8 .nv8-chip b{font-size:14px;color:var(--ip-ink);font-weight:800}' +
      '#infos-8 .nv8-chip.nv8-today{background:rgba(0,80,230,.06);border-color:rgba(0,80,230,.22);color:var(--ip-blue)}' +
      '#infos-8 .nv8-chip.nv8-today b{color:var(--ip-blue)}' +
      '#infos-8 .nv8-sec{--c:var(--ip-blue);--c-soft:rgba(0,80,230,.08);background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--sh-2);overflow:hidden;margin-bottom:22px}' +
      '#infos-8 .nv8-sec.nv8-rupt{--c:var(--bad);--c-soft:rgba(224,85,110,.09)}' +
      '#infos-8 .nv8-sec.nv8-gen{--c:var(--cat);--c-soft:rgba(109,79,196,.09)}' +
      '#infos-8 .nv8-sec.nv8-eco{--c:var(--ip-blue);--c-soft:rgba(0,80,230,.08)}' +
      '#infos-8 .nv8-sec.nv8-secu{--c:var(--warn);--c-soft:rgba(199,121,26,.10)}' +
      '#infos-8 .nv8-sec.nv8-metier{--c:var(--froid);--c-soft:rgba(0,181,216,.10)}' +
      '#infos-8 .nv8-sec.nv8-opp{--c:var(--ok);--c-soft:rgba(30,158,106,.10);border-color:rgba(30,158,106,.22)}' +
      '#infos-8 .nv8-recap{background:linear-gradient(135deg,#0b1220,#16233a);color:#fff;border-radius:18px;padding:18px 20px;margin-bottom:22px;box-shadow:0 8px 24px rgba(11,18,32,.18)}' +
      '#infos-8 .nv8-recap-ai{background:linear-gradient(135deg,#0050E6,#0039A6)}' +
      '#infos-8 .nv8-recap-h{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.85;margin-bottom:8px}' +
      '#infos-8 .nv8-recap-t{font-size:14.5px;line-height:1.55;font-weight:500}' +
      '#infos-8 .nv8-recap-une{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.16);font-size:12.5px;opacity:.92}' +
      '#infos-8 .nv8-recap-une span{font-weight:800;text-transform:uppercase;font-size:10px;letter-spacing:.06em;opacity:.8;margin-right:6px}' +
      '#infos-8 .nv8-sec.nv8-rap{--c:var(--warn);--c-soft:rgba(199,121,26,.10)}' +
      '#infos-8 .nv8-clip > :nth-child(n+7){display:none}' +
      '#infos-8 .nv8-clip-4 > :nth-child(n+5){display:none}' +
      '#infos-8 .nv8-more{display:block;width:100%;margin:0;padding:12px;background:none;border:none;border-top:1px solid var(--line);color:var(--c,var(--ip-blue));font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;letter-spacing:-.01em}' +
      '#infos-8 .nv8-more:hover{background:var(--c-soft)}' +
      '#infos-8 .nv8-rap-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:14px 20px 18px}' +
      '#infos-8 .nv8-rap-card{display:flex;gap:11px;align-items:center;padding:10px;border-radius:14px;background:var(--card-2);border:1px solid var(--line);text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}' +
      '#infos-8 .nv8-rap-card:hover{border-color:rgba(199,121,26,.4);transform:translateY(-2px)}' +
      '#infos-8 .nv8-rap-img{width:58px;height:58px;border-radius:10px;background:#fff center/cover no-repeat;border:1px solid var(--line);flex:none}' +
      '#infos-8 .nv8-rap-noimg{display:grid;place-items:center;font-size:22px;color:var(--warn);background:rgba(199,121,26,.08)}' +
      '#infos-8 .nv8-rap-brand{font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}' +
      '#infos-8 .nv8-rap-name{font-size:13.5px;font-weight:700;letter-spacing:-.01em;line-height:1.25;margin-top:1px}' +
      '#infos-8 .nv8-rap-risk{font-size:11px;font-weight:700;color:var(--warn);margin-top:4px}' +
      '#infos-8 .nv8-band{display:flex;align-items:center;gap:11px;padding:14px 20px;background:var(--c-soft);border-bottom:1px solid var(--line);position:relative}' +
      '#infos-8 .nv8-band::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c)}' +
      '#infos-8 .nv8-ico{width:30px;height:30px;border-radius:9px;background:var(--c);flex:none;display:grid;place-items:center;color:#fff;font-weight:800;font-size:16px}' +
      '#infos-8 .nv8-rupt .nv8-ico::after{content:"!"}' +
      '#infos-8 .nv8-gen .nv8-ico::after{content:"\\21C4"}' +
      '#infos-8 .nv8-eco .nv8-ico::after{content:"\\20AC"}' +
      '#infos-8 .nv8-secu .nv8-ico::after{content:"!"}' +
      '#infos-8 .nv8-metier .nv8-ico::after{content:"+";font-size:19px}' +
      '#infos-8 .nv8-opp .nv8-ico::after{content:"\\2605";font-size:15px}' +
      '#infos-8 .nv8-band h2{font-size:15px;font-weight:800;letter-spacing:-.015em;color:var(--c);line-height:1.2}' +
      '#infos-8 .nv8-sub{font-size:12px;color:var(--muted);font-weight:500;margin-top:1px}' +
      '#infos-8 .nv8-htxt{flex:1}' +
      '#infos-8 .nv8-count{margin-left:auto;font-size:12px;font-weight:700;color:var(--c);background:#fff;border:1px solid var(--line-strong);padding:3px 9px;border-radius:var(--r-pill)}' +
      '#infos-8 .nv8-body{padding:6px 20px 8px}' +
      '#infos-8 .nv8-opp .nv8-body{padding:14px 20px 18px;display:grid;gap:12px}' +
      '#infos-8 .nv8-opp-card{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 16px;border-radius:var(--r-md);background:var(--card-2);border:1px solid var(--line);transition:border-color .15s}' +
      '#infos-8 .nv8-opp-card:hover{border-color:rgba(30,158,106,.4)}' +
      '#infos-8 .nv8-flow{font-size:12px;color:var(--muted);font-weight:600;margin-bottom:5px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}' +
      '#infos-8 .nv8-flow .nv8-rx{color:var(--bad);font-weight:700;text-transform:capitalize}' +
      '#infos-8 .nv8-flow .nv8-arr{color:var(--muted-2)}' +
      '#infos-8 .nv8-flow .nv8-ipbadge{color:var(--ok);font-weight:800}' +
      '#infos-8 .nv8-altname{font-size:15.5px;font-weight:700;letter-spacing:-.01em;line-height:1.3}' +
      '#infos-8 .nv8-price{text-align:right;white-space:nowrap}' +
      '#infos-8 .nv8-price .nv8-eur{font-size:18px;font-weight:800}' +
      '#infos-8 .nv8-price .nv8-disc{display:inline-block;margin-top:5px;font-size:12px;font-weight:800;color:#fff;background:var(--ok);padding:3px 8px;border-radius:var(--r-pill)}' +
      '#infos-8 .nv8-rupt-item{display:flex;align-items:flex-start;gap:13px;padding:14px 0;border-top:1px solid var(--line)}' +
      '#infos-8 .nv8-rupt-item:first-child{border-top:none}' +
      '#infos-8 .nv8-status{flex:none;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:5px 10px;border-radius:var(--r-pill);white-space:nowrap;margin-top:2px;min-width:118px;text-align:center}' +
      '#infos-8 .nv8-st-bad{background:rgba(224,85,110,.12);color:#c23652;border:1px solid rgba(224,85,110,.28)}' +
      '#infos-8 .nv8-st-warn{background:rgba(199,121,26,.12);color:#a8651a;border:1px solid rgba(199,121,26,.30)}' +
      '#infos-8 .nv8-st-ok{background:rgba(30,158,106,.13);color:#178055;border:1px solid rgba(30,158,106,.30)}' +
      '#infos-8 .nv8-rupt-name{font-size:15px;font-weight:700;letter-spacing:-.01em;line-height:1.32}' +
      '#infos-8 .nv8-rupt-meta{font-size:12.5px;color:var(--muted);margin-top:3px}' +
      '#infos-8 .nv8-rupt-meta .nv8-mol{color:var(--cat);font-weight:600;text-transform:capitalize}' +
      '#infos-8 .nv8-rupt-meta .nv8-since{color:var(--muted-2)}' +
      '#infos-8 .nv8-actu{padding:16px 0;border-top:1px solid var(--line)}' +
      '#infos-8 .nv8-actu:first-child{border-top:none}' +
      '#infos-8 .nv8-actu-top{display:flex;align-items:center;gap:9px;margin-bottom:7px;flex-wrap:wrap}' +
      '#infos-8 .nv8-src{font-size:11px;font-weight:700;color:var(--c);background:var(--c-soft);padding:3px 9px;border-radius:var(--r-pill)}' +
      '#infos-8 .nv8-now{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--ip-blue);padding:3px 8px;border-radius:var(--r-pill)}' +
      '#infos-8 .nv8-when{font-size:12px;color:var(--muted-2);font-weight:600;margin-left:auto}' +
      '#infos-8 .nv8-actu-h{font-size:17px;font-weight:800;letter-spacing:-.02em;line-height:1.28;margin-bottom:6px}' +
      '#infos-8 .nv8-actu-p{font-size:14.5px;line-height:1.58;color:#3a4150}' +
      '#infos-8 .nv8-read{display:inline-flex;align-items:center;gap:6px;margin-top:11px;font-size:13px;font-weight:700;color:var(--c);text-decoration:none}' +
      '#infos-8 .nv8-read::after{content:"\\2192";transition:transform .15s}' +
      '#infos-8 .nv8-read:hover::after{transform:translateX(3px)}' +
      '#infos-8 .nv8-foot{margin-top:8px;padding-top:14px;font-size:11.5px;color:var(--muted-2);text-align:center;line-height:1.5}' +
      '@media(max-width:640px){#infos-8 .nv8-title{font-size:24px}#infos-8 .nv8-opp-card{grid-template-columns:1fr;gap:10px}#infos-8 .nv8-price{text-align:left}#infos-8 .nv8-rupt-item{flex-direction:column;gap:8px}#infos-8 .nv8-status{min-width:0}#infos-8 .nv8-when{margin-left:0}}';
    document.head.appendChild(st);
  }
})();
