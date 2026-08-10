/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Moteur de créneaux de rendez-vous (V2RDV)
   Règle « aimant » : le premier RDV posé fixe la zone du jour, les
   officines voisines viennent s'y greffer, les lointaines sont écartées.
   Fichier PUR : aucun DOM, aucun réseau, aucun V2.*. Il tourne aussi
   bien dans le navigateur que sous `node --test`.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  M.DEFAUT_DISPO = {
    jours: {
      '1': [['09:00', '12:30'], ['14:00', '18:00']],
      '2': [['09:00', '12:30'], ['14:00', '18:00']],
      '3': [['09:00', '12:30'], ['14:00', '18:00']],
      '4': [['09:00', '12:30'], ['14:00', '18:00']],
      '5': [['09:00', '12:30'], ['14:00', '18:00']]
    },
    duree_min: 45, marge_route_min: 15, horizon_jours: 21, delai_min_jours: 3,
    rayon_chaud_km: 25, rayon_max_km: 60, vitesse_kmh: 50, coef_route: 1.3
  };

  var PAS = 15;          // granularité des créneaux, en minutes
  var ECART_MIN = 60;    // écart souhaité entre deux créneaux proposés le même jour
  var MIDI = 12 * 60;

  function hm2min(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function min2hm(m) {
    var h = Math.floor(m / 60), x = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (x < 10 ? '0' : '') + x;
  }
  function isoPlus(iso, n) {
    var p = String(iso).split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function jourSemaine(iso) {
    var p = String(iso).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();   // 0 = dimanche
  }
  function fusionner(dispo) {
    var out = {}, k;
    for (k in M.DEFAUT_DISPO) if (M.DEFAUT_DISPO.hasOwnProperty(k)) out[k] = M.DEFAUT_DISPO[k];
    if (dispo) for (k in dispo) if (dispo.hasOwnProperty(k) && dispo[k] != null) out[k] = dispo[k];
    return out;
  }

  // Distance à vol d'oiseau (haversine) majorée du coefficient route. null si une
  // coordonnée manque — l'appelant doit traiter ce cas, jamais le confondre avec 0.
  M.distanceKm = function (a, b, coef) {
    if (!a || !b || a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s))) * (coef == null ? 1.3 : coef);
  };

  M.trajetMin = function (km, dispo) {
    var d = fusionner(dispo);
    return Math.round(km / d.vitesse_kmh * 60) + d.marge_route_min;
  };

  // Toutes les heures de début possibles d'une journée, en minutes depuis minuit.
  M.grille = function (plages, dureeMin) {
    var out = [];
    (plages || []).forEach(function (p) {
      var deb = hm2min(p[0]), fin = hm2min(p[1]);
      for (var t = deb; t + dureeMin <= fin; t += PAS) out.push(t);
    });
    return out;
  };

  // Un créneau est libre s'il ne chevauche aucun RDV du jour, temps de route compris.
  M.libres = function (occupesDuJour, officine, dispo, plages) {
    var d = fusionner(dispo), duree = d.duree_min;
    var occ = occupesDuJour || [];
    return M.grille(plages, duree).filter(function (t) {
      for (var i = 0; i < occ.length; i++) {
        var o = occ[i], ot = hm2min(o.heure), od = o.duree_min || duree;
        var km = M.distanceKm(officine, o, d.coef_route);
        var tr = km == null ? d.marge_route_min : M.trajetMin(km, d);
        if (!(t + duree + tr <= ot || ot + od + tr <= t)) return false;
      }
      return true;
    });
  };

  // Note une journée : 0 = prioritaire (voisin proche), 1 = possible, 2 = journée
  // encore vide. null = jour écarté (trop loin, ou plus aucun créneau libre).
  M.jour = function (dateISO, occupesDuJour, officine, dispo, plages) {
    var d = fusionner(dispo);
    var libres = M.libres(occupesDuJour, officine, d, plages);
    if (!libres.length) return null;
    var occ = occupesDuJour || [];
    if (!occ.length) return { date: dateISO, score: 2, creneaux: libres };

    var dmin = null, proche = null;
    occ.forEach(function (o) {
      var km = M.distanceKm(officine, o, d.coef_route);
      if (km == null) return;
      if (dmin == null || km < dmin) { dmin = km; proche = o; }
    });
    // Officine sans coordonnées, ou RDV du jour sans coordonnées : pas d'aimant,
    // mais surtout pas d'exclusion.
    if (dmin == null) return { date: dateISO, score: 2, creneaux: libres };
    if (dmin > d.rayon_max_km) return null;

    if (dmin <= d.rayon_chaud_km) {
      var ot = hm2min(proche.heure);
      libres.sort(function (a, b) { return Math.abs(a - ot) - Math.abs(b - ot); });
      return { date: dateISO, score: 0, creneaux: libres };
    }
    var matin = hm2min(proche.heure) < MIDI;
    var meme = libres.filter(function (t) { return (t < MIDI) === matin; });
    if (!meme.length) return null;
    return { date: dateISO, score: 1, creneaux: meme };
  };

  // Retire les plages couvertes par un blocage de demi-journée.
  function plagesDuJour(dateISO, dispo, blocages) {
    var d = fusionner(dispo);
    var plages = d.jours[String(jourSemaine(dateISO))];
    if (!plages || !plages.length) return null;
    var bl = (blocages || []).filter(function (b) { return b.date === dateISO; });
    for (var i = 0; i < bl.length; i++) {
      if (bl[i].moment === 'journee') return null;
      if (bl[i].moment === 'matin') plages = plages.filter(function (p) { return hm2min(p[0]) >= MIDI; });
      if (bl[i].moment === 'apres_midi') plages = plages.filter(function (p) { return hm2min(p[0]) < MIDI; });
    }
    return plages.length ? plages : null;
  }

  // Garde au plus `max` créneaux, en préférant les espacer d'au moins une heure.
  function espacer(creneaux, max) {
    var gardes = [];
    creneaux.forEach(function (t) {
      if (gardes.length >= max) return;
      var ok = gardes.every(function (g) { return Math.abs(g - t) >= ECART_MIN; });
      if (ok) gardes.push(t);
    });
    creneaux.forEach(function (t) {                     // complète si l'écart était trop exigeant
      if (gardes.length >= max) return;
      if (gardes.indexOf(t) === -1) gardes.push(t);
    });
    return gardes.sort(function (a, b) { return a - b; });
  }

  M.proposer = function (p) {
    var d = fusionner(p && p.dispo);
    var officine = (p && p.officine) || {};
    var occupes = (p && p.occupes) || [];
    var blocages = (p && p.blocages) || [];
    var aujourdhui = (p && p.aujourdhui) || new Date().toISOString().slice(0, 10);

    var parDate = {};
    occupes.forEach(function (o) {
      if (!o || !o.date) return;
      (parDate[o.date] = parDate[o.date] || []).push(o);
    });

    var jours = [];
    for (var i = d.delai_min_jours; i <= d.horizon_jours; i++) {
      var iso = isoPlus(aujourdhui, i);
      var plages = plagesDuJour(iso, d, blocages);
      if (!plages) continue;
      var j = M.jour(iso, parDate[iso] || [], officine, d, plages);
      if (j) jours.push(j);
    }

    jours.sort(function (a, b) { return a.score - b.score || (a.date < b.date ? -1 : 1); });

    return jours.slice(0, 3).map(function (j) {
      return {
        date: j.date,
        score: j.score,
        creneaux: espacer(j.creneaux, 3).map(min2hm)
      };
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  M._min2hm = min2hm;
  M._hm2min = hm2min;

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2RDV = M;
})(typeof window !== 'undefined' ? window : this);
