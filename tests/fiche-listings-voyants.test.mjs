// 23/11/2026 — Will, après son essai sur iPhone : « il faut vraiment qu'on remette les boutons pour listing produits integral et listing groupement
// sur les fiches des officines et que ce soit voyant ». Ils avaient disparu le 20/11 (fbBloc ne s'affichait plus) sans qu'aucun test ne le voie.
// Ce test garde : le bloc dessiné EN TÊTE de la colonne principale, dans les deux vues (pas de vi-int), les deux tuiles qui ouvrent la feuille
// d'avant (V2.fbOuvre → fbFeuilleListe), l'état fbC posé AVANT la page et vérifié sur CETTE officine, et son style.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../crm/v2/v2.css', import.meta.url), 'utf8');
const corps = (nom) => {
  const i = js.indexOf('function ' + nom + '(');
  assert.ok(i > 0, nom + ' introuvable');
  return js.slice(i, js.indexOf('\n  }\n', i));
};

test('listings : le bloc est le premier de la colonne principale de la fiche', () => {
  assert.match(corps('fdrPage'), /<div class="fdo-main">' \+ fdrListings\(c\) \+ rv2Bandes\(c\)/);
});

test('listings : deux tuiles, Intégral et groupement, qui ouvrent la feuille du listing', () => {
  const b = corps('fdrListings');
  assert.match(b, /onclick="V2\.fbOuvre\(\\'' \+ k \+ '\\',this\)"/);
  assert.match(b, /tuile\('reseau', 'reseau', 'Listing produits ' \+ \(isEscale\(\) \? 'Escale' : 'Intégral'\)/);
  assert.match(b, /tuile\('groupement', 'groupe', 'Listing groupement', esc\(f\.grp\)/);
  assert.match(corps('fbFeuilleListe'), /V2\.pharmaListPdf\(.*V2\.pharmaListXlsx\(.*V2\.fbEnvoyer\(/s, 'la feuille a perdu PDF, Excel ou Envoyer');
});

test('listings : visibles dans les deux vues (aucun bloc interne)', () => {
  assert.ok(!corps('fdrListings').includes('vi-int'), 'le bloc est caché en vue pharmacien');
});

test('listings : état de CETTE officine, posé avant la page ; rien pour l officine d un collègue', () => {
  const b = corps('fdrListings');
  assert.match(b, /if \(!c\.voitVentes \|\| !f \|\| String\(f\.pidBrut\) !== String\(c\.pid\)\) return '';/);
  const r = corps('renderDetail');
  const iBloc = r.indexOf('if (fi && voitVentes) fbBloc(pid, A,');
  const iPage = r.indexOf('var apercu = fdrPage({');
  assert.ok(iBloc > 0 && iPage > iBloc, 'fbBloc doit poser fbC avant fdrPage');
});

test('listings : style des tuiles présent (grandes, bleues, texte blanc)', () => {
  assert.match(css, /\.pha-wrap\.fdr-on \.fdr \.flg-b\{display:grid;[^}]*min-height:84px;[^}]*color:#FFFFFF;/);
  assert.match(css, /\.pha-wrap\.fdr-on \.flg-row\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
