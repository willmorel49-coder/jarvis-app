/* Rend l'ACCUEIL dans un faux DOM et verifie sa composition.
   Il n'y avait aucun test dessus : le 11/08, retirer la tuile « Par molecule »
   a laisse un TROU dans la grille des 4 grandes cartes — 3 s'affichaient, et
   personne ne l'a vu. Ce fichier verrouille la composition. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const B = new URL('../crm/v2/', import.meta.url);

const parId = {};
const doc = {
  getElementById: (id) => parId[id] || null,
  createElement: () => ({ id: '', textContent: '', style: {} }),
  head: { appendChild(el) { if (el.id) parId[el.id] = el; } },
  documentElement: { style: { setProperty() {} } },
  body: { appendChild() {} },
  addEventListener() {},
  querySelector: () => null,
  readyState: 'complete',
};
const sb = {
  document: doc, console, setTimeout: () => 0, clearTimeout() {}, Date,
  localStorage: { getItem: () => null, setItem() {} },
  navigator: { userAgent: 'node' }, location: { hash: '' },
};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);

// Piliers factices : seule leur PRESENCE conditionne l'affichage des entrees.
vm.runInContext(`window.V2 = { pages:{}, sales:[], pharmacies:[], route:{name:'home',param:null},
  esc: s => String(s==null?'':s), fmtEur: n => n+' €', fmtNum: n => String(n), fmtK: n => String(n),
  sumCA: a => a.reduce((s,x)=>s+(x.mntNetHt||0),0),
  topbar: () => '', go(){}, toast(){}, render(){} };
  ['produits','fiches','offilog','pilotage','infos','copilote','carte','molecules','biosimilaires',
   'audit','missions','appro','grossistes','remontees','rdv','marketing','presentation','catalogue','pharma']
    .forEach(k => { V2.pages[k] = { render(){} }; });
  window.ICO = () => '';`, sb);
vm.runInContext(readFileSync(new URL('v2-app.js', B), 'utf8'), sb);

sb.V2.pharmacies = [{ id: '1', name: 'A', ca: 1000 }];
sb.V2.sales = [{ pharmacyId: '1', mntNetHt: 1000 }];
const root = { innerHTML: '' };
sb.V2.pages.home.render(root);
const h = root.innerHTML;
const grandes = [...h.matchAll(/v2-lch-t">([^<]+)</g)].map((m) => m[1]);
const autres = [...h.matchAll(/v2-lch-mini"[^>]*>([^<]*)</g)].map((m) => m[1].trim()).filter(Boolean);

test('accueil : la grille compte bien QUATRE grandes cartes', () => {
  assert.equal((h.match(/v2-lch-card/g) || []).length, 4,
    `grille incomplete : ${grandes.join(' · ')}`);
});

test('accueil : Produits est une grande carte', () => {
  assert.ok(grandes.includes('Produits'), `grandes cartes : ${grandes.join(' · ')}`);
});

test('accueil : Officines reste en premier', () => {
  assert.equal(grandes[0], 'Officines');
});

test('accueil : Copilote n a plus sa banniere en tete', () => {
  assert.ok(!/class="v2-lch-feat"/.test(h), 'la banniere Copilote est revenue');
  assert.ok(!grandes.includes('Copilote'), 'Copilote ne doit pas etre une grande carte');
});

test('accueil : Copilote reste joignable dans « Autres outils »', () => {
  assert.ok(autres.includes('Copilote'), `autres outils : ${autres.join(' · ')}`);
});

test('accueil : aucune grande carte vide', () => {
  for (const t of grandes) assert.ok(t && t.trim().length > 2, `titre vide : « ${t} »`);
});

test('accueil : chaque grande carte porte un sous-titre', () => {
  const sous = [...h.matchAll(/v2-lch-d">([^<]*)</g)].map((m) => m[1].trim());
  assert.equal(sous.length, grandes.length);
  for (const s of sous) assert.ok(s.length > 5, `sous-titre trop court : « ${s} »`);
});

test('accueil : les ecrans retires des tuiles restent joignables', () => {
  // catalogue, molecules et appro ont quitte l'accueil le 11/08 ; ils doivent
  // rester atteignables, sinon on fabrique des ecrans morts.
  const src = readFileSync(new URL('v2-app.js', B), 'utf8');
  for (const k of ['molecules', 'appro']) {
    assert.ok(src.includes(`['${k}',`), `${k} absent de la palette ⌘K`);
  }
});
