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

test('proposer : respecte le delai de 3 jours et l horizon de 180 jours', () => {
  const r = M.proposer({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  assert.ok(r.length > 0);
  r.forEach(j => {
    assert.ok(j.date >= '2026-08-13', `${j.date} est trop tot`);
    assert.ok(j.date <= '2027-02-06', `${j.date} depasse l horizon`);
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
  // Tout l'horizon, pas seulement trois semaines : depuis le 13/08/2026 il
  // couvre 180 jours. Bloquer moins laissait des dates libres derriere, et
  // le test passait pour une mauvaise raison.
  for (let i = 0; i <= 185; i++) {
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

// ─── Point de départ du commercial ─────────────────────────────────
// Sans lui, une journée vide proposait 9h à Brest à quelqu'un qui part
// de Nantes. Le trajet doit exister dans le calcul, pas seulement sur la route.

const NANTES_DEPART = { lat: 47.2184, lon: -1.5536 };
const BREST = { lat: 48.3904, lon: -4.4861 };      // ~300 km
const CHOLET = { lat: 47.0594, lon: -0.8797 };     // ~60 km

test('sans point de départ, rien ne change (aucun créneau écarté)', () => {
  const a = M.libres([], BREST, {}, PLAGES);
  const b = M.libres([], BREST, { depart: null }, PLAGES);
  assert.deepEqual(a, b);
  assert.ok(a.includes(9 * 60), '9h reste proposé quand on ne sait pas d’où il part');
});

test('avec un départ de Nantes, Brest n’est plus proposé à 9h', () => {
  const l = M.libres([], BREST, { depart: NANTES_DEPART }, PLAGES);
  assert.ok(!l.includes(9 * 60), '9h à Brest en partant de Nantes : impossible');
});

test('une officine à 60 km reste réservable, mais plus à l’ouverture', () => {
  const l = M.libres([], CHOLET, { depart: NANTES_DEPART }, PLAGES);
  assert.ok(l.length > 0, 'Cholet reste atteignable dans la journée');
  assert.ok(!l.includes(9 * 60), 'pas à 9h pile : il y a une heure de route');
  const premier = Math.min(...l);
  assert.ok(premier > 9 * 60, `le premier créneau (${premier}) est après l’ouverture`);
});

test('il doit aussi pouvoir rentrer : plus de créneau collé à la fermeture', () => {
  const l = M.libres([], CHOLET, { depart: NANTES_DEPART }, PLAGES);
  const dernier = Math.max(...l);
  assert.ok(dernier + 45 < 18 * 60, 'le dernier RDV finit avant 18h, route de retour comprise');
});

test('un RDV déjà posé le matin lève la contrainte de départ', () => {
  // Il est déjà sorti de chez lui : c'est le chaînage entre RDV qui décide,
  // plus la distance depuis son domicile.
  const avec = M.libres([{ heure: '09:00', duree_min: 45, ...CHOLET }],
                        CHOLET, { depart: NANTES_DEPART }, PLAGES);
  assert.ok(avec.includes(10 * 60), '10h reste possible juste après le RDV de 9h');
});

test('une officine hors de portée sur la journée disparaît complètement', () => {
  const loin = { lat: 43.6047, lon: 1.4442 };   // Toulouse, ~560 km
  const j = M.jour('2026-08-17', [], loin, { depart: NANTES_DEPART },
                   [['09:00', '12:30'], ['14:00', '18:00']]);
  assert.equal(j, null, 'aucune journée ne tient : le jour est écarté');
});

// ─── « Voir d'autres dates » : le calendrier sur trois mois ──────────
// proposer() met en avant TROIS dates, choisies pour la tournée. calendrier()
// déroule tout l'horizon, dans l'ordre des dates, pour l'officine qui doit se
// projeter plus loin. Les mêmes règles s'y appliquent : c'est le point à ne
// jamais perdre de vue — une date affichée ici doit rester tenable.

test('calendrier : rend beaucoup plus de dates que proposer, dans l ordre', () => {
  const c = M.calendrier({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  assert.ok(c.length > 20, `seulement ${c.length} dates`);
  const dates = c.map(j => j.date);
  assert.deepEqual(dates.slice(), dates.slice().sort(), 'les dates ne sont pas croissantes');
  assert.ok(dates[0] >= '2026-08-13', 'le delai minimum de 3 jours n est pas respecte');
});

test('calendrier : ne depasse pas l horizon de 180 jours', () => {
  const c = M.calendrier({ officine: NANTES, dispo: D, blocages: [], occupes: [], aujourdhui: '2026-08-10' });
  c.forEach(j => assert.ok(j.date <= '2027-02-06', `${j.date} depasse l horizon`));
});

test('calendrier : respecte les demi-journees bloquees', () => {
  const bl = [{ date: '2026-08-17', moment: 'journee' }];
  const c = M.calendrier({ officine: NANTES, dispo: D, blocages: bl, occupes: [], aujourdhui: '2026-08-10' });
  assert.ok(!c.some(j => j.date === '2026-08-17'), 'un jour bloque est propose');
});

test('calendrier : agenda entierement bloque rend un tableau vide', () => {
  const bl = [];
  for (let i = 0; i <= 185; i++) {
    const d = new Date(Date.UTC(2026, 7, 10));
    d.setUTCDate(d.getUTCDate() + i);
    bl.push({ date: d.toISOString().slice(0, 10), moment: 'journee' });
  }
  const c = M.calendrier({ officine: NANTES, dispo: D, blocages: bl, occupes: [], aujourdhui: '2026-08-10' });
  assert.deepEqual(c, []);
});

test('calendrier : plafonne le nombre de dates rendues', () => {
  const c = M.calendrier({ officine: NANTES, dispo: D, blocages: [], occupes: [],
                           aujourdhui: '2026-08-10', max_jours: 5 });
  assert.equal(c.length, 5);
});

// ═══════════════════════════════════════════════════════════════════
//  19/08/2026 — le secteur du jour
//  « Je dois pouvoir choisir aussi par jour vers quel département je serai
//    sur mon planning, que ça puisse adapter la géolocalisation. » (Will)
// ═══════════════════════════════════════════════════════════════════

test('departement : code postal metropolitain', () => {
  assert.equal(M.departement('44000'), '44');
  assert.equal(M.departement('49100'), '49');
  assert.equal(M.departement('01000'), '01');
  assert.equal(M.departement(' 35 700 '), '35');
});

test('departement : Corse et outre-mer', () => {
  // Le code postal corse porte « 20 » ; « 2A » et « 2B » s y ramenent.
  assert.equal(M.departement('20000'), '20');
  assert.equal(M.departement('2A'), '20');
  assert.equal(M.departement('2B'), '20');
  assert.equal(M.departement('97400'), '974');
  assert.equal(M.departement('98800'), '988');
});

test('departement : rien d exploitable rend une chaine vide', () => {
  ['', null, undefined, '4', '  '].forEach(v =>
    assert.equal(M.departement(v), '', JSON.stringify(v)));
});

const SECT = [{ date: '2026-09-01', departements: ['44', '49'] }];

test('un jour declare n accepte que ses departements', () => {
  assert.equal(M.secteurOk('2026-09-01', { cp: '44000' }, SECT), true);
  assert.equal(M.secteurOk('2026-09-01', { cp: '49100' }, SECT), true);
  assert.equal(M.secteurOk('2026-09-01', { cp: '61000' }, SECT), false);
});

test('PRUDENCE 1 : un jour non declare n a aucune contrainte', () => {
  // Declarer un mardi ne doit pas fermer les lundis : sinon une seule
  // declaration viderait six mois d agenda sans que personne comprenne.
  assert.equal(M.secteurOk('2026-09-02', { cp: '61000' }, SECT), true);
  assert.equal(M.secteurOk('2026-09-01', { cp: '61000' }, []), true);
  assert.equal(M.secteurOk('2026-09-01', { cp: '61000' }, null), true);
});

test('PRUDENCE 2 : une declaration vide ne ferme rien', () => {
  const vide = [{ date: '2026-09-01', departements: [] }];
  assert.equal(M.secteurOk('2026-09-01', { cp: '61000' }, vide), true);
  const nulle = [{ date: '2026-09-01', departements: null }];
  assert.equal(M.secteurOk('2026-09-01', { cp: '61000' }, nulle), true);
});

test('PRUDENCE 3 : un code postal inconnu passe', () => {
  // Dans le doute on garde. Un controle qui n aboutit pas ne condamne rien.
  assert.equal(M.secteurOk('2026-09-01', {}, SECT), true);
  assert.equal(M.secteurOk('2026-09-01', { cp: '' }, SECT), true);
  assert.equal(M.secteurOk('2026-09-01', { cp: null }, SECT), true);
});

test('le secteur ecarte la journee AVANT de regarder les heures', () => {
  const base = {
    dispo: { jours: { '1': [['09:00', '12:30'], ['14:00', '18:00']],
                      '2': [['09:00', '12:30'], ['14:00', '18:00']],
                      '3': [['09:00', '12:30'], ['14:00', '18:00']],
                      '4': [['09:00', '12:30'], ['14:00', '18:00']],
                      '5': [['09:00', '12:30'], ['14:00', '18:00']] },
             duree_min: 45, delai_min_jours: 1, horizon_jours: 30 },
    officine: { cp: '61000', lat: 48.4, lon: 0.09 },
    aujourdhui: '2026-08-31'
  };
  const sans = M.proposer(base);
  assert.ok(sans.length > 0, 'sans declaration, des dates sortent');

  // On declare TOUS les jours de l horizon sur le 44 : plus une seule date
  // ne peut convenir a une officine du 61.
  const secteurs = [];
  for (let i = 0; i <= 31; i++) {
    const d = new Date(Date.UTC(2026, 7, 31));
    d.setUTCDate(d.getUTCDate() + i);
    secteurs.push({ date: d.toISOString().slice(0, 10), departements: ['44'] });
  }
  assert.equal(M.proposer({ ...base, secteurs }).length, 0);
  // La meme officine, mais dans le 44 : tout redevient possible.
  assert.ok(M.proposer({ ...base, officine: { cp: '44000' }, secteurs }).length > 0);
});

test('« Voir d autres dates » applique la MEME regle', () => {
  // Sans ca, le pharmacien voit trois dates coherentes puis, d un clic, cent
  // trente dates qui ne le sont plus.
  const base = {
    dispo: { jours: { '1': [['09:00', '12:30']], '2': [['09:00', '12:30']],
                      '3': [['09:00', '12:30']], '4': [['09:00', '12:30']],
                      '5': [['09:00', '12:30']] },
             duree_min: 45, delai_min_jours: 1, horizon_jours: 20 },
    officine: { cp: '61000' }, aujourdhui: '2026-08-31'
  };
  assert.ok(M.calendrier(base).length > 0);
  const secteurs = [];
  for (let i = 0; i <= 21; i++) {
    const d = new Date(Date.UTC(2026, 7, 31));
    d.setUTCDate(d.getUTCDate() + i);
    secteurs.push({ date: d.toISOString().slice(0, 10), departements: ['44'] });
  }
  assert.equal(M.calendrier({ ...base, secteurs }).length, 0);
});
