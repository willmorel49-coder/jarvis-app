// ═══════════════════════════════════════════════════════════════
// JARVIS · Agenda des commerciaux — lecture, relève, coffre
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
//
// Six actions :
//   tester       (commercial connecté) — je viens de coller mon lien, ça marche ?
//   brancher     (commercial connecté) — range le lien dans le coffre + relève
//   debrancher   (commercial connecté) — retire le lien ET les plages relevées
//   relever_moi  (commercial connecté) — j'ouvre l'app, remets-moi à jour
//   relever      (jeton de RDV valide, de campagne OU permanent) — le pharmacien
//                ouvre sa page : on rafraîchit l'agenda du commercial
//   relever_tous (clé de service) — le robot de 15 minutes passe sur tout le monde
//
// ⚠️ Pourquoi « relever_tous » existe : avant lui, un agenda n'était relu que si
// un pharmacien ouvrait un lien. Mesuré le 13/08/2026 sur la prod : le seul
// agenda branché n'avait pas bougé depuis 19 h. Les créneaux proposés
// s'appuyaient donc sur une photo de la veille.
// ═══════════════════════════════════════════════════════════════
import ICAL from 'npm:ical.js@2.2.1'
import { createClient } from 'npm:@supabase/supabase-js@2.112.2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// On n'accepte que les hébergeurs d'agenda connus : sans ça la fonction
// devient un relais anonyme utilisable pour aller chercher n'importe quelle
// page depuis nos serveurs.
const HOTES = [
  'calendar.google.com',
  'outlook.office365.com', 'outlook.office.com', 'outlook.live.com',
]
const hoteAutorise = (h: string) =>
  HOTES.includes(h) || h.endsWith('.icloud.com') || h.endsWith('.calendar.google.com')

const TAILLE_MAX = 8 * 1024 * 1024   // 8 Mo : un agenda chargé pèse ~1 Mo
const JOURS = 45                     // au-delà de l'horizon de réservation (21 j)
const FRAICHEUR_MIN = 10 * 60 * 1000 // on ne relève pas plus d'une fois / 10 min

// Google plafonne la lecture de l'adresse secrète d'un agenda et répond 429
// quand on insiste — constaté le 13/08/2026, six lectures en quarante minutes
// ont suffi. Ce n'est PAS une panne : les heures déjà relevées restent bonnes.
// On attend donc une demi-heure avant de retenter, au lieu de cogner à chaque
// passage du robot et de finir vraiment bloqué.
const PATIENCE = 30 * 60 * 1000

const URL_SB = Deno.env.get('SUPABASE_URL')!
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function normaliser(brut: string) {
  const s = String(brut || '').trim().replace(/^webcal:\/\//i, 'https://')
  let u: URL
  try { u = new URL(s) } catch { return { erreur: 'adresse_invalide' } }
  if (u.protocol !== 'https:') return { erreur: 'https_obligatoire' }
  if (!hoteAutorise(u.hostname)) return { erreur: 'hebergeur_inconnu', hote: u.hostname }
  return { url: u.toString(), hote: u.hostname }
}

async function telecharger(url: string) {
  let r: Response
  try {
    r = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      // Certains hébergeurs d'agenda refusent un agent inconnu : on se
      // présente comme un lecteur de calendrier ordinaire.
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JARVIS-agenda/1.0)',
        'Accept': 'text/calendar, text/plain;q=0.9, */*;q=0.5',
      },
    })
  } catch (e) {
    return { erreur: 'agenda_injoignable', detail: String(e).slice(0, 140) }
  }
  if (!r.ok) return { erreur: 'agenda_injoignable', code: r.status }
  const buf = await r.arrayBuffer()
  if (buf.byteLength > TAILLE_MAX) return { erreur: 'agenda_trop_gros' }
  const ics = new TextDecoder().decode(buf)
  if (!/BEGIN:VCALENDAR/i.test(ics)) return { erreur: 'pas_un_agenda' }
  return { ics }
}

type Plage = { date: string; debut: string; fin: string; jour_entier: boolean }

