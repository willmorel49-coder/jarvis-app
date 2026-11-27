// L1 Phirst (24/11/2026) : les textes de Yann pour la téléprospectrice (phirst/v2/phirst-textes-pur.js).
// Idée 1 la première phrase · idée 2 les réponses de Yann · idée 8 les voisines équipées. Aucune lecture hors du dépôt.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const T = req('../phirst/v2/phirst-textes-pur.js')
const P = req('../phirst/v2/phirst-pur.js')

describe('idée 1 : la première phrase', () => {
  test('chaque motif de la liste a sa raison et sa proposition de départ', () => {
    for (const cle of Object.keys(P.MOTIFS)) {
      const r = T.raisonDe(cle)
      assert.ok(r && r.propo.length > 40, 'motif sans proposition : ' + cle)
    }
    // 27/11/2026 : + les deux phrases des lignes repérées au FINESS (motif « ars », choisies par l'étiquette, voir phirst-finess-phrase.test.mjs)
    assert.equal(T.RAISONS.length, Object.keys(P.MOTIFS).length + 2)
  })
  test('rien écrit par Yann : la proposition, marquée comme telle', () => {
    const p = T.phraseDe('cession', [])
    assert.equal(p.source, 'proposition'); assert.match(T.mentionPhrase(p.source, true).texte, /^Proposition de départ/)
    assert.equal(p.texte, T.raisonDe('cession').propo)
  })
  test('écrite par Yann : sa phrase, et la mention le dit', () => {
    const p = T.phraseDe('cession', [{ cle: 'cession', texte: '  Bonjour, ma phrase.  ' }])
    assert.deepEqual([p.texte, p.source], ['Bonjour, ma phrase.', 'yann'])
    assert.equal(T.mentionPhrase('yann', false).texte, 'Phrase écrite par Yann'); assert.equal(T.mentionPhrase('yann', false).lienReglages, false)
  })
  test('phrase vide ou d’espaces : on retombe sur la proposition (jamais un bloc vide)', () => {
    assert.equal(T.phraseDe('creation', [{ cle: 'creation', texte: '   ' }]).source, 'proposition')
  })
  test('raison inconnue : null, pas d’exception', () => { assert.equal(T.phraseDe('nimporte', []), null); assert.equal(T.phraseDe(null, null), null) })
  test('L4 : les trois raisons (ars, client, recommande) sont passées dans la liste, avec leur étiquette', () => {
    assert.deepEqual(T.A_VENIR, [])
    for (const c of ['ars', 'client', 'recommande']) {
      assert.ok(T.RAISONS.some((r) => r.cle === c), c); assert.ok(P.MOTIFS[c], c)
      assert.equal(T.phraseDe(c, []).source, 'proposition')
      assert.equal(T.phraseDe(c, [{ cle: c, texte: 'Mienne' }]).texte, 'Mienne')
    }
    assert.equal(T.RAISONS.length, 14); assert.equal(new Set(T.RAISONS.map((r) => r.cle)).size, 14)   // 27/11/2026 : 12 + les deux du FINESS
    assert.equal(P.MOTIFS.ars[0], 'Transfert autorisé par l’ARS')
  })
  test('aucune proposition ne parle d’argent', () => {
    for (const r of T.RAISONS.concat(T.A_VENIR)) assert.equal(P.contientMontant(r.propo), false, r.cle)
    for (const r of T.REPONSES_DEPART) assert.equal(P.contientMontant(r.texte), false, r.titre)
  })
  test('texteValide : vide refusé, trop long refusé, somme signalée', () => {
    assert.ok(T.texteValide('  ').erreur); assert.ok(T.texteValide('x'.repeat(1201)).erreur)
    assert.equal(T.texteValide('Un bon texte').alerte, ''); assert.match(T.texteValide('Cela coûte 30 000 €').alerte, /parle d’argent/)
  })
  test('modifiée : aujourd’hui / un autre jour, heure de Paris', () => {
    const maint = Date.parse('2026-11-24T16:00:00Z')
    assert.equal(T.modifiee('2026-11-24T09:05:00Z', maint), 'Modifiée aujourd’hui à 10 h 05')
    assert.equal(T.modifiee('2026-11-20T16:40:00Z', maint), 'Modifiée le 20 novembre à 17 h 40')
    assert.equal(T.modifiee('n’importe quoi', maint), '')
  })
})

