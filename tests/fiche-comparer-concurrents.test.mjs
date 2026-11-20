/* Fiche d'une officine : « Comparer » face à D2P et aux 6 colonnes du comparateur (20/11/2026, demande de Will).
   Calcul : seuls les produits qu'elle achète chez nous ET dont on connaît le prix chez le concurrent ; génériques et
   biosimilaires hors calcul. Écran interne : aucun export. Pharmacies fictives seulement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const lire = (f) => fs.readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const src = lire('v2-concurrents-d2p.js');
const noop = () => {};

function monde(ventes, prix, pret = true) {
  const appels = [];
  const win = {
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild: noop } },
    location: { hash: '' }, history: { replaceState: (a, b, h) => { win.location.hash = h; } },
    V2: {
      esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
      topbar: () => '', pharmacies: [{ id: 'F1', name: 'PHARMACIE FICTIVE A', ville: 'Ville' }],
      voitVentesDe: () => true, pharmaVentesDe: () => ventes,
      go: (n, p) => appels.push(p), route: { name: 'concurrents' },
      ccPrixOfficine: {
        cols: ['sagitta', 'ocp', 'alliance', 'pharmafit', 'cerp', 'pharmazon'],
        nom: { sagitta: 'Sagitta', ocp: 'OCP', alliance: 'Alliance', pharmafit: 'Pharmafit', cerp: 'CERP', pharmazon: 'Pharmazon' },
        source: () => 'prix 2025 · relevé du 12/05/2025', pret: () => pret, rate: () => '', charger: () => appels.push('charger'),
        prix: (k, c) => prix[c] || null
      }
    }
  };
  win.window = win;
  vm.runInNewContext(src, win);
  return { V2: win.V2, win, appels };
}
const v = (cip, qte) => ({ artCode: cip, qte, year: 2026, month: 10 });
const PRIX = {
  A: { nous: 10, eux: 12, d: 'PRODUIT A', exclu: false },      // Intégral moins cher de 2 € / boîte
  B: { nous: 20, eux: 19, d: 'PRODUIT B', exclu: false },      // concurrent moins cher de 1 € / boîte
  G: { nous: 2, eux: 5, d: 'GENERIQUE G', exclu: true },       // générique : hors calcul
  Z: { nous: 8, eux: null, d: 'PRODUIT Z', exclu: false }      // pas de prix chez eux
};

test('calcul : quantités sommées par produit, seuls les produits au prix connu chez eux, génériques exclus', () => {
  const { V2 } = monde([], PRIX);
  const C = V2.faceCalcul([{ cip: 'A', q: 3 }, { cip: 'A', q: 2 }, { cip: 'B', q: 4 }, { cip: 'G', q: 10 }, { cip: 'Z', q: 1 }, { cip: 'X', q: 7 }, { cip: 'B', q: -1 }], (c) => PRIX[c] || null);
  assert.equal(C.achetes, 5);                       // A, B, G, Z, X (la ligne à quantité négative ne compte pas)
  assert.equal(C.prods.length, 2);
  const a = C.prods.find((x) => x.cip === 'A'), b = C.prods.find((x) => x.cip === 'B');
  assert.equal(a.q, 5); assert.equal(a.gain, 10);   // 5 × (12 − 10)
  assert.equal(b.q, 4); assert.equal(b.gain, -4);   // 4 × (19 − 20)
  assert.equal(C.T.nous, 5 * 10 + 4 * 20);
  assert.equal(C.T.eux, 5 * 12 + 4 * 19);
  assert.equal(C.T.gain, 6);
});

test('écran face à Alliance : date des prix en clair, les deux sections, aucun export', () => {
  const { V2, win } = monde([v('A', 5), v('B', 4), v('G', 10)], PRIX);
  const root = { innerHTML: '' };
  V2.d2pRender(root, 'face/F1/alliance', '');
  const h = root.innerHTML;
  assert.match(h, /<h1 class="v2-page-title">PHARMACIE FICTIVE A<\/h1>/);
  assert.match(h, /Face à Alliance/);
  assert.match(h, /prix 2025 · relevé du 12\/05\/2025/);
  assert.match(h, /Moins cher chez Intégral \(1 produit\)/);
  assert.match(h, /Moins cher chez Alliance \(1 produit\)/);
  assert.match(h, /2 sur 3/);                        // 2 comparés sur 3 achetés (le générique compte dans les achats)
  assert.match(h, /Écran interne/);
  assert.doesNotMatch(h, /Exporter|Excel|PDF|download/i);
  assert.equal(win.location.hash, '#concurrents/face/F1/alliance');
});

test('choix du concurrent : les 7 dans l\'ordre de Will, le choix garde la pharmacie', () => {
  const { V2, appels } = monde([v('A', 1)], PRIX);
  const root = { innerHTML: '' };
  V2.d2pRender(root, 'face/F1/ocp', '');
  const ks = [...root.innerHTML.matchAll(/data-k="([a-z0-9]+)" onclick="V2\.d2pComparer/g)].map((m) => m[1]);
  assert.deepEqual(ks, ['d2p', 'ocp', 'alliance', 'cerp', 'sagitta', 'pharmafit', 'pharmazon']);
  assert.match(root.innerHTML, /class="v2-seg on" aria-pressed="true" data-k="ocp"/);
  V2.d2pComparer('cerp'); V2.d2pComparer('d2p'); V2.d2pChoisir('F2');
  assert.deepEqual(appels, ['face/F1/cerp', 'd2p/F1', 'face/F2/ocp']);
});

test('relevés pas encore là : squelette et une demande de chargement, aucun chiffre', () => {
  const { V2, appels } = monde([v('A', 5)], PRIX, false);
  const root = { innerHTML: '' };
  V2.d2pRender(root, 'face/F1/sagitta', '');
  assert.match(root.innerHTML, /aria-busy="true"/);
  assert.doesNotMatch(root.innerHTML, /Moins cher chez/);
  assert.deepEqual(appels, ['charger']);
});

test('concurrent inconnu dans l\'adresse : retour à D2P (jamais un écran vide)', () => {
  const { V2, win } = monde([v('A', 5)], PRIX);
  V2.d2pRender({ innerHTML: '' }, 'face/F1/inconnu', '');
  assert.equal(win.location.hash, '#concurrents/d2p/F1');
});

test('le rond de la fiche s\'appelle « Comparer » et l\'aiguillage connaît face/', () => {
  const ph = lire('v2-pharma.js'), cc = lire('v2-concurrents.js');
  assert.equal((ph.match(/'d2p', 'Comparer'\)/g) || []).length, 2);
  assert.doesNotMatch(ph, /Comparer D2P/);
  assert.match(cc, /\/\^\(d2p\(\\\/\|\$\)\|face\\\/\)\/\.test\(p\) && V2\.d2pRender/);
  assert.match(cc, /V2\.ccPrixOfficine = \{/);
});
