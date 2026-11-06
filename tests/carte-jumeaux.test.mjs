// Jumeaux annuaire / cliente (06/11/2026, décision de Will) : V2.reconcilePharma fusionne les 46 paires écrites de V2.JUMEAUX
// en UNE ligne cliente. Rejoue la VRAIE règle (extraite de v2-app.js) sur les vraies données versionnées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const R = new URL('../crm/v2/', import.meta.url);
const lire = f => fs.readFileSync(new URL(f, R), 'utf8');
const app = lire('v2-app.js');
const code = app.slice(app.indexOf('  V2.JUMEAUX = {'), app.indexOf('  V2.pfPoser = function'));
function session(jumeaux) {
  const g = { window: {} }; g.window.window = g.window;
  new Function('window', lire('pharma-fr-data.js') + ';' + lire('wml-officines-data.js') + ';window.WML_OFFICINES=WML_OFFICINES;')(g.window);
  const V2 = { seuilsPalier: () => ({ a: 40000, b: 12000, mois: 8 }), canonGrp: n => n, pfPoser: (p, c, v) => { p[c] = v; } };
  new Function('V2', 'window', code)(V2, g.window);
  if (jumeaux === false) V2.JUMEAUX = {};
  V2.reconcilePharma(true);
  const D = g.window.PHARMA_FR, seg = p => D.seg[p[4]];
  return { V2, D, seg, prospects: D.p.filter(p => seg(p) === 'Prospect').length, lignes: id => D.p.filter(p => String(p[13]) === id) };
}
test('47 paires (46 + Porte d\'Azur), 47 clientes distinctes, aucune des 6 douteuses', () => {
  const J = session().V2.JUMEAUX, cles = Object.keys(J);
  assert.equal(cles.length, 47); assert.equal(new Set(Object.values(J)).size, 47);
  for (const d of ['2278924', '2070696', '2013740', '2176993', '2276005', '2000952', '2007087', '2013223']) assert.equal(J[d], undefined, d);
});
test('le nombre de prospects baisse d\'exactement 47', () => {
  assert.equal(session(false).prospects - session().prospects, 47);
});
test('les 3 connues : une seule ligne, cliente, ancien code gardé ; l\'ancien code ne répond plus', () => {
  const s = session();
  for (const [ann, cli] of [['440014009', '2011018'], ['2013862', '2023211'], ['2009403', '2126722']]) {
    const l = s.lignes(cli); assert.equal(l.length, 1, cli);
    assert.match(s.seg(l[0]), /^Client [ABC]$/); assert.equal(l[0]._ann, ann);
    assert.equal(s.lignes(ann).length, 0); assert.equal(s.V2.codeAnnuaire(cli), ann);
  }
});
test('les 6 douteuses restent comme avant (prospect sous leur code annuaire)', () => {
  const s = session(), t = session(false);
  for (const d of ['2278924', '2070696', '2013740', '2276005', '2007087', '2013223']) {
    assert.equal(s.lignes(d).length, 1, d); assert.equal(s.seg(s.lignes(d)[0]), t.seg(t.lignes(d)[0]), d);
  }
});
test('repasser la règle ne change plus rien (idempotent)', () => {
  const s = session(); const avant = s.D.p.map(p => p[13] + '|' + p[4]).join(); s.V2.reconcilePharma(true);
  assert.equal(s.D.p.map(p => p[13] + '|' + p[4]).join(), avant);
});
