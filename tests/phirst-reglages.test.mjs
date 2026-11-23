// Réglages de Phirst V2 (23/11/2026) : la logique pure (phirst/v2/phirst-reglages-pur.js), d'après la maquette validée par Will.
// Règle centrale : une lecture qui échoue donne « état inconnu », jamais « hors service », et ne compte pas dans « N sur M ».
// Aucune lecture de fichier hors du dépôt (la CI de toutes les séances en dépend).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const R = req('../phirst/v2/phirst-reglages-pur.js')

const MAINT = Date.parse('2026-11-23T20:00:00Z')
const tout = (o = {}) => ({ base: true, liste: { frais: true, calculeLe: '2026-11-23T06:05:00Z' }, etat: { images: true, video: true, plafondCentimes: 2000 }, maintenant: MAINT, ...o })
const par = (l) => Object.fromEntries(R.etats(l).map((o) => [o.id, o]))

describe('les quatre outils', () => {
  test('dans l’ordre de la maquette', () => {
    assert.deepEqual(R.OUTILS.map((o) => o.id), ['base', 'liste', 'images', 'video'])
    assert.deepEqual(R.OUTILS.map((o) => o.t), ['Vos dossiers et vos comptes', 'La liste du jour', 'Les images réalistes de la pharmacie', 'La vidéo de visite'])
  })
  test('tout lu et allumé : 4 sur 4, l’heure de la liste lue (7 h 05 à Paris)', () => {
    const o = par(tout())
    assert.equal(o.liste.texte, 'En service · mise à jour ce matin à 7 h 05')
    assert.equal(o.images.texte, 'En service — et sans frais')
    const b = R.bilan(R.etats(tout()))
    assert.equal(b.chiffre, '4'); assert.equal(b.libelle, 'outils\nsur 4 en service')
    assert.match(b.phrase, /^Tout fonctionne/)
  })
  test('l’état réel du 23/11 : vidéo éteinte → 3 sur 4, prévenir Will', () => {
    const l = tout({ etat: { images: true, video: false, plafondCentimes: 2000 } })
    const o = par(l), b = R.bilan(R.etats(l))
    assert.equal(o.video.etat, 'panne')
    assert.equal(o.video.texte, 'La vidéo n’est pas disponible. Les images, elles, marchent quand même.')
    assert.equal(b.chiffre, '3'); assert.equal(b.sur, 4)
    assert.match(b.phrase, /prévenez Will\.$/)
  })
  test('vidéo ET images éteintes : on ne dit pas que les images marchent', () => {
    const o = par(tout({ etat: { images: false, video: false, plafondCentimes: 2000 } }))
    assert.equal(o.video.texte, 'La vidéo n’est pas disponible.')
    assert.equal(o.images.etat, 'panne')
  })
  test('liste pas recalculée depuis plus de 36 h : en panne, avec la date lue', () => {
    const o = par(tout({ liste: { frais: false, calculeLe: '2026-11-21T06:05:00Z' } }))
    assert.equal(o.liste.etat, 'panne')
    assert.equal(o.liste.texte, 'Pas recalculée depuis le 21 novembre à 7 h 05 : l’accueil, les Appels et la Veille n’ont plus de liste du jour.')
  })
})

describe('une lecture qui échoue ne condamne rien', () => {
  test('base muette → inconnu, jamais « hors service »', () => {
    for (const b of [false, null, undefined]) {
      const o = par(tout({ base: b }))
      assert.equal(o.base.etat, 'inconnu'); assert.equal(o.base.texte, R.INCONNU)
      assert.doesNotMatch(o.base.texte, /hors service/i)
    }
  })
  test('liste illisible (aucune heure) → inconnu', () => {
    assert.equal(par(tout({ liste: null })).liste.etat, 'inconnu')
    assert.equal(par(tout({ liste: { frais: false } })).liste.etat, 'inconnu')
  })
  test('adresse d’état muette → images et vidéo inconnues', () => {
    const o = par(tout({ etat: null }))
    assert.equal(o.images.etat, 'inconnu'); assert.equal(o.video.etat, 'inconnu')
    const o2 = par(tout({ etat: { images: 'oui' } }))
    assert.equal(o2.images.etat, 'inconnu')
  })
  test('l’inconnu ne compte pas dans « N sur M » : 2 sur 2, et la phrase le dit', () => {
    const b = R.bilan(R.etats(tout({ etat: null })))
    assert.equal(b.chiffre, '2'); assert.equal(b.sur, 2); assert.equal(b.inconnu, 2)
    assert.equal(b.libelle, 'outils\nsur 2 en service')
    assert.equal(b.phrase, '2 outils n’ont pas pu être vérifiés pour l’instant. Rechargez la page dans quelques minutes.')
  })
  test('un seul inconnu : phrase au singulier', () => {
    assert.equal(R.bilan(R.etats(tout({ base: null }))).phrase, 'Un outil n’a pas pu être vérifié pour l’instant. Rechargez la page dans quelques minutes.')
  })
  test('éteint ET inconnu : la phrase d’action l’emporte', () => {
    const b = R.bilan(R.etats(tout({ base: null, etat: { images: true, video: false, plafondCentimes: 2000 } })))
    assert.equal(b.chiffre, '2'); assert.equal(b.sur, 3); assert.match(b.phrase, /prévenez/)
  })
  test('rien de lu : pas de chiffre inventé', () => {
    const b = R.bilan(R.etats({ base: null, liste: null, etat: null }))
    assert.equal(b.chiffre, '?'); assert.equal(b.sur, 0)
    assert.match(b.phrase, /n’a pas pu être lu/)
  })
  test('un seul outil en service : « outil » au singulier', () => {
    const b = R.bilan(R.etats(tout({ liste: null, etat: { images: false, video: false } })))
    assert.equal(b.libelle, 'outil\nsur 3 en service')
  })
})

