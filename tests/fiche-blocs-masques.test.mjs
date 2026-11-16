/* fiche-blocs-masques.test.mjs — mémorisation du « Masquer / Afficher » de chaque bloc de la fiche officine (16/11/2026).
 * Le petit module (bmDisque / bmEtat / bmPoser) est extrait de v2-pharma.js entre les deux repères ==== BLOCS-MASQUES et exécuté
 * avec trois sortes de localStorage : normal, absent, qui lève. Données inventées. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const a = src.indexOf('// ==== BLOCS-MASQUES début'), b = src.indexOf('// ==== BLOCS-MASQUES fin');
assert.ok(a > 0 && b > a, 'repères du module introuvables');
function charge(window) {
  const ctx = { window };
  vm.runInNewContext(src.slice(a, b) + '\nthis.api = { etat: bmEtat, poser: bmPoser, disque: bmDisque };', ctx);
  return ctx.api;
}
const memoire = (init) => { const m = { v: init }; return { m, localStorage: { getItem: () => m.v, setItem: (k, v) => { m.v = v; } } }; };

test('rien de retenu : tout affiché ; un bloc masqué par défaut le reste tant qu’on n’a rien choisi', () => {
  const api = charge(memoire(null));
  assert.equal(api.etat('graphique', false), false);
  assert.equal(api.etat('detail-produits', true), true);
});
test('masquer puis afficher : un seul objet JSON dans la clé unique, relu par une nouvelle page', () => {
  const w = memoire(null);
  let api = charge(w);
  assert.equal(api.poser('graphique', true), true);
  assert.equal(JSON.parse(w.m.v).graphique, true);
  api.poser('top10', true); api.poser('graphique', false);
  assert.deepEqual(JSON.parse(w.m.v), { graphique: false, top10: true });
  api = charge({ localStorage: w.localStorage });   // « autre page » : même stockage, mémoire de séance neuve
  assert.equal(api.etat('top10', false), true); assert.equal(api.etat('graphique', true), false);
});
test('un bloc masqué par défaut peut être affiché : le choix explicite l’emporte', () => {
  const api = charge(memoire(null));
  api.poser('detail-produits', false);
  assert.equal(api.etat('detail-produits', true), false);
});
test('localStorage absent : aucune erreur, le choix tient pour la séance', () => {
  const api = charge({});
  assert.equal(api.etat('notes', false), false);
  assert.equal(api.poser('notes', true), false);   // pas enregistré sur l’appareil…
  assert.equal(api.etat('notes', false), true);    // …mais tenu en mémoire pour la page
});
test('localStorage qui lève (lecture et écriture) : aucune erreur', () => {
  const boom = () => { throw new Error('SecurityError'); };
  const api = charge({ localStorage: { getItem: boom, setItem: boom } });
  assert.equal(api.etat('infos', false), false);
  assert.equal(api.poser('infos', true), false);
  assert.equal(api.etat('infos', false), true);
});
test('accès à window.localStorage qui lève : aucune erreur', () => {
  const w = {}; Object.defineProperty(w, 'localStorage', { get() { throw new Error('SecurityError'); } });
  const api = charge(w);
  assert.equal(api.etat('infos', false), false); assert.equal(api.poser('infos', true), false);
});
test('valeur corrompue : ignorée, la page s’affiche normalement, et l’écriture suivante la remplace', () => {
  for (const mauvais of ['{pas du json', '[1,2]', '"texte"', '42', 'null', '{"graphique":"oui","top10":1}']) {
    const w = memoire(mauvais);
    const api = charge(w);
    assert.equal(api.etat('graphique', false), false, mauvais);
    assert.equal(api.etat('top10', false), false, mauvais);
    api.poser('notes', true);
    assert.deepEqual(JSON.parse(w.m.v), { notes: true }, mauvais);
  }
});
