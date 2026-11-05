// Tournées OPS dans le mode « Prospection » de La carte (05/11/2026) : calcul pur, sans donnée réelle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.V2 = {};
const C = require('../crm/v2/v2-carte-prospection.js');

const L = (cip, cp, nom) => [47, -1, 0, 0, 0, 0, nom, 'V' + cip, cp, '', '', '', 0, cip];

test('nouveau format reconnu seulement avec des numéros d\'arrêt ET des prospects', () => {
  assert.equal(C.nouveauFormat({ clientes: [{ n: 1 }], prospects: [['1']] }), true);
  assert.equal(C.nouveauFormat({ clientes: [{ n: 1 }], prospects: [] }), false);
  assert.equal(C.nouveauFormat({ clientes: [{ id: 'x' }], prospects: [['1']] }), false);   // ancien fichier : rien ne change
  assert.equal(C.nouveauFormat(null), false);
});
test('prospects du fichier : jointure par CIP, clientes de commerciaux exclues, tri par km de route', () => {
  const pts = [L('1', '44000', 'A'), L('2', '44000', 'B'), L('3', '86000', 'C')];
  const lignes = [['2', 47.1, -1.1, 'T21', 8.5, 3, 4, 2.2, true], ['1', 47.2, -1.2, 'T21', 1.25, 0, 1, 0.4, true], ['3', 46, 0, 'T41', 3, 5, null, 6, true], ['9', 47, -1, 'T21', 0.1, 1, 2, 0, true]];
  const r = C.prospectsFichier(pts, lignes, { 3: 1 });
  assert.deepEqual(r.liste.map(p => p.cip), ['1', '2']);   // 3 = cliente d'un commercial ; 9 = absent de PHARMA_FR
  assert.equal(r.liste[0].km, 1.25); assert.equal(r.liste[0].i, 0);
});
test('phrase d\'insertion pour les chauffeurs', () => {
  assert.equal(C.insertion({ tournee: 'T21', avant: 3, apres: 4, detour: 6.4 }), 'entre le n° 3 et le n° 4 de T21 · détour estimé ~6 km');
  assert.equal(C.insertion({ tournee: 'T21', avant: 0, apres: 1, detour: 0.3 }), 'entre le dépôt et le n° 1 de T21 · détour estimé : moins de 1 km');
  assert.match(C.insertion({ tournee: 'T21', avant: 15, apres: null, detour: 12 }), /^après le n° 15 \(dernier arrêt\), sur le retour de T21/);
  assert.equal(C.insertion({ tournee: 'T21' }), '');
});
test('formats français : milliers, virgule, signe moins', () => {
  assert.equal(C.eur(-1234.4).replace(/\s/g, ' '), '−1 234 €');
  assert.equal(C.eur(null), '—');
  assert.equal(C.eur2(79.54).replace(/\s/g, ' '), '79,54 €');
  assert.equal(C.nb1(18.8), '18,8');
});
test('jours : connus, à confirmer, à préciser', () => {
  assert.equal(C.joursTournee({ jours: ['lundi', 'jeudi'] }), 'lun, jeu');
  assert.equal(C.joursTournee({ jours: null, jours_statut: 'a_confirmer' }), 'jours à confirmer');
  assert.equal(C.joursTournee({ jours: null, jours_statut: 'a_preciser' }), 'jours à préciser');
});
test('22 couleurs de tournée toutes différentes ; tri par rentabilité : la plus faible d\'abord, sans valeur à la fin', () => {
  assert.equal(new Set(Array.from({ length: 22 }, (_, k) => C.couleurTournee(k))).size, 22);
  const T = { T1: { rentabilite: 500 }, T2: { rentabilite: -900 }, T3: { rentabilite: null }, T4: { rentabilite: 20 } };
  assert.deepEqual(C.ordonnerTournees(T, 'renta'), ['T2', 'T4', 'T1', 'T3']);
  assert.deepEqual(C.ordonnerTournees(T, 'code'), ['T1', 'T2', 'T3', 'T4']);
});
