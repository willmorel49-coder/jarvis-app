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
  var leafletLoading = false, _map = null, _cluster = null, _deptLayer = null, _rows = [];
  var deptSel = '', txtSel = '';

  var DEPT_NAMES = { '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Hte-Provence', '05': 'Hautes-Alpes', '06': 'Alpes-Maritimes', '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube', '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône', '14': 'Calvados', '15': 'Cantal', '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze', '21': "Côte-d'Or", '22': "Côtes-d'Armor", '23': 'Creuse', '24': 'Dordogne', '25': 'Doubs', '26': 'Drôme', '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère', '2A': 'Corse-du-Sud', '2B': 'Haute-Corse', '30': 'Gard', '31': 'Haute-Garonne', '32': 'Gers', '33': 'Gironde', '34': 'Hérault', '35': 'Ille-et-Vilaine', '36': 'Indre', '37': 'Indre-et-Loire', '38': 'Isère', '39': 'Jura', '40': 'Landes', '41': 'Loir-et-Cher', '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique', '45': 'Loiret', '46': 'Lot', '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire', '50': 'Manche', '51': 'Marne', '52': 'Haute-Marne', '53': 'Mayenne', '54': 'Meurthe-et-Moselle', '55': 'Meuse', '56': 'Morbihan', '57': 'Moselle', '58': 'Nièvre', '59': 'Nord', '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais', '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques', '65': 'Hautes-Pyrénées', '66': 'Pyrénées-Orientales', '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône', '70': 'Haute-Saône', '71': 'Saône-et-Loire', '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie', '75': 'Paris', '76': 'Seine-Maritime', '77': 'Seine-et-Marne', '78': 'Yvelines', '79': 'Deux-Sèvres', '80': 'Somme', '81': 'Tarn', '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse', '85': 'Vendée', '86': 'Vienne', '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne', '90': 'Belfort', '91': 'Essonne', '92': 'Hauts-de-Seine', '93': 'Seine-St-Denis', '94': 'Val-de-Marne', '95': "Val-d'Oise", '971': 'Guadeloupe', '972': 'Martinique', '973': 'Guyane', '974': 'La Réunion', '976': 'Mayotte' };
  function deptOf(cp) {
    cp = String(cp || '').replace(/\s/g, '');
    if (/^9[78]\d/.test(cp)) return cp.slice(0, 3);
    return cp.slice(0, 2);
  }

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
      '.ps-dept{font-family:var(--font);font-size:14px;font-weight:600;color:var(--ip-ink);background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:8px 11px;outline:none;cursor:pointer;max-width:230px}' +
      '.ps-dept:focus{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}' +
      '.grp-sub{display:flex;align-items:center;gap:10px;padding:9px 26px;background:var(--card);border-bottom:1px solid var(--line)}' +
      '.grp-sub-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}' +
      '.grp-chip{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 15px;font-family:var(--font);font-size:13px;font-weight:700;color:var(--muted);cursor:pointer}' +
      '.grp-chip.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}' +
      '.ps-map{width:100%;height:calc(100vh - 210px);background:#EAEEF3;position:relative}' +
      '.sag-split{display:flex;height:calc(100vh - 210px)}' +
      '@media(max-width:820px){.sag-split{flex-direction:column;height:auto}}' +
      '.sag-list{width:380px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--line);background:var(--card)}' +
      '@media(max-width:820px){.sag-list{width:100%;max-height:42vh;border-right:none;border-bottom:1px solid var(--line)}}' +
      '.sag-map{flex:1;min-width:0;background:#EAEEF3;position:relative}' +
      '@media(max-width:820px){.sag-map{height:52vh}}' +
      '.sag-row{padding:10px 16px;border-bottom:1px solid var(--line-2);cursor:pointer;transition:background .12s}' +
      '.sag-row:hover{background:var(--card-2)}' +
      '.sag-row-n{font-weight:700;font-size:13.5px;color:var(--ip-ink);letter-spacing:-.01em}' +
      '.sag-row-a{font-size:12px;color:var(--muted);margin-top:2px}' +
      '.sag-row-t{font-size:11.5px;color:var(--ip-blue);margin-top:2px}' +
      '.sag-more{padding:14px 16px;text-align:center;font-size:12px;color:var(--muted)}' +
      '.ps-map .leaflet-popup-content{font:13px/1.45 var(--font, sans-serif);margin:10px 12px}' +
      '.grp-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;gap:10px}' +
      // pastilles par département (horizontales, ultra lisibles)
      '.ps-deptbubble-wrap{background:transparent;border:none}' +
      '.ps-deptbubble{display:inline-flex;align-items:stretch;height:26px;background:#fff;border:2px solid var(--ip-blue);border-radius:999px;box-shadow:0 2px 8px rgba(16,19,28,.35);overflow:hidden;cursor:pointer;font-family:var(--font);font-variant-numeric:tabular-nums;transition:transform .12s var(--ease)}' +
      '.ps-deptbubble:hover{transform:scale(1.1)}' +
      '.ps-deptbubble-d{display:flex;align-items:center;background:var(--ip-blue);color:#fff;font-weight:800;font-size:13.5px;letter-spacing:-.01em;padding:0 7px}' +
      '.ps-deptbubble-n{display:flex;align-items:center;color:var(--ip-ink);font-weight:800;font-size:13.5px;padding:0 8px}' +
      // ── Cartographie groupements (carte France + légende à cocher) ──
      '.gc-split{display:flex;height:calc(100vh - 168px)}' +
      '@media(max-width:820px){.gc-split{flex-direction:column;height:auto}}' +
      '.gc-panel{width:300px;flex:none;display:flex;flex-direction:column;border-right:1px solid var(--line);background:var(--card)}' +
      '@media(max-width:820px){.gc-panel{width:100%;max-height:40vh;border-right:none;border-bottom:1px solid var(--line)}}' +
      '.gc-tools{padding:10px 12px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.gc-search{display:flex;align-items:center;gap:7px;flex:1;min-width:140px;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:6px 10px}' +
      '.gc-search svg{color:var(--ip-blue);flex:none}' +
      '.gc-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:13.5px;flex:1;color:var(--ip-ink)}' +
      '.gc-allbtns{display:flex;gap:5px}' +
      '.gc-allbtns button{border:1px solid var(--line-strong);background:var(--card);border-radius:8px;padding:6px 10px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--muted);cursor:pointer}' +
      '.gc-allbtns button:hover{color:var(--ip-blue);border-color:var(--ip-blue)}' +
      '.gc-list{flex:1;overflow-y:auto}' +
      '.gc-row{display:flex;align-items:center;gap:9px;padding:8px 13px;border-bottom:1px solid var(--line-2,var(--line));cursor:pointer;font-size:13px}' +
      '.gc-row:hover{background:var(--card-2)}' +
      '.gc-row input{width:16px;height:16px;accent-color:var(--ip-blue);cursor:pointer;flex:none}' +
      '.gc-dot{width:10px;height:10px;border-radius:50%;flex:none}' +
      '.gc-nm{flex:1;min-width:0;font-weight:600;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.gc-ct{font-family:var(--mono);font-size:11px;color:var(--muted);font-weight:700}' +
      '.gc-mapwrap{flex:1;min-width:0;position:relative;background:#EAEEF3}' +
      '@media(max-width:820px){.gc-mapwrap{height:56vh}}' +
      '.gc-map{position:absolute;inset:0}' +
      '.gc-mapwrap .leaflet-popup-content{font:13px/1.45 var(--font,sans-serif);margin:10px 12px}';
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

  // ════════════════════════════════════════════════════════════════
  // CARTOGRAPHIE GROUPEMENTS — carte de France, tous les points, légende à cocher
  // ════════════════════════════════════════════════════════════════
  var GP = null;                         // points.json : [lat,lng,nom,groupement,cp,ville,tel,adr]
  var gcMap = null, gcCluster = null, gcMarkers = null;   // gcMarkers[grp] = [circleMarkers]
  var gcChecked = null, gcCounts = null, gcOrder = null;  // état légende

  function ensureGrpPoints(cb) {
    if (GP) { cb(); return; }
    fetch('points.json?v=2', { cache: 'force-cache' })
      .then(function (r) { return r.json(); })
      .then(function (j) { GP = Array.isArray(j) ? j : []; cb(); })
      .catch(function () { GP = []; cb(); });
  }
  function grpColor(name) {
    var h = 0; name = String(name || '');
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',62%,46%)';
  }
  function gcMeta() {
    gcCounts = {};
    for (var i = 0; i < GP.length; i++) { var g = GP[i][3] || '—'; gcCounts[g] = (gcCounts[g] || 0) + 1; }
    gcOrder = Object.keys(gcCounts).sort(function (a, b) { return gcCounts[b] - gcCounts[a]; });
    if (!gcChecked) { gcChecked = {}; gcOrder.forEach(function (g) { gcChecked[g] = true; }); } // tout affiché par défaut
  }
  function gcInitMap() {
    var el = document.getElementById('gc-map'); if (!el || !window.L) return;
    if (gcMap) { try { gcMap.remove(); } catch (e) {} gcMap = null; }
    gcMap = window.L.map(el, { scrollWheelZoom: true, preferCanvas: true }).setView([46.6, 2.4], 6);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' }).addTo(gcMap);
    gcCluster = window.L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 48, spiderfyOnMaxZoom: true });
    var canvas = window.L.canvas({ padding: 0.5 });
    gcMarkers = {};
    for (var i = 0; i < GP.length; i++) {
      var p = GP[i], lat = p[0], lng = p[1];
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      var g = p[3] || '—', col = grpColor(g);
      var m = window.L.circleMarker([lat, lng], { renderer: canvas, radius: 5, color: '#fff', weight: 1, fillColor: col, fillOpacity: 0.9 });
      m.bindPopup('<b>' + esc(p[2] || '') + '</b><br>' + esc(((p[7] || '') + ', ' + (p[4] || '') + ' ' + (p[5] || '')).replace(/^, /, '')) +
        '<br><span style="color:' + col + ';font-weight:700">' + esc(g) + '</span>' + (p[6] ? '<br>' + esc(p[6]) : ''));
      (gcMarkers[g] = gcMarkers[g] || []).push(m);
    }
    gcMap.addLayer(gcCluster);
    gcRefreshAll();
  }
  function gcRefreshAll() {
    if (!gcCluster) return;
    gcCluster.clearLayers();
    var all = [];
    gcOrder.forEach(function (g) { if (gcChecked[g]) all = all.concat(gcMarkers[g] || []); });
    gcCluster.addLayers(all);
  }
  V2.gcToggle = function (idx) {
    var g = gcOrder[idx]; if (!g) return;
    gcChecked[g] = !gcChecked[g];
    if (!gcCluster || !gcMarkers) return;
    if (gcChecked[g]) gcCluster.addLayers(gcMarkers[g] || []);
    else gcCluster.removeLayers(gcMarkers[g] || []);
  };
  V2.gcAll = function (on) {
    gcOrder.forEach(function (g) { gcChecked[g] = !!on; });
    Array.prototype.forEach.call(document.querySelectorAll('.gc-row input'), function (cb) { cb.checked = !!on; });
    gcRefreshAll();
  };
  V2.gcSearch = function (q) {
    q = (q || '').toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll('.gc-row'), function (row) {
      var nm = (row.getAttribute('data-nm') || '');
      row.style.display = (!q || nm.indexOf(q) >= 0) ? '' : 'none';
    });
  };
  function gcLegend() {
    return gcOrder.map(function (g, i) {
      return '<label class="gc-row" data-nm="' + esc(g.toLowerCase()) + '">' +
        '<input type="checkbox"' + (gcChecked[g] ? ' checked' : '') + ' onchange="V2.gcToggle(' + i + ')">' +
        '<span class="gc-dot" style="background:' + grpColor(g) + '"></span>' +
        '<span class="gc-nm">' + esc(g) + '</span><span class="gc-ct">' + gcCounts[g] + '</span></label>';
    }).join('');
  }
  function renderGrpCarte(root) {
    var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
    root.innerHTML = top + V2.grpSpaceTabs('carte') +
      '<div class="gc-split">' +
        '<div class="gc-panel">' +
          '<div class="gc-tools">' +
            '<div class="gc-search">' + ICO('search', 16, 2) + '<input placeholder="Chercher un groupement…" oninput="V2.gcSearch(this.value)" autocomplete="off"></div>' +
            '<div class="gc-allbtns"><button onclick="V2.gcAll(true)">Tout</button><button onclick="V2.gcAll(false)">Aucun</button></div>' +
          '</div>' +
          '<div class="gc-list" id="gc-list"><div class="grp-load"><div class="v2-spinner"></div>Chargement…</div></div>' +
        '</div>' +
        '<div class="gc-mapwrap"><div id="gc-map" class="gc-map"></div><div class="grp-load" id="gc-maploader"><div class="v2-spinner"></div>Chargement de la carte…</div></div>' +
      '</div>';
    ensureGrpPoints(function () {
      gcMeta();
      var lst = document.getElementById('gc-list'); if (lst) lst.innerHTML = gcLegend();
      ensureLeaflet(function () {
        var ld = document.getElementById('gc-maploader'); if (ld) ld.style.display = 'none';
        gcInitMap();
      });
    });
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
  // Bulles agrégées par département : n° + nombre de pharmacies, au centroïde
  function addDeptBubbles(rows) {
    if (!_deptLayer) return;
    _deptLayer.clearLayers();
    var agg = {};
    rows.forEach(function (r) {
      var d = deptOf(r[4]); if (!d) return;
      var a = agg[d] || (agg[d] = { la: 0, lo: 0, n: 0 });
      a.la += r[0]; a.lo += r[1]; a.n++;
    });
    Object.keys(agg).forEach(function (d) {
      var a = agg[d], lat = a.la / a.n, lng = a.lo / a.n;
      var cnt = '' + a.n;
      // largeur estimée de la pastille (puce dépt + nombre) pour bien centrer
      var w = 14 + d.length * 8.5 + 16 + cnt.length * 8.5, h = 26;
      var ic = window.L.divIcon({
        className: 'ps-deptbubble-wrap',
        html: '<div class="ps-deptbubble"><span class="ps-deptbubble-d">' + d + '</span><span class="ps-deptbubble-n">' + cnt + '</span></div>',
        iconSize: [Math.round(w), h], iconAnchor: [Math.round(w / 2), h / 2]
      });
      var m = window.L.marker([lat, lng], {
        icon: ic, riseOnHover: true,
        zIndexOffset: a.n,   // les départements avec le plus de pharmacies passent au-dessus
        title: d + (DEPT_NAMES[d] ? ' · ' + DEPT_NAMES[d] : '') + ' — ' + a.n + ' pharmacies'
      });
      m.on('click', function () { V2.psDeptZoom(d); });
      _deptLayer.addLayer(m);
    });
  }
  // listing complet (synchronisé avec la carte)
  function buildList(rows) {
    var box = document.getElementById('sag-list'); if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="grp-load">Aucune pharmacie.</div>'; return; }
    var max = 1500, shown = rows.slice(0, max);
    var html = shown.map(function (r, i) {
      return '<div class="sag-row" onclick="V2.psFocus(' + i + ')">' +
        '<div class="sag-row-n">' + esc(r[2] || '—') + '</div>' +
        '<div class="sag-row-a">' + esc(r[3] || '') + (r[3] && (r[4] || r[5]) ? ' · ' : '') + esc(r[4] || '') + ' ' + esc(r[5] || '') + '</div>' +
        (r[6] ? '<div class="sag-row-t mono">' + esc(r[6]) + '</div>' : '') +
        '</div>';
    }).join('');
    if (rows.length > max) html += '<div class="sag-more">+ ' + (rows.length - max).toLocaleString('fr') + ' autres — affine la recherche</div>';
    box.innerHTML = html;
    box.scrollTop = 0;
  }
  V2.psFocus = function (i) {
    var r = _rows[i]; if (!r || !_map) return;
    _map.setView([r[0], r[1]], 15);
    window.L.popup().setLatLng([r[0], r[1]])
      .setContent('<b>' + esc(r[2]) + '</b><br>' + esc(r[3]) + '<br>' + esc(r[4]) + ' ' + esc(r[5]) + (r[6] ? '<br>☎ ' + esc(r[6]) : ''))
      .openOn(_map);
  };
  function initMap() {
    var el = document.getElementById('ps-map'); if (!el) return;
    if (!window.L) { el.innerHTML = '<div class="grp-load">Carte indisponible — vérifie ta connexion internet.</div>'; return; }
    if (_map) { try { _map.remove(); } catch (e) {} _map = null; }
    el.innerHTML = '';
    _map = window.L.map(el, { scrollWheelZoom: true, preferCanvas: true }).setView([46.7, 2.4], 6);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap, © CARTO', maxZoom: 19 }).addTo(_map);
    _cluster = window.L.markerClusterGroup({ chunkedLoading: true, spiderfyOnMaxZoom: true });
    _map.addLayer(_cluster);
    _deptLayer = window.L.layerGroup();
    _map.addLayer(_deptLayer);
    applyFilter();
    setTimeout(function () { try { _map.invalidateSize(); } catch (e) {} }, 120);
  }

  function applyFilter() {
    if (!window.PHARMASMILE) return;
    var ql = (txtSel || '').toLowerCase().trim();
    _rows = window.PHARMASMILE.filter(function (r) {
      if (deptSel && deptOf(r[4]) !== deptSel) return false;
      if (ql && ((r[2] || '') + ' ' + (r[5] || '') + ' ' + (r[3] || '')).toLowerCase().indexOf(ql) < 0) return false;
      return true;
    });
    // Vue par défaut (aucun dépt, aucune recherche) = bulles par département.
    // Dès qu'on choisit un département ou qu'on cherche = points individuels.
    var bubbles = !deptSel && !ql;
    if (_cluster) _cluster.clearLayers();
    if (_deptLayer) _deptLayer.clearLayers();
    if (bubbles) addDeptBubbles(_rows); else addMarkers(_rows);
    buildList(_rows);
    var c = document.getElementById('ps-count'); if (c) c.textContent = _rows.length.toLocaleString('fr') + ' pharmacies';
    if (bubbles && _map) {
      try { _map.setView([46.7, 2.4], 6); } catch (e) {}
    } else if (deptSel && _rows.length && _map) {
      try { _map.fitBounds(_rows.map(function (r) { return [r[0], r[1]]; }), { padding: [30, 30], maxZoom: 11 }); } catch (e) {}
    }
  }
  function fillDeptSelect() {
    var sel = document.getElementById('ps-dept'); if (!sel || !window.PHARMASMILE) return;
    var by = {};
    window.PHARMASMILE.forEach(function (r) { var d = deptOf(r[4]); if (d) by[d] = (by[d] || 0) + 1; });
    var codes = Object.keys(by).sort();
    var opts = '<option value="">Tous les départements (' + window.PHARMASMILE.length.toLocaleString('fr') + ')</option>';
    opts += codes.map(function (d) {
      return '<option value="' + d + '"' + (d === deptSel ? ' selected' : '') + '>' + d + (DEPT_NAMES[d] ? ' · ' + esc(DEPT_NAMES[d]) : '') + ' (' + by[d] + ')</option>';
    }).join('');
    sel.innerHTML = opts;
  }
  V2.grpView = function (v) { view = v; V2.render(); };
  V2.psDept = function (v) { deptSel = v || ''; applyFilter(); };
  V2.psDeptZoom = function (d) {
    deptSel = d || '';
    var sel = document.getElementById('ps-dept'); if (sel) sel.value = deptSel;
    applyFilter();
  };
  V2.psFilter = function (q) { txtSel = q || ''; applyFilter(); };

  // Onglets de l'ESPACE Groupements (partagés avec la vue "Opportunités groupements" du pilier pharma)
  // active : 'carte' | 'grossistes' | 'opp'
  V2.grpSpaceTabs = function (active) {
    return '<div class="grp-tabs">' +
      '<button class="grp-tab' + (active === 'carte' ? ' on' : '') + '" onclick="V2.grpGo(\'app\')">Cartographie</button>' +
      '<button class="grp-tab' + (active === 'grossistes' ? ' on' : '') + '" onclick="V2.grpGo(\'grossistes\')">Grossistes</button>' +
      '<button class="grp-tab' + (active === 'opp' ? ' on' : '') + '" onclick="V2.go(\'pharma\',\'groupements\')">Opportunités groupements</button>' +
      '</div>';
  };
  // navigue vers la carte groupements en réglant la sous-vue (depuis n'importe quelle page)
  V2.grpGo = function (v) { view = v; V2.go('groupements'); };
  function tabs() { return V2.grpSpaceTabs(view === 'grossistes' ? 'grossistes' : 'carte'); }

  V2.pages.groupements = {
    render: function (root) {
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      if (view === 'grossistes') {
        var nb = (window.PHARMASMILE || []).length;
        root.innerHTML = top + tabs() +
          '<div class="grp-sub"><span class="grp-sub-l">Grossiste</span>' +
            '<button class="grp-chip on">Sagitta' + (nb ? ' · ' + nb.toLocaleString('fr') : '') + '</button></div>' +
          '<div class="ps-bar">' +
            '<select id="ps-dept" class="ps-dept" onchange="V2.psDept(this.value)"><option value="">Tous les départements</option></select>' +
            ICO('search', 16, 2) +
            '<input id="ps-search" placeholder="ville ou nom…" autocomplete="off" oninput="V2.psFilter(this.value)">' +
            '<span class="ps-count" id="ps-count">chargement…</span></div>' +
          '<div class="sag-split">' +
            '<div class="sag-list" id="sag-list"><div class="grp-load"><div class="v2-spinner"></div>Chargement…</div></div>' +
            '<div id="ps-map" class="sag-map"><div class="grp-load"><div class="v2-spinner"></div>Chargement de la carte…</div></div>' +
          '</div>';
        ensureData(function () {
          fillDeptSelect();
          ensureLeaflet(function () { initMap(); });
        });
      } else {
        renderGrpCarte(root);   // carte de France native : tous les groupements, légende à cocher
      }
    }
  };
})();
