/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Carte nationale des pharmacies (Copilote)
   ~19 500 officines actives (hors Corse) : nos clients par commercial,
   prospects, UGA, groupements. Leaflet + clustering. Popup complet
   (titulaire, tél, email, groupement, UGA, commercial) + Google Maps.
   Données : pharma-fr-data.js (lazy). Point = [lat,lng,uga,grp,seg,comm,
   nom,ville,cp,tel,titulaire,email].
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var CB = '?v=20260707u';
  var map = null, cluster = null, markers = null, D = null, canvas = null;
  var tourLayer = null;          // tracé de la tournée (polyline + n° d'arrêts)
  var depotLayer = null;         // marqueurs des établissements Intégral
  var depot = null;              // { n, lat, lng } point de départ/retour (optionnel)
  var pickDepotMode = false;     // clic carte suivant = définir le dépôt
  var SPEED = 45, SERVICE = 8;   // km/h moyens · minutes par arrêt (rendement)
  // Établissements Intégral (source : site vitrine map-component) — points de départ/retour
  var DEPOTS = [
    { s: 'OPS', n: 'Ouest Pharma Services', city: 'St-Étienne-de-Montluc', lat: 47.2789, lng: -1.7806 },
    { s: 'CPR', n: 'Comptoir Pharmaceutique du Rhône', city: "Saint-Maurice-l'Exil", lat: 45.3936, lng: 4.7806 },
    { s: 'SOP', n: 'Sud Ouest Pharma', city: 'Montayral', lat: 44.4783, lng: 0.9389 },
    { s: 'POS', n: "Pharm'Occitanie Services", city: 'Villeneuve-lès-Béziers', lat: 43.3206, lng: 3.2542 },
    { s: 'HP', n: 'Hyères Pharma', city: 'Hyères', lat: 43.1206, lng: 6.1286 },
    { s: 'SEP', n: 'Sud Est Pharma', city: 'Le Cannet-des-Maures', lat: 43.3925, lng: 6.3406 },
    { s: 'MSP', n: 'Mistral Santé Pharma', city: 'Flassans-sur-Issole', lat: 43.3614, lng: 6.1828 },
    { s: 'ESC', n: 'Escale Pharma', city: 'Chilly-Mazarin', lat: 48.7028, lng: 2.3119 },
    { s: 'PME', n: 'Pharmest', city: 'Metz', lat: 49.1193, lng: 6.1757 }
  ];
  var colorMode = 'comm';        // comm | type | uga | grp
  var commFocus = '', grpFocus = '', typeFocus = 'all';   // all | clients | prospects
  var COMM_COL = {}, GRP_COL = {};
  var PALETTE = ['#0050E6', '#EA580C', '#0F7A52', '#7C3AED', '#C7283D', '#00B5D8', '#C7791A',
    '#DB2777', '#2563EB', '#16A34A', '#9333EA', '#DC2626', '#0891B2', '#CA8A04'];
  // segmentation (client/prospect) : dégradé vert pour les clients, bleu prospect
  var SEG_COL = { 'Client A': '#0B6E43', 'Client B': '#16A34A', 'Client C': '#5CC98A', 'Prospect': '#3B82F6', 'Non défini': '#AEB6C4' };

  function css(href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
  function js(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = function () { cb('err'); }; document.head.appendChild(s); }
  function ensureLeaflet(cb) {
    var V = 'vendor/leaflet/';
    // clustering OPTIONNEL : on tente le plugin mais on n'échoue jamais dessus
    function afterL() { if (window.L.markerClusterGroup) { cb(); return; } js(V + 'leaflet.markercluster.js' + CB, function () { cb(); }); }
    if (window.L) { afterL(); return; }
    css(V + 'leaflet.css' + CB); css(V + 'MarkerCluster.css' + CB); css(V + 'MarkerCluster.Default.css' + CB);
    js(V + 'leaflet.js' + CB, function () {});
    var t0 = Date.now(), iv = setInterval(function () {
      if (window.L) { clearInterval(iv); afterL(); }
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

  var PROSPECT_COL = '#F59E0B';   // ambre bien visible pour repérer les prospects
  function hsl(str) { var h = 0, i; str = String(str || ''); for (i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return 'hsl(' + h + ',62%,48%)'; }
  function isClient(p) { return (D.seg[p[4]] || '').indexOf('Client') === 0; }
  function isProspect(p) { return D.seg[p[4]] === 'Prospect'; }
  function colorFor(p) {
    if (colorMode === 'comm') {
      if (p[5]) return COMM_COL[p[5]] || '#94A3B8';        // dans un portefeuille commercial
      if (isProspect(p)) return PROSPECT_COL;              // prospect libre → ambre visible
      return '#D4DAE3';
    }
    if (colorMode === 'type') return SEG_COL[D.seg[p[4]]] || '#AEB6C4';
    if (colorMode === 'grp') return GRP_COL[p[3]] || '#CBD2DD';
    return hsl(D.uga[p[2]] || '');
  }

  function computeColors() {
    COMM_COL = {};
    for (var k = 1; k < D.comm.length; k++) COMM_COL[k] = PALETTE[(k - 1) % PALETTE.length];
    var cnt = {};
    D.p.forEach(function (p) { cnt[p[3]] = (cnt[p[3]] || 0) + 1; });
    var top = Object.keys(cnt).filter(function (g) { return D.grp[g] && D.grp[g] !== '—'; })
      .sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, PALETTE.length);
    GRP_COL = {}; top.forEach(function (g, i) { GRP_COL[g] = PALETTE[i]; });
  }

  function popupHtml(p, i) {
    var q = encodeURIComponent((p[6] || '') + ' ' + (p[7] || '') + ' ' + (p[8] || ''));
    var gmaps = 'https://www.google.com/maps/search/?api=1&query=' + q;
    var dir = 'https://www.google.com/maps/dir/?api=1&destination=' + q;
    var tel = (p[9] || '').replace(/[^0-9+]/g, '');
    var mail = p[11] || '', comm = p[5] ? D.comm[p[5]] : '';
    var inT = i != null && inTour(i);
    return '<div class="cn-pop">' +
      '<b class="cn-pop-n">' + esc(p[6] || 'Pharmacie') + '</b>' +
      (p[10] ? '<div class="cn-pop-tit">' + esc(p[10]) + '</div>' : '') +
      '<div class="cn-pop-a">' + esc(p[7]) + (p[8] ? ' · ' + esc(p[8]) : '') + '</div>' +
      '<div class="cn-pop-tags">' +
        '<span class="cn-tag ' + (isClient(p) ? 'cl' : (D.seg[p[4]] === 'Prospect' ? 'pr' : '')) + '">' + esc(D.seg[p[4]]) + '</span>' +
        (comm ? '<span class="cn-tag co">' + esc(comm) + '</span>' : '') +
        '<span class="cn-tag">UGA ' + esc(D.uga[p[2]] || '—') + '</span>' +
        (D.grp[p[3]] && D.grp[p[3]] !== '—' ? '<span class="cn-tag">' + esc(D.grp[p[3]]) + '</span>' : '') +
      '</div>' +
      (tel || mail ? '<div class="cn-pop-contact">' +
        (tel ? '<a href="tel:' + esc(tel) + '">' + esc(p[9]) + '</a>' : '') +
        (mail ? '<a href="mailto:' + esc(mail) + '">' + esc(mail) + '</a>' : '') + '</div>' : '') +
      (i != null ? '<button class="cn-tour-btn' + (inT ? ' in' : '') + '" id="cn-tour-' + i + '" onclick="V2.carteTour(' + i + ')">' + (inT ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée') + '</button>' : '') +
      '<div class="cn-pop-btns">' +
        '<a class="cn-pop-btn on" href="' + gmaps + '" target="_blank" rel="noopener">Fiche Google Maps</a>' +
        '<a class="cn-pop-btn" href="' + dir + '" target="_blank" rel="noopener">Itinéraire</a>' +
      '</div></div>';
  }

  function pass(p) {
    if (typeFocus === 'clients' && !isClient(p)) return false;
    if (typeFocus === 'prospects' && D.seg[p[4]] !== 'Prospect') return false;
    if (commFocus && D.comm[p[5]] !== commFocus) return false;
    if (grpFocus && D.grp[p[3]] !== grpFocus) return false;
    return true;
  }

  function markerStyle(p, i) {
    var t = inTour(i);
    return { renderer: canvas, radius: t ? 7 : 5.5, color: t ? '#10131C' : '#fff', weight: t ? 2 : 0.9, fillColor: colorFor(p), fillOpacity: 0.95 };
  }
  function rebuild() {
    if (!map) return;
    if (cluster) { map.removeLayer(cluster); cluster = null; }
    var useCluster = !!window.L.markerClusterGroup;
    function openPop(e) { var p = D.p[e.layer._pi]; if (p) e.layer.bindPopup(popupHtml(p, e.layer._pi), { minWidth: 216 }).openPopup(); }
    if (useCluster) {
      cluster = window.L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 48, disableClusteringAtZoom: 9, removeOutsideVisibleBounds: true });
      cluster.on('click', openPop);
    } else {
      cluster = window.L.layerGroup();   // repli sans clustering (clic direct par marqueur)
    }
    markers = [];
    var pts = D.p, arr = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i]; if (!pass(p)) continue;
      var m = window.L.circleMarker([p[0], p[1]], markerStyle(p, i));
      m._pi = i; if (!useCluster) m.on('click', openPop); markers.push(m); arr.push(m);
    }
    if (useCluster) cluster.addLayers(arr); else for (var a = 0; a < arr.length; a++) cluster.addLayer(arr[a]);
    map.addLayer(cluster);
    var cn = document.getElementById('carte-count'); if (cn) cn.textContent = markers.length.toLocaleString('fr') + ' pharmacies';
  }
  function recolor() { if (markers) for (var k = 0; k < markers.length; k++) markers[k].setStyle({ fillColor: colorFor(D.p[markers[k]._pi]) }); }
  function refreshMarkerStyle(i) { if (!markers) return; for (var k = 0; k < markers.length; k++) if (markers[k]._pi === i) { markers[k].setStyle(markerStyle(D.p[i], i)); break; } }

  // ── PLAN DE TOURNÉE (sélection de pharmacies → journée de prospection) ──
  var TOUR_KEY = 'jarvis_tour_v1', tour = [];
  function keyOf(p) { return (p[6] || '') + '|' + (p[8] || ''); }
  function loadTour() { try { var t = JSON.parse(localStorage.getItem(TOUR_KEY) || '[]'); tour = t && t.length ? t : []; } catch (e) { tour = []; } }
  function saveTour() { try { localStorage.setItem(TOUR_KEY, JSON.stringify(tour)); } catch (e) {} }
  function tourPos(k) { for (var j = 0; j < tour.length; j++) if (tour[j].k === k) return j; return -1; }
  function inTour(i) { return D && D.p[i] ? tourPos(keyOf(D.p[i])) >= 0 : false; }
  function updateTourBar() {
    var b = document.getElementById('cn-tourbar'); if (!b) return;
    b.classList.toggle('on', tour.length > 0);
    var n = document.getElementById('cn-tourbar-n'); if (n) n.textContent = tour.length + ' pharmacie' + (tour.length > 1 ? 's' : '') + ' dans ta tournée';
  }
  function haversine(a, b) {
    var R = 6371, r = Math.PI / 180;
    var s = Math.sin((b.lat - a.lat) * r / 2) * Math.sin((b.lat - a.lat) * r / 2) +
      Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) * Math.sin((b.lng - a.lng) * r / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  // Suite ordonnée des points = dépôt (si défini) + arrêts (+ retour au dépôt)
  function routeStops() { var a = []; if (depot) a.push(depot); for (var j = 0; j < tour.length; j++) a.push(tour[j]); if (depot && tour.length) a.push(depot); return a; }
  function routeKm() { var pts = routeStops(), d = 0; for (var j = 1; j < pts.length; j++) d += haversine(pts[j - 1], pts[j]); return d; }
  function tourDistance() { return routeKm(); }
  function estMinutes() { var km = routeKm(); return Math.round(km / SPEED * 60 + tour.length * SERVICE); }
  function fmtDur(min) { var h = Math.floor(min / 60), m = min % 60; return h ? (h + ' h ' + (m < 10 ? '0' : '') + m) : (m + ' min'); }

  V2.carteTour = function (i) {
    var p = D.p[i], k = keyOf(p), pos = tourPos(k);
    if (pos >= 0) tour.splice(pos, 1);
    else tour.push({ k: k, n: p[6], v: p[7], c: p[8], t: p[9], lat: p[0], lng: p[1] });
    saveTour(); updateTourBar(); refreshMarkerStyle(i); drawTourLine();
    var b = document.getElementById('cn-tour-' + i);
    if (b) { var inT = tourPos(k) >= 0; b.classList.toggle('in', inT); b.textContent = inT ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée'; }
    if (document.getElementById('cn-tourpanel')) renderTourPanel();
  };
  // Optimisation : plus proche voisin (depuis le dépôt si défini) puis amélioration 2-opt
  function nearestOrder(pts, startRef) {
    var rest = pts.slice(), out = [], cur = startRef || rest.shift();
    if (!startRef) out.push(cur);
    while (rest.length) {
      var bi = 0, bd = Infinity;
      for (var j = 0; j < rest.length; j++) { var d = haversine(cur, rest[j]); if (d < bd) { bd = d; bi = j; } }
      cur = rest.splice(bi, 1)[0]; out.push(cur);
    }
    return out;
  }
  function pathLen(seq, head, tail) {
    var d = 0, prev = head || seq[0], s = head ? 0 : 1;
    for (var j = s; j < seq.length; j++) { d += haversine(prev, seq[j]); prev = seq[j]; }
    if (tail) d += haversine(prev, tail);
    return d;
  }
  function twoOpt(seq, head, tail) {
    var improved = true, n = seq.length, guard = 0;
    while (improved && guard++ < 60) {
      improved = false;
      for (var a = 0; a < n - 1; a++) {
        for (var b = a + 1; b < n; b++) {
          var A = a === 0 ? head : seq[a - 1]; if (!A) continue;
          var B = seq[a], C = seq[b], Dd = (b + 1 < n) ? seq[b + 1] : tail; if (!Dd) continue;
          var delta = (haversine(A, C) + haversine(B, Dd)) - (haversine(A, B) + haversine(C, Dd));
          if (delta < -1e-6) { for (var lo = a, hi = b; lo < hi; lo++, hi--) { var tmp = seq[lo]; seq[lo] = seq[hi]; seq[hi] = tmp; } improved = true; }
        }
      }
    }
    return seq;
  }
  V2.carteTourOptimize = function () {
    if (tour.length < 2) return;
    var seq = nearestOrder(tour, depot || null);  // depot = point de départ (non inclus dans seq)
    seq = twoOpt(seq, depot || null, depot || null);
    tour = seq; saveTour(); renderTourPanel(); drawTourLine();
    if (V2.toast) V2.toast('Tournée optimisée · ' + Math.round(routeKm()) + ' km');
  };
  // Tracé de la tournée sur la carte (ligne + pastilles numérotées)
  function drawTourLine() {
    if (!map || !window.L) return;
    if (tourLayer) { map.removeLayer(tourLayer); tourLayer = null; }
    var pts = routeStops(); if (pts.length < 2) return;
    tourLayer = window.L.layerGroup();
    window.L.polyline(pts.map(function (s) { return [s.lat, s.lng]; }), { color: '#0050E6', weight: 3, opacity: 0.85, dashArray: '1,0' }).addTo(tourLayer);
    if (depot) window.L.marker([depot.lat, depot.lng]) && window.L.circleMarker([depot.lat, depot.lng], { radius: 9, color: '#fff', weight: 2, fillColor: '#10131C', fillOpacity: 1 }).bindTooltip('Dépôt : ' + esc(depot.n || ''), { direction: 'top' }).addTo(tourLayer);
    tour.forEach(function (s, j) {
      window.L.circleMarker([s.lat, s.lng], { radius: 11, color: '#fff', weight: 2, fillColor: '#0050E6', fillOpacity: 1 })
        .bindTooltip(String(j + 1) + '. ' + esc(s.n || ''), { direction: 'top' })
        .bindPopup('<b>' + (j + 1) + '. ' + esc(s.n || '') + '</b><br>' + esc(s.v || '') + ' ' + esc(s.c || ''))
        .addTo(tourLayer);
    });
    tourLayer.addTo(map);
  }
  V2.carteTourFit = function () {
    if (!map || !window.L) return; var pts = routeStops(); if (!pts.length) return;
    map.fitBounds(window.L.latLngBounds(pts.map(function (s) { return [s.lat, s.lng]; })).pad(0.15));
  };
  // Dépôt : définir par clic sur la carte
  V2.carteDepotPick = function () {
    pickDepotMode = true;
    if (V2.toast) V2.toast('Clique un point sur la carte pour définir le dépôt');
    var mp = document.getElementById('carte-map'); if (mp) mp.style.cursor = 'crosshair';
  };
  V2.carteDepotClear = function () { depot = null; try { localStorage.removeItem('jarvis_depot_v1'); } catch (e) {} drawTourLine(); renderTourPanel(); };
  function setDepot(d) { depot = d; try { localStorage.setItem('jarvis_depot_v1', JSON.stringify(depot)); } catch (e) {} drawTourLine(); if (document.getElementById('cn-tourpanel')) renderTourPanel(); }
  V2.carteDepotSet = function (v) {
    var i = parseInt(v, 10); if (isNaN(i) || !DEPOTS[i]) return;
    var d = DEPOTS[i]; setDepot({ n: (d.s ? d.s + ' — ' : '') + d.city, lat: d.lat, lng: d.lng, di: i });
  };
  V2.carteDepotAuto = function () {
    if (!tour.length) { if (V2.toast) V2.toast('Ajoute d\'abord des arrêts'); return; }
    var cx = 0, cy = 0; tour.forEach(function (s) { cx += s.lat; cy += s.lng; }); cx /= tour.length; cy /= tour.length;
    var bi = 0, bd = Infinity;
    DEPOTS.forEach(function (d, i) { var dd = haversine({ lat: cx, lng: cy }, d); if (dd < bd) { bd = dd; bi = i; } });
    V2.carteDepotSet(bi);
    if (V2.toast) V2.toast('Dépôt le plus proche : ' + DEPOTS[bi].city);
  };
  // Marqueurs des établissements Intégral (toujours visibles)
  function drawDepots() {
    if (!map || !window.L) return;
    if (depotLayer) { map.removeLayer(depotLayer); depotLayer = null; }
    depotLayer = window.L.layerGroup();
    DEPOTS.forEach(function (d, i) {
      var ic = window.L.divIcon({ className: 'cn-depmk', html: '<span>' + esc(d.s || '◆') + '</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
      window.L.marker([d.lat, d.lng], { icon: ic, zIndexOffset: 900 })
        .bindPopup('<b>' + esc(d.n) + '</b><br>' + esc(d.city) + '<br><button class="cn-pop-btn" style="margin-top:8px;width:100%;cursor:pointer" onclick="V2.carteDepotSet(' + i + ')">Départ de ma tournée</button>')
        .addTo(depotLayer);
    });
    depotLayer.addTo(map);
  }
  V2.carteTourItinerary = function () {
    if (!tour.length) return;
    window.open('https://www.google.com/maps/dir/' + tour.map(function (s) { return s.lat + ',' + s.lng; }).join('/'), '_blank');
  };
  V2.carteTourAgenda = function () {
    if (!tour.length) return;
    var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    var end = new Date(d.getTime() + 8 * 3600 * 1000);
    var pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var fmt = function (t) { return t.getFullYear() + pad(t.getMonth() + 1) + pad(t.getDate()) + 'T' + pad(t.getHours()) + pad(t.getMinutes()) + '00'; };
    var details = 'Tournée de prospection Intégral (' + tour.length + ' pharmacies) :%0A' +
      tour.map(function (s, j) { return (j + 1) + '. ' + s.n + ' — ' + s.v + ' ' + s.c + (s.t ? ' — ' + s.t : ''); }).join('%0A') +
      '%0A%0AItinéraire : https://www.google.com/maps/dir/' + tour.map(function (s) { return s.lat + ',' + s.lng; }).join('/');
    var url = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent('Tournée prospection — ' + tour.length + ' pharmacies') +
      '&dates=' + fmt(d) + '/' + fmt(end) + '&details=' + details +
      '&location=' + encodeURIComponent(tour[0].n + ' ' + tour[0].v + ' ' + tour[0].c);
    window.open(url, '_blank');
  };
  V2.carteTourRemove = function (j) { if (tour[j]) { tour.splice(j, 1); saveTour(); updateTourBar(); renderTourPanel(); rebuild(); drawTourLine(); } };
  V2.carteTourClear = function () { tour = []; saveTour(); updateTourBar(); renderTourPanel(); rebuild(); drawTourLine(); };
  V2.carteTourClose = function () { var el = document.getElementById('cn-tourpanel'); if (el) el.remove(); };
  V2.carteTourOpen = function () {
    if (!document.getElementById('cn-tourpanel')) {
      var el = document.createElement('div'); el.id = 'cn-tourpanel'; el.className = 'cn-panel';
      el.onclick = function (e) { if (e.target === el) V2.carteTourClose(); };
      document.body.appendChild(el);
    }
    renderTourPanel();
  };
  function renderTourPanel() {
    var el = document.getElementById('cn-tourpanel'); if (!el) return;
    var rows = tour.map(function (s, j) {
      return '<div class="cn-trow"><span class="cn-tnum">' + (j + 1) + '</span>' +
        '<div class="cn-tmain"><b>' + esc(s.n) + '</b><span>' + esc(s.v) + ' · ' + esc(s.c) + (s.t ? ' · ' + esc(s.t) : '') + '</span></div>' +
        '<button class="cn-trm" onclick="V2.carteTourRemove(' + j + ')" title="Retirer">✕</button></div>';
    }).join('') || '<div class="cn-tempty">Ta tournée est vide.<br>Clique une pharmacie sur la carte, puis « + Ajouter à ma tournée ».</div>';
    var kmTot = Math.round(routeKm());
    var perStop = tour.length ? (Math.round(kmTot / tour.length * 10) / 10) : 0;
    var metrics = tour.length ? '<div class="cn-tmetrics">' +
      '<div class="cn-tmetric"><b>' + tour.length + '</b><span>arrêt' + (tour.length > 1 ? 's' : '') + '</span></div>' +
      '<div class="cn-tmetric"><b>' + kmTot + ' km</b><span>total' + (depot ? ' (dépôt inclus)' : '') + '</span></div>' +
      '<div class="cn-tmetric"><b>' + fmtDur(estMinutes()) + '</b><span>temps estimé</span></div>' +
      '<div class="cn-tmetric"><b>' + perStop + '</b><span>km / arrêt</span></div>' +
      '</div>' : '';
    var pinSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
    var depOpts = '<option value="">— Dépôt de départ —</option>' + DEPOTS.map(function (d, i) {
      return '<option value="' + i + '"' + (depot && depot.di === i ? ' selected' : '') + '>' + esc((d.s ? d.s + ' · ' : '') + d.city) + '</option>';
    }).join('');
    var depotRow = '<div class="cn-tdepot">' + pinSvg +
      '<select class="cn-depsel" onchange="V2.carteDepotSet(this.value)">' + depOpts + '</select>' +
      '<button class="cn-tlink" onclick="V2.carteDepotAuto()">le plus proche</button>' +
      '<button class="cn-tlink" onclick="V2.carteDepotPick()">clic carte</button>' +
      (depot ? '<button class="cn-tlink" onclick="V2.carteDepotClear()">retirer</button>' : '') +
      '</div>';
    el.innerHTML = '<div class="cn-pdialog" onclick="event.stopPropagation()">' +
      '<div class="cn-phead"><div><b>Ma tournée</b><small>' + tour.length + ' arrêt' + (tour.length > 1 ? 's' : '') + (tour.length > 1 ? ' · ~' + kmTot + ' km' : '') + '</small></div>' +
        '<button class="cn-px" onclick="V2.carteTourClose()">✕</button></div>' +
      metrics + depotRow +
      '<div class="cn-plist">' + rows + '</div>' +
      (tour.length ? '<div class="cn-pacts">' +
        (tour.length >= 2 ? '<button class="v2-btn v2-btn-primary" onclick="V2.carteTourOptimize()">Optimiser la tournée</button>' : '') +
        (tour.length >= 1 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourFit()">Voir le tracé</button>' : '') +
        '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourItinerary()">Itinéraire GPS</button>' +
        '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourAgenda()">Agenda</button>' +
        '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourClear()">Vider</button>' +
        '</div>' : '') +
      '</div>';
  }

  function legendHtml() {
    var lg = function (c, t) { return '<span class="cn-lg"><i style="background:' + c + '"></i>' + esc(t) + '</span>'; };
    if (colorMode === 'comm') {
      var out = '';
      for (var k = 1; k < D.comm.length; k++) out += lg(COMM_COL[k], D.comm[k]);
      return out + lg(PROSPECT_COL, 'Prospect (à conquérir)') + lg('#D4DAE3', 'Hors réseau');
    }
    if (colorMode === 'type') return lg(SEG_COL['Client A'], 'Client A') + lg(SEG_COL['Client B'], 'Client B') + lg(SEG_COL['Client C'], 'Client C') + lg(SEG_COL.Prospect, 'Prospect') + lg('#AEB6C4', 'Non défini');
    if (colorMode === 'grp') return Object.keys(GRP_COL).map(function (g) { return lg(GRP_COL[g], D.grp[g]); }).join('') + lg('#CBD2DD', 'Autres');
    return '<span class="cn-lg-txt">' + (D ? D.uga.length : 0) + ' UGA · une couleur par secteur</span>';
  }

  function injectCss() {
    if (document.getElementById('v2-carte-css')) return;
    var s = document.createElement('style'); s.id = 'v2-carte-css';
    s.textContent = [
      '.cn-wrap{display:flex;flex-direction:column;height:calc(100vh - 54px);height:calc(100dvh - 54px);min-height:520px}',
      '.cn-bar{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;padding:9px 16px;border-bottom:1px solid var(--line);background:var(--card)}',
      '.cn-title{font-weight:800;font-size:15px;color:var(--ip-ink);display:flex;align-items:baseline;gap:8px}',
      '.cn-title small{font-weight:600;font-size:12px;color:var(--muted)}',
      '.cn-grp{display:flex;align-items:center;gap:6px}',
      '.cn-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2)}',
      '.cn-seg{display:inline-flex;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-pill);padding:2px;gap:2px}',
      '.cn-seg button{border:none;background:transparent;font:inherit;font-size:12px;font-weight:700;color:var(--muted);padding:6px 11px;border-radius:var(--r-pill);cursor:pointer}',
      '.cn-seg button.on{background:var(--ip-blue);color:#fff}',
      '.cn-sel{font:inherit;font-size:13px;font-weight:600;color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:var(--r-control,10px);padding:7px 10px;max-width:190px}',
      '.cn-spacer{margin-left:auto}',
      '.cn-legend{display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px 16px;border-bottom:1px solid var(--line);background:var(--card-2)}',
      '.cn-lg{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:var(--ip-ink-2,#2A2F3C)}',
      '.cn-lg i{width:11px;height:11px;border-radius:50%;display:inline-block}',
      '.cn-lg-txt{font-size:12px;color:var(--muted);font-weight:600}',
      '.cn-maparea{position:relative;flex:1 1 auto;min-height:60vh}',
      '#carte-map{position:absolute;inset:0;background:#EAF0F6}',
      '.cn-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:var(--muted);z-index:5;background:var(--card)}',
      '.leaflet-popup-content{margin:12px 14px}',
      '.cn-pop{font-family:var(--font,system-ui);min-width:200px;max-width:250px}',
      '.cn-pop-n{font-size:14px;font-weight:800;color:#10131C;display:block;line-height:1.25}',
      '.cn-pop-tit{font-size:12px;color:#3A4150;font-weight:600;margin-top:1px}',
      '.cn-pop-a{font-size:12px;color:#737A8C;margin-top:2px}',
      '.cn-pop-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}',
      '.cn-tag{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;background:#EEF1F6;color:#3A4150}',
      '.cn-tag.cl{background:#E3F3EB;color:#0B6E43}.cn-tag.pr{background:#E7EFFE;color:#1E5FD0}.cn-tag.co{background:#FFF0E6;color:#C2410C}',
      '.cn-pop-contact{display:flex;flex-direction:column;gap:2px;margin-top:8px}',
      '.cn-pop-contact a{font-size:12.5px;font-weight:700;color:#0050E6;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cn-pop-btns{display:flex;gap:6px;margin-top:10px}',
      '.cn-pop-btn{flex:1;text-align:center;font-size:12px;font-weight:700;padding:7px 8px;border-radius:8px;text-decoration:none;border:1px solid #E2E7F0;color:#10131C}',
      '.cn-pop-btn.on{background:#0050E6;color:#fff;border-color:#0050E6}',
      '.cn-tour-btn{width:100%;margin-top:9px;padding:8px;border:1.5px solid #C2410C;background:#FFF7ED;color:#C2410C;font-weight:800;font-size:12.5px;border-radius:9px;cursor:pointer}',
      '.cn-tour-btn.in{background:#0F7A52;border-color:#0F7A52;color:#fff}',
      // barre tournée flottante
      '.cn-tourbar{position:absolute;left:50%;bottom:16px;transform:translateX(-50%) translateY(120%);z-index:600;display:flex;align-items:center;gap:12px;padding:9px 12px 9px 16px;background:var(--ip-ink,#10131C);color:#fff;border-radius:999px;box-shadow:0 12px 30px rgba(16,19,28,.35);transition:transform .22s var(--ease,ease);white-space:nowrap}',
      '.cn-tourbar.on{transform:translateX(-50%) translateY(0)}',
      '.cn-tourbar b{font-weight:700}',
      '.cn-tourbar button{border:none;background:#F59E0B;color:#10131C;font:inherit;font-weight:800;font-size:13px;padding:8px 14px;border-radius:999px;cursor:pointer}',
      // panneau tournée
      '.cn-panel{position:fixed;inset:0;z-index:3000;background:rgba(16,19,28,.48);display:flex;align-items:flex-end;justify-content:center}',
      '@media(min-width:640px){.cn-panel{align-items:center}}',
      '.cn-pdialog{width:100%;max-width:460px;max-height:82vh;display:flex;flex-direction:column;background:var(--card,#fff);border-radius:18px 18px 0 0;overflow:hidden}',
      '@media(min-width:640px){.cn-pdialog{border-radius:18px}}',
      '.cn-phead{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}',
      '.cn-phead b{font-size:16px;font-weight:800;color:var(--ip-ink)}.cn-phead small{display:block;font-size:12px;color:var(--muted);margin-top:2px}',
      '.cn-px{border:none;background:var(--card-2);width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;color:var(--muted)}',
      '.cn-plist{flex:1;overflow-y:auto;padding:8px 12px}',
      '.cn-trow{display:flex;align-items:center;gap:11px;padding:9px 6px;border-bottom:1px solid var(--line)}',
      '.cn-tnum{flex:none;width:24px;height:24px;border-radius:50%;background:var(--ip-blue);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}',
      '.cn-tmain{flex:1;min-width:0}.cn-tmain b{display:block;font-size:13.5px;font-weight:700;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cn-tmain span{font-size:12px;color:var(--muted)}',
      '.cn-trm{flex:none;border:none;background:transparent;color:var(--muted-2);font-size:15px;cursor:pointer;padding:4px 8px}',
      '.cn-tempty{padding:32px 20px;text-align:center;color:var(--muted);font-size:13.5px;line-height:1.5}',
      '.cn-tmetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 16px;border-bottom:1px solid var(--line)}',
      '.cn-tmetric{text-align:center;background:var(--card-2,#F4F6FB);border-radius:10px;padding:8px 4px}',
      '.cn-tmetric b{display:block;font-size:15px;font-weight:800;color:var(--ip-blue,#0057FF)}',
      '.cn-tmetric span{display:block;font-size:10.5px;color:var(--muted);margin-top:1px}',
      '.cn-tdepot{display:flex;align-items:center;gap:7px;padding:10px 16px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--ip-ink)}',
      '.cn-tdepot svg{color:var(--muted);flex-shrink:0}',
      '.cn-tlink{background:none;border:none;color:var(--ip-blue,#0057FF);font:inherit;font-size:12px;font-weight:700;cursor:pointer;padding:2px 4px}',
      '.cn-depsel{flex:1;min-width:0;font:inherit;font-size:12.5px;font-weight:600;color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px 8px}',
      '.cn-depmk{background:none;border:none}',
      '.cn-depmk span{display:flex;align-items:center;justify-content:center;width:30px;height:30px;background:#0A0E1A;color:#fff;border:2px solid #fff;border-radius:8px;font:800 10px/1 system-ui;box-shadow:0 2px 6px rgba(0,0,0,.35)}',
      '.cn-pacts{display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px;border-top:1px solid var(--line)}',
      '.cn-pacts .v2-btn{flex:1 1 auto}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function boot(root) {
    D = window.PHARMA_FR;
    loadTour();
    try { var dp = JSON.parse(localStorage.getItem('jarvis_depot_v1') || 'null'); if (dp && dp.lat) depot = dp; } catch (e) {}
    computeColors();
    var commOpts = '<option value="">Tous les commerciaux</option>' +
      D.comm.slice(1).map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    var grpOpts = '<option value="">Tous les groupements</option>' +
      D.grp.map(function (g) { return (g === '—') ? '' : '<option>' + esc(g) + '</option>'; }).join('');
    root.querySelector('#cn-comm').innerHTML = commOpts;
    root.querySelector('#cn-grpsel').innerHTML = grpOpts;
    root.querySelector('#carte-legend').innerHTML = legendHtml();
    map = window.L.map(root.querySelector('#carte-map'), { preferCanvas: true, zoomControl: true, attributionControl: false }).setView([46.6, 2.4], 6);
    canvas = window.L.canvas({ padding: 0.5 });
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18, subdomains: 'abcd' }).addTo(map);
    map.on('click', function (e) {
      if (!pickDepotMode) return;
      pickDepotMode = false; var mp = document.getElementById('carte-map'); if (mp) mp.style.cursor = '';
      depot = { n: 'Dépôt', lat: e.latlng.lat, lng: e.latlng.lng };
      try { localStorage.setItem('jarvis_depot_v1', JSON.stringify(depot)); } catch (er) {}
      drawTourLine(); if (document.getElementById('cn-tourpanel')) renderTourPanel();
      if (V2.toast) V2.toast('Dépôt défini');
    });
    setTimeout(function () { map.invalidateSize(); rebuild(); updateTourBar(); drawDepots(); drawTourLine(); }, 60);
    setTimeout(function () { if (map) map.invalidateSize(); }, 420);
    if (!V2._carteResize) { V2._carteResize = true; window.addEventListener('resize', function () { if (map && V2.route && V2.route.name === 'carte') map.invalidateSize(); }); }
  }

  function segBtn(k, lbl) { return '<button id="cb-' + k + '"' + (colorMode === k ? ' class="on"' : '') + ' onclick="V2.carteColor(\'' + k + '\')">' + lbl + '</button>'; }
  function typeBtn(k, lbl) { return '<button id="ct-' + k + '"' + (typeFocus === k ? ' class="on"' : '') + ' onclick="V2.carteType(\'' + k + '\')">' + lbl + '</button>'; }

  V2.pages.carte = {
    render: function (root) {
      injectCss();
      root.innerHTML = V2.topbar({ back: true, backTo: 'copilote', backLabel: 'Copilote' }) +
        '<div class="cn-wrap">' +
          '<div class="cn-bar">' +
            '<div class="cn-title">Carte nationale <small id="carte-count">chargement…</small></div>' +
            '<div class="cn-grp"><span class="cn-lbl">Voir</span><div class="cn-seg">' + typeBtn('all', 'Tout') + typeBtn('clients', 'Clients') + typeBtn('prospects', 'Prospects') + '</div></div>' +
            '<div class="cn-grp"><span class="cn-lbl">Couleur</span><div class="cn-seg">' + segBtn('comm', 'Commercial') + segBtn('type', 'Client/Prospect') + segBtn('uga', 'UGA') + segBtn('grp', 'Groupement') + '</div></div>' +
            '<div class="cn-grp cn-spacer"><select id="cn-comm" class="cn-sel" onchange="V2.carteComm(this.value)"></select>' +
              '<select id="cn-grpsel" class="cn-sel" onchange="V2.carteGrp(this.value)"></select></div>' +
          '</div>' +
          '<div class="cn-legend" id="carte-legend"></div>' +
          '<div class="cn-maparea"><div id="carte-map"></div>' +
            '<div class="cn-tourbar" id="cn-tourbar"><b id="cn-tourbar-n">0 pharmacie</b>' +
              '<button onclick="V2.carteTourOpen()">Voir / organiser</button></div>' +
            '<div class="cn-load" id="carte-load"><div class="v2-spinner"></div><div>Chargement de la carte nationale…</div></div>' +
          '</div>' +
        '</div>';
      var load = document.getElementById('carte-load');
      ensureLeaflet(function (e) {
        if (e) { if (load) load.innerHTML = 'Carte indisponible (connexion requise).'; return; }
        ensureData(function (e2) {
          if (e2) { if (load) load.innerHTML = 'Données indisponibles.'; return; }
          if (load) load.style.display = 'none';
          boot(root);
        });
      });
    }
  };

  V2.carteColor = function (m) {
    colorMode = m;
    ['comm', 'type', 'uga', 'grp'].forEach(function (k) { var b = document.getElementById('cb-' + k); if (b) b.classList.toggle('on', k === m); });
    var lg = document.getElementById('carte-legend'); if (lg) lg.innerHTML = legendHtml();
    recolor();
  };
  V2.carteType = function (t) {
    typeFocus = t;
    ['all', 'clients', 'prospects'].forEach(function (k) { var b = document.getElementById('ct-' + k); if (b) b.classList.toggle('on', k === t); });
    rebuild();
  };
  V2.carteComm = function (v) { commFocus = v || ''; rebuild(); };
  V2.carteGrp = function (v) { grpFocus = v || ''; rebuild(); };
})();
