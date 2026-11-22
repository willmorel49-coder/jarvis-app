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

/* 22/11/2026, v3 Le tableau : le bloc « @media (min-width:761px){ … .td-h1{font-size:40px} } » n'existe plus (la v3 a réécrit le CSS de To do).
 * La règle reste la même — le titre ne dépasse JAMAIS 40 px de 761 px à 1 000 px — mais elle se lit autrement : la règle de base
 * plafonne à 40 px (clamp(…,40px), testé ci-dessus) ET aucune autre règle de v2-todo-m1.css ne grossit .td-h1, dans aucun @media. */
test('To do à partir de 761 px : 40 px, plus 44 (aucune règle ne grossit .td-h1 au-delà de 40 px)', () => {
  const regles = [...css.matchAll(/([^{}]*\.td-h1[^{}]*)\{([^{}]*)\}/g)];
  assert.ok(regles.length >= 1, 'au moins la règle de base du titre (marqueur positif)');
  let vus = 0;
  for (const [, sel, corps] of regles) {
    for (const decl of corps.matchAll(/(?:^|;)\s*font(?:-size)?\s*:([^;]*)/g)) {
      for (const m of decl[1].matchAll(/(\d+(?:\.\d+)?)px/g)) { vus++; assert.ok(+m[1] <= 40, 'la règle « ' + sel.trim() + ' » donne ' + m[1] + ' px (40 au plus)'); }
    }
  }
  assert.ok(vus >= 1, 'la taille du titre est bien lue (au moins une valeur en px)');
  assert.doesNotMatch(css, /\.td-h1\{[^}]*font(?:-size)?:[^;}]*(4[1-9]|[5-9]\d)px/, 'plus aucun titre de To do au-dessus de 40 px');
  assert.doesNotMatch(css, /@media \(min-width:761px\)\{[^}]*\.td-h1\{[^}]*font-size:44px/, 'ni 44 px dans une règle de 761 px et plus');
});
