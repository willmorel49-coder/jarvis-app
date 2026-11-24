/* 24/11/2026, favoris du Catalogue produits (demande de Will : « un bouton favoris pour faire un listing produits, par exemple
   dans les nouveautés […] Karine va pouvoir se faire un panier de produits à mettre en avant »). Vrai code (v2-comptoir.js entier),
   bac à sable sans navigateur, faux fetch, fausse base `profils`. Lancer : node --test tests/catalogue-favoris.test.mjs
   a. accueil : la carte « Mes favoris » (vide = le mode d'emploi) et une étoile par ligne de « Ce qui change » ;
   b. sans compte : l'étoile range le produit, la carte et le volet le montrent, « Tout mettre au panier » le met au panier ;
   c. avec compte : la liste part dans `profils` (ligne __favprod_<id>__), relue avant d'écrire (un autre appareil n'est pas écrasé),
      et retirer l'enlève ;
   d. un favori sorti du catalogue reste visible, à part, et se retire ;
   e. base en panne : le favori reste sur l'appareil et on le dit. Contre-épreuve : le harnais compte bien des étoiles là où il y en a. */
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

function fausseBase(lignes = {}, panne = false) {
  const appels = [];
  const from = (table) => {
    const q = { eqs: {} };
    q.select = () => q;
    q.eq = (k, v) => { q.eqs[k] = v; return q; };
    q.maybeSingle = () => {
      appels.push(['lire', table, q.eqs.scope_id]);
      if (panne) return Promise.resolve({ data: null, error: new Error('panne') });
      const r = lignes[q.eqs.scope_id];
      return Promise.resolve({ data: r ? { data: JSON.parse(JSON.stringify(r)) } : null, error: null });
    };
    q.upsert = (o) => {
      appels.push(['ecrire', table, o.scope_id]);
      if (panne) return Promise.resolve({ error: new Error('panne') });
      lignes[o.scope_id] = JSON.parse(JSON.stringify(o.data));
      return Promise.resolve({ error: null });
    };
    return q;
  };
  return { client: { from, rpc: () => Promise.resolve({ data: false }) }, lignes, appels };
}
const pause = async (n = 6) => { for (let i = 0; i < n; i++) await attendre(); };
const etoiles = (h) => nb(h, /class="cp-fav( on)?" data-fav=/g);

test('a. accueil : carte « Mes favoris » vide = mode d\'emploi ; une étoile par ligne de « Ce qui change »', async () => {
  const sb = await pret(monter());
  const h = sb.V2.comptoir.rendre(), t = sansBalises(h);
  assert.match(t, /Mes favoris/);
  assert.match(t, /Aucun favori pour le moment/);
  assert.equal(nb(h, /id="cq1-fav-hote"/g), 1);
  const lignes = nb(h, /class="cpd-l" role="button"/g);
  assert.ok(lignes > 0, 'contre-épreuve : « Ce qui change » montre des lignes');
  assert.equal(etoiles(h), lignes, 'une étoile par ligne');
  assert.equal(nb(h, /<button[^>]*class="cpd-l"/g), 0, 'la ligne n\'est plus un bouton : pas de bouton dans un bouton');
});

test('b. sans compte : étoile → carte, volet, panier', async () => {
  const sb = await pret(monter());
  const K = sb.V2.comptoir;
  await K.favori(E);
  let h = K.rendre(), t = sansBalises(h);
  assert.match(t, /Mes favoris 1/);
  assert.match(t, /ALPHA JUNIOR 250MG/);
  assert.match(h, /class="cp-fav on" data-fav="3400000000005"/);
  assert.match(t, /Voir mes favoris \(1\)/);
  K.porte('fav');
  assert.equal(C(sb).porte, 'fav');
  h = K.rendre(); t = sansBalises(h);
  assert.match(t, /Tout mettre au panier \(1\)/);
  assert.match(t, /ajouté le 09\/11\/2026/, 'le jour d\'ajout vient de l\'horloge de l\'écran');
  assert.match(t, /Cette liste est gardée sur cet appareil\./);
  K.favorisAuPanier();
  assert.deepEqual(Object.keys(sb.V2.produits.S.sel), [E]);
  await K.favori(E);
  assert.match(sansBalises(K.rendre()), /Aucun favori pour le moment/, 'retirer vide la liste');
});

