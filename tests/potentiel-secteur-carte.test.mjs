// La carte · Quartiers INSEE (30/10/2026) : chargement à la demande, couches, reset du calcul, arrêts de tournée sans coordonnées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (f) => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const carte = lire('v2-carte.js');

test('les 3,8 Mo ne partent pas au démarrage : ni dans index.html, ni dans le socle du service worker', () => {
  for (const f of ['index.html', 'sw.js']) assert.doesNotMatch(lire(f), /potentiel-secteur/);
  assert.match(carte, /s\.src = 'potentiel-secteur-data\.js' \+ QV/);
  assert.match(carte, /ensureQuartiers\(drawQuartiers\)/);
});

test('changer de mesure ou couper les zones retire la couche des quartiers', () => {
  const dz = carte.slice(carte.indexOf('function drawZones()'), carte.indexOf('ensureDeps(function () {', carte.indexOf('function drawZones()')));
  assert.ok(dz.indexOf('map.removeLayer(qLayer)') < dz.indexOf('if (!zonesOn) return'));
  assert.match(carte, /else \{ drawZones\(\); rebuild\(\); \}/);
});

test('recaler() réinitialise le calcul quand les clients CRM s\'ajoutent, sans jamais lire le champ ca', () => {
  const r = carte.slice(carte.indexOf('function recaler()'), carte.indexOf('V2.carteRecalage = function'));
  assert.ok(r.indexOf('ajouterClientsSansPoint()') < r.indexOf('qDonneesChangees()'));
  assert.match(carte, /V2\.potentielSecteur\.reset\(\); qCache = \{\};/);
  assert.doesNotMatch(lire('v2-potentiel-secteur.js').replace(/\/\/.*$|^\s*\*.*$/gm, ''), /\bp\[12\]/);
});

// arretsValides rejoué tel quel, avec une fausse base.
const src = carte.slice(carte.indexOf('function arretsValides(a)'), carte.indexOf('function loadTour()'));
function rejoue(arrets, p) {
  const toasts = [], V2 = { toast: (t) => toasts.push(t) };
  return { ok: new Function('V2', 'D', src + '; return arretsValides;')(V2, { p })(arrets), toasts };
}

test('arrêt sans coordonnées : position reprise dans la base si on le retrouve, sinon retiré et signalé', () => {
  const sain = { n: 'A', lat: 47.4, lng: -0.5, id: '1' };
  const { ok, toasts } = rejoue([sain, { n: 'B', id: '2' }, { n: 'C', id: '9' }, { n: 'D' }, null], [[47.5, -0.6, 0, 0, 0, 0, 'B', '', '', '', '', '', 0, '2']]);
  assert.deepEqual(ok.map((s) => s.n), ['A', 'B']);
  assert.equal(ok[1].lat, 47.5);
  assert.equal(ok[1].lng, -0.6);
  assert.deepEqual(toasts, ['3 arrêts sans position retirés de la tournée']);
});

test('tournée saine : rien ne change et aucun message', () => {
  const { ok, toasts } = rejoue([{ n: 'A', lat: 47.4, lng: -0.5, id: '1' }], []);
  assert.equal(ok.length, 1);
  assert.equal(toasts.length, 0);
  assert.deepEqual(rejoue('pas un tableau', []).ok, []);
});
