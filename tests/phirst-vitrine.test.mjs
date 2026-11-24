// Vitrine de Phirst V2 (24/11/2026) : la logique pure de l'écran (phirst/v2/phirst-vitrine-pur.js) et la forme des notes de Yann
// (phirst/v2/phirst-lettre-contenu.js : verifier). Aucune lecture de fichier hors du dépôt (la CI en dépend).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const V = req('../phirst/v2/phirst-vitrine-pur.js')
const L = req('../phirst/v2/phirst-lettre-contenu.js')
const lire = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

const MAINT = Date.parse('2026-11-24T09:00:00Z')
const dem = (o = {}) => ({ id: 'd1', origine: 'lettre', dossier_id: null, pharmacie: 'Pharmacie des Tilleuls', ville: 'Angers', motif: 'Je veux un robot', nom: 'M. Exemple', tel: '0200000001', mot: 'À rappeler', created_at: '2026-11-23T17:40:00Z', traitee_le: null, ...o })

describe('les demandes : tri', () => {
  test('non traitées d’abord, puis la plus récente en premier ; la liste d’origine n’est pas modifiée', () => {
    const l = [dem({ id: 'a', created_at: '2026-11-20T10:00:00Z', traitee_le: '2026-11-21T10:00:00Z' }), dem({ id: 'b', created_at: '2026-11-18T10:00:00Z' }),
      dem({ id: 'c', created_at: '2026-11-22T10:00:00Z' }), dem({ id: 'd', created_at: '2026-11-23T10:00:00Z', traitee_le: '2026-11-23T11:00:00Z' })]
    assert.deepEqual(V.trierDemandes(l).map((d) => d.id), ['c', 'b', 'd', 'a'])
    assert.deepEqual(l.map((d) => d.id), ['a', 'b', 'c', 'd'])
  })
  test('50 au plus, et une demande non traitée ancienne passe avant 60 traitées récentes', () => {
    const l = Array.from({ length: 60 }, (_, i) => dem({ id: 't' + i, created_at: '2026-11-22T10:' + String(i % 60).padStart(2, '0') + ':00Z', traitee_le: '2026-11-23T00:00:00Z' }))
    l.push(dem({ id: 'vieille', created_at: '2026-01-02T10:00:00Z' }))
    const r = V.trierDemandes(l)
    assert.equal(r.length, 50); assert.equal(r[0].id, 'vieille')
  })
  test('les deux lectures se recoupent : une demande ne compte qu’une fois ; lignes sans id écartées', () => {
    assert.deepEqual(V.fusionner([dem({ id: 'a' }), dem({ id: 'b' })], [dem({ id: 'b' }), dem({ id: 'c' })]).map((d) => d.id), ['a', 'b', 'c'])
    assert.deepEqual(V.trierDemandes([null, {}, dem({ id: 'z' })]).map((d) => d.id), ['z'])
    assert.deepEqual(V.trierDemandes(null), [])
  })
  test('origine, titre, compte', () => {
    assert.equal(V.origineLibelle('lettre'), 'par sa page'); assert.equal(V.origineLibelle('expertise'), 'par l’ancienne vitrine'); assert.equal(V.origineLibelle('x'), '')
    assert.equal(V.titreDemande(dem()), 'Pharmacie des Tilleuls · Angers'); assert.equal(V.titreDemande(dem({ ville: null })), 'Pharmacie des Tilleuls')
    assert.equal(V.titreDemande({}), 'Pharmacie non précisée')
    assert.equal(V.majuscule('constat 1 : il manque le titre.'), 'Constat 1 : il manque le titre.'); assert.equal(V.majuscule(null), '')
    assert.equal(V.phraseCompte([]), 'Rien à rappeler pour l’instant.'); assert.equal(V.phraseCompte([dem()]), 'Une demande à rappeler.')
    assert.equal(V.phraseCompte([dem(), dem({ id: 'x' }), dem({ id: 'y', traitee_le: '2026-11-24T00:00:00Z' })]), '2 demandes à rappeler.')
  })
  test('le numéro : groupes de deux, lien tel: sans espaces', () => {
    assert.equal(V.telAffiche('0612345678'), '06 12 34 56 78'); assert.equal(V.telAffiche('06 12 34 56 78'), '06 12 34 56 78')
    assert.equal(V.telAffiche('+33 6 12 34 56 78'), '+33 6 12 34 56 78'); assert.equal(V.telAffiche('+44 20 7946 0958'), '+44 20 7946 0958')
    assert.equal(V.lienTel('06 12 34 56 78'), 'tel:0612345678'); assert.equal(V.lienTel('+33 6 12 34 56 78'), 'tel:+33612345678'); assert.equal(V.lienTel(''), '')
  })
})

