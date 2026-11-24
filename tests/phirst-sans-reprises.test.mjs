// 24/11/2026 — Phirst ne demande jamais le fichier des reprises d'officines d'Intégral (crm/v2/reprises.json).
// Avant : chaque ouverture de phirst/v2 demandait /phirst/v2/reprises.json, absent partout (404 vu en production).
// On joue le VRAI v2-boot.js dans un bac à sable, une fois avec la marque Phirst, une fois sans : seul JARVIS le demande.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'

const SRC = fs.readFileSync(new URL('../crm/v2/v2-boot.js', import.meta.url), 'utf8')

async function demandes(marque) {
  const vus = []
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] })
  const win = {
    V2_BRAND: marque, URL, setTimeout, clearTimeout, addEventListener() {}, navigator: { userAgent: 'node' },
    location: { href: 'https://exemple.test/phirst/v2/', origin: 'https://exemple.test', hash: '', search: '' },
    fetch: (u) => { vus.push(String(u)); return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }) },
    localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, head: el(), body: el(), documentElement: el(), addEventListener() {} }
  }
  win.window = win
  vm.runInNewContext(SRC, win)
  await new Promise((r) => setTimeout(r, 10))
  return vus
}

test('la page de Phirst ne demande pas reprises.json', async () => {
  const vus = await demandes({ phirst: true })
  assert.equal(vus.filter((u) => /reprises\.json/.test(u)).length, 0, JSON.stringify(vus))
})

test('JARVIS le demande toujours (contre-épreuve : le bac à sable voit bien la demande)', async () => {
  const vus = await demandes({})
  assert.equal(vus.filter((u) => /reprises\.json/.test(u)).length, 1, JSON.stringify(vus))
})
