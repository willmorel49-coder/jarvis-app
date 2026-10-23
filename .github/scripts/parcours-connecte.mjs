// Parcours connecté (action n° 6 du plan de sécurité, 23/10/2026).
// Se connecte avec le compte de test PERMANENT (secrets GitHub JARVIS_CI_EMAIL et
// JARVIS_CI_MOT_DE_PASSE), par le formulaire de l'app, puis ouvre les écrans les plus
// utilisés par l'équipe. Pour CHAQUE écran :
//   1. un MARQUEUR POSITIF propre à l'écran (un texte attendu) est visible ;
//   2. la page « Maintenance en cours » est absente ;
//   3. aucune exception JavaScript (pageerror) ;
//   4. aucune réponse 401/403 vers supabase.co — sauf les écritures (POST/PATCH/PUT/DELETE)
//      refusées parce que le compte est en lecture seule : listées à part, « attendu ».
// Moteur : BROWSER=chromium (défaut) ou webkit (Safari). Serveur local sur PORT (8080).
//
// Secrets absents = ÉCHEC bruyant (jamais un saut silencieux qui ressemblerait à un succès).
// Ni l'e-mail ni le mot de passe ne sont jamais écrits dans les journaux.
//
// Écriture automatique de l'app à chaque ouverture d'écran : INSERT dans usage_ecran
// (statistique d'usage nominative). Elle est INTERCEPTÉE ici (réponse 201 simulée, rien ne
// part vers Supabase) : sinon chaque passage du portail gonflerait le classement des écrans
// de l'équipe avec le compte de test.
import { chromium, webkit } from 'playwright';

const email = process.env.JARVIS_CI_EMAIL;
const mdp = process.env.JARVIS_CI_MOT_DE_PASSE;
if (!email || !mdp) {
  console.error('❌ Parcours connecté IMPOSSIBLE : les secrets GitHub JARVIS_CI_EMAIL et/ou JARVIS_CI_MOT_DE_PASSE sont absents ou vides dans ce job. Ce n\'est pas un succès : le contrôle n\'a pas eu lieu.');
  process.exit(1);
}

const nomMoteur = process.env.BROWSER || 'chromium';
const moteur = nomMoteur === 'webkit' ? webkit : chromium;
const PORT = process.env.PORT || 8080;
const base = `http://localhost:${PORT}/crm/v2/index.html`;

// Écrans principaux de l'équipe (accueil + 5), chacun avec son marqueur propre.
// `selecteur` + `texte` : l'élément précis qui doit contenir le texte (pas n'importe où dans la page).
const ECRANS = [
  { route: 'pharma',   nom: 'Officines',    selecteur: 'h1.v2-titre',     texte: 'Mes officines' },
  { route: 'pilotage', nom: 'Pilotage',     selecteur: '.v2-page-title',  texte: 'Pilotage' },
  { route: 'produits', nom: 'Produits',     selecteur: '.v2-page-title',  texte: 'Produits' },
  { route: 'infos',    nom: 'Infos du jour', selecteur: 'h1',             texte: 'Infos du jour' },
  { route: 'todo',     nom: 'To do list',   selecteur: 'h1',             texte: 'To do list' },
];
const DELAI = 90000;
const ECRITURES = ['POST', 'PATCH', 'PUT', 'DELETE'];

const browser = await moteur.launch();
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();

const exceptions = [];
const refus = [];        // lectures refusées 401/403 : échec
const attendus = [];     // écritures refusées (compte en lecture seule) : attendu
let ecranCourant = 'connexion';
page.on('pageerror', (e) => exceptions.push(`[${ecranCourant}] ${e && e.message ? e.message : String(e)}`));
page.on('response', (r) => {
  const u = r.url();
  if (!/\.supabase\.co\//.test(u) || ![401, 403].includes(r.status())) return;
  const m = r.request().method();
  const court = new URL(u).pathname.replace(/^\/(rest|storage|auth)\/v1\//, '$1/');
  (ECRITURES.includes(m) ? attendus : refus).push(`[${ecranCourant}] ${m} ${court} → ${r.status()}`);
});
// Statistique d'usage : interceptée (voir en-tête).
let usageNeutralise = 0;
await context.route(/\.supabase\.co\/rest\/v1\/usage_ecran/, (route) => {
  if (route.request().method() === 'POST') { usageNeutralise++; return route.fulfill({ status: 201, body: '' }); }
  return route.continue();
});

const echecs = [];
const verifMaintenance = async (nom) => {
  const txt = await page.evaluate(() => document.body.innerText || '');
  if (/Maintenance en cours/i.test(txt)) echecs.push(`${nom} : page « Maintenance en cours » affichée`);
  if (/Données non chargées/i.test(txt)) echecs.push(`${nom} : écran « Données non chargées » (les ventes du compte de test n'ont pas pu être lues)`);
  if (/Une erreur est survenue|Cette page n.a pas pu/i.test(txt)) echecs.push(`${nom} : écran d'erreur affiché`);
};

try {
  await page.goto(base, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#v2-email', { timeout: 30000 });
  await page.fill('#v2-email', email);
  await page.fill('#v2-pass', mdp);
  await page.click('#v2-login-btn');
  ecranCourant = 'accueil';
  try {
    await page.locator('h1.v2-titre', { hasText: 'Bonjour' }).first().waitFor({ state: 'visible', timeout: DELAI });
  } catch (e) {
    const err = await page.evaluate(() => (document.getElementById('v2-login-err') || {}).textContent || '').catch(() => '');
    await verifMaintenance('accueil');
    console.error('❌ Accueil introuvable après connexion' + (err ? ' (message de l\'app : « ' + err + ' »)' : '') + '.');
    echecs.push('accueil : marqueur positif (h1.v2-titre « Bonjour ») absent après ' + DELAI / 1000 + ' s');
  }
  if (!echecs.length) {
    await page.waitForTimeout(2500);
    await verifMaintenance('accueil');
    console.log('✅ accueil : connecté, marqueur présent');
    for (const e of ECRANS) {
      ecranCourant = e.nom;
      const avant = echecs.length;
      await page.evaluate((r) => window.V2.go(r), e.route);
      try {
        await page.locator(e.selecteur, { hasText: e.texte }).first().waitFor({ state: 'visible', timeout: DELAI });
      } catch (err) {
        echecs.push(`${e.nom} : marqueur « ${e.texte} » (${e.selecteur}) absent après ${DELAI / 1000} s`);
      }
      await page.waitForTimeout(2500);
      await verifMaintenance(e.nom);
      console.log((echecs.length === avant ? '✅ ' : '❌ ') + e.nom + ' : marqueur « ' + e.texte + ' »');
    }
  }
} catch (e) {
  echecs.push('parcours interrompu : ' + (e && e.message ? e.message.split('\n')[0] : String(e)));
}
await browser.close();

console.log(`Moteur : ${nomMoteur} · écritures « usage_ecran » interceptées : ${usageNeutralise}`);
if (attendus.length) console.log('ℹ️ Écritures refusées, ATTENDU (compte en lecture seule) :\n - ' + [...new Set(attendus)].join('\n - '));
if (exceptions.length) echecs.push('exception(s) JavaScript : ' + exceptions.join(' | '));
if (refus.length) echecs.push('lecture(s) refusée(s) 401/403 : ' + [...new Set(refus)].join(' | '));
if (echecs.length) {
  console.error('❌ Parcours connecté en échec :\n - ' + echecs.join('\n - '));
  process.exit(1);
}
console.log('✅ Parcours connecté OK — accueil + ' + ECRANS.length + ' écrans, aucune exception, aucun refus de lecture');