describe('dates lisibles, à l’heure de Paris', () => {
  test('17 h 40 UTC en novembre = 18 h 40 à Paris', () => assert.equal(V.quandParis('2026-11-23T17:40:00Z', MAINT), 'lundi 23 novembre à 18 h 40'))
  test('heure d’été : 17 h 05 UTC en juillet = 19 h 05 ; heure pile sans « 00 »', () => {
    assert.equal(V.quandParis('2026-07-14T17:05:00Z', MAINT), 'mardi 14 juillet à 19 h 05'); assert.equal(V.quandParis('2026-11-23T08:00:00Z', MAINT), 'lundi 23 novembre à 9 h')
  })
  test('23 h 30 UTC passe au lendemain à Paris ; l’année n’est dite que si ce n’est pas la bonne', () => {
    assert.equal(V.jourParis('2026-11-23T23:30:00Z', MAINT), 'mardi 24 novembre'); assert.equal(V.jourParis('2025-12-31T23:30:00Z', MAINT), 'jeudi 1er janvier')
    assert.equal(V.jourParis('2025-03-01T10:00:00Z', MAINT), 'samedi 1er mars 2025')
  })
  test('date illisible : texte vide, jamais « Invalid Date »', () => { assert.equal(V.quandParis('n’importe quoi'), ''); assert.equal(V.jourParis(null), '') })
})

