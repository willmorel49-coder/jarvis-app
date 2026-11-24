/* fiche-ventes-excel.test.mjs — 24/11/2026, Will : « il faudra aussi que le commercial puisse extraire toutes les ventes de la pharma
 * si il le souhaite ». V2.pharmaVentesXlsx est découpée dans le vrai fichier et exécutée telle quelle, avec un faux SheetJS qui garde
 * les tableaux écrits. Ventes et noms ci-dessous : inventés. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ph = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const i = ph.indexOf('  V2.pharmaVentesXlsx = function'), j = ph.indexOf('  // ════', i);
assert.ok(i > 0 && j > i, 'V2.pharmaVentesXlsx introuvable');
const MN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const V = (m, cip, qte, ca, comm) => ({ pharmacyId: '7', year: 2026, month: m, artCode: cip, qte, mntNetHt: ca, puNet: qte ? ca / qte : 0, commercial: comm || 'A' });
const VENTES = [V(2, '3400000000011', 10, 50), V(3, '3400000000011', 5, 25), V(3, '3400000000028', 1, 900, 'B'), V(4, '3400000000011', -2, -10), V(4, '3400000000035', 300, 120)];

function lancer({ voit = true, ventes = VENTES } = {}) {
  const classeurs = [], toasts = [];
  const X = { utils: {
    book_new: () => { const wb = { feuilles: [] }; classeurs.push(wb); return wb; },
    aoa_to_sheet: (aoa) => ({ __aoa: aoa }), encode_cell: ({ r, c }) => r + ':' + c, encode_range: () => 'A1',
    book_append_sheet: (wb, ws, nom) => wb.feuilles.push({ nom, aoa: ws.__aoa })
  }, write: () => [], writeFile: () => {} };
  const ctx = {
    V2: { pharmacies: [{ id: '7', name: 'PHARMACIE ESSAI' }], voitVentesDe: () => voit, toast: (t) => toasts.push(t) },
    window: { CATALOGUE_COMPLET: {}, XLSX: X }, pharmaSalesAll: () => ventes,
    benchIndex: () => new Map([['3400000000011', { designation: 'PRODUIT UN' }], ['3400000000028', { designation: 'PRODUIT CHER' }]]),
    classify: () => 'nr', CATS: [{ key: 'nr', label: 'Non remboursés' }], MN_SHORT: MN, periodLabel: () => 'cumul 10 mois',
    moisVentes: () => ({ du: '2026-01', au: '2026-10' }), ensureXLSX: (cb) => cb(true), txMime: () => 'x', _catEssai: false,
    File: class { constructor(a, n) { this.name = n; } }
  };
  vm.runInNewContext(ph.slice(i, j), ctx);
  return ctx.V2.pharmaVentesXlsx('7', 'blob').then((f) => ({ f, wb: classeurs[0], toasts }));
}

test('deux onglets : « Par produit » classé par CA HT, « Ligne par ligne » avec chaque vente', async () => {
  const { f, wb } = await lancer();
  assert.ok(f && /^Ventes-PHARMACIE_ESSAI-/.test(f.name));
  assert.equal(wb.feuilles.map((x) => x.nom).join(), 'Par produit,Ligne par ligne');
  const p = wb.feuilles[0].aoa, l = wb.feuilles[1].aoa;
  const prods = p.slice(4).filter((r) => typeof r[0] === 'number');
  assert.equal(prods.map((r) => r[2]).join(), '3400000000028,3400000000035,3400000000011', 'classé par CA');
  assert.equal(prods.find((r) => r[2] === '3400000000011')[4], 13, 'boîtes, retour compris');
  assert.equal(l.length - 4, VENTES.length, 'toutes les lignes, retour compris');
  assert.ok(l.slice(4).some((r) => r[3] === -2 && r[5] === -10), 'le retour est en négatif');
});
test('une colonne de boîtes par mois de TOUTE la période (janv. → oct.), même vide', async () => {
  const { wb } = await lancer();
  const t = wb.feuilles[0].aoa[3];
  assert.equal(t.filter((x) => /^Boîtes /.test(x)).length, 10);
  assert.equal(t[8], 'Boîtes janv. 2026'); assert.equal(t[17], 'Boîtes oct. 2026');
  const un = wb.feuilles[0].aoa.find((r) => r[2] === '3400000000011');
  assert.equal(un.slice(8).join(), '0,10,5,-2,0,0,0,0,0,0');
});
test('toutes ses ventes, tous commerciaux (pas le filtre de la fiche)', async () => {
  const { wb } = await lancer();
  assert.ok(wb.feuilles[0].aoa.some((r) => r[2] === '3400000000028'), 'la vente du commercial B est là');
  assert.ok(ph.slice(i, j).includes('pharmaSalesAll(pid)') && !ph.slice(i, j).includes('pharmaSales(pid)'));
});
test('officine d’un collègue (ventes masquées) : aucun fichier', async () => {
  const { f, wb, toasts } = await lancer({ voit: false });
  assert.equal(f, null); assert.equal(wb, undefined); assert.ok(toasts.some((t) => /réservées/.test(t)));
});
test('aucune vente : aucun fichier', async () => {
  const { f, wb } = await lancer({ ventes: [] });
  assert.equal(f, null); assert.equal(wb, undefined);
});
test('le bouton est sur la fiche, sous les tuiles des listings', () => {
  const a = ph.indexOf('  function fdrListings('), b = ph.indexOf('  function fdrPage(', a);
  assert.ok(ph.slice(a, b).includes('V2.pharmaVentesXlsx(') && ph.slice(a, b).includes('Extraire toutes ses ventes'));
});
