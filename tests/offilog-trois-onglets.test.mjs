// 22/11/2026 — écran Offilog « Les trois onglets » (v3 choisie par Will, lot 4 du plan V3) : on vérifie sur le code réel
// le titre en texte (logo en petit, hors du titre), les trois onglets à la place des trois portes, la carte amincie (une seule
// ligne concurrent), la disparition de la notice de définitions, et aucune couleur chaude dans la feuille de l'écran.
// SRC_OFFILOG / SRC_OFFILOG_CSS / SRC_AUBE permettent de pointer sur l'ancien code, pour prouver que le test échoue dessus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (env, rel) => readFileSync(process.env[env] || new URL(rel, import.meta.url), 'utf8');
const js = lire('SRC_OFFILOG', '../crm/v2/v2-offilog.js');
const css = lire('SRC_OFFILOG_CSS', '../crm/v2/v2-offilog-m1.css');
const aube = lire('SRC_AUBE', '../crm/v2/v2-aube.js');
// Le code sans ses commentaires (les commentaires citent l'ancien texte pour l'expliquer).
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const code = sansCommentaires(js);

function corps(nom) {
  const i = code.indexOf('function ' + nom + '(');
  assert.ok(i >= 0, 'fonction introuvable : ' + nom);
  const j = code.indexOf('\n  function ', i + 10);
  return code.slice(i, j > i ? j : undefined);
}

// « chaud » = teinte 15° à 65° (orange, ambre, jaune, pêche, beige), même règle que la sonde du lot 1.
function chauds(s) {
  const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, t = 0; if (mx !== mn) { const d = mx - mn; t = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return { h, s: t, l }; };
  const chaud = (r, g, b) => { const { h, s: t, l } = hsl(r, g, b); return h >= 15 && h <= 65 && t >= 0.2 && l >= 0.12 && l <= 0.975; };
  const vus = [];
  for (const m of sansCommentaires(s).matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    let x = m[1]; if (x.length === 3) x = x.split('').map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(x.slice(k, k + 2), 16));
    if (chaud(r, g, b)) vus.push(m[0]);
  }
  for (const m of sansCommentaires(s).matchAll(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/g)) if (chaud(+m[1], +m[2], +m[3])) vus.push(m[0]);
  return vus;
}

test('titre en texte « Offilog », le logo hors du titre', () => {
  assert.match(code, /<h1 class="olm-h1">Offilog<\/h1>/, 'le titre doit être le mot Offilog en texte');
  assert.doesNotMatch(code, /<h1[^>]*>(?:(?!<\/h1>)[\s\S])*<img/, 'aucune image dans un titre h1');
  assert.match(code, /<img class="olm-logo"[^>]*alt=""[^>]*aria-hidden="true"/, 'le logo reste, en image décorative');
  assert.match(aube, /var TITRES = '[^']*\.olm-h1/, 'le bandeau commun anime le titre d\'Offilog');
});

test('trois onglets à la place des trois portes', () => {
  const m = code.match(/var ONGLETS = (\[[^;]*\]);/);
  assert.ok(m, 'liste des onglets introuvable');
  const onglets = JSON.parse(m[1].replace(/'/g, '"'));
  assert.deepEqual(onglets.map((o) => o[2]), ['Trouver un produit', 'Comparer nos prix', 'Catalogue à envoyer']);
  assert.match(code, /class="olm-onglet[^]*role="tab"/, 'chaque onglet est un vrai onglet (role="tab")');
});

test('carte amincie : une seule ligne concurrent, plus de pile de pastilles', () => {
  const c = corps('carteV3');
  assert.equal((c.match(/concLigne\(/g) || []).length, 1, 'une seule ligne concurrent par carte');
  assert.doesNotMatch(c, /off-card-(pz|pub|lec|drk)\b/, 'aucune pastille de plateforme sur la carte');
  assert.match(c, /olm-ph/, 'carte sans photo : repère sobre (initiale), pas un trou blanc');
});

test('la notice de définitions a disparu', () => {
  assert.doesNotMatch(code, /Produits suivis :/);
  assert.doesNotMatch(code, /Concurrent moins cher :/);
});

test('aucune couleur chaude dans la feuille de l\'écran', () => {
  assert.deepEqual(chauds(css), []);
});
