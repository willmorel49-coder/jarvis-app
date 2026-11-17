// « Mois par mois » OPSO (17/11/2026) : calcul des nouvelles pharmacies (opso/v2/opso-groupement.js, nouvellesParMois).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(join(RACINE, 'opso/v2/opso-groupement.js'), 'utf8');
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
