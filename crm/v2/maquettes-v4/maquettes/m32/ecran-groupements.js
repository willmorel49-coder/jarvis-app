/* Groupements (#groupements, 2e vue d'Officines) et page d'un groupe d'achat (#groupements-detail).
   Liste : en-tête, quatre vues (J.vuesOfficines), recherche, tri Activité / Nom (A→Z), une ligne par groupement (initiale, nom, officines, actives + part, chiffre d'affaires).
   Page d'un groupement : adhérents, actives, produits commandés, période ; « Pharmacies membres » → fiche ; « Liste d'achats idéale » par catégorie en tableau
   (#, Produit, CIP, Prix net, Abandon de marge, Part des officines, sélection pour le PDF ; barre d'outils produits ; barre de panier).
   Données : J.X.groupements, J.D.officines, J.D.fiche (listes « À proposer », top 10), toutes fictives. Prix nets fictifs, dits à l'écran. Écran interne.
   Le composant « Liste d'achats idéale » (J.lotE.listeAchats) est défini ici et réutilisé par ecran-listes.js. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, nf1 = J.nf1, eur = J.eur, D = J.D, OFF = J.OFF, MOY = J.MOY, S = J.S, G = J.X && J.X.groupements;
if (!G) return;
var E = S.groupements = S.groupements || { tri: 'activite', q: '', sel: '' };
var N_MOIS = D.mois.length, STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var LE = J.lotE = J.lotE || { panier: {}, STUB: STUB };
/* ---------- aides communes (membres → série des 10 mois, chiffres dérivés) ---------- */
LE.membres = function (ids) { return ids.map(function (id) { return J.offById(id); }).filter(Boolean); };
LE.serie = function (offs) { return D.mois.map(function (_, i) { return offs.reduce(function (s, o) { return s + (o.statut === 'prospect' ? 0 : o.caParMois[i]); }, 0); }); };
LE.evo = function (serie) { var a = serie[serie.length - 1], b = serie[serie.length - 2]; return b ? Math.round((a - b) / b * 100) : 0; };
LE.actives = function (offs) { return offs.filter(function (o) { return o.statut !== 'prospect' && o.ca > 0; }); };
LE.ligneOff = function (o, i, extra) {
  var pros = o.statut === 'prospect' || !o.ca;
  return '<tr class="gr-lo" data-officine="' + o.id + '" tabindex="0" role="link" aria-label="Ouvrir la fiche de ' + esc(J.joli(o.nom)) + '" style="--i:' + Math.min(i, 12) + '"><td data-l="Officine"><span class="gr-oid"><span class="gr-av" aria-hidden="true">' + esc(J.ini(o.nom)) + '</span><span class="gr-otx"><b>' + esc(J.joli(o.nom)) + '</b><span class="gr-ometa">' + J.etatHtml(J.etatOff(o)) + '<span class="sub">' + esc(o.ville) + ' · ' + o.cp + '</span></span></span></span></td>' +
    (pros ? '<td class="num" data-l="Chiffre d’affaires"><span class="gr-vide">non cliente · aucune vente</span></td><td data-l="10 mois"><span class="gr-vide">—</span></td>' : '<td class="num" data-l="Chiffre d’affaires"><b>' + eur(o.ca) + '</b>' + J.fois(o.ca, MOY.caMois * N_MOIS) + '</td><td data-l="10 mois"><span class="gr-dix">' + J.spark(o.caParMois, MOY.caMois, 110, 34, 'var(--c-ca)', { aria: 'Chiffre d’affaires des 10 mois' }) + J.evoHtml(LE.evo(o.caParMois)) + '</span></td>') +
    '<td class="num" data-l="À lui proposer"><span class="gr-score">' + J.anneau(o.score, 40) + '<span><b>' + o.score + '</b><span class="fois">sur 100</span></span></span></td>' + (extra || '') + '<td class="gr-chev">' + J.ico('chev') + '</td></tr>';
};
LE.lierOff = function (el) { $$('tr[data-officine]', el).forEach(function (tr) { var go = function (ev) { if (ev.target.closest('button,a,input,label')) return; J.ouvrirFiche(tr.getAttribute('data-officine')); }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(ev); } }; }); };
/* ---------- « Liste d'achats idéale » : produits par catégorie, dérivés du top 10 et des listes « À proposer » de la fiche (déterministes, fictifs).
   Prix net : d'abord le prix « Nous » du comparateur Concurrents (même produit), puis le prix moyen du top 10 (montant / quantité), enfin un prix plausible pour la famille.
   Abandon de marge : une mention sans chiffre (« selon le barème ») sur les remboursables et les biosimilaires seuls, « — » sur génériques, parapharmacie,
   conseil et matériel. La part des officines dépend de la base (groupe ou liste) : LE.partPour. ---------- */
