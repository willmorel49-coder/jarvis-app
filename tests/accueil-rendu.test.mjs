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
   etait rouge depuis. Meme intention, nouvelles classes.

   Mis a jour le 03/10/2026 : l'accueil a encore change deux fois depuis —
   « le rail » (u2-*, commit 3d5e0f3d, 30/09) puis « les grandes portes »
   (commit 83510ff3, 02/10) : outils epingles en grandes portes + quatre groupes
   (Mes clients, Produits et prix, Piloter et veiller, Communiquer et progresser).
   Le faux DOM des anciennes classes hv-* plantait au chargement (`hors.
   addEventListener is not a function`) et la CI etait rouge depuis le 02/10.
   Les classes de mise en page ayant deja change trois fois en dix jours, les
   assertions s'ancrent desormais sur ce qui est STABLE : le registre des outils
   (G4_PORTES, lu dans le source), et pour chaque outil un lien `#cle` portant
   data-tool dans le rendu, un libelle et une phrase non vides. Meme intention
   depuis le 11/08 : aucun outil ne disparait de l'accueil en silence, pas de
   trou, pas de porte vide, chaque porte a sa phrase, les ecrans retires des
   tuiles restent joignables. Les outils retires volontairement le 02/10
   (commit d09043c5 : audit de marge, Fiches PDF ; plus l'argumentaire, la
   reforme 2027 et la presentation Integral) ne sont plus exiges : le test
   verifie au contraire qu'ils ne reviennent pas en porte morte. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const B = new URL('../crm/v2/', import.meta.url);
const src = readFileSync(new URL('v2-app.js', B), 'utf8');

// Le registre des outils, lu TEL QUEL dans le source : c'est la liste que
// l'accueil doit montrer en entier. Un nouvel outil ajoute au registre est
// verifie sans toucher ce fichier.
const mReg = src.match(/var G4_PORTES = (\{[\s\S]*?\n  \});/);
assert.ok(mReg, 'registre G4_PORTES introuvable dans v2-app.js : a-t-il ete renomme ?');
const REG = vm.runInNewContext('(' + mReg[1] + ')');
const CLES = Object.keys(REG);
const mFam = src.match(/var U2_FAMS = (\[\[[\s\S]*?\]\]);/);
assert.ok(mFam, 'liste des groupes U2_FAMS introuvable dans v2-app.js');
const FAMS = vm.runInNewContext(mFam[1]);   // [[cle, nom, picto], ...]

