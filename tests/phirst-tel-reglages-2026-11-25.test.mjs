// Réglages au téléphone (maquette « reglages-1-cartes-compactes », 25/11/2026) : ce que le code doit contenir.
// Variable PHIRST_REGLAGES_DIR : dossier qui contient phirst/v2/ (par défaut, la copie de travail) — sert à la contre-épreuve sur origin/main.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RACINE = process.env.PHIRST_REGLAGES_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, 'phirst/v2', f), 'utf8');
const css = lire('phirst-reglages.css'), js = lire('phirst-reglages.js'), tx = lire('phirst-reglages-textes.js');
const bloc700 = () => { const i = css.indexOf('@media (max-width:700px){\n  /* titre et phrase'); if (i < 0) return ''; let d = 0, j = css.indexOf('{', i); const d0 = j; for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}' && --d === 0) break; } return css.slice(d0, j); };
const horsMedia = () => css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

test('titre Réglages : même taille que Encaisser, à l’ordinateur et au téléphone', () => {
  assert.match(css, /\.rg \.rg-bande h1\{[^}]*font:800 clamp\(32px,9vw,40px\)\/1\.04/);
  assert.ok(!/\.rg \.rg-bande h1\{[^}]*24px/.test(css));
});
test('phrase « Outils et compte. » sous le titre, cachée à l’ordinateur', () => {
  assert.match(js, /<p class="rg-lede">Outils et compte\.<\/p>/);
  assert.match(horsMedia(), /\.rg \.rg-lede[^{]*\{display:none\}/);
});
test('les rubriques de la téléprospectrice passent AVANT les outils (order) au téléphone seulement', () => {
  const b = bloc700();
  assert.match(b, /\.rg #ri-zone\{order:1\}/);
  assert.match(b, /\.rg \.rg-bilan\{order:2/); assert.match(b, /\.rg \.rg-outils\{order:3/); assert.match(b, /\.rg \.rg-cote\{order:5\}/);
  assert.ok(!/[{;]order:/.test(horsMedia()));
});
test('les trois rubriques arrivent repliées au téléphone, la première reste ouverte à l’ordinateur', () => {
  assert.match(tx, /ouvert: \{ ph: !petitEcran\(\)/);
  assert.match(tx, /matchMedia\('\(max-width:700px\)'\)/);
});
test('bandeau vert → bloc « N outils sur M en service » séparé, plus bas', () => {
  assert.match(js, /class="rg-bilan"/);
  assert.match(bloc700(), /\.rg \.rg-bande,\.rg \.rg-bande\.rg-attente\{[^}]*background-image:none/);
  assert.match(bloc700(), /\.rg \.rg-bilan\{[^}]*display:grid/);
});
test('4 outils en cartes courtes : 2 colonnes, icône au-dessus du titre, une ligne d’état', () => {
  const b = bloc700();
  assert.match(b, /\.rg \.rg-outils\{order:3;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(b, /\.rg \.rg-outil-t\{flex-direction:column/);
  assert.match(b, /\.rg \.rg-court\{display:block/);
  assert.match(b, /\.rg \.rg-outil \.rg-pastille,\.rg \.rg-quoi,\.rg \.rg-etat\{display:none\}/);
  assert.match(js, /function court\(o\)/);
});
test('rien de perdu : le texte complet (explication + état) s’affiche au toucher, bouton ≥ 44 px', () => {
  assert.match(js, /data-rg="outil"/); assert.match(js, /a === 'outil'\) choisirOutil/);
  assert.match(js, /esc\(o\.quoi\) \+ ' ' \+ esc\(o\.texte\)/);
  assert.match(js, /aria-pressed/);
  assert.match(bloc700(), /\.rg \.rg-tog\{display:block;position:absolute;inset:0;width:100%;height:100%;min-height:44px/);
  assert.match(bloc700(), /\.rg \.rg-note\{order:4;display:block/);
});
test('l’ordinateur ne change pas : le propre au téléphone est caché hors média, les textes complets restent dans les cartes', () => {
  assert.match(horsMedia(), /\.rg \.rg-lede,\.rg \.rg-bilan,\.rg \.rg-note,\.rg \.rg-tog,\.rg \.rg-court\{display:none\}/);
  assert.match(js, /<p class="rg-quoi">/); assert.match(js, /<p class="rg-etat">/);
});
test('Safari : rien d’interdit ajouté', () => { assert.ok(!/backdrop-filter|filter:\s*blur|background-clip:\s*text/.test(css)); });
test('téléprospectrice : sa page (mot de passe + déconnexion) n’est pas touchée', () => {
  assert.match(js, /function pageTelepro\(\)/); assert.match(js, /rg-seul/);
  assert.ok(!/rg-bilan|rg-tog/.test(js.slice(js.indexOf('function pageTelepro'), js.indexOf('/* ── dessin'))));
});
