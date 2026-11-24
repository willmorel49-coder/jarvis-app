// Écrans Officines et Carte de Phirst (phirst/v2/phirst-pur.js) : filtres, anti-doublon, notes d'ajout, retrait des sommes, seuils de zoom.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
const P = createRequire(import.meta.url)('../phirst/v2/phirst-pur.js')

describe('requête de la liste (filtres posés sur la table)', () => {
  test('secteur par défaut : angle + dans_secteur', () => {
    assert.deepEqual(P.requeteOfficines({ angle: 'robots' }), [['eq', 'angle', 'robots'], ['eq', 'dans_secteur', true]])
  })
  test('toute la France : pas de filtre de secteur ; angle inconnu = toutes', () => {
    assert.deepEqual(P.requeteOfficines({ angle: 'nimporte', france: true }), [['eq', 'angle', 'toutes']])
  })
  test('recherche sans accent ni majuscule, signes dangereux retirés ; département en tête de code', () => {
    const f = P.requeteOfficines({ angle: 'toutes', france: true, q: '  Épinal, (Vosges) *%  ', dep: ' 4 4' })
    assert.deepEqual(f, [['eq', 'angle', 'toutes'], ['ilike', 'recherche', '*epinal vosges*'], ['like', 'dep', '44*']])
    assert.equal(P.recherchePropre('"a_b"'), 'a b')
  })
  test('sous-filtres : fabricant, Omnicell, type de transfert, faits d’un signal', () => {
    assert.deepEqual(P.requeteOfficines({ angle: 'robots', france: true, fab: 'omnicell' }).pop(), ['eq', 'cat', 'omnicell'])
    assert.deepEqual(P.requeteOfficines({ angle: 'robots', france: true, fab: 'BD Rowa' }).pop(), ['eq', 'fab', 'BD Rowa'])
    assert.deepEqual(P.requeteOfficines({ angle: 'transferts', france: true, fab: 'Cession' }).pop(), ['eq', 'tt_type', 'Cession'])
    assert.deepEqual(P.requeteOfficines({ angle: 'signaux', france: true, fab: 'sansRobot' }).pop(), ['eq', 'f_sans_robot', true])
    assert.equal(P.requeteOfficines({ angle: 'signaux', france: true, fab: 'inconnu' }).length, 1)
  })
  test('« Voir 30 de plus » et pluriel des résultats, comme la V1', () => {
    assert.equal(P.libelleVoirPlus(100, 10), 'Voir 30 de plus')
    assert.equal(P.libelleVoirPlus(25, 10), 'Voir les 15 de plus')
    assert.equal(P.libelleVoirPlus(11, 10), 'Voir 1 de plus')
    assert.equal(P.libelleVoirPlus(10, 10), null)
    assert.equal(P.libelleResultats(1), '1 résultat')
    assert.equal(P.libelleResultats(0), '0 résultat')
    assert.match(P.libelleResultats(2543), /^2\s?543 résultats$/)
  })
})

describe('anti-doublon avec le pipeline', () => {
  const ix = P.indexPistes([{ id: 'a1', nom: 'Pharmacie Édith', ville: 'Saint-Malo' }, { id: 'a2', nom: 'X', ville: null }])
  test('clé nom + ville sans accent ni casse', () => {
    assert.equal(P.ficheSuivie({ nom: 'PHARMACIE EDITH', ville: 'saint-malo', cles: [] }, ix), 'a1')
    assert.equal(P.ficheSuivie({ nom: 'Autre', ville: 'Nantes' }, ix), null)
  })
  test('une officine à deux fiches est suivie si l’une des deux l’est', () => {
    assert.equal(P.ficheSuivie({ nom: 'Z', ville: 'Y', cles: ['z|y', 'pharmacie edith|saint-malo'] }, ix), 'a1')
  })
})

