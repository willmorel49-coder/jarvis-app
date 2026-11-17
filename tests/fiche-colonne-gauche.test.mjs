/* fiche-colonne-gauche.test.mjs — la colonne (menu, identité, infos, profil, NOTES, rendez-vous) revient en vue Intégral (17/11/2026).
 * Contrôle de SOURCE (pas de navigateur) sur renderDetail et le CSS de la fiche d4. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../crm/v2/v2-dk-officines.css', import.meta.url), 'utf8');
const rail = src.split('\n').find((l) => l.includes("'<div class=\"pha-rail\">' + viW(phaNavHtml(pid), 'vi-int')"));

test('la colonne n’est plus cachée en vue Intégral : elle n’a plus la classe vi-ph, son contenu interne est vi-int', () => {
  assert.ok(rail, 'ligne de la colonne');
  assert.ok(!rail.includes("pha-rail' + (fi ? ' vi-ph'"), 'plus de vi-ph sur la colonne');
  assert.ok(rail.includes("viW(fe.panneau, 'vi-int')") && rail.includes("viW(listes + infos + notes, 'vi-int')") && rail.includes('phaNavHtml(pid)') && rail.includes('idCard'));
  assert.ok(!/pha-rail[^\n]*vi-ph/.test(rail));
});
test('les notes sont dans la colonne : la fenêtre n’est plus posée, donc aucun id de note en double', () => {
  assert.ok(!/\(fi && V2\.notes \? dkfNoteFenetre\(/.test(src), 'dkfNoteFenetre n’est plus appelée');
  assert.equal((src.match(/V2\.notes\.section\('client', pid\)/g) || []).length >= 1, true);
  const corps = src.slice(src.indexOf('function dkfNoteFenetre('), src.indexOf('function nfOuvre('));
  assert.ok(corps.includes("V2.notes.section('client', pid)"), 'la fonction dormante existe encore, jamais posée en même temps que la colonne');
  assert.ok(src.includes("var notes = V2.notes ? '<div class=\"pha-notes\">'"), 'les notes de la colonne');
});
test('« Prendre une note » : passe en vue Intégral puis défile jusqu’au champ de la colonne', () => {
  const i = src.indexOf('    noter: function (el) {'), f = src.slice(i, i + 900);
  assert.ok(f.includes("V2.pharmaVue('integral')") && f.includes('scrollIntoView') && f.includes('.pha-notes .v2-notes-box[data-st] .v2-notes-add .v2-notes-ta'));
});
test('la grille à deux colonnes vaut aussi en vue Intégral (règle « toute la largeur » retirée)', () => {
  assert.ok(!/data-vue="integral"\]\s*\.pha\s*\{/.test(css), 'plus de colonne unique en vue Intégral');
  assert.ok(/\.pha \{ grid-template-columns: minmax\(0, 1fr\) 384px/.test(css) && /\.pha-rail \{ grid-column: 2/.test(css));
});
test('la bande de la vue Intégral dit la nouvelle phrase', () => {
  assert.ok(src.includes('Vue Intégral : notre marge, vos notes et ses informations. À ne pas lui montrer.'));
  assert.ok(!src.includes('notre marge seule, comparée à nos clients'));
});
