// Carte de Phirst — « 2 · Une seule barre » (maquette choisie par Will le 24/11/2026, X-carte-variantes/v2).
// Fait tourner le VRAI écran (phirst/v2/phirst-officines.js) dans un faux navigateur : la barre d'outils (noms courts, nom complet lu
// par VoiceOver), la flèche du bouton Robots qui ouvre le parc concurrent, le tiroir du téléphone en toutes lettres, et la téléprospectrice
// qui n'a ni bouton « Intégral » ni lecture de phirst_integral.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const lire = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const SRC = lire('phirst/v2/phirst-officines.js')
const CSS = lire('phirst/v2/phirst-appels.css')
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const FABS = [{ key: 'omnicell', label: 'Omnicell · parc en détresse', n: 178 }, { key: 'Meditech', label: 'Meditech', n: 1283 }]

function monter({ telepro = false } = {}) {
  const tables = []
  function requete(table) {
    const q = { head: false }
    const chaine = {
      select(c, o) { q.head = !!(o && o.head); return chaine },
      eq() { return chaine }, gte() { return chaine }, lte() { return chaine }, in() { return chaine }, overlaps() { return chaine }, order() { return chaine }, range() { return chaine },
      // oxlint-disable-next-line unicorn/no-thenable -- faux client Supabase : le vrai se lit avec await, il doit donc avoir then
      then(ok, ko) {
        tables.push(table)
        const r = table === 'phirst_officines_meta' ? { data: [{ cle: 'fabs', valeur: FABS }], error: null }
          : table === 'phirst_officines' && q.head ? { count: 3, error: null } : { data: [], error: null }
        return new Promise((res) => setTimeout(() => res(r), 5)).then(ok, ko)
      }
    }
    return chaine
  }
  const base = { from: requete, rpc: () => Promise.resolve({ data: [], error: null }) }
  const bornes = { getSouth: () => 46, getNorth: () => 50, getWest: () => -5, getEast: () => 1, contains: () => true, pad() { return bornes } }
  const carte = {
    setView() { return carte }, fitBounds() { return carte }, on() { return carte }, getZoom: () => 8, setZoom() {}, getBounds: () => bornes, getSize: () => ({ x: 1000, y: 600 }),
    invalidateSize() {}, remove() {}, removeLayer() {}, getContainer: () => ({ style: {}, getBoundingClientRect: () => ({ top: 0, left: 0 }), focus() {} }),
    latLngToContainerPoint: () => ({ x: 0, y: 0 }), keyboard: null, panInside() {}
  }
  const L = {
    map: () => carte, canvas: () => ({}), control: { zoom: () => ({ addTo() {} }) }, tileLayer: () => ({ addTo() {} }), latLngBounds: () => ({}), divIcon: () => ({}),
    layerGroup() { const g = { addTo() { return g }, clearLayers() {} }; return g },
    circleMarker: () => ({ addTo() {} }), marker: () => ({ addTo() { return this }, bindPopup() { return this } })
  }
  const noop = () => {}
  const els = {}
  const el = (id) => els[id] || (els[id] = { id, innerHTML: '', hidden: false, textContent: '', style: {}, setAttribute(k, v) { this[k] = v }, removeAttribute: noop, querySelector: () => null, addEventListener: noop, classList: { add: noop, remove: noop } })
  let clic = null
  const racine = { set innerHTML(v) {}, get innerHTML() { return '' }, classList: { add: noop, remove: noop },
    querySelector: (s) => (s.startsWith('#') ? el(s.slice(1)) : s === '.po-carte' ? el('carte') : null),
    addEventListener: (t, f) => { if (t === 'click') clic = f } }
  const sb = {
    console, setTimeout, clearTimeout, Promise, requestAnimationFrame: (f) => setTimeout(f, 0), L, location: { hash: '#accueil' }, matchMedia: () => ({ matches: false }),
    document: { head: { appendChild: noop }, body: { appendChild: noop }, createElement: () => ({ style: {} }), getElementById: () => null, addEventListener: noop },
    addEventListener: noop
  }
  sb.window = sb
  vm.createContext(sb)
  vm.runInContext(lire('phirst/v2/phirst-pur.js'), sb)
  sb.V2 = { pages: {}, sb: () => base, user: { id: telepro ? 'elle' : 'yann' }, go: noop }
  sb.PHIRST_ECRAN = { cadre: (h) => h }
  sb.PHIRST_ROLE = { estTelepro: () => Promise.resolve(telepro) }
  vm.runInContext(SRC, sb)
  sb.V2.pages.carte.render(racine)
  // Un clic : `sur` = les sélecteurs que l'élément cliqué (ou un parent) satisfait, avec la valeur de son attribut.
  const cliquer = async (sur = {}) => {
    const cible = (s) => (s in sur ? { getAttribute: () => sur[s], closest: (x) => (x === '#po-menu' && sur.dansMenu ? {} : null) } : null)
    clic({ target: { closest: cible } })
    await attendre(30)
  }
  return { el, cliquer, tables }
}
const boutons = (html) => [...html.matchAll(/data-couche="([a-z]+)"/g)].map((m) => m[1])

