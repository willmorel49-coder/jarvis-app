#!/usr/bin/env node
/**
 * Offilog — meilleures ventes, scrape par NAVIGATEUR RÉEL (Playwright).
 *
 * Pourquoi Playwright et plus `requests` : le formulaire de connexion et la
 * liste sont rendus par du JavaScript. Un client HTTP simple récupère parfois
 * une page à moitié construite, sans jamais dire qu'elle est incomplète.
 *
 * ⚠️ Identifiants : JAMAIS ici. ~/.config/jarvis/offilog.json (hors dépôt).
 * ⚠️ Écrit DEUX fichiers :
 *      crm/v2/offilog-bestsellers-data.js  (PUBLIC — sans les prix B2B)
 *      crm/v2/offilog-best-prix.js         (PROTÉGÉ — à déposer sur Supabase,
 *                                           couvert par .gitignore)
 *    Ne jamais remettre les prix dans le premier : le dépôt est public.
 */
const { chromium } = require('/Users/williammorel/JARVIS/verif-ecran/node_modules/playwright');
const fs = require('fs'), path = require('path'), os = require('os');

const BASE = __dirname;
const OUT_PUB  = path.join(BASE, 'crm/v2/offilog-bestsellers-data.js');
const OUT_PRIX = path.join(BASE, 'crm/v2/offilog-best-prix.js');
const CFG = path.join(os.homedir(), '.config/jarvis/offilog.json');
const RPP = 100;            // 300 fait tomber la page en timeout, 100 passe
const MAX_PAGES = 120;      // garde-fou

function ids() {
  if (!fs.existsSync(CFG)) {
    console.error('Identifiants Offilog absents : ' + CFG);
    console.error('{"email":"...","password":"..."} — ne jamais les écrire dans le dépôt.');
    process.exit(1);
  }
  const c = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  if (!c.email || !c.password) { console.error('email/password manquants dans ' + CFG); process.exit(1); }
  return c;
}
const prix = t => {
  if (!t) return null;
  const m = String(t).replace(/ | |\s/g, '').match(/([\d]+[.,]\d{2})/);
  return m ? Math.round(parseFloat(m[1].replace(',', '.')) * 100) / 100 : null;
};

