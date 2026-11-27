/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · LA CARTE · « MA CARTE » — calcul PUR (26/11/2026)
   Will : « chaque commerciaux puisse avoir sa propre carte ciblé avec son secteur ses clients ses prospect ses groupements
   ses données et tout ce qui est même etude comme on a mis sur phirst ». Maquette choisie : « 2 · Mon secteur d'abord ».

   Ce fichier ne touche NI la page NI le réseau : il reçoit des fonctions de lecture (ctx) et rend des nombres, des listes et des
   phrases. Il est donc testable sous node (tests/carte-secteur.test.mjs) et ne contient aucune donnée.
   L'écran (v2-carte-secteur.js) lui passe la vraie base ; v2-carte.js garde sa propre logique de couleur et de filtre.

   ctx = {
     pts      : PHARMA_FR.p   — [lat, lng, ugaIdx, grpIdx, segIdx, commIdx, nom, ville, cp, tel, titulaire, email, ca, id]
     uga, grp : PHARMA_FR.uga / .grp (libellés rangés par indice)
     commsOf  : p -> [noms des commerciaux]   (la règle de La carte : portefeuille, sinon commerciaux de l'UGA)
     isClient : p -> vrai si cliente (toutes équipes)
     palierDe : p -> 'A' | 'B' | 'C' | ''     ('' = palier inconnu ou masqué)
     voitCa   : p -> vrai si le compte a le droit de voir les chiffres de vente de cette officine
     caMois   : p -> { d: dernier mois, p: mois d'avant } | null (null = chiffre non lu)
     kmTournee: p -> { km, code } | null      (distance au tracé d'une tournée de livraison ; null = inconnue)
     info     : p -> ligne d'officines-infos | null
   }
   Règle de confidentialité : le chiffre d'affaires n'est JAMAIS sommé sur une officine dont voitCa(p) est faux.
   ═══════════════════════════════════════════════════════════════════ */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.CARTE_SECTEUR_PUR = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = ' ';   // espace fine insécable
  var KM_TOURNEE = 10; // « à moins de 10 km d'une tournée »

  // ── Mise en forme ──────────────────────────────────────────────
  function nombre(n, dec) {
    if (n === null || n === undefined || typeof n !== 'number' || !isFinite(n)) return '—';
    dec = dec || 0;
    var s = Math.abs(n).toFixed(dec), parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    return (n < 0 ? '−' : '') + parts.join(',');
  }
  function plur(n, un, plusieurs) { return n > 1 ? plusieurs : un; }
  var MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  // « 2026-10 » -> « octobre 2026 » (jamais deviné : '' si le format est illisible)
  function moisNom(ym) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
    if (!m || +m[2] < 1 || +m[2] > 12) return '';
    return MOIS_NOMS[+m[2] - 1] + ' ' + m[1];
  }

  // ── Les quatre classes d'aplat (part d'officines clientes d'une UGA) ──
  var APLATS = [
    { max: 5, col: '#EAF1FF', lib: 'moins de 5 %' },
    { max: 10, col: '#C6D6F8', lib: '5 à 10 %' },
    { max: 15, col: '#8FB0F2', lib: '10 à 15 %' },
    { max: Infinity, col: '#4D86F0', lib: '15 % et plus' }
  ];
  // Rend 0 à 3 ; -1 si la part est inconnue (UGA sans officine) : jamais une classe inventée.
  function classeAplat(part) {
    if (typeof part !== 'number' || !isFinite(part) || part < 0) return -1;
    for (var i = 0; i < APLATS.length; i++) if (part < APLATS[i].max) return i;
    return APLATS.length - 1;
  }

  // ── Le secteur d'un commercial ──
  // UGA du secteur = celles où au moins une officine a ce commercial dans commsOf (clientes de son portefeuille, ou UGA où il a
  // au moins une cliente ; les secteurs ajoutés entrent par la même porte, dans commsOf). L'UGA sans nom ('') n'en est pas une.
  function secteurDe(nom, ctx) {
    var ugas = {}, codes = [];
    if (nom && ctx && ctx.pts) {
      for (var i = 0; i < ctx.pts.length; i++) {
        var p = ctx.pts[i], u = p[2];
        if (u == null || ugas[u] || !ctx.uga[u]) continue;
        if (ctx.commsOf(p).indexOf(nom) >= 0) { ugas[u] = true; codes.push(ctx.uga[u]); }
      }
    }
    codes.sort();
    return { nom: nom || '', ugas: ugas, codes: codes };
  }
  function moi(p, nom, ctx) { return ctx.isClient(p) && ctx.commsOf(p).indexOf(nom) >= 0; }
  // Une officine est « du secteur » : son UGA en fait partie, ou c'est une de ses clientes (même sans UGA connue).
  function dansSecteur(p, S, ctx) {
    if (!S || !S.nom) return false;
    if (p[2] != null && S.ugas[p[2]]) return true;
    return moi(p, S.nom, ctx);
  }
  function indicesDuSecteur(S, ctx) {
    var out = [];
    for (var i = 0; i < ctx.pts.length; i++) {
      if (ctx.fermee && ctx.fermee(ctx.pts[i])) continue;   // 27/11/2026 : officine fermée (annuaire) → hors de la carte et des comptes du secteur
      if (dansSecteur(ctx.pts[i], S, ctx)) out.push(i);
    }
    return out;
  }
  function indicesDeUga(idxUga, ctx) {
    var out = [];
    for (var i = 0; i < ctx.pts.length; i++) if (ctx.pts[i][2] === idxUga && !(ctx.fermee && ctx.fermee(ctx.pts[i]))) out.push(i);   // fermée : hors des comptes
    return out;
  }

  // ── Le calcul d'un ensemble d'officines (le secteur entier, ou une seule UGA) ──
  function nomGroupement(p, ctx) { var g = ctx.grp[p[3]]; return (g && g !== '—') ? g : ''; }
  function mesurer(indices, nom, ctx) {
    var r = {
      officines: indices.length, clientesTous: 0, clientes: 0, collegues: 0, prospects: 0, prospects10: 0, prospectsKmInconnu: 0,
      paliers: { A: 0, B: 0, C: 0, sans: 0 }, groupements: {},
      ca: { dernier: 0, precedent: 0, lues: 0, luesPrec: 0, visibles: 0 }
    };
    for (var k = 0; k < indices.length; k++) {
      var p = ctx.pts[indices[k]], cli = ctx.isClient(p), mienne = cli && ctx.commsOf(p).indexOf(nom) >= 0, g = nomGroupement(p, ctx);
      if (cli) r.clientesTous++;
      if (mienne) {
        r.clientes++;
        var pal = ctx.palierDe(p); if (pal === 'A' || pal === 'B' || pal === 'C') r.paliers[pal]++; else r.paliers.sans++;
        if (ctx.voitCa(p)) {
          r.ca.visibles++;
          var v = ctx.caMois ? ctx.caMois(p) : null;
          if (v && typeof v.d === 'number' && isFinite(v.d)) { r.ca.dernier += v.d; r.ca.lues++; }
          if (v && typeof v.p === 'number' && isFinite(v.p)) { r.ca.precedent += v.p; r.ca.luesPrec++; }
        }
      } else if (cli) r.collegues++;
      else {
        r.prospects++;
        if (ctx.kmTournee) {
          var t = ctx.kmTournee(p);
          if (t && typeof t.km === 'number' && isFinite(t.km)) { if (t.km <= KM_TOURNEE) r.prospects10++; } else r.prospectsKmInconnu++;
        }
      }
      if (g) { var e = r.groupements[g] || (r.groupements[g] = { c: 0, p: 0 }); if (mienne) e.c++; else if (!cli) e.p++; }
    }
    r.partClientes = r.officines ? Math.round(r.clientesTous / r.officines * 1000) / 10 : null;   // toutes équipes, ÷ officines
    r.caLu = r.ca.lues > 0;
    r.evolution = evolution(r.ca);
    return r;
  }
  // Évolution du dernier mois sur le précédent, en %. Aucun pourcentage si la comparaison ne tient pas : pas de mois d'avant,
  // ou nettement moins de clientes lues sur le dernier mois que sur le précédent (mois incomplet : il inventerait une chute).
  function evolution(ca) {
    if (!ca || !(ca.precedent > 0) || !(ca.dernier >= 0) || ca.lues === 0) return null;
    if (ca.lues < ca.luesPrec * 0.8) return null;
    return Math.round((ca.dernier / ca.precedent - 1) * 1000) / 10;
  }
  function chiffresSecteur(S, ctx) { return mesurer(indicesDuSecteur(S, ctx), S.nom, ctx); }
  // Portrait d'une UGA : mêmes chiffres, limités à ses officines. idxUga = indice dans ctx.uga.
  function portraitUga(idxUga, nom, ctx) {
    var ind = indicesDeUga(idxUga, ctx), r = mesurer(ind, nom, ctx);
    r.indices = ind; r.code = ctx.uga[idxUga] || '';
    var villes = {}, best = '', bn = 0;
    ind.forEach(function (i) { var v = ctx.pts[i][7]; if (v) { villes[v] = (villes[v] || 0) + 1; if (villes[v] > bn) { bn = villes[v]; best = v; } } });
    r.villePrincipale = best;
    return r;
  }
  // Groupements présents : clientes d'abord, puis prospects ; les n premiers, avec la longueur de barre (0 à 100).
  function lignesGroupements(groupements, n) {
    var l = Object.keys(groupements || {}).map(function (g) { return { nom: g, c: groupements[g].c, p: groupements[g].p }; })
      .sort(function (a, b) { return b.c - a.c || b.p - a.p || (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0); });
    var rest = l.length - (n || l.length); l = l.slice(0, n || l.length);
    var mx = Math.max.apply(null, l.map(function (x) { return x.c + x.p; }).concat([1]));
    l.forEach(function (x) { x.barre = Math.round((x.c + x.p) / mx * 100); });
    return { lignes: l, autres: rest > 0 ? rest : 0 };
  }

  // ── Distance d'un point au tracé d'une tournée de livraison ──
  var KM_DEG = 111.19;
  function preparerTournees(T) {
    var out = [], ts = (T && T.tournees) || {};
    Object.keys(ts).sort().forEach(function (code) {
      var tr = ts[code] && ts[code].trace; if (!Array.isArray(tr) || tr.length < 2) return;
      var pts = tr.filter(function (c) { return c && typeof c[0] === 'number' && typeof c[1] === 'number' && isFinite(c[0]) && isFinite(c[1]); });
      if (pts.length < 2) return;
      // boîte englobante [latMin, lngMin, latMax, lngMax]
      var la = pts.map(function (c) { return c[0]; }), ln = pts.map(function (c) { return c[1]; });
      out.push({ code: code, jours: (ts[code].jours || []), pts: pts, box: [Math.min.apply(null, la), Math.min.apply(null, ln), Math.max.apply(null, la), Math.max.apply(null, ln)] });
    });
    return out;
  }
  function distSegment(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var cx = ax + t * dx, cy = ay + t * dy;
    return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
  }
  // Rend { km, code } (la tournée la plus proche, distance à vol d'oiseau au tracé) ou null si aucune tournée lisible ou position illisible.
  function plusProcheTournee(lat, lng, prep) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng) || !prep || !prep.length) return null;
    var kx = KM_DEG * Math.cos(lat * Math.PI / 180), best = null;
    for (var t = 0; t < prep.length; t++) {
      var T = prep[t], b = T.box;
      // distance minimale à la boîte (borne basse) : inutile de parcourir un tracé déjà plus loin que le meilleur
      var dla = lat < b[0] ? b[0] - lat : lat > b[2] ? lat - b[2] : 0, dln = lng < b[1] ? b[1] - lng : lng > b[3] ? lng - b[3] : 0;
      var bas = Math.sqrt((dla * KM_DEG) * (dla * KM_DEG) + (dln * kx) * (dln * kx));
      if (best && bas >= best.km) continue;
      for (var i = 1; i < T.pts.length; i++) {
        var a = T.pts[i - 1], c = T.pts[i];
        var d = distSegment(0, 0, (a[1] - lng) * kx, (a[0] - lat) * KM_DEG, (c[1] - lng) * kx, (c[0] - lat) * KM_DEG);
        if (!best || d < best.km) best = { km: d, code: T.code, jours: T.jours };
      }
    }
    return best;
  }

  // ── Reprise possible : repère de l'annuaire (un dirigeant de 62 ans ou plus) ET titulaire seul. Jamais une certitude. ──
  // info = ligne d'officines-infos : [5] dirigeants (« A / B » s'il y en a plusieurs) · [9] 'R' = un dirigeant a 62 ans ou plus
  // · [13] « titulaires|adjoints » (RPPS, quand il est connu).
  function repriseDe(info) {
    if (!info || info[9] !== 'R') return false;
    var dir = String(info[5] || '').split(' / ').filter(function (x) { return x.trim(); });
    if (dir.length > 1) return false;
    var rp = String(info[13] || '');
    if (rp) { var t = parseInt(rp.split('|')[0], 10); if (!isNaN(t) && t > 1) return false; }
    return true;
  }

  // ── Les pistes : prospects classés par ce qu'ils cumulent, chacun avec une ligne « pourquoi » en clair ──
  // Points : sur une tournée (à 10 km ou moins du tracé) 3 · groupement qui a déjà des clientes chez ce commercial 2 · reprise possible 2.
  // grpCli = { groupement: nombre de clientes de ce commercial } (sur son secteur entier). Rien à 0 point n'est une piste.
  function raisonsDe(p, ctx, grpCli) {
    var r = [], t = ctx.kmTournee ? ctx.kmTournee(p) : null, g = nomGroupement(p, ctx);
    if (t && typeof t.km === 'number' && t.km <= KM_TOURNEE) {
      r.push({ k: 'tournee', pts: 3, km: t.km, code: t.code, court: 'sur la tournée ' + t.code + ', à ' + nombre(t.km, 1) + NB + 'km',
        t: 'Sur la tournée ' + t.code + ' : à ' + nombre(t.km, 1) + NB + 'km du tracé (distance à vol d’oiseau).' });
    }
    var nc = g && grpCli ? (grpCli[g] || 0) : 0;
    if (nc > 0) r.push({ k: 'groupement', pts: 2, n: nc, court: g + ' : ' + nc + ' ' + plur(nc, 'cliente', 'clientes'),
      t: g + ' compte déjà ' + nc + ' ' + plur(nc, 'cliente', 'clientes') + ' dans le secteur.' });
    if (repriseDe(ctx.info ? ctx.info(p) : null)) r.push({ k: 'reprise', pts: 2, court: 'reprise possible',
      t: 'Titulaire de 62 ans ou plus et seul à la direction : une reprise est possible (repère, pas une certitude).' });
    return r;
  }
  function pistes(indices, nom, ctx, grpCli, max) {
    var out = [];
    indices.forEach(function (i) {
      var p = ctx.pts[i]; if (ctx.isClient(p)) return;
      var r = raisonsDe(p, ctx, grpCli), s = 0; r.forEach(function (x) { s += x.pts; });
      if (s <= 0) return;
      var t = ctx.kmTournee ? ctx.kmTournee(p) : null;
      out.push({ i: i, score: s, raisons: r, km: t && isFinite(t.km) ? t.km : Infinity });
    });
    out.sort(function (a, b) { return b.score - a.score || a.km - b.km || (String(ctx.pts[a.i][6]) < String(ctx.pts[b.i][6]) ? -1 : 1); });
    return out.slice(0, max || 5);
  }
  function clientesParGroupement(indices, nom, ctx) {
    var m = {};
    indices.forEach(function (i) { var p = ctx.pts[i], g = nomGroupement(p, ctx); if (g && moi(p, nom, ctx)) m[g] = (m[g] || 0) + 1; });
    return m;
  }

  // ── Autour d'un point : enveloppe approchée d'un groupe de points, élargie de margeKm (UGA sans contour officiel) ──
  function enveloppe(points, margeKm) {
    var P = (points || []).filter(function (q) { return q && isFinite(q[0]) && isFinite(q[1]); });
    if (!P.length) return [];
    var u = {}; P = P.filter(function (q) { var k = q[0] + ',' + q[1]; if (u[k]) return false; u[k] = 1; return true; });
    P.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });   // [lat, lng] triés par lng puis lat
    var cx = 0, cy = 0; P.forEach(function (q) { cx += q[1]; cy += q[0]; }); cx /= P.length; cy /= P.length;
    var m = margeKm || 0, hull;
    if (P.length < 3) hull = P.slice();
    else {
      var cross = function (o, a, b) { return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]); };
      var low = [], up = [], i;
      for (i = 0; i < P.length; i++) { while (low.length >= 2 && cross(low[low.length - 2], low[low.length - 1], P[i]) <= 0) low.pop(); low.push(P[i]); }
      for (i = P.length - 1; i >= 0; i--) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], P[i]) <= 0) up.pop(); up.push(P[i]); }
      low.pop(); up.pop(); hull = low.concat(up);
    }
    // chaque sommet est repoussé du centre de margeKm (autour d'une seule officine : un petit octogone)
    if (hull.length < 3) {
      var c = hull[0], out = [];
      for (var a = 0; a < 8; a++) { var ang = a * Math.PI / 4; out.push([c[0] + Math.sin(ang) * m / KM_DEG, c[1] + Math.cos(ang) * m / (KM_DEG * Math.cos(c[0] * Math.PI / 180))]); }
      return out;
    }
    return hull.map(function (q) {
      var dx = (q[1] - cx) * KM_DEG * Math.cos(cy * Math.PI / 180), dy = (q[0] - cy) * KM_DEG, d = Math.sqrt(dx * dx + dy * dy) || 1;
      return [q[0] + dy / d * m / KM_DEG, q[1] + dx / d * m / (KM_DEG * Math.cos(cy * Math.PI / 180))];
    });
  }

  // ── Géométrie : point dans un anneau [[lon, lat], ...] (contour d'UGA ou de zone d'étude) ──
  function dansAnneau(lat, lon, ring) {
    var ok = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) ok = !ok;
    }
    return ok;
  }
  // Polygone d'UGA : poly = [anneau extérieur, ...trous] (chaque anneau [[lon, lat], ...]) ; trou = hors du polygone.
  function dansPolygone(lat, lon, poly) {
    if (!poly || !poly.length || !dansAnneau(lat, lon, poly[0])) return false;
    for (var h = 1; h < poly.length; h++) if (dansAnneau(lat, lon, poly[h])) return false;
    return true;
  }
  function dansContour(lat, lon, polys) { for (var k = 0; k < (polys || []).length; k++) if (dansPolygone(lat, lon, polys[k])) return true; return false; }
  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371.0088, r = Math.PI / 180, dp = (lat2 - lat1) * r, dl = (lon2 - lon1) * r;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ── Étude de zone : nos clientes dans les zones à 5, 10 et 15 minutes ──
  // D = l'étude (format Phirst : D.pharmacie {lat, lon}, D.zones { 5|10|15: { contour: [[lon, lat], ...] } }).
  // clientes = [{ id, lat, lng, nom, ville, palier, ca }]  (ca = null quand non lu OU non visible par ce compte).
  // Une cliente est rangée dans la PLUS PETITE zone qui la contient ; nb[k] = clientes à k minutes ou moins ; ca[k] = somme des CA lus
  // (null s'il n'y en a aucun de lu : jamais un faux zéro). idExclu = l'officine étudiée elle-même.
  function clientesDansZones(D, clientes, idExclu) {
    var P = (D && D.pharmacie) || {}, Z = (D && D.zones) || {}, res = { liste: [], nb: { 5: 0, 10: 0, 15: 0 }, ca: { 5: null, 10: null, 15: null }, sansCa: 0 };
    var contours = {};
    [5, 10, 15].forEach(function (k) { var z = Z[k] || Z[String(k)]; if (z && z.contour && z.contour.length > 2) contours[k] = z.contour; });
    (clientes || []).forEach(function (c) {
      if (idExclu != null && String(c.id) === String(idExclu)) return;
      var zone = null;
      [5, 10, 15].forEach(function (k) { if (zone === null && contours[k] && dansAnneau(c.lat, c.lng, contours[k])) zone = k; });
      if (zone === null) return;
      var km = (typeof P.lat === 'number' && typeof P.lon === 'number') ? haversine(P.lat, P.lon, c.lat, c.lng) : null;
      res.liste.push({ c: c, zone: zone, km: km });
      [5, 10, 15].forEach(function (k) {
        if (zone <= k) { res.nb[k]++; if (typeof c.ca === 'number' && isFinite(c.ca)) res.ca[k] = (res.ca[k] || 0) + c.ca; }
      });
      if (!(typeof c.ca === 'number' && isFinite(c.ca))) res.sansCa++;
    });
    res.liste.sort(function (a, b) { return (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km); });
    res.contoursPresents = Object.keys(contours).length;
    return res;
  }

  return {
    KM_TOURNEE: KM_TOURNEE, APLATS: APLATS, NB: NB,
    nombre: nombre, plur: plur, moisNom: moisNom, classeAplat: classeAplat,
    secteurDe: secteurDe, dansSecteur: dansSecteur, indicesDuSecteur: indicesDuSecteur, indicesDeUga: indicesDeUga,
    mesurer: mesurer, evolution: evolution, chiffresSecteur: chiffresSecteur, portraitUga: portraitUga, lignesGroupements: lignesGroupements,
    preparerTournees: preparerTournees, plusProcheTournee: plusProcheTournee,
    repriseDe: repriseDe, raisonsDe: raisonsDe, pistes: pistes, clientesParGroupement: clientesParGroupement,
    enveloppe: enveloppe, dansAnneau: dansAnneau, dansPolygone: dansPolygone, dansContour: dansContour, haversine: haversine,
    clientesDansZones: clientesDansZones
  };
});