describe('le plafond et la dépense du mois', () => {
  test('début du mois = le 1er à minuit UTC, comme lib/cost.ts sur Vercel', () => {
    assert.equal(R.debutDuMois(MAINT), '2026-11-01T00:00:00.000Z')
    assert.equal(R.debutDuMois(Date.parse('2026-12-01T00:30:00+01:00')), '2026-11-01T00:00:00.000Z')
  })
  test('somme des cost_cents du mois, lignes vides et anciennes ignorées', () => {
    const jobs = [{ cost_cents: 380, created_at: '2026-11-02T10:00:00Z' }, { cost_cents: null, created_at: '2026-11-03T10:00:00Z' },
      { cost_cents: 1000, created_at: '2026-11-20T10:00:00Z' }, { cost_cents: 900, created_at: '2026-10-31T23:00:00Z' }, { cost_cents: -5, created_at: '2026-11-20T10:00:00Z' }]
    assert.equal(R.depenseDuMois(jobs, MAINT), 1380)
    assert.equal(R.depenseDuMois(null, MAINT), 0)
  })
  test('euros à la française', () => {
    assert.equal(R.eur(1380), '13,80 €'); assert.equal(R.eur(2000), '20,00 €'); assert.equal(R.eur(5), '0,05 €')
  })
  test('jauge : pourcentage, reste, alerte à 80 %', () => {
    assert.deepEqual(R.jauge(1380, 2000), { depense: 1380, plafond: 2000, p: 69, fort: false, reste: 620, gauche: '69 % du plafond', droite: 'Reste 6,20 €' })
    assert.equal(R.jauge(1600, 2000).fort, true)
    assert.equal(R.jauge(0, 2000).gauche, 'Rien n’a été dépensé ce mois-ci')
    const plus = R.jauge(2600, 2000); assert.equal(plus.p, 100); assert.equal(plus.reste, 0)
  })
  test('plafond ou dépense illisibles : pas de jauge (jamais un chiffre inventé)', () => {
    assert.equal(R.jauge(1380, null), null); assert.equal(R.jauge(null, 2000), null)
    assert.equal(R.jauge(1380, NaN), null); assert.equal(R.jauge(1380, 0), null)
    assert.equal(R.plafondValide('2000'), null); assert.equal(R.plafondValide(2000), 2000)
  })
})

describe('le mot de passe', () => {
  test('au moins 6 caractères, champ 1 signalé', () => {
    assert.deepEqual(R.verifierMdp('abc', 'abc'), { message: 'Le mot de passe doit faire au moins 6 caractères.', champ: 1 })
    assert.deepEqual(R.verifierMdp('', ''), { message: 'Le mot de passe doit faire au moins 6 caractères.', champ: 1 })
  })
  test('les deux différents : champ 2 signalé', () => {
    assert.deepEqual(R.verifierMdp('abcdef', 'abcdeg'), { message: 'Les deux mots de passe ne correspondent pas.', champ: 2 })
  })
  test('bons : aucun message', () => { assert.deepEqual(R.verifierMdp('abcdef', 'abcdef'), { message: '', champ: 0 }) })
  test('les refus de la base, traduits (jamais l’anglais tel quel)', () => {
    assert.equal(R.messageMdp({ code: 'weak_password', message: 'Password should be at least 8 characters.' }), 'Le mot de passe doit faire au moins 8 caractères.')
    assert.match(R.messageMdp({ code: 'weak_password', message: 'Password is known to be weak' }), /trop simple/)
    assert.match(R.messageMdp({ code: 'same_password', message: 'New password should be different from the old password.' }), /déjà votre mot de passe/)
    assert.match(R.messageMdp({ code: 'reauthentication_needed' }), /reconnectez-vous/)
    assert.match(R.messageMdp({ name: 'AuthSessionMissingError', message: 'Auth session missing!' }), /session a expiré/)
    assert.equal(R.messageMdp({ message: 'Failed to fetch' }), 'Mot de passe pas changé : réessayez dans un instant.')
    assert.equal(R.messageMdp(null), '')
  })
})
