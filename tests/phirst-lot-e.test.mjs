// 23/11/2026 — lot E de Phirst V2 : les choix cliqués de Will du 23/11.
//  1. Bloc-notes de Phirst sans robot (réglage `robotNotes: false`) ; JARVIS garde le sien.
//  2. To do de Phirst sans l'ouverture de compte ni les mails tout prêts d'Intégral (`sortesTaches`, `mailsPrets`), mails signés `societe`.
//  4. Officines : une fiche archivée se dit « Archivée » et se REPREND (même fiche, jamais une deuxième), membre comme téléprospectrice.
// Le VRAI code tourne dans un bac à sable `vm` (faux navigateur, faux client Supabase). Chaque test compare Phirst au cas JARVIS (sans réglage).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const P = require('../phirst/v2/phirst-pur.js')
const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const attendre = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)) }
const noop = () => {}
// Réglages de Phirst lus dans la VRAIE page (pas recopiés) : si la page change, le test suit.
const PAGE = lire('phirst/v2/index.html')
const reglagePhirst = (nom) => { const m = new RegExp(nom + ':\\s*(\\[[^\\]]*\\]|[^,]+?)\\s*,').exec(PAGE); assert.ok(m, 'réglage ' + nom + ' présent dans phirst/v2/index.html'); return vm.runInNewContext('(' + m[1] + ')') }
const BRAND_PHIRST = { name: 'Phirst', phirst: true, robotNotes: reglagePhirst('robotNotes'), mailsPrets: reglagePhirst('mailsPrets'), sortesTaches: reglagePhirst('sortesTaches'), societe: reglagePhirst('societe') }

function bac(brand) {
  // Les minuteurs longs (relecture du Bloc-notes toutes les 60 s…) ne partent pas : le faux navigateur s'arrête avec le test.
  const sb = { console, setTimeout: (f, ms) => (ms > 1000 ? 0 : setTimeout(f, ms)), clearTimeout: (t) => (t ? clearTimeout(t) : undefined), Date, Promise, JSON, Math, URL }
  sb.window = sb; sb.globalThis = sb
  if (brand) sb.V2_BRAND = brand
  const els = {}
  const el = (id) => els[id] || (els[id] = { id, innerHTML: '', hidden: false, textContent: '', className: '', style: {}, value: '', addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], setAttribute: noop, classList: { add: noop, remove: noop, toggle: noop } })
  sb.__els = els; sb.__poses = []
  sb.document = {
    currentScript: { src: 'v2/x.js?v=jeton' }, getElementById: (id) => el(id),
    createElement: (b) => ({ balise: b, style: {}, classList: { add: noop, remove: noop }, setAttribute: noop, addEventListener: noop, querySelector: () => null, remove: noop }),
    head: { appendChild: noop }, body: { classList: { add: noop, remove: noop }, appendChild: (x) => sb.__poses.push(x) },
    addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], activeElement: null
  }
  sb.addEventListener = noop; sb.location = { hash: '' }
  sb.MutationObserver = class { observe() {} disconnect() {} }
  sb.localStorage = { getItem: () => null, setItem: noop, removeItem: noop }
  vm.createContext(sb)
  vm.runInContext(`window.V2 = { route: { name: '' }, esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
    topbar: () => '', go(){}, toast(){}, pharmacies: [], user: null }; window.ICO = () => '';`, sb)
  return sb
}
// Faux client Supabase : chaque requête est un objet chaînable qui finit par `reponse`.
function chaine(reponse) { const c = new Proxy({}, { get: (t, k) => k === 'then' ? (ok, ko) => Promise.resolve(reponse).then(ok, ko) : () => c }); return c }

