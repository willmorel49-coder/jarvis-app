// 26/11/2026 — Copilote au téléphone : choix de Will sur la planche « JARVIS au téléphone : 11 choix », sujet 8.
// Premier choix (« La retirer ») annulé le jour même : un lien de Pilotage mène à cette page. Choix retenu : la VERSION 2,
// « La garder, sans les voyants » — au téléphone, les quatre pastilles sous le titre (Marché France, Ruptures ANSM, Zones,
// Saisonnalité : des voyants de données qui ressemblent à des boutons) ne s'affichent plus, le premier contenu remonte.
// Ce que ce test garde, en faisant tourner le vrai fichier (crm/v2/v2-copilote.js) dans node:vm :
//   · la règle qui masque les pastilles n'existe que sous 640 px, et elle gagne bien sur la règle qui les affiche ;
//   · l'ordinateur ne la reçoit pas : sa règle d'affichage et le HTML des pastilles sont intacts ;
//   · la page n'est pas retirée : #marche l'ouvre toujours, même quand La carte est chargée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { regles, sousTelephone, largeurMax, selecteurs, poids, compare } from './aide-css-telephone.mjs';

const SRC = readFileSync(new URL('../crm/v2/v2-copilote.js', import.meta.url), 'utf8');

// La page montée dans une fausse fenêtre, sans données : elle pose sa feuille de style puis son écran d'attente.
function monter({ carte = false } = {}) {
  const feuilles = [], adresses = [];
  const doc = {
    getElementById: () => null, head: { appendChild() {} }, addEventListener() {},
    createElement: (t) => { const o = { tag: t, id: '', style: {} }; if (t === 'style') feuilles.push(o); return o; }
  };
  const ctx = {
    document: doc, console, setTimeout, clearTimeout, Date, Promise, Math, Object, Array, String, Number, JSON, RegExp, isFinite, parseFloat, parseInt,
    location: { pathname: '/crm/v2/index.html', search: '', hash: '#marche' }, history: { replaceState: (...a) => adresses.push(a) }, ICO: () => ''
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.V2 = {
    pages: {}, sales: [], pharmacies: [], route: { name: 'marche', param: null },
    esc: (s) => String(s == null ? '' : s), fmtEur: String, fmtNum: String, topbar: () => '', go() {}, toast() {}, render() {}
  };
  if (carte) ctx.V2.pages.carte = { render: (root) => { root.innerHTML = '<h1 class="cn-h1">La carte</h1>'; } };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const root = { innerHTML: '' };
  return { V2: ctx.V2, root, feuilles, adresses };
}
// Les règles de la feuille que la page pose vraiment (lue comme le navigateur la lit).
function feuille() {
  const p = monter(); p.V2.pages.marche.render(p.root);
  assert.equal(p.feuilles.length, 1, 'marqueur : la page a posé sa feuille de style');
  const rs = regles(p.feuilles[0].textContent);
  assert.ok(rs.length > 150, 'marqueur : la feuille est bien lue (' + rs.length + ' règles)');
  return rs;
}
const vise = (r, sel) => selecteurs(r.sel).includes(sel);

test('téléphone : les quatre pastilles sous le titre sont masquées par une règle sous 640 px', () => {
  const rs = feuille(), cache = rs.filter((r) => vise(r, '.co-feeds') && /display\s*:\s*none/.test(r.decl));
  assert.equal(cache.length, 1, 'une seule règle masque .co-feeds');
  assert.equal(cache[0].decl.replace(/\s|;/g, ''), 'display:none', 'elle ne fait que cela');
  assert.equal(selecteurs(cache[0].sel).length, 1, 'elle ne vise que le bloc des pastilles');
  assert.ok(sousTelephone(cache[0]), 'elle est dans un @media de 640 px ou moins');
  assert.deepEqual(cache[0].medias.map(largeurMax), [640], 'exactement « max-width:640px », sans autre condition');
});

test('téléphone : la règle qui masque gagne sur celle qui affiche (même poids, écrite après)', () => {
  const rs = feuille();
  const iAffiche = rs.findIndex((r) => vise(r, '.co-feeds') && /display\s*:\s*flex/.test(r.decl)), iCache = rs.findIndex((r) => vise(r, '.co-feeds') && /display\s*:\s*none/.test(r.decl));
  assert.ok(iAffiche >= 0 && iCache > iAffiche, 'la règle du téléphone vient après la règle d’affichage');
  assert.equal(compare(poids('.co-feeds'), poids('.co-feeds')), 0);
  // aucune autre règle ne remet les pastilles à l'écran après elle
  const apres = rs.slice(iCache + 1).filter((r) => /co-feeds/.test(r.sel) && /display\s*:/.test(r.decl));
  assert.deepEqual(apres.map((r) => r.sel), [], 'rien ne réaffiche .co-feeds plus bas dans la feuille');
});

test('ordinateur : il ne reçoit pas la règle — l’affichage des pastilles et leur dessin sont intacts', () => {
  const rs = feuille(), grand = rs.filter((r) => !sousTelephone(r));
  const affiche = grand.filter((r) => vise(r, '.co-feeds'));
  assert.equal(affiche.length, 1, 'une seule règle .co-feeds hors téléphone');
  assert.equal(affiche[0].decl, 'display:flex;flex-wrap:wrap;gap:6px;margin-top:14px', 'la règle d’avant, mot pour mot');
  assert.deepEqual(affiche[0].medias, [], 'hors de tout @media');
  assert.ok(!grand.some((r) => /co-feed/.test(r.sel) && /display\s*:\s*none/.test(r.decl)), 'aucun « display:none » sur les pastilles hors téléphone');
  assert.equal(grand.filter((r) => /\.co-feed\b/.test(r.sel)).length, 6, 'les 6 règles de dessin d’une pastille (.co-feed…) sont toujours là');
  // sous 640 px, rien d'autre que ce masquage ne touche les pastilles
  assert.equal(rs.filter((r) => sousTelephone(r) && /co-feed/.test(r.sel)).length, 1);
});

test('rien n’est retiré du code : les pastilles sont toujours écrites dans la page, sans condition de largeur', () => {
  assert.match(SRC, /<p>Le cerveau de votre tournée[^\n]*<\/p>' \+\n\s+feedStrip\(nbTension\) \+\n\s+'<\/div>' \+/, 'le bandeau des pastilles est toujours appelé sous le titre');
  const f = SRC.slice(SRC.indexOf('function feedStrip('), SRC.indexOf('function tensionBadge('));
  assert.ok(f.length > 400, 'fonction feedStrip retrouvée');
  for (const m of ['Marché France', 'Ruptures ANSM', 'Zones · ', 'Saisonnalité', 'class="co-feeds"']) assert.ok(f.includes(m), m + ' toujours écrit');
  assert.doesNotMatch(f, /matchMedia|innerWidth/, 'le HTML est le même au téléphone et à l’ordinateur : seul le style décide');
});

test('la page n’est pas retirée : #marche ouvre toujours Copilote, même quand La carte est chargée', () => {
  const p = monter({ carte: true });
  p.V2.pages.marche.render(p.root);
  assert.match(p.root.innerHTML, /<div class="co-hero"><h1>Copilote<\/h1><p>Chargement des données réseau…<\/p><\/div>/, 'c’est la page Copilote (ici sans données : son écran d’attente)');
  assert.doesNotMatch(p.root.innerHTML, /La carte/);
  assert.equal(p.V2.route.name, 'marche', 'la route ne change pas');
  assert.equal(p.adresses.length, 0, 'l’adresse n’est pas réécrite');
  assert.equal(SRC.split('V2.pages.marche = {').length - 1, 1, 'une seule définition de la page');
  assert.doesNotMatch(SRC, /copiloteAncien|replaceState/, 'il ne reste rien du retrait annulé');
  // #copilote, lui, ouvre toujours La carte (inchangé)
  const q = monter({ carte: true });
  q.V2.pages.copilote.render(q.root);
  assert.equal(q.root.innerHTML, '<h1 class="cn-h1">La carte</h1>');
});