var CAT = { 'Princeps': 'remboursables', 'Générique': 'generiques', 'Biosimilaire': 'biosimilaires', 'Parapharmacie': 'parapharmacie', 'Conseil': 'conseil', 'Matériel': 'materiel' };
function h32(k) { var h = 7; for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 1e9; return h; }
function catDe(fam) { var k = Object.keys(CAT).filter(function (c) { return fam.indexOf(c) === 0; })[0]; return CAT[k] || 'remboursables'; }
var CMP = {}; ((J.X.concurrents && J.X.concurrents.comparateur) || []).forEach(function (p) { if (p.nous != null) CMP[p.produit.split(',')[0]] = p.nous; });
var GAMME = { 'Princeps · petits prix': [1.4, 300], 'Princeps · prix intermédiaires': [8, 4000], 'Princeps · grands prix': [80, 30000], 'Générique': [1, 400], 'Biosimilaire': [60, 40000], 'Parapharmacie': [4, 1600], 'Conseil sans ordonnance': [2, 900], 'Matériel médical': [5, 6000] };
function prixDe(m) { if (CMP[m.nom] != null) return CMP[m.nom]; if (m.montant && m.quantite) return m.montant / m.quantite; var g = GAMME[m.famille] || [1.4, 600]; return g[0] + (m.h % g[1]) / 100; }
LE.abandon = function (cat) { return cat === 'remboursables' || cat === 'biosimilaires' ? 'selon le barème' : '—'; };
var PRODUITS = null;
LE.produits = function () {
  if (PRODUITS) return PRODUITS;
  var par = {}, out = [], F = D.fiche, src = F.top10.concat(F.aProposer.groupeAchat.premiers, F.aProposer.reseau.premiers, F.nePlusCommande || []);
  src.forEach(function (p) { var nom = p.nom.split(',')[0], m = par[nom];   /* un même produit vient de plusieurs listes : première fiche gardée, complétée par les suivantes */
    if (!m) { par[nom] = { nom: nom, detail: p.nom.split(',').slice(1).join(',').trim(), famille: p.famille, montant: p.montant, quantite: p.quantite, partOfficines: p.partOfficines, h: h32(p.nom) }; out.push(par[nom]); return; }
    if (!m.famille && p.famille) m.famille = p.famille; if (!m.montant && p.montant) { m.montant = p.montant; m.quantite = p.quantite; } if (!m.partOfficines && p.partOfficines) m.partOfficines = p.partOfficines; });
  return (PRODUITS = out.map(function (m) { var fam = m.famille || 'Princeps', cat = catDe(fam), prix = prixDe(m);
    return { nom: m.nom, detail: m.detail, fam: fam, cat: cat, cip: '3400' + ('000000000' + (m.h % 1e9)).slice(-9), prix: prix, abandon: LE.abandon(cat), base: m.partOfficines || 18 + (m.h % 55) }; }));
};
/* part des officines de la base (groupe ou liste) qui commandent le produit : la part de la fiche, modulée par une graine fixe (base + produit) */
LE.partPour = function (p, cle) { return Math.max(4, Math.min(97, Math.round(p.base * (0.8 + (h32(cle + '|' + p.nom) % 41) / 100)))); };
LE.listeAchats = function (cle, o) {
  o = o || {}; var P = LE.produits().map(function (p) { var x = Object.create(p); x.part = LE.partPour(p, cle); return x; }).sort(function (a, b) { return b.part - a.part || a.nom.localeCompare(b.nom, 'fr'); })
    .filter(function (p) { return !o.q || (p.nom + ' ' + p.cip + ' ' + p.fam).toLowerCase().indexOf(o.q.toLowerCase()) >= 0; }), pan = LE.panier[cle] = LE.panier[cle] || {}, nSel = Object.keys(pan).length;
  var cats = D.fiche.categories.map(function (c, i) { return { cle: c.cle, nom: c.nom, col: 'var(--cat-' + (i + 1) + ')', items: P.filter(function (p) { return p.cat === c.cle; }) }; }).filter(function (c) { return c.items.length; });
  var tot = LE.produits().length;
  var tete = '<h2 class="titre-s" id="la-' + esc(cle) + '">Liste d’achats idéale<span class="st">' + tot + ' produits, par catégorie et par part des officines de la base qui les commandent · pour le proposer aux autres · cochez pour composer le PDF</span></h2>' +
    '<div class="gr-outils"><label class="filtre gr-rech">' + J.ico('search') + '<input type="search" id="la-q-' + esc(cle) + '" placeholder="Un produit, un CIP, une famille…" aria-label="Rechercher un produit dans la liste d’achats" value="' + esc(o.q || '') + '"></label>' +
    '<div class="gr-ronds">' + J.rond('doc', 'PDF', null, 1, ' data-la-pdf') + J.rond('down', 'Excel', STUB('Télécharger la liste en Excel')) + J.rond('share', 'Partager', STUB('Partager la liste d’achats')) + '</div></div>';
  var corps = cats.map(function (c, k) {
    return '<section class="carte gr-cat" aria-label="' + esc(c.nom) + '"><details class="gr-det"' + (k === 0 || o.q ? ' open' : '') + '><summary><span class="puce" style="background:' + c.col + '"></span><span class="gr-cn"><b>' + esc(c.nom) + '</b><span class="sub">' + c.items.length + ' produit' + (c.items.length > 1 ? 's' : '') + ' · part des officines qui le commandent</span></span><span class="pil gr-voir"><span class="gr-v1">Voir les produits</span><span class="gr-v2">Replier la liste</span></span></summary>' +
      '<div class="tabl-wrap"><table class="tabl gr-tab"><thead><tr><th class="gr-ck"><input type="checkbox" aria-label="Sélectionner toute la catégorie" data-la-tout="' + esc(c.cle) + '"' + (c.items.every(function (p) { return pan[p.cip]; }) ? ' checked' : '') + '></th><th class="num">#</th><th>Produit<span class="st">présentation</span></th><th>CIP</th><th class="num">Prix net<span class="st">hors taxes</span></th><th class="num">Abandon de marge<span class="st">remboursables et biosimilaires</span></th><th class="num">Part des officines<span class="st">qui le commandent</span></th></tr></thead><tbody>' +
      c.items.map(function (p, i) { return '<tr' + (pan[p.cip] ? ' class="sel"' : '') + '><td class="gr-ck" data-l=""><input type="checkbox" aria-label="Sélectionner ' + esc(p.nom) + '" data-la-ck="' + p.cip + '" data-cat="' + esc(c.cle) + '"' + (pan[p.cip] ? ' checked' : '') + '></td><td class="num gr-n" data-l="#">' + (i + 1) + '</td><td data-l="Produit"><b class="gr-pn">' + esc(p.nom) + '</b><span class="sub">' + esc(p.detail || p.fam) + '</span></td><td class="num gr-cip" data-l="CIP">' + p.cip + '</td><td class="num" data-l="Prix net"><b>' + J.eur2(p.prix) + '</b></td><td class="num" data-l="Abandon de marge">' + p.abandon + '</td><td class="num" data-l="Part des officines"><span class="gr-part"><span class="bar12"><i style="width:' + p.part + '%;background:' + c.col + '"></i></span><b>' + p.part + ' %</b></span></td></tr>'; }).join('') +
      '</tbody></table></div></details></section>'; }).join('');
  var panier = '<div class="gr-panier' + (nSel ? '' : ' vide') + '" id="la-panier-' + esc(cle) + '" role="status"><span class="gr-pt">' + J.ico('doc') + '<b>' + nSel + ' produit' + (nSel > 1 ? 's' : '') + '</b> sélectionné' + (nSel > 1 ? 's' : '') + ' pour le PDF</span><button type="button" class="pil plein" data-la-pdf>' + J.ico('down') + 'Liste d’achats (PDF)</button><button type="button" class="pil" data-la-vider>Vider</button></div>';
  return '<div class="gr-la" data-la="' + esc(cle) + '">' + tete + (cats.length ? '<div class="stack entre">' + corps + '</div>' : '<p class="note">Aucun produit ne correspond à « ' + esc(o.q) + ' ».</p>') + '<p class="note">Prix nets : ceux du comparateur Concurrents quand le produit y figure · abandon de marge selon le barème en vigueur, sur les remboursables et les biosimilaires seuls · la vraie liste se calcule sur les commandes des officines de la base.</p>' + panier + '</div>';
};
LE.lierListe = function (el, cle, rerendre) {
  var box = $('[data-la="' + cle + '"]', el); if (!box) return; var pan = LE.panier[cle];
  $$('[data-la-ck]', box).forEach(function (ck) { ck.onchange = function () { if (ck.checked) pan[ck.getAttribute('data-la-ck')] = 1; else delete pan[ck.getAttribute('data-la-ck')]; rerendre(); }; });
  $$('[data-la-tout]', box).forEach(function (ck) { ck.onchange = function () { var cat = ck.getAttribute('data-la-tout'); LE.produits().forEach(function (p) { if (p.cat === cat) { if (ck.checked) pan[p.cip] = 1; else delete pan[p.cip]; } }); rerendre(); }; });
  $$('[data-la-pdf]', box).forEach(function (b) { b.onclick = function () { var n = Object.keys(pan).length; J.toast(n ? 'PDF de la sélection : ' + n + ' produit' + (n > 1 ? 's' : '') + ' (non dessiné dans cette maquette).' : 'Cochez d’abord des produits : le PDF reprend la sélection (non dessiné dans cette maquette).'); }; });
  $$('[data-la-vider]', box).forEach(function (b) { b.onclick = function () { LE.panier[cle] = {}; rerendre(); }; });
  var q = $('#la-q-' + cle, box); if (q) q.oninput = function (e) { LE.q = LE.q || {}; LE.q[cle] = e.target.value; rerendre(true); var q2 = $('#la-q-' + cle, el); if (q2) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); } };
};
/* ---------- la liste des groupements ---------- */
function groupes() {
  var k = E.q.trim().toLowerCase(), L = G.liste.map(function (g) { var offs = LE.membres(g.membres), serie = LE.serie(offs); return { g: g, offs: offs, serie: serie, evo: LE.evo(serie) }; });
  L = L.filter(function (x) { return !k || x.g.nom.toLowerCase().indexOf(k) >= 0; });
  L.sort(E.tri === 'nom' ? function (a, b) { return a.g.nom.localeCompare(b.g.nom, 'fr'); } : function (a, b) { return b.g.actives - a.g.actives || b.g.ca - a.g.ca; });
  return L;
}
/* répartition : le premier groupe en couleur (--c-ca), les autres en gris (2 séries colorées au plus, comparaison en gris) ; le titre est la conclusion */
var TEINTES = ['var(--c-ca)', 'var(--enc-3)', 'var(--enc-4)', 'var(--enc-5)', '#D5DAE3', '#E0E4EB', '#E6E9EF', '#EBEDF2'];
function repartition(tot) {
  var L = G.liste.slice().sort(function (a, b) { return b.ca - a.ca; }), prem = L[0], r = prem.ca / tot;
  var mot = r >= .45 && r <= .55 ? 'la moitié' : r >= .3 && r < .37 ? 'un tiers' : r >= .22 && r < .28 ? 'un quart' : nf.format(r * 100) + ' %';
  return '<section class="carte gr-rep" data-interne aria-label="Répartition du chiffre d’affaires"><div class="tete"><div><h2>' + esc(prem.nom) + ' pèse ' + mot + ' du chiffre d’affaires des groupes</h2><p class="st">part de chaque groupe d’achat dans le chiffre d’affaires des adhérentes clientes du secteur, janv.–oct. 2026 · le premier en couleur, les autres en gris</p></div></div>' +
    '<div class="gr-empile" role="img" aria-label="' + L.map(function (g) { return esc(g.nom) + ' ' + nf.format(g.ca / tot * 100) + ' %'; }).join(', ') + '">' + L.map(function (g, i) { return '<i style="width:' + (g.ca / tot * 100).toFixed(1) + '%;background:' + TEINTES[i] + '"></i>'; }).join('') + '</div>' +
    '<div class="leg gr-leg">' + L.map(function (g, i) { return '<span><i class="puce" style="background:' + TEINTES[i] + '"></i>' + esc(g.nom) + ' <b class="num">' + nf.format(g.ca / tot * 100) + ' %</b></span>'; }).join('') + '</div></section>';
}
/* trois cartes à grand chiffre : des chiffres écrits nulle part ailleurs sur l'écran */
function synthese(tot, nbAct) {
  var tous = LE.membres(G.liste.reduce(function (a, g) { return a.concat(g.membres); }, [])), serie = LE.serie(tous), clientes = OFF.filter(function (o) { return o.statut !== 'prospect'; }), caSect = clientes.reduce(function (s, o) { return s + o.ca; }, 0);
  var parAct = nbAct ? tot / nbAct : 0, fois = MOY.caMois * N_MOIS, part = caSect ? Math.round(tot / caSect * 100) : 0;
  return '<div class="gr-synth entre">' +
    J.stat({ i: 1, interne: true, puce: 'var(--c-ca)', lib: 'Chiffre d’affaires des adhérentes clientes', val: eur(tot), note: 'cumul janv.–oct. 2026, les ' + G.liste.length + ' groupes réunis', spark: J.spark(serie, 0, 150, 40, 'var(--c-ca)', { aria: 'Chiffre d’affaires des adhérentes, 10 mois' }), evo: J.evoHtml(LE.evo(serie), 'oct. sur sept.') }) +
    (parAct ? J.stat({ i: 2, interne: true, classe: 'gr-seul', lib: 'Par officine active', val: eur(parAct), note: 'sur les dix mois · face à l’officine moyenne de nos clients', evo: '<span class="evo"><b>× ' + J.nf1.format(parAct / fois) + '</b>la moyenne</span>' }) : '') +
    (part ? J.stat({ i: 3, interne: true, classe: 'gr-seul', lib: 'Part des groupes dans votre secteur', val: part + ' %', note: 'du chiffre d’affaires de vos clientes · le reste vient des officines sans groupement' }) : '') + '</div>';
}
var VP_G = '<p class="note vp gr-vp">Groupements est un outil interne : rien à montrer au pharmacien dans cette vue. <button type="button" class="pil" data-vue="integral">' + J.ico('lock') + 'Revenir à la vue Intégral</button></p>';
J.lotE.VP_G = VP_G;
J.ecrans.groupements = {
  rendre: function (el, etat) {
    if (etat.suite === 'detail' && J.grDetail) { window.scrollTo(0, 0); return J.grDetail(el); }
    var nbOff = G.liste.reduce(function (s, g) { return s + g.officines; }, 0), nbAct = G.liste.reduce(function (s, g) { return s + g.actives; }, 0), tot = G.liste.reduce(function (s, g) { return s + g.ca; }, 0), L = groupes();
    el.innerHTML = '<div class="page gr">' + J.bandeau({ croix: true, eyebrow: 'Mes officines · vue d’équipe · ventes à jour au 31 octobre 2026', titre: 'Groupements',
      lede: '<span class="vi"><b>' + G.liste.length + ' groupes d’achat</b> sur votre secteur, <b>' + nf.format(nbOff) + ' officines adhérentes</b> dont <b>' + nbAct + ' actives</b> de janvier à octobre 2026. Un clic ouvre les membres et la liste d’achats idéale du groupe.</span><span class="vp">Les groupes d’achat de votre secteur : vue d’équipe, réservée à l’interne.</span>',
      recherche: { id: 'gr-q', placeholder: 'Rechercher un groupement…', aria: 'Rechercher un groupement', valeur: E.q },
      bas: '<span class="lbl" data-interne>Trier :</span><div class="seg" role="group" aria-label="Trier" data-interne><button type="button" data-tri="activite" aria-pressed="' + (E.tri === 'activite') + '">Activité</button><button type="button" data-tri="nom" aria-pressed="' + (E.tri === 'nom') + '">Nom (A→Z)</button></div>' }) +
      '<div class="gr-sousnav">' + J.vuesOfficines('groupements') + '</div>' + VP_G + '<p class="gr-def" data-interne>' + esc(G.definition) + ' Quand une partie seulement des officines d’un groupement est active, la part s’affiche sous le nombre d’actives. « × N la moyenne » compare le chiffre d’affaires par officine active à l’officine moyenne de nos clients (' + eur(MOY.caMois) + ' par mois). « Sans groupement » est écarté.</p>' +
      synthese(tot, nbAct) + repartition(tot) +
      '<section class="carte gr-tabbox" data-interne aria-label="Liste des groupements">' + (L.length ? '<table class="tabl gr-tabl"><thead><tr><th>Groupement<span class="st">produits commandés</span></th><th class="num">Officines<span class="st">adhérentes</span></th><th class="num">Actives<span class="st">au moins une commande</span></th><th>10 mois<span class="st">oct. sur sept.</span></th><th class="num">Chiffre d’affaires<span class="st">cumul janv.–oct. 2026</span></th><th></th></tr></thead><tbody>' +
      L.map(function (x, i) { var g = x.g, part = Math.round(g.actives / g.officines * 100); return '<tr class="gr-lg" data-grp="' + esc(g.nom) + '" tabindex="0" role="link" aria-label="Ouvrir ' + esc(g.nom) + '" style="--i:' + i + '"><td data-l="Groupement"><span class="gr-oid"><span class="gr-av" aria-hidden="true">' + esc(g.nom.charAt(0)) + '</span><span class="gr-otx"><b>' + esc(g.nom) + '</b><span class="sub">' + nf.format(g.produits) + ' produits commandés</span></span></span></td><td class="num" data-l="Officines"><b>' + nf.format(g.officines) + '</b></td><td class="num" data-l="Actives"><b>' + g.actives + '</b>' + (part < 100 ? '<span class="fois">' + part + ' % des adhérentes</span>' : '') + '</td>' +
        '<td data-l="10 mois"><span class="gr-dix">' + J.spark(x.serie, 0, 110, 34, 'var(--c-ca)', { aria: 'Chiffre d’affaires des 10 mois du groupe' }) + J.evoHtml(x.evo) + '</span></td><td class="num" data-l="Chiffre d’affaires"><b>' + eur(g.ca) + '</b>' + J.fois(g.ca / g.actives, MOY.caMois * N_MOIS).replace('la moyenne', 'la moyenne par active') + '</td><td class="gr-chev">' + J.ico('chev') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="note gr-vide-l">Aucun groupement ne correspond à « ' + esc(E.q) + ' ».</p>') + '</section></div>';
    J.poseIcones(el);
    var self = this;
    $$('[data-tri]', el).forEach(function (b) { b.onclick = function () { E.tri = b.getAttribute('data-tri'); self.rendre(el, etat); }; });
    $('#gr-q', el).oninput = function (e) { E.q = e.target.value; self.rendre(el, etat); var q = $('#gr-q', el); q.focus(); q.setSelectionRange(q.value.length, q.value.length); };
    $$('tr[data-grp]', el).forEach(function (tr) { var go = function () { E.sel = tr.getAttribute('data-grp'); J.aller('groupements-detail'); }; tr.onclick = go; tr.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } }; });
  }
};
})();
/* ====================================================================================================================
   #groupements-detail : la page d'un groupe d'achat = carte d'identité (nom, chiffre d'affaires en grand, clé-valeur, boutons ronds), « Pharmacies
   membres » en tableau (→ fiche), puis la « Liste d'achats idéale » par catégorie (composant partagé J.lotE.listeAchats) avec la sélection pour le PDF.
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, eur = J.eur, D = J.D, MOY = J.MOY, S = J.S, G = J.X && J.X.groupements, LE = J.lotE;
if (!G || !LE) return;
var E = S.groupements, STUB = LE.STUB;
J.grDetail = function (el) {
  var g = G.liste.filter(function (x) { return x.nom === E.sel; })[0] || G.liste[0]; E.sel = g.nom;
  var idx = G.liste.indexOf(g), offs = LE.membres(g.membres).sort(function (a, b) { return b.ca - a.ca; }), serie = LE.serie(offs), evo = LE.evo(serie), part = Math.round(g.actives / g.officines * 100);
  var tot = G.liste.reduce(function (s, x) { return s + x.ca; }, 0), cle = 'gr-' + idx, q = (LE.q && LE.q[cle]) || '';
  var outils = '<button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Groupements</button><div class="gr-pnv" data-interne><button type="button" class="b-rond" data-pn="-1" aria-label="Groupement précédent">' + J.ico('back') + '</button><button type="button" class="b-rond" data-pn="1" aria-label="Groupement suivant">' + J.ico('chev') + '</button></div>' +
    '<label class="filtre gr-autre" data-interne>' + J.ico('group') + '<select id="gr-autre" aria-label="Autre groupement"><option value="">Autre groupement…</option>' + G.liste.map(function (x) { return '<option value="' + esc(x.nom) + '">' + esc(x.nom) + '</option>'; }).join('') + '</select></label>';
  var lignes = [['Adhérentes', nf.format(g.officines) + ' officines'], ['Actives', part >= 100 ? 'toutes les adhérentes' : g.actives + ' · ' + part + ' % des adhérentes'], ['Produits commandés', nf.format(g.produits) + ' références différentes'], ['Période', 'janvier à octobre 2026 · ventes à jour au 31 octobre'], ['Part des groupes du secteur', nf.format(g.ca / tot * 100) + ' % du chiffre d’affaires'], ['Par officine active', eur(g.ca / g.actives) + ' ' + J.fois(g.ca / g.actives, MOY.caMois * D.mois.length)], ['Commercial', esc(D.secteur.commerciale)]];
  /* gestes propres au groupe seulement : PDF, Excel et Partager vivent dans la barre d'outils de la liste d'achats (un seul endroit, celui qui agit sur la sélection) */
  var actions = '<div class="ronds">' + J.rond('send', 'Envoyer', STUB('Envoyer la liste d’achats au groupe'), 1) + J.rond('pin', 'Carte', null, 0, ' data-gr-carte') + '</div>' +
    '<button type="button" class="pil plein" data-gr-la>' + J.ico('list') + 'Voir la liste d’achats idéale</button><button type="button" class="pil contour" data-stub="' + STUB('Ouvrir le listing du groupe dans Catalogue produits') + '">' + J.ico('box') + 'Listing ' + esc(g.nom) + ' · catalogue</button>';
  el.innerHTML = '<div class="page gr gr-det">' + J.bandeau({ classe: 'gr-ban', deborde: true, eyebrow: 'Groupe d’achat · vue d’équipe · ventes à jour au 31 octobre 2026', recherche: '<div class="gr-outils-b">' + outils + '</div>' }) +
    LE.VP_G + '<div class="sous-bandeau" data-interne>' + J.identite({ classe: 'gr-id', nom: esc(g.nom), meta: '<span class="etat">' + J.ico('group', 'var(--e-neutre)') + 'Groupe d’achat</span><span class="sub">' + esc(J.X.personne.secteur) + '</span>', mois: { lib: 'Chiffre d’affaires · janv.–oct. 2026', val: eur(g.ca), evo: J.evoHtml(evo, 'oct. sur sept.') }, lignes: lignes, actions: actions }) +
    '<section class="carte gr-membres"><div class="tete"><div><h2>Pharmacies membres</h2><p class="st">les ' + offs.length + ' adhérentes actives sur ' + nf.format(g.officines) + ' · classées par chiffre d’affaires · un clic ouvre la fiche · « × N la moyenne » : face à l’officine moyenne de nos clients</p></div></div>' +
    '<table class="tabl gr-tabm"><thead><tr><th>Officine<span class="st">état · ville</span></th><th class="num">Chiffre d’affaires<span class="st">cumul janv.–oct. 2026</span></th><th>10 mois<span class="st">oct. sur sept.</span></th><th class="num">À lui proposer<span class="st">sur les 100 plus vendus</span></th><th></th></tr></thead><tbody>' + offs.map(function (o, i) { return LE.ligneOff(o, i); }).join('') + '</tbody></table></section>' +
    LE.listeAchats(cle, { q: q }) + '</div></div>';
  J.poseIcones(el);
  var re = function () { J.grDetail(el); };
  LE.lierOff(el); LE.lierListe(el, cle, re);
  $$('[data-pn]', el).forEach(function (b) { b.onclick = function () { var k = idx + (+b.getAttribute('data-pn')); if (k < 0) k = G.liste.length - 1; if (k >= G.liste.length) k = 0; E.sel = G.liste[k].nom; J.route(); }; });
  $('#gr-autre', el).onchange = function (e) { if (e.target.value) { E.sel = e.target.value; J.route(); } };
  $$('[data-gr-la]', el).forEach(function (b) { b.onclick = function () { var t = $('#la-' + cle, el); if (t) window.scrollTo(0, Math.max(0, t.getBoundingClientRect().top + window.scrollY - 90)); }; });
  $$('[data-gr-carte]', el).forEach(function (b) { b.onclick = function () { J.aller('carte-groupements'); }; });
};
})();
