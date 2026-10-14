/* marge-2027-suite.test.mjs — suite « Notre marge » et année 2027 (14/10/2026)
 *
 * Quatre choses sont vérifiées sur le VRAI code (jamais recopié), avec des données 100 % INVENTÉES
 * (aucun taux, aucun seuil, aucun nom de contrat réel : le contrat OPSO est confidentiel) :
 *   (a) OPSO, ventes 2026 seules : le bloc « Rémunération du groupement » ne change pas d'un chiffre ni d'une lettre ;
 *   (b) OPSO, ventes 2026 + 2027 : année la plus récente par défaut, bouton par année, `effet` et prime
 *       limités à l'année de l'accord, « nouvelle pharmacie » = aucune vente les années d'avant ;
 *   (c) export « Mes clients en Excel » : la ligne TOTAL additionne les colonnes « Notre marge » ;
 *   (d) V2.notreMarge : marque(), jusqua(), libelleDate() dans l'espace Escale et hors Escale.
 *
 * Rejouer sur l'ANCIEN code (chaque assertion de (b), (c), (d) doit alors échouer) :
 *   MARGE2027_AVANT=/chemin/vers/copie node --test tests/marge-2027-suite.test.mjs
 * où la copie reprend l'arborescence (opso/v2/…, crm/v2/…) avec les fichiers d'origine
 * (`git show origin/main:<fichier>`). Le test (a) compare l'ancien et le nouveau fichier : il est sauté sans copie.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const AVANT = process.env.MARGE2027_AVANT || '';
const chemin = (rel) => (AVANT && existsSync(join(AVANT, rel)) ? join(AVANT, rel) : join(RACINE, rel));
const lire = (rel) => readFileSync(chemin(rel), 'utf8');

function fonction(src, nom) {
  const i = src.indexOf('function ' + nom + '(');
  assert.ok(i >= 0, `function ${nom}( introuvable`);
  let p = 0, j = src.indexOf('{', i), fin = j;
  for (; j < src.length; j++) {
    if (src[j] === '{') p++;
    else if (src[j] === '}') { p--; if (p === 0) { fin = j; break; } }
  }
  return src.slice(i, fin + 1);
}

/* ═════════════════════ OPSO : le VRAI opso-remuneration.js dans un vm ═════════════════════ */

// Contrat INVENTÉ : trois quadrimestres, deux tranches, un motif d'exclusion, une prime, accord à partir de mai.
const CONTRAT = () => ({
  version: 'test', effet: 5,
  periodes: [{ de: 1, a: 4 }, { de: 5, a: 8 }, { de: 9, a: 12 }],
  tranches: [{ jusqua: 10000, taux: 0.01, exclut: ['x'] }, { jusqua: null, taux: 0.02, exclut: ['x'] }],
  motifs: { x: { label: 'Motif inventé', cip7: ['9999999'] } },
  ordre: ['x'], paiement: { jours: 30, finDeMois: true },
  prime: { montant: 100, depuis: 3 },
});
const vente = (ph, an, mois, ca) => ({ pharmacyId: ph, year: an, month: mois, commercial: 'A', mntNetHt: ca, artCode: '3400900000001', artDesignation: '' });
const PHARMAS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id) => ({ id, name: 'Officine ' + id.toUpperCase() }));
// 2026 : p1 toute l'année d'accord (jan–août, 1 000/mois) ; p3 premier achat en février (avant la prime, mars) ;
//        p2 premier achat en juin ; p5 premier achat en juillet.
const V2026 = () => {
  const s = [];
  for (let m = 1; m <= 8; m++) s.push(vente('p1', 2026, m, 1000));
  s.push(vente('p3', 2026, 2, 200), vente('p2', 2026, 6, 500), vente('p5', 2026, 7, 300));
  return s;
};
// 2027 : p1 janvier–mars ; p2 (déjà cliente en 2026) janvier ; p4 vraiment nouvelle, janvier ;
//        p5 (cliente 2026) revient en mai ; p6 vraiment nouvelle, juin.
const V2027 = () => [
  vente('p1', 2027, 1, 2000), vente('p1', 2027, 2, 2000), vente('p1', 2027, 3, 2000),
  vente('p2', 2027, 1, 500), vente('p4', 2027, 1, 800), vente('p5', 2027, 5, 400), vente('p6', 2027, 6, 600),
];

