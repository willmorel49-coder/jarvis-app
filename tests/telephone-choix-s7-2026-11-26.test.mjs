// 26/11/2026 — Carte des groupements au téléphone : choix de Will sur la planche « JARVIS au téléphone : 11 choix »,
// sujet 7, version 1 (« Vingt, puis Voir plus »).
// Avant : sous la carte, le classement des 209 groupements s'affichait d'un bloc — treize écrans à faire défiler.
// Ce que ce test garde, en faisant tourner le vrai fichier (crm/v2/v2-carte-groupements.js) dans node:vm sur 25 faux groupements :
//   · au téléphone, la liste dense reste visible en arrivant et s'arrête au 20e ; « Voir les N autres groupements » ajoute la suite ;
//   · un tri ou une recherche repart des 20 premiers résultats ; l'export garde tout ;
//   · à l'ordinateur, la liste entière, sans bouton.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { regles, sousTelephone, selecteurs } from './aide-css-telephone.mjs';

const SRC = readFileSync(new URL('../crm/v2/v2-carte-groupements.js', import.meta.url), 'utf8');
const nb = (h, s) => h.split(s).length - 1;

// 25 groupements « G01 » à « G25 » : G01 a 25 clientes et 1 prospect, G25 a 1 cliente et 25 prospects.
function donnees(n = 25) {
  const grp = [], p = [];
  for (let g = 1; g <= n; g++) {
    grp.push('G' + String(g).padStart(2, '0'));
    for (let k = 0; k < n + 1 - g; k++) p.push([48, 2, 0, g - 1, 1, 1, 'PHARMACIE ' + g + '-' + k, '', '', '', '', '', 1000, 'c' + g + '-' + k]);
    for (let k = 0; k < g; k++) p.push([48, 2, 0, g - 1, 0, 0, 'PROSPECT ' + g + '-' + k, '', '', '', '', '', 0, 'p' + g + '-' + k]);
  }
  return { p, grp, seg: ['Prospect', 'Client A'], comm: ['', 'Karine'] };
}

// L'écran monté dans une fausse fenêtre. `tel` : la fenêtre fait-elle 640 px ou moins ?
function monter({ tel, n = 25 }) {
  const el = {}, feuilles = [], blobs = [];
  const noeud = (id) => el[id] || (el[id] = { id, innerHTML: '', value: '', textContent: '', style: {}, scrollTop: 0, focus() {} });
  const doc = {
    getElementById: (id) => id === 'v2-cg-css' ? null : noeud(id),
    createElement: (t) => { const o = { tag: t, click() {} }; if (t === 'style') feuilles.push(o); return o; },
    head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} }
  };
  const ctx = {
    console, Date, Math, JSON, String, Object, Array, RegExp, document: doc,
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0,
    matchMedia: (q) => ({ matches: /max-width:\s*640px/.test(q) ? tel : false }),
    ICO: () => '<svg></svg>', PHARMA_FR: donnees(n), GRP_PROSPECTS: [],
    Blob: class { constructor(parts) { blobs.push(parts.join('')); } }, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }
  };
  ctx.window = ctx;
  ctx.V2 = { pages: {}, topbar: () => '<header></header>' };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const arriver = () => { ctx.V2.pages.carteGrp.render(noeud('racine')); return el['cg-list'].innerHTML; };
  return { V2: ctx.V2, el, feuilles, blobs, arriver };
}
const lignes = (h) => [...h.matchAll(/<div class="cg-rk-row" data-g="([^"]+)"[^>]*><span class="cg-rk-n">(\d+)<\/span>/g)].map((m) => m[2] + ':' + m[1]);
const bouton = (h) => (/<div class="cg-rk-fin"><button type="button" class="v2-btn cg-rk-plus" onclick="V2\.cgRankTout\(\)">([^<]+)<\/button><\/div>/.exec(h) || [])[1] || null;

test('marqueur : à l’ordinateur, le classement des 25 groupements s’affiche en entier, trié par clientes', () => {
  const h = monter({ tel: false }).arriver();
  const l = lignes(h);
  assert.equal(l.length, 25);
  assert.equal(l[0], '1:G01'); assert.equal(l[24], '25:G25');
  assert.match(h, /Tous les groupements · 25/);
  assert.equal(bouton(h), null);
});

test('téléphone : la liste reste visible en arrivant, s’arrête au 20e, puis « Voir les 5 autres groupements »', () => {
  const h = monter({ tel: true }).arriver();
  const l = lignes(h);
  assert.equal(l.length, 20, 'vingt lignes');
  assert.deepEqual([l[0], l[19]], ['1:G01', '20:G20'], 'les vingt premières du tri, numérotées de 1 à 20');
  assert.equal(bouton(h), 'Voir les 5 autres groupements', 'libellé de la planche, avec le vrai reste');
  assert.ok(h.indexOf('cg-rk-fin') > h.lastIndexOf('cg-rk-row'), 'le bouton vient après la 20e ligne');
  assert.match(h, /<div class="cg-rk-list" id="cg-rk-rows">/);
  assert.match(h, /Tous les groupements · 25/, 'le compteur dit toujours le total');
  for (const m of ['id="cg-rk-search"', 'V2.cgExport()', "V2.cgRankSort('c')", "V2.cgRankSort('ca')", "V2.cgRankSort('pr')", "V2.cgRankSort('pen')"]) assert.ok(h.includes(m), m + ' inchangé');
});

