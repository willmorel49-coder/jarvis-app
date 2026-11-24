import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../crm/v2/v2-rdv-reco.js');

// Un extrait representatif du portefeuille et de l'annuaire, tire des vraies
// donnees. « Pharmacie HA » est la pour une raison precise : son nom
// distinctif fait deux lettres, et une version naive la trouvait dans
// « Verif mounjaro commande OmaHA beach ».
const PORTEFEUILLE = [
  { id: '2000001', name: 'Pharmacie HA', ville: 'ANCENIS' },
  { id: '2000002', name: 'Pharmacie ALBIOL', ville: 'ANGERS' },
  { id: '2000003', name: 'PHARMACIE DU JARDIN DES PLANTES', ville: 'ANGERS' },
  { id: '2000004', name: 'PHARMACIE DE LA DOUTRE', ville: 'ANGERS' },
  { id: '2000005', name: 'Pharmacie GODARD', ville: 'CHOLET' },
  { id: '2000006', name: 'PHARMACIE DE PARIS - LA BAULE', ville: 'LA BAULE' },
];
const NATIONAL = [
  { id: '2100001', name: 'PHARMACIE DESCARTES', ville: 'CHOLET' },
  { id: '2100002', name: 'PHARMACIE DE GETIGNE', ville: 'GETIGNE' },
  { id: '2100003', name: 'PHARMACIE DES MAUGES', ville: 'BEAUPREAU' },
  { id: '2100004', name: 'PHARMACIE ALEXANDRE PREISS', ville: 'STRASBOURG' },
  { id: '2100005', name: 'PHARMACIE DE LA BANQUE', ville: 'TOULON' },
  { id: '2100006', name: 'PHARMACIE CAEN', ville: 'CAEN' },
  { id: '2100007', name: 'PHARMACIE DE LA PAULINE', ville: 'LA VALETTE' },
  { id: '2100008', name: 'PHARMACIE DE VILLEURBANNE (JBS)', ville: 'VILLEURBANNE' },
  { id: '2100009', name: 'PHARMACIE DE LA GARE', ville: 'LAVAL' },
  { id: '2100010', name: 'PHARMACIE DE LA GARE', ville: 'NANTES' },
];

const IP = R.indexer(PORTEFEUILLE);
const IN = R.indexer(NATIONAL);
const app = (titre, alias) => R.apparier(titre, IP, IN, alias || {});

test('normaliser : accents, ponctuation, casse', () => {
  assert.equal(R.normaliser('Phie de l’Église'), 'PHIE DE L EGLISE');
});

test('distinctif : retire PHARMACIE et les mots vides', () => {
  assert.equal(R.distinctif('PHARMACIE DE LA DOUTRE'), 'DOUTRE');
  assert.equal(R.distinctif('PHARMACIE DE PARIS - LA BAULE'), 'PARIS BAULE');
});

test('segment : retire le verbe d’action et garde ce qui suit le marqueur', () => {
  assert.deepEqual(R.segment('Appeler phie Godard'), { texte: 'GODARD', marqueur: true });
  assert.deepEqual(R.segment('Passer voir phie d’andard'), { texte: 'D ANDARD', marqueur: true });
});

test('segment : le contenu des parentheses est un contact, pas un nom', () => {
  assert.equal(R.segment('Phie des câlins (Charlotte)').texte, 'DES CALINS');
});

test('segment : sans marqueur, le drapeau est faux', () => {
  assert.equal(R.segment('Reunion equipe').marqueur, false);
});

test('reconnu : le cas simple', () => {
  const r = app('Pharmacie Godard');
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.officine.id, '2000005');
  assert.equal(r.source, 'portefeuille');
});

test('reconnu : abrege, avec un verbe devant', () => {
  const r = app('Appeler phie albiol');
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.officine.id, '2000002');
});

test('reconnu : va chercher dans l’annuaire national quand le marqueur est la', () => {
  const r = app('Phie de getigne');
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.officine.id, '2100002');
  assert.equal(r.source, 'annuaire');
});