function chargerOpso(src, sales) {
  const attributs = new Map();
  const slot = {
    innerHTML: '', get firstChild() { return this.innerHTML ? {} : null; },
    setAttribute: (k, v) => attributs.set(k, v), getAttribute: (k) => (attributs.has(k) ? attributs.get(k) : null),
    focus() {}, focusSur: null,
    querySelector(sel) { const m = /data-opr-annee="(\d+)"/.exec(sel); if (!m) return null; const me = this; return { focus() { me.focusSur = m[1]; } }; },
  };
  const ecouteurs = [];
  const doc = {
    body: {}, head: { appendChild() {} },
    getElementById: () => null, createElement: () => ({ style: {} }),
    querySelector: (sel) => (sel === '[data-opso-slot="remuneration"]' ? slot : null),
    addEventListener: (type, f) => { if (type === 'click') ecouteurs.push(f); },
  };
  const win = { console, Date, Math, JSON, Intl, document: doc, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0 };
  win.window = win; win.OPSO_CONTRAT = CONTRAT();
  win.V2 = { sales, pharmacies: PHARMAS };
  vm.createContext(win);
  vm.runInContext(src, win, { filename: 'opso-remuneration.js' });
  return {
    win, slot, V2: win.V2,
    compute: (a) => win.V2.opsoRemuneration.compute(a),
    afficher() { slot.innerHTML = ''; attributs.clear(); win.V2.opsoRemuneration.tick(); return slot.innerHTML; },
    clic(annee) {
      const bouton = { getAttribute: (k) => (k === 'data-opr-annee' ? String(annee) : null) };
      ecouteurs.forEach((f) => f({ target: { closest: (sel) => (sel === '[data-opr-annee]' ? bouton : null) } }));
      return slot.innerHTML;
    },
  };
}
const SRC = () => lire('opso/v2/opso-remuneration.js');
const lignesDe = (D) => D.lignes.map((l) => ({ p: `${l.de}-${l.a}`, total: Math.round(l.total), remu: Math.round(l.remu * 100) / 100, ind: l.indicatif, n: Array.from(l.nouvelles, (x) => x.id) }));
const boutons = (h) => [...h.matchAll(/<button[^>]*data-opr-annee="(\d+)"[^>]*aria-pressed="(true|false)"/g)].map((m) => [m[1], m[2]]);

/* ───────────────────────── (a) 2026 seul : rien ne bouge ───────────────────────── */

test('(a) OPSO, ventes 2026 seules : chiffres attendus (inventés) et puce « 2026 » sans bouton', () => {
  const o = chargerOpso(SRC(), V2026());
  const D = o.compute();
  assert.equal(D.annee, 2026);
  assert.deepEqual(lignesDe(D), [
    { p: '1-4', total: 4200, remu: 42, ind: true, n: [] },       // avant l'accord : indicative, p3 est avant la prime
    { p: '5-8', total: 4800, remu: 48, ind: false, n: ['p2', 'p5'] },
    { p: '9-12', total: 0, remu: 0, ind: false, n: [] },
  ]);
  assert.equal(D.totalAnnee.remuCA, 48, 'la période indicative reste hors total');
  assert.equal(D.totalAnnee.primes, 200);
  assert.equal(D.totalAnnee.remu, 248);
  const h = o.afficher();
  assert.ok(h.includes('Rémunération du groupement'), 'marqueur positif : le bloc est bien rendu');
  assert.ok(h.includes('<span class="oa-chip">2026</span>'), 'une seule année : la puce d\'avant');
  assert.ok(!h.includes('data-opr-annee'), 'une seule année : aucun bouton');
});

