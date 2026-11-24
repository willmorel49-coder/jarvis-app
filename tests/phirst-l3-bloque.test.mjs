// Phirst · lot L3 · idée 7 « Ce qui bloque cette semaine » : logique pure (phirst/v2/phirst-dossiers-pur.js).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const D = createRequire(import.meta.url)('../phirst/v2/phirst-dossiers-pur.js')

const AUJ = '2026-11-24'
const NOMS = { transfert: ['rdv', 'local', 'plans', 'demande', 'reponse', 'contest', 'agenc', 'travaux', 'demenage'],
  agencement: ['rdv', 'releve', 'ambiance', 'plan3d', 'devis', 'bon', 'mobilier', 'travaux', 'reception'],
  riedl: ['rdv', 'visite', 'implant', 'offre', 'bon', 'prepa', 'livraison', 'service', 'suivi'], pda: ['rdv', 'etude', 'offre', 'bon', 'prepa', 'install', 'formation', 'demarrage', 'suivi'] }
/* un volet monté dont les n premières étapes sont faites (date 2026-10-01 + rang), les autres non */
function volet(pid, sorte, nFaites, o = {}, prevues = {}) {
  const v = { id: pid + '-' + sorte, dossier_id: pid, sorte, etat: 'cours', details: {}, created_at: '2026-10-12T08:00:00+00:00', ...o }
  const lignes = NOMS[sorte].slice(0, nFaites).map((k, i) => ({ volet_id: v.id, cle: k, faite: '2026-10-' + String(10 + i).padStart(2, '0') }))
  Object.keys(prevues).forEach((k) => { const l = lignes.find((x) => x.cle === k); if (l) l.prevue = prevues[k]; else lignes.push({ volet_id: v.id, cle: k, prevue: prevues[k] }) })
  return D.monterVolet(v, lignes)
}
const ph = (id, nom, volets) => ({ dossier: { id, nom }, volets })
// Transfert à « Réponse de l’ARS », Agencement à « Plan et 3D », Riedl à « Bon de commande » : tout attend la réponse de l’ARS
const chaine3 = () => ph('p1', 'Pharmacie du Pré Lormeau', [volet('p1', 'transfert', 4), volet('p1', 'agencement', 3), volet('p1', 'riedl', 4)])

