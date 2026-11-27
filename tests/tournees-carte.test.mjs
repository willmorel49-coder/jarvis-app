// Vue « Carte » de l'écran Tournées (19/11/2026) : calcul pur. Données FICTIVES seulement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.V2 = {};
require('../crm/v2/v2-tournees.js');
const K = require('../crm/v2/v2-tournees-carte.js');

// colonnes d'un prospect : [cip, lat, lng, km_route, apres, avant, detour, fiable]
const d = { tournees: {
  T02: { prospects: [['A2', 47.1, -1.1, 3.4, 2, 3, 1.2, true], ['A1', 47.2, -1.2, 0.5, 1, 2, 0, true], ['DOUBLON', 47.3, -1.3, 9, 1, 2, 4, true]] },
  T01: { prospects: [['B1', 47.4, -1.4, 12.2, 0, 1, 8, false], ['DOUBLON', 47.3, -1.3, 2, 1, 2, 0.5, true], ['SANSKM', 47.5, -1.5, null, 1, 2, 1, true], ['SANSPOS', null, null, 1, 1, 2, 1, true]] },
  T03: { prospects: [] }
} };

test('prospects : un par CIP (le plus proche gagne), sans position ni distance illisible, triés par distance', () => {
  const L = K.prospects(d);
  assert.deepEqual(L.map(p => p.cip), ['A1', 'DOUBLON', 'A2', 'B1']);
  assert.equal(L.find(p => p.cip === 'DOUBLON').tournee, 'T01');
  assert.equal(L.find(p => p.cip === 'DOUBLON').km, 2);
  assert.deepEqual(L.map(p => p.km), [0.5, 2, 3.4, 12.2]);
});
test('prospects : fichier vide ou absent → liste vide, jamais une exception', () => {
  assert.deepEqual(K.prospects(null), []); assert.deepEqual(K.prospects({}), []); assert.deepEqual(K.prospects({ tournees: { T01: {} } }), []);
});
test('dans : nombre de prospects à ≤ rayon (frontière incluse) — cas connu', () => {
  const L = K.prospects(d);
  assert.equal(K.dans(L, 0.4), 0); assert.equal(K.dans(L, 0.5), 1); assert.equal(K.dans(L, 2), 2);
  assert.equal(K.dans(L, 3.39), 2); assert.equal(K.dans(L, 3.4), 3); assert.equal(K.dans(L, 12.2), 4); assert.equal(K.dans(L, 50), 4);
  assert.equal(K.dans([], 10), 0);
});
test('rayonMax : lu dans les données (km du plus loin, arrondi au-dessus), au moins 1', () => {
  assert.equal(K.rayonMax(K.prospects(d)), 13); assert.equal(K.rayonMax([]), 1);
  assert.equal(K.rayonMax([{ km: 7 }]), 7);
});
test('ordonner : par numéro, ou par rentabilité par mois la plus faible d\'abord', () => {
  const A = { T10: { rentabilite_mois: 500 }, T02: { rentabilite_mois: -40 }, T05: { rentabilite_mois: 100 } };
  assert.deepEqual(K.ordonner(A, 'code'), ['T02', 'T05', 'T10']);
  assert.deepEqual(K.ordonner(A, 'renta'), ['T02', 'T05', 'T10']);
  A.T01 = { rentabilite_mois: 900 }; assert.deepEqual(K.ordonner(A, 'renta'), ['T02', 'T05', 'T10', 'T01']);
  A.T01.rentabilite_mois = -500; assert.deepEqual(K.ordonner(A, 'renta'), ['T01', 'T02', 'T05', 'T10']);
  assert.deepEqual(K.ordonner(null, 'code'), []);
});
test('insertion : phrase de position + détour, avec le code de la tournée', () => {
  const p = { tournee: 'T07', apres: 3, avant: 4, detour: 2.34 };
  assert.match(K.insertion(p), /^Entre l’arrêt n° 3 et n° 4 de T07 · détour 2,3 km$/);
  assert.match(K.insertion({ tournee: 'T07', apres: 3, avant: 4, detour: 0 }), /sur la route$/);
  assert.equal(K.insertion(null), '');
});
test('couleurs de tournée : 22 toutes différentes', () => {
  const s = new Set(Array.from({ length: 22 }, (_, k) => K.couleurTournee(k))); assert.equal(s.size, 22);
});
test('arretsOrdre : dans l\'ordre de livraison ; ficheDe : code d\'abord, fiche reliée ensuite, sinon rien', () => {
  assert.deepEqual(K.arretsOrdre({ arrets: [{ n: 3 }, { n: 1 }, { n: 2 }] }).map(a => a.n), [1, 2, 3]);
  const P = [{ id: 'X1' }, { id: 'Y2' }];
  assert.equal(K.ficheDe({ id: 'X1', fi: 'Y2' }, P), 'X1'); assert.equal(K.ficheDe({ id: 'ZZ', fi: 'Y2' }, P), 'Y2');
  assert.equal(K.ficheDe({ id: 'ZZ' }, P), ''); assert.equal(K.ficheDe({ id: 'ZZ' }, null), '');
});
test('cleCip : ne garde que les caractères sûrs (valeur placée dans un onclick)', () => {
  assert.equal(K.cleCip('12\'"<>3 4'), '1234'); assert.equal(K.cleCip(null), '');
});

// 27/11/2026 — adhérentes des groupements suivis (OPSO Santé, Essentiels Pharma) mises en avant sur la carte des tournées.
test('indexGroupements : seuls les groupements suivis, par code (et par CIP d’origine d’une cliente), table de départ comprise', () => {
  const p = (cip, g, ann) => { const x = new Array(14).fill(''); x[3] = g; x[13] = cip; if (ann) x._ann = ann; return x; };
  const PF = { grp: ['—', 'Groupement suivi A', 'Autre groupement'], p: [p('1000001', 1), p('1000002', 2), p('CLI42', 1, '1000003')] };
  const idx = K.indexGroupements(PF, ['Groupement suivi A', 'Groupement suivi B'], { '1000004': 'Groupement suivi B', '1000005': 'Pas suivi' });
  assert.deepEqual(idx, { '1000001': 'Groupement suivi A', 'CLI42': 'Groupement suivi A', '1000003': 'Groupement suivi A', '1000004': 'Groupement suivi B' });
  assert.deepEqual(K.indexGroupements(null, ['X'], null), {});
});
