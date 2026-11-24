// Phirst · lot L3 · idée 6 « La veille du rendez-vous » : logique pure (phirst/v2/phirst-preparer-pur.js).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const R = createRequire(import.meta.url)('../phirst/v2/phirst-preparer-pur.js')
const P = createRequire(import.meta.url)('../phirst/v2/phirst-pur.js')
const D = createRequire(import.meta.url)('../phirst/v2/phirst-dossiers-pur.js')

const AUJ = '2026-11-24' // mardi
const rdv = (o = {}) => ({ id: 'r1', prospect_id: 'f1', debut: '2026-11-25T09:30', fin: '2026-11-25T11:00', duree_min: 90, statut: 'confirme', objet: 'Robot Riedl · d’ici mai 2027', lieu: '', prisParTelepro: true, creePar: 'u1', creeLe: '2026-11-23T10:00:00+00:00', passation: '', ...o })
const fiche = (o = {}) => ({ id: 'f1', nom: 'Pharmacie du Test Un', ville: 'Lamballe', cp: '22400', lat: 48.47, lon: -2.52, ...o })
const el = (r, f) => ({ rdv: r, fiche: f, chevauche: false, aConfirmer: false })

describe('quels rendez-vous ont leur page', () => {
  test('le jour de veille est demain, ou lundi depuis le vendredi et le week-end', () => {
    assert.equal(R.jourDeVeille('2026-11-24'), '2026-11-25'); assert.equal(R.jourDeVeille('2026-11-27'), '2026-11-30'); assert.equal(R.jourDeVeille('2026-11-29'), '2026-11-30')
  })
  test('seul un rendez-vous confirmé d’aujourd’hui ou de demain a sa page', () => {
    assert.equal(R.pageDisponible(rdv(), AUJ), true)
    assert.equal(R.pageDisponible(rdv({ statut: 'propose' }), AUJ), false)
    assert.equal(R.pageDisponible(rdv({ statut: 'reporte' }), AUJ), false)
    assert.equal(R.pageDisponible(rdv({ statut: 'annule' }), AUJ), false)
    assert.equal(R.pageDisponible(rdv({ statut: 'fait' }), AUJ), false)
    assert.equal(R.pageDisponible(rdv({ debut: '2026-11-26T10:00', fin: '2026-11-26T11:00' }), AUJ), false)
    assert.equal(R.pageDisponible(rdv({ debut: '2026-11-24T10:00', fin: '2026-11-24T11:00' }), AUJ), true)
  })
  test('« sa page se prépare » : à confirmer ou déplacé, pas encore passé', () => {
    assert.equal(R.pageEnAttente(rdv({ statut: 'propose', debut: '2026-11-26T10:00' }), AUJ), true)
    assert.equal(R.pageEnAttente(rdv({ statut: 'reporte' }), AUJ), true)
    assert.equal(R.pageEnAttente(rdv({ statut: 'confirme' }), AUJ), false)
    assert.equal(R.pageEnAttente(rdv({ statut: 'propose', debut: '2026-11-20T10:00' }), AUJ), false)
  })
  test('le bandeau compte les rendez-vous confirmés de demain, dans l’ordre', () => {
    const b = R.bandeau([el(rdv({ id: 'b', debut: '2026-11-25T14:00', fin: '2026-11-25T15:00' }), fiche({ ville: 'Loudéac' })), el(rdv(), fiche()), el(rdv({ id: 'c', statut: 'propose' }), fiche())], AUJ)
    assert.equal(b.n, 2); assert.equal(b.titre, 'Demain : 2 rendez-vous, leurs pages sont prêtes.')
    assert.deepEqual(b.boutons.map((x) => x.texte), ['9 h 30 · Lamballe', '14 h · Loudéac'])
    assert.match(b.sous, /mercredi 25 novembre/)
  })
  test('le bandeau : singulier, lundi depuis le vendredi, rien quand rien', () => {
    assert.equal(R.bandeau([el(rdv(), fiche())], AUJ).titre, 'Demain : 1 rendez-vous, sa page est prête.')
    assert.match(R.bandeau([el(rdv({ debut: '2026-11-30T10:00', fin: '2026-11-30T11:00' }), fiche())], '2026-11-27').titre, /^Lundi : 1 rendez-vous/)
    assert.equal(R.bandeau([], AUJ), null)
    assert.equal(R.bandeau([el(rdv({ statut: 'propose' }), fiche())], AUJ), null)
  })
})

