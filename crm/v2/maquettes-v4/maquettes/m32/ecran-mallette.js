/* La Mallette (#mallette) et l'aperçu du mail (#mallette-detail). Tout interne ([data-interne] + avis .vp).
   Bandeau à croix et de recherche, cartes blanches, boutons ronds ; documents en tableau à filets, récapitulatif
   en clé-valeur, aperçu du mail en carte d'identité. Données : J.X.mallette (documents : nom, type, taille ; destinataires : ids d'officines ; mail), J.D.officines
   (noms, villes, e-mails de J.ficheDe), fictives. État en mémoire (J.S.mallette) : cases cochées, destinataires, objet et corps, un seul PDF ou séparés, listing
   fabriqué — rien n'est envoyé. Les nombres : compteurs du segment par genre, récapitulatif (documents cochés, poids, officines), nombre de produits du listing. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, X = J.X, S = J.S, OFF = J.OFF;
var ML = X.mallette, PERS = X.personne || {};
var GENRES = [['tous', 'Tous'], ['catalogue', 'Catalogues'], ['fiche', 'Fiches'], ['pasapas', 'Pas-à-pas'], ['listing', 'Listings']], GL = { catalogue: 'Catalogue', fiche: 'Fiche', pasapas: 'Pas-à-pas', listing: 'Listing', autre: 'Document' };
var CLIENTES = OFF.filter(function (o) { return o.statut !== 'prospect'; });
function genreDe(nom) { var n = nom.toLowerCase(); return /^catalogue/.test(n) ? 'catalogue' : /^fiche/.test(n) ? 'fiche' : /^pas-/.test(n) ? 'pasapas' : /^listing/.test(n) ? 'listing' : 'autre'; }
function ko(t) { var m = String(t).replace(',', '.').match(/([\d.]+)\s*(Mo|Ko|Go)/i); if (!m) return 0; var v = parseFloat(m[1]), u = m[2].toLowerCase(); return u === 'go' ? v * 1e6 : u === 'mo' ? v * 1000 : v; }
function poids(k) { return k >= 1000 ? nf1.format(k / 1000) + ' Mo' : nf.format(Math.round(k)) + ' Ko'; }
/* texte du mail par défaut : celui des données, accordé aux pièces jointes cochées par défaut (le listing du réseau, pas celui d'un groupe d'achat :
   les destinataires sont de deux groupes différents). */
