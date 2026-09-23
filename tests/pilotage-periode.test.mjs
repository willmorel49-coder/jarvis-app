/* pilotage-periode.test.mjs — tout le Pilotage suit la période choisie
 *
 * Will, 15/09/2026 : « quand on filtre 1 mois, 3 ou l'année ça n'adapte pas tous
 * les chiffres en dessous ». On rend l'ÉCRAN RÉEL (v2-pilotage.js) sur des ventes
 * fabriquées dont chaque total est unique (puissances de deux), on choisit une
 * période par les vrais contrôles (bouton « Choisir » puis listes Du / Au), et on
 * lit ce que l'écran affiche.
 */
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

// A : mars 1 000 · avril 2 000 · mai 4 000 · juin 8 000 (officine p1, puis p2 en baisse)
// B : dix fois moins. Chaque somme de mois consécutifs est unique.
const V = (commercial, month, ca, ph) => ({ pharmacyId: ph, year: 2026, month, commercial, artCode: 'x' + month, qte: 1, puNet: ca, mntNetHt: ca });
const VENTES = [
  V('A', 3, 1000, 'p1'), V('A', 4, 2000, 'p1'), V('A', 5, 4000, 'p1'), V('A', 6, 8000, 'p1'),
  V('B', 3, 100, 'p2'), V('B', 4, 200, 'p2'), V('B', 5, 400, 'p2'), V('B', 6, 800, 'p2'),
  V('B', 3, 700, 'p3'), V('B', 4, 600, 'p3'), V('B', 5, 5, 'p3'), V('B', 6, 5, 'p3'),
];
const V2 = win.V2 = {
  pages: {}, user: { commercial: '', voitTous: true }, pharmacies: [{ id: 'p1', name: 'Un' }, { id: 'p2', name: 'Deux' }, { id: 'p3', name: 'Trois' }],
  sales: VENTES, commFilter: '', ESCALE_COMMS: [],
  commSales() { return V2.commFilter ? V2.sales.filter((s) => s.commercial === V2.commFilter) : V2.sales; },
  commercials: () => ['A', 'B'],
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

test('« Dernier mois » : juin seul (8 805 €)', () => {
  assert.equal(heros(rendre().html), V2.fmtEur(8805));
});

test('« Choisir » avril → mai : chiffres, mois par mois, graphe et pharmacies en baisse suivent', () => {
  const r = rendre();
  r.seg('custom').onclick();                          // part de juin
  let r2 = rendre();
  assert.equal(heros(r2.html), V2.fmtEur(8805), '« Choisir » reprend la période affichée');
  assert.ok(r2.html.includes('pilo-persel'), 'les listes Du / Au sont affichées');
  r2.sel('du').value = String(mk(4)); r2.sel('du').onchange();
  const r3 = rendre(); r3.sel('au').value = String(mk(5)); r3.sel('au').onchange();
  const h = rendre().html;
  assert.equal(heros(h), V2.fmtEur(2000 + 4000 + 200 + 400 + 600 + 5), 'CA avril + mai');
  assert.ok(h.includes('Avr. → mai 2026'), 'libellé de période');
  // Mois par mois : seulement avril et mai
  const mpm = bloc(h, 'Mois par mois', 'pilo-disc');
  assert.ok(mpm.includes('>avr.<') && mpm.includes('>mai<'), 'avril et mai présents');
  assert.ok(!mpm.includes('>juin<') && !mpm.includes('>mars<'), 'mars et juin absents : ' + mpm.slice(0, 120));
  // Graphe : avril et mai en couleur, pas juin
  assert.equal((h.match(/pilo-cbar-in"/g) || []).length, 2, 'deux barres dans la période');
  // Mars est couvert → avril-mai se compare à février-mars ? Février absent : moitiés.
  assert.ok(h.includes('2ᵉ moitié vs 1ʳᵉ de la période'), 'pharmacies en baisse : moitiés de la période');
  // p3 passe de 600 (avril) à 5 (mai) : c'est elle, et pas p1 qui monte
  const baisse = bloc(h, 'Pharmacies en baisse');
  assert.ok(baisse.includes('Trois') && !baisse.includes('>Un<'), 'p3 en baisse, pas p1');
});

test('un mois isolé sans mois précédent : aucune comparaison inventée', () => {
  const r = rendre(); r.sel('du').value = String(mk(3)); r.sel('du').onchange();
  const r2 = rendre(); r2.sel('au').value = String(mk(3)); r2.sel('au').onchange();
  const h = rendre().html;
  assert.equal(heros(h), V2.fmtEur(1800), 'mars seul');
  assert.ok(h.includes('Pas de comparaison possible sur Mars 2026'), 'le dit en clair');
});

test('« 3 mois » : avril → juin, et on revient bien aux boutons rapides', () => {
  rendre().seg('3m').onclick();
  const h = rendre().html;
  assert.equal(heros(h), V2.fmtEur(2000 + 4000 + 8000 + 200 + 400 + 800 + 600 + 5 + 5));
  assert.ok(!h.includes('pilo-persel'), 'les listes disparaissent hors « Choisir »');
});
