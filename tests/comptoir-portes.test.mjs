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
const noms = (h) => nu([...h.matchAll(/<span class="cpd-nm">([^<]*)</g)].map((m) => m[1]));
const panneau = (sb) => sb.crees.find((e) => e.id === 'cp-pan-hote').innerHTML;

test('au repos : le bandeau, la question, trois portes, le lien Parcourir ; ni tableau ni barre de recherche', async () => {
  const sb = await pret(monter());
  const h = sb.V2.comptoir.rendre(), t = sansBalises(h);
  assert.match(t, /Catalogue produits/); assert.match(t, /Prix et stock des 7 établissements/);
  assert.match(t, /Que voulez-vous faire \?/);
  assert.equal(nb(h, /class="cpd-door"/g), 3);
  for (const x of ['Trouver un produit', 'Ce qui change', 'À proposer', 'Parcourir tout le catalogue']) assert.ok(t.includes(x), x);
  assert.equal(nb(h, /class="cp-head"/g), 0, 'pas de tableau au repos');
  assert.equal(nb(h, /class="cp-tete"/g), 0);
  assert.doesNotMatch(t, /n'a pas pu s'afficher|Données non chargées/);
  // les trois chiffres du bandeau : 6 références, 5 en stock (BETA est à 0), 7 établissements
  const stats = [...h.matchAll(/<div class="cpd-stat"><b>([^<]*)<\/b><span>([^<]*)</g)].map((m) => m[1] + ' ' + m[2]);
  assert.deepEqual(nu(stats), ['6 références', '5 en stock', '7 établissements']);
});

test('aperçu des portes : exemples = meilleurs rangs à premier mot distinct ; trois nombres ; trois premiers à proposer', async () => {
  const sb = monter();
  await sb.V2.comptoir.chargerNational();
  let h = sb.V2.comptoir.rendre();
  assert.match(sansBalises(h), /… baisses de prix au JO/, 'pas encore arrivés : « … », pas un faux zéro');
  await sb.V2.comptoir._calc.pret();
  h = sb.V2.comptoir.rendre();
  // exemples : rang 1 ALPHA, rang 2 BETA, rang 3 GAMMA (ALPHA JUNIOR n'est pas repris : même premier mot)
  assert.match(h, /<em>ALPHA 500MG · BETA 10MG · GAMMA 1G<\/em>/);
  const p2 = [...h.matchAll(/<span><b>([^<]*)<\/b><span class="n">([^<]*)</g)].map((m) => m[1] + ' ' + m[2]);
  assert.deepEqual(nu(p2), ['2 baisses de prix au JO', '1 rupture dans notre catalogue', '1 nouveautés de moins de 36 mois']);
  const p3 = [...h.matchAll(/<span><span class="n">([^<]*)<\/span><b>([^<]*)<\/b>/g)].map((m) => m[1] + ' | ' + m[2].replace(/\u00a0/g, ' '));
  assert.deepEqual(nu(p3), ['GAMMA 1G BT8 | 3 000 €', 'ALPHA JUNIOR 250MG | 478 €', 'ALPHA 500MG BT10 | 463 €']);
});

test('chaque porte ouvre son volet dans la page, avec un retour vers les trois portes', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  const titres = { trouver: 'Trouver un produit', change: 'Ce qui change', proposer: 'À proposer' };
  for (const k of Object.keys(titres)) {
    K.porte(k);
    assert.equal(C(sb).porte, k);
    const h = K.rendre();
    assert.match(h, new RegExp('<h2 class="cpd-vt">' + titres[k] + '</h2>'));
    assert.match(h, /V2\.comptoir\.portes\(\)">[^]*Les trois portes/);
    assert.equal(nb(h, /class="cpd-door"/g), 0, 'les portes laissent la place au volet');
    assert.doesNotMatch(h, /cp-aside|role="dialog"/, 'pas de fenêtre par-dessus');
    K.portes();
    assert.equal(C(sb).porte, null);
    assert.equal(nb(K.rendre(), /class="cpd-door"/g), 3, 'le retour ramène aux trois portes');
  }
});

