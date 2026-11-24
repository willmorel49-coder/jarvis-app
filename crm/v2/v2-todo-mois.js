/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · To do list › onglet « Agenda du mois » (23/11/2026)
   Will, 23/11 : « avoir dans to do list un planning visuel sur le mois genre un vrai agenda », et pouvoir dater
   notes et rendez-vous « en antérieur ou après, quand on veut ». Version 2 « Le mois et le jour » choisie le 23/11 :
   la grille du mois à gauche, le jour choisi à droite, toujours visible (maquette ~/jarvis-preuves/agenda-todo-mois-2026-11-23).

   Données — rien de nouveau côté base, un mois à la fois, relu à chaque ouverture de l'onglet :
     · rendez-vous   = table `rdv` (les siens, confirmés), mêmes requêtes que « Mon agenda » (v2-agenda-vues.js) ;
     · agenda perso  = `rdv_occupe` (heures seules) + les titres reconnus comme une officine, lus à l'ouverture par
                       la fonction `agenda` (mes_evenements) et JAMAIS stockés (V2.planningIndex, v2-rdv-planning.js) ;
                       un « occupé » qui tombe sur un rendez-vous JARVIS est ce même rendez-vous recopié : il ne s'affiche pas ;
     · notes         = table `notes` (les siennes), datées par created_at — une note datée à la main pose created_at ;
     · tâches        = V2.todo (cocher ici = cocher dans la liste, c'est la même ligne).
   Enregistrer passe par les vraies fonctions : V2.todo.ajouterLigne, V2.rdvAjout.creer, V2.notes.addAuto.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var J3 = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // ── dates (locales, AAAA-MM-JJ) ──
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dt(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function plus(s, n) { var d = dt(s); d.setDate(d.getDate() + n); return iso(d); }
  function dow(s) { return dt(s).getDay(); }
  function num(s) { return +String(s).slice(8, 10); }
  function auj() { return iso(new Date()); }
  function maj(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function libJour(s) { return JOURS[dow(s)] + ' ' + num(s) + ' ' + MOIS[+s.slice(5, 7) - 1]; }
  function court(n) { return maj(String(n || '').replace(/^pharmacie\s+/i, '').replace(/^(du |de la |de l’|de l'|des |de )/i, '').toLowerCase().replace(/(^|[\s-])\S/g, function (m) { return m.toUpperCase(); })); }
  function joli(n) { return String(n || '').toLowerCase().replace(/(^|[\s-])\S/g, function (m) { return m.toUpperCase(); }); }
  function hm(s) { return String(s || '').slice(0, 5); }
  function min(s) { var p = hm(s).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function ecart(s) {
    var n = Math.round((dt(s) - dt(auj())) / 864e5);
    if (n === 0) return 'aujourd’hui'; if (n === -1) return 'hier'; if (n === 1) return 'demain';
    return n < 0 ? 'il y a ' + (-n) + ' jours' : 'dans ' + n + ' jours';
  }
  function cases(ref) {
    var p = ref.slice(0, 8) + '01', m = p.slice(0, 7), d = dow(p), x = plus(p, d === 0 ? -6 : 1 - d), o = [];
    do { for (var k = 0; k < 7; k++) { o.push(x); x = plus(x, 1); } } while (x.slice(0, 7) === m);
    return o;
  }
  // Une date choisie à la main garde l'heure du moment : les notes d'un même jour restent dans l'ordre où on les écrit.
  function horodatage(s) { var n = new Date(), p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], n.getHours(), n.getMinutes(), n.getSeconds()).toISOString(); }

  // ── état ──
  var S = { ref: null, sel: null, form: null, envoi: false, tout: { l: false, p: false } };
  var CACHE = {};   // 'AAAA-MM' -> { etat: 'cours' | 'ok' | 'ko', rdv: [], occ: [], notes: [] }
  var RECO = null;  // { etat, brut, alias } : événements de l'agenda perso, lus à l'ouverture, gardés en mémoire le temps de l'écran, jamais stockés
  // La reconnaissance se refait quand la liste des officines change : au premier passage juste après le chargement de
  // l'app, V2.pharmacies peut être encore vide (vu dans le Safari de Will le 23/11 : 0 officine reconnue sur 16).
  var RECO_CLE = '', RECO_LISTE = [];
  var AGENDA = null; // { etat, branche } : un agenda perso est-il branché ?
  var PAR_JOUR = null;

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function surEcran() { return !!document.querySelector('.tm'); }
  // 24/11/2026 — l'écran Rendez-vous montre ce même mois dans #tm-hote : on ne redessine que lui, sans relire l'écran
  // (V2.render relancerait toutes ses lectures à chaque jour touché). La To do, elle, se redessine en entier comme avant.
  function redessiner() {
    var h = document.getElementById('tm-hote');
    if (h) { h.innerHTML = V2.todoMois.html(); return; }
    if (surEcran() && V2.render) V2.render();
  }

  // ── lectures ──
  // `force` : relecture silencieuse d'un mois déjà affiché (ce qui est à l'écran reste jusqu'à la réponse)
  function lireMois(ym, force) {
    if (CACHE[ym] && !force) return;
    var c = sb(), u = uid(), e = CACHE[ym] || (CACHE[ym] = { etat: 'cours', rdv: [], occ: [], notes: [] });
    if (!c || !u) { e.etat = 'ko'; return; }
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7), d1 = ym + '-01', d2 = iso(new Date(y, m, 0, 12));
    Promise.all([
      c.from('rdv').select('*').eq('user_id', u).eq('statut', 'confirme').gte('date', d1).lte('date', d2).order('date').order('heure'),
      c.from('rdv_occupe').select('date,debut,fin,jour_entier').eq('user_id', u).gte('date', d1).lte('date', d2).order('date'),
      c.from('notes').select('id,scope_type,scope_id,body,created_at').eq('author_id', u)
        .gte('created_at', new Date(y, m - 1, 1).toISOString()).lt('created_at', new Date(y, m, 1).toISOString()).order('created_at')
    ]).then(function (r) {
      if (r.some(function (x) { return x && x.error; })) throw new Error('lecture');
      e.rdv = (r[0] && r[0].data) || []; e.occ = (r[1] && r[1].data) || []; e.notes = (r[2] && r[2].data) || [];
      e.etat = 'ok';
    }).catch(function () { if (e.etat !== 'ok') e.etat = 'ko'; }).then(function () { if (CACHE[ym] === e) { PAR_JOUR = null; redessiner(); } });
  }
  function lireAgenda() {
    if (RECO) return;
    RECO = { etat: 'cours', brut: [], alias: {} }; AGENDA = { etat: 'cours', branche: false };
    var releve = V2.rdvAgenda && V2.rdvAgenda.relever ? V2.rdvAgenda.relever() : Promise.resolve(null);
    releve.then(function () {
      return Promise.all([
        V2.planningAppelerAgenda ? V2.planningAppelerAgenda({ action: 'mes_evenements' }) : null,
        V2.rdvAlias && V2.rdvAlias.charger ? V2.rdvAlias.charger() : {},
        V2.rdvAgenda && V2.rdvAgenda.charger ? V2.rdvAgenda.charger() : null
      ]);
    }).then(function (r) {
      RECO.brut = (r[0] && r[0].ok && r[0].evenements) || []; RECO.alias = r[1] || {}; RECO_CLE = '';
      RECO.etat = 'ok';
      AGENDA = { etat: 'ok', branche: !!(r[2] && r[2].actif !== false), hote: (r[2] && r[2].hote) || '', ok: (r[2] && r[2].dernier_ok) || '' };
    }).catch(function () { RECO.etat = 'ko'; AGENDA = { etat: 'ko', branche: false }; }).then(function () {
      // relu APRÈS le relevé : les heures occupées du mois affiché sont celles d'il y a quelques secondes
      Object.keys(CACHE).forEach(function (ym) { lireMois(ym, true); }); PAR_JOUR = null; redessiner();
    });
  }
  function cleReco() { var D = window.PHARMA_FR; return (V2.pharmacies || []).length + '|' + (D && D.p ? D.p.length : 0) + '|' + (RECO ? RECO.brut.length : -1) + '|' + !!(window.V2RECO && V2.planningIndex); }
  function reconnus() {
    var cle = cleReco();
    if (cle === RECO_CLE) return RECO_LISTE;
    var R = window.V2RECO, idx = R && V2.planningIndex ? V2.planningIndex() : null, liste = [];
    if (idx && RECO) RECO.brut.forEach(function (ev) {
      var m = R.apparier(ev.titre, idx.porte, idx.nat, RECO.alias, idx.villes);
      if (m && m.officine) liste.push({ date: ev.date, debut: ev.debut, fin: ev.fin, jour_entier: ev.jour_entier, cip: String(m.officine.id), nom: m.officine.name, ville: m.officine.ville || '', etat: m.etat });
    });
    RECO_CLE = cle; RECO_LISTE = liste;
    return liste;
  }
  function etatMois() { var ym = S.ref.slice(0, 7); lireMois(ym); return CACHE[ym].etat; }

  // ── le contenu d'un jour ──
  function nomOfficine(st, sid) {
    if (st !== 'client') return String(sid || '');
    var p = (V2.pharmacies || []).find(function (x) { return String(x.id) === String(sid); });
    if (p) return p.name || '';
    var i = V2.rdvInfo ? V2.rdvInfo(sid) : null;
    return (i && i.nom) || 'Officine ' + sid;
  }
  function construire() {
    var idx = {}, D = 45;
    function pose(d, e) { (idx[d] = idx[d] || { ev: [], notes: [] }).ev.push(e); }
    var reco = {}, cle = function (x) { return x.date + '|' + (x.jour_entier ? 'J' : hm(x.debut)); };
    var RL = reconnus();
    RL.forEach(function (x) { reco[cle(x)] = 1; });
    Object.keys(CACHE).forEach(function (ym) {
      var M = CACHE[ym];
      M.rdv.forEach(function (r) { pose(r.date, { type: 'rdv', jarvis: true, h: hm(r.heure), deb: min(r.heure), dur: r.duree_min || D, nom: r.nom || 'Rendez-vous', ville: r.ville || '', attente: !!r._attente }); });
      M.occ.forEach(function (o) {
        if (reco[cle(o)]) return;   // l'officine reconnue la remplace, avec son nom
        var deb = o.jour_entier ? 8 * 60 : min(o.debut), fin = o.jour_entier ? 19 * 60 : min(o.fin);
        pose(o.date, { type: 'occ', entier: !!o.jour_entier, h: o.jour_entier ? '' : hm(o.debut), deb: deb, dur: fin - deb });
      });
      M.notes.forEach(function (n) {
        var d = iso(new Date(n.created_at));
        (idx[d] = idx[d] || { ev: [], notes: [] }).notes.push({ nom: nomOfficine(n.scope_type, n.scope_id), body: n.body || '' });
      });
    });
    RL.forEach(function (x) {
      if (!CACHE[x.date.slice(0, 7)]) return;
      var deb = x.jour_entier ? 8 * 60 : min(x.debut), fin = x.jour_entier ? 19 * 60 : min(x.fin);
      pose(x.date, { type: 'rdv', reco: true, entier: !!x.jour_entier, h: x.jour_entier ? '' : hm(x.debut), deb: deb, dur: fin - deb, nom: x.nom, ville: x.ville, confirmer: x.etat === 'confirmer' });
    });
    // notes écrites sans réseau, pas encore parties (V2.hl, v2-hors-ligne.js)
    if (V2.hl && V2.hl.miennes) V2.hl.miennes('notes').forEach(function (x) {
      var l = x.ligne || {}, d = l.created_at ? iso(new Date(l.created_at)) : '';
      if (d && CACHE[d.slice(0, 7)]) (idx[d] = idx[d] || { ev: [], notes: [] }).notes.push({ nom: nomOfficine(l.scope_type, l.scope_id), body: l.body || '', attente: true });
    });
    // Ce qui vient de l'agenda perso et tombe sur un rendez-vous JARVIS est ce même rendez-vous recopié (règle de v2-agenda-vues.js)
    Object.keys(idx).forEach(function (k) {
      var rv = idx[k].ev.filter(function (e) { return e.jarvis; });
      if (rv.length) idx[k].ev = idx[k].ev.filter(function (e) {
        if (e.jarvis || e.entier) return true;
        return !rv.some(function (r) { return (e.deb >= r.deb - 15 && e.deb <= r.deb + r.dur) || (e.deb < r.deb + r.dur && e.deb + e.dur > r.deb); });
      });
      idx[k].ev.sort(function (a, b) { return a.deb - b.deb; });
    });
    return idx;
  }
  function taches() { return (V2.todo && V2.todo.tous) ? V2.todo.tous() : []; }
  function nomT(t) { return V2.todo && V2.todo.libelle ? V2.todo.libelle(t) : (t.nom || t.note || 'À faire'); }
  function tachesDe(s) {
    var a = taches().filter(function (t) { return t.pour === s; });
    if (V2.todo && V2.todo.tombeLe) taches().forEach(function (t) { if (t.pour !== s && !t.fait && V2.todo.tombeLe(t, s)) a.push(Object.assign({}, t, { _prevu: true })); });
    return a;
  }
  function jour(s) {
    if (PAR_JOUR && cleReco() !== RECO_CLE) PAR_JOUR = null;   // les officines sont arrivées depuis : on reconnaît à nouveau
    if (!PAR_JOUR) PAR_JOUR = construire();
    var j = PAR_JOUR[s] || { ev: [], notes: [] };
    return { ev: j.ev, rdv: j.ev.filter(function (e) { return e.type === 'rdv'; }), taches: tachesDe(s), notes: j.notes };
  }
  function enRetard() { var a = auj(); return taches().filter(function (t) { return !t.fait && t.pour && t.pour < a; }); }
  function sansDate() { return taches().filter(function (t) { return !t.fait && !t.pour; }); }

  // ── pièces ──
  var IC = {
    note: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 2h6l3 3v9h-9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 8h4.5M6 10.8h4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    tache: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    fait: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3" fill="currentColor"/><path d="M5 8.2l2 2 4-4.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    prec: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    suiv: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function heure(e) { return e.entier ? 'Journée' : e.h.replace(':', 'h'); }
  function puces(s) {
    var j = jour(s), a = auj(), o = [];
    j.ev.forEach(function (e) {
      if (e.type === 'occ') o.push('<span class="tm-p tm-p-occ"><b>' + esc(heure(e)) + '</b><span>Occupé</span></span>');
      else o.push('<span class="tm-p tm-p-rdv' + (s < a ? ' passe' : '') + '"><b>' + esc(heure(e)) + '</b><span>' + esc(court(e.nom)) + '</span></span>');
    });
    j.taches.forEach(function (t) { o.push('<span class="tm-p tm-p-t' + (t.fait ? ' fait' : '') + (!t.fait && s < a ? ' retard' : '') + (t._prevu ? ' prevu' : '') + '">' + (t.fait ? IC.fait : IC.tache) + '<span>' + esc(nomT(t)) + '</span></span>'); });
    j.notes.forEach(function (n) { o.push('<span class="tm-p tm-p-note">' + IC.note + '<span>' + esc(court(n.nom)) + '</span></span>'); });
    return o;
  }
  function compte(s) { var j = jour(s); return { r: j.rdv.length, o: j.ev.length - j.rdv.length, t: j.taches.filter(function (t) { return !t.fait; }).length, n: j.notes.length }; }
  function resume(s) {
    var c = compte(s), p = [];
    if (c.r) p.push(c.r + ' rendez-vous'); if (c.o) p.push(c.o + (c.o > 1 ? ' créneaux occupés' : ' créneau occupé'));
    if (c.t) p.push(c.t + (c.t > 1 ? ' tâches' : ' tâche')); if (c.n) p.push(c.n + (c.n > 1 ? ' notes' : ' note'));
    return p.join(' · ') || 'rien de prévu';
  }
  function points(s) { var c = compte(s); return '<span class="tm-dots" aria-hidden="true">' + (c.r ? '<i class="d-rdv"></i>' : '') + (c.o ? '<i class="d-occ"></i>' : '') + (c.t ? '<i class="d-t"></i>' : '') + (c.n ? '<i class="d-note"></i>' : '') + '</span>'; }

  // ── le jour choisi : agenda, tâches, notes, et les trois ajouts datés ──
  function detail(s) {
    var j = jour(s), a = auj(), passe = s < a, html = '';
    html += '<div class="tm-dh"><div><p class="tm-dk">' + esc(maj(ecart(s))) + '</p><h2 class="tm-dt">' + esc(maj(libJour(s))) + '</h2></div></div>';
    html += '<div class="tm-ajouts" role="group" aria-label="Ajouter à cette date">' +
      [['tache', 'Tâche'], ['rdv', 'Rendez-vous'], ['note', 'Note']].map(function (x) {
        var on = S.form && S.form.type === x[0];
        return '<button type="button" class="tm-aj' + (on ? ' on' : '') + '" aria-pressed="' + !!on + '" onclick="V2.todoMois.ouvrir(\'' + x[0] + '\',\'' + s + '\')">' + IC.plus + '<span>' + x[1] + '</span></button>';
      }).join('') + '</div>';
    if (S.form) html += formulaire();
    if (!j.ev.length && !j.taches.length && !j.notes.length) html += '<p class="tm-rien">' + (passe ? 'Rien de noté ce jour-là.' : 'Rien de prévu pour l’instant.') + '</p>';
    if (j.ev.length) html += '<h3 class="tm-sh">Agenda</h3>' + j.ev.map(function (e) {
      if (e.type === 'occ') return '<div class="tm-l tm-l-occ"><span class="tm-h">' + esc(heure(e)) + '</span><span class="tm-lt"><b>' + (e.entier ? 'Occupé toute la journée' : 'Occupé') + '</b><small>agenda personnel' + (e.entier ? '' : ' · ' + e.dur + ' min') + '</small></span></div>';
      var sub = [joli(e.ville), e.entier ? '' : e.dur + ' min', e.reco ? 'agenda personnel' : '', e.confirmer ? 'à confirmer' : '', e.attente ? 'en attente d’envoi' : '', passe ? 'passé' : ''].filter(Boolean).join(' · ');
      return '<div class="tm-l tm-l-rdv' + (passe ? ' passe' : '') + '"><span class="tm-h">' + esc(heure(e)) + '</span><span class="tm-lt"><b>' + esc(joli(e.nom)) + '</b><small>' + esc(sub) + '</small></span></div>';
    }).join('');
    if (j.taches.length) html += '<h3 class="tm-sh">Tâches</h3>' + j.taches.map(function (t) {
      if (t._prevu) return '<div class="tm-l tm-l-t prevu"><span class="tm-box" aria-hidden="true"></span><span class="tm-lt"><b>' + esc(nomT(t)) + '</b><small>revient ' + esc(String(V2.todo.repLabel ? V2.todo.repLabel(t) : '').toLowerCase()) + '</small></span></div>';
      return '<label class="tm-l tm-l-t' + (t.fait ? ' fait' : '') + '"><input type="checkbox"' + (t.fait ? ' checked' : '') + ' onchange="V2.todoMois.cocher(\'' + esc(t.id) + '\',this.checked)" aria-label="' + (t.fait ? 'Remettre à faire' : 'Marquer comme fait') + ' : ' + esc(nomT(t)) + '"><span class="tm-box"></span>' +
        '<span class="tm-lt"><b>' + esc(nomT(t)) + '</b>' + (!t.fait && passe ? '<small class="tm-ret">en retard</small>' : '') + '</span></label>';
    }).join('');
    if (j.notes.length) html += '<h3 class="tm-sh">Notes</h3>' + j.notes.map(function (n) {
      return '<div class="tm-l tm-l-note"><span class="tm-ni">' + IC.note + '</span><span class="tm-lt"><b>' + esc(joli(n.nom)) + '</b><span class="tm-nb">' + esc(n.body) + '</span>' + (n.attente ? '<small>en attente d’envoi</small>' : '') + '</span></div>';
    }).join('');
    return html;
  }
  function formulaire() {
    var f = S.form, noms = (V2.pharmacies || []).map(function (p) { return '<option value="' + esc(p.name || '') + '">'; }).join('');
    var titre = f.type === 'rdv' ? 'Noter un rendez-vous' : f.type === 'note' ? 'Écrire une note' : 'Ajouter une tâche';
    var aide = f.type === 'rdv' ? 'Date passée ou à venir : un rendez-vous déjà fait se note aussi.' : f.type === 'note' ? 'La note est datée du jour choisi, avant ou après aujourd’hui.' : 'La tâche se range à cette date dans la To do list.';
    return '<div class="tm-form" role="group" aria-label="' + titre + '"><p class="tm-ft">' + titre + '</p><p class="tm-fa">' + aide + '</p>' +
      '<div class="tm-fg">' +
      '<label class="tm-f"><span>Officine' + (f.type === 'tache' ? ' (facultatif)' : '') + '</span><input id="tm-off" type="text" list="tm-noms" autocomplete="off" placeholder="Nom de l’officine"><datalist id="tm-noms">' + noms + '</datalist></label>' +
      '<label class="tm-f"><span>Date</span><input id="tm-date" type="date" value="' + esc(f.date) + '"></label>' +
      (f.type === 'rdv' ? '<label class="tm-f"><span>Heure</span><input id="tm-heure" type="time" value="09:30" step="900"></label>' : '') +
      '<label class="tm-f tm-f-l"><span>' + (f.type === 'note' ? 'Note' : f.type === 'rdv' ? 'Précision (facultatif)' : 'Ce qu’il y a à faire') + '</span>' +
      (f.type === 'note' ? '<textarea id="tm-txt" rows="3" placeholder="Ce qui s’est dit, ce qu’il faut retenir…"></textarea>' : '<input id="tm-txt" type="text" autocomplete="off">') + '</label>' +
      '</div><div class="tm-fb"><button type="button" class="tm-btn tm-prim" id="tm-go" onclick="V2.todoMois.enregistrer()"' + (S.envoi ? ' disabled' : '') + '>' + (S.envoi ? 'Enregistrement…' : 'Enregistrer') + '</button><button type="button" class="tm-btn" onclick="V2.todoMois.ouvrir(null)">Annuler</button></div></div>';
  }
  function libres() {
    var r = enRetard(), s = sansDate();
    if (!r.length && !s.length) return '';
    function l(t) { return '<label class="tm-l tm-l-t"><input type="checkbox" onchange="V2.todoMois.cocher(\'' + esc(t.id) + '\',this.checked)" aria-label="Marquer comme fait : ' + esc(nomT(t)) + '"><span class="tm-box"></span><span class="tm-lt"><b>' + esc(nomT(t)) + '</b>' + (t.pour ? '<small>prévue ' + esc(J3[dow(t.pour)] + ' ' + num(t.pour) + ' ' + MOIS[+t.pour.slice(5, 7) - 1]) + '</small>' : '') + '</span></label>'; }
    return '<div class="tm-libres">' + (r.length ? '<section class="tm-lb"><h3 class="tm-sh">En retard <b>' + r.length + '</b></h3>' + r.map(l).join('') + '</section>' : '') +
      (s.length ? '<section class="tm-lb"><h3 class="tm-sh">Sans date <b>' + s.length + '</b></h3>' + s.map(l).join('') + '</section>' : '') + '</div>';
  }
  function barre() {
    var m = S.ref.slice(0, 7), titre = maj(MOIS[+m.slice(5, 7) - 1]) + ' ' + m.slice(0, 4);
    return '<div class="tm-barre"><h2 class="tm-mois">' + esc(titre) + '</h2><div class="tm-nav">' +
      '<button type="button" class="tm-btn tm-ic" onclick="V2.todoMois.pas(-1)" aria-label="Mois précédent">' + IC.prec + '</button>' +
      '<button type="button" class="tm-btn" onclick="V2.todoMois.aujourdhui()">Aujourd’hui</button>' +
      '<button type="button" class="tm-btn tm-ic" onclick="V2.todoMois.pas(1)" aria-label="Mois suivant">' + IC.suiv + '</button></div></div>';
  }
  // Ce que l'écran sait de sa lecture : il le dit, plutôt qu'une grille vide qui ferait croire à un mois vide.
  function etatLu(e) {
    if (e === 'cours') return '<p class="tm-etat" role="status">Lecture de vos rendez-vous et de vos notes…</p>';
    if (e === 'ko') return '<p class="tm-etat" role="alert">Vos rendez-vous et vos notes de ce mois n’ont pas pu être lus : seules les tâches s’affichent. <button type="button" class="tm-btn" onclick="V2.todoMois.reessayer()">Réessayer</button></p>';
    if (RECO && RECO.etat === 'cours') return '<p class="tm-etat" role="status">Lecture de votre agenda personnel…</p>';
    if (AGENDA && AGENDA.etat === 'ok') return agendaLigne();
    return '';
  }
  // 24/11/2026 — Will : les commerciaux se connectent « avec leur agenda qu'il souhaite ». Le choix se fait ici, d'un
  // toucher, au lieu de l'outil deviné d'après l'adresse du compte (toute l'équipe est en @integralpharma.fr, donc Outlook).
  var OUTILS = [['google', 'Google Agenda'], ['outlook', 'Outlook'], ['apple', 'iPhone / iCloud']];
  function relu(s) {
    var m = Math.floor((Date.now() - new Date(s).getTime()) / 6e4);
    return m < 2 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : m < 1440 ? 'il y a ' + Math.floor(m / 60) + ' h' : 'il y a ' + Math.floor(m / 1440) + ' j';
  }
  function agendaLigne() {
    if (!AGENDA.branche) return '<div class="tm-etat tm-ag" role="group" aria-label="Brancher mon agenda"><span class="tm-agt"><b>Branchez votre agenda</b> : vos rendez-vous s’afficheront ici et vos heures prises ne seront plus proposées aux pharmaciens. Mon agenda est sur :</span><span class="tm-agb">' +
      OUTILS.map(function (o) { return '<button type="button" class="tm-btn" onclick="V2.rdvAgenda.choisir(\'' + o[0] + '\')">' + o[1] + '</button>'; }).join('') + '</span></div>';
    var h = String(AGENDA.hote || ''), nom = /google/.test(h) ? 'Google Agenda' : /outlook|office/.test(h) ? 'Outlook' : /icloud/.test(h) ? 'Agenda iPhone / iCloud' : 'Votre agenda';
    return '<p class="tm-etat tm-ag-on"><i class="tm-agp" aria-hidden="true"></i><span>' + esc(nom) + ' branché' + (AGENDA.ok ? ' · relu ' + esc(relu(AGENDA.ok)) : '') + '</span>' +
      '<button type="button" class="tm-btn" onclick="V2.rdvAgenda.choisir(\'\')">Changer d’agenda</button></p>';
  }
  function legende() {
    return '<p class="tm-leg"><span><i class="d-rdv"></i>rendez-vous</span><span><i class="d-rdv passe"></i>rendez-vous passé</span><span><i class="d-occ"></i>occupé (agenda personnel)</span><span><i class="d-t"></i>tâche</span><span><i class="d-note"></i>note</span></p>';
  }
  function entetes() { return '<div class="tm-mh" aria-hidden="true">' + ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(function (j) { return '<span>' + j + '</span>'; }).join('') + '</div>'; }
  function cellule(s) {
    var m = S.ref.slice(0, 7), a = auj();
    if (s.slice(0, 7) !== m) return '<div class="tm-c hors" aria-hidden="true"><span class="tm-cn">' + num(s) + '</span></div>';
    var l = puces(s), v = l.slice(0, 2), r = l.length - v.length, we = dow(s) === 0 || dow(s) === 6;
    return '<div class="tm-c' + (s === a ? ' auj' : '') + (s === S.sel ? ' sel' : '') + (s < a ? ' passe' : '') + (we ? ' we' : '') + '">' +
      '<button type="button" class="tm-cb" onclick="V2.todoMois.choisir(\'' + s + '\')" aria-label="' + esc(maj(libJour(s)) + (s === a ? ', aujourd’hui' : '') + ' : ' + resume(s)) + '"' + (s === S.sel ? ' aria-pressed="true"' : '') + '></button>' +
      '<span class="tm-cn">' + num(s) + '</span>' +
      '<span class="tm-cl">' + v.join('') + (r > 0 ? '<span class="tm-plus">+ ' + r + (r > 1 ? ' autres' : ' autre') + '</span>' : '') + '</span>' + points(s) + '</div>';
  }
  // ── « Vos clients » (24/11/2026) — Will : « proposer des pharmacies à qui proposer des rdv qui ne sont pas placées
  //    dans le futur et lister toutes celles qui sont positionnées et quand, genre un visu sur nos clients ».
  //    Positionnée = un rendez-vous JARVIS confirmé à venir, ou un événement à venir de l'agenda perso reconnu comme elle.
  var VENIR = null;   // { etat, rdv } : ses rendez-vous confirmés à partir d'aujourd'hui, tous mois confondus
  var OPPOSES = null; // cip -> 1 : celles qui ont demandé à ne plus être sollicitées (liste commune à l'équipe)
  var VU_LU = false;
  function lireVenir() {
    if (VENIR) return;
    var e = VENIR = { etat: 'cours', rdv: [] }, c = sb(), u = uid();
    if (!c || !u) { e.etat = 'ko'; return; }
    Promise.all([
      c.from('rdv').select('cip,nom,date,heure').eq('user_id', u).eq('statut', 'confirme').gte('date', auj()).order('date').order('heure'),
      c.rpc ? c.rpc('rdv_opposes').then(function (o) { return o; }, function () { return null; }) : null
    ]).then(function (r) {
      if (r[0] && r[0].error) throw new Error('lecture');
      e.rdv = (r[0] && r[0].data) || []; e.etat = 'ok';
      var o = {}; ((r[1] && r[1].data) || []).forEach(function (x) { o[String(x && x.cip != null ? x.cip : x)] = 1; }); OPPOSES = o;
    }).catch(function () { e.etat = 'ko'; }).then(function () { if (VENIR === e) redessiner(); });
    // « vue il y a 7 mois » : visites notées et rendez-vous passés, lus une fois (v2-rdv.js)
    if (V2.rdvVuCharger && !VU_LU) { VU_LU = true; var pv = V2.rdvVuCharger(); if (pv && pv.then) pv.then(function () { redessiner(); }, function () {}); }
  }
  // Ses officines à LUI : le fichier porte celles de toute l'équipe (même filtre que « Qui inviter », v2-rdv-planning.js).
  function portefeuille() {
    var moi = (V2.user && V2.user.commercial) ? String(V2.user.commercial) : '', l = V2.pharmacies || [];
    return moi ? l.filter(function (p) { return (p.comms || []).indexOf(moi) >= 0; }) : l;
  }
  function ilYa(s) {
    var n = Math.round((dt(auj()) - dt(s)) / 864e5);
    if (n <= 0) return 'vue aujourd’hui'; if (n === 1) return 'vue hier'; if (n < 31) return 'vue il y a ' + n + ' jours';
    var m = Math.round(n / 30.4); return m < 12 ? 'vue il y a ' + m + ' mois' : 'vue il y a plus d’un an';
  }
  function clientsHtml() {
    var liste = portefeuille();
    if (!liste.length) return '';
    lireVenir();
    var a = auj(), prochain = {}, vu = {}, lu = VENIR.etat;
    var poses = [], libres = [], stop = 0, a_lui = {}, horsRdv = {}, horsOff = {};
    liste.forEach(function (p) { a_lui[String(p.id)] = 1; });
    function poser(cip, date, h, src, conf) {
      var k = String(cip || ''), x = prochain[k];
      if (!k) return;
      // chez une officine qui n'est pas à lui (prospect, client d'un collègue) : dit, pas listé. On compte des
      // RENDEZ-VOUS (même officine, même jour = le rendez-vous JARVIS recopié dans l'agenda, compté une fois).
      if (!a_lui[k]) { horsRdv[k + '|' + date] = 1; horsOff[k] = 1; }
      if (!x || date + h < x.date + x.h) prochain[k] = { date: date, h: h, src: src, conf: !!conf };
    }
    if (lu === 'ok') VENIR.rdv.forEach(function (r) { poser(r.cip, r.date, hm(r.heure), 'jarvis'); });
    reconnus().forEach(function (x) {
      // « à confirmer » n'est qu'une ressemblance (24/11/2026 : « Phie cœur de bourg » tombait sur la PHARMACIE DE BOURG
      // d'un collègue) : gardée pour SES clients, avec la mention, jamais comptée chez ceux des autres.
      var conf = x.etat !== 'reconnu';
      if (conf && !a_lui[x.cip]) return;
      if (x.date >= a) poser(x.cip, x.date, x.jour_entier ? '' : hm(x.debut), 'agenda', conf);
      else if (!vu[x.cip] || x.date > vu[x.cip]) vu[x.cip] = x.date;
    });
    var hors = Object.keys(horsRdv).length, horsO = Object.keys(horsOff).length;
    liste.forEach(function (p) {
      var k = String(p.id), n = prochain[k];
      if (n) { poses.push({ p: p, n: n }); return; }
      if (OPPOSES && OPPOSES[k]) { stop++; return; }
      var v = V2.rdvVuLe ? V2.rdvVuLe(k) : null;
      if (vu[k] && (!v || vu[k] > v)) v = vu[k];
      libres.push({ p: p, vu: v || '' });
    });
    poses.sort(function (x, y) { return x.n.date + x.n.h < y.n.date + y.n.h ? -1 : 1; });
    // jamais vue d'abord, puis la plus ancienne visite : c'est elle qu'on propose en premier
    libres.sort(function (x, y) { return x.vu === y.vu ? String(x.p.name || '').localeCompare(String(y.p.name || '')) : (x.vu < y.vu ? -1 : 1); });
    var tot = liste.length, np = poses.length;
    var h = '<section class="tm-carte tm-clients" aria-label="Vos clients"><h2 class="tm-cht">Vos clients</h2>';
    if (lu === 'cours') return h + '<p class="tm-chp" role="status">Lecture de vos rendez-vous à venir…</p></section>';
    // une lecture ratée ne fait pas croire que tous les clients sont sans rendez-vous
    if (lu === 'ko') return h + '<p class="tm-etat" role="alert">Vos rendez-vous à venir n’ont pas pu être lus. <button type="button" class="tm-btn" onclick="V2.todoMois.reessayer()">Réessayer</button></p></section>';
    h += '<p class="tm-chp"><b>' + np + '</b> sur ' + tot + ' ont un rendez-vous à venir · <b>' + libres.length + '</b> sans rendez-vous' +
      (stop ? ' · <b>' + stop + '</b> ne ' + (stop > 1 ? 'veulent' : 'veut') + ' plus être sollicitée' + (stop > 1 ? 's' : '') : '') + '</p>' +
      '<div class="tm-jauge" aria-hidden="true"><i style="width:' + Math.round(np * 100 / tot) + '%"></i></div>';
    var ho = String((AGENDA && AGENDA.hote) || '');
    if (AGENDA && AGENDA.etat === 'ok' && !AGENDA.branche) h += '<p class="tm-cnote">Tant que votre agenda n’est pas branché, seuls les rendez-vous notés dans JARVIS comptent.</p>';
    else if (/outlook|office/.test(ho)) h += '<p class="tm-cnote">Outlook ne partage que vos heures occupées, sans les noms : seuls les rendez-vous notés dans JARVIS comptent.</p>';
    function ligneL(x) {
      var p = x.p, k = String(p.id), o = V2.rdvInfo ? V2.rdvInfo(k) : {}, mail = String(o.email || '').trim(), tel = String(o.tel || '').replace(/[^0-9+]/g, '');
      var act = mail && V2.rdv ? '<button type="button" class="tm-btn tm-prim tm-ca" onclick="V2.rdv.proposer(\'' + esc(k) + '\')">Proposer un RDV</button>'
        : tel ? '<a class="tm-btn tm-ca" href="tel:' + esc(tel) + '">Appeler</a>' : '<span class="tm-cs">ni mail ni téléphone</span>';
      return '<div class="tm-cli"><button type="button" class="tm-cn2" onclick="V2.go(\'pharma\',\'' + esc(k) + '\')"><b>' + esc(court(p.name)) + '</b><small>' +
        esc([joli(p.ville || ''), x.vu ? ilYa(x.vu) : 'aucune visite notée'].filter(Boolean).join(' · ')) + '</small></button>' + act + '</div>';
    }
    function ligneP(x) {
      var p = x.p, n = x.n, quand = maj(J3[dow(n.date)]) + '. ' + num(n.date) + ' ' + MOIS[+n.date.slice(5, 7) - 1] + (n.h ? ' · ' + n.h.replace(':', 'h') : '');
      return '<div class="tm-cli"><button type="button" class="tm-cn2" onclick="V2.todoMois.allerA(\'' + n.date + '\')" aria-label="' + esc(joli(p.name) + ', ' + quand + ' : voir ce jour dans le mois') + '"><b>' + esc(court(p.name)) + '</b><small>' +
        esc([joli(p.ville || ''), ecart(n.date), n.src === 'agenda' ? 'agenda personnel' : '', n.conf ? 'à confirmer' : ''].filter(Boolean).join(' · ')) + '</small></button><span class="tm-cq">' + esc(quand) + '</span></div>';
    }
    function col(k, titre, arr, f, vide) {
      var M = 8, tout = S.tout[k], vis = tout ? arr : arr.slice(0, M);
      return '<section class="tm-ccol"><h3 class="tm-sh">' + titre + ' <b>' + arr.length + '</b></h3>' + (arr.length ? vis.map(f).join('') : '<p class="tm-rien">' + vide + '</p>') +
        (arr.length > M ? '<button type="button" class="tm-btn tm-cplus" onclick="V2.todoMois.voirTout(\'' + k + '\')">' + (tout ? 'Réduire la liste' : 'Voir les ' + arr.length) + '</button>' : '') + '</section>';
    }
    return h + '<div class="tm-ccols">' +
      col('l', 'Sans rendez-vous à venir', libres, ligneL, 'Toutes ont un rendez-vous à venir.') +
      col('p', 'Rendez-vous posé', poses, ligneP, 'Aucun rendez-vous à venir pour l’instant.') + '</div>' +
      (hors ? '<p class="tm-cnote">Vous avez aussi ' + hors + ' rendez-vous à venir chez ' + (horsO > 1 ? horsO + ' officines qui ne sont pas' : 'une officine qui n’est pas') + ' dans vos clients (prospect ou client d’un collègue) : ' + (hors > 1 ? 'ils ne sont pas' : 'il n’est pas') + ' dans ces listes.</p>' : '') +
      '</section>';
  }
  function page() {
    var e = etatMois();
    return barre() + etatLu(e) + '<div class="tm-cote"><div class="tm-gauche"><div class="tm-mois-g">' + entetes() + '<div class="tm-g">' + cases(S.ref).map(cellule).join('') + '</div></div>' + legende() + libres() + '</div>' +
      '<section class="tm-carte tm-jour" aria-live="polite">' + detail(S.sel) + '</section></div>' + clientsHtml();
  }

  // ── la phrase sous le titre, faite des nombres affichés ──
  function phrase() {
    init();
    var m = S.ref.slice(0, 7), mois = maj(MOIS[+m.slice(5, 7) - 1]);
    if (etatMois() === 'cours') return mois + ' : lecture en cours…';
    var r = 0, n = 0;
    cases(S.ref).forEach(function (s) { if (s.slice(0, 7) === m) { var j = jour(s); r += j.rdv.length; n += j.notes.length; } });
    var t = taches().filter(function (x) { return !x.fait && x.pour && x.pour.slice(0, 7) === m; }).length, p = [];
    function b(x) { return '<b class="td-num">' + x + '</b>'; }
    if (r) p.push(b(r) + ' rendez-vous'); if (t) p.push(b(t) + (t > 1 ? ' tâches' : ' tâche')); if (n) p.push(b(n) + (n > 1 ? ' notes' : ' note'));
    if (!p.length) return mois + ' est encore vide.';
    return mois + ' : ' + (p.length > 1 ? p.slice(0, -1).join(', ') + ' et ' + p[p.length - 1] : p[0]) + '.';
  }
  function init() { if (!S.ref) { S.ref = auj(); S.sel = auj(); } lireAgenda(); }
  function relire(date) { var ym = date.slice(0, 7); if (CACHE[ym]) lireMois(ym, true); }

  V2.todoMois = {
    phrase: phrase,
    html: function () { init(); ensureCss(); return '<div class="tm tm-v2">' + page() + '</div>'; },
    // l'onglet s'ouvre : tout est relu (un rendez-vous pris ailleurs depuis doit apparaître)
    rafraichir: function () { CACHE = {}; RECO = null; PAR_JOUR = null; VENIR = null; OPPOSES = null; },
    // « Vos clients » › Rendez-vous posé : le jour s'ouvre dans le mois
    allerA: function (s) {
      S.ref = s; S.sel = s; S.form = null; redessiner();
      var b = document.querySelector('.tm .tm-barre'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    voirTout: function (k) { S.tout[k] = !S.tout[k]; redessiner(); },
    reessayer: function () { CACHE = {}; PAR_JOUR = null; VENIR = null; redessiner(); },
    choisir: function (s) { S.sel = s; if (S.form) S.form.date = s; redessiner(); },
    pas: function (n) {
      var d = dt(S.ref); d.setDate(1); d.setMonth(d.getMonth() + n); S.ref = iso(d);
      S.sel = S.ref.slice(0, 7) === auj().slice(0, 7) ? auj() : S.ref; S.form = null; redessiner();
    },
    aujourdhui: function () { S.ref = auj(); S.sel = auj(); S.form = null; redessiner(); },
    ouvrir: function (type, s) { S.form = type ? { type: type, date: s || S.sel } : null; redessiner(); var e = document.getElementById('tm-off'); if (e) try { e.focus(); } catch (x) {} },
    cocher: function (id, f) { if (V2.todo) V2.todo.cocher(id, !!f); },
    enregistrer: function () {
      var f = S.form; if (!f || S.envoi) return;
      var g = function (id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
      var nom = g('tm-off'), date = g('tm-date'), txt = g('tm-txt'), h = g('tm-heure') || '09:30';
      var dire = function (m) { if (V2.toast) V2.toast(m, 'error'); };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { dire('Indiquez la date.'); return; }
      if (f.type !== 'tache' && !nom) { dire('Choisissez l’officine.'); return; }
      if (f.type === 'note' && !txt) { dire('Écrivez la note.'); return; }
      if (f.type === 'tache' && !txt && !nom) { dire('Écrivez ce qu’il y a à faire.'); return; }
      var p = nom ? (V2.pharmacies || []).find(function (x) { return String(x.name || '').trim().toLowerCase() === nom.toLowerCase(); }) : null;
      if (f.type === 'note' && !p) { dire('Choisissez l’officine dans la liste : la note se range sur sa fiche.'); return; }
      // ce qui a été tapé reste tapé pendant l'envoi : le formulaire est redessiné avec ses valeurs
      var garde = { nom: nom, date: date, txt: txt, h: h };
      var fini = function (mot) { S.envoi = false; S.form = null; S.sel = date; S.ref = date; relire(date); if (V2.toast) V2.toast(mot + ' au ' + libJour(date) + ' (' + ecart(date) + ')'); redessiner(); };
      var rate = function (m) { S.envoi = false; redessiner(); remettre(garde); dire(m); };
      S.envoi = true; redessiner(); remettre(garde);
      if (f.type === 'rdv') {
        var o = p && V2.rdvInfo ? V2.rdvInfo(p.id) : { cip: '', nom: nom, adresse: '', cp: '', ville: '', tel: '', contact: '', lat: null, lon: null, aLaMain: true };
        if (!o.nom) o.nom = nom;
        V2.rdvAjout.creer(o, { date: date, heure: h, note: txt }).then(function (r) {
          if (!r.ok) { rate(r.message || 'Enregistrement impossible.'); return; }
          fini(r.attente ? 'Rendez-vous gardé sur l’appareil, il partira au retour du réseau,' : 'Rendez-vous noté');
        }, function () { rate('Enregistrement impossible.'); });
        return;
      }
      if (f.type === 'note') {
        var quand = date === auj() ? null : horodatage(date);
        V2.notes.addAuto('client', String(p.id), txt, quand).then(function (ok) { if (ok) fini('Note datée'); else rate('Note non enregistrée, réessayez.'); }, function () { rate('Note non enregistrée, réessayez.'); });
        return;
      }
      V2.todo.ajouterLigne({ k: 'libre', nom: p ? p.name : nom, pid: p ? p.id : '', note: txt, pour: date }).then(function (ok) {
        if (ok) fini('Tâche ajoutée'); else rate('Tâche non enregistrée, réessayez.');
      }, function () { rate('Tâche non enregistrée, réessayez.'); });
    },
    etat: S
  };
  function remettre(g) {
    var m = { 'tm-off': g.nom, 'tm-date': g.date, 'tm-txt': g.txt, 'tm-heure': g.h };
    Object.keys(m).forEach(function (id) { var e = document.getElementById(id); if (e) e.value = m[id]; });
  }

  function ensureCss() {
    if (document.getElementById('tm-css')) return;
    var s = document.createElement('style'); s.id = 'tm-css';
    s.textContent = [
      /* couleurs de la To do (bleu seul accent), aucun ton chaud, texte ≥ 12 px, cibles ≥ 44 px */
      '.tm{--tm-b:var(--td-bleu,#0050E6);--tm-n:var(--td-nuit,#0034A0);--tm-i:var(--ip-ink,#0B1B3F);--tm-g:#3B4357;--tm-f:#D7E0F0;--tm-halo:#E5EDFF;--tm-note:#E9EDF3;--tm-occ:#EEF1F6;margin:4px 0 0}',
      '.tm-barre{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:0 0 14px}',
      '.tm-mois{margin:0;font:800 24px/1.1 var(--font);letter-spacing:-.025em;color:var(--tm-i);min-width:7.5em}',
      '.tm-nav{display:flex;gap:6px}',
      '.tm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--tm-f);background:#fff;color:var(--tm-i);font:700 14px/1 var(--font);cursor:pointer;box-shadow:0 1px 0 #fff inset,0 1px 2px rgba(15,20,32,.06)}',
      '.tm-btn:hover{border-color:#B8C9EA}',
      '.tm-btn[disabled]{opacity:.6;cursor:default}',
      '.tm-btn:focus-visible,.tm-cb:focus-visible,.tm-aj:focus-visible{outline:2px solid var(--tm-b);outline-offset:2px}',
      '.tm-ic{width:44px;padding:0}',
      '.tm-prim{background:var(--tm-b);border-color:var(--tm-b);color:#fff}',
      '.tm-prim:hover{background:var(--tm-n);border-color:var(--tm-n)}',
      '.tm-etat{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 14px;padding:10px 14px;border-radius:14px;border:1px solid var(--tm-f);background:#F4F7FD;font:500 14px/1.4 var(--font);color:var(--tm-g)}',
      '.tm-leg i,.tm-dots i{display:inline-block;width:10px;height:10px;border-radius:50%}',
      'i.d-rdv{background:var(--tm-b)}i.d-rdv.passe{background:#fff;box-shadow:0 0 0 2px var(--tm-b) inset}i.d-occ{border-radius:3px;background:#B7C0D0}i.d-t{border-radius:3px;background:#fff;box-shadow:0 0 0 2px #5B6478 inset}i.d-note{border-radius:3px;background:#7C8597}',
      /* grille */
      '.tm-mois-g{border-radius:20px;padding:12px;border:1px solid #D6E0F3;background:radial-gradient(ellipse 110% 60% at 0% 0%,#E8F0FF 0%,#F2F6FD 60%,#EBF0FA 100%);box-shadow:0 1px 0 #fff inset,0 1px 2px rgba(15,20,32,.05),0 22px 38px -28px rgba(0,52,160,.36)}',
      '.tm-mh{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin:0 0 6px;padding:0 4px}',
      '.tm-mh span{font:800 13px/1.2 var(--font);letter-spacing:.06em;text-transform:uppercase;color:var(--tm-g)}',
      '.tm-g{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}',
      '.tm-c{position:relative;min-width:0;min-height:92px;padding:7px 8px 8px;border-radius:12px;border:1px solid var(--tm-f);background:#fff;display:flex;flex-direction:column;gap:3px;box-shadow:0 1px 0 #fff inset,0 1px 2px rgba(15,20,32,.05)}',
      '.tm-c.passe:not(.auj){background:#F7F9FD}',
      '.tm-c.hors{background:transparent;border-style:dashed;box-shadow:none}',
      '.tm-c.hors .tm-cn{color:#7C8597}',
      '.tm-c.auj{border-color:var(--tm-b);box-shadow:0 0 0 3px var(--tm-halo),0 10px 22px -14px rgba(0,52,160,.5)}',
      '.tm-c.sel:not(.auj){border-color:var(--tm-i);box-shadow:0 0 0 1px var(--tm-i)}',
      '.tm-cb{position:absolute;inset:0;z-index:1;margin:0;padding:0;border:0;border-radius:12px;background:transparent;cursor:pointer}',
      '.tm-c:hover{border-color:#AFC3EA}',
      '.tm-cn{position:relative;display:flex;align-items:center;gap:6px;font:800 15px/1.2 var(--font);font-variant-numeric:tabular-nums;color:var(--tm-i)}',
      '.tm-c.auj .tm-cn{width:max-content;padding:2px 8px;border-radius:8px;background:var(--tm-b);color:#fff}',
      '.tm-cl{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.tm-p{display:flex;align-items:center;gap:5px;min-width:0;font:500 13px/1.3 var(--font);color:var(--tm-i)}',
      '.tm-p>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tm-p svg{flex:none}',
      '.tm-p-rdv{background:var(--tm-b);color:#fff;border-radius:7px;padding:2px 7px;font-weight:600}',
      '.tm-p-rdv b,.tm-p-occ b{flex:none;font-variant-numeric:tabular-nums;font-weight:800}',
      '.tm-p-rdv.passe{background:var(--tm-halo);color:var(--tm-n)}',
      '.tm-p-occ{background:var(--tm-occ);color:var(--tm-g);border-radius:7px;padding:2px 7px}',
      '.tm-p-t{padding:0 2px;color:var(--tm-i)}.tm-p-t svg{color:#5B6478}',
      '.tm-p-t.fait>span{color:var(--tm-g);text-decoration:line-through}.tm-p-t.fait svg{color:var(--tm-b)}',
      '.tm-p-t.retard>span{font-weight:700}',
      '.tm-p-t.prevu svg{color:#9AA3B5}',
      '.tm-p-note{background:var(--tm-note);border-radius:7px;padding:2px 7px;color:var(--tm-g)}.tm-p-note svg{color:#5B6478}',
      '.tm-plus{font:600 13px/1.3 var(--font);color:var(--tm-b);padding-left:2px}',
      '.tm-dots{display:none}',
      '.tm-leg{display:flex;flex-wrap:wrap;gap:6px 18px;margin:12px 2px 0;font:500 13px/1.3 var(--font);color:var(--tm-g)}',
      '.tm-leg span{display:inline-flex;align-items:center;gap:7px}',
      /* le jour choisi */
      '.tm-carte{margin:0;padding:16px 18px 18px;border-radius:20px;border:1px solid var(--tm-f);background:radial-gradient(ellipse 90% 70% at 100% 0%,#EDF3FF 0%,#FFFFFF 78%);box-shadow:0 1px 0 #fff inset,0 1px 2px rgba(15,20,32,.07),0 3px 8px rgba(15,20,32,.04),0 24px 44px -26px rgba(0,48,140,.42)}',
      '.tm-dh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
      '.tm-dk{margin:0 0 2px;font:700 13px/1.3 var(--font);letter-spacing:.07em;text-transform:uppercase;color:var(--tm-b)}',
      '.tm-dt{margin:0;font:800 21px/1.2 var(--font);letter-spacing:-.02em;color:var(--tm-i)}',
      '.tm-ajouts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px}',
      '.tm-aj{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px 0 12px;border-radius:12px;border:1px dashed #9DB4E2;background:#F4F8FF;color:var(--tm-n);font:700 14px/1 var(--font);cursor:pointer}',
      '.tm-aj:hover{background:#E9F0FF;border-style:solid}',
      '.tm-aj.on{background:var(--tm-b);border:1px solid var(--tm-b);color:#fff}',
      '.tm-sh{display:flex;align-items:center;gap:8px;margin:16px 0 2px;font:800 13px/1.2 var(--font);letter-spacing:.07em;text-transform:uppercase;color:var(--tm-g)}',
      '.tm-sh b{background:var(--tm-halo);color:var(--tm-b);border-radius:999px;padding:2px 8px;font-size:13px}',
      '.tm-l{position:relative;display:flex;align-items:flex-start;gap:12px;min-height:44px;padding:10px 0;border-top:1px solid #E6ECF6;font:500 15px/1.4 var(--font);color:var(--tm-i)}',
      '.tm-sh + .tm-l{border-top:0}',
      '.tm-lt{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.tm-lt b{font-weight:700;overflow-wrap:anywhere}',
      '.tm-lt small{font:500 13px/1.35 var(--font);color:var(--tm-g)}',
      '.tm-lt small.tm-ret{color:var(--tm-n);font-weight:700}',
      '.tm-h{flex:none;min-width:58px;padding:3px 4px;box-sizing:border-box;border-radius:8px;background:var(--tm-b);color:#fff;text-align:center;font:800 14px/1.3 var(--font);font-variant-numeric:tabular-nums}',
      '.tm-l-rdv.passe .tm-h{background:var(--tm-halo);color:var(--tm-n)}',
      '.tm-l-occ .tm-h{background:var(--tm-occ);color:var(--tm-g)}.tm-l-occ .tm-lt b{font-weight:600;color:var(--tm-g)}',
      '.tm-l-t{cursor:pointer}',
      '.tm-l-t input{position:absolute;width:1px;height:1px;margin:0;clip:rect(0 0 0 0);overflow:hidden}',
      '.tm-box{flex:none;width:22px;height:22px;margin:0 18px 0 18px;border-radius:7px;border:2px solid #A9B5CB;background:#fff;display:inline-flex;align-items:center;justify-content:center}',
      '.tm-l-t input:checked + .tm-box{background:var(--tm-b);border-color:var(--tm-b)}',
      '.tm-l-t input:checked + .tm-box::after{content:"";width:5px;height:10px;border:solid #fff;border-width:0 2.4px 2.4px 0;transform:translateY(-1px) rotate(45deg)}',
      '.tm-l-t input:focus-visible + .tm-box{box-shadow:0 0 0 3px var(--tm-halo)}',
      '.tm-l-t.fait .tm-lt b{color:var(--tm-g);text-decoration:line-through}',
      '.tm-l-t.prevu{cursor:default}.tm-l-t.prevu .tm-box{border-style:dashed}',
      '.tm-ni{flex:none;width:58px;display:inline-flex;justify-content:center;padding-top:3px;color:#5B6478}',
      '.tm-nb{font:500 15px/1.45 var(--font);color:var(--tm-i);white-space:pre-wrap;overflow-wrap:anywhere}',
      '.tm-rien{margin:12px 0 0;font:500 15px/1.4 var(--font);color:var(--tm-g)}',
      /* formulaire daté */
      '.tm-form{margin:10px 0 6px;padding:14px;border-radius:16px;border:1px solid #C9D7F2;background:#F6F9FF}',
      '.tm-ft{margin:0;font:800 16px/1.3 var(--font);color:var(--tm-i)}',
      '.tm-fa{margin:2px 0 10px;font:500 13px/1.4 var(--font);color:var(--tm-g)}',
      '.tm-fg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}',
      '.tm-fg .tm-f:first-child,.tm-f-l{grid-column:1/-1}',
      '.tm-f{display:flex;flex-direction:column;gap:4px;min-width:0;font:700 13px/1.2 var(--font);color:var(--tm-g)}',
      '.tm-f input,.tm-f textarea{width:100%;box-sizing:border-box;min-height:44px;padding:9px 12px;border-radius:10px;border:1px solid #B8C6E0;background:#fff;color:var(--tm-i);font:500 16px/1.35 var(--font)}',
      '.tm-f textarea{resize:vertical}',
      '.tm-f input:focus,.tm-f textarea:focus{outline:2px solid var(--tm-b);outline-offset:0;border-color:var(--tm-b)}',
      '.tm-fb{display:flex;gap:8px;margin-top:12px}',
      /* en retard, sans date */
      '.tm-libres{display:grid;grid-template-columns:1fr;gap:12px;margin:16px 0 0;align-items:start}',
      '.tm-lb{padding:6px 16px 8px;border-radius:18px;border:1px solid #D6E0F3;background:#F4F7FD}',
      '.tm-lb .tm-sh{margin-top:10px}',
      '.tm-lb .tm-box{margin:0 4px 0 0}',
      /* l'agenda branché ou à brancher (24/11/2026) */
      '.tm-ag{justify-content:space-between}',
      '.tm-agt{flex:1 1 320px;min-width:0}',
      '.tm-agb{display:flex;flex-wrap:wrap;gap:8px}',
      '.tm-ag-on span{flex:1;min-width:0}',
      '.tm-agp{flex:none;width:10px;height:10px;border-radius:50%;background:#1E9E6A;box-shadow:0 0 0 4px #DDF3E9}',
      /* vos clients (24/11/2026) */
      '.tm-clients{margin-top:16px}',
      '.tm-cht{margin:0;font:800 21px/1.2 var(--font);letter-spacing:-.02em;color:var(--tm-i)}',
      '.tm-chp{margin:4px 0 0;font:500 15px/1.4 var(--font);color:var(--tm-g)}',
      '.tm-chp b{color:var(--tm-b);font-weight:800;font-variant-numeric:tabular-nums}',
      '.tm-jauge{height:10px;margin:12px 0 4px;border-radius:999px;background:#E3E9F4;overflow:hidden;box-shadow:0 1px 2px rgba(15,20,32,.1) inset}',
      '.tm-jauge i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--tm-n),var(--tm-b))}',
      '.tm-cnote{margin:8px 0 0;font:500 13px/1.45 var(--font);color:var(--tm-g)}',
      '.tm-ccols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4px 28px}',
      '.tm-cli{display:flex;align-items:center;gap:10px;min-height:44px;padding:5px 0;border-top:1px solid #E6ECF6}',
      '.tm-sh + .tm-cli{border-top:0}',
      '.tm-cn2{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:2px;min-height:44px;margin:0;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;color:var(--tm-i);font:inherit}',
      '.tm-cn2 b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 15px/1.3 var(--font)}',
      '.tm-cn2 small{font:500 13px/1.35 var(--font);color:var(--tm-g)}',
      '.tm-cn2:hover b{color:var(--tm-b)}',
      '.tm-cn2:focus-visible{outline:2px solid var(--tm-b);outline-offset:2px;border-radius:6px}',
      '.tm-ca{flex:none;padding:0 14px;text-decoration:none}',
      '.tm-cq{flex:none;padding:4px 9px;border-radius:8px;background:var(--tm-halo);color:var(--tm-n);font:800 13px/1.3 var(--font);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.tm-cs{flex:none;font:500 13px/1.3 var(--font);color:var(--tm-g)}',
      '.tm-cplus{margin:8px 0 4px}',
      '@media (max-width:760px){.tm-ccols{grid-template-columns:minmax(0,1fr)}}',
      /* le mois à gauche, le jour à droite */
      '.tm-cote{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,1fr);gap:16px;align-items:start}',
      '.tm-jour{position:sticky;top:76px}',
      /* tablette */
      '@media (max-width:1060px){.tm-cote{grid-template-columns:1fr}.tm-jour{position:static}}',
      /* téléphone */
      '@media (max-width:640px){',
      '  .tm-mois{font-size:21px;min-width:0;flex:1}',
      '  .tm-mois-g{padding:8px;border-radius:16px}',
      '  .tm-mh,.tm-g{gap:3px}.tm-mh{padding:0}',
      '  .tm-mh span{text-align:center;font-size:12px;letter-spacing:0}',
      '  .tm-c{min-height:54px;padding:5px 2px 6px;align-items:center;gap:4px;border-radius:9px}',
      '  .tm-cl{display:none}',
      '  .tm-cn{justify-content:center}',
      '  .tm-dots{display:flex;gap:3px;min-height:9px}',
      '  .tm-dots i{width:8px;height:8px}',
      '  .tm-carte{padding:14px 14px 16px}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
