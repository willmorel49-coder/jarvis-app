/* PHIRST · accueil de Yann : « Le mot du vendredi » (idée 11, 24/11/2026), posé sous la ligne. Du vendredi au lundi, trois lignes sur la semaine de la
   téléprospectrice, calculées depuis le journal réel (crm_activities, type « appel », ses appels à elle seule), et un bouton pour viser mieux la suivante.
   Le bouton range le choix dans `ligne_priorite` (une ligne par compte, une semaine) : c'est le robot du matin (~/phirst-ligne/) qui le lit pour ranger
   la liste d'appels ; tant qu'il ne l'a pas fait, l'écran dit « C'est noté », jamais « C'est fait ». « Revenir à l'ordre habituel » ne supprime rien :
   la ligne garde sa date d'annulation (`annule_le`). Table absente (SQL pas posé) : lignes seules, sans bouton.
   Logique pure et testée : phirst-mot-pur.js (tests/phirst-l3-mot.test.mjs). Elle ne voit rien de neuf : l'écran se tait pour la téléprospectrice. */
(function () {
  'use strict';
  var P = window.PHIRST_PUR, M = window.PHIRST_MOT_PUR, V2 = window.V2;
  if (!P || !M || !V2) return;
  var PAS = 'Pas enregistré : réessayez dans un instant.', COLS = 'source,motifs,valable_du,valable_jusqu,pris_en_compte_le,annule_le';
  var E = { pour: null, etat: 'rien', c: null, sem: null, prop: null, choix: null, table: true, dit: '', occupe: false };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }
  var FLECHE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6"/></svg>';
  var COCHE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function charger() {
    var u = V2.user, base = sb(), auj = P.aujourdhui();
    if (!u || !base || E.pour === u.id) return;
    E.pour = u.id; E.etat = 'charge';
    if (!M.visible(auj)) return;
    var pour = u.id, sem = M.semaine(auj);
    (window.PHIRST_ROLE ? window.PHIRST_ROLE.estTelepro() : Promise.resolve(false)).then(function (t) {
      if (t) throw new Error('elle');
      return Promise.all([window.PHIRST_EQUIPE ? window.PHIRST_EQUIPE.lire() : {},
        base.from('crm_activities').select('prospect_id,author_id,body,created_at').eq('type', 'appel').gte('created_at', P.ajouterJours(sem.debut, -1) + 'T00:00:00Z').order('created_at', { ascending: true }).limit(1000),
        Promise.resolve(base.from('ligne_priorite').select(COLS).eq('user_id', u.id).maybeSingle()).then(function (r) { return r; }, function () { return { error: true }; })]);
    }).then(function (x) {
      if (V2.user && V2.user.id !== pour) return;
      var ap = x[1]; if (!ap || ap.error) throw new Error('journal');
      var lignes = ap.data || [], ids = [], vus = {};
      lignes.forEach(function (a) { if (!vus[a.prospect_id]) { vus[a.prospect_id] = 1; ids.push(a.prospect_id); } });
      var lots = []; for (var i = 0; i < ids.length; i += 80) lots.push(ids.slice(i, i + 80));
      return Promise.all(lots.map(function (l) { return base.from('crm_prospects').select('id,source').in('id', l); })).then(function (rs) {
        var fiches = {}; rs.forEach(function (r) { if (r.error) throw new Error('fiches'); (r.data || []).forEach(function (f) { fiches[f.id] = f; }); });
        E.sem = sem; E.c = M.compter(lignes, fiches, x[0] || {}, sem); E.prop = M.proposition(E.c, auj);
        E.table = !(x[2] && x[2].error); E.choix = E.table ? M.choixEnCours(x[2].data, auj) : null;
        E.etat = 'pret'; monter();
      });
    }).then(null, function () { E.etat = 'rien'; });
  }
  function dessiner(el) {
    var auj = P.aujourdhui(), c = E.c, ph = M.phrase(c), h = '<header class="mv-tete"><p class="mv-sur" id="mv-t"><i></i>Le mot du vendredi · ' + esc(M.libelleSemaine(E.sem)) + '</p><p class="mv-jusque">Visible du vendredi au lundi</p></header>';
    el.setAttribute('aria-labelledby', 'mv-t');
    if (!ph) { el.innerHTML = h + '<div class="mv-l"><h2 class="mv-e">Cette semaine</h2><p class="mv-phrase">Dès que la téléprospectrice note ses appels, le bilan de sa semaine apparaît ici.</p></div>'; return; }
    h += '<div class="mv-l"><h2 class="mv-e">Cette semaine</h2><p class="mv-phrase mv-grande">' + ph.map(function (s) { return s.b ? '<b>' + esc(s.t) + '</b>' : esc(s.t); }).join('') + '</p></div>';
    var r = M.phraseRaisons(c);
    h += '<div class="mv-l"><h2 class="mv-e">Ce qui a donné des rendez-vous</h2>' + (r.liste.length ? '<ul class="mv-raisons">' + r.liste.map(function (x) {
      return '<li><span class="mv-r">' + esc(x.nom) + '</span><span class="mv-v"><b>' + esc(x.gras) + '</b>, ' + esc(x.rythme) + '</span></li>';
    }).join('') + '</ul>' : '<p class="mv-phrase">' + esc(r.vide) + '</p>') + '</div>';
    if (E.table && (E.choix || E.prop)) {
      var q = E.prop ? E.prop.periode.quand : 'La semaine prochaine';
      h += '<div class="mv-l mv-act" id="mv-act"><h2 class="mv-e">' + esc(E.choix ? 'Votre choix' : q.charAt(0).toUpperCase() + q.slice(1)) + '</h2><div class="mv-geste">';
      if (E.choix) h += '<div class="mv-zone" id="mv-zone"><div class="mv-fait" role="status"><span class="mv-coche">' + COCHE + '</span><span class="mv-ok">' + esc(M.phraseChoix(E.choix, auj)) + '</span><button type="button" class="mv-annule" id="mv-annule"' + (E.occupe ? ' disabled' : '') + '>Revenir à l’ordre habituel</button></div></div>';
      else h += '<p class="mv-phrase">' + esc(E.prop.texte) + '</p><div class="mv-zone" id="mv-zone"><button type="button" class="mv-btn" id="mv-btn"' + (E.occupe ? ' disabled' : '') + '>' + FLECHE + esc(E.prop.bouton) + '</button></div>';
      h += '<p class="mv-dit" role="alert">' + esc(E.dit) + '</p></div></div>';
    }
    el.innerHTML = h;
  }
  /* Chaque écriture attend la réponse de la base avant de dire quoi que ce soit. */
  function choisir() {
    var base = sb(), u = V2.user; if (!base || !u || !E.prop || E.occupe) return;
    E.occupe = true; E.dit = ''; redessiner();
    Promise.resolve(base.from('ligne_priorite').upsert(Object.assign({ user_id: u.id, updated_at: new Date().toISOString() }, M.ligneAEnregistrer(E.prop)), { onConflict: 'user_id' }).select(COLS).single())
      .then(function (r) { if (r.error || !r.data) throw new Error('ecrire'); E.choix = M.choixEnCours(r.data, P.aujourdhui()); }, function () { throw new Error('ecrire'); })
      .then(null, function () { E.dit = PAS; }).then(function () { E.occupe = false; redessiner('mv-annule'); });
  }
  function annuler() {
    var base = sb(), u = V2.user; if (!base || !u || E.occupe) return;
    E.occupe = true; E.dit = ''; redessiner();
    Promise.resolve(base.from('ligne_priorite').update({ annule_le: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', u.id).select('user_id'))
      .then(function (r) { if (r.error || !r.data || !r.data.length) throw new Error('retirer'); E.choix = null; }, function () { throw new Error('retirer'); })
      .then(null, function () { E.dit = PAS; }).then(function () { E.occupe = false; redessiner('mv-btn'); });
  }
  function redessiner(focus) { var el = document.getElementById('mv'); if (!el) return; dessiner(el); var f = focus && document.getElementById(focus); if (f) f.focus(); }
  function monter() {
    if (E.etat !== 'pret') return;
    var ancre = document.getElementById('lg-ligne') || document.getElementById('aube-champ'), el = document.getElementById('mv');
    if (!ancre) return;
    if (el && el.previousElementSibling === ancre) return;
    if (!el) {
      el = document.createElement('section'); el.id = 'mv'; el.className = 'mv';
      el.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b || b.disabled) return; if (b.id === 'mv-btn') choisir(); else if (b.id === 'mv-annule') annuler(); });
      dessiner(el);
    }
    ancre.parentNode.insertBefore(el, ancre.nextSibling);
  }
  function suite() { if (V2.user && E.pour !== V2.user.id) charger(); monter(); }
  new MutationObserver(suite).observe(document.documentElement, { childList: true, subtree: true });
  suite();
})();
