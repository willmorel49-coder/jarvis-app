/* Rend l'ACCUEIL dans un faux DOM et verifie sa composition.
   Il n'y avait aucun test dessus : le 11/08, retirer la tuile « Par molecule »
   a laisse un TROU dans la grille des 4 grandes cartes — 3 s'affichaient, et
   personne ne l'a vu. Ce fichier verrouille la composition.

   Mis a jour le 23/09/2026 : l'accueil « grille de grandes cartes » (v2-lch-*)
   a ete remplace par « Les rayons » (v2-ray-*, commit 137034eb puis 7084a6c7 et
   3294bd28) — 4 rayons illustres, chacun avec ses portes ; une porte qui ouvre
   plusieurs ecrans se deplie sur place au lieu d'afficher des sous-liens. Les
   classes v2-lch-card/v2-lch-t/v2-lch-mini/v2-lch-feat n'existent plus : les
   tests ci-dessous verrouillent desormais la composition des rayons, avec la
   meme intention qu'avant (aucune porte ne doit disparaitre en silence).

   Mis a jour le 25/09/2026 : « Les rayons » a ete remplace le 24/09 par
   « Les objets bien rangés » (accueil v5, commit 45c0cbae) : une grande tuile
   To do list, une grille de 4 grandes tuiles (hv-grand), puis des rayons faits
   de lignes (hv-ligne). Le test etait reste sur les classes v2-ray-* et
   plantait sur hvReveler (le faux root n'avait pas querySelectorAll) : la CI
   etait rouge depuis. Meme intention, nouvelles classes. */
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
   'audit','missions','appro','grossistes','remontees','rdv','marketing','presentation','catalogue','pharma',
   'todo','argument','concurrents','carteGrp']
    .forEach(k => { V2.pages[k] = { render(){} }; });
  window.ICO = () => '';`, sb);
vm.runInContext(readFileSync(new URL('v2-app.js', B), 'utf8'), sb);

sb.V2.pharmacies = [{ id: '1', name: 'A', ca: 1000 }];
sb.V2.sales = [{ pharmacyId: '1', mntNetHt: 1000 }];
const root = { innerHTML: '', querySelectorAll: () => [] };
sb.V2.pages.home.render(root);
const h = root.innerHTML;
// « grandes » = la tuile To do list et les 4 grandes tuiles de la grille
// (hv-todo, hv-grand) : l'equivalent des anciennes « grandes cartes ».
const nomsDe = (cls) => [...h.matchAll(new RegExp('class="hv-porte ' + cls + '[^"]*"[\\s\\S]*?hv-nom">([^<]+)<', 'g'))].map((m) => m[1]);
const grandes = [...nomsDe('hv-todo'), ...nomsDe('hv-grand')];
const lignes = nomsDe('hv-ligne');
const rayons = [...h.matchAll(/hv-rayon-nom">([^<]+)</g)].map((m) => m[1]);

test('accueil : les QUATRE rayons sont complets, aucune porte manquante', () => {
  // Meme intention depuis le 11/08 : un ecran qui disparait de l'accueil sans
  // que personne ne le remarque.
  assert.deepEqual(rayons, ['Le terrain', 'Les produits', 'Piloter &amp; informer', 'Vendre &amp; convaincre'],
    `rayons trouves : ${rayons.join(' · ')}`);
  assert.equal(grandes.length, 5, `grandes tuiles : ${grandes.join(' · ')}`);
  assert.equal(lignes.length, 9, `lignes des rayons : ${lignes.join(' · ')}`);
});

test('accueil : Produits est une grande tuile', () => {
  // Depuis le 24/09 la tuile s'appelle « Catalogue produits » et ouvre V2.pages.produits.
  assert.ok(grandes.includes('Catalogue produits'), `grandes : ${grandes.join(' · ')}`);
  assert.ok(/class="hv-porte hv-grand"[^>]*onclick="V2\.go\('produits'\)"/.test(h), 'la grande tuile Produits n ouvre plus V2.pages.produits');
});

test('accueil : Pilotage est une grande tuile, pas noyee dans un rayon', () => {
  assert.ok(grandes.includes('Pilotage'), `grandes : ${grandes.join(' · ')}`);
  assert.ok(!lignes.includes('Pilotage'), 'Pilotage est redescendu dans un rayon');
});

test('accueil : la grille des grandes tuiles n a pas de trou', () => {
  // Le 11/08, retirer une tuile a laisse un TROU dans une grille a 2 colonnes.
  // La grille hv-grille est a 2 colonnes : elle doit compter un nombre pair de tuiles.
  const src = readFileSync(new URL('v2-app.js', B), 'utf8');
  assert.ok(/\.hv-grille\{display:grid;grid-template-columns:1fr 1fr/.test(src), 'la grille a change de nombre de colonnes : revoir ce test');
  const dansGrille = nomsDe('hv-grand');
  assert.equal(dansGrille.length % 2, 0, `grille impaire : ${dansGrille.join(' · ')}`);
});

test('accueil : To do list est en premiere porte, Officines juste derriere', () => {
  // Ordre voulu depuis le 22/09/2026 (commit f93544ae, demande de Will).
  assert.equal(grandes[0], 'To do list', `grandes : ${grandes.join(' · ')}`);
  assert.equal(grandes[1], 'Officines', `grandes : ${grandes.join(' · ')}`);
});

test('accueil : Copilote n a plus sa banniere en tete', () => {
  assert.ok(!/class="v2-lch-feat"/.test(h), 'la banniere Copilote est revenue');
  assert.ok(!grandes.includes('Copilote') && !lignes.includes('Copilote'), 'Copilote ne doit pas etre une porte nommee ainsi');
});

test('accueil : Copilote (ancien nom, renomme « La carte » le 27/08/2026) reste joignable', () => {
  // La tuile s'appelle « La carte » depuis le 27/08/2026 (commit 62c870dd).
  assert.ok(grandes.includes('La carte'), `grandes : ${grandes.join(' · ')}`);
  // ...et l'ancienne adresse #copilote (favoris deja enregistres) continue de
  // fonctionner : V2.pages.copilote delegue toujours a V2.pages.carte.
  const srcCopilote = readFileSync(new URL('v2-copilote.js', B), 'utf8');
  assert.ok(/V2\.pages\.copilote\s*=\s*\{\s*render:[\s\S]*?V2\.pages\.carte/.test(srcCopilote),
    'V2.pages.copilote ne delegue plus vers V2.pages.carte : le favori #copilote casserait');
});

test('accueil : aucune porte vide', () => {
  for (const t of [...grandes, ...lignes]) assert.ok(t && t.trim().length > 2, `titre vide : « ${t} »`);
});

test('accueil : chaque porte porte une phrase', () => {
  const phrases = [...h.matchAll(/hv-phrase">([^<]*)</g)].map((m) => m[1].trim());
  assert.equal(phrases.length, grandes.length + lignes.length, `phrases : ${phrases.length}, portes : ${grandes.length + lignes.length}`);
  for (const s of phrases) assert.ok(s.length > 5, `phrase trop courte : « ${s} »`);
});

test('accueil : les ecrans retires des tuiles restent joignables', () => {
  // catalogue, molecules et appro ont quitte l'accueil le 11/08 ; ils doivent
  // rester atteignables, sinon on fabrique des ecrans morts.
  const src = readFileSync(new URL('v2-app.js', B), 'utf8');
  for (const k of ['molecules', 'appro']) {
    assert.ok(src.includes(`['${k}',`), `${k} absent de la palette ⌘K`);
  }
});
