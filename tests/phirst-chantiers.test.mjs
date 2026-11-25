// Chantiers de Phirst V2, lot 1 (23/11/2026) : la logique pure (phirst/v2/phirst-chantiers-pur.js), d'après la maquette validée par Will.
// Chaque cas échouerait sur une règle cassée. Aucune lecture de fichier hors du dépôt (la CI de toutes les séances en dépend).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const C = req('../phirst/v2/phirst-chantiers-pur.js')
const D = req('../phirst/v2/phirst-dossiers-pur.js')

const AUJ = '2026-11-23'
const ch = (o = {}) => ({ id: 'c1', volet_id: 'v1', debut: '2026-11-09', ouverture: '2026-12-10', recu_le: null, ...o })
const ta = (id, o = {}) => ({ id, chantier_id: 'c1', titre: 'Tâche ' + id, artisan_id: null, prevue: null, fait: null, ordre: 0, photos: [], created_at: '2026-11-09T08:00:00Z', ...o })
const ar = (id, o = {}) => ({ id, chantier_id: 'c1', nom: 'Entreprise ' + id, metier: 'Menuiserie', tel: '02 61 91 30 12', retire_le: null, created_at: '2026-11-09T08:00:00Z', ...o })
const monte = (taches, artisans = [], o = {}) => C.monterChantier(ch(o), artisans, taches)

describe('les tâches habituelles', () => {
  test('7 tâches, mot pour mot comme la maquette validée', () => {
    assert.deepEqual(C.DEPART, ['Dépose de l’ancien mobilier', 'Électricité : prises, réseau, éclairage', 'Sol', 'Peinture', 'Pose du mobilier', 'Enseigne et croix', 'Nettoyage de fin de chantier'])
  })
  test('prêtes à insérer, dans l’ordre', () => {
    const l = C.tachesDepart('c9', 'u1')
    assert.equal(l.length, 7)
    assert.deepEqual(l[0], { chantier_id: 'c9', user_id: 'u1', titre: 'Dépose de l’ancien mobilier', ordre: 0 })
    assert.equal(l[6].ordre, 6)
  })
})

describe('monter un chantier', () => {
  test('ne garde que ses tâches et ses artisans ; un artisan retiré quitte la liste mais garde son nom pour les tâches faites', () => {
    const c = monte([ta('t1', { fait: '2026-11-10', artisan_id: 'a2' }), ta('t2', { chantier_id: 'autre' })], [ar('a1'), ar('a2', { retire_le: '2026-11-20' }), ar('a3', { chantier_id: 'autre' })])
    assert.equal(c.taches.length, 1)
    assert.deepEqual(c.artisans.map((a) => a.id), ['a1'])
    assert.equal(c.tousArtisans.length, 2)
    assert.equal(C.nomArtisan(c, c.taches[0]), 'Entreprise a2')
  })
  test('tâche sans artisan : « Pas encore confiée »', () => {
    assert.equal(C.nomArtisan(monte([ta('t1')]), monte([ta('t1')]).taches[0]), 'Pas encore confiée')
  })
  test('dates mal formées ignorées ; ordre de saisie gardé', () => {
    const c = monte([ta('b', { ordre: 2, prevue: 'pas une date' }), ta('a', { ordre: 1 })])
    assert.deepEqual(c.taches.map((t) => t.id), ['a', 'b'])
    assert.equal(c.taches[1].prevu, null)
  })
})

