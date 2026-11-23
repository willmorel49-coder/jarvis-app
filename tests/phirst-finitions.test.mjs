// 22/11/2026 — finitions de Phirst V2 (audit A-1 à A-14) : logique pure (dates, mise à jour du robot), barre du bas (rubriques choisies par la marque),
// écrans en attente et Atelier 3D (le VRAI code est exécuté sur un faux navigateur), réglages de marque, CSS sans effet interdit sous Safari.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const P = require('../phirst/v2/phirst-pur.js')
const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')

describe('dates lisibles (A-8)', () => {
  test('l’année s’ajoute quand elle n’est pas celle du jour', () => {
    assert.equal(P.jourAvecAnnee('2026-10-18', '2026-11-22'), '18 octobre')
    assert.equal(P.jourAvecAnnee('2023-08-03', '2026-11-22'), '3 août 2023')
    assert.equal(P.jourAvecAnnee('n’importe quoi', '2026-11-22'), '')
  })
  test('« 03/08/2023 » dans une phrase du robot se lit « 3 août 2023 » ; l’année du jour disparaît ; une date impossible reste telle quelle', () => {
    assert.equal(P.datesLisibles('Cession publiée au BODACC le 03/08/2023', '2026-11-22'), 'Cession publiée au BODACC le 3 août 2023')
    assert.equal(P.datesLisibles('Jugement du 01/11/2026', '2026-11-22'), 'Jugement du 1er novembre')
    assert.equal(P.datesLisibles('Version 45/13/2023', '2026-11-22'), 'Version 45/13/2023')
    assert.equal(P.datesLisibles(null, '2026-11-22'), '')
  })
})

describe('mise à jour du robot (A-8)', () => {
  const maintenant = Date.parse('2026-11-22T10:00:00Z')
  test('ce matin / aujourd’hui / hier / une date, à l’heure de Paris, lue dans l’heure du robot', () => {
    assert.equal(P.miseAJourFr('2026-11-22T06:05:00Z', maintenant), 'ce matin à 7 h 05')
    assert.equal(P.miseAJourFr('2026-11-22T12:00:00Z', Date.parse('2026-11-22T15:00:00Z')), 'aujourd’hui à 13 h')
    assert.equal(P.miseAJourFr('2026-11-21T06:05:00Z', maintenant), 'hier à 7 h 05')
    assert.equal(P.miseAJourFr('2026-10-12T06:05:00Z', maintenant), 'le 12 octobre à 8 h 05')
    assert.equal(P.miseAJourFr('2025-10-12T06:05:00Z', maintenant), 'le 12 octobre 2025 à 8 h 05')
  })
  test('une heure illisible ne dit rien (jamais une heure inventée)', () => {
    assert.equal(P.miseAJourFr('', maintenant), ''); assert.equal(P.miseAJourFr('abc', maintenant), ''); assert.equal(P.miseAJourFr(null, maintenant), '')
  })
  test('telepro_ligne garde l’heure du robot ; une ligne sans heure n’en invente pas', () => {
    assert.equal(P.ligneDeTelepro({ calcule_le: '2026-11-22T06:05:00Z', appels: [], veille: [] }, maintenant).calculeLe, '2026-11-22T06:05:00Z')
    assert.equal(P.ligneDeTelepro({ calcule_le: 'abc', appels: [], veille: [] }, maintenant).calculeLe, null)
    assert.deepEqual(P.ligneDeTelepro(null, maintenant), { trouver: null, frais: false })
  })
})

describe('agenda : un jour vide se reconnaît (A-6)', () => {
  test('carteEnsuite marque l’état vide (le bouton se pose dessus) et pas un jour qui a un rendez-vous', () => {
    const vide = P.carteEnsuite({ elements: [], jour: '2026-11-25', aujourdhui: '2026-11-21', maintenant: '2026-11-21T09:00', libres: 0 })
    assert.equal(vide.vide, true); assert.equal(vide.detail, 'Aucun créneau d’une heure libre.')
    const el = { rdv: { id: 'r', statut: 'confirme', debut: '2026-11-25T10:00', fin: '2026-11-25T11:00', objet: 'Premier rendez-vous' }, fiche: { nom: 'Pharmacie du Port', ville: 'Vannes', lat: null, lon: null } }
    assert.notEqual(P.carteEnsuite({ elements: [el], jour: '2026-11-25', aujourdhui: '2026-11-21', maintenant: '2026-11-21T09:00', libres: 3 }).vide, true)
  })
})

