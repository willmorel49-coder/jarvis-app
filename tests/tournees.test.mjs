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

// ══ Les 4 ajouts du tableau de bord (11/11/2026) : tendance, simulation, comparaison, export Excel — données FICTIVES, valeurs calculées à la main ══
const N = null;
const M6 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
const COUV6 = { '2026-05': [20, 26] };                  // mai 2026 incomplet : mis de côté dans la tendance
const F6 = C.fenetreTendance(M6, COUV6);                // recent = mars, avril, juin (indices 2, 3, 5) ; avant = janvier, février (0, 1)
const D6 = { mois: M6, cout_livraison: 8, couv: COUV6, periode: 'Période fictive' };   // coût du fichier : 8 (jamais 20)

test('fenêtre de tendance : mois incomplets exclus, 3 derniers mois complets contre les autres', () => {
  assert.deepEqual(F6, { recent: [2, 3, 5], avant: [0, 1], exclus: ['2026-05'] });
  assert.deepEqual(C.fenetreTendance(M6, {}), { recent: [3, 4, 5], avant: [0, 1, 2], exclus: [] });
  assert.deepEqual(C.fenetreTendance(M6, undefined), { recent: [3, 4, 5], avant: [0, 1, 2], exclus: [] });
  assert.deepEqual(C.fenetreTendance(M6, { '2026-04': [1, 2], '2026-05': [3, 4] }), { recent: [1, 2, 5], avant: [0], exclus: ['2026-04', '2026-05'] });
  assert.deepEqual(C.fenetreTendance(M6.slice(0, 4), {}), { recent: [1, 2, 3], avant: [0], exclus: [] });   // 4 mois complets : le minimum
});

test('fenêtre de tendance : moins de quatre mois complets -> null', () => {
  assert.equal(C.fenetreTendance(M6.slice(0, 3), {}), null);
  assert.equal(C.fenetreTendance(M6.slice(0, 4), { '2026-02': [1, 2] }), null);    // 4 mois dont 1 incomplet = 3 complets
  assert.equal(C.fenetreTendance(M6, { '2026-01': [1, 2], '2026-02': [1, 2], '2026-03': [1, 2] }), null);   // 3 complets sur 6
  assert.equal(C.fenetreTendance([], {}), null);
  assert.equal(C.fenetreTendance(null, null), null);
});

test('moisListe : « a », « a et b », « a, b et c »', () => {
  assert.equal(C.moisListe(M6, [0]), 'janvier');
  assert.equal(C.moisListe(M6, [0, 1]), 'janvier et février');
  assert.equal(C.moisListe(M6, [0, 1, 5]), 'janvier, février et juin');
  assert.equal(C.moisListe(M6, []), '');
});

test('texte de la fenêtre : mois exclu nommé, pluriel, et phrase quand la tendance n’est pas calculable', () => {
  assert.equal(C.texteFenetre(M6, F6),
    'Tendance = Notre marge par mois des 3 derniers mois complets (mars, avril et juin) contre les 2 mois complets d’avant (janvier et février), tous les mois comptés même sans commande ; hausse ou baisse à partir de 10' + NBSP + '%. Mai, incomplet, est laissé de côté.');
  const f2 = C.fenetreTendance(M6, { '2026-04': [1, 2], '2026-05': [3, 4] });   // recent février, mars, juin ; avant janvier
  assert.equal(C.texteFenetre(M6, f2),
    'Tendance = Notre marge par mois des 3 derniers mois complets (février, mars et juin) contre les 1 mois complets d’avant (janvier), tous les mois comptés même sans commande ; hausse ou baisse à partir de 10' + NBSP + '%. Avril et mai, incomplets, sont laissés de côté.');
  assert.ok(!/de côté/.test(C.texteFenetre(M6, C.fenetreTendance(M6, {}))));        // rien d'exclu : pas de phrase « laissé de côté »
  assert.equal(C.texteFenetre(M6, null), 'Tendance non calculée : il faut au moins quatre mois complets.');
});

test('tendance : seuil lu dans C.SEUIL_TENDANCE (10), hausse exacte à +10 %, mois incomplet ignoré', () => {
  assert.equal(C.SEUIL_TENDANCE, 10);
  // avant (janv., févr.) 100 par mois ; récent (mars, avr., juin) 110 par mois ; mai (incomplet) = valeurs énormes qui ne doivent rien changer
  const m = [[1000, 100, 2], [1000, 100, 2], [1000, 110, 2], [1000, 110, 2], [9999, 9999, 9], [1000, 110, 2]];
  const t = C.tendance(m, F6);
  assert.deepEqual([t.marge_avant, t.marge_recent, t.ecart, t.pct, t.sens, t.tri], [100, 110, 10, 10, 'hausse', 10]);
  assert.deepEqual([t.ca_avant, t.ca_recent, t.cmd_avant, t.cmd_recent], [1000, 1000, 2, 2]);
});

