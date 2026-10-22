/* Socle de calcul du panneau produit (22/10/2026) : calculs purs + V2.comptoir.stats().
   Données fabriquées à la main : la réponse est connue d'avance. Aucun montant de vente réel.
   Lancer : node --test comptoir-stats.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' attendu ' + b + ' ±' + tol + ', obtenu ' + a);
const nu = (x) => JSON.parse(JSON.stringify(x));   // sort du bac à sable : prototypes différents

// ── Faux fichiers servis par un faux fetch (le vrai chemin : fetch -> json -> stats) ──
const ELI = '3400926784102', DOLI = '3400935955838';
const FAUX = {
  'prix-futurs.json': { changes: [
    { c: ELI, d: 'ELIQUIS 5MG', pfht: 24.3, ppttc: 28.3, ancien_ttc: 58.95, sens: 'baisse', date_effet: '2026-10-06', date_publi: '2026-10-06' },
    { c: 'X1', d: 'FUTUR', pfht: 5, ppttc: 8, ancien_ttc: 10, sens: 'baisse', date_effet: '2027-01-02', date_publi: '2026-10-15' },
    { c: 'X2', d: 'STABLE', pfht: 5, ppttc: 8, ancien_ttc: 8, sens: 'stable', date_effet: '2026-10-06', date_publi: '2026-10-06' },
    { c: 'X3', d: 'VIEUX', pfht: 5, ppttc: 8, ancien_ttc: 10, sens: 'baisse', date_effet: '2026-01-02', date_publi: '2026-01-02' }] },
  'prix-futurs-archive.json': { evenements: [
    { c: ELI, d: 'ELIQUIS 5MG', pfht: 24.3, ppttc: 28.3, ancien_ttc: 58.95, sens: 'baisse', date_effet: '2026-10-06', vu: '2026-10-06' },   // doublon de l'avis courant
    { c: 'X4', d: 'RETARD', pfht: 3.0, ppttc: 5, ancien_ttc: 6, sens: 'hausse', date_effet: '2026-09-01', vu: '2026-09-02' }] },
  'generiques-bdpm.json': { princepsWithGeneric: ['G1'], newGeneric: [{ gid: '1', lib: 'X', cips: ['G2'], since: '2026-10-02' }] },
  'ema-generiques.json': { items: [{ inn: 'apixaban', name: 'Apixaban Test', type: 'générique', status: 'Opinion', opinion: '2026-09-01' }, { inn: 'autre', name: 'Autre', type: 'générique', status: 'Opinion' }] },
  'marche-regional.json': { data: { [ELI]: { b: [100, 50], e: [5000, 2500], a: [1, 2, 3, 4] } } },
  'previsions.json': { dernier_mois_reel: '2026-08', data: { [ELI]: [103, 99, 106, 103, 99, 107, 106, 101, 110, 105, 1] } },
  'ansm-dispo.json': { items: [{ st: 'Tension', cips: [ELI], retour: { raw: 'décembre 2026', iso: '2026-12' }, since: '2026-05-07', maj: '21/10/2026' }, { st: 'Rupture de stock', cips: [ELI], retour: { raw: 'janvier 2027', iso: '2027-01' } }] },
  'rappels-lots.json': { items: [{ d: '2026-08-10', t: 'Rappel test', cips: [ELI], lots: [{ n: '1' }] }, { d: '2024-01-10', t: 'Trop ancien', cips: [DOLI], lots: [] }] },
  'has-avis.json': { items: [{ cips: [ELI], smr: 'Important', asmr: 'IV', date: '2026-09-16' }] },
  'national.json': { generated: '2026-10-08', data: { [ELI]: { v: 150, s: [1, 0.9, 1, 1, 1, 1, 1, 1, 1, 1.2, 1, 0.8], d: 'APIXABAN', g: 1 }, REP: { v: 5, g: 1, d: 'X' } } }
};
const appels = {};
function faitFetch(table, echec) {
  return (url) => {
    const f = String(url).split('?')[0];
    appels[f] = (appels[f] || 0) + 1;
    if (echec && echec.includes(f)) return Promise.reject(new Error('réseau coupé'));
    if (f in table) return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(table[f]))) });
    return Promise.resolve({ ok: false, json: () => Promise.reject(new Error('404')) });
  };
}
function bac(table, echec) {
  const sb = { document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } }, console, setTimeout, clearTimeout, Promise };
  sb.window = sb; sb.globalThis = sb;
  sb.fetch = faitFetch(table, echec);
  vm.createContext(sb);
  vm.runInContext('window.V2 = {};', sb);
  vm.runInContext(readFileSync(new URL('../crm/v2/v2-comptoir.js', import.meta.url), 'utf8'), sb);
  return sb;
}
const sb = bac(FAUX);
const C = sb.V2.comptoir, K = C._calc;
K.horloge(() => new Date(2026, 9, 22));   // 22/10/2026

// ── 1. Calculs purs : ELIQUIS 5MG ──
test('ELIQUIS 5MG : PFHT 51,00, marge officine 3,21, MG 2026 = 2027, abandon 2,12 stable, marge pharmacien 5,33 -> 5,33', () => {
  const pfht = K.pfhtDepuisPpht(54.53, false);
  near(pfht, 51.00, 0.01, 'PFHT');
  near(K.margeOfficine(pfht), 3.21, 0.01, 'marge officine');
  near(K.margeGrossiste(pfht, 2026, false), K.margeGrossiste(pfht, 2027, false), 1e-9, 'MG 2026 = 2027 en tranche intermédiaire');
  near(K.abandon2027(2.12, pfht), 2.12, 1e-9, 'abandon 2027');
  const mp = nu(K.margePharmacien('pr_mid', pfht, 2.12));
  assert.equal(mp.applicable, true);
  near(mp.total26, 5.33, 0.01, 'total 2026'); near(mp.total27, 5.33, 0.01, 'total 2027'); near(mp.delta, 0, 1e-9, 'delta');
  // Contre-contrôle indépendant : prix public 58,95 = (54,53 + 3,21) x 1,021
  near((54.53 + K.margeOfficine(pfht)) * 1.021, 58.95, 0.01, 'prix public');
});

test('petit prix : PFHT 1,70, MG 0,30 -> 0,22, abandon 0,18 -> 0,132, marge pharmacien baisse de 0,048', () => {
  const pfht = K.pfhtDepuisPpht(2.00, false);
  near(pfht, 1.70, 1e-9);
  near(K.margeGrossiste(pfht, 2026, false), 0.30, 1e-9);
  near(K.margeGrossiste(pfht, 2027, false), 0.22, 1e-9);
  near(K.abandon2027(0.18, pfht), 0.132, 1e-9);
  const mp = nu(K.margePharmacien('pr_low', pfht, 0.18));
  near(mp.delta, -0.048, 1e-9, 'delta');
  near(mp.reglementee, 0.17, 1e-9, 'marge officine 10 % de 1,70');
});

test('abandon au-dessus de notre règle (offre du laboratoire, Doliprane 0,27 €) : 2027 marqué « estimation »', () => {
  const pfht = K.pfhtDepuisPpht(2.00, false);
  assert.equal(nu(K.margePharmacien('pr_low', pfht, 0.27)).abandonEstime, true, 'offre labo');
  assert.equal(nu(K.margePharmacien('pr_low', pfht, 0.18)).abandonEstime, false, 'notre règle : 0,18 €');
  const mid = K.pfhtDepuisPpht(50, false);
  assert.equal(nu(K.margePharmacien('pr_mid', mid, 50 * 0.0389)).abandonEstime, false, 'notre règle : 3,89 %');
  assert.equal(nu(K.margePharmacien('pr_mid', mid, null)).abandonEstime, false, 'sans abandon');
});

test('zone 3,1746 - 4,3290 de PFHT : plancher 2026 (0,30) mais 6,93 % en 2027 ; bornes jamais arrondies', () => {
  near(K.margeGrossiste(4.0, 2026, false), 0.30, 1e-9);
  near(K.margeGrossiste(4.0, 2027, false), 0.0693 * 4.0, 1e-9);
  near(K.abandon2027(0.18, 4.0), 0.18 * 0.2772 / 0.30, 1e-9, 'abandon proportionnel');
  // Juste sous la borne basse : plancher 2027 ; juste au-dessus : le taux prend le relais.
  near(K.margeGrossiste(3.17, 2027, false), 0.22, 1e-9);
  near(K.margeGrossiste(3.18, 2027, false), 0.0693 * 3.18, 1e-9);
  // Borne haute 2026 : 0,30 / 0,0693 = 4,3290 (4,33 arrondi serait faux)
  near(K.margeGrossiste(4.329, 2026, false), 0.30, 1e-3); near(K.margeGrossiste(4.34, 2026, false), 0.0693 * 4.34, 1e-9);
  // Aller-retour du barème inversé, de part et d'autre de chaque bascule
  [0.5, 3.1, 4.0, 4.328, 4.331, 10, 200, 468.9, 480, 600, 1500].forEach((p) => {
    const ppht = p + K.margeGrossiste(p, 2026, false);
    near(K.pfhtDepuisPpht(ppht, false), p, 0.01, 'aller-retour PFHT ' + p);
  });
});

test('froid : forfait 0,63 -> 0,80 en plus, jamais partagé avec l\'officine', () => {
  const pfht = K.pfhtDepuisPpht(2.63, true);
  near(pfht, 1.70, 1e-9, 'PFHT hors forfait');
  near(K.margeGrossiste(pfht, 2026, true) - K.margeGrossiste(pfht, 2026, false), 0.63, 1e-9);
  near(K.margeGrossiste(pfht, 2027, true) - K.margeGrossiste(pfht, 2027, false), 0.80, 1e-9);
  near(K.margeGrossiste(pfht, 2026, true), 0.93, 1e-9); near(K.margeGrossiste(pfht, 2027, true), 1.02, 1e-9);
  near(K.abandon2027(0.18, pfht), 0.132, 1e-9, 'l\'abandon ignore le forfait');
});

test('produit cher (> 468,97 de PFHT) : marge grossiste plafonnée à 32,50, marge officine par tranches', () => {
  const pfht = K.pfhtDepuisPpht(600, false);
  near(pfht, 567.50, 0.01);
  near(K.margeGrossiste(pfht, 2026, false), 32.50, 0.001); near(K.margeGrossiste(pfht, 2027, false), 32.50, 0.001);
  near(K.margeOfficine(pfht), 29.53, 0.01);
  near(K.margeOfficine(2000), 0.191 + 1.4693 + 0.055 * 127.1 + 0.05 * 1780, 0.001, 'rien au-delà de 1 930');
  near(K.abandon2027(19.5, pfht), 19.5, 1e-3, 'abandon inchangé au plafond');
  assert.equal(nu(K.margePharmacien('pr_high', pfht, 19.5)).applicable, true);
});

test('générique, biosimilaire, NR : applicable:false (jamais 0 €)', () => {
  ['gen', 'biosim', 'nr', undefined].forEach((f) => assert.deepEqual(nu(K.margePharmacien(f, 20, 1)), { applicable: false }));
  assert.equal(K.pfhtDepuisPpht(0, false), null);
  assert.equal(K.pfhtDepuisPpht(null, false), null);
  assert.equal(K.abandon2027(null, 20), null);
});

// ── 2. Pures : alertes, génériques, ANSM, rappels ──
test('alerte prix : lue pour un CIP présent dans prix-futurs, sans doublon avec l\'archive, hors « stable » et hors vieux avis', () => {
  const r = nu(K.alertesPrix(ELI, FAUX['prix-futurs.json'], FAUX['prix-futurs-archive.json'], new Date(2026, 9, 22), 51.0));
  assert.equal(r.evenements.length, 1);
  assert.deepEqual(r.evenements[0], { sens: 'baisse', ancienTtc: 58.95, nouveauTtc: 28.3, pfht: 24.3, dateEffet: '2026-10-06', aVenir: false });
  assert.equal(r.catalogueEnRetard, true);                    // 24,30 contre 51,00 : le catalogue n'a pas suivi
  assert.equal(nu(K.alertesPrix('X1', FAUX['prix-futurs.json'], null, new Date(2026, 9, 22), 5)).evenements[0].aVenir, true);
  assert.equal(K.alertesPrix('X2', FAUX['prix-futurs.json'], null, new Date(2026, 9, 22), 5).evenements.length, 0, 'stable ignoré');
  assert.equal(K.alertesPrix('X3', FAUX['prix-futurs.json'], null, new Date(2026, 9, 22), 5).evenements.length, 0, 'plus de 180 jours');
  // Contre-épreuve : catalogue déjà à jour (écart < 2 %) -> pas de drapeau
  assert.equal(K.alertesPrix(ELI, FAUX['prix-futurs.json'], null, new Date(2026, 9, 22), 24.5).catalogueEnRetard, false);
  // … ni un catalogue déjà SOUS le nouveau prix (+7 % : génériques BOSUTINIB ZEN, VARENICLINE TVC, 22/10/2026)
  assert.equal(K.alertesPrix(ELI, FAUX['prix-futurs.json'], null, new Date(2026, 9, 22), 22.72).catalogueEnRetard, false);
  assert.equal(K.alertesPrix(ELI, null, null, new Date(2026, 9, 22), 24.5).evenements.length, 0);
});

test('statut générique : commercialise / nouveau (+ date) / repertoire / aucun', () => {
  const G = FAUX['generiques-bdpm.json'];
  assert.deepEqual(nu(K.statutGenerique('G1', G, null)), { statut: 'commercialise', depuis: null });
  assert.deepEqual(nu(K.statutGenerique('G2', G, null)), { statut: 'nouveau', depuis: '2026-10-02' });
  assert.deepEqual(nu(K.statutGenerique('REP', G, { g: 1 })), { statut: 'repertoire', depuis: null });
  assert.deepEqual(nu(K.statutGenerique('Z', G, { g: 0 })), { statut: 'aucun', depuis: null });
  assert.equal(K.statutGenerique('Z', null, null), null);
  assert.deepEqual(nu(K.emaPourMolecule(FAUX['ema-generiques.json'], 'APIXABAN')), [{ nom: 'Apixaban Test', type: 'générique', statut: 'Opinion', date: '2026-09-01' }]);
  assert.deepEqual(nu(K.emaPourMolecule(FAUX['ema-generiques.json'], 'TRAMADOL/APIXABAN')).length, 1);
  assert.deepEqual(nu(K.emaPourMolecule(FAUX['ema-generiques.json'], '')), []);
});

test('ANSM : la rupture passe avant la tension ; rappel de moins de 12 mois seulement ; HAS', () => {
  assert.equal(K.ansmPourCip(FAUX['ansm-dispo.json'], ELI).statut, 'Rupture de stock');
  assert.equal(K.ansmPourCip(FAUX['ansm-dispo.json'], 'AUCUN'), null);
  assert.equal(K.rappelPourCip(FAUX['rappels-lots.json'], ELI, new Date(2026, 9, 22)).date, '2026-08-10');
  assert.equal(K.rappelPourCip(FAUX['rappels-lots.json'], DOLI, new Date(2026, 9, 22)), null);
  assert.equal(K.hasPourCip(FAUX['has-avis.json'], ELI).smr, 'Important');
  assert.equal(K.saisonDe(FAUX['national.json'].data[ELI].s).moisFort, 10);
  assert.equal(K.saisonDe(FAUX['national.json'].data[ELI].s).moisFaible, 12);
});

// ── 3. stats() de bout en bout : vrai chemin fetch -> json -> stats, sans exception ──
const VENTES = [
  ['100', 1, 'Alice', ELI, 10, 50, 500],
  ['100', 2, 'Alice', ELI, 5, 50, 250],
  ['200', 2, 'Bruno', ELI, 40, 50, 2000],
  ['300', 9, 'Bruno', ELI, 7, 50, 350],     // mois hors période : ignoré
  ['0',   2, '',      ELI, 900, 50, 45000], // reste du réseau : compte dans les boîtes, pas dans les clientes
  ['100', 1, 'Alice', DOLI, 3, 1, 3]
];
function leELIQUIS() { return { cip: ELI, d: 'ELIQUIS 5MG CPR BT60', f: 'pr_mid', mol: 'APIXABAN', ppht: 54.53, net: 52.41, prix: 52.41, ab: 2.12, an: 6000, france: 150, rang: 12, part: 0.04 }; }

test('stats() : l\'objet complet, une seule demande par fichier, null pour ce qui n\'a pas de donnée', async () => {
  sb.window.WML_SALES = VENTES;
  sb.V2.ventesRestreintes = () => false;
  sb.V2.estReste = (id) => id === '0' || id === '0E';
  sb.V2.tendance = (c) => (c === ELI ? 11 : null); sb.V2.momentum = (c) => (c === ELI ? 2 : null);
  sb.V2.nouveaute = () => null;
  await C.chargerNational();
  const d = { mois: [1, 2, 3] };
  const s0 = nu(C.stats(leELIQUIS(), d));        // 1er appel : les fichiers sont demandés, rien n'est encore arrivé
  assert.equal(s0.chargement, true);
  assert.equal(s0.alertePrix, null); assert.equal(s0.france.valeur, null);
  await K.pret();
  const s = nu(C.stats(leELIQUIS(), d));
  assert.equal(s.chargement, false);
  near(s.prix.pfht, 51.00, 0.01); near(s.margeOfficine.reglementee, 3.21, 0.01);
  near(s.margePharmacien.total26, 5.33, 0.01); near(s.margePharmacien.total27, 5.33, 0.01);
  assert.equal(s.alertePrix.evenements.length, 1); assert.equal(s.alertePrix.catalogueEnRetard, true);
  assert.equal(s.alertePrix.evenements[0].nouveauTtc, 28.3);
  assert.equal(s.generique.statut, 'repertoire');                      // national g = 1, absent des listes BDPM
  assert.equal(s.generique.ema.length, 1);
  assert.deepEqual([s.france.boites, s.france.valeur, s.france.rang], [150, 7500, 12]);
  near(s.france.prixMoyen, 50, 1e-9);
  assert.equal(s.nosVentes.boites, 955); assert.equal(s.nosVentes.ca, 47750); assert.equal(s.nosVentes.clientes, 2);
  assert.equal(s.nosVentes.periode, 'janv. → mars 2026');
  assert.deepEqual(s.parCommercial.lignes.map((x) => [x.nom, x.boites, x.ca, x.clientes]), [['Bruno', 40, 2000, 1], ['Alice', 15, 750, 1]]);
  assert.equal(s.tendance.anAn, 11); assert.equal(s.tendance.previsions.m3, 103); assert.equal(s.tendance.previsions.fiable, true);
  assert.equal(s.autres.ansm.statut, 'Rupture de stock'); assert.equal(s.autres.rappel.date, '2026-08-10'); assert.equal(s.autres.has.asmr, 'IV');
  assert.equal(s.autres.nouveaute, null); assert.equal(s.autres.froid, false);
  assert.equal(s.notreMarge, null);                                    // ni MARGE_PRODUITS ni règle du Pilotage dans ce bac
  // Une seule demande par fichier, même après plusieurs appels
  C.stats(leELIQUIS(), d); C.stats(leELIQUIS(), d);
  ['prix-futurs.json', 'prix-futurs-archive.json', 'generiques-bdpm.json', 'ema-generiques.json', 'marche-regional.json', 'previsions.json', 'ansm-dispo.json', 'rappels-lots.json', 'has-avis.json']
    .forEach((f) => assert.equal(appels[f], 1, f + ' demandé ' + appels[f] + ' fois'));
});

test('par commercial = null quand ventesRestreintes() vaut vrai : aucun nom, aucun chiffre d\'un collègue', async () => {
  sb.V2.ventesRestreintes = () => true;
  const s = nu(C.stats(leELIQUIS(), { mois: [1, 2, 3] }));
  assert.equal(s.parCommercial, null);
  assert.equal(JSON.stringify(s).includes('Bruno'), false); assert.equal(JSON.stringify(s).includes('Alice'), false);
  assert.ok(s.nosVentes.boites > 0, 'l\'agrégat produit reste donné');
  // Contre-épreuve : le même appel, non restreint, nomme bien les commerciaux
  sb.V2.ventesRestreintes = () => false;
  assert.equal(JSON.stringify(nu(C.stats(leELIQUIS(), { mois: [1, 2, 3] }))).includes('Bruno'), true);
});

test('produit sans aucune donnée (générique, NR) : pas d\'exception, parties à null, marge pharmacien non applicable', () => {
  const gen = nu(C.stats({ cip: 'GEN1', d: 'GENERIQUE', f: 'gen', mol: '', ppht: 5, net: 0, prix: 0, ab: null, an: 0, france: 0, rang: 0 }, { mois: [1] }));
  assert.equal(gen.margePharmacien.applicable, false);
  assert.equal(gen.france, null); assert.equal(gen.abandon, null);
  const nr = nu(C.stats({ cip: 'NR1', d: 'NR', f: 'nr', mol: '', ppht: 0, net: 0, prix: 0, ab: null, an: 0, france: 0, rang: 0 }));
  assert.equal(nr.prix.pfht, null); assert.equal(nr.margeGrossiste, null); assert.equal(nr.margePharmacien, null);
  assert.equal(C.stats(null), null);
});

test('fichiers absents ou en erreur : « donnée indisponible », jamais d\'exception ni de panneau vide', async () => {
  const b2 = bac({ 'national.json': FAUX['national.json'] }, ['marche-regional.json']);   // 404 sur la plupart, réseau coupé sur un
  b2.V2.ventesRestreintes = () => false;
  await b2.V2.comptoir.chargerNational();
  b2.V2.comptoir.stats(leELIQUIS());
  await b2.V2.comptoir._calc.pret();
  const s = nu(b2.V2.comptoir.stats(leELIQUIS(), { mois: [1] }));
  assert.equal(s.alertePrix, null); assert.equal(s.france.valeur, null);
  assert.ok(s.indisponibles.includes('regional') && s.indisponibles.includes('prixFuturs'));
  near(s.margePharmacien.total26, 5.33, 0.01);                          // le calcul local ne dépend d'aucun fichier
  assert.equal(s.generique.statut, 'repertoire');                       // national.json seul suffit pour le répertoire
  assert.equal(s.autres.ansm, null);
  // Sans fetch du tout (vieux navigateur) : même résultat, sans exception
  const b3 = bac({});
  delete b3.fetch;
  b3.V2.comptoir.stats(leELIQUIS());
});


test('clientes comptées : seulement celles que l\'utilisateur peut voir (agrégats boîtes et CA : tout le réseau)', () => {
  const r = nu(K.ventesProduit(VENTES, ELI, [1, 2, 3], (id) => id === '0', false, (id) => id === '100'));
  assert.equal(r.clientes, 1); assert.equal(r.boites, 955);
  assert.equal(nu(K.ventesProduit(VENTES, ELI, [1, 2, 3], (id) => id === '0', false, null)).clientes, 2);
});

test('vue pharmacien : bascule mémorisable, sans stockage elle ne casse rien', () => {
  assert.equal(C.vuePharma(), false);
  C.vuePharma(true); assert.equal(C.vuePharma(), true);
  C.vuePharma(false); assert.equal(C.vuePharma(), false);
});

test('le rendu provisoire ne contient jamais le sigle de la marge grossiste ni « remise »', () => {
  const src = readFileSync(new URL('../crm/v2/v2-comptoir.js', import.meta.url), 'utf8');
  assert.equal(/MDL/.test(src), false); assert.equal(/remise/i.test(src), false);
});
