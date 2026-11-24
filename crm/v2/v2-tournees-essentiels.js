/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · TOURNÉES — bloc « La T10, les clientes d'Angers et les Essentiels » (V2.tourneesEssentiels) — 24/11/2026
   Maquette v1 « Carte » choisie par Will le 24/11/2026 : dans #tournees/T10, la carte de la T10 centrée sur Angers, les clientes d'Angers
   en bleu, une bascule « Aujourd'hui / En quotidien » qui ajoute les officines Essentiels Pharma (losanges), une liste à droite triée de la
   plus proche de la route à la plus loin, les boutons « Toute la T10 » et « Zoom Angers ».

   - Accroche EXPLICITE : v2-tournees.js appelle monter() après avoir dessiné le tableau de bord de la T10 (pas d'observateur global).
   - DÉCISION DE WILL (24/11/2026) : les Essentiels à plus de 40 km de TOUTE tournée (3 à Paris, Boulogne-Billancourt, Pacy-sur-Eure) sont HORS
     PROJET : ni sur la carte, ni dans la liste, ni dans aucun texte de ce bloc. Elles restent Essentiels dans l'écran Groupements.
   - DONNÉES (aucune dans le dépôt) : TOURNEES_ECRAN (fichier protégé, déjà chargé par l'écran), PHARMA_FR (base nationale publique,
     V2.ensurePharmaFr), GRP_DEPART (les CIP Essentiels, groupement-alias.js), WML_OFFICINES (clientes du CRM, chargées avant tout écran).
     Une donnée manquante = « en cours de chargement », jamais un chiffre faux. AUCUN chiffre écrit en dur : tout est calculé ici (tests/tournees.test.mjs).
   - Fond de carte : V2.fondCarte (jamais CARTO). Accès : celui de l'écran Tournées (interdit() de v2-tournees.js), rien de plus.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};
  var E = {};
  var NBSP = ' ';
  var BLEU = '#0050E6', ENCRE = '#1A2030', TURQ = '#0B8A7E', GRIS = '#6B7A99';
  var SEUIL_LOIN = 40;      // km : au-delà de ce seuil par rapport à la tournée la plus proche, l'officine est hors projet (Will, 24/11/2026)
  E.SEUIL_LOIN = SEUIL_LOIN;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function nf(x, d) { return Number(x).toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).replace(/[  ]/g, NBSP); }
  function eur(x) { return nf(Math.round(x), 0) + NBSP + '€'; }
  function km(x) { return nf(x, x < 10 ? 1 : 0) + NBSP + 'km'; }
  // La base nationale écrit les noms en majuscules sans accent : on ne met que les majuscules et minuscules, rien d'autre.
  function joli(s) {
    return String(s || '').toLowerCase().replace(/(^|\s)l (?=[a-zà-ÿ])/g, '$1l’').replace(/(^|[\s\-'’(])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); })
      .replace(/\b(De|Du|Des|La|Le|Les|Et|Sur|En|Aux|Au|Sous|L)\b/g, function (m, w) { return w.toLowerCase(); }).replace(/^./, function (c) { return c.toUpperCase(); })
      .replace(/\bSt\b/g, 'Saint').replace(/\bSte\b/g, 'Sainte').replace(/\bPhie\b/g, 'Pharmacie').replace(/l’([a-zà-ÿ])/g, function (m, c) { return 'l’' + c.toUpperCase(); });
  }
  E.joli = joli;

  // ── Calcul pur : distance d'un point à un tracé (projection locale, segments) ──
  function distKm(lat, lng, tr) {
    var k = 111.195, c = Math.cos(lat * Math.PI / 180), best = 1e9;
    for (var i = 0; i < tr.length - 1; i++) {
      var ax = (tr[i][1] - lng) * c * k, ay = (tr[i][0] - lat) * k, bx = (tr[i + 1][1] - lng) * c * k, by = (tr[i + 1][0] - lat) * k, dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      var t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0, px = ax + t * dx, py = ay + t * dy, d = Math.sqrt(px * px + py * py);
      if (d < best) best = d;
    }
    return best;
  }
  E.distKm = distKm;

  // Tout le calcul du bloc. T = TOURNEES_ECRAN, PF = PHARMA_FR, G = GRP_DEPART (cip -> groupement), wml = liste des clientes du CRM.
  // Rend null tant qu'une donnée manque. Les Essentiels à plus de SEUIL_LOIN km de toute tournée ne sont PAS dans le résultat.
  E.calculer = function (T, PF, G, wml, code) {
    code = code || 'T10';
    if (!T || !T.tournees || !T.tournees[code] || !PF || !PF.p || !G || !wml) return null;
    var tt = T.tournees[code], pf = {}, cli = {};
    PF.p.forEach(function (p) { pf[String(p[13])] = p; });
    wml.forEach(function (o) { cli[String(o.id)] = o; });
    var arret = {};   // cip -> { code, a } (la première tournée qui livre cette officine)
    Object.keys(T.tournees).forEach(function (c) { (T.tournees[c].arrets || []).forEach(function (a) { if (!arret[a.id]) arret[a.id] = { code: c, a: a }; }); });
    function chiffres(cip) {
      var x = arret[cip]; if (!x || !x.a.r) return null;
      var tot = { ca: 0, m: 0, cmd: 0 }; (x.a.m || []).forEach(function (mm) { if (mm) { tot.ca += mm[0]; tot.m += mm[1]; tot.cmd += mm[2]; } });
      return { code: x.code, ca: tot.ca, marge: tot.m, cmd: tot.cmd, rm: x.a.r.rm };
    }
    var ess = Object.keys(G).filter(function (cip) { return pf[cip]; }).map(function (cip) {
      var p = pf[cip], proche = 1e9, qui = '';
      Object.keys(T.tournees).forEach(function (c) { var d = distKm(p[0], p[1], T.tournees[c].trace); if (d < proche) { proche = d; qui = c; } });
      var pr = null; (tt.prospects || []).forEach(function (r) { if (String(r[0]) === cip) pr = r; });
      return { cip: cip, nom: joli(p[6]), ville: joli(p[7]), cp: p[8], lat: p[0], lng: p[1], cliente: !!cli[cip], arret: arret[cip] ? arret[cip].code : '',
        ch: chiffres(cip), d10: distKm(p[0], p[1], tt.trace), detour: pr ? pr[6] : null, proche: proche, procheCode: qui };
    }).filter(function (e) { return e.proche <= SEUIL_LOIN; })
      .sort(function (a, b) { return a.d10 - b.d10; });
    var angers = Object.keys(cli).filter(function (id) { return /^ANGERS/i.test(cli[id].ville); }).map(function (id) {
      var o = cli[id], a = arret[id];
      return { cip: id, nom: joli(o.name), ville: 'Angers', cp: o.cp, lat: a ? a.a.lat : o.lat, lng: a ? a.a.lng : o.lng, arret: a ? a.code : '', n: a ? a.a.n : null, ch: chiffres(id),
        d10: distKm(a ? a.a.lat : o.lat, a ? a.a.lng : o.lng, tt.trace) };
    }).sort(function (a, b) { return (a.n || 99) - (b.n || 99); });
    var arrets = (tt.arrets || []).map(function (a) { return { n: a.n, id: a.id, nom: joli(a.nom), ville: joli(a.ville), lat: a.lat, lng: a.lng, ch: chiffres(a.id) }; });
    return { code: code, t10: tt, ess: ess, angers: angers, arrets: arrets,
      cl: ess.filter(function (e) { return e.cliente; }), non: ess.filter(function (e) { return !e.cliente; }),
      angersLivrees: angers.filter(function (a) { return a.arret; }), angersSans: angers.filter(function (a) { return !a.arret; }) };
  };

  // Phrase d'introduction (HTML) selon la bascule. Aucun mot sur les officines hors projet.
  E.sousTitre = function (D, mode) {
    return mode === 'quot'
      ? 'Aujourd’hui : <b>' + D.arrets.length + ' arrêts</b> sur la T10, dont <b>' + D.angersLivrees.length + ' clientes à Angers</b>. En quotidien : les <b>' + D.ess.length + ' officines Essentiels</b> s’ajoutent.'
      : 'La T10 telle qu’elle est : <b>' + D.arrets.length + ' arrêts</b>, <b>' + D.angers.length + ' clientes à Angers</b> (' + D.angersLivrees.length + ' livrées, ' + D.angersSans.length + ' sans livraison sur janvier à octobre). Touchez « En quotidien » pour ajouter les Essentiels.';
  };

  // ── Lignes de la liste ──
  function ligneEss(e) {
    var dist = e.d10 < 0.05 ? 'sur la route' : km(e.d10) + ' de la route';
    var det = e.detour != null && e.detour > 0 ? ' · détour ' + nf(e.detour, 1) + NBSP + 'km' : '';
    var liv = e.cliente ? (e.arret ? 'cliente · livrée par ' + e.arret : 'cliente · sans livraison sur janvier à octobre') : 'pas encore cliente';
    return '<button type="button" class="ess-row" data-cip="' + esc(e.cip) + '"><span><b>' + esc(e.nom) + '</b><span>' + esc(e.ville) + ' · ' + liv + '</span></span><em>' + dist + '<small>' +
      (e.d10 > 5 ? (e.proche < 0.05 ? 'sur la route de ' + esc(e.procheCode) : 'plus proche : ' + esc(e.procheCode) + ' à ' + km(e.proche)) : 'T10' + det) + '</small></em></button>';
  }
  function ligneAngers(a) {
    return '<div class="ess-row" data-ang="1"><span><b>' + (a.n ? a.n + ' · ' : '') + esc(a.nom) + '</b><span>Angers ' + esc(a.cp) + ' · ' + (a.arret ? 'livrée par ' + esc(a.arret) : 'aucune livraison sur janvier à octobre') + '</span></span><em>' +
      (a.ch ? eur(a.ch.ca) + '<small>marge ' + eur(a.ch.marge) + ' · ' + a.ch.cmd + ' commandes</small>' : '—<small>pas de chiffres</small>') + '</em></div>';
  }
  E.ligneEss = ligneEss; E.ligneAngers = ligneAngers;

  if (typeof module !== 'undefined' && module.exports) module.exports = E;

  // ───────────────────────── Affichage (navigateur seulement) ─────────────────────────
  var etat = { mode: 'quot' };   // la bascule survit à un redessin du tableau de bord

  function tactile() { try { return glob.matchMedia('(pointer: coarse)').matches || glob.innerWidth <= 700; } catch (e) { return false; } }

  function css() {
    if (document.getElementById('ess-css')) return;
    var s = document.createElement('style'); s.id = 'ess-css';
    s.textContent = [
      '.ess{position:relative;margin:0 0 14px;border-radius:20px;border:1px solid #DCE5F7;background:#fff;box-shadow:0 1px 2px rgba(26,32,48,.05),0 14px 34px -14px rgba(0,80,230,.22);overflow:hidden;color:' + ENCRE + ';font-variant-numeric:tabular-nums}',
      '.ess:before{content:"";position:absolute;left:-60px;top:-140px;width:560px;height:360px;background:radial-gradient(closest-side,#F0F5FF 0%,#E3ECFB 45%,rgba(243,245,249,0) 100%);pointer-events:none}',
      '.ess>*{position:relative}',
      '.ess-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:20px 22px 6px}',
      '.ess-k{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:' + BLEU + '}',
      '.ess h2{font-size:22px;font-weight:800;letter-spacing:-.025em;margin:2px 0 0}',
      '.ess-sub{font-size:13.5px;color:#4A5570;margin:4px 22px 0;line-height:1.45;max-width:78ch}',
      '.ess-seg{display:inline-flex;gap:4px;padding:4px;background:#EEF2FA;border:1px solid #DCE5F7;border-radius:999px}',
      '.ess-seg button{font:inherit;font-size:14px;font-weight:700;min-height:44px;padding:0 16px;border:0;border-radius:999px;background:transparent;color:' + ENCRE + ';cursor:pointer}',
      '.ess-seg button.on{background:' + BLEU + ';color:#fff;box-shadow:0 4px 12px -4px rgba(0,80,230,.5)}',
      '.ess-sw{width:12px;height:12px;border-radius:50%;display:inline-block;flex:none}',
      '.ess-sw.dm{border-radius:2px;transform:rotate(45deg);width:11px;height:11px}',
      '.ess-row{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;padding:10px 12px;min-height:44px;border:0;border-bottom:1px solid #EAEFF9;background:transparent;font:inherit;color:inherit;cursor:default;box-sizing:border-box}',
      'button.ess-row{cursor:pointer}button.ess-row:hover{background:#F3F7FF}',
      '.ess-row b{font-size:14px;font-weight:700;display:block}.ess-row span{font-size:12.5px;color:#5A6683;display:block;line-height:1.35;min-width:0}',
      '.ess-row em{font-style:normal;font-weight:800;font-size:13px;white-space:nowrap;color:' + ENCRE + ';text-align:right}',
      '.ess-row em small{display:block;font-weight:600;font-size:11.5px;color:#5A6683}',
      '.ess-pt{width:26px;height:26px;border-radius:50%;background:' + GRIS + ';color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(26,32,48,.35);font:800 11px/22px system-ui;text-align:center}',
      '.ess-pt.ang{background:' + BLEU + ';width:34px;height:34px;line-height:30px;font-size:13px;margin:-4px;box-shadow:0 0 0 5px rgba(0,80,230,.20),0 3px 8px rgba(26,32,48,.4)}',
      '.ess-dm{width:20px;height:20px;transform:rotate(45deg);background:' + TURQ + ';border:2px solid #fff;box-shadow:0 2px 6px rgba(26,32,48,.4);border-radius:3px;margin:3px}',
      '.ess-dm.cl{background:#fff;border-color:' + TURQ + '}',
      '.ess1-body{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(300px,1fr);gap:0;margin-top:12px;border-top:1px solid #E3EAF8}',
      '.ess1-map{position:relative;height:560px;background:#EAF0FA;min-width:0}.ess1-side{height:560px;overflow:auto;border-left:1px solid #E3EAF8;background:#fff}',
      '.ess1-side h3{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#5A6683;margin:0;padding:12px 12px 6px;position:sticky;top:0;background:#fff;z-index:2}',
      '.ess1-leg{display:flex;flex-wrap:wrap;gap:8px 18px;padding:12px 22px 14px;font-size:13px;color:#33405C;align-items:center}',
      '.ess1-leg span{display:inline-flex;align-items:center;gap:7px}',
      '.ess1-btns{position:absolute;right:10px;top:10px;z-index:500;display:flex;gap:6px}.ess1-btns button{font:inherit;font-weight:700;font-size:13px;min-height:44px;padding:0 14px;border:1px solid #CBD8F1;border-radius:999px;background:#fff;color:' + ENCRE + ';cursor:pointer;box-shadow:0 4px 12px -4px rgba(26,32,48,.3)}',
      '@media(max-width:900px){.ess1-body{grid-template-columns:minmax(0,1fr)}.ess1-map{height:400px}.ess1-side{height:auto;max-height:420px;border-left:0;border-top:1px solid #E3EAF8}.ess1-leg{padding:12px 14px 14px}}',
      '@media(max-width:700px){.ess-hd{padding:16px 14px 4px}.ess-sub{margin:4px 14px 0}.ess h2{font-size:19px}.ess-seg{width:100%}.ess-seg button{flex:1;padding:0 8px}}',
      '@media(prefers-reduced-motion:reduce){.ess *{transition-duration:.01ms!important;animation-duration:.01ms!important}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function donnees() {
    var w = glob.WML_OFFICINES;
    if (!w) { try { w = WML_OFFICINES; } catch (e) { w = null; } }   // const global : visible sans `window.`
    return E.calculer(glob.TOURNEES_ECRAN, glob.PHARMA_FR, glob.GRP_DEPART, w, 'T10');
  }

  // Point d'entrée : appelé par v2-tournees.js juste après le dessin du détail d'une tournée, quand elle est la T10.
  // d = fichier des tournées de l'écran, leaflet = chargeur de Leaflet de l'écran (pas de second chargement).
  E.monter = function (root, ensureLeaflet) {
    var tiles = root && root.querySelector('.trn-tiles');
    if (!tiles || root.querySelector('#ess-root')) return;
    css();
    var box = document.createElement('div'); box.id = 'ess-root';
    tiles.parentNode.insertBefore(box, tiles);
    var D = donnees();
    if (!D) {
      box.innerHTML = '<section class="ess" aria-label="La T10, Angers et les Essentiels"><div class="ess-hd"><div><div class="ess-k">Calque sur la carte de la T10</div><h2>La T10, les clientes d’Angers et les Essentiels</h2></div></div>' +
        '<p class="ess-sub" id="ess-attente">Chargement des officines en cours…</p></section>';
      var fin = function () {
        if (!document.body.contains(box)) return;
        var d2 = donnees(); if (d2) { dessiner(box, d2, ensureLeaflet); return; }
        var a = document.getElementById('ess-attente'); if (a) a.textContent = 'Les officines ne sont pas disponibles pour le moment. Rien n’est affiché plutôt que des chiffres faux.';
      };
      var clientes = function () {   // la liste des clientes manque encore : on la demande, puis on redessine
        if (!glob.WML_OFFICINES && V2.loadFiles) Promise.resolve(V2.loadFiles(['wml'])).then(fin, fin); else fin();
      };
      if (V2.ensurePharmaFr && !glob.PHARMA_FR) V2.ensurePharmaFr(clientes); else clientes();
      return;
    }
    dessiner(box, D, ensureLeaflet);
  };

  function dessiner(root, D, ensureLeaflet) {
    var mode = etat.mode, carte = null, marqs = {};
    root.innerHTML = '<section class="ess ess1" aria-label="La T10, Angers et les Essentiels">' +
      '<div class="ess-hd"><div><div class="ess-k">Calque sur la carte de la T10</div><h2>La T10, les clientes d’Angers et les Essentiels</h2></div>' +
      '<div class="ess-seg" role="group" aria-label="Aujourd’hui ou en quotidien" id="ess-mode"><button type="button" data-m="auj" aria-pressed="false">Aujourd’hui</button><button type="button" data-m="quot" aria-pressed="false">En quotidien</button></div></div>' +
      '<p class="ess-sub" id="ess-sub1"></p>' +
      '<div class="ess1-body"><div class="ess1-map" id="ess-map"></div><div class="ess1-side" id="ess-side"></div></div>' +
      '<div class="ess1-leg" id="ess-leg"></div></section>';
    function bascule() {
      Array.prototype.forEach.call(document.querySelectorAll('#ess-mode button'), function (x) { var on = x.getAttribute('data-m') === mode; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    function sub() { document.getElementById('ess-sub1').innerHTML = E.sousTitre(D, mode); }
    function legende() {
      document.getElementById('ess-leg').innerHTML =
        '<span><i class="ess-sw" style="background:' + GRIS + '"></i>Arrêt actuel de la T10</span>' +
        '<span><i class="ess-sw" style="background:' + BLEU + ';box-shadow:0 0 0 4px rgba(0,80,230,.2)"></i>Cliente à Angers</span>' +
        (mode === 'quot' ? '<span><i class="ess-sw dm" style="background:' + TURQ + '"></i>Essentiels à récupérer (' + D.non.length + ')</span>' +
          '<span><i class="ess-sw dm" style="background:#fff;border:2px solid ' + TURQ + '"></i>Essentiels déjà clientes (' + D.cl.length + ')</span>' : '');
    }
    function side() {
      var h = '';
      if (mode === 'quot') h += '<h3>Essentiels sur la carte · ' + D.ess.length + ' officines, de la plus proche de la route à la plus loin</h3>' + D.ess.map(ligneEss).join('');
      h += '<h3>Clientes à Angers · ' + D.angers.length + '</h3>' + D.angers.map(ligneAngers).join('');
      document.getElementById('ess-side').innerHTML = h;
    }
    function dessinerCouches() {
      Object.keys(marqs).forEach(function (k) { carte.removeLayer(marqs[k]); });
      marqs = {};
      if (mode !== 'quot') return;
      var L = glob.L;
      D.ess.forEach(function (e) {
        var z = tactile() ? 44 : 30;
        var ic = L.divIcon({ className: '', iconSize: [z, z], iconAnchor: [z / 2, z / 2], html: '<div style="width:' + z + 'px;height:' + z + 'px;display:flex;align-items:center;justify-content:center"><div class="ess-dm' + (e.cliente ? ' cl' : '') + '"></div></div>' });
        marqs[e.cip] = L.marker([e.lat, e.lng], { icon: ic, zIndexOffset: 300, title: e.nom }).addTo(carte).bindTooltip('<b>' + esc(e.nom) + '</b><br>' + esc(e.ville) + '<br>' + (e.cliente ? 'déjà cliente' : 'à récupérer') + ' · ' + km(e.d10) + ' de la T10', { direction: 'top', offset: [0, -8] });
      });
    }
    function cartePose() {
      ensureLeaflet(function (err) {
        var el = document.getElementById('ess-map'); if (err || !glob.L || !el) { if (el) el.innerHTML = '<p class="ess-sub">Carte indisponible.</p>'; return; }
        var L = glob.L, t = D.t10;
        carte = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, zoomSnap: 0.25, dragging: !tactile() });
        try { carte.attributionControl.setPrefix(false); } catch (e) {}
        if (V2.fondCarte) V2.fondCarte(carte);
        var line = L.polyline(t.trace, { color: BLEU, weight: 4, opacity: 1 }).addTo(carte);
        var angIds = {}; D.angers.forEach(function (a) { angIds[a.cip] = 1; });
        D.arrets.forEach(function (a) {
          var ang = !!angIds[a.id], z = tactile() ? 44 : (ang ? 38 : 26), q = (z - (ang ? 34 : 26)) / 2;
          var ic = L.divIcon({ className: '', iconSize: [z, z], iconAnchor: [z / 2, z / 2], html: '<div class="ess-pt' + (ang ? ' ang' : '') + '" style="margin:' + (ang ? q + 4 : q) + 'px">' + a.n + '</div>' });
          L.marker([a.lat, a.lng], { icon: ic, zIndexOffset: ang ? 500 : 200, title: a.nom }).addTo(carte).bindTooltip('<b>' + a.n + ' · ' + esc(a.nom) + '</b><br>' + esc(a.ville) + (a.ch ? '<br>' + eur(a.ch.ca) + ' · ' + a.ch.cmd + ' commandes' : '<br>sans commande'), { direction: 'top', offset: [0, -10] });
        });
        D.angersSans.forEach(function (a) {
          var ic = L.divIcon({ className: '', iconSize: [38, 38], iconAnchor: [19, 19], html: '<div class="ess-pt ang" style="margin:4px;background:#fff;color:' + BLEU + ';border-color:' + BLEU + '">–</div>' });
          L.marker([a.lat, a.lng], { icon: ic, zIndexOffset: 500 }).addTo(carte).bindTooltip('<b>' + esc(a.nom) + '</b><br>cliente, aucune livraison sur janvier à octobre', { direction: 'top' });
        });
        var btns = document.createElement('div'); btns.className = 'ess1-btns'; btns.innerHTML = '<button type="button" data-z="tout">Toute la T10</button><button type="button" data-z="angers">Zoom Angers</button>';
        el.appendChild(btns);
        L.DomEvent.disableClickPropagation(btns);
        var tout = function () { try { carte.invalidateSize(); carte.fitBounds(line.getBounds().pad(0.06), { animate: false }); } catch (e) {} };
        var angers = function () {
          try {
            var pts = D.ess.filter(function (e) { return /Angers/.test(e.ville); }).map(function (e) { return [e.lat, e.lng]; }).concat(D.angers.map(function (a) { return [a.lat, a.lng]; }));
            carte.invalidateSize(); carte.fitBounds(L.latLngBounds(pts).pad(0.35), { animate: false });
          } catch (e) {}
        };
        btns.onclick = function (ev) { var b = ev.target.closest('button'); if (!b) return; if (b.getAttribute('data-z') === 'tout') tout(); else angers(); };
        dessinerCouches(); angers(); setTimeout(angers, 0); setTimeout(angers, 500);
        root.__ess = { carte: carte };
      });
    }
    document.getElementById('ess-mode').onclick = function (ev) {
      var b = ev.target.closest('button'); if (!b || b.getAttribute('data-m') === mode) return;
      mode = etat.mode = b.getAttribute('data-m');
      bascule(); sub(); legende(); side(); if (carte) dessinerCouches();
    };
    document.getElementById('ess-side').onclick = function (ev) {
      var b = ev.target.closest('[data-cip]'); if (!b || !carte) return; var m = marqs[b.getAttribute('data-cip')]; if (!m) return;
      carte.setView(m.getLatLng(), Math.max(carte.getZoom(), 13), { animate: false }); m.openTooltip(); document.getElementById('ess-map').scrollIntoView({ block: 'nearest' });
    };
    bascule(); sub(); legende(); side(); cartePose();
  }

  V2.tourneesEssentiels = E;
})(typeof window !== 'undefined' ? window : globalThis);