test('téléphone : le bouton ajoute la suite sous les 20 premiers, sans redessiner la recherche ni les tris', () => {
  const p = monter({ tel: true }); const avant = p.arriver();
  assert.equal(p.el['cg-rk-rows'], undefined, 'marqueur : la zone des lignes n’a pas encore été réécrite à part');
  p.V2.cgRankTout();
  const h = p.el['cg-rk-rows'].innerHTML, l = lignes(h);
  assert.equal(l.length, 25, 'les 25 lignes');
  assert.deepEqual([l[0], l[19], l[20], l[24]], ['1:G01', '20:G20', '21:G21', '25:G25'], 'les 20 premières ne bougent pas, la suite se numérote à partir de 21');
  assert.equal(bouton(h), null, 'le bouton s’en va une fois la suite affichée');
  assert.equal(p.el['cg-list'].innerHTML, avant, 'l’en-tête (compteur, recherche, tris) n’est pas réécrit');
});

test('téléphone : un tri repart des 20 premiers résultats', () => {
  const p = monter({ tel: true }); p.arriver(); p.V2.cgRankTout();
  p.V2.cgRankSort('pr');
  const h = p.el['cg-list'].innerHTML, l = lignes(h);
  assert.equal(l.length, 20);
  assert.deepEqual([l[0], l[19]], ['1:G25', '20:G06'], 'trié par prospects : G25 d’abord');
  assert.equal(bouton(h), 'Voir les 5 autres groupements');
});

test('téléphone : une recherche repart des 20 premiers résultats ; 20 résultats ou moins, pas de bouton', () => {
  const p = monter({ tel: true }); p.arriver(); p.V2.cgRankTout();
  p.V2.cgRankSearch('g');
  let h = p.el['cg-rk-rows'].innerHTML;
  assert.equal(lignes(h).length, 20, '25 résultats : 20 affichés');
  assert.equal(bouton(h), 'Voir les 5 autres groupements');
  p.V2.cgRankSearch('g0');
  h = p.el['cg-rk-rows'].innerHTML;
  assert.equal(lignes(h).length, 9, 'G01 à G09');
  assert.equal(bouton(h), null);
  assert.equal(p.el['cg-rk-count'].textContent, 'Tous les groupements · 9');
  p.V2.cgRankSearch('zzz');
  assert.match(p.el['cg-rk-rows'].innerHTML, /Aucun groupement ne correspond à « zzz »\./, 'recherche vide : le message d’avant, pas de bouton');
  assert.equal(bouton(p.el['cg-rk-rows'].innerHTML), null);
  p.V2.cgRankSearchClear();
  assert.equal(lignes(p.el['cg-rk-rows'].innerHTML).length, 20, 'recherche effacée : de nouveau 20');
});

test('téléphone : chaque arrivée sur l’écran repart de 20 ; un seul groupement en plus se dit au singulier', () => {
  const p = monter({ tel: true }); p.arriver(); p.V2.cgRankTout();
  assert.equal(lignes(p.arriver()).length, 20, 'revenu sur l’écran : 20');
  const q = monter({ tel: true, n: 21 });
  assert.equal(bouton(q.arriver()), 'Voir l’autre groupement');
  const r = monter({ tel: true, n: 20 }), h = r.arriver();
  assert.equal(lignes(h).length, 20);
  assert.equal(bouton(h), null, '20 groupements tout juste : pas de bouton');
});

test('téléphone : l’export garde les 25 groupements (rien ne disparaît)', () => {
  const p = monter({ tel: true }); p.arriver();
  p.V2.cgExport();
  assert.equal(p.blobs.length, 1);
  const l = p.blobs[0].split('\n');
  assert.equal(l.length, 26, 'un en-tête et 25 lignes');
  assert.match(l[25], /^G25;1;25;/);
});

test('ordinateur : ni tri, ni recherche, ni retour ne coupent la liste', () => {
  const p = monter({ tel: false }); p.arriver();
  p.V2.cgRankSort('pen');
  assert.equal(lignes(p.el['cg-list'].innerHTML).length, 25);
  p.V2.cgRankSearch('g');
  assert.equal(lignes(p.el['cg-rk-rows'].innerHTML).length, 25);
  assert.doesNotMatch(p.el['cg-list'].innerHTML + p.el['cg-rk-rows'].innerHTML, /cg-rk-fin|cg-rk-plus|Voir les/);
});

test('le style du bouton n’existe que sous 640 px, cible de 44 px au moins, texte lisible', () => {
  const p = monter({ tel: true }); p.arriver();
  assert.equal(p.feuilles.length, 1, 'la feuille de l’écran est posée');
  const rs = regles(p.feuilles[0].textContent);
  assert.ok(rs.length > 60, 'marqueur : la feuille est bien lue (' + rs.length + ' règles)');
  const miennes = rs.filter((r) => /cg-rk-fin|cg-rk-plus/.test(r.sel));
  assert.equal(miennes.length, 2, 'deux règles : la bande et le bouton');
  assert.ok(miennes.every(sousTelephone), 'toutes dans un @media de 640 px ou moins');
  const btn = miennes.find((r) => selecteurs(r.sel).includes('html .cg-rk-fin .cg-rk-plus'));
  assert.ok(btn, 'le bouton est plus précis que .v2-btn (v2.css) et que tout « html .v2-btn »');
  assert.ok(+/min-height:(\d+)px/.exec(btn.decl)[1] >= 44);
  assert.ok(+/font-size:([\d.]+)px/.exec(btn.decl)[1] >= 12);
  assert.doesNotMatch(miennes.map((r) => r.decl).join(';'), /backdrop-filter|filter:\s*blur/);
});
