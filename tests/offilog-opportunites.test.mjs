// Onglet « Opportunités » de la porte « Comparer nos prix » (18/11/2026) :
// photo datée lue dans les données, 4 filtres comptés, ligne cliquable seulement si le produit est chargé,
// promotion Pharmazon signalée, rien du tout côté OPSO, et le fichier de données n'entre jamais dans git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog.js'), 'utf8');
const BOOT = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-boot.js'), 'utf8');
const COLS = ['id', 'marque', 'produit', 'prix_offilog', 'concurrent', 'prix_concurrent', 'date_concurrent', 'ecart_pct', 'public_min', 'public_min_ou', 'marge_pct', 'promo_pz', 'sans_promo', 'nb_sources'];
const DONNEES = {
  date: '2026-11-17', cols: COLS, fragiles_exclus: 7,
  periodes: { prix_offilog: 'prix Offilog du 16 et 17/11', prix_concurrents: 'prix d\'achat des concurrents de juin à octobre 2026' },
  solides: [['1', 'MARQUE A', 'Produit A', 10, 'CERP', 12, '2026-09', -16.7, 14.5, 'Leclerc', 31.2, null, null, 2], ['999', 'MARQUE B', 'Produit inconnu', 5, 'Sagitta', 6, '2026', -16.7, null, null, null, null, null, 1]],
  sanspublic: [['3', 'M', 'Sans public', 5, 'Sagitta', 6, '2026', -10, null, null, null, null, null, 1]],
  margecourte: [],
  pluscher: [['4', 'PUR', 'Sirop Test', 6.86, 'Pharmazon', 4.5, '2026-09', 52.4, 8.99, 'Leclerc', 12, 'oui', 'Offilog moins cher que toutes les autres sources', 2]],
};

function rendre({ opso = false, donnees = DONNEES, onglet = 'opp', filtre = null, q = null, sel = null, espion = false }) {
  const noop = () => '';
  const fauxEl = () => new Proxy(function () {}, { get: (t, k) => (k === 'style' ? {} : k === 'dataset' ? {} : fauxEl()), apply: () => fauxEl(), set: () => true });
  const poses = [], volet = { volet: true };
  const corps = espion ? new Proxy(fauxEl(), { get: (t, k) => (k === 'appendChild' ? (el) => { poses.push(el); } : k === 'querySelector' ? () => null : t[k]) }) : fauxEl();
  const doc = { currentScript: null, head: fauxEl(), body: corps, createElement: fauxEl, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop };
  const V2 = new Proxy({
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    fmtEur: (n) => 'EUR' + Number(n).toFixed(2), fmtNum: (n) => String(n),
    motion: null, topbar: noop, loadFiles: () => Promise.resolve(), render: noop, pages: {},
  }, { get: (t, k) => (k in t ? t[k] : () => ''), set: (t, k, v) => { t[k] = v; return true; } });
  const win = {
    V2, ICO: () => '', document: doc, console, setTimeout, clearTimeout, requestAnimationFrame: noop,
    V2_BRAND: opso ? { opso: true } : undefined,
    OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: '3000000000001', img: '', cat: 'sante', url: '', price: 10 }],
    OFFILOG_OPPORTUNITES: donnees,
    OFFILOG: [], matchMedia: () => ({ matches: false }), addEventListener: noop, localStorage: { getItem: () => null, setItem: noop },
  };
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.document = doc;
  // 22/11/2026, v3 : le CRM écrit toutes ses dates en mots (« 17 novembre ») avec la vraie V2.dateEnMots de v2-boot.js (lue ici, pas simulée).
  vm.runInContext(BOOT.slice(BOOT.indexOf('V2.dateEnMots = function'), BOOT.indexOf('  V2.bestPrice = function')), ctx);
  vm.runInContext(SRC, ctx);
  win.V2.offPorte('comparer');
  win.V2.offOppOnglet(onglet);
  if (filtre) win.V2.offOppFiltre(filtre);
  if (q != null) { win.V2.offOppSearch(q); }
  if (sel) win.V2.offSelect(sel);
  const root = { innerHTML: '', querySelector: (s) => (espion && s === '.off-insp' ? volet : null), querySelectorAll: () => [] };
  win.V2.pages.offilog.render(root, '');
  return espion ? { h: root.innerHTML, poses, volet } : root.innerHTML;
}