describe('l’en-tête', () => {
  test('la durée est celle du rendez-vous (jamais écrite en dur)', () => {
    assert.equal(R.enTete(rdv(), fiche(), null).faits[1].v, '1 h 30')
    assert.equal(R.enTete(rdv({ duree_min: 45 }), fiche(), null).faits[1].v, '45 min')
  })
  test('jour et heure, lieu', () => {
    const e = R.enTete(rdv(), fiche(), null)
    assert.equal(e.faits[0].v, 'Mercredi 25 novembre · 9 h 30'); assert.equal(e.lieu, 'Lamballe (22400)'); assert.equal(e.nom, 'Pharmacie du Test Un')
  })
  test('la route part de la base de l’agenda, ou du rendez-vous d’avant le même jour', () => {
    const base = P.REGLAGES_AGENDA.base
    const r1 = R.route(rdv(), fiche(), [], base)
    assert.equal(r1.depuis, 'La Baule-Escoublac'); assert.equal(r1.minutes, P.trajetMin(base, fiche())); assert.match(r1.texte, /^Environ .* de route depuis La Baule-Escoublac$/)
    const avant = el(rdv({ id: 'a', debut: '2026-11-25T07:30', fin: '2026-11-25T09:00' }), fiche({ id: 'f0', ville: 'Dinan', lat: 48.45, lon: -2.05 }))
    assert.equal(R.route(rdv(), fiche(), [avant], base).depuis, 'Dinan')
    const autreJour = el(rdv({ id: 'a', debut: '2026-11-24T07:30', fin: '2026-11-24T09:00' }), fiche({ id: 'f0', ville: 'Dinan', lat: 48.45, lon: -2.05 }))
    assert.equal(R.route(rdv(), fiche(), [autreJour], base).depuis, 'La Baule-Escoublac')
  })
  test('sans position, pas de route (et pas d’erreur)', () => {
    assert.equal(R.route(rdv(), fiche({ lat: null, lon: null }), [], P.REGLAGES_AGENDA.base), null)
    assert.equal(R.enTete(rdv(), fiche(), null).faits.length, 2)
  })
})

describe('ce qu’a noté la téléprospectrice : seulement ce qui existe', () => {
  test('les cinq réponses (questions_lignes de L2) : rien tant que le rendez-vous ne les porte pas ; 8 lignes au plus, chaînes seulement', () => {
    assert.deepEqual(R.questionsLignes(rdv()), []); assert.deepEqual(R.questionsLignes(rdv({ questions_lignes: [] })), []); assert.deepEqual(R.questionsLignes(rdv({ questions_lignes: 'texte' })), [])
    assert.deepEqual(R.questionsLignes(rdv({ questions_lignes: ['Projet : Robot Riedl', 12, '', '  Pour quand : d’ici mai 2027 '] })), ['Projet : Robot Riedl', 'Pour quand : d’ici mai 2027'])
    assert.equal(R.questionsLignes(rdv({ questions_lignes: Array.from({ length: 12 }, (_, i) => 'Ligne ' + i) })).length, 8)
  })
  test('« Premier rendez-vous » n’est pas un projet', () => {
    assert.equal(R.projetDit('Premier rendez-vous'), ''); assert.equal(R.projetDit('Robot Riedl · d’ici mai 2027'), 'Robot Riedl · d’ici mai 2027')
  })
  test('l’origine : qui, quand', () => {
    const eq = { u1: { nom: 'Équipière Test', telepro: true } }
    assert.equal(R.origine(rdv(), eq, AUJ), 'Rendez-vous pris par Équipière Test · 23 novembre.')
    assert.equal(R.origine(rdv({ prisParTelepro: false }), eq, AUJ), 'Rendez-vous posé par vous · 23 novembre.')
  })
  test('le journal : du plus récent, au plus 8 lignes, avec l’auteur', () => {
    const l = Array.from({ length: 12 }, (_, i) => ({ type: 'appel', body: 'Appel passé — à rappeler', created_at: '2026-11-2' + (i % 4) + 'T09:00:00+00:00', author_id: 'u1' }))
    const j = R.journal(l, { u1: { nom: 'Équipière Test', telepro: true } }, AUJ)
    assert.equal(j.length, 8); assert.match(j[0].texte, /Appel · À rappeler|Appel passé/); assert.match(j[0].texte, /par Équipière Test/)
  })
  test('« pourquoi elle l’a appelée » : sa première note, pas du JSON', () => {
    const l = [{ type: 'appel', body: 'x' }, { type: 'note', body: '{"a":1}' }, { type: 'note', body: 'Robot concurrent : fabricant X' }]
    assert.equal(R.pourquoiAppelee(l), 'Robot concurrent : fabricant X'); assert.equal(R.pourquoiAppelee([]), '')
  })
})

