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

function rendre({ opso = false, cerp, groupements, prixOffilog = 10, extra = {}, selection = true, avance = false, apres = null }) {
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
  if (apres) apres(win.V2);
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
  assert.deepEqual(ordre, ['Sagitta', 'Offilog', 'Paraph', 'CERP']); // CERP : repère neutre, toujours en dernier
  assert.match(bloc, /class="off-cmp-ref" data-achat="Offilog"/);
  // CERP (7,50 contre 10) : prix visible, mais aucun écart, aucune couleur « moins cher »
  const ligneCerp = bloc.match(/<div class="off-cmp-row" data-achat="CERP">.*?<\/div>/)[0];
  assert.match(ligneCerp, /EUR7\.50/);
  assert.doesNotMatch(ligneCerp, /off-cmp-delta (ok|bad)|below|bad|−|\d %/); // la case d'écart reste vide
  assert.match(bloc, /−EUR1\.00 · −10 %/);   // Sagitta 9 contre 10 : l'écart reste calculé pour les autres
  assert.match(bloc, /\+EUR2\.50 · \+25 %/); // Paraph 12,50 contre 10
  assert.match(bloc, /04\/06\/2026/);
  // outil de mesure : sans aucune plateforme, pas de bloc
  const vide = rendre({});
  assert.doesNotMatch(vide.html, /id="off-achat"/);
});

test('CERP : prix visible sur la carte, mais aucun marquage « moins cher », aucun filtre, aucun compteur', () => {
  const { html } = rendre({ cerp: cerpDe('2026-10-01', [ligneC(E1, 14, 7.5, 'dès 2', 'octobre 2026')]), selection: false, avance: true });
  assert.match(html, /CERP EUR7\.50 dès 2/, 'le prix CERP reste affiché');
  assert.doesNotMatch(html, /off-card-pz win[^>]*>CERP/, 'CERP est moins cher que 10 mais ne gagne aucune pastille');
  assert.doesNotMatch(html, /Moins cher chez|cerpcheaper/);
  assert.doesNotMatch(html, /data-cmp-src="cerp"/, 'CERP ne figure pas dans « Comparer à »');
  // contrôle de l'outil : Paraph, lui, reste un concurrent comparable et sa pastille « win » existe
  const p = rendre({ groupements: grpDe([ligneG(E1, 8, 7)]), selection: false });
  assert.match(p.html, /off-card-pz win[^>]*>Paraph/);
});

