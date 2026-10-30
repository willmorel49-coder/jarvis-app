/* Widget « Mon secteur comparé à la moyenne Intégral ».
   29/10/2026 : migration qui le posait en tête une fois (drapeau m1 dans `wid`).
   30/10/2026 (accueil « plus clair », version 4) : la case Officines porte déjà cette comparaison, donc plus rien n'est posé
   par défaut ni par la migration ; le drapeau m1 reste posé ; ce qui est déjà enregistré n'est pas touché. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync(new URL('../crm/v2/v2-accueil-widgets.js', import.meta.url), 'utf8');
const noop = () => {};
const win = { V2: {}, document: { addEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] }, addEventListener: noop, localStorage: { getItem: () => null, setItem: noop } };
win.window = win;
vm.runInNewContext(src, win);
const net0 = win.V2.accueilWidgets.net;
const net = (x) => JSON.parse(JSON.stringify(net0(x)));   // sort du contexte vm (sinon deepEqual compare deux mondes)
const ks = (s) => s.items.map((w) => w.k);
const sans = (items) => ({ wid: { v: 2, items: items.map((k) => ({ k, t: 'M', o: {} })) } });

test('réglages enregistrés sans le widget : rien n\'est posé, les autres gardent leur ordre', () => {
  const r = net(sans(['tournee', 'relance', 'notes']));
  assert.deepEqual(ks(r), ['tournee', 'relance', 'notes']);
  assert.equal(r.m1, true);
  assert.equal(new Set(r.items.map((w) => w.id)).size, r.items.length);
});
test('retiré ensuite (drapeau enregistré) : il ne revient pas, et ça tient à chaque relecture', () => {
  let r = net(sans(['tournee', 'relance']));
  r = net({ wid: { ...r, items: r.items.filter((w) => w.k !== 'secteur') } });
  assert.deepEqual(ks(r), ['tournee', 'relance']);
  assert.deepEqual(ks(net({ wid: r })), ['tournee', 'relance']);
});
test('déjà posé : ni doublon ni déplacement', () => {
  const r = net(sans(['relance', 'secteur', 'notes']));
  assert.deepEqual(ks(r), ['relance', 'secteur', 'notes']);
  assert.equal(r.m1, true);
});
test('liste vide enregistrée (tout retiré avant) : le widget n\'est pas posé', () => {
  assert.deepEqual(ks(net(sans([]))), []);
});
test('douze widgets : rien n’est posé, le drapeau est conservé', () => {
  const douze = ['relance', 'groupement', 'infos', 'todo', 'semaine', 'tournee', 'notes', 'raccourcis', 'ruptures', 'relance', 'todo', 'notes'];
  const r = net(sans(douze));
  assert.equal(r.items.length, 12); assert.ok(!ks(r).includes('secteur')); assert.equal(r.m1, true);
});
test('compte sans réglage : plus de secteur par défaut, drapeau posé', () => {
  for (const raw of [null, {}, { epingles: [] }]) {
    const r = net(raw);
    assert.ok(!ks(r).includes('secteur')); assert.equal(r.m1, true);
  }
  assert.deepEqual(ks(net(null)), ks(JSON.parse(JSON.stringify(win.V2.accueilWidgets.defaut()))));
});
test('anciennes cases cochées (sans wid) : plus de secteur en tête', () => {
  const r = net({ widgets: { relance: false }, wordre: ['relance', 'infos', 'todo', 'semaine'] });
  assert.deepEqual(ks(r), ['semaine']);
});
