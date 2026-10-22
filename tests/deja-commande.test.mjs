/* « Déjà commandé par » (21/10/2026) : le calcul pur du panneau du Comptoir.
   Données fabriquées à la main : la réponse est connue d'avance. Ne dépend pas des ventes protégées.
   Une ligne de ventes : [officine, mois, commercial, cip, boîtes, pu, CA]. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sb = { document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } }, console, setTimeout, clearTimeout };
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext('window.V2 = {};', sb);
vm.runInContext(readFileSync(new URL('../crm/v2/v2-comptoir.js', import.meta.url), 'utf8'), sb);
const C = sb.V2.comptoir;
const nu = (x) => JSON.parse(JSON.stringify(x));   // sort du bac à sable : prototypes différents
const estReste = (id) => id === '0' || id === '0E';

const VENTES = [
  ['100', 1, 'A', 'P1', 10, 5, 50],
  ['100', 3, 'A', 'P1', 5, 5, 25],      // même officine, mois plus récent : cumul 15, dernier mois 3
  ['200', 2, 'A', 'P1', 40, 5, 200],
  ['300', 2, 'B', 'P1', 0, 5, 0],       // 0 boîte : ignorée
  ['300', 2, 'B', 'P1', -4, 5, -20],    // négative : ignorée
  ['0',   2, '',  'P1', 999, 5, 999],   // reste du réseau : jamais compté
  ['0E',  2, '',  'P1', 999, 5, 999],
  ['400', 4, 'B', 'P2', 7, 5, 35],      // autre produit de la même molécule
  ['100', 2, 'A', 'P2', 3, 5, 15],
  ['500', 1, 'B', 'P3', 8, 5, 40]       // autre molécule
];

test('regroupement par officine, cumul des boîtes et dernier mois', () => {
  const r = C._dejaCommande(VENTES, { P1: 1 }, null, estReste);
  assert.deepEqual(nu(r.map((x) => [x.id, x.q, x.dern])), [['200', 40, 2], ['100', 15, 3]]);
});

test('exclusion du reste du réseau (0 et 0E), boîtes <= 0 ignorées', () => {
  const r = C._dejaCommande(VENTES, { P1: 1 }, null, estReste);
  assert.equal(r.some((x) => x.id === '0' || x.id === '0E' || x.id === '300'), false);
  // Contre-épreuve : sans la règle, le reste du réseau passe en tête — le test sait donc voir la différence.
  const sans = C._dejaCommande(VENTES, { P1: 1 }, null, null);
  assert.equal(sans[0].q, 999);
  assert.equal(sans.length, 4);
});

test('commercial restreint : seulement ses officines', () => {
  const miennes = (id) => id === '100';
  const r = C._dejaCommande(VENTES, { P1: 1 }, miennes, estReste);
  assert.deepEqual(nu(r.map((x) => x.id)), ['100']);
  const aucune = C._dejaCommande(VENTES, { P1: 1 }, () => false, estReste);
  assert.deepEqual(nu(aucune), []);
});

test('mode molécule : plusieurs CIP regroupés, l\'officine n\'apparaît qu\'une fois', () => {
  const r = C._dejaCommande(VENTES, { P1: 1, P2: 1 }, null, estReste);
  assert.deepEqual(nu(r.map((x) => [x.id, x.q, x.dern])), [['200', 40, 2], ['100', 18, 3], ['400', 7, 4]]);
  // Toute la molécule compte au moins autant de clientes que le produit seul.
  assert.ok(r.length >= C._dejaCommande(VENTES, { P1: 1 }, null, estReste).length);
});

test('produit que personne n\'a commandé : liste vide', () => {
  assert.deepEqual(nu(C._dejaCommande(VENTES, { INCONNU: 1 }, null, estReste)), []);
  assert.deepEqual(nu(C._dejaCommande([], { P1: 1 }, null, estReste)), []);
});

test('période : premier et dernier mois des ventes comptées', () => {
  const ix = C._indexCommandes(VENTES, null, estReste);
  assert.equal(ix.debut, 1);
  assert.equal(ix.fin, 4);
});

/* 22/10/2026 — molécule manquante au catalogue : la DCI de la base nationale (national.json, champ d).
   Elle ne porte qu'UNE substance, même pour une association : on ne s'en sert pour regrouper que si
   les produits déjà étiquetés qui partagent cette DCI n'ont qu'une seule molécule. */
const CAT = {
  GEL:  { mol: 'APIXABAN' },               // absent de la base nationale
  E5:   { mol: '' },                       // ELIQUIS 5MG : aucun voisin étiqueté avec cette DCI → la DCI elle-même
  DX1:  { mol: 'DOXAZOSINE' },
  DX2:  { mol: 'Doxazosine' },             // même molécule, autre graphie : pas une ambiguïté
  DX3:  { mol: '' },                       // → vocabulaire du catalogue
  PA1:  { mol: 'PARACETAMOL' },
  PA2:  { mol: 'TRAMADOL/PARACETAMOL' },   // association : la base nationale dit « PARACÉTAMOL »
  PA3:  { mol: '' },                       // ambigu → recherche seulement
  SANS: { mol: '' },                       // inconnu de la base nationale
  ETIQ: { mol: 'FOO' }                     // a déjà sa molécule : jamais touché
};
const NAT = {
  E5: { d: 'APIXABAN' }, DX1: { d: 'MÉSILATE DE DOXAZOSINE' }, DX2: { d: 'MÉSILATE DE DOXAZOSINE' }, DX3: { d: 'MÉSILATE DE DOXAZOSINE' },
  PA1: { d: 'PARACÉTAMOL' }, PA2: { d: 'PARACÉTAMOL' }, PA3: { d: 'PARACÉTAMOL' }, ETIQ: { d: 'BAR' }
};

test('repli DCI : seuls les produits sans molécule et connus de la base nationale', () => {
  const r = nu(C._repliMolecules(CAT, NAT));
  assert.deepEqual(Object.keys(r).sort(), ['DX3', 'E5', 'PA3']);
});

test('repli DCI : DCI seule, traduite dans le vocabulaire du catalogue, ou vide si association probable', () => {
  const r = nu(C._repliMolecules(CAT, NAT));
  assert.deepEqual(r.E5, { dci: 'APIXABAN', mol: 'APIXABAN' });
  assert.deepEqual(r.DX3, { dci: 'MÉSILATE DE DOXAZOSINE', mol: 'DOXAZOSINE' });
  assert.deepEqual(r.PA3, { dci: 'PARACÉTAMOL', mol: '' });
  // Contre-épreuve : sans l'association étiquetée, le même produit se range sous le paracétamol.
  const sansAsso = Object.assign({}, CAT); delete sansAsso.PA2;
  assert.equal(nu(C._repliMolecules(sansAsso, NAT)).PA3.mol, 'PARACETAMOL');
});
