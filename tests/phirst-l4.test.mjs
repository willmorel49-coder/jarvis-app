// Phirst · lot L4 (24/11/2026) · idée 9 « Ce client reviendra », idée 10 « Un confrère qui a un projet ? » et les trois raisons nouvelles de la liste d'appels
// (ars, client, recommande) : logique pure (phirst-chantiers-pur.js, phirst-pur.js, phirst-textes-pur.js) + garde-fous de l'écran. Aucune lecture hors du dépôt.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const C = req('../phirst/v2/phirst-chantiers-pur.js')
const P = req('../phirst/v2/phirst-pur.js')
const T = req('../phirst/v2/phirst-textes-pur.js')
const lire = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

const AUJ = '2026-11-25'
const monte = (o = {}) => ({ c: { id: 'c1', volet_id: 'v1', recuLe: '2026-08-21', ...o }, volet: { sorte: 'agencement' } })
const ligne = (o = {}) => ({ id: 'r1', chantier_id: 'c1', type: 'bilan', mois: 3, robot: null, echeance: '2026-11-21', raison: 'x', etiquette: 'Client · bilan à 3 mois', note: null, retire_le: null, fait_le: null, ...o })

describe('idée 9 · les échéances se CALCULENT depuis la date de réception', () => {
  test('ajouterMois : un jour trop long devient le dernier jour du mois (31 août + 6 mois = 28 février), même en année bissextile', () => {
    assert.equal(C.ajouterMois('2026-08-31', 6), '2027-02-28'); assert.equal(C.ajouterMois('2027-08-31', 6), '2028-02-29')
    assert.equal(C.ajouterMois('2026-11-30', 3), '2027-02-28'); assert.equal(C.ajouterMois('2026-12-15', 1), '2027-01-15'); assert.equal(C.ajouterMois('2026-08-21', 120), '2036-08-21')
  })
  test('trois rappels pour une pharmacie qui a un robot : bilan, entretien, remplacement ; deux sinon', () => {
    const avec = C.rappelsAProgrammer(monte(), 'riedl', []), sans = C.rappelsAProgrammer(monte(), null, [])
    assert.deepEqual(avec.map((r) => [r.type, r.mois, r.echeance]), [['bilan', 3, '2026-11-21'], ['entretien', 12, '2027-08-21'], ['remplacement', 120, '2036-08-21']])
    assert.deepEqual(sans.map((r) => r.type), ['bilan', 'entretien'])
    assert.ok(avec.every((r) => r.chantier_id === 'c1'))
  })
  test('rien en dur : une autre date de réception donne d’autres échéances', () => {
    const a = C.rappelsAProgrammer(monte({ recuLe: '2027-01-31' }), null, [])
    assert.deepEqual(a.map((r) => r.echeance), ['2027-04-30', '2028-01-31'])
  })
  test('un chantier pas réceptionné ne programme rien ; un type déjà programmé n’est jamais doublé', () => {
    assert.deepEqual(C.rappelsAProgrammer(monte({ recuLe: null }), 'riedl', []), [])
    assert.deepEqual(C.rappelsAProgrammer(monte(), 'riedl', [{ type: 'bilan' }, { type: 'entretien' }]).map((r) => r.type), ['remplacement'])
    assert.deepEqual(C.rappelsAProgrammer(monte(), 'riedl', [{ type: 'bilan' }, { type: 'entretien' }, { type: 'remplacement' }]), [])
  })
  test('le robot d’une pharmacie : un volet Riedl ou PDA de son dossier', () => {
    assert.equal(C.robotDePharmacie({ volets: [{ sorte: 'agencement' }, { sorte: 'pda' }] }), 'pda'); assert.equal(C.robotDePharmacie({ volets: [{ sorte: 'riedl' }] }), 'riedl')
    assert.equal(C.robotDePharmacie({ volets: [{ sorte: 'agencement' }, { sorte: 'transfert' }] }), null); assert.equal(C.robotDePharmacie(null), null)
  })
  test('les phrases, comme la maquette, et aucune somme dedans', () => {
    assert.equal(C.raisonRappel('bilan', 3, 'agencement', null), 'Il y a 3 mois, réception du chantier d’agencement : un bilan à faire avec le pharmacien')
    assert.equal(C.raisonRappel('bilan', 3, 'transfert', null), 'Il y a 3 mois, réception du chantier de transfert : un bilan à faire avec le pharmacien')
    assert.equal(C.raisonRappel('entretien', 12, 'agencement', 'riedl'), 'Il y a un an, pose du robot Riedl : le contrat d’entretien est à proposer')
    assert.equal(C.raisonRappel('remplacement', 120, 'agencement', 'pda'), 'Il y a dix ans, pose du robot PDA : un remplacement à étudier')
    assert.equal(C.etiquetteRappel('bilan', 3), 'Client · bilan à 3 mois'); assert.equal(C.etiquetteRappel('bilan', 12), 'Client · bilan à 1 an')
    assert.equal(C.etiquetteRappel('entretien', 12), 'Client · contrat d’entretien'); assert.equal(C.etiquetteRappel('remplacement', 120), 'Client · remplacement du robot')
    assert.equal(C.titreRappel('bilan', 3), 'Bilan à 3 mois'); assert.equal(C.titreRappel('remplacement', 120), 'Remplacement du robot à étudier')
    for (const r of C.rappelsAProgrammer(monte(), 'riedl', [])) { assert.equal(P.contientMontant(r.raison), false, r.raison); assert.equal(P.contientMontant(r.etiquette), false, r.etiquette); assert.ok(r.etiquette.length <= 60 && r.raison.length <= 240) }
  })
  test('« Il y a … » vient de la durée enregistrée, pas d’un texte figé', () => {
    assert.equal(C.ilYa(1), 'Il y a 1 mois'); assert.equal(C.ilYa(18), 'Il y a 18 mois'); assert.equal(C.ilYa(24), 'Il y a deux ans'); assert.equal(C.ilYa(144), 'Il y a 12 ans')
  })
})

