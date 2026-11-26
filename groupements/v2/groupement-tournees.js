/* ════════════════════════════════════════════════════════════════
   Carte « Nos tournées et les adhérentes » d'une app de groupement (option B, étape 8b, 26/11/2026).
   Demande de Will (26/11/2026), mot pour mot : « il faut un mapping groupement aussi avec nos tournée de livraison actuelle et le
   positionnement des adhérents pour pouvoir faire des predictions » ; « comme on a sur jarvis actuellement sur la T10 ».
   Commune aux apps de groupement ; activée seulement si le réglage (groupements/config/<id>.js) porte un bloc `tournees`.

   - MODÈLE : le bloc T10 de JARVIS (crm/v2/v2-tournees-essentiels.js, maquettes v1 « Carte » + « Étiquettes » choisies le 24/11) :
     carte, bascule « Aujourd'hui / En quotidien », numéros (E1… chez Essentiels), liste, détour, tournée la plus proche.
     Il est GÉNÉRALISÉ ici à TOUTES les tournées du fichier et aux adhérentes du périmètre de l'app (V2.pharmacies après
     V2.appliquerPerimetreGroupement). Ses calculs purs sont RÉUTILISÉS, pas recopiés : distKm, numeroter, court, joli, SEUIL_LOIN
     (V2.tourneesEssentiels, chargé par l'index.html de l'app AVANT ce fichier).
   - CHOIX CLIQUÉS DE WILL (26/11/2026) : prévision = la tournée qui la livrerait + le détour en km, rien d'autre (ni chiffre attendu,
     ni rentabilité, ni classement des tournées) ; les deux apps d'un coup ; une adhérente à plus de SEUIL_LOIN km de toute tournée
     n'est PAS retirée (« à voir si possible sur d'autres tournées ou si on a d'autres clients au national à côté ») : la carte dit
     la tournée la plus proche et sa distance, les établissements du groupe dont les tournées ne sont pas encore reçues, et les
     clientes Intégral Pharma les plus proches (WML_OFFICINES, tout le national).
   - DÉTOUR : celui du fichier quand l'officine y figure parmi les prospects d'une tournée (calculé hors dépôt) ; sinon le même calcul
     ici (C.detourInsertion : 1,3 × l'écart d'insertion à vol d'oiseau entre deux points de passage, dépôt compris). Toujours « estimé ».
   - QUI VOIT : tout compte admis dans l'app SAUF le rôle `opso` (Emmanuel) : ni tuile, ni ⌘K, ni écran ; le serveur lui refuse déjà
     le fichier des tournées (jarvis_peut_lire_protege). Aucun chiffre de vente ici : seulement des positions, des tournées et des km.
   - DONNÉES (aucune dans le dépôt) : TOURNEES_ECRAN (fichier protégé `tournees-etablissements.js`, clé « tournees »), PHARMA_FR
     (base nationale publique, V2.ensurePharmaFr), WML_OFFICINES (clientes, chargées après connexion). Une donnée manquante =
     « chargement » ou un message clair, jamais un chiffre faux. La période se LIT dans le fichier (T.periode), jamais en dur.
   - Fond de carte : V2.fondCarte (jamais CARTO). Leaflet par (V2_DATA_BASE || '../') + 'v2/vendor/leaflet/' : depuis essentiels/v2
     et opso/v2 = ../../crm/v2/vendor/leaflet/ (un chemin « vendor/leaflet/ » relatif au document n'y existe pas).
   - Noms libres le 26/11/2026 (git grep) : route `tourneesgroupement`, préfixe CSS `gtrn-`, objet V2.groupementTournees.
   ════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};
  var Ess = V2.tourneesEssentiels || (typeof module !== 'undefined' && typeof require === 'function' ? require('../../crm/v2/v2-tournees-essentiels.js') : null);
  var C = {};
  var NBSP = ' ';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nf(x, d) { return Number(x).toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).replace(/[  ]/g, NBSP); }
  function km(x) { return nf(x, x < 10 ? 1 : 0) + NBSP + 'km'; }
  function normCip(c) { return String(c == null ? '' : c).replace(/\D/g, '').replace(/^0+/, ''); }
  function parCode(a, b) { return String(a).localeCompare(String(b), 'fr', { numeric: true }); }
  C.normCip = normCip;

  // ── Calcul pur (testé : tests/groupement-tournees.test.mjs) ──
  // Distance à vol d'oiseau (km) : la même formule que le générateur du fichier des tournées (haversine, rayon 6 371,0088 km).
  function hav(a, b) {
    var r = Math.PI / 180, p1 = a[0] * r, p2 = b[0] * r, dl = (b[1] - a[1]) * r, dp = p2 - p1;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  C.hav = hav;
  // Détour estimé pour ajouter le point p à la tournée t : le meilleur endroit où l'insérer entre deux points de passage consécutifs
  // (dépôt → arrêt 1 → … → dernier arrêt → dépôt), 1,3 × (a→p + p→b − a→b), arrondi au dixième, jamais négatif. Même facteur que le fichier.
  C.detourInsertion = function (lat, lng, t, depot) {
    var arr = ((t && t.arrets) || []).filter(function (a) { return isFinite(a.lat) && isFinite(a.lng); }).slice().sort(function (a, b) { return (a.n || 0) - (b.n || 0); });
    var pts = arr.map(function (a) { return [a.lat, a.lng]; });
    if (depot && isFinite(depot.lat) && isFinite(depot.lng)) pts = [[depot.lat, depot.lng]].concat(pts, [[depot.lat, depot.lng]]);
    if (!pts.length) return null;
    var p = [lat, lng], best = pts.length === 1 ? 2 * 1.3 * hav(pts[0], p) : Infinity;
    for (var i = 0; i < pts.length - 1; i++) best = Math.min(best, 1.3 * (hav(pts[i], p) + hav(p, pts[i + 1]) - hav(pts[i], pts[i + 1])));
    return Math.round(Math.max(best, 0) * 10) / 10;
  };

  // T = TOURNEES_ECRAN, PF = PHARMA_FR, adh = officines du périmètre ({ code|cip, name, ville, cp, inDb }), wml = clientes Intégral Pharma.
  // Rend null tant qu'une donnée manque. Chaque adhérente reçoit un statut :
  //   'livree'  : arrêt d'une tournée du fichier (la première qui la livre) ;
  //   'proche'  : pas livrée, à SEUIL_LOIN km ou moins de la route d'une tournée → la tournée qui la livrerait + le détour estimé ;
  //   'loin'    : à plus de SEUIL_LOIN km de toute tournée → la plus proche et sa distance, et les 3 clientes Intégral les plus proches ;
  //   'sanspos' : CIP absent de la base nationale (aucune position) : dans la liste, jamais sur la carte.
  C.calculer = function (T, PF, adh, wml) {
    if (!Ess || !T || !T.tournees || !Object.keys(T.tournees).length || !PF || !PF.p || !adh || !wml) return null;
    var SEUIL = Ess.SEUIL_LOIN, codes = Object.keys(T.tournees).sort(parCode), pf = {}, arret = {}, pros = {}, cli = [];
    // Une position partagée par plusieurs officines de la base nationale est un centre de commune ou de quartier (mesuré le 26/11/2026 :
    // 620 positions partagées, jusqu'à 21 officines au même point à Paris) : elle est dite « approximative », jamais une distance au mètre.
    var nPos = {}, pos = function (p) { return p[0] + ',' + p[1]; };
    PF.p.forEach(function (p) { var c = normCip(p[13]); if (c && !pf[c]) pf[c] = p; nPos[pos(p)] = (nPos[pos(p)] || 0) + 1; });
    function approx(p) { return !p || nPos[pos(p)] > 1; }
    codes.forEach(function (c) {
      (T.tournees[c].arrets || []).forEach(function (a) { var k = normCip(a.id); if (k && !arret[k]) arret[k] = { code: c, a: a }; });
      (T.tournees[c].prospects || []).forEach(function (r) { var k = normCip(r[0]); if (k && !pros[k]) pros[k] = { code: c, r: r }; });
    });
    // Position d'une cliente : celle de la base nationale (à l'adresse) ; celle du fichier des clientes est souvent le CENTRE de la ville
    // (mesuré le 26/11/2026 : 1 184 clientes sur 2 114 partagent une position, les 42 de Paris au même point) → signalée « approximative ».
    wml.forEach(function (o) {
      if (!o) return; var x = pf[normCip(o.id)];
      if (x && isFinite(x[0]) && isFinite(x[1])) cli.push({ o: o, lat: x[0], lng: x[1], approx: approx(x) });
      else if (isFinite(o.lat) && isFinite(o.lng) && o.lat && o.lng) cli.push({ o: o, lat: o.lat, lng: o.lng, approx: true });
    });
    var vu = {}, liste = [];
    adh.forEach(function (p) {
      var cip = normCip(p && (p.code || p.cip)); if (!cip || vu[cip]) return; vu[cip] = 1;
      var x = pf[cip], ar = arret[cip];
      var e = { cip: cip, nom: x ? Ess.joli(x[6]) : String(p.name || ''), ville: x ? Ess.joli(x[7]) : String(p.ville || ''), cp: x ? String(x[8] || '') : String(p.cp || ''),
        cliente: !!p.inDb, lat: ar ? ar.a.lat : x ? x[0] : null, lng: ar ? ar.a.lng : x ? x[1] : null, approx: !ar && approx(x) };
      if (!isFinite(e.lat) || !isFinite(e.lng) || e.lat == null || e.lng == null) { e.statut = 'sanspos'; liste.push(e); return; }
      var proche = Infinity, qui = '';
      codes.forEach(function (c) { var d = Ess.distKm(e.lat, e.lng, T.tournees[c].trace || []); if (d < proche) { proche = d; qui = c; } });
      e.qui = qui; e.dQui = proche;
      if (ar) { e.statut = 'livree'; e.code = ar.code; e.n = ar.a.n; e.dRoute = 0; e.detour = 0; }
      else if (proche <= SEUIL) {
        var pr = pros[cip];
        e.statut = 'proche';
        if (pr) { e.code = pr.code; e.dRoute = Number(pr.r[3]) || 0; e.detour = Number(pr.r[6]) || 0; e.source = 'fichier'; if (pr.r[7] === 0 || pr.r[7] === false) e.approx = true; }
        else { e.code = qui; e.dRoute = proche; e.detour = C.detourInsertion(e.lat, e.lng, T.tournees[qui], T.depot); e.source = 'calcul'; }
      } else {
        e.statut = 'loin'; e.code = ''; e.dRoute = proche;
        e.voisines = cli.filter(function (c) { return normCip(c.o.id) !== cip; }).map(function (c) { return { c: c, d: hav([e.lat, e.lng], [c.lat, c.lng]) }; })
          .sort(function (a, b) { return a.d - b.d; }).slice(0, 3).map(function (v) {
            var a = arret[normCip(v.c.o.id)];
            return { nom: Ess.joli(v.c.o.name), ville: Ess.joli(v.c.o.ville), km: v.d, lat: v.c.lat, lng: v.c.lng, approx: v.c.approx, livreePar: a ? a.code : '' };
          });
      }
      liste.push(e);
    });
    var etabs = (T.etablissements || []).map(function (s) { return { s: s.s, nom: s.nom, ville: s.ville, actif: s.tournees === true }; });
    var parT = {}; liste.forEach(function (e) { if (e.code) parT[e.code] = (parT[e.code] || 0) + 1; });
    return {
      periode: String(T.periode || ''), depot: T.depot || null,
      tournees: codes.map(function (c) { var t = T.tournees[c]; return { code: c, nom: String(t.nom || ''), trace: t.trace || [], arrets: t.arrets || [], adh: parT[c] || 0 }; }),
      actifs: etabs.filter(function (s) { return s.actif; }), aRecevoir: etabs.filter(function (s) { return !s.actif; }),
      adh: liste,
      livrees: liste.filter(function (e) { return e.statut === 'livree'; }), proches: liste.filter(function (e) { return e.statut === 'proche'; }),
      loin: liste.filter(function (e) { return e.statut === 'loin'; }), sanspos: liste.filter(function (e) { return e.statut === 'sanspos'; })
    };
  };

  // Numéros 1, 2… (« E1… » chez Essentiels) : tournée par tournée (T09 avant T10), dans l'ordre de la tournée (Ess.numeroter : arrêt le plus
  // proche, puis distance à cet arrêt), puis les adhérentes loin de toute tournée (rangées par tournée la plus proche, puis par distance).
  // Rend des COPIES ; D n'est pas modifié. Les officines sans position n'ont pas de numéro.
  C.numeroter = function (D) {
    if (!D || !D.adh) return null;
    var tous = [];
    D.tournees.forEach(function (t) {
      var grp = D.adh.filter(function (e) { return e.code === t.code; }).map(function (e) { var o = {}; for (var k in e) o[k] = e[k]; o.procheCode = t.code; o.proche = e.dRoute; return o; });
      if (!grp.length) return;
      var P = Ess.numeroter({ code: t.code, ess: grp, arrets: t.arrets.map(function (a) { return { n: a.n, lat: a.lat, lng: a.lng }; }) });
      tous = tous.concat(P.route);
    });
    var loin = D.adh.filter(function (e) { return e.statut === 'loin'; }).map(function (e) { var o = {}; for (var k in e) o[k] = e[k]; o.procheCode = e.qui; o.proche = e.dQui; return o; });
    if (loin.length) tous = tous.concat(Ess.numeroter({ code: '', ess: loin, arrets: [] }).autres);
    var par = {};
    tous.forEach(function (e, i) { e.no = i + 1; par[e.cip] = e; });
    return { tous: tous, par: par };
  };

  function nomTournee(D, code) { var t = D.tournees.filter(function (x) { return x.code === code; })[0]; return t && t.nom ? code + ' · ' + t.nom : code; }
  // Ce qu'on dit de chaque adhérente (liste et bandeau) : la tournée, le détour, ou la piste quand elle est loin. Aucun chiffre de vente.
  C.prevision = function (e, D) { var r0 = C.prevision1(e, D); return e.approx && e.statut !== 'sanspos' ? r0 + ' · position approximative' : r0; };
  C.prevision1 = function (e, D) {
    if (e.statut === 'livree') return 'Déjà livrée par la ' + esc(nomTournee(D, e.code)) + (e.n ? ', arrêt ' + e.n : '');
    if (e.statut === 'proche') {
      return 'Serait livrée par la ' + esc(nomTournee(D, e.code)) + ' · ' + (e.detour != null && e.detour > 0 ? 'détour estimé ' + nf(e.detour, 1) + NBSP + 'km' : 'sur la route, sans détour');
    }
    if (e.statut === 'loin') {
      var r = 'À ' + km(e.dQui) + ' de la ' + esc(e.qui) + ', la plus proche de nos tournées';
      var aR = D.aRecevoir || [];
      if (aR.length === 1) r += ' · tournées de ' + esc(aR[0].nom) + ' pas encore reçues';
      else if (aR.length) r += ' · tournées des ' + aR.length + ' autres établissements du groupe pas encore reçues';
      var v = e.voisines || [];
      if (v.length) r += ' · clientes Intégral Pharma les plus proches : ' + v.map(function (o) { return esc(o.nom) + ' (' + esc(o.ville) + ', ' + (o.approx || e.approx ? (o.km < 1 ? 'moins de 1' + NBSP + 'km' : '≈' + NBSP + km(o.km)) + ', position approximative' : km(o.km)) + (o.livreePar ? ', livrée par la ' + esc(o.livreePar) : '') + ')'; }).join(', ');
      else r += ' · aucune cliente Intégral Pharma connue à proximité';
      return r;
    }
    return 'Position introuvable dans la base nationale : pas de prévision';
  };
  C.sousTitre = function (D, mode) {
    var nT = D.tournees.length, act = D.actifs.map(function (s) { return s.nom; }).join(', ');
    var per = D.periode ? ' (' + esc(D.periode) + ')' : '';
    if (mode === 'auj') return 'Aujourd’hui : nos <b>' + nT + ' tournées</b>' + (act ? ' ' + esc(act) : '') + ' et les <b>' + D.livrees.length + ' adhérentes</b> qu’elles livrent déjà' + per + '. Touchez « En quotidien » pour voir où se placeraient les autres.';
    return 'En quotidien : <b>' + D.livrees.length + '</b> déjà livrées, <b>' + D.proches.length + '</b> à ' + Ess.SEUIL_LOIN + NBSP + 'km ou moins d’une tournée (la tournée qui les livrerait et le détour estimé), <b>' +
      D.loin.length + '</b> plus loin' + (D.sanspos.length ? ', <b>' + D.sanspos.length + '</b> sans position' : '') + '.';
  };

  // Badges recouverts (calcul pur) : bx = boîtes {x, y, w, h, no} en pixels de la carte, ovl = boutons posés sur la carte, sz = {x, y}.
  // Un badge est recouvert s'il sort du cadre, s'il est sous un bouton (plus de 30 % de sa boîte), ou si un badge plus bas (même hauteur :
  // numéro plus petit) couvre plus de 30 % de la PLUS PETITE des deux boîtes (le seuil de la sonde). 26/11/2026 : la boîte était fixe
  // (36 × 26) pour des badges de 42 et 50 px ; O19 restait posé sur O17 (1 chevauchement vu dans le Safari de Will chez OPSO).
  C.recouverts = function (bx, ovl, sz) {
    function surface(a, b) { var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? w * h : 0; }
    return bx.map(function (b) {
      if (b.x < 0 || b.y < 0 || b.x + b.w > sz.x || b.y + b.h > sz.y) return true;
      if ((ovl || []).some(function (o) { return surface(b, o) > 0.3 * b.w * b.h; })) return true;
      var yi = Math.round(b.y + b.h / 2);
      return bx.some(function (o) {
        if (o === b) return false; var yo = Math.round(o.y + o.h / 2);
        return (yo > yi || (yo === yi && o.no < b.no)) && surface(b, o) > 0.3 * Math.min(b.w * b.h, o.w * o.h);
      });
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;

  // ───────────────────────── Affichage (navigateur seulement) ─────────────────────────
  var G = glob.V2_GROUPEMENT, CFG = G && G.tournees;
  if (!CFG || !V2.pages || typeof document === 'undefined' || !Ess) return;
  var ROUTE = 'tourneesgroupement', LETTRE = String(CFG.lettre || '');
  var etat = { mode: 'quot' };

  function interdit() { var u = V2.user; return !!(u && (u.opsoOnly || u.role === 'opso')); }
  function tactile() { try { return glob.matchMedia('(pointer: coarse)').matches || glob.innerWidth <= 700; } catch (e) { return false; } }
  function couleur(nom, defaut) { try { var v = getComputedStyle(document.documentElement).getPropertyValue(nom).trim(); return v || defaut; } catch (e) { return defaut; } }
  function wmlListe() { var w = glob.WML_OFFICINES; if (!w) { try { w = WML_OFFICINES; } catch (e) { w = null; } } return w; }   // const global : visible sans `window.`

  function leaflet(cb) {
    if (glob.L) { cb(); return; }
    var V = (glob.V2_DATA_BASE || '../') + 'v2/vendor/leaflet/', l = document.createElement('link'); l.rel = 'stylesheet'; l.href = V + 'leaflet.css'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = V + 'leaflet.js'; s.onload = function () { cb(); }; s.onerror = function () { cb('err'); }; document.head.appendChild(s);
  }
  function charger() {
    var t = glob.TOURNEES_ECRAN ? Promise.resolve() : (V2.loadFiles ? Promise.resolve(V2.loadFiles(['tournees'])) : Promise.reject(new Error('chargeur absent')));
    var pf = new Promise(function (ok) { if (glob.PHARMA_FR || !V2.ensurePharmaFr) ok(); else V2.ensurePharmaFr(ok); });
    var w = wmlListe() ? Promise.resolve() : (V2.loadFiles ? Promise.resolve(V2.loadFiles(['wml'])) : Promise.resolve());
    return Promise.all([t, pf, w]).then(function () { return C.calculer(glob.TOURNEES_ECRAN, glob.PHARMA_FR, V2.pharmacies || [], wmlListe()); });
  }

  function badge(e) { return '<i class="gtrn-b gtrn-' + e.statut + (e.cliente ? ' cl' : '') + '">' + esc(LETTRE) + e.no + '</i>'; }
  function ligne(e, D) {
    var etiq = e.statut === 'livree' ? 'déjà livrée' : e.statut === 'proche' ? (e.detour > 0 ? 'détour ' + nf(e.detour, 1) + NBSP + 'km' : 'sans détour') : e.statut === 'loin' ? 'à ' + km(e.dQui) : 'sans position';
    var tag = e.statut === 'loin' ? e.qui : e.code || '';
    return '<button type="button" class="gtrn-row" data-cip="' + esc(e.cip) + '">' + (e.no ? badge(e) : '<i class="gtrn-b gtrn-sanspos">–</i>') +
      '<span class="gtrn-row-t"><b>' + esc(e.nom) + '</b><span>' + esc(e.ville) + ' · ' + (e.cliente ? 'cliente Intégral Pharma' : 'pas encore cliente') + '</span></span>' +
      '<em>' + esc(tag) + '<small>' + etiq + '</small></em></button>';
  }

  function render(root) {
    root.innerHTML = V2.topbar({ back: true }) +
      '<div class="v2-wrap opf-page gtrn-page"><div class="opx-head"><div class="v2-page-title">' + esc(CFG.titre || 'Nos tournées et les adhérentes') + '</div></div><div id="gtrn-root"></div></div>';
    var box = document.getElementById('gtrn-root');
    if (interdit()) { box.innerHTML = '<p class="gtrn-msg" role="status">Cet écran n’est pas disponible pour ce compte.</p>'; return; }
    box.innerHTML = '<p class="gtrn-msg" role="status" id="gtrn-attente">Chargement des tournées et des officines…</p>';
    charger().then(function (D) {
      if (!document.body.contains(box)) return;
      if (!D) { box.innerHTML = '<p class="gtrn-msg" role="status">Les tournées ou les officines ne sont pas disponibles pour le moment. Rien n’est affiché plutôt qu’une carte fausse.</p>'; return; }
      dessiner(box, D);
    }, function () {
      if (document.body.contains(box)) box.innerHTML = '<p class="gtrn-msg" role="status">Le fichier des tournées n’a pas pu être lu pour ce compte.</p>';
    });
  }

  function dessiner(root, D) {
    var mode = etat.mode, P = C.numeroter(D), carte = null, L = null, lignes = {}, marqs = {}, items = [], sel = null, voisins = null, depotM = null;
    var ACC = couleur('--grp-accent', '#2F7D1A'), GRIS = couleur('--grp-vert-8a91a3', '#8A91A3');
    root.innerHTML = '<section class="gtrn" aria-label="' + esc(CFG.titre || 'Nos tournées et les adhérentes') + '">' +
      '<div class="gtrn-hd"><div><div class="gtrn-k">' + esc(CFG.surtitre || 'Nos tournées de livraison') + '</div><h2>' + esc(CFG.sousTitre || 'Où se placeraient les adhérentes sur nos tournées') + '</h2></div>' +
      '<div class="gtrn-seg" role="group" aria-label="Aujourd’hui ou en quotidien" id="gtrn-mode"><button type="button" data-m="auj" aria-pressed="false">Aujourd’hui</button><button type="button" data-m="quot" aria-pressed="false">En quotidien</button></div></div>' +
      '<p class="gtrn-sub" id="gtrn-sub"></p>' +
      '<div class="gtrn-body"><div class="gtrn-map" id="gtrn-map"><div class="gtrn-band" id="gtrn-band" aria-live="polite"></div></div><div class="gtrn-side" id="gtrn-side"></div></div>' +
      '<div class="gtrn-leg" id="gtrn-leg"></div>' +
      '<p class="gtrn-note">Détour estimé à vol d’oiseau (× 1,3), comme dans l’écran Tournées de JARVIS. Aucun chiffre de vente sur cette carte.</p></section>';
    var side0 = document.getElementById('gtrn-side');
    function visibles() { return P.tous.filter(function (e) { return mode === 'quot' || e.statut === 'livree'; }); }
    function bascule() {
      Array.prototype.forEach.call(document.querySelectorAll('#gtrn-mode button'), function (x) { var on = x.getAttribute('data-m') === mode; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      document.getElementById('gtrn-sub').innerHTML = C.sousTitre(D, mode);
    }
    function legende() {
      var ex = function (st) { return P.tous.filter(function (e) { return e.statut === st; })[0]; };
      var l = ex('livree'), p = ex('proche'), f = ex('loin');
      document.getElementById('gtrn-leg').innerHTML = '<span><i class="gtrn-sw"></i>Une tournée (' + D.tournees.length + ')</span>' +
        (D.depot ? '<span><i class="gtrn-sw gtrn-sw-d"></i>Dépôt · ' + esc(D.depot.ville || D.depot.nom || '') + '</span>' : '') +
        (l ? '<span>' + badge(l) + 'Déjà livrée (' + D.livrees.length + ')</span>' : '') +
        (mode === 'quot' && p ? '<span>' + badge(p) + 'Sur une tournée, avec détour (' + D.proches.length + ')</span>' : '') +
        (mode === 'quot' && f ? '<span>' + badge(f) + 'À plus de ' + Ess.SEUIL_LOIN + NBSP + 'km de nos tournées (' + D.loin.length + ')</span>' : '');
    }
    function side() {
      var h = '', grp = function (titre, l) { if (l.length) h += '<h3>' + titre + ' · ' + l.length + '</h3>' + l.map(function (e) { return ligne(e, D); }).join(''); };
      var v = visibles();
      grp('Déjà livrées par nos tournées', v.filter(function (e) { return e.statut === 'livree'; }));
      if (mode === 'quot') {
        grp('La tournée qui les livrerait', v.filter(function (e) { return e.statut === 'proche'; }));
        grp('Loin de nos tournées', v.filter(function (e) { return e.statut === 'loin'; }));
        grp('Sans position', D.sanspos);
      }
      if (!h) h = '<p class="gtrn-msg">Aucune adhérente n’est livrée aujourd’hui par nos tournées. Touchez « En quotidien ».</p>';
      side0.innerHTML = h;
    }
    function band(e) {
      var b = document.getElementById('gtrn-band'); if (!b) return;
      if (!e) { b.classList.remove('on'); b.innerHTML = ''; return; }
      b.innerHTML = (e.no ? badge(e) : '') + '<div><b>' + esc(e.nom) + '</b><span>' + esc(e.ville) + ' · ' + (e.cliente ? 'cliente Intégral Pharma' : 'pas encore cliente') + '</span><span>' + C.prevision(e, D) + '</span></div>' +
        '<button type="button" class="gtrn-x" aria-label="Fermer">×</button>';
      b.classList.add('on');
      b.querySelector('.gtrn-x').onclick = function () { choisir(null); };
    }
    function marqueur(e) {
      var bw = tactile() ? 44 : 36, bh = tactile() ? 44 : 28;
      return L.marker([e.lat, e.lng], { icon: L.divIcon({ className: 'gtrn-ic', iconSize: [bw, bh], iconAnchor: [bw / 2, bh / 2],
        html: '<div class="gtrn-mk" data-cip="' + esc(e.cip) + '">' + badge(e) + '<span class="gtrn-lb">' + esc(e.court) + '</span></div>' }), zIndexOffset: 800, keyboard: true, title: LETTRE + e.no + ' · ' + e.nom });
    }
    // Étiquettes sans chevauchement (même règle que le bloc T10) : à droite, à gauche, au-dessus, au-dessous ; un badge recouvert,
    // coupé au bord ou sous un bouton ne porte pas son nom en permanence. Garde carte._loaded : Leaflet plante sans vue.
    function placer() {
      if (!carte || !carte._loaded || !items.length) return;
      var sz = carte.getSize(), pris = [], R0 = carte.getContainer().getBoundingClientRect();
      function inter(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
      var ovl = [];
      Array.prototype.forEach.call(carte.getContainer().querySelectorAll('.gtrn-btns, .leaflet-control-zoom, .leaflet-control-attribution, .gtrn-band.on'), function (x) {
        var r = x.getBoundingClientRect(); if (r.width) ovl.push({ x: r.left - R0.left - 4, y: r.top - R0.top - 4, w: r.width + 8, h: r.height + 8 });
      });
      pris = pris.concat(ovl);
      var HB = tactile() ? 22 : 18, VB = tactile() ? 22 : 13;
      // 26/11/2026 : boîte MESURÉE sur le badge entier (42 et 50 px chez OPSO), jamais plus petite que l'ancienne boîte fixe ; sans marge :
      // mesuré sur la vraie carte OPSO, la marge de 2 px réduisait 5 numéros de plus en points, sans rien gagner en lisibilité.
      // Le petit point est retiré le temps de la mesure (même tâche : rien n'est peint entre-temps).
      items.forEach(function (it) { var el = it.m.getElement(); if (el) el.classList.remove('gtrn-petit'); });
      items.forEach(function (it) {
        var el = it.m.getElement(), bb = el && el.querySelector('.gtrn-b'), p = carte.latLngToContainerPoint(it.m.getLatLng());
        it.p = p; it.hb = Math.max(HB, bb ? bb.offsetWidth / 2 : 0); it.vb = Math.max(VB, bb ? bb.offsetHeight / 2 : 0);
        it.b = { x: p.x - it.hb, y: p.y - it.vb, w: 2 * it.hb, h: 2 * it.vb, no: it.e.no }; pris.push(it.b);
      });
      var rec = C.recouverts(items.map(function (it) { return it.b; }), ovl, sz);
      items.forEach(function (it, i) { it.dessous = rec[i]; });
      // 26/11/2026 (passe WebKit : 138 badges en grappes chez OPSO) : un badge recouvert devient un petit point ; il reprend son numéro
      // au survol, à la sélection, ou dès qu'un zoom lui laisse la place.
      items.forEach(function (it) { var el = it.m.getElement(); if (el) el.classList.toggle('gtrn-petit', !!it.dessous); });
      items.forEach(function (it) {
        var el = it.m.getElement(); if (!el) return; var lab = el.querySelector('.gtrn-lb'); if (!lab) return;
        var lw = lab.offsetWidth, lh = lab.offsetHeight, p = it.p, g = 5, ox = p.x - el.offsetWidth / 2, oy = p.y - el.offsetHeight / 2;
        var c = [{ x: p.x + it.hb + g, y: p.y - lh / 2 }, { x: p.x - it.hb - g - lw, y: p.y - lh / 2 }, { x: p.x - lw / 2, y: p.y - it.vb - g - lh }, { x: p.x - lw / 2, y: p.y + it.vb + g }];
        var ok = null;
        for (var i = 0; i < c.length && !ok && !it.dessous; i++) {
          var r = { x: c[i].x, y: c[i].y, w: lw, h: lh };
          if (r.x < 4 || r.y < 4 || r.x + lw > sz.x - 4 || r.y + lh > sz.y - 4) continue;
          if (pris.some(function (q) { return inter(r, q); })) continue;
          ok = r;
        }
        if (!ok) ok = { x: c[0].x, y: c[0].y, cache: true }; else pris.push(ok);
        lab.style.left = Math.round(ok.x - ox) + 'px'; lab.style.top = Math.round(ok.y - oy) + 'px';
        lab.classList.toggle('vu', !ok.cache);
      });
    }
    function styleLignes(code) {
      Object.keys(lignes).forEach(function (k) {
        var on = k === code; lignes[k].setStyle(on ? { color: ACC, weight: 5, opacity: 1 } : { color: GRIS, weight: 3, opacity: code ? 0.35 : 0.7 });
        if (on) lignes[k].bringToFront();
      });
    }
    function allumer(cip, depuisListe) {
      var m = marqs[cip]; if (m && m.getElement()) { m.getElement().classList.add('gtrn-on'); m.setZIndexOffset(3000); }
      var r = side0.querySelector('[data-cip="' + cip + '"]');
      if (r) { r.classList.add('gtrn-act'); if (!depuisListe && side0.scrollHeight > side0.clientHeight + 4) side0.scrollTop = r.offsetTop - side0.clientHeight / 2 + r.offsetHeight / 2; }
    }
    function eteindre(cip) {
      var m = marqs[cip]; if (m && m.getElement()) { m.getElement().classList.remove('gtrn-on'); m.setZIndexOffset(800); }
      var r = side0.querySelector('[data-cip="' + cip + '"]'); if (r) r.classList.remove('gtrn-act');
    }
    function choisir(cip, depuisListe) {
      if (sel && sel !== cip) eteindre(sel);
      if (voisins && carte) { carte.removeLayer(voisins); voisins = null; }
      sel = cip;
      var e = cip ? (P.par[cip] || D.adh.filter(function (x) { return x.cip === cip; })[0]) : null;
      if (!e) { band(null); styleLignes(''); placer(); return; }
      allumer(cip, depuisListe); band(e); styleLignes(e.code || e.qui || '');
      if (carte && e.statut === 'loin' && e.voisines && e.voisines.length) {
        // les clientes Intégral les plus proches : un point bleu chacune, le temps de la sélection
        voisins = L.layerGroup(e.voisines.map(function (v) {
          return L.circleMarker([v.lat, v.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#0050E6', fillOpacity: 1 }).bindTooltip(esc(v.nom) + ' · ' + esc(v.ville) + ' · ' + km(v.km));
        })).addTo(carte);
      }
      if (carte && e.lat != null && (depuisListe || e.statut === 'loin')) {
        try {
          var b = L.latLngBounds([[e.lat, e.lng]]);
          if (voisins) voisins.eachLayer(function (x) { b.extend(x.getLatLng()); });
          if (e.statut !== 'loin' && lignes[e.code]) b = b.extend(lignes[e.code].getBounds());
          carte.fitBounds(b, { paddingTopLeft: [30, 70], paddingBottomRight: [30, 110], maxZoom: 13, animate: false });
        } catch (x) {}
        placer();
        if (tactile() && depuisListe) document.getElementById('gtrn-map').scrollIntoView({ block: 'nearest' });
      }
    }
    function couches() {
      if (!carte) return;
      Object.keys(marqs).forEach(function (k) { carte.removeLayer(marqs[k]); });
      marqs = {}; items = [];
      var v = visibles();
      v.slice().reverse().forEach(function (e) {
        var m = marqueur(e).addTo(carte); marqs[e.cip] = m;
        m.on('mouseover', function () { allumer(e.cip, false); });
        m.on('mouseout', function () { if (sel !== e.cip) eteindre(e.cip); });
        m.on('click', function () { choisir(e.cip, false); });
      });
      items = v.map(function (e) { return { e: e, m: marqs[e.cip] }; });
      placer();
    }
    var vue = {
      tout: function () {
        try {
          var b = L.latLngBounds([]);
          Object.keys(lignes).forEach(function (k) { b.extend(lignes[k].getBounds()); });
          visibles().forEach(function (e) { b.extend([e.lat, e.lng]); });   // les lointaines comprises (390 px : E24/E25 étaient hors cadre)
          carte.invalidateSize(); carte.fitBounds(b, { paddingTopLeft: [24, 64], paddingBottomRight: [24, 60], animate: false });
        } catch (e) {}
      },
      adh: function () {
        try {
          var pts = visibles().map(function (e) { return [e.lat, e.lng]; });
          if (!pts.length) { vue.tout(); return; }
          carte.invalidateSize(); carte.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 74], paddingBottomRight: [40, 70], maxZoom: 12, animate: false });
        } catch (e) {}
      }
    };
    function rendre() { legende(); side(); choisir(null); couches(); }
    function cartePose() {
      leaflet(function (err) {
        var el = document.getElementById('gtrn-map'); if (err || !glob.L || !el) { if (el) el.innerHTML = '<p class="gtrn-msg">Carte indisponible.</p>'; return; }
        L = glob.L;
        carte = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, zoomSnap: 0.25, dragging: !tactile() });
        try { carte.attributionControl.setPrefix(false); } catch (e) {}
        if (V2.fondCarte) V2.fondCarte(carte);
        D.tournees.forEach(function (t) {
          if (!t.trace || t.trace.length < 2) return;
          lignes[t.code] = L.polyline(t.trace, { color: GRIS, weight: 3, opacity: 0.7 }).addTo(carte)
            .bindTooltip('<b>' + esc(t.code) + '</b> · ' + esc(t.nom) + '<br>' + t.arrets.length + ' arrêts' + (t.adh ? ' · ' + t.adh + ' adhérente' + (t.adh > 1 ? 's' : '') : ''), { sticky: true });
        });
        if (D.depot && isFinite(D.depot.lat)) {
          depotM = L.marker([D.depot.lat, D.depot.lng], { icon: L.divIcon({ className: 'gtrn-ic', iconSize: tactile() ? [44, 44] : [22, 22], iconAnchor: tactile() ? [22, 22] : [11, 11], html: '<div class="gtrn-depot"' + (tactile() ? ' style="margin:14px"' : '') + '></div>' }), zIndexOffset: 400, title: 'Dépôt · ' + (D.depot.nom || '') })
            .addTo(carte).bindTooltip('Dépôt · ' + esc(D.depot.nom || '') + (D.depot.ville ? ', ' + esc(D.depot.ville) : ''));
        }
        var btns = document.createElement('div'); btns.className = 'gtrn-btns';
        btns.innerHTML = '<button type="button" data-z="tout">Toutes les tournées</button><button type="button" data-z="adh">Les adhérentes</button>';
        el.appendChild(btns);
        L.DomEvent.disableClickPropagation(btns); L.DomEvent.disableClickPropagation(document.getElementById('gtrn-band'));
        btns.onclick = function (ev) { var b = ev.target.closest('button'); if (!b) return; if (b.getAttribute('data-z') === 'tout') vue.tout(); else vue.adh(); placer(); };
        carte.on('click', function () { if (sel) choisir(null); });
        vue.tout(); couches();
        setTimeout(function () { vue.tout(); placer(); }, 0); setTimeout(function () { vue.tout(); placer(); }, 500);
        carte.on('zoomend moveend resize', placer);
        root.__gtrn = { carte: carte };
      });
    }
    document.getElementById('gtrn-mode').onclick = function (ev) {
      var b = ev.target.closest('button'); if (!b || b.getAttribute('data-m') === mode) return;
      mode = etat.mode = b.getAttribute('data-m');
      bascule(); rendre();
    };
    side0.addEventListener('mouseover', function (ev) { var r = ev.target.closest('[data-cip]'); if (r) allumer(r.getAttribute('data-cip'), true); });
    side0.addEventListener('mouseout', function (ev) { var r = ev.target.closest('[data-cip]'); if (r && r.getAttribute('data-cip') !== sel && !r.contains(ev.relatedTarget)) eteindre(r.getAttribute('data-cip')); });
    side0.addEventListener('click', function (ev) { var r = ev.target.closest('[data-cip]'); if (r) choisir(r.getAttribute('data-cip'), true); });
    bascule(); legende(); side(); cartePose();
  }

  V2.pages[ROUTE] = { needs: [], render: render };

  // Lu par l'accueil (tuile), ⌘K et le tableau de bord (ligne courte). visible() : faux pour le rôle opso → ni tuile ni ⌘K.
  V2.groupementTournees = {
    route: ROUTE,
    titre: CFG.titre || 'Nos tournées et les adhérentes',
    tuile: CFG.tuile || '',
    tuileCourte: CFG.tuileCourte || '',
    palette: CFG.palette || 'Nos tournées et les adhérentes',
    visible: function () { return !interdit(); },
    _calcul: C
  };
})(typeof window !== 'undefined' ? window : globalThis);
