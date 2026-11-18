/* Marketing (data-ecran="marketing") = l'espace des supports à remettre au pharmacien.
   #marketing : bandeau bleu avec la recherche, quatre portes (Supports officine, Documents partagés, Le nouveau site, LinkedIn), Repères,
   Documents partagés (grille), Le nouveau site (trois pages), LinkedIn (le plan de la semaine en tableau). #marketing-detail : Supports officine
   en plein écran (Mes fiches · Commencer · Prêts à présenter, Partir d'un rayon, tableau des fiches, aperçu d'une fiche).
   Tout est interne sauf les supports prêts à présenter ; données fictives (DONNEES_V5.marketing, DONNEES_V5.mallette pour les PDF de l'équipe). */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, X = J.X, S = J.S;
var M = X.marketing, PDF = (X.mallette && X.mallette.documents) || [];
var E = S.marketing = S.marketing || { q: '', onglet: 'fiches', rayon: '', fiche: 0, dossier: '' };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
/* icônes propres à l'écran (trait 1,9, 24 × 24), le reste vient du jeu commun */
var ICO2 = {
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5-7 8M9 19l3-3.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  print: '<path d="M7 8V4h10v4M7 17H4v-6h16v6h-3"/><rect x="7" y="14" width="10" height="6"/>',
  present: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8M8 12l3-3 2 2 3-4"/>',
  pages: '<path d="M7 3h8l4 4v12H7z"/><path d="M15 3v4h4M4 7v14h11"/>'
};
function ico(k, c) { return ICO2[k] ? '<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true"' + (c ? ' style="stroke:' + c + '"' : '') + '>' + ICO2[k] + '</svg></span>' : J.ico(k, c); }
/* bouton rond d'action (même dessin que J.rond, mais avec les icônes de l'écran) */
function rond(k, txt, stub, plein, extra) { return '<button type="button" class="rond-act' + (plein ? ' plein' : '') + '" data-stub="' + esc(stub) + '"' + (extra || '') + '><span class="rond">' + ico(k) + '</span>' + txt + '</button>'; }
function pharmacien() { return J.S.vue === 'pharmacien'; }
/* les trois pages du nouveau site (la porte « 3 pages » compte cette liste) et l'ordre des jours pour le plan LinkedIn */
var PAGES = [['Accueil', 'La page d’entrée du nouveau site'], ['« Rendre la marge à l’officine française. »', 'La maquette de la promesse'], ['Page RSE', 'Nos engagements, en une page']];
var JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
var NB_ETAB = (X.produits && X.produits.etablissements || []).length;
/* états : mot + icône, la couleur sur l'icône seule */
function etatFiche(e) { return e === 'Prête à présenter' ? '<span class="etat">' + J.ico('check', 'var(--e-bien)') + 'Prête à présenter</span>' : '<span class="etat">' + J.ico('edit', 'var(--e-neutre)') + esc(e) + '</span>'; }
function etatPost(e) { return e === 'Publié' ? '<span class="etat">' + J.ico('check', 'var(--e-bien)') + 'Publié</span>' : '<span class="etat">' + J.ico('eye', 'var(--e-attention)') + esc(e) + '</span>'; }
var TYPE_ICO = { 'PDF': ['doc', 'var(--cat-8)'], 'Excel': ['table', 'var(--cat-3)'], 'Tableau CSV': ['table', 'var(--cat-5)'], 'Image': ['image', 'var(--cat-4)'], 'Texte': ['note', 'var(--enc-3)'], 'Page web': ['globe', 'var(--cat-1)'] };
function icoType(t) { var x = TYPE_ICO[t] || ['doc', 'var(--enc-3)']; return ico(x[0], x[1]); }
function chercheDans(txt) { var q = E.q.trim().toLowerCase(); return !q || txt.toLowerCase().indexOf(q) >= 0; }
/* les dossiers des documents partagés : lus dans le premier mot du nom (Catalogues, Fiches, Pas-à-pas, Listings) */
var DOSSIER = { 'Catalogue': 'Catalogues', 'Fiche': 'Fiches', 'Pas-à-pas': 'Pas-à-pas', 'Listing': 'Listings' };
function dossierDe(d) { return DOSSIER[d.nom.split(/[\s·]/)[0]] || 'Autres'; }
var DOSSIERS = []; PDF.forEach(function (d) { var k = dossierDe(d); if (DOSSIERS.indexOf(k) < 0) DOSSIERS.push(k); });
/* ---------- une porte (vignette) : icône dans un rond, titre, phrase, compteur en encre ---------- */
var PORTE_ICO = { supports: 'present', documents: 'folder', site: 'globe', linkedin: 'share' };
/* le compteur de chaque porte est compté sur ce que la porte ouvre, pas lu dans la chaîne « n » des données */
function compte(p) {
  var n = { supports: [M.fiches.length, 'fiche'], documents: [PDF.length, 'document'], site: [PAGES.length, 'page'], linkedin: [M.posts.filter(function (x) { return x.etat !== 'Publié'; }).length, 'post'] }[p.k];
  if (!n || !n[0]) return String(p.n);
  return n[0] + ' ' + n[1] + (n[0] > 1 ? 's' : '') + (p.k === 'linkedin' ? ' à relire' : '');
}
function porte(p, i) {
  var m = compte(p).match(/^(\S+)\s+(.*)$/), n = m ? '<b class="num">' + esc(m[1]) + '</b><span>' + esc(m[2]) + '</span>' : '<b>' + esc(compte(p)) + '</b>';
  var href = p.k === 'supports' ? '#marketing-detail' : '#marketing';
  return '<a class="mk-porte" href="' + href + '" data-porte="' + p.k + '" style="--i:' + i + '"' + (p.k === 'supports' ? '' : ' data-interne') + '><span class="rond gris">' + ico(PORTE_ICO[p.k] || 'doc') + '</span><span class="mk-porte-t"><b>' + esc(p.t) + '</b><span class="st">' + esc(p.s) + '</span></span><span class="mk-porte-n">' + n + '</span>' + J.ico('chev') + '</a>';
}
/* ---------- vignette de repère : un aperçu d'écran dessiné en CSS (bandeau, lignes), le titre et la phrase ---------- */
function repere(r, i) {
  return '<button type="button" class="mk-rep" style="--i:' + i + '" data-stub="' + STUB('Ouvrir « ' + r.t + ' »') + '"><span class="mk-ap' + (r.k === 'sept' ? ' mk-ap-deux' : '') + '" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="mk-rep-t"><b>' + esc(r.t) + '</b><span class="st">' + esc(r.s) + '</span></span>' + J.ico('ext') + '</button>';
}
/* ---------- un document partagé de l'équipe (grille) ---------- */
function docPartage(d, i) {
  return '<div class="mk-doc" style="--i:' + i + '"><span class="mk-doc-ico">' + icoType(d.type) + '</span><div class="mk-doc-t"><b>' + esc(d.nom) + '</b><span class="st">' + esc(d.type) + ' · ' + esc(d.taille) + '</span></div>' +
    '<div class="mk-doc-act"><button type="button" class="b-rond" aria-label="Ouvrir ' + esc(d.nom) + '" data-stub="' + STUB('Ouvrir le document') + '">' + J.ico('eye') + '</button><button type="button" class="b-rond" aria-label="Envoyer ' + esc(d.nom) + '" data-stub="' + STUB('Envoyer le document') + '">' + J.ico('send') + '</button></div></div>';
}
function pagesSite() {
  return PAGES.map(function (p, i) {
    return '<button type="button" class="mk-page" style="--i:' + i + '" data-stub="' + STUB('Ouvrir la page en plein cadre') + '"><span class="mk-ap mk-ap-site" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>' + esc(p[0]) + '</b><span class="st">' + esc(p[1]) + '</span></button>'; }).join('');
}
function remplirMarketing(el) {
  var docs = PDF.filter(function (d) { return (!E.dossier || dossierDe(d) === E.dossier) && chercheDans(d.nom + ' ' + d.type); }), reps = M.reperes.filter(function (r) { return chercheDans(r.t + ' ' + r.s); });
  var posts = M.posts.filter(function (p) { return chercheDans(p.jour + ' ' + p.t + ' ' + p.etat); }).sort(function (a, b) { return JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour); });   // dans l'ordre de la semaine (les données arrivent mardi, jeudi, lundi)
  $('#mk-docs-l', el).innerHTML = docs.length ? docs.map(docPartage).join('') : '<p class="mk-vide">Aucun document ne correspond' + (E.dossier ? ' dans « ' + esc(E.dossier) + ' »' : '') + (E.q ? ' à « ' + esc(E.q) + ' »' : '') + '.</p>';
  $('#mk-rep-l', el).innerHTML = reps.length ? reps.map(repere).join('') : '<p class="mk-vide">Aucun repère ne correspond à « ' + esc(E.q) + ' ».</p>';
  $('#mk-posts', el).innerHTML = posts.length ? posts.map(function (p, i) { return '<tr style="--i:' + i + '"><td data-l="Jour"><b>' + esc(p.jour) + '</b></td><td data-l="Post"><b class="mk-post-t">' + esc(p.t) + '</b></td><td data-l="État">' + etatPost(p.etat) + '</td><td class="num mk-act"><button type="button" class="pil" data-stub="' + STUB(p.etat === 'Publié' ? 'Voir le post publié' : 'Relire le post') + '">' + (p.etat === 'Publié' ? 'Voir' : 'Relire') + '</button></td></tr>'; }).join('')
    : '<tr><td colspan="4" class="mk-vide">Aucun post ne correspond à « ' + esc(E.q) + ' ».</td></tr>';
  J.poseIcones(el);
}
J.ecrans.marketing = {
  rendre: function (el, etat) {
    if (etat.suite === 'detail') return rendreSupports(el);
    var derniere = M.fiches.filter(function (f) { return f.etat === 'Prête à présenter'; })[0];   // les fiches sont rangées de la plus récente à la plus ancienne
    el.innerHTML = '<div class="page mk">' + J.bandeau({
      croix: true, eyebrow: 'Marketing · les supports à remettre au pharmacien', titre: 'Marketing',
      lede: '<b>Quatre espaces</b>, un par usage. La première s’ouvre en <b>plein écran</b> ; les trois autres se déroulent plus bas.',
      actions: '<button type="button" class="pil plein" data-interne data-stub="' + STUB('Créer une fiche') + '">' + J.ico('plus') + 'Nouvelle fiche</button><button type="button" class="pil contour" data-interne data-stub="' + STUB('Écrire un post') + '">' + J.ico('edit') + 'Nouveau post</button>',
      recherche: { id: 'mk-q', placeholder: 'Fiche, document, post…', aria: 'Rechercher dans l’espace Marketing', valeur: E.q },
      bas: (derniere ? '<span class="lbl">' + J.ico('check', '#fff') + '<span>Dernière fiche prête à présenter, le ' + esc(derniere.date) + ' : <b>' + esc(derniere.titre) + '</b></span></span>' : '') + '<a class="chip mk-chip-b" href="#marketing-detail">Ouvrir mes fiches ' + J.ico('chev') + '</a>'
    }) +
    '<h2 class="titre-s">' + J.T('Vos supports<span class="st">les fiches prêtes à vous être présentées au comptoir</span>', 'Quatre espaces<span class="st">un clic sur une porte ouvre l’espace choisi</span>') + '</h2>' +
    '<div class="mk-portes entre">' + M.portes.map(porte).join('') + '</div>' +
    '<section class="carte mk-sec" id="mk-reperes" data-interne><div class="tete"><div><h2>Repères</h2><p class="st">présentations et maquettes de l’équipe · s’ouvrent dans un nouvel onglet</p></div><button type="button" class="pil" data-stub="' + STUB('Voir toutes les présentations') + '">' + J.ico('layers') + 'Toutes les présentations</button></div><div class="mk-reps entre" id="mk-rep-l"></div></section>' +
    '<div class="gdouble stack mk-stack">' +
      '<section class="carte mk-sec" id="mk-docs" data-interne><div class="tete"><div><h2>Documents partagés</h2><p class="st">les PDF, images et modèles de l’équipe · les plus utilisés en tête</p></div><a class="pil" href="#mallette">' + J.ico('folder') + 'Tous les documents</a></div>' +
        '<div class="chips mk-dossiers" role="group" aria-label="Dossiers"><button type="button" class="chip" data-dossier="" aria-pressed="' + !E.dossier + '">Tous les dossiers</button>' + DOSSIERS.map(function (k) { return '<button type="button" class="chip" data-dossier="' + esc(k) + '" aria-pressed="' + (E.dossier === k) + '">' + esc(k) + '</button>'; }).join('') + '</div><div class="mk-docs entre" id="mk-docs-l"></div></section>' +
      '<section class="carte mk-sec" id="mk-site" data-interne><div class="tete"><div><h2>Le nouveau site</h2><p class="st">la maquette, l’accueil et la page RSE · ouverture en plein cadre</p></div></div><div class="mk-pages entre">' + pagesSite() + '</div>' +
        '<div class="chips mk-chips"><button type="button" class="chip" data-stub="' + STUB('Ouvrir la banque d’effets') + '">' + J.ico('spark') + 'Banque d’effets</button><button type="button" class="chip" data-stub="' + STUB('Ouvrir les propositions') + '">' + J.ico('bulb') + 'Propositions</button></div></section>' +
    '</div>' +
    '<section class="carte mk-sec mk-li" id="mk-linkedin" data-interne><div class="tete"><div><h2>LinkedIn · le plan de la semaine</h2><p class="st">un post par jour prévu, son état · la veille et les modèles sont à côté</p></div><div class="chips"><button type="button" class="chip" data-stub="' + STUB('Ouvrir la veille LinkedIn') + '">' + J.ico('eye') + 'Veille</button><button type="button" class="chip" data-stub="' + STUB('Ouvrir les modèles de posts') + '">' + J.ico('note') + 'Modèles</button></div></div>' +
      '<table class="tabl mk-tab"><thead><tr><th>Jour</th><th>Post</th><th>État</th><th></th></tr></thead><tbody id="mk-posts"></tbody></table></section>' +
    '<p class="note mk-note" data-interne>Espace interne : le pharmacien ne voit que le support qu’on lui remet.</p>' +
    '</div>';
    remplirMarketing(el);
    $('#mk-q', el).oninput = function (e) { E.q = e.target.value; remplirMarketing(el); };
    $$('[data-dossier]', el).forEach(function (b) { b.onclick = function () { E.dossier = b.getAttribute('data-dossier'); $$('[data-dossier]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); remplirMarketing(el); }; });
    $$('[data-porte]', el).forEach(function (a) { var k = a.getAttribute('data-porte'); if (k === 'supports') return;
      a.onclick = function (ev) { ev.preventDefault(); var t = $('#mk-' + (k === 'documents' ? 'docs' : k === 'site' ? 'site' : 'linkedin'), el); if (t) { var y = t.getBoundingClientRect().top + window.scrollY - 90; window.scrollTo(0, Math.max(0, y)); t.classList.add('mk-vise'); setTimeout(function () { t.classList.remove('mk-vise'); }, 1400); } }; });
  }
};
/* ====================================================================================================================
   #marketing-detail = SUPPORTS OFFICINE en plein écran : bandeau court, Mes fiches · Commencer · Prêts à présenter, Partir d'un rayon,
   tableau des fiches (titre, rayon, état, date) + aperçu de la fiche choisie, « Aussi dans cet espace ».
   ==================================================================================================================== */
/* en vue pharmacien, seules les fiches prêtes à présenter existent : l'onglet effectif est « prêts », les brouillons disparaissent */
function onglet() { return pharmacien() ? 'prets' : E.onglet; }
function fichesVisibles() { return M.fiches.filter(function (f) { if (onglet() === 'prets' && f.etat !== 'Prête à présenter') return false; if (E.rayon && f.rayon !== E.rayon) return false; return chercheDans(f.titre + ' ' + f.rayon + ' ' + f.etat); }); }
function apercu(f) {
  if (!f) return '<div class="mk-apercu-vide"><p class="note">Choisissez une fiche dans la liste pour la voir ici.</p></div>';
  var prete = f.etat === 'Prête à présenter';
  return '<div class="mk-feuille" aria-hidden="true"><i class="mk-f-ban"></i><i class="mk-f-titre"></i><i></i><i></i><i class="mk-f-court"></i><span class="mk-f-grille"><i></i><i></i><i></i><i></i><i></i><i></i></span></div>' +
    '<h3>' + esc(f.titre) + '</h3><div class="mk-ap-meta"><span class="chip mk-rayon-chip">' + esc(f.rayon) + '</span>' + etatFiche(f.etat) + '</div>' +
    '<p class="note mk-ap-note">Format : PDF A4, le prix public seul, rien d’interne. Elle se présente au comptoir sur l’écran, se télécharge, ou part dans le mail de la To do list.</p>' +
    '<div class="ronds mk-ronds">' + rond('present', 'Présenter', STUB('Présenter au comptoir'), prete) + rond('doc', 'PDF', STUB('Télécharger le PDF')) + rond('send', 'Envoyer', STUB('Envoyer au pharmacien')) + rond('edit', 'Modifier', STUB('Ouvrir l’éditeur de la fiche'), 0, ' data-interne') + '</div>';
}
function remplirSupports(el) {
  var l = fichesVisibles(), corps = $('#mk-fiches', el);
  if (E.fiche >= l.length) E.fiche = 0;
  corps.innerHTML = l.length ? l.map(function (f, i) { return '<tr class="mk-l' + (i === E.fiche ? ' lu' : '') + '" data-fiche="' + i + '" tabindex="0" role="button" aria-label="Voir la fiche ' + esc(f.titre) + '" style="--i:' + i + '"><td data-l="Fiche"><b class="mk-fiche-t">' + esc(f.titre) + '</b><span class="sub">' + esc(f.rayon) + '</span></td><td data-l="État">' + etatFiche(f.etat) + '</td><td data-l="Modifiée le" class="num">' + esc(f.date) + '</td><td class="chev">' + J.ico('chev') + '</td></tr>'; }).join('')
    : '<tr><td colspan="4" class="mk-vide">Aucune fiche ' + (E.rayon ? 'dans le rayon « ' + esc(E.rayon) + ' »' : '') + (E.q ? ' pour « ' + esc(E.q) + ' »' : '') + '. <a href="#marketing-detail" data-raz>Tout afficher</a></td></tr>';
  $('#mk-apercu', el).innerHTML = apercu(l[E.fiche]);
  $('#mk-cpt', el).textContent = (onglet() === 'prets' ? 'prêtes à présenter au comptoir' : 'toutes vos fiches') + (E.rayon ? ' · rayon ' + E.rayon : '') + (E.q ? ' · « ' + E.q + ' »' : '') + ' · la plus récente en tête';
  $$('[data-fiche]', corps).forEach(function (tr) { var go = function () { E.fiche = +tr.getAttribute('data-fiche'); remplirSupports(el); }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }; });
  var raz = $('[data-raz]', corps); if (raz) raz.onclick = function (ev) { ev.preventDefault(); E.rayon = ''; E.q = ''; $('#mk-q2', el).value = ''; $$('[data-rayon]', el).forEach(function (b) { b.setAttribute('aria-pressed', String(!b.getAttribute('data-rayon'))); }); remplirSupports(el); };
  J.poseIcones(el);
}
function rendreSupports(el) {
  window.scrollTo(0, 0);   // le routeur garde le défilement sur les adresses « -detail » : la fiche s'ouvre en haut, pas à la hauteur de la porte cliquée
  var nb = M.fiches.length, pretes = M.fiches.filter(function (f) { return f.etat === 'Prête à présenter'; }).length;
  el.innerHTML = '<div class="page mk mk-det">' + J.bandeau({
    classe: 'mk-ban-d', eyebrow: 'Marketing · Supports officine · ' + J.T('les fiches à vous présenter', 'l’atelier des fiches'), titre: 'Supports officine',
    lede: J.T('<b>' + pretes + ' fiches</b> prêtes à vous être présentées au comptoir : le prix public seul, rien d’interne.', '<b>' + nb + ' fiches</b> dans votre atelier, dont <b>' + pretes + ' prêtes</b> à présenter au comptoir. Une nouvelle se prépare en deux minutes.'),
    /* gabarit des fiches de détail (ban-fiche) : la ligne de commande (retour, action) à gauche, sous le titre, puis le champ */
    recherche: '<div class="f-outils"><button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Marketing</button><button type="button" class="pil contour" data-interne data-stub="' + STUB('Créer une fiche') + '">' + J.ico('plus') + 'Nouvelle fiche</button></div>' +
      '<label class="rech-g">' + J.ico('search') + '<input id="mk-q2" type="search" placeholder="Une fiche, un rayon…" aria-label="Rechercher une fiche" value="' + esc(E.q || '') + '" autocomplete="off"></label>',
    bas: '<span class="lbl" data-interne>Afficher :</span><div class="seg" role="group" aria-label="Afficher" data-interne>' + [['fiches', 'Mes fiches'], ['commencer', 'Commencer'], ['prets', '<span>Prêts<span class="long"> à présenter</span></span>']].map(function (o) { return '<button type="button" data-onglet="' + o[0] + '" aria-pressed="' + (E.onglet === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>'
  }) +
  '<h2 class="titre-s" data-interne>Partir d’un rayon<span class="st">une fiche part toujours d’un rayon du catalogue</span></h2>' +
  '<div class="chips mk-rayons" data-interne><button type="button" class="chip" data-rayon="" aria-pressed="' + !E.rayon + '">Tous les rayons</button>' + M.rayons.map(function (r) { return '<button type="button" class="chip" data-rayon="' + esc(r) + '" aria-pressed="' + (E.rayon === r) + '">' + esc(r) + '</button>'; }).join('') + '</div>' +
  (onglet() === 'commencer' ? '<div class="mk-etapes entre" data-interne>' + [['1', 'Choisir un rayon', 'Les pastilles ci-dessus : la fiche reprend les produits du rayon, au prix public.', 'layers', 'Choisir le rayon'], ['2', 'Choisir les produits', (NB_ETAB ? 'Dans le catalogue des ' + NB_ETAB + ' établissements' : 'Dans le catalogue, établissement par établissement') + ' : une case par produit, le stock à côté.', 'box', 'Ouvrir le catalogue'], ['3', 'Présenter ou envoyer', 'Au comptoir sur l’écran, en PDF, ou dans le mail de la To do list.', 'present', 'Voir un exemple']].map(function (s, i) {
      return '<section class="carte mk-etape" style="--i:' + i + '"><span class="mk-num num">' + s[0] + '</span><span class="rond gris">' + ico(s[3]) + '</span><h3>' + s[1] + '</h3><p class="note">' + s[2] + '</p>' + (s[0] === '2' ? '<a class="pil" href="#produits">' + J.ico('box') + s[4] + '</a>' : '<button type="button" class="pil" data-stub="' + STUB(s[4]) + '">' + s[4] + '</button>') + '</section>'; }).join('') + '</div>' : '') +
  '<div class="gdouble stack mk-stack">' +
    '<section class="carte mk-sec mk-tabf" aria-label="Mes fiches"><div class="tete"><div><h2>' + (onglet() === 'prets' ? 'Prêts à présenter' : 'Mes fiches') + '</h2><p class="st" id="mk-cpt"></p></div></div><table class="tabl mk-tab"><thead><tr><th>Fiche<span class="st">titre · rayon</span></th><th>État</th><th class="num">Modifiée le</th><th></th></tr></thead><tbody id="mk-fiches"></tbody></table></section>' +
    '<section class="carte mk-sec mk-apercu-c" aria-label="Aperçu de la fiche" id="mk-apercu"></section>' +
  '</div>' +
  '<section class="carte mk-sec" data-interne><div class="tete"><div><h2>Aussi dans cet espace</h2><p class="st">ce que l’atelier des fiches sait faire d’autre</p></div></div><div class="chips">' +
    '<button type="button" class="chip" data-stub="' + STUB('Ouvrir Catalogue & prix par catégorie') + '">' + J.ico('table') + 'Voir le catalogue par catégorie</button><a class="chip" href="#todo">' + J.ico('mail') + 'Joindre une sélection au mail</a><button type="button" class="chip" data-stub="' + STUB('Ouvrir l’éditeur') + '">' + J.ico('edit') + 'Ouvrir l’éditeur d’une fiche</button><button type="button" class="chip" data-stub="' + STUB('Filtrer par disponibilité et établissement') + '">' + J.ico('filtre') + 'Filtrer par disponibilité</button></div></section>' +
  '</div>';
  remplirSupports(el);
  $('#mk-q2', el).oninput = function (e) { E.q = e.target.value; remplirSupports(el); };
  $$('[data-onglet]', el).forEach(function (b) { b.onclick = function () { E.onglet = b.getAttribute('data-onglet'); E.fiche = 0; J.route(); }; });
  $$('[data-rayon]', el).forEach(function (b) { b.onclick = function () { E.rayon = b.getAttribute('data-rayon'); E.fiche = 0; $$('[data-rayon]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); remplirSupports(el); }; });
}
})();
