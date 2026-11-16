/* fiche-tranches-marge.test.mjs — barres « par tranche de prix » de la fiche officine (16/11/2026, retour de Valérie) :
 * la marge du pharmacien de la tranche est écrite sur sa ligne ; tranche sans marge = rien (pas « 0 € »).
 * tranchesBarres est extraite de v2-pharma.js et exécutée sur des données INVENTÉES. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const a = src.indexOf('  function tranchesBarres('), b = src.indexOf('  function analyseTranches(');
assert.ok(a > 0 && b > a, 'tranchesBarres introuvable');
const boot = readFileSync(new URL('../crm/v2/v2-boot.js', import.meta.url), 'utf8');
const fa = boot.indexOf('  V2.fmtEur = function'), fb = boot.indexOf('  V2.fmtK = function');
assert.ok(fa > 0 && fb > fa, 'V2.fmtEur introuvable');
const ctx = { V2: {}, esc: (s) => String(s == null ? '' : s) };
vm.runInNewContext(boot.slice(fa, fb) + src.slice(a, b) + '\nthis.f = tranchesBarres;', ctx);
const f = ctx.f;

const L = [
  { label: 'Princeps · Petits prix', sub: '0 – 4,33 €', color: '#1E9E6A', ca: 20084, mdl: 1211.4 },
  { label: 'Génériques', sub: '', color: '#737A8C', ca: 9000, mdl: 0 },
  { label: 'Princeps · Chers', sub: '> 468 €', color: '#C7791A', ca: 0, mdl: 0 },
  { label: 'Hors catégories', color: 'var(--muted-2)', ca: 500 }
];
const lignes = (h) => h.split('<div class="pha-tb-r">').slice(1);

test('vue pharmacien : « votre marge » et le montant de la tranche sur sa ligne', () => {
  const r = lignes(f(L, 29584, true));
  assert.equal(r.length, 3);   // tranche à 0 € de chiffre d'affaires masquée
  assert.match(r[0], /Princeps · Petits prix/);
  assert.match(r[0], /<span class="pha-tb-ml">votre marge<\/span> <b class="cl1-num">1[\s\u202f]211 €<\/b>/);
});
test('vue Intégral : « marge du pharmacien »', () => {
  const r = lignes(f(L, 29584, false));
  assert.match(r[0], /marge du pharmacien<\/span> <b class="cl1-num">1[\s\u202f]211 €<\/b>/);
  assert.doesNotMatch(r[0], /votre marge/);
});
test('tranche sans marge (génériques, hors catégories) : rien, ni « marge » ni « 0 € »', () => {
  const r = lignes(f(L, 29584, true));
  for (const l of [r[1], r[2]]) {
    assert.match(l, /<span class="pha-tb-m"><\/span>/);
    assert.doesNotMatch(l, /marge/);
    assert.doesNotMatch(l, /(^|[^0-9 ])0 €/);
  }
});
test('marge sous 1 000 € : centimes, comme les autres montants ; marge infime arrondie à 0 = rien', () => {
  const r = lignes(f([{ label: 'X', color: '#000', ca: 3000, mdl: 812.346 }, { label: 'Y', color: '#000', ca: 10, mdl: 0.004 }], 3010, true));
  assert.match(r[0], /<b class="cl1-num">812,35 €<\/b>/);
  assert.match(r[1], /<span class="pha-tb-m"><\/span>/);
});