describe('à faire, faites, prochaine, retard', () => {
  const c = monte([
    ta('sans', { ordre: 0 }),
    ta('tard', { ordre: 1, prevue: '2026-11-20' }),
    ta('tot', { ordre: 2, prevue: '2026-11-25' }),
    ta('f1', { ordre: 3, prevue: '2026-11-10', fait: '2026-11-10' }),
    ta('f2', { ordre: 4, prevue: '2026-11-12', fait: '2026-11-19' })
  ])
  test('à faire : par date prévue, la tâche sans date en dernier', () => {
    assert.deepEqual(C.aFaire(c).map((t) => t.id), ['tard', 'tot', 'sans'])
  })
  test('déjà faites : la plus récente d’abord', () => {
    assert.deepEqual(C.faites(c).map((t) => t.id), ['f2', 'f1'])
  })
  test('prochaine = la première à faire par date, même si elle est en retard', () => {
    assert.equal(C.prochaine(c).id, 'tard')
  })
  test('retard en jours ; une tâche faite ou sans date n’est jamais en retard', () => {
    assert.equal(C.retard(c.taches.find((t) => t.id === 'tard'), AUJ), 3)
    assert.equal(C.retard(c.taches.find((t) => t.id === 'f1'), AUJ), 0)
    assert.equal(C.retard(c.taches.find((t) => t.id === 'sans'), AUJ), 0)
    assert.equal(C.retard(c.taches.find((t) => t.id === 'tot'), AUJ), 0)
    assert.deepEqual(C.enRetard(c, AUJ).map((t) => t.id), ['tard'])
  })
  test('barre : faites d’abord, puis par date ; r = retard, c = prochaine', () => {
    assert.deepEqual(C.segments(c, AUJ), ['f', 'f', 'r', '', ''])
    const sansRetard = monte([ta('x', { prevue: '2026-11-30' }), ta('y', { prevue: '2026-11-24' }), ta('z', { fait: '2026-11-01' })])
    assert.deepEqual(C.segments(sansRetard, AUJ), ['f', 'c', ''])
  })
})

describe('les textes de date', () => {
  test('ligne d’une tâche : faite, à fixer, prévue, en retard (1 jour / 2 jours), année omise si c’est l’année en cours', () => {
    assert.deepEqual(C.quand({ fait: '2026-11-10' }, AUJ), { texte: 'Faite le 10\u00A0nov.', retard: false })
    assert.deepEqual(C.quand({ prevu: null }, AUJ), { texte: 'Date à fixer', retard: false })
    assert.deepEqual(C.quand({ prevu: '2027-01-05' }, AUJ), { texte: 'Prévue le 5\u00A0janv.\u00A02027', retard: false })
    assert.deepEqual(C.quand({ prevu: '2026-11-22' }, AUJ), { texte: 'En retard de 1 jour · prévue le 22\u00A0nov.', retard: true })
    assert.deepEqual(C.quand({ prevu: '2026-11-01' }, AUJ), { texte: 'En retard de 22 jours · prévue le 1er\u00A0nov.', retard: true })
  })
  test('« dans » : aujourd’hui, demain, dans n jours, passée de n jour(s), avec espaces insécables', () => {
    assert.equal(C.dans(0), 'aujourd’hui')
    assert.equal(C.dans(1), 'demain')
    assert.equal(C.dans(17), 'dans 17 jours')
    assert.equal(C.dans(-1), 'passée de 1 jour')
    assert.equal(C.dans(-4), 'passée de 4 jours')
  })
  test('tuile de date de l’ouverture', () => {
    assert.deepEqual(C.tuile('2026-11-26'), { j: 'jeu.', n: 26, m: 'nov.' })
    assert.deepEqual(C.tuile('2027-01-18'), { j: 'lun.', n: 18, m: 'janv.' })
  })
  test('jours avant l’ouverture', () => {
    assert.equal(C.jours(monte([]), AUJ), 17)
    assert.equal(C.jours(monte([], [], { ouverture: '2026-11-20' }), AUJ), -3)
  })
})

describe('l’état d’un chantier', () => {
  test('réceptionné passe avant tout', () => {
    assert.deepEqual(C.statut(monte([ta('t', { prevue: '2026-11-01' })], [], { recu_le: '2026-11-22' }), AUJ), { ton: 'vert', texte: 'Réceptionné' })
  })
  test('toutes les tâches faites : prêt pour la réception (même ouverture passée)', () => {
    assert.deepEqual(C.statut(monte([ta('t', { fait: '2026-11-21' })], [], { ouverture: '2026-11-20' }), AUJ), { ton: 'vert', texte: 'Prêt pour la réception' })
  })
  test('aucune tâche : jamais « prêt pour la réception »', () => {
    assert.equal(C.pretPourReception(monte([])), false)
    assert.deepEqual(C.statut(monte([]), AUJ), { ton: 'vert', texte: 'En cours' })
  })
  test('ouverture passée, puis n tâches en retard, puis en cours', () => {
    assert.equal(C.statut(monte([ta('t')], [], { ouverture: '2026-11-22' }), AUJ).texte, 'Ouverture passée')
    assert.equal(C.statut(monte([ta('a', { prevue: '2026-11-20' }), ta('b', { prevue: '2026-11-21' })]), AUJ).texte, '2 tâches en retard')
    assert.equal(C.statut(monte([ta('a', { prevue: '2026-11-20' })]), AUJ).texte, '1 tâche en retard')
  })
})