describe('idée 2 : les réponses de Yann', () => {
  const MAINT = Date.parse('2026-11-24T12:00:00Z')
  test('le compte du mois : seulement le mois de Paris en cours', () => {
    const c = T.comptesDuMois([
      { texte_id: 'a', created_at: '2026-11-03T10:00:00Z' }, { texte_id: 'a', created_at: '2026-11-24T08:00:00Z' },
      { texte_id: 'a', created_at: '2026-10-31T22:30:00Z' },   // 31 oct 23 h 30 à Paris : octobre
      { texte_id: 'a', created_at: '2026-11-30T23:30:00Z' },   // 1er décembre 0 h 30 à Paris : décembre
      { texte_id: 'b', created_at: '2026-11-01T00:10:00+01:00' }, { texte_id: null, created_at: '2026-11-02T10:00:00Z' }, { texte_id: 'c', created_at: 'x' }, null
    ], MAINT)
    assert.deepEqual(c, { a: 2, b: 1 })
    assert.deepEqual(T.comptesDuMois(null, MAINT), {})
  })
  test('« Entendue N fois ce mois » ; zéro dit ce que ça veut dire', () => {
    assert.equal(T.foisDuMois(9), 'Entendue 9 fois ce mois'); assert.equal(T.foisDuMois(1, true), 'Entendue 1 fois ce mois-ci')
    assert.equal(T.foisDuMois(0), 'Pas encore entendue ce mois'); assert.equal(T.foisDuMois(undefined, true), 'Pas encore entendue ce mois-ci')
  })
  test('tri : la plus entendue d’abord, à égalité l’ordre d’écriture', () => {
    const r = [{ id: 'x' }, { id: 'y' }, { id: 'z' }, { id: 'w' }]
    assert.deepEqual(T.reponsesTriees(r, { y: 5, w: 5, z: 9 }).map((q) => q.id), ['z', 'y', 'w', 'x'])
    assert.deepEqual(T.reponsesTriees(r, null).map((q) => q.id), ['x', 'y', 'z', 'w'])
  })
  test('clé d’une nouvelle réponse : sans accent, unique', () => {
    assert.equal(T.cleDe('Rappelez-moi après l’été', []), 'rappelez-moi-apres-l-ete')
    assert.equal(T.cleDe('Pas le budget', ['pas-le-budget', 'pas-le-budget-2']), 'pas-le-budget-3')
    assert.equal(T.cleDe('« »', []), 'reponse')
  })
  test('ajouter une objection : les deux champs obligatoires, guillemets retirés', () => {
    assert.ok(T.validerReponse('', 'oui').erreur); assert.ok(T.validerReponse('non', '  ').erreur)
    const v = T.validerReponse('« Je dois en parler à mon associé »', ' Bien sûr. ')
    assert.deepEqual([v.titre, v.texte, v.alerte], ['Je dois en parler à mon associé', 'Bien sûr.', ''])
  })
  test('le journal de l’appel : « Il a dit : … », sans doublon ni somme', () => {
    assert.equal(T.ditsEnTexte(['On a déjà un robot', 'On a déjà un robot', 'Pas le budget']), 'Il a dit : « On a déjà un robot », « Pas le budget »')
    assert.equal(T.ditsEnTexte(['Trop cher à 30 000 €']), ''); assert.equal(T.ditsEnTexte([]), ''); assert.equal(T.ditsEnTexte(null), '')
  })
})

