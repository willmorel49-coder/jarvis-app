// 26/11/2026 — téléphone : trois retouches faites en jugeant le rendu des corrections de l'audit du 25/11.
//  1. Panier du Catalogue : il gardait 80 px vides à droite pour le bouton rond « + », que la barre du bas masque au téléphone.
//  2. « Ce qui change » : la rangée d'onglets glisse au téléphone ; redessinée après un toucher, elle revenait à gauche et l'onglet choisi restait coupé.
//  3. Carte : le bouton « Ma tournée » (libellé masqué au téléphone, pastille seule) a un nom lu par VoiceOver ; ce nom garde le nombre d'arrêts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lire, regles, trouve, sousTelephone, poids, compare, reglesInjectees } from './aide-css-telephone.mjs';

test('étalonnage : poids et lecture d\'une règle injectée', () => {
  assert.deepEqual(poids('.cp-bar'), [0, 1, 0]);
  assert.deepEqual(poids('body.bnav-on .cp-bar'), [0, 2, 1]);
  assert.deepEqual(reglesInjectees("'.x{a:b}',", '.x'), ['a:b']);
});

test('panier du Catalogue : plus de marge vide à droite au téléphone, et seulement au téléphone', () => {
  const tel = regles(lire('v2-tel.css'));
  const r = trouve(tel, 'body.bnav-on .cp-bar');
  assert.equal(r.length, 1, 'une règle body.bnav-on .cp-bar dans v2-tel.css');
  assert.ok(sousTelephone(r[0]), 'sous un @media de 640 px ou moins');
  assert.match(r[0].decl, /padding-right:8px/);
  // ce que pose l'écran : la marge de 80 px existe toujours (sinon la règle ne sert plus à rien) et pèse moins lourd
  const js = lire('v2-comptoir.js');
  assert.equal(reglesInjectees(js, '.cp-bar').length, 1, 'une règle .cp-bar{…} de base dans v2-comptoir.js');
  assert.match(js, /@media \(max-width:879px\)\{\.cp-bar\{padding-right:80px\}\}/, 'v2-comptoir.js réserve toujours 80 px à droite sous 879 px');
  assert.ok(compare(poids('body.bnav-on .cp-bar'), poids('.cp-bar')) > 0);
  // la raison : le rond est masqué au téléphone connecté, hors fiche en mode rendez-vous
  assert.ok(tel.some(x => /\.v2-fab$/.test(x.sel.trim()) && /display:none/.test(x.decl) && sousTelephone(x)), 'v2-tel.css masque le bouton rond au téléphone');
});

// le corps de V2.comptoir.onglet, relu dans le vrai fichier et lancé avec de faux éléments
function onglet(document, etat) {
  const js = lire('v2-comptoir.js');
  const d = js.indexOf('    onglet: function (k) {'); assert.ok(d > 0, 'V2.comptoir.onglet trouvé');
  const f = js.indexOf('\n    },', d); assert.ok(f > d);
  const corps = js.slice(js.indexOf('{', d) + 1, f);
  return new Function('C', 'majResultats', 'document', 'k', corps).bind(null, etat, () => { etat.redessine = (etat.redessine || 0) + 1; }, document);
}
const boite = (left, right) => ({ getBoundingClientRect: () => ({ left, right }) });

test('« Ce qui change » : après un toucher, l\'onglet choisi est ramené en entier dans la rangée', () => {
  // rangée de 320 px (35 → 355) ; l'onglet choisi finit à 384,6 : il dépasse de 29,6 px (mesuré à 390 px le 25/11)
  const on = boite(258.9, 384.6), rangee = { ...boite(35, 355), scrollLeft: 0, querySelector: s => (s === '.cq1-tab.on' ? on : null) };
  const etat = {};
  onglet({ querySelector: s => (s === '.cq1-tabs' ? rangee : null) }, etat)('nv');
  assert.equal(etat.chg, 'nv'); assert.equal(etat.page, 1); assert.equal(etat.redessine, 1);
  assert.ok(Math.abs(rangee.scrollLeft - 29.6) < 0.01, 'la rangée glisse de 29,6 px : ' + rangee.scrollLeft);
  // onglet caché à gauche : la rangée revient
  const on2 = boite(5, 119), rangee2 = { ...boite(35, 355), scrollLeft: 30, querySelector: () => on2 };
  onglet({ querySelector: () => rangee2 }, {})('jo');
  assert.equal(rangee2.scrollLeft, 0);
});

test('« Ce qui change » : rien ne bouge quand la rangée ne déborde pas (ordinateur), ni sans page (tests sans navigateur)', () => {
  const on = boite(40, 160), rangee = { ...boite(35, 900), scrollLeft: 0, querySelector: () => on };
  onglet({ querySelector: () => rangee }, {})('rup');
  assert.equal(rangee.scrollLeft, 0);
  const etat = {};
  assert.doesNotThrow(() => onglet({}, etat)('jo'));            // faux document des autres tests : pas de querySelector
  assert.doesNotThrow(() => onglet({ querySelector: () => null }, etat)('n-importe-quoi'));
  assert.equal(etat.chg, 'jo', 'une clé inconnue retombe sur « Prix au JO », comme avant');
});

test('carte : le nom lu du bouton « Ma tournée » garde le nombre d\'arrêts, à l\'ouverture comme après un ajout', () => {
  const js = lire('v2-carte.js');
  const m = /function tourNom\(\) \{([^\n]*)\}\n/.exec(js); assert.ok(m, 'tourNom() trouvée');
  const nom = n => new Function('tour', m[1])(new Array(n));
  assert.equal(nom(0), 'Ma tournée');
  assert.equal(nom(1), 'Ma tournée, 1 arrêt');
  assert.equal(nom(2), 'Ma tournée, 2 arrêts');
  assert.match(js, /cn-fb-tour" aria-label="' \+ tourNom\(\) \+ '"/, 'le bouton est dessiné avec ce nom');
  const maj = js.slice(js.indexOf('function updateTourBar()'), js.indexOf('function tourNom()'));
  assert.match(maj, /setAttribute\('aria-label', tourNom\(\)\)/, 'et le nom suit chaque ajout ou retrait d\'arrêt');
  assert.doesNotMatch(js, /cn-fb-tour" aria-label="Ma tournée"/, 'plus de nom fixe sans le nombre');
});
