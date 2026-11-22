// 22/11/2026 — V3 « socle des données », lot dates : une donnée de plus de 30 jours dit sa date, en mots simples,
// là où elle sert (prix des concurrents, classement Offilog, stock des établissements).
// Les dates se LISENT dans les fichiers de données ; ici on les fabrique pour éprouver l'affichage.
// RACINE_SRC permet de pointer sur l'ancien code (pour prouver que le test échoue dessus).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = process.env.RACINE_SRC || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, 'crm/v2', f), 'utf8');
const BOOT = lire('v2-boot.js');
const OFF = lire('v2-offilog.js');

// Le bloc « date d'une donnée qui vieillit » de v2-boot.js, rejoué dans un faux window (absent = ancien code).
function boot(donnees) {
  const sb = { console, Date };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext('window.V2 = {}; V2.TARIF_VIEUX_JOURS = 30;' + (donnees || ''), sb);
  const a = BOOT.indexOf('V2.dateEnMots = function'), b = BOOT.indexOf('  V2.bestPrice = function');
  if (a > 0 && b > a) vm.runInContext(BOOT.slice(a, b), sb);
  return sb;
}
const AUJ = new Date(2026, 10, 22);
const STOCK = 'window.STOCK_IP = {meta:{siteDates:{"CPR":"2026-09-15","HP":"2026-09-15","OPS":"2026-11-05","POS":"2026-09-21"},gen:"2026-09-15"},data:{}};';

test('date d\'une donnée : au-delà de 30 jours, en mots simples ; sinon rien', () => {
  const V2 = boot().V2;
  assert.equal(typeof V2.dateDonneeVieille, 'function', 'V2.dateDonneeVieille absente');
  assert.equal(V2.dateDonneeVieille('2026-06-05', AUJ), '5 juin');
  assert.equal(V2.dateDonneeVieille('2026-09-03', AUJ), '3 septembre');
  assert.equal(V2.dateDonneeVieille('2026-11-01', AUJ), '', '21 jours : pas de mention');
  assert.equal(V2.dateDonneeVieille('2026-10-23', AUJ), '', '30 jours pile : pas de mention');
  assert.equal(V2.dateDonneeVieille('2026-10-22', AUJ), '22 octobre', '31 jours : mention');
  assert.equal(V2.dateDonneeVieille('', AUJ), '');
  assert.equal(V2.dateDonneeVieille('n\'importe quoi', AUJ), '', 'date illisible : on n\'invente rien');
});

test('stock : « du 15 septembre au 5 novembre », lu dans les dates de chaque établissement', () => {
  const V2 = boot(STOCK).V2;
  assert.equal(typeof V2.stockDateTxt, 'function', 'V2.stockDateTxt absente');
  assert.equal(V2.stockDateTxt(AUJ), 'stock du 15 septembre au 5 novembre');
});
test('stock : une seule date → « stock du … » ; tout récent ou rien de lisible → rien', () => {
  const un = boot('window.STOCK_IP = {meta:{siteDates:{"OPS":"2026-09-15"}},data:{}};').V2;
  assert.equal(un.stockDateTxt(AUJ), 'stock du 15 septembre');
  const recent = boot('window.STOCK_IP = {meta:{siteDates:{"OPS":"2026-11-05","POS":"2026-11-10"}},data:{}};').V2;
  assert.equal(recent.stockDateTxt(AUJ), '');
  assert.equal(boot('window.STOCK_IP = {meta:{},data:{}};').V2.stockDateTxt(AUJ), '');
  assert.equal(boot().V2.stockDateTxt(AUJ), '');
  const repli = boot('window.STOCK_IP = {meta:{gen:"2026-09-15"},data:{}};').V2;
  assert.equal(repli.stockDateTxt(AUJ), 'stock du 15 septembre', 'sans date par site : la date générale du fichier');
});

// ── Écran Offilog dans un faux navigateur (même montage que tests/offilog-prix-publics.test.mjs) ──
const EAN = '3000000000001';
function rendre({ cap3000Maj, drakkarsMaj, bestMaj, cmp = '', select = false }) {
  const noop = () => '';
  const fauxEl = () => new Proxy(function () {}, { get: (t, k) => (k === 'style' ? {} : k === 'dataset' ? {} : fauxEl()), apply: () => fauxEl(), set: () => true });
  const doc = { currentScript: null, head: fauxEl(), body: fauxEl(), createElement: fauxEl, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop };
  const V2 = new Proxy({
    esc: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    fmtEur: (n) => 'EUR' + Number(n).toFixed(2), fmtNum: (n) => String(n),
    motion: null, topbar: noop, loadFiles: () => Promise.resolve(), render: noop, pages: {}, TARIF_VIEUX_JOURS: 30,
  }, { get: (t, k) => (k in t ? t[k] : () => ''), set: (t, k, v) => { t[k] = v; return true; } });
  const win = {
    V2, ICO: () => '', document: doc, console, setTimeout, clearTimeout, requestAnimationFrame: noop, Date,
    OFFILOG_BEST: [{ rank: 7, id: '1', name: 'Produit A', brand: 'M', ean: EAN, img: '', cat: 'sante', url: '', price: 10 }],
    OFFILOG_BEST_MAJ: bestMaj,
    DRAKKARS_PUB: { [EAN]: 11 }, DRAKKARS_PUB_MAJ: drakkarsMaj,
    CAP3000_PUB: { [EAN]: 12 }, CAP3000_PUB_MAJ: cap3000Maj,
    OFFILOG: [{ ean: EAN, prix_offilog: 8 }], matchMedia: () => ({ matches: false }), addEventListener: noop, localStorage: { getItem: () => null, setItem: noop },
  };
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.document = doc;
  const a = BOOT.indexOf('V2.dateEnMots = function');   // absent dans l'ancien code : l'écran tourne alors sans la date
  if (a > 0) vm.runInContext(BOOT.slice(a, BOOT.indexOf('  V2.bestPrice = function')), ctx);
  vm.runInContext(OFF, ctx);
  win.V2.offSort('ventes');
  if (cmp) { win.V2.offPorte('comparer'); win.V2.offCmpSens('tous'); win.V2.offCmpSrc(cmp); }   // 22/11/2026, v3 : « Comparer à » est l'onglet « Comparer nos prix »
  if (select) win.V2.offSelect('1');
  const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  win.V2.pages.offilog.render(root, '');
  return root.innerHTML;
}
const hier = (() => { const d = new Date(Date.now() - 86400000); return d.toISOString().slice(0, 10); })();

