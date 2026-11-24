// Phirst · lot L3 · idée 11 « Le mot du vendredi » : logique pure (phirst/v2/phirst-mot-pur.js).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const M = createRequire(import.meta.url)('../phirst/v2/phirst-mot-pur.js')
const P = createRequire(import.meta.url)('../phirst/v2/phirst-pur.js')

const EQ = { t1: { nom: 'Équipière Test', telepro: true }, y1: { nom: 'Yann', telepro: false } }
const SEM = M.semaine('2026-11-27')   // vendredi 27 → lundi 23 au dimanche 29
const app = (id, body, jour = '2026-11-24', auteur = 't1') => ({ prospect_id: id, author_id: auteur, body, created_at: jour + 'T09:00:00+00:00' })
const RDV = 'Appel passé — RDV obtenu', RAP = 'Appel passé — à rappeler', INJ = 'Appel passé — injoignable', NON = 'Appel passé — pas intéressé pour le moment'

describe('la semaine', () => {
  test('visible du vendredi au lundi seulement', () => {
    const v = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30'].map((j) => M.visible(j))
    assert.deepEqual(v, [true, false, false, false, true, true, true, true])
  })
  test('du vendredi au dimanche : celle qui finit ; le lundi : celle qui vient de finir', () => {
    for (const j of ['2026-11-27', '2026-11-28', '2026-11-29']) assert.deepEqual(M.semaine(j), { debut: '2026-11-23', vendredi: '2026-11-27', fin: '2026-11-29' })
    assert.equal(M.semaine('2026-11-30').debut, '2026-11-23')
  })
  test('le libellé, y compris à cheval sur deux mois', () => {
    assert.equal(M.libelleSemaine(SEM), 'semaine du 23 au 27 novembre')
    assert.equal(M.libelleSemaine(M.semaine('2026-10-02')), 'semaine du 28 septembre au 2 octobre')
    assert.equal(M.libelleSemaine(M.semaine('2026-05-01')), 'semaine du 27 avril au 1er mai')
  })
  test('la période du choix : lundi prochain, ou demain si on est lundi', () => {
    assert.deepEqual(M.periode('2026-11-27'), { du: '2026-11-30', au: '2026-12-06', quand: 'la semaine prochaine', liste: 'la liste du lundi' })
    assert.equal(M.periode('2026-11-29').du, '2026-11-30')
    const l = M.periode('2026-11-30'); assert.equal(l.du, '2026-11-30'); assert.equal(l.quand, 'cette semaine')
  })
})

describe('le journal lu', () => {
  test('texte de l’écran Appels et JSON de la V1', () => {
    assert.equal(M.resultat(RDV), 'rdv'); assert.equal(M.resultat(INJ), 'sans'); assert.equal(M.resultat(RAP), 'decroche'); assert.equal(M.resultat(NON), 'decroche')
    assert.equal(M.resultat('{"v":1,"resultat":"rdv"}'), 'rdv'); assert.equal(M.resultat('{"resultat":"barrage"}'), 'sans'); assert.equal(M.resultat('{"resultat":"pas_interesse"}'), 'decroche')
    assert.equal(M.resultat(''), 'decroche')
  })
  test('on compte des pharmacies, pas des appels : deux appels à la même = une', () => {
    const c = M.compter([app('a', INJ), app('a', RDV, '2026-11-25'), app('b', RAP), app('c', INJ)], {}, EQ, SEM)
    assert.deepEqual([c.appelees, c.decroche, c.rdv], [3, 2, 1])
  })
  test('seuls ses appels à elle, dans la semaine', () => {
    const c = M.compter([app('a', RDV, '2026-11-24', 'y1'), app('b', RDV, '2026-11-20'), app('c', RDV, '2026-11-30'), app('d', RDV, '2026-11-23'), app('e', RDV, '2026-11-29'), app('f', RDV, '2026-11-24', 'inconnu')], {}, EQ, SEM)
    assert.equal(c.appelees, 2)   // d (lundi) et e (dimanche)
  })
  test('l’heure de Paris décide du jour (minuit passé = jour suivant)', () => {
    const c = M.compter([{ prospect_id: 'a', author_id: 't1', body: RDV, created_at: '2026-11-22T23:30:00+00:00' }], {}, EQ, SEM)   // = 23 novembre 00 h 30 à Paris
    assert.equal(c.appelees, 1)
  })
})

