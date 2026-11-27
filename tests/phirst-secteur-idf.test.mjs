// 27/11/2026 — l'Île-de-France entre dans le secteur de Yann : le cadre « Zoomer sur mon secteur » de la carte doit la contenir,
// et la lecture d'une couche du secteur doit pouvoir porter toutes ses officines (5 284 dans « Toutes » le 27/11).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const js = fs.readFileSync(new URL('../phirst/v2/phirst-officines.js', import.meta.url), 'utf8')

test('le cadre du secteur contient le Grand Ouest ET l’Île-de-France, pas l’Est', () => {
  const m = /var SECTEUR_BORNES = \[\[([-\d.]+), ([-\d.]+)\], \[([-\d.]+), ([-\d.]+)\]\];/.exec(js)
  assert.ok(m, 'SECTEUR_BORNES introuvable')
  const [s, w, n, e] = m.slice(1).map(Number)
  const dedans = ([la, lo]) => la >= s && la <= n && lo >= w && lo <= e
  for (const [nom, p] of Object.entries({ Brest: [48.39, -4.49], Nantes: [47.22, -1.55], Caen: [49.18, -0.37], Tours: [47.39, 0.69],
    Paris: [48.86, 2.35], Meaux: [48.96, 2.88], Provins: [48.56, 3.30], Fontainebleau: [48.40, 2.70], Mantes: [48.99, 1.72] })) assert.ok(dedans(p), nom)
  for (const [nom, p] of Object.entries({ Strasbourg: [48.58, 7.75], Lyon: [45.76, 4.84], Lille: [50.63, 3.06] })) assert.ok(!dedans(p), nom)
})

test('une couche du secteur peut porter ses 6 253 officines sans être plafonnée (avec de la marge)', () => {
  const m = /var CAP_PAGES = (\d+);/.exec(js)
  assert.ok(m)
  assert.ok(Number(m[1]) * 1000 >= 6253 + 1000, 'CAP_PAGES × 1 000 < 6 253 + 1 000 de marge')
})
