#!/usr/bin/env node
/**
 * E.Leclerc — PRIX PUBLICS de la parapharmacie, par l'API JSON du site.
 * Prix de vente au public : donnée publique, le fichier de sortie reste
 * dans le dépôt. Aucun compte, aucun identifiant.
 *
 * Entrée : les EAN des deux catalogues Offilog déjà dans le dépôt.
 * Sortie : crm/v2/leclerc-pub-data.js  (ean -> [prix, prix_barré|0])
 */
const fs = require('fs'), path = require('path');
const BASE = __dirname;
const OUT = path.join(BASE, 'crm/v2/leclerc-pub-data.js');
const API = 'https://www.e.leclerc/api/rest/live-api/stores/0100-0000/products-details-by-skus';
const H = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*', 'Referer': 'https://www.e.leclerc/cat/parapharmacie' };

function eansDesCatalogues() {
  const s1 = fs.readFileSync(path.join(BASE,'crm/v2/offilog-bestsellers-data.js'),'utf8');
  const s2 = fs.readFileSync(path.join(BASE,'opso/offilog-live-data.js'),'utf8');
  const set = new Set();
  for (const m of s1.matchAll(/"ean":\s*"(\d{13})"/g)) set.add(m[1]);
  for (const m of s2.matchAll(/ean:'(\d{13})'/g)) set.add(m[1]);
  return [...set];
}

(async () => {
  const eans = eansDesCatalogues();
  console.log('EAN à interroger : ' + eans.length);
  const tarif = {}; let vus = 0, erreurs = 0;
  for (let i = 0; i < eans.length; i += 20) {
    const lot = eans.slice(i, i + 20);
    const u = API + '?' + lot.map(e => 'skus=' + e).join('&');
    let ok = false;
    for (let essai = 0; essai < 3 && !ok; essai++) {
      try {
        const r = await fetch(u, { headers: H });
        if (r.status !== 200) throw new Error('HTTP ' + r.status);
        const prods = await r.json();
        for (const prod of prods) {
          for (const v of prod.variants || []) {
            const ean = ((v.attributes||[]).find(a => a.code === 'ean') || {}).value || prod.sku || '';
            const off = (v.offers || [])[0];
            if (!ean || !off) continue;
            const prix = Math.round(off.basePrice.price.price) / 100;
            let barre = 0;
            for (const o of v.offers) for (const af of o.additionalFields || [])
              if (af.code === 'strikethrough-price') barre = Math.round(parseFloat(af.value)) / 100;
            tarif[ean] = [prix, barre];
          }
        }
        ok = true;
      } catch (e) { await new Promise(r => setTimeout(r, 2500)); }
    }
    if (!ok) erreurs++;
    vus += lot.length;
    if ((i / 20) % 25 === 0) console.log('  ' + vus + '/' + eans.length + ' → ' + Object.keys(tarif).length + ' prix' + (erreurs ? ' · ' + erreurs + ' lots en échec' : ''));
    await new Promise(r => setTimeout(r, 350));
  }
  const n = Object.keys(tarif).length;
  console.log('TOTAL : ' + n + ' prix publics Leclerc · lots en échec : ' + erreurs);

  // GARDE-FOU : un résultat quasi vide veut dire que l'API a changé ou nous
  // bloque — on n'écrase pas un fichier valide avec du vide.
  const avant = fs.existsSync(OUT) ? (fs.readFileSync(OUT,'utf8').match(/"\d{13}":/g)||[]).length : 0;
  if (avant && n < avant * 0.7) { console.error('ARRÊT : ' + n + ' prix contre ' + avant + ' avant.'); process.exit(1); }
  if (!avant && n < 500) { console.error('ARRÊT : seulement ' + n + ' prix — API changée ou bloquée.'); process.exit(1); }

  const j = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(OUT,
    '// E.Leclerc parapharmacie — PRIX PUBLICS (TTC) — ' + j + '\n' +
    '// ' + n + ' EAN · relevé par l\'API du site, sans compte. Donnée publique.\n' +
    '// ean -> [prix, prix_barré|0]\n' +
    'const LECLERC_PUB = ' + JSON.stringify(tarif) + ';\n' +
    'try{window.LECLERC_PUB=LECLERC_PUB;}catch(e){}\n');
  console.log('✓ ' + OUT + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' Ko)');
})();
