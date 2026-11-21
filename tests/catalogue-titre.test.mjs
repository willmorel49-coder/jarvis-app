/* catalogue-titre.test.mjs — le titre du Catalogue produits a la même taille que celui des autres écrans
 *
 * 21/11/2026 ~22 h 53 — Will, choix cliqué : au téléphone, « Catalogue produits » s'affichait en 23 px
 * (v2-comptoir.js, sous 561 px ; 26 px sous 1 001 px) quand Infos, To do et Pilotage font 35 px
 * (clamp(32px,9vw,40px) : 40 px sur ordinateur, 9 % de la largeur au téléphone).
 * La taille au pixel se mesure sous WebKit (banc local) : ici, la règle commune et sa portée.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'crm', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');
const COMMUNE = 'font-size:clamp(32px,9vw,40px)';

test('les titres des autres écrans ont bien la taille commune (marqueur positif)', () => {
  assert.ok(lire('v2-infos-m1.css').includes('.aube-tete.inf-t-tete .v2-page-title{margin:0;' + COMMUNE), 'Infos');
  assert.ok(lire('v2-todo-m1.css').includes('.td-m1 .td-hd .td-h1{margin:0;font:800 clamp(32px,9vw,40px)'), 'To do');
  assert.ok(lire('v2.css').includes('.pa-wrap .aube-tete .v2-page-title{margin:0;' + COMMUNE), 'Pilotage');
});

test('Catalogue produits : la même taille, à toutes les largeurs, plus forte que celle de v2-comptoir.js', () => {
  const css = lire('v2.css');
  const i = css.indexOf('MÊME HAUT (Will, choix cliqué)'); assert.ok(i > 0, 'le bloc « même haut » de v2.css');
  const bloc = css.slice(i, css.indexOf('/* 2. Chiffres en encre', i));
  const m = /\n(html:root:root body \.cpd-head \.cpd-h1)\{([^}]*)\}/.exec(bloc);
  assert.ok(m, 'une règle du titre du Catalogue dans le bloc « même haut »');
  assert.ok(m[2].startsWith(COMMUNE), 'la taille commune (35 px au téléphone au lieu de 23)');
  const avant = bloc.slice(0, m.index).split('\n');
  assert.doesNotMatch(avant[avant.length - 1], /@media/, 'hors de toute condition de largeur (tablette : 26 px avant)');
  // v2-comptoir.js garde ses tailles à lui (.cpd-h1, une seule classe) : la règle commune doit les battre
  assert.match(lire('v2-comptoir.js'), /\.cpd-h1\{font-size:23px\}/, 'la taille d\'origine du téléphone (marqueur : rien n\'a bougé de ce côté)');
});
