/* listing-nouveautes-top50.test.mjs — 24/11/2026, demandes de Will :
 *  1. « le top 50 volume et top 50 valeur que commande la pharma » dans les listings (PDF client) ;
 *  2. « ajoute également en opportunités les nouveautés qui explosent en volume (aiguilles EasyDrip) ».
 * Le code est découpé dans les vrais fichiers et exécuté tel quel (rien n'est recopié). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ph = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const pdf = readFileSync(new URL('../crm/v2/v2-pdf-prospect.js', import.meta.url), 'utf8');
const bloc = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, 'bloc introuvable : ' + a); return src.slice(i, j); };

// ── nouveautés ──
// un produit vendu chaque mois fixe la période (janv.→oct.), comme dans le vrai réseau
const FOND = Array.from({ length: 10 }, (_, m) => ({ pharmacyId: '999', artCode: '3400000000000', year: 2026, month: m + 1, qte: 1 }));
function nouveautes(sales, bench = {}, cat = {}, sansFond = false) {
  sales = sansFond ? sales : FOND.concat(sales);
  const ctx = { V2: { sales, produits: { catalogueIndex: () => cat }, estReste: p => p === '0' || p === '0E' }, Map };
  ctx.benchIndex = () => new Map(Object.entries(bench));
  vm.runInNewContext(bloc(ph, '  var NOUV = {', '  function buildRecoCats(') + '\nthis.f = nouveautesReseau;', ctx);
  return ctx.f();
}
// ventes : boîtes par mois (janv.→oct. 2026) réparties sur `nph` pharmacies
function lignes(cip, parMois, nph = 10) {
  const out = [];
  parMois.forEach((q, m) => { if (!q) return; for (let p = 0; p < nph; p++) out.push({ pharmacyId: String(100 + p), artCode: cip, year: 2026, month: m + 1, qte: q / nph }); });
  return out;
}
const EASY = '6972857294250', cat = { [EASY]: { d: 'EASYDRIP+ PRO AIG 4MM 32G B100', ppht: 4.84, net: 4.84 } };

test('EasyDrip (vraie courbe 2026) est une nouveauté, même hors BENCHMARK', () => {
  const r = nouveautes(lignes(EASY, [0, 0, 0, 4, 0, 23, 170, 105, 213, 289], 10), {}, cat);
  assert.deepEqual(JSON.parse(JSON.stringify(r.map(x => x.cip))), [EASY]);
  assert.equal(Math.round(r[0].A), 607);
});
test('un produit installé depuis janvier n’est pas une nouveauté, même s’il monte', () => {
  assert.equal(nouveautes(lignes(EASY, [60, 60, 60, 80, 90, 100, 100, 200, 300, 400], 10), {}, cat).length, 0);
});
test('trop petit (< 50 boîtes) ou trop peu de pharmacies (< 8 sur un mois) : écarté', () => {
  assert.equal(nouveautes(lignes(EASY, [0, 0, 0, 0, 0, 0, 2, 10, 15, 20], 10), {}, cat).length, 0, '45 boîtes');
  assert.equal(nouveautes(lignes(EASY, [0, 0, 0, 0, 0, 0, 20, 100, 200, 300], 5), {}, cat).length, 0, '5 pharmacies');
});
test('pas assez de hausse (< 2 fois les 3 mois d’avant) : écarté', () => {
  assert.equal(nouveautes(lignes(EASY, [0, 0, 0, 100, 100, 100, 100, 100, 100, 100], 10), {}, cat).length, 0);
});
test('les campagnes saisonnières (vaccin grippe, anti-VRS, autotests) sont écartées', () => {
  const v = '3400930296165', b = '3400930268636', t = '6952062710707';
  const r = nouveautes([...lignes(v, [0, 0, 0, 0, 0, 0, 0, 0, 0, 405], 13), ...lignes(b, [0, 0, 0, 0, 0, 0, 1, 60, 877, 872], 30), ...lignes(t, [0, 0, 0, 0, 0, 0, 0, 0, 420, 2759], 30)],
    { [v]: { designation: 'INFLUVAC INJ SRG0,5ML A/AIG 1' }, [b]: { designation: 'BEYFORTUS 100MG INJ S1ML/2A 1' } }, { [t]: { d: 'AUTOTEST COMBO GRIPPE/COVID SEJOY BT1' } });
  assert.equal(r.length, 0);
});
test('sans nom (ni BENCHMARK ni catalogue arrivé) : rien plutôt qu’une ligne vide', () => {
  assert.equal(nouveautes(lignes(EASY, [0, 0, 0, 4, 0, 23, 170, 105, 213, 289], 10), {}, {}).length, 0);
});
test('moins de 9 mois de ventes : aucune nouveauté (la règle n’a pas de sens)', () => {
  assert.equal(nouveautes(lignes(EASY, [5, 0, 0, 4, 0, 23, 170, 105], 10), {}, cat, true).length, 0);
});
test('les nouveautés passent en tête du listing et sortent des autres familles', () => {
  const b = bloc(ph, '  function buildRecoCats(', '  // Best rotations du groupement');
  assert.ok(b.includes('nouveautesReseau()') && b.includes('enNouv[cip]') && b.includes('[{ cat: NOUV, rows: nouv }]'));
  assert.ok(b.includes('if (owned.has(n.cip)'), 'ce qu’elle commande déjà n’est pas proposé');
});
test('PDF : la coupe à 10 pages garde les nouveautés', () => {
  const g = bloc(pdf, '  function garder(c, K)', '  function construire(');
  const ctx = {}; vm.runInNewContext(g + '\nthis.f = garder;', ctx);
  const c = { tot: 3, cats: [{ rows: [{ n: 2, nouv: true }] }, { rows: [{ n: 90 }, { n: 50 }] }] };
  const d = ctx.f(c, 2);
  assert.equal(d.cats[0].rows[0].nouv, true, 'la nouveauté reste');
  assert.equal(d.cats[1].rows.length, 1);
});

// ── top 50 en valeur ET en volume ──
test('topVentesData : 50 en CA et 50 en boîtes, parts dans la bonne unité', () => {
  const ctx = {
    V2: {}, CATS: [], benchIndex: () => new Map(), classify: () => null,
    pharmaSales: () => [
      { artCode: '1111111', qte: 2, mntNetHt: 900 },   // cher, peu de boîtes
      { artCode: '2222222', qte: 300, mntNetHt: 150 },  // pas cher, beaucoup de boîtes
      { artCode: '3333333', qte: 40, mntNetHt: 400 }]
  };
  vm.runInNewContext(bloc(ph, '  var PDF_TOP_VENTES = 50;', '  function topVentesPdfHtml(') + '\nthis.f = topVentesData;', ctx);
  const t = ctx.f('x');
  assert.equal(t.rows.map(r => r.cip).join(), '1111111,3333333,2222222', 'valeur');
  assert.equal(t.vol.rows.map(r => r.cip).join(), '2222222,3333333,1111111', 'volume');
  assert.equal(t.vol.qteTot, 342);
});
test('PDF client : deux tableaux « en valeur » et « en volume »', () => {
  assert.ok(pdf.includes("'Ce qu\\'elle commande · en valeur'") && pdf.includes("'Ce qu\\'elle commande · en volume'"));
  assert.ok(pdf.includes("tableTop('topv'"), 'le tableau volume a sa propre suite de page');
});
