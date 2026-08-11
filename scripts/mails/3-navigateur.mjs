/**
 * Etape 3 — lire l'adresse mail sur les sites que la passe HTTP n'a pas su lire.
 *
 * Pourquoi un navigateur ICI et pas avant : les plateformes qui hebergent la
 * plupart des sites d'officines (pharminfo.fr, mesoigner.fr, epharmacie.pro,
 * offisante...) rendent leur contenu en JavaScript. Un simple appel HTTP recoit
 * une page vide. Playwright execute le JS et voit ce que voit un visiteur.
 *
 * Regles de politesse, non negociables :
 *   - on se presente (User-Agent explicite) ;
 *   - une page a la fois, avec une pause entre deux sites ;
 *   - on ne lit que des pages de contact publiques ;
 *   - on n'ouvre jamais de formulaire, on ne poste rien.
 *
 * Entree : scripts/mails/sites.json   (entrees dont email === '')
 * Sortie : scripts/mails/navigateur.json
 *
 * Lancement (playwright installe hors du depot, comme la CI) :
 *   cd <scratchpad> && npm i --no-save playwright
 *   NODE_PATH=<scratchpad>/node_modules node scripts/mails/3-navigateur.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ICI = path.dirname(new URL(import.meta.url).pathname);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/126.0 Safari/537.36 ' +
           'JARVIS-IntegralPharma/1.0 (annuaire officines; contact via integralpharma.fr)';

const CHEMINS = ['', '/contact', '/nous-contacter', '/mentions-legales', '/la-pharmacie'];
const RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const REJET = /(sentry|wixpress|example|godaddy|wordpress|squarespace|cloudflare|jimdo|weebly|shopify|webmaster@|noreply|no-reply|donotreply|\.png|\.jpg|\.svg)/i;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function trier(adresses, domaine) {
  const d = (domaine || '').replace('www.', '');
  return [...new Set(adresses.map((e) => e.trim().replace(/[.,;:]$/, '').toLowerCase()))]
    .filter((e) => !REJET.test(e))
    .sort((a, b) => (a.endsWith('@' + d) ? 0 : 1) - (b.endsWith('@' + d) ? 0 : 1));
}

async function lireSite(page, site) {
  const u = new URL(site.startsWith('http') ? site : 'https://' + site);
  const base = u.origin;
  for (const chemin of CHEMINS) {
    const url = chemin ? base + chemin : site;
    try {
      const rep = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      if (!rep || rep.status() >= 400) continue;
      // laisse le JS peindre le contenu, sans attendre les pixels
      await page.waitForTimeout(2200);
      const trouves = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
          out.push(decodeURIComponent(a.getAttribute('href').slice(7).split('?')[0]));
        });
        out.push(document.body ? document.body.innerText : '');
        return out;
      });
      const brut = [];
      for (const t of trouves) {
        if (t.includes('@') && !t.includes(' ')) brut.push(t);
        else brut.push(...(t.match(RX) || []));
      }
      const ok = trier(brut, u.hostname);
      if (ok.length) return { email: ok[0], source: url };
    } catch (e) {
      /* page injoignable : on essaie le chemin suivant */
    }
    await dormir(500);
  }
  return { email: '', source: '' };
}

const src = path.join(ICI, 'sites.json');
if (!existsSync(src)) { console.log('Lance d\'abord 2-sites.py'); process.exit(1); }
const sites = JSON.parse(readFileSync(src, 'utf8'));

const sortieF = path.join(ICI, 'navigateur.json');
const faits = existsSync(sortieF) ? JSON.parse(readFileSync(sortieF, 'utf8')) : {};
const aFaire = Object.entries(sites).filter(([cip, v]) => !v.email && v.site && !(cip in faits));
console.log(`${aFaire.length} sites muets a ouvrir dans un vrai navigateur`);

const navigateur = await chromium.launch({ headless: true });
const ctx = await navigateur.newContext({ userAgent: UA, locale: 'fr-FR', viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// on ne telecharge ni images ni polices : plus rapide, et plus leger pour l'hebergeur
await page.route('**/*', (route) => {
  const t = route.request().resourceType();
  return ['image', 'media', 'font'].includes(t) ? route.abort() : route.continue();
});

let n = 0, ok = 0;
for (const [cip, v] of aFaire) {
  n++;
  const r = await lireSite(page, v.site);
  faits[cip] = { ...r, site: v.site };
  if (r.email) ok++;
  console.log(`  ${String(n).padStart(3)}/${aFaire.length} ${v.site.slice(0, 46).padEnd(48)} ${r.email || '—'}`);
  writeFileSync(sortieF, JSON.stringify(faits, null, 1));
  await dormir(1500);
}
await navigateur.close();

// le script relit ce qu'il a ecrit avant de dire que c'est fait
const verif = JSON.parse(readFileSync(sortieF, 'utf8'));
const avec = Object.values(verif).filter((v) => v.email).length;
console.log(`\nRESULTAT : ${avec} adresses lues sur ${Object.keys(verif).length} sites ouverts`);
