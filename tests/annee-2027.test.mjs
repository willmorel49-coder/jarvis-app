/* annee-2027.test.mjs — le navigateur lit-il bien des ventes 2026 ET 2027 ? (14/10/2026)
 *
 * À partir de janvier 2027 les données contiennent deux années. Interface décidée :
 *   · ligne compacte de WML_SALES : [officine, moisCompacte, commercial, cip13, qte, puNet, mntNetHt]
 *     avec moisCompacte = (année − 2026) × 12 + mois  (1..12 = 2026, 13 = janvier 2027, 24 = décembre 2027) ;
 *   · WML_MOIS / WML_MONTHS : chaînes 'AAAA-MM' qui peuvent chevaucher deux années.
 *
 * AUCUNE donnée réelle : tout est inventé. Le code exécuté est celui des fichiers livrés
 * (v2-boot.js, v2-pilotage.js, v2-appro.js…), découpé ou chargé tel quel — jamais recopié.
 *
 * Rejouer sur l'ANCIEN code (pour vérifier que chaque assertion échouait avant la correction) :
 *   ANNEE2027_AVANT=/chemin/vers/copie node --test tests/annee-2027.test.mjs
 * où la copie reprend l'arborescence du dépôt (crm/v2/…, opso/…) avec les fichiers d'origine
 * (`git show HEAD:<fichier>`) ; tout fichier absent de la copie est lu dans le dépôt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chargerDecodage } from './aide-decodage-ventes.mjs';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const AVANT = process.env.ANNEE2027_AVANT || '';
// Chemin d'un fichier : la copie « avant » s'il y en a une, sinon le dépôt.
const chemin = (rel) => (AVANT && existsSync(join(AVANT, rel)) ? join(AVANT, rel) : join(RACINE, rel));
const lire = (rel) => readFileSync(chemin(rel), 'utf8');
const requis = createRequire(import.meta.url);

// Découpe une fonction (« function nom( … } ») dans un source, accolades comprises.
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
const racineBoot = () => (AVANT && existsSync(join(AVANT, 'crm/v2/v2-boot.js')) ? AVANT : RACINE);
// Le décodage et le compteur de mois de v2-boot.js, versés dans un V2 (sans planter sur un ancien boot).
function remplirV2(V2) {
  try { chargerDecodage(racineBoot(), V2); } catch (e) { /* ancien code : rien à verser */ }
  return V2;
}

/* ───────────────────────── (a) le décodage ───────────────────────── */

test('(a) décodage des lignes compactes : mois 1, 12, 13, 24 → bon mois, bonne année', () => {
  const V2 = chargerDecodage(racineBoot());
  const ligne = (m) => ['2000001', m, 'Alice', '3400000000001', 3, 4.5, 13.5];
  const attendu = { 1: [2026, 1], 12: [2026, 12], 13: [2027, 1], 24: [2027, 12] };
  for (const [c, [an, mois]] of Object.entries(attendu)) {
    const v = V2.decoderVente(ligne(+c));
    assert.equal(v.year, an, `compteur ${c} : année`);
    assert.equal(v.month, mois, `compteur ${c} : mois`);
  }
  // Les champs ne bougent pas : même vente qu'avant pour 1..12.
  const v = V2.decoderVente(ligne(7));
  assert.deepEqual(
    { ph: v.pharmacyId, c: v.commercial, cip: v.artCode, q: v.qte, pu: v.puNet, ca: v.mntNetHt, an: v.year, m: v.month },
    { ph: '2000001', c: 'Alice', cip: '3400000000001', q: 3, pu: 4.5, ca: 13.5, an: 2026, m: 7 });
  assert.equal(V2.moisCompact(2027, 1), 13);
  assert.equal(V2.moisCompact(2026, 12), 12);
  assert.equal(V2.moisCompact(2027, 12), 24);
  // Aller-retour sur 36 mois.
  for (let c = 1; c <= 36; c++) assert.equal(V2.moisCompact(V2.anneeDeMois(c), V2.moisDeMois(c)), c, `aller-retour ${c}`);
});

