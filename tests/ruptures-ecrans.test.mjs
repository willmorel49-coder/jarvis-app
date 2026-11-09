/* Copilote, Appro et radar des rendez-vous (09/11/2026) : ils lisaient ruptures-data.js, figé au 06/07/2026
   (1 866 produits du réseau marqués pour 13 vraiment en rupture au relevé ANSM du 08/11). Ils lisent désormais le même
   relevé que le Catalogue : ansm-dispo.json, « Rupture de stock » seulement (V2.produits.enRupture).
   Données FABRIQUÉES : la réponse est connue d'avance. Pas de navigateur.
   Lancer : node --test tests/ruptures-ecrans.test.mjs */
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
  const doc = { getElementById: () => null, createElement: () => ({ id: '', textContent: '', style: {} }), head: { appendChild() {} }, addEventListener() {} };
  const sb = { document: doc, console, setTimeout, clearTimeout, URL, Blob, Date, Promise, Math, Object, Array, String, Number, JSON, RegExp, isFinite, parseFloat, parseInt };
  if (fetch) sb.fetch = fetch;
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  sb.rendus = 0;
  vm.runInContext(`window.V2 = { pages:{}, sales:[], pharmacies:[], route:{ name:'marche' },
    esc: s => String(s==null?'':s), fmtEur: n => String(n), fmtNum: n => String(n),
    topbar: () => '', go(){}, toast(){}, render(){ window.rendus++; } }; window.ICO = () => '';
    window.RUPTURES = { meta:{ annee:'2025' }, data:{ '${ANCIEN}':{ d:'', dt:'2025-12-31' } } };`, sb);
  vm.runInContext(lire('v2-produits-moteur.js'), sb);
  vm.runInContext(lire('v2-produits.js'), sb);
  vm.runInContext(lire('v2-copilote.js'), sb);
  return sb;
}
const attendre = () => new Promise((r) => setTimeout(r, 0));

test('V2.rupture suit le relevé du jour : rien avant son arrivée, puis seulement « Rupture de stock »', async () => {
  const sb = monter(() => Promise.resolve({ ok: true, json: () => Promise.resolve(RELEVE) }));
  const V2 = sb.V2;
  assert.equal(V2.rupture(EN_RUPTURE), null, 'rien tant que le relevé n\'est pas arrivé');
  assert.equal(V2.rupturesPretes(), false);
  await attendre(); await attendre(); await attendre();
  assert.equal(V2.rupturesPretes(), true);
  assert.ok(V2.rupture(EN_RUPTURE), 'en rupture');
  assert.equal(V2.rupture(EN_TENSION), null, 'une tension n\'est pas une rupture');
  assert.equal(V2.rupture(ANCIEN), null, 'l\'ancien fichier figé ne compte plus');
  assert.equal(V2.rupture(Number(EN_RUPTURE)) !== null, true, 'un CIP lu comme nombre est reconnu');
  assert.equal(sb.rendus, 1, 'l\'écran se redessine une fois à l\'arrivée du relevé');
});

test('relevé introuvable : jamais « en rupture » par défaut, et l\'écran ne boucle pas', async () => {
  let appels = 0;
  const sb = monter(() => { appels++; return Promise.resolve({ ok: false }); });
  assert.equal(sb.V2.rupturesPretes(), false);
  await attendre(); await attendre(); await attendre();
  assert.equal(sb.V2.rupturesPretes(), false);
  assert.equal(sb.V2.rupture(EN_RUPTURE), null);
  assert.equal(appels, 1);
  assert.equal(sb.V2.produits.rupturesEtat(), 3);
});

test('plus aucun des trois écrans ne lit window.RUPTURES', () => {
  for (const f of ['v2-copilote.js', 'v2-appro.js', 'v2-rdv-radar.js']) {
    const code = lire(f).split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
    assert.ok(!/window\.RUPTURES|\bRUPTURES\b\./.test(code), f + ' lit encore window.RUPTURES');
  }
});