describe('idée 8 : les voisines équipées', () => {
  const R = (id, nom, ville, lat, lon, extra = {}) => ({ id, nom, ville, lat, lon, pose: 'Robot Riedl posé', an: 2024, visite: false, ...extra })
  const nantes = { lat: 47.2184, lon: -1.5536 }
  const refs = [R('1', 'Pharmacie des Sables Pâles', 'Challans', 46.846, -1.878), R('2', 'Pharmacie du Val Tamaris', 'Rezé', 47.1827, -1.5496), R('3', 'Pharmacie de la Lande Rousse', 'Saumur', 47.26, -0.077), R('4', 'Sans position', 'X', null, null)]
  test('les deux plus proches, la distance en km (au moins 1)', () => {
    const v = T.voisines(refs, nantes, 2)
    assert.deepEqual(v.map((x) => x.ref.id), ['2', '1']); assert.equal(v[0].km, 4); assert.ok(v[1].km > 40 && v[1].km < 60)
    assert.equal(T.voisines([R('9', 'Même rue', 'Nantes', 47.2184, -1.5536)], nantes)[0].km, 1)
  })
  test('cible sans position, ou aucune référence : liste vide', () => {
    assert.deepEqual(T.voisines(refs, null), []); assert.deepEqual(T.voisines(refs, { lat: null, lon: 1 }), []); assert.deepEqual(T.voisines([], nantes), [])
  })
  test('une référence NON citée n’en sort jamais', () => {
    const l = [
      { id: 'a', titre: 'Citée', details: { ville: 'Rezé', lat: 1, lon: 1, pose: 'x', an: 2024, citee: true, visite: true } },
      { id: 'b', titre: 'Pas citée', details: { ville: 'Rezé', lat: 1, lon: 1, citee: false, visite: true } },
      { id: 'c', titre: 'Sans interrupteur', details: {} }]
    const c = T.referencesCitables(l)
    assert.deepEqual(c.map((r) => r.nom), ['Citée']); assert.equal(c[0].visite, true)
    assert.equal(JSON.stringify(c).includes('Pas citée'), false)
  })
  test('« Phrase prête » : la distance, la pose, l’année, et la visite seulement si elle est possible', () => {
    assert.equal(T.phraseVoisine(R('2', 'P', 'Rezé', 0, 0, { visite: true }), 6),
      'Votre confrère de Rezé, à 6 km, a travaillé avec Yann : robot Riedl posé en 2024. Son titulaire accepte que je vous en parle et vous reçoit volontiers pour une visite.')
    const s = T.phraseVoisine(R('2', 'P', 'Les Herbiers', 0, 0, { pose: 'Agencement complet', an: null }), 35)
    assert.equal(s, 'Votre confrère des Herbiers, à 35 km, a travaillé avec Yann : agencement complet. Son titulaire accepte que je vous en parle.')
    assert.ok(!/visite/.test(s))
    assert.equal(T.de('Auray'), 'd’Auray'); assert.equal(T.de('Le Mans'), 'du Mans'); assert.equal(T.de('Quimper'), 'de Quimper')
  })
  test('le formulaire d’ajout : tout obligatoire, code postal à cinq chiffres, année à quatre', () => {
    const ok = { nom: ' Pharmacie du Val Tamaris ', ville: 'Rezé', cp: '44400', pose: 'Robot Riedl posé', an: '2024' }
    assert.deepEqual(T.validerReference(ok), { nom: 'Pharmacie du Val Tamaris', ville: 'Rezé', cp: '44400', pose: 'Robot Riedl posé', an: 2024 })
    for (const k of ['nom', 'ville', 'pose', 'an']) assert.ok(T.validerReference({ ...ok, [k]: '' }).erreur, k)
    assert.match(T.validerReference({ ...ok, cp: '444' }).erreur, /cinq chiffres/); assert.ok(T.validerReference({ ...ok, an: '24' }).erreur)
  })
  test('une référence naît avec les deux interrupteurs éteints', () => {
    const l = T.ligneReference(T.validerReference({ nom: 'A', ville: 'B', cp: '29100', pose: 'C', an: '2023' }), { lat: 1, lon: 2 }, 'r-1')
    assert.equal(l.details.citee, false); assert.equal(l.details.visite, false); assert.equal(l.sorte, 'reference')
    assert.equal(T.noteReference(l), 'Pas montrée à la téléprospectrice')
    l.details.citee = true; assert.equal(T.noteReference(l), 'Montrée à la téléprospectrice'); l.details.visite = true; assert.equal(T.noteReference(l), 'Montrée à la téléprospectrice · visite possible')
    assert.equal(T.resumeReferences([l, T.ligneReference({ nom: 'x', ville: 'y', cp: '29100', pose: 'z', an: 2020 }, null, 'r-2')]), '1 peut être citée · 1 accepte une visite')
  })
  test('la position : la pharmacie du même nom, sinon la commune, sinon rien', () => {
    const l = [{ nom: 'Pharmacie du Pré Brumeux', lat: 1, lon: 1 }, { nom: 'Pharmacie des Hauts Brumeux', nom_affiche: 'Pharmacie des Hauts Brumeux', lat: 2, lon: 2 }, { nom: 'Sans', lat: null, lon: 3 }]
    assert.deepEqual(T.choisirPosition(l, 'Pharmacie des Hauts Brumeux'), { lat: 2, lon: 2, precise: true })
    assert.deepEqual(T.choisirPosition(l, 'Pharmacie des Ormes Clairs'), { lat: 1, lon: 1, precise: false })
    assert.equal(T.choisirPosition([{ nom: 'x', lat: null, lon: null }], 'x'), null); assert.equal(T.choisirPosition(null, 'x'), null)
  })
})

describe('le chargement dans index.html', () => {
  test('les textes (logique) se chargent avant les écrans qui s’en servent, et leur zone avant Réglages', async () => {
    const { readFileSync } = await import('node:fs')
    const h = readFileSync(new URL('../phirst/v2/index.html', import.meta.url), 'utf8')
    const at = (f) => h.indexOf('src="' + f + '?v=')
    for (const f of ['phirst-textes-pur.js', 'phirst-reglages-textes.js']) assert.ok(at(f) > 0, f + ' absent')
    assert.ok(at('phirst-pur.js') < at('phirst-textes-pur.js') && at('phirst-textes-pur.js') < at('phirst-appels.js'))
    assert.ok(at('phirst-textes-pur.js') < at('phirst-reglages-textes.js') && at('phirst-reglages-textes.js') < at('phirst-reglages.js'))
  })
})
