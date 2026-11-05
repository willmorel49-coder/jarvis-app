/* Âge du tarif des produits NR : V2.ageTarif / V2.tarifAgeHtml (v2-boot.js) et leur affichage
   dans l'onglet Catalogue de l'écran Produits (v2-produits.js).
   Pas de navigateur : on extrait de v2-boot.js le bloc exact « âge du tarif » (le vrai code, pas une
   copie) et on le rejoue dans un faux window. Le rendu du catalogue passe par le vrai v2-produits.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const B = new URL('../crm/v2/', import.meta.url);
const lire = (f) => readFileSync(new URL(f, B), 'utf8');
const boot = lire('v2-boot.js');
const debut = boot.indexOf('// ── Âge du tarif d\'un produit NON remboursable');
const fin = boot.indexOf('  V2.bestPrice = function');
assert.ok(debut > 0 && fin > debut, 'bloc ageTarif introuvable dans v2-boot.js');
const BLOC = boot.slice(debut, fin);

function monter(extra) {
  const sb = { console, Date };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext('window.V2 = {};', sb);
  vm.runInContext(extra || '', sb);
  vm.runInContext(BLOC, sb);
  return sb;
}
const AUJ = new Date(2026, 10, 5); // 05/11/2026
const DONNEES = 'window.PPHT_NR = {"1111111111111":1,"2222222222222":1};' +
  'window.TARIF_AGE = {maj:"2026-11-05",defaut:"2026-11-05",autres:{"2026-09-21":["2222222222222","3333333333333"]},exports:[]};';

test('ageTarif : un NR au tarif par defaut est recent', () => {
  const V2 = monter(DONNEES).V2;
  const a = V2.ageTarif('1111111111111', AUJ);
  assert.deepEqual({ ...a }, { date: '2026-11-05', jours: 0, vieux: false });
});

test('ageTarif : un NR de la liste « autres » prend sa date (45 jours -> vieux)', () => {
  const V2 = monter(DONNEES).V2;
  const a = V2.ageTarif('2222222222222', AUJ);
  assert.equal(a.date, '2026-09-21'); assert.equal(a.jours, 45); assert.equal(a.vieux, true);
});

test('ageTarif : seuil — 30 jours pile n est pas vieux, 31 jours l est', () => {
  const V2 = monter(DONNEES).V2;
  assert.equal(V2.ageTarif('2222222222222', new Date(2026, 9, 21)).vieux, false); // 30 j
  assert.equal(V2.ageTarif('2222222222222', new Date(2026, 9, 22)).vieux, true);  // 31 j
});

test('ageTarif : rembourse (hors PPHT_NR), fichier absent, date illisible -> null, sans erreur', () => {
  assert.equal(monter(DONNEES).V2.ageTarif('3333333333333', AUJ), null);
  assert.equal(monter('window.PPHT_NR = {"1":1};').V2.ageTarif('1', AUJ), null);
  assert.equal(monter('window.TARIF_AGE = {defaut:"2026-11-05",autres:{}};').V2.ageTarif('1', AUJ), null);
  assert.equal(monter('window.PPHT_NR={"1":1};window.TARIF_AGE={defaut:"hier",autres:{}};').V2.ageTarif('1', AUJ), null);
  assert.equal(monter(DONNEES).V2.ageTarif(null, AUJ), null);
  assert.equal(monter(DONNEES).V2.tarifAgeHtml('3333333333333', AUJ), '');
});

test('tarifAgeHtml : texte exact, orange + « a rafraichir » seulement au-dela de 30 jours', () => {
  const V2 = monter(DONNEES).V2;
  assert.equal(V2.tarifAgeHtml('1111111111111', AUJ), '<span class="v2-tarifage">Tarif du 05/11/2026</span>');
  assert.equal(V2.tarifAgeHtml('2222222222222', AUJ), '<span class="v2-tarifage vieux">Tarif du 21/09/2026 · à rafraîchir</span>');
});

test('catalogue : la mention sort sous le prix d un NR, jamais sous un remboursable', () => {
  const doc = { getElementById: () => null, createElement: () => ({ id: '', textContent: '' }), head: { appendChild() {} } };
  const sb = { document: doc, console, setTimeout, clearTimeout, URL, Blob, Date };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(`window.V2 = { pages:{}, sales:[], pharmacies:[],
    esc: s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
    fmtEur: n => n.toFixed(2).replace('.', ',') + ' €', fmtNum: n => String(Math.round(+n||0)),
    topbar: () => '', go(){}, toast(){}, render(){} }; window.ICO = () => '';` + DONNEES +
    `window.CATALOGUE_COMPLET = { meta:{n:2}, labos:['L'], mols:['M'], rows:[
      ['1111111111111','CREME NR RECENTE',0,0,'nr',10,10,5,0,3],
      ['2222222222222','CREME NR ANCIENNE',0,0,'nr',12,12,5,0,3],
      ['3333333333333','PRINCEPS REMBOURSABLE',0,0,'pr_mid',8,7,5,0,3]] };`, sb);
  vm.runInContext(BLOC, sb);
  vm.runInContext(lire('v2-produits-moteur.js'), sb);
  vm.runInContext(lire('v2-produits.js'), sb);
  vm.runInContext('V2.produits.S.mode="catalogue";', sb);
  const root = { innerHTML: '' };
  sb.V2.pages.produits.render(root);
  const lignes = root.innerHTML.split('<tr>').slice(1);
  const de = (nom) => lignes.find((l) => l.includes(nom));
  // la date dépend du jour de l'exécution : on teste la présence et la classe, pas les jours
  assert.match(de('NR RECENTE'), /class="v2-tarifage[ "][^>]*>Tarif du 05\/11\/2026/);
  assert.match(de('NR ANCIENNE'), /v2-tarifage vieux">Tarif du 21\/09\/2026/);
  assert.ok(!de('REMBOURSABLE').includes('v2-tarifage'));
});
