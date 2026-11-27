// Logique pure des écrans Appels / Veille / Pistes de Phirst (phirst/v2/phirst-pur.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const P = createRequire(import.meta.url)('../phirst/v2/phirst-pur.js')
const J = '2026-11-21'

test('ordre du secteur : 44 avant 29, hors secteur à la fin', () => {
  assert.ok(P.rang('44') < P.rang('29'))
  assert.equal(P.rang('13'), 999)
  assert.equal(P.rang('44100'), 0)
  assert.equal(P.primeSecteur('44'), 24)
  assert.equal(P.primeSecteur('13'), -12)
})
test('Île-de-France dans le secteur (27/11/2026) : après le Grand Ouest, jamais sous le hors-secteur, Grand Ouest inchangé', () => {
  const IDF = ['75', '92', '93', '94', '78', '91', '95', '77']
  for (const d of IDF) { assert.ok(P.dansSecteur(d), d); assert.ok(P.rang(d) > P.rang('61'), d); assert.ok(P.primeSecteur(d) >= 0 && P.primeSecteur(d) > P.primeSecteur('13'), d) }
  assert.ok(P.dansSecteur('75011') && P.dansSecteur('77300'))
  assert.equal(P.SECTEUR.length, 20)
  assert.deepEqual(P.SECTEUR.slice(0, 12), ['44', '49', '35', '56', '29', '22', '72', '37', '14', '85', '50', '61'])
  assert.deepEqual(P.SECTEUR.slice(0, 12).map(P.primeSecteur), [24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2])
  for (const d of ['13', '69', '33', '59', '2A']) assert.equal(P.dansSecteur(d), false, d)
})
test('cle : sans accents ni casse', () => {
  assert.equal(P.cle('Pharmacie DU Stade', 'Rennes'), P.cle('pharmacie du stade ', 'RENNES'))
  assert.equal(P.cle('Pharmacie de l’Église', 'X'), 'pharmacie de l’eglise|x')
})
test('dates : jours entre, ajout, texte', () => {
  assert.equal(P.ajouterJours('2026-11-21', 7), '2026-11-28')
  assert.equal(P.joursEntre('2026-11-14', '2026-11-21'), 7)
  assert.equal(P.jourFr('2026-11-17'), '17 novembre')
  assert.equal(P.age('2026-11-20', J), 'hier')
  assert.equal(P.age('2026-11-18', J), 'il y a 3 jours')
})
test('suites d’un appel : les quatre écritures de logCall', () => {
  const rdv = P.suiteAppel('rdv', J)
  assert.deepEqual(rdv.maj, { stage: 'rdv_fixe', next_action: 'Préparer le RDV', next_action_date: '2026-11-23' })
  assert.equal(rdv.body, 'Appel passé — RDV obtenu')
  const rap = P.suiteAppel('rappeler', J)
  assert.deepEqual(rap.maj, { stage: 'a_rappeler', next_action: 'Rappeler', next_action_date: '2026-11-28' })
  assert.equal(P.suiteAppel('rappeler', J, '2026-12-02').maj.next_action_date, '2026-12-02')
  assert.equal(P.suiteAppel('rappeler', J, '2026-11-01').maj.next_action_date, '2026-11-28') // date passée refusée
  const inj = P.suiteAppel('injoignable', J)
  assert.deepEqual(inj.maj, { next_action: 'Retenter l’appel', next_action_date: '2026-11-24' }) // pas de changement d'étape
  const non = P.suiteAppel('non', J)
  assert.deepEqual(non.maj, { stage: 'perdu', next_action: null, next_action_date: null })
  assert.equal(non.body, 'Appel passé — pas intéressé pour le moment')
  assert.equal(P.suiteAppel('rdv', J, null, ' Il rappelle ').body, 'Appel passé — RDV obtenu — Il rappelle')
})
const f = (o) => ({ id: 'i' + o.nom, ville: 'Nantes', cp: '44000', departement: '44', stage: 'a_qualifier', next_action: null, next_action_date: null, telephone: null, ...o })
test('relances dues : échues, secteur, ni clos ni futures', () => {
  const r = P.relancesDues([
    f({ nom: 'A', next_action: 'Rappeler', next_action_date: '2026-11-19' }),
    f({ nom: 'B', next_action_date: '2026-11-21' }),
    f({ nom: 'C', next_action_date: '2026-11-22' }),
    f({ nom: 'D', next_action_date: '2026-11-01', stage: 'perdu' }),
    f({ nom: 'E', next_action_date: '2026-11-01', stage: 'archive' }),
    f({ nom: 'F', next_action_date: '2026-11-01', departement: '13', cp: '13001' }),
  ], J)
  assert.deepEqual(r.map((x) => x.nom).sort(), ['A', 'B'])
  const a = r.find((x) => x.nom === 'A')
  assert.equal(a.score, 200 + 2 + 24)
  assert.match(a.raisons[0], /^Relance en retard de 2 jours : Rappeler$/)
  assert.match(r.find((x) => x.nom === 'B').raisons[0], /^Relance prévue aujourd’hui/)
})
const rob = (o) => ({ cle: P.cle(o.nom, o.ville || 'Nantes'), ville: 'Nantes', dep: '44', motif: 'cession', score: 130, raisons: ['x'], prospectId: null, ...o })
test('liste du jour : relance devant tout, exclusions, appelée il y a moins de 15 jours', () => {
  const fiches = [
    f({ nom: 'Relancee', next_action_date: '2026-11-20' }),
    f({ nom: 'Signee', stage: 'signe' }),
    f({ nom: 'Appelee' }),
    f({ nom: 'Ancienne' }),
  ]
  const dernier = { iAppelee: '2026-11-10', iAncienne: '2026-11-01' } // 11 jours ; 20 jours
  const l = P.listeDuJour([rob({ nom: 'Libre', score: 140 }), rob({ nom: 'Signee' }), rob({ nom: 'Appelee' }), rob({ nom: 'Ancienne' }),
    rob({ nom: 'Relancee', motif: 'relance', score: 210 })], fiches, dernier, J)
  assert.deepEqual(l.map((x) => x.nom), ['Relancee', 'Libre', 'Ancienne'])
  assert.equal(l[0].motif, 'relance')
})
test('liste du jour : une relance du robot reprogrammée depuis n’est plus due ; une relance due absente du robot apparaît', () => {
  const l = P.listeDuJour([rob({ nom: 'Reprog', motif: 'relance', prospectId: 'iReprog', score: 210 })],
    [f({ nom: 'Reprog', next_action_date: '2026-11-28' }), f({ nom: 'Due', next_action_date: '2026-11-21' })], {}, J)
  assert.deepEqual(l.map((x) => x.nom), ['Due'])
})
test('liste du jour : après un appel noté aujourd’hui, la ligne sort', () => {
  const fi = [f({ nom: 'Libre' })]
  assert.equal(P.listeDuJour([rob({ nom: 'Libre' })], fi, {}, J).length, 1)
  assert.equal(P.listeDuJour([rob({ nom: 'Libre' })], fi, { iLibre: J }, J).length, 0)
})
test('liste du jour : l’ordre de départements départage deux scores égaux', () => {
  const l = P.listeDuJour([rob({ nom: 'Z', dep: '35', ville: 'Rennes' }), rob({ nom: 'Y', dep: '44' })], [], {}, J)
  assert.deepEqual(l.map((x) => x.dep), ['44', '35'])
})
test('pistes par étape : archivées exclues, ordre du pipeline', () => {
  const g = P.grouperParEtape([f({ nom: 'A', stage: 'archive' }), f({ nom: 'B', stage: 'rdv_fixe' }), f({ nom: 'C', stage: 'a_qualifier' }), f({ nom: 'D', stage: 'a_qualifier', next_action_date: '2026-11-22' })])
  assert.deepEqual(g.map((e) => e.fiches.length), [2, 0, 1, 0, 0, 0, 0])
  assert.equal(g[0].fiches[0].nom, 'D') // l'échéance la plus proche d'abord
  assert.ok(!g.some((e) => e.fiches.some((x) => x.nom === 'A')))
})
test('veille : tri par secteur puis date, filtres, comptes', () => {
  const v = [
    { nom: 'B', dep: '29', date: '2026-11-10', famille: 'cession_pharmacie' },
    { nom: 'A', dep: '44', date: '2026-11-01', famille: 'creation_pharmacie' },
    { nom: 'C', dep: '44', date: '2026-11-15', famille: 'procedure_collective' },
  ]
  assert.deepEqual(P.trierVeille(v).map((x) => x.nom), ['C', 'A', 'B'])
  assert.deepEqual(P.filtrerVeille(v, 'cession_pharmacie', '').map((x) => x.nom), ['B'])
  assert.deepEqual(P.filtrerVeille(v, '', '44').map((x) => x.nom), ['A', 'C'])
  assert.deepEqual(P.departementsDe(v), [{ dep: '44', n: 2 }, { dep: '29', n: 1 }])
  assert.equal(P.compterFamilles(v).cession_pharmacie, 1)
})
test('journal : texte V1 ancien, JSON V1 récent, note', () => {
  assert.equal(P.phraseJournal('appel', 'Appel passé — à rappeler'), 'Appel passé — à rappeler')
  assert.equal(P.phraseJournal('appel', JSON.stringify({ v: 1, resultat: 'rappeler', rappel: '2026-11-25T10:00' })), 'Appel · À rappeler — rappel le 25 novembre')
  assert.equal(P.phraseJournal('note', 'Cession d’officine'), 'Cession d’officine')
  assert.equal(P.phraseJournal('note', ''), 'Note')
})
test('lienSur : http et https gardés, le reste refusé', () => {
  assert.equal(P.lienSur('https://www.bodacc.fr/a?q=1'), 'https://www.bodacc.fr/a?q=1')
  assert.equal(P.lienSur('http://exemple.fr/x'), 'http://exemple.fr/x')
  assert.equal(P.lienSur('javascript:alert(1)'), '')
  assert.equal(P.lienSur('JaVaScRiPt:alert(1)'), '')
  assert.equal(P.lienSur('data:text/html,<b>x</b>'), '')
  assert.equal(P.lienSur(''), '')
  assert.equal(P.lienSur(null), '')
  assert.equal(P.lienSur('texte quelconque'), '')
})

