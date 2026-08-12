import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-produits-moteur.js');

// ── Jeu d'essai synthétique ────────────────────────────────────────
// 6 officines Giphar (groupe nominal), 2 Mediprix (trop petit → repli),
// 1 sans groupement. Toutes en 44 sauf MED2 (en 49).
export const OFFICINES = [
  { id: 'G1', groupement: 'Giphar', cp: '44000', ca: 50000 },
  { id: 'G2', groupement: 'Giphar', cp: '44100', ca: 52000 },
  { id: 'G3', groupement: 'Giphar', cp: '44200', ca: 48000 },
  { id: 'G4', groupement: 'Giphar', cp: '44300', ca: 45000 },
  { id: 'G5', groupement: 'Giphar', cp: '44400', ca: 55000 },
  { id: 'G6', groupement: 'Giphar', cp: '44500', ca: 51000 },
  { id: 'MED1', groupement: 'Mediprix', cp: '44600', ca: 47000 },
  { id: 'MED2', groupement: 'Mediprix', cp: '49000', ca: 12000 },
  { id: 'SEUL', groupement: '', cp: '44700', ca: 46000 },
];

function v(ph, cip, mnt, qte) {
  return { pharmacyId: ph, artCode: cip, mntNetHt: mnt, qte: qte == null ? 1 : qte };
}

export const VENTES = [
  v('G1', 'AAA', 100), v('G2', 'AAA', 200), v('G3', 'AAA', 300),
  v('G1', 'BBB', 50), v('G2', 'BBB', 50),
  // CCC : acheté puis intégralement retourné par G1 → net 0, ne compte pas
  v('G1', 'CCC', 80), v('G1', 'CCC', -80, -1),
  v('G2', 'CCC', 40),
];

test('trancheCA : quatre paliers, bornes incluses vers le bas', () => {
  assert.equal(M.trancheCA(0), 'a');
  assert.equal(M.trancheCA(9999), 'a');
  assert.equal(M.trancheCA(10000), 'b');
  assert.equal(M.trancheCA(29999), 'b');
  assert.equal(M.trancheCA(30000), 'c');
  assert.equal(M.trancheCA(59999), 'c');
  assert.equal(M.trancheCA(60000), 'd');
  assert.equal(M.trancheCA(null), 'a');
});

test('dept : deux premiers caracteres du code postal, null si vide', () => {
  assert.equal(M.dept('44300'), '44');
  assert.equal(M.dept(' 49000 '), '49');
  assert.equal(M.dept(''), null);
  assert.equal(M.dept(null), null);
});

test('indexer : le net est cumule par officine et par CIP', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(idx.netParOfficine.G1.AAA, 100);
  assert.equal(idx.netParOfficine.G3.AAA, 300);
});

test('indexer : un produit integralement retourne tombe a zero', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(idx.netParOfficine.G1.CCC, 0);
});

test('indexer : quantites cumulees par CIP, retours deduits', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(idx.qteParCip.CCC, 1);   // +1 chez G1, -1 chez G1, +1 chez G2
  assert.equal(idx.qteParCip.AAA, 3);
});

test('groupe : groupement d au moins 5 officines = cas nominal', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const g = M.groupeComparaison(idx, 'G1');
  assert.equal(g.type, 'groupement');
  assert.equal(g.libelle, 'confrères Giphar');
  assert.equal(g.taille, 6);
});

test('groupe : groupement trop petit bascule sur les officines comparables', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const g = M.groupeComparaison(idx, 'MED1');
  // MED1 est en 44, tranche c (47000) : rejoint G1..G6 qui sont tous en 44 tranche c
  assert.equal(g.type, 'comparables');
  assert.equal(g.libelle, 'officines comparables');
  assert.ok(g.taille >= 5, `attendu >= 5, obtenu ${g.taille}`);
});

test('groupe : sans groupement du tout, meme chemin de repli', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const g = M.groupeComparaison(idx, 'SEUL');
  assert.equal(g.type, 'comparables');
});

