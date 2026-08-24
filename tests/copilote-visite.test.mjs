/* copilote-visite.test.mjs — « Prépare ta visite » propose-t-il ce qui pèse ?
 *
 * ⚠️ LE DÉFAUT CORRIGÉ LE 24/08/2026. Cet écran classait ses arguments produit
 * par NOMBRE DE BOÎTES vendues en France, et écartait tout ce qui passait sous
 * 12 boîtes par an. Un produit cher se vend par unités : mesuré sur une
 * officine réelle, 19 produits à plus de 468 € étaient candidats et AUCUN ne
 * survivait au plancher. L'écran qu'on ouvre avant un rendez-vous ne pouvait
 * structurellement jamais proposer un produit cher — alors que c'est là que le
 * réseau fait deux fois moins de chiffre que la France.
 *
 * `officineGaps` est extraite du fichier livré et tourne sur les vraies ventes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(RACINE, 'crm', 'v2');
const lire = (f) => readFileSync(join(DIR, f), 'utf8');

// ── Les vraies données ─────────────────────────────────────────────────────
const bac = { window: {}, console };
vm.createContext(bac);
const charger = (f) => vm.runInContext(lire(f), bac, { filename: f });
for (const f of ['prod-stats-data.js', 'ameli-avg-data.js', 'stock-data.js', 'wml-officines-data.js']) charger(f);
for (let i = 1; i <= 10; i++) charger(`wml-ventes-${String(i).padStart(2, '0')}.js`);
const W = bac.window, dO = W.WML_D_OFFICINES, dP = W.WML_D_PRODUITS;

// Ce que chaque officine commande déjà
const commande = {};
for (const s of W.WML_SALES) {
  const ph = String(dO[s[0]]);
  (commande[ph] = commande[ph] || new Set()).add(String(dP[s[3]]));
}
// L'officine la mieux fournie : c'est celle où il reste le moins de trous
// faciles, donc le cas le plus exigeant pour le classement.
const CIBLE = Object.keys(commande).sort((a, b) => commande[b].size - commande[a].size)[0];

// ── `officineGaps` extraite du fichier livré ───────────────────────────────
const SRC = lire('v2-copilote.js');
function extraire(nom) {
  const i = SRC.indexOf(`function ${nom}(`);
  assert.ok(i > 0, `fonction ${nom} introuvable dans v2-copilote.js`);
  let p = 0, j = SRC.indexOf('{', i);
  for (; j < SRC.length; j++) {
    if (SRC[j] === '{') p++;
    else if (SRC[j] === '}') { p--; if (p === 0) break; }
  }
  return SRC.slice(i, j + 1);
}
const GAIN_MINI = +((SRC.match(/var GAIN_MINI = (\d+)/) || [])[1] || 0);

const bac2 = {
  console,
  PS: () => W.PROD_STATS,
  eligible: (r) => ['pr_low', 'pr_mid', 'pr_high'].includes(r.f) && (W.STOCK_IP.data[String(r.c)] > 0),
  orderedCips: (pid) => {
    const o = {};
    for (const c of (commande[pid] || new Set())) o[c] = 1;
    return o;
  },
  V2: { market: (cip) => { const v = W.AMELI_AVG.data[String(cip)]; return v == null ? null : { avgYear: v }; } },
  GAIN_MINI,
};
vm.createContext(bac2);
vm.runInContext(extraire('officineGaps'), bac2);
const gaps = (pid, n) => vm.runInContext('officineGaps', bac2)(pid, n);

const tranche = (net) => (net < 4.33 ? 0 : net < 468 ? 1 : net < 2000 ? 2 : 3);

test('les donnees portent bien des produits chers candidats — sinon rien a prouver', () => {
  const owned = commande[CIBLE];
  const chers = W.PROD_STATS.filter((r) => bac2.eligible(r) && !owned.has(String(r.c))
    && W.AMELI_AVG.data[String(r.c)] > 0 && tranche(+r.net || 0) >= 2);
  assert.ok(chers.length >= 5,
    `seulement ${chers.length} produits chers candidats : le cas n est pas represente`);
});

test('le classement suit les EUROS, pas le nombre de boites', () => {
  const l = gaps(CIBLE, 25);
  assert.ok(l.length >= 10, `seulement ${l.length} arguments`);
  for (let i = 1; i < l.length; i++) {
    assert.ok(l[i].eur <= l[i - 1].eur + 0.01,
      `classement casse a la position ${i + 1} : ${l[i].eur} apres ${l[i - 1].eur}`);
  }
  const volumes = l.map((x) => x.fr);
  assert.ok(volumes[0] < Math.max(...volumes),
    'le premier argument est aussi le plus gros volume : le tri pourrait encore etre celui des boites');
});

test('un produit cher peut ENFIN apparaitre dans les arguments', () => {
  // ⚠️ Le coeur du defaut : avec l ancien plancher de 12 boites par an, la
  // reponse etait NON pour toutes les officines testees.
  let officinesAvecCher = 0, testees = 0;
  for (const pid of Object.keys(commande).slice(0, 60)) {
    const l = gaps(pid, 25);
    if (!l.length) continue;
    testees++;
    if (l.some((x) => tranche(+x.r.net || 0) >= 2)) officinesAvecCher++;
  }
  assert.ok(testees >= 30, `seulement ${testees} officines testables`);
  assert.ok(officinesAvecCher / testees > 0.5,
    `seulement ${officinesAvecCher} officines sur ${testees} voient un produit a plus de 468 € : `
    + 'le classement en euros ne les fait toujours pas remonter');
});

test('l ancien plancher au VOLUME aurait tout ecarte — contre-epreuve', () => {
  // On rejoue l ancienne regle pour prouver que le test discrimine.
  const owned = commande[CIBLE];
  const chers = W.PROD_STATS.filter((r) => bac2.eligible(r) && !owned.has(String(r.c))
    && W.AMELI_AVG.data[String(r.c)] > 0 && tranche(+r.net || 0) >= 2);
  const survivants = chers.filter((r) => W.AMELI_AVG.data[String(r.c)] >= 12);
  assert.equal(survivants.length, 0,
    `${survivants.length} produits chers passaient l ancien plancher : le defaut n etait pas celui decrit`);
});

test('le potentiel affiche vaut boites France x prix net', () => {
  const l = gaps(CIBLE, 25);
  for (const x of l.slice(0, 8)) {
    const attendu = W.AMELI_AVG.data[String(x.r.c)] * (+x.r.net);
    assert.ok(Math.abs(x.eur - attendu) < 0.01,
      `${x.r.d} : ${x.eur} calcule pour ${attendu} attendus`);
  }
});

test('aucun argument sur un produit hors stock, ni deja commande', () => {
  const l = gaps(CIBLE, 25);
  for (const x of l) {
    assert.ok(W.STOCK_IP.data[String(x.r.c)] > 0, `${x.r.d} propose sans stock Integral`);
    assert.ok(!commande[CIBLE].has(String(x.r.c)), `${x.r.d} est deja commande par cette officine`);
  }
});

test('la phrase affichee annonce le montant comme un ordre de grandeur', () => {
  assert.ok(/environ <b>' \+ eur\(o\.eur\)/.test(SRC),
    'le montant n est pas introduit par « environ »');
});
