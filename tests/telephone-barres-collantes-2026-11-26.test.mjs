// 26/11/2026 — téléphone : trois barres collantes passaient SOUS la barre du bas (audit du 25/11, A·PRD-2 et A·RDV-6).
// Mesuré en production à 390 × 844 : le panier du Catalogue (#cp-bar-hote) finissait à 832 px quand la barre du bas commence à 779 :
// 53 px cachés, dont le bouton « Créer la fiche ». Même cause, lue dans le code, pour la barre « N produits retenus » (v2-produits.js) et la barre d'envoi de « Qui inviter ».
// Ce test garde le CHEMIN réel : la position posée par chaque écran (son style injecté, relu dans son fichier) ET le décalage posé par v2-tel.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lire, regles, trouve, sousTelephone, poids, compare, reglesInjectees } from './aide-css-telephone.mjs';

const tel = regles(lire('v2-tel.css'));
const BARRES = [
  { nom: 'panier du Catalogue', fichier: 'v2-comptoir.js', sel: '#cp-bar-hote' },
  { nom: 'barre « produits retenus » d\'un document', fichier: 'v2-produits.js', sel: '.pr-panier' },
  { nom: 'barre d\'envoi de « Qui inviter »', fichier: 'v2-rdv-radar.js', sel: '.rad-bar' }
];
// le premier nombre de pixels d'une valeur « bottom » : « calc(12px + env(…)) » → 12 ; « 8px » → 8 ; « 0 » ou « var(--bnav-h) » → 0
const px = v => { const m = /(\d+(?:\.\d+)?)px/.exec(v.replace(/var\([^)]*\)/g, '').replace(/env\([^)]*\)/g, '')); return m ? +m[1] : 0; };
const bottom = decl => (/(?:^|;)\s*bottom:([^;]+)/.exec(decl) || [])[1];
// la place prise par la barre du bas, lue dans v2-tel.css (64 px + la zone de sécurité de l'iPhone)
const hauteurBarre = () => {
  const r = trouve(tel, 'body.bnav-on').find(x => /--bnav-h:/.test(x.decl));
  assert.ok(r, 'v2-tel.css définit --bnav-h sur body.bnav-on');
  assert.match(r.decl, /--bnav-h:calc\(64px \+ env\(safe-area-inset-bottom,0px\)\)/);
  return 64;
};

test('étalonnage : le calcul de poids rend les valeurs connues', () => {
  assert.deepEqual(poids('#cp-bar-hote'), [1, 0, 0]);
  assert.deepEqual(poids('body.bnav-on #cp-bar-hote'), [1, 1, 1]);
  assert.deepEqual(poids('html:not([data-hab]) .v2-btn-primary:is(:disabled,[disabled])'), [0, 3, 1]);
  assert.equal(px('calc(12px + env(safe-area-inset-bottom))'), 12); assert.equal(px('0'), 0); assert.equal(px('calc(var(--bnav-h) + 8px)'), 8);
});

for (const b of BARRES) {
  test(b.nom + ' : l\'écran la colle toujours en bas (position:sticky), et v2-tel.css la remonte de la hauteur de la barre', () => {
    // 1. ce que pose l'écran : sans cela, la règle du téléphone ne servirait à rien (ou plus à rien)
    const src = reglesInjectees(lire(b.fichier), b.sel);
    assert.equal(src.length, 1, b.fichier + ' : une seule règle ' + b.sel + '{…}');
    assert.match(src[0], /position:sticky/, 'collée par sticky (un fixed serait piégé par la transformation de #v2-root)');
    const avant = bottom(src[0]); assert.ok(avant != null, 'bottom posé par l\'écran');
    // 2. ce que pose le téléphone
    const r = trouve(tel, 'body.bnav-on ' + b.sel);
    assert.equal(r.length, 1, 'une seule règle body.bnav-on ' + b.sel + ' dans v2-tel.css');
    assert.ok(sousTelephone(r[0]), 'sous 640 px : l\'ordinateur ne bouge pas');
    const apres = bottom(r[0].decl);
    assert.match(apres, /var\(--bnav-h\)/, 'décalée de la place de la barre');
    assert.equal(px(apres), px(avant), 'même écart qu\'avant au-dessus du bord : ' + avant + ' → ' + apres);
    assert.equal(r[0].decl.replace(/bottom:[^;]+;?/, '').trim(), '', 'rien d\'autre que bottom : le dessin de la barre n\'est pas touché');
    // 3. la règle du téléphone l'emporte sur le style injecté, posé APRÈS les feuilles
    assert.ok(compare(poids('body.bnav-on ' + b.sel), poids(b.sel)) > 0, 'poids supérieur à celui de l\'écran');
  });
}

test('le calcul : à 844 px de haut, plus rien ne passe sous la barre du bas', () => {
  const H = 844, barre = hauteurBarre(), hautBarre = H - barre;
  for (const b of BARRES) {
    const e = px(bottom(reglesInjectees(lire(b.fichier), b.sel)[0]));
    const r = trouve(tel, 'body.bnav-on ' + b.sel); assert.equal(r.length, 1, b.nom + ' : règle du téléphone présente');
    const v = bottom(r[0].decl);   // la valeur réellement posée par v2-tel.css : la place de la barre n'est comptée que si la règle la retire
    const basAvant = H - e, basApres = H - (/var\(--bnav-h\)/.test(v) ? barre : 0) - px(v);
    assert.ok(basAvant > hautBarre, b.nom + ' : avant, ' + (basAvant - hautBarre) + ' px sous la barre');
    assert.ok(basApres <= hautBarre, b.nom + ' : après, bas à ' + basApres + ' px pour une barre qui commence à ' + hautBarre);
  }
  // le panier du Catalogue : 52 px par le calcul, 53 mesurés en production (le filet de 1 px de la barre)
  assert.equal(H - 12 - hautBarre, 52);
});

test('là où la barre du bas s\'efface (fiche officine, éditeur Marketing), sa place vaut 0 : les barres gardent leur position d\'origine', () => {
  const r = trouve(tel, 'body.bnav-on:has(.pha-wrap.fdr-on)').find(x => /--bnav-h/.test(x.decl));
  assert.ok(r && sousTelephone(r)); assert.match(r.decl, /--bnav-h:0px/);
  assert.ok(trouve(tel, 'body.bnav-on.mk-editeur').some(x => /--bnav-h:0px/.test(x.decl)));
});

test('v2-tel.css : hors de 640 px, toujours une seule règle (la barre du bas cachée)', () => {
  const dehors = tel.filter(r => !sousTelephone(r));
  assert.deepEqual(dehors.map(r => r.sel + '{' + r.decl + '}'), ['.bnav{display:none}']);
});