test('(a) OPSO, ventes 2026 seules : résultat de compute() et HTML IDENTIQUES entre l\'ancien et le nouveau fichier', (t) => {
  const ancien = AVANT && existsSync(join(AVANT, 'opso/v2/opso-remuneration.js')) ? join(AVANT, 'opso/v2/opso-remuneration.js') : '';
  if (!ancien) return t.skip('MARGE2027_AVANT absent : pas d\'ancien fichier à comparer');
  const vieux = chargerOpso(readFileSync(ancien, 'utf8'), V2026());
  const neuf = chargerOpso(readFileSync(join(RACINE, 'opso/v2/opso-remuneration.js'), 'utf8'), V2026());
  const a = vieux.compute(), b = neuf.compute();
  assert.deepEqual(JSON.parse(JSON.stringify({ annee: a.annee, lignes: a.lignes, totalAnnee: a.totalAnnee, P: a.P })),
    JSON.parse(JSON.stringify({ annee: b.annee, lignes: b.lignes, totalAnnee: b.totalAnnee, P: b.P })), 'compute() diffère');
  const ha = vieux.afficher(), hb = neuf.afficher();
  assert.ok(ha.includes('Rémunération du groupement') && hb.includes('Rémunération du groupement'));
  assert.equal(hb, ha, 'le HTML du bloc diffère');
});

/* ───────────────────────── (b) 2026 + 2027 ───────────────────────── */

test('(b) OPSO : ventes 2026 + 2027 → ouvert sur 2027 ; compute(2026) rend 2026 ; année inconnue → la plus récente', () => {
  const o = chargerOpso(SRC(), V2026().concat(V2027()));
  assert.equal(o.compute().annee, 2027);
  assert.equal(o.compute(2027).annee, 2027);
  assert.equal(o.compute(2026).annee, 2026);
  assert.equal(o.compute(1999).annee, 2027, 'année sans ventes → la plus récente');
  assert.deepEqual(Array.from(o.compute().annees), [2026, 2027]);
  // 2026 vue depuis le jeu à deux années = 2026 vue seule
  assert.deepEqual(lignesDe(o.compute(2026)), lignesDe(chargerOpso(SRC(), V2026()).compute()));
  assert.equal(o.compute(2027).totalAnnee.total, 8300, '2027 : seules les ventes 2027 comptent (7 300 + 1 000)');
});

test('(b) OPSO : une période 2027 avant le mois `effet` n\'est PAS « indicative », et compte dans le total', () => {
  const o = chargerOpso(SRC(), V2026().concat(V2027()));
  const D27 = o.compute(2027), D26 = o.compute(2026);
  assert.equal(D26.lignes[0].indicatif, true, '2026 : janv.–avr. est avant l\'accord (mai)');
  assert.equal(D27.lignes[0].indicatif, false, '2027 : janv.–avr. est entièrement sous accord');
  assert.equal(D27.totalAnnee.remuCA, 73 + 10, '73 € (7 300 à 1 %) + 10 € (1 000 à 1 %) : rien n\'est retiré du total');
  assert.ok(!o.afficher().includes('Avant l’accord'), 'aucune mention « Avant l\'accord » en 2027');
  assert.ok(o.clic(2026).includes('Avant l’accord · non comptée'), '2026 garde sa période avant l\'accord');
});

