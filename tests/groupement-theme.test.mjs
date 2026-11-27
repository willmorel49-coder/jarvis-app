// 26/11/2026 — option B, étape 5 : thème Essentiels Pharma. Quatre gardes statiques sur la couche commune des groupements :
//  1. les deux feuilles communes n'écrivent AUCUNE couleur en dur (hors blanc, noir, transparent, currentColor) ;
//  2. chaque variable --grp-* / --og-* lue par ces feuilles et par groupements/v2/*.js (sans repli) est définie chez OPSO ET chez Essentiels ;
//  3. essentiels-theme.css ne contient aucune valeur de la palette OPSO, ni le bleu du socle JARVIS ;
//  4. les deux index.html chargent les cinq feuilles dans l'ordre voulu.
// + la tuile « Tableau de bord » ne promet pas chez Essentiels une rémunération qui n'existe que chez OPSO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const racine = new URL('../', import.meta.url).pathname;
const lire = f => readFileSync(racine + f, 'utf8');
const sansCommentaires = t => t.replace(/\/\*[\s\S]*?\*\//g, '');

const THEME = sansCommentaires(lire('groupements/v2/groupement-theme.css'));
const UX = sansCommentaires(lire('groupements/v2/groupement-ux.css'));
const OPSO = sansCommentaires(lire('opso/v2/opso-theme.css'));
const ESS = sansCommentaires(lire('essentiels/v2/essentiels-theme.css'));
const JS = readdirSync(racine + 'groupements/v2').filter(f => f.endsWith('.js')).map(f => [f, lire('groupements/v2/' + f)]);

// ── 1. aucune couleur en dur
function couleursEnDur(css) {
  const trouvees = [];
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const h = m[0].toLowerCase();
    if (['#fff', '#ffffff', '#000', '#000000'].includes(h)) continue;
    trouvees.push(m[0]);
  }
  for (const m of css.matchAll(/\brgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
    const t = `${m[1]},${m[2]},${m[3]}`;
    if (t === '255,255,255' || t === '0,0,0') continue;
    trouvees.push(m[0]);
  }
  for (const m of css.matchAll(/\b(?:hsla?|oklch|oklab|lab|lch)\(/g)) trouvees.push(m[0]);
  return trouvees;
}
test('groupement-theme.css : aucune couleur écrite en dur', () => { assert.deepEqual(couleursEnDur(THEME), []); });
test('groupement-ux.css : aucune couleur écrite en dur', () => { assert.deepEqual(couleursEnDur(UX), []); });
test('le détecteur de couleurs en dur voit bien un vert, un bleu et un rgba (il ne rend pas 0 partout)', () => {
  assert.deepEqual(couleursEnDur('a{color:#4e9f70;background:rgba(0,80,230,.2);border-color:#FFF;x:rgba(255,255,255,.5)}'), ['#4e9f70', 'rgba(0,80,230']);
});

// ── 2. variables lues = variables définies chez les deux thèmes
function definies(css) { return new Set([...css.matchAll(/(--(?:grp|og)-[\w-]+)\s*:/g)].map(m => m[1])); }
const D_OPSO = definies(OPSO), D_ESS = definies(ESS), D_COMMUN = definies(THEME);
function lues(src) {
  const sansRepli = new Set();
  for (const m of src.matchAll(/var\(\s*(--(?:grp|og)-[\w-]+)\s*([,)])/g)) if (m[2] === ')') sansRepli.add(m[1]);
  return sansRepli;
}
const LUES = new Set([...lues(THEME), ...lues(UX)]);
for (const [, src] of JS) for (const v of lues(src)) LUES.add(v);
test('chaque variable --grp-* / --og-* lue sans repli est définie chez OPSO et chez Essentiels (ou dans la feuille commune)', () => {
  assert.ok(LUES.size > 100, 'le relevé des variables lues semble vide : ' + LUES.size);
  const manquantes = [];
  for (const v of LUES) {
    if (!(D_OPSO.has(v) || D_COMMUN.has(v))) manquantes.push('OPSO : ' + v);
    if (!(D_ESS.has(v) || D_COMMUN.has(v))) manquantes.push('Essentiels : ' + v);
  }
  assert.deepEqual(manquantes, []);
});
test('chaque variable définie par OPSO l\'est aussi par Essentiels (mêmes noms, deux thèmes)', () => {
  const absentes = [...D_OPSO].filter(v => !D_ESS.has(v));
  assert.deepEqual(absentes, []);
});
// lectures par cv('--grp-…', repli) dans les modules : la variable doit exister chez les deux thèmes
test('les variables lues par cv() dans les modules existent chez les deux thèmes', () => {
  const cv = new Set();
  for (const [, src] of JS) for (const m of src.matchAll(/cv\(\s*['"](--(?:grp|og)-[\w-]+)['"]/g)) cv.add(m[1]);
  const manquantes = [...cv].filter(v => !D_OPSO.has(v) || !D_ESS.has(v));
  assert.deepEqual(manquantes, []);
});

// ── 3. Essentiels ne contient rien de la palette OPSO ni du bleu JARVIS
test('essentiels-theme.css : aucune valeur de la palette OPSO, aucun bleu du socle JARVIS', () => {
  const norm = t => t.toLowerCase().replace(/\s+/g, '');
  const e = norm(ESS);
  const valeursOpso = new Set();
  for (const m of OPSO.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (m[1].startsWith('--grp-chaud-')) continue;            // teintes chaudes (ambre, rose pâle) : identiques chez les deux, voulu
    if (/^--og-(ease|lift|card-line)/.test(m[1]) || m[1] === '--sh-opso-glow' || m[1] === '--sh-opso-hover') continue; // ombres composées : testées par leurs couleurs
    for (const h of m[2].matchAll(/#[0-9a-fA-F]{6}\b/g)) valeursOpso.add(h[0].toLowerCase());
    const t = m[2].trim().match(/^(\d{1,3}),(\d{1,3}),(\d{1,3})$/);
    if (t) valeursOpso.add(`${t[1]},${t[2]},${t[3]}`);
  }
  for (const m of OPSO.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
    const t = `${m[1]},${m[2]},${m[3]}`;
    if (t !== '255,255,255' && t !== '0,0,0') valeursOpso.add(t);
  }
  const chaudes = new Set();
  for (const m of OPSO.matchAll(/--grp-chaud-[\w-]+\s*:\s*([^;]+);/g)) { chaudes.add(m[1].trim().toLowerCase()); }
  const presentes = [];
  for (const v of valeursOpso) {
    if (chaudes.has(v)) continue;
    const motif = v.includes(',') ? new RegExp('(?<![\\d.])' + v.replace(/,/g, ',') + '(?![\\d.])') : new RegExp(v + '(?![0-9a-f])');
    if (motif.test(e)) presentes.push(v);
  }
  assert.deepEqual(presentes, []);
  for (const bleu of ['0,80,230', '#0050e6', '0,52,160']) assert.ok(!e.includes(bleu), 'bleu JARVIS présent : ' + bleu);
});
test('les ancres de la charte Essentiels sont écrites exactement', () => {
  const dans = (nom, val) => assert.match(ESS, new RegExp(nom + '\\s*:\\s*' + val.replace(/[#]/g, '#') + '\\s*;', 'i'), nom);
  dans('--grp-accent', '#2F7D1A'); dans('--grp-accent-d', '#256614'); dans('--grp-ink', '#121A14'); dans('--grp-pale', '#F2F6F2');
  dans('--ip-blue', '#2F7D1A'); dans('--ip-blue-d', '#256614'); dans('--paper', '#F2F6F2'); dans('--ip-ink', '#121A14');
});

// ── 4. ordre des feuilles
const ORDRE = ['crm/v2/v2.css', 'crm/v2/v2-pieces.css', 'groupements/v2/groupement-theme.css', null, 'groupements/v2/groupement-ux.css'];
// 26/11/2026 soir — Will : « pour essentiel pharma pas de Offilog » (ils ont leur propre centrale d'achat) : la feuille Offilog
// de JARVIS (v2-offilog-m1.css, ajoutée à l'étape 5b) n'est plus chargée chez Essentiels ; OPSO ne l'a jamais chargée.
for (const page of ['opso/v2/index.html', 'essentiels/v2/index.html']) {
  const theme = page.startsWith('opso') ? 'opso-theme.css' : 'essentiels-theme.css';
  test(page + ' : feuilles dans l\'ordre v2, v2-pieces, groupement-theme, thème du groupement, groupement-ux', () => {
    const html = lire(page);
    const hrefs = [...html.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m => m[1].replace(/^(\.\.\/)+/, ''));
    assert.deepEqual(hrefs, ['crm/v2/v2.css', 'crm/v2/v2-pieces.css', 'groupements/v2/groupement-theme.css', theme, 'groupements/v2/groupement-ux.css']);
  });
}

// La feuille du catalogue Offilog restyle *, html et body : elle ne vit que DANS l'iframe du module, jamais dans une page de groupement.
test('Offilog : v2-offilog-vitrine.css jamais chargée par une page de groupement', () => {
  for (const page of ['opso/v2/index.html', 'essentiels/v2/index.html']) assert.ok(!/<link[^>]+v2-offilog-vitrine\.css/.test(lire(page)), page);
  assert.match(lire('crm/v2/v2-offilog-vitrine.css'), /(^|\n)html\s*\{/, 'la feuille du catalogue a bien des règles globales (sinon ce test ne protège rien)');
});

// Essentiels a sa propre centrale d'achat : aucun module, aucune feuille, aucune règle de thème Offilog ; OPSO garde son écran Offilog.
test('Essentiels : pas d\'Offilog (ni module, ni feuille, ni règle de thème) ; réglage offilog:false ; OPSO garde le sien', () => {
  const ess = lire('essentiels/v2/index.html');
  for (const f of ['v2-offilog.js', 'v2-offilog-vitrine.js', 'v2-offilog-m1.css']) assert.ok(!new RegExp('(src|href)="[^"]*' + f.replace(/\./g, '\\.')).test(ess), f);
  assert.ok(!/\.olm\b|\.off-insp\b/.test(ESS), 'règles Offilog restées dans essentiels-theme.css');
  assert.match(lire('groupements/config/essentiels.js'), /\n\s*offilog:\s*false,/);
  assert.ok(!/offilog:\s*false/.test(lire('groupements/config/opso.js')));
  assert.match(lire('opso/v2/index.html'), /<script src="\.\.\/\.\.\/crm\/v2\/v2-offilog\.js/);
  assert.match(lire('groupements/v2/groupement-bord.js'), /function offilogAdherentes\(\) \{\s*\n[^\n]*\n\s*if \(V2\.groupement && V2\.groupement\.offilog === false\) return \{ html: '', periode: '' \};/);
});

// ── tuile « Tableau de bord »
test('Tableau de bord : Essentiels ne promet pas la rémunération ; OPSO garde son texte d\'avant (repli)', () => {
  const ess = lire('groupements/config/essentiels.js'), opso = lire('groupements/config/opso.js');
  const textes = ess.slice(ess.indexOf('textes:'));
  for (const cle of ['bordTuile', 'bordTuileLong', 'bordPalette']) assert.match(textes, new RegExp(cle + ':'));
  assert.doesNotMatch(textes.replace(/\/\/.*$/gm, ''), /r[ée]mun[ée]ration/i);
  assert.doesNotMatch(opso, /textes:/);
  assert.match(lire('crm/v2/v2-app.js'), /'Le chiffre du groupement, le mois, la rémunération, ce que les adhérentes achètent et la trajectoire de l\\'année\.'/);
  assert.match(lire('groupements/v2/groupement-bord.js'), /'Le chiffre, la rémunération, la trajectoire'/);
});

// ── F7 : aucun « OPSO » dans l'app Essentiels : le menu « Suivi des groupements » (qui liste OPSO) n'est pas posé chez Essentiels
test('menu du compte : Essentiels le coupe (menuGroupements:false), OPSO et JARVIS gardent la ligne (réglage absent)', () => {
  assert.match(lire('groupements/config/essentiels.js'), /menuGroupements:\s*false/);
  assert.doesNotMatch(lire('groupements/config/opso.js'), /menuGroupements/);
  assert.match(lire('crm/v2/v2-app.js'), /V2\.groupement\.menuGroupements === false\) return;/);
});

// 26/11/2026 — option B, étape 9 : le menu « Suivi des groupements » de JARVIS ouvre la NOUVELLE app Essentiels ; l'ancienne reste servie mais n'a plus de lien.
test('bascule : le lien Essentiels du menu mène à essentiels/v2/, plus aucun lien vers essentiels-pharma/ dans le CRM', () => {
  const app = lire('crm/v2/v2-app.js');
  assert.match(app, /\{ nom: 'Essentiels Pharma', url: '\.\.\/\.\.\/essentiels\/v2\/index\.html', acces: 'essentiels' \}/);
  assert.doesNotMatch(app.replace(/\/\/[^\n]*/g, ''), /essentiels-pharma\//);
  assert.match(app, /\{ nom: 'OPSO', url: '\.\.\/\.\.\/opso\/v2\/index\.html', acces: 'opso' \}/);
  assert.ok(readFileSync(racine + 'essentiels-pharma/index.html', 'utf8').length > 0, 'l’ancienne app reste servie');
});