describe('la piste où mettre une demande', () => {
  const pistes = [
    { id: 'p1', nom: 'Pharmacie des Tilleuls', ville: 'Angers', stage: 'a_rappeler', dossier_id: null },
    { id: 'p2', nom: 'Pharmacie Autre', ville: 'Nantes', stage: 'a_qualifier', dossier_id: 'dos-1' },
    { id: 'p3', nom: 'Pharmacie du Port', ville: 'Brest', stage: 'archive', dossier_id: null }]
  test('par dossier d’abord, même si le nom ne ressemble pas', () => {
    const c = V.choisirPiste(dem({ dossier_id: 'dos-1' }), pistes); assert.equal(c.mode, 'dossier'); assert.equal(c.piste.id, 'p2')
  })
  test('sinon par nom et ville, accents, majuscules et espaces ignorés', () => {
    const c = V.choisirPiste(dem({ pharmacie: '  PHARMACIE des  tilleuls ', ville: 'ANGERS' }), pistes); assert.equal(c.mode, 'nom'); assert.equal(c.piste.id, 'p1')
    assert.equal(V.choisirPiste(dem({ pharmacie: 'Pharmacie du Pré', ville: 'Angérs' }), [{ id: 'q', nom: 'Pharmacie du Pre', ville: 'Angers' }]).mode, 'nom')
    assert.equal(V.choisirPiste(dem({ pharmacie: 'Pharmacie du Pré', ville: 'Angers' }), [{ id: 'q', nom: 'Pharmacie du Pre', ville: 'Angers' }]).piste.id, 'q')
  })
  test('même nom dans une AUTRE ville : une piste neuve, pas la mauvaise', () => {
    assert.equal(V.choisirPiste(dem({ ville: 'Cholet' }), pistes).mode, 'nouvelle')
  })
  test('dossier inconnu des pistes : on essaie le nom, puis la piste neuve', () => {
    assert.equal(V.choisirPiste(dem({ dossier_id: 'inconnu' }), pistes).piste.id, 'p1')
    assert.deepEqual(V.choisirPiste(dem({ dossier_id: 'inconnu', pharmacie: 'Rien' }), pistes), { mode: 'nouvelle', piste: null, archivee: false })
    assert.equal(V.choisirPiste(dem(), []).mode, 'nouvelle'); assert.equal(V.choisirPiste(dem(), null).mode, 'nouvelle')
  })
  test('une piste vivante passe avant une archivée ; une archivée seule est signalée', () => {
    const l = [{ id: 'a', nom: 'X', ville: 'Y', stage: 'archive' }, { id: 'b', nom: 'X', ville: 'Y', stage: 'rdv_fixe' }]
    assert.equal(V.choisirPiste(dem({ pharmacie: 'X', ville: 'Y' }), l).piste.id, 'b')
    const s = V.choisirPiste(dem({ pharmacie: 'Pharmacie du Port', ville: 'Brest' }), pistes)
    assert.equal(s.piste.id, 'p3'); assert.equal(s.archivee, true); assert.match(V.phraseSucces(s), /archivée/)
    assert.equal(V.phraseSucces({ archivee: false }), 'Ajoutée à vos pistes : elle est dans vos Appels.')
  })
  test('la piste neuve : étape « à qualifier », source permise, dossier_id seulement s’il y en a un', () => {
    const p = V.nouvellePiste(dem({ dossier_id: 'dos-9' }), 'ws1')
    assert.deepEqual(p, { workspace_id: 'ws1', nom: 'Pharmacie des Tilleuls', ville: 'Angers', telephone: '0200000001', pharmacien: 'M. Exemple', stage: 'a_qualifier', source: 'vitrine', dossier_id: 'dos-9' })
    const q = V.nouvellePiste(dem({ ville: '', nom: null }), 'ws1')
    assert.ok(!('dossier_id' in q)); assert.equal(q.ville, null); assert.equal(q.pharmacien, null)
  })
  test('la note du journal', () => {
    assert.equal(V.corpsNote(dem()), 'Demande reçue par la page : Je veux un robot — M. Exemple — 0200000001 — À rappeler')
    assert.equal(V.corpsNote(dem({ nom: null, mot: null })), 'Demande reçue par la page : Je veux un robot — 0200000001')
    assert.match(V.corpsNote(dem({ origine: 'expertise' })), /^Demande reçue par l’ancienne vitrine : /)
    assert.ok(V.corpsNote(dem({ mot: 'x'.repeat(5000) })).length <= 2400)
  })
  test('une erreur dit l’étape qui a raté et ne parle jamais de succès', () => {
    for (const e of ['pistes', 'piste', 'note', 'traitee']) { const t = V.phraseErreur(e, false); assert.match(t, /^Pas ajoutée/); assert.doesNotMatch(t, /^Ajoutée/) }
    assert.match(V.phraseErreur('piste'), /créer la piste/); assert.match(V.phraseErreur('note', true), /piste est créée/); assert.match(V.phraseErreur('traitee', true), /en double/)
  })
  test('la source choisie est une valeur permise par la base : texte libre, sans contrainte dans le schéma de la V1 (aucune lecture hors dépôt)', () => {
    assert.equal(V.SOURCE_PISTE, 'vitrine'); assert.equal(V.ETAPE_PISTE, 'a_qualifier')
  })
})