describe('noms lisibles : l’anti-doublon reconnaît la piste créée avant (nom brut) comme après (nom lisible)', () => {
  const ligne = { nom: 'PHIE DES CONGRES', nom_affiche: 'Pharmacie des Congrès', ville: 'Nantes', cles: ['phie des congres|nantes', 'pharmacie des congres|nantes'], angle: 'toutes', groupements: [] }
  test('c’est le nom lisible qui est inséré dans les pistes, avec les clés de la ligne', () => {
    const p = P.pisteDeLigne(ligne)
    assert.equal(p.nom, 'Pharmacie des Congrès'); assert.deepEqual(p.cles, ligne.cles)
  })
  test('piste créée avant (nom brut, ville en capitales) : déjà suivie', () => {
    assert.equal(P.ficheSuivie(ligne, P.indexPistes([{ id: 'b1', nom: 'PHIE DES CONGRES', ville: 'NANTES' }])), 'b1')
  })
  test('piste créée après (nom lisible) : déjà suivie', () => {
    assert.equal(P.ficheSuivie(ligne, P.indexPistes([{ id: 'b2', nom: 'Pharmacie des Congrès', ville: 'Nantes' }])), 'b2')
  })
})

describe('retrait des sommes (la téléprospectrice n’en reçoit jamais)', () => {
  const ligne = { cle: 'k', angle: 'signaux', pourquoi: ['Cession publiée le 18/12/2024', '', 'Zone très porteuse — 4649 hab. par officine'], sieges: ['Siège Giropharm — 02 40 25 60 76'], robot_modele: null }
  test('la regex est la même que celle de la base', () => {
    for (const t of ['Budget 45 000 €', '45k€', 'devis 25000 HT', '€ 45', '12 000 euros', '8 000 TTC', 'revenu médian 24 170 € (2021)']) assert.equal(P.contientMontant(t), true, t)
    for (const t of ['Rappeler mardi 14h', '3 comptoirs', 'BD Rowa 2015', '5 km', '3 EHPAD à proximité', 'Automate Omnicell déjà installé', null]) assert.equal(P.contientMontant(t), false, String(t))
  })
  test('elle : la place vide (raison d’argent) saute, aucune somme ne reste, même si la base en laissait passer', () => {
    const sale = { ...ligne, pourquoi: ['Revenu médian 24 170 € (2021)', 'Bonne zone', ''], robot_modele: 'Automate (~50 000 €)', angle: 'robots', sous: '44 · Nantes · Apoteka — Automate (~50 000 €)' }
    const r = P.sansSommes(sale)
    assert.deepEqual(r.pourquoi, ['Bonne zone'])
    assert.equal(r.robot_modele, null)
    assert.equal(r.sous, '44 · Nantes · Apoteka')
    assert.equal(JSON.stringify(r).includes('€'), false)
    assert.deepEqual(P.pourquoiAffiche(P.sansSommes(ligne)), ['Cession publiée le 18/12/2024', 'Zone très porteuse — 4649 hab. par officine', 'Siège Giropharm — 02 40 25 60 76'])
  })
  test('membre : les sommes reviennent à leur rang et la sous-ligne du robot se refait', () => {
    const l = { ...ligne, pourquoi: ['A', '', 'C'] }
    assert.deepEqual(P.fusionnerSommes(l, { 'pourquoi:1': 'Revenu 24 000 €' }).pourquoi, ['A', 'Revenu 24 000 €', 'C'])
    const rob = P.fusionnerSommes({ angle: 'robots', dep: '44', ville: 'Nantes', fab: 'Apoteka', robot_modele: null }, { robot_modele: 'Automate (~50 000 €)' })
    assert.equal(P.sousAffiche(rob), '44 · Nantes · Apoteka — Automate (~50 000 €)')
  })
  test('sans somme connue, rien ne change (sommes absentes ou undefined)', () => {
    assert.deepEqual(P.fusionnerSommes(ligne, undefined).pourquoi, ligne.pourquoi)
  })
})

