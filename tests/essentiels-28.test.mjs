// 24/11/2026 (décision de Will) — Essentiels Pharma (ex-Le Gall Santé Services) = 28 officines, un seul groupement.
// On charge le code RÉEL (V2.reconcilePharma extrait de v2-app.js) avec la vraie base nationale, la vraie table d'alias
// et les vraies ventes (dont les 4 clientes que le fichier de ventes range ailleurs), puis on compte.
// RACINE permet de pointer sur un autre dépôt (l'ancien code, pour prouver que le test échoue dessus).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const racine = process.env.RACINE || new URL('../', import.meta.url).pathname;
const lire = f => readFileSync(racine + 'crm/v2/' + f, 'utf8');
const CIP = '2090775 2126298 2128049 2252246 2132542 2279818 2132741 2263530 2024346 2247587 2132799 2132516 2000899 2134576 2133331 2279142 2024084 2183162 2192135 2053712 2041251 2225998 2022553 2024173 2188155 2125776 2138827 2139108'.split(' ');

function charger() {
  const app = lire('v2-app.js');
  const a = app.indexOf('  V2.canonGrp = function'), b = app.indexOf('  V2.ensurePharmaFr = function');
  assert.ok(a >= 0 && b > a, 'structure de v2-app.js inattendue');
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext('var V2 = {};', ctx);
  vm.runInContext(lire('pharma-fr-data.js'), ctx);
  vm.runInContext(lire('groupement-alias.js'), ctx);
  vm.runInContext(lire('wml-officines-data.js') + '\n;window.WML_OFFICINES = WML_OFFICINES;', ctx);
  vm.runInContext(app.slice(a, b), ctx);
  vm.runInContext('V2.reconcilePharma();', ctx);
  return ctx.PHARMA_FR;
}

test('Essentiels Pharma = 28 officines, ancien nom fusionné', () => {
  assert.equal(new Set(CIP).size, 28);
  const D = charger();
  const parCip = {}; D.p.forEach(p => { parCip[String(p[13]).replace(/[^0-9]/g, '')] = p; });
  const hors = CIP.filter(c => !parCip[c] || D.grp[parCip[c][3]] !== 'Essentiels Pharma');
  assert.deepEqual(hors.map(c => c + ' -> ' + (parCip[c] ? D.grp[parCip[c][3]] : 'absent')), []);
  const noms = {}; D.p.forEach(p => { const g = D.grp[p[3]]; if (/gall|essentiel/i.test(g || '')) noms[g] = (noms[g] || 0) + 1; });
  assert.deepEqual(noms, { 'Essentiels Pharma': 28 });
});

test('les clientes que le fichier de ventes range ailleurs restent chez Essentiels', () => {
  const D = charger();
  const parCip = {}; D.p.forEach(p => { parCip[String(p[13]).replace(/[^0-9]/g, '')] = p; });
  for (const c of ['2128049', '2133331', '2022553', '2125776', '2126298', '2252246']) assert.equal(D.grp[parCip[c][3]], 'Essentiels Pharma', c);
});

test('une correction faite dans l\'app passe par-dessus la table de départ', () => {
  const alias = lire('groupement-alias.js');
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  ctx.GRP_OVR = { '2128049': 'Ensemble' };   // posée avant le chargement de l'alias : doit gagner
  vm.runInContext(alias, ctx);
  assert.equal(ctx.GRP_OVR['2128049'], 'Ensemble');
  assert.equal(ctx.GRP_OVR['2126298'], 'Essentiels Pharma');
});
