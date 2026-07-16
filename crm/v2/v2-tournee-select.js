/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Moteur de sélection des prospects pour une tournée
   (V2.tourneeSelect) — logique PURE, aucune UI.

   Choisit, parmi les PROSPECTS de window.PHARMA_FR, ceux à visiter
   autour d'une destination : rayon géographique + priorité métier
   (jamais visités d'abord, puis les plus anciennement visités, puis
   les plus proches de la destination). L'ordre routier (qui passer en
   1er sur la route) est calculé AILLEURS — ici l'ordre n'est pas garanti.

   API :
     V2.tourneeSelect(opts) -> [idx, ...]  (indices dans PHARMA_FR.p)
       opts = { destLat, destLng, radiusKm=25, maxStops=8,
                homeLat, homeLng }
     V2.tourneeSelectScore(idx, opts) -> nombre (plus grand = + prioritaire)

   Dépendances douces : V2.visite.last(pharmacyId) si présent (sinon
   tous les prospects sont considérés « jamais visités »).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  var DEF_RADIUS = 25;   // km autour de la destination
  var DEF_MAX = 8;       // arrêts max sur la tournée
  var MAX_EXPAND = 2;    // on peut élargir le rayon jusqu'à ×2 si trop peu de prospects

  // ── Distance grand-cercle (km) ────────────────────────────────────
  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a1 = lat1 * Math.PI / 180, a2 = lat2 * Math.PI / 180;
    var s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
    var a = s1 * s1 + Math.cos(a1) * Math.cos(a2) * s2 * s2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function data() { return window.PHARMA_FR || null; }

  function isProspect(D, p) {
    return (D.seg[p[4]] || '') === 'Prospect';
  }

  // Identifiant pharmacie pour l'historique de visite (id stable, repli idx)
  function pharmacyId(D, idx) {
    var p = D.p[idx];
    return (p[13] != null && p[13] !== '') ? p[13] : idx;
  }

  // ── Normalise ce que renvoie V2.visite.last(id) en timestamp ms ────
  // (accepte Date, nombre ms, chaîne ISO, ou un objet { date/at/ts/... }).
  // null / non-visité => null.
  function lastVisitTs(D, idx) {
    if (!(V2.visite && typeof V2.visite.last === 'function')) return null;
    var raw;
    try { raw = V2.visite.last(pharmacyId(D, idx)); } catch (e) { return null; }
    return toTs(raw);
  }

  function toTs(raw) {
    if (raw == null) return null;
    if (typeof raw === 'number') return isFinite(raw) ? raw : null;
    if (raw instanceof Date) { var t0 = raw.getTime(); return isNaN(t0) ? null : t0; }
    if (typeof raw === 'object') {
      var cand = raw.date != null ? raw.date
        : (raw.at != null ? raw.at
          : (raw.ts != null ? raw.ts
            : (raw.last != null ? raw.last
              : (raw.created != null ? raw.created : null))));
      return toTs(cand);
    }
    var t = new Date(raw).getTime();
    return isNaN(t) ? null : t;
  }

  // Rayon effectif : garde les prospects sous radius ; si trop peu par
  // rapport à maxStops, on élargit progressivement jusqu'à ×MAX_EXPAND.
  function withinRadius(D, prospects, destLat, destLng, radiusKm, need) {
    var kept = [];
    var scale = 1;
    while (scale <= MAX_EXPAND + 1e-9) {
      var lim = radiusKm * scale;
      kept = [];
      for (var i = 0; i < prospects.length; i++) {
        if (prospects[i].dist <= lim) kept.push(prospects[i]);
      }
      if (kept.length >= need || scale >= MAX_EXPAND) break;
      scale += 0.5;
    }
    return kept;
  }

  // Score de priorité (plus grand = plus prioritaire) :
  //   1) jamais visité domine (traité comme « infiniment ancien »)
  //   2) sinon, visité le plus ancien d'abord (ancienneté en jours)
  //   3) proximité de la destination (léger, départage à égalité)
  var NEVER = 1e9;        // « âge » attribué à un prospect jamais visité (jours)
  var AGE_W = 1000;       // poids de l'ancienneté vs la distance

  function priorityScore(ageDays, distKm) {
    return ageDays * AGE_W - (distKm || 0);
  }

  // Âge en jours depuis la dernière visite (NEVER si jamais visité).
  function ageDaysOf(ts, now) {
    if (ts == null) return NEVER;
    var d = (now - ts) / 86400000;
    return d < 0 ? 0 : d;   // visite « dans le futur » (horloge) => 0
  }

  // ── Score public (utile pour tri/inspection externe) ──────────────
  V2.tourneeSelectScore = function (idx, opts) {
    var D = data();
    if (!D || !D.p || !D.p[idx]) return -Infinity;
    opts = opts || {};
    var p = D.p[idx];
    var now = Date.now();
    var dist = (opts.destLat != null && opts.destLng != null)
      ? haversine(p[0], p[1], opts.destLat, opts.destLng)
      : 0;
    return priorityScore(ageDaysOf(lastVisitTs(D, idx), now), dist);
  };

  // ── Sélection principale ──────────────────────────────────────────
  V2.tourneeSelect = function (opts) {
    opts = opts || {};
    var D = data();
    if (!D || !D.p || !D.p.length) return [];
    if (opts.destLat == null || opts.destLng == null) return [];

    var radiusKm = opts.radiusKm != null ? opts.radiusKm : DEF_RADIUS;
    var maxStops = opts.maxStops != null ? opts.maxStops : DEF_MAX;
    if (maxStops <= 0) return [];

    var now = Date.now();

    // 1) Prospects géolocalisés + distance à la destination
    var prospects = [];
    for (var i = 0; i < D.p.length; i++) {
      var p = D.p[i];
      if (!p || !isProspect(D, p)) continue;
      var lat = p[0], lng = p[1];
      if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) continue;
      prospects.push({ idx: i, dist: haversine(lat, lng, opts.destLat, opts.destLng) });
    }
    if (!prospects.length) return [];

    // 2) Filtre rayon (élargi si trop peu vs maxStops)
    var kept = withinRadius(D, prospects, opts.destLat, opts.destLng, radiusKm, maxStops);
    if (!kept.length) return [];

    // 3) Score de priorité + tri décroissant
    for (var k = 0; k < kept.length; k++) {
      var ts = lastVisitTs(D, kept[k].idx);
      kept[k].score = priorityScore(ageDaysOf(ts, now), kept[k].dist);
    }
    kept.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.dist - b.dist;   // départage final : le plus proche
    });

    // 4) Top maxStops → indices bruts
    var out = [];
    for (var m = 0; m < kept.length && out.length < maxStops; m++) {
      out.push(kept[m].idx);
    }
    return out;
  };

  // Exposé pour d'éventuels tests/outils (facultatif)
  V2.tourneeHaversine = haversine;
})();