describe('quelle étape retient le reste', () => {
  test('la réponse de l’ARS retient les plans, la commande du robot et la pose', () => {
    const L = D.retenues([chaine3()], AUJ)
    assert.equal(L.length, 1)
    assert.equal(L[0].volet.sorte, 'transfert'); assert.equal(L[0].etape.k, 'reponse')
    assert.deepEqual(L[0].attendent.map((a) => a.t).sort(), ['commande du robot', 'livraison et pose du robot', 'plans d’agencement définitifs'].sort())
    assert.equal(L[0].qui.qui, 'l’ARS'); assert.equal(L[0].qui.geste, 'Appeler l’ARS'); assert.equal(L[0].qui.noter, 'Noter la réponse')
  })
  test('depuis quand : la date de l’étape faite juste avant (la 4e, le 13 octobre) ; en jours à partir d’aujourd’hui', () => {
    const l = D.retenues([chaine3()], AUJ)[0]
    assert.equal(l.depuis, '2026-10-13'); assert.equal(l.jours, 42)
  })
  test('sans étape faite avant, depuis = l’ouverture du volet', () => {
    const p = ph('p2', 'Pharmacie A', [volet('p2', 'transfert', 0, { created_at: '2026-11-02T09:00:00+00:00' }), volet('p2', 'agencement', 3)])
    // transfert à l'étape 1 : plus rien n'attend « Réponse de l'ARS » plus tôt dans le volet, mais ce n'est pas la prochaine étape
    assert.equal(D.retenues([p], AUJ).length, 0)
    assert.equal(D.depuisDe(p.volets[0], D.prochaineEtape(p.volets[0])), '2026-11-02')
  })
  test('le mobilier (fabricant) retient la pose du robot, car la pose attend la fin des travaux', () => {
    const p = ph('p3', 'Pharmacie des Tilleuls Bleus', [volet('p3', 'agencement', 6), volet('p3', 'riedl', 6)])
    const L = D.retenues([p], AUJ)
    assert.equal(L.length, 1); assert.equal(L[0].etape.k, 'mobilier'); assert.equal(L[0].qui.qui, 'le fabricant')
    assert.deepEqual(L[0].attendent.map((a) => a.t), ['livraison et pose du robot'])
  })
  test('une étape à faire par vous ne retient que si elle est en retard', () => {
    const sans = ph('p4', 'Pharmacie B', [volet('p4', 'agencement', 3), volet('p4', 'riedl', 4)])
    assert.equal(D.retenues([sans], AUJ).length, 0)
    const tard = ph('p4', 'Pharmacie B', [volet('p4', 'agencement', 3, {}, { plan3d: '2026-11-14' }), volet('p4', 'riedl', 4)])
    const L = D.retenues([tard], AUJ)
    assert.equal(L.length, 1); assert.equal(L[0].etape.k, 'plan3d'); assert.equal(L[0].retard, 10); assert.equal(L[0].qui.vous, true)
    assert.deepEqual(L[0].attendent.map((a) => a.t).sort(), ['commande du robot', 'livraison et pose du robot'])
  })
  test('une étape qui en attend une autre ne retient rien elle-même', () => {
    const p = chaine3()
    const L = D.retenues([p], AUJ)
    assert.ok(!L.some((l) => l.etape.k === 'plan3d' || l.etape.k === 'bon'))
  })
  test('les règles ne jouent qu’entre volets d’une MÊME pharmacie', () => {
    const a = ph('pa', 'Pharmacie A', [volet('pa', 'transfert', 4)]), b = ph('pb', 'Pharmacie B', [volet('pb', 'agencement', 3), volet('pb', 'riedl', 4)])
    assert.equal(D.retenues([a, b], AUJ).length, 0)
  })
  test('un volet en pause, perdu ou terminé est ignoré', () => {
    const pause = ph('p5', 'Pharmacie C', [volet('p5', 'transfert', 4, { etat: 'pause', raison: 'attente' }), volet('p5', 'agencement', 3)])
    assert.equal(D.retenues([pause], AUJ).length, 0)
    const perdu = ph('p5', 'Pharmacie C', [volet('p5', 'transfert', 4), volet('p5', 'agencement', 3, { etat: 'perdu', raison: 'x' })])
    assert.equal(D.retenues([perdu], AUJ).length, 0)
    const fini = ph('p5', 'Pharmacie C', [volet('p5', 'transfert', 9), volet('p5', 'agencement', 3)])
    assert.equal(D.retenues([fini], AUJ).length, 0)
  })
  test('une pharmacie sans volet, ou avec un seul volet, ne retient rien', () => {
    assert.equal(D.retenues([ph('p6', 'Pharmacie D', []), ph('p7', 'Pharmacie E', [volet('p7', 'riedl', 2)])], AUJ).length, 0)
    assert.equal(D.retenues([], AUJ).length, 0)
  })
  test('le tri : d’abord celle qui retient le plus de choses, puis la plus ancienne', () => {
    const A = chaine3()
    const B = ph('p3', 'Pharmacie des Tilleuls Bleus', [volet('p3', 'agencement', 6), volet('p3', 'riedl', 6)])
    const C = ph('p8', 'Pharmacie F', [volet('p8', 'transfert', 4), volet('p8', 'agencement', 3)])
    const L = D.retenues([B, C, A], AUJ)
    assert.equal(L.length, 3)
    assert.equal(L[0].ph.dossier.id, 'p1')   // 3 choses
    assert.equal(L[1].ph.dossier.id, 'p8')   // 1 chose, depuis le 13 octobre
    assert.equal(L[2].ph.dossier.id, 'p3')   // 1 chose, depuis le 15 octobre
  })
})

