// CERP et Paraph sur l'écran Offilog (29/10/2026) :
// 1) règle de récence CERP, calculée depuis la date du fichier (jamais une date en dur) ;
// 2) bloc « Prix d'achat » trié du moins cher au plus cher, Offilog en référence ;
// 3) côté OPSO : rien affiché ET les deux fichiers protégés ne sont même pas demandés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'crm/v2/v2-offilog.js'), 'utf8');
const COLS_C = ['code13', 'libelle', 'ppht', 'net', 'remise', 'qtes', 'paliers', 'periode', 'page', 'famille', 'document'];
const COLS_G = ['code', 'libelle', 'groupement', 'annee', 'prix', 'remise', 'net', 'qte', 'periode', 'document'];
const ligneC = (code, ppht, net, qtes, periode) => [code, '210 869 3 LIBELLE SECRET', ppht, net, 0, qtes, '', periode, '1', 'Central Prom', 'x.pdf'];
const CAT = 'paraph/CATALOGUE-CENTRALE-PARAPH-1ERE-EDITION-2025.pdf';
const ligneG = (code, prix, net, doc = CAT, g = 'Paraph') => [code, '', g, 2025, prix, 10, net, null, '', doc];

function rendre({ opso = false, cerp, groupements, prixOffilog = 10, extra = {}, selection = true, avance = false }) {
  const noop = () => '';
  const fauxEl = () => new Proxy(function () {}, { get: (t, k) => (k === 'style' ? {} : k === 'dataset' ? {} : fauxEl()), apply: () => fauxEl(), set: () => true });
  const doc = { currentScript: null, head: fauxEl(), body: fauxEl(), createElement: fauxEl, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop };
  const demandes = [];
  const V2 = new Proxy({
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    fmtEur: (n) => 'EUR' + Number(n).toFixed(2), fmtNum: (n) => String(n),
    motion: null, topbar: noop, loadFiles: (k) => { demandes.push(...k); return Promise.resolve(); }, render: noop, pages: {},
  }, { get: (t, k) => (k in t ? t[k] : () => ''), set: (t, k, v) => { t[k] = v; return true; } });
  const win = {
    V2, ICO: () => '', document: doc, console, setTimeout, clearTimeout, requestAnimationFrame: noop,
    V2_BRAND: opso ? { opso: true } : undefined,
    OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: '3000000000001', img: '', cat: 'sante', url: '', price: prixOffilog }],
    CONCURRENTS_CERP: cerp, CONCURRENTS_GROUPEMENTS: groupements,
    OFFILOG: [], matchMedia: () => ({ matches: false }), addEventListener: noop, localStorage: { getItem: () => null, setItem: noop },
    ...extra,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.document = doc;
  vm.runInContext(SRC, ctx);
  if (selection) win.V2.offSelect('1');
  if (avance) win.V2.offToggleAdv();
  const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  win.V2.pages.offilog.render(root, '');
  return { html: root.innerHTML, demandes };
}
const E1 = '3000000000001';
const cerpDe = (maj, lignes) => ({ maj, cols: COLS_C, rows: lignes });
const grpDe = (lignes) => ({ maj: '2026-09-28', cols: COLS_G, rows: lignes });

test('CERP : la plus récente gagne, à période égale le net le plus bas avec sa quantité', () => {
  const { html } = rendre({ cerp: cerpDe('2026-10-01', [
    ligneC(E1, 12, 8, 'dès 6', 'août 2026'),
    ligneC(E1, 12, 7, 'dès 6 · dès 12', 'octobre 2026'),
    ligneC(E1, 12, 6, 'dès 24', 'octobre 2026'),
    ligneC(E1, 12, 3, 'dès 1', 'août 2025'),
  ]) });
  assert.match(html, /CERP EUR6\.00 dès 24/);
  assert.doesNotMatch(html, /CERP EUR[378]\.00/);
  assert.match(html, /octobre 2026/);
  assert.doesNotMatch(html, /LIBELLE SECRET|210 869 3/, 'le libellé CERP ne s\'affiche jamais');
});