test('liste du jour : la fiche créée depuis l’écran (nom de vue) est reconnue même si la clé du robot porte le nom brut', () => {
  // le robot garde la clé de la V1 (« Pharmacie le Roch - Lorient|lorient ») ; la fiche porte le nom affiché
  const r = { cle: 'pharmacie le roch - lorient|lorient', nom: 'Pharmacie le Roch', ville: 'Lorient', dep: '56', motif: 'omnicell', score: 90, raisons: ['x'] }
  const ouverte = [{ id: 'r1', nom: 'Pharmacie le Roch', ville: 'Lorient', stage: 'a_qualifier' }]
  assert.equal(P.listeDuJour([r], ouverte, { r1: '2026-11-20' }, '2026-11-20').length, 0, 'appelée aujourd’hui : sort de la liste')
  const archivee = [{ id: 'r1', nom: 'Pharmacie le Roch', ville: 'Lorient', stage: 'archive' }]
  assert.equal(P.listeDuJour([r], archivee, {}, '2026-11-20').length, 0, 'fiche archivée : sort de la liste')
  const l = P.listeDuJour([r], ouverte, {}, '2026-11-20')
  assert.equal(l.length, 1)
  assert.equal(l[0].prospectId, 'r1', 'reliée à la fiche ouverte')
})