test('groupe : departement isole tombe sur la tranche de taille seule', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  // MED2 : seul en 49, tranche b — aucun comparable departemental
  const g = M.groupeComparaison(idx, 'MED2');
  assert.equal(g.type, 'taille');
  assert.equal(g.libelle, 'officines de taille comparable');
});

test('groupe : officine inconnue rend null au lieu de planter', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(M.groupeComparaison(idx, 'INEXISTANTE'), null);
});

// ── Task 2 : listing d'une officine ────────────────────────────────
const STOCK = { AAA: 500, BBB: 12, CCC: 7, DDD: 0 };

test('agregat : compte les officines et somme les nets par CIP', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const a = M.agregatGroupe(idx, 'g:Giphar');
  assert.equal(a.taille, 6);
  assert.equal(a.cnt.AAA, 3);          // G1, G2, G3
  assert.equal(a.som.AAA, 600);
  assert.equal(a.cnt.CCC, 1);          // G1 est a zero net, seul G2 compte
});

test('agregat : deux appels rendent le meme objet memorise', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(M.agregatGroupe(idx, 'g:Giphar'), M.agregatGroupe(idx, 'g:Giphar'));
});

test('listing : le denominateur exclut toujours l officine cible', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK });
  assert.equal(r.nbConfreres, 5);      // 6 Giphar - elle-meme
});

test('listing : un produit deja achete par l officine n apparait pas', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G1', { stock: STOCK, seuil: 0.1 });
  assert.equal(r.lignes.filter((l) => l.cip === 'AAA').length, 0);
});

test('listing : le trou remonte avec le bon pourcentage et la bonne moyenne', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK, garantirMin: false });
  const aaa = r.lignes.find((l) => l.cip === 'AAA');
  assert.ok(aaa, 'AAA doit remonter pour G4');
  assert.equal(aaa.peers, 3);
  assert.equal(aaa.pctPeers, 3 / 5);
  assert.equal(aaa.caMoyen, 200);      // (100+200+300)/3
  assert.equal(aaa.potentiel, 200 * (3 / 5));
});

test('listing : sous le seuil, le produit est ecarte', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  // CCC : 1 confrere sur 5 = 20 %, sous le seuil de 30 %.
  // garantirMin:false = un seul passage au seuil nominal, sans repli — le
  // jeu d'essai n'a que 3 produits, garantir un minimum de 5 n'y a aucun sens.
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK, garantirMin: false });
  assert.equal(r.lignes.filter((l) => l.cip === 'CCC').length, 0);
  // seuil abaisse a 10 % : il remonte
  const r2 = M.listingOfficine(idx, 'G4', { stock: STOCK, seuil: 0.1 });
  assert.equal(r2.lignes.filter((l) => l.cip === 'CCC').length, 1);
});

test('listing : un produit hors stock est ecarte', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: { AAA: 0, BBB: 12 } });
  assert.equal(r.lignes.filter((l) => l.cip === 'AAA').length, 0);
  assert.equal(r.lignes.filter((l) => l.cip === 'BBB').length, 1);
});

test('listing : exigerStock a false garde les produits hors stock', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: { AAA: 0 }, exigerStock: false });
  const aaa = r.lignes.find((l) => l.cip === 'AAA');
  assert.ok(aaa);
  assert.equal(aaa.stock, 0);
});

test('listing : trie par potentiel decroissant', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK, seuil: 0.1 });
  for (let i = 1; i < r.lignes.length; i++) {
    assert.ok(r.lignes[i - 1].potentiel >= r.lignes[i].potentiel,
      `ligne ${i} mal triee`);
  }
});

test('listing : officine inconnue rend une liste vide, pas une erreur', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'INEXISTANTE', { stock: STOCK });
  assert.deepEqual(r.lignes, []);
  assert.equal(r.nbConfreres, 0);
});

