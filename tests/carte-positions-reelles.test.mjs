// Positions réelles de la carte (27/11/2026, choix de Will « toute la France ») : chaque officine reliée avec certitude
// à sa fiche FINESS est posée à son adresse officielle (positions_reelles.json, fabriqué par positions_reelles.py).
// Ce test rouge = une régénération de pharma-fr-data.js a remis des officines au centre de leur commune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const g = {};
new Function('window', lire('crm/v2/pharma-fr-data.js'))(g);
const P = g.PHARMA_FR.p;
const table = JSON.parse(lire('positions_reelles.json')).pos;
const build = lire('build_pharma_fr.py');
const corrigees = {};
for (const m of build.slice(build.indexOf('POSITIONS_CORRIGEES = {'), build.indexOf('\n}\n', build.indexOf('POSITIONS_CORRIGEES = {')))
  .matchAll(/'(\w+)': \(([-\d.]+), ([-\d.]+)\)/g)) corrigees[m[1]] = [Number(m[2]), Number(m[3])];

test('la table couvre le gros de la carte (plus de 17 000 officines)', () => {
  assert.ok(Object.keys(table).length > 17000, String(Object.keys(table).length));
  assert.ok(Object.keys(corrigees).length >= 34);
});

test('chaque officine de la table est sur la carte à sa position réelle (corrections à la main prioritaires)', () => {
  const fausses = [];
  for (const p of P) {
    const id = String(p[13]), cible = corrigees[id] || table[id];
    if (cible && (p[0] !== cible[0] || p[1] !== cible[1])) fausses.push(id);
  }
  assert.deepEqual(fausses.slice(0, 10), [], fausses.length + ' officines hors de leur position réelle');
});

test('le programme de la carte relit la table, avant les corrections à la main', () => {
  const a = build.indexOf('EX.update(positions_reelles())'), b = build.indexOf('EX.update(POSITIONS_CORRIGEES)');
  assert.ok(a > 0 && b > a);
});

test('Pharmacie du Thouet (Saumur) au 51 bd du Maréchal de Lattre de Tassigny, pas au centre de Saumur', () => {
  const p = P.find(x => String(x[13]) === '2279142');
  assert.deepEqual([p[0], p[1]], [47.26224, -0.09099]);
});

test('aucun point hors de la France métropolitaine', () => {
  assert.equal(P.filter(p => !(p[0] >= 41 && p[0] <= 51.6 && p[1] >= -5.5 && p[1] <= 9.8)).length, 0);
});

// 27/11/2026, 2e passe (choix de Will) : double preuve (même téléphone dans la commune, ou nom + titulaire RPPS sur la même fiche)
// et 37 non-officines écartées (_NON_PH_IDS). Les médecins propharmaciens (« CABINET MEDICAL » série 265xxxx) restent.
const parId = Object.fromEntries(P.map(p => [String(p[13]), p]));
test('double preuve : les deux Pharmacies Necker (Paris 15e) ne sont plus inversées, Les Andelys au 50 av. de la République', () => {
  assert.deepEqual(parId['2053424'].slice(0, 2), [48.84225, 2.31357]);   // 47 bd Pasteur, tél. 01 47 83 69 27
  assert.deepEqual(parId['2192161'].slice(0, 2), [48.84512, 2.31955]);   // 38 bd du Montparnasse, tél. 01 42 22 31 15
  assert.deepEqual(parId['2089911'].slice(0, 2), [49.24396, 1.40527]);
  assert.ok(Object.keys(table).length >= 18153, String(Object.keys(table).length));
});

test('les non-officines écartées ne sont plus sur la carte, les médecins propharmaciens y restent', () => {
  const ids = build.slice(build.indexOf('_NON_PH_IDS = {'), build.indexOf('\n}\n', build.indexOf('_NON_PH_IDS = {')));
  const exclus = [...ids.matchAll(/'(\w+)',/g)].map(m => m[1]);
  assert.ok(exclus.length >= 38, String(exclus.length));
  assert.deepEqual(exclus.filter(id => parId[id]), []);
  assert.equal(P.filter(p => /^(CERP |ALLIANCE HEALTHCARE|PHOENIX OCP|MEGAPARA)/.test(p[6])).length, 0);
  assert.ok(P.filter(p => String(p[13]).startsWith('265') && p[6] === 'CABINET MEDICAL').length >= 40);
});

// 27/11/2026, 4e passe (choix de Will) : l'annuaire des entreprises comme 2e source — nom + titulaire (dirigeant actuel) sur la même
// fiche FINESS libre, société active ; le nom doit concorder par un autre mot que le nom du pharmacien (« Pharmacie Dupont » = titulaire seul).
test('annuaire : Pharmacie du Parc des Princes et Pharmacie Bichat (Paris) à leur adresse, « Pharmacie Vanbremeersch » (titulaire seul) pas déplacée', () => {
  assert.deepEqual(parId['2053801'].slice(0, 2), [48.84021, 2.25607]);   // enseigne « Pharmacie du Parc des Princes » de la SELARL Pharmacie Levy Teboul
  assert.deepEqual(parId['2054407'].slice(0, 2), [48.89794, 2.33489]);   // enseigne « Pharmacie Bichat » de la Pharmacie Maarek
  assert.equal(table['2001079'], undefined);
  assert.ok(Object.keys(table).length >= 18275, String(Object.keys(table).length));
});
