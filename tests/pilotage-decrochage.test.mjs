/* pilotage-decrochage.test.mjs — la carte « Pharmacies en baisse » du Pilotage.
 * Ventes INVENTÉES. Vue « Tous » : fenêtre calculée par commercial, une officine
 * est en baisse si elle l'est chez au moins un commercial (montants de celui-ci) ;
 * un commercial au fichier trop court (C) ne produit aucune baisse.
 * La carte ne suit pas la période choisie en haut de l'écran.
 * Le harnais est celui de pilotage-periode.test.mjs (écran réel rendu en Node). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(RACINE, 'crm', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');

const win = {
  console, Date, Math, JSON, parseInt, parseFloat, isFinite, encodeURIComponent,
  setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout() {},
  requestAnimationFrame() { return 0; }, matchMedia: () => ({ matches: true }),
  document: { getElementById: () => null, createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} },
};
win.window = win; win.ICO = () => '';

const V =(commercial, month, ca, ph) => ({ pharmacyId: ph, year: 2026, month, commercial, artCode: 'x' + month, qte: 1, puNet: ca, mntNetHt: ca });
const VENTES = [];
// A : 9 mois ; p1 stable, p2 chute (1000 -> 500 par mois)
for (let m = 1; m <= 9; m++) { VENTES.push(V('A', m, 5000, 'pfond')); VENTES.push(V('A', m, 1000, 'p1')); VENTES.push(V('A', m, m <= 6 ? 1000 : 500, 'p2')); }
// B : 9 mois ; p3 chute (800->400) ; p2 est aussi chez B, stable
for (let m = 1; m <= 9; m++) { VENTES.push(V('B', m, 5000, 'bfond')); VENTES.push(V('B', m, m <= 6 ? 800 : 400, 'p3')); VENTES.push(V('B', m, 700, 'p2')); }
// C : 3 mois seulement -> pas comparable ; p4 s'effondre mais ne compte pas
for (let m = 7; m <= 9; m++) VENTES.push(V('C', m, m === 9 ? 1 : 900, 'p4'));
const V2 = win.V2 = {
  pages: {}, user: { commercial: '', voitTous: true }, pharmacies: [{ id: 'pfond', name: 'Fond' }, { id: 'bfond', name: 'BFond' }, { id: 'p4', name: 'Quatre' }, { id: 'p1', name: 'Un' }, { id: 'p2', name: 'Deux' }, { id: 'p3', name: 'Trois' }],
  sales: VENTES, commFilter: '', ESCALE_COMMS: [],
  commSales() { return V2.commFilter ? V2.sales.filter((s) => s.commercial === V2.commFilter) : V2.sales; },
  commercials: () => ['A', 'B', 'C'], decrochage: (await import('node:module')).createRequire(import.meta.url)('../crm/v2/v2-decrochage-moteur.js'),
  esc: (s) => String(s == null ? '' : s),
  sumCA: (a) => a.reduce((s, x) => s + (x.mntNetHt || 0), 0),
  fmtNum: (n) => String(Math.round(n)), fmtK: (n) => String(Math.round(n)),
  margeMDLboite: () => 0, tint: () => '', topbar: () => '', go() {}, render() {},
};
{
  const boot = lire('v2-boot.js');
  const i = boot.indexOf('V2.fmtEur = function');
  let p = 0, j = boot.indexOf('{', i), fin = j;
  for (; j < boot.length; j++) { if (boot[j] === '{') p++; else if (boot[j] === '}') { p--; if (p === 0) { fin = j; break; } } }
  new Function('V2', boot.slice(i, fin + 1) + ';')(V2);
}
new Function('window', 'document', 'requestAnimationFrame', 'IntersectionObserver', 'matchMedia', 'ICO', lire('v2-pilotage.js'))(
  win, win.document, win.requestAnimationFrame, undefined, win.matchMedia, win.ICO);

// Rend la page avec de faux contrôles : renvoie le HTML et les contrôles branchés.
function rendre() {
  const segs = ['current', '3m', 'year', 'custom'].map((p) => ({ dataset: { p }, classList: { contains: () => false } }));
  const sels = ['du', 'au'].map((b) => ({ dataset: { b }, value: '' }));
  const root = { innerHTML: '', querySelector: () => null,
    querySelectorAll: (s) => (s === '.pilo-segbtn' ? segs : s === '.pilo-persel' ? sels : []) };
  V2.pages.pilotage.render(root);
  return { html: root.innerHTML, seg: (p) => segs.find((b) => b.dataset.p === p), sel: (b) => sels.find((x) => x.dataset.b === b) };
}
const heros = (h) => (h.match(/pilo-hero-v mono" data-count>([^<]*)</) || [])[1];
const bloc = (h, debut, fin) => { const i = h.indexOf(debut); return i < 0 ? '' : h.slice(i, fin ? h.indexOf(fin, i + debut.length) : undefined); };
const mk = (m) => 2026 * 12 + (m - 1);


const carte = (h) => bloc(h, 'Pharmacies en baisse', 'data-reveal');
const noms = (h) => (carte(h).match(/v2-row-name">([^<]*)</g) || []).map((x) => x.replace(/.*">/, '').replace('<', ''));
const montants = (h) => carte(h).match(/▼ [^<]*/g) || [];

