/* Le marché (#marche) et une région ouverte (#marche-detail). Tout interne ([data-interne] + avis .vp).
   La fiche marché d'une référence : bandeau de recherche (une référence), La fiche = carte d'identité (boîtes vendues en France en grand
   chiffre), Les 13 régions en tableau à barres fines (boîtes par officine face au repère France, évolution, notre part), Les dispositifs médicaux, Les signaux
   du terrain. Source Open Medic (Assurance maladie) ; jamais mélangée au chiffre du réseau : « notre part » et le stock
   des signaux sont les seuls chiffres du réseau, et le bandeau le dit. Dispositifs médicaux : codes LPP, une base à part.
   Données : J.X.marche (reference, regions[13], dm[3], signaux[3]), fictives. La moyenne France par officine n'est écrite qu'une fois (ligne « Par officine »). */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, X = J.X, S = J.S, OFF = J.OFF, eur = J.eur;
var M = X.marche, R = M.reference, REG = M.regions || [], PERS = X.personne || {};
var K = S.marche = S.marche || { tri: 'boites', ouverte: null };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
/* la région du secteur de la personne : premier mot du secteur (« Provence – Côte d'Azur ») retrouvé en tête d'un nom de région */
var MOT = String(PERS.secteur || '').split(/[\s–-]+/)[0].toLowerCase(), SEC = null;
REG.forEach(function (r) { if (!SEC && MOT && r.nom.toLowerCase().indexOf(MOT) === 0) SEC = r; });
var MAX = Math.max.apply(null, REG.map(function (r) { return r.parOfficine; }).concat([R.parOfficine, 1])), MAXP = Math.max.apply(null, REG.map(function (r) { return r.notrePart; }).concat([.1]));
/* couleur : les boîtes du marché n'ont pas de couleur de chiffre (celles de couleurs.css sont le chiffre d'affaires, notre marge, les commandes du réseau) :
   barres en gris, et seule la région regardée (votre secteur, ou la région ouverte) en bleu d'action — une seule série en couleur par graphique */
var C_VU = 'var(--bleu)', C_AUTRE = 'var(--enc-4)';
function sansSigle(t) { return String(t).replace(/\bPACA\b/g, SEC ? SEC.nom : 'Provence-Alpes-Côte d’Azur'); }
/* le stock cité dans les signaux est celui d'Appro pour la même référence : un produit ne se dit pas en stock ici et épuisé là-bas */
var AP = ((X.appro && X.appro.aujourdhui) || []).filter(function (p) { return String(p.produit).split(',')[0] === String(R.nom).split(',')[0]; })[0];
function stockSignal(s) { return AP && /^Stock Intégral/.test(s) ? 'Stock Intégral : ' + (AP.stock > 0 ? nf.format(AP.stock) + ' boîtes' : 'épuisé') + (AP.retour && AP.retour !== 'inconnu' ? ', retour prévu ' + AP.retour : '') : s; }
/* un signal chiffré qui contredit le tableau (« hausse de 6 % » pour votre secteur quand le tableau le donne en baisse) n'est pas affiché : les deux
   chiffres sont fictifs et la période de l'évolution manque aux données */
var SIGS = (M.signaux || []).filter(function (s) { var t = sansSigle(s).toLowerCase(); if (!SEC || t.indexOf(SEC.nom.toLowerCase()) < 0) return true;
  return !((/hausse/.test(t) && SEC.evolution < 0) || (/baisse|recul/.test(t) && SEC.evolution > 0)); }).map(stockSignal);
