/* Étude par produit (24/11/2026, choix cliqué de Will : « Ligne sur la fiche ») : arrêt de commercialisation annoncé
   à l'avance par le laboratoire (ANSM, data.gouv.fr, code 102), calculé par crm/v2/v2-etude.js.
   Données fabriquées : la réponse est connue d'avance. Le vrai fichier du robot est relu à la fin (forme seulement).
   Lancer : node --test tests/etude-arret-annonce.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const w = { V2: {} }; w.window = w;
vm.runInNewContext(readFileSync(new URL('../crm/v2/v2-etude.js', import.meta.url), 'utf8'), w);
const K = w.V2.etude._calc;
const nu = (x) => JSON.parse(JSON.stringify(x));

const ARR = { version: '2026-11-10', d: { '3400900000001': '2027-02-28', '3400900000002': '2026-11-15', '3400900000003': '2026-11-24', '3400900000004': '28/02/2027' } };

test('une date à venir est rendue, avec la date du fichier ANSM lue dans le fichier', () => {
  assert.deepEqual(nu(K.arretAnnonce(ARR, '3400900000001', '2026-11-24')), { date: '2027-02-28', version: '2026-11-10' });
});

test('le jour même compte encore ; une date passée ne s\'affiche plus', () => {
  assert.equal(K.arretAnnonce(ARR, '3400900000003', '2026-11-24').date, '2026-11-24');
  assert.equal(K.arretAnnonce(ARR, '3400900000002', '2026-11-24'), null);
});

test('pas d\'annonce, date illisible, fichier absent ou jour inconnu → rien', () => {
  assert.equal(K.arretAnnonce(ARR, '3400900000099', '2026-11-24'), null);
  assert.equal(K.arretAnnonce(ARR, '3400900000004', '2026-11-24'), null);
  assert.equal(K.arretAnnonce(null, '3400900000001', '2026-11-24'), null);
  assert.equal(K.arretAnnonce(ARR, '3400900000001', ''), null);
});

test('date du fichier illisible : l\'annonce reste, sans date de fichier inventée', () => {
  assert.deepEqual(nu(K.arretAnnonce({ version: 'novembre', d: ARR.d }, '3400900000001', '2026-11-24')), { date: '2027-02-28', version: null });
});

test('le vrai fichier du robot a la forme attendue', () => {
  const f = JSON.parse(readFileSync(new URL('../crm/v2/ansm-arrets.json', import.meta.url), 'utf8'));
  assert.match(f.version, /^\d{4}-\d{2}-\d{2}$/);
  const e = Object.entries(f.d);
  assert.ok(e.length >= 100, 'au moins 100 annonces (garde-fou du robot)');
  e.forEach(([c, d]) => { assert.match(c, /^\d{13}$/); assert.match(d, /^\d{4}-\d{2}-\d{2}$/); });
});
