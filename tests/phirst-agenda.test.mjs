// Agenda de Phirst : créneaux et rendez-vous (phirst/v2/phirst-pur.js). Porté des tests de la V1
// (~/phirst-studio/lib/creneaux.test.ts et lib/rdv.test.ts) sans changer une règle, + les vérifications d'écriture et le journal.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const P = createRequire(import.meta.url)('../phirst/v2/phirst-pur.js')

const laBaule = { lat: 47.2863, lon: -2.393 }
const guerande = { lat: 47.3281, lon: -2.4289 }
const vannes = { lat: 47.6587, lon: -2.7603 }
const rennes = { lat: 48.1173, lon: -1.6778 }
const avant = '2026-10-26T07:00'
const dernier = (t) => t[t.length - 1]

describe('le trajet estimé', () => {
  test('70 km/h à vol d’oiseau + 15 min, arrondi aux 5 minutes', () => {
    assert.equal(P.trajetMin(laBaule, laBaule), 15)
    assert.equal(P.trajetMin(laBaule, guerande), 20)
    const v = P.trajetMin(laBaule, vannes)
    assert.ok(v >= 55 && v <= 65)
  })
  test('les réglages de Yann : base, plages, durée, pas', () => {
    const r = P.REGLAGES_AGENDA
    assert.equal(r.base.commune, 'La Baule-Escoublac')
    assert.deepEqual(r.plages, [{ debut: '08:30', fin: '12:30' }, { debut: '14:00', fin: '18:00' }])
    assert.equal(r.dureeMin, 60); assert.equal(r.pasMin, 30)
  })
})

describe('les créneaux libres d’un jour', () => {
  test('jours ouvrés seulement, 8 h 30-12 h 30 et 14 h-18 h, rendez-vous d’une heure', () => {
    assert.deepEqual(P.creneauxLibres({ jour: '2026-10-31', occupations: [], cible: null, maintenant: avant }), [])
    assert.deepEqual(P.creneauxLibres({ jour: '2026-11-01', occupations: [], cible: null, maintenant: avant }), [])
    const l = P.creneauxLibres({ jour: '2026-10-27', occupations: [], cible: null, maintenant: avant })
    const heures = l.map((c) => c.debut.slice(11))
    assert.equal(heures[0], '08:30')
    assert.ok(heures.includes('11:30'))
    assert.ok(!heures.includes('12:00'))
    assert.ok(!heures.includes('13:30'))
    assert.equal(dernier(heures), '17:00')
  })
  test('laisse le temps d’arriver depuis La Baule le matin', () => {
    const l = P.creneauxLibres({ jour: '2026-10-27', occupations: [], cible: rennes, maintenant: avant })
    const t = P.trajetMin(laBaule, rennes)
    const [h, m] = l[0].debut.slice(11).split(':').map(Number)
    assert.ok(h * 60 + m >= 8 * 60 + 30 + t)
    assert.equal(l[0].depuis, 'La Baule-Escoublac'); assert.equal(l[0].trajetAvant, t)
  })
  test('aucun créneau ne chevauche ce qui est prévu, trajet compris', () => {
    const occ = [{ debut: '2026-10-27T10:00', fin: '2026-10-27T11:00', commune: 'Vannes', ...vannes }]
    const l = P.creneauxLibres({ jour: '2026-10-27', occupations: occ, cible: rennes, maintenant: avant })
    const t = P.trajetMin(vannes, rennes)
    for (const c of l) {
      const debut = Number(c.debut.slice(11, 13)) * 60 + Number(c.debut.slice(14))
      assert.ok(debut + 60 + t <= 10 * 60 || debut >= 11 * 60 + t, c.debut)
    }
    assert.equal(l.find((c) => c.debut > '2026-10-27T11').depuis, 'Vannes')
  })
  test('lieu inconnu : 20 minutes de marge de chaque côté', () => {
    const occ = [{ debut: '2026-10-27T10:00', fin: '2026-10-27T11:00' }]
    const heures = P.creneauxLibres({ jour: '2026-10-27', occupations: occ, cible: null, maintenant: avant }).map((c) => c.debut.slice(11))
    assert.ok(heures.includes('08:30')); assert.ok(!heures.includes('09:00'))
    assert.ok(!heures.includes('11:00')); assert.ok(heures.includes('11:30'))
  })
  test('aujourd’hui, laisse le temps de rouler depuis maintenant', () => {
    const l = P.creneauxLibres({ jour: '2026-10-27', occupations: [], cible: rennes, maintenant: '2026-10-27T13:55' })
    const t = P.trajetMin(laBaule, rennes)
    const [h, m] = l[0].debut.slice(11).split(':').map(Number)
    assert.ok(h * 60 + m >= 13 * 60 + 55 + t)
  })
  test('écarte ce qui est déjà passé', () => {
    const heures = P.creneauxLibres({ jour: '2026-10-27', occupations: [], cible: null, maintenant: '2026-10-27T15:10' }).map((c) => c.debut.slice(11))
    assert.deepEqual(heures, ['15:30', '16:00', '16:30', '17:00'])
  })
})

