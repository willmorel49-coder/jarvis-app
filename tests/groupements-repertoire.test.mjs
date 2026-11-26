// 22/11/2026 — écran Groupements « Le répertoire » (v1 choisie par Will) : on vérifie sur le code réel de v2-pharma.js
// la part chez nous (taille inconnue = jamais de pourcentage), la disparition de « actives sur », « Sans groupement » hors du classement,
// la réconciliation de la base nationale arrivée avant nos officines, et la recherche sans accents ni ponctuation.
// SRC_PHARMA permet de pointer sur un autre fichier (l'ancien code, pour prouver que le test échoue dessus).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(process.env.SRC_PHARMA || new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');

function tranche(debut, fin) {
  const i = src.indexOf(debut);
  assert.ok(i >= 0, 'introuvable : ' + debut);
  const j = src.indexOf(fin, i);
  assert.ok(j > i, 'fin introuvable : ' + fin);
  return src.slice(i, j);
}
// Le code sans ses lignes de commentaire (les commentaires citent l'ancien texte pour l'expliquer).
const codeSeul = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// Part chez nous : grpFranceIndex / grpPart tels qu'écrits, nourris d'une base nationale fictive.
// base = null : la base nationale n'est pas arrivée ; reconcilie : ce que fait V2.reconcilePharma.
function part(base, { reconcilie = true } = {}) {
  const code = tranche('var _grpFr = null', 'function renderGroupementsList');
  const V2 = { route: { name: 'pharma' }, ensurePharmaFr: () => { V2.demandes = (V2.demandes || 0) + 1; } };
  if (reconcilie) V2.reconcilePharma = () => { window.PHARMA_FR._wmlRecon = true; };
  const window = { PHARMA_FR: base };
  const canonG = (g) => String(g).trim();
  const f = new Function('window', 'V2', 'canonG', 'document', code + '; return { grpPart: grpPart, grpSansCliente: grpSansCliente };')(window, V2, canonG, {});
  return { ...f, V2, window };
}
// p[3] = index du groupement, p[4] = index du segment.
const BASE = () => ({
  seg: ['Client Intégral', 'Prospect'],
  grp: ['', 'Pharm-UPP', 'Réseau Seul', 'Giropharm'],
  p: [[0, 0, 0, 1, 0], [0, 0, 0, 1, 1], [0, 0, 0, 1, 1], [0, 0, 0, 1, 1], [0, 0, 0, 3, 1], [0, 0, 0, 3, 1], [0, 0, 0, 0, 1]],
});

test('part chez nous : nos clientes sur les officines du groupement en France', () => {
  const { grpPart } = part(BASE());
  const r = grpPart('Pharm-UPP', 1);   // 1 cliente + 3 non clientes dans la base = 4
  assert.equal(r.etat, 'connu');
  assert.equal(r.france, 4);
  assert.equal(r.autres, 3);
  assert.equal(r.part, 25);
  assert.equal(grpPart('Giropharm', 2).part, 50);
});

// 22/11/2026, vu en production : la base re-rangée APRÈS coup (corrections de groupement, segmentation…) sans changer de longueur
// laissait l'ancien calcul en mémoire (Pharm-UPP 888 puis 887 officines selon le moment). Le rangement avance D._reconN : on refait.
test('part chez nous : la base re-rangée après coup (même longueur) est recomptée', () => {
  const { grpPart, window } = part(BASE());
  assert.equal(grpPart('Pharm-UPP', 1).autres, 3);
  const D = window.PHARMA_FR;
  D.p[1][3] = 3;                              // une non cliente passe de Pharm-UPP à Giropharm (correction de groupement)
  D._reconN = (D._reconN || 0) + 1;           // ce que font V2.reconcilePharma et V2.pfPoser
  assert.equal(grpPart('Pharm-UPP', 1).autres, 2, 'ancien calcul resservi après le re-rangement');
  assert.equal(grpPart('Giropharm', 2).autres, 3);
  const app = readFileSync(new URL('../crm/v2/v2-app.js', import.meta.url), 'utf8');
  assert.match(app, /D\._wmlRecon = true; if \(D\.meta\) D\.meta\.clients = nC;\n\s*D\._reconN = \(D\._reconN \|\| 0\) \+ 1;/, 'reconcilePharma n\'avance plus le compteur');
  assert.match(app, /if \(p\[col\] !== nv\) \{ p\[col\] = nv; D\.__norm = null; D\._reconN = \(D\._reconN \|\| 0\) \+ 1; \}/, 'pfPoser n\'avance plus le compteur');
});

test('part chez nous : taille inconnue = pas de pourcentage (jamais 100 %)', () => {
  const { grpPart } = part(BASE());
  const r = grpPart('Réseau Seul', 12);   // aucune officine non cliente connue dans ce groupement
  assert.equal(r.etat, 'inconnu');
  assert.equal(r.part, null);
  assert.equal(r.france, null);
});

test('part chez nous : base nationale pas encore arrivée = en attente, et elle est demandée une fois', () => {
  const { grpPart, V2 } = part(undefined);
  assert.equal(grpPart('Pharm-UPP', 5).etat, 'attente');
  assert.equal(grpPart('Pharm-UPP', 5).part, null);
  assert.equal(V2.demandes, 1);
});