test('(a) V2.loadData passe bien par V2.decoderVente (pas de copie en dur de « year: 2026 »)', () => {
  const boot = lire('crm/v2/v2-boot.js');
  assert.ok(!/month: s\[1\], year: 2026/.test(boot), 'le décodage en dur month: s[1], year: 2026 est de retour');
  assert.ok(/WML_SALES\.map\(V2\.decoderVente\)/.test(boot), 'loadData ne décode plus par V2.decoderVente');
});

/* ───────────────────────── (b) le Pilotage ───────────────────────── */

test('(b) Pilotage : décembre 2026 + janvier 2027 → dernier mois = janvier 2027, comparé à décembre 2026', () => {
  const win = {
    console, Date, Math, JSON, parseInt, parseFloat, isFinite, encodeURIComponent,
    setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout() {},
    requestAnimationFrame() { return 0; }, matchMedia: () => ({ matches: true }),
    document: { getElementById: () => null, createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} },
  };
  win.window = win; win.ICO = () => '';
  // Les ventes passent par le VRAI décodage : compteur 11, 12, 13.
  const dec = chargerDecodage();
  const L = (m, ca, ph) => dec.decoderVente([ph, m, 'A', 'x' + m, 1, ca, ca]);
  const VENTES = [L(11, 500, 'p1'), L(12, 1000, 'p1'), L(13, 2500, 'p1'), L(12, 400, 'p2'), L(13, 100, 'p2')];
  const V2 = win.V2 = {
    pages: {}, user: { commercial: '', voitTous: true }, pharmacies: [{ id: 'p1', name: 'Un' }, { id: 'p2', name: 'Deux' }],
    sales: VENTES, commFilter: '', ESCALE_COMMS: [],
    commSales() { return V2.sales; }, commercials: () => ['A'], esc: (s) => String(s == null ? '' : s),
    sumCA: (a) => a.reduce((s, x) => s + (x.mntNetHt || 0), 0),
    fmtNum: (n) => String(Math.round(n)), fmtK: (n) => String(Math.round(n)),
    margeMDLboite: () => 0, tint: () => '', topbar: () => '', go() {}, render() {},
  };
  {
    const boot = lire('crm/v2/v2-boot.js');
    const i = boot.indexOf('V2.fmtEur = function');
    let p = 0, j = boot.indexOf('{', i), fin = j;
    for (; j < boot.length; j++) { if (boot[j] === '{') p++; else if (boot[j] === '}') { p--; if (p === 0) { fin = j; break; } } }
    new Function('V2', boot.slice(i, fin + 1) + ';')(V2);
  }
  new Function('window', 'document', 'requestAnimationFrame', 'IntersectionObserver', 'matchMedia', 'ICO', lire('crm/v2/v2-pilotage.js'))(
    win, win.document, win.requestAnimationFrame, undefined, win.matchMedia, win.ICO);

  const rendre = () => {
    const segs = ['current', '3m', 'year', 'custom'].map((p) => ({ dataset: { p }, classList: { contains: () => false } }));
    const sels = ['du', 'au'].map((b) => ({ dataset: { b }, value: '' }));
    const root = { innerHTML: '', querySelector: () => null,
      querySelectorAll: (s) => (s === '.pilo-segbtn' ? segs : s === '.pilo-persel' ? sels : []) };
    V2.pages.pilotage.render(root);
    return { html: root.innerHTML, seg: (p) => segs.find((b) => b.dataset.p === p) };
  };
  const texte = (h) => h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

  // Dernier mois : janvier 2027 seul (2 500 + 100), libellé « 2027 », comparaison à décembre 2026 (1 400 → +85,7 %).
  const h = rendre().html;
  const t = texte(h);
  assert.ok(t.includes('CA net HT · Janv. 2027'), 'le libellé doit dire « Janv. 2027 »');
  assert.ok(t.includes(V2.fmtEur(2600)), 'le CA du dernier mois = janvier 2027 seul (2 600 €)');
  assert.ok(!t.includes('CA net HT · Janv. 2026'), 'janvier 2027 ne doit pas être pris pour janvier 2026');
  assert.ok(t.includes('+85,7 %') && t.includes('vs mois précédent'), 'janvier 2027 se compare à décembre 2026 (1 400 €) : +85,7 %');

  // Mode « Année » : l'année du dernier mois = 2027, et seulement janvier dedans.
  const r = rendre(); r.seg('year').onclick();
  const t2 = texte(rendre().html);
  assert.ok(/Année 2027/.test(t2), 'le mode Année doit dire « Année 2027 »');
  assert.ok(t2.includes(V2.fmtEur(2600)), 'l\'année 2027 ne contient que janvier (2 600 €), pas décembre 2026');
});

