// 23/11/2026 — Will, questions cliquées : la Mallette ne propose plus l'« Offre 2026 » de 9 pages (périmée), ni les deux documents
// nominatifs écartés des Documents commerciaux (« pas de fiches prospection nominative ») : la Présentation (p. 7 au nom et au
// portable de Pascale) et la Plaquette de prospection (coordonnées de Pauline G.). Ce test garde qu'ils ne reviennent pas,
// et que la Mallette ne coche plus d'office que l'ouverture de compte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../crm/v2/v2-mallette.js', import.meta.url), 'utf8');
const code = js.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');   // les commentaires racontent le retrait : on ne lit que le code

test('Mallette : ni l Offre 2026 de 9 pages, ni les deux documents nominatifs', () => {
  for (const x of ["'offre-2026'", 'OFFRE V1 2026', "'presentation-groupements'", 'Presentation-Integral-Pharma-groupements', "'plaquette-prospection'", 'IP PROSPECTION PGN']) {
    assert.ok(!code.includes(x), '« ' + x + ' » est revenu dans la Mallette');
  }
});

test('Mallette : seule l ouverture de compte est cochée d office', () => {
  assert.match(code, /S\.sel = \['ouverture-compte'\]\.filter\(function \(i\) \{ return !!doc\(i\); \}\);/);
});