// 22/11/2026, v3 « Les trois onglets » : la carte n'a plus qu'UNE ligne concurrent (le meilleur) ; les autres vivent dans la fiche du produit (volet),
// qui date tous les relevés (« relevé du 5 juin »). La règle des 30 jours reste vraie sur la carte : un vieux prix y dit sa date, un récent n'en porte pas.
test('Offilog, carte : un prix de concurrent relevé il y a plus de 30 jours dit sa date', () => {
  const h = rendre({ cap3000Maj: '2026-06-05', drakkarsMaj: '2026-09-30', bestMaj: hier, cmp: 'cap3000' });
  assert.match(h, /olm-c-cn">Cap 3000<\/span><span class="olm-c-cv">EUR12\.00<\/span><span class="olm-c-cd">relevé le 5 juin</);
  const d = rendre({ cap3000Maj: '2026-06-05', drakkarsMaj: '2026-09-30', bestMaj: hier, cmp: 'drakkars' });
  assert.match(d, /olm-c-cn">Drakkars<\/span><span class="olm-c-cv">EUR11\.00<\/span><span class="olm-c-cd">relevé le 30 septembre</);
  // la fiche du produit date chaque concurrent, vieux ou non
  const f = rendre({ cap3000Maj: '2026-06-05', drakkarsMaj: '2026-09-30', bestMaj: hier, select: true });
  assert.match(f, /data-achat="Cap 3000">.*?relevé du 5 juin/);
  assert.match(f, /data-achat="Drakkars">.*?relevé du 30 septembre/);
});
test('Offilog, carte : un prix récent ne porte aucune mention (contre-épreuve)', () => {
  const h = rendre({ cap3000Maj: hier, drakkarsMaj: hier, bestMaj: hier, cmp: 'cap3000' });
  assert.match(h, /olm-c-cn">Cap 3000<\/span><span class="olm-c-cv">EUR12\.00<\/span>/);
  assert.doesNotMatch(h, /olm-c-cd|relevé le /);
});
test('Offilog, « Comparer à » : la ligne de la carte et la note disent la date du relevé', () => {
  const h = rendre({ cap3000Maj: '2026-06-05', drakkarsMaj: hier, bestMaj: hier, cmp: 'cap3000' });
  assert.match(h, /olm-c-cv">EUR12\.00<\/span><span class="olm-c-cd">relevé le 5 juin</);
  assert.match(h, /avec un prix relevé chez <b>Cap 3000<\/b> \(relevé du 5 juin\)/);
});
test('Offilog, volet du produit : le rang tiré du classement d\'origine dit la date du classement', () => {
  const h = rendre({ cap3000Maj: hier, drakkarsMaj: hier, bestMaj: '2026-09-03', select: true });
  assert.match(h, /#7 ventes <i[^>]*>· classement du 3 septembre/);
  const frais = rendre({ cap3000Maj: hier, drakkarsMaj: hier, bestMaj: hier, select: true });
  assert.doesNotMatch(frais, /classement du/);
});

test('classement Offilog : le fichier porte sa date (recopiée de son en-tête) et l\'accueil la lit', () => {
  const f = lire('offilog-bestsellers-data.js');
  const entete = (f.split('\n')[1].match(/(\d{4}-\d{2}-\d{2})\s*$/) || [])[1];
  assert.ok(entete, 'date introuvable dans l\'en-tête');
  assert.ok(f.includes('window.OFFILOG_BEST_MAJ="' + entete + '"'), 'OFFILOG_BEST_MAJ absente ou différente de l\'en-tête');
  assert.match(lire('v2-accueil-cinq.js'), /classement du ' \+ esc\(dcl\)/);
});

test('stock : chaque écran qui dit « en stock » donne la date du stock', () => {
  for (const f of ['v2-produits.js', 'v2-comptoir.js', 'v2-pilotage.js', 'v2-molecules.js', 'v2-mkt.js']) {
    assert.match(lire(f), /V2\.stockDateTxt/, f + ' ne lit pas la date du stock');
  }
});
