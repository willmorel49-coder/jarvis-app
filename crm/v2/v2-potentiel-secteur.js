/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · POTENTIEL D'UN SECTEUR — le calcul, UNE seule fois (29/10/2026)
   Will : savoir où un secteur est sous-doté en officines ou porte un marché important, pour choisir où prospecter.

   POURQUOI CE FICHIER : la carte, la fiche de la carte et le Copilote affichent les mêmes chiffres. Si chaque écran
   refaisait son calcul, les trois finiraient par se contredire. Ils lisent donc tous V2.potentielSecteur.

   LA RÈGLE (la même partout) :
   - Une zone = un disque (rayon simple, 2 / 5 / 10 km) autour d'un point. Pas de temps de route, pas de clé de service.
   - Un quartier INSEE (IRIS) compte dans la zone si SON CENTRE est dans le disque (le centre est un point intérieur au
     quartier, calculé à la préparation des données).
   - RÈGLE CORRIGÉE le 29/10/2026 : une officine compte si elle est SITUÉE DANS l'un des quartiers de la zone (point dans le
     contour de POTENTIEL_SECTEUR.geo), plus si elle est « dans le disque ». Avant, la population d'un grand quartier à cheval
     sur le bord comptait sans ses officines (ex. La Brière, 44 : 18 502 hab. pour 1 officine à 5 km). Une officine dans aucun
     contour (fentes de simplification, bord de département) est rattachée au quartier dont le centre est le plus proche
     (≤ 1 km, sinon le plus proche dans 10 km ; au-delà elle n'est rattachée à rien). Le quartier de l'officine autour de
     laquelle on calcule est toujours dans la zone. Voir diagnostic() pour le nombre de rattachements par repli.
   - habitants par officine = population de la zone ÷ nombre d'officines. Aucune officine : on écrit « aucune officine »
     (jamais une division par zéro).
   - marché estimé = Σ (population de la tranche d'âge × dépense de médicaments remboursables par habitant de la tranche).
     C'est un ORDRE DE GRANDEUR, jamais un chiffre de vente : l'écran dit « environ ». Les dépenses par tranche viennent de
     l'Assurance maladie (voir meta.depenseParAge dans potentiel-secteur-data.js).
   - La couleur et le libellé reprennent EXACTEMENT les seuils de la légende « tension » de La carte (v2-carte.js,
     zoneColor / legendHtml) : on ne crée pas une deuxième échelle.

   DONNÉES : window.POTENTIEL_SECTEUR (potentiel-secteur-data.js) + window.PHARMA_FR.p (officines ; point =
   [lat,lng,uga,grp,seg,comm,nom,ville,cp,tel,titulaire,email,ca,id]). Ce module NE LIT JAMAIS le champ `ca` (indice 12) ;
   la segmentation client / prospect (indice 4, fichier protégé) se lit comme le fait v2-carte.js : D.seg[p[4]].

   Limites connues : les tranches d'âge de l'INSEE par quartier (0-19, 20-64, 65-79, 80 et +) ne coïncident pas avec celles
   de l'Assurance maladie (0-19, 20-59, 60 et +) : les montants par habitant sont calés sur les tranches de l'INSEE
   (voir rapport-donnees.md). Un quartier dont la population n'est pas publiée compte pour 0 habitant.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};

  var CELL = 0.05;                 // taille d'une cellule de la grille, en degrés (~5,5 km en latitude)
  var KM_LAT = 111.19;             // km par degré de latitude
  var QC = { code: 0, nom: 1, commune: 2, dep: 3, lat: 4, lng: 5, pop: 6, p0019: 7, p2064: 8, p6579: 9, p80: 10, marche: 11 };

  var S = null;                    // index construit au premier appel
  var cacheMoy = {};

  function cellKey(ix, iy) { return ix + '_' + iy; }
  function cellOf(v) { return Math.floor(v / CELL); }

  // ── Index spatial en grille (quartiers + officines) ──
  function build() {
    var P = glob.POTENTIEL_SECTEUR, D = glob.PHARMA_FR;
    if (!P || !P.iris) return null;
    var idx = {}, qgrid = {}, i, k;
    for (i = 0; i < P.iris.length; i++) {
      var q = P.iris[i];
      idx[q[QC.code]] = i;
      k = cellKey(cellOf(q[QC.lng]), cellOf(q[QC.lat]));
      (qgrid[k] = qgrid[k] || []).push(i);
    }
    var deps = {};
    for (i = 0; i < P.meta.depts.length; i++) deps[P.meta.depts[i]] = 1;
    // grille des contours (boîtes englobantes) pour « point dans quel quartier ? »
    var polys = new Array(P.iris.length), cgrid = {};
    var feats = P.geo && P.geo.features || [];
    for (i = 0; i < feats.length; i++) {
      var f = feats[i], qi = idx[f.properties && f.properties.code_iris];
      if (qi === undefined || !f.geometry) continue;
      var mp = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;   // MultiPolygon = liste de polygones ; chaque polygone = [anneau extérieur, trous…]
      var bb = [Infinity, Infinity, -Infinity, -Infinity];
      for (var a = 0; a < mp.length; a++) { var ring = mp[a][0]; for (var b = 0; b < ring.length; b++) {
        if (ring[b][0] < bb[0]) bb[0] = ring[b][0]; if (ring[b][1] < bb[1]) bb[1] = ring[b][1];
        if (ring[b][0] > bb[2]) bb[2] = ring[b][0]; if (ring[b][1] > bb[3]) bb[3] = ring[b][1]; } }
      polys[qi] = { mp: mp, bb: bb };
      for (var cx = cellOf(bb[0]); cx <= cellOf(bb[2]); cx++) for (var cy = cellOf(bb[1]); cy <= cellOf(bb[3]); cy++) {
        k = cellKey(cx, cy); (cgrid[k] = cgrid[k] || []).push(qi);
      }
    }
    var St = { P: P, D: D, idx: idx, qgrid: qgrid, cgrid: cgrid, polys: polys, deps: deps, offsSecteur: [], qOff: {}, omap: {},
               diag: { total: 0, dansContour: 0, repli1km: 0, repliPlusProche: 0, nonRattachees: 0, secteur: { total: 0, dansContour: 0, repli1km: 0, repliPlusProche: 0, nonRattachees: 0 }, distRepliMaxKm: 0 } };
    if (D && D.p) {
      for (i = 0; i < D.p.length; i++) {
        var p = D.p[i];
        if (typeof p[0] !== 'number' || typeof p[1] !== 'number' || isNaN(p[0]) || isNaN(p[1]) || (p[0] === 0 && p[1] === 0)) continue;   // 43 officines sans position (0,0) dans PHARMA_FR : ignorées
        var dep = String(p[8] || '').slice(0, 2), isSec = !!deps[dep];
        if (isSec) St.offsSecteur.push(i);
        var h = rattache(St, p[0], p[1]);
        var dg = St.diag, ds = isSec ? dg.secteur : null;
        dg.total++; if (ds) ds.total++;
        if (h.q === -1) { dg.nonRattachees++; if (ds) ds.nonRattachees++; continue; }
        if (h.mode === 'contour') { dg.dansContour++; if (ds) ds.dansContour++; }
        else if (h.mode === 'repli1km') { dg.repli1km++; if (ds) ds.repli1km++; }
        else { dg.repliPlusProche++; if (ds) ds.repliPlusProche++; }
        if (h.mode !== 'contour' && h.km > dg.distRepliMaxKm) dg.distRepliMaxKm = h.km;
        (St.qOff[h.q] = St.qOff[h.q] || []).push(i);
        St.omap[p[0] + ',' + p[1]] = h.q;
      }
    }
    return St;
  }

  // Point dans un anneau (lancer de rayon) ; un polygone contient le point s'il est dans l'anneau extérieur et dans AUCUN trou.
  function dansAnneau(x, y, ring) {
    var c = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function dansQuartier(s, qi, lat, lng) {
    var pl = s.polys[qi]; if (!pl) return false;
    if (lng < pl.bb[0] || lng > pl.bb[2] || lat < pl.bb[1] || lat > pl.bb[3]) return false;
    for (var a = 0; a < pl.mp.length; a++) {
      var poly = pl.mp[a];
      if (!dansAnneau(lng, lat, poly[0])) continue;
      var trou = false;
      for (var h = 1; h < poly.length; h++) if (dansAnneau(lng, lat, poly[h])) { trou = true; break; }
      if (!trou) return true;
    }
    return false;
  }
  // Le quartier qui contient le point, ou -1.
  function quartierContenant(s, lat, lng) {
    var g = s.cgrid[cellKey(cellOf(lng), cellOf(lat))];
    if (g) for (var j = 0; j < g.length; j++) if (dansQuartier(s, g[j], lat, lng)) return g[j];
    return -1;
  }
  // Rattachement d'une officine : contour, sinon centre le plus proche (≤ 1 km), sinon le plus proche (≤ 10 km), sinon rien.
  function rattache(s, lat, lng) {
    var q = quartierContenant(s, lat, lng);
    if (q >= 0) return { q: q, mode: 'contour', km: 0 };
    var kLng = KM_LAT * Math.cos(lat * Math.PI / 180), best = -1, bd = Infinity;
    for (var ring = 1; ring <= 3 && best < 0; ring++) {         // 1 puis 2 puis 3 cellules autour : ~5,5 / 11 / 16 km
      var cx = cellOf(lng), cy = cellOf(lat);
      for (var ix = cx - ring; ix <= cx + ring; ix++) for (var iy = cy - ring; iy <= cy + ring; iy++) {
        var g = s.qgrid[cellKey(ix, iy)]; if (!g) continue;
        for (var j = 0; j < g.length; j++) {
          var c = s.P.iris[g[j]], dx = (c[QC.lng] - lng) * kLng, dy = (c[QC.lat] - lat) * KM_LAT, d = Math.sqrt(dx * dx + dy * dy);
          if (d < bd) { bd = d; best = g[j]; }
        }
      }
    }
    if (best < 0 || bd > 10) return { q: -1, mode: 'aucun', km: bd };
    return { q: best, mode: bd <= 1 ? 'repli1km' : 'repliPlusProche', km: bd };
  }
  function ready() { if (!S) S = build(); return S; }
  // À rappeler si PHARMA_FR est (re)chargé après coup (segmentation protégée arrivée, par exemple).
  function reset() { S = null; cacheMoy = {}; }

  function segmentDe(p) {          // 'client' | 'prospect' | 'autre' — même lecture que v2-carte.js (isClient / isProspect)
    var D = glob.PHARMA_FR, s = D && D.seg ? (D.seg[p[4]] || '') : '';
    if (s.indexOf('Client') === 0) return 'client';
    if (s === 'Prospect') return 'prospect';
    return 'autre';
  }

  // ── La zone ──
  // `home` (interne) = indice du quartier à forcer dans la zone ; sinon on le cherche : officine connue (même position) ou point dans un contour.
  function zone(lat, lng, rayonKm, home) {
    var s = ready();
    var r = Math.max(0, Number(rayonKm) || 0);
    var res = { pop: 0, pop80p: 0, part80: 0, marche: 0, officines: [], nbOff: 0, nbClients: 0, nbProspects: 0,
                habParOff: null, aucuneOfficine: false, marcheParOff: null, quartiers: [], rayonKm: r };
    if (!s) return res;
    var kLng = KM_LAT * Math.cos(lat * Math.PI / 180);
    var r2 = r * r;
    var dLat = r / KM_LAT, dLng = r / kLng;
    var x0 = cellOf(lng - dLng), x1 = cellOf(lng + dLng), y0 = cellOf(lat - dLat), y1 = cellOf(lat + dLat);
    var ix, iy, g, j, dans = [], vus = {};
    var iris = s.P.iris, pts = s.D && s.D.p;
    for (ix = x0; ix <= x1; ix++) for (iy = y0; iy <= y1; iy++) {
      g = s.qgrid[cellKey(ix, iy)];
      if (g) for (j = 0; j < g.length; j++) {
        var q = iris[g[j]];
        var dx = (q[QC.lng] - lng) * kLng, dy = (q[QC.lat] - lat) * KM_LAT;
        if (dx * dx + dy * dy < r2) { dans.push(g[j]); vus[g[j]] = 1; }
      }
    }
    if (r > 0) {                                 // le quartier du point (celui de l'officine) est toujours dans la zone
      if (home === undefined) { home = s.omap[lat + ',' + lng]; if (home === undefined) home = quartierContenant(s, lat, lng); }
      if (home >= 0 && !vus[home]) { dans.push(home); vus[home] = 1; }
    }
    for (j = 0; j < dans.length; j++) {
      var qq = iris[dans[j]];
      res.pop += qq[QC.pop]; res.pop80p += qq[QC.p80]; res.marche += qq[QC.marche];
      res.quartiers.push(qq[QC.code]);
      var lo = s.qOff[dans[j]];
      if (lo && pts) for (var m = 0; m < lo.length; m++) {
        var p = pts[lo[m]];
        res.officines.push(p[13]);
        var sg = segmentDe(p);
        if (sg === 'client') res.nbClients++; else if (sg === 'prospect') res.nbProspects++;
      }
    }
    res.nbOff = res.officines.length;
    res.part80 = res.pop > 0 ? res.pop80p / res.pop : 0;
    if (res.nbOff > 0) { res.habParOff = res.pop / res.nbOff; res.marcheParOff = res.marche / res.nbOff; }
    else res.aucuneOfficine = true;
    res.echelle = echelle(res.habParOff, res.pop);
    return res;
  }

  function quartier(code, rayonKm) {
    var s = ready();
    if (!s || s.idx[code] === undefined) return null;
    var q = s.P.iris[s.idx[code]];
    var z = zone(q[QC.lat], q[QC.lng], rayonKm, s.idx[code]);
    z.code = code; z.nom = q[QC.nom]; z.commune = q[QC.commune]; z.dep = q[QC.dep];
    z.centre = { lat: q[QC.lat], lng: q[QC.lng] };
    return z;
  }

  // Combien d'officines rattachées par contour / par repli (pour le rapport) ; secteur = les 8 départements.
  function diagnostic() { var s = ready(); return s ? JSON.parse(JSON.stringify(s.diag)) : null; }

  // ── L'échelle : mêmes seuils et mêmes couleurs que la « tension » de La carte (v2-carte.js, zoneColor / legendHtml) ──
  // habParOff = null : aucune officine dans la zone → rouge foncé si des gens y habitent (pop > 0), gris sinon.
  var PALIERS = [
    { min: 4200, rang: 4, couleur: '#B01532', libelle: '≥ 4 200 hab./officine' },
    { min: 3400, rang: 3, couleur: '#E8546A', libelle: '3 400–4 200 · sous-doté' },
    { min: 2800, rang: 2, couleur: '#FBD08A', libelle: '2 800–3 400' },
    { min: 2200, rang: 1, couleur: '#9FD9B5', libelle: '2 200–2 800' },
    { min: 0.5,  rang: 0, couleur: '#2E9E66', libelle: '< 2 200 · bien doté' }
  ];
  function echelle(habParOff, pop) {
    if (habParOff === null || habParOff === undefined || isNaN(habParOff)) {
      if (pop > 0) return { couleur: '#B01532', libelle: 'aucune officine', rang: 4, aucuneOfficine: true };
      return { couleur: '#EDEFF3', libelle: 'sans donnée', rang: -1 };
    }
    var h = Math.round(habParOff);   // v2-carte.js arrondit avant de comparer
    for (var i = 0; i < PALIERS.length; i++) {
      if (h >= PALIERS[i].min) return { couleur: PALIERS[i].couleur, libelle: PALIERS[i].libelle, rang: PALIERS[i].rang };
    }
    return { couleur: '#EDEFF3', libelle: 'sans donnée', rang: -1 };
  }

  // ── Les officines des 8 départements du secteur (pour le classement et la moyenne) ──
  function officinesSecteur() {
    var s = ready(); if (!s || !s.D) return [];
    return s.offsSecteur.map(function (i) {
      var p = s.D.p[i];
      return { i: i, id: p[13], lat: p[0], lng: p[1], seg: segmentDe(p), dep: String(p[8] || '').slice(0, 2) };
    });
  }

  // Marché par officine MOYEN des officines des 8 départements, mesuré au même rayon que la zone comparée.
  function moyenneSecteur(rayonKm) {
    var key = String(rayonKm);
    if (cacheMoy[key]) return cacheMoy[key];
    var s = ready(); if (!s || !s.D) return null;
    var somme = 0, sh = 0, n = 0;
    for (var k = 0; k < s.offsSecteur.length; k++) {
      var p = s.D.p[s.offsSecteur[k]];
      var z = zone(p[0], p[1], rayonKm);
      if (z.nbOff > 0) { somme += z.marcheParOff; sh += z.habParOff; n++; }
    }
    cacheMoy[key] = n ? { marcheParOff: somme / n, habParOff: sh / n, n: n, rayonKm: rayonKm } : null;
    return cacheMoy[key];
  }

  V2.potentielSecteur = {
    zone: zone, quartier: quartier, echelle: echelle, moyenneSecteur: moyenneSecteur,
    officinesSecteur: officinesSecteur, reset: reset, diagnostic: diagnostic,
    paliers: PALIERS,
    meta: function () { return glob.POTENTIEL_SECTEUR ? glob.POTENTIEL_SECTEUR.meta : null; }
  };
})(window);
