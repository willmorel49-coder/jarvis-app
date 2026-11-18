/* Mes listes (#listes, 3e vue d'Officines) et détail d'une liste (#listes-detail).
   En-tête « Mes officines · vos listes », titre, phrase « N listes sur mesure, N pharmacies regroupées au total. » (état vide : « Vos listes sur mesure… »),
   bouton « + Nouvelle liste », les quatre vues, une ligne par liste (nom, pharmacies · actives, chiffre d'affaires), état vide « Aucune liste pour l'instant… » ;
   détail : « Liste personnelle », nom, pharmacies / actives / produits commandés, période, actions Ajouter des pharmacies · Liste d'achats (PDF) · Excel · Partager ·
   Renommer · Supprimer la liste, « Pharmacies de la liste » (+ Ajouter, retirer ✕), « Liste d'achats idéale » (composant partagé J.lotE.listeAchats d'ecran-groupements.js),
   choix des pharmacies filtré par groupement. Créer, renommer, ajouter, retirer et supprimer marchent en local (état de la maquette).
   Données : J.X.listes, J.D.officines, fictives. Tout interne. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, eur = J.eur, D = J.D, OFF = J.OFF, MOY = J.MOY, S = J.S, X = J.X && J.X.listes;
if (!X) return;
var LE = J.lotE, N_MOIS = D.mois.length, STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var E = S.listes = S.listes || { listes: JSON.parse(JSON.stringify(X)), sel: X[0] ? X[0].id : '', q: '', nouvelle: false, picker: false, grp: '', renomme: false, suppr: false, coche: {} };
var membres = function (ids) { return LE ? LE.membres(ids) : ids.map(function (id) { return J.offById(id); }).filter(Boolean); };
var serie = function (offs) { return D.mois.map(function (_, i) { return offs.reduce(function (s, o) { return s + (o.statut === 'prospect' ? 0 : o.caParMois[i]); }, 0); }); };
var evo = function (sr) { var a = sr[sr.length - 1], b = sr[sr.length - 2]; return b ? Math.round((a - b) / b * 100) : 0; };
var actives = function (offs) { return offs.filter(function (o) { return o.statut !== 'prospect' && o.ca > 0; }); };
var AUJ = J.dateFr((J.X.rdv && J.X.rdv.aujourdhui) || '2026-11-17');   /* la date du jour de la maquette, lue dans les données (jamais en dur) */
var VP_L = '<p class="note vp li-vp">Mes listes est un outil interne : rien à montrer au pharmacien dans cette vue. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>';
/* deux cartes à grand chiffre : le cumul des listes (pharmacies distinctes) et le chiffre par pharmacie active, écrits nulle part ailleurs */
function synthese(L) {
  var ids = []; L.forEach(function (l) { l.ids.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
  var offs = membres(ids), act = actives(offs), sr = serie(offs), ca = sr.reduce(function (a, b) { return a + b; }, 0); if (!ca) return '';
  return '<div class="li-synth entre">' +
    J.stat({ i: 1, interne: true, puce: 'var(--c-ca)', lib: 'Chiffre d’affaires de vos listes', val: eur(ca), note: 'cumul janv.–oct. 2026 · ' + offs.length + ' pharmacies distinctes, ' + L.length + ' liste' + (L.length > 1 ? 's' : ''), spark: J.spark(sr, 0, 150, 40, 'var(--c-ca)', { aria: 'Chiffre d’affaires des listes, 10 mois' }), evo: J.evoHtml(evo(sr), 'oct. sur sept.') }) +
    J.stat({ i: 2, interne: true, classe: 'li-seul', lib: 'Par pharmacie active', val: eur(ca / act.length), note: 'sur les dix mois · face à l’officine moyenne de nos clients', evo: '<span class="evo"><b>× ' + J.nf1.format(ca / act.length / (MOY.caMois * N_MOIS)) + '</b>la moyenne</span>' }) + '</div>';
}
function formNouvelle() {
  return '<section class="carte li-form" data-interne aria-label="Nouvelle liste"><div class="tete"><div><h2>Nouvelle liste</h2><p class="st">un nom parlant : Big pharma, Pharma PDA, Liste NR… vous ajouterez les pharmacies ensuite</p></div></div><form class="li-ligne" id="li-nouvelle"><label class="filtre li-champ">' + J.ico('list') + '<input type="text" id="li-nom" placeholder="Nom de la liste" aria-label="Nom de la liste" maxlength="40" required></label><button type="submit" class="pil plein">' + J.ico('plus') + 'Créer la liste</button><button type="button" class="pil" data-li-annule>Annuler</button></form></section>';
}
function ligneListe(l, i) {
  var offs = membres(l.ids), act = actives(offs), sr = serie(offs), ca = sr.reduce(function (a, b) { return a + b; }, 0), part = offs.length ? Math.round(act.length / offs.length * 100) : 0;
  return '<tr class="li-l" data-liste="' + esc(l.id) + '" tabindex="0" role="link" aria-label="Ouvrir la liste ' + esc(l.nom) + '" style="--i:' + i + '"><td data-l="Liste"><span class="li-oid"><span class="li-av" aria-hidden="true">' + J.ico('list') + '</span><span class="li-otx"><b>' + esc(l.nom) + '</b><span class="sub">liste personnelle · créée le ' + esc(l.cree) + '</span></span></span></td>' +
    '<td class="num" data-l="Pharmacies"><b>' + offs.length + '</b></td><td class="num" data-l="Actives"><b>' + act.length + '</b>' + (part < 100 && offs.length ? '<span class="fois">' + part + ' % de la liste</span>' : '') + '</td>' +
    (ca ? '<td data-l="10 mois"><span class="li-dix">' + J.spark(sr, 0, 110, 34, 'var(--c-ca)', { aria: 'Chiffre d’affaires des 10 mois de la liste' }) + J.evoHtml(evo(sr)) + '</span></td><td class="num" data-l="Chiffre d’affaires"><b>' + eur(ca) + '</b>' + J.fois(ca / act.length, MOY.caMois * N_MOIS).replace('la moyenne', 'la moyenne par active') + '</td>' : '<td data-l="10 mois"><span class="li-vide">—</span></td><td class="num" data-l="Chiffre d’affaires"><span class="li-vide">aucune vente</span></td>') +
    '<td class="li-chev">' + J.ico('chev') + '</td></tr>';
}
J.ecrans.listes = {
  rendre: function (el, etat) {
    if (etat.suite === 'detail') { window.scrollTo(0, 0); return detail(el); }
    var L = E.listes, k = E.q.trim().toLowerCase(), F = L.filter(function (l) { return !k || l.nom.toLowerCase().indexOf(k) >= 0; }), nbPh = L.reduce(function (s, l) { return s + l.ids.length; }, 0);
    el.innerHTML = '<div class="page li">' + J.bandeau({ croix: true, eyebrow: 'Mes officines · vos listes · ventes à jour au 31 octobre 2026', titre: 'Mes listes',
      lede: '<span class="vi">' + (L.length ? '<b>' + L.length + ' liste' + (L.length > 1 ? 's' : '') + ' sur mesure</b>, <b>' + nbPh + ' pharmacies</b> regroupées au total. Des pharmacies que vous regroupez vous-même, en piochant dans n’importe quel groupement ; chaque liste a sa liste d’achats idéale.' : 'Vos listes sur mesure : des pharmacies que vous regroupez vous-même, en piochant dans n’importe quel groupement.') + '</span><span class="vp">Vos listes personnelles de pharmacies : réservées à l’interne.</span>',
      actions: '<button type="button" class="pil" data-li-new data-interne>' + J.ico('plus') + 'Nouvelle liste</button>',
      recherche: { id: 'li-q', placeholder: 'Rechercher une liste…', aria: 'Rechercher une liste', valeur: E.q } }) +
      '<div class="li-sousnav">' + J.vuesOfficines('listes') + '</div>' + VP_L + (E.nouvelle ? formNouvelle() : '') + (L.length ? synthese(L) : '') +
      (L.length ? '<section class="carte li-tabbox" data-interne aria-label="Vos listes">' + (F.length ? '<table class="tabl li-tabl"><thead><tr><th>Liste<span class="st">personnelle · date de création</span></th><th class="num">Pharmacies</th><th class="num">Actives<span class="st">au moins une commande</span></th><th>10 mois<span class="st">oct. sur sept.</span></th><th class="num">Chiffre d’affaires<span class="st">cumul janv.–oct. 2026</span></th><th></th></tr></thead><tbody>' + F.map(ligneListe).join('') + '</tbody></table>' : '<p class="note li-vide-l">Aucune liste ne porte « ' + esc(E.q) + ' ».</p>') + '<p class="note">« × N la moyenne par active » compare le chiffre d’affaires par pharmacie active de la liste à l’officine moyenne de nos clients.</p></section>'
        : '<section class="carte li-vide-c" data-interne><span class="rond gris">' + J.ico('list') + '</span><div><h2>Aucune liste pour l’instant.</h2><p class="note">Créez des listes sur mesure (ex : Big pharma, Pharma PDA, Liste NR) en piochant des pharmacies dans n’importe quel groupement, puis envoyez-leur la liste d’achats idéale.</p></div><button type="button" class="pil plein" data-li-new>' + J.ico('plus') + 'Nouvelle liste</button></section>') + '</div>';
    J.poseIcones(el);
    var self = this, re = function () { self.rendre(el, etat); };
    $$('[data-li-new]', el).forEach(function (b) { b.onclick = function () { E.nouvelle = true; re(); var i = $('#li-nom', el); if (i) i.focus(); }; });
    $$('[data-li-annule]', el).forEach(function (b) { b.onclick = function () { E.nouvelle = false; re(); }; });
    var f = $('#li-nouvelle', el); if (f) f.onsubmit = function (ev) { ev.preventDefault(); var nom = $('#li-nom', el).value.trim(); if (!nom) return; var id = 'l' + Date.now(); E.listes.push({ id: id, nom: nom, ids: [], cree: AUJ }); E.nouvelle = false; E.sel = id; E.picker = true; J.toast('Liste « ' + nom + ' » créée : ajoutez-lui des pharmacies.'); J.aller('listes-detail'); };
    $('#li-q', el).oninput = function (e) { E.q = e.target.value; re(); var q = $('#li-q', el); q.focus(); q.setSelectionRange(q.value.length, q.value.length); };
    $$('tr[data-liste]', el).forEach(function (tr) { var go = function () { E.sel = tr.getAttribute('data-liste'); J.aller('listes-detail'); }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }; });
  }
};
/* ---------- #listes-detail ---------- */
function picker(l) {
  var grps = []; OFF.forEach(function (o) { if (o.groupement !== 'Sans groupement' && grps.indexOf(o.groupement) < 0) grps.push(o.groupement); }); grps.sort();
  var dispo = OFF.filter(function (o) { return l.ids.indexOf(o.id) < 0 && (!E.grp || o.groupement === E.grp); }).sort(function (a, b) { return b.ca - a.ca; }), n = Object.keys(E.coche).length;
  return '<section class="carte li-picker" data-interne aria-label="Ajouter des pharmacies"><div class="tete"><div><h2>Ajouter des pharmacies</h2><p class="st">piochez dans n’importe quel groupement · cochez, puis ajoutez</p></div><button type="button" class="pil" data-li-fermer>' + J.ico('close') + 'Fermer</button></div>' +
    '<div class="li-pf"><label class="filtre">Groupement :<select id="li-grp" aria-label="Filtrer par groupement"><option value="">Tous</option>' + grps.map(function (g) { return '<option value="' + esc(g) + '"' + (E.grp === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select></label><button type="button" class="pil plein" data-li-ajoute' + (n ? '' : ' disabled') + '>' + J.ico('plus') + 'Ajouter' + (n ? ' ' + n + ' pharmacie' + (n > 1 ? 's' : '') : '') + '</button></div>' +
    '<div class="li-choix">' + dispo.map(function (o) { return '<label class="li-ck' + (E.coche[o.id] ? ' on' : '') + '"><input type="checkbox" data-li-coche="' + o.id + '"' + (E.coche[o.id] ? ' checked' : '') + '><span class="li-av" aria-hidden="true">' + esc(J.ini(o.nom)) + '</span><span class="li-otx"><b>' + esc(J.joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + ' · ' + esc(o.groupement) + (o.statut === 'prospect' ? ' · prospect' : '') + '</span></span></label>'; }).join('') + (dispo.length ? '' : '<p class="note">Toutes les officines de ce groupement sont déjà dans la liste.</p>') + '</div></section>';
}
function detail(el) {
  var l = E.listes.filter(function (x) { return x.id === E.sel; })[0] || E.listes[0]; if (!l) return J.aller('listes'); E.sel = l.id;
  var offs = membres(l.ids).sort(function (a, b) { return b.ca - a.ca; }), act = actives(offs), sr = serie(offs), ca = sr.reduce(function (a, b) { return a + b; }, 0), part = offs.length ? Math.round(act.length / offs.length * 100) : 0, cle = 'li-' + l.id, q = (LE && LE.q && LE.q[cle]) || '';
  var prod = offs.length ? Math.max.apply(null, offs.map(function (o) { return J.ficheDe(o.id).produitsDifferentsAchetes || 0; })) : 0;
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Mes listes</button><div class="li-pn" data-interne><button type="button" class="b-rond" data-li-pn="-1" aria-label="Liste précédente">' + J.ico('back') + '</button><button type="button" class="b-rond" data-li-pn="1" aria-label="Liste suivante">' + J.ico('chev') + '</button></div><label class="filtre li-autre" data-interne>' + J.ico('list') + '<select id="li-autre" aria-label="Autre liste"><option value="">Autre liste…</option>' + E.listes.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.nom) + '</option>'; }).join('') + '</select></label>';
  var nom = E.renomme ? '<form class="li-ren" id="li-ren"><input type="text" id="li-ren-nom" value="' + esc(l.nom) + '" aria-label="Nouveau nom" maxlength="40" required><button type="submit" class="pil plein">Enregistrer</button><button type="button" class="pil" data-li-ren-annule>Annuler</button></form>' : esc(l.nom);
  var lignes = [['Pharmacies', offs.length ? offs.length + ' sur votre secteur' : 'aucune pour l’instant'], ['Actives', offs.length ? (act.length === offs.length ? 'toutes · au moins une commande chacune' : act.length + ' · ' + part + ' % de la liste') : ''], ['Produits commandés', prod ? 'jusqu’à ' + nf.format(prod) + ' références différentes pour une seule pharmacie' : ''], ['Période', 'janvier à octobre 2026 · ventes à jour au 31 octobre'], ['Par pharmacie active', act.length ? eur(ca / act.length) + ' ' + J.fois(ca / act.length, MOY.caMois * N_MOIS) : ''], ['Créée le', esc(l.cree)], ['Partage', 'vous seule pour l’instant']];
  var actions = '<div class="ronds">' + J.rond('plus', 'Ajouter', null, 1, ' data-li-add') + J.rond('doc', 'PDF', null, 0, ' data-li-la') + J.rond('down', 'Excel', STUB('Télécharger la liste en Excel')) + J.rond('share', 'Partager', STUB('Partager la liste avec l’équipe')) + J.rond('edit', 'Renommer', null, 0, ' data-li-ren') + J.rond('close', 'Supprimer', null, 0, ' data-li-del') + '</div>' +
    '<button type="button" class="pil plein" data-li-la>' + J.ico('list') + 'Voir la liste d’achats idéale</button>';   /* « Ajouter » : le rond de l'identité et le « + Ajouter » de la carte des membres, pas un troisième bouton */
  var suppr = E.suppr ? '<section class="carte li-suppr" data-interne role="alertdialog" aria-label="Supprimer la liste"><div><h2>Supprimer « ' + esc(l.nom) + ' » ?</h2><p class="note">Les pharmacies restent dans Officines ; seule la liste disparaît.</p></div><div class="li-ligne"><button type="button" class="pil plein" data-li-del-oui>' + J.ico('close') + 'Supprimer la liste</button><button type="button" class="pil" data-li-del-non>Garder</button></div></section>' : '';
  el.innerHTML = '<div class="page li li-det">' + J.bandeau({ classe: 'li-ban', deborde: true, eyebrow: 'Liste personnelle · vos listes · ventes à jour au 31 octobre 2026', recherche: '<div class="li-outils">' + outils + '</div>' }) +
    VP_L + '<div class="sous-bandeau" data-interne>' +
    J.identite({ classe: 'li-id', nom: nom, meta: '<span class="etat">' + J.ico('list', 'var(--e-neutre)') + 'Liste personnelle</span><span class="sub">' + esc(J.X.personne.nom) + '</span>', mois: ca ? { lib: 'Chiffre d’affaires · janv.–oct. 2026', val: eur(ca), evo: J.evoHtml(evo(sr), 'oct. sur sept.') } : null, bas: ca ? '' : '<p class="note li-bas">Aucune vente à cumuler : ajoutez des pharmacies clientes.</p>', lignes: lignes, actions: actions }) + suppr + (E.picker ? picker(l) : '') +
    '<section class="carte li-membres"><div class="tete"><div><h2>Pharmacies de la liste</h2><p class="st">classées par chiffre d’affaires · un clic ouvre la fiche · ✕ retire la pharmacie de la liste</p></div><button type="button" class="pil" data-li-add>' + J.ico('plus') + 'Ajouter</button></div>' +
    (offs.length ? '<table class="tabl li-tabm"><thead><tr><th>Officine<span class="st">état · ville</span></th><th class="num">Chiffre d’affaires<span class="st">cumul janv.–oct. 2026</span></th><th>10 mois<span class="st">oct. sur sept.</span></th><th class="num">À lui proposer<span class="st">sur les 100 plus vendus</span></th><th></th><th></th></tr></thead><tbody>' + offs.map(function (o, i) { return LE ? LE.ligneOff(o, i, '<td class="li-ret"><button type="button" class="b-rond" data-li-retire="' + o.id + '" aria-label="Retirer ' + esc(J.joli(o.nom)) + ' de la liste">' + J.ico('close') + '</button></td>') : ''; }).join('') + '</tbody></table>' : '<p class="note li-vide-l">Aucune pharmacie dans cette liste : « Ajouter » pour piocher dans les groupements.</p>') + '</section>' +
    (LE && offs.length ? LE.listeAchats(cle, { q: q }) : '') + '</div></div>';
  J.poseIcones(el);
  var re = function () { detail(el); };
  if (LE) { LE.lierOff(el); LE.lierListe(el, cle, re); }
  $('#li-autre', el).onchange = function (e) { if (e.target.value) { E.sel = e.target.value; E.picker = false; E.renomme = false; E.suppr = false; J.route(); } };
  $$('[data-li-pn]', el).forEach(function (b) { b.onclick = function () { var ids = E.listes.map(function (x) { return x.id; }), k = ids.indexOf(E.sel); E.sel = ids[((k < 0 ? 0 : k) + (+b.getAttribute('data-li-pn')) + ids.length) % ids.length]; E.picker = false; E.renomme = false; E.suppr = false; J.route(); window.scrollTo(0, 0); }; });   // précédent / suivant
  $$('[data-li-add]', el).forEach(function (b) { b.onclick = function () { E.picker = true; E.coche = {}; re(); var p = $('.li-picker', el); if (p) window.scrollTo(0, Math.max(0, p.getBoundingClientRect().top + window.scrollY - 90)); }; });
  $$('[data-li-fermer]', el).forEach(function (b) { b.onclick = function () { E.picker = false; E.coche = {}; re(); }; });
  var g = $('#li-grp', el); if (g) g.onchange = function (e) { E.grp = e.target.value; re(); };
  $$('[data-li-coche]', el).forEach(function (c) { c.onchange = function () { if (c.checked) E.coche[c.getAttribute('data-li-coche')] = 1; else delete E.coche[c.getAttribute('data-li-coche')]; re(); }; });
  $$('[data-li-ajoute]', el).forEach(function (b) { b.onclick = function () { var ids = Object.keys(E.coche); ids.forEach(function (id) { if (l.ids.indexOf(id) < 0) l.ids.push(id); }); E.coche = {}; E.picker = false; J.toast(ids.length + ' pharmacie' + (ids.length > 1 ? 's' : '') + ' ajoutée' + (ids.length > 1 ? 's' : '') + ' à « ' + l.nom + ' ».'); re(); }; });
  $$('[data-li-retire]', el).forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-li-retire'); l.ids = l.ids.filter(function (x) { return x !== id; }); J.toast(J.nomOff(id) + ' retirée de la liste.'); re(); }; });
  $$('[data-li-ren]', el).forEach(function (b) { b.onclick = function () { E.renomme = true; re(); var i = $('#li-ren-nom', el); if (i) { i.focus(); i.select(); } }; });
  $$('[data-li-ren-annule]', el).forEach(function (b) { b.onclick = function () { E.renomme = false; re(); }; });
  var fr = $('#li-ren', el); if (fr) fr.onsubmit = function (ev) { ev.preventDefault(); var v = $('#li-ren-nom', el).value.trim(); if (v) l.nom = v; E.renomme = false; re(); };
  $$('[data-li-del]', el).forEach(function (b) { b.onclick = function () { E.suppr = true; re(); }; });
  $$('[data-li-del-non]', el).forEach(function (b) { b.onclick = function () { E.suppr = false; re(); }; });
  $$('[data-li-del-oui]', el).forEach(function (b) { b.onclick = function () { E.listes = E.listes.filter(function (x) { return x !== l; }); E.suppr = false; E.sel = E.listes[0] ? E.listes[0].id : ''; J.toast('Liste « ' + l.nom + ' » supprimée.'); J.aller('listes'); }; });
  $$('[data-li-la]', el).forEach(function (b) { b.onclick = function () { var t = $('#la-' + cle, el); if (t) window.scrollTo(0, Math.max(0, t.getBoundingClientRect().top + window.scrollY - 90)); else J.toast('Ajoutez d’abord des pharmacies : la liste d’achats idéale se calcule sur leurs commandes.'); }; });
}
})();
