/* tx-partage.test.mjs — pièces jointes de Karine (Android/Chrome), 26/10/2026
 *
 * Chrome refuse TOUT le lot (canShare = false) dès qu'un seul fichier n'est pas d'un type partageable :
 * un Excel coché faisait basculer le PDF et le CSV en téléchargement. V2.txPartage sépare le lot :
 * `ok` part par la feuille de partage, `reste` est téléchargé à côté.
 *
 * Le code exécuté est celui de crm/v2/v2-pharma.js, découpé tel quel — jamais recopié.
 * Le navigateur est simulé : `canShare` applique la règle qu'on lui donne.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RACINE = dirname(dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(join(RACINE, 'crm/v2/v2-pharma.js'), 'utf8');

// Découpe « V2.txPartage = function (files) { … }; », accolades comprises.
function decoupe() {
  const i = src.indexOf('V2.txPartage = function');
  assert.ok(i >= 0, 'V2.txPartage introuvable dans v2-pharma.js');
  let p = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) {
    if (src[j] === '{') p++;
    else if (src[j] === '}') { p--; if (p === 0) break; }
  }
  return src.slice(i, j + 1) + ';';
}
const CODE = decoupe();

function charger(navigator) {
  const ctx = { V2: {}, navigator };
  vm.runInNewContext(CODE, ctx);
  return ctx.V2.txPartage;
}
const fichier = (name) => ({ name });
const PDF = fichier('mode-emploi-import-lgo.pdf'), CSV = fichier('catalogue-lgo.csv'), XLSX = fichier('catalogue-lgo.xlsx');
// Array.from : les tableaux nés dans le bac à sable vm n’ont pas le même prototype (deepStrictEqual les refuse).
const noms = (l) => Array.from(l, (f) => f.name);

// Règle de Chrome Android (liste MDN des types partageables : PDF, CSV, texte, images, audio, vidéo — pas l'Excel).
const chromeAndroid = {
  share() {},
  canShare: ({ files }) => files.every((f) => !/\.xlsx?$/i.test(f.name)),
};

test('Chrome Android : PDF + CSV + Excel → le PDF et le CSV partent, l’Excel reste', () => {
  const r = charger(chromeAndroid)([PDF, CSV, XLSX]);
  assert.deepEqual(noms(r.ok), [PDF.name, CSV.name]);
  assert.deepEqual(noms(r.reste), [XLSX.name]);
});

test('Chrome Android : Excel seul → rien à partager, repli téléchargement', () => {
  const r = charger(chromeAndroid)([XLSX]);
  assert.deepEqual(noms(r.ok), []);
  assert.deepEqual(noms(r.reste), [XLSX.name]);
});

test('Navigateur qui accepte tout (Safari) : lot entier partagé, comme avant', () => {
  const r = charger({ share() {}, canShare: () => true })([PDF, CSV, XLSX]);
  assert.deepEqual(noms(r.ok), [PDF.name, CSV.name, XLSX.name]);
  assert.deepEqual(noms(r.reste), []);
});

test('Sans partage natif (ordinateur) : tout part en téléchargement', () => {
  const r = charger({})([PDF, XLSX]);
  assert.deepEqual(noms(r.ok), []);
  assert.deepEqual(noms(r.reste), [PDF.name, XLSX.name]);
});

test('canShare qui lève une erreur : repli téléchargement, sans planter', () => {
  const r = charger({ share() {}, canShare() { throw new Error('refus'); } })([PDF]);
  assert.deepEqual(noms(r.ok), []);
  assert.deepEqual(noms(r.reste), [PDF.name]);
});

test('Fichiers acceptés un par un mais refusés ensemble : repli téléchargement', () => {
  const r = charger({ share() {}, canShare: ({ files }) => files.length === 1 })([PDF, CSV]);
  assert.deepEqual(noms(r.ok), []);
  assert.deepEqual(noms(r.reste), [PDF.name, CSV.name]);
});
