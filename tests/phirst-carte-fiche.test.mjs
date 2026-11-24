// La carte de Phirst (24/11/2026) : fiche « posée sur la carte » (maquette v2 choisie par Will) et couche « Clients Intégral » (Yann seul).
// Logique pure de phirst/v2/phirst-pur.js + gardes lues dans phirst/v2/phirst-officines.js (la bulle Leaflet a disparu, la télépro ne lit jamais phirst_integral).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const P = createRequire(import.meta.url)('../phirst/v2/phirst-pur.js')
const SRC = fs.readFileSync(new URL('../phirst/v2/phirst-officines.js', import.meta.url), 'utf8')

const annuaire = { cle: 'toutes:a', angle: 'toutes', nom: 'PHARMACIE DU DONJON', nom_affiche: 'Pharmacie du Donjon', ville: 'Angers', cp: '49000', lat: 47.47, lon: -0.55,
  telephone: '02 41 00 00 01', email: 'donjon@exemple.fr', pharmacien: 'Mme Dupont', groupements: ['Giropharm'], sieges: [], etiquettes: [{ texte: '42 pts' }], pourquoi: [],
  cles: ['pharmacie du donjon|angers'], dans_secteur: true }
const robot = { cle: 'robots:a', angle: 'robots', nom: 'Pharmacie du Donjon', ville: 'Angers', lat: 47.4701, lon: -0.5501, telephone: null, fab: 'BD Rowa', robot_modele: 'Vmax',
  robot_date: '2019-05-02', groupements: ['Giropharm', 'Ma Pharmacie'], sieges: ['Siège Giropharm — 01 00 00 00 00'], etiquettes: [{ texte: 'BD Rowa', ton: 'robot' }, { texte: '60 pts' }],
  pourquoi: ['Robot de 7 ans'], cles: ['pharmacie du donjon|angers'], dans_secteur: true }
const signal = { cle: 'signaux:a', angle: 'signaux', nom: 'Pharmacie du Donjon', ville: 'Angers', lat: 47.47, lon: -0.55, telephone: '+33 2 41 00 00 01', etiquettes: [{ texte: '3 EHPAD' }],
  pourquoi: ['Cession récente', 'Robot de 7 ans'], f_cession: true, f_pmr: true, n_ehpad: 3, ehpad_proches: ['Ehpad Les Tilleuls'], cles: ['pharmacie du donjon|angers'], dans_secteur: true }

describe('même pharmacie : les lignes de tous les angles, sans jamais mêler deux officines', () => {
  test('une clé nom|ville en commun suffit ; la ligne cliquée vient en premier, sans doublon', () => {
    const r = P.memePharmacie(annuaire, [annuaire, robot, signal])
    assert.deepEqual(r.map((x) => x.cle), ['toutes:a', 'robots:a', 'signaux:a'])
  })
  test('homonyme dans la même ville : téléphone différent → écartée', () => {
    const autre = { ...signal, cle: 'signaux:b', telephone: '02 41 99 99 99' }
    assert.deepEqual(P.memePharmacie(annuaire, [autre]).map((x) => x.cle), ['toutes:a'])
  })
  test('même clé mais à plus de 2 km → écartée ; sans clé commune → écartée', () => {
    assert.equal(P.memePharmacie(annuaire, [{ ...robot, cle: 'robots:loin', lat: 47.6 }]).length, 1)
    assert.equal(P.memePharmacie(annuaire, [{ ...robot, cle: 'robots:x', cles: ['autre|angers'] }]).length, 1)
  })
  test('téléphones comparés sur les 9 derniers chiffres (+33, espaces)', () => {
    assert.equal(P.tel9('+33 2 41 00 00 01'), P.tel9('02.41.00.00.01'))
    assert.equal(P.tel9('12 34'), '')
  })
})

describe('la fiche réunit tout ce qu’a la pharmacie', () => {
  const f = P.ficheDeLignes([annuaire, robot, signal])
  test('valeurs dans l’ordre robots > transferts > EHPAD > signaux > annuaire ; nom montré d’abord', () => {
    assert.equal(f.nom, 'Pharmacie du Donjon')
    assert.equal(f.fab, 'BD Rowa'); assert.equal(f.robot_date, '2019-05-02')
    assert.equal(f.telephone, '+33 2 41 00 00 01') // signaux passe avant l'annuaire
    assert.deepEqual(f.angles, ['robots', 'signaux', 'toutes'])
  })
  test('listes réunies sans doublon ; un seul « N pts » (le plus grand) et un seul « N EHPAD »', () => {
    assert.deepEqual(f.groupements, ['Giropharm', 'Ma Pharmacie'])
    assert.deepEqual(f.pourquoi, ['Robot de 7 ans', 'Cession récente'])
    assert.deepEqual(f.etiquettes.map((e) => e.texte), ['BD Rowa', '60 pts', '3 EHPAD'])
    assert.equal(f.n_ehpad, 3); assert.deepEqual(f.ehpad_proches, ['Ehpad Les Tilleuls'])
    assert.equal(f.f_cession, true); assert.equal(f.f_sans_robot, false); assert.equal(f.dans_secteur, true)
  })
  test('« Ajouter aux officines à appeler » part de la ligne la plus parlante, avec toutes les clés', () => {
    const p = P.pisteDeLigne(f.piste)
    assert.equal(p.source, 'robot'); assert.deepEqual(p.cles, ['pharmacie du donjon|angers'])
    assert.deepEqual(f.lignes, ['robots:a', 'signaux:a', 'toutes:a'])
  })
  test('une seule ligne : la fiche se fait quand même (ouverture immédiate, avant la lecture en base)', () => {
    const g = P.ficheDeLignes([annuaire])
    assert.equal(g.nom, 'Pharmacie du Donjon'); assert.equal(g.piste.cle, 'toutes:a')
  })
})