describe('le lien de la page et son état', () => {
  const J = 'AbCdEfGhIjKlMnOpQrStUvWx'
  const ADR = 'https://phirst-agencement.vercel.app/phirst/v2/lettre/'
  test('lien copié = adresse du réglage + # + jeton ; relatif pour « Voir la page »', () => {
    assert.equal(V.lienCopie(ADR, J), ADR + '#' + J); assert.equal(V.lienCopie(ADR + '#vieux', J), ADR + '#' + J); assert.equal(V.lienVoir(J), 'lettre/#' + J)
  })
  test('adresse non réglée, jeton absent ou mal formé : rien (jamais un lien faux)', () => {
    assert.equal(V.lienCopie('', J), ''); assert.equal(V.lienCopie(ADR, ''), ''); assert.equal(V.lienCopie(ADR, 'court'), ''); assert.equal(V.lienCopie(ADR, J + '<script>'), '')
    assert.equal(V.lienVoir('x y'), '')
  })
  test('trois états', () => {
    assert.deepEqual([V.etatLettre(null).texte, V.etatLettre(null).action], ['Pas encore préparée', 'Préparer la page'])
    assert.deepEqual([V.etatLettre({ ouverte: true }).texte, V.etatLettre({ ouverte: true }).action], ['Lien actif', 'Modifier la page'])
    assert.equal(V.etatLettre({ ouverte: false }).texte, 'Lien coupé'); assert.equal(V.etatLettre({ ouverte: false }).ton, 'orange')
  })
  test('couper / rouvrir : une phrase qui dit ce que ça change pour le pharmacien', () => {
    assert.match(V.phraseBascule({ ouverte: true }), /ne voit plus sa page/); assert.match(V.phraseBascule({ ouverte: false }), /revoit sa page/)
  })
  test('date de la dernière modification, à l’heure de Paris', () => assert.equal(V.majLettre({ updated_at: '2026-11-23T23:30:00Z' }), 'mardi 24 novembre'))
})

describe('la feuille : va-et-vient avec la forme des notes', () => {
  test('1er rendez-vous : la date faite la plus ancienne, du bon dossier seulement', () => {
    const volets = [{ id: 'v1', dossier_id: 'D' }, { id: 'v2', dossier_id: 'D' }, { id: 'v3', dossier_id: 'AUTRE' }]
    const etapes = [{ volet_id: 'v1', cle: 'rdv', faite: '2026-11-10' }, { volet_id: 'v2', cle: 'rdv', faite: '2026-11-05T00:00:00Z' }, { volet_id: 'v3', cle: 'rdv', faite: '2026-01-01' },
      { volet_id: 'v1', cle: 'releve', faite: '2026-01-01' }, { volet_id: 'v1', cle: 'rdv', faite: null }]
    assert.equal(V.rdvFait(volets, etapes, 'D'), '2026-11-05'); assert.equal(V.rdvFait(volets, [], 'D'), ''); assert.equal(V.rdvFait(null, null, 'D'), '')
  })
  test('première ouverture : 4 + 5 lignes vides, date du rendez-vous préremplie ; une date enregistrée n’est jamais écrasée', () => {
    const v = V.valeursFeuille({}, '2026-11-05'); assert.equal(v.rdv, '2026-11-05'); assert.equal(v.vu.length, 4); assert.equal(v.propose.length, 5)
    assert.equal(V.valeursFeuille({ rdv: '2026-12-01' }, '2026-11-05').rdv, '2026-12-01'); assert.equal(V.valeursFeuille({}, 'pas une date').rdv, '')
  })
  test('rouvrir la feuille remet ce qui a été enregistré (aller-retour complet)', () => {
    const saisie = { rdv: '2026-11-05', mot: 'Bonjour', vu: [{ zone: 'file', t: 'File longue', d: 'Le samedi' }], propose: [{ zone: 'entree', t: 'Entrée à gauche', d: '' }],
      surfaces: { aujourdhui: 120, demain: 150 }, postes: { aujourdhui: 2, demain: 3 }, entree: { aujourdhui: 'Rue', demain: 'Parking' }, suite: { t: 'Relevé', quand: '2026-12-02T09:30', d: 'Sur place' } }
    const ok = L.verifier(V.assembler({ ...V.aplatir(V.valeursFeuille(saisie, '')), 'vu.0.zone': 'file' }))
    assert.equal(ok.ok, true)
    const v = V.valeursFeuille(ok.valeur, '')
    assert.deepEqual(L.verifier(V.assembler(V.aplatir(v))).valeur, ok.valeur)
    assert.equal(v.vu[0].t, 'File longue'); assert.equal(v.vu[1].t, ''); assert.equal(v.surfaces.demain, 150); assert.equal(v.suite.quand, '2026-12-02T09:30')
  })
  test('feuille vide : acceptée, tout est vide (rien n’est inventé)', () => {
    const r = L.verifier(V.assembler(V.aplatir(V.valeursFeuille({}, ''))))
    assert.equal(r.ok, true); assert.deepEqual(r.valeur, L.vide())
  })
  test('compteur du mot : dit de combien on dépasse, ne coupe rien', () => {
    assert.deepEqual(V.compteur('abc', 400), { n: 3, trop: false, texte: '3 sur 400' })
    const c = V.compteur('x'.repeat(405), 400); assert.equal(c.trop, true); assert.equal(c.texte, '405 sur 400 : 5 de trop')
  })
})