test('CERP : seule une offre récente compte (août 2026 et après, ou tarif 2026) ; le seuil suit la date du fichier', () => {
  const ancien = rendre({ cerp: cerpDe('2026-10-01', [ligneC(E1, 12, 8, 'dès 2', 'juillet 2026')]) });
  assert.doesNotMatch(ancien.html, /CERP EUR/, 'juillet 2026 < août 2026 : trop ancien');
  const juin = rendre({ cerp: cerpDe('2026-10-01', [ligneC(E1, 12, 8, 'dès 2', 'juillet-août 2026')]) });
  assert.doesNotMatch(juin.html, /CERP EUR/, 'une période qui COMMENCE en juillet est trop ancienne');
  const aout = rendre({ cerp: cerpDe('2026-10-01', [ligneC(E1, 12, 8, 'dès 2', 'août 2026')]) });
  assert.match(aout.html, /CERP EUR8\.00 dès 2/);
  const tarif = rendre({ cerp: cerpDe('2026-10-01', [ligneC(E1, 12, 8, 'dès 1', 'tarif 2026')]) });
  assert.match(tarif.html, /CERP EUR8\.00 dès 1/);
  // même ligne, fichier daté plus tard : août 2026 n'est plus récent (pas de date écrite en dur)
  const plusTard = rendre({ cerp: cerpDe('2027-02-01', [ligneC(E1, 12, 8, 'dès 2', 'août 2026')]) });
  assert.doesNotMatch(plusTard.html, /CERP EUR/);
  const plusTardOk = rendre({ cerp: cerpDe('2027-02-01', [ligneC(E1, 12, 8, 'dès 2', 'décembre 2026')]) });
  assert.match(plusTardOk.html, /CERP EUR8\.00 dès 2/);
});

test('Paraph : l\'année est dans l\'étiquette ; zéros de tête restitués ; seul le catalogue 2025 compte', () => {
  const { html } = rendre({ groupements: grpDe([ligneG('3000000000001', 15, 13.02), ligneG(E1, 9, 1, 'autre.pdf'), ligneG(E1, 9, 1, CAT, 'Aptiphar')]) });
  assert.match(html, /Paraph 2025 EUR13\.02/);
  assert.doesNotMatch(html, /NaN|undefined/);
  const court = rendre({ groupements: grpDe([ligneG('3000000001', 15, 5)]), extra: { OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: '0003000000001', img: '', cat: 'sante', url: '', price: 10 }] } });
  assert.match(court.html, /Paraph 2025 EUR5\.00/, 'code à 10 chiffres restitué sur 13');
});

test('bloc « Prix d\'achat » : trié du moins cher au plus cher, Offilog en référence, écart en € et en %', () => {
  const { html } = rendre({
    cerp: cerpDe('2026-10-01', [ligneC(E1, 14, 7.5, 'dès 2', 'octobre 2026')]),
    groupements: grpDe([ligneG(E1, 15, 12.5)]),
    extra: { SAGITTA_PRIX: { [E1]: [9, 11, 20] }, SAGITTA_PRIX_MAJ: '2026-06-04' },
  });
  const bloc = html.slice(html.indexOf('id="off-achat"'));
  const ordre = [...bloc.matchAll(/data-achat="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ordre, ['CERP', 'Sagitta', 'Offilog', 'Paraph']);
  assert.match(bloc, /class="off-cmp-ref" data-achat="Offilog"/);
  assert.match(bloc, /−EUR2\.50 · −25 %/);   // CERP 7,50 contre 10
  assert.match(bloc, /\+EUR2\.50 · \+25 %/); // Paraph 12,50 contre 10
  assert.match(bloc, /04\/06\/2026/);
  // outil de mesure : sans aucune plateforme, pas de bloc
  const vide = rendre({});
  assert.doesNotMatch(vide.html, /id="off-achat"/);
});

test('filtres : « Moins cher chez CERP » et « Moins cher chez Paraph » comptent les bons produits', () => {
  const { html } = rendre({ cerp: cerpDe('2026-10-01', [ligneC(E1, 14, 7.5, 'dès 2', 'octobre 2026')]), groupements: grpDe([ligneG(E1, 15, 12.5)]), selection: false, avance: true });
  assert.match(html, /Moins cher chez CERP<span class="cnt">1</);
  assert.match(html, /Moins cher chez Paraph<span class="cnt">0</);
});

test('OPSO : ni CERP ni Paraph affichés, et les deux fichiers ne sont pas demandés', () => {
  const cerp = cerpDe('2026-10-01', [ligneC(E1, 14, 7.5, 'dès 2', 'octobre 2026')]);
  const groupements = grpDe([ligneG(E1, 15, 12.5)]);
  const o = rendre({ opso: true, cerp, groupements, prixOffilog: 20, selection: true });
  assert.doesNotMatch(o.html, /CERP|Paraph|off-achat/);
  assert.ok(!o.demandes.includes('conccerp') && !o.demandes.includes('concgroupements'), 'demandés : ' + o.demandes);
  const o2 = rendre({ opso: true, cerp: undefined, groupements: undefined, selection: false });
  assert.ok(!o2.demandes.includes('conccerp') && !o2.demandes.includes('concgroupements'));
  // contrôle de l'outil : côté CRM les mêmes données s'affichent et les fichiers sont demandés
  const c = rendre({ cerp: undefined, groupements: undefined, selection: false });
  assert.ok(c.demandes.includes('conccerp') && c.demandes.includes('concgroupements'), 'CRM : ' + c.demandes);
  const c2 = rendre({ cerp, groupements, prixOffilog: 20 });
  assert.match(c2.html, /CERP EUR7\.50/);
});
