/* Badge « Rupture ANSM » du Catalogue produits (08/11/2026).
   Il lisait ruptures-data.js, figé au 06/07/2026 : 3 866 produits marqués pour 23 vraiment en rupture
   au relevé ANSM du jour. Il lit désormais ansm-dispo.json (robot quotidien), « Rupture de stock » seulement.
   Données FABRIQUÉES : la réponse est connue d'avance. Pas de navigateur.
   Lancer : node --test tests/produits-rupture-ansm.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const B = new URL('../crm/v2/', import.meta.url);
const lire = (f) => readFileSync(new URL(f, B), 'utf8');
const EN_RUPTURE = '3400000000011', EN_TENSION = '3400000000022', ANCIEN = '3400000000033';
const RELEVE = { generated: '2026-11-08', items: [
  { st: 'Rupture de stock', cips: [EN_RUPTURE] },
  { st: "Tension d'approvisio", cips: [EN_TENSION] },
  { st: 'Remise à disposition', cips: [ANCIEN] }
] };

function monter(fetch) {
  const doc = { getElementById: () => null, createElement: () => ({ id: '', textContent: '' }), head: { appendChild() {} } };
  const sb = { document: doc, console, setTimeout, clearTimeout, URL, Blob, Date, Promise };
  if (fetch) sb.fetch = fetch;
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  sb.rendus = 0;
  vm.runInContext(`window.V2 = { pages:{}, sales:[], pharmacies:[], route:{ name:'produits' },
    esc: s => String(s==null?'':s), fmtEur: n => String(n), fmtNum: n => String(n),
    topbar: () => '', go(){}, toast(){}, render(){ window.rendus++; } }; window.ICO = () => '';
    // L'ancien fichier figé : il marque ANCIEN, qui n'est plus en rupture. Il ne doit plus compter.
    window.RUPTURES = { meta:{ annee:'2025' }, data:{ '${ANCIEN}':{ d:'', dt:'2025-12-31' } } };`, sb);
  vm.runInContext(lire('v2-produits-moteur.js'), sb);
  vm.runInContext(lire('v2-produits.js'), sb);
  return sb;
}
const attendre = () => new Promise((r) => setTimeout(r, 0));

test('le relevé ne retient que « Rupture de stock » : ni tension, ni remise à disposition', () => {
  const sb = monter();
  const R = sb.V2.produits._rupturesDe(RELEVE);
  assert.deepEqual(Object.keys(R), [EN_RUPTURE]);
  assert.deepEqual(Object.keys(sb.V2.produits._rupturesDe(null)), []);
  assert.deepEqual(Object.keys(sb.V2.produits._rupturesDe({ items: [{ st: 'Rupture de stock' }] })), []);
});

test('le badge suit le relevé du jour, plus ruptures-data.js ; un seul appel, un seul nouveau rendu', async () => {
  let appels = 0, adresse = '';
  const sb = monter((url) => { appels++; adresse = url; return Promise.resolve({ ok: true, json: () => Promise.resolve(RELEVE) }); });
  const P = sb.V2.produits;
  assert.equal(P.enRupture(EN_RUPTURE), false, 'rien tant que le relevé n\'est pas arrivé');
  assert.equal(P.enRupture(ANCIEN), false, 'l\'ancien fichier figé ne compte plus');
  assert.equal(P.rupturesEtat(), 1);
  await attendre(); await attendre(); await attendre();
  assert.equal(P.rupturesEtat(), 2);
  assert.equal(P.enRupture(EN_RUPTURE), true);
  assert.equal(P.enRupture(Number(EN_RUPTURE)), true, 'un CIP lu comme nombre est reconnu');
  assert.equal(P.enRupture(EN_TENSION), false);
  assert.equal(P.enRupture(ANCIEN), false);
  assert.equal(appels, 1);
  assert.match(adresse, /^ansm-dispo\.json\?v=\d{4}-\d{2}-\d{2}$/);
  assert.equal(sb.rendus, 1, 'l\'écran se redessine une fois à l\'arrivée du relevé');
});

test('pas de nouveau rendu si l\'on a quitté l\'écran avant l\'arrivée du relevé', async () => {
  const sb = monter(() => Promise.resolve({ ok: true, json: () => Promise.resolve(RELEVE) }));
  sb.V2.produits.enRupture(EN_RUPTURE);
  sb.V2.route = { name: 'accueil' };
  await attendre(); await attendre(); await attendre();
  assert.equal(sb.rendus, 0);
  assert.equal(sb.V2.produits.enRupture(EN_RUPTURE), true);
});

test('relevé absent ou en erreur : aucun badge, aucune exception', async () => {
  const sb = monter(() => Promise.resolve({ ok: false }));
  assert.equal(sb.V2.produits.enRupture(EN_RUPTURE), false);
  await attendre(); await attendre();
  assert.equal(sb.V2.produits.rupturesEtat(), 3);
  assert.equal(sb.V2.produits.enRupture(EN_RUPTURE), false);
  const sb2 = monter(() => Promise.reject(new Error('réseau')));
  sb2.V2.produits.enRupture(EN_RUPTURE);
  await attendre(); await attendre();
  assert.equal(sb2.V2.produits.rupturesEtat(), 3);
  const sb3 = monter(null);
  assert.equal(sb3.V2.produits.enRupture(EN_RUPTURE), false, 'sans fetch : rien, sans erreur');
});