test('reconnu : un nom distinctif de deux lettres, quand il EST tout le segment', () => {
  const r = app('Phie ha');
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.officine.id, '2000001');
});

test('reconnu : la ville departage deux homonymes', () => {
  const r = app('Allez phie de la gare Laval');
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.officine.id, '2100009');
});

// ─── Les faux positifs mesures le 14/08/2026. Chacun a ete produit par une
// version naive ; ils sont ici pour qu’aucun ne revienne.
test('faux positif : un nom court ne se trouve pas au milieu d’un autre mot', () => {
  assert.equal(app('Verif mounjaro commande Omaha beach').etat, 'ignore');
});

test('faux positif : « André » n’est pas « ALEXANDRE PREISS »', () => {
  assert.equal(app('André').etat, 'ignore');
});

test('faux positif : sans le mot pharmacie, l’annuaire national reste ferme', () => {
  assert.equal(app('Caen').etat, 'ignore');
  assert.equal(app('PAULINE').etat, 'ignore');
  assert.equal(app('RDV BANQUE').etat, 'ignore');
  assert.equal(app('JB').etat, 'ignore');
});

test('faux positif : un mot du metier n’est pas une officine', () => {
  assert.equal(app('Congrès pharmacien Nantes').etat, 'ignore');
});

test('a confirmer : deux homonymes que rien ne departage', () => {
  const r = app('Phie de la gare');
  assert.notEqual(r.etat, 'reconnu');
});

test('alias : un titre corrige a la main est reconnu directement', () => {
  const brut = 'Aller phie des javobins Le Mans';
  assert.equal(app(brut).etat, 'ignore');
  const alias = {};
  alias[R.cleAlias(brut)] = '2000003';
  const r = app(brut, alias);
  assert.equal(r.etat, 'reconnu');
  assert.equal(r.source, 'alias');
  assert.equal(r.officine.id, '2000003');
});

test('alias : la cle ignore le verbe d’action et la casse', () => {
  assert.equal(R.cleAlias('Appeler phie du lys'), R.cleAlias('Phie du lys'));
});

// ─── 24/11/2026 : quatre événements à venir d'un agenda réel tombaient sur les officines d'un
// collègue. Les noms ci-dessous sont des noms génériques, les villes sont fictives.
const AUTRES = R.indexer([
  { id: '2200001', name: 'PHARMACIE DE BOURG', ville: 'BOURG' },
  { id: '2200002', name: 'PHARMACIE DU BOULEVARD', ville: 'VILLE-X' },
  { id: '2200003', name: 'PHARMACIE COEUR DE ROSERAIE', ville: 'VILLE-Y' },
  { id: '2200004', name: 'PHARMACIE DE LA ROCADE', ville: 'VILLE-Z' },
]);
const app2 = (titre) => R.apparier(titre, AUTRES, [], {});

test('normaliser : « œ » devient OE, il ne disparaît pas', () => {
  assert.equal(R.normaliser('Phie cœur de bourg'), 'PHIE COEUR DE BOURG');
  assert.equal(R.normaliser('ŒUVRE Æ'), 'OEUVRE AE');
});

test('faux positif : un nom d’un seul mot n’explique pas un titre qui en dit plus', () => {
  assert.notEqual(app2('Phie cœur de bourg').etat, 'reconnu', '« cœur » n’est pas dans « Pharmacie de Bourg »');
  assert.notEqual(app2('Pharmacie boulevard de l’Est').etat, 'reconnu', '« Est » n’est pas dans « Pharmacie du Boulevard »');
  assert.notEqual(app2('Pharmacie de la rocade Le Mans').etat, 'reconnu', 'une autre ville que la sienne');
});

test('reconnu : le nom complet, avec ou sans sa ville, reste une certitude', () => {
  assert.equal(app2('Phie du bourg').etat, 'reconnu');
  assert.equal(app2('Pharmacie de la rocade Ville-Z').etat, 'reconnu');
  const r = app2('Pharmacie cœur de la roseraie');
  assert.equal(r.etat, 'reconnu', 'avec le « œ » lu, le nom entier est retrouvé');
  assert.equal(r.officine.id, '2200003');
});
