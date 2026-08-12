import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-produits-moteur.js');

// Catalogue d'essai : cip, famille, nb d'officines qui le prennent, tarif, stock
const p = (cip, fam, n, ppht, stock, rupture) => ({ cip, fam, n, ppht, stock, rupture: !!rupture });
const CAT = [
  // Petits prix : l'abandon fixe de 0,18 € fait un % tres variable
  p('L1', 'pr_low', 400, 1.00, 100),   // 18 %
  p('L2', 'pr_low', 300, 2.00, 100),   // 9 %
  p('L3', 'pr_low', 200, 4.00, 100),   // 4,5 %
  p('L4', 'pr_low', 100, 1.50, 0),     // 12 % mais HORS STOCK
  p('L5', 'pr_low', 50, 1.20, 100, true), // 15 % mais en rupture ANSM
  // Tranche mediane : barème proportionnel, 3,89 % partout
  p('M1', 'pr_mid', 500, 100, 100),
  p('M2', 'pr_mid', 250, 50, 100),
  // Produits chers : 19,50 € fixe, donc % qui s'effondre
  p('H1', 'pr_high', 90, 500, 100),    // 3,9 %
  p('H2', 'pr_high', 80, 2000, 100),   // 0,98 %
  // Familles sans abandon de marge
  p('N1', 'nr', 450, 8.00, 100),
  p('G1', 'gen', 600, 3.00, 100),
  p('B1', 'biosim', 70, 300, 100),
];

test('bareme : les trois tranches de l abandon de marge', () => {
  assert.equal(M.bareme(1.00), 0.18);
  assert.equal(M.bareme(4.33), 0.18);
  assert.equal(M.bareme(100), 3.89);
  assert.equal(M.bareme(468), 18.21);
  assert.equal(M.bareme(2000), 19.50);
});

test('quota : on obtient exactement le nombre demande par categorie', () => {
  const r = M.listeSurMesure(CAT, { quotas: { pr_low: 2, pr_mid: 1, gen: 1 } });
  const par = (f) => r.lignes.filter((l) => l.fam === f).length;
  assert.equal(par('pr_low'), 2);
  assert.equal(par('pr_mid'), 1);
  assert.equal(par('gen'), 1);
  assert.equal(par('nr'), 0, 'une categorie non demandee ne doit rien rendre');
});

test('quota a zero : la categorie est exclue', () => {
  const r = M.listeSurMesure(CAT, { quotas: { pr_low: 2, biosim: 0 } });
  assert.equal(r.lignes.filter((l) => l.fam === 'biosim').length, 0);
});

test('classement : dans chaque categorie, le plus d officines d abord', () => {
  const r = M.listeSurMesure(CAT, { quotas: { pr_low: 3 } });
  assert.deepEqual(r.lignes.map((l) => l.cip), ['L1', 'L2', 'L3']);
});

test('stock : un produit hors stock n entre jamais dans la liste', () => {
  const r = M.listeSurMesure(CAT, { quotas: { pr_low: 10 } });
  assert.equal(r.lignes.filter((l) => l.cip === 'L4').length, 0);
});

test('abandon minimum : ecarte ce qui est sous le seuil, garde le reste', () => {
  // Seuil 9 % : L1 (18 %), L2 (9 % pile) et L5 (15 %) passent ; L3 (4,5 %) est
  // ecarte, L4 est hors stock. Tri par nb d'officines : 400, 300, 50.
  const r = M.listeSurMesure(CAT, { quotas: { pr_low: 10 }, abandonMin: { pr_low: 9 } });
  assert.deepEqual(r.lignes.map((l) => l.cip), ['L1', 'L2', 'L5']);
  assert.ok(!r.lignes.some((l) => l.cip === 'L3'), 'L3 est a 4,5 %, sous le seuil');
});

test('abandon minimum : un seuil sur une famille sans abandon ne filtre rien', () => {
  const r = M.listeSurMesure(CAT, { quotas: { gen: 5, nr: 5 }, abandonMin: { gen: 50, nr: 50 } });
  assert.equal(r.lignes.filter((l) => l.fam === 'gen').length, 1);
  assert.equal(r.lignes.filter((l) => l.fam === 'nr').length, 1);
});

test('ruptures : le filtre ANSM ecarte le produit signale', () => {
  const avec = M.listeSurMesure(CAT, { quotas: { pr_low: 10 } });
  const sans = M.listeSurMesure(CAT, { quotas: { pr_low: 10 }, sansRupture: true });
  assert.ok(avec.lignes.some((l) => l.cip === 'L5'));
  assert.ok(!sans.lignes.some((l) => l.cip === 'L5'));
});

test('chaque ligne porte l abandon en euros ET en pourcentage', () => {
  const r = M.listeSurMesure(CAT, { quotas: { pr_low: 1, gen: 1 } });
  const l1 = r.lignes.find((l) => l.cip === 'L1');
  assert.equal(l1.abandon, 0.18);
  assert.equal(Math.round(l1.abandonPct), 18);
  assert.equal(l1.net, 0.82, 'net = tarif moins le bareme');
  const g1 = r.lignes.find((l) => l.cip === 'G1');
  assert.equal(g1.abandon, null, 'un generique ne porte aucun abandon');
  assert.equal(g1.abandonPct, null);
  assert.equal(g1.net, 3.00, 'generique : net = tarif');
});

test('dispo : on sait combien de references sont eligibles par categorie', () => {
  const r = M.listeSurMesure(CAT, { quotas: { pr_low: 2 }, abandonMin: { pr_low: 9 } });
  // L1 (18 %) et L2 (9 %) eligibles ; L3 sous le seuil, L4 hors stock, L5 en rupture mais gardee
  assert.equal(r.dispo.pr_low, 3, 'L1, L2 et L5 passent le seuil et sont en stock');
  assert.equal(r.dispo.pr_high, 2);
  assert.equal(r.dispo.biosim, 1);
});

test('quota superieur au disponible : on rend tout ce qu il y a, sans erreur', () => {
  const r = M.listeSurMesure(CAT, { quotas: { pr_high: 50 } });
  assert.equal(r.lignes.filter((l) => l.fam === 'pr_high').length, 2);
  assert.equal(r.dispo.pr_high, 2);
});

test('catalogue vide ou options absentes : liste vide, pas d erreur', () => {
  assert.deepEqual(M.listeSurMesure([], {}).lignes, []);
  assert.deepEqual(M.listeSurMesure(CAT, {}).lignes, []);
});
