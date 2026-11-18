/* Officines : la liste « Mes officines » (data-ecran="liste") et la fiche d'une officine (data-ecran="fiche").
   Vue Intégral / pharmacien : [data-interne] + .vi/.vp. Aucun chiffre écrit deux fois sur un même écran. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, D = J.D, OFF = J.OFF, MOY = J.MOY, S = J.S;
var L = S.liste = { stat: 'clients', com: '', nb: 30 };
var MOIS = D.mois, N_MOIS = MOIS.length;
function evoDernier(cm) { var a = cm[cm.length - 1], b = cm[cm.length - 2]; return b ? Math.round((a - b) / b * 100) : 0; }
function filtrees() {
  var q = (S.q || '').toLowerCase();
  return OFF.filter(function (o) {
    if (L.stat === 'clients' && o.statut === 'prospect') return false;
    if (L.stat === 'prospects' && o.statut !== 'prospect') return false;
    if (L.com && L.com !== D.secteur.commerciale) return false;
    if (q && (o.nom + ' ' + o.ville + ' ' + o.cp + ' ' + o.titulaire).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) { return b.ca - a.ca; });
}
J.ouvrirFiche = function (id, depuis) { S.off = id; S.ficheDepuis = depuis || null; J.aller(S.vue === 'pharmacien' ? 'fiche-pharmacien' : 'fiche'); };   // depuis : l'adresse où « Retour » ramène (le GPS) ; sans elle, la liste
/* ---------- une ligne du tableau (officine) ---------- */
function ligne(o, i) {
  var pros = o.statut === 'prospect', e = J.etatOff(o), ev = evoDernier(o.caParMois);
  var tete = '<td data-l="Officine"><div class="of-id"><span class="av" aria-hidden="true">' + esc(J.ini(o.nom)) + '</span><div class="of-txt"><b class="of-nom">' + esc(J.joli(o.nom)) + '</b>' +
    '<span class="of-meta">' + J.etatHtml(e) + (o.groupement !== 'Sans groupement' ? '<span class="grp">' + esc(o.groupement) + '</span>' : '') + (o.baisse3mois != null ? '<span class="etat baisse">' + J.ico('bas', 'var(--e-alerte)') + '−' + Math.abs(o.baisse3mois) + ' % en 3 mois</span>' : '') + '</span>' +
    '<span class="of-ville">' + esc(o.ville) + ' · ' + o.cp + '</span></div></div></td>';
  var ca = pros ? '<td class="num" data-l="Chiffre d’affaires"><span class="vide-c">Aucune vente · prospect</span></td>'
    : '<td class="num" data-l="Chiffre d’affaires"><b data-ca="' + o.ca + '">' + eur(o.ca) + '</b>' + J.fois(o.ca, MOY.caMois * N_MOIS) + '</td>';
  var dix = pros ? '<td data-l="10 mois"><span class="vide-c">—</span></td>'
    : '<td data-l="10 mois"><div class="of-dix">' + J.spark(o.caParMois, MOY.caMois, 110, 34, 'var(--c-ca)', { aria: 'Chiffre d’affaires des 10 mois, face à la moyenne de nos clients' }) + J.evoHtml(ev) + '</div></td>';
  var nous = pros ? '<td class="num" data-l="Notre marge Intégral" data-interne><span class="vide-c">—</span></td>'
    : '<td class="num" data-l="Notre marge Intégral" data-interne><b>' + eur(o.margeNous) + '</b>' + J.fois(o.margeNous, MOY.margeNousMois * N_MOIS) + '</td>';
  var ph = pros ? '<td class="num" data-l="Marge du pharmacien"><span class="vide-c">—</span></td>'
    : '<td class="num" data-l="Marge du pharmacien"><b>' + eur(o.margePharmacien) + '</b>' + J.fois(o.margePharmacien, MOY.margePharmacienMois * N_MOIS) + '</td>';
  var prop = '<td class="num" data-l="À lui proposer"><span class="of-score">' + J.anneau(o.score, 40) + '<span><b>' + o.score + '</b><span class="fois">sur 100</span></span></span></td>';
  return '<tr class="of-l" data-officine="' + o.id + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(J.joli(o.nom)) + '" style="--i:' + Math.min(i, 14) + '">' + tete + ca + dix + nous + ph + prop + '<td class="chev">' + J.ico('chev') + '</td></tr>';
}
function remplir() {
  var l = filtrees(), aff = l.slice(0, L.nb), box = $('#l-corps'), tot = L.stat === 'clients' ? D.secteur.nbOfficines : D.secteur.nbProspects;
  box.innerHTML = aff.length ? aff.map(ligne).join('') : '<tr><td colspan="7" class="vide">Aucune officine. Aucun résultat pour « ' + esc(S.q) + ' ».</td></tr>';
  $('#l-cpt').innerHTML = '<b>' + nf.format(tot) + (L.stat === 'clients' ? ' officines' : ' prospects') + '</b>, ' + (L.stat === 'clients' ? 'classées par chiffre d’affaires de janv. à oct. 2026' : 'prospects de votre secteur et créés à la main') + ' · ' + aff.length + ' affichée' + (aff.length > 1 ? 's' : '');
  $('#l-plus').hidden = l.length <= L.nb;
  $$('[data-ca]', box).slice(0, 5).forEach(function (e) { J.compter(e, +e.getAttribute('data-ca'), function (v) { return eur(v); }, 900); });
  $$('tr[data-officine]', box).forEach(function (tr) { var go = function () { J.ouvrirFiche(tr.getAttribute('data-officine')); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  J.poseIcones(box);
}
/* ---------- la liste « Mes officines » ---------- */
J.ecrans.liste = {
  filtrer: function () { var q = $('#l-q'); if (q && q.value !== S.q) q.value = S.q; if ($('#l-corps')) remplir(); },
  rendre: function (el) {
    var nbC = D.secteur.nbClientes, nbP = D.secteur.nbProspects, ap = OFF.filter(function (o) { return o.aRappeler; }), cl = OFF.filter(function (o) { return o.statut !== 'prospect'; });
    var somme = MOIS.map(function (_, i) { return cl.reduce(function (s, o) { return s + o.caParMois[i]; }, 0); }), caTot = cl.reduce(function (s, o) { return s + o.ca; }, 0);
    var nousTot = cl.reduce(function (s, o) { return s + o.margeNous; }, 0), phTot = cl.reduce(function (s, o) { return s + o.margePharmacien; }, 0), evo = evoDernier(somme);
    var hausse = cl.filter(function (o) { return evoDernier(o.caParMois) >= 0; }).length, baisse = cl.length - hausse;
    var F0 = D.fiche, serieDe = function (parMois, total) { var brut = somme.map(function (v, i) { return v * (parMois[i] / F0.caParMois[i]); }), sb = brut.reduce(function (a, b) { return a + b; }, 0); return brut.map(function (v) { return Math.round(v * total / sb); }); };
    var sNous = serieDe(F0.margeNousParMois, nousTot), sPh = serieDe(F0.margePharmacienParMois, phTot), evoN = evoDernier(sNous), evoP = evoDernier(sPh);
    var evoCarte = function (e) { return '<span class="evo"><b>' + J.icoSvg(e < 0 ? 'bas' : 'haut', e < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + J.signe(e) + '</b>oct. sur sept.</span>'; };
    el.innerHTML = '<div class="page">' + J.bandeau({
      croix: true, eyebrow: 'Mon secteur · ventes à jour au 31 octobre 2026', titre: 'Mes officines',
      lede: 'Vos <b>clientes</b> et vos <b>prospects</b> du secteur, classés par chiffre d’affaires de janvier à octobre 2026. Un clic ouvre la fiche.',
      actions: (L.stat === 'clients' ? '<button class="pil" type="button" data-stub="L’exportation n’est pas dessinée dans cette maquette.">' + J.ico('down') + 'Exporter mes clients en Excel</button>' : '') + '<button class="pil" type="button" data-stub="La création n’est pas dessinée dans cette maquette.">' + J.ico('plus') + 'Créer un prospect</button>',
      recherche: { id: 'l-q', placeholder: 'Nom, ville ou code postal', aria: 'Rechercher une officine dans la liste', valeur: S.q },
      bas: '<span class="lbl">Afficher :</span><div class="seg" role="group" aria-label="Afficher"><button type="button" data-lstat="clients" aria-pressed="' + (L.stat === 'clients') + '">Clients <span class="cnt">' + nf.format(nbC) + '</span></button><button type="button" data-lstat="prospects" aria-pressed="' + (L.stat === 'prospects') + '">Prospects<span class="long"> de mon secteur</span> <span class="cnt">' + nf.format(nbP) + '</span></button></div>' +
        '<label class="filtre">Commercial :<select id="l-com" aria-label="Commercial"><option value="">Tous</option><option value="' + esc(D.secteur.commerciale) + '"' + (L.com ? ' selected' : '') + '>' + esc(D.secteur.commerciale) + '</option></select></label>'
    }) +
    '<div class="sousnav">' + J.vuesOfficines('liste') + '</div>' +
    '<div class="synth entre">' +
      J.stat({ i: 1, puce: 'var(--c-ca)', lib: 'Chiffre d’affaires du secteur', val: eur(caTot), note: 'cumul janv.–oct. 2026', spark: J.spark(somme, 0, 150, 40, 'var(--c-ca)', { aria: 'Chiffre d’affaires du secteur, 10 mois' }), evo: evoCarte(evo) }) +
      J.stat({ i: 2, puce: 'var(--c-nous)', lib: 'Notre marge Intégral', val: eur(nousTot), note: 'estimation · janv.–oct. 2026', interne: true, spark: J.spark(sNous, 0, 150, 40, 'var(--c-nous)', { aria: 'Notre marge, 10 mois' }), evo: evoCarte(evoN) }) +
      J.stat({ i: 3, puce: 'var(--c-pharma)', lib: 'Marge du pharmacien', val: eur(phTot), note: 'cumul janv.–oct. 2026', spark: J.spark(sPh, 0, 150, 40, 'var(--c-pharma)', { aria: 'Marge du pharmacien, 10 mois' }), evo: evoCarte(evoP) }) +
      '<div class="stat" style="--i:4"><div class="lib">Octobre, comparé à septembre</div><div class="hb"><span>' + J.ico('haut', 'var(--e-bien)') + '<b class="num">' + hausse + '</b> en hausse</span><span>' + J.ico('bas', 'var(--e-alerte)') + '<b class="num">' + baisse + '</b> en baisse</span></div><div class="hb-bar" role="img" aria-label="' + hausse + ' en hausse, ' + baisse + ' en baisse"><i style="width:' + Math.round(hausse / cl.length * 100) + '%"></i></div><p class="note">parmi vos ' + cl.length + ' clientes du relevé</p></div>' +
    '</div>' +
    (L.stat === 'clients' ? '<section class="carte rappel" aria-label="À rappeler cette semaine"><div class="tete"><div><h2>À rappeler cette semaine</h2><p class="st">Leurs commandes baissent : un appel avant la tournée.</p></div></div><div class="rap-liste">' +
      ap.map(function (o) { return '<button type="button" class="rap" data-rappel="' + o.id + '">' + J.ico('bell', 'var(--e-attention)') + '<span><b>' + esc(J.joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + (o.baisse3mois != null ? ' · −' + Math.abs(o.baisse3mois) + ' % en 3 mois' : '') + '</span></span>' + J.ico('chev') + '</button>'; }).join('') + '</div></section>' : '') +
    '<p class="cpt" id="l-cpt"></p><p class="legl">« × N la moyenne » compare ses achats à ceux de <b>l’officine moyenne de nos ' + nf.format(MOY.nClients) + ' clients</b> : ' + eur(MOY.caMois) + ' par mois (le trait gris pointillé de la courbe). Notre marge : estimation, génériques comptés à zéro.</p>' +
    '<section class="carte tab-of" aria-label="Liste des officines"><table class="tabl"><thead><tr><th>Officine<span class="st">état · groupe d’achat · ville</span></th><th class="num">Chiffre d’affaires<span class="st">cumul janv.–oct. 2026</span></th><th>10 mois<span class="st">oct. sur sept.</span></th><th class="num" data-interne>Notre marge Intégral<span class="st">janv.–oct. · estimation</span></th><th class="num">Marge du pharmacien<span class="st">cumul janv.–oct. 2026</span></th><th class="num">À lui proposer<span class="st">sur les 100 plus vendus</span></th><th></th></tr></thead><tbody id="l-corps"></tbody></table>' +
    '<div class="pied-l"><button type="button" class="pil" id="l-plus">Afficher 30 de plus</button>' + (L.stat === 'prospects' ? '<a class="chip" href="#carte">' + J.ico('pin') + '+ ' + nf.format(nbP - OFF.filter(function (o) { return o.statut === 'prospect'; }).length) + ' autres prospects · voir sur la carte</a><button type="button" class="pil" data-stub="Les fiches archivées ne sont pas dessinées dans cette maquette.">Voir les 3 fiches archivées</button>' : '') + '</div></section></div>';
    remplir();
    $$('[data-lstat]', el).forEach(function (b) { b.onclick = function () { L.stat = b.getAttribute('data-lstat'); L.nb = 30; J.route(); }; });
    $('#l-com', el).onchange = function (e) { L.com = e.target.value; L.nb = 30; remplir(); };
    $('#l-q', el).oninput = function (e) { S.q = e.target.value; var g = $('#rech-globale'); if (g && g.value !== S.q) g.value = S.q; remplir(); };
    $('#l-plus', el).onclick = function () { L.nb += 30; remplir(); };
    $$('[data-rappel]', el).forEach(function (b) { b.onclick = function () { J.ouvrirFiche(b.getAttribute('data-rappel')); }; });
  }
};
})();
/* ====================================================================================================================
   LA FICHE : bandeau court (retour, précédente / suivante, « Autre officine… », brief, bascule de vue), carte d'identité qui déborde du bandeau,
   accès rapides, « À proposer » (deux listes côte à côte), « Ses chiffres » (grand chiffre centré + barres face à la moyenne). La suite plus bas (fichesuite).
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, D = J.D, OFF = J.OFF, MOY = J.MOY, S = J.S, T = J.T;
var F = S.fiche = { serie: 'ca' };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
function lignesId(Fi, o) {
  var I = Fi.identite, pros = o.statut === 'prospect';
  return [['Ville', esc(I.cp + ' ' + I.ville)], ['Adresse', esc(I.adresse)], ['Titulaire', esc(I.titulaires)], ['Groupement', esc(I.groupement)],
    ['Pharmaciens', esc(I.nbPharmaciens), 1], ['À savoir', esc(I.aSavoir), 1], ['Téléphone', esc(I.telephone) + (I.portable ? ' · ' + esc(I.portable) : ''), 1, 1], ['E-mail', esc(I.email), 1, 1],
    ['Logiciel', esc(I.logiciel || 'inconnu'), 1], ['Grossiste principal', esc(I.grossistePrincipal), 1], ['Offilog', o.clientOffilog ? 'Cliente Offilog' : 'Non cliente', 1], ['Cliente depuis', pros ? '' : esc(Fi.clienteDepuis), 1]];
}
function listeProp(titre, sous, ico, n, arr) {
  return '<section class="carte liste-prop" data-liste><div class="lp-tete"><span class="rond gris">' + J.ico(ico) + '</span><div><h2>' + esc(titre) + '</h2><p class="st">' + esc(sous) + '</p></div><div class="lp-n"><b class="num">' + nf.format(n) + '</b><span>produits</span></div></div>' +
    '<div class="lp-ronds">' + J.rond('doc', 'PDF', STUB('Télécharger en PDF')) + J.rond('down', 'Excel', STUB('Télécharger en Excel')) + J.rond('send', 'Envoyer cette liste', STUB('Envoyer cette liste'), 1) + '<button type="button" class="pil lp-ouvre" data-stub="' + STUB('Ouvrir le listing') + '">Ouvrir le listing</button></div>' +
    '<table class="tabl lp-tab"><thead><tr><th>Produit</th><th class="num">Officines qui le commandent</th></tr></thead><tbody>' +
    arr.map(function (p) { return '<tr><td><b class="lp-nom">' + esc(p.nom.split(',')[0]) + '</b><span class="sub">' + esc(p.famille) + '</span></td><td class="num"><span class="lp-bar"><span class="bar12"><i style="width:' + p.partOfficines + '%"></i></span><b>' + p.partOfficines + ' %</b></span></td></tr>'; }).join('') + '</tbody></table></section>';
}
function barreCmp(lib, col, val, moy, fmt, txtMoy, pv, sansMoy) {
  var ratio = moy ? val / moy : 0, top = Math.max(val, moy * 2) * 1.04, pv0 = top ? val / top * 100 : 0, pm = top ? moy / top * 100 : 0;
  return '<div class="cb"><div class="cb-t"><span class="cb-l"><span class="puce" style="background:' + col + '"></span><b>' + lib + '</b></span><span class="cb-v num">' + fmt(val) + '</span></div>' +
    (pv || sansMoy || !moy ? '' : '<div class="cb-pist" data-interne><i class="cb-b" style="width:' + pv0.toFixed(1) + '%;background:' + col + '"></i><i class="cb-m" style="left:' + pm.toFixed(1) + '%"></i></div><div class="cb-p" data-interne><span>' + txtMoy + '</span><b class="num">× ' + nf1.format(ratio) + ' la moyenne</b></div>') + '</div>';
}
/* « Voir le brief du jour » : avec JARVIS DAILY, un lien vers le brief du jour ; le nombre = les informations du jour qui citent cette officine (jamais un 7 écrit en dur) */
function briefBtn(o) {
  var L = J.daily && J.daily.pourOfficine ? J.daily.pourOfficine(o.id) : null;
  if (!L) return '<button type="button" class="pil plein f-brief" data-interne data-stub="' + STUB('Voir le brief du jour') + '">' + J.ico('chat') + 'Voir le brief du jour <b class="cpt7">7</b></button>';
  return '<a class="pil plein f-brief" data-interne href="#infos">' + J.ico('chat') + 'Voir le brief du jour' + (L.length ? ' <b class="cpt7">' + L.length + '</b>' : '') + '</a>';
}
J.ecrans.fiche = {
  rendre: function (el, etat) {
    if (etat.suite && etat.suite !== 'pharmacien' && J.offFiche(etat.suite)) S.off = etat.suite;   // adresse directe : #fiche-<id> (une officine du relevé ou du portefeuille)
    if (etat.suite === 'pharmacien' && S.vue !== 'pharmacien') { S.vue = 'pharmacien'; document.body.setAttribute('data-vue', 'pharmacien'); }
    if (etat.suite !== 'pharmacien' && S.vue !== 'integral') { S.vue = 'integral'; document.body.setAttribute('data-vue', 'integral'); }
    var o = J.offFiche(S.off) || OFF[0], Fi = J.ficheDe(o.id), I = Fi.identite, pv = S.vue === 'pharmacien', pros = o.statut === 'prospect';
    var mois = Fi.moisLabels, cm = Fi.caParMois, last = cm[cm.length - 1], prev = cm[cm.length - 2], evo = prev ? Math.round((last - prev) / prev * 100) : 0, ratio = (Fi.ca / mois.length) / MOY.caMois;
    var clientes = OFF.filter(function (x) { return x.statut !== 'prospect'; }), idx = clientes.indexOf(o);
    var gen = 0, tot = 0; Fi.categories.forEach(function (c) { tot += c.montant; if (c.cle === 'generiques') gen = c.montant; });
    var partGen = tot ? Math.round(gen / tot * 100) : 0, pm = Fi.margePharmacienParMois.reduce(function (a, b) { return a + b; }, 0) / mois.length, nm = Fi.margeNousParMois.reduce(function (a, b) { return a + b; }, 0) / mois.length;
    el.setAttribute('data-vue-actuelle', S.vue);
    var eyebrow = (pv ? 'Fiche officine' : 'Fiche officine · CIP ' + I.cip + ' · ' + (pros ? 'Prospect' : 'Cliente Intégral') + ' · ' + esc(D.secteur.commerciale)) + ' · <span class="vi">vue Intégral</span><span class="vp">vue pharmacien</span>';
    var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + (S.ficheDepuis ? 'Accueil' : 'Officines') + '</button><div class="f-pn" data-interne><button type="button" class="b-rond" data-pn="-1" aria-label="Officine précédente">' + J.ico('back') + '</button><button type="button" class="b-rond" data-pn="1" aria-label="Officine suivante">' + J.ico('chev') + '</button></div>' +
      '<label class="filtre f-autre" data-interne>' + J.ico('search') + '<select id="f-autre" aria-label="Autre officine"><option value="">Autre officine…</option>' + clientes.map(function (x) { return '<option value="' + x.id + '">' + esc(J.joli(x.nom)) + '</option>'; }).join('') + '</select></label>' +
      briefBtn(o);
    var vuebar = '<div class="vuebar' + (pv ? ' pharm' : '') + '"><span class="vb-ico">' + J.ico(pv ? 'eye' : 'lock') + '</span><div class="vb-t"><b>' + (pv ? 'Vue pharmacien' : 'Vue Intégral') + '</b><span>' + (pv ? 'rien d’interne à l’écran, vous pouvez la lui montrer.' : 'notre marge, rentabilité, comparaison à nos clients, vos notes. À ne pas lui montrer.') + '</span></div>' +
      '<div class="seg" role="group" aria-label="Vue"><button type="button" data-vue="integral" aria-pressed="' + !pv + '">Vue Intégral</button><button type="button" data-vue="pharmacien" aria-pressed="' + pv + '">Vue pharmacien</button></div></div>';
    var rondLien = function (ico, txt, href, plein) { return '<a class="rond-act' + (plein ? ' plein' : '') + '" href="' + esc(href) + '"><span class="rond"><span class="ico">' + J.icoSvg(ico) + '</span></span>' + txt + '</a>'; };
    var actions = '<div class="ronds" data-interne>' + rondLien('phone', 'Appeler', 'tel:' + String(I.telephone || '').replace(/[^\d+]/g, ''), 1) + rondLien('mail', 'E-mail', 'mailto:' + (I.email || '')) + rondLien('cal', 'Rendez-vous', '#rdv') + J.rond('note', 'Note', STUB('Prendre une note')) + rondLien('box', 'Produits', '#produits') + rondLien('chart', 'Comparer D2P', '#concurrents-prix') + '</div>' +
      '<button class="pil plein" type="button" data-interne data-stub="' + STUB('Choisir quoi lui transmettre') + '">' + J.ico('clip') + 'Choisir quoi lui transmettre</button>' +
      '<a class="pil contour" data-interne href="#todo">' + J.ico('tasks') + 'Ouvrir la liste de tâches <b class="cpt7">' + Fi.taches.filter(function (t) { return !t.fait; }).length + '</b></a>' +
      '<a class="pil contour" href="#lgo">' + J.ico('screen') + 'Catalogue pour ' + esc(I.logiciel || 'son logiciel') + '</a>';
    el.innerHTML = '<div class="page">' + J.bandeau({ classe: 'ban-fiche', deborde: true, eyebrow: eyebrow, actions: '', recherche: '<div class="f-outils">' + outils + '</div>', bas: vuebar }) +
      '<div class="sous-bandeau">' + J.identite({ nom: esc(J.joli(Fi.nom)), meta: '<span data-interne>' + J.etatHtml(J.etatOff(o)) + '</span>' + (pros ? '' : '<span data-interne>' + J.ordre(Fi.rang.france) + ' sur ' + nf.format(Fi.rang.surFrance) + ' officines actives</span>') + '<button type="button" class="pil clair f-modif" data-interne data-stub="' + STUB('Modifier') + '">' + J.ico('edit') + 'Modifier</button>',
        mois: pros ? null : { lib: J.ml(mois[mois.length - 1]) + ' 2026' + (pv ? ' · votre chiffre d’affaires' : ''), val: eur(last), evo: J.evoHtml(evo, 'sur ' + J.ml(mois[mois.length - 2])) },
        bas: pros ? '<p class="note" style="margin-top:14px">Aucune vente à ce jour · prospect de votre secteur</p>' : '', lignes: lignesId(Fi, o), actions: actions }) +
      '<div class="chips f-chips">' + [['f-prop', T('Voir ce que nous vous proposons', 'Voir ce qu’on peut lui proposer')], ['f-chiffres', T('Voir vos chiffres', 'Voir ses chiffres')], ['f-courbe', T('Voir la courbe de vos ventes', 'Voir la courbe des ventes')], ['f-cat', T('Voir vos catégories', 'Voir les catégories')], ['f-ne', T('Voir ce que vous ne commandez plus', 'Voir ce qu’elle ne commande plus')]].filter(function (c) { return !pros || c[0] === 'f-prop'; }).map(function (c) { return '<a href="#fiche" class="chip" data-ancre="' + c[0] + '">' + c[1] + '</a>'; }).join('') + '</div>' +
      '<h2 class="titre-s" id="f-prop">' + T('Ce que nous vous proposons', 'À lui proposer') + '<span class="st">deux listes, chacune fondée sur ce que commandent les officines de sa base · le pourcentage est la part des officines qui commandent le produit</span></h2>' +
      '<div class="gdeux stack entre">' + listeProp('Le réseau', 'Meilleures ventes nationales · réseau Intégral', 'net', Fi.aProposer.reseau.nbProduits, Fi.aProposer.reseau.premiers) + listeProp(I.groupement === 'Sans groupement' ? 'Listing du groupe d’achat' : 'Listing ' + I.groupement, 'Groupe d’achat · ' + I.groupement, 'group', Fi.aProposer.groupeAchat.nbProduits, Fi.aProposer.groupeAchat.premiers) + '</div>' +
      (pros ? '<section class="carte" id="f-chiffres"><div class="tete"><div><h2>' + T('Aucun achat chez nous à ce jour', 'Aucune vente à ce jour') + '</h2><p class="st">' + T('Pas encore de chiffres à comparer. Pour commencer, les deux listes ci-dessus montrent ce que commandent les officines du réseau et celles de votre groupe d’achat.', 'Pas encore de chiffres à comparer : pour préparer la visite, les deux listes ci-dessus montrent ce que commandent les officines du réseau et celles de son groupe d’achat.') + '</p></div></div></section>' :
      '<section class="carte c-chiffres" id="f-chiffres"><div class="tete"><div><h2>' + T('Vos chiffres', 'Ses chiffres, comparés à la moyenne de nos clients') + '</h2><p class="st">' + Fi.periode + ' · montants par mois et part des génériques, sur ses ' + mois.length + ' mois livrés' + (pv ? '' : ' · repère gris : l’officine moyenne de nos clients') + '</p></div></div>' +
      '<div class="hero"><span class="hero-l">' + T('Votre chiffre d’affaires', 'Chiffre d’affaires') + ' · cumul ' + Fi.periode + '</span><div class="hero-n num" id="f-ca">' + J.gros(eur(Fi.ca)) + '</div>' +
      (pros ? '' : '<div class="hero-p" data-interne><span class="mot">' + J.ordre(Fi.rang.groupement) + ' sur ' + Fi.rang.surGroupement + ' chez ' + esc(I.groupement) + '</span><span class="mot">' + nf.format(Fi.produitsDifferentsAchetes) + ' produits différents achetés</span></div>') + '</div>' +
      '<div class="cbs">' + barreCmp(T('Votre chiffre d’affaires par mois', 'Chiffre d’affaires par mois'), 'var(--c-ca)', Fi.ca / mois.length, MOY.caMois, eur, 'moyenne : ' + eur(MOY.caMois), pv) +
      barreCmp('Notre marge Intégral par mois', 'var(--c-nous)', nm, MOY.margeNousMois, eur, 'moyenne : ' + eur(MOY.margeNousMois), pv).replace('class="cb"', 'class="cb" data-interne') +
      barreCmp(T('Votre marge par mois', 'Marge du pharmacien par mois'), 'var(--c-pharma)', pm, MOY.margePharmacienMois, eur, 'moyenne : ' + eur(MOY.margePharmacienMois), pv) +
      barreCmp('Part des génériques dans ' + T('vos', 'ses') + ' achats', 'var(--cat-autre)', partGen, MOY.partGeneriques, function (v) { return nf.format(v) + ' %'; }, 'moyenne : ' + MOY.partGeneriques + ' %', pv) + '</div>' +
      '<p class="note" data-interne>Notre marge : génériques comptés à zéro. Même repère « moyenne » pour tout le bloc.</p></section>') +
      '<div id="f-suite" class="stack entre"></div></div></div>';
    J.poseIcones(el);
    if (J.fichesuite) J.fichesuite(el, o, Fi, { pv: pv, pros: pros, mois: mois, cm: cm, last: last, prev: prev, evo: evo, ratio: ratio, nm: nm, pm: pm });
    J.compter($('#f-ca', el), Fi.ca, function (v) { return J.gros(eur(v)); }, 1100);
    $$('[data-pn]', el).forEach(function (b) { b.onclick = function () { var k = idx + (+b.getAttribute('data-pn')); if (k < 0) k = clientes.length - 1; if (k >= clientes.length) k = 0; S.off = clientes[k].id; J.route(); }; });
    $('#f-autre', el).onchange = function (e) { if (e.target.value) { S.off = e.target.value; J.route(); } };
    $$('[data-ancre]', el).forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); var t = $('#' + a.getAttribute('data-ancre')); if (t) { var y = t.getBoundingClientRect().top + window.scrollY - 90; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); } }; });
  }
};
})();
/* ====================================================================================================================
   LA FICHE (suite) : courbe des ventes VISIBLE (moyenne étiquetée, record, lecture au doigt, tableau replié), ce que l'officine nous rapporte (interne),
   catégories face à la moyenne + place parmi nos clients, top 10, ne commande plus, rendez-vous / notes / tâches (interne), infos officine (interne).
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, eur = J.eur, nf = J.nf, nf1 = J.nf1, MOY = J.MOY, S = J.S, P = J.P, T = J.T;
function dessinerCourbe(Fi, c) {
  var pv = c.pv, mois = c.mois, cm = c.cm, last = cm.length - 1, best = cm.indexOf(Math.max.apply(null, cm)), cfg, textes, ml = J.ml, Fs = S.fiche;
  if (Fs.serie === 'ca') {
    var dessus = cm.filter(function (v) { return v >= MOY.caMois; }).length;
    $('#f-titre-c').textContent = pv ? 'Votre chiffre d’affaires mois par mois, de ' + ml(mois[0]) + ' à ' + ml(mois[last]) + ' 2026' : 'Au-dessus de l’officine moyenne de nos clients ' + dessus + ' mois sur ' + cm.length;
    $('#f-sous-c').textContent = T('Votre chiffre d’affaires net hors taxes par mois', 'Chiffre d’affaires net hors taxes par mois') + ', ' + Fi.periode + ' · record en ' + ml(mois[best]) + ' · le dernier mois est dans la carte d’identité.';
    cfg = { labels: mois, a: { vals: cm, col: 'var(--c-ca)' }, fmt: J.eurM, points: [best], repere: pv ? null : { v: MOY.caMois, txt: 'Moyenne de nos clients' }, aria: 'Chiffre d’affaires par mois', id: 'ca' };
    textes = cm.map(function (v, i) { return '<b>' + ml(mois[i]) + ' 2026</b> : ' + eur(v) + (pv ? '' : ', ' + (v >= MOY.caMois ? 'au-dessus de' : 'sous') + ' la moyenne de nos clients'); });
    $('#f-leg').innerHTML = '<span><i class="puce" style="background:var(--c-ca)"></i>' + T('Votre chiffre d’affaires', 'Chiffre d’affaires') + '</span>' + (pv ? '' : '<span data-interne><i class="trait"></i>Moyenne de nos clients</span>');
  } else {
    var ph = Fi.margePharmacienParMois, nu = Fi.margeNousParMois;
    $('#f-titre-c').textContent = pv ? 'Votre marge de pharmacien : ' + eur(ph[last]) + ' en ' + ml(mois[last]) : 'Marges en ' + ml(mois[last]) + ' : ' + eur(ph[last]) + ' pour le pharmacien, ' + eur(nu[last]) + ' pour nous';
    $('#f-sous-c').textContent = 'Même unité (euros par mois), ' + Fi.periode + (pv ? '.' : '. Notre marge : estimation, génériques comptés à zéro.');
    cfg = { labels: mois, a: { vals: ph, col: 'var(--c-pharma)' }, b: pv ? null : { vals: nu, col: 'var(--c-nous)' }, fmt: J.eurM, aria: 'Marges par mois', id: 'mg' };
    textes = ph.map(function (v, i) { return '<b>' + ml(mois[i]) + ' 2026</b> : marge du pharmacien ' + eur(v) + (pv ? '' : ', notre marge ' + eur(nu[i])); });
    $('#f-leg').innerHTML = '<span><i class="puce" style="background:var(--c-pharma)"></i>' + T('Votre marge', 'Marge du pharmacien') + '</span>' + (pv ? '' : '<span data-interne><i class="puce" style="background:var(--c-nous)"></i>Notre marge Intégral</span>');
  }
  J.dessine($('#f-histo'), function (w) { return J.courbe(cfg, w); }, function (box) { J.lie(box, textes, $('#f-lect')); });
  $('#f-tab').innerHTML = '<table class="tabl"><thead><tr><th>Mois</th><th class="num">Chiffre d’affaires net hors taxes</th><th class="num">Évolution sur un mois</th></tr></thead><tbody>' +
    cm.map(function (v, i) { var p = i ? cm[i - 1] : 0; return '<tr><td>' + ml(mois[i]) + '</td><td class="num">' + eur(v) + '</td><td class="num">' + (i && p ? J.signe((v - p) / p * 100) : '—') + '</td></tr>'; }).join('') +
    '<tr class="cumul"><td>Cumul ' + Fi.periode + '</td><td class="num">' + eur(Fi.ca) + '</td><td></td></tr></tbody></table><p class="note">Net : au prix facturé par Intégral, hors taxes, avoirs déduits.</p>';
}
function margeCarte(Fi) {
  var fam = P.secteurs[0].mois[11].margeParFamille.filter(function (f) { return f.part > 0; }), tot = Fi.margeNous, moy = MOY.margeNousMois * Fi.moisLabels.length, r = moy ? tot / moy : 0, mx = Math.max.apply(null, fam.map(function (f) { return f.part; }));
  return '<section class="carte" data-interne><div class="tete"><div><h2>Ce que cette officine nous rapporte</h2><p class="st">notre marge cumulée · ' + Fi.periode + ' · comparée à l’officine moyenne de nos clients sur le même nombre de mois livrés · génériques comptés à zéro</p></div></div>' +
    '<div class="duo"><div><span class="co-l">Total</span><div class="grand num">' + eur(tot) + '</div></div><div><span class="co-l">Moyenne de nos clients</span><div class="grand num gris">' + eur(moy) + '</div></div><div><span class="co-l">Face à la moyenne</span><div class="grand num">× ' + nf1.format(r) + '</div></div></div>' +
    '<table class="tabl"><thead><tr><th>Famille de produits</th><th class="num">Part de notre marge</th></tr></thead><tbody>' + fam.map(function (f) { return '<tr><td>' + esc(f.nom) + '</td><td class="num"><span class="lp-bar"><span class="bar12"><i style="width:' + (f.part / mx * 100).toFixed(1) + '%;background:var(--c-nous)"></i></span><b>' + nf1.format(f.part) + ' %</b><span class="fois">' + eur(tot * f.part / 100) + '</span></span></td></tr>'; }).join('') + '</tbody></table><p class="note">Répartition proportionnelle au réseau.</p></section>';
}
function frisePlace(Fi) {
  var n = 64, bars = '', pos = Math.max(1, Math.min(n, Math.round(Fi.rang.france / Fi.rang.surFrance * n))), w = 100 / n;
  for (var i = 0; i < n; i++) { var t = i / (n - 1), h = 10 + 62 * Math.exp(-Math.pow((t - .22) / .2, 2)) + 5 * Math.sin(i * 1.7); bars += '<i class="fb' + (i === n - pos ? ' moi' : '') + '" style="left:' + (i * w).toFixed(2) + '%;height:' + h.toFixed(0) + 'px"></i>'; }
  return '<div class="posit" data-interne><h3>Place parmi nos clients</h3><div class="frise-d" role="img" aria-label="Répartition de nos clients par chiffre d’affaires ; cette officine est ' + J.ordre(Fi.rang.france) + '">' + bars + '</div><div class="frise-ax"><span>Plus petit chiffre d’affaires</span><span>Plus grand</span></div><p class="note">Elle est ici, classée par chiffre d’affaires parmi nos clients actifs.</p></div>';
}
function infosOfficine(o, Fi) {
  var num = parseInt(o.id.replace(/\D/g, ''), 10), I = Fi.identite;
  return '<section class="carte" data-interne><div class="tete"><div><h2>Infos officine</h2><p class="st">ce que l’équipe a noté · réservé à l’interne</p></div><button type="button" class="pil" data-stub="La modification n’est pas dessinée dans cette maquette.">' + J.ico('edit') + 'Compléter</button></div>' +
    J.kv([['Interlocuteur', esc(I.titulaires.split(' et ')[0]) + ' · titulaire'], ['Prochaine relance', Fi.taches[0] ? J.dateFr(Fi.taches[0].echeance) + ' · à la suite du dernier mois' : ''], ['Commercial', esc(J.D.secteur.commerciale)], ['UGA', 'UGA ' + (12 + num % 40)], ['SIREN', '<span class="num">' + (400 + num) + ' ' + (100 + num * 7 % 900) + ' ' + (200 + num * 13 % 800) + '</span>', 0, 1],
      ['Génériqueur', ['Laboratoire 6', 'Laboratoire 3', 'Laboratoire 4', 'Laboratoire 5', 'Laboratoire 8'][num % 5]], ['Livraison', (num % 2 ? 'deux' : 'une') + ' fois par jour · dépôt ' + ['OPS', 'SOP', 'POS'][num % 3]], ['Offre Laboratoire 1 · Laboratoire 15', (num % 3 ? 'oui' : 'non') + ' · ' + (num % 2 ? 'oui' : 'non')], ['Potentiel', o.statut === 'prospect' ? eur(Math.round(MOY.caMois * 12 / 1000) * 1000) + ' par an · estimation : l’officine moyenne de nos clients' : eur(Math.round(o.ca * 1.3 / 1000) * 1000) + ' par an']], 'serree') + '</section>';
}
J.fichesuite = function (el, o, Fi, c) {
  var pv = c.pv, box = $('#f-suite', el), nMois = Fi.moisLabels.length, max = Math.max.apply(null, Fi.categories.map(function (k) { return Math.max(k.montant, pv ? 0 : k.moyenneClients * nMois); })), rdv = Fi.prochainRendezVous;
  box.innerHTML = (c.pros ? '' :
    '<section class="carte c-courbe" id="f-courbe"><div class="tete"><div><h2 id="f-titre-c"></h2><p class="st" id="f-sous-c"></p></div><div class="seg" role="group" aria-label="Série"><button type="button" data-serie="ca" aria-pressed="' + (S.fiche.serie === 'ca') + '">Chiffre d’affaires</button><button type="button" data-serie="marges" aria-pressed="' + (S.fiche.serie === 'marges') + '">Marges</button></div></div>' +
    '<div class="chart-box" id="f-histo"></div><p class="lecteur" id="f-lect" aria-live="polite">Touchez ou survolez un mois pour le lire.</p><div class="leg" id="f-leg"></div><details class="tabm"><summary>Voir le tableau</summary><div id="f-tab"></div></details></section>' +
    margeCarte(Fi) +
    '<section class="carte" id="f-cat"><div class="tete"><div><h2>' + T('Vos achats par catégorie', 'Ses achats par catégorie') + '</h2><p class="st">' + Fi.periode + ' · un trait par catégorie' + (pv ? '' : ', le repère gris est la moyenne de nos clients sur ' + nMois + ' mois') + '</p></div></div><div class="cbs">' +
    Fi.categories.map(function (k, i) { var v = k.montant / max * 100, m = k.moyenneClients * nMois / max * 100;
      return '<div class="cb"><div class="cb-t"><span class="cb-l"><span class="puce" style="background:var(--cat-' + (i + 1) + ')"></span><b>' + esc(k.nom) + '</b></span><span class="cb-v num">' + eur(k.montant) + '</span></div><div class="cb-pist"><i class="cb-b" style="width:' + v.toFixed(1) + '%;background:var(--cat-' + (i + 1) + ')"></i>' + (pv ? '' : '<i class="cb-m" data-interne style="left:' + m.toFixed(1) + '%"></i>') + '</div>' + (pv ? '' : '<div class="cb-p" data-interne><span>moyenne : ' + eur(k.moyenneClients * nMois) + '</span><b class="num">× ' + nf1.format(k.montant / (k.moyenneClients * nMois)) + '</b></div>') + '</div>'; }).join('') + '</div>' + frisePlace(Fi) + '</section>' +
    '<div class="gdeux stack"><section class="carte"><div class="tete"><div><h2>Top 10 · famille de produits</h2><p class="st">désignation, euros et boîtes sur la période</p></div></div><table class="tabl"><thead><tr><th>Produit</th><th class="num">Euros · boîtes</th></tr></thead><tbody>' + Fi.top10.map(function (p, i) { return '<tr><td><b class="lp-nom">' + (i + 1) + '. ' + esc(p.nom.split(',')[0]) + '</b><span class="sub">' + esc(p.famille) + '</span></td><td class="num"><b>' + eur(p.montant) + '</b><span class="fois">' + nf.format(p.quantite) + ' boîtes</span></td></tr>'; }).join('') + '</tbody></table></section>' +
    '<section class="carte" id="f-ne"><div class="tete"><div><h2>' + T('Ce que vous ne commandez plus', 'Ce qu’elle ne commande plus') + '</h2><p class="st">' + Fi.nePlusCommande.length + ' produits commandés au moins 4 mois, absents du dernier mois · case pleine : commandé ce mois-là</p></div></div><table class="tabl"><thead><tr><th>Produit</th><th class="num">janv. → oct.</th></tr></thead><tbody>' +
    Fi.nePlusCommande.map(function (p) { var k = new Date(p.derniereCommande).getMonth(), cases = ''; for (var i = 0; i < nMois; i++) cases += '<i class="' + (i <= k && i > k - 5 ? 'plein' : '') + '"></i>'; return '<tr><td><b class="lp-nom">' + esc(p.nom.split(',')[0]) + '</b><span class="sub">dernière commande : ' + J.dateFr(p.derniereCommande) + '</span></td><td class="num"><span class="frise-m" aria-label="Mois commandés">' + cases + '</span></td></tr>'; }).join('') + '</tbody></table></section></div>') +
    '<div class="gdeux stack"><section class="carte" data-interne><div class="tete"><div><h2>Rendez-vous, notes et tâches</h2><p class="st">ce qui prépare la visite · réservé à l’interne</p></div></div>' +
    '<div class="rdv"><span class="rond gris">' + J.ico('cal') + '</span><div>' + (rdv ? '<b>Prochain rendez-vous : ' + J.dateFr(rdv.date) + ' à ' + rdv.heure.replace(':', ' h ') + '</b><span class="sub">' + esc(rdv.lieu) + ' · ' + esc(rdv.objet) + '</span>' : '<b>Aucun rendez-vous prévu</b><span class="sub">Rien à votre agenda pour cette officine.</span>') + '</div><button type="button" class="pil" data-stub="Le rendez-vous n’est pas dessiné dans cette maquette.">Noter un rendez-vous</button></div>' +
    '<h3>Notes de l’équipe</h3>' + Fi.notes.map(function (n) { return '<p class="nt"><span class="co-l">' + J.dateFr(n.date) + '</span>' + esc(n.texte) + '</p>'; }).join('') + '<button type="button" class="chip" data-stub="La note n’est pas dessinée dans cette maquette.">' + J.ico('note') + 'Prendre une note</button>' +
    '<h3 class="h-tk">Tâches</h3>' + Fi.taches.map(function (t) { return '<p class="nt tk">' + J.ico(t.fait ? 'check' : 'list', t.fait ? 'var(--e-bien)' : 'var(--e-neutre)') + '<span>' + esc(t.texte) + '<span class="co-l"> · ' + J.dateFr(t.echeance) + '</span></span></p>'; }).join('') + '<button type="button" class="chip" data-stub="La tâche n’est pas dessinée dans cette maquette.">' + J.ico('plus') + 'Ajouter une tâche</button></section>' +
    infosOfficine(o, Fi) + '</div>';
  J.poseIcones(box);
  if (c.pros) return;   // un prospect n'a ni ventes, ni courbe, ni top 10
  dessinerCourbe(Fi, c);
  $$('[data-serie]', box).forEach(function (b) { b.onclick = function () { S.fiche.serie = b.getAttribute('data-serie'); $$('[data-serie]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); dessinerCourbe(Fi, c); }; });
};
})();
