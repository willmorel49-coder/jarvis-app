/* marge-biosim.test.mjs — 06/11/2026, règle de Will : « sur les biosimilaires c'est possible de
 * calculer, c'est uniquement sur NR et générique que c'est pas possible ».
 * Le VRAI code (v2-pharma.js : margeNetteLigne et ce qu'elle appelle ; v2-boot.js : V2.margeNetteBoite)
 * est découpé tel quel et exécuté sur des données 100 % INVENTÉES. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const pharma = readFileSync(join(RACINE, 'crm/v2/v2-pharma.js'), 'utf8');
const boot = readFileSync(join(RACINE, 'crm/v2/v2-boot.js'), 'utf8');

function charger(benchmark, sagitta = [], froid = []) {
  const V2 = {};
  const i0 = boot.indexOf('V2.MARGE_NETTE = ');
  const i1 = boot.indexOf('V2.margeNetteBoite = function', i0);
  let p = 0, j = boot.indexOf('{', i1), fin = j;
  for (; j < boot.length; j++) { if (boot[j] === '{') p++; else if (boot[j] === '}') { p--; if (p === 0) { fin = j; break; } } }
  new Function('V2', boot.slice(i0, fin + 1) + ';')(V2);
  const a = pharma.indexOf('  var _benchIdx = null;');
  const b = pharma.indexOf('  // ── Fusion OPS + CPR + HP par CIP');
  assert.ok(a > 0 && b > a, 'bloc de calcul introuvable dans v2-pharma.js');
  const win = { BENCHMARK: benchmark, SAGITTA_SHORTLIST: sagitta, FROID_CIPS: froid };
  return new Function('V2', 'window', pharma.slice(a, b) + '\nreturn { margeNetteLigne, margeNettePharma, margeNetteCat };')(V2, win);
}

const B = [
  { cip13: '3400900000011', artnature: 'princeps', categorie: 'pp', has_ameli: true },
  { cip13: '3400900000022', artnature: 'biosimilaire', has_ameli: true },
  { cip13: '3400900000033', artnature: 'biosimilaire', has_ameli: false },          // biosimilaire non remboursable
  { cip13: '3400900000044', artnature: 'generique', has_ameli: true },
  { cip13: '3400900000055', artnature: 'princeps', categorie: 'pp', has_ameli: false }, // NR
  { cip13: '3400900000066', artnature: 'biosimilaire', has_ameli: true, is_froid: true }, // biosimilaire au froid
  { cip13: '3400900000077', artnature: 'biosimilaire', has_ameli: true },
];
const K = charger(B, [{ cip13: '3400900000077' }]); // …077 : sur la liste NR Sagitta
const ligne = (cip, puNet, qte) => ({ artCode: cip, puNet, qte });

test('un biosimilaire remboursé produit de la marge, aux trois tranches du barème', () => {
  const c = '3400900000022';
  assert.equal(K.margeNetteCat(c), 'biosim');
  assert.ok(Math.abs(K.margeNetteLigne(ligne(c, 3, 10)) - 1.8) < 1e-9, '≤ 4,33 € : 0,18 € par boîte');
  assert.ok(Math.abs(K.margeNetteLigne(ligne(c, 100, 2)) - 8.4) < 1e-9, '4,33 à 468 € : 4,2 % du net');
  assert.ok(Math.abs(K.margeNetteLigne(ligne(c, 500, 3)) - 58.5) < 1e-9, '> 468 € : 19,50 € par boîte');
});
test('même barème que le princeps remboursé', () => {
  assert.equal(K.margeNetteLigne(ligne('3400900000022', 100, 2)), K.margeNetteLigne(ligne('3400900000011', 100, 2)));
});
test('un biosimilaire remboursé et conservé au froid produit de la marge (rangé biosimilaire, pas froid)', () => {
  assert.equal(K.margeNetteCat('3400900000066'), 'biosim');
  assert.ok(K.margeNetteLigne(ligne('3400900000066', 100, 1)) > 0);
});
test('générique, NR, biosimilaire non remboursable, biosimilaire NR Sagitta : aucune marge', () => {
  ['3400900000044', '3400900000055', '3400900000033', '3400900000077'].forEach((c) => assert.equal(K.margeNetteLigne(ligne(c, 100, 5)), 0, c));
});
test('un produit inconnu du BENCHMARK ne produit toujours aucune marge', () => {
  assert.equal(K.margeNetteLigne(ligne('3400999999999', 100, 5)), 0);
});
test('margeNettePharma additionne princeps et biosimilaires remboursés seulement', () => {
  const s = [ligne('3400900000011', 100, 1), ligne('3400900000022', 100, 1), ligne('3400900000044', 100, 1), ligne('3400900000033', 100, 1)];
  assert.ok(Math.abs(K.margeNettePharma(s) - 8.4) < 1e-9);
});
test('les textes affichés ne disent plus « princeps remboursés seulement »', () => {
  assert.ok(!/princeps remboursés (seulement|seuls)/.test(pharma));
  assert.ok(pharma.includes('Princeps et biosimilaires remboursés : génériques et non remboursés hors calcul'));
});
