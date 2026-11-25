/* phirst-tel-accueil-2026-11-25.test.mjs — Accueil au téléphone, maquette « cinq puis la Veille » (accueil-1), 25/11/2026.
 * Lit le code servi (phirst/v2/phirst-ligne.js et .css), et exécute le JS dans un DOM minimal pour compter les lignes et le lien. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const lire = (f) => readFileSync(new URL('../phirst/v2/' + f, import.meta.url), 'utf8');
const js = lire('phirst-ligne.js'), css = lire('phirst-ligne.css');
/* le corps d'un bloc @media (accolades équilibrées) */
function media(c, ent) {
  const i = c.indexOf(ent); assert.ok(i >= 0, 'bloc absent : ' + ent);
  let d = 0, j = c.indexOf('{', i);
  for (let k = j; k < c.length; k++) { if (c[k] === '{') d++; if (c[k] === '}' && --d === 0) return c.slice(j + 1, k); }
  assert.fail('bloc non fermé');
}
const tel = media(css, '@media (max-width:1000px){\n\n  /* ── maquette A');
const hors = css.replace(tel, '');

/* exécute phirst-ligne.js avec des données posées d'avance et rend le HTML de la section */
function rendre(moments, extra = {}) {
  const champ = { parentNode: null }; let section = null;
  const els = { 'aube-champ': champ, 'aube-acc': {} };
  const doc = {
    documentElement: { setAttribute() {} },
    getElementById: (id) => (id === 'lg-ligne' ? section : els[id] || null),
    querySelector: () => null,
    createElement: () => { section = { id: '', className: '', _h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, setAttribute() {}, addEventListener() {}, remove() {} }; return section; },
  };
  champ.parentNode = { insertBefore() {} };
  const ctx = { document: doc, window: null, Intl, Date, Math, setTimeout() {}, MutationObserver: class { observe() {} }, ...extra };
  ctx.window = { PHIRST_LIGNE: moments, addEventListener() {}, V2: { pages: { veille: 1, appels: 1, dossiers: 1, chantiers: 1, encaisser: 1 }, go() {} }, ...extra };
  ctx.V2 = ctx.window.V2;
  vm.runInNewContext(js, ctx);
  return section ? section.innerHTML : '';
}
const ph = (i) => ({ nom: 'Pharmacie Numéro ' + i, ville: 'Ville', etiquette: { t: 'Nouvelle piste', ton: '' } });
const moment = (cle, nbPh, over = {}) => ({ cle, mot: 'Trouver', pharmacies: Array.from({ length: nbPh }, (_, i) => ph(i + 1)), total: nbPh, ...over });
const chose = { titre: 'Pharmacie Numéro 1, à Ville, est en procédure collective', heure: 'Veille', parution: '2026-10-02', bouton: 'L’ajouter à mes pistes', type: 'veille' };
const D4 = (t) => [t, { cle: 'preparer', mot: 'Préparer', pharmacies: [], total: 0, vide: { texte: 'x', bouton: 'y' } }, { cle: 'chantier', mot: 'Chantier', pharmacies: [ph(1)], total: 1 }, { cle: 'encaisser', mot: 'Encaisser', pharmacies: [ph(1)], total: 2 }];

test('1 · la liste : les lignes au-delà de la 5e portent « lg-apres » (cachées au téléphone, jamais retirées)', () => {
  const h = rendre(D4(moment('trouver', 8)));
  const li = h.match(/<li( class="lg-apres")?><span class="lg-ini"/g);
  assert.equal(li.length, 8); assert.equal(li.filter((x) => /lg-apres/.test(x)).length, 3);
  assert.match(tel, /li\.lg-apres\{display:none\}/);
  assert.doesNotMatch(hors, /lg-apres/, 'à l’ordinateur toutes les lignes restent visibles');
});

test('2 · « Voir les N autres dans la Veille » : N calculé (total − grande carte − 5), singulier à 1, rien à 5 lignes ou moins', () => {
  const lien = (h) => (/<button type="button" class="lg-suite"[^>]*>([^<]*)</.exec(h) || [])[1];
  assert.equal(lien(rendre(D4(moment('trouver', 22, { chose })))), 'Voir les 16 autres dans la Veille', '22 − 1 (grande carte) − 5');
  assert.equal(lien(rendre(D4(moment('trouver', 22)))), 'Voir les 17 autres dans la Veille');
  assert.equal(lien(rendre(D4(moment('trouver', 7)))), 'Voir les 2 autres dans la Veille');
  assert.equal(lien(rendre(D4(moment('trouver', 6)))), 'Voir 1 autre dans la Veille', 'singulier');
  assert.equal(lien(rendre(D4(moment('trouver', 6, { chose })))), undefined, '6 − 1 − 5 = 0 : pas de lien');
  assert.equal(lien(rendre(D4(moment('trouver', 5)))), undefined);
  assert.equal(lien(rendre(D4(moment('trouver', 3)))), undefined);
  assert.equal(lien(rendre(D4(moment('trouver', 20, { total: 40 })))), 'Voir les 35 autres dans la Veille', 'total plus grand que la liste : le total compte');
});