test('(b) OPSO, prime : cliente en 2026 ≠ nouvelle en 2027 ; vraiment nouvelle = nouvelle même en janvier', () => {
  const o = chargerOpso(SRC(), V2026().concat(V2027()));
  const D = o.compute(2027);
  assert.equal(D.depuisPrime, 1, '2027 : prime dès janvier');
  assert.deepEqual(Array.from(D.lignes[0].nouvelles, (x) => x.id), ['p4'], 'janvier 2027 : p4 est nouvelle, p2 (cliente en 2026) ne l\'est pas');
  assert.deepEqual(Array.from(D.lignes[1].nouvelles, (x) => x.id), ['p6'], 'p5 (cliente en 2026) revient en mai : pas nouvelle ; p6 l\'est');
  assert.equal(D.totalAnnee.primes, 200);
  assert.equal(D.totalAnnee.nNouvelles, 2);
  // 2026 : réglage `prime.depuis` (mars) toujours en vigueur
  const D26 = o.compute(2026);
  assert.equal(D26.depuisPrime, 3);
  assert.deepEqual(Array.from(D26.lignes[0].nouvelles, (x) => x.id), [], 'p3 a commencé en février, avant la prime');
  assert.deepEqual(Array.from(D26.lignes[1].nouvelles, (x) => x.id), ['p2', 'p5']);
});

test('(b) OPSO, HTML : deux boutons, celui de l\'année affichée en aria-pressed="true", et le clic change d\'année', () => {
  const o = chargerOpso(SRC(), V2026().concat(V2027()));
  let h = o.afficher();
  assert.ok(h.includes('Rémunération du groupement'), 'marqueur positif');
  assert.deepEqual(boutons(h), [['2026', 'false'], ['2027', 'true']]);
  assert.ok(!h.includes('<span class="oa-chip">2027</span>'), 'plus de puce quand il y a deux boutons');
  assert.ok(h.includes('janv.–avr. 2027') && !h.includes('janv.–avr. 2026'));
  h = o.clic(2026);
  assert.deepEqual(boutons(h), [['2026', 'true'], ['2027', 'false']]);
  assert.ok(h.includes('janv.–avr. 2026') && !h.includes('janv.–avr. 2027'));
  assert.equal(o.slot.focusSur, '2026', 'le focus reste sur le bouton cliqué');
  h = o.clic(2027);
  assert.deepEqual(boutons(h), [['2026', 'false'], ['2027', 'true']]);
  assert.ok(h.includes('janv.–avr. 2027'));
});

/* ───────────────────────── (d) V2.notreMarge ───────────────────────── */

const BOOT = () => lire('crm/v2/v2-boot.js');
function nouveauNM(donnees, escale) {
  const boot = BOOT();
  const i = boot.indexOf('V2.notreMarge = (function () {');
  const fin = '})();';
  assert.ok(i > 0, 'V2.notreMarge introuvable');
  const j = boot.indexOf(fin, i);
  const win = { MARGE_CLIENTS: donnees, V2_BRAND: escale ? { escale: true } : {} };
  const V2 = { ESCALE_COMMS: ['Guy', 'Tiffany'] };
  new Function('V2', 'window', boot.slice(i, j + fin.length))(V2, win);
  return V2.notreMarge;
}
const FAM = ['p', 'p1', 'p2', 'i', 'c', 'fr', 'nr'];
// 3 commerciaux : Alice (CRM), Guy (Escale), Bruno (CRM). Alice et Bruno vont jusqu'en septembre, Guy seulement jusqu'en août.
const FICHIER = () => ({
  v: 1, fait: '2026-10-14', jusqua: '2026-09', mois: ['2026-07', '2026-08', '2026-09'], fam: FAM,
  c: ['Alice', 'Guy', 'Bruno'], o: ['2000001', '2000002'],
  r: [
    [0, 0, 202608, 100, 10, 10, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 202609, 100, 10, 10, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 202607, 100, 10, 10, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 202608, 100, 10, 10, 0, 0, 0, 0, 0, 0, 0],
    [2, 0, 202609, 100, 10, 10, 0, 0, 0, 0, 0, 0, 0],
  ],
});

test('(d) notreMarge hors Escale : « Intégral », à jour jusqu\'au dernier mois du fichier (septembre)', () => {
  const NM = nouveauNM(FICHIER(), false);
  assert.equal(NM.marque(), 'Intégral');
  assert.equal(NM.jusqua(), '2026-09');
  assert.equal(NM.libelleDate(), 'estimation, à jour jusqu’à septembre 2026');
});