describe('PHIRST_LETTRE.verifier : ce que Yann écrit', () => {
  const ok = (o = {}) => ({ ...V.assembler(V.aplatir(V.valeursFeuille({}, ''))), ...o })
  const champs = (r) => r.erreurs.map((e) => e.champ)
  test('le mot au-delà de 400 caractères est REFUSÉ, avec le bon message (jamais coupé)', () => {
    const r = L.verifier(ok({ mot: 'a'.repeat(401) }))
    assert.equal(r.ok, false); assert.deepEqual(r.erreurs, [{ champ: 'mot', message: 'Le mot d’introduction : 400 caractères au plus (il y en a 401).' }])
    assert.equal(L.verifier(ok({ mot: 'a'.repeat(400) })).ok, true)
  })
  test('titre, détail, entrée, suite : chacun refuse ce qui dépasse, en le nommant', () => {
    const vu = [{ zone: 'file', t: 'a'.repeat(91), d: '' }, { zone: 'para', t: 'ok', d: 'b'.repeat(321) }, { zone: '', t: '', d: '' }, { zone: '', t: '', d: '' }]
    const r = L.verifier(ok({ vu, entree: { aujourdhui: 'e'.repeat(25), demain: '' }, suite: { t: 's'.repeat(81), quand: '', d: 'd'.repeat(321) } }))
    assert.deepEqual(champs(r), ['vu.0.t', 'vu.1.d', 'entree.aujourdhui', 'suite.t', 'suite.d'])
    assert.match(r.erreurs[0].message, /Constat 1, titre : 90 caractères au plus \(il y en a 91\)/); assert.match(r.erreurs[2].message, /L’entrée aujourd’hui : 24 caractères au plus/)
  })
  test('zone manquante ou inconnue : « choisissez la zone du plan »', () => {
    const r = L.verifier(ok({ vu: [{ zone: '', t: 'File', d: '' }, { zone: 'comptoir', t: 'Mauvaise zone pour un constat', d: '' }, { zone: '', t: '', d: '' }, { zone: '', t: '', d: '' }] }))
    assert.deepEqual(champs(r), ['vu.0.zone', 'vu.1.zone']); assert.match(r.erreurs[0].message, /choisissez la zone du plan/)
    assert.equal(L.verifier(ok({ propose: [{ zone: 'comptoir', t: 'Comptoir plus long', d: '' }, ...ok().propose.slice(1)] })).ok, true)
  })
  test('titre manquant alors que le détail est rempli', () => {
    const r = L.verifier(ok({ propose: [{ zone: 'entree', t: '', d: 'Un détail seul' }, ...ok().propose.slice(1)] }))
    assert.deepEqual(champs(r), ['propose.0.t']); assert.match(r.erreurs[0].message, /Idée 1 : il manque le titre/)
    assert.equal(L.verifier(ok({ vu: [{ zone: 'file', t: '', d: '' }, ...ok().vu.slice(1)] })).ok, true)   // une zone choisie sans rien d'autre = ligne vide
  })
  test('la suite : date ou détail sans titre refusés ; date mal formée refusée', () => {
    assert.deepEqual(champs(L.verifier(ok({ suite: { t: '', quand: '2026-12-02T09:30', d: '' } }))), ['suite.t'])
    assert.deepEqual(champs(L.verifier(ok({ suite: { t: '', quand: '', d: 'seul' } }))), ['suite.t'])
    assert.deepEqual(champs(L.verifier(ok({ suite: { t: 'Relevé', quand: '2026-12-02', d: '' } }))), ['suite.quand'])
    assert.deepEqual(champs(L.verifier(ok({ suite: { t: 'Relevé', quand: '2026-02-30T09:30', d: '' } }))), ['suite.quand'])
    assert.equal(L.verifier(ok({ suite: { t: 'Relevé', quand: '', d: '' } })).ok, true)
  })
  test('nombres hors bornes : surfaces 10 à 5000, postes 1 à 30, entiers seulement', () => {
    for (const [k, v] of [['surfaces.aujourdhui', '9'], ['surfaces.demain', '5001'], ['postes.aujourdhui', '0'], ['postes.demain', '31'], ['surfaces.aujourdhui', '12,5'], ['postes.demain', 'abc']]) {
      const [a, b] = k.split('.'); const r = L.verifier(ok({ [a]: { aujourdhui: '', demain: '', [b]: v } })); assert.deepEqual(champs(r), [k], k + ' = ' + v)
    }
    const bon = L.verifier(ok({ surfaces: { aujourdhui: '10', demain: '5 000' }, postes: { aujourdhui: '1', demain: '30' } }))
    assert.equal(bon.ok, true); assert.deepEqual([bon.valeur.surfaces.aujourdhui, bon.valeur.surfaces.demain, bon.valeur.postes.demain], [10, 5000, 30])
  })
  test('champs vides acceptés ; date de rendez-vous fausse refusée', () => {
    assert.equal(L.verifier({}).ok, true); assert.equal(L.verifier(null).ok, true)
    assert.deepEqual(champs(L.verifier(ok({ rdv: '2026-02-30' }))), ['rdv']); assert.equal(L.verifier(ok({ rdv: '2026-11-05' })).ok, true)
  })
  test('aucun texte coupé en silence : ce qui est accepté ressort mot pour mot (espaces nettoyés seulement)', () => {
    const t = 'a'.repeat(90), d = 'b '.repeat(159) + 'b'
    const r = L.verifier(ok({ mot: '  ' + 'm'.repeat(400) + ' ', vu: [{ zone: 'file', t, d }, ...ok().vu.slice(1)] }))
    assert.equal(r.ok, true); assert.equal(r.valeur.mot.length, 400); assert.equal(r.valeur.vu[0].t, t); assert.equal(r.valeur.vu[0].d, d)
  })
})

