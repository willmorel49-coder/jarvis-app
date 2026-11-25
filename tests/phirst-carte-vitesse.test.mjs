// Carte de Phirst — rapidité (24/11/2026). Mesuré dans le Safari de Will : CHAQUE geste (glisser, zoomer) retéléchargeait les couches
// (≈ 830 Ko) et redessinait tous les points ; les 5 comptages des puces partaient deux fois à l'ouverture.
// Ce test fait tourner le VRAI écran (phirst/v2/phirst-officines.js) dans un faux navigateur, avec un faux Leaflet et une fausse base
// qui comptent ce qui part réellement. Contre-épreuve : CARTE_SRC=<ancien fichier> node --test tests/phirst-carte-vitesse.test.mjs doit échouer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const lire = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const SRC = process.env.CARTE_SRC ? fs.readFileSync(process.env.CARTE_SRC, 'utf8') : lire('phirst/v2/phirst-officines.js')
const attendre = (ms) => new Promise((r) => setTimeout(r, ms))

function monter() {
  const lu = []           // lectures de lignes (select avec colonnes) de phirst_officines
  const comptes = []      // comptages (head)
  const effacements = {}  // clearLayers par couche
  const ronds = { n: 0 }
  // Fausse base : chaque angle a quelques officines autour d'Angers.
  const lignes = (angle) => [0, 1, 2].map((i) => ({ cle: angle + i, angle, nom: 'Pharmacie ' + angle + ' ' + i, ville: 'Angers', cp: '49000', lat: 47.4 + i * 0.05, lon: -0.55 + i * 0.05, cles: [angle + i], groupements: [], etiquettes: [], pourquoi: [], sieges: [], ehpad_proches: [] }))
  function requete(table) {
    const q = { table, sel: '', head: false, filtres: [] }
    const chaine = {
      select(c, o) { q.sel = c; q.head = !!(o && o.head); return chaine },
      eq(k, v) { q.filtres.push([k, v]); return chaine }, gte() { return chaine }, lte() { return chaine }, lt() { return chaine }, gt() { return chaine },
      ilike() { return chaine }, like() { return chaine }, in() { return chaine }, overlaps() { return chaine }, order() { return chaine }, range() { return chaine },
      // oxlint-disable-next-line unicorn/no-thenable -- faux client Supabase : le vrai se lit avec await, il doit donc avoir then
      then(ok, ko) {
        let r
        if (table === 'phirst_officines' && q.head) { comptes.push(q.sel + ' ' + JSON.stringify(q.filtres)); r = { count: 3, error: null } }
        else if (table === 'phirst_officines') { const a = (q.filtres.find((f) => f[0] === 'angle') || [])[1]; lu.push(a); r = { data: lignes(a), error: null } }
        else r = { data: [], error: null }
        // comme le vrai réseau : un comptage met plus longtemps qu'une lecture des pistes (160 ms contre 140 mesurés)
        return new Promise((res) => setTimeout(() => res(r), q.head ? 60 : 20)).then(ok, ko)
      }
    }
    return chaine
  }
  const base = { from: requete, rpc: () => Promise.resolve({ data: [], error: null }) }
  // Faux Leaflet : une carte dont on règle la vue, des groupes qui comptent leurs effacements.
  const vue = { s: 46.2, n: 49.8, w: -5.3, e: 1.2 }
  const bornes = (b) => ({ getSouth: () => b.s, getNorth: () => b.n, getWest: () => b.w, getEast: () => b.e,
    contains: (o) => (o.getSouth ? o.getSouth() >= b.s && o.getNorth() <= b.n && o.getWest() >= b.w && o.getEast() <= b.e : true),
    pad: (k) => { const dy = (b.n - b.s) * k, dx = (b.e - b.w) * k; return bornes({ s: b.s - dy, n: b.n + dy, w: b.w - dx, e: b.e + dx }) } })
  const handlers = {}
  let zoom = 8
  const carte = {
    setView() { return carte }, fitBounds() { return carte }, on(ev, f) { (handlers[ev] = handlers[ev] || []).push(f); return carte },
    getZoom: () => zoom, setZoom(z) { zoom = z }, getBounds: () => bornes(vue), getSize: () => ({ x: 1000, y: 600 }), invalidateSize() {}, remove() {}, removeLayer() {},
    getContainer: () => ({ style: {}, getBoundingClientRect: () => ({ top: 0, left: 0 }), focus() {} }), latLngToContainerPoint: () => ({ x: 0, y: 0 }), keyboard: null, panInside() {}
  }
  let nGroupe = 0
  const L = {
    map: () => carte, canvas: () => ({}), control: { zoom: () => ({ addTo() {} }) }, tileLayer: () => ({ addTo() {} }),
    latLngBounds: () => ({}), divIcon: () => ({}),
    layerGroup() { const id = 'g' + nGroupe++; const g = { id, addTo() { return g }, clearLayers() { effacements[id] = (effacements[id] || 0) + 1 } }; return g },
    circleMarker: () => ({ addTo() { ronds.n++ } }), marker: () => ({ addTo() { return this }, bindPopup() { return this } })
  }
  const noop = () => {}
  const els = {}
  const el = (id) => els[id] || (els[id] = { id, innerHTML: '', hidden: false, textContent: '', style: {}, setAttribute(k, v) { this[k] = v }, removeAttribute: noop, querySelector: () => null, addEventListener: noop, classList: { add: noop, remove: noop } })
  let clicRacine = null
  const racine = { set innerHTML(v) {}, get innerHTML() { return '' }, classList: { add: noop, remove: noop },
    querySelector: (s) => (s.startsWith('#') ? el(s.slice(1)) : s === '.po-carte' ? el('carte') : null),
    addEventListener: (t, f) => { if (t === 'click') clicRacine = f } }
  const sb = {
    console, setTimeout, clearTimeout, Promise, requestAnimationFrame: (f) => setTimeout(f, 0), L,
    location: { hash: '#accueil' },
    matchMedia: () => ({ matches: false }),
    document: { head: { appendChild: noop }, body: { appendChild: noop }, createElement: () => ({ style: {} }), getElementById: () => null, addEventListener: noop },
    addEventListener: noop
  }
  sb.window = sb
  vm.createContext(sb)
  vm.runInContext(lire('phirst/v2/phirst-pur.js'), sb)
  sb.V2 = { pages: {}, sb: () => base, user: { id: 'yann' }, go: noop }
  sb.PHIRST_ECRAN = { cadre: (h) => h }
  sb.PHIRST_ROLE = { estTelepro: () => Promise.resolve(false) }
  vm.runInContext(SRC, sb)
  sb.V2.pages.carte.render(racine)
  const bouger = async (b) => { Object.assign(vue, b); (handlers.moveend || []).forEach((f) => f()); await attendre(400) }
  const cliquer = async (attr, val) => { clicRacine({ target: { closest: (s) => (s === '[' + attr + ']' ? { getAttribute: () => val } : null) } }); await attendre(50) }
  return { lu, comptes, effacements, ronds, bouger, cliquer, bandeau: () => el('po-bandeau').innerHTML, zoomer: (z) => { zoom = z } }
}