function triees() { var k = K.tri; return REG.slice().sort(function (a, b) { return k === 'evo' ? b.evolution - a.evolution : k === 'part' ? b.notrePart - a.notrePart : b.parOfficine - a.parOfficine; }); }
function rangDe(r) { return REG.slice().sort(function (a, b) { return b.parOfficine - a.parOfficine; }).indexOf(r) + 1; }
function icoSignal(t) { var s = t.toLowerCase(); return /hausse|\+/.test(s) ? ['haut', 'var(--e-bien)'] : /baisse|recul/.test(s) ? ['bas', 'var(--e-alerte)'] : /générique|lancé/.test(s) ? ['pill', 'var(--e-neutre)'] : /stock|rupture/.test(s) ? ['box', 'var(--e-attention)'] : ['bulb', 'var(--e-neutre)']; }
function barre(v, max, col, repere) { return '<span class="mr-piste"><i class="mr-b" style="width:' + (v / max * 100).toFixed(1) + '%;background:' + col + '"></i>' + (repere != null ? '<i class="mr-m" style="left:' + (repere / max * 100).toFixed(1) + '%"></i>' : '') + '</span>'; }
/* ---------- la fiche : carte d'identité de la référence ---------- */
function fiche() {
  return J.identite({ classe: 'mr-ident', nom: esc(R.nom), meta: '<span class="etat">' + J.ico('pill', 'var(--e-neutre)') + 'Médicament remboursé</span>',
    mois: { lib: 'Boîtes vendues en France · marché', val: nf.format(R.boitesFrance) },
    lignes: [['Laboratoire', esc(R.labo)], ['CIP', '<span class="num">' + esc(R.cip) + '</span>', 0, 1], ['Par officine', nf.format(R.parOfficine) + ' boîtes · moyenne France'], ['Périmètre', 'Ventes remboursées en officine de ville, France entière'], ['Votre secteur', SEC ? esc(SEC.nom) + ' · ' + J.ordre(rangDe(SEC)) + ' région par officine' : '']],
    actions: '<div class="ronds">' + J.rond('chart', 'Nos ventes', STUB('Comparer à nos ventes'), 1) + J.rond('doc', 'PDF', STUB('Télécharger la fiche marché en PDF')) + J.rond('share', 'Partager', STUB('Partager à l’équipe')) + '</div><a class="pil plein" href="#produits">' + J.ico('box') + 'Voir le catalogue produits</a><button type="button" class="pil contour" data-stub="' + STUB('Suivre cette référence') + '">' + J.ico('bell') + 'Suivre cette référence</button>' });
}
/* ---------- les 13 régions : tableau à barres fines ---------- */
function ligneRegion(r, i) { var moi = r === SEC;
  return '<tr class="mr-l' + (moi ? ' moi' : '') + '" data-region="' + esc(r.nom) + '" tabindex="0" role="link" aria-label="Ouvrir la région ' + esc(r.nom) + '" style="--i:' + Math.min(i, 12) + '"><td data-l="Région"><b class="mr-nom">' + esc(r.nom) + '</b>' + (moi ? '<span class="sub">votre secteur</span>' : '') + '</td>' +
    '<td class="num" data-l="Boîtes par officine"><div class="mr-cell">' + barre(r.parOfficine, MAX, moi ? C_VU : C_AUTRE, R.parOfficine) + '<b>' + nf.format(r.parOfficine) + '</b></div></td>' +
    '<td data-l="Évolution">' + J.evoHtml(r.evolution) + '</td>' +
    '<td class="num" data-l="Notre part du marché"><div class="mr-cell">' + barre(r.notrePart, MAXP, moi ? C_VU : C_AUTRE) + '<b>' + nf1.format(r.notrePart) + ' %</b></div></td><td class="mr-chev">' + J.ico('chev') + '</td></tr>'; }
function regions() {
  var sup = REG.filter(function (r) { return r.parOfficine > R.parOfficine; }).length, n = REG.length;
  var seg = [['boites', '<span>Boîtes<span class="long"> par officine</span></span>'], ['evo', 'Évolution'], ['part', 'Notre part']].map(function (t) { return '<button type="button" data-tri="' + t[0] + '" aria-pressed="' + (K.tri === t[0]) + '">' + t[1] + '</button>'; }).join('');
  return '<section class="carte mr-regions" aria-label="Les régions"><div class="tete"><div><h2>' + sup + ' régions sur ' + n + ' au-dessus de la moyenne France</h2><p class="st">boîtes par officine, évolution des boîtes, notre part du marché régional' + (SEC ? ' · votre secteur, ' + esc(SEC.nom) + ', est en bleu' : '') + ' · un clic ouvre la région</p></div><div class="mr-tri"><span class="lbl">Trier par</span><div class="seg" role="group" aria-label="Trier par">' + seg + '</div></div></div>' +
    '<table class="tabl mr-tab"><thead><tr><th>Région</th><th class="num">Boîtes par officine<span class="st">trait gris : moyenne France</span></th><th>Évolution<span class="st">des boîtes vendues</span></th><th class="num">Notre part du marché<span class="st">boîtes Intégral / boîtes du marché</span></th><th></th></tr></thead><tbody id="mr-corps">' + triees().map(ligneRegion).join('') + '</tbody></table>' +
    '<div class="leg mr-leg">' + (SEC ? '<span><i class="puce" style="background:' + C_VU + '"></i>Votre secteur</span>' : '') + '<span><i class="puce" style="background:' + C_AUTRE + '"></i>' + (SEC ? 'Les autres régions' : 'Les régions') + '</span><span><i class="mr-m mr-m-leg"></i>Moyenne France</span></div></section>';
}
/* ---------- dispositifs médicaux et signaux du terrain ---------- */
function dm() { var L = (M.dm || []).slice().sort(function (a, b) { return b.boites - a.boites; }); if (!L.length) return ''; var max = L[0].boites;
  /* titre-conclusion calculé : le premier dispositif, « de loin » s'il fait une fois et demie le deuxième ; sa barre seule en couleur */
  var titre = esc(L[0].nom) + (L[1] && L[0].boites >= 1.5 * L[1].boites ? ' : de loin le premier des dispositifs médicaux' : ' : le premier des dispositifs médicaux');
  return '<section class="carte" aria-label="Les dispositifs médicaux"><div class="tete"><div><h2>' + titre + '</h2><p class="st">boîtes vendues en France · codes LPP : une base à part, sans lien avec la référence</p></div></div><div class="mr-dm">' +
    L.map(function (d, i) { return '<div class="cb" style="--i:' + i + '"><div class="cb-t"><span class="cb-l"><b>' + esc(d.nom) + '</b></span><span class="cb-v num">' + nf.format(d.boites) + '</span></div><div class="cb-pist"><i class="cb-b" style="width:' + (d.boites / max * 100).toFixed(1) + '%;background:' + (i ? C_AUTRE : C_VU) + '"></i></div></div>'; }).join('') + '</div><p class="note">Un trait par famille, à la même échelle.</p></section>'; }