describe('les trois meilleurs créneaux', () => {
  test('un par jour, le jour où Yann est déjà dans le secteur en tête', () => {
    const jours = P.joursOuvres('2026-10-27', 5)
    assert.deepEqual(jours, ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02'])
    const occ = [{ debut: '2026-10-29T10:00', fin: '2026-10-29T11:00', commune: 'Vannes', ...vannes }]
    const l = P.meilleursCreneaux({ jours, occupations: occ, cible: { lat: 47.67, lon: -2.75 }, maintenant: avant })
    assert.equal(l.length, 3)
    assert.equal(l[0].dansLeSecteur, true)
    assert.equal(l[0].debut.slice(0, 10), '2026-10-29')
    assert.equal(new Set(l.map((c) => c.debut.slice(0, 10))).size, 3)
    assert.ok(l[1].debut < l[2].debut)
  })
  test('dans le jour du secteur, colle au rendez-vous déjà prévu (le moins de route)', () => {
    const occ = [{ debut: '2026-10-29T10:00', fin: '2026-10-29T11:00', commune: 'Vannes', ...vannes }]
    const [c] = P.meilleursCreneaux({ jours: ['2026-10-29'], occupations: occ, cible: { lat: 47.67, lon: -2.75 }, maintenant: avant })
    assert.ok(c.depuis === 'Vannes' || c.vers === 'Vannes')
    assert.ok((c.trajetAvant || 0) + (c.trajetApres || 0) < P.trajetMin(laBaule, vannes) + 20)
  })
})

// ── rendez-vous ──
const YANN = '11111111-1111-4111-8111-111111111111'
const TELE = '22222222-2222-4222-8222-222222222222'
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const R1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const R2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const estTelepro = (id) => id === TELE
let n = 0
function ev(quoi, extra = {}, o = {}) {
  n++
  return {
    id: `ligne-${String(n).padStart(3, '0')}`, prospect_id: o.fiche ?? P1, author_id: o.par ?? YANN,
    created_at: o.le ?? `2026-10-26T09:${String(n).padStart(2, '0')}:00Z`,
    body: JSON.stringify({ v: 1, rdv: o.rdv ?? R1, quoi, pour: 'yann', prisPar: o.par ?? YANN, ...extra })
  }
}

describe('un rendez-vous se calcule en rejouant ses événements', () => {
  test('pris par la télépro : à confirmer ; confirmé par Yann ensuite', () => {
    const l = [ev('creer', { debut: '2026-11-03T14:00', lieu: 'Vannes' }, { par: TELE })]
    const r = P.etatsDesRdv(l, estTelepro)[0]
    assert.equal(r.statut, 'propose'); assert.equal(r.prisParTelepro, true); assert.equal(r.fin, '2026-11-03T15:00')
    l.push(ev('confirmer'))
    assert.equal(P.etatsDesRdv(l, estTelepro)[0].statut, 'confirme')
  })
  test('pris par Yann : confirmé d’emblée', () => {
    const r = P.etatsDesRdv([ev('creer', { debut: '2026-11-03T09:00', duree_min: 90 })], estTelepro)[0]
    assert.equal(r.statut, 'confirme'); assert.equal(r.fin, '2026-11-03T10:30')
  })
  test('déplacé par la télépro : à reconfirmer ; par Yann : confirmé', () => {
    const l = [ev('creer', { debut: '2026-11-03T14:00' })]
    l.push(ev('deplacer', { debut: '2026-11-05T10:00' }, { par: TELE }))
    let r = P.etatsDesRdv(l, estTelepro)[0]
    assert.equal(r.statut, 'reporte'); assert.equal(r.debut, '2026-11-05T10:00')
    l.push(ev('deplacer', { debut: '2026-11-06T16:00' }))
    r = P.etatsDesRdv(l, estTelepro)[0]
    assert.equal(r.statut, 'confirme'); assert.equal(r.debut, '2026-11-06T16:00'); assert.equal(r.fin, '2026-11-06T17:00')
  })
  test('annulé ou fait : les gestes suivants sont ignorés', () => {
    const l = [ev('creer', { debut: '2026-11-03T14:00' }), ev('annuler'), ev('deplacer', { debut: '2026-11-09T10:00' }), ev('confirmer')]
    const r = P.etatsDesRdv(l, estTelepro)[0]
    assert.equal(r.statut, 'annule'); assert.equal(r.debut, '2026-11-03T14:00')
  })
  test('rejoue dans l’ordre d’écriture, même si les lignes arrivent dans le désordre', () => {
    const a = ev('creer', { debut: '2026-11-03T14:00' }, { le: '2026-10-26T08:00:00Z' })
    const b = ev('deplacer', { debut: '2026-11-04T09:00' }, { le: '2026-10-26T08:05:00Z' })
    const c = ev('deplacer', { debut: '2026-11-05T09:00' }, { le: '2026-10-26T08:10:00Z' })
    assert.equal(P.etatsDesRdv([c, a, b], estTelepro)[0].debut, '2026-11-05T09:00')
  })
  test('ignore un geste sans création, une autre fiche, un JSON abîmé', () => {
    const l = [ev('confirmer', {}, { rdv: R2 }), ev('creer', { debut: '2026-11-03T14:00' }), ev('annuler', {}, { fiche: P2 }), { ...ev('annuler'), body: '{pas du json' }]
    const r = P.etatsDesRdv(l, estTelepro)
    assert.equal(r.length, 1); assert.equal(r[0].statut, 'confirme')
  })
  test('refuse une heure sans le format « AAAA-MM-JJTHH:MM »', () => {
    const corps = (debut) => JSON.stringify({ v: 1, rdv: R1, quoi: 'creer', debut, prisPar: YANN })
    assert.notEqual(P.lireRdv(corps('2026-11-03T14:00')), null)
    assert.equal(P.lireRdv(corps('2026-11-03T14:00:00Z')), null)
    assert.equal(P.lireRdv(corps('mardi 14 h')), null)
  })
})

describe('écritures simultanées : rien ne se perd', () => {
  test('deux rendez-vous écrits à la même seconde sur la même heure : les deux restent, signalés', () => {
    const le = '2026-10-26T10:00:00Z'
    const l = [ev('creer', { debut: '2026-11-03T14:00' }, { rdv: R1, par: TELE, le }), ev('creer', { debut: '2026-11-03T14:30' }, { rdv: R2, fiche: P2, le })]
    const r = P.etatsDesRdv(l, estTelepro)
    assert.equal(r.length, 2)
    assert.deepEqual(Object.keys(P.chevauchements(r)).sort(), [R1, R2].sort())
  })
  test('Yann confirme pendant que la télépro déplace : mêmes résultats quel que soit l’ordre d’arrivée', () => {
    const creer = ev('creer', { debut: '2026-11-03T14:00' }, { par: TELE, le: '2026-10-26T08:00:00Z' })
    const le = '2026-10-26T10:00:00Z'
    const confirmer = { ...ev('confirmer', {}, { le }), id: 'ligne-z1' }
    const deplacer = { ...ev('deplacer', { debut: '2026-11-04T11:00' }, { par: TELE, le }), id: 'ligne-z2' }
    const r1 = P.etatsDesRdv([creer, confirmer, deplacer], estTelepro)[0]
    const r2 = P.etatsDesRdv([deplacer, creer, confirmer], estTelepro)[0]
    assert.deepEqual(r1, r2)
    assert.equal(r1.debut, '2026-11-04T11:00'); assert.equal(r1.statut, 'reporte')
  })
  test('une double création du même rendez-vous ne l’écrase pas : la première fait foi', () => {
    const l = [ev('creer', { debut: '2026-11-03T14:00' }), ev('creer', { debut: '2026-11-09T09:00' })]
    assert.equal(P.etatsDesRdv(l, estTelepro)[0].debut, '2026-11-03T14:00')
  })
  test('un rendez-vous annulé ne compte plus dans les chevauchements', () => {
    const l = [ev('creer', { debut: '2026-11-03T14:00' }, { rdv: R1 }), ev('creer', { debut: '2026-11-03T14:00' }, { rdv: R2, fiche: P2 }), ev('annuler', {}, { rdv: R2, fiche: P2 })]
    assert.equal(Object.keys(P.chevauchements(P.etatsDesRdv(l, estTelepro))).length, 0)
  })
})

describe('qui peut faire quoi', () => {
  const propose = P.etatsDesRdv([ev('creer', { debut: '2026-11-03T14:00' }, { par: TELE })], estTelepro)[0]
  test('seul Yann confirme et dit « c’est fait »', () => {
    assert.equal(P.gestePermis(propose, 'confirmer', 'patron'), true)
    assert.equal(P.gestePermis(propose, 'confirmer', 'telepro'), false)
    assert.equal(P.gestePermis(propose, 'fait', 'telepro'), false)
    assert.equal(P.gestePermis(propose, 'deplacer', 'telepro'), true)
    assert.equal(P.gestePermis(propose, 'annuler', 'telepro'), true)
  })
  test('un rendez-vous de relevé ou de chantier ne se montre pas à la télépro', () => {
    const deYann = { ...propose, prisParTelepro: false }
    assert.equal(P.rdvDeLaTelepro(deYann, 'a_rappeler'), true)
    assert.equal(P.rdvDeLaTelepro(deYann, 'releve_etude'), false)
    assert.equal(P.rdvDeLaTelepro(deYann, 'signe'), false)
    assert.equal(P.rdvDeLaTelepro(propose, 'devis_envoye'), true)
  })
})

// ── ce que la V2 ajoute : vérifications d'écriture, textes, journal ──
describe('avant d’écrire : heure passée, créneau déjà pris (mêmes messages que la V1)', () => {
  const rdvs = P.etatsDesRdv([ev('creer', { debut: '2026-11-26T10:00' }, { rdv: R1 })], estTelepro)
  test('heure illisible ou déjà passée', () => {
    assert.equal(P.heureValide('jeudi', '2026-11-21T09:00'), 'Heure du rendez-vous illisible.')
    assert.equal(P.heureValide('2026-11-20T10:00', '2026-11-21T09:00'), 'Cette heure est déjà passée.')
    assert.equal(P.heureValide('2026-11-21T09:00', '2026-11-21T09:00'), null)
  })
  test('créneau déjà pris : chevauchement, bords libres, « sauf » le rendez-vous qu’on déplace', () => {
    assert.equal(P.dejaPris(rdvs, '2026-11-26T10:30', 60), true)
    assert.equal(P.dejaPris(rdvs, '2026-11-26T09:30', 60), true)
    assert.equal(P.dejaPris(rdvs, '2026-11-26T11:00', 60), false)
    assert.equal(P.dejaPris(rdvs, '2026-11-26T09:00', 60), false)
    assert.equal(P.dejaPris(rdvs, '2026-11-26T10:00', 60, R1), false)
    assert.match(P.MSG_PRIS, /Yann a déjà un rendez-vous à cette heure-là/)
  })
  test('un rendez-vous annulé libère son créneau', () => {
    const l = [ev('creer', { debut: '2026-11-26T10:00' }, { rdv: R1 }), ev('annuler', {}, { rdv: R1 })]
    assert.equal(P.dejaPris(P.etatsDesRdv(l, estTelepro), '2026-11-26T10:00', 60), false)
  })
})

describe('textes et journal', () => {
  test('quandFr, heureFr, dureeFr', () => {
    assert.equal(P.quandFr('2026-11-26T10:00'), 'jeudi 26 novembre à 10 h')
    assert.equal(P.quandFr('2026-11-03T14:30'), 'mardi 3 novembre à 14 h 30')
    assert.equal(P.dureeFr(45), '45 min'); assert.equal(P.dureeFr(135), '2 h 15')
  })
  test('maintenantParis : format AAAA-MM-JJTHH:MM à l’heure de Paris', () => {
    assert.equal(P.maintenantParis(new Date('2026-11-21T22:30:00Z')), '2026-11-21T23:30')
    assert.equal(P.maintenantParis(new Date('2026-07-01T22:30:00Z')), '2026-07-02T00:30')
  })
  test('le journal lit une ligne rdv en clair, jamais en JSON brut', () => {
    const c = (quoi, extra) => ev(quoi, extra).body
    assert.equal(P.phraseJournal('rdv', c('creer', { debut: '2026-11-26T10:00' })), 'Rendez-vous posé pour le jeudi 26 novembre à 10 h')
    assert.equal(P.phraseJournal('rdv', c('deplacer', { debut: '2026-11-27T14:30' })), 'Rendez-vous déplacé au vendredi 27 novembre à 14 h 30')
    assert.equal(P.phraseJournal('rdv', c('annuler')), 'Rendez-vous annulé')
    assert.equal(P.phraseJournal('rdv', c('fait')), 'Rendez-vous fait')
    assert.equal(P.phraseJournal('rdv', c('confirmer')), 'Rendez-vous confirmé')
    assert.equal(P.phraseJournal('rdv', '{pas du json'), 'Rendez-vous')
    assert.doesNotMatch(P.phraseJournal('rdv', c('creer', { debut: '2026-11-26T10:00' })), /[{}]/)
  })
  test('lieu : nom + adresse + ville, sans doublon, 120 caractères au plus', () => {
    assert.equal(P.lieuPharmacie({ nom: 'Pharmacie du Port', ville: 'Vannes' }), 'Pharmacie du Port, Vannes')
    assert.equal(P.lieuPharmacie({ nom: 'Pharmacie du Port', adresse: '4 quai Sud', ville: 'Vannes' }), 'Pharmacie du Port, 4 quai Sud, Vannes')
    assert.equal(P.lieuPharmacie({ nom: 'A'.repeat(200), ville: 'Vannes' }).length, 120)
  })
  test('corpsRdv : le format de la V1, à l’identique', () => {
    const o = JSON.parse(P.corpsRdv('creer', R1, YANN, { debut: '2026-11-26T10:00', duree_min: 60, lieu: 'X', objet: 'Premier rendez-vous' }))
    assert.deepEqual(o, { v: 1, rdv: R1, quoi: 'creer', debut: '2026-11-26T10:00', duree_min: 60, lieu: 'X', objet: 'Premier rendez-vous', pour: 'yann', prisPar: YANN })
    assert.notEqual(P.lireRdv(JSON.stringify(o)), null)
  })
})

describe('la journée de l’agenda', () => {
  const fiches = [{ id: P1, nom: 'Pharmacie du Port', ville: 'Vannes', ...vannes }, { id: P2, nom: 'Pharmacie Centrale', ville: 'Rennes', ...rennes }]
  const rdvs = P.etatsDesRdv([
    ev('creer', { debut: '2026-11-26T10:00', objet: 'Premier rendez-vous' }, { rdv: R1 }),
    ev('creer', { debut: '2026-11-26T14:00' }, { rdv: R2, fiche: P2 })
  ], estTelepro)
  const els = P.lierRdv(rdvs, fiches)
  test('six puces : aujourd’hui même un samedi, puis les jours ouvrés', () => {
    assert.deepEqual(P.fenetreJours('2026-11-21', '2026-11-21'), ['2026-11-21', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'])
    assert.equal(P.fenetreJours('2026-12-10', '2026-11-21')[0], '2026-12-10')
    assert.equal(P.decalages(P.fenetreJours('2026-11-21', '2026-11-21'), '2026-11-21').montrerAujourdhui, false)
  })
  test('nombre de rendez-vous par jour, sans les annulés', () => {
    const c = P.comptesParJour(els, ['2026-11-25', '2026-11-26'])
    assert.deepEqual(c, { '2026-11-25': 0, '2026-11-26': 2 })
    assert.equal(P.sousPuce('2026-11-25', '2026-11-21', 0), 'rien')
    assert.equal(P.sousPuce('2026-11-26', '2026-11-21', 2), '2 rendez-vous')
    assert.equal(P.sousPuce('2026-11-21', '2026-11-21', 0), 'aujourd’hui')
  })
  test('carte « Ensuite » : le premier rendez-vous pas fini, avec la route', () => {
    const c = P.carteEnsuite({ elements: els, jour: '2026-11-26', aujourdhui: '2026-11-26', maintenant: '2026-11-26T10:30', libres: 3 })
    assert.equal(c.maint, 'Ensuite'); assert.equal(c.titre, '10 h · Vannes')
    assert.match(c.detail, /Pharmacie du Port · Premier rendez-vous\. Environ .* de route depuis La Baule-Escoublac\./)
    const apres = P.carteEnsuite({ elements: els, jour: '2026-11-26', aujourdhui: '2026-11-26', maintenant: '2026-11-26T11:30', libres: 3 })
    assert.equal(apres.titre, '14 h · Rennes'); assert.match(apres.detail, /depuis Vannes/)
    const vide = P.carteEnsuite({ elements: els, jour: '2026-11-25', aujourdhui: '2026-11-21', maintenant: '2026-11-21T09:00', libres: 14 })
    assert.equal(vide.titre, 'Rien de prévu'); assert.equal(vide.detail, '14 créneaux d’une heure libres.')
  })
  test('plages libres réunies', () => {
    const l = P.creneauxLibres({ jour: '2026-11-25', occupations: [], cible: null, maintenant: '2026-11-21T09:00' })
    assert.deepEqual(P.plagesLibres(l), ['de 8 h 30 à 12 h 30', 'de 14 h à 18 h'])
    assert.equal(P.phraseEtat(P.duJour(els, '2026-11-26'), 2), 'Vous êtes à Vannes · 2 créneaux d’une heure libres')
    assert.equal(P.phraseEtat([], 0), 'Rien de prévu')
    // la téléprospectrice lit l'agenda de Yann : jamais « Vous êtes à … » chez elle (21/11/2026)
    assert.equal(P.phraseEtat(P.duJour(els, '2026-11-26'), 2, true), 'Yann est à Vannes · 2 créneaux d’une heure libres')
    assert.equal(P.phraseEtat([], 0, true), 'Rien de prévu')
  })
  test('deux rendez-vous qui se chevauchent sont signalés', () => {
    const r = P.etatsDesRdv([ev('creer', { debut: '2026-11-26T10:00' }, { rdv: R1 }), ev('creer', { debut: '2026-11-26T10:30' }, { rdv: R2, fiche: P2 })], estTelepro)
    assert.deepEqual(P.lierRdv(r, fiches).map((e) => e.chevauche), [true, true])
    assert.deepEqual(els.map((e) => e.chevauche), [false, false])
  })
})
