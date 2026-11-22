// Lot 1 « couleurs froides » (22/11/2026, règle de Will : aucun orange, ambre, jaune, pêche, beige — même dans les couleurs de données).
// On lit, dans les fichiers des écrans corrigés, UNIQUEMENT les variables, règles et palettes qui ont été changées
// (jamais tout un fichier où vivent des habillages ou d'autres écrans légitimement chauds).
// DIR_V2 permet de pointer sur un autre dossier (l'ancien code, pour prouver que le test échoue dessus).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DIR = process.env.DIR_V2 || new URL('../crm/v2/', import.meta.url).pathname;
const lire = (f) => readFileSync(DIR.replace(/\/?$/, '/') + f, 'utf8');

function teinte(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, sat };
}
// Chaud = du rouge au jaune (0° à 80°) ou du magenta au rose (300° à 360°), dès qu'il y a de la couleur. Un gris passe.
const chaud = (hex) => { const { h, sat } = teinte(hex); return sat >= 0.15 && (h < 80 || h >= 300); };
const hexes = (txt) => [...String(txt).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase());
const froid = (txt, quoi) => {
  const h = hexes(txt);
  assert.ok(h.length > 0, quoi + ' : aucune couleur lue (le test ne vise plus la bonne ligne)');
  assert.deepEqual(h.filter(chaud), [], quoi + ' : ton chaud');
};
// Texte de la première occurrence d'une expression, ou échec clair si elle a disparu.
const trouver = (src, re, quoi) => { const m = src.match(re); assert.ok(m, quoi + ' introuvable'); return m[0]; };

test('le contrôle reconnaît bien les tons chauds (cas connus relevés sur les écrans)', () => {
  for (const c of ['#A4520B', '#FBEEDF', '#D98A12', '#8A5200', '#8A4E0B', '#C7791A', '#C98A1A', '#9A5B12', '#FBF0DF', '#F39A1B', '#FFC400',
    '#E8722B', '#FDECDD', '#B24F14', '#FFD27A', '#FFE9B0', '#E0556E', '#E30613', '#C2185B']) assert.ok(chaud(c), c + ' devrait être chaud');
  for (const c of ['#0050E6', '#0B6E7A', '#E2F4F6', '#0486F4', '#63B9FE', '#00A9B5', '#0E7A4F', '#6A4FC4', '#4A5878', '#8A94A6', '#E9F0FF', '#C6D6F8', '#0034A0', '#D5E2FF'])
    assert.ok(!chaud(c), c + ' devrait être froid');
});