var CORPS0 = String(ML.mail.corps).replace(/le listing de votre groupe d[’']achat/, 'le listing du réseau Intégral');
var K = S.mallette = S.mallette || { q: '', genre: 'tous', docs: null, coches: null, dest: null, mode: 'un', objet: ML.mail.objet, corps: CORPS0, fab: false, fabOff: null, fabBase: 'groupe' };
function init() { if (K.docs) return; K.docs = ML.documents.map(function (d) { return { nom: d.nom, type: d.type, taille: d.taille }; }); K.coches = {}; K.docs.forEach(function (d) { if (/^catalogue intégral|^listing/i.test(d.nom)) K.coches[d.nom] = true; }); K.dest = ML.destinataires.filter(function (id) { return !!J.offById(id); }); K.fabOff = K.dest[0] || CLIENTES[0].id; }
function coches() { return K.docs.filter(function (d) { return K.coches[d.nom]; }); }
function visibles() { var q = K.q.trim().toLowerCase(); return K.docs.filter(function (d) { return (K.genre === 'tous' || genreDe(d.nom) === K.genre) && (!q || d.nom.toLowerCase().indexOf(q) >= 0); }); }
var EL = document.getElementById('ecran-mallette');
function re() { var y = window.scrollY; J.ecrans.mallette.rendre(EL, J.courant); window.scrollTo(0, y); }
/* ---------- 1 · les documents (tableau à cases de 44 px) ---------- */
function ligneDoc(d, i) { var on = !!K.coches[d.nom], g = genreDe(d.nom);
  return '<tr class="ml-l' + (on ? ' on' : '') + '" data-doc="' + esc(d.nom) + '" style="--i:' + Math.min(i, 10) + '"><td class="ml-case"><button type="button" role="checkbox" aria-checked="' + on + '" class="ml-cb" aria-label="' + (on ? 'Retirer de l’envoi : ' : 'Ajouter à l’envoi : ') + esc(d.nom) + '"><i>' + (on ? J.icoSvg('coche') : '') + '</i></button></td>' +
    '<td data-l="Document"><div class="ml-doc"><span class="ml-ico">' + J.ico('doc') + '</span><div class="ml-doc-t"><b class="ml-nom">' + esc(d.nom) + '</b><span class="sub">' + GL[g] + (d.neuf ? ' · fabriqué à l’instant' : '') + '</span></div></div></td>' +
    '<td class="num" data-l="Taille"><b>' + esc(d.taille) + '</b></td>' +
    '<td class="ml-act"><button type="button" class="b-rond" aria-label="Aperçu : ' + esc(d.nom) + '" data-stub="L’aperçu du document n’est pas dessiné dans cette maquette.">' + J.ico('eye') + '</button></td></tr>'; }
function tableDocs() { var V = visibles();
  return '<table class="tabl ml-tab"><thead><tr><th class="ml-case"><span class="ml-vh">Envoyer</span></th><th>Document<span class="st">nom · genre</span></th><th class="num">Taille</th><th></th></tr></thead><tbody id="ml-corps">' +
    (V.length ? V.map(ligneDoc).join('') : '<tr><td colspan="4" class="ml-vide-l">Aucun document ne correspond' + (K.q ? ' à « ' + esc(K.q) + ' »' : '') + '.</td></tr>') + '</tbody></table>'; }
/* ---------- fabriquer un listing (base réseau ou groupe d'achat de l'officine, nombre de produits lu dans la fiche) ---------- */
function tailleListing(n) { var ref = null; K.docs.forEach(function (d) { var m = d.nom.match(/^Listing.*?(\d[\d\s]*)\s*produits/i); if (m && !ref) ref = { n: parseInt(m[1].replace(/\s/g, ''), 10), ko: ko(d.taille) }; }); return poids(ref && ref.n ? n * ref.ko / ref.n : n * 1.5); }
function fabHtml() { var o = J.offById(K.fabOff) || CLIENTES[0], Fi = J.ficheDe(o.id), sans = o.groupement === 'Sans groupement', base = K.fabBase === 'reseau' ? 'Réseau Intégral' : (sans ? 'Groupe d’achat' : o.groupement);
  var n = K.fabBase === 'reseau' ? Fi.aProposer.reseau.nbProduits : Fi.aProposer.groupeAchat.nbProduits, LR = K.fabBase === 'reseau' ? listingReseau() : null;
  /* en base réseau, le listing est le même pour toutes les officines : s'il est déjà dans la mallette, le volet le dit et propose de le cocher (sans en fabriquer un second) */
  var geste = LR ? '<div class="ml-fab-ap"><span class="rond gris">' + J.ico('list') + '</span><div class="ml-fab-t"><b>Le listing du réseau est déjà dans la mallette</b><span class="sub">le même pour toutes les officines · il figure dans la liste des documents</span></div>' +
      (K.coches[LR.nom] ? '<span class="etat">' + J.ico('check', 'var(--e-bien)') + 'Coché pour l’envoi</span>' : '<button type="button" class="pil plein" data-fab-coche>' + J.ico('coche') + 'Le cocher</button>') + '</div>'
    : '<div class="ml-fab-ap"><span class="rond gris">' + J.ico('list') + '</span><div class="ml-fab-t"><b>Listing ' + esc(base) + ' · ' + nf.format(n) + ' produits</b><span class="sub">PDF · classé par part des officines qui commandent chaque produit · pour ' + esc(J.joli(o.nom)) + '</span></div><button type="button" class="pil plein" data-fab-go="' + esc('Listing ' + base + ' · ' + nf.format(n) + ' produits') + '" data-n="' + n + '">' + J.ico('plus') + 'Fabriquer et ajouter</button></div>';
  return '<section class="carte ml-fab" id="ml-fab" aria-label="Fabriquer un listing"><div class="tete"><div><h2>Fabriquer un listing</h2><p class="st">la liste d’achats idéale d’une officine, fondée sur ce que commandent les officines de sa base · prête à joindre</p></div><button type="button" class="b-rond" data-fab-fermer aria-label="Fermer">' + J.ico('close') + '</button></div>' +
    '<div class="ml-fab-g"><label class="filtre">Pour<select id="ml-fab-off" aria-label="Officine du listing">' + CLIENTES.map(function (c) { return '<option value="' + c.id + '"' + (c.id === o.id ? ' selected' : '') + '>' + esc(J.joli(c.nom)) + '</option>'; }).join('') + '</select></label>' +
    '<div class="seg" role="group" aria-label="Base du listing"><button type="button" data-fabbase="groupe" aria-pressed="' + (K.fabBase === 'groupe') + '">' + J.ico('group') + (sans ? 'Groupe d’achat' : esc(o.groupement)) + '</button><button type="button" data-fabbase="reseau" aria-pressed="' + (K.fabBase === 'reseau') + '">' + J.ico('net') + 'Réseau Intégral</button></div></div>' + geste + '</section>'; }
function listingReseau() { return K.docs.filter(function (d) { return /^listing réseau/i.test(d.nom); })[0] || null; }
/* ---------- 2 · 3 · 4 : destinataires, mail, un seul PDF ou séparés, récapitulatif ---------- */
/* destinataires : toutes les officines du relevé, prospects compris (la fiche d'ouverture de compte est faite pour eux), signalés « · prospect » */
function destHtml() { var libres = OFF.filter(function (c) { return K.dest.indexOf(c.id) < 0; }), pro = function (c) { return c.statut === 'prospect' ? ' · prospect' : ''; };
  return K.dest.map(function (id) { var o = J.offById(id); return '<span class="ml-chip"><span class="ml-av" aria-hidden="true">' + esc(J.ini(o.nom)) + '</span><span class="ml-chip-t"><b>' + esc(J.joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + (o.groupement !== 'Sans groupement' ? ' · ' + esc(o.groupement) : '') + pro(o) + '</span></span><button type="button" class="b-rond ml-x" data-ret="' + id + '" aria-label="Retirer ' + esc(J.joli(o.nom)) + '">' + J.ico('close') + '</button></span>'; }).join('') +
    (K.dest.length ? '' : '<p class="note">Aucune officine : choisissez-en une ci-dessous.</p>') +
    '<label class="filtre ml-add">' + J.ico('plus') + '<select id="ml-add" aria-label="Ajouter une officine"><option value="">Ajouter une officine…</option>' + libres.map(function (c) { return '<option value="' + c.id + '">' + esc(J.joli(c.nom)) + ' · ' + esc(c.ville) + pro(c) + '</option>'; }).join('') + '</select></label>'; }
function recapHtml() { var sel = coches(), tot = sel.reduce(function (s, d) { return s + ko(d.taille); }, 0);
  return J.kv([['Documents cochés', sel.length ? nf.format(sel.length) + ' document' + (sel.length > 1 ? 's' : '') : '<span class="ml-vide">aucun · cochez dans la liste</span>'],
    ['Poids de l’envoi', sel.length ? poids(tot) + (K.mode === 'un' ? ' · un seul PDF' : ' · pièces séparées') : ''],
    ['Officines', K.dest.length ? nf.format(K.dest.length) + ' destinataire' + (K.dest.length > 1 ? 's' : '') + ' · un mail chacune' : '<span class="ml-vide">aucune</span>']], 'serree'); }
function envoiHtml() {
  return '<section class="carte ml-envoi" aria-label="Votre envoi"><div class="tete"><div><h2>Votre envoi</h2><p class="st">se compose à mesure que vous cochez</p></div></div>' +
    '<h3 class="ml-h3"><span class="ml-num">2</span>À qui envoyez-vous ?</h3><div class="ml-dest" id="ml-dest">' + destHtml() + '</div>' +
    '<h3 class="ml-h3"><span class="ml-num">3</span>Le mail pour votre client</h3><label class="ml-lab">Objet<input id="ml-objet" type="text" value="' + esc(K.objet) + '" autocomplete="off"></label><label class="ml-lab">Texte<textarea id="ml-texte" rows="5">' + esc(K.corps) + '</textarea></label>' +
    '<h3 class="ml-h3"><span class="ml-num">4</span>Comment ?</h3><div class="seg ml-mode" role="group" aria-label="Forme de l’envoi"><button type="button" data-mode="un" aria-pressed="' + (K.mode === 'un') + '">' + J.ico('layers') + 'Un seul PDF</button><button type="button" data-mode="sep" aria-pressed="' + (K.mode === 'sep') + '">' + J.ico('clip') + 'Séparés</button></div>' +
    '<p class="note ml-mode-n">' + (K.mode === 'un' ? 'Les documents cochés sont fusionnés en un seul fichier, dans l’ordre de la liste : une pièce jointe par mail.' : 'Chaque document coché reste un fichier à part : plusieurs pièces jointes par mail.') + '</p>' +
    '<div class="ml-recap" id="ml-recap">' + recapHtml() + '</div>' +
    '<div class="ml-cta"><button type="button" class="pil plein ml-go" data-go>' + J.ico('eye') + 'Aperçu et envoi</button><button type="button" class="pil" data-stub="L’enregistrement d’un modèle d’envoi n’est pas dessiné dans cette maquette.">' + J.ico('star') + 'Garder comme modèle</button></div></section>'; }
/* ---------- l'écran principal ---------- */
function principal(el) {
  var cpt = {}; K.docs.forEach(function (d) { var g = genreDe(d.nom); cpt[g] = (cpt[g] || 0) + 1; cpt.tous = (cpt.tous || 0) + 1; });
  var G2 = GENRES.filter(function (g) { return cpt[g[0]]; });
  el.innerHTML = '<div class="page ml-page">' + J.bandeau({
    croix: true, eyebrow: '<span data-interne>Mallette · ce que vous remettez à vos clients</span><span class="vp">Outil interne · vue pharmacien</span>', titre: 'Mallette',
    lede: 'Choisissez les <b>documents</b>, les <b>officines</b> qui les reçoivent et le <b>mail</b> qui les accompagne. Tout part en <b>un seul PDF</b> ou en pièces <b>séparées</b>.',
    actions: '<button type="button" class="pil' + (K.fab ? ' contour' : '') + '" data-fab>' + J.ico('list') + 'Fabriquer un listing</button><button type="button" class="pil" data-stub="L’ajout d’un document depuis votre ordinateur n’est pas dessiné dans cette maquette.">' + J.ico('plus') + 'Ajouter un document</button>',
    recherche: { id: 'ml-q', placeholder: window.innerWidth <= 760 ? 'Chercher un document' : 'Un document : catalogue, fiche, pas-à-pas, listing…', aria: 'Chercher un document de la mallette', valeur: K.q },
    /* le segment à cinq cases ne tient pas sur une ligne à 390 px : il passe sur deux lignes (le menu de repli n'est plus montré) */
    bas: '<span class="lbl">Afficher :</span><div class="seg ml-seg" role="group" aria-label="Genre de document">' + G2.map(function (g) { return '<button type="button" data-genre="' + g[0] + '" aria-pressed="' + (K.genre === g[0]) + '">' + g[1] + ' <span class="cnt">' + nf.format(cpt[g[0]]) + '</span></button>'; }).join('') + '</div>' +
      '<label class="filtre ml-genre-m">Afficher<select id="ml-genre" aria-label="Genre de document">' + G2.map(function (g) { return '<option value="' + g[0] + '"' + (K.genre === g[0] ? ' selected' : '') + '>' + g[1] + ' · ' + nf.format(cpt[g[0]]) + '</option>'; }).join('') + '</select></label>'
  }) +
  '<p class="vp note ml-vp">Vue pharmacien : la mallette est votre outil d’envoi, elle n’a rien à lui montrer. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>' +
  '<div class="ml-grille" data-interne><div class="ml-col entre">' + (K.fab ? fabHtml() : '') +
    '<section class="carte ml-docs" aria-label="Les documents à envoyer"><div class="tete"><div><h3 class="ml-h3"><span class="ml-num">1</span>Les documents à envoyer</h3><p class="st">cochez ce qui part · catalogues, fiches, pas-à-pas et listings, les vôtres et ceux de l’équipe</p></div></div>' + tableDocs() + '</section></div>' +
  '<div class="ml-col ml-droite entre">' + envoiHtml() + '</div></div></div>';
  J.poseIcones(el);
  /* vue pharmacien : la phrase, les actions, la recherche et le choix du genre (à compteurs) sont internes, comme sur les écrans To do et Appro */
  $$('.bandeau .lede,.ban-act,.rech-g,.ban-bas', el).forEach(function (e) { e.setAttribute('data-interne', ''); });
  $('#ml-q', el).oninput = function (e) { K.q = e.target.value; $('#ml-corps', el).innerHTML = (visibles().length ? visibles().map(ligneDoc).join('') : '<tr><td colspan="4" class="ml-vide-l">Aucun document ne correspond à « ' + esc(K.q) + ' ».</td></tr>'); lierDocs(el); };
  $$('[data-genre]', el).forEach(function (b) { b.onclick = function () { K.genre = b.getAttribute('data-genre'); re(); }; });
  $('#ml-genre', el).onchange = function (e) { K.genre = e.target.value; re(); };
  var fc = $('[data-fab-coche]', el); if (fc) fc.onclick = function () { var lr = listingReseau(); if (lr) K.coches[lr.nom] = true; K.fab = false; re(); J.toast('Le listing du réseau est coché pour l’envoi.'); };
  $$('[data-fab]', el).forEach(function (b) { b.onclick = function () { K.fab = !K.fab; re(); if (K.fab) { var f = $('#ml-fab'); if (f) { var y = f.getBoundingClientRect().top + window.scrollY - 100; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); } } }; });
  var ff = $('[data-fab-fermer]', el); if (ff) ff.onclick = function () { K.fab = false; re(); };
  var fo = $('#ml-fab-off', el); if (fo) fo.onchange = function (e) { K.fabOff = e.target.value; re(); };
  $$('[data-fabbase]', el).forEach(function (b) { b.onclick = function () { K.fabBase = b.getAttribute('data-fabbase'); re(); }; });
  var fg = $('[data-fab-go]', el); if (fg) fg.onclick = function () { var nom = fg.getAttribute('data-fab-go'), n = +fg.getAttribute('data-n'); if (!K.docs.some(function (d) { return d.nom === nom; })) K.docs.push({ nom: nom, type: 'PDF', taille: tailleListing(n), neuf: true }); K.coches[nom] = true; K.fab = false; K.genre = 'tous'; K.q = ''; re(); J.toast('Listing fabriqué et coché dans la mallette.'); };
  $$('[data-ret]', el).forEach(function (b) { b.onclick = function () { K.dest = K.dest.filter(function (id) { return id !== b.getAttribute('data-ret'); }); re(); }; });
  $('#ml-add', el).onchange = function (e) { if (e.target.value) { K.dest.push(e.target.value); re(); } };
  $('#ml-objet', el).oninput = function (e) { K.objet = e.target.value; };
  $('#ml-texte', el).oninput = function (e) { K.corps = e.target.value; };
  $$('[data-mode]', el).forEach(function (b) { b.onclick = function () { K.mode = b.getAttribute('data-mode'); re(); }; });
  $('[data-go]', el).onclick = function () { if (!coches().length) { J.toast('Cochez au moins un document avant l’aperçu.'); return; } if (!K.dest.length) { J.toast('Ajoutez au moins une officine destinataire.'); return; } J.aller('mallette-detail'); };
  lierDocs(el);
}
function lierDocs(el) { $$('.ml-cb', el).forEach(function (b) { b.onclick = function () { var nom = b.closest('tr').getAttribute('data-doc'); if (K.coches[nom]) delete K.coches[nom]; else K.coches[nom] = true; var y = window.scrollY; var tb = $('#ml-corps', el); tb.innerHTML = visibles().map(ligneDoc).join(''); $('#ml-recap', el).innerHTML = recapHtml(); J.poseIcones(el); lierDocs(el); window.scrollTo(0, y); }; }); }
/* ---------- #mallette-detail : l'aperçu du mail, tel qu'il partira ---------- */
/* « Avant d'envoyer » : des contrôles faits pour de bon, à chaque ouverture de l'aperçu, sur l'objet et le texte tapés (mot à éviter, montant, pourcentage)
   et sur les adresses des destinataires — jamais une coche écrite d'avance */
var MOT_EVITE = /\b(remises?|rabais|ristournes?)\b/i, TARIF = /\d[\d\s.,]*\s?(€|euros?\b|%|pour\s?cent)/i;
function controles(sel, dests) {
  var txt = K.objet + ' ' + K.corps, mot = txt.match(MOT_EVITE), prix = txt.match(TARIF), sansMail = dests.filter(function (d) { return !(d.Fi && d.Fi.identite && d.Fi.identite.email); });
  var li = function (ok, t) { return '<li>' + J.ico(ok ? 'check' : 'bell', ok ? 'var(--e-bien)' : 'var(--e-attention)') + '<span>' + t + '</span></li>'; };
  return li(sel.length, sel.length ? 'Les pièces jointes viennent de la mallette : des documents faits pour être remis au pharmacien.' : 'Aucun document coché.') +
    li(dests.length && !sansMail.length, !dests.length ? 'Aucune officine destinataire.' : sansMail.length ? 'Sans adresse e-mail connue : ' + sansMail.map(function (d) { return esc(J.joli(d.o.nom)); }).join(', ') + '.' : 'Chaque officine a une adresse e-mail connue.') +
    li(!mot && !prix, mot ? 'Le texte emploie « ' + esc(mot[0]) + ' » : écrivez « abandon de marge ».' : prix ? 'Le texte cite « ' + esc(prix[0].trim()) + ' » : un mail au pharmacien ne donne aucun tarif.' : 'Ni tarif, ni pourcentage, ni mot à éviter dans l’objet et le texte.');
}
function detail(el) {
  window.scrollTo(0, 0);   /* le socle garde le défilement sur les adresses -detail : l'aperçu s'ouvre en haut, sur l'objet et les destinataires */
  var sel = coches(), tot = sel.reduce(function (s, d) { return s + ko(d.taille); }, 0), dests = K.dest.map(function (id) { var o = J.offById(id); return { o: o, Fi: J.ficheDe(id) }; }), pret = sel.length && dests.length;
  var pj = K.mode === 'un' ? '<li class="ml-pj-l"><span class="ml-ico">' + J.ico('layers') + '</span><div><b>Mallette-Integral.pdf</b><span class="sub">un seul fichier : ' + sel.map(function (d) { return esc(d.nom); }).join(' · ') + '</span></div><b class="num ml-pj-p">' + poids(tot) + '</b></li>'
    : sel.map(function (d) { return '<li class="ml-pj-l"><span class="ml-ico">' + J.ico('doc') + '</span><div><b>' + esc(d.nom) + '</b><span class="sub">' + esc(d.type) + '</span></div><b class="num ml-pj-p">' + esc(d.taille) + '</b></li>'; }).join('');
  el.innerHTML = '<div class="page ml-page">' + J.bandeau({ classe: 'ml-ban-d', eyebrow: '<span data-interne>Mallette · aperçu du mail<span class="long"> · ' + esc(PERS.nom || '') + '</span></span><span class="vp">Outil interne · vue pharmacien</span>', titre: 'Le mail, tel qu’il partira',
    lede: 'Relisez l’objet, le texte et les pièces jointes. Chaque officine reçoit <b>son propre mail</b>, au même contenu.',
    recherche: '<div class="f-outils"><button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Modifier le mail</button></div>' }) +
  '<p class="vp note ml-vp">Vue pharmacien : l’aperçu du mail est interne. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>' +
  '<div class="ml-grille ml-grille-d" data-interne><section class="carte ml-mail entre" aria-label="Le mail"><div class="ml-mail-tete">' + J.kv([['De', esc(PERS.nom || '') + ' · Intégral Pharma'], ['À', dests.length ? dests.map(function (d) { return '<span class="ml-a"><b>' + esc(J.joli(d.o.nom)) + '</b> <span class="ml-mail-ad">' + esc(d.Fi.identite.email) + '</span></span>'; }).join('') : '<span class="ml-vide">aucune officine</span>'], ['Objet', '<span class="ml-objet">' + esc(K.objet) + '</span>']]) + '</div>' +
    '<div class="ml-corps-txt">' + esc(K.corps).replace(/\n/g, '<br>') + '<p class="ml-sign">' + esc(PERS.nom || '') + '<br><span>Intégral Pharma · groupe de grossistes-répartiteurs</span></p></div>' +
    '<h3 class="ml-pj-h">' + J.ico('clip') + 'Pièces jointes' + (sel.length ? '' : ' <span class="ml-vide">aucune</span>') + '</h3>' + (sel.length ? '<ul class="ml-pj">' + pj + '</ul>' : '<p class="note">Aucun document coché : revenez à la mallette avec « Modifier ».</p>') + '</section>' +
    '<aside class="ml-col"><section class="carte entre"><div class="tete"><div><h2>Avant d’envoyer</h2><p class="st">ce que JARVIS vérifie avant l’envoi</p></div></div><ul class="ml-check">' + controles(sel, dests) +
      '<li>' + J.ico('ext') + '<span>Le mail s’ouvre dans votre messagerie, prêt à partir : vous gardez la main.</span></li></ul>' +
      '<div class="ml-cta"><button type="button" class="pil plein"' + (pret ? ' data-stub="Dans l’appli réelle, le mail s’ouvre dans votre messagerie, prêt à partir. L’envoi n’est pas dessiné dans cette maquette."' : ' disabled aria-disabled="true"') + '>' + J.ico('mail') + 'Ouvrir dans ma messagerie</button><button type="button" class="pil" data-copier>' + J.ico('copy') + 'Copier le texte</button></div></section></aside></div></div>';
  J.poseIcones(el);
  $$('.bandeau .lede,.ban-act', el).forEach(function (e) { e.setAttribute('data-interne', ''); });   /* vue pharmacien : la phrase et « Modifier » sont internes */
  $('[data-copier]', el).onclick = function () { J.toast('Copié : « ' + K.objet + ' » et le texte du mail.'); };
}
J.ecrans.mallette = { rendre: function (el, etat) { init(); if (etat && etat.suite === 'detail') detail(el); else principal(el); } };
})();
