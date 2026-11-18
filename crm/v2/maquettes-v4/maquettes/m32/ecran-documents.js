/* Documents (data-ecran="documents") = l'espace à accès restreint des tarifs, conditions et catalogues.
   Bandeau bleu (cadenas « Accès restreint », phrase calculée, recherche, filtre par type), étagères par dossier (grossistes, groupes d'achat, laboratoires, Intégral),
   vignettes typées (PDF, Excel, Tableau CSV, Image, Texte, Page web), Ouvrir le dossier, Ouvrir / Retirer (confirmation en ligne, vrai retrait),
   « documents retirés » (restaurer). Tout est interne ; données fictives (DONNEES_V5.documents). */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, X = J.X, S = J.S;
var DOC = X.documents, TYPES = ['PDF', 'Excel', 'Tableau CSV', 'Image', 'Texte', 'Page web'];
/* documents déjà retirés avant l'ouverture : la donnée n'en porte que le nombre, on en dessine autant ; ils se restaurent comme les autres */
var ANCIENS = [{ id: 'a0', dossier: 'Grossistes', nom: 'Conditions 2025 · ancienne version', type: 'PDF', date: '12/12/2025', taille: '1800 Ko' }, { id: 'a1', dossier: 'Laboratoires', nom: 'Plaquette 2025', type: 'PDF', date: '03/09/2025', taille: '900 Ko' }].slice(0, DOC.retires || 0);
var E = S.documents = S.documents || { q: '', type: '', dossier: '', retires: ANCIENS.map(function (a) { return a.id; }), confirme: null, voir: false };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var ICO2 = {
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5-7 8M9 19l3-3.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  undo: '<path d="M4 10h11a5 5 0 0 1 0 10h-4M4 10l4-4M4 10l4 4"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>'
};
function ico(k, c) { return ICO2[k] ? '<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"' + (c ? ' style="stroke:' + c + '"' : '') + '>' + ICO2[k] + '</svg></span>' : J.ico(k, c); }
/* un type = un picto + une couleur sur le picto seul (le mot reste en encre) */
var TYPE = { 'PDF': ['doc', 'var(--cat-8)'], 'Excel': ['table', 'var(--cat-3)'], 'Tableau CSV': ['table', 'var(--cat-5)'], 'Image': ['image', 'var(--cat-4)'], 'Texte': ['note', 'var(--enc-3)'], 'Page web': ['globe', 'var(--cat-1)'] };
function icoType(t, blanc) { var x = TYPE[t] || ['doc', 'var(--enc-3)']; return ico(x[0], blanc ? '#fff' : x[1]); }
var SOUS = { 'Grossistes': 'tarifs, conditions et grilles de livraison des grossistes-répartiteurs', 'Groupes d’achat': 'conditions et listings des groupes d’achat', 'Laboratoires': 'tarifs, plaquettes et lettres d’information des laboratoires', 'Intégral': 'nos propres documents : fiches d’ouverture de compte, barèmes, catalogues' };
/* modèle : chaque document reçoit une clé stable (dossier-rang) ; les retirés de la séance vivent dans E.retires */
/* dates : jour et mois sur deux chiffres à l'affichage (les données mêlent « 3/11/2026 » et « 25/11/2026 ») et clé de tri NUMÉRIQUE aaaammjj
   (la clé-chaîne d'avant classait « 3/11/2026 » devant « 25/11/2026 ») */
