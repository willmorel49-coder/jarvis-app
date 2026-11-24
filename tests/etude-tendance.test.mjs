/* L'étude par produit (24/11/2026) : calculs purs de crm/v2/v2-etude.js. Données fabriquées : la réponse est connue d'avance.
   Lancer : node --test tests/etude-tendance.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const w = { V2: {} }; w.window = w;
vm.runInNewContext(readFileSync(new URL('../crm/v2/v2-etude.js', import.meta.url), 'utf8'), w);
const K = w.V2.etude._calc;
const nu = (x) => JSON.parse(JSON.stringify(x));
const mc = (q, f) => q.map((n, i) => ({ ym: '2026-' + String(i + 1).padStart(2, '0'), nous: n, france: f[i] }));

test('notre tendance : mêmes mois des deux côtés, 3 premiers face aux 3 derniers', () => {
  // nous : 10+10+10 = 30 puis 12+12+12 = 36 -> +20 % ; France : 100x3 puis 104x3 -> +4 %
  const t = K.tendanceCommune(mc([10, 10, 10, 11, 11, 12, 12, 12], [100, 100, 100, 100, 100, 104, 104, 104]), 10);
  assert.equal(t.k, 3);
  assert.deepEqual(nu(t.debut), ['2026-01', '2026-03']); assert.deepEqual(nu(t.fin), ['2026-06', '2026-08']);
  assert.ok(Math.abs(t.nous - 0.2) < 1e-9); assert.ok(Math.abs(t.france - 0.04) < 1e-9);
});
test('notre tendance : peu de mois = moins de 3 mois comparés ; trop peu de ventes = pas de pourcentage', () => {
  assert.equal(K.tendanceCommune(mc([10], [100]), 10), null);
  assert.equal(K.tendanceCommune(mc([10, 20, 30, 40], [1, 1, 1, 1]), 10).k, 2);
  const t = K.tendanceCommune(mc([1, 1, 1, 2, 2, 2], [100, 100, 100, 110, 110, 110]), 10);
  assert.equal(t.nous, null); assert.equal(t.insuffisant, true); assert.ok(Math.abs(t.france - 0.1) < 1e-9);
});
test('séries : les retours (négatifs) sont ramenés à 0 et les mois se suivent', () => {
  const s = K.serieDe({ m0: '2025-11', n: 4, d: { '3400000000001': [[5, -2, 7, 1], [3, 0, 4, 1], [2, -2, 3, 0]] } }, '3400000000001');
  assert.deepEqual(nu(s.mois), ['2025-11', '2025-12', '2026-01', '2026-02']); assert.deepEqual(nu(s.tous), [5, 0, 7, 1]);
});
test('12 derniers mois face aux 12 précédents', () => {
  const tous = Array(12).fill(100).concat(Array(12).fill(150));
  const r = K.resumeFrance({ n: 24, tous, mois: K.moisListe('2025-01', 24) });
  assert.equal(r.l12, 1800); assert.equal(r.p12, 1200); assert.ok(Math.abs(r.evo - 0.5) < 1e-9); assert.equal(r.dernier, '2026-12');
});
test('saisonnalité : une année à 12 mois égaux donne 1 partout ; la croissance n\'est pas prise pour de la saison', () => {
  const mois = K.moisListe('2021-01', 24);
  const plat = K.saisonIndices(Array(24).fill(50), mois); plat.forEach((x) => assert.ok(Math.abs(x - 1) < 1e-9));
  const pic = Array(24).fill(100); pic[11] = 220; pic[23] = 440;   // décembre fort deux années de suite, l'an 2 vaut le double
  const s = K.saisonIndices(pic, mois); assert.ok(s[11] > 1.5 && s[0] < 1);
  assert.equal(K.saisonIndices(Array(10).fill(1), K.moisListe('2021-01', 10)), null);
});
test('région : code lu dans le code postal (Corse, outre-mer compris)', () => {
  assert.equal(K.regionDeCp('75008'), '11'); assert.equal(K.regionDeCp('20000'), '93'); assert.equal(K.regionDeCp('97400'), '5');
  assert.equal(K.regionDeCp('49370'), '52'); assert.equal(K.regionDeCp(''), null);
});
test('régions : indice = part du produit / part du marché', () => {
  const reg = [{ c: '11', n: 'A' }, { c: '24', n: 'B' }, { c: '99', n: 'Inconnue' }];
  const p = K.partsRegions(reg, [30, 70, 999], [50, 50, 999]);
  assert.equal(p.length, 2); assert.ok(Math.abs(p[0].produit - 0.3) < 1e-9); assert.ok(Math.abs(p[0].indice - (-0.4)) < 1e-9); assert.ok(Math.abs(p[1].indice - 0.4) < 1e-9);
});
test('ville / hôpital : parts sur 12 mois, et part de l\'hôpital par année', () => {
  const n = 24, mois = K.moisListe('2025-01', n);
  const r = K.partsPrescripteurs({ n, mois, ville: Array(n).fill(75), hop: Array(n).fill(25) });
  assert.ok(Math.abs(r.ville - 0.75) < 1e-9); assert.ok(Math.abs(r.hop - 0.25) < 1e-9); assert.equal(r.parAn.length, 2);
});
test('ruptures : seule la marque du produit compte', () => {
  const arch = { episodes: [{ k: 'xarelto 1 mg granules', spec: 'Xarelto 1 mg/ml – [rivaroxaban]', st: 'Tension', d: '2026-08-28', f: '2026-10-20', j: 53 }, { k: 'autre', spec: 'Autre 5 mg' }] };
  assert.equal(K.rupturesPassees(arch, 'XARELTO 20MG CPR').length, 1); assert.equal(K.rupturesPassees(arch, 'XA').length, 0);
});
test('ruptures : le dosage dit si l\'épisode de la marque touche cette présentation', () => {
  assert.equal(K.memeDosage('XARELTO 20MG CPR', 'Xarelto 1 mg/mL, granulés pour supension buvable, flacon de 250 ml – [rivaroxaban]'), false);
  assert.equal(K.memeDosage('XARELTO 2,5MG CPR', 'Xarelto 2,5 mg, comprimé pelliculé'), true);
  assert.equal(K.memeDosage('HEPARINE CALCIQUE 25000UI/ML', 'Héparine calcique Panpharma 25 000 UI/mL, solution injectable'), true);
  assert.equal(K.memeDosage('REPEVAX SER', 'Repevax, suspension injectable en seringue préremplie'), null);
});
