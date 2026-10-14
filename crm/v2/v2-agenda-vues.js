/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Mon agenda — onglets Jour / Semaine / Mois (14/10/2026)
   Idée d'Inès Montignac : « une vision semaine et mois pour l'agenda, mélangée avec la
   to do list ». Version A1 choisie par Will le 14/10/2026.

   Ce que ce module ajoute à « Mon agenda » (v2-rdv-planning.js, qui l'appelle une fois
   ses lectures faites) :
     · Jour / Semaine / Mois : chaque jour empile les rendez-vous puis les tâches datées
       de la to do list, cochables sur place ; le mois est une vraie grille ;
     · « En retard » et « Sans date » sous la vue ;
     · un 4e onglet « Secteurs et heures » qui garde TOUT l'écran d'avant (aperçu des
       secteurs sur un trimestre, quatre semaines heure par heure, prise de rendez-vous).

   Données — rien de nouveau côté base :
     · rendez-vous  = table `rdv` (statut confirmé), le commercial voit les SIENS (user_id) ;
     · occupé       = table `rdv_occupe` (heures seules, jamais de titre), idem user_id ;
       un titre reconnu comme une officine (lu à l'ouverture, jamais stocké) s'affiche en
       rendez-vous, comme dans l'écran d'avant ;
     · indisponible = `rdv_blocage`, déjà lu par la page ;
     · tâches       = V2.todo (ligne `profils` personnelle, champ `pour`) : cocher ici =
       cocher dans la to do list, et l'inverse, c'est la même ligne.
   Lecture À LA DEMANDE : un mois à la fois (rdv + rdv_occupe), gardé en mémoire tant que
   l'écran reste ouvert ; changer d'onglet ou de semaine ne relit pas ce qui l'est déjà.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};

  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var J3 = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var H_DEB = 8 * 60, H_FIN = 19 * 60;

  // ── Dates (en UTC, comme v2-rdv-planning.js : pas de saut aux changements d'heure) ──
  function isoLocal(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function plus(iso, n) {
    var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dow(iso) { var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }
  function lundiDe(iso) { var d = dow(iso); return plus(iso, d === 0 ? -6 : 1 - d); }
  function num(iso) { return +iso.slice(8, 10); }
  function moisDe(iso) { return +iso.slice(5, 7) - 1; }
  function finDeMois(ym) { var d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)); return d.toISOString().slice(0, 10); }
  function hm2min(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function hhmm(min) { return ('0' + Math.floor(min / 60)).slice(-2) + 'h' + ('0' + (min % 60)).slice(-2); }
  function libJour(iso) { return JOURS[dow(iso)] + ' ' + num(iso) + ' ' + MOIS[moisDe(iso)]; }
  function maj(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function court(n) { var c = String(n).replace(/^Pharmacie /, '').replace(/^(du |de la |de l’|des |de )/, ''); return maj(c); }
  function auj() { return isoLocal(new Date()); }

  // ── État ──
  var S = { vue: 'semaine', ref: null, sel: null };
  var CTX = null;      // ce que la page a déjà lu (titres reconnus, blocages, réglages)
  var CACHE = {};      // 'AAAA-MM' -> { etat: 'cours' | 'ok' | 'ko', rdv: [], occ: [] }
  var PAR_JOUR = null; // date -> événements, reconstruit quand un mois arrive

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }

  // ── Lecture à la demande, un mois à la fois ──
  // Les mêmes requêtes que l'écran d'avant, mêmes filtres (user_id = moi, rendez-vous confirmés).
  function lireMois(ym) {
    if (CACHE[ym]) return;
    var c = sb(), u = uid(), e = CACHE[ym] = { etat: 'cours', rdv: [], occ: [] };
    if (!c || !u) { e.etat = 'ko'; return; }
    var d1 = ym + '-01', d2 = finDeMois(ym);
    Promise.all([
      c.from('rdv').select('*').eq('user_id', u).eq('statut', 'confirme').gte('date', d1).lte('date', d2).order('date').order('heure'),
      c.from('rdv_occupe').select('date,debut,fin,jour_entier').eq('user_id', u).gte('date', d1).lte('date', d2).order('date')
    ]).then(function (r) {
      if ((r[0] && r[0].error) || (r[1] && r[1].error)) throw new Error('lecture');
      e.rdv = (r[0] && r[0].data) || [];
      e.occ = (r[1] && r[1].data) || [];
      e.etat = 'ok';
    }).catch(function () { e.etat = 'ko'; }).then(function () { PAR_JOUR = null; if (document.getElementById('agv')) paint(); });
  }
  function moisNecessaires() {
    if (S.vue === 'jour') return [S.sel.slice(0, 7)];
    if (S.vue === 'mois') return [S.ref.slice(0, 7)];
    var j = semaineDe(S.ref), a = j[0].slice(0, 7), b = j[6].slice(0, 7);
    return a === b ? [a] : [a, b];
  }
  function etatLecture() {
    var m = moisNecessaires(), cours = false, ko = false;
    m.forEach(function (ym) { lireMois(ym); var e = CACHE[ym]; if (e.etat === 'cours') cours = true; if (e.etat === 'ko') ko = true; });
    return ko ? 'ko' : cours ? 'cours' : 'ok';
  }

  // ── Événements d'un jour ──
  function construire() {
    var idx = {}, reco = {}, dur = (CTX && CTX.dispo && CTX.dispo.duree_min) || 45;
    function pose(e) { (idx[e.date] = idx[e.date] || []).push(e); }
    ((CTX && CTX.reconnus) || []).forEach(function (x) { reco[x.date + '|' + (x.jour_entier ? 'J' : String(x.debut).slice(0, 5))] = x; });
    Object.keys(CACHE).forEach(function (ym) {
      var m = CACHE[ym];
      m.rdv.forEach(function (r) {
        pose({ date: r.date, type: 'rdv', deb: hm2min(r.heure), dur: r.duree_min || dur, label: r.nom || 'Rendez-vous', sub: r.ville || '', jarvis: true });
      });
      m.occ.forEach(function (o) {
        var x = reco[o.date + '|' + (o.jour_entier ? 'J' : String(o.debut).slice(0, 5))];
        var deb = o.jour_entier ? H_DEB : hm2min(o.debut), fin = o.jour_entier ? H_FIN : hm2min(o.fin);
        if (x) pose({ date: o.date, type: 'rdv', deb: deb, dur: fin - deb, label: x.nom, sub: (x.ville || '') + (x.etat === 'confirmer' ? (x.ville ? ' · ' : '') + 'à confirmer' : '') });
        else pose({ date: o.date, type: 'occ', entier: !!o.jour_entier, deb: deb, dur: fin - deb, label: o.jour_entier ? 'Occupé toute la journée' : 'Occupé', sub: 'agenda personnel' });
      });
    });
    ((CTX && CTX.blocages) || []).forEach(function (b) {
      var d = b.moment === 'apres_midi' ? 12 * 60 : H_DEB, f = b.moment === 'matin' ? 12 * 60 : H_FIN;
      pose({ date: b.date, type: 'blo', deb: d, dur: f - d, label: 'Indisponible', sub: b.moment === 'matin' ? 'matin bloqué' : b.moment === 'apres_midi' ? 'après-midi bloqué' : 'journée bloquée' });
    });
    // Un « occupé » de l'agenda perso qui tombe sur un rendez-vous JARVIS est ce même rendez-vous
    // recopié dans Google/Outlook : on ne l'affiche pas (ni dans les compteurs). Début de l'occupé
    // dans [début rdv − 15 min ; fin rdv], ou plages qui se chevauchent. « Toute la journée » reste.
    Object.keys(idx).forEach(function (k) {
      var rv = idx[k].filter(function (e) { return e.jarvis; });
      if (!rv.length) return;
      idx[k] = idx[k].filter(function (e) {
        if (e.type !== 'occ' || e.entier) return true;
        return !rv.some(function (r) {
          return (e.deb >= r.deb - 15 && e.deb <= r.deb + r.dur) || (e.deb < r.deb + r.dur && e.deb + e.dur > r.deb);
        });
      });
    });
    Object.keys(idx).forEach(function (k) { idx[k].sort(function (a, b) { return a.deb - b.deb; }); });
    return idx;
  }
  function evDe(iso) { if (!PAR_JOUR) PAR_JOUR = construire(); return PAR_JOUR[iso] || []; }
  function nbRdv(iso) { return evDe(iso).filter(function (e) { return e.type === 'rdv'; }).length; }

  // ── Tâches : celles de la to do list ──
  function tous() { return (V2.todo && V2.todo.tous) ? V2.todo.tous() : []; }
  function tachesDe(iso) { return tous().filter(function (t) { return t.pour === iso; }); }
  function aFaireDe(iso) { return tachesDe(iso).filter(function (t) { return !t.fait; }); }
  function enRetard() { var a = auj(); return tous().filter(function (t) { return !t.fait && t.pour && t.pour < a; }); }
  function sansDate() { return tous().filter(function (t) { return !t.fait && !t.pour; }); }
  function nomTache(t) { return V2.todo && V2.todo.libelle ? V2.todo.libelle(t) : (t.nom || t.note || 'À faire'); }

  // ── Pièces communes ──
  function chip(e) {
    return '<div class="agv-ev agv-e-' + e.type + '"><i></i><b>' + hhmm(e.deb) + '</b><span>' + esc(e.label) + '</span>' +
      (e.sub ? '<small>' + esc(e.sub) + '</small>' : '') + '</div>';
  }
  function tache(t, avecDate) {
    var retard = !t.fait && t.pour && t.pour < auj();
    return '<label class="agv-t' + (t.fait ? ' fait' : '') + '">' +
      '<input type="checkbox" data-id="' + esc(t.id) + '"' + (t.fait ? ' checked' : '') + ' onchange="V2.agendaVues.cocher(\'' + esc(t.id) + '\',this.checked)" ' +
      'aria-label="' + (t.fait ? 'Remettre à faire' : 'Marquer comme fait') + ' : ' + esc(nomTache(t)) + '"><span class="agv-box"></span>' +
      '<span class="agv-tt">' + esc(nomTache(t)) + (retard && avecDate ? ' <em>' + esc(J3[dow(t.pour)] + ' ' + num(t.pour)) + '</em>' : '') + '</span></label>';
  }
  function resume(iso) {
    var r = nbRdv(iso), t = aFaireDe(iso).length, p = [];
    if (r) p.push(r + ' rendez-vous');
    if (t) p.push(t + ' à faire');
    return p.join(' · ') || 'libre';
  }
  function enteteJour(iso) {
    return '<div class="agv-dh' + (iso === auj() ? ' auj' : '') + '"><span class="agv-dj">' + J3[dow(iso)] + '</span><span class="agv-dn">' + num(iso) + '</span>' +
      (iso === auj() ? '<span class="agv-tag">aujourd’hui</span>' : '') + '<span class="agv-dr">' + esc(resume(iso)) + '</span></div>';
  }
  function blocLibres() {
    var r = enRetard(), s = sansDate();
    if (!r.length && !s.length) return '';
    return '<div class="agv-sd">' +
      (r.length ? '<div class="agv-sdb"><h3>En retard <span>' + r.length + '</span></h3>' + r.map(function (t) { return tache(t, true); }).join('') + '</div>' : '') +
      (s.length ? '<div class="agv-sdb"><h3>Sans date <span>' + s.length + '</span></h3>' + s.map(function (t) { return tache(t); }).join('') + '</div>' : '') +
      '</div>';
  }
  function legende() {
    return '<div class="agv-leg"><span><i class="agv-e-rdv"></i>rendez-vous pharmacie</span><span><i class="agv-e-occ"></i>occupé (agenda perso)</span>' +
      '<span><i class="agv-e-blo"></i>bloqué par vous</span><span><i class="agv-lt"></i>tâche à faire</span></div>';
  }
  function semaineDe(ref) { var l = lundiDe(ref), o = []; for (var i = 0; i < 7; i++) o.push(plus(l, i)); return o; }

  // ═══ JOUR ═══
  // `avecTitre` : faux dans l'onglet Jour, où la date est déjà le titre de la période
  // (elle s'affichait deux fois, constaté sur le prototype).
  function carteJour(iso, avecTitre) {
    var ev = evDe(iso), ta = tachesDe(iso);
    return '<div class="agv-carte"><div class="agv-ch' + (avecTitre ? '' : ' seul') + '">' + (avecTitre ? '<b>' + esc(maj(libJour(iso))) + '</b>' : '') + '<span>' + esc(resume(iso)) + '</span></div>' +
      (ev.length ? ev.map(chip).join('') : '<p class="agv-rien">Aucun rendez-vous : journée libre.</p>') +
      '<div class="agv-sep">À faire ce jour</div>' +
      (ta.length ? ta.map(function (t) { return tache(t); }).join('') : '<p class="agv-rien">Aucune tâche pour ce jour.</p>') + '</div>';
  }
  function vueJour() { return carteJour(S.sel, false) + blocLibres(); }

  // ═══ SEMAINE ═══
  function vueSemaine() {
    return '<div class="agv-pile">' + semaineDe(S.ref).map(function (iso) {
      var ev = evDe(iso), ta = tachesDe(iso), we = dow(iso) === 0 || dow(iso) === 6;
      if (we && !ev.length && !ta.length) return '';
      return '<section class="agv-col' + (iso === auj() ? ' auj' : '') + (!ev.length && !ta.length ? ' vide' : '') + '">' + enteteJour(iso) +
        ev.map(chip).join('') +
        (ta.length ? '<div class="agv-sep">À faire</div>' + ta.map(function (t) { return tache(t); }).join('') : '') +
        '</section>';
    }).join('') + '</div>' + blocLibres();
  }

  // ═══ MOIS ═══
  function casesMois(ref) {
    var p = ref.slice(0, 8) + '01', l = lundiDe(p), cases = [];
    for (var i = 0; i < 42; i++) {
      var d = plus(l, i);
      if (i >= 35 && d.slice(0, 7) !== p.slice(0, 7)) break;
      cases.push(d);
    }
    return cases;
  }
  function vueMois() {
    var m = S.ref.slice(0, 7), a = auj();
    var entetes = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(function (j) { return '<span>' + j + '</span>'; }).join('');
    return '<div class="agv-mois"><div class="agv-mh">' + entetes + '</div><div class="agv-mg">' +
      casesMois(S.ref).map(function (iso) {
        if (iso.slice(0, 7) !== m) return '<div class="agv-cell hors" aria-hidden="true"><span class="agv-cn">' + num(iso) + '</span></div>';
        var ev = evDe(iso).filter(function (e) { return e.type === 'rdv'; }), ta = tachesDe(iso), lignes = [];
        ev.forEach(function (e) { lignes.push('<span class="agv-p"><b>' + hhmm(e.deb) + '</b><span>' + esc(court(e.label)) + '</span></span>'); });
        ta.forEach(function (t) { lignes.push('<span class="agv-pt' + (t.fait ? ' fait' : '') + '"><i></i><span>' + esc(nomTache(t)) + '</span></span>'); });
        var vus = lignes.slice(0, 3), reste = lignes.length - vus.length;
        return '<button type="button" class="agv-cell' + (iso === a ? ' auj' : '') + (iso === S.sel ? ' sel' : '') + '" onclick="V2.agendaVues.choisir(\'' + iso + '\')" ' +
          'aria-label="' + esc(libJour(iso) + ' : ' + resume(iso)) + '"' + (iso === S.sel ? ' aria-pressed="true"' : '') + '>' +
          '<span class="agv-cn">' + num(iso) + '</span>' +
          '<span class="agv-cl">' + vus.join('') + (reste > 0 ? '<span class="agv-plus">+ ' + reste + (reste > 1 ? ' autres' : ' autre') + '</span>' : '') + '</span>' +
          '<span class="agv-dots">' + (ev.length ? '<i class="agv-e-rdv"></i>' : '') + (aFaireDe(iso).length ? '<i class="agv-lt"></i>' : '') + '</span></button>';
      }).join('') + '</div></div>' +
      '<div class="agv-sel">' + carteJour(S.sel, true) + '</div>' + blocLibres();
  }

  // ═══ Assemblage ═══
  function titrePeriode() {
    if (S.vue === 'jour') return maj(libJour(S.sel));
    if (S.vue === 'mois') return maj(MOIS[moisDe(S.ref)]) + ' ' + S.ref.slice(0, 4);
    var j = semaineDe(S.ref);
    return 'Du ' + num(j[0]) + (moisDe(j[0]) !== moisDe(j[6]) ? ' ' + MOIS[moisDe(j[0])] : '') + ' au ' + num(j[6]) + ' ' + MOIS[moisDe(j[6])];
  }
  function barre() {
    var onglets = [['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['detail', 'Secteurs et heures']].map(function (x) {
      return '<button type="button" role="tab" aria-selected="' + (S.vue === x[0]) + '" class="v2-tab' + (S.vue === x[0] ? ' on' : '') + '" onclick="V2.agendaVues.vue(\'' + x[0] + '\')">' + x[1] + '</button>';
    }).join('');
    var nav = S.vue === 'detail' ? '' :
      '<div class="agv-nav"><button type="button" class="v2-btn v2-btn-ghost" onclick="V2.agendaVues.pas(-1)" aria-label="Période précédente">‹</button>' +
      '<button type="button" class="v2-btn v2-btn-ghost agv-auj" onclick="V2.agendaVues.aujourdhui()">Aujourd’hui</button>' +
      '<button type="button" class="v2-btn v2-btn-ghost" onclick="V2.agendaVues.pas(1)" aria-label="Période suivante">›</button></div>' +
      '<h2 class="agv-per">' + esc(titrePeriode()) + '</h2>';
    return '<div class="agv-barre-h"><div class="v2-tabs agv-tabs" role="tablist" aria-label="Affichage de l’agenda">' + onglets + '</div>' + nav + '</div>';
  }
  function paint() {
    var box = document.getElementById('agv'); if (!box) return;
    var det = document.getElementById('agv-detail');
    var actif = document.activeElement, idFocus = actif && actif.getAttribute && actif.closest && actif.closest('#agv') ? actif.getAttribute('data-id') : null;
    if (det) det.hidden = S.vue !== 'detail';
    if (S.vue === 'detail') { box.innerHTML = barre(); return; }
    var etat = etatLecture(), note = '';
    if (etat === 'cours') note = '<p class="agv-note" role="status">Lecture des rendez-vous…</p>';
    if (etat === 'ko') note = '<div class="agv-note ko" role="alert">Les rendez-vous de cette période n’ont pas pu être lus (les tâches, elles, sont là). ' +
      '<button type="button" class="v2-btn" style="min-height:44px" onclick="V2.agendaVues.reessayer()">Réessayer</button></div>';
    var corps = S.vue === 'jour' ? vueJour() : S.vue === 'mois' ? vueMois() : vueSemaine();
    box.innerHTML = barre() + note + '<div class="agv-corps vue-' + S.vue + '">' + corps + '</div>' + legende();
    if (idFocus) { var el = box.querySelector('input[data-id="' + idFocus + '"]'); if (el) el.focus(); }
  }

  V2.agendaVues = {
    vue: function (v) {
      if (!/^(jour|semaine|mois|detail)$/.test(v)) return;
      S.vue = v; if (!S.sel) S.sel = auj(); paint();
    },
    pas: function (n) {
      if (S.vue === 'jour') { S.sel = plus(S.sel, n); S.ref = S.sel; }
      else if (S.vue === 'semaine') { S.ref = plus(S.ref, 7 * n); S.sel = S.ref; }
      else {
        var d = new Date(Date.UTC(+S.ref.slice(0, 4), moisDe(S.ref) + n, 1));
        S.ref = d.toISOString().slice(0, 10);
        S.sel = S.ref.slice(0, 7) === auj().slice(0, 7) ? auj() : S.ref;
      }
      paint();
    },
    aujourdhui: function () { S.ref = auj(); S.sel = auj(); paint(); },
    choisir: function (iso) { S.sel = iso; paint(); },
    reessayer: function () {
      moisNecessaires().forEach(function (ym) { if (CACHE[ym] && CACHE[ym].etat === 'ko') delete CACHE[ym]; });
      paint();
    },
    // Cocher ici = cocher dans la to do (même ligne, même stockage). Le rappel de V2.todo.cocher relance paint().
    cocher: function (id, fait) { if (V2.todo) V2.todo.cocher(id, !!fait); },
    etat: S,

    // Appelé par v2-rdv-planning.js une fois ses lectures faites.
    monter: function (root, top, p) {
      ensureCss();
      CTX = { reconnus: p.reconnus || [], blocages: p.blocages || [], dispo: p.dispo || {} };
      CACHE = {}; PAR_JOUR = null;       // l'écran vient d'être relu : on repart de la base
      S.ref = S.ref || auj(); S.sel = S.sel || auj();
      root.innerHTML = top + '<div class="v2-wrap v2-u agv-wrap">' +
        '<div class="v2-rdv-cap"><h1>Mon agenda</h1><p>Vos rendez-vous et vos tâches datées, jour par jour, semaine par semaine, mois par mois. ' +
        'Cochez une tâche ici : elle est cochée dans votre to do list.</p></div>' +
        p.etat + '<div id="agv"></div>' +
        '<div id="agv-detail" class="agv-detail" hidden><p class="agv-intro">' + p.texteDetail + '</p>' + p.detail + '</div>' +
        p.boutons + '</div>';
      // La to do se relit à l'ouverture : une coche faite sur un autre appareil doit se voir.
      var go = function () { paint(); };
      var ch = V2.todo && V2.todo.charger ? V2.todo.charger(true) : Promise.resolve();
      paint();
      Promise.resolve(ch).then(go, go);
    }
  };
  if (V2.todo) V2.todo.apresCoche = function () { if (document.getElementById('agv')) paint(); };
  else document.addEventListener('DOMContentLoaded', function () { if (V2.todo) V2.todo.apresCoche = function () { if (document.getElementById('agv')) paint(); }; });

  function ensureCss() {
    if (document.getElementById('v2-agv-css')) return;
    var s = document.createElement('style'); s.id = 'v2-agv-css';
    s.textContent = [
      '.agv-wrap{max-width:1180px}',
      '.agv-detail{max-width:880px}',
      '.agv-detail[hidden]{display:none}',
      '.agv-intro{margin:0 0 14px;font-size:14px;line-height:1.5;color:var(--muted)}',
      '.agv-barre-h{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:18px 0 14px}',
      '.agv-tabs{margin:0;width:fit-content}',
      '.agv-nav{display:flex;gap:6px}',
      '.agv-nav .v2-btn{min-height:44px;min-width:44px;padding:0 14px;font-size:16px}',
      '.agv-nav .agv-auj{font-size:14px}',
      '.agv-per{margin:0 0 0 auto;font-size:17px;font-weight:800;letter-spacing:-.02em;color:var(--ip-ink)}',
      '.agv-note{margin:0 0 12px;font-size:13.5px;color:var(--muted)}',
      '.agv-note.ko{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;color:var(--ip-ink);background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);padding:10px 14px}',
      /* événements */
      '.agv-ev{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;padding:7px 0;font-size:13.5px;color:var(--ip-ink)}',
      '.agv-ev + .agv-ev{border-top:1px solid var(--line-2)}',
      '.agv-ev i{flex:none;width:9px;height:9px;border-radius:50%;align-self:center}',
      '.agv-ev b{font-variant-numeric:tabular-nums;font-weight:800}',
      '.agv-ev span{font-weight:600}',
      '.agv-ev small{color:var(--muted);font-size:12.5px;flex-basis:100%;padding-left:17px}',
      '.agv-e-rdv i,i.agv-e-rdv{background:#0050E6}.agv-e-occ i,i.agv-e-occ{background:#8B93A1}.agv-e-blo i,i.agv-e-blo{background:#C7791A}',
      '.agv-ev.agv-e-occ span,.agv-ev.agv-e-blo span{color:var(--muted);font-weight:500}',
      /* tâches : case cachée sans opacity, zone de clic de 44 px */
      '.agv-t{display:flex;align-items:flex-start;gap:10px;min-height:44px;padding:9px 0;cursor:pointer;position:relative;font-size:13.5px;color:var(--ip-ink)}',
      '.agv-t input{position:absolute;width:1px;height:1px;margin:0;clip:rect(0 0 0 0);overflow:hidden}',
      '.agv-box{flex:none;width:22px;height:22px;margin-top:-1px;border-radius:7px;border:2px solid var(--line-strong);background:#fff;display:inline-flex;align-items:center;justify-content:center;transition:background .15s var(--ease),border-color .15s var(--ease)}',
      '.agv-t input:checked + .agv-box{background:var(--ip-blue);border-color:var(--ip-blue)}',
      '.agv-t input:checked + .agv-box::after{content:"";width:5px;height:10px;border:solid #fff;border-width:0 2.4px 2.4px 0;transform:translateY(-1px) rotate(45deg)}',
      '.agv-t input:focus-visible + .agv-box{box-shadow:0 0 0 3px var(--halo)}',
      '.agv-tt{min-width:0;overflow-wrap:anywhere;line-height:1.35}',
      '.agv-tt em{font-style:normal;font-weight:700;color:var(--c-amber-txt);font-size:12px;margin-left:4px}',
      '.agv-t.fait .agv-tt{color:var(--muted);text-decoration:line-through}',
      '.agv-rien{margin:6px 0 0;font-size:13px;color:var(--muted)}',
      '.agv-sep{margin:10px 0 2px;padding-top:9px;border-top:1px solid var(--line);font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}',
      /* cartes */
      '.agv-carte,.agv-col{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:13px 15px;box-shadow:var(--sh-1)}',
      '.agv-ch{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-bottom:8px}',
      '.agv-ch b{font-size:16px;font-weight:800}',
      '.agv-ch span{margin-left:auto;font-size:12.5px;color:var(--muted)}',
      '.agv-ch.seul span{margin-left:0}',
      /* entête de jour */
      '.agv-dh{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px}',
      '.agv-dj{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}',
      '.agv-dn{font-size:22px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
      '.agv-tag{background:var(--ip-blue);color:#fff;font-size:11.5px;font-weight:800;border-radius:6px;padding:2px 7px;text-transform:uppercase;letter-spacing:.04em;align-self:center}',
      '.agv-dr{flex-basis:100%;font-size:12.5px;color:var(--muted)}',
      '.agv-col.auj{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      /* retard et sans date */
      '.agv-sd{align-items:start;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:16px}',
      '.agv-sdb{background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);padding:12px 15px}',
      '.agv-sdb h3{margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}',
      '.agv-sdb h3 span{margin-left:6px;background:var(--halo);color:var(--ip-blue);border-radius:999px;padding:1px 8px;font-size:12px}',
      '.agv-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:var(--muted);margin:18px 0 0}',
      '.agv-leg span{display:flex;align-items:center;gap:6px}',
      '.agv-leg i{width:11px;height:11px;border-radius:4px;display:inline-block}',
      '.agv-lt{background:#fff;border:2px solid var(--line-strong)}',
      /* semaine : pile de jours */
      '.agv-pile{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:start}',
      '.agv-col.vide{background:var(--card-2);box-shadow:none}',
      /* mois : vraie grille, chaque case est un bouton (zone de clic = toute la case) */
      '.agv-mh{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-bottom:6px;padding:0 2px}',
      '.agv-mh span{font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}',
      '.agv-mg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}',
      '.agv-cell{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:6px 8px 8px;min-height:128px;min-width:0;display:flex;flex-direction:column;gap:2px;font:inherit;color:var(--ip-ink);text-align:left;cursor:pointer}',
      'div.agv-cell{cursor:default}',
      '.agv-cell.hors{background:var(--card-2)}',
      '.agv-cell.hors .agv-cn{color:var(--muted)}',
      '.agv-cell.auj{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.agv-cell.sel:not(.auj){border-color:var(--ip-ink)}',
      '.agv-cell:focus-visible{outline:2px solid var(--ip-blue);outline-offset:2px}',
      '.agv-cn{align-self:flex-start;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}',
      '.agv-cell.auj .agv-cn{color:var(--ip-blue)}',
      '.agv-cl{display:flex;flex-direction:column;gap:2px;min-width:0;width:100%}',
      '.agv-p,.agv-pt{display:flex;align-items:baseline;gap:5px;font-size:12px;line-height:1.3;min-width:0}',
      '.agv-p{background:var(--halo);border-radius:6px;padding:2px 6px}',
      '.agv-p b{font-variant-numeric:tabular-nums;flex:none}',
      '.agv-p span,.agv-pt span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.agv-pt{padding:0 2px}',
      '.agv-pt i{flex:none;width:10px;height:10px;border-radius:3px;border:1.6px solid var(--line-strong);background:#fff;align-self:center}',
      '.agv-pt.fait span{color:var(--muted);text-decoration:line-through}',
      '.agv-plus{font-size:12px;color:var(--muted);padding-left:2px}',
      '.agv-dots{display:none}',
      '.agv-sel{margin-top:16px}',
      /* tablette et téléphone */
      '@media (max-width:900px){',
      '  .agv-pile{grid-template-columns:1fr 1fr}',
      '}',
      '@media (max-width:640px){',
      '  .agv-wrap{padding-left:14px;padding-right:14px}',
      '  .agv-per{margin-left:0;flex-basis:100%}',
      '  .agv-pile{grid-template-columns:1fr}',
      '  .agv-nav{margin-left:auto}',
      '  .agv-cell{min-height:56px;padding:4px 2px 6px;align-items:center;gap:4px}',
      '  .agv-cl{display:none}',
      '  .agv-cn{align-self:center}',
      '  .agv-dots{display:flex;gap:4px;min-height:9px}',
      '  .agv-dots i{width:8px;height:8px;border-radius:50%;display:block}',
      '  .agv-dots i.agv-lt{border-width:1.6px;width:9px;height:9px;border-radius:3px}',
      '  .agv-mg,.agv-mh{gap:3px}',
      '  .agv-mh span{text-align:center;font-size:11px;letter-spacing:.02em}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
