// Contrôle « visiteur sans compte » (action n° 4 du plan de sécurité, 23/10/2026).
// Un inconnu qui n'a que la clé publique `anon` (déjà dans crm/v2/index.html) ne doit
// rien pouvoir lire : 401 sur chacune des tables, aucun document listé.
// AUCUN secret : la clé est lue dans index.html au moment du test. Que des lectures.
//
// ⚠️ Nouvelle table dans Supabase = l'ajouter à visiteur-tables.txt (la racine
// OpenAPI est réservée à service_role, on ne peut donc pas la lister de façon dynamique).
//
// Deux messages DISTINCTS, ne jamais les confondre :
//  - « FAILLE »  : un inconnu a reçu autre chose qu'un refus ;
//  - « contrôle impossible » : un témoin est rouge, Supabase injoignable ou clé changée.
//    Ce n'est PAS une faille ; un 401 sans témoin vert ne prouverait rien.
//
// Variable de test (contre-épreuve uniquement) : VISITEUR_TEST_FERMEE="rpc/tv_profils"
// traite une ressource que l'on SAIT ouverte comme « devant être fermée » : le contrôle
// doit alors échouer en FAILLE.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..', '..');
const html = readFileSync(join(racine, 'crm/v2/index.html'), 'utf8');
const url = (html.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
const cle = (html.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];
if (!url || !cle) { console.error('❌ contrôle impossible : URL ou clé publique introuvable dans crm/v2/index.html'); process.exit(2); }

const tables = readFileSync(join(ici, 'visiteur-tables.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const supp = (process.env.VISITEUR_TEST_FERMEE || '').split(',').map((s) => s.trim()).filter(Boolean);

// Espaces de stockage (buckets) vus dans le code de l'app. Liste blanche COMMENTÉE :
//  - marketing-media : seau PUBLIC voulu (images des publications LinkedIn, lues par
//    getPublicUrl). Le listing y est permis ; on le signale mais on ne l'échoue pas.
// Les documents publics du dossier opso/ et l'annuaire des pharmacies en données ouvertes
// sont des fichiers du DÉPÔT (servis par le site), pas des seaux : aucune exception ici.
const SEAUX = ['excel-imports', 'notes-vocales', 'donnees-protegees', 'documents-prives', 'marketing-pdfs'];
const SEAUX_PUBLICS_VOULUS = ['marketing-media'];

const entetes = { apikey: cle, Authorization: 'Bearer ' + cle };
async function appel(chemin, opts = {}) {
  let derniere;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const r = await fetch(url + chemin, { ...opts, headers: { ...entetes, ...(opts.headers || {}) }, signal: AbortSignal.timeout(20000) });
      if (r.status < 500 && r.status !== 429) return r;
      derniere = new Error('HTTP ' + r.status);
    } catch (e) { derniere = e; }
    await new Promise((ok) => setTimeout(ok, 3000 * essai));
  }
  throw derniere;
}

// 1. Témoins : sans eux, un 401 ne prouve rien.
try {
  const t1 = await appel('/auth/v1/settings');
  const t2 = await appel('/rest/v1/rpc/tv_profils', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (t1.status !== 200 || t2.status !== 200) throw new Error(`témoins auth/settings=${t1.status}, rpc/tv_profils=${t2.status} (attendu 200 et 200)`);
  console.log('✅ Témoins verts (auth/settings 200, rpc/tv_profils 200) : Supabase répond et la clé est valable');
} catch (e) {
  console.error('❌ contrôle impossible (Supabase injoignable ou clé changée) — ce n\'est PAS une faille. Détail : ' + e.message);
  process.exit(2);
}

const failles = [];
const inattendus = [];

// 2. Tables : 401 attendu partout.
for (const t of [...tables, ...supp]) {
  const rpc = t.startsWith('rpc/');
  const r = await appel('/rest/v1/' + t + (rpc ? '' : '?select=*'), rpc
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    : { headers: { Range: '0-0' } });
  if (r.status === 401) continue;
  (r.status === 200 || r.status === 206 ? failles : inattendus).push(`${t} → HTTP ${r.status}`);
}
console.log(`Tables contrôlées : ${tables.length + supp.length} (refus 401 attendu)`);

// 3. Documents : une liste par un inconnu doit être vide ou refusée.
const liste = (seau) => appel('/storage/v1/object/list/' + seau, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"prefix":"","limit":5}' });
for (const s of SEAUX) {
  const r = await liste(s);
  if (r.status >= 400) continue;               // refus : bien
  const j = await r.json().catch(() => null);
  if (Array.isArray(j) && j.length === 0) continue; // vide : bien
  failles.push(`seau « ${s} » : un inconnu obtient ${Array.isArray(j) ? j.length : '?'} entrée(s) (HTTP ${r.status})`);
}
for (const s of SEAUX_PUBLICS_VOULUS) {
  const r = await liste(s);
  console.log(`ℹ️ seau public voulu « ${s} » : HTTP ${r.status} (autorisé, liste blanche)`);
}
console.log(`Seaux de documents contrôlés : ${SEAUX.length} (+ ${SEAUX_PUBLICS_VOULUS.length} public voulu)`);

if (inattendus.length) console.error('⚠️ Réponses inattendues (ni 401 ni ouverture) :\n - ' + inattendus.join('\n - '));
if (failles.length) {
  console.error('❌ FAILLE : un visiteur sans compte a accès à :\n - ' + failles.join('\n - '));
  process.exit(1);
}
if (inattendus.length) process.exit(1);
console.log('✅ Visiteur sans compte : tout est fermé');
