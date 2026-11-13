/* « Officines actives » de l'Accueil = au moins une ligne de vente, comme Groupements.
   Le 13/11/2026 en production : Accueil 2 098 contre Groupements 2 099. L'Accueil
   comptait les officines au chiffre d'affaires > 0 (v2-app.js) ; Groupements, celles
   qui ont au moins une ligne de vente (aDesVentes, v2-pharma.js). L'écart : une officine
   dont les retours dépassent les achats. Will a choisi le 14/11 d'aligner l'Accueil.
   Le compte se fait sur TOUTES les ventes, même pour un commercial restreint : l'Accueil
   l'écrit « dans tout le réseau » ; avant, un restreint ne voyait compter que les siennes. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../crm/v2/v2-app.js', import.meta.url), 'utf8');

const noeud = () => ({
  id: '', textContent: '', innerHTML: '', className: '', style: {}, parentNode: null,
  setAttribute() {}, addEventListener() {}, appendChild() {}, querySelector: () => null,
  querySelectorAll: () => [], classList: { add() {}, remove() {}, contains: () => false },
});
const parId = {};
const doc = {
  getElementById: (id) => parId[id] || null,
  createElement: () => noeud(),
  head: { appendChild(el) { if (el.id) parId[el.id] = el; } },
  documentElement: { style: { setProperty() {} } },
  body: Object.assign(noeud(), { appendChild() {} }),
  addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
  readyState: 'complete',
};
const mem = () => ({ getItem: () => null, setItem() {}, removeItem() {} });
const sb = {
  document: doc, console, setTimeout: () => 0, clearTimeout() {}, Date,
  localStorage: mem(), sessionStorage: mem(),
  navigator: { userAgent: 'node' }, location: { hash: '' },
};
sb.addEventListener = () => {}; sb.removeEventListener = () => {};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(`window.V2 = { pages:{}, sales:[], pharmacies:[], route:{name:'home',param:null},
  esc: s => String(s==null?'':s), fmtEur: n => n+' €', fmtNum: n => String(n), fmtK: n => String(n),
  sumCA: a => a.reduce((s,x)=>s+(x.mntNetHt||0),0),
  topbar: () => '', go(){}, toast(){}, render(){} };
  ['produits','molecules','pilotage','todo','infos','rdv','pharma','groupements'].forEach(k => { V2.pages[k] = { render(){} }; });
  window.ICO = () => '';`, sb);
vm.runInContext(src, sb);

// A : achète (CA +1 000). B : a commandé, mais ses retours dépassent ses achats (CA −50).
// C : aucune ligne de vente.
const PHS = [{ id: '1', name: 'A', comms: ['Karine'] }, { id: '2', name: 'B', comms: ['Pauline'] }, { id: '3', name: 'C', comms: [] }];
const VENTES = () => [
  { pharmacyId: '1', mntNetHt: 1000 },
  { pharmacyId: '2', mntNetHt: 100 }, { pharmacyId: '2', mntNetHt: -150 },
];
function actives() {
  const root = Object.assign(noeud(), { querySelector: () => null });
  sb.V2.pages.home.render(root);
  const m = /<b>([\d\s  ]+)<\/b> officines? actives?/.exec(root.innerHTML);
  assert.ok(m, 'nombre d officines actives introuvable dans le rendu de l Accueil : ' + root.innerHTML.slice(0, 300));
  return Number(m[1].replace(/\D/g, ''));
}

test('accueil : l officine qui a commandé, même au CA négatif, compte parmi les actives', () => {
  sb.V2.pharmacies = PHS; sb.V2.sales = VENTES(); sb.V2.user = null;
  assert.equal(actives(), 2);
});

test('accueil : le compte témoin ne compte pas l officine sans aucune vente', () => {
  sb.V2.pharmacies = PHS; sb.V2.sales = [{ pharmacyId: '1', mntNetHt: 1000 }]; sb.V2.user = null;
  assert.equal(actives(), 1);
});

test('accueil : commercial restreint, le compte reste celui de tout le réseau', () => {
  sb.V2.pharmacies = PHS; sb.V2.sales = VENTES();
  sb.V2.user = { commercial: 'Karine', voitTous: false, voitTousReel: false, voitAussi: [] };
  // masquage d'écran du restreint (v2-boot.js) : il ne voit les CHIFFRES que de ses officines
  sb.V2.ventesVisibles = (rows) => (rows || []).filter((s) => s.pharmacyId === '1');
  try { assert.equal(actives(), 2); } finally { delete sb.V2.ventesVisibles; sb.V2.user = null; }
});