/* ───────────────────── (c) chaque endroit corrigé ───────────────────── */

test('v2-produits-moteur : janvier 2027 est un mois de plus, pas janvier 2026', () => {
  const M = requis(chemin('crm/v2/v2-produits-moteur.js'));
  const off = [{ id: 'P1', groupement: '', cp: '44000', ca: 1000 }];
  const v = (year, month, cip) => ({ pharmacyId: 'P1', artCode: cip, mntNetHt: 10, qte: 1, year, month });
  // décembre 2026, janvier 2027
  let idx = M.indexer(off, [v(2026, 12, 'AAA'), v(2027, 1, 'BBB')]);
  assert.equal(idx.moisMax, 13, 'le dernier mois est le compteur 13 (janvier 2027)');
  assert.equal(idx.nbMois, 2);
  assert.equal(idx.premierMois.P1.BBB, 13, 'BBB est entrée en janvier 2027 (compteur 13)');
  // janvier 2026 ET janvier 2027 : deux mois distincts
  idx = M.indexer(off, [v(2026, 1, 'AAA'), v(2027, 1, 'AAA')]);
  assert.equal(idx.nbMois, 2, 'janvier 2026 et janvier 2027 sont deux mois');
  // les tests existants donnent `mois` déjà compact : inchangé
  idx = M.indexer(off, [{ pharmacyId: 'P1', artCode: 'AAA', mntNetHt: 1, qte: 1, mois: 7 }]);
  assert.equal(idx.moisMax, 7);
});

function bacAppro() {
  const els = {};
  const doc = { getElementById: (i) => els[i] || null, createElement: () => ({ style: {}, id: '' }), head: { appendChild() {} }, body: { appendChild(e) { els[e.id] = e; } }, addEventListener() {} };
  const sb = { document: doc, console, setTimeout, clearTimeout, Date, Math, JSON };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(`window.V2={pages:{},sales:[],pharmacies:[],esc:s=>String(s==null?'':s),fmtEur:n=>n+' €',fmtNum:n=>String(Math.round(+n||0)),toast(){},render(){},estReste:p=>p==='0'||p==='0E',reperesReseau:()=>null,topbar:()=>''};window.ICO=()=>'';`, sb);
  remplirV2(sb.V2);
  vm.runInContext(lire('crm/v2/v2-appro-moteur.js'), sb);
  vm.runInContext(lire('crm/v2/v2-appro.js'), sb);
  return { sb, els };
}
const lignesAppro = (mois) => {
  const rows = [];
  for (const m of mois) for (let o = 0; o < 10; o++) rows.push(['o' + o, m, 'Will', '3400000000001', 10, 5, 50]);
  return rows;
};

test('v2-appro : les mois 13 et 14 (2027) font partie des mois retenus', () => {
  const { sb } = bacAppro();
  const rows = lignesAppro([11, 12, 13, 14]);
  assert.deepEqual(Array.from(sb.V2.approMoisRetenus(rows)), [11, 12, 13, 14]);
});

