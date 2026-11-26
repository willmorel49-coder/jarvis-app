// 26/11/2026 — un bouton principal grisé restait BLEU avec un texte gris (audit du 25/11, A·CAM-1, « Sélectionnez des officines » de la Campagne).
// Cause : la règle « bouton principal : bleu à lumière » de v2.css pèse plus lourd que la règle « désactivé » : le dégradé restait, seul le texte devenait gris.
// Corrigé d'abord AU TÉLÉPHONE seulement (v2-tel.css, sous 640 px), dans la nuit du 26/11.
// Puis PARTOUT le 26/11 au matin (planche des 11 choix, sujet 9, version 1 « Le même correctif à l'ordinateur », accord de Will) :
// la même règle, sortie du bloc téléphone et posée dans v2.css, hors de tout @media. Ce test affirmait « l'ordinateur n'est pas corrigé » ; il prouve maintenant le contraire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lire, regles, trouve, sousTelephone, poids, compare, contraste } from './aide-css-telephone.mjs';

const tel = regles(lire('v2-tel.css')), base = regles(lire('v2.css'));
const GRISE = 'html:not([data-hab]) .v2-btn-primary:is(:disabled,[disabled],[aria-disabled="true"])';
const LUMIERE = 'html:not([data-hab]) .v2-btn-primary';
const variable = (nom) => {
  const r = trouve(base, ':root').find(x => x.decl.includes(nom + ':') && !x.medias.length);
  assert.ok(r, nom + ' défini dans :root de v2.css');
  return new RegExp(nom + ':(#[0-9A-Fa-f]{6})').exec(r.decl)[1];
};
const ailleurs = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const feuillesDe = page => [...page.split('</head>')[0].matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m => m[1].split('/').pop());

