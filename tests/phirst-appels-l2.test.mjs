// L2 Phirst (24/11/2026) : le bon moment, le relais par écrit, les cinq questions (phirst/v2/phirst-appels-pur.js).
// Aucune lecture hors du dépôt. Noms de pharmacies : aucun ici (identifiants seulement).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const req = createRequire(import.meta.url)
const A = req('../phirst/v2/phirst-appels-pur.js')
const P = req('../phirst/v2/phirst-pur.js')
const T = req('../phirst/v2/phirst-textes-pur.js')

// novembre = heure d'hiver à Paris : 13:00Z = 14 h
const appel = (id, jourIso, heureParis, corps) => ({ prospect_id: id, type: 'appel', body: corps, created_at: `${jourIso}T${String(heureParis - 1).padStart(2, '0')}:10:00Z` })
const REP = 'Appel passé — à rappeler', INJ = 'Appel passé — injoignable', RDV = 'Appel passé — RDV obtenu', NON = 'Appel passé — pas intéressé pour le moment'

describe('idée 3 : le bon moment', () => {
  test('ce que dit une ligne d’appel : texte de logCall, JSON de la V1, et le reste', () => {
    assert.equal(A.resultatAppel(INJ), 'injoignable'); assert.equal(A.resultatAppel(INJ + ' — Il a dit : « X »'), 'injoignable')
    for (const c of [REP, RDV, NON]) assert.equal(A.resultatAppel(c), 'repondu', c)
    assert.equal(A.resultatAppel(JSON.stringify({ resultat: 'injoignable' })), 'injoignable')
    assert.equal(A.resultatAppel(JSON.stringify({ resultat: 'rdv' })), 'repondu')
    assert.equal(A.resultatAppel(JSON.stringify({ resultat: 'barrage' })), 'autre')
    assert.equal(A.resultatAppel('{pas du json'), 'autre'); assert.equal(A.resultatAppel(''), 'autre')
  })
  test('l’heure est celle de Paris (hiver et été)', () => {
    assert.equal(A.heureParis('2026-11-20T13:10:00Z'), 14); assert.equal(A.heureParis('2026-07-20T12:10:00Z'), 14); assert.equal(A.heureParis('n’importe quoi'), -1)
  })
  test('deux appels dont un réponse à 14 h : l’heure habituelle est 14 h', () => {
    const h = A.habitudes([appel('a', '2026-11-03', 10, INJ), appel('a', '2026-11-10', 14, REP)])
    assert.deepEqual(h.a, { h: 14, repondus: 1, appels: 2 })
  })
  test('un seul appel : rien d’appris (la pharmacie garde son rang)', () => {
    assert.deepEqual(A.habitudes([appel('a', '2026-11-10', 14, REP)]), {})
  })
  test('que des injoignables : rien d’appris ; une heure où elle a plus été injoignable que répondu : écartée', () => {
    assert.deepEqual(A.habitudes([appel('a', '2026-11-03', 10, INJ), appel('a', '2026-11-04', 11, INJ)]), {})
    const h = A.habitudes([appel('a', '2026-11-03', 10, REP), appel('a', '2026-11-04', 10, INJ), appel('a', '2026-11-05', 16, REP), appel('a', '2026-11-06', 9, INJ)])
    assert.equal(h.a.h, 16, 'à 10 h : 1 réponse contre 1 injoignable = pas de net positif')
  })
  test('plusieurs heures : celle qui répond le plus gagne', () => {
    const h = A.habitudes([appel('a', '2026-11-03', 9, REP), appel('a', '2026-11-04', 14, REP), appel('a', '2026-11-05', 14, RDV)])
    assert.equal(h.a.h, 14)
  })
  test('chaque pharmacie a son heure', () => {
    const h = A.habitudes([appel('a', '2026-11-03', 9, INJ), appel('a', '2026-11-04', 14, REP), appel('b', '2026-11-03', 9, REP), appel('b', '2026-11-04', 9, NON)])
    assert.equal(h.a.h, 14); assert.equal(h.b.h, 9)
  })
  test('une note ou un autre type de ligne ne compte pas', () => {
    const l = [{ prospect_id: 'a', type: 'note', body: REP, created_at: '2026-11-03T13:00:00Z' }, appel('a', '2026-11-04', 14, REP)]
    assert.deepEqual(A.habitudes(l), {})
  })
  test('le bon moment : une heure de marge de chaque côté', () => {
    const x = { h: 14 }
    assert.ok(A.dansLeBonMoment(x, 13) && A.dansLeBonMoment(x, 14) && A.dansLeBonMoment(x, 15))
    assert.ok(A.dansLeBonMoment({ h: 23 }, 0) && A.dansLeBonMoment({ h: 0 }, 23) && !A.dansLeBonMoment({ h: 22 }, 1), 'minuit est voisin de 23 h et de 1 h')
    assert.ok(!A.dansLeBonMoment(x, 12) && !A.dansLeBonMoment(x, 16) && !A.dansLeBonMoment(null, 14))
  })
  test('le tri : les pharmacies du bon moment d’abord, les autres gardent leur rang, la liste d’origine n’est pas touchée', () => {
    const l = [{ id: 'z1' }, { id: 'a' }, { id: 'z2' }, { id: 'b' }, { id: 'z3' }], hab = { a: { h: 14 }, b: { h: 15 } }
    const avant = JSON.stringify(l)
    const t = A.trierParMoment(l, hab, 14, (r) => r.id)
    assert.deepEqual(t.map((r) => r.id), ['a', 'b', 'z1', 'z2', 'z3'])
    assert.equal(JSON.stringify(l), avant)
    assert.deepEqual(A.trierParMoment(l, hab, 20, (r) => r.id).map((r) => r.id), ['z1', 'a', 'z2', 'b', 'z3'], 'hors du bon moment : rien ne bouge')
    assert.deepEqual(A.trierParMoment(l, {}, 14, (r) => r.id).map((r) => r.id), l.map((r) => r.id), 'rien d’appris : rien ne bouge')
  })
  test('la phrase d’aide dit toujours « utile après quelques semaines » et ne promet rien quand rien n’est appris', () => {
    assert.equal(A.phraseTri('raison', '2026-11-24T14:10', null), 'Appris de vos appels : utile après quelques semaines.')
    const s = A.phraseTri('moment', '2026-11-24T14:10', { apprises: 0, bonnes: 0 })
    assert.match(s, /^Il est 14 h 10\./); assert.match(s, /garde son ordre/); assert.match(s, /utile après quelques semaines\.$/)
    assert.match(A.phraseTri('moment', '2026-11-24T14:10', { apprises: 3, bonnes: 2 }), /passent en premier/)
    assert.match(A.phraseTri('moment', '2026-11-24T14:10', { apprises: 3, bonnes: 0 }), /garde son ordre/)
  })
  test('le bilan compte les heures apprises et les bons moments de la liste', () => {
    assert.deepEqual(A.bilanMoment([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { a: { h: 14 }, b: { h: 9 } }, 14, (r) => r.id), { apprises: 2, bonnes: 1 })
  })
})

describe('idée 4 : le relais par écrit', () => {
  test('« Injoignable » de suite : on s’arrête à la dernière réponse', () => {
    const j = [appel('a', '2026-11-01', 9, INJ), appel('a', '2026-11-02', 9, INJ), appel('a', '2026-11-03', 9, REP), appel('a', '2026-11-04', 9, INJ)]
    assert.equal(A.injoignablesDeSuite(j, 'a'), 1)
    assert.equal(A.injoignablesDeSuite(j.concat(appel('a', '2026-11-05', 9, INJ)), 'a'), 2)
    assert.equal(A.injoignablesDeSuite(j, 'autre'), 0)
  })
  test('la barre : après 2 injoignables ou la réponse « documentation », jamais une fois la lettre envoyée', () => {
    const un = [appel('a', '2026-11-01', 9, INJ)], deux = un.concat(appel('a', '2026-11-02', 9, INJ))
    assert.equal(A.relaisPropose(un, 'a', false), false); assert.equal(A.relaisPropose(deux, 'a', false), true)
    assert.equal(A.relaisPropose(un, 'a', true), true); assert.equal(A.relaisPropose([], null, true), true)
    const env = deux.concat({ prospect_id: 'a', type: 'note', body: A.LETTRE, created_at: '2026-11-03T10:00:00Z' })
    assert.equal(A.relaisPropose(env, 'a', true), false)
  })
  test('la lettre envoyée : le jour de Paris de la note, rappelé en clair', () => {
    const j = [{ prospect_id: 'a', type: 'note', body: A.LETTRE, created_at: '2026-11-24T23:30:00Z' }, { prospect_id: 'a', type: 'note', body: 'autre note', created_at: '2026-11-25T09:00:00Z' }]
    assert.equal(A.lettreEnvoyee(j, 'a'), '2026-11-25', '23 h 30 UTC = 0 h 30 le lendemain à Paris')
    assert.equal(A.phraseLettre('2026-11-24'), 'Lettre envoyée le 24 novembre'); assert.equal(A.phraseLettre(''), '')
    assert.equal(A.lettreEnvoyee(j, 'b'), '')
  })
  test('la réponse « documentation » se reconnaît à son titre', () => {
    assert.ok(A.reponseDocumentation('Envoyez-moi une documentation')); assert.ok(A.reponseDocumentation('Envoyez une plaquette'))
    assert.ok(!A.reponseDocumentation('On a déjà un robot'))
  })
  const marque = { marque: 'Phirst', interlocuteur: 'Nom Signataire', mail: 'x@exemple.fr', tel: '02 61 91 00 00', presentation: 'https://exemple.fr/presentation' }
  const E = req('../phirst/v2/phirst-encaisser-pur.js')
  test('le mail : mots remplacés, lien et signature lus dans le réglage', () => {
    const m = A.mail(T.raisonDe('mail_lettre').propo, { titulaire: 'Mme Dupont', pharmacie: 'Pharmacie d’essai', lien: A.lienPresentation(marque), signature: E.signature(marque), email: 'contact@exemple.fr' })
    assert.match(m.corps, /^Bonjour Madame Dupont,/); assert.match(m.corps, /https:\/\/exemple\.fr\/presentation/)
    assert.match(m.corps, /Bien cordialement,\nNom Signataire\nPhirst · 02 61 91 00 00$/)
    assert.equal(m.sansLien, false); assert.equal(m.a, 'contact@exemple.fr')
    assert.match(m.mailto, /^mailto:contact@exemple\.fr\?subject=/); assert.ok(m.mailto.includes(encodeURIComponent('https://exemple.fr/presentation')))
    assert.doesNotMatch(m.corps, /\{/)
  })
  test('sans lien : la ligne du lien disparaît, le mail le dit, rien n’est inventé', () => {
    const lien = A.lienPresentation({ marque: 'Phirst' })
    assert.equal(lien, '')
    const m = A.mail(T.raisonDe('mail_lettre').propo, { titulaire: '', pharmacie: 'X', lien, signature: '', email: '' })
    assert.equal(m.sansLien, true); assert.doesNotMatch(m.corps, /lire ici|\{lien\}|http/)
    assert.match(m.corps, /^Bonjour,\n/); assert.match(m.corps, /Bien cordialement,$/); assert.doesNotMatch(m.corps, /\n\n\n/)
    assert.equal(m.a, ''); assert.match(m.mailto, /^mailto:\?subject=/)
  })
  test('le lien n’est accepté qu’en https, sans espace', () => {
    assert.equal(A.lienPresentation({ presentation: 'http://exemple.fr/x' }), ''); assert.equal(A.lienPresentation({ presentation: 'javascript:alert(1)' }), '')
    assert.equal(A.lienPresentation({ presentation: 'https://exemple.fr/a b' }), ''); assert.equal(A.lienPresentation(null), '')
  })
  test('une adresse « x@y.fr?cc=… » n’ajoute aucun destinataire (comme Encaisser)', () => {
    const m = A.mail('Bonjour', { email: 'x@exemple.fr?cc=autre@exemple.fr' }); assert.equal(m.a, ''); assert.doesNotMatch(m.mailto, /cc=/)
  })
  test('le texte de départ est celui de Yann une fois écrit : modifiable comme les autres phrases, sans argent, hors de la liste des raisons', () => {
    const r = T.raisonDe('mail_lettre'); assert.ok(r && r.propo.includes('{lien}'))
    assert.equal(P.contientMontant(r.propo), false); assert.ok(!T.RAISONS.some((x) => x.cle === 'mail_lettre'))
    assert.equal(T.phraseDe('mail_lettre', [{ cle: 'mail_lettre', texte: 'Mon texte {lien}' }]).texte, 'Mon texte {lien}')
    assert.equal(T.phraseDe('mail_lettre', []).source, 'proposition')
  })
})

describe('idée 5 : les cinq questions', () => {
  test('« moins de 6 mois » le 24/11/2026 : « d’ici mai 2027 » ; « 6 à 12 mois » : « entre mai et novembre 2027 »', () => {
    assert.equal(A.delai('m6', '2026-11-24'), 'd’ici mai 2027'); assert.equal(A.delai('m12', '2026-11-24'), 'entre mai et novembre 2027')
    assert.equal(A.delai('m12', '2026-03-31'), 'entre septembre 2026 et mars 2027'); assert.equal(A.delai('m6', '2026-08-31'), 'd’ici février 2027', 'un 31 ne déborde pas')
    assert.equal(A.delai('plus', '2026-11-24'), 'plus tard'); assert.equal(A.delai('nsp', '2026-11-24'), ''); assert.equal(A.delai('m6', 'x'), '')
  })
  test('le titre : projets dans l’ordre fixe, délai calculé ; « Premier rendez-vous » si rien', () => {
    assert.equal(A.titreRdv({ projets: ['riedl'], quand: 'm6' }, '2026-11-24'), 'Robot Riedl · d’ici mai 2027')
    assert.equal(A.titreRdv({ projets: ['pda', 'transfert'], quand: 'm12' }, '2026-11-24'), 'Transfert + PDA · entre mai et novembre 2027')
    assert.equal(A.titreRdv({ projets: [], quand: '' }, '2026-11-24'), 'Premier rendez-vous'); assert.equal(A.titreRdv(null, '2026-11-24'), 'Premier rendez-vous')
    assert.equal(A.titreRdv({ projets: [], quand: 'm6' }, '2026-11-24'), 'Premier rendez-vous · d’ici mai 2027')
  })
  test('les réponses : la forme `questions` et les lignes lisibles `questions_lignes`', () => {
    const r = A.questions({ projets: ['riedl'], quand: 'm6', qui: 'associes', robot: 'oui', marque: ' Rowa ', age: 'plus8', surface: '180', lits: '80' }, '2026-11-24')
    assert.deepEqual(r.questions, { v: 1, projets: ['riedl'], quand: 'm6', qui: 'associes', robot: 'oui', marque: 'Rowa', age: 'plus8', surface_m2: 180, lits: 80 })
    assert.deepEqual(r.lignes, ['Projet : Robot Riedl', 'Pour quand : moins de 6 mois (d’ici mai 2027)', 'Qui décide : Plusieurs associés', 'Aujourd’hui : robot Rowa, plus de 8 ans', 'Taille : 180 m² · 80 lits'])
    assert.equal(r.titre, 'Robot Riedl · d’ici mai 2027')
  })
  test('pas de robot, une seule réponse : seulement les lignes répondues', () => {
    const r = A.questions({ projets: [], quand: '', qui: '', robot: 'non', marque: 'Oublié', age: 'plus8', surface: '', lits: '1' }, '2026-11-24')
    assert.deepEqual(r.lignes, ['Aujourd’hui : pas de robot', 'Taille : 1 lit']); assert.equal(r.questions.marque, '', 'la marque d’un robot qui n’existe pas est effacée'); assert.equal(r.questions.age, '')
  })
  test('rien répondu = comme passer ; surface ou lits illisibles et sommes refusés', () => {
    assert.equal(A.questions({}, '2026-11-24').vide, true); assert.equal(A.questions(null, '2026-11-24').titre, 'Premier rendez-vous')
    assert.ok(A.questions({ surface: '18O' }, '2026-11-24').erreur); assert.ok(A.questions({ lits: '0' }, '2026-11-24').erreur); assert.ok(A.questions({ surface: '1234567' }, '2026-11-24').erreur)
    assert.ok(A.questions({ robot: 'oui', marque: '25 000 €' }, '2026-11-24').erreur); assert.ok(A.questions({ robot: 'oui', marque: 'x'.repeat(41) }, '2026-11-24').erreur)
    assert.equal(A.questions({ surface: '1 800' }, '2026-11-24').questions.surface_m2, 1800, 'les espaces d’un nombre sont permis')
  })
  test('aucune ligne lisible ne parle d’argent (la base le refuserait pour l’objet)', () => {
    const r = A.questions({ projets: ['riedl', 'pda', 'transfert', 'agencement'], quand: 'm12', qui: 'groupement', robot: 'oui', marque: 'Mach', age: '3a8', surface: '99999', lits: '999' }, '2026-11-24')
    for (const l of r.lignes.concat(r.titre)) assert.equal(P.contientMontant(l), false, l)
  })
  test('le corps du rendez-vous écrit : objet, questions, questions_lignes ; passer = seulement l’objet', () => {
    const r = A.questions({ projets: ['riedl'], quand: 'm6' }, '2026-11-24')
    const x = A.extraRdv(r, '2026-11-24', { debut: '2026-12-01T09:00', duree_min: 60, lieu: 'Ici' })
    assert.equal(x.objet, 'Robot Riedl · d’ici mai 2027'); assert.deepEqual(x.questions_lignes, r.lignes); assert.deepEqual(x.questions, r.questions); assert.equal(x.duree_min, 60)
    const y = A.extraRdv(null, '2026-11-24', { debut: '2026-12-01T09:00' }); assert.deepEqual(Object.keys(y).sort(), ['debut', 'objet']); assert.equal(y.objet, 'Premier rendez-vous')
    const z = A.extraRdv({ vide: true, titre: 'Premier rendez-vous · d’ici mai 2027' }, '2026-11-24', {}); assert.equal(z.questions, undefined)
  })
  test('le contrat avec la veille : le corps écrit se relit tel quel (objet, questions, questions_lignes) par l’agenda', () => {
    const r = A.questions({ projets: ['pda'], quand: 'm6', lits: '80' }, '2026-11-24')
    const corps = P.corpsRdv('creer', '11111111-1111-4111-8111-111111111111', 'u1', A.extraRdv(r, '2026-11-24', { debut: '2026-12-01T09:00', duree_min: 60, lieu: 'Ici' }))
    assert.ok(corps.length < 4000, 'la base refuse un corps de plus de 4 000 caractères')
    const e = P.etatsDesRdv([{ id: 'l1', prospect_id: 'p1', author_id: 'tele', created_at: '2026-11-24T10:00:00Z', body: corps }], () => true)[0]
    assert.equal(e.objet, 'PDA · d’ici mai 2027'); assert.deepEqual(e.questions_lignes, r.lignes); assert.deepEqual(e.questions, r.questions)
    const sans = P.etatsDesRdv([{ id: 'l2', prospect_id: 'p1', author_id: 'tele', created_at: '2026-11-24T10:00:00Z', body: P.corpsRdv('creer', '22222222-2222-4222-8222-222222222222', 'u1', { debut: '2026-12-01T09:00' }) }], () => true)[0]
    assert.deepEqual(sans.questions_lignes, []); assert.equal(sans.questions, null)
  })
  test('un geste « déplacer » qui ne porte pas les réponses ne les efface pas ; les lignes ressortent intactes (accents, guillemets, signes)', () => {
    const lignes = ['Projet : Robot Riedl', 'Pour quand : moins de 6 mois (d’ici mai 2027)', 'Aujourd’hui : robot « Rowa », plus de 8 ans', 'Taille : 180 m² · 80 lits']
    const id = '44444444-4444-4444-8444-444444444444'
    const creer = { id: 'a', prospect_id: 'p1', author_id: 'tele', created_at: '2026-11-24T10:00:00Z', body: P.corpsRdv('creer', id, 'u1', { debut: '2026-12-01T09:00', duree_min: 60, objet: 'Robot Riedl · d’ici mai 2027', questions: { v: 1, projets: ['riedl'] }, questions_lignes: lignes }) }
    const depl = { id: 'b', prospect_id: 'p1', author_id: 'u', created_at: '2026-11-25T10:00:00Z', body: P.corpsRdv('deplacer', id, 'u1', { debut: '2026-12-02T09:00' }) }
    const e = P.etatsDesRdv([creer, depl], () => false)[0]
    assert.deepEqual(e.questions_lignes, lignes); assert.deepEqual(e.questions, { v: 1, projets: ['riedl'] }); assert.equal(e.debut, '2026-12-02T09:00')
  })
  test('un corps mal formé n’abîme pas l’agenda : lignes en trop ou pas du texte écartées', () => {
    const c = P.corpsRdv('creer', '33333333-3333-4333-8333-333333333333', 'u1', { debut: '2026-12-01T09:00', questions_lignes: ['a', 3, null, '  ', 'b'].concat(Array(20).fill('x'.repeat(500))), questions: [1, 2] })
    const e = P.etatsDesRdv([{ id: 'l3', prospect_id: 'p1', author_id: 'u', created_at: '2026-11-24T10:00:00Z', body: c }], () => false)[0]
    assert.equal(e.questions_lignes.length, 8); assert.equal(e.questions_lignes[0], 'a'); assert.equal(e.questions_lignes[1], 'b'); assert.ok(e.questions_lignes.every((x) => x.length <= 160)); assert.equal(e.questions, null)
  })
})

describe('branchement', () => {
  const html = readFileSync(new URL('../phirst/v2/index.html', import.meta.url), 'utf8')
  const at = (f) => html.indexOf('src="' + f)
  test('phirst-appels-pur.js est chargé après phirst-pur.js et avant phirst-appels.js', () => {
    assert.ok(at('phirst-appels-pur.js') > at('phirst-pur.js') && at('phirst-appels-pur.js') < at('phirst-appels.js'))
  })
  test('aucune adresse web écrite en dur : le lien et la signature se lisent dans le réglage', () => {
    const src = readFileSync(new URL('../phirst/v2/phirst-appels-pur.js', import.meta.url), 'utf8') + readFileSync(new URL('../phirst/v2/phirst-appels.js', import.meta.url), 'utf8')
    assert.doesNotMatch(src, /https?:\/\/[a-z0-9.-]+\.(?:fr|com|app)\//i, 'aucune adresse web écrite dans le code')
    assert.match(readFileSync(new URL('../phirst/v2/phirst-appels.js', import.meta.url), 'utf8'), /phirst_marque_publique/)
  })
})
