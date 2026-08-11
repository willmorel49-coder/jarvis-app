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
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK });
  const aaa = r.lignes.find((l) => l.cip === 'AAA');
  assert.ok(aaa, 'AAA doit remonter pour G4');
  assert.equal(aaa.peers, 3);
  assert.equal(aaa.pctPeers, 3 / 5);
  assert.equal(aaa.caMoyen, 200);      // (100+200+300)/3
  assert.equal(aaa.potentiel, 200 * (3 / 5));
});

test('listing : sous le seuil, le produit est ecarte', () => {
  const idx = M.indexer(OFFICINES, VENTES);
  // CCC : 1 confrere sur 5 = 20 %, sous le seuil de 30 %
  const r = M.listingOfficine(idx, 'G4', { stock: STOCK });
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