test('l\'onglet porte la date de la photo, la phrase sur les fragiles et les 4 filtres comptés depuis les données', () => {
  const h = rendre({});
  assert.match(h, /Photo du 17 novembre</);   // 22/11/2026, v3 : « 17 novembre » (était « 17/11/2026 »), date lue dans le fichier
  assert.match(h, /7 produits « fragiles » sont écartés/);
  for (const [nom, n] of [['Opportunités solides', 2], ['Moins cher, sans prix public', 1], ['Moins cher, marge courte', 0], ['À ne pas pousser sur le prix', 1]]) {
    assert.match(h, new RegExp(nom + '<span class="cnt">' + n + '</span>'), nom);
  }
  assert.match(h, /Produit A/);
  assert.match(h, /CERP/);
});

test('ligne cliquable seulement si la fiche existe dans les données Offilog chargées', () => {
  const h = rendre({});
  assert.match(h, /onclick="V2\.offSelect\('1'\)"/);
  assert.doesNotMatch(h, /offSelect\('999'\)/);
  assert.match(h, /Produit inconnu/);
});

test('« À ne pas pousser » : promotion Pharmazon et phrase sans la promotion', () => {
  const h = rendre({ filtre: 'pluscher' });
  assert.match(h, /Promotion Pharmazon\./);
  assert.match(h, /Sans la promotion Pharmazon : Offilog moins cher que toutes les autres sources\./);
  assert.doesNotMatch(h, /\bremise\b/i);
});

test('recherche par marque ou produit (sans tenir compte des accents)', () => {
  const h = rendre({ q: 'marque b' });
  assert.match(h, /Produit inconnu/);
  assert.doesNotMatch(h, /Produit A/);
});

test('recherche mot par mot : chaque mot tapé, n\'importe où dans marque + libellé, ordre libre (choix de Will, 18/11/2026)', () => {
  // Cas réel : « neutraderm baby » ne trouvait pas « NEUTRADERM · Neutraderm – Baby liniment » (suite exacte cherchée).
  const reel = { ...DONNEES, solides: [['44905', 'NEUTRADERM', 'Neutraderm – Baby liniment', 2.91, 'CERP', 3.5, '2026-09', -16.9, 4.2, 'Leclerc', 30, null, null, 2], ...DONNEES.solides] };
  const h = rendre({ donnees: reel, q: 'neutraderm baby' });
  assert.match(h, /Baby liniment/);
  assert.doesNotMatch(h, /Produit A/);
  const desordre = rendre({ q: '  Inconnu   marque ' });
  assert.match(desordre, /Produit inconnu/);
  assert.doesNotMatch(desordre, /Produit A/);
  assert.match(rendre({ q: 'marque introuvable' }), /Aucun produit ne correspond/);
});

test('l\'onglet « Face aux plateformes » garde le comparatif d\'avant', () => {
  const h = rendre({ onglet: 'plateformes' });
  assert.match(h, /data-onglet="opp"/);
  assert.doesNotMatch(h, /Photo du 17 novembre/);
});

test('OPSO : ni onglet ni opportunités (conditions de tiers)', () => {
  const h = rendre({ opso: true });
  assert.doesNotMatch(h, /data-onglet|Opportunités|Photo du|olo-/);
});

test('fichier de données jamais suivi par git, protégé dans les trois tables de v2-boot.js', () => {
  assert.doesNotThrow(() => execFileSync('git', ['check-ignore', '-q', 'crm/v2/offilog-opportunites.js'], { cwd: RACINE }));
  const suivis = execFileSync('git', ['ls-files'], { cwd: RACINE, encoding: 'utf8' }).split('\n').filter((f) => /opportunites/i.test(f));
  assert.ok(!suivis.includes('crm/v2/offilog-opportunites.js'));
  const boot = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-boot.js'), 'utf8');
  assert.equal((boot.match(/offilogopp:/g) || []).length, 3);
});

test('fiche ouverte depuis une ligne : le volet vit sous <body> (dans la racine, il se calerait sur la page et non sur l\'écran)', () => {
  const { h, poses, volet } = rendre({ sel: '1', espion: true });
  assert.match(h, /class="off-insp open"/);
  assert.ok(poses.includes(volet));
});
