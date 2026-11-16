/* fiche-marge-nous.test.mjs — petit bloc « Ce que cette officine nous rapporte » (fiche officine, 16/11/2026).
 * margeNousPure est extraite de v2-pharma.js (fonction pure) et exécutée sur des données INVENTÉES. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const a = src.indexOf('  function margeNousPure('), b = src.indexOf('  function margeNousBloc(');
assert.ok(a > 0 && b > a, 'margeNousPure introuvable');
const ctx = {}; vm.runInNewContext(src.slice(a, b) + '\nthis.f = margeNousPure;', ctx);
const f = ctx.f;

const R = { n: 5, tot: 1000, fam: { p: 400, p1: 0, p2: 0, i: 300, c: 0, fr: 300, nr: 0 } };

test('cumul de l’officine ; moyenne de nos clients = moyenne par mois × mois livrés ; n lu dans les données', () => {
  const d = f(R, 4, { n: 123, mgMois: 200, fam: { p: 50, i: 30, c: 10, fr: 80, nr: 0 } });
  assert.equal(d.tot, 1000); assert.equal(d.moyTot, 800); assert.equal(d.nClients, 123);
  assert.equal(JSON.stringify(d.lignes.map((l) => [l.f, l.v, l.moy])), JSON.stringify([['p', 400, 200], ['i', 300, 120], ['c', 0, 40], ['fr', 300, 320]]));   // nr (0 et 0) masquée
});
test('sans marge connue : pas de bloc', () => { assert.equal(f(null, 4, {}), null); assert.equal(f({ n: 0, tot: 0, fam: {} }, 4, {}), null); });
test('sans moyenne : lignes sans comparaison', () => {
  const d = f(R, 0, null);
  assert.equal(d.moyTot, null); assert.equal(d.nClients, 0); assert.ok(d.lignes.every((l) => l.moy === null));
});
