// Phirst (27/11/2026) : la phrase « Pour commencer » des lignes repérées au FINESS (phirst/v2/phirst-textes-pur.js, clePhrase).
// Le robot du matin (~/phirst-ligne/ligne-l4.mjs, ETIQUETTE_FINESS) leur donne le motif « ars » ; la pharmacie a DÉJÀ ouvert à sa nouvelle
// adresse, donc « L'ARS vient d'autoriser le transfert » serait faux. Choix cliqué de Will : deux phrases, une pour les déménagements et
// créations, une pour les regroupements. Aucune lecture hors du dépôt : les trois étiquettes sont recopiées telles que le robot les écrit.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const T = req('../phirst/v2/phirst-textes-pur.js')

const NB = ' '
const ligne = (motif, etiquette) => ({ nom: 'Pharmacie de Rothéneuf', ville: 'Saint-Malo', motif, etiquette })

describe('lignes repérées au FINESS : leur propre phrase', () => {
  test('transfert et création repérés au FINESS → la phrase « a ouvert récemment »', () => {
    for (const e of ['Transfert repéré au FINESS', 'Création repérée au FINESS']) {
      assert.equal(T.clePhrase(ligne('ars', e)), 'finess_ouverture', e)
      const p = T.phraseDe(T.clePhrase(ligne('ars', e)), [])
      assert.equal(p.source, 'proposition'); assert.equal(p.raison, 'Transfert ou création repérés au FINESS')
      assert.ok(p.texte.includes('Votre officine a ouvert récemment à cette adresse' + NB + ': comment se passe l’installation' + NB + '?'), e)
      assert.doesNotMatch(p.texte, /ARS/)
    }
  })
  test('regroupement repéré au FINESS → la phrase des regroupements', () => {
    const p = T.phraseDe(T.clePhrase(ligne('ars', 'Regroupement repéré au FINESS')), [])
    assert.equal(p.raison, 'Regroupement repéré au FINESS')
    assert.ok(p.texte.includes('Vos deux officines viennent de se regrouper' + NB + ':'))
    assert.doesNotMatch(p.texte, /ARS/)
  })
  test('marqueur positif : une ligne venue d’un arrêté de l’ARS garde « L’ARS vient d’autoriser… »', () => {
    for (const e of ['Regroupement autorisé par l’ARS', 'Transfert autorisé par l’ARS', '', undefined]) {
      assert.equal(T.clePhrase(ligne('ars', e)), 'ars', String(e))
      assert.match(T.phraseDe(T.clePhrase(ligne('ars', e)), []).texte, /^Bonjour, je vous appelle de la part de Yann, agenceur de pharmacies\. L’ARS vient d’autoriser le transfert/)
    }
  })
  test('les autres motifs ne changent pas, même avec une étiquette FINESS', () => {
    for (const m of ['cession', 'creation', 'relance', 'client', 'recommande', 'pmr']) assert.equal(T.clePhrase(ligne(m, 'Transfert repéré au FINESS')), m)
    assert.equal(T.clePhrase(null), null); assert.equal(T.clePhrase({}), undefined)
  })
  test('l’étiquette se lit sans tenir compte des espaces, des majuscules ni des accents', () => {
    assert.equal(T.clePhrase(ligne('ars', '  transfert  REPERE au finess ')), 'finess_ouverture')
    assert.equal(T.clePhrase(ligne('ars', 'Transfert repéré au FINESS (avant : rue X)')), 'ars')   // pas une étiquette du robot : la phrase du motif
  })
  test('Yann a écrit sa phrase dans Réglages : c’est la sienne qui s’affiche', () => {
    const ph = [{ cle: 'finess_ouverture', texte: 'Ma phrase ouverture.' }, { cle: 'finess_regroupement', texte: 'Ma phrase regroupement.' }, { cle: 'ars', texte: 'Ma phrase ARS.' }]
    assert.deepEqual(T.phraseDe(T.clePhrase(ligne('ars', 'Transfert repéré au FINESS')), ph), { cle: 'finess_ouverture', raison: 'Transfert ou création repérés au FINESS', texte: 'Ma phrase ouverture.', source: 'yann' })
    assert.equal(T.phraseDe(T.clePhrase(ligne('ars', 'Regroupement repéré au FINESS')), ph).texte, 'Ma phrase regroupement.')
    assert.equal(T.phraseDe(T.clePhrase(ligne('ars', 'Transfert autorisé par l’ARS')), ph).texte, 'Ma phrase ARS.')
  })
  test('les deux phrases sont dans Réglages, juste après celle de l’ARS, sans somme d’argent', () => {
    const cles = T.RAISONS.map((r) => r.cle), i = cles.indexOf('ars')
    assert.deepEqual(cles.slice(i, i + 3), ['ars', 'finess_ouverture', 'finess_regroupement'])
    const P = req('../phirst/v2/phirst-pur.js')
    for (const c of ['finess_ouverture', 'finess_regroupement']) {
      const r = T.raisonDe(c); assert.equal(P.contientMontant(r.propo), false, c); assert.ok(r.propo.length <= T.LONG_MAX, c)
      assert.doesNotMatch(r.propo, / [?!:;]/, c)
    }
  })
})

