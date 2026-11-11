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

// ── Tableau de bord d'une tournée (11/11/2026) : fichier version 2, données FICTIVES ──
const NBSP = '\u00A0';
// 3 mois ; coût d'une livraison 10 ; m = [CA, Notre marge, commandes] par mois (null = aucune ligne)
const D2 = { mois: ['2030-01', '2030-02', '2030-03'], cout_livraison: 10, couv: { '2030-03': [3, 4] } };
const ar = (n, m, f, g) => ({ n, id: 'k' + n, nom: 'CLIENTE ' + n, ville: 'VILLE', lat: 47, lng: -1, com: 'X', r: m ? { rm: 0 } : null, m, f, g });
const T2 = { code: 'TY', nom: 'Ville C', arrets: [
  ar(1, [[1000, 100, 2], [2000, 150, 3], null], [50, 0, 0, 200, 0, 0, 0], 120),   // 5 commandes sur 2 mois livrés, marge 250 : rentabilité 200, 100 par mois
  ar(2, [[500, 20, 4], [500, 10, 4], [400, 30, 2]], [60, 0, 0, 0, 0, 0, 0], 0),     // 10 commandes sur 3 mois, marge 60 : rentabilité −40, −13,33 par mois
  ar(3, null, null, null),                                                         // sans commande sur la période
  ar(4, [[300, 40, 0], [0, 0, 0], null], [40, 0, 0, 0, 0, 0, 0], 0)                // des lignes mais AUCUNE commande : comptée comme sans commande
] };

test('tableau de bord : totaux d’une cliente comme la fiche (par mois = sur les mois livrés)', () => {
  const t = C.totCliente([[1000, 100, 2], [2000, 150, 3], null], 10);
  assert.deepEqual([t.ca, t.marge, t.cmd, t.mois_livres, t.cmd_mois, t.marge_cmd, t.cout, t.renta, t.renta_mois, t.ca_mois, t.marge_mois, t.taux],
    [3000, 250, 5, 2, 2.5, 50, 50, 200, 100, 1500, 125, 8.33]);
  assert.equal(C.totCliente([[300, 40, 0], null], 10), null);
  assert.equal(C.totCliente(null, 10), null);
});

test('tableau de bord : tournée = somme des clientes avec commandes, série des mois, médianes, familles', () => {
  const tb = C.tableau(T2, D2);
  assert.equal(tb.clientes.length, 4);
  assert.deepEqual(tb.clientes.map(c => !!c.tot), [true, true, false, false]);
  assert.deepEqual(tb.serie, [[1500, 120, 6, 60, 2], [2500, 160, 7, 90, 2], [400, 30, 2, 10, 1]]);
  const x = tb.tot;
  assert.deepEqual([x.ca, x.marge, x.cmd, x.cout, x.renta, x.renta_mois, x.nb_ventes, x.nb_sans, x.nb_perte, x.marge_cmd, x.gen], [4400, 310, 15, 150, 160, 86.67, 2, 2, 1, 20.67, 120]);
  assert.equal(x.cmd_mois, 5.8);   // 2,5 + 3,3
  assert.deepEqual(x.fam, { p: 110, p1: 0, p2: 0, i: 200, c: 0, fr: 0, nr: 0 });
  assert.deepEqual(tb.med, { cmd_mois: 2.9, marge_cmd: 28, renta_mois: 43.34 });   // marge par commande {50, 6} ; rentabilité {100, −13,33}
});

test('tableau de bord : fichier sans les mois (version 1) -> null, jamais des zéros', () => {
  assert.equal(C.tableau(T2, { cout_livraison: 10 }), null);
  assert.equal(C.tableau(T2, { mois: [], cout_livraison: 10 }), null);
  assert.equal(C.tableau(null, D2), null);
  const t = C.tableau({ code: 'TZ', arrets: [ar(1, [[1, 1, 1]], null, 0)] }, D2);   // mois de la mauvaise longueur : cliente sans détail
  assert.equal(t.tot.nb_ventes, 0);
});