test('Comparer à : concurrents d\'achat et publics, comptes, sens et écart recalculés à la main', () => {
  const src = { groupements: grpDe([ligneG(E1, 15, 12.5)]), extra: { FARMALINE_PUB: { [E1]: 8 }, FARMALINE_PUB_MAJ: '2026-09-10', CITYPHARMA_PUB: { [E1]: 11.5 }, CITYPHARMA_PUB_MAJ: '2026-10-30', OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: E1, img: '', cat: 'sante', url: '', price: 10 }, { rank: 2, id: '2', name: 'Produit B', brand: 'M', ean: '3000000000002', img: '', cat: 'sante', url: '', price: 10 }], OFFILOG: [{ ean: E1, prix_offilog: 9 }, { ean: '3000000000002', prix_offilog: 9 }] }, selection: false };
  const base = rendre(src).html;
  assert.match(base, /data-cmp-src="paraph"[^>]*>.*?Paraph<span class="cnt">1</);
  assert.match(base, /data-cmp-src="citypharma"[^>]*>.*?Citypharma<span class="cnt">1</);
  assert.match(base, /data-cmp-sens="moins"[^>]*>Moins cher que nous<span class="cnt">1</, 'au moins un concurrent moins cher : Farmaline 8 < achat IP 9');
  // concurrent choisi : Citypharma public TTC 11,50 face à notre achat IP 9,00 -> +2,50 € et +28 % (2,5/9 = 27,8)
  const choisi = rendre({ ...src, apres: (V2) => V2.offCmpSrc('citypharma') }).html;
  assert.match(choisi, /Citypharma public TTC EUR11\.50<\/span><span class="off-pcat-pill">\+EUR2\.50 · \+28 %</);
  assert.match(choisi, /data-cmp-sens="plus"[^>]*>Plus cher que nous<span class="cnt">1</);
  assert.match(choisi, /data-cmp-sens="moins"[^>]*>Moins cher que nous<span class="cnt">0</);
  // un prix d'ACHAT se compare au prix Offilog : Paraph 12,50 contre 10 -> +2,50 € et +25 %
  const achat = rendre({ ...src, apres: (V2) => V2.offCmpSrc('paraph') }).html;
  assert.match(achat, /Paraph achat HT EUR12\.50<\/span><span class="off-pcat-pill">\+EUR2\.50 · \+25 %</);
  // sens « moins » avec Farmaline : seul le produit qui porte le prix passe, écart -1,00 € et -11 %
  const moins = rendre({ ...src, apres: (V2) => { V2.offCmpSrc('farmaline'); V2.offCmpSens('moins'); } }).html;
  assert.match(moins, /Farmaline public TTC EUR8\.00<\/span><span class="off-pcat-pill">−EUR1\.00 · −11 %</);
  assert.equal((moins.match(/class="off-card /g) || []).length, 1, 'une seule carte reste');
});

test('Comparer à, OPSO : jamais « moins cher que nous », aucune source masquée, aucun prix sous le prix Offilog', () => {
  const extra = { FARMALINE_PUB: { [E1]: 8 }, CITYPHARMA_PUB: { [E1]: 12 }, CITYPHARMA_PUB_MAJ: '2026-10-30', FARMALINE_PUB_MAJ: '2026-09-10',
    SAGITTA_PRIX: { [E1]: [5, 6, 7] }, OFFILOG_BEST: [{ rank: 1, id: '1', name: 'Produit A', brand: 'M', ean: E1, img: '', cat: 'sante', url: '', price: 10 }] };
  const o = rendre({ opso: true, extra, selection: false, groupements: grpDe([ligneG(E1, 8, 7)]), cerp: cerpDe('2026-10-01', [ligneC(E1, 14, 7.5, 'dès 2', 'octobre 2026')]) });
  assert.doesNotMatch(o.html, /data-cmp-sens="moins"|Moins cher que nous/);
  assert.match(o.html, /data-cmp-sens="plus"[^>]*>Plus cher que nous<span class="cnt">1</);
  assert.doesNotMatch(o.html, /data-cmp-src="(pz|sg|ocp|paraph|cerp)"/, 'sources masquées sur OPSO');
  assert.match(o.html, /data-cmp-src="citypharma"/);
  assert.doesNotMatch(o.html, /data-cmp-src="farmaline"/, 'Farmaline à 8 < 10 : masqué, donc source absente');
  // même en forçant le sens « moins » par le code, OPSO retombe sur « Tous » et n'affiche rien sous le prix Offilog
  const f = rendre({ opso: true, extra, selection: false, apres: (V2) => { V2.offCmpSrc('citypharma'); V2.offCmpSens('moins'); } });
  assert.doesNotMatch(f.html, /Farmaline EUR8/);
  assert.match(f.html, /Citypharma public TTC EUR12\.00<\/span><span class="off-pcat-pill">\+EUR2\.00 · \+20 %</);
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

test('Comparer à, sans concurrent choisi : « plus / moins cher » = au moins un concurrent dans ce sens', () => {
  const E2 = '3000000000002', E3 = '3000000000003';
  const extra = {
    OFFILOG_BEST: [E1, E2, E3].map((e, i) => ({ rank: i + 1, id: String(i + 1), name: 'P' + i, brand: 'M', ean: e, img: '', cat: 'sante', url: '', price: 10 })),
    OFFILOG: [E1, E2, E3].map((e) => ({ ean: e, prix_offilog: 9 })),
    FARMALINE_PUB: { [E1]: 12 },        // plus cher que notre achat (9)
    CITYPHARMA_PUB: { [E2]: 8 },        // moins cher
    MAXIPARA_PUB: { [E2]: 15 },         // E2 : un moins cher ET un plus cher
  };
  const h = rendre({ extra, selection: false }).html;
  assert.match(h, /data-cmp-sens="moins"[^>]*>Moins cher que nous<span class="cnt">1</);
  assert.match(h, /data-cmp-sens="plus"[^>]*>Plus cher que nous<span class="cnt">2</);   // E1 (Farmaline) et E2 (Maxi Para)
  assert.match(h, /data-cmp-sens="tous"[^>]*>Tous<span class="cnt">3</);
});