describe('1. Bloc-notes : Phirst sans robot, JARVIS inchangé', () => {
  const NOTES = [
    { id: 'n1', kind: 'texte', body: 'Vu la pharmacie du Port', statut: 'brouillon', created_at: '2026-11-23T09:00:00Z' },
    { id: 'n2', kind: 'vocal', body: '', transcription: '', statut: 'brouillon', audio_path: 'a/b.webm', duree_s: 12, created_at: '2026-11-23T08:00:00Z' }
  ]
  async function ouvrir(brand) {
    const sb = bac(brand)
    sb.V2.user = { id: 'u1', name: 'Essai' }; sb.V2.sb = () => ({ from: () => chaine({ data: JSON.parse(JSON.stringify(NOTES)), error: null }) })
    sb.V2.route = { name: 'blocnotes' }
    vm.runInContext(lire('crm/v2/v2-bloc-notes.js'), sb)
    const racine = { innerHTML: '' }
    sb.V2.pages.blocnotes.render(racine)
    await attendre()
    const liste = sb.__els['bn-liste'].innerHTML
    assert.match(racine.innerHTML, /<h1>Bloc-notes<\/h1>/, 'marqueur positif : c’est bien le Bloc-notes')
    assert.match(liste, /Vu la pharmacie du Port/, 'marqueur positif : la note chargée est dessinée')
    return { tete: racine.innerHTML, liste, bandeau: sb.__els['bn-bandeau-brouillons'] }
  }
  test('Phirst : aucun mot « robot », ni phrase d’envoi, ni bouton « Envoyer au robot », ni bandeau « Envoyer tout »', async () => {
    const r = await ouvrir(BRAND_PHIRST)
    assert.doesNotMatch(r.tete + r.liste, /robot/i)
    assert.doesNotMatch(r.liste, /data-bn="envoyer"/)
    assert.equal(r.bandeau.hidden, true); assert.doesNotMatch(r.bandeau.innerHTML, /Envoyer tout/)
    assert.match(r.tete, /Vos notes ne sont qu’à vous/)
    assert.match(r.liste, /data-bn="edit"/, 'on peut toujours modifier une note')
    assert.match(r.liste, /data-bn="retirer"/, 'on peut toujours retirer une note')
  })
  test('Phirst : une note vocale ne promet aucune transcription (le robot du Mac ne lit que la base de JARVIS)', async () => {
    const r = await ouvrir(BRAND_PHIRST)
    assert.doesNotMatch(r.liste, /Transcription en cours/)
    assert.match(r.liste, /Écoutez l’enregistrement, ou ajoutez-lui un texte avec « Modifier »/)
  })
  test('JARVIS (sans réglage) : phrase du robot, bouton et bandeau d’envoi, transcription annoncée — comme avant', async () => {
    const r = await ouvrir(null)
    assert.match(r.tete, /envoyez-les au robot/)
    assert.match(r.liste, /Envoyer au robot/)
    assert.equal(r.bandeau.hidden, false); assert.match(r.bandeau.innerHTML, /Envoyer tout au robot/)
    assert.match(r.liste, /Transcription en cours/)
  })
})

describe('2. To do : Phirst sans les mails ni l’ouverture de compte d’Intégral, JARVIS inchangé', () => {
  async function ouvrir(brand) {
    const sb = bac(brand)
    sb.V2.route = { name: 'todo' }
    vm.runInContext(lire('crm/v2/v2-todo.js'), sb)
    const racine = { html: '', set innerHTML(v) { this.html = v }, get innerHTML() { return this.html }, querySelector: () => null, querySelectorAll: () => [] }
    sb.V2.render = () => sb.V2.pages.todo.render(racine)
    sb.V2.pages.todo.render(racine); await attendre()
    sb.V2.todo.ouvrirForm(); sb.V2.pages.todo.render(racine); await attendre()
    assert.match(racine.html, /<h1 class="td-h1">To do list<\/h1>/, 'marqueur positif : c’est bien la To do')
    assert.match(racine.html, /aria-label="Type de tâche"/, 'marqueur positif : le formulaire est ouvert')
    return { sb, html: racine.html }
  }
  test('Phirst : ni « Les mails tout prêts », ni « Ouverture de compte », ni « Intégral » ; « Mes modèles » seul, sur toute la largeur', async () => {
    const { html } = await ouvrir(BRAND_PHIRST)
    assert.doesNotMatch(html, /Les mails tout prêts/)
    assert.doesNotMatch(html, /Ouverture de compte/)
    assert.doesNotMatch(html, /Intégral|Offilog/)
    assert.match(html, /class="tb-bas tb-bas--seul"/); assert.match(html, /<h2>Mes modèles<\/h2>/)
    assert.match(html, /aria-label="Type de tâche" data-n="3">/)
    for (const k of ['rdv', 'merci', 'libre']) assert.match(html, new RegExp('data-k="' + k + '"'))
    assert.doesNotMatch(html, /data-k="compte"/)
  })
  test('Phirst : un nouveau mail part vierge, signé « Phirst » (plus « Intégral Pharma » en dur)', async () => {
    const { sb } = await ouvrir(BRAND_PHIRST)
    sb.V2.todo.editerModele('')
    await attendre()
    const pose = (sb.__els['v2-todo-comp'] || {}).innerHTML || ''
    assert.match(pose, /Bonjour,/, 'marqueur positif : la fenêtre du mail est posée avec son texte')
    assert.match(pose, /Phirst/)
    assert.doesNotMatch(pose, /Intégral/)
    assert.doesNotMatch(pose, /Les mails tout prêts/, 'le choix « Partir d’un mail existant » ne propose aucun mail d’Intégral')
  })
  test('JARVIS (sans réglage) : les trois mails tout prêts, les quatre sortes, la signature Intégral Pharma — comme avant', async () => {
    const { html } = await ouvrir(null)
    assert.match(html, /Les mails tout prêts/)
    assert.match(html, /Ouverture de compte/)
    assert.match(html, /Intégral Pharma/)
    assert.match(html, /aria-label="Type de tâche">/, 'aucun data-n chez JARVIS')
    assert.match(html, /data-k="compte"/)
    assert.doesNotMatch(html, /tb-bas--seul/)
  })
})

