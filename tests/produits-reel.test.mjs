import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const M = require('../crm/v2/v2-produits-moteur.js');

// Les fichiers *-data.js sont des scripts navigateur : on les evalue dans un
// bac a sable muni d'un objet `window`, comme le fait la page.
// ⚠️ Les fichiers doivent etre CONCATENES en un seul script : wml-officines-data.js
// declare `const WML_OFFICINES`, une liaison lexicale qui ne devient PAS une
// propriete du bac a sable. Un collecteur ajoute a la fin du meme script est le
// seul moyen fiable de la recuperer. Motif verifie le 11/08/2026.
function charger(...fichiers) {
  const sb = { window: {}, console };
  vm.createContext(sb);
  const src = fichiers
    .map((f) => readFileSync(new URL(f, import.meta.url), 'utf8'))
    .join('\n;\n') +
    '\n;globalThis.__X = {' +
    '  WML_OFFICINES: typeof WML_OFFICINES !== "undefined" ? WML_OFFICINES : window.WML_OFFICINES,' +
    '  WML_SALES: typeof WML_SALES !== "undefined" ? WML_SALES : window.WML_SALES,' +
    '  STOCK_IP: window.STOCK_IP, PROD_STATS: window.PROD_STATS };';
  vm.runInContext(src, sb);
  return sb.__X;
}

const D = charger(
  '../crm/v2/wml-officines-data.js',
  '../crm/v2/stock-data.js',
  '../crm/v2/prod-stats-data.js'
);
const OFFICINES = D.WML_OFFICINES;
const SALES = D.WML_SALES;
const STOCK = D.STOCK_IP.data;
const PS = D.PROD_STATS;

// WML_SALES est au format compact : [phId, mois, commercial, cip13, qte, puNet, mntNetHt]
const VENTES = SALES.map((s) => ({
  pharmacyId: String(s[0]), artCode: s[3], qte: s[4] || 0, mntNetHt: s[6] || 0,
}));

const idx = M.indexer(OFFICINES, VENTES);

test('donnees reelles : le volume attendu est bien la', () => {
  assert.equal(OFFICINES.length, 691);
  assert.ok(SALES.length > 400000, `attendu > 400k lignes, obtenu ${SALES.length}`);
});

test('invariant : aucune officine ne tombe a zero produit', () => {
  const vides = [];
  for (const o of OFFICINES) {
    const r = M.listingOfficine(idx, o.id, { stock: STOCK });
    if (r.lignes.length === 0) vides.push(o.name || o.id);
  }
  assert.deepEqual(vides, [], `officines sans aucun produit : ${vides.join(', ')}`);
});

test('invariant : 100 % des produits proposes sont en stock', () => {
  for (const o of OFFICINES.slice(0, 50)) {
    const r = M.listingOfficine(idx, o.id, { stock: STOCK });
    for (const l of r.lignes) {
      assert.ok(l.stock > 0, `${o.id} propose ${l.cip} avec un stock de ${l.stock}`);
    }
  }
});

test('invariant : aucune officine ne se compte elle-meme dans ses confreres', () => {
  for (const o of OFFICINES.slice(0, 100)) {
    const r = M.listingOfficine(idx, o.id, { stock: STOCK });
    if (!r.groupe) continue;
    assert.ok(r.nbConfreres < r.groupe.taille || r.groupe.taille === 0,
      `${o.id} : ${r.nbConfreres} confreres pour un groupe de ${r.groupe.taille}`);
    for (const l of r.lignes) {
      assert.ok(l.pctPeers <= 1, `${o.id} / ${l.cip} : ${l.pctPeers} > 100 %`);
    }
  }
});

test('invariant : un produit propose n est jamais deja achete par l officine', () => {
  for (const o of OFFICINES.slice(0, 100)) {
    const mien = idx.netParOfficine[String(o.id)] || {};
    for (const l of M.listingOfficine(idx, o.id, { stock: STOCK }).lignes) {
      assert.ok(!(mien[l.cip] > 0), `${o.id} : ${l.cip} deja achete`);
    }
  }
});

test('couverture des groupements : au moins 70 % en cas nominal', () => {
  let nominal = 0;
  for (const o of OFFICINES) {
    const g = M.groupeComparaison(idx, o.id);
    if (g && g.type === 'groupement') nominal++;
  }
  const pct = nominal / OFFICINES.length;
  assert.ok(pct >= 0.70, `seulement ${Math.round(pct * 100)} % en cas nominal`);
});

test('familles : le referentiel produit couvre les CIP proposes', () => {
  const connus = new Set(PS.map((r) => String(r.c)));
  const r = M.listingOfficine(idx, OFFICINES[0].id, { stock: STOCK });
  const inconnus = r.lignes.filter((l) => !connus.has(l.cip));
  // Tolerance : le referentiel PROD_STATS (6 292 CIP) est plus etroit que les
  // ventes (7 886 CIP). La page doit savoir afficher une ligne sans libelle.
  assert.ok(inconnus.length / Math.max(1, r.lignes.length) < 0.5,
    `${inconnus.length} CIP sur ${r.lignes.length} absents de PROD_STATS`);
});