test('« commandent souvent pour peu de marge » : plus de commandes ET moins de marge par commande que la médiane', () => {
  const tb = C.tableau(T2, D2);
  assert.deepEqual(C.souventPeu(tb).map(c => c.n), [2]);
});

test('familles : non nulles, de la plus forte à la plus faible, part sur le total', () => {
  const L = C.familles({ p: 110, p1: 0, p2: 0, i: 200, c: 0.004, fr: -10, nr: 0 });
  assert.deepEqual(L.map(f => [f.k, f.part]), [['i', 62.5], ['p', 34.38], ['fr', 3.12]]);   // 3,125 exact : centime pair, comme Python
  assert.equal(L[0].l, 'De 4,33 à 468 €');
});

test('liste des clientes : tri par colonne, sans commande en bas, ordre de livraison', () => {
  const tb = C.tableau(T2, D2);
  assert.deepEqual(C.trier(tb.clientes, 'renta_mois', -1).map(c => c.n), [1, 2, 3, 4]);
  assert.deepEqual(C.trier(tb.clientes, 'renta_mois', 1).map(c => c.n), [2, 1, 3, 4]);
  assert.deepEqual(C.trier(tb.clientes, 'n', -1).map(c => c.n), [4, 3, 2, 1]);
});

test('mois incomplets : texte du Pilotage, lu dans le fichier', () => {
  assert.equal(C.texteMoisIncomplets(D2.mois, D2.couv), 'Mars 2030 incomplet : 3 secteurs sur 4 ont transmis toutes leurs ventes. Chiffres partiels pour ce mois.');
  assert.equal(C.texteMoisIncomplets(D2.mois, { '2030-01': [1, 2], '2030-02': [5, 6] }), 'Mois incomplets : janvier 2030 (1 secteur sur 2), février 2030 (5 secteurs sur 6) ont transmis toutes leurs ventes. Chiffres partiels pour ces mois.');
  assert.equal(C.texteMoisIncomplets(D2.mois, {}), '');
});

test('arrondi au centime = round() de Python, y compris à mi-chemin exact (centime pair)', () => {
  assert.deepEqual([4321.625, 0.375, -4321.625, 1.005, 0.125, 10.5, 0].map(C.r2), [4321.62, 0.38, -4321.62, 1, 0.12, 10.5, 0]);
});

test('commandes par mois : au dixième, la moitié vers le haut', () => {
  assert.deepEqual([C.cmdMois(5, 2), C.cmdMois(10, 3), C.cmdMois(1, 4), C.cmdMois(3, 0)], [2.5, 3.3, 0.3, null]);
});

test('axes : pas ronds, jamais sous 1 pour des commandes, k€ avec décimale si besoin', () => {
  assert.deepEqual(C.pas(173000), { max: 200000, step: 50000 });
  assert.deepEqual(C.pas(9), { max: 10, step: 2.5 });
  assert.deepEqual(C.pas(2, true), { max: 2, step: 1 });
  assert.deepEqual(C.pas(0, true), { max: 4, step: 1 });
  assert.equal(C.kEur(2500, 10000), '2,5' + NBSP + 'k€');
  assert.equal(C.kEur(150000, 200000), '150' + NBSP + 'k€');
  assert.equal(C.kEur(50, 150), '50' + NBSP + '€');
});

test('montants comme la fiche : 1 000 € et plus en euros entiers, sinon au centime, inconnu = tiret', () => {
  assert.equal(C.eurF(2345678.91), '2' + NBSP + '345' + NBSP + '679' + NBSP + '€');
  assert.equal(C.eurF(512.34), '512,34' + NBSP + '€');
  assert.equal(C.eurF(-123.45), '−123,45' + NBSP + '€');
  assert.equal(C.eurF(0), '0' + NBSP + '€');
  assert.equal(C.eurF(null), '—');
  assert.equal(C.pct(4.17), '4,17' + NBSP + '%');
  assert.equal(C.dec1(12.3), '12,3');
  assert.equal(C.moisCourt('2030-08'), 'août');
  assert.equal(C.moisLong('2030-09'), 'septembre 2030');
});