test('tendance : stable entre −10 % et +10 % (exclus), baisse exacte à −10 %', () => {
  const avec = r => C.tendance([[1000, 100, 2], [1000, 100, 2], [1000, r, 2], [1000, r, 2], N, [1000, r, 2]], F6);
  assert.deepEqual([avec(109).pct, avec(109).sens], [9, 'stable']);       // +9 %
  assert.deepEqual([avec(91).pct, avec(91).sens], [-9, 'stable']);        // −9 %
  assert.deepEqual([avec(90).pct, avec(90).sens, avec(90).tri], [-10, 'baisse', -10]);   // −10 % pile : baisse
  assert.deepEqual([avec(100).pct, avec(100).sens], [0, 'stable']);
  assert.equal(avec(50).pct, -50); assert.equal(avec(50).sens, 'baisse');
});

test('tendance : un mois sans commande compte quand même (moyenne sur tous les mois de la fenêtre)', () => {
  // récent : mars 150 (3 commandes), avril = aucune ligne, juin = ligne à zéro -> (150 + 0 + 0) / 3 = 50 ; avant 100 -> −50 %
  const t = C.tendance([[1000, 100, 2], [1000, 100, 2], [1500, 150, 3], N, N, [0, 0, 0]], F6);
  assert.deepEqual([t.marge_avant, t.marge_recent, t.ecart, t.pct, t.sens], [100, 50, -50, -50, 'baisse']);
  assert.deepEqual([t.ca_recent, t.cmd_avant, t.cmd_recent], [500, 2, 1]);   // 1500 / 3 ; 2 commandes par mois ; 3 / 3 = 1
});

test('tendance : cliente « nouvelle » (rien avant, des commandes récentes) et « aucune » (rien du tout)', () => {
  const n = C.tendance([N, N, [200, 20, 2], [200, 20, 2], N, [200, 20, 2]], F6);
  assert.deepEqual([n.sens, n.pct, n.tri, n.marge_avant, n.marge_recent, n.cmd_recent], ['nouvelle', null, 1e9, 0, 20, 2]);
  // des commandes seulement le mois incomplet : rien dans la fenêtre
  const a = C.tendance([N, N, N, N, [100, 10, 1], N], F6);
  assert.deepEqual([a.sens, a.pct, a.tri], ['aucune', null, 0]);
  // elle commandait avant, plus du tout depuis : baisse de −100 %, pas « aucune »
  const p = C.tendance([[400, 40, 2], [400, 40, 2], N, N, N, N], F6);
  assert.deepEqual([p.sens, p.pct, p.ecart], ['baisse', -100, -40]);
});

test('tendance : marge d’avant nulle ou négative -> pas de pourcentage, le sens se lit sur l’écart en euros', () => {
  const av = (a, r) => C.tendance([[100, a, 1], [100, a, 1], [100, r, 1], [100, r, 1], N, [100, r, 1]], F6);
  const h = av(-10, 20);
  assert.deepEqual([h.pct, h.sens, h.tri, h.ecart], [null, 'hausse', 1e6, 30]);
  const b = av(0, -6);
  assert.deepEqual([b.pct, b.sens, b.tri, b.ecart], [null, 'baisse', -1e6, -6]);
  const b2 = av(-10, -20);
  assert.deepEqual([b2.pct, b2.sens, b2.ecart], [null, 'baisse', -10]);
  const s = av(0, 0);
  assert.deepEqual([s.pct, s.sens, s.tri, s.ecart], [null, 'stable', 0, 0]);
});

test('tendance : sans mois ou sans fenêtre -> null', () => {
  assert.equal(C.tendance(null, F6), null);
  assert.equal(C.tendance([[1, 1, 1]], null), null);
});

