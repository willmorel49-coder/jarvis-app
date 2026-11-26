// 26/11/2026 — « Suivi depuis le 1er janvier » : l'écran comptait 37 clientes vues, la vérification de l'agenda de Will
// (relu titre par titre) en trouvait 47. Choix cliqué de Will : corriger la reconnaissance. L'enseigne d'une de ses
// clientes passe avant une homonyme ailleurs en France, une ville où il n'a qu'une cliente suffit, les fautes courantes
// sont tolérées, et les tâches (« mettre 2 Repatha », « prise rdv ») ne comptent plus comme visites.
// Officines, villes et titres fictifs (jamais un vrai titre de son agenda ici).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = (f) => fs.readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const ligne = (nom, ville, cp, id) => [0, 0, 0, 0, 0, 0, nom, ville, cp, '', '', '', '', id];

// Ses clientes (AAA) sont dans le 49 et le 14 ; les homonymes « lointaines » ailleurs.
const FICHIER = [
  { id: '9400001', name: 'Pharmacie ESSAIUN - FICTIF', ville: 'BOURGTEST SUR LAC', cp: '14801', comms: ['AAA'] },
  { id: '9400002', name: 'PHARMACIE DES ORTIES', ville: 'PRADETTE', cp: '49802', comms: ['AAA'] },
  { id: '9400003', name: 'Pharmacie ESSAITROIS', ville: 'PORTVILLE', cp: '14803', comms: ['AAA'] },
  { id: '9400004', name: 'Pharmacie ESSAIQUATRE', ville: 'LA FOSSETTE', cp: '49804', comms: ['AAA'] },
  { id: '9400005', name: 'Pharmacie ESSAICINQ', ville: 'IXE', cp: '14805', comms: ['AAA'] },
  { id: '9400006', name: 'Pharmacie ESSAISIX', ville: 'ST VIRGULE LE GRAND', cp: '14806', comms: ['AAA'] },
  { id: '9400007', name: 'Pharmacie ESSAISEPT', ville: 'LA SAUGE SUR LOIRETTE', cp: '49807', comms: ['AAA'] },
  { id: '9400008', name: 'PHARMACIE SAINT ROMUALD DE LA PLACE', ville: 'ST ROMUALD DE LA PLACE', cp: '49808', comms: ['AAA'] },
  { id: '9400009', name: 'Pharmacie ESSAINEUF', ville: 'BELLEMONT BOURG', cp: '49809', comms: ['AAA'] },
  { id: '9400010', name: 'Pharmacie ESSAIDIX', ville: 'GRANDEVILLE', cp: '49810', comms: ['AAA'] },
  { id: '9400011', name: 'Pharmacie BROUSSAILLE', ville: 'PETITBOURG', cp: '49811', comms: ['AAA'] },
  { id: '9400012', name: 'Pharmacie COLLEGUEDOUZE', ville: 'IXE', cp: '14805', comms: ['BBB'] },
];
const ANNUAIRE = { p: [
  // les enseignes de ses clientes (même code que le fichier)
  ligne('PHARMACIE DU LAC', 'BOURGTEST SUR LAC', '14801', 9400001),
  ligne('PHARMACIE DU QUAI DE L ORME', 'PORTVILLE', '14803', 9400003),
  ligne('PHARMACIE FRANCOIS IER', 'LA FOSSETTE', '49804', 9400004),
  ligne('PHARMACIE D IXE CENTRE COMMERCIAL', 'IXE', '14805', 9400005),
  ligne('PHARMACIE DU PONTET', 'ST VIRGULE LE GRAND', '14806', 9400006),
  ligne('PHARMACIE DU VAL DE LOIRETTE', 'LA SAUGE SUR LOIRETTE', '49807', 9400007),
  ligne('PHARMACIE BROUSSAILLE', 'PETITBOURG', '49811', 9400011),
  // homonymes ailleurs en France
  ligne('PHARMACIE DU LAC', 'LAC', '41999', 9499001),                     // LAC serait aussi une commune
  ligne('PHARMACIE DU GRAND LAC', 'RIVETTE', '56999', 9499002),
  ligne('PHARMACIE DES GRANDES ORTIES', 'GIRONDETTE', '33999', 9499003),
  ligne('PHARMACIE DU QUAI', 'MARSEILLETTE', '13999', 9499004),
  ligne('PHARMACIE FRANCOYS', 'CHERVILLE', '18999', 9499005),
  ligne('PHARMACIE SAINT VIRGULE', 'YVELINETTE', '78999', 9499006),
  // dans ses départements
  ligne('PHARMACIE DU PORT', 'IXE', '14805', 9499007),                   // IXE : trois officines
  ligne('PHARMACIE ROMUALD', 'BEAUVAL EN VALLEE', '49998', 9499008),      // un prospect au nom de la ville d'une cliente
  ligne('PHARMACIE DU CENTRE', 'BELLEMONT SUR LOIRETTE', '49997', 9499009),  // deux BELLEMONT dans le 49
  ...Array.from({ length: 6 }, (_, i) => ligne('PHARMACIE NUMERO ' + (i + 1), 'GRANDEVILLE', '49810', 9499100 + i)),  // grande ville
] };

