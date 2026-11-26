// 26/11/2026 — planche « ordinateur », Groupements : B14 v1 (titres de colonnes cliquables, « Trier par » gardé sous 641 px), B15 v1 (la phrase « Part chez nous » sous le titre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../crm/v2/v2-groupements-m1.css', import.meta.url), 'utf8');

test('B14 v1 : les trois titres triables appellent V2.grpListTrier, « Non clientes » reste un titre simple, la colonne triée porte aria-sort', () => {
  const i = src.indexOf('function grrEntete()'), t = src.slice(i, src.indexOf('function grpListBody', i));
  for (const m of ["'name', 'Groupement'", "'clientes', 'Clientes'", "'part', 'Part chez nous'"]) assert.ok(t.includes('th(' + m), m);
  assert.match(t, /V2\.grpListTrier\(/);
  assert.match(t, /aria-sort/);
  assert.ok(/<span class="grr-th-r" role="columnheader">Non clientes<\/span>/.test(t));
  assert.ok(!/class="grr-th" aria-hidden="true"/.test(src), 'plus de rangée de titres cachée aux lecteurs d\'écran');
});

test('B14 v1 : un second clic retourne le sens ; le tri du téléphone reste celui d\'origine', () => {
  assert.match(src, /V2\.grpListTrier = function \(mode\) \{[^}]*grpListSort === mode\) grpListSens = -grpListSens/);
  assert.match(src, /V2\.grpListSortSet = function \(mode\) \{[^}]*grpListSens = 1;/);
  assert.match(src, /if \(grpListSens < 0 && !telEcran\(\)\) list\.reverse\(\);/);
});

test('B14 v1 : la rangée « Trier par » n\'est cachée qu\'à partir de 641 px, là où .grr-th s\'affiche (il est caché à 640 px et moins)', () => {
  assert.match(css, /@media \(min-width: 641px\) \{ \.grr-filtres \{ display: none; \} \}/);
  const tel = css.slice(css.indexOf('/* ── Téléphone : une ligne compacte'));
  assert.match(tel, /@media \(max-width: 640px\) \{[^]*?\.grr-th \{ display: none; \}/);
});

test('B15 v1 : la phrase est sous le titre à l\'ordinateur, et reste au-dessus de la liste au téléphone seulement', () => {
  assert.match(src, /<p class="gr-def" id="gr-def">Part chez nous : nos clientes sur les officines du groupement en France\.<\/p>/);
  assert.match(src, /<span class="grr-def-tel">Part chez nous : nos clientes sur les officines du groupement en France\. <\/span>/);
  assert.match(css, /\.grr-def-tel \{ display: none; \}/);
  assert.match(css, /\.grr-m \.gr-def \{ display: none; \}\s*\.grr-def-tel \{ display: inline; \}/);
});
