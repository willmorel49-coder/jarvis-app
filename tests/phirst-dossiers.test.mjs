// Dossiers de projet de Phirst : logique pure (phirst/v2/phirst-dossiers-pur.js).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import vm from 'node:vm'
const D = createRequire(import.meta.url)('../phirst/v2/phirst-dossiers-pur.js')

const AUJ = '2026-11-23'
function volet(sorte, o = {}) { return { id: 'v-' + sorte, dossier_id: 'd1', sorte, etat: 'cours', details: {}, created_at: '2026-10-12T08:00:00+00:00', ...o } }
function monte(sorte, faites = [], o = {}, prevues = {}) {
  const v = volet(sorte, o)
  const par = {}
  faites.forEach((c) => { par[c] = { volet_id: v.id, cle: c, faite: '2026-10-01' } })
  Object.keys(prevues).forEach((c) => { par[c] = { ...(par[c] || { volet_id: v.id, cle: c }), prevue: prevues[c] } })
  const lignes = Object.values(par)
  return D.monterVolet(v, lignes)
}
function ph(id, nom, volets) { return { dossier: { id, nom }, volets } }

describe('étapes', () => {
  test('les 37 textes, noms courts et clés sont ceux de la maquette', () => {
    const bac = { window: {} }
    vm.runInNewContext(fs.readFileSync('/Users/williammorel/PHIRST/finalisation-2026-11-22/I-dossiers-maquettes/assets/donnees.js', 'utf8'), bac)
    const M = bac.window.PH.SORTES
    let total = 0
    assert.deepEqual(Object.keys(M).sort(), Object.keys(D.SORTES).sort())
    for (const s of Object.keys(M)) {
      assert.equal(D.SORTES[s].nom, M[s].nom)
      assert.equal(D.SORTES[s].etapes.length, M[s].etapes.length)
      M[s].etapes.forEach((e, i) => {
        total++
        assert.equal(D.SORTES[s].etapes[i].t, e.t)
        assert.equal(D.SORTES[s].etapes[i].c, e.c)
        assert.equal(D.SORTES[s].etapes[i].k, e.k)
        assert.equal(!!D.SORTES[s].etapes[i].facultative, !!e.facultative)
      })
    }
    assert.equal(total, 37)
  })
  test('aucune clé ne viole ^[a-z0-9]{2,16}$ et elles sont uniques dans un volet', () => {
    for (const s of D.ORDRE) {
      const cles = D.SORTES[s].etapes.map((e) => e.k)
      cles.forEach((k) => assert.match(k, /^[a-z0-9]{2,16}$/))
      assert.equal(new Set(cles).size, cles.length)
    }
  })
  test('Riedl : 10 étapes avec remplacement, 9 sans (texte vide ou espaces = sans)', () => {
    assert.equal(D.etapesDe('riedl', { remplacement: 'Omnicell' }).length, 10)
    assert.equal(D.etapesDe('riedl', {}).length, 9)
    assert.equal(D.etapesDe('riedl', { remplacement: '   ' }).length, 9)
    assert.equal(D.etapesDe('riedl', null).length, 9)
    assert.ok(D.etapesDe('riedl', { remplacement: 'X' }).some((e) => e.k === 'demontage'))
    assert.ok(!D.etapesDe('riedl', {}).some((e) => e.k === 'demontage'))
    assert.equal(D.etapesDe('transfert', { remplacement: 'X' }).length, 9)
  })
  test('fusion : une étape sans ligne = rien de prévu, rien de fait ; ligne étrangère ignorée', () => {
    const v = D.monterVolet(volet('agencement'), [{ volet_id: 'v-agencement', cle: 'devis', prevue: '2026-12-01', notes: 'n', docs: [{ nom: 'a' }] }, { volet_id: 'v-agencement', cle: 'zzz', faite: '2026-10-01' }, { volet_id: 'autre', cle: 'rdv', faite: '2026-10-01' }])
    assert.equal(v.etapes.length, 9)
    assert.equal(D.nbFaites(v), 0)
    const dv = v.etapes.find((e) => e.k === 'devis')
    assert.equal(dv.prevue, '2026-12-01'); assert.equal(dv.notes, 'n'); assert.equal(dv.docs.length, 1)
    const r = v.etapes[0]
    assert.deepEqual([r.prevue, r.faite, r.notes, r.docs], [null, null, '', []])
    assert.deepEqual(v.etapes.map((e) => e.n), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
  test('« ouvert le » se lit à l’heure de Paris', () => {
    assert.equal(D.monterVolet(volet('pda', { created_at: '2026-07-02T23:30:00+00:00' }), []).ouvert, '2026-07-03')
  })
})

describe('avancement', () => {
  test('prochaine = première non faite, même si une suivante est faite', () => {
    const v = monte('agencement', ['rdv', 'ambiance'])
    assert.equal(D.prochaineEtape(v).k, 'releve')
    assert.equal(D.nbFaites(v), 2)
  })
  test('démontage faite puis remplacement retiré : l’étape disparaît du compte', () => {
    const v = D.monterVolet(volet('riedl', { details: {} }), [{ volet_id: 'v-riedl', cle: 'demontage', faite: '2026-10-01' }])
    assert.equal(D.nbFaites(v), 0)
  })
  test('terminé est calculé : toutes faites ET état cours', () => {
    const cles = D.SORTES.agencement.etapes.map((e) => e.k)
    const v = monte('agencement', cles)
    assert.equal(D.estTermine(v), true)
    assert.equal(D.etatAffiche(v, AUJ), 'termine')
    assert.equal(D.prochaineEtape(v), null)
    assert.equal(D.termineLe(v), '2026-10-01')
    assert.equal(D.estTermine(monte('agencement', cles.slice(1))), false)
    assert.equal(D.etatAffiche(monte('agencement', cles, { etat: 'pause' }), AUJ), 'pause')
    assert.equal(D.estTermine(monte('agencement', cles, { etat: 'perdu' })), false)
  })
  test('terminé le = la date faite la plus récente', () => {
    const v = D.monterVolet(volet('pda'), D.SORTES.pda.etapes.map((e, i) => ({ volet_id: 'v-pda', cle: e.k, faite: i === 3 ? '2026-11-05' : '2026-10-01' })))
    assert.equal(D.termineLe(v), '2026-11-05')
  })
  test('retard : 0 si faite, sans date, ou à venir ; « 1 jour » / « 2 jours »', () => {
    const e = (o) => ({ prevue: null, faite: null, ...o })
    assert.equal(D.retard(e({ prevue: '2026-11-22' }), AUJ), 1)
    assert.equal(D.retard(e({ prevue: '2026-11-21' }), AUJ), 2)
    assert.equal(D.retard(e({ prevue: AUJ }), AUJ), 0)
    assert.equal(D.retard(e({ prevue: '2026-11-24' }), AUJ), 0)
    assert.equal(D.retard(e({ prevue: '2026-11-01', faite: '2026-11-02' }), AUJ), 0)
    assert.equal(D.retard(e(), AUJ), 0)
    assert.equal(D.ligneDate(e({ prevue: '2026-11-22' }), AUJ).texte, 'En retard de 1 jour · prévue le 22 nov. 2026')
    assert.equal(D.ligneDate(e({ prevue: '2026-11-21' }), AUJ).texte, 'En retard de 2 jours · prévue le 21 nov. 2026')
    assert.equal(D.ligneDate(e({ prevue: '2026-11-16' }), AUJ).texte, 'En retard de 7 jours · prévue le 16 nov. 2026')
    assert.deepEqual(D.ligneDate(e({ prevue: '2026-12-01' }), AUJ), { texte: 'Prévue le 1er déc. 2026', retard: false })
    assert.deepEqual(D.ligneDate(e(), AUJ), { texte: 'Date à fixer', retard: false })
  })
  test('état affiché', () => {
    assert.equal(D.etatAffiche(monte('pda', [], {}, { rdv: '2026-11-01' }), AUJ), 'retard')
    assert.equal(D.etatAffiche(monte('pda', [], {}, { rdv: '2026-12-01' }), AUJ), 'cours')
    assert.equal(D.etatAffiche(monte('pda', [], { etat: 'pause' }, { rdv: '2026-11-01' }), AUJ), 'pause')
    assert.equal(D.etatAffiche(monte('pda', [], { etat: 'perdu' }), AUJ), 'perdu')
    assert.deepEqual(D.statutVolet(monte('pda', [], { etat: 'pause' }), AUJ), { ton: 'orange', texte: 'En pause' })
  })
  test('la fiche d’un retard sur une étape FAITE ne compte plus', () => {
    const v = monte('pda', ['rdv'], {}, { rdv: '2026-01-01', etude: '2026-12-31' })
    assert.equal(D.etatAffiche(v, AUJ), 'cours')
  })
})

describe('volet le plus urgent', () => {
  test('la date la plus en retard gagne ; sans date après toute date ; pause après les autres', () => {
    const a = monte('transfert', [], {}, { rdv: '2026-11-20' })
    const b = monte('agencement', [], {}, { rdv: '2026-11-10' })
    assert.equal(D.urgent([a, b], AUJ).volet.sorte, 'agencement')
    const c = monte('riedl', [], {})
    assert.equal(D.urgent([c, a], AUJ).volet.sorte, 'transfert')
    const p = monte('pda', [], { etat: 'pause' }, { rdv: '2026-01-01' })
    assert.equal(D.urgent([p, c], AUJ).volet.sorte, 'riedl')
    assert.equal(D.urgent([p], AUJ).volet.sorte, 'pda')
  })
  test('ni perdu ni terminé ; rien à rendre si rien', () => {
    const cles = D.SORTES.pda.etapes.map((e) => e.k)
    assert.equal(D.urgent([monte('pda', [], { etat: 'perdu' }), monte('agencement', cles.slice(0, 0))].slice(0, 1), AUJ), null)
    assert.equal(D.urgent([monte('pda', cles)], AUJ), null)
    assert.equal(D.urgent([], AUJ), null)
  })
})

describe('groupes de la liste', () => {
  const cles9 = D.SORTES.agencement.etapes.map((e) => e.k)
  test('av / dem / fin / att', () => {
    const g = D.groupes([
      ph('1', 'A', [monte('agencement', ['rdv'])]),
      ph('2', 'B', [monte('agencement', [])]),
      ph('3', 'C', [monte('agencement', cles9)]),
      ph('4', 'D', [monte('agencement', [], { etat: 'pause' })]),
      ph('5', 'E', [monte('agencement', [], { etat: 'perdu' }), monte('transfert', [], { etat: 'pause' })]),
      ph('6', 'F', [monte('agencement', cles9), monte('pda', [], { etat: 'pause' })]),
      ph('7', 'G', [monte('agencement', cles9), monte('pda', ['rdv'])])
    ], AUJ)
    const ids = (k) => g[k].map((p) => p.dossier.id).sort()
    assert.deepEqual(ids('av'), ['1', '7'])
    assert.deepEqual(ids('dem'), ['2'])
    assert.deepEqual(ids('fin'), ['3'])
    assert.deepEqual(ids('att'), ['4', '5', '6'])
  })
  test('un dossier SANS volet va dans « À démarrer » (jamais Terminés)', () => {
    const g = D.groupes([ph('9', 'Pharmacie Démo', [])], AUJ)
    assert.equal(g.dem.length, 1); assert.equal(g.fin.length, 0); assert.equal(g.att.length, 0)
    assert.deepEqual(D.statutPharmacie([], AUJ), { ton: '', texte: 'À démarrer' })
  })
  test('un volet terminé + un volet en cours sans avancée : à démarrer', () => {
    assert.equal(D.groupes([ph('1', 'A', [monte('agencement', cles9), monte('pda', [])])], AUJ).dem.length, 1)
  })
  test('tri : en retard d’abord, puis la date, puis le nom', () => {
    const l = [
      ph('a', 'Zèbre', [monte('pda', ['rdv'], {}, { etude: '2026-12-10' })]),
      ph('b', 'Alpha', [monte('pda', ['rdv'], {}, { etude: '2026-12-10' })]),
      ph('c', 'Milieu', [monte('pda', ['rdv'], {}, { etude: '2026-12-01' })]),
      ph('d', 'Sans', [monte('pda', ['rdv'])]),
      ph('e', 'Retard', [monte('pda', ['rdv'], {}, { etude: '2026-11-20' })])
    ]
    assert.deepEqual(D.trierCartes(l, AUJ).map((p) => p.dossier.id), ['e', 'c', 'b', 'a', 'd'])
  })
  test('phrase de comptage', () => {
    const g = { av: [1, 2], dem: [1], fin: [1, 2], att: [1] }
    assert.equal(D.phraseCompte(g, 6, 10), '6 pharmacies, 10 volets : 2 avancent, 1 à démarrer, 2 terminées, 1 en pause ou perdue.')
    assert.equal(D.phraseCompte({ av: [1], dem: [], fin: [], att: [] }, 1, 1), '1 pharmacie, 1 volet : 1 avance.')
    assert.equal(D.phraseCompte({ av: [], dem: [1], fin: [], att: [1, 2] }, 3, 2), '3 pharmacies, 2 volets : aucune n’avance, 1 à démarrer, 2 en pause ou perdues.')
    assert.equal(D.phraseCompte({ av: [], dem: [1], fin: [], att: [] }, 1, 0), '1 pharmacie, aucun volet : aucune n’avance, 1 à démarrer.')
    assert.equal(D.phraseCompte({ av: [], dem: [], fin: [], att: [] }, 0, 0), '')
  })
  test('pastille d’une pharmacie', () => {
    assert.equal(D.statutPharmacie([monte('pda', [], {}, { rdv: '2026-11-01' })], AUJ).texte, 'En retard')
    assert.equal(D.statutPharmacie([monte('pda', [])], AUJ).texte, 'En cours')
    assert.equal(D.statutPharmacie([monte('pda', [], { etat: 'perdu' })], AUJ).texte, 'En pause ou perdu')
    assert.equal(D.statutPharmacie([monte('agencement', cles9)], AUJ).texte, 'Terminé')
    assert.equal(D.suffixeVolet(monte('pda', [], { etat: 'pause' })), ' · en pause')
    assert.equal(D.suffixeVolet(monte('pda', [], { etat: 'perdu' })), ' · perdu')
    assert.equal(D.suffixeVolet(monte('agencement', cles9)), ' · terminé')
  })
})

describe('dates et textes', () => {
  test('dates en français', () => {
    assert.equal(D.court('2026-12-01'), '1er déc. 2026')
    assert.equal(D.court('2026-11-02'), '2 nov. 2026')
    assert.equal(D.long('2026-08-01'), '1er août 2026')
    assert.equal(D.long('2026-02-15'), '15 février 2026')
    assert.equal(D.jourLong('2026-12-01'), 'mardi 1er décembre 2026')
    assert.equal(D.court('n’importe quoi'), '')
    assert.equal(D.heureFr('10:30'), '10 h 30'); assert.equal(D.heureFr('09:00'), '9 h')
  })
  test('aujourd’hui à l’heure de Paris', () => {
    assert.equal(D.aujourdhui(new Date('2026-11-22T23:30:00Z')), '2026-11-23')
    assert.equal(D.aujourdhui(new Date('2026-07-01T22:30:00Z')), '2026-07-02')
  })
  test('maintenant à l’heure de Paris, même forme qu’un début de rendez-vous', () => {
    assert.equal(D.maintenant(new Date('2026-11-22T23:30:00Z')), '2026-11-23T00:30')
    assert.equal(D.maintenant(new Date('2026-07-01T10:05:00Z')), '2026-07-01T12:05')
  })
  test('détails d’un volet', () => {
    const t = monte('transfert', [], { details: { regroupement: 'Pharmacie de la Lande', regroupementVille: 'Savenay' } })
    assert.equal(D.texteSegs(D.detailsVolet(t)[0].segs), 'Regroupement avec Pharmacie de la Lande (Savenay)')
    assert.equal(D.detailsVolet(monte('transfert', [])).length, 0)
    assert.equal(D.texteSegs(D.detailsVolet(monte('pda', [], { details: { ehpad: 4, residents: 212 } }))[0].segs), '4 EHPAD · 212 résidents')
    assert.equal(D.texteSegs(D.detailsVolet(monte('pda', [], { details: { ehpad: 0 } }))[0].segs), '0 EHPAD')
    assert.equal(D.texteSegs(D.detailsVolet(monte('riedl', [], { details: { remplacement: 'Omnicell' } }))[0].segs), 'Remplacement d’un robot : Omnicell')
    assert.equal(D.detailsVolet(monte('agencement', [], { details: { remplacement: 'X' } })).length, 0)
  })
})

describe('fichiers et documents', () => {
  test('nom de fichier propre : sans accents ni espaces, extension gardée, 80 max', () => {
    assert.equal(D.nomFichierPropre('Devis Définitif (n°2).PDF'), 'devis-definitif-n-2.pdf')
    assert.equal(D.nomFichierPropre('plan 3D été.jpg'), 'plan-3d-ete.jpg')
    assert.equal(D.nomFichierPropre('///.png'), 'document.png')
    assert.equal(D.nomFichierPropre(''), 'document')
    const long = D.nomFichierPropre('a'.repeat(300) + '.pdf')
    assert.equal(long.length, 80); assert.ok(long.endsWith('.pdf'))
    assert.ok(D.nomFichierPropre('é'.repeat(200) + ' x.docx').length <= 80)
    assert.doesNotMatch(D.nomFichierPropre('Ça va très bien.pdf'), /[^a-z0-9._-]/)
  })
  test('chemin d’un document', () => {
    assert.equal(D.cheminDocument('u1', 'd1', 'riedl', 'offre', 'Offre Robot.pdf', 1763900000000), 'u1/d1/etapes/riedl/offre/1763900000000-offre-robot.pdf')
  })
  test('taille : 25 Mo dit avant l’envoi, 40 documents au plus', () => {
    assert.equal(D.verifierFichier({ size: 25 * 1024 * 1024 }, 0), '')
    assert.match(D.verifierFichier({ size: 25 * 1024 * 1024 + 1 }, 0), /25 Mo/)
    assert.match(D.verifierFichier({ size: 0 }, 0), /vide/)
    assert.match(D.verifierFichier({ size: 10 }, 40), /40 documents/)
    assert.equal(D.verifierFichier({ size: 10 }, 39), '')
    assert.equal(D.tailleLisible(1536 * 1024), '1,5 Mo'); assert.equal(D.tailleLisible(2048), '2 Ko'); assert.equal(D.tailleLisible(12), '12 o')
  })
})

describe('contrôles des champs', () => {
  test('raison obligatoire ≤ 500', () => {
    assert.equal(D.verifierRaison('').ok, false)
    assert.equal(D.verifierRaison('   ').ok, false)
    assert.equal(D.verifierRaison('x'.repeat(500)).ok, true)
    assert.equal(D.verifierRaison('x'.repeat(501)).ok, false)
    assert.equal(D.verifierRaison('  ok  ').valeur, 'ok')
  })
  test('nombres entiers ≥ 0', () => {
    assert.deepEqual(D.verifierEntier('', 'x'), { ok: true, valeur: null })
    assert.equal(D.verifierEntier('0').valeur, 0)
    assert.equal(D.verifierEntier('212').valeur, 212)
    for (const m of ['-1', '1,5', '1.5', 'abc', '1e3']) assert.equal(D.verifierEntier(m).ok, false, m)
  })
  test('détails par sorte', () => {
    assert.deepEqual(D.verifierDetails('riedl', { remplace: true, remplacement: ' Omnicell ' }), { ok: true, details: { remplacement: 'Omnicell' } })
    assert.equal(D.verifierDetails('riedl', { remplace: true, remplacement: '  ' }).ok, false)
    assert.deepEqual(D.verifierDetails('riedl', { remplace: false, remplacement: 'Omnicell' }), { ok: true, details: {} })
    assert.deepEqual(D.verifierDetails('transfert', { regroupement: 'Pharmacie B', regroupementVille: 'Nantes' }).details, { regroupement: 'Pharmacie B', regroupementVille: 'Nantes' })
    assert.deepEqual(D.verifierDetails('transfert', { regroupement: 'Pharmacie B' }).details, { regroupement: 'Pharmacie B' })
    assert.deepEqual(D.verifierDetails('transfert', { regroupementVille: 'Nantes' }).details, {})
    assert.equal(D.verifierDetails('transfert', { regroupement: 'x'.repeat(201) }).ok, false)
    assert.equal(D.verifierDetails('transfert', { regroupement: 'x'.repeat(200) }).ok, true)
    assert.deepEqual(D.verifierDetails('pda', { ehpad: '4', residents: '212' }).details, { ehpad: 4, residents: 212 })
    assert.deepEqual(D.verifierDetails('pda', { ehpad: '', residents: '' }).details, {})
    assert.equal(D.verifierDetails('pda', { ehpad: '-3' }).ok, false)
    assert.equal(D.verifierDetails('pda', { residents: '2,5' }).ok, false)
    assert.deepEqual(D.verifierDetails('agencement', {}).details, {})
    assert.equal(D.verifierDetails('inconnue', {}).ok, false)
  })
  test('pharmacie hors pistes : nom obligatoire, textes ≤ 200', () => {
    assert.equal(D.verifierPharmacie({ nom: ' ' }).ok, false)
    assert.deepEqual(D.verifierPharmacie({ nom: ' Pharmacie X ', ville: '', titulaire: 'M. Y' }).valeur, { nom: 'Pharmacie X', ville: null, titulaire: 'M. Y' })
    assert.equal(D.verifierPharmacie({ nom: 'a', ville: 'v'.repeat(201) }).ok, false)
    assert.equal(D.verifierPharmacie({ nom: 'a'.repeat(201) }).ok, false)
    assert.deepEqual(D.pharmacieDePiste({ nom: ' P ', ville: 'Nantes', pharmacien: null }), { nom: 'P', ville: 'Nantes', titulaire: null })
  })
  test('notes ≤ 8000', () => {
    assert.equal(D.verifierNotes('x'.repeat(8000)).ok, true)
    assert.equal(D.verifierNotes('x'.repeat(8001)).ok, false)
  })
})

describe('pistes, rendez-vous, 3D', () => {
  test('pistes sans dossier, non archivées, filtrées nom/ville sans accents', () => {
    const p = [{ id: 1, nom: 'Pharmacie Étoile', ville: 'Nantes' }, { id: 2, nom: 'Beta', ville: 'Cholet', dossier_id: 'x' }, { id: 3, nom: 'Alpha', ville: 'Étel', stage: 'archive' }, { id: 4, nom: 'Alpha', ville: 'Rennes', stage: 'nouveau' }]
    assert.deepEqual(D.pistesSansDossier(p, '').map((x) => x.id), [4, 1])
    assert.deepEqual(D.pistesSansDossier(p, 'etoile').map((x) => x.id), [1])
    assert.deepEqual(D.pistesSansDossier(p, 'RENNES').map((x) => x.id), [4])
    assert.deepEqual(D.pistesSansDossier(p, 'etel').map((x) => x.id), [])
  })
  test('prochain rendez-vous : non annulé, à venir, de la bonne piste, le plus proche', () => {
    const r = [
      { id: 'a', prospect_id: 'p', debut: '2026-11-22T10:00', statut: 'confirme' },
      { id: 'b', prospect_id: 'p', debut: '2026-11-25T10:00', statut: 'annule' },
      { id: 'c', prospect_id: 'p', debut: '2026-12-01T10:30', statut: 'propose' },
      { id: 'd', prospect_id: 'p', debut: '2026-11-30T09:00', statut: 'confirme' },
      { id: 'e', prospect_id: 'q', debut: '2026-11-24T09:00', statut: 'confirme' }
    ]
    assert.equal(D.prochainRdv(r, 'p', '2026-11-23T08:00').id, 'd')
    assert.equal(D.prochainRdv(r, 'q', '2026-11-23T08:00').id, 'e')
    assert.equal(D.prochainRdv(r, 'p', '2026-12-05T08:00'), null)
    assert.equal(D.prochainRdv(r, 'zz', '2026-11-23T08:00'), null)
    assert.equal(D.prochainRdv([], 'p', '2026-11-23T08:00'), null)
    assert.equal(D.quandRdv(r[2]), 'Mardi 1er décembre 2026 à 10 h 30')
  })
  test('adresse « Ouvrir la 3D »', () => {
    assert.equal(D.adresse3D('https://phirst-studio.vercel.app/dossiers', 'abc'), 'https://phirst-studio.vercel.app/dossiers/abc')
    assert.equal(D.adresse3D('https://x.app/dossiers/', 'abc'), 'https://x.app/dossiers/abc')
    assert.equal(D.adresse3D('', 'abc'), '')
  })
  test('sortes qu’on peut encore ajouter', () => {
    assert.deepEqual(D.sortesAbsentes([{ sorte: 'riedl' }, { sorte: 'transfert' }]), ['agencement', 'pda'])
    assert.deepEqual(D.sortesAbsentes([]), D.ORDRE)
  })
  test('assemblage : volets rangés dans l’ordre des sortes, lignes rattachées au bon volet', () => {
    const vs = [{ id: 'b', dossier_id: 'd', sorte: 'pda' }, { id: 'a', dossier_id: 'd', sorte: 'transfert' }, { id: 'z', dossier_id: 'autre', sorte: 'riedl' }]
    const r = D.pharmacies([{ id: 'd', nom: 'P' }], vs, [{ volet_id: 'a', cle: 'rdv', faite: '2026-10-01' }, { volet_id: 'b', cle: 'rdv', prevue: '2026-12-01' }])
    assert.deepEqual(r[0].volets.map((v) => v.sorte), ['transfert', 'pda'])
    assert.equal(D.nbFaites(r[0].volets[0]), 1); assert.equal(D.nbFaites(r[0].volets[1]), 0)
  })
})

describe('le téléphone et le geste de la ligne de détails (vus à l’écran le 23/11)', () => {
  test('un numéro à 10 chiffres s’écrit par paires, un autre reste tel quel', () => {
    assert.equal(D.telLisible('0261912407'), '02 61 91 24 07')
    assert.equal(D.telLisible('02.61.91.24.07'), '02 61 91 24 07')
    assert.equal(D.telLisible('+33 2 61 91 24 07'), '+33 2 61 91 24 07')
    assert.equal(D.telLisible(null), '')
  })
  test('jamais un « Modifier » seul : le geste dit ce qu’il ajoute quand rien n’est encore noté', () => {
    assert.equal(D.gesteDetails('transfert', {}), 'Ajouter un regroupement')
    assert.equal(D.gesteDetails('transfert', { regroupement: 'Pharmacie de la Lande' }), 'Modifier le regroupement')
    assert.equal(D.gesteDetails('riedl', {}), 'Indiquer un remplacement de robot')
    assert.equal(D.gesteDetails('riedl', { remplacement: 'Omnicell' }), 'Modifier')
    assert.equal(D.gesteDetails('pda', {}), 'Préciser les EHPAD servis')
    assert.equal(D.gesteDetails('pda', { ehpad: 0 }), 'Modifier')
    assert.equal(D.gesteDetails('agencement', {}), '')
  })
})
