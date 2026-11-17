// Catalogue Offilog « 500 meilleures ventes » de Transmettre (06/11/2026) :
// la sélection est EXACTEMENT celle du bloc « meilleures ventes pour son logiciel » réglé sur 500
// (même ordre, mêmes produits), le tarif laboratoire absent reste vide, la marque a sa colonne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog-catalogue.js'), 'utf8');
const ean = (i) => String(3000000000000 + i);

function monter() {
  const fauxEl = () => new Proxy(function () {}, { get: (t, k) => (k === 'style' ? {} : fauxEl()), apply: () => fauxEl(), set: () => true });
  const V2 = { fmtNum: String, toast() {}, fusionnerPrixBest() {} };
  // 560 produits au catalogue (rangs 1..560 sur les numéros pairs), 700 hors catalogue (numéros impairs) : mélange réaliste
  const lignes = [], rangs = {}, best = [];
  for (let i = 1; i <= 1400; i++) {
    const r = i; // le rang suit le numéro
    rangs[ean(i)] = [0, r];
    if (i % 2 === 0 && i <= 1120) lignes.push([ean(i), 'MARQUE' + (i % 7), 'Produit catalogue ' + i, 'Rayon ' + (i % 3), 10 + (i % 5), 8 + (i % 5), null, 0]);
    else best.push({ id: String(i), name: 'MARQ – Produit hors catalogue ' + i, brand: 'MARQ', ean: ean(i), price: 5 + (i % 4) });
  }
  const win = {
    V2, document: { createElement: fauxEl, head: fauxEl(), body: fauxEl(), getElementById: () => null }, console, setTimeout, ICO: () => '',
    OFFILOG_CATALOGUE: { lignes, maj: '2026-10-20' }, OFFILOG_BEST: best, OFFILOG_CATS: {},
    OFFILOG_MARCHE: { releves: ['2026-10-01', '2026-11-02'], rangs },
  };
  win.window = win;
  vm.runInContext(SRC, vm.createContext(win));
  return win;
}

test('même sélection que le bloc de l\'écran Offilog réglé sur 500', () => {
  const w = monter();
  w.V2.offCatLgo('n', 500);
  const ecran = w.V2.offCatLgoDonnees().lignes.map((r) => r[2]);   // Winpharma : colonne EAN13
  const top = w.V2.offCatTopLignes();
  assert.equal(top.lignes.length, 500);
  assert.deepEqual(top.lignes.map((l) => l.ean), ecran);
  assert.equal(top.lignes[0].rang, 1);
  assert.equal(top.date, '2026-11-02');
  assert.equal(top.maj, '2026-10-20');
});

test('tarif laboratoire vide hors catalogue, marque propre, écart seulement si tarif connu', () => {
  const top = monter().V2.offCatTopLignes().lignes;
  const hors = top.find((l) => l.rang === 1);        // numéro 1 : hors catalogue
  assert.equal(hors.tarif, null); assert.equal(hors.ecart, null);
  assert.equal(hors.marque, 'MARQ'); assert.equal(hors.nom, 'Produit hors catalogue 1');
  const cat = top.find((l) => l.rang === 2);          // numéro 2 : au catalogue
  assert.ok(cat.tarif > 0); assert.ok(Math.abs(cat.ecart - (cat.prix / cat.tarif - 1)) < 1e-9);
  assert.ok(top.every((l, i) => i === 0 || l.rang > top[i - 1].rang));
});
