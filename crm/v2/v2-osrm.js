/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Routage routier réel (V2.osrmRoute / V2.osrmMatrix)
   Trajet voiture réel via OSRM public (router.project-osrm.org) —
   GRATUIT, sans clé. Timeout 6s (AbortController). Repli automatique
   haversine (vol d'oiseau × 1.3, 50 km/h) si OSRM échoue/timeout/erreur.
   NE REJETTE JAMAIS : cb reçoit toujours un result exploitable.
     V2.osrmRoute(points, cb)  points=[[lat,lng],...] déjà ordonnés
       → cb({ ok, legsSec, legsM, totalSec, totalM, geometry:[[lat,lng]], source })
     V2.osrmMatrix(points, cb) → cb({ ok, durations:[[sec]], source })
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  var BASE = 'https://router.project-osrm.org';
  var TIMEOUT = 6000;         // ms
  var ROUTE_FACTOR = 1.3;     // vol d'oiseau → route (repli)
  var SPEED_KMH = 50;         // vitesse moyenne repli

  // Distance à vol d'oiseau entre deux points [lat,lng], en km.
  function haversine(a, b) {
    if (!a || !b) return 0;
    var R = 6371;
    var toRad = Math.PI / 180;
    var lat1 = a[0] * toRad, lat2 = b[0] * toRad;
    var dLat = (b[0] - a[0]) * toRad;
    var dLng = (b[1] - a[1]) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  // fetch avec timeout via AbortController ; cb(err, json).
  function fetchJSON(url, cb) {
    var done = false;
    var ctrl = null, timer = null;
    try { ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null; } catch (e) { ctrl = null; }
    function finish(err, json) {
      if (done) return;
      done = true;
      if (timer) { clearTimeout(timer); timer = null; }
      cb(err, json);
    }
    try {
      timer = setTimeout(function () {
        try { if (ctrl) ctrl.abort(); } catch (e) {}
        finish(new Error('timeout'), null);
      }, TIMEOUT);
      var opts = ctrl ? { signal: ctrl.signal } : {};
      fetch(url, opts).then(function (r) {
        if (!r || !r.ok) throw new Error('http ' + (r ? r.status : '?'));
        return r.json();
      }).then(function (json) {
        finish(null, json);
      })['catch'](function (err) {
        finish(err || new Error('fetch'), null);
      });
    } catch (e) {
      finish(e, null);
    }
  }

  // "{lng},{lat};{lng},{lat};..." attendu par OSRM.
  function coordString(points) {
    var parts = [];
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      parts.push(p[1] + ',' + p[0]);
    }
    return parts.join(';');
  }

  // ── Repli haversine : trajet ordonné → même structure que OSRM ──────
  function fallbackRoute(points) {
    var legsSec = [], legsM = [], totalSec = 0, totalM = 0;
    for (var i = 0; i < points.length - 1; i++) {
      var km = haversine(points[i], points[i + 1]) * ROUTE_FACTOR;
      var m = km * 1000;
      var sec = (km / SPEED_KMH) * 3600;
      legsM.push(m);
      legsSec.push(sec);
      totalM += m;
      totalSec += sec;
    }
    var geo = [];
    for (var j = 0; j < points.length; j++) geo.push([points[j][0], points[j][1]]);
    return {
      ok: true, legsSec: legsSec, legsM: legsM,
      totalSec: totalSec, totalM: totalM,
      geometry: geo, source: 'fallback'
    };
  }

  // ── Repli haversine : matrice des durées (sec) entre tous les points ─
  function fallbackMatrix(points) {
    var n = points.length, durations = [];
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        if (i === j) { row.push(0); continue; }
        var km = haversine(points[i], points[j]) * ROUTE_FACTOR;
        row.push((km / SPEED_KMH) * 3600);
      }
      durations.push(row);
    }
    return { ok: true, durations: durations, source: 'fallback' };
  }

  // ── V2.osrmRoute ────────────────────────────────────────────────────
  V2.osrmRoute = function (points, cb) {
    cb = cb || function () {};
    if (!points || points.length < 2) {
      cb({ ok: true, legsSec: [], legsM: [], totalSec: 0, totalM: 0,
           geometry: (points || []).slice(), source: 'fallback' });
      return;
    }
    var url = BASE + '/route/v1/driving/' + coordString(points) +
              '?overview=full&geometries=geojson';
    fetchJSON(url, function (err, json) {
      if (err || !json || json.code !== 'Ok' || !json.routes || !json.routes.length) {
        cb(fallbackRoute(points));
        return;
      }
      try {
        var route = json.routes[0];
        var legsSec = [], legsM = [];
        var legs = route.legs || [];
        for (var i = 0; i < legs.length; i++) {
          legsSec.push(legs[i].duration || 0);
          legsM.push(legs[i].distance || 0);
        }
        var geo = [];
        var coords = (route.geometry && route.geometry.coordinates) || [];
        for (var j = 0; j < coords.length; j++) {
          geo.push([coords[j][1], coords[j][0]]);   // GeoJSON [lng,lat] → [lat,lng]
        }
        if (!geo.length) {
          for (var k = 0; k < points.length; k++) geo.push([points[k][0], points[k][1]]);
        }
        cb({
          ok: true, legsSec: legsSec, legsM: legsM,
          totalSec: route.duration || 0, totalM: route.distance || 0,
          geometry: geo, source: 'osrm'
        });
      } catch (e) {
        cb(fallbackRoute(points));
      }
    });
  };

  // ── V2.osrmMatrix ───────────────────────────────────────────────────
  V2.osrmMatrix = function (points, cb) {
    cb = cb || function () {};
    if (!points || points.length < 2) {
      cb(fallbackMatrix(points || []));
      return;
    }
    var url = BASE + '/table/v1/driving/' + coordString(points) +
              '?annotations=duration';
    fetchJSON(url, function (err, json) {
      if (err || !json || json.code !== 'Ok' || !json.durations || !json.durations.length) {
        cb(fallbackMatrix(points));
        return;
      }
      try {
        var raw = json.durations, durations = [];
        for (var i = 0; i < raw.length; i++) {
          var row = [];
          for (var j = 0; j < raw[i].length; j++) {
            var v = raw[i][j];
            row.push((v == null) ? fallbackMatrix([points[i], points[j]]).durations[0][1] : v);
          }
          durations.push(row);
        }
        cb({ ok: true, durations: durations, source: 'osrm' });
      } catch (e) {
        cb(fallbackMatrix(points));
      }
    });
  };

})();