test('v2-appro : le ticket produit courbe la demande sur décembre 2026 → janvier 2027, avec l\'année', () => {
  const { sb, els } = bacAppro();
  sb.WML_SALES = lignesAppro([11, 12, 13, 14]);
  sb.WML_MOIS = ['2026-11', '2026-12', '2027-01', '2027-02'];
  sb.V2.approTicket('3400000000001');
  const t = els['appro-ticket'].innerHTML.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
  assert.ok(t.includes('Demande réseau (4 mois)'));
  // chaque mois porte une demande de 100 : si 2027 retombait sur 2026, les barres de janvier/février seraient à 0
  assert.ok(t.includes('janv. 27') && t.includes('févr. 27'), 'les mois de 2027 portent leur année');
  const barres = (t.match(/\|(\d+)\|(nov\.|déc\.|janv\. 27|févr\. 27)/g) || []).map((x) => x.split('|')[1]);
  assert.deepEqual(barres, ['100', '100', '100', '100'], 'chaque mois retrouve sa demande (100 boîtes)');
});

test('v2-appro-grille : la courbe du réseau suit 2026 puis 2027', () => {
  const { sb } = bacAppro();
  vm.runInContext(lire('crm/v2/v2-appro-grille.js'), sb);
  sb.WML_SALES = lignesAppro([11, 12, 13, 14]);
  sb.WML_MOIS = ['2026-11', '2026-12', '2027-01', '2027-02'];
  sb.STOCK_IP = { data: { '3400000000001': 50 } };
  sb.PROD_STATS = [];
  sb.V2.approGrille.cip('3400000000001');
  const h = sb.V2.approGrille.card();
  const lab = (h.match(/<div class="g5-moislab">([\s\S]*?)<\/div>/) || [])[1] || '';
  assert.ok(/janv\. 27/.test(lab) && /févr\. 27/.test(lab), `étiquettes : ${lab}`);
  const hauteurs = (h.match(/<div class="g5-courbe">([\s\S]*?)<div class="g5-moislab">/) || [])[1].match(/height:(\d+)px/g);
  assert.equal(hauteurs.length, 4);
  assert.ok(hauteurs.every((x) => x !== 'height:2px'), 'aucune barre vide : chaque mois retrouve sa demande');
});

test('v2-comptoir (Produits) : évolution sur nov. 2026 → févr. 2027, année 2027, mois de France retrouvés', () => {
  const src = lire('crm/v2/v2-comptoir.js');
  const noms = ['pad2', 'zeros', 'moisCal', 'anneeDe', 'anneeRef', 'ventesMois', 'frPos', 'tendPart', 'evolution', 'plage', 'pmCouvT', 'evoHtml']
    .filter((n) => src.includes('function ' + n + '('));
  const code = noms.map((n) => fonction(src, n)).join('\n');
  const V2 = remplirV2({});
  const D = { cache: { mois: [11, 12, 13, 14] } };
  const C = { unite: 'q', cip: 'C1' };
  const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const win = { WML_SALES: [], FRANCE_MOIS: null };
  const stubs = {
    largeurPan: () => 600, courbe: (o) => '[COURBE ' + o.id + ' ' + o.labels.join(',') + ' | ' + o.aria + ']',
    tuile: (a, b, c, d) => '[TUILE ' + a + ' ' + d + ']', eurK: String, numK: String, fmtPart: String, fr: String,
    niceMax: (x) => x, ligneBulle: () => '', signe: () => null, esc: String, chargerFrance() {},
  };
  const n2 = Object.keys(stubs);
  const R = new Function('V2', 'D', 'C', 'MOIS_C', 'window', 'ANNEE', ...n2, code + ';return {evolution, evoHtml};')(
    V2, D, C, MOIS_C, win, 2026, ...n2.map((k) => stubs[k]));
  const S = [];
  for (const m of [11, 12, 13, 14]) for (let o = 0; o < 3; o++) S.push(['o' + o, m, 'W', 'C1', 10 + m, 1, 2]);
  win.WML_SALES = S;
  win.FRANCE_MOIS = { meta: { mois: ['2026-11', '2026-12', '2027-01', '2027-02'] }, data: { C1: [100, 200, 300, 400] } };
  const e = R.evolution('C1');
  assert.deepEqual(e.fr, [100, 200, 300, 400], 'chaque mois de nos ventes retrouve SON mois France (compteur 13 = 2027-01)');
  assert.equal(e.an, 2027, 'année de référence = celle du dernier mois');
  const t = R.evoHtml({ cip: 'C1' }).replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
  assert.ok(t.includes('janv. 2027') && t.includes('nov. 2026'), 'le tableau mois par mois porte l\'année de chaque mois');
});

