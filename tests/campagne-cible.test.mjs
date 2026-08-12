import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-campagne-cible.js');

// PHARMA_FR : [lat, lng, uga, grp, seg, comm, nom, ville, cp, tel, titulaire, email, ca, id]
const L = (grp, seg, comm, nom, ville, cp, email, id) =>
  [0, 0, 0, grp, seg, comm, nom, ville, cp, '', '', email, 0, id];

const NAT = {
  grp: ['—', 'Giphar', 'Wellpharma'],
  seg: ['Non défini', 'Client', 'Prospect'],
  comm: ['', 'WILLIAM MOREL', 'KARINE V'],
  p: [
    L(1, 1, 1, 'PHARMACIE DU PORT', 'NANTES', '44000', 'port@ex.fr', '111'),
    L(2, 2, 1, 'PHARMACIE DES HALLES', 'ANGERS', '49000', 'halles@ex.fr', '222'),
    L(0, 2, 1, 'PHARMACIE SANS GROUPE', 'RENNES', '35000', 'sansgrp@ex.fr', '333'),
    L(1, 2, 2, 'PHARMACIE DE KARINE', 'BREST', '29200', 'karine@ex.fr', '444'),
    L(2, 2, 1, 'PHARMACIE SANS MAIL', 'VANNES', '56000', '', '555'),
  ],
};

// Le client 111 vient des ventes réseau : c'est LUI qui fait foi sur le statut.
const PHARMA = [{ id: '111', name: 'PHARMACIE DU PORT', cp: '44000', ville: 'NANTES' }];

const recenser = (o = {}) =>
  M.recenser({ pharmacies: PHARMA, national: NAT, commercial: 'WILLIAM MOREL', ...o });

test('réunit clients et prospects sans jamais compter une officine deux fois', () => {
  const l = recenser();
  assert.equal(l.filter(o => o.cip === '111').length, 1);
  const c = M.compter(l);
  assert.equal(c.clients, 1, 'un seul client');
  assert.equal(c.prospects, 3, '222, 333, 555 — pas 444 qui est à Karine');
});

test('un client reste client même si la base nationale le dit prospect', () => {
  // 111 est marqué « Client » ici, mais le test qui compte est l'inverse :
  // on ajoute un client WML que le national croit prospect.
  const l = M.recenser({
    pharmacies: [{ id: '222', name: 'PHARMACIE DES HALLES', cp: '49000', ville: 'ANGERS' }],
    national: NAT, commercial: 'WILLIAM MOREL',
  });
  const o = l.find(x => x.cip === '222');
  assert.equal(o.type, 'client', 'les ventes réseau font foi, pas le segment national');
  assert.equal(l.filter(x => x.cip === '222').length, 1, 'pas de doublon');
});

test('le groupement d’un client est récupéré dans la base nationale', () => {
  const o = recenser().find(x => x.cip === '111');
  assert.equal(o.groupement, 'Giphar');
});

test('les prospects d’un autre commercial ne remontent pas', () => {
  assert.equal(recenser().find(o => o.cip === '444'), undefined);
});

// ⚠️ Comportement du MOTEUR, pas de l'écran. L'écran Campagne, lui, refuse de
// recenser sans commercial choisi — montrer les officines de toute l'équipe a
// été signalé comme un défaut par Will le 12/08/2026. Le cadrage est la
// responsabilité de l'appelant.
test('sans nom de commercial, le moteur ne filtre pas (c’est à l’appelant de cadrer)', () => {
  const l = M.recenser({ pharmacies: PHARMA, national: NAT, commercial: '' });
  assert.ok(l.find(o => o.cip === '444'), 'la pharmacie de Karine est là');
});

test('filtre : clients seuls, prospects seuls', () => {
  const l = recenser();
  assert.deepEqual(M.filtrer(l, { type: 'clients' }).map(o => o.cip), ['111']);
  assert.deepEqual(M.filtrer(l, { type: 'prospects' }).map(o => o.cip).sort(), ['222', '333']);
});

test('filtre : sans adresse mail, une officine est écartée par défaut', () => {
  const l = recenser();
  assert.equal(M.filtrer(l, {}).find(o => o.cip === '555'), undefined);
  assert.ok(M.filtrer(l, { avecEmail: false }).find(o => o.cip === '555'));
});

test('filtre : par groupement, accents et casse ignorés', () => {
  const l = recenser();
  assert.deepEqual(M.filtrer(l, { groupements: ['GIPHAR'] }).map(o => o.cip), ['111']);
  assert.deepEqual(M.filtrer(l, { groupements: ['Wellpharma'] }).map(o => o.cip), ['222']);
});

test('filtre : « — » désigne les officines sans groupement', () => {
  assert.deepEqual(M.filtrer(recenser(), { groupements: ['—'] }).map(o => o.cip), ['333']);
});

test('filtre : département, recherche libre, et liste d’opposition', () => {
  const l = recenser();
  assert.deepEqual(M.filtrer(l, { dept: '49' }).map(o => o.cip), ['222']);
  assert.deepEqual(M.filtrer(l, { recherche: 'nantes' }).map(o => o.cip), ['111']);
  assert.equal(M.filtrer(l, { opposes: ['111'] }).find(o => o.cip === '111'), undefined);
});

test('les groupements sont classés du plus gros au plus petit, « sans groupement » en dernier', () => {
  const g = M.groupements(recenser());
  assert.equal(g[g.length - 1].nom, '—');
  assert.ok(g.every((x, i) => i === 0 || x.nom === '—' || g[i - 1].n >= x.n));
});

test('aucune source : ne plante pas, renvoie une liste vide', () => {
  assert.deepEqual(M.recenser({}), []);
  assert.deepEqual(M.recenser(), []);
  assert.deepEqual(M.filtrer(null, {}), []);
  assert.deepEqual(M.compter(null), { total: 0, clients: 0, prospects: 0, avecEmail: 0 });
});

test('la base nationale seule suffit (commercial sans aucun client)', () => {
  const l = M.recenser({ pharmacies: [], national: NAT, commercial: 'KARINE V' });
  assert.deepEqual(l.map(o => o.cip), ['444']);
  assert.equal(l[0].type, 'prospect');
});
