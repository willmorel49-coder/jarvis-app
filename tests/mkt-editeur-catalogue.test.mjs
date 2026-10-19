// Éditeur de fiche Marketing, panneau « Catalogue du groupe » (19/10/2026) :
// l'index, la recherche sans accents, le filtre site + « En stock », le masquage des noms de fournisseurs et
// l'objet posé sur la feuille — joués sur le VRAI fichier crm/v2/catalogue-groupe-data.js.
// Les fonctions vivent dans la fermeture de v2-mkt.js : on en découpe le texte (de `sansAccent` à `cgPastilles`)
// et on le joue dans un contexte isolé. Si le découpage ne trouve plus ses repères, le test échoue, il ne passe pas à vide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const lire = (f) => fs.readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');
const src = lire('v2-mkt.js');
const a = src.indexOf('  function sansAccent(x) {');
const b = src.indexOf('  function cgPastilles(o) {');
assert.ok(a > 0 && b > a, 'repères du bloc catalogue introuvables dans v2-mkt.js');
const p1 = src.indexOf('  function cgPrixCarte(o) {'), p2 = src.indexOf('  function cgVoletHtml() {');
assert.ok(p1 > b && p2 > p1, 'repères de cgPrixCarte introuvables');
const bloc = src.slice(a, b) + src.slice(p1, p2);

const G = vm.runInNewContext(lire('catalogue-groupe-data.js') + ';CATALOGUE_GROUPE', {});
// Trois produits « à photo » connus, pour vérifier la partition « photos d'abord ».
const photos = [G.rows[500][0], G.rows[9000][0], G.rows[20000][0]];
const IMG = {}; photos.forEach((c) => { IMG[c] = 'https://exemple.invalid/' + c + '.jpg'; });

function contexte() {
  const fenetre = { CATALOGUE_GROUPE: G, MKT_IMG: IMG };
  const V2 = { produits: { produitMkt: (cip, repli) => repli ? ({ src: 'produits', key: 'p' + cip, name: repli.d, brand: 'INTER TRADE PHAR', cip: String(cip), price: repli.net || repli.ppht, ppht: 0, cat: 'Famille tarifaire', img: IMG[cip] || '' }) : null } };
  const ctx = vm.createContext({ window: fenetre, V2, editing: { products: [] } });
  vm.runInContext('var CAT_TOTAL_ATTENDU = 22461, cgIdx = null, cgF = { q: "", rayon: "all", site: "", labo: "", stock: false };\n' + bloc, ctx);
  return ctx;
}
const J = (ctx, code) => vm.runInContext(code, ctx);

test('index : 22 461 références, photos d\'abord (partition stable), comptes par rayon cohérents', () => {
  const c = contexte();
  const K = J(c, 'cgIndex()');
  assert.equal(K.total, G.rows.length);
  assert.equal(K.rows.length, G.rows.length);
  assert.equal(J(c, 'cgNb()'), 22461);
  assert.equal(JSON.stringify(K.rows.slice(0, 3).map((o) => o.cip).sort()), JSON.stringify(photos.slice().sort()), 'les trois produits à photo ouvrent la liste');
  assert.ok(K.rows[3].n >= K.rows[K.rows.length - 1].n, 'ordre du fichier (pharmacies décroissant) conservé après la partition');
  const somme = K.rayons.reduce((s, r) => s + r.n, 0) + K.sansRayon;
  assert.equal(somme, K.total, 'chaque référence compte dans un rayon ou « sans rayon »');
  assert.ok(K.rayons.length >= 20 && K.rayons.every((r) => r.l), 'rayons nommés');
  assert.ok(K.labos.length > 100);
});

test('recherche : « doliprane », un CIP, sans accents, plusieurs mots', () => {
  const c = contexte();
  J(c, 'cgF = { q: "doliprane", rayon: "all", site: "", labo: "", stock: false }');
  const dol = J(c, 'cgFiltre()');
  assert.ok(dol.length >= 5, 'doliprane : ' + dol.length);
  assert.ok(dol.every((o) => /doliprane/i.test(o.d + ' ' + o.labo) || /doliprane/.test(o.s)));
  const cible = G.rows.find((r) => /^DOLIPRANE 1000MG CPR/.test(r[1]));
  assert.ok(cible, 'DOLIPRANE 1000MG présent dans le fichier');
  J(c, 'cgF.q = "' + cible[0] + '"');
  const parCip = J(c, 'cgFiltre()');
  assert.equal(parCip.length, 1);
  assert.equal(parCip[0].cip, cible[0]);
  J(c, 'cgF.q = "DOLIPRANE  1000mg"');   // deux mots, casse et espaces libres
  assert.ok(J(c, 'cgFiltre()').some((o) => o.cip === cible[0]));
  J(c, 'cgF.q = "a"');                    // un seul caractère : pas de filtre
  assert.equal(J(c, 'cgFiltre().length'), G.rows.length);
  J(c, 'cgF.q = "zzzzqqqq"');
  assert.equal(J(c, 'cgFiltre().length'), 0);
});

