// 20/11/2026 — fiche d'une officine « Le rendez-vous » (v1 choisie par Will) : une seule fiche, la bascule ne fait que cacher l'interne.
// 21/11/2026 — « Le dossier » (choisie par Will) : plus de « Produits à proposer » (déjà dans les listes), donc 5 chapitres.
// Ce que ce test garde : l'ordre des chapitres du rendez-vous, l'interne regroupé en dernier (chapitre 5, vi-int),
// aucun bloc réservé à la vue pharmacien (vi-ph), des noms globaux définis une seule fois, et deux règles de la feuille :
// pas d'opacity (le texte garde son contraste pendant l'arrivée), et au téléphone les ronds internes hors du flux (la bascule ne décale rien).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../crm/v2/v2.css', import.meta.url), 'utf8');

const corps = (nom) => {
  const i = js.indexOf('function ' + nom + '(');
  assert.ok(i > 0, nom + ' introuvable');
  const j = js.indexOf('\n  }\n', i);
  return js.slice(i, j);
};
const feuille = (() => {
  const i = css.indexOf('Fiche officine — version « Le rendez-vous »');
  const j = css.indexOf('fin fiche officine « Le rendez-vous »');
  assert.ok(i > 0 && j > i, 'bloc fdr- introuvable dans v2.css');
  return css.slice(css.indexOf('*/', i) + 2, j);
})();

test('fiche : chapitres dans l ordre du rendez-vous, l interne en dernier', () => {
  const m = js.match(/var FDR_CH = (\[\[.*?\]\]);/);
  assert.ok(m, 'FDR_CH introuvable');
  const titres = JSON.parse(m[1].replace(/'/g, '"')).map((c) => c[1]);
  assert.deepEqual(titres, ['Chiffres', 'Produits qui ne sont plus commandés',
    'Par catégorie et tranche de prix', 'Génériqueurs et biosimilaires', 'Côté Intégral']);
  const page = corps('fdrPage');
  const ordre = [1, 2, 3, 4, 5].map((n) => page.indexOf('fdrChapitre(' + n + ','));
  ordre.forEach((p, k) => assert.ok(p > 0 && (k === 0 || p > ordre[k - 1]), 'chapitre ' + (k + 1) + ' hors ordre'));
  assert.ok(!/fdrChapitre\(6,/.test(page), 'un 6e chapitre est revenu');
  assert.match(page.slice(ordre[4]), /'vi-int fdr-int'/, 'le chapitre 5 doit être interne (vi-int)');
  assert.match(page, /fdr-pil' \+ \(i === FDR_SOM\.length - 1 \? ' vi-int'/, 'la dernière pastille du sommaire doit être interne');
  assert.ok(!/Produits à proposer|c\.proposer/.test(page), '« Produits à proposer » ne revient pas sur la fiche');
});

test('fiche : une seule fiche — aucun bloc réservé à la vue pharmacien (vi-ph) dans la page', () => {
  for (const f of ['fdrPage', 'fdrChapitre', 'fdrMontants', 'fdrCourbe', 'fdrComparaison', 'fdrActions']) {
    assert.ok(!/vi-ph(?![a-z-])/.test(corps(f).replace(/<span class="vi-ph">Fiche officine<\/span>/, '')), f + ' contient un bloc vi-ph');
  }
});

test('fiche : V2.fdrAller et V2.fdrModifier définis une seule fois', () => {
  for (const n of ['fdrAller', 'fdrModifier']) {
    const defs = js.match(new RegExp('V2\\.' + n + '\\s*=', 'g')) || [];
    assert.equal(defs.length, 1, 'V2.' + n + ' : ' + defs.length + ' définitions');
  }
});

test('fiche : la feuille fdr- ne met jamais d opacity (arrivée = glissement seul)', () => {
  const sans = feuille.replace(/stop-opacity|fill-opacity|stroke-opacity/g, '');
  assert.ok(!/opacity\s*:/.test(sans), 'opacity trouvée dans la feuille de la fiche');
  assert.match(feuille, /\.fdr-on \.fdr-rv\.fdr-arme\{transform:translateY\(16px\)\}/);
});

test('fiche : au téléphone les ronds internes sont hors du flux (la bascule ne décale pas la page)', () => {
  const tel = feuille.split('@media (max-width:640px){')[1] || '';
  const r = tel.match(/\.fdr-on \.fdr-ronds\{([^}]*)\}/);
  assert.ok(r, 'règle .fdr-ronds du téléphone introuvable');
  assert.match(r[1], /position:fixed/);
  assert.match(corps('fdrActions'), /class="fdr-ronds vi-int"/, 'les ronds doivent rester internes');
});