describe('ce qui est créé à l’ajout (source et note de la V1)', () => {
  test('robot : note avec Omnicell en détresse', () => {
    const s = P.sourceEtNote({ angle: 'robots', fab: 'Omnicell', robot_modele: 'XT', cat: 'omnicell' })
    assert.equal(s.source, 'robot'); assert.equal(s.note, 'Robot concurrent : Omnicell — XT (parc Omnicell en détresse — cible n°1 Riedl)')
  })
  test('transfert, EHPAD, signal', () => {
    assert.equal(P.sourceEtNote({ angle: 'transferts', tt_type: 'Cession', tt_date: '2025-03-04' }).note, 'Cession d’officine (BODACC, 04/03/2025) — prospect agencement')
    assert.equal(P.sourceEtNote({ angle: 'ehpad', n_ehpad: 5, ehpad_proches: ['A', 'B', 'C', 'D'] }).note, '5 EHPAD à proximité (A, B, C…) — prospect PDA / Farmadosis')
    const sg = P.sourceEtNote({ angle: 'signaux', pourquoi: ['a', 'b'] }); assert.equal(sg.source, 'signal'); assert.equal(sg.note, 'a · b')
  })
  test('toutes : transfert > robot > pda > annuaire', () => {
    assert.equal(P.sourceEtNote({ angle: 'toutes', tt_type: 'Création', tt_date: '2025-01-02', fab: 'X' }).source, 'transfert')
    assert.equal(P.sourceEtNote({ angle: 'toutes', fab: 'X', robot_modele: '' }).source, 'robot')
    assert.equal(P.sourceEtNote({ angle: 'toutes', n_ehpad: 2 }).source, 'pda')
    assert.deepEqual(P.sourceEtNote({ angle: 'toutes' }), { source: 'annuaire', note: undefined })
  })
  test('la fiche : champs de la V1, département jamais un code postal, EHPAD sans département', () => {
    const p = P.pisteDeLigne({ angle: 'toutes', nom: 'PHARMACIE A', ville: 'Nantes', cp: '44000', dep: '44000', pharmacien: 'M. B', telephone: '0240256076', groupements: ['Alliance', 'Giropharm'], lat: 47.2, lon: -1.5 })
    assert.equal(p.departement, '44'); assert.equal(p.groupement, 'Alliance et Giropharm'); assert.equal(p.source, 'annuaire'); assert.equal(p.pharmacien, 'M. B')
    assert.equal(P.pisteDeLigne({ angle: 'ehpad', nom: 'N', cp: '49000', dep: '49000', n_ehpad: 1 }).departement, '')
  })
})

