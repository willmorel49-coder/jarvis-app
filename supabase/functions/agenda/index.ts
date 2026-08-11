// ═══════════════════════════════════════════════════════════════
// JARVIS · Lecteur d'agenda des commerciaux
//
// Pourquoi cette fonction existe : un flux iCal (Google, Outlook, iCloud)
// n'est PAS lisible depuis un navigateur — aucun de ces serveurs n'envoie
// d'en-tête CORS. Il faut un intermédiaire côté serveur. C'est aussi la
// bonne réponse « vie privée » : l'adresse secrète de l'agenda ne quitte
// jamais nos serveurs et n'est jamais vue par le pharmacien.
//
// Ce qui sort d'ici : UNIQUEMENT des plages « occupé de telle heure à
// telle heure ». Jamais un titre, jamais un lieu, jamais un participant.
// Ce n'est pas une promesse : il n'y a pas de champ pour les transporter.
// ═══════════════════════════════════════════════════════════════
import ICAL from 'npm:ical.js@2.2.1'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// On n'accepte que les hébergeurs d'agenda connus : sans ça la fonction
// devient un relais anonyme utilisable par n'importe qui pour aller chercher
// n'importe quelle page depuis nos serveurs.
const HOTES = [
  'calendar.google.com',
  'outlook.office365.com', 'outlook.office.com', 'outlook.live.com',
  'p01-calendarws.icloud.com', 'p02-calendarws.icloud.com',
]
const hoteAutorise = (h: string) =>
  HOTES.includes(h) || h.endsWith('.icloud.com') || h.endsWith('.calendar.google.com')

const TAILLE_MAX = 8 * 1024 * 1024   // 8 Mo : un agenda chargé pèse ~1 Mo
const JOURS_MAX = 60

function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** Transforme un flux iCal en plages occupées, sans rien retenir d'autre. */
function plagesOccupees(ics: string, jours: number) {
  const jcal = ICAL.parse(ics)
  const cal = new ICAL.Component(jcal)
  const debutFenetre = ICAL.Time.now()
  const finFenetre = debutFenetre.clone()
  finFenetre.addDuration(ICAL.Duration.fromSeconds(jours * 86400))

  const plages: { date: string; debut: string; fin: string; jour_entier: boolean }[] = []
  let lus = 0

  for (const vevent of cal.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(vevent)
    lus++

    // TRANSP:TRANSPARENT = « je reste disponible » (rappel, anniversaire).
    // L'ignorer remplirait l'agenda de fausses occupations.
    if (vevent.getFirstPropertyValue('transp') === 'TRANSPARENT') continue
    // Invitation refusée ou simplement reçue : ce n'est pas une occupation.
    const statut = String(vevent.getFirstPropertyValue('status') || '')
    if (statut === 'CANCELLED') continue

    const pousser = (deb: ICAL.Time, fin: ICAL.Time) => {
      const d = deb.toJSDate(), f = fin.toJSDate()
      plages.push({
        date: deb.toString().slice(0, 10),
        debut: deb.isDate ? '00:00' : d.toTimeString().slice(0, 5),
        fin: deb.isDate ? '23:59' : f.toTimeString().slice(0, 5),
        jour_entier: !!deb.isDate,
      })
    }

    if (ev.isRecurring()) {
      // L'itérateur d'ical.js applique RRULE, EXDATE et les occurrences
      // déplacées (RECURRENCE-ID). Un analyseur maison rate ces trois cas
      // et donne des créneaux libres qui ne le sont pas.
      const it = ev.iterator()
      let occ, garde = 0
      while ((occ = it.next()) && garde++ < 500) {
        if (occ.compare(finFenetre) > 0) break
        if (occ.compare(debutFenetre) < 0) continue
        const det = ev.getOccurrenceDetails(occ)
        pousser(det.startDate, det.endDate)
      }
    } else {
      if (ev.endDate.compare(debutFenetre) < 0) continue
      if (ev.startDate.compare(finFenetre) > 0) continue
      pousser(ev.startDate, ev.endDate)
    }
  }
  return { lus, plages }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reponse({ ok: false, raison: 'methode' }, 405)

  let corps: { url?: string; jours?: number }
  try { corps = await req.json() } catch { return reponse({ ok: false, raison: 'json' }, 400) }

  const brut = String(corps.url || '').trim().replace(/^webcal:\/\//i, 'https://')
  const jours = Math.min(Math.max(Number(corps.jours) || 21, 1), JOURS_MAX)

  let u: URL
  try { u = new URL(brut) } catch { return reponse({ ok: false, raison: 'adresse_invalide' }) }
  if (u.protocol !== 'https:') return reponse({ ok: false, raison: 'https_obligatoire' })
  if (!hoteAutorise(u.hostname)) return reponse({ ok: false, raison: 'hebergeur_inconnu', hote: u.hostname })

  let ics: string
  try {
    const r = await fetch(u.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'JARVIS-agenda/1.0' },
    })
    if (!r.ok) return reponse({ ok: false, raison: 'agenda_injoignable', code: r.status })
    const buf = await r.arrayBuffer()
    if (buf.byteLength > TAILLE_MAX) return reponse({ ok: false, raison: 'agenda_trop_gros' })
    ics = new TextDecoder().decode(buf)
  } catch (e) {
    return reponse({ ok: false, raison: 'agenda_injoignable', detail: String(e).slice(0, 120) })
  }

  if (!/BEGIN:VCALENDAR/i.test(ics)) return reponse({ ok: false, raison: 'pas_un_agenda' })

  try {
    const { lus, plages } = plagesOccupees(ics, jours)
    return reponse({ ok: true, evenements_lus: lus, jours, occupe: plages })
  } catch (e) {
    return reponse({ ok: false, raison: 'lecture_impossible', detail: String(e).slice(0, 160) })
  }
})