test('texte d’une tendance : pourcentage signé, « Nouvelle », tiret, ou euros « par mois »', () => {
  assert.equal(C.texteTendance({ sens: 'hausse', pct: 12.4, ecart: 5 }), '+12' + NBSP + '%');
  assert.equal(C.texteTendance({ sens: 'baisse', pct: -50, ecart: -50 }), '−50' + NBSP + '%');
  assert.equal(C.texteTendance({ sens: 'stable', pct: 0, ecart: 0 }), '0' + NBSP + '%');
  assert.equal(C.texteTendance({ sens: 'nouvelle', pct: null }), 'Nouvelle');
  assert.equal(C.texteTendance({ sens: 'aucune', pct: null }), '—');
  assert.equal(C.texteTendance(null), '—');
  assert.equal(C.texteTendance({ sens: 'hausse', pct: null, ecart: 30 }), '+30' + NBSP + '€' + NBSP + 'par mois');
  assert.equal(C.texteTendance({ sens: 'baisse', pct: null, ecart: -6 }), '−6' + NBSP + '€' + NBSP + 'par mois');
  assert.equal(C.texteTendance({ sens: 'stable', pct: null, ecart: 0 }), '0' + NBSP + '€' + NBSP + 'par mois');
});

// 8 clientes fictives sur 6 mois (coût d'une livraison du fichier : 8). Tendance attendue (avant = janv.+févr., récent = mars+avr.+juin) :
//  1 hausse (100 -> 110 : +10 %) · 2 baisse (60 -> 30 : −50 %) · 3 nouvelle · 4 stable (50 -> 52 : +4 %) · 5 sans ligne · 6 ne commande plus (−100 %)
//  7 lignes sans aucune commande · 8 commandes seulement en mai (incomplet) : « aucune »
const T6 = { code: 'TZ6', nom: 'Ville Fictive', arrets: [
  ar(1, [[800, 100, 2], [800, 100, 2], [900, 110, 2], [900, 110, 2], [300, 40, 1], [900, 110, 2]], [10, 0, 0, 20, 0, 0, 0], 30),
  ar(2, [[500, 60, 3], [500, 60, 3], [400, 30, 2], [400, 30, 2], [100, 5, 1], [400, 30, 2]], [5, 0, 0, 0, 0, 0, 0], 0),
  ar(3, [N, N, [200, 20, 2], [200, 20, 2], N, [200, 20, 2]], [0, 0, 0, 0, 0, 0, 0], 0),
  ar(4, [[300, 50, 2], [300, 50, 2], [300, 52, 2], [300, 52, 2], [0, 0, 0], [300, 52, 2]], N, 0),
  ar(5, N, N, N),
  ar(6, [[400, 40, 2], [400, 40, 2], N, N, N, N], N, 0),
  ar(7, [[300, 40, 0], [0, 0, 0], N, N, N, N], N, 0),
  ar(8, [N, N, N, N, [100, 10, 1], N], N, 0)
] };

test('tableau : fenêtre de tendance et tendance de chaque cliente', () => {
  const tb = C.tableau(T6, D6);
  assert.deepEqual(tb.fen, { recent: [2, 3, 5], avant: [0, 1], exclus: ['2026-05'] });
  const s = tb.clientes.map(c => c.tend && c.tend.sens);
  assert.deepEqual(s, ['hausse', 'baisse', 'nouvelle', 'stable', null, 'baisse', null, 'aucune']);   // sans commande (5 et 7) : pas de tendance
  const c1 = tb.clientes[0].tend, c2 = tb.clientes[1].tend, c4 = tb.clientes[3].tend;
  assert.deepEqual([c1.marge_avant, c1.marge_recent, c1.ecart, c1.pct], [100, 110, 10, 10]);
  assert.deepEqual([c2.marge_avant, c2.marge_recent, c2.ecart, c2.pct, c2.cmd_avant, c2.cmd_recent, c2.ca_avant, c2.ca_recent], [60, 30, -30, -50, 3, 2, 500, 400]);
  assert.equal(c4.pct, 4);
  // trop peu de mois complets : fen = null, tendance = null pour toutes
  const court = C.tableau(T6, { mois: M6, cout_livraison: 8, couv: { '2026-01': [1, 2], '2026-02': [1, 2], '2026-03': [1, 2] } });
  assert.equal(court.fen, null);
  assert.ok(court.clientes.every(c => c.tend == null));
  assert.equal(C.tendanceTournee(court), null);
});

test('tri sur la tendance : nouvelle en haut, puis du + fort au − fort, clientes sans ventes en bas', () => {
  const cl6 = C.tableau(T6, D6).clientes;
  // tri : 3 = 1e9 · 1 = +10 · 4 = +4 · 8 = 0 · 2 = −50 · 6 = −100 · puis 5 et 7 (sans ventes) dans l'ordre de livraison
  assert.deepEqual(C.trier(cl6, 'tend', -1).map(c => c.n), [3, 1, 4, 8, 2, 6, 5, 7]);
  assert.deepEqual(C.trier(cl6, 'tend', 1).map(c => c.n), [6, 2, 8, 4, 1, 3, 5, 7]);
});

