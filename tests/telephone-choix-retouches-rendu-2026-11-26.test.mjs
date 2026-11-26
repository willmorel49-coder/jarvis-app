// 26/11/2026 — planche « JARVIS au téléphone : 11 choix » : les trois retouches faites au jugement du rendu (WebKit, 390 et 360 px),
// après avoir vu les versions codées à l'écran. Chacune ne vaut qu'au téléphone (640 px et moins).
//  R1. Fiche officine, vue Intégral : la ligne « Côté Intégral » restait détachée de la carte des cinq lignes (trait pointillé + 26 px de v2.css).
//  R2. Catalogue & prix : un toucher laissait la rangée « survolée » (Safari) et la règle de survol de v2.css teintait toute la carte des lignes.
//  R3. Marge par produit : 8 px entre les chiffres clés et la carte des rubriques, 14 px entre deux chiffres clés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lire, regles, sousTelephone, trouve, poids, compare } from './aide-css-telephone.mjs';

const v2 = regles(lire('v2.css'));

// Le bloc « @media(max-width:640px){ … } » d'une feuille posée par un écran, repéré par un texte de son commentaire d'en-tête.
function blocInjecte(fichier, repere) {
  const src = lire(fichier), i = src.indexOf(repere);
  assert.ok(i > 0, 'repère introuvable dans ' + fichier + ' : ' + repere);
  const d = src.indexOf('@media(max-width:640px){', i);
  assert.ok(d > i && d - i < 600, 'le bloc 640 px ne suit pas le repère dans ' + fichier);
  const m = /\n\s*'\}'\s*(?:[+,]|\n)/.exec(src.slice(d));   // la ligne « '}' » qui referme le bloc (suivie de « + », de « , » ou de la fin du tableau)
  assert.ok(m, 'fin du bloc 640 px introuvable dans ' + fichier);
  return { src, bloc: src.slice(d, d + m.index) };
}

test('R1 · fiche officine : la ligne « Côté Intégral » ne garde ni le trait pointillé ni la marge qui la détachaient de la carte', () => {
  const tel = regles(lire('v2-fiche-tel.css'));
  const r = trouve(tel, '.pha-wrap.fdr-on .fdr-plis .fdr-pli.fdr-int');
  assert.equal(r.length, 1, 'une seule règle');
  assert.ok(sousTelephone(r[0]), 'sous @media (max-width:640px)');
  assert.match(r[0].decl, /padding-top:0/);
  assert.match(r[0].decl, /border-top:0/);
  // la règle d'origine (v2.css) existe toujours et pèse moins lourd : c'est bien elle qui est neutralisée, au téléphone seulement
  const origine = trouve(v2, '.fdr-on .fdr-int').filter((x) => /border-top:2px dashed/.test(x.decl));
  assert.equal(origine.length, 1, 'la règle « .fdr-on .fdr-int » de v2.css (trait pointillé) est attendue');
  assert.ok(!sousTelephone(origine[0]), 'l’ordinateur garde son trait pointillé');
  assert.ok(compare(poids('.pha-wrap.fdr-on .fdr-plis .fdr-pli.fdr-int'), poids('.fdr-on .fdr-int')) > 0, 'la retouche pèse plus lourd');
  // elle ne vise que les lignes repliables (classe posée au téléphone par v2-pharma.js)
  assert.match(lire('v2-pharma.js'), /class="fdr-ch fdr-rv fdr-pli'/);
});

test('R2 · Catalogue & prix : la carte des lignes et la fin de liste gardent leur fond quand la rangée reste « survolée » après un toucher', () => {
  const { bloc } = blocInjecte('v2-molecules.js', 'sujet 5, version 2) : une ligne par produit');
  const carte = 'html:root:root body .mol-table tbody tr.mol-lgw:hover', fin = 'html:root:root body .mol-table tbody tr.mol-plus30:hover';
  assert.ok(bloc.includes("'" + carte + "{background-color:var(--card)}'"), 'règle de la carte dans le bloc 640 px');
  assert.ok(bloc.includes("'" + fin + "{background-color:transparent}'"), 'règle de la fin de liste dans le bloc 640 px');
  // la règle de survol de v2.css qui teintait la carte : la retouche doit peser plus lourd qu'elle
  const survol = v2.filter((r) => /:is\(\.v2-table tbody tr,\.v2-row\):hover/.test(r.sel) && /background-color/.test(r.decl));
  assert.ok(survol.length >= 1, 'la règle de survol des rangées de v2.css est attendue');
  for (const r of survol) {
    assert.ok(compare(poids(carte), poids(r.sel)) > 0, 'la carte pèse plus lourd que « ' + r.sel + ' »');
    assert.ok(compare(poids(fin), poids(r.sel)) > 0, 'la fin de liste pèse plus lourd que « ' + r.sel + ' »');
  }
  // étalonnage : sans « :root:root », la même règle perdrait
  assert.ok(compare(poids('html .mol-table tbody tr.mol-lgw:hover'), poids(survol[0].sel)) < 0, 'témoin : la version légère perdait');
});

test('R3 · Marge par produit : 14 px au-dessus de la carte des rubriques, comme entre deux chiffres clés', () => {
  const { src, bloc } = blocInjecte('v2-margeproduits.js', 'sujet 6, version 1) : les rubriques repliées');
  assert.ok(bloc.includes("'.mp-rubs{margin-top:14px}'"), 'marge de 14 px dans le bloc 640 px');
  assert.equal(src.split('.mp-rubs{margin-top:').length - 1, 1, 'une seule marge écrite pour la carte des rubriques');
  // les chiffres clés sont espacés de 14 px et laissent 8 px dessous : la marge de la carte se confond avec ces 8 px, la plus grande gagne
  assert.match(src, /'\.mp-kpis\{display:grid;[^}]*gap:14px;margin-bottom:8px\}'/);
});