describe('cocher l’étape qui retient', () => {
  test('la réponse de l’ARS cochée libère les plans et rien d’autre (la commande attend encore les plans)', () => {
    const libres = D.cequiSeDebloque(chaine3(), 'p1-transfert', 'reponse', AUJ)
    assert.deepEqual(libres, ['plans d’agencement définitifs'])
  })
  test('une étape qui ne retenait rien rend null', () => {
    assert.equal(D.cequiSeDebloque(chaine3(), 'p1-agencement', 'plan3d', AUJ), null)
  })
  test('rien n’est modifié par le calcul (les étapes d’origine restent non faites)', () => {
    const p = chaine3(); D.cequiSeDebloque(p, 'p1-transfert', 'reponse', AUJ)
    assert.equal(p.volets[0].etapes.find((e) => e.k === 'reponse').faite, null)
  })
  test('après la coche, la ligne de l’ARS disparaît et c’est le plan qui retient (il est à vous : ligne seulement s’il est en retard)', () => {
    const p = chaine3(), q = { dossier: p.dossier, volets: p.volets.map((v) => v.sorte === 'transfert' ? { ...v, etapes: v.etapes.map((e) => e.k === 'reponse' ? { ...e, faite: AUJ } : e) } : v) }
    assert.equal(D.retenues([q], AUJ).length, 0)
  })
  test('la phrase de confirmation', () => {
    const e = { c: 'Réponse de l’ARS' }
    assert.equal(D.phraseDebloque('Pharmacie du Pré Lormeau', e, ['plans d’agencement définitifs']), 'Pré Lormeau : l’étape « Réponse de l’ARS » est faite. Se débloque : plans d’agencement définitifs.')
    assert.match(D.phraseDebloque('Pharmacie Z', e, []), /reste retenu par l’étape suivante/)
  })
})

describe('la chaîne d’une pharmacie', () => {
  test('bloque / attend / libre', () => {
    const c = D.chaineBloque(chaine3(), AUJ)
    assert.deepEqual(c.volets.map((x) => x.v.sorte + ':' + x.statut), ['transfert:bloque', 'agencement:attend', 'riedl:attend'])
    assert.equal(c.nbBloque, 1)
    assert.equal(c.regles.length, 3)
  })
  test('un volet qui avance sans rien attendre est « libre » et dit ce qu’il libère ensuite', () => {
    const p = ph('p9', 'Pharmacie G', [volet('p9', 'transfert', 9), volet('p9', 'agencement', 1), volet('p9', 'pda', 2)])
    const c = D.chaineBloque(p, AUJ)
    assert.deepEqual(c.volets.map((x) => x.statut), ['libre', 'libre', 'libre'])   // le transfert est terminé : plus de règle active
    assert.equal(c.nbBloque, 0)
  })
  test('« Plus loin » : une autre étape du même volet qui attend', () => {
    const p = ph('pa', 'Pharmacie H', [volet('pa', 'agencement', 1), volet('pa', 'riedl', 1)])
    const x = D.analyseBloque(p).volets.find((v) => v.v.sorte === 'agencement')
    assert.equal(x.statut, 'libre'); assert.equal(x.waiters.length, 2)   // le robot attend les plans et la fin des travaux
  })
})

describe('les phrases', () => {
  test('le titre du bloc', () => {
    assert.equal(D.titreSemaine(3, 2, 6).titre, '3 choses retiennent vos dossiers')
    assert.equal(D.titreSemaine(1, 1, 6).titre, '1 chose retient vos dossiers')
    assert.match(D.titreSemaine(1, 1, 6).texte, /La voici/)
    assert.match(D.titreSemaine(3, 2, 6).texte, /Sur vos 6 dossiers, 2 attendent/)
    const v = D.titreSemaine(0, 0, 6); assert.equal(v.titre, 'Tous vos dossiers peuvent avancer'); assert.match(v.texte, /Cochez les étapes/)
    assert.doesNotMatch(v.texte, /^0|Rien de prévu/)
  })
  test('qui peut faire bouger : toutes les étapes de toutes les sortes ont leur ligne', () => {
    let n = 0
    for (const s of D.ORDRE) for (const e of D.SORTES[s].etapes) { const q = D.quiDe(s, e.k); assert.notEqual(q.geste, 'Voir le dossier', s + '.' + e.k); n++ }
    assert.equal(n, 37)
  })
  test('« de qui »', () => {
    assert.equal(D.deQui('Vous'), 'vous'); assert.equal(D.deQui('le pharmacien'), 'du pharmacien'); assert.equal(D.deQui('l’ARS'), 'de l’ARS'); assert.equal(D.deQui('un artisan'), 'd’un artisan')
  })
})
