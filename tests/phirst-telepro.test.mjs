// Écrans de la téléprospectrice (phirst/v2/phirst-pur.js) : équipe, auteur, ligne du robot, agenda sans accès aux tables.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const P = createRequire(import.meta.url)('../phirst/v2/phirst-pur.js')

const YANN = '11111111-1111-4111-8111-111111111111', ELLE = '22222222-2222-4222-8222-222222222222', INCONNU = '33333333-3333-4333-8333-333333333333'
const equipe = P.equipeParId([{ user_id: YANN, nom: 'Yann', telepro: false }, { user_id: ELLE, nom: ' Essai Télépro ', telepro: true }])

describe('l’équipe (phirst_equipe)', () => {
  test('une ligne par personne, nom nettoyé, télépro seulement si la base le dit', () => {
    assert.deepEqual(equipe[ELLE], { nom: 'Essai Télépro', telepro: true })
    assert.deepEqual(equipe[YANN], { nom: 'Yann', telepro: false })
  })
  test('estTelepro : vrai pour elle seule ; inconnu, vide ou équipe absente = faux', () => {
    assert.equal(P.estTelepro(equipe, ELLE), true)
    assert.equal(P.estTelepro(equipe, YANN), false)
    assert.equal(P.estTelepro(equipe, INCONNU), false)
    assert.equal(P.estTelepro(equipe, null), false)
    assert.equal(P.estTelepro(undefined, ELLE), false)
    assert.equal(P.estTelepro({ [ELLE]: { nom: 'x', telepro: 'true' } }, ELLE), false)
  })
  test('équipe illisible : objet vide, pas d’exception', () => {
    assert.deepEqual(P.equipeParId(null), {})
    assert.deepEqual(P.equipeParId([null, {}, { nom: 'sans id' }]), {})
  })
})

describe('« par … » dans le journal', () => {
  test('le nom de l’auteur s’ajoute à la phrase', () => {
    assert.equal(P.avecAuteur('Appel passé — à rappeler', P.nomAuteur(equipe, ELLE)), 'Appel passé — à rappeler — par Essai Télépro')
  })
  test('auteur inconnu, vide ou sans nom : rien, jamais « undefined »', () => {
    for (const id of [INCONNU, null, undefined, '']) {
      const t = P.avecAuteur('Note', P.nomAuteur(equipe, id))
      assert.equal(t, 'Note'); assert.ok(!/undefined|null/.test(t))
    }
    assert.equal(P.nomAuteur({ [YANN]: { nom: '', telepro: false } }, YANN), '')
  })
})

describe('un rendez-vous pris par elle arrive « proposé » chez Yann', () => {
  const rdv = '44444444-4444-4444-8444-444444444444'
  const ligne = (auteur) => ({ id: 'a1', prospect_id: 'p1', author_id: auteur, created_at: '2026-11-21T09:00:00Z', body: P.corpsRdv('creer', rdv, auteur, { debut: '2026-11-24T10:00', duree_min: 60 }) })
  test('créé par elle : statut propose, à confirmer', () => {
    const [r] = P.etatsDesRdv([ligne(ELLE)], (id) => P.estTelepro(equipe, id))
    assert.equal(r.statut, 'propose'); assert.equal(r.prisParTelepro, true); assert.equal(P.aConfirmer(r), true)
  })
  test('créé par Yann : confirmé ; auteur inconnu : confirmé (jamais « proposé » par erreur)', () => {
    assert.equal(P.etatsDesRdv([ligne(YANN)], (id) => P.estTelepro(equipe, id))[0].statut, 'confirme')
    assert.equal(P.etatsDesRdv([ligne(INCONNU)], (id) => P.estTelepro(equipe, id))[0].statut, 'confirme')
  })
})

