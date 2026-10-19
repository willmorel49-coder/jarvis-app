// Catalogue du groupe (7 établissements) : crm/v2/catalogue-groupe-data.js
// Contrat : forme des lignes, familles identiques à CATALOGUE_COMPLET, aucune marque = fournisseur,
// aucun prix d'achat / revient, états de stock sur 7 sites, deux tarifs connus (DOLIPRANE, WEGOVY).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = (f) => fs.readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const texte = lire('catalogue-groupe-data.js');
const G = vm.runInNewContext(texte + ';CATALOGUE_GROUPE', {});
const fenetre = {};
vm.runInNewContext(lire('catalogue-complet-data.js'), { window: fenetre });
const COMPLET = fenetre.CATALOGUE_COMPLET;

test('déclaré en var (pas const/let) : la variable témoin existe pour le chargeur différé', () => {
  assert.match(texte, /^\/\*[^]*?\*\/\nvar CATALOGUE_GROUPE = \{/);
  assert.doesNotMatch(texte, /^(const|let) CATALOGUE_GROUPE/m);
});

test('plus de 20 000 lignes et meta cohérente', () => {
  assert.ok(G.rows.length > 20000, 'lignes : ' + G.rows.length);
  assert.equal(G.meta.n, G.rows.length);
  assert.equal(JSON.stringify(G.meta.sites), JSON.stringify(['OPS', 'HP', 'CPR', 'POS', 'SEP', 'MSP', 'SOP']));
  assert.equal(JSON.stringify(G.meta.cols), JSON.stringify(['cip', 'd', 'labo', 'mol', 'fam', 'ppht', 'net', 'n', 'rayon', 'sites']));
  assert.equal(G.meta.tarif.source, 'export POS');
  for (const s of G.meta.sites) {
    assert.match(G.meta.fraicheur[s].date, /^\d{4}-\d{2}-\d{2}$/, 'fraîcheur ' + s);
    assert.ok(G.meta.fraicheur[s].quoi, 'fraîcheur ' + s);
  }
  assert.ok(G.meta.fournisseurs.length > 0);
});

test('forme de chaque ligne', () => {
  const codes = new Set();
  const fams = new Set(COMPLET.rows.map((r) => r[4]));
  for (const r of G.rows) {
    assert.equal(r.length, 10, r[0]);
    const [cip, d, labo, mol, fam, ppht, net, n, rayon, sites] = r;
    assert.match(cip, /^\d{12,14}$/);   // comme CATALOGUE_COMPLET : quelques codes UPC (12) ou GTIN-14, jamais plus
    assert.ok(!codes.has(cip), 'code en double ' + cip);
    codes.add(cip);
    assert.ok(typeof d === 'string' && d.length > 0, cip);
    assert.ok(Number.isInteger(labo) && labo >= -1 && labo < G.labos.length, cip + ' labo');
    assert.ok(Number.isInteger(mol) && mol >= -1 && mol < G.mols.length, cip + ' mol');
    assert.ok(fams.has(fam), cip + ' fam ' + fam + ' absente de CATALOGUE_COMPLET');
    assert.ok(typeof ppht === 'number' && ppht >= 0, cip + ' ppht');
    assert.ok(typeof net === 'number' && net >= 0, cip + ' net');
    assert.ok(Number.isInteger(n) && n >= 0, cip + ' n');
    assert.ok(Number.isInteger(rayon) && rayon >= -1 && rayon < G.rayons.length, cip + ' rayon');
    assert.match(sites, /^[012]{7}$/, cip + ' sites');
  }
});

test('codes à 13 chiffres pour l\'immense majorité', () => {
  const autres = G.rows.filter((r) => r[0].length !== 13).length;
  assert.ok(autres < 100, 'codes non 13 chiffres : ' + autres);
});

test('tri : pharmacies décroissant, puis désignation', () => {
  for (let i = 1; i < G.rows.length; i++) {
    const a = G.rows[i - 1], b = G.rows[i];
    assert.ok(a[7] > b[7] || (a[7] === b[7] && a[1] <= b[1]), 'ordre rompu ligne ' + i);
  }
});

test('aucun fournisseur / dépositaire dans les marques', () => {
  const interdits = new Set(G.meta.fournisseurs.map((x) => x.toUpperCase()));
  for (const l of G.labos) {
    const u = l.toUpperCase();
    assert.ok(!interdits.has(u), 'fournisseur dans labos : ' + l);
    assert.ok(!/^(INTER ?TRADE|ITP$|ITP )/.test(u), 'fournisseur dans labos : ' + l);
  }
  assert.ok(G.meta.fournisseurs.some((x) => /^INTER TRADE PHAR/i.test(x)));
});

test('aucun prix d\'achat, de revient ni atfprix (clés, colonnes)', () => {
  const interdit = /artlastpa|artprmp|atfprix|prix_achat|revient/i;
  assert.doesNotMatch(JSON.stringify(G.meta), interdit);
  assert.ok(!G.meta.cols.some((c) => interdit.test(c)));
  assert.doesNotMatch(texte, /atfprix|artlastpa|artprmp/i);
});

test('tarifs connus : DOLIPRANE 1000MG BT8 à 1,06 € et WEGOVY 2,4MG à 181,48 €', () => {
  const par = new Map(G.rows.map((r) => [r[0], r]));
  const dol = par.get('3400935955838');
  assert.ok(dol && /^DOLIPRANE 1000MG CPR BT8/.test(dol[1]));
  assert.equal(dol[5], 1.06);
  const weg = par.get('3400930258668');
  assert.ok(weg && /^WEGOVY 2,4MG/.test(weg[1]));
  assert.equal(weg[5], 181.48);
});

test('le rayon reprend les libellés de MKT_RAYONS', () => {
  const f = {};
  vm.runInNewContext(lire('mkt-rayons-data.js'), { window: f });
  const ref = f.MKT_RAYONS.rayons;
  assert.equal(JSON.stringify(G.rayons.slice(0, ref.length)), JSON.stringify(ref));   // JSON : deux contextes vm, deux Array différents
});