describe('la liste', () => {
  test('phrase de comptage', () => {
    const retard = monte([ta('a', { prevue: '2026-11-20' })])
    const pret = monte([ta('a', { fait: '2026-11-20' })])
    const sage = monte([ta('a', { prevue: '2026-12-01' })])
    assert.equal(C.phraseCompte([retard, pret, sage], AUJ), '3 chantiers en cours : 1 avec du retard, 1 prêt pour la réception.')
    assert.equal(C.phraseCompte([sage], AUJ), '1 chantier en cours.')
    assert.equal(C.phraseCompte([], AUJ), 'Aucun chantier en cours.')
  })
  test('en cours : l’ouverture la plus proche en premier ; réceptionnés : le plus récent en premier', () => {
    const a = monte([], [], { id: 'a', ouverture: '2027-01-18' }), b = monte([], [], { id: 'b', ouverture: '2026-11-26' })
    assert.deepEqual(C.trierEnCours([a, b]).map((c) => c.id), ['b', 'a'])
    const r1 = monte([], [], { id: 'r1', recu_le: '2026-07-24' }), r2 = monte([], [], { id: 'r2', recu_le: '2026-10-02' })
    assert.deepEqual(C.trierRecus([r1, r2]).map((c) => c.id), ['r2', 'r1'])
  })
})

