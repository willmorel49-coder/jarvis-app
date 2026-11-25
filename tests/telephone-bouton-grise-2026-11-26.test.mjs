// 26/11/2026 — téléphone : un bouton principal grisé restait BLEU avec un texte gris (audit du 25/11, A·CAM-1, « Sélectionnez des officines » de la Campagne).
// Cause : la règle « bouton principal : bleu à lumière » de v2.css pèse plus lourd que la règle « désactivé » : le dégradé restait, seul le texte devenait gris.
// Corrigé AU TÉLÉPHONE seulement (v2-tel.css, sous 640 px) : à l'ordinateur le même défaut reste, c'est un choix à montrer à Will, pas à ce test de le trancher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lire, regles, trouve, sousTelephone, poids, compare, contraste } from './aide-css-telephone.mjs';

const tel = regles(lire('v2-tel.css')), base = regles(lire('v2.css')), page = lire('index.html');
const GRISE = 'html:not([data-hab]) .v2-btn-primary:is(:disabled,[disabled],[aria-disabled="true"])';
const variable = (nom) => {
  const r = trouve(base, ':root').find(x => x.decl.includes(nom + ':') && !x.medias.length);
  assert.ok(r, nom + ' défini dans :root de v2.css');
  return new RegExp(nom + ':(#[0-9A-Fa-f]{6})').exec(r.decl)[1];
};

test('étalonnage : contraste et poids rendent les valeurs connues', () => {
  assert.equal(contraste('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contraste('#767676', '#FFFFFF').toFixed(2), '4.54');
  assert.deepEqual(poids('html:not([data-hab]) .v2-btn-primary'), [0, 2, 1]);
  assert.deepEqual(poids('.v2-btn-primary:is(:disabled,[disabled],[aria-disabled="true"])'), [0, 2, 0]);
});

test('au téléphone, le bouton principal grisé perd son dégradé bleu et prend le fond gris prévu', () => {
  const r = trouve(tel, GRISE);
  assert.equal(r.length, 1, 'une seule règle dans v2-tel.css');
  assert.ok(sousTelephone(r[0]), 'sous 640 px');
  const d = r[0].decl;
  assert.match(d, /background-color:var\(--btn-off-bg\)/);
  assert.match(d, /background-image:none/, 'le dégradé est retiré : sans cela le fond gris resterait caché dessous');
  assert.match(d, /border-color:var\(--btn-off-line\)/);
  assert.match(d, /box-shadow:none/, 'plus d\'ombre bleue sous un bouton éteint');
  assert.doesNotMatch(d, /(^|;)color:/, 'la couleur du texte reste celle de la règle « désactivé » de v2.css');
});

test('la règle du téléphone l\'emporte sur le dégradé et sur le survol (un doigt laisse le survol accroché)', () => {
  const lumiere = trouve(base, 'html:not([data-hab]) .v2-btn-primary').filter(x => /background-image:linear-gradient/.test(x.decl) && !x.medias.length);
  assert.equal(lumiere.length, 1, 'la règle « bleu à lumière » de v2.css');
  assert.ok(compare(poids(GRISE), poids('html:not([data-hab]) .v2-btn-primary')) > 0, 'plus lourde que le dégradé');
  // à poids égal avec le survol, c'est l'ordre des feuilles qui tranche : v2-tel.css doit rester chargée après v2.css
  assert.equal(compare(poids(GRISE), poids('html:not([data-hab]) .v2-btn-primary:hover')), 0);
  const feuilles = [...page.split('</head>')[0].matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m => m[1]);
  assert.ok(feuilles.indexOf('v2.css') >= 0 && feuilles.indexOf('v2-tel.css') > feuilles.indexOf('v2.css'), 'v2-tel.css après v2.css : ' + feuilles.indexOf('v2.css') + ' → ' + feuilles.indexOf('v2-tel.css'));
  // les trois façons de griser un bouton, les mêmes que la règle d'origine
  const origine = base.find(x => x.sel.includes('.v2-btn-primary:is(:disabled,[disabled],[aria-disabled="true"])') && /color:var\(--btn-off-tx\)/.test(x.decl));
  assert.ok(origine, 'la règle « désactivé » de v2.css pose toujours le texte gris');
});

test('le texte gris se lit sur le fond gris (4,5:1 au moins), il ne se lisait pas sur le bleu', () => {
  const fond = variable('--btn-off-bg'), texte = variable('--btn-off-tx');
  const apres = contraste(texte, fond);
  assert.ok(apres >= 4.5, 'après : ' + apres.toFixed(2) + ':1');
  assert.equal(apres.toFixed(2), '5.82', 'la valeur écrite dans v2.css (« 5,82:1 »)');
  const lumiere = trouve(base, 'html:not([data-hab]) .v2-btn-primary').find(x => /background-image:linear-gradient/.test(x.decl) && !x.medias.length);
  const bleus = /linear-gradient\([^,]+,(#[0-9A-Fa-f]{6}),(#[0-9A-Fa-f]{6})\)/.exec(lumiere.decl).slice(1);
  for (const b of bleus) assert.ok(contraste(texte, b) < 1.5, 'avant : ' + contraste(texte, b).toFixed(2) + ':1 sur ' + b);
});

test('l\'ordinateur n\'est PAS corrigé par ce lot : hors de 640 px, v2-tel.css ne parle pas du bouton principal', () => {
  assert.equal(tel.filter(r => !sousTelephone(r) && /v2-btn-primary/.test(r.sel)).length, 0);
});
