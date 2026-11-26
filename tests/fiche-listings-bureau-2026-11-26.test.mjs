// 26/11/2026 — planche « ordinateur », Fiche officine B7 v1 : les deux listings passent au poids d'un bouton à l'ordinateur ; le téléphone garde ses tuiles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../crm/v2/v2.css', import.meta.url), 'utf8');
const i = css.indexOf("/* 26/11/2026 (Will, planche ordinateur B7 v1)");
const bloc = css.slice(i, css.indexOf('\n}\n', i) + 3);

test('B7 v1 : au-dessus de 640 px, les listings sont des boutons à contour (fond blanc), plus de bleu plein ni de flèche', () => {
  assert.ok(i > 0, 'bloc B7 introuvable');
  assert.match(bloc, /@media \(min-width:641px\)\{/);
  assert.match(bloc, /\.flg-b\{[^}]*background-image:none;background-color:#FFFFFF/);
  assert.match(bloc, /\.flg-fl\{display:none\}/);
  assert.ok(!/backdrop-filter|blur\(/.test(bloc), 'aucun effet interdit sous Safari');
});

test('B7 v1 : le téléphone garde ses tuiles bleues (règles ≤ 640 px d\'avant, non touchées)', () => {
  assert.match(css, /@media \(max-width:640px\)\{\s*\.pha-wrap\.fdr-on \.flg\{margin:10px 0 0\}/);
  assert.match(css, /radial-gradient\(240px 130px at 100% 0,#3D7EF6 0,#1A63F0 45%,#0050E6 100%\) #0050E6/);
});