(async () => {
  const C = ids();
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
  const p = await ctx.newPage();

  // ── 1. Connexion, avec MARQUEUR POSITIF ───────────────────────────────
  await p.goto('https://offilog.fr/connexion?back=my-account', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(1200);
  await p.fill('input[name="email"]', C.email);
  await p.fill('input[name="password"]', C.password);
  await Promise.all([
    p.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {}),
    p.click('#submit-login button[type=submit], form#login-form button[type=submit], button[name="submitLogin"]')
  ]);
  await p.waitForTimeout(2500);
  const connecte = await p.evaluate(() => !!document.querySelector('a[href*="mylogout"], a[href*="deconnexion"]'));
  if (!connecte) { console.error('ÉCHEC CONNEXION — sans session, les prix B2B ne sont pas servis.'); process.exit(1); }
  console.log('Connexion OK (' + C.email + ')');

  // ── 2. Pagination ─────────────────────────────────────────────────────
  const vus = new Set(); const best = []; let rang = 0, total = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = 'https://offilog.fr/meilleures-ventes?resultsPerPage=' + RPP + '&page=' + page;
    let ok = false;
    for (let essai = 0; essai < 3 && !ok; essai++) {
      try { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); ok = true; }
      catch (e) { console.log('  relance lot ' + page + ' (' + e.name + ')'); await p.waitForTimeout(2000); }
    }
    if (!ok) { console.log('  lot ' + page + ' échoué 3x → passé'); continue; }
    await p.waitForTimeout(900);

    const lot = await p.evaluate(() => {
      // ⚠️ Le carrousel de la page pose des vignettes CLONÉES (slick-cloned) :
      // les compter ferait des doublons et fausserait le rang de vente.
      const arts = [...document.querySelectorAll('#js-product-list article')]
        .filter(a => !a.classList.contains('slick-cloned') && !a.closest('.slick-slider'));
      const tot = (document.querySelector('.pagination')||{}).innerText || '';
      return {
        total: tot,
        items: arts.map(a => {
          const lien = a.querySelector('a.product_name') || a.querySelector('a.product-thumbnail');
          const href = lien ? lien.getAttribute('href') || '' : '';
          const img = a.querySelector('img');
          const man = a.querySelector('.manufacturer a');
          const px = a.querySelector('.price');
          return {
            id: a.getAttribute('data-id-product'),
            name: lien ? (lien.getAttribute('title') || lien.textContent.trim()) : '',
            brand: man ? man.textContent.trim() : '',
            priceTxt: px ? px.textContent.trim() : '',
            img: img ? (img.getAttribute('data-full-size-image-url') || img.getAttribute('data-src') || img.getAttribute('src') || '') : '',
            url: href
          };
        })
      };
    });
    if (total === null) { const m = lot.total.match(/de\s+([\d\s ]+)\s+article/); total = m ? m[1].replace(/\D/g,'') : '?'; }

    let neufs = 0;
    for (const it of lot.items) {
      if (!it.id || vus.has(it.id)) continue;
      vus.add(it.id); rang++;
      const ean = (it.url.match(/(\d{13})/) || [])[1] || '';
      const cat = (it.url.match(/offilog\.fr\/([a-z0-9\-]+)\/\d+-/) || [])[1] || '';
      best.push({ rank: rang, id: it.id, name: it.name, brand: it.brand,
                  price: prix(it.priceTxt), ean, img: it.img, cat, url: it.url });
      neufs++;
    }
    console.log('  lot ' + page + ' : ' + lot.items.length + ' vus, ' + neufs + ' nouveaux → ' + best.length);
    if (neufs === 0) { console.log('  plus de nouveaux → fin'); break; }
  }
  await b.close();

  // ── 3. GARDE-FOU : un scrape qui ramène beaucoup moins qu'avant est SUSPECT
  const avant = fs.existsSync(OUT_PUB) ? (fs.readFileSync(OUT_PUB,'utf8').match(/"rank":/g)||[]).length : 0;
  console.log('TOTAL : ' + best.length + ' produits (annoncé par le site : ' + total + ' · précédent fichier : ' + avant + ')');
  if (avant && best.length < avant * 0.8) {
    console.error('ARRÊT : ' + best.length + ' produits contre ' + avant + ' avant (-' +
      Math.round((1 - best.length/avant)*100) + ' %). Un scrape amputé écraserait des données valides.');
    process.exit(1);
  }
  const sansPrix = best.filter(x => x.price == null).length;
  if (sansPrix > best.length * 0.1) {
    console.error('ARRÊT : ' + sansPrix + ' produits sans prix sur ' + best.length +
      '. Sans session, le site masque les prix B2B — on n\'écrase pas avec ça.');
    process.exit(1);
  }

  // ── 4. Séparation public / protégé ────────────────────────────────────
  const tarif = {};
  const pub = best.map(x => { const { price, ...r } = x; if (price != null) tarif[x.id] = price; return r; });
  const j = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(OUT_PUB,
    '// Offilog — Meilleures ventes — SANS LES PRIX B2B\n' +
    '// ' + pub.length + ' produits classés par ventes décroissantes · photo + EAN — ' + j + '\n' +
    '// ⚠️ Les prix B2B vivent dans offilog-best-prix.js, hors dépôt, servi par\n' +
    '// adresse signée. Ce fichier-ci part dans un dépôt PUBLIC — ne rien y remettre.\n' +
    'const OFFILOG_BEST = ' + JSON.stringify(pub) + ';\n' +
    'try{window.OFFILOG_BEST=OFFILOG_BEST;}catch(e){}\n');
  fs.writeFileSync(OUT_PRIX,
    '// Intégral Pharma — Offilog meilleures ventes, PRIX B2B\n' +
    '// ' + Object.keys(tarif).length + ' prix — ' + j + '\n' +
    '// ⚠️ NE JAMAIS COMMITER. Servi par adresse signée (Supabase).\n' +
    'const OFFILOG_BEST_PRIX = ' + JSON.stringify(tarif) + ';\n');

  // ── 5. Le contrôle qui tourne À CHAQUE FOIS, et qui échoue fort ───────
  const relu = fs.readFileSync(OUT_PUB, 'utf8');
  if (/"price":/.test(relu)) { console.error('ARRÊT : le fichier public contient encore des prix.'); process.exit(1); }
  console.log('✓ ' + OUT_PUB  + ' (' + Math.round(fs.statSync(OUT_PUB).size/1024) + ' Ko) — sans prix, vérifié');
  console.log('✓ ' + OUT_PRIX + ' (' + Math.round(fs.statSync(OUT_PRIX).size/1024) + ' Ko) — À DÉPOSER SUR SUPABASE, NE PAS COMMITER');
})();
