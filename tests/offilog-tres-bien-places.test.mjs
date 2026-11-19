// Onglet « Très bien placés » de la porte « Comparer nos prix » (18/11/2026) : Offilog sous Sagitta ET Pharmazon, calculé en direct.
// Produits et marques FICTIFS. La liste classée (V2.offVitrineClasses, qui applique la liste privée) est simulée ;
// les prix, eux, passent par la vraie règle de v2-offilog.js (garde 0,5 à 2 fois, seuils 10 % / 20 % / tous).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog.js'), 'utf8');

// id, prix Offilog, Sagitta, Pharmazon (null = prix inconnu), rang de vente
const PRODUITS = [
  ['a', 10, 11.4, 11.4, 5],     // ~ -12 % sous le moins cher des deux : dans « 10 % », pas dans « 20 % »
  ['b', 10, 10.5, 10.6, 20],    // ~ -5 % : seulement « moins cher que les deux »
  ['c', 10, 9, 9.5, 30],        // plus cher : jamais
  ['d', 10, 12, null, 40],      // un seul prix connu : jamais
  ['e', 10, 25, 11, 50],        // Sagitta à 2,5 fois : conditionnement différent, hors garde : jamais
  ['f', 10, 13.4, 14, 120],     // ~ -25 % : dans les trois filtres
  ['g', 9, 10, 10, 600],        // exactement -10 % : la limite est comprise
  ['h', 10, 9.5, 14, 700],      // moins cher que Pharmazon seulement : Sagitta est plus bas, donc jamais
];
function liste() {
  return PRODUITS.map(([id, p, s, z, pos]) => ({
    it: { id, name: 'Produit ' + id, brand: 'ZZ Marque', price: p, sg: s ? { price: s } : null, pz: z ? { price: z, cat: 0 } : null, img: '' },
    pos, marque: 'ZZ MARQUE', nom: 'Produit ' + id,
  }));
}

function rendre({ opso = false, classees = liste, filtre = null, q = null, portesOpso = false }) {
  const noop = () => '';
  const fauxEl = () => new Proxy(function () {}, { get: (t, k) => (k === 'style' ? {} : k === 'dataset' ? {} : fauxEl()), apply: () => fauxEl(), set: () => true });
  const doc = { currentScript: null, head: fauxEl(), body: fauxEl(), createElement: fauxEl, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop };
  const V2 = new Proxy({
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    fmtEur: (n) => 'EUR' + Number(n).toFixed(2), fmtNum: (n) => String(n),
    motion: null, topbar: noop, loadFiles: () => Promise.resolve(), render: noop, pages: {},
    offVitrineClasses: classees,
  }, { get: (t, k) => (k in t ? t[k] : () => ''), set: (t, k, v) => { t[k] = v; return true; } });
  const win = {
    V2, ICO: () => '', document: doc, console, setTimeout, clearTimeout, requestAnimationFrame: noop,
    V2_BRAND: opso ? { opso: true } : undefined,
    OFFILOG_BEST: [{ rank: 1, id: 'a', name: 'Produit a', brand: 'ZZ Marque', ean: '3000000000001', img: '', cat: 'sante', url: '', price: 10 }],
    SAGITTA_PRIX: { '3000000000001': [11.4] }, PHARMAZON: [], PHARMAZON_PRIX: {}, OFFILOG_EXCLUS: { marques: ['zz'], eans: [], prefixes: [] },
    OFFILOG: [], matchMedia: () => ({ matches: false }), addEventListener: noop, localStorage: { getItem: () => null, setItem: noop },
  };
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.document = doc;
  let src = SRC;
  if (portesOpso) {   // OPSO n'a pas (encore) les trois portes : on les lui donne pour éprouver la 2e garde (SANS_OPP) elle-même
    src = SRC.replace('var M1 = !OPSO;', 'var M1 = true;');
    assert.notEqual(src, SRC, 'ancre « var M1 = !OPSO; » introuvable : adapter le test');
  }
  vm.runInContext(src, ctx);
  win.V2.offPorte('comparer');
  win.V2.offOppOnglet('plc');
  if (filtre) win.V2.offPlcFiltre(filtre);
  if (q != null) win.V2.offPlcSearch(q);
  const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  win.V2.pages.offilog.render(root, '');
  return root.innerHTML;
}
const ids = (h) => [...h.matchAll(/class="olo-r olp-r cl"[^>]*data-opp="([^"]+)"/g)].map((m) => m[1]);
const cnt = (h, libelle) => { const m = new RegExp(libelle + '<span class="cnt">(\\d+)</span>').exec(h); return m ? Number(m[1]) : null; };

