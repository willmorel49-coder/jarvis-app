// 26/11/2026 — Will : « souvent on connaît une pharmacie par son nom sur Google Maps, pas tout le temps le nom du titulaire » :
// partout, le NOM de la pharmacie, puis son TITULAIRE, puis sa VILLE et son CODE POSTAL.
// Ce test lance le vrai code de v2-pharma.js (officines et personnes fictives) et garde :
//  1. la civilité de l'annuaire national passe devant, abrégée (« DUPONT Marie (Madame) » → « Mme DUPONT Marie ») ;
//  2. l'ordre de la correction de l'équipe, de la base clients, du titulaire du prospect, puis de l'annuaire ;
//  3. « titulaire · ville code postal », le zéro de tête remis ;
//  4. la ligne du répertoire : nom, puis titulaire, puis ville et code postal (et rien d'inventé sans titulaire).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
function tranche(debut, fin) {
  const i = src.indexOf(debut); assert.ok(i >= 0, 'introuvable : ' + debut);
  const j = src.indexOf(fin, i); assert.ok(j > i, 'fin introuvable : ' + fin);
  return src.slice(i, j);
}
const fn = (nom) => { const i = src.indexOf('  function ' + nom + '('); assert.ok(i > 0, nom + ' introuvable'); return src.slice(i, src.indexOf('\n  }\n', i) + 5); };

// titulaireOf … V2.officineSous, tels qu'écrits dans le fichier
function aides(win, V2 = {}) {
  const code = tranche('  function titulaireOf(', '  function titEditor(');
  new Function('window', 'V2', 'pharmaFrById', code)(win, V2, () => { throw new Error('pas de parcours ligne à ligne de l’annuaire'); });
  return V2;
}
const ANNUAIRE = { p: [
  // [6] nom, [7] ville, [8] code postal, [10] titulaire, [13] code
  Object.assign([], { 6: 'PHARMACIE FICTIVE A', 7: 'VILLE A', 8: '01000', 10: 'TESTEUR Alice (Madame)', 13: '9000001' }),
  Object.assign([], { 6: 'PHARMACIE FICTIVE B', 7: 'VILLE B', 8: '02000', 10: 'ESSAI Bruno (Monsieur) / ESSAI Chloé (Madame)', 13: '9000002' }),
  Object.assign([], { 6: 'PHARMACIE FICTIVE C', 7: 'VILLE C', 8: '03000', 10: 'MODELE Dan (Sans appellation)', 13: '9000003' }),
] };

test('annuaire : la civilité passe devant, abrégée ; une mention qui n’est pas une civilité disparaît', () => {
  const V2 = aides({});
  assert.equal(V2.titulaireLisible('TESTEUR Alice (Madame)'), 'Mme TESTEUR Alice');
  assert.equal(V2.titulaireLisible('ESSAI Bruno (Monsieur) / ESSAI Chloé (Madame)'), 'M. ESSAI Bruno / Mme ESSAI Chloé');
  assert.equal(V2.titulaireLisible('MODELE Dan (Sans appellation)'), 'MODELE Dan');
  assert.equal(V2.titulaireLisible('Mme Alice TESTEUR'), 'Mme Alice TESTEUR', 'la base clients est déjà écrite ainsi');
  assert.equal(V2.titulaireLisible(''), '');
});

test('titulaire : correction de l’équipe, puis base clients, puis titulaire du prospect, puis annuaire', () => {
  const win = { CLIENTS_ACTIFS: { d: { '9000001': ['', '', '', 'Mme Alice TESTEUR'] } }, PHARMA_FR: ANNUAIRE };
  const V2 = aides(win);
  assert.equal(V2.titulaireDe('9000001'), 'Mme Alice TESTEUR', 'base clients avant l’annuaire');
  assert.equal(V2.titulaireDe('9000002'), 'M. ESSAI Bruno / Mme ESSAI Chloé', 'sans base clients : l’annuaire');
  assert.equal(V2.titulaireDe('px_fictif', 'Mme Zoé FICTIF'), 'Mme Zoé FICTIF', 'prospect créé à la main : son titulaire');
  assert.equal(V2.titulaireDe('9999999'), '', 'inconnue : rien d’inventé');
  V2.titOvr = { '9000001': 'M. Correction FAITE' };
  assert.equal(V2.titulaireDe('9000001'), 'M. Correction FAITE', 'la correction de l’équipe passe avant tout');
});

test('sous le nom : « titulaire · ville code postal », le zéro de tête remis', () => {
  const V2 = aides({});
  assert.equal(V2.officineSous('Mme Alice TESTEUR', 'VILLE A', '1000'), 'Mme Alice TESTEUR · VILLE A 01000');
  assert.equal(V2.officineSous('', 'VILLE A', '01000'), 'VILLE A 01000');
  assert.equal(V2.officineSous('Mme Alice TESTEUR', '', ''), 'Mme Alice TESTEUR');
  assert.equal(V2.officineSous('', '', ''), '');
});

// La ligne du répertoire (ligneOfl), voisines remplacées par des repères
function ligne(win, p) {
  const V2 = aides(win, { esc: (s) => String(s).replace(/</g, '&lt;'), voitVentesDe: () => false, fmtEur: (n) => n + ' €' });
  const code = fn('cpDe') + fn('ligneOfl') + '; return ligneOfl;';
  const f = new Function('V2', '_rap', 'trnDe', 'notreMargeDe', 'cl1PerV', 'oflPerMarge', 'cl1PerOff', code)(
    V2, {}, () => [], () => null, () => '', () => '', () => '');
  return f({ p, ca: 0, marge: 0 });
}
const texte = (h) => h.replace(/<[^>]+>/g, '|').split('|').map((x) => x.trim()).filter(Boolean);

test('répertoire : nom, puis titulaire, puis ville et code postal — cliente et prospect', () => {
  const win = { CLIENTS_ACTIFS: { d: { '9000001': ['', '', '', 'Mme Alice TESTEUR'] } }, PHARMA_FR: ANNUAIRE };
  const t1 = texte(ligne(win, { id: '9000001', name: 'Pharmacie fictive A', ville: 'Ville A', cp: '1000' }));
  assert.deepEqual(t1.slice(0, 4), ['PHARMACIE FICTIVE A', 'Mme Alice TESTEUR', '·', 'VILLE A 01000']);
  const t2 = texte(ligne(win, { id: '9000002', name: 'Pharmacie fictive B', ville: 'Ville B', cp: '02000', _prospect: true, tit: ANNUAIRE.p[1][10] }));
  assert.deepEqual(t2.slice(0, 4), ['PHARMACIE FICTIVE B', 'M. ESSAI Bruno / Mme ESSAI Chloé', '·', 'VILLE B 02000']);
});

test('répertoire : sans titulaire connu, la ville seule, sans point en trop', () => {
  const t = texte(ligne({}, { id: '9999999', name: 'Pharmacie fictive Z', ville: 'Ville Z', cp: '09000' }));
  assert.deepEqual(t.slice(0, 2), ['PHARMACIE FICTIVE Z', 'VILLE Z 09000']);
  assert.ok(!t.includes('·'));
});
