// La lettre publique de Phirst V2 (24/11/2026) : logique pure (phirst/v2/lettre/lettre-pur.js) et forme des notes (phirst/v2/phirst-lettre-contenu.js).
// Le dossier d'exemple de la maquette validée « 1 · La lettre » est transcrit ICI : aucune lecture de fichier hors du dépôt (la CI en dépend).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const L = req('../phirst/v2/phirst-lettre-contenu.js')
const P = req('../phirst/v2/lettre/lettre-pur.js')

const AUJ = '2026-11-23'
const MARQUE = { marque: 'Phirst', interlocuteur: 'Yann Morel', mail: 'yann.morel@phirst.fr', tel: '07 56 99 19 11' }
const e = (cle, prevue, faite) => ({ cle, prevue: prevue || null, faite: faite || null })
/* le dossier d'exemple de la maquette (dossier.js) : mêmes étapes, mêmes mois visés */
const TRANSFERT = { sorte: 'transfert', etat: 'cours', details: {}, etapes: [
  e('rdv', null, '2026-11-18'), e('local', '2026-12-10'), e('plans', '2027-01-15'), e('demande', '2027-02-10'), e('reponse', '2027-06-10'),
  e('contest', '2027-07-10'), e('agenc', '2027-07-20'), e('travaux', '2027-10-05'), e('demenage', '2027-11-20')] }
const AGENCEMENT = { sorte: 'agencement', etat: 'cours', details: {}, etapes: [
  e('rdv', null, '2026-11-18'), e('releve', '2026-12-02'), e('ambiance', '2027-01-20'), e('plan3d', '2027-02-18'), e('devis', '2027-03-10'),
  e('bon', '2027-07-01'), e('mobilier', '2027-09-15'), e('travaux', '2027-10-05'), e('reception', '2027-11-25')] }
const CONTENU = {
  rdv: '2026-11-18',
  mot: 'Merci pour votre accueil mercredi. Voici ce que j’ai retenu de notre visite.',
  vu: [
    { zone: 'file', t: 'La file d’attente remonte jusqu’à la porte', d: 'Samedi matin, six personnes attendaient.' },
    { zone: 'para', t: 'La parapharmacie est cachée au fond', d: 'On ne voit que le comptoir.' },
    { zone: 'reserve', t: 'La réserve déborde dans le couloir', d: 'Les cartons attendent dans le passage.' },
    { zone: 'confid', t: 'Aucun endroit pour parler tranquillement', d: 'À portée d’oreille de la file.' }],
  propose: [
    { zone: 'entree', t: 'L’entrée face au parking', d: 'On vous voit depuis la voiture.' },
    { zone: 'comptoir', t: 'Cinq postes au comptoir, au fond', d: 'La file se forme à l’intérieur.' },
    { zone: 'para', t: 'La parapharmacie en vitrine', d: 'Les rayons passent devant.' },
    { zone: 'confid', t: 'Un espace pour parler', d: 'Une pièce fermée.' },
    { zone: 'reserve', t: 'Une réserve derrière le comptoir', d: 'Pensée pour un robot.' }],
  surfaces: { aujourdhui: 140, demain: 210 }, postes: { aujourdhui: 3, demain: 5 }, entree: { aujourdhui: 'Rue', demain: 'Parking' },
  suite: { t: 'Le relevé du nouveau local', quand: '2026-12-02T09:00', d: 'Je viens prendre les mesures. Comptez une heure.' }
}
const REP = (over) => ({ marque: MARQUE, lettre: Object.assign({ pharmacie: 'Pharmacie de la Châtaigneraie', ville: 'Lanester', contenu: CONTENU, maj: '2026-11-22T10:00:00Z', volets: [TRANSFERT, AGENCEMENT] }, over || {}) })
const M = (over, auj) => P.modele(REP(over), auj || AUJ)
/* le texte visible d'un morceau de HTML (balises retirées, entités défaites) */
const texte = (h) => h.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ')
const pt = (m, voie) => m.voies[voie].cases.map(c => c.points.map(p => p.c))