describe('carte : seuils de zoom « Masquer et le dire »', () => {
  test('secteur : masqué sous 6 ; France : masqué sous 8', () => {
    assert.equal(P.couchesMasquees(5, 'only'), true); assert.equal(P.couchesMasquees(6, 'only'), false)
    assert.equal(P.couchesMasquees(7, 'france'), true); assert.equal(P.couchesMasquees(8, 'france'), false)
    assert.equal(P.couchesMasquees(NaN, 'only'), false)
  })
  test('phrases du bandeau', () => {
    assert.equal(P.phraseCachee([{ nom: 'robots', n: 285 }, { nom: 'EHPAD', n: 294 }, { nom: 'vide', n: 0 }]), '285 robots et 294 EHPAD cachés à cette échelle')
    assert.equal(P.phraseCachee([{ nom: 'robots', n: 0 }]), '')
    assert.equal(P.phraseVue([{ nom: 'robots', n: 3 }, { nom: 'transferts', n: 1 }, { nom: 'EHPAD', n: 2 }]), 'Dans cette vue : 3 robots, 1 transferts et 2 EHPAD')
    assert.equal(P.libelleBouton('only'), 'Zoomer sur mon secteur'); assert.equal(P.libelleBouton('france'), 'Zoomer pour tout voir')
  })
  test('singulier quand une couche a un seul point (« 1 robot », pas « 1 robots »), accord de « caché »', () => {
    const robots = (n) => ({ nom: 'robots', un: 'robot', n }), clientes = (n) => ({ nom: 'clientes d’Intégral', un: 'cliente d’Intégral', f: true, n })
    assert.equal(P.phraseVue([clientes(4), robots(1), { nom: 'transferts', un: 'transfert', n: 6 }, { nom: 'EHPAD', un: 'EHPAD', n: 2 }]),
      'Dans cette vue : 4 clientes d’Intégral, 1 robot, 6 transferts et 2 EHPAD')
    assert.equal(P.phraseVue([clientes(1)]), 'Dans cette vue : 1 cliente d’Intégral')
    assert.equal(P.phraseCachee([robots(1)]), '1 robot caché à cette échelle')
    assert.equal(P.phraseCachee([clientes(1)]), '1 cliente d’Intégral cachée à cette échelle')
    assert.equal(P.phraseCachee([clientes(229), { nom: 'officines', un: 'officine', f: true, n: 2214 }]), '229 clientes d’Intégral et ' + (2214).toLocaleString('fr-FR') + ' officines cachées à cette échelle')
    assert.equal(P.phraseCachee([clientes(229), robots(287)]), '229 clientes d’Intégral et 287 robots cachés à cette échelle')
  })
  test('l’écran Carte donne à chaque couche son singulier (et le féminin d’officines et de clientes)', () => {
    const src = fs.readFileSync(new URL('../phirst/v2/phirst-officines.js', import.meta.url), 'utf8')
    assert.match(src, /UN_COUCHE = \{ toutes: 'officine', robots: 'robot', ehpad: 'EHPAD', transferts: 'transfert', signaux: 'à saisir maintenant', integral: 'cliente d’Intégral' \}/)
    assert.equal((src.match(/compteCouche\(/g) || []).length, 3)
    assert.doesNotMatch(src, /\{ nom: NOMS_COUCHE\[[a-z.]+\], n: n \}/)
  })
})

describe('tournée du jour de la carte (port de lib/tourneeCarte.ts)', () => {
  const pt = (id, lat, lon, extra) => ({ id, nom: id, lat, lon, stage: 'a_rappeler', next_action_date: '2026-11-22', ...extra })
  test('ordre le plus court : un détour absurde est supprimé', () => {
    const o = P.ordreTournee([pt('A', 48, 0), pt('C', 48, 2), pt('B', 48, 1)])
    assert.match(o.map((x) => x.id).join(''), /^(ABC|CBA)$/)
    assert.ok(P.kmRoute(o) <= P.kmRoute([pt('A', 48, 0), pt('C', 48, 2), pt('B', 48, 1)]))
  })
  test('moins de 3 arrêts : ordre inchangé', () => {
    assert.deepEqual(P.ordreTournee([pt('B', 1, 1), pt('A', 2, 2)]).map((x) => x.id), ['B', 'A'])
  })
  test('ne garde que les actions dues, ni perdues ni signées ni archivées, avec adresse (lat/lon texte acceptés)', () => {
    const t = P.tourneeDuJour([
      pt('ok1', 47, -1), pt('ok2', '47.5', '-1.2', { next_action_date: '2026-11-20' }),
      pt('futur', 47, -1, { next_action_date: '2026-11-23' }), pt('perdu', 47, -1, { stage: 'perdu' }), pt('signe', 47, -1, { stage: 'signe' }),
      pt('arch', 47, -1, { stage: 'archive' }), pt('sansadr', null, null), pt('sansdate', 47, -1, { next_action_date: null })
    ], '2026-11-22')
    assert.deepEqual(t.map((x) => x.id).sort(), ['ok1', 'ok2'])
    assert.equal(typeof t[0].lat, 'number')
  })
  test('lien Google Maps : 10 points au plus, absent sous 2 arrêts', () => {
    assert.equal(P.lienTournee([pt('A', 1, 1)]), null)
    const l = P.lienTournee(Array.from({ length: 12 }, (_, i) => pt('S' + i, 47 + i / 100, -1)))
    assert.match(l, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&travelmode=driving&destination=47\.09,-1&waypoints=/)
    assert.equal(decodeURIComponent(l.split('waypoints=')[1]).split('|').length, 9)
  })
})

describe('date des données', () => {
  test('« Données relevées le … » seulement au-delà de 30 jours', () => {
    assert.equal(P.releveAffiche('2026-10-01T03:00:00Z', '2026-11-22'), 'Données relevées le 01/10/2026.')
    assert.equal(P.releveAffiche('2026-11-01T03:00:00Z', '2026-11-22'), '')
    assert.equal(P.releveAffiche(null, '2026-11-22'), '')
  })
})