test('c. avec compte : écrit dans profils, relit avant d\'écrire, retire', async () => {
  const B0 = fausseBase({ '__favprod_u1__': { items: [{ c: B, d: 'BETA 10MG BT30', t: '2026-11-01' }] } });   // ajouté depuis l'iPhone
  const sb = monter();
  sb.V2.user = { id: 'u1', name: 'Karine' };
  sb.V2.sb = () => B0.client;
  await pret(sb);
  K: {
    const K = sb.V2.comptoir;
    K.rendre(); await pause();
    assert.ok(B0.appels.some((a) => a[0] === 'lire' && a[1] === 'profils' && a[2] === '__favprod_u1__'), 'la liste est lue dans profils');
    assert.match(sansBalises(K.rendre()), /BETA 10MG BT30/, 'le favori de l\'autre appareil apparaît');
    B0.lignes['__favprod_u1__'].items.push({ c: G, d: 'GAMMA 1G BT8', t: '2026-11-02' });   // un autre appareil ajoute entre-temps
    assert.equal(await K.favori(A), true);
    const items = B0.lignes['__favprod_u1__'].items.map((x) => x.c);
    assert.deepEqual(items, [A, B, G], 'le plus récent d\'abord, rien d\'écrasé');
    assert.match(sansBalises(K.rendre()), /Mes favoris 3/);
    K.porte('fav');
    assert.match(sansBalises(K.rendre()), /Cette liste vous suit sur tous vos appareils\./);
    assert.equal(await K.favori(B), true);
    assert.deepEqual(B0.lignes['__favprod_u1__'].items.map((x) => x.c), [A, G]);
  }
});

test('d. un favori sorti du catalogue reste visible à part et se retire', async () => {
  const H = '3499999999998';
  const B0 = fausseBase({ '__favprod_u1__': { items: [{ c: H, d: 'ANCIEN PRODUIT', t: '2026-10-01' }, { c: A, d: 'ALPHA', t: '2026-10-02' }] } });
  const sb = monter();
  sb.V2.user = { id: 'u1' }; sb.V2.sb = () => B0.client;
  await pret(sb);
  const K = sb.V2.comptoir;
  K.rendre(); await pause();
  K.porte('fav');
  const h = K.rendre(), t = sansBalises(h);
  assert.match(t, /N'est plus dans notre catalogue/);
  assert.match(t, /ANCIEN PRODUIT/);
  assert.match(t, /Tout mettre au panier \(1\)/, 'seul ALPHA peut aller au panier');
  assert.match(h, new RegExp('data-fav="' + H + '"'));
  await K.favori(H);
  assert.deepEqual(B0.lignes['__favprod_u1__'].items.map((x) => x.c), [A]);
});

test('e. base en panne : gardé sur l\'appareil, et dit', async () => {
  const B0 = fausseBase({}, true), toasts = [];
  const sb = monter();
  sb.V2.user = { id: 'u1' }; sb.V2.sb = () => B0.client; sb.V2.toast = (m, k) => toasts.push([m, k]);
  await pret(sb);
  const K = sb.V2.comptoir;
  K.rendre(); await pause();
  assert.equal(await K.favori(A), false);
  assert.ok(toasts.some((x) => /cet appareil seulement/.test(x[0]) && x[1] === 'warn'), 'le message d\'avertissement est montré');
  assert.match(sansBalises(K.rendre()), /Mes favoris 1/, 'le favori reste à l\'écran');
  K.porte('fav');
  assert.match(sansBalises(K.rendre()), /la base n'a pas répondu/);
});