test('Pilotage : la carte « Pharmacies en baisse » suit la règle unique du moteur, commercial par commercial', () => {
  V2.commFilter = '';
  let h = rendre().html;
  // Vue « Tous » : p2 chez A (3 000 → 1 500, soit −500 €/mois) puis p3 chez B
  // (2 400 → 1 200, −400 €/mois). p2 est stable chez B : on garde l'écart de A.
  // p4 (fichier de C, trop court) n'apparaît pas.
  assert.deepEqual(noms(h), ['Deux', 'Trois']);
  assert.deepEqual(montants(h), ['▼ ' + V2.fmtEur(500) + '/mois', '▼ ' + V2.fmtEur(400) + '/mois']);
  assert.ok(carte(h).includes('3 derniers mois vs les 3 précédents'), 'libellé de la règle');
  V2.commFilter = 'B'; h = rendre().html; assert.deepEqual(noms(h), ['Trois']);
  V2.commFilter = 'C'; h = rendre().html;
  assert.ok(carte(h).includes('Pas de comparaison possible : il faut au moins 6 mois de ventes'), 'C : fichier trop court');
  assert.deepEqual(noms(h), []);
  V2.commFilter = '';
});

test('Pilotage : changer la période ne change pas la carte des baisses', () => {
  V2.commFilter = '';
  const avant = carte(rendre().html);
  rendre().seg('custom').onclick();
  const r = rendre(); r.sel('du').value = String(mk(2)); r.sel('du').onchange();
  const r2 = rendre(); r2.sel('au').value = String(mk(3)); r2.sel('au').onchange();
  const h = rendre().html;
  assert.ok(h.includes('pilo-persel'), 'la période libre est bien active');
  assert.equal(carte(h), avant, 'février → mars : même carte qu\'en « Dernier mois »');
  assert.deepEqual(noms(h), ['Deux', 'Trois']);
});

test('Pilotage : un achat ponctuel (2 mois d achat sur 6) n entre pas dans la carte', () => {
  // p5 chez A : 1 500 € en mai et en juin seulement → avant 3 000, récent 0 (−100 %), mais ponctuel.
  const ajout = [V('A', 5, 1500, 'p5'), V('A', 6, 1500, 'p5')];
  VENTES.push(...ajout); V2.pharmacies.push({ id: 'p5', name: 'Cinq' });
  try {
    V2.commFilter = '';
    const h = rendre().html;
    assert.deepEqual(noms(h), ['Deux', 'Trois'], 'marqueur positif : les vraies baisses restent, p5 non');
  } finally { VENTES.splice(VENTES.length - ajout.length, ajout.length); V2.pharmacies.pop(); }
});
