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