describe('le lien avec les dossiers', () => {
  const dossier = (id, nom) => ({ id, nom, ville: 'Nantes', titulaire: null, created_at: '2026-10-01T08:00:00Z' })
  const volet = (id, dossier_id, sorte, etat = 'cours') => ({ id, dossier_id, sorte, etat, details: {}, created_at: '2026-10-01T08:00:00Z' })
  const faites = (vid, cles) => cles.map((k) => ({ volet_id: vid, cle: k, faite: '2026-11-01' }))
  const AG = ['rdv', 'releve', 'ambiance', 'plan3d', 'devis', 'bon', 'mobilier']
  test('seuls Agencement et Transfert ont un chantier', () => {
    assert.deepEqual(['transfert', 'agencement', 'riedl', 'pda'].filter(C.aUnChantier), ['transfert', 'agencement'])
  })
  test('prêts : à une étape au plus de « Travaux », en cours, sans chantier', () => {
    const phs = D.pharmacies(
      [dossier('d1', 'Bêta'), dossier('d2', 'Alpha'), dossier('d3', 'Gamma'), dossier('d4', 'Delta'), dossier('d5', 'Epsilon'), dossier('d6', 'Zêta')],
      [volet('v1', 'd1', 'agencement'), volet('v2', 'd2', 'agencement'), volet('v3', 'd3', 'agencement'), volet('v4', 'd4', 'riedl'), volet('v5', 'd5', 'agencement', 'pause'), volet('v6', 'd6', 'transfert')],
      [...faites('v1', AG), ...faites('v2', AG.slice(0, 6)), ...faites('v3', AG.slice(0, 5)), ...faites('v4', ['rdv', 'visite', 'implant', 'offre', 'bon', 'prepa']), ...faites('v5', AG),
        ...faites('v6', ['rdv', 'local', 'plans', 'demande', 'reponse', 'contest', 'agenc'])]
    )
    // v1 : prochaine = travaux ; v2 : prochaine = mobilier (juste avant) ; v3 : deux étapes avant → non ; v4 Riedl → non ; v5 en pause → non ; v6 Transfert prochaine = travaux
    assert.deepEqual(C.prets(phs, []).map((p) => p.volet.id).sort(), ['v1', 'v2', 'v6'])
    assert.deepEqual(C.prets(phs, ['v1']).map((p) => p.volet.id).sort(), ['v2', 'v6'])
    const v2 = C.prets(phs, []).find((p) => p.volet.id === 'v2')
    assert.equal(v2.prochaine.k, 'mobilier'); assert.equal(v2.travaux.k, 'travaux')
  })
  test('prêts : triés par date prévue de « Travaux », puis par nom', () => {
    const phs = D.pharmacies([dossier('d1', 'Bêta'), dossier('d2', 'Alpha'), dossier('d3', 'Gamma')],
      [volet('v1', 'd1', 'agencement'), volet('v2', 'd2', 'agencement'), volet('v3', 'd3', 'agencement')],
      [...faites('v1', AG), ...faites('v2', AG), ...faites('v3', AG), { volet_id: 'v3', cle: 'travaux', prevue: '2026-12-01' }])
    assert.deepEqual(C.prets(phs, []).map((p) => p.ph.dossier.nom), ['Gamma', 'Alpha', 'Bêta'])
  })
  test('réception : Agencement = Travaux + Réception des travaux ; Transfert = Travaux seul', () => {
    assert.deepEqual(C.etapesAReceptionner('agencement'), ['travaux', 'reception'])
    assert.deepEqual(C.etapesAReceptionner('transfert'), ['travaux'])
    assert.match(C.texteReception('agencement'), /« Travaux » et « Réception des travaux » du dossier passent à faites/)
    assert.equal(C.texteReception('transfert'), 'l’étape « Travaux » du dossier passe à faite')
  })
  test('lignes de réception : faite aujourd’hui ; date prévue posée seulement si elle manquait ; une étape déjà faite n’est pas réécrite', () => {
    const v = D.monterVolet(volet('v1', 'd1', 'agencement'), [{ volet_id: 'v1', cle: 'travaux', prevue: '2026-11-15' }])
    assert.deepEqual(C.lignesReception(v, AUJ), [
      { volet_id: 'v1', cle: 'travaux', faite: AUJ },
      { volet_id: 'v1', cle: 'reception', faite: AUJ, prevue: AUJ }
    ])
    const deja = D.monterVolet(volet('v1', 'd1', 'transfert'), [{ volet_id: 'v1', cle: 'travaux', faite: '2026-11-20' }])
    assert.deepEqual(C.lignesReception(deja, AUJ), [])
  })
  test('résumé du bloc « Le chantier »', () => {
    const c = monte([ta('a', { prevue: '2026-11-20', artisan_id: 'a1' }), ta('b', { fait: '2026-11-19' })], [ar('a1', { nom: 'Menuiserie Kervadec' })])
    const r = C.resume(c, AUJ)
    assert.equal(r.avancee, '1 sur 2 tâches faites')
    assert.equal(r.ouverture, 'ouverture promise le jeudi 10 décembre 2026')
    assert.deepEqual(r.etat, { ton: 'rouge', texte: '1 tâche en retard' })
    assert.equal(r.prochaine, 'Prochaine étape : Tâche a (Menuiserie Kervadec).')
    const recu = C.resume(monte([], [], { recu_le: '2026-11-22' }), AUJ)
    assert.equal(recu.avancee, 'Aucune tâche pour l’instant')
    assert.deepEqual(recu.etat, { ton: 'vert', texte: 'Réceptionné le 22\u00A0nov.\u00A02026' })
    assert.equal(recu.prochaine, '')
  })
  test('ordre suivant d’une tâche ajoutée', () => {
    assert.equal(C.ordreSuivant(monte([ta('a', { ordre: 0 }), ta('b', { ordre: 6 })])), 7)
    assert.equal(C.ordreSuivant(monte([])), 0)
  })
})

