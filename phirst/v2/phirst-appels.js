/* PHIRST · écran « Appels » (21/11/2026) : la liste du jour, les pistes par étape, la fiche d'une piste.
   Transposé de la V1 (~/phirst-studio) : liste = getCallPlan (calculée chaque matin par le robot du Mac, rangée dans
   ligne_accueil.donnees[0].appels) + relances dues lues en direct ; les quatre boutons après l'appel = logCall
   (app/crm/actions.ts) ; fiche = moveStage, setNextAction, addActivity. Logique pure dans phirst-pur.js (testée).
   Écritures : SEULEMENT dans l'espace du compte connecté (crm_members), jamais de suppression.
   Charge aussi l'accès à la ligne du compte (window.PHIRST_DONNEES) que l'écran Veille réutilise. */
(function () {
  'use strict';
  var P = window.PHIRST_PUR, V2 = window.V2;
  if (!P || !V2) return;
  V2.pages = V2.pages || {};
  var PAS = 'Pas enregistré : réessayez dans un instant.';
  var AGE_MAX = 36 * 3600 * 1000;
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }

  /* ── La ligne du compte : « trouver » porte appels et veille. Posée d'avance (sondes) ou lue en base. ── */
  var cacheLigne = { pour: null, p: null };
  window.PHIRST_DONNEES = {
    ligne: function () {
      var u = V2.user;
      if (Array.isArray(window.PHIRST_LIGNE)) return Promise.resolve({ trouver: window.PHIRST_LIGNE[0] || null, frais: true });
      if (!u || !sb()) return Promise.resolve({ trouver: null, frais: false });
      if (cacheLigne.pour === u.id && cacheLigne.p) return cacheLigne.p;
      cacheLigne.pour = u.id;
      cacheLigne.p = sb().from('ligne_accueil').select('donnees,calcule_le').eq('user_id', u.id).maybeSingle().then(function (r) {
        var x = r && !r.error && r.data;
        if (!x || !Array.isArray(x.donnees)) return { trouver: null, frais: false };
        return { trouver: x.donnees[0] || null, frais: Date.now() - Date.parse(x.calcule_le) <= AGE_MAX };
      }, function () { return { trouver: null, frais: false }; });
      return cacheLigne.p;
    },
    oublier: function () { cacheLigne = { pour: null, p: null }; }
  };

  /* ── Les rendez-vous de l'espace : lus ici, partagés avec l'écran Agenda (phirst-agenda.js) ──
     Un rendez-vous = une ligne `crm_activities` de type « rdv » (format de la V1, voir phirst-pur.js). On AJOUTE, on ne modifie
     ni ne supprime jamais. Aucun compte n'a encore le rôle téléprospectrice : estTelepro rend toujours false (le paramètre reste). */
  var RDV = window.PHIRST_RDV = {
    estTelepro: function () { return false; },
    /* Relit tout : les fiches de l'espace (non archivées ou non) puis leurs lignes rdv. Rend { fiches, rdvs }. */
    lire: function (base, ws) {
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
      return base.from('crm_activities').insert({ prospect_id: prospectId, type: 'rdv', body: P.corpsRdv(quoi, rdvId, V2.user.id, extra) });
    },
    /* Les trois meilleurs créneaux de Yann sur les 10 prochains jours ouvrés. */
    propositions: function (rdvs, fiches, cible, sauf) {
      var occ = RDV.occupations(rdvs.filter(function (r) { return r.id !== sauf; }), fiches);
      return P.meilleursCreneaux({ jours: P.joursProposes(P.aujourdhui()), occupations: occ, cible: cible, maintenant: P.maintenantParis(), combien: 3 });
    },
    /* La route dite en clair sous un créneau proposé. */
    detail: function (c) {
      var a = c.trajetAvant ? 'environ ' + P.dureeFr(c.trajetAvant) + ' de route depuis ' + c.depuis : 'départ de ' + c.depuis;
      return (c.dansLeSecteur ? 'Vous êtes déjà dans le secteur · ' : '') + (c.vers && c.trajetApres ? a + ', puis ' + c.vers : a);
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
  var S = { racine: null, jeton: 0, onglet: 'jour', fiche: null, ws: null, fiches: [], appelAu: {}, robot: null, avis: '', flash: '', charge: false, erreur: false };
  var COLS = 'id,nom,ville,cp,departement,telephone,email,pharmacien,stage,source,next_action,next_action_date,lat,lon,updated_at';
  var MOTIFS = {
    relance: ['Relance promise', 'rouge'], procedure: ['Procédure collective', 'rouge'], cession: ['Cession d’officine', 'orange'],
    creation: ['Création d’officine', 'orange'], omnicell: ['Robot Omnicell abandonné', 'orange'], pda: ['Marché public PDA', ''],
    robot: ['Robot concurrent', ''], ehpad: ['Fournisseur d’EHPAD', ''], pmr: ['Accessibilité PMR', '']
  };
  function jour() { return P.aujourdhui(); }
  function versJourParis(iso) { return P.aujourdhui(new Date(iso)); }

  function charger() {
    var u = V2.user, tok = ++S.jeton, base = sb();
    S.charge = false; S.erreur = false;
    if (!u || !base) { S.erreur = true; dessiner(); return; }
    dessiner();
    Promise.all([
      base.from('crm_members').select('workspace_id').eq('user_id', u.id).limit(1).maybeSingle(),
      window.PHIRST_DONNEES.ligne()
    ]).then(function (r) {
      var ws = r[0] && !r[0].error && r[0].data && r[0].data.workspace_id;
      if (!ws) throw new Error('espace');
      return base.from('crm_prospects').select(COLS).eq('workspace_id', ws).then(function (f) {
        if (f.error) throw new Error('fiches');
        var ids = (f.data || []).map(function (x) { return x.id; });
        var act = ids.length ? base.from('crm_activities').select('prospect_id,type,created_at').eq('type', 'appel').in('prospect_id', ids).order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] });
        return act.then(function (a) {
          if (tok !== S.jeton) return;
          S.ws = ws; S.fiches = f.data || []; S.appelAu = P.dernierAppelParFiche(a.data || [], versJourParis);
          S.robot = r[1]; S.charge = true; dessiner();
        });
      });
    }).then(null, function () { if (tok === S.jeton) { S.erreur = true; dessiner(); } });
  }

  /* ── Affichage ── */
  function tel(t) {
    if (!t) return '';
    var n = String(t).replace(/[^0-9+]/g, '');
    return '<a class="pa-tel" href="tel:' + esc(n) + '">' + esc(String(t).replace(/(\d{2})(?=\d)/g, '$1 ').trim()) + '</a>';
  }
  function liste() {
    var robot = (S.robot && S.robot.frais && S.robot.trouver && Array.isArray(S.robot.trouver.appels)) ? S.robot.trouver.appels : [];
    return P.listeDuJour(robot, S.fiches, S.appelAu, jour());
  }
  function ligneAppel(r, i) {
    var m = MOTIFS[r.motif] || ['Signal', ''], autres = (r.raisons || []).slice(1);
    return '<li class="pa-l" data-i="' + i + '"><div class="pa-ht"><div><b>' + esc(r.nom) + '</b><small>' + esc(r.ville) + (r.dep ? ' · ' + esc(r.dep) : '') + '</small></div>' +
      '<em class="lg-et"' + (m[1] ? ' data-ton="' + m[1] + '"' : '') + '>' + esc(m[0]) + '</em></div>' +
      '<p class="pa-r">' + esc((r.raisons || [])[0] || '') + '</p>' +
      (autres.length ? '<ul class="pa-au">' + autres.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="pa-nu">' + (r.telephone ? tel(r.telephone) : '<span>Numéro à chercher avant d’appeler</span>') + (P.lienSur(r.lien) ? ' <a class="pa-lien" href="' + esc(P.lienSur(r.lien)) + '" target="_blank" rel="noopener">Voir la source</a>' : '') + '</p>' +
      '<p class="pa-q">Après l’appel :</p>' +
      '<div class="pa-bs"><button type="button" class="pa-b" data-res="rdv">RDV obtenu</button><button type="button" class="pa-b" data-res="rappeler">À rappeler</button>' +
      '<button type="button" class="pa-b" data-res="injoignable">Injoignable</button><button type="button" class="pa-b" data-res="non">Pas intéressé</button></div>' +
      '<div class="pa-rap" hidden><label>Rappeler le <input type="date" class="pa-date" min="' + jour() + '" value="' + P.ajouterJours(jour(), 7) + '"></label><button type="button" class="pa-b pa-ok" data-res="rappeler-ok">Noter le rappel</button></div>' +
      '<div class="pa-quand" hidden></div><p class="pa-dit" role="status"></p></li>';
  }
  function vueJour() {
    var l = liste(), h = '';
    var r = S.robot, attend = !(r && r.frais && r.trouver && Array.isArray(r.trouver.appels));
    if (attend) h += '<p class="pa-avis">La liste arrive au prochain passage, à 7 h 05. En attendant, voici vos relances du jour.</p>';
    if (!l.length) {
      return h + '<div class="pa-vide"><p>' + (attend ? 'Aucune relance à faire aujourd’hui.' : 'Tout est appelé pour aujourd’hui. Bravo.') + '</p><p>' +
        (attend ? 'Pour en préparer, ajoutez des pharmacies depuis la Veille : les reprises du secteur y sont déjà.' : 'La prochaine liste arrive demain à 7 h 05. Vous pouvez aussi ajouter des pistes depuis la Veille.') +
        '</p><button type="button" class="lg-gros" data-vers="veille">Ouvrir la Veille</button></div>';
    }
    return h + '<p class="pa-lt">' + l.length + ' pharmacie' + (l.length > 1 ? 's' : '') + ' à appeler, la plus importante en premier</p><ul class="pa-liste">' + l.map(ligneAppel).join('') + '</ul>';
  }
  function vuePistes() {
    var g = P.grouperParEtape(S.fiches).filter(function (e) { return e.fiches.length; });
    if (!g.length) return '<div class="pa-vide"><p>Vous n’avez pas encore de piste.</p><p>Une piste naît quand vous appelez une pharmacie de la liste du jour, ou quand vous en ajoutez une depuis la Veille.</p><button type="button" class="lg-gros" data-vers="veille">Ouvrir la Veille</button></div>';
    return g.map(function (e) {
      return '<section class="pa-et"><h2>' + esc(e.nom) + ' <span>' + e.fiches.length + '</span></h2><ul class="pa-pistes">' + e.fiches.map(function (f) {
        return '<li><button type="button" class="pa-piste" data-fiche="' + esc(f.id) + '"><b>' + esc(f.nom) + '</b><small>' + esc(f.ville || '') + (f.next_action ? ' · ' + esc(f.next_action) + (f.next_action_date ? ' le ' + esc(P.jourFr(f.next_action_date)) : '') : '') + '</small></button></li>';
      }).join('') + '</ul></section>';
    }).join('');
  }
  var JOURNAL = { id: null, lignes: null };
  function vueFiche() {
    var f = S.fiches.filter(function (x) { return x.id === S.fiche; })[0];
    if (!f) return '<p class="pa-avis">Cette piste n’existe plus.</p><button type="button" class="pa-b" data-retour="1">Retour aux pistes</button>';
    var adr = [f.cp, f.ville].filter(Boolean).join(' ');
    var h = '<button type="button" class="pa-retour" data-retour="1">← Mes pistes</button><div class="pa-fiche"><h2>' + esc(f.nom) + '</h2><p class="pa-sub">' + esc(P.nomEtape(f.stage)) + '</p>' +
      '<dl class="pa-coord"><div><dt>Adresse</dt><dd>' + (esc(adr) || 'Non renseignée') + '</dd></div><div><dt>Téléphone</dt><dd>' + (f.telephone ? tel(f.telephone) : 'Non renseigné') + '</dd></div>' +
      '<div><dt>E-mail</dt><dd>' + (f.email ? '<a href="mailto:' + esc(f.email) + '">' + esc(f.email) + '</a>' : 'Non renseigné') + '</dd></div><div><dt>Titulaire</dt><dd>' + (esc(f.pharmacien) || 'Non renseigné') + '</dd></div></dl>' +
      '<label class="pa-ch">Étape<select id="pa-etape">' + P.ETAPES.map(function (e) { return '<option value="' + e.cle + '"' + (e.cle === f.stage ? ' selected' : '') + '>' + esc(e.nom) + '</option>'; }).join('') + (f.stage === 'archive' ? '<option value="archive" selected>Archivée</option>' : '') + '</select></label>' +
      '<div class="pa-suite"><label class="pa-ch">Prochaine action<input type="text" id="pa-act" maxlength="120" value="' + esc(f.next_action || '') + '" placeholder="Par exemple : Rappeler"></label>' +
      '<label class="pa-ch">Pour le<input type="date" id="pa-actdate" value="' + esc(f.next_action_date || '') + '"></label><button type="button" class="pa-b" id="pa-actok">Enregistrer</button></div><p class="pa-dit" id="pa-dit-fiche" role="status"></p>' +
      '<h3>Journal</h3><div id="pa-journal">' + (JOURNAL.id === f.id && JOURNAL.lignes ? journalHtml() : '<p class="pa-avis">Chargement du journal…</p>') + '</div>' +
      '<label class="pa-ch">Ajouter une note<textarea id="pa-note" rows="3" maxlength="1200" placeholder="Ce qui s’est dit, ce qu’il faut retenir…"></textarea></label><button type="button" class="pa-b pa-ok" id="pa-noteok">Ajouter la note</button><p class="pa-dit" id="pa-dit-note" role="status"></p></div>';
    return h;
  }
  function journalHtml() {
    if (!JOURNAL.lignes.length) return '<p class="pa-avis">Rien n’est encore noté sur cette piste. Écrivez la première note ci-dessous.</p>';
    return '<ul class="pa-jour">' + JOURNAL.lignes.map(function (a) {
      return '<li><span>' + esc(P.jourFr(versJourParis(a.created_at))) + '</span><p>' + esc(P.phraseJournal(a.type, a.body)) + '</p></li>';
    }).join('') + '</ul>';
  }
  function chargerJournal(id) {
    JOURNAL = { id: id, lignes: null };
    sb().from('crm_activities').select('type,body,created_at').eq('prospect_id', id).order('created_at', { ascending: false }).limit(100).then(function (r) {
      if (S.fiche !== id) return;
      JOURNAL = { id: id, lignes: r && !r.error ? (r.data || []) : [] };
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
    el.innerHTML = '<section class="pa" aria-label="Appels"><header class="pa-tete"><h1>Appels</h1><p>Qui appeler aujourd’hui, et où en sont vos pistes.</p></header>' +
      (S.fiche ? '' : '<div class="pa-ong" role="tablist"><button type="button" role="tab" class="pa-o" data-ong="jour" aria-selected="' + (S.onglet === 'jour') + '">À appeler aujourd’hui' + (n ? ' <span>' + n + '</span>' : '') + '</button>' +
        '<button type="button" role="tab" class="pa-o" data-ong="pistes" aria-selected="' + (S.onglet === 'pistes') + '">Mes pistes' + (np ? ' <span>' + np + '</span>' : '') + '</button></div>') +
      '<div class="pa-corps">' + corps + '</div></section>';
  }

  /* ── Écritures : les mêmes que logCall (V1) ── */
  function noter(r, resultat, choisie, li, debutRdv) {
    var base = sb(), dit = li.querySelector('.pa-dit'), jr = jour();
    function dire(t) { dit.textContent = t; li.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); }
    li.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    dit.textContent = '';
    var suite = P.suiteAppel(resultat, jr, choisie, '');
    if (debutRdv) suite.maj.next_action_date = debutRdv.slice(0, 10); // la prochaine action tombe le jour du rendez-vous
    var fiche = (r.prospectId && S.fiches.filter(function (f) { return f.id === r.prospectId; })[0]) ||
      (function () { var c = P.cle(r.nom, r.ville); var t = S.fiches.filter(function (f) { return P.cle(f.nom, f.ville) === c; }); return t.filter(function (f) { return f.stage !== 'archive'; })[0] || t[0] || null; })();
    if (fiche && fiche.stage === 'archive') return dire('Cette pharmacie est archivée : rouvrez sa piste depuis « Mes pistes ».');
    function avoirFiche() { return fiche ? Promise.resolve(fiche) : base.from('crm_prospects').insert({
      workspace_id: S.ws, nom: r.nom, ville: r.ville || null, cp: r.cp || null, departement: r.dep || (r.cp ? String(r.cp).slice(0, 2) : null),
      pharmacien: r.pharmacien || null, telephone: r.telephone || null, email: r.email || null, stage: 'a_qualifier', source: r.origine || 'annuaire',
      lat: r.lat == null ? null : r.lat, lon: r.lon == null ? null : r.lon
    }).select(COLS).single().then(function (n) {
      if (n.error || !n.data) throw new Error('creer');
      var raisons = (r.raisons || []).join(' · ').slice(0, 1200);
      return (raisons ? base.from('crm_activities').insert({ prospect_id: n.data.id, type: 'note', body: raisons }).then(function () { return n.data; }, function () { return n.data; }) : n.data);
    }); }
    /* « RDV obtenu » avec une heure : on RELIT les rendez-vous juste avant d'écrire (heure passée ou créneau pris = refus, rien n'est écrit). */
    var verif = debutRdv ? RDV.lire(base, S.ws).then(function (x) {
      var m = P.heureValide(debutRdv, P.maintenantParis()) || (P.dejaPris(x.rdvs, debutRdv, P.REGLAGES_AGENDA.dureeMin) ? P.MSG_PRIS : null);
      if (m) { var e = new Error('refus'); e.refus = m; throw e; }
    }) : Promise.resolve();
    var rdvPose = false;
    verif.then(avoirFiche).then(function (f) {
      var avant = debutRdv ? RDV.ecrire(base, f.id, 'creer', crypto.randomUUID(), {
        debut: debutRdv, duree_min: P.REGLAGES_AGENDA.dureeMin, lieu: P.lieuPharmacie({ nom: f.nom, adresse: f.adresse, ville: f.ville }), objet: 'Premier rendez-vous'
      }).then(function (w) { if (w.error) throw new Error('rdv'); rdvPose = true; }) : Promise.resolve();
      return avant.then(function () { return base.from('crm_activities').insert({ prospect_id: f.id, type: 'appel', body: suite.body }); }).then(function (a) {
        if (a.error) throw new Error('appel');
        return base.from('crm_prospects').update(suite.maj).eq('id', f.id).eq('workspace_id', S.ws).select(COLS).single();
      }).then(function (u) {
        if (u.error || !u.data) throw new Error('maj');
        var i = S.fiches.map(function (x) { return x.id; }).indexOf(u.data.id);
        if (i < 0) S.fiches.push(u.data); else S.fiches[i] = u.data;
        S.appelAu[u.data.id] = jr;
        if (debutRdv) { S.flash = 'Rendez-vous posé : ' + P.quandFr(debutRdv) + ' chez ' + r.nom + '.'; dessiner(); return; }
        S.flash = 'Noté : ' + r.nom + ' — ' + { rdv: 'rendez-vous obtenu', rappeler: 'à rappeler', injoignable: 'injoignable', non: 'pas intéressé' }[resultat] + '.' +
          (suite.maj.next_action_date ? ' Prochaine action le ' + P.jourFr(suite.maj.next_action_date) + '.' : ' La piste passe dans les perdues.');
        dessiner();
      });
    }).then(null, function (e) { dire(e && e.refus ? e.refus : rdvPose ? 'Le rendez-vous est posé, mais l’appel n’a pas pu être noté : ouvrez la fiche dans « Mes pistes ».' : PAS); });
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
        x.fiches.filter(function (y) { return P.cle(y.nom, y.ville) === P.cle(r.nom, r.ville); })[0] || null;
      var lat = f && f.lat != null ? f.lat : r.lat, lon = f && f.lon != null ? f.lon : r.lon;
      var cible = lat != null && lon != null ? { lat: lat, lon: lon } : null;
      var cren = RDV.propositions(x.rdvs, x.fiches, cible);
      var h = '<p class="pa-q">Quand ?</p>';
      h += cren.length ? '<div class="pa-cren">' + cren.map(function (c) {
        return '<button type="button" class="pa-b pa-cr" data-res="quand" data-debut="' + esc(c.debut) + '"><b>' + esc(P.maj(P.quandFr(c.debut))) + '</b><small>' + esc(RDV.detail(c)) + '</small></button>';
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
    var o = t.closest('[data-ong]'); if (o) { S.onglet = o.getAttribute('data-ong'); S.flash = ''; dessiner(); return; }
    var pf = t.closest('[data-fiche]'); if (pf) { S.fiche = pf.getAttribute('data-fiche'); dessiner(); chargerJournal(S.fiche); window.scrollTo(0, 0); return; }
    if (t.closest('[data-retour]')) { S.fiche = null; S.onglet = 'pistes'; dessiner(); return; }
    var b = t.closest('.pa-b[data-res]'), li = t.closest('.pa-l');
    if (b && li) {
      var r = liste()[+li.getAttribute('data-i')], res = b.getAttribute('data-res');
      if (!r) return;
      if (res === 'rappeler') { var z = li.querySelector('.pa-rap'); z.hidden = !z.hidden; if (!z.hidden) li.querySelector('.pa-date').focus(); return; }
      if (res === 'rdv') { ouvrirQuand(r, li); return; }
      if (res === 'quand-fermer') { li.querySelector('.pa-quand').hidden = true; return; }
      if (res === 'quand') { noter(r, 'rdv', null, li, b.getAttribute('data-debut')); return; }
      if (res === 'quand-ok') {
        var hl = RDV.heureLibre(li.querySelector('.pa-qdate').value, li.querySelector('.pa-qheure').value);
        if (hl.erreur) { li.querySelector('.pa-dit').textContent = hl.erreur; return; }
        noter(r, 'rdv', null, li, hl.debut); return;
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
      sb().from('crm_activities').insert({ prospect_id: id, type: 'note', body: txt }).then(function (r) {
        t.disabled = false;
        if (r.error) { dn.textContent = PAS; return; }
        n.value = ''; dn.textContent = 'Note ajoutée.';
        JOURNAL.lignes = [{ type: 'note', body: txt, created_at: new Date().toISOString() }].concat(JOURNAL.lignes || []);
        var z = document.getElementById('pa-journal'); if (z) z.innerHTML = journalHtml();
      }, function () { t.disabled = false; dn.textContent = PAS; });
    }
  }
  function change(ev) {
    if (ev.target.id !== 'pa-etape') return;
    var f = S.fiches.filter(function (x) { return x.id === S.fiche; })[0], dit = document.getElementById('pa-dit-fiche'); if (!f) return;
    majFiche(f.id, { stage: ev.target.value }, dit, 'Étape mise à jour : ' + P.nomEtape(ev.target.value) + '.');
  }

  V2.pages.appels = { needs: [], render: function (root) {
    S.racine = root; S.fiche = null; S.flash = '';
    if (!root.__pa) { root.__pa = true; root.addEventListener('click', clic); root.addEventListener('change', change); }
    charger();
  } };
})();
