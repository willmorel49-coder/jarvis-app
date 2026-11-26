// Agenda dans les deux sens (26/11/2026) : le calendrier de l'iPhone (fluxIcs) et l'agenda perso de Yann (phirst/v2/phirst-pur.js).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const P = createRequire(import.meta.url)('../phirst/v2/phirst-pur.js')

const ID1 = '11111111-1111-4111-8111-111111111111', ID2 = '22222222-2222-4222-8222-222222222222', ID3 = '33333333-3333-4333-8333-333333333333'
const YANN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', TELE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const F1 = 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', F2 = 'f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2'
const ligne = (id, rdv, quoi, extra, auteur = YANN, quand = '2026-11-20T10:00:00Z', fiche = F1) =>
  ({ id, prospect_id: fiche, author_id: auteur, created_at: quand, body: JSON.stringify(Object.assign({ v: 1, rdv, quoi }, extra || {})) })
const octets = (s) => Buffer.byteLength(s, 'utf8')
const lignesIcs = (t) => t.split('\r\n')
const deplier = (t) => t.replace(/\r\n /g, '')

describe('le lien de l’agenda perso', () => {
  test('webcal iCloud réel devient https', () => {
    const r = P.lienAgendaPropre('  webcal://p123-caldav.icloud.com/published/2/MTIzNDU2Nzg5MDEyMzQ1Nj-abc  ')
    assert.equal(r.lien, 'https://p123-caldav.icloud.com/published/2/MTIzNDU2Nzg5MDEyMzQ1Nj-abc')
    assert.equal(P.fournisseurAgenda(r.lien), 'iCloud')
  })
  test('Google (adresse secrète) et Outlook (calendrier publié) passent tels quels', () => {
    const g = 'https://calendar.google.com/calendar/ical/yann%40gmail.com/private-0123456789abcdef/basic.ics'
    const o = 'https://outlook.office365.com/owa/calendar/abc@phirst.fr/0a1b2c/calendar.ics'
    assert.equal(P.lienAgendaPropre(g).lien, g); assert.equal(P.fournisseurAgenda(g), 'Google')
    assert.equal(P.lienAgendaPropre(o).lien, o); assert.equal(P.fournisseurAgenda(o), 'Outlook')
    assert.equal(P.fournisseurAgenda('https://outlook.live.com/owa/calendar/x/calendar.ics'), 'Outlook')
    assert.equal(P.fournisseurAgenda('https://exemple.fr/agenda.ics'), '')
  })
  test('refusés : http, javascript, adresse IP, localhost, vide, trop long, espaces, identifiants', () => {
    for (const t of ['http://p123-caldav.icloud.com/x', 'javascript:alert(1)', 'https://192.168.1.1/x', 'https://localhost/x', '', null,
      'https://' + 'a'.repeat(1000) + '.fr', 'https://exemple.fr/a b', 'https://moi:secret@exemple.fr/x', 'https://[::1]/x', 'https://intranet/x']) {
      assert.equal(P.lienAgendaPropre(t).erreur, P.MSG_LIEN_AGENDA, String(t))
    }
    assert.equal(P.MSG_LIEN_AGENDA, 'Collez le lien complet : il commence par webcal:// ou https://.')
  })
})

