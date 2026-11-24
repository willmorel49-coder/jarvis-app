// 24/11/2026 — la reconnaissance de l'agenda ne prend comme « portefeuille » que les officines
// DU commercial, pas tout le fichier de l'équipe. Mesuré sur l'agenda de Will (636 événements) :
// 63 rattachements à des officines de collègues, presque tous à l'autre bout de la France.
// Officines fictives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = (f) => fs.readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');

const FICHIER = [
  { id: '9200001', name: 'PHARMACIE DES ESSAIS', ville: 'VILLE-A', cp: '49999', comms: ['AAA'] },
  { id: '9200002', name: 'PHARMACIE DU LOINTAIN', ville: 'VILLE-LOIN', cp: '87999', comms: ['BBB'] },
  { id: '9200003', name: 'PHARMACIE PARTAGEE', ville: 'VILLE-B', cp: '72999', comms: ['BBB', 'AAA'] },
];

function charger(commercial) {
  const ctx = { console, Date, Math, JSON, String, Number, Array, Object, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.V2 = { user: { id: 'u', commercial }, pharmacies: FICHIER };
  vm.createContext(ctx);
  vm.runInContext(lire('v2-rdv-reco.js'), ctx);
  vm.runInContext(lire('v2-rdv-planning.js'), ctx);
  return ctx;
}

test('le portefeuille de la reconnaissance = les officines du commercial', () => {
  const c = charger('AAA'), idx = c.V2.planningIndex();
  assert.deepEqual(Array.from(idx.porte, (e) => e.o.id).sort(), ['9200001', '9200003']);
  // une officine de collègue n'est plus « reconnue » faute d'homonyme dans un fichier partiel
  assert.equal(c.V2RECO.apparier('Phie du lointain', idx.porte, idx.nat, {}, idx.villes).officine, null);
  assert.equal(c.V2RECO.apparier('Appeler phie des essais', idx.porte, idx.nat, {}, idx.villes).etat, 'reconnu');
  assert.equal(c.V2RECO.apparier('Pharmacie partagee', idx.porte, idx.nat, {}, idx.villes).etat, 'reconnu');
  // « client » (officine du fichier de l'équipe) reste vrai pour toutes
  assert.equal(Object.keys(idx.idsPorte).length, 3);
  assert.equal(idx.villes['VILLE LOIN'], 1);
});

test('sans officine à son nom, tout le fichier reste le portefeuille', () => {
  const idx = charger('ZZZ').V2.planningIndex();
  assert.equal(idx.porte.length, 3);
});
