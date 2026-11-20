/* pilotage-equipe-responsable.test.mjs — le Pilotage d'un responsable d'établissement
 *
 * 20/11/2026 — Aurélie, responsable de l'établissement CPR, profil
 * commercial = « Aurélie (CPR)+Pauline G.+Manon+Ingrid L.+Morgane ». Will :
 * « elle a pas de pilotage a elle cest pas une commercial elle est responsable de
 * l'établissement cpr ». Avant : le Pilotage s'ouvrait sur « Mon secteur » (le sien,
 * vide) et affichait « Vos ventes ne sont pas encore disponibles », sans le menu.
 * Attendu : il s'ouvre sur l'équipe entière (ses commerciaux additionnés, jamais le
 * reste du réseau que porte son jeu de ventes), avec le détail par commercial.
 * On rend l'ÉCRAN RÉEL (v2-pilotage.js) avec le V2.commSales et la détection du
 * profil RÉELS de v2-boot.js, sur des ventes fictives.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'crm', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');
const BOOT = lire('v2-boot.js');

// Un bloc `debut … }` du fichier livré (accolades équilibrées), pas une copie.
function bloc(src, debut) {
  const i = src.indexOf(debut); assert.ok(i > 0, 'introuvable dans v2-boot.js : ' + debut);
  let p = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') p++; else if (src[j] === '}') { p--; if (p === 0) break; } }
  return src.slice(i, j + 1) + ';';
}

const win = {
  console, Date, Math, JSON, parseInt, parseFloat, isFinite, encodeURIComponent,
  setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout() {},
  requestAnimationFrame() { return 0; }, matchMedia: () => ({ matches: true }),
  document: { getElementById: () => null, createElement: () => ({ style: {}, dataset: {}, classList: { add() {} } }),
    head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} },
};
win.window = win; win.globalThis = win; win.ICO = () => '';

// Ventes fictives, juin 2026 : l'équipe (A, B), un collègue hors équipe (C) et le reste
// du réseau agrégé sans commercial (officine « 0 »), comme dans un jeu restreint.
const V = (commercial, pharmacyId, mnt) => ({ pharmacyId, year: 2026, month: 6, commercial, artCode: 'x', qte: 1, puNet: mnt, mntNetHt: mnt });
const VENTES = [V('Alice', 'p1', 1000), V('Bruno', 'p2', 234), V('Chloé', 'p3', 50000), V('', '0', 70000)];
const EQUIPE = ['Alice', 'Bruno'];
const fmtNum = (n) => (Math.round(n) || 0).toLocaleString('fr-FR');
const V2 = win.V2 = {
  pages: {}, user: null, sales: VENTES, commFilter: '', ESCALE_COMMS: [],
  pharmacies: [{ id: 'p1', name: 'Pharmacie Un' }, { id: 'p2', name: 'Pharmacie Deux' }, { id: 'p3', name: 'Pharmacie Trois' }],
  commercials() { const s = {}; V2.sales.forEach((x) => { if (x.commercial) s[x.commercial] = 1; }); return Object.keys(s).sort(); },
  esc: (s) => String(s == null ? '' : s),
  sumCA: (a) => a.reduce((s, x) => s + (x.mntNetHt || 0), 0),
  fmtNum, fmtK: fmtNum, margeMDLboite: () => 0, tint: () => 'var(--muted)', topbar: () => '', go() {}, render() {},
};
new Function('V2', bloc(BOOT, 'V2.fmtEur = function'))(V2);
new Function('V2', bloc(BOOT, 'V2.commSales = function'))(V2);
new Function('window', 'document', 'requestAnimationFrame', 'IntersectionObserver', 'matchMedia', 'ICO', lire('v2-pilotage.js'))(
  win, win.document, win.requestAnimationFrame, undefined, win.matchMedia, win.ICO);

// La détection du profil, lue dans v2-boot.js (les deux lignes après « var mEtab »).
function equipeDe(commercial, voitTous) {
  const parts = commercial.split('+').map((s) => s.trim()).filter(Boolean);
  const user = { commercial: parts[0] || '', voitAussi: parts.slice(1), voitTous: !!voitTous };
  const i = BOOT.indexOf('var mEtab'); assert.ok(i > 0, 'détection du responsable introuvable dans v2-boot.js');
  const lignes = BOOT.slice(i).split('\n').slice(0, 2).join('\n');
  new Function('V2', lignes)({ user });
  return user.equipe;
}

const AURELIE = () => ({ commercial: 'Aurélie (CPR)', voitAussi: EQUIPE.slice(), voitTous: false, equipe: 'CPR' });
function rendre(commFilter, user) {
  V2.commFilter = commFilter; V2.user = user; V2._piloScopedInit = false;
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  V2.pages.pilotage.render(root);
  return root.innerHTML;
}
// les espaces insécables (fines ou non) des montants deviennent des espaces simples : on compare les chiffres, pas le formateur
const esp = (x) => String(x).replace(/[\s\u00a0\u202f]+/g, ' ');
const texte = (h) => esp(h.replace(/<[^>]+>/g, ' '));

test('le profil « Prénom (ÉTAB)+A+B » est reconnu comme responsable, les autres non', () => {
  assert.equal(equipeDe('Aurélie (CPR)+Pauline G.+Manon+Ingrid L.+Morgane'), 'CPR');
  assert.equal(equipeDe('Guillaume+Nicolas'), '', 'un commercial avec un collègue ouvert reste un commercial');
  assert.equal(equipeDe('Aurélie (CPR)'), '', 'sans équipe ouverte, pas de vue équipe');
  assert.equal(equipeDe('Aurélie (CPR)+Manon', true), '', 'accès total : le Pilotage complet, pas la vue équipe');
  assert.equal(equipeDe('Pauline G.+Manon'), '', 'un point dans le prénom ne fait pas un responsable');
});

test('V2.commSales sans filtre : l’équipe seule, ni le collègue hors équipe ni le reste du réseau', () => {
  V2.user = AURELIE(); V2.commFilter = '';
  assert.deepEqual(V2.commSales().map((s) => s.commercial), ['Alice', 'Bruno']);
  V2.commFilter = 'Bruno';
  assert.deepEqual(V2.commSales().map((s) => s.commercial), ['Bruno']);
  V2.user = { commercial: '', voitTous: true }; V2.commFilter = '';
  assert.equal(V2.commSales().length, VENTES.length, 'super-admin : tout, comme avant');
});

test('Aurélie : le Pilotage s’ouvre sur l’équipe CPR, sans « Mon secteur », avec ses commerciaux', () => {
  // même si un ancien rendu avait posé son propre nom en filtre
  const h = rendre('Aurélie (CPR)', AURELIE());
  assert.equal(V2.commFilter, '', 'filtre remis sur l’équipe');
  assert.ok(!h.includes('Vos ventes ne sont pas encore disponibles'), 'plus d’écran vide');
  assert.ok(!h.includes('Mon secteur'), 'aucun « Mon secteur »');
  assert.ok(h.includes('<option value="" selected>Équipe CPR</option>'), 'menu ouvert sur « Équipe CPR »');
  EQUIPE.forEach((n) => assert.ok(h.includes('<option value="' + n + '">' + n + '</option>'), 'option ' + n));
  assert.ok(!h.includes('value="Chloé"'), 'jamais un collègue hors équipe');
});

test('Aurélie : les chiffres sont ceux de l’équipe additionnée, le détail par commercial est là', () => {
  const t = texte(rendre('', AURELIE()));
  assert.ok(t.includes(esp(V2.fmtEur(1234))), 'CA de l’équipe = 1 234 € : ' + t.slice(0, 400));
  [51234, 71234, 121234].forEach((x) => assert.ok(!t.includes(esp(V2.fmtEur(x))), 'aucun total qui mélange le hors-équipe : ' + V2.fmtEur(x)));
  const h = rendre('', AURELIE());
  assert.ok(h.includes('data-c="Alice"') && h.includes('data-c="Bruno"'), 'classement par commercial de l’équipe');
  assert.ok(!h.includes('data-c="Chloé"'), 'pas de collègue hors équipe dans le classement');
  assert.ok(!/réseau Intégral[^<]*1\s?234/.test(t), 'l’équipe n’est pas présentée comme le réseau');
});

test('Aurélie : choisir un commercial de l’équipe reste sur lui', () => {
  const h = rendre('Bruno', AURELIE());
  assert.equal(V2.commFilter, 'Bruno');
  assert.ok(h.includes('<option value="Bruno" selected>Bruno</option>'));
  assert.ok(texte(h).includes(esp(V2.fmtEur(234))));
});

test('non-régression : un commercial avec un collègue ouvert garde « Mon secteur »', () => {
  const h = rendre('', { commercial: 'Alice', voitAussi: ['Bruno'], voitTous: false, equipe: '' });
  assert.equal(V2.commFilter, 'Alice', 'atterrit sur « Moi »');
  assert.ok(h.includes('>Mon secteur</option>'));
  assert.ok(!h.includes('Équipe'));
});