test('Trouver : champ de recherche, puces de familles, « Les plus vendus en France » par rang, SANS le filtre Opportunités', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  assert.equal(C(sb).opp, true, 'départ : le filtre Opportunités est actif dans l\'état');
  K.porte('trouver');
  let h = K.rendre();
  assert.match(h, /<input id="cpd-q" type="search"/);
  assert.match(h, /Toutes les familles/); assert.match(h, /Princeps bas prix/);
  assert.match(sansBalises(h), /Les plus vendus en France/);
  assert.deepEqual(noms(h), ['ALPHA 500MG BT10', 'BETA 10MG BT30', 'GAMMA 1G BT8', 'DELTA 5MG BT28', 'ALPHA JUNIOR 250MG', 'ZETA NR'], 'ordre = rang France ; BETA (pas une opportunité) est là');
  assert.doesNotMatch(h, /Opportunités seulement/);
  C(sb).q = 'beta';
  h = K.rendre();
  assert.deepEqual(noms(h), ['BETA 10MG BT30']);
  assert.match(sansBalises(h), /1 résultat/);
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

test('À proposer : exactement les lignes « opportunité », du plus gros potentiel au plus petit ; règle expliquée', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir, d = K._calc.donnees();
  const attendu = d.lignes.filter((l) => l.opp).sort((a, b) => b.pot - a.pot).map((l) => l.d);
  assert.deepEqual(nu(attendu), ['GAMMA 1G BT8', 'ALPHA JUNIOR 250MG', 'ALPHA 500MG BT10']);
  assert.deepEqual(nu(K._portes.propositions(d)).map((l) => l.d), nu(attendu));
  K.porte('proposer');
  const h = K.rendre();
  assert.deepEqual(noms(h), nu(attendu));
  const t = sansBalises(h);
  assert.match(t, /top 200 des ventes en France/); assert.match(t, /sous notre part moyenne \(26,91 %\)/);
  assert.match(t, /3 produits/);
  assert.match(t, /3 000 € par an/); assert.match(t, /478 € par an/); assert.match(t, /463 € par an/);
  assert.doesNotMatch(t, /BETA|DELTA|ZETA/, 'ni les produits où nous vendons déjà beaucoup, ni ceux sans rang');
  assert.doesNotMatch(t, /officines qui le prennent|réseau prend/, 'pas le repère « réseau » de la maquette');
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
  K.porte('proposer'); K.ouvrir(G);
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
  assert.equal(C(sb).porte, 'trouver'); assert.equal(C(sb).cip, B); assert.equal(C(sb).opp, false); assert.equal(C(sb).fam, 'all');
  let h = K.rendre();
  assert.deepEqual(noms(h), ['BETA 10MG BT30'], 'le résultat est visible derrière la fiche');
  assert.match(panneau(sb), /BETA 10MG BT30/);
  K.fermerPanneau();
  C(sb).porte = 'change';
  K.molecule('gammamol');
  assert.equal(C(sb).porte, 'trouver'); assert.equal(C(sb).q, 'gammamol');
  h = K.rendre();
  assert.ok(noms(h).includes('GAMMA 1G BT8'));
  // molécule sans CIP depuis ⌘K : le produit le plus vendu s'ouvre, volet Trouver dessous
  K.depuisRecherche({ q: 'alphamol', mol: 'alphamol' });
  assert.equal(C(sb).porte, 'trouver');
  K.rendre();
  assert.equal(C(sb).cip, A);
});

test('quitter l\'écran Produits : au retour, les trois portes', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  K.porte('proposer'); K.rendre();           // pose l'écouteur de changement d'adresse
  assert.equal(C(sb).porte, 'proposer');
  sb.location.hash = '#produits';
  sb.ecouteurs.hashchange.forEach((f) => f());
  assert.equal(C(sb).porte, 'proposer', 'rester sur Produits ne change rien');
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
