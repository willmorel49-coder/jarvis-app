// ═══════════════════════════════════════════════════════════════
// JARVIS · L'alerte « un pharmacien vient de réserver »
//
// Appelée par la base (déclencheur sur la table rdv), jamais par un
// navigateur. Elle pousse une notification sur les téléphones que le
// commercial a lui-même abonnés.
//
// Pourquoi une notification et pas un mail : un mail exigerait un service
// d'envoi extérieur, donc un compte et une clé à payer ou à surveiller.
// Le push web se signe avec NOS clés (VAPID), générées une fois, sans
// aucun tiers. Google et Apple relaient gratuitement.
//
// Deux actions :
//   (par défaut)   { rdv_id }  — clé de service — un RDV vient d'être posé
//   « essai »      { essai:true } — commercial connecté — « teste sur mon
//                  téléphone », pour ne pas découvrir que rien n'arrive le
//                  jour où un vrai pharmacien réserve.
// ═══════════════════════════════════════════════════════════════
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.112.2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const URL_SB = Deno.env.get('SUPABASE_URL')!
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const VAPID_PUB = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIV = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUJET = Deno.env.get('VAPID_SUJET') || 'mailto:contact@integralpharma.fr'

webpush.setVapidDetails(VAPID_SUJET, VAPID_PUB, VAPID_PRIV)

const admin = () => createClient(URL_SB, CLE_SERVICE, { auth: { persistSession: false } })

function reponse(corps: unknown, code = 200) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function libelle(iso: string) {
  const p = String(iso).split('-')
  const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]))
  return `${JOURS[d.getUTCDay()]} ${+p[2]} ${MOIS[+p[1] - 1]}`
}

/** Envoie à tous les téléphones d'un commercial. Renvoie le compte des envois. */
async function pousser(userId: string, charge: Record<string, unknown>) {
  const db = admin()
  const { data: abos } = await db.from('push_abo')
    .select('id, endpoint, p256dh, auth').eq('user_id', userId)
  if (!abos || !abos.length) return { envoyes: 0, abonnes: 0, raison: 'aucun_appareil' }

  let envoyes = 0
  for (const a of abos) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify(charge),
        { TTL: 12 * 3600 },   // au-delà d'une demi-journée, l'alerte n'a plus d'intérêt
      )
      envoyes++
      await db.from('push_abo')
        .update({ dernier_envoi: new Date().toISOString(), derniere_erreur: null })
        .eq('id', a.id)
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode
      // 404/410 = le téléphone a désinstallé l'app ou révoqué l'autorisation.
      // Garder l'abonnement ferait échouer tous les envois suivants pour rien.
      if (code === 404 || code === 410) {
        await db.from('push_abo').delete().eq('id', a.id)
      } else {
        await db.from('push_abo')
          .update({ derniere_erreur: String(e).slice(0, 300) }).eq('id', a.id)
      }
    }
  }
  return { envoyes, abonnes: abos.length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reponse({ ok: false, raison: 'methode' }, 405)

  let c: { rdv_id?: string; essai?: boolean }
  try { c = await req.json() } catch { return reponse({ ok: false, raison: 'json' }, 400) }

  const entete = req.headers.get('Authorization') || ''

  // ─── Essai depuis l'app : le commercial veut vérifier que son téléphone sonne.
  if (c.essai) {
    if (!entete.startsWith('Bearer ')) return reponse({ ok: false, raison: 'connexion_requise' }, 401)
    const jeton = entete.slice(7)
    if (jeton === CLE_ANON) return reponse({ ok: false, raison: 'connexion_requise' }, 401)
    const cl = createClient(URL_SB, CLE_ANON, {
      global: { headers: { Authorization: 'Bearer ' + jeton } },
      auth: { persistSession: false },
    })
    const { data } = await cl.auth.getUser()
    if (!data?.user?.id) return reponse({ ok: false, raison: 'connexion_requise' }, 401)
    return reponse({
      ok: true,
      ...(await pousser(data.user.id, {
        titre: 'JARVIS · essai',
        corps: 'Si tu lis ça, les alertes de rendez-vous fonctionnent sur ce téléphone.',
        url: '#rdvplanning',
      })),
    })
  }

  // ─── Le vrai cas : la base signale un rendez-vous confirmé.
  if (entete !== 'Bearer ' + CLE_SERVICE) return reponse({ ok: false, raison: 'interdit' }, 403)
  if (!c.rdv_id) return reponse({ ok: false, raison: 'rdv_manquant' }, 400)

  const db = admin()
  const { data: r } = await db.from('rdv')
    .select('user_id, date, heure, nom, ville, contact_nom, contact_tel')
    .eq('id', c.rdv_id).maybeSingle()
  if (!r) return reponse({ ok: false, raison: 'rdv_inconnu' }, 404)

  const heure = String(r.heure).slice(0, 5).replace(':', 'h')
  const corps = [
    `${libelle(r.date)} à ${heure}`,
    [r.nom, r.ville].filter(Boolean).join(' · '),
    r.contact_nom || '',
  ].filter(Boolean).join('\n')

  return reponse({
    ok: true,
    ...(await pousser(r.user_id, {
      titre: 'Nouveau rendez-vous',
      corps,
      url: '#rdvplanning',
      // L'ajout à l'agenda se fait depuis l'écran ouvert par la notification :
      // un service worker ne peut pas déclencher un téléchargement tout seul.
      rdv_id: c.rdv_id,
    })),
  })
})