describe('4. Officines : « Archivée » + « Reprendre », jamais une deuxième fiche', () => {
  const l = { nom: 'Pharmacie du Port', ville: 'Caen', cles: [P.cle('Pharmacie du Port', 'Caen')] }
  test('une fiche archivée seule → « archivee » avec son id ; une fiche vivante du même nom l’emporte ; aucune → rien', () => {
    assert.deepEqual(P.suiviOfficine(l, P.indexParEtat([{ id: 'a1', nom: 'Pharmacie du Port', ville: 'Caen', stage: 'archive' }])), { etat: 'archivee', id: 'a1' })
    assert.deepEqual(P.suiviOfficine(l, P.indexParEtat([{ id: 'a1', nom: 'Pharmacie du Port', ville: 'Caen', stage: 'archive' }, { id: 'v1', nom: 'PHARMACIE DU PORT', ville: 'caen', stage: 'a_rappeler' }])), { etat: 'piste', id: 'v1' })
    assert.deepEqual(P.suiviOfficine(l, P.indexParEtat([{ id: 'x', nom: 'Autre', ville: 'Caen', stage: 'archive' }])), { etat: '', id: null })
    assert.deepEqual(P.suiviOfficine(l, undefined), { etat: '', id: null })
  })

  function ligne(estTelepro, base) {
    const sb = bac(BRAND_PHIRST)
    sb.PHIRST_ROLE = { estTelepro: () => Promise.resolve(estTelepro) }
    sb.V2.user = { id: 'u1', name: 'Essai' }
    base.appels = []
    sb.V2.sb = () => ({
      rpc: (nom, args) => { base.appels.push(['rpc', nom, args]); return chaine(base.rpc[nom] ? base.rpc[nom](args) : { data: null, error: { message: 'absente' } }) },
      from: (table) => { const q = { table, filtres: [] }; base.appels.push(['from', table, q]); const c = new Proxy({}, { get: (t, k) => k === 'then' ? (ok, ko) => Promise.resolve(base.from(q)).then(ok, ko) : (...a) => { q.filtres.push([k, ...a]); return c } }); return c }
    })
    vm.runInContext(lire('phirst/v2/phirst-ligne.js'), sb)
    assert.ok(sb.PHIRST_PISTE && sb.PHIRST_PISTE.reprendre, 'marqueur positif : PHIRST_PISTE.reprendre existe')
    return sb
  }
  test('membre : « Reprendre » = mise à jour gardée sur « archive » vers « à qualifier », une ligne relue ; 0 ligne = « Pas enregistré »', async () => {
    const base = { rpc: {}, from: () => ({ data: [{ id: 'a1' }], error: null }) }
    const sb = ligne(false, base)
    assert.equal(await sb.PHIRST_PISTE.reprendre('a1'), 'Reprise dans vos pistes.')
    const maj = base.appels.find((x) => x[0] === 'from' && x[1] === 'crm_prospects' && x[2].filtres.some((y) => y[0] === 'update'))
    assert.ok(maj, 'une mise à jour de crm_prospects a été demandée')
    const f = maj[2].filtres
    assert.equal(JSON.stringify(f.find((x) => x[0] === 'update')), JSON.stringify(['update', { stage: 'a_qualifier' }]))
    assert.ok(f.some((x) => x[0] === 'eq' && x[1] === 'id' && x[2] === 'a1')); assert.ok(f.some((x) => x[0] === 'eq' && x[1] === 'stage' && x[2] === 'archive'))
    assert.ok(!base.appels.some((x) => x[0] === 'from' && x[2].filtres.some((y) => y[0] === 'insert')), 'aucune création de fiche')
    base.from = () => ({ data: [], error: null })
    assert.equal(await sb.PHIRST_PISTE.reprendre('a1'), 'Pas enregistré : réessayez dans un instant.')
  })
  test('téléprospectrice : « Reprendre » passe par telepro_reprendre_piste ; un refus de la base ne dit jamais « Reprise »', async () => {
    const base = { rpc: { telepro_reprendre_piste: () => ({ data: true, error: null }) }, from: () => ({ data: null, error: { message: 'interdit' } }) }
    const sb = ligne(true, base)
    assert.equal(await sb.PHIRST_PISTE.reprendre('a1'), 'Reprise dans vos pistes.')
    assert.equal(JSON.stringify(base.appels.find((x) => x[1] === 'telepro_reprendre_piste')[2]), JSON.stringify({ p_prospect: 'a1' }))
    base.rpc.telepro_reprendre_piste = () => ({ data: null, error: { message: 'Cette fiche n’est pas une de vos fiches archivées.' } })
    assert.equal(await sb.PHIRST_PISTE.reprendre('a1'), 'Pas enregistré : réessayez dans un instant.')
  })
  test('téléprospectrice : « Ajouter » une pharmacie dont la fiche est archivée ne crée RIEN et dit de la reprendre ; sans archivée, création comme avant', async () => {
    const piste = { nom: 'Pharmacie du Port', ville: 'Caen' }
    const base = { rpc: { telepro_pistes: () => ({ data: [], error: null }), telepro_archivees: () => ({ data: [{ id: 'a1', nom: 'PHARMACIE DU PORT', ville: 'Caen' }], error: null }), telepro_creer_piste: () => ({ data: 'n1', error: null }) }, from: () => ({ data: null }) }
    const sb = ligne(true, base)
    assert.equal(await sb.PHIRST_PISTE.ajouter(piste), 'Sa fiche est archivée : reprenez-la depuis l’écran Officines.')
    assert.ok(!base.appels.some((x) => x[1] === 'telepro_creer_piste'), 'aucune deuxième fiche')
    base.rpc.telepro_archivees = () => ({ data: [], error: null })
    assert.equal(await sb.PHIRST_PISTE.ajouter(piste), 'Ajoutée à vos pistes.')
    assert.ok(base.appels.some((x) => x[1] === 'telepro_creer_piste'), 'témoin : sans archivée, la création a bien lieu')
    delete base.rpc.telepro_archivees   // fonction absente de la base : comme avant, rien n'est bloqué
    assert.equal(await sb.PHIRST_PISTE.ajouter(piste), 'Ajoutée à vos pistes.')
  })
  test('l’écran Officines branche « Reprendre » et l’état « Archivée » (lecture du vrai fichier)', () => {
    const src = lire('phirst/v2/phirst-officines.js')
    assert.match(src, /P\.suiviOfficine\(l, S\.ie\)/)
    assert.match(src, /data-reprendre="/)
    assert.match(src, />Archivée<\/span>/)
    assert.match(src, /b\.rpc\('telepro_archivees'\)/)
    assert.doesNotMatch(src, /S\.ix\b/, 'plus aucun reste de l’ancien index')
  })
})
