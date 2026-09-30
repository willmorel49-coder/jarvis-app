// Produits que le fichier prix du grossiste range en « générique » (PROD_STATS.f === 'gen')
// alors que le RÉPERTOIRE DES GÉNÉRIQUES de l'ANSM (BDPM) ne les y met pas : hors répertoire
// (Spagulax, Permixon…) ou inscrits comme princeps (Nicopatchlib).
// → opso/v2/opso-nongen-data.js (PUBLIC : une liste de CIP, rien d'autre).
// Le catalogue OPSO les range dans « Médicaments remboursables » au lieu de « Génériques ».
// Un CIP absent de la BDPM n'est PAS déplacé : un contrôle impossible ne condamne rien.
//
// Usage : node generate_opso_nongen.mjs [dossier BDPM, défaut ~/bdpm-historique/data]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const racine = path.dirname(new URL(import.meta.url).pathname);
const bdpm = process.argv[2] || path.join(os.homedir(), 'bdpm-historique/data');
const lignes = f => fs.readFileSync(path.join(bdpm, f), 'latin1').split('\n').map(l => l.split('\t'));

const cip2cis = {};
for (const r of lignes('CIS_CIP_bdpm.txt')) if (r[6]) cip2cis[r[6].trim()] = r[0].trim();
const types = {};                                  // CIS → types du répertoire (0 princeps, 1/2/4 génériques)
for (const r of lignes('CIS_GENER_bdpm.txt')) if (r[2]) (types[r[2].trim()] ||= new Set()).add((r[3] || '').trim());
if (Object.keys(cip2cis).length < 10000 || Object.keys(types).length < 5000) throw new Error('BDPM incomplète dans ' + bdpm);

const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(racine, 'crm/v2/prod-stats-data.js'), 'utf8'), ctx);
const nonGen = [], bilan = { generique: 0, hors: 0, princeps: 0, inconnu: 0 };
for (const p of ctx.window.PROD_STATS) {
  if (p.f !== 'gen') continue;
  const cis = cip2cis[p.c];
  if (!cis) { bilan.inconnu++; continue; }
  const t = types[cis];
  if (t && [...t].some(x => x !== '0')) { bilan.generique++; continue; }
  bilan[t ? 'princeps' : 'hors']++; nonGen.push(p.c);
}
const meta = JSON.parse(fs.readFileSync(path.join(bdpm, '.bdpm_meta.json'), 'utf8'));
const out = '// CIP rangés « générique » par le grossiste mais pas par le répertoire ANSM — generate_opso_nongen.mjs\n'
  + '// PUBLIC : une liste de CIP, rien d\'autre. BDPM du ' + meta.updated_at.slice(0, 10) + '.\n'
  + 'window.OPSO_NONGEN = ' + JSON.stringify(nonGen.sort()) + ';\n';
fs.writeFileSync(path.join(racine, 'opso/v2/opso-nongen-data.js'), out);
console.log('opso/v2/opso-nongen-data.js —', nonGen.length, 'CIP déplacés ·', JSON.stringify(bilan));
