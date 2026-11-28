// Étape 5c (27/11/2026) : le rendu commun « m1 · Le dossier vivant » (phirst/v2/phirst-etude-m1.js), partagé par JARVIS et Phirst.
// Données d'essai INVENTÉES (aucune vraie pharmacie dans le dépôt). Si les vrais fichiers fabriqués existent sur ce Mac, un test de plus rejoue
// recoller(sans, sommes) contre l'étude complète pour les 6 témoins. Le rendu à l'écran, lui, se contrôle sous WebKit (banc hors dépôt).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import zlib from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const M = req('../phirst/v2/phirst-etude-m1.js')
const lire = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8')
const js = lire('../phirst/v2/phirst-etude-m1.js')
const css = lire('../phirst/v2/phirst-etude-m1.css')

describe('contrat : ce que les deux apps appellent', () => {
  test('les noms et la date du dossier', () => {
    assert.deepEqual(Object.keys(M).sort(), ['VERSION_DONNEES', 'degonfler', 'monter', 'pret', 'recoller'])
    assert.match(M.VERSION_DONNEES, /^\d{4}-\d{2}-\d{2}$/)
    for (const f of ['recoller', 'degonfler', 'pret', 'monter']) assert.equal(typeof M[f], 'function')
    assert.match(js, /window\.ETUDE_M1 = API/)
    assert.match(js, /document\.currentScript/)
  })
  test('monter rend demonter et imprimer ; imprimer pose data-impression puis imprime', () => {
    assert.match(js, /return \{ demonter: demonter, imprimer: imprimer \}/)
    assert.match(js, /setAttribute\('data-impression', mode === 'resume' \? 'resume' : 'complet'\); win\.print\(\)/)
    assert.match(js, /addEventListener\('change', surMq\)/); assert.match(js, /removeEventListener\('change', surMq\)/)
  })
  test('la vue jarvis seule reçoit chezIntegral et la mention de collaboration', () => {
    assert.match(js, /jar && opts\.chezIntegral \? '<section class="em1-feuille em1-integral">'/)
    assert.match(js, /\(jar \? '<p class="em1-collab">Étude réalisée en collaboration avec Phirst<\/p>' : ''\)/)
    assert.match(js, /opts\.surCarte\(map, win\.L\)/)
  })
})

