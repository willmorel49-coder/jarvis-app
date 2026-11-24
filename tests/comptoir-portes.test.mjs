/* « Les trois portes » du Catalogue produits (09/11/2026) : l'écran d'entrée de la route Produits.
   Données FABRIQUÉES, réponse connue d'avance (voir le tableau ci-dessous). Vrai code : v2-comptoir.js entier, dans un bac à sable
   sans navigateur ; les fichiers (national, prix au JO, ANSM) sont servis par un faux fetch, comme dans comptoir-stats.test.mjs.
   Lancer : node --test tests/comptoir-portes.test.mjs

   Catalogue de 6 produits (rang France / nos ventes à l'année / prix net) :
     ALPHA   rang 1  12/an   1,80 €   opportunité, potentiel ≈ 463 €
     BETA    rang 2  480/an  4,00 €   nous vendons beaucoup : pas une opportunité
     GAMMA   rang 3  24/an   20,00 €  opportunité, potentiel ≈ 2 749 € (le plus gros)
     DELTA   rang 4  360/an  3,00 €   en rupture ANSM, pas une opportunité
     EPSILON rang 5  12/an   5,00 €   opportunité, potentiel ≈ 478 € ; nouveauté (AMM 02/2026)
     ZETA    sans rang France
   Part moyenne = 888 / 3 300 boîtes. Ordre « À proposer » attendu : GAMMA, EPSILON, ALPHA (et non l'ordre des rangs). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const A = '3400000000001', B = '3400000000002', G = '3400000000003', DL = '3400000000004', E = '3400000000005', Z = '3400000000006';
const CAT = {
  [A]: { c: A, cip: A, d: 'ALPHA 500MG BT10', labo: 'LABO UN', mol: 'alphamol', f: 'pr_low', ppht: 2, net: 1.8, stock: 10, n: 0 },
  [B]: { c: B, cip: B, d: 'BETA 10MG BT30', labo: 'LABO DEUX', mol: 'betamol', f: 'pr_mid', ppht: 4.5, net: 4, stock: 0, n: 0 },
  [G]: { c: G, cip: G, d: 'GAMMA 1G BT8', labo: 'LABO TROIS', mol: 'gammamol', f: 'pr_high', ppht: 22, net: 20, stock: 7, n: 0 },
  [DL]: { c: DL, cip: DL, d: 'DELTA 5MG BT28', labo: 'LABO UN', mol: 'deltamol', f: 'pr_low', ppht: 3.5, net: 3, stock: 4, n: 0 },
  [E]: { c: E, cip: E, d: 'ALPHA JUNIOR 250MG', labo: 'LABO QUATRE', mol: 'epsimol', f: 'pr_low', ppht: 5.5, net: 5, stock: 3, n: 0 },
  [Z]: { c: Z, cip: Z, d: 'ZETA NR', labo: 'LABO CINQ', mol: '', f: 'nr', ppht: 9, net: 0, stock: 2, n: 0 }
};
const VENTES = [[ '1', 1, 'X', A, 1, 1, 1 ], [ '1', 1, 'X', B, 40, 1, 1 ], [ '1', 1, 'X', G, 2, 1, 1 ], [ '1', 1, 'X', DL, 30, 1, 1 ], [ '1', 1, 'X', E, 1, 1, 1 ]];
const FAUX = {
  'national.json': { generated: '2026-11-08', data: { [A]: { v: 1000, d: 'ALPHAMOL' }, [B]: { v: 800, d: 'BETAMOL' }, [G]: { v: 600, d: 'GAMMAMOL' }, [DL]: { v: 500, d: 'DELTAMOL' }, [E]: { v: 400, d: 'EPSIMOL' } } },
  'prix-futurs.json': { generated: '2026-11-08', changes: [
    { c: A, d: 'ALPHA', pfht: 1.5, ppttc: 3.0, ancien_ttc: 3.5, sens: 'baisse', date_effet: '2026-10-20', date_publi: '2026-10-20' },     // en vigueur depuis moins de 180 jours
    { c: B, d: 'BETA', pfht: 3, ppttc: 8, ancien_ttc: 10, sens: 'baisse', date_effet: '2026-12-01', date_publi: '2026-11-01' },       // à venir
    { c: DL, d: 'DELTA', pfht: 3, ppttc: 6, ancien_ttc: 5, sens: 'hausse', date_effet: '2026-10-20', date_publi: '2026-10-20' },     // une hausse : pas une baisse
    { c: G, d: 'GAMMA', pfht: 3, ppttc: 6, ancien_ttc: 8, sens: 'baisse', date_effet: '2026-01-02', date_publi: '2026-01-02' },       // trop ancienne (> 180 jours)
    { c: '3499999999999', d: 'HORS CATALOGUE', pfht: 3, ppttc: 6, ancien_ttc: 8, sens: 'baisse', date_effet: '2026-10-25', date_publi: '2026-10-25' }] },
  'prix-futurs-archive.json': { evenements: [] },
  'ansm-dispo.json': { generated: '2026-11-08', items: [
    { st: 'Rupture de stock', cips: [DL], since: '2026-11-06', retour: { raw: 'décembre 2026', iso: '2026-12' } },
    { st: "Tension d'approvisio", cips: [G], since: '2026-10-01' }] }
};
const RUPT = new Set([DL]);

function faitFetch(table, echec) {
  return (url) => {
    const f = String(url).split('?')[0];
    if (echec && echec.includes(f)) return Promise.reject(new Error('réseau coupé'));
    if (f in table) return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(table[f]))) });
    return Promise.resolve({ ok: false, json: () => Promise.reject(new Error('404')) });
  };
}
function monter(table = FAUX, echec) {
  const crees = [], ecouteurs = {};
  const doc = {
    getElementById: (id) => crees.find((e) => e.id === id) || null,
    createElement: () => { const e = { id: '', innerHTML: '', textContent: '' }; crees.push(e); return e; },
    head: { appendChild() {} }, body: { appendChild() {} }
  };
  const sb = { document: doc, console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Date, location: { hash: '#produits' }, innerWidth: 1280 };
  sb.window = sb; sb.globalThis = sb;
  sb.addEventListener = (ev, f) => { (ecouteurs[ev] = ecouteurs[ev] || []).push(f); };
  sb.fetch = faitFetch(table, echec);
  sb.rendus = 0; sb.crees = crees; sb.ecouteurs = ecouteurs;
  vm.createContext(sb);
  vm.runInContext(`window.V2 = {
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    route: { name: 'produits' }, render() { window.rendus++; }, go() {}, toast() {},
    produits: { S: { sel: {} }, FAM: { pr_low: { l: 'Princeps bas prix' }, pr_mid: { l: 'Princeps moyens' }, pr_high: { l: 'Princeps chers' }, nr: { l: 'Non remboursables' } },
      catalogueIndex: () => window.CATX, enRupture: (c) => window.RUPTX.has(String(c)), rupturesEtat: () => 2, selSauver() {}, index: () => null },
    nouveaute: (c) => (window.NOUVEAUTES && window.NOUVEAUTES.data[String(c)]) || null,
    ventesRestreintes: () => false
  };
  window.ICO = (n) => '<svg data-i="' + n + '"></svg>';
  window.WML_SALES = ${JSON.stringify(VENTES)};
  window.STOCK_IP = { data: ${JSON.stringify({ [A]: 5, [B]: 0, [G]: 5, [DL]: 5, [E]: 5 })} };
  window.NOUVEAUTES = { meta: { mois: 36, gen: '2026-11-03', source: 'BDPM' }, data: { '${E}': { amm: '2026-02', labo: 'LABO QUATRE' }, '3488888888888': { amm: '2026-03', labo: 'HORS CATALOGUE' } } };`, sb);
  sb.CATX = JSON.parse(JSON.stringify(CAT)); sb.RUPTX = RUPT;
  vm.runInContext(readFileSync(new URL('../crm/v2/v2-comptoir.js', import.meta.url), 'utf8'), sb);
  sb.V2.comptoir._calc.horloge(() => new Date(2026, 10, 9));   // 09/11/2026
  return sb;
}
const nu = (x) => JSON.parse(JSON.stringify(x));
const nb = (h, re) => (h.match(re) || []).length;
const sansBalises = (h) => h.replace(/<[^>]*>/g, ' ').replace(/[\s\u00a0]+/g, ' ');
async function pret(sb) {
  await sb.V2.comptoir.chargerNational();
  sb.V2.comptoir.rendre();                    // lance les demandes de fichiers
  await sb.V2.comptoir._calc.pret();
  return sb;
}
const C = (sb) => sb.V2.comptoir._portes.etat;
const noms = (h) => nu([...h.matchAll(/<span class="(?:cpd|cq1)-nm">([^<]*)</g)].map((m) => m[1]));   // 23/11/2026, v1 La recherche d'abord : les lignes de résultats de la recherche s'appellent cq1-nm
const lignesRes = (h) => nu([...h.matchAll(/<span class="cq1-nm">([^<]*)</g)].map((m) => m[1]));   // 23/11/2026 : seulement les lignes de RÉSULTATS de la recherche (la liste « Ce qui change » de l'accueil utilise cpd-nm)
const panneau = (sb) => sb.crees.find((e) => e.id === 'cp-pan-hote').innerHTML;

test('au repos : le bandeau, le grand champ de recherche, « Ce qui change », deux entrées vers le reste ; ni portes, ni tableau', async () => {
  // 23/11/2026, v1 La recherche d'abord : classe (b)/(c). Les trois portes et la question « Que voulez-vous faire ? » ont disparu ; le champ est l'écran.
  const sb = await pret(monter());
  const h = sb.V2.comptoir.rendre(), t = sansBalises(h);
  assert.match(t, /Catalogue produits/); assert.match(t, /Prix, stock et marge des 7 établissements/);
  assert.equal(nb(h, /id="cpd-q"/g), 1, 'le champ de recherche, une seule fois');
  assert.equal(nb(h, /class="cpd-door"/g), 0, 'plus de trois grandes portes');
  assert.doesNotMatch(t, /Que voulez-vous faire|Trois portes/);
  for (const x of ['Ce qui change', 'Parcourir tout le catalogue', 'Préparer une sélection pour une officine']) assert.ok(t.includes(x), x);
  assert.doesNotMatch(t, /À proposer/, 'retiré le 23/11/2026 (pas de plus-value)');
  assert.equal(nb(h, /class="cp-head"/g), 0, 'pas de tableau au repos');
  assert.equal(nb(h, /class="cp-tete"/g), 0);
  assert.doesNotMatch(t, /n'a pas pu s'afficher|Données non chargées/);
  // les deux chiffres du bandeau : 6 références, 5 en stock (BETA est à 0) ; les 7 établissements sont dans la phrase
  const stats = [...h.matchAll(/<div class="cpd-stat"><b>([^<]*)<\/b><span>([^<]*)</g)].map((m) => m[1] + ' ' + m[2]);
  assert.deepEqual(nu(stats), ['6 références', '5 en stock']);
});

test('« Ce qui change » à l\'accueil : « … » tant que le relevé n\'est pas arrivé, puis les trois nombres du moteur', async () => {
  // 23/11/2026, v1 La recherche d'abord : classe (c). L'aperçu des trois portes (exemples, « À proposer ») n'existe plus ; les nombres du moteur se lisent sur les onglets de l'accueil.
  const sb = monter();
  await sb.V2.comptoir.chargerNational();
  let h = sb.V2.comptoir.rendre();
  assert.match(sansBalises(h), /Prix au JO …/, 'pas encore arrivé : « … », pas un faux zéro');
  await sb.V2.comptoir._calc.pret();
  h = sb.V2.comptoir.rendre();
  const tabs = [...h.matchAll(/<button type="button" class="cq1-tab[^"]*"[^>]*>([^<]*)<i>([^<]*)<\/i>/g)].map((m) => m[1].trim() + ' ' + m[2]);
  assert.deepEqual(nu(tabs), ['Prix au JO 2', 'Ruptures 1', 'Nouveautés 1']);
  assert.doesNotMatch(sansBalises(h), /3 000 €|ALPHA JUNIOR 250MG 478|de plus par an/, 'plus aucun montant « à proposer »');
});

test('« Ce qui change » ouvre son volet dans la page, avec un retour vers la recherche ; « trouver » et l\'ancien « proposer » ramènent à l\'accueil', async () => {
  // 23/11/2026, v1 La recherche d'abord : classe (c). Il reste un seul volet (« Ce qui change ») ; « À proposer » est retiré, « Trouver » est l'accueil lui-même.
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  K.porte('change');
  assert.equal(C(sb).porte, 'change');
  let h = K.rendre();
  assert.match(h, /<h2 class="cpd-vt">Ce qui change<\/h2>/);
  assert.match(h, /V2\.comptoir\.portes\(\)">[^]*Recherche/);
  assert.equal(nb(h, /id="cpd-q"/g), 0, 'le volet laisse la place à la liste');
  assert.doesNotMatch(h, /cp-aside|role="dialog"/, 'pas de fenêtre par-dessus');
  K.portes();
  assert.equal(C(sb).porte, null);
  assert.equal(nb(K.rendre(), /id="cpd-q"/g), 1, 'le retour ramène au champ de recherche');
  for (const k of ['trouver', 'proposer']) {
    K.porte('change');
    assert.doesNotThrow(() => K.porte(k));
    assert.equal(C(sb).porte, null, k + ' = accueil');
    assert.equal(nb(K.rendre(), /id="cpd-q"/g), 1);
  }
});

test('Trouver (l\'accueil) : champ de recherche, puces de familles dès qu\'on cherche, SANS le filtre Opportunités', async () => {
  // 23/11/2026, v1 La recherche d'abord : classe (c) pour la liste « Les plus vendus en France » (vide, l'accueil montre « Ce qui change », plus une liste de produits) ; classe (b) pour le reste :
  // la règle (la recherche ne porte pas le filtre Opportunités, BETA qui n'en est pas une se trouve) vit dans les lignes de résultats cq1.
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  assert.equal(C(sb).opp, true, 'départ : le filtre Opportunités est actif dans l\'état');
  K.porte('trouver');
  assert.equal(C(sb).porte, null);
  let h = K.rendre();
  assert.match(h, /<input id="cpd-q" type="search"/);
  assert.doesNotMatch(sansBalises(h), /Les plus vendus en France/, 'à vide : pas de liste de produits');
  assert.deepEqual(lignesRes(h), [], 'à vide : aucune ligne de résultat de recherche');
  assert.doesNotMatch(h, /Opportunités seulement/);
  C(sb).q = 'beta';
  h = K.rendre();
  assert.deepEqual(noms(h), ['BETA 10MG BT30'], 'BETA (pas une opportunité) est trouvé : le filtre Opportunités ne s\'applique pas');
  assert.match(sansBalises(h), /1 résultat/);
  assert.match(h, /Toutes les familles/); assert.match(h, /Princeps bas prix/, 'les puces de familles apparaissent avec les résultats');
  C(sb).q = 'alpha'; C(sb).fam = 'pr_low';
  assert.deepEqual(noms(K.rendre()), ['ALPHA 500MG BT10', 'ALPHA JUNIOR 250MG']);
  // la rupture ANSM se voit dans la liste
  C(sb).q = 'delta'; C(sb).fam = 'all';
  assert.match(K.rendre(), /Rupture ANSM/);
});

test('Ce qui change : trois onglets dont les nombres sont ceux du moteur ; libellés et durées lus dans les définitions', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  const d = K._calc.donnees(), X = K._portes.changements(d);
  assert.equal(X.jo.length, 2); assert.equal(X.rup.length, 1); assert.equal(X.nv.length, 1);
  K.porte('change');
  let h = K.rendre();
  const tabs = [...h.matchAll(/<button type="button" class="cpd-tab[^"]*"[^>]*>([^<]*)<i>([^<]*)<\/i>/g)].map((m) => m[1].trim() + ' ' + m[2]);
  assert.deepEqual(nu(tabs), ['Prix au JO 2', 'Ruptures 1', 'Nouveautés 1']);
  // Prix au JO : la baisse à venir d'abord (BETA), puis celle en vigueur (ALPHA) ; ni la hausse, ni la trop ancienne, ni le hors-catalogue
  assert.deepEqual(noms(h), ['BETA 10MG BT30', 'ALPHA 500MG BT10']);
  const t = sansBalises(h);
  assert.match(t, /moins de 180 jours/); assert.match(t, /relevé du 08\/11\/2026/);
  assert.match(t, /À partir du 01\/12\/2026 · prix public 10,00 → 8,00 €/); assert.match(t, /−20,0 %/); assert.match(t, /à venir/);
  assert.match(t, /Depuis le 20\/10\/2026 · prix public 3,50 → 3,00 €/); assert.match(t, /en vigueur/);
  // Ruptures
  K.onglet('rup');
  h = K.rendre();
  assert.deepEqual(noms(h), ['DELTA 5MG BT28Rupture ANSM'].map((x) => x.replace('Rupture ANSM', '')));
  const tr = sansBalises(h);
  assert.match(tr, /Rupture depuis le 06\/11\/2026 · retour annoncé : déc\. 2026/);
  assert.match(tr, /relevé du 08\/11\/2026/); assert.match(tr, /tensions d'approvisionnement ne sont pas comptées/);
  // Nouveautés : durée et date du relevé lues dans le fichier
  K.onglet('nv');
  h = K.rendre();
  assert.deepEqual(noms(h), ['ALPHA JUNIOR 250MG']);
  const tn = sansBalises(h);
  assert.match(tn, /moins de 36 mois/); assert.match(tn, /relevé du 03\/11\/2026/); assert.match(tn, /LABO QUATRE · AMM févr\. 2026/);
});

test('Ce qui change : fichier pas encore arrivé = « … » puis redessin ; fichier en échec = « — », jamais un faux zéro', async () => {
  const sb = monter();
  await sb.V2.comptoir.chargerNational();
  sb.V2.comptoir.porte('change');
  const avant = sb.rendus;
  let h = sb.V2.comptoir.rendre();
  assert.match(sansBalises(h), /Prix au JO …/); assert.match(sansBalises(h), /Le relevé du Journal officiel arrive/);
  await sb.V2.comptoir._calc.pret();
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(sb.rendus > avant, 'l\'écran se redessine à l\'arrivée du fichier');
  h = sb.V2.comptoir.rendre();
  assert.match(sansBalises(h), /Prix au JO 2/);
  const sb2 = monter(FAUX, ['prix-futurs.json', 'prix-futurs-archive.json']);
  await sb2.V2.comptoir.chargerNational();
  sb2.V2.comptoir.porte('change'); sb2.V2.comptoir.rendre(); await sb2.V2.comptoir._calc.pret();
  h = sb2.V2.comptoir.rendre();
  assert.match(sansBalises(h), /Prix au JO —/); assert.match(sansBalises(h), /n'est pas disponible pour le moment/);
});

test('À proposer : la règle « opportunité » reste calculée (liste du plus gros potentiel au plus petit) mais n\'est plus AFFICHÉE ni à l\'accueil ni en volet', async () => {
  // 23/11/2026, v1 La recherche d'abord : classe (c). « À proposer » (liste de produits) est retiré à la demande de Will (« ça n'a pas de plus-value ») ;
  // le moteur (propositions = lignes l.opp) reste, il alimente encore « Parcourir tout » (filtre Opportunités) ; l'affichage disparaît.
  const sb = await pret(monter());
  const K = sb.V2.comptoir, d = K._calc.donnees();
  const attendu = d.lignes.filter((l) => l.opp).sort((a, b) => b.pot - a.pot).map((l) => l.d);
  assert.deepEqual(nu(attendu), ['GAMMA 1G BT8', 'ALPHA JUNIOR 250MG', 'ALPHA 500MG BT10']);
  assert.deepEqual(nu(K._portes.propositions(d)).map((l) => l.d), nu(attendu));
  K.porte('proposer');
  assert.equal(C(sb).porte, null);
  const h = K.rendre(), t = sansBalises(h);
  assert.deepEqual(lignesRes(h), [], 'aucune ligne de résultat de recherche');
  assert.doesNotMatch(t, /GAMMA|ALPHA JUNIOR/, 'les produits « à proposer » (hors des listes « Ce qui change ») ne s\'affichent pas');
  assert.doesNotMatch(t, /À proposer|top 200 des ventes|part moyenne|de plus par an|3 000 €|478 €|463 €/);
  assert.doesNotMatch(h, /resultatsProposer|cq1-proposer/);
});

test('Parcourir : l\'écran d\'avant, entier, mais ouvert SANS « Opportunités seulement » ; le filtre reste disponible', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  assert.equal(C(sb).opp, true);
  K.porte('tout');
  assert.equal(C(sb).opp, false);
  let h = K.rendre();
  assert.match(h, /<h2 class="cpd-vt">Parcourir tout le catalogue<\/h2>/);
  assert.match(h, /class="cp-head"/); assert.match(h, /class="cp-tete"/); assert.match(h, /id="cp-bar-hote"/); assert.match(h, /class="cp-leg"/); assert.match(h, /class="cp-src"/);
  assert.match(h, /Opportunités seulement/); assert.doesNotMatch(h, /cp-chip on" onclick="V2\.comptoir\.opp\(\)"/);
  for (const sel of ['V2.comptoir.stock()', 'V2.comptoir.top(this.value)', 'V2.comptoir.tri(this.value)', 'V2.comptoir.panierTout()']) assert.ok(h.includes(sel), sel);
  assert.equal(nb(h, /class="cp-row/g), 6, 'les six produits, opportunités ou non');
  K.opp();
  assert.equal(C(sb).opp, true);
  h = K.rendre();
  assert.match(h, /cp-chip on" onclick="V2\.comptoir\.opp\(\)"/);
  assert.equal(nb(h, /class="cp-row/g), 3, 'le filtre fonctionne toujours');
});

test('fiche : « À qui le proposer » est un bloc à part, n° 3, juste après les marges ; absent en vue pharmacien ; plus dans « Chez nous »', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  K.portes(); K.ouvrir(G);                   // 23/11/2026, v1 : l'ancien volet « À proposer » n'existe plus, on part de l'accueil
  K.vuePharma(false);
  K.rendre();
  let p = panneau(sb);
  const pos = (id) => p.indexOf('id="cq-b' + id + '"');
  assert.ok(pos(1) > 0 && pos(1) < pos(2) && pos(2) < pos(3) && pos(3) < pos(4) && pos(4) < pos(5) && pos(5) < pos(6), 'blocs 1 à 6 dans l\'ordre');
  assert.match(p, /<span>3<\/span>À qui le proposer · interne/);
  assert.match(p, /<span>2<\/span>Les marges/); assert.match(p, /<span>4<\/span>Le marché/); assert.match(p, /<span>5<\/span>Chez nous · interne/); assert.match(p, /<span>6<\/span>Le produit/);
  // juste après les marges : entre le bloc 2 et le bloc 3 il n'y a que la bande « Interne »
  const entre = p.slice(pos(2), pos(3));
  assert.ok(!/id="cq-b[0-9]"/.test(entre.slice(10)), 'aucun autre bloc numéroté entre 2 et 3');
  assert.match(p, /class="cq-sep" role="note"><span>Interne<\/span> masqué en vue pharmacien<\/div><section class="cq-bl cq-bl-i" aria-labelledby="cq-b3"/);
  assert.equal(nb(p, /À qui le proposer/g), 1, 'le titre du bloc, une seule fois ; rien dans « Chez nous »');
  const chezNous = p.slice(pos(5), pos(6));
  assert.doesNotMatch(chezNous, /À qui le proposer/);
  assert.match(p, /Vue pharmacien/);
  // vue pharmacien : le bloc (qui nomme d'autres officines) n'existe plus, le bouton reste
  K.vuePharma(true);
  K.rendre();
  p = panneau(sb);
  assert.doesNotMatch(p, /À qui le proposer/); assert.doesNotMatch(p, /cq-b3|cq-b5/);
  assert.match(p, /Vue pharmacien/); assert.match(p, /class="cp-vp on"/);
  assert.match(p, /<span>4<\/span>Le marché/); assert.match(p, /<span>6<\/span>Le produit/);
  K.vuePharma(false);
});

test('entrées venues d\'ailleurs (⌘K, lien molécule) : le volet Trouver, recherche remplie, résultat visible', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  C(sb).opp = true; C(sb).fam = 'pr_low'; C(sb).stock = true;
  K.depuisRecherche({ cip: B, q: 'beta' });
  // 23/11/2026, v1 La recherche d'abord : classe (b). « trouver » est l'accueil (porte null) : la même règle (recherche remplie, résultat visible, filtres remis à zéro) se lit sur l'état et sur le champ rendu.
  assert.equal(C(sb).porte, null); assert.equal(C(sb).cip, B); assert.equal(C(sb).opp, false); assert.equal(C(sb).fam, 'all');
  let h = K.rendre();
  assert.deepEqual(noms(h), ['BETA 10MG BT30'], 'le résultat est visible derrière la fiche');
  assert.match(panneau(sb), /BETA 10MG BT30/);
  K.fermerPanneau();
  C(sb).porte = 'change';
  K.molecule('gammamol');
  assert.ok([null, 'trouver'].includes(C(sb).porte), 'accueil'); assert.equal(C(sb).q, 'gammamol');
  h = K.rendre();
  assert.match(h, /id="cpd-q"[^>]*value="gammamol"/, 'le champ est rempli');
  assert.ok(noms(h).includes('GAMMA 1G BT8'));
  // molécule sans CIP depuis ⌘K : le produit le plus vendu s'ouvre, volet Trouver dessous
  K.depuisRecherche({ q: 'alphamol', mol: 'alphamol' });
  assert.equal(C(sb).porte, null);
  K.rendre();
  assert.equal(C(sb).cip, A);
});

test('quitter l\'écran Produits : au retour, l\'accueil', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  K.porte('change'); K.rendre();             // pose l'écouteur de changement d'adresse (23/11/2026, v1 : « change » au lieu de l'ancien volet « proposer »)
  assert.equal(C(sb).porte, 'change');
  sb.location.hash = '#produits';
  sb.ecouteurs.hashchange.forEach((f) => f());
  assert.equal(C(sb).porte, 'change', 'rester sur Produits ne change rien');
  sb.location.hash = '#accueil';
  sb.ecouteurs.hashchange.forEach((f) => f());
  assert.equal(C(sb).porte, null);
});

test('styles des portes : police de l\'app, chiffres alignés, aucun texte sous 13 px, aucun interdit Safari, préfixe propre', async () => {
  const sb = await pret(monter());
  sb.V2.comptoir.rendre();
  const css = sb.crees.find((e) => e.id === 'cpd-styles').textContent;
  assert.ok(css.length > 2000);
  assert.doesNotMatch(css, /monospace|Menlo|Courier|SF Mono/);
  assert.match(css, /font-variant-numeric:tabular-nums/);
  assert.doesNotMatch(css, /backdrop-filter|background-clip:\s*text|-webkit-text-fill-color|filter:\s*blur/);
  const tailles = [...css.matchAll(/font:[^;}]*?(\d+(?:\.\d+)?)px\//g)].map((m) => +m[1]).concat([...css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]));
  assert.ok(tailles.length > 20 && Math.min(...tailles) >= 13, 'plus petite taille : ' + Math.min(...tailles));
  assert.match(css, /\.cpd-champ input\{[^}]*box-shadow:none/); assert.match(css, /\.cpd-champ:focus-within/);
  assert.match(css, /\.cpd-door\{appearance:none/);
  // le préfixe n'est utilisé nulle part ailleurs dans le CRM (vérifié au 09/11 : git grep « cpd- » = ce fichier seul)
  const autres = ['v2-produits.js', 'v2-app.js', 'v2-pharma.js', 'v2-pilotage.js'].map((f) => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(autres, /cpd-/);
  assert.doesNotMatch(sansBalises(sb.V2.comptoir.rendre()), /\bremise/i, 'vocabulaire : « abandon de marge », jamais « remise »');
});

// 24/11/2026, choix cliqué de Will (« Nom du catalogue ») : sur la ligne Nouveautés, Karine voyait le titulaire de l'AMM
// (« MERCK SHARP & DOHME (PAYS-BAS) ») et, dans Mes favoris, le labo du catalogue (« MSD FRANCE »). Désormais le labo du
// catalogue partout ; le titulaire de l'AMM (BDPM) seulement quand le catalogue n'a pas de labo.
test('Nouveautés : le labo du catalogue avant le titulaire de l\'AMM, sur l\'accueil, dans le volet et dans la fiche', async () => {
  const sb = monter();
  sb.NOUVEAUTES.data[E].labo = 'TITULAIRE OFFICIEL (PAYS-BAS)';   // BDPM ≠ catalogue (« LABO QUATRE »)
  await pret(sb);
  const K = sb.V2.comptoir;
  K.onglet('nv');                                                 // l'accueil : la carte « Ce qui change »
  let t = sansBalises(K.rendre());
  assert.match(t, /LABO QUATRE · AMM févr\. 2026/); assert.doesNotMatch(t, /TITULAIRE OFFICIEL/);
  K.porte('change'); K.onglet('nv');                              // le volet entier
  t = sansBalises(K.rendre());
  assert.match(t, /LABO QUATRE · AMM févr\. 2026/); assert.doesNotMatch(t, /TITULAIRE OFFICIEL/);
  const s = { autres: { froid: false, nouveaute: { amm: '2026-02', labo: 'TITULAIRE OFFICIEL (PAYS-BAS)' } }, generique: null, tendance: null, sansEtude: true };
  let f = sansBalises(K._calc.blocProduit(s, { cip: E, d: 'ALPHA JUNIOR 250MG', labo: 'LABO QUATRE' }, ''));
  assert.match(f, /AMM 2026-02 · LABO QUATRE/); assert.doesNotMatch(f, /TITULAIRE OFFICIEL/);
  // à défaut de labo au catalogue : le titulaire de l'AMM, comme avant
  f = sansBalises(K._calc.blocProduit(s, { cip: E, d: 'ALPHA JUNIOR 250MG', labo: '' }, ''));
  assert.match(f, /AMM 2026-02 · TITULAIRE OFFICIEL \(PAYS-BAS\)/);
  const sb2 = monter();
  sb2.NOUVEAUTES.data[E].labo = 'TITULAIRE OFFICIEL (PAYS-BAS)'; sb2.CATX[E].labo = '';
  await pret(sb2);
  sb2.V2.comptoir.porte('change'); sb2.V2.comptoir.onglet('nv');
  assert.match(sansBalises(sb2.V2.comptoir.rendre()), /TITULAIRE OFFICIEL \(PAYS-BAS\) · AMM févr\. 2026/);
});