// ── Task 3 : listing par produit (mode Achats) ─────────────────────
test('couverture : stock divise par la demande mensuelle', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  // AAA : 3 unites sur 6 mois = 0,5/mois ; stock 500 → 1000 mois
  assert.equal(M.couverture(idx, 'AAA', { AAA: 500 }), 1000);
});

test('couverture : demande nulle rend null au lieu d infini', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  assert.equal(M.couverture(idx, 'INCONNU', { INCONNU: 10 }), null);
});

test('produits : agrege le nombre d officines en trou sur chaque CIP', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: STOCK, seuil: 0.1 });
  const aaa = r.find((l) => l.cip === 'AAA');
  assert.ok(aaa, 'AAA doit apparaitre');
  // G4, G5, G6 ne prennent pas AAA et sont dans le groupe Giphar
  assert.ok(aaa.officines >= 3, `attendu >= 3, obtenu ${aaa.officines}`);
});

test('produits : le potentiel cumule est la somme des potentiels officine', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: STOCK, seuil: 0.1 });
  const aaa = r.find((l) => l.cip === 'AAA');
  let attendu = 0;
  for (const o of OFFICINES) {
    const li = M.listingOfficine(idx, o.id, { stock: STOCK, seuil: 0.1 })
      .lignes.find((l) => l.cip === 'AAA');
    if (li) attendu += li.potentiel;
  }
  assert.ok(Math.abs(aaa.potentiel - attendu) < 1e-9);
});

test('produits : trie par potentiel decroissant', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: STOCK, seuil: 0.1 });
  for (let i = 1; i < r.length; i++) {
    assert.ok(r[i - 1].potentiel >= r[i].potentiel, `ligne ${i} mal triee`);
  }
});

test('produits : filtre par groupement ne garde que ses officines', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: STOCK, seuil: 0.1, filtreGroupement: 'Mediprix' });
  const tous = M.listingProduits(idx, { stock: STOCK, seuil: 0.1 });
  const somme = (a) => a.reduce((s, x) => s + x.officines, 0);
  assert.ok(somme(r) < somme(tous), 'le filtre doit reduire le total');
});

test('produits : exigerStock a false fait apparaitre ce qu on n a pas', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingProduits(idx, { stock: {}, seuil: 0.1, exigerStock: false });
  assert.ok(r.length > 0, 'sans stock du tout, la vue achats doit rester peuplee');
  assert.equal(r[0].stock, 0);
});

test('repli : une liste trop courte descend les paliers jusqu a MIN_LIGNES', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  // G4 au seuil nominal n'a que AAA et BBB (2 produits) : le repli descend
  // les paliers, et le seuil reellement utilise est rendu dans le resultat.
  const strict = M.listingOfficine(idx, 'G4', { stock: STOCK, garantirMin: false });
  const avecRepli = M.listingOfficine(idx, 'G4', { stock: STOCK });
  assert.equal(strict.seuil, M.SEUIL_PEERS);
  assert.ok(avecRepli.seuil < M.SEUIL_PEERS, 'le seuil doit avoir baisse');
  assert.ok(avecRepli.lignes.length > strict.lignes.length);
});

test('repli : un seuil impose par l appelant n est jamais degrade', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK, seuil: 0.9 });
  assert.equal(r.seuil, 0.9);
  assert.equal(r.lignes.length, 0);
});

// ── Suivi d'effet : ce que l'officine a COMMENCE a prendre ─────────
// Le mois de premiere commande suffit : pas besoin d'enregistrer quoi que ce
// soit cote serveur, le fichier mensuel de Will porte deja la preuve.
const VENTES_M = [
  { pharmacyId: 'G1', artCode: 'AAA', mois: 1, mntNetHt: 100, qte: 1 },
  { pharmacyId: 'G1', artCode: 'AAA', mois: 4, mntNetHt: 90, qte: 1 },
  { pharmacyId: 'G1', artCode: 'BBB', mois: 5, mntNetHt: 60, qte: 1 },  // entree en mai
  { pharmacyId: 'G1', artCode: 'CCC', mois: 6, mntNetHt: 30, qte: 1 },  // entree en juin
  { pharmacyId: 'G2', artCode: 'AAA', mois: 2, mntNetHt: 50, qte: 1 },
];