test('v2-comptoir : le repli de ventesAn accepte les mois > 12', () => {
  const src = lire('crm/v2/v2-comptoir.js');
  const code = fonction(src, 'ventesAn');
  const V2 = { }; // pas de V2.approMoisRetenus → repli
  const win = { WML_SALES: [['o', 12, 'W', 'C1', 10, 1, 2], ['o', 13, 'W', 'C1', 10, 1, 2]] };
  const R = new Function('V2', 'window', code + ';return ventesAn();')(V2, win);
  assert.deepEqual(Array.from(R.mois), [12, 13]);
});

test('v2-pharma : étiquette de période « déc. 2026–janv. 2027 » et officines actives du mois 13', () => {
  const src = lire('crm/v2/v2-pharma.js');
  // periodLabel
  const V2a = remplirV2({ sales: [
    { pharmacyId: 'p', year: 2026, month: 12, commercial: 'A', mntNetHt: 1 },
    { pharmacyId: 'p', year: 2027, month: 1, commercial: 'A', mntNetHt: 1 }] });
  const pl = new Function('V2', fonction(src, 'periodLabel') + ';return periodLabel;')(V2a);
  assert.equal(pl(), 'cumul 2 mois · déc. 2026–janv. 2027');
  // un seul exercice : inchangé
  const V2b = remplirV2({ sales: [3, 4, 5].map((m) => ({ pharmacyId: 'p', year: 2026, month: m, commercial: 'A', mntNetHt: 1 })) });
  const pl2 = new Function('V2', fonction(src, 'periodLabel') + ';return periodLabel;')(V2b);
  assert.equal(pl2(), 'cumul 3 mois · mars–mai 2026');
  // networkByCat : R.act est rangé par mois COMPACT (12 = déc. 2026, 13 = janv. 2027)
  const V2c = remplirV2({
    sales: [
      { pharmacyId: 'p1', year: 2026, month: 12, mntNetHt: 10, artCode: 'x' },
      { pharmacyId: 'p1', year: 2027, month: 1, mntNetHt: 10, artCode: 'x' }],
    estReste: () => false, reperesReseau: () => ({ act: { 12: 7, 13: 9 } }),
  });
  const nb = new Function('V2', 'benchIndex', 'classify', 'var _netCache = null, _netRef = null;\n' + fonction(src, 'networkByCat') + ';return networkByCat;')(
    V2c, () => new Map(), () => null);
  const mois = nb().months;
  assert.deepEqual(mois.map((m) => m.n), [7, 9], 'officines actives : 7 en déc. 2026, 9 en janv. 2027');
  // export Excel : les mois sont rangés avec leur année
  const i = src.search(/var moisVus = \{\}, an = [^;]+;/);
  assert.ok(i > 0);
  const j = src.indexOf('function fr(d)', i);
  const MN = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const sortie = new Function('V2', 'MN', src.slice(i, j) + ';return { mois: mois, periode: periode };')(V2a, MN);
  assert.equal(sortie.mois.length, 2);
  assert.equal(sortie.periode, 'déc.-janv.', 'période de l\'Excel : décembre 2026 puis janvier 2027');
});

test('v2-carte : libellés des mois de l\'export et de la fiche — l\'année suit quand il y en a deux', () => {
  const src = lire('crm/v2/v2-carte.js');
  const MAB = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const moisLbls = (wm) => new Function('window', '_MAB', fonction(src, 'moisLbls') + ';return moisLbls();')({ WML_MOIS: wm }, MAB);
  assert.deepEqual(moisLbls(['2026-12', '2027-01']), ['Déc 2026', 'Jan 2027']);
  assert.deepEqual(moisLbls(['2026-03', '2026-04']), ['Mar', 'Avr'], 'une seule année : inchangé');
  // titre de la colonne CA de l'export
  const k = src.indexOf('var wm = window.WML_MOIS || [], lm = moisLbls();');
  const e = src.indexOf("' (€)';", k) + "' (€)';".length;
  const titre = (wm) => new Function('window', 'moisLbls', src.slice(k, e) + ';return caTitre;')({ WML_MOIS: wm }, () => moisLbls(wm));
  assert.equal(titre(['2026-12', '2027-01']), 'CA Déc 2026–Jan 2027 (€)');
  assert.equal(titre(['2026-03', '2026-05']), 'CA Mar–Avr 2026 (€)'.replace('Avr', 'Mai'));
});