describe('bloc « Cliente d’Intégral Pharma » : commercial + téléphone et mail PRO, rien d’autre', () => {
  test('officine non reliée → rien (pas de « pas cliente »)', () => {
    assert.equal(P.blocIntegral([]), null); assert.equal(P.blocIntegral(null), null)
  })
  test('commercial connu : nom, téléphone mis en forme, lien tel:, mail', () => {
    const b = P.blocIntegral([{ cle: 'x', commercial: 'Salomé Rivière', tel: '0600000001', mail: 's.riviere@exemple.fr' }])
    assert.deepEqual(b, { commercial: 'Salomé Rivière', tel: '06 00 00 00 01', telHref: 'tel:0600000001', mail: 's.riviere@exemple.fr' })
  })
  test('numéro manquant (« à compléter ») et mail douteux → vides, jamais inventés', () => {
    const b = P.blocIntegral([{ cle: 'x', commercial: 'Théo Lambert', tel: null, mail: 'pas un mail' }])
    assert.equal(b.tel, ''); assert.equal(b.telHref, ''); assert.equal(b.mail, ''); assert.equal(b.commercial, 'Théo Lambert')
  })
  test('plusieurs lignes : celle qui a un commercial l’emporte ; aucune → cliente sans commercial', () => {
    assert.equal(P.blocIntegral([{ cle: 'a', commercial: null }, { cle: 'b', commercial: 'Hugo B.', tel: '07 00 00 00 02' }]).commercial, 'Hugo B.')
    assert.equal(P.blocIntegral([{ cle: 'a', commercial: null }]).commercial, '')
  })
})

describe('couche « Clients Intégral » : Yann seul', () => {
  test('la téléprospectrice n’a pas la couche ; Yann l’a en dernière puce', () => {
    assert.equal(P.ordreCouches(false).includes('integral'), false)
    assert.equal(P.ordreCouches(true).at(-1), 'integral')
  })
  test('cherchée sur l’annuaire (une ligne par pharmacie), jointe à phirst_integral', () => {
    assert.deepEqual(P.filtresIntegral('only'), [['eq', 'angle', 'toutes'], ['eq', 'dans_secteur', true]])
    assert.deepEqual(P.filtresIntegral('france'), [['eq', 'angle', 'toutes']])
    assert.equal(P.SELECT_INTEGRAL, ',phirst_integral!inner(cle)')
  })
})

describe('l’écran (lecture du code de phirst-officines.js)', () => {
  test('plus aucune bulle sur les points des couches : seules les épingles des pistes en gardent une', () => {
    assert.equal((SRC.match(/bindPopup\(/g) || []).length, 1)
    assert.match(SRC, /tracerPistes\(\) \{[\s\S]*?bindPopup\(/)
    assert.doesNotMatch(SRC, /data-ajout-carte/)
  })
  test('les épingles ne sont plus redessinées à chaque déplacement de la carte', () => {
    assert.match(SRC, /if \(M\.on\.fiches\) \{ if \(!M\.pistesDessinees\) tracerPistes\(\); \}/)
  })
  test('phirst_integral n’est lu que derrière M.yann (jamais pour la téléprospectrice)', () => {
    const i = SRC.indexOf("from('phirst_integral')")
    assert.ok(i > 0)
    assert.equal(SRC.indexOf("from('phirst_integral')", i + 1), -1, 'une seule lecture de phirst_integral')
    assert.match(SRC.slice(i - 200, i), /if \(!M\.yann\) return null;/)
    assert.match(SRC, /M\.yann = r\[1\] === false;/)
  })
  test('la fiche vit hors de la carte et se ferme par Échap, la croix ou un autre point', () => {
    assert.match(SRC, /id="po-fiche-hote"/)
    assert.match(SRC, /ev\.key === 'Escape'/)
    assert.match(SRC, /data-fiche-fermer/)
    assert.match(SRC, /M\.map\.on\('click', function \(e\) \{ var l = plusProche\(e\.containerPoint\); if \(l\) ouvrirFiche\(l\); \}\)/)
  })
  test('les points ne captent plus le clic eux-mêmes : on ouvre le plus proche (20 px, 28 au doigt)', () => {
    assert.doesNotMatch(SRC, /fillOpacity: 1 \}\)\.on\('click'/)
    assert.match(SRC, /pointer:coarse\)'\)\.matches \? 28 : 20/)
  })
  test('le premier clic donne le focus à la carte SANS faire défiler la page (sinon il tombe à côté du point)', () => {
    assert.match(SRC, /kb\.disable\(\); kb\._onMouseDown = function \(\) \{ if \(!this\._focused\) this\._map\.getContainer\(\)\.focus\(\{ preventScroll: true \}\); \}; kb\.enable\(\);/)
  })
  test('téléphone : la feuille est posée dans la page, hors de l’écran animé, et part quand on quitte la carte', () => {
    assert.match(SRC, /h\.id = 'po-fiche-tel'/)
    assert.match(SRC, /window\.addEventListener\('hashchange', quitterCarte\)/)
  })
})
