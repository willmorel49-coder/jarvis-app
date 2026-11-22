// 22/11/2026 — Officines au téléphone : « Commercial : Tous » était coupé (137 px de texte pour 117 px à 360 px, banc WebKit).
// Le menu Commercial et le Tri prennent chacun une ligne entière SOUS 640 px ; l'ordinateur ne change pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../crm/v2/v2.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Le bloc @media du téléphone qui porte les règles d'Officines (celui qui pose la hauteur 46 px des filtres).
function blocTelephoneOfficines() {
  const re = /@media \(max-width: 640px\) \{/g; let m;
  while ((m = re.exec(css))) {
    let n = 0, i = m.index + m[0].length - 1;
    for (; i < css.length; i++) { if (css[i] === '{') n++; else if (css[i] === '}' && --n === 0) break; }
    const b = css.slice(m.index, i + 1);
    if (b.includes('html:root:root body .ofl .v2-select { height: 46px')) return b;
  }
  assert.fail('bloc téléphone d\'Officines introuvable dans v2.css');
}

test('Officines au téléphone : Commercial et Tri prennent une ligne entière', () => {
  const b = blocTelephoneOfficines();
  assert.match(b, /html:root:root body \.ofl \.ofl-filtres > \.v2-select, \.ofl-filtres > \.ofl-sel:nth-last-of-type\(1\) \{ flex-basis: 100%; \}/);
});

test('Officines à l\'ordinateur : aucune règle « flex-basis: 100% » sur les filtres hors du bloc téléphone', () => {
  const b = blocTelephoneOfficines();
  const hors = css.replace(b, '');
  assert.doesNotMatch(hors, /\.ofl-filtres > [^{]*\{[^}]*flex-basis: 100%/);
});
