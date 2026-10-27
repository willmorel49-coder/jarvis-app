// Génériques et biosimilaires séparés sur la fiche officine (27/10/2026) : sans type = calcul d'avant (Pilotage).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = globalThis;
globalThis.document = { getElementById: () => ({}), createElement: () => ({}), head: { appendChild() {} } };
globalThis.GENERIQUEURS = { '111': 'Biogaran', '222': 'Zentiva', '333': 'Sandoz' };
globalThis.BIOSIMILAIRES = { molecules: [{ biosimilaires: [
  { labo: 'Sandoz', cips: ['333'] },                       // biosimilaire présent dans la table BDPM
  { labo: 'Celltrion', distrib: 'Zentiva', cips: ['444'] }, // distribué en France par Zentiva
  { labo: 'Amgen', cips: ['555'] },
] }] };
require('../crm/v2/v2-generiqueurs.js');
const V2 = globalThis.V2;
const ventes = [
  { artCode: '111', mntNetHt: 8000 }, { artCode: '222', mntNetHt: 2000 }, { artCode: '333', mntNetHt: 1000 },
  { artCode: '444', mntNetHt: 500 }, { artCode: '555', mntNetHt: 300 }, { artCode: '999', mntNetHt: 10000 },
];
const parLab = (r) => Object.fromEntries(r.rows.map((o) => [o.lab, o.ca]));

test('sans type : calcul inchangé (biosimilaire de la table BDPM compté, les autres non)', () => {
  const r = V2.caParGeneriqueur(ventes);
  assert.equal(r.total, 11000);
  assert.deepEqual(parLab(r), { Biogaran: 8000, Zentiva: 2000, Sandoz: 1000 });
});
test('génériques : sans aucun biosimilaire', () => {
  const r = V2.caParGeneriqueur(ventes, 'gen');
  assert.equal(r.total, 10000);
  assert.deepEqual(parLab(r), { Biogaran: 8000, Zentiva: 2000 });
});
test('biosimilaires : tous, rangés sous le distributeur en France', () => {
  const r = V2.caParGeneriqueur(ventes, 'biosim');
  assert.equal(r.total, 1800);
  assert.deepEqual(parLab(r), { Sandoz: 1000, Zentiva: 500, Amgen: 300 });
  assert.ok(V2.generiqueurCard(ventes, { type: 'biosim' }).includes('3 laboratoires'));
});
test('12 mois suit le même partage', () => {
  const h = V2.generiqueurCard(ventes, { type: 'biosim', annuel: { mois: 6, ventes } }).replace(/[\u00a0\u202f]/g, ' ');
  assert.ok(h.includes('3 600'), h);   // 1 800 € × 12/6
});
test('sans base biosimilaires : pas de carte biosimilaires, génériques comme avant', () => {
  const B = globalThis.BIOSIMILAIRES;
  globalThis.BIOSIMILAIRES = undefined;
  try {
    assert.equal(V2.generiqueurCard(ventes, { type: 'biosim' }), '');
    assert.equal(V2.caParGeneriqueur(ventes, 'gen').total, 11000);
  } finally { globalThis.BIOSIMILAIRES = B; }
});
test('négo labos d\'Appro : une marque de génériqueur est écartée, un biosimilaire de marque reste', () => {
  globalThis.GENERIQUEURS_MARQUES = ['111', '333'];
  try {
    assert.equal(V2.estMarqueGeneriqueur('111'), true);    // ex. Kardégic : marque d'un labo génériqueur
    assert.equal(V2.estMarqueGeneriqueur('333'), false);   // biosimilaire Sandoz : garde son labo
    assert.equal(V2.estMarqueGeneriqueur(222), false);     // vrai générique
  } finally { globalThis.GENERIQUEURS_MARQUES = undefined; }
});
