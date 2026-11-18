/* Catalogue produits « Le comptoir » (#produits) et fiche d'un produit (#produits-detail).
   Bandeau bleu avec la recherche et les filtres du comptoir ; « Que voulez-vous faire ? » (trois portes) ; vues par public (Client = le catalogue d'une officine,
   Groupement / Prospect = composeur par famille, Catalogue = tout le catalogue, Achats = non dessinée) ; résultats en tableau à filets fins (produit, prix net — le même
   dans les 7 établissements —, stock en sept points, rang France, nos ventes, notre part) ; fiche du produit : bandeau court, carte d'identité qui déborde (prix net dans la
   clé-valeur), stock des 7 établissements, le marché France et nous (les produits du comptoir posés à leur vrai rang), les produits de la molécule (colonnes visibles,
   tableau replié). Tout ce qui est interne (prix nets, nos ventes, parts, opportunités, vues commerciales) porte data-interne. Données : DONNEES_V5.produits (fictives). */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, X = J.X.produits, S = J.S;
var P = S.produits = { fam: 'tout', opp: false, stock: false, top: 500, tri: 'potentiel', q: '', sel: '', mode: '', mol: '', off: '', offFiltre: 'tout', coches: {}, nb: 25, pub: '', compFam: {}, compNom: '' };
var FAML = {}; X.familles.forEach(function (f) { FAML[f.k] = f.l; });
var ETAB = X.etablissements, IDX = {}; X.lignes.forEach(function (p, k) { IDX[p.cip] = k; });
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var TRIS = {
  potentiel: function (a, b) { return (b.opportunite - a.opportunite) || (a.rangFrance - b.rangFrance); }, rang: function (a, b) { return a.rangFrance - b.rangFrance; },
  ventes: function (a, b) { return b.nosVentes - a.nosVentes; }, hausse: function (a, b) { return b.mouvement - a.mouvement; }, baisse: function (a, b) { return a.mouvement - b.mouvement; },
  az: function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); }
};
var TRI_L = { potentiel: 'potentiel', rang: 'rang France', ventes: 'nos ventes', hausse: 'notre part en hausse', baisse: 'notre part en baisse', az: 'A → Z' };
J.prTops = [50, 100, 200, 500]; J.prTriL = TRI_L;
J.prOrd = function (n) { return n === 1 ? '1er' : n + 'e'; };   // ordinal masculin (produit, logiciel) ; J.ordre est féminin (officine)
J.prNum = function (o) { return parseInt(o.id.replace(/\D/g, ''), 10); };
J.prCommande = function (o, p) { return ((J.prNum(o) * 31 + IDX[p.cip] * 17) % 5) < 2; };   // mode « officine » : ce qu'elle commande (indicateur fictif, déterministe)
var I_POS = Math.max(0, ETAB.indexOf('POS'));
J.prNet = function (p) { return p.prix[I_POS]; };   // un prix net par produit : le tarif est le même dans les 7 établissements ; la donnée fictive en porte 7 → celui de POS, l'export de référence
J.prProduit = function (cip) { var k = IDX[cip]; return k == null ? null : X.lignes[k]; };
J.prFaml = FAML; J.prEtab = ETAB; J.prStub = STUB;
J.prCptTxt = function (n) { return nf.format(n) + ' produit' + (n > 1 ? 's' : ''); };
/* à l'affichage seulement (les noms servent de clés de rapprochement ailleurs) : un nombre ne reste pas seul en bout de ligne, ni une unité loin de son nombre */
J.prNomLisible = function (nom) { return esc(nom).replace(/(\d) (?=mg|g\b|µg|ml|U\/ml|UI|%)/g, '$1 ').replace(/(\d) (?=\d{3}\b)/g, '$1 ').replace(/ (de|lot de) (\d+)/g, ' $1 $2'); };
J.prPubLib = function (k) { var v = X.publics.filter(function (x) { return x[0] === k; })[0]; return v ? v[1] : ''; };
function enStock(p) { return p.stock.some(function (s) { return s > 0; }); }
J.prFiltrees = function () {
  var q = P.q.toLowerCase(), offO = P.mode === 'officine' && P.off ? J.offById(P.off) : null;
  return X.lignes.filter(function (p) {
    if (P.fam !== 'tout' && p.famille !== P.fam) return false;
    if (P.opp && !p.opportunite) return false;
    if (P.stock && !enStock(p)) return false;
    if (p.rangFrance > P.top) return false;
    if (P.mode === 'molecule' && P.mol && p.molecule !== P.mol) return false;
    if (P.mode === 'compose') { var cf = Object.keys(P.compFam); if (cf.length && !P.compFam[p.famille]) return false; }
    if (offO && P.offFiltre !== 'tout') { var c = J.prCommande(offO, p); if (P.offFiltre === 'oui' && !c) return false; if (P.offFiltre === 'non' && c) return false; }
    if (q && (p.nom + ' ' + p.cip + ' ' + p.molecule + ' ' + p.labo + ' ' + FAML[p.famille]).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(TRIS[P.tri]);
};
/* ---------- pièces d'une ligne ---------- */
J.prStock = function (p) {
  var ok = 0, peu = 0; p.stock.forEach(function (s) { if (s >= 50) ok++; else if (s > 0) peu++; });
  var aria = 'Stock : ' + ok + ' établissement' + (ok > 1 ? 's' : '') + ' avec au moins 50 boîtes, ' + peu + ' avec moins de 50, ' + (7 - ok - peu) + ' sans stock';
  return '<span class="pr-stk" role="img" aria-label="' + aria + '">' + p.stock.map(function (s, i) { return '<i class="' + (s >= 50 ? 'ok' : s > 0 ? 'peu' : 'zero') + '" title="' + ETAB[i] + ' : ' + s + ' boîtes"></i>'; }).join('') + '</span>';
};
J.prBadges = function (p) { return (p.opportunite ? '<span class="etat" data-interne>' + J.ico('spark', 'var(--e-bien)') + 'Opportunité</span>' : '') + (p.quota ? '<span class="etat">' + J.ico('lock', 'var(--e-attention)') + 'Contingenté</span>' : ''); };
J.prMvt = function (p) { var ev = p.mouvement; return '<span class="evo">' + J.ico(ev < 0 ? 'bas' : 'haut', ev < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '<b class="num">' + (ev > 0 ? '+' : ev < 0 ? '−' : '') + nf1.format(Math.abs(ev)) + ' point</b></span>'; };
function coche(p) { return '<label class="pr-ck"><input type="checkbox" data-coche="' + p.cip + '" aria-label="Sélectionner ' + esc(p.nom.split(',')[0]) + '"' + (P.coches[p.cip] ? ' checked' : '') + '><span class="box">' + J.icoSvg('coche') + '</span></label>'; }
function ligne(p, i, offO) {
  var tete ='<td data-l="Produit"><div class="pr-id">' + coche(p) + '<div class="pr-txt"><b class="pr-nom">' + J.prNomLisible(p.nom) + '</b><span class="pr-meta"><span>' + esc(p.labo) + '</span><span class="pr-fam">' + esc(FAML[p.famille]) + '</span>' + J.prBadges(p) + '</span><span class="pr-cip num">CIP ' + p.cip + '</span></div></div></td>';
  return '<tr class="pr-l" data-produit="' + p.cip + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(p.nom.split(',')[0]) + '" style="--i:' + Math.min(i, 14) + '">' + tete +
    '<td class="num" data-l="Prix net" data-interne><b>' + J.eur2(J.prNet(p)) + '</b></td>' +
    '<td data-l="Stock des 7 établissements">' + J.prStock(p) + '</td>' +
    '<td class="num" data-l="Rang France"><b>' + J.ordre(p.rangFrance) + '</b><span class="fois">des meilleures ventes</span></td>' +
    '<td class="num" data-l="Nos ventes" data-interne><b data-n="' + p.nosVentes + '">' + nf.format(p.nosVentes) + '</b><span class="fois">boîtes</span></td>' +
    '<td class="num" data-l="Notre part" data-interne><b>' + nf1.format(p.part) + ' %</b>' + J.prMvt(p) + '</td>' +
    (offO ? '<td data-l="Chez elle" data-interne>' + (J.prCommande(offO, p) ? '<span class="etat">' + J.ico('check', 'var(--e-bien)') + 'Commandé</span>' : '<span class="etat">' + J.ico('user', 'var(--e-neutre)') + 'Pas encore</span>') + '</td>' : '') +
    '<td class="chev">' + J.ico('chev') + '</td></tr>';
}
function entete(offO) {
  return '<tr><th>Produit<span class="st">laboratoire · famille · CIP</span></th><th class="num" data-interne>Prix net<span class="st">hors taxes · le même dans les 7 établissements</span></th><th>Stock<span class="st">un point par établissement</span></th><th class="num">Rang France<span class="st">meilleures ventes</span></th><th class="num" data-interne>Nos ventes<span class="st">boîtes · ' + esc(X.periode) + '</span></th><th class="num" data-interne>Notre part<span class="st">du marché France · sur un an</span></th>' + (offO ? '<th data-interne>Chez elle<span class="st">' + esc(J.joli(offO.nom)) + '</span></th>' : '') + '<th></th></tr>';
}
J.prRemplir = function (el) {
  var l = J.prFiltrees(), aff = l.slice(0, P.nb), box = $('#pr-corps', el), offO = P.mode === 'officine' && P.off ? J.offById(P.off) : null;
  $('#pr-tete', el).innerHTML = entete(offO);
  box.innerHTML = aff.length ? aff.map(function (p, i) { return ligne(p, i, offO); }).join('') : '<tr><td colspan="8" class="vide">Aucun produit pour ces filtres' + (P.q ? ' et « ' + esc(P.q) + ' »' : '') + '.</td></tr>';
  var det = []; if (P.mode === 'molecule' && P.mol) det.push('molécule ' + esc(P.mol)); if (P.fam !== 'tout') det.push(FAML[P.fam].toLowerCase()); if (P.opp) det.push('opportunités seulement'); if (P.stock) det.push('en stock');
  if (P.mode === 'compose') { var cf = Object.keys(P.compFam); det.push('sélection ' + esc(J.prPubLib(P.pub)) + ' : ' + (cf.length ? cf.map(function (k) { return FAML[k].toLowerCase(); }).join(', ') : 'toutes les familles')); }
  var pn = $('#pr-n', el); if (pn) pn.textContent = J.prCptTxt(l.length);   // le nombre vit dans la phrase-réponse du bandeau, une seule fois
  $('#pr-cpt', el).innerHTML = l.length ? 'Classés par ' + TRI_L[P.tri] + (det.length ? ' · ' + det.join(' · ') : '') + ' · ' + Math.min(aff.length, l.length) + ' affiché' + (aff.length > 1 ? 's' : '') + ' · un clic ouvre la fiche' : '';
  $('#pr-plus', el).hidden = l.length <= P.nb;
  $$('[data-n]', box).slice(0, 4).forEach(function (e) { J.compter(e, +e.getAttribute('data-n'), function (v) { return nf.format(Math.round(v)); }, 800); });
  $$('tr[data-produit]', box).forEach(function (tr) { var go = function (ev) { if (ev.target.closest && ev.target.closest('.pr-ck')) return; P.sel = tr.getAttribute('data-produit'); J.aller('produits-detail'); };
    tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.target !== tr) return; if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(ev); } }); });   // la touche vient de la case à cocher : on la laisse au navigateur
  $$('[data-coche]', box).forEach(function (c) { c.addEventListener('change', function () { J.prCocher(c.getAttribute('data-coche'), c.checked, el); }); });
  J.poseIcones(box);
};
J.prCocher = function (cip, on, el) {
  if (on) P.coches[cip] = true; else delete P.coches[cip];
  var n = Object.keys(P.coches).length, bar = $('#pr-selbar', el);
  if (bar) { bar.hidden = !n; $('#pr-seln', bar).textContent = n + ' produit' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : ''); }
  $$('[data-coche="' + cip + '"]', el).forEach(function (c) { c.checked = on; });
  var b = $('[data-ajout="' + cip + '"]', el); if (b) { b.classList.toggle('plein', !on); b.lastChild.textContent = on ? 'Retirer de la sélection' : 'Ajouter à la sélection'; var ic = $('.rond .ico', b); if (ic) ic.innerHTML = J.icoSvg(on ? 'check' : 'plus'); }
  $$('[data-selection]', el).forEach(function (s) { var c = $('.cpt7', s); if (n) { if (!c) { c = document.createElement('b'); c.className = 'cpt7'; s.appendChild(c); } c.textContent = n; } else if (c) c.parentNode.removeChild(c); });
};
/* ---------- bandeau, portes, blocs de mode ---------- */
function bandeau() {
  var opp = X.lignes.filter(function (p) { return p.opportunite; }).length, nSel = Object.keys(P.coches).length, n = J.prFiltrees().length;
  return J.bandeau({ croix: true, eyebrow: 'Le comptoir · catalogue des 7 établissements', titre: 'Catalogue produits',
    lede: J.T('Le <b>prix net</b> de chaque référence et son <b>stock</b> dans chaque établissement : ', 'Le <b>prix net</b> de chaque référence, son <b>stock</b> dans chaque établissement, son rang France et notre part de marché : ') + '<b><span id="pr-n">' + J.prCptTxt(n) + '</span></b> au comptoir.<span data-interne> Une <b>opportunité</b> : un produit que la France achète beaucoup et que nos clients nous commandent peu.</span>',
    actions: '<button class="pil" type="button" data-selection>' + J.ico('clip') + 'Ma sélection' + (nSel ? '<b class="cpt7">' + nSel + '</b>' : '') + '</button>',
    recherche: { id: 'pr-q', placeholder: 'Nom, CIP, molécule, laboratoire…', aria: 'Rechercher un produit du catalogue', valeur: P.q },
    bas: '<span class="lbl">Afficher :</span><div class="seg" role="group" aria-label="Afficher" data-interne><button type="button" data-opp="0" aria-pressed="' + !P.opp + '">Tout</button><button type="button" data-opp="1" aria-pressed="' + P.opp + '">Opportunités <span class="cnt">' + opp + '</span></button></div>' +
      '<button type="button" class="pr-bascule" data-stock aria-pressed="' + P.stock + '">' + J.ico(P.stock ? 'coche' : 'plus') + 'En stock</button>' +
      '<label class="filtre">Meilleures ventes France :<select id="pr-top" aria-label="Meilleures ventes France">' + J.prTops.map(function (n) { return '<option value="' + n + '"' + (P.top === n ? ' selected' : '') + '>top ' + n + '</option>'; }).join('') + '</select></label>' +
      '<label class="filtre">Trier :<select id="pr-tri" aria-label="Trier">' + Object.keys(TRI_L).map(function (k) { return '<option value="' + k + '"' + (P.tri === k ? ' selected' : '') + '>' + TRI_L[k] + '</option>'; }).join('') + '</select></label>' });
}
function portes() {
  var ICO = { officine: 'pharma', molecule: 'pill', tout: 'layers' };
  return '<h2 class="titre-s">Que voulez-vous faire ?</h2><div class="gtrois stack entre pr-portes">' + X.portes.map(function (p, i) {
    var on = (p.k === 'officine' && P.mode === 'officine') || (p.k === 'molecule' && P.mode === 'molecule');
    return '<button type="button" class="carte pr-porte' + (on ? ' on' : '') + '" data-porte="' + p.k + '" aria-pressed="' + on + '" style="--i:' + i + '"' + (p.k === 'officine' ? ' data-interne' : '') + '><span class="rond">' + J.ico(ICO[p.k]) + '</span><span class="pr-ptxt"><b>' + esc(p.t) + '</b><span class="sub">' + esc(p.s) + '</span></span>' + J.ico('chev') + '</button>'; }).join('') + '</div>';
}
function blocOfficine() {
  var cl = J.OFF.filter(function (o) { return o.statut !== 'prospect'; }), o = P.off ? J.offById(P.off) : null, Fi = o ? J.ficheDe(o.id) : null;
  return '<section class="carte pr-mode entre" data-interne><div class="tete"><div><h2>Le catalogue d’une officine</h2><p class="st">calé sur ce qu’elle nous commande · le PDF part dans le format de son logiciel</p></div>' +
    '<label class="filtre">' + J.ico('search') + '<select id="pr-off" aria-label="Officine"><option value="">Choisir une officine…</option>' + cl.map(function (x) { return '<option value="' + x.id + '"' + (x.id === P.off ? ' selected' : '') + '>' + esc(J.joli(x.nom)) + ' · ' + esc(x.ville) + '</option>'; }).join('') + '</select></label></div>' +
    (o ? '<div class="pr-offl"><span class="pr-av" aria-hidden="true">' + esc(J.ini(o.nom)) + '</span><div class="pr-offt"><b>' + esc(J.joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + ' · ' + esc(o.groupement) + ' · logiciel ' + esc(Fi.identite.logiciel || 'inconnu') + '</span></div>' +
      '<div class="seg" role="group" aria-label="Chez elle"><button type="button" data-offf="tout" aria-pressed="' + (P.offFiltre === 'tout') + '">Tout</button><button type="button" data-offf="oui" aria-pressed="' + (P.offFiltre === 'oui') + '">Ce qu’elle commande</button><button type="button" data-offf="non" aria-pressed="' + (P.offFiltre === 'non') + '">Pas encore</button></div>' +
      '<div class="pr-offa"><button type="button" class="pil plein" data-stub="' + STUB('Préparer le PDF pour l’officine') + '">' + J.ico('doc') + 'PDF pour l’officine</button><button type="button" class="pil" data-stub="' + STUB('Préparer le catalogue pour son logiciel') + '">' + J.ico('screen') + 'Catalogue pour ' + esc(Fi.identite.logiciel || 'son logiciel') + '</button><button type="button" class="pil" data-fiche="' + o.id + '">' + J.ico('pharma') + 'Ouvrir sa fiche</button></div></div>' : '<p class="note">Choisissez une officine : la colonne « Chez elle » dit ce qu’elle commande déjà et ce qu’elle ne commande pas encore.</p>') + '</section>';
}
function blocMolecule() {
  var mols = []; X.lignes.forEach(function (p) { if (p.famille !== 'para' && mols.indexOf(p.molecule) < 0) mols.push(p.molecule); }); mols.sort();
  return '<section class="carte pr-mode entre"><div class="tete"><div><h2>Les produits de la molécule</h2><p class="st">princeps, génériques et biosimilaires côte à côte · <span data-interne>nos ventes en boîtes · </span>le tableau ne montre plus qu’eux</p></div>' +
    '<label class="filtre">' + J.ico('pill') + '<select id="pr-mol" aria-label="Molécule"><option value="">Choisir une molécule…</option>' + mols.map(function (m) { return '<option value="' + esc(m) + '"' + (m === P.mol ? ' selected' : '') + '>' + esc(J.maj(m)) + '</option>'; }).join('') + '</select></label></div>' +
    (P.mol ? '<div data-interne><div class="seg" role="group" aria-label="Comparer"><button type="button" aria-pressed="true">Votre secteur</button><button type="button" aria-pressed="false" data-stub="' + STUB('Les commerciaux, face à la France') + '">Les commerciaux, face à la France</button></div><div class="chart-box" id="pr-histo"></div><p class="lecteur" id="pr-lect" aria-live="polite">Touchez ou survolez un produit pour le lire.</p><div class="leg"><span><i class="puce" style="background:var(--c-cmd)"></i>Nos ventes du produit, en boîtes</span></div></div>' : '<p class="note">Choisissez une molécule : ses produits se comparent en boîtes vendues, et le tableau ne montre plus qu’eux.</p>') + '</section>';
}
/* composeur par famille des vues Groupement / Prospect : « Sélection produits — <titre> », choix des familles, nom pour le PDF, PDF */
function blocCompose() {
  var lib = J.prPubLib(P.pub), PH = { groupement: 'Nom du groupement (pour le PDF)', prospect: 'Nom de l’officine (pour le PDF)' }, ph = PH[P.pub] || 'Nom (pour le PDF)', n = Object.keys(P.compFam).length;
  return '<section class="carte pr-mode pr-comp entre" data-interne><div class="tete"><div><h2>Sélection produits — ' + esc(lib) + '</h2><p class="st">' + (P.pub === 'prospect' ? 'sur mesure, pour une officine qui ne nous commande pas encore' : 'pour les adhérents d’un groupe d’achat') + ' · cochez des familles : le tableau ne montre plus qu’elles, et le PDF reprend ces produits avec leurs prix nets</p></div>' +
    '<label class="filtre pr-comp-nom">' + J.ico('edit') + '<input id="pr-comp-nom" type="text" placeholder="' + ph + '" aria-label="' + ph + '" value="' + esc(P.compNom) + '" autocomplete="off"></label></div>' +
    '<div class="chips pr-comp-fams" role="group" aria-label="Familles de la sélection">' + X.familles.map(function (f) { var on = !!P.compFam[f.k]; return '<button type="button" class="chip pr-fchip' + (on ? ' on' : '') + '" data-cfam="' + f.k + '" aria-pressed="' + on + '">' + J.ico(on ? 'coche' : 'plus') + esc(f.l) + '</button>'; }).join('') + '</div>' +
    '<div class="pr-offa"><button type="button" class="pil plein" data-stub="' + STUB('Préparer le PDF « Sélection produits — ' + lib + ' »') + '">' + J.ico('doc') + 'PDF de la sélection</button><button type="button" class="pil" data-stub="' + STUB('Télécharger la sélection en Excel') + '">' + J.ico('down') + 'Excel</button>' + (n ? '<button type="button" class="pil" data-comp-vider>' + J.ico('close') + 'Tout décocher</button>' : '') + '</div></section>';
}
J.prPieces = { bandeau: bandeau, portes: portes, blocOfficine: blocOfficine, blocMolecule: blocMolecule, blocCompose: blocCompose };
})();
/* ====================================================================================================================
   RENDU DE L'ÉCRAN (liste, modes, sélection) ET FICHE DU PRODUIT (#produits-detail) : bandeau court (retour, précédent / suivant, « Autre produit… »,
   Ma sélection), carte d'identité qui déborde du bandeau, prix net et stock des 7 établissements, le marché France et nous (grand chiffre,
   barre face à la part moyenne, place dans les meilleures ventes), les produits de la molécule (colonnes visibles, tableau replié).
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, X = J.X.produits, P = J.S.produits, FAML = J.prFaml, ETAB = J.prEtab, STUB = J.prStub, PZ = J.prPieces;
var ICO_PUB = { client: 'pharma', groupement: 'group', prospect: 'user', catalogue: 'layers', achats: 'euro' };
/* vues par public : Client = le catalogue d'une officine (bloc officine), Groupement / Prospect = composeur par famille, Catalogue = tout le catalogue ; la vue « Achats » n'est pas dessinée : elle répond par un message */
function vuesPublic() {
  var b = function (ico, lib, on, extra) { return '<button type="button"' + (on ? ' class="on"' : '') + ' aria-pressed="' + on + '"' + extra + '>' + J.ico(ico) + esc(lib) + '</button>'; };
  return '<div class="vues" role="group" aria-label="Vues du catalogue">' + b('box', 'Le comptoir', !P.pub, ' data-pub=""') + X.publics.map(function (v) {
    return v[0] === 'achats' ? b(ICO_PUB[v[0]], v[1], false, ' data-stub="La vue « Achats » n’est pas dessinée dans cette maquette."') : b(ICO_PUB[v[0]] || 'more', v[1], P.pub === v[0], ' data-pub="' + v[0] + '"'); }).join('') + '</div>';
}
function chipsFam() { return '<div class="chips pr-fams" role="group" aria-label="Familles">' + [{ k: 'tout', l: 'Toutes les familles' }].concat(X.familles).map(function (f) { return '<button type="button" class="chip pr-fchip' + (P.fam === f.k ? ' on' : '') + '" data-fam="' + f.k + '" aria-pressed="' + (P.fam === f.k) + '">' + esc(f.l) + '</button>'; }).join('') + '</div>'; }
function legende() { return '<p class="pr-legl">Stock : <i class="pr-pt ok"></i> au moins 50 boîtes · <i class="pr-pt peu"></i> de 1 à 49 · <i class="pr-pt zero"></i> aucune — un point par établissement, de gauche à droite ' + ETAB.join(', ') + '. <span data-interne>Part moyenne de nos clients sur ces produits : <b>' + nf1.format(X.partMoyenne) + ' %</b> ; la flèche donne le mouvement sur un an.</span></p>'; }
function selbar() { var n = Object.keys(P.coches).length; return '<div class="pr-selbar" id="pr-selbar"' + (n ? '' : ' hidden') + '><span class="pr-seln" id="pr-seln">' + n + ' produit' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : '') + '</span><div class="pr-selr">' + J.rond('doc', 'PDF', STUB('Télécharger la sélection en PDF')) + J.rond('down', 'Excel', STUB('Télécharger la sélection en Excel')) + J.rond('send', 'Envoyer', STUB('Envoyer la sélection'), 1) + J.rond('close', 'Vider', null, 0, ' data-vider') + '</div></div>'; }
function viderSel(el) { Object.keys(P.coches).forEach(function (c) { J.prCocher(c, false, el); }); }
function toastSel() { var n = Object.keys(P.coches).length; J.toast(n ? n + ' produit' + (n > 1 ? 's' : '') + ' dans la sélection : PDF, Excel ou envoi dans la barre en bas de l’écran.' : 'Cochez des produits dans le tableau, ou « Ajouter à la sélection » sur une fiche : la sélection part ensuite en PDF ou en Excel.'); }
function produitsMol(mol) { return X.lignes.filter(function (p) { return p.molecule === mol; }).sort(function (a, b) { return b.nosVentes - a.nosVentes; }); }
function dessinerMol(el, mol, selCip) {
  var tous = produitsMol(mol), box = $('#pr-histo', el); if (!box || !tous.length) return;
  var cpt = {}; tous.forEach(function (p) { var b = p.nom.split(/[ ,]/)[0]; cpt[b] = (cpt[b] || 0) + 1; });
  var etiq = tous.map(function (p) { var b = p.nom.split(/[ ,]/)[0], m = p.nom.match(/présentation (\d+)/); return { b: b, s: cpt[b] > 1 ? ' · ' + (m ? m[1] : '1') : '' }; });   // deux présentations d'une même marque dans la série : le numéro les distingue
  J.dessine(box, function (w) { var court = w < 560, ps = court ? tous.slice(0, 6) : tous, iSel = -1; box.setAttribute('data-n', ps.length); ps.forEach(function (p, i) { if (p.cip === selCip) iSel = i; });
    return J.colonnes({ vals: ps.map(function (p) { return p.nosVentes; }), labels: ps.map(function (p, i) { var e = etiq[i]; return (court && e.b.length > 7 ? e.b.slice(0, 6) + '…' : e.b) + e.s; }), couleur: 'var(--c-cmd)', sel: iSel >= 0 ? [iSel] : null, h: 200, aria: 'Nos ventes par produit de la molécule ' + mol }, w); },
    function (b) { var ps = tous.slice(0, +b.getAttribute('data-n') || tous.length), lect = $('#pr-lect', el); J.lie(b, ps.map(function (p) { return '<b>' + esc(p.nom) + '</b> · ' + esc(p.labo) + ' : ' + nf.format(p.nosVentes) + ' boîtes, ' + J.ordre(p.rangFrance) + ' des meilleures ventes France'; }), lect);
      if (lect) lect.innerHTML = (ps.length < tous.length ? 'Les ' + ps.length + ' produits les plus vendus de la molécule (sur ' + tous.length + '). ' : '') + 'Touchez ou survolez une colonne pour la lire.'; });
}
function brancher(el) {
  var r25 = function () { P.nb = 25; };
  $$('[data-opp]', el).forEach(function (b) { b.onclick = function () { P.opp = b.getAttribute('data-opp') === '1'; r25(); J.route(); }; });
  $('[data-stock]', el).onclick = function () { P.stock = !P.stock; r25(); J.route(); };
  $('#pr-top', el).onchange = function (e) { P.top = +e.target.value; r25(); J.prRemplir(el); };
  $('#pr-tri', el).onchange = function (e) { P.tri = e.target.value; J.prRemplir(el); };
  $('#pr-q', el).oninput = function (e) { P.q = e.target.value; r25(); J.prRemplir(el); };
  $$('[data-fam]', el).forEach(function (b) { b.onclick = function () { P.fam = b.getAttribute('data-fam'); r25(); $$('[data-fam]', el).forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); J.prRemplir(el); }; });
  var vers = function (sel) { var t = $(sel, el); if (t) window.scrollTo(0, Math.max(0, t.getBoundingClientRect().top + window.scrollY - 90)); };
  $$('[data-pub]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-pub'); r25(); P.pub = k;
    if (k === 'catalogue') { P.mode = ''; P.fam = 'tout'; P.opp = false; P.stock = false; P.q = ''; P.mol = ''; P.off = ''; J.route(); vers('#pr-cpt'); return; }
    if (k === 'client') { P.mode = 'officine'; J.route(); vers('.pr-mode'); return; }
    if (k === 'groupement' || k === 'prospect') { P.mode = 'compose'; P.fam = 'tout'; J.route(); vers('.pr-mode'); return; }
    P.mode = ''; J.route(); }; });
  $$('[data-cfam]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-cfam'); if (P.compFam[k]) delete P.compFam[k]; else P.compFam[k] = true; r25(); J.route(); vers('.pr-mode'); }; });
  var cn = $('#pr-comp-nom', el); if (cn) cn.oninput = function (e) { P.compNom = e.target.value; };
  var cv = $('[data-comp-vider]', el); if (cv) cv.onclick = function () { P.compFam = {}; r25(); J.route(); vers('.pr-mode'); };
  $$('[data-porte]', el).forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-porte'); P.pub = '';
    if (k === 'tout') { P.mode = ''; P.fam = 'tout'; P.opp = false; P.stock = false; P.q = ''; P.mol = ''; P.off = ''; r25(); J.route(); vers('#pr-cpt'); return; }
    P.mode = P.mode === k ? '' : k; r25(); J.route(); if (P.mode) vers('.pr-mode'); }; });
  var so = $('#pr-off', el); if (so) so.onchange = function (e) { P.off = e.target.value; P.offFiltre = 'tout'; r25(); J.route(); vers('.pr-mode'); };
  $$('[data-offf]', el).forEach(function (b) { b.onclick = function () { P.offFiltre = b.getAttribute('data-offf'); r25(); J.route(); vers('.pr-mode'); }; });
  var fi = $('[data-fiche]', el); if (fi) fi.onclick = function () { if (J.ouvrirFiche) J.ouvrirFiche(fi.getAttribute('data-fiche')); };
  var sm = $('#pr-mol', el); if (sm) sm.onchange = function (e) { P.mol = e.target.value; r25(); J.route(); vers('.pr-mode'); };
  $('#pr-plus', el).onclick = function () { P.nb += 25; J.prRemplir(el); };
  $$('[data-selection]', el).forEach(function (b) { b.onclick = toastSel; });
  var vd = $('[data-vider]', el); if (vd) vd.onclick = function () { viderSel(el); };
  var lm = $('[data-mol-mode]', el); if (lm) lm.onclick = function () { P.mode = 'molecule'; J.route(); vers('.pr-mode'); };
}
/* ---------- la fiche du produit ---------- */
/* place dans les meilleures ventes France : une ligne 1re → 500e, les produits du comptoir posés à leur VRAI rang (donnée rangFrance), ce produit en bleu — rien d'inventé */
function position(p) {
  var top = J.prTops[J.prTops.length - 1], pos = function (r) { return ((Math.min(r, top) - 1) / (top - 1) * 100).toFixed(2); };
  var autres = X.lignes.filter(function (q) { return q.cip !== p.cip; }).map(function (q) { return '<i class="pr-fb" style="left:' + pos(q.rangFrance) + '%" title="' + esc(q.nom) + ' : ' + J.ordre(q.rangFrance) + '"></i>'; }).join('');
  return '<div class="pr-posit"><h3>Place dans les meilleures ventes France</h3><div class="pr-frise" role="img" aria-label="Les ' + X.lignes.length + ' produits du comptoir, posés sur le classement des ' + top + ' meilleures ventes France ; ce produit est ' + J.ordre(p.rangFrance) + '">' + autres + '<i class="pr-fb moi" style="left:' + pos(p.rangFrance) + '%"></i></div><div class="pr-fax"><span>1re vente de France</span><span>' + J.ordre(top) + '</span></div><p class="note">Chaque trait gris est un produit du comptoir, posé à son rang dans les ventes France sur un an ; le trait bleu est ce produit.</p></div>';
}
function ficheHtml(p, liste) {
  var on = !!P.coches[p.cip], para = p.famille === 'para', k = liste.indexOf(p), nSel = Object.keys(P.coches).length, avecStock = p.stock.filter(function (s) { return s > 0; }).length, maxS = Math.max.apply(null, p.stock.concat([1]));
  var ratio = X.partMoyenne ? p.part / X.partMoyenne : 0, topB = Math.max(p.part, X.partMoyenne * 2) * 1.04, wB = topB ? p.part / topB * 100 : 0, mB = topB ? X.partMoyenne / topB * 100 : 0, mols = produitsMol(p.molecule);
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Le comptoir</button><div class="pr-pn"><button type="button" class="b-rond" data-pn="-1" aria-label="Produit précédent">' + J.ico('back') + '</button><button type="button" class="b-rond" data-pn="1" aria-label="Produit suivant">' + J.ico('chev') + '</button></div>' +
    '<label class="filtre pr-autre">' + J.ico('search') + '<select id="pr-autre" aria-label="Autre produit du comptoir"><option value="">Autre produit du comptoir…</option>' + liste.map(function (x) { return '<option value="' + x.cip + '">' + esc(x.nom) + '</option>'; }).join('') + '</select></label>' +
    '<button type="button" class="pil plein pr-selp" data-selection>' + J.ico('clip') + 'Ma sélection' + (nSel ? '<b class="cpt7">' + nSel + '</b>' : '') + '</button>';
  var actions = '<div class="ronds pr-ronds">' + J.rond(on ? 'check' : 'plus', on ? 'Retirer de la sélection' : 'Ajouter à la sélection', null, !on, ' data-ajout="' + p.cip + '"') + J.rond('doc', 'Fiche PDF', STUB('Télécharger la fiche produit')) + J.rond('down', 'Excel', STUB('Télécharger en Excel')) + J.rond('send', 'Envoyer', STUB('Envoyer la fiche')) + '</div>' +
    '<button class="pil plein" type="button" data-interne data-stub="' + STUB('Proposer ce produit à une officine') + '">' + J.ico('pharma') + 'Proposer à une officine</button>' +
    (para ? '' : '<button class="pil contour" type="button" data-voir-mol>' + J.ico('pill') + 'Les produits de la molécule</button>');
  return J.bandeau({ classe: 'pr-ban', deborde: true, eyebrow: 'Fiche produit · ' + (k >= 0 ? J.prOrd(k + 1) + ' sur ' + liste.length + ' au comptoir, par ' + esc(J.prTriL[P.tri]) : 'hors des filtres du comptoir'), recherche: '<div class="pr-outils">' + outils + '</div>' }) +
    '<div class="sous-bandeau">' + J.identite({ classe: 'pr-ident', nom: J.prNomLisible(p.nom), meta: J.prBadges(p) + (avecStock ? '' : '<span class="etat">' + J.ico('box', 'var(--e-alerte)') + 'Aucun stock</span>'),
      mois: { lib: 'Notre part du marché France · sur un an', val: nf1.format(p.part) + ' %', evo: J.prMvt(p) },
      lignes: [['CIP', '<span class="num">' + p.cip + '</span>', 0, 1], ['Molécule', para ? '—' : esc(J.maj(p.molecule))], ['Laboratoire', esc(p.labo)], ['Famille', esc(FAML[p.famille])],
        ['Prix net', '<span class="num">' + J.eur2(J.prNet(p)) + '</span> <span class="sub" style="display:inline">hors taxes · le même dans les 7 établissements · réservé à l’interne</span>', 1],
        ['Rang France', J.ordre(p.rangFrance) + ' des meilleures ventes, sur un an'], ['En stock', avecStock ? avecStock + ' établissement' + (avecStock > 1 ? 's' : '') + ' sur ' + ETAB.length : 'aucun établissement pour l’instant'], ['Contingentement', p.quota ? 'Oui · quantité limitée par commande' : 'Non'], ['Ventes comptées', esc(X.periode)]], actions: actions }) +
    '<div class="chips pr-chips">' + [['pr-etabs', 'Stock par établissement'], ['pr-marche', 'Le marché France et nous', 1]].concat(para ? [] : [['pr-mol', 'Les produits de la molécule', 1]]).map(function (c) { return '<a href="#produits-detail" class="chip" data-ancre="' + c[0] + '"' + (c[2] ? ' data-interne' : '') + '>' + c[1] + '</a>'; }).join('') + '</div>' +
    '<div class="gdeux stack entre pr-fdeux">' +
      '<section class="carte" id="pr-etabs"><div class="tete"><div><h2>Stock, établissement par établissement</h2><p class="st">en boîtes · le point dit le niveau : au moins 50, de 1 à 49, aucune</p></div></div>' +
      '<table class="tabl pr-etab"><thead><tr><th>Établissement</th><th class="num">Stock<span class="st">boîtes</span></th></tr></thead><tbody>' +
      ETAB.map(function (e, i) { var s = p.stock[i]; return '<tr><td><b>' + e + '</b></td><td class="num"><span class="pr-stkn"><span class="bar12 pr-sbar"><i style="width:' + Math.round(s / maxS * 100) + '%"></i></span><i class="pr-pt ' + (s >= 50 ? 'ok' : s > 0 ? 'peu' : 'zero') + '"></i><b>' + nf.format(s) + '</b></span></td></tr>'; }).join('') +
      '</tbody></table><p class="note">Le prix net ne dépend pas de l’établissement : il est dans la carte d’identité.</p></section>' +
      '<section class="carte" id="pr-marche" data-interne><div class="tete"><div><h2>Le marché France et nous</h2><p class="st">nos ventes en boîtes, notre part face à la part moyenne de nos clients, la place du produit parmi les meilleures ventes France</p></div></div>' +
      '<div class="pr-hero"><span class="pr-hero-l">Nos ventes · boîtes</span><div class="pr-hero-n num" id="pr-nv">' + nf.format(p.nosVentes) + '</div></div>' +
      '<div class="cb pr-cb"><div class="cb-t"><span class="cb-l"><span class="puce" style="background:var(--c-ca)"></span><b>Notre part, face à la moyenne de nos clients</b></span></div><div class="cb-pist"><i class="cb-b" style="width:' + wB.toFixed(1) + '%;background:var(--c-ca)"></i><i class="cb-m" style="left:' + mB.toFixed(1) + '%"></i></div><div class="cb-p"><span>part moyenne de nos clients : ' + nf1.format(X.partMoyenne) + ' %</span><b class="num">× ' + nf1.format(ratio) + ' la moyenne</b></div></div>' +
      position(p) + '</section></div>' +
    (para ? '' : '<section class="carte pr-cmol" id="pr-mol" data-interne><div class="tete"><div><h2>Les produits ' + (/^[aeiouyàâéèêîôû]/i.test(p.molecule) ? 'd’' : 'de ') + esc(p.molecule) + '</h2><p class="st">princeps, génériques et biosimilaires côte à côte · nos ventes en boîtes · la colonne en couleur est ce produit</p></div><button type="button" class="pil" data-voir-mol>' + J.ico('pill') + 'Ouvrir au comptoir</button></div>' +
      '<div class="chart-box" id="pr-histo"></div><p class="lecteur" id="pr-lect" aria-live="polite">Touchez ou survolez une colonne pour la lire.</p><div class="leg"><span><i class="puce" style="background:var(--c-cmd)"></i>Ce produit</span><span><i class="puce" style="background:#C9D3E6"></i>Les autres produits de la molécule</span></div>' +
      '<details class="tabm"><summary>Voir le tableau</summary><div class="tabl-wrap"><table class="tabl pr-tmol"><thead><tr><th>Produit<span class="st">laboratoire · famille</span></th><th class="num">Rang France</th><th class="num">Nos ventes<span class="st">boîtes</span></th><th class="num">Notre part</th></tr></thead><tbody>' +
      mols.map(function (m) { return '<tr' + (m.cip === p.cip ? ' class="lu"' : ' data-produit="' + m.cip + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(m.nom.split(',')[0]) + '"') + '><td><b class="pr-tnom">' + J.prNomLisible(m.nom) + '</b><span class="sub">' + esc(m.labo) + ' · ' + esc(FAML[m.famille]) + '</span></td><td class="num">' + J.ordre(m.rangFrance) + '</td><td class="num"><b>' + nf.format(m.nosVentes) + '</b></td><td class="num">' + nf1.format(m.part) + ' %</td></tr>'; }).join('') +
      '</tbody></table></div></details></section>');
}
function brancherFiche(el, p, liste) {
  var k = liste.indexOf(p);
  $$('[data-pn]', el).forEach(function (b) { b.onclick = function () { if (!liste.length) return; var i = k + (+b.getAttribute('data-pn')); if (i < 0) i = liste.length - 1; if (i >= liste.length) i = 0; P.sel = liste[i].cip; J.route(); }; });
  $('#pr-autre', el).onchange = function (e) { if (e.target.value) { P.sel = e.target.value; J.route(); } };
  $$('[data-selection]', el).forEach(function (b) { b.onclick = toastSel; });
  var a = $('[data-ajout]', el); if (a) a.onclick = function () { J.prCocher(p.cip, !P.coches[p.cip], el); };
  $$('[data-voir-mol]', el).forEach(function (b) { b.onclick = function () { P.mode = 'molecule'; P.mol = p.molecule; P.nb = 25; J.aller('produits'); }; });
  $$('[data-ancre]', el).forEach(function (x) { x.onclick = function (ev) { ev.preventDefault(); var t = $('#' + x.getAttribute('data-ancre'), el); if (t) { var y = t.getBoundingClientRect().top + window.scrollY - 90; window.scrollTo(0, isFinite(y) ? Math.max(0, y) : 0); } }; });
  $$('tr[data-produit]', el).forEach(function (tr) { var go = function () { P.sel = tr.getAttribute('data-produit'); J.route(); }; tr.addEventListener('click', go); tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }); });
  var vd = $('[data-vider]', el); if (vd) vd.onclick = function () { viderSel(el); };
}
J.ecrans.produits = {
  rendre: function (el, etat) {
    var liste = J.prFiltrees();
    if (etat.suite === 'detail') {
      var p = J.prProduit(P.sel) || liste[0] || X.lignes[0]; P.sel = p.cip;
      el.innerHTML = '<div class="page">' + ficheHtml(p, liste) + selbar() + '</div>';
      var im = $('.pr-ident .ident-mois', el); if (im) im.setAttribute('data-interne', '');
      window.scrollTo(0, 0); J.poseIcones(el); brancherFiche(el, p, liste); dessinerMol(el, p.molecule, p.cip);
      J.compter($('#pr-nv', el), p.nosVentes, function (v) { return nf.format(Math.round(v)); }, 1000);
      return;
    }
    el.innerHTML = '<div class="page">' + PZ.bandeau() + '<div class="pr-sousnav" data-interne>' + vuesPublic() + '</div>' + PZ.portes() +
      (P.mode === 'officine' ? PZ.blocOfficine() : P.mode === 'molecule' ? PZ.blocMolecule() : P.mode === 'compose' ? PZ.blocCompose() : '') +
      '<div class="pr-filtres">' + (P.mode === 'compose' ? '' : chipsFam()) + '</div><p class="pr-cpt" id="pr-cpt"></p>' + legende() +
      '<section class="carte pr-tab" aria-label="Résultats du comptoir"><table class="tabl"><thead id="pr-tete"></thead><tbody id="pr-corps"></tbody></table><div class="pr-pied"><button type="button" class="pil" id="pr-plus">Afficher 25 de plus</button></div></section>' +
      '<div class="chips pr-liens"><button type="button" class="chip" data-stub="' + STUB('Catalogue & prix') + '">' + J.ico('euro') + 'Catalogue &amp; prix</button><button type="button" class="chip" data-mol-mode>' + J.ico('pill') + 'Molécules</button><button type="button" class="chip" data-interne data-stub="' + STUB('Marge produits') + '">' + J.ico('chart') + 'Marge produits</button></div>' + selbar() + '</div>';
    J.prRemplir(el); brancher(el);
    if (P.mode === 'molecule' && P.mol) dessinerMol(el, P.mol, '');
    J.poseIcones(el);
  }
};
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && J.courant.ecran === 'produits' && J.courant.suite === 'detail') J.aller('produits'); });
})();
