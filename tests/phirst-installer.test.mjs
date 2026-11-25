// 25/11/2026 — installation de Phirst sur l'iPhone de Yann : icône « 2 · L'aube », manifest, et la carte
// « Mettez Phirst sur votre écran d'accueil » (sous la connexion et en haut de l'accueil, iPhone dans Safari seulement).
// On joue le VRAI code de détection de v2-app.js dans un bac à sable, avec de vrais agents d'iPhone, de Mac et d'Android.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'

const lire = (r) => fs.readFileSync(new URL('../' + r, import.meta.url), 'utf8')
const APP = lire('crm/v2/v2-app.js')
const PHIRST = lire('phirst/v2/index.html')

// Le bloc de détection, tel qu'il est servi (de « var INST_CLE » jusqu'à la fonction qui dessine la carte)
const BLOC = APP.slice(APP.indexOf("var INST_CLE = 'v2-installer-plus-tard'"), APP.indexOf('function instCss()'))

const UA = {
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  appliIntegree: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
}

function visible({ ua, marque = { installer: true }, standalone = false, modeAppli = false, rangeeIlYa = null }) {
  const store = {}
  if (rangeeIlYa !== null) store['v2-installer-plus-tard'] = String(Date.now() - rangeeIlYa * 86400000)
  const V2 = {}
  const win = {
    V2, V2_BRAND: marque, Date, String,
    navigator: { userAgent: ua, standalone },
    matchMedia: (q) => ({ matches: modeAppli && /standalone/.test(q) }),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v } }
  }
  win.window = win
  vm.runInNewContext(BLOC + '\nV2.installerVisible();', win)
  return win.V2.installerVisible()
}

test('le bac à sable a bien trouvé le code de détection', () => {
  assert.ok(BLOC.length > 200 && /V2\.installerVisible = function/.test(BLOC), BLOC.slice(0, 120))
})

test('Phirst dans Safari sur iPhone : la carte apparaît', () => {
  assert.equal(visible({ ua: UA.safariIphone }), true)
})

test('jamais une fois l’icône posée (les deux signaux d’iOS)', () => {
  assert.equal(visible({ ua: UA.safariIphone, standalone: true }), false)
  assert.equal(visible({ ua: UA.safariIphone, modeAppli: true }), false)
})

test('jamais hors de Safari sur iPhone : Chrome, appli intégrée, Mac, Android', () => {
  for (const k of ['chromeIphone', 'appliIntegree', 'safariMac', 'android']) assert.equal(visible({ ua: UA[k] }), false, k)
})

test('« Plus tard » la range sept jours, pas plus', () => {
  assert.equal(visible({ ua: UA.safariIphone, rangeeIlYa: 1 }), false)
  assert.equal(visible({ ua: UA.safariIphone, rangeeIlYa: 6.9 }), false)
  assert.equal(visible({ ua: UA.safariIphone, rangeeIlYa: 7.1 }), true)
})

test('JARVIS et OPSO (sans le réglage) : jamais la carte', () => {
  assert.equal(visible({ ua: UA.safariIphone, marque: {} }), false)
  assert.equal(visible({ ua: UA.safariIphone, marque: { opso: true } }), false)
  assert.equal(visible({ ua: UA.safariIphone, marque: null }), false)
  for (const f of ['crm/v2/index.html', 'opso/v2/index.html']) assert.ok(!/installer\s*:/.test(lire(f)), f)
  assert.ok(/installer:\s*true/.test(PHIRST))
})

test('la carte remplace la barre « Installez JARVIS » chez Phirst, et la connexion comme l’accueil la posent', () => {
  const banniere = APP.slice(APP.indexOf('V2.installBanner = function'), APP.indexOf('V2.dismissInstall = function'))
  assert.ok(/V2_BRAND\.installer\) \{ if \(ex\) ex\.classList\.remove\('show'\); return; \}/.test(banniere))
  const login = APP.slice(APP.indexOf('V2.renderLogin = function'), APP.indexOf('var btn = document.getElementById(\'v2-login-btn\')'))
  assert.ok(/V2\.installerVisible\(\)/.test(login) && /V2\.installerCarte\(\)/.test(login))
  const accueil = APP.slice(APP.indexOf('function u2Accueil(root, m)'), APP.indexOf("'<div class=\"u2-grille\">' +", APP.indexOf('function u2Accueil(root, m)')))
  assert.ok(/V2\.installerVisible\(\) \? '<div class="v2-inst-place v2-inst-acc">'/.test(accueil))
})

test('le texte de la carte : les trois gestes d’iOS 26 et la connexion à refaire une fois', () => {
  const carte = APP.slice(APP.indexOf('V2.installerCarte = function'), APP.indexOf('V2.installerPlusTard = function'))
  for (const t of ['sur votre écran d’accueil', 'à côté de l’adresse', 'Sur l’écran d’accueil', 'app web', 'Ajouter', 'il faudra vous connecter une seule fois', 'Plus tard']) {
    assert.ok(carte.includes(t), t)
  }
})

test('icône et manifest : balises posées, fichiers présents à la bonne taille', () => {
  assert.match(PHIRST, /<link rel="apple-touch-icon" href="icones\/apple-touch-icon\.png\?v=\w+"/)
  assert.match(PHIRST, /<link rel="manifest" href="manifest\.webmanifest\?v=\w+"/)
  assert.match(PHIRST, /<meta name="apple-mobile-web-app-title" content="Phirst"/)
  assert.ok(!/maximum-scale|user-scalable=no/.test(PHIRST), 'le zoom reste permis')
  const m = JSON.parse(lire('phirst/v2/manifest.webmanifest'))
  assert.equal(m.short_name, 'Phirst')
  assert.equal(m.display, 'standalone')
  assert.equal(m.start_url, './')
  const largeur = (r) => { const b = fs.readFileSync(new URL('../phirst/v2/' + r, import.meta.url)); assert.equal(b.toString('latin1', 1, 4), 'PNG', r); return [b.readUInt32BE(16), b.readUInt32BE(20), b[25]] }
  assert.deepEqual(largeur('icones/apple-touch-icon.png').slice(0, 2), [180, 180])
  for (const i of m.icons) {
    const [w, h, couleur] = largeur(i.src)
    assert.equal(i.sizes, w + 'x' + h, i.src)
    assert.ok(couleur !== 4 && couleur !== 6, i.src + ' : sans transparence (iOS met du noir dessous)')
  }
  assert.ok(couleurSans('icones/apple-touch-icon.png'))
  function couleurSans(r) { const t = largeur(r)[2]; return t !== 4 && t !== 6 }
})