describe('idée 9 · l’écran d’un rappel', () => {
  test('monterRappel : passé ou à venir, retiré, fait ; le tri suit bilan, entretien, remplacement', () => {
    const l = [ligne({ id: 'c', type: 'remplacement', mois: 120, echeance: '2036-08-21' }), ligne({ id: 'b' }), ligne({ id: 'a', type: 'entretien', mois: 12, echeance: '2027-08-21', retire_le: '2026-11-24' }), ligne({ id: 'x', chantier_id: 'autre' })]
    const R = C.rappelsDuChantier(l, 'c1', AUJ)
    assert.deepEqual(R.map((r) => r.id), ['b', 'a', 'c']); assert.equal(R[0].passe, true); assert.equal(R[1].retire, true); assert.equal(R[2].passe, false)
  })
  test('quandRappel : « le 21 novembre 2026 » ; le remplacement, si loin, « en août 2036 »', () => {
    assert.equal(C.quandRappel({ type: 'bilan', date: '2026-11-21' }), 'le 21 novembre 2026'); assert.equal(C.quandRappel({ type: 'remplacement', date: '2036-08-21' }), 'en août 2036')
  })
  test('bilanAFaire : arrivé, ni retiré ni fait', () => {
    const R = (o) => C.rappelsDuChantier([ligne(o)], 'c1', AUJ)
    assert.ok(C.bilanAFaire(R({}))); assert.equal(C.bilanAFaire(R({ echeance: '2026-12-01' })), null); assert.equal(C.bilanAFaire(R({ retire_le: '2026-11-24' })), null); assert.equal(C.bilanAFaire(R({ fait_le: '2026-11-24' })), null)
    assert.equal(C.bilanAFaire(R({ type: 'entretien' })), null)
  })
  test('une nouvelle date : un vrai jour, pas avant aujourd’hui', () => {
    assert.equal(C.verifierDateRappel('', AUJ).ok, false); assert.equal(C.verifierDateRappel('2026-11-24', AUJ).ok, false); assert.equal(C.verifierDateRappel('2026-02-31', AUJ).ok, false)
    assert.deepEqual(C.verifierDateRappel('2026-11-25', AUJ), { ok: true, valeur: '2026-11-25' })
  })
  test('le résumé de la carte garde les rappels non retirés', () => {
    const R = C.rappelsDuChantier([ligne(), ligne({ id: 'e', type: 'entretien', mois: 12, echeance: '2027-08-21', retire_le: '2026-11-24' })], 'c1', AUJ)
    assert.deepEqual(C.resumeRappels(R), [{ titre: 'Bilan à 3 mois', quand: 'le 21 novembre 2026' }])
  })
})

