// Prix PUBLICS Farmaline / Maxi Para / Cap 3000 sur l'écran Offilog (29/10/2026).
// 1) la règle OPSO « jamais moins cher que nous » : un prix public < prix Offilog n'apparaît pas côté OPSO,
//    il apparaît côté CRM ; égal ou supérieur, il apparaît partout ;
// 2) les fichiers générés ne portent que « EAN -> prix » (jamais nos conditions : Maxi Para en particulier).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog.js'), 'utf8');
const BOOT = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-boot.js'), 'utf8');

// Rend l'écran Offilog dans un faux navigateur et rend le HTML produit.
function rendre({ opso, farmaline, maxipara, cap3000, citypharma = {}, fiche = false, comparer = false }) {
  const noop = () => '';
  const fauxEl = () => new Proxy(function () {}, { get: (t, k) => (k === 'style' ? {} : k === 'dataset' ? {} : fauxEl()), apply: () => fauxEl(), set: () => true });
  const doc = { currentScript: null, head: fauxEl(), body: fauxEl(), createElement: fauxEl, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop };
  const V2 = new Proxy({
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    fmtEur: (n) => 'EUR' + Number(n).toFixed(2), fmtNum: (n) => String(n),
    motion: null, topbar: noop, loadFiles: () => Promise.resolve(), render: noop, pages: {},
  }, { get: (t, k) => (k in t ? t[k] : () => '') , set: (t, k, v) => { t[k] = v; return true; } });
  const win = {
    V2, ICO: () => '', document: doc, console, setTimeout, clearTimeout, requestAnimationFrame: noop,
    V2_BRAND: opso ? { opso: true } : undefined,
    // deux produits : le prix Offilog est 10,00
    OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: '3000000000001', img: '', cat: 'sante', url: '', price: 10 }],
    FARMALINE_PUB: farmaline, FARMALINE_PUB_MAJ: '2026-09-10',
    MAXIPARA_PUB: maxipara, MAXIPARA_PUB_MAJ: '2026-04-15',
    CAP3000_PUB: cap3000, CAP3000_PUB_MAJ: '2026-10-29',
    CITYPHARMA_PUB: citypharma, CITYPHARMA_PUB_MAJ: '2026-10-30',
    OFFILOG: [], matchMedia: () => ({ matches: false }), addEventListener: noop, localStorage: { getItem: () => null, setItem: noop },
  };
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.document = doc;
  // 22/11/2026, v3 : dates en mots (« 10 septembre ») avec la vraie V2.dateEnMots de v2-boot.js.
  vm.runInContext(BOOT.slice(BOOT.indexOf('V2.dateEnMots = function'), BOOT.indexOf('  V2.bestPrice = function')), ctx);
  vm.runInContext(SRC, ctx);
  // 22/11/2026, v3 « Les trois onglets » : plus d'écran d'arrivée, l'onglet « Trouver » montre les cartes tout de suite.
  // `fiche` ouvre la fiche du produit (tous les concurrents, datés) ; `comparer` ouvre l'onglet « Comparer nos prix ».
  win.V2.offSort('ventes');
  if (comparer) win.V2.offPorte('comparer');
  if (fiche) win.V2.offSelect('1');
  const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  win.V2.pages.offilog.render(root, '');
  return root.innerHTML;
}

const EAN = '3000000000001';

const ligneFiche = (h, nom) => (h.slice(h.indexOf('id="off-achat"')).match(new RegExp('<div class="olm-f-r[^"]*" data-achat="' + nom + '">.*?</div>')) || [''])[0];