test('opso-groupement : période affichée « janv. 2026–janv. 2027 » sur deux années', () => {
  const src = lire('opso/v2/opso-groupement.js');
  const MOIS_ABREV = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const periodeLabel = new Function('MOIS_ABREV', fonction(src, 'periodeLabel') + ';return periodeLabel;')(MOIS_ABREV);
  assert.equal(periodeLabel([{ y: 2026, m: 1 }, { y: 2026, m: 12 }, { y: 2027, m: 1 }]), 'janv. 2026–janv. 2027');
  assert.equal(periodeLabel([{ y: 2026, m: 1 }, { y: 2026, m: 9 }]), 'janv.–sept. 2026', 'une seule année : inchangé');
  assert.equal(periodeLabel([{ y: 2027, m: 1 }]), 'janv. 2027');
});

for (const fichier of ['opso/app.js', 'essentiels-pharma/app.js']) {
  test(`${fichier} : WML_MONTHS sur deux années → période, année et étiquettes justes`, () => {
    const src = lire(fichier);
    const AB = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    // wmlPeriod / wmlAnnee (si absente : ancien code → l'assertion échoue)
    const noms = ['wmlPeriod', 'wmlAnnee'].filter((n) => src.includes('function ' + n + '('));
    const mois2 = ['2026-01', '2026-12', '2027-01'];
    const f = new Function('WML_MONTHS', noms.map((n) => fonction(src, n)).join('\n') + ';return { wmlPeriod: wmlPeriod, wmlAnnee: typeof wmlAnnee === "function" ? wmlAnnee : null };')(mois2);
    assert.equal(f.wmlPeriod(), 'Jan 2026–Jan 2027');
    assert.ok(f.wmlAnnee, 'wmlAnnee() absente');
    assert.equal(f.wmlAnnee(), '2027');
    const g = new Function('WML_MONTHS', fonction(src, 'wmlPeriod') + ';return wmlPeriod();')(['2026-01', '2026-06']);
    assert.equal(g, 'Jan–Juin 2026', 'une seule année : inchangé');
    // PERIOD_SHORT (bloc const … dans la vue WML)
    const a = src.indexOf('const _MABBR');
    const b = src.indexOf('const PERIOD_SHORT');
    assert.ok(a > 0 && b > a);
    const fin = src.indexOf(';\n', src.indexOf('_last[0]', b)) + 1;
    const bloc = src.slice(a, fin).replace(/\n\s*const AFM_LABELS[\s\S]*$/, '');
    const ps = new Function('WML_MONTHS', bloc + ';return PERIOD_SHORT;')(mois2);
    assert.equal(ps, 'Jan 2026–Jan 2027');
    // ML : étiquettes des barres mensuelles
    const m0 = Math.min(...['const _MLW', 'const ML = '].map((k) => src.indexOf(k)).filter((x) => x >= 0));
    const m1 = src.indexOf('\n', src.indexOf('const ML = ', m0));
    const ML = new Function('WML_MONTHS', src.slice(m0, m1) + ';return ML;')(['2026-12', '2027-01']);
    assert.deepEqual(Array.from(ML), ['Déc 26', 'Jan 27']);
    // titres écrits en dur retirés
    assert.ok(!src.includes('Toutes les pharmacies · Jan – Avr 2026'), 'titre « Jan – Avr 2026 » écrit en dur');
    assert.ok(!src.includes("'WML_Groupement_2026.csv'"), 'nom de fichier 2026 écrit en dur');
    void AB;
  });
}