test('(d) notreMarge dans l\'espace Escale : « Escale Pharma », à jour jusqu\'au dernier mois des ventes d\'Escale (août)', () => {
  const NM = nouveauNM(FICHIER(), true);
  assert.equal(NM.marque(), 'Escale Pharma');
  assert.equal(NM.jusqua(), '2026-08', 'Guy s\'arrête en août alors que le fichier va jusqu\'en septembre');
  assert.equal(NM.libelleDate(), 'estimation, à jour jusqu’à août 2026');
});

test('(d) notreMarge Escale : aucun prénom d\'Escale dans le fichier → repli sur le mois du fichier ; fichier absent → vide', () => {
  const d = FICHIER(); d.c = ['Alice', 'Zoé', 'Bruno'];
  const NM = nouveauNM(d, true);
  assert.equal(NM.jusqua(), '2026-09');
  assert.equal(NM.libelleDate(), 'estimation, à jour jusqu’à septembre 2026');
  const vide = nouveauNM(null, true);
  assert.equal(vide.jusqua(), '');
  assert.equal(vide.libelleDate(), '');
  assert.equal(vide.marque(), 'Escale Pharma');
});

/* ───────────────────────── (c) l'export « Mes clients en Excel » ───────────────────────── */

// Le VRAI V2.pharmaClientsXlsx (+ ses aides salesIndex / pharmaSales / moisVentes / ensureXLSX), lu dans v2-pharma.js ;
// seuls l'écran, le réseau et la bibliothèque Excel sont remplacés (la bibliothèque garde les cellules et leur format).
function bancExport() {
  const src = lire('crm/v2/v2-pharma.js');
  const a = src.indexOf('var _salesIdx = null');
  const b = src.indexOf('// toutes ventes d\'une pharma');
  assert.ok(a > 0 && b > a, 'salesIndex introuvable');
  const aides = src.slice(a, b) + '\n' + fonction(src, 'pharmaSalesAll') + '\n' + fonction(src, 'pharmaSales')
    + '\nvar _moisVentes = null;\n' + fonction(src, 'moisVentes') + '\n' + fonction(src, 'ensureXLSX') + '\nvar xlsxLoading = false;\nfunction deduitProbables() { return {}; }\nvar searchQuery = "";\n';
  const d = src.indexOf('V2.pharmaClientsXlsx = function () {');
  const f = src.indexOf('V2.grpDownloadXlsx = function', d);
  assert.ok(d > 0 && f > d, 'pharmaClientsXlsx introuvable');
  const classeurs = [];
  const XLSX = {
    utils: {
      aoa_to_sheet(aoa) { const ws = { aoa }; aoa.forEach((ligne, r) => ligne.forEach((v, c) => { if (v !== '' && v != null) ws[`${r}:${c}`] = { t: typeof v === 'number' ? 'n' : 's', v }; })); return ws; },
      encode_cell: ({ r, c }) => `${r}:${c}`, encode_range: () => '', book_new: () => ({ feuilles: [] }),
      book_append_sheet(wb, ws) { wb.feuilles.push(ws); },
    },
    writeFile(wb) { classeurs.push(wb); },
  };
  const win = { XLSX, MARGE_CLIENTS: FICHE_EXPORT(), V2_BRAND: {} };
  win.window = win;
  const V2 = win.V2 = {
    AN0: 2026, sales: [], pharmacies: [], toast() {}, voitVentesDe: (id) => String(id) !== '2000003', commFilter: '',
  };
  // le vrai module « Notre marge » de v2-boot.js
  const boot = BOOT();
  const i = boot.indexOf('V2.notreMarge = (function () {'); const j = boot.indexOf('})();', i);
  new Function('V2', 'window', boot.slice(i, j + 5))(V2, win);
  new Function('V2', 'window', 'document', aides + src.slice(d, f))(V2, win, { createElement: () => ({}), head: { appendChild() {} } });
  return { V2, classeurs, win };
}
// Fichier de marge inventé : 3 officines, mai à juillet 2026 ; l'officine 3 est celle d'un collègue (cases vides).
const FICHE_EXPORT = () => ({
  v: 1, fait: '2026-10-14', jusqua: '2026-07', mois: ['2026-05', '2026-06', '2026-07'], fam: FAM,
  c: ['Alice', 'Bruno'], o: ['2000001', '2000002', '2000003'],
  r: [
    [0, 0, 202605, 1000, 40, 10, 0, 0, 20, 0, 5, 5, 100],
    [0, 0, 202606, 2000, 90, 30, 0, 0, 40, 10, 10, 0, 0],
    [0, 0, 202607, 3000, 60, 20, 0, 0, 30, 0, 0, 10, 50],
    [1, 0, 202607, 500, 15, 5, 0, 0, 10, 0, 0, 0, 0],
    [1, 1, 202606, 700, 25, 0, 0, 0, 25, 0, 0, 0, 0],
    [0, 2, 202607, 400, 8, 8, 0, 0, 0, 0, 0, 0, 0],
  ],
});

