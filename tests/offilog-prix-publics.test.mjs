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

// Rend l'écran Offilog dans un faux navigateur et rend le HTML produit.
function rendre({ opso, farmaline, maxipara, cap3000, citypharma = {} }) {
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
  vm.runInContext(SRC, ctx);
  const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  win.V2.pages.offilog.render(root, '');
  return root.innerHTML;
}

const EAN = '3000000000001';

test('CRM : les trois prix publics s\'affichent, même sous le prix Offilog', () => {
  const h = rendre({ opso: false, farmaline: { [EAN]: 9 }, maxipara: { [EAN]: 8.5 }, cap3000: { [EAN]: 12 } });
  assert.match(h, /Farmaline EUR9\.00/);
  assert.match(h, /Maxi Para EUR8\.50/);
  assert.match(h, /Cap 3000 EUR12\.00/);
  assert.match(h, /relevé du 10\/09\/2026/);
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
  const h = rendre({ opso: false, farmaline: {}, maxipara: {}, cap3000: {}, citypharma: { [EAN]: 9 } });
  assert.match(h, /Citypharma EUR9\.00/);
  assert.match(h, /relevé du 30\/10\/2026/);
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