test('part chez nous : jamais 0 % quand on a au moins une cliente (plancher à 1 %)', () => {
  const b = BASE();
  for (let i = 0; i < 400; i++) b.p.push([0, 0, 0, 3, 1]);
  assert.equal(part(b).grpPart('Giropharm', 1).part, 1);
});

test('réconciliation : base nationale arrivée AVANT nos officines, elle est réconciliée au premier calcul', () => {
  const { grpPart, window } = part(BASE());
  assert.ok(!window.PHARMA_FR._wmlRecon, 'départ : base non réconciliée');
  assert.equal(grpPart('Pharm-UPP', 1).etat, 'connu', 'la part doit se calculer sans attendre un nouveau chargement');
  assert.equal(window.PHARMA_FR._wmlRecon, true);
});

test('groupements connus en France sans aucune cliente : du plus grand au plus petit', () => {
  const { grpSansCliente } = part(BASE());
  assert.deepEqual(grpSansCliente({ 'Pharm-UPP': 1 }), [{ name: 'Giropharm', autres: 2 }]);
  assert.deepEqual(grpSansCliente({}).map((g) => g.name), ['Pharm-UPP', 'Giropharm']);
});

test('recherche : sans accents ni ponctuation, casse indifférente', () => {
  const norm = new Function(tranche('function grpSearchNorm', 'function groupementList') + '; return grpSearchNorm;')();
  assert.equal(norm('Pharm-UPP'), 'pharmupp');
  assert.equal(norm('pharmupp'), norm('Pharm-UPP'));
  assert.equal(norm('Réseau P&P'), 'reseaupp');
  assert.equal(norm('  Évolupharm  '), 'evolupharm');
  assert.equal(norm(null), '');
});

// 26/11/2026 — planche « 22 changements », sujet 19 (choix de Will) : la ligne à part remonte AVANT la liste (elle n'était visible qu'en bas)
test('liste : « Sans groupement » sort du classement, une ligne à part en tête de la liste', () => {
  const code = tranche('function grpListBody', '// La lumière du bandeau');
  const mk = (n, sans) => ({ name: (sans ? '— ' : '') + n, nb: 1 });
  const ctx = {
    list: [mk('A'), mk('B'), mk('Sans groupement', true), mk('C')],
  };
  const corps = new Function('groupementList', 'grSans', 'grNum', 'grrLigne', 'grrSans', 'grrRepli', 'grrSansCliente', 'V2', 'esc', 'grpListSearch', 'grpListSort', 'GRR_N',
    code + '; return grpListBody;')(
    () => ctx.list, (g) => g.name.charAt(0) === '—', (n) => String(n), (g) => '<L ' + g.name + '>', () => '<SANS>', () => '<REPLI>', () => null,
    { fmtNum: (n) => String(n) }, (s) => s, '', 'clientes', 30);
  const html = corps(ctx.list);
  const dansLeClassement = html.slice(html.indexOf('<div class="grr-body">'), html.indexOf('</div>', html.indexOf('<div class="grr-body">')));
  assert.ok(!/Sans groupement/.test(dansLeClassement), 'Sans groupement ne figure pas parmi les lignes classées');
  assert.ok(html.indexOf('<SANS>') >= 0 && html.indexOf('<SANS>') < html.indexOf('<L A>'), 'la ligne à part vient avant le premier groupement');
  assert.ok(html.indexOf('<SANS>') < html.indexOf('<div class="grr-body">'), 'elle est hors du bloc des lignes classées');
  assert.equal((html.match(/<SANS>/g) || []).length, 1);
});

test('liste et détail : plus de « actives sur », la part chez nous les remplace', () => {
  assert.ok(!/actives sur/.test(codeSeul), 'le texte « actives sur » est encore dans le code : ' + (codeSeul.match(/.{0,60}actives sur.{0,40}/) || [''])[0]);
  const detail = tranche('var pt = grpPart(grpName', 'var uG = ');
  assert.match(detail, /officines du groupement en France, soit /);
  assert.match(detail, /taille du groupement inconnue/);
  assert.ok(!/actives/.test(detail));
  // Dans la liste : taille inconnue écrite en toutes lettres, aucun pourcentage dans ce cas.
  const part = tranche('function grrPart', 'function grrLigne');
  const inconnu = part.slice(part.indexOf("pp.etat === 'inconnu'"), part.indexOf("pp.etat === 'inconnu'") + 200);
  assert.match(inconnu, /taille du groupement inconnue/);
  assert.ok(!/%/.test(inconnu), 'aucun pourcentage quand la taille est inconnue');
});

// 22/11/2026, vu sur la photo de production du détail : « 127 officines dont 127 actives » (toujours N sur N) et le compteur des
// deux capsules en blanc sur l'en-tête clair de l'aube (invisible).
test('détail : plus de « dont N actives », compteurs des capsules lisibles sur l\'en-tête clair', () => {
  assert.ok(!/' dont ' \+ data\.panel/.test(codeSeul), '« dont N actives » encore écrit dans la carte des pharmacies');
  const css = readFileSync(new URL('../crm/v2/v2-groupements-m1.css', import.meta.url), 'utf8');
  const regle = (css.match(/\.gr-cnt\{display[^}]*\}/) || [''])[0];
  assert.ok(regle, 'règle .gr-cnt introuvable');
  assert.ok(!/color:#fff/i.test(regle), 'compteur encore blanc : ' + regle);
  assert.match(regle, /color:var\(--ip-blue-d\)/);
});
