/* 23/11/2026, v1 « La recherche d'abord » du Catalogue produits : ce que le portage change, vérifié sur le VRAI code (v2-comptoir.js
   entier, bac à sable sans navigateur, faux fetch). Lancer : node --test tests/catalogue-recherche-dabord.test.mjs
   a. « notre marge » ne saute plus de l'estimation du Pilotage (1,44 €) au chiffre de la direction (1,59 €) : tant que le fichier
      protégé est demandé et pas arrivé, la fiche et la liste montrent une attente, jamais un chiffre ;
   b. à l'accueil, le grand champ #cpd-q est dans la page, une seule fois ;
   c. « À proposer » (la liste de produits) a quitté l'accueil ; porte('proposer') ramène à l'accueil ;
   d. portes() ramène à l'accueil (P-2). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const A = '3400000000001', B = '3400000000002', G = '3400000000003', DL = '3400000000004', E = '3400000000005', Z = '3400000000006';
const CAT = {
  [A]: { c: A, cip: A, d: 'ALPHA 500MG BT10', labo: 'LABO UN', mol: 'alphamol', f: 'pr_low', ppht: 2, net: 1.8, stock: 10, n: 0 },
  [B]: { c: B, cip: B, d: 'BETA 10MG BT30', labo: 'LABO DEUX', mol: 'betamol', f: 'pr_mid', ppht: 4.5, net: 4, stock: 0, n: 0 },
  [G]: { c: G, cip: G, d: 'GAMMA 1G BT8', labo: 'LABO TROIS', mol: 'gammamol', f: 'pr_high', ppht: 22, net: 20, stock: 7, n: 0 },
  [DL]: { c: DL, cip: DL, d: 'DELTA 5MG BT28', labo: 'LABO UN', mol: 'deltamol', f: 'pr_low', ppht: 3.5, net: 3, stock: 4, n: 0 },
  [E]: { c: E, cip: E, d: 'ALPHA JUNIOR 250MG', labo: 'LABO QUATRE', mol: 'epsimol', f: 'pr_low', ppht: 5.5, net: 5, stock: 3, n: 0 },
  [Z]: { c: Z, cip: Z, d: 'ZETA NR', labo: 'LABO CINQ', mol: '', f: 'nr', ppht: 9, net: 0, stock: 2, n: 0 }
};
const VENTES = [[ '1', 1, 'X', A, 1, 1, 1 ], [ '1', 1, 'X', B, 40, 1, 1 ], [ '1', 1, 'X', G, 2, 1, 1 ], [ '1', 1, 'X', DL, 30, 1, 1 ], [ '1', 1, 'X', E, 1, 1, 1 ]];
const FAUX = {
  'national.json': { generated: '2026-11-08', data: { [A]: { v: 1000, d: 'ALPHAMOL' }, [B]: { v: 800, d: 'BETAMOL' }, [G]: { v: 600, d: 'GAMMAMOL' }, [DL]: { v: 500, d: 'DELTAMOL' }, [E]: { v: 400, d: 'EPSIMOL' } } },
  'prix-futurs.json': { generated: '2026-11-08', changes: [
    { c: A, d: 'ALPHA', pfht: 1.5, ppttc: 3.0, ancien_ttc: 3.5, sens: 'baisse', date_effet: '2026-10-20', date_publi: '2026-10-20' },     // en vigueur depuis moins de 180 jours
    { c: B, d: 'BETA', pfht: 3, ppttc: 8, ancien_ttc: 10, sens: 'baisse', date_effet: '2026-12-01', date_publi: '2026-11-01' },       // à venir
    { c: DL, d: 'DELTA', pfht: 3, ppttc: 6, ancien_ttc: 5, sens: 'hausse', date_effet: '2026-10-20', date_publi: '2026-10-20' },     // une hausse : pas une baisse
    { c: G, d: 'GAMMA', pfht: 3, ppttc: 6, ancien_ttc: 8, sens: 'baisse', date_effet: '2026-01-02', date_publi: '2026-01-02' },       // trop ancienne (> 180 jours)
    { c: '3499999999999', d: 'HORS CATALOGUE', pfht: 3, ppttc: 6, ancien_ttc: 8, sens: 'baisse', date_effet: '2026-10-25', date_publi: '2026-10-25' }] },
  'prix-futurs-archive.json': { evenements: [] },
  'ansm-dispo.json': { generated: '2026-11-08', items: [
    { st: 'Rupture de stock', cips: [DL], since: '2026-11-06', retour: { raw: 'décembre 2026', iso: '2026-12' } },
    { st: "Tension d'approvisio", cips: [G], since: '2026-10-01' }] }
};
const RUPT = new Set([DL]);

function faitFetch(table, echec) {
  return (url) => {
    const f = String(url).split('?')[0];
    if (echec && echec.includes(f)) return Promise.reject(new Error('réseau coupé'));
    if (f in table) return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(table[f]))) });
    return Promise.resolve({ ok: false, json: () => Promise.reject(new Error('404')) });
  };
}
function monter(table = FAUX, echec) {
  const crees = [], ecouteurs = {};
  const doc = {
    getElementById: (id) => crees.find((e) => e.id === id) || null,
    createElement: () => { const e = { id: '', innerHTML: '', textContent: '' }; crees.push(e); return e; },
    head: { appendChild() {} }, body: { appendChild() {} }
  };
  const sb = { document: doc, console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Date, location: { hash: '#produits' }, innerWidth: 1280 };
  sb.window = sb; sb.globalThis = sb;
  sb.addEventListener = (ev, f) => { (ecouteurs[ev] = ecouteurs[ev] || []).push(f); };
  sb.fetch = faitFetch(table, echec);
  sb.rendus = 0; sb.crees = crees; sb.ecouteurs = ecouteurs;
  vm.createContext(sb);
  vm.runInContext(`window.V2 = {
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    route: { name: 'produits' }, render() { window.rendus++; }, go() {}, toast() {},
    produits: { S: { sel: {} }, FAM: { pr_low: { l: 'Princeps bas prix' }, pr_mid: { l: 'Princeps moyens' }, pr_high: { l: 'Princeps chers' }, nr: { l: 'Non remboursables' } },
      catalogueIndex: () => window.CATX, enRupture: (c) => window.RUPTX.has(String(c)), rupturesEtat: () => 2, selSauver() {}, index: () => null },
    nouveaute: (c) => (window.NOUVEAUTES && window.NOUVEAUTES.data[String(c)]) || null,
    ventesRestreintes: () => false
  };
  window.ICO = (n) => '<svg data-i="' + n + '"></svg>';
  window.WML_SALES = ${JSON.stringify(VENTES)};
  window.STOCK_IP = { data: ${JSON.stringify({ [A]: 5, [B]: 0, [G]: 5, [DL]: 5, [E]: 5 })} };
  window.NOUVEAUTES = { meta: { mois: 36, gen: '2026-11-03', source: 'BDPM' }, data: { '${E}': { amm: '2026-02', labo: 'LABO QUATRE' }, '3488888888888': { amm: '2026-03', labo: 'HORS CATALOGUE' } } };`, sb);
  sb.CATX = JSON.parse(JSON.stringify(CAT)); sb.RUPTX = RUPT;
  vm.runInContext(readFileSync(new URL('../crm/v2/v2-comptoir.js', import.meta.url), 'utf8'), sb);
  sb.V2.comptoir._calc.horloge(() => new Date(2026, 10, 9));   // 09/11/2026
  return sb;
}

const nb = (h, re) => (h.match(re) || []).length;
const sansBalises = (h) => h.replace(/<[^>]*>/g, ' ').replace(/[\s\u00a0]+/g, ' ');
const attendre = () => new Promise((r) => setTimeout(r, 0));
async function pret(sb) {
  await sb.V2.comptoir.chargerNational();
  sb.V2.comptoir.rendre();
  await sb.V2.comptoir._calc.pret();
  return sb;
}
const C = (sb) => sb.V2.comptoir._portes.etat;

test('b. accueil : le champ #cpd-q est dans le HTML, une seule fois', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  assert.equal(C(sb).porte, null);
  const h = K.rendre();
  assert.equal(nb(h, /id="cpd-q"/g), 1, 'un seul champ de recherche à l\'accueil');
  assert.equal(nb(h, /class="cpd-door"/g), 0, 'plus de trois grandes portes');
});

test('c. « À proposer » (liste de produits) n\'est plus à l\'accueil ; porte(\'proposer\') ramène à l\'accueil sans erreur', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  const h = K.rendre(), t = sansBalises(h);
  assert.doesNotMatch(t, /À proposer/);
  assert.doesNotMatch(t, /de plus par an/);
  assert.match(t, /Ce qui change/, 'la liste « Ce qui change » reste');
  assert.doesNotThrow(() => K.porte('proposer'));
  assert.equal(C(sb).porte, null, 'porte(\'proposer\') = accueil');
  const h2 = K.rendre();
  assert.equal(nb(h2, /id="cpd-q"/g), 1);
  assert.doesNotMatch(sansBalises(h2), /À proposer/);
});

test('d. portes() ramène à l\'accueil depuis un volet (P-2)', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  K.porte('change');
  assert.equal(C(sb).porte, 'change');
  K.portes();
  assert.equal(C(sb).porte, null);
  assert.equal(nb(K.rendre(), /id="cpd-q"/g), 1, 'le retour ramène au champ de recherche');
});

// ── a. notre marge pendant le chargement du fichier de la direction ──
function brancherDirection(sb, decision) {
  // decision : 'oui' | 'non' | 'erreur' — la RPC reste en attente tant qu'on ne la libère pas
  let libere; const attente = new Promise((r) => { libere = r; });
  sb.V2.user = { id: 'u1' };
  sb.V2.piloMargeVente = () => 1.44;                                  // l'estimation du Pilotage
  sb.V2.sb = () => ({ rpc: () => attente.then(() => {
    if (decision === 'erreur') throw new Error('réseau');
    return decision === 'oui' ? { data: true } : { data: false };
  }) });
  sb.V2.loadFiles = () => { sb.MARGE_PRODUITS_ARRIVE = true; sb.MARGE_PRODUITS = {
    meta: { colonnes: ['cip', 'marge_boite_26', 'marge_boite_27', 'taux_26', 'taux_27', 'dispo_2027'] },
    produits: [[A, 1.59, 1.59, 0.1, 0.1, 1]] }; return Promise.resolve(); };
  return libere;
}
const ligneA = (sb) => sb.V2.comptoir._calc.donnees().lignes.find((l) => l.cip === A);
const tuile = (sb) => sansBalises(sb.V2.comptoir._calc.tuileNotreMarge(sb.V2.comptoir.stats(ligneA(sb), sb.V2.comptoir._calc.donnees())));

test('a. notre marge : en attente = pas de chiffre ; refusé = estimation du Pilotage ; arrivé = chiffre de la direction', async () => {
  const sb = await pret(monter());
  const libere = brancherDirection(sb, 'oui');
  const l = ligneA(sb), d = sb.V2.comptoir._calc.donnees();
  const s1 = sb.V2.comptoir.stats(l, d);
  assert.ok(s1.notreMarge && s1.notreMarge.attente === true, 'état d\'attente, pas une estimation');
  assert.equal(s1.notreMarge.boite26, null);
  const t1 = tuile(sb);
  assert.doesNotMatch(t1, /1,44|1,59|NaN/, 'aucun chiffre pendant l\'attente');
  assert.match(t1, /Estimation de la direction en cours de chargement/);
  // la ligne de la liste ne montre aucun chiffre non plus
  C(sb).q = 'alpha';
  const h1 = sansBalises(sb.V2.comptoir.rendre());
  assert.doesNotMatch(h1, /1,44|1,59|NaN/);
  // fichier arrivé : le chiffre de la direction
  libere(); await attendre(); await attendre(); await attendre();
  assert.match(tuile(sb), /1,59/);
  assert.doesNotMatch(tuile(sb), /1,44|en cours de chargement/);
});

test('a. notre marge : accès refusé (état 3) = l\'estimation du Pilotage, et l\'écran est redessiné', async () => {
  const sb = await pret(monter());
  await new Promise((r) => setTimeout(r, 300));                       // les redessins déjà planifiés par les autres fichiers sont passés
  const libere = brancherDirection(sb, 'non');
  const d = sb.V2.comptoir._calc.donnees();
  assert.equal(sb.V2.comptoir.stats(ligneA(sb), d).notreMarge.attente, true);
  await new Promise((r) => setTimeout(r, 300));                       // les redessins dus aux autres fichiers demandés par stats() sont passés
  const avant = sb.rendus;
  libere(); await attendre(); await attendre(); await attendre();
  const nm = sb.V2.comptoir.stats(ligneA(sb), d).notreMarge;
  assert.equal(nm.source, 'pilotage');
  assert.equal(nm.boite26, 1.44);
  assert.match(tuile(sb), /1,44/);
  // le redessin asynchrone remplace l'attente (planRerender est différé par un minuteur)
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(sb.rendus > avant, 'l\'écran est redessiné quand l\'accès est refusé');
});

test('a. notre marge : erreur de la RPC (.catch) = estimation du Pilotage et redessin', async () => {
  const sb = await pret(monter());
  await new Promise((r) => setTimeout(r, 300));                       // les redessins déjà planifiés par les autres fichiers sont passés
  const libere = brancherDirection(sb, 'erreur');
  const d = sb.V2.comptoir._calc.donnees();
  assert.equal(sb.V2.comptoir.stats(ligneA(sb), d).notreMarge.attente, true);
  await new Promise((r) => setTimeout(r, 300));                       // les redessins dus aux autres fichiers demandés par stats() sont passés
  const avant = sb.rendus;
  libere(); await attendre(); await attendre(); await attendre();
  assert.equal(sb.V2.comptoir.stats(ligneA(sb), d).notreMarge.source, 'pilotage');
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(sb.rendus > avant);
});

test('titre : la CI lit le h1.cpd-h1 « Catalogue produits » de l\'accueil, et le petit titre « Produits » y reste en display:none', async () => {
  // 23/11/2026, v1 La recherche d'abord : rendre le petit .v2-page-title « visible » pour la CI faisait dessiner par l'aube un second
  // bandeau « Produits » au-dessus de « Catalogue produits » (vu sous WebKit au banc). La CI vise donc le vrai titre visible.
  const ci = readFileSync(new URL('../.github/scripts/parcours-connecte.mjs', import.meta.url), 'utf8');
  const ligne = ci.split('\n').find((l) => /route: 'produits'/.test(l));
  assert.ok(ligne, 'la CI vérifie la route produits');
  const sel = (ligne.match(/selecteur: '([^']+)'/) || [])[1], txt = (ligne.match(/texte: '([^']+)'/) || [])[1];
  assert.equal(sel, 'h1.cpd-h1'); assert.equal(txt, 'Catalogue produits');
  const sb = await pret(monter());
  const html = sb.V2.comptoir.rendre();
  assert.match(String(html), /<h1 class="cpd-h1">Catalogue produits/, 'l\'accueil rend le h1 que la CI attend');
  const css = sb.crees.find((e) => e.id === 'cpd-styles').textContent;
  const regle = css.split('\n').find((l) => l.includes('.v2-page-title:has(+.cpd>.cpd-head)'));
  assert.ok(regle && /display:none/.test(regle), 'le petit titre reste masqué à l\'accueil');
});
