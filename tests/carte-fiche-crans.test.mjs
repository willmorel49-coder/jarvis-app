// La carte (27/10/2026, choix de Will) : au téléphone, la fiche s'ouvre à mi-hauteur, se tire vers le haut (88 %) ou vers
// le bas (bandeau = en-tête seul), et le point est recentré dans la partie visible après chaque cran.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const carte = readFileSync(new URL('../crm/v2/v2-carte.js', import.meta.url), 'utf8');

test('CSS téléphone : 50 % par défaut, 88 % au cran haut, bandeau mesuré au cran bas, pas d\'animation pendant le geste', () => {
  const tel = carte.slice(carte.indexOf("'@media(max-width:760px){.cn-fiche{"));
  assert.match(tel, /^'@media\(max-width:760px\)\{\.cn-fiche\{top:auto;left:0;right:0;bottom:0;width:100%;height:50%;transition:height/);
  assert.match(tel, /\.cn-fiche\.cn-cran-haut\{height:88%\}/);
  assert.match(tel, /\.cn-fiche\.cn-cran-bas\{height:var\(--cn-bandeau,76px\)\}/);
  assert.match(tel, /\.cn-fiche\.cn-tire\{transition:none\}/);
  assert.match(tel, /\.cn-fiche \.cn-phead\{[^}]*touch-action:none/);   // sinon Safari prend le geste pour un défilement
  assert.match(tel, /\.cn-fiche \.cn-phead\{[^}]*-webkit-user-select:none;user-select:none/);   // sinon tirer sélectionne le nom et la carte (mesuré sous WebKit le 27/10)
  assert.match(carte, /el\.className = host \? 'cn-fiche cn-cran-mi' : 'cn-panel'/);
});

// tirerFiche rejoué avec une fausse fiche : on envoie des événements de pointeur et on relève le cran posé.
const src = carte.slice(carte.indexOf('V2.carteLocate = function'), carte.indexOf('function statusLabel('));
function banc(cranInitial, etroit = true) {
  const ecoute = {}, classes = new Set(['cn-fiche', 'cn-cran-' + cranInitial]), style = { height: '' };
  const fit = [];
  let hauteur = { bas: 70, mi: 300, haut: 528 }[cranInitial];
  const phead = { offsetHeight: 70 };
  const el = {
    classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
    style, addEventListener: (n, f) => { ecoute[n] = f; }, setPointerCapture() {},
    getBoundingClientRect: () => ({ height: style.height ? parseFloat(style.height) : hauteur, top: 900 - (style.height ? parseFloat(style.height) : hauteur), left: 0, width: 390, right: 390, bottom: 900 }),
    parentNode: { getBoundingClientRect: () => ({ height: 600 }) },
    querySelector: (s) => (s === '.cn-phead' ? phead : null),
  };
  const map = { invalidateSize() {}, getZoom: () => 11, getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 300, right: 390, bottom: 900, width: 390, height: 600 }) }), fitBounds: (b, o) => fit.push(o) };
  const document = { getElementById: (id) => (id === 'cn-fiche' ? el : null) };
  const differes = [];
  const outils = new Function('V2', 'map', 'document', 'window', 'D', 'setTimeout', 'fbEtroit', 'ficheIdx',
    src + '\nreturn { tirerFiche, cranDe };')({}, map, document, { L: { latLngBounds: (x) => x } }, { p: { 3: [42.7, 2.9] } }, (fn) => differes.push(fn), () => etroit, 3);
  outils.tirerFiche(el);
  const cible = { closest: (s) => (s === '.cn-phead' ? phead : null) };
  return {
    classes, style, fit,
    cran: () => outils.cranDe(el),
    geste(ys, pas = 16) {   // ys : positions verticales successives du doigt ; pas : ms entre deux mouvements
      let t = 0;
      ecoute.pointerdown({ pointerId: 1, clientY: ys[0], timeStamp: t, target: cible });
      ys.slice(1).forEach((y) => ecoute.pointermove({ pointerId: 1, clientY: y, timeStamp: (t += pas) }));
      ecoute.pointerup({ type: 'pointerup', pointerId: 1, clientY: ys[ys.length - 1], timeStamp: t + pas });
      hauteur = { bas: 70, mi: 300, haut: 528 }[outils.cranDe(el)];
      differes.splice(0).forEach((f) => f());
    },
  };
}

test('mi-hauteur, tirée lentement vers le haut → cran haut, puis recentrage au zoom courant', () => {
  const b = banc('mi');
  b.geste([600, 560, 500, 440, 400, 380], 60);
  assert.equal(b.cran(), 'haut');
  assert.equal(b.style.height, '');          // la hauteur repasse au CSS du cran
  assert.ok(!b.classes.has('cn-tire'));
  assert.equal(b.fit.length, 1);
  assert.equal(b.fit[0].maxZoom, 11);        // pas de zoom forcé : seulement recentré
  assert.deepEqual(b.fit[0].paddingBottomRight, [0, 528]);
});
test('mi-hauteur, tirée vers le bas → bandeau', () => {
  const b = banc('mi');
  b.geste([600, 650, 720, 780, 820], 60);
  assert.equal(b.cran(), 'bas');
  assert.deepEqual(b.fit[0].paddingBottomRight, [0, 70]);
});
test('petit coup de doigt rapide vers le haut depuis le bandeau → mi-hauteur (élan pris en compte), pas d\'un coup en haut', () => {
  const b = banc('bas');
  b.geste([830, 815, 800, 785], 16);
  assert.equal(b.cran(), 'mi');
});
test('appui simple sur l\'en-tête : bandeau → mi-hauteur → haut → mi-hauteur', () => {
  const b = banc('bas');
  b.geste([830]); assert.equal(b.cran(), 'mi');
  b.geste([600]); assert.equal(b.cran(), 'haut');
  b.geste([372]); assert.equal(b.cran(), 'mi');
});
test('ordinateur (volet à droite) : le geste ne fait rien', () => {
  const b = banc('mi', false);
  b.geste([600, 500, 400], 60);
  assert.equal(b.cran(), 'mi');
  assert.equal(b.fit.length, 0);
});
test('clic sur un point de la carte (téléphone) : garderVisible appelé après l\'ouverture de la fiche', () => {
  assert.match(carte, /function openPop\(e\) \{ var i = e\.layer\._pi; if \(D\.p\[i\]\) \{ V2\.carteFiche\(i\); garderVisible\(i\); \} \}/);
  assert.match(carte, /V2\.carteFiche\(best\._pi\); garderVisible\(best\._pi\);/);
});
