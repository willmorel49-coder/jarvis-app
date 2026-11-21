/* pilotage-haut.test.mjs — Pilotage ouvre sur le bandeau commun des écrans, au même endroit que les autres
 *
 * 21/11/2026 soir — Will : « homogénéité […] pas la même taille ni le même bandeau en haut », puis deux choix
 * cliqués : la VRAIE page Pilotage prend le bandeau commun de l'aube (titre « Pilotage » 40 px, période et
 * secteur DANS le bandeau à droite, comme les chiffres du Catalogue produits), sa page vide suit ; et sur Infos,
 * To do, Offilog, Catalogue produits et Pilotage, le bandeau commence à la même hauteur sous la barre d'onglets.
 * Avant : la vraie page avait son propre en-tête (header.pa-top sur un halo à elle, sans fond ni astre), 6 px
 * plus bas ; la page vide tenait dans 1 080 px au lieu de 1 232.
 * On rend l'ÉCRAN RÉEL (v2-pilotage.js), sur des ventes fictives (montants ronds inventés).
 * La hauteur au pixel se mesure sous WebKit (banc local) : ici, la structure et la règle commune.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'crm', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');

const win = {
  console, Date, Math, JSON, parseInt, parseFloat, isFinite, encodeURIComponent,
  setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout() {},
  requestAnimationFrame() { return 0; }, matchMedia: () => ({ matches: true }),
  document: { getElementById: () => null, createElement: () => ({ style: {}, dataset: {}, classList: { add() {} } }),
    head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} },
};
win.window = win; win.globalThis = win; win.ICO = () => '';

// Ventes fictives : deux commerciaux inventés, trois mois, montants ronds.
const V = (commercial, pharmacyId, month, mnt) => ({ pharmacyId, year: 2026, month, commercial, artCode: 'x', qte: 1, puNet: mnt, mntNetHt: mnt });
const VENTES = [V('Alice', 'p1', 8, 1000), V('Bruno', 'p2', 8, 2000), V('Alice', 'p1', 9, 1000), V('Bruno', 'p2', 9, 2000), V('Alice', 'p1', 10, 1000), V('Bruno', 'p2', 10, 2000)];
const fmtNum = (n) => (Math.round(n) || 0).toLocaleString('fr-FR');
const V2 = win.V2 = {
  pages: {}, user: { commercial: '', voitAussi: [], voitTous: true }, sales: VENTES, commFilter: '', ESCALE_COMMS: [],
  pharmacies: [{ id: 'p1', name: 'Pharmacie Un' }, { id: 'p2', name: 'Pharmacie Deux' }],
  commercials() { const s = {}; V2.sales.forEach((x) => { if (x.commercial) s[x.commercial] = 1; }); return Object.keys(s).sort(); },
  esc: (s) => String(s == null ? '' : s),
  sumCA: (a) => a.reduce((s, x) => s + (x.mntNetHt || 0), 0),
  fmtNum, fmtK: fmtNum, fmtEur: (n) => fmtNum(n) + ' €', margeMDLboite: () => 0, tint: () => 'var(--muted)', topbar: () => '', go() {}, render() {},
};
new Function('window', 'document', 'requestAnimationFrame', 'IntersectionObserver', 'matchMedia', 'ICO', lire('v2-pilotage.js'))(
  win, win.document, win.requestAnimationFrame, undefined, win.matchMedia, win.ICO);

function rendre(ventes) {
  V2.sales = ventes; V2.commFilter = '';
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  V2.pages.pilotage.render(root);
  return root.innerHTML;
}

test('la vraie page : le bandeau commun (.aube-tete), titre « Pilotage » marqueur de la CI, période et secteur dedans', () => {
  const html = rendre(VENTES);
  assert.match(html, /<div class="v2-wrap pa-wrap"><div class="pa-root pa-liste">/, 'la vraie page (marqueur positif), pas la page vide');
  const m = /<header class="pa-top aube-tete">([\s\S]*?)<\/header>/.exec(html);
  assert.ok(m, 'l\'en-tête est le bandeau commun de l\'aube (.aube-tete, scène posée par v2-aube.js)');
  const tete = m[1];
  assert.match(tete, /<h1 class="pa-title v2-page-title">Pilotage<\/h1>/, 'titre = nom de l\'onglet, classe .v2-page-title lue par la CI (parcours-connecte.mjs)');
  assert.match(tete, /<p class="v2-page-sub">[^<]+<\/p>/, 'une phrase sous le titre, comme les autres bandeaux');
  assert.match(tete, /<div class="pa-seg" role="group" aria-label="Période">/, 'le choix de période est DANS le bandeau');
  assert.match(tete, /<select class="pa-comm" aria-label="Secteur regardé">/, 'le menu secteur est DANS le bandeau');
  assert.match(tete, /<\/p><\/div><div class="pa-ctl">/, 'titre et phrase à gauche, commandes à droite');
});

test('la page vide : même colonne et même bandeau que la vraie page', () => {
  const html = rendre([]);
  assert.match(html, /<div class="v2-wrap pa-wrap"><div class="v2-page-title">Pilotage<\/div><div class="v2-page-sub">/, 'colonne .pa-wrap (1 232 px), titre lu par la CI et enveloppé en bandeau par v2-aube.js');
  assert.match(html, /Vos ventes ne sont pas encore disponibles/, 'c\'est bien la page vide (marqueur positif)');
  assert.match(lire('v2-aube.js'), /querySelectorAll\('\.v2-wrap > \.v2-page-title'\)/, 'v2-aube.js enveloppe toujours le titre nu de la page vide');
});

test('une seule règle de hauteur : rien n\'ajoute de marge au-dessus des bandeaux', () => {
  const css = lire('v2.css');
  const i = css.indexOf('MÊME HAUT (Will, choix cliqué)'); assert.ok(i > 0, 'le bloc « même haut » de v2.css');
  const bloc = css.slice(i, css.indexOf('/* 2. Chiffres en encre', i));
  assert.match(bloc, /html:root:root body \.v2-wrap\.olm\{padding-top:32px\}/, 'Offilog : la marge commune de la colonne (16 px avant)');
  assert.match(bloc, /@media \(max-width:640px\)\{html:root:root body \.v2-wrap\.olm\{padding-top:18px\}\}/, 'Offilog au téléphone : 18 px comme .v2-wrap');
  assert.match(bloc, /:is\(\.td-m1 \.td-hd,\.cpd-head,\.pa-top\.aube-tete\)\{margin-top:0\}/, 'To do (2 px), Catalogue (8 px) et Pilotage sans marge au-dessus du bandeau');
  assert.match(bloc, /\.pa-root\{padding-top:0\}/, 'Pilotage : plus les 6 px de .pa-root');
  assert.match(bloc, /\.pa-wrap \.aube-tete \.v2-page-title\{margin:0;font-size:clamp\(32px,9vw,40px\)/, 'titre de 40 px (35 px au téléphone), comme Infos');
  assert.doesNotMatch(lire('v2-pilotage-apple.css'), /\.pa-wrap::before\{/, 'plus de halo propre à Pilotage : la lumière vient du bandeau');
});
