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

  var CB = '?v=20260708s';
  var map = null, cluster = null, markers = null, D = null, canvas = null;
  var displayMode = 'points';    // points | bulles (taille = CA)
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
  var searchTerm = '';   // recherche nom / ville / cp / titulaire
  var listSort = 'nom';  // tri de la liste : nom | ca
  var deptFocus = '';    // filtre département (2 chiffres, 3 pour DOM)
  var caMin = 0;         // filtre CA minimum (€)
  var DEPT_NAMES = { '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Hte-Provence', '05': 'Hautes-Alpes', '06': 'Alpes-Maritimes', '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube', '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône', '14': 'Calvados', '15': 'Cantal', '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze', '21': "Côte-d'Or", '22': "Côtes-d'Armor", '23': 'Creuse', '24': 'Dordogne', '25': 'Doubs', '26': 'Drôme', '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère', '30': 'Gard', '31': 'Haute-Garonne', '32': 'Gers', '33': 'Gironde', '34': 'Hérault', '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire', '38': 'Isère', '39': 'Jura', '40': 'Landes', '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique', '45': 'Loiret', '46': 'Lot', '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire', '50': 'Manche', '51': 'Marne', '52': 'Haute-Marne', '53': 'Mayenne', '54': 'Meurthe-et-Moselle', '55': 'Meuse', '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord', '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais', '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques', '65': 'Hautes-Pyrénées', '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône', '70': 'Haute-Saône', '71': 'Saône-et-Loire', '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie', '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne', '78': 'Yvelines', '79': 'Deux-Sèvres', '80': 'Somme', '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse', '85': 'Vendée', '86': 'Vienne', '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne', '90': 'Belfort', '91': 'Essonne', '92': 'Hauts-de-Seine', '93': 'Seine-St-Denis', '94': 'Val-de-Marne', '95': "Val-d'Oise", '971': 'Guadeloupe', '972': 'Martinique', '973': 'Guyane', '974': 'La Réunion', '976': 'Mayotte' };
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
  function caOf(p) { return (p && p[12]) || 0; }
  function eurK(n) { n = n || 0; return n >= 1000 ? (Math.round(n / 100) / 10).toLocaleString('fr') + ' k€' : Math.round(n) + ' €'; }
  function colorFor(p) {
    if (colorMode === 'comm') {
      if (p[5]) return COMM_COL[p[5]] || '#94A3B8';        // dans un portefeuille commercial
      if (isProspect(p)) return PROSPECT_COL;              // prospect libre → ambre visible
      return '#D4DAE3';
    }
    if (colorMode === 'type') return SEG_COL[D.seg[p[4]]] || '#AEB6C4';
    if (colorMode === 'grp') return GRP_COL[p[3]] || '#CBD2DD';
    if (colorMode === 'ca') { var c = caOf(p); if (!c) return '#E2E6EC'; if (c >= 50000) return '#7A0C2E'; if (c >= 20000) return '#C7283D'; if (c >= 8000) return '#EA580C'; if (c >= 2000) return '#F59E0B'; return '#FCD34D'; }
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
        (caOf(p) > 0 ? '<span class="cn-tag ca">CA ' + eurK(caOf(p)) + '</span>' : '') +
        (comm ? '<span class="cn-tag co">' + esc(comm) + '</span>' : '') +
        '<span class="cn-tag">UGA ' + esc(D.uga[p[2]] || '—') + '</span>' +
        (D.grp[p[3]] && D.grp[p[3]] !== '—' ? '<span class="cn-tag">' + esc(D.grp[p[3]]) + '</span>' : '') +
      '</div>' +
      (tel || mail ? '<div class="cn-pop-contact">' +
        (tel ? '<a href="tel:' + esc(tel) + '">' + esc(p[9]) + '</a>' : '') +
        (mail ? '<a href="mailto:' + esc(mail) + '">' + esc(mail) + '</a>' : '') + '</div>' : '') +
      (i != null ? '<button class="cn-fiche-btn" onclick="V2.carteFiche(' + i + ')">Voir la fiche complète</button>' : '') +
      (i != null ? '<button class="cn-tour-btn' + (inT ? ' in' : '') + '" id="cn-tour-' + i + '" onclick="V2.carteTour(' + i + ')">' + (inT ? '✓ Dans ma tournée' : '+ Ajouter à ma tournée') + '</button>' : '') +
      '<div class="cn-pop-btns">' +
        '<a class="cn-pop-btn on" href="' + gmaps + '" target="_blank" rel="noopener">Fiche Google Maps</a>' +
        '<a class="cn-pop-btn" href="' + dir + '" target="_blank" rel="noopener">Itinéraire</a>' +
      '</div></div>';
  }

  function deptOf(cp) { cp = String(cp || '').replace(/\s/g, ''); if (cp.length < 2) return ''; return /^97/.test(cp) ? cp.slice(0, 3) : cp.slice(0, 2); }
  function pass(p) {
    if (typeFocus === 'clients' && !isClient(p)) return false;
    if (typeFocus === 'prospects' && D.seg[p[4]] !== 'Prospect') return false;
    if (commFocus && D.comm[p[5]] !== commFocus) return false;
    if (grpFocus && D.grp[p[3]] !== grpFocus) return false;
    if (deptFocus && deptOf(p[8]) !== deptFocus) return false;
    if (caMin && caOf(p) < caMin) return false;
    if (searchTerm && !matchTxt(p)) return false;
    return true;
  }
  function norm(s) { s = String(s || '').toLowerCase(); return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s; }
  function matchTxt(p) {
    var q = norm(searchTerm);
    return norm(p[6]).indexOf(q) >= 0 || norm(p[7]).indexOf(q) >= 0 || norm(p[8]).indexOf(q) >= 0 || norm(p[10]).indexOf(q) >= 0;
  }

  // taille du point : uniforme, sauf en mode « CA » où le rayon grandit avec le CA (grosses cibles = gros points)
  function caRadius(c) { if (!c || c <= 0) return 4; return Math.min(13, 4.5 + Math.sqrt(c / 1000) * 1.15); }
  function markerStyle(p, i) {
    var t = inTour(i);
    var r = t ? 7 : (colorMode === 'ca' ? caRadius(caOf(p)) : 5.5);
    return { renderer: canvas, radius: r, color: t ? '#10131C' : '#fff', weight: t ? 2 : 0.9, fillColor: colorFor(p), fillOpacity: 0.95 };
  }
  // Mode « Bulles CA » : un seul bleu, translucide, rayon = CA (les grosses cibles ressortent)
  function bubbleStyle(p, i) {
    var t = inTour(i);
    return { renderer: canvas, radius: t ? 8 : caRadius(caOf(p)), color: t ? '#10131C' : '#0050E6', weight: t ? 2 : 0.6, fillColor: '#0050E6', fillOpacity: 0.32 };
  }
  function rebuild() {
    if (!map) return;
    if (cluster) { map.removeLayer(cluster); cluster = null; }
    markers = [];
    var pts = D.p, cn = document.getElementById('carte-count');
    // indices filtrés
    var idx = []; for (var i = 0; i < pts.length; i++) if (pass(pts[i])) idx.push(i);

    // ── POINTS (marqueurs, cluster) ou BULLES CA (taille = CA, sans cluster, seulement le CA>0) ──
    var bulles = (displayMode === 'bulles');
    var useCluster = !bulles && !!window.L.markerClusterGroup;
    function openPop(e) { var p = D.p[e.layer._pi]; if (p) e.layer.bindPopup(popupHtml(p, e.layer._pi), { minWidth: 216 }).openPopup(); }
    if (useCluster) {
      cluster = window.L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 48, disableClusteringAtZoom: 9, removeOutsideVisibleBounds: true });
      cluster.on('click', openPop);
    } else {
      cluster = window.L.layerGroup();
    }
    var arr = [];
    for (var k = 0; k < idx.length; k++) {
      var ii = idx[k], p = pts[ii];
      if (bulles && caOf(p) <= 0) continue;   // bulles = uniquement les officines avec du CA
      var m = window.L.circleMarker([p[0], p[1]], bulles ? bubbleStyle(p, ii) : markerStyle(p, ii));
      m._pi = ii; if (!useCluster) m.on('click', openPop);
      m.on('mouseover', function () { if (!this._ntt) { this._ntt = 1; this.bindTooltip(esc(D.p[this._pi][6] || ''), { direction: 'top', offset: [0, -3] }); } this.openTooltip(); });
      markers.push(m); arr.push(m);
    }
    if (useCluster) cluster.addLayers(arr); else for (var a = 0; a < arr.length; a++) cluster.addLayer(arr[a]);
    map.addLayer(cluster);
    if (cn) cn.textContent = markers.length.toLocaleString('fr') + (bulles ? ' officines avec CA' : ' pharmacies');
  }
  function recolor() { if (markers) for (var k = 0; k < markers.length; k++) markers[k].setStyle(markerStyle(D.p[markers[k]._pi], markers[k]._pi)); }
  function refreshMarkerStyle(i) { if (!markers) return; for (var k = 0; k < markers.length; k++) if (markers[k]._pi === i) { markers[k].setStyle(markerStyle(D.p[i], i)); break; } }

  // ── PLAN DE TOURNÉE (sélection de pharmacies → journée de prospection) ──
  var TOUR_KEY = 'jarvis_tour_v1', tour = [];
  var TOURS_KEY = 'jarvis_tours_v2';   // tournées enregistrées (nommées)
  function loadTours() { try { var a = JSON.parse(localStorage.getItem(TOURS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function writeTours(a) { try { localStorage.setItem(TOURS_KEY, JSON.stringify(a)); } catch (e) {} }
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

  // ── PROSPECTION / densification : prospects proches de la tournée, classés par km ajoutés ──
  var PROSPECT_RADIUS = 8;   // km autour du trajet
  function routeKmFor(arr) { var pts = []; if (depot) pts.push(depot); for (var j = 0; j < arr.length; j++) pts.push(arr[j]); if (depot && arr.length) pts.push(depot); var d = 0; for (var k = 1; k < pts.length; k++) d += haversine(pts[k - 1], pts[k]); return d; }
  function nearRoute(P) { var pts = routeStops(), m = Infinity; for (var j = 0; j < pts.length; j++) { var d = haversine(pts[j], P); if (d < m) m = d; } return m; }
  function bestInsert(P) { var base = routeKmFor(tour), best = { pos: tour.length, add: Infinity }; for (var k = 0; k <= tour.length; k++) { var tmp = tour.slice(); tmp.splice(k, 0, P); var add = routeKmFor(tmp) - base; if (add < best.add) { best.add = add; best.pos = k; } } return best; }
  function computeProspects() {
    if (!D || !tour.length) return [];
    var out = [];
    for (var i = 0; i < D.p.length; i++) {
      var p = D.p[i]; if (!isProspect(p)) continue;
      if (tourPos(keyOf(p)) >= 0) continue;
      var P = { lat: p[0], lng: p[1] };
      var nr = nearRoute(P); if (nr > PROSPECT_RADIUS) continue;
      var bi = bestInsert(P);
      out.push({ i: i, n: p[6], v: p[7], c: p[8], t: p[9], near: nr, add: bi.add, pos: bi.pos });
    }
    out.sort(function (a, b) { return a.add - b.add; });
    return out.slice(0, 30);
  }
  V2.carteProsRadius = function (v) { PROSPECT_RADIUS = parseInt(v, 10) || 8; renderProsPanel(); };
  V2.carteProspects = function () {
    if (!tour.length) { if (V2.toast) V2.toast('Compose d\'abord une tournée'); return; }
    if (!document.getElementById('cn-prospanel')) {
      var el = document.createElement('div'); el.id = 'cn-prospanel'; el.className = 'cn-panel';
      el.onclick = function (e) { if (e.target === el) V2.carteProsClose(); };
      document.body.appendChild(el);
    }
    renderProsPanel();
  };
  V2.carteProsClose = function () { var el = document.getElementById('cn-prospanel'); if (el) el.remove(); };
  V2.carteProsAdd = function (i) {
    var p = D.p[i]; if (!p) return; var P = { k: keyOf(p), n: p[6], v: p[7], c: p[8], t: p[9], lat: p[0], lng: p[1] };
    var bi = bestInsert({ lat: p[0], lng: p[1] });
    tour.splice(bi.pos, 0, P); saveTour(); updateTourBar(); refreshMarkerStyle(i); drawTourLine();
    renderProsPanel(); if (document.getElementById('cn-tourpanel')) renderTourPanel();
    if (V2.toast) V2.toast('Prospect ajouté (+' + (Math.round(bi.add * 10) / 10) + ' km)');
  };
  function renderProsPanel() {
    var el = document.getElementById('cn-prospanel'); if (!el) return;
    var list = computeProspects();
    var rows = list.map(function (r) {
      return '<div class="cn-prow"><div class="cn-tmain"><b>' + esc(r.n) + '</b><span>' + esc(r.v) + ' · ' + esc(r.c) + ' · à ' + (Math.round(r.near * 10) / 10) + ' km du trajet</span></div>' +
        '<div class="cn-padd">+' + (Math.round(r.add * 10) / 10) + ' km</div>' +
        '<button class="v2-btn v2-btn-primary cn-paddbtn" onclick="V2.carteProsAdd(' + r.i + ')">+ Ajouter</button></div>';
    }).join('') || '<div class="cn-tempty">Aucun prospect dans un rayon de ' + PROSPECT_RADIUS + ' km du trajet.<br>Élargis le rayon ci-dessus.</div>';
    el.innerHTML = '<div class="cn-pdialog" onclick="event.stopPropagation()">' +
      '<div class="cn-phead"><div><b>Prospects sur ma tournée</b><small>' + list.length + ' prospect' + (list.length > 1 ? 's' : '') + ' · classés par km ajoutés</small></div>' +
        '<button class="cn-px" onclick="V2.carteProsClose()">✕</button></div>' +
      '<div class="cn-prosbar">Rayon autour du trajet : <b>' + PROSPECT_RADIUS + ' km</b>' +
        '<input type="range" min="2" max="25" step="1" value="' + PROSPECT_RADIUS + '" oninput="V2.carteProsRadius(this.value)"></div>' +
      '<div class="cn-plist">' + rows + '</div></div>';
  }
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

  // ── Tournées enregistrées (nommées) ──
  V2.carteTourSaveAs = function () {
    if (!tour.length) return;
    var nm = window.prompt('Nom de la tournée :', 'Tournée du ' + new Date().toLocaleDateString('fr'));
    if (nm == null) return;
    var all = loadTours();
    all.unshift({ id: 't' + Date.now(), name: (nm || 'Tournée').slice(0, 60), ts: Date.now(), depot: depot, tour: tour.slice() });
    writeTours(all.slice(0, 60));
    renderTourPanel();
    if (V2.toast) V2.toast('Tournée enregistrée : ' + (nm || 'Tournée'));
  };
  V2.carteToursOpen = function () {
    if (!document.getElementById('cn-savedpanel')) {
      var el = document.createElement('div'); el.id = 'cn-savedpanel'; el.className = 'cn-panel';
      el.onclick = function (e) { if (e.target === el) V2.carteToursClose(); };
      document.body.appendChild(el);
    }
    renderSavedPanel();
  };
  V2.carteToursClose = function () { var el = document.getElementById('cn-savedpanel'); if (el) el.remove(); };
  V2.carteTourLoad = function (id) {
    var all = loadTours(), t = null;
    for (var i = 0; i < all.length; i++) if (all[i].id === id) t = all[i];
    if (!t) return;
    tour = (t.tour || []).slice(); depot = t.depot || null;
    try { depot ? localStorage.setItem('jarvis_depot_v1', JSON.stringify(depot)) : localStorage.removeItem('jarvis_depot_v1'); } catch (e) {}
    saveTour(); updateTourBar(); rebuild(); drawTourLine();
    V2.carteToursClose(); V2.carteTourOpen(); V2.carteTourFit();
  };
  V2.carteTourDelete = function (id) {
    var all = loadTours().filter(function (t) { return t.id !== id; });
    writeTours(all); renderSavedPanel();
  };
  function renderSavedPanel() {
    var el = document.getElementById('cn-savedpanel'); if (!el) return;
    var all = loadTours();
    var rows = all.map(function (t) {
      var km = 0; var pts = []; if (t.depot) pts.push(t.depot); (t.tour || []).forEach(function (s) { pts.push(s); }); if (t.depot && (t.tour || []).length) pts.push(t.depot);
      for (var j = 1; j < pts.length; j++) km += haversine(pts[j - 1], pts[j]);
      return '<div class="cn-lrow"><div class="cn-lmain" onclick="V2.carteTourLoad(\'' + t.id + '\')">' +
        '<b>' + esc(t.name) + '</b>' +
        '<span class="cn-lsub">' + (t.tour || []).length + ' arrêt' + ((t.tour || []).length > 1 ? 's' : '') + ' · ~' + Math.round(km) + ' km' + (t.depot ? ' · ' + esc(t.depot.n || 'dépôt') : '') + '</span></div>' +
        '<button class="cn-trm" onclick="V2.carteTourDelete(\'' + t.id + '\')" title="Supprimer">✕</button></div>';
    }).join('') || '<div class="cn-tempty">Aucune tournée enregistrée.<br>Compose une tournée puis « Enregistrer ».</div>';
    el.innerHTML = '<div class="cn-pdialog" onclick="event.stopPropagation()">' +
      '<div class="cn-phead"><div><b>Mes tournées</b><small>' + all.length + ' enregistrée' + (all.length > 1 ? 's' : '') + '</small></div>' +
        '<button class="cn-px" onclick="V2.carteToursClose()">✕</button></div>' +
      '<div class="cn-plist">' + rows + '</div></div>';
  }
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
      '<div class="cn-pacts">' +
        (tour.length >= 2 ? '<button class="v2-btn v2-btn-primary" onclick="V2.carteTourOptimize()">Optimiser la tournée</button>' : '') +
        (tour.length >= 1 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteProspects()">Prospects proches</button>' : '') +
        (tour.length >= 1 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourSaveAs()">Enregistrer</button>' : '') +
        '<button class="v2-btn v2-btn-ghost" onclick="V2.carteToursOpen()">Mes tournées</button>' +
        (tour.length >= 1 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourItinerary()">Itinéraire GPS</button>' : '') +
        (tour.length >= 1 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourAgenda()">Agenda</button>' : '') +
        (tour.length >= 1 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourClear()">Vider</button>' : '') +
        '</div>' +
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
    if (colorMode === 'ca') return lg('#FCD34D', '< 2 k€') + lg('#F59E0B', '2–8 k€') + lg('#EA580C', '8–20 k€') + lg('#C7283D', '20–50 k€') + lg('#7A0C2E', '≥ 50 k€') + lg('#E2E6EC', 'Pas de CA');
    return '<span class="cn-lg-txt">' + (D ? D.uga.length : 0) + ' UGA · une couleur par secteur</span>';
  }

  function injectCss() {
    if (document.getElementById('v2-carte-css')) return;
    var s = document.createElement('style'); s.id = 'v2-carte-css';
    s.textContent = [
      '.cn-wrap{display:flex;flex-direction:row;height:calc(100vh - var(--topbar-h,60px));height:calc(100dvh - var(--topbar-h,60px));min-height:520px}',
      '.cn-side{width:288px;flex:none;overflow-y:auto;background:var(--card);border-right:1px solid var(--line);padding:16px 15px 22px;display:flex;flex-direction:column;gap:16px}',
      '.cn-sgroup{display:flex;flex-direction:column;gap:8px}',
      '.cn-seg-wrap{flex-wrap:wrap}',
      '.cn-side .cn-sel{max-width:none;width:100%}',
      '.cn-side .cn-search{width:100%}',
      '.cn-side .cn-legend{padding:0;border:none;background:none;flex-direction:column;gap:6px}',
      '.cn-lg-note{font-size:11.5px;color:var(--muted);font-weight:600;line-height:1.4}',
      '.cn-side .cn-tools{padding:0;border:none;background:none;flex-direction:column;align-items:stretch;gap:8px}',
      '.cn-side .cn-tools button{width:100%;text-align:left}',
      '@media(max-width:760px){.cn-wrap{flex-direction:column}.cn-side{width:100%;max-height:46vh;border-right:none;border-bottom:1px solid var(--line)}}',
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
      '.cn-tag.ca{background:#0A0E1A;color:#fff}',
      '.cn-fiche-btn{display:block;width:100%;margin-top:9px;padding:9px;border:none;border-radius:9px;background:var(--ip-blue);color:#fff;font:700 13px/1 inherit;cursor:pointer}',
      '.cn-fkpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:6px 16px 12px}',
      '.cn-fkpi{text-align:center;background:var(--card-2,#F4F6FB);border-radius:10px;padding:9px 4px}',
      '.cn-fkpi b{display:block;font-size:15px;font-weight:800;color:var(--ip-blue,#0057FF)}',
      '.cn-fkpi span{display:block;font-size:10.5px;color:var(--muted);margin-top:1px}',
      '.cn-fsec{padding:6px 16px 12px}.cn-fsec h4{margin:0 0 8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2)}',
      '.cn-fspark{display:flex;align-items:flex-end;gap:8px;height:64px}',
      '.cn-fbar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px}',
      '.cn-fbar i{width:100%;max-width:26px;background:linear-gradient(180deg,#3B82F6,var(--ip-blue));border-radius:4px 4px 0 0;display:block}',
      '.cn-fbar span{font-size:10px;color:var(--muted)}',
      '.cn-ftrow{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--line);font-size:12.5px}',
      '.cn-ftrow span{color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cn-ftrow b{color:var(--ip-ink);white-space:nowrap}',
      '.cn-sortlbl{font-size:11.5px;font-weight:700;color:var(--muted);margin-left:4px}',
      '.cn-sortseg button{font-size:12px;padding:5px 10px}',
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
      '.cn-prosbar{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--ip-ink)}',
      '.cn-prosbar input{flex:1}',
      '.cn-prow{display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}',
      '.cn-prow .cn-tmain{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.cn-prow .cn-tmain b{font-size:13.5px;font-weight:700}',
      '.cn-prow .cn-tmain span{font-size:11.5px;color:var(--muted)}',
      '.cn-padd{font-size:12.5px;font-weight:800;color:#C2410C;white-space:nowrap}',
      '.cn-paddbtn{flex:0 0 auto;padding:7px 11px;font-size:12px}',
      '.cn-search{font:inherit;font-size:13px;color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:var(--r-control,10px);padding:7px 11px;min-width:220px}',
      '.cn-listbtn{font:inherit;font-size:13px;font-weight:700;color:var(--ip-blue,#0057FF);background:var(--card);border:1px solid var(--line);border-radius:var(--r-control,10px);padding:7px 13px;cursor:pointer}',
      '.cn-listbtn:hover{border-color:var(--ip-blue,#0057FF)}',
      '.cn-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 16px;border-bottom:1px solid var(--line);background:var(--card)}',
      '.cn-tools button{font:inherit;font-size:12px;font-weight:700;color:var(--ip-ink);background:var(--card-2,#F4F6FB);border:1px solid var(--line);border-radius:999px;padding:5px 12px;cursor:pointer}',
      '.cn-tools button:hover{border-color:var(--ip-blue,#0057FF);color:var(--ip-blue,#0057FF)}',
      '.cn-listdlg{max-width:520px}',
      '.cn-lrow{display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid var(--line)}',
      '.cn-lmain{flex:1;min-width:0;cursor:pointer}',
      '.cn-lmain b{display:block;font-size:13.5px;font-weight:700;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cn-lsub{display:block;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cn-ltags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}',
      '.cn-ladd{flex:none;width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ip-blue,#0057FF);font-size:16px;font-weight:800;cursor:pointer}',
      '.cn-ladd.in{background:var(--ip-blue,#0057FF);color:#fff;border-color:var(--ip-blue,#0057FF)}',
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
      D.grp.filter(function (g) { return g && g !== '—'; })
        .sort(function (a, b) { return a.localeCompare(b, 'fr', { sensitivity: 'base' }); })
        .map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('');
    var depSet = {}; D.p.forEach(function (p) { var d = deptOf(p[8]); if (d) depSet[d] = 1; });
    var deptOpts = '<option value="">Tous les départements</option>' +
      Object.keys(depSet).sort().map(function (d) { return '<option value="' + d + '">' + d + ' · ' + esc(DEPT_NAMES[d] || '') + '</option>'; }).join('');
    root.querySelector('#cn-comm').innerHTML = commOpts;
    root.querySelector('#cn-deptsel').innerHTML = deptOpts;
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
  function dispBtn(k, lbl) { return '<button id="cd-' + k + '"' + (displayMode === k ? ' class="on"' : '') + ' onclick="V2.carteDisplay(\'' + k + '\')">' + lbl + '</button>'; }

  V2.pages.carte = {
    render: function (root) {
      injectCss();
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="cn-wrap">' +
          '<aside class="cn-side">' +
            '<div class="cn-title">Carte nationale <small id="carte-count">chargement…</small></div>' +
            '<div class="cn-sgroup"><span class="cn-lbl">Voir</span><div class="cn-seg">' + typeBtn('all', 'Tout') + typeBtn('clients', 'Clients') + typeBtn('prospects', 'Prospects') + '</div></div>' +
            '<div class="cn-sgroup"><span class="cn-lbl">Couleur</span><div class="cn-seg cn-seg-wrap">' + segBtn('comm', 'Commercial') + segBtn('type', 'Client/Prospect') + segBtn('ca', 'CA (taille)') + segBtn('uga', 'UGA') + segBtn('grp', 'Groupement') + '</div></div>' +
            '<div class="cn-sgroup"><span class="cn-lbl">Affichage</span><div class="cn-seg cn-seg-wrap">' + dispBtn('points', 'Points') + dispBtn('bulles', 'Bulles CA') + '</div></div>' +
            '<div class="cn-sgroup"><span class="cn-lbl">Filtrer</span>' +
              '<select id="cn-comm" class="cn-sel" onchange="V2.carteComm(this.value)"></select>' +
              '<select id="cn-deptsel" class="cn-sel" onchange="V2.carteDept(this.value)"></select>' +
              '<select id="cn-grpsel" class="cn-sel" onchange="V2.carteGrp(this.value)"></select></div>' +
            '<div class="cn-sgroup"><input id="cn-search" class="cn-search" type="search" placeholder="Chercher une pharmacie, une ville…" oninput="V2.carteSearch(this.value)">' +
              '<button class="cn-listbtn" onclick="V2.carteListOpen()">Liste des officines</button></div>' +
            '<div class="cn-sgroup"><span class="cn-lbl">Légende</span><div class="cn-legend" id="carte-legend"></div></div>' +
            '<div class="cn-sgroup cn-tools"><span class="cn-lbl">Outils terrain</span>' +
              '<button onclick="V2.carteTourOpen()">Ma tournée</button>' +
              '<button onclick="V2.go(\'pharma\',\'groupements\')">Listes d\'achats groupements</button>' +
              '<button onclick="V2.go(\'offilog\')">Prix concurrents</button>' +
            '</div>' +
          '</aside>' +
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
    ['comm', 'type', 'ca', 'uga', 'grp'].forEach(function (k) { var b = document.getElementById('cb-' + k); if (b) b.classList.toggle('on', k === m); });
    // Choisir une couleur n'a de sens qu'en mode Points : si on est en Bulles, on y revient pour que le clic ait un effet visible.
    if (displayMode !== 'points') { V2.carteDisplay('points'); return; }
    var lg = document.getElementById('carte-legend'); if (lg) lg.innerHTML = legendHtml(); recolor();
  };
  // Mode d'affichage : Points (marqueurs) · Bulles CA (taille = CA)
  V2.carteDisplay = function (m) {
    displayMode = m;
    ['points', 'bulles'].forEach(function (k) { var b = document.getElementById('cd-' + k); if (b) b.classList.toggle('on', k === m); });
    var lg = document.getElementById('carte-legend');
    if (lg) lg.innerHTML = (m === 'bulles') ? '<span class="cn-lg-note">Taille du point = chiffre d\'affaires</span>'
      : legendHtml();
    rebuild();
  };
  V2.carteType = function (t) {
    typeFocus = t;
    ['all', 'clients', 'prospects'].forEach(function (k) { var b = document.getElementById('ct-' + k); if (b) b.classList.toggle('on', k === t); });
    rebuild();
  };
  V2.carteComm = function (v) { commFocus = v || ''; rebuild(); if (document.getElementById('cn-listpanel')) renderListPanel(); };
  V2.carteGrp = function (v) { grpFocus = v || ''; rebuild(); if (document.getElementById('cn-listpanel')) renderListPanel(); };
  V2.carteDept = function (v) { deptFocus = v || ''; rebuild(); if (document.getElementById('cn-listpanel')) renderListPanel(); };
  var _searchTO = null;
  V2.carteSearch = function (v) {
    searchTerm = v || '';
    if (_searchTO) clearTimeout(_searchTO);
    _searchTO = setTimeout(function () { rebuild(); if (document.getElementById('cn-listpanel')) renderListPanel(); }, 220);
  };
  // ── LISTE-DONNÉES : voir précisément noms + infos, filtrable, cliquable ──
  function filtered() { var out = []; if (!D) return out; for (var i = 0; i < D.p.length; i++) if (pass(D.p[i])) out.push(i); return out; }
  V2.carteListOpen = function () {
    if (!document.getElementById('cn-listpanel')) {
      var el = document.createElement('div'); el.id = 'cn-listpanel'; el.className = 'cn-panel';
      el.onclick = function (e) { if (e.target === el) V2.carteListClose(); };
      document.body.appendChild(el);
    }
    renderListPanel();
  };
  V2.carteListClose = function () { var el = document.getElementById('cn-listpanel'); if (el) el.remove(); };
  V2.carteLocate = function (i) {
    var p = D.p[i]; if (!p || !map) return;
    map.setView([p[0], p[1]], 15, { animate: true });
    window.L.popup({ minWidth: 216 }).setLatLng([p[0], p[1]]).setContent(popupHtml(p, i)).openOn(map);
    V2.carteListClose();
  };
  function statusLabel(p) { return D.seg[p[4]] || '—'; }
  function renderListPanel() {
    var el = document.getElementById('cn-listpanel'); if (!el) return;
    var ids = filtered(), total = ids.length, cap = 400;
    if (listSort === 'ca') ids.sort(function (a, b) { return caOf(D.p[b]) - caOf(D.p[a]); });
    else ids.sort(function (a, b) { return norm(D.p[a][6]) < norm(D.p[b][6]) ? -1 : 1; });
    var shown = ids.slice(0, cap);
    var rows = shown.map(function (i) {
      var p = D.p[i], cl = isClient(p), pr = D.seg[p[4]] === 'Prospect', inT = tourPos(keyOf(p)) >= 0;
      var comm = p[5] ? D.comm[p[5]] : '';
      return '<div class="cn-lrow">' +
        '<div class="cn-lmain" onclick="V2.carteFiche(' + i + ')">' +
          '<b>' + esc(p[6] || 'Pharmacie') + '</b>' +
          '<span class="cn-lsub">' + esc(p[7]) + (p[8] ? ' · ' + esc(p[8]) : '') + (p[10] ? ' · ' + esc(p[10]) : '') + '</span>' +
          '<span class="cn-ltags">' +
            '<span class="cn-tag ' + (cl ? 'cl' : (pr ? 'pr' : '')) + '">' + esc(statusLabel(p)) + '</span>' +
            (caOf(p) > 0 ? '<span class="cn-tag ca">CA ' + eurK(caOf(p)) + '</span>' : '') +
            (comm ? '<span class="cn-tag co">' + esc(comm) + '</span>' : '') +
            (D.grp[p[3]] && D.grp[p[3]] !== '—' ? '<span class="cn-tag">' + esc(D.grp[p[3]]) + '</span>' : '') +
            (p[9] ? '<span class="cn-tag">' + esc(p[9]) + '</span>' : '') +
          '</span>' +
        '</div>' +
        '<button class="cn-ladd' + (inT ? ' in' : '') + '" onclick="V2.carteTour(' + i + ');V2.carteListRefreshRow(' + i + ')" title="Tournée">' + (inT ? '✓' : '+') + '</button>' +
      '</div>';
    }).join('') || '<div class="cn-tempty">Aucune pharmacie ne correspond.<br>Change les filtres ou la recherche.</div>';
    el.innerHTML = '<div class="cn-pdialog cn-listdlg" onclick="event.stopPropagation()">' +
      '<div class="cn-phead"><div><b>Liste des pharmacies</b><small>' + total.toLocaleString('fr') + ' résultat' + (total > 1 ? 's' : '') + (total > cap ? ' · ' + cap + ' affichés (affine la recherche)' : '') + '</small></div>' +
        '<button class="cn-px" onclick="V2.carteListClose()">✕</button></div>' +
      '<div class="cn-prosbar"><input id="cn-search2" type="search" class="cn-search" style="flex:1" placeholder="Rechercher…" value="' + esc(searchTerm) + '" oninput="V2.carteSearch(this.value);document.getElementById(\'cn-search\')&&(document.getElementById(\'cn-search\').value=this.value)">' +
        '<span class="cn-sortlbl">Trier :</span><div class="cn-seg cn-sortseg"><button' + (listSort === 'nom' ? ' class="on"' : '') + ' onclick="V2.carteListSort(\'nom\')">Nom</button><button' + (listSort === 'ca' ? ' class="on"' : '') + ' onclick="V2.carteListSort(\'ca\')">CA</button></div></div>' +
      '<div class="cn-plist">' + rows + '</div></div>';
  }
  V2.carteListSort = function (s) { listSort = s; renderListPanel(); };
  V2.carteListRefreshRow = function () { if (document.getElementById('cn-listpanel')) renderListPanel(); };

  // ── FICHE OFFICINE : détail complet (CA mensuel, top produits, potentiel) ──
  var DETAIL = null;
  function ensureDetail(cb) {
    if (DETAIL) { cb(); return; }
    if (window.CARTE_DETAIL) { DETAIL = window.CARTE_DETAIL; cb(); return; }
    js('carte-detail.js' + CB, function () {});
    var t0 = Date.now(), iv = setInterval(function () {
      if (window.CARTE_DETAIL) { clearInterval(iv); DETAIL = window.CARTE_DETAIL; cb(); }
      else if (Date.now() - t0 > 12000) { clearInterval(iv); cb(); }
    }, 120);
  }
  V2.carteFiche = function (i) {
    if (!D || !D.p[i]) return;
    if (!document.getElementById('cn-fiche')) {
      var el = document.createElement('div'); el.id = 'cn-fiche'; el.className = 'cn-panel';
      el.onclick = function (e) { if (e.target === el) V2.carteFicheClose(); };
      document.body.appendChild(el);
    }
    document.getElementById('cn-fiche').innerHTML = '<div class="cn-pdialog" onclick="event.stopPropagation()"><div class="cn-tempty">Chargement de la fiche…</div></div>';
    ensureDetail(function () { renderFiche(i); });
  };
  V2.carteFicheClose = function () { var el = document.getElementById('cn-fiche'); if (el) el.remove(); };
  var FMO = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
  function renderFiche(i) {
    var el = document.getElementById('cn-fiche'); if (!el) return;
    var p = D.p[i], det = (DETAIL && p[13]) ? DETAIL[p[13]] : null;
    var comm = p[5] ? D.comm[p[5]] : '', inT = inTour(i);
    var spark = '';
    if (det && det.m) { var mx = Math.max.apply(null, det.m.concat([1])); spark = '<div class="cn-fspark">' + det.m.map(function (v, j) { var h = Math.round((v / mx) * 46) + 2; return '<div class="cn-fbar" title="' + FMO[j] + ' : ' + eurK(v) + '"><i style="height:' + h + 'px"></i><span>' + FMO[j] + '</span></div>'; }).join('') + '</div>'; }
    var top = (det && det.top && det.top.length) ? '<div class="cn-fsec"><h4>Top produits (CA)</h4>' + det.top.map(function (t) { return '<div class="cn-ftrow"><span>' + esc(t[0]) + '</span><b>' + eurK(t[1]) + '</b></div>'; }).join('') + '</div>' : '';
    var q = encodeURIComponent((p[6] || '') + ' ' + (p[7] || '') + ' ' + (p[8] || ''));
    el.innerHTML = '<div class="cn-pdialog" onclick="event.stopPropagation()">' +
      '<div class="cn-phead"><div><b>' + esc(p[6] || 'Pharmacie') + '</b>' + (p[10] ? '<small>' + esc(p[10]) + '</small>' : '') + '</div><button class="cn-px" onclick="V2.carteFicheClose()">✕</button></div>' +
      '<div class="cn-plist" style="padding:0">' +
        '<div class="cn-pop-a" style="padding:12px 16px 0">' + esc(p[7]) + (p[8] ? ' · ' + esc(p[8]) : '') + '</div>' +
        '<div class="cn-pop-tags" style="padding:8px 16px">' +
          '<span class="cn-tag ' + (isClient(p) ? 'cl' : (isProspect(p) ? 'pr' : '')) + '">' + esc(D.seg[p[4]]) + '</span>' +
          (comm ? '<span class="cn-tag co">' + esc(comm) + '</span>' : '') +
          '<span class="cn-tag">UGA ' + esc(D.uga[p[2]] || '—') + '</span>' +
          (D.grp[p[3]] && D.grp[p[3]] !== '—' ? '<span class="cn-tag">' + esc(D.grp[p[3]]) + '</span>' : '') +
        '</div>' +
        '<div class="cn-fkpis">' +
          '<div class="cn-fkpi"><b>' + eurK(caOf(p)) + '</b><span>CA (6 mois)</span></div>' +
          (det ? '<div class="cn-fkpi"><b>' + (det.np || 0) + '</b><span>références</span></div>' : '') +
          (det && det.pot ? '<div class="cn-fkpi"><b>' + eurK(det.pot) + '</b><span>potentiel</span></div>' : '') +
        '</div>' +
        (spark ? '<div class="cn-fsec"><h4>CA par mois</h4>' + spark + '</div>' : (caOf(p) ? '' : '<div class="cn-tempty" style="padding:18px 16px">Pas encore de ventes réseau pour cette officine.</div>')) +
        top +
        ((p[9] || p[11]) ? '<div class="cn-pop-contact" style="padding:10px 16px 14px">' + (p[9] ? '<a href="tel:' + esc((p[9] || '').replace(/[^0-9+]/g, '')) + '">' + esc(p[9]) + '</a>' : '') + (p[11] ? '<a href="mailto:' + esc(p[11]) + '">' + esc(p[11]) + '</a>' : '') + '</div>' : '') +
      '</div>' +
      '<div class="cn-pacts">' +
        '<button class="v2-btn ' + (inT ? 'v2-btn-ghost' : 'v2-btn-primary') + '" onclick="V2.carteTour(' + i + ');V2.carteFiche(' + i + ')">' + (inT ? '✓ Dans la tournée' : '+ Ajouter à la tournée') + '</button>' +
        '<a class="v2-btn v2-btn-ghost" href="https://www.google.com/maps/search/?api=1&query=' + q + '" target="_blank" rel="noopener">Google Maps</a>' +
      '</div></div>';
  }
})();