// 27/11/2026, suite (choix cliqué de Will « Appeler la voisine ») : la pharmacie ouverte la plus proche d'une fermeture vue au FINESS.
// Étiquettes recopiées telles que le robot les écrit (~/phirst-ligne/ligne-l4.mjs, ETIQUETTE_VOISINE).
describe('voisine d’une pharmacie qui ferme : sa propre phrase', () => {
  test('« vient de fermer » et « va fermer » → la phrase « ferme ses portes », jamais celle de l’ARS', () => {
    for (const e of ['Une pharmacie voisine vient de fermer', 'Une pharmacie voisine va fermer']) {
      assert.equal(T.clePhrase(ligne('ars', e)), 'finess_voisine', e)
      const p = T.phraseDe(T.clePhrase(ligne('ars', e)), [])
      assert.equal(p.source, 'proposition'); assert.equal(p.raison, 'Une pharmacie voisine ferme (FINESS)')
      assert.ok(p.texte.includes('Une pharmacie toute proche de la vôtre ferme ses portes' + NB + ': vous allez sans doute accueillir une partie de ses patients.'), e)
      assert.doesNotMatch(p.texte, /ARS|transfert|ouvert/i)
    }
  })
  test('contre-épreuve : un autre motif ou une autre étiquette ne prend pas cette phrase', () => {
    assert.equal(T.clePhrase(ligne('cession', 'Une pharmacie voisine vient de fermer')), 'cession')
    assert.equal(T.clePhrase(ligne('ars', 'Une pharmacie voisine vient de fermer à Rennes')), 'ars')
    assert.equal(T.clePhrase(ligne('ars', '  une PHARMACIE voisine  va fermer ')), 'finess_voisine')
  })
  test('Yann a écrit sa phrase : c’est la sienne ; dans Réglages juste après les deux du FINESS, sans somme d’argent', () => {
    assert.equal(T.phraseDe(T.clePhrase(ligne('ars', 'Une pharmacie voisine va fermer')), [{ cle: 'finess_voisine', texte: 'Ma phrase voisine.' }]).texte, 'Ma phrase voisine.')
    const cles = T.RAISONS.map((r) => r.cle), i = cles.indexOf('ars')
    assert.deepEqual(cles.slice(i, i + 4), ['ars', 'finess_ouverture', 'finess_regroupement', 'finess_voisine'])
    const P = req('../phirst/v2/phirst-pur.js'), r = T.raisonDe('finess_voisine')
    assert.equal(P.contientMontant(r.propo), false); assert.ok(r.propo.length <= T.LONG_MAX); assert.doesNotMatch(r.propo, / [?!:;]/)
    assert.deepEqual(P.etiquetteDe({ motif: 'ars', etiquette: 'Une pharmacie voisine vient de fermer' }), ['Une pharmacie voisine vient de fermer', 'orange'])
  })
})
