// Officines au téléphone (maquette « 1 · tuiles qui défilent », 25/11/2026) : points de la maquette lus dans le code, ordinateur inchangé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const js = fs.readFileSync(new URL('../phirst/v2/phirst-officines.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../phirst/v2/phirst-finitions.css', import.meta.url), 'utf8')
const i = css.indexOf('Officines au téléphone')
const bloc = i < 0 ? '' : css.slice(i)
const phone = bloc.slice(bloc.indexOf('@media (max-width:700px){'))
const hors = bloc.slice(0, bloc.indexOf('@media (max-width:700px){'))
const P = '.pa.po:not(.po-plein)'
const regle = (sel) => { const m = phone.split('\n').find((l) => l.trim().startsWith(P + ' ' + sel + '{') || l.trim().startsWith(P + ' ' + sel + ',')); return m || '' }

test('le bloc existe, dans un @media téléphone, toutes les règles préfixées', () => {
  assert.ok(bloc.includes('@media (max-width:700px)'))
  const lignes = phone.split('\n').filter((l) => /\{/.test(l) && !l.includes('@media'))
  assert.ok(lignes.length > 10)
  for (const l of lignes) assert.ok(l.trim().startsWith(P), l)
})
test('tuiles : une rangée qui défile de côté, marge de 16 px alignée, tuile de 152 px', () => {
  const r = regle('.po-grille')
  assert.match(r, /display:flex/); assert.match(r, /overflow-x:auto/); assert.match(r, /padding:2px 16px 8px/); assert.match(r, /margin:0 -16px/); assert.match(r, /scroll-padding:0 16px/)
  assert.match(phone, /\.po-tuile:first-child\{[^}]*width:152px[^}]*min-height:88px/)
  assert.match(phone, /\.po-n\{font-size:26px/)
})
test('recherche sur une ligne : champ, département, loupe', () => {
  assert.match(phone, /\.po-recherche\{display:grid;grid-template-columns:minmax\(0,1fr\) 76px 48px/)
  assert.match(js, /class="po-loupe"/); assert.match(js, /aria-label="Filtrer"/); assert.match(js, /class="po-mot">Filtrer/)
  assert.match(phone, /\.po-mot\{position:absolute/)
})
test('« Grand Ouest… » tient sur une ligne et garde sa phrase complète en info-bulle', () => {
  assert.match(phone, /\.po-une\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/)
  assert.match(js, /class="po-aide po-une" title="/)
})
test('étiquette collée au nom, adresse dessous', () => {
  assert.match(phone, /\.pa-ht\{flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:flex-start/)
  assert.match(phone, /\.pa-ht>div:first-child\{display:contents\}/)
  assert.match(phone, /\.pa-ht small\{order:3;flex:0 0 100%/)
  assert.match(phone, /\.pa-ht \.po-et\{order:2/)
})
test('« Ajouter à mes pistes » en contour avec un plus ; « Reprendre » en contour', () => {
  assert.match(phone, /\.pa-bs \.pa-b\.pa-ok\{[^}]*background-color:#fff/)
  assert.match(js, /class="po-ic-plus"/)
  assert.match(phone, /\.pa-bs \.pa-b\{[^}]*min-height:44px/)
  assert.match(phone, /\.po-ic-plus\{display:block\}/)
})
test('ordinateur inchangé : seules les icônes sont cachées hors du @media, et le bouton plein de la liste reste dans le JS', () => {
  assert.match(hors, /\.po-ic-plus,[^{]*\.po-loupe\{display:none\}/)
  assert.equal(hors.split('\n').filter((l) => /\{/.test(l) && !l.includes('/*')).length, 1)
  assert.match(js, /class="pa-b pa-ok" data-ajout="1"/)
})
test('l’écran « La carte » et la fiche ne sont pas visés', () => {
  assert.ok(!bloc.includes('po-plein) ') || bloc.split(':not(.po-plein)').length > 1)
  assert.ok(!/po-fiche-tel/.test(bloc))
  assert.ok(!/\.pa\.po\.po-plein/.test(bloc))
})
test('Safari : pas de flou, pas de dégradé de texte', () => {
  assert.ok(!/backdrop-filter|filter:\s*blur|background-clip:\s*text/.test(bloc))
})