describe('idée 10 · le confrère recommandé', () => {
  test('nom et ville obligatoires, longueurs, note facultative', () => {
    assert.equal(C.verifierConfrere({ nom: '', ville: 'Brest' }).ok, false); assert.equal(C.verifierConfrere({ nom: 'Pharmacie des Hauts Frênes', ville: ' ' }).champ, 'ville')
    assert.equal(C.verifierConfrere({ nom: 'x'.repeat(121), ville: 'Brest' }).ok, false); assert.equal(C.verifierConfrere({ nom: 'A', ville: 'B', note: 'n'.repeat(301) }).ok, false)
    assert.deepEqual(C.verifierConfrere({ nom: '  Pharmacie  des   Hauts Frênes ', ville: 'Brest', note: '' }).valeur, { nom: 'Pharmacie des Hauts Frênes', ville: 'Brest', note: null })
  })
  test('le même confrère n’entre pas deux fois (accents et majuscules ignorés), sauf s’il a été retiré', () => {
    const deja = [{ nom: 'Pharmacie des Hauts Frênes', ville: 'Brest', retire: false }]
    assert.equal(C.verifierConfrere({ nom: 'PHARMACIE DES HAUTS FRENES', ville: 'brest' }, deja).ok, false)
    assert.equal(C.verifierConfrere({ nom: 'PHARMACIE DES HAUTS FRENES', ville: 'brest' }, [{ ...deja[0], retire: true }]).ok, true)
  })
  test('une note qui parle d’argent s’enregistre mais prévient (la téléprospectrice ne la verra pas)', () => {
    assert.ok(C.verifierConfrere({ nom: 'A', ville: 'B', note: 'budget 50 k€' }).alerte); assert.equal(C.verifierConfrere({ nom: 'A', ville: 'B', note: 'il parle de s’agrandir' }).alerte, '')
  })
  test('« de la part de … » ; les confrères d’un chantier, du plus ancien au plus récent', () => {
    assert.equal(C.phraseDeLaPart(' Pharmacie du Bocage Clair '), 'de la part de Pharmacie du Bocage Clair')
    const l = C.confreresDuChantier([{ id: 'b', chantier_id: 'c1', nom: 'B', ville: 'V', par: 'P', created_at: '2026-11-02' }, { id: 'a', chantier_id: 'c1', nom: 'A', ville: 'V', par: 'P', created_at: '2026-11-01' }, { id: 'z', chantier_id: 'c2', nom: 'Z', ville: 'V', par: 'P' }], 'c1')
    assert.deepEqual(l.map((x) => x.id), ['a', 'b'])
  })
})

describe('les trois raisons dans la liste d’appels', () => {
  test('étiquettes dans P.MOTIFS ; phrases dans RAISONS (Réglages) ; plus rien « à venir »', () => {
    assert.deepEqual(P.MOTIFS.ars, ['Transfert autorisé par l’ARS', 'orange']); assert.equal(P.MOTIFS.client[0], 'Client qui revient'); assert.equal(P.MOTIFS.recommande[0], 'Recommandé par un confrère')
    for (const c of ['ars', 'client', 'recommande']) assert.ok(T.RAISONS.some((r) => r.cle === c), c)
    assert.equal(T.A_VENIR.length, 0)
  })
  test('l’étiquette écrite par le robot remplace celle du motif, pour ces trois motifs seulement, jamais si elle parle d’argent', () => {
    assert.deepEqual(P.etiquetteDe({ motif: 'client', etiquette: 'Client · bilan à 3 mois' }), ['Client · bilan à 3 mois', 'vert'])
    assert.deepEqual(P.etiquetteDe({ motif: 'recommande', etiquette: 'De la part de Pharmacie du Bocage Clair' }), ['De la part de Pharmacie du Bocage Clair', 'vert'])
    assert.deepEqual(P.etiquetteDe({ motif: 'ars', etiquette: 'Regroupement autorisé par l’ARS' }), ['Regroupement autorisé par l’ARS', 'orange'])
    assert.deepEqual(P.etiquetteDe({ motif: 'client' }), P.MOTIFS.client); assert.deepEqual(P.etiquetteDe({ motif: 'client', etiquette: 'Client · 12 000 € HT' }), P.MOTIFS.client)
    assert.deepEqual(P.etiquetteDe({ motif: 'pmr', etiquette: 'Texte inventé' }), P.MOTIFS.pmr); assert.deepEqual(P.etiquetteDe({ motif: 'inconnu' }), ['Signal', ''])
  })
  test('le rang : une relance promise devant tout ; confrère, client, puis les décisions de l’ARS parmi les autres signaux', () => {
    const R = P.RANGS_L4
    assert.ok(R.relance[0] > R.recommande[1] && R.recommande[0] > R.client[1] && R.client[0] > R.ars[1] && R.ars[0] > 0)
    const ligneRobot = (nom, motif, score) => ({ cle: nom, nom, ville: 'Brest', cp: '29200', dep: '29', motif, score, raisons: ['r'], telephone: null })
    const fiches = [{ id: 'f1', nom: 'Pharmacie Promise', ville: 'Brest', cp: '29200', departement: '29', stage: 'a_rappeler', next_action: 'Rappeler', next_action_date: '2026-11-25' }]
    const l = P.listeDuJour([ligneRobot('Pharmacie Dix', 'pmr', 97), ligneRobot('Pharmacie Ars', 'ars', 130), ligneRobot('Pharmacie Client', 'client', 184), ligneRobot('Pharmacie Amie', 'recommande', 192)], fiches, {}, AUJ)
    assert.deepEqual(l.map((x) => x.motif), ['relance', 'recommande', 'client', 'ars', 'pmr'])
  })
  test('un client dont le rappel arrive a une fiche « signé » : il reste dans la liste ; perdue ou archivée : jamais ; un autre motif « signé » : retiré comme avant', () => {
    const fiche = (stage) => [{ id: 'f1', nom: 'Pharmacie Client', ville: 'Brest', cp: '29200', departement: '29', stage }]
    const r = (motif) => [{ cle: 'x', nom: 'Pharmacie Client', ville: 'Brest', cp: '29200', dep: '29', motif, score: 184, raisons: ['r'], telephone: null }]
    assert.equal(P.listeDuJour(r('client'), fiche('signe'), {}, AUJ).length, 1)
    assert.equal(P.listeDuJour(r('client'), fiche('perdu'), {}, AUJ).length, 0); assert.equal(P.listeDuJour(r('client'), fiche('archive'), {}, AUJ).length, 0)
    assert.equal(P.listeDuJour(r('recommande'), fiche('signe'), {}, AUJ).length, 0); assert.equal(P.listeDuJour(r('client'), fiche('a_qualifier'), { f1: '2026-11-20' }, AUJ).length, 0)   // appelée il y a 5 jours : repos de 14 jours
  })
  test('l’accueil de la téléprospectrice montre aussi l’étiquette écrite par le robot', () => {
    const m = P.momentDeTelepro({ frais: true, trouver: { appels: [{ nom: 'Pharmacie Client', ville: 'Brest', motif: 'client', etiquette: 'Client · bilan à 3 mois', raisons: ['Il y a 3 mois…'] }], veille: [] } })[0]
    assert.equal(m.pharmacies[0].etiquette.t, 'Client · bilan à 3 mois'); assert.equal(m.chose.heure, 'Client · bilan à 3 mois')
  })
})

