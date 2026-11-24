/* PHIRST · écran « Appels » (21/11/2026) : la liste du jour, les pistes par étape, la fiche d'une piste.
   Transposé de la V1 (~/phirst-studio) : liste = getCallPlan (calculée chaque matin par le robot du Mac, rangée dans
   ligne_accueil.donnees[0].appels) + relances dues lues en direct ; les quatre boutons après l'appel = logCall
   (app/crm/actions.ts) ; fiche = moveStage, setNextAction, addActivity. Logique pure dans phirst-pur.js (testée).
   Écritures : SEULEMENT dans l'espace du compte connecté (crm_members), jamais de suppression.
   Charge aussi l'accès à la ligne du compte (window.PHIRST_DONNEES) que l'écran Veille réutilise.
   21/11/2026 — téléprospectrice : elle n'est PAS membre de l'espace ; tout passe par les fonctions de la base (acces-telepro.sql :
   telepro_pistes, telepro_journal, telepro_ligne, telepro_ecrire, telepro_suite, telepro_creer_piste, telepro_agenda, phirst_equipe).
   Son rôle se lit dans la session (window.PHIRST_ROLE), pour l'AFFICHAGE seulement : la base filtre de toute façon. */
(function () {
  'use strict';
  var P = window.PHIRST_PUR, V2 = window.V2, T = window.PHIRST_TEXTES_PUR, A = window.PHIRST_APPELS_PUR;   // T : les textes de Yann (phirst-textes-pur.js) ; absent = les trois blocs ne s'affichent pas, rien d'autre ne change
  if (!P || !V2) return;
  V2.pages = V2.pages || {};
  var PAS = 'Pas enregistré : réessayez dans un instant.';
  var AGE_MAX = 36 * 3600 * 1000;
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }

  /* ── Son rôle : lu dans la session (app_metadata, écrit par la clé de service seule), JAMAIS user_metadata. En cache par
     identifiant ; une lecture qui échoue (pas de session, panne) ne se garde pas. ── */
  var cacheRole = { pour: null, p: null };
  window.PHIRST_ROLE = {
    estTelepro: function () {
      var u = V2.user, b = sb();
      if (!u || !b) return Promise.resolve(false);
      if (cacheRole.pour === u.id && cacheRole.p) return cacheRole.p;
      var pour = u.id, p;
      function oublier(v) { if (cacheRole.p === p) cacheRole = { pour: null, p: null }; return v; }
      p = b.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session, m = s && s.user && s.user.app_metadata;
        if (!m || s.user.id !== pour) return oublier(false);
        return m.phirst_role === 'telepro';
      }, function () { return oublier(false); });
      cacheRole = { pour: pour, p: p };
      return p;
    },
    oublier: function () { cacheRole = { pour: null, p: null }; }
  };
  var ROLE = window.PHIRST_ROLE;

  /* ── Les personnes de l'espace (phirst_equipe, ouverte à Yann comme à elle) : « qui a appelé », et qui est téléprospectrice. ── */
  var cacheEquipe = { pour: null, p: null }, equipeCourante = {};
  var EQUIPE = window.PHIRST_EQUIPE = {
    lire: function () {
      var u = V2.user, b = sb();
      if (!u || !b) return Promise.resolve({});
      if (cacheEquipe.pour === u.id && cacheEquipe.p) return cacheEquipe.p;
      var p;
      function oublier() { if (cacheEquipe.p === p) cacheEquipe = { pour: null, p: null }; equipeCourante = {}; return {}; }
      p = b.rpc('phirst_equipe').then(function (r) {
        if (!r || r.error || !Array.isArray(r.data)) return oublier();
        equipeCourante = P.equipeParId(r.data); return equipeCourante;
      }, oublier);
      cacheEquipe = { pour: u.id, p: p };
      return p;
    },
    estTelepro: function (id) { return P.estTelepro(equipeCourante, id); }
  };

  /* ── La ligne du compte : « trouver » porte appels et veille. Posée d'avance (sondes) ou lue en base. ── */
  var cacheLigne = { pour: null, p: null };
  window.PHIRST_DONNEES = {
    ligne: function () {
      var u = V2.user;
      if (Array.isArray(window.PHIRST_LIGNE)) return Promise.resolve({ trouver: window.PHIRST_LIGNE[0] || null, frais: true });
      if (!u || !sb()) return Promise.resolve({ trouver: null, frais: false });
      if (cacheLigne.pour === u.id && cacheLigne.p) return cacheLigne.p;
      cacheLigne.pour = u.id;
      cacheLigne.p = ROLE.estTelepro().then(function (t) {
        if (t) return sb().rpc('telepro_ligne').then(function (r) { return r && !r.error ? P.ligneDeTelepro(r.data, Date.now()) : { trouver: null, frais: false }; });
        return sb().from('ligne_accueil').select('donnees,calcule_le').eq('user_id', u.id).maybeSingle().then(function (r) {
          var x = r && !r.error && r.data;
          if (!x || !Array.isArray(x.donnees)) return { trouver: null, frais: false };
          return { trouver: x.donnees[0] || null, frais: Date.now() - Date.parse(x.calcule_le) <= AGE_MAX, calculeLe: x.calcule_le || null };
        });
      }).then(null, function () { return { trouver: null, frais: false }; });
      return cacheLigne.p;
    },
    oublier: function () { cacheLigne = { pour: null, p: null }; }
  };

  /* ── Les rendez-vous de l'espace : lus ici, partagés avec l'écran Agenda (phirst-agenda.js) ──
     Un rendez-vous = une ligne `crm_activities` de type « rdv » (format de la V1, voir phirst-pur.js). On AJOUTE, on ne modifie
     ni ne supprime jamais. estTelepro lit phirst_equipe (ligne d'équipe de l'auteur, telepro = true) : un rendez-vous pris par
     elle arrive « À confirmer » chez Yann. Pour elle, tout vient de telepro_agenda et telepro_ecrire. */
  function lireTelepro(base) {
    return base.rpc('telepro_agenda').then(function (r) {
      if (!r || r.error || !Array.isArray(r.data)) throw new Error('agenda');
      var a = P.agendaDeTelepro(r.data);
      return { fiches: a.fiches, rdvs: P.etatsDesRdv(a.lignes, RDV.estTelepro) };
    });
  }
  var RDV = window.PHIRST_RDV = {
    estTelepro: function (id) { return EQUIPE.estTelepro(id); },
    /* Relit tout (l'équipe d'abord, pour savoir qui est téléprospectrice) : les fiches de l'espace puis leurs lignes rdv. Rend { fiches, rdvs }. */
    lire: function (base, ws) {
      return Promise.all([ROLE.estTelepro(), EQUIPE.lire()]).then(function (x) { return x[0] ? lireTelepro(base) : RDV.lireMembre(base, ws); });
    },
    lireMembre: function (base, ws) {
      return base.from('crm_prospects').select('id,nom,ville,cp,lat,lon,stage').eq('workspace_id', ws).then(function (f) {
        if (f.error) throw new Error('fiches');
        var fiches = f.data || [], ids = fiches.map(function (x) { return x.id; }), lots = [];
        for (var i = 0; i < ids.length; i += 80) lots.push(ids.slice(i, i + 80));
        return Promise.all(lots.map(function (l) {
          return base.from('crm_activities').select('id,prospect_id,author_id,created_at,body').eq('type', 'rdv').in('prospect_id', l).limit(1000);
        })).then(function (rs) {
          var lignes = [];
          rs.forEach(function (r) { if (r.error) throw new Error('rdv'); lignes = lignes.concat(r.data || []); });
          return { fiches: fiches, rdvs: P.etatsDesRdv(lignes, RDV.estTelepro) };
        });
      });
    },
    /* Ce qui occupe Yann, pour calculer les créneaux : un rendez-vous non annulé, avec le lieu de sa pharmacie. */
    occupations: function (rdvs, fiches) {
      var par = {}; fiches.forEach(function (f) { par[f.id] = f; });
      return rdvs.filter(P.occupe).map(function (r) {
        var f = par[r.prospect_id] || {};
        return { debut: r.debut, fin: r.fin, commune: f.ville || null, lat: f.lat == null ? null : f.lat, lon: f.lon == null ? null : f.lon };
      });
    },
    /* Ajoute UNE ligne rdv. extra : debut, duree_min, lieu, objet. */
    ecrire: function (base, prospectId, quoi, rdvId, extra) {
      var corps = P.corpsRdv(quoi, rdvId, V2.user.id, extra);
      return ROLE.estTelepro().then(function (t) {
        return t ? base.rpc('telepro_ecrire', { p_prospect: prospectId, p_type: 'rdv', p_body: corps }) : base.from('crm_activities').insert({ prospect_id: prospectId, type: 'rdv', body: corps });
      });
    },
    /* Les trois meilleurs créneaux de Yann sur les 10 prochains jours ouvrés. */
    propositions: function (rdvs, fiches, cible, sauf) {
      var occ = RDV.occupations(rdvs.filter(function (r) { return r.id !== sauf; }), fiches);
      return P.meilleursCreneaux({ jours: P.joursProposes(P.aujourdhui()), occupations: occ, cible: cible, maintenant: P.maintenantParis(), combien: 3 });
    },
    /* La route dite en clair sous un créneau proposé (pour la téléprospectrice, c'est Yann qui est dans le secteur). */
    detail: function (c, pourTelepro) {
      var a = c.trajetAvant ? 'environ ' + P.dureeFr(c.trajetAvant) + ' de route depuis ' + c.depuis : 'départ de ' + c.depuis;
      return (c.dansLeSecteur ? (pourTelepro ? 'Yann est déjà dans le secteur · ' : 'Vous êtes déjà dans le secteur · ') : '') + (c.vers && c.trajetApres ? a + ', puis ' + c.vers : a);
    },
    /* Une heure choisie à la main : « AAAA-MM-JJ » + « HH:MM », par pas de 30 minutes. */
    heureLibre: function (jr, hm) {
      if (!P.estJour(jr) || !/^\d{2}:\d{2}$/.test(hm || '')) return { erreur: 'Choisissez un jour et une heure.' };
      var pas = P.REGLAGES_AGENDA.pasMin;
      if (Number(hm.slice(3)) % pas !== 0) return { erreur: 'Choisissez une heure ronde ou à la demie : 9 h, 9 h 30…' };
      return { debut: jr + 'T' + hm };
    }
  };

  /* ── État de l'écran ── */
  /* Le réglage « Trier » se garde sur cet appareil (par raison / par bon moment). */
  function lireTri() { try { return window.localStorage.getItem('phirst-tri-appels') === 'moment' ? 'moment' : 'raison'; } catch (e) { return 'raison'; } }
  function ecrireTri(v) { try { window.localStorage.setItem('phirst-tri-appels', v); } catch (e) { /* pas gardé : sans importance */ } }
  var S = { racine: null, jeton: 0, telepro: false, onglet: 'jour', fiche: null, ouverte: null, ws: null, fiches: [], appelAu: {}, robot: null, avis: '', flash: '', charge: false, erreur: false,
    textes: null, dits: {}, repSel: {}, fois: {}, vph: {},
    journal: [], habK: -1, hab: {}, marque: null, tri: lireTri(), doc: {}, relaisOuv: {}, gardees: {}, cinq: null, quandCtx: {} };   // L2 : bon moment, relais par écrit, cinq questions
  var COLS = 'id,nom,ville,cp,departement,telephone,email,pharmacien,stage,source,next_action,next_action_date,lat,lon,updated_at';
  var MOTIFS = P.MOTIFS;
  function jour() { return P.aujourdhui(); }
  function versJourParis(iso) { return P.aujourdhui(new Date(iso)); }

  function charger() {
    var u = V2.user, tok = ++S.jeton, base = sb();
    S.charge = false; S.erreur = false;
    if (!u || !base) { S.erreur = true; dessiner(); return; }
    dessiner();
    ROLE.estTelepro().then(function (t) {
      if (tok !== S.jeton) return;
      S.telepro = t;
      return t ? chargerTelepro(tok, base) : chargerMembre(tok, base, u);
    }).then(null, function () { if (tok === S.jeton) { S.erreur = true; dessiner(); } });
  }
  /* Ses pistes = les étapes où elle peut agir (et « perdu », en lecture) : un devis ou un chantier reste à Yann, la base y refuse ses écritures. */
  function sienne(f) { return ['a_qualifier', 'a_rappeler', 'rdv_fixe', 'perdu'].indexOf(f.stage) >= 0; }
  /* Téléprospectrice : ses pistes, le journal de son espace (pour « déjà appelée »), la liste du robot, l'équipe. Tout par les fonctions. */
  function chargerTelepro(tok, base) {
    return Promise.all([base.rpc('telepro_pistes'), base.rpc('telepro_journal', { p_prospect: null }), window.PHIRST_DONNEES.ligne(), EQUIPE.lire(), chargerTextes(base, true, null), chargerMarque(base)]).then(function (r) {
      if (!r[0] || r[0].error || !Array.isArray(r[0].data) || !r[1] || r[1].error || !Array.isArray(r[1].data)) throw new Error('fiches');
      if (tok !== S.jeton) return;
      S.ws = null; S.fiches = r[0].data.filter(sienne); S.appelAu = P.dernierAppelParFiche(r[1].data, versJourParis);
      S.robot = r[2]; S.textes = r[4]; S.marque = r[5]; S.journal = r[1].data; S.habK = -1; S.gardees = {}; S.charge = true; dessiner();
    });
  }
  /* Le réglage de la marque (signature, lien vers la présentation de Yann) : lu en base, jamais écrit ici. Une lecture qui échoue = null (le mail part sans lien). */
  function chargerMarque(base) {
    return Promise.resolve(base.rpc('phirst_marque_publique')).then(function (r) { return r && !r.error && r.data && typeof r.data === 'object' ? r.data : null; }, function () { return null; });
  }
  /* Les textes de Yann (idées 1, 2, 8). Elle : telepro_textes (phrases, réponses avec leur compte du mois, références CITABLES seulement).
     Yann : ses tables, sous sa règle d'accès. Une lecture qui échoue rend null : l'écran garde les propositions de départ et ne dit jamais « rien d'écrit ». */
  function chargerTextes(base, telepro, ws) {
    if (!T) return Promise.resolve(null);
    var q;
    if (telepro) q = base.rpc('telepro_textes').then(function (r) {
      var d = r && !r.error && r.data && typeof r.data === 'object' ? r.data : null;
      return d ? { phrases: T.phrasesParCle(d.phrases), reponses: Array.isArray(d.reponses) ? d.reponses : [], refs: T.referencesCitables(d.references) } : null;
    });
    else q = ws ? Promise.all([
      base.from('phirst_textes').select('id,sorte,cle,titre,texte,details').eq('workspace_id', ws).order('created_at', { ascending: true }).limit(500),
      base.from('phirst_entendues').select('texte_id,created_at').eq('workspace_id', ws).gte('created_at', new Date(Date.now() - 40 * 864e5).toISOString()).limit(5000)
    ]).then(function (x) {
      if (!x[0] || x[0].error || !x[1] || x[1].error) return null;
      var l = x[0].data || [], c = T.comptesDuMois(x[1].data || [], Date.now());
      return { phrases: T.phrasesParCle(l.filter(function (t) { return t.sorte === 'phrase'; })),
        reponses: l.filter(function (t) { return t.sorte === 'reponse' && t.titre && t.texte && t.texte.trim(); }).map(function (t) { return { id: t.id, titre: t.titre, texte: t.texte, fois: c[t.id] || 0 }; }),
        refs: T.referencesCitables(l.filter(function (t) { return t.sorte === 'reference'; })) };
    }) : Promise.resolve(null);
    return q.then(null, function () { return null; });
  }
  function chargerMembre(tok, base, u) {
    return Promise.all([
      base.from('crm_members').select('workspace_id').eq('user_id', u.id).limit(1).maybeSingle(),
      window.PHIRST_DONNEES.ligne()
    ]).then(function (r) {
      var ws = r[0] && !r[0].error && r[0].data && r[0].data.workspace_id;
      if (!ws) throw new Error('espace');
      return base.from('crm_prospects').select(COLS).eq('workspace_id', ws).then(function (f) {
        if (f.error) throw new Error('fiches');
        var ids = (f.data || []).map(function (x) { return x.id; });
        var tx = chargerTextes(base, false, ws);
        var act = ids.length ? base.from('crm_activities').select('prospect_id,type,body,created_at').in('type', ['appel', 'note']).in('prospect_id', ids).order('created_at', { ascending: false }).limit(2000) : Promise.resolve({ data: [] });
        return Promise.all([act, tx, chargerMarque(base)]).then(function (ax) {
          var a = ax[0];
          if (tok !== S.jeton) return;
          S.textes = ax[1]; S.marque = ax[2]; S.journal = a.data || []; S.habK = -1; S.gardees = {}; S.ws = ws; S.fiches = f.data || []; S.appelAu = P.dernierAppelParFiche(a.data || [], versJourParis);
          S.robot = r[1]; S.charge = true; dessiner();
        });
      });
    });
  }

  /* ── Affichage ── */
  function tel(t) {
    if (!t) return '';
    var n = String(t).replace(/[^0-9+]/g, '');
    return '<a class="pa-tel" href="tel:' + esc(n) + '">' + esc(String(t).replace(/(\d{2})(?=\d)/g, '$1 ').trim()) + '</a>';
  }
  function liste() {
    var robot = (S.robot && S.robot.frais && S.robot.trouver && Array.isArray(S.robot.trouver.appels)) ? S.robot.trouver.appels : [];
    var l = P.listeDuJour(robot, S.fiches, S.appelAu, jour());
    if (!A) return l;
    Object.keys(S.gardees).forEach(function (k) {   // une pharmacie qu'on vient de noter « injoignable » pour la 2e fois reste là : la barre « Lui écrire plutôt » s'affiche sous son nom
      var g = S.gardees[k]; if (!l.some(function (x) { return P.cle(x.nom, x.ville) === k; })) l.splice(Math.min(g.i, l.length), 0, g.r);
    });
    return S.tri === 'moment' ? A.trierParMoment(l, habitudes(), heureNow(), idDe) : l;
  }
  function idDe(r) { return r.prospectId || null; }
  function heureNow() { return Number(P.maintenantParis().slice(11, 13)); }
  /* L'heure habituelle de chaque pharmacie, apprise du journal (recalculée seulement quand le journal change). */
  function habitudes() {
    var cle = S.journal.length + ':' + (S.journal[0] ? S.journal[0].created_at : '');
    if (S.habK !== cle) { S.hab = A.habitudes(S.journal); S.habK = cle; }
    return S.hab;
  }
  function ficheDe(r) {
    return (r.prospectId && S.fiches.filter(function (f) { return f.id === r.prospectId; })[0]) ||
      (function () { var c = P.cle(r.nom, r.ville); var t = S.fiches.filter(function (f) { return P.cle(f.nom, f.ville) === c; }); return t.filter(function (f) { return f.stage !== 'archive'; })[0] || t[0] || null; })();
  }
  /* 22/11/2026 — une ligne par pharmacie (nom, motif, raison n° 1) ; la pharmacie OUVERTE montre son numéro, les autres raisons et les 4 boutons « après l'appel ».
     La première est ouverte d'office : elle appelle, note, et la suivante s'ouvre. */
  function ligneAppel(r, i) {
    var m = P.etiquetteDe(r), autres = (r.raisons || []).slice(1), ouv = P.cle(r.nom, r.ville) === S.ouverte, id = 'pa-d' + i;
    var raison = P.datesLisibles((r.raisons || [])[0] || '', jour());
    var garde = !!S.gardees[P.cle(r.nom, r.ville)], sous = A ? sousLeNom(r) : '';
    return '<li class="pa-l' + (ouv ? ' pa-ouvert' : '') + '" data-i="' + i + '"><button type="button" class="pa-ligne" data-ouvrir="' + i + '" aria-expanded="' + ouv + '" aria-controls="' + id + '">' +
      '<span class="pa-nom"><b>' + esc(r.nom) + '</b><small>' + esc(r.ville) + (r.dep ? ' · ' + esc(r.dep) : '') + '</small>' + sous + '</span>' +
      '<em class="lg-et"' + (m[1] ? ' data-ton="' + m[1] + '"' : '') + '>' + esc(m[0]) + '</em>' +
      '<span class="pa-r1">' + esc(raison) + '</span><span class="pa-chev" aria-hidden="true"></span></button>' +
      '<div class="pa-det" id="' + id + '"' + (ouv ? '' : ' hidden') + '><div class="pa-det-g">' +
      '<p class="pa-nu">' + (r.telephone ? tel(r.telephone) : '<span>Numéro à chercher avant d’appeler</span>') + (P.lienSur(r.lien) ? ' <a class="pa-lien" href="' + esc(P.lienSur(r.lien)) + '" target="_blank" rel="noopener">Voir la source</a>' : '') + '</p>' +
      (autres.length ? '<ul class="pa-au">' + autres.map(function (a) { return '<li>' + esc(P.datesLisibles(a, jour())) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
      (garde ? '' : '<div class="pa-apres"><p class="pa-q">Après l’appel :</p>' +
      '<div class="pa-bs"><button type="button" class="pa-b" data-res="rdv">RDV obtenu</button><button type="button" class="pa-b" data-res="rappeler">À rappeler</button>' +
      '<button type="button" class="pa-b" data-res="injoignable">Injoignable</button><button type="button" class="pa-b" data-res="non">Pas intéressé</button></div></div>') +
      (garde ? '' : '<div class="pa-cinq-z">' + (A ? blocCinq(r) : '') + '</div>') +
      '<div class="pa-rap" hidden><label>Rappeler le <input type="date" class="pa-date" min="' + jour() + '" value="' + P.ajouterJours(jour(), 7) + '"></label><button type="button" class="pa-b pa-ok" data-res="rappeler-ok">Noter le rappel</button></div>' +
      '<div class="pa-quand" hidden></div><p class="pa-dit" role="status"></p>' + (ouv && A ? '<div class="pa-relais-z">' + relaisHtml(r) + '</div>' : '') + (ouv ? blocPlus(r) : '') + '</div></li>';
  }


  /* ── Idée 3 · Le bon moment : sous le nom, « Décroche d'habitude vers 14 h » (seulement en tri « par bon moment ») ; idée 4 : « Lettre envoyée le … » ── */
  var ICO_HORLOGE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  function sousLeNom(r) {
    var id = idDe(r), h = '', x = id ? habitudes()[id] : null, lettre = id ? A.lettreEnvoyee(S.journal, id) : '';
    if (S.tri === 'moment' && x) h += '<span class="pa-hr" data-now="' + (A.dansLeBonMoment(x, heureNow()) ? 'oui' : 'non') + '">' + ICO_HORLOGE + 'Décroche d’habitude ' + esc(A.versHeure(x.h)) + '</span>';
    if (lettre) h += '<span class="pa-etat">' + esc(A.phraseLettre(lettre)) + '</span>';
    return h;
  }
  function barreTri(l) {
    var b = A.bilanMoment(l, habitudes(), heureNow(), idDe);
    return '<div class="pa-tri"><span class="pa-tri-t" id="pa-tri-t">Trier</span><div class="pa-seg" role="group" aria-labelledby="pa-tri-t">' +
      '<button type="button" data-tri="raison" aria-pressed="' + (S.tri === 'raison') + '">Par raison</button><button type="button" data-tri="moment" aria-pressed="' + (S.tri === 'moment') + '">Par bon moment</button></div></div>' +
      '<p class="pa-tri-aide">' + esc(A.phraseTri(S.tri, P.maintenantParis(), b)) + '</p>';
  }

  /* ── Idée 4 · Le relais par écrit ── */
  function modeleMail() {
    var m = T.raisonDe('mail_lettre'), ecrit = S.textes && S.textes.phrases && typeof S.textes.phrases.mail_lettre === 'string' ? S.textes.phrases.mail_lettre.trim() : '';
    return { texte: ecrit || m.propo, yann: !!ecrit };
  }
  function mailDe(r) {
    var f = ficheDe(r), E = window.PHIRST_ENCAISSER_PUR;
    return A.mail(modeleMail().texte, { titulaire: (f && f.pharmacien) || r.pharmacien || '', pharmacie: r.nom, lien: A.lienPresentation(S.marque),
      signature: E ? E.signature(S.marque) : '', email: (f && f.email) || r.email || '' });
  }
  function paragraphes(corps, lien) {
    return corps.split('\n\n').map(function (p) {
      var h = esc(p).replace(/\n/g, '<br>');
      if (lien) h = h.split(esc(lien)).join('<a href="' + esc(lien) + '" target="_blank" rel="noopener">' + esc(lien) + '</a>');
      return '<p>' + h + '</p>';
    }).join('');
  }
  function relaisHtml(r) {
    var k = P.cle(r.nom, r.ville), f = ficheDe(r), id = f ? f.id : (r.prospectId || null), jr = id ? A.lettreEnvoyee(S.journal, id) : '';
    if (jr) return '<div class="pa-relais"><p class="pa-envoye" role="status">' + esc(A.phraseLettre(jr)) + '.</p></div>';
    if (!A.relaisPropose(S.journal, id, !!S.doc[k])) return '';
    var inj = id ? A.injoignablesDeSuite(S.journal, id) : 0;
    if (!S.relaisOuv[k]) return '<div class="pa-relais"><div class="pa-ecrire"><p>' + esc(A.phraseRelais(!!S.doc[k] && inj < 2, inj)) + '</p><button type="button" class="pa-b pa-ok" data-rel="ouvrir">Lui écrire plutôt</button></div></div>';
    var m = mailDe(r), md = modeleMail(), lien = A.lienPresentation(S.marque);
    return '<div class="pa-relais"><div class="pa-mail" aria-label="Aperçu du mail"><div class="pa-mail-e"><span>À : <b>' + (m.a ? esc(m.a) : 'à saisir dans Mail') + '</b></span><span>Objet : <b>' + esc(m.objet) + '</b></span></div>' +
      '<div class="pa-mail-c">' + paragraphes(m.corps, lien) + '</div>' +
      '<p class="pa-mail-note">' + (md.yann ? 'Texte écrit par Yann' : 'Proposition de départ · Yann n’a pas encore écrit ce texte') + (m.a ? '' : ' · Pas d’adresse mail simple notée pour cette pharmacie : le brouillon s’ouvre sans destinataire.') +
      (m.sansLien ? ' · Le lien vers la présentation de Yann n’est pas encore enregistré : le mail part sans lien.' : '') + '</p>' +
      '<div class="pa-mail-pied"><a class="pa-b pa-ok" href="' + esc(m.mailto) + '">Ouvrir dans Mail</a><button type="button" class="pa-b" data-rel="copier">Copier</button>' +
      '<button type="button" class="pa-b" data-rel="envoye">J’ai envoyé la lettre</button><span class="pa-copie" role="status"></span></div></div></div>';
  }
  function rafraichirRelais(li, r) { var z = li.querySelector('.pa-relais-z'); if (z && A) z.innerHTML = relaisHtml(r); }
  function copierMail(r, li) {
    var m = mailDe(r), z = li.querySelector('.pa-copie'), txt = 'Objet : ' + m.objet + '\n\n' + m.corps;
    function ok() { z.textContent = 'Texte copié.'; }
    function ko() { z.textContent = 'La copie n’a pas pu se faire : sélectionnez le texte du mail.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, ko); else ko();
  }
  /* « J'ai envoyé la lettre » : une note au journal de la piste (elle est créée si la pharmacie n'avait pas encore de fiche). */
  function envoyerLettre(r, li) {
    var base = sb(), k = P.cle(r.nom, r.ville), z = li.querySelector('.pa-copie');
    li.querySelectorAll('.pa-relais button').forEach(function (b) { b.disabled = true; });
    function fin(t) { if (z) z.textContent = t; li.querySelectorAll('.pa-relais button').forEach(function (b) { b.disabled = false; }); }
    var f0 = ficheDe(r);
    if (f0 && f0.stage === 'archive') return fin('Cette pharmacie est archivée : rouvrez sa piste depuis « Mes pistes ».');
    (f0 ? Promise.resolve(f0) : creerFiche(r, base)).then(function (f) {
      return ecrireJournal(f.id, 'note', A.LETTRE).then(function (w) {
        if (w.error) throw erreurBase(w, 'lettre');
        if (!f0) S.fiches.push(f);
        S.journal.push({ prospect_id: f.id, type: 'note', body: A.LETTRE, created_at: new Date().toISOString() });
        delete S.relaisOuv[k];
        S.flash = 'Noté : lettre envoyée à ' + r.nom + '.'; dessiner();
      });
    }).then(null, function (e) { fin(e && e.base ? e.base : PAS); });
  }

  /* ── Idée 5 · Les cinq questions ── */
  function puces(nom, liste, val, multi) {
    return '<div class="pa-chips" role="group">' + liste.map(function (x) {
      var on = multi ? val.indexOf(x[0]) >= 0 : val === x[0];
      return '<button type="button" class="pa-chip" data-q="' + nom + '" data-v="' + esc(x[0]) + '" aria-pressed="' + on + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
  }
  function blocCinq(r) {
    var c = S.cinq && S.cinq.k === P.cle(r.nom, r.ville) ? S.cinq.c : null; if (!c) return '';
    var pda = c.projets.indexOf('pda') >= 0, id = 'pa-q' + (S.cinq.n || 0);
    return '<div class="pa-cinq" role="group" aria-label="Cinq questions avant le rendez-vous"><div class="pa-cinq-t"><h3>Cinq questions avant de fixer le rendez-vous</h3><span>Cochez ce que la personne vous dit. Vous pouvez passer.</span></div><div class="pa-qs"><div class="pa-qcol">' +
      '<fieldset class="pa-qq"><legend><i>1</i>Le projet<small>plusieurs possibles</small></legend>' + puces('projets', A.PROJETS, c.projets, true) + '</fieldset>' +
      '<fieldset class="pa-qq"><legend><i>3</i>Qui décide</legend>' + puces('qui', A.QUI, c.qui) + '</fieldset>' +
      '<fieldset class="pa-qq"><legend><i>5</i>La taille</legend><div class="pa-champs"><label>Surface en m²<input type="text" inputmode="numeric" autocomplete="off" data-champ="surface" value="' + esc(c.surface) + '" placeholder="Ex. : 180"></label>' +
      '<label>Lits de l’EHPAD<input type="text" inputmode="numeric" autocomplete="off" data-champ="lits" value="' + esc(c.lits) + '" placeholder="' + (pda ? 'Ex. : 80' : 'Si EHPAD') + '"></label></div></fieldset>' +
      '</div><div class="pa-qcol">' +
      '<fieldset class="pa-qq"><legend><i>2</i>Pour quand</legend>' + puces('quand', A.QUAND, c.quand) + '</fieldset>' +
      '<fieldset class="pa-qq"><legend><i>4</i>Ce qu’il y a aujourd’hui</legend>' + puces('robot', [['non', 'Pas de robot'], ['oui', 'Un robot']], c.robot) +
      '<div class="pa-champs"' + (c.robot === 'oui' ? '' : ' hidden') + '><label>Marque<input type="text" autocomplete="off" maxlength="40" data-champ="marque" value="' + esc(c.marque) + '" placeholder="Ex. : Omnicell"></label><label>Âge du robot<select data-champ="age"><option value="">Choisir</option>' +
      A.AGES.map(function (a) { return '<option value="' + a[0] + '"' + (c.age === a[0] ? ' selected' : '') + '>' + esc(a[1]) + '</option>'; }).join('') + '</select></label></div></fieldset>' +
      '</div></div><p class="pa-cinq-err" role="alert"' + (S.cinq.err ? '' : ' hidden') + '>' + esc(S.cinq.err || '') + '</p>' +
      '<div class="pa-cinq-pied"><p class="pa-titre">Le rendez-vous s’appellera :<b>' + esc(A.titreRdv(c, jour())) + '</b></p><button type="button" class="pa-b pa-ok" data-res="cinq-ok">Voir les créneaux de Yann</button><button type="button" class="pa-b" data-res="cinq-passer">Passer</button></div></div>';
  }
  function rafraichirCinq(li, r, garder) {
    var z = li.querySelector('.pa-cinq-z'); if (!z) return;
    z.innerHTML = blocCinq(r);
    if (garder) { var n = z.querySelector(garder); if (n) n.focus({ preventScroll: true }); }
  }

  /* ── Les trois blocs de la pharmacie ouverte (L1, 24/11/2026, maquette 1-appels) : « Pour commencer » (idée 1), « Il me dit… » (idée 2),
     « Près d'elle, déjà équipées par Yann » (idée 8). Les textes viennent de Yann (Réglages) ; rien n'est écrit en dur ici sauf les propositions
     de départ de phirst-textes-pur.js, marquées comme telles. ── */
  function lienReglages() { return S.telepro ? '' : ' · <button type="button" class="pt-lien" data-vers="reglages">Réglages</button>'; }
  function blocPhrase(r) {
    var ph = T.phraseDe(r.motif, S.textes ? S.textes.phrases : {});
    if (!ph) return '';
    var m = T.mentionPhrase(ph.source, !S.telepro), txt = m.texte + (S.textes ? '' : ' · ses phrases n’ont pas pu être lues');
    return '<section class="pt-carte" aria-label="Pour commencer"><h3 class="pt-h">Pour commencer<span class="pt-mention">' + esc(txt) + (m.lienReglages ? lienReglages() : '') + '</span></h3>' +
      '<p class="pt-motif">Phrase choisie pour la raison : <b>' + esc(ph.raison) + '</b></p><p class="pt-phrase">' + esc(ph.texte) + '</p></section>';
  }
  function reponsesTriees() {
    var c = {}; S.textes.reponses.forEach(function (x) { c[x.id] = Math.max(Number(x.fois) || 0, S.fois[x.id] || 0); });
    return T.reponsesTriees(S.textes.reponses, c);
  }
  function blocReponses(r) {
    if (!S.textes) return '';
    var k = P.cle(r.nom, r.ville), h = '<section class="pt-carte" aria-label="Les réponses de Yann"><h3 class="pt-h">Il me dit…<span class="pt-mention">Réponses écrites par Yann</span></h3>';
    if (!S.textes.reponses.length) return h + '<p class="pt-vide">' + (S.telepro ? 'Yann n’a pas encore écrit de réponses : il le fait dans Réglages, rubrique « Mes réponses ».'
      : 'Vous n’avez pas encore écrit de réponses : ouvrez <button type="button" class="pt-lien" data-vers="reglages">Réglages</button>, rubrique « Mes réponses ».') + '</p></section>';
    var sel = S.repSel[k], o = S.textes.reponses.filter(function (x) { return x.id === sel; })[0], dits = S.dits[k] || [];
    h += '<div class="pt-chips">' + reponsesTriees().map(function (x) { return '<button type="button" class="pt-chip" data-obj="' + esc(x.id) + '" aria-pressed="' + (sel === x.id) + '">' + esc(x.titre) + '</button>'; }).join('') + '</div>';
    if (o) {
      var n = Math.max(Number(o.fois) || 0, S.fois[o.id] || 0);
      h += '<div class="pt-rep" role="status"><p class="pt-qui">Vous pouvez répondre</p><p>' + esc(o.texte) + '</p></div>' +
        '<p class="pt-note"><span><b>Il entrera dans le journal de l’appel</b></span>' + (n > 0 ? '<span>' + esc(T.foisDuMois(n)) + '</span>' : '') + '</p>';
    }
    if (dits.length) h += '<ul class="pt-jr" aria-label="Journal de cet appel">' + dits.map(function (x) { return '<li><span>' + esc(x.h) + '</span>Il m’a dit : « ' + esc(x.titre) + ' »</li>'; }).join('') + '</ul>';
    return h + '</section>';
  }
  function cibleDe(r) {
    var f = (r.prospectId && S.fiches.filter(function (x) { return x.id === r.prospectId; })[0]) || S.fiches.filter(function (x) { return P.cle(x.nom, x.ville) === P.cle(r.nom, r.ville); })[0] || null;
    var lat = r.lat != null ? r.lat : f && f.lat, lon = r.lon != null ? r.lon : f && f.lon;
    return typeof lat === 'number' && typeof lon === 'number' ? { lat: lat, lon: lon } : null;
  }
  function blocVoisines(r) {
    if (!S.textes) return '';
    var k = P.cle(r.nom, r.ville), refs = S.textes.refs, h = '<section class="pt-carte" aria-label="Près d’elle, déjà équipées par Yann"><h3 class="pt-h">Près d’elle, déjà équipées par Yann</h3>';
    if (!refs.length) return h + '<p class="pt-vide">' + (S.telepro ? 'Yann n’a pas encore de pharmacie à citer : il les ajoute dans Réglages, rubrique « Mes références ».'
      : 'Vous n’avez pas encore de référence à citer : ajoutez-en dans <button type="button" class="pt-lien" data-vers="reglages">Réglages</button>, rubrique « Mes références ».') + '</p></section>';
    var cible = cibleDe(r);
    if (!cible) return h + '<p class="pt-vide">La position de cette pharmacie n’est pas connue : les pharmacies équipées qui sont près d’elle ne peuvent pas être cherchées.</p></section>';
    var v = T.voisines(refs, cible, 2);
    if (!v.length) return h + '<p class="pt-vide">Les références de Yann n’ont pas de position : il peut les corriger dans Réglages, rubrique « Mes références ».</p></section>';
    var vp = S.vph[k];
    return h + '<ul class="pt-vs">' + v.map(function (x, i) {
      var e = x.ref;
      return '<li><div class="pt-vn"><b>' + esc(e.nom) + '</b><em>' + x.km + ' km</em></div><p class="pt-vd">' + esc(T.villeAvecDep(e.ville, e.cp)) + ' · ' + esc(e.pose || '') + (e.an ? ', ' + esc(e.an) : '') + '</p><div class="pt-tags">' +
        '<span class="pt-tag">Accepte d’être citée</span>' + (e.visite ? '<span class="pt-tag" data-t="visite">Visite possible</span>' : '') +
        '<button type="button" class="pt-lien" data-vph="' + i + '" aria-pressed="' + (vp === i) + '">' + (vp === i ? 'Masquer la phrase' : 'Phrase prête') + '</button></div></li>';
    }).join('') + '</ul>' + (vp != null && v[vp] ? '<p class="pt-vphrase" role="status">«\u00a0' + esc(T.phraseVoisine(v[vp].ref, v[vp].km)) + '\u00a0»</p>' : '') + '</section>';
  }
  function blocPlus(r) {
    if (!T) return '';
    var a = blocPhrase(r) + blocReponses(r), b = blocVoisines(r);
    return a || b ? '<div class="pt-plus"><div class="pt-col">' + a + '</div><div class="pt-col">' + b + '</div></div>' : '';
  }
  /* « Il me dit… » : montre la réponse, la note pour le journal de l'appel, et compte « entendue N fois ce mois » (elle seule : la base ne compte que ses appels). */
  function choisirReponse(r, li, id) {
    var k = P.cle(r.nom, r.ville), o = S.textes && S.textes.reponses.filter(function (x) { return x.id === id; })[0]; if (!o) return;
    var dejaVue = (S.dits[k] || []).some(function (x) { return x.id === id; });
    S.repSel[k] = id;
    if (A && A.reponseDocumentation(o.titre)) { S.doc[k] = true; rafraichirRelais(li, r); }   // « Envoyez-moi une documentation » : la barre « Lui écrire plutôt » apparaît
    if (!dejaVue) {
      (S.dits[k] = S.dits[k] || []).push({ id: id, titre: o.titre, h: P.heureFr(P.maintenantParis().slice(11)) });
      if (S.telepro) sb().rpc('telepro_entendue', { p_texte: id, p_pharmacie: (r.nom + (r.ville ? ' · ' + r.ville : '')).slice(0, 200) }).then(function (x) {
        if (x && !x.error && typeof x.data === 'number') { S.fois[id] = x.data; if (li.isConnected && S.ouverte === k) rafraichirPlus(li, r); }
      }, function () {});
    }
    rafraichirPlus(li, r);
  }
  function rafraichirPlus(li, r) {
    var z = li.querySelector('.pt-plus'), h = blocPlus(r); if (!z) return;
    var tmp = document.createElement('div'); tmp.innerHTML = h;
    if (tmp.firstChild) z.replaceWith(tmp.firstChild);
  }
  function ouvrirParDefaut(l) {
    if (!l.some(function (r) { return P.cle(r.nom, r.ville) === S.ouverte; })) S.ouverte = l.length ? P.cle(l[0].nom, l[0].ville) : null;
  }
  function vueJour() {
    var l = liste(), h = '';
    ouvrirParDefaut(l);
    var r = S.robot, attend = !(r && r.frais && r.trouver && Array.isArray(r.trouver.appels));
    if (attend) h += '<p class="pa-avis">La liste arrive au prochain passage, à 7 h 05. En attendant, voici vos relances du jour.</p>';
    if (!l.length) {
      return h + '<div class="pa-vide"><p>' + (attend ? 'Aucune relance à faire aujourd’hui.' : 'Tout est appelé pour aujourd’hui. Bravo.') + '</p><p>' +
        (attend ? 'Pour en préparer, ajoutez des pharmacies depuis la Veille : les reprises du secteur y sont déjà.' : 'La prochaine liste arrive demain à 7 h 05. Vous pouvez aussi ajouter des pistes depuis la Veille.') +
        '</p><button type="button" class="lg-gros" data-vers="veille">Ouvrir la Veille</button></div>';
    }
    if (A) h += barreTri(l);
    return h + '<p class="pa-lt">' + l.length + ' pharmacie' + (l.length > 1 ? 's' : '') + ' à appeler, ' + (S.tri === 'moment' && A && A.bilanMoment(l, habitudes(), heureNow(), idDe).bonnes ? 'les plus joignables en ce moment en premier' : 'la plus importante en premier') + '</p><ul class="pa-liste">' + l.map(ligneAppel).join('') + '</ul>';
  }
  function vuePistes() {
    var g = P.grouperParEtape(S.fiches).filter(function (e) { return e.fiches.length; });
    if (!g.length) return '<div class="pa-vide"><p>Vous n’avez pas encore de piste.</p><p>Une piste naît quand vous appelez une pharmacie de la liste du jour, ou quand vous en ajoutez une depuis la Veille.</p><button type="button" class="lg-gros" data-vers="veille">Ouvrir la Veille</button></div>';
    return g.map(function (e) {
      return '<section class="pa-et"><h2>' + esc(e.nom) + ' <span>' + e.fiches.length + '</span></h2><ul class="pa-pistes">' + e.fiches.map(function (f) {
        return '<li><button type="button" class="pa-piste" data-fiche="' + esc(f.id) + '"><b>' + esc(f.nom) + '</b><small>' + esc(f.ville || '') + (f.next_action ? ' · ' + esc(f.next_action) + (f.next_action_date ? ' le ' + esc(P.jourAvecAnnee(f.next_action_date, jour())) : '') : '') + '</small></button></li>';
      }).join('') + '</ul></section>';
    }).join('');
  }
  var JOURNAL = { id: null, lignes: null, equipe: {} };
  /* Elle lit l'étape et la prochaine action, elle ne les modifie pas : elles se règlent par « Après l'appel ». */
  function suiteEnTexte(f) {
    return '<dl class="pa-coord"><div><dt>Étape</dt><dd>' + esc(P.nomEtape(f.stage)) + '</dd></div><div><dt>Prochaine action</dt><dd>' +
      (f.next_action ? esc(f.next_action) + (f.next_action_date ? ' le ' + esc(P.jourAvecAnnee(f.next_action_date, jour())) : '') : 'Aucune pour le moment') + '</dd></div></dl>';
  }
  function vueFiche() {
    var f = S.fiches.filter(function (x) { return x.id === S.fiche; })[0];
    if (!f) return '<p class="pa-avis">Cette piste n’existe plus.</p><button type="button" class="pa-b" data-retour="1">Retour aux pistes</button>';
    var adr = [f.cp, f.ville].filter(Boolean).join(' ');
    var h = '<button type="button" class="pa-retour" data-retour="1">← Mes pistes</button><div class="pa-fiche"><div class="pa-fg-t"><h2>' + esc(f.nom) + '</h2><p class="pa-sub">' + esc(P.nomEtape(f.stage)) + '</p></div><div class="pa-fg"><div class="pa-fg-a">' +
      '<dl class="pa-coord"><div><dt>Adresse</dt><dd>' + (esc(adr) || 'Non renseignée') + '</dd></div><div><dt>Téléphone</dt><dd>' + (f.telephone ? tel(f.telephone) : 'Non renseigné') + '</dd></div>' +
      '<div><dt>E-mail</dt><dd>' + (f.email ? '<a href="mailto:' + esc(f.email) + '">' + esc(f.email) + '</a>' : 'Non renseigné') + '</dd></div><div><dt>Titulaire</dt><dd>' + (esc(f.pharmacien) || 'Non renseigné') + '</dd></div></dl>' +
      (S.telepro ? suiteEnTexte(f) : '<label class="pa-ch">Étape<select id="pa-etape">' + P.ETAPES.map(function (e) { return '<option value="' + e.cle + '"' + (e.cle === f.stage ? ' selected' : '') + '>' + esc(e.nom) + '</option>'; }).join('') + (f.stage === 'archive' ? '<option value="archive" selected>Archivée</option>' : '') + '</select></label>' +
      '<div class="pa-suite"><label class="pa-ch">Prochaine action<input type="text" id="pa-act" maxlength="120" value="' + esc(f.next_action || '') + '" placeholder="Par exemple : Rappeler"></label>' +
      '<label class="pa-ch">Pour le<input type="date" id="pa-actdate" value="' + esc(f.next_action_date || '') + '"></label><button type="button" class="pa-b" id="pa-actok">Enregistrer</button></div><p class="pa-dit" id="pa-dit-fiche" role="status"></p>') + '</div><div class="pa-fg-b">' +
      '<h3>Journal</h3><div id="pa-journal">' + (JOURNAL.id === f.id && JOURNAL.lignes ? journalHtml() : '<p class="pa-avis">Chargement du journal…</p>') + '</div>' +
      '<label class="pa-ch">Ajouter une note<textarea id="pa-note" rows="3" maxlength="1200" placeholder="Ce qui s’est dit, ce qu’il faut retenir…"></textarea></label><button type="button" class="pa-b pa-ok" id="pa-noteok">Ajouter la note</button><p class="pa-dit" id="pa-dit-note" role="status"></p></div></div></div>';
    return h;
  }
  function journalHtml() {
    if (!JOURNAL.lignes.length) return '<p class="pa-avis">Rien n’est encore noté sur cette piste. Écrivez la première note ci-dessous.</p>';
    return '<ul class="pa-jour">' + JOURNAL.lignes.map(function (a) {
      return '<li><span>' + esc(P.jourAvecAnnee(versJourParis(a.created_at), jour())) + '</span><p>' + esc(P.avecAuteur(P.phraseJournal(a.type, a.body), P.nomAuteur(JOURNAL.equipe, a.author_id))) + '</p></li>';
    }).join('') + '</ul>';
  }
  function chargerJournal(id) {
    JOURNAL = { id: id, lignes: null, equipe: {} };
    var q = S.telepro ? sb().rpc('telepro_journal', { p_prospect: id }) : sb().from('crm_activities').select('author_id,type,body,created_at').eq('prospect_id', id).order('created_at', { ascending: false }).limit(100);
    Promise.all([q, EQUIPE.lire()]).then(function (x) {
      var r = x[0];
      if (S.fiche !== id) return;
      JOURNAL = { id: id, lignes: r && !r.error ? (r.data || []) : [], equipe: x[1] || {} };
      var z = document.getElementById('pa-journal'); if (z) z.innerHTML = journalHtml();
    });
  }

  function dessiner() {
    var el = S.racine; if (!el) return;
    if (V2.route && V2.route.name !== 'appels') return; // une écriture qui finit après un changement d'écran ne redessine pas l'ancien écran par-dessus le nouveau (la racine est commune)
    var n = S.charge ? liste().length : null, np = S.charge ? S.fiches.filter(function (f) { return f.stage !== 'archive'; }).length : null;
    var corps;
    if (S.erreur) corps = '<div class="pa-vide"><p>Les appels ne se sont pas chargés.</p><p>Vérifiez votre connexion puis réessayez.</p><button type="button" class="lg-gros" data-reessayer="1">Réessayer</button></div>';
    else if (!S.charge) corps = '<p class="pa-avis">Chargement…</p>';
    else if (S.fiche) corps = vueFiche();
    else corps = (S.flash ? '<p class="pa-flash" role="status">' + esc(S.flash) + '</p>' : '') + (S.onglet === 'jour' ? vueJour() : vuePistes());
    var maj = S.charge && S.robot && S.robot.calculeLe ? P.miseAJourFr(S.robot.calculeLe) : '';
    el.innerHTML = window.PHIRST_ECRAN.cadre('<section class="pa" aria-label="Appels">' + window.PHIRST_ECRAN.tete('Appels', 'Qui appeler aujourd’hui, et où en sont vos pistes.', maj ? 'Liste mise à jour ' + maj + '.' : '') +
      (S.fiche ? '' : '<div class="pa-ong" role="tablist"><button type="button" role="tab" class="pa-o" data-ong="jour" aria-selected="' + (S.onglet === 'jour') + '">À appeler aujourd’hui' + (n ? ' <span>' + n + '</span>' : '') + '</button>' +
        '<button type="button" role="tab" class="pa-o" data-ong="pistes" aria-selected="' + (S.onglet === 'pistes') + '">Mes pistes' + (np ? ' <span>' + np + '</span>' : '') + '</button></div>') +
      '<div class="pa-corps">' + corps + '</div></section>');
  }

  /* ── Écritures : les mêmes que logCall (V1) ── */
  /* Une erreur qui porte, pour elle, le message en français de la base (« Pas de somme dans le journal. »). */
  function erreurBase(r, code) { var e = new Error(code); if (S.telepro) e.base = P.messageDeLaBase(r && r.error); return e; }
  function ecrireJournal(id, type, body) {
    return S.telepro ? sb().rpc('telepro_ecrire', { p_prospect: id, p_type: type, p_body: body }) : sb().from('crm_activities').insert({ prospect_id: id, type: type, body: body });
  }
  /* L'étape et la prochaine action après un appel ; elle, par telepro_suite puis relecture de ses pistes. Rend { data: la fiche } ou { error }. */
  function majSuite(id, maj) {
    var base = sb();
    if (!S.telepro) return base.from('crm_prospects').update(maj).eq('id', id).eq('workspace_id', S.ws).select(COLS).single();
    return base.rpc('telepro_suite', { p_prospect: id, p_stage: maj.stage || null, p_next_action: maj.next_action == null ? null : maj.next_action, p_next_action_date: maj.next_action_date || null }).then(function (u) {
      if (u.error) return u;
      return base.rpc('telepro_pistes').then(function (l) {
        if (l.error || !Array.isArray(l.data)) return { error: l.error || { message: '' } };
        S.fiches = l.data.filter(sienne);
        var x = l.data.filter(function (y) { return y.id === id; })[0];
        return x ? { data: x } : { error: { message: '' } };
      });
    });
  }
  /* Une pharmacie de la liste du jour qui n'a pas encore de fiche : telepro_creer_piste, puis les raisons du signal en note. */
  function creerParTelepro(r, base) {
    return base.rpc('telepro_creer_piste', { p_nom: r.nom, p_ville: r.ville || null, p_cp: r.cp || null, p_departement: r.dep || (r.cp ? String(r.cp).slice(0, 2) : null),
      p_telephone: r.telephone || null, p_email: r.email || null, p_pharmacien: r.pharmacien || null, p_lat: r.lat == null ? null : r.lat, p_lon: r.lon == null ? null : r.lon,
      p_source: r.origine || 'annuaire' }).then(function (n) {
      if (n.error || !n.data) throw erreurBase(n, 'creer');
      var f = { id: n.data, nom: r.nom, ville: r.ville || null, cp: r.cp || null, stage: 'a_qualifier' }, raisons = (r.raisons || []).join(' · ').slice(0, 1200);
      return raisons ? base.rpc('telepro_ecrire', { p_prospect: f.id, p_type: 'note', p_body: raisons }).then(function () { return f; }, function () { return f; }) : f;
    });
  }
  /* Une pharmacie de la liste qui n'a pas encore de piste : on la crée (elle par la fonction de la base, Yann directement). */
  function creerFiche(r, base) {
    if (S.telepro) return creerParTelepro(r, base);
    return base.from('crm_prospects').insert({
      workspace_id: S.ws, nom: r.nom, ville: r.ville || null, cp: r.cp || null, departement: r.dep || (r.cp ? String(r.cp).slice(0, 2) : null),
      pharmacien: r.pharmacien || null, telephone: r.telephone || null, email: r.email || null, stage: 'a_qualifier', source: r.origine || 'annuaire',
      lat: r.lat == null ? null : r.lat, lon: r.lon == null ? null : r.lon
    }).select(COLS).single().then(function (n) {
      if (n.error || !n.data) throw new Error('creer');
      var raisons = (r.raisons || []).join(' · ').slice(0, 1200);
      return (raisons ? base.from('crm_activities').insert({ prospect_id: n.data.id, type: 'note', body: raisons }).then(function () { return n.data; }, function () { return n.data; }) : n.data);
    });
  }
  function noter(r, resultat, choisie, li, debutRdv, rdvExtra) {
    var base = sb(), dit = li.querySelector('.pa-dit'), jr = jour();
    function dire(t) { dit.textContent = t; li.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); }
    li.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    dit.textContent = '';
    var dits = T ? T.ditsEnTexte((S.dits[P.cle(r.nom, r.ville)] || []).map(function (x) { return x.titre; })) : '';   // ce que le pharmacien a dit (« Il me dit… »), au journal de l'appel
    var suite = P.suiteAppel(resultat, jr, choisie, dits);
    if (debutRdv) suite.maj.next_action_date = debutRdv.slice(0, 10); // la prochaine action tombe le jour du rendez-vous
    var fiche = ficheDe(r);
    if (fiche && fiche.stage === 'archive') return dire('Cette pharmacie est archivée : rouvrez sa piste depuis « Mes pistes ».');
    function avoirFiche() { return fiche ? Promise.resolve(fiche) : creerFiche(r, base); }
    /* « RDV obtenu » avec une heure : on RELIT les rendez-vous juste avant d'écrire (heure passée ou créneau pris = refus, rien n'est écrit). */
    var verif = debutRdv ? RDV.lire(base, S.ws).then(function (x) {
      var m = P.heureValide(debutRdv, P.maintenantParis()) || (P.dejaPris(x.rdvs, debutRdv, P.REGLAGES_AGENDA.dureeMin) ? P.MSG_PRIS : null);
      if (m) { var e = new Error('refus'); e.refus = m; throw e; }
    }) : Promise.resolve();
    var rdvPose = false;
    verif.then(avoirFiche).then(function (f) {
      var avant = debutRdv ? RDV.ecrire(base, f.id, 'creer', crypto.randomUUID(), (A ? A.extraRdv : function (x, j, o) { return Object.assign(o, { objet: 'Premier rendez-vous' }); })(rdvExtra, jr, {
        debut: debutRdv, duree_min: P.REGLAGES_AGENDA.dureeMin, lieu: P.lieuPharmacie({ nom: f.nom, adresse: f.adresse, ville: f.ville })
      })).then(function (w) { if (w.error) throw erreurBase(w, 'rdv'); rdvPose = true; }) : Promise.resolve();
      return avant.then(function () { return ecrireJournal(f.id, 'appel', suite.body); }).then(function (a) {
        if (a.error) throw erreurBase(a, 'appel');
        S.journal.push({ prospect_id: f.id, type: 'appel', body: suite.body, created_at: new Date().toISOString() });   // le journal à l'écran suit : « Injoignable » compté, bon moment appris
        return majSuite(f.id, suite.maj);
      }).then(function (u) {
        if (u.error || !u.data) throw erreurBase(u, 'maj');
        var i = S.fiches.map(function (x) { return x.id; }).indexOf(u.data.id);
        if (i < 0) S.fiches.push(u.data); else S.fiches[i] = u.data;
        S.appelAu[u.data.id] = jr; delete S.dits[P.cle(r.nom, r.ville)]; delete S.repSel[P.cle(r.nom, r.ville)]; delete S.vph[P.cle(r.nom, r.ville)];
        delete S.doc[P.cle(r.nom, r.ville)]; delete S.relaisOuv[P.cle(r.nom, r.ville)]; delete S.quandCtx[P.cle(r.nom, r.ville)]; S.cinq = null;
        if (resultat === 'injoignable' && !debutRdv && A && A.injoignablesDeSuite(S.journal, u.data.id) >= 2) {   // 2e « Injoignable » de suite : la pharmacie reste, avec « Lui écrire plutôt »
          S.gardees[P.cle(r.nom, r.ville)] = { r: Object.assign({}, r, { prospectId: u.data.id }), i: +li.getAttribute('data-i') };
          S.ouverte = P.cle(r.nom, r.ville);
          S.flash = 'Noté : ' + r.nom + ' — injoignable pour la 2e fois. Prochaine action le ' + P.jourAvecAnnee(suite.maj.next_action_date, jour()) + '. Un mail est proposé ci-dessous.'; dessiner(); return;
        }
        if (debutRdv) { S.flash = 'Rendez-vous posé : ' + P.quandFr(debutRdv) + ' chez ' + r.nom + (A ? ' · « ' + A.extraRdv(rdvExtra, jr).objet + ' »' : '') + '.'; dessiner(); return; }
        S.flash = 'Noté : ' + r.nom + ' — ' + { rdv: 'rendez-vous obtenu', rappeler: 'à rappeler', injoignable: 'injoignable', non: 'pas intéressé' }[resultat] + '.' +
          (suite.maj.next_action_date ? ' Prochaine action le ' + P.jourAvecAnnee(suite.maj.next_action_date, jour()) + '.' : ' La piste passe dans les perdues.');
        dessiner();
      });
    }).then(null, function (e) { dire(e && e.refus ? e.refus : rdvPose ? 'Le rendez-vous est posé, mais l’appel n’a pas pu être noté : ouvrez la fiche dans « Mes pistes ».' : e && e.base ? e.base : PAS); });
  }

  function majFiche(id, champs, dit, ok) {
    sb().from('crm_prospects').update(champs).eq('id', id).eq('workspace_id', S.ws).select(COLS).single().then(function (u) {
      if (u.error || !u.data) { dit.textContent = PAS; return; }
      var i = S.fiches.map(function (x) { return x.id; }).indexOf(id); if (i >= 0) S.fiches[i] = u.data;
      dit.textContent = ok;
    }, function () { dit.textContent = PAS; });
  }

  /* « RDV obtenu » : le panneau « Quand ? » (les 3 meilleurs créneaux de Yann, ou une autre heure). Rien n'est écrit avant le choix. */
  function ouvrirQuand(r, li) {
    var z = li.querySelector('.pa-quand'), base = sb();
    if (!z.hidden) { z.hidden = true; return; }
    z.hidden = false; z.innerHTML = '<p class="pa-avis" role="status">Recherche des meilleurs créneaux…</p>';
    RDV.lire(base, S.ws).then(function (x) {
      var f = (r.prospectId && x.fiches.filter(function (y) { return y.id === r.prospectId; })[0]) ||
        x.fiches.filter(function (y) { return P.cle(y.nom, y.ville) === P.cle(r.nom, r.ville); })[0] ||
        S.fiches.filter(function (y) { return P.cle(y.nom, y.ville) === P.cle(r.nom, r.ville); })[0] || null;   // elle : ses pistes sans rendez-vous ne sont pas dans l'agenda
      var lat = f && f.lat != null ? f.lat : r.lat, lon = f && f.lon != null ? f.lon : r.lon;
      var cible = lat != null && lon != null ? { lat: lat, lon: lon } : null;
      var cren = RDV.propositions(x.rdvs, x.fiches, cible);
      var h = '<p class="pa-q">Quand ?</p>' + (A ? '<p class="pa-quand-titre">Titre du rendez-vous : <b>' + esc(A.extraRdv(S.quandCtx[P.cle(r.nom, r.ville)], jour()).objet) + '</b></p>' : '');
      h += cren.length ? '<div class="pa-cren">' + cren.map(function (c) {
        return '<button type="button" class="pa-b pa-cr" data-res="quand" data-debut="' + esc(c.debut) + '"><b>' + esc(P.maj(P.quandFr(c.debut))) + '</b><small>' + esc(RDV.detail(c, S.telepro)) + '</small></button>';
      }).join('') + '</div>' : '<p class="pa-avis">Aucun créneau libre dans les dix prochains jours ouvrés : choisissez une autre heure.</p>';
      h += '<div class="pa-rap"><span class="pa-qt">Une autre heure</span><label>Le <input type="date" class="pa-qdate" min="' + jour() + '" value="' + P.joursProposes(jour())[0] + '"></label>' +
        '<label>À <input type="time" class="pa-qheure" step="1800" value="09:00"></label><button type="button" class="pa-b pa-ok" data-res="quand-ok">Choisir cette heure</button></div>' +
        '<button type="button" class="pa-b" data-res="quand-fermer">Fermer</button>';
      z.innerHTML = h;
    }, function () { z.innerHTML = '<p class="pa-avis">Les rendez-vous n’ont pas pu être lus : réessayez dans un instant.</p><button type="button" class="pa-b" data-res="quand-fermer">Fermer</button>'; });
  }

  function clic(ev) {
    var t = ev.target;
    var g = t.closest('[data-vers]'); if (g) { V2.go(g.getAttribute('data-vers')); return; }
    if (t.closest('[data-reessayer]')) { charger(); return; }
    var tri = t.closest('[data-tri]'); if (tri) { S.tri = tri.getAttribute('data-tri') === 'moment' ? 'moment' : 'raison'; ecrireTri(S.tri); dessiner(); return; }
    var o = t.closest('[data-ong]'); if (o) { S.onglet = o.getAttribute('data-ong'); S.flash = ''; dessiner(); return; }
    var pf = t.closest('[data-fiche]'); if (pf) { S.fiche = pf.getAttribute('data-fiche'); dessiner(); chargerJournal(S.fiche); window.scrollTo(0, 0); return; }
    if (t.closest('[data-retour]')) { S.fiche = null; S.onglet = 'pistes'; dessiner(); return; }
    var ou = t.closest('[data-ouvrir]');
    if (ou) { var rr = liste()[+ou.getAttribute('data-ouvrir')]; if (rr) { var cc = P.cle(rr.nom, rr.ville); S.ouverte = S.ouverte === cc ? null : cc; dessiner(); } return; }
    var b = t.closest('.pa-b[data-res]'), li = t.closest('.pa-l');
    var ob = t.closest('[data-obj]'), vp = t.closest('[data-vph]'), rel = t.closest('[data-rel]'), qq = t.closest('.pa-chip[data-q]');
    if (rel && li && A) {
      var rr2 = liste()[+li.getAttribute('data-i')], ac = rel.getAttribute('data-rel'); if (!rr2) return;
      if (ac === 'ouvrir') { S.relaisOuv[P.cle(rr2.nom, rr2.ville)] = true; rafraichirRelais(li, rr2); }
      else if (ac === 'copier') copierMail(rr2, li);
      else if (ac === 'envoye') envoyerLettre(rr2, li);
      return;
    }
    if (qq && li && A && S.cinq) {
      var rq = liste()[+li.getAttribute('data-i')], c = S.cinq.c, nq = qq.getAttribute('data-q'), vq = qq.getAttribute('data-v'); if (!rq) return;
      if (nq === 'projets') { var ip = c.projets.indexOf(vq); if (ip >= 0) c.projets.splice(ip, 1); else c.projets.push(vq); } else c[nq] = c[nq] === vq ? '' : vq;
      S.cinq.err = ''; rafraichirCinq(li, rq, '.pa-chip[data-q="' + nq + '"][data-v="' + vq + '"]'); return;
    }
    if ((ob || vp) && li) {
      var rl = liste()[+li.getAttribute('data-i')]; if (!rl) return;
      if (ob) { choisirReponse(rl, li, ob.getAttribute('data-obj')); return; }
      var kk = P.cle(rl.nom, rl.ville), nn = +vp.getAttribute('data-vph'); S.vph[kk] = S.vph[kk] === nn ? null : nn; rafraichirPlus(li, rl); return;
    }
    if (b && li) {
      var r = liste()[+li.getAttribute('data-i')], res = b.getAttribute('data-res');
      if (!r) return;
      if (res === 'rappeler') { var z = li.querySelector('.pa-rap'); z.hidden = !z.hidden; if (!z.hidden) li.querySelector('.pa-date').focus(); return; }
      if (res === 'rdv') {
        var kr = P.cle(r.nom, r.ville);
        if (!A) { ouvrirQuand(r, li); return; }
        li.querySelector('.pa-quand').hidden = true;
        S.cinq = S.cinq && S.cinq.k === kr ? null : { k: kr, err: '', c: { projets: [], quand: '', qui: '', robot: '', marque: '', age: '', surface: '', lits: '' } };
        delete S.quandCtx[kr]; rafraichirCinq(li, r); return;
      }
      if (res === 'cinq-passer' || res === 'cinq-ok') {
        var kc = P.cle(r.nom, r.ville), rc = null;
        if (res === 'cinq-ok') {
          rc = A.questions(S.cinq && S.cinq.c, jour());
          if (rc.erreur) { S.cinq.err = rc.erreur; var ze = li.querySelector('.pa-cinq-err'); ze.textContent = rc.erreur; ze.hidden = false; return; }
        }
        S.quandCtx[kc] = rc; S.cinq = null; rafraichirCinq(li, r);
        var zq = li.querySelector('.pa-quand'); zq.hidden = true; ouvrirQuand(r, li); return;
      }
      if (res === 'quand-fermer') { li.querySelector('.pa-quand').hidden = true; return; }
      if (res === 'quand') { noter(r, 'rdv', null, li, b.getAttribute('data-debut'), S.quandCtx[P.cle(r.nom, r.ville)]); return; }
      if (res === 'quand-ok') {
        var hl = RDV.heureLibre(li.querySelector('.pa-qdate').value, li.querySelector('.pa-qheure').value);
        if (hl.erreur) { li.querySelector('.pa-dit').textContent = hl.erreur; return; }
        noter(r, 'rdv', null, li, hl.debut, S.quandCtx[P.cle(r.nom, r.ville)]); return;
      }
      if (res === 'rappeler-ok') { noter(r, 'rappeler', li.querySelector('.pa-date').value, li); return; }
      noter(r, res, null, li); return;
    }
    if (t.id === 'pa-actok') {
      var a = document.getElementById('pa-act').value.trim() || null, d = document.getElementById('pa-actdate').value || null;
      majFiche(S.fiche, { next_action: a, next_action_date: d }, document.getElementById('pa-dit-fiche'), 'Prochaine action enregistrée.'); return;
    }
    if (t.id === 'pa-noteok') {
      var n = document.getElementById('pa-note'), txt = n.value.trim(), dn = document.getElementById('pa-dit-note'), id = S.fiche;
      if (!txt) { dn.textContent = 'Écrivez d’abord la note.'; return; }
      t.disabled = true;
      ecrireJournal(id, 'note', txt).then(function (r) {
        t.disabled = false;
        if (r.error) { dn.textContent = (S.telepro && P.messageDeLaBase(r.error)) || PAS; return; }
        n.value = ''; dn.textContent = 'Note ajoutée.';
        JOURNAL.lignes = [{ author_id: V2.user && V2.user.id, type: 'note', body: txt, created_at: new Date().toISOString() }].concat(JOURNAL.lignes || []);
        var z = document.getElementById('pa-journal'); if (z) z.innerHTML = journalHtml();
      }, function () { t.disabled = false; dn.textContent = PAS; });
    }
  }
  /* Les champs des cinq questions (surface, lits, marque, âge) : la frappe garde sa valeur sans redessiner. */
  function saisie(ev) {
    var ch = ev.target.getAttribute && ev.target.getAttribute('data-champ');
    if (ch && S.cinq && S.cinq.c && Object.prototype.hasOwnProperty.call(S.cinq.c, ch)) { S.cinq.c[ch] = ev.target.value; S.cinq.err = ''; var ze = ev.target.closest('.pa-cinq') && ev.target.closest('.pa-cinq').querySelector('.pa-cinq-err'); if (ze) ze.hidden = true; }
  }
  function change(ev) {
    if (ev.target.id !== 'pa-etape') return;
    var f = S.fiches.filter(function (x) { return x.id === S.fiche; })[0], dit = document.getElementById('pa-dit-fiche'); if (!f) return;
    majFiche(f.id, { stage: ev.target.value }, dit, 'Étape mise à jour : ' + P.nomEtape(ev.target.value) + '.');
  }

  V2.pages.appels = { needs: [], render: function (root) {
    S.racine = root; S.fiche = null; S.flash = ''; S.cinq = null; S.quandCtx = {}; S.doc = {}; S.relaisOuv = {}; S.gardees = {};
    if (!root.__pa) { root.__pa = true; root.addEventListener('click', clic); root.addEventListener('change', change); root.addEventListener('input', saisie); root.addEventListener('change', saisie); }
    charger();
  } };
})();