test('la règle : seuls les produits sous le moins cher des deux (10 %, 20 %, tous) comptent, dans l\'ordre des ventes', () => {
  const h = rendre({});
  assert.match(h, /Usage interne/);
  assert.equal(cnt(h, '10 % moins cher ou plus'), 3);
  assert.equal(cnt(h, '20 % ou plus'), 1);
  assert.equal(cnt(h, 'Moins cher que les deux'), 4);
  assert.deepEqual(ids(h), ['a', 'f', 'g']);                                   // défaut = 10 %, ordre des ventes (5, 120, 600)
  assert.deepEqual(ids(rendre({ filtre: '20' })), ['f']);
  assert.deepEqual(ids(rendre({ filtre: 'tous' })), ['a', 'b', 'f', 'g']);
  for (const jamais of ['c', 'd', 'e', 'h']) assert.ok(!ids(rendre({ filtre: 'tous' })).includes(jamais), 'produit ' + jamais + ' ne doit pas compter');
});

test('la synthèse et la recherche suivent le filtre choisi', () => {
  const h = rendre({});
  assert.match(h, /<b class="olo-v">3<\/b><span class="olo-sous">produits<\/span>/);
  assert.match(h, /Ventes n° 1 à 100/);
  assert.match(h, /Ventes n° 501 à 1000/);
  assert.deepEqual(ids(rendre({ q: 'produit f' })), ['f']);
  assert.match(rendre({ q: 'introuvable' }), /Aucun produit ne correspond/);
});

test('recherche mot par mot : chaque mot tapé, n\'importe où dans marque + libellé, ordre libre (choix de Will, 18/11/2026)', () => {
  assert.deepEqual(ids(rendre({ q: '  F   zz ' })), ['f']);
  assert.match(rendre({ q: 'zz introuvable' }), /Aucun produit ne correspond/);
});

test('OPSO : aucun onglet « Très bien placés » (conditions de tiers)', () => {
  // 1) tel quel : OPSO garde l'ancien en-tête, sans portes (marqueur positif : la recherche d'OPSO est bien là)
  const h = rendre({ opso: true });
  assert.match(h, /off-search/);
  assert.doesNotMatch(h, /Très bien placés|data-onglet="plc"|Usage interne|olp-r/);
  // 2) avec les portes données de force à OPSO : la porte « Comparer nos prix » s'ouvre, mais sans l'onglet ni la moindre ligne
  const h2 = rendre({ opso: true, portesOpso: true });
  assert.match(h2, /Comparer nos prix/);
  assert.doesNotMatch(h2, /Très bien placés|data-onglet="plc"|Usage interne|olp-r/);
  assert.deepEqual(ids(h2), []);
  // 3) contrôle : la même mise en scène côté Offilog montre bien l'onglet
  assert.match(rendre({ portesOpso: true }), /data-onglet="plc"/);
});

test('liste privée absente : aucun produit montré', () => {
  const h = rendre({ classees: () => null });
  assert.deepEqual(ids(h), []);
  assert.doesNotMatch(h, /olp-r/);
  assert.match(h, /La liste des marques à retirer n'est pas disponible : rien n'est montré/);
  const h2 = rendre({ classees: null });   // fonction elle-même absente
  assert.deepEqual(ids(h2), []);
});
