// 25/11/2026 — téléphone de 360 px : le tableau « Comparaison à nos clients » de la fiche officine débordait encore de 10 à 22 px
// après A·FIC-1 (mesuré au banc : 292 à 304 px de tableau dans 282, colonne « Écart » coupée). Sous 380 px, le tableau reprend 8 px
// de la marge intérieure du cadre de chaque côté, cases et pastilles se resserrent (mesuré ensuite : 0 px à faire glisser).
// Ce test vérifie que ces règles existent, sous 380 px seulement, et que l'ordinateur n'en reçoit aucune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../crm/v2/v2-fiche-tel.css', import.meta.url), 'utf8');
const i = css.indexOf('@media (max-width:380px){.pha-wrap.fdr-on .fdr-comp .fdr-tw');
const bloc = i < 0 ? '' : css.slice(i, css.indexOf('}}', i) + 2);

test('le bloc 380 px du tableau de comparaison existe', () => { assert.ok(i > 0, 'bloc introuvable'); });
test('le tableau reprend 8 px de chaque côté', () => {
  assert.match(bloc, /\.fdr-comp \.fdr-tw\{margin-left:-8px;margin-right:-8px\}/);
});
test('cases et pastilles se resserrent', () => {
  assert.match(bloc, /\.fdr-tbl td\{padding-left:2px;padding-right:2px\}/);
  assert.match(bloc, /\.fdr-ec\{min-width:0;padding-left:4px;padding-right:4px\}/);
});
test('le bloc est à l\'intérieur du bloc téléphone de 640 px (l\'ordinateur ne change pas)', () => {
  const debut = css.indexOf('@media (max-width:640px){');
  assert.ok(debut >= 0 && debut < i, 'bloc 640 px absent ou après');
  let prof = 0;
  for (let k = debut; k < i; k++) { if (css[k] === '{') prof++; else if (css[k] === '}') prof--; }
  assert.equal(prof, 1, 'le bloc 380 px doit être imbriqué dans le bloc 640 px');
});
