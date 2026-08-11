import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-rdv-creneaux.js');

const D = M.DEFAUT_DISPO;
const PLAGES = [['09:00', '12:30'], ['14:00', '18:00']];
const NANTES = { lat: 47.2184, lon: -1.5536 };
const NANTES_10KM = { lat: 47.3084, lon: -1.5536 };   // ~10 km au nord
const ANGERS = { lat: 47.4784, lon: -0.5632 };        // ~80 km a vol d'oiseau

test('distance : Nantes vers Angers, majoree du coefficient route', () => {
  const km = M.distanceKm(NANTES, ANGERS, 1.3);
  assert.ok(km > 95 && km < 106, `attendu ~104 km, obtenu ${km}`);
});

test('distance : coordonnees manquantes donnent null', () => {
  assert.equal(M.distanceKm(NANTES, { lat: null, lon: null }, 1.3), null);
  assert.equal(M.distanceKm(null, ANGERS, 1.3), null);
});

test('grille : 45 min par pas de 15, sans deborder la plage', () => {
  // 09:00-10:30 : le dernier depart possible est 09:45, qui finit pile a 10:30.
  const g = M.grille([['09:00', '10:30']], 45);
  assert.deepEqual(g, [540, 555, 570, 585]);
});

test('journee vide : score 2, toute la grille est libre', () => {
  const j = M.jour('2026-08-18', [], NANTES, D, PLAGES);
  assert.equal(j.score, 2);
  assert.equal(j.creneaux.length, M.grille(PLAGES, D.duree_min).length);
});

test('officine a 10 km d un RDV pose : jour prioritaire, score 0', () => {
  const occ = [{ heure: '10:00', duree_min: 45, ...NANTES_10KM }];
  const j = M.jour('2026-08-18', occ, NANTES, D, PLAGES);
  assert.equal(j.score, 0);
  assert.equal(j.creneaux.length > 0, true);
});

test('officine a 10 km : le premier creneau propose est colle au voisin', () => {
  const occ = [{ heure: '10:00', duree_min: 45, ...NANTES_10KM }];
  const j = M.jour('2026-08-18', occ, NANTES, D, PLAGES);
  const premier = j.creneaux[0];
  assert.ok(Math.abs(premier - 600) <= 90, `attendu proche de 10:00, obtenu ${premier}`);
});

test('officine a 100 km d un RDV pose : jour ecarte', () => {
  const loin = { lat: 48.1113, lon: -1.6800 };          // Rennes, ~100 km
  const occ = [{ heure: '10:00', duree_min: 45, ...loin }];
  assert.equal(M.jour('2026-08-18', occ, NANTES, D, PLAGES), null);
});

test('creneau qui chevauche un RDV pose, trajet compris, est retire', () => {
  const occ = [{ heure: '10:00', duree_min: 45, ...NANTES_10KM }];
  const libres = M.libres(occ, NANTES, D, PLAGES);
  assert.equal(libres.includes(600), false, '10:00 doit etre pris');
  assert.equal(libres.includes(585), false, '09:45 empiete sur le trajet');
});

test('officine sans coordonnees : jamais ecartee', () => {
  const loin = { lat: 48.1113, lon: -1.6800 };
  const occ = [{ heure: '10:00', duree_min: 45, ...loin }];
  const j = M.jour('2026-08-18', occ, { lat: null, lon: null }, D, PLAGES);
  assert.notEqual(j, null);
  assert.equal(j.score, 2);
});

test('proposer : respecte le delai de 3 jours et l horizon de 21 jours', () => {
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  assert.ok(r.length > 0);
  r.forEach(j => {
    assert.ok(j.date >= '2026-08-13', `${j.date} est trop tot`);
    assert.ok(j.date <= '2026-08-31', `${j.date} depasse l horizon`);
  });
});

test('proposer : 3 jours max, 3 creneaux max, tries croissants', () => {
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  assert.ok(r.length <= 3);
  r.forEach(j => {
    assert.ok(j.creneaux.length <= 3);
    const copie = j.creneaux.slice().sort();
    assert.deepEqual(j.creneaux, copie);
  });
});

test('proposer : une journee vide balaie la journee, pas seulement le matin', () => {
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  const jour = r[0];
  assert.equal(jour.creneaux.length, 3);
  const apresMidi = jour.creneaux.filter(h => h >= '14:00').length;
  assert.ok(apresMidi >= 1, `aucun creneau l apres-midi : ${jour.creneaux.join(', ')}`);
  const matin = jour.creneaux.filter(h => h < '12:00').length;
  assert.ok(matin >= 1, `aucun creneau le matin : ${jour.creneaux.join(', ')}`);
});