test('tendance de la tournée : somme des clientes (−15 %) et nombre de clientes par sens', () => {
  const t = C.tendanceTournee(C.tableau(T6, D6));
  // marge par mois de la tournée : janv. 250, févr. 250, mars 212, avr. 212, juin 212 (mai exclu) -> avant 250, récent 212, −15,2 %
  assert.deepEqual([t.marge_avant, t.marge_recent, t.ecart, t.pct, t.sens], [250, 212, -38, -15.2, 'baisse']);
  assert.deepEqual(t.nb, { hausse: 1, baisse: 2, stable: 1, nouvelle: 1, aucune: 1 });
});

// Simulation : trois clientes, coût du fichier 12. A = marge 160 / 10 commandes / 2 mois ; B = marge 400 / 10 commandes / 1 mois ; Cc = marge 30 / 5 commandes / 1 mois
const DS = { mois: M6, cout_livraison: 12, couv: COUV6 };
const TS = { code: 'TS', nom: 'S', arrets: [
  ar(1, [[1000, 80, 5], [1000, 80, 5], N, N, N, N], N, 0),
  ar(2, [[3000, 400, 10], N, N, N, N, N], N, 0),
  ar(3, [[500, 30, 5], N, N, N, N, N], N, 0)
] };
// au coût 12 : A 160 − 120 = 40 (20 par mois) ; B 400 − 120 = 280 ; Cc 30 − 60 = −30 (en perte) -> rentabilité 290, par mois 270, 1 en perte, 25 commandes, marge par commande 590 / 25 = 23,6

test('simulation : au coût du fichier et sans réduction, rien ne change', () => {
  const tb = C.tableau(TS, DS), s = C.simuler(tb, tb.cout, 0);
  assert.deepEqual([tb.tot.renta, tb.tot.renta_mois, tb.tot.nb_perte, tb.tot.cmd, tb.tot.marge_cmd], [290, 270, 1, 25, 23.6]);
  assert.equal(s.simule.renta_mois, s.actuel.renta_mois); assert.equal(s.simule.renta_mois, 270);
  assert.equal(s.simule.renta, 290); assert.equal(s.ecart_mois, 0);
  assert.equal(s.simule.nb_perte, s.actuel.nb_perte); assert.equal(s.simule.cmd, 25);
  assert.equal(s.seuil, 23.6);
  // même chose sur la tournée à 8 de coût : aucune cliente en perte, écart nul
  const tb6 = C.tableau(T6, D6), s6 = C.simuler(tb6, tb6.cout, 0);
  assert.deepEqual([s6.simule.renta_mois, s6.ecart_mois, s6.simule.nb_perte, s6.simule.renta], [tb6.tot.renta_mois, 0, tb6.tot.nb_perte, tb6.tot.renta]);
  assert.equal(C.simuler(tb6, undefined, 0), null);   // coût absent : refusé (Number(undefined) = NaN)
});

test('simulation chiffrée à la main : coût 20, moitié de livraisons en moins pour les clientes en perte', () => {
  const tb = C.tableau(TS, DS), s = C.simuler(tb, 20, 0.5);
  // au coût 20 : A 160 − 200 < 0 (en perte) -> 5 commandes : 160 − 100 = 60, par mois 30 ; B 400 − 200 = 200 (inchangée, 200 par mois) ;
  // Cc 30 − 100 < 0 (en perte) -> 2,5 commandes : 30 − 50 = −20 (reste en perte) ; total 240, par mois 210, écart 210 − 270 = −60
  assert.deepEqual([s.simule.renta, s.simule.renta_mois, s.ecart_mois], [240, 210, -60]);
  assert.deepEqual([s.visees, s.simule.nb_perte_cout, s.simule.nb_perte], [2, 2, 1]);
  assert.equal(s.simule.cmd, 18);                  // 5 + 10 + 2,5 = 17,5 -> 18
  assert.deepEqual([s.cout, s.reduc, s.seuil], [20, 0.5, 23.6]);
  assert.deepEqual(s.actuel, { cout: 12, renta: 290, renta_mois: 270, nb_perte: 1, cmd: 25 });
  // sans réduction à 20 : A 160 − 200 = −40 (−20 par mois), B 200, Cc −70 ; total 90... rentabilité −40 + 200 − 70 = 90, par mois −20 + 200 − 70 = 110
  const s0 = C.simuler(tb, 20, 0);
  assert.deepEqual([s0.simule.renta, s0.simule.renta_mois, s0.simule.nb_perte, s0.simule.cmd], [90, 110, 2, 25]);
});

