/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · LA CARTE · « MA CARTE » (écran) — 26/11/2026
   Will : « chaque commerciaux puisse avoir sa propre carte ciblé avec son secteur ses clients ses prospect ses groupements ses données
   et tout ce qui est même etude comme on a mis sur phirst ». Maquette choisie : « 2 · Mon secteur d'abord ». Choix cliqué (2e séance) :
   « Ma carte » REMPLACE l'ouverture de La carte ; « Toute la France » reste à un clic, dans la même barre. Pas de nouvel écran.

   Ce fichier branche, sur La carte (v2-carte.js), quatre choses :
   1. une bascule « Mon secteur · Toute la France » en tête de la barre de filtres (et « Secteur de … » pour qui voit tout) ;
   2. le panneau « Mon secteur » (4 chiffres, légende des aplats, groupements présents, pistes) + le portrait d'une UGA au clic ;
   3. les UGA du secteur en aplat (contours : uga-contours-data.js, chargé à la demande) et les tournées de livraison ;
   4. le bouton « Étude de zone » de la fiche → l'étude de Phirst (phirst-etude-pur.js, chargé tel quel) + une feuille « Chez Intégral ».

   Tous les calculs sont dans v2-carte-secteur-pur.js (testé). v2-carte.js ne passe ici que par des gardes `if (V2.carteSecteur)`.
   Confidentialité : le chiffre d'affaires n'est sommé que sur les officines dont `voitCa(p)` est vrai (règle du 24/09/2026) ; la part
   d'officines clientes est un comptage, jamais des euros. Mode « Toute la France » = La carte d'avant, intacte.
   Préfixes : CSS `sx-` (panneau) et `pe-` / `#pe` (étude, feuille v2-carte-etude.css).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var P = window.CARTE_SECTEUR_PUR;
  if (!P) return;   // calcul absent : La carte reste celle d'avant (aucune garde de v2-carte.js ne se déclenche)
  var NB = P.NB;
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var S = {
    A: null, map: null,
    mode: null,          // 'secteur' | 'france' (null = pas encore décidé pour cette ouverture)
    nom: '', perso: '',  // commercial dont on regarde le secteur · commercial connecté (nom tel que La carte le connaît)
    sect: null, ind: null, stats: null, partUga: null, grpCli: null,
    ugaSel: null, replie: false, ficheOuverte: false,
    etat: { contours: '', tournees: '', infos: '', detail: '' },   // '' pas demandé · 'attente' · 'ok' · 'absent'
    prepT: null, kmCache: {}, pistesAff: [],
    pan: null, groupe: null, polys: {}, tracesLayer: null, tourOn: true, hClic: null, hZoom: null, nbApprox: 0,
    idxEssai: false, idxAttente: null, persoOk: false, choixFait: false,
    pe: { jeton: 0, ouverte: false, carte: null, dernier: null }
  };

  // ── Contexte de lecture donné au calcul pur ──
  function ctx() {
    var A = S.A, D = A.donnees();
    return {
      pts: D.p, uga: D.uga, grp: D.grp,
      commsOf: A.commsOf, isClient: A.isClient,
      palierDe: function (p) { var m = /^Client ([ABC])$/.exec(A.segOf(p)); return m ? m[1] : ''; },
      voitCa: A.voitCa, caMois: caMois, kmTournee: kmTournee, info: infoDe
    };
  }
  // CA du dernier mois et du mois d'avant (CARTE_DETAIL.m suit WML_MOIS). null = non lu : jamais un faux zéro.
  function caMois(p) {
    var det = S.A && S.A.detailPret(), W = window.WML_MOIS || [];
    if (!det || !p[13] || W.length < 2) return null;
    var d = det[p[13]]; if (!d || !Array.isArray(d.m) || d.m.length !== W.length) return null;
    return { d: d.m[W.length - 1], p: d.m[W.length - 2] };
  }
  function kmTournee(p) {
    if (!S.prepT) return null;
    var k = p[0] + ',' + p[1];
    if (S.kmCache[k] === undefined) S.kmCache[k] = P.plusProcheTournee(p[0], p[1], S.prepT);
    return S.kmCache[k];
  }
  function infoDe(p) { return (window.OFFICINES_INFOS && p[13]) ? (window.OFFICINES_INFOS[String(p[13])] || null) : null; }
  function moisDernier() { var W = window.WML_MOIS || []; return W.length ? P.moisNom(W[W.length - 1]) : ''; }
  function moisAvant() { var W = window.WML_MOIS || []; return W.length > 1 ? P.moisNom(W[W.length - 2]).split(' ')[0] : ''; }
  function peutChoisir() { return !V2.ventesRestreintes || !V2.ventesRestreintes(); }   // qui voit tout (et la direction) regarde aussi le secteur d'un collègue
  function pluriel(n, un, pl) { return n > 1 ? pl : un; }
  function etroit() { return !!(S.A && S.A.etroit()); }

  // ═══ Décider : secteur ou France ═══
  function calculerSecteur() {
    var c = ctx();
    S.sect = P.secteurDe(S.nom, c);
    S.ind = null; S.stats = null; S.partUga = null; S.grpCli = null; S.kmCache = {};
    return c;
  }
  // Le commercial connecté a-t-il un secteur ? (calculé une fois par lecture des données, pas à chaque redessin de la barre)
  function persoPret() { S.persoOk = !!(S.perso && (S.perso === S.nom ? S.sect.codes.length : P.secteurDe(S.perso, ctx()).codes.length)); }
  function filtre() {
    var c = ctx(), sect = S.sect;
    return function (p) { return P.dansSecteur(p, sect, c); };
  }
  function appliquerMode() { S.A.poserFiltre(S.mode === 'secteur' && S.sect && S.sect.codes.length ? filtre() : null); }

  var API = V2.carteSecteur = {
    // Appelé par v2-carte.js à chaque ouverture réelle de la page (pas un redessin) : on repart du secteur.
    nouvelleOuverture: function () { S.mode = null; S.ugaSel = null; S.replie = false; S.ficheOuverte = false; S.choixFait = false; },

    // Appelé par boot() : les données sont là, la carte pas encore. Décide du mode et pose le filtre AVANT la barre et les marqueurs.
    preparer: function (A) {
      S.A = A; injectCss();   // la bascule de la barre doit être habillée même quand la carte s'ouvre sur la France
      S.perso = A.monNom() || '';
      if (S.mode === null || !S.nom) S.nom = S.perso || '';
      calculerSecteur(); persoPret();
      if (S.mode === null) {
        // direction / profil sans commercial : « Toute la France » comme aujourd'hui, avec le sélecteur « Secteur de … » à portée
        S.mode = (S.perso && S.persoOk) ? 'secteur' : 'france';
      }
      if (S.mode === 'secteur' && !S.sect.codes.length) S.mode = 'france';
      appliquerMode();
    },
    // Les données arrivées APRÈS l'ouverture (ventes, commerciaux) changent peut-être le secteur : on le relit.
    donneesChangees: function () {
      if (!S.A) return;
      S.perso = S.A.monNom() || '';
      if (!S.nom) S.nom = S.perso;
      calculerSecteur(); persoPret();
      var avant = S.mode;
      if (S.mode === 'france' && S.persoOk && S.nom === S.perso && !S.choixFait) S.mode = 'secteur';   // les données du commercial sont arrivées après l'ouverture
      appliquerMode();
      if (S.mode === 'secteur' && S.A.carte()) {
        monter();
        if (avant !== 'secteur') cadrerSecteur(); else { dessinerUga(); dessinerTournees(); rendrePanneau(); }
      }
      S.A.redessinerBarre();
    },

    // La bascule + le sélecteur, en tête de la barre de filtres.
    barreHtml: function () {
      if (!S.A) return '';
      var perso = S.persoOk;
      if (!perso && !peutChoisir()) return '';   // commercial sans secteur connu : rien à basculer
      var sec = S.mode === 'secteur', qui = (S.nom && S.nom !== S.perso) ? 'Secteur de ' + S.nom : (perso ? 'Mon secteur' : 'Un secteur');
      var h = '<div class="cn-seg cn-statut sx-mode" role="group" aria-label="Étendue de la carte">' +
        '<button type="button" id="sx-b-secteur"' + (sec ? ' class="on"' : '') + ' aria-pressed="' + sec + '" onclick="V2.carteSecteur.mode(\'secteur\')">' + esc(qui) + '</button>' +
        '<button type="button" id="sx-b-france"' + (!sec ? ' class="on"' : '') + ' aria-pressed="' + !sec + '" onclick="V2.carteSecteur.mode(\'france\')">Toute la France</button></div>';
      if (peutChoisir() && sec) {
        var noms = S.A.nomsAvecSecteur();
        h += '<label class="cn-fb-lbl sx-qui">Secteur de <select class="cn-sel cn-fb-sel sx-sel" aria-label="Secteur de" onchange="V2.carteSecteur.choisir(this.value)">' +
          noms.map(function (n) { return '<option value="' + esc(n) + '"' + (n === S.nom ? ' selected' : '') + '>' + esc(n) + (n === S.perso ? ' (moi)' : '') + '</option>'; }).join('') + '</select></label>';
      }
      return h;
    },

    // Clic sur la bascule.
    mode: function (m) {
      if (!S.A || S.mode === m) return;
      if (m === 'secteur') {
        if (!S.nom) { var noms = S.A.nomsAvecSecteur(); S.nom = S.perso || noms[0] || ''; calculerSecteur(); }
        if (!S.sect.codes.length) return;
      }
      S.mode = m; S.choixFait = true; S.ugaSel = null;
      basculer(true);
    },
    // « Secteur de … » : regarder celui d'un collègue.
    choisir: function (nom) {
      if (!S.A || !nom || (nom !== S.perso && !peutChoisir())) return;   // un commercial restreint ne regarde que son secteur
      S.nom = nom; S.choixFait = true; S.ugaSel = null;
      var c = calculerSecteur();
      if (!S.sect.codes.length) { if (S.A && V2.toast) V2.toast('Aucun secteur connu pour ' + nom); S.nom = S.perso || nom; calculerSecteur(); S.A.redessinerBarre(); return; }
      S.mode = 'secteur';
      basculer(true);
    },
    // v2-carte.js (homeView) : vrai si la vue d'ouverture est déjà cadrée sur le secteur.
    cadrer: function () {
      if (S.mode !== 'secteur' || !S.sect || !S.sect.codes.length || !S.A || !S.A.carte()) return false;
      cadrerSecteur(); return true;
    },
    // Le panneau et la fiche ne s'empilent pas : la fiche prend la place du panneau, qui revient à sa fermeture.
    avantFiche: function () {
      S.ficheOuverte = true; majPanneauVisible();
      // Un clic sur un point ouvre la fiche DANS le même clic que celui que la carte reçoit ensuite : ce clic-là n'est pas un clic sur une UGA.
      S.pointClic = true; setTimeout(function () { S.pointClic = false; }, 0);
    },
    apresFermetureFiche: function () { S.ficheOuverte = false; majPanneauVisible(); },
    // Bouton « Étude de zone » sous les actions de la fiche, quand l'officine a une étude.
    apresFiche: function (i) {
      etudeIndex(function () {
        var D = S.A && S.A.donnees(), p = D && D.p[i], id = p && p[13] != null ? String(p[13]) : '';
        if (!p || !id || !window.ETUDES_ZONE_IDX || !window.ETUDES_ZONE_IDX[id]) return;
        if (S.A.ficheIdx() !== i) return;
        var pacts = document.querySelector('#cn-fiche .cn-pacts'); if (!pacts || pacts.querySelector('.sx-etude-btn')) return;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'v2-btn v2-btn-primary cn-pact-full sx-etude-btn';
        b.setAttribute('onclick', 'V2.carteSecteur.etude(' + i + ')'); b.textContent = 'Étude de zone';
        var apres = pacts.querySelector('.cn-pact-full'); if (apres && apres.nextSibling) pacts.insertBefore(b, apres.nextSibling); else pacts.insertBefore(b, pacts.firstChild);
      });
    },
    etude: function (i) { ouvrirEtude(i); },
    // Posé par v2-carte.js une fois la carte créée (le fond, les marqueurs et la vue de départ sont prêts).
    monter: function () { monter(); },
    // Pour les essais : l'état lu en direct (jamais pour le code de l'app).
    _etat: function () { return S; },
    replier: function () { S.replie = !S.replie; rendrePanneau(); },
    retour: function () { choisirUga(null); },
    tournees: function () { S.tourOn = !S.tourOn; dessinerTournees(); rendrePanneau(); },
    ouvrirPiste: function (k) { var x = S.pistesAff[k]; if (x != null && V2.carteLocate) V2.carteLocate(x); }
  };

  function basculer(cadre) {
    appliquerMode();
    S.A.rafraichir();            // marqueurs, compteur, barre (le menu de bascule se redessine)
    monter();
    var map = S.A.carte();
    if (map && cadre) {
      if (S.mode === 'secteur') cadrerSecteur();
      else { try { map.setView([46.6, 2.4], 6); } catch (e) {} }
    }
  }

  // ═══ Dessin sur la carte ═══
  function limiter() { return window.L; }
  function monter() {
    var A = S.A, map = A && A.carte(), L = limiter(); if (!map || !L) return;
    var host = document.querySelector('.cn-maparea'); if (!host) return;
    if (S.map !== map) {   // carte neuve (nouvelle ouverture) : les anciennes couches sont parties avec l'ancienne carte
      S.map = map; S.groupe = null; S.polys = {}; S.tracesLayer = null; S.pan = null; S.hClic = null; S.hZoom = null;
    }
    if (S.mode !== 'secteur') {
      host.classList.remove('sx-on'); host.removeAttribute('data-sx');
      if (S.groupe) { try { map.removeLayer(S.groupe); } catch (e) {} S.groupe = null; S.polys = {}; }
      if (S.tracesLayer) { try { map.removeLayer(S.tracesLayer); } catch (e) {} S.tracesLayer = null; }
      if (S.pan && S.pan.parentNode) S.pan.parentNode.removeChild(S.pan); S.pan = null;
      if (S.hClic) { map.off('click', S.hClic); S.hClic = null; }
      try { if (map.zoomControl && map.zoomControl.getPosition() !== 'topleft') map.zoomControl.setPosition('topleft'); } catch (e) {}
      return;
    }
    host.classList.add('sx-on');
    try { if (map.zoomControl) map.zoomControl.setPosition('topright'); } catch (e) {}
    injectCss();
    if (!map.getPane('sx-uga')) { var pn = map.createPane('sx-uga'); pn.style.zIndex = 380; }
    if (!S.rendu) S.rendu = {};
    if (!S.rendu[S.map._leaflet_id]) S.rendu[S.map._leaflet_id] = L.canvas({ pane: 'sx-uga', padding: 0.4 });
    if (!S.pan) {
      var pan = document.createElement('div'); pan.id = 'sx-pan'; pan.className = 'sx-pan'; pan.setAttribute('role', 'region'); pan.setAttribute('aria-label', 'Mon secteur');
      host.appendChild(pan); S.pan = pan;
    }
    if (!S.hClic) { S.hClic = ugaClic; map.on('click', S.hClic); }
    if (!S.hZoom) { S.hZoom = function () { restyler(); }; map.on('zoomend', S.hZoom); }
    majPanneauVisible();
    rendrePanneau();
    // Données à la demande : chacune met le panneau à jour en arrivant, aucune ne bloque les autres.
    charger('ugacontours', 'UGA_CONTOURS', 'contours', function () { dessinerUga(); });
    charger('tournees', 'TOURNEES_ECRAN', 'tournees', function () { S.prepT = window.TOURNEES_ECRAN ? P.preparerTournees(window.TOURNEES_ECRAN) : null; S.kmCache = {}; S.stats = null; S.ind = null; dessinerTournees(); });
    charger('officinesinfos', 'OFFICINES_INFOS', 'infos', function () { /* repère de reprise */ });
    if (S.etat.detail === '' ) {
      S.etat.detail = 'attente';
      S.A.detail(function () { S.etat.detail = S.A.detailPret() ? 'ok' : 'absent'; S.stats = null; rendrePanneau(); });
    }
  }
  // Une donnée à la demande : promesse de V2.loadFiles ; jamais d'exception ; ce qui manque est DIT dans le panneau.
  function charger(cle, glob, drapeau, suite) {
    if (window[glob]) { S.etat[drapeau] = 'ok'; suite(); rendrePanneau(); return; }
    if (S.etat[drapeau] === 'attente') return;
    if (S.etat[drapeau] === 'absent') { rendrePanneau(); return; }
    S.etat[drapeau] = 'attente';
    var fin = function () { S.etat[drapeau] = window[glob] ? 'ok' : 'absent'; try { suite(); } catch (e) {} if (S.mode === 'secteur') rendrePanneau(); };
    if (!V2.loadFiles) { fin(); return; }
    V2.loadFiles([cle]).then(fin, fin);
  }

  // Aplats des UGA du secteur (part d'officines clientes) ; contour approché en pointillé quand le contour officiel manque.
  function partParUga() {
    if (S.partUga) return S.partUga;
    var c = ctx(), n = {}, cl = {}, i, p, u;
    for (i = 0; i < c.pts.length; i++) { p = c.pts[i]; u = p[2]; if (u == null || !S.sect.ugas[u]) continue; n[u] = (n[u] || 0) + 1; if (c.isClient(p)) cl[u] = (cl[u] || 0) + 1; }
    var out = {};
    Object.keys(n).forEach(function (u) { out[c.uga[u]] = { idx: +u, n: n[u], cl: cl[u] || 0, part: n[u] ? Math.round((cl[u] || 0) / n[u] * 1000) / 10 : null }; });
    return (S.partUga = out);
  }
  function styleUga(code, approx) {
    var info = partParUga()[code], k = info ? P.classeAplat(info.part) : -1, sel = S.ugaSel === code, map = S.map;
    var haut = map && map.getZoom() >= 10;
    return { renderer: S.rendu && map ? S.rendu[map._leaflet_id] : undefined, interactive: false, pane: 'sx-uga',
      color: sel ? '#1A2030' : (approx ? '#4D86F0' : '#fff'), weight: sel ? 3 : (approx ? 1.6 : 1.5), dashArray: approx ? '5 5' : null,
      fillColor: k >= 0 ? P.APLATS[k].col : '#EAF1FF', fillOpacity: sel ? 0.34 : (haut ? 0.22 : 0.55) };
  }
  function dessinerUga() {
    var L = limiter(), map = S.map; if (!L || !map || S.mode !== 'secteur' || !S.sect) return;
    if (S.groupe) { try { map.removeLayer(S.groupe); } catch (e) {} }
    S.groupe = L.layerGroup().addTo(map); S.polys = {}; S.nbApprox = 0;
    var C = window.UGA_CONTOURS, D = S.A.donnees(), part = partParUga();
    S.sect.codes.forEach(function (code) {
      var ct = C && C[code], info = part[code], approx = false, latlngs, polys = null;
      if (ct && ct.p && ct.p.length) {
        polys = ct.p;
        latlngs = ct.p.map(function (poly) { return poly.map(function (ring) { return ring.map(function (q) { return [q[1], q[0]]; }); }); });
      } else if (info) {
        var pts = []; for (var i = 0; i < D.p.length; i++) if (D.p[i][2] === info.idx) pts.push([D.p[i][0], D.p[i][1]]);
        var env = P.enveloppe(pts, 3.2); if (env.length < 3) return;
        approx = true; S.nbApprox++; latlngs = [env]; polys = [[env.map(function (q) { return [q[1], q[0]]; })]];
      } else return;
      var layer = L.polygon(latlngs, styleUga(code, approx)).addTo(S.groupe);
      S.polys[code] = { layer: layer, polys: polys, approx: approx };
    });
    rendrePanneau();
  }
  function restyler() { Object.keys(S.polys).forEach(function (code) { var o = S.polys[code]; o.layer.setStyle(styleUga(code, o.approx)); if (S.ugaSel === code) o.layer.bringToFront(); }); }
  function dessinerTournees() {
    var L = limiter(), map = S.map; if (!L || !map) return;
    if (S.tracesLayer) { try { map.removeLayer(S.tracesLayer); } catch (e) {} S.tracesLayer = null; }
    if (S.mode !== 'secteur' || !S.tourOn || !S.prepT || !S.prepT.length) return;
    var g = L.layerGroup(), b = bornesSecteur();
    S.prepT.forEach(function (t) {
      if (b && (t.box[2] < b.getSouth() - 0.3 || t.box[0] > b.getNorth() + 0.3 || t.box[3] < b.getWest() - 0.3 || t.box[1] > b.getEast() + 0.3)) return;   // tournée sans rapport avec ce secteur
      L.polyline(t.pts, { renderer: S.rendu[map._leaflet_id], pane: 'sx-uga', interactive: false, color: '#1A2030', weight: 2.2, opacity: 0.55, dashArray: '7 6' }).addTo(g);
    });
    S.tracesLayer = g.addTo(map);
  }
  function bornesSecteur() {
    var L = limiter(), c = ctx(), pts = [];
    if (!S.ind) S.ind = P.indicesDuSecteur(S.sect, c);
    S.ind.forEach(function (i) { var p = c.pts[i]; if (isFinite(p[0]) && isFinite(p[1]) && (p[0] || p[1])) pts.push([p[0], p[1]]); });
    return pts.length ? L.latLngBounds(pts) : null;
  }
  function cadrerSecteur() {
    var map = S.A.carte(), b = bornesSecteur(); if (!map || !b) return;
    var pan = S.pan, w = pan && pan.offsetWidth || 0, h = pan && pan.offsetHeight || 0, tel = etroit();
    try {
      map.invalidateSize({ pan: false });
      map.fitBounds(b, { maxZoom: 10, animate: false,
        paddingTopLeft: tel ? [14, 14] : [w + 28, 18], paddingBottomRight: tel ? [14, Math.max(h, 120) + 14] : [18, 18] });
    } catch (e) {}
  }
  function majPanneauVisible() {
    if (!S.pan) return;
    var cache = S.ficheOuverte;
    S.pan.classList.toggle('sx-cache', !!cache);
    var host = document.querySelector('.cn-maparea'); if (host) { host.classList.toggle('sx-fiche', !!cache); }
  }
  // Clic sur la carte hors d'un point : l'UGA du secteur qui contient l'endroit devient le portrait affiché.
  function ugaClic(e) {
    if (S.mode !== 'secteur' || !e || !e.latlng || !S.sect) return;
    var oe = e.originalEvent;
    if (S.pointClic) return;
    if (oe && oe.target && oe.target.closest && oe.target.closest('.leaflet-marker-icon,.leaflet-control,.cn-fiche,.sx-pan,.cn-tourbar')) return;   // un paquet, une commande, la fiche, le panneau
    if (S.A.choixDepot()) return;
    var lat = e.latlng.lat, lon = e.latlng.lng, trouve = null;
    Object.keys(S.polys).forEach(function (code) { if (!trouve && P.dansContour(lat, lon, S.polys[code].polys)) trouve = code; });
    if (trouve) choisirUga(S.ugaSel === trouve ? null : trouve);
  }
  function choisirUga(code) {
    S.ugaSel = code;
    if (code && S.ficheOuverte && S.A.ficheIdx() != null) { try { V2.carteFicheClose(); } catch (e) {} }
    restyler(); rendrePanneau();
    if (code && S.pan) { var corps = S.pan.querySelector('.sx-corps'); if (corps) corps.scrollTop = 0; }
  }

  // ═══ Le panneau ═══
  function chiffre(v, l, s) { return '<div class="sx-chiffre"><b>' + v + '</b><span>' + l + '</span><em>' + s + '</em></div>'; }
  function stats() {
    if (S.stats) return S.stats;
    var c = ctx(); if (!S.ind) S.ind = P.indicesDuSecteur(S.sect, c);
    S.stats = P.mesurer(S.ind, S.nom, c);
    S.grpCli = P.clientesParGroupement(S.ind, S.nom, c);
    return S.stats;
  }
  function chiffreCa(R, qui) {
    var l = 'de chiffre d’affaires en ' + esc(moisDernier() || 'dernier mois');
    if (S.etat.detail === 'attente') return chiffre('…', l, 'lecture des ventes en cours');
    if (R.caLu) {
      var nl = R.ca.lues, sub = [];
      if (R.evolution !== null) sub.push((R.evolution >= 0 ? '+' : '−') + P.nombre(Math.abs(R.evolution), 1) + NB + '% sur ' + esc(moisAvant()));
      sub.push(nl + ' ' + pluriel(nl, 'cliente lue', 'clientes lues') + (R.ca.visibles > nl ? ' sur ' + R.ca.visibles : ''));
      return chiffre(P.nombre(R.ca.dernier) + '<small>' + NB + '€</small>', l, sub.join(' · '));
    }
    var why = S.etat.detail === 'absent' ? 'ventes non lues pour le moment' : (R.clientes && !R.ca.visibles ? 'réservé au commercial de ces clientes' : 'aucune vente lue');
    return chiffre('inconnu', l, why);
  }
  function chiffresHtml(R, qui, portrait) {
    var tour = S.etat.tournees === 'ok' ? P.nombre(R.prospects10) + ' à moins de 10' + NB + 'km d’une tournée' : (S.etat.tournees === 'attente' ? 'tournées en cours de lecture' : 'tournées non lues');
    if (portrait) {
      return '<div class="sx-chiffres">' +
        chiffre(P.nombre(R.officines), 'officines dans l’UGA', 'base nationale') +
        chiffre(R.partClientes == null ? '—' : P.nombre(R.partClientes, 1) + '<small>' + NB + '%</small>', 'sont clientes d’Intégral', R.clientes + ' ' + qui + (R.collegues ? ' · ' + R.collegues + ' chez un collègue' : '')) +
        chiffre(P.nombre(R.prospects), pluriel(R.prospects, 'prospect', 'prospects'), tour) + chiffreCa(R, qui) + '</div>';
    }
    return '<div class="sx-chiffres">' + chiffreCa(R, qui) +
      chiffre(P.nombre(R.clientes), pluriel(R.clientes, 'cliente ', 'clientes ') + qui, 'A ' + R.paliers.A + ' · B ' + R.paliers.B + ' · C ' + R.paliers.C + ' · ' + R.paliers.sans + ' sans palier') +
      chiffre(P.nombre(R.prospects), 'prospects dans les UGA du secteur', tour) +
      chiffre(R.partClientes == null ? '—' : P.nombre(R.partClientes, 1) + '<small>' + NB + '%</small>', 'des officines sont clientes', 'Intégral, toutes les équipes') + '</div>';
  }
  function groupementsHtml(g) {
    var l = P.lignesGroupements(g, 6);
    if (!l.lignes.length) return '<p class="sx-vide">Aucun groupement connu ici.</p>';
    return '<div class="sx-grp">' + l.lignes.map(function (x) {
      return '<div class="sx-gl"><b title="' + esc(x.nom) + '">' + esc(x.nom) + '</b><div class="sx-barre"><i style="width:' + x.barre + '%"></i></div><span>' + x.c + ' · ' + x.p + '</span></div>';
    }).join('') + '</div><span class="sx-src">Par groupement : clientes · prospects' + (l.autres ? ' · et ' + l.autres + ' autre' + (l.autres > 1 ? 's' : '') : '') + '</span>';
  }
  function sousLigne(p) {
    var id = p[13];
    var tit = V2.titulaireDe ? V2.titulaireDe(id, p[10]) : (p[10] || '');
    return V2.officineSous ? V2.officineSous(tit, p[7], p[8]) : [p[7], p[8]].filter(Boolean).join(' ');
  }
  function pistesHtml(indices) {
    if (S.etat.tournees === 'attente' || S.etat.infos === 'attente') return '<p class="sx-vide">Calcul des pistes…</p>';
    if (!S.grpCli) stats();
    var c = ctx(), l = P.pistes(indices, S.nom, c, S.grpCli, 5);
    var base = S.etat.tournees === 'ok' ? '' : '<p class="sx-vide">Le fichier des tournées n’est pas lu : les pistes ne tiennent compte que du groupement et de la reprise possible.</p>';
    if (!l.length) return base + '<p class="sx-vide">Aucune piste ne ressort pour l’instant : ni tournée proche, ni groupement déjà client, ni reprise possible.</p>';
    S.pistesAff = l.map(function (x) { return x.i; });
    return base + '<ol class="sx-pistes">' + l.map(function (x, k) {
      var p = c.pts[x.i];
      return '<li><button type="button" class="sx-piste" onclick="V2.carteSecteur.ouvrirPiste(' + k + ')"><span class="sx-num">' + (k + 1) + '</span><span><b>' + esc(p[6] || p[10] || 'Pharmacie') + '</b>' +
        '<small>' + esc(sousLigne(p)) + '</small><small class="sx-why">' + esc(x.raisons.slice(0, 2).map(function (r) { return r.court; }).join(' · ')) + '</small></span></button></li>';
    }).join('') + '</ol><span class="sx-src">Classées par ce qu’elles cumulent : sur une tournée, groupement déjà client, reprise possible.</span>';
  }
  function legendeHtml() {
    return '<div class="sx-leg" aria-label="Part des officines clientes d’Intégral dans l’UGA">' + P.APLATS.map(function (b) { return '<span><i style="background-color:' + b.col + '"></i>' + b.lib + '</span>'; }).join('') + '</div>';
  }
  function tournoiHtml() {
    if (S.etat.tournees === 'attente') return '<span class="sx-src">Tournées de livraison : lecture en cours…</span>';
    if (S.etat.tournees !== 'ok') return '<span class="sx-src">Tournées de livraison : fichier indisponible pour ce compte ou pour le moment.</span>';
    return '<button type="button" class="sx-tog" aria-pressed="' + S.tourOn + '" onclick="V2.carteSecteur.tournees()">' + (S.tourOn ? 'Masquer' : 'Afficher') + ' les tournées de livraison</button>';
  }
  function panneauSecteur() {
    var R = stats(), perso = S.nom === S.perso, qui = perso ? 'chez vous' : 'chez ' + esc(S.nom), nU = S.sect.codes.length;
    var m = moisDernier();
    return '<div class="sx-tete"><div><h2>' + (perso ? 'Mon secteur' : 'Secteur de ' + esc(S.nom)) + '</h2><p>' + nU + ' UGA · ' + P.nombre(R.officines) + ' officines</p></div>' +
      '<button type="button" class="sx-repl" aria-expanded="' + !S.replie + '" aria-label="' + (S.replie ? 'Déplier' : 'Replier') + ' le panneau" onclick="V2.carteSecteur.replier()">' + (S.replie ? '▾' : '▴') + '</button></div>' +
      '<div class="sx-corps">' +
        '<div>' + chiffresHtml(R, qui, false) +
          '<span class="sx-src">Chiffre d’affaires lu dans les ventes' + (m ? ' : ' + esc(m) + ' est le dernier mois, il peut ne pas être terminé' : '') + '. Officines : base nationale.</span></div>' +
        '<div><h3 class="sx-h">Part d’officines clientes par UGA</h3>' + legendeHtml() +
          '<span class="sx-src">Cliquez une UGA sur la carte pour son portrait.' + (S.nbApprox ? ' Pointillé : contour approché (' + S.nbApprox + ' UGA sans contour officiel).' : '') + '</span>' + tournoiHtml() + '</div>' +
        '<div><h3 class="sx-h">Groupements présents</h3>' + groupementsHtml(R.groupements) + '</div>' +
        '<div><h3 class="sx-h">Mes meilleures pistes</h3>' + pistesHtml(S.ind) + '</div>' +
      '</div>';
  }
  function panneauPortrait(code) {
    var c = ctx(), perso = S.nom === S.perso, qui = perso ? 'chez vous' : 'chez ' + esc(S.nom), part = partParUga()[code];
    var R = P.portraitUga(part ? part.idx : -1, S.nom, c), ct = window.UGA_CONTOURS && window.UGA_CONTOURS[code];
    var ville = (ct && ct.n) || R.villePrincipale;
    if (!S.grpCli) stats();
    return '<div class="sx-tete"><button type="button" class="sx-retour" onclick="V2.carteSecteur.retour()">‹ ' + (perso ? 'Mon secteur' : 'Secteur de ' + esc(S.nom)) + '</button></div>' +
      '<div class="sx-corps"><div><h2 class="sx-h2">UGA ' + esc(code) + '</h2>' + (ville ? '<p class="sx-sous">Autour de ' + esc(ville) + '</p>' : '') + '</div>' +
        '<div>' + chiffresHtml(R, qui, true) + '</div>' +
        '<div><h3 class="sx-h">Groupements dans l’UGA</h3>' + groupementsHtml(R.groupements) + '</div>' +
        '<div><h3 class="sx-h">Pistes de l’UGA</h3>' + pistesHtml(R.indices) + '</div></div>';
  }
  function rendrePanneau() {
    if (!S.pan || S.mode !== 'secteur' || !S.sect) return;
    var haut = 0, corps = S.pan.querySelector('.sx-corps'); if (corps) haut = corps.scrollTop;
    S.pan.innerHTML = S.ugaSel && partParUga()[S.ugaSel] ? panneauPortrait(S.ugaSel) : panneauSecteur();
    S.pan.setAttribute('data-etat', S.replie && !S.ugaSel ? 'replie' : 'ouvert');
    var c2 = S.pan.querySelector('.sx-corps'); if (c2 && haut) c2.scrollTop = haut;
    var host = document.querySelector('.cn-maparea');
    if (host) host.setAttribute('data-sx', S.replie && !S.ugaSel ? 'replie' : 'ouvert');
    if (host) host.style.setProperty('--sx-h', (S.replie && !S.ugaSel ? S.pan.offsetHeight : Math.min(S.pan.offsetHeight, host.clientHeight * 0.46)) + 'px');
  }

  // ═══ Étude de zone ═══
  // L'index (id officine → FINESS) est un fichier protégé chargé une fois, au premier affichage d'une fiche. Absent : aucun bouton, aucune erreur.
  function etudeIndex(cb) {
    if (window.ETUDES_ZONE_IDX || (S.idxEssai && !S.idxAttente)) { cb(); return; }
    if (S.idxAttente) { S.idxAttente.push(cb); return; }   // lecture en cours : chacun sera servi à l'arrivée
    S.idxEssai = true; S.idxAttente = [cb];
    var fin = function () { var l = S.idxAttente || []; S.idxAttente = null; l.forEach(function (f) { try { f(); } catch (e) { /* un bouton manqué n'arrête pas les autres */ } }); };
    if (!V2.chargerScriptProtege) { fin(); return; }
    try { V2.chargerScriptProtege('etudes-zone-index.js', fin); } catch (e) { fin(); }
  }
  function lien(href, cb) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = function () { cb(true); }; l.onerror = function () { cb(false); }; document.head.appendChild(l); }
  function script(src, cb) { var s = document.createElement('script'); s.src = src; s.onload = function () { cb(true); }; s.onerror = function () { cb(false); }; document.head.appendChild(s); }
  function chargerCssEtude(cb) {
    if (document.getElementById('sx-etude-css')) { cb(); return; }
    var l = document.createElement('link'); l.id = 'sx-etude-css'; l.rel = 'stylesheet'; l.href = 'v2-carte-etude.css' + S.A.CB;
    l.onload = function () { cb(); }; l.onerror = function () { cb(); };   // sans la feuille de style l'étude s'affiche, moins belle : jamais bloquée
    document.head.appendChild(l);
  }
  function chargerPur(cb) {
    if (window.PHIRST_ETUDE_PUR) { cb(true); return; }
    script('../../phirst/v2/phirst-etude-pur.js' + S.A.CB, function (ok) { cb(ok && !!window.PHIRST_ETUDE_PUR); });
  }
  function chargerEtude(finess, cb) {
    var lire = function () { return (window.ETUDES_ZONE && window.ETUDES_ZONE[finess]) || null; };
    if (lire()) { cb(lire()); return; }
    try { V2.chargerScriptProtege('etudes-zone/' + finess + '.js', function () { cb(lire()); }); } catch (e) { cb(null); }
  }
  function monterPE() {
    var pe = document.getElementById('pe'); if (pe) return pe;
    pe = document.createElement('div'); pe.id = 'pe'; pe.hidden = true; pe.setAttribute('role', 'dialog'); pe.setAttribute('aria-modal', 'true'); pe.setAttribute('aria-label', 'Étude de zone'); pe.setAttribute('tabindex', '-1');
    pe.innerHTML = '<div class="pe-barre"><button type="button" data-pe-retour>‹ Retour</button><span class="pe-nom" data-pe-nom></span><button type="button" class="pe-plein" data-pe-imprimer hidden>Imprimer</button></div><div class="pe-corps" data-pe-corps></div>';
    document.body.appendChild(pe);   // posé sur <body> : un élément fixé dans l'écran serait piégé par la transform de #v2-root
    pe.addEventListener('click', function (ev) { var t = ev.target; if (t.closest('[data-pe-retour]')) return fermerEtude(); if (t.closest('[data-pe-imprimer]')) return window.print(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && S.pe.ouverte) { ev.stopImmediatePropagation(); fermerEtude(); } }, true);
    window.addEventListener('beforeprint', function () { if (S.pe.ouverte && S.pe.carte) S.pe.carte.cadrer(); });
    window.addEventListener('afterprint', function () { if (S.pe.ouverte && S.pe.carte) S.pe.carte.cadrer(); });
    return pe;
  }
  function corpsPE() { return document.querySelector('#pe [data-pe-corps]'); }
  function direPE(html) { var c = corpsPE(); if (c) c.innerHTML = '<div class="pe-etat" role="status">' + html + '</div>'; var b = document.querySelector('#pe [data-pe-imprimer]'); if (b) b.hidden = true; }
  function demonterCarteEtude() { if (S.pe.carte) { try { S.pe.carte.map.remove(); } catch (e) { /* déjà démontée */ } S.pe.carte = null; } }
  function fermerEtude() {
    var pe = document.getElementById('pe'); if (!pe || !S.pe.ouverte) return;
    S.pe.jeton++; S.pe.ouverte = false; demonterCarteEtude(); pe.hidden = true; document.body.classList.remove('pe-ouvert');
    var c = corpsPE(); if (c) c.innerHTML = '';
    var d = S.pe.dernier; if (d && document.contains(d) && d.focus) { try { d.focus({ preventScroll: true }); } catch (e) { /* rien à refocaliser */ } }
  }
  function ouvrirEtude(i) {
    var A = S.A, D = A && A.donnees(), p = D && D.p[i]; if (!p) return;
    var id = String(p[13] == null ? '' : p[13]), finess = window.ETUDES_ZONE_IDX && window.ETUDES_ZONE_IDX[id];
    var pe = monterPE(), tok = ++S.pe.jeton;
    S.pe.ouverte = true; S.pe.dernier = document.activeElement;
    document.querySelector('#pe [data-pe-nom]').textContent = p[6] || 'Pharmacie';
    pe.hidden = false; document.body.classList.add('pe-ouvert'); pe.scrollTop = 0;
    try { pe.focus({ preventScroll: true }); } catch (e) { pe.focus(); }
    direPE('<p>L’étude de zone arrive…</p>');
    if (!/^\d{9}$/.test(String(finess || ''))) { direPE('<p>Étude pas encore calculée pour cette officine.</p>'); return; }
    var attente = 3, res = {};
    function pret() {
      if (--attente > 0) return;
      if (tok !== S.pe.jeton || !S.pe.ouverte) return;
      if (!res.pur) { direPE('<p>Le modèle d’étude n’a pas pu être chargé. Vérifiez votre connexion puis réessayez.</p>'); return; }
      if (!res.etude) { direPE('<p>Étude pas encore calculée pour cette officine.</p>'); return; }
      // La lecture des ventes et des tournées peut encore traîner : l'étude s'affiche avec ce qui est là, et le dit.
      var html;
      try { html = assembler(res.etude, i); } catch (e) { direPE('<p>Cette étude est incomplète : elle ne peut pas s’afficher.</p>'); return; }
      corpsPE().innerHTML = html.html;
      var b = document.querySelector('#pe [data-pe-imprimer]'); if (b) b.hidden = false;
      try { monterCarteEtude(res.etude, html.r); } catch (e) { var c = document.getElementById('pe-carte'); if (c) c.innerHTML = '<p class="pe-etat">La carte n’a pas pu s’afficher. Le reste de l’étude est complet.</p>'; }
    }
    chargerCssEtude(function () { pret(); });
    chargerPur(function (ok) { res.pur = ok; pret(); });
    chargerEtude(finess, function (E) {
      res.etude = E;
      // tournées et ventes : lues avec l'étude (déjà chargées par le panneau dans la plupart des cas)
      var reste = 2, fin = function () { if (--reste === 0) pret(); };
      charger('tournees', 'TOURNEES_ECRAN', 'tournees', function () { S.prepT = window.TOURNEES_ECRAN ? P.preparerTournees(window.TOURNEES_ECRAN) : S.prepT; });
      var tt = Date.now(), iv = setInterval(function () { if (S.etat.tournees !== 'attente' || Date.now() - tt > 8000) { clearInterval(iv); fin(); } }, 120);
      if (A.detailPret()) fin(); else A.detail(function () { S.etat.detail = A.detailPret() ? 'ok' : 'absent'; fin(); });
    });
  }

  // Toutes nos clientes (toutes équipes) avec leur position ; le chiffre d'affaires seulement quand ce compte a le droit de le voir.
  function clientesLisibles() {
    var A = S.A, D = A.donnees(), out = [];
    D.p.forEach(function (p) {
      if (!A.isClient(p) || !isFinite(p[0]) || !isFinite(p[1]) || (!p[0] && !p[1])) return;
      var m = A.voitCa(p) ? caMois(p) : null, mm = /^Client ([ABC])$/.exec(A.segOf(p));
      out.push({ id: p[13], lat: p[0], lng: p[1], nom: p[6] || p[10] || 'Pharmacie', ville: p[7] || '', cp: p[8] || '', tit: p[10] || '', palier: mm ? mm[1] : '', ca: m ? m.d : null, grp: (D.grp[p[3]] && D.grp[p[3]] !== '—') ? D.grp[p[3]] : '' });
    });
    return out;
  }
  function eur(n) { return n === null || n === undefined ? 'inconnu' : P.nombre(n) + NB + '€'; }
  function pied(n, t) { return '<div class="pe-pied"><span>JARVIS · Intégral Pharma</span><span>' + n + ' / ' + t + '</span></div>'; }

  // Les trois feuilles de Phirst + « Chez Intégral » (ce que JARVIS ajoute) : même code de rendu que Phirst, jamais copié.
  function assembler(Dz, i) {
    var E = window.PHIRST_ETUDE_PUR, A = S.A, D = A.donnees(), p = D.p[i], c = ctx(), id = String(p[13]);
    var cli = A.isClient(p), z = P.clientesDansZones(Dz, clientesLisibles(), id), m = moisDernier(), pz = Dz.pharmacie || {};
    var tn = (S.prepT && typeof pz.lat === 'number') ? P.plusProcheTournee(pz.lat, pz.lon, S.prepT) : kmTournee(p);
    var grpNom = (D.grp[p[3]] && D.grp[p[3]] !== '—') ? D.grp[p[3]] : '';
    var grpTous = 0; if (grpNom) D.p.forEach(function (q) { if (A.isClient(q) && D.grp[q[3]] === grpNom) grpTous++; });
    var voit = A.voitCa(p), plus = E.plur;
    var lecturePartielle = [S.etat.tournees === 'ok' ? '' : 'le fichier des tournées n’est pas lu', S.etat.detail === 'ok' ? '' : 'les ventes ne sont pas lues'].filter(Boolean);

    var band = '<div class="pe-cles" style="margin-top:0;border-top:0">' +
      '<div class="pe-cle"><div class="pe-v">' + z.nb[15] + '</div><div class="pe-l">' + plus(z.nb[15], 'cliente', 'clientes', 'cliente') + ' d’Intégral à moins de 15 minutes</div><span class="pe-src">Clientes de toutes les équipes</span></div>' +
      '<div class="pe-cle"><div class="pe-v">' + (tn ? P.nombre(tn.km, 1) + '<small style="font-size:22px;letter-spacing:0"> km</small>' : '—') + '</div><div class="pe-l">' + (tn ? 'de la tournée de livraison ' + esc(tn.code) : 'tournée de livraison : fichier non lu') + '</div><span class="pe-src">Distance à vol d’oiseau au tracé</span></div>' +
      '<div class="pe-cle"><div class="pe-v">' + (grpNom ? grpTous : '—') + '</div><div class="pe-l">' + (grpNom ? 'clientes d’Intégral dans son groupement (' + esc(grpNom) + ')' : 'groupement inconnu pour cette officine') + '</div><span class="pe-src">Toutes les équipes</span></div></div>';
    var f1 = E.feuille1(Dz).replace('<div class="pe-pied">', band + '<div class="pe-pied">');

    // A · pourquoi l'appeler (prospect) ou ce que l'on sait (cliente)
    var h = '<div class="pe-chap"><div class="pe-chap-t"><span class="pe-chap-n">A</span><h2>' + (cli ? 'Cette officine est notre cliente' : 'Pourquoi l’appeler') + '</h2></div>';
    if (cli) {
      var det = voit ? A.detailPret() && A.detailPret()[p[13]] : null, seg = A.segOf(p), mc = voit ? caMois(p) : null;
      if (!voit) h += '<p>Chiffres de vente réservés au commercial de cette officine.</p>';
      else {
        h += '<p class="pe-phrase">' + (/^Client [ABC]$/.test(seg) ? 'Palier <strong>' + seg.slice(-1) + '</strong>' : 'Palier <strong>à lire</strong>') +
          (mc ? ' · <strong>' + eur(mc.d) + '</strong> en ' + esc(m) : ' · chiffre d’affaires non lu pour cette cliente') + '.</p>';
        if (det && Array.isArray(det.m) && det.m.length) {
          var mx = Math.max.apply(null, det.m.concat([1])), lb = A.moisLbls();
          h += '<div class="pe-barres" style="grid-auto-flow:column;grid-template-columns:none;grid-auto-columns:minmax(0,1fr)">' + det.m.map(function (v, k) { return '<div style="height:' + Math.max(3, v / mx * 100).toFixed(1) + '%" title="' + esc(lb[k] || '') + '"><b>' + P.nombre(v) + '</b></div>'; }).join('') + '</div>' +
            '<div class="pe-annees">' + det.m.map(function (v, k) { return '<span>' + esc((lb[k] || '').split(' ')[0]) + '</span>'; }).join('') + '</div>' +
            '<span class="pe-src">Chiffre d’affaires par mois (€), ventes du réseau Intégral</span>';
        }
      }
    } else {
      var gcl = {};   // groupements qui ont déjà des clientes chez le commercial regardé (son secteur) ; à défaut, chez Intégral
      if (S.sect && S.sect.codes.length) { stats(); gcl = S.grpCli || {}; } else D.p.forEach(function (q) { var g = D.grp[q[3]]; if (A.isClient(q) && g && g !== '—') gcl[g] = (gcl[g] || 0) + 1; });
      var rs = P.raisonsDe(p, c, gcl);
      var li = rs.map(function (r) { return r.t; });
      if (z.nb[10] > 0) li.push(z.nb[10] + ' ' + plus(z.nb[10], 'cliente', 'clientes') + ' à moins de 10 minutes : une référence locale à citer.');
      h += li.length ? '<ul class="pe-pourquoi">' + li.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '<p>Aucun signal particulier relevé pour cette officine.</p>';
      h += '<span class="pe-src">Tournées de livraison · groupements de la base nationale · âge du titulaire : Annuaire des entreprises (repère, pas une certitude)</span>';
    }
    h += '</div>';
    // B · nos clientes autour
    var vis = z.liste.filter(function (x) { return x.c.ca !== null; }).length;
    var lig = z.liste.slice(0, 7).map(function (x) {
      return '<tr><td><span class="pe-pal">' + (x.c.palier || '?') + '</span>' + esc(E.joli(x.c.nom)) + '<br><span class="pe-src">' + esc(V2.officineSous ? V2.officineSous(V2.titulaireDe ? V2.titulaireDe(x.c.id, x.c.tit) : x.c.tit, E.joli(x.c.ville), x.c.cp) : E.joli(x.c.ville)) + '</span></td><td>' + (x.km == null ? '—' : P.nombre(x.km, 1) + NB + 'km') + ' · ' + x.zone + ' min</td><td>' + eur(x.c.ca) + '</td></tr>';
    }).join('');
    h += '<div class="pe-chap"><div class="pe-chap-t"><span class="pe-chap-n">B</span><h2>Nos clientes autour</h2></div>' +
      '<div class="pe-grille"><div class="pe-lg pe-tete"><div class="pe-lib"></div><div class="pe-val">À 5 min</div><div class="pe-val">À 10 min</div><div class="pe-val">À 15 min</div></div>' +
      '<div class="pe-lg"><div class="pe-lib">Clientes d’Intégral<span class="pe-src">Comptées dans les contours des zones</span></div>' + [5, 10, 15].map(function (k) { return '<div class="pe-val">' + z.nb[k] + '</div>'; }).join('') + '</div>' +
      '<div class="pe-lg"><div class="pe-lib">Chiffre d’affaires du mois, cumulé<span class="pe-src">' + esc(m || 'dernier mois lu') + ' · seulement les clientes dont vous voyez les ventes' + (z.liste.length && vis < z.liste.length ? ' (' + (z.liste.length - vis) + ' non ' + plus(z.liste.length - vis, 'lue', 'lues') + ' ou réservées)' : '') + '</span></div>' +
        [5, 10, 15].map(function (k) { return '<div class="pe-val">' + (z.ca[k] === null ? '—' : P.nombre(z.ca[k]) + NB + '€') + '</div>'; }).join('') + '</div></div>' +
      (lig ? '<table class="pe-extra-tab"><tr><th>Les plus proches</th><th>Distance</th><th>CA ' + esc((m || '').split(' ')[0]) + '</th></tr>' + lig + '</table>' + (z.liste.length > 7 ? '<p class="pe-apres">et ' + (z.liste.length - 7) + ' ' + plus(z.liste.length - 7, 'autre cliente', 'autres clientes') + '.</p>' : '') : '<p class="pe-apres">Aucune cliente d’Intégral dans ces zones.</p>') +
      '<span class="pe-src">Distance à vol d’oiseau · zones calculées par l’étude (IGN)</span></div>';
    // C · groupement et tournée
    h += '<div class="pe-chap"><div class="pe-chap-t"><span class="pe-chap-n">C</span><h2>Le groupement et la tournée</h2></div>';
    h += grpNom ? '<p class="pe-phrase"><strong>' + esc(grpNom) + '</strong> : ' + grpTous + ' ' + plus(grpTous, 'cliente', 'clientes') + ' chez Intégral, toutes équipes.</p>' : '<p>Le groupement de cette officine n’est pas connu dans les fichiers.</p>';
    if (tn) {
      var jr = (tn.jours && tn.jours.length) ? ' (livraisons : ' + esc(tn.jours.join(', ')) + ')' : '';
      h += '<p>La tournée <b>' + esc(tn.code) + '</b>' + jr + ' passe à ' + P.nombre(tn.km, 1) + NB + 'km de cette officine.</p>';
    } else h += '<p>Tournée de livraison : ' + (S.etat.tournees === 'ok' ? 'aucune ne passe à proximité.' : 'le fichier des tournées n’est pas lu pour le moment.') + '</p>';
    h += '<span class="pe-src">Tracé en ligne droite entre les arrêts, pas la route</span></div>';
    // D · limites
    var lim = ['Le suivi de cette officine (déjà vue, rendez-vous, « ne pas y retourner ») se lit dans sa fiche.'];
    if (!cli) lim.push('Une cession ou un transfert annoncé : aucun fichier n’en parle. Seul existe le repère « titulaire de 62 ans ou plus et seul à la direction ».');
    lim.push('Le chiffre d’affaires d’une officine qui n’est pas notre cliente : JARVIS ne le connaît pas.');
    if (lecturePartielle.length) lim.push('Cette étude s’affiche alors que ' + lecturePartielle.join(' et ') + ' : les lignes concernées sont vides ou marquées « inconnu ».');
    h += '<div class="pe-chap"><div class="pe-chap-t"><span class="pe-chap-n">D</span><h2>Ce que JARVIS ne sait pas ici</h2></div><ul class="pe-nsp">' + lim.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    var f4 = '<section class="pe-feuille" aria-label="Chez Intégral"><div class="pe-entete"><span><b>Chez Intégral</b> · ce que JARVIS ajoute</span><span>Étude du ' + esc(Dz.calcule_le || '') + '</span></div>' + h + pied('x', 'y') + '</section>';
    var f2 = E.feuille2(Dz, null, false), f3 = E.feuille3(Dz), tout = [f1, f4, f2, f3];
    tout = tout.map(function (s, k) { return s.replace(/<div class="pe-pied">.*?<\/div>/, pied(k + 1, tout.length)); });
    var html = tout.join('').replace(/rgba\(18,165,103/g, 'rgba(0,80,230').replace(/#1A3A2E/g, '#0034A0').replace(/#2F8A5B/g, '#0050E6').replace(/#5FA37E/g, '#4D86F0').replace(/#7DB898/g, '#4D86F0');
    return { html: html, r: z };
  }

  // La carte de la couverture : les trois zones, les autres pharmacies, nos clientes, les tournées.
  var IGN = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
  var COUL = { 5: { trait: '#0034A0', op: 0.26 }, 10: { trait: '#0050E6', op: 0.14 }, 15: { trait: '#4D86F0', op: 0.07 } };
  function monterCarteEtude(Dz, z) {
    var el = document.getElementById('pe-carte'), L = window.L, E = window.PHIRST_ETUDE_PUR; if (!el || !L) return;
    var Pz = Dz.pharmacie || {}, Z = Dz.zones || {}, contours = {};
    [15, 10, 5].forEach(function (k) { var zz = Z[k] || Z[String(k)]; if (zz && zz.contour && zz.contour.length > 2) contours[k] = zz.contour; });
    var tactile = !!(L.Browser && L.Browser.mobile);
    var m = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, zoomSnap: 0.25, dragging: !tactile, touchZoom: !tactile, doubleClickZoom: !tactile, boxZoom: false, keyboard: false });
    L.tileLayer(IGN, { maxZoom: 18, opacity: 0.55 }).addTo(m);
    var couches = {};
    [15, 10, 5].forEach(function (k) {
      if (!contours[k]) return;
      couches[k] = L.polygon(contours[k].map(function (q) { return [q[1], q[0]]; }), { color: COUL[k].trait, weight: k === 5 ? 2.2 : 1.6, fillColor: '#0050E6', fillOpacity: COUL[k].op, opacity: 1, interactive: false }).addTo(m);
    });
    if (S.prepT) S.prepT.forEach(function (t) { L.polyline(t.pts, { color: '#1A2030', weight: 2.2, opacity: 0.55, dashArray: '7 6', interactive: false }).addTo(m); });
    (Dz.pharmacies || []).forEach(function (q) {
      if (q.est_etudiee || typeof q.lat !== 'number' || typeof q.lon !== 'number') return;
      L.circleMarker([q.lat, q.lon], { radius: 4.5, weight: 1.5, color: '#1A2030', fillColor: '#FFFFFF', fillOpacity: 1, interactive: false }).addTo(m);
    });
    z.liste.forEach(function (x) {
      L.circleMarker([x.c.lat, x.c.lng], { radius: 9, weight: 3, color: '#0050E6', fill: false, interactive: false }).addTo(m);
      L.circleMarker([x.c.lat, x.c.lng], { radius: 5, weight: 2, color: '#fff', fillColor: '#0034A0', fillOpacity: 1, interactive: false }).addTo(m);
    });
    var cadre = couches[15] || couches[10] || couches[5], ici = null;
    if (typeof Pz.lat === 'number' && typeof Pz.lon === 'number') {
      ici = L.marker([Pz.lat, Pz.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'pe-ici', html: '<span class="pe-ici-point"></span><span class="pe-ici-nom">' + E.esc(Pz.nom || 'Pharmacie') + '</span>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(m);
      if (!cadre) m.setView([Pz.lat, Pz.lon], 13);
    }
    function placerNom() {
      var e = ici && ici.getElement(), nom = e && e.querySelector('.pe-ici-nom'); if (!nom) return;
      nom.classList.remove('pe-ici-g', 'pe-ici-2l'); nom.style.width = '';
      var q = E.placeNom(m.latLngToContainerPoint(ici.getLatLng()).x, m.getSize().x, nom.offsetWidth);
      if (q.cote === 'g') nom.classList.add('pe-ici-g');
      if (q.max) { nom.classList.add('pe-ici-2l'); nom.style.width = q.max + 'px'; }
    }
    function cadrer() { m.invalidateSize(false); if (cadre) m.fitBounds(cadre.getBounds(), { padding: [18, 18], animate: false }); placerNom(); }
    m.on('moveend resize', placerNom); cadrer();
    var lg = document.querySelector('#pe .pe-legende');
    if (lg) lg.insertAdjacentHTML('beforeend', '<span><i style="background:#0034A0;border-radius:50%;box-shadow:0 0 0 2px #fff,0 0 0 4px #0050E6"></i>Nos clientes</span>' + (S.prepT && S.prepT.length ? '<span><i style="background:none;border-top:2px dashed #1A2030;border-radius:0;height:0;vertical-align:4px"></i>Tournées de livraison</span>' : ''));
    S.pe.carte = { map: m, cadrer: cadrer };
  }

  // ═══ Feuille de style du panneau (injectée, comme celle de La carte) ═══
  function injectCss() {
    if (document.getElementById('sx-css')) return;
    var s = document.createElement('style'); s.id = 'sx-css';
    s.textContent = [
      '.cn-fbrow{row-gap:8px}',
      '.sx-mode button{min-height:44px;padding:6px 16px;font-size:14px}',
      '.sx-qui{white-space:nowrap}',
      // un <select> garde sa hauteur native sous WebKit tant que son apparence n'est pas retirée : même recette que les autres sélecteurs de l'app (v2.css)
      "html .cn-fb select.sx-sel{-webkit-appearance:none;appearance:none;height:44px;min-height:44px;max-width:210px;padding:0 34px 0 12px;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%235B6478' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 12px center;background-size:12px 8px}",
      // panneau : à gauche sur ordinateur, éclairé par le haut comme la fiche de La carte
      '.sx-pan{position:absolute;z-index:640;left:12px;top:12px;width:clamp(340px,30vw,408px);max-height:calc(100% - 24px);display:flex;flex-direction:column;min-height:0;overflow:hidden;border-radius:20px;background-color:#fff;background-image:radial-gradient(120% 55% at 0 0,#EEF4FF 0,#fff 62%);border:1px solid #E1E8F5;box-shadow:inset 0 1px 0 #fff,0 26px 50px -28px rgba(10,40,120,.55),0 2px 8px rgba(26,32,48,.07)}',
      '.sx-pan.sx-cache{display:none}',
      '.sx-tete{display:flex;align-items:flex-start;gap:12px;padding:16px 14px 8px 20px}',
      '.sx-tete>div{flex:1;min-width:0}',
      '.sx-tete h2{margin:0;font:800 23px/1.14 var(--font,system-ui);letter-spacing:-.025em;color:var(--ip-ink,#1A2030)}',
      '.sx-tete p{margin:4px 0 0;font-size:15px;line-height:1.35;color:#3A4459;font-weight:500}',
      '.sx-repl{flex:none;width:44px;height:44px;border:1px solid #E1E8F5;border-radius:14px;background:#fff;color:#0050E6;font-size:22px;line-height:1;cursor:pointer}',
      '.sx-retour{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px 0 10px;border:1px solid #E1E8F5;border-radius:14px;background:#fff;font:700 14.5px/1 var(--font,system-ui);color:#0050E6;cursor:pointer}',
      '.sx-corps{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:grid;gap:18px;align-content:start;padding:6px 20px 20px}',
      '.sx-h2{margin:0;font:800 23px/1.14 var(--font,system-ui);letter-spacing:-.025em;color:var(--ip-ink,#1A2030)}',
      '.sx-sous{margin:4px 0 0;font-size:15px;color:#3A4459;font-weight:500}',
      '.sx-chiffres{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.sx-chiffre{min-width:0;padding:12px 14px 10px;border-radius:16px;border:1px solid #E1E8F5;background-color:#fff;background-image:radial-gradient(120% 90% at 0 0,#EEF4FF 0,#fff 65%);box-shadow:0 12px 24px -20px rgba(0,50,160,.5)}',
      '.sx-chiffre b{display:block;font:800 27px/1.05 var(--font,system-ui);letter-spacing:-.04em;color:#0050E6;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
      '.sx-chiffre b small{font-size:15px;letter-spacing:0;font-weight:700}',
      '.sx-chiffre span{display:block;font-size:14px;line-height:1.3;color:#3A4459;margin-top:4px}',
      '.sx-chiffre em{display:block;font-style:normal;font-size:13px;line-height:1.3;color:#5B667D;margin-top:3px}',
      '.sx-h{margin:0 0 8px;font:800 13px/1.2 var(--font,system-ui);letter-spacing:.07em;text-transform:uppercase;color:#5B667D}',
      '.sx-grp{display:grid;gap:7px}',
      '.sx-gl{display:grid;grid-template-columns:minmax(0,118px) minmax(0,1fr) auto;gap:10px;align-items:center;min-height:30px;font-size:14.5px}',
      '.sx-gl b{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ip-ink,#1A2030)}',
      '.sx-barre{position:relative;height:10px;border-radius:6px;background-color:#E8EEFA;overflow:hidden}',
      '.sx-barre i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background-image:linear-gradient(90deg,#0050E6,#4D86F0);background-color:#0050E6}',
      '.sx-gl span{font-size:13.5px;color:#3A4459;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.sx-pistes{list-style:none;margin:0;padding:0;display:grid;gap:8px}',
      '.sx-piste{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:start;width:100%;min-height:44px;padding:9px 12px 9px 10px;text-align:left;border:1px solid #E1E8F5;border-radius:14px;background-color:#fff;font:inherit;cursor:pointer;color:var(--ip-ink,#1A2030)}',
      '.sx-piste:hover{background-color:#F4F7FD;border-color:#BDD0F8}',
      '.sx-piste:focus-visible,.sx-retour:focus-visible,.sx-repl:focus-visible,.sx-tog:focus-visible{outline:2px solid #0050E6;outline-offset:2px}',
      '.sx-num{width:28px;height:28px;border-radius:50%;background:#0050E6;color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center}',
      '.sx-piste b{display:block;font-size:15.5px;line-height:1.25;overflow-wrap:anywhere}',
      '.sx-piste small{display:block;font-size:13.5px;line-height:1.35;color:#5B667D;margin-top:2px;overflow-wrap:anywhere}',
      '.sx-piste small.sx-why{color:#0034A0;font-weight:600}',
      '.sx-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:#3A4459}',
      '.sx-leg span{display:inline-flex;align-items:center;gap:6px}',
      '.sx-leg i{width:16px;height:12px;border-radius:4px;border:1px solid rgba(26,32,48,.18)}',
      '.sx-src{display:block;margin-top:6px;font-size:13px;line-height:1.35;color:#5B667D}',
      '.sx-vide{margin:0;font-size:14px;line-height:1.4;color:#5B667D}',
      '.sx-tog{margin-top:8px;min-height:44px;padding:0 14px;border:1px solid #E1E8F5;border-radius:12px;background:#fff;font:700 13.5px/1 var(--font,system-ui);color:#0050E6;cursor:pointer}',
      '.sx-tog[aria-pressed="true"]{background:#EAF1FF;border-color:#BDD0F8}',
      '.sx-pan[data-etat="replie"] .sx-corps{display:none}',
      // « Étude de zone » est l'action principale de la fiche : « Ajouter à ma tournée » passe en second (comme la maquette)
      '.cn-pacts .sx-etude-btn~.v2-btn-primary{background:var(--card,#fff);color:var(--ip-blue,#0057FF);border:1px solid var(--line-strong,rgba(16,19,28,.12));box-shadow:none;background-image:none}',
      // la fiche se pose à GAUCHE, à la place du panneau ; la bascule de zoom passe à droite (setPosition) ; la légende des points se décale
      '@media(min-width:761px){.sx-on.sx-fiche .cn-fiche{left:12px;right:auto}}',
      '.sx-on .cn-tourbar:not(.on){visibility:hidden}',   // caché hors écran par sa position : relevée, elle apparaîtrait
      '.sx-on .cn-legend{left:calc(clamp(340px,30vw,408px) + 24px);max-width:min(360px,calc(50% - clamp(340px,30vw,408px)))}',
      '.sx-on.sx-fiche .cn-legend{left:12px}',
      '@media(max-width:760px){',
        '.sx-mode{order:-1;flex:1 1 100%}.sx-mode button{flex:1;min-height:44px;font-size:13.5px}',
        'html .cn-fb select.sx-sel{font-size:16px;max-width:100%}',
        '.sx-pan{left:0;right:0;bottom:0;top:auto;width:100%;max-height:46%;border-radius:18px 18px 0 0;border-bottom:0}',
        '.sx-tete{padding:12px 10px 6px 16px}.sx-tete h2{font-size:19px}.sx-tete p{font-size:14px;margin-top:2px}',
        '.sx-corps{padding:6px 14px 18px}',
        '.sx-chiffre b{font-size:24px}',
        '.sx-on:not(.sx-fiche) .cn-legend{display:none}',   // la légende des points reprend sa place quand le panneau est replié ou remplacé par la fiche
        '.sx-on[data-sx="replie"] .cn-legend{display:flex;left:8px;bottom:calc(var(--sx-h,60px) + 8px)}',
        '.sx-on:not(.sx-fiche) .cn-tourbar{bottom:calc(var(--sx-h,46%) + 12px)}',
        '.sx-on .leaflet-bottom{z-index:630}',
      '}',
      '@media(prefers-reduced-motion:reduce){.sx-pan,.sx-piste{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
