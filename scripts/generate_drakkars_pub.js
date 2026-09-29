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
const RELEVE = '2026-06-05'; // voir l'en-tête de crm/drakkars-data.js

const src = fs.readFileSync(SRC, 'utf8');
const DRAKKARS = new Function(src + '\nreturn DRAKKARS;')();

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

var out = {};
var n = 0, dup = 0, bad = 0, sansEan = 0, sansPrix = 0;
DRAKKARS.forEach(function (p) {
  if (p.ean == null) { sansEan++; return; }
  var e = ean13(p.ean);
  if (!e) { bad++; return; }
  if (!(p.prix > 0)) { sansPrix++; return; }
  if (out[e] != null) { dup++; return; } // garde le premier prix rencontré pour cet EAN
  out[e] = p.prix;
  n++;
});

var header =
  '// Prix PUBLICS (TTC) Pharmacie des Drakkars — pour l\'écran Offilog OPSO.\n' +
  '// Relevé du ' + RELEVE + ' (crm/drakkars-data.js) · généré par scripts/generate_drakkars_pub.js\n' +
  '// ' + n + ' EAN (sur ' + DRAKKARS.length + ' produits, ' + (DRAKKARS.length - sansEan) + ' avec EAN) — ' +
  bad + ' EAN illisibles ignorés, ' + dup + ' doublons gardés une fois, ' + sansPrix + ' sans prix.\n' +
  '// Prix PUBLICS d\'un concurrent : autorisés dans le dépôt public (ROBOT.md, brief 29/09/2026).\n';
var body = 'const DRAKKARS_PUB = ' + JSON.stringify(out) + ';\n' +
  'const DRAKKARS_PUB_MAJ = ' + JSON.stringify(RELEVE) + ';\n';

fs.writeFileSync(OUT, header + body);
console.log('OK : ' + n + ' prix Drakkars → ' + path.relative(ROOT, OUT) +
  ' (' + bad + ' EAN illisibles, ' + dup + ' doublons, ' + sansPrix + ' sans prix, ' + sansEan + ' sans EAN)');