test('simulation : un coût plus élevé met plus de clientes en perte (à 16, A est pile à zéro : pas en perte)', () => {
  const tb = C.tableau(TS, DS);
  assert.equal(C.simuler(tb, 12, 0).simule.nb_perte_cout, 1);      // seule Cc
  assert.equal(C.simuler(tb, 15, 0).simule.nb_perte_cout, 1);      // A : 160 − 150 = +10
  assert.equal(C.simuler(tb, 16, 0).simule.nb_perte_cout, 1);      // A : 160 − 160 = 0, pas négatif
  const s17 = C.simuler(tb, 17, 0);                                // A : 160 − 170 = −10 -> perte
  assert.equal(s17.simule.nb_perte_cout, 2); assert.equal(s17.simule.nb_perte, 2);
  // rentabilité à 17 : A −10, B 400 − 170 = 230, Cc 30 − 85 = −55 -> 165 ; par mois −5 + 230 − 55 = 170
  assert.deepEqual([s17.simule.renta, s17.simule.renta_mois], [165, 170]);
  assert.equal(C.simuler(tb, 0, 0).simule.nb_perte_cout, 0);       // livraison gratuite : personne en perte
});

test('simulation : réduction ou coût invalide -> null, tournée absente -> null', () => {
  const tb = C.tableau(TS, DS);
  assert.equal(C.simuler(tb, 12, 1), null);
  assert.equal(C.simuler(tb, 12, 1.5), null);
  assert.equal(C.simuler(tb, 12, -0.1), null);
  assert.equal(C.simuler(tb, -1, 0), null);
  assert.equal(C.simuler(tb, 'abc', 0), null);
  assert.equal(C.simuler(null, 12, 0), null);
  assert.notEqual(C.simuler(tb, 12, 0.99), null);                  // juste sous 1 : accepté
  assert.equal(C.simuler(tb, 12).reduc, 0);                        // réduction absente = 0
});

// Comparaison : TA (2 clientes, une en baisse, une en hausse), TB (1 cliente stable), TC (rentabilité plus haute) ; coût du fichier 12
const rr = rm => ({ rm, m: 100, mo: 1, mj: 100, jm: 1, ca: 1000, re: rm });   // mêmes valeurs partout : aucune raison de « faire grossir » -> potentiel 0
const arC = (n, m, rm) => Object.assign(ar(n, m, N, 0), { r: rr(rm) });
const TA = { code: 'TA', nom: 'A', nb_arrets: 2, km_aller: 50, km_retour: 10, jours: [], trace: [], arrets: [
  arC(1, [[1000, 80, 5], [1000, 80, 5], N, N, N, N], 20),
  arC(2, [[500, 50, 2], [500, 50, 2], [1000, 150, 3], [1000, 150, 3], N, [1000, 150, 3]], 78.8)
], prospects: [['x1', 47, -1, 3, 1, 2, 0.4, 1], ['x2', 47, -1, 4, 1, 2, 1.9, 1], ['x3', 47, -1, 5, 1, 2, 5, 1]] };
const TB = { code: 'TB', nom: 'B', nb_arrets: 1, km_aller: 30, km_retour: 10, jours: [], trace: [], prospects: [], arrets: [
  arC(1, [[600, 90, 3], [600, 90, 3], [600, 90, 3], [600, 90, 3], N, [600, 90, 3]], 54)
] };
const TC = { code: 'TC', nom: 'C', nb_arrets: 1, km_aller: 1, km_retour: 1, jours: [], trace: [], prospects: [], arrets: [arC(1, N, 500)] };
const DC = { mois: M6, cout_livraison: 12, couv: COUV6, tournees: { TA, TB, TC } };
const AC = C.analyserTout(DC);
const CLES18 = ['rang', 'renta_mois', 'renta', 'ca', 'marge', 'taux', 'cmd', 'cmd_mois', 'marge_cmd', 'cout', 'nb_ventes', 'nb_perte', 'baisse', 'hausse', 'nb_arrets', 'km_total', 'nb_prospects_2km', 'potentiel'];

