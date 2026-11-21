/* PHIRST · logique PURE des écrans Appels, Veille et Pistes (20/11/2026) : aucune lecture de la page ni de la base,
   donc testable (tests/phirst-appels-veille.test.mjs). Les écrans (phirst-appels.js, phirst-veille.js) ne font que l'affichage
   et les écritures. Les règles viennent de la V1 (~/phirst-studio) :
   - ordre des départements : lib/secteur.ts ; relance due : getCallPlan (lib/appels.ts) ;
   - suites d'un appel : logCall (app/crm/actions.ts) ; étapes : lib/crmStages.ts. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.PHIRST_PUR = fabrique();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* le secteur de Yann, dans l'ordre où il appelle (lib/secteur.ts de la V1) */
  var SECTEUR = ['44', '49', '35', '56', '29', '22', '72', '37', '14', '85', '50', '61'];
  function dep2(d) { return String(d == null ? '' : d).slice(0, 2); }
  function rang(d) { var i = SECTEUR.indexOf(dep2(d)); return i < 0 ? 999 : i; }
  function dansSecteur(d) { return rang(d) !== 999; }
  function primeSecteur(d) { var r = rang(d); return r === 999 ? -12 : 24 - r * 2; }

  function norm(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function cle(nom, ville) { return norm(nom) + '|' + norm(ville); }

  /* dates : AAAA-MM-JJ, à l'heure de Paris pour « aujourd'hui » */
  function aujourdhui(d) {
    var p = {};
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  function ms(iso) { return Date.parse(String(iso).slice(0, 10) + 'T12:00:00Z'); }
  function ajouterJours(iso, n) { return new Date(ms(iso) + n * 864e5).toISOString().slice(0, 10); }
  function joursEntre(de, a) { return Math.round((ms(a) - ms(de)) / 864e5); }
  function estJour(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(ms(s)); }
  function jourFr(iso) {
    if (!estJour(iso)) return '';
    return new Date(ms(iso)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  }

  /* les sept étapes d'une piste (lib/crmStages.ts) ; « archive » n'est jamais montrée dans les pistes */
  var ETAPES = [
    { cle: 'a_qualifier', nom: 'À qualifier' },
    { cle: 'a_rappeler', nom: 'À rappeler' },
    { cle: 'rdv_fixe', nom: 'RDV fixé' },
    { cle: 'releve_etude', nom: 'Relevé et étude' },
    { cle: 'devis_envoye', nom: 'Devis envoyé' },
    { cle: 'signe', nom: 'Signé' },
    { cle: 'perdu', nom: 'Perdu' }
  ];
  function nomEtape(c) { for (var i = 0; i < ETAPES.length; i++) if (ETAPES[i].cle === c) return ETAPES[i].nom; return c === 'archive' ? 'Archivée' : 'À qualifier'; }
  var CLOSES = { signe: 1, perdu: 1, archive: 1 };

  /* Les pistes de l'espace rangées par étape, archivées exclues. Chaque étape est rendue même vide (le texte « quoi faire »
     est affiché par l'écran), dans l'ordre du pipeline ; dans une étape : prochaine action la plus proche d'abord, puis nom. */
  function grouperParEtape(fiches) {
    return ETAPES.map(function (e) {
      var l = (fiches || []).filter(function (f) { return f.stage === e.cle; }).sort(function (a, b) {
        var da = a.next_action_date || '9999', db = b.next_action_date || '9999';
        return da < db ? -1 : da > db ? 1 : norm(a.nom) < norm(b.nom) ? -1 : 1;
      });
      return { cle: e.cle, nom: e.nom, fiches: l };
    });
  }

  /* Relances dues lues en direct (règle de getCallPlan, bloc 1) : fiche ni signée, ni perdue, ni archivée, dans le secteur,
     dont la date de prochaine action est aujourd'hui ou avant. 200 de base : une relance passe devant tout signal. */
  function relancesDues(fiches, jour) {
    var r = [];
    (fiches || []).forEach(function (p) {
      if (CLOSES[p.stage]) return;
      var dep = String(p.departement || String(p.cp == null ? '' : p.cp).slice(0, 2));
      if (!dansSecteur(dep)) return;
      if (!p.next_action_date || p.next_action_date > jour) return;
      var retard = Math.max(0, joursEntre(p.next_action_date, jour));
      r.push({
        cle: cle(p.nom, p.ville), nom: p.nom, ville: p.ville || '', cp: String(p.cp == null ? '' : p.cp), dep: dep, motif: 'relance',
        score: 200 + Math.min(retard, 20) + primeSecteur(dep),
        raisons: [retard === 0 ? 'Relance prévue aujourd’hui : ' + (p.next_action || 'à rappeler')
          : 'Relance en retard de ' + retard + ' jour' + (retard > 1 ? 's' : '') + ' : ' + (p.next_action || 'à rappeler')],
        telephone: p.telephone || null, email: p.email || null, pharmacien: p.pharmacien || null, lien: null,
        prospectId: p.id, stage: p.stage, origine: 'annuaire', lat: p.lat == null ? null : p.lat, lon: p.lon == null ? null : p.lon
      });
    });
    return r;
  }

  /* Dernier appel noté par fiche : { idFiche: 'AAAA-MM-JJ' } à partir des lignes crm_activities de type « appel ». */
  function dernierAppelParFiche(activites, versJour) {
    var d = {};
    (activites || []).forEach(function (a) {
      if (a.type !== 'appel' || !a.created_at) return;
      var j = versJour ? versJour(a.created_at) : String(a.created_at).slice(0, 10);
      if (!d[a.prospect_id] || d[a.prospect_id] < j) d[a.prospect_id] = j;
    });
    return d;
  }

  /* LA liste « À appeler aujourd'hui » : la liste du robot (7 h 05) + les relances dues lues en direct.
     Mêmes écarts que getCallPlan : fiche signée, perdue ou archivée ; officine déjà appelée il y a 14 jours ou moins
     (sauf une relance due). En plus, ce que la page sait et pas le robot : une ligne du robot qui était une relance mais
     dont la fiche a été reprogrammée depuis n'est plus due ; une fiche créée depuis (même nom + ville) est reconnue. */
  function listeDuJour(appelsRobot, fiches, dernierAppel, jour) {
    var parId = {}, parCle = {};
    (fiches || []).forEach(function (f) { parId[f.id] = f; var k = cle(f.nom, f.ville); if (!parCle[k] || parCle[k].stage === 'archive') parCle[k] = f; });
    var dues = relancesDues(fiches, jour), dueId = {};
    dues.forEach(function (d) { dueId[d.prospectId] = d; });
    var par = {};
    function poser(r) { par[r.cle] = r; }
    (appelsRobot || []).forEach(function (r) {
      // nom de vue d'abord (celui de la fiche créée depuis l'écran), puis la clé de la V1 (nom brut : « Pharmacie le Roch - Lorient »)
      var f = (r.prospectId && parId[r.prospectId]) || parCle[cle(r.nom, r.ville)] || (r.cle && parCle[r.cle]) || null;
      if (f) {
        if (CLOSES[f.stage]) return;
        if (dueId[f.id]) return; // remplacée par la relance lue en direct
        if (r.motif === 'relance') return; // l'échéance a changé depuis 7 h 05
        var j = dernierAppel && dernierAppel[f.id];
        if (j && joursEntre(j, jour) <= 14) return;
        r = Object.assign({}, r, { prospectId: f.id, stage: f.stage });
      }
      poser(r);
    });
    dues.forEach(function (d) {
      var vieux = par[d.cle]; if (vieux) { d.telephone = d.telephone || vieux.telephone; }
      poser(d);
    });
    return Object.keys(par).map(function (k) { return par[k]; }).sort(function (a, b) {
      return b.score - a.score || rang(a.dep) - rang(b.dep) || (norm(a.nom) < norm(b.nom) ? -1 : 1);
    });
  }

  /* Les quatre suites d'un appel : EXACTEMENT celles de logCall (V1, app/crm/actions.ts). `choisie` : la date que Yann
     donne pour « À rappeler » (à défaut, 7 jours). Rend ce qu'il faut écrire : l'activité, l'étape et la prochaine action. */
  var SUITES = {
    rappeler: { body: 'Appel passé — à rappeler', stage: 'a_rappeler', action: 'Rappeler', jours: 7 },
    rdv: { body: 'Appel passé — RDV obtenu', stage: 'rdv_fixe', action: 'Préparer le RDV', jours: 2 },
    injoignable: { body: 'Appel passé — injoignable', stage: null, action: 'Retenter l’appel', jours: 3 },
    non: { body: 'Appel passé — pas intéressé pour le moment', stage: 'perdu', action: null, jours: null }
  };
  function suiteAppel(resultat, jour, choisie, commentaire) {
    var s = SUITES[resultat] || SUITES.rappeler;
    var date = null;
    if (s.jours !== null) date = (resultat === 'rappeler' && estJour(choisie) && choisie >= jour) ? choisie : ajouterJours(jour, s.jours);
    var detail = String(commentaire || '').trim();
    var maj = {};
    if (s.stage) maj.stage = s.stage;
    maj.next_action = s.jours !== null ? s.action : null;
    maj.next_action_date = date;
    return { body: detail ? s.body + ' — ' + detail : s.body, maj: maj };
  }

  /* Veille : familles, filtres, tri par l'ordre des départements de Yann (puis la plus récente d'abord) */
  var FAMILLES = [
    { cle: 'cession_pharmacie', nom: 'Cessions', un: 'Cession' },
    { cle: 'creation_pharmacie', nom: 'Créations', un: 'Création' },
    { cle: 'procedure_collective', nom: 'Procédures collectives', un: 'Procédure collective' }
  ];
  function nomFamille(c) { for (var i = 0; i < FAMILLES.length; i++) if (FAMILLES[i].cle === c) return FAMILLES[i].un; return ''; }
  function trierVeille(items) {
    return (items || []).slice().sort(function (a, b) {
      return rang(a.dep) - rang(b.dep) || (String(b.date || '') < String(a.date || '') ? -1 : String(b.date || '') > String(a.date || '') ? 1 : 0) ||
        (norm(a.nom) < norm(b.nom) ? -1 : 1);
    });
  }
  function filtrerVeille(items, famille, dep) {
    return (items || []).filter(function (v) { return (!famille || v.famille === famille) && (!dep || dep2(v.dep) === dep); });
  }
  /* départements présents (dans l'ordre de Yann) avec leur nombre */
  function departementsDe(items) {
    var n = {};
    (items || []).forEach(function (v) { var d = dep2(v.dep); if (d) n[d] = (n[d] || 0) + 1; });
    return Object.keys(n).sort(function (a, b) { return rang(a) - rang(b) || (a < b ? -1 : 1); }).map(function (d) { return { dep: d, n: n[d] }; });
  }
  function compterFamilles(items) {
    var n = {}; (items || []).forEach(function (v) { n[v.famille] = (n[v.famille] || 0) + 1; }); return n;
  }

  /* Un lien n'est affiché que s'il est en http ou https (jamais javascript: ni texte quelconque) : '' sinon, et le bouton n'apparaît pas. */
  function lienSur(u) {
    try { var x = new URL(String(u == null ? '' : u)); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : ''; } catch (e) { return ''; }
  }

  /* « aujourd'hui », « hier », « il y a 3 jours » pour une date AAAA-MM-JJ */
  function age(iso, jour) {
    if (!estJour(String(iso).slice(0, 10))) return '';
    var j = joursEntre(String(iso).slice(0, 10), jour);
    return j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : 'il y a ' + j + ' jours';
  }

  /* La phrase du journal pour une ligne crm_activities. Les appels écrits par logCall sont du texte ; ceux de la V1 récente
     sont du JSON { v, resultat, raison, rappel, note } : les deux se lisent. */
  var RES = { rdv: 'RDV pris', rappeler: 'À rappeler', injoignable: 'Injoignable', barrage: 'Barrage', pas_interesse: 'Pas intéressé', mauvais_numero: 'Mauvais numéro' };
  function phraseJournal(type, corps) {
    var b = String(corps == null ? '' : corps).trim(), o = null;
    if (b.charAt(0) === '{') { try { o = JSON.parse(b); } catch (e) { o = null; } }
    if (o && typeof o === 'object') {
      if (type === 'appel') {
        var t = RES[o.resultat] ? 'Appel · ' + RES[o.resultat] : 'Appel';
        var suite = [o.raison, o.rappel ? 'rappel le ' + jourFr(String(o.rappel).slice(0, 10)) : '', o.note].filter(Boolean);
        return suite.length ? t + ' — ' + suite.join(' · ') : t;
      }
      if (type === 'rdv') return phraseRdv(b);
      if (type === 'qualif') return o.q && o.r ? o.q + ' : ' + o.r : 'Qualification';
      return b ? 'Mise à jour' : 'Note';
    }
    if (type === 'rdv') return phraseRdv(b);
    if (type === 'fait') return 'C’est fait';
    if (type === 'relance') return 'Relance envoyée';
    return b || (type === 'appel' ? 'Appel' : 'Note');
  }

  /* ════ AGENDA : créneaux et rendez-vous (lot 2, 21/11/2026) ════
     Portés de la V1 (~/phirst-studio/lib/creneaux.ts, lib/rdv.ts, lib/tournee.ts, lib/journal.ts) SANS changer une règle.
     Toutes les heures sont des textes « AAAA-MM-JJTHH:MM » à l'heure de Paris, sans fuseau : on les compare et on les décale,
     on ne les convertit jamais. La V1 et la V2 partagent la même base : le format d'un rendez-vous est celui de la V1. */

  /* Les disponibilités de Yann : UNE constante, lue partout, jamais recopiée ailleurs. */
  var REGLAGES_AGENDA = {
    base: { commune: 'La Baule-Escoublac', lat: 47.2863, lon: -2.393 },
    plages: [{ debut: '08:30', fin: '12:30' }, { debut: '14:00', fin: '18:00' }],
    dureeMin: 60,
    pasMin: 30,
    margeInconnueMin: 20,
    secteurMin: 45
  };

  var HEURE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
  function minutes(local) {
    var m = HEURE.exec(String(local == null ? '' : local));
    if (!m) return NaN;
    var d = m[1].split('-').map(Number);
    return Date.UTC(d[0], d[1] - 1, d[2], Number(m[2]), Number(m[3])) / 60000;
  }
  function versLocal(min) { return new Date(min * 60000).toISOString().slice(0, 16); }
  function estHeureLocale(s) { return typeof s === 'string' && isFinite(minutes(s)); }
  function ajouterMinutes(local, n) { return versLocal(minutes(local) + n); }
  /* 0 = dimanche … 6 = samedi */
  function jourDeSemaine(j) { return new Date(Date.parse(String(j).slice(0, 10) + 'T12:00:00Z')).getUTCDay(); }
  function estJourOuvre(j) { var d = jourDeSemaine(j); return d !== 0 && d !== 6; }
  /* « maintenant » à l'heure de Paris : AAAA-MM-JJTHH:MM (lib/dates.ts maintenantParis) */
  function maintenantParis(d) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  }

  function kmEntre(a, b) {
    var r = function (x) { return x * Math.PI / 180; };
    var dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /* Minutes de route estimées (70 km/h à vol d'oiseau + 15 min), aux 5 min. */
  function trajetMin(a, b) { return Math.ceil((kmEntre(a, b) / 70 * 60 + 15) / 5) * 5; }
  function pointDe(o) { return o && typeof o.lat === 'number' && typeof o.lon === 'number' ? { lat: o.lat, lon: o.lon } : null; }

  /* Les créneaux libres d'un jour pour un rendez-vous à `cible` (le lieu de la pharmacie s'il est connu). */
  function creneauxLibres(opts) {
    var r = opts.reglages || REGLAGES_AGENDA, jr = String(opts.jour).slice(0, 10);
    if (!estJourOuvre(jr)) return [];
    var els = (opts.occupations || []).filter(function (o) { return String(o.debut).slice(0, 10) === jr; })
      .map(function (o) { return Object.assign({}, o, { d: minutes(o.debut), f: minutes(o.fin) }); })
      .filter(function (o) { return isFinite(o.d) && isFinite(o.f); })
      .sort(function (a, b) { return a.d - b.d; });
    var maint = minutes(opts.maintenant), cible = opts.cible || null;
    function marge(o) { var p = pointDe(o); return p && cible ? trajetMin(p, cible) : r.margeInconnueMin; }
    var dansLeSecteur = !!cible && els.some(function (o) { var p = pointDe(o); return !!p && trajetMin(p, cible) <= r.secteurMin; });
    var ouverture = minutes(jr + 'T' + r.plages[0].debut), out = [];
    r.plages.forEach(function (plage) {
      var p0 = minutes(jr + 'T' + plage.debut), p1 = minutes(jr + 'T' + plage.fin);
      for (var s = p0; s + r.dureeMin <= p1; s += r.pasMin) {
        var e = s + r.dureeMin;
        if (s < maint) continue;
        if (els.some(function (o) { return o.d < e && o.f > s; })) continue;
        var avants = els.filter(function (o) { return o.f <= s; }), avant = avants.length ? avants[avants.length - 1] : null;
        var apres = null; for (var i = 0; i < els.length; i++) if (els[i].d >= e) { apres = els[i]; break; }
        var trajetAvant = avant ? marge(avant) : cible ? trajetMin(r.base, cible) : 0;
        // On ne part pas avant la fin de ce qui précède, ni avant maintenant.
        if (s < Math.max(avant ? avant.f : ouverture, maint) + trajetAvant) continue;
        var trajetApres = apres ? marge(apres) : null;
        if (apres && trajetApres !== null && e + trajetApres > apres.d) continue;
        out.push({
          debut: versLocal(s), fin: versLocal(e),
          trajetAvant: cible || avant ? trajetAvant : null,
          depuis: avant ? (avant.commune || 'le rendez-vous d’avant') : r.base.commune,
          trajetApres: trajetApres,
          vers: apres ? (apres.commune || 'le rendez-vous d’après') : null,
          dansLeSecteur: dansLeSecteur
        });
      }
    });
    return out;
  }

  /* Les 3 meilleurs créneaux : au plus un par jour, ceux où Yann est déjà dans le secteur en tête, puis le plus tôt ;
     dans un jour, celui qui ajoute le moins de route. */
  function meilleursCreneaux(opts) {
    var parJour = [];
    (opts.jours || []).forEach(function (jour) {
      var l = creneauxLibres(Object.assign({}, opts, { jour: jour }));
      if (!l.length) return;
      var route = function (c) { return (c.trajetAvant || 0) + (c.trajetApres || 0); };
      parJour.push(l.reduce(function (m, c) { return route(c) < route(m) ? c : m; }, l[0]));
    });
    return parJour.sort(function (a, b) { return Number(b.dansLeSecteur) - Number(a.dansLeSecteur) || minutes(a.debut) - minutes(b.debut); })
      .slice(0, opts.combien || 3);
  }

  /* Les n jours ouvrés à partir de `jour` (inclus s'il est ouvré). */
  function joursOuvres(jour, n) {
    var out = [], t = Date.parse(String(jour).slice(0, 10) + 'T12:00:00Z');
    while (out.length < n) { var j = new Date(t).toISOString().slice(0, 10); if (estJourOuvre(j)) out.push(j); t += 864e5; }
    return out;
  }

  /* ── Les rendez-vous : des ÉVÉNEMENTS ajoutés, jamais réécrits (lib/rdv.ts) ── */
  var STATUTS_RDV = { propose: 'à confirmer', confirme: 'confirmé', reporte: 'déplacé, à reconfirmer', fait: 'fait', annule: 'annulé' };
  var DUREE_RDV_DEFAUT = 60;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var QUOI = ['creer', 'confirmer', 'deplacer', 'annuler', 'fait'];
  function court(v, n) { return typeof v === 'string' ? v.trim().slice(0, n) : ''; }

  /* Le corps d'un événement, validé ; null s'il est inutilisable. */
  function lireRdv(body) {
    var o;
    try { o = JSON.parse(String(body == null ? '' : body)); } catch (e) { return null; }
    if (!o || typeof o !== 'object' || o.v !== 1) return null;
    var quoi = o.quoi;
    if (QUOI.indexOf(quoi) < 0 || !UUID.test(String(o.rdv == null ? '' : o.rdv))) return null;
    var avecHeure = quoi === 'creer' || quoi === 'deplacer';
    if (avecHeure && !estHeureLocale(o.debut)) return null;
    var duree = Number(o.duree_min), c = { v: 1, rdv: String(o.rdv), quoi: quoi };
    if (avecHeure) c.debut = String(o.debut);
    if (isFinite(duree) && Math.floor(duree) === duree && duree >= 15 && duree <= 480) c.duree_min = duree;
    if (court(o.lieu, 120)) c.lieu = court(o.lieu, 120);
    if (court(o.objet, 300)) c.objet = court(o.objet, 300);
    c.pour = 'yann';
    c.prisPar = court(o.prisPar, 64);
    if (court(o.passation, 2000)) c.passation = court(o.passation, 2000);
    return c;
  }
  /* Ordre de rejeu : l'heure d'écriture, puis l'identifiant (départage stable). */
  function ordreRejeu(a, b) {
    var ta = Date.parse(a.created_at), tb = Date.parse(b.created_at);
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  /* Rejoue les événements et rend l'état de chaque rendez-vous, du plus tôt au plus tard. `estTelepro(author_id)` vient de
     l'appelant (aucun compte n'a encore ce rôle : l'écran passe une fonction qui rend toujours false). */
  function etatsDesRdv(lignes, estTelepro) {
    var parId = {}, ids = [];
    (lignes || []).slice().sort(ordreRejeu).forEach(function (l) {
      var c = lireRdv(l.body); if (!c) return;
      var parTelepro = !!estTelepro(l.author_id), r = parId[c.rdv];
      if (c.quoi === 'creer') {
        if (r) return; // déjà créé : le premier fait foi
        var duree = c.duree_min || DUREE_RDV_DEFAUT;
        parId[c.rdv] = {
          id: c.rdv, prospect_id: l.prospect_id, debut: c.debut, fin: ajouterMinutes(c.debut, duree), duree_min: duree,
          lieu: c.lieu || '', objet: c.objet || '', statut: parTelepro ? 'propose' : 'confirme', prisParTelepro: parTelepro,
          creePar: l.author_id, creeLe: l.created_at, passation: c.passation || '',
          dernier: { quoi: 'creer', parTelepro: parTelepro, le: l.created_at }
        };
        ids.push(c.rdv);
        return;
      }
      if (!r || r.prospect_id !== l.prospect_id) return; // geste sans création, ou sur une autre fiche
      if (r.statut === 'annule' || r.statut === 'fait') return;
      if (c.quoi === 'deplacer') {
        r.debut = c.debut;
        if (c.duree_min) r.duree_min = c.duree_min;
        r.fin = ajouterMinutes(r.debut, r.duree_min);
        if (c.lieu) r.lieu = c.lieu;
        r.statut = parTelepro ? 'reporte' : 'confirme';
      } else if (c.quoi === 'confirmer') r.statut = 'confirme';
      else if (c.quoi === 'annuler') r.statut = 'annule';
      else if (c.quoi === 'fait') r.statut = 'fait';
      if (c.passation) r.passation = c.passation;
      r.dernier = { quoi: c.quoi, parTelepro: parTelepro, le: l.created_at };
    });
    return ids.map(function (i) { return parId[i]; }).sort(function (a, b) { return minutes(a.debut) - minutes(b.debut) || (a.id < b.id ? -1 : 1); });
  }
  function occupe(r) { return r.statut !== 'annule'; }
  function aConfirmer(r) { return r.statut === 'propose' || r.statut === 'reporte'; }
  /* Les rendez-vous qui se chevauchent : { id: true }. */
  function chevauchements(rdvs) {
    var l = (rdvs || []).filter(occupe), out = {};
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) {
      var a = l[i], b = l[j];
      if (minutes(a.debut) < minutes(b.fin) && minutes(b.debut) < minutes(a.fin)) { out[a.id] = true; out[b.id] = true; }
    }
    return out;
  }
  /* Qui peut faire quoi : confirmer et « c'est fait » sont des gestes de Yann ; role = 'patron' | 'telepro'. */
  function gestePermis(r, quoi, role) {
    if (r.statut === 'annule' || r.statut === 'fait') return false;
    if (quoi === 'confirmer') return role === 'patron' && aConfirmer(r);
    if (quoi === 'fait') return role === 'patron';
    return true;
  }
  var ETAPES_PISTE = ['a_qualifier', 'a_rappeler', 'rdv_fixe'];
  function rdvDeLaTelepro(r, etape) { return !!r.prisParTelepro || ETAPES_PISTE.indexOf(etape || '') >= 0; }

  /* ── Vérifications d'avant écriture (app/agenda/actions.ts de la V1 : mêmes messages) ── */
  var MSG_PRIS = 'Yann a déjà un rendez-vous à cette heure-là : choisissez un autre créneau.';
  function heureValide(debut, maintenant) {
    if (!estHeureLocale(debut)) return 'Heure du rendez-vous illisible.';
    if (minutes(debut) < minutes(maintenant)) return 'Cette heure est déjà passée.';
    return null;
  }
  /* Yann a-t-il déjà un rendez-vous sur ce créneau (hors celui qu'on déplace) ? `rdvs` = états rejoués. */
  function dejaPris(rdvs, debut, duree, sauf) {
    var d = minutes(debut), f = d + duree;
    return (rdvs || []).some(function (r) { return r.id !== sauf && occupe(r) && minutes(r.debut) < f && minutes(r.fin) > d; });
  }

  /* ── Textes en français (lib/journal.ts, lib/dates.ts) ── */
  function dateLongue(iso) {
    return new Date(Date.parse(String(iso).slice(0, 10) + 'T12:00:00Z')).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  }
  /* « 14 h », « 14 h 30 » */
  function heureFr(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm)); if (!m) return '';
    return m[2] === '00' ? Number(m[1]) + ' h' : Number(m[1]) + ' h ' + m[2];
  }
  /* « mardi 3 novembre à 14 h » depuis « 2026-11-03T14:00 » */
  function quandFr(local) {
    var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(local == null ? '' : local));
    return m ? dateLongue(m[1]) + ' à ' + heureFr(m[2]) : '';
  }
  function maj(s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); }
  /* « 45 min », « 2 h 15 » */
  function dureeFr(min) {
    if (min < 60) return min + ' min';
    var r = min % 60; return Math.floor(min / 60) + ' h' + (r ? ' ' + ('0' + r).slice(-2) : '');
  }
  /* Le lieu écrit dans un rendez-vous : nom de la pharmacie + adresse si connue + ville, 120 caractères au plus. */
  function lieuPharmacie(f) {
    var vus = {}, morceaux = [f.nom, f.adresse, f.ville].filter(function (x) {
      var t = String(x == null ? '' : x).trim(); if (!t || vus[norm(t)]) return false; vus[norm(t)] = true; return true;
    }).map(function (x) { return String(x).trim(); });
    return morceaux.join(', ').slice(0, 120);
  }
  /* La phrase du journal pour une ligne `rdv` : jamais de JSON brut. */
  function phraseRdv(body) {
    var c = lireRdv(body); if (!c) return 'Rendez-vous';
    var q = c.debut ? quandFr(c.debut) : '';
    if (c.quoi === 'creer') return q ? 'Rendez-vous posé pour le ' + q : 'Rendez-vous posé';
    if (c.quoi === 'deplacer') return q ? 'Rendez-vous déplacé au ' + q : 'Rendez-vous déplacé';
    if (c.quoi === 'confirmer') return 'Rendez-vous confirmé';
    if (c.quoi === 'annuler') return 'Rendez-vous annulé';
    return 'Rendez-vous fait';
  }
  /* Les 10 prochains jours ouvrés, pour proposer des créneaux. */
  function joursProposes(auj) { return joursOuvres(auj, 10); }
  /* Un corps de ligne `rdv` (le format de la V1, à l'identique). */
  function corpsRdv(quoi, rdvId, moi, extra) {
    var o = { v: 1, rdv: rdvId, quoi: quoi };
    Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    o.pour = 'yann'; o.prisPar = moi;
    return JSON.stringify(o);
  }

  /* ── L'écran Agenda : la journée (lib/journee.ts de la V1, maquette « Agenda m1 · La journée ») ── */
  var NB_PUCES = 6;
  function ajouterJoursIso(iso, n) { return new Date(Date.parse(String(iso).slice(0, 10) + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  function reculerOuvres(jour, n) { var j = jour, reste = n; while (reste > 0) { j = ajouterJoursIso(j, -1); if (estJourOuvre(j)) reste--; } return j; }
  /* Les 6 puces : aujourd'hui (toujours, même un samedi) puis les jours ouvrés suivants ; si le jour affiché n'y est pas, elles partent de lui. */
  function fenetreJours(affiche, auj) {
    var parDefaut = [auj].concat(joursOuvres(ajouterJoursIso(auj, 1), NB_PUCES - 1));
    return parDefaut.indexOf(affiche) >= 0 ? parDefaut : joursOuvres(affiche, NB_PUCES);
  }
  function decalages(fenetre, auj) {
    return { avant: reculerOuvres(fenetre[0], NB_PUCES), apres: joursOuvres(ajouterJoursIso(fenetre[fenetre.length - 1], 1), 1)[0], montrerAujourdhui: fenetre.indexOf(auj) < 0 };
  }
  /* « jeu. 26 » */
  function jourCourt(jour) { return new Date(Date.parse(jour + 'T12:00:00Z')).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }); }
  /* Chaque rendez-vous relié à sa pharmacie : { rdv, fiche, chevauche, aConfirmer }. */
  function lierRdv(rdvs, fiches) {
    var par = {}, ch = chevauchements(rdvs); (fiches || []).forEach(function (f) { par[f.id] = f; });
    return (rdvs || []).map(function (r) { return { rdv: r, fiche: par[r.prospect_id] || { nom: 'Pharmacie', ville: null }, chevauche: !!ch[r.id], aConfirmer: aConfirmer(r) }; });
  }
  /* Les rendez-vous d'un jour, du plus tôt au plus tard (annulés compris : l'écran les range à part). */
  function duJour(els, jour) {
    return (els || []).filter(function (e) { return e.rdv.debut.slice(0, 10) === jour; }).sort(function (a, b) { return minutes(a.rdv.debut) - minutes(b.rdv.debut); });
  }
  function comptesParJour(els, jours) {
    var o = {}; jours.forEach(function (j) { o[j] = duJour(els, j).filter(function (e) { return e.rdv.statut !== 'annule'; }).length; }); return o;
  }
  function sousPuce(jour, auj, n) {
    if (jour === auj) return n ? 'aujourd’hui · ' + n : 'aujourd’hui';
    return n === 0 ? 'rien' : n === 1 ? '1 rendez-vous' : n + ' rendez-vous';
  }
  function phraseLibres(n) { return n + ' créneau' + (n > 1 ? 'x' : '') + ' d’une heure libre' + (n > 1 ? 's' : ''); }
  /* Les créneaux libres d'un jour réunis en plages : « de 8 h 30 à 12 h 30 », « de 14 h à 18 h ». */
  function plagesLibres(creneaux) {
    var out = [];
    (creneaux || []).forEach(function (c) {
      var dern = out[out.length - 1];
      if (dern && minutes(c.debut) <= minutes(dern.fin)) dern.fin = c.fin; else out.push({ debut: c.debut, fin: c.fin });
    });
    return out.map(function (p) { return 'de ' + heureFr(p.debut.slice(11)) + ' à ' + heureFr(p.fin.slice(11)); });
  }
  /* La carte « Ensuite » : aujourd'hui, le premier rendez-vous pas encore fini ; un autre jour, le premier du jour. Annulés et faits ignorés. */
  function carteEnsuite(o) {
    var auj = o.jour === o.aujourdhui;
    var tous = duJour(o.elements, o.jour).filter(function (e) { return e.rdv.statut !== 'annule'; });
    var e = null;
    for (var i = 0; i < tous.length; i++) { var x = tous[i]; if (x.rdv.statut !== 'fait' && (!auj || minutes(x.rdv.fin) > minutes(o.maintenant))) { e = x; break; } }
    if (!e) return { maint: auj ? 'Aujourd’hui' : 'Ce jour-là', titre: 'Rien de prévu', detail: o.libres > 0 ? phraseLibres(o.libres) + '.' : 'Aucun créneau d’une heure libre.' };
    var prev = null; tous.forEach(function (x) { if (minutes(x.rdv.fin) <= minutes(e.rdv.debut)) prev = x; });
    var de = prev ? pointDe(prev.fiche) : REGLAGES_AGENDA.base, vers = pointDe(e.fiche);
    var route = de && vers ? ' Environ ' + dureeFr(trajetMin(de, vers)) + ' de route depuis ' + (prev ? (prev.fiche.ville || 'le rendez-vous d’avant') : REGLAGES_AGENDA.base.commune) + '.' : '';
    return {
      maint: auj ? 'Ensuite' : 'Premier rendez-vous',
      titre: [heureFr(e.rdv.debut.slice(11)), e.fiche.ville].filter(Boolean).join(' · '),
      detail: [e.fiche.nom, e.rdv.objet].filter(Boolean).join(' · ') + '.' + route
    };
  }
  /* « Vous êtes à Batz » / « Rien de prévu », + créneaux libres. Pour la téléprospectrice : « Yann est à Batz » (c'est son agenda à lui). */
  function phraseEtat(els, libres, pourTelepro) {
    var premier = null; for (var i = 0; i < els.length; i++) if (els[i].rdv.statut !== 'annule') { premier = els[i]; break; }
    var debut = premier && premier.fiche.ville ? (pourTelepro ? 'Yann est à ' : 'Vous êtes à ') + premier.fiche.ville : premier ? 'Un rendez-vous est prévu' : 'Rien de prévu';
    return debut + (libres > 0 ? ' · ' + phraseLibres(libres) : '');
  }

  /* ════ TÉLÉPROSPECTRICE (21/11/2026) ════
     Elle n'est pas membre de l'espace : tout lui vient de fonctions de la base (acces-telepro.sql). Ici, seulement le
     passage de ce qu'elles rendent au format que les écrans lisent déjà. */

  /* phirst_equipe() : [{ user_id, nom, telepro }] → { user_id: { nom, telepro } } */
  function equipeParId(lignes) {
    var o = {};
    (lignes || []).forEach(function (l) { if (l && l.user_id) o[l.user_id] = { nom: typeof l.nom === 'string' ? l.nom.trim() : '', telepro: l.telepro === true }; });
    return o;
  }
  /* Vrai seulement si la ligne d'équipe de cet auteur dit « télépro » : inconnu = faux. */
  function estTelepro(equipe, id) { return !!(id && equipe && equipe[id] && equipe[id].telepro === true); }
  /* Le nom de l'auteur, ou '' s'il est inconnu (jamais « undefined »). */
  function nomAuteur(equipe, id) { var e = id && equipe && equipe[id]; return e && e.nom ? e.nom : ''; }
  function avecAuteur(phrase, nom) { return nom ? phrase + ' — par ' + nom : phrase; }

  /* telepro_ligne() → le format de la ligne du compte { trouver: { appels, veille }, frais } (frais : calculée il y a moins de 36 h). */
  var AGE_LIGNE_MAX = 36 * 3600 * 1000;
  function ligneDeTelepro(j, maintenant) {
    if (!j || typeof j !== 'object') return { trouver: null, frais: false };
    var t = Date.parse(j.calcule_le);
    return {
      trouver: { cle: 'trouver', appels: Array.isArray(j.appels) ? j.appels : [], veille: Array.isArray(j.veille) ? j.veille : [], appelsTotal: j.appelsTotal == null ? null : j.appelsTotal },
      frais: isFinite(t) && maintenant - t <= AGE_LIGNE_MAX
    };
  }

  /* telepro_agenda() → { fiches, lignes } pour etatsDesRdv et lierRdv. Une ligne « sienne » garde sa fiche ; les autres
     (prospect_id et auteur vides) reçoivent une fiche par rendez-vous : « Yann est occupé », ville = la commune. */
  function agendaDeTelepro(lignes) {
    var fiches = [], vues = {}, out = [];
    (lignes || []).forEach(function (l) {
      var o = null; try { o = JSON.parse(String(l.body == null ? '' : l.body)); } catch (e) { o = null; }
      if (!o || typeof o !== 'object') return;
      var pid, sien = l.sien === true && !!l.prospect_id;
      if (sien) {
        pid = l.prospect_id;
        if (!vues[pid]) { vues[pid] = true; fiches.push({ id: pid, nom: l.nom || 'Pharmacie', ville: l.ville || null, cp: l.cp || null, lat: l.lat == null ? null : l.lat, lon: l.lon == null ? null : l.lon, stage: l.stage || null, occupe: false }); }
      } else {
        var rid = String(o.rdv == null ? '' : o.rdv); if (!rid) return;
        pid = 'occ-' + rid;
        if (!vues[pid]) { vues[pid] = true; fiches.push({ id: pid, nom: 'Yann est occupé', ville: l.ville || null, cp: null, lat: l.lat == null ? null : l.lat, lon: l.lon == null ? null : l.lon, stage: null, occupe: true }); }
      }
      out.push({ id: l.id, prospect_id: pid, author_id: sien ? l.author_id : null, created_at: l.created_at, body: l.body });
    });
    return { fiches: fiches, lignes: out };
  }
  /* Un refus écrit EN FRANÇAIS par la base (erreurs 42501 et 22023 de ses fonctions) se montre tel quel ; toute autre panne, non. */
  function messageDeLaBase(erreur) {
    return erreur && (erreur.code === '42501' || erreur.code === '22023') && typeof erreur.message === 'string' && erreur.message.trim() ? erreur.message.trim() : '';
  }

  return {
    SECTEUR: SECTEUR, rang: rang, dansSecteur: dansSecteur, primeSecteur: primeSecteur, norm: norm, cle: cle,
    aujourdhui: aujourdhui, ajouterJours: ajouterJours, joursEntre: joursEntre, estJour: estJour, jourFr: jourFr,
    ETAPES: ETAPES, nomEtape: nomEtape, grouperParEtape: grouperParEtape,
    relancesDues: relancesDues, dernierAppelParFiche: dernierAppelParFiche, listeDuJour: listeDuJour,
    SUITES: SUITES, suiteAppel: suiteAppel,
    FAMILLES: FAMILLES, nomFamille: nomFamille, trierVeille: trierVeille, filtrerVeille: filtrerVeille,
    departementsDe: departementsDe, compterFamilles: compterFamilles, age: age, lienSur: lienSur, phraseJournal: phraseJournal,
    REGLAGES_AGENDA: REGLAGES_AGENDA, minutes: minutes, versLocal: versLocal, estHeureLocale: estHeureLocale, ajouterMinutes: ajouterMinutes,
    jourDeSemaine: jourDeSemaine, estJourOuvre: estJourOuvre, maintenantParis: maintenantParis, kmEntre: kmEntre, trajetMin: trajetMin,
    creneauxLibres: creneauxLibres, meilleursCreneaux: meilleursCreneaux, joursOuvres: joursOuvres,
    STATUTS_RDV: STATUTS_RDV, DUREE_RDV_DEFAUT: DUREE_RDV_DEFAUT, lireRdv: lireRdv, etatsDesRdv: etatsDesRdv, occupe: occupe,
    aConfirmer: aConfirmer, chevauchements: chevauchements, gestePermis: gestePermis, rdvDeLaTelepro: rdvDeLaTelepro,
    MSG_PRIS: MSG_PRIS, heureValide: heureValide, dejaPris: dejaPris, dateLongue: dateLongue, heureFr: heureFr, quandFr: quandFr,
    maj: maj, dureeFr: dureeFr, lieuPharmacie: lieuPharmacie, phraseRdv: phraseRdv, joursProposes: joursProposes, corpsRdv: corpsRdv,
    NB_PUCES: NB_PUCES, fenetreJours: fenetreJours, decalages: decalages, jourCourt: jourCourt, lierRdv: lierRdv, duJour: duJour,
    comptesParJour: comptesParJour, sousPuce: sousPuce, phraseLibres: phraseLibres, plagesLibres: plagesLibres, carteEnsuite: carteEnsuite, phraseEtat: phraseEtat,
    equipeParId: equipeParId, estTelepro: estTelepro, nomAuteur: nomAuteur, avecAuteur: avecAuteur, ligneDeTelepro: ligneDeTelepro, agendaDeTelepro: agendaDeTelepro, messageDeLaBase: messageDeLaBase
  };
});
