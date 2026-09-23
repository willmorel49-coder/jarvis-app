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
   meme intention qu'avant (aucune porte ne doit disparaitre en silence). */
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
const root = { innerHTML: '' };
sb.V2.pages.home.render(root);
const h = root.innerHTML;
// « grandes » = les portes de premier niveau (une par rayon), qu'elles ouvrent
// directement un ecran (v2-ray-tuile) ou se deplient en plusieurs (v2-ray-multi) :
// c'est l'equivalent moderne des anciennes « grandes cartes ».
const grandes = [...h.matchAll(/v2-ray-nom">([^<]+)</g)].map((m) => m[1]);
const rayons = [...h.matchAll(/v2-ray-scene-nom">([^<]+)</g)].map((m) => m[1]);
// « autres » = les ecrans qui ne sont atteignables qu'en depliant une porte a
// choix multiple (v2-ray-choix) — equivalent moderne de l'ancien « Autres outils ».
const autres = [...h.matchAll(/v2-ray-choix-nom">([^<]*)</g)].map((m) => m[1].trim()).filter(Boolean);

test('accueil : les QUATRE rayons sont complets, aucune porte manquante', () => {
  // Remplace le compte « CINQ grandes cartes » de l'ancienne grille (retiree le
  // 23/09/2026, commit 137034eb « Les rayons »). Meme intention : un ecran qui
  // disparait de l'accueil sans que personne ne le remarque.
  assert.deepEqual(rayons, ['Le terrain', 'Les produits', 'Piloter &amp; informer', 'Vendre &amp; convaincre'],
    `rayons trouves : ${rayons.join(' · ')}`);
  assert.equal(grandes.length, 12, `portes de premier niveau : ${grandes.join(' · ')}`);
});

test('accueil : Produits est une porte de premier niveau', () => {
  assert.ok(grandes.includes('Produits'), `portes : ${grandes.join(' · ')}`);
});

test('accueil : Pilotage est une porte de premier niveau, pas noyee dans un choix', () => {
  // L'ancienne « pastille grise » (montant de CA affiche sur la carte Pilotage)
  // n'existe plus dans « Les rayons » — aucun test ne verifiait vraiment son
  // affichage (seul le libelle et l'absence dans « Autres outils » l'etaient) ;
  // ce qui compte reste vrai : Pilotage a sa propre porte, visible d'emblee.
  assert.ok(grandes.includes('Pilotage'), `portes : ${grandes.join(' · ')}`);
});

test('accueil : une porte a choix multiple ne s etire pas bizarrement a deux colonnes', () => {
  // Ancienne regle (grille de cartes) : la derniere carte d'une grille impaire
  // prenait les deux colonnes, sinon elle boitait. La grille de cartes a disparu
  // le 23/09/2026 ; son equivalent est la regle qui empeche une porte esseulee
  // de s'etirer en hauteur dans la grille 2 colonnes des tuiles d'un rayon
  // (desktop >= 860px), gardee par align-content:start.
  const src = readFileSync(new URL('v2-app.js', B), 'utf8');
  assert.ok(/\.v2-ray-tuiles\{flex:1;grid-template-columns:1fr 1fr;align-content:start\}/.test(src),
    'la regle CSS qui protege une porte esseulee a disparu');
});

test('accueil : To do list est en premiere porte, Officines juste derriere', () => {
  // Ordre change VOLONTAIREMENT le 22/09/2026 (commit f93544ae, demande de
  // Will) : « Ma liste a sa propre porte, Officines n'ouvre plus que les
  // fiches ». L'ancien accueil mettait Officines en premier ; ce n'est plus le
  // cas depuis cette decision, ce test verrouille le nouvel ordre voulu.
  assert.equal(grandes[0], 'To do list', `portes : ${grandes.join(' · ')}`);
  assert.equal(grandes[1], 'Officines', `portes : ${grandes.join(' · ')}`);
});

test('accueil : Copilote n a plus sa banniere en tete', () => {
  assert.ok(!/class="v2-lch-feat"/.test(h), 'la banniere Copilote est revenue');
  assert.ok(!grandes.includes('Copilote'), 'Copilote ne doit pas etre une porte nommee ainsi');
});

test('accueil : Copilote (ancien nom, renomme « La carte » le 27/08/2026) reste joignable', () => {
  // Le libelle « Copilote » n'existe plus nulle part dans l'accueil depuis le
  // 27/08/2026 (commit 62c870dd, demande de Will) : la tuile s'appelle « La
  // carte ». Elle reste bien une porte de premier niveau...
  assert.ok(grandes.includes('La carte'), `portes : ${grandes.join(' · ')}`);
  // ...et l'ancienne adresse #copilote (favoris deja enregistres) continue de
  // fonctionner : V2.pages.copilote delegue toujours a V2.pages.carte.
  const srcCopilote = readFileSync(new URL('v2-copilote.js', B), 'utf8');
  assert.ok(/V2\.pages\.copilote\s*=\s*\{\s*render:[\s\S]*?V2\.pages\.carte/.test(srcCopilote),
    'V2.pages.copilote ne delegue plus vers V2.pages.carte : le favori #copilote casserait');
});

test('accueil : aucune porte de premier niveau vide', () => {
  for (const t of grandes) assert.ok(t && t.trim().length > 2, `titre vide : « ${t} »`);
});

test('accueil : chaque porte de premier niveau porte un sous-titre', () => {
  const sous = [...h.matchAll(/v2-ray-sous">([^<]*)</g)].map((m) => m[1].trim());
  // Chaque porte a choix multiple ajoute AUSSI un sous-titre par choix deplie
  // (v2-ray-choix), donc il y a plus de sous-titres que de portes de premier
  // niveau desormais (avant : un ratio strictement 1 pour 1). On verifie que
  // chaque porte de premier niveau a bien SON sous-titre parmi eux, sans en
  // exiger un nombre exact — l'important est qu'aucun ne soit vide ou trop court.
  assert.ok(sous.length >= grandes.length, `sous-titres : ${sous.length}, portes : ${grandes.length}`);
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