test('comparer : 18 lignes, valeurs de chaque tournée et « mieux » (1 = A, 2 = B, 0 = égalité ou sans sens)', () => {
  const r = C.comparer(AC, DC, 'TA', 'TB');
  assert.deepEqual([r.a, r.b], ['TA', 'TB']);
  assert.equal(r.lignes.length, 18);
  assert.deepEqual(r.lignes.map(l => l.k), CLES18);
  const L = Object.fromEntries(r.lignes.map(l => [l.k, l]));
  // TA : CA 6 000, marge 160 + 550 = 710, 23 commandes, 5 + 2,6 = 7,6 par mois, coût 23 × 12 = 276, rentabilité 710 − 276 = 434, par mois 20 + 78,8 = 98,8, marge/commande 30,87, taux 11,83
  // TB : CA 3 000, marge 450, 15 commandes, 3 par mois, coût 180, rentabilité 270, par mois 54, marge/commande 30, taux 15
  // classement par rentabilité par mois : TC (500), TA (98,8), TB (54)
  const att = {
    rang: [2, 3, 1], renta_mois: [98.8, 54, 1], renta: [434, 270, 1], ca: [6000, 3000, 1], marge: [710, 450, 1], taux: [11.83, 15, 2],
    cmd: [23, 15, 0], cmd_mois: [7.6, 3, 0], marge_cmd: [30.87, 30, 1], cout: [276, 180, 2], nb_ventes: [2, 1, 0], nb_perte: [0, 0, 0],
    baisse: [1, 0, 2], hausse: [1, 0, 1], nb_arrets: [2, 1, 0], km_total: [60, 40, 0], nb_prospects_2km: [2, 0, 1], potentiel: [0, 0, 0]
  };
  CLES18.forEach(k => assert.deepEqual([L[k].a, L[k].b, L[k].mieux], att[k], k));
  assert.equal(L.rang.f, 'rang'); assert.equal(L.taux.f, 'pct'); assert.equal(L.km_total.f, 'km');
});

test('comparer : dans l’autre sens, « mieux » s’inverse ; deux fois la même tournée : égalité partout', () => {
  const r = C.comparer(AC, DC, 'TB', 'TA'), L = Object.fromEntries(r.lignes.map(l => [l.k, l.mieux]));
  assert.deepEqual([L.rang, L.renta_mois, L.taux, L.cout, L.baisse, L.hausse, L.nb_prospects_2km, L.cmd], [2, 2, 1, 1, 1, 2, 2, 0]);
  const m = C.comparer(AC, DC, 'TA', 'TA');
  assert.ok(m.lignes.every(l => l.mieux === 0));
  assert.deepEqual([m.lignes[0].a, m.lignes[0].b], [2, 2]);
});

test('comparer : code inconnu ou fichier sans les mois -> null', () => {
  assert.equal(C.comparer(AC, DC, 'TA', 'ZZ'), null);
  assert.equal(C.comparer(AC, DC, 'ZZ', 'TA'), null);
  assert.equal(C.comparer(null, DC, 'TA', 'TB'), null);
  assert.equal(C.comparer(AC, { tournees: DC.tournees }, 'TA', 'TB'), null);       // pas de mois : tableau impossible
});

// Export Excel
const PROS6 = C.prospects([['x1', 47, -1, 12.5, 2, 3, 0.4, 1], ['x2', 47, -1, 3, 0, 1, 3.2, 0]]);
const nomDe6 = cip => ({ nom: 'PHARMACIE FICTIVE ' + cip, ville: 'VILLE FICTIVE' });
const FEUILLES = () => C.feuillesExcel(C.tableau(T6, D6), { prospects: PROS6 }, D6, nomDe6, 'Établissement fictif', '2026-11-11');

test('Excel : cinq feuilles dans l’ordre, en-tête de Clientes sur 16 colonnes', () => {
  const F = FEUILLES();
  assert.deepEqual(F.map(f => f.nom), ['Clientes', 'Mois par mois', 'Clientes par mois', 'Prospects', 'À lire']);
  const e = F[0].lignes[0];
  assert.equal(e.length, 16);
  assert.deepEqual([e[0], e[1], e[4], e[11], e[13], e[14], e[15]], ['N° d’arrêt', 'Cliente', 'CA (€)', 'Rentabilité (€)', 'Notre marge par mois, mois d’avant (€)', 'Notre marge par mois, 3 derniers mois (€)', 'Tendance']);
  assert.equal(C.feuillesExcel(null, {}, D6, nomDe6), null);
  assert.equal(C.feuillesExcel(C.tableau(T6, D6), null, D6, nomDe6), null);
});

