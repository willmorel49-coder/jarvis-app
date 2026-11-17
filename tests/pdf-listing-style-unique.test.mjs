/* pdf-listing-style-unique.test.mjs — plus de choix de style pour les listings PDF (17/11/2026, décision de Will) :
 * tout le monde a le style 1 « L'essentiel », quoi que l'appareil ait gardé en mémoire (certains avaient le 5). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const pdf = readFileSync(new URL('../crm/v2/v2-pdf-prospect.js', import.meta.url), 'utf8');
const ph = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const a = pdf.indexOf("var CLE = 'jarvis.pdfProspectStyle';"), b = pdf.indexOf('function styleEcrit(');
assert.ok(a > 0 && b > a, 'styleLu introuvable');
const lire = (valeur) => { const ctx = { localStorage: { getItem: () => valeur } }; vm.runInNewContext(pdf.slice(a, b) + '\nthis.f = styleLu;', ctx); return ctx.f(); };

test('styleLu : toujours 1, quel que soit le localStorage', () => {
  for (const v of [null, '1', '2', '3', '4', '5', 'x', '']) assert.equal(lire(v), 1, 'mémoire = ' + v);
  const ctx = { localStorage: { getItem: () => { throw new Error('bloqué'); } } };
  vm.runInNewContext(pdf.slice(a, b) + '\nthis.f = styleLu;', ctx); assert.equal(ctx.f(), 1, 'stockage bloqué');
});
test('l’aperçu ne propose plus de rangée « Style : » ; télécharger / partager / Outlook restent', () => {
  assert.ok(!pdf.includes('pdfp-styles') && !pdf.includes('Style :'));
  for (const id of ['pdfp-dl', 'pdfp-sh', 'pdfp-ol', 'pdfp-x']) assert.ok(pdf.includes(id), id);
});
test('la fenêtre Transmettre ne propose plus de style et la note de trace n’en porte plus', () => {
  assert.ok(!ph.includes('Style des listings PDF') && !ph.includes('pharmaTxStyle') && !ph.includes('txStyleNote'));
  assert.ok(ph.includes('pharmaTxApercu'), 'le bouton « Voir l’aperçu » reste');
});
test('le code des styles 2 à 5 reste en place (dormant)', () => {
  assert.ok(pdf.includes("{ id: 5, nom: 'Par où commencer' }") && /function construire\(/.test(pdf));
});
