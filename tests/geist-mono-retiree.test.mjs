// 22/11/2026 — Geist Mono retirée des écrans (choix de Will) : --mono prend la police du texte, et les écrans n'écrivent plus « Geist Mono » en clair.
// Les PDF (v2-pdf-prospect.js, les MONO des PDF de v2-pharma.js / v2-concurrents.js / v2-listings2027.js) restent hors écran, donc hors de ce test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (f) => readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');

test('v2.css : --mono reprend --font, plus de Geist', () => {
  const css = lire('v2.css');
  assert.match(css, /--mono:\s*var\(--font\)/);
  assert.ok(!/Geist/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'Geist est encore écrite dans v2.css');
});

test('écrans : aucune règle de style en Geist Mono dans carte, comptoir, produits', () => {
  for (const f of ['v2-carte.js', 'v2-comptoir.js', 'v2-produits.js']) assert.ok(!/Geist/.test(lire(f)), f + ' écrit encore Geist');
});

test('chiffres en colonnes : les règles qui lisent --mono ont tabular-nums', () => {
  const manques = [];
  for (const f of ['v2.css', 'v2-marche-fr.js', 'v2-catalogue.js', 'v2-copilote.js', 'v2-molecules.js', 'v2-groupements.js']) {
    const s = lire(f);
    for (const m of s.matchAll(/var\(--mono/g)) {
      const a = s.lastIndexOf('{', m.index), b = s.indexOf('}', m.index);
      if (a >= 0 && b > a && !/tabular-nums/.test(s.slice(a, b))) manques.push(f + ' @' + s.slice(Math.max(a - 30, 0), a + 20).replace(/\s+/g, ' '));
    }
  }
  assert.deepEqual(manques, []);
});