function signaux() { var L = SIGS; if (!L.length) return '';
  return '<section class="carte" aria-label="Les signaux du terrain"><div class="tete"><div><h2>Les signaux du terrain</h2><p class="st">ce que l’équipe et le robot ont relevé autour de cette référence</p></div><button type="button" class="pil" data-stub="' + STUB('Ajouter un signal') + '">' + J.ico('plus') + 'Ajouter un signal</button></div><ul class="mr-sig">' +
    L.map(function (s, i) { var ic = icoSignal(s); return '<li style="--i:' + i + '"><span class="rond gris">' + J.ico(ic[0], ic[1]) + '</span><span class="mr-sig-t">' + esc(sansSigle(s)) + '</span><button type="button" class="chip" data-bn-sig="' + i + '">' + J.ico('note') + 'Noter dans le bloc-notes</button></li>'; }).join('') + '</ul></section>'; }
/* ---------- l'écran principal ---------- */
function principal(el) {
  var stock = SIGS.some(function (x) { return /intégral/i.test(x); });
  el.innerHTML = '<div class="page mr-page">' + J.bandeau({ croix: true, deborde: true, eyebrow: '<span data-interne>Marché · source Open Medic<span class="long">, Assurance maladie</span></span><span class="vp">Outil interne · vue pharmacien</span>', titre: 'Marché',
    lede: 'La fiche marché d’<b>une référence</b> : boîtes vendues en France, par officine, <b>région par région</b>. Des chiffres de <b>marché</b> ; ' + (stock ? 'seuls « Notre part » et le stock Intégral viennent du réseau, et ils sont dits à part' : 'seul « Notre part » vient du réseau, et il est dit à part') + '.',
    actions: '<button type="button" class="pil" data-stub="' + STUB('Comparer deux références') + '">' + J.ico('layers') + 'Comparer deux références</button>',
    recherche: { id: 'mr-q', placeholder: 'Une référence : nom, CIP, molécule, laboratoire…', aria: 'Chercher une référence du marché', valeur: R.nom } }) +
  '<p class="vp note mr-vp">Vue pharmacien : la fiche marché est un outil interne. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>' +
  '<div data-interne><div class="sous-bandeau">' + fiche() + '</div><div class="stack entre mr-stack">' + regions() + '<div class="gdeux stack">' + dm() + signaux() + '</div></div>' +
  '</div></div>';
  J.poseIcones(el);
  /* vue pharmacien : la phrase, l'action et la recherche (qui affiche la référence) du bandeau sont internes */
  $$('.bandeau .lede,.ban-act,.rech-g', el).forEach(function (e) { e.setAttribute('data-interne', ''); });
  var q = $('#mr-q', el); q.onchange = function () { if (q.value.trim() && q.value.trim() !== R.nom) J.toast('Une seule référence est chargée : ' + R.nom + '.'); };
  $$('[data-tri]', el).forEach(function (b) { b.onclick = function () { K.tri = b.getAttribute('data-tri'); $$('[data-tri]', el).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $('#mr-corps', el).innerHTML = triees().map(ligneRegion).join(''); J.poseIcones(el); lierLignes(el); }; });
  /* « Noter dans le bloc-notes » : le signal devient une note écrite du jour (J.bnAjouter, écran Bloc-notes), puis le bloc-notes s'ouvre */
  $$('[data-bn-sig]', el).forEach(function (b) { b.onclick = function () { var s = SIGS[+b.getAttribute('data-bn-sig')]; if (s && J.bnAjouter) { J.bnAjouter('Le marché · ' + R.nom + ' : ' + sansSigle(s)); J.toast('Signal noté dans votre bloc-notes.'); } J.aller('blocnotes'); }; });
  lierLignes(el);
}
function lierLignes(el) { $$('tr[data-region]', el).forEach(function (tr) { var go = function () { K.ouverte = tr.getAttribute('data-region'); J.aller('marche-detail'); }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }; }); }
/* ---------- #marche-detail : une région ouverte ---------- */
function detail(el) {
  window.scrollTo(0, 0);   /* le socle garde le défilement sur les adresses -detail : la région s'ouvre en haut, sur sa carte d'identité */
  var r = null; REG.forEach(function (x) { if (x.nom === K.ouverte) r = x; }); r = r || SEC || REG[0]; if (!r) { principal(el); return; }
  var moi = r === SEC, rang = rangDe(r), ratio = R.parOfficine ? r.parOfficine / R.parOfficine : 0, max = MAX, cl = OFF.filter(function (o) { return o.statut !== 'prospect'; }).sort(function (a, b) { return b.ca - a.ca; }).slice(0, 8);
  var textes = REG.slice().sort(function (a, b) { return b.parOfficine - a.parOfficine; }), ordre = triees(), idx = ordre.indexOf(r);
  /* titre-conclusion de la frise, calculé : de quel côté de la moyenne France, et avec combien d'autres régions (le rang est déjà dans la carte d'identité) */
  var dessus = r.parOfficine > R.parOfficine, memes = REG.filter(function (x) { return x !== r && x.parOfficine !== R.parOfficine && (x.parOfficine > R.parOfficine) === dessus; }).length;
  var concl = r.parOfficine === R.parOfficine ? 'Au niveau de la moyenne France' : textes[0] === r ? 'Au-dessus de la moyenne France, plus que toute autre région' : textes[textes.length - 1] === r ? 'Sous la moyenne France, plus que toute autre région'
    : (dessus ? 'Au-dessus de' : 'Sous') + ' la moyenne France' + (memes ? ', comme ' + memes + ' autre' + (memes > 1 ? 's' : '') + ' région' + (memes > 1 ? 's' : '') : ', seule de son côté');
  /* bandeau sans titre : le nom de la région ne vit que dans la carte d'identité ; une rangée d'outils (retour, ‹ ›, Autre région…) */
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Marché</button><div class="mr-pn"><button type="button" class="b-rond" data-mr-pn="-1" aria-label="Région précédente">' + J.ico('back') + '</button><button type="button" class="b-rond" data-mr-pn="1" aria-label="Région suivante">' + J.ico('chev') + '</button></div>' +
    '<label class="filtre mr-autre">' + J.ico('pin') + '<select id="mr-autre" aria-label="Autre région"><option value="">Autre région…</option>' + REG.filter(function (x) { return x !== r; }).map(function (x) { return '<option value="' + esc(x.nom) + '">' + esc(x.nom) + '</option>'; }).join('') + '</select></label>';
  el.innerHTML = '<div class="page mr-page">' + J.bandeau({ classe: 'mr-ban-d', deborde: true, eyebrow: '<span data-interne>Marché<span class="long"> · ' + esc(R.nom) + '</span> · une région</span><span class="vp">Outil interne · vue pharmacien</span>', recherche: '<div class="mr-outils">' + outils + '</div>' }) +
  '<p class="vp note mr-vp">Vue pharmacien : la fiche marché est un outil interne. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>' +
  '<div data-interne><div class="sous-bandeau">' + J.identite({ classe: 'mr-ident', nom: esc(r.nom), meta: (moi ? '<span class="etat">' + J.ico('pin', 'var(--e-neutre)') + 'Votre secteur</span>' : '') + '<span>' + J.ordre(rang) + ' région sur ' + REG.length + ' par officine</span>',
      mois: { lib: 'Boîtes par officine · cette région', val: nf.format(r.parOfficine), evo: J.evoHtml(r.evolution, 'd’évolution des boîtes') },
      lignes: [['Face à la France', '× ' + nf1.format(ratio) + ' la moyenne France'], ['Notre part du marché', nf1.format(r.notrePart) + ' % des boîtes de la région'], ['Référence', esc(R.nom) + ' · ' + esc(R.labo)], ['Source', 'Open Medic · Assurance maladie · ventes remboursées en ville']],
      actions: '<div class="ronds">' + J.rond('chart', 'Nos ventes', STUB('Comparer à nos ventes'), 1) + J.rond('doc', 'PDF', STUB('Télécharger en PDF')) + J.rond('share', 'Partager', STUB('Partager à l’équipe')) + '</div>' + (moi ? '<a class="pil plein" href="#carte">' + J.ico('pin') + 'Voir la carte de votre secteur</a>' : '<button type="button" class="pil contour" data-stub="' + STUB('Demander le détail par département') + '">' + J.ico('layers') + 'Détail par département</button>') }) + '</div>' +
    '<div class="stack entre mr-stack"><section class="carte" aria-label="Les régions comparées"><div class="tete"><div><h2>' + concl + '</h2><p class="st">boîtes par officine · la région ouverte en bleu, les autres en gris, le trait est la moyenne France · touchez une barre pour la lire</p></div></div>' +
      '<div class="mr-frise">' + textes.map(function (x, i) { return '<button type="button" class="mr-fb' + (x === r ? ' moi' : '') + '" data-lit="' + i + '" aria-label="' + esc(x.nom) + '"><span class="mr-fb-n">' + esc(x.nom) + '</span><span class="mr-piste"><i class="mr-b" style="width:' + (x.parOfficine / max * 100).toFixed(1) + '%;background:' + (x === r ? C_VU : C_AUTRE) + '"></i><i class="mr-m" style="left:' + (R.parOfficine / max * 100).toFixed(1) + '%"></i></span></button>'; }).join('') + '</div>' +
      '<p class="lecteur" id="mr-lect" aria-live="polite">Touchez ou survolez une région pour lire ses boîtes par officine.</p></section>' +
    (moi && cl.length ? '<section class="carte" aria-label="Nos officines dans cette région"><div class="tete"><div><h2>Nos clientes dans cette région</h2><p class="st">les ' + cl.length + ' premières par chiffre d’affaires · chiffre du réseau, à part : il ne se compare pas aux boîtes du marché</p></div></div><table class="tabl mr-off"><thead><tr><th>Officine</th><th class="num">Chiffre d’affaires<span class="st">cumul ' + esc(J.D.secteur.periode) + '</span></th></tr></thead><tbody>' +
      cl.map(function (o) { return '<tr data-officine="' + o.id + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(J.joli(o.nom)) + '"><td><b class="mr-nom">' + esc(J.joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + (o.groupement !== 'Sans groupement' ? ' · ' + esc(o.groupement) : '') + '</span></td><td class="num"><b>' + eur(o.ca) + '</b>' + J.fois(o.ca, J.MOY.caMois * J.D.mois.length) + '</td></tr>'; }).join('') + '</tbody></table></section>' : '') + '</div></div></div>';
  J.poseIcones(el);
  $$('.mr-outils', el).forEach(function (e) { e.setAttribute('data-interne', ''); });   /* vue pharmacien : la rangée d'outils est interne */
  $$('[data-mr-pn]', el).forEach(function (b) { b.onclick = function () { var k = (idx + (+b.getAttribute('data-mr-pn')) + ordre.length) % ordre.length; K.ouverte = ordre[k].nom; J.aller('marche-detail'); }; });
  var au = $('#mr-autre', el); if (au) au.onchange = function (e) { if (e.target.value) { K.ouverte = e.target.value; J.aller('marche-detail'); } };
  $$('[data-lit]', el).forEach(function (b) { var f = function () { var x = textes[+b.getAttribute('data-lit')]; $('#mr-lect', el).innerHTML = '<b>' + esc(x.nom) + '</b> : ' + nf.format(x.parOfficine) + ' boîtes par officine, ' + (x.parOfficine >= R.parOfficine ? 'au-dessus de' : 'sous') + ' la moyenne France · ' + J.signe(x.evolution) + ' · notre part ' + nf1.format(x.notrePart) + ' %'; $$('.mr-fb', el).forEach(function (y) { y.classList.toggle('lu', y === b); }); }; b.onmouseenter = f; b.onfocus = f; b.onclick = function () { f(); if (textes[+b.getAttribute('data-lit')] !== r) { K.ouverte = textes[+b.getAttribute('data-lit')].nom; J.aller('marche-detail'); } }; });
  $$('tr[data-officine]', el).forEach(function (tr) { var go = function () { J.ouvrirFiche(tr.getAttribute('data-officine')); }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }; });
}
J.ecrans.marche = { rendre: function (el, etat) { if (etat && etat.suite === 'detail') detail(el); else principal(el); } };
})();