describe('l’écran : la téléprospectrice ne déclenche AUCUNE lecture', () => {
  function monde(telepro) {
    const appels = []
    const noeud = () => ({ innerHTML: '', addEventListener() {}, querySelector: () => noeud(), querySelectorAll: () => [], contains: () => false, getAttribute: () => null, remove() {}, classList: { toggle() {} } })
    const racine = { ...noeud(), querySelector: () => (racine.innerHTML ? noeud() : null) }
    const chaine = (t) => { const c = { select: () => c, eq: () => c, is: () => c, in: () => c, order: () => c, limit: () => c, range: () => c, maybeSingle: () => c, single: () => c, insert: () => c, update: () => c,
      // oxlint-disable-next-line unicorn/no-thenable -- faux client Supabase : le vrai se lit avec await, il doit donc avoir then
      then: (ok) => Promise.resolve({ data: [], error: null }).then(ok) }; appels.push(t); return c }
    const V2 = { pages: {}, topbar: () => '<div class="v2-top"></div>', go() {}, route: { name: 'vitrine' }, user: { id: 'u1' }, sb: () => ({ from: chaine }) }
    const window = { V2, PHIRST_ROLE: { estTelepro: () => Promise.resolve(telepro) }, V2_BRAND: { lettre: 'https://exemple.test/lettre/' }, PHIRST_LETTRE: L, PHIRST_VITRINE_PUR: V }
    new Function('window', 'V2', lire('phirst/v2/phirst-ecran.js'))(window, V2)
    new Function('window', 'V2', 'document', lire('phirst/v2/phirst-vitrine.js'))(window, V2, { activeElement: null })
    return { V2, racine, appels }
  }
  test('elle lit « réservé à Yann », avec Appels et Agenda, et aucune table n’est interrogée', async () => {
    const { V2, racine, appels } = monde(true)
    V2.pages.vitrine.render(racine); await new Promise((r) => setTimeout(r, 5))
    assert.match(racine.innerHTML, /Cet écran est réservé à Yann\. Vos outils sont les Appels, l’Agenda et la Veille\./)
    assert.match(racine.innerHTML, /data-vers="appels"/); assert.match(racine.innerHTML, /data-vers="agenda"/); assert.match(racine.innerHTML, /<h1>Vitrine<\/h1>/)
    assert.deepEqual(appels, [])
  })
  test('Yann : les cinq lectures partent (membres, demandes ×2, dossiers, lettres), jamais d’écriture', async () => {
    const { V2, racine, appels } = monde(false)
    V2.pages.vitrine.render(racine); await new Promise((r) => setTimeout(r, 5))
    assert.deepEqual(appels.sort(), ['crm_members', 'dossier_lettres', 'dossiers', 'vitrine_demandes', 'vitrine_demandes'])
  })
})

