// ═══════════════════════════════════════════════════════════════
// JARVIS · Le flux « mes rendez-vous », à mettre dans son vrai agenda
//
// Un client d'agenda (iPhone, Google, Outlook) ne sait pas s'authentifier :
// il fait un simple GET, sans en-tête. Le droit d'accès tient donc dans le
// jeton de l'adresse — traité comme un mot de passe, régénérable depuis
// l'app.
//
// Ce qui sort : les rendez-vous confirmés à venir. Rien d'autre — ni les
// liens envoyés, ni les préférences, ni un seul chiffre commercial.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2.112.2'

const URL_SB = Deno.env.get('SUPABASE_URL')!
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = () => createClient(URL_SB, CLE_SERVICE, { auth: { persistSession: false } })

const CORS = { 'Access-Control-Allow-Origin': '*' }

// Europe/Paris écrit en toutes lettres. Sans ce bloc, un client strict
// interprète « 10:00 » à SON fuseau : le rendez-vous d'un commercial en
// déplacement se décale d'une ou deux heures sans prévenir.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Paris',
  'X-LIC-LOCATION:Europe/Paris',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
  'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
  'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

/** Échappe ce qui a un sens dans iCal : virgule, point-virgule, antislash, saut de ligne. */
const ech = (s: unknown) =>
  String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Une ligne iCal ne dépasse pas 75 octets : au-delà, on replie avec une espace. */
function plier(ligne: string) {
  if (ligne.length <= 73) return ligne
  const out: string[] = []
  let reste = ligne
  out.push(reste.slice(0, 73))
  reste = reste.slice(73)
  while (reste.length > 72) { out.push(' ' + reste.slice(0, 72)); reste = reste.slice(72) }
  if (reste) out.push(' ' + reste)
  return out.join('\r\n')
}

function horodatage(date: string, heure: string, ajoutMin = 0) {
  const [a, m, j] = String(date).split('-').map(Number)
  const [h, mi] = String(heure).slice(0, 5).split(':').map(Number)
  // Arithmétique en UTC pour ne pas dépendre du fuseau du serveur, puis
  // relecture des champs : ce qu'on écrit reste une heure locale de Paris,
  // c'est le TZID qui la situe.
  const d = new Date(Date.UTC(a, m - 1, j, h, mi + ajoutMin))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
         `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`
}

Deno.serve(async (req) => {
  const u = new URL(req.url)
  const jeton = u.searchParams.get('j') || ''
  if (!jeton) return new Response('Adresse incomplète.', { status: 400, headers: CORS })

  const db = admin()
  const { data: f } = await db.from('rdv_flux')
    .select('user_id, actif').eq('token', jeton).maybeSingle()
  if (!f || !f.actif) return new Response('Adresse inconnue.', { status: 404, headers: CORS })

  const auj = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const { data: rdvs } = await db.from('rdv')
    // ⚠️ Ne demander que des colonnes qui existent : une seule de trop et
    // PostgREST rejette TOUTE la requête. Le flux sortait alors vide, sans la
    // moindre erreur visible — l'agenda affichait simplement « rien ».
    .select('id, date, heure, duree_min, nom, ville, cp, adresse, contact_nom, contact_tel, cree_le')
    .eq('user_id', f.user_id).eq('statut', 'confirme').gte('date', auj).order('date')

  const { data: prenomRow } = await db.from('user_profiles')
    .select('name').eq('id', f.user_id).maybeSingle()
  const prenom = String(prenomRow?.name || '').split(' ')[0] || ''

  const maintenant = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const lignes: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Integral Pharma//JARVIS//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Rendez-vous JARVIS' + (prenom ? ' · ' + ech(prenom) : ''),
    'X-WR-TIMEZONE:Europe/Paris',
    // Deux façons de dire la même chose : les clients ne lisent pas la même.
    // C'est un souhait, pas une obligation — Google fait ce qu'il veut.
    'X-PUBLISHED-TTL:PT15M',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    ...VTIMEZONE,
  ]

  for (const r of rdvs || []) {
    const lieu = [r.adresse, r.cp, r.ville].filter(Boolean).join(', ')
    const desc = [
      r.contact_nom ? 'Contact : ' + r.contact_nom : '',
      r.contact_tel ? 'Téléphone : ' + r.contact_tel : '',
      'Rendez-vous pris par le pharmacien depuis JARVIS.',
    ].filter(Boolean).join('\n')
    lignes.push(
      'BEGIN:VEVENT',
      plier('UID:' + ech(r.id) + '@jarvis.integralpharma'),
      'DTSTAMP:' + maintenant,
      'DTSTART;TZID=Europe/Paris:' + horodatage(r.date, r.heure),
      'DTEND;TZID=Europe/Paris:' + horodatage(r.date, r.heure, r.duree_min || 45),
      plier('SUMMARY:' + ech(r.nom || 'Rendez-vous officine')),
      ...(lieu ? [plier('LOCATION:' + ech(lieu))] : []),
      plier('DESCRIPTION:' + ech(desc)),
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    )
  }
  lignes.push('END:VCALENDAR')

  // Trace d'usage : elle sert à répondre « ton iPhone lit bien le flux »
  // quand un rendez-vous semble manquer. Aucune donnée personnelle dedans.
  await db.from('rdv_flux').update({ dernier_acces: new Date().toISOString() })
    .eq('token', jeton)

  return new Response(lignes.join('\r\n') + '\r\n', {
    headers: {
      ...CORS,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, max-age=0',
      'Content-Disposition': 'inline; filename="jarvis.ics"',
    },
  })
})
