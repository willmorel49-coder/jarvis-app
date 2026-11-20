// 20/11/2026 — écran Officines « Le répertoire » (v1 choisie par Will) : un tableau, une ligne par officine.
// On vérifie sur le code réel de v2-pharma.js : la tournée d'une officine (par son code OU par la fiche reliée),
// les noms en capitales, le tri, le chargement unique du fichier des tournées et les gestes définis une seule fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');

function tranche(debut, fin) {
  const i = src.indexOf(debut);
  assert.ok(i >= 0, 'introuvable : ' + debut);
  const j = src.indexOf(fin, i);
  assert.ok(j > i, 'fin introuvable : ' + fin);
  return src.slice(i, j);
}

// trnIdx / trnDe, tels qu'écrits dans le fichier, nourris d'un petit fichier de tournées fictif.
function tournees(T) {
  const code = tranche('var _trnRef = null', 'function ofActif');
  return new Function('window', code + '; return { trnDe: trnDe };')({ TOURNEES_ECRAN: T });
}
const T = {
  tournees: {
    T10: { code: 'T10', nom: 'Est', jours: ['lundi'], arrets: [{ id: '101' }, { id: '', fi: '202' }] },
    T12: { code: 'T12', nom: 'Ouest', jours: ['mardi'], arrets: [{ id: '101' }, { id: null, fi: null }] },
  },
};

test('tournée : trouvée par le code de l’officine (id) ou par la fiche reliée (fi)', () => {
  const { trnDe } = tournees(T);
  assert.deepEqual(trnDe({ id: 101 }), ['T10', 'T12'], 'une officine sur deux tournées les a toutes les deux');
  assert.deepEqual(trnDe({ id: '202' }), ['T10'], 'la fiche reliée suffit quand le code est vide');
  assert.deepEqual(trnDe({ id: '999' }), [], 'officine sans tournée');
});

test('tournée : fichier pas encore arrivé = aucune tournée, sans erreur', () => {
  const { trnDe } = tournees(undefined);
  assert.deepEqual(trnDe({ id: '101' }), []);
});

// trier(), tel qu'écrit dans renderList, avec l'état du tableau et la marge Intégral fictifs.
function trieur(ofl, marges = {}, rap = {}) {
  const code = tranche('function trier(list, pros) {', 'function applyFilters');
  return new Function('ofl', 'trnDe', 'notreMargeDe', '_rap', code + '; return trier;')(
    ofl, (p) => (p.t ? [p.t] : []), (id) => marges[id], rap);
}
const L = [
  { p: { id: 1, name: 'PHARMACIE DU MONT DE FACHES', t: 'T12' }, ca: 500, marge: 50 },
  { p: { id: 2, name: 'Pharmacie Bastide' }, ca: 900, marge: 10 },
  { p: { id: 3, name: 'SELARL PHARMACIE CENTRALE', t: 'T10' }, ca: 100, marge: 90 },
];
const ids = (l) => l.map((x) => x.p.id);

test('tri : chiffre d’affaires décroissant par défaut', () => {
  assert.deepEqual(ids(trieur({ tri: 'ca', sens: -1 })(L)), [2, 1, 3]);
});

test('tri : par nom « annuaire » (sans PHARMACIE, SELARL, article), dans les deux sens', () => {
  assert.deepEqual(ids(trieur({ tri: 'nom', sens: 1 })(L)), [2, 3, 1], 'Bastide, Centrale, Mont de Faches');
  assert.deepEqual(ids(trieur({ tri: 'nom', sens: -1 })(L)), [1, 3, 2]);
});

test('tri : par tournée, les officines sans tournée toujours en dernier', () => {
  assert.deepEqual(ids(trieur({ tri: 'tourn', sens: 1 })(L)), [3, 1, 2]);
  assert.deepEqual(ids(trieur({ tri: 'tourn', sens: -1 })(L)), [1, 3, 2]);
});

test('tri : marge du pharmacien et notre marge Intégral (absente = en dernier)', () => {
  assert.deepEqual(ids(trieur({ tri: 'marge', sens: -1 })(L)), [3, 1, 2]);
  assert.deepEqual(ids(trieur({ tri: 'nm', sens: -1 }, { 1: { tot: 30 }, 3: { tot: 70 } })(L)), [3, 1, 2]);
});

test('tri : prospects, seuls le nom et la tournée trient (sinon l’ordre du secteur est gardé)', () => {
  assert.deepEqual(ids(trieur({ tri: 'ca', sens: -1 })(L, true)), [1, 2, 3]);
  assert.deepEqual(ids(trieur({ tri: 'nom', sens: 1 })(L, true)), [2, 3, 1]);
});

test('tri : la liste d’origine n’est pas modifiée', () => {
  const avant = ids(L);
  trieur({ tri: 'nom', sens: 1 })(L);
  assert.deepEqual(ids(L), avant);
});

test('ligne : nom et ville en capitales dans la donnée (pas seulement en CSS)', () => {
  const ligne = tranche('function ligneOfl(x) {', 'function carteHtml');
  assert.match(ligne, /String\(p\.name \|\| ''\)\.toLocaleUpperCase\('fr-FR'\)/);
  assert.match(ligne, /String\(p\.ville \|\| ''\)\.toLocaleUpperCase\('fr-FR'\)/);
});

test('fichier des tournées : demandé une seule fois, jamais en boucle s’il n’arrive pas', () => {
  const bloc = tranche('if (m1 && !window.TOURNEES_ECRAN && !ofl.trnDemande', 'var tournOk');
  assert.match(bloc, /ofl\.trnDemande = true;/, 'le drapeau est posé avant la demande');
  assert.match(bloc, /V2\.loadFiles\(\['tournees'\]\)/);
  assert.match(bloc, /if \(window\.TOURNEES_ECRAN && /, 'on ne redessine que si le fichier est bien là');
});

test('gestes du tableau : chaque nom V2.ofl… est défini une seule fois', () => {
  for (const n of ['oflTourn', 'oflRap', 'oflTri', 'oflTrier', 'oflRaz']) {
    const defs = src.match(new RegExp('V2\\.' + n + '\\s*=', 'g')) || [];
    assert.equal(defs.length, 1, n + ' : ' + defs.length + ' définition(s)');
  }
});