test('étalonnage : contraste et poids rendent les valeurs connues', () => {
  assert.equal(contraste('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contraste('#767676', '#FFFFFF').toFixed(2), '4.54');
  assert.deepEqual(poids('html:not([data-hab]) .v2-btn-primary'), [0, 2, 1]);
  assert.deepEqual(poids('.v2-btn-primary:is(:disabled,[disabled],[aria-disabled="true"])'), [0, 2, 0]);
});

test('le bouton principal grisé perd son dégradé bleu et prend le fond gris prévu, à toutes les largeurs', () => {
  const r = trouve(base, GRISE);
  assert.equal(r.length, 1, 'une seule règle dans v2.css');
  assert.deepEqual(r[0].medias, [], 'hors de tout @media : l\'ordinateur la reçoit comme le téléphone');
  const d = r[0].decl;
  assert.match(d, /background-color:var\(--btn-off-bg\)/);
  assert.match(d, /background-image:none/, 'le dégradé est retiré : sans cela le fond gris resterait caché dessous');
  assert.match(d, /border-color:var\(--btn-off-line\)/);
  assert.match(d, /box-shadow:none/, 'plus d\'ombre bleue sous un bouton éteint');
  assert.doesNotMatch(d, /(^|;)color:/, 'la couleur du texte reste celle de la règle « désactivé » de v2.css');
  assert.doesNotMatch(d, /!important/, 'sans !important : un écran qui dessine son propre bouton avec un sélecteur plus lourd garde la main');
});

test('la règle l\'emporte sur le dégradé et sur le survol (un doigt laisse le survol accroché, une souris survole un bouton éteint)', () => {
  const lumiere = trouve(base, LUMIERE).filter(x => /background-image:linear-gradient/.test(x.decl) && !x.medias.length);
  assert.equal(lumiere.length, 1, 'la règle « bleu à lumière » de v2.css');
  assert.ok(compare(poids(GRISE), poids(LUMIERE)) > 0, 'plus lourde que le dégradé');
  // à poids égal avec le survol, c'est l'ordre dans la feuille qui tranche : la règle « grisé » doit rester écrite APRÈS le survol
  assert.equal(compare(poids(GRISE), poids(LUMIERE + ':hover')), 0);
  const survol = trouve(base, LUMIERE + ':hover').filter(x => !x.medias.length);
  assert.equal(survol.length, 1, 'la règle de survol du bouton à lumière');
  assert.ok(base.indexOf(trouve(base, GRISE)[0]) > base.indexOf(survol[0]), 'grisé écrit après le survol');
  assert.ok(base.indexOf(trouve(base, GRISE)[0]) > base.indexOf(lumiere[0]), 'et après le dégradé');
  // les trois façons de griser un bouton, les mêmes que la règle d'origine
  const origine = base.find(x => x.sel.includes('.v2-btn-primary:is(:disabled,[disabled],[aria-disabled="true"])') && /color:var\(--btn-off-tx\)/.test(x.decl));
  assert.ok(origine, 'la règle « désactivé » de v2.css pose toujours le texte gris');
  assert.deepEqual(origine.medias, [], 'elle aussi à toutes les largeurs');
});

test('le texte gris se lit sur le fond gris (4,5:1 au moins), il ne se lisait pas sur le bleu', () => {
  const fond = variable('--btn-off-bg'), texte = variable('--btn-off-tx');
  const apres = contraste(texte, fond);
  assert.ok(apres >= 4.5, 'après : ' + apres.toFixed(2) + ':1');
  assert.equal(apres.toFixed(2), '5.82', 'la valeur écrite dans v2.css (« 5,82:1 »)');
  const lumiere = trouve(base, LUMIERE).find(x => /background-image:linear-gradient/.test(x.decl) && !x.medias.length);
  const bleus = /linear-gradient\([^,]+,(#[0-9A-Fa-f]{6}),(#[0-9A-Fa-f]{6})\)/.exec(lumiere.decl).slice(1);
  for (const b of bleus) assert.ok(contraste(texte, b) < 1.5, 'avant : ' + contraste(texte, b).toFixed(2) + ':1 sur ' + b);
});

test('l\'ordinateur EST corrigé : la règle a quitté le bloc téléphone, sans doublon', () => {
  assert.equal(tel.filter(r => /v2-btn-primary/.test(r.sel)).length, 0, 'v2-tel.css ne parle plus du bouton principal');
  assert.equal(base.filter(r => sousTelephone(r) && trouve([r], GRISE).length).length, 0, 'et v2.css ne la range pas sous 640 px');
  // la feuille qui la porte est bien chargée par JARVIS
  assert.ok(feuillesDe(lire('index.html')).includes('v2.css'));
});

test('les habillages gardent leur propre bouton grisé : la règle ne vaut que sans habillage', () => {
  assert.match(GRISE, /^html:not\(\[data-hab\]\) /);
  const hab = trouve(base, 'html[data-hab] .v2-btn-primary:is(:disabled,[disabled],[aria-disabled="true"])');
  assert.equal(hab.length, 1, 'la règle « désactivé » des habillages, dans v2.css');
  assert.match(hab[0].decl, /background:var\(--btn-off-bg\)!important/, 'fond gris imposé au ruban de l\'habillage');
  assert.match(hab[0].decl, /color:var\(--btn-off-tx\)/);
});

test('Phirst et OPSO, qui chargent aussi v2.css, gardent leur bouton', () => {
  // Phirst : sa règle de couleur a le même poids et sa feuille est chargée après v2.css → elle garde la main sur les quatre propriétés
  const phirst = regles(ailleurs('phirst/v2/phirst-finitions.css'));
  const SEL = 'html[data-teinte="phirst"]:not([data-hab]) .v2-btn-primary';
  const r = trouve(phirst, SEL).find(x => !x.medias.length);
  assert.ok(r, 'la règle du bouton principal de Phirst');
  assert.ok(compare(poids(SEL), poids(GRISE)) >= 0, 'au moins aussi lourde que la règle « grisé » : ' + poids(SEL) + ' contre ' + poids(GRISE));
  for (const p of ['background-color', 'background-image', 'border-color', 'box-shadow']) assert.ok(r.decl.includes(p + ':'), 'Phirst pose ' + p);
  const f = feuillesDe(ailleurs('phirst/v2/index.html'));
  assert.ok(f.indexOf('v2.css') >= 0 && f.indexOf('phirst-finitions.css') > f.indexOf('v2.css'), 'phirst-finitions.css après v2.css');
  // OPSO : son fond et son ombre sont en !important ; de la règle « grisé », seul le filet d'1 px peut l'atteindre
  const opso = regles(ailleurs('opso/v2/opso-theme.css'));
  const o = trouve(opso, '.v2-btn-primary').find(x => /background:/.test(x.decl));
  assert.ok(o, 'la règle du bouton principal d\'OPSO');
  assert.match(o.decl, /background:[^;]*!important/);
  assert.match(o.decl, /box-shadow:[^;]*!important/);
});
