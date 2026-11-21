// Barres des génériqueurs en tons froids (21/11/2026, choix de Will : aucun jaune, orange, rouge ni rose).
// On lit les couleurs dans le graphique RÉELLEMENT produit (vrai code, fausse fenêtre), sur les deux rendus :
// fiche officine (opts.fdr, avec la ligne « Autres ») et Pilotage (12 lignes au plus).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = globalThis;
globalThis.document = { getElementById: () => ({}), createElement: () => ({}), head: { appendChild() {} } };
// 14 laboratoires inventés, montants inventés et décroissants : les 12 couleurs sortent, puis la ligne « Autres ».
const labos = Array.from({ length: 14 }, (_, i) => 'Labo ' + String.fromCharCode(65 + i));
globalThis.GENERIQUEURS = Object.fromEntries(labos.map((l, i) => [String(1000 + i), l]));
require('../crm/v2/v2-generiqueurs.js');
const V2 = globalThis.V2;
const ventes = labos.map((_, i) => ({ artCode: String(1000 + i), mntNetHt: i < 12 ? 2000 - i * 100 : 5 }));

const couleurs = (html) => [...html.matchAll(/background:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1].toUpperCase());
function teinte(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, sat };
}
// Chaud = du rouge au jaune (0° à 80°) ou du magenta au rose (300° à 360°), dès qu'il y a de la couleur. Un gris passe.
const chaud = (hex) => { const { h, sat } = teinte(hex); return sat >= 0.15 && (h < 80 || h >= 300); };

test('le contrôle reconnaît bien les tons chauds (cas connus)', () => {
  for (const c of ['#C7A11A', '#E08A1B', '#EA6A2C', '#D9553F', '#B4476B', '#FFE9C2']) assert.ok(chaud(c), c + ' devrait être chaud');
  for (const c of ['#0050E6', '#00A9B5', '#5BA83C', '#7C4FC4', '#8A94A6']) assert.ok(!chaud(c), c + ' devrait être froid');
});

test('Pilotage : 12 barres, 12 couleurs différentes, aucune chaude', () => {
  const c = couleurs(V2.generiqueurCard(ventes, { max: 12 }));
  assert.equal(c.length, 12);
  assert.equal(new Set(c).size, 12);
  assert.deepEqual(c.filter(chaud), []);
});

test('fiche officine : toutes les barres, ligne « Autres » comprise, sans ton chaud', () => {
  const html = V2.generiqueurCard(ventes, { fdr: true, max: 12 });
  assert.match(html, /Autres génériqueurs/);
  const c = couleurs(html);
  assert.ok(c.length >= 12, 'au moins 12 barres, vu ' + c.length);
  assert.deepEqual(c.filter(chaud), []);
});
