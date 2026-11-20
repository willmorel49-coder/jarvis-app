// Génériqueurs : chaque produit est rangé chez le labo ÉCRIT SUR LA BOÎTE, pas chez le titulaire
// de l'AMM (choix de Will, 20/11/2026). Avant, 26 869 € de Zentiva d'une cliente étaient comptés chez
// GSK et Sanofi. Ce test lit la vraie table : il rougit si l'ancien générateur est relancé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const w = {};
new Function('window', readFileSync(new URL('../crm/v2/generiqueurs-data.js', import.meta.url), 'utf8'))(w);
const G = w.GENERIQUEURS;

test('Amoxicilline, Amox/Ac. clav. et Valaciclovir Zentiva (titulaire GSK) sont chez Zentiva', () => {
  for (const cip of ['3400927929045', '3400935337771', '3400938765663']) assert.equal(G[cip], 'Zentiva', cip);
});

test('Irbésartan Zentiva (titulaire Sanofi) est chez Zentiva', () => {
  assert.equal(G['3400922161587'], 'Zentiva');
});

test('Tadalafil Lilly reste chez Lilly : il est vraiment vendu par Lilly', () => {
  assert.match(G['3400930087442'], /Lilly/);
});

// Appro lit labo-cip.json AVANT la table : il doit dire la même chose (choix de Will « tout aligner », 20/11/2026).
const LC = JSON.parse(readFileSync(new URL('../crm/v2/labo-cip.json', import.meta.url), 'utf8')).data;

test('Appro (labo-cip.json) range aussi Amoxicilline et Irbésartan Zentiva chez ZENTIVA', () => {
  for (const cip of ['3400927929045', '3400922161587']) assert.equal(LC[cip], 'ZENTIVA', cip);
});

// Choix de Will (20/11/2026) : un produit ne sort jamais de la table. Céliprolol Almus a vu son AMM
// archivée : il reste un générique rangé chez Almus, sinon ses ventes passées quittent les cartes.
test('Un générique à AMM archivée garde son rangement (Céliprolol Almus)', () => {
  const M = new Set(w.GENERIQUEURS_MARQUES);
  for (const cip of ['3400930153062', '3400937576666']) {
    assert.equal(G[cip], 'Almus', cip);
    assert.ok(!M.has(cip), cip + ' ne doit pas basculer en marque');
  }
});
