/* Migration unique du widget « Mon secteur comparé à la moyenne Intégral » (29/10/2026) :
   posé en tête chez ceux qui avaient déjà des réglages enregistrés, une seule fois (drapeau m1 dans `wid`),
   sans déplacer les autres ; retiré ensuite, il ne revient pas ; compte sans réglage = comportement d'avant. */
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

test('réglages enregistrés sans le widget : posé en tête, les autres gardent leur ordre', () => {
  const r = net(sans(['tournee', 'relance', 'notes']));
  assert.deepEqual(ks(r), ['secteur', 'tournee', 'relance', 'notes']);
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
test('liste vide enregistrée (tout retiré avant) : le widget est posé une fois', () => {
  assert.deepEqual(ks(net(sans([]))), ['secteur']);
});
test('douze widgets : rien n’est posé ni marqué', () => {
  const douze = ['relance', 'groupement', 'infos', 'todo', 'semaine', 'tournee', 'notes', 'raccourcis', 'ruptures', 'relance', 'todo', 'notes'];
  const r = net(sans(douze));
  assert.equal(r.items.length, 12); assert.ok(!ks(r).includes('secteur')); assert.equal(r.m1, false);
});
test('compte sans réglage : comme avant (secteur en tête), drapeau posé', () => {
  for (const raw of [null, {}, { epingles: [] }]) {
    const r = net(raw);
    assert.equal(ks(r)[0], 'secteur'); assert.equal(r.m1, true);
  }
  assert.deepEqual(ks(net(null)), ks(JSON.parse(JSON.stringify(win.V2.accueilWidgets.defaut()))));
});
test('anciennes cases cochées (sans wid) : secteur déjà en tête comme avant', () => {
  const r = net({ widgets: { relance: false }, wordre: ['relance', 'infos', 'todo', 'semaine'] });
  assert.deepEqual(ks(r), ['secteur', 'semaine']);
});