describe('la page calculée = la maquette', () => {
  const m = M()
  test('le haut de page', () => {
    assert.equal(m.rdvLisible, 'mercredi 18 novembre')
    assert.equal(m.ville + ' · ' + m.ligneVolets, 'Lanester · Transfert et agencement')
    assert.equal(m.ouverture, 'Novembre 2027')
    assert.equal(m.titre, 'Pharmacie de la Châtaigneraie · préparée par Yann Morel')
    assert.equal(m.pied, 'Page préparée pour la Pharmacie de la Châtaigneraie · Phirst')
  })
  test('le calendrier : 13 mois de nov. 26 à nov. 27, « Vous êtes ici » sur le mois courant', () => {
    assert.deepEqual(m.mois.map(x => x.court + (x.an ? ' ' + x.aa : '')),
      ['nov. 26', 'déc.', 'janv. 27', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.'])
    assert.deepEqual(m.mois.map(x => x.now), [true, ...Array(12).fill(false)])
  })
  test('les étapes par mois : « Agencement » pas répétée dans Transfert, 2 au plus par case', () => {
    assert.deepEqual(pt(m, 0), [['1er rendez-vous'], ['Nouveau local'], ['Plans'], ['Demande à l’ARS'], [], [], [], ['Réponse de l’ARS'], ['Contestation possible'], [], [], ['Travaux'], ['Ouverture']])
    assert.deepEqual(pt(m, 1), [['1er rendez-vous'], ['Relevé'], ['Ambiance'], ['Plan et 3D'], ['Devis'], [], [], [], ['Bon pour accord'], [], ['Mobilier'], ['Travaux'], ['Réception']])
    assert.equal(m.voies[0].cases[0].points[0].f, true)
    assert.equal(m.voies[0].cases[1].points[0].f, false)
    m.voies.forEach(v => v.cases.forEach(c => assert.ok(c.points.length <= 2)))
  })
  test('textes du calendrier et des plans', () => {
    assert.equal(m.texteVolets, 'Deux volets qui avancent ensemble : le transfert (le nouveau local, l’accord de l’ARS) et l’agencement (le plan, le mobilier, les travaux).')
    assert.equal(m.piedCal, 'Le 1er rendez-vous est fait. Prochaine étape : le relevé du nouveau local, mercredi 2 décembre, 9 h.')
    assert.equal(m.petitCal, 'Dates visées, à caler ensemble. La réponse de l’ARS fixe le reste.')
    assert.equal(m.introVu, 'Quatre choses, notées pendant la visite. Chacune est entourée sur le plan de votre officine d’aujourd’hui (140 m²).')
    assert.deepEqual(m.plan.aujourdhui, { surface: '140 m²', comptoir: 'Comptoir · 3 postes', entree: 'Rue — l’entrée' })
    assert.deepEqual(m.plan.demain, { surface: '210 m²', comptoir: 'Comptoir · 5 postes', entree: 'Parking — l’entrée' })
  })
  test('la suite et les motifs du panneau', () => {
    assert.equal(m.suite.titre, 'Le relevé du nouveau local')
    assert.equal(m.suite.quand, 'Mercredi 2 décembre, 9 h')
    assert.deepEqual(m.suite.motifs, ['Je confirme le relevé du nouveau local du mercredi 2 décembre', 'Je préfère une autre date', 'J’ai une question avant'])
    assert.equal(m.ideeDefaut, 1)
  })
  test('chapitres numérotés 01 à 05 ; le HTML contient les textes de la maquette', () => {
    assert.deepEqual(m.chapitres.map(c => c.num), ['01', '02', '03', '04', '05'])
    const t = texte(P.pageHtml(m)).replace(/ /g, ' ')
    for (const s of ['Après notre rendez-vous du mercredi 18 novembre', 'Ouverture visée Novembre 2027', 'Vous êtes ici', 'Ça me va', 'Une autre date', 'Constat 4', 'Ce que j’ai déjà fait',
      'Page préparée pour la Pharmacie de la Châtaigneraie']) assert.ok(t.includes(s), s)
  })
})

describe('chapitres absents : masqués, numéros resserrés', () => {
  test('sans constat : 01 = propositions', () => {
    const m = M({ contenu: { ...CONTENU, vu: [] } })
    assert.deepEqual(m.chapitres.map(c => c.cle + ':' + c.num), ['propose:01', 'calendrier:02', 'realisations:03', 'suite:04'])
    const h = P.pageHtml(m)
    assert.ok(!h.includes('Ce que j’ai vu chez vous'))
    assert.ok(h.includes('<span class="ch-n">01</span>') && h.includes('04 · La suite') || h.includes('04 · La suite'))
    assert.equal((h.match(/data-vers=/g) || []).length, 4)
  })
  test('sans idée : plus de plan ni de liste, mais la 3D reste', () => {
    const h = P.pageHtml(M({ contenu: { ...CONTENU, propose: [] } }))
    assert.ok(!h.includes('id="plan-d"') && !h.includes('class="idees')); assert.ok(h.includes('data-v3d'))
  })
  test('sans volet : pas de calendrier, 04 La suite', () => {
    const m = M({ volets: [] })
    assert.deepEqual(m.chapitres.map(c => c.cle), ['vu', 'propose', 'realisations', 'suite'])
    const h = P.pageHtml(m)
    assert.ok(!h.includes('id="regle"') && !h.includes('Ouverture visée'))
    assert.equal(m.rdvLisible, 'mercredi 18 novembre')
    assert.ok(texte(h).includes('Lanester') && !h.includes('Transfert et'))
  })
  test('volet « perdu » écarté, un seul volet : phrase juste', () => {
    const m = M({ volets: [TRANSFERT, { ...AGENCEMENT, etat: 'perdu' }] })
    assert.equal(m.voies.length, 1)
    assert.equal(m.ligneVolets, 'Transfert')
    assert.equal(m.texteVolets, 'Un volet, suivi pas à pas : le transfert (le nouveau local, l’accord de l’ARS).')
    assert.equal(m.mois.length, 13)
  })
  test('trois volets : phrase générique', () => {
    const riedl = { sorte: 'riedl', etat: 'cours', details: {}, etapes: [e('rdv', null, '2026-11-20'), e('suivi', '2028-01-10')] }
    const m = M({ volets: [riedl, AGENCEMENT, TRANSFERT] })
    assert.equal(m.ligneVolets, 'Transfert, agencement et robotique Riedl')
    assert.equal(m.texteVolets, 'Trois volets qui avancent ensemble, chacun avec ses dates : transfert, agencement et robotique Riedl.')
    assert.equal(m.ouverture, 'Janvier 2028')
    assert.ok(P.pageHtml(m).includes('--nv:3'))
  })
})

describe('contenu vide ou abîmé : rien de faux affiché', () => {
  const abime = [null, undefined, 'texte', 42, [], {}, { vu: 'x', propose: {}, surfaces: 'a', suite: 7, rdv: 'hier', entree: [] },
    { vu: [{ zone: 'inconnue', t: 'x' }, null, { zone: 'file', t: '   ' }], surfaces: { aujourdhui: 'abc', demain: -5 }, postes: { aujourdhui: 0, demain: 99 }, suite: { quand: '2026-13-45T25:99', d: 'orphelin' } }]
  for (const c of abime) test('contenu ' + JSON.stringify(c), () => {
    const m = M({ contenu: c })
    const h = P.pageHtml(m), t = texte(h)
    assert.ok(!/undefined|null|NaN|\[object/.test(h))
    assert.equal(m.rdvLisible, 'mercredi 18 novembre')   // retombe sur l'étape « 1er rendez-vous » faite
    assert.ok(!h.includes('class="mot"'))
    assert.ok(!h.includes('class="pl-cote"') && !t.includes('m²'))
    assert.equal(m.suite.avec, false)
    assert.ok(t.includes('On en parle') && t.includes('Être rappelé') && !t.includes('Ça me va'))
    assert.equal(m.plan.aujourdhui.comptoir, 'Comptoir'); assert.equal(m.plan.demain.entree, 'L’entrée')
    assert.ok(!h.includes('class="vus"'))
  })
  test('suite sans suite.t : phrase avec le prénom, motifs courts', () => {
    const m = M({ contenu: {} })
    assert.equal(m.suite.detail, 'Un mot, et Yann vous rappelle.')
    assert.deepEqual(m.suite.motifs, ['Je veux avancer', 'J’ai une question avant'])
  })
  test('suite sans date : pastille masquée mais « Une autre date » reste', () => {
    const m = M({ contenu: { ...CONTENU, suite: { t: 'Un appel', quand: '', d: '' } } })
    const h = P.pageHtml(m)
    assert.ok(!h.includes('class="quand"')); assert.ok(h.includes('Une autre date'))
    assert.equal(m.suite.motifs[0], 'Je confirme un appel'); assert.equal(m.piedCal, 'Le 1er rendez-vous est fait. Prochaine étape : un appel.')
  })
  test('aucune date nulle part : « À caler ensemble », pas de rendez-vous', () => {
    const v = { sorte: 'transfert', etat: 'cours', details: {}, etapes: [] }
    const m = M({ contenu: {}, volets: [v] })
    assert.equal(m.ouverture, ''); assert.equal(m.rdvLisible, '')
    const h = P.pageHtml(m)
    assert.ok(h.includes('À caler ensemble') && !h.includes('Après notre rendez-vous'))
    m.voies[0].cases.forEach(c => assert.deepEqual(c.points, []))
  })
  test('lettre absente / réponse vide : le modèle ne plante pas', () => {
    assert.doesNotThrow(() => P.pageHtml(P.modele({ marque: null, lettre: null }, AUJ)))
    assert.doesNotThrow(() => P.pageHtml(P.modele(null, AUJ)))
  })
})

describe('étapes et dates', () => {
  test('étape sans date : absente ; faite avant prévue ; hors des 13 mois : absente', () => {
    const v = { sorte: 'agencement', etat: 'cours', details: {}, etapes: [e('rdv', '2026-12-05', '2026-11-02'), e('releve'), e('devis', '2030-01-01')] }
    const m = M({ volets: [v] })
    assert.deepEqual(pt(m, 0)[0], ['1er rendez-vous']); assert.equal(m.voies[0].cases.flatMap(c => c.points).length, 1)
    assert.equal(m.mois[0].ym, '2026-11')
  })
  test('départ : 1re étape faite des 3 derniers mois, sinon le mois courant', () => {
    const f = (d) => M({ volets: [{ sorte: 'transfert', etat: 'cours', details: {}, etapes: [e('rdv', null, d)] }] }, '2026-11-23')
    assert.equal(f('2026-09-10').mois[0].ym, '2026-09')
    assert.equal(f('2026-08-10').mois[0].ym, '2026-08')
    assert.equal(f('2026-07-31').mois[0].ym, '2026-11')   // trop ancien
    assert.equal(f('2027-01-05').mois[0].ym, '2026-11')   // dans le futur
    const m = f('2026-09-10'); assert.equal(m.mois.findIndex(x => x.now), 2)   // « Vous êtes ici » sur novembre, pas sur la 1re colonne
    assert.equal(m.mois.length, 13)
  })
  test('trois étapes le même mois : deux seulement dans la case, dans l\u2019ordre des étapes', () => {
    const v = { sorte: 'agencement', etat: 'cours', details: {}, etapes: [e('rdv', null, '2026-11-02'), e('releve', '2026-11-10'), e('ambiance', '2026-11-20')] }
    assert.deepEqual(pt(M({ volets: [v] }), 0)[0], ['1er rendez-vous', 'Relevé'])
  })
  test('surfaces absentes : ni cote ni « m² » sur les deux plans (constats et idées présents)', () => {
    const h = P.pageHtml(M({ contenu: { ...CONTENU, surfaces: {} } }))
    assert.ok(h.includes('class="plan"') && !h.includes('class="pl-cote"') && !h.includes('m²') && !h.includes('class="m2"'))
    assert.ok(texte(h).includes('votre officine d’aujourd’hui.'))
  })
  test('Remplacement : étape facultative « Démontage » (robot Riedl)', () => {
    const v = { sorte: 'riedl', etat: 'cours', details: { remplacement: 'oui' }, etapes: [e('demontage', '2026-12-03')] }
    assert.deepEqual(pt(M({ volets: [v] }), 0)[1], ['Démontage'])
  })
  test('rendez-vous : la date de Yann prime ; sinon la date faite ; année dite si autre', () => {
    assert.equal(M({ contenu: { rdv: '2026-11-17' } }).rdvLisible, 'mardi 17 novembre')
    assert.equal(M({ contenu: {} }).rdvLisible, 'mercredi 18 novembre')
    assert.equal(M({ contenu: { rdv: '2025-11-17' } }).rdvLisible, 'lundi 17 novembre 2025')
  })
  test('ouverture : le volet qui finit le plus tard', () => {
    assert.equal(M().ouverture, 'Novembre 2027')
    const a = { ...AGENCEMENT, etapes: [e('reception', '2028-02-01')] }
    assert.equal(M({ volets: [TRANSFERT, a] }).ouverture, 'Février 2028')
  })
})

describe('nombres, noms et pied', () => {
  test('nombre de constats en lettres', () => {
    const v = (n) => M({ contenu: { vu: CONTENU.vu.slice(0, n) } }).introVu
    assert.ok(v(1).startsWith('Une chose, notée pendant la visite. Elle est entourée'))
    assert.ok(v(2).startsWith('Deux choses')); assert.ok(v(3).startsWith('Trois choses'))
  })
  test('« la » seulement devant un nom qui commence par Pharmacie', () => {
    assert.equal(M({ pharmacie: 'Grande Pharmacie du Port' }).pied, 'Page préparée pour Grande Pharmacie du Port · Phirst')
    assert.equal(M({ pharmacie: 'Pharmacie du Port' }).pied, 'Page préparée pour la Pharmacie du Port · Phirst')
  })
  test('grand titre : petits mots collés, nom court sans ligne vide', () => {
    const h = P.pageHtml(M())
    assert.ok(h.includes('<span class="l"><span>Pharmacie de</span></span> <span class="l"><span>la Châtaigneraie</span></span>'))
    const court = P.pageHtml(M({ pharmacie: 'Pharmacie Dupont' }))
    assert.equal((court.match(/class="l"/g) || []).length, 1)
  })
  test('sans marque : aucun nom ni coordonnée inventés', () => {
    const m = P.modele({ marque: null, lettre: REP().lettre }, AUJ), h = P.pageHtml(m)
    assert.ok(!h.includes('Yann') && !h.includes('tel:') && !h.includes('mailto:'))
    assert.equal(m.titre, 'Pharmacie de la Châtaigneraie')
  })
  test('les coordonnées viennent de la réponse', () => {
    const h = P.pageHtml(P.modele({ marque: { ...MARQUE, tel: '06 11 22 33 44', mail: 'a@b.fr' }, lettre: REP().lettre }, AUJ))
    assert.ok(h.includes('href="tel:0611223344"') && h.includes('href="mailto:a@b.fr"') && !h.includes('07 56'))
  })
})

describe('typographie et HTML', () => {
  const h = P.pageHtml(M())
  test('aucun « : ; ! ? » · » précédé d’une espace simple dans le texte rendu', () => {
    const t = h.split(/(<[^>]*>)/).filter((p, i) => i % 2 === 0).join('')
    assert.ok(!/ [:;!?»·]/.test(t)); assert.ok(!/« /.test(t))
    assert.ok(t.includes(' · Transfert'))
    assert.ok(t.includes('Prochaine étape :'))
  })
  test('un attribut style="--p:50%" reste intact, et aucune insécable dans une balise', () => {
    assert.ok(h.includes('style="--p:50%"'))
    assert.ok(h.includes('style="--nv:2"'))
    for (const tag of h.match(/<[^>]*>/g)) assert.ok(!tag.includes(String.fromCharCode(160)) || /^<svg[^>]*aria-label/.test(tag), tag)   // seule exception : la surface « 140 m² » que m2() écrit déjà avec son insécable
  })
  test('typoHtml', () => {
    assert.equal(P.typoHtml('<b title="a : b">Oui : non ; « x » ?</b>'), '<b title="a : b">Oui : non ; « x » ?</b>')
  })
  test('échappement : un nom piégé ne casse pas la page', () => {
    const t = P.pageHtml(M({ pharmacie: 'Pharmacie <img src=x onerror=alert(1)> "A"' }))
    assert.ok(!t.includes('<img src=x') && t.includes('&lt;img'))
  })
  test('pas de coordonnée en dur : avec une autre marque, plus aucune trace de la première', () => {
    const faux = P.pageHtml(P.modele({ marque: { marque: 'Z', interlocuteur: 'Zoé Test', mail: 'z@z.fr', tel: '01 02 03 04 05' }, lettre: REP().lettre }, AUJ))
    assert.ok(!/Morel|07 56 99|phirst\.fr|github|willmorel/i.test(faux))
    assert.ok(!/Yann/.test(faux.replace('Témoignage à demander par Yann', '')))
  })
  test('plans : zone allumée, libellés', () => {
    assert.ok(h.includes('data-z="file" class="on"')); assert.ok(h.includes('data-z="comptoir" class="on"'))   // idée n°2 par défaut
    assert.ok(h.includes('Comptoir · 5 postes') && h.includes('Parking — l’entrée') && h.includes('>140 m²<'))
  })
  test('états hors cas normal', () => {
    const lien = texte(P.etatHtml('lien', MARQUE)), muet = texte(P.etatHtml('muet', MARQUE)), att = texte(P.etatHtml('chargement', null))
    assert.ok(lien.includes('Ce lien n’est plus valable.') && lien.includes('Yann Morel') && lien.includes('07 56 99 19 11') && lien.includes('yann.morel@phirst.fr'))
    assert.ok(P.etatHtml('lien', null).includes('contactez la personne') && !P.etatHtml('lien', null).includes('tel:'))
    assert.ok(muet.includes('La page met un peu de temps à répondre.') && muet.includes('Rechargez-la dans une minute.') && !muet.includes('plus valable'))
    assert.ok(!att.includes('plus valable') && !att.includes('temps à répondre'))
  })
})

describe('jeton, lecture et panneau', () => {
  test('jetonDe', () => {
    const ok = 'abcDEF_-0123456789abcdef'
    assert.equal(P.jetonDe('#' + ok), ok); assert.equal(P.jetonDe(ok), ok)
    for (const mauvais of ['', '#', '#court', '#' + 'a'.repeat(23), '#' + 'a'.repeat(65), '#abc def_-0123456789abcdef', '#' + ok + '?x=1', '#' + ok + '/', null, undefined])
      assert.equal(P.jetonDe(mauvais), '', String(mauvais))
    assert.equal(P.jetonDe('#' + 'a'.repeat(64)).length, 64)
  })
  test('decider : un contrôle raté ne dit jamais « lien mort »', () => {
    const j = 'a'.repeat(24)
    assert.equal(P.decider(j, { muet: true }).etat, 'muet')
    assert.equal(P.decider(j, { erreur: true }).etat, 'muet')
    assert.equal(P.decider(j, { data: null, error: { message: 'x' } }).etat, 'muet')
    assert.equal(P.decider(j, { data: { marque: MARQUE } }).etat, 'muet')   // pas de clé lettre : pas une réponse claire
    assert.equal(P.decider(j, { data: { marque: MARQUE, lettre: null } }).etat, 'lien')
    assert.equal(P.decider(j, { data: { marque: MARQUE, lettre: null } }).marque.tel, MARQUE.tel)
    assert.equal(P.decider('', { muet: true }).etat, 'lien')   // jeton mal formé : lien mort quoi que la base dise
    assert.equal(P.decider(j, { data: REP() }).etat, 'lettre')
  })
  test('lire : délai dépassé → muet ; échec → erreur ; jamais d’exception', async () => {
    assert.deepEqual(await P.lire(() => new Promise(() => {}), 30), { muet: true })
    assert.deepEqual(await P.lire(() => Promise.reject(new Error('x')), 30), { erreur: true })
    assert.deepEqual(await P.lire(() => { throw new Error('x') }, 30), { erreur: true })
    assert.deepEqual(await P.lire(() => Promise.resolve({ data: 1 }), 30), { data: 1 })
    assert.deepEqual(await P.lire(() => new Promise(r => setTimeout(() => r({ data: 1 }), 200)), 20), { muet: true })
  })
  test('classerDemande et messages', () => {
    assert.deepEqual(P.classerDemande({ data: { ok: true } }), { ok: true })
    for (const r of ['tel', 'lien', 'trop', 'champs']) assert.deepEqual(P.classerDemande({ data: { ok: false, raison: r } }), { ok: false, raison: r })
    for (const x of [{ muet: true }, { erreur: true }, { error: {} }, { data: null }, { data: { ok: false, raison: 'zzz' } }]) assert.equal(P.classerDemande(x).raison, 'reseau')
    assert.equal(P.messageDemande('lien', MARQUE), 'Ce lien n’est plus valable : appelez Yann au 07 56 99 19 11.')
    assert.equal(P.messageDemande('trop', MARQUE), 'Beaucoup de messages aujourd’hui : appelez directement Yann au 07 56 99 19 11.')
    assert.equal(P.messageDemande('reseau', MARQUE), 'Pas envoyé : la connexion a manqué. Réessayez, ou appelez directement.')
    assert.equal(P.messageDemande('tel', MARQUE), 'Écrivez un numéro à dix chiffres, pour que Yann vous rappelle.')
  })
  test('telValide : 10 à 15 chiffres, 30 caractères au plus', () => {
    assert.ok(P.telValide('06 12 34 56 78') && P.telValide('+33 6 12 34 56 78'))
    assert.ok(!P.telValide('06 12') && !P.telValide('') && !P.telValide('1'.repeat(16)) && !P.telValide('0 '.repeat(16)))
  })
  test('panneau et merci', () => {
    const m = M(), h = P.panneauHtml(m, m.suite.motifs[0]), t = texte(h)
    assert.ok(t.includes('On avance ensemble ?') && t.includes('Pharmacie de la Châtaigneraie · Lanester') && t.includes('Envoyer à Yann'))
    assert.ok(h.includes('aria-pressed="true">Je confirme le relevé') && h.includes('id="pf-statut"'))
    assert.ok(texte(P.merciHtml(m, 'Je préfère une autre date', '06 11 22 33 44')).includes('C’est envoyé à Yann. Je préfère une autre date. Yann vous rappelle au 06 11 22 33 44.'))
  })
})

describe('PHIRST_LETTRE : forme des notes', () => {
  test('normaliser écarte tout ce qui est mal formé', () => {
    const n = L.normaliser({ rdv: '2026-02-30', mot: ' a   b ', vu: [{ zone: 'x', t: 'z' }, { zone: 'file', t: 'ok', d: 5 }], surfaces: { aujourdhui: '140', demain: 9 }, postes: { aujourdhui: 3.5, demain: '5' }, suite: { t: 'T', quand: '2026-12-02T24:00' } })
    assert.equal(n.rdv, ''); assert.equal(n.mot, 'a b'); assert.deepEqual(n.vu, [{ zone: 'file', t: 'ok', d: '' }])
    assert.equal(n.surfaces.aujourdhui, 140); assert.equal(n.surfaces.demain, null); assert.equal(n.postes.aujourdhui, null); assert.equal(n.postes.demain, 5); assert.equal(n.suite.quand, '')
    assert.deepEqual(L.normaliser(null), L.vide()); assert.deepEqual(L.normaliser([]), L.vide())
  })
  test('normaliser plafonne', () => {
    const n = L.normaliser({ vu: Array(9).fill({ zone: 'file', t: 'a' }), propose: Array(9).fill({ zone: 'entree', t: 'a' }), mot: 'x'.repeat(999) })
    assert.equal(n.vu.length, 4); assert.equal(n.propose.length, 5); assert.equal(n.mot.length, 400)
  })
  test('jourLisible / quandLisible / m2', () => {
    assert.equal(L.jourLisible('2026-12-02', 2026), 'mercredi 2 décembre'); assert.equal(L.jourLisible('2026-12-01', 2026), 'mardi 1er décembre')
    assert.equal(L.jourLisible('2027-01-04', 2026), 'lundi 4 janvier 2027'); assert.equal(L.jourLisible('2026-02-30'), '')
    assert.equal(L.quandLisible('2026-12-02T09:00', 2026), 'mercredi 2 décembre, 9 h'); assert.equal(L.quandLisible('2026-12-02T09:05', 2026), 'mercredi 2 décembre, 9 h 05')
    assert.equal(L.quandLisible('2026-12-02T09:30', 2026), 'mercredi 2 décembre, 9 h 30'); assert.equal(L.quandLisible('2026-12-02', 2026), '')
    assert.equal(L.m2(140), '140 m²'); assert.equal(L.m2(1250), '1 250 m²'); assert.equal(L.m2(null), '')
  })
})
