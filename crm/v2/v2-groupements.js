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
  // icône téléphone inline (indépendante du set ICO, pour rester valable dans une popup)
  var TEL_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  // téléphone cliquable (tel:) — nettoie les espaces pour le href, garde l'affichage lisible
  function telLink(tel) {
    tel = String(tel || '').trim(); if (!tel) return '';
    var href = tel.replace(/[^\d+]/g, '');
    return '<a class="gp-pop-tel" href="tel:' + esc(href) + '">' + TEL_SVG + esc(tel) + '</a>';
  }
  // popup pharmacie soignée : nom · adresse · puce groupement colorée · téléphone cliquable
  function pharmaPopup(o) {
    // o = { nom, adr, cp, ville, grp, col, tel }
    var addr = ((o.adr || '') + (o.adr && (o.cp || o.ville) ? ', ' : '') + (o.cp || '') + ' ' + (o.ville || '')).replace(/^, /, '').trim();
    return '<div class="gp-pop"' + (o.col ? ' style="--gpc:' + o.col + '"' : '') + '>' +
      '<div class="gp-pop-nm">' + esc(o.nom || '—') + '</div>' +
      (addr ? '<div class="gp-pop-ad">' + esc(addr) + '</div>' : '') +
      (o.grp ? '<div class="gp-pop-grp"><span class="d"></span>' + esc(o.grp) + '</div>' : '') +
      (o.tel ? '<div>' + telLink(o.tel) + '</div>' : '') +
    '</div>';
  }

  if (!document.getElementById('v2-grp-css')) {
    var st = document.createElement('style'); st.id = 'v2-grp-css';
    st.textContent =
      '.grp-frame{width:100%;height:calc(100vh - 112px);border:0;display:block;background:#fff}' +
      '.grp-bar{display:flex;align-items:center;gap:10px;padding:8px 26px;background:var(--card);border-bottom:1px solid var(--line);font-size:12.5px;color:var(--muted)}' +
      '.grp-bar a{color:var(--ip-blue);font-weight:600;text-decoration:none}' +
      // ── En-tête d\'espace épuré : intro simple + navigation en pilules calmes ──
      '.grp-hd{padding:22px 26px 14px;background:var(--paper)}' +
      '.grp-hd-t{font-size:23px;font-weight:800;letter-spacing:-.025em;line-height:1.1;color:var(--ip-ink)}' +
      '.grp-hd-s{font-size:14px;color:var(--muted);font-weight:450;margin-top:4px;max-width:640px;line-height:1.5}' +
      '.grp-tabs{display:inline-flex;gap:4px;margin-top:16px;padding:4px;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1)}' +
      '.grp-tab{border:none;background:none;border-radius:var(--r-sm);padding:9px 17px;font-family:var(--font);font-size:13.5px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap;transition:color .18s var(--ease),background .18s var(--ease)}' +
      '.grp-tab:hover{color:var(--ip-ink);background:var(--card)}' +
      '.grp-tab.on{background:var(--ip-blue);color:#fff;box-shadow:var(--sh-1)}' +
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
      '.ps-map{width:100%;height:calc(100vh - 250px);background:#EAEEF3;position:relative}' +
      '.sag-split{display:flex;height:calc(100vh - 250px)}' +
      '@media(max-width:820px){.sag-split{flex-direction:column;height:auto}}' +
      '.sag-list{width:380px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--line);background:var(--card)}' +
      '@media(max-width:820px){.sag-list{width:100%;max-height:42vh;border-right:none;border-bottom:1px solid var(--line)}}' +
      '.sag-map{flex:1;min-width:0;background:#EAEEF3;position:relative}' +
      '@media(max-width:820px){.sag-map{height:52vh}}' +
      '.sag-row{padding:10px 16px;border-bottom:1px solid var(--line-2);cursor:pointer;transition:background .12s}' +
      '.sag-row:hover{background:var(--card-2)}' +
      '.sag-row-n{font-weight:700;font-size:13.5px;color:var(--ip-ink);letter-spacing:-.01em}' +
      '.sag-row-a{font-size:12px;color:var(--muted);margin-top:2px}' +
      '.sag-row-t{display:inline-flex;font-size:11.5px;color:var(--ip-blue);margin-top:3px;text-decoration:none;font-weight:700}' +
      '.sag-row-t:hover{text-decoration:underline}' +
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
      '.gc-split{display:flex;height:calc(100vh - 214px)}' +
      '@media(max-width:820px){.gc-split{flex-direction:column;height:auto}}' +
      '.gc-panel{width:322px;flex:none;display:flex;flex-direction:column;border-right:1px solid var(--line);background:var(--card)}' +
      '@media(max-width:820px){.gc-panel{width:100%;max-height:40vh;border-right:none;border-bottom:1px solid var(--line)}}' +
      '.gc-head{padding:16px 16px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:8px}' +
      '.gc-head .gc-head-ct{font-family:var(--mono);color:var(--ip-blue);letter-spacing:0;text-transform:none;font-weight:700}' +
      '.gc-tools{padding:6px 14px 12px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.gc-search{display:flex;align-items:center;gap:7px;flex:1;min-width:140px;background:var(--card-2);border:1px solid var(--line);border-radius:11px;padding:8px 11px;transition:border-color .18s var(--ease),box-shadow .18s var(--ease)}' +
      '.gc-search:focus-within{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}' +
      '.gc-search svg{color:var(--ip-blue);flex:none}' +
      '.gc-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:13.5px;flex:1;color:var(--ip-ink)}' +
      '.gc-allbtns{display:inline-flex;gap:0;border:1px solid var(--line-strong);border-radius:9px;overflow:hidden}' +
      '.gc-allbtns button{border:none;border-left:1px solid var(--line-strong);background:var(--card);padding:7px 11px;font-family:var(--font);font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;transition:color .16s var(--ease),background .16s var(--ease)}' +
      '.gc-allbtns button:first-child{border-left:none}' +
      '.gc-allbtns button:hover{color:var(--ip-blue);background:var(--halo)}' +
      '.gc-list{flex:1;overflow-y:auto}' +
      '.gc-row{display:flex;align-items:center;gap:11px;min-height:44px;padding:7px 14px;border-bottom:1px solid var(--line-2,var(--line));cursor:pointer;font-size:13.5px;-webkit-tap-highlight-color:transparent;transition:background .13s var(--ease)}' +
      '.gc-row:hover{background:var(--card-2)}' +
      '.gc-row:active{background:var(--halo)}' +
      // ligne décochée : atténuée pour lire d\'un coup d\'oeil ce qui est visible sur la carte
      '.gc-row:has(input:not(:checked)){opacity:.5}' +
      '.gc-row:has(input:not(:checked)):hover{opacity:.8}' +
      '.gc-row input{width:19px;height:19px;accent-color:var(--ip-blue);cursor:pointer;flex:none}' +
      '.gc-dot{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,.9) inset,0 0 0 1.5px var(--line-strong),0 1px 2px rgba(16,19,28,.18)}' +
      '.gc-nm{flex:1;min-width:0;font-weight:600;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.gc-ct{font-family:var(--mono);font-size:11px;color:var(--muted);font-weight:700;background:var(--card-2);border-radius:6px;padding:2px 7px;min-width:34px;text-align:center}' +
      '.gc-mapwrap{flex:1;min-width:0;position:relative;background:#EAEEF3}' +
      '@media(max-width:820px){.gc-mapwrap{height:56vh}}' +
      '.gc-map{position:absolute;inset:0}' +
      '.gc-mapwrap .leaflet-popup-content{font:13px/1.45 var(--font,sans-serif);margin:10px 12px}' +
      // popups + contrôles de zoom soignés (vaut pour les deux cartes)
      '.leaflet-popup-content-wrapper{border-radius:16px;box-shadow:0 12px 34px rgba(16,19,28,.20);border:1px solid var(--line);padding:2px}' +
      '.leaflet-popup-content b{font-size:14px;letter-spacing:-.01em;color:var(--ip-ink)}' +
      '.leaflet-popup-tip{box-shadow:0 12px 34px rgba(16,19,28,.20)}' +
      '.leaflet-container a.leaflet-popup-close-button{width:30px;height:30px;font-size:20px;color:var(--muted);padding:5px 0 0}' +
      '.leaflet-control-zoom a{width:40px;height:40px;line-height:40px;font-size:20px;color:var(--ip-ink)}' +
      // contenu de popup structuré (nom + adresse + puce groupement + téléphone cliquable)
      '.gp-pop{min-width:186px}' +
      '.gp-pop-nm{font-size:14px;font-weight:800;color:var(--ip-ink);letter-spacing:-.01em;line-height:1.25}' +
      '.gp-pop-ad{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.4}' +
      '.gp-pop-grp{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:11.5px;font-weight:800;padding:3px 9px;border-radius:999px;background:color-mix(in srgb,var(--gpc,#0050E6) 12%,#fff);color:var(--gpc,#0050E6)}' +
      '.gp-pop-grp .d{width:8px;height:8px;border-radius:50%;background:var(--gpc,#0050E6)}' +
      '.gp-pop-tel{display:inline-flex;align-items:center;gap:7px;margin-top:9px;font-size:13px;font-weight:700;color:var(--ip-blue);text-decoration:none;padding:5px 10px 5px 8px;border-radius:9px;background:var(--halo);transition:background .16s var(--ease)}' +
      '.gp-pop-tel:hover{background:color-mix(in srgb,var(--ip-blue) 16%,#fff)}' +
      '.gp-pop-tel svg{flex:none}' +
      // Sagitta mobile : carte d'abord, barre de filtres qui passe à la ligne
      '@media(max-width:820px){.sag-map{order:-1}.ps-bar{flex-wrap:wrap}.ps-dept{flex:1 1 100%;max-width:none}}';
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
    ['vendor/leaflet/leaflet.css',
     'vendor/leaflet/MarkerCluster.css',
     'vendor/leaflet/MarkerCluster.Default.css'].forEach(function (href) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
    });
    var s1 = document.createElement('script'); s1.src = 'vendor/leaflet/leaflet.js';
    s1.onload = function () {
      var s2 = document.createElement('script'); s2.src = 'vendor/leaflet/leaflet.markercluster.js';
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
    fetch('points.json?v=6', { cache: 'force-cache' })
      .then(function (r) { return r.json(); })
      .then(function (j) { GP = Array.isArray(j) ? j : []; cb(); })
      .catch(function () { GP = []; cb(); });
  }
  var GC_PALETTE = ['#0050E6', '#E5484D', '#12A150', '#F5A524', '#8E51FF', '#00B8D9', '#EC4899', '#7A5C2E', '#0EA5E9', '#84CC16', '#F97316', '#6366F1'];
  function grpColor(name) {
    name = String(name || '');
    var idx = (gcOrder ? gcOrder.indexOf(name) : -1);   // index par poids -> les gros groupements ont des couleurs franches
    if (idx < 0) { var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; idx = h % 997; }
    if (idx < GC_PALETTE.length) return GC_PALETTE[idx];
    return 'hsl(' + Math.round((idx * 137.508) % 360) + ',58%,42%)';   // angle d'or : teintes maximalement espacées
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
      m.bindPopup(pharmaPopup({ nom: p[2], adr: p[7], cp: p[4], ville: p[5], grp: g, col: col, tel: p[6] }));
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
    // Affichage par ordre alphabétique (index conservé vers gcOrder pour le toggle & la couleur par poids).
    return gcOrder.map(function (g, i) { return { g: g, i: i }; })
      .sort(function (a, b) { return a.g.localeCompare(b.g, 'fr', { sensitivity: 'base' }); })
      .map(function (o) {
        var g = o.g;
        return '<label class="gc-row" data-nm="' + esc(g.toLowerCase()) + '">' +
          '<input type="checkbox"' + (gcChecked[g] ? ' checked' : '') + ' onchange="V2.gcToggle(' + o.i + ')">' +
          '<span class="gc-dot" style="background:' + grpColor(g) + '"></span>' +
          '<span class="gc-nm">' + esc(g) + '</span><span class="gc-ct">' + gcCounts[g] + '</span></label>';
      }).join('');
  }
  function renderGrpCarte(root) {
    var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
    root.innerHTML = top + V2.grpSpaceTabs('carte') +
      '<div class="gc-split">' +
        '<div class="gc-panel">' +
          '<div class="gc-head"><span>Cocher pour afficher</span><span class="gc-head-ct" id="gc-head-ct"></span></div>' +
          '<div class="gc-tools">' +
            '<div class="gc-search">' + ICO('search', 16, 2) + '<input placeholder="Chercher un groupement…" oninput="V2.gcSearch(this.value)" autocomplete="off"></div>' +
            '<div class="gc-allbtns"><button onclick="V2.gcAll(true)">Tout</button><button onclick="V2.gcAll(false)">Aucun</button></div>' +
          '</div>' +
          '<div class="gc-list" id="gc-list"><div class="grp-load"><div class="v2-spinner"></div>Chargement…</div></div>' +
        '</div>' +
        '<div class="gc-mapwrap"><div id="gc-map" class="gc-map"></div><div class="grp-load" id="gc-maploader"><div class="v2-spinner"></div>Chargement de la carte…</div></div>' +
      '</div>';
    // transition douce du panneau à l'arrivée sur l'onglet (conteneur UI, pas la carte)
    if (V2.motion) { var _sp = root.querySelector('.gc-split'); if (_sp) V2.motion.enter(_sp, { y: 8 }); }
    ensureGrpPoints(function () {
      gcMeta();
      var hc = document.getElementById('gc-head-ct');
      if (hc) hc.textContent = gcOrder.length + ' groupements · ' + GP.length.toLocaleString('fr') + ' pharmacies';
      var lst = document.getElementById('gc-list');
      if (lst) {
        lst.innerHTML = gcLegend();
        // cascade d'entrée sur les items de la légende à cocher
        if (V2.motion) V2.motion.stagger(lst.querySelectorAll('.gc-row'), { step: 22, cap: 14, y: 6 });
      }
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
      m.bindPopup(pharmaPopup({ nom: r[2], adr: r[3], cp: r[4], ville: r[5], tel: r[6] }));
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
        (r[6] ? '<a class="sag-row-t mono" href="tel:' + esc(String(r[6]).replace(/[^\d+]/g, '')) + '" onclick="event.stopPropagation()">' + esc(r[6]) + '</a>' : '') +
        '</div>';
    }).join('');
    if (rows.length > max) html += '<div class="sag-more">+ ' + (rows.length - max).toLocaleString('fr') + ' autres — affine la recherche</div>';
    box.innerHTML = html;
    box.scrollTop = 0;
    // cascade d'entrée sur les premières lignes visibles (conteneur UI, pas la carte)
    if (V2.motion) V2.motion.stagger(box.querySelectorAll('.sag-row'), { step: 18, cap: 12, y: 6 });
  }
  V2.psFocus = function (i) {
    var r = _rows[i]; if (!r || !_map) return;
    _map.setView([r[0], r[1]], 15);
    window.L.popup().setLatLng([r[0], r[1]])
      .setContent(pharmaPopup({ nom: r[2], adr: r[3], cp: r[4], ville: r[5], tel: r[6] }))
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
    return '<div class="grp-hd">' +
      '<div class="grp-hd-t">Groupements</div>' +
      '<div class="grp-hd-s">Repérez les pharmacies par groupement sur la carte, puis préparez vos listes d\'achats à proposer.</div>' +
      '<div class="grp-tabs" role="tablist">' +
        '<button class="grp-tab' + (active === 'carte' ? ' on' : '') + '" onclick="V2.grpGo(\'app\')">Carte des groupements</button>' +
        '<button class="grp-tab' + (active === 'opp' ? ' on' : '') + '" onclick="V2.go(\'pharma\',\'groupements\')">Listes d\'achats à proposer</button>' +
      '</div>' +
    '</div>';
  };
  // Onglets de l'espace CONCURRENTS / GROSSISTES (Prix concurrents = Offilog+Pharmazon, Sagitta = répartiteur)
  V2.concTabs = function (active) {
    return '<div class="grp-hd">' +
      '<div class="grp-hd-t">Grossistes et concurrents</div>' +
      '<div class="grp-hd-s">Comparez les prix des concurrents et suivez le répartiteur Sagitta près de chez vos clients.</div>' +
      '<div class="grp-tabs" role="tablist">' +
        '<button class="grp-tab' + (active === 'prix' ? ' on' : '') + '" onclick="V2.go(\'offilog\')">Prix concurrents</button>' +
        '<button class="grp-tab' + (active === 'sagitta' ? ' on' : '') + '" onclick="V2.go(\'sagitta\')">Répartiteur Sagitta</button>' +
      '</div>' +
    '</div>';
  };
  // navigue vers la carte groupements en réglant la sous-vue (depuis n'importe quelle page)
  V2.grpGo = function (v) { view = v; V2.go('groupements'); };
  function tabs() { return V2.grpSpaceTabs(view === 'grossistes' ? 'grossistes' : 'carte'); }

  V2.pages.groupements = {
    render: function (root) {
      renderGrpCarte(root);   // carte de France native : tous les groupements, légende à cocher
    }
  };

  // Sagitta = veille répartiteur, déplacée dans l'espace « Grossistes concurrents » (onglets V2.concTabs)
  V2.pages.sagitta = {
    render: function (root) {
      var top = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' });
      root.innerHTML = top + V2.concTabs('sagitta') +
        '<div class="ps-bar">' +
          '<select id="ps-dept" class="ps-dept" onchange="V2.psDept(this.value)"><option value="">Tous les départements</option></select>' +
          ICO('search', 16, 2) +
          '<input id="ps-search" placeholder="Chercher une ville ou une pharmacie…" autocomplete="off" oninput="V2.psFilter(this.value)">' +
          '<span class="ps-count" id="ps-count">chargement…</span></div>' +
        '<div class="sag-split">' +
          '<div class="sag-list" id="sag-list"><div class="grp-load"><div class="v2-spinner"></div>Chargement…</div></div>' +
          '<div id="ps-map" class="sag-map"><div class="grp-load"><div class="v2-spinner"></div>Chargement de la carte…</div></div>' +
        '</div>';
      // transition douce du panneau à l'arrivée sur l'onglet (conteneur UI, pas la carte)
      if (V2.motion) { var _ss = root.querySelector('.sag-split'); if (_ss) V2.motion.enter(_ss, { y: 8 }); }
      ensureData(function () {
        fillDeptSelect();
        ensureLeaflet(function () { initMap(); });
      });
    }
  };
})();