test('la barre : 7 boutons à noms courts, nom complet lu par VoiceOver et en info-bulle, Secteur / France à part', async () => {
  const c = monter()
  await attendre(200)
  const h = c.el('po-couches').innerHTML
  assert.deepEqual(boutons(h), ['fiches', 'robots', 'transferts', 'ehpad', 'signaux', 'toutes', 'integral'])
  for (const court of ['Mes fiches', 'Robots', 'Cessions', 'EHPAD', 'À saisir', 'Toutes', 'Intégral']) assert.match(h, new RegExp('<span class="po-bn">' + court + '</span>'))
  assert.match(h, /aria-label="Cessions et créations, 3"/)
  assert.match(h, /title="Clients Intégral : cliente d’Intégral, anneau bleu\."/)
  assert.match(h, /class="po-g po-g-integral"/, 'la pastille sert de légende')
  assert.match(c.el('po-perim').innerHTML, /data-perim="only" aria-pressed="true">Secteur de Yann<\/button><button type="button" data-perim="france"/)
  assert.doesNotMatch(h, /data-perim/, 'le périmètre n’est plus mêlé aux couches')
  assert.equal(c.el('po-tlib').textContent, '5 couches affichées')
  assert.equal(c.el('po-tr-n').textContent, 'aucun arrêt')
})

test('le tiroir du téléphone donne les noms en toutes lettres', async () => {
  const c = monter()
  await attendre(200)
  const g = c.el('po-grille').innerHTML
  assert.deepEqual(boutons(g), ['fiches', 'robots', 'transferts', 'ehpad', 'signaux', 'toutes', 'integral'])
  for (const long of ['Robots concurrents', 'Cessions et créations', 'Fournisseurs EHPAD', 'À saisir maintenant', 'Toutes les officines', 'Clients Intégral']) assert.match(g, new RegExp('<span class="po-bn">' + long + '</span>'))
  assert.match(c.el('po-parc').innerHTML, /Omnicell · parc en détresse/)
})

test('la flèche de Robots ouvre le parc concurrent ; un clic ailleurs ou un choix le referment', async () => {
  const c = monter()
  await attendre(200)
  const menu = () => c.el('po-couches').innerHTML.match(/<div class="po-menu" id="po-menu"( hidden)?>/)
  assert.match(c.el('po-couches').innerHTML, /data-menu-parc="1" aria-haspopup="true" aria-expanded="false"/)
  assert.equal(menu()[1], ' hidden', 'fermé à l’ouverture')
  await c.cliquer({ '[data-menu-parc]': '1' })
  assert.equal(menu()[1], undefined, 'ouvert')
  assert.match(c.el('po-couches').innerHTML, /aria-expanded="true"/)
  assert.match(c.el('po-couches').innerHTML, /Omnicell · parc en détresse<\/span><i class="po-chip-n">178<\/i>/)
  assert.match(c.el('po-couches').innerHTML, /Meditech<\/span><i class="po-chip-n">1.283<\/i>/)
  await c.cliquer({})   // un clic sur la carte
  assert.equal(menu()[1], ' hidden', 'un clic ailleurs le referme')
  await c.cliquer({ '[data-menu-parc]': '1' })
  await c.cliquer({ '[data-parc]': 'Meditech', '.po-split': '', dansMenu: true })
  assert.equal(menu()[1], ' hidden', 'le choix le referme')
  assert.match(c.el('po-couches').innerHTML, /<div class="po-split po-fab">/, 'le point sur la flèche dit qu’un fabricant est choisi')
  assert.match(c.el('po-couches').innerHTML, /aria-label="Parc concurrent : Meditech choisi"/)
})

test('robots éteints : plus de flèche ni de parc concurrent', async () => {
  const c = monter()
  await attendre(200)
  await c.cliquer({ '[data-menu-parc]': '1' })
  await c.cliquer({ '[data-couche]': 'robots', '.po-split': '' })
  assert.doesNotMatch(c.el('po-couches').innerHTML, /data-menu-parc|po-menu/)
  assert.equal(c.el('po-parc').hidden, true)
  assert.equal(c.el('po-tlib').textContent, '4 couches affichées')
})

test('téléprospectrice : aucun bouton « Intégral », aucune lecture de phirst_integral', async () => {
  const c = monter({ telepro: true })
  await attendre(200)
  assert.equal(boutons(c.el('po-couches').innerHTML).includes('integral'), false)
  assert.equal(boutons(c.el('po-grille').innerHTML).includes('integral'), false)
  assert.equal(c.el('po-tlib').textContent, '4 couches affichées')
  assert.equal(c.tables.includes('phirst_integral'), false)
})

test('gabarit : la carte remplit la fenêtre sous la barre, la ligne passe sur deux rangées plutôt que de défiler', () => {
  assert.match(SRC, /<section class="pa po po-plein" aria-label="La carte"><h1 class="po-cache">La carte<\/h1>/)
  assert.doesNotMatch(SRC, /<header class="pa-tete"><h1>La carte/)
  assert.match(CSS, /\.pa\.po\.po-plein\{[^}]*height:calc\(100dvh - var\(--v2-top-h,72px\) - var\(--bnav-h,0px\)\)/)
  assert.match(CSS, /\.po-barre\{[^}]*flex-wrap:wrap/)
  assert.match(CSS, /\.po-couches\{[^}]*flex-wrap:wrap/)
  assert.doesNotMatch(CSS, /\.po-(barre|couches)\{[^}]*overflow-x/)
})