test('Infos : le ton « orange » des étiquettes (Prix qui baissent) est froid', () => {
  const css = lire('v2-infos-m1.css');
  froid(trouver(css, /--it-orange:#[0-9A-Fa-f]{6}/, '--it-orange'), '--it-orange');
  froid(trouver(css, /--it-orange-pale:#[0-9A-Fa-f]{6}/, '--it-orange-pale'), '--it-orange-pale');
});

test('Pilotage : « Officines actives » et « dont chères » sans ton chaud', () => {
  const js = lire('v2-pilotage.js'), css = lire('v2-pilotage-apple.css');
  froid(trouver(js, /id: 'act',[^\n]*?txt: '#[0-9A-Fa-f]{6}'/, 'tuile Officines actives'), 'tuile Officines actives');
  froid(trouver(css, /\.plm-k2 \.pa-n\{[^}]*\}/, '.plm-k2 .pa-n'), '.plm-k2 .pa-n');
  froid(trouver(css, /\.plm-ch\{[^}]*\}/, '.plm-ch'), '.plm-ch');
});

test('fiche officine : palette des familles de prix (puces, traits, graphique) sans ton chaud', () => {
  const js = lire('v2-pharma.js');
  const cats = trouver(js, /var CATS = \[[\s\S]*?\n  \];/, 'palette CATS');
  froid(cats, 'palette CATS');
});

test('Appro : zone du milieu de « Ce qui casse, jour par jour » sans ton chaud, et la légende suit', () => {
  const js = lire('v2-appro.js');
  froid(trouver(js, /\.axzones \.z-a\{background:rgba\([^)]*\)\}/, 'fond de zone').replace(/rgba\((\d+),(\d+),(\d+)[^)]*\)/, (_, r, g, b) => '#' + [r, g, b].map((x) => (+x).toString(16).padStart(2, '0')).join('')), 'fond de la zone du milieu');
  froid(trouver(js, /\.axb\.z-a \.axb-i\{background:#[0-9A-Fa-f]{6}\}/, 'barres de la zone'), 'barres de la zone du milieu');
  froid(trouver(js, /\.axleg \.l-a::before\{background:#[0-9A-Fa-f]{6}\}/, 'pastille de légende'), 'pastille de légende');
  froid(trouver(js, /zone [a-z]+\)',\s*'le circuit normal de commande[^\n]*?, '#[0-9A-Fa-f]{6}'\)/, 'tuile du milieu'), 'tuile du milieu');
  froid(trouver(js, /a\.score >= 50 \? '#[0-9A-Fa-f]{6}'/, 'urgence moyenne'), 'urgence moyenne');
  assert.doesNotMatch(js, /Ambre : de|Zone ambre :|\(zone ambre\)/, 'le mot « ambre » doit disparaître de la légende et des messages');
});

test('Tournées : bandeau d’information en bleu pâle, sans ton chaud', () => {
  froid(trouver(lire('v2-tournees.js'), /\.trn-note\{[^}]*\}/, '.trn-note'), '.trn-note');
  assert.doesNotMatch(trouver(lire('v2-tournees.js'), /\.trn-note\{[^}]*\}/, '.trn-note'), /amber/, 'plus de variable ambre');
});

test('Le QG : pastille « Nouveau » sans ton chaud', () => {
  const l = trouver(lire('v2-discussion.js'), /nouveau: \{ l: 'Nouveau', c: '[^']*' \}/, 'statut nouveau');
  assert.doesNotMatch(l, /amber/);
  froid(l, 'statut nouveau');
});

test('Concurrents : groupes, carte et légende sans ton chaud (Intégral = bleu de la marque)', () => {
  const src = lire('v2-concurrents-carte.js');
  // 1. aucune couleur chaude écrite en dur dans ce fichier (carte, légende, contours)
  assert.deepEqual(hexes(src).filter(chaud), [], 'couleur chaude écrite en dur dans v2-concurrents-carte.js');
  // 2. couleur réellement affichée de chaque groupe : le remplacement du fichier s'il existe, sinon la donnée
  const surcharge = {};
  const m = src.match(/var COUL_FROID = (\{[\s\S]*?\});/);
  if (m) for (const x of m[1].matchAll(/'?([\w-]+)'?: '(#[0-9A-Fa-f]{6})'/g)) surcharge[x[1]] = x[2];
  const require = createRequire(import.meta.url);
  globalThis.window = globalThis;
  require(DIR.replace(/\/?$/, '/') + 'grossistes-data.js');
  const groupes = globalThis.GROSSISTES_DATA.groupes;
  const aff = groupes.filter((g) => g.id === 'integral' || g.pdm_num > 0).map((g) => ({ id: g.id, c: (surcharge[g.id] || g.couleur).toUpperCase() }));
  assert.ok(aff.length >= 4, 'au moins 4 groupes affichés');
  assert.deepEqual(aff.filter((x) => chaud(x.c)), [], 'groupe affiché avec une couleur chaude');
  assert.equal(aff.find((x) => x.id === 'integral').c, '#0050E6', 'Intégral prend le bleu de la marque');
  assert.equal(new Set(aff.map((x) => x.c)).size, aff.length, 'deux groupes affichés ont la même couleur');
});

test('Listing 2027 : graphique « Notre marge par famille de prix » sans ton chaud', () => {
  froid(trouver(lire('v2-listings2027.js'), /var COULEURS = \{[^}]*\};/, 'COULEURS'), 'COULEURS des familles');
});

test('Biosimilaires : plus de barre de côté, plus de Geist Mono, plus aucun ton chaud ni rouge', () => {
  const js = lire('v2-biosimilaires.js');
  assert.doesNotMatch(js, /Geist/, 'Geist Mono encore présente');
  assert.doesNotMatch(js, /\.bs-card\.ip\{[^}]*border-left/, 'barre de côté encore présente');
  assert.deepEqual(hexes(js).filter(chaud), [], 'ton chaud dans v2-biosimilaires.js');
  assert.doesNotMatch(js, /ORANGE/, 'la constante ORANGE doit avoir disparu');
  // couleurs de texte : on les a ramenées à 8 au plus (il y en avait 16)
  const txt = new Set([...js.matchAll(/[^-]color:(#[0-9A-Fa-f]{6})/g)].map((x) => x[1].toUpperCase()));
  ['NAVY', 'GREEN', 'PURPLE', 'BLEU'].forEach((k) => { const v = js.match(new RegExp(k + " = '(#[0-9A-Fa-f]{6})'")); if (v) txt.add(v[1].toUpperCase()); });
  assert.ok(txt.size <= 9, 'trop de couleurs de texte : ' + txt.size + ' ' + [...txt].join(' '));
});

test('Groupements : le titre prend la même taille que les autres écrans (40 px, 35,1 px à 390, 32,4 à 360)', () => {
  const css = lire('v2-groupements-m1.css');
  const regles = [...css.matchAll(/\.gr-h1\{font-size:([^}]*)\}/g)].map((m) => m[1].trim().split(' ')[0]);
  const tel = trouver(css, /@media \(max-width:760px\)\{[\s\S]*?\n\}/, 'bloc téléphone');
  assert.ok(!/\.gr-h1\{font-size:30px\}/.test(tel), 'le titre est encore à 30 px au téléphone');
  assert.ok(regles.includes('clamp(32px,9vw,40px)'), 'règle clamp(32px,9vw,40px) absente : ' + regles.join(' | '));
  // 768 et 900 px : la règle « ≤ 1 000 px » doit exister (sinon clamp(30px,3.4vw,42px) donne 30 px)
  assert.match(css, /@media \(max-width:1000px\)\{\.gr-h1\{font-size:clamp\(32px,9vw,40px\)\}\}/);
  const px = (w) => Math.min(40, Math.max(32, w * 0.09));
  assert.equal(px(390).toFixed(1), '35.1');
  assert.equal(px(360).toFixed(1), '32.4');
  assert.equal(px(768), 40);
});

test('Accueil au téléphone : illustrations des icônes sans ton chaud (fenêtres, rayons, pot et boîtes)', () => {
  const js = lire('v2-accueil-cinq.js');
  froid(trouver(js, /<g class="ac-i-rays" stroke="#[0-9A-Fa-f]{6}"/, 'rayons'), 'rayons');
  froid(trouver(js, /<g fill="#[0-9A-Fa-f]{6}">' \+ w/, 'fenêtres éclairées'), 'fenêtres éclairées');
  assert.doesNotMatch(js, /fill="#C7791A"/i, 'ocre #C7791A encore présent en remplissage (boîte, pot)');
});

test('Concurrents › liens : le graphe suit la palette froide de la carte (Intégral en bleu, aucun groupe chaud)', () => {
  const src = lire('v2-concurrents-liens.js');
  const nous = (src.match(/NOUS = '(#[0-9A-Fa-f]{6})'/) || src.match(/ORANGE = '(#[0-9A-Fa-f]{6})'/) || [])[1];
  assert.equal((nous || '').toUpperCase(), '#0050E6', 'Intégral prend le bleu de la marque dans le graphe des liens');
  const table = {};
  const m = src.match(/var FROID = (\{[\s\S]*?\});/);
  if (m) for (const x of m[1].matchAll(/'(#[0-9A-Fa-f]{6})': '(#[0-9A-Fa-f]{6})'/g)) table[x[1].toUpperCase()] = x[2].toUpperCase();
  const require = createRequire(import.meta.url);
  globalThis.window = globalThis;
  require(DIR.replace(/\/?$/, '/') + 'grossistes-data.js');
  const vus = globalThis.GROSSISTES_DATA.groupes.filter((g) => g.couleur).map((g) => ({ id: g.id, c: table[g.couleur.toUpperCase()] || g.couleur.toUpperCase() }));
  assert.deepEqual(vus.filter((x) => chaud(x.c)), [], 'groupe du graphe des liens avec une couleur chaude');
});

test('Avatar de la barre du haut (toutes les pages, habillages compris) : plus d’orange', () => {
  const css = lire('v2.css'), hab = lire('v2-hab.css');
  const regles = [
    ...css.match(/^\.v2-av\{[\s\S]*?\}/m) || [],
    ...css.match(/^html:not\(\[data-hab\]\) \.tp-avb \.v2-av\{[^}]*\}/m) || [],
    ...hab.split('\n').filter((l) => /\.v2-av\{/.test(l)),
  ];
  assert.ok(regles.length >= 4, 'règles de l’avatar trouvées : ' + regles.length);
  for (const r of regles) assert.deepEqual(hexes(r).filter(chaud), [], 'avatar chaud : ' + r.slice(0, 90));
});

test('Couleur d’identité du Pilotage (barre de chargement, tuiles) : plus d’ambre', () => {
  const m = lire('v2.css').match(/--c-pilo:(#[0-9A-Fa-f]{6})/);
  assert.ok(m, 'variable --c-pilo trouvée');
  assert.ok(!chaud(m[1].toUpperCase()), '--c-pilo chaud : ' + m[1]);
});
