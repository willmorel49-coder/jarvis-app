// La carte (26/10/2026) : ouvrir une officine depuis la Liste centre et zoome la carte sur elle, dans la partie visible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const carte = readFileSync(new URL('../crm/v2/v2-carte.js', import.meta.url), 'utf8');

test('Liste : un clic sur la ligne passe par carteLocate (fiche + recentrage), plus par carteFiche seule', () => {
  assert.match(carte, /'<div class="cn-lmain" onclick="V2\.carteLocate\(' \+ i \+ '\)">'/);
  assert.doesNotMatch(carte, /'<div class="cn-lmain" onclick="V2\.carteFiche\(/);
});

// carteLocate rejoué avec une fausse carte : on relève l'appel fitBounds et son rembourrage.
const src = carte.slice(carte.indexOf('V2.carteLocate = function'), carte.indexOf('function statusLabel('));
function rejoue(conteneur, fiche) {
  const appels = { fiche: [], fit: null };
  const V2 = { carteFiche: (i) => appels.fiche.push(i) };
  const map = { invalidateSize: (o) => { appels.taille = o; }, getContainer: () => ({ getBoundingClientRect: () => conteneur }), fitBounds: (b, o) => { appels.fit = { b, o }; } };
  const document = { getElementById: (id) => (id === 'cn-fiche' && fiche ? { getBoundingClientRect: () => fiche } : null) };
  const window = { L: { latLngBounds: (x) => x } };
  const D = { p: { 3: [42.7, 2.9] } };
  let differe = null;
  const setTimeout = (fn) => { differe = fn; };
  new Function('V2', 'map', 'document', 'window', 'D', 'setTimeout', src)(V2, map, document, window, D, setTimeout);
  V2.carteLocate(3);
  if (differe) differe();
  return appels;
}
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

test('ordinateur : volet de 400 px à droite → rembourrage à droite, point centré à gauche de la fiche, zoom 15', () => {
  const a = rejoue(rect(0, 218, 1440, 682), rect(1028, 230, 400, 658));
  assert.deepEqual(a.fiche, [3]);
  assert.deepEqual(a.fit.b, [[42.7, 2.9], [42.7, 2.9]]);
  assert.deepEqual(a.fit.o.paddingBottomRight, [412, 0]);
  assert.equal(a.fit.o.maxZoom, 15);
  assert.deepEqual(a.taille, { pan: false });   // taille de la carte remesurée avant de centrer
});
test('téléphone : tiroir en bas sur toute la largeur → rembourrage en bas, point centré au-dessus du tiroir', () => {
  const a = rejoue(rect(0, 300, 390, 544), rect(0, 365, 390, 479));
  assert.deepEqual(a.fit.o.paddingBottomRight, [0, 479]);
});
test('fenêtre étroite côté ordinateur (volet plus large que la moitié de la carte) : reste un volet à droite', () => {
  const a = rejoue(rect(0, 200, 780, 500), rect(368, 212, 400, 476));
  assert.deepEqual(a.fit.o.paddingBottomRight, [412, 0]);
});
test('pas de fiche posée : centrage simple, sans rembourrage', () => {
  const a = rejoue(rect(0, 200, 1000, 600), null);
  assert.deepEqual(a.fit.o.paddingBottomRight, [0, 0]);
});