describe('la liste du robot (telepro_ligne)', () => {
  const maintenant = Date.parse('2026-11-21T10:00:00Z'), h = (n) => new Date(maintenant - n * 3600e3).toISOString()
  test('format { trouver: { appels, veille }, frais }', () => {
    const l = P.ligneDeTelepro({ calcule_le: h(2), appelsTotal: 3, appels: [{ nom: 'A' }], veille: [{ nom: 'V' }] }, maintenant)
    assert.equal(l.frais, true); assert.equal(l.trouver.appels.length, 1); assert.equal(l.trouver.veille[0].nom, 'V'); assert.equal(l.trouver.appelsTotal, 3)
  })
  test('frais : 36 h pile oui, 36 h et une seconde non', () => {
    assert.equal(P.ligneDeTelepro({ calcule_le: h(36), appels: [], veille: [] }, maintenant).frais, true)
    assert.equal(P.ligneDeTelepro({ calcule_le: new Date(maintenant - 36 * 3600e3 - 1000).toISOString(), appels: [], veille: [] }, maintenant).frais, false)
    assert.equal(P.ligneDeTelepro({ calcule_le: 'n’importe quoi', appels: [], veille: [] }, maintenant).frais, false)
  })
  test('rien (aucune ligne) ou listes absentes : pas d’exception, listes vides', () => {
    assert.deepEqual(P.ligneDeTelepro(null, maintenant), { trouver: null, frais: false })
    const l = P.ligneDeTelepro({ calcule_le: h(1) }, maintenant)
    assert.deepEqual(l.trouver.appels, []); assert.deepEqual(l.trouver.veille, [])
  })
})