test('index : le mois de PREMIERE commande est retenu, pas le dernier', () => {
  const idx = M.indexer(OFFICINES, VENTES_M);
  assert.equal(idx.premierMois.G1.AAA, 1);
  assert.equal(idx.premierMois.G1.BBB, 5);
  assert.equal(idx.moisMax, 6, 'le dernier mois du fichier doit etre connu');
});

test('suivi : distingue ce qui est entre en commande depuis la proposition', () => {
  const idx = M.indexer(OFFICINES, VENTES_M);
  // Proposition faite quand le fichier s'arretait a avril : BBB (mai) et
  // CCC (juin) sont entres depuis ; AAA etait deja pris ; DDD n'a jamais bouge.
  const r = M.suiviProposition(idx, 'G1', ['AAA', 'BBB', 'CCC', 'DDD'], 4);
  assert.deepEqual(r.entres.map((x) => x.cip), ['BBB', 'CCC']);
  assert.deepEqual(r.enAttente, ['DDD']);
  assert.deepEqual(r.dejaPris, ['AAA']);
  assert.equal(r.total, 4);
});

test('suivi : rien de neuf tant que le fichier n a pas avance', () => {
  const idx = M.indexer(OFFICINES, VENTES_M);
  const r = M.suiviProposition(idx, 'G1', ['BBB', 'CCC'], 6);
  assert.deepEqual(r.entres, []);
  assert.equal(r.moisRecus, 0, 'aucun mois nouveau depuis la proposition');
});

test('suivi : le nombre de mois ecoules depuis la proposition est rendu', () => {
  const idx = M.indexer(OFFICINES, VENTES_M);
  assert.equal(M.suiviProposition(idx, 'G1', ['BBB'], 4).moisRecus, 2);
});

test('suivi : officine inconnue rend un suivi vide, pas une erreur', () => {
  const idx = M.indexer(OFFICINES, VENTES_M);
  const r = M.suiviProposition(idx, 'INEXISTANTE', ['AAA'], 1);
  assert.equal(r.total, 1);
  assert.deepEqual(r.entres, []);
  assert.deepEqual(r.enAttente, ['AAA']);
});

test('nouveautes : ce que l officine a commence a prendre recemment', () => {
  const idx = M.indexer(OFFICINES, VENTES_M);
  const n = M.nouveautesOfficine(idx, 'G1', 5);
  assert.deepEqual(n.map((x) => x.cip), ['CCC', 'BBB'], 'du plus recent au plus ancien');
  assert.equal(n[0].mois, 6);
});

test('index : le champ mois s appelle `month` dans l app, `mois` dans les tests', () => {
  // v2-boot.js construit V2.sales avec `month`. Si le moteur ne lisait que
  // `mois`, le suivi d'effet serait vide en production sans qu'un test le voie.
  const idx = M.indexer(OFFICINES, [
    { pharmacyId: 'G1', artCode: 'ZZZ', month: 3, mntNetHt: 10, qte: 1 },
  ]);
  assert.equal(idx.premierMois.G1.ZZZ, 3);
  assert.equal(idx.moisMax, 3);
});

// ── Quotas appliques a une liste deja calculee ─────────────────────
// Sert aux modes Client et Groupement : la liste vient du calcul « trou vs
// confreres », puis on la taille par categorie comme pour un prospect.
// Deja triee par potentiel decroissant, comme les vraies listes du moteur.
const LIGNES = [
  { cip: 'C1', fam: 'nr', potentiel: 95 },
  { cip: 'A1', fam: 'pr_low', potentiel: 90 },
  { cip: 'B1', fam: 'gen', potentiel: 85 },
  { cip: 'A2', fam: 'pr_low', potentiel: 80 },
  { cip: 'A3', fam: 'pr_low', potentiel: 70 },
  { cip: 'B2', fam: 'gen', potentiel: 60 },
  { cip: 'D1', fam: 'biosim', potentiel: 50 },
];