test('(c) export « Mes clients en Excel » : la ligne TOTAL additionne « Notre marge » et ses familles, en € sans décimales inutiles', async () => {
  const { V2, classeurs } = bancExport();
  V2.pharmacies = ['2000001', '2000002', '2000003'].map((id, k) => ({ id, name: 'Officine ' + (k + 1), comms: ['Alice'] }));
  V2.sales = [];
  for (const id of ['2000001', '2000002', '2000003']) for (const m of [5, 6, 7]) V2.sales.push({ pharmacyId: id, year: 2026, month: m, commercial: 'Alice', mntNetHt: 100, artCode: 'c' + m });
  V2.pharmaClientsXlsx();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(classeurs.length, 1, 'le classeur n\'a pas été écrit');
  const ws = classeurs[0].feuilles[0], aoa = ws.aoa;
  const head = aoa[1], total = aoa[aoa.length - 1];
  assert.equal(total[1], 'TOTAL', 'marqueur positif : dernière ligne = TOTAL');
  const iNm = head.findIndex((h) => /^Notre marge \(estimation/.test(h));
  assert.ok(iNm > 0, 'colonne « Notre marge » absente de l\'en-tête');
  const colonnes = head.slice(iNm);
  assert.equal(colonnes.length, 6, 'une colonne totale + cinq familles non nulles');
  assert.ok(colonnes.slice(1).every((h) => /^Notre marge : /.test(h)), 'familles lues dans l\'en-tête');
  // officines 1 et 2 seulement (la 3 est celle d'un collègue) : total 205 + 25 = 230
  assert.equal(aoa.length, 2 + 3 + 1, 'titre + en-tête + 3 officines + TOTAL');
  const ligneColleg = aoa.slice(2, -1).find((l) => l[0] === '2000003');
  assert.equal(ligneColleg[iNm], '', 'case vide pour l\'officine d\'un collègue');
  assert.equal(total[iNm], 230, 'TOTAL « Notre marge »');
  // familles non nulles (p, i, c, fr, nr) : 65, 125, 10, 15, 15 — la somme des familles = le total
  const fam = total.slice(iNm + 1);
  assert.deepEqual(fam, [65, 125, 10, 15, 15]);
  assert.equal(fam.reduce((s, x) => s + x, 0), total[iNm]);
  assert.equal(total.length, head.length, 'la ligne TOTAL couvre toutes les colonnes');
  // la colonne CA total (avant « Notre marge ») garde sa somme habituelle : 2 officines visibles × 3 mois × 100
  assert.equal(total[28 + 3], 600);
  // format monétaire sur la ligne TOTAL aussi
  for (let k = 0; k < colonnes.length; k++) assert.equal(ws[`${aoa.length - 1}:${iNm + k}`].z, '# ##0 €', `format de la cellule TOTAL colonne ${k}`);
  assert.equal(ws[`2:${iNm}`].z, '# ##0 €', 'et sur la première ligne de données');
});