describe('garde-fous de l’écran', () => {
  const ecran = lire('phirst/v2/phirst-chantiers.js'), appels = lire('phirst/v2/phirst-appels.js')
  test('Chantiers : si les deux tables n’existent pas encore, le reste de l’écran garde tout ce qu’il avait', () => {
    assert.match(ecran, /from\('chantier_rappels'\)\.select\('\*'\)\.order\('id'\); \}\)\.then\(null, function \(\) \{ return null; \}\)/)
    assert.match(ecran, /from\('chantier_confreres'\)\.select\('\*'\)\.order\('id'\); \}\)\.then\(null, function \(\) \{ return null; \}\)/)
    assert.match(ecran, /S\.sansRappels = x\[7\] === null \|\| x\[8\] === null/)
  })
  test('la réception programme les rappels (échéances calculées par la logique pure) ; aucun jour ni durée écrits dans l’écran', () => {
    assert.match(ecran, /C\.rappelsAProgrammer\(x, C\.robotDePharmacie\(x\.ph\), rappelsDe\(x\)\)/)
    assert.match(ecran, /return ecrireRappels\(un\(S\.fc\)\)/)
    assert.doesNotMatch(ecran.replace(/\/\*[\s\S]*?\*\//g, ''), /ajouterMois|mois: ?\d|\b3 mois|\b12 mois|\b120 mois/)
  })
  test('rien ne s’efface : retirer = retire_le, bilan fait = fait_le ; la téléprospectrice n’a aucune porte vers ces tables', () => {
    assert.doesNotMatch(ecran, /\.delete\(\)/); assert.match(ecran, /\{ retire_le: auj\(\) \}/); assert.match(ecran, /\{ fait_le: auj\(\), note: note \|\| null \}/)
    assert.doesNotMatch(appels + lire('phirst/v2/phirst-ligne.js'), /chantier_rappels|chantier_confreres/)
    assert.match(ecran, /S\.telepro = true; dessiner\(\); return;/)   // l'écran Chantiers reste fermé à la téléprospectrice
  })
  test('Appels : l’étiquette de la ligne vient de P.etiquetteDe', () => { assert.match(appels, /var m = P\.etiquetteDe\(r\)/) })
  test('index.html : phirst-pur.js se charge avant phirst-chantiers-pur.js (qui en dépend)', () => {
    const h = lire('phirst/v2/index.html'); assert.ok(h.indexOf('phirst-pur.js') < h.indexOf('phirst-chantiers-pur.js'))
  })
})
