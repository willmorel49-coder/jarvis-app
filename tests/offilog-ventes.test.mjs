/* offilog-ventes.test.mjs — ventes Offilog par pharmacie : texte de la fiche, classement, prime, pharmacies à relancer.
 * Données INVENTÉES (pharmacies « P1 »…, seuil 100 et 7 par client fictifs) : la vraie règle de la prime vit hors du
 * dépôt, dans `pr`. Chaque attente est calculée à la main dans le commentaire du cas. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const O = createRequire(import.meta.url)('../crm/v2/v2-offilog-ventes.js');
const N = ' ';

const OFFICINES = [
  { id: '1', name: 'P1', ville: 'Lille', comms: ['Anne'] }, { id: '2', name: 'P2', ville: 'Nice', comms: ['Béa'] },
  { id: '3', name: 'P3', ville: 'Pau', comms: ['Anne', 'Béa'] }, { id: '4', name: 'P4', ville: 'Metz', comms: ['Anne'] },
  { id: '5', name: 'P5', ville: 'Albi', comms: ['Béa'] }, { id: '9', name: 'P9', ville: 'Sète', comms: [] },
];
const OFF = {
  d: ['2026-10-02'], vm: ['2026-09', '2026-10'],
  m: { 1: [1, 0], 2: [1, 0], 3: [1, 0], 4: [1, 0], 5: [0, 0], 9: [1, 0] },
  // sept : P1 150, P2 90, P3 300, P6 (hors annuaire) 400, P7 120, P8 -50 ; oct : P1 3121.4, P2 100, P3 0, P6 0
  v: { 1: [150, 3121.4], 2: [90, 100], 3: [300, 0], 6: [400, 0], 7: [120, 0], 8: [-50, 0] },
  va: { 1: 'Anne', 2: 'Béa', 3: 'Anne', 6: 'GREG HORS', 7: '', 8: 'Anne' },
  vn: { 6: 'PHARMACIE SIX' }, pr: { s: 100, p: 7, de: '2026-09', a: '2027-06' },
};
const TOUS = { commFilter: '', restreint: false, mes: [] };
const ANNE = { commFilter: '', restreint: true, mes: ['Anne'] };

test('fiche : un montant par mois du fichier, un mois sans achat = 0 €', () => {
  assert.equal(O.texteFiche('1', OFF), `150${N}€ en sept. · 3${N}121${N}€ en oct.`);   // 3121,4 arrondi à 3 121
  assert.equal(O.texteFiche('3', OFF), `300${N}€ en sept. · 0${N}€ en oct.`);
  assert.equal(O.texteFiche('8', OFF), `−${50}${N}€ en sept. · 0${N}€ en oct.`);   // avoirs > factures : signe moins
});
test('fiche : notée cliente sans achat, et sinon rien (le texte d\'avant reprend)', () => {
  assert.equal(O.texteFiche('4', OFF), 'Aucun achat en sept.–oct. 2026 · notée cliente au 02/10/2026');
  assert.equal(O.texteFiche('5', OFF), '');          // m = 0 : non cliente, aucune vente
  assert.equal(O.texteFiche('404', OFF), '');        // inconnue
  assert.equal(O.texteFiche('4', { d: OFF.d, m: OFF.m }), '');   // table d'avant (pas de vm) : inchangé
  assert.equal(O.texteFiche('4', { ...OFF, vm: ['2026-09', '2027-01'] }), 'Aucun achat en sept. 2026–janv. 2027 · notée cliente au 02/10/2026');
});

test('classement : par commercial, JARVIS d\'abord, hors JARVIS et sans commercial à part', () => {
  const c = O.classement(OFF, OFFICINES, TOUS, '2026-09');
  // sept : Anne = 150 + 300 - 50 = 400 (2 pharmacies > 0 : P1, P3) ; Béa = 90 (1) ; hors = 400 (1) ; sans = 120 (1)
  assert.deepEqual(c.map(g => [g.va, g.genre, g.ca, g.nb]), [['Anne', 'jarvis', 400, 2], ['Béa', 'jarvis', 90, 1], ['GREG HORS', 'hors', 400, 1], ['', 'sans', 120, 1]]);
  assert.deepEqual(c[0].lignes.map(l => l.id), ['3', '1', '8']);                  // du plus gros au plus petit
  assert.equal(c[2].lignes[0].nom, 'PHARMACIE SIX');                              // absente de l'annuaire : nom du fichier
});
test('classement : le mois choisi compte, un autre mois ne se mélange pas', () => {
  const c = O.classement(OFF, OFFICINES, TOUS, '2026-10');
  assert.deepEqual(c.map(g => [g.va, g.ca]), [['Anne', 3121.4], ['Béa', 100]]);
});

test('commercial restreint : seulement lui, jamais une ligne d\'un autre', () => {
  const c = O.classement(OFF, OFFICINES, ANNE, '2026-09');
  assert.deepEqual(c.map(g => g.va), ['Anne']);
  assert.equal(c.some(g => g.lignes.some(l => l.va !== 'Anne')), false);
  const avecCollegue = O.classement(OFF, OFFICINES, { ...ANNE, mes: ['Anne', 'Béa'] }, '2026-09');
  assert.deepEqual(avecCollegue.map(g => g.va), ['Anne', 'Béa']);
  const choisi = O.classement(OFF, OFFICINES, { commFilter: 'Béa', restreint: true, mes: ['Anne', 'Béa'] }, '2026-09');
  assert.deepEqual(choisi.map(g => g.va), ['Béa']);
});

test('prime : nb de clients au seuil x montant, hors période = aucune, hors JARVIS / sans commercial jamais payés', () => {
  // sept, seuil 100 : Anne P1 150 et P3 300 (P8 -50 non) = 2 -> 14 ; Béa P2 90 non = 0 ; hors : P6 400 ; sans : P7 120
  const p = O.prime(OFF, OFFICINES, TOUS, '2026-09');
  assert.equal(p.actif, true); assert.equal(p.total, 14); assert.equal(p.nbPaye, 2);
  assert.deepEqual(p.groupes.map(g => [g.va, g.nb, g.prime]), [['Anne', 2, 14], ['Béa', 0, 0], ['GREG HORS', 1, 0], ['', 1, 0]]);
  // oct : Anne P1 3121,4 = 1 -> 7 ; Béa P2 100 (seuil atteint, >=) = 1 -> 7
  const o = O.prime(OFF, OFFICINES, TOUS, '2026-10');
  assert.equal(o.total, 14); assert.deepEqual(o.groupes.map(g => [g.va, g.nb]), [['Anne', 1], ['Béa', 1]]);
  assert.deepEqual(O.prime({ ...OFF, pr: { ...OFF.pr, de: '2026-10' } }, OFFICINES, TOUS, '2026-09'), { actif: false, raison: 'periode', de: '2026-10', a: '2027-06' });
  assert.deepEqual(O.prime({ ...OFF, pr: undefined }, OFFICINES, TOUS, '2026-09'), { actif: false, raison: 'reglage' });
  const mienne = O.prime(OFF, OFFICINES, ANNE, '2026-09');
  assert.equal(mienne.total, 14); assert.deepEqual(mienne.groupes.map(g => g.va), ['Anne']);
});

test('à relancer : notées clientes sans aucune vente, par commercial de l\'officine', () => {
  // m = 1 sans ligne de vente : P4 (Anne) ; P9 (aucun commercial). P2 et P3 ont des ventes ; P5 est « N ».
  const r = O.aRelancer(OFF, OFFICINES, TOUS);
  assert.equal(r.total, 2);
  assert.deepEqual(r.groupes.map(g => [g.comm, g.lignes.map(l => l.id)]), [['Anne', ['4']], ['', ['9']]]);
  const a = O.aRelancer(OFF, OFFICINES, ANNE);
  assert.equal(a.total, 1); assert.deepEqual(a.groupes.map(g => g.comm), ['Anne']);   // pas P9 : sans commercial = accès total seul
});

test('écran : le bloc ne montre ni prénom d\'un autre ni nom hors JARVIS à un restreint', () => {
  globalThis.WML_OFF_CA = { off: OFF }; globalThis.WML_OFFICINES = OFFICINES; O._reset();
  O.choisirMois('2026-09');
  const h = O.bloc(ANNE);
  assert.match(h, /id="ofv-host"/); assert.match(h, /Anne/); assert.match(h, /Prime Offilog/);
  assert.equal(/Béa|GREG|Greg|Sans commercial|PHARMACIE SIX/.test(h), false, h);
  const t = O.bloc(TOUS);
  assert.match(t, /Greg Hors/); assert.match(t, /Sans commercial/); assert.match(t, /Comptés à part/);
  globalThis.WML_OFF_CA = { off: { d: [], m: {} } };
  assert.equal(O.bloc(TOUS), '');                         // table sans ventes : aucun bloc
  delete globalThis.WML_OFF_CA; delete globalThis.WML_OFFICINES;
});