test('quotas : chaque categorie est limitee a son nombre', () => {
  const r = M.limiterParCategorie(LIGNES, { pr_low: 2, gen: 1, nr: 5, biosim: 0 });
  // A3 tombe (3e petit prix), B2 tombe (2e generique), D1 tombe (quota 0).
  assert.deepEqual(r.map((l) => l.cip), ['C1', 'A1', 'B1', 'A2']);
});

test('quotas : l ordre d origine est conserve, pas re-trie par categorie', () => {
  // On ne re-trie pas : l'ordre d'entree, deja par potentiel, est conserve.
  const r = M.limiterParCategorie(LIGNES, { pr_low: 3, gen: 2, nr: 1, biosim: 1 });
  for (let i = 1; i < r.length; i++) {
    assert.ok(r[i - 1].potentiel >= r[i].potentiel, `ligne ${i} mal ordonnee`);
  }
});

test('quotas : une categorie a zero disparait', () => {
  const r = M.limiterParCategorie(LIGNES, { pr_low: 5, biosim: 0 });
  assert.ok(!r.some((l) => l.fam === 'biosim'));
});

test('quotas : aucun quota pose = liste inchangee', () => {
  assert.equal(M.limiterParCategorie(LIGNES, {}).length, LIGNES.length);
  assert.equal(M.limiterParCategorie(LIGNES, null).length, LIGNES.length);
});

test('quotas : une ligne sans famille connue passe toujours', () => {
  const avec = LIGNES.concat([{ cip: 'X', fam: '', potentiel: 10 }]);
  const r = M.limiterParCategorie(avec, { pr_low: 1 });
  assert.ok(r.some((l) => l.cip === 'X'), 'une famille inconnue ne doit pas etre filtree');
});

// ── Comptage des acheteurs : la preuve sociale ─────────────────────
const VENTES_ACH = [
  { pharmacyId: 'G1', artCode: 'AAA', mntNetHt: 100, qte: 1 },
  { pharmacyId: 'G2', artCode: 'AAA', mntNetHt: 200, qte: 1 },
  { pharmacyId: 'G3', artCode: 'AAA', mntNetHt: 300, qte: 1 },
  { pharmacyId: 'MED1', artCode: 'AAA', mntNetHt: 50, qte: 1 },
  // G1 a commande BBB puis tout retourne : solde nul, il ne compte pas
  { pharmacyId: 'G1', artCode: 'BBB', mntNetHt: 80, qte: 1 },
  { pharmacyId: 'G1', artCode: 'BBB', mntNetHt: -80, qte: -1 },
  { pharmacyId: 'G2', artCode: 'BBB', mntNetHt: 40, qte: 1 },
];

test('acheteurs : nombre d officines distinctes par produit, retours exclus', () => {
  const idx = M.indexer(OFFICINES, VENTES_ACH);
  assert.equal(idx.acheteurs.AAA, 4);
  assert.equal(idx.acheteurs.BBB, 1, 'un solde nul ne compte pas comme acheteur');
});

test('acheteurs : detail par groupement', () => {
  const idx = M.indexer(OFFICINES, VENTES_ACH);
  assert.equal(idx.acheteursGrp.Giphar.AAA, 3);
  assert.equal(idx.acheteursGrp.Mediprix.AAA, 1);
  assert.equal(idx.acheteursGrp.Giphar.BBB, 1);
});

test('acheteurs : taille de chaque groupement connue', () => {
  const idx = M.indexer(OFFICINES, VENTES_ACH);
  assert.equal(idx.tailleGrp.Giphar, 6);
  assert.equal(idx.tailleGrp.Mediprix, 2);
  assert.equal(idx.nbOfficines, 9);
});

