/* comptoir-biosim.test.mjs — 06/11/2026. Panneau produit : biosimilaires REMBOURSÉS dans la marge pharmacien,
 * abandon au barème des princeps (Will, question cliquée : « Oui, barème princeps », panneau produit seul).
 * Données 100 % INVENTÉES, réponse connue d'avance. Vrai code : v2-comptoir.js entier, bloc de calcul de v2-pharma.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' attendu ' + b + ' ±' + tol + ', obtenu ' + a);
const nu = (x) => JSON.parse(JSON.stringify(x));
const sansBalise = (h) => String(h).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

const BIO = '3400900000022', BIO_NR = '3400900000033', BIO_CAT = '3400900000044', BIO_INC = '3400900000055', PRI = '3400900000011';
const REMB = { [BIO]: true, [BIO_CAT]: true, [BIO_NR]: false, [PRI]: true };   // BIO_INC : inconnu (null)

function bac() {
  const sb = { document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } }, console, setTimeout, clearTimeout, Promise };
  sb.window = sb; sb.globalThis = sb;
  sb.fetch = (url) => String(url).split('?')[0] === 'national.json'
    ? Promise.resolve({ ok: true, json: () => Promise.resolve({ generated: '2026-10-08', data: {} }) })
    : Promise.resolve({ ok: false, json: () => Promise.reject(new Error('404')) });
  vm.createContext(sb);
  vm.runInContext('window.V2 = {};', sb);
  vm.runInContext(readFileSync(new URL('../crm/v2/v2-comptoir.js', import.meta.url), 'utf8'), sb);
  const CAT = {};
  [[BIO, 'BIOSIM VENDU', 'biosim', 100, 100], [BIO_NR, 'BIOSIM NR', 'biosim', 100, 100], [BIO_CAT, 'BIOSIM CATALOGUE', 'biosim', 100, 100],
   [BIO_INC, 'BIOSIM INCONNU', 'biosim', 100, 100], [PRI, 'PRINCEPS', 'pr_mid', 100, 96.11]].forEach(([c, d, f, ppht, net]) => { CAT[c] = { c, cip: c, d, f, ppht, net, labo: '', mol: '' }; });
  sb.V2.produits = { catalogueIndex: () => CAT };
  sb.V2PRODUITS = { porteAbandon: (f) => String(f || '').indexOf('pr_') === 0, bareme: (p) => (p <= 4.33 ? 0.18 : p <= 468 ? Math.round(p * 0.0389 * 100) / 100 : 19.5) };
  sb.V2.estRemboursable = (c) => (c in REMB ? REMB[c] : null);
  sb.WML_SALES = []; sb.V2.ventesRestreintes = () => false; sb.V2.estReste = () => false;
  // Réseau : BIO vendu à 96,00 € net (abandon réel 4,00 €) ; BIO_NR vendu au même prix ; BIO_CAT jamais vendu (catalogue seul).
  sb.PROD_STATS = [{ c: BIO, d: 'BIOSIM VENDU', f: 'biosim', ppht: 100, net: 96 }, { c: BIO_NR, d: 'BIOSIM NR', f: 'biosim', ppht: 100, net: 96 },
                   { c: PRI, d: 'PRINCEPS', f: 'pr_mid', ppht: 100, net: 96.11 }];
  return sb;
}

test('calcul pur : un biosimilaire remboursé a une marge pharmacien (réglementée + abandon), comme un princeps', () => {
  const K = bac().V2.comptoir._calc, pf = K.pfhtDepuisPpht(100, false);
  const b = nu(K.margePharmacien('biosim', pf, 3.89, true)), p = nu(K.margePharmacien('pr_mid', pf, 3.89));
  assert.equal(b.applicable, true);
  near(b.total26, p.total26, 1e-9, 'même total qu\'un princeps au même prix');
  near(b.total26, K.margeOfficine(pf) + 3.89, 1e-9);
  ['gen', 'nr'].forEach((f) => assert.deepEqual(nu(K.margePharmacien(f, pf, 1, true)), { applicable: false }, f));
  [false, null, undefined].forEach((r) => assert.deepEqual(nu(K.margePharmacien('biosim', pf, 1, r)), { applicable: false }, 'biosim remb=' + r));
  assert.equal(nu(K.margeAuPrix('biosim', pf, 3.89, 50, true)).applicable, true, 'nouveau prix JO : la règle suit');
  assert.equal(nu(K.margeAuPrix('biosim', pf, 3.89, 50)).applicable, false);
});

test('vrai chemin des lignes : abandon réel si vendu, barème si catalogue seul, rien si NR ou inconnu', async () => {
  const sb = bac(), C = sb.V2.comptoir, K = C._calc;
  await C.chargerNational();
  const d = K.donnees();
  assert.ok(d && d.parCip, 'lignes construites');
  const L = (c) => d.parCip[c];
  near(L(BIO).ab, 4, 1e-9, 'vendu : PPHT − net réseau'); assert.equal(L(BIO).remb, true); near(L(BIO).net, 96, 1e-9);
  near(L(BIO_CAT).ab, 3.89, 1e-9, 'catalogue seul : barème princeps'); near(L(BIO_CAT).net, 96.11, 1e-9); near(L(BIO_CAT).prix, 96.11, 1e-9);
  assert.equal(L(BIO_NR).ab, null, 'biosimilaire non remboursable : aucun abandon'); assert.equal(L(BIO_NR).remb, false);
  assert.equal(L(BIO_INC).ab, null, 'remboursement inconnu : aucun abandon'); near(L(BIO_INC).net, 100, 1e-9);
  near(L(PRI).ab, 3.89, 1e-9, 'princeps inchangé'); assert.equal(L(PRI).remb, null);
  const s = nu(C.stats(L(BIO), { mois: [1] }));
  assert.equal(s.margePharmacien.applicable, true); near(s.margePharmacien.abandon26, 4, 1e-9);
  assert.equal(nu(C.stats(L(BIO_NR), { mois: [1] })).margePharmacien.applicable, false);
});

test('textes de la tuile : biosimilaire remboursé, inconnu, non remboursable', async () => {
  const sb = bac(), C = sb.V2.comptoir, K = C._calc;
  await C.chargerNational();
  const d = K.donnees(), t = (c) => sansBalise(K.tuileMargePharmacien(C.stats(d.parCip[c], { mois: [1] }), false));
  assert.match(t(BIO), /Le pharmacien gagne/); assert.match(t(BIO), /Par boîte, biosimilaire remboursé\./);
  assert.doesNotMatch(t(BIO), /Aucun abandon de marge/);
  assert.match(t(BIO_INC), /Remboursement de ce biosimilaire inconnu : marge non calculée\./);
  assert.match(t(BIO_NR), /Calculée pour les princeps et les biosimilaires remboursés \(ni générique, ni produit non remboursable\)\./);
  assert.match(t(PRI), /Par boîte, princeps remboursable\./);
  assert.doesNotMatch(readFileSync(new URL('../crm/v2/v2-comptoir.js', import.meta.url), 'utf8'), /ni biosimilaire/);
});

test('V2.estRemboursable (v2-pharma.js) : règle de la fiche, et null tant que BENCHMARK ou Sagitta manquent', () => {
  const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
  const a = src.indexOf('  var _benchIdx = null;'), b = src.indexOf('  // ── Fusion OPS + CPR + HP par CIP');
  assert.ok(a > 0 && b > a, 'bloc introuvable');
  const V2 = {}, win = {};
  new Function('V2', 'window', src.slice(a, b))(V2, win);
  assert.equal(V2.estRemboursable(BIO), null, 'rien de chargé : inconnu');
  win.BENCHMARK = [{ cip13: BIO, has_ameli: true }, { cip13: BIO_NR, has_ameli: false }, { cip13: BIO_CAT, has_ameli: true }];
  assert.equal(V2.estRemboursable(BIO), null, 'Sagitta pas encore là : inconnu, et l\'index n\'est pas figé');
  win.SAGITTA_SHORTLIST = [{ cip13: BIO_CAT }];
  assert.equal(V2.estRemboursable(BIO), true);
  assert.equal(V2.estRemboursable(BIO_NR), false, 'has_ameli false');
  assert.equal(V2.estRemboursable(BIO_CAT), false, 'sur la liste NR Sagitta');
  assert.equal(V2.estRemboursable(BIO_INC), false, 'absent du BENCHMARK');
});
