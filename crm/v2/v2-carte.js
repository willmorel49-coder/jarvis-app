/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Carte nationale des pharmacies par UGA (Copilote)
   ~23 000 officines (hors Corse) · Leaflet + clustering · couleur par
   UGA / groupement / segmentation. Données : pharma-fr-data.js (lazy).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function () { return V2.icon ? V2.icon.apply(null, arguments) : ''; };

  var CB = '?v=20260707r';
  var map = null, cluster = null, markers = null, D = null;
  var colorMode = 'uga', grpFocus = '';
  var GRP_COL = {}, canvas = null;
  var PALETTE = ['#0050E6', '#EA580C', '#0F7A52', '#7C3AED', '#C7283D', '#00B5D8', '#C7791A',
    '#DB2777', '#2563EB', '#16A34A', '#9333EA', '#DC2626', '#0891B2', '#CA8A04'];
  var SEG_COL = { 'Client': '#0F7A52', 'Prospect': '#0050E6' };

  // ── Chargement à la demande : Leaflet + markercluster (CDN) ──
  function css(href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
  function js(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = function () { cb('err'); }; document.head.appendChild(s); }
  function ensureLeaflet(cb) {
    if (window.L && window.L.markerClusterGroup) { cb(); return; }
    var V = 'vendor/leaflet/';
    function loadMC() {
      if (window.L.markerClusterGroup) { cb(); return; }
      js(V + 'leaflet.markercluster.js' + CB, function (e) { cb(e || !window.L.markerClusterGroup ? 'err' : null); });
    }
    if (window.L) { loadMC(); return; }   // Leaflet déjà là → ne PAS le recharger
    css(V + 'leaflet.css' + CB);
    css(V + 'MarkerCluster.css' + CB);
    css(V + 'MarkerCluster.Default.css' + CB);
    js(V + 'leaflet.js' + CB, function (e) {
      if (e || !window.L) { cb('err'); return; }
      loadMC();
    });
  }
  function ensureData(cb) {
    if (window.PHARMA_FR) { cb(); return; }
    var done = false, fin = function (e) { if (!done) { done = true; cb(e); } };
    var s = document.createElement('script'); s.src = 'pharma-fr-data.js' + CB;
    s.onload = function () { fin(window.PHARMA_FR ? null : 'err'); };
    s.onerror = function () { fin('err'); };
    document.head.appendChild(s);
    // filet de sécurité : on guette window.PHARMA_FR (le onload peut ne pas se propager)
    var t0 = Date.now(), iv = setInterval(function () {
      if (window.PHARMA_FR) { clearInterval(iv); fin(null); }
      else if (Date.now() - t0 > 25000) { clearInterval(iv); fin('err'); }
    }, 150);
  }

  function hsl(str) { var h = 0, i; str = String(str || ''); for (i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return 'hsl(' + h + ',62%,48%)'; }
  function colorFor(p) {
    if (colorMode === 'seg') return SEG_COL[D.seg[p[4]]] || '#AEB6C4';
    if (colorMode === 'grp') return GRP_COL[p[3]] || '#CBD2DD';
    return hsl(D.uga[p[2]] || '');
  }

  function computeGrpColors() {
    var cnt = {};
    D.p.forEach(function (p) { cnt[p[3]] = (cnt[p[3]] || 0) + 1; });
    var top = Object.keys(cnt).filter(function (g) { return D.grp[g] && D.grp[g] !== '—'; })
      .sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, PALETTE.length);
    GRP_COL = {}; top.forEach(function (g, i) { GRP_COL[g] = PALETTE[i]; });
    return top.map(function (g) { return { label: D.grp[g], color: PALETTE[+g] !== undefined ? GRP_COL[g] : GRP_COL[g], n: cnt[g] }; });
  }

  function popupHtml(p) {
    var q = encodeURIComponent((p[5] || '') + ' ' + (p[6] || '') + ' ' + (p[7] || ''));
    var gmaps = 'https://www.google.com/maps/search/?api=1&query=' + q;
    var dir = 'https://www.google.com/maps/dir/?api=1&destination=' + q;
    var tel = (p[8] || '').replace(/\s+/g, '');
    return '<div class="cn-pop">' +
      '<b class="cn-pop-n">' + esc(p[5] || 'Pharmacie') + '</b>' +
      '<div class="cn-pop-a">' + esc(p[6]) + (p[7] ? ' · ' + esc(p[7]) : '') + '</div>' +
      '<div class="cn-pop-t"><span class="cn-pop-uga">UGA ' + esc(D.uga[p[2]] || '—') + '</span> · ' + esc(D.grp[p[3]]) + ' · ' + esc(D.seg[p[4]]) + '</div>' +
      (tel ? '<a class="cn-pop-tel" href="tel:' + esc(tel) + '">' + esc(p[8]) + '</a>' : '') +
      '<div class="cn-pop-btns">' +
        '<a class="cn-pop-btn on" href="' + gmaps + '" target="_blank" rel="noopener">Google Maps</a>' +
        '<a class="cn-pop-btn" href="' + dir + '" target="_blank" rel="noopener">Itinéraire</a>' +
      '</div></div>';
  }

  function rebuild() {
    if (!map) return;
    if (cluster) { map.removeLayer(cluster); cluster = null; }
    cluster = window.L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 55, disableClusteringAtZoom: 11, removeOutsideVisibleBounds: true });
    cluster.on('click', function (e) { var p = D.p[e.layer._pi]; if (p) e.layer.bindPopup(popupHtml(p)).openPopup(); });
    markers = [];
    var pts = D.p, arr = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (grpFocus && D.grp[p[3]] !== grpFocus) continue;
      var m = window.L.circleMarker([p[0], p[1]], { renderer: canvas, radius: 4.5, color: '#fff', weight: 0.8, fillColor: colorFor(p), fillOpacity: 0.9 });
      m._pi = i; markers.push(m); arr.push(m);
    }
    cluster.addLayers(arr);
    map.addLayer(cluster);
    var cn = document.getElementById('carte-count'); if (cn) cn.textContent = markers.length.toLocaleString('fr') + ' pharmacies';
  }

  function legendHtml() {
    if (colorMode === 'seg') {
      return '<span class="cn-lg"><i style="background:' + SEG_COL.Client + '"></i>Client</span>' +
        '<span class="cn-lg"><i style="background:' + SEG_COL.Prospect + '"></i>Prospect</span>' +
        '<span class="cn-lg"><i style="background:#AEB6C4"></i>Non défini</span>';
    }
    if (colorMode === 'grp') {
      var top = Object.keys(GRP_COL).sort(function (a, b) { return 0; });
      return Object.keys(GRP_COL).map(function (g) { return '<span class="cn-lg"><i style="background:' + GRP_COL[g] + '"></i>' + esc(D.grp[g]) + '</span>'; }).join('') +
        '<span class="cn-lg"><i style="background:#CBD2DD"></i>Autres</span>';
    }
    return '<span class="cn-lg-txt">' + (D ? D.uga.length : 0) + ' UGA · une couleur par secteur</span>';
  }

  function injectCss() {
    if (document.getElementById('v2-carte-css')) return;
    var s = document.createElement('style'); s.id = 'v2-carte-css';
    s.textContent = [
      '.cn-wrap{display:flex;flex-direction:column;height:calc(100vh - 54px);height:calc(100dvh - 54px);min-height:520px}',
      '.cn-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--card)}',
      '.cn-title{font-weight:800;font-size:15px;color:var(--ip-ink);margin-right:auto;display:flex;align-items:baseline;gap:8px}',
      '.cn-title small{font-weight:600;font-size:12px;color:var(--muted)}',
      '.cn-seg{display:inline-flex;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-pill);padding:2px;gap:2px}',
      '.cn-seg button{border:none;background:transparent;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);padding:6px 12px;border-radius:var(--r-pill);cursor:pointer}',
      '.cn-seg button.on{background:var(--ip-blue);color:#fff}',
      '.cn-sel{font:inherit;font-size:13px;font-weight:600;color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:var(--r-control,10px);padding:7px 10px;max-width:200px}',
      '.cn-legend{display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px 16px;border-bottom:1px solid var(--line);background:var(--card-2)}',
      '.cn-lg{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:var(--ip-ink-2,#2A2F3C)}',
      '.cn-lg i{width:11px;height:11px;border-radius:50%;display:inline-block}',
      '.cn-lg-txt{font-size:12px;color:var(--muted);font-weight:600}',
      '.cn-maparea{position:relative;flex:1 1 auto;min-height:60vh}',
      '#carte-map{position:absolute;inset:0;background:#EAF0F6}',
      '.cn-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:var(--muted);z-index:5;background:var(--card)}',
      '.leaflet-popup-content{margin:12px 14px}',
      '.cn-pop{font-family:var(--font,system-ui);min-width:190px}',
      '.cn-pop-n{font-size:14px;font-weight:800;color:#10131C;display:block}',
      '.cn-pop-a{font-size:12px;color:#737A8C;margin-top:1px}',
      '.cn-pop-t{font-size:11.5px;color:#3A4150;margin-top:5px}',
      '.cn-pop-uga{color:#0050E6;font-weight:700}',
      '.cn-pop-tel{display:inline-block;margin-top:7px;font-size:12.5px;font-weight:700;color:#0F7A52;text-decoration:none}',
      '.cn-pop-btns{display:flex;gap:6px;margin-top:9px}',
      '.cn-pop-btn{flex:1;text-align:center;font-size:12px;font-weight:700;padding:7px 8px;border-radius:8px;text-decoration:none;border:1px solid #E2E7F0;color:#10131C}',
      '.cn-pop-btn.on{background:#0050E6;color:#fff;border-color:#0050E6}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function boot(root) {
    D = window.PHARMA_FR;
    var grpOpts = '<option value="">Tous les groupements</option>' +
      D.grp.map(function (g, i) { return g === '—' ? '' : '<option>' + esc(g) + '</option>'; }).join('');
    computeGrpColors();
    root.querySelector('#carte-legend').innerHTML = legendHtml();
    root.querySelector('#carte-grpsel').innerHTML = grpOpts;
    var mapEl = root.querySelector('#carte-map');
    map = window.L.map(mapEl, { preferCanvas: true, zoomControl: true, attributionControl: false }).setView([46.6, 2.5], 6);
    canvas = window.L.canvas({ padding: 0.5 });
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18, subdomains: 'abcd' }).addTo(map);
    setTimeout(function () { map.invalidateSize(); rebuild(); }, 60);
    setTimeout(function () { if (map) map.invalidateSize(); }, 400);   // filet : le conteneur peut se dimensionner tard
    if (!V2._carteResize) { V2._carteResize = true; window.addEventListener('resize', function () { if (map && V2.route && V2.route.name === 'carte') map.invalidateSize(); }); }
  }

  V2.pages.carte = {
    render: function (root) {
      injectCss();
      root.innerHTML = V2.topbar({ back: true, backTo: 'copilote', backLabel: 'Copilote' }) +
        '<div class="cn-wrap">' +
          '<div class="cn-bar">' +
            '<div class="cn-title">Carte nationale <small id="carte-count">chargement…</small></div>' +
            '<span style="font-size:12px;font-weight:700;color:var(--muted)">Couleur&nbsp;:</span>' +
            '<div class="cn-seg">' +
              '<button id="cb-uga" class="on" onclick="V2.carteColor(\'uga\')">UGA</button>' +
              '<button id="cb-grp" onclick="V2.carteColor(\'grp\')">Groupement</button>' +
              '<button id="cb-seg" onclick="V2.carteColor(\'seg\')">Segmentation</button>' +
            '</div>' +
            '<select id="carte-grpsel" class="cn-sel" onchange="V2.carteGrp(this.value)"></select>' +
          '</div>' +
          '<div class="cn-legend" id="carte-legend"></div>' +
          '<div class="cn-maparea"><div id="carte-map"></div>' +
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
    ['uga', 'grp', 'seg'].forEach(function (k) { var b = document.getElementById('cb-' + k); if (b) b.classList.toggle('on', k === m); });
    var lg = document.getElementById('carte-legend'); if (lg) lg.innerHTML = legendHtml();
    if (markers && D) { for (var k = 0; k < markers.length; k++) markers[k].setStyle({ fillColor: colorFor(D.p[markers[k]._pi]) }); }
  };
  V2.carteGrp = function (v) { grpFocus = v || ''; rebuild(); };
})();
