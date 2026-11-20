// 20/11/2026 — un lecteur « V2.pharmaVue = function () { return pharmaView; } » ajouté plus bas dans v2-pharma.js
// a écrasé la bascule vue Intégral / vue pharmacien (même nom) : « Passer en vue pharmacien » ne basculait plus,
// la marge restait affichée devant le pharmacien. Une seule définition, et c'est celle qui prend la vue en paramètre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');

test('fiche : V2.pharmaVue (bascule vue Intégral / vue pharmacien) n est défini qu une fois', () => {
  const defs = src.match(/V2\.pharmaVue\s*=\s*function\s*\(([^)]*)\)/g) || [];
  assert.equal(defs.length, 1, 'définitions trouvées : ' + defs.join(' · '));
  assert.match(defs[0], /\(\s*v\s*\)/, 'la bascule prend la vue voulue en paramètre');
});
