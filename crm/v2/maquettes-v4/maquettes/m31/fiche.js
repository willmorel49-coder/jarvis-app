/* m31 — fiche d'une officine : bandeau de vue, colonne d'identité bleue (boutons ronds), À proposer, Ses chiffres. La suite (courbe, marge, catégories…) est dans fiche-suite.js. */
(function () {
'use strict';
var J = window.J31, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, D = J.D, OFF = J.OFF, MOY = J.MOY, S = J.S;
var MOIS_LONG = { 'janv.': 'janvier', 'févr.': 'février', 'mars': 'mars', 'avr.': 'avril', 'mai': 'mai', 'juin': 'juin', 'juil.': 'juillet', 'août': 'août', 'sept.': 'septembre', 'oct.': 'octobre' };
J.ml = function (l) { return MOIS_LONG[l] || l; };
var T = J.T = function (vous, elle) { return S.vue === 'pharmacien' ? vous : elle; };
function ordre(n) { return n + (n === 1 ? 're' : 'e'); }
var BTN = function (ico, txt, stub, plein) { return '<button type="button" class="rond-act' + (plein ? ' plein' : '') + '" data-stub="' + stub + '"><span class="rond"><span class="ico" data-ico="' + ico + '"></span></span>' + txt + '</button>'; };
function lignesId(F, o) {
  var I = F.identite, cl = o.statut === 'prospect';
  return [['Ville', I.cp + ' ' + I.ville, 0], ['Adresse', I.adresse, 0], ['Titulaire', I.titulaires, 0], ['Groupement', I.groupement, 0],
    ['Pharmaciens', I.nbPharmaciens, 1], ['À savoir', I.aSavoir, 1], ['Téléphone', I.telephone, 1, 1], ['Portable', I.portable, 1], ['Fax', I.fax || '—', 1], ['E-mail', I.email, 1, 1],
    ['Logiciel', I.logiciel || 'inconnu', 1], ['Grossiste principal', I.grossistePrincipal, 1], ['Offilog', o.clientOffilog ? 'Cliente Offilog' : 'Non cliente', 1]]
    .filter(function (l) { return l[1]; })
    .map(function (l) { return '<div class="id-r"' + (l[2] ? ' data-interne' : '') + '><dt>' + l[0] + '</dt><dd>' + esc(l[1]) + (l[3] ? ' <span class="ico cp" data-ico="copy"></span>' : '') + '</dd></div>'; }).join('');
}
function listeProp(titre, sous, ico, n, arr, deux) {
  return '<div class="carte liste-prop" data-liste>' +
    '<div class="lp-tete"><span class="rond gris"><span class="ico" data-ico="' + ico + '"></span></span><div><h3>' + esc(titre) + '</h3><span class="sub">' + esc(sous) + '</span></div><div class="lp-n"><b class="num">' + nf.format(n) + '</b><span>produits</span></div></div>' +
    '<div class="lp-ronds">' + BTN('doc', 'PDF', 'Le téléchargement n’est pas dessiné dans cette maquette.') + BTN('down', 'Excel', 'Le téléchargement n’est pas dessiné dans cette maquette.') + BTN('send', 'Envoyer cette liste', 'L’envoi n’est pas dessiné dans cette maquette.', 1) + '<button type="button" class="pil lp-ouvre" data-stub="Le listing complet n’est pas dessiné dans cette maquette.">Ouvrir le listing</button></div>' +
    '<div class="lp-tab"><div class="lp-ent"><span>Produit</span><span>Officines qui le commandent</span></div>' +
    arr.map(function (p) { return '<div class="lp-l"><span class="lp-nom"><b>' + esc(p.nom.split(',')[0]) + '</b><span class="sub">' + esc(p.famille) + '</span></span><span class="lp-bar"><span class="bar12"><i style="width:' + p.partOfficines + '%"></i></span><span class="num">' + p.partOfficines + ' %</span></span></div>'; }).join('') + '</div></div>';
}
function barreCmp(lib, col, val, moy, fmt, txtMoy, pv, nomLong) {
  var ratio = moy ? val / moy : 0, top = Math.max(val, moy * 2) * 1.04, pv0 = val / top * 100, pm = moy / top * 100;
  return '<div class="cb"><div class="cb-t"><span class="cb-l"><span class="puce" style="background:' + col + '"></span><b>' + lib + '</b></span><span class="cb-v num">' + fmt(val) + '</span></div>' +
    (pv || !moy ? '' : '<div class="cb-pist" data-interne><i class="cb-b" style="width:' + pv0.toFixed(1) + '%;background:' + col + '"></i><i class="cb-m" style="left:' + pm.toFixed(1) + '%"></i></div><div class="cb-p" data-interne><span>' + txtMoy + '</span><b class="num">×' + nf1.format(ratio) + ' la moyenne</b></div>') + '</div>';
}
J.renderFiche = function () {
  var el = $('#ecran-fiche'), o = J.offById(S.off) || OFF[0], F = J.ficheDe(o.id), I = F.identite, pv = S.vue === 'pharmacien';
  var mois = F.moisLabels, cm = F.caParMois, last = cm[cm.length - 1], prev = cm[cm.length - 2], evo = prev ? Math.round((last - prev) / prev * 100) : 0, ratio = (F.ca / 10) / MOY.caMois;
  var clientes = OFF.filter(function (x) { return x.statut !== 'prospect'; }), idx = clientes.indexOf(o);
  var gen = 0, tot = 0; F.categories.forEach(function (c) { tot += c.montant; if (c.cle === 'generiques') gen = c.montant; });
  var partGen = tot ? Math.round(gen / tot * 100) : 0;
  var pm = F.margePharmacienParMois.reduce(function (a, b) { return a + b; }, 0) / 10, nm = F.margeNousParMois.reduce(function (a, b) { return a + b; }, 0) / 10;
  el.setAttribute('data-vue-actuelle', S.vue);
  el.innerHTML =
    '<div class="vuebar ' + (pv ? 'pharm' : '') + '"><span class="vb-ico"><span class="ico" data-ico="' + (pv ? 'eye' : 'lock') + '"></span></span><div class="vb-t"><b>' + (pv ? 'Vue pharmacien' : 'Vue Intégral') + '</b><span>' + (pv ? 'rien d’interne à l’écran, vous pouvez la lui montrer.' : 'notre marge, rentabilité, comparaison à nos clients, vos notes. À ne pas lui montrer.') + '</span></div>' +
    '<div class="seg" role="group" aria-label="Vue"><button type="button" data-vue="integral" aria-pressed="' + !pv + '">Vue Intégral</button><button type="button" data-vue="pharmacien" aria-pressed="' + pv + '">Vue pharmacien</button></div></div>' +
    '<div class="f-nav"><div class="f-pn" data-interne><button type="button" class="b-rond" data-pn="-1" aria-label="Officine précédente"><span class="ico" data-ico="back"></span></button><button type="button" class="b-rond" data-pn="1" aria-label="Officine suivante"><span class="ico" data-ico="chev"></span></button></div>' +
    '<label class="filtre" data-interne><span class="ico" data-ico="search"></span><select id="f-autre" aria-label="Autre officine"><option value="">Autre officine…</option>' + clientes.map(function (x) { return '<option value="' + x.id + '">' + esc(J.joli(x.nom)) + '</option>'; }).join('') + '</select></label>' +
    '<button type="button" class="pil plein f-brief" data-interne data-stub="Le brief du jour n’est pas dessiné dans cette maquette."><span class="ico" data-ico="chat"></span>Voir le brief du jour <b class="cpt7">7</b></button></div>' +
    '<div class="f-grille"><aside class="f-id" aria-label="Identité de l’officine"><div class="id-in">' +
    '<div class="id-haut"><span class="id-code">' + (pv ? 'FICHE OFFICINE' : 'CIP ' + I.cip + ' · ' + (o.statut === 'prospect' ? 'PROSPECT' : 'CLIENTE INTÉGRAL') + ' · ' + esc(D.secteur.commerciale)) + '</span><button type="button" class="pil clair" data-interne data-stub="La modification n’est pas dessinée dans cette maquette."><span class="ico" data-ico="edit"></span>Modifier</button></div>' +
    '<h1 class="id-nom">' + esc(J.joli(F.nom)) + '</h1><div class="id-etat">' + J.etatHtml(J.etatOff(o)) + '</div>' +
    '<div class="id-mois"><span class="id-ml">' + J.maj(J.ml(mois[mois.length - 1])) + ' 2026</span><b class="num">' + J.gros(eur(last)) + '</b><span class="id-evo"><span class="ico">' + J.icoSvg(evo < 0 ? 'bas' : 'haut') + '</span>' + J.signe(evo) + ' sur ' + J.ml(mois[mois.length - 2]) + '</span></div>' +
    '<dl class="id-l">' + lignesId(F, o) + '</dl>' +
    '<div class="id-act" data-interne>' + BTN('phone', 'Appeler', 'L’appel n’est pas dessiné dans cette maquette.', 1) + BTN('mail', 'E-mail', 'L’e-mail n’est pas dessiné dans cette maquette.') + BTN('cal', 'Rendez-vous', 'La proposition de rendez-vous n’est pas dessinée dans cette maquette.') + BTN('note', 'Note', 'La note n’est pas dessinée dans cette maquette.') + BTN('box', 'Produits', 'Le catalogue de cette officine n’est pas dessiné dans cette maquette.') + BTN('chart', 'Comparer D2P', 'La comparaison D2P n’est pas dessinée dans cette maquette.') + '</div>' +
    '</div></aside><div class="f-corps entre">' +
    '<div class="f-chips" style="--i:0">' + [['f-chiffres', T('Voir vos chiffres', 'Voir ses chiffres')], ['f-courbe', T('Voir la courbe de vos ventes', 'Voir la courbe des ventes')], ['f-cat', T('Voir vos catégories', 'Voir les catégories')], ['f-ne', T('Voir ce que vous ne commandez plus', 'Voir ce qu’elle ne commande plus')]].map(function (c) { return '<a href="#fiche" class="chip" data-ancre="' + c[0] + '">' + c[1] + '</a>'; }).join('') + '</div>' +
    '<section style="--i:1"><h2 class="titre-s" id="f-prop">À proposer</h2><div class="acts">' +
    '<div class="carte act"><span class="rond gris"><span class="ico" data-ico="screen"></span></span><div><b>Préparer le catalogue pour son logiciel</b><span class="sub">' + esc(I.logiciel || 'À choisir') + ' · ' + esc(F.aProposer.catalogueLogiciel.libelle) + '</span></div><button class="pil" type="button" data-stub="Le catalogue n’est pas dessiné dans cette maquette.">Préparer</button></div>' +
    '<div class="carte act" data-interne><span class="rond gris"><span class="ico" data-ico="tasks"></span></span><div><b>Ouvrir la liste de tâches</b><span class="sub">' + F.taches.length + ' tâches · prochaine le ' + J.dateFr(F.taches[0].echeance) + '</span></div><button class="pil" type="button" data-stub="Les tâches ne sont pas dessinées dans cette maquette.">Ajouter une tâche</button></div>' +
    '<div class="carte act bleu"><span class="rond"><span class="ico" data-ico="clip"></span></span><div><b>Choisir quoi lui transmettre</b><span class="sub">Documents et catalogues</span></div><button class="pil clair" type="button" data-stub="La transmission n’est pas dessinée dans cette maquette.">Choisir</button></div></div>' +
    '<div class="gdeux stack">' + listeProp('Le réseau', 'Meilleures ventes nationales · Réseau Intégral', 'net', F.aProposer.reseau.nbProduits, F.aProposer.reseau.premiers) + listeProp(I.groupement === 'Sans groupement' ? 'Listing du groupe d’achat' : 'Listing ' + I.groupement, 'Groupe d’achat · ' + I.groupement, 'group', F.aProposer.groupeAchat.nbProduits, F.aProposer.groupeAchat.premiers) + '</div></section>' +
    '<section style="--i:2" class="carte c-chiffres" id="f-chiffres"><h2>' + T('Vos chiffres', 'Ses chiffres, comparés à la moyenne de nos clients') + '</h2><p class="note">' + F.periode + ' · montants par mois et part des génériques, sur ses 10 mois livrés' + (pv ? '' : ' · trait gris : la moyenne de nos ' + nf.format(MOY.nClients) + ' clients') + '</p>' +
    '<div class="hero"><span class="hero-l">' + T('Votre chiffre d’affaires', 'Chiffre d’affaires') + ' · ' + F.periode + '</span><div class="hero-n num" id="f-ca">' + J.gros(eur(F.ca)) + '</div>' +
    '<div class="hero-p" data-interne><span class="mot">×' + nf1.format(ratio) + ' la moyenne de nos clients</span><span class="mot">' + (F.rang.france ? ordre(F.rang.france) + ' sur ' + nf.format(F.rang.surFrance) + ' officines actives' : 'Aucune vente') + '</span><span class="mot">' + ordre(F.rang.groupement) + ' sur ' + F.rang.surGroupement + ' chez ' + esc(I.groupement) + '</span></div>' +
    '<p class="hero-d">' + T('Votre chiffre d’affaires du dernier mois : ', 'Dernier mois : ') + '<b class="num">' + eur(last) + '</b> · ' + J.signe(evo) + ' sur ' + J.ml(mois[mois.length - 2]) + '</p></div>' +
    '<div class="cbs">' + barreCmp(T('Votre chiffre d’affaires par mois', 'Chiffre d’affaires par mois'), 'var(--c-ca)', F.ca / 10, MOY.caMois, eur, 'moyenne : ' + eur(MOY.caMois), pv) +
    barreCmp('Notre marge Intégral par mois', 'var(--c-nous)', nm, MOY.margeNousMois, eur, 'moyenne : ' + eur(MOY.margeNousMois), pv).replace('class="cb"', 'class="cb" data-interne') +
    barreCmp(T('Votre marge par mois', 'Marge du pharmacien par mois'), 'var(--c-pharma)', pm, MOY.margePharmacienMois, eur, 'moyenne : ' + eur(MOY.margePharmacienMois), pv) +
    barreCmp('Produits différents achetés ' + F.periode, 'var(--c-cmd)', F.produitsDifferentsAchetes, 0, nf.format.bind(nf), '', true) +
    barreCmp('Part des génériques dans ' + T('vos', 'ses') + ' achats', 'var(--cat-autre)', partGen, MOY.partGeneriques, function (v) { return nf.format(v) + ' %'; }, 'moyenne : ' + MOY.partGeneriques + ' %', pv) + '</div>' +
    '<p class="note" data-interne>Notre marge : génériques comptés à zéro. Même repère « moyenne » pour tout le bloc.</p></section>' +
    '<div id="f-suite"></div></div></div>';
  J.poseIcones(el);
  if (J.fichesuite) J.fichesuite(el, o, F, { pv: pv, mois: mois, cm: cm, last: last, prev: prev, evo: evo, ratio: ratio, nm: nm, pm: pm });
  J.compter($('#f-ca', el), F.ca, function (v) { return J.gros(eur(v)); }, 1100);
  $$('[data-vue]', el).forEach(function (b) { b.onclick = function () { S.vue = b.getAttribute('data-vue'); document.body.setAttribute('data-vue-courante', S.vue); J.renderFiche(); }; });
  $$('[data-pn]', el).forEach(function (b) { b.onclick = function () { var k = idx + (+b.getAttribute('data-pn')); if (k < 0) k = clientes.length - 1; if (k >= clientes.length) k = 0; S.off = clientes[k].id; J.renderFiche(); window.scrollTo(0, 0); }; });
  $('#f-autre', el).onchange = function (e) { if (e.target.value) { S.off = e.target.value; J.renderFiche(); window.scrollTo(0, 0); } };
  $$('[data-ancre]', el).forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); var t = $('#' + a.getAttribute('data-ancre')); if (t) { var y = t.getBoundingClientRect().top + window.scrollY - 90; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); } }; });
};
})();
