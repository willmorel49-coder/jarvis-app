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
    // horizon_jours : jusqu'où le pharmacien peut réserver. 21 → 90 → 180 le
    // 13/08/2026. Trois semaines ne laissaient aucune marge à une officine
    // indisponible tout de suite ; six mois, c'est l'horizon d'un vrai agenda
    // commercial — on cale une visite de rentrée dès juin.
    //
    // ⚠️ CETTE VALEUR VIT À QUATRE ENDROITS, et n'en changer qu'une partie
    // donne le pire des défauts : une date affichée, choisie, puis refusée.
    // Le repli ci-dessous · la colonne rdv_dispo.horizon_jours (qui ÉCRASE ce
    // repli) · le coalesce EN DUR de rdv_poser et rdv_poser_public · le
    // default de la table. Voir docs/supabase/rdv-horizon-6-mois.sql.
    //
    // Les trois propositions mises en avant restent les mêmes (les plus
    // proches, calées sur la géographie du jour) ; c'est le calendrier qui
    // ouvre les six mois.
    duree_min: 45, marge_route_min: 15, horizon_jours: 180, delai_min_jours: 3,
    rayon_chaud_km: 25, rayon_max_km: 60, vitesse_kmh: 50, coef_route: 1.3,
    // D'où le commercial part le matin et où il rentre le soir : {lat, lon}.
    // null = on ne sait pas, et on ne suppose rien (aucun créneau n'est écarté).
    depart: null
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

  // ═══════════════════════════════════════════════════════════════
  //  LE SECTEUR DU JOUR (19/08/2026)
  // ═══════════════════════════════════════════════════════════════
  // Jusqu'ici, la géographie d'une journée n'existait qu'À PARTIR du premier
  // rendez-vous posé — la règle « aimant ». Une journée encore vide n'avait
  // pour seule limite que le temps de route depuis le point de départ : le
  // mardi où le commercial sait qu'il sera dans le 44, une officine du 61
  // pouvait réserver, et c'est lui qui découvrait le problème après coup.
  //
  // Il déclare donc, jour par jour, les départements où il sera. Le moteur
  // écarte alors les journées qui ne correspondent pas — avant même de
  // regarder les heures.
  //
  // ⚠️ TROIS PRUDENCES, chacune pour ne jamais fermer un calendrier par erreur.
  //   1. Un jour NON DÉCLARÉ n'a aucune contrainte. Déclarer un mardi ne
  //      ferme pas les lundis : sinon, une seule déclaration viderait six mois
  //      d'agenda sans que personne comprenne pourquoi.
  //   2. Une déclaration VIDE ne ferme rien non plus. Effacer les
  //      départements d'un jour, c'est retirer la contrainte, pas se rendre
  //      injoignable.
  //   3. Un code postal INCONNU passe. Dans le doute on garde et on signale —
  //      un contrôle qui n'aboutit pas ne condamne jamais.
  //
  // Corse : « 2A » et « 2B » se ramènent à « 20 », qui est ce que porte le code
  // postal. Outre-mer : trois chiffres (971…976, 984…988).
  M.departement = function (v) {
    var t = String(v == null ? '' : v).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    if (t.length < 2) return '';
    if (t.charAt(0) === '2' && (t.charAt(1) === 'A' || t.charAt(1) === 'B')) return '20';
    var deux = t.slice(0, 2);
    if (t.length >= 3 && (deux === '97' || deux === '98')) return t.slice(0, 3);
    return deux;
  };

  M.secteurOk = function (dateISO, officine, secteurs) {
    var liste = secteurs || [], i, decl = null;
    for (i = 0; i < liste.length; i++) {
      if (liste[i] && liste[i].date === dateISO) { decl = liste[i]; break; }
    }
    if (!decl) return true;                                    // prudence 1
    var deps = [];
    (decl.departements || []).forEach(function (x) {
      var d = M.departement(x);
      if (d && deps.indexOf(d) === -1) deps.push(d);
    });
    if (!deps.length) return true;                             // prudence 2
    var o = officine || {};
    var mien = M.departement(o.cp != null && o.cp !== '' ? o.cp : o.dept);
    if (!mien) return true;                                    // prudence 3
    return deps.indexOf(mien) !== -1;
  };

  // ═══════════════════════════════════════════════════════════════
  //  LES JOURNÉES OUVERTES À LA RÉSERVATION (25/08/2026)
  // ═══════════════════════════════════════════════════════════════
  // Will : « on doit pouvoir choisir de donner accès à la prise de rdv que
  // aux jours où il y a 0 rdv », puis « je veux décider jour par jour ».
  //
  // ⚠️ Cette fonction DOIT rendre le même verdict que `rdv_jour_ouvert()` en
  // base. Le serveur seul fait foi — ici on ne fait qu'éviter d'afficher un
  // créneau qui serait refusé au clic. Deux chemins qui décident la même
  // chose finissent par décider différemment : si l'un des deux change, c'est
  // l'autre qu'il faut corriger, pas contourner.
  //
  // Les mêmes prudences qu'ailleurs :
  //   1. mode normal (défaut) : une journée sans avis reste OUVERTE ;
  //   2. `ouvert === false` ferme une journée ponctuellement ;
  //   3. mode « je choisis mes jours » : il faut un oui explicite.
  M.jourOuvert = function (dateISO, secteurs, joursChoisis) {
    var liste = secteurs || [], decl = null, i;
    for (i = 0; i < liste.length; i++) {
      if (liste[i] && liste[i].date === dateISO) { decl = liste[i]; break; }
    }
    var avis = decl ? decl.ouvert : null;
    if (joursChoisis) return avis === true;
    return avis !== false;
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
  //
  // Et — depuis le 12/08 — s'il est ATTEIGNABLE depuis le point de départ du
  // commercial. Sans ça, une journée encore vide proposait 9 h à Brest à
  // quelqu'un qui part de Nantes : trois heures de route qui n'existaient nulle
  // part dans le calcul. La contrainte ne s'applique qu'au PREMIER rendez-vous
  // de la journée ; dès qu'un autre le précède, le commercial est déjà sur la
  // route et c'est le chaînage entre RDV qui reprend la main.
  M.libres = function (occupesDuJour, officine, dispo, plages) {
    var d = fusionner(dispo), duree = d.duree_min;
    var occ = occupesDuJour || [];
    var pl = plages || [];

    var tAller = null, tRetour = null;
    if (d.depart && pl.length) {
      var km0 = M.distanceKm(officine, d.depart, d.coef_route);
      if (km0 != null) {
        var route = M.trajetMin(km0, d);
        var ouverture = hm2min(pl[0][0]);
        var fermeture = hm2min(pl[pl.length - 1][1]);
        tAller = ouverture + route;              // au plus tôt sur place
        tRetour = fermeture - route;             // dernier départ tenable
      }
    }

    return M.grille(plages, duree).filter(function (t) {
      var precede = false;
      for (var i = 0; i < occ.length; i++) {
        var o = occ[i], ot = hm2min(o.heure), od = o.duree_min || duree;
        var km = M.distanceKm(officine, o, d.coef_route);
        var tr = km == null ? d.marge_route_min : M.trajetMin(km, d);
        if (!(t + duree + tr <= ot || ot + od + tr <= t)) return false;
        if (ot + od <= t) precede = true;        // un RDV le précède déjà ce jour-là
      }
      if (tAller != null && !precede) {
        if (t < tAller) return false;              // il ne peut pas être là si tôt
        if (t + duree > tRetour) return false;     // il finirait après sa journée
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

  // Retire un intervalle d'une liste de plages. Une réunion au milieu de
  // l'après-midi coupe la plage en deux ; elle ne la supprime pas.
  function soustraire(plages, deb, fin) {
    var out = [];
    for (var i = 0; i < plages.length; i++) {
      var a = hm2min(plages[i][0]), b = hm2min(plages[i][1]);
      if (fin <= a || deb >= b) { out.push(plages[i]); continue; }   // aucun contact
      if (deb > a) out.push([min2hm(a), min2hm(deb)]);               // le bout d'avant
      if (fin < b) out.push([min2hm(fin), min2hm(b)]);               // le bout d'après
    }
    return out;
  }

  // Retire les demi-journées bloquées à la main, PUIS les heures déjà prises
  // dans l'agenda personnel du commercial.
  //
  // Pourquoi ici et pas dans la liste des rendez-vous : une plage d'agenda
  // n'a pas de coordonnées. La traiter comme un RDV ferait croire au moteur
  // qu'un voisin est posé ce jour-là et orienterait toute la zone de la
  // journée sur un déjeuner. Ici, elle ne fait que fermer des heures.
  function plagesDuJour(dateISO, dispo, blocages, agenda) {
    var d = fusionner(dispo);
    var plages = d.jours[String(jourSemaine(dateISO))];
    if (!plages || !plages.length) return null;
    var bl = (blocages || []).filter(function (b) { return b.date === dateISO; });
    for (var i = 0; i < bl.length; i++) {
      if (bl[i].moment === 'journee') return null;
      if (bl[i].moment === 'matin') plages = plages.filter(function (p) { return hm2min(p[0]) >= MIDI; });
      if (bl[i].moment === 'apres_midi') plages = plages.filter(function (p) { return hm2min(p[0]) < MIDI; });
    }
    var ag = (agenda || []).filter(function (o) { return o && o.date === dateISO; });
    for (var j = 0; j < ag.length && plages.length; j++) {
      var deb = hm2min(ag[j].debut), fin = hm2min(ag[j].fin);
      if (deb == null || fin == null || fin <= deb) continue;
      plages = soustraire(plages, deb, fin);
    }
    return plages.length ? plages : null;
  }

  // Journée sans contrainte de voisinage : on BALAIE la journée au lieu de
  // proposer trois horaires collés le matin. Le pharmacien voit ainsi du matin,
  // du début et de la fin d'après-midi.
  function etaler(creneaux, max) {
    var n = creneaux.length;
    if (n <= max) return creneaux.slice();
    var out = [];
    for (var k = 0; k < max; k++) out.push(creneaux[Math.floor((k + 0.5) * n / max)]);
    return out;
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
    // Plages venues de l'agenda personnel du commercial (heures seulement).
    var agenda = (p && p.agenda) || [];
    // Les journées où le commercial a déclaré où il sera.
    var secteurs = (p && p.secteurs) || [];
    var joursChoisis = !!(p && p.dispo && p.dispo.jours_choisis);
    var aujourdhui = (p && p.aujourdhui) || new Date().toISOString().slice(0, 10);

    var parDate = {};
    occupes.forEach(function (o) {
      if (!o || !o.date) return;
      (parDate[o.date] = parDate[o.date] || []).push(o);
    });

    var jours = [];
    for (var i = d.delai_min_jours; i <= d.horizon_jours; i++) {
      var iso = isoPlus(aujourdhui, i);
      // Avant même de regarder les heures : ce jour-là, est-il dans le
      // département de cette officine ?
      if (!M.secteurOk(iso, officine, secteurs)) continue;
      // Une journée que le commercial n'ouvre pas ne doit pas même apparaître.
      if (!M.jourOuvert(iso, secteurs, joursChoisis)) continue;
      var plages = plagesDuJour(iso, d, blocages, agenda);
      if (!plages) continue;
      var j = M.jour(iso, parDate[iso] || [], officine, d, plages);
      if (j) jours.push(j);
    }

    jours.sort(function (a, b) { return a.score - b.score || (a.date < b.date ? -1 : 1); });

    return jours.slice(0, 3).map(function (j) {
      // score 0 = un voisin est déjà posé : les créneaux sont triés par proximité
      // avec lui, on garde donc les plus proches. Sinon on balaie la journée.
      var choisis = j.score === 0 ? espacer(j.creneaux, 3) : etaler(j.creneaux, 3);
      return {
        date: j.date,
        score: j.score,
        creneaux: choisis.sort(function (a, b) { return a - b; }).map(min2hm)
      };
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  // ── Toutes les dates ouvertes, sur tout l'horizon ────────────────────
  // `proposer` met en avant TROIS dates, choisies pour la cohérence de la
  // tournée. C'est la bonne réponse dans neuf cas sur dix — mais une officine
  // qui ne peut ni la semaine prochaine ni celle d'après n'avait, elle, aucune
  // porte de sortie. Cette fonction ouvre le calendrier complet, dans l'ordre
  // des dates cette fois : le pharmacien choisit son mois.
  //
  // Les mêmes règles s'appliquent : délai minimum, journées non travaillées,
  // demi-journées bloquées, agenda personnel, RDV déjà posés, temps de route.
  // Rien n'est proposé ici qui ne serait pas réellement tenable.
  M.calendrier = function (p) {
    var d = fusionner(p && p.dispo);
    var officine = (p && p.officine) || {};
    var occupes = (p && p.occupes) || [];
    var blocages = (p && p.blocages) || [];
    var agenda = (p && p.agenda) || [];
    // ⚠️ La même règle de secteur qu'en haut, et c'est indispensable : « Voir
    // d'autres dates » ouvre le calendrier complet. Sans ce filtre ici, le
    // pharmacien verrait trois dates cohérentes puis, d'un clic, cent trente
    // dates qui ne le sont plus — dont celles où le commercial est à 300 km.
    var secteurs = (p && p.secteurs) || [];
    var joursChoisis = !!(p && p.dispo && p.dispo.jours_choisis);
    var aujourdhui = (p && p.aujourdhui) || new Date().toISOString().slice(0, 10);
    // 180 jours d'horizon ne font qu'environ 130 jours OUVRÉS : ce plafond
    // doit rester au-dessus, sinon la liste s'arrête avant la fin des six mois
    // annoncés. Déjà mesuré une fois : à 45, elle s'arrêtait au 19 octobre
    // alors qu'on promettait trois mois.
    var maxJours = (p && p.max_jours) || 135;
    var parJour = (p && p.creneaux_par_jour) || 4;

    var parDate = {};
    occupes.forEach(function (o) {
      if (!o || !o.date) return;
      (parDate[o.date] = parDate[o.date] || []).push(o);
    });

    var out = [];
    for (var i = d.delai_min_jours; i <= d.horizon_jours && out.length < maxJours; i++) {
      var iso = isoPlus(aujourdhui, i);
      if (!M.secteurOk(iso, officine, secteurs)) continue;
      // Une journée que le commercial n'ouvre pas ne doit pas même apparaître.
      if (!M.jourOuvert(iso, secteurs, joursChoisis)) continue;
      var plages = plagesDuJour(iso, d, blocages, agenda);
      if (!plages) continue;
      var j = M.jour(iso, parDate[iso] || [], officine, d, plages);
      if (!j) continue;
      out.push({
        date: j.date,
        score: j.score,
        creneaux: etaler(j.creneaux, parJour)
          .sort(function (a, b) { return a - b; }).map(min2hm)
      });
    }
    return out;   // déjà dans l'ordre des dates
  };

  M._min2hm = min2hm;
  M._hm2min = hm2min;

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2RDV = M;
})(typeof window !== 'undefined' ? window : this);
