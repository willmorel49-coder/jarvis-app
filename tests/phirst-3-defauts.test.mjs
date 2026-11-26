// 23/11/2026 — les 3 défauts vus en production le 23/11 (choix cliqué de Will : « Oui, les 3 ») :
// (1) la citation de l'accueil de Phirst sans la signature « Écrit pour JARVIS » (JARVIS et Escale inchangés) ;
// (2) Appels sous 1024 px : l'étiquette sous le nom, plus de nom coupé au milieu du mot ;
// (3) l'Atelier 3D réservé à Yann, comme Dossiers, Chantiers et Encaisser. Le VRAI code est exécuté.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

describe('citation de l’accueil : signature réglée par la marque', () => {
  const app = lire('crm/v2/v2-app.js')
  const i = app.indexOf('  function u2Citation() {'), j = app.indexOf('\n  }\n', i)
  assert.ok(i > 0 && j > i, 'u2Citation introuvable')
  const src = app.slice(i, j + 4)
  // 26/11/2026 : u2Citation lit V2.enGroupement() (réglage de groupement, v2-boot.js)
  const citation = (brand, liste) => new Function('window', 'esc', 'V2', src + '\nreturn u2Citation();')({ V2_BRAND: brand, V2_CITATIONS: liste }, esc, { enGroupement: () => !!(brand && brand.opso) })
  const MAISON = [{ t: 'Un dossier bien rangé.', a: 'Écrit pour JARVIS' }]
  const AUTEUR = [{ t: 'Pas un jour sans une ligne.', a: 'Pline l’Ancien' }]
  const PHIRST = { name: 'Phirst', phirst: true, citationMaison: '' }

  test('Phirst : la citation « Écrit pour JARVIS » reste, sans signature', () => {
    const h = citation(PHIRST, MAISON)
    assert.match(h, /Un dossier bien rangé\./)
    assert.doesNotMatch(h, /figcaption|JARVIS/)
  })
  test('Phirst : une vraie citation garde son auteur', () => {
    assert.match(citation(PHIRST, AUTEUR), /<figcaption>Pline l’Ancien<\/figcaption>/)
  })
  test('Phirst : aucune des 365 citations ne montre « JARVIS »', () => {
    const toutes = new Function(lire('crm/v2/v2-citations-data.js') + '\nreturn V2_CITATIONS;')()
    assert.equal(toutes.length, 365)
    assert.ok(toutes.filter((c) => c.a === 'Écrit pour JARVIS').length > 0, 'témoin : la liste a bien des citations signées')
    for (const c of toutes) assert.doesNotMatch(citation(PHIRST, [c]), /JARVIS/, c.t)
  })
  test('JARVIS et Escale (sans réglage) : la signature reste « Écrit pour JARVIS »', () => {
    for (const brand of [{ name: 'JARVIS Pharma', sub: 'Espace commercial' }, { name: 'Escale Pharma', escale: true }, undefined]) {
      assert.match(citation(brand, MAISON), /<figcaption>Écrit pour JARVIS<\/figcaption><\/figure>$/)
    }
  })
  test('JARVIS et Escale : les 365 citations sortent au caractère près comme avant le 23/11', () => {
    const toutes = new Function(lire('crm/v2/v2-citations-data.js') + '\nreturn V2_CITATIONS;')()
    const avant = (c) => '<figure class="u2-cit" id="u2-citation"><blockquote><p>« ' + esc(c.t) + ' »</p></blockquote><figcaption>' + esc(c.a) + '</figcaption></figure>'
    for (const brand of [{ name: 'JARVIS Pharma', sub: 'Espace commercial' }, { name: 'Escale Pharma', escale: true }]) {
      for (const c of toutes) assert.equal(citation(brand, [c]), avant(c))
    }
  })
  test('le réglage est posé dans la page de Phirst, et nulle part chez JARVIS, Escale ni OPSO', () => {
    assert.match(lire('phirst/v2/index.html'), /citationMaison: '',/)
    assert.doesNotMatch(lire('crm/v2/index.html'), /citationMaison/)
    assert.doesNotMatch(lire('opso/v2/index.html'), /citationMaison/)
  })
})

