// Smoke test du CRM Jarvis : charge la page dans un vrai navigateur (headless),
// vérifie que le shell s'affiche et qu'AUCUNE erreur JS non gérée ne survient au
// démarrage. Les erreurs réseau (Supabase 401/404 sans auth) sont ignorées : on
// ne teste que les vrais bugs de code, pas la connectivité.
import { chromium, webkit } from 'playwright';

const PORT = process.env.PORT || 8080;
const url = `http://localhost:${PORT}/crm/v2/index.html`;

// Moteur choisi par BROWSER (chromium par défaut, webkit = le moteur de Safari, 23/10/2026).
const moteur = (process.env.BROWSER || 'chromium') === 'webkit' ? webkit : chromium;
console.log('Moteur : ' + (process.env.BROWSER || 'chromium'));
const browser = await moteur.launch();
const page = await browser.newPage();

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e && e.message ? e.message : String(e)));

let loadOk = true;
try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
} catch (e) {
  loadOk = false;
  console.error('❌ La page ne charge pas : ' + e.message);
}

await page.waitForTimeout(3500); // laisse le boot + le 1er rendu se faire

const rendered = loadOk ? await page.evaluate(() => {
  const root = document.querySelector('#app') || document.body;
  return !!(root && root.textContent && root.textContent.trim().length > 20);
}) : false;

await browser.close();

if (!loadOk) process.exit(1);
if (pageErrors.length) {
  console.error('❌ Erreur(s) JS non gérée(s) au chargement :\n - ' + pageErrors.join('\n - '));
  process.exit(1);
}
if (!rendered) {
  console.error('❌ Écran blanc : l\'app ne rend rien.');
  process.exit(1);
}
console.log('✅ Smoke OK — l\'app charge, le shell s\'affiche, aucune erreur JS non gérée.');
