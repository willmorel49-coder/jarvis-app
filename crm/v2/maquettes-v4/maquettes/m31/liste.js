/* m31 — écran Officines, liste « Mes officines » : bandeau bleu, 4 onglets, filtres, « À rappeler cette semaine », cartes d'officine. */
(function () {
'use strict';
var J = window.J31, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, D = J.D, OFF = J.OFF, MOY = J.MOY;
var S = J.S = { vue: 'integral', off: OFF[0].id, stat: 'clients', com: '', grp: '', q: '', nb: 30, serie: 'ca',
  sect: 'tous', per: 'dernier', du: 9, au: 11, detail: false, cf: 'tout', cq: '', ccom: '', cgrp: '', volet: null, tour: {}, tourVue: false, couche: 'ca' };
function listeFiltree() {
  var q = S.q.toLowerCase();
  return OFF.filter(function (o) {
    if (S.stat === 'clients' && o.statut === 'prospect') return false;
    if (S.stat === 'prospects' && o.statut !== 'prospect') return false;
    if (S.com && S.com !== D.secteur.commerciale) return false;
    if (q && (o.nom + ' ' + o.ville + ' ' + o.cp + ' ' + o.titulaire).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) { return b.ca - a.ca; });
}
J.ouvrirFiche = function (id) { S.off = id; if (location.hash === '#fiche') J.route(); else location.hash = '#fiche'; };
function carteHtml(o, i) {
  var e = J.etatOff(o), est = o.statut === 'prospect', ratio = o.ca / 10 / MOY.caMois;
  var baisse = o.baisse3mois != null ? '<span class="baisse"><span class="ico">' + J.icoSvg('bas', 'var(--e-alerte)') + '</span>−' + Math.abs(o.baisse3mois) + ' % en 3 mois</span>' : '';
  var tete = '<div class="of-t">' + J.etatHtml(e) + '<span>' + esc(o.groupement) + '</span>' + baisse + '</div>' +
    '<h3 class="of-nom">' + esc(J.joli(o.nom)) + '</h3><p class="of-ville">' + esc(o.ville) + ' · ' + o.cp + '</p>';
  var prop = '<div class="of-l"><span class="l-t"><span><b>À lui proposer</b><span class="sub">produits phares qu’elle ne commande pas, parmi les 100 plus vendus du secteur</span></span></span><span class="v v-r">' + J.anneau(o.score) + '<span class="num">' + o.score + ' sur 100</span></span></div>';
  var corps = est ? '<p class="of-aucune">Aucune vente · prospect de votre secteur</p>' + prop :
    '<div class="of-ca num" data-ca="' + o.ca + '">' + J.gros(eur(o.ca)) + '</div><div class="of-ca-l">chiffre d’affaires · janv.–oct. 2026</div>' +
    '<div class="of-cmp">' + J.spark(o.caParMois, MOY.caMois, 150, 46, 'var(--c-ca)', { aria: 'Chiffre d’affaires des 10 mois de ' + J.joli(o.nom) + ', face à la moyenne de nos clients' }) +
    '<div class="of-ratio"><b>×' + nf1.format(ratio) + '</b>la moyenne de nos clients</div></div>' +
    '<div class="of-l"><span class="l-t"><span class="puce" style="background:var(--c-nous)"></span><span><b>Notre marge Intégral</b><span class="sub">janv.–oct. 2026 · estimation</span></span></span><span class="v num">' + eur(o.margeNous) + '</span></div>' +
    '<div class="of-l"><span class="l-t"><span class="puce" style="background:var(--c-pharma)"></span><span><b>Marge du pharmacien</b><span class="sub">janv.–oct. 2026</span></span></span><span class="v num">' + eur(o.margePharmacien) + '</span></div>' + prop;
  return '<a class="carte-of" href="#fiche" data-officine="' + o.id + '" style="--i:' + Math.min(i, 12) + '">' + tete + corps + '</a>';
}
J.renderListe = function () {
  var el = $('#ecran-liste'), nbC = D.secteur.nbClientes, nbP = D.secteur.nbProspects, ap = OFF.filter(function (o) { return o.aRappeler; });
  el.innerHTML =
    '<div class="banniere"><div class="croix" aria-hidden="true"><i></i><i></i></div><p class="eyebrow">Mon secteur</p><h1>Mes officines</h1>' +
    '<p class="lede"><b>' + nf.format(nbC) + ' clientes</b> dans votre secteur, dont <b>' + ap.length + ' à rappeler</b>, et ' + nf.format(nbP) + ' prospects.</p>' +
    '<div class="ban-bas"><div class="ban-afficher">Afficher :<div class="seg" role="group" aria-label="Afficher"><button type="button" data-lstat="clients" aria-pressed="' + (S.stat === 'clients') + '">Clients <span class="cnt">' + nf.format(nbC) + '</span></button><button type="button" data-lstat="prospects" aria-pressed="' + (S.stat === 'prospects') + '">Prospects de mon secteur <span class="cnt">' + nf.format(nbP) + '</span></button></div></div>' +
    '<div class="ban-btn">' + (S.stat === 'clients' ? '<button class="pil" type="button" data-stub="L’exportation n’est pas dessinée dans cette maquette."><span class="ico" data-ico="down"></span>Exporter mes clients en Excel</button>' : '') + '<button class="pil" type="button" data-stub="La création n’est pas dessinée dans cette maquette."><span class="ico" data-ico="plus"></span>Créer un prospect</button></div></div></div>' +
    '<div class="sousnav"><div class="onglets-l" role="group" aria-label="Vues"><a href="#liste" class="on"><span class="ico" data-ico="home"></span>Officines</a><button type="button" data-stub="L’écran Groupements n’est pas dessiné dans cette maquette."><span class="ico" data-ico="group"></span>Groupements</button><button type="button" data-stub="L’écran Mes listes n’est pas dessiné dans cette maquette."><span class="ico" data-ico="list"></span>Mes listes</button><a href="#carte"><span class="ico" data-ico="pin"></span>Carte secteur</a></div>' +
    '<label class="filtre">Commercial :<select id="l-com" aria-label="Commercial"><option value="">Tous</option><option value="' + esc(D.secteur.commerciale) + '"' + (S.com ? ' selected' : '') + '>' + esc(D.secteur.commerciale) + '</option></select></label>' +
    '<label class="filtre rch"><span class="ico" data-ico="search"></span><input id="l-q" type="search" value="' + esc(S.q) + '" placeholder="Nom, titulaire, ville ou code postal…" aria-label="Rechercher dans la liste"></label></div>' +
    '<div class="synth entre"><div class="stat" style="--i:1"><div class="lib"><span class="puce" style="background:var(--c-ca)"></span>Moyenne de nos ' + nf.format(MOY.nClients) + ' clients</div><div class="val num">' + eur(MOY.caMois) + ' <small>par mois</small></div><p class="note">chiffre d’affaires de chaque client, janv.–oct. 2026</p></div>' +
    '<div class="stat" style="--i:2"><div class="lib"><span class="puce" style="background:var(--e-attention)"></span>À rappeler cette semaine</div><div class="val num">' + ap.length + ' <small>officines</small></div><p class="note">dont les commandes baissent</p></div>' +
    '<div class="stat" style="--i:3"><div class="lib"><span class="puce" style="background:var(--c-cmd)"></span>Officines du secteur</div><div class="val num">' + nf.format(D.secteur.nbOfficines) + '</div><p class="note">' + nf.format(nbC) + ' clientes et ' + nf.format(D.secteur.nbOfficines - nbC) + ' autres</p></div></div>' +
    (S.stat === 'clients' ? '<div class="carte rappel"><h2>À rappeler cette semaine</h2><div class="rap-liste">' + ap.map(function (o) { return '<button type="button" class="rap" data-rappel="' + o.id + '"><span class="ico">' + J.icoSvg('bell', 'var(--e-attention)') + '</span><span><b>' + esc(J.joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + (o.baisse3mois != null ? ' · −' + Math.abs(o.baisse3mois) + ' % en 3 mois' : '') + '</span></span><span class="ico">' + J.icoSvg('chev') + '</span></button>'; }).join('') + '</div></div>' : '') +
    '<p class="cpt" id="l-cpt"></p><p class="legl">Sous chaque chiffre d’affaires, la courbe compare ses achats mois par mois à la moyenne de nos ' + nf.format(MOY.nClients) + ' clients : <b>' + eur(MOY.caMois) + ' par mois</b> (trait gris pointillé).</p>' +
    '<div class="grille-of" id="l-lignes"></div><div class="pied-l"><button type="button" class="pil" id="l-plus">Afficher 30 de plus</button></div>';
  J.poseIcones(el); remplir();
  $$('[data-lstat]', el).forEach(function (b) { b.onclick = function () { S.stat = b.getAttribute('data-lstat'); S.nb = 30; J.renderListe(); }; });
  $('#l-com', el).onchange = function (e) { S.com = e.target.value; S.nb = 30; remplir(); };
  $('#l-q', el).oninput = function (e) { S.q = e.target.value; remplir(); };
  $('#l-plus', el).onclick = function () { S.nb += 30; remplir(); };
  $$('[data-rappel]', el).forEach(function (b) { b.onclick = function () { J.ouvrirFiche(b.getAttribute('data-rappel')); }; });
};
function remplir() {
  var l = listeFiltree(), aff = l.slice(0, S.nb), box = $('#l-lignes');
  box.innerHTML = aff.length ? aff.map(carteHtml).join('') : '<p class="vide">Aucune officine. Aucun résultat pour « ' + esc(S.q) + ' ».</p>';
  $('#l-cpt').textContent = nf.format(D.secteur.nbOfficines) + ' officines, classées par chiffre d’affaires de janv. à oct. 2026 · ' + aff.length + ' affichées';
  $('#l-plus').hidden = l.length <= S.nb;
  $$('[data-ca]', box).slice(0, 6).forEach(function (e) { J.compter(e, +e.getAttribute('data-ca'), function (v) { return J.gros(eur(v)); }, 900); });
  $$('[data-officine]', box).forEach(function (a) { a.addEventListener('click', function (ev) { ev.preventDefault(); J.ouvrirFiche(a.getAttribute('data-officine')); }); });
}
J.remplirListe = remplir;
})();
