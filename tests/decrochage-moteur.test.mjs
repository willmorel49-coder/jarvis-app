/* decrochage-moteur.test.mjs — « À rappeler cette semaine » : le moteur seul.
 *
 * Toutes les ventes de ce fichier sont INVENTÉES (officines « A », « B »…,
 * montants ronds) : aucune vraie donnée de vente n'entre dans le dépôt public.
 * Chaque attente est calculée À LA MAIN dans le commentaire du cas : un test
 * qui relit ce que le code vient de calculer ne prouve rien.
 *
 * Règle validée par Will le 27/10/2026 (questions cliquées) : baisse ≥ 25 % ET
 * ≥ 500 € d'achats sur les 3 mois d'avant — la règle exacte du radar « Qui
 * inviter » (v2-rdv-radar.js), d'où le test de parité (cas 7) qui fait tourner
 * le VRAI `achats()` du radar, extrait du fichier livré, sur les mêmes ventes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const D = require('../crm/v2/v2-decrochage-moteur.js');
const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));

// ── Fabrique de ventes inventées ───────────────────────────────────────────
const MOIS_2026 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const AVANT = ['2026-04', '2026-05', '2026-06'];
const RECENT = ['2026-07', '2026-08', '2026-09'];

function vente(pid, ym, montant, commercial = 'KV') {
  const [y, m] = ym.split('-').map(Number);
  return { pharmacyId: pid, year: y, month: m, commercial, mntNetHt: montant };
}
// Un montant par mois, sur la liste de mois donnée.
function serie(pid, mois, montant, commercial = 'KV') {
  return mois.map((ym) => vente(pid, ym, montant, commercial));
}
// Une officine « de fond », stable et lourde : sans elle, le total mensuel du
// commercial bougerait avec les officines du cas, et la règle « mois final
// sous 60 % de la médiane » se déclencherait là où on ne l'attend pas.
function fond(commercial = 'KV', mois = MOIS_2026) {
  return serie('FOND-' + commercial, mois, 10000, commercial);
}

const AUJ = '2026-10-28';
const pids = (r) => r.lignes.map((l) => l.pid);

// Le jeu du cas 1, réutilisé ensuite.
//   A : 2 000 €/mois avant, 800 €/mois après → avant 6 000, récent 2 400, baisse 60 %,
//       écart mensuel (6 000 − 2 400) / 3 = 1 200 €.
//   B : 1 000 → 600 €/mois → avant 3 000, récent 1 800, baisse 40 %, écart 400 €.
//   C : 300 €/mois → 0      → avant 900, récent 0, baisse 100 %, écart 300 €.
//   D : 1 000 €/mois stable → pas de baisse.
//   E : 130 €/mois avant (390 € < 500 €) → 0 : sous le plancher, écartée.
//   F : nouvelle cliente (rien avant, 1 000 €/mois après) → écartée.
function jeuCas1() {
  return [
    ...fond(),
    ...serie('A', ['2026-01', '2026-02', '2026-03', ...AVANT], 2000), ...serie('A', RECENT, 800),
    ...serie('B', ['2026-01', '2026-02', '2026-03', ...AVANT], 1000), ...serie('B', RECENT, 600),
    ...serie('C', ['2026-01', '2026-02', '2026-03', ...AVANT], 300),
    ...serie('D', MOIS_2026, 1000),
    ...serie('E', AVANT, 130),
    ...serie('F', RECENT, 1000),
  ];
}

// ── (1) Cas construit à la main ────────────────────────────────────────────
test('(1) cas construit a la main : la liste, l ordre et les montants exacts', () => {
  const r = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: AUJ });
  assert.equal(r.comparable, true);
  assert.deepEqual(r.periode, { avant: ['2026-04', '2026-06'], recent: ['2026-07', '2026-09'] });
  assert.equal(r.moisRef, '2026-09');
  assert.deepEqual(pids(r), ['A', 'B', 'C'], 'tri par euros en jeu, décroissant');
  const [a, b, c] = r.lignes;
  assert.deepEqual([a.avant, a.recent, a.ecartMensuel], [6000, 2400, 1200]);
  assert.deepEqual([b.avant, b.recent, b.ecartMensuel], [3000, 1800, 400]);
  assert.deepEqual([c.avant, c.recent, c.ecartMensuel], [900, 0, 300]);
  assert.equal(a.pct, 0.6);
  assert.equal(a.avantMensuel, 2000);
  assert.equal(a.raison, 'baisse');
  assert.equal(a.etat, 'a_rappeler');
  assert.equal(r.nbARappeler, 3);
  assert.equal(r.total, 3);
});

test('(1 bis) au plus N lignes, le total reste dit', () => {
  const r = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: AUJ,
    reglages: { maxLignes: 2 } });
  assert.deepEqual(pids(r), ['A', 'B']);
  assert.equal(r.total, 3, 'une liste tronquée doit dire combien il y en a en tout');
});

test('(1 ter) changement de titulaire : la raison devient « reprise »', () => {
  const r = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: AUJ, reprises: { B: 1 } });
  assert.equal(r.lignes.find((l) => l.pid === 'B').raison, 'reprise');
  assert.equal(r.lignes.find((l) => l.pid === 'A').raison, 'baisse');
});

test('(1 quater) habitudes interrompues : raison complémentaire, jamais un critère d entrée', () => {
  const r = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: AUJ,
    habitudes: (pid) => ({ A: 6, D: 9 })[pid] || 0 });
  assert.equal(r.lignes.find((l) => l.pid === 'A').habitudes, 6);
  assert.ok(!pids(r).includes('D'), 'D est stable : 9 habitudes interrompues ne la font pas entrer');
});

test('(1 cinquies) les seuils se lisent dans UN objet de réglages', () => {
  // À 50 % au lieu de 25 % : B (40 %) sort, A (60 %) et C (100 %) restent.
  const r = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: AUJ,
    reglages: { baissePct: 0.5 } });
  assert.deepEqual(pids(r), ['A', 'C']);
  assert.deepEqual(
    { baissePct: D.REGLAGES.baissePct, baisseMinAvant: D.REGLAGES.baisseMinAvant,
      revenuePct: D.REGLAGES.revenuePct, enCoursJours: D.REGLAGES.enCoursJours,
      pasPertinentJours: D.REGLAGES.pasPertinentJours },
    { baissePct: 0.25, baisseMinAvant: 500, revenuePct: 0.8, enCoursJours: 14, pasPertinentJours: 60 });
  assert.ok(Object.isFrozen(D.REGLAGES), 'un écran ne doit pas pouvoir modifier les seuils en douce');
});

// ── (2) Bornes 24,9 % / 25 % et 499 € / 500 € ───────────────────────────────
test('(2) bornes : 25 % et 500 € entrent, 24,9 % et 499 € non', () => {
  const ventes = [
    ...fond(),
    // avant 400 + 300 + 300 = 1 000 ; récent 250 × 3 = 750 → (1 000 − 750) / 1 000 = 25 % pile → entre.
    vente('P25', '2026-04', 400), vente('P25', '2026-05', 300), vente('P25', '2026-06', 300),
    ...serie('P25', RECENT, 250),
    // avant 1 000 ; récent 251 + 250 + 250 = 751 → 24,9 % → n'entre pas.
    vente('P249', '2026-04', 400), vente('P249', '2026-05', 300), vente('P249', '2026-06', 300),
    vente('P249', '2026-07', 251), vente('P249', '2026-08', 250), vente('P249', '2026-09', 250),
    // avant 200 + 150 + 150 = 500 pile ; récent 0 → entre.
    vente('P500', '2026-04', 200), vente('P500', '2026-05', 150), vente('P500', '2026-06', 150),
    // avant 200 + 150 + 149 = 499 ; récent 0 → n'entre pas.
    vente('P499', '2026-04', 200), vente('P499', '2026-05', 150), vente('P499', '2026-06', 149),
  ];
  const r = D.calculer({ ventes, commercial: 'KV', aujourdhui: AUJ, reglages: { maxLignes: Infinity } });
  assert.deepEqual(pids(r).sort(), ['P25', 'P500']);
  assert.equal(D.enBaisse({ avant: 1000, recent: 750 }), true);
  assert.equal(D.enBaisse({ avant: 1000, recent: 751 }), false);
  assert.equal(D.enBaisse({ avant: 500, recent: 0 }), true);
  assert.equal(D.enBaisse({ avant: 499, recent: 0 }), false);
  assert.equal(D.enBaisse({ avant: 0, recent: 0 }), false);
});

// ── (3) Mois final incomplet écarté ─────────────────────────────────────────
test('(3) un mois final incomplet est ecarte et dit, la fenetre ne bouge pas', () => {
  // Octobre arrêté en cours de mois : 500 € pour tout le secteur, contre ~14 000
  // d'habitude. Sans la règle, la fenêtre récente deviendrait août-octobre et
  // D, stable, ressortirait en baisse.
  const ventes = [...jeuCas1(), vente('FOND-KV', '2026-10', 500)];
  const r = D.calculer({ ventes, commercial: 'KV', aujourdhui: AUJ });
  assert.deepEqual(r.moisEcartes, ['2026-10']);
  assert.equal(r.moisRef, '2026-09');
  assert.deepEqual(pids(r), ['A', 'B', 'C']);
});

test('(3 bis) moins de 6 mois complets : pas de liste, et on le dit (jamais un faux zero)', () => {
  const cinq = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const ventes = [...fond('KV', cinq), ...serie('A', ['2026-05', '2026-06'], 2000), ...serie('A', RECENT, 0)];
  const r = D.calculer({ ventes, commercial: 'KV', aujourdhui: AUJ });
  assert.equal(r.comparable, false);
  assert.equal(r.moisComplets, 5);
  assert.deepEqual(r.lignes, []);
  assert.equal(r.nbARappeler, null, 'un compteur sans calcul possible n est pas 0');
});

test('(3 ter) aucune vente chargee : pas comparable, pas de liste', () => {
  const r = D.calculer({ ventes: [], commercial: 'KV', aujourdhui: AUJ });
  assert.equal(r.comparable, false);
  assert.equal(r.nbARappeler, null);
});

// ── (4) Officine partagée ──────────────────────────────────────────────────
test('(4) officine partagee : seule la part du commercial compare', () => {
  // S est suivie par KV et par PSA. Le fichier de PSA s'arrête en juillet.
  //   Part KV : 1 000 €/mois toute l'année → stable.
  //   Part PSA : 1 000 €/mois de janvier à juillet, puis plus rien (fichier arrêté).
  // Pour KV : avant 3 000, récent 3 000 → pas de baisse. Si le moteur mélangeait
  // les deux parts : avant 6 000, récent 3 000 + 1 000 = 4 000 → 33 % → fausse baisse.
  const moisPSA = MOIS_2026.slice(0, 7);
  const ventes = [
    ...fond('KV'), ...fond('PSA', moisPSA),
    ...serie('S', MOIS_2026, 1000, 'KV'),
    ...serie('S', moisPSA, 1000, 'PSA'),
    // T n'appartient qu'à PSA, et chute chez PSA : invisible pour KV.
    ...serie('T', ['2026-01', '2026-02', '2026-03', '2026-04'], 3000, 'PSA'),
  ];
  const kv = D.calculer({ ventes, commercial: 'KV', aujourdhui: AUJ });
  assert.equal(kv.comparable, true);
  assert.deepEqual(pids(kv), [], 'aucune baisse pour KV : sa part de S est stable, T n est pas à lui');

  // Pour PSA, la fenêtre s'ancre sur SON fichier (juillet) : avant = févr.-avr., récent = mai-juil.
  //   S part PSA : avant 3 000, récent 3 000 → stable.
  //   T : avant (févr. + mars + avr.) 9 000, récent 0 → baisse 100 %, écart 3 000 €/mois.
  const psa = D.calculer({ ventes, commercial: 'PSA', aujourdhui: AUJ });
  assert.equal(psa.moisRef, '2026-07');
  assert.deepEqual(pids(psa), ['T']);
  assert.equal(psa.lignes[0].avant, 9000);
});

test('(4 bis) droits : une officine que le commercial ne voit pas ne sort jamais', () => {
  const r = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: AUJ,
    voit: (pid) => pid !== 'A' });
  assert.deepEqual(pids(r), ['B', 'C']);
});

// ── (5) « Pas pertinent » masque 60 jours ; contact récent = « en cours » ──
test('(5) « pas pertinent » masque 60 jours, pas un de plus', () => {
  const suivis = [{ pharmacy_id: 'A', statut: 'pas_pertinent', motif: 'saisonnier',
    mois_ref: '2026-09', geste_le: '2026-10-01T09:00:00+00:00' }];
  // 01/10 → 29/11 = 59 jours : masquée.
  const r59 = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: '2026-11-29', suivis });
  assert.ok(!pids(r59).includes('A'));
  assert.equal(r59.masquees, 1, 'une ligne écartée se compte, elle ne disparaît pas en silence');
  // 01/10 → 30/11 = 60 jours : elle revient.
  const r60 = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: '2026-11-30', suivis });
  assert.ok(pids(r60).includes('A'));
  assert.equal(r60.masquees, 0);
});

test('(5 bis) contactee depuis moins de 14 jours : « en cours », pas cachee', () => {
  // B vue le 20/10 (8 jours) → en cours. C vue le 14/10 (14 jours) → à rappeler.
  const r = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: AUJ,
    contacts: { B: '2026-10-20', C: '2026-10-14' } });
  assert.deepEqual(pids(r), ['A', 'C', 'B'], 'les « en cours » passent après les « à rappeler »');
  assert.equal(r.lignes.find((l) => l.pid === 'B').etat, 'en_cours');
  assert.equal(r.lignes.find((l) => l.pid === 'C').etat, 'a_rappeler');
  assert.equal(r.lignes.find((l) => l.pid === 'B').dernierContact, '2026-10-20');
  assert.equal(r.nbARappeler, 2);
  assert.equal(r.total, 3);
});

test('(5 ter) un geste « appelee » recent met aussi la ligne « en cours »', () => {
  const suivis = [{ pharmacy_id: 'A', statut: 'appelee', mois_ref: '2026-09',
    geste_le: '2026-10-25T10:00:00+00:00' }];
  const r = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: AUJ, suivis });
  const a = r.lignes.find((l) => l.pid === 'A');
  assert.equal(a.etat, 'en_cours');
  assert.equal(a.dernierContact, '2026-10-25');
  assert.equal(a.suivi.statut, 'appelee');
});

// ── (6) Résultat « revenue » / « toujours en baisse » ───────────────────────
test('(6) resultat : 80 % du niveau mensuel d avant, borne comprise', () => {
  const suivi = { pharmacy_id: 'A', statut: 'appelee', mois_ref: '2026-09', avant_mensuel: 2000,
    geste_le: '2026-10-05T09:00:00+00:00' };
  const avecOctobre = (montant) => [...jeuCas1(), vente('FOND-KV', '2026-10', 10000), vente('A', '2026-10', montant)];
  // Octobre complet. 1 600 € = 80 % × 2 000 pile → revenue ; 1 599 € → toujours en baisse.
  assert.equal(D.resultat(suivi, avecOctobre(1600), 'KV').statut, 'revenue');
  assert.equal(D.resultat(suivi, avecOctobre(1599), 'KV').statut, 'toujours_en_baisse');
  // Aucun mois complet après le mois de référence : pas encore de résultat.
  assert.equal(D.resultat(suivi, jeuCas1(), 'KV'), null);
  // Sans niveau enregistré, on le recalcule sur les 3 mois d'avant (avr.-juin de A = 2 000 €/mois).
  const sansNiveau = { ...suivi, avant_mensuel: null };
  assert.equal(D.resultat(sansNiveau, avecOctobre(1600), 'KV').statut, 'revenue');
  assert.equal(D.resultat(sansNiveau, avecOctobre(1600), 'KV').avantMensuel, 2000);
  assert.equal(D.resultat(sansNiveau, avecOctobre(1600), 'KV').depuisMensuel, 1600);
});

test('(6 bis) une ligne « revenue » quitte la liste ; « toujours en baisse » y reste, avec son resultat', () => {
  const suivis = [{ pharmacy_id: 'A', statut: 'appelee', mois_ref: '2026-09', avant_mensuel: 2000,
    geste_le: '2026-10-05T09:00:00+00:00' }];
  const base = [...jeuCas1(), vente('FOND-KV', '2026-10', 10000)];
  // A revient à 1 600 en octobre. Nouvelle fenêtre août-oct. contre mai-juil. :
  // avant 2 000 + 2 000 + 800 = 4 800, récent 800 + 800 + 1 600 = 3 200 → 33 % : la règle
  // la garderait, mais le résultat dit « revenue » → elle sort de la liste.
  const rev = D.calculer({ ventes: [...base, vente('A', '2026-10', 1600)], commercial: 'KV',
    aujourdhui: '2026-11-20', suivis });
  assert.ok(!pids(rev).includes('A'));
  assert.deepEqual(rev.revenues.map((x) => x.pid), ['A']);
  const bas = D.calculer({ ventes: [...base, vente('A', '2026-10', 900)], commercial: 'KV',
    aujourdhui: '2026-11-20', suivis });
  const a = bas.lignes.find((l) => l.pid === 'A');
  assert.equal(a.resultat.statut, 'toujours_en_baisse');
});

// ── (7) Parité avec le radar « Qui inviter » ────────────────────────────────
// `achats()` extrait du fichier livré — pas une copie — exactement comme
// tests/corps-rdv-radar-fenetre.mjs.
const SRC_RADAR = readFileSync(join(RACINE, 'crm', 'v2', 'v2-rdv-radar.js'), 'utf8');
function extraire(src, nom) {
  const i = src.indexOf(`function ${nom}(`);
  assert.ok(i > 0, `fonction ${nom} introuvable dans v2-rdv-radar.js`);
  let p = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) {
    if (src[j] === '{') p++;
    else if (src[j] === '}') { p--; if (p === 0) break; }
  }
  return src.slice(i, j + 1);
}
const CODE_ACHATS = extraire(SRC_RADAR, 'achats');
function radar(ventes, commercial) {
  const bac = { V2: { sales: ventes, user: { commercial } }, moi: () => commercial || '',
    nomMois: (k) => k, console };
  vm.createContext(bac);
  vm.runInContext(CODE_ACHATS, bac);
  const ach = vm.runInContext('achats()', bac);
  // Le critère du radar, recopié de noter() : ach.comparable && a.avant >= 500 && baisse >= 0.25.
  const garde = Object.keys(ach.par).filter((k) => {
    const a = ach.par[k];
    return ach.comparable && a.avant >= 500 && (a.avant - a.recent) / a.avant >= 0.25;
  });
  return { ach, garde: garde.sort() };
}

test('(7) parite : sur les memes ventes, le moteur rend les officines du radar', () => {
  const moisPSA = MOIS_2026.slice(0, 7);
  const cinq = MOIS_2026.slice(4);
  const ventes = [
    ...jeuCas1(), vente('FOND-KV', '2026-10', 500),                 // mois final incomplet
    ...fond('PSA', moisPSA), ...serie('S', MOIS_2026, 1000, 'KV'),   // officine partagée
    ...serie('S', moisPSA, 1000, 'PSA'),
    ...serie('T', ['2026-01', '2026-02', '2026-03', '2026-04'], 3000, 'PSA'),
    ...fond('MD', cinq), ...serie('U', cinq.slice(0, 2), 4000, 'MD'), // fichier trop court
    vente('P25', '2026-04', 400), vente('P25', '2026-05', 300), vente('P25', '2026-06', 300),
    ...serie('P25', RECENT, 250),
    vente('P249', '2026-04', 400), vente('P249', '2026-05', 300), vente('P249', '2026-06', 300),
    vente('P249', '2026-07', 251), vente('P249', '2026-08', 250), vente('P249', '2026-09', 250),
  ];
  let nonVides = 0;
  for (const c of ['KV', 'PSA', 'MD']) {
    const { ach, garde } = radar(ventes, c);
    const r = D.calculer({ ventes, commercial: c, aujourdhui: AUJ, reglages: { maxLignes: Infinity } });
    assert.equal(r.comparable, ach.comparable, `${c} : comparable diffère`);
    assert.deepEqual(pids(r).sort(), garde, `${c} : pas les mêmes officines que le radar`);
    for (const l of r.lignes) {
      assert.equal(l.avant, ach.par[l.pid].avant, `${c}/${l.pid} : montant d'avant différent`);
      assert.equal(l.recent, ach.par[l.pid].recent, `${c}/${l.pid} : montant récent différent`);
    }
    if (garde.length) nonVides++;
  }
  // Une parité sur des listes toutes vides ne prouverait rien.
  assert.equal(nonVides, 2, 'KV et PSA doivent avoir des baisses, MD aucune (fichier trop court)');
});

// ── (8) Un compteur à 0 se re-teste sur un cas qui doit rendre plus ─────────
test('(8) un vrai zero quand rien ne baisse, plusieurs lignes quand ca baisse', () => {
  const stable = [...fond(), ...serie('D', MOIS_2026, 1000), ...serie('G', MOIS_2026, 2500)];
  const zero = D.calculer({ ventes: stable, commercial: 'KV', aujourdhui: AUJ });
  assert.equal(zero.comparable, true, 'le zéro doit venir d un calcul fait, pas d un calcul impossible');
  assert.equal(zero.nbARappeler, 0);
  assert.deepEqual(zero.lignes, []);
  const plusieurs = D.calculer({ ventes: jeuCas1(), commercial: 'KV', aujourdhui: AUJ });
  assert.equal(plusieurs.nbARappeler, 3);
});
