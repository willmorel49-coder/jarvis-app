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
