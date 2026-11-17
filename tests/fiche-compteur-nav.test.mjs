// 27/10/2026 (Will) : compter Précédente / Suivante / « Autre officine… » de la fiche, pour la mesure avant/après du 09/11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const V2D = new URL('../crm/v2/', import.meta.url);
const lire = (f) => readFileSync(new URL(f, V2D), 'utf8');

// V2.mesurer tel qu'il est dans v2-app.js, exécuté avec une base factice qui note chaque envoi
function mesureur() {
  const s = lire('v2-app.js');
  const a = s.indexOf('  function _vusLire()'), b = s.indexOf('  // Le bandeau rouge de diagnostic');
  assert.ok(a > 0 && b > a, 'V2.mesurer introuvable dans v2-app.js');
  const envois = [], stock = {};
  const ctx = {
    V2: { user: { id: 'u1', name: 'Test' }, sb: () => ({ from: () => ({ insert: (r) => { envois.push(r.ecran); return { then() {} }; } }) }) },
    sessionStorage: { getItem: (k) => (k in stock ? stock[k] : null), setItem: (k, v) => { stock[k] = String(v); } },
    Date, JSON, Math
  };
  vm.runInNewContext(s.slice(a, b), ctx);
  return { mesurer: ctx.V2.mesurer, envois };
}

test('un écran reste compté une fois par 5 min (inchangé)', () => {
  const m = mesureur();
  m.mesurer('pharma'); m.mesurer('pharma');
  assert.deepEqual(m.envois, ['pharma']);
});
test('un geste est compté à CHAQUE appui', () => {
  const m = mesureur();
  m.mesurer('fiche-suivante', true); m.mesurer('fiche-suivante', true); m.mesurer('fiche-precedente', true);
  assert.deepEqual(m.envois, ['fiche-suivante', 'fiche-suivante', 'fiche-precedente']);
});
test('un geste ne bloque pas le comptage de l’écran qui suit', () => {
  const m = mesureur();
  m.mesurer('fiche-autre', true); m.mesurer('pharma');
  assert.deepEqual(m.envois, ['fiche-autre', 'pharma']);
});
test('les trois boutons de la fiche portent leur geste, et va() le compte avant d’ouvrir', () => {
  const s = lire('v2-pharma.js');
  assert.ok(s.includes("cible(i - 1, 'fiche-precedente')"));
  assert.ok(s.includes("cible(i + 1, 'fiche-suivante')"));
  assert.ok(s.includes("\\',0,\\'fiche-autre\\')"));
  const va = s.slice(s.indexOf('va: function (id, liste, geste)'), s.indexOf('chercher: function'));
  assert.ok(va.indexOf('V2.mesurer(geste, true)') > 0 && va.indexOf('V2.mesurer(geste, true)') < va.indexOf("V2.go('pharma'"));
});
test('le clic sur une ligne de la liste ne compte pas de geste', () => {
  assert.ok(lire('v2-pharma.js').includes("V2.pharmaNav.va(\\'' + V2.esc(String(x.p.id)) + '\\',1)\">"));
});