test('Excel : feuille Clientes — une ligne par cliente, « Aucune commande » sans commande, total de la tournée', () => {
  const L = FEUILLES()[0].lignes;
  assert.equal(L.length, 1 + 8 + 1);
  // cliente 1 : CA 4 600, marge 570, taux 12,39, 11 commandes, 1,8 par mois, 51,82 par commande, coût 88, rentabilité 482, par mois 80,33, avant 100, récent 110, +10 %
  assert.deepEqual(L[1], [1, 'Cliente 1', 'Ville', 'X', 4600, 570, 12.39, 11, 1.8, 51.82, 88, 482, 80.33, 100, 110, '+10 %']);
  // cliente 3 (nouvelle) : 600 / 60 / 10 % / 6 commandes / 2 par mois / 10 par commande / 48 / 12 / 4 ; avant 0, récent 20
  assert.deepEqual(L[3], [3, 'Cliente 3', 'Ville', 'X', 600, 60, 10, 6, 2, 10, 48, 12, 4, 0, 20, 'Nouvelle']);
  assert.deepEqual(L[5], [5, 'Cliente 5', 'Ville', 'X', 'Aucune commande sur la période']);
  assert.deepEqual(L[7], [7, 'Cliente 7', 'Ville', 'X', 'Aucune commande sur la période']);   // des lignes mais zéro commande
  assert.equal(L[8][15], '—');                                                                // cliente 8 : tendance « aucune »
  // total : CA 9 900, marge 1 191, taux 12,03, 45 commandes, 11 par mois (1,8 + 2,2 + 2 + 2 + 2 + 1), 26,47 par commande, coût 360, rentabilité 831, par mois 164,03, tendance −15 %
  assert.deepEqual(L[9], ['', 'Total de la tournée TZ6', '', '', 9900, 1191, 12.03, 45, 11, 26.47, 360, 831, 164.03, 250, 212, '−15 %']);
});

test('Excel : feuille Mois par mois — mois incomplet marqué, les autres « Complet », ligne Total', () => {
  const L = FEUILLES()[1].lignes;
  assert.equal(L.length, 1 + 6 + 1);
  assert.equal(L[0].length, 7);
  // janvier : CA 800 + 500 + 300 + 400 = 2 000, marge 250, 2 + 3 + 2 + 2 = 9 commandes, rentabilité 250 − 72 = 178, 4 clientes livrées
  assert.deepEqual(L[1], ['Janvier 2026', 2000, 250, 9, 178, 4, 'Complet']);
  // mai : CA 300 + 100 + 100 = 500, marge 40 + 5 + 10 = 55, 3 commandes, 55 − 24 = 31, 3 livrées (la 4 a des lignes à zéro)
  assert.deepEqual(L[5], ['Mai 2026', 500, 55, 3, 31, 3, 'Incomplet : 20 secteurs sur 26 ont transmis toutes leurs ventes']);
  assert.deepEqual([1, 2, 3, 4, 6].map(i => L[i][6]), ['Complet', 'Complet', 'Complet', 'Complet', 'Complet']);
  assert.deepEqual(L[7], ['Total', 9900, 1191, 45, 831, 6, '']);
});

test('Excel : feuille Clientes par mois — une ligne par mois renseigné, mois incomplet marqué', () => {
  const L = FEUILLES()[2].lignes;
  assert.equal(L[0].length, 8);
  assert.equal(L.length, 1 + 24);                  // 6 + 6 + 3 + 6 + 2 + 1 mois renseignés (la 4 a une ligne à zéro en mai ; la 5 et la 7 : aucune ligne)
  assert.deepEqual(L[L.length - 1], [8, 'Cliente 8', 'Mai 2026', 100, 10, 1, 2, 'Incomplet']);   // 10 − 1 × 8 = 2
  assert.deepEqual(L[1], [1, 'Cliente 1', 'Janvier 2026', 800, 100, 2, 84, 'Complet']);         // 100 − 2 × 8
  assert.ok(!L.some(r => r[0] === 5 || r[0] === 7));
});

test('Excel : feuille Prospects — nom rendu par nomDe, position, fiabilité ; sans nomDe : cellules vides', () => {
  const L = FEUILLES()[3].lignes;
  assert.equal(L.length, 3); assert.equal(L[0].length, 7);
  assert.deepEqual(L[1], [1, 'PHARMACIE FICTIVE x1', 'VILLE FICTIVE', 'entre l’arrêt n° 2 et n° 3', 0.4, 12.5, 'Fiable']);
  assert.deepEqual(L[2], [2, 'PHARMACIE FICTIVE x2', 'VILLE FICTIVE', 'entre le dépôt et l’arrêt n° 1', 3.2, 3, 'À vérifier']);
  const sans = C.feuillesExcel(C.tableau(T6, D6), { prospects: PROS6 }, D6, null, '', '')[3].lignes;
  assert.deepEqual([sans[1][1], sans[1][2]], ['', '']);
});

