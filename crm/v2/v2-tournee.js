/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Composer une tournée (pages.tournee)
   « Où vas-tu ? » → on géocode ton départ (chez toi) + ta destination
   (API BAN gratuite), on choisit les prospects à visiter autour
   (V2.tourneeSelect), on ORDONNE la route (plus proche voisin via
   V2.osrmMatrix), on trace le trajet réel (V2.osrmRoute), et on affiche
   la carte + la liste des arrêts dans l'ordre avec heures d'arrivée.
   Boutons Google Maps / Waze + « ✅ vu » (V2.visite.mark).
   Module isolé : réutilise vendor/leaflet + pharma-fr-data.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };
  var fmtEur = function (n) { return V2.fmtEur ? V2.fmtEur(n) : (n + ' €'); };
  var CB = '?v=20260716c';        // aligné index.html

  var HOME_LS = 'jarvis_home_v1'; // adresse « chez toi » mémorisée
  var START_H = 9;                // heure de départ (9h00)
  var SERVICE = 900;              // 15 min par visite (secondes)
  var AMBER = '#F59E0B', BLUE = '#0057FF', HOME_COL = '#0B6E43';

  var D = null, map = null, routeLayer = null, mkLayer = null, markers = {};
  // état de la tournée composée
  var ST = { home: null, dest: null, stops: [], route: null, radiusKm: 25, maxStops: 8, busy: false };

  // ── loaders (repris de v2-carte-groupements.js) ──
  function cssLink(h) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; document.head.appendChild(l); }
  function jsl(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = function () { cb('err'); }; document.head.appendChild(s); }
  function ensureLeaflet(cb) {
    var V = 'vendor/leaflet/';
    if (window.L) { cb(); return; }
    cssLink(V + 'leaflet.css' + CB); jsl(V + 'leaflet.js' + CB, function () {});
    var t0 = Date.now(), iv = setInterval(function () {
      if (window.L) { clearInterval(iv); cb(); }
      else if (Date.now() - t0 > 15000) { clearInterval(iv); cb('err'); }
    }, 100);
  }
  function ensureData(cb) {
    if (window.PHARMA_FR) { cb(); return; }
    var done = false, fin = function (e) { if (!done) { done = true; cb(e); } };
    var s = document.createElement('script'); s.src = 'pharma-fr-data.js' + CB;
    s.onload = function () { fin(window.PHARMA_FR ? null : 'err'); };
    s.onerror = function () { fin('err'); };
    document.head.appendChild(s);
    var t0 = Date.now(), iv = setInterval(function () {
      if (window.PHARMA_FR) { clearInterval(iv); fin(null); }
      else if (Date.now() - t0 > 25000) { clearInterval(iv); fin('err'); }
    }, 150);
  }

  // ── helpers données ──
  function llOK(p) { return p && typeof p[0] === 'number' && typeof p[1] === 'number' && (p[0] || p[1]); }
  function pharmacyId(idx) { var p = D.p[idx]; return (p[13] != null && p[13] !== '') ? p[13] : idx; }
  function commOf(p) { return p[5] ? (D.comm[p[5]] || '') : ''; }

  // ── géocodage BAN (fetch + timeout AbortController 6s) ──
  function geocode(q, cb) {
    q = String(q == null ? '' : q).trim();
    if (!q) { cb('empty'); return; }
    var url = 'https://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(q) + '&limit=1';
    var done = false, ctrl = null, timer = null;
    try { ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null; } catch (e) { ctrl = null; }
    function fin(err, ll) { if (done) return; done = true; if (timer) clearTimeout(timer); cb(err, ll); }
    timer = setTimeout(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} fin('timeout'); }, 6000);
    try {
      fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
        if (!r || !r.ok) throw new Error('http'); return r.json();
      }).then(function (j) {
        var f = j && j.features && j.features[0];
        if (!f || !f.geometry || !f.geometry.coordinates) { fin('nores'); return; }
        var c = f.geometry.coordinates;                 // [lng, lat]
        fin(null, { lat: c[1], lng: c[0], label: (f.properties && f.properties.label) || q });
      })['catch'](function () { fin('err'); });
    } catch (e) { fin('err'); }
  }

  // ── TSP glouton : plus proche voisin depuis le départ, via matrice ──
  // pts matrice = [home, ...prospects] ; renvoie les indices PHARMA_FR ordonnés.
  function orderStops(home, prospectIdxs, cb) {
    if (!prospectIdxs.length) { cb([], 'fallback'); return; }
    var pts = [[home.lat, home.lng]], i;
    for (i = 0; i < prospectIdxs.length; i++) { var p = D.p[prospectIdxs[i]]; pts.push([p[0], p[1]]); }
    V2.osrmMatrix(pts, function (mx) {
      var dur = (mx && mx.durations) || [];
      var n = prospectIdxs.length, visited = {}, order = [], cur = 0, s, j;
      for (s = 0; s < n; s++) {
        var best = -1, bd = Infinity;
        for (j = 1; j <= n; j++) {
          if (visited[j]) continue;
          var d = (dur[cur] && dur[cur][j] != null) ? dur[cur][j] : Infinity;
          if (d < bd) { bd = d; best = j; }
        }
        if (best < 0) break;
        visited[best] = 1; order.push(prospectIdxs[best - 1]); cur = best;
      }
      // sécurité : ajoute d'éventuels restants (si matrice trouée)
      for (j = 1; j <= n; j++) if (!visited[j]) order.push(prospectIdxs[j - 1]);
      cb(order, (mx && mx.source) || 'fallback');
    });
  }

  // ── format temps ──
  function two(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtClock(sec) { var t = Math.round(START_H * 3600 + sec); var h = Math.floor(t / 3600) % 24; var m = Math.floor((t % 3600) / 60); return h + 'h' + two(m); }
  function fmtDur(sec) { var m = Math.round((sec || 0) / 60); var h = Math.floor(m / 60); m = m % 60; return h ? (h + ' h ' + two(m)) : (m + ' min'); }
  function fmtKm(m) { return (Math.round((m || 0) / 100) / 10).toLocaleString('fr-FR') + ' km'; }

  // ── styles (scopés .tp-) ──
  function injectCss() {
    if (document.getElementById('v2-tp-css')) return;
    var st = document.createElement('style'); st.id = 'v2-tp-css';
    st.textContent =
      '.tp-form{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;padding:14px 22px;background:var(--card);border-bottom:1px solid var(--line)}' +
      '.tp-fld{display:flex;flex-direction:column;gap:5px}' +
      '.tp-fld.g{flex:1;min-width:220px}' +
      '.tp-lab{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}' +
      '.tp-in{font-family:var(--font);font-size:14.5px;font-weight:600;color:var(--ip-ink);background:var(--card-2);border:1px solid var(--line);border-radius:11px;padding:11px 13px;outline:none;min-height:44px;box-sizing:border-box}' +
      '.tp-in:focus{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}' +
      '.tp-in.n{width:96px}' +
      '.tp-go{font-family:var(--font);font-size:14.5px;font-weight:800;color:#fff;background:var(--ip-blue);border:none;border-radius:11px;padding:12px 20px;min-height:44px;cursor:pointer;white-space:nowrap;transition:filter .12s}' +
      '.tp-go:hover{filter:brightness(1.06)}.tp-go[disabled]{opacity:.6;cursor:default}' +
      '.tp-msg{padding:10px 22px;font-size:13.5px;font-weight:700}' +
      '.tp-msg.err{color:#B42318;background:rgba(217,45,32,.08)}' +
      '.tp-msg.ok{color:var(--muted)}' +
      '.tp-fb{padding:7px 22px;font-size:12px;font-weight:700;color:#B45309;background:rgba(245,158,11,.12)}' +
      '.tp-split{display:flex;height:calc(100vh - 232px);min-height:420px}' +
      '.tp-map{flex:1;min-width:0;background:#EAEEF3}' +
      '.tp-side{width:380px;max-width:44vw;overflow-y:auto;background:var(--paper);border-left:1px solid var(--line)}' +
      '.tp-tot{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:13px 16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--paper);z-index:2}' +
      '.tp-chip{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:800;color:var(--ip-ink);background:var(--card-2);border:1px solid var(--line);border-radius:999px;padding:5px 11px}' +
      '.tp-nav{display:flex;gap:8px;padding:0 16px 12px}' +
      '.tp-nav a{flex:1;text-align:center;font-size:13px;font-weight:800;text-decoration:none;color:var(--ip-ink);background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:11px 8px;min-height:44px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
      '.tp-nav a:hover{border-color:var(--ip-blue)}' +
      '.tp-stop{display:flex;gap:11px;align-items:flex-start;padding:12px 16px;border-bottom:1px solid var(--line)}' +
      '.tp-num{width:26px;height:26px;border-radius:50%;background:' + AMBER + ';color:#3a2a00;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}' +
      '.tp-nm{font-size:14px;font-weight:800;color:var(--ip-ink);line-height:1.25;cursor:pointer}' +
      '.tp-meta{font-size:11.5px;color:var(--muted);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}' +
      '.tp-eta{font-weight:800;color:var(--ip-blue)}' +
      '.tp-tel{color:var(--ip-blue);font-weight:700;text-decoration:none}' +
      '.tp-vu{margin-top:8px;font-family:var(--font);font-size:12.5px;font-weight:800;color:#0B6E43;background:rgba(11,110,67,.1);border:1px solid rgba(11,110,67,.3);border-radius:9px;padding:8px 12px;min-height:38px;cursor:pointer}' +
      '.tp-vu:hover{background:rgba(11,110,67,.16)}.tp-vu.done{color:#fff;background:#0B6E43;border-color:#0B6E43;cursor:default}' +
      '.tp-empty{padding:40px 20px;text-align:center;color:var(--muted);font-size:14px;line-height:1.5}' +
      '.tp-load{display:flex;align-items:center;justify-content:center;gap:10px;height:100%;color:var(--muted);font-size:14px}' +
      '.tp-mk{width:26px;height:26px;border-radius:50%;background:' + AMBER + ';color:#3a2a00;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)}' +
      '.tp-mk.home{background:' + HOME_COL + ';color:#fff;font-size:14px}' +
      '.tp-pop b{display:block;font-size:13px;color:#10131C}.tp-pop .a{font-size:11.5px;color:#5b6270;margin:2px 0}' +
      '@media(max-width:820px){.tp-split{flex-direction:column;height:auto}.tp-map{height:48vh;min-height:300px}.tp-side{width:auto;max-width:none;border-left:none;border-top:1px solid var(--line)}.tp-fld.g{min-width:0;flex-basis:100%}}';
    document.head.appendChild(st);
  }

  // ── marqueurs ──
  function icon(label, home) {
    return window.L.divIcon({ className: '', html: '<div class="tp-mk' + (home ? ' home' : '') + '">' + label + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
  }

  function drawRoute() {
    if (!map) return;
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (mkLayer) { mkLayer.clearLayers(); } else { mkLayer = window.L.layerGroup().addTo(map); }
    markers = {};
    if (!ST.home || !ST.stops.length) return;
    var bounds = [], geo = (ST.route && ST.route.geometry) || [];
    if (geo.length > 1) {
      routeLayer = window.L.polyline(geo, { color: BLUE, weight: 4, opacity: 0.85 }).addTo(map);
      for (var g = 0; g < geo.length; g++) bounds.push(geo[g]);
    }
    // départ (maison)
    var hm = window.L.marker([ST.home.lat, ST.home.lng], { icon: icon('🏠', true) }).addTo(mkLayer);
    hm.bindPopup('<div class="tp-pop"><b>Départ · chez toi</b><div class="a">' + esc(ST.home.label || '') + '</div></div>');
    bounds.push([ST.home.lat, ST.home.lng]);
    // arrêts numérotés
    for (var i = 0; i < ST.stops.length; i++) {
      var s = ST.stops[i], p = s.p;
      var m = window.L.marker([p[0], p[1]], { icon: icon(String(i + 1), false) }).addTo(mkLayer);
      m.bindPopup('<div class="tp-pop"><b>' + (i + 1) + '. ' + esc(p[6] || 'Pharmacie') + '</b>' +
        (p[7] ? '<div class="a">' + esc(p[7]) + (p[8] ? ' · ' + esc(p[8]) : '') + '</div>' : '') +
        '<div class="a">Arrivée ~' + fmtClock(s.arrival) + '</div></div>');
      markers[s.idx] = m;
      bounds.push([p[0], p[1]]);
    }
    if (bounds.length) { try { map.fitBounds(bounds, { padding: [45, 45], maxZoom: 14 }); } catch (e) {} }
    setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 60);
  }

  // ── liste latérale ──
  function sideHtml() {
    if (!ST.stops.length) {
      return '<div class="tp-empty">Renseigne ton départ et ta destination, puis clique sur <b>Composer la tournée</b>.<br>On sélectionne les prospects à visiter autour et on trace le trajet.</div>';
    }
    var totM = (ST.route && ST.route.totalM) || 0;
    var totSec = ((ST.route && ST.route.totalSec) || 0) + SERVICE * ST.stops.length;
    var h = '<div class="tp-tot">' +
      '<span class="tp-chip">' + ST.stops.length + ' arrêt' + (ST.stops.length > 1 ? 's' : '') + '</span>' +
      '<span class="tp-chip">' + fmtKm(totM) + '</span>' +
      '<span class="tp-chip">≈ ' + fmtDur(totSec) + '</span>' +
      '<span class="tp-chip">retour ~' + fmtClock((ST.route && ST.route.totalSec || 0) + SERVICE * ST.stops.length) + '</span>' +
      '</div>' +
      '<div class="tp-nav">' +
        '<a onclick="V2.tpGmaps()">Google Maps ↗</a>' +
        '<a onclick="V2.tpWaze()">Waze ↗</a>' +
      '</div>';
    for (var i = 0; i < ST.stops.length; i++) {
      var s = ST.stops[i], p = s.p;
      var tel = (p[9] || '').replace(/[^0-9+]/g, '');
      var visited = V2.visite && V2.visite.last ? V2.visite.last(s.id) : null;
      h += '<div class="tp-stop">' +
        '<span class="tp-num">' + (i + 1) + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="tp-nm" onclick="V2.tpFocus(' + s.idx + ')">' + esc(p[6] || 'Pharmacie') + '</div>' +
          '<div class="tp-meta"><span class="tp-eta">🕘 ' + fmtClock(s.arrival) + '</span>' +
            (p[7] ? '<span>· ' + esc(p[7]) + (p[8] ? ' ' + esc(p[8]) : '') + '</span>' : '') +
            (commOf(p) ? '<span>· ' + esc(commOf(p)) + '</span>' : '') +
          '</div>' +
          (tel ? '<div class="tp-meta"><a class="tp-tel" href="tel:' + esc(tel) + '">' + esc(p[9]) + '</a></div>' : '') +
          '<button class="tp-vu' + (visited ? ' done' : '') + '" id="tp-vu-' + s.idx + '" ' +
            (visited ? 'disabled' : 'onclick="V2.tpMark(' + s.idx + ')"') + '>' +
            (visited ? '✅ vu le ' + esc(String(visited).slice(8, 10) + '/' + String(visited).slice(5, 7)) : '✅ marquer vu') +
          '</button>' +
        '</div>' +
      '</div>';
    }
    return h;
  }

  function renderSide() { var el = document.getElementById('tp-side'); if (el) el.innerHTML = sideHtml(); }
  function setMsg(cls, txt) {
    var el = document.getElementById('tp-msg');
    if (el) el.innerHTML = txt ? '<div class="tp-msg ' + cls + '">' + esc(txt) + '</div>' : '';
  }
  function setFallback(on) {
    var el = document.getElementById('tp-fb');
    if (el) el.innerHTML = on ? '<div class="tp-fb">Temps estimés — routage temps réel indisponible.</div>' : '';
  }

  // ── API globale (handlers onclick) ──
  V2.tpFocus = function (idx) {
    var m = markers[idx]; if (!m || !map) return;
    var ll = m.getLatLng();
    map.setView([ll.lat, ll.lng], Math.max(map.getZoom(), 14), { animate: true });
    m.openPopup();
  };
  V2.tpMark = function (idx) {
    var id = pharmacyId(idx);
    var btn = document.getElementById('tp-vu-' + idx);
    if (V2.visite && V2.visite.mark) {
      V2.visite.mark(id, function () {
        if (btn) { btn.className = 'tp-vu done'; btn.disabled = true; btn.textContent = '✅ vu aujourd\'hui'; }
      });
    } else if (btn) { btn.className = 'tp-vu done'; btn.disabled = true; btn.textContent = '✅ vu'; }
  };
  V2.tpGmaps = function () {
    if (!ST.home || !ST.stops.length) return;
    var o = ST.home.lat + ',' + ST.home.lng;
    var wp = [];
    for (var i = 0; i < ST.stops.length; i++) wp.push(ST.stops[i].p[0] + ',' + ST.stops[i].p[1]);
    var url = 'https://www.google.com/maps/dir/?api=1&origin=' + o + '&destination=' + o +
      '&waypoints=' + encodeURIComponent(wp.join('|')) + '&travelmode=driving';
    try { window.open(url, '_blank', 'noopener'); } catch (e) { location.href = url; }
  };
  V2.tpWaze = function () {
    if (!ST.stops.length) return;
    var p = ST.stops[0].p;
    var url = 'https://waze.com/ul?ll=' + p[0] + ',' + p[1] + '&navigate=yes';
    try { window.open(url, '_blank', 'noopener'); } catch (e) { location.href = url; }
  };

  // ── composition de la tournée ──
  V2.tpCompose = function () {
    if (ST.busy) return;
    if (!D) { setMsg('err', 'Données des pharmacies indisponibles.'); return; }
    var homeIn = document.getElementById('tp-home');
    var destIn = document.getElementById('tp-dest');
    var radIn = document.getElementById('tp-rad');
    var stopIn = document.getElementById('tp-stops');
    var homeQ = homeIn ? homeIn.value : '';
    var destQ = destIn ? destIn.value : '';
    ST.radiusKm = Math.max(1, parseInt(radIn && radIn.value, 10) || 25);
    ST.maxStops = Math.max(1, parseInt(stopIn && stopIn.value, 10) || 8);
    try { localStorage.setItem(HOME_LS, homeQ || ''); } catch (e) {}
    if (!homeQ.trim()) { setMsg('err', 'Indique ton point de départ (chez toi).'); return; }
    if (!destQ.trim()) { setMsg('err', 'Indique où tu vas (ville ou adresse).'); return; }

    ST.busy = true;
    var btn = document.getElementById('tp-go'); if (btn) { btn.disabled = true; btn.textContent = 'Calcul…'; }
    setMsg('ok', 'Géolocalisation en cours…'); setFallback(false);
    function fail(txt) {
      ST.busy = false; if (btn) { btn.disabled = false; btn.textContent = 'Composer la tournée'; }
      setMsg('err', txt);
    }

    geocode(homeQ, function (e1, home) {
      if (e1 || !home) { fail('Adresse de départ introuvable. Précise ville + code postal.'); return; }
      geocode(destQ, function (e2, dest) {
        if (e2 || !dest) { fail('Destination introuvable. Précise ville + code postal.'); return; }
        ST.home = home; ST.dest = dest;
        setMsg('ok', 'Sélection des prospects autour de ' + (dest.label || destQ) + '…');
        var idxs = V2.tourneeSelect({
          destLat: dest.lat, destLng: dest.lng,
          radiusKm: ST.radiusKm, maxStops: ST.maxStops,
          homeLat: home.lat, homeLng: home.lng
        }) || [];
        idxs = idxs.filter(function (i) { return llOK(D.p[i]); });
        if (!idxs.length) {
          ST.stops = []; ST.route = null; renderSide(); drawRoute();
          fail('Aucun prospect trouvé dans un rayon de ' + ST.radiusKm + ' km. Élargis le rayon ou change de zone.');
          return;
        }
        setMsg('ok', 'Optimisation de l\'itinéraire…');
        orderStops(home, idxs, function (order) {
          var pts = [[home.lat, home.lng]], k;
          for (k = 0; k < order.length; k++) { var p = D.p[order[k]]; pts.push([p[0], p[1]]); }
          pts.push([home.lat, home.lng]);   // retour à la maison
          V2.osrmRoute(pts, function (route) {
            ST.route = route;
            var legs = (route && route.legsSec) || [];
            ST.stops = [];
            var acc = 0;
            for (k = 0; k < order.length; k++) {
              acc += (legs[k] != null ? legs[k] : 0);          // trajet vers l'arrêt k+1
              ST.stops.push({
                idx: order[k], id: pharmacyId(order[k]), p: D.p[order[k]],
                arrival: acc + SERVICE * k                      // + visites précédentes (15 min)
              });
            }
            ST.busy = false;
            if (btn) { btn.disabled = false; btn.textContent = 'Composer la tournée'; }
            setMsg('', '');
            setFallback(route && route.source === 'fallback');
            renderSide(); drawRoute();
          });
        });
      });
    });
  };

  // ── page ──
  V2.pages.tournee = {
    render: function (root) {
      injectCss();
      if (V2.visite && V2.visite.load) { try { V2.visite.load(function () {}); } catch (e) {} }
      var homeSaved = '';
      try { homeSaved = localStorage.getItem(HOME_LS) || ''; } catch (e) {}
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      root.innerHTML = top +
        '<div class="tp-form">' +
          '<div class="tp-fld g"><span class="tp-lab">Départ (chez toi)</span>' +
            '<input class="tp-in" id="tp-home" type="text" placeholder="Ex. 12 rue des Lilas, Quimper" value="' + esc(homeSaved) + '"></div>' +
          '<div class="tp-fld g"><span class="tp-lab">Où vas-tu ?</span>' +
            '<input class="tp-in" id="tp-dest" type="text" placeholder="Ville ou adresse de destination"></div>' +
          '<div class="tp-fld"><span class="tp-lab">Rayon (km)</span>' +
            '<input class="tp-in n" id="tp-rad" type="number" min="1" max="200" value="25"></div>' +
          '<div class="tp-fld"><span class="tp-lab">Arrêts</span>' +
            '<input class="tp-in n" id="tp-stops" type="number" min="1" max="30" value="8"></div>' +
          '<button class="tp-go" id="tp-go" onclick="V2.tpCompose()">Composer la tournée</button>' +
        '</div>' +
        '<div id="tp-msg"></div>' +
        '<div id="tp-fb"></div>' +
        '<div class="tp-split">' +
          '<div class="tp-map" id="tp-map"><div class="tp-load"><div class="v2-spinner"></div>Chargement de la carte…</div></div>' +
          '<div class="tp-side" id="tp-side">' + sideHtml() + '</div>' +
        '</div>';

      // Entrée = composer
      var onEnter = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); V2.tpCompose(); } };
      var hi = document.getElementById('tp-home'), di = document.getElementById('tp-dest');
      if (hi) hi.addEventListener('keydown', onEnter);
      if (di) di.addEventListener('keydown', onEnter);

      ensureData(function (e1) {
        if (e1) { var mp0 = document.getElementById('tp-map'); if (mp0) mp0.innerHTML = '<div class="tp-empty">Données des pharmacies indisponibles. Réessaie.</div>'; return; }
        D = window.PHARMA_FR;
        ensureLeaflet(function (e2) {
          var mp = document.getElementById('tp-map');
          if (e2) { if (mp) mp.innerHTML = '<div class="tp-empty">Carte indisponible pour le moment.</div>'; return; }
          if (mp) mp.innerHTML = '';
          map = window.L.map('tp-map', { zoomControl: true, attributionControl: false }).setView([46.6, 2.4], 6);
          window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
          setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 80);
        });
      });
    }
  };
})();
