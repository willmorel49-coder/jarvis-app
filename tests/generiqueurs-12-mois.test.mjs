// CA par génériqueur ramené à 12 mois (fiche officine, 26/10/2026) : sans option = HTML d'avant ; moins de 3 mois = pas de chiffre annuel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = globalThis;
globalThis.document = { getElementById: () => ({}), createElement: () => ({}), head: { appendChild() {} } };
globalThis.GENERIQUEURS = { '111': 'Biogaran', '222': 'Zentiva' };
require('../crm/v2/v2-generiqueurs.js');
const V2 = globalThis.V2;
const norm = (h) => h.replace(/[  ]/g, ' ');
const ventes = [{ artCode: '111', mntNetHt: 8000 }, { artCode: '222', mntNetHt: 2000 }];

test('sans option : aucune trace du 12 mois', () => {
  const h = V2.generiqueurCard(ventes, { title: 'X' });
  assert.ok(h.includes('Biogaran'));
  assert.ok(!h.includes('/an') && !h.includes('Sur 12 mois') && !h.includes('gnq-an'));
  assert.equal(h, V2.generiqueurCard(ventes, { title: 'X', annuel: null }));
});
test('2 mois : pas de chiffre annuel, HTML identique à sans option', () => {
  assert.equal(V2.generiqueurCard(ventes, { title: 'X', annuel: { mois: 2, ventes } }), V2.generiqueurCard(ventes, { title: 'X' }));
});
test('8 mois, 8 000 € chez Biogaran : 12 000 €/an', () => {
  const h = norm(V2.generiqueurCard(ventes, { title: 'X', annuel: { mois: 8, ventes } }));
  assert.ok(h.includes('12 000'), h);
  assert.ok(h.includes('Sur 12 mois : moyenne de ses 8 mois × 12'));
  assert.ok(h.includes('15 000'));   // total 10 000 € x 12/8
});