describe('contrôles des champs', () => {
  test('titre d’une tâche : obligatoire, 200 caractères au plus, espaces retirés', () => {
    assert.equal(C.verifierTitre('   ').ok, false)
    assert.equal(C.verifierTitre('x'.repeat(201)).ok, false)
    assert.deepEqual(C.verifierTitre('  Pose du rayonnage  '), { ok: true, valeur: 'Pose du rayonnage' })
  })
  test('artisan : nom obligatoire, métier facultatif (affiché « Métier à préciser »), téléphone lisible', () => {
    assert.equal(C.verifierArtisan({ nom: ' ' }).ok, false)
    assert.equal(C.verifierArtisan({ nom: 'A', tel: 'appeler le matin' }).ok, false)
    assert.deepEqual(C.verifierArtisan({ nom: ' Plomberie Durand ', metier: '', tel: '0261913012' }).valeur, { nom: 'Plomberie Durand', metier: null, tel: '02 61 91 30 12' })
    assert.equal(C.verifierArtisan({ nom: 'A', tel: '' }).valeur.tel, null)
    assert.equal(C.metierAffiche({ metier: '' }), 'Métier à préciser')
    assert.equal(C.lienTel('02 61 91 30 12'), 'tel:0261913012')
    assert.equal(C.lienTel(''), '')
  })
  test('photo : chemin sous le compte et le dossier, nom propre ; contrôles avant l’envoi', () => {
    assert.equal(C.cheminPhoto('u1', 'd1', 't1', 'Sol Posé.JPG', 1700000000000), 'u1/d1/chantier/t1/1700000000000-sol-pose.jpg')
    assert.match(C.verifierPhoto({ size: 10, type: 'application/pdf' }, 0), /photo/)
    assert.match(C.verifierPhoto({ size: 26 * 1024 * 1024, type: 'image/jpeg' }, 0), /25 Mo/)
    assert.match(C.verifierPhoto({ size: 10, type: 'image/jpeg' }, 12), /12 photos/)
    assert.equal(C.verifierPhoto({ size: 10, type: 'image/heic' }, 0), '')
    assert.deepEqual(C.tailleReduite(4032, 3024), { l: 1600, h: 1200 })
    assert.deepEqual(C.tailleReduite(800, 600), { l: 800, h: 600 })
  })
})

describe('l’écran et son branchement', () => {
  const fs = req('node:fs'), path = req('node:path')
  const lire = (f) => fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', f), 'utf8')
  const ecran = lire('phirst/v2/phirst-chantiers.js'), html = lire('phirst/v2/index.html'), portes = lire('phirst/v2/phirst-portes.js'), dossiers = lire('phirst/v2/phirst-dossiers.js')
  test('la logique des Chantiers se charge AVANT l’écran des Dossiers (qui la lit au chargement), puis l’écran des Chantiers', () => {
    const i = (f) => html.indexOf('src="' + f)
    assert.ok(i('phirst-dossiers-pur.js') > 0 && i('phirst-dossiers-pur.js') < i('phirst-chantiers-pur.js'))
    assert.ok(i('phirst-chantiers-pur.js') < i('phirst-dossiers.js') && i('phirst-dossiers.js') < i('phirst-chantiers.js'))
    assert.ok(html.indexOf('href="phirst-dossiers.css') < html.indexOf('href="phirst-chantiers.css'))
  })
  test('« Chantiers » quitte les écrans d’attente mais reste réservé à Yann', () => {
    assert.doesNotMatch(portes, /^\s*chantiers\s*:\s*\[/m)
    assert.match(portes, /RESERVE = \[[^\]]*'chantiers'/)
    assert.match(ecran, /Cet écran est réservé à Yann\. Vos outils sont les Appels, l’Agenda et la Veille\./)
  })
  test('lot 1 : aucun bouton « Envoyer le lien », aucune somme, aucun console.log', () => {
    const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')   // les commentaires d'en-tête disent justement ce qui n'y est pas
    assert.doesNotMatch(code(ecran), /Envoyer le lien|sms:/)
    // L4 : « contientMontant » est le GARDE qui retire les sommes d'une note de confrère (jamais une somme gardée) : il est le seul mot permis
    assert.doesNotMatch(code(ecran + lire('phirst/v2/phirst-chantiers-pur.js')).replace(/contientMontant/g, ''), /€|montant|acompte|budget|console\.log/i)
  })
  test('le bloc « Le chantier » n’apparaît qu’à l’étape « Travaux » d’un volet Agencement ou Transfert', () => {
    assert.match(dossiers, /e\.k === 'travaux' && CH && CH\.aUnChantier\(v\.sorte\)/)
  })
})
