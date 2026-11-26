/* accueil-ordinateur-b1-b3-2026-11-26.test.mjs — planche ordinateur B1 (carte resserrée) et B3 (menu « + »). Lit le code servi. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const lire = (f) => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');

test('B1 : la carte d’accueil se resserre aussi au-delà de 600 px, sauf chez Phirst', () => {
  const css = lire('v2.css'), js = lire('v2-accueil-cinq.js');
  assert.match(css, /@media \(min-width:601px\)\{[^@]*aube-serre:has\(> \.m1-hd-a:empty\)\{min-height:0\}/);
  assert.match(js, /V2_BRAND\.portes\) \? '' : ' aube-serre'/);
});

test('B3 : le « + » propose « Ajouter une tâche » puis « Noter un rendez-vous », plus « Voir les idées »', () => {
  const app = lire('v2-app.js'), todo = lire('v2-todo.js');
  const fn = app.slice(app.indexOf('function plusItems()'), app.indexOf('// Menu flottant'));
  const reste = fn.slice(fn.indexOf('return it;') + 10);
  assert.ok(reste.indexOf('Ajouter une tâche') < reste.indexOf('Noter un rendez-vous'));
  assert.ok(!reste.includes('Voir les idées'));
  assert.match(todo, /ajouterDepuisBarre: function/);
});
