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
    if (!e) return { maint: auj ? 'Aujourd’hui' : 'Ce jour-là', titre: 'Rien de prévu', detail: o.libres > 0 ? phraseLibres(o.libres) + '.' : 'Aucun créneau d’une heure libre.', vide: true };
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
      frais: isFinite(t) && maintenant - t <= AGE_LIGNE_MAX,
      calculeLe: isFinite(t) ? j.calcule_le : null   // 22/11/2026 : l'écran dit « Mise à jour ce matin à 7 h 05 », lu ici, jamais écrit en dur
    };
  }

  /* Les étiquettes des motifs d'appel (une seule table, lue par l'écran Appels et par l'accueil de la téléprospectrice). */
  var MOTIFS = {
    relance: ['Relance promise', 'rouge'], procedure: ['Procédure collective', 'rouge'], cession: ['Cession d’officine', 'orange'],
    creation: ['Création d’officine', 'orange'], omnicell: ['Robot Omnicell abandonné', 'orange'], pda: ['Marché public PDA', ''],
    robot: ['Robot concurrent', ''], ehpad: ['Fournisseur d’EHPAD', ''], pmr: ['Accessibilité PMR', '']
  };
  /* Veille : mêmes mots que le robot de l'accueil de Yann (ligne-vers-base.mjs, SIGNAL). */
  var SIGNAL_VEILLE = {
    procedure_collective: { t: 'En difficulté', ton: 'rouge', phrase: 'est en procédure collective' },
    cession_pharmacie: { t: 'Vient d’être vendue', ton: 'orange', phrase: 'vient d’être vendue' },
    creation_pharmacie: { t: 'Vient d’ouvrir', ton: 'orange', phrase: 'vient d’ouvrir' }
  };
  var MONTRES_ACCUEIL = 6;
  /* Accueil de la téléprospectrice : UN seul moment « trouver », au format de window.PHIRST_LIGNE, fabriqué avec ce que rend
     telepro_ligne (déjà converti par ligneDeTelepro). Jamais Préparer, Chantier ni Encaisser, jamais de somme.
     Rend [moment] ou null (ligne absente, illisible ou vieille de plus de 36 h : l'accueil reste sobre). */
  function momentDeTelepro(ligne) {
    var t = ligne && ligne.frais === true && ligne.trouver;
    if (!t || typeof t !== 'object') return null;
    var appels = Array.isArray(t.appels) ? t.appels : [], veille = Array.isArray(t.veille) ? t.veille : [];
    var m = { cle: 'trouver', mot: 'Trouver', pharmacies: [], total: 0, chose: null, vide: null, autres: null, source: 'appels' };
    if (appels.length) {
      m.pharmacies = appels.slice(0, MONTRES_ACCUEIL).map(function (a) {
        var e = MOTIFS[a.motif] || ['Signal', ''];
        return { nom: a.nom, ville: a.ville, etiquette: { t: e[0], ton: e[1] } };
      });
      // le total = ce que l'écran Appels lui montre vraiment (appelsTotal compte tout le plan de la V1, qu'elle ne voit nulle part)
      m.total = appels.length;
      if (m.total > MONTRES_ACCUEIL) m.autres = 'Voir les ' + (m.total - MONTRES_ACCUEIL) + ' autres dans Appels';
      var a0 = appels[0];
      m.chose = { heure: (MOTIFS[a0.motif] || ['Signal'])[0], titre: a0.nom + (a0.ville ? ', à ' + a0.ville : ''), detail: (a0.raisons && a0.raisons[0]) || null, bouton: 'Voir la fiche et appeler' };   // comme chez Yann : l'étiquette du motif, puis la raison
      return [m];
    }
    if (veille.length) {
      m.pharmacies = veille.slice(0, MONTRES_ACCUEIL).map(function (v) {
        var e = SIGNAL_VEILLE[v.famille] || { t: 'Signal', ton: '' };
        return { nom: v.nom, ville: v.ville, etiquette: { t: e.t, ton: e.ton } };
      });
      m.total = veille.length; m.source = 'veille';
      if (veille.length > MONTRES_ACCUEIL) m.autres = 'Voir les ' + (veille.length - MONTRES_ACCUEIL) + ' autres dans la Veille';
      var v0 = veille[0], s0 = SIGNAL_VEILLE[v0.famille] || { phrase: 'est sur la veille' };
      m.chose = { heure: 'Veille', titre: v0.nom + (v0.ville ? ', à ' + v0.ville : '') + ' ' + s0.phrase, detail: null, parution: v0.date || null, bouton: 'L’ajouter à mes pistes', type: 'veille', piste: v0.piste || null };
      return [m];
    }
    m.vide = { texte: 'Chaque matin, la veille du BODACC de votre secteur arrive ici\u00a0: pharmacies vendues, ouvertes ou en difficulté.', bouton: 'Ouvrir la Veille' };
    m.source = 'veille';
    return [m];
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

  /* ── Écrans Officines et Carte (21/11/2026) : logique PURE portée de ~/phirst-studio (lib/officines.ts, lib/couchesZoom.ts,
     lib/pharmacies.ts pour l'anti-doublon, lib/telepro.ts pour le retrait des sommes). Les lignes viennent de la table
     phirst_officines (chargée par le Mac) ; ici aucun accès à la base ni à la page. ── */
  var ANGLES = [
    { cle: 'toutes', nom: 'Toutes les officines' }, { cle: 'robots', nom: 'Robots concurrents' }, { cle: 'ehpad', nom: 'Fournisseurs EHPAD' },
    { cle: 'transferts', nom: 'Cessions et créations' }, { cle: 'signaux', nom: 'À saisir maintenant' }
  ];
  var N_INITIAL = 15, PAS_LISTE = 30;
  var FILTRES_SIGNAUX = [{ k: '', l: 'Tous les signaux' }, { k: 'cession', l: 'Vient de changer de main' }, { k: 'pmr', l: 'Accessibilité PMR à reprendre' },
    { k: 'ehpad', l: 'EHPAD à proximité' }, { k: 'sansRobot', l: 'Sans automate' }];
  var FILTRES_TRANSFERTS = [{ k: '', l: 'Tous' }, { k: 'Cession', l: 'Cessions (changement de main)' }, { k: 'Création', l: 'Créations (officine neuve)' }];
  function nomAngle(c) { for (var i = 0; i < ANGLES.length; i++) if (ANGLES[i].cle === c) return ANGLES[i].nom; return ANGLES[0].nom; }
  function angleValide(c) { for (var i = 0; i < ANGLES.length; i++) if (ANGLES[i].cle === c) return c; return 'toutes'; }

  /* Un texte qui parle d'argent : MÊME expression que phirst_montant (acces-telepro.sql) et contientMontant (lib/telepro.ts). */
  var MONTANT = /\d[\d\s .,]*\s?(?:[kM]\s?€|€|k?eur(?:o|os)?\b|ht\b|h\.t\.|ttc\b|t\.t\.c\.|k\b)|€\s?\d/i;
  function contientMontant(t) { return MONTANT.test(String(t == null ? '' : t)); }

  /* La recherche : sans accent ni majuscule comme la colonne `recherche` ; les signes qui casseraient un filtre REST sont retirés. */
  function recherchePropre(q) { return norm(q).replace(/[*%_,()"\\]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function depPropre(d) { return String(d == null ? '' : d).replace(/[^0-9A-Za-z]/g, '').slice(0, 5).toUpperCase(); }

  /* L'état de l'écran { angle, france, q, dep, fab } -> filtres [opération, colonne, valeur] à poser sur la table, dans l'ordre. */
  function requeteOfficines(e) {
    var a = angleValide(e && e.angle), f = [['eq', 'angle', a]];
    if (!e || !e.france) f.push(['eq', 'dans_secteur', true]);
    var q = recherchePropre(e && e.q); if (q) f.push(['ilike', 'recherche', '*' + q + '*']);
    var d = depPropre(e && e.dep); if (d) f.push(['like', 'dep', d + '*']);
    var k = String((e && e.fab) || '');
    if (k) {
      if (a === 'robots') f.push(k === 'omnicell' ? ['eq', 'cat', 'omnicell'] : ['eq', 'fab', k]);
      else if (a === 'transferts') f.push(['eq', 'tt_type', k]);
      else if (a === 'signaux') {
        var col = { cession: 'f_cession', pmr: 'f_pmr', ehpad: 'f_ehpad', sansRobot: 'f_sans_robot' }[k];
        if (col) f.push(['eq', col, true]);
      }
    }
    return f;
  }
  function libelleResultats(n) { return n.toLocaleString('fr-FR') + ' résultat' + (n > 1 ? 's' : ''); }
  function libelleVoirPlus(total, n) {
    var reste = total - n;
    if (reste <= 0) return null;
    if (reste >= PAS_LISTE) return 'Voir ' + PAS_LISTE + ' de plus';
    return reste === 1 ? 'Voir 1 de plus' : 'Voir les ' + reste + ' de plus';
  }
  function joindre() { return Array.prototype.slice.call(arguments).filter(Boolean).join(' · '); }
  function telFr(t) { var n = String(t == null ? '' : t).replace(/\D/g, ''); return n.length === 10 ? n.replace(/(\d{2})(?=\d)/g, '$1 ') : (t == null ? '' : String(t)); }
  function frDate(d) { if (!d) return ''; var p = String(d).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(d); }
  function libelleGroupements(l) { l = (l || []).filter(Boolean); return l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1]; }

  /* Les sommes. La table lisible par la téléprospectrice n'en contient AUCUNE (le chargeur les range dans phirst_officines_montants,
     que seuls les membres lisent). Un membre : on les remet à leur place. Elle : on retire par prudence tout ce qui en cite une,
     même si la base en avait laissé passer. montants = { champ: texte } ('robot_modele', 'pourquoi:<rang>'). */
  function fusionnerSommes(l, montants) {
    var o = {}, k; for (k in l) o[k] = l[k];
    var m = montants || {};
    o.pourquoi = (l.pourquoi || []).map(function (r, i) { return r === '' && m['pourquoi:' + i] ? m['pourquoi:' + i] : r; });
    if (m.robot_modele) o.robot_modele = m.robot_modele;
    return o;
  }
  function sansSommes(l) {
    var o = {}, k; for (k in l) o[k] = l[k];
    o.pourquoi = (l.pourquoi || []).filter(function (r) { return r && !contientMontant(r); });
    o.sieges = (l.sieges || []).filter(function (r) { return r && !contientMontant(r); });
    if (contientMontant(l.robot_modele)) o.robot_modele = null;
    if (l.angle === 'robots' && contientMontant(l.sous)) o.sous = String(l.sous).replace(/\s—\s.*$/, '');
    return o;
  }
  /* « → … » sous une ligne de signal : les raisons puis les numéros de siège ; les raisons vides (d'argent, non rendues) sautent. */
  function pourquoiAffiche(l) { return (l.pourquoi || []).filter(Boolean).concat((l.sieges || []).filter(Boolean)); }
  /* La sous-ligne d'un robot se refait avec le modèle complet quand le membre le connaît. */
  function sousAffiche(l) {
    if (l.angle === 'robots' && l.robot_modele) return joindre(joindre(l.dep ? String(l.dep) : '', l.ville), l.fab + ' — ' + l.robot_modele);
    return l.sous || '';
  }

  /* Source et note posées à l'ajout (champsRobot, champsTransfert, champsEhpad, champsSignal, sourceEtNoteToutes de lib/officines.ts). */
  function noteRobot(fab, modele, omni) { return 'Robot concurrent : ' + fab + (modele ? ' — ' + modele : '') + (omni ? ' (parc Omnicell en détresse — cible n°1 Riedl)' : ''); }
  function noteTransfert(type, date) { return type + ' d’officine (BODACC, ' + frDate(date) + ') — prospect agencement'; }
  function noteEhpad(n, proches) { var p = (proches || []).slice(0, 3).join(', '); return n + ' EHPAD à proximité' + (p ? ' (' + p + '…)' : '') + ' — prospect PDA / Farmadosis'; }
  function sourceEtNote(l) {
    if (l.angle === 'robots') return { source: 'robot', note: noteRobot(l.fab, l.robot_modele, l.cat === 'omnicell') };
    if (l.angle === 'transferts') return { source: 'transfert', note: noteTransfert(l.tt_type, l.tt_date) };
    if (l.angle === 'ehpad') return { source: 'pda', note: noteEhpad(l.n_ehpad, l.ehpad_proches) };
    if (l.angle === 'signaux') return { source: 'signal', note: (l.pourquoi || []).filter(Boolean).join(' · ') || undefined };
    if (l.tt_type) return { source: 'transfert', note: noteTransfert(l.tt_type, l.tt_date) };
    if (l.fab) return { source: 'robot', note: noteRobot(l.fab, l.robot_modele, false) };
    if (l.n_ehpad) return { source: 'pda', note: l.n_ehpad + ' EHPAD à proximité — prospect PDA' };
    return { source: 'annuaire', note: undefined };
  }
  /* La fiche à créer, au format de window.PHIRST_PISTE.ajouter (phirst-ligne.js). */
  function pisteDeLigne(l) {
    var sn = sourceEtNote(l), dep = l.angle === 'ehpad' ? '' : String(l.dep == null ? '' : l.dep);
    if (dep.length > 3) dep = dep.slice(0, 2);
    return { nom: l.nom_affiche || l.nom, cles: l.cles || [], ville: l.ville || '', cp: l.cp || '', departement: dep, pharmacien: l.pharmacien || '', telephone: l.telephone || '', email: l.email || '',
      groupement: libelleGroupements(l.groupements), lat: l.lat == null ? null : l.lat, lon: l.lon == null ? null : l.lon, source: sn.source, note: sn.note };
  }

  /* Anti-doublon : { 'nom|ville' : id } des fiches du compte ; une officine est « déjà suivie » si l'une de ses fiches y est. */
  function indexPistes(fiches) {
    var ix = {}; (fiches || []).forEach(function (f) { if (f && f.id) ix[cle(f.nom, f.ville)] = f.id; }); return ix;
  }
  function ficheSuivie(l, ix) {
    var c = (l.cles && l.cles.length ? l.cles : [cle(l.nom, l.ville)]);
    for (var i = 0; i < c.length; i++) if (ix && ix[c[i]]) return ix[c[i]];
    return null;
  }
  /* 23/11/2026 (Will) — une officine dont la fiche est archivée : la ligne dit « Archivée » et propose « Reprendre » (la MÊME fiche, jamais une deuxième).
     Une fiche vivante l'emporte toujours sur une archivée du même nom. suiviOfficine rend { etat: 'piste' | 'archivee' | '', id }. */
  function indexParEtat(fiches) {
    var vives = [], arch = [];
    (fiches || []).forEach(function (f) { if (f) (f.stage === 'archive' ? arch : vives).push(f); });
    return { vives: indexPistes(vives), archivees: indexPistes(arch) };
  }
  function suiviOfficine(l, ie) {
    var v = ficheSuivie(l, ie && ie.vives); if (v) return { etat: 'piste', id: v };
    var a = ficheSuivie(l, ie && ie.archivees); return a ? { etat: 'archivee', id: a } : { etat: '', id: null };
  }

  /* Seuils de zoom de la carte, choix de Will du 29/10/2026 « Masquer et le dire » : sous le seuil les couches ne se dessinent pas, le bandeau le dit. */
  var SEUIL_COUCHES = { only: 6, france: 8 };
  function couchesMasquees(zoom, perim) { return isFinite(zoom) && zoom < SEUIL_COUCHES[perim === 'france' ? 'france' : 'only']; }
  function listeFrancaise(n) { return n.length <= 1 ? (n[0] || '') : n.slice(0, -1).join(', ') + ' et ' + n[n.length - 1]; }
  function groupesCouches(c) { return (c || []).filter(function (x) { return x.n > 0; }).map(function (x) { return x.n.toLocaleString('fr-FR') + ' ' + x.nom; }); }
  function phraseCachee(c) { var g = groupesCouches(c); return g.length ? listeFrancaise(g) + ' cachés à cette échelle' : ''; }
  function phraseToutAffiche(c) { var g = groupesCouches(c); return g.length ? 'Tout est affiché : ' + listeFrancaise(g) : ''; }
  function phraseVue(c) { var g = groupesCouches(c); return g.length ? 'Dans cette vue : ' + listeFrancaise(g) : ''; }
  /* « Relevé le … » : montré seulement quand les données (charge_le) ont plus de 30 jours ; sinon rien. */
  function releveAffiche(chargeLe, jour) {
    if (!chargeLe) return '';
    var d = String(chargeLe).slice(0, 10);
    return joursEntre(d, jour) > 30 ? 'Données relevées le ' + frDate(d) + '.' : '';
  }
  function libelleBouton(perim) { return perim === 'france' ? 'Zoomer pour tout voir' : 'Zoomer sur mon secteur'; }

  /* Tournée du jour de la carte du CRM (lib/tourneeCarte.ts de la V1, mêmes calculs) : fiches à action due, dans l'ordre de visite le plus court. */
  function kmRoute(r) { var n = 0; for (var i = 1; i < r.length; i++) n += kmEntre(r[i - 1], r[i]); return n; }
  function chaineProche(stops, depart) {
    var rest = stops.filter(function (x) { return x !== depart; }), out = [depart], cur = depart;
    while (rest.length) {
      var bi = 0, bd = Infinity;
      rest.forEach(function (x, k) { var d = kmEntre(cur, x); if (d < bd) { bd = d; bi = k; } });
      cur = rest[bi]; out.push(cur); rest.splice(bi, 1);
    }
    return out;
  }
  function ordreTournee(stops) {
    if (stops.length < 3) return stops.slice();
    if (stops.length > 80) return chaineProche(stops, stops[0]);
    var best = chaineProche(stops, stops[0]), bestKm = kmRoute(best);
    stops.slice(1).forEach(function (st) { var r = chaineProche(stops, st), d = kmRoute(r); if (d < bestKm) { best = r; bestKm = d; } });
    var mieux = true;
    while (mieux) {
      mieux = false;
      for (var i = 0; i < best.length - 2 && !mieux; i++) {
        for (var j = i + 2; j < best.length; j++) {
          var cand = best.slice(0, i + 1).concat(best.slice(i + 1, j + 1).reverse(), best.slice(j + 1)), d = kmRoute(cand);
          if (d < bestKm - 0.01) { best = cand; bestKm = d; mieux = true; break; }
        }
      }
    }
    return best;
  }
  /* Les fiches de la tournée : action due aujourd'hui ou avant, ni perdue ni signée, avec une adresse sur la carte. */
  function tourneeDuJour(pistes, jour) {
    var ok = (pistes || []).filter(function (p) {
      var la = typeof p.lat === 'string' ? parseFloat(p.lat) : p.lat, lo = typeof p.lon === 'string' ? parseFloat(p.lon) : p.lon;
      return p.next_action_date && String(p.next_action_date).slice(0, 10) <= jour && p.stage !== 'perdu' && p.stage !== 'signe' && p.stage !== 'archive' &&
        isFinite(la) && isFinite(lo) && la !== null && lo !== null;
    }).map(function (p) { var o = {}; for (var k in p) o[k] = p[k]; o.lat = +p.lat; o.lon = +p.lon; return o; });
    return ordreTournee(ok);
  }
  /* Itinéraire Google Maps (10 points au plus, comme la V1) ; null s'il n'y a pas au moins deux arrêts. */
  function lienTournee(stops) {
    if (!stops || stops.length < 2) return null;
    var pts = stops.slice(0, 10), fin = pts[pts.length - 1];
    var way = pts.slice(0, -1).map(function (p) { return p.lat + ',' + p.lon; }).join('|');
    return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + fin.lat + ',' + fin.lon + '&waypoints=' + encodeURIComponent(way);
  }

  /* 22/11/2026 — dates lisibles : l'année s'ajoute quand elle n'est pas celle du jour de référence (une date de 2023 ne se lit plus comme une date de cette année). */
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function jourAvecAnnee(iso, ref) {
    if (!estJour(iso)) return '';
    var an = String(iso).slice(0, 4), r = String(ref || aujourdhui()).slice(0, 4);
    return jourFr(iso) + (an === r ? '' : ' ' + an);
  }
  /* Dans une phrase du robot : « le 03/08/2023 » devient « le 3 août 2023 » ; « 03/08/2026 » devient « 3 août » quand c'est l'année du jour. */
  function datesLisibles(texte, ref) {
    return String(texte == null ? '' : texte).replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, function (tout, j, m, a) {
      var jj = +j, mm = +m;
      if (mm < 1 || mm > 12 || jj < 1 || jj > 31) return tout;
      return jj + (jj === 1 ? 'er ' : ' ') + MOIS[mm - 1] + (a === String(ref || aujourdhui()).slice(0, 4) ? '' : ' ' + a);
    });
  }
  /* « ce matin à 7 h 05 » / « hier à 7 h 05 » / « le 12 octobre à 7 h 05 » : l'heure du dernier passage du robot, à l'heure de Paris. */
  function miseAJourFr(iso, maintenant) {
    var t = Date.parse(iso); if (!isFinite(t)) return '';
    var now = maintenant == null ? Date.now() : maintenant;
    var jr = aujourdhui(new Date(t)), auj = aujourdhui(new Date(now));
    var p = {}; new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    var h = +p.hour, heure = h + ' h' + (+p.minute ? ' ' + p.minute : '');
    var quand = jr === auj ? (h < 12 ? 'ce matin' : 'aujourd’hui') : jr === ajouterJours(auj, -1) ? 'hier' : 'le ' + jourAvecAnnee(jr, auj);
    return quand + ' à ' + heure;
  }

  /* ── La fiche de la carte (24/11/2026, maquette v2 « posée sur la carte » choisie par Will) ──
     Une pharmacie = UNE fiche : ses lignes de tous les angles (robots, transferts, EHPAD, signaux, annuaire), réunies par une clé nom|ville
     en commun. La fiche vit HORS de la carte : glisser, zoomer ou recharger les points ne la ferment plus. */
  var PRIO_FICHE = ['robots', 'transferts', 'ehpad', 'signaux', 'toutes'];
  function tel9(t) { var n = String(t == null ? '' : t).replace(/\D/g, ''); return n.length >= 9 ? n.slice(-9) : ''; }
  function clesDe(l) { return l.cles && l.cles.length ? l.cles : [cle(l.nom, l.ville)]; }
  /* Les lignes de la MÊME pharmacie que l : une clé en commun, et rien qui les contredise (téléphone différent, ou à plus de 2 km). */
  function memePharmacie(l, autres) {
    var c = clesDe(l), t = tel9(l.telephone), vus = {}, out = [l];
    vus[l.cle] = 1;
    (autres || []).forEach(function (x) {
      if (!x || vus[x.cle]) return;
      if (!clesDe(x).some(function (k) { return c.indexOf(k) >= 0; })) return;
      var xt = tel9(x.telephone); if (t && xt && t !== xt) return;
      if (typeof l.lat === 'number' && typeof x.lat === 'number' && typeof l.lon === 'number' && typeof x.lon === 'number' && kmEntre(l, x) > 2) return;
      vus[x.cle] = 1; out.push(x);
    });
    return out;
  }
  /* La fiche : pour chaque champ, la première valeur trouvée dans l'ordre robots > transferts > EHPAD > signaux > annuaire ;
     les listes sont réunies sans doublon ; un seul « N pts » et un seul « N EHPAD » (le plus grand). */
  function ficheDeLignes(lignes) {
    var ls = (lignes || []).filter(Boolean).slice().sort(function (a, b) { return PRIO_FICHE.indexOf(a.angle) - PRIO_FICHE.indexOf(b.angle); });
    function prem(k) { for (var i = 0; i < ls.length; i++) if (ls[i][k] != null && ls[i][k] !== '') return ls[i][k]; return null; }
    function union(k) { var o = []; ls.forEach(function (l) { (l[k] || []).forEach(function (v) { if (v && o.indexOf(v) < 0) o.push(v); }); }); return o; }
    function une(k) { return ls.some(function (l) { return !!l[k]; }); }
    var et = [], pts = null, eh = null, angles = [];
    ls.forEach(function (l) {
      if (angles.indexOf(l.angle) < 0) angles.push(l.angle);
      (l.etiquettes || []).forEach(function (e) {
        if (!e || !e.texte) return;
        var mp = /^(\d+) pts$/.exec(e.texte), me = /^(\d+) EHPAD$/.exec(e.texte);
        if (mp) { if (!pts || +mp[1] > +pts.n) pts = { n: mp[1], e: e }; }
        else if (me) { if (!eh || +me[1] > +eh.n) eh = { n: me[1], e: e }; }
        else if (!et.some(function (x) { return x.texte === e.texte; })) et.push(e);
      });
    });
    if (pts) et.push(pts.e);
    if (eh) et.push(eh.e);
    var f = { lignes: ls.map(function (l) { return l.cle; }), angles: angles, cles: union('cles'),
      nom: prem('nom_affiche') || prem('nom') || '', ville: prem('ville'), cp: prem('cp'), dep: prem('dep'), lat: prem('lat'), lon: prem('lon'),
      pharmacien: prem('pharmacien'), telephone: prem('telephone'), email: prem('email'),
      groupements: union('groupements'), sieges: union('sieges'), etiquettes: et, pourquoi: union('pourquoi'),
      fab: prem('fab'), cat: prem('cat'), robot_modele: prem('robot_modele'), robot_date: prem('robot_date'),
      tt_type: prem('tt_type'), tt_date: prem('tt_date'), annonce: prem('annonce'),
      ehpad_proches: union('ehpad_proches'), n_ehpad: ls.reduce(function (m, l) { return Math.max(m, l.n_ehpad || 0); }, 0),
      f_cession: une('f_cession'), f_pmr: une('f_pmr'), f_sans_robot: une('f_sans_robot'), dans_secteur: une('dans_secteur') };
    /* La fiche à créer (« Ajouter aux officines à appeler ») part de la ligne la plus parlante, avec TOUTES les clés de la pharmacie. */
    var base = {}, k; for (k in (ls[0] || {})) base[k] = ls[0][k];
    base.cles = f.cles.length ? f.cles : clesDe(base.nom ? base : { nom: f.nom, ville: f.ville });
    f.piste = ls.length ? base : null;
    return f;
  }
  /* Le bloc « Cliente d'Intégral Pharma » : le nom du commercial, son téléphone et son mail PROFESSIONNELS, rien d'autre.
     infos = les lignes de phirst_integral trouvées pour la pharmacie ; aucune = null (une officine non reliée : RIEN sur Intégral). */
  function blocIntegral(infos) {
    var i = (infos || []).filter(Boolean)[0];
    if (!i) return null;
    var c = (infos || []).filter(function (x) { return x && x.commercial; })[0] || i;
    var t = String(c.tel == null ? '' : c.tel).replace(/[^\d+]/g, ''), m = String(c.mail == null ? '' : c.mail).trim();
    return { commercial: c.commercial ? String(c.commercial).trim() : '', tel: t.replace(/\D/g, '').length >= 9 ? telFr(t) : '', telHref: t.replace(/\D/g, '').length >= 9 ? 'tel:' + t : '',
      mail: /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[a-z]{2,}$/i.test(m) ? m : '' };
  }
  /* Les couches de la carte : « Clients Intégral » pour Yann seulement, jamais pour la téléprospectrice. */
  function ordreCouches(yann) {
    var o = ['fiches', 'robots', 'transferts', 'ehpad', 'signaux', 'toutes'];
    return yann ? o.concat('integral') : o;
  }
  /* Les clientes d'Intégral se cherchent sur les lignes de l'annuaire (une par pharmacie), jointes à phirst_integral. */
  var SELECT_INTEGRAL = ',phirst_integral!inner(cle)';
  function filtresIntegral(perim) { return requeteOfficines({ angle: 'toutes', france: perim === 'france' }); }

  return {
    jourAvecAnnee: jourAvecAnnee, datesLisibles: datesLisibles, miseAJourFr: miseAJourFr,
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
    equipeParId: equipeParId, estTelepro: estTelepro, nomAuteur: nomAuteur, avecAuteur: avecAuteur, ligneDeTelepro: ligneDeTelepro, momentDeTelepro: momentDeTelepro, MOTIFS: MOTIFS, agendaDeTelepro: agendaDeTelepro, messageDeLaBase: messageDeLaBase,
    ANGLES: ANGLES, N_INITIAL: N_INITIAL, PAS_LISTE: PAS_LISTE, FILTRES_SIGNAUX: FILTRES_SIGNAUX, FILTRES_TRANSFERTS: FILTRES_TRANSFERTS, nomAngle: nomAngle, angleValide: angleValide,
    contientMontant: contientMontant, recherchePropre: recherchePropre, depPropre: depPropre, requeteOfficines: requeteOfficines, libelleResultats: libelleResultats, libelleVoirPlus: libelleVoirPlus,
    telFr: telFr, frDate: frDate, libelleGroupements: libelleGroupements, fusionnerSommes: fusionnerSommes, sansSommes: sansSommes, pourquoiAffiche: pourquoiAffiche, sousAffiche: sousAffiche,
    sourceEtNote: sourceEtNote, pisteDeLigne: pisteDeLigne, indexPistes: indexPistes, ficheSuivie: ficheSuivie, indexParEtat: indexParEtat, suiviOfficine: suiviOfficine,
    SEUIL_COUCHES: SEUIL_COUCHES, couchesMasquees: couchesMasquees, phraseCachee: phraseCachee, phraseToutAffiche: phraseToutAffiche, phraseVue: phraseVue, libelleBouton: libelleBouton, releveAffiche: releveAffiche,
    ordreTournee: ordreTournee, tourneeDuJour: tourneeDuJour, lienTournee: lienTournee, kmRoute: kmRoute,
    tel9: tel9, memePharmacie: memePharmacie, ficheDeLignes: ficheDeLignes, blocIntegral: blocIntegral, ordreCouches: ordreCouches,
    SELECT_INTEGRAL: SELECT_INTEGRAL, filtresIntegral: filtresIntegral
  };
});