/** Transforme un flux iCal en plages occupées, sans rien retenir d'autre. */
function plagesOccupees(ics: string, jours: number): { lus: number; plages: Plage[] } {
  const cal = new ICAL.Component(ICAL.parse(ics))
  const debutFenetre = ICAL.Time.now()
  const finFenetre = debutFenetre.clone()
  finFenetre.addDuration(ICAL.Duration.fromSeconds(jours * 86400))

  const plages: Plage[] = []
  let lus = 0

  for (const vevent of cal.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(vevent)
    lus++

    // TRANSP:TRANSPARENT = « je reste disponible » (anniversaire, jour férié).
    // L'ignorer remplirait l'agenda de fausses occupations : vérifié sur le
    // calendrier des fêtes françaises de Google — 209 événements, 209 transparents.
    if (vevent.getFirstPropertyValue('transp') === 'TRANSPARENT') continue
    if (String(vevent.getFirstPropertyValue('status') || '') === 'CANCELLED') continue

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

const admin = () => createClient(URL_SB, CLE_SERVICE, { auth: { persistSession: false } })

/** Qui appelle ? Renvoie l'id du commercial connecté, ou null. */
async function commercialConnecte(req: Request): Promise<string | null> {
  const entete = req.headers.get('Authorization') || ''
  if (!entete.startsWith('Bearer ')) return null
  const jeton = entete.slice(7)
  if (jeton === CLE_ANON) return null              // la clé publique n'est pas une identité
  const c = createClient(URL_SB, CLE_ANON, {
    global: { headers: { Authorization: 'Bearer ' + jeton } },
    auth: { persistSession: false },
  })
  const { data } = await c.auth.getUser()
  return data?.user?.id || null
}

/** Relève l'agenda d'un commercial et remplace ses plages occupées. */
async function relever(userId: string, forcer = false, fraicheur = FRAICHEUR_MIN) {
  const db = admin()
  const { data: a } = await db.from('rdv_agenda')
    .select('url, actif, dernier_ok, dernier_essai, derniere_erreur')
    .eq('user_id', userId).maybeSingle()
  if (!a || !a.actif) return { ok: false, raison: 'pas_d_agenda' }

  if (!forcer && a.dernier_ok && Date.now() - new Date(a.dernier_ok).getTime() < fraicheur) {
    return { ok: true, frais: true }
  }
  // L'hébergeur nous a demandé de lever le pied : on ne réessaie pas avant
  // une demi-heure. Insister transforme un ralentissement en vrai blocage.
  if (!forcer && String(a.derniere_erreur || '').startsWith('patience') &&
      a.dernier_essai && Date.now() - new Date(a.dernier_essai).getTime() < PATIENCE) {
    return { ok: true, patiente: true }
  }

  const t = await telecharger(a.url)
  if ('erreur' in t) {
    // « patience » = l'hébergeur nous rationne (429), ou il a eu un hoquet
    // passager (502/503). Marqué à part parce que l'écran ne doit PAS crier à
    // la panne : les heures déjà relevées restent justes, on repassera.
    const rationne = t.code === 429 || t.code === 502 || t.code === 503
    await db.from('rdv_agenda').update({
      dernier_essai: new Date().toISOString(),
      // Le code HTTP et le détail sont gardés : sans eux, « injoignable »
      // ne dit pas si c'est l'adresse qui est fausse, l'hébergeur qui
      // refuse, ou le réseau qui a lâché — et on répare à l'aveugle.
      derniere_erreur: (rationne ? 'patience · ' : '') +
        [t.erreur, t.code, t.detail].filter(Boolean).join(' · ').slice(0, 280),
    }).eq('user_id', userId)
    return { ok: false, raison: t.erreur, code: t.code, detail: t.detail }
  }

  let lus = 0, plages: Plage[] = []
  try { ({ lus, plages } = plagesOccupees(t.ics!, JOURS)) }
  catch (e) {
    await db.from('rdv_agenda').update({
      dernier_essai: new Date().toISOString(),
      derniere_erreur: 'lecture_impossible: ' + String(e).slice(0, 100),
    }).eq('user_id', userId)
    return { ok: false, raison: 'lecture_impossible' }
  }

  // Remplacement complet : on ne conserve aucun historique de sa vie privée.
  await db.from('rdv_occupe').delete().eq('user_id', userId)
  if (plages.length) {
    await db.from('rdv_occupe').insert(plages.map((p) => ({
      user_id: userId, date: p.date, debut: p.debut, fin: p.fin, jour_entier: p.jour_entier,
    })))
  }
  const maintenant = new Date().toISOString()
  await db.from('rdv_agenda').update({
    dernier_essai: maintenant, dernier_ok: maintenant, derniere_erreur: null,
    evenements_lus: lus, plages_gardees: plages.length, maj_le: maintenant,
  }).eq('user_id', userId)

  return { ok: true, evenements_lus: lus, plages_gardees: plages.length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reponse({ ok: false, raison: 'methode' }, 405)

  let c: { action?: string; url?: string; token?: string }
  try { c = await req.json() } catch { return reponse({ ok: false, raison: 'json' }, 400) }
  const action = String(c.action || 'tester')

  // ─── Le robot de 15 minutes : il repasse sur tous les agendas branchés,
  // que quelqu'un ouvre une page ou non. C'est LUI qui rend les créneaux
  // fiables ; le reste n'est qu'un rattrapage opportuniste.
  // Seule la clé de service ouvre cette porte — elle ne sort jamais du serveur.
  if (action === 'relever_tous') {
    const entete = req.headers.get('Authorization') || ''
    if (entete !== 'Bearer ' + CLE_SERVICE) return reponse({ ok: false, raison: 'interdit' }, 403)
    const db = admin()
    const { data: tous } = await db.from('rdv_agenda').select('user_id').eq('actif', true)
    const bilan: Record<string, unknown>[] = []
    for (const a of tous || []) {
      // En série, pas en parallèle : deux agendas, aucun intérêt à paralléliser,
      // et on évite de saturer la fonction si un hébergeur traîne.
      //
      // Surtout : PAS de « forcer ». Le robot passe toutes les 15 minutes et se
      // contente d'une fenêtre de 12 — de quoi relire à chaque passage, sans
      // additionner ses lectures à celles déclenchées par une page ouverte.
      // Forcer avait suffi à faire répondre 429 à Google le 13/08/2026.
      const r = await relever(a.user_id, false, 12 * 60 * 1000)
      bilan.push({ user_id: a.user_id, ...r })
    }
    return reponse({ ok: true, agendas: bilan.length, bilan })
  }

  // ─── Le pharmacien ouvre sa page : on rafraîchit l'agenda du commercial.
  // Pas d'identité ici, mais un jeton de rendez-vous valide : il désigne
  // exactement un commercial, et rien d'autre n'est accessible.
  //
  // Deux sortes de jetons mènent à une page de réservation, et il a longtemps
  // manqué la seconde : le lien de campagne (rdv_lien, à usage unique) ET le
  // lien permanent du commercial (rdv_lien_public, celui de rdv/william.html).
  // Un pharmacien passé par le lien permanent ne déclenchait donc aucune relève.
  if (action === 'relever') {
    if (!c.token) return reponse({ ok: false, raison: 'jeton_manquant' }, 400)
    const db = admin()
    const { data: l } = await db.from('rdv_lien')
      .select('user_id, expire_le').eq('token', c.token).maybeSingle()
    if (l) {
      if (new Date(l.expire_le).getTime() <= Date.now())
        return reponse({ ok: false, raison: 'jeton_expire' }, 403)
      return reponse(await relever(l.user_id))
    }
    const { data: lp } = await db.from('rdv_lien_public')
      .select('user_id, actif').eq('token', c.token).maybeSingle()
    if (!lp) return reponse({ ok: false, raison: 'jeton_inconnu' }, 403)
    if (!lp.actif) return reponse({ ok: false, raison: 'lien_ferme' }, 403)
    return reponse(await relever(lp.user_id))
  }

  // ─── Toutes les autres actions exigent un commercial connecté.
  const userId = await commercialConnecte(req)
  if (!userId) return reponse({ ok: false, raison: 'connexion_requise' }, 401)

  // ─── Le commercial ouvre son écran Rendez-vous : on remet son agenda à jour
  // avant qu'il regarde son planning. Cinq minutes de fraîcheur suffisent à
  // éviter qu'un aller-retour entre deux écrans relance une lecture complète —
  // et à ne pas s'ajouter au rythme du robot au point de fâcher l'hébergeur.
  if (action === 'relever_moi') return reponse(await relever(userId, false, 5 * 60 * 1000))

  if (action === 'debrancher') {
    // Le déclencheur en base efface aussi les plages relevées.
    await admin().from('rdv_agenda').delete().eq('user_id', userId)
    return reponse({ ok: true })
  }

  const n = normaliser(c.url || '')
  if ('erreur' in n) return reponse({ ok: false, raison: n.erreur, hote: n.hote })

  if (action === 'tester') {
    const t = await telecharger(n.url!)
    if ('erreur' in t) return reponse({ ok: false, raison: t.erreur, code: t.code })
    try {
      const { lus, plages } = plagesOccupees(t.ics!, JOURS)
      // On renvoie 3 plages en exemple pour que le commercial reconnaisse
      // SON agenda et sache qu'il n'a pas collé le lien d'un collègue.
      return reponse({
        ok: true, hote: n.hote, evenements_lus: lus, plages_gardees: plages.length,
        exemple: plages.slice(0, 3),
      })
    } catch (e) {
      return reponse({ ok: false, raison: 'lecture_impossible', detail: String(e).slice(0, 160) })
    }
  }

  if (action === 'brancher') {
    const t = await telecharger(n.url!)
    if ('erreur' in t) return reponse({ ok: false, raison: t.erreur, code: t.code })
    const db = admin()
    await db.from('rdv_agenda').upsert(
      { user_id: userId, url: n.url, hote: n.hote, actif: true, maj_le: new Date().toISOString() },
      { onConflict: 'user_id' })
    return reponse(await relever(userId, true))
  }

  return reponse({ ok: false, raison: 'action_inconnue' }, 400)
})
