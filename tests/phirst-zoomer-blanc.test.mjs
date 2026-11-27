// Carte de Phirst, vue « Toute la France » — bouton « Zoomer pour tout voir » (27/11/2026, choix cliqué de Will « Oui, texte blanc »).
// Mesuré dans le Safari de Will : texte rgb(22,40,30) sur le vert rgb(26,58,46) = 1,24:1, parce que « .pa button{color:inherit} » (0,1,1)
// passe devant « .po-bouton{color:#fff} » (0,1,0). Garde : une règle au moins aussi précise que « .pa button » remet le texte en blanc, APRÈS elle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const css = fs.readFileSync(new URL('../phirst/v2/phirst-appels.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
test('bouton « Zoomer pour tout voir » : texte blanc plus fort que « .pa button{color:inherit} »', () => {
  const generale = css.search(/\.pa button,[^{]*\{[^}]*color:inherit/)
  const blanc = css.search(/\.pa \.po-bouton\{[^}]*color:#fff/)
  assert.ok(generale >= 0, 'la règle générale .pa button existe toujours (sinon ce test ne garde plus rien)')
  assert.ok(blanc > generale, 'la règle « .pa .po-bouton{color:#fff} » existe et vient après la règle générale')
})
