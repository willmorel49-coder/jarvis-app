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

// Barres 1 à 3 bien distinctes (21/11/2026, choix de Will « trois bleus écartés ») : écart OKLab ×100,
// même calcul que le contrôle de palette de la skill dataviz ; une barre se distingue de sa voisine à partir de 15.
const s2lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklab(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => s2lin(parseInt(hex.slice(k, k + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
const ecart = (x, y) => { const a = oklab(x), b = oklab(y); return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };

test('le calcul d’écart rend les valeurs connues (anciennes barres 1 à 3)', () => {
  assert.equal(ecart('#0050E6', '#1E6FE6').toFixed(1), '7.6');
  assert.equal(ecart('#1E6FE6', '#2C86D8').toFixed(1), '6.9');
});

test('Pilotage et fiche : les barres 1 à 4 se distinguent chacune de leur voisine', () => {
  for (const opts of [{ max: 12 }, { fdr: true, max: 12 }]) {
    const c = couleurs(V2.generiqueurCard(ventes, opts));
    for (let i = 0; i < 3; i++) assert.ok(ecart(c[i], c[i + 1]) >= 15, `barres ${i + 1} et ${i + 2} trop proches : ${c[i]} ${c[i + 1]} (${ecart(c[i], c[i + 1]).toFixed(1)})`);
  }
});

// Montants en euros entiers dans la carte, même sous 1 000 € (21/11/2026). Le formatage commun de la page
// (V2.fmtEur, lu tel quel dans v2-boot.js) écrit les centimes sous 1 000 € : on le charge pour rejouer la vraie page.
test('montants en euros entiers, même sous 1 000 €', async () => {
  const { readFileSync } = await import('node:fs');
  const boot = readFileSync(new URL('../crm/v2/v2-boot.js', import.meta.url), 'utf8');
  const src = boot.match(/V2\.fmtEur = function \(n\) \{[\s\S]*?\n  \};/);
  assert.ok(src, 'V2.fmtEur introuvable dans v2-boot.js');
  const avant = V2.fmtEur;
  new Function('V2', src[0])(V2);
  try {
    assert.equal(V2.fmtEur(424.4), '424,40 €', 'le formatage commun écrit bien les centimes (sinon ce test ne prouve rien)');
    const v = [{ artCode: '1000', mntNetHt: 424.4 }, { artCode: '1001', mntNetHt: 1234.56 }];
    const html = V2.generiqueurCard(v, { fdr: true, max: 12 }) + V2.generiqueurCard(v, { max: 12 });
    assert.doesNotMatch(html, /\d,\d\d €/);
    assert.match(html, /424 €/);
  } finally { V2.fmtEur = avant; }
});