test('penetration : rend le couple (acheteurs, total) reseau et groupement', () => {
  const idx = M.indexer(OFFICINES, VENTES_ACH);
  assert.deepEqual(M.penetration(idx, 'AAA'), { n: 4, total: 9 });
  assert.deepEqual(M.penetration(idx, 'AAA', 'Giphar'), { n: 3, total: 6 });
  assert.deepEqual(M.penetration(idx, 'INCONNU'), { n: 0, total: 9 });
  assert.deepEqual(M.penetration(idx, 'AAA', 'Inexistant'), { n: 0, total: 0 });
});

// ── Listing complet d'un groupement ────────────────────────────────
// « Toute la data » : ce que le groupement commande DEJA, et ce qu'il ne
// prend pas — avec, sur chaque ligne, ses adherents ET les clients IP.
const V_GRP = [
  { pharmacyId: 'G1', artCode: 'AAA', mntNetHt: 100, qte: 1 },
  { pharmacyId: 'G2', artCode: 'AAA', mntNetHt: 200, qte: 1 },
  { pharmacyId: 'G3', artCode: 'AAA', mntNetHt: 50, qte: 1 },
  { pharmacyId: 'G1', artCode: 'BBB', mntNetHt: 60, qte: 1 },
  // CCC : aucun Giphar ne le prend, mais 2 officines hors groupement oui
  { pharmacyId: 'MED1', artCode: 'CCC', mntNetHt: 90, qte: 1 },
  { pharmacyId: 'SEUL', artCode: 'CCC', mntNetHt: 70, qte: 1 },
];

test('listing groupement : ce qu il commande, avec ses deux compteurs', () => {
  const idx = M.indexer(OFFICINES, V_GRP);
  const r = M.listingGroupementComplet(idx, 'Giphar', { seuilTrou: 1 });
  const aaa = r.find((l) => l.cip === 'AAA');
  assert.equal(aaa.adherents, 3);
  assert.equal(aaa.taille, 6, 'le groupement compte 6 officines');
  assert.equal(aaa.clientsIP, 3);
  assert.equal(aaa.reseauTotal, 9);
  assert.equal(aaa.statut, 'commande');
});

test('listing groupement : les trous remontent aussi, marques a pousser', () => {
  const idx = M.indexer(OFFICINES, V_GRP);
  const r = M.listingGroupementComplet(idx, 'Giphar', { seuilTrou: 1 });
  const ccc = r.find((l) => l.cip === 'CCC');
  assert.ok(ccc, 'un produit que le groupement ne prend pas doit apparaitre');
  assert.equal(ccc.adherents, 0);
  assert.equal(ccc.clientsIP, 2);
  assert.equal(ccc.statut, 'pousser');
});

test('listing groupement : un trou trop confidentiel est ecarte', () => {
  const idx = M.indexer(OFFICINES, V_GRP);
  const r = M.listingGroupementComplet(idx, 'Giphar', { seuilTrou: 3 });
  assert.ok(!r.some((l) => l.cip === 'CCC'), 'CCC n a que 2 clients IP');
});

test('listing groupement : trie par diffusion decroissante', () => {
  const idx = M.indexer(OFFICINES, V_GRP);
  const r = M.listingGroupementComplet(idx, 'Giphar', { seuilTrou: 1 });
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i];
    assert.ok(a.adherents > b.adherents || (a.adherents === b.adherents && a.clientsIP >= b.clientsIP),
      `ligne ${i} mal triee`);
  }
});

test('listing groupement : filtre stock respecte', () => {
  const idx = M.indexer(OFFICINES, V_GRP);
  const r = M.listingGroupementComplet(idx, 'Giphar', { seuilTrou: 1, stock: { AAA: 5 } });
  assert.deepEqual(r.map((l) => l.cip), ['AAA'], 'seul AAA est en stock');
});

test('listing groupement : groupement inconnu rend une liste vide', () => {
  const idx = M.indexer(OFFICINES, V_GRP);
  assert.deepEqual(M.listingGroupementComplet(idx, 'Inexistant', {}), []);
});