test('CRM : les trois prix publics s\'affichent, même sous le prix Offilog', () => {
  // 22/11/2026, v3 : la carte montre le meilleur concurrent (une ligne), la fiche du produit les montre TOUS, avec la date de chaque relevé.
  const h = rendre({ opso: false, farmaline: { [EAN]: 9 }, maxipara: { [EAN]: 8.5 }, cap3000: { [EAN]: 12 }, fiche: true });
  assert.match(ligneFiche(h, 'Farmaline'), /EUR9\.00/);
  assert.match(ligneFiche(h, 'Maxi Para'), /relevé du 15 avril/);
  assert.match(ligneFiche(h, 'Maxi Para'), /EUR8\.50/);
  assert.match(ligneFiche(h, 'Cap 3000'), /EUR12\.00/);
  assert.match(ligneFiche(h, 'Farmaline'), /relevé du 10 septembre/);
  assert.match(h, /olm-c-cn">Maxi Para<\/span><span class="olm-c-cv">EUR8\.50</, 'la carte montre le prix public le plus bas, même sous le prix Offilog');
});

test('OPSO : jamais moins cher que nous (< prix Offilog masqué, = ou > affiché)', () => {
  const h = rendre({ opso: true, farmaline: { [EAN]: 9.99 }, maxipara: { [EAN]: 10 }, cap3000: { [EAN]: 12 } });
  assert.doesNotMatch(h, /Farmaline EUR/, 'Farmaline à 9,99 < 10,00 doit être masqué');
  assert.match(h, /Maxi Para EUR10\.00/, 'à égalité : affiché, comme Leclerc');
  assert.match(h, /Cap 3000 EUR12\.00/);
});

test('OPSO : si aucun prix public n\'est >= au nôtre, rien n\'est affiché', () => {
  const h = rendre({ opso: true, farmaline: { [EAN]: 5 }, maxipara: { [EAN]: 6 }, cap3000: { [EAN]: 7 } });
  assert.doesNotMatch(h, /Farmaline EUR|Maxi Para EUR|Cap 3000 EUR/);
});

test('onglets CRM (22/11/2026, v3 ; remplace l\'arrivée à trois portes du 06/11) : trois onglets, les cartes tout de suite ; « Comparer » ne cite que les plateformes qui ont un prix', () => {
  const seul = rendre({ opso: false, farmaline: {}, maxipara: {}, cap3000: {}, citypharma: { [EAN]: 9 }, comparer: true });
  assert.equal((seul.match(/class="olm-onglet[^"]*" role="tab" id="olm-t-(trouver|catalogue|comparer)" data-porte="(trouver|catalogue|comparer)"/g) || []).length, 3);
  const trouver = rendre({ opso: false, farmaline: {}, maxipara: {}, cap3000: {}, citypharma: { [EAN]: 9 } });
  assert.match(trouver, /Produit A/, 'v3 : plus d\'écran d\'arrivée sans carte, l\'onglet « Trouver » les montre aussitôt');
  const cites = (h) => [...h.matchAll(/class="olm-conc[^"]*"[^>]*data-cmp-src="([^"]+)"/g)].map((m) => m[1]).filter((k) => k !== 'tous');
  assert.deepEqual(cites(seul), ['citypharma']);
  // contre-épreuve : deux plateformes chargées → les deux sont citées, celle sans prix ne l'est pas
  const deux = rendre({ opso: false, farmaline: { [EAN]: 9 }, maxipara: {}, cap3000: {}, citypharma: { [EAN]: 9 }, comparer: true });
  assert.deepEqual(cites(deux).sort(), ['citypharma', 'farmaline']);
});

test('contrôle de l\'outil : le faux navigateur voit bien la carte du produit', () => {
  const h = rendre({ opso: false, farmaline: {}, maxipara: {}, cap3000: {} });
  assert.match(h, /Produit A/);
  assert.doesNotMatch(h, /Farmaline EUR/);
});

test('fichiers générés : seulement « EAN13 -> prix » et la date du relevé, aucune condition', () => {
  for (const [f, nom] of [['farmaline', 'FARMALINE'], ['maxipara', 'MAXIPARA'], ['cap3000', 'CAP3000'], ['citypharma', 'CITYPHARMA']]) {
    const chemin = path.join(RACINE, `crm/v2/${f}-pub-data.js`);
    if (!fs.existsSync(chemin)) continue; // Cap 3000 peut manquer tant que le relevé n'est pas fait
    const t = fs.readFileSync(chemin, 'utf8');
    const m = t.match(new RegExp(`const ${nom}_PUB = (\\{.*\\});\\n`));
    assert.ok(m, f + ' : tableau introuvable');
    const d = JSON.parse(m[1]);
    const ks = Object.keys(d);
    assert.ok(ks.length > 500, f + ' : trop peu d\'EAN (' + ks.length + ')');
    for (const k of ks) { assert.match(k, /^\d{13}$/); assert.equal(typeof d[k], 'number'); assert.ok(d[k] > 0 && d[k] < 5000); }
    assert.match(t, new RegExp(`const ${nom}_PUB_MAJ = "\\d{4}-\\d{2}-\\d{2}";`));
    for (const interdit of ['Prix_Achat', 'Ecart', 'Marge', 'Potentiel', 'prix_offilog', 'marge_pct']) assert.ok(!t.includes(interdit), f + ' : ' + interdit);
  }
});

// ── Citypharma (30/10/2026) ──
test('Citypharma CRM : prix affiché même sous le prix Offilog, avec la date du relevé et la pastille-filtre', () => {
  const h = rendre({ opso: false, farmaline: {}, maxipara: {}, cap3000: {}, citypharma: { [EAN]: 9 }, fiche: true });
  // 22/11/2026, v3 : la ligne carte (une ligne concurrent) et la fiche (prix + « relevé du 30 octobre »)
  assert.match(h, /olm-c-cn">Citypharma<\/span><span class="olm-c-cv">EUR9\.00</);
  assert.match(ligneFiche(h, 'Citypharma'), /EUR9\.00/);
  assert.match(ligneFiche(h, 'Citypharma'), /relevé du 30 octobre/);
  // la pastille-filtre vit dans le panneau « Filtres » (fermé au rendu) : on contrôle sa déclaration, son filtre et son compteur
  assert.match(SRC, /k: 'citypharmapub', label: 'Vendu chez Citypharma'/);
  assert.match(SRC, /if \(k === 'citypharmapub'\) return it\.pub\.citypharma > 0;/);
  assert.match(SRC, /if \(it\.pub\.citypharma > 0\) c\.citypharmapub\+\+;/);
});

test('Citypharma OPSO : masqué sous le prix Offilog, affiché à égalité ou au-dessus (compteur éprouvé des deux côtés)', () => {
  const sous = rendre({ opso: true, farmaline: {}, maxipara: {}, cap3000: {}, citypharma: { [EAN]: 9.99 } });
  assert.doesNotMatch(sous, /Citypharma EUR/);
  const egal = rendre({ opso: true, farmaline: {}, maxipara: {}, cap3000: {}, citypharma: { [EAN]: 10 } });
  assert.match(egal, /Citypharma EUR10\.00/);
  const dessus = rendre({ opso: true, farmaline: {}, maxipara: {}, cap3000: {}, citypharma: { [EAN]: 14.5 } });
  assert.match(dessus, /Citypharma EUR14\.50/);
});

test('Citypharma : le générateur écarte non achetables et doublons de rayon, garde les prix lus', () => {
  const gen = path.join(RACINE, 'scripts/generate_plateformes_pub.py');
  const f = path.join(os.tmpdir(), 'test-citypharma-releve-' + process.pid + '.jsonl');
  const l = (id, ean, prix, achetable) => JSON.stringify({ id, ean, nom: 'x', prix, achetable, rayon: 'r', page: 1, pages: 1 });
  fs.writeFileSync(f, [l('1', EAN, 12, true), l('2', EAN, 11, true), l('3', EAN, 5, false), l('1', EAN, 1, true)].join('\n') + '\n');
  try {
    // on charge le générateur sans lancer sa fonction principale, puis on appelle seulement la lecture
    const py = 'import sys,json\nsrc=open(sys.argv[1]).read().replace("\\nmain()","\\n")\nns={"__file__":sys.argv[1]}\nexec(compile(src,"g","exec"),ns)\np,st=ns["lire_citypharma"](sys.argv[2])\nprint(json.dumps([p,st]))';
    const [paires, st] = JSON.parse(execFileSync('python3', ['-I', '-c', py, gen, f], { encoding: 'utf8' }));
    assert.deepEqual(paires, [[EAN, 12], [EAN, 11]]); // le 3e est non achetable, le 4e est le même produit que le 1er
    assert.equal(st.non_achetables, 1);
    assert.equal(st.doublons_rayons, 1);
  } finally { fs.unlinkSync(f); }
});

test('Citypharma : aucun code « autre article » (CITYPHARMA_ECARTES) dans le fichier servi, leur nombre en tête', () => {
  const gen = path.join(RACINE, 'scripts/generate_plateformes_pub.py');
  const py = 'import sys,json\nsrc=open(sys.argv[1]).read().replace("\\nmain()","\\n")\nns={"__file__":sys.argv[1]}\nexec(compile(src,"g","exec"),ns)\nprint(json.dumps(sorted(ns["CITYPHARMA_ECARTES"])))';
  const ecartes = JSON.parse(execFileSync('python3', ['-I', '-c', py, gen], { encoding: 'utf8' }));
  const src = fs.readFileSync(path.join(RACINE, 'crm/v2/citypharma-pub-data.js'), 'utf8');
  const prix = JSON.parse(src.match(/const CITYPHARMA_PUB = (\{.*?\});/)[1]);
  assert.ok(ecartes.length > 0 && ecartes.every(e => /^\d{13}$/.test(e)));
  assert.deepEqual(ecartes.filter(e => e in prix), []);
  assert.match(src, /^\/\/ \d+ EAN écartés : /m);
});
