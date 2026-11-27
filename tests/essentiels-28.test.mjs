// 24/11/2026 (décision de Will) — Essentiels Pharma (ex-Le Gall Santé Services), un seul groupement.
// 27/11/2026 : la liste officielle du réseau (31 adhérents) fait foi — 3 retirées (Bouchemaine, Laval Murat, Éraudière), 6 ajoutées. Le nom du fichier reste « 28 ».
// On charge le code RÉEL (V2.reconcilePharma extrait de v2-app.js) avec la vraie base nationale, la vraie table d'alias
// et les vraies ventes (dont les clientes que le fichier de ventes range ailleurs), puis on compte.
// RACINE permet de pointer sur un autre dépôt (l'ancien code, pour prouver que le test échoue dessus).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const racine = process.env.RACINE || new URL('../', import.meta.url).pathname;
const lire = f => readFileSync(racine + 'crm/v2/' + f, 'utf8');
const CIP = '2132741 2132542 2132516 2263530 2024346 2247587 2132799 2000899 2024173 2279142 2252246 2041251 2126298 2134576 2090775 2024084 2225998 2133331 2053712 2128049 2183162 2138827 2188155 2271866 2022553 2192135 2000693 2080814 2023049 2016822 2247147'.split(' ');
const RETIREES = ['2279818', '2139108', '2125776'];   // Bouchemaine, Laval Murat, Éraudière : hors de la liste officielle

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

test('Essentiels Pharma = 31 officines, ancien nom fusionné', () => {
  assert.equal(new Set(CIP).size, 31);
  const D = charger();
  const parCip = {}; D.p.forEach(p => { parCip[String(p[13]).replace(/[^0-9]/g, '')] = p; });
  const hors = CIP.filter(c => !parCip[c] || D.grp[parCip[c][3]] !== 'Essentiels Pharma');
  assert.deepEqual(hors.map(c => c + ' -> ' + (parCip[c] ? D.grp[parCip[c][3]] : 'absent')), []);
  const noms = {}; D.p.forEach(p => { const g = D.grp[p[3]]; if (/gall|essentiel/i.test(g || '')) noms[g] = (noms[g] || 0) + 1; });
  assert.deepEqual(noms, { 'Essentiels Pharma': 31 });
  // exactement les 31 de la liste : ni plus (Bouchemaine est « ESSENTIEL PHARMA » dans la base nationale), ni moins
  const tous = Array.from(D.p).filter(p => D.grp[p[3]] === 'Essentiels Pharma').map(p => String(p[13]).replace(/[^0-9]/g, '')).sort();
  assert.deepEqual(tous, CIP.slice().sort());
});

test('les trois officines retirées de la liste ne sont plus Essentiels (Éraudière redevient Pharmacies COS)', () => {
  const D = charger();
  const parCip = {}; D.p.forEach(p => { parCip[String(p[13]).replace(/[^0-9]/g, '')] = p; });
  for (const c of RETIREES) assert.notEqual(D.grp[parCip[c][3]], 'Essentiels Pharma', c);
  assert.equal(D.grp[parCip['2279818'][3]], '—');
  assert.equal(D.grp[parCip['2125776'][3]], 'Pharmacies COS');
  const alias = lire('groupement-alias.js'), ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(alias, ctx);
  for (const c of RETIREES) assert.equal(ctx.GRP_DEPART[c], undefined, c + ' ne doit pas être dans GRP_DEPART (la tournée T10 et l\'app Essentiels en prennent les clés)');
});

test('les clientes que le fichier de ventes range ailleurs restent chez Essentiels', () => {
  const D = charger();
  const parCip = {}; D.p.forEach(p => { parCip[String(p[13]).replace(/[^0-9]/g, '')] = p; });
  for (const c of ['2128049', '2133331', '2022553', '2000693', '2126298', '2252246']) assert.equal(D.grp[parCip[c][3]], 'Essentiels Pharma', c);
});

test('une correction faite dans l\'app passe par-dessus la table de départ', () => {
  const alias = lire('groupement-alias.js');
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  ctx.GRP_OVR = { '2128049': 'Ensemble' };   // posée avant le chargement de l'alias : doit gagner
  vm.runInContext(alias, ctx);
  assert.equal(ctx.GRP_OVR['2128049'], 'Ensemble');
  assert.equal(ctx.GRP_OVR['2126298'], 'Essentiels Pharma');
});

// 24/11/2026 — l'écran Groupements lit V2.mapOfficines (fichier de ventes), pas la base nationale :
// la table de départ doit s'y appliquer aussi.
function chargerVentes(avant) {
  const app = lire('v2-app.js'), boot = lire('v2-boot.js');
  const a = app.indexOf('  V2.canonGrp = function'), b = app.indexOf('  V2.ensurePharmaFr = function');
  const c = boot.indexOf('  V2.mapOfficines = function'), d = boot.indexOf('  // ── Périmètre ESCALE PHARMA');
  assert.ok(a >= 0 && b > a && c >= 0 && d > c, 'structure inattendue');
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext('var V2 = {};', ctx);
  vm.runInContext(lire('pharma-fr-data.js'), ctx);
  if (avant) vm.runInContext(avant, ctx);
  vm.runInContext(lire('groupement-alias.js'), ctx);
  vm.runInContext(lire('wml-officines-data.js') + '\n;window.WML_OFFICINES = WML_OFFICINES;', ctx);
  vm.runInContext(app.slice(a, b), ctx); vm.runInContext(boot.slice(c, d), ctx);
  return ctx;
}
const grpDe = (ctx, id) => vm.runInContext('(function(){var p=V2.mapOfficines().filter(function(x){return x.id===' + JSON.stringify(id) + '})[0]; return V2.canonGrp(p.groupement);})()', ctx);

test('une cliente « Ensemble » dans le fichier de ventes sort « Essentiels Pharma » de mapOfficines', () => {
  const ctx = chargerVentes();
  for (const c of ['2128049', '2133331', '2022553', '2000693', '2041251']) assert.equal(grpDe(ctx, c), 'Essentiels Pharma', c);
});

test('une correction Supabase posée par-dessus gagne sur la table de départ', () => {
  const ctx = chargerVentes();
  // même geste que chargerOverrides / v2-profil.js : p.groupement posé APRÈS mapOfficines
  const p = vm.runInContext('V2.mapOfficines().filter(function(x){return x.id==="2128049";})[0]', ctx);
  p.groupement = 'Ensemble';
  assert.equal(vm.runInContext('V2.canonGrp("Ensemble")', ctx), 'Ensemble');
});

test('correction effacée dans la fiche : retour à la table de départ, pas au fichier de ventes', () => {
  const ctx = chargerVentes();
  const src = readFileSync(racine + 'crm/v2/v2-pharma.js', 'utf8');
  assert.match(src, /else if \(window\.GRP_DEPART && window\.GRP_DEPART\[_gid\]\) window\.GRP_OVR\[_gid\] = window\.GRP_DEPART\[_gid\]/);
  assert.match(src, /champ === 'groupement' && window\.GRP_DEPART/);
  assert.equal(ctx.GRP_DEPART['2128049'], 'Essentiels Pharma');
  assert.equal(ctx.GRP_OVR['2128049'], 'Essentiels Pharma');
});