test('3 · le lien mène à l’écran Veille (data-vers="veille", routé par V2.go) ; Appels pour la téléprospectrice', () => {
  assert.match(rendre(D4(moment('trouver', 9))), /class="lg-suite" data-vers="veille"/);
  assert.match(rendre([moment('trouver', 9, { source: 'appels', autres: 'Voir les 3 autres dans Appels' })]), /class="lg-suite" data-vers="appels">Voir les 4 autres dans Appels/);
  assert.match(js, /V2\.go\(g\.getAttribute\('data-vers'\)\)/);
});

test('4 · le lien n’existe qu’au téléphone (caché hors du bloc ≤ 1000 px), et remplace le bouton « autres » du robot', () => {
  assert.match(hors, /\.lg \.lg-suite\{display:none\}/);
  assert.match(tel, /\.lg-suite\{display:flex;[^}]*min-height:52px;[^}]*font-weight:800;font-size:16px/);
  assert.match(tel, /\.lg-suite~\.lg-autres\{display:none\}/);
  assert.match(rendre([moment('trouver', 9, { autres: 'Voir les 3 autres dans la Veille', source: 'veille' })]), /class="lg-autres"/, 'le bouton du robot reste dans la page (ordinateur)');
});

test('5 · maquette : tailles de la grande carte et de la liste', () => {
  assert.match(tel, /\.lg \.lg-titre\{font-size:26px;line-height:1\.15/);
  assert.match(tel, /\.lg-st \.lg-n\{font-size:36px\}/);
  assert.match(tel, /\.lg-st \.lg-m\{font-size:15px\}/);
  assert.match(tel, /\.lg-ini\{width:48px!important;height:48px!important/);
  assert.match(tel, /\.lg-liste li:first-child\{grid-template-columns:48px minmax\(0,1fr\);gap:14px;padding:10px 16px\}/);
  assert.match(tel, /\.lg-liste b\{font-size:17px;line-height:1\.25;font-weight:800/);
  assert.match(tel, /\.lg-liste small\{font-size:14\.5px\}/);
  assert.match(tel, /\.lg-lt\{margin:20px 0 10px\}/);
  assert.match(tel, /\.lg-liste ul\{padding:0;overflow:hidden\}/);
});

test('6 · points tenus (cas 14 du 25/11) : grande carte sortie de la liste, « — » à la taille des chiffres, accueil de la téléprospectrice', () => {
  assert.match(js, /function estLaChose\(c, p\)/);
  assert.match(js, /\(av \? '—' : n\)/);
  assert.match(js, /aria-label="' \+ esc\(s\.mot\) \+ ' : ' \+ \(av \? 'à venir'/);
  assert.doesNotMatch(css, /lg-avenir/);
  const h = rendre([moment('trouver', 7, { chose })]);
  assert.ok(!/Pharmacie Numéro 1<\/b>/.test(h), 'la pharmacie de la grande carte n’est pas dans la liste');
  assert.match(css, /\.lg-v6\.lg-seul \.lg-rail\{justify-content:center\}/);
  assert.match(css, /html\[data-tel\] \.lg-v6\.lg-seul \.lg-rail\{grid-template-columns:minmax\(0,1fr\)\}/);
});

test('7 · Safari et ordinateur : pas de flou, pas de backdrop-filter ; le seuil reste celui de l’écran (1000 px) ; rien de neuf hors du bloc téléphone sauf la règle de masquage', () => {
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /backdrop-filter|filter:\s*blur/);
  assert.doesNotMatch(tel, /opacity/);
  const neuf = hors.replace(/\/\*[\s\S]*?\*\//g, '').split('}').filter((r) => /lg-suite|lg-apres/.test(r));
  assert.deepEqual(neuf.map((r) => r.trim() + '}'), ['.lg .lg-suite{display:none}']);
});
