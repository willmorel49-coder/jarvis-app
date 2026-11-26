// « Mois par mois » OPSO (17/11/2026) : calcul des nouvelles pharmacies (groupements/v2/groupement-bord.js, nouvellesParMois).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(join(RACINE, 'groupements/v2/groupement-bord.js'), 'utf8');
function fonction(s, nom) {
  const a = s.indexOf('function ' + nom + '(');
  assert.ok(a >= 0, nom + ' absente');
  let i = s.indexOf('{', a), n = 0;
  for (; i < s.length; i++) { if (s[i] === '{') n++; else if (s[i] === '}' && --n === 0) break; }
  return s.slice(a, i + 1);
}
const nouvellesParMois = new Function(fonction(src, 'nouvellesParMois') + ';return nouvellesParMois;')();
const L = (id, y, m, mnt, rep) => (rep ? { pharmacyId: id, year: y, month: m, mntNetHt: mnt } : { pharmacyId: id, year: y, month: m, mntNetHt: mnt, commercial: '' });

test('premier mois suivi = début du suivi ; nouvelle = premier achat réel > 0', () => {
  const r = nouvellesParMois([
    L('a', 2026, 1, 100), L('a', 2026, 3, 50),
    L('b', 2026, 2, -20), L('b', 2026, 3, 80),      // avoir seul en février : nouvelle en mars
    L('c', 2026, 3, 10), L('c', 2026, 2, 10),       // ordre des lignes indifférent
    L('d', 2026, 1, 30, true), L('d', 2026, 2, 30, true), // relevé réparti : jamais nouvelle, non datée
  ], { a: 'Alpha', b: 'Bravo', c: 'Charlie' });
  assert.equal(r.k0, 2026 * 12 + 1);
  assert.deepEqual(r.parMois[2026 * 12 + 1], ['Alpha']);
  assert.deepEqual(r.parMois[2026 * 12 + 2], ['Charlie']);
  assert.deepEqual(r.parMois[2026 * 12 + 3], ['Bravo']);
  assert.equal(r.nonDatees, 1);
});

test('passage d\'année et nom manquant', () => {
  const r = nouvellesParMois([L('x', 2026, 12, 5), L('y', 2027, 1, 5)], {});
  assert.deepEqual(r.parMois[2027 * 12 + 1], ['y']);
  assert.equal(r.nonDatees, 0);
});

// « Offilog · adhérentes clientes » : calcul pur (groupements/v2/groupement-bord.js, offilogAdherentesCalc).
const offilogCalc = new Function(fonction(src, 'offilogAdherentesCalc') + ';return offilogAdherentesCalc;')();
const OFF = {
  vm: ['2026-01', '2026-02'],
  v: { '111': [0, 772.12], '999': [50, 0] },
  m: { '111': [1, 1], '222': [1, 0], '333': [0, 1], '555': [1, 0] },
  d: ['2026-01-05', '2026-02-09_corrige_avec_UGA'],
};
const PH = [
  { id: '111', code: '3400', name: 'Zeta' }, { id: 'LST-222', code: '222', name: 'Alpha' },
  { id: 'LST-333', code: '333', name: 'Pas cliente' }, { id: '999', code: '1', name: 'Vendue seule' },
  { id: 'LST-555', code: '555', name: 'Beta' }, { id: 'LST-777', code: '777', name: 'Inconnue' },
];
test('offilogAdherentesCalc : clientes ou chiffre > 0, tri total décroissant puis nom, date lue dans d', () => {
  const r = offilogCalc(OFF, PH);
  assert.deepEqual(r.lignes.map((l) => l.nom), ['Zeta', 'Vendue seule', 'Alpha', 'Beta']);
  assert.deepEqual(r.lignes[0].vals, [0, 772.12]);
  assert.deepEqual(r.lignes[2].vals, [0, 0]);
  assert.equal(r.date, '2026-02-09');
  assert.deepEqual(r.vm, ['2026-01', '2026-02']);
});
test('offilogAdherentesCalc : table absente = null, rapprochement par code (chiffres seuls)', () => {
  assert.equal(offilogCalc(null, PH), null);
  assert.equal(offilogCalc({ vm: [] }, PH), null);
  const r = offilogCalc({ vm: ['2026-03'], v: { '3400': [10] }, m: {}, d: [] }, PH);
  assert.deepEqual(r.lignes.map((l) => l.nom), ['Zeta']);
  assert.equal(r.date, '');
});
