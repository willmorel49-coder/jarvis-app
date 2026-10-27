// 27/10/2026 (Will) : « Ce que cette officine devrait vendre » retiré partout — fiche cliente, fiche prospect, vue « menu ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const V2 = new URL('../crm/v2/', import.meta.url);
const lire = (f) => readFileSync(new URL(f, V2), 'utf8');

test('index.html ne charge plus v2-potentiel.js', () => {
  assert.ok(!lire('index.html').includes('v2-potentiel.js'));
});
test('la fiche officine n\'appelle plus le bloc (client, prospect, menu)', () => {
  const s = lire('v2-pharma.js');
  assert.ok(!/potentielBloc|potentielHtml/.test(s));
});
test('aucun écran ne dessine le titre « Ce que cette officine devrait vendre »', () => {
  const js = readdirSync(V2).filter((f) => f.endsWith('.js') || f.endsWith('.html'));
  assert.deepEqual(js.filter((f) => lire(f).includes('devrait vendre</h3>')), []);
});