describe('les trois lignes', () => {
  const lot = (id, n, rdv, src) => Array.from({ length: n }, (_, i) => app(id + i, i < rdv ? RDV : RAP)).map((a) => ({ a, src }))
  function semaineType() {
    const l = [...lot('c', 18, 3, 'cession'), ...lot('r', 40, 1, 'robot'), ...lot('n', 4, 2, 'pda')], fiches = {}
    l.forEach((x) => { fiches[x.a.prospect_id] = { source: x.src } })
    return M.compter(l.map((x) => x.a), fiches, EQ, SEM)
  }
  test('ligne 1 : les trois chiffres, tirés du journal', () => {
    const c = semaineType(), t = M.phrase(c).map((s) => s.t).join('')
    assert.equal(c.appelees, 62); assert.equal(c.rdv, 6)
    assert.equal(t, 'La téléprospectrice a appelé 62 pharmacies : 62 ont décroché, et 6 ont pris rendez-vous avec vous.')
  })
  test('ligne 1 : singulier et sans rendez-vous', () => {
    assert.equal(M.phrase(M.compter([app('a', RAP)], {}, EQ, SEM)).map((s) => s.t).join(''), 'La téléprospectrice a appelé 1 pharmacie : 1 a décroché, et aucun rendez-vous n’a encore été pris avec vous.')
    assert.equal(M.phrase(M.compter([app('a', RDV)], {}, EQ, SEM)).map((s) => s.t).join(''), 'La téléprospectrice a appelé 1 pharmacie : 1 a décroché, et 1 a pris rendez-vous avec vous.')
  })
  test('ligne 1 : pas un appel noté = null (jamais « 0 pharmacie »)', () => { assert.equal(M.phrase(M.compter([], {}, EQ, SEM)), null) })
  test('ligne 2 : les raisons à 5 appels ou plus, la meilleure d’abord, avec le rythme', () => {
    const r = M.raisons(semaineType())
    assert.deepEqual(r.map((x) => x.source), ['cession', 'robot'])   // « pda » n’a que 4 appels : pas comparable
    assert.equal(r[0].gras, '3 rendez-vous sur 18 appels'); assert.equal(r[0].rythme, 'soit un tous les 6 appels')
    assert.equal(r[1].gras, '1 rendez-vous sur 40 appels'); assert.equal(r[1].rythme, 'soit un tous les 40 appels')
  })
  test('ligne 2 : pas assez d’appels, la phrase dit quoi attendre', () => {
    const v = M.phraseRaisons(M.compter([app('a', RDV)], {}, EQ, SEM)); assert.equal(v.liste.length, 0); assert.match(v.vide, /dès 5 appels/)
  })
  test('ligne 3 : la meilleure raison que le robot sait classer', () => {
    const p = M.proposition(semaineType(), '2026-11-27')
    assert.equal(p.source, 'cession'); assert.deepEqual(p.motifs, ['cession']); assert.equal(p.bouton, 'Mettre les ventes d’officines en tête la semaine prochaine')
    assert.deepEqual(M.ligneAEnregistrer(p), { source: 'cession', motifs: ['cession'], libelle: 'Les ventes d’officines', valable_du: '2026-11-30', valable_jusqu: '2026-12-06', pris_en_compte_le: null, annule_le: null })
    assert.equal(M.proposition(semaineType(), '2026-11-30').bouton, 'Mettre les ventes d’officines en tête cette semaine')
  })
  test('ligne 3 : une raison sans équivalent côté robot (annuaire) ne se propose pas', () => {
    const l = lot('x', 6, 3, 'annuaire'), fiches = {}; l.forEach((x) => { fiches[x.a.prospect_id] = { source: 'annuaire' } })
    const c = M.compter(l.map((x) => x.a), fiches, EQ, SEM)
    assert.equal(M.raisons(c).length, 1); assert.equal(M.proposition(c, '2026-11-27'), null)
  })
  test('toute raison proposée a des motifs que le robot de la V1 connaît', () => {
    const connus = ['relance', 'procedure', 'cession', 'creation', 'omnicell', 'robot', 'pda', 'ehpad', 'pmr']
    Object.values(M.RAISONS).forEach((r) => { if (r.motifs) r.motifs.forEach((m) => assert.ok(connus.includes(m), m)) })
  })
})

describe('le choix enregistré', () => {
  test('un choix compte jusqu’à sa fin', () => {
    const l = { source: 'cession', valable_du: '2026-11-30', valable_jusqu: '2026-12-06', pris_en_compte_le: null }
    assert.equal(M.choixEnCours(l, '2026-11-28').source, 'cession'); assert.equal(M.choixEnCours(l, '2026-12-06').source, 'cession'); assert.equal(M.choixEnCours(l, '2026-12-07'), null); assert.equal(M.choixEnCours(null, '2026-11-28'), null)
    assert.equal(M.choixEnCours({ ...l, annule_le: '2026-11-28T10:00:00Z' }, '2026-11-28'), null)   // « Revenir à l’ordre habituel »
  })
  test('la phrase ne promet « c’est fait » que si le robot en a tenu compte', () => {
    const ch = (o) => M.choixEnCours({ source: 'cession', valable_du: '2026-11-30', valable_jusqu: '2026-12-06', pris_en_compte_le: null, ...o }, '2026-11-28')
    assert.equal(M.phraseChoix(ch(), '2026-11-28'), 'C’est noté : la liste du lundi commencera par les ventes d’officines.')
    assert.equal(M.phraseChoix(ch({ pris_en_compte_le: '2026-11-30T05:05:00Z' }), '2026-11-30'), 'C’est fait : la liste de la téléprospectrice commence par les ventes d’officines.')
  })
})
