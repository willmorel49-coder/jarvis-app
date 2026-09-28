/* Moteur APPRO — ABC/XYZ, Croston/SBA, stock de sécurité, euros, service, zones de livraison.
   Chaque attente est un cas dont la réponse est connue À LA MAIN : un test qui se contente de
   relire ce que le code vient de calculer ne prouve rien. Ajouté le 28/09/2026. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-appro-moteur.js');

const pres = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test('moyenne et écart-type de population, à la main', () => {
  pres(M.moyenne([2, 4, 6]), 4);
  // écarts -2,0,+2 → variance (4+0+4)/3 = 8/3 → σ = 1,632993...
  pres(M.ecartType([2, 4, 6]), Math.sqrt(8 / 3), 1e-12);
  pres(M.cv([2, 4, 6]), Math.sqrt(8 / 3) / 4, 1e-12);
  pres(M.cv([0, 0, 0]), 0);                      // aucune vente : pas de division par zéro
  pres(M.ecartType([5]), 0);                     // un seul point : pas d'écart-type
});

test('CV plafonné par la longueur de l’historique : √(n−1)', () => {
  // Une seule vente sur 5 mois : le CV ne PEUT pas dépasser √4 = 2. C’est la raison pour
  // laquelle ces références passent par Croston et non par le CV.
  pres(M.cv([40, 0, 0, 0, 0]), 2, 1e-12);
  pres(M.cv([7, 0, 0]), Math.sqrt(2), 1e-12);
});

test('XYZ : seuils mesurés, et pas de classement sur un historique trop court', () => {
  assert.equal(M.XYZ.X, 0.50);
  assert.equal(M.XYZ.Y, 1.00);
  assert.equal(M.xyz([10, 10, 10, 10]), 'X');            // CV = 0
  assert.equal(M.xyz([10, 6, 14, 10]), 'X');             // CV = 0,283 : X ici, Y avec les seuils des manuels
  assert.equal(M.xyz([16, 4, 16, 4]), 'Y');              // CV = 0,60
  assert.equal(M.xyz([40, 0, 0, 0, 0]), 'Z');            // CV = 2
  assert.equal(M.xyz([10, 10]), null);                   // 2 mois : on ne classe pas
  assert.equal(M.xyz([]), null);
  // pile sur le seuil : 0,50 n'est PAS X (comparaison stricte)
  assert.equal(M.xyz([15, 5, 15, 5]), 'Y');              // CV = 0,5
});

test('ADI et intermittence (Syntetos-Boylan, seuil 1,32)', () => {
  pres(M.adi([1, 1, 1, 1]), 1);
  assert.equal(M.intermittent([1, 1, 1, 1]), false);
  pres(M.adi([1, 0, 1, 0, 1, 0]), 2);
  assert.equal(M.intermittent([1, 0, 1, 0, 1, 0]), true);
  pres(M.adi([0, 0, 0]), 0);                             // jamais vendue ≠ régulière
  assert.equal(M.intermittent([0, 0, 0]), false);
  // 4 mois sur 5 vendus → ADI 1,25 < 1,32 : pas encore intermittente
  assert.equal(M.intermittent([1, 1, 1, 1, 0]), false);
});

test('Croston/SBA : valeur calculée à la main', () => {
  // [0,2,0,0,3,0] : amorce niveau 2 / période 2 ; à la 2e vente (écart 3) avec α=0,1 →
  // niveau 2,1 · période 2,1 → Croston = 1,0 · SBA = 1,0 × (1 − 0,05) = 0,95.
  pres(M.croston([0, 2, 0, 0, 3, 0], 0.1, false), 1, 1e-12);
  pres(M.croston([0, 2, 0, 0, 3, 0]), 0.95, 1e-12);
  pres(M.croston([0, 0, 0]), 0);                         // aucune vente
  // une seule vente de 10 au 4e mois : niveau 10, période 4 → 2,5 ; SBA → 2,375
  pres(M.croston([0, 0, 0, 10], 0.1, false), 2.5, 1e-12);
  pres(M.croston([0, 0, 0, 10]), 2.375, 1e-12);
});

test('M.vitesse : moyenne si régulière, Croston si intermittente', () => {
  pres(M.vitesse([10, 10, 10, 10]), 10);                 // régulière → moyenne
  const s = [0, 2, 0, 0, 3, 0];
  pres(M.vitesse(s), 0.95, 1e-12);                       // intermittente → SBA
  assert.notEqual(M.vitesse(s), M.moyenne(s));           // et ce n'est PAS la moyenne
});

test('niveau de service par case ABC×XYZ', () => {
  assert.equal(M.cellule({ abc: 'A', xyz: 'X' }), 'AX');
  assert.equal(M.cellule({}), 'CZ');                     // sans classe : le cas le moins exigeant
  assert.equal(M.niveauService({ abc: 'A', xyz: 'Z' }), 0.99);
  assert.equal(M.niveauService({ abc: 'C', xyz: 'Z' }), 0.85);
  assert.equal(M.zService({ abc: 'A', xyz: 'Z' }), 2.33);
  // une référence de forte valeur erratique est MIEUX servie qu'une régulière de même classe
  assert.ok(M.niveauService({ abc: 'A', xyz: 'Z' }) > M.niveauService({ abc: 'A', xyz: 'X' }));
  // et une C erratique est moins bien servie qu'une A erratique
  assert.ok(M.niveauService({ abc: 'C', xyz: 'Z' }) < M.niveauService({ abc: 'A', xyz: 'Z' }));
});

test('stock de sécurité : formule normale, calcul refait à la main', () => {
  const s = [100, 120, 80, 100, 100];                    // moyenne 100, σ = 12,649
  const o = { abc: 'B', xyz: M.xyz(s) };
  assert.equal(o.xyz, 'X');                              // CV = 0,126
  const sigma = M.ecartType(s);
  const attendu = 1.65 * (sigma / Math.sqrt(30)) * Math.sqrt(M.DELAI) / (100 / 30);
  pres(M.ssJours(o, s), attendu, 1e-9);
  // Forme close utile à retenir : sur une demande régulière, coussin = Z × CV × √(30 × délai)
  // → ici 1,65 × 0,126 × 14,49 ≈ 3,0 jours. Une demande régulière n'a presque pas besoin de coussin.
  pres(M.ssJours(o, s), M.zService(o) * M.cv(s) * Math.sqrt(30 * M.DELAI), 1e-9);
  assert.ok(M.ssJours(o, s) < 4);
});

test('stock de sécurité : loi de Poisson sur une demande intermittente', () => {
  const s = [0, 0, 3, 0, 0, 2];
  const o = { abc: 'C', xyz: M.xyz(s) };
  assert.ok(M.intermittent(s));
  const vD = M.vitesse(s) / 30;
  pres(M.ssJours(o, s), Math.min(M.SS_MAX_J, 1.04 * Math.sqrt(vD * M.DELAI) / vD), 1e-9);
});

test('stock de sécurité : plafonné, et nul sans historique', () => {
  // ⚠️ Le plafond ne mord PAS là où on le croirait. Sur une demande intermittente de grosse
  // taille le coussin de Poisson reste court en jours (une vente de 1 000 par mois vendue un
  // mois sur six : 1,1 jour). Il mord sur une demande RÉGULIÈRE mais très variable, où le
  // coussin vaut Z × CV × √(30 × délai) : 2,33 × 0,98 × 14,49 = 33 jours, ramenés au plafond.
  assert.ok(M.ssJours({ abc: 'A', xyz: 'Z' }, [1000, 0, 0, 0, 0, 0]) < 2);
  assert.equal(M.ssJours({ abc: 'A', xyz: 'Z' }, [100, 1, 100, 1, 100, 1]), M.SS_MAX_J);
  // et une vente rare d'UNE unité, elle, fait bien mordre le plafond par le bas
  assert.equal(M.ssJours({ abc: 'A', xyz: 'Z' }, [1, 0, 0, 0, 0, 0]), M.SS_MAX_J);
  assert.equal(M.ssJours({ abc: 'A', xyz: 'X' }, [10, 10]), 0);   // 2 mois : rien
  assert.equal(M.ssJours({ abc: 'A', xyz: 'X' }, [0, 0, 0]), 0);  // aucune vente : rien
});

test('la cible : délai + revue + coussin, plancher légal, tension', () => {
  assert.equal(M.cible({ ssJ: 0 }), Math.max(M.PLANCHER, M.DELAI + M.REVUE));
  assert.equal(M.cible({ ssJ: 10 }), M.DELAI + M.REVUE + 10);
  assert.equal(M.cible({}), M.CIBLE);                             // pas de ssJ → ancien réglage
  assert.equal(M.cible({ ssJ: 0, tension: 1 }), M.CIBLE_TENSION);  // une tension ne fait jamais baisser
  assert.ok(M.cible({ ssJ: 40, tension: 1 }) > M.CIBLE_TENSION);   // ni plafonner
  assert.ok(M.cible({ ssJ: -5 }) >= M.PLANCHER);                   // jamais sous le plancher légal
});

test('quantité conseillée : cible × vitesse × saison − stock', () => {
  const o = { ssJ: 0, vM: 300, st: 40 };                 // cible 14 j, 10 u/j → 140 − 40 = 100
  assert.equal(M.qte(o), 100);
  assert.equal(M.qte(o, 1.5), 170);                      // saison ×1,5 → 210 − 40
  assert.equal(M.qte({ ssJ: 0, vM: 300, st: 5000 }), 0); // déjà servi : jamais négatif
  assert.equal(M.qte({ ssJ: 0, vM: 300, st: 0, unk: 1 }), 0); // stock inconnu : on ne commande pas
  assert.equal(M.qte(null), 0);
});

test('priorisation en euros', () => {
  // 300 u/mois = 10 u/j ; il faut tenir DELAI+REVUE jours ; stock 20 ; PPHT 5 €
  const besoin = 10 * (M.DELAI + M.REVUE);
  pres(M.euroRisque({ vM: 300, st: 20, ppht: 5 }), (besoin - 20) * 5);
  assert.equal(M.euroRisque({ vM: 300, st: 1000, ppht: 5 }), 0);      // on tient : zéro risque
  assert.equal(M.euroRisque({ vM: 300, st: 0, ppht: 5, unk: 1 }), 0);  // stock inconnu : pas un risque
  assert.equal(M.euroDormant({ st: 100, ppht: 3, cov: 400 }), 300);
  assert.equal(M.euroDormant({ st: 100, ppht: 3, cov: 20 }), 0);       // ça tourne : rien d'immobilisé
});

test('indicateurs de service : deux références, comptées à la main', () => {
  const a = { vM: 100, st: 100, ppht: 10, cov: 30 };      // servable en entier
  const b = { vM: 100, st: 0, ppht: 10, cov: 0 };          // à sec
  const c = { vM: 100, st: 50, ppht: 10, unk: 1 };         // jamais inventoriée : écartée
  const s = M.service([a, b, c]);
  assert.equal(s.n, 3);
  assert.equal(s.nInconnu, 1);
  assert.equal(s.nSec, 1);
  pres(s.demande, 2000);                                   // (100+100) × 10 €
  pres(s.servable, 1000);                                  // a seule
  pres(s.taux, 0.5);
  pres(s.rupture, 0.5);                                    // 1 à sec sur 2 mesurées
  pres(s.valStock, 1000);
  assert.equal(s.photo, true);                             // c'est une photo, pas un historique
  assert.equal(M.service([]).n, 0);
});

test('zones de livraison : un département ne peut appartenir qu’à UNE zone', () => {
  const vu = {};
  for (const z of M.ZONES) for (const d of z.dep) {
    assert.ok(!vu[d], 'département ' + d + ' présent dans deux zones');
    vu[d] = z;
  }
  // les sept établissements dont nous avons le stock sont tous couverts
  const sites = new Set();
  for (const z of M.ZONES) for (const s of z.sites) sites.add(s);
  assert.deepEqual([...sites].sort(), ['CPR', 'HP', 'MSP', 'OPS', 'POS', 'SEP', 'SOP']);
});

test('département d’un code postal, y compris les codes à 4 chiffres', () => {
  assert.equal(M.depDe('44300'), '44');
  assert.equal(M.depDe('6000'), '06');      // Nice écrit sans son zéro
  assert.equal(M.depDe(83400), '83');       // nombre, pas chaîne
  assert.equal(M.depDe(''), null);
  assert.equal(M.depDe('0'), null);
  assert.equal(M.depDe(null), null);
});

test('rattachement au dépôt : mesuré, partagé, hors des sept, ou abstention', () => {
  assert.deepEqual(M.zoneDe('44300').sites, ['OPS']);             // un seul dépôt : mesuré
  assert.deepEqual(M.zoneDe('83400').sites, ['HP', 'MSP', 'SEP']); // zone partagée
  assert.deepEqual(M.zoneDe('75001').sites, []);                  // Escale Pharma : hors des sept
  assert.equal(M.zoneDe('75001').hors, 'Escale Pharma');
  assert.equal(M.zoneDe('57000').hors, 'Pharmest');
  // ⚠️ un département hors liste ne se rattache PAS au dépôt le plus proche
  for (const cp of ['73000', '63000', '01000', '74000', '37000'])
    assert.equal(M.zoneDe(cp), null, cp + ' ne doit pas être deviné');
});

test('parSite : demande mesurée par site, et le « ≈ » posé seulement là où il faut', () => {
  const glob = globalThis;
  glob.ETAB_PRICES = {
    etabs: [{ code: 'OPS' }, { code: 'HP' }, { code: 'MSP' }],
    prices: { OPS: { '1': [2, 300] }, HP: { '1': [2, 30] }, MSP: {} }   // MSP : aucune ligne
  };
  M.demandeSite = () => ({ OPS: 300, HP: 30, MSP: 30, _est: { HP: 1, MSP: 1 }, _hors: 12, _nr: 7 });
  const p = M.parSite('1', 360);
  assert.equal(p.mesure, true);
  const ops = p.sites.find(x => x.site === 'OPS');
  pres(ops.cov, 300 / (300 / 30));            // 30 jours, sur SA demande — pas sur 360/3
  assert.equal(ops.est, 0);                   // OPS est seul sur ses départements : mesuré
  assert.equal(p.sites.find(x => x.site === 'HP').est, 1);   // zone partagée : estimé
  assert.equal(p.sites.find(x => x.site === 'MSP').st, null);// aucune ligne : non communiqué
  assert.equal(p.nc, 1);
  assert.equal(p.est, 2);
  assert.equal(p.horsSept, 12);
  assert.equal(p.nonRattache, 7);
  // sans source branchée : retour à l'ancienne hypothèse, et TOUT est marqué estimé
  M.demandeSite = null;
  const q = M.parSite('1', 360);
  assert.equal(q.mesure, false);
  assert.equal(q.est, 3);
  pres(q.sites.find(x => x.site === 'OPS').cov, 300 / (120 / 30));   // 360 ÷ 3 sites
  delete glob.ETAB_PRICES;
});

test('transferts : le besoin du receveur se lit sur SA demande', () => {
  const glob = globalThis;
  glob.ETAB_PRICES = {
    etabs: [{ code: 'OPS' }, { code: 'SOP' }],
    prices: { OPS: { '1': [2, 5] }, SOP: { '1': [2, 900] } }
  };
  // OPS vend 300/mois et n'a que 5 boîtes ; SOP vend 3/mois et en a 900 : SOP dort.
  M.demandeSite = () => ({ OPS: 300, SOP: 3, _est: {}, _hors: 0, _nr: 0 });
  const mv = M.transferts('1', 303);
  assert.equal(mv.length, 1);
  assert.equal(mv[0].de, 'SOP');
  assert.equal(mv[0].vers, 'OPS');
  // besoin d'OPS = 21 j × 10 u/j − 5 = 205, disponible chez SOP = 899 → 205
  assert.equal(mv[0].q, Math.round(M.CIBLE * (300 / 30) - 5));
  M.demandeSite = null;
  delete glob.ETAB_PRICES;
});

test('zone d’une référence : « jamais inventorié » n’est pas « à sec »', () => {
  assert.equal(M.zone({ unk: 1, cov: 0 }), 'inconnu');
  assert.equal(M.zone({ cov: 0.5 }), 'sec');
  assert.equal(M.zone({ cov: 10 }), 'hors');              // sous le plancher légal
  assert.equal(M.zone({ cov: 20, ssJ: 0 }), 'ok');        // cible 14 j : 20 j est servi
  assert.equal(M.zone({ cov: 400, ssJ: 0 }), 'dormant');
  assert.equal(M.zone(null), 'inconnu');
});
