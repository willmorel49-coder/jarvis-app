#!/usr/bin/env node
// Génère crm/v2/drakkars-pub-data.js : {ean13: prix} — prix PUBLICS (TTC) de
// Pharmacie des Drakkars, pour l'écran Offilog OPSO. Un fichier LÉGER (id →
// prix), jamais les 4 Mo de crm/drakkars-data.js dans l'écran (ROBOT.md §11.6).
//
// Brief 29/09/2026 : « les prix de pharmacie des drakkars ». Relevé du
// 2026-06-05 (en-tête de crm/drakkars-data.js) — si scraper_drakkars.py est
// rejoué sans contourner d'anti-robot, relancer ce script avec la date à jour.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'crm/drakkars-data.js');
const OUT = path.join(ROOT, 'crm/v2/drakkars-pub-data.js');
// 30/09/2026 — source par défaut : le relevé COMPLET de scraper_drakkars_pub.py
// (toutes les fiches du plan de site, médicaments compris, CHAQUE contenance).
//   node scripts/generate_drakkars_pub.js <releve.jsonl> <AAAA-MM-JJ> [rattrapage.jsonl]
// Sans argument : l'ancien chemin (crm/drakkars-data.js, relevé du 2026-06-05).
const JSONL = process.argv[2] || null;
const RELEVE = JSONL ? process.argv[3] : '2026-06-05';
if (JSONL && !/^\d{4}-\d{2}-\d{2}$/.test(RELEVE || '')) { console.error('date du relevé attendue (AAAA-MM-JJ)'); process.exit(1); }

var DRAKKARS;
if (JSONL) {
  // Une ligne par fiche : {url, http, rows:[{ean, prix, dispo, …}]}. Un produit
  // momentanément en rupture garde son prix : c'est celui affiché sur le site.
  DRAKKARS = [];
  fs.readFileSync(JSONL, 'utf8').split('\n').forEach(function (l) {
    if (!l.trim()) return;
    var j = JSON.parse(l);
    (j.rows || []).forEach(function (r) { DRAKKARS.push({ ean: r.ean || null, prix: r.prix }); });
  });
  // 3e argument (facultatif) : rattrapage par la recherche du site
  // (scraper_drakkars_recherche.py) — EAN Offilog absents du relevé, retrouvés
  // comme ANCIEN code d'une fiche. Seul le cas SANS ambiguïté est gardé : un
  // seul produit Drakkars porte ce code. 30/09/2026 : 35 cas, contrôlés nom
  // contre nom avec Offilog.
  var RATTRAPAGE = process.argv[4] || null;
  if (RATTRAPAGE) {
    fs.readFileSync(RATTRAPAGE, 'utf8').split('\n').forEach(function (l) {
      if (!l.trim()) return;
      var r = JSON.parse(l);
      if (r.hits && r.hits.length === 1) DRAKKARS.push({ ean: r.ean, prix: Number(r.hits[0].price) });
    });
  }
} else {
  const src = fs.readFileSync(SRC, 'utf8');
  DRAKKARS = new Function(src + '\nreturn DRAKKARS;')();
}

// EAN à normaliser sur 13 chiffres (brief) : UPC-A (12) → préfixé d'un 0.
// Les longueurs aberrantes (5, 15, 29… mesurées le 29/09/2026, 10 cas sur
// 9 569) sont illisibles à coup sûr : on les ignore plutôt que d'inventer
// un rapprochement faux.
function ean13(v) {
  var s = String(v == null ? '' : v).replace(/\D/g, '');
  if (!s) return null;
  if (s.length === 12) s = '0' + s;
  if (s.length !== 13) return null;
  return s;
}

// L'écran ne sert que les produits Offilog : on ne garde que leurs EAN (même
// entrée que scraper_leclerc_pub.js). Sans ce filtre, 45 676 prix = 975 Ko.
const OFFILOG_EANS = new Set();
[[path.join(ROOT, 'crm/v2/offilog-bestsellers-data.js'), /"ean":\s*"(\d{12,13})"/g],
 [path.join(ROOT, 'opso/offilog-live-data.js'), /ean:'(\d{12,13})'/g]].forEach(function (x) {
  for (const m of fs.readFileSync(x[0], 'utf8').matchAll(x[1])) OFFILOG_EANS.add(ean13(m[1]));
});
var horsOffilog = 0;
var out = {};
var n = 0, dup = 0, bad = 0, sansEan = 0, sansPrix = 0;
DRAKKARS.forEach(function (p) {
  if (p.ean == null) { sansEan++; return; }
  var e = ean13(p.ean);
  if (!e) { bad++; return; }
  if (!(p.prix > 0)) { sansPrix++; return; }
  if (!OFFILOG_EANS.has(e)) { horsOffilog++; return; }
  if (out[e] != null) { dup++; return; } // garde le premier prix rencontré pour cet EAN
  out[e] = p.prix;
  n++;
});

var header =
  '// Prix PUBLICS (TTC) Pharmacie des Drakkars — pour l\'écran Offilog OPSO.\n' +
  '// Relevé du ' + RELEVE + ' (' + (JSONL ? 'scraper_drakkars_pub.py, toutes les fiches' : 'crm/drakkars-data.js') + ') · généré par scripts/generate_drakkars_pub.js\n' +
  '// ' + n + ' EAN (sur ' + DRAKKARS.length + (JSONL ? ' contenances' : ' produits') + ', ' + (DRAKKARS.length - sansEan) + ' avec EAN) — ' +
  bad + ' EAN illisibles ignorés, ' + dup + ' doublons gardés une fois, ' + sansPrix + ' sans prix, ' + horsOffilog + ' hors catalogues Offilog.\n' +
  '// Prix PUBLICS d\'un concurrent : autorisés dans le dépôt public (ROBOT.md, brief 29/09/2026).\n';
var body = 'const DRAKKARS_PUB = ' + JSON.stringify(out) + ';\n' +
  'const DRAKKARS_PUB_MAJ = ' + JSON.stringify(RELEVE) + ';\n';

// GARDE-FOU : un relevé bien plus maigre que le fichier en place veut dire que
// le site a changé ou nous bloque — on n'écrase pas un fichier valide.
var avant = fs.existsSync(OUT) ? (fs.readFileSync(OUT, 'utf8').match(/"\d{13}":/g) || []).length : 0;
if (avant && n < avant * 0.7) { console.error('ARRÊT : ' + n + ' prix contre ' + avant + ' avant.'); process.exit(1); }
fs.writeFileSync(OUT, header + body);
console.log('OK : ' + n + ' prix Drakkars → ' + path.relative(ROOT, OUT) +
  ' (' + bad + ' EAN illisibles, ' + dup + ' doublons, ' + sansPrix + ' sans prix, ' + sansEan + ' sans EAN)');
