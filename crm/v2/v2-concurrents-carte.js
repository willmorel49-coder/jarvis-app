/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Concurrents — LA CARTE DES GROSSISTES (14/10/2026)
   Demande de Will : « une carte interactive où on peut cliquer sur chaque grossiste et avoir
   toutes les données, les actus en veille dessus ». Premier onglet de #concurrents.

   · un point par établissement (grossistes-points.json), coloré par GROUPE ; Intégral distinct ;
     contour rouge = au moins une décision officielle (ANSM) sur ce site ;
   · clic sur un point / une ligne / un résultat de recherche → la FICHE de l'acteur dans un volet à droite
     (feuille du bas sur téléphone), adressable : #concurrents/g/<id> ; groupe : #concurrents/gr/<id> ;
   · la fiche elle-même vit dans v2-grossistes.js (V2.grossisteFiche) : une seule fiche pour tout l'écran.
   Leaflet : mêmes fichiers locaux, même fond (Esri + secours IGN), mêmes précautions que v2-carte.js
   (pas de dépliage en étoile des paquets, filet de clic à 10 px, garde de route, instance précédente détruite).
   Safari : pas de backdrop-filter, pas de texte en dégradé, pas d'opacity sur du texte.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var CB = '?v=20261014b';

  var NATURES = [['', 'Toutes les natures'], ['notre groupe', 'Intégral Pharma'], ['national', 'Nationaux'], ['coopérative', 'Coopératives'], ['short-liner', 'Short-liners'],
                 ['DOM-TOM', 'DOM-TOM'], ['export', 'Export'], ['hors-répartition', 'Groupements (hors répartition)']];
  var ZONES = [['fr', 'France', [[41.2, -5.6], [51.3, 9.9]], function (p) { return p.dep.length === 2 || p.dep === '2A' || p.dep === '2B'; }],
               ['971', 'Antilles', [[14.3, -62.0], [16.6, -60.8]], function (p) { return p.dep === '971' || p.dep === '972' || p.dep === '977' || p.dep === '978'; }],
               ['973', 'Guyane', [[2.0, -54.7], [5.9, -51.5]], function (p) { return p.dep === '973'; }],
               ['974', 'Réunion', [[-21.5, 55.15], [-20.85, 55.95]], function (p) { return p.dep === '974'; }],
               ['976', 'Mayotte', [[-13.1, 44.9], [-12.55, 45.4]], function (p) { return p.dep === '976'; }],
               ['987', 'Polynésie', [[-18.2, -150.2], [-17.2, -149.0]], function (p) { return p.dep === '987'; }],
               ['988', 'Nouvelle-Calédonie', [[-22.5, 164.0], [-20.0, 167.6]], function (p) { return p.dep === '988'; }]];

  var S = { host: null, pts: null, sans: null, meta: null, info: null, map: null, cluster: null, marks: {}, f: { groupe: '', nature: '', q: '', nonrep: false, fermes: false },
            sel: null, selG: null, param: '', sug: [], montage: 0, aliasOuvert: null };

  function norm(s) { s = String(s || '').toLowerCase(); return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s; }
  function grp(id) { var gs = S.info.groupes(); for (var i = 0; i < gs.length; i++) if (gs[i].id === id) return gs[i]; return null; }
  function fiche(id) { return S.info.byId(id); }

  // ── Leaflet : chargement (copie de v2-carte.js ensureLeaflet) ───────────────
  function css(href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
  function js(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = cb; s.onerror = function () { cb('err'); }; document.head.appendChild(s); }
  function ensureLeaflet(cb) {
    var V = 'vendor/leaflet/';
    function afterL() { if (window.L.markerClusterGroup) { cb(); return; } js(V + 'leaflet.markercluster.js' + CB, function () { cb(); }); }
    if (window.L) { afterL(); return; }
    css(V + 'leaflet.css' + CB); css(V + 'MarkerCluster.css' + CB); css(V + 'MarkerCluster.Default.css' + CB);
    js(V + 'leaflet.js' + CB, function () {});
    var t0 = Date.now(), iv = setInterval(function () {
      if (window.L) { clearInterval(iv); afterL(); } else if (Date.now() - t0 > 15000) { clearInterval(iv); cb('err'); }
    }, 100);
  }
  function addBaseLayer(map) {
    var E = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_';
    var base = window.L.tileLayer(E + 'Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 18, attribution: 'Fond : Esri, HERE, Garmin, © OpenStreetMap' }).addTo(map);
    var ref = window.L.tileLayer(E + 'Reference/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 18 }).addTo(map);
    var fails = 0, swapped = false;
    base.on('tileerror', function () {
      if (swapped || ++fails < 3) return;
      swapped = true;
      try { map.removeLayer(base); map.removeLayer(ref); } catch (e) {}
      window.L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png',
        { maxZoom: 18, attribution: 'Fond : IGN — Géoplateforme' }).addTo(map);
    });
  }

  // ── données ────────────────────────────────────────────────────────────────
  function chargerPoints(cb) {
    if (S.pts) { cb(); return; }
    var d = '?d=' + new Date().toISOString().slice(0, 10);
    fetch('grossistes-points.json' + d, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { S.pts = j.points || []; S.sans = j.sans_coord || []; S.meta = j; cb(); })
      .catch(function () { cb('err'); });
  }
  function ptsDe(id) { return (S.pts || []).filter(function (p) { return p.id === id; }); }
  function ptsGroupe(gid) { return (S.pts || []).filter(function (p) { return p.groupe_id === gid; }); }

  // ── style des points ───────────────────────────────────────────────────────
  // Un point coloré par site (9-10 px, liseré blanc). Groupe ou acteur choisi : ses points grossissent, les autres passent en gris clair.
  function surligne(p) { if (S.f.groupe) return p.groupe_id === S.f.groupe; if (S.sel) return p.id === S.sel; if (S.selG) return p.groupe_id === S.selG; return null; }
  function styleDe(p) {
    var g = grp(p.groupe_id) || {}, col = g.couleur || '#607D8B', hi = surligne(p);
    if (p.ferme) return { radius: 5, color: hi === false ? '#C9CFD9' : (p.nous ? '#F39A1B' : col), weight: 2, dashArray: '2 3', fillColor: '#FFFFFF', fillOpacity: 0.95 };
    if (hi === false) return { radius: 4.5, color: '#FFFFFF', weight: 1, fillColor: '#CDD3DD', fillOpacity: 0.9 };
    if (p.nous) return { radius: 8, color: '#10131C', weight: 3, fillColor: '#F39A1B', fillOpacity: 1 };
    if (hi) return { radius: 7.5, color: p.decisions ? '#FFC400' : '#10131C', weight: p.decisions ? 4 : 2, fillColor: col, fillOpacity: 1 };
    return { radius: 5, color: p.decisions ? '#FFC400' : '#FFFFFF', weight: p.decisions ? 3.5 : 1.5, fillColor: col, fillOpacity: 0.95 };
  }
  function visible(p) {
    var f = S.f, g = grp(p.groupe_id) || {};
    if (p.ferme && !f.fermes) return false;              // décision de Will (14/10) : fermés masqués par défaut
    if (!p.rep && !f.nonrep) return false;                // non-répartiteurs (exportateurs, dépositaires, plateformes…) masqués par défaut
    if (f.nature && g.statut !== f.nature) return false;
    if (f.q) {
      var fi = fiche(p.id) || {};
      var hay = norm([fi.nom, p.ville, p.cp, g.nom, p.nom].join(' '));
      var mots = norm(f.q).split(/\s+/).filter(Boolean);
      for (var i = 0; i < mots.length; i++) if (hay.indexOf(mots[i]) < 0) return false;
    }
    return true;
  }
  function tip(p) {
    var fi = fiche(p.id) || {}, g = grp(p.groupe_id) || {};
    var nom = p.nom && !/^[A-ZÉ0-9 '&.-]+$/.test(p.nom) ? p.nom : S.info.aff(fi);
    var aff = S.info.aff(g);
    return '<b>' + esc(nom) + '</b> · ' + (aff === nom ? '' : esc(aff) + ' · ') + esc(p.ville || '') + (p.dep ? ' (' + esc(p.dep) + ')' : '') +
      (p.nous ? '<br>Intégral Pharma' : '') + (p.ferme ? '<br>Fermé le ' + esc(String(p.date_fermeture || '').split('-').reverse().join('/')) : '') + (p.decisions ? '<br>Décision officielle sur ce site' : '') + (p.hors_naf ? '<br>Site logistique ou siège (activité ' + esc(p.naf) + ')' : '') + (!p.rep ? '<br>Pas un répartiteur officinal' : '');
  }

  // ── la carte ───────────────────────────────────────────────────────────────
  function dessiner() {
    if (!S.map || !S.cluster) return;
    S.cluster.clearLayers();
    if (S.selLayer) S.selLayer.clearLayers();
    var arr = [], n = 0, hi = 0;
    Object.keys(S.marks).forEach(function (k) { delete S.marks[k]; });
    (S.pts || []).forEach(function (p) {
      if (!visible(p)) return;
      var m = window.L.circleMarker([p.lat, p.lon], styleDe(p));
      m._p = p;
      m.bindTooltip(tip(p), { direction: 'top', offset: [0, -6], className: 'cm-tip' });
      m.on('click', function () { ouvrirFiche(p.id); });
      S.marks[p.pid] = m; n++; if (surligne(p) === true) hi++;
      // les sites de l'acteur ouvert sont posés HORS des paquets : on voit où il est, même à l'échelle de la France
      if ((surligne(p) === true || p.nous) && S.selLayer) S.selLayer.addLayer(m); else arr.push(m);
    });
    arr.forEach(function (m) { S.cluster.addLayer(m); });
    var c = document.getElementById('cm-count');
    if (c) { c.setAttribute('data-drawn', S.cluster.getLayers().length + S.selLayer.getLayers().length); c.setAttribute('data-shown', n); c.setAttribute('data-hi', hi); c.setAttribute('data-total', (S.pts || []).length); c.textContent = n + (n > 1 ? ' sites affichés' : ' site affiché'); }
    return n;
  }
  function recolorerSel() {
    Object.keys(S.marks).forEach(function (k) { var m = S.marks[k]; m.setStyle(styleDe(m._p)); });
  }
  function cadrer(pts, maxZ) {
    if (!S.map || !pts.length) return;
    try {
      var vis = pts.filter(visible); if (vis.length) pts = vis;
      var b = window.L.latLngBounds(pts.map(function (p) { return [p.lat, p.lon]; }));
      S.map.fitBounds(b, { padding: [50, 50], maxZoom: maxZ || 9 });
    } catch (e) {}
  }
  var FRANCE = [[41.2, -5.6], [51.3, 9.9]];
  function cadrerFrance() { if (S.map) S.map.fitBounds(FRANCE, { padding: [10, 10], animate: false }); }
  function monterCarte() {
    var el = document.getElementById('cm-map');
    if (!el || !window.L) return;
    if (S.map) { try { S.map.remove(); } catch (e) {} S.map = null; }
    var L = window.L;
    S.map = L.map(el, { preferCanvas: true, zoomControl: true, attributionControl: true, zoomSnap: 0.25, zoomDelta: 0.5, renderer: L.canvas({ padding: 0.5, tolerance: 7 }) }).setView([46.6, 2.4], 5.5);
    try { S.map.attributionControl.setPrefix(''); } catch (e) {}
    addBaseLayer(S.map);
    // 14/10 tour 2 : ~250 sites = assez peu pour TOUS les montrer, un point coloré par site (canvas) : plus de ronds blancs numérotés
    S.cluster = L.layerGroup();
    S.map.addLayer(S.cluster);
    S.selLayer = L.layerGroup().addTo(S.map);
    dessiner();
    // filet indépendant du plugin : un clic carte à ≤ 10 px d'un point ouvre sa fiche (piège du 27/08/2026)
    S.map.on('click', function (e) {
      var best = null, bd = 11;
      Object.keys(S.marks).forEach(function (k) {
        var m = S.marks[k];
        if (S.cluster.hasLayer && S.cluster.hasLayer(m) && S.cluster.getVisibleParent && S.cluster.getVisibleParent(m) !== m) return;
        var pt = S.map.latLngToContainerPoint(m.getLatLng()), d = Math.hypot(pt.x - e.containerPoint.x, pt.y - e.containerPoint.y);
        if (d < bd) { bd = d; best = m; }
      });
      if (best) ouvrirFiche(best._p.id);
    });
    var vue = vueInitiale();
    if (vue) cadrer(vue, 10); else { cadrerFrance(); }
    var cible = S.map;
    setTimeout(function () { if (S.map === cible && document.getElementById('cm-map')) { S.map.invalidateSize(); if (vue) cadrer(vue, 10); else cadrerFrance(); } }, 80);
    setTimeout(function () { if (S.map === cible && document.getElementById('cm-map')) { S.map.invalidateSize(); if (!S.param && !S.sel && !S.selG) cadrerFrance(); } }, 450);
    if (!S.resizeLie) {
      S.resizeLie = true;
      window.addEventListener('resize', function () { if (S.map && V2.route && V2.route.name === 'concurrents' && document.getElementById('cm-map')) S.map.invalidateSize(); });
    }
  }
  function vueInitiale() {
    if (S.param && /^g\//.test(S.param)) { var f = fiche(decodeURIComponent(S.param.slice(2))); if (f) { var p = ptsDe(f.id); if (p.length) return p; } }
    if (S.param && /^gr\//.test(S.param)) { var q = ptsGroupe(S.param.slice(3)); if (q.length) return q; }
    return null;   // France entière
  }

  // ── volet / feuille : la FICHE ─────────────────────────────────────────────
  function ouvrirFiche(id) { if (V2.grossisteOpen) V2.grossisteOpen(id); }
  function volet() { return document.getElementById('cm-volet'); }
  // Téléphone : la feuille du bas vit sous <body>, HORS de #v2-root. Un ancêtre animé (transform de la transition de vue)
  // ferait de « fixed » un simple « absolute » et la feuille dériverait avec le défilement (constaté sous WebKit,
  // même piège que le plein écran de v2-concurrents.js). Ordinateur : le volet reste dans la scène, à droite de la carte.
  function placerVolet() {
    var v = volet(); if (!v) return;
    if (window.innerWidth < 1024) { if (v.parentNode !== document.body) document.body.appendChild(v); }
    else { var st = document.getElementById('cm-stage'); if (st && v.parentNode !== st) st.appendChild(v); }
  }
  function retirerFeuille() {
    var v = document.querySelector('body > #cm-volet'); if (v) v.parentNode.removeChild(v);
    document.documentElement.classList.remove('cm-lock');
  }
  function fermerVolet() { var v = volet(); if (v) { v.classList.remove('on'); v.innerHTML = ''; } var st = document.getElementById('cm-stage'); if (st) st.classList.remove('avec'); document.documentElement.classList.remove('cm-lock'); }
  function teteVolet(titre) {
    return '<div class="cm-vtete"><span>' + esc(titre) + '</span><button type="button" class="cm-x" onclick="V2.concFermer()" aria-label="Fermer la fiche">' + ICO('close', 18, 2.2) + '</button></div>';
  }
  function ouvrirVolet(titre, corps) {
    var v = volet();
    if (!v) { v = document.createElement('aside'); v.id = 'cm-volet'; v.className = 'cm-volet'; v.setAttribute('aria-label', 'Fiche du grossiste'); (document.getElementById('cm-stage') || document.body).appendChild(v); }
    placerVolet();
    v.classList.add('on'); v.innerHTML = teteVolet(titre) + '<div class="cm-vcorps" id="cm-vcorps">' + corps + '</div>';
    var st = document.getElementById('cm-stage'); if (st) st.classList.add('avec');
    if (window.innerWidth < 1024) {
      document.documentElement.classList.add('cm-lock');
      // la carte remonte en haut de l'écran : la feuille de la fiche occupe le bas, la carte reste visible au-dessus
      setTimeout(function () { try { if (st && st.scrollIntoView) st.scrollIntoView({ block: 'start' }); } catch (e) {} }, 30);
    }
    setTimeout(function () { if (S.map) S.map.invalidateSize(); if (window.innerWidth < 1024 && S.sel) { var vis = ptsDe(S.sel).filter(visible); if (vis.length) cadrer(vis, 9); } }, 260);
  }
  function appliquerParam() {
    var p = S.param || '';
    var mG = p.match(/^g\/(.+)$/), mGr = p.match(/^gr\/(.+)$/);
    S.sel = null; S.selG = null;
    if (mG) {
      var id = decodeURIComponent(mG[1]), f = fiche(id);
      if (!f) { ouvrirVolet('Fiche', '<div class="gr-empty">Fiche introuvable : ' + esc(id) + '.</div>'); dessiner(); return; }
      S.sel = f.id;
      // ancienne adresse d'une fiche fusionnée (#concurrents/g/phoenix) : l'adresse devient celle de la fiche de tête
      if (f.id !== id) { try { history.replaceState(null, '', '#concurrents/g/' + encodeURIComponent(f.id)); if (V2.route) V2.route.param = 'g/' + f.id; } catch (e) {} }
      var pts = ptsDe(f.id);
      ouvrirVolet(S.info.aff(f), '<div class="v2-loading"><div class="v2-spinner"></div></div>');
      V2.grossisteFiche(f.id, pts, function (html) {
        var c = document.getElementById('cm-vcorps'); if (!c || S.sel !== f.id) return;
        c.innerHTML = html; c.scrollTop = 0;
        if (V2.notes && V2.notes.hydrate) { try { V2.notes.hydrate(); } catch (e) {} }
      });
      dessiner();
      if (pts.length) cadrer(pts, 9);
    } else if (mGr) {
      var gid = decodeURIComponent(mGr[1]), g = grp(gid);
      S.selG = gid;
      ouvrirVolet(g ? S.info.aff(g) : 'Groupe', '<div class="v2-loading"><div class="v2-spinner"></div></div>');
      V2.grossisteGroupeFiche(gid, function (html) { var c = document.getElementById('cm-vcorps'); if (c && S.selG === gid) { c.innerHTML = html; c.scrollTop = 0; } });
      dessiner();
      var q = ptsGroupe(gid); if (q.length) cadrer(q, 8);
    } else { fermerVolet(); dessiner(); }
  }

  // ── barre d'outils, légende, bas de page ───────────────────────────────────
  function barreHtml() {
    var nat = '<label class="v2-select" aria-label="Nature"><select id="cm-nat" onchange="V2.concFiltre(\'nature\', this.value)">' + NATURES.map(function (n) { return '<option value="' + esc(n[0]) + '"' + (S.f.nature === n[0] ? ' selected' : '') + '>' + esc(n[1]) + '</option>'; }).join('') + '</select><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></label>';
    var nNr = (S.pts || []).filter(function (p) { return !p.rep && !p.ferme; }).length, nFe = (S.pts || []).filter(function (p) { return p.ferme; }).length;
    var tog = '<span class="cm-togs" id="cm-togs">' +
      '<button type="button" class="cm-tog' + (S.f.nonrep ? ' on' : '') + '" aria-pressed="' + S.f.nonrep + '" onclick="V2.concBascule(\'nonrep\')" title="Afficher aussi les non-répartiteurs : exportateurs, dépositaires, plateformes d\'achat, groupements">Non-répartiteurs <em>' + nNr + '</em></button>' +
      '<button type="button" class="cm-tog' + (S.f.fermes ? ' on' : '') + '" aria-pressed="' + S.f.fermes + '" onclick="V2.concBascule(\'fermes\')" title="Sites fermés depuis le registre : pratique pour voir les fermetures d\'entrepôts">Sites fermés <em>' + nFe + '</em></button></span>';
    return '<div class="cm-bar"><div class="cm-rech"><div class="v2-champ">' + ICO('search', 20, 2) +
      '<input id="cm-q" type="search" inputmode="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Grossiste, ville, groupe" value="' + esc(S.f.q) + '" oninput="V2.concRecherche(this.value)" aria-label="Chercher un grossiste"></div>' +
      '<div class="cm-sug" id="cm-sug" role="listbox"></div></div><button type="button" class="cm-fbtn" onclick="V2.concFiltres()" aria-expanded="false">Filtres</button><div class="cm-rowb" id="cm-rowb">' + nat + tog + '<span id="cm-zones-h">' + zonesHtml() + '</span></div></div>';
  }
  function nOuverts(fn) { return (S.pts || []).filter(function (p) { return !p.ferme && p.rep && (!fn || fn(p)); }).length; }
  function zonesHtml() {
    return '<div class="cm-zones" role="group" aria-label="Aller à">' + ZONES.map(function (z) {
      var n = (S.pts || []).filter(function (p) { return !p.ferme && p.rep && z[3](p); }).length;
      if (z[0] !== 'fr' && !n) return '';
      return '<button type="button" class="cm-zone" onclick="V2.concZone(\'' + z[0] + '\')">' + esc(z[1]) + '<em>' + n + '</em></button>';
    }).join('') + '</div>';
  }
  var CLES = '';
  function legendeHtml() {
    var cpt = {}; (S.pts || []).forEach(function (p) { if ((S.f.fermes || !p.ferme) && (S.f.nonrep || p.rep)) cpt[p.groupe_id] = (cpt[p.groupe_id] || 0) + 1; });
    var gs = S.info.groupes().filter(function (g) { return cpt[g.id]; }).sort(function (a, b) { return (cpt[b.id] || 0) - (cpt[a.id] || 0); });
    var tousG = gs.length, visG = S.legAll ? gs : gs.slice(0, 9);
    var chips = visG.map(function (g) {
      var on = S.f.groupe === g.id;
      return '<span class="cm-chip' + (on ? ' on' : '') + '"><button type="button" class="cm-chip-m" onclick="V2.concFiltre(\'groupe\', \'' + esc(g.id) + '\')" aria-pressed="' + on + '" title="Filtrer la carte sur ce groupe"><i style="background:' + esc(g.couleur) + '"></i>' + esc(S.info.aff(g)) + ' <em>' + cpt[g.id] + '</em></button>' +
        '<button type="button" class="cm-chip-i" onclick="V2.concGroupe(\'' + esc(g.id) + '\')" aria-label="Ouvrir la fiche du groupe ' + esc(S.info.aff(g)) + '">' + ICO('chev', 14, 2.4) + '</button></span>';
    }).join('');
    CLES = '<span class="cm-cle"><i class="nous"></i>Intégral Pharma</span><span class="cm-cle"><i class="dec"></i>Décision officielle</span><span class="cm-cle"><i class="fer"></i>Site fermé</span>';
    var plus = tousG > 9 ? '<button type="button" class="cm-plus" onclick="V2.concLegende()">' + (S.legAll ? 'Moins' : '+ ' + (tousG - 9) + ' autres groupes') + '</button>' : '';
    return '<div class="cm-leg" id="cm-leg"><div class="cm-chips">' + chips + plus + '</div></div>';
  }
  function basHtml() {
    var m = S.meta || {}, n = (S.pts || []).length, ns = (S.sans || []).length;
    var acteurs = {}; (S.pts || []).forEach(function (p) { if (!p.ferme && p.rep) acteurs[p.id] = 1; });
    var gs = S.info.groupes().filter(function (g) { return g.pdm_num > 0; }).sort(function (a, b) { return b.pdm_num - a.pdm_num; });
    var sum = gs.reduce(function (s, g) { return s + g.pdm_num; }, 0), autres = Math.max(0, Math.round((100 - sum) * 10) / 10);
    var barre = gs.map(function (g) { return '<span style="width:' + g.pdm_num + '%;background:' + esc(g.couleur) + '" title="' + esc(S.info.aff(g)) + ' ' + g.pdm_num + ' %"></span>'; }).join('') + (autres > 0 ? '<span style="width:' + autres + '%;background:#CBD2DD" title="Autres"></span>' : '');
    var leg = gs.map(function (g) { return '<span><i style="background:' + esc(g.couleur) + '"></i>' + esc(S.info.aff(g)) + ' ' + String(g.pdm_num).replace('.', ',') + ' %</span>'; }).join('');
    var sansHtml = ns ? '<details class="cm-sans"><summary>' + ns + ' site' + (ns > 1 ? 's' : '') + ' sans coordonnées (non placés sur la carte)</summary><ul>' + S.sans.map(function (p) { var fi = fiche(p.id) || {}; return '<li><button type="button" onclick="V2.grossisteOpen(\'' + esc(p.id) + '\')">' + esc(S.info.aff(fi)) + '</button> ' + esc(p.ville || '') + ' ' + esc(p.cp || '') + '</li>'; }).join('') + '</ul></details>' : '';
    return '<div class="cm-bas"><div class="cm-marche"><div class="cm-marche-t">Poids des groupes sur le marché</div><div class="cm-mbar">' + barre + '</div><div class="cm-mleg">' + leg + '</div></div>' +
      '<div class="cm-faits"><b>' + nOuverts() + '</b> sites ouverts de répartiteurs · <b>' + Object.keys(acteurs).length + '</b> acteurs cartographiés · données du ' + esc(String(m.maj || '').split('-').reverse().join('/')) +
      '<span class="cm-honnete">' + (m.provisoire ? esc(m.provisoire) + '. ' : '') + 'Source : registre des entreprises, activité 46.46Z (commerce de gros de produits pharmaceutiques) ; la liste officielle de l\'ANSM n\'est pas téléchargeable.</span></div>' + sansHtml + '</div>';
  }

  // ── page ───────────────────────────────────────────────────────────────────
  function squelette() {
    var leg = legendeHtml();
    return '<div class="cm-root" id="cm-root">' + barreHtml() + '<div id="cm-leg-h">' + leg + '</div>' +
      '<div class="cm-stage" id="cm-stage"><div class="cm-mapwrap"><div id="cm-map" class="cm-map" role="application" aria-label="Carte des grossistes"></div><span class="cm-count" id="cm-count" data-shown="0" data-total="0" aria-live="polite"></span><div class="cm-cles">' + CLES + '</div></div><aside class="cm-volet" id="cm-volet" aria-label="Fiche du grossiste"></aside></div>' +
      '<div id="cm-bas-h">' + basHtml() + '</div></div>';
  }
  function monter(host, param) {
    injectCss();
    S.host = host; S.param = param || ''; var tour = ++S.montage;
    retirerFeuille();
    host.innerHTML = '<div class="cm-chargement" id="cm-chargement"><div class="v2-spinner"></div><div>Chargement de la carte…</div></div>';
    var etat = { l: null, p: null, g: null }, fait = 0;
    function fin() {
      if (++fait < 3 || tour !== S.montage || !document.getElementById('cm-chargement')) return;
      if (etat.l === 'err' || !window.L) { host.innerHTML = '<div class="v2-empty"><div class="v2-empty-t">La carte n\'a pas pu se charger</div><div class="v2-empty-d">Le fond de carte est indisponible. Rechargez la page ; l\'annuaire reste utilisable.</div></div>'; return; }
      if (etat.p === 'err') { host.innerHTML = '<div class="v2-empty"><div class="v2-empty-t">Les établissements ne sont pas chargés</div><div class="v2-empty-d">Fichier grossistes-points.json introuvable. Rechargez la page.</div></div>'; return; }
      if (etat.g) { host.innerHTML = '<div class="v2-empty"><div class="v2-empty-t">La base des grossistes n\'est pas chargée</div></div>'; return; }
      S.info = V2.grossistesInfo();
      host.innerHTML = squelette();
      monterCarte();
      appliquerParam();
    }
    ensureLeaflet(function (e) { etat.l = e || null; fin(); });
    chargerPoints(function (e) { etat.p = e || null; fin(); });
    V2.grossistesPret(function (e) { etat.g = e || null; fin(); });
  }
  // Appelé à chaque rendu de la route : si la carte est déjà montée, on ne la reconstruit pas (zoom conservé).
  V2.concCarteRender = function (host, param) {
    var deja = document.getElementById('cm-root') && S.map && host.contains(document.getElementById('cm-root'));
    if (deja) { S.param = param || ''; appliquerParam(); return; }
    monter(host, param);
  };

  V2.concCarteMap = function () { return S.map; };   // pour les sondes de test (lecture seule)

  // ── actions ────────────────────────────────────────────────────────────────
  V2.concLegende = function () { S.legAll = !S.legAll; var h = document.getElementById('cm-leg-h'); if (h) h.innerHTML = legendeHtml(); };
  V2.concFiltres = function () { var r = document.getElementById('cm-rowb'), b = document.querySelector('.cm-fbtn'); if (!r) return; var o = r.classList.toggle('ouvert'); if (b) b.setAttribute('aria-expanded', o); };
  V2.concGroupe = function (gid) { V2.go('concurrents', 'gr/' + gid); try { history.replaceState(null, '', '#concurrents/gr/' + encodeURIComponent(gid)); } catch (e) {} };
  V2.concFermer = function () { V2.go('concurrents', 'carte'); };
  V2.concFiltre = function (cle, v) {
    if (cle === 'groupe') S.f.groupe = (S.f.groupe === v ? '' : v); else S.f[cle] = v;
    dessiner();
    var h = document.getElementById('cm-leg-h'); if (h) h.innerHTML = legendeHtml();
  };
  V2.concBascule = function (cle) {
    S.f[cle] = !S.f[cle];
    var t = document.getElementById('cm-togs');
    if (t) { var bs = t.querySelectorAll('.cm-tog'); [['nonrep', 0], ['fermes', 1]].forEach(function (x) { bs[x[1]].classList.toggle('on', !!S.f[x[0]]); bs[x[1]].setAttribute('aria-pressed', !!S.f[x[0]]); }); }
    dessiner(); var h = document.getElementById('cm-leg-h'); if (h) h.innerHTML = legendeHtml();
  };
  var tR = null;
  V2.concRecherche = function (v) {
    S.f.q = v || '';
    clearTimeout(tR);
    tR = setTimeout(function () {
      dessiner();
      var s = document.getElementById('cm-sug'); if (!s) return;
      var nq = norm(S.f.q).trim();
      if (nq.length < 2) { s.innerHTML = ''; s.classList.remove('on'); return; }
      var gs = S.info.data.grossistes.filter(function (g) { return !g.fusionne_dans && norm(g.nom + ' ' + g.id).indexOf(nq) >= 0; }).slice(0, 7);
      s.innerHTML = gs.map(function (g) { var gr = grp(g.groupe_id) || {}; return '<button type="button" role="option" onclick="V2.concChoisir(\'' + esc(g.id) + '\')"><i style="background:' + esc(gr.couleur || '#607D8B') + '"></i><b>' + esc(S.info.aff(g)) + '</b><span>' + (g.nb_points || 0) + ' site' + ((g.nb_points || 0) > 1 ? 's' : '') + '</span></button>'; }).join('');
      s.classList.toggle('on', gs.length > 0);
    }, 120);
  };
  V2.concChoisir = function (id) {
    var s = document.getElementById('cm-sug'); if (s) { s.innerHTML = ''; s.classList.remove('on'); }
    S.f.q = ''; var i = document.getElementById('cm-q'); if (i) i.value = '';
    dessiner(); ouvrirFiche(id);
  };
  V2.concZone = function (k) {
    var z = ZONES.filter(function (x) { return x[0] === k; })[0]; if (!z || !S.map) return;
    if (k === 'fr') { cadrerFrance(); return; }
    S.map.fitBounds(z[2], { padding: [20, 20], maxZoom: 11 });
  };
  V2.concCentrer = function (pid) {
    var m = S.marks[pid]; if (!m || !S.map) return;
    S.map.setView(m.getLatLng(), Math.max(S.map.getZoom(), 10), { animate: true });
  };
  V2.concCentrerActeur = function (id) { var p = ptsDe(id); cadrer(p, 9); var w = document.getElementById('cm-map'); if (w && window.innerWidth < 1024 && w.scrollIntoView) { try { V2.concFermer(); } catch (e) {} } };
  V2.concCentrerGroupe = function (gid) { cadrer(ptsGroupe(gid), 8); if (window.innerWidth < 1024) V2.concFermer(); };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && V2.route && V2.route.name === 'concurrents' && volet() && volet().classList.contains('on')) V2.concFermer();
  });
  document.addEventListener('click', function (e) {
    var s = document.getElementById('cm-sug'); if (s && s.classList.contains('on') && !(e.target.closest && e.target.closest('.cm-rech'))) { s.classList.remove('on'); }
  });
  window.addEventListener('hashchange', function () {
    // hors de la carte (autre écran, ou autre onglet de Concurrents) : la feuille du bas ne reste pas à l'écran
    var h = location.hash || ''; try { h = decodeURIComponent(h); } catch (e) {}   // V2.go encode le « / » de g/<id> en %2F
    if (!/^#concurrents(\/(carte|g\/.*|gr\/.*))?$/.test(h)) retirerFeuille();
  });

  // ── CSS ────────────────────────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById('v2-conc-carte-css')) return;
    var s = document.createElement('style'); s.id = 'v2-conc-carte-css';
    s.textContent = [
      '.cm-root{display:flex;flex-direction:column;gap:12px}',
      '.cm-chargement{display:flex;flex-direction:column;align-items:center;gap:12px;padding:90px 20px;color:var(--muted)}',
      '.cm-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}',
      '.cm-rech{position:relative;flex:1 1 220px;max-width:340px}',
      '.cm-sug{display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:600;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-pop);overflow:hidden}',
      '.cm-sug.on{display:block}',
      '.cm-sug button{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 14px;border:0;border-top:1px solid var(--line);background:none;font:inherit;font-size:14px;color:var(--ip-ink);text-align:left;cursor:pointer}',
      '.cm-sug button:first-child{border-top:0}.cm-sug button:hover{background:var(--card-2)}',
      '.cm-sug i{width:10px;height:10px;border-radius:50%;flex:none}.cm-sug b{flex:1;min-width:0;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cm-sug span{font-size:12px;color:var(--muted)}',
      '.cm-togs{display:inline-flex;flex-wrap:wrap;gap:6px}',
      '.cm-tog{min-height:44px;padding:0 14px;border:1px solid var(--line);border-radius:var(--r-btn);background:var(--card);font:inherit;font-size:13px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;box-shadow:var(--sh-1)}',
      '.cm-tog em{font-style:normal;margin-left:6px;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.cm-tog.on{background:var(--ip-ink);border-color:var(--ip-ink);color:#fff}.cm-tog.on em{color:#fff}',
      '.cm-count{position:absolute;top:10px;right:10px;z-index:450;padding:6px 12px;border-radius:var(--r-pill);background:#fff;border:1px solid var(--line);box-shadow:var(--sh-2);font-size:13px;font-weight:700;color:var(--ip-ink);font-variant-numeric:tabular-nums;pointer-events:none}',
      '.cm-rowb{display:contents}',
      '.cm-zones{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.cm-zones::-webkit-scrollbar{display:none}',
      '#cm-zones-h{display:contents}',
      '.cm-zone{flex:none;min-height:40px;padding:0 10px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);font:inherit;font-size:13px;font-weight:700;color:var(--ip-ink-2);cursor:pointer}',
      '.cm-zone em{font-style:normal;font-weight:700;color:var(--muted);margin-left:4px;font-variant-numeric:tabular-nums}.cm-zone:hover{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.cm-leg{display:flex;flex-direction:column;gap:8px}',
      '.cm-fbtn{display:none}',
      '.cm-plus{flex:none;min-height:36px;padding:0 14px;border:1px dashed var(--line-strong,#cdd3df);border-radius:var(--r-pill);background:none;font:inherit;font-size:13px;font-weight:700;color:var(--ip-blue);cursor:pointer;white-space:nowrap}',
      '.cm-bar .v2-select select{width:200px}.cm-rech{flex:1 1 220px;max-width:280px}.cm-bar{gap:8px}',
      '.cm-chips{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.cm-chips::-webkit-scrollbar{display:none}',
      '.cm-chip{flex:none;white-space:nowrap;display:inline-flex;align-items:stretch;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);overflow:hidden}',
      '.cm-chip.on{border-color:var(--ip-ink);box-shadow:0 0 0 2px color-mix(in srgb,var(--ip-ink) 12%,transparent)}',
      '.cm-chip button{border:0;background:none;font:inherit;cursor:pointer;color:var(--ip-ink)}',
      '.cm-chip .cm-chip-m{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 6px 0 12px;font-size:13px;font-weight:700}',
      '.cm-chip-m i{width:11px;height:11px;border-radius:50%;flex:none}.cm-chip-m em{font-style:normal;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.cm-chip.on .cm-chip-m{background:var(--ip-ink);color:#fff}.cm-chip.on .cm-chip-m em{color:#fff}',
      '.cm-chip-i{display:grid;place-items:center;width:34px;color:var(--muted);border-left:1px solid var(--line)!important}.cm-chip-i:hover{color:var(--ip-blue)}',
      '.cm-cles{position:absolute;left:12px;bottom:12px;z-index:450;display:flex;flex-wrap:wrap;gap:4px 14px;max-width:calc(100% - 90px);padding:7px 12px;border-radius:12px;background:#fff;border:1px solid var(--line);box-shadow:var(--sh-2);font-size:12px;font-weight:600;color:var(--ip-ink-2);pointer-events:none}',
      '.cm-cle{display:inline-flex;align-items:center;gap:6px}.cm-cle i{width:12px;height:12px;border-radius:50%;box-sizing:border-box;flex:none}',
      '.cm-cle i.nous{background:#F39A1B;border:2.5px solid #10131C}.cm-cle i.dec{background:#9AA3B5;border:3px solid #FFC400}.cm-cle i.fer{background:#fff;border:2px dotted #6B7286}',
      /* scène : la carte est le héros de l'écran, lumière d'en haut (pas d'aplat) */
      '.cm-stage{display:flex;gap:16px;align-items:stretch;min-height:520px;height:calc(100vh - 330px);max-height:780px}',
      '.cm-mapwrap{position:relative;isolation:isolate;flex:1;min-width:0;border-radius:var(--r-card);overflow:hidden;border:1px solid var(--line);box-shadow:var(--sh-3),0 -40px 80px -40px color-mix(in srgb,var(--accent,var(--ip-blue)) 24%,transparent);background:#E9EDF3}',
      '.cm-map{position:absolute;inset:0}',
      '.cm-map .leaflet-control-attribution{font-size:12px}',
      '.cm-volet{display:none;flex:none;width:460px;max-width:46%;border-radius:var(--r-card);background:var(--card);border:1px solid var(--line);box-shadow:var(--sh-pop);flex-direction:column;overflow:hidden}',
      '.cm-volet.on{display:flex}',
      '.cm-vtete{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px 10px 18px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,color-mix(in srgb,var(--accent,var(--ip-blue)) 8%,var(--card)),var(--card))}',
      '.cm-vtete span{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ip-blue-d);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cm-x{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:var(--r-control);background:none;color:var(--ip-ink-2);cursor:pointer}.cm-x:hover{background:var(--card-2)}',
      '.cm-vcorps{flex:1;overflow:auto;padding:4px 18px 24px;-webkit-overflow-scrolling:touch}',
      '.cm-vcorps .gr-fkpis{grid-template-columns:repeat(2,1fr)}',
      '.cm-vcorps .gr-fhead h2{font-size:21px}',
      '.cm-clw{background:none;border:none}',
      '.cm-cl{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;border:1.5px solid var(--ip-blue,#0050E6);color:var(--ip-blue-d,#0034A0);font:800 12px/1 var(--font,system-ui);font-variant-numeric:tabular-nums;box-shadow:0 5px 14px -6px rgba(0,52,160,.45)}',
      '.cm-tip{font:600 12.5px/1.35 var(--font,system-ui);color:#10131C;border-radius:10px;border:1px solid var(--line);box-shadow:var(--sh-2);padding:6px 9px}',
      '.cm-bas{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;align-items:start;font-size:13px;color:var(--muted-d)}',
      '.cm-marche-t{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px}',
      '.cm-mbar{display:flex;height:12px;border-radius:6px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.05)}.cm-mbar span{height:100%}',
      '.cm-mleg{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:12px;font-weight:600;color:var(--ip-ink-2)}.cm-mleg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}',
      '.cm-faits b{color:var(--ip-ink)}.cm-honnete{display:block;margin-top:4px;font-size:12px;line-height:1.5}',
      '.cm-sans{grid-column:1/-1;font-size:13px}.cm-sans summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:700;color:var(--ip-blue)}.cm-sans ul{margin:0;padding-left:18px;line-height:1.7}.cm-sans button{border:0;background:none;padding:0;font:inherit;font-weight:700;color:var(--ip-ink);cursor:pointer;text-decoration:underline}',
      /* téléphone et tablette : la fiche est une feuille du bas, la carte reste visible au-dessus */
      '@media(max-width:1023px){',
      '.cm-stage{display:block;height:auto;min-height:0;max-height:none}',
      '.cm-mapwrap{height:min(62vh,520px);min-height:340px}',
      '.cm-stage{scroll-margin-top:72px}',
      '.cm-stage.avec .cm-mapwrap{height:calc(38vh - 72px);min-height:190px}',
      '.cm-stage.avec{margin-bottom:62vh}',
      '.cm-volet{position:fixed;left:0;right:0;bottom:0;z-index:900;width:auto;max-width:none;height:62vh;border-radius:20px 20px 0 0;border-bottom:0;box-shadow:0 -10px 30px -12px rgba(16,19,28,.35)}',
      '.cm-bas{grid-template-columns:1fr}',
      '.cm-rech{flex-basis:100%;max-width:none}',
      '.cm-cles{left:8px;bottom:8px;gap:2px 10px;padding:5px 9px;max-width:calc(100% - 72px)}',
      '.cm-fbtn{display:inline-flex;align-items:center;min-height:48px;padding:0 16px;border:1px solid var(--line);border-radius:var(--r-btn);background:var(--card);font:inherit;font-size:14px;font-weight:700;color:var(--ip-ink-2);box-shadow:var(--sh-1)}',
      '.cm-rech{flex:1 1 0;min-width:0;max-width:none}.cm-bar{flex-wrap:nowrap}',
      '.cm-rowb{display:none}.cm-rowb.ouvert{display:flex;flex-wrap:wrap;gap:8px;align-items:center;position:absolute;left:14px;right:14px;z-index:700;padding:12px;margin-top:62px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-pop)}',
      '.cm-bar{position:relative}.cm-zones{flex-wrap:wrap;overflow:visible}',
      '.cm-chips{flex-wrap:nowrap;overflow-x:auto}',
      '.cm-rowb>*{flex:none}.cm-togs{flex-wrap:nowrap}.cm-zones{overflow:visible}',
      'html.cm-lock .v2-wrap{overscroll-behavior:contain}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }
})();
