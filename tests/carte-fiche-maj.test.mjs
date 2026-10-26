// La carte (26/10/2026) : l'arrivée de l'estimation « probable » ne doit plus redessiner la page (la fiche se refermait).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const carte = readFileSync(new URL('../crm/v2/v2-carte.js', import.meta.url), 'utf8');
const prob = readFileSync(new URL('../crm/v2/v2-probable.js', import.meta.url), 'utf8');

test('v2-probable.js : tente V2.carteFicheMaj() AVANT V2.render(), et sort si la carte a géré le cas', () => {
  const a = prob.indexOf('V2.carteFicheMaj && V2.carteFicheMaj()) return;');
  const b = prob.indexOf('if (V2.route && V2.render) V2.render();');
  assert.ok(a > 0 && b > a);
});
test('v2-carte.js expose carteFicheMaj, retient la fiche ouverte et l\'oublie à la fermeture', () => {
  assert.match(carte, /V2\.carteFicheMaj = function/);
  assert.match(carte, /V2\.carteFicheClose = function \(\) \{ ficheIdx = null;/);
  assert.match(carte, /function renderFiche\(i\) \{\s*var el = document\.getElementById\('cn-fiche'\); if \(!el\) return;\s*ficheIdx = i;/);
});
test('carteFicheMaj : ne redessine que la fiche, rend true sur La carte, false ailleurs (la page fiche #pharma garde son V2.render)', () => {
  const src = carte.slice(carte.indexOf('V2.carteFicheMaj = function'), carte.indexOf('function renderFiche(i)'));
  const calls = [];
  const el = { querySelector: () => ({ scrollTop: 40 }) };
  const mk = (route, withMap, withFiche) => {
    const V2 = { route: { name: route } };
    const document = { getElementById: id => (id === 'carte-map' ? withMap : (id === 'cn-fiche' && withFiche ? el : null)) };
    const f = new Function('V2', 'document', 'map', 'D', 'ficheIdx', 'renderFiche',
      'function surCarte(){var n=V2.route&&V2.route.name;return n===\'carte\'||n===\'groupements\'||n===\'copilote\'||n===\'sagitta\';}' + src + 'return V2.carteFicheMaj;');
    return f(V2, document, {}, { p: { 7: [] } }, 7, i => calls.push(i));
  };
  assert.equal(mk('carte', true, true)(), true);  assert.deepEqual(calls, [7]);   // fiche 7 rafraîchie
  assert.equal(mk('carte', true, false)(), true); assert.deepEqual(calls, [7]);    // pas de fiche : rien à refaire, pas de rebâtissage
  assert.equal(mk('pharma', true, true)(), false);                                  // page fiche : V2.render() conservé
  assert.equal(mk('carte', null, true)(), false);                                   // carte pas encore bâtie
});
