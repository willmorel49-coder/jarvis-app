import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-rdv-creneaux.js');

// ═══════════════════════════════════════════════════════════════
//  Les journées ouvertes à la réservation (25/08/2026)
// ═══════════════════════════════════════════════════════════════
// ⚠️ Ces tests décrivent la MÊME règle que `rdv_jour_ouvert()` en base
// (docs/supabase/rdv-jours-ouverts.sql). Le serveur fait foi ; le moteur
// n'existe que pour ne pas afficher un créneau qui serait refusé au clic.
// Si l'un des deux change, ces tests doivent échouer — c'est leur métier.

const J = '2026-09-15';
const AUTRE = '2026-09-16';

test('mode normal : une journée sans aucun avis reste ouverte', () => {
  assert.equal(M.jourOuvert(J, [], false), true);
  assert.equal(M.jourOuvert(J, null, false), true);
  assert.equal(M.jourOuvert(J, undefined, undefined), true);
});

test('mode normal : déclarer un secteur sans se prononcer ne ferme pas', () => {
  // C'est la prudence du secteur du jour : une déclaration de département
  // n'est pas une déclaration de fermeture.
  const s = [{ date: J, departements: ['44'], ouvert: null }];
  assert.equal(M.jourOuvert(J, s, false), true);
});

test('mode normal : ouvert=false ferme cette journée-là, et elle seule', () => {
  const s = [{ date: J, departements: [], ouvert: false }];
  assert.equal(M.jourOuvert(J, s, false), false);
  assert.equal(M.jourOuvert(AUTRE, s, false), true);
});

test('mode « je choisis » : rien n’est ouvert tant que rien n’est coché', () => {
  assert.equal(M.jourOuvert(J, [], true), false);
  assert.equal(M.jourOuvert(J, [{ date: J, departements: ['44'], ouvert: null }], true), false);
});

test('mode « je choisis » : seule une journée cochée est offerte', () => {
  const s = [{ date: J, departements: [], ouvert: true }];
  assert.equal(M.jourOuvert(J, s, true), true);
  assert.equal(M.jourOuvert(AUTRE, s, true), false);
});

test('mode « je choisis » : une journée fermée le reste', () => {
  const s = [{ date: J, departements: [], ouvert: false }];
  assert.equal(M.jourOuvert(J, s, true), false);
});

test('les créneaux proposés respectent les journées fermées', () => {
  const base = {
    officine: { lat: 47.2184, lon: -1.5536, cp: '44000' },
    dispo: { jours: { 1: [['09:00', '18:00']], 2: [['09:00', '18:00']],
                      3: [['09:00', '18:00']], 4: [['09:00', '18:00']],
                      5: [['09:00', '18:00']] } },
    blocages: [], occupes: [], agenda: [], secteurs: [],
    aujourdhui: '2026-09-01'
  };
  const avant = M.proposer(base);
  assert.ok(avant.length > 0, 'sans restriction, des journées sont proposées');

  // On ferme explicitement toutes les journées proposées : il ne doit plus
  // en rester une seule.
  const fermees = avant.map(j => ({ date: j.date, departements: [], ouvert: false }));
  const apres = M.proposer(Object.assign({}, base, { secteurs: fermees }));
  avant.forEach(j => {
    assert.ok(!apres.some(x => x.date === j.date),
      `la journée ${j.date}, fermée, ne doit plus être proposée`);
  });
});

test('mode « je choisis » : le calendrier complet n’ouvre que les jours cochés', () => {
  const base = {
    officine: { lat: 47.2184, lon: -1.5536, cp: '44000' },
    dispo: { jours: { 1: [['09:00', '18:00']], 2: [['09:00', '18:00']],
                      3: [['09:00', '18:00']], 4: [['09:00', '18:00']],
                      5: [['09:00', '18:00']] },
             jours_choisis: true },
    blocages: [], occupes: [], agenda: [],
    secteurs: [{ date: '2026-09-15', departements: [], ouvert: true }],
    aujourdhui: '2026-09-01'
  };
  const jours = M.calendrier(base);
  assert.deepEqual(jours.map(j => j.date), ['2026-09-15'],
    'seule la journée cochée doit sortir');
});

test('le mode ne s’active jamais tout seul : dispo sans le champ = comme avant', () => {
  const base = {
    officine: { lat: 47.2184, lon: -1.5536, cp: '44000' },
    dispo: { jours: { 2: [['09:00', '18:00']] } },   // aucun `jours_choisis`
    blocages: [], occupes: [], agenda: [], secteurs: [],
    aujourdhui: '2026-09-01'
  };
  assert.ok(M.proposer(base).length > 0,
    'un commercial qui n’a rien réglé doit rester joignable');
});
