// Lot F Phirst (25/11/2026) : « l'étude de zone » (phirst/v2/phirst-etude-pur.js). Données d'essai INVENTÉES au format du contrat
// (aucune vraie pharmacie, aucun vrai chiffre d'affaires dans le dépôt). Si une étude réelle est posée dans ~/PHIRST/.../donnees/etudes, un test de plus la rejoue.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const E = req('../phirst/v2/phirst-etude-pur.js')
const src = fs.readFileSync(new URL('../phirst/v2/phirst-etude.js', import.meta.url), 'utf8')
const srcCss = fs.readFileSync(new URL('../phirst/v2/phirst-etude.css', import.meta.url), 'utf8')
const srcOff = fs.readFileSync(new URL('../phirst/v2/phirst-officines.js', import.meta.url), 'utf8')
const srcIdx = fs.readFileSync(new URL('../phirst/v2/index.html', import.meta.url), 'utf8')

const contour = (lat, lon, r) => Array.from({ length: 12 }, (_, i) => [+(lon + r * Math.cos(i / 12 * 2 * Math.PI)).toFixed(5), +(lat + r * Math.sin(i / 12 * 2 * Math.PI)).toFixed(5)])
const logements = (k) => Object.fromEntries([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((a, i) => [String(a), { autorises: k * (i + 2), commences: k * (i + 1) }]))
function zone(m, k) {
  return { minutes: m, contour: contour(48.1, -1.7, 0.02 * m / 5), pharmacies_finess: 2 * k, concurrents_finess: 2 * k - 1, habitants: 3000 * k * k, menages: 1000 * k, carreaux: 40 * k,
    part_65_plus: 20.1, part_80_plus: 4.8, part_0_17: 20, menages_pauvres: 7.8, generalistes: 5 * k, apl_moyen: 6.1, apl_min: 4.2, pop_2015: 2788, pop_2023: 2612, evolution_pct: -6.3,
    communes: ['Exempleville'], logements: logements(k * 10), commerces: 15 * k, services: 41 * k, sante_social: 46, supermarches: k, hypermarches: 0, boulangeries: 5 }
}
function pharma(i, zoneN, extra = {}) {
  return { finess: '1400000' + String(i).padStart(2, '0'), nom: 'PHARMACIE D’ESSAI ' + i, commune: 'ESSAIVILLE', zone: zoneN, lat: 48.1 + i / 1000, lon: -1.7, position_source: 'bpe', distance_km: +(0.5 + i / 10).toFixed(2),
    titulaires: 1, adjoints: 1, titulaire_seul: false, naissance_plus_ancien: 1980, compte_publie: true, perte_annee: null, criteres: { titulaire_60_ou_plus: false, titulaire_seul: false }, est_etudiee: false, ...extra }
}
export function etude(nConc = 6, over = {}) {
  const D = {
    calcule_le: '25/11/2026',
    pharmacie: { nom: 'Pharmacie d’Essai Centrale', adresse: '1 rue de l’Essai, 35000 Exempleville', commune: 'Exempleville', insee: '35000', departement: '35', intercommunalite: 'Communauté urbaine Exemple Métropole',
      siren: '000000000', creation: '2012', lat: 48.1, lon: -1.7, titulaires: 1, adjoints: 3, naissance_gerant: 1979, finess: '140000000' },
    commune: { nom: 'Exempleville', pop_2015: 2788, pop_2023: 2612, evolution_pct: -6.3, pharmacies: 1, departement: '35', apl: 7.07, apl_moins_60: 5.79, apl_france: 3.72, part_60_plus: 28.8, generalistes: 6, logements_autorises_2023_2026: 60, programme_anct: null },
    zones: { 5: zone(5, 1), 10: zone(10, 2), 15: zone(15, 3) },
    pharmacies: [{ ...pharma(0, 5), finess: '140000000', nom: 'PHARMACIE D’ESSAI CENTRALE', est_etudiee: true }],
    comptes: { testees: 48, ca_lisible: 11, confidentiels: 32, aucun_compte: 5 },
    sources: { isochrone: { qui: 'IGN Géoplateforme', quoi: 'temps de trajet en voiture', annee: 'calculé le 25/11/2026' }, finess: { qui: 'Ministère de la Santé, FINESS', quoi: 'liste des pharmacies', annee: 'extraction du 04/05/2026' },
      carreaux: { qui: 'INSEE, Filosofi', quoi: 'habitants par carré de 200 m', annee: '2021' }, historique: { qui: 'INSEE', quoi: 'séries historiques de population', annee: '2015 et 2023' },
      rpps: { qui: 'Annuaire Santé (RPPS)', quoi: 'médecins et pharmaciens', annee: 'fichier du 25/11/2026' }, apl: { qui: 'DREES', quoi: 'accès aux généralistes', annee: '2024' },
      sitadel: { qui: 'Ministère de la Transition écologique, Sitadel', quoi: 'logements autorisés', annee: 'jusqu’à septembre 2026' }, bpe: { qui: 'INSEE, BPE', quoi: 'commerces et services', annee: '2025' },
      entreprises: { qui: 'Annuaire des entreprises', quoi: 'comptes déposés', annee: 'lu le 25/11/2026' }, quorum: { qui: 'Code de la santé publique', quoi: 'article L5125-4', annee: 'en vigueur' } },
    communes_en_baisse_zone15: [], top_logements: [], titulaire_seul_total: 3 }
  for (let i = 1; i <= nConc; i++) D.pharmacies.push(pharma(i, i % 3 === 0 ? 15 : i % 2 ? 5 : 10))
  D.pharmacies.push(pharma(90, 10, { nom: 'PHARMACIE DU VIEUX CHÊNE', criteres: { titulaire_60_ou_plus: true, titulaire_seul: true }, titulaire_seul: true, naissance_plus_ancien: 1950, perte_annee: 2023, compte_publie: false }))
  return Object.assign(D, over)
}
const sommesEssai = { pharmacie: { ca: 3111111, ca_annee: 2020, resultat: 222222, resultat_annee: 2020 }, commune: { niveau_vie_median: 25630 },
  zones: { 5: { niveau_vie_moyen: 26608 }, 10: { niveau_vie_moyen: 27263 }, 15: { niveau_vie_moyen: 24707 } }, pharmacies: { '140000090': { ca: null, ca_annee: null, resultat: -41000, resultat_annee: 2023 } } }
const vide = (h) => h.replace(/<[^>]+>/g, ' ').replace(/[\u202f\u00a0]/g, ' ').replace(/ {2,}/g, ' ')
const euro = (h) => (h.match(/€/g) || []).length
const sale = (h) => /\bnull\b|NaN|undefined|\[object/.test(vide(h)) || /\bnull\b|NaN|undefined|\[object/.test(h)

describe('vue Yann / vue téléprospectrice', () => {
  const D = etude()
  test('Yann voit les sommes (contre-épreuve de la vue téléprospectrice)', () => {
    const h = E.feuilles(D, sommesEssai, { yann: true })
    assert.ok(euro(h) > 0, 'aucun « € » côté Yann')
    assert.match(vide(h), /Niveau de vie moyen/)
    assert.match(vide(h), /26 608/)
    assert.match(vide(h), /3 111 111/)
    assert.match(vide(h), /Perte en 2023 : −41 000/)
  })
  test('la téléprospectrice : 0 « € » nulle part, ni trou à la place', () => {
    const h = E.feuilles(D, sommesEssai, { yann: false })
    assert.equal(euro(h), 0)
    assert.doesNotMatch(vide(h), /Niveau de vie/)
    assert.doesNotMatch(vide(h), /3 111 111|26 608|41 000/)
    assert.match(vide(h), /Perte en 2023/, 'la perte reste dite sans montant')
    assert.doesNotMatch(vide(h), /Chiffre d’affaires 2020/)
  })
  test('même si des sommes lui sont passées par erreur, la vue téléprospectrice ne les écrit pas', () => {
    assert.equal(euro(E.feuilles(D, sommesEssai, { yann: false })), 0)
    assert.equal(euro(E.feuilles(D, sommesEssai, undefined)), 0)
  })
  test('l’écran ne demande les sommes qu’à un membre', () => {
    assert.match(src, /if \(tel \|\| S\.yann === false\) return \{ etat: 'ok', D: D, sommes: null, yann: false \}/)
    assert.ok(src.lastIndexOf("phirst_etudes_sommes") > src.indexOf('if (tel || S.yann === false)'), 'la table des sommes est lue APRÈS la garde')
    assert.equal((src.match(/phirst_etudes_sommes/g) || []).length, 2) // l'en-tête et l'unique lecture
  })
  test('« À surveiller » : sur la feuille interne seulement, jamais dans ce qui s’imprime', () => {
    const h = E.feuilles(D, sommesEssai, { yann: true })
    const f = h.split('<section').filter(Boolean).map(s => '<section' + s)
    assert.equal(f.length, 4)
    assert.ok(f.slice(0, 3).every(s => !/à surveiller|Né en 1950|Perte en|Aucun compte publié/i.test(s)))
    assert.match(f[3], /data-interne/); assert.match(f[3], /à surveiller/); assert.match(f[3], /Vieux Chêne/)
    assert.match(srcCss, /@media print[\s\S]*\[data-interne\],#pe \.pe-etat\{display:none!important/)
  })
  test('la feuille interne de la téléprospectrice existe, sans sommes', () => {
    const h = E.feuilles(D, null, { yann: false })
    assert.match(h, /data-interne/); assert.match(h, /Feuille interne/); assert.doesNotMatch(h, /Pour Yann seulement/)
    assert.match(E.feuilles(D, null, { yann: true }), /Pour Yann seulement/)
  })
  test('Yann sans les sommes (lecture échouée) : la page se rend et le dit', () => {
    const h = E.feuilles(D, null, { yann: true }); assert.match(vide(h), /sommes n’ont pas pu être lues/); assert.ok(!sale(h))
  })
})

describe('quorum', () => {
  const q = (p, n = 1, d = '14') => E.quorum(p, n, d)
  test('seuils', () => {
    assert.equal(q(2612).autorisees, 1); assert.equal(q(6999).autorisees, 1); assert.equal(q(7000).autorisees, 2)
    assert.equal(q(2499).autorisees, 0); assert.equal(q(2500).autorisees, 1); assert.equal(q(11500).autorisees, 3)
    assert.equal(q(3000, 1, '67').autorisees, 0); assert.equal(q(3500, 1, '67').autorisees, 1)
    for (const d of ['57', '68', '973']) assert.equal(q(3000, 1, d).autorisees, 0, d)
    assert.equal(q(3000, 1, '14').autorisees, 1)
  })
  test('prochain seuil, manque, verdict', () => {
    assert.equal(q(2612).prochain_seuil, 7000); assert.equal(q(2612).manque, 4388); assert.equal(q(2612).verdict, 'conforme')
    assert.equal(q(7000, 1).verdict, 'sous-densité'); assert.equal(q(2612, 2).verdict, 'surdensité')
    assert.equal(q(2499, 1).verdict, null); assert.equal(E.quorum(null, 1, '14'), null)
  })
  test('phrases : singulier, pluriel, aucune, sous le seuil', () => {
    const t = (pop, n, d) => vide(E.phraseQuorum({ nom: 'Essaiville', pop_2023: pop }, E.quorum(pop, n, d)))
    assert.match(t(2612, 1, '14'), /1 pharmacie\b(?!s)/); assert.match(t(2612, 1, '14'), /La loi en autorise 1 : la commune est conforme/)
    assert.match(t(9000, 2, '14'), /2 pharmacies/); assert.match(t(9000, 0, '14'), /aucune pharmacie/)
    const bas = t(2499, 1, '14'); assert.doesNotMatch(bas, /autorise 0/); assert.match(bas, /sous les 2 500 habitants/); assert.match(bas, /il manque 1 habitants?/)
    assert.match(t(3000, 1, '67'), /sous les 3 500 habitants/)
    assert.match(t(2612, 1, '14'), /deuxième pharmacie ne deviendrait possible qu’à 7 000 habitants/)
  })
  test('dans la page : population 2 499 et 0 pharmacie, département 67', () => {
    const h = E.feuilles(etude(6, { commune: { ...etude().commune, pop_2023: 2499, pharmacies: 0 } }), null, { yann: false })
    assert.doesNotMatch(vide(h), /autorise 0/); assert.match(vide(h), /aucune pharmacie/)
    const h2 = E.feuilles(etude(6, { commune: { ...etude().commune, pop_2023: 3000, departement: '67' } }), null, { yann: false })
    assert.match(vide(h2), /sous les 3 500 habitants/)
  })
})

describe('données manquantes', () => {
  test('tout à null : aucun « null », « NaN », « undefined », aucun faux 0', () => {
    const D = etude(0)
    for (const z of Object.values(D.zones)) for (const k of Object.keys(z)) if (!['minutes', 'contour'].includes(k)) z[k] = null
    for (const k of Object.keys(D.commune)) if (k !== 'nom') D.commune[k] = null
    D.pharmacie.intercommunalite = null; D.pharmacie.naissance_gerant = null; D.pharmacie.creation = null; D.pharmacie.titulaires = null; D.pharmacie.adjoints = null
    D.comptes = {}; D.titulaire_seul_total = null; D.calcule_le = null
    const s = { pharmacie: { ca: null, ca_annee: null, resultat: null, resultat_annee: null }, zones: {}, pharmacies: {} }
    for (const yann of [true, false]) {
      const h = E.feuilles(D, yann ? s : null, { yann })
      assert.ok(!sale(h), 'null/NaN/undefined dans le rendu (yann=' + yann + ') : ' + (vide(h).match(/.{20}(null|NaN|undefined).{20}/) || [''])[0])
      assert.doesNotMatch(vide(h), /\b0 habitants|0 pharmacie/, 'un inconnu ne devient pas 0')
    }
    assert.match(vide(E.feuilles(D, null, { yann: false })), /—/)
  })
  test('structure minimale : ne plante pas', () => {
    for (const D of [{}, { zones: {} }, { pharmacie: {}, commune: {}, zones: {}, pharmacies: [] }]) assert.ok(!sale(E.feuilles(D, null, { yann: false })))
  })
  test('un seul champ nul : « — » à sa place', () => {
    const D = etude(); D.zones[10].habitants = null
    assert.match(vide(E.feuilles(D, null, { yann: false })), /—\s+habitants à moins de 10 minutes/)
  })
  test('logements inconnus (Sitadel sans réponse) : le chapitre le dit, sans graphique vide', () => {
    const avec = vide(E.feuilles(etude(), null, { yann: false }))
    assert.doesNotMatch(avec, /pas encore dans cette étude/)
    const D = etude(); for (const k of ['5', '10', '15']) D.zones[k].logements = null
    const h = E.feuilles(D, null, { yann: false })
    assert.match(vide(h), /logements autorisés autour de la pharmacie ne sont pas encore dans cette étude/)
    assert.doesNotMatch(h, /pe-barres/)
    assert.doesNotMatch(h, /null|NaN|undefined/)
  })
})

describe('chapitre 03 : les pharmacies autour', () => {
  const lis = (h) => (h.match(/<li><span>[^<]*<\/span>(<span>[^<]*<\/span>)?<\/li>/g) || [])
  test('40 concurrents : les 16 plus proches + « et 24 autres »', () => {
    const D = etude(0); for (let i = 1; i <= 40; i++) D.pharmacies.push(pharma(i, 5 + (i % 2) * 5)); D.pharmacies = D.pharmacies.filter(p => p.finess !== '140000090')
    const h = E.feuilles(D, null, { yann: false })
    const sec = h.split('pe-liste')[1].split('</ul>')[0]
    assert.equal((sec.match(/<li>/g) || []).length, 16); assert.equal((sec.match(/pe-reste/g) || []).length, 1)
    assert.match(vide(sec), /et 24 autres/)
    assert.match(vide(h), /Les 16 plus proches parmi les 40 autres pharmacies/)
    assert.match(sec, /Pharmacie d’Essai 1\b/)   // la plus proche d'abord
    assert.doesNotMatch(sec, /Essai 17\b[^0-9]*<\/span><span>1[0-9],/)
  })
  test('exactement 16 : pas de « et 0 autres »', () => {
    const D = etude(0); D.pharmacies = D.pharmacies.filter(p => p.est_etudiee); for (let i = 1; i <= 16; i++) D.pharmacies.push(pharma(i, 5))
    const h = vide(E.feuilles(D, null, { yann: false })); assert.doesNotMatch(h, /et 0 autre/); assert.match(h, /Les 16 autres pharmacies/)
  })
  test('zéro concurrent : une phrase propre', () => {
    const D = etude(0); D.pharmacies = D.pharmacies.filter(p => p.est_etudiee)
    const h = E.feuilles(D, null, { yann: false })
    assert.match(vide(h), /Aucune autre pharmacie à moins de 10 minutes\./); assert.doesNotMatch(h, /<ul class="pe-liste">/); assert.ok(!sale(h))
  })
  test('une seule : singulier', () => {
    const D = etude(0); D.pharmacies = D.pharmacies.filter(p => p.est_etudiee); D.pharmacies.push(pharma(1, 5))
    assert.match(vide(E.feuilles(D, null, { yann: false })), /L’autre pharmacie à moins de 10 minutes/)
  })
  test('la 3e zone (15 min) n’entre pas dans la liste à 10 min', () => {
    const D = etude(0); D.pharmacies = D.pharmacies.filter(p => p.est_etudiee); D.pharmacies.push(pharma(1, 15))
    assert.match(vide(E.feuilles(D, null, { yann: false })), /Aucune autre pharmacie à moins de 10 minutes/)
  })
})

describe('mise en page et sécurité du rendu', () => {
  test('3 feuilles + la feuille interne ; carte, titre unique', () => {
    const h = E.feuilles(etude(), sommesEssai, { yann: true })
    assert.equal((h.match(/<section class="pe-feuille/g) || []).length, 4); assert.equal((h.match(/id="pe-carte"/g) || []).length, 1); assert.equal((h.match(/<h1>/g) || []).length, 1)
    assert.match(h, /1 \/ 3/); assert.match(h, /3 \/ 3/)
  })
  test('le texte venu des données est échappé', () => {
    const D = etude(); D.pharmacie.nom = '<img src=x onerror=alert(1)>'; D.pharmacies[1].nom = '<b>GRAS</b>'
    const h = E.feuilles(D, null, { yann: false }); assert.doesNotMatch(h, /<img|<b>GRAS/)
  })
  test('apostrophes typographiques, pas de classe courte, pas d’effet interdit sous Safari', () => {
    const h = E.feuilles(etude(), sommesEssai, { yann: true }); assert.doesNotMatch(vide(h), /[a-zé]'[a-zé]/i)
    assert.ok(!/class="(?!pe-)[^"]*"/.test(h.replace(/class="pe-[^"]*"/g, '')), 'classe sans préfixe pe-')
    assert.doesNotMatch(srcCss + src, /backdrop-filter|filter:\s*blur|background-clip:\s*text|-webkit-background-clip/)
    assert.doesNotMatch(srcCss, /font-size:(?:[0-9]|1[0-2])(?:\.\d+)?px/)
  })
  test('impression : A4, la barre et la feuille interne exclues, le reste de l’app masqué', () => {
    assert.match(srcCss, /@page\{size:A4;margin:0\}/); assert.match(srcCss, /body\.pe-ouvert>\*:not\(#pe\)\{display:none!important\}/); assert.match(srcCss, /#pe \.pe-barre,#pe \[data-interne\]/)
    assert.match(srcCss, /break-after:page/)
  })
  test('année partielle : lue dans la source, jamais écrite en dur', () => {
    const D = etude(); D.sources.sitadel.annee = '2025'
    const h = vide(E.feuilles(D, null, { yann: false })); assert.doesNotMatch(h, /s’arrêtent à/); assert.doesNotMatch(h, /\* janvier/)
    assert.match(vide(E.feuilles(etude(), null, { yann: false })), /En 2026, les chiffres s’arrêtent à septembre/)
  })
  test('clés CSS, ids : préfixe pe- seul', () => {
    const noms = [...srcCss.matchAll(/(?:^|[ ,{>])\.([a-z][a-z0-9-]*)/gm)].map(m => m[1]).filter(n => !/^leaflet|^(ico)$/.test(n))
    assert.ok(noms.every(n => n.startsWith('pe-')), noms.filter(n => !n.startsWith('pe-')).join(','))
  })
})

describe('branchement dans l’app', () => {
  test('index.html charge le pur avant l’écran, avant phirst-officines.js, avec le jeton du jour', () => {
    const i = (n) => srcIdx.indexOf(n)
    assert.ok(i('phirst-etude-pur.js') > 0 && i('phirst-etude-pur.js') < i('phirst-etude.js') && i('phirst-etude.js') < i('phirst-officines.js'))
    assert.match(srcIdx, /phirst-etude\.css\?v=(\w+)/)
    const jetons = new Set([...srcIdx.matchAll(/phirst-(?:etude|officines)[a-z-]*\.(?:js|css)\?v=(\w+)/g)].map(m => m[1])); assert.equal(jetons.size, 1)
  })
  test('le bouton ne paraît que si une étude existe (ou si la vérification a échoué) et Leaflet n’est chargé qu’une fois', () => {
    assert.match(srcOff, /F\.etude === 'oui' \|\| F\.etude === 'erreur'/); assert.match(srcOff, /window\.PHIRST_LEAFLET = chargerLeaflet/)
    assert.ok(!/leaflet\.js/.test(src), 'phirst-etude.js ne charge pas Leaflet lui-même')
  })
  test('une lecture qui échoue n’est jamais « pas d’étude »', () => {
    assert.match(src, /return manque\(r\.error\) \? 'non' : 'erreur'/); assert.match(src, /function \(\) \{ return 'erreur'; \}/)
    assert.match(src, /n’a pas pu être lue/); assert.match(src, /data-pe-reessayer/)
  })
})

const reel = os.homedir() + '/PHIRST/finalisation-2026-11-22/ZC-etude-zone-code/donnees/etudes/140010489.json'
describe('étude réelle du Long Cours (seulement si le fichier existe sur ce Mac)', { skip: !fs.existsSync(reel) }, () => {
  test('rendu propre, 0 « € » côté téléprospectrice', () => {
    const j = JSON.parse(fs.readFileSync(reel, 'utf8'))
    const t = E.feuilles(j.donnees, null, { yann: false }), y = E.feuilles(j.donnees, j.sommes, { yann: true })
    assert.equal(euro(t), 0); assert.ok(euro(y) > 0); assert.ok(!sale(t) && !sale(y))
  })
})