describe('l’agenda de la téléprospectrice (telepro_agenda)', () => {
  const rS = '55555555-5555-4555-8555-555555555555', rO = '66666666-6666-4666-8666-666666666666'
  const sienne = (id, quoi, extra, t) => ({ id, prospect_id: 'p1', author_id: ELLE, created_at: t, body: P.corpsRdv(quoi, rS, ELLE, extra), nom: 'Pharmacie du Port', ville: 'Vannes', cp: '56000', lat: 47.6, lon: -2.7, stage: 'rdv_fixe', sien: true })
  const occupee = (id, quoi, extra, t) => ({ id, prospect_id: null, author_id: null, created_at: t, body: JSON.stringify({ v: 1, rdv: rO, quoi, ...extra }), nom: null, ville: 'Rennes', cp: null, lat: 48.1, lon: -1.7, stage: null, sien: false })
  const lignes = [sienne('a', 'creer', { debut: '2026-11-24T10:00', duree_min: 60 }, '2026-11-21T09:00:00Z'), occupee('b', 'creer', { debut: '2026-11-24T14:00', duree_min: 60 }, '2026-11-21T09:05:00Z')]
  const a = P.agendaDeTelepro(lignes)
  test('son rendez-vous garde sa fiche ; l’autre reçoit une fiche « Yann est occupé » (id occ-…, commune)', () => {
    assert.equal(a.fiches.length, 2)
    const s = a.fiches.find((f) => f.id === 'p1'), o = a.fiches.find((f) => f.id === 'occ-' + rO)
    assert.equal(s.nom, 'Pharmacie du Port'); assert.equal(s.occupe, false)
    assert.equal(o.nom, 'Yann est occupé'); assert.equal(o.ville, 'Rennes'); assert.equal(o.occupe, true); assert.equal(o.lat, 48.1)
    assert.ok(!('pharmacien' in o) && o.stage === null)
  })
  test('les lignes se rejouent : le sien est « proposé » (il vient d’elle), l’autre est confirmé', () => {
    const r = P.etatsDesRdv(a.lignes, (id) => P.estTelepro(equipe, id))
    assert.equal(r.length, 2)
    assert.equal(r.find((x) => x.id === rS).statut, 'propose')
    assert.equal(r.find((x) => x.id === rO).statut, 'confirme')
    assert.equal(r.find((x) => x.id === rO).prospect_id, 'occ-' + rO)
  })
  test('lierRdv relie chaque rendez-vous à sa fiche (le sien comme l’occupé) et occupations() trouve la commune', () => {
    const rdvs = P.etatsDesRdv(a.lignes, (id) => P.estTelepro(equipe, id)), liens = P.lierRdv(rdvs, a.fiches)
    assert.deepEqual(liens.map((l) => l.fiche.nom).sort(), ['Pharmacie du Port', 'Yann est occupé'])
    assert.equal(liens.find((l) => l.fiche.occupe).fiche.ville, 'Rennes')
  })
  test('un geste suivant (annuler par elle) se rejoue sur son rendez-vous ; un geste de Yann sur « occupé » aussi', () => {
    const plus = lignes.concat([sienne('c', 'annuler', null, '2026-11-21T10:00:00Z'), occupee('d', 'deplacer', { debut: '2026-11-25T09:00' }, '2026-11-21T10:05:00Z')])
    const r = P.etatsDesRdv(P.agendaDeTelepro(plus).lignes, (id) => P.estTelepro(equipe, id))
    assert.equal(r.find((x) => x.id === rS).statut, 'annule')
    assert.equal(r.find((x) => x.id === rO).debut, '2026-11-25T09:00')
  })
  test('elle ne peut ni confirmer ni « c’est fait », mais déplacer et annuler les siens', () => {
    const [r] = P.etatsDesRdv(P.agendaDeTelepro([lignes[0]]).lignes, (id) => P.estTelepro(equipe, id))
    assert.equal(P.gestePermis(r, 'confirmer', 'telepro'), false); assert.equal(P.gestePermis(r, 'fait', 'telepro'), false)
    assert.equal(P.gestePermis(r, 'deplacer', 'telepro'), true); assert.equal(P.gestePermis(r, 'annuler', 'telepro'), true)
    assert.equal(P.gestePermis(r, 'confirmer', 'patron'), true)
  })
  test('ligne illisible, sans identifiant de rendez-vous ou liste absente : ignorée sans exception', () => {
    assert.deepEqual(P.agendaDeTelepro(null), { fiches: [], lignes: [] })
    const x = P.agendaDeTelepro([{ id: 'z', prospect_id: null, body: 'pas du json', ville: 'X', sien: false }, { id: 'y', prospect_id: null, body: '{"v":1}', ville: 'X', sien: false }, null].filter(Boolean))
    assert.deepEqual(x, { fiches: [], lignes: [] })
  })
  test('ligne « sienne » sans fiche (prospect_id vide) : traitée comme occupée, jamais de fiche vide', () => {
    const x = P.agendaDeTelepro([{ id: 'q', prospect_id: null, author_id: ELLE, created_at: '2026-11-21T09:00:00Z', body: P.corpsRdv('creer', rS, ELLE, { debut: '2026-11-24T10:00' }), ville: 'Vannes', sien: true }])
    assert.equal(x.fiches[0].id, 'occ-' + rS); assert.equal(x.lignes[0].author_id, null)
  })
})

describe('les refus de la base', () => {
  test('un refus écrit en français par une fonction de la base (42501, 22023) se montre tel quel', () => {
    assert.equal(P.messageDeLaBase({ code: '42501', message: 'Pas de somme dans le journal.' }), 'Pas de somme dans le journal.')
    assert.equal(P.messageDeLaBase({ code: '22023', message: ' Texte vide ou trop long. ' }), 'Texte vide ou trop long.')
  })
  test('toute autre panne (réseau, jeton, autre code, vide) : rien, l’écran dit « Pas enregistré »', () => {
    assert.equal(P.messageDeLaBase({ code: 'PGRST301', message: 'JWT expired' }), '')
    assert.equal(P.messageDeLaBase({ message: 'Failed to fetch' }), '')
    assert.equal(P.messageDeLaBase({ code: '42501', message: '' }), '')
    assert.equal(P.messageDeLaBase(null), ''); assert.equal(P.messageDeLaBase(undefined), '')
  })
})
