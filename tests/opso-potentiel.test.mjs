// « Le potentiel du catalogue » (tableau de bord OPSO, 17/11/2026) : potentielCalc d'opso-groupement.js, exécuté tel quel.
// Données inventées. Vérifie aussi que le fichier PUBLIC des rotations ne porte que des boîtes (aucun prix, aucun nombre de pharmacies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../opso/v2/opso-groupement.js', import.meta.url), 'utf8');
function fonction(s, nom) {
  const i = s.indexOf('function ' + nom + '('); assert.ok(i >= 0, nom + ' introuvable');
  let p = 0, j = s.indexOf('{', i);
  for (; j < s.length; j++) { if (s[j] === '{') p++; else if (s[j] === '}' && --p === 0) break; }
  return s.slice(i, j + 1);
}
const V2 = { estReste: (id) => String(id) === '0' };
const calc = new Function('V2', fonction(src, 'normCip') + fonction(src, 'potentielCalc') + ';return potentielCalc;')(V2);

const L = [
  { rayon: 'Offre', cip: '3400000000011', nom: 'A', net: 10 },
  { rayon: 'Offre', cip: '', nom: 'Nouveau sans CIP', net: 50 },
  { rayon: 'Remboursables', cip: '3400000000028', nom: 'B', net: 2 },
  { rayon: 'Remboursables', cip: '3400000000035', nom: 'C sans historique', net: 99 },
];
const R = { '3400000000011': [1.5, 3], '3400000000028': [10, 20] };
const vente = (id, cip, qte, extra = {}) => ({ pharmacyId: id, artCode: cip, qte, commercial: 'OPSO', ...extra });

test('totaux : 1 pharmacie, clientes, adhérentes, plafond', () => {
  const P = calc(L, R, [], 10, 20, 129);
  assert.equal(P.produits, 2);
  assert.equal(P.une.b, 11.5);
  assert.equal(P.une.e, 1.5 * 10 + 10 * 2);           // 35 €
  assert.equal(P.act.e, 35 * 20);
  assert.equal(P.adh.e, 35 * 129);
  assert.equal(P.adh.b, 11.5 * 129);
  assert.equal(P.plafond, (3 * 10 + 20 * 2) * 129);
});

test('par rayon et classement des produits sur les adhérentes', () => {
  const P = calc(L, R, [], 10, 20, 129);
  assert.deepEqual(P.rayons.map((r) => [r.rayon, r.n]), [['Offre', 1], ['Remboursables', 1]]);
  assert.equal(P.rayons[1].e, 20 * 129);
  assert.deepEqual(P.top.map((t) => t.nom), ['B', 'A']);
  assert.equal(P.top[1].rot, 3);
});

test('mesuré : ventes grossiste des adhérentes seules, retours déduits, ramenées au mois', () => {
  const S = [
    vente('p1', '3400000000011', 4), vente('p1', '3400000000011', -1),   // retour déduit
    vente('p2', '3400000000028', 5),
    { pharmacyId: 'p3', artCode: '3400000000028', qte: 100 },             // ligne reconstituée (sans commercial) : ignorée
    vente('0', '3400000000028', 100),                                     // reste du réseau : ignoré
    vente('p1', '3400000000099', 7),                                      // hors catalogue : ignoré
  ];
  const P = calc(L, R, S, 10, 20, 129);
  assert.equal(P.mesure, (3 * 10 + 5 * 2) / 10);
});

test('fichier public des rotations : des boîtes seulement', () => {
  const t = readFileSync(new URL('../opso/v2/opso-rotations-data.js', import.meta.url), 'utf8');
  const w = {}; new Function('window', t)(w);
  const O = w.OPSO_ROTATIONS;
  assert.deepEqual(Object.keys(O).sort(), ['maj', 'periode', 'r']);
  assert.ok(Object.keys(O.r).length > 100);
  for (const [cip, v] of Object.entries(O.r)) {
    assert.match(cip, /^\d{13}$/);
    assert.ok(Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && x >= 0), cip);
    assert.ok(v[1] + 1e-9 >= v[0], 'rotation d\'une pharmacie qui le commande ≥ moyenne du réseau : ' + cip);
  }
  assert.doesNotMatch(t.slice(t.indexOf('window.OPSO_ROTATIONS')), /prix|€|net|pharma/i);   // les données, pas l'en-tête
});