describe('les heures prises dans l’agenda perso', () => {
  test('un événement de 3 jours donne 3 morceaux, le dernier finit à son heure', () => {
    const m = P.decouperParJour([{ debut: '2026-11-26T15:00', fin: '2026-11-28T10:30' }])
    assert.deepEqual(m, [
      { debut: '2026-11-26T15:00', fin: '2026-11-27T00:00', journee: false },
      { debut: '2026-11-27T00:00', fin: '2026-11-28T00:00', journee: true },
      { debut: '2026-11-28T00:00', fin: '2026-11-28T10:30', journee: false }
    ])
  })
  test('vides et illisibles retirés, doublons exacts retirés, triés', () => {
    const m = P.decouperParJour([{ debut: '2026-11-27T10:00', fin: '2026-11-27T11:00' }, { debut: '2026-11-26T09:00', fin: '2026-11-26T09:00' },
      { debut: 'demain', fin: '2026-11-27T11:00' }, { debut: '2026-11-27T10:00', fin: '2026-11-27T11:00' }, { debut: '2026-11-26T08:00', fin: '2026-11-26T08:30' }])
    assert.deepEqual(m.map((x) => x.debut), ['2026-11-26T08:00', '2026-11-27T10:00'])
  })
  test('au format des occupations, sans lieu', () => {
    assert.deepEqual(P.occupationsPerso([{ debut: '2026-11-27T10:00', fin: '2026-11-27T11:00' }]),
      [{ debut: '2026-11-27T10:00', fin: '2026-11-27T11:00', commune: null, lat: null, lon: null, perso: true }])
  })
  test('les créneaux proposés évitent l’agenda perso, y compris une plage commencée la veille', () => {
    const jour = '2026-11-27'   // un vendredi
    const libres = (perso) => P.creneauxLibres({ jour, occupations: P.occupationsPerso(perso), cible: null, maintenant: '2026-11-26T07:00' }).map((c) => c.debut.slice(11))
    assert.ok(libres([]).includes('09:00'))
    assert.ok(!libres([{ debut: '2026-11-27T09:00', fin: '2026-11-27T10:00' }]).includes('09:00'))
    assert.ok(!libres([{ debut: '2026-11-26T22:00', fin: '2026-11-27T10:00' }]).includes('09:00'))
    assert.deepEqual(libres([{ debut: '2026-11-27T00:00', fin: '2026-11-28T00:00', journee: true }]), [])
  })
  test('la journée affichée : plages réunies quand elles se touchent, journée entière reconnue', () => {
    const l = [{ debut: '2026-11-27T10:00', fin: '2026-11-27T11:00' }, { debut: '2026-11-27T11:00', fin: '2026-11-27T12:00' },
      { debut: '2026-11-27T10:30', fin: '2026-11-27T10:45' }, { debut: '2026-11-27T15:00', fin: '2026-11-27T16:00' }]
    assert.deepEqual(P.persoDuJour(l, '2026-11-27'), [{ debut: '2026-11-27T10:00', fin: '2026-11-27T12:00', journee: false }, { debut: '2026-11-27T15:00', fin: '2026-11-27T16:00', journee: false }])
    assert.deepEqual(P.persoDuJour([{ debut: '2026-11-27T00:00', fin: '2026-11-28T00:00', journee: true }], '2026-11-27'), [{ debut: '2026-11-27T00:00', fin: '2026-11-28T00:00', journee: true }])
    assert.deepEqual(P.persoDuJour(l, '2026-11-28'), [])
  })
  test('déjà pris dans l’agenda perso', () => {
    const l = [{ debut: '2026-11-27T10:00', fin: '2026-11-27T11:00' }]
    assert.equal(P.dejaPrisPerso(l, '2026-11-27T10:30', 60), true)
    assert.equal(P.dejaPrisPerso(l, '2026-11-27T09:00', 60), false)   // finit pile quand l'autre commence
    assert.equal(P.dejaPrisPerso(l, '2026-11-27T11:00', 60), false)
    assert.equal(P.dejaPrisPerso([], '2026-11-27T10:30', 60), false)
    assert.equal(P.MSG_PRIS_PERSO, 'Yann est pris dans son agenda perso à cette heure-là : choisissez un autre créneau.')
  })
  test('depuis quand, en français', () => {
    const n = Date.parse('2026-11-26T12:00:00Z')
    assert.equal(P.ageFr('2026-11-26T11:59:40Z', n), 'à l’instant')
    assert.equal(P.ageFr('2026-11-26T11:55:00Z', n), 'il y a 5 min')
    assert.equal(P.ageFr('2026-11-26T10:00:00Z', n), 'il y a 2 h')
    assert.equal(P.ageFr('2026-11-25T10:00:00Z', n), 'hier')
    assert.equal(P.ageFr('2026-11-23T10:00:00Z', n), 'il y a 3 jours')
    assert.equal(P.ageFr('pas une date', n), '')
  })
})

