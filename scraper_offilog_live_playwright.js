#!/usr/bin/env node
/**
 * Offilog — catalogue live par catégorie, scrape par NAVIGATEUR RÉEL.
 * ⚠️ Identifiants hors dépôt (~/.config/jarvis/offilog.json).
 * ⚠️ Écrit TROIS fichiers :
 *      opso/offilog-live-data.js              (PUBLIC — sans les prix B2B)
 *      essentiels-pharma/offilog-live-data.js (idem, copie)
 *      offilog-live-prix.js                   (PROTÉGÉ — Supabase, .gitignore)
 */
const { chromium } = require('/Users/williammorel/JARVIS/verif-ecran/node_modules/playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const BASE = __dirname;
const CATS = JSON.parse(fs.readFileSync('/tmp/cats.json', 'utf8'));
const OUT = [path.join(BASE,'opso/offilog-live-data.js'), path.join(BASE,'essentiels-pharma/offilog-live-data.js')];
const OUT_PRIX = path.join(BASE, 'offilog-live-prix.js');
const CFG = path.join(os.homedir(), '.config/jarvis/offilog.json');
const RPP = 100;

const q = s => String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');
const prix = t => { if(!t) return null;
  const m = String(t).replace(/ | |\s/g,'').match(/([\d]+[.,]\d{2})/);
  return m ? Math.round(parseFloat(m[1].replace(',','.'))*100)/100 : null; };

(async () => {
  if (!fs.existsSync(CFG)) { console.error('Identifiants absents : '+CFG); process.exit(1); }
  const C = JSON.parse(fs.readFileSync(CFG,'utf8'));
  const b = await chromium.launch({ channel:'chrome' });
  const ctx = await b.newContext({ viewport:{width:1440,height:1200} });
  const p = await ctx.newPage();
  await p.goto('https://offilog.fr/connexion?back=my-account',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(1200);
  await p.fill('input[name="email"]', C.email);
  await p.fill('input[name="password"]', C.password);
  await Promise.all([p.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{}),
    p.click('#submit-login button[type=submit], form#login-form button[type=submit], button[name="submitLogin"]')]);
  await p.waitForTimeout(2500);
  if (!await p.evaluate(()=>!!document.querySelector('a[href*="mylogout"]'))) {
    console.error('ÉCHEC CONNEXION — sans session, pas de prix B2B.'); process.exit(1); }
  console.log('Connexion OK (' + C.email + ')');

  const vus = new Map();
  // rayon FIN par produit : un libellé de sous-rayon écrase le rayon parent
  // (les enfants sont visités après leur parent), jamais l'inverse.
  const TOP = new Set(['Santé','Beauté & Soins','Hygiène','Bébé','Vétérinaire','Solaire','Coffrets & Cadeaux','Promotions','Nouveautés']);
  const rayonFin = {};
  for (const cat of CATS) {
    let n0 = vus.size;
    for (let page = 1; page <= 40; page++) {
      const url = cat.url + '?resultsPerPage=' + RPP + '&page=' + page;
      let ok=false;
      for (let e=0;e<2&&!ok;e++){ try{ await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000}); ok=true; }catch(x){ await p.waitForTimeout(1500); } }
      if(!ok) break;
      await p.waitForTimeout(700);
      const lot = await p.evaluate(() => [...document.querySelectorAll('#js-product-list article')]
        .filter(a=>!a.classList.contains('slick-cloned') && !a.closest('.slick-slider'))
        .map(a=>{ const l=a.querySelector('a.product_name')||a.querySelector('a.product-thumbnail');
          const img=a.querySelector('img'), man=a.querySelector('.manufacturer a'), px=a.querySelector('.price');
          const barre=a.querySelector('.regular-price, .product-discount .regular-price');
          return { id:a.getAttribute('data-id-product'),
            nom:l?(l.getAttribute('title')||l.textContent.trim()):'',
            marque:man?man.textContent.trim():'',
            prixTxt:px?px.textContent.trim():'', barreTxt:barre?barre.textContent.trim():'',
            promo:!!a.querySelector('.product-flag.discount, .discount-percentage'),
            url:l?(l.getAttribute('href')||''):'',
            img:img?(img.getAttribute('data-full-size-image-url')||img.getAttribute('data-src')||img.getAttribute('src')||''):'' }; }));
      let neufs=0;
      for (const it of lot) {
        if (it.id) {
          if (!TOP.has(cat.label)) rayonFin[it.id] = cat.label;
          else if (!(it.id in rayonFin)) rayonFin[it.id] = cat.label;
        }
        if(!it.id||vus.has(it.id)) continue;
        it.cat = cat.label;
        it.ean = (it.url.match(/(\d{13})/)||[])[1] || '';
        vus.set(it.id, it); neufs++; }
      if (neufs === 0) break;
    }
    console.log('  ' + cat.label.padEnd(28) + (vus.size - n0) + ' nouveaux → ' + vus.size);
  }
  await b.close();

  const items = [...vus.values()];
  const avant = fs.existsSync(OUT[0]) ? (fs.readFileSync(OUT[0],'utf8').match(/^  \{id:/gm)||[]).length : 0;
  console.log('TOTAL : ' + items.length + ' produits (précédent : ' + avant + ')');
  if (avant && items.length < avant*0.8) {
    console.error('ARRÊT : ' + items.length + ' contre ' + avant + ' avant. Un scrape amputé écraserait des données valides.');
    process.exit(1); }
  const sansPrix = items.filter(x=>prix(x.prixTxt)==null).length;
  if (sansPrix > items.length*0.1) {
    console.error('ARRÊT : ' + sansPrix + ' sans prix sur ' + items.length + ' — session probablement perdue.'); process.exit(1); }

  const tarif = {}; const lignes = [];
  for (const it of items) {
    const pv = prix(it.prixTxt); if (pv != null) tarif[it.id] = pv;
    const pb = prix(it.barreTxt);
    lignes.push("  {id:'"+q(it.id)+"',nom:'"+q(it.nom)+"',marque:'"+q(it.marque)+"',cat:'"+q(it.cat)+
      "',ean:'"+q(it.ean)+"',prix_barre:"+(pb==null?'null':pb)+",promo:"+(it.promo?'true':'false')+
      ",url:'"+q(it.url)+"',img:'"+q(it.img)+"'}");
  }
  const j = new Date().toISOString().slice(0,10);
  const contenu = '// Catalogue Offilog live — ' + j + ' — SANS LES PRIX B2B\n' +
    '// ' + items.length + ' produits · offilog.fr\n' +
    '// ⚠️ Les prix B2B vivent dans offilog-live-prix.js, hors dépôt, servi par\n' +
    '// adresse signée. Ce fichier-ci part dans un dépôt PUBLIC — ne rien y remettre.\n' +
    'const OFFILOG_LIVE = [\n' + lignes.join(',\n') + '\n];\n';
  for (const o of OUT) fs.writeFileSync(o, contenu);
  fs.writeFileSync(OUT_PRIX,
    '// Intégral Pharma — Offilog catalogue live, PRIX B2B\n// ' + Object.keys(tarif).length + ' prix — ' + j +
    '\n// ⚠️ NE JAMAIS COMMITER. Servi par adresse signée (Supabase).\n' +
    'const OFFILOG_LIVE_PRIX = ' + JSON.stringify(tarif) + ';\n');
  // le rayon fin de chaque produit — du rangement, pas du tarif : public
  const nbFins = Object.keys(rayonFin).length;
  fs.writeFileSync(path.join(BASE,'crm/v2/offilog-cats-data.js'),
    '// Offilog — RAYON FIN de chaque produit (id -> libellé), relevé sur le site.\n' +
    '// ' + nbFins + ' produits — ' + j + '. Du rangement, pas du tarif : public.\n' +
    'const OFFILOG_CATS = ' + JSON.stringify(rayonFin) + ';\n' +
    'try{window.OFFILOG_CATS=OFFILOG_CATS;}catch(e){}\n');
  console.log('✓ rayons fins : ' + nbFins + ' produits');
  if (/,prix:[0-9]/.test(contenu)) { console.error('ARRÊT : prix encore présents dans le fichier public.'); process.exit(1); }
  console.log('✓ public  : ' + Math.round(contenu.length/1024) + ' Ko ×2 — sans prix, vérifié');
  console.log('✓ protégé : ' + Math.round(fs.statSync(OUT_PRIX).size/1024) + ' Ko, ' + Object.keys(tarif).length + ' prix — NE PAS COMMITER');
})();
