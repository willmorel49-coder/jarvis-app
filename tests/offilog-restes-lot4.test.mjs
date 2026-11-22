/* offilog-restes-lot4.test.mjs — les trois restes d'Offilog (lot 4) corrigés avec le lot 5, 22/11/2026
 *
 * Will (22/11/2026) : « corriger maintenant ». a) le logo OFFILOG reste visible au téléphone, EN PETIT, à côté du titre (il disparaissait sous 1 000 px) ;
 * b) les trois sous-onglets de « Comparer » se lisent EN ENTIER à 390 et 360 (ils défilaient de côté : « Très bien placés » était coupé), cibles ≥ 44 px ;
 * c) le sélecteur « Trier par » n'est plus le gris natif : même style que les autres contrôles, mais reste un vrai <select>, et le tri affiché = le tri réel.
 * Ici on lit les règles CSS et le code qui les nourrit (la mesure au pixel, 390 et 360, se prouve sous WebKit au banc : pas de navigateur dans les tests).
 * Lancer : node --test tests/offilog-restes-lot4.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'crm', 'v2');
const css = readFileSync(join(DIR, 'v2-offilog-m1.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const js = readFileSync(join(DIR, 'v2-offilog.js'), 'utf8');

// Découpe le CSS en blocs { cond: '' | '(max-width:1000px)', corps: '…' } (les @media sont lus avec leurs accolades imbriquées)
function blocs(src) {
  const out = []; let i = 0, nu = '';
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++;   // les blancs entre deux règles, sinon un @media serait pris pour une règle ordinaire
    if (src.startsWith('@media', i)) {
      const o = src.indexOf('{', i); let p = 1, j = o + 1;
      while (j < src.length && p) { if (src[j] === '{') p++; else if (src[j] === '}') p--; j++; }
      out.push({ cond: src.slice(i + 6, o).replace(/\s+/g, '').replace(/^and/, ''), corps: src.slice(o + 1, j - 1) });
      i = j;
    } else { const o = src.indexOf('{', i); if (o < 0) break; let p = 1, j = o + 1; while (j < src.length && p) { if (src[j] === '{') p++; else if (src[j] === '}') p--; j++; } nu += src.slice(i, j); i = j; }
  }
  out.push({ cond: '', corps: nu });
  return out;
}
const BLOCS = blocs(css);
const regles = (corps) => [...corps.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), decl: m[2] }));
// Les règles qui visent `motif` (dans le sélecteur), avec la condition @media où elles vivent.
const visant = (motif) => BLOCS.flatMap((b) => regles(b.corps).filter((r) => motif.test(r.sel)).map((r) => ({ ...r, cond: b.cond })));
const maxLargeur = (cond) => { const m = /max-width:(\d+)px/.exec(cond); return m ? +m[1] : null; };
const decl = (r, prop) => { const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(r.decl); return m && m[1].trim(); };

test('(a) le logo reste visible au téléphone et à la tablette, en petit, sur la rangée du titre', () => {
  const R = visant(/\.olm-logo(?![\w-])/);
  assert.ok(R.length >= 2, 'la règle de base et celle du téléphone existent (marqueur positif)');
  R.forEach((r) => assert.ok(!/display\s*:\s*none/.test(r.decl), 'aucune règle ne masque le logo (' + (r.cond || 'base') + ')'));
  const tel = R.find((r) => maxLargeur(r.cond) === 1000);
  assert.ok(tel, 'une règle du logo sous 1 000 px (téléphone et tablette)');
  assert.equal(decl(tel, 'grid-column'), '2', 'à droite du titre');
  assert.equal(decl(tel, 'grid-row'), '2', 'sur la MÊME rangée que le titre');
  assert.ok(parseInt(decl(tel, 'height'), 10) <= 24, 'petit : 24 px de haut au plus (30 px sur ordinateur)');
  const h1 = visant(/\.olm-h1(?![\w-])/).find((r) => maxLargeur(r.cond) === 1000 && /grid-column/.test(r.decl));
  assert.equal(decl(h1, 'grid-row'), '2', 'titre et logo partagent la rangée 2');
  assert.match(visant(/\.olm-hd-t(?![\w-])/).find((r) => maxLargeur(r.cond) === 1000).decl, /display\s*:\s*contents/, 'le bloc de texte s\'efface de la grille pour que titre et logo se rejoignent');
  const hd = visant(/^\.olm-hd$/).find((r) => maxLargeur(r.cond) === 1000);
  assert.match(decl(hd, 'grid-template-columns'), /^minmax\(0,1fr\) auto$/, 'le titre garde la place restante, le logo sa largeur : le titre ne passe pas sur deux lignes à cause du logo');
  const autres = readdirSync(DIR).filter((f) => f.endsWith('.css')).filter((f) => /\.olm-logo[^{]*\{[^}]*display\s*:\s*none/.test(readFileSync(join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.deepEqual(autres, [], 'aucun autre fichier CSS ne masque le logo');
  assert.match(js, /<img class="olm-logo" src="' \+ MOD_BASE \+ 'logos\/offilog\.png"[^>]*alt="" aria-hidden="true"/, 'le logo est toujours dessiné, décoratif (le titre dit déjà « Offilog »)');
});

test('(b) les sous-onglets de « Comparer » passent à la ligne au téléphone au lieu de défiler de côté, cibles ≥ 44 px', () => {
  const R = visant(/\.olo-onglets(?![\w-])/);
  const base = R.find((r) => r.cond === '' && /^\.olm \.olo-onglets$/.test(r.sel));
  assert.ok(base, 'règle de base des sous-onglets (marqueur positif)');
  assert.equal(decl(base, 'flex-wrap'), 'wrap');
  const tel = R.find((r) => maxLargeur(r.cond) != null && /^\.olm \.olo-onglets$/.test(r.sel));
  assert.ok(tel, 'une règle des sous-onglets pour le téléphone');
  assert.ok(maxLargeur(tel.cond) >= 430, 'elle couvre 390 et 360 (jusqu\'à ' + maxLargeur(tel.cond) + ' px)');
  assert.equal(decl(tel, 'flex-wrap'), 'wrap', 'retour à la ligne');
  assert.notEqual(decl(tel, 'overflow-x'), 'auto', 'plus de défilement de côté');
  assert.ok(!/nowrap/.test(tel.decl), 'jamais nowrap');
  R.forEach((r) => assert.ok(!/overflow-x\s*:\s*(auto|scroll)/.test(r.decl), 'aucune règle ne rend la rangée défilante (' + r.sel + ')'));
  const seg = R.find((r) => maxLargeur(r.cond) != null && /\.v2-seg$/.test(r.sel));
  assert.equal(decl(seg, 'white-space'), 'normal', 'le libellé d\'un onglet peut passer sur deux lignes plutôt qu\'être coupé');
  const hauteur = R.find((r) => r.cond === '' && /\.v2-seg/.test(r.sel));
  assert.ok(parseInt(decl(hauteur, 'min-height'), 10) >= 44, 'cible tactile ≥ 44 px');
  assert.match(js, /<div class="v2-segs olo-onglets" role="tablist" aria-label="Que comparer \?">/, 'la rangée existe toujours dans le code (marqueur positif)');
});

test('(c) « Trier par » : plus de gris natif, même style que les autres contrôles, reste un vrai <select>, le tri affiché = le tri réel', () => {
  const S = visant(/^\.olm-tri select$/);
  const sty = S.find((r) => /appearance/.test(r.decl));
  assert.ok(sty, 'la règle de style du sélecteur (marqueur positif)');
  assert.equal(decl(sty, 'appearance'), 'none', 'le gris natif est retiré');
  assert.equal(decl(sty, '-webkit-appearance'), 'none', 'aussi sous Safari');
  assert.match(decl(sty, 'background-image'), /^url\("data:image\/svg\+xml,/, 'une flèche à lui, puisque la flèche native est retirée');
  assert.equal(decl(sty, 'background-color'), '#fff', 'fond blanc comme les autres contrôles (plus de gris)');
  assert.match(decl(sty, 'border'), /var\(--au-fil/, 'même filet que les autres contrôles');
  assert.equal(decl(sty, 'border-radius'), '12px');
  assert.ok(parseInt(decl(sty, 'min-height'), 10) >= 44, 'cible ≥ 44 px');
  assert.ok(visant(/^\.olm-tri select:focus-visible$/).length, 'un contour de focus visible (clavier)');
  // reste un vrai <select> accessible, relié à un libellé visible « Trier par »
  assert.match(js, /<label class="olm-tri"><span>Trier par<\/span><select id="olm-tri" onchange="V2\.offSort\(this\.value\)">/, 'un vrai <select> dans un <label> « Trier par »');
  // le tri affiché = le tri réel : l'option cochée ET la phrase « trié par … » lisent S.sort, et le choix écrit S.sort
  assert.match(js, /'<option value="' \+ o\[0\] \+ '"' \+ \(S\.sort === o\[0\] \? ' selected' : ''\) \+ '>' \+ esc\(o\[1\]\) \+ '<\/option>'/, 'l\'option cochée est celle de S.sort');
  assert.match(js, /trié par ' \+ esc\(sortLabel\(S\.sort\)\.toLowerCase\(\)\)/, 'la phrase « trié par … » vient de S.sort');
  assert.match(js, /V2\.offSort = function \(v\) \{ S\.sort = v;/, 'choisir une option écrit S.sort (le tri réel)');
  assert.match(js, /if \(S\.sort === 'prix_asc'\) a\.sort/, 'et c\'est S.sort qui trie la liste');
});
