/* PHIRST · écran « Agenda » (21/11/2026) : la journée de Yann (maquette « Agenda m1 · La journée », choisie par Will).
   Transposé de la V1 (~/phirst-studio : app/agenda/page.tsx, components/agenda/Journee.tsx, lib/journee.ts, app/agenda/actions.ts).
   Un rendez-vous = une ligne `crm_activities` de type « rdv » : chaque geste (confirmer, déplacer, annuler, c'est fait) AJOUTE une ligne,
   on ne modifie ni ne supprime jamais rien. La lecture et l'écriture partagent window.PHIRST_RDV (phirst-appels.js) ; toute la logique
   (créneaux, états, vérifications) est dans phirst-pur.js, testée (tests/phirst-agenda.test.mjs). */
(function () {
  'use strict';
  var P = window.PHIRST_PUR, V2 = window.V2, RDV = window.PHIRST_RDV;
  if (!P || !V2 || !RDV) return;
  V2.pages = V2.pages || {};
  var PAS = 'Pas enregistré : réessayez dans un instant.';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }
  function jour() { return P.aujourdhui(); }

  var S = { racine: null, jeton: 0, telepro: false, ws: null, fiches: [], rdvs: [], jour: null, flash: '', charge: false, erreur: false, ouvert: null, mode: null, props: null };

  function charger(garder) {
    var u = V2.user, tok = ++S.jeton, base = sb();
    if (!garder) { S.charge = false; S.erreur = false; }
    if (!u || !base) { S.erreur = true; dessiner(); return Promise.resolve(); }
    if (!garder) dessiner();
    /* Elle n'est pas membre de l'espace : pas de lecture de crm_members, tout vient de telepro_agenda (RDV.lire). */
    return window.PHIRST_ROLE.estTelepro().then(function (t) {
      S.telepro = t;
      return t ? { data: { workspace_id: null } } : base.from('crm_members').select('workspace_id').eq('user_id', u.id).limit(1).maybeSingle();
    }).then(function (m) {
      var ws = m && !m.error && m.data && m.data.workspace_id;
      if (!ws && !S.telepro) throw new Error('espace');
      return RDV.lire(base, ws).then(function (x) {
        if (tok !== S.jeton) return;
        S.ws = ws; S.fiches = x.fiches; S.rdvs = x.rdvs; S.charge = true; S.erreur = false; dessiner();
      });
    }).then(null, function () { if (tok === S.jeton) { S.erreur = true; dessiner(); } });
  }

  /* ── Affichage ── */
  function elements() { return P.lierRdv(S.rdvs, S.fiches); }
  function hh(local) { return P.heureFr(String(local).slice(11)); }
  function etatBadge(r) {
    var ton = r.statut === 'propose' || r.statut === 'reporte' ? 'orange' : r.statut === 'annule' ? '' : 'vert';
    var mot = S.telepro && P.aConfirmer(r) ? 'En attente de Yann' : P.maj(P.STATUTS_RDV[r.statut]);   // elle ne confirme pas : c'est Yann qui le fait
    return '<em class="lg-et"' + (ton ? ' data-ton="' + ton + '"' : '') + '>' + esc(mot) + '</em>';
  }
  function role() { return S.telepro ? 'telepro' : 'patron'; }
  function boutonsRdv(e, maintenant) {
    var r = e.rdv, b = '';
    if (e.fiche.occupe) return '';   // un rendez-vous de Yann qui n'est pas le sien : « Yann est occupé », sans bouton
    if (P.gestePermis(r, 'confirmer', role())) b += '<button type="button" class="pa-b pa-ok" data-ag="confirmer" data-rdv="' + esc(r.id) + '">Confirmer</button>';
    if (P.gestePermis(r, 'deplacer', role())) b += '<button type="button" class="pa-b" data-ag="deplacer" data-rdv="' + esc(r.id) + '">Déplacer</button>';
    if (P.gestePermis(r, 'fait', role()) && P.minutes(r.debut) < P.minutes(maintenant)) b += '<button type="button" class="pa-b" data-ag="fait" data-rdv="' + esc(r.id) + '">C’est fait</button>';
    if (P.gestePermis(r, 'annuler', role())) b += '<button type="button" class="pa-b" data-ag="annuler" data-rdv="' + esc(r.id) + '">Annuler</button>';
    return b ? '<div class="pa-bs">' + b + '</div>' : '';
  }
  /* La zone ouverte sous un rendez-vous : déplacer (créneaux + autre heure) ou confirmation d'annulation. */
  function zoneOuverte(e) {
    if (S.ouvert !== e.rdv.id) return '';
    if (S.mode === 'annuler') {
      return '<div class="ag-zone"><p class="pa-q">Annuler ce rendez-vous ?</p><p class="pa-avis">Le rendez-vous du ' + esc(P.quandFr(e.rdv.debut)) + ' chez ' + esc(e.fiche.nom) + ' sera marqué comme annulé. Vous pouvez le garder.</p>' +
        '<div class="pa-bs"><button type="button" class="pa-b pa-ok" data-ag="annuler-ok" data-rdv="' + esc(e.rdv.id) + '">Oui, annuler</button><button type="button" class="pa-b" data-ag="fermer">Non, le garder</button></div></div>';
    }
    if (S.mode === 'deplacer') {
      var h = '<div class="ag-zone"><p class="pa-q">Déplacer à quel moment ?</p>';
      if (!S.props) h += '<p class="pa-avis" role="status">Recherche des meilleurs créneaux…</p>';
      else {
        h += S.props.length ? '<div class="pa-cren">' + S.props.map(function (c) {
          return '<button type="button" class="pa-b pa-cr" data-ag="deplacer-ok" data-rdv="' + esc(e.rdv.id) + '" data-debut="' + esc(c.debut) + '"><b>' + esc(P.maj(P.quandFr(c.debut))) + '</b><small>' + esc(RDV.detail(c, S.telepro)) + '</small></button>';
        }).join('') + '</div>' : '<p class="pa-avis">Aucun créneau libre dans les dix prochains jours ouvrés : choisissez une autre heure.</p>';
        h += '<div class="pa-rap"><span class="pa-qt">Une autre heure</span><label>Le <input type="date" class="pa-qdate" min="' + jour() + '" value="' + esc(P.joursProposes(jour())[0]) + '"></label>' +
          '<label>À <input type="time" class="pa-qheure" step="1800" value="09:00"></label><button type="button" class="pa-b pa-ok" data-ag="autre-heure" data-rdv="' + esc(e.rdv.id) + '">Choisir cette heure</button></div>';
      }
      return h + '<button type="button" class="pa-b" data-ag="fermer">Fermer</button></div>';
    }
    return '';
  }
  function carteRdv(e, maintenant) {
    var r = e.rdv, f = e.fiche, ligne2 = [r.lieu, r.objet].filter(Boolean).join(' · ');
    var titre = f.occupe ? f.nom + (f.ville ? ' · ' + f.ville : '') : f.nom;   // « Yann est occupé · commune »
    return '<li class="pa-l ag-rdv' + (r.statut === 'annule' ? ' ag-annule' : '') + '" data-rdv="' + esc(r.id) + '"><div class="pa-ht"><div><b>' + esc(hh(r.debut)) + ' – ' + esc(hh(r.fin)) + ' · ' + esc(titre) + '</b>' +
      '<small>' + esc(f.occupe ? '' : ligne2 || f.ville || '') + '</small></div>' + (f.occupe && r.statut !== 'annule' ? '' : etatBadge(r)) + '</div>' +
      (e.chevauche ? '<p class="ag-alerte" role="alert">Attention : deux rendez-vous se chevauchent à cette heure-là.</p>' : '') +
      (r.statut === 'annule' ? '' : boutonsRdv(e, maintenant)) + zoneOuverte(e) + '<p class="pa-dit" role="status"></p></li>';
  }
  function dessiner() {
    var el = S.racine; if (!el) return;
    if (V2.route && V2.route.name !== 'agenda') return; // la racine est commune à tous les écrans : jamais de redessin par-dessus un autre écran
    var corps;
    if (S.erreur) corps = '<div class="pa-vide"><p>L’agenda ne s’est pas chargé.</p><p>Vérifiez votre connexion puis réessayez.</p><button type="button" class="lg-gros" data-ag="reessayer">Réessayer</button></div>';
    else if (!S.charge) corps = '<p class="pa-avis">Chargement…</p>';
    else corps = (S.flash ? '<p class="pa-flash" role="status">' + esc(S.flash) + '</p>' : '') + vue();
    el.innerHTML = '<section class="pa ag" aria-label="Agenda"><header class="pa-tete"><h1>Agenda</h1><p>Vos rendez-vous, jour par jour.</p></header><div class="pa-corps">' + corps + '</div></section>';
  }
  function vue() {
    var auj = jour(), maint = P.maintenantParis(), J = S.jour || auj, els = elements(), h = '';
    var fen = P.fenetreJours(J, auj), dec = P.decalages(fen, auj), comptes = P.comptesParJour(els, fen);
    var libresJ = P.creneauxLibres({ jour: J, occupations: RDV.occupations(S.rdvs, S.fiches), cible: null, maintenant: maint });
    // À confirmer
    var conf = els.filter(function (e) { return e.aConfirmer && P.minutes(e.rdv.fin) >= P.minutes(maint); });
    if (conf.length) {
      h += '<section class="ag-conf" aria-label="' + (S.telepro ? 'En attente de Yann' : 'À confirmer') + '"><h2>' + (S.telepro ? 'En attente de Yann' : 'À confirmer') + '</h2><ul class="pa-liste">' + conf.map(function (e) {
        return '<li class="pa-l" data-rdv="' + esc(e.rdv.id) + '"><div class="pa-ht"><div><b>' + esc(e.fiche.nom) + '</b><small>' + esc(P.maj(P.quandFr(e.rdv.debut))) + (e.fiche.ville ? ' · ' + esc(e.fiche.ville) : '') + '</small></div>' + etatBadge(e.rdv) + '</div>' +
          '<div class="pa-bs">' + (S.telepro ? '' : '<button type="button" class="pa-b pa-ok" data-ag="confirmer" data-rdv="' + esc(e.rdv.id) + '">Confirmer</button>') + '<button type="button" class="pa-b" data-ag="deplacer" data-rdv="' + esc(e.rdv.id) + '">Déplacer</button></div>' +
          zoneOuverte(e) + '<p class="pa-dit" role="status"></p></li>';
      }).join('') + '</ul></section>';
    }
    // Ensuite
    var c = P.carteEnsuite({ elements: els, jour: J, aujourdhui: auj, maintenant: maint, libres: libresJ.length });
    h += '<div class="ag-ens"><p class="ag-ens-m">' + esc(c.maint) + '</p><p class="ag-ens-t">' + esc(c.titre) + '</p><p class="ag-ens-d">' + esc(c.detail) + '</p></div>';
    // puces de jour
    h += '<div class="ag-jours" role="group" aria-label="Jour affiché">' + fen.map(function (j) {
      return '<button type="button" class="ag-jour" data-ag="jour" data-jour="' + j + '" aria-pressed="' + (j === J) + '">' + esc(P.jourCourt(j)) + '<small>' + esc(P.sousPuce(j, auj, comptes[j])) + '</small></button>';
    }).join('') + '</div>';
    h += '<nav class="ag-periode" aria-label="Période"><button type="button" class="ag-lien" data-ag="jour" data-jour="' + dec.avant + '">‹ Avant</button><button type="button" class="ag-lien" data-ag="jour" data-jour="' + dec.apres + '">Après ›</button>' +
      (dec.montrerAujourdhui ? '<button type="button" class="ag-lien" data-ag="jour" data-jour="' + auj + '">Aujourd’hui</button>' : '') + '</nav>';
    // la journée
    var duJ = P.duJour(els, J), actifs = duJ.filter(function (e) { return e.rdv.statut !== 'annule'; }), annules = duJ.filter(function (e) { return e.rdv.statut === 'annule'; });
    h += '<h2 class="ag-jt">' + esc(P.maj(P.dateLongue(J))) + '</h2>';
    if (!actifs.length) {
      h += '<div class="pa-vide ag-vide"><p>Rien de prévu ce jour-là.</p><p>' + (!P.estJourOuvre(J) ? 'C’est le week-end : aucun rendez-vous n’est proposé.' :
        libresJ.length ? (S.telepro ? 'Yann est libre ' : 'Vous êtes libre ') + esc(P.plagesLibres(libresJ).join(' et ')) + ' (' + esc(P.phraseLibres(libresJ.length)) + ').' : 'Il ne reste plus de créneau d’une heure libre ce jour-là.') + '</p></div>';
    } else {
      h += '<p class="pa-avis">' + esc(P.phraseEtat(duJ, libresJ.length, S.telepro)) + '</p><ul class="pa-liste">' + actifs.map(function (e) { return carteRdv(e, maint); }).join('') + '</ul>';
    }
    // Repliés : quelques annulations ne doivent pas repousser la journée hors de vue.
    if (annules.length) h += '<details class="ag-annules"><summary class="ag-sh">Annulés ce jour (' + annules.length + ')</summary><ul class="pa-liste">' + annules.map(function (e) { return carteRdv(e, maint); }).join('') + '</ul></details>';
    return h;
  }

  /* ── Gestes : chacun AJOUTE une ligne rdv, puis on relit et on redessine, sans recharger la page ── */
  function geste(quoi, id, debut, li) {
    var base = sb(), dit = li.querySelector('.pa-dit');
    function dire(t) { dit.textContent = t; li.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); }
    li.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    dit.textContent = '';
    // on RELIT juste avant d'écrire : un rendez-vous pris entre-temps (par l'autre appli, par un collègue) compte
    RDV.lire(base, S.ws).then(function (x) {
      var r = x.rdvs.filter(function (t) { return t.id === id; })[0];
      if (!r) return dire('Ce rendez-vous n’a pas pu être retrouvé.');
      if (!P.gestePermis(r, quoi, role())) return dire(quoi === 'confirmer' ? 'Seul Yann confirme un rendez-vous.' : 'Ce rendez-vous est déjà clos.');
      var extra = null;
      if (quoi === 'deplacer') {
        var faux = P.heureValide(debut, P.maintenantParis());
        if (faux) return dire(faux);
        if (debut === r.debut) return dire('C’est déjà l’heure de ce rendez-vous.');
        if (P.dejaPris(x.rdvs, debut, r.duree_min, r.id)) return dire(P.MSG_PRIS);
        extra = { debut: debut, duree_min: r.duree_min };
      }
      return RDV.ecrire(base, r.prospect_id, quoi, r.id, extra).then(function (w) {
        if (w.error) { var eb = new Error('ecrire'); eb.base = S.telepro ? P.messageDeLaBase(w.error) : ''; throw eb; }
        var f = x.fiches.filter(function (y) { return y.id === r.prospect_id; })[0] || { nom: 'la pharmacie' };
        S.flash = { confirmer: 'Rendez-vous confirmé', deplacer: 'Rendez-vous déplacé : ' + P.quandFr(debut), annuler: 'Rendez-vous annulé', fait: 'Noté : le rendez-vous est fait' }[quoi] + ' (' + f.nom + ').';
        if (quoi === 'deplacer') S.jour = debut.slice(0, 10);
        S.ouvert = null; S.mode = null; S.props = null;
        return charger(true);
      });
    }).then(null, function (e) { dire(e && e.base ? e.base : PAS); });
  }
  function ouvrirDeplacer(id) {
    S.ouvert = id; S.mode = 'deplacer'; S.props = null; dessiner();
    RDV.lire(sb(), S.ws).then(function (x) {
      var r = x.rdvs.filter(function (t) { return t.id === id; })[0]; if (!r || S.ouvert !== id) return;
      var f = x.fiches.filter(function (y) { return y.id === r.prospect_id; })[0] || {};
      var cible = f.lat != null && f.lon != null ? { lat: f.lat, lon: f.lon } : null;
      S.rdvs = x.rdvs; S.fiches = x.fiches;
      // se déplacer à son heure actuelle n'est pas un choix
      S.props = RDV.propositions(x.rdvs, x.fiches, cible, id).filter(function (c) { return c.debut !== r.debut; });
      dessiner();
    }, function () { S.props = []; dessiner(); });
  }

  function clic(ev) {
    var b = ev.target.closest('[data-ag]'); if (!b) return;
    var a = b.getAttribute('data-ag'), id = b.getAttribute('data-rdv'), li = b.closest('li');
    if (a === 'reessayer') { charger(); return; }
    if (a === 'jour') { S.jour = b.getAttribute('data-jour'); S.flash = ''; S.ouvert = null; S.mode = null; dessiner(); return; }
    if (a === 'fermer') { S.ouvert = null; S.mode = null; S.props = null; dessiner(); return; }
    if (a === 'deplacer') { S.flash = ''; ouvrirDeplacer(id); return; }
    if (a === 'annuler') { S.flash = ''; S.ouvert = id; S.mode = 'annuler'; dessiner(); return; }
    if (!li) return;
    if (a === 'confirmer' || a === 'fait') { geste(a, id, null, li); return; }
    if (a === 'annuler-ok') { geste('annuler', id, null, li); return; }
    if (a === 'deplacer-ok') { geste('deplacer', id, b.getAttribute('data-debut'), li); return; }
    if (a === 'autre-heure') {
      var hl = RDV.heureLibre(li.querySelector('.pa-qdate').value, li.querySelector('.pa-qheure').value);
      if (hl.erreur) { li.querySelector('.pa-dit').textContent = hl.erreur; return; }
      geste('deplacer', id, hl.debut, li);
    }
  }

  V2.pages.agenda = { needs: [], render: function (root) {
    S.racine = root; S.jour = jour(); S.flash = ''; S.ouvert = null; S.mode = null; S.props = null;
    if (!root.__ag) { root.__ag = true; root.addEventListener('click', clic); }
    charger();
  } };
})();