test('proposer : le jour ou un voisin est deja pose est retenu', () => {
  const occ = [{ date: '2026-08-25', heure: '10:00', duree_min: 45, ...NANTES_10KM }];
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: occ, aujourdhui: '2026-08-10' });
  assert.equal(r.some(j => j.date === '2026-08-25'), true,
    'le jour ou un voisin est deja pose doit faire partie des trois retenus');
});

test('proposer : un jour bloque toute la journee disparait', () => {
  const bl = [{ date: '2026-08-13', moment: 'journee' }];
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: bl, occupes: [], aujourdhui: '2026-08-10' });
  assert.equal(r.some(j => j.date === '2026-08-13'), false);
});

test('proposer : un blocage du matin ne laisse que l apres-midi', () => {
  const bl = [{ date: '2026-08-13', moment: 'matin' }];
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: bl, occupes: [], aujourdhui: '2026-08-10' });
  const jour = r.find(j => j.date === '2026-08-13');
  assert.notEqual(jour, undefined);
  jour.creneaux.forEach(h => assert.ok(h >= '14:00', `${h} devrait etre l apres-midi`));
});

test('proposer : samedi et dimanche ne sont jamais proposes', () => {
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  r.forEach(j => {
    const d = new Date(j.date + 'T00:00:00Z').getUTCDay();
    assert.ok(d >= 1 && d <= 5, `${j.date} tombe un week-end`);
  });
});

test('proposer : agenda entierement bloque donne un tableau vide, pas une erreur', () => {
  const bl = [];
  for (let i = 0; i <= 25; i++) {
    const d = new Date(Date.UTC(2026, 7, 10));
    d.setUTCDate(d.getUTCDate() + i);
    bl.push({ date: d.toISOString().slice(0, 10), moment: 'journee' });
  }
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: bl, occupes: [], aujourdhui: '2026-08-10' });
  assert.deepEqual(r, []);
});

// ─── Agenda personnel du commercial ────────────────────────────────
// Une plage venue de son agenda ferme des heures. Elle ne doit JAMAIS
// orienter la zone géographique de la journée : elle n'a pas de lieu.

const lundiProchain = (() => {
  const d = new Date('2026-08-17T00:00:00Z');   // un lundi
  return d.toISOString().slice(0, 10);
})();
const veille = '2026-08-10';   // 7 jours avant : respecte delai_min_jours

test('une réunion de 10h à 11h retire ces heures et coupe la plage en deux', () => {
  const sans = M.proposer({ officine: NANTES, aujourdhui: veille });
  const avec = M.proposer({
    officine: NANTES, aujourdhui: veille,
    agenda: [{ date: lundiProchain, debut: '10:00', fin: '11:00' }]
  });
  const heures = (r) => (r.find(j => j.date === lundiProchain) || {}).creneaux || [];
  const hAvec = heures(avec);
  assert.ok(heures(sans).length > 0, 'le lundi doit être proposé sans agenda');
  // Un RDV de 45 min ne peut plus commencer entre 09:16 et 11:00.
  for (const h of hAvec) {
    const m = (+h.slice(0, 2)) * 60 + (+h.slice(3));
    assert.ok(m + 45 <= 600 || m >= 660,
      `créneau ${h} : chevauche la réunion 10:00-11:00`);
  }
});

test('une journée entière dans l’agenda écarte le jour', () => {
  const r = M.proposer({
    officine: NANTES, aujourdhui: veille,
    agenda: [{ date: lundiProchain, debut: '00:00', fin: '23:59' }]
  });
  assert.equal(r.find(j => j.date === lundiProchain), undefined);
});

test('l’agenda ne change PAS la note géographique de la journée', () => {
  // Sans aucun RDV posé, une journée vaut 2 (« encore vide »). Une plage
  // d'agenda ne doit pas la faire passer à 0 (« un voisin est déjà là ») :
  // sinon un déjeuner déciderait du secteur de la journée.
  const r = M.proposer({
    officine: NANTES, aujourdhui: veille,
    agenda: [{ date: lundiProchain, debut: '12:30', fin: '14:00' }]
  });
  const j = r.find(x => x.date === lundiProchain);
  assert.ok(j, 'le jour reste proposé');
  assert.notEqual(j.score, 0, 'une plage d’agenda ne doit pas jouer le rôle de voisin');
});

test('une plage d’agenda incohérente est ignorée, pas plantée', () => {
  const r = M.proposer({
    officine: NANTES, aujourdhui: veille,
    agenda: [{ date: lundiProchain, debut: '15:00', fin: '14:00' },
             { date: lundiProchain, debut: null, fin: '10:00' }]
  });
  assert.ok(r.find(j => j.date === lundiProchain), 'le jour reste proposé');
});
