// 24/11/2026 — Phirst ne demande jamais les Infos du matin de JARVIS (infos-jour.json).
// Avant : chaque ouverture de phirst/v2 demandait /phirst/v2/infos-jour.json, absent (404 vu en production, sonde du 24/11).
// On joue le VRAI qInfosCharger de crm/v2/v2-app.js dans un bac à sable, une fois avec la marque Phirst, une fois sans.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'

const SRC = fs.readFileSync(new URL('../crm/v2/v2-app.js', import.meta.url), 'utf8')
const debut = SRC.indexOf('  var _qInfos = {')
const fin = SRC.indexOf('  // La date du jour se lit à Paris', debut)

function demandes(marque) {
  assert.ok(debut > 0 && fin > debut, 'qInfosCharger introuvable dans v2-app.js')
  const vus = []
  const ctx = {
    window: { V2_BRAND: marque }, Date, _u2: { monte: false }, u2MajWidgets() {},
    fetch: (u) => { vus.push(String(u)); return Promise.resolve({ ok: false, json: () => Promise.resolve(null) }) }
  }
  vm.runInNewContext(SRC.slice(debut, fin) + '\nqInfosCharger();', ctx)
  return vus
}

test('la page de Phirst ne demande pas infos-jour.json', () => {
  assert.deepEqual(demandes({ phirst: true }), [])
})

test('JARVIS le demande toujours (contre-épreuve : le bac à sable voit bien la demande)', () => {
  const vus = demandes({})
  assert.equal(vus.filter((u) => /^infos-jour\.json\?d=/.test(u)).length, 1, JSON.stringify(vus))
})
