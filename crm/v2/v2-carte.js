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

  var CB = '?v=20260707m';
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
    css(V + 'leaflet.css' + CB);
    css(V + 'MarkerCluster.css' + CB);
    css(V + 'MarkerCluster.Default.css' + CB);
    js(V + 'leaflet.js' + CB, function (e) {
      if (e || !window.L) { cb('err'); return; }
      js(V + 'leaflet.markercluster.js' + CB, function (e2) { cb(e2 || !window.L.markerClusterGroup ? 'err' : null); });
    });
  }
  function ensureData(cb) {
    if (window.PHARMA_FR) { cb(); return; }
    js('pharma-fr-data.js' + CB, function (e) { cb(e || !window.PHARMA_FR ? 'err' : null); });
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
    return '<div style="font-family:system-ui;font-size:13px;line-height:1.5;min-width:180px">' +
      '<b style="font-size:13.5px">' + esc(p[5]) + '</b><br>' +
      '<span style="color:#737A8C">' + esc(p[6]) + '</span><br>' +
      '<span style="color:#0050E6;font-weight:700">UGA ' + esc(D.uga[p[2]] || '—') + '</span> · ' + esc(D.grp[p[3]]) + '<br>' +
      '<span style="font-size:11.5px;color:#737A8C">' + esc(D.seg[p[4]]) + '</span></div>';
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
      '.cn-wrap{display:flex;flex-direction:column;height:calc(100vh - 60px);min-height:520px}',
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
      '#carte-map{flex:1;min-height:400px;background:#EAF0F6}',
      '.cn-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:var(--muted);z-index:5}',
      '.leaflet-popup-content{margin:10px 12px}',
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
          '<div style="position:relative;flex:1;min-height:400px"><div id="carte-map"></div>' +
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