describe('branchement dans la page', () => {
  const html = lire('phirst/v2/index.html'), portes = lire('phirst/v2/phirst-portes.js')
  test('feuille de style, trois scripts dans l’ordre, même jeton ?v=, adresse neutre', () => {
    const i = (s) => html.indexOf(s)
    assert.ok(i('phirst-reglages.css') < i('phirst-vitrine.css'))
    assert.ok(i('phirst-reglages.js') < i('phirst-lettre-contenu.js') && i('phirst-lettre-contenu.js') < i('phirst-vitrine-pur.js') && i('phirst-vitrine-pur.js') < i('phirst-vitrine.js') && i('phirst-vitrine.js') < i('v2-app.js'))
    // le jeton n'est jamais écrit ici (il avance à chaque mise en ligne) : celui des Réglages, voisins, fait foi
    const jeton = /phirst-reglages\.js\?v=([0-9a-z]+)"/.exec(html)[1]
    for (const f of ['phirst-vitrine.css', 'phirst-lettre-contenu.js', 'phirst-vitrine-pur.js', 'phirst-vitrine.js']) assert.match(html, new RegExp(f.replace('.', '\\.') + '\\?v=' + jeton + '"'))
    assert.match(html, /lettre: 'https:\/\/phirst-agencement\.vercel\.app\/phirst\/v2\/lettre\/'/); assert.doesNotMatch(html, /github\.io/)
  })
  test('la porte est à l’accueil, plus « En développement », et réservée à Yann', () => {
    assert.match(html, /vitrine: +\{ fam: 'accueil', ico: 'marketing', nom: 'Vitrine', ph: 'Les pages préparées pour vos pharmacies', page: 'vitrine' \}/)
    assert.match(portes, /RESERVE = \[[^\]]*'vitrine'/); assert.doesNotMatch(portes, /^\s*vitrine:\s*\[/m)
  })
  test('CSS : rien de ce qui fait planter Safari ; champs à 16 px ; grilles minmax(0,1fr)', () => {
    const css = lire('phirst/v2/phirst-vitrine.css')
    assert.doesNotMatch(css, /backdrop-filter|filter\s*:\s*blur|background-clip\s*:\s*text|mix-blend|[^-]opacity\s*:/)
    assert.doesNotMatch(css, /grid-template-columns:\s*repeat\(\d,\s*1fr\)/)
  })
})
