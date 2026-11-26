// 26/11/2026 — planche « ordinateur », Mes officines : B4 (onglets « Mes clients » / « Mes prospects »), B14 v2 (menu « Tri » caché à l'ordinateur),
// B5 v2 (bascule « Vue pharmacien » dans la liste, même préférence que la fiche ; « Notre marge Intégral » n'est pas écrite dans la page).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../crm/v2/v2-pharma.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../crm/v2/v2.css', import.meta.url), 'utf8');

function fn(nom) {
  const i = src.indexOf('  function ' + nom + '(');
  assert.ok(i >= 0, 'introuvable : ' + nom);
  const j = src.indexOf('\n  }\n', i);
  return src.slice(i, j + 5);
}

test('B4 : les onglets s\'appellent « Mes clients » et « Mes prospects »', () => {
  assert.match(src, /sTab\('clients', 'Mes clients', nbCli\) \+ sTab\('prospects', 'Mes prospects', nbProsp\)/);
  assert.ok(!/sTab\('prospects', 'Prospects de mon secteur'/.test(src));
});

test('B14 v2 : le menu « Tri » de la rangée n\'est caché qu\'au-dessus de 640 px (là où les titres de colonnes s\'affichent)', () => {
  assert.match(css, /@media \(min-width: 641px\) \{ \.ofl-filtres > \.ofl-tri-bureau \{ display: none; \} \}/);
  const tel = css.slice(css.indexOf('/* ── Téléphone : le tableau devient une liste'));
  assert.match(tel, /^[^]*?@media \(max-width: 640px\) \{[^]*?\.ofl-ent \{ display: none; \}/);   // les titres disparaissent exactement sous 641 px
  assert.match(src, /oflTriSelect\(\)\.replace\('class="ofl-sel"', 'class="ofl-sel ofl-tri-bureau"'\)/);
  const bur = fn('oflFiltres');
  assert.ok(/oflTriSelect\(\)/.test(src.slice(src.indexOf('function oflfHtml'), src.indexOf('function oflEntete'))), 'la feuille du téléphone garde le tri');
  assert.ok(bur.includes('ofl-tri-bureau'));
});

test('B5 v2 : en vue pharmacien (ordinateur), la ligne n\'écrit pas « Notre marge Intégral », ni sous le nom ; en vue Intégral, elle l\'écrit', () => {
  const V2 = { esc: (s) => String(s), voitVentesDe: () => true, fmtEur: (n) => n + ' €', titulaireDe: () => '', notreMarge: { dispo: () => true } };
  const mk = (vuePh) => new Function('V2', '_rap', 'trnDe', 'notreMargeDe', 'cl1PerV', 'oflPerMarge', 'cl1PerOff', 'oflVuePh', 'cpDe',
    fn('ligneOfl') + '; return ligneOfl;')(V2, {}, () => [], () => ({ tot: 4242 }), () => '', () => '', () => '', () => vuePh, () => '');
  const x = { p: { id: 7, name: 'Pharmacie Test', ville: 'Brest' }, ca: 1000, marge: 77 };
  const ph = mk(true)(x), int = mk(false)(x);
  assert.ok(!ph.includes('4242'), 'aucune trace de la marge dans la page');
  assert.ok(ph.includes('masquée') && ph.includes('77 €'), 'la marge du pharmacien reste');
  assert.ok(int.includes('4242 €') && !int.includes('masquée'));
});

test('B5 v2 : une seule préférence pour la liste et la fiche, la liste d\'ordinateur seulement', () => {
  assert.match(src, /function oflVuePh\(\) \{ return !isOpso\(\) && !telEcran\(\) && viLire\(\) === 'pharmacien'; \}/);
  const v = src.slice(src.indexOf('V2.oflVue = function'), src.indexOf('V2.oflTrier = function'));
  assert.match(v, /localStorage\.setItem\(VI_CLE, viCourante\)/);
  assert.match(v, /ofl\.tri === 'nm'/);
});
