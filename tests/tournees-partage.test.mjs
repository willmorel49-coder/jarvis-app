// Réglages communs des écrans de tournées (crm/v2/v2-tournees-partage.js, 27/11/2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../crm/v2/v2-tournees-partage.js');

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = h => { const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };

test('palette : 12 couleurs, texte blanc lisible (≥ 4,5:1) sur chacune', () => {
  assert.equal(P.PALETTE.length, 12);
  assert.equal(new Set(P.PALETTE).size, 12);
  for (const c of P.PALETTE) assert.ok(contraste(c, '#FFFFFF') >= 4.5, c + ' : ' + contraste(c, '#FFFFFF').toFixed(2));
  assert.ok(contraste(P.SANS, '#FFFFFF') >= 4.5);
});

test('couleurs() : une couleur par code, distinctes jusqu’à 12, reprise au début au-delà', () => {
  const codes = Array.from({ length: 14 }, (_, i) => 'T' + (i + 1));
  const m = P.couleurs(codes);
  assert.equal(new Set(codes.slice(0, 12).map(c => m[c])).size, 12);
  assert.equal(m.T13, m.T1);
  assert.deepEqual(P.couleurs(['T10', 'T10', 'T11']), { T10: P.PALETTE[0], T11: P.PALETTE[1] });
  assert.deepEqual(P.couleurs(null), {});
});

test('dépôt SOP : mêmes coordonnées que la carte (crm/v2/v2-carte.js, DEPOTS)', () => {
  const src = fs.readFileSync(new URL('../crm/v2/v2-carte.js', import.meta.url), 'utf8');
  const m = src.match(/\{ s: 'SOP',[^}]*lat: ([\d.]+), lng: ([\d.]+) \}/);
  assert.ok(m, 'ligne SOP trouvée dans v2-carte.js');
  assert.equal(P.DEPOTS_SANS_TOURNEES.SOP.lat, Number(m[1]));
  assert.equal(P.DEPOTS_SANS_TOURNEES.SOP.lng, Number(m[2]));
});

test('livrables SOP : les 2 officines décidées par Will, toutes deux adhérentes Essentiels Pharma', () => {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('../crm/v2/groupement-alias.js', import.meta.url), 'utf8'), ctx);
  assert.deepEqual(P.LIVRABLES.SOP, ['2080814', '2016822']);
  for (const c of P.LIVRABLES.SOP) assert.equal(ctx.window.GRP_DEPART[c], 'Essentiels Pharma', c);
});

test('groupements suivis : noms canoniques de la table des alias', () => {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('../crm/v2/groupement-alias.js', import.meta.url), 'utf8'), ctx);
  const canon = new Set(Object.values(ctx.window.GRP_ALIAS));
  assert.deepEqual(P.GROUPEMENTS_SUIVIS, ['OPSO Santé', 'Essentiels Pharma']);
  for (const g of P.GROUPEMENTS_SUIVIS) assert.ok(canon.has(g), g);
});
