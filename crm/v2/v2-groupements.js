/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Groupements" (pages.groupements)
   2 vues :
   · "Carte groupements" → l'app de prospection autonome (iframe groupements.html)
   · "PharmaSmile"       → carte Leaflet dédiée des 2011 pharmacies clientes
                           (scrape store-locator), couche à part.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  var view = 'app';
  var leafletLoading = false, _map = null, _cluster = null;

  if (!document.getElementById('v2-grp-css')) {
    var st = document.createElement('style'); st.id = 'v2-grp-css';
    st.textContent =
      '.grp-frame{width:100%;height:calc(100vh - 112px);border:0;display:block;background:#fff}' +
      '.grp-bar{display:flex;align-items:center;gap:10px;padding:8px 26px;background:var(--card);border-bottom:1px solid var(--line);font-size:12.5px;color:var(--muted)}' +
      '.grp-bar a{color:var(--ip-blue);font-weight:600;text-decoration:none}' +
      '.grp-tabs{display:flex;gap:6px;padding:10px 26px 0;background:var(--paper)}' +
      '.grp-tab{border:1px solid var(--line);border-bottom:none;background:var(--card-2);border-radius:11px 11px 0 0;padding:9px 16px;font-family:var(--font);font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;transition:.15s var(--ease)}' +
      '.grp-tab.on{background:var(--card);color:var(--ip-blue);box-shadow:0 -2px 0 var(--ip-blue) inset}' +
      '.ps-bar{display:flex;align-items:center;gap:11px;padding:10px 26px;background:var(--card);border-bottom:1px solid var(--line)}' +
      '.ps-bar svg{color:var(--ip-blue);flex-shrink:0}' +
      '.ps-bar input{border:none;outline:none;background:none;font-family:var(--font);font-size:15px;flex:1;color:var(--ip-ink)}' +
      '.ps-count{font-family:var(--mono);font-size:12.5px;font-weight:700;color:var(--ip-ink-2);white-space:nowrap}' +
      '.ps-map{width:100%;height:calc(100vh - 164px);background:#EAEEF3;position:relative}' +
      '.ps-map .leaflet-popup-content{font:13px/1.45 var(--font, sans-serif);margin:10px 12px}' +
      '.grp-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;gap:10px}';
    document.head.appendChild(st);
  }

  function ensureData(cb) {
    if (window.PHARMASMILE) { cb(); return; }
    var sc = document.createElement('script'); sc.src = 'pharmasmile-data.js?v=20260612a';
    sc.onload = cb; sc.onerror = cb; document.head.appendChild(sc);
  }
  function ensureLeaflet(cb) {
    if (window.L && window.L.markerClusterGroup) { cb(); return; }
    if (leafletLoading) { setTimeout(function () { ensureLeaflet(cb); }, 250); return; }
    leafletLoading = true;
    ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
     'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
     'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css'].forEach(function (href) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
    });
    var s1 = document.createElement('script'); s1.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s1.onload = function () {
      var s2 = document.createElement('script'); s2.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      s2.onload = function () { leafletLoading = false; cb(); };
      s2.onerror = function () { leafletLoading = false; cb(); };
      document.head.appendChild(s2);
    };
    s1.onerror = function () { leafletLoading = false; cb(); };
    document.head.appendChild(s1);
  }

  function addMarkers(rows) {
    if (!_cluster) return;
    _cluster.clearLayers();
    var ms = [];
    rows.forEach(function (r) {
      var m = window.L.marker([r[0], r[1]]);
      m.bindPopup('<b>' + esc(r[2]) + '</b><br>' + esc(r[3]) + '<br>' + esc(r[4]) + ' ' + esc(r[5]) + (r[6] ? '<br>☎ ' + esc(r[6]) : ''));
      ms.push(m);
    });
    _cluster.addLayers(ms);
  }
  function initMap() {
    var el = document.getElementById('ps-map'); if (!el) return;
    if (!window.L) { el.innerHTML = '<div class="grp-load">Carte indisponible — vérifie ta connexion internet.</div>'; return; }
    if (_map) { try { _map.remove(); } catch (e) {} _map = null; }
    el.innerHTML = '';
    _map = window.L.map(el, { scrollWheelZoom: true, preferCanvas: true }).setView([46.7, 2.4], 6);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap, © CARTO', maxZoom: 19 }).addTo(_map);
    _cluster = window.L.markerClusterGroup({ chunkedLoading: true, spiderfyOnMaxZoom: true });
    addMarkers(window.PHARMASMILE || []);
    _map.addLayer(_cluster);
    setTimeout(function () { try { _map.invalidateSize(); } catch (e) {} }, 120);
  }

  V2.grpView = function (v) { view = v; V2.render(); };
  V2.psFilter = function (q) {
    if (!window.PHARMASMILE || !_cluster) return;
    q = (q || '').toLowerCase().trim();
    var rows = q ? window.PHARMASMILE.filter(function (r) {
      return ((r[2] || '') + ' ' + (r[5] || '') + ' ' + (r[4] || '')).toLowerCase().indexOf(q) >= 0;
    }) : window.PHARMASMILE;
    addMarkers(rows);
    var c = document.getElementById('ps-count'); if (c) c.textContent = rows.length.toLocaleString('fr') + ' pharmacies';
  };

  function tabs() {
    return '<div class="grp-tabs">' +
      '<button class="grp-tab' + (view === 'app' ? ' on' : '') + '" onclick="V2.grpView(\'app\')">Carte groupements</button>' +
      '<button class="grp-tab' + (view === 'pharmasmile' ? ' on' : '') + '" onclick="V2.grpView(\'pharmasmile\')">PharmaSmile · 2 011 pharmacies</button>' +
      '</div>';
  }

  V2.pages.groupements = {
    render: function (root) {
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      if (view === 'pharmasmile') {
        root.innerHTML = top + tabs() +
          '<div class="ps-bar">' + ICO('search', 16, 2) +
            '<input id="ps-search" placeholder="Filtrer par nom, ville ou CP…" autocomplete="off" oninput="V2.psFilter(this.value)">' +
            '<span class="ps-count" id="ps-count">chargement…</span></div>' +
          '<div id="ps-map" class="ps-map"><div class="grp-load"><div class="v2-spinner"></div>Chargement de la carte…</div></div>';
        ensureData(function () {
          ensureLeaflet(function () {
            initMap();
            var c = document.getElementById('ps-count');
            if (c) c.textContent = (window.PHARMASMILE || []).length.toLocaleString('fr') + ' pharmacies';
          });
        });
      } else {
        root.innerHTML = top + tabs() +
          '<div class="grp-bar">' + ICO('grid', 15, 2) +
            '<span>Prospection groupements &amp; pharmacies</span>' +
            '<a href="groupements.html" target="_blank" rel="noopener" style="margin-left:auto">Ouvrir en plein écran ↗</a>' +
          '</div>' +
          '<iframe class="grp-frame" src="groupements.html?v=20260612a" title="Prospection groupements"></iframe>';
      }
    }
  };
})();
