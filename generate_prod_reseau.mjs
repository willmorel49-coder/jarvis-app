// Nombre de pharmacies du RÉSEAU Intégral qui commandent chaque produit (CIP) + la période.
// → crm/v2/prod-reseau-data.js (PUBLIC : ni prix, ni condition, ni chiffre par pharmacie).
//
// Pourquoi un fichier à part : PROD_STATS.n (prod-stats-data.js) est périmé — il est
// calculé par generate_prod_stats.py sur des crm/v2/wml-ventes-*.js qui ne sont plus
// dans le dépôt (Kardégic 75 : 509 dans le fichier, bien plus sur les tranches du jour).
// Et le compte OPSO ne peut pas recompter le réseau : il ne reçoit que ses adhérents.
//
// Source : les tranches PROTÉGÉES (wml-officines-data.js + wml-ventes-NN.js), copiées en
// lecture hors du dépôt. Usage : node generate_prod_reseau.mjs <dossier des tranches>
// Règle : une pharmacie compte pour un produit si elle en a commandé au moins une boîte
// sur la période (lignes de retour et lignes « reste du réseau » — rang < 0 — exclues).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dir = process.argv[2];
if (!dir) { console.error('usage : node generate_prod_reseau.mjs <dossier des tranches protégées>'); process.exit(1); }
const ctx = { window: {} }; vm.createContext(ctx);
const lire = f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
lire('wml-officines-data.js');
const W = ctx.window, N = W.WML_TRANCHES;
if (!N || !W.WML_D_PRODUITS || !W.WML_MOIS) throw new Error('wml-officines-data.js incomplet');
for (let i = 1; i <= N; i++) lire('wml-ventes-' + String(i).padStart(2, '0') + '.js');

const ph = new Map(), mois = new Set(), officines = new Set();
for (const s of W.WML_SALES) {                 // [rangOfficine, mois, rangCommercial, rangProduit, qte, puNet, mnt]
  if (s[0] < 0 || !(s[4] > 0)) continue;
  const cip = W.WML_D_PRODUITS[s[3]];
  if (!cip) continue;
  if (!ph.has(cip)) ph.set(cip, new Set());
  ph.get(cip).add(s[0]); mois.add(s[1]); officines.add(s[0]);
}
// La période se LIT dans les données (WML_MOIS) et se recoupe avec les mois réellement présents.
const m = W.WML_MOIS.map(x => x.split('-').map(Number));
const annee = m[0][0], de = m[0][1], a = m[m.length - 1][1];
const presents = [...mois].sort((x, y) => x - y);
if (presents[0] !== de || presents[presents.length - 1] !== a) throw new Error('WML_MOIS ≠ mois des ventes : ' + W.WML_MOIS + ' / ' + presents);

const n = {};
[...ph].map(([c, e]) => [c, e.size]).filter(([, k]) => k >= 2).sort((x, y) => y[1] - x[1]).forEach(([c, k]) => { n[c] = k; });
const out = '// Nombre de pharmacies du réseau Intégral qui commandent chaque produit — generate_prod_reseau.mjs\n'
  + '// PUBLIC : CIP → nombre de pharmacies (≥ 2). Ni prix, ni condition, ni chiffre par pharmacie.\n'
  + 'window.PROD_RESEAU = ' + JSON.stringify({
    periode: { annee, de, a }, officines: officines.size, empreinte: W.WML_TRANCHES_EMPREINTE, n,
  }) + ';\n';
const cible = path.join(path.dirname(new URL(import.meta.url).pathname), 'crm/v2/prod-reseau-data.js');
fs.writeFileSync(cible, out);
console.log(cible, '—', Object.keys(n).length, 'produits,', officines.size, 'officines, période', annee, de + '→' + a,
  '— Kardégic 75 :', n['3400934744198']);
