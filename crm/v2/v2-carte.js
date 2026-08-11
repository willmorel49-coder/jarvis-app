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

  var CB = '?v=20260804c';
  var map = null, cluster = null, markers = null, D = null, canvas = null;
  var displayMode = 'points';    // points | bulles (taille = CA)
  var tourLayer = null;          // tracé de la tournée (polyline + n° d'arrêts)
  // Routage routier réel (OSRM gratuit) : temps/distances/tracé réels de la tournée courante.
  var routeInfo = null;          // { legsSec, legsM, totalSec, totalM, geometry, source } ou null
  var routeSig = '';             // signature (dépôt+arrêts) à laquelle routeInfo correspond
  var _routeFetching = '';       // signature en cours de récupération (anti-doublon)
  var _routeTO = null;           // debounce du fetch OSRM
  var depotLayer = null;         // marqueurs des établissements Intégral
  var zoneLayer = null, zonesOn = false, zoneMetric = 'part';   // choroplèthe par département
  var depot = null;              // { n, lat, lng } point de départ/retour (optionnel)
  var pickDepotMode = false;     // clic carte suivant = définir le dépôt
  // (temps de trajet : travelMin() · durée de visite : serviceMin() — modèles dédiés plus bas)
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
  var colorMode = 'type';        // défaut : Client/Prospect (voir d'emblée les ~2200 clientes ET les ~17000 prospects sur toute la France) · comm | type | uga | grp | ca
  var commFocus = [], grpFocus = [], typeFocus = 'all';   // comm/grp = multi-sélection (tableaux) · statut = all | clients | prospects
  var searchTerm = '';   // recherche nom / ville / cp / titulaire
  var listSort = 'nom';  // tri de la liste : nom | ca
  var LIST_STEP = 500, listShown = LIST_STEP;   // liste : rendu par paquets (toutes dispo, DOM borné)
  var deptFocus = [];    // filtre département multi (2 chiffres, 3 pour DOM)
  var caMin = 0;         // filtre CA minimum (€)
  var caMax = 0;         // filtre CA maximum (€) — 0 = pas de plafond (plage de CA)
  var ugaFocus = [];     // filtre UGA multi (secteur)
  var villeFocus = '';   // filtre ville (contient)
  var titFocus = '';     // filtre titulaire (contient)
  // ── Barre de filtres « Direction 2 » (boutons + menus + pastilles + compteur) ──
  var COMMS = [], GRPS = [], DEPTS = [], UGAS = [], CA_HI = 0;   // valeurs de menus (remplies au boot)
  var fbOpen = '', fbFilter = '';        // menu ouvert · recherche dans le menu
  var fbMenuOpts = [], fbMenuSetter = ''; // options courantes du menu (choix par index → zéro échappement)
  var fbChipRm = [];     // pastilles retirables (index → {k, v}) pour les filtres multi
  // Ajoute/retire une valeur d'un filtre multi ('' = tout effacer). Renvoie le nouveau tableau.
  function fbToggleArr(arr, v) { if (!v) return []; var i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); return arr; }
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
        (window.REPRISES && REPRISES[String(p[13])] ? '<span class="cn-tag" style="background:#FFF1DB;color:#8a4b00;border:1px solid #F0C98A">🔄 Reprise</span>' : '') +
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
      (i != null ? '<button class="cn-tour-btn cn-tour-from" onclick="V2.carteTourFrom(' + i + ')">🧭 Partir d\'ici — composer une tournée</button>' : '') +
      '<div class="cn-pop-btns">' +
        '<a class="cn-pop-btn on" href="' + gmaps + '" target="_blank" rel="noopener">Fiche Google Maps</a>' +
        '<a class="cn-pop-btn" href="' + dir + '" target="_blank" rel="noopener">Itinéraire</a>' +
      '</div></div>';
  }

  // Bulle de survol : lecture rapide sans cliquer (nom + titulaire + ville + statut + groupement + commercial + CA)
  function tipHtml(p) {
    if (!p) return '';
    var grp = (D.grp[p[3]] && D.grp[p[3]] !== '—') ? D.grp[p[3]] : '';
    var comm = p[5] ? D.comm[p[5]] : '', st = D.seg[p[4]] || '';
    var bits = [];
    if (st) bits.push(st);
    if (grp) bits.push(grp);
    if (comm) bits.push(comm);
    if (caOf(p) > 0) bits.push('CA ' + eurK(caOf(p)));
    return '<b>' + esc(p[6] || p[10] || 'Pharmacie') + '</b>' +
      (p[10] && p[6] ? '<i>' + esc(p[10]) + '</i>' : '') +
      '<span>' + esc(p[7] || '') + (p[8] ? ' · ' + esc(p[8]) : '') + '</span>' +
      (bits.length ? '<em>' + esc(bits.join(' · ')) + '</em>' : '');
  }
  function deptOf(cp) { cp = String(cp || '').replace(/\s/g, ''); if (cp.length < 2) return ''; return /^97/.test(cp) ? cp.slice(0, 3) : cp.slice(0, 2); }
  function pass(p) {
    if (typeFocus === 'clients' && !isClient(p)) return false;
    if (typeFocus === 'prospects' && D.seg[p[4]] !== 'Prospect') return false;
    if (commFocus.length && commFocus.indexOf(D.comm[p[5]]) < 0) return false;
    if (grpFocus.length && grpFocus.indexOf(D.grp[p[3]]) < 0) return false;
    if (deptFocus.length && deptFocus.indexOf(deptOf(p[8])) < 0) return false;
    if (ugaFocus.length && ugaFocus.indexOf(D.uga[p[2]]) < 0) return false;
    if (caMin && caOf(p) < caMin) return false;
    if (caMax && caOf(p) > caMax) return false;
    if (villeFocus && norm(p[7]).indexOf(norm(villeFocus)) < 0) return false;
    if (titFocus && norm(p[10]).indexOf(norm(titFocus)) < 0) return false;
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
    if (zonesOn) {   // zones affichées : pas de marqueurs sur la carte, on tient juste le compteur + le dock à jour
      if (cluster) { map.removeLayer(cluster); cluster = null; }
      var cn0 = document.getElementById('carte-count'), n0 = 0;
      for (var q = 0; q < D.p.length; q++) if (pass(D.p[q])) n0++;
      if (cn0) cn0.textContent = n0.toLocaleString('fr') + ' pharmacies';
      renderDock(); renderFbChips(n0);
      return;
    }
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
      cluster = window.L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 40, disableClusteringAtZoom: 8, removeOutsideVisibleBounds: true, spiderfyOnMaxZoom: true });
      cluster.on('click', openPop);
      cluster.on('clustermouseover', function (a) {   // survol d'un paquet : dire combien de pharmacies et comment les voir
        var n = a.layer.getChildCount();
        a.layer.bindTooltip(n.toLocaleString('fr') + ' pharmacies — clique ou zoome pour les voir une par une', { direction: 'top', className: 'cn-tip', sticky: true }).openTooltip();
      });
    } else {
      cluster = window.L.layerGroup();
    }
    var arr = [];
    for (var k = 0; k < idx.length; k++) {
      var ii = idx[k], p = pts[ii];
      if (bulles && caOf(p) <= 0) continue;   // bulles = uniquement les officines avec du CA
      var m = window.L.circleMarker([p[0], p[1]], bulles ? bubbleStyle(p, ii) : markerStyle(p, ii));
      m._pi = ii; if (!useCluster) m.on('click', openPop);
      m.on('mouseover', function () { if (!this._ntt) { this._ntt = 1; this.bindTooltip(tipHtml(D.p[this._pi]), { direction: 'top', offset: [0, -3], className: 'cn-tip' }); } this.openTooltip(); });
      markers.push(m); arr.push(m);
    }
    if (useCluster) cluster.addLayers(arr); else for (var a = 0; a < arr.length; a++) cluster.addLayer(arr[a]);
    map.addLayer(cluster);
    if (cn) cn.textContent = markers.length.toLocaleString('fr') + (bulles ? ' officines avec CA' : ' pharmacies');
    renderDock();   // dock (liste dockée) synchronisé avec les filtres de la carte
    renderFbChips(idx.length);   // barre de filtres : compteur live = officines qui passent pass()
  }
  function recolor() { if (zonesOn || !markers) return; for (var k = 0; k < markers.length; k++) markers[k].setStyle(markerStyle(D.p[markers[k]._pi], markers[k]._pi)); }

  // ── ZONES PAR DÉPARTEMENT (choroplèthe sur la vraie carte de France) ──
  function ensureDeps(cb) {
    if (window.DEPARTEMENTS_GEO) { cb(); return; }
    var s = document.createElement('script'); s.src = 'departements-data.js' + CB;
    s.onload = function () { cb(); }; s.onerror = function () { cb('err'); };
    document.head.appendChild(s);
  }
  function depCode(c) { return (c === '2A' || c === '2B') ? '20' : c; }   // Corse : carte 2A/2B ↔ officines 20
  // Population légale par département (INSEE via decoupage-administratif etalab, hors arrondissements ; Corse 2A+2B → 20).
  var DEP_POP={"01":657417,"02":528994,"03":335628,"04":165451,"05":140605,"06":1097410,"07":329325,"08":269701,"09":153913,"10":311435,"11":375217,"12":279554,"13":2048070,"14":697547,"15":144379,"16":351282,"17":655709,"18":300933,"19":239190,"20":343701,"21":535078,"22":603640,"23":115995,"24":412807,"25":545209,"26":517709,"27":599668,"28":431443,"29":917179,"30":751457,"31":1415757,"32":191819,"33":1636391,"34":1188973,"35":1088855,"36":218707,"37":612119,"38":1277513,"39":258798,"40":418122,"41":329357,"42":768508,"43":227489,"44":1445171,"45":682304,"46":174670,"47":330844,"48":76633,"49":820713,"50":494452,"51":566283,"52":171798,"53":306538,"54":732590,"55":183001,"56":764161,"57":1049155,"58":202670,"59":2607746,"60":829699,"61":278475,"62":1462167,"63":661852,"64":687240,"65":229788,"66":482765,"67":1148073,"68":767842,"69":1883437,"70":234601,"71":550936,"72":566993,"73":439750,"74":835206,"75":2145906,"76":1254739,"77":1428636,"78":1449723,"79":374481,"80":568748,"81":391066,"82":262316,"83":1085189,"84":561941,"85":691867,"86":439332,"87":372123,"88":362397,"89":334156,"90":140120,"91":1306118,"92":1626213,"93":1655422,"94":1407972,"95":1251804};
  function habParOfficine(code) {   // habitants pour 1 officine (tension d'accès) ; 0 si inconnu
    var s = (window.DEPARTEMENTS_STATS || {})[depCode(code)] || {};
    var pp = DEP_POP[depCode(code)] || 0, tt = s.tot || 0;
    return tt > 0 && pp > 0 ? Math.round(pp / tt) : 0;
  }
  function zoneColor(code) {
    var s = (window.DEPARTEMENTS_STATS || {})[depCode(code)] || { cli: 0, pro: 0, tot: 0, part: 0 };
    if (zoneMetric === 'part') { var p = s.part; return p >= 25 ? '#0B6E43' : p >= 15 ? '#2E9E66' : p >= 7 ? '#5CC98A' : p >= 1 ? '#BFE6CF' : '#EDEFF3'; }
    if (zoneMetric === 'densite') { var t = s.tot; return t >= 400 ? '#08306B' : t >= 250 ? '#2171B5' : t >= 120 ? '#6BAED6' : t >= 40 ? '#BDD7E7' : '#EDEFF3'; }
    if (zoneMetric === 'tension') {   // habitants/officine : rouge = sous-doté (opportunité), vert = bien doté. Moyenne nationale ~3400.
      var h = habParOfficine(code);
      return h >= 4200 ? '#B01532' : h >= 3400 ? '#E8546A' : h >= 2800 ? '#FBD08A' : h >= 2200 ? '#9FD9B5' : h > 0 ? '#2E9E66' : '#EDEFF3';
    }
    var pr = s.pro; return pr >= 500 ? '#7A2E0E' : pr >= 300 ? '#C2410C' : pr >= 150 ? '#EA580C' : pr >= 40 ? '#FDBA74' : '#EDEFF3';
  }
  function drawZones() {
    if (!map) return;
    if (zoneLayer) { map.removeLayer(zoneLayer); zoneLayer = null; }
    if (!zonesOn) return;
    ensureDeps(function () {
      if (!window.DEPARTEMENTS_GEO || !zonesOn) return;
      zoneLayer = window.L.geoJSON(window.DEPARTEMENTS_GEO, {
        style: function (f) { return { fillColor: zoneColor(f.properties.code), fillOpacity: 0.72, color: '#fff', weight: 1 }; },
        onEachFeature: function (f, layer) {
          var s = (window.DEPARTEMENTS_STATS || {})[depCode(f.properties.code)] || {};
          var hpo = habParOfficine(f.properties.code);
          layer.bindTooltip('<b>' + esc(f.properties.code + ' · ' + f.properties.nom) + '</b><span>' + (s.cli || 0) + ' clients · ' + (s.pro || 0) + ' prospects' + (s.part != null ? ' · ' + s.part + '% clients' : '') + (hpo ? ' · ' + hpo.toLocaleString('fr-FR') + ' hab./officine' : '') + '</span>', { sticky: true, className: 'cn-tip' });
          layer.on('mouseover', function () { layer.setStyle({ weight: 2.5, color: '#0B131C' }); layer.bringToFront(); });
          layer.on('mouseout', function () { layer.setStyle({ weight: 1, color: '#fff' }); });
          layer.on('click', function () {   // drill-down : filtre + liste du département
            deptFocus = [depCode(f.properties.code)];
            renderFbRow(); renderFbChips();
            renderLists();
            var dk = document.getElementById('cn-dock'); if (!dk || !dk.offsetParent) V2.carteListOpen();   // dock masqué (mobile) → modale
            try { map.fitBounds(layer.getBounds().pad(0.1)); } catch (e) {}
          });
        }
      }).addTo(map);
    });
  }
  V2.carteZones = function (on) {
    zonesOn = (on === undefined ? !zonesOn : !!on);
    var btn = document.getElementById('cn-zonebtn'); if (btn) { btn.classList.toggle('on', zonesOn); btn.textContent = zonesOn ? '✓ Zones affichées' : 'Afficher les zones (départements)'; }
    var sel = document.getElementById('cn-zonemetric'); if (sel) sel.style.display = zonesOn ? 'block' : 'none';
    if (zonesOn) { if (cluster) map.removeLayer(cluster); drawZones(); }
    else { if (zoneLayer) { map.removeLayer(zoneLayer); zoneLayer = null; } rebuild(); }
    var lg = document.getElementById('carte-legend'); if (lg) lg.innerHTML = legendHtml();
  };
  V2.carteZoneMetric = function (m) { zoneMetric = m; drawZones(); var lg = document.getElementById('carte-legend'); if (lg) lg.innerHTML = legendHtml(); };
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
  function routeKm() { var real = routeReal(); if (real) return real.totalM / 1000; var pts = routeStops(), d = 0; for (var j = 1; j < pts.length; j++) d += roadKm(pts[j - 1], pts[j]); return d; }
  function tourDistance() { return routeKm(); }
  function estMinutes() {   // cohérent avec l'agenda : dernière arrivée - départ + durée du dernier arrêt
    var s = computeSchedule(); if (!s.length) return 0;
    var t0 = parseHM(_startTime); if (t0 == null) t0 = 540;
    return Math.round(s[s.length - 1].arr - t0 + serviceMin(tour[tour.length - 1]));
  }
  function fmtDur(min) { var h = Math.floor(min / 60), m = min % 60; return h ? (h + ' h ' + (m < 10 ? '0' : '') + m) : (m + ' min'); }

  V2.carteTour = function (i) {
    var p = D.p[i], k = keyOf(p), pos = tourPos(k);
    if (pos >= 0) tour.splice(pos, 1);
    else tour.push({ k: k, n: p[6], v: p[7], c: p[8], t: p[9], lat: p[0], lng: p[1], id: p[13], sg: p[4], gp: p[3] });
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

  // ── GÉNÉRATEUR DE TOURNÉE ──────────────────────────────────────────
  // Départ = ton adresse perso (géocodée) et/ou une ville/pharmacie à prospecter.
  // Compose N pharmacies (6–10) proches, ordre optimisé, avec heure de RDV par arrêt.
  var _startTime = '09:00';            // heure de départ de la journée
  var _geoCache = {};                  // adresse -> {lat,lng,label}
  function geocodeAddress(q, cb) {     // Géoplateforme IGN (gratuit, sans clé — remplace la BAN décommissionnée)
    q = (q || '').trim(); if (!q) { cb(null); return; }
    if (_geoCache[q]) { cb(_geoCache[q]); return; }
    try {
      fetch('https://data.geopf.fr/geocodage/search?limit=1&q=' + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var f = j && j.features && j.features[0];
          if (f && f.geometry && f.geometry.coordinates) { var c = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], label: (f.properties && f.properties.label) || q }; _geoCache[q] = c; cb(c); }
          else cb(null);
        }).catch(function () { cb(null); });
    } catch (e) { cb(null); }
  }
  function parseHM(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? (+m[1] * 60 + +m[2]) : null; }
  function fmtHM(mins) { mins = Math.round(mins); var h = Math.floor(mins / 60) % 24, m = ((mins % 60) + 60) % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  // Catégorie de segment STABLE (indépendante de l'ordre des labels dans D.seg, qui n'est PAS [A,B,C,P]).
  // Corrige un décalage historique : durées & priorités étaient indexées par l'index brut → prospect traité comme gros client, Client A ignoré.
  function segCat(idx) { var s = D.seg[idx] || ''; if (s === 'Client A') return 'A'; if (s === 'Client B') return 'B'; if (s.indexOf('Client') === 0) return 'C'; return 'P'; }
  // Durée de visite (min) selon segment : Client A=30, B/C=20, Prospect/autre=12 ; RDV titulaire=45.
  var TP_SERV = { A: 30, B: 20, C: 20, P: 12 };
  function serviceMin(s) { if (parseHM(s.rdv) != null) return 45; return TP_SERV[segCat(s.sg)] || 12; }
  // Temps de trajet estimé (min) — vitesse effective CROISSANTE avec la distance
  // (rues en ville lentes → nationale → autoroute) + facteur de détour route/vol d'oiseau
  // plus fort sur les courtes distances. Sans serveur de routage, colle au réel à ~10 %.
  function travelMin(a, b) {
    var straight = haversine(a, b);
    var detour = straight < 3 ? 1.45 : straight < 15 ? 1.35 : 1.25;   // rues sinueuses vs grands axes
    var km = straight * detour;
    var kmh = km < 2 ? 22 : km < 6 ? 32 : km < 20 ? 55 : km < 60 ? 72 : 82;
    return km / kmh * 60 + 1.5;   // +1,5 min : stationnement / approche
  }
  // Distance ROUTIÈRE estimée (km) — même facteur de détour que travelMin (cohérence agenda ↔ métriques).
  function roadKm(a, b) { var s = haversine(a, b); return s * (s < 3 ? 1.45 : s < 15 ? 1.35 : 1.25); }

  // ── Routage routier RÉEL (OSRM gratuit) : signature + récupération + repli estimation ──
  // Signature de la tournée courante (dépôt + arrêts, coords arrondies) : identifie à quoi routeInfo se rapporte.
  function tourSig() {
    var r = function (n) { return (Math.round(n * 1e4) / 1e4); };
    var s = depot ? ('D' + r(depot.lat) + ',' + r(depot.lng) + '|') : '';
    for (var j = 0; j < tour.length; j++) s += r(tour[j].lat) + ',' + r(tour[j].lng) + ';';
    return s;
  }
  // routeInfo est-il à jour pour la tournée affichée ?
  function routeReal() { return (routeInfo && routeSig === tourSig() && routeInfo.source === 'osrm') ? routeInfo : null; }
  // Index du trajet OSRM qui ARRIVE à l'arrêt tour[j] (dépôt → arrêts → retour dépôt).
  function legIndexFor(j) { return depot ? j : (j - 1); }
  // Temps de trajet (min) vers l'arrêt j : réel OSRM si dispo, sinon estimation travelMin.
  function legMinFor(j, prev, s) {
    var real = routeReal();
    if (real) { var li = legIndexFor(j); if (li >= 0 && real.legsSec[li] != null) return real.legsSec[li] / 60; }
    return prev ? travelMin(prev, s) : 0;
  }
  // Distance de trajet (km) vers l'arrêt j : réelle OSRM si dispo, sinon estimation roadKm.
  function legKmFor(j, prev, s) {
    var real = routeReal();
    if (real) { var li = legIndexFor(j); if (li >= 0 && real.legsM[li] != null) return real.legsM[li] / 1000; }
    return prev ? roadKm(prev, s) : 0;
  }
  // Récupère la vraie route OSRM si la tournée a changé, puis re-render (debounce + anti-doublon).
  function maybeRefreshRoute() {
    if (!tour.length || !V2.osrmRoute) return;
    var sig = tourSig();
    if (routeInfo && routeSig === sig) return;   // déjà à jour
    if (_routeFetching === sig) return;           // déjà en cours pour cette tournée
    if (_routeTO) clearTimeout(_routeTO);
    _routeTO = setTimeout(function () {
      var sig2 = tourSig(); _routeFetching = sig2;
      var pts = routeStops().map(function (s) { return [s.lat, s.lng]; });
      V2.osrmRoute(pts, function (res) {
        _routeFetching = '';
        if (tourSig() !== sig2) return;   // la tournée a encore changé entre-temps → on ignore
        routeInfo = res; routeSig = sig2;
        drawTourLine(); renderTourPanel();
      });
    }, 220);
  }
  // Agenda : heure d'arrivée à chaque arrêt (départ + trajets RÉELS + visites), en attendant les RDV fixes.
  function computeSchedule() {
    var t = parseHM(_startTime); if (t == null) t = 9 * 60;
    var out = [], prev = depot ? depot : (tour[0] || null), cur = t;
    for (var j = 0; j < tour.length; j++) {
      var s = tour[j];
      if (j === 0 && !depot) { out.push({ arr: cur, rdv: s.rdv || '' }); prev = s; cur += serviceMin(s); continue; }
      cur += legMinFor(j, prev, s);
      var rdv = parseHM(s.rdv), wait = false;
      if (rdv != null && rdv > cur) { cur = rdv; wait = true; }
      out.push({ arr: cur, rdv: s.rdv || '', wait: wait, late: (rdv != null && cur - rdv > 10) });
      cur += serviceMin(s); prev = s;
    }
    return out;
  }
  V2.carteTourStartTime = function (v) { _startTime = v || '09:00'; renderTourPanel(); };
  V2.carteTourRdv = function (j, v) { if (tour[j]) { tour[j].rdv = v || ''; saveTour(); renderTourPanel(); } };
  function mkStop(p) { return { k: keyOf(p), n: p[6], v: p[7], c: p[8], t: p[9], lat: p[0], lng: p[1], id: p[13], sg: p[4], gp: p[3] }; }
  function resolveStart(q) {   // -> {center:{lat,lng,name?}, startIdx} ou null
    if (q) {
      var nq = norm(q), idx = -1, i;
      for (i = 0; i < D.p.length; i++) if (D.p[i][6] && norm(D.p[i][6]) === nq) { idx = i; break; }
      if (idx < 0) for (i = 0; i < D.p.length; i++) if (D.p[i][6] && norm(D.p[i][6]).indexOf(nq) >= 0) { idx = i; break; }
      if (idx >= 0) return { center: { lat: D.p[idx][0], lng: D.p[idx][1] }, startIdx: idx };
      var sx = 0, sy = 0, n = 0;
      for (i = 0; i < D.p.length; i++) { var v = norm(D.p[i][7]); if (v && (v === nq || v.indexOf(nq) >= 0)) { sx += D.p[i][0]; sy += D.p[i][1]; n++; } }
      if (n) return { center: { lat: sx / n, lng: sy / n, name: q }, startIdx: -1 };
      return null;
    }
    if (map) { var c = map.getCenter(); return { center: { lat: c.lat, lng: c.lng, name: 'centre de la carte' }, startIdx: -1 }; }
    return null;
  }
  // ══ MOTEUR D'OPTIMISATION (corridor "sur l'axe" + priorités + groupements + RDV) ══
  // Conçu par orchestration multi-agents (VRP + terrain + impl) puis passé au crible d'une critique adverse.
  var TP = {
    NEAR_VILLE: 30, CORRIDOR_MAX: 20, BBOX_PAD: 0.55, T_LO: -0.15, T_HI: 1.15, K_SHORT: 120,
    DAY_MIN: 10 * 60, SAFETY: 30, RDV_MARGIN: 12,
    W: { villeMin: 0.5, detourMin: 0.4, latKm: 0.8, grpTarget: 15, grpCover: 5, clientProx: 6,
         // mixte (tournée existante + prospection) : les CLIENTS sont les ancres (tu les visites/livres déjà),
         // les prospects proches d'un client se glissent dedans. prospection : que des prospects, classés par proximité client.
         seg: { prospection: { A: 2, B: 3, C: 3, P: 8 }, mixte: { A: 15, B: 10, C: 8, P: 5 } },
         densHi: 12, densLo: 4, isol: -10, caTop: 6 },
    DELIV_RADIUS: 15   // km : un prospect n'est « logique » à livrer que si un client Intégral est à ≤ ce rayon
  };
  function llOK(p) { return isFinite(p[0]) && isFinite(p[1]) && (p[0] !== 0 || p[1] !== 0); }
  // ── GRILLE DE LIVRAISON : tous les clients Intégral (là où on livre déjà). Un prospect n'est « logique »
  //    à prospecter que s'il tombe dans le rayon de livraison d'un client. Hash spatial (cellules ~0,2°) pour la vitesse.
  var _clientCells = null, _clientCount = 0;
  function buildClientGrid() {
    _clientCells = {}; _clientCount = 0;
    if (!D || !D.p) return;
    for (var i = 0; i < D.p.length; i++) {
      var p = D.p[i]; if (!llOK(p)) continue;
      if ((D.seg[p[4]] || '').indexOf('Client') !== 0) continue;   // clients Intégral uniquement
      var key = Math.round(p[0] * 5) + '_' + Math.round(p[1] * 5);
      (_clientCells[key] = _clientCells[key] || []).push([p[0], p[1]]);
      _clientCount++;
    }
  }
  // Distance (km) au client Intégral le plus proche. Cellules ±1 (~±22 km) : couvre tout rayon utile ≤ 15 km.
  function nearestClientKm(c) {
    if (_clientCells == null) buildClientGrid();
    if (!_clientCount) return Infinity;
    var gx = Math.round(c.lat * 5), gy = Math.round(c.lng * 5), m = Infinity;
    for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
      var cell = _clientCells[(gx + dx) + '_' + (gy + dy)]; if (!cell) continue;
      for (var k = 0; k < cell.length; k++) { var d = haversine(c, { lat: cell[k][0], lng: cell[k][1] }); if (d < m) m = d; }
    }
    return m;   // si aucune cellule voisine peuplée → Infinity (zone sans client = illogique à livrer)
  }
  function LL(p) { return { lat: p[0], lng: p[1] }; }
  function detourKm(A, c, B, dAB) { return haversine(A, c) + haversine(c, B) - dAB; }
  function projT(A, c, B) {   // position projetée le long de A->B (équirectangulaire local) : <0 derrière, >1 au-delà
    var lat0 = (A.lat + B.lat) / 2 * Math.PI / 180, kx = 111.320 * Math.cos(lat0), ky = 110.574;
    var ax = A.lng * kx, ay = A.lat * ky, bx = B.lng * kx, by = B.lat * ky, cx = c.lng * kx, cy = c.lat * ky;
    var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    return ((cx - ax) * dx + (cy - ay) * dy) / L2;
  }
  function segLatKm(A, c, B) {   // écart latéral (km) au corridor A->B
    var t = Math.max(0, Math.min(1, projT(A, c, B)));
    return haversine(c, { lat: A.lat + t * (B.lat - A.lat), lng: A.lng + t * (B.lng - A.lng) });
  }
  function tpSelect(plan, corridorMax) {   // une passe O(n) : bbox O(1) puis corridor/zone-ville
    var A = plan.origin, B = plan.ville, dAB = haversine(A, B), out = [];
    plan._excluded = 0;   // prospects écartés (hors zone de livraison) — recompté à chaque passe (bbox constant)
    var minLat = Math.min(A.lat, B.lat) - TP.BBOX_PAD, maxLat = Math.max(A.lat, B.lat) + TP.BBOX_PAD;
    var minLng = Math.min(A.lng, B.lng) - TP.BBOX_PAD, maxLng = Math.max(A.lng, B.lng) + TP.BBOX_PAD;
    for (var i = 0; i < D.p.length; i++) {
      var p = D.p[i]; if (!llOK(p) || plan.pinnedIds[p[13]]) continue;
      if (p[0] < minLat || p[0] > maxLat || p[1] < minLng || p[1] > maxLng) continue;
      if (plan.commFocus && D.comm[p[5]] !== plan.commFocus) continue;
      var estClient = (D.seg[p[4]] || '').indexOf('Client') === 0;
      if (estClient && !plan.incClients) continue;
      var c = LL(p);
      // ZONE DE LIVRAISON : un prospect n'est retenu que s'il a un client Intégral à ≤ DELIV_RADIUS (sinon illogique à livrer).
      var dClient = estClient ? 0 : nearestClientKm(c);
      if (!estClient && dClient > TP.DELIV_RADIUS) { plan._excluded = (plan._excluded || 0) + 1; continue; }
      var dVille = haversine(c, B), det = detourKm(A, c, B, dAB), nearV = dVille <= TP.NEAR_VILLE;
      if (!nearV && det > corridorMax) continue;
      if (!nearV) { var t = projT(A, c, B); if (t < TP.T_LO || t > TP.T_HI) continue; }
      out.push({ ref: c, grp: p[3], seg: p[4], id: p[13], ca: p[12] || 0, detour: det, latKm: segLatKm(A, c, B), dVille: dVille, dClient: dClient, dens: 0, name: p[6], ville: p[7], cp: p[8], tel: p[9] });
    }
    return out;
  }
  function tpDensity(cand) {
    for (var a = 0; a < cand.length; a++) { var n4 = 0, n6 = 0;
      for (var b = 0; b < cand.length; b++) { if (a === b) continue; var d = haversine(cand[a].ref, cand[b].ref); if (d < 4) n4++; if (d < 6) n6++; }
      cand[a].dens = n4 >= 3 ? TP.W.densHi : (n4 >= 1 ? TP.W.densLo : (n6 === 0 ? TP.W.isol : 0));
    }
  }
  function tpScore(c, plan, caMax, firstOfGrp) {   // minutes-équivalent, + haut = mieux
    // Priorité DOMINANTE (choix métier) : PROXIMITÉ D'UN CLIENT Intégral pour les prospects — on prospecte là où on
    // livre déjà (coût de livraison mini). La ville reste un simple repère de zone (poids réduit). Détour = secondaire.
    var s = -TP.W.villeMin * (c.dVille * 1.30 * (60 / 38)) - TP.W.detourMin * (c.detour * 1.30 * (60 / 38)) - TP.W.latKm * c.latKm;
    var isCli = (D.seg[c.seg] || '').indexOf('Client') === 0;
    if (!isCli) s += TP.W.clientProx * (1 - Math.min(c.dClient != null ? c.dClient : TP.DELIV_RADIUS, TP.DELIV_RADIUS) / TP.DELIV_RADIUS);   // prospect collé à un client = max
    if (plan.grpTargets[c.grp]) { s += TP.W.grpTarget; if (!firstOfGrp[c.grp]) s += TP.W.grpCover; }
    s += (TP.W.seg[plan.segMode] || TP.W.seg.mixte)[segCat(c.seg)] || 0;
    s += c.dens;
    if (caMax > 0 && c.ca >= 0.75 * caMax) s += TP.W.caTop;
    return s;
  }
  function tpStop(c) { return { ref: c.ref, id: c.id, seg: c.seg, grp: c.grp, rdv: null, rdvStr: '', name: c.name, ville: c.ville, cp: c.cp, tel: c.tel }; }
  function tpInsert(seq, stop) {   // insertion la moins chère (jamais entre 2 ancres RDV) ; à coût égal, position la + basse
    var best = -1, bestCost = Infinity;
    for (var k = 0; k < seq.length - 1; k++) {
      var a = seq[k], b = seq[k + 1]; if (a.rdv != null && b.rdv != null) continue;
      var cost = travelMin(a.ref, stop.ref) + travelMin(stop.ref, b.ref) - travelMin(a.ref, b.ref);
      if (cost < bestCost - 1e-9) { bestCost = cost; best = k + 1; }
    }
    // route ouverte : ajouter en fin (coût = dernière étape) — gère aussi la séquence [origine] seule
    var last = seq[seq.length - 1], endCost = travelMin(last.ref, stop.ref);
    if (endCost < bestCost - 1e-9) { bestCost = endCost; best = seq.length; }
    if (best < 0) return null;
    var out = seq.slice(); out.splice(best, 0, stop); return out;
  }
  function tpSvc(s) { return s.rdv != null ? 45 : (TP_SERV[segCat(s.seg)] || 12); }
  function tpSimulate(seq, plan) {   // horaires + retards (fenêtres RDV)
    var t = plan.t0, lateness = 0, timeline = [];
    for (var k = 0; k < seq.length; k++) {
      if (k > 0) t += travelMin(seq[k - 1].ref, seq[k].ref);
      var s = seq[k];
      if (s.rdv != null) { if (t > s.rdvEnd) lateness += (t - s.rdvEnd); if (t < s.rdv - TP.RDV_MARGIN) t = s.rdv - TP.RDV_MARGIN; }
      timeline.push({ arr: t, s: s });
      if (!s.isOrigin) t += tpSvc(s);
    }
    var dur = t - plan.t0;
    return { ok: lateness === 0 && dur <= TP.DAY_MIN - TP.SAFETY, lateness: lateness, endT: t, dur: dur, timeline: timeline };
  }
  function tpCost(seq, plan) { var s = tpSimulate(seq, plan); return s.dur + 60000 * s.lateness; }   // retard >> durée
  function tpGreedy(seq, cand, plan) {
    var caMax = 0, i; for (i = 0; i < cand.length; i++) if (cand[i].ca > caMax) caMax = cand[i].ca;
    tpDensity(cand);
    var count = {}, firstOfGrp = {}, chosen = {};
    for (i = 0; i < seq.length; i++) { var s = seq[i]; if (s.isOrigin) continue; chosen[s.id] = 1; if (s.grp != null) { count[s.grp] = (count[s.grp] || 0) + 1; firstOfGrp[s.grp] = 1; } }
    function nVisits() { var n = 0; for (var x = 0; x < seq.length; x++) if (!seq[x].isOrigin) n++; return n; }
    // (a) quota minimal par groupement ciblé (en tenant compte des imposés déjà présents)
    for (var g in plan.grpTargets) { g = +g;
      var need = (plan.grpQuota[g] ? plan.grpQuota[g].min : 1) - (count[g] || 0); if (need <= 0) continue;
      var pool = cand.filter(function (c) { return c.grp === g && !chosen[c.id]; })
        .sort(function (x, y) { return tpScore(y, plan, caMax, firstOfGrp) - tpScore(x, plan, caMax, firstOfGrp) || x.id - y.id; });
      for (var j = 0; j < need && j < pool.length; j++) {
        var c0 = pool[j]; chosen[c0.id] = 1; var tr0 = tpInsert(seq, tpStop(c0));
        if (tr0 && tpSimulate(tr0, plan).ok) { seq = tr0; count[g] = (count[g] || 0) + 1; firstOfGrp[g] = 1; }
      }
    }
    // (b) complétion : meilleur (score - coût réel d'insertion en minutes) jusqu'à nWanted
    var guard = cand.length + 5;
    while (nVisits() < plan.nWanted && guard-- > 0) {
      var best = null, bestSc = -Infinity, baseCost = tpCost(seq, plan);
      for (i = 0; i < cand.length; i++) { var c = cand[i]; if (chosen[c.id]) continue;
        var qmax = (plan.grpQuota[c.grp] ? plan.grpQuota[c.grp].max : Infinity); if ((count[c.grp] || 0) >= qmax) continue;
        var trial = tpInsert(seq, tpStop(c)); if (!trial) continue;
        var sc = tpScore(c, plan, caMax, firstOfGrp) - (tpCost(trial, plan) - baseCost);
        if (sc > bestSc || (sc === bestSc && best && c.id < best.id)) { bestSc = sc; best = c; }
      }
      if (!best) break;
      chosen[best.id] = 1; var tr = tpInsert(seq, tpStop(best));
      if (tr && tpSimulate(tr, plan).ok) { seq = tr; count[best.grp] = (count[best.grp] || 0) + 1; firstOfGrp[best.grp] = 1; }
    }
    return seq;
  }
  function tpReorder(stops, ordRefs) {   // remap refs ordonnées -> objets stop (par identité de ref)
    var used = new Array(stops.length), res = [], r, i;
    for (r = 0; r < ordRefs.length; r++) { var rf = ordRefs[r], bi = -1;
      for (i = 0; i < stops.length; i++) { if (used[i]) continue; if (stops[i].ref === rf || (stops[i].ref.lat === rf.lat && stops[i].ref.lng === rf.lng)) { bi = i; break; } }
      if (bi >= 0) { used[bi] = 1; res.push(stops[bi]); }
    }
    for (i = 0; i < stops.length; i++) if (!used[i]) res.push(stops[i]);
    return res;
  }
  function tpOptimize(seq, plan) {
    var fixed = {}, i; for (i = 0; i < seq.length; i++) if (seq[i].isOrigin || seq[i].rdv != null) fixed[i] = 1;
    var a = 0;   // 2-opt par tronçon libre entre ancres, accepté seulement si le coût ne se dégrade pas
    for (i = 1; i < seq.length; i++) {
      if (fixed[i]) {
        if (i - a > 2) {
          var mid = seq.slice(a + 1, i), head = seq[a].ref, tail = seq[i].ref;
          var ordRefs = twoOpt(nearestOrder(mid.map(function (s) { return s.ref; }), head), head, tail);
          var trial = seq.slice(0, a + 1).concat(tpReorder(mid, ordRefs), seq.slice(i));
          if (tpCost(trial, plan) <= tpCost(seq, plan) + 1e-6) seq = trial;
        }
        a = i;
      }
    }
    if (seq.length - a > 2) {   // tronçon final libre (route ouverte, pas d'ancre en fin)
      var midF = seq.slice(a + 1), headF = seq[a].ref;
      var ordF = twoOpt(nearestOrder(midF.map(function (s) { return s.ref; }), headF), headF, null);
      var trialF = seq.slice(0, a + 1).concat(tpReorder(midF, ordF));
      if (tpCost(trialF, plan) <= tpCost(seq, plan) + 1e-6) seq = trialF;
    }
    for (var len = 1; len <= 2; len++) {   // or-opt : déplacer 1-2 arrêts libres si le coût baisse
      for (i = 1; i < seq.length - len; i++) {
        var slc = seq.slice(i, i + len), anyFixed = false, z;
        for (z = 0; z < slc.length; z++) if (slc[z].isOrigin || slc[z].rdv != null) anyFixed = true;
        if (anyFixed) continue;
        var rest = seq.slice(0, i).concat(seq.slice(i + len)), bestSeq = seq, bestC = tpCost(seq, plan);
        for (var jj = 1; jj < rest.length; jj++) {
          if (rest[jj - 1].rdv != null && rest[jj].rdv != null) continue;
          var tr2 = rest.slice(0, jj).concat(slc, rest.slice(jj)), cc = tpCost(tr2, plan);
          if (cc < bestC - 1e-6) { bestC = cc; bestSeq = tr2; }
        }
        seq = bestSeq;
      }
    }
    return seq;
  }
  function tpRepair(seq, plan) {   // si RDV raté / journée trop longue : retirer l'optionnel le plus coûteux
    var sim = tpSimulate(seq, plan), guard = seq.length + 1;
    while (!sim.ok && guard-- > 0) {
      var at = -1, k; for (k = 0; k < sim.timeline.length; k++) { var it = sim.timeline[k]; if (it.s.rdv != null && it.arr > it.s.rdvEnd) { at = k; break; } }
      var upto = at < 0 ? seq.length : at, victim = -1, worst = -1;
      for (k = 1; k < upto && k + 1 < seq.length; k++) { var s = seq[k]; if (s.isOrigin || s.rdv != null || s.pinned) continue;
        var cc2 = travelMin(seq[k - 1].ref, s.ref) + travelMin(s.ref, seq[k + 1].ref) - travelMin(seq[k - 1].ref, seq[k + 1].ref);
        if (cc2 > worst) { worst = cc2; victim = k; }
      }
      if (victim < 0) { for (k = seq.length - 2; k >= 1; k--) { if (!seq[k].isOrigin && seq[k].rdv == null && !seq[k].pinned) { victim = k; break; } } }
      if (victim < 0) break;
      seq.splice(victim, 1); sim = tpSimulate(seq, plan);
    }
    return { seq: seq, sim: sim };
  }
  function tpPlan(plan) {
    var corridorMax = TP.CORRIDOR_MAX, cand = tpSelect(plan, corridorMax);
    while (cand.length < Math.max(plan.nWanted * 3, 12) && corridorMax < 60) { corridorMax *= 1.6; cand = tpSelect(plan, corridorMax); }
    if (!cand.length) {   // repli radial autour de la ville (désert / home≈ville)
      var B = plan.ville, all = [], i;
      for (i = 0; i < D.p.length; i++) { var p = D.p[i]; if (!llOK(p) || plan.pinnedIds[p[13]]) continue;
        if (plan.commFocus && D.comm[p[5]] !== plan.commFocus) continue;
        var estCli = (D.seg[p[4]] || '').indexOf('Client') === 0;
        if (estCli && !plan.incClients) continue;
        var c = LL(p), dCl = estCli ? 0 : nearestClientKm(c);
        if (!estCli && dCl > TP.DELIV_RADIUS) continue;   // même règle : pas de prospect hors zone de livraison
        all.push({ ref: c, grp: p[3], seg: p[4], id: p[13], ca: p[12] || 0, detour: 2 * haversine(c, B), latKm: 0, dVille: haversine(c, B), dClient: dCl, dens: 0, name: p[6], ville: p[7], cp: p[8], tel: p[9] }); }
      all.sort(function (x, y) { return x.dVille - y.dVille || x.id - y.id; }); cand = all.slice(0, TP.K_SHORT);
    } else {   // shortlist double : proches de la ville + faibles détours (prospecter la ville ET rester sur l'axe)
      var byDet = cand.slice().sort(function (x, y) { return x.detour - y.detour || x.id - y.id; });
      var byVil = cand.slice().sort(function (x, y) { return x.dVille - y.dVille || x.id - y.id; });
      var seen = {}, merged = [], q;
      for (q = 0; merged.length < TP.K_SHORT && (q < byDet.length || q < byVil.length); q++) {
        if (q < byVil.length && !seen[byVil[q].id]) { seen[byVil[q].id] = 1; merged.push(byVil[q]); }
        if (merged.length < TP.K_SHORT && q < byDet.length && !seen[byDet[q].id]) { seen[byDet[q].id] = 1; merged.push(byDet[q]); }
      }
      cand = merged;
    }
    var origin = { isOrigin: true, ref: { lat: plan.origin.lat, lng: plan.origin.lng }, id: -1 };
    var anchors = plan.pinned.filter(function (s) { return s.rdv != null; }).sort(function (x, y) { return x.rdv - y.rdv || (x.id > y.id ? 1 : -1); });
    var freePin = plan.pinned.filter(function (s) { return s.rdv == null; });
    var seq = [origin].concat(anchors);
    for (var f = 0; f < freePin.length; f++) { var tr = tpInsert(seq, freePin[f]); if (tr) seq = tr; }
    seq = tpGreedy(seq, cand, plan);
    seq = tpOptimize(seq, plan);
    return tpRepair(seq, plan);
  }
  function parseGrpTargets(str) {   // "Giphar, Aprium" -> { grpIdx: true }
    var set = {}; if (!str) return set;
    str.split(',').forEach(function (tk) { tk = norm(tk); if (!tk) return;
      for (var g = 0; g < D.grp.length; g++) { var gn = norm(D.grp[g]); if (gn && gn !== '—' && (gn === tk || gn.indexOf(tk) >= 0)) set[g] = true; }
    });
    return set;
  }

  V2.carteBuildTour = function () {
    if (!D || !D.p) return;
    var addr = ((document.getElementById('cn-tgen-addr') || {}).value || '').trim();
    var zone = ((document.getElementById('cn-tgen-start') || {}).value || '').trim();
    var count = parseInt((document.getElementById('cn-tgen-n') || {}).value, 10) || 8; count = Math.max(2, Math.min(12, count));
    var incClients = true; var cb = document.getElementById('cn-tgen-cli'); if (cb) incClients = cb.checked;
    var grpTargets = parseGrpTargets(((document.getElementById('cn-tgen-grp') || {}).value || '').trim());
    var tv = (document.getElementById('cn-tgen-time') || {}).value; if (tv) _startTime = tv;

    var run = function (originPt) {
      var villeCenter = null, zoneName = '';
      if (zone) { var r = resolveStart(zone); if (!r) { if (V2.toast) V2.toast('« ' + zone + ' » introuvable (ville ou pharmacie)'); return; } villeCenter = r.center; zoneName = zone; }
      if (!originPt && !villeCenter && map) { var c = map.getCenter(); originPt = { n: 'centre de la carte', lat: c.lat, lng: c.lng }; }
      var origin = originPt || villeCenter, ville = villeCenter || origin;
      if (!origin || !ville) { if (V2.toast) V2.toast('Indique une adresse, une ville ou une pharmacie'); return; }
      var pinned = tour.map(function (s) { var rm = parseHM(s.rdv);
        return { ref: { lat: s.lat, lng: s.lng }, id: (s.id != null ? s.id : s.k), seg: (s.sg != null ? s.sg : 3), grp: (s.gp != null ? s.gp : null),
          rdv: rm, rdvEnd: rm != null ? rm + 10 : null, pinned: true, rdvStr: s.rdv || '', name: s.n, ville: s.v, cp: s.c, tel: s.t }; });
      var pinnedIds = {}; pinned.forEach(function (s) { if (s.id != null) pinnedIds[s.id] = 1; });
      var t0 = parseHM(_startTime); if (t0 == null) t0 = 540;
      var plan = { origin: { lat: origin.lat, lng: origin.lng }, ville: { lat: ville.lat, lng: ville.lng }, t0: t0,
        pinned: pinned, pinnedIds: pinnedIds, grpTargets: grpTargets, grpQuota: {}, segMode: incClients ? 'mixte' : 'prospection',
        nWanted: count, incClients: incClients, commFocus: commFocus.length === 1 ? commFocus[0] : '' };
      var res = tpPlan(plan), stops = res.seq.filter(function (s) { return !s.isOrigin; });
      if (stops.length < 1) { if (V2.toast) V2.toast('Pas assez de pharmacies — élargis la zone ou change de ville'); return; }
      tour = stops.map(function (s) { return { k: (s.name || '') + '|' + (s.cp || ''), n: s.name, v: s.ville, c: s.cp, t: s.tel, lat: s.ref.lat, lng: s.ref.lng, id: s.id, sg: s.seg, gp: s.grp, rdv: s.rdvStr || '' }; });
      depot = { n: (originPt ? (originPt.n || 'Mon départ') : ('Départ · ' + (zoneName || 'zone'))), lat: origin.lat, lng: origin.lng };
      try { localStorage.setItem('jarvis_depot_v1', JSON.stringify(depot)); } catch (e) {}
      // pas de rebuild() ici : re-rendre les 19 000 marqueurs peut figer le navigateur.
      // La tournée s'affiche via drawTourLine (ligne + pastilles) ; on rafraîchit juste les styles des arrêts.
      saveTour(); updateTourBar(); drawTourLine(); renderTourPanel(); V2.carteTourFit();
      tour.forEach(function (s) { for (var m = 0; markers && m < markers.length; m++) { if (D.p[markers[m]._pi] && D.p[markers[m]._pi][13] === s.id) { refreshMarkerStyle(markers[m]._pi); break; } } });
      var nCli = tour.filter(function (s) { return (D.seg[s.sg] || '').indexOf('Client') === 0; }).length;
      var nPro = tour.length - nCli;
      if (V2.toast) V2.toast(tour.length + ' arrêts (' + nCli + ' clients · ' + nPro + ' prospects) · ' + Math.round(routeKm()) + ' km'
        + (plan._excluded ? ' · ' + plan._excluded + ' prospects hors zone écartés' : '')
        + (res.sim && !res.sim.ok ? ' · ⚠ RDV serré' : ''));
    };

    if (addr) {
      if (V2.toast) V2.toast('Localisation de « ' + addr + ' »…');
      geocodeAddress(addr, function (pt) { if (!pt) { if (V2.toast) V2.toast('Adresse « ' + addr + ' » introuvable'); return; } run({ n: pt.label || addr, lat: pt.lat, lng: pt.lng }); });
    } else run(null);
  };
  // Depuis le popup d'une pharmacie : « partir d'ici » compose la tournée autour d'elle.
  V2.carteTourFrom = function (i) {
    if (!D || !D.p[i]) return;
    V2.carteTourOpen();
    var inp = document.getElementById('cn-tgen-start'); if (inp) inp.value = D.p[i][6] || D.p[i][7] || '';
    V2.carteBuildTour();
  };
  // Tracé de la tournée sur la carte (ligne + pastilles numérotées)
  function drawTourLine() {
    if (!map || !window.L) return;
    if (tourLayer) { map.removeLayer(tourLayer); tourLayer = null; }
    var pts = routeStops(); if (pts.length < 2) return;
    tourLayer = window.L.layerGroup();
    // Vraie route (géométrie OSRM) si dispo, sinon lignes droites entre arrêts.
    var real = routeReal();
    var line = (real && real.geometry && real.geometry.length > pts.length) ? real.geometry : pts.map(function (s) { return [s.lat, s.lng]; });
    window.L.polyline(line, { color: '#0050E6', weight: 3, opacity: 0.85, dashArray: '1,0' }).addTo(tourLayer);
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
  function routeKmFor(arr) { var pts = []; if (depot) pts.push(depot); for (var j = 0; j < arr.length; j++) pts.push(arr[j]); if (depot && arr.length) pts.push(depot); var d = 0; for (var k = 1; k < pts.length; k++) d += roadKm(pts[k - 1], pts[k]); return d; }
  function nearRoute(P) { var pts = routeStops(), m = Infinity; for (var j = 0; j < pts.length; j++) { var d = haversine(pts[j], P); if (d < m) m = d; } return m; }
  function bestInsert(P) { var base = routeKmFor(tour), best = { pos: tour.length, add: Infinity }; for (var k = 0; k <= tour.length; k++) { var tmp = tour.slice(); tmp.splice(k, 0, P); var add = routeKmFor(tmp) - base; if (add < best.add) { best.add = add; best.pos = k; } } return best; }
  function computeProspects() {
    if (!D || !tour.length) return [];
    var out = [];
    for (var i = 0; i < D.p.length; i++) {
      var p = D.p[i]; if (!isProspect(p)) continue;
      if (tourPos(keyOf(p)) >= 0) continue;
      var P = { lat: p[0], lng: p[1] };
      if (nearestClientKm(P) > TP.DELIV_RADIUS) continue;   // hors zone de livraison → pas proposé
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
    var stops = routeStops();   // inclut le dépôt en départ/retour si défini
    var coords = stops.map(function (s) { return s.lat + ',' + s.lng; });
    var MAX = 10;   // Google Maps ~10 points max par itinéraire
    // Navigation GPS turn-by-turn : origin/destination/waypoints + dir_action=navigate
    function gmapsUrl(seg) {
      var origin = seg[0], dest = seg[seg.length - 1], way = seg.slice(1, -1);
      var u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&origin=' + origin + '&destination=' + dest;
      if (way.length) u += '&waypoints=' + way.join('%7C');
      return u;
    }
    if (coords.length <= MAX) { window.open(gmapsUrl(coords), '_blank'); return; }
    // tournée longue → découpe en itinéraires qui s'enchaînent (fin d'un = départ du suivant)
    var parts = []; for (var i = 0; i < coords.length - 1; i += MAX - 1) parts.push(coords.slice(i, i + MAX));
    parts.forEach(function (c) { window.open(gmapsUrl(c), '_blank'); });
    if (V2.toast) V2.toast('Tournée longue : GPS ouvert en ' + parts.length + ' itinéraires enchaînés');
  };

  // Export KML de toutes les officines → à importer dans Google My Maps (1 icône/couleur par groupement)
  V2.carteExportKml = function () {
    if (!D || !D.p || !D.p.length) { if (V2.toast) V2.toast('Carte pas encore chargée'); return; }
    var xe = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var kmlColor = function (hex) {   // #rrggbb -> aabbggrr (ordre KML)
      var h = (hex || '#8894a8').replace('#', '');
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      return 'ff' + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2);
    };
    var byGrp = {}, nExp = 0;
    D.p.forEach(function (p) {
      if (!(p[0] && p[1])) return;   // pas de coordonnées -> on saute
      if (!pass(p)) return;          // seulement le set filtré/visible à l'écran (pas les 19 000 pharmacies de France)
      var g = p[3] || '';
      (byGrp[g] = byGrp[g] || []).push(p); nExp++;
    });
    if (!nExp) { if (V2.toast) V2.toast('Aucune officine dans le filtre courant'); return; }
    if (nExp > 9000) { if (V2.toast) V2.toast('Trop d\'officines (' + nExp + ') pour Google My Maps — filtre d\'abord par commercial ou département'); return; }
    var styles = '', folders = '', gi = 0;
    Object.keys(byGrp).forEach(function (g) {
      var gname = (D.grp[g] && D.grp[g] !== '—') ? D.grp[g] : 'Sans groupement';
      var sid = 'grp' + (gi++);
      styles += '<Style id="' + sid + '"><IconStyle><color>' + kmlColor(GRP_COL[g]) + '</color><scale>1.1</scale>' +
        '<Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>';
      var pms = byGrp[g].map(function (p) {
        var ca = caOf(p), seg = D.seg[p[4]] || '', comm = p[5] ? D.comm[p[5]] : '', uga = D.uga[p[2]] || '';
        var desc = [
          xe((p[7] || '') + (p[8] ? ', ' + p[8] : '')),
          p[10] ? 'Titulaire : ' + xe(p[10]) : '',
          p[9] ? 'Tél : ' + xe(p[9]) : '',
          p[11] ? 'Email : ' + xe(p[11]) : '',
          seg ? 'Statut : ' + xe(seg) : '',
          gname !== 'Sans groupement' ? 'Groupement : ' + xe(gname) : '',
          comm ? 'Commercial : ' + xe(comm) : '',
          uga ? 'UGA : ' + xe(uga) : '',
          ca ? 'CA : ' + Math.round(ca).toLocaleString('fr') + ' €' : ''
        ].filter(Boolean).join('\n');
        return '<Placemark><name>' + xe(p[6] || 'Pharmacie') + '</name><description>' + desc + '</description>' +
          '<styleUrl>#' + sid + '</styleUrl><Point><coordinates>' + p[1] + ',' + p[0] + ',0</coordinates></Point></Placemark>';
      }).join('');
      folders += '<Folder><name>' + xe(gname) + ' (' + byGrp[g].length + ')</name>' + pms + '</Folder>';
    });
    var kml = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<name>Officines Intégral Pharma</name>' + styles + folders + '</Document></kml>';
    try {
      var blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'officines-integral-' + new Date().toISOString().slice(0, 10) + '.kml';
      document.body.appendChild(a); a.click();
      setTimeout(function () { if (a.parentNode) document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
      if (V2.toast) V2.toast(nExp + ' officines exportées — importe le .kml dans Google My Maps');
    } catch (e) { if (V2.toast) V2.toast('Export impossible sur ce navigateur', 'error'); }
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
  function tgenHtml() {
    var opts = ''; for (var n = 6; n <= 12; n++) opts += '<option value="' + n + '"' + (n === 8 ? ' selected' : '') + '>' + n + '</option>';
    var _gud = {}; if (D && D.p) D.p.forEach(function (p) { var g = D.grp[p[3]]; if (g && g !== '—') _gud[g] = 1; });
    var grpDl = '<datalist id="cn-grp-datalist">' + Object.keys(_gud).map(function (g) { return '<option value="' + esc(g) + '">'; }).join('') + '</datalist>';
    return grpDl + '<div class="cn-tgen">' +
      '<div class="cn-tgen-t">🧭 Composer ma tournée du jour</div>' +
      '<label class="cn-tgen-fld"><span>Je pars de (mon adresse)</span>' +
        '<div class="cn-tgen-2"><input id="cn-tgen-addr" class="cn-tgen-in" type="search" placeholder="ex. 12 rue Nationale, Nantes" onkeydown="if(event.key===\'Enter\'){event.preventDefault();V2.carteBuildTour();}">' +
        '<input id="cn-tgen-time" class="cn-tgen-time" type="time" value="' + esc(_startTime) + '" title="Heure de départ"></div></label>' +
      '<label class="cn-tgen-fld"><span>Zone à couvrir (ville ou pharmacie, optionnel)</span>' +
        '<input id="cn-tgen-start" class="cn-tgen-in" type="search" placeholder="ex. Angers — vide = autour de mon départ" onkeydown="if(event.key===\'Enter\'){event.preventDefault();V2.carteBuildTour();}"></label>' +
      '<label class="cn-tgen-fld"><span>Groupements à cibler (optionnel)</span>' +
        '<input id="cn-tgen-grp" class="cn-tgen-in" list="cn-grp-datalist" placeholder="ex. Giphar, Aprium, Mediprix" onkeydown="if(event.key===\'Enter\'){event.preventDefault();V2.carteBuildTour();}"></label>' +
      '<div class="cn-tgen-row">' +
        '<label class="cn-tgen-lb">Visites&nbsp;<select id="cn-tgen-n" class="cn-tgen-sel">' + opts + '</select></label>' +
        '<label class="cn-tgen-chk"><input type="checkbox" id="cn-tgen-cli" checked> Inclure mes clients</label>' +
      '</div>' +
      '<button class="v2-btn v2-btn-primary cn-tgen-go" onclick="V2.carteBuildTour()">Générer la tournée</button>' +
      '<div class="cn-tgen-h"><b>Prospection sur ta zone de livraison :</b> on ne propose QUE des prospects à moins de ' + TP.DELIV_RADIUS + ' km d\'un client Intégral (là où tu livres déjà) — pour limiter les coûts de livraison. Les prospects isolés sont écartés. Optimise <b>sur les axes</b> et respecte les RDV. Astuce : « + Ajouter à ma tournée » sur une pharmacie → arrêt imposé.</div>' +
    '</div>';
  }
  function renderTourPanel() {
    var el = document.getElementById('cn-tourpanel'); if (!el) return;
    var sched = tour.length ? computeSchedule() : [];
    // ── FRISE HORAIRE (agenda) : heure d'arrivée + trajet entre chaque arrêt ──
    var timeline = tour.map(function (s, j) {
      var sc = sched[j] || {};
      var a = (j === 0) ? (depot || null) : { lat: tour[j - 1].lat, lng: tour[j - 1].lng };
      var legHtml = '';
      if (a && isFinite(s.lat) && isFinite(s.lng)) {
        var dm = Math.round(legMinFor(j, a, { lat: s.lat, lng: s.lng }));
        var dk = Math.round(legKmFor(j, a, { lat: s.lat, lng: s.lng }));
        legHtml = '<div class="cn-tlleg"><span class="cn-tllegtxt">🚗 ' + fmtDur(dm) + ' · ' + dk + ' km</span></div>';
      }
      var arr = sc.arr != null ? fmtHM(sc.arr) : '';
      var gq = encodeURIComponent((s.n || '') + ' ' + (s.v || '') + ' ' + (s.c || ''));
      var stopHtml = '<div class="cn-tlstop' + (sc.late ? ' late' : '') + '">' +
        '<span class="cn-tltime' + (sc.late ? ' late' : '') + '">' + arr + '</span>' +
        '<span class="cn-tlnum">' + (j + 1) + '</span>' +
        '<div class="cn-tlbody"><b>' + esc(s.n) + '</b><span class="cn-tlsub">' + esc(s.v) + ' · ' + esc(s.c) + (s.t ? ' · ' + esc(s.t) : '') + '</span>' +
          '<div class="cn-trdvrow"><label class="cn-trdvl">RDV <input type="time" class="cn-trdv" value="' + esc(s.rdv || '') + '" onchange="V2.carteTourRdv(' + j + ',this.value)"></label>' +
            (sc.wait ? '<span class="cn-twait">attente RDV</span>' : '') +
            (sc.late ? '<span class="cn-tlate">en retard</span>' : '') +
            '<a class="cn-tmaps" href="https://www.google.com/maps/search/?api=1&query=' + gq + '" target="_blank" rel="noopener" title="Ouvrir dans Google Maps">Maps ↗</a></div>' +
        '</div>' +
        '<button class="cn-trm" onclick="V2.carteTourRemove(' + j + ')" title="Retirer">✕</button></div>';
      return legHtml + stopHtml;
    }).join('');
    var depHead = tour.length ? '<div class="cn-tldep"><span class="cn-tltime">' + esc(_startTime) + '</span><span class="cn-tldeplbl">Départ' + (depot && depot.n ? ' · ' + esc(depot.n) : '') + '</span></div>' : '';
    var rows = tour.length ? '<div class="cn-tl">' + depHead + timeline + '</div>'
      : '<div class="cn-tempty">Ta tournée est vide.<br>Utilise « Composer ma tournée » ci-dessus, ou clique une pharmacie → « Partir d\'ici ».</div>';
    var kmTot = Math.round(routeKm());
    var perStop = tour.length ? (Math.round(kmTot / tour.length * 10) / 10) : 0;
    var isReal = !!routeReal();   // temps/distances issus du vrai réseau routier OSRM ?
    var srcBadge = tour.length ? '<div class="cn-tsrc' + (isReal ? ' real' : '') + '">' +
      (isReal ? '🛰️ Temps réels par la route' : (_routeFetching ? '⏳ Calcul des vrais temps…' : '≈ Estimation')) + '</div>' : '';
    var metrics = tour.length ? '<div class="cn-tmetrics">' +
      '<div class="cn-tmetric"><b>' + tour.length + '</b><span>arrêt' + (tour.length > 1 ? 's' : '') + '</span></div>' +
      '<div class="cn-tmetric"><b>' + kmTot + ' km</b><span>total' + (depot ? ' (dépôt inclus)' : '') + '</span></div>' +
      '<div class="cn-tmetric"><b>' + fmtDur(estMinutes()) + '</b><span>temps' + (isReal ? ' réel' : ' estimé') + '</span></div>' +
      '<div class="cn-tmetric"><b>' + perStop + '</b><span>km / arrêt</span></div>' +
      '</div>' + srcBadge : '';
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
      tgenHtml() +
      metrics + depotRow +
      '<div class="cn-plist">' + rows + '</div>' +
      (tour.length >= 1 ? '<div class="cn-gps-wrap"><button class="v2-btn v2-btn-primary cn-gps-btn" onclick="V2.carteTourItinerary()">' + ICO('pharma', 17) + 'Ouvrir dans Google Maps (GPS)</button></div>' : '') +
      '<div class="cn-pacts">' +
        (tour.length >= 2 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourOptimize()">Ré-optimiser</button>' : '') +
        (tour.length >= 1 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourSaveAs()">Enregistrer</button>' : '') +
        '<button class="v2-btn v2-btn-ghost" onclick="V2.carteToursOpen()">Mes tournées</button>' +
        (tour.length >= 1 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteProspects()">Prospects proches</button>' : '') +
        (tour.length >= 1 ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteTourClear()">Vider</button>' : '') +
        '</div>' +
      '</div>';
    maybeRefreshRoute();   // si les vrais temps ne sont pas à jour, on les récupère puis on re-render
  }

  function legendHtml() {
    var lg = function (c, t) { return '<span class="cn-lg"><i style="background:' + c + '"></i>' + esc(t) + '</span>'; };
    if (zonesOn) {
      if (zoneMetric === 'part') return lg('#0B6E43', '≥ 25 % clients') + lg('#2E9E66', '15–25 %') + lg('#5CC98A', '7–15 %') + lg('#BFE6CF', '1–7 %') + lg('#EDEFF3', '0 %');
      if (zoneMetric === 'densite') return lg('#08306B', '≥ 400 officines') + lg('#2171B5', '250–400') + lg('#6BAED6', '120–250') + lg('#BDD7E7', '40–120') + lg('#EDEFF3', '< 40');
      if (zoneMetric === 'tension') return lg('#B01532', '≥ 4 200 hab./officine') + lg('#E8546A', '3 400–4 200 · sous-doté') + lg('#FBD08A', '2 800–3 400') + lg('#9FD9B5', '2 200–2 800') + lg('#2E9E66', '< 2 200 · bien doté');
      return lg('#7A2E0E', '≥ 500 prospects') + lg('#C2410C', '300–500') + lg('#EA580C', '150–300') + lg('#FDBA74', '40–150') + lg('#EDEFF3', '< 40');
    }
    if (colorMode === 'comm') {
      var out = '';
      for (var k = 1; k < D.comm.length; k++) out += lg(COMM_COL[k], D.comm[k]);
      return out + lg(PROSPECT_COL, 'Prospect (à conquérir)') + lg('#D4DAE3', 'Hors réseau');
    }
    if (colorMode === 'type') return lg(SEG_COL['Client A'], 'Client A · gros (≥ 40 k€)') + lg(SEG_COL['Client B'], 'Client B · moyen (12–40 k€)') + lg(SEG_COL['Client C'], 'Client C · petit (< 12 k€)') + lg(SEG_COL.Prospect, 'Prospect (à conquérir)');
    if (colorMode === 'grp') return Object.keys(GRP_COL).map(function (g) { return lg(GRP_COL[g], D.grp[g]); }).join('') + lg('#CBD2DD', 'Autres');
    if (colorMode === 'ca') return lg('#FCD34D', '< 2 k€') + lg('#F59E0B', '2–8 k€') + lg('#EA580C', '8–20 k€') + lg('#C7283D', '20–50 k€') + lg('#7A0C2E', '≥ 50 k€') + lg('#E2E6EC', 'Pas de CA');
    return '<span class="cn-lg-txt">' + (D ? D.uga.length : 0) + ' UGA · une couleur par secteur</span>';
  }

  function injectCss() {
    if (document.getElementById('v2-carte-css')) return;
    var s = document.createElement('style'); s.id = 'v2-carte-css';
    s.textContent = [
      '.cn-shell{display:flex;flex-direction:column;height:calc(100vh - var(--topbar-h,60px));height:calc(100dvh - var(--topbar-h,60px));min-height:560px}',
      '.cn-wrap{display:flex;flex-direction:row;flex:1 1 auto;min-height:0}',
      // ── Barre de filtres « Direction 2 » ──
      '.cn-fb{flex:none;background:var(--card);border-bottom:1px solid var(--line);padding:9px 16px 8px;display:flex;flex-direction:column;gap:8px}',
      '.cn-fbtop{display:flex;align-items:center;gap:10px}',
      '.cn-fbsearch{flex:1;min-width:0;max-width:420px}',
      '.cn-fbcount{margin-left:auto;font-size:13px;font-weight:800;color:var(--ip-blue,#0057FF);white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.cn-fb-toggle{display:none;font:inherit;font-size:13px;font-weight:700;color:var(--ip-ink);background:var(--card-2,#F4F6FB);border:1px solid var(--line);border-radius:999px;padding:7px 13px;cursor:pointer}',
      '.cn-fbrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.cn-fb-item{position:relative}',
      '.cn-fb-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:12.5px;font-weight:700;color:var(--ip-ink);background:var(--card-2,#F4F6FB);border:1px solid var(--line);border-radius:999px;padding:7px 13px;cursor:pointer;transition:border-color .14s var(--ease,ease),background .14s var(--ease,ease)}',
      '.cn-fb-btn:hover{border-color:var(--ip-blue,#0057FF)}',
      '.cn-fb-btn.on{background:color-mix(in srgb,var(--ip-blue,#0057FF) 12%,var(--card));border-color:var(--ip-blue,#0057FF);color:var(--ip-blue,#0057FF)}',
      '.cn-fb-btn.open{border-color:var(--ip-blue,#0057FF)}',
      '.cn-fb-car{font-style:normal;font-size:10px;opacity:.6;margin-left:1px}',
      '.cn-fb-soon{opacity:.5;cursor:not-allowed}',
      '.cn-fb-soon:hover{border-color:var(--line)}',
      '.cn-fb-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:1200;min-width:230px;max-width:min(320px,86vw);background:var(--card,#fff);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 34px rgba(11,19,28,.22);padding:8px;display:flex;flex-direction:column;gap:6px}',
      '.cn-fb-msearch .cn-fb-tin,.cn-fb-txt .cn-fb-tin{width:100%}',
      '.cn-fb-tin{font:inherit;font-size:13px;color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:9px;padding:8px 11px}',
      '.cn-fb-tin:focus{outline:none;border-color:var(--ip-blue,#0057FF);box-shadow:0 0 0 3px color-mix(in srgb,var(--ip-blue,#0057FF) 14%,transparent)}',
      '.cn-fb-mlist{display:flex;flex-direction:column;gap:2px;max-height:300px;overflow-y:auto}',
      '.cn-fb-opt{flex:none;text-align:left;font:inherit;font-size:12.5px;font-weight:600;line-height:1.35;color:var(--ip-ink);background:none;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:7px}',
      '.cn-fb-opt::before{content:"";flex:none;width:15px;height:15px;border:1.5px solid var(--line-strong,#c3c9d4);border-radius:5px;background:var(--card)}',
      '.cn-fb-opt.on::before{background:var(--ip-blue,#0057FF);border-color:var(--ip-blue,#0057FF);box-shadow:inset 0 0 0 2px var(--card)}',
      '.cn-fb-opt.on{color:var(--ip-blue,#0057FF);font-weight:800}',
      '.cn-fb-opt.cn-fb-optall::before{border-radius:999px}',
      '.cn-fb-opt:hover{background:var(--card-2,#F4F6FB)}',
      '.cn-fb-opt.on{background:color-mix(in srgb,var(--ip-blue,#0057FF) 12%,transparent);color:var(--ip-blue,#0057FF);font-weight:800}',
      '.cn-fb-mempty{padding:12px 10px;font-size:12.5px;color:var(--muted);text-align:center}',
      '.cn-fb-ca{display:flex;flex-direction:column;gap:9px;padding:4px 4px 2px;min-width:220px}',
      '.cn-fb-ca-lbl{font-size:13px;font-weight:800;color:var(--ip-blue,#0057FF);text-align:center;font-variant-numeric:tabular-nums}',
      '.cn-fb-ca-row{display:flex;align-items:center;gap:9px;font-size:11.5px;font-weight:700;color:var(--muted)}',
      '.cn-fb-ca-row span{flex:none;width:30px}',
      '.cn-fb-ca-row input[type=range]{flex:1;accent-color:var(--ip-blue,#0057FF)}',
      '.cn-fb-ca-clr{font:inherit;font-size:12px;font-weight:700;color:var(--muted);background:var(--card-2,#F4F6FB);border:1px solid var(--line);border-radius:8px;padding:7px;cursor:pointer}',
      '.cn-fb-ca-clr:hover{border-color:var(--ip-blue,#0057FF);color:var(--ip-blue,#0057FF)}',
      '.cn-fbchips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.cn-fbchips:empty{display:none}',
      '.cn-fb-chip{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:700;color:var(--ip-blue,#0057FF);background:color-mix(in srgb,var(--ip-blue,#0057FF) 10%,transparent);border:1px solid color-mix(in srgb,var(--ip-blue,#0057FF) 22%,transparent);border-radius:999px;padding:3px 6px 3px 10px}',
      '.cn-fb-x{border:none;background:none;color:var(--ip-blue,#0057FF);font:inherit;font-size:12px;line-height:1;cursor:pointer;padding:2px 3px;border-radius:50%}',
      '.cn-fb-x:hover{background:color-mix(in srgb,var(--ip-blue,#0057FF) 18%,transparent)}',
      '.cn-fb-clear{border:none;background:none;color:var(--muted);font:inherit;font-size:11.5px;font-weight:700;cursor:pointer;text-decoration:underline;padding:3px 4px}',
      '.cn-fb-clear:hover{color:var(--ip-blue,#0057FF)}',
      '@media(max-width:760px){.cn-fb-toggle{display:inline-flex}.cn-fbrow{display:none}.cn-fb.open .cn-fbrow{display:flex}.cn-fbsearch{max-width:none}.cn-fb-menu{min-width:200px;max-width:min(300px,80vw);right:auto}}',
      '@media(prefers-reduced-motion:reduce){.cn-fb-btn{transition:none}}',
      // Bulle de survol enrichie (multi-lignes)
      '.cn-tip{padding:7px 10px!important;border:none!important;border-radius:9px!important;box-shadow:0 6px 20px rgba(11,19,28,.22)!important;max-width:230px!important}',
      '.cn-tip b{display:block;font-size:12.5px;font-weight:700;color:#0B131C;line-height:1.25}',
      '.cn-tip i{display:block;font-style:normal;font-size:11px;color:#5A6472;margin-top:1px}',
      '.cn-tip span{display:block;font-size:11px;color:#5A6472;margin-top:2px}',
      '.cn-tip em{display:block;font-style:normal;font-size:10.5px;font-weight:600;color:#0057FF;margin-top:3px}',
      '.cn-side{width:288px;flex:none;overflow-y:auto;background:var(--card);border-right:1px solid var(--line);padding:16px 15px 22px;display:flex;flex-direction:column;gap:16px}',
      '.cn-sgroup{display:flex;flex-direction:column;gap:8px}',
      '.cn-seg-wrap{flex-wrap:wrap}',
      '.cn-side .cn-sel{max-width:none;width:100%}',
      '.cn-side .cn-search{width:100%}',
      '.cn-side .cn-legend{padding:0;border:none;background:none;flex-direction:column;gap:6px}',
      '.cn-lg-note{font-size:11.5px;color:var(--muted);font-weight:600;line-height:1.4}',
      // Générateur de tournée (dans le panneau « Ma tournée »)
      '.cn-tgen{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:9px;background:color-mix(in srgb,var(--blue) 4%,var(--card))}',
      '.cn-tgen-t{font-size:13px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink)}',
      '.cn-tgen-in{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:13.5px;background:var(--card);color:var(--ip-ink)}',
      '.cn-tgen-in:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue) 14%,transparent)}',
      '.cn-tgen-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}',
      '.cn-tgen-lb{font-size:12.5px;font-weight:600;color:var(--ip-ink);display:inline-flex;align-items:center}',
      '.cn-tgen-sel{padding:5px 8px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:13px;background:var(--card);color:var(--ip-ink)}',
      '.cn-tgen-chk{font-size:12.5px;font-weight:600;color:var(--ip-ink);display:inline-flex;align-items:center;gap:6px;cursor:pointer}',
      '.cn-tgen-go{width:100%;justify-content:center}',
      '.cn-tgen-h{font-size:11px;line-height:1.45;color:var(--muted)}',
      '.cn-tgen-fld{display:flex;flex-direction:column;gap:4px;font-size:11.5px;font-weight:600;color:var(--muted)}',
      '.cn-tgen-2{display:flex;gap:7px}',
      '.cn-tgen-2 .cn-tgen-in{flex:1}',
      '.cn-tgen-time{padding:9px 8px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:13px;background:var(--card);color:var(--ip-ink)}',
      '.cn-trdvrow{display:flex;align-items:center;gap:8px;margin-top:4px}',
      '.cn-tarr{font-size:11px;font-weight:700;color:var(--blue);font-variant-numeric:tabular-nums}',
      '.cn-tarr.late{color:#C7283D}',
      '.cn-trdvl{font-size:10.5px;font-weight:600;color:var(--muted);display:inline-flex;align-items:center;gap:4px}',
      '.cn-trdv{padding:2px 5px;border:1px solid var(--line);border-radius:6px;font:inherit;font-size:11px;background:var(--card);color:var(--ip-ink)}',
      '.cn-tmaps{margin-left:auto;font-size:10.5px;font-weight:700;color:var(--blue);text-decoration:none;white-space:nowrap}',
      '.cn-tmaps:hover{text-decoration:underline}',
      // Bouton GPS Google Maps : plein largeur, bien visible sous le listing
      '.cn-gps-wrap{padding:12px 16px 0}',
      '.cn-gps-btn{width:100%;justify-content:center;gap:8px;font-size:15px;font-weight:800;padding:13px}',
      '.cn-tour-from{background:#fff!important;color:var(--blue)!important;border:1px solid color-mix(in srgb,var(--blue) 30%,var(--line))!important}',
      '.cn-listmore{display:block;width:calc(100% - 24px);margin:8px 12px 14px;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--blue);font:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.cn-listmore:hover{background:color-mix(in srgb,var(--blue) 8%,var(--card))}',
      '.cn-side .cn-tools{padding:0;border:none;background:none;flex-direction:column;align-items:stretch;gap:8px}',
      // Éditorial : « Ma tournée » = CTA clair, phrase d\'aide, export en lien discret
      '.cn-tour-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 16px;border:none;border-radius:12px;background:linear-gradient(150deg,#0057FF,#0034A0);color:#fff;font:inherit;font-size:14px;font-weight:700;letter-spacing:-.01em;cursor:pointer;box-shadow:0 8px 20px rgba(0,52,160,.22);transition:transform .16s var(--ease),box-shadow .16s var(--ease)}',
      '.cn-tour-cta svg{color:#fff}',
      '.cn-tour-cta:hover{transform:translateY(-1px);box-shadow:0 12px 26px rgba(0,52,160,.28)}',
      '.cn-tour-hint{margin:0;font-size:12px;line-height:1.45;color:var(--muted);text-align:left}',
      '.cn-side .cn-tools .cn-export-link{display:inline-flex;align-items:center;gap:6px;width:auto;align-self:flex-start;padding:4px 2px;border:none;background:none;color:var(--muted);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;text-align:left}',
      '.cn-export-link svg{color:var(--muted)}',
      '.cn-side .cn-tools .cn-export-link:hover{color:var(--ip-blue,#0057FF)}',
      '.cn-export-link:hover svg{color:var(--ip-blue,#0057FF)}',
      '@media(max-width:760px){.cn-wrap{flex-direction:column}.cn-side{width:100%;max-height:40vh;border-right:none;border-bottom:1px solid var(--line)}.cn-maparea{min-height:0}}',
      '.cn-bar{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;padding:9px 16px;border-bottom:1px solid var(--line);background:var(--card)}',
      '.cn-title{font-weight:800;font-size:15px;color:var(--ip-ink);display:flex;align-items:baseline;gap:8px}',
      '.cn-title small{font-weight:600;font-size:12px;color:var(--muted)}',
      '.cn-grp{display:flex;align-items:center;gap:6px}',
      '.cn-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2)}',
      '.cn-seg{display:inline-flex;background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-pill);padding:2px;gap:2px}',
      '.cn-seg button{border:none;background:transparent;font:inherit;font-size:12px;font-weight:700;color:var(--muted);padding:6px 11px;border-radius:var(--r-pill);cursor:pointer}',
      '.cn-seg button.on{background:var(--ip-blue);color:#fff}',
      '.cn-sel{font:inherit;font-size:13px;font-weight:600;color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:var(--r-control,10px);padding:7px 10px;max-width:190px}',
      // petit toggle Points/Bulles sous le sélecteur « Colorer par »
      '.cn-disp{display:inline-flex;margin-top:8px;align-self:flex-start;background:var(--card-2,#F4F6FB);border:1px solid var(--line);border-radius:var(--r-pill);padding:2px;gap:2px}',
      '.cn-disp button{border:none;background:transparent;font:inherit;font-size:11.5px;font-weight:700;color:var(--muted);padding:5px 11px;border-radius:var(--r-pill);cursor:pointer}',
      '.cn-disp button.on{background:var(--ip-blue,#0057FF);color:#fff}',
      '.cn-spacer{margin-left:auto}',
      '.cn-legend{display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px 16px;border-bottom:1px solid var(--line);background:var(--card-2)}',
      '.cn-lg{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:var(--ip-ink-2,#2A2F3C)}',
      '.cn-lg i{width:11px;height:11px;border-radius:50%;display:inline-block}',
      '.cn-lg-txt{font-size:12px;color:var(--muted);font-weight:600}',
      '.cn-maparea{position:relative;flex:1 1 auto;min-height:60vh}',
      '#carte-map{position:absolute;inset:0;background:#EAF0F6}',
      // Bouton flottant TOUJOURS visible : ouvre l\'organisateur de tournée
      '.cn-organiser{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:600;display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border:none;border-radius:999px;background:linear-gradient(150deg,#0057FF,#0034A0);color:#fff;font:inherit;font-size:14px;font-weight:800;letter-spacing:-.01em;cursor:pointer;box-shadow:0 10px 26px rgba(0,52,160,.34);transition:transform .16s var(--ease,ease),box-shadow .16s var(--ease,ease)}',
      '.cn-organiser svg{color:#fff}',
      '.cn-organiser:hover{transform:translateX(-50%) translateY(-1px);box-shadow:0 14px 32px rgba(0,52,160,.42)}',
      '@media(max-width:640px){.cn-organiser{font-size:13px;padding:10px 14px;top:8px}.cn-organiser span{display:inline}}',
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
      // Bloc éditable (Infos officine + notes) dans le panneau fiche
      '.cn-fedit{padding:2px 14px 10px}',
      '.cn-fedit .v2-profil-box,.cn-fedit .v2-notes-box{margin-top:12px}',
      '.cn-fedit .v2-profil-grid{grid-template-columns:1fr}',
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
      // ── Frise horaire (agenda tournée) ──
      '.cn-tl{padding:6px 2px 4px}',
      '.cn-tldep{display:flex;align-items:center;gap:10px;padding:4px 14px 8px}',
      '.cn-tltime{flex:none;width:44px;text-align:right;font:700 12.5px/1 "Geist Mono",ui-monospace,monospace;color:var(--ip-blue,#0057FF);font-variant-numeric:tabular-nums}',
      '.cn-tltime.late{color:#DC2626}',
      '.cn-tldeplbl{font-size:12.5px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}',
      '.cn-tlleg{padding:1px 14px 1px 66px}',
      '.cn-tllegtxt{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);padding:3px 0 3px 12px;border-left:2px dotted var(--line)}',
      '.cn-tlstop{display:flex;align-items:flex-start;gap:10px;padding:7px 14px;border-radius:10px}',
      '.cn-tlstop.late{background:rgba(220,38,38,.05)}',
      '.cn-tlnum{flex:none;width:24px;height:24px;margin-top:1px;border-radius:50%;background:var(--ip-blue,#0057FF);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}',
      '.cn-tlstop.late .cn-tlnum{background:#DC2626}',
      '.cn-tlbody{flex:1;min-width:0}',
      '.cn-tlbody b{display:block;font-size:13.5px;font-weight:700;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cn-tlsub{display:block;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}',
      '.cn-twait{font-size:10.5px;font-weight:800;color:#B45309;background:#FEF3C7;padding:2px 6px;border-radius:6px}',
      '.cn-tlate{font-size:10.5px;font-weight:800;color:#fff;background:#DC2626;padding:2px 6px;border-radius:6px}',
      '.cn-tmetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 16px;border-bottom:1px solid var(--line)}',
      '.cn-tmetric{text-align:center;background:var(--card-2,#F4F6FB);border-radius:10px;padding:8px 4px}',
      '.cn-tmetric b{display:block;font-size:15px;font-weight:800;color:var(--ip-blue,#0057FF)}',
      '.cn-tmetric span{display:block;font-size:10.5px;color:var(--muted);margin-top:1px}',
      '.cn-tsrc{padding:6px 16px 10px;font-size:11px;font-weight:700;color:var(--muted)}',
      '.cn-tsrc.real{color:#0B6E43}',
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
      '.cn-lloc{flex:none;width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--muted);font-size:14px;cursor:pointer}',
      '.cn-lloc:hover{border-color:var(--ip-blue,#0057FF);color:var(--ip-blue,#0057FF)}',
      '.cn-pacts{display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px;border-top:1px solid var(--line)}',
      '.cn-pacts .v2-btn{flex:1 1 auto}',
      // ── DOCK : liste toujours visible à droite de la carte (desktop) ──
      '.cn-dock{width:324px;flex:none;display:flex;flex-direction:column;background:var(--card);border-left:1px solid var(--line);overflow:hidden}',
      '.cn-dockhead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}',
      '.cn-dockhead b{font-size:14px;font-weight:800;color:var(--ip-ink)}.cn-dockhead small{display:block;font-size:11.5px;color:var(--muted);margin-top:1px}',
      '.cn-dock .cn-plist{padding:4px 0}',
      '.cn-dock .cn-lrow{padding:9px 12px}',
      '.cn-dock .cn-sortseg button{font-size:11.5px;padding:4px 9px}',
      '@media(max-width:980px){.cn-dock{display:none}}',
      '@media(min-width:981px){.cn-listbtn-mob{display:none}}',   // dock présent : bouton liste redondant sur desktop
      '.cn-dockflt{display:flex;flex-wrap:wrap;gap:5px;padding:0 14px 10px}',
      '.cn-dockflt .cn-fchip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--ip-blue,#0057FF);background:color-mix(in srgb,var(--ip-blue,#0057FF) 10%,transparent);border:1px solid color-mix(in srgb,var(--ip-blue,#0057FF) 22%,transparent);border-radius:999px;padding:3px 9px}',
      '.cn-dockflt .cn-fclear{border:none;background:none;color:var(--muted);font:inherit;font-size:11px;font-weight:700;cursor:pointer;text-decoration:underline;padding:3px 4px}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // Réconciliation avec WML_OFFICINES (source de vérité clients) : corrige le statut client/prospect
  // et le groupement de la base nationale (PHARMA_FR), qui sont faux/vides pour les vrais clients.
  function reconcileWithWml() {
    var W = window.WML_OFFICINES; if (!W || !W.length || !D || !D.seg || !D.p) return;
    var segIdx = {}; for (var s = 0; s < D.seg.length; s++) segIdx[D.seg[s]] = s;
    function ensureSeg(l) { if (segIdx[l] == null) { D.seg.push(l); segIdx[l] = D.seg.length - 1; } return segIdx[l]; }
    var iA = ensureSeg('Client A'), iB = ensureSeg('Client B'), iC = ensureSeg('Client C'), iPro = ensureSeg('Prospect');
    // Canon = même règle que build_pharma_fr.py (accents + ponctuation + casse ignorés)
    // pour ne PAS recréer « LEADERSANTE » à côté de « Leadersanté » (WML sans accent).
    var canon = function (s) { return String(s || '').normalize ? String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '') : String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    var grpIdx = {}; for (var g = 0; g < D.grp.length; g++) grpIdx[canon(D.grp[g])] = g;
    function ensureGrp(name) { var k = canon(name); if (grpIdx[k] == null) { D.grp.push(name); grpIdx[k] = D.grp.length - 1; } return grpIdx[k]; }
    var wml = {}; W.forEach(function (o) { if (o && o.id) wml[String(o.id).replace(/[^0-9]/g, '')] = o; });
    var nClient = 0, nDemoted = 0;
    D.p.forEach(function (p) {
      var o = wml[String(p[13] || '').replace(/[^0-9]/g, '')];
      if (o) {   // vrai client Intégral → tier selon CA + groupement depuis WML (vérité)
        var ca = p[12] || 0;
        p[4] = ca >= 40000 ? iA : (ca >= 12000 ? iB : iC);
        var gr = o.groupement && String(o.groupement).trim();
        if (gr && gr !== '—') p[3] = ensureGrp(V2.canonGrp ? V2.canonGrp(gr) : gr);
        nClient++;
      } else if (D.seg[p[4]] !== 'Prospect') {   // pas un client WML → prospect (faux clients ET « Non défini »)
        p[4] = iPro; nDemoted++;
      }
    });
    // Canonicalise tous les groupements + corrections manuelles (cohérence appli)
    if (window.GRP_ALIAS && V2.canonGrp) D.p.forEach(function (p) { var g = D.grp[p[3]]; if (g && g !== '—') { var cg = V2.canonGrp(g); if (cg !== g) p[3] = ensureGrp(cg); } });
    var _OV = window.GRP_OVR; if (_OV) D.p.forEach(function (p) { var g = _OV[String(p[13] || '').replace(/[^0-9]/g, '')]; if (g) p[3] = ensureGrp(g); });
    if (D.meta) D.meta.clients = nClient;
    try { console.log('[carte] WML réconcilié : ' + nClient + ' clients confirmés · ' + nDemoted + ' faux clients → prospects'); } catch (e) {}
  }

  function boot(root) {
    D = window.PHARMA_FR;
    reconcileWithWml();   // WML = vérité clients : corrige statut + groupement AVANT tout calcul de couleur
    loadTour();
    try { var dp = JSON.parse(localStorage.getItem('jarvis_depot_v1') || 'null'); if (dp && dp.lat) depot = dp; } catch (e) {}
    computeColors();
    // Valeurs des menus de la barre de filtres (calculées sur les données réellement présentes)
    COMMS = D.comm.slice(1).filter(function (c) { return c; });
    var _gu = {}; D.p.forEach(function (p) { var g = D.grp[p[3]]; if (g && g !== '—') _gu[g] = 1; });
    GRPS = Object.keys(_gu).sort(function (a, b) { return a.localeCompare(b, 'fr', { sensitivity: 'base' }); });
    var _du = {}; D.p.forEach(function (p) { var d = deptOf(p[8]); if (d) _du[d] = 1; });
    DEPTS = Object.keys(_du).sort();
    var _uu = {}; D.p.forEach(function (p) { var u = D.uga[p[2]]; if (u) _uu[u] = 1; });
    UGAS = Object.keys(_uu).sort(function (a, b) { return a.localeCompare(b, 'fr', { sensitivity: 'base' }); });
    var _cm = 0; D.p.forEach(function (p) { var c = caOf(p); if (c > _cm) _cm = c; });
    CA_HI = Math.max(10000, Math.ceil(_cm / 10000) * 10000);
    root.querySelector('#carte-legend').innerHTML = legendHtml();
    renderFbRow(); renderFbChips();   // barre de filtres Direction 2
    // Nettoie une éventuelle carte précédente (évite l'accumulation d'instances Leaflet au fil des visites).
    if (map) { try { map.remove(); } catch (e) {} map = null; cluster = null; markers = null; }
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

  // ══ BARRE DE FILTRES « Direction 2 » ══════════════════════════════════
  // Un bouton par critère → petit menu de valeurs · pastilles retirables · compteur live.
  // Tout passe par les mêmes variables d'état + pass() : filtres 100 % cumulables.
  function caLabel() { if (!caMin && !caMax) return 'Tranche de CA'; return (caMin ? eurK(caMin) : '0') + ' – ' + (caMax ? eurK(caMax) : 'max'); }
  // Menus « liste » (choix par index → aucun échappement de guillemet dans le onclick)
  function fbMenuData(key) {
    if (key === 'statut') return { setter: 'carteType', cur: typeFocus, multi: false, search: false, opts: [['all', 'Toutes les officines'], ['clients', 'Clients'], ['prospects', 'Prospects']] };
    if (key === 'comm') return { setter: 'carteComm', cur: commFocus, multi: true, search: COMMS.length > 10, opts: [['', 'Tous les commerciaux']].concat(COMMS.map(function (c) { return [c, c]; })) };
    if (key === 'uga') return { setter: 'carteUga', cur: ugaFocus, multi: true, search: true, opts: [['', 'Toutes les UGA']].concat(UGAS.map(function (u) { return [u, u]; })) };
    if (key === 'grp') return { setter: 'carteGrp', cur: grpFocus, multi: true, search: true, opts: [['', 'Tous les groupements']].concat(GRPS.map(function (g) { return [g, g]; })) };
    if (key === 'dept') return { setter: 'carteDept', cur: deptFocus, multi: true, search: true, opts: [['', 'Tous les départements']].concat(DEPTS.map(function (d) { return [d, d + ' · ' + (DEPT_NAMES[d] || '')]; })) };
    return null;
  }
  function fbRenderMenuList() {
    var d = fbMenuData(fbOpen); if (!d) return '';
    var q = norm(fbFilter);
    var opts = d.opts.filter(function (o) { return !q || o[0] === '' || norm(o[1]).indexOf(q) >= 0; });
    fbMenuOpts = opts; fbMenuSetter = d.setter;
    return opts.map(function (o, i) {
      var on = d.multi ? (o[0] === '' ? d.cur.length === 0 : d.cur.indexOf(o[0]) >= 0) : (d.cur === o[0]);
      return '<button class="cn-fb-opt' + (on ? ' on' : '') + (o[0] === '' ? ' cn-fb-optall' : '') + '" onclick="V2.carteFbPickIdx(' + i + ')">' + esc(o[1]) + '</button>';
    }).join('') || '<div class="cn-fb-mempty">Aucun résultat</div>';
  }
  function fbMenuHtml(key) {
    if (key === 'ca') {
      return '<div class="cn-fb-ca">' +
        '<div class="cn-fb-ca-lbl" id="cn-ca-lbl">' + esc(caLabel()) + '</div>' +
        '<label class="cn-fb-ca-row"><span>Mini</span><input type="range" id="cn-ca-min" min="0" max="' + CA_HI + '" step="1000" value="' + caMin + '" oninput="V2.carteCARange(\'min\',this.value)"></label>' +
        '<label class="cn-fb-ca-row"><span>Maxi</span><input type="range" id="cn-ca-max" min="0" max="' + CA_HI + '" step="1000" value="' + (caMax || CA_HI) + '" oninput="V2.carteCARange(\'max\',this.value)"></label>' +
        '<button class="cn-fb-ca-clr" onclick="V2.carteFilterRemove(\'ca\')">Réinitialiser</button>' +
        '</div>';
    }
    if (key === 'ville' || key === 'tit') {
      var cur = key === 'ville' ? villeFocus : titFocus, setter = key === 'ville' ? 'carteVille' : 'carteTit';
      var ph = key === 'ville' ? 'ex. Nantes' : 'ex. Dupont';
      return '<div class="cn-fb-txt"><input type="search" class="cn-fb-tin" autofocus placeholder="' + ph + '" value="' + esc(cur) + '" oninput="V2.' + setter + '(this.value)"></div>';
    }
    var d = fbMenuData(key); if (!d) return '';
    return (d.search ? '<div class="cn-fb-msearch"><input type="search" class="cn-fb-tin" autofocus placeholder="Filtrer…" value="' + esc(fbFilter) + '" oninput="V2.carteFbMenuFilter(this.value)"></div>' : '') +
      '<div class="cn-fb-mlist" id="cn-fbmlist">' + fbRenderMenuList() + '</div>';
  }
  function fbItem(key, label, active) {
    return '<div class="cn-fb-item">' +
      '<button id="cn-fbb-' + key + '" class="cn-fb-btn' + (active ? ' on' : '') + (fbOpen === key ? ' open' : '') + '" onclick="V2.carteFbToggle(\'' + key + '\')">' + esc(label) + '<i class="cn-fb-car">▾</i></button>' +
      (fbOpen === key ? '<div class="cn-fb-menu">' + fbMenuHtml(key) + '</div>' : '') +
      '</div>';
  }
  function renderFbRow() {
    var el = document.getElementById('cn-fbrow'); if (!el) return;
    el.innerHTML =
      fbItem('statut', typeFocus === 'clients' ? 'Statut : Clients' : typeFocus === 'prospects' ? 'Statut : Prospects' : 'Statut', typeFocus !== 'all') +
      fbItem('comm', commFocus.length === 1 ? commFocus[0] : commFocus.length ? commFocus.length + ' commerciaux' : 'Commercial', commFocus.length > 0) +
      fbItem('uga', ugaFocus.length === 1 ? 'UGA ' + ugaFocus[0] : ugaFocus.length ? ugaFocus.length + ' UGA' : 'UGA', ugaFocus.length > 0) +
      fbItem('grp', grpFocus.length === 1 ? grpFocus[0] : grpFocus.length ? grpFocus.length + ' groupements' : 'Groupement', grpFocus.length > 0) +
      fbItem('dept', deptFocus.length === 1 ? 'Dépt ' + deptFocus[0] : deptFocus.length ? deptFocus.length + ' départements' : 'Département', deptFocus.length > 0) +
      fbItem('ca', caLabel(), !!(caMin || caMax)) +
      fbItem('ville', villeFocus ? 'Ville : ' + villeFocus : 'Ville', !!villeFocus) +
      fbItem('tit', titFocus ? 'Titulaire : ' + titFocus : 'Titulaire', !!titFocus) +
      '<button class="cn-fb-btn cn-fb-soon" disabled title="Bientôt : ruptures & opportunités">Signaux · à venir</button>';
  }
  function renderFbChips(n) {
    var cel = document.getElementById('cn-fbcount');
    if (cel) { if (n == null) { n = 0; if (D) for (var i = 0; i < D.p.length; i++) if (pass(D.p[i])) n++; } cel.textContent = n.toLocaleString('fr') + ' officine' + (n > 1 ? 's' : ''); }
    var el = document.getElementById('cn-fbchips'); if (!el) return;
    var chips = []; fbChipRm = [];
    function ch(k, l) { chips.push('<span class="cn-fb-chip">' + esc(l) + '<button class="cn-fb-x" onclick="V2.carteFilterRemove(\'' + k + '\')" aria-label="Retirer le filtre">✕</button></span>'); }
    function chv(k, l, v) { var idx = fbChipRm.length; fbChipRm.push({ k: k, v: v }); chips.push('<span class="cn-fb-chip">' + esc(l) + '<button class="cn-fb-x" onclick="V2.carteFbChipRm(' + idx + ')" aria-label="Retirer">✕</button></span>'); }
    if (typeFocus === 'clients') ch('statut', 'Clients'); else if (typeFocus === 'prospects') ch('statut', 'Prospects');
    commFocus.forEach(function (v) { chv('comm', v, v); });
    ugaFocus.forEach(function (v) { chv('uga', 'UGA ' + v, v); });
    grpFocus.forEach(function (v) { chv('grp', v, v); });
    deptFocus.forEach(function (v) { chv('dept', 'Dépt ' + v + (DEPT_NAMES[v] ? ' · ' + DEPT_NAMES[v] : ''), v); });
    if (caMin || caMax) ch('ca', 'CA ' + caLabel());
    if (villeFocus) ch('ville', 'Ville : ' + villeFocus);
    if (titFocus) ch('tit', 'Titulaire : ' + titFocus);
    if (searchTerm) ch('search', '« ' + searchTerm + ' »');
    el.innerHTML = chips.length ? (chips.join('') + '<button class="cn-fb-clear" onclick="V2.carteClearFilters()">Tout effacer</button>') : '';
  }
  function applyFilters() { rebuild(); renderFbRow(); renderListPanel(); }   // changement discret → re-render complet de la barre
  var _fbTO = null;
  function fbApplyLight() { if (_fbTO) clearTimeout(_fbTO); _fbTO = setTimeout(function () { rebuild(); renderListPanel(); }, 180); }   // texte/curseur → garde le focus, pas de re-render de la barre

  V2.carteFbToggle = function (key) { fbOpen = (fbOpen === key) ? '' : key; fbFilter = ''; renderFbRow(); };
  V2.carteFbPickIdx = function (i) {
    var o = fbMenuOpts[i]; if (!o) return;
    var setter = fbMenuSetter, multi = (fbOpen === 'comm' || fbOpen === 'uga' || fbOpen === 'grp' || fbOpen === 'dept');
    if (!multi) { fbOpen = ''; fbFilter = ''; }   // choix unique (statut) → ferme ; multi → reste ouvert pour cumuler
    if (V2[setter]) V2[setter](o[0]); else renderFbRow();
    if (multi) { var si = document.querySelector('.cn-fb-menu .cn-fb-msearch .cn-fb-tin'); if (si) { si.focus(); var vl = si.value.length; try { si.setSelectionRange(vl, vl); } catch (e) {} } }
  };
  V2.carteFbMenuFilter = function (v) { fbFilter = v || ''; var l = document.getElementById('cn-fbmlist'); if (l) l.innerHTML = fbRenderMenuList(); };
  V2.carteFbDrawer = function () { var b = document.getElementById('cn-fb'); if (b) b.classList.toggle('open'); };
  V2.carteUga = function (v) { ugaFocus = fbToggleArr(ugaFocus, v); applyFilters(); };
  V2.carteVille = function (v) { villeFocus = v || ''; var b = document.getElementById('cn-fbb-ville'); if (b) b.classList.toggle('on', !!villeFocus); fbApplyLight(); };
  V2.carteTit = function (v) { titFocus = v || ''; var b = document.getElementById('cn-fbb-tit'); if (b) b.classList.toggle('on', !!titFocus); fbApplyLight(); };
  V2.carteCARange = function (which, val) {
    val = parseInt(val, 10) || 0;
    if (which === 'min') { caMin = val; if (caMax && caMin > caMax) caMax = caMin; }
    else { caMax = (val >= CA_HI) ? 0 : val; if (caMax && caMax < caMin) caMin = caMax; }
    var lbl = document.getElementById('cn-ca-lbl'); if (lbl) lbl.textContent = caLabel();
    var mn = document.getElementById('cn-ca-min'); if (mn && +mn.value !== caMin) mn.value = caMin;
    var mx = document.getElementById('cn-ca-max'); if (mx) { var mv = caMax || CA_HI; if (+mx.value !== mv) mx.value = mv; }
    var b = document.getElementById('cn-fbb-ca'); if (b) b.classList.toggle('on', !!(caMin || caMax));
    fbApplyLight();
  };
  V2.carteFilterRemove = function (key) {
    if (key === 'statut') typeFocus = 'all';
    else if (key === 'comm') commFocus = [];
    else if (key === 'uga') ugaFocus = [];
    else if (key === 'grp') grpFocus = [];
    else if (key === 'dept') deptFocus = [];
    else if (key === 'ca') { caMin = 0; caMax = 0; }
    else if (key === 'ville') villeFocus = '';
    else if (key === 'tit') titFocus = '';
    else if (key === 'search') { searchTerm = ''; var s = document.getElementById('cn-search'); if (s) s.value = ''; var s2 = document.getElementById('cn-search2'); if (s2) s2.value = ''; }
    applyFilters();
  };

  function segBtn(k, lbl) { return '<button id="cb-' + k + '"' + (colorMode === k ? ' class="on"' : '') + ' onclick="V2.carteColor(\'' + k + '\')">' + lbl + '</button>'; }
  function typeBtn(k, lbl) { return '<button id="ct-' + k + '"' + (typeFocus === k ? ' class="on"' : '') + ' onclick="V2.carteType(\'' + k + '\')">' + lbl + '</button>'; }
  function dispBtn(k, lbl) { return '<button id="cd-' + k + '"' + (displayMode === k ? ' class="on"' : '') + ' onclick="V2.carteDisplay(\'' + k + '\')">' + lbl + '</button>'; }

  V2.pages.carte = {
    render: function (root) {
      injectCss();
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="cn-shell">' +
        // ── Barre de filtres « Direction 2 » : recherche + compteur live · boutons-critères · pastilles retirables ──
        '<div class="cn-fb" id="cn-fb">' +
          '<div class="cn-fbtop">' +
            '<input id="cn-search" class="cn-search cn-fbsearch" type="search" placeholder="Chercher une pharmacie, une ville, un titulaire…" oninput="V2.carteSearch(this.value)">' +
            '<button class="cn-fb-toggle" onclick="V2.carteFbDrawer()">Filtres ▾</button>' +
            '<span class="cn-fbcount" id="cn-fbcount">chargement…</span>' +
          '</div>' +
          '<div class="cn-fbrow" id="cn-fbrow"></div>' +
          '<div class="cn-fbchips" id="cn-fbchips"></div>' +
        '</div>' +
        '<div class="cn-wrap">' +
          '<aside class="cn-side">' +
            '<div class="cn-title">Carte nationale <small id="carte-count">chargement…</small></div>' +
            '<div class="cn-sgroup"><span class="cn-lbl">Colorer par</span>' +
              '<select class="cn-sel" onchange="V2.carteColor(this.value)">' +
                [['comm', 'Commercial'], ['type', 'Client / Prospect'], ['ca', 'CA (taille des points)'], ['uga', 'UGA (zone)']]
                  .map(function (o) { return '<option value="' + o[0] + '"' + (colorMode === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
              '</select>' +
              '<div class="cn-disp">' + dispBtn('points', 'Points') + dispBtn('bulles', 'Bulles (taille = CA)') + '</div>' +
            '</div>' +
            '<div class="cn-sgroup"><span class="cn-lbl">Zones par département</span>' +
              '<button id="cn-zonebtn" class="cn-listbtn" onclick="V2.carteZones()">Afficher les zones (départements)</button>' +
              '<select id="cn-zonemetric" class="cn-sel" style="display:none" onchange="V2.carteZoneMetric(this.value)">' +
                '<option value="part">Colorer : part de clients</option><option value="densite">Colorer : densité d\'officines</option><option value="tension">Colorer : zone sous-dotée (hab./officine)</option><option value="potentiel">Colorer : potentiel (prospects)</option></select></div>' +
            '<div class="cn-sgroup">' +
              '<button class="cn-listbtn cn-listbtn-mob" onclick="V2.carteListOpen()">Liste des officines</button></div>' +
            '<div class="cn-sgroup"><span class="cn-lbl">Légende</span><div class="cn-legend" id="carte-legend"></div></div>' +
            '<div class="cn-sgroup cn-tools">' +
              '<button class="cn-tour-cta" onclick="V2.carteTourOpen()">' + ICO('pharma', 16) + 'Organisateur de tournée</button>' +
              '<p class="cn-tour-hint">Compose ta tournée du jour (adresse de départ + ville + groupements), vois le listing, puis ouvre-la dans Google Maps.</p>' +
              '<button class="cn-export-link" onclick="V2.carteExportKml()">' + ICO('download', 14) + 'Exporter vers Google My Maps</button>' +
            '</div>' +
          '</aside>' +
          '<div class="cn-maparea"><div id="carte-map"></div>' +
            '<button class="cn-organiser" onclick="V2.carteTourOpen()">' + ICO('pharma', 17) + '<span>Organisateur de tournée</span></button>' +
            '<div class="cn-tourbar" id="cn-tourbar"><b id="cn-tourbar-n">0 pharmacie</b>' +
              '<button onclick="V2.carteTourOpen()">Voir / organiser</button></div>' +
            '<div class="cn-load" id="carte-load"><div class="v2-spinner"></div><div>Chargement de la carte nationale…</div></div>' +
          '</div>' +
          '<aside class="cn-dock" id="cn-dock"></aside>' +
        '</div>' +
        '</div>';
      // Fermer le menu ouvert au clic hors de la barre (une seule fois par session de page)
      if (!V2._fbDocClick) {
        V2._fbDocClick = true;
        document.addEventListener('click', function (e) {
          if (!fbOpen) return;
          if (e.target && e.target.closest && e.target.closest('.cn-fb-item')) return;
          fbOpen = ''; fbFilter = ''; renderFbRow();
        });
      }
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
  V2.carteType = function (t) { typeFocus = t || 'all'; applyFilters(); };
  V2.carteComm = function (v) { commFocus = fbToggleArr(commFocus, v); applyFilters(); };
  V2.carteGrp = function (v) { grpFocus = fbToggleArr(grpFocus, v); applyFilters(); };
  V2.carteDept = function (v) { deptFocus = fbToggleArr(deptFocus, v); applyFilters(); };
  V2.carteFbChipRm = function (idx) {
    var c = fbChipRm[idx]; if (!c) return;
    var arr = c.k === 'comm' ? commFocus : c.k === 'uga' ? ugaFocus : c.k === 'grp' ? grpFocus : c.k === 'dept' ? deptFocus : null;
    if (!arr) return;
    var i = arr.indexOf(c.v); if (i >= 0) arr.splice(i, 1);
    applyFilters();
  };
  var _searchTO = null;
  V2.carteSearch = function (v) {
    searchTerm = v || '';
    if (_searchTO) clearTimeout(_searchTO);
    _searchTO = setTimeout(function () { rebuild(); renderFbRow(); renderListPanel(); }, 220);
  };
  // ── LISTE-DONNÉES : voir précisément noms + infos, filtrable, cliquable ──
  function filtered() { var out = []; if (!D) return out; for (var i = 0; i < D.p.length; i++) if (pass(D.p[i])) out.push(i); return out; }
  V2.carteListOpen = function () {
    listShown = LIST_STEP;
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
  // ── Cœur partagé : calcule la liste filtrée + triée (utilisé par le dock ET la modale) ──
  function listComputed() {
    var ids = filtered(), total = ids.length;
    if (listSort === 'ca') ids.sort(function (a, b) { return caOf(D.p[b]) - caOf(D.p[a]); });
    else ids.sort(function (a, b) {   // par nom, mais les officines sans nom en base passent à la fin
      var na = norm(D.p[a][6] || ''), nb = norm(D.p[b][6] || '');
      if (!na !== !nb) return na ? -1 : 1;
      return na < nb ? -1 : (na > nb ? 1 : 0);
    });
    if (listShown > total) listShown = Math.max(LIST_STEP, total);
    var shown = ids.slice(0, listShown), remaining = total - shown.length;
    var rows = shown.map(function (i) {
      var p = D.p[i], cl = isClient(p), pr = D.seg[p[4]] === 'Prospect', inT = tourPos(keyOf(p)) >= 0;
      var comm = p[5] ? D.comm[p[5]] : '';
      return '<div class="cn-lrow">' +
        '<div class="cn-lmain" onclick="V2.carteFiche(' + i + ')">' +
          '<b>' + esc(p[6] || p[10] || ('Pharmacie' + (p[7] ? ' · ' + p[7] : ''))) + '</b>' +
          '<span class="cn-lsub">' + esc(p[7]) + (p[8] ? ' · ' + esc(p[8]) : '') + (p[10] && p[6] ? ' · ' + esc(p[10]) : '') + '</span>' +
          '<span class="cn-ltags">' +
            '<span class="cn-tag ' + (cl ? 'cl' : (pr ? 'pr' : '')) + '">' + esc(statusLabel(p)) + '</span>' +
            (caOf(p) > 0 ? '<span class="cn-tag ca">CA ' + eurK(caOf(p)) + '</span>' : '') +
            (comm ? '<span class="cn-tag co">' + esc(comm) + '</span>' : '') +
            (D.grp[p[3]] && D.grp[p[3]] !== '—' ? '<span class="cn-tag">' + esc(D.grp[p[3]]) + '</span>' : '') +
            (p[9] ? '<span class="cn-tag">' + esc(p[9]) + '</span>' : '') +
          '</span>' +
        '</div>' +
        '<button class="cn-lloc" onclick="V2.carteLocate(' + i + ')" title="Voir sur la carte">◎</button>' +
        '<button class="cn-ladd' + (inT ? ' in' : '') + '" onclick="V2.carteTour(' + i + ');V2.carteListRefreshRow(' + i + ')" title="Tournée">' + (inT ? '✓' : '+') + '</button>' +
      '</div>';
    }).join('') || '<div class="cn-tempty">Aucune pharmacie ne correspond.<br>Change les filtres ou la recherche.</div>';
    var more = remaining > 0 ? '<button class="cn-listmore" onclick="V2.carteListMore()">Afficher plus (' + remaining.toLocaleString('fr') + ' restantes)</button>' : '';
    return { total: total, shown: shown, remaining: remaining, rows: rows, more: more };
  }
  function sortSegHtml() {
    return '<span class="cn-sortlbl">Trier :</span><div class="cn-seg cn-sortseg"><button' + (listSort === 'nom' ? ' class="on"' : '') + ' onclick="V2.carteListSort(\'nom\')">Nom</button><button' + (listSort === 'ca' ? ' class="on"' : '') + ' onclick="V2.carteListSort(\'ca\')">CA</button></div>';
  }
  // Rappel des filtres actifs (rend la liste dockée auto-explicite)
  function activeFiltersHtml() {
    var chips = [];
    if (typeFocus === 'clients') chips.push('Clients');
    else if (typeFocus === 'prospects') chips.push('Prospects');
    commFocus.forEach(function (v) { chips.push(esc(v)); });
    deptFocus.forEach(function (v) { chips.push('Dépt ' + esc(v) + (DEPT_NAMES[v] ? ' · ' + esc(DEPT_NAMES[v]) : '')); });
    grpFocus.forEach(function (v) { chips.push(esc(v)); });
    ugaFocus.forEach(function (v) { chips.push('UGA ' + esc(v)); });
    if (caMin || caMax) chips.push('CA ' + esc(caLabel()));
    if (villeFocus) chips.push('Ville : ' + esc(villeFocus));
    if (titFocus) chips.push('Titulaire : ' + esc(titFocus));
    if (searchTerm) chips.push('« ' + esc(searchTerm) + ' »');
    if (!chips.length) return '';
    return '<div class="cn-dockflt">' + chips.map(function (t) { return '<span class="cn-fchip">' + t + '</span>'; }).join('') +
      '<button class="cn-fclear" onclick="V2.carteClearFilters()">tout effacer</button></div>';
  }
  V2.carteClearFilters = function () {
    typeFocus = 'all'; commFocus = []; grpFocus = []; deptFocus = []; searchTerm = '';
    ugaFocus = []; caMin = 0; caMax = 0; villeFocus = ''; titFocus = ''; fbOpen = ''; fbFilter = '';
    ['cn-search', 'cn-search2'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
    applyFilters();
  };
  // Dock : liste toujours visible à côté de la carte (desktop) — pas de recherche propre (la barre latérale l'a déjà)
  function renderDock() {
    var el = document.getElementById('cn-dock'); if (!el || !D) return;
    var sc = el.querySelector('.cn-plist'); var y = sc ? sc.scrollTop : 0;
    var c = listComputed();
    el.innerHTML = '<div class="cn-dockhead"><div><b>Officines</b><small>' + c.total.toLocaleString('fr') + (c.total > 1 ? ' résultats' : ' résultat') + (c.remaining > 0 ? ' · ' + c.shown.length.toLocaleString('fr') + ' affichés' : '') + '</small></div>' + sortSegHtml() + '</div>' +
      activeFiltersHtml() +
      '<div class="cn-plist">' + c.rows + c.more + '</div>';
    var sc2 = el.querySelector('.cn-plist'); if (sc2) sc2.scrollTop = y;
  }
  function renderListPanel() {
    var el = document.getElementById('cn-listpanel'); if (!el) return;
    var c = listComputed();
    el.innerHTML = '<div class="cn-pdialog cn-listdlg" onclick="event.stopPropagation()">' +
      '<div class="cn-phead"><div><b>Liste des pharmacies</b><small>' + c.total.toLocaleString('fr') + ' pharmacie' + (c.total > 1 ? 's' : '') + (c.remaining > 0 ? ' · ' + c.shown.length.toLocaleString('fr') + ' affichées' : '') + '</small></div>' +
        '<button class="cn-px" onclick="V2.carteListClose()">✕</button></div>' +
      '<div class="cn-prosbar"><input id="cn-search2" type="search" class="cn-search" style="flex:1" placeholder="Rechercher un nom, une ville, un CP…" value="' + esc(searchTerm) + '" oninput="V2.carteSearch(this.value);document.getElementById(\'cn-search\')&&(document.getElementById(\'cn-search\').value=this.value)">' +
        sortSegHtml() + '</div>' +
      '<div class="cn-plist">' + c.rows + c.more + '</div></div>';
  }
  // Rafraîchit dock + modale d'un coup (chacun no-op si absent)
  function renderLists() { renderDock(); renderListPanel(); }
  V2.carteListSort = function (s) { listSort = s; renderLists(); };
  V2.carteListMore = function () {
    var el = document.getElementById('cn-listpanel'), sc = el && el.querySelector('.cn-plist');
    var y = sc ? sc.scrollTop : 0;
    listShown += LIST_STEP; renderLists();
    var sc2 = el && el.querySelector('.cn-plist'); if (sc2) sc2.scrollTop = y;   // garder la position de lecture
  };
  V2.carteListRefreshRow = function () { renderLists(); };

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
    var inWml = !!(p[13] && (V2.pharmacies || []).some(function (x) { return String(x.id) === String(p[13]); }));   // une de tes 630 officines → lien fiche complète
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
        // Infos client ÉDITABLES + notes — même id (p[13]) que l'onglet Pharmacies → même fiche, même sauvegarde
        (p[13] ? '<div class="cn-fedit">' + (V2.profil ? V2.profil.section('client', p[13]) : '') + (V2.notes ? V2.notes.section('client', p[13]) : '') + '</div>' : '') +
      '</div>' +
      '<div class="cn-pacts">' +
        '<button class="v2-btn ' + (inT ? 'v2-btn-ghost' : 'v2-btn-primary') + '" onclick="V2.carteTour(' + i + ');V2.carteFiche(' + i + ')">' + (inT ? '✓ Dans la tournée' : '+ Ajouter à la tournée') + '</button>' +
        (inWml ? '<button class="v2-btn v2-btn-ghost" onclick="V2.carteFicheClose();V2.go(\'pharma\',\'' + esc(String(p[13])) + '\')">Fiche complète</button>' : '') +
        '<a class="v2-btn v2-btn-ghost" href="https://www.google.com/maps/search/?api=1&query=' + q + '" target="_blank" rel="noopener">Google Maps</a>' +
      '</div></div>';
    if (V2.profil) V2.profil.hydrate();   // charge/sauve les infos officine (Supabase profils), comme l'onglet Pharmacies
    if (V2.notes) V2.notes.hydrate();
  }
})();
