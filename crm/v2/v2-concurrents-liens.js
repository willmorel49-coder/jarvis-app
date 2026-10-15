/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Concurrents — onglet « Liens : qui détient qui » (15/10/2026) — « Les personnes derrière »
   Demande de Will : une carte des liens (groupes, propriétaires, personnes clés), cliquable ; un clic sur un répartiteur ouvre sa fiche.
   Variante retenue parmi cinq : à gauche les personnes et holdings qui tiennent ou dirigent AU MOINS 2 grossistes (triées par nombre),
   à droite ces répartiteurs ; un clic sur une personne allume ses grossistes et ouvre sa carte d'identité (fonctions, depuis quand,
   parcours, source) ; un clic sur un répartiteur ouvre SA fiche (V2.grossisteOpen). Sur téléphone : une liste au-dessus, le schéma
   de la personne choisie dessous.
   Données : grossistes-liens.json (produit par construction/integrer_personnes.py) + fiches (V2.grossistesInfo) pour les parcours.
   Outil : Cytoscape.js 3.34.3 SEUL (jsDelivr, version figée), chargé à l'ouverture de l'onglet seulement ; aucune extension.
   Pièges d'outil respectés : le graphe n'est jamais créé dans un conteneur caché (0×0) ; document.fonts.ready attendu avant le dessin ;
   touch-action:none sur le conteneur seul ; aucune ombre ni flou dans le style des nœuds ; jamais de taille « selon l'étiquette »
   (le nœud serait invisible tant qu'il n'est pas mesuré : les tailles sont calculées ici).
   Adresse : #concurrents/liens
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var CY_URL = 'https://cdn.jsdelivr.net/npm/cytoscape@3.34.3/dist/cytoscape.min.js';
  // Empreinte du fichier exact (SRI) : un fichier modifié sur le CDN est refusé par le navigateur.
  var CY_SRI = 'sha384-qPKQxl9uMXOw7vSTUDAnpUilhLuulovw6P5Z4db4bqxW5VhumS7przEmHX0iM0Oc';
  var ACCENT = '#0E7C86', ACCENT_D = '#09565D', INK = '#10131C', INK2 = '#2A2F3C', MUTED = '#646B80', ORANGE = '#F39A1B';
  var FR = new Intl.NumberFormat('fr-FR');
  var S = { host: null, d: null, N: null, out: null, inn: null, info: null, cy: null, montage: 0, st: { sel: null, min: 2 }, tel: null };

  // ── utilitaires ──────────────────────────────────────────────────────────────
  function norm(s) { s = String(s || '').toLowerCase(); return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s; }
  function phone() { return window.innerWidth < 700; }
  function lum(hex) { var h = String(hex || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var r = parseInt(h.substr(0, 2), 16) / 255, g = parseInt(h.substr(2, 2), 16) / 255, b = parseInt(h.substr(4, 2), 16) / 255; function f(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); } return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
  function texteSur(hex) { return lum(hex) > 0.34 ? INK : '#FFFFFF'; }
  // Casse normale à l'affichage : « KALLISTE PHARMA REPARTITION » devient « Kalliste Pharma Repartition » ; les mots de 3 lettres ou moins
  // (LIS, SAS, SA), les sigles de marque (CERP, SIPR…) et les sigles à points (D.T.) restent tels quels.
  var SIGLES = { CERP: 1, SIPR: 1, ANSM: 1, CSRP: 1, MHGC: 1, OCDP: 1, GPNC: 1 };
  function casse(s) {
    return String(s == null ? '' : s).replace(/[A-Za-zÀ-ÖØ-öø-ÿ0-9.’'\-]+/g, function (mot) {
      return mot.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, function (w, i, tout) {
        if (w.length <= 3 || w !== w.toUpperCase() || SIGLES[w]) return w;
        if (/\./.test(tout)) return w;                  // sigle à points : D.T., S.A
        if (/[0-9]/.test(tout)) return w;                // D2P
        return w.charAt(0) + w.slice(1).toLowerCase();
      });
    });
  }
  function court(s, n) { s = casse(String(s || '').replace(/\s*\(.*$/, '').replace(/\s+/g, ' ').trim()); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
  function tronque(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function nomAff(n) { return n.nous ? 'Intégral' : court(n.label, 30); }
  function nomLong(n) { return tronque(casse(String(n.label || '').replace(/\s*\(.*$/, '')), 42); }
  function typeNom(t) { return { groupe: 'Groupe', repartiteur: 'Répartiteur', societe: 'Société', proprietaire: 'Propriétaire', personne: 'Personne', partenaire: 'Partenaire' }[t] || t; }

  // ── chargement : Cytoscape (une fois), polices, données ────────────────────────
  function chargerCy(cb) {
    if (window.cytoscape) { cb(); return; }
    var s = document.createElement('script'); s.integrity = CY_SRI; s.crossOrigin = 'anonymous'; s.src = CY_URL; s.onload = function () { cb(); }; s.onerror = function () { cb('err'); };
    document.head.appendChild(s);
  }
  function chargerDonnees(cb) {
    if (S.d) { cb(); return; }
    fetch('grossistes-liens.json?d=' + new Date().toISOString().slice(0, 10), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      // les sociétés et propriétaires de même nom et de même ligne sont une seule entité (le fichier garde un nœud par fiche)
      var canon = {}, rem = {}, gardes = [];
      j.noeuds.forEach(function (n) {
        if (n.type === 'societe' || n.type === 'proprietaire') { var k = n.type + '|' + norm(n.label) + '|' + norm(n.sous || ''); if (canon[k]) { rem[n.id] = canon[k].id; return; } canon[k] = n; }
        gardes.push(n);
      });
      var vus = {}, liens = [];
      j.liens.forEach(function (l) { var a = rem[l.de] || l.de, b = rem[l.vers] || l.vers, k = a + '>' + b + '|' + l.type; if (a === b || vus[k]) return; vus[k] = 1; liens.push({ de: a, vers: b, type: l.type, label: l.label }); });
      j.noeuds = gardes; j.liens = liens;
      S.d = j; S.N = {}; S.out = {}; S.inn = {};
      j.noeuds.forEach(function (n) { S.N[n.id] = n; S.out[n.id] = []; S.inn[n.id] = []; });
      j.liens.forEach(function (l) { if (S.N[l.de] && S.N[l.vers]) { S.out[l.de].push(l); S.inn[l.vers].push(l); } });
      cb();
    }).catch(function () { cb('err'); });
  }
  function policesPretes(cb) {
    var fait = false; function fin() { if (!fait) { fait = true; cb(); } }
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fin); else fin(); } catch (e) { fin(); }
    setTimeout(fin, 1800);
  }
  function voisins(id) { return S.out[id].map(function (l) { return { e: l, n: S.N[l.vers], sens: 'out' }; }).concat(S.inn[id].map(function (l) { return { e: l, n: S.N[l.de], sens: 'in' }; })); }
  // Les répartiteurs qu'un acteur tient ou dirige, en descendant par les sociétés intermédiaires.
  function atteint(id) {
    var vu = {}, pile = [id], reps = {}, res = [];
    while (pile.length) {
      var a = pile.pop();
      (S.out[a] || []).forEach(function (l) {
        if (l.type === 'membre' || l.type === 'partenaire' || vu[l.vers]) return; vu[l.vers] = 1;
        var t = S.N[l.vers].type;
        if (t === 'repartiteur') { if (!reps[l.vers]) { reps[l.vers] = 1; res.push(l.vers); } } else if (t === 'societe' || t === 'proprietaire') pile.push(l.vers);
      });
    }
    return res;
  }
  function repGroupe(rep) { var l = S.inn[rep.id].filter(function (x) { return x.type === 'membre'; })[0]; return l ? S.N[l.de] : null; }
  // Couleurs des groupes = celles de la légende de la carte (portées par le fichier) ; Intégral seul en orange.
  function couleurDe(n) {
    if (n.nous) return ORANGE;
    if (n.couleur) return n.couleur;
    if (n.type === 'repartiteur') { var g = repGroupe(n); if (g && g.couleur) return g.couleur; }
    return '#94A3B8';
  }
  function ouvrirFiche(n) { if (n && n.fiche && V2.grossisteOpen) V2.grossisteOpen(n.fiche); }
  function lienLabel(a, b) { var l = (S.out[a] || []).filter(function (x) { return x.vers === b && x.label; })[0]; return l ? l.label : ''; }

  // ── éléments Cytoscape ───────────────────────────────────────────────────────
  // Tailles calculées ici (la taille « selon l'étiquette » rend le nœud invisible tant qu'il n'est pas mesuré).
  function dimensions(lab, type) {
    var tel = phone(), f = tel ? 12 / 11 : 1;
    var cw = (type === 'repartiteur' ? 7.0 : type === 'proprietaire' ? 6.9 : 6.3) * f;
    var parts = String(lab || '').split('\n'), max = parts.reduce(function (m, x) { return Math.max(m, x.length); }, 0);
    var maxW = tel ? (type === 'repartiteur' ? 92 : 88) : (type === 'repartiteur' ? 150 : 138);
    var mot = parts.reduce(function (m, x) { return Math.max(m, x.split(' ').reduce(function (mm, y) { return Math.max(mm, y.length); }, 0)); }, 0);
    var w = Math.max(40, Math.min(max * cw + 16, maxW), Math.min(mot * cw + 18, tel ? 128 : 150)), tw = w - 10, lignes = 0;
    parts.forEach(function (x) { lignes += Math.max(1, Math.ceil(x.length * cw / tw)); });
    return { w: Math.round(w), tw: Math.round(tw), h: Math.round(lignes * 14 * f + 12) };
  }
  function elN(n, extra) {
    var c = couleurDe(n);
    var lab = n.type === 'repartiteur' ? (nomLong(n) + (n.sous ? '\n' + tronque(n.sous, 28) : '')) : court(n.label, n.type === 'personne' ? 22 : 30);
    var dim = dimensions(lab, n.type);
    var data = { w: dim.w, h: dim.h, tw: dim.tw, id: n.id, type: n.type, lab: lab, nom: n.label, color: c, tcol: texteSur(c), nous: n.nous ? 1 : 0, fiche: n.fiche || '', n: n.n_fiches || 0 };
    for (var k in (extra || {})) data[k] = extra[k];
    return { group: 'nodes', data: data, classes: (n.nous ? 'nous ' : '') };
  }
  function elE(l, extra) {
    var data = { id: 'e' + (elE.i = (elE.i || 0) + 1), source: l.de, target: l.vers, type: l.type, rde: l.de, rvers: l.vers, lab: tronque(l.label, 80) };
    for (var k in (extra || {})) data[k] = extra[k];
    return { group: 'edges', data: data };
  }
  function baseStyle() {
    var fam = 'Inter, system-ui, -apple-system, sans-serif';
    try { var f = getComputedStyle(document.body).fontFamily; if (f) fam = f; } catch (e) {}
    return [
      { selector: 'node', style: { 'font-family': fam, 'font-size': 11, 'font-weight': 600, color: INK, label: 'data(lab)', 'text-valign': 'center', 'text-halign': 'center', 'text-wrap': 'wrap', 'text-max-width': 120, 'background-color': '#FFFFFF', 'border-width': 1.5, 'border-color': '#8E97AB', 'min-zoomed-font-size': 5 } },
      { selector: 'node[type="repartiteur"]', style: { shape: 'round-rectangle', width: 'data(w)', height: 'data(h)', 'text-max-width': 'data(tw)', padding: 0, 'background-color': 'data(color)', color: 'data(tcol)', 'border-width': 0, 'font-weight': 700, 'text-line-height': 1.2 } },
      { selector: 'node[type="societe"]', style: { shape: 'rectangle', width: 'data(w)', height: 'data(h)', 'text-max-width': 'data(tw)', padding: 0, 'border-color': INK2, 'border-width': 1.4, 'font-size': 10.5 } },
      { selector: 'node[type="proprietaire"]', style: { shape: 'rectangle', width: 'data(w)', height: 'data(h)', 'text-max-width': 'data(tw)', padding: 0, 'border-color': INK, 'border-width': 2.6, 'font-weight': 800, 'font-size': 11.5 } },
      { selector: 'node[type="personne"]', style: { shape: 'ellipse', width: 15, height: 15, 'background-color': '#EEF1F6', 'border-color': INK2, 'border-width': 1.4, 'text-valign': 'bottom', 'text-margin-y': 4, 'font-size': 10, 'font-weight': 600, 'text-max-width': 84 } },
      { selector: 'node.nous', style: { 'border-color': INK, 'border-width': 3, 'background-color': ORANGE, color: INK } },
      { selector: 'edge', style: { 'curve-style': 'bezier', width: 1.3, 'line-color': '#B8C0CF', 'target-arrow-color': '#B8C0CF', 'target-arrow-shape': 'none', 'arrow-scale': 0.9 } },
      // « détient » : trait plein fléché ; « dirige » : tirets sans flèche (un œil doit distinguer « possède » de « dirige »)
      { selector: 'edge[type="detient"], edge[type="possede"]', style: { width: 2.2, 'line-color': '#6B7286', 'target-arrow-color': '#6B7286', 'target-arrow-shape': 'triangle' } },
      { selector: 'edge[type="dirige"]', style: { 'line-style': 'dashed', 'line-dash-pattern': [7, 4], width: 1.6, 'line-color': '#8A93A6', 'target-arrow-shape': 'none' } },
      { selector: '.dim', style: { 'background-color': '#EEF1F6', 'border-color': '#DDE2EB', 'text-opacity': 0, 'line-color': '#E6EAF1', 'target-arrow-color': '#E6EAF1' } },
      { selector: 'node.sel', style: { 'border-color': INK, 'border-width': 3.5 } },
      { selector: 'edge.vif', style: { 'line-color': ACCENT, 'target-arrow-color': ACCENT, width: 2.4 } },
      { selector: 'edge.hov', style: { label: 'data(lab)', 'font-family': fam, 'font-size': 11.5, 'font-weight': 700, color: INK, 'text-background-color': '#FFFFFF', 'text-background-opacity': 1, 'text-background-padding': 3, 'text-border-opacity': 1, 'text-border-width': 1, 'text-border-color': '#C9D0DC', 'text-wrap': 'wrap', 'text-max-width': 190, 'z-index': 99, 'line-color': ACCENT, 'target-arrow-color': ACCENT, width: 2.6 } }
    ];
  }

  // ── montage : phrase, filtre, scène, légende, commandes ────────────────────────
  function legendeHtml() {
    return '<div class="cl-leg" aria-label="Légende">' +
      '<span class="cl-lg"><i class="lg-per"></i>Personne</span>' +
      '<span class="cl-lg"><i class="lg-soc"></i>Société ou holding</span>' +
      '<span class="cl-lg"><i class="lg-pro"></i>Propriétaire final</span>' +
      '<span class="cl-lg"><i class="lg-rep"></i>Répartiteur</span>' +
      '<span class="cl-lg"><i class="lg-nous"></i>Intégral (nous)</span>' +
      '<span class="cl-lg"><i class="lg-det"></i>Détient : trait plein, flèche vers ce qui est détenu</span>' +
      '<span class="cl-lg"><i class="lg-dir"></i>Dirige : tirets ; la fonction s\'affiche au survol ou au toucher du trait</span></div>';
  }
  function squeletteHtml() {
    return '<div class="cl-root" id="cl-root"><div class="cl-phrase" id="cl-phrase"></div><div id="cl-bar"></div><div class="cl-cols" id="cl-cols"><div class="cl-stage" id="cl-stage"><div class="cl-cy" id="cl-cy" aria-label="Schéma des liens : personnes et sociétés à gauche, répartiteurs à droite"></div>' +
      '<div class="cl-ctl"><button type="button" onclick="V2.clZoom(1)" aria-label="Agrandir">+</button><button type="button" onclick="V2.clZoom(-1)" aria-label="Réduire">−</button><button type="button" class="cl-rec" onclick="V2.clFit()">Recentrer</button></div>' +
      '<div class="cl-count" id="cl-count"></div><div class="cl-vide" id="cl-vide" hidden></div></div><aside class="cl-panel" id="cl-panel" hidden></aside></div><div id="cl-leg">' + legendeHtml() + '</div><div class="cl-info" id="cl-info" aria-live="polite"></div></div>';
  }
  function detruireCy() { if (S.cy) { try { S.cy.destroy(); } catch (e) {} S.cy = null; } }
  function majCompte() {
    var c = document.getElementById('cl-count'), v = document.getElementById('cl-vide'); if (!c || !S.cy) return;
    var n = S.cy.nodes(':visible').not('.bus').length;
    c.textContent = FR.format(n) + ' point' + (n > 1 ? 's' : '') + ' dessiné' + (n > 1 ? 's' : '');
    if (v) v.hidden = n > 0;
  }
  function info(html) { var i = document.getElementById('cl-info'); if (i) i.innerHTML = html || ''; }
  function phrase(html) { var i = document.getElementById('cl-phrase'); if (i) i.innerHTML = html || ''; }
  function barre(html) { var i = document.getElementById('cl-bar'); if (i) i.innerHTML = html || ''; }
  // Crée le graphe (jamais dans un conteneur caché : 0×0), puis recadre.
  function creerCy(elements, opts) {
    detruireCy();
    var box = document.getElementById('cl-cy'); if (!box) return null;
    opts = opts || {};
    var cy = window.cytoscape({
      container: box, elements: elements, style: baseStyle().concat(opts.style || []), layout: { name: 'preset' },
      wheelSensitivity: 0.25, minZoom: 0.08, maxZoom: 3.2, boxSelectionEnabled: false, autoungrabify: opts.grab !== true, autounselectify: true,
      userZoomingEnabled: opts.zoom !== false, userPanningEnabled: opts.pan !== false
    });
    S.cy = cy;
    // l'étiquette d'un lien (sa fonction) : jamais sur le schéma à 390 px (elle est dans la carte d'identité) ; sur ordinateur,
    // seulement si elle tient dans le cadre sans recouvrir un nœud ; sinon la fonction reste dans la ligne d'information.
    function etiquetteTient(e) {
      if (phone() || !e.data('lab') || e.hasClass('bus')) return false;
      var cv = etiquetteTient.cv || (etiquetteTient.cv = document.createElement('canvas').getContext('2d'));
      cv.font = '700 11.5px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
      var lab = String(e.data('lab')), tw = cv.measureText(lab).width + 10, w = Math.min(190, tw), h = Math.ceil(tw / 190) * 14 + 8;
      var m = e.midpoint(), z = cy.zoom(), p = cy.pan(), rx = m.x * z + p.x, ry = m.y * z + p.y;
      if (rx - w / 2 < 2 || rx + w / 2 > cy.width() - 2 || ry - h / 2 < 2 || ry + h / 2 > cy.height() - 2) return false;
      var libre = true;
      cy.nodes(':visible').forEach(function (n) { var b = n.renderedBoundingBox({ includeLabels: false }); if (rx + w / 2 > b.x1 - 3 && rx - w / 2 < b.x2 + 3 && ry + h / 2 > b.y1 - 3 && ry - h / 2 < b.y2 + 3) libre = false; });
      return libre;
    }
    cy.on('mouseover', 'edge', function (e) { if (etiquetteTient(e.target)) e.target.addClass('hov'); });
    cy.on('mouseout', 'edge', function (e) { if (!e.target.hasClass('hovfix')) e.target.removeClass('hov'); });
    cy.on('tap', 'edge', function (e) {
      var d = e.target.data(), a = S.N[d.rde], b = S.N[d.rvers];
      cy.edges('.hovfix').removeClass('hov hovfix'); if (etiquetteTient(e.target)) e.target.addClass('hov hovfix');
      if (a && b) info('<b>' + esc(court(a.label, 40)) + '</b> ' + (d.type === 'dirige' ? 'dirige' : d.type === 'detient' || d.type === 'possede' ? 'détient' : 'est lié à') + ' <b>' + esc(court(b.label, 40)) + '</b>' + (d.lab ? ' : ' + esc(d.lab) : ''));
    });
    cy.resize(); cy.fit(undefined, opts.fitPad == null ? 28 : opts.fitPad);
    majCompte();
    return cy;
  }
  V2.clZoom = function (s) { var cy = S.cy; if (!cy) return; var z = cy.zoom() * (s > 0 ? 1.3 : 1 / 1.3); cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), z)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }); };
  V2.clFit = function () { var cy = S.cy; if (!cy) return; cy.resize(); cy.fit(cy.elements(':visible'), 28); };
  V2.concLiensCy = function () { return S.cy; };   // lecture seule, pour les sondes de test
  V2.clFiche = function (id) { ouvrirFiche(S.N[id]); };

  // ── les personnes derrière ──────────────────────────────────────────────────
  function donnees() {
    if (S.dn) return S.dn;
    var gauche = [];
    S.d.noeuds.forEach(function (n) {
      if (['personne', 'societe', 'proprietaire'].indexOf(n.type) < 0) return;
      var r = atteint(n.id); if (r.length >= 2) gauche.push({ n: n, reps: r });
    });
    gauche.sort(function (a, b) { return b.reps.length - a.reps.length || (a.n.type === 'personne' ? 0 : 1) - (b.n.type === 'personne' ? 0 : 1) || a.n.label.localeCompare(b.n.label, 'fr'); });
    var droite = {}; gauche.forEach(function (g) { g.reps.forEach(function (r) { (droite[r] = droite[r] || []).push(g); }); });
    var rep = Object.keys(droite).map(function (id) { var gs = droite[id]; var bar = gs.reduce(function (s, g) { return s + gauche.indexOf(g); }, 0) / gs.length; return { id: id, bar: bar, nb: gs.length }; });
    rep.sort(function (a, b) { return a.bar - b.bar || a.id.localeCompare(b.id); });
    return (S.dn = { gauche: gauche, droite: rep });
  }
  function filtre(D, min) {
    var gauche = D.gauche.filter(function (g) { return g.reps.length >= min; }), seen = {};
    gauche.forEach(function (g) { g.reps.forEach(function (r) { seen[r] = 1; }); });
    return { gauche: gauche, droite: D.droite.filter(function (r) { return seen[r.id]; }) };
  }
  V2.clMin = function (m) { S.st.min = m; dessiner(); };
  function dessiner() {
    var st = S.st, D0 = donnees(), D = filtre(D0, st.min), tel = phone();
    S.tel = tel;
    if (st.sel && !D.gauche.some(function (g) { return g.n.id === st.sel; })) st.sel = null;
    detruireCy();
    var vieux = document.getElementById('cl-liste-w'); if (vieux) vieux.parentNode.removeChild(vieux);
    phrase('<b>Ceux qui sont derrière plusieurs grossistes.</b> À gauche, les personnes et holdings ; à droite, les répartiteurs. Touchez une personne : ses grossistes s\'allument et sa carte d\'identité s\'ouvre.');
    barre('<div class="cl-togs"><span class="cl-togs-t">Derrière au moins</span>' + [2, 3, 4, 6].map(function (m) { var nb = D0.gauche.filter(function (g) { return g.reps.length >= m; }).length; return '<button type="button" class="cl-tog' + (st.min === m ? ' on' : '') + '" aria-pressed="' + (st.min === m) + '" onclick="V2.clMin(' + m + ')">' + m + ' grossistes <em>' + nb + '</em></button>'; }).join('') + '</div>');
    var pan = document.getElementById('cl-panel'), box = document.getElementById('cl-cy');
    if (tel) {
      var listeHtml = '<div class="cl-liste" id="cl-liste" role="listbox" aria-label="Personnes et holdings derrière plusieurs grossistes">' + D.gauche.map(function (g) {
        return '<button type="button" class="cl-li" role="option" data-id="' + esc(g.n.id) + '" onclick="V2.clPers(\'' + esc(g.n.id) + '\')"><span class="cl-li-t">' + (g.n.type === 'personne' ? ICO('user', 16, 2) : ICO('building', 16, 2)) + '<b>' + esc(court(g.n.label, 34)) + '</b></span><em>' + g.reps.length + ' grossistes</em></button>';
      }).join('') + '</div>';
      document.getElementById('cl-cols').insertAdjacentHTML('beforebegin', '<div class="cl-liste-w" id="cl-liste-w">' + listeHtml + '</div>');
    }
    var els = [], H = 0, GOUT = 400, ligne = 34;
    if (!tel) {
      var nl = D.gauche.length, nr = D.droite.length; H = Math.max(nl, nr) * ligne;
      D.gauche.forEach(function (g, i) { var e = elN(g.n, { cnt: g.reps.length }); e.data.lab = court(g.n.label, 26) + '  ·  ' + g.reps.length; e.data.w = 9 + 6.6 * e.data.lab.length; e.position = { x: -e.data.w / 2, y: i * (H / nl) + 10 }; e.classes += 'gch '; els.push(e); });   // flancs droits alignés sur x = 0
      D.droite.forEach(function (r, i) { var e = elN(S.N[r.id]); e.data.lab = nomLong(S.N[r.id]); e.data.w = 16 + 6.3 * e.data.lab.length; e.position = { x: GOUT + e.data.w / 2, y: i * (H / nr) + 10 }; e.classes += 'drt '; els.push(e); });   // flancs gauches alignés : un trait n'a rien à traverser
      var largG = {}, largD = {}; els.forEach(function (e) { if (e.classes.indexOf('gch') >= 0) largG[e.data.id] = e.data.w; else largD[e.data.id] = e.data.w; });
      D.gauche.forEach(function (g) { g.reps.forEach(function (r) { els.push(elE({ de: g.n.id, vers: r, type: g.n.type === 'personne' ? 'dirige' : 'detient', label: lienLabel(g.n.id, r) }, { color: couleurDe(S.N[r]), se: Math.round((largG[g.n.id] || 80) / 2) + 'px 0px', te: -Math.round((largD[r] || 80) / 2) + 'px 0px' })); }); });
      box.style.height = Math.max(520, H * 0.78 + 60) + 'px';
    } else box.style.height = '';
    pan.hidden = false;
    var cy = creerCy(els, { style: [
      { selector: 'node.gch', style: { shape: 'round-rectangle', width: 'data(w)', height: 24, padding: 0, 'text-halign': 'center', 'text-valign': 'center', 'font-size': tel ? 12 : 11, 'text-max-width': 260, 'text-wrap': 'none', 'background-color': '#F3F5F9', 'border-color': INK2 } },
      { selector: 'node.drt', style: { 'font-size': 10.5, padding: 0, width: 'data(w)', height: 22, 'text-wrap': 'none' } },
      { selector: 'node.drt.grille', style: { 'font-size': 12, height: 'data(h)', 'text-wrap': 'wrap', 'text-max-width': 'data(tw)', 'text-line-height': 1.2 } },
      { selector: 'edge', style: { 'curve-style': 'unbundled-bezier', 'control-point-distances': [0], 'control-point-weights': [0.5], 'line-color': 'data(color)', width: 1, opacity: 0.35, 'target-arrow-shape': 'none' } },
      { selector: 'edge[type="detient"]', style: { 'target-arrow-shape': 'triangle', 'target-arrow-color': 'data(color)', 'arrow-scale': 0.9 } },
      { selector: 'edge.vif', style: { width: 2.6, 'line-color': 'data(color)', opacity: 1 } },
      { selector: 'node.gch.dim, node.drt.dim', style: { 'text-opacity': 1, color: '#8A93A6', 'background-color': '#F3F5F9', 'border-color': '#DDE2EB' } },
      { selector: 'edge.dim', style: { opacity: 0.08 } },
      { selector: 'node.bus', style: { width: 2, height: 2, shape: 'ellipse', 'background-opacity': 0, 'border-width': 0, label: '', events: 'no' } },
      { selector: 'edge.bus', style: { 'target-arrow-shape': 'none', 'target-endpoint': 'outside-to-node' } },
      { selector: 'edge[te]', style: { 'target-endpoint': 'data(te)' } },
      { selector: 'edge[se]', style: { 'source-endpoint': 'data(se)' } }
    ], zoom: tel, pan: tel, fitPad: 12, grab: tel });
    // ordinateur : ni zoom ni glisser, la page défile et les lignes gardent une taille lisible
    if (!tel) { cy.userZoomingEnabled(false); cy.userPanningEnabled(false); }
    cy.on('tap', 'node.gch', function (e) { V2.clPers(e.target.id()); });
    cy.on('tap', 'node.drt', function (e) { ouvrirFiche(S.N[e.target.id()]); });
    cy.on('tap', function (e) { if (e.target === cy) V2.clPers(null); });
    V2.clPers(st.sel || (D.gauche[0] && D.gauche[0].n.id) || null, true);
  }
  V2.clPers = function (id, init) {
    var st = S.st, D = filtre(donnees(), st.min), cy = S.cy, tel = phone(); if (!cy) return; st.sel = id;
    var lis = document.querySelectorAll('.cl-li'); for (var i = 0; i < lis.length; i++) { var on = lis[i].getAttribute('data-id') === id; lis[i].classList.toggle('on', on); lis[i].setAttribute('aria-selected', on); }
    var pan = document.getElementById('cl-panel');
    if (tel) {
      // téléphone : seul le schéma de la personne choisie est dessiné. Elle est en haut ; ses grossistes sont en grille de 2 colonnes
      // dessous, de part et d'autre d'un tronc central : chaque trait part de la personne, longe le tronc puis entre dans SON grossiste
      // (jamais d'un grossiste à l'autre, jamais par-dessus un autre nœud).
      var els = [];
      if (id) {
        var g = D.gauche.filter(function (x) { return x.n.id === id; })[0];
        if (g) {
          var e0 = elN(g.n); e0.data.lab = court(g.n.label, 30); e0.data.w = 12 + 7.2 * e0.data.lab.length; e0.position = { x: 0, y: 0 }; e0.classes += 'gch '; els.push(e0);
          var typeLien = g.n.type === 'personne' ? 'dirige' : 'detient', GOUT = 16, y = 58, prec = id, lignes = [];
          for (var k = 0; k < g.reps.length; k += 2) lignes.push(g.reps.slice(k, k + 2));
          lignes.forEach(function (paire, li) {
            var noeuds = paire.map(function (r) { var e = elN(S.N[r]); e.data.lab = nomLong(S.N[r]) + (S.N[r].sous ? '\n' + tronque(S.N[r].sous, 22) : ''); var dm = dimensions(e.data.lab, 'repartiteur'); e.data.w = dm.w; e.data.h = dm.h; e.data.tw = dm.tw; return e; });
            var hmax = noeuds.reduce(function (m, e) { return Math.max(m, e.data.h); }, 0);
            var yc = y + hmax / 2, jid = 'bus' + li;
            els.push({ group: 'nodes', data: { id: jid, type: 'bus', lab: '' }, position: { x: 0, y: yc }, classes: 'bus' });
            els.push(elE({ de: prec, vers: jid, type: typeLien, label: '' }, { rde: id, rvers: jid }));
            els[els.length - 1].classes = 'bus';
            noeuds.forEach(function (e, c) {
              var gauche = c === 0, w = e.data.w;
              e.position = { x: (gauche ? -1 : 1) * (GOUT + w / 2), y: yc }; e.classes += 'drt grille ';
              els.push(e);
              els.push(elE({ de: jid, vers: e.data.id, type: typeLien, label: lienLabel(id, e.data.id) }, { color: couleurDe(S.N[e.data.id]), rde: id, rvers: e.data.id, te: (gauche ? 1 : -1) * Math.round(w / 2) + 'px 0px' }));
            });
            prec = jid; y += hmax + 14;
          });
          document.getElementById('cl-cy').style.height = Math.min(760, y + 110) + 'px';   // bande basse libre pour les boutons +, − et le compteur
        }
      }
      cy.elements().remove(); if (els.length) cy.add(els);
      cy.resize();
      if (els.length) { var bb = cy.elements().boundingBox(), z = Math.min(1.3, (cy.width() - 28) / Math.max(1, bb.w), (cy.height() - 100) / Math.max(1, bb.h)); cy.zoom(z); cy.center(); cy.panBy({ x: 0, y: -26 }); }
      cy.edges().addClass('vif'); majCompte();
      var d = document.getElementById('cl-vide'); if (d) { d.textContent = 'Choisissez une personne ou une société dans la liste.'; d.hidden = !!els.length; }
    } else {
      cy.elements().removeClass('dim vif sel lit');
      if (id) {
        var nd = cy.getElementById(id), nb = nd.closedNeighborhood();
        cy.elements().not(nb).addClass('dim'); nb.edges().addClass('vif'); nb.nodes('.drt').addClass('lit'); nd.addClass('sel');
      }
      majCompte();
    }
    pan.innerHTML = id ? carteIdentite(S.N[id]) : '<div class="cl-pan-v"><b>Une carte d\'identité par personne.</b><br>Touchez un nom à gauche : fonctions, parcours et source s\'affichent ici.</div>';
    // 15/10/2026 (choix de Will) : sur téléphone la carte d'identité s'ouvre sous le schéma, hors de l'écran → on y descend.
    if (id && !init && pan.scrollIntoView) { if (tel) pan.scrollIntoView({ block: 'start', behavior: 'smooth' }); else if (window.innerWidth < 1100) pan.scrollIntoView({ block: 'nearest' }); }
    info(id ? '<b>' + esc(court(S.N[id].label, 50)) + '</b> tient ou dirige ' + FR.format(atteint(id).length) + ' grossiste' + (atteint(id).length > 1 ? 's' : '') + '. Touchez un grossiste pour ouvrir sa fiche.' : 'Touchez un grossiste pour ouvrir sa fiche, une personne ou une société pour voir ses grossistes.');
  };
  // Carte d'identité : fonctions et parcours lus dans les fiches (V2.grossistesInfo), sinon dans les libellés des liens.
  function memeNom(a, b) {
    var ta = norm(a).replace(/\(.*?\)/g, ' ').split(/[^a-z]+/).filter(function (x) { return x.length > 2; }), tb = norm(b).replace(/\(.*?\)/g, ' ').split(/[^a-z]+/).filter(function (x) { return x.length > 2; });
    if (!ta.length || !tb.length) return false;
    var pet = ta.length <= tb.length ? ta : tb, gr = ta.length <= tb.length ? tb : ta;
    return pet.every(function (x) { return gr.indexOf(x) >= 0; });
  }
  function carteIdentite(n) {
    var reps = atteint(n.id), directs = voisins(n.id).filter(function (v) { return v.n.type === 'repartiteur' || v.n.type === 'societe' || v.n.type === 'proprietaire'; });
    var h = '<div class="cl-id"><div class="cl-id-h"><span class="cl-id-t">' + esc(typeNom(n.type)) + '</span><h3>' + esc(casse(n.label.replace(/\s*\(.*$/, ''))) + '</h3>' + (n.sous ? '<p>' + esc(n.sous) + '</p>' : '') + '</div>';
    var fonctions = [];
    if (n.type === 'personne' && S.info) {
      directs.forEach(function (v) {
        if (v.n.type !== 'repartiteur' || !v.n.fiche) return;
        var f = S.info.byId(v.n.fiche); if (!f || !f.personnes) return;
        f.personnes.forEach(function (p) { if (memeNom(p.nom, n.label)) fonctions.push({ rep: nomAff(v.n), fonction: p.fonction, depuis: p.depuis, parcours: p.parcours, source: p.source }); });
      });
    }
    if (fonctions.length) {
      h += '<ul class="cl-id-l">' + fonctions.slice(0, 12).map(function (f) { return '<li><b>' + esc(f.rep) + '</b> · ' + esc(f.fonction || '') + (f.depuis ? ' <em>depuis ' + esc(f.depuis) + '</em>' : '') + (f.parcours ? '<small>' + esc(f.parcours) + '</small>' : '') + (f.source && /^https?:/.test(f.source) ? '<a href="' + esc(f.source) + '" target="_blank" rel="noopener">Source</a>' : '') + '</li>'; }).join('') + '</ul>' + (fonctions.length > 12 ? '<div class="cl-id-p">et ' + (fonctions.length - 12) + ' autres fonctions</div>' : '');
    } else {
      h += '<ul class="cl-id-l">' + directs.slice(0, 14).map(function (v) { return '<li><b>' + esc(nomAff(v.n)) + '</b> · ' + (v.sens === 'out' ? (v.e.type === 'dirige' ? 'dirige' : 'détient') : (v.e.type === 'dirige' ? 'dirigé par' : 'détenu par')) + (v.e.label ? '<small>' + esc(v.e.label) + '</small>' : '') + '</li>'; }).join('') + '</ul>';
    }
    h += '<div class="cl-id-g">' + FR.format(reps.length) + ' grossiste' + (reps.length > 1 ? 's' : '') + ' derrière ' + (n.type === 'personne' ? 'cette personne' : 'cette société') + ' :</div><div class="cl-id-b">' + reps.map(function (r) { var x = S.N[r]; return '<button type="button" onclick="V2.clFiche(\'' + esc(r) + '\')"><i style="background:' + esc(couleurDe(x)) + '"></i>' + esc(nomAff(x)) + '</button>'; }).join('') + '</div>';
    return h + '<div class="cl-id-s">Source : ' + esc(court(S.d.source, 120)) + '</div></div>';
  }

  // ── rendu de l'onglet ─────────────────────────────────────────────────────────
  function lancer() {
    var tour = ++S.montage;
    if (!S.host) return;
    var root = document.getElementById('cl-root');
    if (!root || !S.host.contains(root)) S.host.innerHTML = squeletteHtml();
    policesPretes(function () {
      if (tour !== S.montage || !document.getElementById('cl-cy')) return;
      try { dessiner(); } catch (err) { console.error('liens', err); var d = document.getElementById('cl-vide'); if (d) { d.hidden = false; d.textContent = 'Ce schéma n\'a pas pu se dessiner.'; } }
    });
  }
  V2.concLiensRender = function (host) {
    injectCss();
    if (S.host === host && document.getElementById('cl-root') && host.contains(document.getElementById('cl-root'))) return;   // déjà monté : on ne reconstruit pas
    S.host = host;
    host.innerHTML = '<div class="cl-charge"><div class="v2-spinner"></div><div>Chargement des liens…</div></div>';
    var tour = ++S.montage, etat = { c: null, d: null, g: null }, fait = 0;
    function fin() {
      if (++fait < 3 || tour !== S.montage) return;
      if (!document.body.contains(host)) return;
      if (etat.c || !window.cytoscape) { host.innerHTML = '<div class="v2-empty"><div class="v2-empty-t">Le schéma n\'a pas pu se charger</div><div class="v2-empty-d">La librairie de dessin est indisponible. Rechargez la page.</div></div>'; return; }
      if (etat.d) { host.innerHTML = '<div class="v2-empty"><div class="v2-empty-t">Les liens ne sont pas chargés</div><div class="v2-empty-d">Fichier grossistes-liens.json introuvable. Rechargez la page.</div></div>'; return; }
      S.info = (!etat.g && V2.grossistesInfo) ? V2.grossistesInfo() : null;
      lancer();
    }
    chargerCy(function (e) { etat.c = e || null; fin(); });
    chargerDonnees(function (e) { etat.d = e || null; fin(); });
    if (V2.grossistesPret) V2.grossistesPret(function (e) { etat.g = e || null; fin(); }); else { etat.g = 'x'; fin(); }
  };
  window.addEventListener('resize', function () {
    if (!S.cy || !document.getElementById('cl-cy')) return;
    clearTimeout(S.rs); S.rs = setTimeout(function () { if (!S.cy) return; var tel = phone(); if (S.tel !== null && S.tel !== tel) { dessiner(); return; } S.cy.resize(); }, 200);
  });
  window.addEventListener('hashchange', function () { var h = location.hash || ''; if (!/^#concurrents\/liens/.test(h)) detruireCy(); });

  // ── CSS : la DA de JARVIS (pièces .v2-*), UN accent ─────────────────────────────
  function injectCss() {
    if (document.getElementById('v2-conc-liens-css')) return;
    var s = document.createElement('style'); s.id = 'v2-conc-liens-css';
    s.textContent = [
      '.cl-root{display:flex;flex-direction:column;gap:12px}',
      '.cl-charge{display:flex;flex-direction:column;align-items:center;gap:12px;padding:90px 20px;color:var(--muted)}',
      '.cl-phrase{font-size:14px;line-height:1.5;color:var(--ip-ink-2);max-width:78ch}.cl-phrase b{color:var(--ip-ink)}',
      '.cl-togs{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px}',
      '.cl-togs-t{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-right:4px}',
      '.cl-tog em{font-style:normal;margin-left:6px;color:var(--muted);font-variant-numeric:tabular-nums}.cl-tog.on em{color:#fff}',
      '.cl-tog{min-height:44px;padding:0 14px;border:1px solid var(--line);border-radius:var(--r-btn);background:var(--card);font:inherit;font-size:13px;font-weight:700;color:var(--ip-ink-2);cursor:pointer;box-shadow:var(--sh-1)}',
      '.cl-tog.on{background:var(--ip-ink);border-color:var(--ip-ink);color:#fff}',
      '.cl-cols{display:flex;gap:16px;align-items:stretch}',
      '.cl-stage{position:relative;isolation:isolate;flex:1;min-width:0;border-radius:var(--r-card);overflow:hidden;border:1px solid var(--line);box-shadow:var(--sh-3),0 -40px 80px -40px color-mix(in srgb,' + ACCENT + ' 26%,transparent);background:radial-gradient(120% 90% at 50% -10%,#FFFFFF 0%,#F1F5FA 62%,#E8EEF6 100%)}',
      '.cl-cy{width:100%;height:calc(100vh - 360px);min-height:460px;max-height:none;touch-action:pan-y}',
      '.cl-ctl{position:absolute;right:10px;top:10px;z-index:5;display:none;gap:6px}',
      '.cl-ctl button{min-width:44px;height:44px;padding:0 12px;border:1px solid var(--line);border-radius:var(--r-btn);background:#fff;box-shadow:var(--sh-2);font:inherit;font-size:18px;font-weight:700;color:var(--ip-ink);cursor:pointer}.cl-ctl .cl-rec{font-size:13px}',
      '.cl-count{position:absolute;left:12px;top:12px;z-index:5;padding:6px 12px;border-radius:var(--r-pill);background:#fff;border:1px solid var(--line);box-shadow:var(--sh-2);font-size:13px;font-weight:700;color:var(--ip-ink);font-variant-numeric:tabular-nums;pointer-events:none}',
      '.cl-vide{position:absolute;inset:0;z-index:4;display:grid;place-items:center;text-align:center;padding:30px;font-size:15px;font-weight:700;color:var(--ip-ink-2)}.cl-vide[hidden]{display:none}',
      '.cl-panel{flex:none;width:400px;max-width:42%;border-radius:var(--r-card);background:var(--card);border:1px solid var(--line);box-shadow:var(--sh-pop);overflow:auto;max-height:760px;padding:4px 18px 20px;align-self:flex-start}.cl-panel[hidden]{display:none}',
      '.cl-id-h{padding:16px 0 10px;border-bottom:1px solid var(--line)}.cl-id-h h3{margin:4px 0 0;font-size:20px;font-weight:800;letter-spacing:-.02em;color:var(--ip-ink);line-height:1.15}.cl-id-h p{margin:6px 0 0;font-size:13px;color:var(--muted-d,#46506A);line-height:1.45}',
      '.cl-id-t{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:' + ACCENT_D + '}',
      '.cl-id-g{margin:14px 0 6px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}',
      '.cl-id-l{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}.cl-id-l li{font-size:13.5px;line-height:1.45;color:var(--ip-ink-2);padding-bottom:8px;border-bottom:1px solid var(--line-2)}.cl-id-l li b{color:var(--ip-ink)}.cl-id-l em{font-style:normal;color:var(--muted)}',
      '.cl-id-l small{display:block;font-size:12.5px;color:var(--muted-d,#46506A);margin-top:2px}.cl-id-l a{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;margin-left:-4px;font-size:12.5px;font-weight:700;color:var(--ip-blue)}',
      '.cl-id-b{display:flex;flex-wrap:wrap;gap:6px}.cl-id-b button{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:var(--r-pill);background:var(--card);font:inherit;font-size:13px;font-weight:700;color:var(--ip-ink);cursor:pointer}.cl-id-b i{width:10px;height:10px;border-radius:50%}',
      '.cl-id-s{margin-top:14px;font-size:12px;line-height:1.5;color:var(--muted)}.cl-id-p{font-size:12.5px;color:var(--muted)}',
      '.cl-pan-v{padding:16px 0;font-size:13.5px;line-height:1.55;color:var(--ip-ink-2)}',
      '.cl-leg{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12.5px;font-weight:600;color:var(--ip-ink-2)}',
      '.cl-lg{display:inline-flex;align-items:center;gap:7px}.cl-lg i{display:inline-block;flex:none;box-sizing:border-box}',
      '.lg-rep{width:20px;height:12px;border-radius:4px;background:#0E8F8A}.lg-soc{width:16px;height:12px;background:#fff;border:1.4px solid ' + INK2 + '}',
      '.lg-pro{width:16px;height:12px;background:#fff;border:2.6px solid ' + INK + '}.lg-per{width:12px;height:12px;border-radius:50%;background:#EEF1F6;border:1.4px solid ' + INK2 + '}',
      '.lg-nous{width:20px;height:12px;border-radius:4px;background:' + ORANGE + ';border:2.5px solid ' + INK + '}',
      '.lg-det{width:26px;height:0;border-top:2.4px solid #6B7286;position:relative}.lg-det:after{content:"";position:absolute;right:-1px;top:-5px;border-left:7px solid #6B7286;border-top:4px solid transparent;border-bottom:4px solid transparent}.lg-dir{width:26px;height:0;border-top:2px dashed #8A93A6}',
      '.cl-info{min-height:44px;padding:12px 16px;border-radius:var(--r-md);background:var(--card);border:1px solid var(--line);box-shadow:var(--sh-1);font-size:13.5px;line-height:1.55;color:var(--ip-ink-2)}.cl-info b{color:var(--ip-ink)}.cl-info:empty{display:none}',
      '.cl-liste-w{margin:0}',
      '.cl-liste{display:flex;flex-direction:column;gap:6px;max-height:232px;overflow:auto;padding:4px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);-webkit-overflow-scrolling:touch}',
      '.cl-li{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--card);font:inherit;font-size:13.5px;color:var(--ip-ink);cursor:pointer;text-align:left}',
      '.cl-li-t{display:inline-flex;align-items:center;gap:8px;min-width:0}.cl-li b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cl-li em{font-style:normal;font-size:12.5px;font-weight:700;color:' + ACCENT_D + ';white-space:nowrap}',
      '.cl-li.on{background:var(--ip-ink);border-color:var(--ip-ink);color:#fff}.cl-li.on em{color:#fff}',
      '@media(max-width:1023px){.cl-cols{flex-direction:column}.cl-panel{width:auto;max-width:none;max-height:none;align-self:stretch}}',
      '@media(max-width:699px){.cl-panel{scroll-margin-top:72px}.cl-cy{height:340px;min-height:300px;touch-action:none}.cl-ctl{display:flex;top:auto;bottom:10px}.cl-count{top:auto;bottom:64px;left:10px}.cl-root{gap:8px}.cl-phrase{font-size:13px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}}'
    ].join('');
    document.head.appendChild(s);
  }
})();