test('filtre site + « En stock » : dans CE site, sinon dans au moins un ; rayon et labo se cumulent', () => {
  const c = contexte();
  const tous = G.rows.length;
  J(c, 'cgF = { q: "", rayon: "all", site: "", labo: "", stock: true }');
  const unSite = J(c, 'cgFiltre()');
  assert.ok(unSite.length > 0 && unSite.length < tous);
  assert.ok(unSite.every((o) => o.sites.indexOf('2') >= 0));
  J(c, 'cgF.site = "POS"');
  const pos = J(c, 'cgFiltre()');
  assert.ok(pos.length > 0 && pos.length <= unSite.length);
  assert.ok(pos.every((o) => o.sites.charAt(3) === '2'), 'POS = 4e caractère de la chaîne des sites');
  J(c, 'cgF.stock = false');
  const releve = J(c, 'cgFiltre()');
  assert.ok(releve.every((o) => o.sites.charAt(3) !== '0'), 'un site seul = lignes présentes au relevé de ce site');
  assert.ok(releve.length >= pos.length);
  const ry = J(c, 'cgIndex().rayons[0]');
  J(c, 'cgF = { q: "", rayon: "' + ry.i + '", site: "", labo: "", stock: false }');
  const dansRayon = J(c, 'cgFiltre()');
  assert.equal(dansRayon.length, ry.n);
  const labo = dansRayon[0].labo;
  if (labo) {
    J(c, 'cgF.labo = ' + JSON.stringify(labo));
    assert.ok(J(c, 'cgFiltre()').every((o) => o.labo === labo && String(o.ry) === String(ry.i)));
  }
});

test('fournisseurs : jamais une marque, ni dans le catalogue ni sur une ancienne fiche', () => {
  const c = contexte();
  assert.equal(J(c, 'marqueSure("INTER TRADE PHAR")'), '');
  assert.equal(J(c, 'marqueSure("  inter  trade  pharma ")'), '');
  assert.equal(J(c, 'marqueSure("ITP")'), '');
  assert.equal(J(c, 'marqueSure("Inter Trade Pharma SAS")'), '', 'un nom qui CONTIENT un fournisseur long');
  assert.equal(J(c, 'marqueSure("inter trade pha")'), '');
  assert.equal(J(c, 'marqueSure("INTER TRADE PHAR%")'), '');
  assert.equal(J(c, 'marqueSure("MITPA SANTE")'), 'MITPA SANTE', '« ITP » au milieu d\'un mot n\'est pas touché');
  assert.equal(J(c, 'marqueSure("BIOGARAN")'), 'BIOGARAN');
  assert.equal(J(c, 'marqueSure("")'), '');
  const K = J(c, 'cgIndex()');
  const mauvais = K.labos.filter((l) => J(c, 'marqueSure(' + JSON.stringify(l.l) + ')') === '');
  assert.equal(mauvais.length, 0, 'aucune marque du catalogue n\'est un fournisseur');
  // Filet : fichier pas encore chargé, la liste de secours masque quand même.
  const nu = vm.createContext({ window: {}, V2: {}, editing: null });
  vm.runInContext('var CAT_TOTAL_ATTENDU = 22461, cgIdx = null, cgF = {};\n' + bloc, nu);
  assert.equal(vm.runInContext('marqueSure("INTER TRADE PHAR")', nu), '');
  assert.equal(vm.runInContext('cgNb()', nu), 22461, 'avant chargement : le compte attendu');
});

test('produit posé : règles de prix de produitMkt, marque et rayon du groupe', () => {
  const c = contexte();
  const K = J(c, 'cgIndex()');
  const o = K.rows.find((x) => x.ry >= 0 && x.net > 0);
  const p = J(c, 'cgProduit(cgIndex().par["' + o.cip + '"])');
  assert.equal(p.key, 'p' + o.cip);
  assert.equal(p.brand, J(c, 'marqueSure(' + JSON.stringify(o.labo) + ')'), 'la marque vient du groupe, pas du repli');
  assert.notEqual(p.brand, 'INTER TRADE PHAR');
  assert.equal(p.cat, G.rayons[o.ry], 'cat = rayon du groupe');
  assert.equal(p.price, o.net || o.ppht);
  // Tarif inconnu : la carte le dit, la feuille n'invente pas un prix.
  const inconnu = K.rows.find((x) => x.ppht === 0 && x.net === 0);
  assert.ok(inconnu, 'le fichier contient des tarifs inconnus');
  assert.equal(J(c, 'cgPrixCarte(cgIndex().par["' + inconnu.cip + '"])'), 0);
});

test('tarif : la ligne du groupe PRIME (PPHT POS) ; la carte montre exactement le prix de la feuille', () => {
  const fen = {}; vm.runInNewContext(lire('catalogue-complet-data.js'), { window: fen });
  const C = fen.CATALOGUE_COMPLET, cplt = {}; C.rows.forEach((r) => { cplt[r[0]] = r; });
  const diff = G.rows.find((r) => cplt[r[0]] && r[5] > 0 && Math.abs(cplt[r[0]][5] - r[5]) > 0.005);
  assert.ok(diff, 'au moins un produit dont le tarif POS diffère de CATALOGUE_COMPLET');
  const c = contexte();
  // produitMkt réel : `repli || fiche(cip)` ; ici fiche() rend l'ancien tarif de CATALOGUE_COMPLET.
  vm.runInContext('V2.produits.produitMkt = function (cip, repli) { var f = repli || { d: "ancien", f: "nr", ppht: ' + cplt[diff[0]][5] + ', net: ' + cplt[diff[0]][6] + ' }; return { src: "produits", key: "p" + cip, name: f.d, brand: "", cip: String(cip), price: +f.net || +f.ppht || 0, ppht: 0, cat: "", img: "" }; }', c);
  const o = J(c, 'cgIndex().par["' + diff[0] + '"]');
  const carte = J(c, 'cgPrixCarte(cgIndex().par["' + diff[0] + '"])');
  const feuille = J(c, 'cgProduit(cgIndex().par["' + diff[0] + '"])').price;
  assert.equal(carte, feuille, 'carte = feuille');
  assert.equal(carte, diff[6] || diff[5], 'valeur du groupe, pas celle de CATALOGUE_COMPLET');
  assert.notEqual(carte, cplt[diff[0]][6] || cplt[diff[0]][5]);
});