test('secteur : glisser et zoomer ne relisent plus les couches et ne redessinent plus les points ; la phrase suit la vue', async () => {
  const c = monter()
  await attendre(400)
  const lus = c.lu.length, ronds = c.ronds.n, eff = JSON.stringify(c.effacements)
  assert.ok(lus >= 4, 'les couches affichées sont lues à l’ouverture (' + lus + ')')
  assert.match(c.bandeau(), /Dans cette vue : 3 clientes d’Intégral, 3 robots, 3 cessions et créations et 3 EHPAD/)
  await c.bouger({ s: 47.42, n: 47.47, w: -0.53, e: -0.48 })   // ne garde que le 2e point de chaque couche
  c.zoomer(10); await c.bouger({})
  assert.equal(c.lu.length, lus, 'aucune nouvelle lecture des couches après deux gestes')
  assert.equal(c.ronds.n, ronds, 'aucun point redessiné après deux gestes')
  assert.equal(JSON.stringify(c.effacements), eff, 'aucune couche effacée après deux gestes')
  assert.match(c.bandeau(), /Dans cette vue : 1 cliente d’Intégral, 1 robot, 1 transfert et 1 EHPAD/)
})

test('à l’ouverture, chaque comptage de puce ne part qu’une fois', async () => {
  const c = monter()
  await attendre(400)
  const vus = {}
  c.comptes.forEach((k) => { vus[k] = (vus[k] || 0) + 1 })
  const doubles = Object.keys(vus).filter((k) => vus[k] > 1)
  assert.ok(c.comptes.length >= 6, 'les comptages sont bien partis (' + c.comptes.length + ')')
  assert.deepEqual(doubles, [], 'comptage envoyé deux fois')
})

test('éteindre puis rallumer une couche la redessine sans la relire', async () => {
  const c = monter()
  await attendre(400)
  const lus = c.lu.length
  await c.cliquer('data-couche', 'robots')
  await c.cliquer('data-couche', 'robots')
  await attendre(100)
  assert.equal(c.lu.length, lus)
  assert.match(c.bandeau(), /3 robots/)
})

test('toute la France : la zone lue déborde de la vue ; un petit geste dedans ne relit rien, sortir de la zone relit', async () => {
  const c = monter()
  await attendre(400)
  await c.cliquer('data-perim', 'france')
  c.zoomer(9); await c.bouger({ s: 47.0, n: 48.0, w: -1.0, e: 0.0 })
  const lus = c.lu.length
  await c.bouger({ s: 47.1, n: 48.1, w: -0.9, e: 0.1 })
  assert.equal(c.lu.length, lus, 'petit geste dans la zone déjà lue : aucune lecture')
  await c.bouger({ s: 43.0, n: 44.0, w: 4.0, e: 5.0 })
  assert.ok(c.lu.length > lus, 'vue hors de la zone lue : les couches sont relues')
})

test('arrivée directe sur #carte : le fond de carte est demandé dès le chargement du script', () => {
  assert.match(SRC, /if \(\/\^#carte\\b\/\.test\(location\.hash \|\| ''\)\) chargerLeaflet\(function \(\) \{\}\);/)
})