describe('portée : rien ne déborde de la racine .em1', () => {
  test('« Chez Intégral » n’apparaît dans aucun des deux fichiers (il n’arrive que par opts.chezIntegral)', () => {
    assert.ok(!/chez\s+int[ée]gral/i.test(js + css))
  })
  test('aucun écouteur direct sur document ou window hors du registre `sur(...)` retiré au démontage', () => {
    const directs = js.match(/\b(document|win|window|doc)\.addEventListener\(/g) || []
    assert.equal(directs.length, 0, directs.join(','))
    assert.match(js, /ecout\.forEach\(function \(e\) \{ e\[0\]\.removeEventListener/)
    for (const t of ['beforeprint', 'afterprint', 'resize', 'keydown']) assert.match(js, new RegExp(`sur\\((win|doc), '${t}'`))
  })
  test('aucun body[data-…], aucun #id global : seulement #pe (existant) et des #em1-…', () => {
    assert.ok(!/body\[data-/.test(css))
    const ids = [...css.matchAll(/#([A-Za-z][\w-]*)/g)].map((m) => m[1]).filter((x) => !/^[0-9a-f]{3,8}$/i.test(x))
    assert.deepEqual([...new Set(ids)].filter((x) => x !== 'pe' && !x.startsWith('em1-')), [])
    const idsJs = [...js.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])
    for (const i of idsJs) assert.ok(i.startsWith('em1-'), i)
  })
  test('chaque règle du CSS commence par .em1 (ou par les rares sélecteurs globaux d’impression)', () => {
    const hors = css.split('\n').filter((l) => /^[.\w\[#*]/.test(l) && !/^(\.em1|html\[data-impression|body\.pe-ouvert|html,)/.test(l) && !l.startsWith('@'))
    assert.deepEqual(hors, [])
  })
  test('toute classe écrite dans le gabarit JS a une règle dans le CSS (le préfixage n’en oublie aucune)', () => {
    const mots = new Set([...js.matchAll(/class="([\w\s-]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean))
    for (const m of js.matchAll(/' (em1-[\w-]+)'/g)) mots.add(m[1])
    const crochets = new Set(['em1-compl-pied', 'em1-chapitres', 'em1-couv-g', 'em1-couv-d', 'em1-loi', 'em1-dec'])
    const sans = [...mots].filter((c) => !/^(lz|legende)$/.test(c) && !crochets.has(c) && !css.includes('.' + c))
    assert.deepEqual(sans, [])
    for (const c of mots) assert.ok(/^(lz|legende|em1|em1-[\w-]+)$/.test(c), 'non préfixée : ' + c)
  })
  test('deux classes imposées par la coordination restent telles quelles : .legende et .lz', () => {
    assert.match(js, /class="legende"/); assert.match(js, /class="lz"/); assert.match(js, /\.legende \.lz\[data-zl\]/)
  })
})

describe('ressources : polices, Chart.js, Leaflet', () => {
  test('les deux polices de l’app existent, déclarées sous leur vrai nom', () => {
    for (const f of ['archivo', 'newsreader']) {
      assert.ok(fs.existsSync(new URL(`../crm/v2/hab/${f}.woff2`, import.meta.url)))
      assert.ok(css.includes(`../../crm/v2/hab/${f}.woff2`))
    }
    assert.match(css, /font-family:Newsreader;src:url\(\.\.\/\.\.\/crm\/v2\/hab\/newsreader\.woff2\)/)
    assert.match(css, /font-family:Archivo;src:url\(\.\.\/\.\.\/crm\/v2\/hab\/archivo\.woff2\)/)
  })
  test('Chart.js 4.4.4 est copié avec sa licence MIT, chargé depuis le dossier du script', () => {
    const c = lire('../crm/v2/vendor/chart/chart.umd.min.js'), l = lire('../crm/v2/vendor/chart/LICENSE')
    assert.match(c, /Chart\.js v4\.4\.4/); assert.match(l, /MIT License/); assert.match(l, /Chart\.js Contributors/)
    assert.match(js, /\.\.\/\.\.\/crm\/v2\/vendor\/chart\/chart\.umd\.min\.js/)
  })
  test('Leaflet : celui de la page d’abord, puis PHIRST_LEAFLET, puis le vendor de JARVIS', () => {
    const i1 = js.indexOf('if (window.L) return'), i2 = js.indexOf('window.PHIRST_LEAFLET'), i3 = js.indexOf('crm/v2/vendor/leaflet/')
    assert.ok(i1 > 0 && i2 > i1 && i3 > i2)
    assert.ok(fs.existsSync(new URL('../crm/v2/vendor/leaflet/leaflet.js', import.meta.url)))
  })
})

describe('garde-fous de la vue téléprospectrice, dans le code', () => {
  test('tx(), somme, verdict_telepro et colonnes CA/résultat gardés', () => {
    assert.match(js, /if \(tel && RE_REEL\.test\(s\)\) return ''/)
    assert.match(js, /tel && v\.somme/); assert.match(js, /tel && r\.verdict_telepro/)
    assert.match(js, /if \(!tel\) cols\.push\(/); assert.match(js, /if \(!tel\) d\('Chiffre d\\'affaires'/)
    assert.match(js, /!tel && ventes\[0\]\.prix/)
  })
  test('aucun caractère invisible dans les deux fichiers (piège déjà payé le 27/11)', () => {
    assert.ok(!/[\u200b-\u200d\u2060\ufeff\u00ad]/.test(js + css))
  })
})

describe('impression', () => {
  test('deux boutons dans la réglette, et les modes dans le CSS', () => {
    assert.match(js, /data-imprimer="resume">Imprimer le résumé</); assert.match(js, /data-imprimer="complet">Imprimer le dossier complet</)
    assert.match(css, /html\[data-impression=resume\] \.em1 \.em1-bloc/)
    assert.match(css, /body\.pe-ouvert>\*:not\(#pe\)\{display:none!important\}/)
    assert.match(css, /\.em1-carte-cadre::after\{display:none\}/)
  })
  test('resize explicite des graphiques à beforeprint (242 px, 200 ou 150 de haut)', () => {
    assert.match(js, /c\.resize\(242, c\.canvas\.parentNode\.classList\.contains\('em1-h'\) \? 150 : 200\)/)
  })
  test('@page n’est posé que tant que l’étude est montée', () => {
    assert.match(js, /pageStyle\.textContent = '@page\{size:A4;margin:12mm\}'/); assert.ok(!/@page/.test(css))
    assert.match(js, /pageStyle\.parentNode\.removeChild\(pageStyle\)/)
  })
})

/* ---------- les purs ---------- */
const etude = () => ({
  meta: { nom: 'Pharmacie Exemple' },
  reponses: [{ id: 'robot', verdict: { texte: 'Un robot de 90 000 € est rentable.', regle: 'seuil' }, verdict_telepro: { texte: 'Un robot peut se discuter.', sans_somme: true },
    blocs: [{ id: 'roi', valeurs: [{ id: 'a', valeur: 3, unite: 'ans' }, { id: 'b', valeur: 1500, unite: '€', somme: true }, { id: 'c', valeur: 7, unite: 'm' }] }] }],
  exploitant: { denomination: 'SELARL Exemple', comptes: [{ cloture: '2024-12-31', ca: { valeur: 1000000, somme: true }, taux_endettement_pct: 40 }, { cloture: '2023-12-31', ca: { valeur: 900000, somme: true }, taux_endettement_pct: 45 }] },
  liste: ['a', 'prix 12 €', 'b', 'c'],
})
const sommesDeLEtude = [
  { chemin: ['reponses', 0, 'verdict'], position: 0, type: 'remplace', valeur: { texte: 'Un robot de 90 000 € est rentable.', regle: 'seuil' } },
  { chemin: ['reponses', 0, 'blocs', 0, 'valeurs', 1], position: 1, type: 'retire', valeur: { id: 'b', valeur: 1500, unite: '€', somme: true } },
  { chemin: ['exploitant', 'comptes', 0, 'ca'], position: 1, type: 'retire', valeur: { valeur: 1000000, somme: true } },
  { chemin: ['exploitant', 'comptes', 1, 'ca'], position: 1, type: 'retire', valeur: { valeur: 900000, somme: true } },
  { chemin: ['liste', 1], position: 1, type: 'retire', valeur: 'prix 12 €' },
]
function sansSommes() {
  const e = etude()
  e.reponses[0].verdict = { texte: 'Un robot peut se discuter.', sans_somme: true }
  e.reponses[0].blocs[0].valeurs.splice(1, 1)
  delete e.exploitant.comptes[0].ca; delete e.exploitant.comptes[1].ca
  e.liste.splice(1, 1)
  return e
}
describe('recoller (même règle que decouper.recoller)', () => {
  test('redonne exactement l’étude complète : liste, objet à sa position, remplacement', () => {
    const r = M.recoller(sansSommes(), sommesDeLEtude)
    assert.equal(JSON.stringify(r), JSON.stringify(etude()))
  })
  test('l’ordre des lignes de sommes n’y change rien (tri : longueur du chemin, puis position)', () => {
    const m = sommesDeLEtude.slice().reverse()
    assert.equal(JSON.stringify(M.recoller(sansSommes(), m)), JSON.stringify(etude()))
  })
  test('ne modifie ni la partie sans sommes ni la liste de sommes reçues', () => {
    const s = sansSommes(), avant = JSON.stringify(s), a2 = JSON.stringify(sommesDeLEtude)
    M.recoller(s, sommesDeLEtude)
    assert.equal(JSON.stringify(s), avant); assert.equal(JSON.stringify(sommesDeLEtude), a2)
  })
  test('plusieurs retraits dans une même liste : chacun retrouve son rang', () => {
    const complet = { l: [1, 'x €', 3, 'y €', 5] }
    const r = M.recoller({ l: [1, 3, 5] }, [{ chemin: ['l', 1], position: 1, type: 'retire', valeur: 'x €' }, { chemin: ['l', 3], position: 3, type: 'retire', valeur: 'y €' }])
    assert.deepEqual(r, complet)
  })
  test('sans aucune somme : rend une copie identique', () => { const s = sansSommes(); assert.deepEqual(M.recoller(s, []), s) })
})
describe('degonfler', () => {
  test('lit un .json.gz comme les apps le reçoivent (ArrayBuffer)', async () => {
    const buf = zlib.gzipSync(Buffer.from(JSON.stringify({ a: 'é €', b: [1, 2] })))
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    assert.deepEqual(await M.degonfler(ab), { a: 'é €', b: [1, 2] })
  })
})

const SORTIE = os.homedir() + '/JARVIS/ETUDES-ZONE/enrichie-2026-11-27/G-france/fabricant/sortie'
const OUTIL = os.homedir() + '/JARVIS/ETUDES-ZONE/enrichie-2026-11-27/G-france/fabricant/outils'
const TEMOINS = ['140010489', '170010342', '490533288', '530031004', '750026833', '2A0002192']
describe('vraies études du Mac (seulement si les fichiers existent)', { skip: !fs.existsSync(SORTIE + '/140010489.json.gz') || !fs.existsSync(OUTIL + '/decouper.py') }, () => {
  for (const f of TEMOINS) {
    test(`recoller(sans, sommes) = étude complète, ${f}`, () => {
      const code = 'import sys, json, gzip; sys.path.insert(0, ' + JSON.stringify(OUTIL) + '); import decouper\n' +
        'e = json.load(gzip.open(' + JSON.stringify(SORTIE + '/' + f + '.json.gz') + '))\n' +
        "s, m = decouper.decouper(e); print(json.dumps({'complet': e, 'sans': s, 'sommes': m}, ensure_ascii=False))"
      const j = JSON.parse(execFileSync('python3', ['-I', '-c', code], { encoding: 'utf8', maxBuffer: 1 << 28 }))
      assert.equal(JSON.stringify(M.recoller(j.sans, j.sommes)), JSON.stringify(j.complet))
      assert.ok(j.sommes.length > 0)
    })
  }
})

describe('écriture des nombres et chargement de la feuille (28/11/2026)', () => {
  // La fabrication avait changé l'espace insécable en espace ordinaire : les montants se coupaient avant « € » à l'impression.
  test("l'espace entre un nombre et son unité est insécable, écrite en clair", () => {
    assert.match(js, /var NBSP = '\\u00a0';/)
    assert.match(js, /\.replace\(\/\[\\u00a0\\u202f\]\/g, NBSP\)/)
  })
  test('la feuille du module reprend le jeton ?v= du module (sinon Safari garde l\'ancienne)', () => {
    assert.match(js, /phirst-etude-m1\.css' \+ jeton\(\)/)
  })
})

describe('correctifs de vérité du 28/11/2026 (transmission, PDA)', () => {
  test('transmission : la phrase de l’étude vient des données, sans âge écrit par le module', () => {
    assert.match(js, /if \(x\.transmission\) h \+= '<div class="em1-val em1-long em1-lphrase"><div class="em1-vl">Transmission<\/div><div class="em1-vv em1-txt em1-phrase">' \+ esc\(tx\(x\.transmission\.texte\)\)/)
  })
  test('transmission : le signal avec l’âge ne s’affiche que dans JARVIS (vues jarvis et telepro), à l’écran seulement', () => {
    assert.match(js, /if \(x\.transmission && \(jar \|\| tel\)\) h \+= '<p class="em1-notice em1-ecran">/)
    assert.match(css, /@media print\{\.em1 \.em1-ecran\{display:none!important\}\}/)
  })
  test('un texte de plus de 40 signes s’écrit comme une phrase (liste des EHPAD écartés), pas comme un chiffre', () => {
    assert.match(js, /var phrase = typeof x === 'string' && x\.length > 40;/)
    assert.match(css, /\.em1 \.em1-val\.em1-lphrase\{grid-template-columns:minmax\(0,1fr\)\}/)   // une seule colonne : le libellé ne passe plus sous la phrase (vu sous WebKit le 28/11)
    assert.match(css, /\.em1 \.em1-val \.em1-vv\.em1-txt\.em1-phrase\{font:400 16px\/1\.4 Archivo,sans-serif;/)
  })
  test('une valeur absente affiche son champ absence (« aucun », « sans objet ») avant « inconnu »', () => {
    assert.match(js, /esc\(tx\(v\.absence\) \|\| 'inconnu'\)/)
  })
})

describe('accord de l’unité (28/11/2026 : « 1 établissements » à l’écran)', () => {
  const bloc = js.slice(js.indexOf('  var PLURIEL = {'), js.indexOf('  function fmtVal('))
  const accord = new Function(bloc + '; return accord;')()
  test('sous 2 : singulier ; à partir de 2 : pluriel ; seul le premier mot s’accorde', () => {
    assert.equal(accord(1, 'établissements'), 'établissement')
    assert.equal(accord(0, 'pharmacies'), 'pharmacie')
    assert.equal(accord(1.5, 'lits pour 100 habitants'), 'lit pour 100 habitants')
    assert.equal(accord(1, "lieux d'exercice"), "lieu d'exercice")
    assert.equal(accord(2, 'commune'), 'communes')
    assert.equal(accord(124, 'établissements'), 'établissements')
    assert.equal(accord(1.999, 'places'), 'places')
  })
  test('une unité inconnue ou une valeur non numérique reste telle quelle', () => {
    for (const u of ['consult./hab./an', 'méd./10 000 hab.', 'mois', '%', 'rang']) assert.equal(accord(1, u), u)
    assert.equal(accord('monte', 'pharmacies'), 'pharmacies')
    assert.equal(accord(1, ''), '')
  })
  test('branché sur l’affichage des nombres et sur les habitants arrondis', () => {
    assert.match(js, /default: return fmtNum\(x\) \+ \(unit \? NBSP \+ accord\(x, unit\) : ''\);/)
    assert.match(js, /NBSP \+ accord\(Math\.round\(i\.valeur\), unit\)/)
  })
})
