/* todo-titre.test.mjs — le titre de To do a la même taille que celui des autres écrans, tablette comprise
 *
 * 21/11/2026 ~23 h 40 — Will, choix cliqué : sur une tablette (768 px), « To do list » s'affichait en 44 px
 * (v2-todo-m1.css, règle de 761 px et plus) quand Infos, Offilog, Catalogue produits et Pilotage font 40 px.
 * Au-delà de 1 000 px, v2.css le ramenait déjà à 40 px : l'écart ne se voyait que de 761 à 1 000 px.
 * La taille au pixel se mesure sous WebKit (banc local) : ici, la règle et sa portée.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'crm', 'v2');
const css = readFileSync(join(DIR, 'v2-todo-m1.css'), 'utf8');

test('la taille de base du titre de To do est la taille commune (marqueur positif)', () => {
  assert.ok(css.includes('.td-m1 .td-hd .td-h1{margin:0;font:800 clamp(32px,9vw,40px)'), 'règle de base de v2-todo-m1.css');
});

test('To do à partir de 761 px : 40 px, plus 44', () => {
  const i = css.indexOf('@media (min-width:761px){'); assert.ok(i > 0, 'le bloc « ordinateur » de v2-todo-m1.css');
  const bloc = css.slice(i, css.indexOf('\n}', i));
  const m = /\.td-m1 \.td-hd \.td-h1\{font-size:(\d+)px\}/.exec(bloc);
  assert.ok(m, 'la règle du titre dans le bloc de 761 px et plus');
  assert.equal(m[1], '40', 'même taille que les autres écrans (44 px avant)');
  assert.doesNotMatch(css, /\.td-h1\{[^}]*font-size:44px/, 'plus aucun titre de To do à 44 px');
});
