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

  var CB = '?v=20260707t';
  var map = null, cluster = null, markers = null, D = null, canvas = null;
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
    if (window.L && window.L.markerClusterGroup) { cb(); return; }
    var V = 'vendor/leaflet/';
    function loadMC() { if (window.L.markerClusterGroup) { cb(); return; } js(V + 'leaflet.markercluster.js' + CB, function (e) { cb(e || !window.L.markerClusterGroup ? 'err' : null); }); }
    if (window.L) { loadMC(); return; }
    css(V + 'leaflet.css' + CB); css(V + 'MarkerCluster.css' + CB); css(V + 'MarkerCluster.Default.css' + CB);
    js(V + 'leaflet.js' + CB, function (e) { if (e || !window.L) { cb('err'); return; } loadMC(); });
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

  function hsl(str) { var h = 0, i; str = String(str || ''); for (i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return 'hsl(' + h + ',62%,48%)'; }
  function isClient(p) { return (D.seg[p[4]] || '').indexOf('Client') === 0; }
  function colorFor(p) {
    if (colorMode === 'comm') return p[5] ? (COMM_COL[p[5]] || '#94A3B8') : '#D4DAE3';
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

  function popupHtml(p) {
    var q = encodeURIComponent((p[6] || '') + ' ' + (p[7] || '') + ' ' + (p[8] || ''));
    var gmaps = 'https://www.google.com/maps/search/?api=1&query=' + q;
    var dir = 'https://www.google.com/maps/dir/?api=1&destination=' + q;
    var tel = (p[9] || '').replace(/[^0-9+]/g, '');
    var mail = p[11] || '', comm = p[5] ? D.comm[p[5]] : '';
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

  function rebuild() {
    if (!map) return;
    if (cluster) { map.removeLayer(cluster); cluster = null; }
    cluster = window.L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 52, disableClusteringAtZoom: 11, removeOutsideVisibleBounds: true });
    cluster.on('click', function (e) { var p = D.p[e.layer._pi]; if (p) e.layer.bindPopup(popupHtml(p), { minWidth: 210 }).openPopup(); });
    markers = [];
    var pts = D.p, arr = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i]; if (!pass(p)) continue;
      var m = window.L.circleMarker([p[0], p[1]], { renderer: canvas, radius: 4.5, color: '#fff', weight: 0.8, fillColor: colorFor(p), fillOpacity: 0.92 });
      m._pi = i; markers.push(m); arr.push(m);
    }
    cluster.addLayers(arr); map.addLayer(cluster);
    var cn = document.getElementById('carte-count'); if (cn) cn.textContent = markers.length.toLocaleString('fr') + ' pharmacies';
  }
  function recolor() { if (markers) for (var k = 0; k < markers.length; k++) markers[k].setStyle({ fillColor: colorFor(D.p[markers[k]._pi]) }); }

  function legendHtml() {
    var lg = function (c, t) { return '<span class="cn-lg"><i style="background:' + c + '"></i>' + esc(t) + '</span>'; };
    if (colorMode === 'comm') {
      var out = '';
      for (var k = 1; k < D.comm.length; k++) out += lg(COMM_COL[k], D.comm[k]);
      return out + lg('#D4DAE3', 'Hors réseau');
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
    ].join('\n');
    document.head.appendChild(s);
  }

  function boot(root) {
    D = window.PHARMA_FR;
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
    setTimeout(function () { map.invalidateSize(); rebuild(); }, 60);
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
