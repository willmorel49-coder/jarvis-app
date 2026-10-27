// « À rappeler cette semaine » — le RENDU (crm/v2/v2-decrochage.js), chargé tel quel dans node:vm
// avec le vrai moteur, sur des ventes INVENTÉES. Marqueur positif d'abord, puis états vides :
// un bloc vide ressemble à un bloc juste, sauf si l'on vérifie qu'il sait aussi rendre des lignes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const R = new URL('../crm/v2/', import.meta.url);
const MOTEUR = readFileSync(new URL('v2-decrochage-moteur.js', R), 'utf8');
const ECRAN = readFileSync(new URL('v2-decrochage.js', R), 'utf8');

// 9 mois (janv.→sept. 2026). B stable à 2 000 €/mois ; A à 1 000 €/mois puis 200 € à partir de juillet.
function ventes(nbMois = 9, chuteA = true) {
  const v = [];
  for (let m = 1; m <= nbMois; m++) {
    v.push({ pharmacyId: '111', year: 2026, month: m, commercial: 'KV', mntNetHt: chuteA && m >= 7 ? 200 : 1000 });
    v.push({ pharmacyId: '222', year: 2026, month: m, commercial: 'KV', mntNetHt: 2000 });
  }
  return v;
}

function monter({ sales = ventes(), commercial = 'KV', brand = null } = {}) {
  const stock = {};
  const doc = {
    getElementById: () => null, querySelector: () => null,
    createElement: () => ({ set textContent(t) {}, appendChild() {} }),
    head: { appendChild() {} }
  };
  const ctx = {
    console, Date, Math, JSON, String, Number, Array, Object, setTimeout,
    document: doc,
    localStorage: { getItem: (k) => stock[k] ?? null, setItem: (k, v) => { stock[k] = String(v); } },
    V2_BRAND: brand
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.V2 = {
    user: { id: 'u-test', commercial }, commFilter: '', sales,
    pharmacies: [{ id: '111', name: 'Pharmacie des Tilleuls', ville: 'Caen', tel: '02 31 00 00 00' }, { id: '222', name: 'Pharmacie du Port', ville: 'Caen' }],
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'),
    fmtEur: (n) => Math.round(n) + ' €',
    voitVentesDe: () => true,
    visite: { all: () => ({}) },
    go() {}, mesurer() {}, toast() {}
  };
  vm.createContext(ctx);
  vm.runInContext(MOTEUR, ctx);
  vm.runInContext(ECRAN, ctx);
  return { V2: ctx.V2, stock };
}

const ERREURS = /undefined|NaN|null|\[object|erreur|Error/i;

test('marqueur positif : le bloc liste l’officine qui décroche, avec ses euros et ses gestes', () => {
  const { V2 } = monter();
  const h = V2.decrochageUI.bloc();
  assert.match(h, /À rappeler cette semaine/);
  assert.match(h, /Pharmacie des Tilleuls/);
  assert.doesNotMatch(h, /Pharmacie du Port/);           // stable : jamais dans la liste
  assert.match(h, /−800 € par mois/);                     // (3 000 − 600) / 3
  assert.match(h, /−80\u00A0%/);  // insécable : le « % » ne tombe jamais seul en début de ligne
  assert.match(h, /href="tel:0231000000"/);              // « Appeler » seulement si le téléphone est connu
  assert.match(h, />Noter</);
  assert.match(h, />Pas pertinent</);
  assert.match(h, /Ventes jusqu’à fin septembre 2026/);
  // Les seuils affichés se LISENT dans le réglage.
  const Rg = V2.decrochage.REGLAGES;
  assert.match(h, new RegExp('au moins ' + Math.round(Rg.baissePct * 100) + '\u00A0% et ' + Rg.baisseMinAvant + ' €'));
  assert.doesNotMatch(h, ERREURS);
  assert.equal(V2.decrochageUI.compte(), 1);
});

test('état vide : aucune baisse → la règle est rappelée, pas un bloc muet', () => {
  const { V2 } = monter({ sales: ventes(9, false) });
  const h = V2.decrochageUI.bloc();
  assert.match(h, /À rappeler cette semaine/);
  assert.match(h, /Aucune officine en baisse d’au moins 25\u00A0% et 500 €/);
  assert.doesNotMatch(h, /dr-l"/);
  assert.doesNotMatch(h, ERREURS);
  assert.equal(V2.decrochageUI.compte(), 0);
});

test('moins de six mois complets → liste suspendue, et le compteur d’accueil se tait (jamais un faux 0)', () => {
  const { V2 } = monter({ sales: ventes(4) });
  assert.match(V2.decrochageUI.bloc(), /Liste suspendue : il manque des mois de ventes complets \(4 sur 6\)/);
  assert.equal(V2.decrochageUI.compte(), null);
});

test('sans commercial (direction, vue « Tous ») → invitation à choisir, aucune ligne', () => {
  const { V2 } = monter({ commercial: '' });
  const h = V2.decrochageUI.bloc();
  assert.match(h, /Choisissez un commercial/);
  assert.equal(V2.decrochageUI.compte(), null);
});

test('OPSO et Escale : bloc absent', () => {
  assert.equal(monter({ brand: { opso: true } }).V2.decrochageUI.bloc(), '');
  assert.equal(monter({ brand: { escale: true } }).V2.decrochageUI.bloc(), '');
});

test('geste « pas pertinent » : gardé sur l’appareil sans table, la ligne quitte la liste et c’est dit', () => {
  const { V2, stock } = monter();
  V2.decrochageUI.geste('111', 'pas_pertinent', 'saisonnier');
  const gardes = JSON.parse(stock.jarvis_decrochage_v1);
  assert.equal(gardes.length, 1);
  assert.equal(gardes[0].pharmacy_id, '111');
  assert.equal(gardes[0].statut, 'pas_pertinent');
  assert.equal(gardes[0].motif, 'saisonnier');
  assert.equal(gardes[0].mois_ref, '2026-09');
  assert.equal(gardes[0].avant_mensuel, 1000);
  const h = V2.decrochageUI.bloc();
  assert.doesNotMatch(h, /Pharmacie des Tilleuls/);
  assert.match(h, /1 écartée \(pas pertinent\)/);
});

test('bandeau de fiche : présent pour l’officine listée, absent pour une autre', () => {
  const { V2 } = monter();
  V2.decrochageUI.bloc();
  assert.match(V2.decrochageUI.bandeau('111'), /id="dr-bandeau"[\s\S]*−800 € par mois[\s\S]*Ce qu’elle ne commande plus/);
  assert.equal(V2.decrochageUI.bandeau('222'), '');
});
