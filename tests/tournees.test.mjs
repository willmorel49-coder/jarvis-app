// Écran « Tournées » (10/11/2026) : calculs purs sur des données FICTIVES (aucune donnée réelle dans le dépôt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.V2 = {};
const C = require('../crm/v2/v2-tournees.js');

// Cliente : r = { rm: rentabilité/mois, m: marge, mo: mois, mj: marge/jour, jm: jours/mois, ca, re }
const cl = (n, rm, m, mo, mj, jm) => ({ n, id: 'c' + n, nom: 'CLIENTE ' + n, ville: 'VILLE', lat: 47, lng: -1, com: 'X', r: rm == null ? null : { rm, m, mo, mj, jm, ca: 1000, re: rm * mo } });
// médianes attendues (6 clientes avec ventes) : rm {-50,-5,10,20,30,40} -> 15 ; marge/mois {10,20,40,50,60,70} -> 45 ; jm {2,2,3,4,4,6} -> 3.5 ; mj {20,25,30,40,50,60} -> 35
const T = {
  code: 'TX', nom: 'Ville A – Ville B', jours: ['lundi', 'jeudi'], jours_statut: 'connus', transporteur: 'T', nb_arrets: 7, km_aller: 100.5, km_retour: 20, marge_jour: 33.79,
  arrets: [
    cl(1, -50, 100, 10, 30, 2),    // en perte
    cl(2, -5, 200, 10, 40, 2),     // en perte
    cl(3, 10, 400, 10, 20, 4),     // jm 4 > 3.5 et mj 20 < 35 : trop souvent ; marge/mois 40 < 45
    cl(4, 20, 500, 10, 25, 4),     // jm 4 > 3.5 et mj 25 < 35 : trop souvent
    cl(5, 30, 600, 10, 50, 3),     // marge/mois 60 : ni l'un ni l'autre
    cl(6, 40, 700, 10, 60, 6),     // jm 6 > 3.5 mais mj 60 > 35 : rien
    cl(7, null)                    // sans ventes
  ],
  trace: [[47, -1], [47.1, -1.1]],
  prospects: [
    ['p1', 47, -1, 3, 1, 2, 5.0, 1],
    ['p2', 47, -1, 4, 2, 3, 0.5, 0],   // position non fiable : après les fiables
    ['p3', 47, -1, 2, 0, 1, 1.5, 1],
    ['p4', 47, -1, 9, 3, null, 0, 1],
    ['p5', 47, -1, 1, 1, 2, 1.5, 1]
  ]
};

test('médiane : impair, pair, vide', () => {
  assert.equal(C.mediane([3, 1, 2]), 2); assert.equal(C.mediane([4, 1, 3, 2]), 2.5); assert.equal(C.mediane([]), null);
});

test('analyse : médianes, rentabilité de la tournée, clientes en perte', () => {
  const a = C.analyser(T);
  assert.deepEqual([a.med.renta, a.med.marge_mois, a.med.jours_mois, a.med.marge_jour], [15, 45, 3.5, 35]);
  assert.equal(a.rentabilite_mois, 45);                  // -50-5+10+20+30+40
  assert.equal(a.nb_perte, 2); assert.equal(a.nb_avec_ventes, 6);
  assert.equal(a.km_total, 120.5);
  assert.equal(a.marge_jour, 33.79);                     // valeur du fichier, pas recalculée
});

test('gain = médiane des rentabilités mensuelles − la sienne, retenu avec une raison ET un gain > 0, trié par gain', () => {
  const a = C.analyser(T);
  assert.deepEqual(a.grossir.map(g => g.n), [1, 2, 3]);
  assert.deepEqual(a.grossir.map(g => g.gain), [65, 20, 5]);
  assert.equal(a.potentiel, 90); assert.equal(a.nb_grossir, 3);
  // la 4 a une raison mais un gain nul (au-dessus de la médiane) ; la 5 n'a ni l'un ni l'autre ; la 7 n'a pas de ventes
  assert.ok(!a.grossir.some(g => g.n >= 4));
});

test('raisons : « En perte » prioritaire, puis commande trop souvent, puis marge sous la médiane', () => {
  const med = { jours_mois: 3, marge_jour: 30, marge_mois: 50 };
  assert.equal(C.raison(-1, 100, 9, 1, med), 'En perte');
  assert.equal(C.raison(5, 100, 4, 20, med), 'Commande trop souvent pour sa marge');
  assert.equal(C.raison(5, 40, 2, 99, med), 'Marge sous la médiane de sa tournée');
  assert.equal(C.raison(5, 60, 2, 99, med), null);
  assert.equal(C.raison(5, 40, 4, 99, med), 'Marge sous la médiane de sa tournée');   // jours > médiane mais marge/jour au-dessus
});

test('statut des arrêts (couleur de la carte) : perte, sous la médiane, bon, sans ventes', () => {
  const a = C.analyser(T);
  assert.deepEqual(a.arrets.map(x => x.statut), ['perte', 'perte', 'sous', 'bon', 'bon', 'bon', 'none']);
  assert.equal(a.arrets[6].renta_mois, null);
});