describe('le calendrier de l’iPhone', () => {
  const fiches = [{ id: F1, nom: 'Pharmacie du Port', ville: 'Pornichet' }, { id: F2, nom: 'Pharmacie Café, Thé; et Co', ville: 'Guérande' }]
  const estTele = (id) => id === TELE
  const maintenant = new Date('2026-11-26T09:00:00Z')
  const lignes = [
    ligne('a1', ID1, 'creer', { debut: '2026-11-27T23:30', duree_min: 60, lieu: 'Pharmacie du Port, 3 quai, Pornichet', objet: 'Budget 45 000 € à valider' }),
    ligne('a2', ID2, 'creer', { debut: '2026-11-30T14:00', duree_min: 60, objet: 'Premier rendez-vous' }, TELE, '2026-11-20T11:00:00Z', F2),
    ligne('a3', ID3, 'creer', { debut: '2026-12-01T09:00', duree_min: 60 }),
    ligne('a4', ID3, 'annuler', {}, YANN, '2026-11-21T10:00:00Z')
  ]
  const rdvs = P.etatsDesRdv(lignes, estTele)
  const ics = P.fluxIcs({ rdvs, fiches, maintenant, adresseApp: 'https://phirst-agencement.vercel.app/phirst/v2/#/agenda' })
  const plat = deplier(ics)

  test('bien formé : CRLF partout, chaque ligne ≤ 75 octets, BEGIN/END équilibrés, en-têtes de rafraîchissement', () => {
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
    assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false)
    for (const l of lignesIcs(ics).slice(0, -1)) assert.ok(octets(l) <= 75, l)
    const b = (ics.match(/^BEGIN:/gm) || []).length, e = (ics.match(/^END:/gm) || []).length
    assert.equal(b, e)
    for (const t of ['X-WR-CALNAME:Phirst', 'X-WR-TIMEZONE:Europe/Paris', 'X-PUBLISHED-TTL:PT15M', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'TZID:Europe/Paris', 'BYDAY=-1SU']) assert.ok(plat.includes(t), t)
  })
  test('un rendez-vous à 23 h 30 qui passe minuit', () => {
    assert.ok(plat.includes('UID:' + ID1 + '@phirst'))
    assert.ok(plat.includes('DTSTART;TZID=Europe/Paris:20261127T233000'))
    assert.ok(plat.includes('DTEND;TZID=Europe/Paris:20261128T003000'))
    assert.ok(plat.includes('DTSTAMP:20261126T090000Z'))
    assert.ok(plat.includes('STATUS:CONFIRMED'))
  })
  test('aucune somme : l’objet « Budget 45 000 € » est retiré', () => {
    assert.equal(/45|€|Budget/.test(plat), false)
  })
  test('le rendez-vous de la téléprospectrice arrive « À confirmer », virgule et point-virgule échappés', () => {
    assert.ok(plat.includes('SUMMARY:À confirmer · Pharmacie Café\\, Thé\\; et Co · Guérande'))
    assert.ok(plat.includes('DESCRIPTION:Premier rendez-vous\\nPris par la téléprospectrice : à confirmer dans Phirst.'))
    assert.ok(plat.includes('STATUS:TENTATIVE'))
    assert.ok(plat.includes('LOCATION:Guérande'))
  })
  test('l’annulé n’est pas dans le flux', () => {
    assert.equal(plat.includes(ID3), false)
    assert.equal((plat.match(/BEGIN:VEVENT/g) || []).length, 2)
  })
  test('un rendez-vous fini depuis plus de 90 jours n’y est plus', () => {
    const vieux = P.etatsDesRdv([ligne('v1', ID1, 'creer', { debut: '2026-08-01T10:00' })], estTele)
    assert.equal(P.fluxIcs({ rdvs: vieux, fiches, maintenant }).includes('BEGIN:VEVENT'), false)
    const recent = P.etatsDesRdv([ligne('v2', ID1, 'creer', { debut: '2026-09-01T10:00' })], estTele)
    assert.equal(P.fluxIcs({ rdvs: recent, fiches, maintenant }).includes('BEGIN:VEVENT'), true)
  })
  test('pliage : un accent sur la limite des 75 octets n’est jamais coupé', () => {
    for (let n = 60; n < 80; n++) {
      const l = 'DESCRIPTION:' + 'a'.repeat(n) + 'éééé' + 'b'.repeat(50)
      const p = P.plierIcs(l), morceaux = p.split('\r\n')
      for (const m of morceaux) { assert.ok(octets(m) <= 75); assert.equal(m.includes('�'), false) }
      assert.equal(p.replace(/\r\n /g, ''), l)
      assert.ok(morceaux.slice(1).every((m) => m.startsWith(' ')))
    }
  })
  test('échappement : antislash, point-virgule, virgule, retour à la ligne', () => {
    assert.equal(P.echapperIcs('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne')
  })
})