describe('Appels sous 1024 px : le nom n’est plus coupé au milieu du mot', () => {
  const css = lire('phirst/v2/phirst-finitions.css')
  const i = css.indexOf('@media (max-width:1023px){'), j = css.indexOf('\n}\n', i)
  const bloc = i >= 0 ? css.slice(i, j) : ''
  test('l’étiquette passe sous le nom (sa propre rangée), le nom a toute la largeur', () => {
    assert.ok(bloc, 'bloc « max-width:1023px » introuvable')
    assert.match(bloc, /\.pa-l \.pa-ligne\{grid-template-columns:minmax\(0,1fr\) 28px;grid-template-areas:"nom chev" "motif motif" "raison raison"\}/)
    assert.match(bloc, /\.pa-l \.pa-ligne \.lg-et\{justify-self:start/)
  })
  test('un mot n’est coupé que s’il ne tient pas seul sur la ligne', () => {
    assert.match(bloc, /\.pa-l \.pa-nom b\{overflow-wrap:break-word\}/)
  })
  test('l’ordinateur (1024 px et plus) garde sa ligne d’avant', () => {
    assert.match(css, /@media \(min-width:1024px\)\{[\s\S]*grid-template-areas:"nom motif raison chev"/)
  })
})

describe('Atelier 3D : réservé à Yann', () => {
  async function monde(estTelepro) {
    const racine = { innerHTML: '', __pw: false, addEventListener() {} }
    const V2 = { pages: {}, topbar: () => '<div class="v2-top"></div>', go() {}, route: { name: 'atelier' }, user: { id: 'u1' }, render() { V2.rendu++ }, rendu: 0 }
    const portes = { dossiers: { page: 'dossiers' }, chantiers: { page: 'chantiers' }, encaisser: { page: 'encaisser' }, atelier: { page: 'atelier' }, vitrine: { page: 'vitrine' }, appels: { page: 'appels' } }
    const window = { V2_BRAND: { ancienne3d: 'https://phirst-studio.vercel.app/dossiers', portes }, V2, PHIRST_ROLE: { estTelepro: () => Promise.resolve(estTelepro) } }
    const retires = []
    const document = { documentElement: {}, querySelectorAll: (sel) => { retires.push(sel); return [] } }
    let tic = null
    new Function('window', 'V2', 'document', 'MutationObserver', 'setInterval', lire('phirst/v2/phirst-ecran.js'))(window, V2, document, class { observe() {} }, () => 0)
    new Function('window', 'V2', 'document', 'MutationObserver', 'setInterval', lire('phirst/v2/phirst-portes.js'))(window, V2, document, class { observe() {} }, (f) => { tic = f; return 1 })
    tic(); await new Promise((r) => setTimeout(r, 0))
    return { V2, racine, portes, retires }
  }
  test('téléprospectrice : la porte de l’Atelier quitte le menu et l’accueil, comme les trois autres', async () => {
    const { portes, retires, V2 } = await monde(true)
    for (const k of ['dossiers', 'chantiers', 'encaisser', 'atelier', 'vitrine']) assert.equal(portes[k].page, 'reserve-a-yann', k)
    assert.equal(portes.appels.page, 'appels')
    assert.ok(retires.some((s) => s.includes('go:atelier') && s.includes('a[href="#atelier"]')), 'les liens déjà affichés vers l’Atelier sont retirés')
    assert.equal(V2.rendu, 1)
  })
  test('téléprospectrice qui tape l’adresse : « réservé à Yann », aucun lien vers l’ancienne version', async () => {
    const { V2, racine } = await monde(true)
    V2.pages.atelier.render(racine); await new Promise((r) => setTimeout(r, 0))
    assert.match(racine.innerHTML, /Cet écran est réservé à Yann\./)
    assert.match(racine.innerHTML, /data-vers="appels"/)
    assert.doesNotMatch(racine.innerHTML, /phirst-studio|href=/)
  })
  test('Yann : l’Atelier reste au menu et « Ouvrir la 3D » mène à l’ancienne version', async () => {
    const { V2, racine, portes } = await monde(false)
    assert.equal(portes.atelier.page, 'atelier')
    V2.pages.atelier.render(racine); await new Promise((r) => setTimeout(r, 0))
    assert.match(racine.innerHTML, /href="https:\/\/phirst-studio\.vercel\.app\/dossiers" target="_blank" rel="noopener noreferrer">Ouvrir la 3D/)
    assert.doesNotMatch(racine.innerHTML, /réservé à Yann/)
  })
})
