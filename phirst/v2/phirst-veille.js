/* PHIRST · écran « Veille » (21/11/2026) : les reprises d'officines du secteur (BODACC), rangées par l'ordre des départements
   de Yann, avec filtres par famille et par département. La liste vient de la ligne du compte
   (ligne_accueil.donnees[0].veille, calculée par le robot du Mac) ; « L'ajouter à mes pistes » est la fonction de l'accueil
   (window.PHIRST_PISTE.ajouter, phirst-ligne.js), pas une copie. Logique pure : phirst-pur.js. */
(function () {
  function insec(s) { return String(s == null ? '' : s).replace(/ /g, '\u00A0'); }   // 25/11 : « il y a 17 jours », « 8 novembre » ne se coupent plus
  'use strict';
  var P = window.PHIRST_PUR, V2 = window.V2;
  if (!P || !V2) return;
  V2.pages = V2.pages || {};
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var S = { racine: null, jeton: 0, items: null, maj: '', attend: false, erreur: false, famille: '', dep: '', faits: {} };
  var FAIT = ['Ajoutée à vos pistes.', 'Déjà dans vos pistes.'];

  function charger() {
    var tok = ++S.jeton; S.items = null; S.erreur = false; dessiner();
    window.PHIRST_DONNEES.ligne().then(function (r) {
      if (tok !== S.jeton) return;
      var v = r && r.frais && r.trouver && Array.isArray(r.trouver.veille) ? r.trouver.veille : null;
      S.attend = !v; S.items = v ? P.trierVeille(v) : []; S.maj = r && r.calculeLe ? P.miseAJourFr(r.calculeLe) : ''; dessiner();
    }, function () { if (tok === S.jeton) { S.erreur = true; dessiner(); } });
  }
  function ligne(v, i) {
    var f = S.faits[P.cle(v.nom, v.ville)];
    return '<li class="pa-l" data-i="' + i + '"><div class="pa-ht"><div><b>' + esc(v.nom) + '</b><small>' + esc(v.ville) + (v.dep ? ' · ' + esc(v.dep) : '') + '</small></div>' +
      '<em class="lg-et" data-ton="' + (v.famille === 'procedure_collective' ? 'rouge' : 'orange') + '">' + esc(P.nomFamille(v.famille)) + '</em></div>' +
      '<p class="pa-r">Paru au BODACC ' + esc(insec(P.age(v.date, P.aujourdhui()))) + ' (' + esc(insec(P.jourAvecAnnee(v.date, P.aujourdhui()))) + ').</p>' +
      '<div class="pa-bs"><button type="button" class="pa-b pa-ok" data-ajout="1"' + (FAIT.indexOf(f) >= 0 ? ' disabled' : '') + '>L’ajouter à mes pistes</button>' +
      (P.lienSur(v.lien) ? '<a class="pa-b pa-lienb" href="' + esc(P.lienSur(v.lien)) + '" target="_blank" rel="noopener">Voir l’annonce</a>' : '') + '</div>' +
      '<p class="pa-dit" role="status">' + esc(f || '') + '</p></li>';
  }
  function visibles() { return P.filtrerVeille(S.items, S.famille, S.dep); }
  function dessiner() {
    var el = S.racine; if (!el) return;
    if (V2.route && V2.route.name !== 'veille') return;   // la racine est commune à tous les écrans
    var corps = '';
    if (S.erreur) corps = '<div class="pa-vide"><p>La veille ne s’est pas chargée.</p><p>Vérifiez votre connexion puis réessayez.</p><button type="button" class="lg-gros" data-reessayer="1">Réessayer</button></div>';
    else if (S.items === null) corps = '<p class="pa-avis">Chargement…</p>';
    else if (S.attend) corps = '<div class="pa-vide"><p>La liste arrive au prochain passage, à 7 h 05.</p><p>Chaque matin, les pharmacies vendues, ouvertes ou en difficulté de votre secteur apparaissent ici.</p></div>';
    else if (!S.items.length) corps = '<div class="pa-vide"><p>Aucune reprise nouvelle dans votre secteur pour le moment.</p><p>Les pharmacies déjà dans vos pistes n’y figurent plus. Revenez demain après 7 h 05.</p><button type="button" class="lg-gros" data-vers="appels">Voir mes pistes</button></div>';
    else {
      var n = P.compterFamilles(S.items), deps = P.departementsDe(S.items), v = visibles();
      corps = '<div class="pa-filtres"><div class="pa-chips" role="group" aria-label="Famille">' +
        '<button type="button" class="pa-chip" data-fam="" aria-pressed="' + (S.famille === '') + '">Toutes (' + S.items.length + ')</button>' +
        P.FAMILLES.map(function (f) { return n[f.cle] ? '<button type="button" class="pa-chip" data-fam="' + f.cle + '" aria-pressed="' + (S.famille === f.cle) + '">' + esc(f.nom) + ' (' + n[f.cle] + ')</button>' : ''; }).join('') + '</div>' +
        '<label class="pa-ch">Département<select id="pv-dep"><option value="">Tous les départements</option>' + deps.map(function (d) { return '<option value="' + d.dep + '"' + (S.dep === d.dep ? ' selected' : '') + '>' + d.dep + ' (' + d.n + ')</option>'; }).join('') + '</select></label></div>' +
        (v.length ? '<p class="pa-lt">' + v.length + ' pharmacie' + (v.length > 1 ? 's' : '') + ', dans l’ordre de votre secteur</p><ul class="pa-liste">' + v.map(ligne).join('') + '</ul>'
          : '<div class="pa-vide"><p>Aucune pharmacie pour ce choix.</p><p>Choisissez « Toutes » ou un autre département pour revoir la liste.</p><button type="button" class="lg-gros" data-fam="" data-dep="">Tout afficher</button></div>');
    }
    el.innerHTML = window.PHIRST_ECRAN.cadre('<section class="pa pv" aria-label="Veille">' + window.PHIRST_ECRAN.tete('Veille', 'Les pharmacies vendues, ouvertes ou en difficulté dans votre secteur (BODACC).', S.items && S.maj ? 'Liste mise à jour ' + S.maj + '.' : '') + '<div class="pa-corps">' + corps + '</div></section>');
  }
  function clic(ev) {
    var t = ev.target;
    var g = t.closest('[data-vers]'); if (g) { V2.go(g.getAttribute('data-vers')); return; }
    if (t.closest('[data-reessayer]')) { charger(); return; }
    var c = t.closest('[data-fam]'); if (c) { S.famille = c.getAttribute('data-fam'); if (c.hasAttribute('data-dep')) S.dep = ''; dessiner(); return; }
    var b = t.closest('[data-ajout]'), li = t.closest('.pa-l');
    if (b && li) {
      var v = visibles()[+li.getAttribute('data-i')], dit = li.querySelector('.pa-dit');
      if (!v || !window.PHIRST_PISTE) { dit.textContent = 'Pas enregistré : réessayez dans un instant.'; return; }
      b.disabled = true; dit.textContent = '';
      window.PHIRST_PISTE.ajouter(v.piste).then(function (m) {
        S.faits[P.cle(v.nom, v.ville)] = m; dit.textContent = m; b.disabled = FAIT.indexOf(m) >= 0;
      });
    }
  }
  function change(ev) { if (ev.target.id === 'pv-dep') { S.dep = ev.target.value; dessiner(); document.getElementById('pv-dep').focus(); } }
  V2.pages.veille = { needs: [], render: function (root) {
    S.racine = root;
    if (!root.__pv) { root.__pv = true; root.addEventListener('click', clic); root.addEventListener('change', change); }
    charger();
  } };
})();
