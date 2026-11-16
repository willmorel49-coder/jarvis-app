/* offilog-chiffre-fiche.test.mjs — chiffre Offilog à côté du chiffre du grossiste (fiche officine, 16/11/2026).
 * Données INVENTÉES. Trois cas demandés : mois identique, mois différent (mois écrit), cliente sans achat ; plus : absente de la table = rien. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const O = createRequire(import.meta.url)('../crm/v2/v2-offilog-ventes.js');
const N = '\u00a0';

const OFF = {
  vm: ['2026-09', '2026-10'],
  v: { 'A1': [3120.56, 4773.74] },
  m: { 'A1': [1, 2], 'B2': [1, 2], 'C3': [0, 2] },
  d: ['2026-10-01', '2026-10-15', '2026-11-05'],
};

test('même mois que le grossiste : montant HT du mois, sans mois écrit', () => {
  const r = O.chiffreFiche('A1', OFF, '2026-10');
  assert.equal(r.type, 'vente');
  assert.equal(r.montant, '4' + N + '774' + N + '€');
  assert.equal(r.mois, '');
  assert.equal(r.texte, 'Offilog · 4' + N + '774' + N + '€');
});

test('mois du grossiste non couvert : le dernier mois Offilog, ÉCRIT', () => {
  const r = O.chiffreFiche('A1', OFF, '2026-11');
  assert.equal(r.mois, 'oct.');
  assert.equal(r.texte, 'Offilog · 4' + N + '774' + N + '€ en oct.');
});

test('notée cliente sans aucune vente : « aucun achat » sur la période lue dans vm', () => {
  const r = O.chiffreFiche('B2', OFF, '2026-10');
  assert.equal(r.type, 'aucun');
  assert.equal(r.texte, 'Offilog : aucun achat en sept.–oct. 2026');
});

test('absente de la table, ou notée non cliente sans vente : rien du tout (jamais « non » par défaut)', () => {
  assert.equal(O.chiffreFiche('Z9', OFF, '2026-10'), null);
  assert.equal(O.chiffreFiche('C3', OFF, '2026-10'), null);
  assert.equal(O.chiffreFiche('A1', null, '2026-10'), null);
  assert.equal(O.chiffreFiche('A1', { vm: [], v: {} }, '2026-10'), null);
});
