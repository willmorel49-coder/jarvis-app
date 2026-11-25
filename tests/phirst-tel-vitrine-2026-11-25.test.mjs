// Vitrine au téléphone (25/11/2026, maquette Vitrine 1) : 3 premières demandes, « Voir les N autres », groupes sur une ligne, ordinateur inchangé.
// Lit le code de phirst/v2 (aucune lecture hors du dépôt).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const lire = (f) => fs.readFileSync(new URL('../phirst/v2/' + f, import.meta.url), 'utf8')
const js = lire('phirst-vitrine.js'), css = lire('phirst-vitrine.css')
const tel = css.slice(css.lastIndexOf('@media (max-width:700px){'))
const horsMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')

describe('demandes : trois puis le reste', () => {
  test('seuil téléphone 700 px lu par le script, 3 premières cartes', () => {
    assert.match(js, /matchMedia\('\(max-width:700px\)'\)/)
    assert.match(js, /NB_PREMIERES = 3/)
    assert.match(js, /l\.slice\(0, NB_PREMIERES\)/)
  })
  test('« Voir les N autres » : N calculé, absent à 3 demandes ou moins, déplie sur place (details)', () => {
    assert.match(js, /Voir les ' \+ \(l\.length - NB_PREMIERES\) \+ ' autres<\/summary>'/)
    assert.match(js, /l\.length <= NB_PREMIERES\) return/)
    assert.match(js, /<details class="vt-plus"/)
    assert.match(js, /l\.slice\(NB_PREMIERES\)/)
  })
  test('l’état déplié survit au redessin et un changement de taille redessine', () => {
    assert.match(js, /S\.plus \? ' open'/)
    assert.match(js, /addEventListener\('toggle'/)
    assert.match(js, /TEL\.addEventListener\('change'/)
  })
  test('à l’ordinateur toutes les demandes restent dans la même liste', () => {
    assert.match(js, /!auTel\(\) \|\| l\.length <= NB_PREMIERES\) return h \+ '<ul class="vt-liste">' \+ l\.map\(carteDemande\)/)
  })
})
describe('mise en page téléphone', () => {
  test('titre et phrase sur une ligne (nowrap), titre 20 px, phrase 14 px', () => {
    assert.match(tel, /\.vt \.dz-groupe-t\{flex-wrap:nowrap;justify-content:space-between/)
    assert.match(tel, /\.dz-groupe-t h2\{[^}]*font-size:20px/)
    assert.match(tel, /\.dz-groupe-t span\{[^}]*font-size:14px/)
  })
  test('cartes : 16 px de marge, rayon 22, écart 12 entre cartes', () => {
    assert.match(tel, /\.vt \.dz-carte\{gap:10px;padding:16px;border-radius:22px\}/)
    assert.match(tel, /\.vt-liste,\.vt \.vt-grille\{gap:12px\}/)
  })
  test('bouton « Voir les N autres » pleine largeur, 48 px, sans triangle', () => {
    assert.match(tel, /\.vt-plus>summary\{width:100%;min-height:48px/)
    assert.match(css, /::-webkit-details-marker\{display:none\}/)
  })
  test('boutons des pages en rangée (flex auto, écart 8)', () => {
    assert.match(tel, /\.vt-page \.vt-bs\{gap:8px/)
    assert.match(tel, /\.vt-page \.vt-bs \.dz-btn\{flex:1 1 auto;width:auto;gap:6px;padding:0 10px\}/)
  })
})
describe('ordinateur inchangé et Safari', () => {
  test('aucune règle de ce lot hors @media (sauf le détail du bouton, invisible à l’ordinateur)', () => {
    assert.doesNotMatch(horsMedia, /dz-groupe-t|padding:16px;border-radius:22px|vt-page \.vt-bs/)
  })
  test('pas de flou, verre dépoli, ni opacité', () => {
    assert.doesNotMatch(css, /backdrop-filter|blur\(|opacity/)
  })
})
