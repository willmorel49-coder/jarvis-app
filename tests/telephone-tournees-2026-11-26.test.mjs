// 26/11/2026 — Tournées au téléphone (audit du 25/11, TRN-1 et TRN-2).
// Avant : les 4 infos d'une tournée (« 115,80 € par commande », « 3 en perte », « 28 prospects », « +1 540 € ») se rangeaient
// comme des mots dans un paragraphe : le « +1 540 € » changeait de place d'une ligne à l'autre.
// Ce que ce test garde : une grille 2 × 2 au téléphone SEULEMENT (bloc 640 px à part, le bloc 900 px de la tablette reste
// en ligne souple), et le mot « potentiel » écrit après le montant de la ligne du téléphone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-tournees.js', import.meta.url), 'utf8');

// le contenu d'un bloc « @media (…){ … } » à partir de sa position (accolades équilibrées)
function bloc(texte, i) {
  let p = 0;
  for (let k = texte.indexOf('{', i); k < texte.length; k++) {
    if (texte[k] === '{') p++;
    else if (texte[k] === '}') { p--; if (!p) return texte.slice(i, k + 1); }
  }
  return '';
}

test('Tournées, téléphone : les 4 infos d\'une tournée sont en grille 2 × 2 dans un bloc 640 px à part', () => {
  const m = src.match(/'@media \(max-width:640px\)\{\.trn-m\{([^}]*)\}\}'/);
  assert.ok(m, 'règle .trn-m dans un @media (max-width:640px) neuf');
  assert.match(m[1], /display:grid/);
  const cols = m[1].match(/grid-template-columns:([^;]+)/);
  assert.ok(cols, 'colonnes déclarées');
  assert.equal(cols[1].trim().split(/\s+(?=minmax)/).length, 2, 'deux colonnes : ' + cols[1]);
  assert.doesNotMatch(cols[1], /auto|max-content/, 'colonnes fixes : une colonne « auto » décalerait le montant d\'une ligne à l\'autre');
});

test('Tournées : la tablette (bloc 900 px) n\'est pas touchée, l\'ordinateur ne voit toujours pas ce bloc', () => {
  const i900 = src.indexOf("'@media (max-width:900px){'");
  assert.ok(i900 > 0, 'bloc 900 px présent');
  const fin = src.indexOf("\n      '}',", i900);
  const b900 = src.slice(i900, fin);
  assert.match(b900, /\.trn-m\{display:flex;grid-column:2\/4;gap:14px;font-size:12px;color:var\(--ip-ink-2\);flex-wrap:wrap\}/, 'ligne souple gardée de 641 à 900 px');
  assert.doesNotMatch(b900, /\.trn-m\{display:grid/, 'la grille n\'est pas dans le bloc 900 px');
  // à l'ordinateur : .trn-m reste caché, et la grille vient APRÈS le bloc 900 px (sinon display:flex la recouvrirait)
  const iCache = src.indexOf("'.trn-m{display:none}'"), i640 = src.indexOf("'@media (max-width:640px){.trn-m{");
  assert.ok(iCache > 0 && iCache < i900 && i900 < i640, 'ordre : caché, puis 900 px, puis 640 px');
  // .trn-m n'est stylé nulle part ailleurs
  assert.equal((src.match(/\.trn-m\{/g) || []).length, 3, 'trois règles .trn-m : cachée, 900 px, 640 px');
});

test('Tournées : le montant de la ligne du téléphone dit « potentiel » (TRN-2), la colonne de l\'ordinateur garde son montant seul', () => {
  assert.match(src, /<span class="trn-pot">' \+ eurSigne\(t\.potentiel\) \+ ' potentiel<\/span><\/span><\/button>/, 'le mot est dans le span .trn-pot de .trn-m');
  assert.match(src, /<span class="trn-pot trn-c5">' \+ eurSigne\(t\.potentiel\) \+ '<\/span>/, 'colonne « Potentiel par mois » de l\'ordinateur : montant seul, l\'en-tête porte déjà le mot');
});