function charger() {
  const ctx = { console, Date, Math, JSON, String, Number, Array, Object, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.V2 = { user: { id: 'u', commercial: 'AAA' }, pharmacies: FICHIER };
  ctx.PHARMA_FR = ANNUAIRE;
  vm.createContext(ctx);
  vm.runInContext(lire('v2-rdv-reco.js'), ctx);
  vm.runInContext(lire('v2-rdv-planning.js'), ctx);
  const idx = ctx.V2.planningIndex();
  const f = (titre) => ctx.V2RECO.apparier(titre, idx.porte, idx.nat, {}, idx.villes);
  f.rappel = (titre) => ctx.V2RECO.rappel(titre);
  return f;
}
const id = (m) => (m && m.officine ? String(m.officine.id) : null);

test('l’enseigne courte de sa cliente, quand sa ville contient ce nom (« du lac » à …-sur-Lac)', () => {
  const m = charger()('Phie du lac');
  assert.equal(id(m), '9400001', 'sa cliente, pas la PHARMACIE DU LAC de la commune de Lac');
  assert.equal(m.etat, 'reconnu');
});

test('l’enseigne courte en tête d’un titre plus long : sa cliente, à confirmer', () => {
  const m = charger()('Phie du lac grand gouter equipe');
  assert.equal(id(m), '9400001', 'pas la PHARMACIE DU GRAND LAC du Morbihan');
  assert.equal(m.etat, 'confirmer');
});

test('le nom exact aux mots vides près passe avant un nom plus long ailleurs en France', () => {
  const m = charger()('Pharmacie des orties');
  assert.equal(id(m), '9400002');
  assert.equal(m.etat, 'reconnu');
});

test('« de lorme » vaut « de l’orme »', () => {
  const m = charger()('Pharmacie du quai de lorme');
  assert.equal(id(m), '9400003', 'pas la PHARMACIE DU QUAI de Marseille');
  assert.equal(m.etat, 'reconnu');
});

test('une faute d’une lettre dans SON portefeuille : sa cliente, jamais certaine', () => {
  const f = charger();
  const m = f('Passer voir phie Francoys Ier');
  assert.equal(id(m), '9400004', 'pas la PHARMACIE FRANCOYS du Cher');
  assert.equal(m.etat, 'confirmer');
  assert.equal(id(f('Pharmacie brousaille')), '9400011');
});

test('la ville seule où il n’a qu’une cliente', () => {
  const f = charger();
  const a = f('Phie Saint virgule');
  assert.equal(id(a), '9400006', 'sa cliente de Saint-Virgule-le-Grand, pas la PHARMACIE SAINT VIRGULE des Yvelines');
  assert.equal(a.etat, 'reconnu', 'seule officine de la ville dans l’annuaire');
  const b = f('Pharmacie bourgtest sur lac');
  assert.equal(id(b), '9400001');
});

test('la ville seule, mais d’autres officines y existent : à confirmer', () => {
  const m = charger()('Pharmacie ixe');
  assert.equal(id(m), '9400005');
  assert.equal(m.etat, 'confirmer');
});

test('la ville seule ne joue pas quand le titre désigne autre chose', () => {
  const f = charger();
  assert.notEqual(id(f('Phie Romuald (49998)')), '9400008', '« Romuald » sans SAINT, et le code postal d’ailleurs');
  assert.equal(id(f('Phie Romuald (49998)')), '9499008', 'le prospect du secteur garde la main');
  assert.equal(id(f('Phie de Bellemont')), null, 'deux villes BELLEMONT dans ses départements');
  assert.equal(id(f('Phie du port ixe')), '9499007', 'un autre mot nomme une autre officine de la ville');
  assert.equal(id(f('Allez voir phie dubois grandeville')), null, 'un mot inconnu dans une grande ville');
});

test('sans le mot pharmacie : le nom entier (deux mots au moins) d’une de ses enseignes, à confirmer', () => {
  const f = charger();
  const m = f('Val de Loirette colis');
  assert.equal(id(m), '9400007');
  assert.equal(m.etat, 'confirmer');
  assert.equal(id(f('Bourgtest sur lac')), null, 'une ville sans le mot pharmacie ne dit rien');
});

test('un produit à préparer ou une prise de rendez-vous n’est pas une visite', () => {
  const f = charger();
  assert.equal(f.rappel('Phie essaitrois 3 repatha a preparer'), 'tache');
  assert.equal(f.rappel('Phie des saules erleada'), 'tache');
  assert.equal(f.rappel('Phie des saules prisr rdv'), 'tache');
  assert.equal(f.rappel('Prise de rdv phie des saules'), 'tache');
  assert.equal(f.rappel('Allez voir phie des saules'), '', 'une visite reste une visite');
  assert.equal(f.rappel('Prise de sang'), '');
});
