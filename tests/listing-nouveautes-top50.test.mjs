/* listing-nouveautes-top50.test.mjs — 24/11/2026, demandes de Will :
 *  1. « le top 50 volume et top 50 valeur que commande la pharma » dans les listings (PDF client) ;
 *  2. « ajoute également en opportunités les nouveautés qui explosent en volume (aiguilles EasyDrip) ».
 * Le code est découpé dans les vrais fichiers et exécuté tel quel (rien n'est recopié). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ph = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const pdf = readFileSync(new URL('../crm/v2/v2-pdf-prospect.js', import.meta.url), 'utf8');
const bloc = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, 'bloc introuvable : ' + a); return src.slice(i, j); };

// ── nouveautés ──
// un produit vendu chaque mois fixe la période (janv.→oct.), comme dans le vrai réseau
const FOND = Array.from({ length: 10 }, (_, m) => ({ pharmacyId: '999', artCode: '3400000000000', year: 2026, month: m + 1, qte: 1 }));
function nouveautes(sales, bench = {}, cat = {}, sansFond = false) {
  sales = sansFond ? sales : FOND.concat(sales);
  const ctx = { V2: { sales, produits: { catalogueIndex: () => cat }, estReste: p => p === '0' || p === '0E' }, Map };
  ctx.benchIndex = () => new Map(Object.entries(bench));
  vm.runInNewContext(bloc(ph, '  var NOUV = {', '  function buildRecoCats(') + '\nthis.f = nouveautesReseau;', ctx);
  return ctx.f();
}
// ventes : boîtes par mois (janv.→oct. 2026) réparties sur `nph` pharmacies
function lignes(cip, parMois, nph = 10) {
  const out = [];
  parMois.forEach((q, m) => { if (!q) return; for (let p = 0; p < nph; p++) out.push({ pharmacyId: String(100 + p), artCode: cip, year: 2026, month: m + 1, qte: q / nph }); });
  return out;
}
const EASY = '6972857294250', cat = { [EASY]: { d: 'EASYDRIP+ PRO AIG 4MM 32G B100', ppht: 4.84, net: 4.84 } };

test('EasyDrip (vraie courbe 2026) est une nouveauté, même hors BENCHMARK', () => {
  const r = nouveautes(lignes(EASY, [0, 0, 0, 4, 0, 23, 170, 105, 213, 289], 10), {}, cat);
  assert.deepEqual(JSON.parse(JSON.stringify(r.map(x => x.cip))), [EASY]);
  assert.equal(Math.round(r[0].A), 607);
});
test('un produit installé depuis janvier n’est pas une nouveauté, même s’il monte', () => {
  assert.equal(nouveautes(lignes(EASY, [60, 60, 60, 80, 90, 100, 100, 200, 300, 400], 10), {}, cat).length, 0);
});
test('trop petit (< 50 boîtes) ou trop peu de pharmacies (< 8 sur un mois) : écarté', () => {
  assert.equal(nouveautes(lignes(EASY, [0, 0, 0, 0, 0, 0, 2, 10, 15, 20], 10), {}, cat).length, 0, '45 boîtes');
  assert.equal(nouveautes(lignes(EASY, [0, 0, 0, 0, 0, 0, 20, 100, 200, 300], 5), {}, cat).length, 0, '5 pharmacies');
});
test('pas assez de hausse (< 2 fois les 3 mois d’avant) : écarté', () => {
  assert.equal(nouveautes(lignes(EASY, [0, 0, 0, 100, 100, 100, 100, 100, 100, 100], 10), {}, cat).length, 0);
});
test('les campagnes saisonnières (vaccin grippe, anti-VRS, autotests) sont écartées', () => {
  const v = '3400930296165', b = '3400930268636', t = '6952062710707';
  const r = nouveautes([...lignes(v, [0, 0, 0, 0, 0, 0, 0, 0, 0, 405], 13), ...lignes(b, [0, 0, 0, 0, 0, 0, 1, 60, 877, 872], 30), ...lignes(t, [0, 0, 0, 0, 0, 0, 0, 0, 420, 2759], 30)],
    { [v]: { designation: 'INFLUVAC INJ SRG0,5ML A/AIG 1' }, [b]: { designation: 'BEYFORTUS 100MG INJ S1ML/2A 1' } }, { [t]: { d: 'AUTOTEST COMBO GRIPPE/COVID SEJOY BT1' } });
  assert.equal(r.length, 0);
});
test('sans nom (ni BENCHMARK ni catalogue arrivé) : rien plutôt qu’une ligne vide', () => {
  assert.equal(nouveautes(lignes(EASY, [0, 0, 0, 4, 0, 23, 170, 105, 213, 289], 10), {}, {}).length, 0);
});
test('moins de 9 mois de ventes : aucune nouveauté (la règle n’a pas de sens)', () => {
  assert.equal(nouveautes(lignes(EASY, [5, 0, 0, 4, 0, 23, 170, 105], 10), {}, cat, true).length, 0);
});
test('les nouveautés passent en tête du listing et sortent des autres familles', () => {
  const b = bloc(ph, '  function buildRecoCats(', '  // Best rotations du groupement');
  assert.ok(b.includes('nouveautesReseau()') && b.includes('enNouv[cip]') && b.includes('[{ cat: surNouv ? NOUV_GRP : NOUV, rows: nouv, sur: surNouv }]'));
  assert.ok(b.includes('if (owned.has(n.cip)'), 'ce qu’elle commande déjà n’est pas proposé');
});
test('PDF : la coupe à 10 pages garde les nouveautés', () => {
  const g = bloc(pdf, '  function garder(c, K)', '  function construire(');
  const ctx = {}; vm.runInNewContext(g + '\nthis.f = garder;', ctx);
  const c = { tot: 3, cats: [{ rows: [{ n: 2, nouv: true }] }, { rows: [{ n: 90 }, { n: 50 }] }] };
  const d = ctx.f(c, 2);
  assert.equal(d.cats[0].rows[0].nouv, true, 'la nouveauté reste');
  assert.equal(d.cats[1].rows.length, 1);
});

// ── top 50 en valeur ET en volume ──
test('topVentesData : 50 en CA et 50 en boîtes, parts dans la bonne unité', () => {
  const ctx = {
    V2: {}, CATS: [], benchIndex: () => new Map(), classify: () => null,
    pharmaSales: () => [
      { artCode: '1111111', qte: 2, mntNetHt: 900 },   // cher, peu de boîtes
      { artCode: '2222222', qte: 300, mntNetHt: 150 },  // pas cher, beaucoup de boîtes
      { artCode: '3333333', qte: 40, mntNetHt: 400 }]
  };
  vm.runInNewContext(bloc(ph, '  var PDF_TOP_VENTES = 50;', '  function topVentesPdfHtml(') + '\nthis.f = topVentesData;', ctx);
  const t = ctx.f('x');
  assert.equal(t.rows.map(r => r.cip).join(), '1111111,3333333,2222222', 'valeur');
  assert.equal(t.vol.rows.map(r => r.cip).join(), '2222222,3333333,1111111', 'volume');
  assert.equal(t.vol.qteTot, 342);
});
test('PDF client : deux tableaux « en valeur » et « en volume »', () => {
  assert.ok(pdf.includes("'Ce qu\\'elle commande · en valeur'") && pdf.includes("'Ce qu\\'elle commande · en volume'"));
  assert.ok(pdf.includes("tableTop('topv'"), 'le tableau volume a sa propre suite de page');
});

// ── 24/11/2026 (soir), choix de Will après la sonde en production : listing GROUPEMENT, 15 nouveautés sur 21 à « 0 % »
//    sous « commandés par les 8 pharmacies de son groupement » → leur part est celle du RÉSEAU, et les phrases le disent.
function reco(scope) {
  const NET = { map: new Map([[EASY, { ph: new Set(Array.from({ length: 40 }, (_, i) => 'n' + i)), qte: 600 }]]), total: 100 };
  const GRP = { map: new Map([[EASY, { ph: new Set(), qte: 0 }]]), total: 8 };
  const ctx = {
    V2: { produits: { catalogueIndex: () => cat }, bestPrice: () => ({ ht: 4.84, ip: 4.84 }) }, Map, Set,
    cipStats() {}, groupementPids: () => ({ name: 'Les Officinales', set: new Set(['1', '2', '3', '4', '5', '6', '7', '8']) }),
    computeStats: (k) => (k === '__net__' ? NET : GRP), benchIndex: () => new Map(), pharmaSales: () => [], classify: () => null, CATS: [],
    nouveautesReseau: () => [{ cip: EASY, A: 607, P: 128 }], NOUV: { key: 'nouv', sub: 'réseau' }, NOUV_GRP: { key: 'nouv', sub: 'grp' }, NOUV_MAX: 30
  };
  vm.runInNewContext(bloc(ph, '  function buildRecoCats(', '  // Best rotations du groupement') + '\nthis.f = buildRecoCats;', ctx);
  const l1 = {}; vm.runInNewContext(bloc(ph, '  function l1PartDes(', '  // Part des pharmacies de la référence') + '\nthis.f = l1PartDes;', l1);
  const d = ctx.f('9', scope);
  return { d, part: (r) => l1.f(r, d.total), NOUV_GRP: ctx.NOUV_GRP };
}
test('listing groupement : une nouveauté se compte sur les pharmacies du RÉSEAU (40 sur 100), plus « 0 % »', () => {
  const { d, part, NOUV_GRP } = reco('groupement');
  const k = d.cats[0], r = k.rows[0];
  assert.equal(d.total, 8, 'le reste du listing garde son groupement de 8 pharmacies');
  assert.equal(k.cat, NOUV_GRP, 'titre de famille propre au listing groupement');
  assert.equal(k.sur, 100); assert.equal(r.sur, 100); assert.equal(r.sortie, 40);
  assert.equal(part(r), 40, 'écran, Excel : 40 %, pas 0 %');
});
test('listing Intégral : rien ne change (part sur le réseau, pas de « sur »)', () => {
  const { d, part } = reco('reseau');
  assert.equal(d.cats[0].sur, 0); assert.equal(d.cats[0].rows[0].sur, 0);
  assert.equal(part(d.cats[0].rows[0]), 40);
});
test('PDF : la part et les phrases disent « réseau » pour les nouveautés du listing groupement', () => {
  const ctx = { nb: (n) => String(n), refPhrase: () => 'les 8 pharmacies Les Officinales clientes d\'Intégral Pharma' };
  vm.runInNewContext(bloc(pdf, '  function pct(n, c, sur)', '  // Chaque direction rend') + '\nthis.o = { pct, pctTxt, oppPhrase, noteNouv };', ctx);
  const { pct, pctTxt, oppPhrase, noteNouv } = ctx.o;
  assert.equal(pct(40, { panel: 8 }, 100), 40); assert.equal(pct(4, { panel: 8 }), 50, 'sans « sur » : la référence');
  assert.equal(pctTxt(0, { panel: 8 }, 100), '0 %');
  const g = { tot: 23, cats: [{ sur: 100, rows: [{}, {}, {}] }, { rows: Array(20).fill({}) }] };
  assert.equal(oppPhrase(g), '3 nouveautés en forte hausse dans le réseau Intégral Pharma et 20 produits commandés par les 8 pharmacies Les Officinales clientes d\'Intégral Pharma');
  assert.equal(noteNouv(g), ' (nouveautés : part des 100 pharmacies du réseau Intégral Pharma)');
  const r = { tot: 23, cats: [{ rows: [{}, {}, {}] }, { rows: Array(20).fill({}) }] };
  assert.equal(oppPhrase(r), '23 produits commandés par les 8 pharmacies Les Officinales clientes d\'Intégral Pharma', 'listing Intégral : phrase d\'avant');
  assert.equal(noteNouv(r), '');
  assert.equal(oppPhrase({ tot: 1, cats: [{ sur: 100, rows: [{}] }] }), '1 nouveauté en forte hausse dans le réseau Intégral Pharma');
  assert.ok(!pdf.includes("nb(c.tot) + ' produits commandés par ' + refPhrase(c)"), 'plus aucune phrase qui compte tout sur le groupement');
  assert.equal(pdf.split("' + noteNouv(c) + '").length - 1, 5, 'la note des 5 styles');
  assert.ok(pdf.includes('s: r.sur || 0') && pdf.includes('sur: k.sur || 0'), 'contexte du PDF : la base de chaque part suit la ligne');
});
test('Excel du listing : « Ce qu’elle commande » en valeur puis en volume en tête, nouveautés sur le réseau', async () => {
  const wb0 = { feuilles: [] };
  const X = { utils: { book_new: () => wb0, aoa_to_sheet: (aoa) => ({ __aoa: aoa }), encode_cell: ({ r, c }) => r + ':' + c,
    book_append_sheet: (wb, ws, nom) => wb.feuilles.push({ nom, aoa: ws.__aoa }) }, write: () => new Uint8Array(1) };
  const ctx = { V2: { toast() {} }, window: { XLSX: X }, ensureXLSX: (cb) => cb(true), periodLabel: () => 'janv.–oct. 2026', selCips: null,
    mentionOffre: () => '', txMime: () => 'application/octet-stream', File, Promise, Math, String };
  vm.runInNewContext(bloc(ph, '  function l1PartDes(', '  // Part des pharmacies de la référence') + bloc(ph, '  // top (facultatif) = topVentesData', '  // ── 25/09/2026 — grossistes') + '\nthis.f = achatsXlsx;', ctx);
  const top = { rows: [{ cip: '1111111', designation: 'CHER', cat: { label: 'Froid' }, ca: 900, qte: 2 }, { cip: '2222222', designation: 'PAS CHER', cat: null, ca: 150, qte: 300 }],
    nb: 2, caTot: 1050, caTop: 1050, vol: { rows: [{ cip: '2222222', designation: 'PAS CHER', cat: null, ca: 150, qte: 300 }, { cip: '1111111', designation: 'CHER', cat: { label: 'Froid' }, ca: 900, qte: 2 }], qteTot: 302, qteTop: 302 } };
  const data = { panel: 8, total: 8, cats: [{ cat: { label: 'Nouveautés', sub: 'en forte hausse · part des pharmacies du réseau Intégral' }, sur: 100, rows: [{ cip: EASY, designation: 'EASYDRIP', prix_ht: 4.84, prix_ip: 4.84, sortie: 40, sur: 100 }] },
    { cat: { label: 'Froid' }, rows: [{ cip: '3333333', designation: 'X', prix_ht: 10, prix_ip: 9, sortie: 4 }] }] };
  const f = await ctx.f('DEFRANCE — Les Officinales', data, false, 'blob', top);
  assert.ok(f && /\.xlsx$/.test(f.name));
  assert.deepEqual(wb0.feuilles.map((x) => x.nom), ['Ce qu\'elle commande · valeur', 'Ce qu\'elle commande · volume', 'Nouveautés', 'Froid']);
  const [val, vol, nv, fr] = wb0.feuilles;
  assert.deepEqual(JSON.parse(JSON.stringify(val.aoa[3])), ['#', 'Produit', 'CIP13', 'Famille', 'Boîtes', 'CA HT (€)', 'Part de son CA']);
  assert.deepEqual(JSON.parse(JSON.stringify(val.aoa[4].slice(0, 6))), [1, 'CHER', '1111111', 'Froid', 2, 900]);
  assert.equal(vol.aoa[3][6], 'Part de ses boîtes'); assert.equal(vol.aoa[4][1], 'PAS CHER'); assert.equal(vol.aoa[4][3], 'Autres');
  assert.ok(Math.abs(vol.aoa[4][6] - 300 / 302) < 1e-9, 'part de SES boîtes');
  assert.match(val.aoa[1][0], /^ses 2 premiers produits en CA HT · 100 % de son CA · 2 réf\. commandées — éditée le /);
  assert.match(nv.aoa[1][0], /référence 100 pharmacies du réseau Intégral Pharma$/);
  assert.equal(nv.aoa[4][5], 0.4, 'nouveauté : 40 % du réseau');
  assert.match(fr.aoa[1][0], /référence 8 pharmacies$/); assert.equal(fr.aoa[4][5], 0.5);
  wb0.feuilles.length = 0;
  await ctx.f('PROSPECT — Réseau', data, false, 'blob');
  assert.equal(wb0.feuilles[0].nom, 'Nouveautés', 'sans top (prospect) : pas d\'onglet « Ce qu\'elle commande »');
});
test('V2.pharmaListXlsx passe son top 50 à l’Excel (pas pour un prospect)', () => {
  const i = ph.indexOf('V2.pharmaListXlsx = function'), f = ph.slice(i, ph.indexOf('\n  };\n', i));
  assert.match(f, /achatsXlsx\(\(prospect \|\| pharma\.name\) \+ ' — ' \+ ref, data, false, mode, prospect \? null : topVentesData\(pid\)\)/);
});
