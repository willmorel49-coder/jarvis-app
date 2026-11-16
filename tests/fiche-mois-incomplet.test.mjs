// 16/11/2026 — fiche officine : « <mois> peut-être incomplet » se décide au niveau du SECTEUR (pas de l'officine).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const a = src.indexOf('  function moisIncompletSecteur(');
const b = src.indexOf('  V2._moisIncompletSecteur');
assert.ok(a > 0 && b > a, 'moisIncompletSecteur introuvable');
const ctx = { Math, Object };
vm.createContext(ctx);
vm.runInContext(src.slice(a, b) + '\nthis.f = moisIncompletSecteur;', ctx);
const inc = ctx.f;

// mois 24310 = octobre 2026 (2026*12 + 9)
const OCT = 2026 * 12 + 9;
const complet = { [OCT - 4]: 100000, [OCT - 3]: 110000, [OCT - 2]: 95000, [OCT - 1]: 105000, [OCT]: 98000 };
const coupe = { [OCT - 4]: 100000, [OCT - 3]: 110000, [OCT - 2]: 95000, [OCT - 1]: 105000, [OCT]: 30000 };
const absent = { [OCT - 4]: 100000, [OCT - 3]: 110000, [OCT - 2]: 95000, [OCT - 1]: 105000 };

test('secteur complet : le mois est complet, le pourcentage reste', () => {
  assert.equal(inc(complet, OCT), false);
});
test('secteur coupé (< 60 % de la médiane du secteur) : incomplet', () => {
  assert.equal(inc(coupe, OCT), true);
});
test('secteur absent du mois : incomplet', () => {
  assert.equal(inc(absent, OCT), true);
  assert.equal(inc(undefined, OCT), true);
});
test('le mois testé est exclu de la médiane et 60 % pile ne signale pas', () => {
  const t = { 1: 100, 2: 100, 3: 100, 4: 60 };
  assert.equal(inc(t, 4), false);
  t[4] = 59;
  assert.equal(inc(t, 4), true);
});
test('une officine à-coups dans un secteur complet n\'est pas signalée (la règle ne regarde que le secteur)', () => {
  // le secteur est plein : peu importe que l'officine ait peu commandé
  assert.equal(inc(complet, OCT), false);
});
test('un seul mois dans le secteur : rien à comparer, pas de signal', () => {
  assert.equal(inc({ [OCT]: 500 }, OCT), false);
});