function dateDeux(d) { var p = String(d).split('/'); return p.length === 3 ? ('0' + p[0]).slice(-2) + '/' + ('0' + p[1]).slice(-2) + '/' + p[2] : d; }
function cleDate(d) { var p = String(d).split('/'); return p.length === 3 ? (+p[2]) * 10000 + (+p[1]) * 100 + (+p[0]) : 0; }
function tous() { var l = []; DOC.dossiers.forEach(function (d, i) { d.docs.forEach(function (x, k) { l.push({ id: 'd' + i + '-' + k, dossier: d.nom, nom: x.nom, type: x.type, date: dateDeux(x.date), taille: x.taille, tri: cleDate(x.date) }); }); }); ANCIENS.forEach(function (a) { l.push({ id: a.id, dossier: a.dossier, nom: a.nom, type: a.type, date: dateDeux(a.date), taille: a.taille, tri: cleDate(a.date), ancien: true }); }); return l; }
var TOUS = tous();
function parId(id) { for (var i = 0; i < TOUS.length; i++) if (TOUS[i].id === id) return TOUS[i]; return null; }
function retire(id) { return E.retires.indexOf(id) >= 0; }
function actifs() { return TOUS.filter(function (x) { return !retire(x.id); }); }
function visibles() { var q = E.q.trim().toLowerCase(); return actifs().filter(function (x) { if (E.type && x.type !== E.type) return false; if (E.dossier && x.dossier !== E.dossier) return false; return !q || (x.nom + ' ' + x.type + ' ' + x.dossier + ' ' + x.date).toLowerCase().indexOf(q) >= 0; }); }
function tailleJolie(t) { var n = parseInt(t, 10); return isFinite(n) ? (n >= 1000 ? J.nf1.format(n / 1000) + ' Mo' : n + ' Ko') : esc(t); }   // espace insécable : l'unité ne reste pas seule en fin de ligne
function parType() { var r = {}; actifs().forEach(function (x) { r[x.type] = (r[x.type] || 0) + 1; }); return r; }
/* ---------- une vignette : feuille (picto du type, coin plié ; une image pour le type Image), nom, type · date · taille, Ouvrir / Retirer ---------- */
function vignette(x, i) {
  var conf = E.confirme === x.id;
  return '<article class="dc-doc' + (conf ? ' dc-conf-on' : '') + '" data-id="' + x.id + '" style="--i:' + Math.min(i, 12) + '">' +
    '<span class="dc-feuille' + (x.type === 'Image' ? ' dc-feuille-img' : '') + '" aria-hidden="true">' + (x.type === 'Image' ? '<i class="dc-img"></i>' : icoType(x.type)) + '<em>' + esc(x.type) + '</em></span>' +
    '<div class="dc-t"><b>' + esc(x.nom) + '</b><span class="st"><span class="dc-type-m">' + esc(x.type) + ' · </span>' + esc(x.date) + ' · ' + tailleJolie(x.taille) + '</span></div>' +
    '<div class="dc-act"><button type="button" class="pil dc-ouvre" data-stub="L’aperçu d’un document n’est pas dessiné dans cette maquette.">' + J.ico('eye') + 'Ouvrir</button><button type="button" class="b-rond" data-retirer="' + x.id + '" aria-label="Retirer ' + esc(x.nom) + '">' + ico('trash') + '</button></div>' +
    (conf ? '<div class="dc-conf" role="group" aria-label="Confirmer le retrait"><span>Retirer « <b>' + esc(x.nom) + '</b> » ?</span><span class="dc-conf-b"><button type="button" class="pil plein" data-confirme="' + x.id + '">Retirer</button><button type="button" class="pil" data-garde>Garder</button></span></div>' : '') + '</article>';
}
function etagere(d, l) {
  return '<section class="carte dc-etagere entre" data-interne aria-label="' + esc(d.nom) + '"><div class="tete"><div><h2>' + esc(d.nom) + '</h2><p class="st">' + esc(SOUS[d.nom] || d.type) + ' · <b class="num">' + l.length + '</b> document' + (l.length > 1 ? 's' : '') + (E.q || E.type ? ' affiché' + (l.length > 1 ? 's' : '') : '') + '</p></div><button type="button" class="pil" data-dossier="' + (E.dossier ? '' : esc(d.nom)) + '">' + J.ico('folder') + (E.dossier ? 'Tous les dossiers' : 'Ouvrir le dossier') + '</button></div>' +
    '<div class="dc-grille">' + l.map(vignette).join('') + '</div></section>';
}
function remplir(el) {
  var v = visibles(), nbAff = v.length, html = '';
  DOC.dossiers.forEach(function (d) { var l = v.filter(function (x) { return x.dossier === d.nom; }).sort(function (a, b) { return b.tri - a.tri; }); if (l.length) html += etagere(d, l); });
  $('#dc-etageres', el).innerHTML = html || '<section class="carte dc-vide" data-interne><p>Aucun document ' + (E.type ? 'de type « ' + esc(E.type) + ' »' : '') + (E.dossier ? ' dans le dossier ' + esc(E.dossier) : '') + (E.q ? ' pour « ' + esc(E.q) + ' »' : '') + '.</p><button type="button" class="pil" data-raz>Tout afficher</button></section>';
  var filtre = E.q || E.type || E.dossier, nbDoc = $('#dc-nbdoc', el);
  if (nbDoc) nbDoc.textContent = actifs().length + ' documents';   // le compte du bandeau suit les retraits et les restaurations
  $('#dc-cpt', el).innerHTML = filtre ? '<b>' + nbAff + ' document' + (nbAff > 1 ? 's' : '') + '</b> affiché' + (nbAff > 1 ? 's' : '') + (E.dossier ? ' · dossier ' + esc(E.dossier) : '') + ', du plus récent au plus ancien dans chaque dossier' : 'Du plus récent au plus ancien dans chaque dossier';
  var nbR = E.retires.length, bloc = $('#dc-retires', el);
  bloc.innerHTML = '<div class="tete"><div><h2>Documents retirés</h2><p class="st">retirés des étagères, jamais supprimés : ils se restaurent d’ici</p></div><button type="button" class="pil" data-voir aria-expanded="' + E.voir + '">' + J.ico(E.voir ? 'chevb' : 'chev') + '<b class="num">' + nbR + '</b> retiré' + (nbR > 1 ? 's' : '') + '</button></div>' +
    (E.voir ? '<div class="dc-rl">' + (E.retires.length ? E.retires.map(function (id) { var x = parId(id); return x ? '<div class="dc-r"><span class="dc-r-ico">' + icoType(x.type) + '</span><div class="dc-t"><b>' + esc(x.nom) + '</b><span class="st">' + esc(x.dossier) + (x.ancien ? ' · retiré les jours précédents' : ' · retiré à l’instant') + '</span></div><button type="button" class="pil" data-restaure="' + id + '">' + ico('undo') + 'Restaurer</button></div>' : ''; }).join('') : '') +
      (E.retires.length ? '' : '<p class="note">Aucun document retiré pour l’instant.</p>') + '</div>' : '');
  $$('[data-retirer]', el).forEach(function (b) { b.onclick = function () { E.confirme = b.getAttribute('data-retirer'); remplir(el); var c = $('[data-confirme]', el); if (c) c.focus(); }; });
  $$('[data-garde]', el).forEach(function (b) { b.onclick = function () { E.confirme = null; remplir(el); }; });
  $$('[data-confirme]', el).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-confirme'), x = parId(id); E.retires.push(id); E.confirme = null; if (E.types) E.types(); remplir(el); J.toast('« ' + (x ? x.nom : id) + ' » est retiré de l’étagère. Il se restaure depuis « Documents retirés ».'); }; });
  $$('[data-restaure]', el).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-restaure'); E.retires = E.retires.filter(function (k) { return k !== id; }); if (E.types) E.types(); remplir(el); }; });
  var v2 = $('[data-voir]', el); if (v2) v2.onclick = function () { E.voir = !E.voir; remplir(el); };
  $$('[data-dossier]', el).forEach(function (b) { b.onclick = function () { E.dossier = b.getAttribute('data-dossier'); E.confirme = null; remplir(el); var t = $('#dc-cpt', el); if (t) window.scrollTo(0, Math.max(0, t.getBoundingClientRect().top + window.scrollY - 96)); }; });
  var raz = $('[data-raz]', el); if (raz) raz.onclick = function () { E.q = ''; E.type = ''; E.dossier = ''; $('#dc-q', el).value = ''; if (E.types) E.types(); remplir(el); };
  J.poseIcones(el);
}
J.ecrans.documents = {
  rendre: function (el, etat) {
    var nbDos = DOC.dossiers.length;
    /* vue pharmacien : l'espace est réservé à l'équipe → un bandeau réduit (titre et cadenas) et la phrase d'explication, rien d'autre (ni compte, ni recherche, ni types) */
    if ((etat && etat.vue) === 'pharmacien') {
      el.innerHTML = '<div class="page dc">' + J.bandeau({ croix: true, eyebrow: '<span class="dc-eye">' + J.ico('lock') + 'Accès restreint · réservé à l’équipe</span>', titre: 'Documents' }) +
        '<p class="note vp dc-vp">Vue pharmacien : cet espace est réservé à l’équipe, rien ne s’affiche ici.</p></div>';
      return;
    }
    el.innerHTML = '<div class="page dc">' + J.bandeau({
      croix: true, eyebrow: '<span class="dc-eye">' + J.ico('lock') + 'Accès restreint · réservé à l’équipe</span>', titre: 'Documents',
      lede: '<b>' + nbDos + ' dossiers</b>, <b id="dc-nbdoc">' + actifs().length + ' documents</b> : les tarifs, les conditions et les catalogues des grossistes, des groupes d’achat et des laboratoires, rangés par dossier.',
      actions: '<button type="button" class="pil plein" data-stub="' + STUB('Déposer un document') + '">' + ico('upload') + 'Déposer un document</button>',
      recherche: { id: 'dc-q', placeholder: 'Rechercher un document…', aria: 'Rechercher un document dans tous les dossiers', valeur: E.q },
      bas: '<span class="lbl">Type :</span><div class="chips dc-types" role="group" aria-label="Filtrer par type"></div>'
    }) +
    '<p class="dc-cpt" id="dc-cpt"></p>' +
    '<div id="dc-etageres"></div>' +
    '<section class="carte dc-retires-c" id="dc-retires" data-interne></section>' +
    '<p class="note dc-note" data-interne>Les fichiers sont dans l’espace protégé de l’équipe. Les pages web se téléchargent, elles ne s’affichent pas dans l’appli.</p>' +
    '</div>';
    /* les pastilles de type : redessinées à chaque choix et après chaque retrait (le picto reste coloré sur la pastille blanche, blanc sur les sombres) */
    function types() {
      var pt = parType();
      $('.dc-types', el).innerHTML = '<button type="button" class="chip" data-type="" aria-pressed="' + !E.type + '">Tous</button>' +
        TYPES.filter(function (t) { return pt[t]; }).map(function (t) { return '<button type="button" class="chip" data-type="' + esc(t) + '" aria-pressed="' + (E.type === t) + '">' + icoType(t, E.type !== t) + esc(t) + ' <span class="cnt">' + pt[t] + '</span></button>'; }).join('');
      $$('[data-type]', el).forEach(function (c) { c.onclick = function () { E.type = c.getAttribute('data-type'); E.confirme = null; types(); remplir(el); }; });
    }
    E.types = types; types(); remplir(el);
    $('#dc-q', el).oninput = function (e) { E.q = e.target.value; E.confirme = null; remplir(el); };
  }
};
})();
