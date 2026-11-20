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
      var f = (r.prospectId && parId[r.prospectId]) || parCle[r.cle || cle(r.nom, r.ville)] || null;
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
  function nomFamille(c) { for (var i = 0; i < FAMILLES.length; i++) if (FAMILLES[i].cle === c) return FAMILLES[i].nom; return ''; }
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
      if (type === 'qualif') return o.q && o.r ? o.q + ' : ' + o.r : 'Qualification';
      return b ? 'Mise à jour' : 'Note';
    }
    if (type === 'fait') return 'C’est fait';
    if (type === 'relance') return 'Relance envoyée';
    return b || (type === 'appel' ? 'Appel' : 'Note');
  }

  return {
    SECTEUR: SECTEUR, rang: rang, dansSecteur: dansSecteur, primeSecteur: primeSecteur, norm: norm, cle: cle,
    aujourdhui: aujourdhui, ajouterJours: ajouterJours, joursEntre: joursEntre, estJour: estJour, jourFr: jourFr,
    ETAPES: ETAPES, nomEtape: nomEtape, grouperParEtape: grouperParEtape,
    relancesDues: relancesDues, dernierAppelParFiche: dernierAppelParFiche, listeDuJour: listeDuJour,
    SUITES: SUITES, suiteAppel: suiteAppel,
    FAMILLES: FAMILLES, nomFamille: nomFamille, trierVeille: trierVeille, filtrerVeille: filtrerVeille,
    departementsDe: departementsDe, compterFamilles: compterFamilles, age: age, lienSur: lienSur, phraseJournal: phraseJournal
  };
});