describe('barre du bas : les rubriques de la marque (A-1, A-2)', () => {
  const app = lire('crm/v2/v2-app.js')
  const i = app.indexOf('  V2.tbRubriques = function () {'), j = app.indexOf('\n  };\n', i)
  assert.ok(i > 0 && j > i, 'V2.tbRubriques introuvable')
  const barre = ['todo', 'dossiers', 'chantiers', 'agenda', 'officines', 'carte', 'appels', 'veille', 'encaisser'].map((k) => ({ k, nom: k, act: 'go:' + k, href: '#' + k }))
  const rubriques = (reglage, l = barre) => {
    const V2 = { accueilCinq: { barre: () => l } }
    new Function('V2', 'window', app.slice(i, j + 6))(V2, { V2_BRAND: reglage })
    return V2.tbRubriques().map((t) => t.k)
  }
  test('Phirst : Appels, Agenda, Veille en tête, le reste dans l’ordre d’avant (pour « Menu »)', () => {
    const r = rubriques({ barreBas: ['appels', 'agenda', 'veille'] })
    assert.deepEqual(r.slice(0, 3), ['appels', 'agenda', 'veille'])
    assert.deepEqual(r.slice(3), ['todo', 'dossiers', 'chantiers', 'officines', 'carte', 'encaisser'])
  })
  test('téléprospectrice : sans Dossiers, Chantiers ni Encaisser, la barre garde ses trois rubriques', () => {
    const l = barre.filter((t) => !['dossiers', 'chantiers', 'encaisser'].includes(t.k))
    assert.deepEqual(rubriques({ barreBas: ['appels', 'agenda', 'veille'] }, l).slice(0, 3), ['appels', 'agenda', 'veille'])
  })
  test('une rubrique choisie qui n’existe pas est sautée : la barre prend la suivante, jamais de case vide', () => {
    assert.deepEqual(rubriques({ barreBas: ['appels', 'nexistepas', 'veille'] }).slice(0, 3), ['appels', 'veille', 'todo'])
  })
  test('JARVIS, Escale, OPSO : aucun réglage, l’ordre de la barre du haut est rendu tel quel', () => {
    assert.deepEqual(rubriques({}), barre.map((t) => t.k)); assert.deepEqual(rubriques(undefined), barre.map((t) => t.k)); assert.deepEqual(rubriques({ barreBas: [] }), barre.map((t) => t.k))
  })
  test('Phirst charge la feuille du téléphone et la barre est aux couleurs de Phirst (pas de bleu JARVIS dans la feuille de Phirst)', () => {
    const html = lire('phirst/v2/index.html'), css = lire('phirst/v2/phirst-finitions.css')
    assert.match(html, /crm\/v2\/v2-tel\.css\?v=/)
    assert.match(css, /html\[data-teinte="phirst"\] \.bnav \.bnav-c\.on\{color:var\(--ip-blue\)\}/)
    assert.doesNotMatch(css, /#0050E6|#0043C8|#0A5BF0|#E6EDFB/i)
  })
})

describe('réglages de marque (A-6, A-3)', () => {
  const html = lire('phirst/v2/index.html')
  test('Phirst règle ses phrases du vide, la barre du bas et l’adresse de la 3D', () => {
    assert.match(html, /barreBas: \['appels', 'agenda', 'veille'\]/)
    assert.match(html, /vides: \{ relances: '[^']+', aFaire: '[^']+', modeles: '[^']+' \}/)
    const m = /ancienne3d: '([^']+)'/.exec(html); assert.ok(m)
    assert.match(m[1], /^https:\/\/phirst-studio\.vercel\.app\//); assert.doesNotMatch(m[1], /jarvis|github|morel/i)
  })
  test('le socle lit ces phrases dans la marque et garde les siennes sans réglage (JARVIS inchangé)', () => {
    for (const [f, defaut, cle] of [['crm/v2/v2-app.js', 'Aucune relance à faire.', 'relances'], ['crm/v2/v2-accueil-widgets.js', 'Aucune relance à faire.', 'relances'],
      ['crm/v2/v2-accueil-cinq.js', 'Rien à faire pour l’instant.', 'aFaire'], ['crm/v2/v2-todo.js', "Aucun modèle pour l\\'instant.", 'modeles']]) {
      const s = lire(f); assert.ok(s.includes('window.V2_BRAND.vides.' + cle + ') || \'' + defaut + '\''), f + ' : lecture de vides.' + cle + ' ou phrase d’origine')
    }
  })
})

describe('écrans en attente et Atelier 3D (A-3, A-7)', () => {
  function monde(brand) {
    const racine = { innerHTML: '', __pw: false, addEventListener() {} }
    const V2 = { pages: {}, topbar: () => '<div class="v2-top"></div>', go() {}, route: { name: 'x' } }
    const window = { V2_BRAND: brand, V2, PHIRST_ROLE: null }
    new Function('window', 'V2', lire('phirst/v2/phirst-ecran.js'))(window, V2)
    new Function('window', 'V2', 'document', 'MutationObserver', 'setInterval', 'Object', lire('phirst/v2/phirst-portes.js'))(window, V2, { documentElement: {}, querySelectorAll: () => [] }, class { observe() {} }, () => 0, Object)
    return { V2, racine }
  }
  const brand = { ancienne3d: 'https://phirst-studio.vercel.app/dossiers', portes: { dossiers: { page: 'dossiers' }, chantiers: { page: 'chantiers' }, encaisser: { page: 'encaisser' } } }
  const INTERDITS = /Aperçu|socle|JARVIS|Intégral|bientôt|maquette|arrive/i
  test('chaque écran en attente a un titre, une explication, une action, et aucun mot interne', () => {
    const { V2, racine } = monde(brand)
    for (const k of ['encaisser', 'vitrine']) {   // 23/11/2026 : « dossiers », « chantiers » et « reglages » ont leur vrai écran (phirst-dossiers.js, phirst-chantiers.js, phirst-reglages.js)
      V2.pages[k].render(racine)
      assert.match(racine.innerHTML, /<h1>/); assert.match(racine.innerHTML, /data-vers="(appels|agenda)"/); assert.doesNotMatch(racine.innerHTML, INTERDITS, k)
    }
  })
  test('Atelier 3D : « Ouvrir la 3D » mène à l’ancienne version, dans un nouvel onglet, sans rien vers les images par IA', () => {
    const { V2, racine } = monde(brand)
    V2.pages.atelier.render(racine)
    assert.match(racine.innerHTML, /<a class="lg-gros" href="https:\/\/phirst-studio\.vercel\.app\/dossiers" target="_blank" rel="noopener noreferrer">Ouvrir la 3D/)
    assert.doesNotMatch(racine.innerHTML, INTERDITS); assert.doesNotMatch(racine.innerHTML, /\bIA\b|intelligence artificielle|rendu par/i)
  })
  test('sans adresse réglée, l’Atelier ne fabrique pas un faux lien', () => {
    const { V2, racine } = monde({ portes: {} })
    V2.pages.atelier.render(racine)
    assert.doesNotMatch(racine.innerHTML, /href=/)
  })
})

describe('CSS de Phirst : rien de ce qui fait planter Safari, h1 de la taille de JARVIS (A-4)', () => {
  const css = lire('phirst/v2/phirst-finitions.css')
  test('aucun flou, aucun backdrop-filter, aucune opacité', () => {
    assert.doesNotMatch(css, /backdrop-filter|filter\s*:\s*blur|mix-blend|[^-]opacity\s*:/)
  })
  test('le titre suit clamp(32px, 9vw, 40px) : 40 / 40 / 40 / 35,1 / 32,4 px à 1440 / 1280 / 768 / 390 / 360', () => {
    assert.match(css, /\.pa \.pa-tete h1\{[^}]*clamp\(32px,9vw,40px\)/)
    const taille = (w) => Math.min(40, Math.max(32, 0.09 * w))
    assert.deepEqual([1440, 1280, 768, 390, 360].map((w) => +taille(w).toFixed(1)), [40, 40, 40, 35.1, 32.4])
  })
})
