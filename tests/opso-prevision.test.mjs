// « Prévision du contrat » OPSO (19/11/2026) : moteur (opso-prevision-moteur.js) et mois complets (opso-remuneration.js).
// ⚠️ Plan INVENTÉ pour le test : le vrai plan est confidentiel et ne vit jamais dans le dépôt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const lire = (f) => readFileSync(join(RACINE, f), 'utf8');

// ── moteur, plan fictif : 3 crans, 2 quadrimestres de 6 mois ──
const creer = (() => { const c = { Intl, Math, performance, module: { exports: null } }; c.globalThis = c; vm.createContext(c); vm.runInContext(lire('opso/v2/opso-prevision-moteur.js'), c); return c.OPSO_PREVISION_MOTEUR; })();
const PLAN = {
  plan: { P0: 10, CAP: 100, NEUF: 2, LIV: 1, COUT: 10, PRIME: 5,
    SEUILS: [[0, 100, 200], [0, 150, 300]], TAUX: [0.01, 0.02, 0.03], BUD: [100, 200], CATT: [100, 200], MARG: [20, 40],
    quads: [{ de: 1, a: 6, nom: 'A 2030', echeance: 'x' }, { de: 7, a: 12, nom: 'B 2030', echeance: 'y' }] },
  detail: { lignes: [{ p: 'P', r: 'R', n: 10, mb: 1, case: 'c', rfa: true, hors: '', rm: 1, ra: 3, na: 5 }], autres: { ca: 5, retenu: 5, marge: 1, produits: 1 }, phMois2026: 1, cat2026: { ca: 1 }, reseau: { pharmacies: 9, mois: 10 }, paliers: [] },
  base2026: { mois: [], annee: 2029, parPharma: 1 }, annee: 2030
};
const M = creer(PLAN);

test('rfa : chaque taux ne porte que sur la part au-dessus du seuil du quadrimestre', () => {
  // 6 mois, seuils/mois 100 et 200 -> bornes 600 et 1200 ; x = 1000
  assert.equal(M.rfa(1000, 6, [0, 100, 200], [0.01, 0.02, 0.03]), 1000 * 0.01 + 400 * 0.01);
  assert.equal(M.cranDe(1000, 6, [0, 100, 200]), 1);
  assert.equal(M.cranDe(1300, 6, [0, 100, 200]), 2);
});

test('année sans mois réel : départ, rythme, plafond et seuils propres à chaque quadrimestre', () => {
  const o = M.defauts(); const A = M.annee(o, []);
  assert.equal(A.mois.length, 12);
  assert.equal(A.mois[0].fin, 12);               // 10 au départ + 2 par mois
  assert.equal(A.quads.length, 2);
  assert.equal(A.quads[0].ca, A.mois.slice(0, 6).reduce((s, m) => s + m.ca, 0));
  const o2 = M.defauts(); o2.seuils[1][1] = 1;   // un seuil modifié dans le 2e quadrimestre ne change que lui
  const B = M.annee(o2, []);
  assert.equal(B.quads[0].rfa, A.quads[0].rfa);
  assert.ok(B.quads[1].rfa > A.quads[1].rfa);
});

test('mois réels : repris tels quels, la suite part du dernier mois connu', () => {
  const reel = [{ retenu: 1000, actives: 20, nouvelles: 3, marge: 50 }, { retenu: 1100, actives: 22, nouvelles: 2, marge: 55 }];
  const A = M.annee(M.defauts(), reel);
  assert.equal(A.mois[0].ca, 1000); assert.equal(A.mois[1].ca, 1100);
  assert.equal(A.mois[1].reel, true); assert.equal(A.mois[2].reel, false);
  assert.equal(A.mois[2].fin, 24);
  const c = M.constate(reel.map((x) => ({ retenu: x.retenu, actives: x.actives, nouvelles: x.nouvelles })));
  assert.equal(c.reel.length, 2);
  assert.ok(c.rythme > 0 && c.panier > 0);
  assert.equal(M.constate([]), null);
});

test('détail : le palier extrême redonne le panier du plan, hors bornes signalé', () => {
  const o = M.defauts(); o.b = 200; const Z = M.detail(o);
  assert.equal(Z.a, 1); assert.equal(Z.horsBornes, false);
  o.b = 500; assert.equal(M.detail(o).horsBornes, true);
});

// ── mois complets, ventes fictives ──
function chargerRemuneration(sales, contrat, prodStats) {
  const w = { V2: { sales, pharmacies: [] }, OPSO_CONTRAT: contrat, PROD_STATS: prodStats };
  const ctx = { window: w, document: { body: null, addEventListener() {}, querySelector() { return null; }, getElementById() { return null; } }, Intl, Date, setInterval() {}, setTimeout() {}, clearTimeout() {}, console };
  vm.createContext(ctx);
  vm.runInContext(lire('opso/v2/opso-remuneration.js'), ctx);
  return w.V2.opsoRemuneration;
}
const CONTRAT = { periodes: [{ de: 1, a: 12 }], tranches: [{ jusqua: null, taux: 0.01, exclut: ['gen'] }], ordre: ['gen'], motifs: { gen: { label: 'g', categorie: 'gen' } } };
const PS = [{ c: '3400900000001', f: 'gen', d: 'GEN' }, { c: '3400900000002', f: 'x', d: 'PRINCEPS' }];
const V = (id, y, m, mnt, code, qte = 1, rep = true) => (rep ? { pharmacyId: id, year: y, month: m, mntNetHt: mnt, qte, artCode: code, artDesignation: '', commercial: '' } : { pharmacyId: id, year: y, month: m, mntNetHt: mnt, qte, artCode: code, artDesignation: '' });

test('moisComplets : exclut les génériques, ignore le dernier mois (partiel), compte actives et nouvelles', () => {
  const R = chargerRemuneration([
    V('a', 2025, 12, 10, '3400900000002'),
    V('a', 2030, 1, 100, '3400900000002'), V('a', 2030, 1, 40, '3400900000001'), V('b', 2030, 1, 60, '3400900000002'),
    V('a', 2030, 2, 80, '3400900000002'), V('b', 2030, 2, 20, '3400900000002'), V('c', 2030, 2, 30, '3400900000002'),
    V('a', 2030, 3, 999, '3400900000002'),   // dernier mois du fichier : partiel, jamais compté
    V('z', 2030, 2, 500, '3400900000002', 1, false)  // ligne injectée (sans commercial) : ni active ni nouvelle
  ], CONTRAT, PS);
  const r = R.moisComplets(2030);
  assert.equal(r.complets, 2);
  assert.equal(r.mois[0].retenu, 160);          // 100 + 60, le générique (40) est exclu
  assert.equal(r.mois[0].actives, 2);
  assert.equal(r.mois[0].nouvelles, 1);         // a avait déjà acheté en 2029 : seule b est nouvelle
  assert.equal(r.mois[1].actives, 3);
  assert.equal(r.mois[1].nouvelles, 1);         // c
  assert.equal(r.mois[1].retenu, 630);          // 80 + 20 + 30 + 500 injectés comptés dans le CA, pas dans les pharmacies
});

test('moisComplets : réglage absent -> null ; aucune vente de l\'année -> 0 mois', () => {
  assert.equal(chargerRemuneration([V('a', 2030, 1, 1, '3400900000002')], null, PS).moisComplets(2030), null);
  const r = chargerRemuneration([V('a', 2029, 1, 1, '3400900000002'), V('a', 2029, 2, 1, '3400900000002')], CONTRAT, PS).moisComplets(2030);
  assert.equal(r.complets, 0);
});