describe('la pharmacie, les voisines, le dossier', () => {
  test('la pharmacie ne dit que ce qu’elle sait', () => {
    assert.deepEqual(R.pharmacie(fiche(), null), [])
    const l = R.pharmacie(fiche({ pharmacien: 'Titulaire Test', telephone: '0261912407' }), { groupements: ['Groupement A', 'Groupement B'], tt_type: 'Cession', tt_date: '2026-03-04', fab: 'Fabricant X', robot_modele: 'M1', robot_date: '2017-05-01', n_ehpad: 2, ehpad_proches: ['EHPAD A', 'EHPAD B'] })
    const m = Object.fromEntries(l.map((x) => [x.e, x.v]))
    assert.equal(m['Titulaire'], 'Titulaire Test'); assert.equal(m['Téléphone'], '02 61 91 24 07'); assert.equal(m['Groupement'], 'Groupement A et Groupement B')
    assert.equal(m['Cession ou ouverture'], 'Cession, annonce officielle du 04/03/2026'); assert.match(m['Robot actuel'], /^Fabricant X · M1, posé le 01\/05\/2017$/); assert.match(m['EHPAD proches'], /^2 EHPAD à proximité : EHPAD A, EHPAD B$/)
  })
  test('les voisines : projets terminés seulement, les plus proches, dans la limite des kilomètres', () => {
    const f = fiche()
    const autres = [{ id: 'a', nom: 'Proche', ville: 'Plémet', lat: 48.3, lon: -2.6, termines: ['Robotique Riedl'] }, { id: 'b', nom: 'Sans fini', ville: 'X', lat: 48.46, lon: -2.5, termines: [] },
      { id: 'c', nom: 'Loin', ville: 'Nice', lat: 43.7, lon: 7.2, termines: ['Agencement'] }, { id: 'f1', nom: 'Elle-même', lat: 48.47, lon: -2.52, termines: ['Agencement'] }, { id: 'd', nom: 'Sans point', termines: ['Agencement'] }]
    const v = R.voisines(f, autres, 2, 60)
    assert.deepEqual(v.map((x) => x.nom), ['Proche']); assert.ok(v[0].km > 10 && v[0].km < 30)
  })
  test('le dossier : volets, avancée, et ce qui retient', () => {
    const vol = (sorte, n) => D.monterVolet({ id: 'v-' + sorte, dossier_id: 'd', sorte, etat: 'cours', details: {}, created_at: '2026-10-12T08:00:00+00:00' }, ['rdv', 'local', 'plans', 'demande', 'reponse'].slice(0, n).map((k) => ({ volet_id: 'v-' + sorte, cle: k, faite: '2026-10-20' })))
    const ph = { dossier: { id: 'd', nom: 'Pharmacie du Test Un' }, volets: [vol('transfert', 4), D.monterVolet({ id: 'v-agencement', dossier_id: 'd', sorte: 'agencement', etat: 'cours', details: {}, created_at: '2026-10-12T08:00:00+00:00' }, ['rdv', 'releve', 'ambiance'].map((k) => ({ volet_id: 'v-agencement', cle: k, faite: '2026-10-21' })))] }
    const d = R.dossier(ph, AUJ)
    assert.equal(d.volets[0].avance, '4 sur 9'); assert.match(d.volets[0].prochaine, /Réponse de l’ARS/); assert.equal(d.retient.length, 1); assert.match(d.retient[0], /plans d’agencement définitifs/)
    assert.equal(R.dossier({ dossier: {}, volets: [] }, AUJ), null); assert.equal(R.dossier(null, AUJ), null)
  })
})

describe('à apporter', () => {
  test('la sorte vient du projet dit, sinon du dossier', () => {
    assert.equal(R.sorteDeProjet('Robot Riedl · d’ici mai 2027', []), 'riedl'); assert.equal(R.sorteDeProjet('Transfert · dans l’année', []), 'transfert')
    assert.equal(R.sorteDeProjet('Premier rendez-vous', []), '')
  })
  test('une proposition par sorte, plus la voisine à citer', () => {
    assert.ok(R.aApporter('riedl').length >= 3); assert.ok(R.aApporter('').length >= 1)
    const l = R.aApporter('pda', { nom: 'Pharmacie Test Deux', ville: 'Uzel' }); assert.match(l[l.length - 1], /Pharmacie Test Deux, à Uzel/)
  })
  test('les cases cochées se relisent, un texte abîmé ne casse rien', () => {
    assert.equal(R.cleCases('abc'), 'phirst-veille-abc'); assert.deepEqual(R.casesLues('[0,2,9]', 4), [0, 2]); assert.deepEqual(R.casesLues('pas du json', 4), []); assert.deepEqual(R.casesLues(null, 4), [])
  })
})