// Faux DOM minimal : de quoi monter l'accueil, rien de plus.
const parId = {};
const noeud = () => ({
  id: '', textContent: '', innerHTML: '', className: '', style: {}, parentNode: null,
  setAttribute() {}, addEventListener() {}, appendChild() {}, querySelector: () => null,
  querySelectorAll: () => [], classList: { add() {}, remove() {}, contains: () => false },
});
const doc = {
  getElementById: (id) => parId[id] || null,
  createElement: () => noeud(),
  head: { appendChild(el) { if (el.id) parId[el.id] = el; } },
  documentElement: { style: { setProperty() {} } },
  body: Object.assign(noeud(), { appendChild() {} }),
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
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

// Piliers factices : seule la PRESENCE de l'ecran d'un outil conditionne son
// affichage (u2Cles) — on enregistre donc l'ecran de chaque outil du registre.
sb.__pages = [...new Set(Object.values(REG).map((d) => d.page).filter(Boolean))];
vm.runInContext(`window.V2 = { pages:{}, sales:[], pharmacies:[], route:{name:'home',param:null},
  esc: s => String(s==null?'':s), fmtEur: n => n+' €', fmtNum: n => String(n), fmtK: n => String(n),
  sumCA: a => a.reduce((s,x)=>s+(x.mntNetHt||0),0),
  topbar: () => '', go(){}, toast(){}, render(){} };
  window.__pages.concat(['produits','molecules','pilotage','todo','infos','rdv']).forEach(k => { V2.pages[k] = { render(){} }; });
  window.ICO = () => '';`, sb);
vm.runInContext(src, sb);

sb.V2.pharmacies = [{ id: '1', name: 'A', ca: 1000 }];
sb.V2.sales = [{ pharmacyId: '1', mntNetHt: 1000 }];
const root = Object.assign(noeud(), { querySelector: () => null });
sb.V2.pages.home.render(root);
const h = root.innerHTML;
// Chaque lien d'outil du rendu : { data-tool, href }, tous styles de balise confondus.
const liens = [...h.matchAll(/<a\b[^>]*>/g)].map((m) => m[0])
  .filter((a) => /data-tool="/.test(a))
  .map((a) => ({ k: /data-tool="([^"]+)"/.exec(a)[1], href: (/href="([^"]*)"/.exec(a) || [])[1] }));
const montres = new Set(liens.map((l) => l.k));

test('accueil : le rendu a bien monte (marqueur positif, pas une page vide)', () => {
  assert.ok(h.length > 500, 'accueil vide ou presque : ' + h.slice(0, 200));
  assert.ok(montres.size > 0, 'aucun lien d outil dans le rendu');
  assert.ok(CLES.length >= 10, 'registre anormalement court : ' + CLES.join(' '));
});

test('accueil : aucun outil du registre ne disparait en silence', () => {
  // Meme intention depuis le 11/08 : un ecran qui disparait de l'accueil sans
  // que personne ne le remarque.
  const manquants = CLES.filter((k) => !montres.has(k));
  assert.deepEqual(manquants, [], 'outils du registre absents de l accueil : ' + manquants.join(' · '));
});

test('accueil : chaque outil mene quelque part (lien #cle, ou adresse externe)', () => {
  for (const l of liens) {
    if (REG[l.k] && REG[l.k].page === null) {
      assert.ok(/^https:\/\//.test(l.href), `${l.k} : lien externe attendu, trouve « ${l.href} »`);
    } else {
      assert.equal(l.href, '#' + l.k, `${l.k} : le lien ne mene plus a son ecran`);
    }
  }
});

test('accueil : pas de trou — chaque groupe du registre est rendu et aucun n est vide', () => {
  // Le 11/08, retirer une tuile a laisse un trou dans la grille. Aujourd'hui le
  // trou possible est un groupe sans outil ou un outil sans groupe.
  const nomsFam = new Set(FAMS.map((f) => f[0]));
  for (const k of CLES) assert.ok(nomsFam.has(REG[k].fam), `${k} : groupe « ${REG[k].fam} » inconnu de U2_FAMS`);
  for (const [cle, nom] of FAMS) {
    assert.ok(CLES.some((k) => REG[k].fam === cle), `groupe vide dans le registre : ${nom}`);
    assert.ok(h.includes(nom), `groupe « ${nom} » absent du rendu`);
  }
});

test('accueil : aucune porte vide, chaque porte porte un libelle et une phrase', () => {
  for (const k of CLES) {
    const d = REG[k];
    assert.ok(d.nom && d.nom.trim().length > 2, `${k} : libelle vide`);
    assert.ok(d.ph && d.ph.trim().length > 5, `${k} : phrase absente ou trop courte`);
    // ...et ce libelle est bien celui qui s'affiche (le rendu echappe l'HTML : on
    // compare apres echappement des apostrophes).
    const nomRendu = d.nom.replace(/&/g, '&amp;');
    assert.ok(h.includes(nomRendu), `${k} : le libelle « ${d.nom} » n est pas dans le rendu`);
  }
});

test('accueil : les outils retires le 02/10 ne reviennent pas en porte morte', () => {
  // Retires volontairement (commit d09043c5 et demande de Will du 02/10) : un
  // test qui les exigerait serait perime, pas le code. On verifie l'inverse :
  // ni dans le registre, ni en lien dans le rendu.
  for (const k of ['audit', 'fiches', 'argument', 'reforme', 'presentation']) {
    assert.ok(!REG[k], `${k} est revenu dans le registre : decision du 02/10 a revoir`);
    assert.ok(!montres.has(k), `${k} est revenu sur l accueil`);
  }
});

test('accueil : Copilote (ancien nom, renomme « La carte » le 27/08/2026) reste joignable', () => {
  assert.ok(REG.carte && REG.carte.nom === 'La carte', 'la porte La carte a change');
  // ...et l'ancienne adresse #copilote (favoris deja enregistres) continue de
  // fonctionner : V2.pages.copilote delegue toujours a V2.pages.carte.
  const srcCopilote = readFileSync(new URL('v2-copilote.js', B), 'utf8');
  assert.ok(/V2\.pages\.copilote\s*=\s*\{\s*render:[\s\S]*?V2\.pages\.carte/.test(srcCopilote),
    'V2.pages.copilote ne delegue plus vers V2.pages.carte : le favori #copilote casserait');
});

test('accueil : les ecrans retires des tuiles restent joignables', () => {
  // molecules a quitte l'accueil le 11/08 ; il doit rester atteignable (palette
  // ⌘K), sinon on fabrique un ecran mort. Appro est revenu en porte le 02/09.
  assert.ok(src.includes("['molecules',"), 'molecules absent de la palette ⌘K');
  assert.ok(REG.appro, 'appro n est plus une porte de l accueil');
});