test('prospects : position fiable d\'abord, puis détour, puis km sur la route ; compte à 2 km = fiable ET détour <= 2', () => {
  const p = C.prospects(T.prospects);
  assert.deepEqual(p.map(x => x.cip), ['p4', 'p5', 'p3', 'p1', 'p2']);
  assert.equal(C.nb2km(p), 3);                           // p4 (0), p5 (1,5), p3 (1,5) ; p2 non fiable, p1 trop loin
  assert.equal(C.analyser(T).nb_prospects_2km, 3);
});

test('position d\'un prospect sur la route', () => {
  assert.match(C.position({ apres: 0, avant: 3 }), /entre le dépôt et l’arrêt n° 3/);
  assert.match(C.position({ apres: 4, avant: null }), /après l’arrêt n° 4, avant le retour au dépôt/);
  assert.match(C.position({ apres: 2, avant: 3 }), /entre l’arrêt n° 2 et n° 3/);
  assert.equal(C.position({ apres: 0, avant: null }), 'sur la route');
});

test('classement : tri par colonne dans les deux sens, égalités départagées par la rentabilité', () => {
  const A = { A: { rentabilite_mois: 10, nb_perte: 1 }, B: { rentabilite_mois: 30, nb_perte: 1 }, C: { rentabilite_mois: 20, nb_perte: 5 } };
  assert.deepEqual(C.classer(A, 'rentabilite_mois', -1), ['B', 'C', 'A']);
  assert.deepEqual(C.classer(A, 'rentabilite_mois', 1), ['A', 'C', 'B']);
  assert.deepEqual(C.classer(A, 'nb_perte', -1), ['C', 'B', 'A']);
});

test('bilan : somme des tournées', () => {
  const A = C.analyserTout({ tournees: { T1: T, T2: Object.assign({}, T, { code: 'T2' }) } });
  assert.deepEqual(C.bilan(A), { n: 2, rentabilite_mois: 90, potentiel: 180 });
});

test('établissements : seuls ceux que le fichier dit actifs ont des chiffres, les autres sont « à recevoir »', () => {
  const e = C.etablissements({ etablissements: [{ s: 'AA', nom: 'N1', ville: 'V', tournees: true }, { s: 'BB', nom: 'N2', ville: 'V', tournees: false }, { s: 'CC', nom: 'N3', ville: 'V' }] });
  assert.deepEqual(e.map(x => x.actif), [true, false, false]);
  assert.deepEqual(C.etablissements(null), []);
});

test('fichier absent ou illisible : un motif, jamais un faux zéro', () => {
  assert.equal(C.valider(undefined), 'fichier absent');
  assert.equal(C.valider(null), 'fichier absent');
  assert.equal(C.valider({}), 'aucune tournée dans le fichier');
  assert.equal(C.valider({ tournees: {} }), 'aucune tournée dans le fichier');
  assert.equal(C.valider({ tournees: { T1: { arrets: 'x' } }, etablissements: [] }), 'fichier illisible');
  assert.equal(C.valider({ tournees: { T1: T }, etablissements: [] }), '');
  assert.equal(C.valider({ tournees: { T1: T } }), 'liste des établissements absente');
});

test('tournée sans aucune cliente avec ventes : médianes nulles, 0 cliente à faire grossir, pas d\'erreur', () => {
  const a = C.analyser({ code: 'TZ', nom: 'Z', jours: [], arrets: [cl(1, null)], trace: [], prospects: [], km_aller: 0, km_retour: 0 });
  assert.equal(a.rentabilite_mois, 0); assert.equal(a.potentiel, 0); assert.deepEqual(a.grossir, []); assert.equal(a.nb_prospects_2km, 0);
  assert.equal(C.jours(a), '');                          // « jours à préciser » à l'écran
});

test('jours : trois lettres', () => assert.equal(C.jours({ jours: ['lundi', 'mercredi', 'vendredi'] }), 'lun mer ven'));

test('formats : milliers en espace insécable, moins typographique, signe plus pour un gain', () => {
  assert.equal(C.eur(1234567), '1 234 567 €');
  assert.equal(C.eur(-95.78, 0), '−96 €');
  assert.equal(C.eur(33.79, 2), '33,79 €');
  assert.equal(C.eurSigne(115.28), '+115 €');
  assert.equal(C.eur(null), '—');
  assert.equal(C.eur(-0.2), '0 €');                 // jamais « −0 € »
});

test('index PHARMA_FR : CIP en colonne 13, nom 6, ville 7', () => {
  const o = C.indexPF({ p: [[0, 0, 0, 0, 0, 0, 'PHARMACIE TEST', 'VILLE', '', '', '', '', '', 1234567]] });
  assert.deepEqual(o['1234567'], { nom: 'PHARMACIE TEST', ville: 'VILLE' });
  assert.deepEqual(C.indexPF(null), {});
});

test('joli : majuscules -> casse normale', () => assert.equal(C.joli('PHARMACIE DE LA GARE'), 'Pharmacie de la Gare'));
