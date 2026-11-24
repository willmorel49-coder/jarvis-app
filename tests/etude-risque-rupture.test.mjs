/* Étude par produit (24/11/2026) : risque de rupture appris sur les signalements ANSM (crm/v2/v2-etude.js).
   Données fabriquées : la réponse est connue d'avance. Le vrai fichier est relu à la fin (forme seulement, jamais un taux en dur).
   Lancer : node --test tests/etude-risque-rupture.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const w = { V2: {} }; w.window = w;
vm.runInNewContext(readFileSync(new URL('../crm/v2/v2-etude.js', import.meta.url), 'utf8'), w);
const K = w.V2.etude._calc;

const SIG = {
  annees: [2022, 2025], fenetre: [2024, 2025],
  test: { annees: [2024, 2025], baisse: -0.10, cases: { 'M|3+|s': [400, 200], 'M|0|b': [100, 26], 'N|0|b': [1000, 40], 'N|1|s': [50, 15] } },
  d: { '3400900000001': ['220110', '240305', '240911', '251230'], '3400900000002': ['220207'] },
};

test('les dates AAMMJJ deviennent des dates ISO ; un CIP absent = aucune date', () => {
  assert.deepEqual([...K.signalementsDe(SIG, '3400900000001')], ['2022-01-10', '2024-03-05', '2024-09-11', '2025-12-30']);
  assert.equal(K.signalementsDe(SIG, '3400999999999').length, 0);
  assert.equal(K.signalementsDe(null, '3400900000001').length, 0);
});

test('seuls les signalements de la fenêtre comptent (2022 écarté) : MITM, 3 récents, demande stable → 50 %, élevé', () => {
  const r = K.risqueRupture(SIG, K.signalementsDe(SIG, '3400900000001'), true, { l12: 1000, evo: 0.02 });
  assert.equal(r.cle, 'M|3+|s'); assert.equal(r.recents, 3); assert.equal(r.taux, 0.5); assert.equal(r.niveau, 'élevé'); assert.equal(r.n, 400);
});

test('un signalement hors fenêtre ne compte pas, la baisse au-delà de 10 % est reconnue', () => {
  const r = K.risqueRupture(SIG, K.signalementsDe(SIG, '3400900000002'), true, { l12: 50, evo: -0.23 });
  assert.equal(r.cle, 'M|0|b'); assert.equal(r.recents, 0); assert.equal(r.niveau, 'moyen');
});

test('les trois niveaux : sous 10 % faible, 10 à 30 % moyen, 30 % et plus élevé', () => {
  assert.equal(K.risqueRupture(SIG, [], false, { l12: 9, evo: -0.5 }).niveau, 'faible');      // 4 %
  assert.equal(K.risqueRupture(SIG, ['2025-02-01'], false, { l12: 9, evo: null }).niveau, 'élevé'); // 30 %, tendance inconnue = pas en baisse
});

test('pas de comparaison possible → null (rien vendu en France, profil absent, fichier absent)', () => {
  assert.equal(K.risqueRupture(SIG, [], true, { l12: 0, evo: 0 }), null);
  assert.equal(K.risqueRupture(SIG, [], true, null), null);
  assert.equal(K.risqueRupture(SIG, [], true, { l12: 5, evo: 0.3 }), null);   // M|0|s absent du tableau fabriqué
  assert.equal(K.risqueRupture(null, [], true, { l12: 5, evo: 0 }), null);
});

test('le vrai fichier du robot a la forme attendue (taux recalculés, jamais en dur)', () => {
  const f = JSON.parse(readFileSync(new URL('../crm/v2/ansm-signalements.json', import.meta.url), 'utf8'));
  assert.ok(f.annees[0] >= 2022 && f.fenetre[1] === f.annees[1] && f.fenetre[1] - f.fenetre[0] === 1);
  assert.ok(Object.keys(f.d).length > 5000, 'au moins 5 000 présentations signalées');
  const cases = Object.entries(f.test.cases);
  assert.equal(cases.length, 16, '2 × 4 × 2 profils');
  cases.forEach(([k, [n, s]]) => { assert.match(k, /^[MN]\|(0|1|2|3\+)\|[bs]$/); assert.ok(n > 0 && s >= 0 && s <= n, k); });
  Object.values(f.d).slice(0, 200).forEach((l) => l.forEach((d) => assert.match(d, /^\d{6}$/)));
});