test('Excel : feuille À lire — tournée, coût du fichier, règle de tendance, mois incomplets, génériques', () => {
  const L = FEUILLES()[4].lignes, tab = new Map(L.filter(r => r.length === 2).map(r => [r[0], r[1]]));
  assert.equal(tab.get('Tournée'), 'TZ6 · Ville Fictive');
  assert.equal(tab.get('Établissement'), 'Établissement fictif');
  assert.equal(tab.get('Période'), 'Période fictive');
  assert.equal(tab.get('Coût d’une livraison (€)'), 8);                // lu dans le fichier
  assert.equal(tab.get('Extrait le'), '2026-11-11');
  assert.equal(tab.get('Tendance'), C.texteFenetre(M6, F6).replace(/ /g, ' '));
  assert.match(tab.get('Tendance'), /mars, avril et juin/);
  assert.equal(tab.get('Mois incomplets'), 'Mai 2026 incomplet : 20 secteurs sur 26 ont transmis toutes leurs ventes. Chiffres partiels pour ce mois.');
  assert.match(tab.get('Notre marge'), /Génériques comptés à zéro/);   // des génériques dans la tournée (30)
  // sans génériques ni mois incomplet : ces deux lignes disparaissent
  const T0 = { code: 'T0', nom: 'Z', arrets: [ar(1, [[100, 10, 1], [100, 10, 1], [100, 10, 1], [100, 10, 1], [100, 10, 1], [100, 10, 1]], N, 0)] };
  const D0 = { mois: M6, cout_livraison: 8 };
  const L0 = C.feuillesExcel(C.tableau(T0, D0), { prospects: [] }, D0, nomDe6)[4].lignes;
  assert.ok(!L0.some(r => r[0] === 'Notre marge' || r[0] === 'Mois incomplets'));
});

test('Excel : aucune cellule NaN, undefined ou « NaN » en texte ; largeurs = nombre de colonnes de l’en-tête', () => {
  const F = FEUILLES();
  F.forEach(f => {
    assert.equal(f.largeurs.length, f.lignes[0].length, f.nom);
    f.lignes.forEach((r, i) => r.forEach((c, j) => {
      assert.notEqual(c, undefined, f.nom + ' ligne ' + i + ' col ' + j);
      assert.ok(!(typeof c === 'number' && !Number.isFinite(c)), f.nom + ' ligne ' + i + ' col ' + j + ' = ' + c);
      assert.ok(!(typeof c === 'string' && /NaN|undefined|null|Infinity/.test(c)), f.nom + ' ligne ' + i + ' col ' + j + ' = ' + c);
    }));
  });
  // même contrôle sur un fichier sans tendance calculable (3 mois incomplets)
  const Dc = Object.assign({}, D6, { couv: { '2026-01': [1, 2], '2026-02': [1, 2], '2026-03': [1, 2] } });
  C.feuillesExcel(C.tableau(T6, Dc), { prospects: PROS6 }, Dc, nomDe6).forEach(f => f.lignes.forEach(r => r.forEach(c => {
    assert.notEqual(c, undefined); assert.ok(!(typeof c === 'number' && !Number.isFinite(c)));
  })));
  // sans tendance : cellules de tendance vides, jamais « NaN »
  const Lc = C.feuillesExcel(C.tableau(T6, Dc), { prospects: [] }, Dc, nomDe6)[0].lignes;
  assert.deepEqual(Lc[1].slice(13), ['', '', '']);
});

test('nom du fichier Excel : accents et espaces retirés, finit par .xlsx', () => {
  assert.equal(C.nomFichierExcel('T10', 'Ville Éé Gare', '2026-11-11'), 'Tournee-T10-Ville-Ee-Gare-2026-11-11.xlsx');
  assert.equal(C.nomFichierExcel('T7', 'Saint-Étienne d’Orbec – Nord'), 'Tournee-T7-Saint-Etienne-d-Orbec-Nord.xlsx');
  assert.equal(C.nomFichierExcel('T1', null, '2026-11-11'), 'Tournee-T1-2026-11-11.xlsx');
  const n = C.nomFichierExcel('T10', 'Évreux  Çà et là', '2026-11-11');
  assert.ok(/^[A-Za-z0-9.-]+$/.test(n) && n.endsWith('.xlsx'));
  assert.ok(C.nomFichierExcel('T1', 'x'.repeat(200), 'j').length < 90);
});
